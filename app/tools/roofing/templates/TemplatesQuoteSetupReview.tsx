"use client";

import Link from "next/link";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import { formatProposalTemplateReadinessLabel } from "@/app/lib/proposalTemplateReadiness";
import type { TemplateCatalogLinkReadiness } from "@/app/lib/proposalTemplateCatalogLink";
import {
  buildCatalogByIdMap,
  buildTemplateCatalogLinkView,
} from "@/app/lib/proposalTemplateCatalogLink";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { proposalTemplateStatusLabel } from "@/app/lib/proposalTemplateTypes";
import { TEMPLATES_CARD } from "./templatesConstants";
import TemplatesIncludedItemsManager, {
  type IncludedItemGroup,
} from "./TemplatesIncludedItemsManager";
import {
  TEMPLATES_QUOTE_SETUP_OUTCOME,
  TEMPLATES_WORKSPACE_TRUST_NOTE,
  type PackageOptionSummary,
  type TemplateCreatesSummary,
} from "./templatesWorkspaceFlow";

type TemplatesQuoteSetupReviewProps = {
  graph: ProposalTemplateGraph;
  proposalReadiness: ProposalTemplateReadiness;
  linkReadiness: TemplateCatalogLinkReadiness;
  packageSummaries: readonly PackageOptionSummary[];
  createsSummary: TemplateCreatesSummary;
  catalogItems: readonly CatalogItem[];
  selectedPackageOptionId: string | null;
  onSelectPackage: (optionId: string) => void;
  busy: boolean;
  onAddItem: () => void;
  onReplaceItem: (templateItemId: string) => void;
  onRemoveItem: (templateItemId: string) => void;
  onFixIssues: () => void;
  onOpenAdvanced: () => void;
};

function buildIncludedGroups(
  graph: ProposalTemplateGraph,
  optionId: string,
  catalogItems: readonly CatalogItem[]
): IncludedItemGroup[] {
  const catalogById = buildCatalogByIdMap(catalogItems);
  const sections = graph.sections
    .filter((row) => row.option_id === optionId)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const groups: IncludedItemGroup[] = [];
  for (const section of sections) {
    const items = graph.items
      .filter((item) => item.section_id === section.id)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    if (items.length === 0) continue;
    const label =
      section.kind === "upgrade_group"
        ? section.name?.trim() || "Optional upgrades"
        : section.kind === "line_items"
          ? section.name?.trim() || "Estimate items"
          : section.name?.trim() || "Items";
    groups.push({
      sectionId: section.id,
      sectionLabel: label,
      items: items.map((item) => buildTemplateCatalogLinkView(item, catalogById)),
    });
  }
  return groups;
}

