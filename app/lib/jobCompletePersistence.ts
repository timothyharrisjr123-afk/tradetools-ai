/**
 * Guarded R3H Complete-job persistence. No raw jobs.stage writes.
 */

import { isUuidLike } from "@/app/lib/uuid";
import { parseJobScheduleRow } from "@/app/lib/jobScheduleMapper";
import {
  COMPLETE_JOB_WORK_RPC_V1,
  type CompleteJobWorkResult,
} from "@/app/lib/jobCompleteTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

export class JobCompletePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobCompletePersistenceError";
  }
}

export class JobCompleteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobCompleteValidationError";
  }
}

function parseUuid(value: unknown, label: string): string {
  const id = String(value ?? "").trim();
  if (!isUuidLike(id)) {
    throw new JobCompleteValidationError(`Invalid ${label}.`);
  }
  return id;
}

export function buildCompleteJobWorkPayload(
  companyId: string,
  jobId: string
): Record<string, unknown> {
  return {
    company_id: parseUuid(companyId, "company_id"),
    job_id: parseUuid(jobId, "job_id"),
  };
}

export function parseCompleteJobWorkResult(data: unknown): CompleteJobWorkResult {
  if (!data || typeof data !== "object") {
    throw new JobCompletePersistenceError(
      `${COMPLETE_JOB_WORK_RPC_V1} returned a non-object.`
    );
  }
  const row = data as Record<string, unknown>;
  if (row.ok === false) {
    return {
      ok: false,
      code: String(row.code ?? "invalid_payload"),
      from_stage:
        typeof row.from_stage === "string" ? row.from_stage : undefined,
      to_stage: typeof row.to_stage === "string" ? row.to_stage : undefined,
      disposition:
        typeof row.disposition === "string" ? row.disposition : undefined,
      planned_schedule_count:
        typeof row.planned_schedule_count === "number"
          ? row.planned_schedule_count
          : undefined,
    };
  }
  if (row.ok !== true) {
    throw new JobCompletePersistenceError(
      `${COMPLETE_JOB_WORK_RPC_V1} returned an invalid payload.`
    );
  }

  const schedule = parseJobScheduleRow(row.schedule);
  const completedAt = String(row.completed_at ?? "").trim();
  const productionStartedAt = String(row.production_started_at ?? "").trim();
  const stageEnteredAt = String(row.stage_entered_at ?? "").trim();
  if (
    !schedule ||
    !completedAt ||
    !productionStartedAt ||
    !stageEnteredAt ||
    !Number.isFinite(Date.parse(completedAt)) ||
    !Number.isFinite(Date.parse(productionStartedAt)) ||
    !Number.isFinite(Date.parse(stageEnteredAt))
  ) {
    throw new JobCompletePersistenceError(
      `${COMPLETE_JOB_WORK_RPC_V1} returned incomplete Complete truth.`
    );
  }

  return {
    ok: true,
    idempotent: Boolean(row.idempotent),
    job_id: parseUuid(row.job_id, "job_id"),
    from_stage: String(row.from_stage ?? ""),
    to_stage: "complete",
    completed_at: completedAt,
    production_started_at: productionStartedAt,
    stage_entered_at: stageEnteredAt,
    disposition_unchanged: String(row.disposition_unchanged ?? ""),
    schedule,
    activity_id: typeof row.activity_id === "string" ? row.activity_id : null,
    stage_activity_id:
      typeof row.stage_activity_id === "string" ? row.stage_activity_id : null,
  };
}

export async function completeJobWorkViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  companyId: string,
  jobId: string
): Promise<CompleteJobWorkResult> {
  const { data, error } = await supabase.rpc(COMPLETE_JOB_WORK_RPC_V1, {
    p_payload: buildCompleteJobWorkPayload(companyId, jobId),
  });
  if (error) {
    throw new JobCompletePersistenceError(
      `${COMPLETE_JOB_WORK_RPC_V1} failed: ${error.message}`
    );
  }
  return parseCompleteJobWorkResult(data);
}
