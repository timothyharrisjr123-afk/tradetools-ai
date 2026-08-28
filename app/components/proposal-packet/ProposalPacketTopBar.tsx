import type { ProposalCustomerPacketCoverViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import { PROPOSAL_PACKET_TOP_BAR, PROPOSAL_PACKET_TOP_BAR_MARK } from "./proposalPacketStyles";

type ProposalPacketTopBarProps = {
  cover: ProposalCustomerPacketCoverViewModel;
};

function BrandMark({ cover }: { cover: ProposalCustomerPacketCoverViewModel }) {
  const monogram = (cover.company.logoMonogram ?? "FD").slice(0, 2).toUpperCase();

  if (cover.company.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cover.company.logoUrl}
        alt=""
        className={`${PROPOSAL_PACKET_TOP_BAR_MARK} bg-white object-contain p-1.5`}
      />
    );
  }

  return <div className={PROPOSAL_PACKET_TOP_BAR_MARK}>{monogram}</div>;
}

/** Dark navy contractor brand bar — approved target. */
export default function ProposalPacketTopBar({ cover }: ProposalPacketTopBarProps) {
  const companyName = (cover.company.companyName ?? "").trim();

  return (
    <div className={PROPOSAL_PACKET_TOP_BAR} aria-label="Company brand">
      <div className="flex min-w-0 items-center gap-3.5">
        <BrandMark cover={cover} />
        {companyName ? (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[0.08em] text-white sm:text-[16px]">
              {companyName.toUpperCase()}
            </p>
            <p className="mt-0.5 text-[11px] font-medium tracking-[0.04em] text-white/55">
              Roofing proposal
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
