/**
 * Contractor-facing Catalog labels and display helpers (Slice 2 P0A–P0D).
 * Internal types/store field names unchanged — presentation only.
 */

import type {
  CatalogItem,
  CatalogItemType,
  CoverageBasis,
  CustomerVisibility,
} from "@/app/lib/catalogTypes";

function itemNeedsPrice(item: CatalogItem): boolean {
  return item.unit_price_cents == null || !Number.isFinite(item.unit_price_cents);
}

export const CATALOG_PAGE_SUBTITLE =
  "Manage the materials, labor, and fees used in proposals." as const;

/** P0C/P0D layout-parity command controls — disabled / Coming soon only. */
export const CATALOG_COMING_SOON_LABEL = "Coming soon" as const;

export const CATALOG_BULK_SELECTION_PLANNED_TITLE =
  "Bulk selection planned — Coming soon" as const;

/** Desktop command-bar order: Re-order → Columns → Manage (right cluster). */
export const CATALOG_COMMAND_BAR_PLANNED_CONTROLS = [
  { id: "reorder", label: "Re-order items" },
  { id: "columns", label: "Columns" },
  { id: "manage_catalog", label: "Manage catalog" },
] as const;

export type CatalogCommandBarPlannedControlId =
  (typeof CATALOG_COMMAND_BAR_PLANNED_CONTROLS)[number]["id"];

/** Settings tab future tools — planned only, no active forms. */
export const CATALOG_SETTINGS_PLANNED_TOOLS = [
  {
    id: "defaults",
    title: "Catalog defaults",
    detail: "Default item settings and company catalog preferences.",
  },
  {
    id: "columns",
    title: "Columns / display controls",
    detail: "Choose which catalog columns appear in the table.",
  },
  {
    id: "csv",
    title: "Manage catalog CSV import/export",
    detail: "Bulk add or update catalog rows from a spreadsheet.",
  },
  {
    id: "reorder",
    title: "Re-order items",
    detail: "Drag or sort catalog rows for proposal defaults.",
  },
  {
    id: "coverage_waste_tax",
    title: "Quantity mode switch and tax controls",
    detail:
      "Coverage, waste, and item tax rates are editable on each catalog item. Proposal line-tax math and company quantity-mode switching remain planned — not available here.",
  },
  {
    id: "supplier",
    title: "Supplier integrations",
    detail: "ABC, QXO, and supplier pricing after integration architecture.",
  },
] as const;

export const CATALOG_FILTERS_SORT_LABEL = "Filters & sort" as const;

export const CATALOG_CONTRACTOR_LABELS = {
  pageSubtitle: CATALOG_PAGE_SUBTITLE,
  name: "Name",
  /** @deprecated use name — kept for transitional callers */
  item: "Name",
  type: "Type",
  measurement: "Measurement",
  /** @deprecated use measurement */
  measuredBy: "Measurement",
  unit: "Unit",
  unitCost: "Unit cost",
  /** @deprecated use unitCost */
  yourCost: "Unit cost",
  unitPrice: "Unit price",
  /** @deprecated use unitPrice */
  customerPrice: "Unit price",
  proposal: "Proposal",
  /** @deprecated use proposal */
  shownToCustomer: "Proposal",
  status: "Status",
  actions: "Actions",
  customerName: "Customer name",
  customerDescription: "Customer description",
  needsPrice: "Needs price",
  catalogItems: "Catalog items",
  coverage: "Coverage",
  coverageBasis: "Coverage basis",
  waste: "Waste",
  wasteApplies: "Apply waste",
  quantityDrivers: "Coverage & waste",
  tax: "Tax",
  salesTax: "Sales tax",
  purchaseTax: "Material purchase tax",
} as const;

export const CATALOG_TABLE_HEADERS = [
  "Name",
  "Type",
  "Measurement",
  "Unit",
  "Unit cost",
  "Unit price",
  "Proposal",
  "Status",
  "Actions",
] as const;

export const CATALOG_FIELD_HELPERS = {
  unitCost: "What this costs your business per unit.",
  unitPrice: "What the customer is charged per unit before tax.",
  measurement: "The job measurement used to calculate quantity.",
  proposal: "Whether this item appears on the customer proposal.",
  /** @deprecated aliases for transitional callers */
  yourCost: "What this costs your business per unit.",
  customerPrice: "What the customer is charged per unit before tax.",
  measuredBy: "The job measurement used to calculate quantity.",
  shownToCustomer: "Whether this item appears on the customer proposal.",
  customerDescription: "Optional short text the customer may see on the proposal.",
  laborExplainer: "Labor is priced like a catalog item: rate per unit × job measurement.",
  leaveBlankNeedsPrice: "Leave blank until you set a price.",
  quantityDriversSection:
    "Used by raw quantity mode. Does not change adjusted-mode proposals. Not customer-facing.",
  coverage: "How much measurement one purchase unit covers.",
  coverageBasis: "What the coverage value measures.",
  waste: "Extra material percentage used by raw quantity mode.",
  wasteApplies: "When off, waste percent is ignored by raw quantity mode.",
  taxSection:
    "Item tax rates are captured on the catalog item. Proposal line-tax math is not active yet.",
  salesTax:
    "Customer tax rate for this catalog item. Proposal line-tax math is not active yet.",
  purchaseTax:
    "Internal supplier/material tax for true cost. Never shown to customers.",
} as const;

