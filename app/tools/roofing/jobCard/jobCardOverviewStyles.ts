/**
 * Job Card Overview type scale. Local to the Job Card until proven elsewhere:
 * identity (header) > current state > decision facts > group headings > body > metadata.
 */

/** Current state title: its own level, below the job identity. */
export const OVERVIEW_STATE_TITLE = "text-xl font-semibold tracking-tight text-slate-950";
/** Sentence-case group heading (Authorized work, Tasks, Payments). */
export const OVERVIEW_GROUP_HEADING = "text-sm font-semibold text-slate-900";
export const OVERVIEW_FACT_LABEL = "text-[13px] text-slate-500";
export const OVERVIEW_FACT_TEXT = "text-[15px] font-medium leading-snug text-slate-900";
export const OVERVIEW_FACT_TEXT_QUIET = "text-[15px] leading-snug text-slate-500";
export const OVERVIEW_FACT_META = "text-xs text-slate-500";
/** Work, scope, and task text: comfortable to read in the field. */
export const OVERVIEW_BODY = "text-[15px] leading-relaxed text-slate-800";
export const OVERVIEW_META = "text-[13px] leading-snug text-slate-500";
/** Quiet in-context destination link (Open Payments, View all tasks). */
export const OVERVIEW_LINK =
  "inline-flex min-h-[36px] items-center rounded-sm text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950 hover:decoration-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";
/** Secondary field utility (Directions, Call): never competes with the lifecycle action. */
export const OVERVIEW_UTILITY =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200/90 bg-white px-3.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";
