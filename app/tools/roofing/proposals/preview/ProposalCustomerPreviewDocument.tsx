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
import ProposalCustomerPreviewTrustBridge from "./ProposalCustomerPreviewTrustBridge";
import ProposalCustomerPreviewEstimateTable from "./ProposalCustomerPreviewEstimateTable";
import ProposalCustomerPreviewPacketSection from "./ProposalCustomerPreviewPacketSection";
import { PACKET_FOOTER } from "./proposalCustomerPacketStyles";

type ProposalCustomerPreviewDocumentProps = {
  document: ProposalCustomerPreviewDocument;
  templateGraph: ProposalTemplateGraph | null;
  catalogItems: CatalogItem[];
};

/**
 * Customer-safe proposal content for the contractor review surface.
 * Identity → title → package → why → estimate → content.
 */
export default function ProposalCustomerPreviewDocumentView({
  document,
  templateGraph,
  catalogItems,
}: ProposalCustomerPreviewDocumentProps) {
  const coverPage = document.pages.find((page) => page.kind === "cover");
  const estimatePage = document.pages.find((page) => page.kind === "estimate");
  const textPages = document.pages.filter((page) => page.kind === "text" && !page.isEmpty);

  const accentColor =
    coverPage?.kind === "cover"
      ? coverPage.viewModel.company.brandPrimaryColor ?? PROPOSAL_COVER_DEFAULT_BRAND_ACCENT
      : PROPOSAL_COVER_DEFAULT_BRAND_ACCENT;

  const companyName =
    coverPage?.kind === "cover" ? coverPage.viewModel.company.companyName : null;

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
    <ProposalCustomerPreviewPacket>
      {coverPage?.kind === "cover" ? (
        <ProposalCustomerPreviewPacketCover
          viewModel={coverPage.viewModel}
          accentColor={accentColor}
          selectedPackageLabel={
            estimatePresentation?.packageHero.label ?? estimatePage?.selectedOptionLabel ?? null
          }
        />
      ) : null}

      {estimatePresentation ? (
        <>
          <ProposalCustomerPreviewPackageStrip
            packageHero={estimatePresentation.packageHero}
            totals={estimatePresentation.totals}
            accentColor={accentColor}
          />
          <ProposalCustomerPreviewTrustBridge
            packageLabel={estimatePresentation.packageHero.label}
            companyName={companyName}
          />
          <ProposalCustomerPreviewEstimateTable
            sections={[
              ...estimatePresentation.scopeSections,
              ...estimatePresentation.upgradeSections,
            ]}
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

      {companyName ? (
        <footer className={PACKET_FOOTER} data-preview-packet-footer>
          Prepared by {companyName}. This proposal is for review and is not a final contract until
          accepted.
        </footer>
      ) : null}
    </ProposalCustomerPreviewPacket>
  );
}
