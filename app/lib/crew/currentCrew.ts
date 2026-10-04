/**
 * Current-Crew read model shared by every surface that asks "which Crew is doing this
 * work now?". Two database reads back it:
 *
 *  - list_job_current_crews_v1: current Crew(s) for many Jobs the caller can read.
 *  - get_crew_week_v1: each current assignment joined to the Job's Calendar work schedule
 *    over a civil date range. Read-only; Crews carry no dates.
 *
 * Current means the assignment has not ended. Lost, Complete, and Closed Jobs end it in
 * the database, so they never appear here. Names are live (Crew name, Lead's Person
 * name); history keeps its own snapshots elsewhere. A Job may later hold several Crews,
 * so every Job carries a list. Nothing here is inferred from the Coordinator, a login,
 * a role, a title, or an email, and the browser never filters for authority.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCivilDate } from "@/app/lib/jobScheduleMapper";
import { isUuidLike } from "@/app/lib/uuid";

export const LIST_JOB_CURRENT_CREWS_RPC_V1 = "list_job_current_crews_v1";
export const GET_CREW_WEEK_RPC_V1 = "get_crew_week_v1";
export const JOB_CURRENT_CREWS_MAX_JOBS = 200;

export type CurrentCrew = {
  assignmentId: string;
  crewId: string;
  crewName: string;
  isPrimary: boolean;
  leadPersonId: string | null;
  leadName: string | null;
};

export type JobCurrentCrews = {
  jobId: string;
  crews: CurrentCrew[];
};

export type CrewWeekItem = CurrentCrew & {
  jobId: string;
  customerName: string;
  address: string;
  /** jobs.status: active | on_hold. Terminal Jobs have no current Crew. */
  jobStatus: string;
  startsOn: string;
  endsOn: string;
};

export type CrewWeek = {
  startsOn: string;
  /** Exclusive. */
  afterEndOn: string;
  items: CrewWeekItem[];
};

const isId = (value: unknown): value is string => typeof value === "string" && isUuidLike(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isTextOrNull = (value: unknown) => value === null || isText(value);
const isCivil = (value: unknown): value is string => typeof value === "string" && isCivilDate(value);

function parseCurrentCrew(raw: unknown): CurrentCrew | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const leadId = row.assignment_lead_person_id ?? null;
  const leadName = row.assignment_lead_name ?? null;
  if (
    !isId(row.assignment_id) || !isId(row.crew_id) || !isText(row.crew_name) ||
    typeof row.is_primary !== "boolean" || !(leadId === null || isId(leadId)) ||
    !isTextOrNull(leadName) || (leadId === null) !== (leadName === null)
  ) {
    return null;
  }
  return {
    assignmentId: row.assignment_id,
    crewId: row.crew_id,
    crewName: row.crew_name,
    isPrimary: row.is_primary,
    leadPersonId: leadId as string | null,
    leadName: leadName as string | null,
  };
}

/** Strict parse of list_job_current_crews_v1. Malformed is null, never "no Crew". */
export function parseJobCurrentCrews(raw: unknown): JobCurrentCrews[] | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (body.ok !== true || !Array.isArray(body.jobs)) return null;
  const jobs: JobCurrentCrews[] = [];
  for (const entry of body.jobs) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    if (!isId(row.job_id) || !Array.isArray(row.crews)) return null;
    const crews = row.crews.map(parseCurrentCrew);
    if (crews.some((crew) => crew === null)) return null;
    jobs.push({ jobId: row.job_id, crews: crews as CurrentCrew[] });
  }
  return jobs;
}

