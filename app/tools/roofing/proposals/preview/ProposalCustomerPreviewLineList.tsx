"use client";

import type { CustomerPreviewEstimateLine } from "@/app/lib/proposalCustomerEstimatePresenter";

type ProposalCustomerPreviewLineListProps = {
  lines: CustomerPreviewEstimateLine[];
  /** Softer row treatment for optional upgrades (unsupported in Preview — kept for type compat). */
  variant?: "scope" | "upgrade";
};

/**
 * Block 5 Roofr-first — itemized customer-safe estimate rows.
 * Item + value only. No edit actions, menus, or contractor labels.
 */
export default function ProposalCustomerPreviewLineList({
  lines,
}: ProposalCustomerPreviewLineListProps) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/80">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-b border-slate-200/80 bg-slate-50/80 px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Item
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Price
        </span>
      </div>
      <ul className="divide-y divide-slate-100 bg-white">
        {lines.map((line) => (
          <li
            key={line.templateItemId}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3"
            data-preview-estimate-line
          >
            <p className="min-w-0 text-[15px] font-medium leading-snug text-slate-900">
              {line.name}
            </p>
            {line.valueLabel != null ? (
              <p
                className={
                  line.kind === "priced"
                    ? "shrink-0 text-right text-[15px] font-semibold tabular-nums text-slate-950"
                    : "shrink-0 text-right text-[13px] font-medium text-slate-600"
                }
              >
                {line.valueLabel}
              </p>
            ) : (
              <span className="shrink-0" aria-hidden />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
