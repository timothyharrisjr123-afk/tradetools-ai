import type { ProposalCustomerPacketEstimateViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketCurrentPackage from "./ProposalPacketCurrentPackage";
import ProposalPacketScope from "./ProposalPacketScope";

type ProposalPacketEstimateProps = {
  estimate: ProposalCustomerPacketEstimateViewModel;
};

/** Legacy estimate section — composed via current package and scope in the main packet. */
export default function ProposalPacketEstimate({ estimate }: ProposalPacketEstimateProps) {
  return (
    <>
      <ProposalPacketCurrentPackage estimate={estimate} />
      <ProposalPacketScope estimate={estimate} />
    </>
  );
}
