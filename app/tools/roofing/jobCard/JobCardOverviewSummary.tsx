"use client";

import type { ReactNode } from "react";

type JobCardOverviewSummaryProps = {
  proposalLabel: string;
  measurementLabel: string | null;
  operationalStateLabel?: string | null;
  paymentStatusLabel?: string | null;
};

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

export default function JobCardOverviewSummary({
  proposalLabel,
  measurementLabel,
  operationalStateLabel = null,
  paymentStatusLabel = null,
}: JobCardOverviewSummaryProps) {
  return (
    <div className="space-y-3" data-jobcard-overview-truth>
      {operationalStateLabel ? (
        <p
          className="text-sm font-medium text-slate-900"
          data-jobcard-overview-operational
        >
          {operationalStateLabel}
        </p>
      ) : null}
      <div className="space-y-2">
        <Row label="Proposal" value={proposalLabel} />
        {measurementLabel ? (
          <Row
            label="Measurement"
            value={
              <span data-jobcard-overview-measurement>{measurementLabel}</span>
            }
          />
        ) : null}
        {paymentStatusLabel ? (
          <Row
            label="Payment"
            value={
              <span data-jobcard-overview-payment>{paymentStatusLabel}</span>
            }
          />
        ) : null}
      </div>
    </div>
  );
}
