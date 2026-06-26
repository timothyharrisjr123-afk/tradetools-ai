import type {
  ProposalCustomerPacketComparisonViewModel,
  ProposalCustomerPacketUpgradesViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketComparison from "./ProposalPacketComparison";
import ProposalPacketUpgrades from "./ProposalPacketUpgrades";
import { PROPOSAL_PACKET_SECTION_COMPACT } from "./proposalPacketStyles";

type ProposalPacketCompareUpgradesProps = {
  comparison: ProposalCustomerPacketComparisonViewModel | null;
  upgrades: ProposalCustomerPacketUpgradesViewModel | null;
};

export default function ProposalPacketCompareUpgrades({
  comparison,
  upgrades,
}: ProposalPacketCompareUpgradesProps) {
  const showComparison = comparison != null && comparison.options.length > 0;
  const showUpgrades = upgrades != null && upgrades.items.length > 0;

  if (!showComparison && !showUpgrades) {
    return null;
  }

  if (showComparison && showUpgrades) {
    return (
      <section className={PROPOSAL_PACKET_SECTION_COMPACT} aria-label="Options and add-ons">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-0">
          <div className="lg:pr-10">
            <ProposalPacketComparison comparison={comparison!} embedded />
          </div>
          <div className="border-t border-[#e2e8f0] pt-10 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <ProposalPacketUpgrades upgrades={upgrades!} embedded />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={PROPOSAL_PACKET_SECTION_COMPACT}>
      {showComparison ? <ProposalPacketComparison comparison={comparison!} /> : null}
      {showUpgrades ? <ProposalPacketUpgrades upgrades={upgrades!} /> : null}
    </section>
  );
}
