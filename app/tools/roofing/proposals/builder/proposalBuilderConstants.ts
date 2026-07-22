import type { ProposalBuilderGate } from "@/app/lib/proposalBuilderReadiness";

export const BUILDER_CARD =
  "rounded-md border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const BUILDER_HERO_CARD =
  "rounded-lg border border-slate-200/90 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]";

export const BUILDER_BLOCKED_BANNER =
  "rounded-lg border border-amber-200/90 bg-amber-50/70 px-5 py-5";

export const BUILDER_SHELL_BANNER =
  "rounded-md border border-cyan-200/80 bg-cyan-50/60 px-4 py-3 text-sm text-cyan-950";

/**
 * Shared horizontal stage — header, Preview/More, section bar, and canvas
 * share one container. Wider than early Builder so Job Card continuity holds.
 */
export const BUILDER_STAGE = "mx-auto w-full max-w-[88rem]";

/** 3J4A — read-only proposal stage alert. */
export const BUILDER_READ_ONLY_ALERT =
  "flex items-start gap-3 rounded-lg border border-amber-300/80 bg-amber-50/60 px-4 py-3.5 text-amber-950";

/** 3J4B tightening — compact single-line read-only notice (less dominant). */
export const BUILDER_READ_ONLY_ALERT_COMPACT =
  "flex items-center gap-2 rounded-md border border-amber-200/80 bg-amber-50/50 px-3 py-1.5 text-[11px] leading-snug text-amber-900";

export const BUILDER_READ_ONLY_ALERT_TITLE = "Read-only proposal preview";

export const BUILDER_READ_ONLY_ALERT_BODY =
  "Pricing, PDF, send, signature, and payment come later. Resolved quantities and proposal totals are not shown in this stage.";

/** 3J4B tightening — condensed body for the compact read-only notice. */
export const BUILDER_READ_ONLY_ALERT_COMPACT_BODY =
  "Next: use Preview in the header to review the customer view. Send and sharing stay locked.";

/** 3J4B tightening — setup path without a saved draft yet. */
export const BUILDER_READ_ONLY_ALERT_COMPACT_BODY_SETUP =
  "Setup preview only — save a draft to unlock Preview. Send and sharing stay locked.";

/** Soft helper under entry chrome — demoted vs action banners. */
export const BUILDER_SNAPSHOT_FROZEN_HELPER_CLASS =
  "text-[11px] leading-snug text-slate-400";

/** 3J4A — full-width page context strip shell (R16C1: no overflow — menu portals to body). */
export const BUILDER_PAGE_STRIP =
  "flex min-h-[3.75rem] w-full items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-4 shadow-[0_8px_24px_rgba(15,23,42,0.07),0_1px_3px_rgba(15,23,42,0.06)]";

/** R16C1 — horizontally scrollable primary strip tabs only. */
export const BUILDER_PAGE_STRIP_SCROLL =
  "flex min-h-[3.75rem] min-w-0 flex-1 items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:h-1";

export const BUILDER_PAGE_STRIP_ITEM =
  "relative inline-flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-[14px] font-medium transition-colors";

export const BUILDER_PAGE_STRIP_ITEM_ACTIVE =
  "bg-blue-50/70 font-semibold text-blue-700 after:absolute after:-bottom-[9px] after:left-3 after:right-3 after:h-[3px] after:rounded-full after:bg-blue-600";

export const BUILDER_PAGE_STRIP_ITEM_IDLE =
  "text-slate-600 hover:bg-slate-50 hover:text-slate-900";

export const BUILDER_PAGE_STRIP_ITEM_DISABLED =
  "cursor-not-allowed text-slate-500";

export const BUILDER_PAGE_STRIP_ITEM_FUTURE =
  "cursor-not-allowed rounded-lg border border-dashed border-slate-300 bg-slate-50/80 text-slate-600";

export const BUILDER_PAGE_STRIP_SOON =
  "rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm";

/** 3J4B6 — document-page status chip on the page strip. */
export const BUILDER_PAGE_STRIP_CHIP_BASE =
  "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide";

/**
 * 3J4B6 — page strip chip text + class for an intrinsic page status.
 * "Active" is decided by the component (selected context), not the model.
 * Returns null when no chip should render (e.g. estimate idle).
 */
export function builderPageStripStatusChip(
  status: "template" | "empty" | "soon" | "locked" | "none",
  isActive: boolean
): { label: string; className: string } | null {
  if (isActive) {
    return {
      label: "Active",
      className: `${BUILDER_PAGE_STRIP_CHIP_BASE} bg-blue-100 text-blue-700`,
    };
  }
  switch (status) {
    case "template":
      return {
        label: "Template",
        className: `${BUILDER_PAGE_STRIP_CHIP_BASE} bg-slate-100 text-slate-600`,
      };
    case "empty":
      return {
        label: "Empty",
        className: `${BUILDER_PAGE_STRIP_CHIP_BASE} border border-dashed border-slate-300 text-slate-500`,
      };
    case "soon":
      return {
        label: "Soon",
        className: `${BUILDER_PAGE_STRIP_CHIP_BASE} border border-slate-200 bg-white text-slate-500 shadow-sm`,
      };
    case "locked":
      return {
        label: "Locked",
        className: `${BUILDER_PAGE_STRIP_CHIP_BASE} bg-slate-100 text-slate-500`,
      };
    case "none":
    default:
      return null;
  }
}

export const BUILDER_PAGE_STRIP_DIVIDER = "mx-1 h-8 w-px shrink-0 bg-slate-200/90";

/** R16C1 — overflow menu trigger in the page strip. */
export const BUILDER_PAGE_STRIP_OVERFLOW_TRIGGER =
  "relative inline-flex h-11 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-lg px-3 text-[14px] font-medium transition-colors";

export const BUILDER_PAGE_STRIP_OVERFLOW_TRIGGER_ACTIVE =
  "bg-blue-50/70 font-semibold text-blue-700 after:absolute after:-bottom-[9px] after:left-3 after:right-3 after:h-[3px] after:rounded-full after:bg-blue-600";

