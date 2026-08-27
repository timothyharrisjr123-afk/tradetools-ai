"use client";

import { useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent } from "react";
import {
  JOB_CARD_VISIBLE_TABS,
  type JobCardTabId,
} from "./jobCardTypes";
import { scrollJobCardTabIntoRailView } from "./jobCardTabRailScroll";

type JobCardTabsProps = {
  activeTab: JobCardTabId;
  onTabChange: (tab: JobCardTabId) => void;
};

export default function JobCardTabs({ activeTab, onTabChange }: JobCardTabsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const run = () => {
      const scroller = scrollerRef.current;
      const tab = document.getElementById(`job-card-tab-${activeTab}`);
      if (scroller && tab) scrollJobCardTabIntoRailView(scroller, tab);
    };
    run();
    const frame = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  const bringTabIntoView = (tabEl: HTMLElement | null) => {
    const scroller = scrollerRef.current;
    if (!scroller || !tabEl) return;
    scrollJobCardTabIntoRailView(scroller, tabEl);
  };

  const focusTab = (tabId: JobCardTabId) => {
    onTabChange(tabId);
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`job-card-tab-${tabId}`);
      el?.focus();
      if (el) bringTabIntoView(el);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next =
      JOB_CARD_VISIBLE_TABS[
        (index + delta + JOB_CARD_VISIBLE_TABS.length) % JOB_CARD_VISIBLE_TABS.length
      ];
    focusTab(next.id);
  };

  const onTabFocus = (event: FocusEvent<HTMLButtonElement>) => {
    bringTabIntoView(event.currentTarget);
  };

  return (
    <div
      className="min-w-0 max-w-full border-b border-slate-200/80 bg-white"
      role="tablist"
      aria-label="Job card sections"
      data-jobcard-tabs
    >
      <div
        ref={scrollerRef}
        className="-mb-px flex min-w-0 max-w-full touch-pan-x gap-0 overflow-x-auto overscroll-x-contain px-5 sm:px-6 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/60"
      >
        {JOB_CARD_VISIBLE_TABS.map((tab, index) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`job-card-panel-${tab.id}`}
              id={`job-card-tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              data-jobcard-tab={tab.id}
              onClick={() => onTabChange(tab.id)}
              onFocus={onTabFocus}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`min-h-11 shrink-0 border-b-2 px-3.5 py-3 text-[13px] font-medium transition sm:px-4 ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { JobCardTabId };
