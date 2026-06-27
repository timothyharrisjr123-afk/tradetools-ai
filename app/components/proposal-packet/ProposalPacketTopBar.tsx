import type { ProposalCustomerPacketCoverViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_HEADER_SAVE_PDF_LABEL,
  PROPOSAL_CUSTOMER_PACKET_HEADER_SHARE_LABEL,
  PROPOSAL_CUSTOMER_PACKET_HEADER_TAGLINE,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { IconDownload, IconShare } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_TOP_BAR,
  PROPOSAL_PACKET_TOP_BAR_ACTION,
  PROPOSAL_PACKET_TOP_BAR_MARK,
} from "./proposalPacketStyles";

type ProposalPacketTopBarProps = {
  cover: ProposalCustomerPacketCoverViewModel;
};

function FutureAction({
  icon: Icon,
  label,
}: {
  icon: typeof IconDownload;
  label: string;
}) {
  return (
    <span className={PROPOSAL_PACKET_TOP_BAR_ACTION} aria-disabled="true" title="Coming soon">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </span>
  );
}

function TopBarMark({ cover }: { cover: ProposalCustomerPacketCoverViewModel }) {
  const monogram = (cover.company.logoMonogram ?? "AR").slice(0, 2).toUpperCase();

  if (cover.company.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={cover.company.logoUrl} alt="" className={`${PROPOSAL_PACKET_TOP_BAR_MARK} object-contain p-1.5`} />
    );
  }

  return (
    <div className={`${PROPOSAL_PACKET_TOP_BAR_MARK} bg-[#061a33] text-lg font-bold text-white`}>
      {monogram}
    </div>
  );
}

export default function ProposalPacketTopBar({ cover }: ProposalPacketTopBarProps) {
  return (
    <div className={PROPOSAL_PACKET_TOP_BAR} aria-label="Proposal utility bar">
      <div className="flex min-w-0 items-center gap-4">
        <TopBarMark cover={cover} />
        <div className="min-w-0">
          {cover.company.companyName ? (
            <p className="truncate text-[1.2rem] font-bold leading-tight tracking-tight text-[#0f172a] sm:text-[1.28rem]">
              {cover.company.companyName}
            </p>
          ) : null}
          <p className="mt-0.5 text-[12px] leading-snug text-[#64748b] sm:text-[13px]">
            {PROPOSAL_CUSTOMER_PACKET_HEADER_TAGLINE}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-6">
        <FutureAction icon={IconDownload} label={PROPOSAL_CUSTOMER_PACKET_HEADER_SAVE_PDF_LABEL} />
        <FutureAction icon={IconShare} label={PROPOSAL_CUSTOMER_PACKET_HEADER_SHARE_LABEL} />
      </div>
    </div>
  );
}