export const BUILDER_PAGE_STRIP_OVERFLOW_TRIGGER_IDLE =
  "text-slate-600 hover:bg-slate-50 hover:text-slate-900";

export const BUILDER_PAGE_STRIP_OVERFLOW_COUNT_BADGE =
  "inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-slate-200/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600";

/** R16C1 — overflow menu panel (position set inline when portaled to body). */
export const BUILDER_PAGE_STRIP_OVERFLOW_MENU =
  "min-w-[14rem] max-w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.06)]";

export const BUILDER_PAGE_STRIP_OVERFLOW_MENU_HEADING =
  "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500";

export const BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM =
  "flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50";

export const BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM_ACTIVE =
  "bg-blue-50/70 hover:bg-blue-50/70";

export const BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM_LABEL =
  "truncate text-sm font-medium text-slate-800";

export const BUILDER_PAGE_STRIP_OVERFLOW_MENU_ITEM_TYPE =
  "truncate text-[11px] text-slate-500";

/** R16C3 — compact hidden indicator on strip tabs (icon-only). */
export const BUILDER_PAGE_STRIP_HIDDEN_INDICATOR =
  "inline-flex shrink-0 text-slate-400";

/** R16C3 — contractor-only banner when viewing a hidden page. */
export const BUILDER_PAGE_HIDDEN_BANNER =
  "border-b border-slate-200/80 bg-slate-100/80 px-7 py-2.5 text-[13px] text-slate-600";

/** R16C3 — page workspace visibility toggle control. */
export const BUILDER_PAGE_VISIBILITY_CONTROL =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60";

export const BUILDER_PAGE_VISIBILITY_CONTROL_IDLE =
  "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

export const BUILDER_PAGE_VISIBILITY_CONTROL_HIDDEN =
  "border-amber-300/80 bg-amber-50/60 text-amber-900 hover:bg-amber-50";

export const BUILDER_PAGE_VISIBILITY_CONTROL_ACTIVE = "opacity-70";

export const BUILDER_PAGE_VISIBILITY_REQUIRED_NOTICE =
  "text-[12px] text-slate-500";

/** R16C2 — token picker trigger in page editor toolbar. */
export const BUILDER_TOKEN_PICKER_TRIGGER =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50";

export const BUILDER_TOKEN_PICKER_TRIGGER_TEXT = "truncate";

/** R16C2 — portaled token picker menu panel. */
export const BUILDER_TOKEN_PICKER_MENU =
  "min-w-[16rem] max-w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.06)]";

export const BUILDER_TOKEN_PICKER_MENU_GROUP = "py-1";

export const BUILDER_TOKEN_PICKER_MENU_GROUP_HEADING =
  "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500";

export const BUILDER_TOKEN_PICKER_ITEM =
  "flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50";

export const BUILDER_TOKEN_PICKER_ITEM_LABEL = "truncate text-sm font-medium text-slate-800";

export const BUILDER_TOKEN_PICKER_ITEM_PLACEHOLDER =
  "truncate font-mono text-[11px] text-slate-500";

export const BUILDER_TOKEN_PICKER_ITEM_DESCRIPTION = "truncate text-[11px] text-slate-500";

export const BUILDER_TOKEN_PICKER_ITEM_HINT = "truncate text-[11px] text-amber-700/90";

/** Block 4C — canvas fills attached workspace shell (no nested floating card). */
export const BUILDER_CANVAS = "w-full overflow-visible bg-white";

export const BUILDER_CANVAS_INNER = "px-7 py-6";

export const BUILDER_CANVAS_HERO_DIVIDER =
  "border-b border-slate-200/80 bg-white";

export const BUILDER_CANVAS_KICKER =
  "text-[12px] font-semibold uppercase tracking-[0.16em] text-blue-500/80";

/** R15 — cover page section kicker. */
export const BUILDER_COVER_SECTION_LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

/** R15 — contractor-only notice when stamped identity fields are missing. */
export const BUILDER_COVER_IDENTITY_INCOMPLETE =
  "rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-900";

/** R15 — quiet draft-stage footnote on the cover (not lifecycle enablement). */
export const BUILDER_COVER_DRAFT_NOTICE = "text-[11px] leading-snug text-slate-400";

export const BUILDER_CANVAS_TITLE =
  "text-[2.1rem] font-semibold leading-tight tracking-tight text-slate-950";

export const BUILDER_CANVAS_SUBTITLE =
  "mt-2 text-[15px] text-slate-600";

export const BUILDER_SNAPSHOT_BADGE =
  "flex items-center justify-between gap-3 rounded-xl border border-emerald-200/90 bg-emerald-50/70 px-5 py-3.5 shadow-[0_1px_4px_rgba(16,185,129,0.08)]";

export const BUILDER_WORKSPACE_TABS =
  "border-b border-slate-200/90 bg-slate-50/30 px-7";

export const BUILDER_WORKSPACE_TAB_ACTIVE = "border-blue-600 text-blue-700 font-semibold";

export const BUILDER_WORKSPACE_TAB_IDLE =
  "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700";

export const BUILDER_PROJECT_IMAGE =
  "relative h-[17.25rem] w-full overflow-hidden rounded-xl border border-slate-300/80 bg-slate-100 shadow-[0_16px_38px_rgba(15,23,42,0.20)] xl:w-[390px] 2xl:w-[410px]";

export const BUILDER_PACKAGE_CARD =
  "relative flex min-h-[10.5rem] flex-col rounded-xl border px-4 py-3.5 text-left transition duration-200";

/** 3J4B flow-focus: lower-dominance package card once a package is selected and pricing is blocked. */
export const BUILDER_PACKAGE_CARD_COMPACT =
  "relative flex min-h-[9rem] flex-col rounded-xl border px-4 py-3.5 text-left transition duration-200";

export const BUILDER_PACKAGE_CARD_IDLE =
  "border-slate-200/90 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:bg-slate-50/40";

