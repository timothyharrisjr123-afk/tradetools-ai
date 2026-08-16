/**
 * Customer-facing package comparison matrix from frozen/draft composition.
 *
 * Aligns packages on the same dimensions using composition roles/slots internally.
 * Emits homeowner language only — never slot keys, roles, IDs, or Added/Removed verbs.
 * Does not calculate prices or look up Catalog/Template.
 */

import type { CompositionEntry, PackageComposition } from "@/app/lib/packageComposition";
import { assertCustomerFactLineSafe } from "@/app/lib/packageCompositionCustomerFacts";
import { formatCustomerFacingLineLabel } from "@/app/lib/proposalCustomerFacingLabel";

export type CustomerComparisonAvailability = "included" | "available" | "not_included";

export type CustomerComparisonDimension = {
  label: string;
};

export type CustomerComparisonCell = {
  valueLabel: string;
  availability: CustomerComparisonAvailability;
};

export type CustomerPackageComparisonMatrix = {
  dimensions: CustomerComparisonDimension[];
  cellsByPackageId: Record<string, CustomerComparisonCell[]>;
};

export type CustomerComparisonAttribute = {
  dimension_label: string;
  value_label: string;
  availability: CustomerComparisonAvailability;
};

const ROLE_DIMENSION_ORDER = [
  "roof_covering",
  "underlayment",
  "ice_water",
  "ventilation",
  "flashing",
  "starter",
] as const;

const ROLE_DIMENSION_LABELS: Record<string, string> = {
  roof_covering: "Shingle system",
  underlayment: "Underlayment",
  ice_water: "Ice & water protection",
  ventilation: "Ventilation",
  flashing: "Flashing",
  starter: "Starter system",
};

const COMPARISON_SKIP_ROLES = new Set([
  "labor",
  "install",
  "installation",
  "tear_off",
  "disposal",
  "cleanup",
  "permit",
  "fee",
]);

const SHARED_SCOPE_LABEL_PATTERN =
  /tear-?off|install|labor|disposal|haul|dump|cleanup|permit|ridge cap|pipe boot|drip edge|starter strip|step flashing/i;

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function customerEntryLabel(entry: CompositionEntry): string | null {
  const raw = norm(entry.customerLabel) || norm(entry.productName);
  if (!raw || /^line item$/i.test(raw)) {
    return null;
  }
  const label = formatCustomerFacingLineLabel(raw);
  if (!label || /^line item$/i.test(label)) {
    return null;
  }
  try {
    assertCustomerFactLineSafe(label);
  } catch {
    return null;
  }
  return label;
}

function familyFromHaystack(haystack: string): string {
  if (/shingle|roof_covering|roof covering/.test(haystack)) return "roof_covering";
  if (/underlayment/.test(haystack)) return "underlayment";
  if (/ice.?water|ice_water/.test(haystack)) return "ice_water";
  if (/\broof[_\s.-]?vent|\bridge[_\s.-]?vent|\bventilation\b|\bvents?\b/.test(haystack)) {
    return "ventilation";
  }
  if (/flashing/.test(haystack)) return "flashing";
  if (/starter/.test(haystack)) return "starter";
  return "";
}

function inferredRole(entry: CompositionEntry): string {
  const explicit = roleKey(entry);
  if (explicit) return explicit;
  const provenance = familyFromHaystack(
    `${entry.provenanceKey ?? ""} ${entry.compositionSlotKey ?? ""}`.toLowerCase()
  );
  if (provenance) return provenance;
  return familyFromHaystack(`${entry.customerLabel} ${entry.productName ?? ""}`.toLowerCase());
}

function roleKey(entry: CompositionEntry): string {
  return norm(entry.compositionRole).toLowerCase();
}

function slotKey(entry: CompositionEntry): string {
  return norm(entry.compositionSlotKey);
}

function alignmentKey(entry: CompositionEntry, group: "included" | "optional"): string {
  const role = inferredRole(entry);
  if (role) {
    return `${group}:role:${role}`;
  }
  const slot = slotKey(entry);
  if (slot) {
    return `${group}:slot:${slot}`;
  }
  const provenance = norm(entry.provenanceKey);
  if (provenance) {
    return `${group}:prov:${provenance}`;
  }
  const product = norm(entry.productId);
  if (product) {
    return `${group}:product:${product}`;
  }
  const label = customerEntryLabel(entry);
  if (label) {
    return `${group}:label:${label.toLowerCase()}`;
  }
  return `${group}:entry:${entry.entryId}`;
}

