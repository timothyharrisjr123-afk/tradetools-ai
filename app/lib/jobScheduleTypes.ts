/**
 * R3F — Canonical job work-schedule contracts.
 *
 * Calendar, Job Card, and Jobs Board all read/write this model.
 * Job stage remains separate: Approved → Scheduled is owned by schedule_job_v1.
 */

export const SCHEDULE_JOB_RPC_V1 = "schedule_job_v1";
export const RESCHEDULE_JOB_RPC_V1 = "reschedule_job_v1";
export const UNSCHEDULE_JOB_RPC_V1 = "unschedule_job_v1";
export const SET_COMPANY_TIMEZONE_RPC_V1 = "set_company_timezone_v1";

export const JOB_SCHEDULE_KIND_WORK = "work" as const;
export type JobScheduleKind = typeof JOB_SCHEDULE_KIND_WORK;

export const JOB_SCHEDULE_STATUSES = ["scheduled", "cancelled"] as const;
export type JobScheduleStatus = (typeof JOB_SCHEDULE_STATUSES)[number];

export const JOB_SCHEDULE_NOTES_MAX_LENGTH = 500;

export const JOB_SCHEDULE_SETTINGS_HREF = "/tools/settings#company-timezone";
export const JOB_SCHEDULE_CALENDAR_HREF = "/tools/roofing/calendar";

export const COMPANY_TIMEZONE_REQUIRED_COPY =
  "Set company timezone to schedule work.";
export const COMPANY_TIMEZONE_CTA = "Set timezone";
export const SCHEDULE_DEPOSIT_NOT_RECEIVED = "Deposit not received";

export type JobScheduleWindow = {
  all_day: boolean;
  starts_on: string;
  ends_on: string;
  start_local_time: string | null;
  end_local_time: string | null;
  timezone: string;
  notes: string | null;
};

export type JobSchedule = JobScheduleWindow & {
  id: string;
  company_id: string;
  job_id: string;
  kind: JobScheduleKind;
  status: JobScheduleStatus;
  range_start_at: string;
  range_end_at: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  row_version: number;
};

export type JobScheduleWriteInput = {
  jobId: string;
  startsOn: string;
  endsOn: string;
  allDay: boolean;
  startLocalTime?: string | null;
  endLocalTime?: string | null;
  notes?: string | null;
  expectedRowVersion?: number | null;
};

export type ScheduleJobFailureCode =
  | "unauthorized"
  | "invalid_payload"
  | "forbidden"
  | "not_found"
  | "company_timezone_required"
  | "invalid_timezone"
  | "invalid_window"
  | "already_scheduled"
  | "no_active_schedule"
  | "schedule_stale"
  | "schedule_stage_mismatch"
  | "illegal_stage"
  | "disposition_blocks_schedule"
  | "disposition_blocks_reschedule"
  | "disposition_blocks_unschedule"
  | "unschedule_blocked_production"
  | "unschedule_blocked_complete";

export type ScheduleJobSuccess = {
  ok: true;
  idempotent: boolean;
  job_id: string;
  from_stage: string;
  to_stage: string;
  stage_entered_at: string | null;
  schedule: JobSchedule | null;
  activity_id?: string | null;
  stage_activity_id?: string | null;
};

export type ScheduleJobFailure = {
  ok: false;
  code: ScheduleJobFailureCode | string;
  from_stage?: string;
  to_stage?: string;
  row_version?: number;
};

export type ScheduleJobResult = ScheduleJobSuccess | ScheduleJobFailure;

export type CalendarScheduleEvent = {
  schedule: JobSchedule;
  jobId: string;
  customerName: string;
  address: string;
  stage: string;
  disposition: string;
};

export type ScheduleCandidateJob = {
  jobId: string;
  customerName: string;
  address: string;
  depositDue: boolean;
};
