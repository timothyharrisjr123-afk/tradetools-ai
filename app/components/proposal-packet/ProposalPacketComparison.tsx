import type { ProposalCustomerPacketComparisonViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import { IconStar } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_ROW,
  PROPOSAL_PACKET_SECONDARY_PRICE,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

type ProposalPacketComparisonProps = {
  comparison: ProposalCustomerPacketComparisonViewModel;
  embedded?: boolean;
};

export default function ProposalPacketComparison({
  comparison,
  embedded = false,
}: ProposalPacketComparisonProps) {
  if (comparison.options.length === 0) {
    return null;
  }

  return (
    <section
      className={embedded ? "min-w-0" : undefined}
      aria-label="Compare other options"
    >
      <div className="mb-5">
        <h3 className={PROPOSAL_PACKET_SECTION_TITLE}>Compare other options</h3>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>
          Other packages are available for comparison.
        </p>
      </div>
      <div className="space-y-3" role="list" aria-readonly="true">
        {comparison.options.map((option) => (
          <div
            key={option.optionKey}
            className={PROPOSAL_PACKET_ROW}
            role="listitem"
            aria-disabled="true"
          >
            <IconStar className="h-4 w-4 shrink-0 text-[#94a3b8]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#0f172a]">{option.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">{option.description}</p>
            </div>
            {option.totalInvestmentLabel ? (
              <p className={PROPOSAL_PACKET_SECONDARY_PRICE}>{option.totalInvestmentLabel}</p>
            ) : null}
            <span className="text-xs text-[#cbd5e1]" aria-hidden>
              ›
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
