/**
 * FieldDive contractor surface tones.
 *
 * Available vocabulary, not a mapping: each surface decides whether it needs
 * any of these. Semantic colors stay in `tone.ts`.
 */

/** Cool canvas behind white work surfaces. */
export const APP_PAGE_BG = "bg-[#eef2f7]";

/** Quiet toned region inside a white surface (current situation, money summary). */
export const SURFACE_TONED = "bg-[#f5f8fc]";

/** Underline tabs: one family across Job Card, Catalog, and Builder sections. */
export const TAB_ACTIVE = "border-blue-600 font-semibold text-slate-950";
export const TAB_IDLE =
  "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800";
export const TAB_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40";

/** Confirmed-complete lead region: toned, with an emerald lead line instead of a box. */
export const COMPLETE_BAND = `rounded-lg border-l-2 border-emerald-500/70 ${SURFACE_TONED} px-4 py-3.5`;
