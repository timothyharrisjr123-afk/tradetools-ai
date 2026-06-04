"use client";

import Link from "next/link";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import {
  formatProposalTemplateNextStepCopy,
  formatProposalTemplateReadinessLabel,
  proposalTemplateReadinessStatusPillClass,
} from "@/app/lib/proposalTemplateReadiness";
import { TEMPLATES_CARD, TEMPLATES_METRIC_TILE } from "./templatesConstants";

type TemplatesProposalReadinessProps = {
  loading: boolean;
  readiness: ProposalTemplateReadiness;
};

export default function TemplatesProposalReadiness({
  loading,
  readiness,
}: TemplatesProposalReadinessProps) {
  const statusLabel = formatProposalTemplateReadinessLabel(readiness);
  const nextStep = formatProposalTemplateNextStepCopy(readiness);
  const pillClass = proposalTemplateReadinessStatusPillClass(readiness.status);
  const builderReady = readiness.status === "ready_for_builder";

  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-proposal-readiness-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="templates-proposal-readiness-heading" className="text-sm font-semibold text-slate-900">
            Proposal template readiness
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Company setup gate before Proposal Builder. This does not create job proposals.
          </p>
        </div>
        {!loading && <span className={pillClass}>{statusLabel}</span>}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Evaluating template readiness…</p>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-700">{nextStep}</p>
          {builderReady ? (
            <p className="mt-2 text-xs font-medium text-slate-500">
              Proposal Builder is not available on this page — it will open from Job Card in a later
              stage.
            </p>
          ) : null}

          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={TEMPLATES_METRIC_TILE}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Linked lines
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {readiness.linked_catalog_item_count}
              </dd>
            </div>
            <div className={TEMPLATES_METRIC_TILE}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Missing links
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {readiness.missing_catalog_item_count}
              </dd>
            </div>
            <div className={TEMPLATES_METRIC_TILE}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Priced (linked)
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {readiness.priced_catalog_item_count}
              </dd>
            </div>
            <div className={TEMPLATES_METRIC_TILE}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Options
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {readiness.option_count}
              </dd>
            </div>
          </dl>

          {readiness.status === "needs_catalog" && (
            <Link
              href="/tools/roofing/catalog"
              className="mt-4 inline-flex text-sm font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-700"
            >
              Open catalog setup
            </Link>
          )}
        </>
      )}
    </section>
  );
}
