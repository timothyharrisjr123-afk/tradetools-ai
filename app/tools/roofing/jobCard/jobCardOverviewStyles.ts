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
/** Overview card surface: one border, one radius, no nesting. */
export const OVERVIEW_CARD =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const OVERVIEW_ICON_BASE = "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full";
export const OVERVIEW_ICON_QUIET = `${OVERVIEW_ICON_BASE} bg-slate-100 text-slate-500`;
export const OVERVIEW_ICON_BLUE = `${OVERVIEW_ICON_BASE} bg-blue-50 text-blue-600`;
export const OVERVIEW_ICON_GREEN = `${OVERVIEW_ICON_BASE} bg-emerald-100/70 text-emerald-700`;
export const OVERVIEW_ICON_AMBER = `${OVERVIEW_ICON_BASE} bg-amber-100/70 text-amber-700`;
/** Small uppercase label over a card's subject (Coordinator, Crew). */
export const OVERVIEW_CARD_LABEL = "text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
export const OVERVIEW_CARD_NAME = "text-lg font-semibold leading-snug tracking-tight text-slate-950";
export const OVERVIEW_CARD_NAME_QUIET = "text-base font-medium leading-snug text-slate-500";
/** In-card edit action (Change, Assign crew): tinted, never a bare link. */
export const OVERVIEW_SOFT_ACTION =
  "inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50";
export const OVERVIEW_NEUTRAL_ACTION =
  "inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50";
/** The Overview's one primary action (lifecycle or next step): one style for both. */
export const OVERVIEW_PRIMARY_ACTION =
  "inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 sm:w-auto";
/** Quiet text action on a card (Show, See all activity). */
export const OVERVIEW_TEXT_ACTION =
  "inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";
/** Secondary field utility (Directions, Call): never competes with the lifecycle action. */
export const OVERVIEW_UTILITY =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200/90 bg-white px-3.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";
