"use client";

import Link from "next/link";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import {
  formatProposalTemplateReadinessLabel,
} from "@/app/lib/proposalTemplateReadiness";
import type { TemplateCatalogLinkReadiness } from "@/app/lib/proposalTemplateCatalogLink";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { proposalTemplateStatusLabel } from "@/app/lib/proposalTemplateTypes";
import { TEMPLATES_CARD } from "./templatesConstants";
import {
  TEMPLATES_WORKSPACE_TRUST_NOTE,
  type PackageOptionSummary,
} from "./templatesWorkspaceFlow";
import { summarizeSelectedTemplateGraph } from "./templatesWorkspaceUtils";

type TemplatesOverviewPanelProps = {
  graph: ProposalTemplateGraph;
  proposalReadiness: ProposalTemplateReadiness;
  linkReadiness: TemplateCatalogLinkReadiness;
  packageSummaries: readonly PackageOptionSummary[];
  editableProseCount: number;
  onFixLinks: () => void;
  onOpenPackages: () => void;
  onOpenEstimate: () => void;
  onOpenContent: () => void;
};

export default function TemplatesOverviewPanel({
  graph,
  proposalReadiness,
  linkReadiness,
  packageSummaries,
  editableProseCount,
  onFixLinks,
  onOpenPackages,
  onOpenEstimate,
  onOpenContent,
}: TemplatesOverviewPanelProps) {
  const { template } = graph;
  const summary = summarizeSelectedTemplateGraph(graph);
  const statusLabel = proposalTemplateStatusLabel(template.status);
  const companyReady = proposalReadiness.status === "ready_for_builder";
  const linksReady = linkReadiness.severity === "ready" && linkReadiness.totalItems > 0;
  const needsFix = linkReadiness.nextAction === "fix_links";
  const needsAdd = linkReadiness.nextAction === "add_items";
  const overviewReady = companyReady && linksReady;

  return (
    <section
      className={`${TEMPLATES_CARD} space-y-5`}
      aria-labelledby="templates-overview-heading"
      data-templates-overview
      data-templates-overview-ready={overviewReady ? "true" : "false"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Selected template
          </p>
          <h2 id="templates-overview-heading" className="mt-1 text-lg font-semibold text-slate-900">
            {template.name}
          </h2>
          {template.description ? (
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{template.description}</p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Reusable package structure and Catalog links for job proposals.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            {statusLabel}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
              overviewReady
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : "bg-amber-50 text-amber-800 ring-amber-200"
            }`}
            data-templates-overview-status
          >
            {overviewReady
              ? "Ready"
              : needsFix || needsAdd
                ? "Needs attention"
                : formatProposalTemplateReadinessLabel(proposalReadiness)}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-templates-overview-stats>
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Package options
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {summary.optionCount}
          </dd>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Sections
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {summary.sectionCount}
          </dd>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Catalog links
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {linkReadiness.linkedActive}
            {linkReadiness.problemCount > 0
              ? ` · ${linkReadiness.problemCount} issue${linkReadiness.problemCount === 1 ? "" : "s"}`
              : ""}
          </dd>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Editable prose
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {editableProseCount}
          </dd>
        </div>
      </dl>

      <div
        className="rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2.5"
        data-templates-link-summary
      >
        <p className="text-xs font-semibold text-slate-800">{linkReadiness.summaryLabel}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{linkReadiness.detail}</p>
      </div>

      {packageSummaries.length > 0 ? (
        <div data-templates-overview-packages>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Package options
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {packageSummaries.map((row) => (
              <li
                key={row.optionId}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                <span className="font-semibold">{row.optionLabel}</span>
                <span className="text-slate-500">
                  {" "}
                  · {row.linkedItemCount} Catalog items
                  {row.issueCount > 0 ? ` · ${row.issueCount} need attention` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" data-templates-overview-actions>
        {needsFix ? (
          <button
            type="button"
            onClick={onFixLinks}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            data-templates-fix-links
          >
            Fix Catalog links
          </button>
        ) : null}

        {needsAdd ? (
          <button
            type="button"
            onClick={onOpenPackages}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            data-templates-add-items-cta
          >
            Add Catalog items
          </button>
        ) : null}

        {overviewReady ? (
          <Link
            href="/tools/roofing/saved"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            data-templates-open-jobs
          >
            Open Jobs to create a proposal
          </Link>
        ) : null}

        {!companyReady && proposalReadiness.status === "needs_catalog" ? (
          <Link
            href="/tools/roofing/catalog"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            data-templates-open-catalog
          >
            Open Catalog setup
          </Link>
        ) : null}

        {!companyReady && proposalReadiness.status === "needs_pricing" ? (
          <Link
            href="/tools/roofing/catalog"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            data-templates-open-catalog-pricing
          >
            Price Catalog items
          </Link>
        ) : null}

        <button
          type="button"
          onClick={onOpenPackages}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          data-templates-open-packages
        >
          Edit packages & Catalog
        </button>
        <button
          type="button"
          onClick={onOpenEstimate}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          data-templates-open-estimate
        >
          Estimate display
        </button>
        <button
          type="button"
          onClick={onOpenContent}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          data-templates-open-content
        >
          Edit content
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500" data-templates-trust-note>
        {TEMPLATES_WORKSPACE_TRUST_NOTE}
      </p>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Proposal creation starts from a Job Card (job + measurement + this template). There is no Create proposal button on this page.
      </p>
    </section>
  );
}
