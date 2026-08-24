/**
 * R3C — Formal acceptance RPC persistence.
 *
 * Public accept hashes the raw token and calls service_role
 * record_proposal_acceptance_v1. That RPC never changes jobs.stage.
 * Contractor Approve job uses authenticated confirm_proposal_acceptance_v1.
 */

import { isUuidLike } from "@/app/lib/uuid";
import {
  ACKNOWLEDGE_PROPOSAL_ACCEPTANCE_ATTENTION_RPC_V1,
  CONFIRM_PROPOSAL_ACCEPTANCE_RPC_V1,
  PROPOSAL_ACCEPTANCE_AMBIGUITY_REASONS,
  PROPOSAL_ACCEPTANCE_GUARD_RESULTS,
  PROPOSAL_ACCEPTANCE_INVALID_REASONS,
  RECORD_PROPOSAL_ACCEPTANCE_RPC_V1,
  type ProposalAcceptanceAmbiguityReason,
  type ProposalAcceptanceGuardResult,
  type ProposalAcceptanceInvalidReason,
} from "@/app/lib/proposalAcceptanceTypes";
import {
  hashProposalPublicAccessToken,
  ProposalPublicAccessTokenHashError,
} from "@/app/lib/proposalPublicAccessTokenHash";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PROPOSAL_ACCEPTANCE_NAME_MAX = 120;
export const PROPOSAL_ACCEPTANCE_EMAIL_MAX = 254;

export class ProposalAcceptancePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalAcceptancePersistenceError";
  }
}

export class ProposalAcceptanceValidationError extends ProposalAcceptancePersistenceError {
  constructor(message: string) {
    super(message);
    this.name = "ProposalAcceptanceValidationError";
  }
}

export type ProposalAcceptanceRecordSuccess = {
  ok: true;
  acceptance_id: string;
  token_id: string;
  company_id: string;
  job_id: string;
  proposal_id: string;
  proposal_version_id: string;
  proposal_option_id: string;
  accepted_option_label: string;
  accepted_total_cents: number;
  accepted_at: string;
  guard_result: Exclude<ProposalAcceptanceGuardResult, "invalid">;
  ambiguity_reason: ProposalAcceptanceAmbiguityReason | null;
  attention_id: string | null;
  job_stage: string | null;
  stage_entered_at: string | null;
  idempotent_replay: boolean;
  selected_option_id_unchanged: string | null;
};

export type ProposalAcceptanceRecordFailure = {
  ok: false;
  code: ProposalAcceptanceInvalidReason | string;
};

export type ProposalAcceptanceRecordResult =
  | ProposalAcceptanceRecordSuccess
  | ProposalAcceptanceRecordFailure;

export type ProposalAcceptanceSubmitInput = {
  acceptedByName?: string | null;
  acceptedByEmail?: string | null;
};

export type ConfirmProposalAcceptanceSuccess = {
  ok: true;
  idempotent: boolean;
  acceptance_id: string;
  proposal_version_id: string;
  proposal_option_id: string;
  guard_result: string;
  ambiguity_reason: string | null;
  confirmed_at: string;
  confirmed_by_user_id: string;
  attention_id: string | null;
  job_id?: string;
  from_stage?: string | null;
  to_stage?: string | null;
  stage_entered_at?: string | null;
  activity_id?: string | null;
  job_stage?: string | null;
};

export type ConfirmProposalAcceptanceFailure = {
  ok: false;
  code: string;
};

export type ConfirmProposalAcceptanceResult =
  | ConfirmProposalAcceptanceSuccess
  | ConfirmProposalAcceptanceFailure;

export type AcknowledgeProposalAcceptanceSuccess = {
  ok: true;
  idempotent: boolean;
  acceptance_id: string;
  attention_id: string | null;
  resolution_reason: string | null;
  confirmed_at: string | null;
  job_stage: string | null;
  stage_entered_at: string | null;
  status_unchanged: string | null;
};

