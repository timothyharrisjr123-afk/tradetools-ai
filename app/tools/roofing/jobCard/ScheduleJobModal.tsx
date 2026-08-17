"use client";

import { useMemo, useState } from "react";
import {
  COMPANY_TIMEZONE_CTA,
  COMPANY_TIMEZONE_REQUIRED_COPY,
  JOB_SCHEDULE_NOTES_MAX_LENGTH,
  SCHEDULE_DEPOSIT_NOT_RECEIVED,
  type JobSchedule,
} from "@/app/lib/jobScheduleTypes";
import {
  buildScheduleTimezoneSettingsHref,
  todayCivilIso,
} from "@/app/lib/jobScheduleMapper";

export type ScheduleModalMode = "schedule" | "reschedule" | "unschedule";

type ScheduleJobModalProps = {
  open: boolean;
  mode: ScheduleModalMode;
  timezone: string | null;
  schedule?: JobSchedule | null;
  prefillStartsOn?: string | null;
  prefillEndsOn?: string | null;
  timezoneReturnPath?: string | null;
  timezoneReturnJobId?: string | null;
  depositNotReceived?: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmitSchedule: (input: {
    startsOn: string;
    endsOn: string;
    allDay: boolean;
    startLocalTime: string | null;
    endLocalTime: string | null;
    notes: string | null;
  }) => void;
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
  return <ScheduleJobModalForm key={formKey} {...props} />;
}

function ScheduleJobModalForm({
  mode,
  timezone,
  schedule,
  prefillStartsOn,
  prefillEndsOn,
  timezoneReturnPath,
  timezoneReturnJobId,
  depositNotReceived = false,
  busy = false,
  error = null,
  onClose,
  onSubmitSchedule,
  onConfirmUnschedule,
}: ScheduleJobModalProps) {
  const defaultStart = prefillStartsOn || schedule?.starts_on || todayCivilIso();
  const [startsOn, setStartsOn] = useState(defaultStart);
  const [endsOn, setEndsOn] = useState(
    prefillEndsOn || schedule?.ends_on || defaultStart
  );
  const [allDay, setAllDay] = useState(schedule ? schedule.all_day : true);
  const [startLocalTime, setStartLocalTime] = useState(
    schedule?.start_local_time?.slice(0, 5) ?? "08:00"
  );
  const [endLocalTime, setEndLocalTime] = useState(
    schedule?.end_local_time?.slice(0, 5) ?? "16:00"
  );
  const [notes, setNotes] = useState(schedule?.notes ?? "");

  const title = useMemo(() => {
    if (mode === "reschedule") return "Reschedule job";
    if (mode === "unschedule") return "Unschedule job";
    return "Schedule job";
  }, [mode]);
  const timezoneSettingsHref =
    timezoneReturnPath && timezoneReturnJobId
      ? buildScheduleTimezoneSettingsHref(timezoneReturnPath, {
          jobId: timezoneReturnJobId,
          startsOn,
          endsOn: endsOn || startsOn,
        })
      : "/tools/settings#company-timezone";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-job-title"
      data-schedule-job-modal
    >
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 id="schedule-job-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>

        {!timezone ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">{COMPANY_TIMEZONE_REQUIRED_COPY}</p>
            <a
              href={timezoneSettingsHref}
              className="inline-flex text-sm font-semibold text-cyan-700 hover:text-cyan-900"
            >
              {COMPANY_TIMEZONE_CTA}
            </a>
          </div>
        ) : mode === "unschedule" ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">
              Remove this job from the calendar? It will return to Approved.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">Timezone: {timezone}</p>
            {depositNotReceived ? (
              <p className="text-xs text-slate-500">{SCHEDULE_DEPOSIT_NOT_RECEIVED}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-slate-600">
                Start date
                <input
                  type="date"
                  value={startsOn}
                  onChange={(e) => {
                    setStartsOn(e.target.value);
                    if (endsOn < e.target.value) setEndsOn(e.target.value);
                  }}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                End date
                <input
                  type="date"
                  value={endsOn}
                  min={startsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              All day
            </label>
            {!allDay ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-slate-600">
                  Start time
                  <input
                    type="time"
                    value={startLocalTime}
                    onChange={(e) => setStartLocalTime(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  End time
                  <input
                    type="time"
                    value={endLocalTime}
                    onChange={(e) => setEndLocalTime(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
            ) : (
              <button
                type="button"
                className="text-sm font-medium text-cyan-700 hover:text-cyan-900"
                onClick={() => setAllDay(false)}
              >
                Add times
              </button>
            )}
            <label className="block text-xs font-medium text-slate-600">
              Notes
              <textarea
                value={notes}
                maxLength={JOB_SCHEDULE_NOTES_MAX_LENGTH}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Gate code, dumpster timing…"
                className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            disabled={busy}
          >
            Cancel
          </button>
          {timezone && mode === "unschedule" ? (
            <button
              type="button"
              disabled={busy}
              onClick={onConfirmUnschedule}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Unschedule
            </button>
          ) : timezone ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onSubmitSchedule({
                  startsOn,
                  endsOn: endsOn || startsOn,
                  allDay,
                  startLocalTime: allDay ? null : `${startLocalTime}:00`,
                  endLocalTime: allDay ? null : `${endLocalTime}:00`,
                  notes: notes.trim() || null,
                })
              }
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
            >
              {mode === "reschedule" ? "Save schedule" : "Schedule job"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
