/**
 * Contractor-facing Proposal Preview workspace tokens.
 * V2C1 — document-first review shell; compact command context.
 */

/** Soft workspace wash — FieldDive review stage */
export const PREVIEW_WORKSPACE_BG = "min-h-full bg-[#f7f8fa] pb-16";

/** Wide stage — document dominates; less wasted top chrome */
export const PREVIEW_WORKSPACE_STAGE =
  "mx-auto w-full max-w-[88rem] px-3 sm:px-5 lg:px-6";

/** Compact command strip — not a giant admin card */
export const PREVIEW_HEADER =
  "rounded-xl border border-slate-200/70 bg-white/95 shadow-[0_4px_16px_rgba(15,23,42,0.04)]";

export const PREVIEW_HEADER_INNER =
  "flex items-start justify-between gap-3 px-4 py-3 sm:items-center sm:gap-4 sm:px-5 sm:py-3.5";

/** Command + optional blocker chip stack above the document */
export const PREVIEW_COMMAND_SURFACE = "space-y-2";

/**
 * Blocked-only cue — quiet amber chip, not a readiness dashboard.
 */
export const PREVIEW_READINESS_NEEDS =
  "flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4";

/** @deprecated Healthy Preview mounts no ready strip in V2C1. */
export const PREVIEW_READINESS_READY = PREVIEW_READINESS_NEEDS;

/** Customer document surface — primary visual mass */
export const PREVIEW_REVIEW_SURFACE =
  "overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.055)]";

export const PREVIEW_REVIEW_SURFACE_PAD =
  "px-5 py-6 sm:px-9 sm:py-7 lg:px-11 lg:py-8";

export const PREVIEW_REVIEW_EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";

/** Legacy unified-surface token — V2C1 keeps command and document as siblings. */
export const PREVIEW_UNIFIED_SURFACE = PREVIEW_REVIEW_SURFACE;