export type AcknowledgeProposalAcceptanceResult =
  | AcknowledgeProposalAcceptanceSuccess
  | ConfirmProposalAcceptanceFailure;

function isGuardResult(
  value: unknown
): value is Exclude<ProposalAcceptanceGuardResult, "invalid"> {
  return value === "valid_clean" || value === "valid_review_required";
}

function isAmbiguityReason(
  value: unknown
): value is ProposalAcceptanceAmbiguityReason {
  return (
    typeof value === "string" &&
    (PROPOSAL_ACCEPTANCE_AMBIGUITY_REASONS as readonly string[]).includes(value)
  );
}

function parseUuid(value: unknown, label: string): string {
  const id = String(value ?? "").trim();
  if (!isUuidLike(id)) {
    throw new ProposalAcceptancePersistenceError(`Invalid ${label}.`);
  }
  return id;
}

function parseOptionalUuid(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  return parseUuid(value, label);
}

function parseTimestamp(value: unknown, label: string): string {
  const timestamp = String(value ?? "").trim();
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) {
    throw new ProposalAcceptancePersistenceError(`Invalid ${label}.`);
  }
  return timestamp;
}

function trimOrNull(value: string | null | undefined, max: number): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw new ProposalAcceptanceValidationError(
      `Acceptance field exceeds max length (${max}).`
    );
  }
  return trimmed;
}

function tokenHashFromRaw(rawToken: string): string {
  try {
    return hashProposalPublicAccessToken(rawToken);
  } catch (error) {
    if (error instanceof ProposalPublicAccessTokenHashError) {
      throw new ProposalAcceptanceValidationError(error.message);
    }
    throw error;
  }
}

export function parseProposalAcceptanceRecordResult(
  data: unknown
): ProposalAcceptanceRecordResult {
  if (!data || typeof data !== "object") {
    throw new ProposalAcceptancePersistenceError(
      `${RECORD_PROPOSAL_ACCEPTANCE_RPC_V1} returned no result.`
    );
  }
  const result = data as Record<string, unknown>;
  if (result.ok === false) {
    const code = String(result.code ?? "").trim();
    if (!code) {
      throw new ProposalAcceptancePersistenceError(
        `${RECORD_PROPOSAL_ACCEPTANCE_RPC_V1} returned unknown failure code.`
      );
    }
    return { ok: false, code };
  }
  if (result.ok !== true) {
    throw new ProposalAcceptancePersistenceError(
      `${RECORD_PROPOSAL_ACCEPTANCE_RPC_V1} returned unexpected ok value.`
    );
  }
  if (!isGuardResult(result.guard_result)) {
    throw new ProposalAcceptancePersistenceError(
      `${RECORD_PROPOSAL_ACCEPTANCE_RPC_V1} returned invalid guard_result.`
    );
  }
  const reason = result.ambiguity_reason;
  if (reason != null && reason !== "" && !isAmbiguityReason(reason)) {
    throw new ProposalAcceptancePersistenceError(
      `${RECORD_PROPOSAL_ACCEPTANCE_RPC_V1} returned invalid ambiguity_reason.`
    );
  }
  const total = Number(result.accepted_total_cents);
  if (!Number.isInteger(total) || total < 0) {
    throw new ProposalAcceptancePersistenceError(
      `${RECORD_PROPOSAL_ACCEPTANCE_RPC_V1} returned invalid accepted_total_cents.`
    );
  }
  if (typeof result.idempotent_replay !== "boolean") {
    throw new ProposalAcceptancePersistenceError(
      `${RECORD_PROPOSAL_ACCEPTANCE_RPC_V1} returned invalid replay state.`
    );
  }

  return {
    ok: true,
    acceptance_id: parseUuid(result.acceptance_id, "acceptance_id"),
    token_id: parseUuid(result.token_id, "token_id"),
    company_id: parseUuid(result.company_id, "company_id"),
    job_id: parseUuid(result.job_id, "job_id"),
    proposal_id: parseUuid(result.proposal_id, "proposal_id"),
    proposal_version_id: parseUuid(result.proposal_version_id, "proposal_version_id"),
    proposal_option_id: parseUuid(result.proposal_option_id, "proposal_option_id"),
    accepted_option_label: String(result.accepted_option_label ?? "").trim() || "Package",
    accepted_total_cents: total,
    accepted_at: parseTimestamp(result.accepted_at, "accepted_at"),
    guard_result: result.guard_result,
    ambiguity_reason: isAmbiguityReason(reason) ? reason : null,
    attention_id: parseOptionalUuid(result.attention_id, "attention_id"),
    job_stage: result.job_stage == null ? null : String(result.job_stage),
    stage_entered_at:
      result.stage_entered_at == null
        ? null
        : String(result.stage_entered_at),
    idempotent_replay: result.idempotent_replay,
    selected_option_id_unchanged: parseOptionalUuid(
      result.selected_option_id_unchanged,
      "selected_option_id_unchanged"
    ),
  };
}

