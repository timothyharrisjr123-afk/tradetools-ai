import type { ProposalCustomerPacketContactViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import { PROPOSAL_PACKET_FOOTER } from "./proposalPacketStyles";

type ProposalPacketFooterProps = {
  contact: ProposalCustomerPacketContactViewModel | null;
};

export default function ProposalPacketFooter({ contact }: ProposalPacketFooterProps) {
  const companyName = (contact?.companyName ?? "your contractor").trim();

  return (
    <footer className={PROPOSAL_PACKET_FOOTER}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="max-w-lg">
          <p className="text-sm font-semibold text-[#0f172a]">
            Thank you for considering {companyName}.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#64748b]">
            We appreciate the opportunity to help protect your home.
          </p>
        </div>
        <p className="text-sm font-medium text-[#64748b] sm:text-right">
          Built on integrity. Backed by quality.
        </p>
      </div>
    </footer>
  );
}
