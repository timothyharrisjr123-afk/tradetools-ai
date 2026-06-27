import type { ProposalCustomerPacketEstimateViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketCurrentPackage from "./ProposalPacketCurrentPackage";

type ProposalPacketSelectedCardProps = {
  estimate: ProposalCustomerPacketEstimateViewModel;
};

/** @deprecated Use ProposalPacketCurrentPackage */
export default function ProposalPacketSelectedCard({ estimate }: ProposalPacketSelectedCardProps) {
  return <ProposalPacketCurrentPackage estimate={estimate} />;
}
