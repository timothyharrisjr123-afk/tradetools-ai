import type { ReactNode } from "react";
import type { ProposalCustomerPacketCoverViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import ProposalPacketCompanyMark from "./ProposalPacketCompanyMark";
import { IconHome, IconUser } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_EYEBROW,
  PROPOSAL_PACKET_HERO_TITLE,
  PROPOSAL_PACKET_HERO_VISUAL,
  PROPOSAL_PACKET_LEAD,
} from "./proposalPacketStyles";

type ProposalPacketHeroProps = {
  cover: ProposalCustomerPacketCoverViewModel;
  selectedCard?: ReactNode;
};

function MetadataBlock({
  icon: Icon,
  label,
  lines,
}: {
  icon: typeof IconUser;
  label: string;
  lines: (string | null | undefined)[];
}) {
  const values = lines.map((line) => (line ?? "").trim()).filter(Boolean);
  if (values.length === 0) return null;

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#475569]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-[#0f172a]">{label}</p>
        {values.map((value) => (
          <p key={`${label}-${value}`} className="text-[15px] leading-snug text-[#475569]">
            {value}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function ProposalPacketHero({ cover, selectedCard }: ProposalPacketHeroProps) {
  return (
    <header aria-label="Proposal cover">
      <div className="relative pb-6 lg:pb-32">
        <div className="grid lg:grid-cols-[58%_42%]">
          <div className="relative z-10 bg-gradient-to-br from-white via-white to-slate-50/80 px-6 pb-8 pt-10 sm:px-10 sm:pt-12 lg:px-12 lg:pb-16 lg:pt-14">
            <div className="flex items-center gap-4">
              <ProposalPacketCompanyMark company={cover.company} variant="hero" />
              <div className="min-w-0">
                {cover.company.companyName ? (
                  <p className="text-lg font-bold tracking-tight text-[#0f172a] sm:text-xl">
                    {cover.company.companyName}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <p className={PROPOSAL_PACKET_EYEBROW}>{cover.proposalLabel}</p>
              {cover.headline ? (
                <h1 className={PROPOSAL_PACKET_HERO_TITLE}>{cover.headline}</h1>
              ) : null}
              <p className={PROPOSAL_PACKET_LEAD}>{cover.confidenceCopy}</p>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 sm:gap-8">
              {cover.preparedFor.hasAnyField ? (
                <MetadataBlock
                  icon={IconUser}
                  label="Prepared for"
                  lines={[
                    cover.preparedFor.customerName,
                    cover.preparedFor.customerEmail,
                    cover.preparedFor.customerPhone,
                  ]}
                />
              ) : null}
              {cover.project.hasAnyField ? (
                <MetadataBlock
                  icon={IconHome}
                  label="Project"
                  lines={[cover.project.propertyAddress, cover.project.jobName]}
                />
              ) : null}
            </div>

            {selectedCard ? <div className="mt-8 lg:hidden">{selectedCard}</div> : null}
          </div>

          <div className={`${PROPOSAL_PACKET_HERO_VISUAL} relative overflow-hidden`} aria-hidden>
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 14px)",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#071f3a]/40 via-transparent to-transparent" />
          </div>
        </div>

        {selectedCard ? (
          <div
            className="pointer-events-none absolute bottom-0 right-6 z-20 hidden w-[min(100%,360px)] translate-y-[38%] lg:block lg:right-10 xl:right-12"
            aria-hidden={false}
          >
            {selectedCard}
          </div>
        ) : null}
      </div>
    </header>
  );
}
