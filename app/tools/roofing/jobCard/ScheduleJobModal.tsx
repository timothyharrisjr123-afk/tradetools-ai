"use client";

import { useEffect, useRef } from "react";
import {
  buildScheduleTimezoneSettingsHref,
  type CompanyTimezoneLoadStatus,
} from "@/app/lib/jobScheduleMapper";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";
import type {
  ScheduleContextStatus,
  ScheduleOccupancyWindow,
} from "@/app/lib/jobScheduleWorkspace";
import JobScheduleWorkspace, {
  type JobScheduleWorkspaceSubmit,
} from "./JobScheduleWorkspace";

export type ScheduleModalMode = "schedule" | "reschedule" | "unschedule";

type ScheduleJobModalProps = {
  open: boolean;
  mode: ScheduleModalMode;
  timezone: string | null;
  timezoneLoadStatus?: CompanyTimezoneLoadStatus;
  schedule?: JobSchedule | null;
  prefillStartsOn?: string | null;
  prefillEndsOn?: string | null;
  timezoneReturnPath?: string | null;
  timezoneReturnJobId?: string | null;
  depositNotReceived?: boolean;
  busy?: boolean;
  error?: string | null;
  contextWindows?: ScheduleOccupancyWindow[] | null;
  contextStatus?: ScheduleContextStatus | null;
  onClose: () => void;
  onSubmitSchedule: (input: JobScheduleWorkspaceSubmit) => void;
  onConfirmUnschedule: () => void;
};

export default function ScheduleJobModal(props: ScheduleJobModalProps) {
  if (!props.open) return null;
  const formKey = [
    props.mode,
    props.schedule?.id ?? "new",
    props.schedule?.row_version ?? 0,
    props.prefillStartsOn ?? "",
    props.prefillEndsOn ?? "",
  ].join(":");
  return <ScheduleJobModalSheet key={formKey} {...props} />;
}

function ScheduleJobModalSheet({
  mode,
  timezone,
  timezoneLoadStatus = "ready",
  schedule,
  prefillStartsOn,
  prefillEndsOn,
  timezoneReturnPath,
  timezoneReturnJobId,
  depositNotReceived = false,
  busy = false,
  error = null,
  contextWindows = null,
  contextStatus = null,
  onClose,
  onSubmitSchedule,
  onConfirmUnschedule,
}: ScheduleJobModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const hasResumeWindow = Boolean(
    prefillStartsOn || schedule?.starts_on
  );
  const timezoneSettingsHref =
    timezoneReturnPath && timezoneReturnJobId && hasResumeWindow
      ? buildScheduleTimezoneSettingsHref(timezoneReturnPath, {
          jobId: timezoneReturnJobId,
          startsOn: prefillStartsOn || schedule?.starts_on || "",
          endsOn:
            prefillEndsOn ||
            schedule?.ends_on ||
            prefillStartsOn ||
            schedule?.starts_on ||
            "",
        })
      : "/tools/settings#company-timezone";

  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = panelRef.current;
    const focusTarget =
      panel?.querySelector<HTMLElement>("button, input, textarea, a") ?? panel;
    focusTarget?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus();
    };
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-job-title"
      data-schedule-job-modal
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <JobScheduleWorkspace
          variant="dialog"
          mode={mode}
          timezone={timezone}
          timezoneLoadStatus={timezoneLoadStatus}
          schedule={schedule}
          prefillStartsOn={prefillStartsOn}
          prefillEndsOn={prefillEndsOn}
          timezoneSettingsHref={timezoneSettingsHref}
          depositNotReceived={depositNotReceived}
          busy={busy}
          error={error}
          contextWindows={contextWindows}
          contextStatus={contextStatus}
          enableContextRead={contextWindows == null}
          canSchedule
          canReschedule
          canUnschedule={mode !== "schedule"}
          onClose={onClose}
          onSubmitSchedule={onSubmitSchedule}
          onConfirmUnschedule={onConfirmUnschedule}
        />
      </div>
    </div>
  );
}
