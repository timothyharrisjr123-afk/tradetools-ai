/**
 * Block 5C — "Premium Roofing Proposal Packet" design tokens.
 *
 * Preview-only visual language for the customer-facing proposal packet.
 * Deliberately does NOT import from `proposalBuilderConstants.ts` — Preview
 * must not borrow Builder's contractor-workspace visual chrome (cards, grids, kickers).
 * Pure string tokens — no React, DB, or pricing logic.
 */

/** Soft neutral wash behind the packet — reads as "paper on a desk". */
export const PACKET_PAGE_BACKGROUND =
  "bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100/70";

/** Centered reading width — a contained proposal packet, not a wide app stage. */
export const PACKET_STAGE = "mx-auto w-full max-w-5xl px-4 sm:px-6";

/** The single outer elevation in the whole customer document. */
export const PACKET_PAPER =
  "overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(15,23,42,0.10),0_2px_8px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.04]";

/** Shared horizontal padding for every packet zone — creates one aligned margin. */
export const PACKET_SECTION_PAD = "px-6 sm:px-10 lg:px-14";

/** Quiet structural separators between packet zones — never a card border. */
export const PACKET_DIVIDER = "border-t border-slate-200/70";

/** Company identity row (logo/monogram + name + quiet contact). */
export const PACKET_IDENTITY_NAME = "text-[15px] font-semibold tracking-tight text-slate-900";

export const PACKET_IDENTITY_CONTACT = "text-[13px] leading-relaxed text-slate-500";

/** The one unmistakable hero moment — largest, boldest text in the document. */
export const PACKET_HERO_TITLE =
  "text-[2rem] sm:text-[2.35rem] font-semibold leading-[1.1] tracking-tight text-slate-950";

export const PACKET_HERO_META = "text-[13px] text-slate-500";

/** Prepared for / Project quiet field labels. */
export const PACKET_INFO_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400";

export const PACKET_INFO_VALUE = "mt-1 text-[15px] font-medium leading-snug text-slate-800";

export const PACKET_INFO_DETAIL = "text-[13px] leading-relaxed text-slate-500";

/** Proposed package strip — a typographic band, not a card. */
export const PACKET_PACKAGE_KICKER =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";

export const PACKET_PACKAGE_NAME = "text-xl font-semibold tracking-tight text-slate-950";

export const PACKET_PACKAGE_DESCRIPTION = "text-[14px] leading-relaxed text-slate-600";

export const PACKET_PACKAGE_HIGHLIGHTS = "text-[13px] leading-snug text-slate-500";

export const PACKET_TOTAL_LABEL =
  "text-[11px] font-medium uppercase tracking-wide text-slate-400";

export const PACKET_TOTAL_VALUE =
  "text-2xl font-semibold tabular-nums tracking-tight text-slate-950";

/** Included estimate — quiet section label, never a builder-style kicker/chip. */
export const PACKET_ESTIMATE_LABEL =
  "text-[13px] font-semibold uppercase tracking-wide text-slate-500";

/** Estimate header/row grid — Item | Qty | Price, no action column. */
export const PACKET_ESTIMATE_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 sm:grid-cols-[minmax(0,1fr)_7rem_8rem]";

export const PACKET_ESTIMATE_HEADER_CELL =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-400";

export const PACKET_ESTIMATE_ITEM_NAME = "text-[15px] font-medium leading-snug text-slate-900";

export const PACKET_ESTIMATE_QTY = "text-[13px] tabular-nums text-slate-500 sm:text-right";

export const PACKET_ESTIMATE_PRICE =
  "text-[15px] font-semibold tabular-nums text-slate-950 sm:text-right";

export const PACKET_ESTIMATE_STATUS =
  "text-[12px] font-medium text-slate-500 sm:text-right";

/** Totals footer — reads as the estimate table's own footer, not a new card. */
export const PACKET_TOTALS_ROW = "flex items-baseline justify-between gap-4 py-0.5";

export const PACKET_TOTALS_LABEL = "text-[13px] text-slate-500";

export const PACKET_TOTALS_VALUE = "text-[13px] tabular-nums text-slate-700";

export const PACKET_TOTALS_GRAND_LABEL = "text-[16px] font-semibold text-slate-900";

export const PACKET_TOTALS_GRAND_VALUE =
  "text-[1.65rem] font-semibold tabular-nums tracking-tight text-slate-950";

/** Meaningful content sections (Project overview / Warranty / Terms / Scope notes). */
export const PACKET_CONTENT_LABEL =
  "text-[13px] font-semibold uppercase tracking-wide text-slate-500";

export const PACKET_CONTENT_BODY = "text-[15px] leading-relaxed text-slate-700";

/** Quiet packet footer — signals the end of the document. */
export const PACKET_FOOTER = "text-[12px] leading-relaxed text-slate-400";
