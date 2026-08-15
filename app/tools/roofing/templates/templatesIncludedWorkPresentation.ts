/**
 * Pure prepared-scope presenter for the Templates reusable-setup landing.
 *
 * Separates:
 * - Included work — Materials / Labor / Fees / Other from line_items only
 * - Available upgrades — elective upgrade_group rows (not included scope)
 *
 * Catalog units, quantity sources, visibility flags, and raw section keys stay
 * out of the default presentation; existing item-management operations remain
 * wired by template item id.
 */

import type { CatalogItem, CatalogItemType } from "@/app/lib/catalogTypes";
import {
  buildCatalogByIdMap,
  buildTemplateCatalogLinkView,
  type TemplateCatalogLinkStatus,
} from "@/app/lib/proposalTemplateCatalogLink";
import { summarizeQuantityRule } from "@/app/lib/proposalTemplateCompositionAuthoring";
import { resolveTemplateItemDualIdentity } from "@/app/lib/proposalTemplatePackageCompositionDiff";
import type { TemplateQuantityRule } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";

export type PreparedIncludedWorkGroupId =
  | "materials"
  | "labor_services"
  | "fees"
  | "other";

export type PreparedIncludedWorkItem = {
  templateItemId: string;
  name: string;
  /** Catalog product name when customer label differs (V2E2A dual identity). */
  catalogProductName: string | null;
  showCatalogProduct: boolean;
  status: TemplateCatalogLinkStatus;
  issueLabel: string | null;
  issueDetail: string | null;
  canReplace: boolean;
  quantityMode: "inherit_catalog" | "fixed" | "other";
  quantitySummary: string;
  quantityFixed: number | null;
};

export type PreparedIncludedWorkGroup = {
  id: PreparedIncludedWorkGroupId;
  label: string;
  itemCount: number;
  issueCount: number;
  items: PreparedIncludedWorkItem[];
};

export type PreparedIncludedWorkPresentation = {
  optionId: string;
  /** Count of included line_items only — never upgrade_group rows. */
  totalItemCount: number;
  issueCount: number;
  groups: PreparedIncludedWorkGroup[];
};

export type PreparedAvailableUpgradeItem = PreparedIncludedWorkItem;

export type PreparedAvailableUpgradesPresentation = {
  optionId: string;
  totalItemCount: number;
  issueCount: number;
  items: PreparedAvailableUpgradeItem[];
};

export type PreparedPackageScopePresentation = {
  optionId: string;
  includedWork: PreparedIncludedWorkPresentation;
  availableUpgrades: PreparedAvailableUpgradesPresentation;
};

const INCLUDED_GROUP_ORDER: PreparedIncludedWorkGroupId[] = [
  "materials",
  "labor_services",
  "fees",
  "other",
];

const INCLUDED_GROUP_LABELS: Record<PreparedIncludedWorkGroupId, string> = {
  materials: "Materials",
  labor_services: "Labor / services",
  fees: "Fees",
  other: "Other",
};

function groupForCatalogType(itemType: CatalogItemType | null): PreparedIncludedWorkGroupId {
  switch (itemType) {
    case "material":
      return "materials";
    case "labor":
    case "service":
      return "labor_services";
    case "fee":
      return "fees";
    default:
      return "other";
  }
}

function localIssueCopy(status: TemplateCatalogLinkStatus): {
  label: string | null;
  detail: string | null;
} {
  switch (status) {
    case "inactive":
      return {
        label: "Catalog item unavailable",
        detail: "Choose an active Catalog item for future proposals.",
      };
    case "missing_catalog":
    case "missing_id":
      return {
        label: "Needs Catalog attention",
        detail: "Choose a Catalog item for this included work.",
      };
    case "linked":
    default:
      return { label: null, detail: null };
  }
}

function availableUpgradeIssueCopy(status: TemplateCatalogLinkStatus): {
  label: string | null;
  detail: string | null;
} {
  switch (status) {
    case "inactive":
      return {
        label: "Catalog item unavailable",
        detail: "Choose an active Catalog item for this optional upgrade.",
      };
    case "missing_catalog":
    case "missing_id":
      return {
        label: "Needs Catalog attention",
        detail: "Choose a Catalog item for this optional upgrade.",
      };
    case "linked":
    default:
      return { label: null, detail: null };
  }
}

