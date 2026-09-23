"use client";

import type { ReactNode } from "react";

type JobCardOverviewSummaryProps = {
  proposalLabel: string;
  measurementLabel: string | null;
  operationalStateLabel?: string | null;
  paymentStatusLabel?: string | null;
  /** When true, hide commercial Proposal/Payment rows (field-restricted viewers). */
  suppressCommercial?: boolean;
  productionLead?: ReactNode;
  fieldBrief?: ReactNode;
  /** When field brief already shows measurement, skip the quiet Overview row. */
  hideMeasurementRow?: boolean;
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
  suppressCommercial = false,
  productionLead = null,
  fieldBrief = null,
  hideMeasurementRow = false,
}: JobCardOverviewSummaryProps) {
  const showMeasurement =
    Boolean(measurementLabel) &&
    !hideMeasurementRow &&
    !(suppressCommercial && fieldBrief);

  return (
    <div className="space-y-5" data-jobcard-overview-truth>
      {operationalStateLabel && !suppressCommercial ? (
        <div data-jobcard-overview-operational className="space-y-1">
          {operationalStateLabel.split("\n").map((line, index) => (
            <p
              key={`${index}-${line}`}
              className={
                index === 0
                  ? "text-base font-semibold text-slate-950"
                  : "text-sm font-medium text-slate-700"
              }
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {fieldBrief}

      {/* Standalone lead control only when brief is absent (no double hierarchy). */}
      {!fieldBrief && productionLead ? productionLead : null}

      {(!suppressCommercial || showMeasurement) && (
        <div
          className={
            fieldBrief
              ? "space-y-2 border-t border-slate-100 pt-4"
              : "space-y-2"
          }
        >
          {!suppressCommercial ? (
            <Row label="Proposal" value={proposalLabel} />
          ) : null}
          {showMeasurement ? (
            <Row
              label="Measurement"
              value={
                <span data-jobcard-overview-measurement>{measurementLabel}</span>
              }
            />
          ) : null}
          {!suppressCommercial && paymentStatusLabel ? (
            <Row
              label="Payment"
              value={
                <span data-jobcard-overview-payment>{paymentStatusLabel}</span>
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
