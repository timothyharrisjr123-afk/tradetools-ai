"use client";

import { formatScheduleWindowLabel } from "@/app/lib/jobScheduleMapper";
import { JOB_SCHEDULE_CALENDAR_HREF, type JobSchedule } from "@/app/lib/jobScheduleTypes";

type JobCardScheduleTimelineProps = {
  rows: readonly JobSchedule[];
  onReschedule?: () => void;
};

export default function JobCardScheduleTimeline({
  rows,
  onReschedule,
}: JobCardScheduleTimelineProps) {
  const active = rows.find((row) => row.status === "scheduled") ?? null;
  const cancelled = rows.filter((row) => row.status === "cancelled");

  return (
    <div className="space-y-4" data-jobcard-schedule-timeline>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Active work schedule
        </h3>
        {active ? (
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-800">
              {formatScheduleWindowLabel(active)}
            </p>
            {onReschedule ? (
              <button
                type="button"
                onClick={onReschedule}
                className="text-sm font-semibold text-cyan-700 hover:text-cyan-900"
              >
                Reschedule
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No active work schedule.</p>
        )}
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Schedule history
        </h3>
        {cancelled.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No cancelled schedules.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {cancelled.map((row) => (
              <li key={row.id} className="text-sm text-slate-600">
                Cancelled · {formatScheduleWindowLabel(row)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <a
        href={JOB_SCHEDULE_CALENDAR_HREF}
        className="inline-flex text-sm font-semibold text-cyan-700 hover:text-cyan-900"
      >
        Open company Calendar
      </a>
    </div>
  );
}
