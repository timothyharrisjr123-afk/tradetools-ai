/**
 * Guarded schedule RPC persistence. No raw job_schedules writes from the client.
 */

import { isUuidLike } from "@/app/lib/uuid";
import {
  parseJobScheduleRow,
  validateScheduleWriteInput,
} from "@/app/lib/jobScheduleMapper";
import {
  RESCHEDULE_JOB_RPC_V1,
  SCHEDULE_JOB_RPC_V1,
  SET_COMPANY_TIMEZONE_RPC_V1,
  UNSCHEDULE_JOB_RPC_V1,
  type JobSchedule,
  type JobScheduleWriteInput,
  type ScheduleJobResult,
} from "@/app/lib/jobScheduleTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

export class JobSchedulePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobSchedulePersistenceError";
  }
}

export class JobScheduleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobScheduleValidationError";
  }
}

function parseUuid(value: unknown, label: string): string {
  const id = String(value ?? "").trim();
  if (!isUuidLike(id)) {
    throw new JobScheduleValidationError(`Invalid ${label}.`);
  }
  return id;
}

export function buildScheduleJobPayload(
  companyId: string,
  input: JobScheduleWriteInput
): Record<string, unknown> {
  const invalid = validateScheduleWriteInput(input);
  if (invalid) {
    throw new JobScheduleValidationError(invalid);
  }
  return {
    company_id: parseUuid(companyId, "company_id"),
    job_id: parseUuid(input.jobId, "job_id"),
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    all_day: input.allDay,
    start_local_time: input.allDay ? null : input.startLocalTime ?? null,
    end_local_time: input.allDay ? null : input.endLocalTime ?? null,
    notes: input.notes ?? null,
  };
}

export function buildRescheduleJobPayload(
  companyId: string,
  input: JobScheduleWriteInput
): Record<string, unknown> {
  const payload = buildScheduleJobPayload(companyId, input);
  const version = Number(input.expectedRowVersion);
  if (!Number.isInteger(version) || version < 1) {
    throw new JobScheduleValidationError("invalid_payload");
  }
  payload.expected_row_version = version;
  return payload;
}

export function buildUnscheduleJobPayload(
  companyId: string,
  jobId: string,
  expectedRowVersion?: number | null
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    company_id: parseUuid(companyId, "company_id"),
    job_id: parseUuid(jobId, "job_id"),
  };
  if (expectedRowVersion != null) {
    const version = Number(expectedRowVersion);
    if (!Number.isInteger(version) || version < 1) {
      throw new JobScheduleValidationError("invalid_payload");
    }
    payload.expected_row_version = version;
  }
  return payload;
}

export function parseScheduleJobResult(data: unknown): ScheduleJobResult {
  if (!data || typeof data !== "object") {
    throw new JobSchedulePersistenceError("Schedule RPC returned a non-object.");
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    return {
      ok: false,
      code: String(row.code ?? "invalid_payload"),
      from_stage: typeof row.from_stage === "string" ? row.from_stage : undefined,
      to_stage: typeof row.to_stage === "string" ? row.to_stage : undefined,
      row_version:
        typeof row.row_version === "number" ? row.row_version : undefined,
    };
  }
  if (row.ok !== true) {
    throw new JobSchedulePersistenceError("Schedule RPC returned an invalid payload.");
  }
  return {
    ok: true,
    idempotent: Boolean(row.idempotent),
    job_id: parseUuid(row.job_id, "job_id"),
    from_stage: String(row.from_stage ?? ""),
    to_stage: String(row.to_stage ?? ""),
    stage_entered_at:
      typeof row.stage_entered_at === "string" ? row.stage_entered_at : null,
    schedule: parseJobScheduleRow(row.schedule),
    activity_id: typeof row.activity_id === "string" ? row.activity_id : null,
    stage_activity_id:
      typeof row.stage_activity_id === "string" ? row.stage_activity_id : null,
  };
}

async function callScheduleRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  rpcName: string,
  payload: Record<string, unknown>
): Promise<ScheduleJobResult> {
  const { data, error } = await supabase.rpc(rpcName, { p_payload: payload });
  if (error) {
    throw new JobSchedulePersistenceError(`${rpcName} failed: ${error.message}`);
  }
  return parseScheduleJobResult(data);
}

export async function scheduleJobViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  companyId: string,
  input: JobScheduleWriteInput
): Promise<ScheduleJobResult> {
  return callScheduleRpc(
    supabase,
    SCHEDULE_JOB_RPC_V1,
    buildScheduleJobPayload(companyId, input)
  );
}

export async function rescheduleJobViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  companyId: string,
  input: JobScheduleWriteInput
): Promise<ScheduleJobResult> {
  return callScheduleRpc(
    supabase,
    RESCHEDULE_JOB_RPC_V1,
    buildRescheduleJobPayload(companyId, input)
  );
}

export async function unscheduleJobViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  companyId: string,
  jobId: string,
  expectedRowVersion?: number | null
): Promise<ScheduleJobResult> {
  return callScheduleRpc(
    supabase,
    UNSCHEDULE_JOB_RPC_V1,
    buildUnscheduleJobPayload(companyId, jobId, expectedRowVersion)
  );
}

export async function setCompanyTimezoneViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  companyId: string,
  timezone: string
): Promise<{ ok: true; timezone: string } | { ok: false; code: string }> {
  const { data, error } = await supabase.rpc(SET_COMPANY_TIMEZONE_RPC_V1, {
    p_payload: {
      company_id: parseUuid(companyId, "company_id"),
      timezone: timezone.trim(),
    },
  });
  if (error) {
    throw new JobSchedulePersistenceError(
      `${SET_COMPANY_TIMEZONE_RPC_V1} failed: ${error.message}`
    );
  }
  if (!data || typeof data !== "object") {
    throw new JobSchedulePersistenceError("Timezone RPC returned a non-object.");
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    return { ok: false, code: String(row.code ?? "invalid_payload") };
  }
  return { ok: true, timezone: String(row.timezone ?? timezone) };
}

export function parseJobScheduleList(rows: unknown): JobSchedule[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => parseJobScheduleRow(row))
    .filter((row): row is JobSchedule => row != null);
}
