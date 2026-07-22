import type { ProposalCustomerPacketViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketComparison from "./ProposalPacketComparison";
import ProposalPacketDetailsContact from "./ProposalPacketDetailsContact";
import ProposalPacketFooter from "./ProposalPacketFooter";
import ProposalPacketHero from "./ProposalPacketHero";
import ProposalPacketScope from "./ProposalPacketScope";
import ProposalPacketTopBar from "./ProposalPacketTopBar";
import ProposalPacketUpgrades from "./ProposalPacketUpgrades";
import {
  PROPOSAL_PACKET_PAGE,
  PROPOSAL_PACKET_SHELL,
  PROPOSAL_PACKET_STORY_SECTION,
  PROPOSAL_PACKET_STORY_SECTION_MUTED,
} from "./proposalPacketStyles";

export type ProposalPacketMode = "public" | "preview";

type ProposalPacketProps = {
  packet: ProposalCustomerPacketViewModel;
  mode?: ProposalPacketMode;
};

/**
 * Approved FieldDive customer proposal page.
 *
 * Navy brand bar → hero + recommend/invest card → compare → included →
 * upgrades → accordion details → closeout → footer.
 */
export default function ProposalPacket({ packet, mode = "public" }: ProposalPacketProps) {
  const showComparison = packet.comparison != null && packet.comparison.options.length > 1;
  const showUpgrades = packet.upgrades != null && packet.upgrades.items.length > 0;
  const showIncludedScope =
    packet.estimate != null &&
    (packet.estimate.scopeGroupSummaries.length > 0 ||
      packet.estimate.includedDetails.length > 0);

  return (
    <main className={PROPOSAL_PACKET_PAGE} data-proposal-packet-mode={mode}>
      <article className={PROPOSAL_PACKET_SHELL} aria-label="Customer proposal">
        <ProposalPacketTopBar cover={packet.cover} />
        <ProposalPacketHero
          cover={packet.cover}
          estimate={packet.estimate}
          upgrades={packet.upgrades}
          contact={packet.contact}
        />

        {showComparison ? (
          <section className={PROPOSAL_PACKET_STORY_SECTION} aria-label="Compare packages">
            <ProposalPacketComparison comparison={packet.comparison!} contact={packet.contact} />
          </section>
        ) : null}

        {showIncludedScope && packet.estimate ? (
          <section
            className={showComparison ? PROPOSAL_PACKET_STORY_SECTION_MUTED : PROPOSAL_PACKET_STORY_SECTION}
            aria-label="What is included"
          >
            <ProposalPacketScope estimate={packet.estimate} />
          </section>
        ) : null}

        {showUpgrades ? (
          <section className={PROPOSAL_PACKET_STORY_SECTION} aria-label="Selected upgrades">
            <ProposalPacketUpgrades upgrades={packet.upgrades!} />
          </section>
        ) : null}

        <ProposalPacketDetailsContact
          details={packet.details}
          contact={packet.contact}
          recommendedPackageLabel={packet.estimate?.label ?? null}
        />

        <ProposalPacketFooter contact={packet.contact} footerMetadata={packet.footerMetadata} />
      </article>
    </main>
  );
}
