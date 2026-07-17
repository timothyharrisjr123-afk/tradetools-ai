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

export const TEMPLATE_ADD_FROM_CATALOG_LABEL = "Add item" as const;
export const TEMPLATE_RELINK_CATALOG_LABEL = "Replace item" as const;
export const TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL = "Remove from template" as const;
export const TEMPLATE_REMOVE_CONFIRM_COPY =
  "Remove this item from the template? The Catalog item will not be deleted." as const;

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
      statusDetail = "Uses Catalog pricing when proposals are created or refreshed.";
      break;
    case "inactive":
      displayName = overrideName || catalogName || "Inactive Catalog item";
      statusLabel = "Inactive in Catalog";
      statusDetail =
        "This Catalog item is inactive. Reactivate it in Catalog or replace it with an active item.";
      break;
    case "missing_catalog":
      displayName = overrideName || "Missing Catalog item";
      statusLabel = "Catalog item missing";
      statusDetail =
        "No matching Catalog item for this link. Replace it with an active Catalog item.";
      break;
    case "missing_id":
    default:
      displayName = overrideName || "Unlinked template item";
      statusLabel = "Not linked";
      statusDetail = "This line is not linked to a Catalog item. Replace it with an active item.";
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

export type TemplateCatalogLinkReadinessSeverity = "ready" | "warning" | "blocked";

export type TemplateCatalogLinkNextAction =
  | "none"
  | "fix_links"
  | "add_items"
  | "open_jobs";

export type TemplateCatalogLinkReadiness = {
  totalItems: number;
  linkedActive: number;
  inactive: number;
  missingCatalog: number;
  missingId: number;
  problemCount: number;
  severity: TemplateCatalogLinkReadinessSeverity;
  nextAction: TemplateCatalogLinkNextAction;
  summaryLabel: string;
  detail: string;
  /** First template item id that needs a fix action, if any. */
  firstProblemItemId: string | null;
};

/**
 * Summarize Catalog link health for a selected template graph's items.
 * Uses full catalog map so inactive rows are distinguishable from missing.
 */
export function deriveTemplateCatalogLinkReadiness(
  templateItems: readonly ProposalTemplateItem[],
  catalogById: ReadonlyMap<string, CatalogItem>
): TemplateCatalogLinkReadiness {
  let linkedActive = 0;
  let inactive = 0;
  let missingCatalog = 0;
  let missingId = 0;
  let firstProblemItemId: string | null = null;

  for (const item of templateItems) {
    const status = resolveTemplateCatalogLinkStatus(item, catalogById);
    switch (status) {
      case "linked":
        linkedActive += 1;
        break;
      case "inactive":
        inactive += 1;
        if (!firstProblemItemId) firstProblemItemId = item.id;
        break;
      case "missing_catalog":
        missingCatalog += 1;
        if (!firstProblemItemId) firstProblemItemId = item.id;
        break;
      case "missing_id":
        missingId += 1;
        if (!firstProblemItemId) firstProblemItemId = item.id;
        break;
    }
  }

  const totalItems = templateItems.length;
  const problemCount = inactive + missingCatalog + missingId;

  if (totalItems === 0) {
    return {
      totalItems: 0,
      linkedActive: 0,
      inactive: 0,
      missingCatalog: 0,
      missingId: 0,
      problemCount: 0,
      severity: "blocked",
      nextAction: "add_items",
      summaryLabel: "No Catalog items linked",
      detail:
        "Add active Catalog items to line-item or upgrade sections before using this template on a job.",
      firstProblemItemId: null,
    };
  }

  if (problemCount > 0) {
    return {
      totalItems,
      linkedActive,
      inactive,
      missingCatalog,
      missingId,
      problemCount,
      severity: "blocked",
      nextAction: "fix_links",
      summaryLabel: `${problemCount} Catalog link${problemCount === 1 ? "" : "s"} need attention`,
      detail: [
        missingId > 0 ? `${missingId} not linked` : null,
        missingCatalog > 0 ? `${missingCatalog} missing` : null,
        inactive > 0 ? `${inactive} inactive` : null,
        `${linkedActive} linked active`,
      ]
        .filter(Boolean)
        .join(" · "),
      firstProblemItemId,
    };
  }

  return {
    totalItems,
    linkedActive,
    inactive: 0,
    missingCatalog: 0,
    missingId: 0,
    problemCount: 0,
    severity: "ready",
    nextAction: "open_jobs",
    summaryLabel: `${linkedActive} Catalog item${linkedActive === 1 ? "" : "s"} linked`,
    detail:
      "Template Catalog links look healthy. Create or open a proposal from a Job Card to use this template in Builder.",
    firstProblemItemId: null,
  };
}
