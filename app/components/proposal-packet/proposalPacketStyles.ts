/**
 * Approved FieldDive customer proposal — premium document tokens.
 * Final detail pass: richer finish without changing structure or length.
 */
export const PACKET_NAVY = "#0b1f33";
export const PACKET_BLUE = "#2563eb";
export const PACKET_PAGE_BG = "#e6edf5";

export const PROPOSAL_PACKET_PAGE =
  "mx-auto w-full bg-[linear-gradient(180deg,#e4ecf5_0%,#e9eef5_48%,#e6ebf2_100%)] px-3 py-4 sm:px-5 sm:py-6 lg:px-6 lg:py-7";

export const PROPOSAL_PACKET_SHELL =
  "mx-auto w-full max-w-[1120px] overflow-hidden rounded-[16px] border border-[#cfd9e6]/95 bg-white shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_20px_50px_rgba(11,31,51,0.10)]";

export const PROPOSAL_PACKET_TOP_BAR =
  "relative flex flex-col gap-2 bg-[#0b1f33] px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-7 lg:px-9 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[#2563eb]/55 after:to-transparent";

export const PROPOSAL_PACKET_TOP_BAR_MARK =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-white/15 bg-gradient-to-b from-white/15 to-white/[0.06] text-[13px] font-semibold tracking-[0.04em] text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]";

export const PROPOSAL_PACKET_TOP_BAR_ACTION =
  "inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/80";

/** Hero: intro left, decision card right — compact, premium. */
export const PROPOSAL_PACKET_HERO_GRID =
  "grid items-start gap-5 px-5 py-5 sm:px-7 sm:py-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)] lg:gap-7 lg:px-9 lg:py-6";

export const PROPOSAL_PACKET_HERO_LEFT =
  "relative flex min-w-0 flex-col justify-start border-l-2 border-[#2563eb]/35 pl-4 sm:pl-5";

export const PROPOSAL_PACKET_EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563eb]";

export const PROPOSAL_PACKET_HERO_TITLE =
  "mt-1.5 text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.038em] text-[#0b1f33] sm:text-[2.2rem]";

export const PROPOSAL_PACKET_HERO_LEAD =
  "mt-3 max-w-[26.5rem] text-[14px] leading-[1.58] text-[#546274]";

export const PROPOSAL_PACKET_STORY_SECTION =
  "border-t border-[#e6ebf1] px-5 py-5 sm:px-7 lg:px-9 lg:py-6";

export const PROPOSAL_PACKET_STORY_SECTION_MUTED =
  "border-t border-[#e6ebf1] bg-[#f5f8fb] px-5 py-5 sm:px-7 lg:px-9 lg:py-6";

export const PROPOSAL_PACKET_DECISION_SECTION = PROPOSAL_PACKET_STORY_SECTION;
export const PROPOSAL_PACKET_DECISION_ROW = "mt-3 grid gap-3";

/** Base compare grid — always single column below `sm`. */
export const PROPOSAL_PACKET_COMPARE_ROW_BASE = "grid items-stretch gap-3";

/** 2 options, or 4 options (2×2): two columns from `sm` up. */
export const PROPOSAL_PACKET_COMPARE_ROW_TWO =
  `${PROPOSAL_PACKET_COMPARE_ROW_BASE} sm:grid-cols-2`;

/** 3 options, or 5+ wrapping: two columns from `sm`, three from `lg`. */
export const PROPOSAL_PACKET_COMPARE_ROW_THREE =
  `${PROPOSAL_PACKET_COMPARE_ROW_BASE} sm:grid-cols-2 lg:grid-cols-3`;

/** @deprecated Prefer resolveProposalPacketCompareRowClass(optionCount). */
export const PROPOSAL_PACKET_COMPARE_ROW = PROPOSAL_PACKET_COMPARE_ROW_THREE;

/**
 * Count-aware comparison grid.
 * 1 → unused (comparison omitted upstream)
 * 2 → intentional 2-column
 * 3 → 3-column desktop
 * 4 → intentional 2×2
 * 5+ → durable 3-column wrap
 */
export function resolveProposalPacketCompareRowClass(optionCount: number): string {
  if (optionCount <= 2 || optionCount === 4) {
    return PROPOSAL_PACKET_COMPARE_ROW_TWO;
  }
  return PROPOSAL_PACKET_COMPARE_ROW_THREE;
}

export const PROPOSAL_PACKET_SECTION = PROPOSAL_PACKET_STORY_SECTION;
export const PROPOSAL_PACKET_SECTION_COMPACT =
  "border-t border-[#e6ebf1] px-5 py-5 sm:px-7 lg:px-9";

