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
  const needsFix =
    linkReadiness.nextAction === "fix_links" || linkReadiness.nextAction === "add_items";
  const readyToUse = companyReady && linksReady;

  const selectedSummary =
    packageSummaries.find((row) => row.optionId === selectedPackageOptionId) ??
    packageSummaries[0] ??
    null;
  const includedGroups =
    selectedPackageOptionId != null
      ? buildIncludedGroups(graph, selectedPackageOptionId, catalogItems)
      : [];

  const includesLine = [
    createsSummary.packageLabels.length > 0
      ? `Packages: ${createsSummary.packageLabels.join(" · ")}`
      : null,
    createsSummary.customerFacingAreas.length > 0
      ? `Pages: ${createsSummary.customerFacingAreas.join(" · ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3" data-templates-quote-setup data-templates-workspace-mode="review">
      <section
        className={`${TEMPLATES_CARD} !px-4 !py-3.5 space-y-3`}
        aria-labelledby="templates-quote-hero-heading"
        data-templates-quote-hero
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2
              id="templates-quote-hero-heading"
              className="text-lg font-semibold text-slate-900"
            >
              {template.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500" data-templates-hero-counts>
              {packageSummaries.length} packages · {createsSummary.linkedCatalogCount} items
              linked
              {createsSummary.issueCount > 0
                ? ` · ${createsSummary.issueCount} need attention`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
              {statusLabel}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
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

        <div data-templates-what-this-creates>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            What this includes
          </p>
          <p className="mt-0.5 text-xs leading-snug text-slate-700">
            {includesLine || "Template structure still incomplete"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500" data-templates-customer-sees>
            {createsSummary.customerDisplayLine}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {readyToUse ? (
            <Link
              href="/tools/roofing/saved"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              data-templates-open-jobs
              data-templates-primary-cta="open_jobs"
            >
              Open Jobs to create a proposal
            </Link>
          ) : null}
          {needsFix ? (
            <button
              type="button"
              onClick={onFixIssues}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              data-templates-fix-links
              data-templates-primary-cta="fix_links"
            >
              Fix issues
            </button>
          ) : null}
          {!companyReady && proposalReadiness.status === "needs_catalog" ? (
            <Link
              href="/tools/roofing/catalog"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              data-templates-primary-cta="open_catalog"
            >
              Open Catalog setup
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onOpenAdvanced}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            data-templates-open-advanced
          >
            Advanced settings
          </button>
        </div>

        <div
          className="border-t border-slate-100 pt-3"
          data-templates-package-selector
        >
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3
              id="templates-package-selector-heading"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Package
            </h3>
            {selectedSummary ? (
              <p className="text-[11px] text-slate-500" data-templates-selected-package-label>
                Viewing {selectedSummary.optionLabel}
                {selectedSummary.status === "needs_attention" ? " · Needs attention" : ""}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Package options">
            {packageSummaries.map((row) => {
              const selected = row.optionId === selectedPackageOptionId;
              return (
                <button
                  key={row.optionId}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onSelectPackage(row.optionId)}
                  className={`rounded-md px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                    selected
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  data-templates-package-option={row.optionId}
                >
                  {row.optionLabel}
                  <span
                    className={`ml-1.5 font-normal ${selected ? "text-slate-300" : "text-slate-500"}`}
                  >
                    {row.linkedItemCount + row.issueCount}
                    {row.issueCount > 0 ? ` · ${row.issueCount} issues` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <TemplatesIncludedItemsManager
        groups={includedGroups}
        busy={busy}
        onAddItem={onAddItem}
        onReplaceItem={onReplaceItem}
        onRemoveItem={onRemoveItem}
      />

      <p className="px-1 text-[11px] leading-relaxed text-slate-500" data-templates-trust-note>
        {TEMPLATES_WORKSPACE_TRUST_NOTE} There is no Create proposal button on this page.
      </p>
    </div>
  );
}
