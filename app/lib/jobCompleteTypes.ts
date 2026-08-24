/**
 * R3H — guarded Complete job / Job completion contracts.
 */

import { formatProductionStartedAt } from "@/app/lib/jobProductionTypes";
import type { JobSchedule } from "@/app/lib/jobScheduleTypes";

export const COMPLETE_JOB_WORK_RPC_V1 = "complete_job_work_v1";

export type CompleteJobWorkFailureCode =
  | "unauthorized"
  | "invalid_payload"
  | "forbidden"
  | "not_found"
  | "illegal_stage"
  | "disposition_blocks_complete"
  | "complete_work_schedule_integrity_error"
  | "complete_work_integrity_error";

export type CompleteJobWorkSuccess = {
  ok: true;
  idempotent: boolean;
  job_id: string;
  from_stage: string;
  to_stage: "complete";
  completed_at: string;
  production_started_at: string;
  stage_entered_at: string;
  disposition_unchanged: string;
  schedule: JobSchedule;
  activity_id: string | null;
  stage_activity_id: string | null;
};

export type CompleteJobWorkFailure = {
  ok: false;
  code: CompleteJobWorkFailureCode | string;
  from_stage?: string;
  to_stage?: string;
  disposition?: string;
  planned_schedule_count?: number;
};

export type CompleteJobWorkResult =
  | CompleteJobWorkSuccess
  | CompleteJobWorkFailure;

/** Same civil formatter as Work started; completion uses jobs.completed_at only. */
export function formatJobCompletedAt(
  iso: string | null | undefined,
  timezone: string | null | undefined
): string | null {
  return formatProductionStartedAt(iso, timezone);
}
