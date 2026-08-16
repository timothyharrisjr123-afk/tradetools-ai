/**
 * Read job-native Activity events. RLS select only. No stage/status writes.
 */

import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { isUuidLike } from "@/app/lib/jobStore";
import type { JobActivityEvent, JobActivityEventType } from "@/app/lib/jobLifecycleTypes";
import { JOB_ACTIVITY_EVENT_TYPES } from "@/app/lib/jobLifecycleTypes";

const JOB_ACTIVITY_SELECT_COLUMNS =
  "id, company_id, job_id, event_type, actor_user_id, payload_json, occurred_at, created_at";

function isEventType(value: unknown): value is JobActivityEventType {
  return (
    typeof value === "string" &&
    (JOB_ACTIVITY_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function rowToJobActivityEvent(row: Record<string, unknown>): JobActivityEvent | null {
  const id = String(row.id ?? "").trim();
  const companyId = String(row.company_id ?? "").trim();
  const jobId = String(row.job_id ?? "").trim();
  if (!isUuidLike(id) || !isUuidLike(companyId) || !isUuidLike(jobId)) return null;
  if (!isEventType(row.event_type)) return null;
  const occurredAt = String(row.occurred_at ?? "").trim();
  if (!occurredAt) return null;
  return {
    id,
    company_id: companyId,
    job_id: jobId,
    event_type: row.event_type,
    actor_user_id:
      typeof row.actor_user_id === "string" ? row.actor_user_id : null,
    payload_json:
      row.payload_json && typeof row.payload_json === "object"
        ? (row.payload_json as Record<string, unknown>)
        : {},
    occurred_at: occurredAt,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

export async function listJobActivityEventsForJob(
  jobId: string
): Promise<JobActivityEvent[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const id = String(jobId || "").trim();
  if (!isUuidLike(id)) return [];

  const { data, error } = await supabase
    .from("job_activity_events")
    .select(JOB_ACTIVITY_SELECT_COLUMNS)
    .eq("job_id", id)
    .order("occurred_at", { ascending: false });

  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => rowToJobActivityEvent(row as Record<string, unknown>))
    .filter((row): row is JobActivityEvent => row != null);
}
