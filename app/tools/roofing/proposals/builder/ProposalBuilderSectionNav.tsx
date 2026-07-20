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
      className="px-2 py-3"
      aria-label="Proposal sections"
      data-builder-document-section-nav
    >
      <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Proposal sections
      </p>
      <ul className="space-y-0.5">
        {sectionItems.map((item) => (
          <li key={item.id}>
            <SectionNavButton
              item={item}
              isActive={item.id === activePageContextId}
              onSelect={onSelectPageContext}
            />
          </li>
        ))}
      </ul>
      {overflowPages.length > 0 ? (
        <div className="mt-2 border-t border-slate-200/70 px-1 pt-2">
          <ProposalBuilderOverflowMenu
            overflowPages={overflowPages}
            activePageContextId={activePageContextId}
            onSelectPageContext={onSelectPageContext}
          />
        </div>
      ) : null}
    </nav>
  );
}

function SectionNavButton({
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
      disabled={disabled}
      aria-current={isActive ? "page" : undefined}
      data-builder-section-nav-item={item.id}
      data-active={isActive ? "true" : "false"}
      onClick={() => item.enabled && onSelect(item.id)}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition ${
        isActive
          ? "bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/80"
          : disabled
            ? "cursor-not-allowed text-slate-400"
            : "font-medium text-slate-600 hover:bg-white/70 hover:text-slate-900"
      }`}
    >
      <span className="min-w-0 truncate">{item.label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {item.fromDb && item.customerVisible === false ? (
          <EyeOff className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        ) : null}
        {isActive ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
            Active
          </span>
        ) : null}
      </span>
    </button>
  );
}
