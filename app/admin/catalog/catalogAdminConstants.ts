import type { CatalogItemType } from "@/app/lib/catalogTypes";

export const CARD =
  "rounded-md border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
export const SETUP_STEP_CARD =
  "flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm";
export const SETUP_STEP_ACTIVE_RING = "ring-2 ring-cyan-200/90 border-cyan-200";
export const FIELD_INPUT =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60";
export const TABLE_TH =
  "px-3 py-3 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
export const TABLE_TH_WIDE = `${TABLE_TH} min-w-[9rem] pr-4`;
export const TABLE_TH_COMPACT = `${TABLE_TH} whitespace-nowrap pr-2`;
export const TABLE_TD = "px-3 py-3 pr-3 align-middle text-sm text-slate-700";
export const TABLE_TD_WIDE = `${TABLE_TD} min-w-[9rem] pr-4`;
export const TABLE_TD_NAME =
  "px-3 py-3 pr-4 align-middle text-sm font-medium text-slate-900 min-w-[11rem] lg:whitespace-nowrap";
export const TABLE_TD_COMPACT = `${TABLE_TD} whitespace-nowrap pr-2`;
export const TABLE_TD_UNIT = `${TABLE_TD} min-w-[6.5rem] whitespace-nowrap`;
export const TABLE_COLUMN_COUNT = 11;

export type CatalogItemTypeFilter = "all" | CatalogItemType;

export const CATALOG_TYPE_FILTER_OPTIONS: readonly { value: CatalogItemTypeFilter; label: string }[] =
  [
    { value: "all", label: "All" },
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
  { key: "fee", label: "Fees", types: ["fee"] },
  {
    key: "other",
    label: "Other",
    types: ["service", "discount", "package"],
  },
] as const;

export const TOOLBAR_INPUT =
  "w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100";
export const FILTER_CHIP_BASE =
  "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200";
export const FILTER_CHIP_ON = "border-slate-900 bg-slate-900 text-white shadow-sm";
export const FILTER_CHIP_OFF =
  "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";
export const ROADMAP_CARD =
  "flex flex-col rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 opacity-80";
export const PRIMARY_BUTTON =
  "rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
export const SECONDARY_BUTTON =
  "rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

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
