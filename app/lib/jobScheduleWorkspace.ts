/**
 * Shared job scheduling workspace — pure occupancy, selection, and copy.
 * Surfaces must not invent dates, capacity claims, or recommendations.
 */

import {
  addDaysIso,
  parseJobScheduleRow,
  startOfMonthIso,
  startOfWeekMondayIso,
} from "@/app/lib/jobScheduleMapper";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";

export const SCHEDULE_CONTEXT_ERROR_COPY =
  "Could not load other scheduled work.";

export const SCHEDULE_WORKSPACE_FORBIDDEN_COPY = [
  "recommended",
  "best date",
  "suggested date",
  "optimal",
  "overloaded",
  "light workload",
] as const;

export type ScheduleWorkspaceMode = "schedule" | "reschedule" | "unschedule";

export type ScheduleContextStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "blocked";

export type ScheduleOccupancyWindow = {
  jobId: string;
  startsOn: string;
  endsOn: string;
};

export type ScheduleDateSelection = {
  startsOn: string;
  endsOn: string;
};

export function monthGridDays(year: number, monthIndex: number): string[] {
  const first = startOfMonthIso(year, monthIndex);
  const gridStart = startOfWeekMondayIso(first);
  return Array.from({ length: 42 }, (_, i) => addDaysIso(gridStart, i));
}

export function monthVisibleCivilRange(
  year: number,
  monthIndex: number
): { firstVisibleOn: string; afterLastVisibleOn: string } {
  const days = monthGridDays(year, monthIndex);
  return {
    firstVisibleOn: days[0],
    afterLastVisibleOn: addDaysIso(days[days.length - 1], 1),
  };
}

export function civilDateInInclusiveRange(
  isoDate: string,
  startsOn: string,
  endsOn: string
): boolean {
  if (!isoDate || !startsOn || !endsOn) return false;
  return isoDate >= startsOn && isoDate <= endsOn;
}

export function occupancyWindowsFromUnknownEvents(
  events: unknown[]
): ScheduleOccupancyWindow[] {
  const windows: ScheduleOccupancyWindow[] = [];
  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const row = event as { jobId?: unknown; schedule?: unknown };
    const schedule = parseJobScheduleRow(row.schedule);
    if (!schedule || schedule.status !== "scheduled") continue;
    const jobId = String(row.jobId ?? schedule.job_id).trim();
    if (!jobId) continue;
    windows.push({
      jobId,
      startsOn: schedule.starts_on,
      endsOn: schedule.ends_on,
    });
  }
  return windows;
}

export function occupancyWindowsFromSchedules(
  rows: readonly JobSchedule[]
): ScheduleOccupancyWindow[] {
  return rows
    .filter((row) => row.kind === "work" && row.status === "scheduled")
    .map((row) => ({
      jobId: row.job_id,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
    }));
}

/** One bounded in-memory pass — never N+1 per cell. */
export function scheduledJobCountByDay(
  windows: readonly ScheduleOccupancyWindow[],
  days: readonly string[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const day of days) counts[day] = 0;
  for (const window of windows) {
    for (const day of days) {
      if (civilDateInInclusiveRange(day, window.startsOn, window.endsOn)) {
        counts[day] += 1;
      }
    }
  }
  return counts;
}

const CIVIL_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Visible occupancy: factual "1 job" / "N jobs". Empty when none. */
export function scheduledCountLabel(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "1 job";
  return `${count} jobs`;
}

/** Screen-reader occupancy: keeps "scheduled job(s)" and never omits date context. */
export function scheduledCountAccessibleLabel(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "1 scheduled job";
  return `${count} scheduled jobs`;
}

export function formatCivilDateAccessible(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  if (!match) return String(iso ?? "").trim();
  const month = CIVIL_MONTH_NAMES[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month || !Number.isFinite(day) || day < 1) return String(iso ?? "").trim();
  return `${month} ${day}`;
}

