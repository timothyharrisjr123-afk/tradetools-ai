import type { ProposalCustomerPacketUpgradesViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_UPGRADES_FOOTNOTE,
  PROPOSAL_CUSTOMER_PACKET_UPGRADES_HEADING,
  PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE1,
  PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE2,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_PACKET_SECONDARY_PRICE,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
  PROPOSAL_PACKET_UPGRADE_GROUP,
  PROPOSAL_PACKET_UPGRADE_ROW,
} from "./proposalPacketStyles";

type ProposalPacketUpgradesProps = {
  upgrades: ProposalCustomerPacketUpgradesViewModel;
};

export default function ProposalPacketUpgrades({ upgrades }: ProposalPacketUpgradesProps) {
  if (upgrades.items.length === 0) return null;

  return (
    <section aria-label={PROPOSAL_CUSTOMER_PACKET_UPGRADES_HEADING}>
      <div className="mb-4">
        <h2 className={PROPOSAL_PACKET_SECTION_TITLE}>{PROPOSAL_CUSTOMER_PACKET_UPGRADES_HEADING}</h2>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>{PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE1}</p>
        <p className={`${PROPOSAL_PACKET_SECTION_INTRO} mt-0.5`}>
          {PROPOSAL_CUSTOMER_PACKET_UPGRADES_INTRO_LINE2}
        </p>
      </div>

      <div className={PROPOSAL_PACKET_UPGRADE_GROUP} role="list">
        {upgrades.items.map((item, index) => (
          <div
            key={item.name}
            className={[
              PROPOSAL_PACKET_UPGRADE_ROW,
              index > 0 ? "border-t border-[#e8edf2]" : "",
            ].join(" ")}
            role="listitem"
          >
            <span className="min-w-0 flex-1 text-[13px] font-medium text-[#0f172a]">{item.name}</span>
            {item.valueLabel ? (
              <span className={`${PROPOSAL_PACKET_SECONDARY_PRICE} whitespace-nowrap text-[13px]`}>
                {item.valueLabel}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[12px] leading-relaxed text-[#64748b]">
        {PROPOSAL_CUSTOMER_PACKET_UPGRADES_FOOTNOTE}
      </p>
    </section>
  );
}