export const BUILDER_PACKAGE_CARD_SELECTED =
  "border-blue-400 bg-blue-50/40 shadow-[0_6px_18px_rgba(37,99,235,0.10)] ring-1 ring-blue-200/70";

export const BUILDER_OVERVIEW_CARD =
  "flex min-h-[5.75rem] items-start gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.055),0_1px_3px_rgba(15,23,42,0.04)]";

export const BUILDER_OVERVIEW_CARD_WARNING =
  "border-amber-200/90 bg-amber-50/65 shadow-[0_10px_24px_rgba(245,158,11,0.10),0_1px_3px_rgba(245,158,11,0.06)]";

/** Overview tab — full-width pricing preview notice. */
export const BUILDER_OVERVIEW_PREVIEW_NOTICE =
  "flex w-full items-start gap-3 rounded-xl border border-blue-200/80 bg-blue-50/75 px-5 py-4 text-sm leading-relaxed text-blue-950 shadow-[0_1px_4px_rgba(37,99,235,0.06)]";

export const BUILDER_STATUS_PILL =
  "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600";

/** 3J4B2 — header identity kicker above the job title. */
export const BUILDER_HEADER_KICKER =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500/80";

/** R16A — re-export workspace copy from IA module for builder UI. */
export {
  BUILDER_COVER_DRAFT_NOTE,
  BUILDER_DOCUMENT_READ_ONLY_FOOTER,
  BUILDER_HEADER_WORKSPACE_CONTEXT_NOTE,
  BUILDER_HEADER_WORKSPACE_KICKER,
  BUILDER_OVERFLOW_MENU_ARIA_LABEL,
  BUILDER_OVERFLOW_MENU_HEADING,
  BUILDER_OVERFLOW_MENU_LABEL,
  BUILDER_PAGE_EDIT_HELPER_COPY,
  BUILDER_PAGE_EDIT_MERGE_PREVIEW_LABEL,
  BUILDER_TOKEN_PICKER_ARIA_LABEL,
  BUILDER_TOKEN_PICKER_HEADING,
  BUILDER_TOKEN_PICKER_TRIGGER_LABEL,
  BUILDER_UNSAVED_PAGE_EDIT_CONFIRM,
} from "@/app/lib/proposalBuilderDocumentIa";

/** 3J4B2 — neutral context chip (template / package) in the header. */
export const BUILDER_HEADER_CHIP =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm";

/** 3J4B2 — emerald Draft • Saved pill for a persisted draft. */
export const BUILDER_HEADER_DRAFT_PILL =
  "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700";

/** 3J4B2 — neutral setup-preview pill when no persisted draft exists yet. */
export const BUILDER_HEADER_SETUP_PILL =
  "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600";

/** 3J4B2 — helper copy clarifying template vs master-template editing. */
export const BUILDER_HEADER_TEMPLATE_HELPER =
  "This proposal uses the template — editing here does not change the master template.";

export const BUILDER_RAIL_MAIN_TITLE = "text-base font-semibold text-slate-900";

/** 3J4B3 — guided path section heading in the right rail. */
export const BUILDER_RAIL_GUIDED_PATH_TITLE = "Guided path";

/** 3J4B4 — "what do I do next?" card at the top of the rail. */
export const BUILDER_NEXT_ACTION_CARD =
  "rounded-xl border border-blue-200/80 bg-blue-50/60 px-4 py-3.5 shadow-[0_1px_4px_rgba(37,99,235,0.06)]";

export const BUILDER_NEXT_ACTION_KICKER =
  "text-[10px] font-bold uppercase tracking-[0.12em] text-blue-600/80";

export const BUILDER_NEXT_ACTION_TITLE = "mt-1 text-sm font-semibold text-slate-900";

export const BUILDER_NEXT_ACTION_DESC = "mt-1 text-xs leading-snug text-slate-600";

export const BUILDER_NEXT_ACTION_CTA =
  "mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700";

export const BUILDER_NEXT_ACTION_CTA_DISABLED =
  "mt-3 inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400";

/** 3J4B3 — guided path step row (button or static). */
export const BUILDER_GUIDED_STEP_ROW =
  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors";

export const BUILDER_GUIDED_STEP_ROW_CLICKABLE = "hover:bg-slate-50";

export const BUILDER_GUIDED_STEP_ROW_STATIC = "cursor-default";

/** 3J4B3 — small status pill per guided step. */
export const BUILDER_GUIDED_STEP_PILL_BASE =
  "ml-auto inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

/**
 * 3J4B3 — visual mapping for guided-step state.
 * Pure presentation only — does not enable or change any lifecycle behavior.
 */
export function builderGuidedStepDotClass(
  state: "ready" | "selected" | "attention" | "blocked" | "locked" | "future"
): string {
  switch (state) {
    case "ready":
    case "selected":
      return "bg-emerald-500";
    case "attention":
      return "bg-amber-500";
    case "blocked":
      return "bg-red-500";
    case "locked":
      return "bg-slate-400";
    case "future":
    default:
      return "bg-slate-300";
  }
}

export function builderGuidedStepPillClass(
  state: "ready" | "selected" | "attention" | "blocked" | "locked" | "future"
): string {
  switch (state) {
    case "ready":
    case "selected":
      return `${BUILDER_GUIDED_STEP_PILL_BASE} bg-emerald-100 text-emerald-800`;
    case "attention":
      return `${BUILDER_GUIDED_STEP_PILL_BASE} bg-amber-100 text-amber-800`;
    case "blocked":
      return `${BUILDER_GUIDED_STEP_PILL_BASE} bg-red-100 text-red-800`;
    case "locked":
      return `${BUILDER_GUIDED_STEP_PILL_BASE} bg-slate-100 text-slate-600`;
    case "future":
    default:
      return `${BUILDER_GUIDED_STEP_PILL_BASE} bg-slate-100 text-slate-500`;
  }
}

export const BUILDER_SECTION_NAV_ITEM =
  "flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-medium transition-colors";

export const BUILDER_CANVAS_PLACEHOLDER =
  "flex min-h-[22rem] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center";