function humanizeRole(role: string): string {
  return role.replace(/[._]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function dimensionLabelForEntry(entry: CompositionEntry, group: "included" | "optional"): string {
  const role = inferredRole(entry);
  if (role && ROLE_DIMENSION_LABELS[role]) {
    return ROLE_DIMENSION_LABELS[role];
  }
  if (role && !COMPARISON_SKIP_ROLES.has(role)) {
    return humanizeRole(role);
  }
  if (group === "optional") {
    return "Optional upgrades";
  }
  return customerEntryLabel(entry) ?? "Included protection";
}

function shouldSkipEntry(entry: CompositionEntry): boolean {
  const role = inferredRole(entry);
  if (COMPARISON_SKIP_ROLES.has(role)) {
    return true;
  }
  const label = customerEntryLabel(entry) ?? "";
  if (SHARED_SCOPE_LABEL_PATTERN.test(label)) {
    return true;
  }
  const hasAuthoritativeFamily = Boolean(roleKey(entry) || slotKey(entry));
  const hasFrozenProvenance = Boolean(norm(entry.provenanceKey));
  if (!hasAuthoritativeFamily && !hasFrozenProvenance && !label) {
    return true;
  }
  return false;
}

type DimensionSpec = {
  key: string;
  label: string;
  group: "included" | "optional";
  role: string;
};

function indexEntries(
  entries: readonly CompositionEntry[],
  group: "included" | "optional"
): Map<string, CompositionEntry> {
  const map = new Map<string, CompositionEntry>();
  for (const entry of entries) {
    if (shouldSkipEntry(entry)) continue;
    const key = alignmentKey(entry, group);
    if (!map.has(key)) {
      map.set(key, entry);
    }
  }
  return map;
}

function dimensionSortValue(spec: DimensionSpec): number {
  const roleIndex = ROLE_DIMENSION_ORDER.indexOf(
    spec.role as (typeof ROLE_DIMENSION_ORDER)[number]
  );
  if (roleIndex >= 0) {
    return spec.group === "optional" ? 100 + roleIndex : roleIndex;
  }
  return spec.group === "optional" ? 200 : 50;
}

function collectDimensionSpecs(packages: readonly PackageComposition[]): DimensionSpec[] {
  const seen = new Map<string, DimensionSpec>();

  for (const pkg of packages) {
    for (const entry of pkg.included) {
      if (shouldSkipEntry(entry)) continue;
      const key = alignmentKey(entry, "included");
      if (seen.has(key)) continue;
      seen.set(key, {
        key,
        label: dimensionLabelForEntry(entry, "included"),
        group: "included",
        role: inferredRole(entry),
      });
    }
    for (const entry of pkg.optionalUpgrades) {
      if (shouldSkipEntry(entry)) continue;
      const key = alignmentKey(entry, "optional");
      if (seen.has(key)) continue;
      const includedTwin = inferredRole(entry) ? `included:role:${inferredRole(entry)}` : null;
      if (includedTwin && seen.has(includedTwin)) continue;
      seen.set(key, {
        key,
        label: dimensionLabelForEntry(entry, "optional"),
        group: "optional",
        role: inferredRole(entry),
      });
    }
  }

  return [...seen.values()].sort((a, b) => {
    const order = dimensionSortValue(a) - dimensionSortValue(b);
    if (order !== 0) return order;
    return a.label.localeCompare(b.label);
  });
}

function assertCustomerSafeComparisonText(value: string): void {
  assertCustomerFactLineSafe(value);
  if (/\b(Added|Removed)\b/i.test(value)) {
    throw new Error(`Comparison copy must not use inverted diff language: ${value}`);
  }
  if (/composition_role|composition_slot_key|catalog_seed|catalog_item/i.test(value)) {
    throw new Error(`Comparison copy exposes internal identity: ${value}`);
  }
  if (/^[a-z0-9_]+\.[a-z0-9_]+$/i.test(value) || /^roofing\./i.test(value)) {
    throw new Error(`Comparison copy exposes catalog key: ${value}`);
  }
}

/**
 * Build aligned customer comparison dimensions from owned package compositions.
 * Totals are intentionally omitted — callers display frozen option totals separately.
 */
export function buildCustomerPackageComparisonMatrix(
  packages: readonly PackageComposition[]
): CustomerPackageComparisonMatrix {
  const specs = collectDimensionSpecs(packages);
  const cellsByPackageId: Record<string, CustomerComparisonCell[]> = {};

  for (const pkg of packages) {
    const includedByKey = indexEntries(pkg.included, "included");
    const optionalByKey = indexEntries(pkg.optionalUpgrades, "optional");
    cellsByPackageId[pkg.packageId] = specs.map((spec) => {
      if (spec.group === "optional") {
        const entry = optionalByKey.get(spec.key);
        if (!entry) {
          return { valueLabel: "—", availability: "not_included" };
        }
        return { valueLabel: "Available", availability: "available" };
      }
      const entry = includedByKey.get(spec.key);
      if (!entry) {
        return { valueLabel: "—", availability: "not_included" };
      }
      return {
        valueLabel: customerEntryLabel(entry) ?? "Included",
        availability: "included",
      };
    });
  }

  for (const spec of specs) {
    assertCustomerSafeComparisonText(spec.label);
  }
  for (const cells of Object.values(cellsByPackageId)) {
    for (const cell of cells) {
      assertCustomerSafeComparisonText(cell.valueLabel);
    }
  }

  return {
    dimensions: specs.map((spec) => ({ label: spec.label })),
    cellsByPackageId,
  };
}

export function comparisonAttributesForPackage(
  matrix: CustomerPackageComparisonMatrix,
  packageId: string
): CustomerComparisonAttribute[] {
  const cells = matrix.cellsByPackageId[packageId] ?? [];
  return matrix.dimensions.map((dimension, index) => ({
    dimension_label: dimension.label,
    value_label: cells[index]?.valueLabel ?? "—",
    availability: cells[index]?.availability ?? "not_included",
  }));
}

export function includedComparisonValueLabels(
  attributes: readonly CustomerComparisonAttribute[]
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const attribute of attributes) {
    if (attribute.availability !== "included") continue;
    const label = attribute.value_label.trim();
    if (!label || label === "—" || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}
