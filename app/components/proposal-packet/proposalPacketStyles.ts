/**
 * Premium proposal packet design tokens.
 */
export const PACKET_NAVY = "#061a33";
export const PACKET_BLUE = "#2563eb";
export const PACKET_GOLD = "#b8873b";
export const PACKET_PAGE_BG = "#eef3f8";

export const PROPOSAL_PACKET_PAGE =
  "mx-auto w-full bg-[#eef3f8] px-3 py-4 sm:px-6 sm:py-7 lg:px-8 lg:py-8";

export const PROPOSAL_PACKET_SHELL =
  "mx-auto w-full max-w-[1220px] overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-[0_22px_64px_rgba(6,26,51,0.11),0_4px_12px_rgba(6,26,51,0.05)]";

export const PROPOSAL_PACKET_TOP_BAR =
  "flex min-h-[76px] flex-col gap-3 border-b border-[#e2e8f0] bg-white px-8 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-10";

export const PROPOSAL_PACKET_TOP_BAR_MARK =
  "flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[10px]";

export const PROPOSAL_PACKET_TOP_BAR_ACTION =
  "inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#334155]";

export const PROPOSAL_PACKET_HERO_GRID =
  "grid bg-white lg:min-h-[380px] lg:grid-cols-[55%_45%]";

export const PROPOSAL_PACKET_HERO_LEFT =
  "relative z-10 flex flex-col justify-center bg-white px-8 py-8 sm:px-9 lg:px-10 lg:py-9";

export const PROPOSAL_PACKET_HERO_MEDIA_COLUMN =
  "relative min-h-[220px] bg-[#061a33] lg:min-h-full";

export const PROPOSAL_PACKET_HERO_MEDIA_CLIP =
  "relative h-full overflow-hidden lg:[clip-path:polygon(11%_0,100%_0,100%_100%,0_100%)]";

export const PROPOSAL_PACKET_HERO_VISUAL =
  "relative h-full min-h-[220px] bg-[#061a33] lg:min-h-full";

export const PROPOSAL_PACKET_EYEBROW =
  "text-[11px] font-bold uppercase tracking-[0.16em] text-[#2563eb]";

export const PROPOSAL_PACKET_HERO_TITLE =
  "mt-2.5 text-[2.25rem] font-bold leading-[1.05] tracking-[-0.035em] text-[#0f172a] sm:text-[2.65rem] lg:text-[2.85rem]";

export const PROPOSAL_PACKET_HERO_LEAD =
  "mt-3 max-w-[29rem] text-[14px] leading-[1.65] text-[#475569] sm:text-[15px]";

export const PROPOSAL_PACKET_TRUST_BAND =
  "bg-[#061a33] px-8 py-5 text-white lg:px-10";

export const PROPOSAL_PACKET_DECISION_SECTION =
  "px-8 py-7 lg:px-10 lg:py-8";

export const PROPOSAL_PACKET_DECISION_ROW =
  "mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(300px,0.88fr)] lg:items-start";

export const PROPOSAL_PACKET_COMPARE_ROW =
  "grid gap-3.5 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(252px,0.9fr)] lg:items-stretch";

export const PROPOSAL_PACKET_SECTION =
  "px-8 py-7 lg:px-10";

export const PROPOSAL_PACKET_SECTION_COMPACT =
  "px-8 py-6 lg:px-10";

export const PROPOSAL_PACKET_DETAILS_SECTION =
  "border-t border-[#e2e8f0] bg-[#f4f7fb] px-8 pb-9 pt-8 lg:px-10 lg:pb-10 lg:pt-9";

export const PROPOSAL_PACKET_CLOSEOUT_GRID =
  "grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8 lg:items-start";

export const PROPOSAL_PACKET_CLOSEOUT_CARD =
  "flex h-full flex-col overflow-hidden rounded-[16px] border border-[#e2e8f0]/90 bg-white shadow-[0_6px_24px_rgba(6,26,51,0.05)]";

/** Split closeout shell — contact + next steps share one card */
export const PROPOSAL_PACKET_CLOSEOUT_COMBO =
  "overflow-hidden rounded-[16px] border border-[#e2e8f0]/90 bg-white shadow-[0_8px_32px_rgba(6,26,51,0.06)]";

export const PROPOSAL_PACKET_CLOSEOUT_COMBO_GRID =
  "grid divide-y divide-[#eef2f6] md:grid-cols-2 md:divide-x md:divide-y-0";

export const PROPOSAL_PACKET_CLOSEOUT_COMBO_PANEL =
  "flex min-w-0 flex-col";

export const PROPOSAL_PACKET_CLOSEOUT_PANEL_HEADER =
  "border-b border-[#eef2f6] bg-[#fafbfd] px-5 py-2.5";

export const PROPOSAL_PACKET_CLOSEOUT_PANEL_TITLE =
  "text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748b]";