export const BUILDER_RAIL_STAT =
  "rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-1.5";

/** Right-rail shell — aligned with premium canvas surface. */
export const BUILDER_RAIL_CARD =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.08)]";

export const BUILDER_DISABLED_ACTION =
  "inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-400 cursor-not-allowed";

/** R17B — enabled Preview lifecycle action in Builder header. */
export const BUILDER_PREVIEW_ENABLED_ACTION =
  "inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700";

export const BUILDER_OPTION_TAB =
  "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

export const BUILDER_OPTION_TAB_ACTIVE =
  "rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm";

/** Small per-option pricing status pill on option tabs (3I-2C). */
export const BUILDER_OPTION_PRICING_STATUS_PILL =
  "ml-2 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide";

export const BUILDER_OPTION_PRICING_STATUS_PILL_COMPLETE =
  "bg-emerald-100 text-emerald-800";

export const BUILDER_OPTION_PRICING_STATUS_PILL_INCOMPLETE =
  "bg-amber-100 text-amber-800";

export const BUILDER_OPTION_PRICING_STATUS_PILL_COMPLETE_ON_ACTIVE =
  "bg-white/20 text-emerald-100";

export const BUILDER_OPTION_PRICING_STATUS_PILL_INCOMPLETE_ON_ACTIVE =
  "bg-white/20 text-amber-100";

/** Option tab / rail pricing status words only — no dollars. */
export function formatOptionPricingTabStatusLabel(pricingComplete: boolean): string {
  return pricingComplete ? "Complete" : "Incomplete";
}

/** Guardrail outcome → contractor-facing display word (informational only). */
export function formatGuardrailOutcomeLabel(outcome: "pass" | "warn" | "block"): string {
  switch (outcome) {
    case "pass":
      return "Pass";
    case "warn":
      return "Needs review";
    case "block":
      return "Needs review";
    default:
      return "Needs review";
  }
}

/** 3I-3D1 — Builder right-rail group headings (Setup readiness / Pricing confidence). */
export const BUILDER_RAIL_GROUP_HEADING =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-600";

export const BUILDER_RAIL_SETUP_READINESS_TITLE = "Setup readiness";

export const BUILDER_RAIL_PRICING_CONFIDENCE_TITLE = "Pricing readiness";

export const BUILDER_RAIL_PRICING_STATUS_LABEL = "Pricing status";

export const BUILDER_RAIL_BLOCKING_LINES_LABEL = "Blocking";

export const BUILDER_RAIL_GUARDRAIL_LABEL = "Estimate review";

export const BUILDER_GUARDRAIL_STATUS_CHECKING = "Checking…";

export const BUILDER_GUARDRAIL_MESSAGE_WARN = "Needs review before preview.";

export const BUILDER_GUARDRAIL_MESSAGE_BLOCK = "Needs review before totals are final.";

/** When Preview is available, review status must not feel louder than next action. */
export const BUILDER_GUARDRAIL_MESSAGE_BLOCK_PREVIEW_OK =
  "Needs review. Preview remains available for contractor review.";

export const BUILDER_GUARDRAIL_MESSAGE_CHECKING = "Checking…";

export const BUILDER_RAIL_ACTIONS_NOTE =
  "Preview unlocks with a saved draft proposal. Send, Sign, Payment, PDF, and public customer sharing remain disabled.";

/** R17B — saved draft path: contractor Customer Preview is available from the header. */
export const BUILDER_RAIL_ACTIONS_NOTE_PREVIEW_ENABLED =
  "Customer Preview is available from the header for saved drafts. Send, Sign, Payment, PDF, and public customer sharing remain disabled.";

export function resolveBuilderRailActionsNote(previewAvailable: boolean): string {
  return previewAvailable
    ? BUILDER_RAIL_ACTIONS_NOTE_PREVIEW_ENABLED
    : BUILDER_RAIL_ACTIONS_NOTE;
}

export const BUILDER_GUARDRAIL_PILL_BASE =
  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

export const BUILDER_GUARDRAIL_PILL_PASS = `${BUILDER_GUARDRAIL_PILL_BASE} bg-emerald-100 text-emerald-800`;

export const BUILDER_GUARDRAIL_PILL_WARN = `${BUILDER_GUARDRAIL_PILL_BASE} bg-amber-100 text-amber-800`;

export const BUILDER_GUARDRAIL_PILL_BLOCK = `${BUILDER_GUARDRAIL_PILL_BASE} bg-red-100 text-red-800`;

export const BUILDER_GUARDRAIL_PILL_CHECKING = `${BUILDER_GUARDRAIL_PILL_BASE} bg-slate-100 text-slate-600`;

export function guardrailOutcomePillClass(
  outcome: "pass" | "warn" | "block" | "checking"
): string {
  switch (outcome) {
    case "pass":
      return BUILDER_GUARDRAIL_PILL_PASS;
    case "warn":
      return BUILDER_GUARDRAIL_PILL_WARN;
    case "block":
      return BUILDER_GUARDRAIL_PILL_BLOCK;
    default:
      return BUILDER_GUARDRAIL_PILL_CHECKING;
  }
}

/** Status-only guardrail helper copy — omitted on pass to keep the row compact (3I-3D1). */
export function guardrailRailMessage(
  outcome: "pass" | "warn" | "block" | null,
  checking: boolean,
  previewAvailable = false
): string | null {
  if (checking) return BUILDER_GUARDRAIL_MESSAGE_CHECKING;
  switch (outcome) {
    case "warn":
      return BUILDER_GUARDRAIL_MESSAGE_WARN;
    case "block":
      return previewAvailable
        ? BUILDER_GUARDRAIL_MESSAGE_BLOCK_PREVIEW_OK
        : BUILDER_GUARDRAIL_MESSAGE_BLOCK;
    default:
      return null;
  }
}

