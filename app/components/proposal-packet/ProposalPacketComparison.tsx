import type {
  ProposalCustomerPacketComparisonViewModel,
  ProposalCustomerPacketContactViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE,
  proposalCustomerPacketAskAboutPackageCta,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { buildPackageInterestHref } from "@/app/lib/proposalCustomerPacketInterestAction";
import { IconCheck } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_COMPARE_ROW,
  PROPOSAL_PACKET_CTA_QUIET,
  PROPOSAL_PACKET_CURRENT_BADGE,
  PROPOSAL_PACKET_OPTION_CARD,
  PROPOSAL_PACKET_OPTION_CARD_CURRENT,
  PROPOSAL_PACKET_SECONDARY_PRICE,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

type ProposalPacketComparisonProps = {
  comparison: ProposalCustomerPacketComparisonViewModel;
  contact?: ProposalCustomerPacketContactViewModel | null;
};

export default function ProposalPacketComparison({
  comparison,
  contact = null,
}: ProposalPacketComparisonProps) {
  if (comparison.options.length < 2) return null;

  return (
    <div>
      <div className="mb-3.5">
        <h2 className={PROPOSAL_PACKET_SECTION_TITLE}>{PROPOSAL_CUSTOMER_PACKET_COMPARE_HEADING}</h2>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>
          Choose the right level of protection for your home.
        </p>
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
            <div className="mb-1.5 flex min-h-[1.35rem] items-center justify-between gap-2">
              <p className="text-[1rem] font-semibold tracking-tight text-[#0b1f33]">
                {option.label}
              </p>
              {option.isCurrent ? (
                <span className={PROPOSAL_PACKET_CURRENT_BADGE}>
                  {PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE}
                </span>
              ) : null}
            </div>

            {option.description ? (
              <p className="text-[13px] leading-snug text-[#64748b]">
                {option.description}
              </p>
            ) : null}

            {option.bullets.length > 0 ? (
              <ul className="mt-3 flex-1 space-y-1.5">
                {option.bullets.slice(0, 2).map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-[13px] text-[#334155]">
                    <IconCheck
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${option.isCurrent ? "text-[#2563eb]" : "text-[#64748b]"}`}
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex-1" aria-hidden />
            )}

            {option.totalInvestmentLabel ? (
              <p
                className={`${PROPOSAL_PACKET_SECONDARY_PRICE} mt-4 text-[1.15rem] ${
                  option.isCurrent ? "text-[#2563eb]" : ""
                }`}
              >
                {option.totalInvestmentLabel}
              </p>
            ) : null}

            {!option.isCurrent ? (
              <a
                href={buildPackageInterestHref(contact, option.label, "ask-about")}
                className={PROPOSAL_PACKET_CTA_QUIET}
                data-proposal-cta="ask-about-package"
              >
                {proposalCustomerPacketAskAboutPackageCta(option.label)}
              </a>
            ) : (
              <span className="mt-3 block min-h-[44px]" aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
