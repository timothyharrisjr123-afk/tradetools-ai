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
import { useCallback, useState } from "react";
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
import ProposalBuilderWorkbenchEditOptionShell from "./ProposalBuilderWorkbenchEditOptionShell";
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

  const openEditOption = useCallback(() => {
    setEditOptionOpen(true);
  }, []);

  const closeEditOption = useCallback(() => {
    setEditOptionOpen(false);
  }, []);

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

        <ProposalBuilderWorkbenchReadyScopeZone sections={presentation.readyScope.sections} />

        <ProposalBuilderWorkbenchAttentionZone
          zone={presentation.needsAttention}
          onOpenEditOption={openEditOption}
        />

        <ProposalBuilderWorkbenchUpgradesZone zone={presentation.upgradesZone} />

        <ProposalBuilderWorkbenchTotalsZone zone={presentation.totalsZone} />
      </div>

      <ProposalBuilderWorkbenchEditOptionShell
        open={editOptionOpen}
        onClose={closeEditOption}
        optionLabel={presentation.packageZone.label}
        scopeReviewCount={meta.scopeReviewLineCount}
      />
    </article>
  );
}
