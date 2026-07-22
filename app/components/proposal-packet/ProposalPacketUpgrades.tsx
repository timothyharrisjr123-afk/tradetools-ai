import type { ProposalCustomerPacketUpgradesViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import { PROPOSAL_CUSTOMER_PACKET_UPGRADES_HEADING } from "@/app/lib/proposalCustomerPacketViewModel";
import { IconPlus } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_SECONDARY_PRICE,
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
    <div>
      <h2 className={`${PROPOSAL_PACKET_SECTION_TITLE} mb-3`}>
        {PROPOSAL_CUSTOMER_PACKET_UPGRADES_HEADING}
      </h2>

      <div className={PROPOSAL_PACKET_UPGRADE_GROUP} role="list">
        {upgrades.items.map((item, index) => (
          <div
            key={item.name}
            className={[PROPOSAL_PACKET_UPGRADE_ROW, index > 0 ? "border-t border-[#eef2f6]" : ""].join(
              " "
            )}
            role="listitem"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0b1f33]/[0.06] text-[#0b1f33]">
              <IconPlus className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-[14px] font-medium text-[#0b1f33]">{item.name}</span>
            {item.valueLabel ? (
              <span className={`${PROPOSAL_PACKET_SECONDARY_PRICE} text-[14px]`}>{item.valueLabel}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
