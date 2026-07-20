"use client";

import type { ProposalCustomerPreviewEstimatePage } from "@/app/lib/proposalCustomerPreviewViewModel";
import { buildCustomerPreviewEstimatePresentation } from "@/app/lib/proposalCustomerEstimatePresenter";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  filterSectionsForEstimateCanvas,
  getSectionsForOption,
} from "@/app/lib/proposalBuilderPreview";
import { resolvePackageMeta } from "@/app/lib/proposalPackagePresentation";
import {
  BUILDER_CANVAS_HERO_DIVIDER,
  BUILDER_CANVAS_INNER,
  BUILDER_CANVAS_KICKER,
  CUSTOMER_PREVIEW_ESTIMATE_CHAPTER_KICKER,
  CUSTOMER_PREVIEW_ESTIMATE_CHAPTER_SUBTITLE,
} from "../builder/proposalBuilderConstants";
import ProposalCustomerPreviewEstimateDocument from "./ProposalCustomerPreviewEstimateDocument";

type ProposalCustomerPreviewEstimateSectionProps = {
  page: ProposalCustomerPreviewEstimatePage;
  templateGraph: ProposalTemplateGraph;
  catalogItems: CatalogItem[];
};

/**
 * Block 5B — estimate chapter inside the continuous customer document.
 * No nested card wrapper; uses Builder Item/Qty/Price density without edit chrome.
 */
export default function ProposalCustomerPreviewEstimateSection({
  page,
  templateGraph,
  catalogItems,
}: ProposalCustomerPreviewEstimateSectionProps) {
  const optionId = page.selectedTemplateOptionId;
  const allSections =
    optionId != null ? getSectionsForOption(templateGraph, optionId) : [];
  const sections = filterSectionsForEstimateCanvas(allSections);
  const optionCustomerView = page.optionPreview?.customer ?? null;

  const packageMeta = page.selectedOptionLabel
    ? resolvePackageMeta(page.selectedOptionLabel)
    : null;

  const presentation = buildCustomerPreviewEstimatePresentation({
    graph: templateGraph,
    sections,
    catalogItems,
    optionCustomerView,
    selectedOptionLabel: page.selectedOptionLabel,
    packageMeta,
    estimatePageSettings: page.estimatePageSettings,
    snapshotQuantityByTemplateItemId: page.snapshotQuantityByTemplateItemId,
  });

  const chapterTitle = page.title;
  const pricingComplete = optionCustomerView?.pricingComplete ?? false;

  return (
    <article data-preview-estimate-section>
      <header className={BUILDER_CANVAS_HERO_DIVIDER}>
        <div className="space-y-1 px-7 pb-4 pt-5 sm:px-8">
          <p className={BUILDER_CANVAS_KICKER}>{CUSTOMER_PREVIEW_ESTIMATE_CHAPTER_KICKER}</p>
          <h2 className="text-xl font-semibold leading-tight tracking-tight text-slate-950">
            {chapterTitle}
          </h2>
          <p className="text-[14px] leading-relaxed text-slate-500">
            {CUSTOMER_PREVIEW_ESTIMATE_CHAPTER_SUBTITLE}
          </p>
        </div>
      </header>

      <div className={`${BUILDER_CANVAS_INNER} px-7 pb-8 pt-5 sm:px-8`}>
        <ProposalCustomerPreviewEstimateDocument
          presentation={presentation}
          chapterTitle={chapterTitle}
          pricingComplete={pricingComplete}
        />
      </div>
    </article>
  );
}
