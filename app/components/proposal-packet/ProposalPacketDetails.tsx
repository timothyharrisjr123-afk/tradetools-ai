"use client";

import { useMemo } from "react";

import type {
  ProposalCustomerPacketDetailTabViewModel,
  ProposalCustomerPacketDetailsViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";

import { PROPOSAL_CUSTOMER_PACKET_DETAILS_HEADING } from "@/app/lib/proposalCustomerPacketViewModel";

import { IconHome, IconInfo, IconShield, IconStar, IconTool } from "./ProposalPacketIcons";

import {
  PROPOSAL_PACKET_BODY,
  PROPOSAL_PACKET_DETAILS_CARD,
  PROPOSAL_PACKET_DETAILS_CARD_ACCENT,
  PROPOSAL_PACKET_DETAILS_CHIP,
  PROPOSAL_PACKET_DETAILS_CHIP_DISABLED,
  PROPOSAL_PACKET_DETAILS_ICON_TILE,
  PROPOSAL_PACKET_DETAILS_SECTION_LABEL,
  PROPOSAL_PACKET_DETAILS_TAB_ROW,
  PROPOSAL_PACKET_DISCLOSURE,
  PROPOSAL_PACKET_SECTION_INTRO,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

export type DetailSectionKey = "overview" | "scope" | "materials" | "warranty" | "terms";

const DETAIL_SECTIONS: { key: DetailSectionKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "scope", label: "Scope" },
  { key: "materials", label: "Materials" },
  { key: "warranty", label: "Warranty" },
  { key: "terms", label: "Terms" },
];

const SECTION_DISPLAY_LABELS: Record<DetailSectionKey, string> = {
  overview: "Project overview",
  scope: "Scope of work",
  materials: "Materials",
  warranty: "Warranty",
  terms: "Terms",
};

const SECTION_ICONS: Record<DetailSectionKey, typeof IconHome> = {
  overview: IconHome,
  scope: IconTool,
  materials: IconStar,
  warranty: IconShield,
  terms: IconInfo,
};

function pageTypeFromTabId(id: string): string {
  return id.split(":")[0] ?? "";
}

export function resolveDetailSectionKey(
  tab: ProposalCustomerPacketDetailTabViewModel
): DetailSectionKey | null {
  const pageType = pageTypeFromTabId(tab.id);
  const title = tab.title.toLowerCase();

  if (pageType === "project_overview" || /\boverview\b/.test(title)) return "overview";
  if (pageType === "warranty" || /\bwarrant/.test(title)) return "warranty";
  if (pageType === "terms" || /\bterms?\b/.test(title)) return "terms";
  if (/\bmaterial/.test(title)) return "materials";
  if (/\bscope\b/.test(title)) return "scope";

  return null;
}

export function buildDetailSectionMap(
  tabs: ProposalCustomerPacketDetailTabViewModel[]
): Map<DetailSectionKey, ProposalCustomerPacketDetailTabViewModel> {
  const map = new Map<DetailSectionKey, ProposalCustomerPacketDetailTabViewModel>();
  for (const tab of tabs) {
    const key = resolveDetailSectionKey(tab);
    if (key && !map.has(key)) {
      map.set(key, tab);
    }
  }
  return map;
}

export function firstAvailableDetailSection(
  sectionMap: Map<DetailSectionKey, ProposalCustomerPacketDetailTabViewModel>
): DetailSectionKey {
  for (const section of DETAIL_SECTIONS) {
    if (sectionMap.has(section.key)) return section.key;
  }
  return "overview";
}

type ProposalPacketDetailsProps = {
  details: ProposalCustomerPacketDetailsViewModel;
  activeSection?: DetailSectionKey;
  onSectionChange?: (key: DetailSectionKey) => void;
  embedded?: boolean;
};

export default function ProposalPacketDetails({
  details,
  activeSection: controlledSection,
  onSectionChange,
  embedded = false,
}: ProposalPacketDetailsProps) {
  const sectionMap = useMemo(() => buildDetailSectionMap(details.tabs), [details.tabs]);
  const defaultSection = useMemo(() => firstAvailableDetailSection(sectionMap), [sectionMap]);
  const activeSection = controlledSection ?? defaultSection;
  const activeTab = sectionMap.get(activeSection) ?? null;
  const ActiveIcon = SECTION_ICONS[activeSection];
  const sectionLabel = SECTION_DISPLAY_LABELS[activeSection];

  const handleSectionChange = (key: DetailSectionKey) => {
    if (!sectionMap.has(key)) return;
    onSectionChange?.(key);
  };

  return (
    <section className={`${embedded ? "min-w-0" : ""} flex flex-col`} aria-label="Proposal details">
      <div className="mb-4">
        <h2 className={PROPOSAL_PACKET_SECTION_TITLE}>{PROPOSAL_CUSTOMER_PACKET_DETAILS_HEADING}</h2>
        <p className={PROPOSAL_PACKET_SECTION_INTRO}>Additional information about your project.</p>
      </div>

      <div className={PROPOSAL_PACKET_DETAILS_TAB_ROW} role="tablist" aria-label="Proposal detail sections">
        {DETAIL_SECTIONS.map((section) => {
          const isAvailable = sectionMap.has(section.key);
          const isActive = activeSection === section.key && isAvailable;

          if (!isAvailable) {
            return (
              <span
                key={section.key}
                role="tab"
                aria-selected={false}
                aria-disabled="true"
                title="Not included in this proposal yet"
                className={PROPOSAL_PACKET_DETAILS_CHIP_DISABLED}
              >
                {section.label}
              </span>
            );
          }

          return (
            <button
              key={section.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSectionChange(section.key)}
              className={[
                PROPOSAL_PACKET_DETAILS_CHIP,
                isActive
                  ? "bg-white text-[#061a33] shadow-sm ring-1 ring-[#dbe4ef]"
                  : "text-[#64748b] hover:bg-white/60 hover:text-[#334155]",
              ].join(" ")}
            >
              {section.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className={`${PROPOSAL_PACKET_DETAILS_CARD} ${PROPOSAL_PACKET_DETAILS_CARD_ACCENT} mt-3`}
      >
        {activeTab ? (
          <>
            <div className="flex gap-3.5 p-4 sm:gap-4 sm:p-5">
              <span className={PROPOSAL_PACKET_DETAILS_ICON_TILE}>
                <ActiveIcon className="h-[17px] w-[17px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className={PROPOSAL_PACKET_DETAILS_SECTION_LABEL}>{sectionLabel}</p>
                <div className={`${PROPOSAL_PACKET_BODY} mt-2.5 text-[14px] leading-[1.65] text-[#334155]`}>
                  {activeTab.body}
                </div>
              </div>
            </div>
            <div className="border-t border-[#e8edf3] bg-[#fafbfd] px-4 py-2.5 sm:px-5 sm:py-3">
              <p className={PROPOSAL_PACKET_DISCLOSURE} aria-hidden="true">
                <span>View full proposal details</span>
                <span className="text-[#2563eb]/80">›</span>
              </p>
            </div>
          </>
        ) : (
          <div className="p-5 text-[13px] leading-relaxed text-[#94a3b8]">Select an available section above.</div>
        )}
      </div>
    </section>
  );
}