/** Standalone closeout card (legacy fallback) */
export const PROPOSAL_PACKET_CLOSEOUT_STANDALONE_CARD =
  "w-full overflow-hidden rounded-[16px] border border-[#e2e8f0]/90 bg-white shadow-[0_6px_24px_rgba(6,26,51,0.05)]";

export const PROPOSAL_PACKET_CLOSEOUT_CONTACT_BODY =
  "px-5 py-4 sm:px-5 sm:py-4";

export const PROPOSAL_PACKET_CLOSEOUT_CONTACT_BODY_COMPACT =
  "px-5 py-3.5 sm:px-5 sm:py-4";

export const PROPOSAL_PACKET_CLOSEOUT_NEXT_BODY =
  "px-5 py-4 sm:px-5 sm:py-4";

/** @deprecated Use PROPOSAL_PACKET_CLOSEOUT_COMBO */
export const PROPOSAL_PACKET_CLOSEOUT_PAIR_GRID =
  "flex w-full flex-col gap-3.5";

/** @deprecated Use PROPOSAL_PACKET_CLOSEOUT_STANDALONE_CARD */
export const PROPOSAL_PACKET_CLOSEOUT_PANEL = PROPOSAL_PACKET_CLOSEOUT_STANDALONE_CARD;

export const PROPOSAL_PACKET_DETAILS_TAB_ROW =
  "flex gap-1 overflow-x-auto rounded-xl bg-[#eef2f6] p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export const PROPOSAL_PACKET_DETAILS_CARD =
  "flex flex-col overflow-hidden rounded-[16px] border border-[#e2e8f0]/90 bg-white shadow-[0_6px_24px_rgba(6,26,51,0.05)]";

export const PROPOSAL_PACKET_DETAILS_CARD_ACCENT =
  "border-l-[3px] border-l-[#061a33]";

export const PROPOSAL_PACKET_DETAILS_ICON_TILE =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#061a33]/[0.06] text-[#061a33]";

export const PROPOSAL_PACKET_DETAILS_CHIP =
  "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 sm:px-3 sm:text-[12px]";

export const PROPOSAL_PACKET_DETAILS_CHIP_DISABLED =
  "shrink-0 cursor-default rounded-lg bg-[#eef2f6]/55 px-2.5 py-1.5 text-[11px] font-semibold text-[#94a3b8]/80 ring-1 ring-[#e8edf3]/70 sm:px-3 sm:text-[12px]";

export const PROPOSAL_PACKET_DETAILS_SECTION_LABEL =
  "text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748b]";

export const PROPOSAL_PACKET_CONTACT_ROW =
  "group flex items-start gap-3 py-2.5 sm:gap-3.5";

export const PROPOSAL_PACKET_CONTACT_ROW_LINK =
  "group flex items-start gap-3 py-2.5 transition-colors hover:bg-[#fafbfd] sm:gap-3.5";

export const PROPOSAL_PACKET_CONTACT_ROWS =
  "flex flex-col gap-1";

export const PROPOSAL_PACKET_CONTACT_ICON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#061a33] text-white shadow-[0_2px_6px_rgba(6,26,51,0.12)]";

export const PROPOSAL_PACKET_CONTACT_VALUE =
  "mt-0.5 block text-[13px] font-semibold leading-snug text-[#0f172a] [overflow-wrap:anywhere]";

export const PROPOSAL_PACKET_CONTACT_VALUE_LINK =
  "mt-0.5 block text-[13px] font-semibold leading-snug text-[#0f172a] [overflow-wrap:anywhere] group-hover:text-[#2563eb]";

export const PROPOSAL_PACKET_CONTACT_COMPANY =
  "text-[15px] font-bold leading-snug tracking-[-0.01em] text-[#0f172a]";

export const PROPOSAL_PACKET_CLOSEOUT_PANEL_HEADING =
  "text-[13px] font-bold tracking-tight text-[#0f172a]";

export const PROPOSAL_PACKET_CLOSEOUT_DIVIDER =
  "my-5 h-px bg-gradient-to-r from-transparent via-[#e2e8f0] to-transparent";

export const PROPOSAL_PACKET_NEXT_STEPS_TIMELINE =
  "relative space-y-0";

export const PROPOSAL_PACKET_NEXT_STEP_BADGE =
  "relative z-[1] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#061a33] text-[10px] font-bold text-white";

export const PROPOSAL_PACKET_NEXT_STEP_LINE =
  "absolute left-[8px] top-[18px] h-[calc(100%-6px)] w-px bg-[#e2e8f0]";

export const PROPOSAL_PACKET_NEXT_STEP_TEXT =
  "pt-0.5 text-[12px] leading-snug text-[#475569] [overflow-wrap:break-word]";

export const PROPOSAL_PACKET_NEXT_STEP_FOOTNOTE =
  "mt-3 rounded-lg bg-[#f4f7fb] px-3 py-2 text-[11px] leading-relaxed text-[#64748b]";

export const PROPOSAL_PACKET_SECTION_TITLE =
  "text-[1.3rem] font-bold tracking-[-0.02em] text-[#0f172a] sm:text-[1.45rem]";

