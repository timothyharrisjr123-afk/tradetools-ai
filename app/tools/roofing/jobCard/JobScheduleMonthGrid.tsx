"use client";

import {
  civilDateInInclusiveRange,
  scheduleDayAriaLabel,
  scheduledCountLabel,
  type ScheduleContextStatus,
} from "@/app/lib/jobScheduleWorkspace";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type JobScheduleMonthGridProps = {
  days: readonly string[];
  monthIndex: number;
  counts: Record<string, number>;
  selectedStartsOn: string;
  selectedEndsOn: string;
  thisJobStartsOn?: string;
  thisJobEndsOn?: string;
  contextStatus: ScheduleContextStatus;
  interactive?: boolean;
  onSelectDay?: (iso: string) => void;
};

export default function JobScheduleMonthGrid({
  days,
  monthIndex,
  counts,
  selectedStartsOn,
  selectedEndsOn,
  thisJobStartsOn = "",
  thisJobEndsOn = "",
  contextStatus,
  interactive = true,
  onSelectDay,
}: JobScheduleMonthGridProps) {
  const showCounts = contextStatus === "ready";

  return (
    <div data-schedule-month-grid>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-1 py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((iso) => {
          const inMonth = Number(iso.slice(5, 7)) === monthIndex + 1;
          const count = showCounts ? counts[iso] ?? 0 : 0;
          const selected = civilDateInInclusiveRange(
            iso,
            selectedStartsOn,
            selectedEndsOn
          );
          const thisJob = civilDateInInclusiveRange(
            iso,
            thisJobStartsOn,
            thisJobEndsOn
          );
          const countLabel = scheduledCountLabel(count);
          const className = [
            "relative min-h-[2.15rem] border-b border-r border-slate-100 px-0.5 py-0.5 text-left sm:min-h-[2.35rem]",
            inMonth ? "bg-white" : "bg-slate-50/80 text-slate-400",
            selected ? "ring-1 ring-inset ring-cyan-600" : "",
            thisJob && !selected ? "bg-sky-50" : "",
            thisJob && selected ? "bg-sky-100" : "",
          ]
            .filter(Boolean)
            .join(" ");

          if (!interactive || !onSelectDay) {
            return (
              <div
                key={iso}
                className={className}
                role="group"
                aria-label={scheduleDayAriaLabel({
                  iso,
                  count,
                  selected,
                  thisJob,
                })}
                data-schedule-day={iso}
                data-schedule-day-count={showCounts ? String(count) : undefined}
                data-schedule-day-selected={selected ? "true" : undefined}
                data-schedule-day-this-job={thisJob ? "true" : undefined}
              >
                <div className="text-[11px] font-medium" aria-hidden="true">
                  {iso.slice(8)}
                </div>
                {countLabel ? (
                  <div
                    className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-700"
                    aria-hidden="true"
                  >
                    {count}
                  </div>
                ) : null}
              </div>
            );
          }

          return (
            <button
              key={iso}
              type="button"
              className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80`}
              aria-label={scheduleDayAriaLabel({
                iso,
                count,
                selected,
                thisJob,
              })}
              aria-pressed={selected}
              data-schedule-day={iso}
              data-schedule-day-count={showCounts ? String(count) : undefined}
              data-schedule-day-selected={selected ? "true" : undefined}
              data-schedule-day-this-job={thisJob ? "true" : undefined}
              onClick={() => onSelectDay(iso)}
            >
              <div className="text-[11px] font-medium" aria-hidden="true">
                {iso.slice(8)}
              </div>
              {countLabel ? (
                <div
                  className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-700"
                  aria-hidden="true"
                >
                  {count}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
