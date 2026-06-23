"use client";

import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import type { MeasurementQuantityMap } from "@/app/lib/measurementTypes";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalBuilderOptionCustomerView } from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalSnapshotLineQuantityView } from "@/app/lib/proposalDraftGraphAdapter";
import { buildProposalWorkbenchEstimatePresentation } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateSection } from "@/app/lib/proposalTemplateTypes";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";
import { useCallback, useMemo, useState } from "react";
import {
  BUILDER_CANVAS,
  BUILDER_PAGE_VISIBILITY_REQUIRED_NOTICE,
  WORKBENCH_BODY,
  WORKBENCH_ESTIMATE_KICKER,
  WORKBENCH_HEADER,
  WORKBENCH_HEADER_KICKER,
  WORKBENCH_HEADER_STAT,
  WORKBENCH_HEADER_STAT_READY,
  WORKBENCH_HEADER_STAT_REVIEW,
  WORKBENCH_HEADER_SUBTITLE,
  WORKBENCH_HEADER_TITLE,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchAttentionZone from "./ProposalBuilderWorkbenchAttentionZone";
import ProposalBuilderWorkbenchEditOptionShell, {
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
  manualQuantityInFlight?: boolean;
  manualQuantityError?: string | null;
  onApplyManualQuantity?: (
    templateItemId: string,
    quantity: string,
    quantityDisplayLabel?: string | null
  ) => Promise<void>;
  onClearManualQuantity?: (templateItemId: string) => Promise<void>;
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
  manualQuantityInFlight = false,
  manualQuantityError = null,
  onApplyManualQuantity,
  onClearManualQuantity,
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
  });

  const { meta } = presentation;

  const [editOptionOpen, setEditOptionOpen] = useState(false);
  const [focusedTemplateItemId, setFocusedTemplateItemId] = useState<string | null>(null);

  const scopeReviewLines = useMemo((): ManualQuantityEditorLine[] => {
    if (!presentation.needsAttention.scopeReview.show) return [];
    return presentation.needsAttention.scopeReview.lines
      .filter((line) => line.reasons.includes("needs_quantity"))
      .map((line) => ({
        templateItemId: line.templateItemId,
        name: line.name,
        unitLabel: line.detailMeta.unit?.trim() || null,
      }));
  }, [presentation.needsAttention.scopeReview]);

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
    return lines;
  }, [presentation.readyScope.sections]);

  const quantityEditingEnabled =
    persistedDraftEnabled && Boolean(onApplyManualQuantity) && Boolean(onClearManualQuantity);

  const hasEditableQuantityLines =
    scopeReviewLines.length > 0 || manualActiveLines.length > 0;

  const openEditOption = useCallback(() => {
    setFocusedTemplateItemId((current) => {
      if (current) return current;
      return scopeReviewLines[0]?.templateItemId ?? manualActiveLines[0]?.templateItemId ?? null;
    });
    setEditOptionOpen(true);
  }, [manualActiveLines, scopeReviewLines]);

  const openEditOptionForLine = useCallback((templateItemId: string) => {
    setFocusedTemplateItemId(templateItemId);
    setEditOptionOpen(true);
  }, []);

  const closeEditOption = useCallback(() => {
    if (manualQuantityInFlight) return;
    setEditOptionOpen(false);
    setFocusedTemplateItemId(null);
  }, [manualQuantityInFlight]);

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

  const scopeReviewManualQuantityEnabled =
    quantityEditingEnabled && scopeReviewLines.length > 0;

  return (
    <article className={BUILDER_CANVAS}>
      <header className={WORKBENCH_HEADER}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className={WORKBENCH_HEADER_KICKER}>{WORKBENCH_ESTIMATE_KICKER}</p>
            <h2 className={WORKBENCH_HEADER_TITLE}>{presentation.page.title}</h2>
            <p className={WORKBENCH_HEADER_SUBTITLE}>{presentation.page.subtitle}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={WORKBENCH_HEADER_STAT}>
                <span className={WORKBENCH_HEADER_STAT_READY}>{meta.readyLineCount}</span>
                <span>customer-ready</span>
              </span>
              {meta.scopeReviewLineCount > 0 ? (
                <span className={WORKBENCH_HEADER_STAT}>
                  <span className={WORKBENCH_HEADER_STAT_REVIEW}>{meta.scopeReviewLineCount}</span>
                  <span>to review</span>
                </span>
              ) : null}
              {meta.hardBlockerLineCount > 0 ? (
                <span className={WORKBENCH_HEADER_STAT}>
                  <span className="font-semibold tabular-nums text-amber-700">
                    {meta.hardBlockerLineCount}
                  </span>
                  <span>pricing blocker{meta.hardBlockerLineCount === 1 ? "" : "s"}</span>
                </span>
              ) : null}
              {presentation.totalsZone.pricingComplete ? (
                <span className={WORKBENCH_HEADER_STAT}>
                  <span className="font-semibold text-emerald-700">Pricing complete</span>
                </span>
              ) : (
                <span className={WORKBENCH_HEADER_STAT}>
                  <span className="font-semibold text-amber-700">Pricing incomplete</span>
                </span>
              )}
            </div>
          </div>

          <span className={BUILDER_PAGE_VISIBILITY_REQUIRED_NOTICE}>{estimateVisibilityNotice}</span>
        </div>
      </header>

      <div className={WORKBENCH_BODY}>
        <ProposalBuilderWorkbenchPackageZone
          packageZone={presentation.packageZone}
          graph={graph}
          selectedOptionId={selectedOptionId}
          effectiveOptionId={effectiveOptionId}
          onSelectOption={onSelectOption}
          onOpenEditOption={openEditOption}
        />

        <ProposalBuilderWorkbenchSettingsEntry entry={presentation.displaySettingsEntry} />

        <ProposalBuilderWorkbenchReadyScopeZone
          sections={presentation.readyScope.sections}
          onEditQuantityForLine={
            quantityEditingEnabled ? openEditOptionForLine : undefined
          }
        />

        <ProposalBuilderWorkbenchAttentionZone
          zone={presentation.needsAttention}
          onOpenEditOption={openEditOption}
          onSetQuantityForLine={openEditOptionForLine}
          manualQuantityEnabled={scopeReviewManualQuantityEnabled}
        />

        <ProposalBuilderWorkbenchUpgradesZone zone={presentation.upgradesZone} />

        <ProposalBuilderWorkbenchTotalsZone zone={presentation.totalsZone} />
      </div>

      <ProposalBuilderWorkbenchEditOptionShell
        open={editOptionOpen}
        onClose={closeEditOption}
        optionLabel={presentation.packageZone.label}
        scopeReviewCount={meta.scopeReviewLineCount}
        scopeReviewLines={scopeReviewLines}
        manualActiveLines={manualActiveLines}
        focusedTemplateItemId={focusedTemplateItemId}
        onFocusTemplateItemId={setFocusedTemplateItemId}
        persistedDraftEnabled={quantityEditingEnabled && hasEditableQuantityLines}
        manualQuantityInFlight={manualQuantityInFlight}
        manualQuantityError={manualQuantityError}
        onApplyManualQuantity={handleApplyManualQuantity}
        onClearManualQuantity={handleClearManualQuantity}
      />
    </article>
  );
}