/** Strict parse of get_crew_week_v1. Malformed is null, never an empty week. */
export function parseCrewWeek(raw: unknown): CrewWeek | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (body.ok !== true || !isCivil(body.starts_on) || !isCivil(body.after_end_on) || !Array.isArray(body.items)) {
    return null;
  }
  const items: CrewWeekItem[] = [];
  for (const entry of body.items) {
    const crew = parseCurrentCrew(entry);
    if (!crew) return null;
    const row = entry as Record<string, unknown>;
    if (
      !isId(row.job_id) || !isText(row.customer_name) || typeof row.address !== "string" ||
      !isText(row.job_status) || !isCivil(row.starts_on) || !isCivil(row.ends_on)
    ) {
      return null;
    }
    items.push({
      ...crew,
      jobId: row.job_id,
      customerName: row.customer_name,
      address: row.address,
      jobStatus: row.job_status,
      startsOn: row.starts_on as string,
      endsOn: row.ends_on as string,
    });
  }
  return { startsOn: body.starts_on as string, afterEndOn: body.after_end_on as string, items };
}

/** Strict read of an already-parsed CrewWeek sent over HTTP. */
export function readCrewWeek(value: unknown): CrewWeek | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CrewWeek>;
  if (!isCivil(raw.startsOn) || !isCivil(raw.afterEndOn) || !Array.isArray(raw.items)) return null;
  const ok = raw.items.every(
    (item) =>
      isId(item?.assignmentId) && isId(item?.crewId) && isText(item?.crewName) && typeof item?.isPrimary === "boolean" &&
      (item?.leadPersonId === null || isId(item?.leadPersonId)) && isTextOrNull(item?.leadName) &&
      isId(item?.jobId) && isText(item?.customerName) && typeof item?.address === "string" &&
      isText(item?.jobStatus) && isCivil(item?.startsOn) && isCivil(item?.endsOn)
  );
  return ok ? (raw as CrewWeek) : null;
}

/** One Crew's Jobs in the week, soonest first; a Job scheduled once appears once. */
export function crewWeekJobs(week: CrewWeek, crewId: string): CrewWeekItem[] {
  const seen = new Set<string>();
  return week.items
    .filter((item) => item.crewId === crewId)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.customerName.localeCompare(b.customerName) || a.jobId.localeCompare(b.jobId))
    .filter((item) => {
      if (seen.has(item.jobId)) return false;
      seen.add(item.jobId);
      return true;
    });
}

export function primaryCurrentCrew(entry: JobCurrentCrews | null | undefined): CurrentCrew | null {
  return entry?.crews.find((crew) => crew.isPrimary) ?? null;
}

export class CurrentCrewReadError extends Error {
  constructor(public code: "invalid_payload" | "forbidden" | "unavailable") {
    super(code);
  }
}

async function callRead(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<unknown> {
  let result: { data: unknown; error: unknown };
  try {
    result = await supabase.rpc(fn, args);
  } catch {
    throw new CurrentCrewReadError("unavailable");
  }
  if (result.error || !result.data || typeof result.data !== "object") throw new CurrentCrewReadError("unavailable");
  const body = result.data as Record<string, unknown>;
  if (body.ok !== true) {
    throw new CurrentCrewReadError(body.code === "forbidden" ? "forbidden" : body.code === "invalid_payload" ? "invalid_payload" : "unavailable");
  }
  return body;
}

export async function loadJobCurrentCrews(supabase: SupabaseClient, jobIds: readonly string[]): Promise<JobCurrentCrews[]> {
  const ids = [...new Set(jobIds)];
  if (ids.length > JOB_CURRENT_CREWS_MAX_JOBS || ids.some((id) => !isId(id))) throw new CurrentCrewReadError("invalid_payload");
  if (ids.length === 0) return [];
  const parsed = parseJobCurrentCrews(await callRead(supabase, LIST_JOB_CURRENT_CREWS_RPC_V1, { p_job_ids: ids }));
  if (!parsed) throw new CurrentCrewReadError("unavailable");
  return parsed;
}

export async function loadCrewWeek(supabase: SupabaseClient, range: { startsOn: string; afterEndOn: string }): Promise<CrewWeek> {
  if (!isCivil(range.startsOn) || !isCivil(range.afterEndOn)) throw new CurrentCrewReadError("invalid_payload");
  const parsed = parseCrewWeek(
    await callRead(supabase, GET_CREW_WEEK_RPC_V1, { p_starts_on: range.startsOn, p_after_end_on: range.afterEndOn })
  );
  if (!parsed) throw new CurrentCrewReadError("unavailable");
  return parsed;
}
