/**
 * Pure schedule window / label helpers. No Supabase or React.
 */

import {
  JOB_SCHEDULE_KIND_WORK,
  JOB_SCHEDULE_NOTES_MAX_LENGTH,
  JOB_SCHEDULE_STATUSES,
  type JobSchedule,
  type JobScheduleStatus,
  type JobScheduleWindow,
  type JobScheduleWriteInput,
} from "@/app/lib/jobScheduleTypes";

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export function isCivilDate(value: string | null | undefined): boolean {
  return CIVIL_DATE.test(String(value ?? "").trim());
}

export function normalizeLocalTime(
  value: string | null | undefined
): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = LOCAL_TIME.exec(raw);
  if (!match) return null;
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

export function normalizeScheduleNotes(
  value: string | null | undefined
): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, JOB_SCHEDULE_NOTES_MAX_LENGTH);
}

export function isJobScheduleStatus(
  value: string | null | undefined
): value is JobScheduleStatus {
  return (JOB_SCHEDULE_STATUSES as readonly string[]).includes(
    String(value ?? "")
  );
}

export function validateScheduleWriteInput(
  input: JobScheduleWriteInput
): "invalid_payload" | "invalid_window" | null {
  if (!isCivilDate(input.startsOn) || !isCivilDate(input.endsOn)) {
    return "invalid_payload";
  }
  if (input.endsOn < input.startsOn) return "invalid_window";
  if (input.allDay) {
    if (input.startLocalTime || input.endLocalTime) return "invalid_window";
    return null;
  }
  const start = normalizeLocalTime(input.startLocalTime);
  const end = normalizeLocalTime(input.endLocalTime);
  if (!start || !end) return "invalid_window";
  if (input.startsOn === input.endsOn && end <= start) return "invalid_window";
  return null;
}

function monthDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  if (!year || !month || !day) return isoDate;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatClock(localTime: string): string {
  const [hRaw, mRaw] = localTime.split(":");
  const hour = Number(hRaw);
  const minute = Number(mRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return localTime;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatScheduleDateRange(window: Pick<JobScheduleWindow, "starts_on" | "ends_on">): string {
  if (window.starts_on === window.ends_on) return monthDay(window.starts_on);
  const start = monthDay(window.starts_on);
  const end = monthDay(window.ends_on);
  const startMonth = start.split(" ")[0];
  const endParts = end.split(" ");
  if (endParts[0] === startMonth) return `${start}–${endParts[1]}`;
  return `${start}–${end}`;
}

export function formatScheduleWindowLabel(
  window: Pick<
    JobScheduleWindow,
    "all_day" | "starts_on" | "ends_on" | "start_local_time" | "end_local_time"
  >
): string {
  const dates = formatScheduleDateRange(window);
  if (window.all_day) return `${dates} · All day`;
  const start = window.start_local_time
    ? formatClock(window.start_local_time)
    : "";
  const end = window.end_local_time ? formatClock(window.end_local_time) : "";
  if (window.starts_on === window.ends_on) {
    return `${dates} · ${start}–${end}`.trim();
  }
  return `${monthDay(window.starts_on)} ${start} – ${monthDay(window.ends_on)} ${end}`.trim();
}

export function formatScheduleBoardMeta(
  window: Pick<
    JobScheduleWindow,
    "all_day" | "starts_on" | "ends_on" | "start_local_time" | "end_local_time"
  >
): string {
  const dates = formatScheduleDateRange(window);
  if (window.all_day) return `${dates} · All day`;
  const start = window.start_local_time
    ? formatClock(window.start_local_time)
    : "";
  const end = window.end_local_time ? formatClock(window.end_local_time) : "";
  return `${dates} · ${start}–${end}`;
}

export function parseJobScheduleRow(raw: unknown): JobSchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const companyId = String(row.company_id ?? "").trim();
  const jobId = String(row.job_id ?? "").trim();
  const startsOn = String(row.starts_on ?? "").trim();
  const endsOn = String(row.ends_on ?? "").trim();
  const timezone = String(row.timezone ?? "").trim();
  const status = String(row.status ?? "").trim();
  const kind = String(row.kind ?? "").trim();
  if (!id || !companyId || !jobId) return null;
  if (kind !== JOB_SCHEDULE_KIND_WORK || !isJobScheduleStatus(status)) return null;
  if (!isCivilDate(startsOn) || !isCivilDate(endsOn) || !timezone) return null;
  const allDay = row.all_day === true;
  const startLocal = allDay
    ? null
    : normalizeLocalTime(String(row.start_local_time ?? ""));
  const endLocal = allDay
    ? null
    : normalizeLocalTime(String(row.end_local_time ?? ""));
  const rowVersion = Number(row.row_version);
  return {
    id,
    company_id: companyId,
    job_id: jobId,
    kind: JOB_SCHEDULE_KIND_WORK,
    status,
    timezone,
    all_day: allDay,
    starts_on: startsOn,
    ends_on: endsOn,
    start_local_time: startLocal,
    end_local_time: endLocal,
    range_start_at: String(row.range_start_at ?? ""),
    range_end_at: String(row.range_end_at ?? ""),
    notes: normalizeScheduleNotes(
      typeof row.notes === "string" ? row.notes : null
    ),
    created_by_user_id:
      typeof row.created_by_user_id === "string" ? row.created_by_user_id : null,
    updated_by_user_id:
      typeof row.updated_by_user_id === "string" ? row.updated_by_user_id : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    cancelled_at: typeof row.cancelled_at === "string" ? row.cancelled_at : null,
    row_version: Number.isFinite(rowVersion) ? rowVersion : 1,
  };
}

export function parseScheduleWindowPayload(
  raw: unknown
): JobScheduleWindow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const parsed = parseJobScheduleRow({
    id: "00000000-0000-4000-8000-000000000000",
    company_id: "00000000-0000-4000-8000-000000000001",
    job_id: "00000000-0000-4000-8000-000000000002",
    kind: JOB_SCHEDULE_KIND_WORK,
    status: "scheduled",
    row_version: 1,
    range_start_at: "",
    range_end_at: "",
    created_at: "",
    updated_at: "",
    cancelled_at: null,
    created_by_user_id: null,
    updated_by_user_id: null,
    ...row,
  });
  if (!parsed) return null;
  return {
    all_day: parsed.all_day,
    starts_on: parsed.starts_on,
    ends_on: parsed.ends_on,
    start_local_time: parsed.start_local_time,
    end_local_time: parsed.end_local_time,
    timezone: parsed.timezone,
    notes: parsed.notes,
  };
}

export function activeWorkSchedule(
  rows: readonly JobSchedule[]
): JobSchedule | null {
  return (
    rows.find(
      (row) => row.kind === JOB_SCHEDULE_KIND_WORK && row.status === "scheduled"
    ) ?? null
  );
}

export function resolveJobCardActiveSchedule(input: {
  jobId: string | null | undefined;
  rows: readonly JobSchedule[];
  loadedForJobId: string | null;
}): { active: JobSchedule | null; ready: boolean } {
  const jobId = String(input.jobId ?? "").trim();
  const ready = Boolean(jobId) && input.loadedForJobId === jobId;
  if (!jobId || !ready) {
    return { active: null, ready: false };
  }
  return {
    ready: true,
    active: activeWorkSchedule(
      input.rows.filter((row) => row.job_id === jobId)
    ),
  };
}

export function upsertJobScheduleRow(
  rows: readonly JobSchedule[],
  next: JobSchedule
): JobSchedule[] {
  const withoutSameId = rows.filter((row) => row.id !== next.id);
  if (next.status !== "scheduled") {
    return [next, ...withoutSameId];
  }
  return [
    next,
    ...withoutSameId.filter(
      (row) =>
        !(
          row.job_id === next.job_id &&
          row.kind === JOB_SCHEDULE_KIND_WORK &&
          row.status === "scheduled"
        )
    ),
  ];
}

