/** Mobile inputs stay at 16px so iOS does not zoom; desktop drops to 14px. */
export const FORM_LABEL = "block space-y-1 text-sm";
export const FORM_LABEL_TEXT = "font-medium text-slate-700";
export const FORM_OPTIONAL = "font-normal text-slate-400";

export const FORM_INPUT =
  "block min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-100 disabled:text-slate-400 sm:text-sm";

export const FORM_TEXTAREA = `${FORM_INPUT} min-h-[88px]`;
