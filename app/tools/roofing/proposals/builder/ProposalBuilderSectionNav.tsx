"use client";

import { EyeOff } from "lucide-react";
import {
  buildPageContextStripItems,
  type BuilderPageContextId,
  type PageStripItem,
} from "@/app/lib/proposalBuilderNavigation";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";
import ProposalBuilderOverflowMenu from "./ProposalBuilderOverflowMenu";

type ProposalBuilderSectionNavProps = {
  pages: ProposalPageRow[] | null | undefined;
  activePageContextId: BuilderPageContextId;
  onSelectPageContext: (id: BuilderPageContextId) => void;
  persistedProposalDocument?: boolean;
};

/**
 * Polished top proposal section bar — Job Card tab continuity.
 * No left rail. No TEMPLATE / EMPTY / ACTIVE badge strip.
 */
export default function ProposalBuilderSectionNav({
  pages,
  activePageContextId,
  onSelectPageContext,
  persistedProposalDocument = false,
}: ProposalBuilderSectionNavProps) {
  const { items, overflowPages } = buildPageContextStripItems(pages, {
    persistedProposalDocument,
  });

  const sectionItems = items.filter(
    (item) => item.id !== "preview" && item.id !== "add_page"
  );

  return (
    <nav
      className="border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white/95"
      aria-label="Proposal sections"
      data-builder-document-section-nav
      data-builder-section-bar="top"
    >
      <div className="flex items-stretch gap-1 overflow-x-auto px-3 sm:px-5 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/70">
        {sectionItems.map((item) => (
          <SectionTabButton
            key={item.id}
            item={item}
            isActive={item.id === activePageContextId}
            onSelect={onSelectPageContext}
          />
        ))}
        {overflowPages.length > 0 ? (
          <div className="flex shrink-0 items-center px-1 py-1.5">
            <ProposalBuilderOverflowMenu
              overflowPages={overflowPages}
              activePageContextId={activePageContextId}
              onSelectPageContext={onSelectPageContext}
            />
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function SectionTabButton({
  item,
  isActive,
  onSelect,
}: {
  item: PageStripItem;
  isActive: boolean;
  onSelect: (id: BuilderPageContextId) => void;
}) {
  const disabled = !item.enabled;

  return (
    <button
      type="button"
      role="tab"
      disabled={disabled}
      aria-selected={isActive}
      aria-current={isActive ? "page" : undefined}
      data-builder-section-nav-item={item.id}
      data-active={isActive ? "true" : "false"}
      onClick={() => item.enabled && onSelect(item.id)}
      className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-t-lg px-3.5 py-2.5 text-[13px] font-medium transition sm:px-4 ${
        isActive
          ? "bg-white font-semibold text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(15,23,42,0.04)] after:absolute after:inset-x-2.5 after:bottom-0 after:h-[2px] after:rounded-full after:bg-blue-600"
          : disabled
            ? "cursor-not-allowed text-slate-400"
            : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
      }`}
    >
      <span className="whitespace-nowrap">{item.label}</span>
      {item.fromDb && item.customerVisible === false ? (
        <EyeOff className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      ) : null}
    </button>
  );
}