export function parseConfirmProposalAcceptanceResult(
  data: unknown
): ConfirmProposalAcceptanceResult {
  if (!data || typeof data !== "object") {
    throw new ProposalAcceptancePersistenceError(
      `${CONFIRM_PROPOSAL_ACCEPTANCE_RPC_V1} returned no result.`
    );
  }
  const result = data as Record<string, unknown>;
  if (result.ok === false) {
    return { ok: false, code: String(result.code ?? "unknown") };
  }
  if (result.ok !== true) {
    throw new ProposalAcceptancePersistenceError(
      `${CONFIRM_PROPOSAL_ACCEPTANCE_RPC_V1} returned unexpected ok value.`
    );
  }
  return {
    ok: true,
    idempotent: result.idempotent === true,
    acceptance_id: parseUuid(result.acceptance_id, "acceptance_id"),
    proposal_version_id: parseUuid(
      result.proposal_version_id,
      "proposal_version_id"
    ),
    proposal_option_id: parseUuid(
      result.proposal_option_id,
      "proposal_option_id"
    ),
    guard_result: String(result.guard_result ?? ""),
    ambiguity_reason:
      result.ambiguity_reason == null
        ? null
        : String(result.ambiguity_reason),
    confirmed_at: parseTimestamp(result.confirmed_at, "confirmed_at"),
    confirmed_by_user_id: parseUuid(
      result.confirmed_by_user_id,
      "confirmed_by_user_id"
    ),
    attention_id: parseOptionalUuid(result.attention_id, "attention_id"),
    job_id: result.job_id == null ? undefined : String(result.job_id),
    from_stage:
      result.from_stage == null ? null : String(result.from_stage),
    to_stage: result.to_stage == null ? null : String(result.to_stage),
    stage_entered_at:
      result.stage_entered_at == null
        ? null
        : String(result.stage_entered_at),
    activity_id:
      result.activity_id == null ? null : String(result.activity_id),
    job_stage: result.job_stage == null ? null : String(result.job_stage),
  };
}

export async function recordProposalAcceptanceViaRpc(
  supabase: SupabaseClient,
  rawToken: string,
  input: ProposalAcceptanceSubmitInput = {}
): Promise<ProposalAcceptanceRecordResult> {
  const tokenHash = tokenHashFromRaw(rawToken);
  const acceptedByName = trimOrNull(
    input.acceptedByName,
    PROPOSAL_ACCEPTANCE_NAME_MAX
  );
  const acceptedByEmail = trimOrNull(
    input.acceptedByEmail,
    PROPOSAL_ACCEPTANCE_EMAIL_MAX
  );

  const { data, error } = await supabase.rpc(RECORD_PROPOSAL_ACCEPTANCE_RPC_V1, {
    p_token_hash: tokenHash,
    p_accepted_by_name: acceptedByName,
    p_accepted_by_email: acceptedByEmail,
    p_payload_json: {},
  });

  if (error) {
    throw new ProposalAcceptancePersistenceError(error.message);
  }
  return parseProposalAcceptanceRecordResult(data);
}

