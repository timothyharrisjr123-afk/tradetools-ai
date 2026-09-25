/**
 * Semantic tones. Success is for confirmed outcomes only; warning is for real
 * risk only. Loading is always neutral.
 */
export type UiTone = "neutral" | "info" | "success" | "warning" | "error";

export const BADGE_TONE: Record<UiTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-800",
};

export const NOTICE_TONE: Record<UiTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  info: "border-blue-200 bg-blue-50 text-blue-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200/80 bg-amber-50/40 text-slate-800",
  error: "border-red-200 bg-red-50/60 text-red-900",
};

/** Localized semantic cue for notices whose surface stays calm. */
export const NOTICE_ICON_TONE: Partial<Record<UiTone, string>> = {
  warning: "text-amber-600",
  error: "text-red-600",
};
