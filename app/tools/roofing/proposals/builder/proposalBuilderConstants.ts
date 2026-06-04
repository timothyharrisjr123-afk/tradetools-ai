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

export const BUILDER_SECTIONS: { id: string; label: string; description: string }[] = [
  { id: "overview", label: "Overview", description: "Builder shell preview" },
  { id: "options", label: "Options", description: "Standard / Enhanced / Premium — coming in 3H-2" },
  { id: "sections", label: "Sections", description: "Template sections — coming in 3H-2" },
  { id: "lines", label: "Line items", description: "Read-only line table — coming in 3H-2" },
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
