import type {
  ProposalCustomerPacketCoverViewModel,
  ProposalCustomerPacketEstimateViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { PROPOSAL_CUSTOMER_PACKET_PROPOSAL_LABEL } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_PACKET_EYEBROW,
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_HERO_GRID,
  PROPOSAL_PACKET_HERO_LEFT,
  PROPOSAL_PACKET_HERO_TITLE,
} from "./proposalPacketStyles";

type ProposalPacketHeroProps = {
  cover: ProposalCustomerPacketCoverViewModel;
  estimate?: ProposalCustomerPacketEstimateViewModel | null;
};

/**
 * Proposal cover — who this is for and what property it covers.
 *
 * The package, price, and action live in the purchase composition, so nothing
 * here competes with the customer's decision.
 */
export default function ProposalPacketHero({ cover }: ProposalPacketHeroProps) {
  const headline =
    (cover.headline ?? "").trim() ||
    (cover.project.propertyAddress ?? "").trim() ||
    PROPOSAL_CUSTOMER_PACKET_PROPOSAL_LABEL;
  const customerName = (cover.preparedFor.customerName ?? "").trim();
  const propertyAddress = (cover.project.propertyAddress ?? "").trim();
  const jobName = (cover.project.jobName ?? "").trim();
  const showContext = customerName.length > 0 || propertyAddress.length > 0;

  return (
    <header
      aria-label="Proposal cover"
      className="border-b border-[#e6ebf1] bg-[linear-gradient(180deg,#fbfcfe_0%,#ffffff_100%)]"
    >
      <div className={PROPOSAL_PACKET_HERO_GRID}>
        <div className={PROPOSAL_PACKET_HERO_LEFT}>
          <p className={PROPOSAL_PACKET_EYEBROW}>{cover.proposalLabel}</p>
          <h1 className={PROPOSAL_PACKET_HERO_TITLE}>{headline}</h1>
        </div>

        {showContext ? (
          <dl className="grid gap-4 self-start sm:grid-cols-2 lg:pt-1">
            {customerName ? (
              <div>
                <dt className={PROPOSAL_PACKET_FIELD_LABEL}>Prepared for</dt>
                <dd className="mt-1 text-[14px] font-semibold text-[#0b1f33]">{customerName}</dd>
              </div>
            ) : null}
            {propertyAddress ? (
              <div>
                <dt className={PROPOSAL_PACKET_FIELD_LABEL}>Property</dt>
                <dd className="mt-1 text-[14px] leading-snug text-[#334155]">{propertyAddress}</dd>
              </div>
            ) : null}
            {jobName && jobName !== headline ? (
              <div>
                <dt className={PROPOSAL_PACKET_FIELD_LABEL}>Project</dt>
                <dd className="mt-1 text-[14px] leading-snug text-[#334155]">{jobName}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </header>
  );
}
