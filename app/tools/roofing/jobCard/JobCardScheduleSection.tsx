"use client";

import { formatJobCompletedAt } from "@/app/lib/jobCompleteTypes";
import { formatProductionStartedAt } from "@/app/lib/jobProductionTypes";
import { formatScheduleWindowLabel } from "@/app/lib/jobScheduleMapper";
import {
  SCHEDULE_DEPOSIT_NOT_RECEIVED,
  type JobSchedule,
} from "@/app/lib/jobScheduleTypes";
import type { CanonicalJobStage } from "@/app/lib/jobLifecycleTypes";

type JobCardScheduleSectionProps = {
  canSchedule: boolean;
  stage: CanonicalJobStage;
  schedule: JobSchedule | null;
  productionStartedAt?: string | null;
  completedAt?: string | null;
  displayTimezone?: string | null;
  depositNotReceived?: boolean;
  startBusy?: boolean;
  startError?: string | null;
  completeBusy?: boolean;
  completeError?: string | null;
  scheduleReady?: boolean;
  onStartWork?: () => void;
  onCompleteJob?: () => void;
  onSchedule: () => void;
  onReschedule: () => void;
  onUnschedule: () => void;
};

export default function JobCardScheduleSection({
  canSchedule,
  stage,
  schedule,
  productionStartedAt,
  completedAt,
  displayTimezone,
  depositNotReceived = false,
  startBusy = false,
  startError = null,
  completeBusy = false,
  completeError = null,
  scheduleReady = true,
  onStartWork,
  onCompleteJob,
  onSchedule,
  onReschedule,
  onUnschedule,
}: JobCardScheduleSectionProps) {
  const planned =
    schedule?.kind === "work" && schedule.status === "scheduled"
      ? schedule
      : null;
  const isProduction = stage === "production";
  const isComplete = stage === "complete";
  const hasActualStart = isProduction || isComplete;
  const isReadOnly = isProduction || isComplete;
  const canStart =
    stage === "scheduled" && Boolean(planned) && Boolean(onStartWork);
  const canComplete =
    isProduction && Boolean(planned) && Boolean(onCompleteJob);
  const showNotScheduled = scheduleReady && !planned && !hasActualStart;
  const timezone = planned?.timezone ?? displayTimezone;
  const startedLabel = formatProductionStartedAt(productionStartedAt, timezone);
  const completedLabel = formatJobCompletedAt(completedAt, timezone);

  return (
    <div
      className="mt-4 rounded-lg border border-slate-200/80 bg-white p-4"
      data-jobcard-schedule
      data-production-stage={stage}
      data-jobcard-schedule-ready={scheduleReady ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isProduction
              ? "Production"
              : isComplete
                ? "Work history"
                : "Schedule"}
          </h3>
          {hasActualStart ? (
            <>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Work started
              </p>
              <p className="text-xs text-slate-600">
                {startedLabel ?? "Start time unavailable"}
              </p>
              {isComplete ? (
                <>
                  <p
                    className="mt-1.5 text-sm font-semibold text-slate-900"
                    data-jobcard-work-completed
                  >
                    Work completed
                  </p>
                  <p className="text-xs text-slate-600">
                    {completedLabel ?? "Completion time unavailable"}
                  </p>
                </>
              ) : null}
              {planned ? (
                <p className="mt-1.5 text-xs text-slate-500">
                  Planned schedule · {formatScheduleWindowLabel(planned)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-sm font-medium text-slate-800">
              {planned
                ? formatScheduleWindowLabel(planned)
                : showNotScheduled
                  ? "Not scheduled"
                  : "Loading schedule"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {canStart ? (
            <button
              type="button"
              onClick={onStartWork}
              disabled={startBusy}
              className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
              data-jobcard-start-work
            >
              {startBusy ? "Starting…" : "Start work"}
            </button>
          ) : null}
          {canComplete ? (
            <button
              type="button"
              onClick={onCompleteJob}
              disabled={completeBusy}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              data-jobcard-complete-job
            >
              {completeBusy ? "Completing…" : "Complete job"}
            </button>
          ) : null}
          {planned && !isReadOnly ? (
            <>
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
            </>
          ) : !planned && canSchedule && !isReadOnly ? (
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
      {depositNotReceived && stage === "scheduled" ? (
        <p className="mt-2 text-xs text-amber-700">{SCHEDULE_DEPOSIT_NOT_RECEIVED}</p>
      ) : null}
      {startError ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {startError}
        </p>
      ) : null}
      {completeError ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {completeError}
        </p>
      ) : null}
    </div>
  );
}
