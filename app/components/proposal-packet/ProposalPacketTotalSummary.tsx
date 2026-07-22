import type { ProposalCustomerPacketEstimateViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_SUMMARY,
  PROPOSAL_CUSTOMER_PACKET_TOTAL_FOOTNOTE,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_INVESTMENT,
  PROPOSAL_PACKET_SECTION_TITLE,
  PROPOSAL_PACKET_TOTAL_SUMMARY,
} from "./proposalPacketStyles";

type ProposalPacketTotalSummaryProps = {
  estimate: ProposalCustomerPacketEstimateViewModel;
};

/** Clear investment moment — one calm summary, not a side widget. */
export default function ProposalPacketTotalSummary({ estimate }: ProposalPacketTotalSummaryProps) {
  if (!estimate.totalInvestmentLabel) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-10">
      <div className="max-w-md">
        <h2 className={PROPOSAL_PACKET_SECTION_TITLE}>{PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#5b6b7c]">
          {PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_SUMMARY}
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-[#64748b]">
          {PROPOSAL_CUSTOMER_PACKET_TOTAL_FOOTNOTE}
        </p>
      </div>

      <aside className={PROPOSAL_PACKET_TOTAL_SUMMARY} aria-label="Your investment summary">
        <p className={`${PROPOSAL_PACKET_FIELD_LABEL} text-white/55`}>
          {PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL}
        </p>
        <p className={`${PROPOSAL_PACKET_INVESTMENT} mt-2`}>{estimate.totalInvestmentLabel}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-white/70">{estimate.label} package</p>
      </aside>
    </div>
  );
}
