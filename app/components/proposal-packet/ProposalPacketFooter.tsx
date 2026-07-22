import type {
  ProposalCustomerPacketContactViewModel,
  ProposalCustomerPacketFooterMetadataViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { PROPOSAL_PACKET_FOOTER } from "./proposalPacketStyles";

type ProposalPacketFooterProps = {
  contact: ProposalCustomerPacketContactViewModel | null;
  footerMetadata: ProposalCustomerPacketFooterMetadataViewModel | null;
};

export default function ProposalPacketFooter({ contact, footerMetadata }: ProposalPacketFooterProps) {
  const companyName = (contact?.companyName ?? "").trim();
  const dateLabel = (footerMetadata?.proposalDateLabel ?? "").trim();

  return (
    <footer className={PROPOSAL_PACKET_FOOTER} aria-label="Proposal footer">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-[#0b1f33]">
          {companyName
            ? `Thank you for considering ${companyName}.`
            : "Thank you for reviewing this proposal."}
        </p>
        <p className="mt-0.5 text-[13px] text-[#64748b]">We are ready to protect your home.</p>
      </div>
      {dateLabel ? (
        <p className="text-[12px] font-medium tracking-[0.02em] text-[#64748b] sm:text-right">
          Date: {dateLabel}
        </p>
      ) : null}
    </footer>
  );
}
