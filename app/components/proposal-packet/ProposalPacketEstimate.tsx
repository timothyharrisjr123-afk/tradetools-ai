import type { ProposalCustomerPacketEstimateViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketScope from "./ProposalPacketScope";
import ProposalPacketSelectedCard from "./ProposalPacketSelectedCard";

type ProposalPacketEstimateProps = {
  estimate: ProposalCustomerPacketEstimateViewModel;
};

/** Legacy estimate section — split across hero card and scope in the main packet. */
export default function ProposalPacketEstimate({ estimate }: ProposalPacketEstimateProps) {
  return (
    <>
      <ProposalPacketSelectedCard estimate={estimate} />
      <ProposalPacketScope estimate={estimate} />
    </>
  );
}
