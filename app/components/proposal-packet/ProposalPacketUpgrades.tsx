import type { ProposalCustomerPacketUpgradesViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import { IconPlus } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_ROW,
  PROPOSAL_PACKET_SECONDARY_PRICE,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

type ProposalPacketUpgradesProps = {
  upgrades: ProposalCustomerPacketUpgradesViewModel;
  embedded?: boolean;
};

export default function ProposalPacketUpgrades({
  upgrades,
  embedded = false,
}: ProposalPacketUpgradesProps) {
  if (upgrades.items.length === 0) {
    return null;
  }

  return (
    <section className={embedded ? "min-w-0" : undefined} aria-label="Optional add-ons">
      <div className="mb-5">
        <h3 className={PROPOSAL_PACKET_SECTION_TITLE}>Optional add-ons</h3>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>
          Available upgrades your contractor included for review. These are optional and not required
          for your selected package.
        </p>
      </div>
      <div className="space-y-3" role="list" aria-readonly="true">
        {upgrades.items.map((item) => (
          <div
            key={item.name}
            className={PROPOSAL_PACKET_ROW}
            role="listitem"
            aria-disabled="true"
          >
            <IconPlus className="h-4 w-4 shrink-0 text-[#64748b]" aria-hidden />
            <span className="min-w-0 flex-1 text-sm text-[#0f172a]">{item.name}</span>
            {item.valueLabel ? (
              <span className={PROPOSAL_PACKET_SECONDARY_PRICE}>{item.valueLabel}</span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
