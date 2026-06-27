import type { ProposalCustomerPacketViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketComparison from "./ProposalPacketComparison";
import ProposalPacketDetailsContact from "./ProposalPacketDetailsContact";
import ProposalPacketFooter from "./ProposalPacketFooter";
import ProposalPacketHero from "./ProposalPacketHero";
import ProposalPacketTopBar from "./ProposalPacketTopBar";
import ProposalPacketTotalSummary from "./ProposalPacketTotalSummary";
import ProposalPacketTrustBand from "./ProposalPacketTrustBand";
import ProposalPacketUpgrades from "./ProposalPacketUpgrades";
import {
  PROPOSAL_PACKET_DECISION_SECTION,
  PROPOSAL_PACKET_DECISION_ROW,
  PROPOSAL_PACKET_PAGE,
  PROPOSAL_PACKET_SHELL,
} from "./proposalPacketStyles";

export type ProposalPacketMode = "public" | "preview";

type ProposalPacketProps = {
  packet: ProposalCustomerPacketViewModel;
  mode?: ProposalPacketMode;
};

export default function ProposalPacket({ packet, mode = "public" }: ProposalPacketProps) {
  const showComparison = packet.comparison != null && packet.comparison.options.length > 0;
  const showUpgrades = packet.upgrades != null && packet.upgrades.items.length > 0;
  const showTotalSummary =
    packet.estimate?.totalInvestmentLabel != null && (showComparison || showUpgrades);

  return (
    <main className={PROPOSAL_PACKET_PAGE} data-proposal-packet-mode={mode}>
      <article className={PROPOSAL_PACKET_SHELL}>
        <ProposalPacketTopBar cover={packet.cover} />
        <ProposalPacketHero cover={packet.cover} />
        <ProposalPacketTrustBand />

        {(showComparison || showUpgrades || showTotalSummary) ? (
          <section className={PROPOSAL_PACKET_DECISION_SECTION} aria-label="Package decision area">
            {showComparison ? <ProposalPacketComparison comparison={packet.comparison!} /> : null}

            {(showUpgrades || showTotalSummary) ? (
              <div className={PROPOSAL_PACKET_DECISION_ROW}>
                <div className="min-w-0">
                  {showUpgrades ? <ProposalPacketUpgrades upgrades={packet.upgrades!} /> : null}
                </div>
                <div className="min-w-0 lg:pt-[2.65rem]">
                  {showTotalSummary && packet.estimate ? (
                    <ProposalPacketTotalSummary estimate={packet.estimate} />
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <ProposalPacketDetailsContact details={packet.details} contact={packet.contact} />

        <ProposalPacketFooter contact={packet.contact} footerMetadata={packet.footerMetadata} />
      </article>
    </main>
  );
}
