import type {
  ProposalCustomerPacketEstimateViewModel,
  ProposalCustomerPacketScopeGroupViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { scopeGroupIcon } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_DISCLOSURE,
  PROPOSAL_PACKET_SCOPE_COUNT,
  PROPOSAL_PACKET_SCOPE_TILE,
  PROPOSAL_PACKET_SECTION,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

const SCOPE_TILE_ORDER = [
  "Roofing materials",
  "Ventilation & flashing",
  "Installation & labor",
  "Cleanup & disposal",
  "Permits & fees",
] as const;

type ProposalPacketScopeProps = {
  estimate: ProposalCustomerPacketEstimateViewModel;
};

function sortScopeSummaries(
  summaries: ProposalCustomerPacketEstimateViewModel["scopeGroupSummaries"]
) {
  return [...summaries].sort((a, b) => {
    const ai = SCOPE_TILE_ORDER.indexOf(a.title as (typeof SCOPE_TILE_ORDER)[number]);
    const bi = SCOPE_TILE_ORDER.indexOf(b.title as (typeof SCOPE_TILE_ORDER)[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function IncludedDetailsGroup({ group }: { group: ProposalCustomerPacketScopeGroupViewModel }) {
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-semibold text-[#0f172a]">{group.title}</p>
      <ul className="space-y-2">
        {group.lines.map((line) => (
          <li
            key={`${group.title}-${line.name}`}
            className="flex items-start justify-between gap-4 text-sm text-[#475569]"
          >
            <span className="min-w-0 leading-snug">{line.name}</span>
            {line.valueLabel ? (
              <span className="shrink-0 tabular-nums text-[#0f172a]">{line.valueLabel}</span>
            ) : line.kind === "included" ? (
              <span className="shrink-0 text-xs font-medium text-emerald-700/90">Included</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProposalPacketScope({ estimate }: ProposalPacketScopeProps) {
  const summaries = sortScopeSummaries(estimate.scopeGroupSummaries);
  if (summaries.length === 0 && estimate.includedDetails.length === 0) {
    return null;
  }

  return (
    <section className={`${PROPOSAL_PACKET_SECTION} space-y-8`} aria-label="Included scope">
      {summaries.length > 0 ? (
        <div className="space-y-6">
          <div>
            <h2 className={PROPOSAL_PACKET_SECTION_TITLE}>Included in this estimate</h2>
            <p className={PROPOSAL_PACKET_SECTION_INTRO}>
              High-level scope included with the current package.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {summaries.map((group) => {
              const Icon = scopeGroupIcon(group.title);
              return (
                <div key={group.title} className={PROPOSAL_PACKET_SCOPE_TILE}>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#071f3a]/5 text-[#071f3a]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-[#0f172a]">{group.title}</p>
                  <span className={PROPOSAL_PACKET_SCOPE_COUNT}>{group.itemCount}</span>
                  <p className="mt-2 text-xs leading-relaxed text-[#64748b]">{group.previewLabel}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {estimate.includedDetails.length > 0 ? (
        <details className="group">
          <summary className={PROPOSAL_PACKET_DISCLOSURE}>
            <span>View full included details</span>
            <span
              className="text-[#94a3b8] transition-transform duration-200 group-open:rotate-180"
              aria-hidden
            >
              ˅
            </span>
          </summary>
          <div className="mt-4 space-y-5 pt-2">
            {estimate.includedDetails.map((group) => (
              <IncludedDetailsGroup key={group.title} group={group} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