export const PROPOSAL_PACKET_DETAILS_SECTION =
  "border-t border-[#e6ebf1] px-5 py-5 sm:px-7 lg:px-9";

export const PROPOSAL_PACKET_CLOSEOUT_GRID = "grid gap-3 lg:grid-cols-2";

export const PROPOSAL_PACKET_CLOSEOUT_CARD =
  "rounded-[14px] border border-[#e2e8f0] bg-[#fbfcfe] px-4 py-3.5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_4px_14px_rgba(11,31,51,0.035)]";

export const PROPOSAL_PACKET_CLOSEOUT_TRUST =
  "mt-3 flex items-start gap-3 rounded-[14px] border border-[#cfe0f8] bg-[linear-gradient(135deg,#f7faff_0%,#eef5ff_100%)] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.85)_inset]";

export const PROPOSAL_PACKET_CLOSEOUT_COMBO =
  "overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white";

export const PROPOSAL_PACKET_CLOSEOUT_COMBO_GRID =
  "grid divide-y divide-[#eef2f6] md:grid-cols-2 md:divide-x md:divide-y-0";

export const PROPOSAL_PACKET_CLOSEOUT_COMBO_PANEL = "flex min-w-0 flex-col";
export const PROPOSAL_PACKET_CLOSEOUT_PANEL_HEADER =
  "border-b border-[#eef2f6] bg-[#f8fafc] px-4 py-2.5";
export const PROPOSAL_PACKET_CLOSEOUT_PANEL_TITLE =
  "text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]";
export const PROPOSAL_PACKET_CLOSEOUT_STANDALONE_CARD =
  "w-full overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white";
export const PROPOSAL_PACKET_CLOSEOUT_CONTACT_BODY = "px-4 py-3.5";
export const PROPOSAL_PACKET_CLOSEOUT_CONTACT_BODY_COMPACT = "px-4 py-3";
export const PROPOSAL_PACKET_CLOSEOUT_NEXT_BODY = "px-4 py-3.5";
export const PROPOSAL_PACKET_CLOSEOUT_PAIR_GRID = "flex w-full flex-col gap-3";
export const PROPOSAL_PACKET_CLOSEOUT_PANEL = PROPOSAL_PACKET_CLOSEOUT_STANDALONE_CARD;

export const PROPOSAL_PACKET_DETAILS_TAB_ROW = "flex flex-col gap-0";
export const PROPOSAL_PACKET_DETAILS_CARD =
  "overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white shadow-[0_2px_10px_rgba(11,31,51,0.03)]";
export const PROPOSAL_PACKET_DETAILS_CARD_ACCENT = "";
export const PROPOSAL_PACKET_DETAILS_ICON_TILE =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0b1f33]/[0.06] text-[#0b1f33]";
export const PROPOSAL_PACKET_DETAILS_CHIP =
  "shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold";
export const PROPOSAL_PACKET_DETAILS_CHIP_DISABLED =
  "shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-[#94a3b8]";
export const PROPOSAL_PACKET_DETAILS_SECTION_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]";

export const PROPOSAL_PACKET_CONTACT_ROW = "flex items-start gap-2.5 py-1";
export const PROPOSAL_PACKET_CONTACT_ROW_LINK =
  "flex items-start gap-2.5 py-1 transition-colors hover:text-[#2563eb]";
export const PROPOSAL_PACKET_CONTACT_ROWS = "flex flex-col";
export const PROPOSAL_PACKET_CONTACT_ICON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0b1f33] text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]";
export const PROPOSAL_PACKET_CONTACT_VALUE =
  "mt-0.5 block text-[13px] font-medium leading-snug text-[#0b1f33] [overflow-wrap:anywhere]";
export const PROPOSAL_PACKET_CONTACT_VALUE_LINK =
  "mt-0.5 block text-[13px] font-medium leading-snug text-[#0b1f33] [overflow-wrap:anywhere] hover:text-[#2563eb]";
export const PROPOSAL_PACKET_CONTACT_COMPANY =
  "text-[14px] font-semibold tracking-[-0.01em] text-[#0b1f33]";
export const PROPOSAL_PACKET_CLOSEOUT_PANEL_HEADING =
  "text-[13px] font-semibold text-[#0b1f33]";
export const PROPOSAL_PACKET_CLOSEOUT_DIVIDER = "my-2.5 h-px bg-[#e8edf3]";

