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

/**
 * Block 5 Roofr-first — centered customer proposal document hero.
 * Only customer-safe, meaningful content. No contractor cockpit.
 */
export default function ProposalCustomerPreviewDocumentView({
  document,
  templateGraph,
  catalogItems,
}: ProposalCustomerPreviewDocumentProps) {
  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-6"
      data-preview-customer-document
    >
      {document.pages.map((page) => {
        if (page.kind === "cover") {
          return (
            <div
              key={page.id}
              className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5"
            >
              <ProposalBuilderCoverPage
                viewModel={page.viewModel}
                showDraftNote={false}
              />
            </div>
          );
        }

        if (page.kind === "text") {
          if (page.isEmpty) {
            return null;
          }

          return (
            <div
              key={page.id}
              className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5"
            >
              <ProposalBuilderCustomerPage
                pageType={page.pageType}
                title={page.title}
                bodyMarkdown={page.displayText}
                emptyStateText=""
                showEditHint={false}
                showReadOnlyFooter={false}
              />
            </div>
          );
        }

        if (page.kind === "estimate") {
          if (!templateGraph) {
            return (
              <article
                key={page.id}
                className={`${BUILDER_CANVAS} overflow-hidden rounded-xl border border-slate-200/90 shadow-sm ring-1 ring-slate-900/5`}
              >
                <div className={`${BUILDER_CANVAS_INNER} px-7 py-8`}>
                  <p className="text-sm text-slate-500">Estimate template is not available.</p>
                </div>
              </article>
            );
          }

          return (
            <div
              key={page.id}
              className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5"
            >
              <ProposalCustomerPreviewEstimateSection
                page={page}
                templateGraph={templateGraph}
                catalogItems={catalogItems}
              />
            </div>
          );
        }

        // photos / pdf placeholders — unsupported; never render in customer document
        return null;
      })}
    </div>
  );
}
