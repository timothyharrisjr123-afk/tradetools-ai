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
      className="rounded-xl border border-slate-200/80 bg-white px-2 py-3 shadow-sm"
      aria-label="Proposal sections"
      data-builder-document-section-nav
    >
      <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Proposal
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
        <div className="mt-2 border-t border-slate-100 px-1 pt-2">
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
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
        isActive
          ? "bg-blue-50 font-semibold text-blue-900"
          : disabled
            ? "cursor-not-allowed text-slate-400"
            : "font-medium text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="min-w-0 truncate">{item.label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {item.fromDb && item.customerVisible === false ? (
          <EyeOff className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        ) : null}
        {isActive ? (
          <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Active
          </span>
        ) : null}
      </span>
    </button>
  );
}
