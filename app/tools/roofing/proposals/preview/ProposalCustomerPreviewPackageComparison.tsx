"use client";

import ProposalPacketComparison from "@/app/components/proposal-packet/ProposalPacketComparison";
import type { ProposalCustomerPacketComparisonViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import { PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING } from "@/app/lib/proposalCustomerPacketViewModel";

type ProposalCustomerPreviewPackageComparisonProps = {
  comparison: ProposalCustomerPacketComparisonViewModel;
};

/**
 * Preview parity for Public package comparison — shared comparison presenter.
 */
export default function ProposalCustomerPreviewPackageComparison({
  comparison,
}: ProposalCustomerPreviewPackageComparisonProps) {
  return (
    <section
      className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6"
      aria-label={PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING}
      data-preview-package-comparison
    >
      <ProposalPacketComparison comparison={comparison} contact={null} />
    </section>
  );
}
