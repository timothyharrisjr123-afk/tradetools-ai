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

/** Signed-out and pre-membership entry screens (sign in, join, start): one card on the canvas. */
export const ENTRY_CARD =
  "rounded-xl border border-slate-200/80 bg-white p-6 shadow-md shadow-slate-900/5 sm:p-7";
export const ENTRY_PRIMARY_ACTION =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
export const ENTRY_SECONDARY_ACTION =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

/** Confirmed-complete lead region: toned, with an emerald lead line instead of a box. */
export const COMPLETE_BAND = `rounded-lg border-l-2 border-emerald-500/70 ${SURFACE_TONED} px-4 py-3.5`;
