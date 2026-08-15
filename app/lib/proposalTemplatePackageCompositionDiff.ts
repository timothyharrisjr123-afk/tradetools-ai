/**
 * Template adapter for the generic package composition domain.
 *
 * Maps proposal_template graph + Catalog rows → PackageComposition,
 * then delegates comparison to comparePackageCompositions().
 * Templates UI / routes / Tailwind stay out of the domain engine.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  buildPackageStepUpChain,
  comparePackageCompositions,
  inheritCatalogQuantity,
  resolveCompositionDualIdentity,
  type CompositionEntry,
  type CompositionQuantityConfig,
  type PackageComposition,
  type PackageCompositionDiff,
  type PackageStepUpItem,
} from "@/app/lib/packageComposition";
import { buildCatalogByIdMap } from "@/app/lib/proposalTemplateCatalogLink";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type {
  ProposalTemplateItem,
  ProposalTemplateOption,
  TemplateQuantityRule,
} from "@/app/lib/proposalTemplateTypes";

export {
  PACKAGE_COMPOSITION_MATCHING_LIMITATION,
  buildPackageStepUpChain,
  comparePackageCompositions,
  formatStepUpChangeSummary,
  groupCompositionDiffForDisplay,
  resolveCompositionDualIdentity,
} from "@/app/lib/packageComposition";

export type {
  CompositionDiffDisplayGroup,
  CompositionDiffEntry,
  CompositionDiffKind,
  PackageComposition,
  PackageCompositionDiff,
  PackageStepUpItem,
} from "@/app/lib/packageComposition";

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function activeOptions(graph: ProposalTemplateGraph): ProposalTemplateOption[] {
  return [...graph.options]
    .filter((option) => !option.removed_at)
    .sort((a, b) => {
      const ao = a.sort_order ?? 0;
      const bo = b.sort_order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.id.localeCompare(b.id);
    });
}

export function resolvePackageOptionCustomerLabel(
  option: Pick<ProposalTemplateOption, "customer_label" | "name"> | null | undefined
): string {
  return norm(option?.customer_label) || norm(option?.name) || "Package";
}

function sectionKindById(graph: ProposalTemplateGraph): Map<string, string> {
  return new Map(graph.sections.map((section) => [section.id, section.kind]));
}

function listOptionItems(
  graph: ProposalTemplateGraph,
  optionId: string,
  kind: "line_items" | "upgrade_group"
): ProposalTemplateItem[] {
  const kinds = sectionKindById(graph);
  return graph.items
    .filter((item) => item.option_id === optionId && kinds.get(item.section_id) === kind)
    .slice()
    .sort((a, b) => {
      const ao = a.sort_order ?? 0;
      const bo = b.sort_order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.id.localeCompare(b.id);
    });
}

export function adaptTemplateQuantityRule(
  rule: TemplateQuantityRule | null | undefined
): CompositionQuantityConfig {
  if (!rule || !rule.mode || rule.mode === "inherit_catalog") {
    return inheritCatalogQuantity();
  }
  if (rule.mode === "fixed") {
    const qty = rule.fixed_quantity;
    return {
      mode: "fixed",
      summary:
        qty != null && Number.isFinite(qty) ? `Fixed quantity ${qty}` : "Fixed quantity",
      fingerprint: JSON.stringify({
        mode: "fixed",
        fixed_quantity: qty ?? null,
        allow_manual_override: rule.allow_manual_override ?? null,
      }),
    };
  }
  if (rule.mode === "measurement") {
    const key = norm(rule.measurement_quantity_key) || norm(rule.quantity_source);
    return {
      mode: "measurement",
      summary: key ? `Measurement · ${key}` : "Measurement quantity",
      fingerprint: JSON.stringify({
        mode: "measurement",
        quantity_source: rule.quantity_source ?? null,
        measurement_quantity_key: rule.measurement_quantity_key ?? null,
        waste_factor_override: rule.waste_factor_override ?? null,
        allow_manual_override: rule.allow_manual_override ?? null,
      }),
    };
  }
  if (rule.mode === "multiplier") {
    const mult = rule.quantity_multiplier;
    return {
      mode: "multiplier",
      summary:
        mult != null && Number.isFinite(mult)
          ? `Multiplier ×${mult}`
          : "Quantity multiplier",
      fingerprint: JSON.stringify({
        mode: "multiplier",
        quantity_multiplier: mult ?? null,
        waste_factor_override: rule.waste_factor_override ?? null,
        allow_manual_override: rule.allow_manual_override ?? null,
      }),
    };
  }
  return {
    mode: rule.mode,
    summary: `Quantity mode: ${rule.mode}`,
    fingerprint: JSON.stringify(rule),
  };
}

function toEntry(
  item: ProposalTemplateItem,
  catalogById: Map<string, CatalogItem>,
  role: CompositionEntry["role"]
): CompositionEntry {
  const productId = norm(item.catalog_item_id) || null;
  const catalog = productId ? catalogById.get(productId) : undefined;
  const productName = norm(catalog?.name) || null;
  const override = norm(item.customer_name_override);
  const customerLabel =
    override || productName || norm(catalog?.customer_name) || norm(item.catalog_seed_key) || "Line item";
  return {
    entryId: item.id,
    packageId: item.option_id,
    role,
    compositionRole: norm(item.composition_role) || null,
    compositionSlotKey: norm(item.composition_slot_key) || null,
    productId,
    provenanceKey: norm(item.catalog_seed_key) || null,
    customerLabel,
    productName,
    quantity: adaptTemplateQuantityRule(item.quantity_rule),
    unitPriceCents:
      catalog?.unit_price_cents != null && Number.isFinite(catalog.unit_price_cents)
        ? catalog.unit_price_cents
        : null,
  };
}

export function adaptTemplateGraphToPackageCompositions(input: {
  graph: ProposalTemplateGraph;
  catalogItems: readonly CatalogItem[];
}): PackageComposition[] {
  const catalogById = buildCatalogByIdMap(input.catalogItems);
  return activeOptions(input.graph).map((option) => ({
    packageId: option.id,
    customerLabel: resolvePackageOptionCustomerLabel(option),
    order: option.sort_order ?? 0,
    isStartingDefault: option.is_default === true,
    included: listOptionItems(input.graph, option.id, "line_items").map((item) =>
      toEntry(item, catalogById, "included")
    ),
    optionalUpgrades: listOptionItems(input.graph, option.id, "upgrade_group").map((item) =>
      toEntry(item, catalogById, "optional_upgrade")
    ),
  }));
}

/** First ordered package — step-up base. Does not mutate is_default. */
export function resolvePackageCompositionComparisonBaseOptionId(
  graph: ProposalTemplateGraph
): string | null {
  return activeOptions(graph)[0]?.id ?? null;
}

