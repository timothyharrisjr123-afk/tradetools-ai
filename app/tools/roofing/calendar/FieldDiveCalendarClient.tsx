"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FieldDiveAppShell from "@/app/tools/roofing/FieldDiveAppShell";
import ScheduleJobModal, {
  type ScheduleModalMode,
} from "@/app/tools/roofing/jobCard/ScheduleJobModal";
import {
  addDaysIso,
  calendarCivilRangeUtc,
  companyTimezoneForScheduling,
  formatScheduleWindowLabel,
  parseCompanyTimezoneGetResult,
  parseScheduleResumeContext,
  resolveCompanyTimezoneCanonicalStatus,
  resolveCompanyTimezoneReadState,
  startOfMonthIso,
  startOfWeekMondayIso,
  stripScheduleResumeParams,
  todayCivilIso,
  type CompanyTimezoneLoadStatus,
} from "@/app/lib/jobScheduleMapper";
import type {
  CalendarScheduleEvent,
  JobSchedule,
  ScheduleCandidateJob,
} from "@/app/lib/jobScheduleTypes";
import { buildDbJobCardHref } from "@/app/lib/jobBoardAdapter";
import { useRouter } from "next/navigation";

type CalendarView = "month" | "week";

/** Max events shown per month-grid day before "+N more" overflow affordance. */
export const MONTH_DAY_EVENT_CAP = 3;

function monthCells(year: number, monthIndex: number): string[] {
  const first = startOfMonthIso(year, monthIndex);
  const gridStart = startOfWeekMondayIso(first);
  return Array.from({ length: 42 }, (_, i) => addDaysIso(gridStart, i));
}

function eventOverlapsDay(event: CalendarScheduleEvent, isoDate: string): boolean {
  return event.schedule.starts_on <= isoDate && event.schedule.ends_on >= isoDate;
}

function scheduleErrorCopy(code: string): string {
  if (code === "company_timezone_required") return "Set company timezone to schedule work.";
  if (code === "schedule_stale") return "This schedule changed in another session. Current schedule reloaded.";
  if (code === "disposition_blocks_schedule") return "This job cannot be scheduled while on hold or closed.";
  if (code === "already_scheduled") return "This job already has an active schedule.";
  if (code === "invalid_window") return "Choose a valid date or time window.";
  return "Could not save the schedule.";
}

