/**
 * Pure helpers for Template ↔ Catalog item linking (Integrated Flow P0).
 *
 * Catalog remains source of truth for economics and quantity drivers.
 * Templates store structure + catalog_item_id links only — no price duplication.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  catalogItemTypeLabel,
  catalogUnitLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import type {
  ProposalTemplateItem,
  ProposalTemplateItemRole,
  ProposalTemplateSectionKind,
} from "@/app/lib/proposalTemplateTypes";

export type TemplateCatalogLinkStatus =
  | "linked"
  | "missing_id"
  | "missing_catalog"
  | "inactive";

export type TemplateCatalogLinkView = {
  templateItemId: string;
  sectionId: string;
  optionId: string;
  catalogItemId: string | null;
  status: TemplateCatalogLinkStatus;
  /** Display name for the template row — from live Catalog when available. */
  displayName: string;
  statusLabel: string;
  statusDetail: string;
  catalogTypeLabel: string | null;
  catalogUnitLabel: string | null;
  measurementLabel: string | null;
  unitPriceCents: number | null;
  unitCostCents: number | null;
  proposalVisibility: CatalogItem["customer_visibility"] | null;
  canRelink: boolean;
};

export const TEMPLATE_CATALOG_SOT_COPY =
  "Catalog is the source of truth for item pricing, measurement mapping, coverage, waste, and tax capture. This template only links items — it does not edit Catalog economics." as const;

export const TEMPLATE_CATALOG_DRAFT_REFRESH_COPY =
  "Existing proposal drafts keep snapshotted prices until you refresh draft pricing from Job Card / Builder. Linking or re-linking here does not change drafts automatically." as const;

export const TEMPLATE_ADD_FROM_CATALOG_LABEL = "Add item from catalog" as const;
export const TEMPLATE_RELINK_CATALOG_LABEL = "Change catalog link" as const;

export function defaultItemRoleForSectionKind(
  kind: ProposalTemplateSectionKind
): ProposalTemplateItemRole {
  return kind === "upgrade_group" ? "upgrade" : "standard";
}

export function sectionAcceptsCatalogItems(kind: ProposalTemplateSectionKind): boolean {
  return kind === "line_items" || kind === "upgrade_group";
}

export function resolveTemplateCatalogLinkStatus(
  templateItem: Pick<ProposalTemplateItem, "catalog_item_id">,
  catalogById: ReadonlyMap<string, CatalogItem>
): TemplateCatalogLinkStatus {
  const id = (templateItem.catalog_item_id ?? "").trim();
  if (!id) return "missing_id";
  const catalog = catalogById.get(id);
  if (!catalog) return "missing_catalog";
  if (!catalog.active) return "inactive";
  return "linked";
}

function formatMoneyCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "Unpriced";
  return `$${(cents / 100).toFixed(2)}`;
}

