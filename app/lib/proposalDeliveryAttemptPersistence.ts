/**
 * R18D3A — Proposal delivery attempt persistence (injectable Supabase client).
 *
 * Server entry points live in proposalDeliveryAttemptStore.server.ts.
 * No Resend, routes, proposals.status, or proposal_events writes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type CreateProposalDeliveryAttemptInput,
  type ListProposalDeliveryAttemptsInput,
  type MarkProposalDeliveryAttemptFailedInput,
  type MarkProposalDeliveryAttemptProviderAcceptedInput,
  type ProposalDeliveryAttemptRow,
} from "@/app/lib/proposalDeliveryAttemptTypes";

export const PROPOSAL_DELIVERY_ATTEMPTS_TABLE = "proposal_delivery_attempts";

export const MAX_SAFE_DELIVERY_ERROR_MESSAGE_LENGTH = 500;

export class ProposalDeliveryAttemptPersistenceError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = "ProposalDeliveryAttemptPersistenceError";
  }
}

export function truncateSafeDeliveryErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= MAX_SAFE_DELIVERY_ERROR_MESSAGE_LENGTH) {
    return trimmed;
  }
  return trimmed.slice(0, MAX_SAFE_DELIVERY_ERROR_MESSAGE_LENGTH);
}

function mapRow(row: Record<string, unknown>): ProposalDeliveryAttemptRow {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    proposal_id: String(row.proposal_id),
    proposal_version_id: String(row.proposal_version_id),
    proposal_public_access_token_id:
      row.proposal_public_access_token_id == null
        ? null
        : String(row.proposal_public_access_token_id),
    channel: "email",
    provider: "resend",
    recipient_email_hash: String(row.recipient_email_hash),
    recipient_email_redacted:
      row.recipient_email_redacted == null ? null : String(row.recipient_email_redacted),
    token_prefix: row.token_prefix == null ? null : String(row.token_prefix),
    idempotency_key: String(row.idempotency_key),
    status: row.status as ProposalDeliveryAttemptRow["status"],
    subject_snapshot: String(row.subject_snapshot),
    body_snapshot: String(row.body_snapshot),
    provider_message_id:
      row.provider_message_id == null ? null : String(row.provider_message_id),
    error_code: row.error_code == null ? null : String(row.error_code),
    error_message_safe:
      row.error_message_safe == null ? null : String(row.error_message_safe),
    metadata_json:
      row.metadata_json != null && typeof row.metadata_json === "object" && !Array.isArray(row.metadata_json)
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    created_by: row.created_by == null ? null : String(row.created_by),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    attempted_at: row.attempted_at == null ? null : String(row.attempted_at),
    provider_accepted_at:
      row.provider_accepted_at == null ? null : String(row.provider_accepted_at),
    failed_at: row.failed_at == null ? null : String(row.failed_at),
    delivered_at: row.delivered_at == null ? null : String(row.delivered_at),
    bounced_at: row.bounced_at == null ? null : String(row.bounced_at),
    complained_at: row.complained_at == null ? null : String(row.complained_at),
  };
}

function resolveAttemptLookupFilter(
  input: { company_id: string; attempt_id?: string; idempotency_key?: string }
): { column: "id" | "idempotency_key"; value: string } {
  const attemptId = input.attempt_id?.trim();
  const idempotencyKey = input.idempotency_key?.trim();

  if (attemptId) {
    return { column: "id", value: attemptId };
  }

  if (idempotencyKey) {
    return { column: "idempotency_key", value: idempotencyKey };
  }

  throw new ProposalDeliveryAttemptPersistenceError(
    "attempt_id or idempotency_key is required",
    "missing_lookup_key"
  );
}

export function buildAttemptedDeliveryInsertPayload(
  input: CreateProposalDeliveryAttemptInput,
  attemptedAt: string
): Record<string, unknown> {
  return {
    company_id: input.company_id,
    proposal_id: input.proposal_id,
    proposal_version_id: input.proposal_version_id,
    proposal_public_access_token_id: input.proposal_public_access_token_id ?? null,
    token_prefix: input.token_prefix ?? null,
    recipient_email_hash: input.recipient_email_hash,
    recipient_email_redacted: input.recipient_email_redacted ?? null,
    channel: "email",
    provider: "resend",
    idempotency_key: input.idempotency_key,
    status: "attempted",
    subject_snapshot: input.subject_snapshot,
    body_snapshot: input.body_snapshot,
    metadata_json: input.metadata_json ?? {},
    created_by: input.created_by ?? null,
    attempted_at: attemptedAt,
  };
}

export async function createProposalDeliveryAttemptedWithClient(
  supabase: SupabaseClient,
  input: CreateProposalDeliveryAttemptInput,
  now: () => Date = () => new Date()
): Promise<ProposalDeliveryAttemptRow> {
  const attemptedAt = now().toISOString();
  const payload = buildAttemptedDeliveryInsertPayload(input, attemptedAt);

  const { data, error } = await supabase
    .from(PROPOSAL_DELIVERY_ATTEMPTS_TABLE)
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }

  if (!data) {
    throw new ProposalDeliveryAttemptPersistenceError("Insert returned no row");
  }

  return mapRow(data as Record<string, unknown>);
}

export async function markProposalDeliveryAttemptProviderAcceptedWithClient(
  supabase: SupabaseClient,
  input: MarkProposalDeliveryAttemptProviderAcceptedInput,
  now: () => Date = () => new Date()
): Promise<ProposalDeliveryAttemptRow> {
  const lookup = resolveAttemptLookupFilter(input);
  const acceptedAt = now().toISOString();

  const { data, error } = await supabase
    .from(PROPOSAL_DELIVERY_ATTEMPTS_TABLE)
    .update({
      status: "provider_accepted",
      provider_message_id: input.provider_message_id,
      provider_accepted_at: acceptedAt,
      error_code: null,
      error_message_safe: null,
    })
    .eq("company_id", input.company_id)
    .eq(lookup.column, lookup.value)
    .select()
    .single();

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }

  if (!data) {
    throw new ProposalDeliveryAttemptPersistenceError("Update returned no row");
  }

  return mapRow(data as Record<string, unknown>);
}

export async function markProposalDeliveryAttemptFailedWithClient(
  supabase: SupabaseClient,
  input: MarkProposalDeliveryAttemptFailedInput,
  now: () => Date = () => new Date()
): Promise<ProposalDeliveryAttemptRow> {
  const lookup = resolveAttemptLookupFilter(input);
  const failedAt = now().toISOString();

  const { data, error } = await supabase
    .from(PROPOSAL_DELIVERY_ATTEMPTS_TABLE)
    .update({
      status: "failed",
      failed_at: failedAt,
      error_code: input.error_code ?? null,
      error_message_safe: truncateSafeDeliveryErrorMessage(input.error_message_safe),
    })
    .eq("company_id", input.company_id)
    .eq(lookup.column, lookup.value)
    .select()
    .single();

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }

  if (!data) {
    throw new ProposalDeliveryAttemptPersistenceError("Update returned no row");
  }

  return mapRow(data as Record<string, unknown>);
}

export type FindProposalDeliveryAttemptByIdempotencyKeyInput = {
  company_id: string;
  idempotency_key: string;
};

export async function findProposalDeliveryAttemptByIdempotencyKeyWithClient(
  supabase: SupabaseClient,
  input: FindProposalDeliveryAttemptByIdempotencyKeyInput
): Promise<ProposalDeliveryAttemptRow | null> {
  const companyId = input.company_id.trim();
  const idempotencyKey = input.idempotency_key.trim();

  if (!companyId || !idempotencyKey) {
    return null;
  }

  const { data, error } = await supabase
    .from(PROPOSAL_DELIVERY_ATTEMPTS_TABLE)
    .select()
    .eq("company_id", companyId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }

  if (!data) {
    return null;
  }

  return mapRow(data as Record<string, unknown>);
}

export async function listProposalDeliveryAttemptsForProposalWithClient(
  supabase: SupabaseClient,
  input: ListProposalDeliveryAttemptsInput
): Promise<ProposalDeliveryAttemptRow[]> {
  const { data, error } = await supabase
    .from(PROPOSAL_DELIVERY_ATTEMPTS_TABLE)
    .select()
    .eq("company_id", input.company_id)
    .eq("proposal_id", input.proposal_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}
