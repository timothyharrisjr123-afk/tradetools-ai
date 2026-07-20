"use client";

import type { ProposalCustomerPreviewDocument } from "@/app/lib/proposalCustomerPreviewViewModel";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import { buildCustomerPreviewEstimatePresentation } from "@/app/lib/proposalCustomerEstimatePresenter";
import {
  filterSectionsForEstimateCanvas,
  getSectionsForOption,
} from "@/app/lib/proposalBuilderPreview";
import { PROPOSAL_COVER_DEFAULT_BRAND_ACCENT } from "@/app/lib/proposalCoverViewModel";
import { resolvePackageMeta } from "@/app/lib/proposalPackagePresentation";
import ProposalCustomerPreviewPacket from "./ProposalCustomerPreviewPacket";
import ProposalCustomerPreviewPacketCover from "./ProposalCustomerPreviewPacketCover";
import ProposalCustomerPreviewPackageStrip from "./ProposalCustomerPreviewPackageStrip";
import ProposalCustomerPreviewEstimateTable from "./ProposalCustomerPreviewEstimateTable";
import ProposalCustomerPreviewPacketSection from "./ProposalCustomerPreviewPacketSection";

type ProposalCustomerPreviewDocumentProps = {
  document: ProposalCustomerPreviewDocument;
  templateGraph: ProposalTemplateGraph | null;
  catalogItems: CatalogItem[];
};

/**
 * Block 5C — "Premium Roofing Proposal Packet" composer.
 *
 * Assembles the single continuous customer packet from view-model pages:
 * cover → proposed package → included estimate → totals → meaningful content.
 * Thin composer only — all visual language lives in the packet components.
 */
export default function ProposalCustomerPreviewDocumentView({
  document,
  templateGraph,
  catalogItems,
}: ProposalCustomerPreviewDocumentProps) {
  const coverPage = document.pages.find((page) => page.kind === "cover");
  const estimatePage = document.pages.find((page) => page.kind === "estimate");
  const textPages = document.pages.filter(
    (page) => page.kind === "text" && !page.isEmpty
  );

  const accentColor =
    coverPage?.kind === "cover"
      ? coverPage.viewModel.company.brandPrimaryColor ?? PROPOSAL_COVER_DEFAULT_BRAND_ACCENT
      : PROPOSAL_COVER_DEFAULT_BRAND_ACCENT;

  const estimatePresentation =
    estimatePage?.kind === "estimate" && templateGraph
      ? buildCustomerPreviewEstimatePresentation({
          graph: templateGraph,
          sections: filterSectionsForEstimateCanvas(
            estimatePage.selectedTemplateOptionId != null
              ? getSectionsForOption(templateGraph, estimatePage.selectedTemplateOptionId)
              : []
          ),
          catalogItems,
          optionCustomerView: estimatePage.optionPreview?.customer ?? null,
          selectedOptionLabel: estimatePage.selectedOptionLabel,
          packageMeta: estimatePage.selectedOptionLabel
            ? resolvePackageMeta(estimatePage.selectedOptionLabel)
            : null,
          estimatePageSettings: estimatePage.estimatePageSettings,
          snapshotQuantityByTemplateItemId: estimatePage.snapshotQuantityByTemplateItemId,
        })
      : null;

  return (
    <ProposalCustomerPreviewPacket accentColor={accentColor}>
      {coverPage?.kind === "cover" ? (
        <ProposalCustomerPreviewPacketCover viewModel={coverPage.viewModel} />
      ) : null}

      {estimatePresentation ? (
        <>
          <ProposalCustomerPreviewPackageStrip
            packageHero={estimatePresentation.packageHero}
            totals={estimatePresentation.totals}
          />
          <ProposalCustomerPreviewEstimateTable
            sections={estimatePresentation.scopeSections}
            totals={estimatePresentation.totals}
          />
        </>
      ) : null}

      {textPages.map((page) =>
        page.kind === "text" ? (
          <ProposalCustomerPreviewPacketSection
            key={page.id}
            title={page.title}
            body={page.displayText}
          />
        ) : null
      )}
    </ProposalCustomerPreviewPacket>
  );
}
