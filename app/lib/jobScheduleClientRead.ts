/**
 * RLS reads for job_schedules. Writes go through guarded RPCs.
 */

import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { isUuidLike } from "@/app/lib/uuid";
import { parseJobScheduleList } from "@/app/lib/jobSchedulePersistence";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";

const SCHEDULE_COLUMNS =
  "id,company_id,job_id,kind,status,timezone,all_day,starts_on,ends_on,start_local_time,end_local_time,range_start_at,range_end_at,notes,created_by_user_id,updated_by_user_id,created_at,updated_at,cancelled_at,row_version";

export async function listJobSchedulesForJob(
  jobId: string
): Promise<JobSchedule[]> {
  const id = jobId.trim();
  if (!isUuidLike(id)) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("job_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("job_id", id)
    .order("created_at", { ascending: false });
  if (error) return [];
  return parseJobScheduleList(data);
}

export async function listActiveWorkSchedulesForCompany(): Promise<JobSchedule[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("job_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("kind", "work")
    .eq("status", "scheduled")
    .order("starts_on", { ascending: true });
  if (error) return [];
  return parseJobScheduleList(data);
}

export async function listWorkSchedulesOverlappingRange(input: {
  fromIso: string;
  toIso: string;
}): Promise<JobSchedule[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("job_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("kind", "work")
    .eq("status", "scheduled")
    .lt("range_start_at", input.toIso)
    .gt("range_end_at", input.fromIso)
    .order("range_start_at", { ascending: true });
  if (error) return [];
  return parseJobScheduleList(data);
}

export async function loadCompanyTimezone(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("companies")
    .select("timezone")
    .maybeSingle();
  if (error || !data) return null;
  const tz = String((data as { timezone?: string | null }).timezone ?? "").trim();
  return tz || null;
}