export function guardrailRailStatusLabel(
  outcome: "pass" | "warn" | "block" | null,
  checking: boolean,
  previewAvailable = false
): string {
  if (checking) return BUILDER_GUARDRAIL_STATUS_CHECKING;
  if (outcome == null) return BUILDER_GUARDRAIL_STATUS_CHECKING;
  if (outcome === "block" && previewAvailable) return "Needs review";
  return formatGuardrailOutcomeLabel(outcome);
}

/** Desk/surface behind the proposal page. */
export const BUILDER_DOCUMENT_SURFACE =
  "rounded-lg border border-slate-200/60 bg-slate-100/70 p-4 sm:p-6";

/** Primary proposal document page (center canvas product object). */
export const BUILDER_DOCUMENT_PAGE =
  "mx-auto min-h-[28rem] max-w-3xl rounded-sm border border-slate-200/90 bg-white px-6 py-8 shadow-[0_2px_12px_rgba(15,23,42,0.08)] sm:px-10 sm:py-10";

/** Vertical document section — headings + body, not dashboard cards. */
export const BUILDER_DOCUMENT_SECTION = "space-y-4 border-b border-slate-100 pb-8 last:border-b-0 last:pb-0";

export const BUILDER_DOCUMENT_TEXT_BLOCK = "mt-2 max-w-none text-slate-700";

export const BUILDER_PROPOSAL_LINE_ROW = "py-4 first:pt-0";

export const BUILDER_LINE_LIST_FOOTER = "mt-4 text-[11px] leading-snug text-slate-400";

export const BUILDER_CONTEXT_STRIP = "text-xs text-slate-400";

/** Persistent amber preview banner — clearly not a real customer price. */
export const BUILDER_PRICING_PREVIEW_BANNER =
  "rounded-md border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs leading-snug text-amber-900";

/** Softer preview banner used once the company pricing policy is configured (3I-3B3c). */
export const BUILDER_PRICING_CONFIGURED_BANNER =
  "rounded-md border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-xs leading-snug text-slate-600";

/** Settings route for configuring the company pricing policy. */
export const PRICING_SETTINGS_HREF = "/tools/settings/pricing";

/**
 * Builder preview banner copy (3I-3B3c). Configured path softens; missing path
 * keeps the strong placeholder warning. The placeholder copy mirrors the
 * orchestrator fallback (BUILDER_PREVIEW_PRICING_POLICY = 50% margin).
 */
export const BUILDER_PRICING_PREVIEW_CONFIGURED_COPY =
  "Preview based on your company pricing. Not a sent quote.";

export const BUILDER_PRICING_PREVIEW_PLACEHOLDER_COPY =
  "Preview pricing — uses a placeholder 50% margin, not your company's configured pricing. Not a customer quote.";

/** Line-list footer copy, conditional on pricing policy configuration (3I-3B3c). */
export const BUILDER_LINE_FOOTER_CONFIGURED_COPY =
  "Preview based on your company pricing. Not a customer contract amount.";

export const BUILDER_LINE_FOOTER_PLACEHOLDER_COPY =
  "Preview pricing uses a placeholder margin, not your company's configured pricing. Not a customer contract amount.";

/** Document totals footnote, conditional on pricing policy configuration (3I-3B3c). */
export const BUILDER_TOTALS_FOOTNOTE_CONFIGURED_COPY =
  "Preview totals reflect your saved company pricing. Not a sent quote.";

export const BUILDER_TOTALS_FOOTNOTE_PLACEHOLDER_COPY =
  "Totals appear after company pricing is configured. Not a sent quote.";

/** Right-rail pricing-policy status word — no dollars, no policy detail (3I-3B3c). */
export function formatPricingPolicyConfiguredLabel(configured: boolean): string {
  return configured ? "Configured" : "Not configured";
}

/** 3I-3C — contractor-only internal profitability rail block. */
export const BUILDER_INTERNAL_PROFITABILITY_SECTION_TITLE = "Contractor-only profitability";

export const BUILDER_INTERNAL_PROFITABILITY_SECTION_NOTE = "Contractor-only.";

/** 3J4B — muted note shown when internal profitability is not yet reviewable. */
export const BUILDER_INTERNAL_PROFITABILITY_TUCKED_COPY =
  "Resolve pricing blockers before profitability review. Contractor-only — never shown on the customer proposal.";

export const BUILDER_INTERNAL_PROFITABILITY_LABEL_COST = "Cost";

export const BUILDER_INTERNAL_PROFITABILITY_LABEL_PROFIT = "Profit";

export const BUILDER_INTERNAL_PROFITABILITY_LABEL_MARGIN = "Margin";

/** Totals block at the foot of the proposal document page. */
export const BUILDER_DOCUMENT_TOTALS_BLOCK = "border-t border-slate-200/80 pt-6 mt-6 space-y-2";

/** Per-line price column header label. */
export const BUILDER_LINE_PRICE_COL_HEADER =
  "text-[10px] font-medium uppercase tracking-wide text-slate-400";

/** Per-line: resolved dollar amount. */
export const BUILDER_LINE_PRICE_VALUE =
  "text-sm tabular-nums font-medium text-slate-800";

/** Per-line: status badge (Included / In package / Needs quantity / Not priced). */
export const BUILDER_LINE_PRICE_STATUS = "text-xs font-medium text-slate-500";

/**
 * Block 5C — customer Preview visual chrome now lives entirely in
 * `app/tools/roofing/proposals/preview/proposalCustomerPacketStyles.ts`.
 * Preview must not import Builder/workbench visual tokens.
 */

/** R17C2 — Builder Estimate workbench surfaces (not customer Preview). */
export const WORKBENCH_ESTIMATE_KICKER = "Estimate";

/** Estimate document intro — light, not a workbench hero band. */
export const WORKBENCH_HEADER =
  "border-b border-slate-100 bg-white px-6 pb-4 pt-5 sm:px-8 sm:pt-6 lg:px-10";

export const WORKBENCH_HEADER_KICKER =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";

export const WORKBENCH_HEADER_TITLE =
  "mt-1 text-[1.45rem] font-semibold leading-tight tracking-[-0.02em] text-slate-950";

