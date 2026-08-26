"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calendarCivilRangeUtc,
  resolveCompanyTimezoneCanonicalStatus,
  type CompanyTimezoneLoadStatus,
} from "@/app/lib/jobScheduleMapper";
import {
  COMPANY_TIMEZONE_CTA,
  COMPANY_TIMEZONE_REQUIRED_COPY,
  JOB_SCHEDULE_CALENDAR_HREF,
  JOB_SCHEDULE_NOTES_MAX_LENGTH,
  SCHEDULE_DEPOSIT_NOT_RECEIVED,
  type JobSchedule,
} from "@/app/lib/jobScheduleTypes";
import {
  loadScheduleRangeOccupancy,
  monthGridDays,
  monthVisibleCivilRange,
  nextScheduleDateSelection,
  resolveScheduleWorkspaceDates,
  SCHEDULE_CONTEXT_ERROR_COPY,
  scheduledJobCountByDay,
  scheduleRangeCacheKey,
  scheduleWorkspaceHasCompleteWindow,
  type ScheduleContextStatus,
  type ScheduleOccupancyWindow,
  type ScheduleWorkspaceMode,
} from "@/app/lib/jobScheduleWorkspace";
import JobScheduleMonthGrid from "./JobScheduleMonthGrid";
import { formatScheduleWindowLabel } from "@/app/lib/jobScheduleMapper";

export type JobScheduleWorkspaceSubmit = {
  startsOn: string;
  endsOn: string;
  allDay: boolean;
  startLocalTime: string | null;
  endLocalTime: string | null;
  notes: string | null;
};

type JobScheduleWorkspaceProps = {
  variant: "dialog" | "embedded";
  mode: ScheduleWorkspaceMode;
  timezone: string | null;
  timezoneLoadStatus?: CompanyTimezoneLoadStatus;
  schedule?: JobSchedule | null;
  prefillStartsOn?: string | null;
  prefillEndsOn?: string | null;
  timezoneSettingsHref?: string;
  depositNotReceived?: boolean;
  busy?: boolean;
  error?: string | null;
  readOnly?: boolean;
  cancelledRows?: readonly JobSchedule[];
  contextWindows?: ScheduleOccupancyWindow[] | null;
  contextStatus?: ScheduleContextStatus | null;
  enableContextRead?: boolean;
  canSchedule?: boolean;
  canReschedule?: boolean;
  canUnschedule?: boolean;
  onClose?: () => void;
  onSubmitSchedule: (input: JobScheduleWorkspaceSubmit) => void;
  onConfirmUnschedule: () => void;
};

