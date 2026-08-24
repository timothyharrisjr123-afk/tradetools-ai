import { parseJobScheduleList } from "@/app/lib/jobSchedulePersistence";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";

/** Parse GET /api/jobs/schedules?jobId=… for Job Card canonical schedule hydration. */
export function parseJobCardSchedulesApiPayload(json: unknown): JobSchedule[] | null {
  if (!json || typeof json !== "object") return null;
  const row = json as { ok?: unknown; schedules?: unknown };
  if (row.ok !== true) return null;
  return parseJobScheduleList(row.schedules);
}

/** Whether a schedule hydrate response should be retried (auth/transient). */
export function shouldRetryJobCardScheduleFetch(
  responseOk: boolean,
  json: unknown,
  attempt: number,
  maxAttempts = 5
): boolean {
  if (attempt >= maxAttempts) return false;
  if (!responseOk) return true;
  if (!json || typeof json !== "object") return true;
  const code = String((json as { code?: unknown }).code ?? "");
  return code === "unauthorized" || code === "forbidden";
}
