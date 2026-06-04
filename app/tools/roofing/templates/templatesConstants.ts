import type { CatalogReadinessState } from "@/app/lib/catalogReadiness";

export const TEMPLATES_CARD =
  "rounded-md border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const TEMPLATES_SETUP_STEP_CARD =
  "flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm";

export const TEMPLATES_SETUP_STEP_ACTIVE_RING = "ring-2 ring-cyan-200/90 border-cyan-200";

export const TEMPLATES_METRIC_TILE =
  "rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3";

export function catalogReadinessStatusPillClass(state: CatalogReadinessState): string {
  const base =
    "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1";
  if (state === "needs_pricing") {
    return `${base} bg-amber-50 text-amber-800 ring-amber-200`;
  }
  if (state === "ready_for_templates") {
    return `${base} bg-emerald-50 text-emerald-800 ring-emerald-200`;
  }
  return `${base} bg-slate-100 text-slate-700 ring-slate-200`;
}
