import type { ProposalCustomerPacketEstimateViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_SUMMARY,
  PROPOSAL_CUSTOMER_PACKET_TOTAL_FOOTNOTE,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { IconInfo } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_SECONDARY_PRICE,
  PROPOSAL_PACKET_TOTAL_SUMMARY,
} from "./proposalPacketStyles";

type ProposalPacketTotalSummaryProps = {
  estimate: ProposalCustomerPacketEstimateViewModel;
};

export default function ProposalPacketTotalSummary({ estimate }: ProposalPacketTotalSummaryProps) {
  if (!estimate.totalInvestmentLabel) return null;

  return (
    <aside className={PROPOSAL_PACKET_TOTAL_SUMMARY} aria-label="Current proposal total summary">
      <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL}</p>
      <p className={`${PROPOSAL_PACKET_SECONDARY_PRICE} mt-1 whitespace-nowrap text-[1.85rem] tracking-tight sm:text-[1.95rem]`}>
        {estimate.totalInvestmentLabel}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748b]">
        {PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_SUMMARY}
      </p>

      <div className="my-4 border-t border-[#bfdbfe]/70" aria-hidden />

      <div className="flex items-start gap-2.5 rounded-xl border border-[#dbeafe] bg-white/90 px-3.5 py-3 text-[13px] leading-relaxed text-[#475569]">
        <IconInfo className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" />
        <p>{PROPOSAL_CUSTOMER_PACKET_TOTAL_FOOTNOTE}</p>
      </div>
    </aside>
  );
}
