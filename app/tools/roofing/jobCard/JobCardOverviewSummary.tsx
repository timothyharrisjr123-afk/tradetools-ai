"use client";

import type { ReactNode } from "react";

type JobCardOverviewSummaryProps = {
  proposalLabel: string;
  measurementLabel: string | null;
  operationalStateLabel?: string | null;
  paymentStatusLabel?: string | null;
  /** Contract / collected line when authorized — never fabricate $0. */
  financialSummary?: ReactNode;
  /** When true, hide commercial Proposal/Payment rows (field-restricted viewers). */
  suppressCommercial?: boolean;
  productionLead?: ReactNode;
  fieldBrief?: ReactNode;
  /** When field brief already shows measurement, skip the quiet Overview row. */
  hideMeasurementRow?: boolean;
  /** Situation-area primary lifecycle CTA (desktop/inline). */
  primaryAction?: ReactNode;
  /** Compact open-task / exception summary (Tasks remains authoritative). */
  tasksSummary?: ReactNode;
  /** Subordinate recent-activity teaser (mobile / Overview bottom). */
  recentActivitySummary?: ReactNode;
  /** Situation copy is already role-safe, so field viewers may see it. */
  allowFieldSituation?: boolean;
  /** Rendered before the field brief (completed jobs: closeout/payment). */
  leadingSection?: ReactNode;
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
  financialSummary = null,
  suppressCommercial = false,
  productionLead = null,
  fieldBrief = null,
  hideMeasurementRow = false,
  primaryAction = null,
  tasksSummary = null,
  recentActivitySummary = null,
  allowFieldSituation = false,
  leadingSection = null,
}: JobCardOverviewSummaryProps) {
  const showMeasurement =
    Boolean(measurementLabel) &&
    !hideMeasurementRow &&
    !(suppressCommercial && fieldBrief);

  return (
    <div className="space-y-6" data-jobcard-overview-truth>
      {/* 1. Current situation + primary forward action */}
      {leadingSection}
      <section data-jobcard-overview-situation className="space-y-3">
        {operationalStateLabel && (!suppressCommercial || allowFieldSituation) ? (
          <div data-jobcard-overview-operational className="space-y-1">
            {operationalStateLabel.split("\n").map((line, index) => (
              <p
                key={`${index}-${line}`}
                className={
                  index === 0
                    ? "text-lg font-semibold text-slate-950"
                    : "text-sm font-medium text-slate-600"
                }
              >
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {primaryAction}
      </section>

      {/* 2. Field brief / schedule hierarchy (G7) */}
      {fieldBrief ? (
        <section data-jobcard-overview-brief>{fieldBrief}</section>
      ) : productionLead ? (
        <section data-jobcard-overview-lead>{productionLead}</section>
      ) : null}

      {/* 3. Compact financial summary when authorized */}
      {!suppressCommercial && (financialSummary || paymentStatusLabel) ? (
        <section
          data-jobcard-overview-financial
          className="space-y-2 border-t border-slate-100 pt-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            Financial
          </p>
          {financialSummary}
          {!financialSummary && paymentStatusLabel ? (
            <Row
              label="Payment"
              value={
                <span data-jobcard-overview-payment>{paymentStatusLabel}</span>
              }
            />
          ) : null}
          <Row label="Proposal" value={proposalLabel} />
          {showMeasurement ? (
            <Row
              label="Measurement"
              value={
                <span data-jobcard-overview-measurement>{measurementLabel}</span>
              }
            />
          ) : null}
        </section>
      ) : showMeasurement ? (
        <section className="space-y-2 border-t border-slate-100 pt-4">
          <Row
            label="Measurement"
            value={
              <span data-jobcard-overview-measurement>{measurementLabel}</span>
            }
          />
        </section>
      ) : null}

      {/* 4. Relevant tasks / exceptions */}
      {tasksSummary}

      {/* 5. Recent Activity — subordinate */}
      {recentActivitySummary}
    </div>
  );
}