export async function confirmProposalAcceptanceViaRpc(
  supabase: SupabaseClient,
  input: { companyId: string; jobId: string; acceptanceId: string }
): Promise<ConfirmProposalAcceptanceResult> {
  if (
    !isUuidLike(input.companyId) ||
    !isUuidLike(input.jobId) ||
    !isUuidLike(input.acceptanceId)
  ) {
    throw new ProposalAcceptanceValidationError("Invalid confirmation payload.");
  }

  const { data, error } = await supabase.rpc(CONFIRM_PROPOSAL_ACCEPTANCE_RPC_V1, {
    p_payload: {
      company_id: input.companyId,
      job_id: input.jobId,
      acceptance_id: input.acceptanceId,
    },
  });

  if (error) {
    throw new ProposalAcceptancePersistenceError(error.message);
  }
  return parseConfirmProposalAcceptanceResult(data);
}

export function parseAcknowledgeProposalAcceptanceResult(
  data: unknown
): AcknowledgeProposalAcceptanceResult {
  if (!data || typeof data !== "object") {
    throw new ProposalAcceptancePersistenceError(
      `${ACKNOWLEDGE_PROPOSAL_ACCEPTANCE_ATTENTION_RPC_V1} returned no result.`
    );
  }
  const result = data as Record<string, unknown>;
  if (result.ok === false) {
    return { ok: false, code: String(result.code ?? "unknown") };
  }
  if (result.ok !== true) {
    throw new ProposalAcceptancePersistenceError(
      `${ACKNOWLEDGE_PROPOSAL_ACCEPTANCE_ATTENTION_RPC_V1} returned unexpected ok value.`
    );
  }
  return {
    ok: true,
    idempotent: result.idempotent === true,
    acceptance_id: parseUuid(result.acceptance_id, "acceptance_id"),
    attention_id: parseOptionalUuid(result.attention_id, "attention_id"),
    resolution_reason:
      result.resolution_reason == null ? null : String(result.resolution_reason),
    confirmed_at:
      result.confirmed_at == null || result.confirmed_at === ""
        ? null
        : parseTimestamp(result.confirmed_at, "confirmed_at"),
    job_stage: result.job_stage == null ? null : String(result.job_stage),
    stage_entered_at:
      result.stage_entered_at == null ? null : String(result.stage_entered_at),
    status_unchanged:
      result.status_unchanged == null ? null : String(result.status_unchanged),
  };
}

export async function acknowledgeProposalAcceptanceViaRpc(
  supabase: SupabaseClient,
  input: { companyId: string; jobId: string; acceptanceId: string }
): Promise<AcknowledgeProposalAcceptanceResult> {
  if (
    !isUuidLike(input.companyId) ||
    !isUuidLike(input.jobId) ||
    !isUuidLike(input.acceptanceId)
  ) {
    throw new ProposalAcceptanceValidationError("Invalid acknowledgement payload.");
  }

  const { data, error } = await supabase.rpc(
    ACKNOWLEDGE_PROPOSAL_ACCEPTANCE_ATTENTION_RPC_V1,
    {
      p_payload: {
        company_id: input.companyId,
        job_id: input.jobId,
        acceptance_id: input.acceptanceId,
      },
    }
  );

  if (error) {
    throw new ProposalAcceptancePersistenceError(error.message);
  }
  return parseAcknowledgeProposalAcceptanceResult(data);
}

export const PROPOSAL_ACCEPTANCE_FAILURE_CODES = [
  ...PROPOSAL_ACCEPTANCE_INVALID_REASONS,
  ...PROPOSAL_ACCEPTANCE_GUARD_RESULTS,
] as const;
