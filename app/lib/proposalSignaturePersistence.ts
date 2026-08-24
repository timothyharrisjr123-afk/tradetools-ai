/**
 * R3D — Signature RPC persistence.
 *
 * Public sign hashes the raw token and calls service_role
 * record_proposal_signature_v1. That RPC never changes jobs.stage
 * and never writes proposals.signed_version_id.
 */

import { isUuidLike } from "@/app/lib/uuid";
import {
  hashProposalPublicAccessToken,
  ProposalPublicAccessTokenHashError,
} from "@/app/lib/proposalPublicAccessTokenHash";
import {
  assertProposalSignatureMark,
  proposalSignatureMarkError,
  type ProposalSignatureMarkV1,
} from "@/app/lib/proposalSignatureMark";
import {
  PROPOSAL_SIGNATURE_EMAIL_MAX,
  PROPOSAL_SIGNATURE_NAME_MAX,
  RECORD_PROPOSAL_SIGNATURE_RPC_V1,
} from "@/app/lib/proposalSignatureTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

export class ProposalSignaturePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalSignaturePersistenceError";
  }
}

export class ProposalSignatureValidationError extends ProposalSignaturePersistenceError {
  constructor(message: string) {
    super(message);
    this.name = "ProposalSignatureValidationError";
  }
}

export type ProposalSignatureRecordSuccess = {
  ok: true;
  signature_id: string;
  acceptance_id: string;
  token_id: string;
  company_id: string;
  job_id: string;
  proposal_id: string;
  proposal_version_id: string;
  proposal_option_id: string;
  signer_slot: string;
  signer_printed_name: string;
  signed_at: string;
  accepted_at: string;
  accepted_option_label: string;
  accepted_total_cents: number;
  acknowledgement_key: string;
  job_stage: string | null;
  stage_entered_at: string | null;
  job_stage_unchanged: boolean;
  signed_version_id_unchanged: string | null;
  idempotent_replay: boolean;
  acceptance_replay: boolean;
  attention_id: string | null;
};

export type ProposalSignatureRecordFailure = {
  ok: false;
  code: string;
};

export type ProposalSignatureRecordResult =
  | ProposalSignatureRecordSuccess
  | ProposalSignatureRecordFailure;

export type ProposalSignatureSubmitInput = {
  signerPrintedName: string;
  signerEmail?: string | null;
  drawnMark: ProposalSignatureMarkV1;
};

function parseUuid(value: unknown, label: string): string {
  const id = String(value ?? "").trim();
  if (!isUuidLike(id)) {
    throw new ProposalSignaturePersistenceError(`Invalid ${label}.`);
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
    throw new ProposalSignaturePersistenceError(`Invalid ${label}.`);
  }
  return timestamp;
}

export function normalizeSignerPrintedName(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) {
    throw new ProposalSignatureValidationError("Signer name is required.");
  }
  if (trimmed.length > PROPOSAL_SIGNATURE_NAME_MAX) {
    throw new ProposalSignatureValidationError("Signer name is too long.");
  }
  return trimmed;
}

function trimEmailOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > PROPOSAL_SIGNATURE_EMAIL_MAX) {
    throw new ProposalSignatureValidationError("Signer email is too long.");
  }
  return trimmed;
}

function tokenHashFromRaw(rawToken: string): string {
  try {
    return hashProposalPublicAccessToken(rawToken);
  } catch (error) {
    if (error instanceof ProposalPublicAccessTokenHashError) {
      throw new ProposalSignatureValidationError(error.message);
    }
    throw error;
  }
}

export function parseProposalSignatureRecordResult(
  data: unknown
): ProposalSignatureRecordResult {
  if (!data || typeof data !== "object") {
    throw new ProposalSignaturePersistenceError(
      `${RECORD_PROPOSAL_SIGNATURE_RPC_V1} returned no result.`
    );
  }
  const result = data as Record<string, unknown>;
  if (result.ok === false) {
    const code = String(result.code ?? "").trim();
    if (!code) {
      throw new ProposalSignaturePersistenceError(
        `${RECORD_PROPOSAL_SIGNATURE_RPC_V1} returned unknown failure code.`
      );
    }
    return { ok: false, code };
  }
  if (result.ok !== true) {
    throw new ProposalSignaturePersistenceError(
      `${RECORD_PROPOSAL_SIGNATURE_RPC_V1} returned unexpected ok value.`
    );
  }

  const total = Number(result.accepted_total_cents);
  if (!Number.isInteger(total) || total < 0) {
    throw new ProposalSignaturePersistenceError("Invalid accepted_total_cents.");
  }

  return {
    ok: true,
    signature_id: parseUuid(result.signature_id, "signature_id"),
    acceptance_id: parseUuid(result.acceptance_id, "acceptance_id"),
    token_id: parseUuid(result.token_id, "token_id"),
    company_id: parseUuid(result.company_id, "company_id"),
    job_id: parseUuid(result.job_id, "job_id"),
    proposal_id: parseUuid(result.proposal_id, "proposal_id"),
    proposal_version_id: parseUuid(result.proposal_version_id, "proposal_version_id"),
    proposal_option_id: parseUuid(result.proposal_option_id, "proposal_option_id"),
    signer_slot: String(result.signer_slot ?? "").trim() || "customer_primary",
    signer_printed_name: String(result.signer_printed_name ?? "").trim(),
    signed_at: parseTimestamp(result.signed_at, "signed_at"),
    accepted_at: parseTimestamp(result.accepted_at, "accepted_at"),
    accepted_option_label:
      String(result.accepted_option_label ?? "").trim() || "Package",
    accepted_total_cents: total,
    acknowledgement_key: String(result.acknowledgement_key ?? "").trim(),
    job_stage: result.job_stage == null ? null : String(result.job_stage),
    stage_entered_at:
      result.stage_entered_at == null ? null : String(result.stage_entered_at),
    job_stage_unchanged: result.job_stage_unchanged === true,
    signed_version_id_unchanged: parseOptionalUuid(
      result.signed_version_id_unchanged,
      "signed_version_id_unchanged"
    ),
    idempotent_replay: result.idempotent_replay === true,
    acceptance_replay: result.acceptance_replay === true,
    attention_id: parseOptionalUuid(result.attention_id, "attention_id"),
  };
}

export async function recordProposalSignatureViaRpc(
  supabase: SupabaseClient,
  rawToken: string,
  input: ProposalSignatureSubmitInput
): Promise<ProposalSignatureRecordResult> {
  const tokenHash = tokenHashFromRaw(rawToken);
  const name = normalizeSignerPrintedName(input.signerPrintedName);
  const email = trimEmailOrNull(input.signerEmail);
  const markError = proposalSignatureMarkError(input.drawnMark);
  if (markError) {
    throw new ProposalSignatureValidationError(markError);
  }
  assertProposalSignatureMark(input.drawnMark);

  const { data, error } = await supabase.rpc(RECORD_PROPOSAL_SIGNATURE_RPC_V1, {
    p_token_hash: tokenHash,
    p_signer_printed_name: name,
    p_signer_email: email,
    p_drawn_mark_json: input.drawnMark,
    p_payload_json: {},
  });

  if (error) {
    throw new ProposalSignaturePersistenceError(error.message);
  }
  return parseProposalSignatureRecordResult(data);
}
