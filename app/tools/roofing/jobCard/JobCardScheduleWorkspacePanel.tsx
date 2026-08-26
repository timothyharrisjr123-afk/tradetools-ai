"use client";

import type { CanonicalJobStage } from "@/app/lib/jobLifecycleTypes";
import type { CompanyTimezoneLoadStatus } from "@/app/lib/jobScheduleMapper";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";
import JobScheduleWorkspace, {
  type JobScheduleWorkspaceSubmit,
} from "./JobScheduleWorkspace";

type JobCardScheduleWorkspacePanelProps = {
  stage: CanonicalJobStage;
  scheduleReady: boolean;
  timezone: string | null;
  timezoneLoadStatus: CompanyTimezoneLoadStatus;
  activeSchedule: JobSchedule | null;
  cancelledRows: readonly JobSchedule[];
  canSchedule: boolean;
  canReschedule: boolean;
  canUnschedule: boolean;
  busy?: boolean;
  error?: string | null;
  depositNotReceived?: boolean;
  timezoneSettingsHref?: string;
  onSubmitSchedule: (input: JobScheduleWorkspaceSubmit) => void;
  onConfirmUnschedule: () => void;
};

export default function JobCardScheduleWorkspacePanel({
  stage,
  scheduleReady,
  timezone,
  timezoneLoadStatus,
  activeSchedule,
  cancelledRows,
  canSchedule,
  canReschedule,
  canUnschedule,
  busy = false,
  error = null,
  depositNotReceived = false,
  timezoneSettingsHref,
  onSubmitSchedule,
  onConfirmUnschedule,
}: JobCardScheduleWorkspacePanelProps) {
  const readOnly = stage === "production" || stage === "complete";
  const mode = activeSchedule ? "reschedule" : "schedule";

  if (!scheduleReady && !activeSchedule) {
    return (
      <p className="text-sm text-slate-500" data-jobcard-schedule-workspace>
        Loading schedule
      </p>
    );
  }

  return (
    <JobScheduleWorkspace
      variant="embedded"
      mode={mode}
      timezone={timezone}
      timezoneLoadStatus={timezoneLoadStatus}
      schedule={activeSchedule}
      enableContextRead={scheduleReady}
      readOnly={readOnly}
      cancelledRows={cancelledRows}
      canSchedule={canSchedule}
      canReschedule={canReschedule}
      canUnschedule={canUnschedule}
      busy={busy}
      error={error}
      depositNotReceived={depositNotReceived}
      timezoneSettingsHref={timezoneSettingsHref}
      onSubmitSchedule={onSubmitSchedule}
      onConfirmUnschedule={onConfirmUnschedule}
    />
  );
}
