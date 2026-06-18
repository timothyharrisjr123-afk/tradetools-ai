"use client";

import type { ReactNode } from "react";
import { FileText, Plus } from "lucide-react";
import {
  buildPageContextStripItems,
  type BuilderPageContextId,
  type PageStripItem,
} from "@/app/lib/proposalBuilderNavigation";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";
import {
  builderPageStripStatusChip,
  BUILDER_PAGE_STRIP,
  BUILDER_PAGE_STRIP_DIVIDER,
  BUILDER_PAGE_STRIP_ITEM,
  BUILDER_PAGE_STRIP_ITEM_ACTIVE,
  BUILDER_PAGE_STRIP_ITEM_DISABLED,
  BUILDER_PAGE_STRIP_ITEM_FUTURE,
  BUILDER_PAGE_STRIP_ITEM_IDLE,
} from "./proposalBuilderConstants";

type ProposalBuilderPageContextStripProps = {
  pages: ProposalPageRow[] | null | undefined;
  activePageContextId: BuilderPageContextId;
  onSelectPageContext: (id: BuilderPageContextId) => void;
  persistedProposalDocument?: boolean;
};

function StripButton({
  item,
  isActive,
  onSelect,
  icon,
  futureAction = false,
}: {
  item: PageStripItem;
  isActive: boolean;
  onSelect: (id: BuilderPageContextId) => void;
  icon?: ReactNode;
  futureAction?: boolean;
}) {
  const isDisabled = !item.enabled;
  const chip = builderPageStripStatusChip(item.status, isActive);

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-current={isActive ? "page" : undefined}
      onClick={() => item.enabled && onSelect(item.id)}
      className={`${BUILDER_PAGE_STRIP_ITEM} ${
        isActive
          ? BUILDER_PAGE_STRIP_ITEM_ACTIVE
          : isDisabled && futureAction
            ? BUILDER_PAGE_STRIP_ITEM_FUTURE
            : isDisabled
              ? BUILDER_PAGE_STRIP_ITEM_DISABLED
              : BUILDER_PAGE_STRIP_ITEM_IDLE
      }`}
    >
      {icon}
      {item.label}
      {chip ? <span className={chip.className}>{chip.label}</span> : null}
    </button>
  );
}

function stripItemIcon(item: PageStripItem, isActive: boolean): ReactNode | undefined {
  if (item.id === "estimate") {
    return (
      <FileText
        className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-700" : "text-slate-500"}`}
        aria-hidden
      />
    );
  }
  if (item.id === "add_page") {
    return <Plus className="h-4 w-4 shrink-0" aria-hidden />;
  }
  return undefined;
}

export default function ProposalBuilderPageContextStrip({
  pages,
  activePageContextId,
  onSelectPageContext,
  persistedProposalDocument = false,
}: ProposalBuilderPageContextStripProps) {
  const { items, overflowPages } = buildPageContextStripItems(pages, {
    persistedProposalDocument,
  });

  const visibleItems = items.filter((item) => item.id !== "preview");
  const overflowCount = overflowPages.length;

  return (
    <nav className={BUILDER_PAGE_STRIP} aria-label="Proposal pages">
      {visibleItems.map((item, index) => {
        const isActive = activePageContextId === item.id;
        const showDividerBeforeAddPage =
          item.id === "add_page" && index > 0 && visibleItems[index - 1]?.id !== "add_page";

        return (
          <span key={item.id} className="contents">
            {showDividerBeforeAddPage ? (
              <span className={BUILDER_PAGE_STRIP_DIVIDER} aria-hidden />
            ) : null}
            <StripButton
              item={item}
              isActive={isActive}
              onSelect={onSelectPageContext}
              icon={stripItemIcon(item, isActive)}
              futureAction={item.id === "add_page"}
            />
          </span>
        );
      })}

      {overflowCount > 0 ? (
        <span
          className="ml-1 inline-flex shrink-0 items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
          title={`${overflowCount} additional page${overflowCount === 1 ? "" : "s"} not shown in strip`}
        >
          +{overflowCount}
        </span>
      ) : null}
    </nav>
  );
}
