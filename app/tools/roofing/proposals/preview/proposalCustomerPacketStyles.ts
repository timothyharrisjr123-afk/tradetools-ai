/**
 * Block 5C elevate — "Roofing Proposal Sales Packet" design tokens.
 *
 * Preview-only visual language for a customer-facing sales proposal.
 * Deliberately does NOT import from `proposalBuilderConstants.ts`.
 * Pure string tokens — no React, DB, or pricing logic.
 */

/** Soft desk wash behind the packet. */
export const PACKET_PAGE_BACKGROUND =
  "bg-gradient-to-b from-slate-200/70 via-slate-100 to-slate-200/50";

/** Centered proposal reading width. */
export const PACKET_STAGE = "mx-auto w-full max-w-5xl px-4 sm:px-6";

/** Single outer elevation — the one paper surface. */
export const PACKET_PAPER =
  "overflow-hidden rounded-2xl bg-white shadow-[0_28px_70px_rgba(15,23,42,0.12),0_4px_14px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05]";

/** Shared horizontal padding for packet zones. */
export const PACKET_SECTION_PAD = "px-6 sm:px-10 lg:px-12";

/** Quiet hairline between major zones (used sparingly). */
export const PACKET_DIVIDER = "border-t border-slate-200/80";

/* ── Brand cover band (solid brand color, white type) ── */

export const PACKET_BRAND_BAND = "relative overflow-hidden";

export const PACKET_BRAND_BAND_INNER =
  `${PACKET_SECTION_PAD} flex flex-col gap-4 pb-7 pt-7 sm:flex-row sm:items-center sm:justify-between sm:gap-8`;

export const PACKET_BRAND_NAME =
  "text-[1.05rem] font-semibold tracking-tight text-white sm:text-[1.15rem]";

export const PACKET_BRAND_CONTACT = "text-[13px] leading-relaxed text-white/80";

export const PACKET_BRAND_MONOGRAM =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold tracking-wide shadow-sm";

/* ── Proposal hero (below brand band) ── */

export const PACKET_HERO_PANEL = `${PACKET_SECTION_PAD} bg-slate-50/90 pb-9 pt-8 sm:pb-10 sm:pt-9`;

export const PACKET_HERO_EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";

export const PACKET_HERO_TITLE =
  "mt-2 text-[2.1rem] font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-[2.55rem]";

export const PACKET_HERO_META = "mt-3 text-[13.5px] leading-relaxed text-slate-500";

export const PACKET_HERO_PREPARED_BY = "mt-1.5 text-[13px] text-slate-500";

/* ── Prepared for / Project info tiles ── */

export const PACKET_INFO_GRID = "mt-7 grid gap-3 sm:grid-cols-2 sm:gap-4";

export const PACKET_INFO_TILE =
  "rounded-xl border border-slate-200/80 border-l-[3px] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]";

export const PACKET_INFO_LABEL =
  "text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400";

export const PACKET_INFO_VALUE = "mt-1.5 text-[15px] font-semibold leading-snug text-slate-900";

export const PACKET_INFO_DETAIL = "mt-0.5 text-[13px] leading-relaxed text-slate-500";

/* ── Featured package recommendation ── */

export const PACKET_PACKAGE_PANEL =
  `${PACKET_SECTION_PAD} relative border-y border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-blue-50/50 py-8 sm:py-9`;

export const PACKET_PACKAGE_KICKER =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700/80";

export const PACKET_PACKAGE_NAME =
  "mt-2 text-[1.55rem] font-semibold tracking-tight text-slate-950 sm:text-[1.75rem]";

export const PACKET_PACKAGE_DESCRIPTION =
  "mt-2 max-w-xl text-[15px] leading-relaxed text-slate-600";

export const PACKET_PACKAGE_INCLUDES_LABEL =
  "mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400";

export const PACKET_PACKAGE_INCLUDE_ITEM =
  "flex items-start gap-2.5 text-[14.5px] font-medium leading-snug text-slate-800";

export const PACKET_PACKAGE_CHECK =
  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white";

export const PACKET_TOTAL_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400";

export const PACKET_TOTAL_VALUE =
  "mt-1 text-[1.85rem] font-semibold tabular-nums tracking-tight text-slate-950";

/* ── Trust / scope bridge ── */

export const PACKET_TRUST_PANEL = `${PACKET_SECTION_PAD} py-6`;

export const PACKET_TRUST_COPY =
  "rounded-xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-[14.5px] leading-relaxed text-slate-600";

/* ── Included estimate (sales table) ── */

export const PACKET_ESTIMATE_PANEL = `${PACKET_SECTION_PAD} pb-9 pt-2`;

export const PACKET_ESTIMATE_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";

export const PACKET_ESTIMATE_HEADING =
  "mt-1.5 text-[1.25rem] font-semibold tracking-tight text-slate-950";

export const PACKET_ESTIMATE_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[minmax(0,1.4fr)_5.5rem_7rem] sm:gap-x-4";

export const PACKET_ESTIMATE_HEADER_ROW =
  `${PACKET_ESTIMATE_GRID} rounded-t-lg bg-slate-900 px-4 py-2.5 text-white`;

export const PACKET_ESTIMATE_HEADER_CELL =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75";

export const PACKET_ESTIMATE_ROW =
  `${PACKET_ESTIMATE_GRID} border-b border-slate-100 px-4 py-3 last:border-b-0`;

export const PACKET_ESTIMATE_ROW_ALT = "bg-slate-50/70";

export const PACKET_ESTIMATE_ITEM_NAME =
  "text-[15px] font-semibold leading-snug text-slate-900";

export const PACKET_ESTIMATE_QTY =
  "text-[13.5px] tabular-nums text-slate-500 sm:text-right";

export const PACKET_ESTIMATE_PRICE =
  "text-[15.5px] font-semibold tabular-nums tracking-tight text-slate-950 sm:text-right";

export const PACKET_ESTIMATE_STATUS =
  "text-[13px] font-medium text-slate-500 sm:text-right";

export const PACKET_ESTIMATE_TABLE_SHELL =
  "mt-5 overflow-hidden rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)]";

/* ── Totals footer ── */

export const PACKET_TOTALS_BAND =
  "mt-0 border-t border-slate-200 bg-slate-50/90 px-4 py-4";

export const PACKET_TOTALS_ROW = "flex items-baseline justify-between gap-4 py-0.5";

export const PACKET_TOTALS_LABEL = "text-[13.5px] text-slate-500";

export const PACKET_TOTALS_VALUE = "text-[13.5px] tabular-nums text-slate-700";

export const PACKET_TOTALS_GRAND_LABEL = "text-[15px] font-semibold text-slate-900";

export const PACKET_TOTALS_GRAND_VALUE =
  "text-[1.55rem] font-semibold tabular-nums tracking-tight text-slate-950";

/* ── Content sections ── */

export const PACKET_CONTENT_PANEL = `${PACKET_SECTION_PAD} pb-9 pt-8`;

export const PACKET_CONTENT_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";

export const PACKET_CONTENT_TITLE =
  "mt-1.5 text-[1.2rem] font-semibold tracking-tight text-slate-950";

export const PACKET_CONTENT_BODY = "mt-4 text-[15px] leading-relaxed text-slate-600";

export const PACKET_FOOTER =
  `${PACKET_SECTION_PAD} border-t border-slate-100 pb-7 pt-5 text-[12px] leading-relaxed text-slate-400`;
