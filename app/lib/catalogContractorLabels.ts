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

/** Planned-only badge copy — never claim live CSV/supplier/bulk behavior. */
export const CATALOG_COMING_SOON_LABEL = "Coming soon" as const;
export const CATALOG_PLANNED_LABEL = "Planned" as const;

/** @deprecated Selection is live — kept for transitional callers. */
export const CATALOG_BULK_SELECTION_PLANNED_TITLE =
  "Bulk selection planned — Coming soon" as const;

export const CATALOG_SELECT_ROW_ARIA = "Select catalog item" as const;
export const CATALOG_SELECT_ALL_ARIA = "Select all visible catalog items" as const;

/** Still planned-only in the command bar (no drag-reorder behavior yet). */
export const CATALOG_COMMAND_BAR_PLANNED_CONTROLS = [
  { id: "reorder", label: "Re-order items" },
] as const;

export type CatalogCommandBarPlannedControlId =
  (typeof CATALOG_COMMAND_BAR_PLANNED_CONTROLS)[number]["id"];

/** Active command-bar menus (Columns + Manage catalog). */
export const CATALOG_COMMAND_BAR_ACTIVE_CONTROLS = [
  { id: "columns", label: "Columns" },
  { id: "manage_catalog", label: "Manage catalog" },
] as const;

/**
 * Manage Catalog menu entries.
 * CSV download/export + upload preview/import are live (v1).
 * Supplier, Jumpstart, reorder, and bulk purchase tax remain planned.
 */
export const CATALOG_MANAGE_MENU_ITEMS = [
  {
    id: "download_template",
    label: "Download template",
    detail: "Empty Catalog CSV v1 headers",
    status: "live" as const,
  },
  {
    id: "download_csv",
    label: "Download CSV",
    detail: "Export current catalog rows",
    status: "live" as const,
  },
  {
    id: "upload_csv",
    label: "Upload CSV",
    detail: "Preview, validate, then import",
    status: "live" as const,
  },
  {
    id: "reorder",
    label: "Reorder items",
    detail: "Drag or sort catalog order — Planned",
    status: "planned" as const,
  },
  {
    id: "connect_supplier",
    label: "Connect supplier",
    detail: "ABC / QXO / SRS pricing — Planned",
    status: "planned" as const,
  },
  {
    id: "jumpstart",
    label: "Jumpstart / import starter",
    detail: "Curated import with supplier prices — Planned",
    status: "planned" as const,
  },
  {
    id: "bulk_purchase_tax",
    label: "Bulk edit purchase tax",
    detail: "Set purchase tax on many items — Planned",
    status: "planned" as const,
  },
] as const;

export type CatalogManageMenuItemId = (typeof CATALOG_MANAGE_MENU_ITEMS)[number]["id"];

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
    detail:
      "Table Columns control is live on All items. Company-wide column defaults remain planned here.",
  },
  {
    id: "csv",
    title: "Manage catalog CSV import/export",
    detail:
      "CSV v1 is live on All items (template, export, preview import). Supplier SKU fields persist on catalog items; supplier sync remains planned.",
  },
  {
    id: "reorder",
    title: "Re-order items",
    detail: "Drag or sort catalog rows for proposal defaults — Planned.",
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
    detail:
      "ABC / QXO / SRS SKU storage is live on catalog items. Supplier pricing sync and connections remain Planned (not connected).",
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
  supplier: "Supplier",
  abcSku: "ABC SKU",
  qxoSku: "QXO SKU",
  srsSku: "SRS SKU",
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
  supplierSection:
    "Supplier SKU links are saved for future supplier pricing and ordering. No supplier sync is active yet.",
  abcSku: "ABC product identifier for this catalog item. Internal only.",
  qxoSku: "QXO (Beacon) product identifier for this catalog item. Internal only.",
  srsSku: "SRS product identifier for this catalog item. Internal only.",
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