export function buildTemplatePackageStepUpChain(input: {
  graph: ProposalTemplateGraph;
  catalogItems: readonly CatalogItem[];
}): PackageStepUpItem[] {
  return buildPackageStepUpChain(
    adaptTemplateGraphToPackageCompositions(input)
  );
}

/**
 * Arbitrary A ↔ B comparison through the Template adapter.
 */
export function buildPackageCompositionDiff(input: {
  graph: ProposalTemplateGraph;
  catalogItems: readonly CatalogItem[];
  baseOptionId: string;
  targetOptionId: string;
}): PackageCompositionDiff {
  const packages = adaptTemplateGraphToPackageCompositions(input);
  const base =
    packages.find((pkg) => pkg.packageId === input.baseOptionId) ??
    ({
      packageId: input.baseOptionId,
      customerLabel: "Package",
      order: 0,
      included: [],
      optionalUpgrades: [],
    } satisfies PackageComposition);
  const target =
    packages.find((pkg) => pkg.packageId === input.targetOptionId) ??
    ({
      packageId: input.targetOptionId,
      customerLabel: "Package",
      order: 0,
      included: [],
      optionalUpgrades: [],
    } satisfies PackageComposition);
  return comparePackageCompositions(base, target);
}

export type TemplateItemDualIdentity = {
  customerLabel: string;
  catalogProductName: string | null;
  showCatalogProduct: boolean;
};

export function resolveTemplateItemDualIdentity(
  item: Pick<ProposalTemplateItem, "customer_name_override" | "catalog_seed_key">,
  catalog: Pick<CatalogItem, "name" | "customer_name"> | null | undefined
): TemplateItemDualIdentity {
  const override = norm(item.customer_name_override);
  const catalogName = norm(catalog?.name) || null;
  const customerLabel =
    override || catalogName || norm(item.catalog_seed_key) || "Line item";
  const dual = resolveCompositionDualIdentity({
    customerLabel,
    productName: catalogName,
  });
  return {
    customerLabel: dual.customerLabel,
    catalogProductName: dual.productName,
    showCatalogProduct: dual.showProductIdentity,
  };
}
