"use client";

import { formatScheduleWindowLabel } from "@/app/lib/jobScheduleMapper";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";

type JobCardScheduleTimelineProps = {
  rows: readonly JobSchedule[];
  scheduleReady?: boolean;
};

/** Compact cancelled-history only. Active schedule lives in the workspace. */
export default function JobCardScheduleTimeline({
  rows,
  scheduleReady = true,
}: JobCardScheduleTimelineProps) {
  const cancelled = rows.filter((row) => row.status === "cancelled");
  if (!scheduleReady) return null;
  if (cancelled.length === 0) return null;

  return (
    <div className="space-y-2" data-jobcard-schedule-timeline>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Cancelled history
      </h3>
      <ul className="space-y-1">
        {cancelled.map((row) => (
          <li key={row.id} className="text-sm text-slate-600">
            Cancelled · {formatScheduleWindowLabel(row)}
          </li>
        ))}
      </ul>
    </div>
  );
}
