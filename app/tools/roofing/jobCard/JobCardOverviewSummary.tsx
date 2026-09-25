"use client";

import type { ReactNode } from "react";
import { SURFACE_TONED } from "@/app/components/ui/surfaceStyles";
import type {
  JobCardOverviewFactKey,
  JobCardOverviewStateView,
} from "@/app/lib/jobCardOverviewComposition";
import {
  OVERVIEW_FACT_LABEL,
  OVERVIEW_FACT_META,
  OVERVIEW_FACT_TEXT,
  OVERVIEW_FACT_TEXT_QUIET,
  OVERVIEW_GROUP_HEADING,
  OVERVIEW_STATE_TITLE,
} from "./jobCardOverviewStyles";

type JobCardOverviewSummaryProps = {
  /** Structured current situation; null while the stage is still loading. */
  state?: JobCardOverviewStateView | null;
  /** Contextual controls rendered with a state fact (Assign lead, Change plan). */
  stateFactActions?: Partial<Record<JobCardOverviewFactKey, ReactNode>>;
  paymentStatusLabel?: string | null;
  /** Money summary when authorized — never fabricate $0. */
  financialSummary?: ReactNode;
  /** When true, hide commercial rows (field-restricted viewers). */
  suppressCommercial?: boolean;
  fieldBrief?: ReactNode;
  /** Situation-area primary lifecycle CTA (desktop/inline). */
  primaryAction?: ReactNode;
  /** Quiet entry into the Activity destination. */
  recentActivitySummary?: ReactNode;
  /** Rendered before the state region (completed jobs: closeout/payment). */
  leadingSection?: ReactNode;
  /** Callers without a field brief (estimator view, review harnesses) only. */
  proposalLabel?: string | null;
  measurementLabel?: string | null;
  /** Canonical Overview only; legacy estimator/harness presentations stay unchanged. */
  operationalLayout?: boolean;
};

function DetailRow({ label, text }: { label: string; text: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-800">{text}</span>
    </div>
  );
}

export default function JobCardOverviewSummary({
  state = null,
  stateFactActions = {},
  paymentStatusLabel = null,
  financialSummary = null,
  suppressCommercial = false,
  fieldBrief = null,
  primaryAction = null,
  recentActivitySummary = null,
  leadingSection = null,
  proposalLabel = null,
  measurementLabel = null,
  operationalLayout = false,
}: JobCardOverviewSummaryProps) {
  const showMoney = !suppressCommercial && Boolean(financialSummary || paymentStatusLabel);
  const detailRows = fieldBrief
    ? []
    : [
        ...(!suppressCommercial && proposalLabel
          ? [{ label: "Proposal", text: proposalLabel, attr: "proposal" }]
          : []),
        ...(measurementLabel
          ? [{ label: "Measurement", text: measurementLabel, attr: "measurement" }]
          : []),
      ];

  return (
    <div className="space-y-6" data-jobcard-overview-truth>
      {leadingSection}

      {/* 1. Current situation, its timing/responsibility, and the next lifecycle action */}
      <section
        data-jobcard-overview-situation
        data-jobcard-overview-kind={state?.kind}
        className={
          state
            ? operationalLayout
              ? "max-w-[56rem] border-b border-slate-200 pb-6 min-[1200px]:flex min-[1200px]:items-start min-[1200px]:justify-between min-[1200px]:gap-8"
              : `rounded-lg ${SURFACE_TONED} px-4 py-4 sm:px-5 min-[1200px]:flex min-[1200px]:items-start min-[1200px]:justify-between min-[1200px]:gap-8`
            : primaryAction
              ? "space-y-3"
              : "hidden"
        }
      >
        {state ? (
          <div data-jobcard-overview-operational className="min-w-0 space-y-3">
            <div className="space-y-1">
              <h3 className={operationalLayout ? "text-[22px] font-semibold leading-tight tracking-tight text-slate-950" : OVERVIEW_STATE_TITLE} data-jobcard-overview-state-title>
                {state.title}
              </h3>
              {state.notes.map((note) => (
                <p key={note} className="text-sm leading-snug text-slate-600">
                  {note}
                </p>
              ))}
            </div>
            {state.facts.length > 0 ? (
              <dl
                className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-10"
                data-jobcard-overview-facts
              >
                {state.facts.map((fact) => (
                  <div
                    key={fact.key}
                    className={`min-w-0 ${operationalLayout && fact.key === "lead" ? "col-span-2 sm:col-span-1" : ""}`}
                    data-jobcard-overview-fact={fact.key}
                  >
                    <dt className={OVERVIEW_FACT_LABEL}>{fact.label}</dt>
                    <dd className={fact.quiet ? OVERVIEW_FACT_TEXT_QUIET : OVERVIEW_FACT_TEXT}>
                      {fact.text}
                    </dd>
                    {fact.meta ? <dd className={OVERVIEW_FACT_META}>{fact.meta}</dd> : null}
                    {stateFactActions[fact.key] ? (
                      <dd>{stateFactActions[fact.key]}</dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}
        {primaryAction}
      </section>

      {/* 2. Work context leads; money supports it (side by side on wide screens) */}
      {fieldBrief || showMoney ? (
        <div
          className={
            fieldBrief && showMoney && !operationalLayout
              ? "space-y-6 min-[1200px]:grid min-[1200px]:grid-cols-[minmax(0,46rem)_minmax(15rem,20rem)] min-[1200px]:justify-between min-[1200px]:gap-x-12 min-[1200px]:space-y-0"
              : "space-y-6"
          }
        >
          {fieldBrief ? (
            <section data-jobcard-overview-brief className="min-w-0 max-w-[46rem]">
              {fieldBrief}
            </section>
          ) : null}
          {showMoney ? (
            <section
              data-jobcard-overview-financial
              className={operationalLayout ? "max-w-[46rem] border-t border-slate-100 pt-3" : `space-y-2 *:max-w-sm ${fieldBrief ? "border-t border-slate-100 pt-5 min-[1200px]:border-t-0 min-[1200px]:pt-0 min-[1200px]:*:max-w-none" : ""}`}
            >
              <h3 className={operationalLayout ? "sr-only" : OVERVIEW_GROUP_HEADING}>Payments</h3>
              {financialSummary ?? (
                <p className="text-sm text-slate-700" data-jobcard-overview-payment>
                  {paymentStatusLabel}
                </p>
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {detailRows.length > 0 ? (
        <section className="space-y-2 border-t border-slate-100 pt-4" data-jobcard-overview-details>
          {detailRows.map((row) => (
            <DetailRow
              key={row.attr}
              label={row.label}
              text={
                row.attr === "measurement" ? (
                  <span data-jobcard-overview-measurement>{row.text}</span>
                ) : (
                  row.text
                )
              }
            />
          ))}
        </section>
      ) : null}

      {/* 3. History lives in the Activity destination */}
      {recentActivitySummary}
    </div>
  );
}
