/**
 * Customer-safe presentation of V2E2 composition diffs.
 *
 * Converts engine classifications into homeowner-friendly factual lines.
 * Does not duplicate comparison logic or change engine semantics.
 * Never exposes role/slot/seed/product IDs or classification enum names.
 */

import type {
  CompositionDiffEntry,
  PackageStepUpItem,
} from "@/app/lib/packageComposition";

const INTERNAL_LABEL_PATTERN =
  /composition_role|composition_slot|catalog_seed|proposal\.roof|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const INTERNAL_QUANTITY_SUMMARY_PATTERN =
  /^(uses catalog|fixed quantity|measurement|multiplier|quantity mode)/i;

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function isInternalLabel(value: string): boolean {
  return INTERNAL_LABEL_PATTERN.test(value);
}

function customerEntryLabel(
  entry: CompositionDiffEntry["target"] | CompositionDiffEntry["base"]
): string | null {
  if (!entry) return null;
  const label = norm(entry.customerLabel) || norm(entry.productName);
  if (!label || /^line item$/i.test(label) || isInternalLabel(label)) {
    return null;
  }
  return label;
}

function isCustomerSafeQuantitySummary(summary: string): boolean {
  const trimmed = summary.trim();
  if (!trimmed) return false;
  if (INTERNAL_QUANTITY_SUMMARY_PATTERN.test(trimmed)) return false;
  if (isInternalLabel(trimmed)) return false;
  return true;
}

export function formatCustomerCompositionFact(
  entry: CompositionDiffEntry
): string | null {
  switch (entry.kind) {
    case "PRODUCT_REPLACEMENT":
      return customerEntryLabel(entry.target) ?? customerEntryLabel(entry.base);
    case "ADDED_INCLUDED_SCOPE": {
      const label = customerEntryLabel(entry.target);
      return label ? `Added ${label}` : null;
    }
    case "OPTIONAL_UPGRADE_ADDED": {
      const label = customerEntryLabel(entry.target);
      return label ? `Optional: ${label}` : null;
    }
    case "QUANTITY_CHANGE": {
      const label = customerEntryLabel(entry.target) ?? customerEntryLabel(entry.base);
      if (!label) return null;
      const baseSummary = norm(entry.base?.quantity.summary);
      const targetSummary = norm(entry.target?.quantity.summary);
      if (
        isCustomerSafeQuantitySummary(baseSummary) &&
        isCustomerSafeQuantitySummary(targetSummary) &&
        baseSummary !== targetSummary
      ) {
        return `${label}: ${baseSummary} → ${targetSummary}`;
      }
      return null;
    }
    case "UNCHANGED":
    case "LABEL_ONLY":
    case "REMOVED_INCLUDED_SCOPE":
    case "OPTIONAL_UPGRADE_REMOVED":
    case "OPTIONAL_UPGRADE_CHANGED":
      return null;
    default:
      return null;
  }
}

export function formatCustomerCompositionFacts(
  entries: readonly CompositionDiffEntry[]
): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const entry of entries) {
    const line = formatCustomerCompositionFact(entry);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines;
}

/**
 * Step-up customer facts keyed by packageId.
 * Base / non-comparison packages receive an empty list.
 */
export function buildCustomerFactLinesByPackageId(
  chain: readonly PackageStepUpItem[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const item of chain) {
    if (!item.diff.isComparison) {
      map.set(item.package.packageId, []);
      continue;
    }
    map.set(item.package.packageId, formatCustomerCompositionFacts(item.diff.entries));
  }
  return map;
}

export function assertCustomerFactLineSafe(line: string): void {
  if (INTERNAL_LABEL_PATTERN.test(line)) {
    throw new Error(`Customer fact line exposes internal identity: ${line}`);
  }
  if (
    /\b(UNCHANGED|LABEL_ONLY|PRODUCT_REPLACEMENT|QUANTITY_CHANGE|ADDED_INCLUDED_SCOPE|REMOVED_INCLUDED_SCOPE|OPTIONAL_UPGRADE_ADDED|OPTIONAL_UPGRADE_REMOVED|OPTIONAL_UPGRADE_CHANGED)\b/.test(
      line
    )
  ) {
    throw new Error(`Customer fact line exposes classification enum: ${line}`);
  }
}
