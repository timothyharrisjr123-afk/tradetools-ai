"use client";

import type { ProposalCustomerPreviewDocument } from "@/app/lib/proposalCustomerPreviewViewModel";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import ProposalBuilderCoverPage from "../builder/ProposalBuilderCoverPage";
import ProposalBuilderCustomerPage from "../builder/ProposalBuilderCustomerPage";
import {
  BUILDER_CANVAS,
  BUILDER_CANVAS_INNER,
  BUILDER_CANVAS_PLACEHOLDER,
} from "../builder/proposalBuilderConstants";
import ProposalCustomerPreviewEstimateSection from "./ProposalCustomerPreviewEstimateSection";

type ProposalCustomerPreviewDocumentProps = {
  document: ProposalCustomerPreviewDocument;
  templateGraph: ProposalTemplateGraph | null;
  catalogItems: CatalogItem[];
};

function emptyStateForPageType(pageType: string): string {
  switch (pageType) {
    case "project_overview":
      return "Project overview content will appear here.";
    case "terms":
      return "Terms will appear here.";
    case "warranty":
      return "Warranty details will appear here.";
    default:
      return "Page content will appear here.";
  }
}

export default function ProposalCustomerPreviewDocumentView({
  document,
  templateGraph,
  catalogItems,
}: ProposalCustomerPreviewDocumentProps) {
  return (
    <div className="space-y-8">
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
          return (
            <ProposalBuilderCustomerPage
              key={page.id}
              pageType={page.pageType}
              title={page.title}
              bodyMarkdown={page.isEmpty ? null : page.displayText}
              emptyStateText={emptyStateForPageType(page.pageType)}
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

        return (
          <article key={page.id} className={BUILDER_CANVAS}>
            <div className={`${BUILDER_CANVAS_INNER} space-y-4 px-7 py-8`}>
              <h2 className="text-xl font-semibold text-slate-950">{page.title}</h2>
              <div className={`${BUILDER_CANVAS_PLACEHOLDER} min-h-[12rem]`}>
                <p className="text-sm text-slate-600">{page.message}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
