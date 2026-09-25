"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import {
  JOB_CARD_VISIBLE_TABS,
  type JobCardTabId,
} from "./jobCardTypes";
import { scrollJobCardTabIntoRailView } from "./jobCardTabRailScroll";
import {
  JOB_CARD_MOBILE_PRIMARY_NAV,
  resolveJobCardMobileRailSelection,
  type JobCardMoreDestinationId,
} from "./jobCardMobileNav";
import JobCardMoreSheet from "./JobCardMoreSheet";

type JobCardTabsProps = {
  activeTab: JobCardTabId;
  onTabChange: (tab: JobCardTabId) => void;
  /** When true, mobile More treats Activity as the current destination. */
  mobileActivityFocused?: boolean;
  onMobileActivityFocus?: () => void;
  onClearMobileActivityFocus?: () => void;
};

export default function JobCardTabs({
  activeTab,
  onTabChange,
  mobileActivityFocused = false,
  onMobileActivityFocus,
  onClearMobileActivityFocus,
}: JobCardTabsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const mobileSelection = resolveJobCardMobileRailSelection(
    activeTab,
    mobileActivityFocused
  );

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

  const focusDesktopTab = (tabId: JobCardTabId) => {
    onClearMobileActivityFocus?.();
    onTabChange(tabId);
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`job-card-tab-${tabId}`);
      el?.focus();
      if (el) bringTabIntoView(el);
    });
  };

  const onDesktopKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next =
      JOB_CARD_VISIBLE_TABS[
        (index + delta + JOB_CARD_VISIBLE_TABS.length) %
          JOB_CARD_VISIBLE_TABS.length
      ];
    focusDesktopTab(next.id);
  };

  const onTabFocus = (event: FocusEvent<HTMLButtonElement>) => {
    bringTabIntoView(event.currentTarget);
  };

  const selectMobilePrimary = (tabId: JobCardTabId) => {
    onClearMobileActivityFocus?.();
    setMoreOpen(false);
    onTabChange(tabId);
  };

  const activeMoreDestination: JobCardMoreDestinationId | null =
    mobileActivityFocused
      ? "activity"
      : mobileSelection === "more"
        ? (activeTab as JobCardMoreDestinationId)
        : null;

  const onMoreSelect = (destination: JobCardMoreDestinationId) => {
    setMoreOpen(false);
    if (destination === "activity") {
      onMobileActivityFocus?.();
      return;
    }
    onClearMobileActivityFocus?.();
    onTabChange(destination);
  };

  return (
    <>
      {/* Desktop — full domain tab set (≥1200) */}
      <div className="hidden min-w-0 max-w-full items-end border-b border-slate-200/80 bg-white min-[1200px]:flex">
      <div
        className="min-w-0 flex-1"
        role="tablist"
        aria-label="Job card sections"
        data-jobcard-tabs
        data-jobcard-tabs-mode="desktop"
      >
        <div
          ref={scrollerRef}
          className="-mb-px flex min-w-0 max-w-full touch-pan-x gap-0 overflow-x-auto overscroll-x-contain px-5 sm:px-6 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/60"
        >
          {JOB_CARD_VISIBLE_TABS.map((tab, index) => {
            const isActive = tab.id === activeTab && !mobileActivityFocused;
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
                onClick={() => {
                  onClearMobileActivityFocus?.();
                  onTabChange(tab.id);
                }}
                onFocus={onTabFocus}
                onKeyDown={(event) => onDesktopKeyDown(event, index)}
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
        <button
          type="button"
          aria-pressed={mobileActivityFocused}
          data-jobcard-activity-destination-toggle
          onClick={() =>
            mobileActivityFocused
              ? onClearMobileActivityFocus?.()
              : onMobileActivityFocus?.()
          }
          className={`-mb-px mr-5 min-h-11 shrink-0 border-b-2 px-3.5 py-3 text-[13px] font-medium transition sm:mr-6 ${
            mobileActivityFocused
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          Activity
        </button>
      </div>

      {/* Mobile — Overview | Tasks | Photos | More (<1200) */}
      <div
        className="min-w-0 max-w-full border-b border-slate-200/80 bg-white min-[1200px]:hidden"
        role="tablist"
        aria-label="Job card sections"
        data-jobcard-tabs
        data-jobcard-tabs-mode="mobile"
      >
        <div className="grid grid-cols-4 gap-0 px-1">
          {JOB_CARD_MOBILE_PRIMARY_NAV.map((tab) => {
            const isActive = mobileSelection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`job-card-panel-${tab.id}`}
                id={`job-card-tab-mobile-${tab.id}`}
                data-jobcard-tab={tab.id}
                data-jobcard-mobile-primary={tab.id}
                onClick={() => selectMobilePrimary(tab.id)}
                className={`flex min-h-12 flex-col items-center justify-center border-b-2 px-1 text-[12px] font-semibold transition ${
                  isActive
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            aria-selected={mobileSelection === "more"}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            data-jobcard-tab="more"
            data-jobcard-mobile-more
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-12 flex-col items-center justify-center border-b-2 px-1 text-[12px] font-semibold transition ${
              mobileSelection === "more"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500"
            }`}
          >
            More
          </button>
        </div>
      </div>

      <JobCardMoreSheet
        open={moreOpen}
        activeDestination={activeMoreDestination}
        onClose={() => setMoreOpen(false)}
        onSelect={onMoreSelect}
      />
    </>
  );
}

export type { JobCardTabId };
