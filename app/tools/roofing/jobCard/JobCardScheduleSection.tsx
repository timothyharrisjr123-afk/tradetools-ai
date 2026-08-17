"use client";

import { formatScheduleWindowLabel } from "@/app/lib/jobScheduleMapper";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";

type JobCardScheduleSectionProps = {
  canSchedule: boolean;
  schedule: JobSchedule | null;
  onSchedule: () => void;
  onReschedule: () => void;
  onUnschedule: () => void;
};

export default function JobCardScheduleSection({
  canSchedule,
  schedule,
  onSchedule,
  onReschedule,
  onUnschedule,
}: JobCardScheduleSectionProps) {
  const active = schedule?.status === "scheduled" ? schedule : null;

  return (
    <div
      className="mt-4 rounded-lg border border-slate-200/80 bg-white p-4"
      data-jobcard-schedule
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Schedule
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {active ? formatScheduleWindowLabel(active) : "Not scheduled"}
          </p>
        </div>
        {active ? (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onReschedule}
              className="text-sm font-semibold text-cyan-700 hover:text-cyan-900"
            >
              Reschedule
            </button>
            <button
              type="button"
              onClick={onUnschedule}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Unschedule
            </button>
          </div>
        ) : canSchedule ? (
          <button
            type="button"
            onClick={onSchedule}
            className="text-sm font-semibold text-cyan-700 hover:text-cyan-900"
            data-jobcard-schedule-job
          >
            Schedule job
          </button>
        ) : null}
      </div>
    </div>
  );
}
