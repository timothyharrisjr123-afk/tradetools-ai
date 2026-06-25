/**
 * R18C4B — Public proposal page styling tokens.
 *
 * Document-first customer surface; independent of Builder/Preview chrome.
 */

export const PUBLIC_PROPOSAL_PAGE =
  "mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10";

export const PUBLIC_PROPOSAL_STACK = "space-y-6 sm:space-y-8";

export const PUBLIC_PROPOSAL_CARD =
  "overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]";

export const PUBLIC_PROPOSAL_CARD_INNER = "px-5 py-6 sm:px-7 sm:py-7";

export const PUBLIC_PROPOSAL_SECTION_LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export const PUBLIC_PROPOSAL_PAGE_TITLE =
  "text-xl font-semibold tracking-tight text-slate-950 sm:text-[1.35rem]";

export const PUBLIC_PROPOSAL_BODY = "whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700";

export const PUBLIC_PROPOSAL_STATUS_PILL =
  "inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600";

export const PUBLIC_PROPOSAL_DEFERRED_ACTION =
  "flex w-full flex-col gap-1 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3.5 text-left opacity-80";

export const PUBLIC_PROPOSAL_ACCENT_BAR = "h-1.5 w-full shrink-0";

export type PublicProposalAccentTone = "standard" | "enhanced" | "premium" | "default";

export function publicProposalAccentBorderClass(accent: PublicProposalAccentTone): string {
  switch (accent) {
    case "standard":
      return "border-slate-300";
    case "enhanced":
      return "border-blue-300";
    case "premium":
      return "border-violet-300";
    default:
      return "border-slate-200";
  }
}

export function publicProposalAccentBadgeClass(accent: PublicProposalAccentTone): string {
  switch (accent) {
    case "standard":
      return "bg-slate-100 text-slate-700";
    case "enhanced":
      return "bg-blue-50 text-blue-800";
    case "premium":
      return "bg-violet-50 text-violet-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
