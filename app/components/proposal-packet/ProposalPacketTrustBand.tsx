import { IconChat, IconShield, IconTool } from "./ProposalPacketIcons";
import { PROPOSAL_PACKET_TRUST_BAND } from "./proposalPacketStyles";

const TRUST_ITEMS = [
  {
    title: "Quality materials",
    body: "Premium products, built to last",
    icon: IconShield,
  },
  {
    title: "Expert installation",
    body: "Experienced local professionals",
    icon: IconTool,
  },
  {
    title: "Clear process",
    body: "Honest communication every step",
    icon: IconChat,
  },
] as const;

export default function ProposalPacketTrustBand() {
  return (
    <section className={PROPOSAL_PACKET_TRUST_BAND} aria-label="Proposal confidence points">
      <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
        {TRUST_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex flex-col items-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] text-white">
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <p className="mt-2.5 text-[13px] font-bold text-white">{item.title}</p>
              <p className="mt-1 max-w-[11rem] text-[12px] leading-snug text-white/70">{item.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
