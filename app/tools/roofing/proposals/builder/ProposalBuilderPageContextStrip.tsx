"use client";

import type { ReactNode } from "react";
import { FileText, Layers, Plus } from "lucide-react";
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

export default function ProposalBuilderPageContextStrip({
  pages,
  activePageContextId,
  onSelectPageContext,
  persistedProposalDocument = false,
}: ProposalBuilderPageContextStripProps) {
  const { items, overflowPages } = buildPageContextStripItems(pages, {
    persistedProposalDocument,
  });

  const cover = items.find((item) => item.id === "cover");
  const estimate = items.find((item) => item.id === "estimate");
  const addPage = items.find((item) => item.id === "add_page");
  const pageSlots = items.filter((item) => item.kind === "page" || item.kind === "placeholder");

  const overflowCount = overflowPages.length;

  return (
    <nav className={BUILDER_PAGE_STRIP} aria-label="Proposal pages">
      {cover ? (
        <StripButton item={cover} isActive={activePageContextId === cover.id} onSelect={onSelectPageContext} />
      ) : null}

      {estimate ? (
        <StripButton
          item={estimate}
          isActive={activePageContextId === estimate.id}
          onSelect={onSelectPageContext}
          icon={
            <FileText
              className={`h-4 w-4 shrink-0 ${
                activePageContextId === estimate.id ? "text-blue-700" : "text-slate-500"
              }`}
              aria-hidden
            />
          }
        />
      ) : null}

      <span className={BUILDER_PAGE_STRIP_DIVIDER} aria-hidden />
      <span
        className="inline-flex shrink-0 items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
        title="Customer-facing proposal pages"
      >
        <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        Pages
        {overflowCount > 0 ? (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            +{overflowCount}
          </span>
        ) : null}
      </span>

      {pageSlots.map((item) => (
        <StripButton
          key={item.id}
          item={item}
          isActive={activePageContextId === item.id}
          onSelect={onSelectPageContext}
        />
      ))}

      {addPage ? (
        <>
          <span className={BUILDER_PAGE_STRIP_DIVIDER} aria-hidden />
          <StripButton
            item={addPage}
            isActive={activePageContextId === addPage.id}
            onSelect={onSelectPageContext}
            futureAction
            icon={<Plus className="h-4 w-4 shrink-0" aria-hidden />}
          />
        </>
      ) : null}
    </nav>
  );
}