export function suggestedBrowserTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.trim() ? tz : null;
  } catch {
    return null;
  }
}

/** Settings company-timezone load lifecycle — never collapse into "Not set". */
export type CompanyTimezoneLoadStatus = "loading" | "ready" | "error";

export type CompanyTimezoneCanonicalStatus =
  | { kind: "loading"; text: string }
  | { kind: "error"; text: string }
  | { kind: "saved"; text: string; timezone: string }
  | { kind: "not_set"; text: string };

/**
 * Parse GET /api/company/timezone. Failed HTTP / non-ok payloads are errors,
 * not confirmed-null. Confirmed null is only a successful empty timezone.
 */
export function parseCompanyTimezoneGetResult(
  responseOk: boolean,
  json: unknown
): { status: "ready" | "error"; timezone: string | null } {
  if (!responseOk) return { status: "error", timezone: null };
  if (!json || typeof json !== "object") {
    return { status: "error", timezone: null };
  }
  const row = json as { ok?: unknown; timezone?: unknown };
  if (row.ok === false) return { status: "error", timezone: null };
  const raw = typeof row.timezone === "string" ? row.timezone.trim() : "";
  return { status: "ready", timezone: raw || null };
}

export function resolveCompanyTimezoneCanonicalStatus(input: {
  loadStatus: CompanyTimezoneLoadStatus;
  savedTimezone: string | null;
}): CompanyTimezoneCanonicalStatus {
  if (input.loadStatus === "loading") {
    return { kind: "loading", text: "Loading company timezone…" };
  }
  if (input.loadStatus === "error") {
    return {
      kind: "error",
      text: "Could not load company timezone. Try again.",
    };
  }
  const saved = (input.savedTimezone ?? "").trim();
  if (saved) {
    return { kind: "saved", text: `Saved: ${saved}`, timezone: saved };
  }
  return {
    kind: "not_set",
    text: "Not set — required before scheduling work.",
  };
}

/**
 * Shared consumer contract for Settings / Job Card / Board / Calendar.
 * LOADING | READY_SAVED | READY_NOT_SET | ERROR — never collapse error→not set.
 */
export type CompanyTimezoneReadState =
  | { kind: "loading" }
  | { kind: "ready_saved"; timezone: string }
  | { kind: "ready_not_set" }
  | { kind: "error" };

export function resolveCompanyTimezoneReadState(input: {
  loadStatus: CompanyTimezoneLoadStatus;
  savedTimezone: string | null;
}): CompanyTimezoneReadState {
  if (input.loadStatus === "loading") return { kind: "loading" };
  if (input.loadStatus === "error") return { kind: "error" };
  const saved = (input.savedTimezone ?? "").trim();
  if (saved) return { kind: "ready_saved", timezone: saved };
  return { kind: "ready_not_set" };
}

/** Only READY_SAVED yields a scheduling timezone. Loading/error/not-set → null. */
export function companyTimezoneForScheduling(
  state: CompanyTimezoneReadState
): string | null {
  return state.kind === "ready_saved" ? state.timezone : null;
}

export function shouldShowTimezoneSuggestion(input: {
  loadStatus: CompanyTimezoneLoadStatus;
  savedTimezone: string | null;
  suggestedTimezone: string | null;
}): boolean {
  return (
    input.loadStatus === "ready" &&
    !input.savedTimezone &&
    Boolean((input.suggestedTimezone ?? "").trim())
  );
}

export function isCompanyTimezoneDraftUnsaved(input: {
  loadStatus: CompanyTimezoneLoadStatus;
  savedTimezone: string | null;
  draftTimezone: string;
}): boolean {
  if (input.loadStatus !== "ready") return false;
  const draft = input.draftTimezone.trim();
  if (!draft) return false;
  return draft !== (input.savedTimezone ?? "");
}

