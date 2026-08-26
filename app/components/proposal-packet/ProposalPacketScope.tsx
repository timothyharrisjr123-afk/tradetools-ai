import type {
  ProposalCustomerPacketEstimateViewModel,
  ProposalCustomerPacketScopeGroupViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { PROPOSAL_CUSTOMER_PACKET_INCLUDES_LABEL } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  filterMainIncludedScopeSummaries,
  sortMainIncludedScopeSummaries,
} from "@/app/lib/proposalCustomerPacketIncludedScope";
import { scopeGroupIcon } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_DISCLOSURE,
  PROPOSAL_PACKET_SCOPE_COUNT,
  PROPOSAL_PACKET_SCOPE_ICON,
  PROPOSAL_PACKET_SCOPE_TILE,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

type ProposalPacketScopeProps = {
  estimate: ProposalCustomerPacketEstimateViewModel;
};

function IncludedDetailsGroup({ group }: { group: ProposalCustomerPacketScopeGroupViewModel }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-semibold text-[#0b1f33]">{group.title}</p>
      <ul className="space-y-1">
        {group.lines.map((line) => (
          <li
            key={`${group.title}-${line.name}`}
            className="flex items-start justify-between gap-3 text-[13px] text-[#475569]"
          >
            <span className="min-w-0 leading-snug">{line.name}</span>
            {line.valueLabel ? (
              <span className="shrink-0 tabular-nums text-[#0b1f33]">{line.valueLabel}</span>
            ) : line.kind === "included" ? (
              <span className="shrink-0 text-[11px] font-medium text-emerald-700">Included</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProposalPacketScope({ estimate }: ProposalPacketScopeProps) {
  const summaries = sortMainIncludedScopeSummaries(
    filterMainIncludedScopeSummaries(estimate.scopeGroupSummaries)
  );
  if (summaries.length === 0 && estimate.includedDetails.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3.5">
        <h2 className={PROPOSAL_PACKET_SECTION_TITLE}>{PROPOSAL_CUSTOMER_PACKET_INCLUDES_LABEL}</h2>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>
          Everything covered by your package.
        </p>
      </div>

      {summaries.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:gap-3">
          {summaries.map((group) => {
            const Icon = scopeGroupIcon(group.title);
            const itemLabel = group.itemCount === 1 ? "1 item" : `${group.itemCount} items`;
            return (
              <div key={group.title} className={PROPOSAL_PACKET_SCOPE_TILE}>
                <div className="flex w-full items-start justify-between gap-2">
                  <span className={PROPOSAL_PACKET_SCOPE_ICON}>
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className={PROPOSAL_PACKET_SCOPE_COUNT} title={itemLabel}>
                    {group.itemCount}
                  </span>
                </div>
                <p className="mt-2.5 text-[13px] font-semibold leading-snug tracking-[-0.01em] text-[#0b1f33]">
                  {group.title}
                </p>
                {group.previewLabel ? (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#64748b]">
                    {group.previewLabel}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {estimate.includedDetails.length > 0 ? (
        <details className="group mt-3">
          <summary className={PROPOSAL_PACKET_DISCLOSURE}>
            <span>View full scope of work</span>
            <span className="text-[#94a3b8] transition-transform group-open:rotate-180" aria-hidden>
              ˅
            </span>
          </summary>
          <div className="mt-2.5 space-y-3.5 rounded-[14px] border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-3.5">
            {estimate.includedDetails.map((group) => (
              <IncludedDetailsGroup key={group.title} group={group} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
