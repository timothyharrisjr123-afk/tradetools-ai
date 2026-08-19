"use client";

import { formatProductionStartedAt } from "@/app/lib/jobProductionTypes";
import { formatScheduleWindowLabel } from "@/app/lib/jobScheduleMapper";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";
import type { CanonicalJobStage } from "@/app/lib/jobLifecycleTypes";

type JobCardScheduleSectionProps = {
  canSchedule: boolean;
  stage: CanonicalJobStage;
  schedule: JobSchedule | null;
  productionStartedAt?: string | null;
  displayTimezone?: string | null;
  depositNotReceived?: boolean;
  startBusy?: boolean;
  startError?: string | null;
  onStartWork?: () => void;
  onSchedule: () => void;
  onReschedule: () => void;
  onUnschedule: () => void;
};

export default function JobCardScheduleSection({
  canSchedule,
  stage,
  schedule,
  productionStartedAt,
  displayTimezone,
  depositNotReceived = false,
  startBusy = false,
  startError = null,
  onStartWork,
  onSchedule,
  onReschedule,
  onUnschedule,
}: JobCardScheduleSectionProps) {
  const active = schedule?.status === "scheduled" ? schedule : null;
  const isProduction = stage === "production";
  const hasActualStart = isProduction || stage === "complete";
  const isReadOnly = isProduction || stage === "complete";
  const canStart = stage === "scheduled" && Boolean(active) && Boolean(onStartWork);
  const startedLabel = formatProductionStartedAt(
    productionStartedAt,
    active?.timezone ?? displayTimezone
  );

  return (
    <div
      className="mt-4 rounded-lg border border-slate-200/80 bg-white p-4"
      data-jobcard-schedule
      data-production-stage={stage}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isProduction
              ? "Production"
              : stage === "complete"
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
              {active ? (
                <p className="mt-1.5 text-xs text-slate-500">
                  Planned · {formatScheduleWindowLabel(active)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-sm font-medium text-slate-800">
              {active ? formatScheduleWindowLabel(active) : "Not scheduled"}
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
          {active && !isReadOnly ? (
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
          ) : !active && canSchedule && !isReadOnly ? (
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
        <p className="mt-2 text-xs text-amber-700">Deposit not received</p>
      ) : null}
      {startError ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {startError}
        </p>
      ) : null}
    </div>
  );
}