export function buildTemplateCatalogLinkView(
  templateItem: ProposalTemplateItem,
  catalogById: ReadonlyMap<string, CatalogItem>
): TemplateCatalogLinkView {
  const status = resolveTemplateCatalogLinkStatus(templateItem, catalogById);
  const catalogId = (templateItem.catalog_item_id ?? "").trim() || null;
  const catalog = catalogId ? catalogById.get(catalogId) ?? null : null;

  const overrideName = templateItem.customer_name_override?.trim() || null;
  const catalogName = catalog?.name?.trim() || null;

  let displayName: string;
  let statusLabel: string;
  let statusDetail: string;

  switch (status) {
    case "linked":
      displayName = overrideName || catalogName || "Catalog item";
      statusLabel = "Linked";
      statusDetail = "Uses live Catalog economics when proposals are created or refreshed.";
      break;
    case "inactive":
      displayName = overrideName || catalogName || "Inactive catalog item";
      statusLabel = "Inactive catalog item";
      statusDetail =
        "This Catalog item is inactive. Reactivate it in Catalog or change the link to an active item. Builder treats inactive items as unresolved.";
      break;
    case "missing_catalog":
      displayName = overrideName || "Missing catalog item";
      statusLabel = "Catalog item missing";
      statusDetail =
        "No matching Catalog row for this link. Change the link to an active Catalog item. Do not rely on name matching.";
      break;
    case "missing_id":
    default:
      displayName = overrideName || "Unlinked template item";
      statusLabel = "Not linked";
      statusDetail =
        "This template line has no catalog_item_id. Link an active Catalog item before using this template in proposals.";
      break;
  }

  return {
    templateItemId: templateItem.id,
    sectionId: templateItem.section_id,
    optionId: templateItem.option_id,
    catalogItemId: catalogId,
    status,
    displayName,
    statusLabel,
    statusDetail,
    catalogTypeLabel: catalog ? catalogItemTypeLabel(catalog.item_type) : null,
    catalogUnitLabel: catalog ? catalogUnitLabel(catalog.unit) : null,
    measurementLabel: catalog ? quantitySourceLabel(catalog.quantity_source) : null,
    unitPriceCents: catalog?.unit_price_cents ?? null,
    unitCostCents: catalog?.unit_cost_cents ?? null,
    proposalVisibility: catalog?.customer_visibility ?? null,
    canRelink: true,
  };
}

export function buildCatalogByIdMap(
  catalogItems: readonly CatalogItem[]
): Map<string, CatalogItem> {
  const map = new Map<string, CatalogItem>();
  for (const item of catalogItems) {
    if (item.id) map.set(item.id, item);
  }
  return map;
}

export function listActiveCatalogItemsForPicker(
  catalogItems: readonly CatalogItem[],
  options?: { searchQuery?: string; excludeCatalogItemIds?: ReadonlySet<string> }
): CatalogItem[] {
  const q = (options?.searchQuery ?? "").trim().toLowerCase();
  const exclude = options?.excludeCatalogItemIds;
  return catalogItems
    .filter((item) => item.active)
    .filter((item) => !exclude?.has(item.id))
    .filter((item) => {
      if (!q) return true;
      const hay = [
        item.name,
        item.customer_name,
        catalogItemTypeLabel(item.item_type),
        quantitySourceLabel(item.quantity_source),
        item.abc_sku,
        item.qxo_sku,
        item.srs_sku,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .slice()
    .sort((a, b) => {
      const byOrder = (a.sort_order ?? Number.POSITIVE_INFINITY) - (b.sort_order ?? Number.POSITIVE_INFINITY);
      if (byOrder !== 0) return byOrder;
      return a.name.localeCompare(b.name);
    });
}

export function nextTemplateItemSortOrder(
  itemsInSection: readonly Pick<ProposalTemplateItem, "sort_order">[]
): number {
  let max = 0;
  for (const item of itemsInSection) {
    if (item.sort_order != null && Number.isFinite(item.sort_order) && item.sort_order > max) {
      max = item.sort_order;
    }
  }
  return max + 10;
}

export function catalogItemIdsAlreadyInSection(
  itemsInSection: readonly Pick<ProposalTemplateItem, "catalog_item_id">[]
): Set<string> {
  const ids = new Set<string>();
  for (const item of itemsInSection) {
    const id = (item.catalog_item_id ?? "").trim();
    if (id) ids.add(id);
  }
  return ids;
}

export function formatCatalogPickerPriceLine(
  item: Pick<CatalogItem, "unit_price_cents" | "unit_cost_cents">
): string {
  return `Price ${formatMoneyCents(item.unit_price_cents)} · Cost ${formatMoneyCents(item.unit_cost_cents)}`;
}

export function extractCatalogSeedKey(item: CatalogItem): string | null {
  const meta = item.metadata;
  if (!meta || typeof meta !== "object") return null;
  const raw = (meta as Record<string, unknown>).seed_key;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
