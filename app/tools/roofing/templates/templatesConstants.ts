import type { CatalogReadinessState } from "@/app/lib/catalogReadiness";

export const TEMPLATES_CARD =
  "rounded-md border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const TEMPLATES_HERO_CARD =
  "rounded-lg border border-slate-200/90 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]";

export const TEMPLATES_PREREQ_BANNER =
  "rounded-lg border border-amber-200/90 bg-amber-50/70 px-4 py-4";

export const TEMPLATES_LIBRARY_ROW =
  "rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm";

export const TEMPLATES_LIBRARY_ROW_SELECTED =
  "rounded-lg border border-cyan-300 bg-cyan-50/40 px-4 py-4 shadow-sm ring-1 ring-cyan-200";

export const TEMPLATES_WORKSPACE_ZONE =
  "rounded-lg border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]";

export const TEMPLATES_LOCKED_BANNER =
  "mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3";

export const TEMPLATES_OPTION_GROUP =
  "overflow-hidden rounded-lg border border-slate-200 bg-white";

export const TEMPLATES_CONTENT_SECTION_ROW = "px-4 py-4";

export const TEMPLATES_COMPACT_STAT =
  "rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 text-center";

export const TEMPLATES_CHECKLIST_ITEM =
  "flex items-start gap-3 rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2.5";

export const TEMPLATES_OPTION_CHIP =
  "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200";

export const TEMPLATES_MESSAGE_BANNER =
  "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900";

export const TEMPLATES_ERROR_BANNER =
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
