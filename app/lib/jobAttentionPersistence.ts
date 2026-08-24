/**
 * R3B4A — Durable attention persistence contracts.
 *
 * Attention is company-level operational state. Read state is personal
 * consumption only and never acknowledges or resolves attention.
 */

import { isUuidLike } from "@/app/lib/uuid";
import type { SupabaseClient } from "@supabase/supabase-js";

export const MARK_JOB_ATTENTION_READ_RPC_V1 =
  "mark_job_attention_read_v1";

export const JOB_ATTENTION_TYPES = [
  "customer_package_request",
  "customer_question",
  "acceptance_confirmation_required",
  "payments_not_connected",
  "payment_failed",
] as const;

export type JobAttentionType = (typeof JOB_ATTENTION_TYPES)[number];

export const JOB_ATTENTION_STATUSES = [
  "open",
  "acknowledged",
  "resolved",
] as const;

export type JobAttentionStatus = (typeof JOB_ATTENTION_STATUSES)[number];

export const JOB_ATTENTION_SEVERITIES = [
  "normal",
  "high",
  "critical",
] as const;

export type JobAttentionSeverity =
  (typeof JOB_ATTENTION_SEVERITIES)[number];

export const JOB_ATTENTION_DESTINATION_KINDS = [
  "job_card_proposals",
] as const;

export type JobAttentionDestinationKind =
  (typeof JOB_ATTENTION_DESTINATION_KINDS)[number];

export type MarkJobAttentionReadResult =
  | {
      ok: true;
      attention_id: string;
      user_id: string;
      read_at: string;
      last_viewed_at: string;
      attention_status_unchanged: JobAttentionStatus;
      request_status_unchanged: "new" | "seen" | "dismissed" | null;
    }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "invalid_attention_id"
        | "not_found"
        | "forbidden";
    };

export class JobAttentionPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobAttentionPersistenceError";
  }
}

function isAttentionStatus(value: unknown): value is JobAttentionStatus {
  return (
    typeof value === "string" &&
    (JOB_ATTENTION_STATUSES as readonly string[]).includes(value)
  );
}

function isRequestStatus(
  value: unknown
): value is "new" | "seen" | "dismissed" {
  return (
    value === "new" ||
    value === "seen" ||
    value === "dismissed"
  );
}

function isFailureCode(
  value: unknown
): value is Extract<MarkJobAttentionReadResult, { ok: false }>["code"] {
  return (
    value === "unauthorized" ||
    value === "invalid_attention_id" ||
    value === "not_found" ||
    value === "forbidden"
  );
}

function parseUuid(value: unknown, label: string): string {
  const id = String(value ?? "").trim();
  if (!isUuidLike(id)) {
    throw new JobAttentionPersistenceError(
      `${MARK_JOB_ATTENTION_READ_RPC_V1} returned invalid ${label}.`
    );
  }
  return id;
}

function parseTimestamp(value: unknown, label: string): string {
  const timestamp = String(value ?? "").trim();
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) {
    throw new JobAttentionPersistenceError(
      `${MARK_JOB_ATTENTION_READ_RPC_V1} returned invalid ${label}.`
    );
  }
  return timestamp;
}

export function parseMarkJobAttentionReadResult(
  data: unknown
): MarkJobAttentionReadResult {
  if (!data || typeof data !== "object") {
    throw new JobAttentionPersistenceError(
      `${MARK_JOB_ATTENTION_READ_RPC_V1} returned no result.`
    );
  }

  const result = data as Record<string, unknown>;
  if (result.ok === false) {
    if (!isFailureCode(result.code)) {
      throw new JobAttentionPersistenceError(
        `${MARK_JOB_ATTENTION_READ_RPC_V1} returned unknown failure code.`
      );
    }
    return { ok: false, code: result.code };
  }

  if (result.ok !== true) {
    throw new JobAttentionPersistenceError(
      `${MARK_JOB_ATTENTION_READ_RPC_V1} returned unexpected ok value.`
    );
  }

  if (!isAttentionStatus(result.attention_status_unchanged)) {
    throw new JobAttentionPersistenceError(
      `${MARK_JOB_ATTENTION_READ_RPC_V1} returned invalid attention status.`
    );
  }

  if (
    result.request_status_unchanged != null &&
    !isRequestStatus(result.request_status_unchanged)
  ) {
    throw new JobAttentionPersistenceError(
      `${MARK_JOB_ATTENTION_READ_RPC_V1} returned invalid request status.`
    );
  }

  return {
    ok: true,
    attention_id: parseUuid(result.attention_id, "attention_id"),
    user_id: parseUuid(result.user_id, "user_id"),
    read_at: parseTimestamp(result.read_at, "read_at"),
    last_viewed_at: parseTimestamp(
      result.last_viewed_at,
      "last_viewed_at"
    ),
    attention_status_unchanged: result.attention_status_unchanged,
    request_status_unchanged: isRequestStatus(result.request_status_unchanged)
      ? result.request_status_unchanged
      : null,
  };
}

export async function markJobAttentionReadViaRpc(
  supabase: SupabaseClient,
  attentionId: string
): Promise<MarkJobAttentionReadResult> {
  const normalizedAttentionId = attentionId.trim();
  if (!isUuidLike(normalizedAttentionId)) {
    throw new JobAttentionPersistenceError(
      "attentionId must be a UUID."
    );
  }

  const { data, error } = await supabase.rpc(
    MARK_JOB_ATTENTION_READ_RPC_V1,
    { p_attention_id: normalizedAttentionId }
  );

  if (error) {
    throw new JobAttentionPersistenceError(
      error.message ?? `${MARK_JOB_ATTENTION_READ_RPC_V1} failed.`
    );
  }

  return parseMarkJobAttentionReadResult(data);
}