export const WORKBENCH_HEADER_SUBTITLE = "mt-1 max-w-2xl text-[14px] leading-relaxed text-slate-600";

export const WORKBENCH_HEADER_STAT =
  "inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm";

export const WORKBENCH_HEADER_STAT_READY = "font-semibold tabular-nums text-emerald-700";

export const WORKBENCH_HEADER_STAT_ATTENTION = "font-semibold tabular-nums text-amber-700";

export const WORKBENCH_HEADER_STAT_REVIEW = "font-semibold tabular-nums text-slate-700";

/** Document body — flat sections, not stacked workbench cards. */
export const WORKBENCH_BODY =
  "space-y-7 bg-white px-6 py-5 sm:px-8 sm:py-7 lg:px-10";

/** Shared module shell — quiet borders for document sections. */
export const WORKBENCH_MODULE =
  "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_-22px_rgba(15,23,42,0.5)]";

export const WORKBENCH_MODULE_COMPACT =
  "overflow-hidden border-t border-slate-100 bg-white";

export const WORKBENCH_MODULE_INNER = "px-0 py-3";

export const WORKBENCH_MODULE_KICKER =
  "text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400";

export const WORKBENCH_MODULE_TITLE = "text-[15px] font-semibold tracking-tight text-slate-950";

export const WORKBENCH_MODULE_DESC = "mt-0.5 text-[13px] leading-relaxed text-slate-600";

/** Compact package row — not a heavy command card. */
export const WORKBENCH_PACKAGE_MODULE =
  "overflow-hidden bg-white";

export const WORKBENCH_PACKAGE_ACCENT = "hidden";

export const WORKBENCH_PACKAGE_ACTIVE_CHIP =
  "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600";

export const WORKBENCH_ZONE_PANEL = WORKBENCH_MODULE;

export const WORKBENCH_ZONE_HEADER =
  "flex flex-wrap items-start justify-between gap-2 border-b border-slate-100/90 py-2";

export const WORKBENCH_ZONE_BODY = WORKBENCH_MODULE_INNER;

export const WORKBENCH_ATTENTION_ZONE =
  "overflow-hidden rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/70 to-white";

export const WORKBENCH_ATTENTION_ZONE_HEADER =
  "border-b border-amber-200/50 bg-amber-50/60 px-4 py-3.5 sm:px-5";

export const WORKBENCH_ATTENTION_COUNT_BADGE =
  "inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white shadow-sm";

export const WORKBENCH_ATTENTION_ITEM =
  "rounded-lg border border-amber-200/70 bg-white/90 px-3 py-2.5 shadow-[0_1px_4px_rgba(245,158,11,0.06)]";

export const WORKBENCH_ATTENTION_ITEM_INDEX =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800";

/** R17C2.5 / 4C — guided finish-estimate section (not a workbench module card). */
export const WORKBENCH_SCOPE_REVIEW_ZONE =
  "overflow-hidden rounded-xl border border-slate-200/80 bg-white";

export const WORKBENCH_SCOPE_REVIEW_ZONE_HEADER =
  "border-b border-slate-200/70 bg-slate-50/70 px-4 py-3.5 sm:px-5";

export const WORKBENCH_SCOPE_REVIEW_COUNT_BADGE =
  "inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-slate-600 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white shadow-sm";

export const WORKBENCH_SCOPE_REVIEW_ITEM =
  "rounded-lg border border-slate-200/70 bg-white px-3 py-2.5";

export const WORKBENCH_SCOPE_REVIEW_ITEM_INDEX =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600";

export const WORKBENCH_SCOPE_REVIEW_PILL =
  "inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600";

export const WORKBENCH_FUTURE_ACTION_CHIP =
  "inline-flex cursor-not-allowed items-center rounded-md border border-slate-200/80 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-400 opacity-80";

export const WORKBENCH_UPGRADES_ZONE =
  "overflow-hidden border-t border-slate-100 bg-white";

export const WORKBENCH_UPGRADES_EMPTY =
  "flex items-start gap-2.5 rounded-lg border border-slate-200/60 bg-white/70 px-3 py-2.5 text-[12px] leading-snug text-slate-500";

export const WORKBENCH_SCOPE_SECTION = "";

export const WORKBENCH_SCOPE_SECTION_TITLE =
  "flex flex-wrap items-center justify-between gap-2 text-[13px] font-semibold text-slate-800";

export const WORKBENCH_SCOPE_COUNT_CHIP =
  "inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500";

export const WORKBENCH_LINE_ROW =
  "border-b border-slate-200/70 py-1.5 last:border-b-0 transition-colors hover:bg-slate-50/50";

export const WORKBENCH_LINE_GRID =
  "grid w-full grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(0,1fr)_9rem_8.5rem] sm:items-center";

/**
 * Full-width Included estimate: Item | Qty | Price | Actions.
 * Spans the wide Builder canvas — never add max-w compression.
 */
export const WORKBENCH_INCLUDED_ROW_GRID =
  "grid w-full grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,1fr)_6rem_8.5rem_6rem] sm:items-center";

/** Finish estimate: item name | Set quantity (far-right action edge). */
export const WORKBENCH_FINISH_ESTIMATE_ROW =
  "grid w-full grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center";

export const WORKBENCH_LINE_NAME = "text-[14px] font-medium leading-snug text-slate-900";

export const WORKBENCH_LINE_QTY =
  "text-[13px] tabular-nums text-slate-500 sm:text-right";

export const WORKBENCH_LINE_QTY_VALUE = "font-semibold tabular-nums text-slate-800";

export const WORKBENCH_LINE_AMOUNT =
  "shrink-0 text-[14px] tabular-nums font-semibold tracking-tight text-slate-950 sm:text-right";

/** Quiet text action for editing an existing manual quantity (no Manual qty badge). */
export const WORKBENCH_EDIT_QUANTITY_LINK =
  "inline-flex items-center text-[11px] font-medium text-blue-700/90 underline-offset-2 hover:text-blue-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export const WORKBENCH_LINE_AMOUNT_INCLUDED =
  "shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:pt-1 sm:text-right";

