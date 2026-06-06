import type { CatalogReadinessState } from "@/app/lib/catalogReadiness";

export const CATALOG_CARD =
  "rounded-md border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/** Catalog items table section — slightly tighter horizontal padding for more table width. */
export const CATALOG_ITEMS_SECTION =
  "rounded-md border border-slate-200/80 bg-white px-3 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-4";

export const CATALOG_HERO_CARD =
  "rounded-lg border border-slate-200/90 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]";

export const CATALOG_COMPACT_STAT =
  "rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 text-center";

export const CATALOG_CHECKLIST_ITEM =
  "flex items-start gap-3 rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2.5";

export const CATALOG_MESSAGE_BANNER =
  "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900";

export const CATALOG_ERROR_BANNER =
  "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800";

export function catalogReadinessStatusPillClass(state: CatalogReadinessState): string {
  const base = "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1";
  if (state === "needs_pricing") {
    return `${base} bg-amber-50 text-amber-800 ring-amber-200`;
  }
  if (state === "ready_for_templates") {
    return `${base} bg-emerald-50 text-emerald-800 ring-emerald-200`;
  }
  return `${base} bg-slate-100 text-slate-700 ring-slate-200`;
}