export function coverageBasisFieldHelper(
  basis: CoverageBasis | "" | null | undefined
): string {
  switch (basis) {
    case "roof_square":
      return "Coverage is measured in roof squares.";
    case "square_feet":
      return "Coverage is measured in square feet.";
    case "linear_feet":
      return "Coverage is measured in linear feet.";
    case "each":
      return "Coverage is measured by count.";
    case "tons":
      return "Coverage is measured in tons.";
    default:
      return CATALOG_FIELD_HELPERS.coverageBasis;
  }
}

export type CatalogContractorTypeFilter =
  | "all"
  | "material"
  | "labor"
  | "fees_other"
  | "needs_price";

export type CatalogPageTab = "all_items" | "settings";

export const FEES_OTHER_ITEM_TYPES: readonly CatalogItemType[] = [
  "fee",
  "service",
  "discount",
  "package",
];

export const CATALOG_CONTRACTOR_FILTER_OPTIONS: readonly {
  value: CatalogContractorTypeFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "material", label: "Materials" },
  { value: "labor", label: "Labor" },
  { value: "fees_other", label: "Fees & Other" },
  { value: "needs_price", label: "Needs price" },
] as const;

export type CatalogProposalPillTone = "visible" | "grouped" | "hidden" | "neutral";
export type CatalogStatusPillTone = "active" | "inactive" | "needs_price";

export function proposalVisibilityPillTone(
  visibility: CustomerVisibility
): CatalogProposalPillTone {
  switch (visibility) {
    case "customer_visible":
      return "visible";
    case "grouped":
      return "grouped";
    case "internal_only":
      return "hidden";
    default:
      return "neutral";
  }
}

export function catalogStatusPillTone(item: CatalogItem): CatalogStatusPillTone {
  const status = formatCatalogItemStatus(item);
  if (status === "Needs price") return "needs_price";
  if (status === "Inactive") return "inactive";
  return "active";
}

export function catalogItemMatchesContractorFilter(
  item: CatalogItem,
  filter: CatalogContractorTypeFilter
): boolean {
  if (filter === "needs_price") {
    return itemNeedsPrice(item);
  }
  if (filter === "all") {
    return true;
  }
  if (filter === "material") {
    return item.item_type === "material";
  }
  if (filter === "labor") {
    return item.item_type === "labor";
  }
  if (filter === "fees_other") {
    return (FEES_OTHER_ITEM_TYPES as readonly string[]).includes(item.item_type);
  }
  return true;
}

/** Proposal column: Visible / Grouped / Hidden */
export function formatProposalVisibilityShort(visibility: CustomerVisibility): string {
  switch (visibility) {
    case "customer_visible":
      return "Visible";
    case "internal_only":
      return "Hidden";
    case "grouped":
      return "Grouped";
    default:
      return "—";
  }
}

/** @deprecated use formatProposalVisibilityShort */
export function formatShownToCustomerShort(visibility: CustomerVisibility): string {
  return formatProposalVisibilityShort(visibility);
}

export function formatCatalogItemStatus(item: CatalogItem): string {
  if (!item.active) {
    return "Inactive";
  }
  if (itemNeedsPrice(item)) {
    return "Needs price";
  }
  return "Active";
}

export function catalogItemDisplayName(item: CatalogItem): {
  primary: string;
  secondary: string | null;
} {
  const primary = item.name;
  const customerName = item.customer_name?.trim();
  const secondary =
    customerName && customerName.toLowerCase() !== primary.trim().toLowerCase()
      ? customerName
      : null;
  return { primary, secondary };
}

export function formatCatalogCompactStatusLine(input: {
  pricedCount: number;
  activeCount: number;
  needsPriceCount: number;
}): string | null {
  if (input.activeCount <= 0) return null;
  const parts = [`${input.pricedCount}/${input.activeCount} priced`];
  if (input.needsPriceCount > 0) {
    parts.push(`${input.needsPriceCount} need price`);
  }
  return parts.join(" · ");
}