export const WORKBENCH_LINE_AMOUNT_ATTENTION =
  "shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-700 sm:pt-1 sm:text-right";

export const WORKBENCH_SETTINGS_MODULE =
  "overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-r from-slate-50/80 to-white shadow-[0_4px_14px_rgba(15,23,42,0.04)]";

export const WORKBENCH_SETTINGS_ENTRY =
  "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5";

export const WORKBENCH_SETTINGS_TOGGLE_STUB =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-slate-100/80 px-2 py-1 text-[10px] font-medium text-slate-500";

export const WORKBENCH_SETTINGS_TOGGLE_STUB_ON =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-300/80 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 shadow-sm";

export const WORKBENCH_HINT_STRIP =
  "flex items-start gap-2 rounded-lg border border-slate-200/60 bg-white/80 px-3 py-2.5 text-[11px] leading-snug text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]";

/** Totals attach to the estimate frame — not a separate card. */
export const WORKBENCH_TOTALS_ZONE =
  "border-t border-slate-200/80 bg-slate-50/70";

export const WORKBENCH_TOTALS_HEADER = "sr-only";

export const WORKBENCH_TOTALS_BODY = "px-5 py-4 sm:px-6";

export const WORKBENCH_TOTALS_INCOMPLETE_PANEL =
  "rounded-md bg-white/70 px-3 py-2.5 text-[13px] leading-relaxed text-slate-600";

export const WORKBENCH_TOTALS_AMOUNT_STACK =
  "ml-auto w-full max-w-sm space-y-1";

export const WORKBENCH_TOTALS_FOOTNOTE =
  "mt-3 text-right text-[11.5px] leading-snug text-slate-400";

/** R17C2 Phase 2.6 — Edit Option shell (UI only; no backend). */
/** @deprecated Block 4D — use WORKBENCH_EDIT_PACKAGE_TITLE in contractor UI. */
export const WORKBENCH_EDIT_OPTION_TITLE = "Edit scope";

/** Contractor package-scope editor (quantities / remove lines for this draft). */
export const WORKBENCH_EDIT_PACKAGE_TITLE = "Edit scope";

/** Change package = switch selected package option. */
export const WORKBENCH_CHANGE_PACKAGE_TITLE = "Change package";
export const WORKBENCH_CHANGE_PACKAGE_HINT = "Switch between available packages.";
export const WORKBENCH_EDIT_SCOPE_HINT =
  "Adjust quantities or remove scope lines for this proposal.";

export const WORKBENCH_EDIT_OPTION_COMING_SOON_BADGE =
  "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500";

export const WORKBENCH_EDIT_OPTION_TRIGGER_PRIMARY =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-600/90 bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export const WORKBENCH_EDIT_OPTION_TRIGGER_SECONDARY =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export const WORKBENCH_EDIT_OPTION_DRAWER_BACKDROP =
  "fixed inset-0 z-[70] bg-slate-900/35 backdrop-blur-[1px]";

export const WORKBENCH_EDIT_OPTION_DRAWER_PANEL =
  "fixed inset-y-0 right-0 z-[71] flex w-full max-w-md flex-col border-l border-slate-200/90 bg-white shadow-[-12px_0_40px_rgba(15,23,42,0.12)]";

export const WORKBENCH_EDIT_OPTION_DRAWER_HEADER =
  "shrink-0 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-4 py-4 sm:px-5";

export const WORKBENCH_EDIT_OPTION_DRAWER_BODY =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5";

export const WORKBENCH_EDIT_OPTION_DRAWER_FOOTER =
  "shrink-0 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5";

export const WORKBENCH_EDIT_OPTION_SECTION =
  "rounded-lg border border-slate-200/80 bg-slate-50/40 px-3.5 py-3";

export const WORKBENCH_EDIT_OPTION_SECTION_TITLE =
  "text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500";

export const WORKBENCH_EDIT_OPTION_SECTION_DESC =
  "mt-1 text-[12px] leading-snug text-slate-600";

export const WORKBENCH_EDIT_OPTION_CONTROL =
  "mt-2.5 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-400 opacity-60 cursor-not-allowed";

export const WORKBENCH_EDIT_OPTION_CONTROL_BTN =
  "mt-2.5 inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-400 opacity-60 cursor-not-allowed";

export const WORKBENCH_EDIT_OPTION_INTRO_COPY =
  "Quantity and scope tools for this package will unlock once the proposal draft is ready.";

export const WORKBENCH_EDIT_OPTION_TRUST_COPY =
  "Changes apply only to this proposal draft.";

export const WORKBENCH_EDIT_OPTION_FOOTER_COPY =
  "Select a line to review quantities or remove it from this proposal.";

export const WORKBENCH_EDIT_OPTION_CHIP_HINT =
  "Available in Edit option (coming soon)";

export const WORKBENCH_EDIT_OPTION_CHIP_ENABLED =
  "inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800 transition-colors hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60";

/** Quiet secondary line action (Remove) — not equal weight to Set quantity. */
export const WORKBENCH_EDIT_OPTION_CHIP_SECONDARY =
  "inline-flex items-center rounded-md border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-slate-500 underline-offset-2 transition hover:text-slate-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

export const WORKBENCH_EDIT_OPTION_CONTROL_ENABLED =
  "mt-2.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export const WORKBENCH_EDIT_OPTION_SAVE_BTN =
  "inline-flex items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60";

export const WORKBENCH_EDIT_OPTION_CANCEL_BTN =
  "inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60";

export const WORKBENCH_EDIT_OPTION_LINE_PICKER =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left text-[12px] text-slate-800 transition-colors hover:border-blue-200 hover:bg-blue-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export const WORKBENCH_EDIT_OPTION_LINE_PICKER_ACTIVE =
  "w-full rounded-md border border-blue-300 bg-blue-50/60 px-2.5 py-2 text-left text-[12px] font-semibold text-blue-900";

export const WORKBENCH_EDIT_OPTION_INTRO_COPY_LIVE =
  "Review quantities that still need attention, then adjust this proposal only.";

