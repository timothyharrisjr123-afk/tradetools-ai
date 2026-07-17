"use client";

import Link from "next/link";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import { formatProposalTemplateReadinessLabel } from "@/app/lib/proposalTemplateReadiness";
import type { TemplateCatalogLinkReadiness } from "@/app/lib/proposalTemplateCatalogLink";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { proposalTemplateStatusLabel } from "@/app/lib/proposalTemplateTypes";
import { TEMPLATES_CARD } from "./templatesConstants";
import {
  TEMPLATES_USE_OUTCOME_SUMMARY,
  TEMPLATES_WORKSPACE_TRUST_NOTE,
  type TemplateCreatesSummary,
} from "./templatesWorkspaceFlow";

type TemplatesUseSurfaceProps = {
  graph: ProposalTemplateGraph;
  proposalReadiness: ProposalTemplateReadiness;
  linkReadiness: TemplateCatalogLinkReadiness;
  createsSummary: TemplateCreatesSummary;
  onFixLinks: () => void;
  onAddCatalogItems: () => void;
  onEditTemplate: () => void;
};

export default function TemplatesUseSurface({
  graph,
  proposalReadiness,
  linkReadiness,
  createsSummary,
  onFixLinks,
  onAddCatalogItems,
  onEditTemplate,
}: TemplatesUseSurfaceProps) {
  const { template } = graph;
  const statusLabel = proposalTemplateStatusLabel(template.status);
  const companyReady = proposalReadiness.status === "ready_for_builder";
  const linksReady = linkReadiness.severity === "ready" && linkReadiness.totalItems > 0;
  const needsFix = linkReadiness.nextAction === "fix_links";
  const needsAdd = linkReadiness.nextAction === "add_items";
  const readyToUse = companyReady && linksReady;

  return (
    <section
      className={`${TEMPLATES_CARD} space-y-5`}
      aria-labelledby="templates-use-heading"
      data-templates-use-surface
      data-templates-use-ready={readyToUse ? "true" : "false"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Selected template
          </p>
          <h2 id="templates-use-heading" className="mt-1 text-xl font-semibold text-slate-900">
            {template.name}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {TEMPLATES_USE_OUTCOME_SUMMARY}
          </p>
          {template.description ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{template.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            {statusLabel}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
              readyToUse
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : "bg-amber-50 text-amber-800 ring-amber-200"
            }`}
            data-templates-use-status
          >
            {readyToUse
              ? "Ready to use"
              : needsFix || needsAdd
                ? "Needs attention"
                : formatProposalTemplateReadinessLabel(proposalReadiness)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {readyToUse ? (
          <Link
            href="/tools/roofing/saved"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            data-templates-open-jobs
            data-templates-primary-cta="open_jobs"
          >
            Open Jobs to create a proposal
          </Link>
        ) : null}

        {needsFix ? (
          <button
            type="button"
            onClick={onFixLinks}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            data-templates-fix-links
            data-templates-primary-cta="fix_links"
          >
            Fix Catalog links
          </button>
        ) : null}

        {needsAdd ? (
          <button
            type="button"
            onClick={onAddCatalogItems}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            data-templates-add-items-cta
            data-templates-primary-cta="add_items"
          >
            Add Catalog items
          </button>
        ) : null}

        {!companyReady && proposalReadiness.status === "needs_catalog" ? (
          <Link
            href="/tools/roofing/catalog"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            data-templates-open-catalog
            data-templates-primary-cta="open_catalog"
          >
            Open Catalog setup
          </Link>
        ) : null}

        {!companyReady && proposalReadiness.status === "needs_pricing" ? (
          <Link
            href="/tools/roofing/catalog"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            data-templates-open-catalog-pricing
            data-templates-primary-cta="price_catalog"
          >
            Price Catalog items
          </Link>
        ) : null}

        <button
          type="button"
          onClick={onEditTemplate}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          data-templates-edit-template
        >
          Edit template
        </button>
      </div>

      <div
        className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3.5"
        data-templates-what-this-creates
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          What this creates
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
          <li>
            <span className="font-medium text-slate-900">Packages: </span>
            {createsSummary.packageLabels.length > 0
              ? createsSummary.packageLabels.join(" · ")
              : "No package options yet"}
          </li>
          <li>
            <span className="font-medium text-slate-900">Included Catalog items: </span>
            {createsSummary.linkedCatalogCount}
            {createsSummary.issueCount > 0
              ? ` · ${createsSummary.issueCount} need attention`
              : " linked"}
          </li>
          <li>
            <span className="font-medium text-slate-900">Includes: </span>
            {createsSummary.customerFacingAreas.length > 0
              ? createsSummary.customerFacingAreas.join(" · ")
              : "Template structure still incomplete"}
            {createsSummary.editableProseCount > 0
              ? ` · ${createsSummary.editableProseCount} editable text section${createsSummary.editableProseCount === 1 ? "" : "s"}`
              : ""}
          </li>
          <li data-templates-customer-sees>
            <span className="font-medium text-slate-900">Customer sees: </span>
            {createsSummary.customerDisplayLine}
          </li>
        </ul>
      </div>

      {!readyToUse ? (
        <div
          className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2.5"
          data-templates-issues
        >
          <p className="text-xs font-semibold text-amber-900">Needs attention</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900/90">
            {linkReadiness.summaryLabel}. {linkReadiness.detail}
          </p>
        </div>
      ) : (
        <div
          className="rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2.5"
          data-templates-link-summary
        >
          <p className="text-xs font-semibold text-emerald-900">{linkReadiness.summaryLabel}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-900/80">
            Create or open a proposal from a Job Card to use this template in Builder.
          </p>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-500" data-templates-trust-note>
        {TEMPLATES_WORKSPACE_TRUST_NOTE}
      </p>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Proposal creation starts from a Job Card (job + measurement + this template). There is no Create proposal button on this page.
      </p>
    </section>
  );
}
