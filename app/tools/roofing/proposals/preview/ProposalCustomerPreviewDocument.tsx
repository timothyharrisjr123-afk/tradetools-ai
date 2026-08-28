"use client";

import { useMemo } from "react";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalCustomerPreviewDocument } from "@/app/lib/proposalCustomerPreviewViewModel";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import { buildCustomerPreviewEstimatePresentationFromDraft } from "@/app/lib/proposalCustomerEstimatePresenter";
import { buildCustomerPacketEstimateFromPublicDto } from "@/app/lib/proposalCustomerPacketPresenter";
import { buildProposalPublicGraphDto } from "@/app/lib/proposalPublicGraphDto";
import { resolveSelectedTemplateOptionIdFromGraph } from "@/app/lib/proposalDraftGraphAdapter";
import { PROPOSAL_COVER_DEFAULT_BRAND_ACCENT } from "@/app/lib/proposalCoverViewModel";
import { resolvePackageMeta } from "@/app/lib/proposalPackagePresentation";
import ProposalCustomerPreviewPackageComparison from "./ProposalCustomerPreviewPackageComparison";
import ProposalCustomerPreviewPacket from "./ProposalCustomerPreviewPacket";
import ProposalCustomerPreviewPacketCover from "./ProposalCustomerPreviewPacketCover";
import ProposalCustomerPreviewPackageStrip from "./ProposalCustomerPreviewPackageStrip";
import ProposalCustomerPreviewEstimateTable from "./ProposalCustomerPreviewEstimateTable";
import ProposalCustomerPreviewPacketSection from "./ProposalCustomerPreviewPacketSection";
import { PACKET_FOOTER } from "./proposalCustomerPacketStyles";
import ProposalPaymentTermsBlock from "@/app/components/proposal-packet/ProposalPaymentTermsBlock";
import type { ProposalPaymentTerms } from "@/app/lib/proposalPaymentTerms";

type ProposalCustomerPreviewDocumentProps = {
  document: ProposalCustomerPreviewDocument;
  /** Persisted draft — authoritative for Preview package/estimate presentation (V2E1). */
  draftGraph: ProposalDraftGraph | null;
  /**
   * Catalog rows for draft-owned label fallback via catalog_item_id only.
   * Never used to import Template presentation.
   */
  catalogItems?: CatalogItem[];
  paymentTerms?: ProposalPaymentTerms | null;
  selectedTotalCents?: number | null;
};

/**
 * Customer-safe proposal content for the contractor review surface.
 * Identity → title → package → why → estimate → content.
 * V2E1: draft options/lines are authoritative; live Template is not used for presentation.
 */
export default function ProposalCustomerPreviewDocumentView({
  document,
  draftGraph,
  catalogItems = [],
  paymentTerms = null,
  selectedTotalCents = null,
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

  const selectedDraftOption =
    estimatePage?.kind === "estimate" &&
    estimatePage.selectedTemplateOptionId &&
    draftGraph
      ? (draftGraph.options.find(
          (option) =>
            (option.source_template_option_id ?? "").trim() ===
            estimatePage.selectedTemplateOptionId
        ) ?? null)
      : null;

  const selectedOptionRuntimeId = selectedDraftOption?.id ?? null;
  const draftLinesForEstimate =
    draftGraph && selectedOptionRuntimeId
      ? draftGraph.lineItems
          .filter((line) => line.proposal_option_id === selectedOptionRuntimeId)
          .map((line) => ({
            sourceTemplateItemId: (line.source_template_item_id ?? "").trim(),
            customerName: line.customer_name,
            catalogSeedKey: line.catalog_seed_key,
            catalogItemId: line.catalog_item_id,
            role: line.role,
            sortOrder: line.sort_order,
          }))
          .filter((line) => line.sourceTemplateItemId.length > 0)
      : [];

  const publicPacketEstimate = useMemo(() => {
    if (!draftGraph) {
      return { comparison: null, selectedIncludedFacts: [] as string[] };
    }
    const selectedTemplateOptionId = resolveSelectedTemplateOptionIdFromGraph(draftGraph);
    const dto = buildProposalPublicGraphDto(draftGraph, selectedTemplateOptionId);
    const { comparison, estimate } = buildCustomerPacketEstimateFromPublicDto(dto, dto.displayPolicy);
    return { comparison, selectedIncludedFacts: estimate?.bullets ?? [] };
  }, [draftGraph]);

  const estimatePresentation =
    estimatePage?.kind === "estimate"
      ? buildCustomerPreviewEstimatePresentationFromDraft({
          draftLines: draftLinesForEstimate,
          catalogItems,
          optionCustomerView: estimatePage.optionPreview?.customer ?? null,
          selectedOptionLabel: estimatePage.selectedOptionLabel,
          packageMeta: estimatePage.selectedOptionLabel
            ? resolvePackageMeta(
                estimatePage.selectedOptionLabel,
                selectedDraftOption?.description,
                publicPacketEstimate.selectedIncludedFacts
              )
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
          {publicPacketEstimate.comparison && publicPacketEstimate.comparison.options.length > 1 ? (
            <ProposalCustomerPreviewPackageComparison comparison={publicPacketEstimate.comparison} />
          ) : null}
          <ProposalCustomerPreviewEstimateTable
            sections={[
              ...estimatePresentation.scopeSections,
              ...estimatePresentation.upgradeSections,
            ]}
            totals={estimatePresentation.totals}
          />
          {paymentTerms ? (
            <div className="px-5 py-4 sm:px-7" data-preview-payment-terms>
              <ProposalPaymentTermsBlock
                terms={paymentTerms}
                selectedTotalCents={selectedTotalCents}
              />
            </div>
          ) : null}
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
          Prepared by {companyName}. This proposal is for review.
        </footer>
      ) : null}
    </ProposalCustomerPreviewPacket>
  );
}