export const PROPOSAL_PACKET_NEXT_STEPS_TIMELINE = "space-y-2";
export const PROPOSAL_PACKET_NEXT_STEP_BADGE =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0b1f33] text-[10px] font-semibold text-white";
export const PROPOSAL_PACKET_NEXT_STEP_LINE = "hidden";
export const PROPOSAL_PACKET_NEXT_STEP_TEXT =
  "text-[13px] leading-snug text-[#475569]";
export const PROPOSAL_PACKET_NEXT_STEP_FOOTNOTE =
  "mt-3 text-[12px] leading-relaxed text-[#64748b]";

export const PROPOSAL_PACKET_SECTION_TITLE =
  "text-[1.22rem] font-semibold tracking-[-0.028em] text-[#0b1f33] sm:text-[1.32rem]";

export const PROPOSAL_PACKET_SECTION_INTRO =
  "mt-1 max-w-2xl text-[13px] leading-relaxed text-[#64748b]";

export const PROPOSAL_PACKET_FIELD_LABEL =
  "block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#64748b]";

export const PROPOSAL_PACKET_OPTION_CARD =
  "relative flex h-full min-w-0 flex-col rounded-[14px] border border-[#e2e8f0] bg-white px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_4px_16px_rgba(11,31,51,0.04)]";

export const PROPOSAL_PACKET_ABOUT_CARD =
  "mt-3 text-[12px] leading-relaxed text-[#64748b]";

export const PROPOSAL_PACKET_UPGRADE_GROUP =
  "overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-white shadow-[0_2px_10px_rgba(11,31,51,0.03)]";

export const PROPOSAL_PACKET_UPGRADE_ROW =
  "flex min-h-[44px] items-center gap-3 px-3.5 py-2.5";

export const PROPOSAL_PACKET_TOTAL_SUMMARY =
  "rounded-[14px] bg-[#0b1f33] px-5 py-5 text-white";

export const PROPOSAL_PACKET_INFO_CARD =
  "rounded-[14px] border border-[#e2e8f0] bg-white px-4 py-3";

export const PROPOSAL_PACKET_FOOTER =
  "flex flex-col gap-2 border-t border-[#e6ebf1] bg-[#f4f7fb] px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-7 lg:px-9";

export const PROPOSAL_PACKET_FOOTER_METADATA =
  "border-t border-[#e6ebf1] bg-[#eef2f6] px-5 py-2 text-[12px] text-[#64748b] sm:px-7 lg:px-9";

export const PROPOSAL_PACKET_CARD =
  "rounded-[14px] border border-[#e2e8f0] bg-white";

export const PROPOSAL_PACKET_COVER_CARD =
  "rounded-[14px] border border-[#e2e8f0] bg-white";

export const PROPOSAL_PACKET_COVER_INVESTMENT =
  "text-[1.85rem] font-semibold tabular-nums tracking-[-0.035em] text-[#0b1f33]";

export const PROPOSAL_PACKET_INVESTMENT =
  "text-[2rem] font-semibold tabular-nums tracking-[-0.042em] text-[#0b1f33] sm:text-[2.2rem]";

export const PROPOSAL_PACKET_SECONDARY_PRICE =
  "shrink-0 font-semibold tabular-nums tracking-[-0.02em] text-[#0b1f33]";

export const PROPOSAL_PACKET_BODY =
  "whitespace-pre-wrap text-[13px] leading-relaxed text-[#475569]";

export const PROPOSAL_PACKET_DISCLOSURE =
  "inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-[#2563eb] [&::-webkit-details-marker]:hidden";

/** Roofing scope summaries — intentional, not generic tiles. */
export const PROPOSAL_PACKET_SCOPE_TILE =
  "flex h-full flex-col items-start rounded-[14px] border border-[#e2e8f0] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfd_100%)] px-3.5 py-3.5 text-left shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_3px_12px_rgba(11,31,51,0.04)]";

