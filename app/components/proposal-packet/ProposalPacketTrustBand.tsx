import { IconChat, IconShield, IconTool } from "./ProposalPacketIcons";
import { PROPOSAL_PACKET_TRUST_BAND } from "./proposalPacketStyles";

const TRUST_POINTS = [
  {
    icon: IconShield,
    title: "Quality materials",
    description: "Premium products, built to last",
  },
  {
    icon: IconTool,
    title: "Expert installation",
    description: "Experienced local professionals",
  },
  {
    icon: IconChat,
    title: "Clear process",
    description: "Honest communication every step",
  },
] as const;

export default function ProposalPacketTrustBand() {
  return (
    <section className={PROPOSAL_PACKET_TRUST_BAND} aria-label="Why choose us">
      <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
        {TRUST_POINTS.map((point) => {
          const Icon = point.icon;
          return (
            <div key={point.title} className="flex gap-4 sm:flex-col sm:items-center sm:text-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">{point.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/75">{point.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
