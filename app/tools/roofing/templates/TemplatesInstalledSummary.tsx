"use client";

import {
  formatProposalTemplateNextStepCopy,
  proposalTemplateReadinessStatusPillClass,
} from "@/app/lib/proposalTemplateReadiness";
import {
  proposalTemplateReadinessStatusLabel,
  proposalTemplateStatusLabel,
  type ProposalTemplateReadiness,
} from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { TEMPLATES_CARD, TEMPLATES_METRIC_TILE } from "./templatesConstants";
import {
  countCatalogLinkedTemplateItems,
  sortTemplateOptionsByOrder,
} from "./templatesSetupUtils";

type TemplatesInstalledSummaryProps = {
  loading: boolean;
  graph: ProposalTemplateGraph | null;
  catalogReady: boolean;
  proposalReadiness: ProposalTemplateReadiness;
};

export default function TemplatesInstalledSummary({
  loading,
  graph,
  catalogReady,
  proposalReadiness,
}: TemplatesInstalledSummaryProps) {
  const readinessLabel = proposalTemplateReadinessStatusLabel(proposalReadiness.status);
  const readinessPill = proposalTemplateReadinessStatusPillClass(proposalReadiness.status);
  const readinessNextStep = formatProposalTemplateNextStepCopy(proposalReadiness);
  if (loading) {
    return (
      <section className={TEMPLATES_CARD} aria-labelledby="templates-installed-heading">
        <h2 id="templates-installed-heading" className="text-base font-semibold text-slate-900">
          Installed templates
        </h2>
        <p className="mt-3 text-sm text-slate-500">Loading template summary…</p>
      </section>
    );
  }

  if (!graph) {
    return (
      <section className={TEMPLATES_CARD} aria-labelledby="templates-installed-heading">
        <h2 id="templates-installed-heading" className="text-base font-semibold text-slate-900">
          Installed templates
        </h2>
        <p className="mt-2 text-sm text-slate-600">{readinessNextStep}</p>
        <p className="mt-2 text-xs text-slate-500">
          Readiness: <span className={readinessPill}>{readinessLabel}</span>
        </p>
        {!catalogReady && (
          <p className="mt-2 text-xs text-slate-500">Install stays unavailable until catalog is ready.</p>
        )}
      </section>
    );
  }

  const { template, options, sections, items } = graph;
  const sortedOptions = sortTemplateOptionsByOrder(options);
  const catalogLinkedCount = countCatalogLinkedTemplateItems(graph);
  const statusLabel = proposalTemplateStatusLabel(template.status);

  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-installed-heading">
      <h2 id="templates-installed-heading" className="text-base font-semibold text-slate-900">
        Installed templates
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Read-only summary of company templates. {readinessNextStep}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Readiness: <span className={readinessPill}>{readinessLabel}</span>
      </p>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/40 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{template.name}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
            {statusLabel}
            {template.active ? "" : " · inactive"}
          </span>
        </div>
        {template.description ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{template.description}</p>
        ) : null}

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={TEMPLATES_METRIC_TILE}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Options
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
              {options.length}
            </dd>
          </div>
          <div className={TEMPLATES_METRIC_TILE}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Sections
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
              {sections.length}
            </dd>
          </div>
          <div className={TEMPLATES_METRIC_TILE}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Line items
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{items.length}</dd>
          </div>
          <div className={TEMPLATES_METRIC_TILE}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Catalog-linked
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
              {catalogLinkedCount}
            </dd>
          </div>
        </dl>

        {sortedOptions.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Customer-facing options
            </h4>
            <ul className="mt-2 space-y-2">
              {sortedOptions.map((option) => (
                <li
                  key={option.id}
                  className="rounded-md border border-slate-100 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <span className="font-medium">
                    {option.customer_label ?? option.name}
                  </span>
                  {option.is_default ? (
                    <span className="ml-2 text-xs text-slate-500">(default)</span>
                  ) : null}
                  {option.description ? (
                    <p className="mt-0.5 text-xs text-slate-500">{option.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