export const PROPOSAL_PACKET_SCOPE_ICON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[#0b1f33]/10 bg-[#0b1f33]/[0.06] text-[#0b1f33]";

export const PROPOSAL_PACKET_SCOPE_COUNT =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[#0b1f33]/8 bg-white px-1.5 text-[10px] font-semibold tabular-nums text-[#0b1f33]";

/** Shared focus ring for customer actions (keyboard visible). */
export const PROPOSAL_PACKET_CTA_FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2";

/** Primary customer action — min 44px usable target. */
export const PROPOSAL_PACKET_CTA_PRIMARY =
  `inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[#2563eb] px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_6px_16px_rgba(37,99,235,0.28)] transition-colors hover:bg-[#1d4ed8] ${PROPOSAL_PACKET_CTA_FOCUS}`;

/** Secondary customer action — min 44px usable target. */
export const PROPOSAL_PACKET_CTA_SECONDARY =
  `inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[#d5dee8] bg-white px-3.5 py-2.5 text-[13px] font-semibold text-[#0b1f33] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] transition-colors hover:border-[#bfdbfe] hover:bg-[#f8fbff] ${PROPOSAL_PACKET_CTA_FOCUS}`;

/**
 * Customer package choice. A selectable option is a genuine object, so the card
 * boundary and its button are earned rather than decorative.
 */
export const PROPOSAL_PACKET_OPTION_CARD_CHOSEN =
  "relative flex h-full min-w-0 flex-col rounded-[14px] border-2 border-[#2563eb] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_10px_28px_rgba(37,99,235,0.12)]";

export const PROPOSAL_PACKET_CHOICE_BADGE =
  "inline-flex items-center rounded-full bg-[#2563eb] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset]";

export const PROPOSAL_PACKET_CHOICE_BUTTON =
  `flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#d5dee8] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#0b1f33] transition-colors hover:border-[#93c5fd] hover:bg-[#f8fbff] ${PROPOSAL_PACKET_CTA_FOCUS}`;

export const PROPOSAL_PACKET_CHOICE_BUTTON_CHOSEN =
  `flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[10px] border-2 border-[#2563eb] bg-[#eff6ff] px-3 py-2.5 text-[13px] font-semibold text-[#1d4ed8] ${PROPOSAL_PACKET_CTA_FOCUS}`;

/**
 * The one dominant customer action. Full width so nothing competes with it.
 */
export const PROPOSAL_PACKET_CTA_PRIMARY_DOMINANT =
  `flex min-h-[52px] w-full items-center justify-center rounded-[12px] bg-[#2563eb] px-5 py-3 text-[15px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_10px_24px_rgba(37,99,235,0.30)] transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60 ${PROPOSAL_PACKET_CTA_FOCUS}`;

/** Quiet text-only customer action. Never competes with the primary. */
export const PROPOSAL_PACKET_CTA_TEXT_LINK =
  `inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-[#2563eb] underline-offset-4 transition-colors hover:text-[#1d4ed8] hover:underline ${PROPOSAL_PACKET_CTA_FOCUS}`;

/** Purchase composition — one decision surface, no nested cards inside it. */
export const PROPOSAL_PACKET_PURCHASE =
  "rounded-[16px] border border-[#dbe4ef] bg-[linear-gradient(180deg,#ffffff_0%,#f7fafd_100%)] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_30px_rgba(11,31,51,0.06)] sm:px-6 sm:py-6";

export const PROPOSAL_PACKET_PURCHASE_DIVIDER = "my-4 h-px bg-[#e6ecf3]";

export const PROPOSAL_PACKET_PURCHASE_DUE_AMOUNT =
  "text-[1.85rem] font-semibold tabular-nums tracking-[-0.04em] text-[#0b1f33] sm:text-[2.05rem]";

/** Sticky mobile purchase bar — presentation of the same primary action. */
export const PROPOSAL_PACKET_STICKY_BAR =
  "fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-[#dbe4ef] bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(11,31,51,0.10)] backdrop-blur lg:hidden";

/**
 * Quiet continuation request (closeout) — same label semantics as primary request,
 * but not visually equal to the hero primary. Still ≥44px.
 */
export const PROPOSAL_PACKET_CTA_CONTINUATION =
  `inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[#bfdbfe] bg-[#f8fbff] px-3.5 py-2.5 text-[13px] font-semibold text-[#2563eb] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] transition-colors hover:border-[#93c5fd] hover:bg-[#eff6ff] ${PROPOSAL_PACKET_CTA_FOCUS}`;

/**
 * Compare-card ask-about — proper tap target (not a tiny text link).
 * Keeps quieter hierarchy under package totals.
 */
export const PROPOSAL_PACKET_CTA_QUIET =
  `mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-[10px] border border-[#e2e8f0] bg-white px-3 text-[13px] font-semibold text-[#2563eb] transition-colors hover:border-[#bfdbfe] hover:bg-[#f8fbff] ${PROPOSAL_PACKET_CTA_FOCUS}`;

export const PROPOSAL_PACKET_HEADER =
  "flex flex-col gap-3 border-b border-[#e6ebf1] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-7";

export const PROPOSAL_PACKET_HEADER_ACTION =
  "inline-flex items-center gap-2 text-sm font-semibold text-[#94a3b8]";
