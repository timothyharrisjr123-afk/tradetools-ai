import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";

export const MONEY_UNAVAILABLE_LABEL = "Unavailable" as const;

/** Formats an already-computed amount. Performs no arithmetic. */
export function formatMoneyRowValue(
  cents: number | null | undefined,
  format: "amount" | "delta" = "amount",
  unknownLabel: string = MONEY_UNAVAILABLE_LABEL
): string {
  if (cents == null || !Number.isFinite(cents)) return unknownLabel;
  if (format === "delta") {
    if (cents === 0) return formatUsdFromCents(0);
    const abs = formatUsdFromCents(Math.abs(cents));
    return cents > 0 ? `+${abs}` : `−${abs}`;
  }
  return formatUsdFromCents(cents);
}

export default function MoneyRow({
  label,
  cents,
  format = "amount",
  unknownLabel,
  emphasis = false,
  hint,
  ...data
}: {
  label: string;
  cents: number | null | undefined;
  format?: "amount" | "delta";
  unknownLabel?: string;
  emphasis?: boolean;
  hint?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  const unknown = cents == null || !Number.isFinite(cents);
  return (
    <div
      className={`flex items-start justify-between gap-3 ${emphasis ? "border-t border-slate-200 pt-2" : ""}`}
      {...data}
    >
      <dt className={emphasis ? "text-slate-800" : "text-slate-500"}>
        {label}
        {hint ? (
          <span className="block text-[13px] font-normal text-slate-400">
            {hint}
          </span>
        ) : null}
      </dt>
      <dd
        className={`shrink-0 whitespace-nowrap text-right ${
          unknown
            ? "font-medium text-slate-500"
            : emphasis
              ? "font-semibold text-slate-950"
              : "font-semibold text-slate-900"
        }`}
      >
        {formatMoneyRowValue(cents, format, unknownLabel)}
      </dd>
    </div>
  );
}