export default function JobScheduleWorkspace({
  variant,
  mode,
  timezone,
  timezoneLoadStatus = "ready",
  schedule,
  prefillStartsOn,
  prefillEndsOn,
  timezoneSettingsHref = "/tools/settings#company-timezone",
  depositNotReceived = false,
  busy = false,
  error = null,
  readOnly = false,
  cancelledRows = [],
  contextWindows = null,
  contextStatus = null,
  enableContextRead = false,
  canSchedule = true,
  canReschedule = true,
  canUnschedule = true,
  onClose,
  onSubmitSchedule,
  onConfirmUnschedule,
}: JobScheduleWorkspaceProps) {
  const timezoneStatus = resolveCompanyTimezoneCanonicalStatus({
    loadStatus: timezoneLoadStatus,
    savedTimezone: timezone,
  });
  const defaults = resolveScheduleWorkspaceDates({
    mode,
    existingSchedule: schedule,
    prefillStartsOn,
    prefillEndsOn,
  });
  const [startsOn, setStartsOn] = useState(defaults.startsOn);
  const [endsOn, setEndsOn] = useState(defaults.endsOn);
  const [allDay, setAllDay] = useState(schedule ? schedule.all_day : true);
  const [startLocalTime, setStartLocalTime] = useState(
    schedule?.start_local_time?.slice(0, 5) ?? "08:00"
  );
  const [endLocalTime, setEndLocalTime] = useState(
    schedule?.end_local_time?.slice(0, 5) ?? "16:00"
  );
  const [notes, setNotes] = useState(schedule?.notes ?? "");
  const [unscheduleConfirm, setUnscheduleConfirm] = useState(mode === "unschedule");
  const initialCursor = defaults.startsOn || schedule?.starts_on || "";
  const [cursorIso, setCursorIso] = useState(() => {
    if (initialCursor.length >= 7) return `${initialCursor.slice(0, 7)}-01`;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [fetchedContext, setFetchedContext] = useState<{
    key: string;
    windows: ScheduleOccupancyWindow[];
    status: ScheduleContextStatus;
  } | null>(null);

  const cursor = useMemo(() => {
    const [year, month] = cursorIso.split("-").map(Number);
    return { year, monthIndex: month - 1 };
  }, [cursorIso]);

  const days = useMemo(
    () => monthGridDays(cursor.year, cursor.monthIndex),
    [cursor.year, cursor.monthIndex]
  );
  const civilRange = useMemo(
    () => monthVisibleCivilRange(cursor.year, cursor.monthIndex),
    [cursor.year, cursor.monthIndex]
  );
  const utcRange = useMemo(() => {
    if (timezoneStatus.kind !== "saved" || !timezone) return null;
    return calendarCivilRangeUtc({
      firstVisibleOn: civilRange.firstVisibleOn,
      afterLastVisibleOn: civilRange.afterLastVisibleOn,
      timezone,
    });
  }, [
    timezone,
    timezoneStatus.kind,
    civilRange.firstVisibleOn,
    civilRange.afterLastVisibleOn,
  ]);

  const parentProvided = contextWindows != null && contextStatus != null;
  const fetchEnabled = !parentProvided && enableContextRead && utcRange != null;
  const fetchKey = utcRange
    ? scheduleRangeCacheKey(utcRange.from, utcRange.to)
    : "";
  const fetchedMatches = Boolean(
    fetchedContext && fetchedContext.key === fetchKey
  );
  const loadedStatus: ScheduleContextStatus = !enableContextRead
    ? "idle"
    : timezoneStatus.kind === "loading"
      ? "loading"
      : timezoneStatus.kind !== "saved" || !timezone
        ? "blocked"
        : fetchedMatches && fetchedContext
          ? fetchedContext.status
          : "loading";
  const effectiveStatus: ScheduleContextStatus = parentProvided
    ? contextStatus
    : loadedStatus;
  const effectiveWindows = useMemo(() => {
    if (parentProvided) return contextWindows ?? [];
    if (fetchedMatches && fetchedContext) return fetchedContext.windows;
    return [];
  }, [parentProvided, contextWindows, fetchedMatches, fetchedContext]);

  useEffect(() => {
    if (!fetchEnabled || !utcRange) return;
    let cancelled = false;
    const key = scheduleRangeCacheKey(utcRange.from, utcRange.to);
    void loadScheduleRangeOccupancy({
      fromIso: utcRange.from,
      toIso: utcRange.to,
    }).then((result) => {
      if (cancelled) return;
      setFetchedContext({
        key,
        windows: result.windows,
        status: result.status,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchEnabled, utcRange]);

  const counts = useMemo(
    () => scheduledJobCountByDay(effectiveWindows, days),
    [effectiveWindows, days]
  );

  const monthLabel = new Date(cursor.year, cursor.monthIndex, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );
  const selectionComplete = scheduleWorkspaceHasCompleteWindow({
    startsOn,
    endsOn,
  });
  const interactive =
    !readOnly &&
    timezoneStatus.kind === "saved" &&
    (mode === "schedule" ? canSchedule : canReschedule) &&
    !unscheduleConfirm;
  const thisJobStarts = schedule?.starts_on ?? "";
  const thisJobEnds = schedule?.ends_on ?? "";
  const showScheduleForm =
    !readOnly &&
    timezoneStatus.kind === "saved" &&
    !unscheduleConfirm &&
    (mode === "schedule" || mode === "reschedule");

  const title =
    mode === "unschedule" || unscheduleConfirm
      ? "Unschedule job"
      : mode === "reschedule"
        ? "Reschedule job"
        : "Schedule job";

  function shiftMonth(delta: number) {
    const next = new Date(cursor.year, cursor.monthIndex + delta, 1);
    setCursorIso(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`
    );
  }

  return (
    <div
      className={variant === "embedded" ? "space-y-4" : "space-y-4"}
      data-schedule-workspace
      data-schedule-workspace-mode={unscheduleConfirm ? "unschedule" : mode}
      data-schedule-workspace-variant={variant}
      data-schedule-context-status={effectiveStatus}
    >
      {variant === "dialog" ? (
        <h2 id="schedule-job-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>
      ) : null}

      {timezoneStatus.kind === "loading" ? (
        <p className="text-sm text-slate-600" data-timezone-loading>
          {timezoneStatus.text}
        </p>
      ) : timezoneStatus.kind === "error" ? (
        <p className="text-sm text-slate-600" data-timezone-error>
          {timezoneStatus.text}
        </p>
      ) : timezoneStatus.kind === "not_set" ? (
        <div className="space-y-2" data-timezone-not-set>
          <p className="text-sm text-slate-600">{COMPANY_TIMEZONE_REQUIRED_COPY}</p>
          <a
            href={timezoneSettingsHref}
            className="inline-flex text-sm font-semibold text-cyan-700 hover:text-cyan-900"
          >
            {COMPANY_TIMEZONE_CTA}
          </a>
        </div>
      ) : (
        <>
          {timezone ? (
            <p className="text-xs text-slate-500">Timezone: {timezone}</p>
          ) : null}
          {depositNotReceived ? (
            <p className="text-xs text-slate-500">{SCHEDULE_DEPOSIT_NOT_RECEIVED}</p>
          ) : null}
          {schedule ? (
            <p className="text-sm font-medium text-slate-800">
              Planned · {formatScheduleWindowLabel(schedule)}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => shiftMonth(-1)}
            >
              Previous
            </button>
            <p className="text-sm font-semibold text-slate-800">{monthLabel}</p>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => shiftMonth(1)}
            >
              Next
            </button>
          </div>

          <JobScheduleMonthGrid
            days={days}
            monthIndex={cursor.monthIndex}
            counts={counts}
            selectedStartsOn={startsOn}
            selectedEndsOn={endsOn}
            thisJobStartsOn={thisJobStarts}
            thisJobEndsOn={thisJobEnds}
            contextStatus={effectiveStatus}
            interactive={interactive}
            onSelectDay={(iso) => {
              const next = nextScheduleDateSelection({ startsOn, endsOn }, iso);
              setStartsOn(next.startsOn);
              setEndsOn(next.endsOn);
            }}
          />

          {effectiveStatus === "error" ? (
            <p
              className="text-xs text-amber-800"
              role="status"
              data-schedule-context-error
            >
              {SCHEDULE_CONTEXT_ERROR_COPY}
            </p>
          ) : effectiveStatus === "loading" ? (
            <p className="text-xs text-slate-500">Loading scheduled work…</p>
          ) : null}

          {unscheduleConfirm ? (
            <p className="text-sm text-slate-600">
              Remove this job from the calendar? It will return to Approved.
            </p>
          ) : showScheduleForm ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-slate-600">
                  Start date
                  <input
                    type="date"
                    value={startsOn}
                    onChange={(event) => {
                      const value = event.target.value;
                      setStartsOn(value);
                      if (!endsOn || endsOn < value) setEndsOn(value);
                    }}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  End date
                  <input
                    type="date"
                    value={endsOn}
                    min={startsOn || undefined}
                    onChange={(event) => setEndsOn(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(event) => setAllDay(event.target.checked)}
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
                      onChange={(event) => setStartLocalTime(event.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    End time
                    <input
                      type="time"
                      value={endLocalTime}
                      onChange={(event) => setEndLocalTime(event.target.value)}
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
            </div>
          ) : null}
        </>
      )}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {busy ? (
        <p className="sr-only" role="status" aria-live="polite">
          Saving schedule
        </p>
      ) : null}

      {!readOnly && timezoneStatus.kind === "saved" ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {variant === "dialog" && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              disabled={busy}
            >
              Cancel
            </button>
          ) : null}
          {schedule && canUnschedule && !unscheduleConfirm ? (
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              disabled={busy}
              onClick={() => setUnscheduleConfirm(true)}
              data-schedule-unschedule
            >
              Unschedule
            </button>
          ) : null}
          {unscheduleConfirm ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setUnscheduleConfirm(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                data-schedule-unschedule-keep
              >
                Keep scheduled
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onConfirmUnschedule}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                data-schedule-unschedule-confirm
                aria-busy={busy}
              >
                {busy ? "Unscheduling…" : "Unschedule"}
              </button>
            </>
          ) : showScheduleForm ? (
            <button
              type="button"
              disabled={busy || !selectionComplete}
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
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              data-schedule-submit
              aria-busy={busy}
            >
              {busy
                ? "Saving…"
                : mode === "reschedule"
                  ? "Save schedule"
                  : "Schedule job"}
            </button>
          ) : null}
        </div>
      ) : variant === "dialog" && onClose ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {showScheduleForm ? (
        <label className="block text-xs font-medium text-slate-600">
          Notes
          <textarea
            value={notes}
            maxLength={JOB_SCHEDULE_NOTES_MAX_LENGTH}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Gate code, dumpster timing…"
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
      ) : null}

      {cancelledRows.length > 0 ? (
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">
            Cancelled history
          </summary>
          <ul className="mt-2 space-y-1">
            {cancelledRows.map((row) => (
              <li key={row.id}>Cancelled · {formatScheduleWindowLabel(row)}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {variant === "embedded" ? (
        <a
          href={JOB_SCHEDULE_CALENDAR_HREF}
          className="inline-flex text-xs font-medium text-slate-500 hover:text-slate-800"
          data-view-company-calendar
        >
          View company Calendar
        </a>
      ) : null}
    </div>
  );
}
