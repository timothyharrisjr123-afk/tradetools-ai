import type { CatalogItemType } from "@/app/lib/catalogTypes";

export const CARD =
  "rounded-md border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
export const SETUP_STEP_CARD =
  "flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm";
export const SETUP_STEP_ACTIVE_RING = "ring-2 ring-cyan-200/90 border-cyan-200";
export const FIELD_INPUT =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60";
export const TABLE_TH =
  "px-2.5 py-2.5 pr-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600";
export const TABLE_TH_WIDE = `${TABLE_TH} min-w-[7.5rem] pr-3`;
export const TABLE_TH_COMPACT = `${TABLE_TH} whitespace-nowrap pr-1.5`;
export const TABLE_TD = "px-2.5 py-2 pr-2 align-middle text-sm text-slate-700";
export const TABLE_TD_WIDE = `${TABLE_TD} min-w-[7.5rem] pr-3`;
export const TABLE_TD_NAME =
  "px-2.5 py-2 pr-3 align-middle text-sm font-medium text-slate-900 min-w-[8.5rem] lg:whitespace-nowrap";
export const TABLE_TD_COMPACT = `${TABLE_TD} whitespace-nowrap pr-1.5`;
export const TABLE_TD_UNIT = `${TABLE_TD} min-w-[5.75rem] whitespace-nowrap`;
/** Sticky action column — stays visible during horizontal table scroll. */
export const TABLE_TH_ACTION = `${TABLE_TH_COMPACT} sticky right-0 z-[1] bg-slate-100/95 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]`;
export const TABLE_TD_ACTION = `${TABLE_TD_COMPACT} sticky right-0 z-[1] bg-white shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.08)]`;
/** Contractor Catalog table column count (incl. reserved selection; Coverage/Waste in edit + name detail). */
export const TABLE_COLUMN_COUNT = 10;

/** Reserved bulk-selection checkbox (P0D — disabled layout parity only). */
export const TABLE_TH_SELECT =
  "w-10 px-2.5 py-2.5 text-center align-middle";
export const TABLE_TD_SELECT = "w-10 px-2.5 py-2 text-center align-middle";
export const CATALOG_SELECT_CHECKBOX =
  "h-3.5 w-3.5 cursor-not-allowed rounded border-slate-300 text-slate-400 opacity-60";

export type CatalogItemTypeFilter = import("@/app/lib/catalogContractorLabels").CatalogContractorTypeFilter;

export { CATALOG_CONTRACTOR_FILTER_OPTIONS as CATALOG_TYPE_FILTER_OPTIONS } from "@/app/lib/catalogContractorLabels";

/** Item types for add-item modal (full list — not contractor filter chips). */
export const CATALOG_ADD_ITEM_TYPE_OPTIONS: readonly { value: CatalogItemType; label: string }[] =
  [
    { value: "material", label: "Material" },
    { value: "labor", label: "Labor" },
    { value: "fee", label: "Fee" },
    { value: "service", label: "Service" },
    { value: "discount", label: "Discount" },
    { value: "package", label: "Package" },
  ] as const;

export const CATALOG_TYPE_GROUP_SECTIONS: readonly {
  key: string;
  label: string;
  types: readonly CatalogItemType[];
}[] = [
  { key: "material", label: "Materials", types: ["material"] },
  { key: "labor", label: "Labor", types: ["labor"] },
  {
    key: "fees_other",
    label: "Fees & Other",
    types: ["fee", "service", "discount", "package"],
  },
] as const;

/** Unified Catalog command surface (toolbar + table). */
export const CATALOG_SURFACE_CARD =
  "overflow-hidden rounded-xl border border-slate-300/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]";

export const TOOLBAR_INPUT =
  "w-full min-w-0 rounded-lg border border-slate-300/90 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 shadow-sm placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200/80";
export const FILTER_CHIP_BASE =
  "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";
export const FILTER_CHIP_ON = "border-slate-900 bg-slate-900 text-white shadow-sm";
export const FILTER_CHIP_OFF =
  "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";
/** Disabled command-bar controls (layout parity only — no menus). */
export const COMMAND_CONTROL_DISABLED =
  "inline-flex cursor-not-allowed select-none items-center gap-1.5 rounded-md border border-slate-300/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm";
export const COMMAND_CONTROL_SOON_BADGE =
  "rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-500";
/** Active command-bar menu triggers (Columns / Manage catalog). */
export const COMMAND_CONTROL_ACTIVE =
  "inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-slate-300/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50 [&::-webkit-details-marker]:hidden";
export const COMMAND_MENU_PANEL =
  "absolute right-0 z-30 mt-1.5 w-[min(100vw-2rem,17.5rem)] rounded-lg border border-slate-200 bg-white p-2 shadow-lg";
export const FILTERS_SORT_TRIGGER =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-300/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50";
export const ROADMAP_CARD =
  "flex flex-col rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 opacity-80";
export const PRIMARY_BUTTON =
  "rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
export const SECONDARY_BUTTON =
  "rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

/** Restrained Proposal / Status pills (P0C). */
export const CATALOG_PILL_BASE =
  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-tight ring-1 ring-inset";
export const CATALOG_PILL_PROPOSAL_VISIBLE = `${CATALOG_PILL_BASE} bg-slate-50 text-slate-700 ring-slate-200`;
export const CATALOG_PILL_PROPOSAL_GROUPED = `${CATALOG_PILL_BASE} bg-slate-50 text-slate-600 ring-slate-200/90`;
export const CATALOG_PILL_PROPOSAL_HIDDEN = `${CATALOG_PILL_BASE} bg-slate-100 text-slate-500 ring-slate-200/80`;
export const CATALOG_PILL_STATUS_ACTIVE = `${CATALOG_PILL_BASE} bg-emerald-50/70 text-emerald-800/90 ring-emerald-200/60`;
export const CATALOG_PILL_STATUS_INACTIVE = `${CATALOG_PILL_BASE} bg-slate-100 text-slate-500 ring-slate-200/80`;
export const CATALOG_PILL_STATUS_NEEDS_PRICE = `${CATALOG_PILL_BASE} bg-amber-50 text-amber-900 ring-amber-300/70`;

export const CATALOG_ROADMAP_OPTIONS = [
  {
    title: "Import CSV",
    badge: "Planned",
    description: "Bulk add or update catalog rows from a spreadsheet when CSV import is scoped.",
  },
  {
    title: "Manufacturer catalogs",
    badge: "Planned",
    description: "Import starter packs from roofing systems and manufacturers in a later stage.",
  },
  {
    title: "Supplier pricing",
    badge: "Planned",
    description: "Connect live supplier pricing for material orders after proposals are in place.",
  },
] as const;
