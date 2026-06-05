import type { ProposalBuilderGate } from "@/app/lib/proposalBuilderReadiness";

export const BUILDER_CARD =
  "rounded-md border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const BUILDER_HERO_CARD =
  "rounded-lg border border-slate-200/90 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]";

export const BUILDER_BLOCKED_BANNER =
  "rounded-lg border border-amber-200/90 bg-amber-50/70 px-5 py-5";

export const BUILDER_SHELL_BANNER =
  "rounded-md border border-cyan-200/80 bg-cyan-50/60 px-4 py-3 text-sm text-cyan-950";

export const BUILDER_SECTION_NAV_ITEM =
  "flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-medium transition-colors";

export const BUILDER_CANVAS_PLACEHOLDER =
  "flex min-h-[22rem] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center";

export const BUILDER_RAIL_STAT =
  "rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2.5";

export const BUILDER_DISABLED_ACTION =
  "inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-400 cursor-not-allowed";

export const BUILDER_OPTION_TAB =
  "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

export const BUILDER_OPTION_TAB_ACTIVE =
  "rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm";

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
