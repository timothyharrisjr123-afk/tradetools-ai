import type { ProposalCustomerPacketCoverViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_HEADER_SAVE_PDF_LABEL,
  PROPOSAL_CUSTOMER_PACKET_HEADER_SHARE_LABEL,
  PROPOSAL_CUSTOMER_PACKET_HEADER_TAGLINE,
} from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketCompanyMark from "./ProposalPacketCompanyMark";
import { IconDownload, IconShare } from "./ProposalPacketIcons";
import { PROPOSAL_PACKET_HEADER, PROPOSAL_PACKET_HEADER_ACTION } from "./proposalPacketStyles";

type ProposalPacketHeaderProps = {
  cover: ProposalCustomerPacketCoverViewModel;
};

function FutureActionChip({
  icon: Icon,
  label,
}: {
  icon: typeof IconDownload;
  label: string;
}) {
  return (
    <span
      className={PROPOSAL_PACKET_HEADER_ACTION}
      aria-disabled="true"
      title="Coming soon"
    >
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}

export default function ProposalPacketHeader({ cover }: ProposalPacketHeaderProps) {
  return (
    <div className={PROPOSAL_PACKET_HEADER} aria-label="Proposal header">
      <div className="flex min-w-0 items-center gap-4">
        <ProposalPacketCompanyMark company={cover.company} variant="hero" />
        <div className="min-w-0">
          {cover.company.companyName ? (
            <p className="text-base font-bold tracking-tight text-[#0f172a] sm:text-lg">
              {cover.company.companyName}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs font-medium text-[#64748b] sm:text-sm">
            {PROPOSAL_CUSTOMER_PACKET_HEADER_TAGLINE}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        <FutureActionChip icon={IconDownload} label={PROPOSAL_CUSTOMER_PACKET_HEADER_SAVE_PDF_LABEL} />
        <FutureActionChip icon={IconShare} label={PROPOSAL_CUSTOMER_PACKET_HEADER_SHARE_LABEL} />
      </div>
    </div>
  );
}
