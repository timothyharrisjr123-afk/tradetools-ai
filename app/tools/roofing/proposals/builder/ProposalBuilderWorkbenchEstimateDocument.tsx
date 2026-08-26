"use client";

import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import type { MeasurementQuantityMap } from "@/app/lib/measurementTypes";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalBuilderOptionCustomerView } from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalSnapshotLineQuantityView } from "@/app/lib/proposalDraftGraphAdapter";
import { buildProposalWorkbenchEstimatePresentation } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import type { ProposalScopeDecision } from "@/app/lib/proposalScopeDecisionTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateSection } from "@/app/lib/proposalTemplateTypes";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";
import { useCallback, useState } from "react";
import { CircleAlert } from "lucide-react";
import {
  BUILDER_CANVAS,
  WORKBENCH_BODY,
  WORKBENCH_MODULE_COMPACT,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchAttentionZone from "./ProposalBuilderWorkbenchAttentionZone";
import ProposalBuilderWorkbenchDecisionTraceZone from "./ProposalBuilderWorkbenchDecisionTraceZone";
import ProposalBuilderWorkbenchPackageZone from "./ProposalBuilderWorkbenchPackageZone";
import ProposalBuilderWorkbenchReadyScopeZone from "./ProposalBuilderWorkbenchReadyScopeZone";
import ProposalBuilderWorkbenchTotalsZone from "./ProposalBuilderWorkbenchTotalsZone";
import ProposalBuilderWorkbenchUpgradesZone from "./ProposalBuilderWorkbenchUpgradesZone";
import ProposalBuilderPaymentTerms from "./ProposalBuilderPaymentTerms";

type ProposalBuilderWorkbenchEstimateDocumentProps = {
  graph: ProposalTemplateGraph;
  /** Option list for package picker — draft-scoped when a persisted draft is loaded. */
  packageSelectorGraph: ProposalTemplateGraph;
  draftScopedPackagePicker?: boolean;
  sections: ProposalTemplateSection[];
  catalogItems: CatalogItem[];
  selectedOptionId: string | null;
  effectiveOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  measurementHandoff: MeasurementProposalHandoff | null;
  measurementQuantityMap: MeasurementQuantityMap | null;
  optionCustomerView: ProposalBuilderOptionCustomerView | null;
  snapshotQuantityByTemplateItemId?: Record<string, ProposalSnapshotLineQuantityView> | null;
  pricingPolicyConfigured?: boolean;
  persistedPages?: ProposalPageRow[] | null;
  estimateVisibilityNotice: string | null;
  persistedDraftEnabled?: boolean;
  proposalId?: string | null;
  activeScopeDecisionsForOption?: ProposalScopeDecision[];
  manualQuantityInFlight?: boolean;
  manualQuantityError?: string | null;
  excludeInFlight?: boolean;
  excludeError?: string | null;
  excludeErrorLineId?: string | null;
  visibilityInFlight?: boolean;
  visibilityError?: string | null;
  visibilityErrorLineId?: string | null;
  upgradeSelectionInFlight?: boolean;
  upgradeSelectionError?: string | null;
  onApplyManualQuantity?: (
    templateItemId: string,
    quantity: string,
    quantityDisplayLabel?: string | null
  ) => Promise<void>;
  onClearManualQuantity?: (templateItemId: string) => Promise<void>;
  onExcludeLine?: (templateItemId: string) => Promise<void>;
  onRestoreExcludedLine?: (templateItemId: string) => Promise<void>;
  onHideLine?: (templateItemId: string) => Promise<void>;
  onRestoreVisibility?: (templateItemId: string) => Promise<void>;
  onSetUpgradeSelected?: (templateItemId: string, selected: boolean) => Promise<void>;
};

function readEstimatePageSettingsFromPersisted(
  persistedPages: ProposalPageRow[] | null | undefined
): ProposalPageSettings | null {
  const estimatePage = persistedPages?.find((page) => page.page_type === "estimate");
  if (!estimatePage?.settings_json) return null;
  const raw = estimatePage.settings_json;
  if (typeof raw !== "object" || raw == null || Array.isArray(raw)) return null;
  return raw as ProposalPageSettings;
}

export default function ProposalBuilderWorkbenchEstimateDocument({
  graph,
  packageSelectorGraph,
  draftScopedPackagePicker = false,
  sections,
  catalogItems,
  selectedOptionId,
  effectiveOptionId,
  onSelectOption,
  measurementHandoff,
  measurementQuantityMap,
  optionCustomerView,
  snapshotQuantityByTemplateItemId,
  pricingPolicyConfigured = false,
  persistedPages,
  estimateVisibilityNotice,
  persistedDraftEnabled = false,
  proposalId = null,
  activeScopeDecisionsForOption = [],
  manualQuantityInFlight = false,
  manualQuantityError = null,
  excludeInFlight = false,
  excludeError = null,
  excludeErrorLineId = null,
  visibilityInFlight = false,
  visibilityError = null,
  visibilityErrorLineId = null,
  upgradeSelectionInFlight = false,
  upgradeSelectionError = null,
  onApplyManualQuantity,
  onClearManualQuantity,
  onExcludeLine,
  onRestoreExcludedLine,
  onHideLine,
  onRestoreVisibility,
  onSetUpgradeSelected,
}: ProposalBuilderWorkbenchEstimateDocumentProps) {
  const quantityContext =
    measurementHandoff || measurementQuantityMap
      ? {
          measurementHandoff,
          quantityMap: measurementQuantityMap,
        }
      : null;

  const estimatePageSettings = readEstimatePageSettingsFromPersisted(persistedPages);

  const presentation = buildProposalWorkbenchEstimatePresentation({
    graph,
    sections,
    catalogItems,
    optionCustomerView,
    selectedOptionId,
    effectiveOptionId,
    pricingPolicyConfigured,
    quantityContext,
    snapshotQuantityByTemplateItemId,
    estimatePageSettings,
    estimateSettingsEditingEnabled: persistedDraftEnabled && estimatePageSettings != null,
    activeScopeDecisionsForOption,
  });

  const { meta } = presentation;
  const scopeEditInFlight =
    manualQuantityInFlight || excludeInFlight || visibilityInFlight || upgradeSelectionInFlight;

  const [setQuantityLineId, setSetQuantityLineId] = useState<string | null>(null);

  const quantityEditingEnabled =
    persistedDraftEnabled && Boolean(onApplyManualQuantity) && Boolean(onClearManualQuantity);
  const excludeEnabled = persistedDraftEnabled && Boolean(onExcludeLine) && Boolean(onRestoreExcludedLine);
  const visibilityEnabled =
    persistedDraftEnabled && Boolean(onHideLine) && Boolean(onRestoreVisibility);

  const focusFirstQuantityIssue = useCallback(() => {
    const row = document.querySelector<HTMLElement>("[data-builder-quantity-issue-row]");
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    const trigger = row?.querySelector<HTMLElement>("[data-builder-qty-edit-trigger]");
    trigger?.focus();
  }, []);

  const focusFirstUpgradeQuantityIssue = useCallback(() => {
    const row = document.querySelector<HTMLElement>(
      "[data-builder-upgrade-quantity-issue]"
    );
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    const trigger = row?.querySelector<HTMLElement>(
      "[data-builder-upgrade-qty-edit-trigger]"
    );
    trigger?.focus();
  }, []);

  const openSetQuantityForLine = useCallback((templateItemId: string) => {
    setSetQuantityLineId(templateItemId);
  }, []);

  const closeSetQuantity = useCallback(() => {
    if (scopeEditInFlight) return;
    setSetQuantityLineId(null);
  }, [scopeEditInFlight]);

  const handleApplyManualQuantity = useCallback(
    async (templateItemId: string, quantity: string, quantityDisplayLabel?: string | null) => {
      if (!onApplyManualQuantity) return;
      await onApplyManualQuantity(templateItemId, quantity, quantityDisplayLabel);
      setSetQuantityLineId(null);
    },
    [onApplyManualQuantity]
  );

  const handleClearManualQuantity = useCallback(
    async (templateItemId: string) => {
      if (!onClearManualQuantity) return;
      await onClearManualQuantity(templateItemId);
      setSetQuantityLineId(null);
    },
    [onClearManualQuantity]
  );

  const handleExcludeLine = useCallback(
    async (templateItemId: string) => {
      if (!onExcludeLine) return;
      try {
        await onExcludeLine(templateItemId);
        setSetQuantityLineId(null);
      } catch {
        /* Client records excludeError for this row. */
      }
    },
    [onExcludeLine]
  );

  const handleHideLine = useCallback(
    async (templateItemId: string) => {
      if (!onHideLine) return;
      try {
        await onHideLine(templateItemId);
      } catch {
        /* Client records visibilityError for this row. */
      }
    },
    [onHideLine]
  );

  const handleRestoreVisibility = useCallback(
    async (templateItemId: string) => {
      if (!onRestoreVisibility) return;
      try {
        await onRestoreVisibility(templateItemId);
      } catch {
        /* Client records visibilityError for this row. */
      }
    },
    [onRestoreVisibility]
  );

  const handleRestoreExcludedLine = useCallback(
    async (templateItemId: string) => {
      if (!onRestoreExcludedLine) return;
      try {
        await onRestoreExcludedLine(templateItemId);
      } catch {
        /* Client records excludeError for this row. */
      }
    },
    [onRestoreExcludedLine]
  );

  const estimateQtyNeeded = meta.scopeReviewLineCount;
  const upgradeQtyNeeded = meta.upgradeScopeReviewLineCount;

  return (
    <article className={BUILDER_CANVAS} data-builder-estimate-document>
      <div className={WORKBENCH_BODY}>
        <ProposalBuilderWorkbenchPackageZone
          packageZone={presentation.packageZone}
          packageSelectorGraph={packageSelectorGraph}
          draftScopedPackagePicker={draftScopedPackagePicker}
          selectedOptionId={selectedOptionId}
          effectiveOptionId={effectiveOptionId}
          onSelectOption={onSelectOption}
          packageTotalLabel={
            presentation.totalsZone.showAmounts
              ? presentation.totalsZone.totalLabel
              : null
          }
        />

        {estimateQtyNeeded > 0 || upgradeQtyNeeded > 0 ? (
          <div
            className="space-y-2 border-b border-amber-200/70 bg-amber-50/50 px-0 py-3"
            data-builder-estimate-next-step
            data-builder-needs-review-strip
          >
            {estimateQtyNeeded > 0 ? (
              <div
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
                data-builder-estimate-quantity-review
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <p className="text-[13.5px] font-semibold text-slate-900">
                    {estimateQtyNeeded === 1
                      ? "1 estimate quantity needs review"
                      : `${estimateQtyNeeded} estimate quantities need review`}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
                  onClick={focusFirstQuantityIssue}
                  data-builder-review-quantities
                >
                  Review estimate
                </button>
              </div>
            ) : null}
            {upgradeQtyNeeded > 0 ? (
              <div
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
                data-builder-upgrade-quantity-review
              >
                <div className="flex min-w-0 items-start gap-3">
                  {estimateQtyNeeded === 0 ? (
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : (
                    <span className="mt-0.5 h-7 w-7 shrink-0" aria-hidden />
                  )}
                  <p className="text-[13.5px] font-semibold text-slate-900">
                    {upgradeQtyNeeded === 1
                      ? "1 upgrade quantity needs review"
                      : `${upgradeQtyNeeded} upgrade quantities need review`}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
                  onClick={focusFirstUpgradeQuantityIssue}
                  data-builder-review-upgrades
                >
                  Review upgrades
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <section
          className={WORKBENCH_MODULE_COMPACT}
          data-builder-estimate-surface
          aria-label="Included estimate and totals"
        >
          <ProposalBuilderWorkbenchReadyScopeZone
            embedded
            sections={presentation.readyScope.sections}
            onEditQuantityForLine={
              quantityEditingEnabled ? openSetQuantityForLine : undefined
            }
            editingQuantityLineId={setQuantityLineId}
            onCancelSetQuantity={closeSetQuantity}
            onSaveQuantity={
              quantityEditingEnabled ? handleApplyManualQuantity : undefined
            }
            quantitySaveInFlight={manualQuantityInFlight}
            quantitySaveError={manualQuantityError}
            onClearManualQuantity={
              quantityEditingEnabled ? handleClearManualQuantity : undefined
            }
            onRemoveFromProposal={excludeEnabled ? handleExcludeLine : undefined}
            removeEnabled={excludeEnabled}
            removeInFlight={excludeInFlight}
            onHideFromCustomer={visibilityEnabled ? handleHideLine : undefined}
            onShowToCustomer={
              visibilityEnabled ? handleRestoreVisibility : undefined
            }
            visibilityInFlight={visibilityInFlight}
            excludeError={excludeError}
            excludeErrorLineId={excludeErrorLineId}
            visibilityError={visibilityError}
            visibilityErrorLineId={visibilityErrorLineId}
          />

          <ProposalBuilderWorkbenchTotalsZone zone={presentation.totalsZone} />

          {proposalId ? (
            <ProposalBuilderPaymentTerms
              proposalId={proposalId}
              selectedTotalCents={optionCustomerView?.customerTotalCents ?? null}
            />
          ) : null}

          <ProposalBuilderWorkbenchUpgradesZone
            zone={presentation.upgradesZone}
            editingQuantityLineId={setQuantityLineId}
            onStartSetQuantity={quantityEditingEnabled ? openSetQuantityForLine : undefined}
            onCancelSetQuantity={closeSetQuantity}
            onSaveQuantity={quantityEditingEnabled ? handleApplyManualQuantity : undefined}
            onClearManualQuantity={
              quantityEditingEnabled ? handleClearManualQuantity : undefined
            }
            quantitySaveInFlight={manualQuantityInFlight}
            quantitySaveError={manualQuantityError}
            manualQuantityEnabled={quantityEditingEnabled}
            onSetUpgradeSelected={
              persistedDraftEnabled ? onSetUpgradeSelected : undefined
            }
            selectionInFlight={upgradeSelectionInFlight}
            selectionError={upgradeSelectionError}
          />

          {presentation.decisionTraceZone.show ? (
            <details
              className="border-t border-slate-200/70 bg-white text-[13px] text-slate-500"
              data-builder-removed-from-proposal
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/80 sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-700">
                    Removed from proposal
                  </span>
                  <span className="mt-0.5 block text-[12px] font-normal text-slate-500">
                    {presentation.decisionTraceZone.excluded.count === 1
                      ? "1 line removed from this package"
                      : `${presentation.decisionTraceZone.excluded.count} lines removed from this package`}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold text-blue-700">
                  Show
                </span>
              </summary>
              <div className="border-t border-slate-100 px-3 py-2.5 sm:px-4">
                <ProposalBuilderWorkbenchDecisionTraceZone
                  zone={presentation.decisionTraceZone}
                  onRestoreExcludedLine={
                    excludeEnabled ? handleRestoreExcludedLine : undefined
                  }
                  excludeInFlight={excludeInFlight}
                  excludeError={excludeError}
                  excludeErrorLineId={excludeErrorLineId}
                />
              </div>
            </details>
          ) : null}
        </section>

        <ProposalBuilderWorkbenchAttentionZone
          zone={presentation.needsAttention}
        />
      </div>
    </article>
  );
}
