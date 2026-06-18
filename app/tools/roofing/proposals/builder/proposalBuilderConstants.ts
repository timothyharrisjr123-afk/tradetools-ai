import type { ProposalBuilderGate } from "@/app/lib/proposalBuilderReadiness";

export const BUILDER_CARD =
  "rounded-md border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const BUILDER_HERO_CARD =
  "rounded-lg border border-slate-200/90 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]";

export const BUILDER_BLOCKED_BANNER =
  "rounded-lg border border-amber-200/90 bg-amber-50/70 px-5 py-5";

export const BUILDER_SHELL_BANNER =
  "rounded-md border border-cyan-200/80 bg-cyan-50/60 px-4 py-3 text-sm text-cyan-950";

/** Shared horizontal stage width — header, alert, page strip, and builder grid align to these edges. */
export const BUILDER_STAGE = "w-full max-w-[1640px]";

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
  "Read-only preview — pricing, PDF, send, signature, and payment come later.";

/** 3J4A — full-width page context strip. */
export const BUILDER_PAGE_STRIP =
  "flex min-h-[3.75rem] w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200/90 bg-white px-4 shadow-[0_8px_24px_rgba(15,23,42,0.07),0_1px_3px_rgba(15,23,42,0.06)] [&::-webkit-scrollbar]:h-1";

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

/** 3J4A — main proposal canvas shell (internal bands carry padding). */
export const BUILDER_CANVAS =
  "w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.10),0_2px_8px_rgba(15,23,42,0.06)]";

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
  "relative flex min-h-[11.75rem] flex-col rounded-lg border px-5 py-4 text-left transition duration-200";

/** 3J4B flow-focus: lower-dominance package card once a package is selected and pricing is blocked. */
export const BUILDER_PACKAGE_CARD_COMPACT =
  "relative flex min-h-[8.25rem] flex-col rounded-lg border px-4 py-3 text-left transition duration-200";

export const BUILDER_PACKAGE_CARD_IDLE =
  "border-slate-200/90 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.055),0_1px_3px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]";

export const BUILDER_PACKAGE_CARD_SELECTED =
  "border-2 border-blue-500 bg-gradient-to-b from-blue-50/80 to-white shadow-[0_14px_30px_rgba(37,99,235,0.16),0_2px_6px_rgba(37,99,235,0.10)] ring-1 ring-blue-200/80";

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
  BUILDER_PAGE_EDIT_HELPER_COPY,
  BUILDER_PAGE_EDIT_MERGE_PREVIEW_LABEL,
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

/** Guardrail outcome → display word (informational only). */
export function formatGuardrailOutcomeLabel(outcome: "pass" | "warn" | "block"): string {
  switch (outcome) {
    case "pass":
      return "Pass";
    case "warn":
      return "Warning";
    case "block":
      return "Blocked";
    default:
      return "Blocked";
  }
}

/** 3I-3D1 — Builder right-rail group headings (Setup readiness / Pricing confidence). */
export const BUILDER_RAIL_GROUP_HEADING =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-600";

export const BUILDER_RAIL_SETUP_READINESS_TITLE = "Setup readiness";

export const BUILDER_RAIL_PRICING_CONFIDENCE_TITLE = "Pricing readiness";

export const BUILDER_RAIL_PRICING_STATUS_LABEL = "Pricing status";

export const BUILDER_RAIL_BLOCKING_LINES_LABEL = "Blocking";

export const BUILDER_RAIL_GUARDRAIL_LABEL = "Guardrail";

export const BUILDER_GUARDRAIL_STATUS_CHECKING = "Checking…";

export const BUILDER_GUARDRAIL_MESSAGE_WARN = "Review before send.";

export const BUILDER_GUARDRAIL_MESSAGE_BLOCK = "Resolve blocking issues first.";

export const BUILDER_GUARDRAIL_MESSAGE_CHECKING = "Checking…";

export const BUILDER_RAIL_ACTIONS_NOTE =
  "Preview, Send, Sign, and Payment remain disabled until record/snapshot phases.";

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
  checking: boolean
): string | null {
  if (checking) return BUILDER_GUARDRAIL_MESSAGE_CHECKING;
  switch (outcome) {
    case "warn":
      return BUILDER_GUARDRAIL_MESSAGE_WARN;
    case "block":
      return BUILDER_GUARDRAIL_MESSAGE_BLOCK;
    default:
      return null;
  }
}

export function guardrailRailStatusLabel(
  outcome: "pass" | "warn" | "block" | null,
  checking: boolean
): string {
  if (checking) return BUILDER_GUARDRAIL_STATUS_CHECKING;
  if (outcome == null) return BUILDER_GUARDRAIL_STATUS_CHECKING;
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
  "Preview totals reflect your saved company pricing. Estimates only — not a sent quote.";

export const BUILDER_TOTALS_FOOTNOTE_PLACEHOLDER_COPY =
  "Final pricing requires your company's saved pricing configuration. Preview totals are estimates only.";

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
