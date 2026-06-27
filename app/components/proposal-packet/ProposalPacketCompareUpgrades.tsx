import type {
  ProposalCustomerPacketComparisonViewModel,
  ProposalCustomerPacketUpgradesViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketComparison from "./ProposalPacketComparison";
import ProposalPacketUpgrades from "./ProposalPacketUpgrades";

type ProposalPacketCompareUpgradesProps = {
  comparison: ProposalCustomerPacketComparisonViewModel | null;
  upgrades: ProposalCustomerPacketUpgradesViewModel | null;
};

/** Legacy wrapper — main packet renders comparison and upgrades as separate sections. */
export default function ProposalPacketCompareUpgrades({
  comparison,
  upgrades,
}: ProposalPacketCompareUpgradesProps) {
  const showComparison = comparison != null && comparison.options.length > 0;
  const showUpgrades = upgrades != null && upgrades.items.length > 0;

  if (!showComparison && !showUpgrades) {
    return null;
  }

  return (
    <>
      {showComparison ? (
        <ProposalPacketComparison comparison={comparison!} />
      ) : null}
      {showUpgrades ? <ProposalPacketUpgrades upgrades={upgrades!} /> : null}
    </>
  );
}
