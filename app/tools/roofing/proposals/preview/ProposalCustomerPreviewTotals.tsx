"use client";

import type { CustomerPreviewEstimateTotalsPresentation } from "@/app/lib/proposalCustomerEstimatePresenter";
import { CUSTOMER_PREVIEW_ESTIMATE_TOTALS_PANEL } from "../builder/proposalBuilderConstants";

type ProposalCustomerPreviewTotalsProps = {
  totals: CustomerPreviewEstimateTotalsPresentation;
};

function TotalsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm tabular-nums text-slate-800">{value}</span>
    </div>
  );
}

export default function ProposalCustomerPreviewTotals({
  totals,
}: ProposalCustomerPreviewTotalsProps) {
  if (!totals.show) {
    return null;
  }

  return (
    <section className={CUSTOMER_PREVIEW_ESTIMATE_TOTALS_PANEL}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Investment summary
      </p>
      <div className="mt-4 space-y-1.5">
        {totals.subtotalLabel ? (
          <TotalsRow label="Subtotal" value={totals.subtotalLabel} />
        ) : null}
        {totals.discountLabel ? (
          <TotalsRow label="Discount" value={totals.discountLabel} />
        ) : null}
        {totals.taxLabel ? <TotalsRow label="Sales tax" value={totals.taxLabel} /> : null}
        {totals.totalLabel ? (
          <div className="mt-3 border-t border-slate-200/70 pt-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-base font-semibold text-slate-900">Total investment</span>
              <span className="text-xl font-semibold tabular-nums tracking-tight text-slate-950">
                {totals.totalLabel}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
