"use client";

import type { ProposalCustomerPreviewDocument } from "@/app/lib/proposalCustomerPreviewViewModel";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import ProposalBuilderCoverPage from "../builder/ProposalBuilderCoverPage";
import ProposalBuilderCustomerPage from "../builder/ProposalBuilderCustomerPage";
import {
  BUILDER_CANVAS,
  BUILDER_CANVAS_INNER,
} from "../builder/proposalBuilderConstants";
import ProposalCustomerPreviewEstimateSection from "./ProposalCustomerPreviewEstimateSection";

type ProposalCustomerPreviewDocumentProps = {
  document: ProposalCustomerPreviewDocument;
  templateGraph: ProposalTemplateGraph | null;
  catalogItems: CatalogItem[];
};

export default function ProposalCustomerPreviewDocumentView({
  document,
  templateGraph,
  catalogItems,
}: ProposalCustomerPreviewDocumentProps) {
  return (
    <div className="space-y-8" data-preview-customer-document>
      {document.pages.map((page) => {
        if (page.kind === "cover") {
          return (
            <ProposalBuilderCoverPage
              key={page.id}
              viewModel={page.viewModel}
              showDraftNote={false}
            />
          );
        }

        if (page.kind === "text") {
          // Stub / empty text pages are already omitted by the view model.
          // Never render empty-state placeholder copy inside the customer document.
          if (page.isEmpty) {
            return null;
          }

          return (
            <ProposalBuilderCustomerPage
              key={page.id}
              pageType={page.pageType}
              title={page.title}
              bodyMarkdown={page.displayText}
              emptyStateText=""
              showEditHint={false}
              showReadOnlyFooter={false}
            />
          );
        }

        if (page.kind === "estimate") {
          if (!templateGraph) {
            return (
              <article key={page.id} className={BUILDER_CANVAS}>
                <div className={`${BUILDER_CANVAS_INNER} px-7 py-8`}>
                  <p className="text-sm text-slate-500">Estimate template is not available.</p>
                </div>
              </article>
            );
          }

          return (
            <ProposalCustomerPreviewEstimateSection
              key={page.id}
              page={page}
              templateGraph={templateGraph}
              catalogItems={catalogItems}
            />
          );
        }

        // photos / pdf placeholders — unsupported; never render in customer document
        return null;
      })}
    </div>
  );
}
