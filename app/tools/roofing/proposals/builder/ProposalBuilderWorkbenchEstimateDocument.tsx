"use client";

import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import type { MeasurementQuantityMap } from "@/app/lib/measurementTypes";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalBuilderOptionCustomerView } from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalSnapshotLineQuantityView } from "@/app/lib/proposalDraftGraphAdapter";
import { buildProposalWorkbenchEstimatePresentation, isUpgradeLineExcludeEligible } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import type { ProposalScopeDecision } from "@/app/lib/proposalScopeDecisionTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateSection } from "@/app/lib/proposalTemplateTypes";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";
import type { EstimateSettingsToggleKey } from "@/app/tools/roofing/templates/templatesStructureEditorUtils";
import { useCallback, useMemo, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import {
  BUILDER_CANVAS,
  WORKBENCH_BODY,
  WORKBENCH_HEADER,
  WORKBENCH_HEADER_SUBTITLE,
  WORKBENCH_HEADER_TITLE,
  WORKBENCH_MODULE,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchAttentionZone from "./ProposalBuilderWorkbenchAttentionZone";
import ProposalBuilderWorkbenchDecisionTraceZone from "./ProposalBuilderWorkbenchDecisionTraceZone";
import ProposalBuilderWorkbenchEditOptionShell, {
  type EditOptionDrawerIntent,
  type ExcludeEditorLine,
  type HideEditorLine,
  type ManualQuantityActiveLine,
  type ManualQuantityEditorLine,
} from "./ProposalBuilderWorkbenchEditOptionShell";
import ProposalBuilderWorkbenchPackageZone from "./ProposalBuilderWorkbenchPackageZone";
import ProposalBuilderWorkbenchReadyScopeZone from "./ProposalBuilderWorkbenchReadyScopeZone";
import ProposalBuilderWorkbenchTotalsZone from "./ProposalBuilderWorkbenchTotalsZone";

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
  estimateVisibilityNotice: string;
  persistedDraftEnabled?: boolean;
  activeScopeDecisionsForOption?: ProposalScopeDecision[];
  manualQuantityInFlight?: boolean;
  manualQuantityError?: string | null;
  excludeInFlight?: boolean;
  excludeError?: string | null;
  visibilityInFlight?: boolean;
  visibilityError?: string | null;
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
  estimateSettingsSaveInFlight?: boolean;
  estimateSettingsSaveError?: string | null;
  onToggleEstimateDisplaySetting?: (
    key: EstimateSettingsToggleKey,
    nextValue: boolean
  ) => void;
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
  activeScopeDecisionsForOption = [],
  manualQuantityInFlight = false,
  manualQuantityError = null,
  excludeInFlight = false,
  excludeError = null,
  visibilityInFlight = false,
  visibilityError = null,
  onApplyManualQuantity,
  onClearManualQuantity,
  onExcludeLine,
  onRestoreExcludedLine,
  onHideLine,
  onRestoreVisibility,
  estimateSettingsSaveInFlight = false,
  estimateSettingsSaveError = null,
  onToggleEstimateDisplaySetting,
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
  const scopeEditInFlight = manualQuantityInFlight || excludeInFlight || visibilityInFlight;

  const [editPackageOpen, setEditPackageOpen] = useState(false);
  const [focusedTemplateItemId, setFocusedTemplateItemId] = useState<string | null>(null);
  const [drawerIntent, setDrawerIntent] = useState<EditOptionDrawerIntent>("quantity");
  const [setQuantityLineId, setSetQuantityLineId] = useState<string | null>(null);
  const [highlightFinishEstimate, setHighlightFinishEstimate] = useState(false);
  const finishEstimateRef = useRef<HTMLDivElement | null>(null);

  const scopeReviewLines = useMemo((): ManualQuantityEditorLine[] => {
    const lines: ManualQuantityEditorLine[] = [];
    if (presentation.needsAttention.scopeReview.show) {
      for (const line of presentation.needsAttention.scopeReview.lines) {
        if (!line.reasons.includes("needs_quantity")) continue;
        lines.push({
          templateItemId: line.templateItemId,
          name: line.name,
          unitLabel: line.detailMeta.unit?.trim() || null,
        });
      }
    }
    if (presentation.upgradesZone.scopeReview.show) {
      for (const line of presentation.upgradesZone.scopeReview.lines) {
        if (!line.reasons.includes("needs_quantity")) continue;
        lines.push({
          templateItemId: line.templateItemId,
          name: line.name,
          unitLabel: line.detailMeta.unit?.trim() || null,
        });
      }
    }
    return lines;
  }, [presentation.needsAttention.scopeReview, presentation.upgradesZone.scopeReview]);

  const manualActiveLines = useMemo((): ManualQuantityActiveLine[] => {
    const lines: ManualQuantityActiveLine[] = [];
    for (const section of presentation.readyScope.sections) {
      for (const line of section.lines) {
        if (!line.manualQuantityActive) continue;
        lines.push({
          templateItemId: line.templateItemId,
          name: line.name,
          unitLabel: line.detailMeta.unit?.trim() || null,
          quantityDisplayLabel: line.qtyLabel,
        });
      }
    }
    for (const section of presentation.upgradesZone.sections) {
      for (const line of section.lines) {
        if (!line.manualQuantityActive) continue;
        lines.push({
          templateItemId: line.templateItemId,
          name: line.name,
          unitLabel: line.detailMeta.unit?.trim() || null,
          quantityDisplayLabel: line.qtyLabel,
        });
      }
    }
    return lines;
  }, [presentation.readyScope.sections, presentation.upgradesZone.sections]);

  const excludeEligibleLines = useMemo((): ExcludeEditorLine[] => {
    const lines: ExcludeEditorLine[] = [];
    const seen = new Set<string>();
    const pushLine = (templateItemId: string, name: string) => {
      if (seen.has(templateItemId)) return;
      seen.add(templateItemId);
      lines.push({ templateItemId, name });
    };
    for (const section of presentation.readyScope.sections) {
      for (const line of section.lines) {
        pushLine(line.templateItemId, line.name);
      }
    }
    for (const line of presentation.needsAttention.scopeReview.lines) {
      pushLine(line.templateItemId, line.name);
    }
    for (const section of presentation.upgradesZone.sections) {
      for (const line of section.lines) {
        if (!isUpgradeLineExcludeEligible(line)) continue;
        pushLine(line.templateItemId, line.name);
      }
    }
    return lines;
  }, [
    presentation.needsAttention.scopeReview.lines,
    presentation.readyScope.sections,
    presentation.upgradesZone.sections,
  ]);

  const hideEligibleLines = useMemo((): HideEditorLine[] => {
    const lines: HideEditorLine[] = [];
    for (const section of presentation.readyScope.sections) {
      for (const line of section.lines) {
        if (line.hiddenFromCustomer) continue;
        lines.push({ templateItemId: line.templateItemId, name: line.name });
      }
    }
    return lines;
  }, [presentation.readyScope.sections]);

  const quantityEditingEnabled =
    persistedDraftEnabled && Boolean(onApplyManualQuantity) && Boolean(onClearManualQuantity);
  const excludeEnabled = persistedDraftEnabled && Boolean(onExcludeLine) && Boolean(onRestoreExcludedLine);
  const visibilityEnabled =
    persistedDraftEnabled && Boolean(onHideLine) && Boolean(onRestoreVisibility);

  const hasEditableQuantityLines =
    scopeReviewLines.length > 0 || manualActiveLines.length > 0;
  const hasEditableScopeLines =
    hasEditableQuantityLines || excludeEligibleLines.length > 0 || hideEligibleLines.length > 0;

  /** Block 4E — Review quantities focuses Finish estimate only (no panel/drawer). */
  const focusFinishEstimate = useCallback(() => {
    setSetQuantityLineId(null);
    const node =
      finishEstimateRef.current ??
      document.getElementById("builder-finish-estimate");
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightFinishEstimate(true);
    window.setTimeout(() => setHighlightFinishEstimate(false), 1600);
    const firstRow = document.getElementById("builder-finish-estimate-first-row");
    firstRow?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const openEditPackage = useCallback(() => {
    setSetQuantityLineId(null);
    setDrawerIntent("quantity");
    setFocusedTemplateItemId((current) => {
      if (current) return current;
      return scopeReviewLines[0]?.templateItemId ?? manualActiveLines[0]?.templateItemId ?? null;
    });
    setEditPackageOpen(true);
  }, [manualActiveLines, scopeReviewLines]);

  const openSetQuantityForLine = useCallback((templateItemId: string) => {
    setEditPackageOpen(false);
    setSetQuantityLineId(templateItemId);
  }, []);

  const closeEditPackage = useCallback(() => {
    if (scopeEditInFlight) return;
    setEditPackageOpen(false);
    setFocusedTemplateItemId(null);
  }, [scopeEditInFlight]);

  const closeSetQuantity = useCallback(() => {
    if (scopeEditInFlight) return;
    setSetQuantityLineId(null);
  }, [scopeEditInFlight]);

  const handleApplyManualQuantity = useCallback(
    async (templateItemId: string, quantity: string, quantityDisplayLabel?: string | null) => {
      if (!onApplyManualQuantity) return;
      await onApplyManualQuantity(templateItemId, quantity, quantityDisplayLabel);
      setEditPackageOpen(false);
      setSetQuantityLineId(null);
      setFocusedTemplateItemId(null);
    },
    [onApplyManualQuantity]
  );

  const handleClearManualQuantity = useCallback(
    async (templateItemId: string) => {
      if (!onClearManualQuantity) return;
      await onClearManualQuantity(templateItemId);
      setEditPackageOpen(false);
      setSetQuantityLineId(null);
      setFocusedTemplateItemId(null);
    },
    [onClearManualQuantity]
  );

  const handleExcludeLine = useCallback(
    async (templateItemId: string) => {
      if (!onExcludeLine) return;
      await onExcludeLine(templateItemId);
      setEditPackageOpen(false);
      setSetQuantityLineId(null);
      setFocusedTemplateItemId(null);
    },
    [onExcludeLine]
  );

  const handleHideLine = useCallback(
    async (templateItemId: string) => {
      if (!onHideLine) return;
      await onHideLine(templateItemId);
      setEditPackageOpen(false);
      setFocusedTemplateItemId(null);
    },
    [onHideLine]
  );

  const handleRestoreVisibility = useCallback(
    async (templateItemId: string) => {
      if (!onRestoreVisibility) return;
      await onRestoreVisibility(templateItemId);
    },
    [onRestoreVisibility]
  );

  const handleRestoreExcludedLine = useCallback(
    async (templateItemId: string) => {
      if (!onRestoreExcludedLine) return;
      await onRestoreExcludedLine(templateItemId);
    },
    [onRestoreExcludedLine]
  );

  const scopeReviewManualQuantityEnabled =
    quantityEditingEnabled && scopeReviewLines.length > 0;

  const qtyNeeded = meta.scopeReviewLineCount;

  return (
    <article className={BUILDER_CANVAS} data-builder-estimate-document>
      <header className={WORKBENCH_HEADER}>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600">
            Proposal estimate
          </p>
          <h2 className={WORKBENCH_HEADER_TITLE}>{presentation.page.title}</h2>
          <p className={WORKBENCH_HEADER_SUBTITLE}>
            Build and review the customer estimate before opening Preview + Send.
          </p>
        </div>
      </header>

      <div className={WORKBENCH_BODY}>
        {qtyNeeded > 0 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3.5"
            data-builder-estimate-next-step
            data-builder-needs-review-strip
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <CircleAlert className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-slate-900">
                  Needs review before Preview + Send
                </p>
                <p className="mt-0.5 text-[12.5px] text-slate-600">
                  {qtyNeeded} estimate item{qtyNeeded === 1 ? "" : "s"} need quantities
                  before totals are final.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
              onClick={focusFinishEstimate}
              data-builder-review-quantities
            >
              Review quantities
            </button>
          </div>
        ) : null}

        <ProposalBuilderWorkbenchPackageZone
          packageZone={presentation.packageZone}
          packageSelectorGraph={packageSelectorGraph}
          draftScopedPackagePicker={draftScopedPackagePicker}
          selectedOptionId={selectedOptionId}
          effectiveOptionId={effectiveOptionId}
          onSelectOption={onSelectOption}
          onOpenEditPackage={openEditPackage}
        />

        <section
          className={WORKBENCH_MODULE}
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
            onRemoveFromProposal={excludeEnabled ? handleExcludeLine : undefined}
            removeEnabled={excludeEnabled}
            removeInFlight={excludeInFlight}
          />

          <ProposalBuilderWorkbenchTotalsZone zone={presentation.totalsZone} />

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
                      ? "1 line hidden from this package"
                      : `${presentation.decisionTraceZone.excluded.count} lines hidden from this package`}
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
                />
              </div>
            </details>
          ) : null}
        </section>

        <div ref={finishEstimateRef}>
          <ProposalBuilderWorkbenchAttentionZone
            zone={presentation.needsAttention}
            editingQuantityLineId={setQuantityLineId}
            onStartSetQuantity={
              quantityEditingEnabled ? openSetQuantityForLine : undefined
            }
            onCancelSetQuantity={closeSetQuantity}
            onSaveQuantity={
              quantityEditingEnabled ? handleApplyManualQuantity : undefined
            }
            quantitySaveInFlight={manualQuantityInFlight}
            quantitySaveError={manualQuantityError}
            manualQuantityEnabled={scopeReviewManualQuantityEnabled}
            highlightFinishEstimate={highlightFinishEstimate}
          />
        </div>

        {/*
          Optional upgrades include/replace is unsupported — section hidden from main Builder path.
          Upgrade quantity blockers merge into Finish estimate via the presenter.
          Follow-up: additive upgrades add to included estimate; replacement upgrades replace base items.
        */}
      </div>

      <ProposalBuilderWorkbenchEditOptionShell
        open={editPackageOpen}
        onClose={closeEditPackage}
        optionLabel={presentation.packageZone.label}
        scopeReviewCount={meta.scopeReviewLineCount + meta.upgradeScopeReviewLineCount}
        scopeReviewLines={scopeReviewLines}
        excludeEligibleLines={excludeEligibleLines}
        hideEligibleLines={hideEligibleLines}
        manualActiveLines={manualActiveLines}
        focusedTemplateItemId={focusedTemplateItemId}
        drawerIntent={drawerIntent}
        onFocusTemplateItemId={setFocusedTemplateItemId}
        persistedDraftEnabled={persistedDraftEnabled && hasEditableScopeLines}
        scopeEditInFlight={scopeEditInFlight}
        manualQuantityError={manualQuantityError}
        excludeError={excludeError}
        visibilityError={visibilityError}
        onApplyManualQuantity={handleApplyManualQuantity}
        onClearManualQuantity={handleClearManualQuantity}
        onExcludeLine={handleExcludeLine}
        onHideLine={handleHideLine}
      />
    </article>
  );
}
