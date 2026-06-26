import type { ProposalCustomerPacketCoverViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketHero from "./ProposalPacketHero";

type ProposalPacketCoverProps = {
  cover: ProposalCustomerPacketCoverViewModel;
};

/** Legacy cover section — composed via ProposalPacketHero in the main packet. */
export default function ProposalPacketCover({ cover }: ProposalPacketCoverProps) {
  return <ProposalPacketHero cover={cover} />;
}
