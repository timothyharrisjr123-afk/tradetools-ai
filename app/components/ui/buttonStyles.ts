/**
 * FieldDive button system.
 *
 * - `primary`: contractor forward action (dark slate).
 * - `commit`: customer commitment / payment action (blue).
 * - `secondary`: bordered neutral action.
 * - `quiet`: text-weight action that must not compete with a primary.
 * - `danger`: destructive action (red), always behind a confirmation.
 *
 * Disabled is one treatment for every variant.
 */

export type ButtonVariant = "primary" | "commit" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed";

export const BUTTON_DISABLED =
  "disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none";

const VARIANT: Record<ButtonVariant, string> = {
  primary: `border border-slate-900 bg-slate-900 text-white shadow-sm hover:bg-slate-800 ${BUTTON_DISABLED}`,
  commit: `border border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700 ${BUTTON_DISABLED}`,
  secondary: `border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 ${BUTTON_DISABLED}`,
  quiet:
    "border border-transparent bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:text-slate-400",
  danger: `border border-red-600 bg-white text-red-700 hover:bg-red-50 ${BUTTON_DISABLED}`,
};

const SIZE: Record<ButtonSize, string> = {
  md: "px-4 text-sm",
  sm: "px-3 text-[13px]",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  options: { size?: ButtonSize; fullWidth?: boolean; className?: string } = {}
): string {
  const size = options.size ?? "md";
  return [
    BASE,
    VARIANT[variant],
    SIZE[size],
    options.fullWidth ? "w-full" : "",
    options.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}
