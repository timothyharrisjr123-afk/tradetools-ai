"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, EyeOff } from "lucide-react";
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

/** Compact page switcher attached to the proposal document surface. */
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
  const activeItem =
    sectionItems.find((item) => item.id === activePageContextId) ??
    overflowPages.find((item) => item.id === activePageContextId) ??
    sectionItems[0] ??
    null;

  return (
    <nav
      className="border-b border-slate-200/80 bg-white"
      aria-label="Proposal sections"
      data-builder-document-section-nav
      data-builder-section-bar="top"
    >
      <div className="sm:hidden" data-builder-page-switcher-compact>
        <CompactPageMenu
          sectionItems={sectionItems}
          overflowPages={overflowPages}
          activeItem={activeItem}
          activePageContextId={activePageContextId}
          onSelectPageContext={onSelectPageContext}
        />
      </div>
      <div
        className="hidden items-stretch gap-0.5 px-2 pt-0.5 sm:flex sm:overflow-x-auto sm:px-4 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/70"
        role="tablist"
        aria-label="Proposal pages"
      >
        {sectionItems.map((item) => (
          <SectionTabButton
            key={item.id}
            item={item}
            isActive={item.id === activePageContextId}
            onSelect={onSelectPageContext}
          />
        ))}
        {overflowPages.length > 0 ? (
          <div className="flex shrink-0 items-center px-0.5 pb-0.5">
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

function CompactPageMenu({
  sectionItems,
  overflowPages,
  activeItem,
  activePageContextId,
  onSelectPageContext,
}: {
  sectionItems: PageStripItem[];
  overflowPages: PageStripItem[];
  activeItem: PageStripItem | null;
  activePageContextId: BuilderPageContextId;
  onSelectPageContext: (id: BuilderPageContextId) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const allItems = [...sectionItems, ...overflowPages];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative px-3 py-1.5">
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md px-1 text-left text-[14px] font-semibold text-slate-900"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        data-builder-page-switcher-trigger
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{activeItem?.label ?? "Page"}</span>
          {activeItem?.fromDb && activeItem.customerVisible === false ? (
            <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          id={menuId}
          role="listbox"
          className="absolute inset-x-3 z-20 mt-1 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          data-builder-page-switcher-menu
        >
          {allItems.map((item) => {
            const selected = item.id === activePageContextId;
            return (
              <li key={item.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={!item.enabled}
                  className={`flex min-h-[44px] w-full items-center justify-between gap-2 px-3 text-left text-[14px] ${
                    selected
                      ? "font-semibold text-slate-950"
                      : item.enabled
                        ? "text-slate-700"
                        : "cursor-not-allowed text-slate-400"
                  }`}
                  onClick={() => {
                    if (!item.enabled) return;
                    onSelectPageContext(item.id);
                    setOpen(false);
                  }}
                >
                  <span>{item.label}</span>
                  {item.fromDb && item.customerVisible === false ? (
                    <EyeOff className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
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
      className={`relative inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-2 px-3 text-[13px] font-medium transition ${
        isActive
          ? "border-blue-600 font-semibold text-slate-950"
          : disabled
            ? "cursor-not-allowed border-transparent text-slate-400"
            : "border-transparent text-slate-600 hover:text-slate-900"
      }`}
    >
      <span className="whitespace-nowrap">{item.label}</span>
      {item.fromDb && item.customerVisible === false ? (
        <EyeOff className="h-3.5 w-3.5 text-slate-400" aria-hidden />
      ) : null}
    </button>
  );
}
