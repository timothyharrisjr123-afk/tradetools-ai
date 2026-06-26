import type { ProposalCustomerPacketEstimateViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import { IconCheck } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_CARD,
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_INVESTMENT,
  PROPOSAL_PACKET_RECOMMENDED_BADGE,
} from "./proposalPacketStyles";

type ProposalPacketSelectedCardProps = {
  estimate: ProposalCustomerPacketEstimateViewModel;
};

export default function ProposalPacketSelectedCard({ estimate }: ProposalPacketSelectedCardProps) {
  return (
    <article
      className={`${PROPOSAL_PACKET_CARD} pointer-events-auto w-full px-6 py-6 sm:px-7 sm:py-7`}
      aria-label="Selected package"
    >
      <span className={PROPOSAL_PACKET_RECOMMENDED_BADGE}>Recommended option</span>

      <div className="mt-4 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748b]">Package</p>
        <h2 className="text-lg font-bold text-[#0f172a] sm:text-xl">{estimate.label}</h2>
        <p className="text-sm leading-relaxed text-[#475569]">{estimate.description}</p>
      </div>

      {estimate.bullets.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {estimate.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm text-[#475569]">
              <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {estimate.totalInvestmentLabel ? (
        <>
          <div className="my-5 border-t border-[#e2e8f0]" aria-hidden />
          <div>
            <p className={PROPOSAL_PACKET_FIELD_LABEL}>Total investment</p>
            <p className={`${PROPOSAL_PACKET_INVESTMENT} mt-1`}>{estimate.totalInvestmentLabel}</p>
          </div>
        </>
      ) : null}
    </article>
  );
}
