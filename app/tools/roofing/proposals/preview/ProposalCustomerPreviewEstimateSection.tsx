"use client";

import type { ProposalCustomerPreviewEstimatePage } from "@/app/lib/proposalCustomerPreviewViewModel";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  filterSectionsForEstimateCanvas,
  getSectionsForOption,
} from "@/app/lib/proposalBuilderPreview";
import ProposalBuilderDocumentTotals from "../builder/ProposalBuilderDocumentTotals";
import ProposalBuilderSectionPreview from "../builder/ProposalBuilderSectionPreview";
import {
  BUILDER_CANVAS,
  BUILDER_CANVAS_HERO_DIVIDER,
  BUILDER_CANVAS_INNER,
} from "../builder/proposalBuilderConstants";

type ProposalCustomerPreviewEstimateSectionProps = {
  page: ProposalCustomerPreviewEstimatePage;
  templateGraph: ProposalTemplateGraph;
  catalogItems: CatalogItem[];
};

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

  return (
    <article className={BUILDER_CANVAS}>
      <header className={BUILDER_CANVAS_HERO_DIVIDER}>
        <div className="space-y-2 px-7 pb-5 pt-5">
          <h2 className="text-xl font-semibold leading-tight tracking-tight text-slate-950">
            {page.title}
          </h2>
          {page.selectedOptionLabel ? (
            <p className="text-[13px] text-slate-500">
              Selected package:{" "}
              <span className="font-medium text-slate-700">{page.selectedOptionLabel}</span>
            </p>
          ) : null}
        </div>
      </header>

      <div className={`${BUILDER_CANVAS_INNER} space-y-6 px-7 pb-7 pt-6`}>
        {sections.length === 0 ? (
          <p className="text-sm text-slate-500">No line items for the selected package.</p>
        ) : (
          sections.map((section) => (
            <ProposalBuilderSectionPreview
              key={section.id}
              graph={templateGraph}
              section={section}
              catalogItems={catalogItems}
              measurementHandoff={null}
              measurementQuantityMap={null}
              optionCustomerView={optionCustomerView}
              snapshotQuantityByTemplateItemId={page.snapshotQuantityByTemplateItemId}
              pricingPolicyConfigured={page.pricingPolicyConfigured}
            />
          ))
        )}

        <ProposalBuilderDocumentTotals
          optionCustomerView={optionCustomerView}
          pricingPolicyConfigured={page.pricingPolicyConfigured}
        />
      </div>
    </article>
  );
}
