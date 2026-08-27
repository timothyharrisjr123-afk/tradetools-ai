/**
 * 052 — Durable pre-pay public package choice RPC persistence.
 *
 * Token is hashed before the service_role RPC. The client never writes the
 * table and never supplies a price.
 */

import { isUuidLike } from "@/app/lib/uuid";
import {
  hashProposalPublicAccessToken,
  ProposalPublicAccessTokenHashError,
} from "@/app/lib/proposalPublicAccessTokenHash";
import type { SupabaseClient } from "@supabase/supabase-js";

export const RECORD_PROPOSAL_PUBLIC_OPTION_CHOICE_RPC_V1 =
  "record_proposal_public_option_choice_v1";

export const PROPOSAL_PUBLIC_OPTION_CHOICE_CURRENT_RPC_V1 =
  "proposal_public_option_choice_current_v1";

export const PROPOSAL_PUBLIC_OPTION_CHOICE_KEY_MAX = 200;

export const PROPOSAL_PUBLIC_OPTION_CHOICE_FAILURE_CODES = [
  "invalid_hash",
  "not_found",
  "revoked",
  "superseded",
  "expired",
  "invalid_version",
  "invalid_binding",
  "proposal_unavailable",
  "invalid_option_choice",
  "choice_locked",
] as const;

export type ProposalPublicOptionChoiceFailureCode =
  (typeof PROPOSAL_PUBLIC_OPTION_CHOICE_FAILURE_CODES)[number];

export type ProposalPublicOptionChoiceRecordSuccess = {
  ok: true;
  id: string;
  option_id: string;
  option_key: string;
  option_label: string;
  total_cents: number;
  idempotent_replay: boolean;
  locked: boolean;
};

export type ProposalPublicOptionChoiceRecordFailure = {
  ok: false;
  code: ProposalPublicOptionChoiceFailureCode | string;
};

export type ProposalPublicOptionChoiceRecordResult =
  | ProposalPublicOptionChoiceRecordSuccess
  | ProposalPublicOptionChoiceRecordFailure;

export type ProposalPublicOptionChoiceCurrent = {
  option_id: string;
  option_key: string;
  option_label: string;
  total_cents: number;
  locked: boolean;
};

export class ProposalPublicOptionChoicePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalPublicOptionChoicePersistenceError";
  }
}

export class ProposalPublicOptionChoiceValidationError extends ProposalPublicOptionChoicePersistenceError {
  constructor(message: string) {
    super(message);
    this.name = "ProposalPublicOptionChoiceValidationError";
  }
}

function tokenHashFromRaw(rawToken: string): string {
  try {
    return hashProposalPublicAccessToken(rawToken);
  } catch (error) {
    if (error instanceof ProposalPublicAccessTokenHashError) {
      throw new ProposalPublicOptionChoiceValidationError(error.message);
    }
    throw error;
  }
}

function parseRecordResult(data: unknown): ProposalPublicOptionChoiceRecordResult {
  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (!record) {
    return { ok: false, code: "invalid_option_choice" };
  }
  if (record.ok !== true) {
    return { ok: false, code: String(record.code ?? "invalid_option_choice") };
  }
  const optionKey = String(record.option_key ?? "").trim();
  const optionId = String(record.option_id ?? "").trim();
  const optionLabel = String(record.option_label ?? "").trim();
  const totalCents = Number(record.total_cents);
  if (!optionKey || !isUuidLike(optionId) || !optionLabel || !Number.isInteger(totalCents)) {
    return { ok: false, code: "invalid_option_choice" };
  }
  return {
    ok: true,
    id: String(record.id ?? ""),
    option_id: optionId,
    option_key: optionKey,
    option_label: optionLabel,
    total_cents: totalCents,
    idempotent_replay: record.idempotent_replay === true,
    locked: record.locked === true,
  };
}

export async function recordProposalPublicOptionChoiceViaRpc(
  supabase: SupabaseClient,
  rawToken: string,
  optionKey: string
): Promise<ProposalPublicOptionChoiceRecordResult> {
  const tokenHash = tokenHashFromRaw(rawToken);
  const key = optionKey.trim();
  if (!key || key.length > PROPOSAL_PUBLIC_OPTION_CHOICE_KEY_MAX) {
    return { ok: false, code: "invalid_option_choice" };
  }

  const { data, error } = await supabase.rpc(RECORD_PROPOSAL_PUBLIC_OPTION_CHOICE_RPC_V1, {
    p_token_hash: tokenHash,
    p_option_key: key,
  });

  if (error) {
    throw new ProposalPublicOptionChoicePersistenceError(error.message);
  }
  return parseRecordResult(data);
}

export async function readProposalPublicOptionChoiceCurrent(
  supabase: SupabaseClient,
  input: { companyId: string; proposalId: string; proposalVersionId: string }
): Promise<ProposalPublicOptionChoiceCurrent | null> {
  if (
    !isUuidLike(input.companyId) ||
    !isUuidLike(input.proposalId) ||
    !isUuidLike(input.proposalVersionId)
  ) {
    return null;
  }

  const { data, error } = await supabase.rpc(PROPOSAL_PUBLIC_OPTION_CHOICE_CURRENT_RPC_V1, {
    p_company_id: input.companyId,
    p_proposal_id: input.proposalId,
    p_proposal_version_id: input.proposalVersionId,
  });

  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const optionKey = String(record.option_key ?? "").trim();
  const optionId = String(record.option_id ?? "").trim();
  const optionLabel = String(record.option_label ?? "").trim();
  const totalCents = Number(record.total_cents);
  if (!optionKey || !isUuidLike(optionId) || !optionLabel || !Number.isInteger(totalCents)) {
    return null;
  }
  return {
    option_id: optionId,
    option_key: optionKey,
    option_label: optionLabel,
    total_cents: totalCents,
    locked: record.locked === true,
  };
}
