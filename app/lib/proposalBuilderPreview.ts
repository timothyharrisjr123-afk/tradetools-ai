/**
 * Pure read-only Proposal Builder line/section preview helpers (3H-2).
 *
 * Joins template graph + catalog items for display only — no Supabase, stores,
 * quantity resolution, pricing totals, or proposal persistence.
 */

import {
  catalogItemTypeLabel,
  catalogUnitLabel,
  quantitySourceLabel,
  type CatalogItem,
} from "@/app/lib/catalogTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type {
  ProposalTemplateItem,
  ProposalTemplateSection,
  TemplateQuantityRule,
} from "@/app/lib/proposalTemplateTypes";
import {
  proposalTemplateItemRoleLabel,
  templateQuantityModeLabel,
} from "@/app/lib/proposalTemplateTypes";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";

export type ProposalPreviewLineRow = {
  id: string;
  displayName: string;
  itemTypeLabel: string;
  unitLabel: string;
  quantitySourceLabel: string;
  quantityRuleLabel: string;
  catalogSetupPriceLabel: string;
  roleLabel: string;
  missingCatalog: boolean;
};

function sortByOrder<T extends { sort_order?: number | null; id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

export function buildCatalogItemById(items: CatalogItem[]): Map<string, CatalogItem> {
  const map = new Map<string, CatalogItem>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return map;
}

export function getDefaultSelectedOptionId(graph: ProposalTemplateGraph): string | null {
  const sorted = sortTemplateOptionsByOrder(graph.options);
  if (sorted.length === 0) return null;
  const defaultOpt = sorted.find((opt) => opt.is_default);
  return defaultOpt?.id ?? sorted[0]?.id ?? null;
}

export function getSectionsForOption(
  graph: ProposalTemplateGraph,
  optionId: string
): ProposalTemplateSection[] {
  return sortByOrder(graph.sections.filter((section) => section.option_id === optionId));
}

export function getItemsForSection(
  graph: ProposalTemplateGraph,
  sectionId: string
): ProposalTemplateItem[] {
  return sortByOrder(graph.items.filter((item) => item.section_id === sectionId));
}

export function formatCatalogSetupUnitPrice(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "Unpriced";
  const dollars = (Math.round(cents) / 100).toFixed(2);
  const [whole, dec] = dollars.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${dec}`;
}

export function formatQuantityRuleLabel(rule: TemplateQuantityRule | null | undefined): string {
  if (!rule?.mode) return "—";
  let label = templateQuantityModeLabel(rule.mode);
  if (rule.measurement_quantity_key) {
    label += ` · ${rule.measurement_quantity_key}`;
  }
  if (rule.fixed_quantity != null && Number.isFinite(rule.fixed_quantity)) {
    label += ` · fixed ${rule.fixed_quantity}`;
  }
  if (rule.quantity_multiplier != null && Number.isFinite(rule.quantity_multiplier)) {
    label += ` · ×${rule.quantity_multiplier}`;
  }
  return label;
}

function resolveLineDisplayName(
  templateItem: ProposalTemplateItem,
  catalog: CatalogItem | null | undefined
): string {
  const override = (templateItem.customer_name_override ?? "").trim();
  if (override) return override;
  const customer = (catalog?.customer_name ?? "").trim();
  if (customer) return customer;
  const name = (catalog?.name ?? "").trim();
  if (name) return name;
  const seed = (templateItem.catalog_seed_key ?? "").trim();
  if (seed) return seed;
  return "Line item";
}

export function buildLinePreviewRow(
  templateItem: ProposalTemplateItem,
  catalogById: Map<string, CatalogItem>
): ProposalPreviewLineRow {
  const catalogId = (templateItem.catalog_item_id ?? "").trim();
  const catalog = catalogId ? catalogById.get(catalogId) : undefined;
  const missingCatalog = Boolean(catalogId) && !catalog;

  return {
    id: templateItem.id,
    displayName: missingCatalog ? resolveLineDisplayName(templateItem, null) : resolveLineDisplayName(templateItem, catalog),
    itemTypeLabel: catalog ? catalogItemTypeLabel(catalog.item_type) : "—",
    unitLabel: catalog ? catalogUnitLabel(catalog.unit) : "—",
    quantitySourceLabel: catalog ? quantitySourceLabel(catalog.quantity_source) : "—",
    quantityRuleLabel: formatQuantityRuleLabel(templateItem.quantity_rule),
    catalogSetupPriceLabel: missingCatalog
      ? "Missing catalog item"
      : formatCatalogSetupUnitPrice(catalog?.unit_price_cents),
    roleLabel: proposalTemplateItemRoleLabel(templateItem.item_role),
    missingCatalog,
  };
}

export function buildLinePreviewRowsForSection(
  graph: ProposalTemplateGraph,
  sectionId: string,
  catalogById: Map<string, CatalogItem>
): ProposalPreviewLineRow[] {
  return getItemsForSection(graph, sectionId).map((item) =>
    buildLinePreviewRow(item, catalogById)
  );
}

export function isLineItemsSectionKind(kind: string): boolean {
  return kind === "line_items" || kind === "upgrade_group";
}

export function truncatePreviewText(text: string, maxLength = 480): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}
