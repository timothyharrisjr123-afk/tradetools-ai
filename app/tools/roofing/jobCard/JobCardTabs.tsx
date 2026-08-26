"use client";

import {
  JOB_CARD_VISIBLE_TABS,
  type JobCardTabId,
} from "./jobCardTypes";

type JobCardTabsProps = {
  activeTab: JobCardTabId;
  onTabChange: (tab: JobCardTabId) => void;
};

export default function JobCardTabs({ activeTab, onTabChange }: JobCardTabsProps) {
  return (
    <div
      className="min-w-0 max-w-full border-b border-slate-200/80 bg-white"
      role="tablist"
      aria-label="Job card sections"
      data-jobcard-tabs
    >
      <div className="-mb-px flex min-w-0 max-w-full touch-pan-x gap-0 overflow-x-auto overscroll-x-contain px-5 sm:px-6 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200/60">
        {JOB_CARD_VISIBLE_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              id={`job-card-tab-${tab.id}`}
              data-jobcard-tab={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`shrink-0 border-b-2 px-3.5 py-3 text-[13px] font-medium transition sm:px-4 ${
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