export function resolveScheduleWorkspaceDates(input: {
  mode: ScheduleWorkspaceMode;
  existingSchedule?: { starts_on: string; ends_on: string } | null;
  prefillStartsOn?: string | null;
  prefillEndsOn?: string | null;
}): ScheduleDateSelection {
  const existingStart = String(input.existingSchedule?.starts_on ?? "").trim();
  const existingEnd = String(input.existingSchedule?.ends_on ?? "").trim();
  const prefillStart = String(input.prefillStartsOn ?? "").trim();
  const prefillEnd = String(input.prefillEndsOn ?? "").trim();

  if (input.mode === "reschedule" || input.mode === "unschedule") {
    return {
      startsOn: existingStart || prefillStart,
      endsOn: existingEnd || prefillEnd || existingStart || prefillStart,
    };
  }

  // New schedule: never invent today. Only an explicit contractor pick (Calendar day).
  return {
    startsOn: prefillStart,
    endsOn: prefillEnd || prefillStart,
  };
}

export function nextScheduleDateSelection(
  current: ScheduleDateSelection,
  clickedIso: string
): ScheduleDateSelection {
  const clicked = String(clickedIso ?? "").trim();
  if (!clicked) return current;
  const start = String(current.startsOn ?? "").trim();
  const end = String(current.endsOn ?? "").trim();
  if (!start) {
    return { startsOn: clicked, endsOn: clicked };
  }
  if (start === end) {
    if (clicked < start) return { startsOn: clicked, endsOn: clicked };
    return { startsOn: start, endsOn: clicked };
  }
  return { startsOn: clicked, endsOn: clicked };
}

export function scheduleWorkspaceHasCompleteWindow(
  selection: ScheduleDateSelection
): boolean {
  const start = String(selection.startsOn ?? "").trim();
  const end = String(selection.endsOn ?? "").trim();
  return Boolean(start && end && end >= start);
}

export function isScheduleContextEmptyWorld(input: {
  status: ScheduleContextStatus;
  windowCount: number;
}): boolean {
  return input.status === "ready" && input.windowCount === 0;
}

export function shouldBlockScheduleWriteOnContextError(
  status: ScheduleContextStatus
): boolean {
  void status;
  return false;
}

export function scheduleRangeCacheKey(fromIso: string, toIso: string): string {
  return `${fromIso}|${toIso}`;
}

export function parseScheduleRangeReadResult(
  responseOk: boolean,
  json: unknown
): { status: "ready"; windows: ScheduleOccupancyWindow[] } | { status: "error" } {
  if (!responseOk) return { status: "error" };
  if (!json || typeof json !== "object") return { status: "error" };
  const events = (json as { events?: unknown }).events;
  if (!Array.isArray(events)) return { status: "error" };
  return {
    status: "ready",
    windows: occupancyWindowsFromUnknownEvents(events),
  };
}

const inflightRangeReads = new Map<
  string,
  Promise<{ status: ScheduleContextStatus; windows: ScheduleOccupancyWindow[] }>
>();

export function peekScheduleRangeInflightCount(): number {
  return inflightRangeReads.size;
}

export async function loadScheduleRangeOccupancy(input: {
  fromIso: string;
  toIso: string;
  fetchImpl?: typeof fetch;
}): Promise<{ status: ScheduleContextStatus; windows: ScheduleOccupancyWindow[] }> {
  const key = scheduleRangeCacheKey(input.fromIso, input.toIso);
  const existing = inflightRangeReads.get(key);
  if (existing) return existing;

  const fetchFn = input.fetchImpl ?? fetch;
  const pending = fetchFn(
    `/api/jobs/schedules?from=${encodeURIComponent(input.fromIso)}&to=${encodeURIComponent(input.toIso)}`,
    { cache: "no-store" }
  )
    .then(async (response) => {
      const json = await response.json().catch(() => null);
      const parsed = parseScheduleRangeReadResult(response.ok, json);
      if (parsed.status === "error") {
        return { status: "error" as const, windows: [] };
      }
      return { status: "ready" as const, windows: parsed.windows };
    })
    .catch(() => ({ status: "error" as const, windows: [] }))
    .finally(() => {
      inflightRangeReads.delete(key);
    });

  inflightRangeReads.set(key, pending);
  return pending;
}

export function scheduleDayAriaLabel(input: {
  iso: string;
  count: number;
  selected: boolean;
  thisJob: boolean;
}): string {
  const parts = [formatCivilDateAccessible(input.iso) || input.iso];
  const countLabel = scheduledCountAccessibleLabel(input.count);
  if (countLabel) parts.push(countLabel);
  if (input.selected) parts.push("selected for this job");
  else if (input.thisJob) parts.push("this job");
  return parts.join(", ");
}
