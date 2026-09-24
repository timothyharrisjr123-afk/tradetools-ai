/** Neutral loading line. Never styled as a warning and never shows empty copy. */
export default function LoadingState({
  label = "Loading…",
  className,
  ...data
}: {
  label?: string;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 text-sm text-slate-500 ${className ?? ""}`}
      {...data}
    >
      <span
        aria-hidden
        className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500"
      />
      {label}
    </p>
  );
}
