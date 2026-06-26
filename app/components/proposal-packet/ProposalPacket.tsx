import type { ProposalCustomerPacketViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketCompareUpgrades from "./ProposalPacketCompareUpgrades";
import ProposalPacketDetailsContact from "./ProposalPacketDetailsContact";
import ProposalPacketFooter from "./ProposalPacketFooter";
import ProposalPacketHero from "./ProposalPacketHero";
import ProposalPacketScope from "./ProposalPacketScope";
import ProposalPacketSelectedCard from "./ProposalPacketSelectedCard";
import ProposalPacketTrustBand from "./ProposalPacketTrustBand";
import { PROPOSAL_PACKET_PAGE, PROPOSAL_PACKET_SHELL } from "./proposalPacketStyles";

export type ProposalPacketMode = "public" | "preview";

type ProposalPacketProps = {
  packet: ProposalCustomerPacketViewModel;
  mode?: ProposalPacketMode;
};

export default function ProposalPacket({ packet, mode = "public" }: ProposalPacketProps) {
  const selectedCard = packet.estimate ? (
    <ProposalPacketSelectedCard estimate={packet.estimate} />
  ) : null;

  return (
    <main className={PROPOSAL_PACKET_PAGE} data-proposal-packet-mode={mode}>
      <article className={PROPOSAL_PACKET_SHELL}>
        <ProposalPacketHero cover={packet.cover} selectedCard={selectedCard} />
        <ProposalPacketTrustBand />

        {packet.estimate ? <ProposalPacketScope estimate={packet.estimate} /> : null}

        <ProposalPacketCompareUpgrades comparison={packet.comparison} upgrades={packet.upgrades} />

        <ProposalPacketDetailsContact details={packet.details} contact={packet.contact} />

        <ProposalPacketFooter contact={packet.contact} />
      </article>
    </main>
  );
}