export const WORKBENCH_EDIT_OPTION_FOOTER_COPY_LIVE =
  "Select a line to edit quantity or remove it from this proposal.";

/** R17D Phase 2.5 — manual quantity active state in Edit Option drawer. */
export const WORKBENCH_MANUAL_QUANTITY_ACTIVE_BADGE = "Custom qty";

export const WORKBENCH_SET_QUANTITY_ACTION = "Set quantity";

export const WORKBENCH_EDIT_QUANTITY_ACTION = "Edit quantity";

export const WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL = "Use measured quantity";

export const WORKBENCH_MANUAL_QUANTITY_RESET_HELPER =
  "Return this line to the measured quantity for this package.";

export const WORKBENCH_MANUAL_QUANTITY_CLEAR_SUCCESS =
  "Manual quantity cleared and draft pricing refreshed.";

export const WORKBENCH_EDIT_OPTION_USE_MEASUREMENT_BTN =
  "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60";

export const WORKBENCH_MANUAL_QUANTITY_ACTIVE_READOUT =
  "mt-2 rounded-md border border-blue-200/70 bg-white px-3 py-2.5 text-[13px] font-semibold tabular-nums text-slate-900";

/** R17D Phase 3A — exclude/remove from proposal option (contractor estimate wording). */
export const WORKBENCH_REMOVE_FROM_OPTION_ACTION = "Remove from proposal";

export const WORKBENCH_EXCLUDE_SECTION_TITLE = "Remove from proposal";

export const WORKBENCH_EXCLUDE_SECTION_DESC =
  "Exclude this line from the estimate for this package without changing the master template.";

export const WORKBENCH_EXCLUDE_HELPER_COPY =
  "This line won't appear on the estimate for this package. The template is unchanged.";

export const WORKBENCH_EXCLUDE_ACTION_LABEL = "Remove from proposal";

export const WORKBENCH_EXCLUDE_IN_FLIGHT_LABEL = "Removing…";

export const WORKBENCH_EXCLUDE_SUCCESS =
  "Line removed from this option and draft pricing refreshed.";

export const WORKBENCH_RESTORE_EXCLUDED_ACTION = "Restore";

export const WORKBENCH_RESTORE_EXCLUDED_SUCCESS =
  "Line restored to this option and draft pricing refreshed.";

/**
 * R17D Phase 4 — visibility persistence labels (Block 4: not rendered on estimate review path).
 * Keep APIs; do not surface these strings in Builder estimate UI.
 */
export const WORKBENCH_HIDE_FROM_CUSTOMER_ACTION = "Exclude from estimate display";

export const WORKBENCH_HIDE_SECTION_TITLE = "Estimate display";

export const WORKBENCH_HIDE_SECTION_DESC =
  "Keep this line priced in the package total but omit it from the proposal document.";

export const WORKBENCH_HIDE_HELPER_COPY =
  "Option total is unchanged. Persistence remains available to future surfaces.";

export const WORKBENCH_HIDE_ACTION_LABEL = "Exclude from estimate display";

export const WORKBENCH_HIDE_IN_FLIGHT_LABEL = "Updating…";

export const WORKBENCH_HIDE_SUCCESS =
  "Line display updated and proposal pricing refreshed.";

export const WORKBENCH_RESTORE_VISIBILITY_ACTION = "Restore in estimate";

export const WORKBENCH_RESTORE_VISIBILITY_SUCCESS =
  "Line display restored and proposal pricing refreshed.";

export const WORKBENCH_HIDE_ACTION_BTN =
  "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60";

export const WORKBENCH_EXCLUDE_ACTION_BTN =
  "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60";

export const WORKBENCH_DECISION_TRACE_ZONE =
  "rounded-xl border border-slate-200/80 bg-slate-50/50 shadow-sm";

export const WORKBENCH_DECISION_TRACE_ZONE_HEADER =
  "border-b border-slate-200/70 px-4 py-3";

export const WORKBENCH_DECISION_TRACE_ITEM =
  "rounded-lg border border-slate-200/70 bg-white px-3 py-2.5";

export const WORKBENCH_DECISION_TRACE_REMOVED_PILL =
  "inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600";

/**
 * Format a whole-cents integer as a USD dollar string, e.g. "$1,234.56".
 * Customer-facing only — never pass internal cost/profit cents here.
 * Lives in the UI layer; the orchestrator lib does not export formatting.
 */
export function formatPriceCents(cents: number): string {
  const dollars = (Math.round(cents) / 100).toFixed(2);
  const [whole, dec] = dollars.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${dec}`;
}

export const BUILDER_SECTIONS: { id: string; label: string; description: string }[] = [
  { id: "overview", label: "Overview", description: "Template preview and measurement summary" },
  { id: "options", label: "Options", description: "Standard / Enhanced / Premium tabs" },
  { id: "sections", label: "Sections", description: "Template sections for selected option" },
  { id: "lines", label: "Line items", description: "Read-only proposal line rows" },
  { id: "quantities", label: "Quantities", description: "Quantity resolver — coming in 3H-3" },
];

export function builderGateLinkHref(gate: ProposalBuilderGate, jobId: string | null): string | null {
  switch (gate) {
    case "missing_job":
    case "invalid_job":
      return "/tools/roofing/saved";
    case "measurement_not_ready":
      return jobId ? `/tools/roofing?entry=job-card&job=${encodeURIComponent(jobId)}` : null;
    case "catalog_not_ready":
      return "/tools/roofing/catalog";
    case "template_not_ready":
      return "/tools/roofing/templates";
    default:
      return null;
  }
}

export function builderGateLinkLabel(gate: ProposalBuilderGate): string {
  switch (gate) {
    case "missing_job":
    case "invalid_job":
      return "Open Job Board";
    case "measurement_not_ready":
      return "Back to Job Card measurements";
    case "catalog_not_ready":
      return "Open catalog setup";
    case "template_not_ready":
      return "Open proposal templates";
    default:
      return "Continue setup";
  }
}
