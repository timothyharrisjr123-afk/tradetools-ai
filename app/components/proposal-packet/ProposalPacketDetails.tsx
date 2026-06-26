"use client";

import type { ProposalCustomerPacketDetailsViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_PACKET_BODY,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

type ProposalPacketDetailsProps = {
  details: ProposalCustomerPacketDetailsViewModel;
  activeId?: string;
  onTabChange?: (id: string) => void;
  embedded?: boolean;
};

export default function ProposalPacketDetails({
  details,
  activeId: controlledActiveId,
  onTabChange,
  embedded = false,
}: ProposalPacketDetailsProps) {
  const defaultId = details.tabs[0]?.id ?? "";
  const activeId = controlledActiveId ?? defaultId;
  const activeTab = details.tabs.find((tab) => tab.id === activeId) ?? details.tabs[0];
  const showTabs = details.tabs.length > 1;

  if (!activeTab) {
    return null;
  }

  const handleTabChange = (id: string) => {
    onTabChange?.(id);
  };

  return (
    <section
      className={embedded ? "min-w-0" : undefined}
      aria-label="Proposal details"
    >
      <div className="mb-5">
        <h3 className={PROPOSAL_PACKET_SECTION_TITLE}>Proposal details</h3>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>
          Additional information about your project.
        </p>
      </div>

      {showTabs ? (
        <>
          <div
            className="flex gap-0 overflow-x-auto border-b border-[#e2e8f0]"
            role="tablist"
            aria-label="Proposal detail sections"
          >
            {details.tabs.map((tab) => {
              const isActive = tab.id === activeTab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabChange(tab.id)}
                  className={[
                    "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-[#071f3a] text-[#0f172a]"
                      : "border-transparent text-[#64748b] hover:text-[#475569]",
                  ].join(" ")}
                >
                  {tab.title}
                </button>
              );
            })}
          </div>
          <div className="py-5 sm:py-6" role="tabpanel">
            <div className={PROPOSAL_PACKET_BODY}>{activeTab.body}</div>
          </div>
        </>
      ) : (
        <div role="tabpanel">
          <div className={PROPOSAL_PACKET_BODY}>{activeTab.body}</div>
        </div>
      )}
    </section>
  );
}
