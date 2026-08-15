"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import type { TemplateCatalogLinkReadiness } from "@/app/lib/proposalTemplateCatalogLink";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { proposalTemplateStatusLabel } from "@/app/lib/proposalTemplateTypes";
import { buildTemplatePackageStepUpChain } from "@/app/lib/proposalTemplatePackageCompositionDiff";
import {
  TEMPLATES_CONNECTED_WORKSPACE,
  TEMPLATES_WORKSPACE_SECTION,
  TEMPLATES_WORKSPACE_SECTION_MUTED,
} from "./templatesConstants";
import {
  TemplatesIdentityEditor,
  TemplatesPackagesAdjustPanel,
  type PackageAuthorshipDraft,
  type PackageStructureCreateDraft,
  type TemplateIdentityDraft,
} from "./TemplatesSetupAuthorshipEditors";
import TemplatesAvailableUpgradesManager from "./TemplatesAvailableUpgradesManager";
import TemplatesIncludedItemsManager from "./TemplatesIncludedItemsManager";
import TemplatesPacketWordingEditor from "./TemplatesPacketWordingEditor";
import TemplatesPackageCompositionDiffDetail, {
  TemplatesPackageStepUpSummary,
} from "./TemplatesPackageCompositionDiff";
import { buildPreparedPackageScopePresentation } from "./templatesIncludedWorkPresentation";
import type { PacketWordingSavePlan } from "./templatesSetupPacketWording";
import {
  TEMPLATES_ADVANCED_EDITING_ACTION,
  TEMPLATES_CLEAR_PREFERRED_ACTION_LABEL,
  TEMPLATES_ESTIMATE_DISPLAY_ADVANCED_ACTION,
  TEMPLATES_INCLUDED_WORK_HEADING,
  TEMPLATES_JOB_CARD_USE_NOTE,
  TEMPLATES_MAKE_PREFERRED_ACTION_LABEL,
  TEMPLATES_NEXT_USE_COPY,
  TEMPLATES_OPEN_JOBS_ACTION,
  TEMPLATES_PACKAGES_SECTION_HINT,
  TEMPLATES_PREFERRED_BADGE_LABEL,
  TEMPLATES_PREFERRED_HELPER_COPY,
  TEMPLATES_PROPOSAL_CONTENT_HEADING,
  TEMPLATES_PROPOSAL_CONTENT_HINT,
  TEMPLATES_REUSABLE_SETUP_EYEBROW,
  TEMPLATES_REUSABLE_SETUP_SUBCOPY,
  TEMPLATES_SIMPLE_ESTIMATE_LABEL,
  formatActivePackageSetupSummary,
  formatPackageScopeCountLine,
  formatTemplateScopeCountLine,
  packageChoiceGridClass,
  resolvePackageChoiceDescription,
  resolvePackagePresentation,
  resolveTemplatePurposeDescription,
  type PackageOptionSummary,
  type TemplateCreatesSummary,
  type TemplatesEditTabId,
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
  onSaveItemQuantity?: (
    templateItemId: string,
    mode: "inherit_catalog" | "fixed",
    fixedQuantity?: number | null
  ) => void;
  onFixIssues: () => void;
  onOpenAdvanced: (tab?: TemplatesEditTabId) => void;
  onSavePacketWording: (plan: PacketWordingSavePlan) => Promise<boolean>;
  onSaveIdentity: (draft: TemplateIdentityDraft) => Promise<void> | void;
  onSavePackages: (drafts: readonly PackageAuthorshipDraft[]) => Promise<void> | void;
  onCopyPackage: (input: {
    sourceOptionId: string;
    draft: PackageStructureCreateDraft;
  }) => Promise<boolean>;
  onCreateBlankPackage: (draft: PackageStructureCreateDraft) => Promise<boolean>;
  onReorderPackage: (optionId: string, direction: "up" | "down") => Promise<boolean>;
  onRemovePackage: (input: {
    removeOptionId: string;
    replacementDefaultOptionId?: string | null;
  }) => Promise<boolean>;
  /** R2B — preferred setup for roofing proposals (not package-option default). */
  isPreferred?: boolean;
  onMakePreferred?: () => void;
  onClearPreferred?: () => void;
  preferenceBusy?: boolean;
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
  onSaveItemQuantity,
  onFixIssues,
  onOpenAdvanced,
  onSavePacketWording,
  onSaveIdentity,
  onSavePackages,
  onCopyPackage,
  onCreateBlankPackage,
  onReorderPackage,
  onRemovePackage,
  isPreferred = false,
  onMakePreferred,
  onClearPreferred,
  preferenceBusy = false,
}: TemplatesQuoteSetupReviewProps) {
  const [packagesAdjustOpen, setPackagesAdjustOpen] = useState(false);
  const [expandedStepUpOptionId, setExpandedStepUpOptionId] = useState<string | null>(
    null
  );
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
  const description = resolveTemplatePurposeDescription({
    description: template.description,
    metadata: template.metadata ?? null,
  });

  const stepUpByOptionId = useMemo(() => {
    const map = new Map(
      buildTemplatePackageStepUpChain({ graph, catalogItems }).map((item) => [
        item.package.packageId,
        item,
      ])
    );
    return map;
  }, [graph, catalogItems]);

  const countLine = formatTemplateScopeCountLine({
    packageCount: packageSummaries.length,
    packageMode: packagePresentation.mode,
    linkedCatalogCount: createsSummary.linkedCatalogCount,
    issueCount: createsSummary.issueCount,
    availableUpgradeCount: createsSummary.availableUpgradeCount,
  });

  const optionDescriptionById = new Map(
    graph.options.map((option) => [option.id, option.description ?? null])
  );

  return (
    <div
      className="space-y-2"
      data-templates-quote-setup
      data-templates-reusable-setup
      data-templates-connected-workspace
      data-templates-workspace-mode="review"
    >
      <div className={TEMPLATES_CONNECTED_WORKSPACE}>
        <header
          className={`${TEMPLATES_WORKSPACE_SECTION} !pb-3.5`}
          aria-labelledby="templates-reusable-setup-heading"
          data-templates-quote-hero
          data-templates-reusable-setup-hero
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-medium tracking-wide text-slate-500">
                  {TEMPLATES_REUSABLE_SETUP_EYEBROW}
                </p>
                {isPreferred && template.status !== "archived" ? (
                  <span
                    className="rounded-full bg-emerald-50/90 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200/70"
                    data-templates-preferred-badge
                  >
                    {TEMPLATES_PREFERRED_BADGE_LABEL}
                  </span>
                ) : null}
                {template.status === "archived" ? (
                  <span
                    className="text-[11px] font-medium text-slate-400"
                    data-templates-quiet-status
                  >
                    {statusLabel}
                  </span>
                ) : null}
              </div>
              <h2
                id="templates-reusable-setup-heading"
                className="mt-1 text-lg font-semibold tracking-tight text-slate-900"
              >
                {template.name}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {description ?? TEMPLATES_REUSABLE_SETUP_SUBCOPY}
              </p>
              <p className="mt-1 text-xs text-slate-500" data-templates-hero-counts>
                {countLine}
                {isPreferred && template.status !== "archived"
                  ? ` · ${TEMPLATES_PREFERRED_HELPER_COPY}`
                  : ` · ${TEMPLATES_JOB_CARD_USE_NOTE}`}
              </p>
              <div className="mt-2">
                <TemplatesIdentityEditor
                  name={template.name}
                  description={template.description}
                  busy={busy}
                  onSave={onSaveIdentity}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {template.status !== "archived" && !isPreferred && onMakePreferred ? (
                <button
                  type="button"
                  onClick={onMakePreferred}
                  disabled={busy || preferenceBusy}
                  className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  data-templates-make-preferred
                >
                  {preferenceBusy ? "Saving…" : TEMPLATES_MAKE_PREFERRED_ACTION_LABEL}
                </button>
              ) : null}
              {template.status !== "archived" && isPreferred && onClearPreferred ? (
                <button
                  type="button"
                  onClick={onClearPreferred}
                  disabled={busy || preferenceBusy}
                  className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-50"
                  data-templates-clear-preferred
                >
                  {preferenceBusy ? "Saving…" : TEMPLATES_CLEAR_PREFERRED_ACTION_LABEL}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenAdvanced("packages")}
                className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                data-templates-open-advanced
              >
                {TEMPLATES_ADVANCED_EDITING_ACTION}
              </button>
            </div>
          </div>

          {needsFix ? (
            <p className="mt-2 text-xs text-slate-600" role="status" data-templates-quiet-link-hint>
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
            <p className="mt-2 text-xs text-slate-600" role="status">
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
        </header>

        <section
          className={TEMPLATES_WORKSPACE_SECTION_MUTED}
          aria-labelledby="templates-packages-landing-heading"
          data-templates-package-selector
          data-templates-packages-landing
        >
          <div
            className={
              packagesAdjustOpen
                ? "flex flex-col gap-3"
                : "flex flex-wrap items-start justify-between gap-2"
            }
          >
            <div className="min-w-0">
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
                {packagePresentation.mode === "multi"
                  ? `${formatActivePackageSetupSummary(packageSummaries.length)} ${TEMPLATES_PACKAGES_SECTION_HINT}`
                  : packagePresentation.summaryLine}
              </p>
              {packagePresentation.mode === "multi" &&
              selectedSummary &&
              !packagesAdjustOpen ? (
                <p
                  className="mt-1 text-[11px] font-medium text-blue-800"
                  data-templates-reviewing-package
                >
                  Reviewing {selectedSummary.optionLabel} below
                </p>
              ) : null}
            </div>
            {packagePresentation.mode !== "simple" ? (
              <div className={packagesAdjustOpen ? "w-full" : "shrink-0"}>
                <TemplatesPackagesAdjustPanel
                  graph={graph}
                  busy={busy}
                  onOpenChange={setPackagesAdjustOpen}
                  onSaveAuthorship={onSavePackages}
                  onCopyPackage={onCopyPackage}
                  onCreateBlankPackage={onCreateBlankPackage}
                  onReorderPackage={onReorderPackage}
                  onRemovePackage={onRemovePackage}
                />
              </div>
            ) : null}
          </div>

          {packagePresentation.mode === "simple" ? (
            <div
              className="mt-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3.5"
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
              className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3.5 ring-1 ring-blue-100"
              data-templates-package-single
              data-templates-package-option={selectedSummary.optionId}
            >
              <p className="text-sm font-semibold text-slate-900">
                {selectedSummary.optionLabel}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {formatPackageScopeCountLine(selectedSummary)}
              </p>
            </div>
          ) : null}

          {packagePresentation.mode === "multi" ? (
            <div
              className={`mt-3 ${packageChoiceGridClass(packageSummaries.length)}`}
              role="tablist"
              aria-label="Prepared packages"
              data-templates-package-cards
              data-templates-package-count={packageSummaries.length}
            >
              {packageSummaries.map((row) => {
                const selected = row.optionId === selectedPackageOptionId;
                const packageDescription = resolvePackageChoiceDescription({
                  optionLabel: row.optionLabel,
                  optionDescription: optionDescriptionById.get(row.optionId),
                });
                return (
                  <div
                    key={row.optionId}
                    role="tab"
                    tabIndex={0}
                    aria-selected={selected}
                    onClick={() => onSelectPackage(row.optionId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectPackage(row.optionId);
                      }
                    }}
                    className={`min-w-0 rounded-xl border px-3.5 py-3.5 text-left transition ${
                      selected
                        ? "border-blue-400 bg-white shadow-sm ring-2 ring-blue-100"
                        : "border-slate-200/90 bg-white/80 hover:border-slate-300 hover:bg-white"
                    }`}
                    data-templates-package-option={row.optionId}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{row.optionLabel}</p>
                      {row.isDefault ? (
                        <span
                          className="rounded-full bg-slate-100/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/70"
                          data-templates-package-default-badge={row.optionId}
                        >
                          Starting
                        </span>
                      ) : null}
                      {selected ? (
                        <span className="text-[10px] font-medium text-blue-700">
                          Reviewing
                        </span>
                      ) : null}
                    </div>
                    <p
                      className={`mt-1.5 text-xs font-medium ${
                        selected ? "text-slate-700" : "text-slate-500"
                      }`}
                    >
                      {formatPackageScopeCountLine(row)}
                    </p>
                    {packageDescription ? (
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        {packageDescription}
                      </p>
                    ) : null}
                    {(() => {
                      const stepUp = stepUpByOptionId.get(row.optionId);
                      if (!stepUp) return null;
                      const expanded = expandedStepUpOptionId === row.optionId;
                      return (
                        <>
                          <TemplatesPackageStepUpSummary
                            diff={stepUp.diff}
                            expanded={expanded}
                            onToggle={() =>
                              setExpandedStepUpOptionId(expanded ? null : row.optionId)
                            }
                          />
                          {expanded ? (
                            <TemplatesPackageCompositionDiffDetail diff={stepUp.diff} />
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
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
          onSaveItemQuantity={onSaveItemQuantity}
          heading={TEMPLATES_INCLUDED_WORK_HEADING}
          embedded
        />

        <TemplatesAvailableUpgradesManager
          key={`upgrades-${selectedPackageOptionId ?? "no-package"}`}
          items={availableUpgrades?.items ?? []}
          busy={busy}
          onAddItem={onAddUpgradeItem}
          onReplaceItem={onReplaceItem}
          onRemoveItem={onRemoveItem}
          embedded
        />

        <section
          className={TEMPLATES_WORKSPACE_SECTION}
          aria-labelledby="templates-proposal-content-heading"
          data-templates-proposal-content
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3
                id="templates-proposal-content-heading"
                className="text-sm font-semibold text-slate-900"
              >
                {TEMPLATES_PROPOSAL_CONTENT_HEADING}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">{TEMPLATES_PROPOSAL_CONTENT_HINT}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAdvanced("estimate")}
              className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
              data-templates-open-estimate-display
            >
              {TEMPLATES_ESTIMATE_DISPLAY_ADVANCED_ACTION}
            </button>
          </div>
          <TemplatesPacketWordingEditor
            graph={graph}
            busy={busy}
            onSave={onSavePacketWording}
          />
        </section>
      </div>

      <footer
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1 pt-1"
        aria-label="Next use from Job Card"
        data-templates-next-use
      >
        <p className="text-xs leading-relaxed text-slate-500">{TEMPLATES_NEXT_USE_COPY}</p>
        {readyToUse || linksReady ? (
          <Link
            href="/tools/roofing/saved"
            className="shrink-0 text-xs font-semibold text-slate-700 underline-offset-2 hover:underline"
            data-templates-open-jobs
            data-templates-primary-cta="open_jobs"
          >
            {TEMPLATES_OPEN_JOBS_ACTION}
          </Link>
        ) : null}
      </footer>
    </div>
  );
}
