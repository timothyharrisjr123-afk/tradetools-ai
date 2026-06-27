import type { ProposalCustomerPacketComparisonViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING,
  PROPOSAL_CUSTOMER_PACKET_COMPARE_INTRO,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE,
  PROPOSAL_CUSTOMER_PACKET_INCLUDES_LABEL,
  PROPOSAL_CUSTOMER_PACKET_TOTAL_INVESTMENT_LABEL,
} from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketAboutPackages from "./ProposalPacketAboutPackages";
import { IconCheck, IconStar, packageAccentIconClass } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_COMPARE_ROW,
  PROPOSAL_PACKET_CURRENT_BADGE,
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_OPTION_CARD,
  PROPOSAL_PACKET_OPTION_CARD_CURRENT,
  PROPOSAL_PACKET_SECONDARY_PRICE,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

type ProposalPacketComparisonProps = {
  comparison: ProposalCustomerPacketComparisonViewModel;
};

export default function ProposalPacketComparison({ comparison }: ProposalPacketComparisonProps) {
  if (comparison.options.length === 0) return null;

  return (
    <div aria-label="Compare packages">
      <div className="mb-5">
        <h2 className={PROPOSAL_PACKET_SECTION_TITLE}>{PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING}</h2>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>{PROPOSAL_CUSTOMER_PACKET_COMPARE_INTRO}</p>
      </div>

      <div className={PROPOSAL_PACKET_COMPARE_ROW} role="list" aria-readonly="true">
        {comparison.options.map((option) => (
          <div
            key={option.optionKey}
            className={option.isCurrent ? PROPOSAL_PACKET_OPTION_CARD_CURRENT : PROPOSAL_PACKET_OPTION_CARD}
            role="listitem"
            aria-disabled="true"
            aria-current={option.isCurrent ? "true" : undefined}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${packageAccentIconClass(option.accent)}`}
              >
                <IconStar className="h-4 w-4" />
              </div>
              {option.isCurrent ? (
                <span className={PROPOSAL_PACKET_CURRENT_BADGE}>
                  {PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE}
                </span>
              ) : null}
            </div>

            <p className="text-[1.05rem] font-bold leading-snug tracking-tight text-[#0f172a] [overflow-wrap:normal]">
              {option.label}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748b] [overflow-wrap:normal]">
              {option.description}
            </p>

            {option.bullets.length > 0 ? (
              <div className="mt-4 border-t border-[#eef2f6] pt-4">
                <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PROPOSAL_CUSTOMER_PACKET_INCLUDES_LABEL}</p>
                <ul className="mt-2.5 space-y-2">
                  {option.bullets.slice(0, 2).map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-[13px] leading-snug text-[#334155]">
                      <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
                      <span className="[overflow-wrap:normal]">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-auto border-t border-[#eef2f6] pt-4">
              <p className={PROPOSAL_PACKET_FIELD_LABEL}>
                {PROPOSAL_CUSTOMER_PACKET_TOTAL_INVESTMENT_LABEL}
              </p>
              {option.totalInvestmentLabel ? (
                <p
                  className={`${PROPOSAL_PACKET_SECONDARY_PRICE} mt-1.5 whitespace-nowrap text-[1.3rem] tracking-tight`}
                >
                  {option.totalInvestmentLabel}
                </p>
              ) : null}
            </div>
          </div>
        ))}

        <ProposalPacketAboutPackages />
      </div>
    </div>
  );
}
