"use client";

import Link from "next/link";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import type { TemplateCatalogLinkReadiness } from "@/app/lib/proposalTemplateCatalogLink";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { proposalTemplateStatusLabel } from "@/app/lib/proposalTemplateTypes";
import { TEMPLATES_CARD } from "./templatesConstants";
import TemplatesAvailableUpgradesManager from "./TemplatesAvailableUpgradesManager";
import TemplatesIncludedItemsManager from "./TemplatesIncludedItemsManager";
import { buildPreparedPackageScopePresentation } from "./templatesIncludedWorkPresentation";
import {
  TEMPLATES_ADVANCED_EDITING_ACTION,
  TEMPLATES_INCLUDED_WORK_HEADING,
  TEMPLATES_NEXT_USE_COPY,
  TEMPLATES_NEXT_USE_HEADING,
  TEMPLATES_OPEN_JOBS_ACTION,
  TEMPLATES_PROPOSAL_CONTENT_HEADING,
  TEMPLATES_REUSABLE_SETUP_EYEBROW,
  TEMPLATES_REUSABLE_SETUP_SUBCOPY,
  TEMPLATES_SIMPLE_ESTIMATE_LABEL,
  buildProposalContentLandingAreas,
  resolvePackagePresentation,
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
  onAddUpgradeItem: () => void;
  onReplaceItem: (templateItemId: string) => void;
  onRemoveItem: (templateItemId: string) => void;
  onFixIssues: () => void;
  onOpenAdvanced: () => void;
};

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
  onAddUpgradeItem,
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
  const needsCatalog = !companyReady && proposalReadiness.status === "needs_catalog";

  const packagePresentation = resolvePackagePresentation({
    graph,
    packageSummaries,
  });

  const selectedSummary =
    packageSummaries.find((row) => row.optionId === selectedPackageOptionId) ??
    packageSummaries[0] ??
    null;
  const packageScope =
    selectedPackageOptionId != null
      ? buildPreparedPackageScopePresentation({
          graph,
          optionId: selectedPackageOptionId,
          catalogItems,
        })
      : null;
  const includedWork = packageScope?.includedWork ?? null;
  const availableUpgrades = packageScope?.availableUpgrades ?? null;
  const includedScopeLabel =
    packagePresentation.mode === "simple"
      ? "Included in this estimate"
      : selectedSummary
        ? `Included in ${selectedSummary.optionLabel}`
        : "Included in this package";
  const contentAreas = buildProposalContentLandingAreas(graph);
  const description = template.description?.trim() || null;

  const countLine = [
    packagePresentation.mode === "simple"
      ? TEMPLATES_SIMPLE_ESTIMATE_LABEL
      : packagePresentation.mode === "single"
        ? "1 package"
        : `${packageSummaries.length} packages`,
    `${createsSummary.linkedCatalogCount} included item${
      createsSummary.linkedCatalogCount === 1 ? "" : "s"
    }`,
  ].join(" · ");

  return (
    <div
      className="space-y-3"
      data-templates-quote-setup
      data-templates-reusable-setup
      data-templates-workspace-mode="review"
    >
      <section
        className={`${TEMPLATES_CARD} !px-4 !py-4 space-y-3`}
        aria-labelledby="templates-reusable-setup-heading"
        data-templates-quote-hero
        data-templates-reusable-setup-hero
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {TEMPLATES_REUSABLE_SETUP_EYEBROW}
            </p>
            <h2
              id="templates-reusable-setup-heading"
              className="mt-1 text-lg font-semibold text-slate-900"
            >
              {template.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{TEMPLATES_REUSABLE_SETUP_SUBCOPY}</p>
            <p className="mt-1.5 text-xs text-slate-500" data-templates-hero-counts>
              {countLine}
            </p>
            {description ? (
              <p className="mt-1 text-xs text-slate-500" data-templates-setup-description>
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200/80"
              data-templates-quiet-status
            >
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={onOpenAdvanced}
              className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
              data-templates-open-advanced
            >
              {TEMPLATES_ADVANCED_EDITING_ACTION}
            </button>
          </div>
        </div>

        {needsFix ? (
          <p className="text-xs text-slate-600" role="status" data-templates-quiet-link-hint>
            A few Catalog links need a quick adjust.{" "}
            <button
              type="button"
              onClick={onFixIssues}
              className="font-semibold text-slate-800 underline-offset-2 hover:underline"
              data-templates-fix-links
            >
              Review links
            </button>
          </p>
        ) : null}
        {needsCatalog ? (
          <p className="text-xs text-slate-600" role="status">
            Finish{" "}
            <Link
              href="/tools/roofing/catalog"
              className="font-semibold text-slate-800 underline-offset-2 hover:underline"
              data-templates-primary-cta="open_catalog"
            >
              Catalog setup
            </Link>{" "}
            so this template can use your company pricing.
          </p>
        ) : null}
      </section>

      <section
        className={`${TEMPLATES_CARD} !px-4 !py-4 space-y-3`}
        aria-labelledby="templates-packages-landing-heading"
        data-templates-package-selector
        data-templates-packages-landing
      >
        <div>
          <h3
            id="templates-packages-landing-heading"
            className="text-sm font-semibold text-slate-900"
          >
            {packagePresentation.heading}
          </h3>
          <p
            className="mt-0.5 text-xs text-slate-500"
            data-templates-selected-package-label
            data-templates-package-summary
          >
            {packagePresentation.summaryLine}
          </p>
        </div>

        {packagePresentation.mode === "simple" ? (
          <div
            className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3.5"
            data-templates-package-simple
          >
            <p className="text-sm font-semibold text-slate-900">
              {TEMPLATES_SIMPLE_ESTIMATE_LABEL}
            </p>
            <p className="mt-1 text-sm text-slate-600">{packagePresentation.summaryLine}</p>
          </div>
        ) : null}

        {packagePresentation.mode === "single" && selectedSummary ? (
          <div
            className="rounded-xl border border-slate-200 bg-white px-4 py-3.5"
            data-templates-package-single
            data-templates-package-option={selectedSummary.optionId}
          >
            <p className="text-sm font-semibold text-slate-900">
              {selectedSummary.optionLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedSummary.linkedItemCount + selectedSummary.issueCount} included item
              {selectedSummary.linkedItemCount + selectedSummary.issueCount === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}

        {packagePresentation.mode === "multi" ? (
          <div
            className="grid gap-2 sm:grid-cols-3"
            role="tablist"
            aria-label="Prepared packages"
          >
            {packageSummaries.map((row) => {
              const selected = row.optionId === selectedPackageOptionId;
              const itemCount = row.linkedItemCount + row.issueCount;
              return (
                <button
                  key={row.optionId}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onSelectPackage(row.optionId)}
                  className={`rounded-xl border px-3.5 py-3 text-left transition ${
                    selected
                      ? "border-blue-300 bg-blue-50/60 ring-1 ring-blue-200"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  data-templates-package-option={row.optionId}
                >
                  <p className="text-sm font-semibold text-slate-900">{row.optionLabel}</p>
                  <p
                    className={`mt-1 text-xs ${selected ? "text-slate-600" : "text-slate-500"}`}
                  >
                    {itemCount} included item{itemCount === 1 ? "" : "s"}
                  </p>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <TemplatesIncludedItemsManager
        key={`included-${selectedPackageOptionId ?? "no-package"}`}
        scopeLabel={includedScopeLabel}
        groups={includedWork?.groups ?? []}
        busy={busy}
        onAddItem={onAddItem}
        onReplaceItem={onReplaceItem}
        onRemoveItem={onRemoveItem}
        heading={TEMPLATES_INCLUDED_WORK_HEADING}
      />

      <TemplatesAvailableUpgradesManager
        key={`upgrades-${selectedPackageOptionId ?? "no-package"}`}
        items={availableUpgrades?.items ?? []}
        busy={busy}
        onAddItem={onAddUpgradeItem}
        onReplaceItem={onReplaceItem}
        onRemoveItem={onRemoveItem}
      />

      <section
        className={`${TEMPLATES_CARD} !px-4 !py-4 space-y-3`}
        aria-labelledby="templates-proposal-content-heading"
        data-templates-proposal-content
      >
        <div>
          <h3
            id="templates-proposal-content-heading"
            className="text-sm font-semibold text-slate-900"
          >
            {TEMPLATES_PROPOSAL_CONTENT_HEADING}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Prepared pages customers can review on proposals from this template.
          </p>
        </div>
        {contentAreas.length === 0 ? (
          <p className="text-sm text-slate-500">No proposal pages prepared yet.</p>
        ) : (
          <ul className="space-y-2" data-templates-proposal-content-list>
            {contentAreas.map((area) => (
              <li
                key={area.label}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                data-templates-proposal-content-area={area.label}
              >
                <span className="text-sm font-semibold text-slate-900">{area.label}</span>
                <span className="text-xs text-slate-500">{area.detail}</span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onOpenAdvanced}
          className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          data-templates-edit-content-quiet
        >
          Edit wording in advanced editing
        </button>
      </section>

      <section
        className={`${TEMPLATES_CARD} !px-4 !py-3.5`}
        aria-labelledby="templates-next-use-heading"
        data-templates-next-use
      >
        <p
          id="templates-next-use-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        >
          {TEMPLATES_NEXT_USE_HEADING}
        </p>
        <p className="mt-1 text-sm text-slate-600">{TEMPLATES_NEXT_USE_COPY}</p>
        {readyToUse || linksReady ? (
          <Link
            href="/tools/roofing/saved"
            className="mt-2 inline-flex text-sm font-semibold text-slate-800 underline-offset-2 hover:underline"
            data-templates-open-jobs
            data-templates-primary-cta="open_jobs"
          >
            {TEMPLATES_OPEN_JOBS_ACTION}
          </Link>
        ) : null}
      </section>
    </div>
  );
}
