import {
  PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_HEADING,
  PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_LINES,
  PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_PRICING_FALLBACK,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { IconCheck, IconShield, IconTool } from "./ProposalPacketIcons";
import { PROPOSAL_PACKET_ABOUT_CARD } from "./proposalPacketStyles";

const ABOUT_ICONS = [IconCheck, IconShield, IconTool] as const;

export default function ProposalPacketAboutPackages() {
  return (
    <aside className={PROPOSAL_PACKET_ABOUT_CARD} aria-label="About the packages">
      <h3 className="text-[1.15rem] font-bold leading-snug tracking-tight text-[#0f172a]">
        {PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_HEADING}
      </h3>

      <ul className="mt-5 flex-1 space-y-4">
        {PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_LINES.map((line, index) => {
          const Icon = ABOUT_ICONS[index] ?? IconCheck;
          return (
            <li key={line} className="flex gap-3 text-[13px] leading-[1.55] text-[#334155]">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#2563eb] shadow-sm">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="[overflow-wrap:normal]">{line}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 border-t border-[#dbe4ef] pt-4">
        <p className="text-[13px] leading-relaxed text-[#64748b]">
          {PROPOSAL_CUSTOMER_PACKET_ABOUT_PACKAGES_PRICING_FALLBACK}
        </p>
      </div>
    </aside>
  );
}
