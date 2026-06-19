"use client";

import type { CustomerPreviewEstimateLine } from "@/app/lib/proposalCustomerEstimatePresenter";

type ProposalCustomerPreviewLineListProps = {
  lines: CustomerPreviewEstimateLine[];
  /** Softer row treatment for optional upgrades. */
  variant?: "scope" | "upgrade";
};

function valueClassName(kind: CustomerPreviewEstimateLine["kind"]): string {
  if (kind === "priced") {
    return "text-[15px] font-semibold tabular-nums text-slate-950";
  }
  return "inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[12px] font-medium text-slate-600";
}

export default function ProposalCustomerPreviewLineList({
  lines,
  variant = "scope",
}: ProposalCustomerPreviewLineListProps) {
  if (lines.length === 0) {
    return null;
  }

  const rowShell =
    variant === "upgrade"
      ? "rounded-lg border border-slate-200/70 bg-white px-4 py-3.5"
      : "rounded-lg border border-slate-100 bg-slate-50/40 px-4 py-3.5";

  return (
    <ul className="space-y-2.5">
      {lines.map((line) => (
        <li
          key={line.templateItemId}
          className={`${rowShell} flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6`}
        >
          <p className="min-w-0 text-[15px] font-medium leading-snug text-slate-900">
            {line.name}
          </p>
          <p className={`shrink-0 sm:text-right ${valueClassName(line.kind)}`}>
            {line.valueLabel}
          </p>
        </li>
      ))}
    </ul>
  );
}