export function listIanaTimezones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (Array.isArray(supported) && supported.length > 0) return supported;
  } catch {
    /* fall through */
  }
  return [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "UTC",
  ];
}

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedDateParts(instantMs: number, timezone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/**
 * Convert midnight at an IANA-zone civil date to its UTC instant.
 * The civil date remains the owner; this instant is only a query boundary.
 */
export function civilDateStartUtcIso(
  isoDate: string,
  timezone: string
): string {
  if (!isCivilDate(isoDate) || !timezone.trim()) {
    throw new Error("invalid_civil_timezone_boundary");
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const desiredWallMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  let instantMs = desiredWallMs;

  // Two passes resolve the zone offset on both sides of DST boundaries.
  for (let pass = 0; pass < 2; pass += 1) {
    const wall = zonedDateParts(instantMs, timezone);
    const representedWallMs = Date.UTC(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour,
      wall.minute,
      wall.second
    );
    instantMs += desiredWallMs - representedWallMs;
  }

  return new Date(instantMs).toISOString();
}

export function calendarCivilRangeUtc(input: {
  firstVisibleOn: string;
  afterLastVisibleOn: string;
  timezone: string;
}): { from: string; to: string } {
  return {
    from: civilDateStartUtcIso(input.firstVisibleOn, input.timezone),
    to: civilDateStartUtcIso(input.afterLastVisibleOn, input.timezone),
  };
}

export type ScheduleResumeContext = {
  jobId: string;
  startsOn: string;
  endsOn: string;
};

const SCHEDULE_RESUME_KEYS = [
  "resumeSchedule",
  "scheduleJob",
  "scheduleStartsOn",
  "scheduleEndsOn",
] as const;

export function buildScheduleResumePath(
  originPath: string,
  context: ScheduleResumeContext
): string {
  if (!originPath.startsWith("/") || originPath.startsWith("//")) {
    throw new Error("invalid_schedule_return_path");
  }
  const url = new URL(originPath, "https://fielddive.local");
  url.searchParams.set("resumeSchedule", "1");
  url.searchParams.set("scheduleJob", context.jobId);
  url.searchParams.set("scheduleStartsOn", context.startsOn);
  url.searchParams.set("scheduleEndsOn", context.endsOn);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildScheduleTimezoneSettingsHref(
  originPath: string,
  context: ScheduleResumeContext
): string {
  const returnTo = buildScheduleResumePath(originPath, context);
  return `/tools/settings?timezoneReturnTo=${encodeURIComponent(returnTo)}#company-timezone`;
}

export function parseScheduleResumeContext(
  search: string
): ScheduleResumeContext | null {
  const params = new URLSearchParams(search);
  const jobId = (params.get("scheduleJob") ?? "").trim();
  const startsOn = (params.get("scheduleStartsOn") ?? "").trim();
  const endsOn = (params.get("scheduleEndsOn") ?? startsOn).trim();
  if (
    params.get("resumeSchedule") !== "1" ||
    !jobId ||
    !isCivilDate(startsOn) ||
    !isCivilDate(endsOn) ||
    endsOn < startsOn
  ) {
    return null;
  }
  return { jobId, startsOn, endsOn };
}

export function stripScheduleResumeParams(path: string): string {
  const url = new URL(path, "https://fielddive.local");
  for (const key of SCHEDULE_RESUME_KEYS) url.searchParams.delete(key);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function parseTimezoneReturnPath(search: string): string | null {
  const returnTo = (new URLSearchParams(search).get("timezoneReturnTo") ?? "").trim();
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return null;
  const url = new URL(returnTo, "https://fielddive.local");
  if (url.origin !== "https://fielddive.local") return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function startOfMonthIso(year: number, monthIndex: number): string {
  const month = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function startOfWeekMondayIso(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = (date.getUTCDay() + 6) % 7;
  return addDaysIso(isoDate, -weekday);
}

export function todayCivilIso(timezone?: string | null): string {
  const now = new Date();
  if (timezone) {
    const parts = zonedDateParts(now.getTime(), timezone);
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