export default function FieldDiveCalendarClient({
  companyId,
  initialTimezone,
}: {
  companyId: string;
  initialTimezone: string | null;
}) {
  void companyId;
  const router = useRouter();
  const [view, setView] = useState<CalendarView>("month");
  const [anchorIso, setAnchorIso] = useState(() =>
    todayCivilIso(initialTimezone)
  );
  const cursor = useMemo(() => {
    const [year, month] = anchorIso.split("-").map(Number);
    return { year, month: month - 1 };
  }, [anchorIso]);
  const [events, setEvents] = useState<CalendarScheduleEvent[]>([]);
  const [timezone, setTimezone] = useState<string | null>(initialTimezone);
  const [timezoneLoadStatus, setTimezoneLoadStatus] =
    useState<CompanyTimezoneLoadStatus>(
      initialTimezone ? "ready" : "loading"
    );
  const [candidates, setCandidates] = useState<ScheduleCandidateJob[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    mode: ScheduleModalMode;
    jobId: string;
    schedule: JobSchedule | null;
    startsOn?: string;
    endsOn?: string;
    depositNotReceived?: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthOverflow, setMonthOverflow] = useState<{
    iso: string;
    events: CalendarScheduleEvent[];
  } | null>(null);

  const visibleDays = useMemo(() => {
    if (view === "week") {
      const weekStart = startOfWeekMondayIso(anchorIso);
      return Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
    }
    return monthCells(cursor.year, cursor.month);
  }, [anchorIso, cursor.month, cursor.year, view]);

  const firstVisibleOn = visibleDays[0];
  const afterLastVisibleOn = addDaysIso(
    visibleDays[visibleDays.length - 1],
    1
  );

  const load = useCallback(async () => {
    setTimezoneLoadStatus("loading");
    const tzRes = await fetch("/api/company/timezone", { cache: "no-store" });
    const tzJson = await tzRes.json().catch(() => null);
    const parsed = parseCompanyTimezoneGetResult(tzRes.ok, tzJson);
    if (parsed.status === "error") {
      setTimezoneLoadStatus("error");
      // Do not treat failed GET as confirmed-null / unset.
      setEvents([]);
      return;
    }
    setTimezoneLoadStatus("ready");
    setTimezone(parsed.timezone);
    const canonicalTimezone = parsed.timezone;
    if (!canonicalTimezone) {
      setEvents([]);
      return;
    }
    const range = calendarCivilRangeUtc({
      firstVisibleOn,
      afterLastVisibleOn,
      timezone: canonicalTimezone,
    });
    const eventsRes = await fetch(
      `/api/jobs/schedules?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      { cache: "no-store" }
    );
    const eventsJson = await eventsRes.json().catch(() => null);
    setEvents(Array.isArray(eventsJson?.events) ? eventsJson.events : []);
  }, [afterLastVisibleOn, firstVisibleOn]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- visible-range calendar read */
    void load();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

  useEffect(() => {
    const tzReady = companyTimezoneForScheduling(
      resolveCompanyTimezoneReadState({
        loadStatus: timezoneLoadStatus,
        savedTimezone: timezone,
      })
    );
    if (!tzReady) return;
    const resume = parseScheduleResumeContext(window.location.search);
    if (!resume) return;
    void fetch("/api/jobs/schedules?candidates=1", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const rows: ScheduleCandidateJob[] = Array.isArray(json?.candidates)
          ? json.candidates
          : [];
        const candidate = rows.find((row) => row.jobId === resume.jobId);
        setAnchorIso(resume.startsOn);
        setModal({
          mode: "schedule",
          jobId: resume.jobId,
          schedule: null,
          startsOn: resume.startsOn,
          endsOn: resume.endsOn,
          depositNotReceived: candidate?.depositDue === true,
        });
        window.history.replaceState(
          {},
          "",
          stripScheduleResumeParams(
            `${window.location.pathname}${window.location.search}${window.location.hash}`
          )
        );
      })
      .catch(() => undefined);
  }, [timezone, timezoneLoadStatus]);

  async function openCreate(isoDate: string) {
    setPickerDate(isoDate);
    setError(null);
    const res = await fetch("/api/jobs/schedules?candidates=1", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setCandidates(Array.isArray(json?.candidates) ? json.candidates : []);
    setPickerOpen(true);
  }

  async function submitSchedule(input: {
    startsOn: string;
    endsOn: string;
    allDay: boolean;
    startLocalTime: string | null;
    endLocalTime: string | null;
    notes: string | null;
  }) {
    if (!modal) return;
    setBusy(true);
    setError(null);
    const path = modal.mode === "reschedule" ? "/api/jobs/reschedule" : "/api/jobs/schedule";
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: modal.jobId,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        allDay: input.allDay,
        startLocalTime: input.startLocalTime,
        endLocalTime: input.endLocalTime,
        notes: input.notes,
        expectedRowVersion: modal.schedule?.row_version,
      }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!json?.ok) {
      if (json?.code === "company_timezone_required") {
        setTimezoneLoadStatus("ready");
        setTimezone(null);
      }
      if (json?.code === "schedule_stale") {
        const currentRes = await fetch(
          `/api/jobs/schedules?jobId=${encodeURIComponent(modal.jobId)}`,
          { cache: "no-store" }
        );
        const currentJson = await currentRes.json().catch(() => null);
        const current = Array.isArray(currentJson?.schedules)
          ? currentJson.schedules.find(
              (row: JobSchedule) => row.status === "scheduled"
            )
          : null;
        if (current) {
          setModal((previous) =>
            previous
              ? { ...previous, mode: "reschedule", schedule: current }
              : previous
          );
        }
        await load();
      }
      setError(scheduleErrorCopy(String(json?.code ?? "")));
      return;
    }
    setModal(null);
    await load();
  }

  async function confirmUnschedule() {
    if (!modal?.schedule) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/jobs/unschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: modal.jobId,
        expectedRowVersion: modal.schedule.row_version,
      }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!json?.ok) {
      setError(scheduleErrorCopy(String(json?.code ?? "")));
      return;
    }
    setModal(null);
    await load();
  }

  const openScheduleEvent = (event: CalendarScheduleEvent) => {
    if (event.stage === "production" || event.stage === "complete") {
      router.push(buildDbJobCardHref(event.jobId));
      return;
    }
    setModal({
      mode: "reschedule",
      jobId: event.jobId,
      schedule: event.schedule,
    });
  };

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <FieldDiveAppShell activeNav="calendar">
      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6" data-fielddive-calendar>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Calendar</h1>
            <p className="text-sm text-slate-500">{monthLabel}</p>
            {(() => {
              const status = resolveCompanyTimezoneCanonicalStatus({
                loadStatus: timezoneLoadStatus,
                savedTimezone: timezone,
              });
              if (status.kind === "loading") {
                return (
                  <p className="mt-1 text-xs text-slate-500" data-timezone-loading>
                    {status.text}
                  </p>
                );
              }
              if (status.kind === "error") {
                return (
                  <p className="mt-1 text-xs text-amber-700" data-timezone-error>
                    {status.text}
                  </p>
                );
              }
              if (status.kind === "not_set") {
                return (
                  <p className="mt-1 text-xs text-slate-500" data-timezone-not-set>
                    {status.text}
                  </p>
                );
              }
              return null;
            })()}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "month" ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
              onClick={() => setView("month")}
            >
              Month
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "week" ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
              onClick={() => setView("week")}
            >
              Week
            </button>
            <button
              type="button"
              className="rounded-md bg-white px-3 py-1.5 text-sm ring-1 ring-slate-200"
              onClick={() =>
                setAnchorIso((cur) =>
                  view === "week"
                    ? addDaysIso(startOfWeekMondayIso(cur), -7)
                    : addDaysIso(startOfMonthIso(cursor.year, cursor.month), -1)
                )
              }
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-md bg-white px-3 py-1.5 text-sm ring-1 ring-slate-200"
              onClick={() => {
                if (view === "week") {
                  setAnchorIso((cur) => addDaysIso(startOfWeekMondayIso(cur), 7));
                  return;
                }
                setAnchorIso(addDaysIso(startOfMonthIso(cursor.year, cursor.month), 32).slice(0, 8) + "01");
              }}
            >
              Next
            </button>
          </div>
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white sm:block">
          <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="px-2 py-2">
                {day}
              </div>
            ))}
          </div>
          <div className={`grid grid-cols-7 ${view === "month" ? "auto-rows-[7.5rem]" : "auto-rows-[9rem]"}`}>
            {visibleDays.map((iso) => {
              const inMonth = Number(iso.slice(5, 7)) === cursor.month + 1;
              const dayEvents = events.filter((event) => eventOverlapsDay(event, iso));
              const visibleEvents = dayEvents.slice(0, MONTH_DAY_EVENT_CAP);
              const overflowCount = dayEvents.length - visibleEvents.length;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => void openCreate(iso)}
                  className={`relative min-w-0 overflow-hidden border-b border-r border-slate-100 p-1.5 text-left ${inMonth ? "bg-white" : "bg-slate-50/70"}`}
                >
                  <div className="text-xs font-medium text-slate-500">{iso.slice(8)}</div>
                  <div className="mt-1 space-y-1 overflow-hidden">
                    {visibleEvents.map((event) => (
                      <div
                        key={event.schedule.id}
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          openScheduleEvent(event);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            openScheduleEvent(event);
                          }
                        }}
                        className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          event.stage === "production"
                            ? "bg-emerald-50 text-emerald-900"
                            : event.stage === "complete"
                              ? "bg-slate-100 text-slate-800"
                            : "bg-sky-50 text-sky-900"
                        }`}
                        data-calendar-event-stage={event.stage}
                      >
                        {event.customerName}
                        {event.stage === "production"
                          ? " · Production"
                          : event.stage === "complete"
                            ? " · Complete"
                            : ""}
                      </div>
                    ))}
                    {overflowCount > 0 ? (
                      <button
                        type="button"
                        className="w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold text-cyan-800 hover:bg-cyan-50"
                        aria-label={`${overflowCount} more scheduled jobs on this day`}
                        data-calendar-day-overflow-count={overflowCount}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMonthOverflow({
                            iso,
                            events: dayEvents.slice(MONTH_DAY_EVENT_CAP),
                          });
                        }}
                      >
                        +{overflowCount} more
                      </button>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 sm:hidden" data-calendar-mobile-agenda>
          {visibleDays
            .filter((iso) => view === "week" || Number(iso.slice(5, 7)) === cursor.month + 1)
            .map((iso) => {
              const dayEvents = events.filter((event) => eventOverlapsDay(event, iso));
              return (
                <section key={iso} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-800">{iso}</h2>
                    <button
                      type="button"
                      className="text-sm font-semibold text-cyan-700"
                      onClick={() => void openCreate(iso)}
                    >
                      Schedule
                    </button>
                  </div>
                  {dayEvents.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No scheduled work</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {dayEvents.map((event) => (
                        <li key={event.schedule.id}>
                          <button
                            type="button"
                            className={`w-full rounded-md px-2 py-2 text-left ${
                              event.stage === "production"
                                ? "bg-emerald-50"
                                : event.stage === "complete"
                                  ? "bg-slate-100"
                                : "bg-slate-50"
                            }`}
                            onClick={() => openScheduleEvent(event)}
                            data-calendar-event-stage={event.stage}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-800">{event.customerName}</p>
                              {event.stage === "production" ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                  Production
                                </span>
                              ) : event.stage === "complete" ? (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                  Complete
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-500">
                              {formatScheduleWindowLabel(event.schedule)}
                            </p>
                            {event.address ? (
                              <p className="text-xs text-slate-500">{event.address}</p>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
        </div>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Schedule a job</h2>
            <p className="mt-1 text-sm text-slate-500">Approved jobs without an active schedule</p>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {candidates.length === 0 ? (
                <p className="text-sm text-slate-500">No Approved jobs are ready to schedule.</p>
              ) : (
                candidates.map((job) => (
                  <button
                    key={job.jobId}
                    type="button"
                    onClick={() => {
                      setSelectedJobId(job.jobId);
                      setPickerOpen(false);
                      setModal({
                        mode: "schedule",
                        jobId: job.jobId,
                        schedule: null,
                        startsOn: pickerDate ?? undefined,
                        depositNotReceived: job.depositDue,
                      });
                    }}
                    className={`w-full rounded-md border px-3 py-2 text-left ${selectedJobId === job.jobId ? "border-cyan-300 bg-cyan-50" : "border-slate-200"}`}
                  >
                    <p className="text-sm font-medium text-slate-800">{job.customerName}</p>
                    {job.address ? <p className="text-xs text-slate-500">{job.address}</p> : null}
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="text-sm text-slate-600" onClick={() => setPickerOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {monthOverflow ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-label={`Additional events on ${monthOverflow.iso}`}
          data-calendar-month-overflow
        >
          <div className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">
                {monthOverflow.iso}
              </h2>
              <button
                type="button"
                className="text-sm font-semibold text-slate-600"
                onClick={() => setMonthOverflow(null)}
              >
                Close
              </button>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto p-3">
              {monthOverflow.events.map((event) => (
                <button
                  key={event.schedule.id}
                  type="button"
                  className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => {
                    setMonthOverflow(null);
                    openScheduleEvent(event);
                  }}
                >
                  <span className="text-sm font-medium text-slate-800">
                    {event.customerName}
                  </span>
                  {event.stage === "production"
                    ? " · Production"
                    : event.stage === "complete"
                      ? " · Complete"
                      : ""}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <ScheduleJobModal
        open={modal != null}
        mode={modal?.mode ?? "schedule"}
        timezone={companyTimezoneForScheduling(
          resolveCompanyTimezoneReadState({
            loadStatus: timezoneLoadStatus,
            savedTimezone: timezone,
          })
        )}
        timezoneLoadStatus={timezoneLoadStatus}
        schedule={modal?.schedule ?? null}
        prefillStartsOn={modal?.startsOn ?? null}
        prefillEndsOn={modal?.endsOn ?? null}
        timezoneReturnPath="/tools/roofing/calendar"
        timezoneReturnJobId={modal?.jobId ?? null}
        depositNotReceived={modal?.depositNotReceived === true}
        busy={busy}
        error={error}
        onClose={() => {
          setModal(null);
          setError(null);
        }}
        onSubmitSchedule={(input) => void submitSchedule(input)}
        onConfirmUnschedule={() => void confirmUnschedule()}
      />

      {modal?.schedule ? (
        <div className="pointer-events-none fixed bottom-4 right-4 hidden rounded-md bg-white/90 px-3 py-2 text-xs text-slate-500 shadow sm:block">
          <button
            type="button"
            className="pointer-events-auto font-semibold text-cyan-700"
            onClick={() => router.push(buildDbJobCardHref(modal.jobId))}
          >
            Open Job Card
          </button>
        </div>
      ) : null}
    </FieldDiveAppShell>
  );
}
