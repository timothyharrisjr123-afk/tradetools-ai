"use client";

import type { ProposalCustomerPreviewDocument } from "@/app/lib/proposalCustomerPreviewViewModel";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import ProposalBuilderCoverPage from "../builder/ProposalBuilderCoverPage";
import ProposalBuilderCustomerPage from "../builder/ProposalBuilderCustomerPage";
import {
  BUILDER_CANVAS_INNER,
  CUSTOMER_PREVIEW_DOCUMENT_SECTION,
  CUSTOMER_PREVIEW_DOCUMENT_SHELL,
} from "../builder/proposalBuilderConstants";
import ProposalCustomerPreviewEstimateSection from "./ProposalCustomerPreviewEstimateSection";

type ProposalCustomerPreviewDocumentProps = {
  document: ProposalCustomerPreviewDocument;
  templateGraph: ProposalTemplateGraph | null;
  catalogItems: CatalogItem[];
};

/**
 * Block 5B — continuous wide customer proposal document.
 * One premium surface (Builder stage width), not stacked narrow cards.
 */
export default function ProposalCustomerPreviewDocumentView({
  document,
  templateGraph,
  catalogItems,
}: ProposalCustomerPreviewDocumentProps) {
  return (
    <div
      className={CUSTOMER_PREVIEW_DOCUMENT_SHELL}
      data-preview-customer-document
      data-preview-document-wide
    >
      {document.pages.map((page) => {
        if (page.kind === "cover") {
          return (
            <section key={page.id} className={CUSTOMER_PREVIEW_DOCUMENT_SECTION}>
              <ProposalBuilderCoverPage
                viewModel={page.viewModel}
                showDraftNote={false}
              />
            </section>
          );
        }

        if (page.kind === "text") {
          if (page.isEmpty) {
            return null;
          }

          return (
            <section key={page.id} className={CUSTOMER_PREVIEW_DOCUMENT_SECTION}>
              <ProposalBuilderCustomerPage
                pageType={page.pageType}
                title={page.title}
                bodyMarkdown={page.displayText}
                emptyStateText=""
                showEditHint={false}
                showReadOnlyFooter={false}
              />
            </section>
          );
        }

        if (page.kind === "estimate") {
          if (!templateGraph) {
            return (
              <section key={page.id} className={CUSTOMER_PREVIEW_DOCUMENT_SECTION}>
                <div className={`${BUILDER_CANVAS_INNER} px-7 py-8`}>
                  <p className="text-sm text-slate-500">Estimate template is not available.</p>
                </div>
              </section>
            );
          }

          return (
            <section key={page.id} className={CUSTOMER_PREVIEW_DOCUMENT_SECTION}>
              <ProposalCustomerPreviewEstimateSection
                page={page}
                templateGraph={templateGraph}
                catalogItems={catalogItems}
              />
            </section>
          );
        }

        // photos / pdf placeholders — unsupported; never render in customer document
        return null;
      })}
    </div>
  );
}
