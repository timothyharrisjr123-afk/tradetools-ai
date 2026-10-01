"use client";

import { useId, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import {
  recentActivitySummary,
  type RecentActivityStatus,
} from "@/app/lib/jobCardOverviewPresentation";
import type { JobCardActivityItem } from "./JobCardActivityPanel";
import { OVERVIEW_CARD, OVERVIEW_ICON_QUIET, OVERVIEW_TEXT_ACTION } from "./jobCardOverviewStyles";

function metaLine(item: JobCardActivityItem): string | null {
  const when = item.dayLabel && item.timeLabel ? `${item.dayLabel} · ${item.timeLabel}` : item.when ?? item.timeLabel ?? null;
  const parts = [when, item.actor].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The Overview's quiet, collapsed view of the job's latest Activity. The Activity
 * destination stays the complete history; this never adds a second timeline.
 */
export default function JobCardOverviewRecentActivity({
  items,
  status,
  onOpenActivity,
}: {
  items: readonly JobCardActivityItem[];
  status: RecentActivityStatus;
  onOpenActivity?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const summary = recentActivitySummary(items, status);
  const canExpand = summary.items.length > 0;
  const expanded = open && canExpand;

  return (
    <section
      className={OVERVIEW_CARD}
      data-jobcard-overview-recent-activity
      data-state={expanded ? "open" : "closed"}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <span className={OVERVIEW_ICON_QUIET} aria-hidden>
          <Clock className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900">Recent activity</h3>
          <p className="text-sm text-slate-500" data-jobcard-overview-recent-count>
            {summary.countLabel}
          </p>
        </div>
        {canExpand ? (
          <button
            type="button"
            className={OVERVIEW_TEXT_ACTION}
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            data-jobcard-overview-recent-toggle
          >
            {expanded ? "Hide" : "Show"}
            <ChevronDown
              className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        ) : status === "error" && onOpenActivity ? (
          <button
            type="button"
            className={OVERVIEW_TEXT_ACTION}
            onClick={onOpenActivity}
            data-jobcard-overview-activity-open
          >
            Open Activity
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div id={listId} className="border-t border-slate-100 px-5 pb-4 pt-4" data-jobcard-overview-recent-list>
          <ol className="relative ml-[1.1rem] border-l border-slate-200 pl-6">
            {summary.items.map((item, index) => {
              const meta = metaLine(item);
              return (
                <li key={`${item.kind ?? item.label}-${item.when ?? ""}-${index}`} className="relative pb-4 last:pb-1">
                  <span
                    className={`absolute -left-[1.85rem] top-1.5 h-2 w-2 rounded-full ring-4 ring-white ${
                      index === 0 ? "bg-blue-500" : "bg-slate-300"
                    }`}
                    aria-hidden
                  />
                  <p className="text-sm font-medium leading-snug text-slate-900 [overflow-wrap:anywhere]">
                    {item.label}
                  </p>
                  {item.note ? (
                    <p className="mt-0.5 text-[13px] leading-snug text-slate-600 [overflow-wrap:anywhere]">
                      {item.note}
                    </p>
                  ) : null}
                  {meta ? <p className="mt-0.5 text-xs leading-snug text-slate-400">{meta}</p> : null}
                </li>
              );
            })}
          </ol>
          {onOpenActivity ? (
            <button
              type="button"
              className={`${OVERVIEW_TEXT_ACTION} mt-1`}
              onClick={onOpenActivity}
              data-jobcard-overview-activity-open
            >
              See all activity
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
