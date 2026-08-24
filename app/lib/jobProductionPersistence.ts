/**
 * Guarded R3G Start-work persistence. No raw jobs.stage writes.
 */

import { isUuidLike } from "@/app/lib/uuid";
import { parseJobScheduleRow } from "@/app/lib/jobScheduleMapper";
import {
  START_JOB_WORK_RPC_V1,
  type StartJobWorkResult,
} from "@/app/lib/jobProductionTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

export class JobProductionPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobProductionPersistenceError";
  }
}

export class JobProductionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobProductionValidationError";
  }
}

function parseUuid(value: unknown, label: string): string {
  const id = String(value ?? "").trim();
  if (!isUuidLike(id)) {
    throw new JobProductionValidationError(`Invalid ${label}.`);
  }
  return id;
}

export function buildStartJobWorkPayload(
  companyId: string,
  jobId: string
): Record<string, unknown> {
  return {
    company_id: parseUuid(companyId, "company_id"),
    job_id: parseUuid(jobId, "job_id"),
  };
}

export function parseStartJobWorkResult(data: unknown): StartJobWorkResult {
  if (!data || typeof data !== "object") {
    throw new JobProductionPersistenceError(
      `${START_JOB_WORK_RPC_V1} returned a non-object.`
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
      active_schedule_count:
        typeof row.active_schedule_count === "number"
          ? row.active_schedule_count
          : undefined,
    };
  }
  if (row.ok !== true) {
    throw new JobProductionPersistenceError(
      `${START_JOB_WORK_RPC_V1} returned an invalid payload.`
    );
  }

  const schedule = parseJobScheduleRow(row.schedule);
  const productionStartedAt = String(row.production_started_at ?? "").trim();
  const stageEnteredAt = String(row.stage_entered_at ?? "").trim();
  if (
    !schedule ||
    !productionStartedAt ||
    !stageEnteredAt ||
    !Number.isFinite(Date.parse(productionStartedAt)) ||
    !Number.isFinite(Date.parse(stageEnteredAt))
  ) {
    throw new JobProductionPersistenceError(
      `${START_JOB_WORK_RPC_V1} returned incomplete Production truth.`
    );
  }

  return {
    ok: true,
    idempotent: Boolean(row.idempotent),
    job_id: parseUuid(row.job_id, "job_id"),
    from_stage: String(row.from_stage ?? ""),
    to_stage: "production",
    production_started_at: productionStartedAt,
    stage_entered_at: stageEnteredAt,
    disposition_unchanged: String(row.disposition_unchanged ?? ""),
    schedule,
    activity_id:
      typeof row.activity_id === "string" ? row.activity_id : null,
    stage_activity_id:
      typeof row.stage_activity_id === "string"
        ? row.stage_activity_id
        : null,
  };
}

export async function startJobWorkViaRpc(
  supabase: Pick<SupabaseClient, "rpc">,
  companyId: string,
  jobId: string
): Promise<StartJobWorkResult> {
  const { data, error } = await supabase.rpc(START_JOB_WORK_RPC_V1, {
    p_payload: buildStartJobWorkPayload(companyId, jobId),
  });
  if (error) {
    throw new JobProductionPersistenceError(
      `${START_JOB_WORK_RPC_V1} failed: ${error.message}`
    );
  }
  return parseStartJobWorkResult(data);
}

