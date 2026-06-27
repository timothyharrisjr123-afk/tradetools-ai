import type { ProposalCustomerPacketEstimateViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL,
  PROPOSAL_CUSTOMER_PACKET_KEY_HIGHLIGHTS_LABEL,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { IconCheck } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_COVER_CARD,
  PROPOSAL_PACKET_COVER_INVESTMENT,
  PROPOSAL_PACKET_FIELD_LABEL,
} from "./proposalPacketStyles";

type ProposalPacketCurrentPackageProps = {
  estimate: ProposalCustomerPacketEstimateViewModel;
};

export default function ProposalPacketCurrentPackage({ estimate }: ProposalPacketCurrentPackageProps) {
  return (
    <article
      className={`${PROPOSAL_PACKET_COVER_CARD} pointer-events-auto w-full px-6 py-6 sm:max-w-[380px] sm:px-7 sm:py-7`}
      aria-label="Current package"
    >
      <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PROPOSAL_CUSTOMER_PACKET_CURRENT_PACKAGE_LABEL}</p>

      <div className="mt-3 space-y-1.5">
        <h2 className="text-[1.65rem] font-bold leading-tight tracking-tight text-[#0f172a]">
          {estimate.label}
        </h2>
        <p className="text-[15px] leading-relaxed text-[#64748b]">{estimate.description}</p>
      </div>

      {estimate.bullets.length > 0 ? (
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748b]">
            {PROPOSAL_CUSTOMER_PACKET_KEY_HIGHLIGHTS_LABEL}
          </p>
          <ul className="mt-2.5 grid gap-2">
            {estimate.bullets.slice(0, 2).map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-[15px] text-[#334155]">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {estimate.totalInvestmentLabel ? (
        <>
          <div className="my-5 border-t border-[#e2e8f0]" aria-hidden />
          <div>
            <p className={PROPOSAL_PACKET_FIELD_LABEL}>
              {PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL}
            </p>
            <p className={`${PROPOSAL_PACKET_COVER_INVESTMENT} mt-1`}>{estimate.totalInvestmentLabel}</p>
          </div>
        </>
      ) : null}
    </article>
  );
}
