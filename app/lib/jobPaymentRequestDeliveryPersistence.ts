/**
 * Phase 11 — payment-request delivery attempt persistence (injectable client).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type CreatePaymentRequestDeliveryAttemptInput,
  type PaymentRequestDeliveryAttemptRow,
  type PaymentRequestDeliveryAttemptStatus,
} from "@/app/lib/jobPaymentRequestDeliveryTypes";
import {
  ProposalDeliveryAttemptPersistenceError,
  truncateSafeDeliveryErrorMessage,
} from "@/app/lib/proposalDeliveryAttemptPersistence";

export const PAYMENT_REQUEST_DELIVERY_ATTEMPTS_TABLE =
  "job_payment_request_delivery_attempts";

export {
  ProposalDeliveryAttemptPersistenceError as PaymentRequestDeliveryAttemptPersistenceError,
  truncateSafeDeliveryErrorMessage,
};

function mapRow(row: Record<string, unknown>): PaymentRequestDeliveryAttemptRow {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    job_id: String(row.job_id),
    payment_request_id: String(row.payment_request_id),
    channel: "email",
    provider: "resend",
    recipient_email_hash: String(row.recipient_email_hash),
    recipient_email_redacted:
      row.recipient_email_redacted == null
        ? null
        : String(row.recipient_email_redacted),
    contractor_note_snapshot:
      row.contractor_note_snapshot == null
        ? null
        : String(row.contractor_note_snapshot),
    token_prefix: row.token_prefix == null ? null : String(row.token_prefix),
    public_access_token_id:
      row.public_access_token_id == null
        ? null
        : String(row.public_access_token_id),
    idempotency_key: String(row.idempotency_key),
    attempt_number: Number(row.attempt_number),
    status: row.status as PaymentRequestDeliveryAttemptStatus,
    subject_snapshot: String(row.subject_snapshot),
    body_snapshot: String(row.body_snapshot),
    provider_message_id:
      row.provider_message_id == null ? null : String(row.provider_message_id),
    error_code: row.error_code == null ? null : String(row.error_code),
    error_message_safe:
      row.error_message_safe == null ? null : String(row.error_message_safe),
    metadata_json:
      row.metadata_json != null &&
      typeof row.metadata_json === "object" &&
      !Array.isArray(row.metadata_json)
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    created_by: row.created_by == null ? null : String(row.created_by),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    attempted_at: row.attempted_at == null ? null : String(row.attempted_at),
    provider_accepted_at:
      row.provider_accepted_at == null ? null : String(row.provider_accepted_at),
    failed_at: row.failed_at == null ? null : String(row.failed_at),
    delayed_at: row.delayed_at == null ? null : String(row.delayed_at),
    delivered_at: row.delivered_at == null ? null : String(row.delivered_at),
    bounced_at: row.bounced_at == null ? null : String(row.bounced_at),
    complained_at: row.complained_at == null ? null : String(row.complained_at),
  };
}

export async function createPaymentRequestDeliveryAttemptedWithClient(
  supabase: SupabaseClient,
  input: CreatePaymentRequestDeliveryAttemptInput,
  now?: () => Date
): Promise<PaymentRequestDeliveryAttemptRow> {
  const nowIso = (now ?? (() => new Date()))().toISOString();
  const payload = {
    company_id: input.company_id,
    job_id: input.job_id,
    payment_request_id: input.payment_request_id,
    channel: "email",
    provider: "resend",
    recipient_email_hash: input.recipient_email_hash,
    recipient_email_redacted: input.recipient_email_redacted ?? null,
    contractor_note_snapshot: input.contractor_note_snapshot ?? null,
    token_prefix: input.token_prefix ?? null,
    public_access_token_id: input.public_access_token_id ?? null,
    idempotency_key: input.idempotency_key,
    attempt_number: input.attempt_number,
    status: "attempted",
    subject_snapshot: input.subject_snapshot,
    body_snapshot: input.body_snapshot,
    metadata_json: input.metadata_json ?? {},
    created_by: input.created_by ?? null,
    attempted_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from(PAYMENT_REQUEST_DELIVERY_ATTEMPTS_TABLE)
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }
  return mapRow(data as Record<string, unknown>);
}

export async function findPaymentRequestDeliveryAttemptByIdempotencyKeyWithClient(
  supabase: SupabaseClient,
  input: { company_id: string; idempotency_key: string }
): Promise<PaymentRequestDeliveryAttemptRow | null> {
  const { data, error } = await supabase
    .from(PAYMENT_REQUEST_DELIVERY_ATTEMPTS_TABLE)
    .select()
    .eq("company_id", input.company_id)
    .eq("idempotency_key", input.idempotency_key)
    .maybeSingle();

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function findPaymentRequestDeliveryAttemptByProviderMessageIdWithClient(
  supabase: SupabaseClient,
  providerMessageId: string
): Promise<PaymentRequestDeliveryAttemptRow | null> {
  const id = providerMessageId.trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from(PAYMENT_REQUEST_DELIVERY_ATTEMPTS_TABLE)
    .select()
    .eq("provider", "resend")
    .eq("provider_message_id", id)
    .maybeSingle();

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function listPaymentRequestDeliveryAttemptsForRequestWithClient(
  supabase: SupabaseClient,
  input: { company_id: string; payment_request_id: string }
): Promise<PaymentRequestDeliveryAttemptRow[]> {
  const { data, error } = await supabase
    .from(PAYMENT_REQUEST_DELIVERY_ATTEMPTS_TABLE)
    .select()
    .eq("company_id", input.company_id)
    .eq("payment_request_id", input.payment_request_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function countPaymentRequestDeliveryAttemptsWithClient(
  supabase: SupabaseClient,
  input: { company_id: string; payment_request_id: string }
): Promise<number> {
  const { count, error } = await supabase
    .from(PAYMENT_REQUEST_DELIVERY_ATTEMPTS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("company_id", input.company_id)
    .eq("payment_request_id", input.payment_request_id);

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }
  return count ?? 0;
}

export async function markPaymentRequestDeliveryAttemptProviderAcceptedWithClient(
  supabase: SupabaseClient,
  input: {
    company_id: string;
    attempt_id?: string;
    idempotency_key?: string;
    provider_message_id: string;
  },
  now?: () => Date
): Promise<PaymentRequestDeliveryAttemptRow> {
  const nowIso = (now ?? (() => new Date()))().toISOString();
  let query = supabase
    .from(PAYMENT_REQUEST_DELIVERY_ATTEMPTS_TABLE)
    .update({
      status: "provider_accepted",
      provider_message_id: input.provider_message_id,
      provider_accepted_at: nowIso,
      updated_at: nowIso,
      error_code: null,
      error_message_safe: null,
    })
    .eq("company_id", input.company_id);

  if (input.attempt_id) {
    query = query.eq("id", input.attempt_id);
  } else if (input.idempotency_key) {
    query = query.eq("idempotency_key", input.idempotency_key);
  } else {
    throw new ProposalDeliveryAttemptPersistenceError(
      "attempt_id or idempotency_key required",
      "invalid_payload"
    );
  }

  const { data, error } = await query.select().single();
  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }
  return mapRow(data as Record<string, unknown>);
}

export async function markPaymentRequestDeliveryAttemptFailedWithClient(
  supabase: SupabaseClient,
  input: {
    company_id: string;
    attempt_id?: string;
    idempotency_key?: string;
    error_code?: string | null;
    error_message_safe: string;
  },
  now?: () => Date
): Promise<PaymentRequestDeliveryAttemptRow> {
  const nowIso = (now ?? (() => new Date()))().toISOString();
  let query = supabase
    .from(PAYMENT_REQUEST_DELIVERY_ATTEMPTS_TABLE)
    .update({
      status: "failed",
      failed_at: nowIso,
      updated_at: nowIso,
      error_code: input.error_code ?? null,
      error_message_safe: truncateSafeDeliveryErrorMessage(
        input.error_message_safe
      ),
    })
    .eq("company_id", input.company_id);

  if (input.attempt_id) {
    query = query.eq("id", input.attempt_id);
  } else if (input.idempotency_key) {
    query = query.eq("idempotency_key", input.idempotency_key);
  } else {
    throw new ProposalDeliveryAttemptPersistenceError(
      "attempt_id or idempotency_key required",
      "invalid_payload"
    );
  }

  const { data, error } = await query.select().single();
  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }
  return mapRow(data as Record<string, unknown>);
}

export async function applyPaymentRequestDeliveryProviderStatusWithClient(
  supabase: SupabaseClient,
  input: {
    company_id: string;
    attempt_id: string;
    status: PaymentRequestDeliveryAttemptStatus;
    timestampColumn:
      | "delayed_at"
      | "delivered_at"
      | "bounced_at"
      | "failed_at"
      | "complained_at"
      | "provider_accepted_at";
    occurred_at: string;
    error_code?: string | null;
    error_message_safe?: string | null;
  }
): Promise<PaymentRequestDeliveryAttemptRow> {
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: input.occurred_at,
    [input.timestampColumn]: input.occurred_at,
  };
  if (input.error_code !== undefined) patch.error_code = input.error_code;
  if (input.error_message_safe !== undefined) {
    patch.error_message_safe = input.error_message_safe
      ? truncateSafeDeliveryErrorMessage(input.error_message_safe)
      : null;
  }

  const { data, error } = await supabase
    .from(PAYMENT_REQUEST_DELIVERY_ATTEMPTS_TABLE)
    .update(patch)
    .eq("company_id", input.company_id)
    .eq("id", input.attempt_id)
    .select()
    .single();

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }
  return mapRow(data as Record<string, unknown>);
}