export default function TemplatesQuoteSetupReview({
  graph,
  proposalReadiness,
  linkReadiness,
  packageSummaries,
  createsSummary,
  catalogItems,
  selectedPackageOptionId,
  onSelectPackage,
  busy,
  onAddItem,
  onReplaceItem,
  onRemoveItem,
  onFixIssues,
  onOpenAdvanced,
}: TemplatesQuoteSetupReviewProps) {
  const { template } = graph;
  const statusLabel = proposalTemplateStatusLabel(template.status);
  const companyReady = proposalReadiness.status === "ready_for_builder";
  const linksReady = linkReadiness.severity === "ready" && linkReadiness.totalItems > 0;
  const needsFix = linkReadiness.nextAction === "fix_links" || linkReadiness.nextAction === "add_items";
  const readyToUse = companyReady && linksReady;

  const selectedSummary =
    packageSummaries.find((row) => row.optionId === selectedPackageOptionId) ??
    packageSummaries[0] ??
    null;
  const includedGroups =
    selectedPackageOptionId != null
      ? buildIncludedGroups(graph, selectedPackageOptionId, catalogItems)
      : [];

  return (
    <div className="space-y-4" data-templates-quote-setup data-templates-workspace-mode="review">
      <section
        className={`${TEMPLATES_CARD} space-y-4`}
        aria-labelledby="templates-quote-hero-heading"
        data-templates-quote-hero
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Selected template
            </p>
            <h2
              id="templates-quote-hero-heading"
              className="mt-1 text-xl font-semibold text-slate-900"
            >
              {template.name}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {TEMPLATES_QUOTE_SETUP_OUTCOME}
            </p>
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
                : needsFix
                  ? "Needs attention"
                  : formatProposalTemplateReadinessLabel(proposalReadiness)}
            </span>
          </div>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" data-templates-hero-counts>
          <li>
            <span className="font-semibold text-slate-800">{packageSummaries.length}</span> packages
          </li>
          <li>
            <span className="font-semibold text-slate-800">
              {createsSummary.linkedCatalogCount}
            </span>{" "}
            included items linked
          </li>
          {createsSummary.issueCount > 0 ? (
            <li className="font-semibold text-amber-800">
              {createsSummary.issueCount} need attention
            </li>
          ) : null}
        </ul>

        <div
          className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5"
          data-templates-what-this-creates
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            What this includes
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            <li>
              <span className="font-medium text-slate-900">Packages: </span>
              {createsSummary.packageLabels.length > 0
                ? createsSummary.packageLabels.join(" · ")
                : "No packages yet"}
            </li>
            <li>
              <span className="font-medium text-slate-900">Customer pages: </span>
              {createsSummary.customerFacingAreas.length > 0
                ? createsSummary.customerFacingAreas.join(" · ")
                : "Still incomplete"}
            </li>
            <li data-templates-customer-sees>
              <span className="font-medium text-slate-900">Customer sees: </span>
              {createsSummary.customerDisplayLine}
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {readyToUse ? (
            <Link
              href="/tools/roofing/saved"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              data-templates-open-jobs
              data-templates-primary-cta="open_jobs"
            >
              Use from Job Card
            </Link>
          ) : null}
          {needsFix ? (
            <button
              type="button"
              onClick={onFixIssues}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              data-templates-fix-links
              data-templates-primary-cta="fix_links"
            >
              Fix issues
            </button>
          ) : null}
          {!companyReady && proposalReadiness.status === "needs_catalog" ? (
            <Link
              href="/tools/roofing/catalog"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              data-templates-primary-cta="open_catalog"
            >
              Open Catalog setup
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            data-templates-open-advanced
          >
            Advanced settings
          </button>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500" data-templates-trust-note>
          {TEMPLATES_WORKSPACE_TRUST_NOTE}
        </p>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Proposal creation starts from a Job Card. There is no Create proposal button on this page.
        </p>
      </section>

      <section
        className={`${TEMPLATES_CARD} space-y-3`}
        aria-labelledby="templates-package-selector-heading"
        data-templates-package-selector
      >
        <div>
          <h3
            id="templates-package-selector-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Package
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Review one package at a time. Included items below follow this selection.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Package options">
          {packageSummaries.map((row) => {
            const selected = row.optionId === selectedPackageOptionId;
            return (
              <button
                key={row.optionId}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelectPackage(row.optionId)}
                className={`rounded-md px-3 py-2 text-left text-xs font-semibold transition ${
                  selected
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                data-templates-package-option={row.optionId}
              >
                <span className="block">{row.optionLabel}</span>
                <span
                  className={`mt-0.5 block font-normal ${selected ? "text-slate-300" : "text-slate-500"}`}
                >
                  {row.linkedItemCount + row.issueCount} items
                  {row.issueCount > 0 ? ` · ${row.issueCount} issues` : ""}
                </span>
              </button>
            );
          })}
        </div>
        {selectedSummary ? (
          <p className="text-xs text-slate-500" data-templates-selected-package-label>
            Viewing {selectedSummary.optionLabel}
            {selectedSummary.status === "needs_attention" ? " · Needs attention" : " · Ready"}
          </p>
        ) : null}
      </section>

      <TemplatesIncludedItemsManager
        groups={includedGroups}
        busy={busy}
        onAddItem={onAddItem}
        onReplaceItem={onReplaceItem}
        onRemoveItem={onRemoveItem}
      />
    </div>
  );
}