function toPreparedItem(
  item: Parameters<typeof buildTemplateCatalogLinkView>[0],
  catalogById: ReturnType<typeof buildCatalogByIdMap>,
  issueCopy: (status: TemplateCatalogLinkStatus) => {
    label: string | null;
    detail: string | null;
  }
): PreparedIncludedWorkItem {
  const view = buildTemplateCatalogLinkView(item, catalogById);
  const issue = issueCopy(view.status);
  const catalogId = (item.catalog_item_id ?? "").trim();
  const catalog = catalogId ? catalogById.get(catalogId) : undefined;
  const dual = resolveTemplateItemDualIdentity(item, catalog ?? null);
  const quantityRule = item.quantity_rule as TemplateQuantityRule | null | undefined;
  const quantityMode =
    !quantityRule || quantityRule.mode === "inherit_catalog"
      ? "inherit_catalog"
      : quantityRule.mode === "fixed"
        ? "fixed"
        : "other";
  return {
    templateItemId: view.templateItemId,
    name: dual.customerLabel || view.displayName,
    catalogProductName: dual.catalogProductName,
    showCatalogProduct: dual.showCatalogProduct,
    status: view.status,
    issueLabel: issue.label,
    issueDetail: issue.detail,
    canReplace: view.canRelink,
    quantityMode,
    quantitySummary: summarizeQuantityRule(quantityRule),
    quantityFixed:
      quantityMode === "fixed" && quantityRule?.fixed_quantity != null
        ? quantityRule.fixed_quantity
        : null,
  };
}

export function buildPreparedIncludedWorkPresentation(input: {
  graph: ProposalTemplateGraph;
  optionId: string;
  catalogItems: readonly CatalogItem[];
}): PreparedIncludedWorkPresentation {
  const { graph, optionId, catalogItems } = input;
  const catalogById = buildCatalogByIdMap(catalogItems);
  const sectionById = new Map(graph.sections.map((section) => [section.id, section]));
  const grouped = new Map<PreparedIncludedWorkGroupId, PreparedIncludedWorkItem[]>();

  const includedItems = graph.items
    .filter((item) => {
      if (item.option_id !== optionId) return false;
      const section = sectionById.get(item.section_id);
      return section?.kind === "line_items";
    })
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  for (const item of includedItems) {
    const catalogId = (item.catalog_item_id ?? "").trim();
    const catalogItem = catalogId ? catalogById.get(catalogId) ?? null : null;
    const groupId = groupForCatalogType(catalogItem?.item_type ?? null);
    const preparedItem = toPreparedItem(item, catalogById, localIssueCopy);
    const rows = grouped.get(groupId) ?? [];
    rows.push(preparedItem);
    grouped.set(groupId, rows);
  }

  const groups = INCLUDED_GROUP_ORDER.flatMap((id) => {
    const items = grouped.get(id) ?? [];
    if (items.length === 0) return [];
    const issueCount = items.filter((row) => row.status !== "linked").length;
    return [
      {
        id,
        label: INCLUDED_GROUP_LABELS[id],
        itemCount: items.length,
        issueCount,
        items,
      } satisfies PreparedIncludedWorkGroup,
    ];
  });

  return {
    optionId,
    totalItemCount: includedItems.length,
    issueCount: groups.reduce((sum, group) => sum + group.issueCount, 0),
    groups,
  };
}

export function buildPreparedAvailableUpgradesPresentation(input: {
  graph: ProposalTemplateGraph;
  optionId: string;
  catalogItems: readonly CatalogItem[];
}): PreparedAvailableUpgradesPresentation {
  const { graph, optionId, catalogItems } = input;
  const catalogById = buildCatalogByIdMap(catalogItems);
  const sectionById = new Map(graph.sections.map((section) => [section.id, section]));

  const upgradeItems = graph.items
    .filter((item) => {
      if (item.option_id !== optionId) return false;
      const section = sectionById.get(item.section_id);
      return section?.kind === "upgrade_group";
    })
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const items = upgradeItems.map((item) =>
    toPreparedItem(item, catalogById, availableUpgradeIssueCopy)
  );

  return {
    optionId,
    totalItemCount: items.length,
    issueCount: items.filter((row) => row.status !== "linked").length,
    items,
  };
}

export function buildPreparedPackageScopePresentation(input: {
  graph: ProposalTemplateGraph;
  optionId: string;
  catalogItems: readonly CatalogItem[];
}): PreparedPackageScopePresentation {
  return {
    optionId: input.optionId,
    includedWork: buildPreparedIncludedWorkPresentation(input),
    availableUpgrades: buildPreparedAvailableUpgradesPresentation(input),
  };
}
