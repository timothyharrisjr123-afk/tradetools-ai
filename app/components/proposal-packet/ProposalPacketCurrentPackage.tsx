import type { ProposalCustomerPacketEstimateViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL,
  PROPOSAL_CUSTOMER_PACKET_KEY_HIGHLIGHTS_LABEL,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { IconCheck } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

type ProposalPacketCurrentPackageProps = {
  estimate: ProposalCustomerPacketEstimateViewModel;
};

/** Why this package — narrative recommendation, not a duplicate price card. */
export default function ProposalPacketCurrentPackage({ estimate }: ProposalPacketCurrentPackageProps) {
  return (
    <div className="max-w-3xl">
      <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL}</p>
      <h2 className={`${PROPOSAL_PACKET_SECTION_TITLE} mt-2`}>{estimate.label}</h2>
      <p className={PROPOSAL_PACKET_SECTION_INTRO}>{estimate.description}</p>
      {estimate.confidenceCopy ? (
        <p className="mt-5 text-[15px] leading-relaxed text-[#0b1f33]/90">{estimate.confidenceCopy}</p>
      ) : null}

      {estimate.bullets.length > 0 ? (
        <div className="mt-8">
          <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PROPOSAL_CUSTOMER_PACKET_KEY_HIGHLIGHTS_LABEL}</p>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {estimate.bullets.slice(0, 4).map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-[14px] text-[#334155]">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1d4ed8]" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
