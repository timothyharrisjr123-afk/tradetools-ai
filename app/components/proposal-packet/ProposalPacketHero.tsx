import type { ProposalCustomerPacketCoverViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import { IconHome, IconUser } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_EYEBROW,
  PROPOSAL_PACKET_HERO_GRID,
  PROPOSAL_PACKET_HERO_LEAD,
  PROPOSAL_PACKET_HERO_LEFT,
  PROPOSAL_PACKET_HERO_MEDIA_CLIP,
  PROPOSAL_PACKET_HERO_MEDIA_COLUMN,
  PROPOSAL_PACKET_HERO_TITLE,
  PROPOSAL_PACKET_HERO_VISUAL,
} from "./proposalPacketStyles";

type ProposalPacketHeroProps = {
  cover: ProposalCustomerPacketCoverViewModel;
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
    <div className="flex min-w-0 gap-4">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dbe4ef] bg-white text-[#64748b] shadow-sm">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-[#0f172a]">{label}</p>
        <div className="mt-2 space-y-1">
          {values.map((value) => (
            <p key={`${label}-${value}`} className="break-words text-[15px] leading-snug text-[#475569]">
              {value}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroMediaFallback() {
  return (
    <>
      <div className="absolute inset-0 bg-[#061a33]" />
      <div className="absolute inset-0 bg-[linear-gradient(155deg,#0a2444_0%,#0f2f4f_42%,#152f52_68%,#061a33_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(155deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 16px)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.08),transparent_38%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#061a33]/50 to-transparent" />
    </>
  );
}

function HeroMediaSlot({ coverMediaUrl }: { coverMediaUrl: string | null }) {
  return (
    <div className={`${PROPOSAL_PACKET_HERO_VISUAL} ${PROPOSAL_PACKET_HERO_MEDIA_CLIP}`}>
      {coverMediaUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverMediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-l from-[#061a33]/18 via-transparent to-white/10" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#061a33]/55 to-transparent" />
        </>
      ) : (
        <HeroMediaFallback />
      )}
    </div>
  );
}

export default function ProposalPacketHero({ cover }: ProposalPacketHeroProps) {
  return (
    <header aria-label="Proposal cover" className="bg-white">
      <div className={PROPOSAL_PACKET_HERO_GRID}>
        <div className={PROPOSAL_PACKET_HERO_LEFT}>
          <div className="max-w-[29rem]">
            <p className={PROPOSAL_PACKET_EYEBROW}>{cover.proposalLabel}</p>
            {cover.headline ? <h1 className={PROPOSAL_PACKET_HERO_TITLE}>{cover.headline}</h1> : null}
            <p className={PROPOSAL_PACKET_HERO_LEAD}>{cover.confidenceCopy}</p>
          </div>

          <div className="mt-7 grid gap-6 sm:grid-cols-2">
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
        </div>

        <div className={PROPOSAL_PACKET_HERO_MEDIA_COLUMN}>
          <HeroMediaSlot coverMediaUrl={cover.coverMediaUrl} />
        </div>
      </div>
    </header>
  );
}
