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
import { useCallback, useMemo, useState } from "react";
import {
  BUILDER_CANVAS,
  WORKBENCH_BODY,
  WORKBENCH_HEADER,
  WORKBENCH_HEADER_SUBTITLE,
  WORKBENCH_HEADER_TITLE,
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
import ProposalBuilderWorkbenchSettingsEntry from "./ProposalBuilderWorkbenchSettingsEntry";
import ProposalBuilderWorkbenchTotalsZone from "./ProposalBuilderWorkbenchTotalsZone";
import ProposalBuilderWorkbenchUpgradesZone from "./ProposalBuilderWorkbenchUpgradesZone";

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

  const [editOptionOpen, setEditOptionOpen] = useState(false);
  const [focusedTemplateItemId, setFocusedTemplateItemId] = useState<string | null>(null);
  const [drawerIntent, setDrawerIntent] = useState<EditOptionDrawerIntent>("quantity");

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

  const openEditOption = useCallback(() => {
    setDrawerIntent("quantity");
    setFocusedTemplateItemId((current) => {
      if (current) return current;
      return scopeReviewLines[0]?.templateItemId ?? manualActiveLines[0]?.templateItemId ?? null;
    });
    setEditOptionOpen(true);
  }, [manualActiveLines, scopeReviewLines]);

  const openEditOptionForLine = useCallback(
    (templateItemId: string, intent: EditOptionDrawerIntent = "quantity") => {
      setDrawerIntent(intent);
      setFocusedTemplateItemId(templateItemId);
      setEditOptionOpen(true);
    },
    []
  );

  const closeEditOption = useCallback(() => {
    if (scopeEditInFlight) return;
    setEditOptionOpen(false);
    setFocusedTemplateItemId(null);
  }, [scopeEditInFlight]);

  const handleApplyManualQuantity = useCallback(
    async (templateItemId: string, quantity: string, quantityDisplayLabel?: string | null) => {
      if (!onApplyManualQuantity) return;
      await onApplyManualQuantity(templateItemId, quantity, quantityDisplayLabel);
      setEditOptionOpen(false);
      setFocusedTemplateItemId(null);
    },
    [onApplyManualQuantity]
  );

  const handleClearManualQuantity = useCallback(
    async (templateItemId: string) => {
      if (!onClearManualQuantity) return;
      await onClearManualQuantity(templateItemId);
      setEditOptionOpen(false);
      setFocusedTemplateItemId(null);
    },
    [onClearManualQuantity]
  );

  const handleExcludeLine = useCallback(
    async (templateItemId: string) => {
      if (!onExcludeLine) return;
      await onExcludeLine(templateItemId);
      setEditOptionOpen(false);
      setFocusedTemplateItemId(null);
    },
    [onExcludeLine]
  );

  const handleHideLine = useCallback(
    async (templateItemId: string) => {
      if (!onHideLine) return;
      await onHideLine(templateItemId);
      setEditOptionOpen(false);
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
          <h2 className={WORKBENCH_HEADER_TITLE}>{presentation.page.title}</h2>
          <p className={WORKBENCH_HEADER_SUBTITLE}>
            Review the estimate before previewing.
          </p>
        </div>
      </header>

      <div className={WORKBENCH_BODY}>
        {qtyNeeded > 0 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-md border border-slate-200/80 bg-slate-50/60 px-3 py-2"
            data-builder-estimate-next-step
            data-builder-needs-review-strip
          >
            <p className="min-w-0 text-[13px] text-slate-700">
              <span className="font-semibold text-slate-900">Needs review:</span>{" "}
              {qtyNeeded} quantit{qtyNeeded === 1 ? "y" : "ies"} needed before totals are
              final.
            </p>
            <button
              type="button"
              className="inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-blue-700 transition hover:bg-blue-50"
              onClick={openEditOption}
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
          onOpenEditOption={openEditOption}
        />

        <ProposalBuilderWorkbenchReadyScopeZone
          sections={presentation.readyScope.sections}
          onEditQuantityForLine={
            quantityEditingEnabled
              ? (templateItemId) => openEditOptionForLine(templateItemId, "quantity")
              : undefined
          }
        />

        <ProposalBuilderWorkbenchAttentionZone
          zone={presentation.needsAttention}
          onOpenEditOption={openEditOption}
          onSetQuantityForLine={
            quantityEditingEnabled
              ? (templateItemId) => openEditOptionForLine(templateItemId, "quantity")
              : undefined
          }
          manualQuantityEnabled={scopeReviewManualQuantityEnabled}
          excludeEnabled={false}
        />

        <ProposalBuilderWorkbenchUpgradesZone
          zone={presentation.upgradesZone}
          onSetQuantityForLine={
            quantityEditingEnabled
              ? (templateItemId) => openEditOptionForLine(templateItemId, "quantity")
              : undefined
          }
          onEditQuantityForLine={
            quantityEditingEnabled
              ? (templateItemId) => openEditOptionForLine(templateItemId, "quantity")
              : undefined
          }
          manualQuantityEnabled={scopeReviewManualQuantityEnabled}
          excludeEnabled={false}
        />

        <ProposalBuilderWorkbenchTotalsZone zone={presentation.totalsZone} />

        <ProposalBuilderWorkbenchSettingsEntry
          entry={presentation.displaySettingsEntry}
          saving={estimateSettingsSaveInFlight}
          error={estimateSettingsSaveError}
          onToggleSetting={onToggleEstimateDisplaySetting}
        />

        {presentation.decisionTraceZone.show ? (
          <details className="rounded-lg border border-slate-200/70 bg-white text-[12px] text-slate-500">
            <summary className="cursor-pointer list-none px-3 py-2 font-medium text-slate-500 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              Removed lines
            </summary>
            <div className="border-t border-slate-100 px-2 py-2">
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
      </div>

      <ProposalBuilderWorkbenchEditOptionShell
        open={editOptionOpen}
        onClose={closeEditOption}
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