export const PROPOSAL_PACKET_SECTION_INTRO =
  "mt-1 max-w-xl text-[13px] leading-relaxed text-[#64748b]";

export const PROPOSAL_PACKET_FIELD_LABEL =
  "block text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748b]";

export const PROPOSAL_PACKET_CURRENT_BADGE =
  "inline-flex items-center rounded-full border border-[#2563eb] bg-[#eff6ff] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#2563eb]";

export const PROPOSAL_PACKET_OPTION_CARD =
  "relative flex min-h-[288px] min-w-0 flex-col rounded-[14px] border border-[#e2e8f0] bg-white px-4 py-4 shadow-sm sm:px-[18px] sm:py-[18px]";

export const PROPOSAL_PACKET_OPTION_CARD_CURRENT =
  "relative flex min-h-[288px] min-w-0 flex-col rounded-[14px] border-2 border-[#2563eb] bg-gradient-to-b from-[#f8fbff] to-white px-4 py-4 shadow-[0_6px_20px_rgba(37,99,235,0.1)] sm:px-[18px] sm:py-[18px]";

export const PROPOSAL_PACKET_ABOUT_CARD =
  "flex min-h-[288px] min-w-0 flex-col rounded-[14px] border border-[#e2e8f0] bg-[#f1f5f9] px-4 py-4 shadow-sm sm:col-span-2 sm:px-[18px] sm:py-[18px] lg:col-span-1";

export const PROPOSAL_PACKET_UPGRADE_GROUP =
  "overflow-hidden rounded-[10px] border border-[#e2e8f0] bg-[#fafbfc] shadow-sm";

export const PROPOSAL_PACKET_UPGRADE_ROW =
  "flex min-h-[40px] items-center gap-2.5 px-3.5 py-2";

export const PROPOSAL_PACKET_TOTAL_SUMMARY =
  "rounded-[16px] border border-[#bfdbfe]/75 bg-gradient-to-br from-[#eff6ff] via-[#f7faff] to-white px-5 py-4 shadow-sm";

export const PROPOSAL_PACKET_INFO_CARD =
  "rounded-[12px] border border-[#e2e8f0] bg-white px-4 py-3.5 shadow-sm";

export const PROPOSAL_PACKET_FOOTER =
  "relative border-t-[3px] border-t-[#f2c879]/35 bg-[#061a33] px-8 py-5 text-white lg:px-10 lg:py-6";

export const PROPOSAL_PACKET_FOOTER_METADATA =
  "border-t border-[#e2e8f0] bg-[#eef2f6] px-8 py-2.5 text-[12px] text-[#64748b] lg:px-10";

export const PROPOSAL_PACKET_CARD =
  "rounded-[20px] border border-slate-200/80 bg-white shadow-[0_18px_44px_rgba(7,31,58,0.12)]";

export const PROPOSAL_PACKET_COVER_CARD =
  "rounded-[20px] border border-slate-200/60 bg-white shadow-[0_24px_60px_rgba(6,26,51,0.22),0_8px_22px_rgba(6,26,51,0.12)]";

export const PROPOSAL_PACKET_COVER_INVESTMENT =
  "text-[2.15rem] font-bold tabular-nums tracking-[-0.035em] text-[#0f172a] sm:text-[2.45rem]";

export const PROPOSAL_PACKET_INVESTMENT =
  "text-[2.35rem] font-bold tabular-nums tracking-[-0.035em] text-[#0f172a] sm:text-[2.75rem]";

export const PROPOSAL_PACKET_SECONDARY_PRICE =
  "shrink-0 font-bold tabular-nums text-[#0f172a]";

export const PROPOSAL_PACKET_BODY =
  "whitespace-pre-wrap text-[14px] leading-[1.6] text-[#475569]";

export const PROPOSAL_PACKET_DISCLOSURE =
  "inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2563eb]";

export const PROPOSAL_PACKET_SCOPE_TILE =
  "flex h-full min-h-[168px] flex-col items-center rounded-[18px] border border-[#e2e8f0] bg-gradient-to-b from-slate-50/90 to-white px-4 py-5 text-center shadow-sm";

export const PROPOSAL_PACKET_SCOPE_COUNT =
  "mt-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#071f3a]/10 px-2 text-[11px] font-semibold tabular-nums text-[#071f3a]";

/** @deprecated Legacy header — use PROPOSAL_PACKET_TOP_BAR */
export const PROPOSAL_PACKET_HEADER =
  "flex flex-col gap-4 border-b border-[#e2e8f0] bg-gradient-to-r from-white via-white to-slate-50/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-12";

/** @deprecated Legacy header action — use PROPOSAL_PACKET_TOP_BAR_ACTION */
export const PROPOSAL_PACKET_HEADER_ACTION =
  "inline-flex items-center gap-2 rounded-xl border border-[#dbe4ef] bg-white px-4 py-2.5 text-sm font-semibold text-[#94a3b8] shadow-sm";
