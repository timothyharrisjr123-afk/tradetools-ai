"use client";

import type { ReactNode } from "react";
import { EyeOff, FileText, Plus } from "lucide-react";
import {
  buildPageContextStripItems,
  type BuilderPageContextId,
  type PageStripItem,
} from "@/app/lib/proposalBuilderNavigation";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";
import {
  builderPageStripStatusChip,
  BUILDER_PAGE_STRIP,
  BUILDER_PAGE_STRIP_SCROLL,
  BUILDER_PAGE_STRIP_DIVIDER,
  BUILDER_PAGE_STRIP_ITEM,
  BUILDER_PAGE_STRIP_ITEM_ACTIVE,
  BUILDER_PAGE_STRIP_ITEM_DISABLED,
  BUILDER_PAGE_STRIP_ITEM_FUTURE,
  BUILDER_PAGE_STRIP_ITEM_IDLE,
  BUILDER_PAGE_STRIP_HIDDEN_INDICATOR,
} from "./proposalBuilderConstants";
import ProposalBuilderOverflowMenu from "./ProposalBuilderOverflowMenu";

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
      {item.fromDb && item.customerVisible === false ? (
        <EyeOff
          className={`h-3.5 w-3.5 ${BUILDER_PAGE_STRIP_HIDDEN_INDICATOR}`}
          aria-label="Hidden from customer"
        />
      ) : null}
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
  const primaryItems = visibleItems.filter((item) => item.id !== "add_page");
  const addPageItem = visibleItems.find((item) => item.id === "add_page");
  const hasOverflow = overflowPages.length > 0;

  return (
    <nav className={BUILDER_PAGE_STRIP} aria-label="Proposal pages">
      <div className={BUILDER_PAGE_STRIP_SCROLL}>
        {primaryItems.map((item) => {
          const isActive = activePageContextId === item.id;

          return (
            <StripButton
              key={item.id}
              item={item}
              isActive={isActive}
              onSelect={onSelectPageContext}
              icon={stripItemIcon(item, isActive)}
            />
          );
        })}
      </div>

      {hasOverflow ? (
        <>
          <span className={BUILDER_PAGE_STRIP_DIVIDER} aria-hidden />
          <ProposalBuilderOverflowMenu
            overflowPages={overflowPages}
            activePageContextId={activePageContextId}
            onSelectPageContext={onSelectPageContext}
          />
        </>
      ) : null}

      {addPageItem ? (
        <>
          <span className={BUILDER_PAGE_STRIP_DIVIDER} aria-hidden />
          <StripButton
            item={addPageItem}
            isActive={activePageContextId === addPageItem.id}
            onSelect={onSelectPageContext}
            icon={stripItemIcon(addPageItem, activePageContextId === addPageItem.id)}
            futureAction
          />
        </>
      ) : null}
    </nav>
  );
}
