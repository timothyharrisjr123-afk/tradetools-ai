"use client";

import { useMemo } from "react";

import type {
  ProposalCustomerPacketDetailTabViewModel,
  ProposalCustomerPacketDetailsViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";

import { PROPOSAL_CUSTOMER_PACKET_DETAILS_HEADING } from "@/app/lib/proposalCustomerPacketViewModel";

import { IconHome, IconInfo, IconShield } from "./ProposalPacketIcons";

import {
  PROPOSAL_PACKET_BODY,
  PROPOSAL_PACKET_DETAILS_ICON_TILE,
  PROPOSAL_PACKET_SECTION_TITLE,
} from "./proposalPacketStyles";

export type DetailSectionKey = "overview" | "scope" | "materials" | "warranty" | "terms";

/** Approved accordion set — Project overview, Warranty, Terms. */
const DETAIL_SECTIONS: {
  key: DetailSectionKey;
  fallbackLabel: string;
  Icon: typeof IconHome;
}[] = [
  { key: "overview", fallbackLabel: "Project overview", Icon: IconHome },
  { key: "warranty", fallbackLabel: "Warranty", Icon: IconShield },
  { key: "terms", fallbackLabel: "Terms", Icon: IconInfo },
];

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
  if (
    pageType === "terms" ||
    /\bterms?\b/.test(title) ||
    /\bnext steps?\b/.test(title) ||
    /\bwhat happens next\b/.test(title)
  ) {
    return "terms";
  }
  if (/\bmaterial/.test(title)) return "materials";
  if (/\bscope\b/.test(title) || /\bproject notes?\b/.test(title) || /\bnotes?\b/.test(title)) {
    return "scope";
  }

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
  embedded = false,
}: ProposalPacketDetailsProps) {
  const sectionMap = useMemo(() => buildDetailSectionMap(details.tabs), [details.tabs]);
  const ordered = DETAIL_SECTIONS.filter((section) => sectionMap.has(section.key));

  if (ordered.length === 0) return null;

  return (
    <section className={embedded ? "min-w-0" : undefined} aria-label="Warranty, notes and terms">
      <h2 className={`${PROPOSAL_PACKET_SECTION_TITLE} mb-4`}>
        {PROPOSAL_CUSTOMER_PACKET_DETAILS_HEADING}
      </h2>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white">
        {ordered.map((section, index) => {
          const tab = sectionMap.get(section.key)!;
          const title = section.fallbackLabel;
          const Icon = section.Icon;

          return (
            <details
              key={section.key}
              className={["group", index > 0 ? "border-t border-[#eef2f6]" : ""].join(" ")}
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 hover:bg-[#f8fafc] [&::-webkit-details-marker]:hidden">
                <span className={PROPOSAL_PACKET_DETAILS_ICON_TILE}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-[14px] font-semibold text-[#0b1f33]">
                  {title}
                </span>
                <span
                  className="text-[#94a3b8] transition-transform group-open:rotate-180"
                  aria-hidden
                >
                  ˅
                </span>
              </summary>
              <div className={`${PROPOSAL_PACKET_BODY} border-t border-[#eef2f6] bg-[#f8fafc] px-4 py-3.5`}>
                {tab.body}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
