/**
 * Customer proposal content tokens for the contractor review surface.
 * Premium packet polish — not a PDF sheet, not toy cards.
 * Does NOT import Builder visual constants.
 */

export const PACKET_SECTION_PAD = "";

export const PACKET_DIVIDER = "border-t border-slate-100";

export const PACKET_ACCENT_RULE = "h-[2.5px] w-full shrink-0";

/* Company identity */
export const PACKET_IDENTITY_ROW =
  "flex flex-col gap-2.5 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between";

export const PACKET_IDENTITY_NAME =
  "text-[15px] font-semibold tracking-tight text-slate-900";

export const PACKET_IDENTITY_CONTACT = "text-[13px] leading-relaxed text-slate-500";

/* Title + prepared-for */
export const PACKET_HERO_PANEL = "pb-7 pt-7";

export const PACKET_HERO_EYEBROW =
  "text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600";

export const PACKET_HERO_TITLE =
  "mt-2 text-[1.75rem] font-semibold leading-[1.12] tracking-[-0.025em] text-slate-950 sm:text-[2.05rem]";

export const PACKET_HERO_META = "mt-2.5 text-[13px] leading-relaxed text-slate-500";

/* Balanced project snapshot band */
export const PACKET_INFO_GRID =
  "mt-6 grid gap-x-6 gap-y-5 rounded-2xl border border-slate-200/70 bg-[linear-gradient(180deg,#fbfcfe_0%,#f6f8fb_100%)] px-6 py-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-slate-200/70";

export const PACKET_INFO_CELL = "min-w-0 lg:px-6 lg:first:pl-0 lg:last:pr-0";

export const PACKET_INFO_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";

export const PACKET_INFO_VALUE =
  "mt-1.5 text-[15px] font-semibold leading-snug text-slate-900";

export const PACKET_INFO_DETAIL = "mt-1 text-[13px] leading-relaxed text-slate-500";

/* Selected package — document identity, not a recommendation */
export const PACKET_PACKAGE_PANEL = "py-2";

export const PACKET_PACKAGE_SURFACE =
  "relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-6 py-6 sm:px-7 sm:py-6";

export const PACKET_PACKAGE_KICKER =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600";

export const PACKET_PACKAGE_NAME =
  "mt-2 text-[1.4rem] font-semibold tracking-tight text-slate-950 sm:text-[1.5rem]";

export const PACKET_PACKAGE_DESCRIPTION =
  "mt-2 max-w-xl text-[14.5px] leading-relaxed text-slate-600";

export const PACKET_PACKAGE_INCLUDES_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500";

export const PACKET_PACKAGE_INCLUDE_ITEM =
  "flex items-start gap-2.5 text-[14px] font-medium leading-snug text-slate-800";

export const PACKET_PACKAGE_CHECK =
  "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-blue-600 text-white";

export const PACKET_TOTAL_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";

export const PACKET_TOTAL_VALUE =
  "mt-1 text-[1.5rem] font-semibold tabular-nums tracking-tight text-slate-950";

/* Premium estimate — framed price sheet */
export const PACKET_ESTIMATE_PANEL = "pb-2 pt-7";

export const PACKET_ESTIMATE_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";

export const PACKET_ESTIMATE_HEADING =
  "mt-1.5 text-[1.25rem] font-semibold tracking-tight text-slate-950";

export const PACKET_ESTIMATE_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 sm:grid-cols-[minmax(0,1fr)_6rem_8rem] sm:gap-x-8";

export const PACKET_ESTIMATE_TABLE_SHELL =
  "mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_-22px_rgba(15,23,42,0.5)]";

export const PACKET_ESTIMATE_HEADER_ROW =
  `${PACKET_ESTIMATE_GRID} border-b border-slate-200/80 bg-slate-50/90 px-5 py-3`;

export const PACKET_ESTIMATE_HEADER_CELL =
  "text-[10.5px] font-semibold uppercase tracking-[0.13em] text-slate-500";

export const PACKET_ESTIMATE_SECTION_HEADING =
  "bg-white px-5 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.13em] text-blue-600";

export const PACKET_ESTIMATE_ROW =
  `${PACKET_ESTIMATE_GRID} border-b border-slate-100 px-5 py-3.5 last:border-b-0`;

export const PACKET_ESTIMATE_ROW_ALT = "bg-slate-50/50";

export const PACKET_ESTIMATE_ITEM_NAME =
  "text-[15px] font-medium leading-snug text-slate-900";

export const PACKET_ESTIMATE_QTY =
  "text-[13.5px] tabular-nums text-slate-500 sm:text-right";

export const PACKET_ESTIMATE_PRICE =
  "text-[15px] font-semibold tabular-nums tracking-tight text-slate-950 sm:text-right";

export const PACKET_ESTIMATE_STATUS =
  "text-[13.5px] font-medium text-slate-500 sm:text-right";

export const PACKET_TOTALS_BAND =
  "border-t border-slate-200/80 bg-slate-50/70 px-5 py-4";

export const PACKET_TOTALS_ROW = "flex items-baseline justify-between gap-6 py-0.5";

export const PACKET_TOTALS_LABEL = "text-[13.5px] text-slate-500";

export const PACKET_TOTALS_VALUE = "text-[13.5px] tabular-nums text-slate-700";

export const PACKET_TOTALS_GRAND_LABEL = "text-[15px] font-semibold text-slate-900";

export const PACKET_TOTALS_GRAND_VALUE =
  "text-[1.4rem] font-semibold tabular-nums tracking-tight text-slate-950";

export const PACKET_CONTENT_PANEL = "py-7";

export const PACKET_CONTENT_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400";

export const PACKET_CONTENT_TITLE =
  "mt-1.5 text-[1.15rem] font-semibold tracking-tight text-slate-950";

export const PACKET_CONTENT_BODY = "mt-3.5 max-w-3xl text-[14.5px] leading-relaxed text-slate-600";

export const PACKET_FOOTER =
  "border-t border-slate-100 pt-4 text-[12px] leading-relaxed text-slate-400";

/** @deprecated */
export const PACKET_PAPER = "";
export const PACKET_PAGE_BACKGROUND = "";
export const PACKET_STAGE = "";
