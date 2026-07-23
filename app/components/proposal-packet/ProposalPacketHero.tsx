import type {
  ProposalCustomerPacketContactViewModel,
  ProposalCustomerPacketCoverViewModel,
  ProposalCustomerPacketEstimateViewModel,
  ProposalCustomerPacketUpgradesViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE,
  PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL,
  PROPOSAL_CUSTOMER_PACKET_PROPOSAL_LABEL,
} from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketPackageInterestActions from "./ProposalPacketPackageInterestActions";
import type { ProposalPacketRequestModalContactPrefill } from "./ProposalPacketRequestModal";
import { IconCheck, IconShield } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_CURRENT_BADGE,
  PROPOSAL_PACKET_DECISION_CARD,
  PROPOSAL_PACKET_EYEBROW,
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_HERO_GRID,
  PROPOSAL_PACKET_HERO_LEAD,
  PROPOSAL_PACKET_HERO_LEFT,
  PROPOSAL_PACKET_HERO_TITLE,
  PROPOSAL_PACKET_INVESTMENT,
} from "./proposalPacketStyles";

type ProposalPacketHeroProps = {
  cover: ProposalCustomerPacketCoverViewModel;
  estimate?: ProposalCustomerPacketEstimateViewModel | null;
  upgrades?: ProposalCustomerPacketUpgradesViewModel | null;
  contact?: ProposalCustomerPacketContactViewModel | null;
  publicAccessToken?: string | null;
  contactPrefill?: ProposalPacketRequestModalContactPrefill | null;
};

const HERO_INTRO =
  "Thank you for the opportunity to protect your home. We've created a custom roofing solution built for lasting performance and peace of mind.";

/**
 * Approved hero — intro left, recommendation/investment split card right.
 */
export default function ProposalPacketHero({
  cover,
  estimate = null,
  upgrades = null,
  contact = null,
  publicAccessToken = null,
  contactPrefill = null,
}: ProposalPacketHeroProps) {
  const headline =
    (cover.headline ?? "").trim() ||
    (cover.project.propertyAddress ?? "").trim() ||
    PROPOSAL_CUSTOMER_PACKET_PROPOSAL_LABEL;
  const customerName = (cover.preparedFor.customerName ?? "").trim();
  const benefits = (estimate?.bullets ?? []).slice(0, 2);
  const upgradeCount = upgrades?.items.length ?? 0;
  const packageLabel = estimate?.label ?? "Recommended package";
  const optionKey = estimate?.optionKey ?? null;

  return (
    <header
      aria-label="Proposal cover"
      className="border-b border-[#e6ebf1] bg-[linear-gradient(180deg,#fbfcfe_0%,#ffffff_100%)]"
    >
      <div className={PROPOSAL_PACKET_HERO_GRID}>
        <div className={PROPOSAL_PACKET_HERO_LEFT}>
          <p className={PROPOSAL_PACKET_EYEBROW}>{cover.proposalLabel}</p>
          <h1 className={PROPOSAL_PACKET_HERO_TITLE}>{headline}</h1>
          {customerName ? (
            <p className="mt-2 text-[13px] font-medium text-[#475569]">
              Prepared for <span className="font-semibold text-[#0b1f33]">{customerName}</span>
            </p>
          ) : null}
          <p className={PROPOSAL_PACKET_HERO_LEAD}>{HERO_INTRO}</p>
        </div>

        {estimate ? (
          <div className={PROPOSAL_PACKET_DECISION_CARD} aria-label="Recommended package and investment">
            <div className="grid sm:grid-cols-[1.08fr_0.92fr]">
              <div className="bg-[linear-gradient(165deg,#0b1f33_0%,#122a42_100%)] px-4 py-4 text-white sm:px-5">
                <p className={`${PROPOSAL_PACKET_FIELD_LABEL} text-white/45`}>Recommended package</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <p className="text-[1.35rem] font-semibold tracking-[-0.02em] text-white">
                    {packageLabel}
                  </p>
                  <span className={PROPOSAL_PACKET_CURRENT_BADGE}>
                    {PROPOSAL_CUSTOMER_PACKET_CURRENT_BADGE}
                  </span>
                </div>
                {estimate.description ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-white/72">
                    {estimate.description}
                  </p>
                ) : null}
                {benefits.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {benefits.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-[13px] text-white/92">
                        <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#93c5fd]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="flex flex-col border-t border-[#e2e8f0] bg-[#f7f9fc] px-4 py-4 sm:border-l sm:border-t-0 sm:px-5">
                <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PROPOSAL_CUSTOMER_PACKET_CURRENT_TOTAL_LABEL}</p>
                {estimate.totalInvestmentLabel ? (
                  <p className={`${PROPOSAL_PACKET_INVESTMENT} mt-1`}>
                    {estimate.totalInvestmentLabel}
                  </p>
                ) : null}
                <p className="mt-2 text-[13px] leading-relaxed text-[#64748b]">
                  {upgradeCount > 0
                    ? `Includes the ${packageLabel} package and ${upgradeCount} selected upgrade${upgradeCount === 1 ? "" : "s"}.`
                    : `Includes the ${packageLabel} package.`}
                </p>
                <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-[#dde5ef] bg-white px-2.5 py-2 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]">
                  <IconShield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
                  <p className="text-[12px] font-medium leading-snug text-[#334155]">
                    Built for lasting protection
                  </p>
                </div>
                <div className="mt-auto border-t border-[#e6ebf1] pt-3">
                  <ProposalPacketPackageInterestActions
                    packageLabel={packageLabel}
                    contact={contact}
                    layout="stack"
                    secondary="ask"
                    compact
                    publicAccessToken={publicAccessToken}
                    optionKey={optionKey}
                    contactPrefill={contactPrefill}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
