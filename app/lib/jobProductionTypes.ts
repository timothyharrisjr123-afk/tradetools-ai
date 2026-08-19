/**
 * R3G — guarded Start work / Production contracts.
 */

import type { JobSchedule } from "@/app/lib/jobScheduleTypes";

export const START_JOB_WORK_RPC_V1 = "start_job_work_v1";

export type StartJobWorkFailureCode =
  | "unauthorized"
  | "invalid_payload"
  | "forbidden"
  | "not_found"
  | "illegal_stage"
  | "disposition_blocks_start_work"
  | "start_work_schedule_integrity_error"
  | "production_start_integrity_error";

export type StartJobWorkSuccess = {
  ok: true;
  idempotent: boolean;
  job_id: string;
  from_stage: string;
  to_stage: "production";
  production_started_at: string;
  stage_entered_at: string;
  disposition_unchanged: string;
  schedule: JobSchedule;
  activity_id: string | null;
  stage_activity_id: string | null;
};

export type StartJobWorkFailure = {
  ok: false;
  code: StartJobWorkFailureCode | string;
  from_stage?: string;
  to_stage?: string;
  disposition?: string;
  active_schedule_count?: number;
};

export type StartJobWorkResult =
  | StartJobWorkSuccess
  | StartJobWorkFailure;

export function formatProductionStartedAt(
  iso: string | null | undefined,
  timezone: string | null | undefined
): string | null {
  const value = String(iso ?? "").trim();
  const parsed = Date.parse(value);
  if (!value || !Number.isFinite(parsed)) return null;
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  };
  if (timezone?.trim()) options.timeZone = timezone.trim();
  try {
    return new Intl.DateTimeFormat("en-US", options).format(new Date(parsed));
  } catch {
    delete options.timeZone;
    return new Intl.DateTimeFormat("en-US", options).format(new Date(parsed));
  }
}

