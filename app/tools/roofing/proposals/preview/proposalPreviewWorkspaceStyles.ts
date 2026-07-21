/**
 * Contractor-facing Proposal Preview workspace tokens.
 * Premium review command surface — finish polish, not a structural redesign.
 */

/** Soft workspace wash — less dead gray, more designed FieldDive stage */
export const PREVIEW_WORKSPACE_BG = "min-h-full bg-[#f7f8fa] pb-16";

/** Confident wide stage — fills the shell without floating isolation */
export const PREVIEW_WORKSPACE_STAGE =
  "mx-auto w-full max-w-[88rem] px-3 sm:px-5 lg:px-6";

export const PREVIEW_HEADER = "bg-white";

export const PREVIEW_HEADER_INNER =
  "flex flex-col gap-4 px-6 py-5 sm:px-8 sm:py-5 lg:flex-row lg:items-center lg:justify-between lg:px-9";

/** One continuous Preview + Send surface containing command, readiness, and proposal. */
export const PREVIEW_UNIFIED_SURFACE =
  "overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.055)]";

/** Command section lives inside the unified surface; no independent card chrome. */
export const PREVIEW_COMMAND_SURFACE = "bg-white";

/**
 * Review checkpoint — calm, not yellow-heavy alert wash.
 * Soft slate base with a restrained amber cue when attention is needed.
 */
export const PREVIEW_READINESS_NEEDS =
  "flex flex-col gap-3 border-t border-slate-100/90 bg-slate-50/80 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-9";

export const PREVIEW_READINESS_READY =
  "flex flex-col gap-3 border-t border-slate-100/90 bg-slate-50/60 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-9";

/** Proposal content continues inside the same unified surface. */
export const PREVIEW_REVIEW_SURFACE = "border-t border-slate-200/70 bg-white";

export const PREVIEW_REVIEW_SURFACE_PAD =
  "px-6 py-7 sm:px-10 sm:py-8 lg:px-12 lg:py-9";

export const PREVIEW_REVIEW_EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";
