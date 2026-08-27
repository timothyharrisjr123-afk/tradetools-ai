"use client";

import type { ReactNode } from "react";
import type { JobCardTabId } from "./jobCardTypes";

type JobCardSectionPanelProps = {
  tabId: JobCardTabId;
  activeTab: JobCardTabId;
  title: string;
  subtitle?: string;
  statusChip?: { label: string; className: string };
  headerAction?: ReactNode;
  children: ReactNode;
};

export default function JobCardSectionPanel({
  tabId,
  activeTab,
  title,
  subtitle,
  statusChip,
  headerAction,
  children,
}: JobCardSectionPanelProps) {
  if (activeTab !== tabId) return null;

  const chipBase = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0";

  return (
    <section
      id={`job-card-panel-${tabId}`}
      className="flex min-h-full flex-col"
      role="tabpanel"
      aria-labelledby={`job-card-tab-${tabId}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {statusChip ? (
              <span className={`${chipBase} ${statusChip.className}`}>{statusChip.label}</span>
            ) : null}
          </div>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
