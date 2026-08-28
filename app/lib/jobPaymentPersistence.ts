/**
 * R3E payment RPC persistence. Authenticated contractor RPCs use the user
 * client. Webhook/checkout binding uses service_role.
 */

import { isUuidLike } from "@/app/lib/uuid";
import {
  BIND_JOB_PAYMENT_CHECKOUT_SESSION_RPC_V1,
  CANCEL_JOB_PAYMENT_REQUEST_RPC_V1,
  COLLECT_JOB_PAYMENT_RPC_V1,
  CREATE_JOB_PAYMENT_REQUEST_RPC_V1,
  ENSURE_COMPANY_PAYMENT_SETTINGS_RPC_V1,
  RECONCILE_JOB_PAYMENT_REFUND_RESULT_RPC_V1,
  RECORD_JOB_PAYMENT_REFUND_EVENT_RPC_V1,
  RECORD_JOB_PAYMENT_PROVIDER_EVENT_RPC_V1,
  RESERVE_JOB_PAYMENT_REFUND_RPC_V1,
  RESOLVE_PUBLIC_JOB_PAYMENT_CHECKOUT_RPC_V1,
  SET_JOB_PAYMENT_SETTLED_METHOD_RPC_V1,
  UPSERT_COMPANY_PAYMENT_ACCOUNT_FROM_PROVIDER_RPC_V1,
  UPSERT_COMPANY_PAYMENT_SETTINGS_RPC_V1,
  type CollectAmountMode,
  type CompanyPaymentDepositMode,
  type JobPaymentKind,
  type JobPaymentRefundCorrelationMethod,
  type JobPaymentRefundDisposition,
  type JobPaymentRefundStatus,
} from "@/app/lib/jobPaymentTypes";
import type {
  JobPaymentProviderEventCommand,
  JobPaymentRefundEventCommand,
} from "@/app/lib/jobPaymentWebhookMapper";
import type { SupabaseClient } from "@supabase/supabase-js";

export class JobPaymentPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobPaymentPersistenceError";
  }
}

export type JobPaymentRpcFailure = { ok: false; code: string; attention_id?: string | null };
export type JobPaymentCreateSuccess = {
  ok: true;
  id: string;
  company_id: string;
  job_id: string;
  kind: JobPaymentKind;
  status: string;
  amount_cents: number;
  currency: string;
  proposal_signature_id: string | null;
  accepted_total_cents_snapshot: number;
  option_label_snapshot: string;
  requested_at: string;
  idempotent_replay: boolean;
  job_stage: string | null;
  stage_entered_at: string | null;
  job_stage_unchanged: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function asRefundStatus(value: unknown): JobPaymentRefundStatus | null {
  return typeof value === "string" &&
    ["initiating", "pending", "requires_action", "succeeded", "failed", "canceled"].includes(value)
    ? (value as JobPaymentRefundStatus)
    : null;
}

function asRefundDisposition(value: unknown): JobPaymentRefundDisposition | null {
  return typeof value === "string" &&
    ["applied", "stale", "unbound", "identity_mismatch", "overrefund_conflict", "unsupported"].includes(
      value
    )
    ? (value as JobPaymentRefundDisposition)
    : null;
}

function asRefundCorrelation(value: unknown): JobPaymentRefundCorrelationMethod | null {
  return typeof value === "string" &&
    ["provider_refund_id", "metadata_command_id", "payment_intent", "charge", "none"].includes(
      value
    )
    ? (value as JobPaymentRefundCorrelationMethod)
    : null;
}

export type JobPaymentRefundRpcFailure = {
  ok: false;
  code: string;
  refundable_cents?: number;
  succeeded_refund_cents?: number;
  inflight_refund_cents?: number;
};

export type JobPaymentRefundReservationSuccess = {
  ok: true;
  id: string;
  status: JobPaymentRefundStatus;
  amount_cents: number;
  currency: "usd";
  provider_account_id: string;
  provider_payment_intent_id: string;
  provider_charge_id: string | null;
  provider_refund_id: string | null;
  idempotent_replay: boolean;
  job_stage_unchanged: true;
};

export type JobPaymentRefundReconcileSuccess = {
  ok: true;
  id: string;
  status: JobPaymentRefundStatus;
  provider_refund_id: string | null;
  job_stage_unchanged: true;
};

export type JobPaymentRefundEventSuccess = {
  ok: true;
  idempotent_replay: boolean;
  receipt_id: string;
  refund_id: string | null;
  status: JobPaymentRefundStatus | null;
  disposition: JobPaymentRefundDisposition;
  correlation_method?: JobPaymentRefundCorrelationMethod;
  job_stage_unchanged?: true | null;
};

function refundFailure(record: Record<string, unknown>): JobPaymentRefundRpcFailure {
  return {
    ok: false,
    code: asString(record.code) ?? "invalid_payload",
    ...(asInteger(record.refundable_cents) != null
      ? { refundable_cents: asInteger(record.refundable_cents)! }
      : {}),
    ...(asInteger(record.succeeded_refund_cents) != null
      ? { succeeded_refund_cents: asInteger(record.succeeded_refund_cents)! }
      : {}),
    ...(asInteger(record.inflight_refund_cents) != null
      ? { inflight_refund_cents: asInteger(record.inflight_refund_cents)! }
      : {}),
  };
}

async function rpcJson(
  supabase: SupabaseClient,
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    throw new JobPaymentPersistenceError(error.message ?? `${name} failed.`);
  }
  const record = asRecord(data);
  if (!record) {
    throw new JobPaymentPersistenceError(`${name} returned an invalid payload.`);
  }
  return record;
}

export async function createJobPaymentRequestViaRpc(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    jobId: string;
    kind: JobPaymentKind;
    amountCents?: number | null;
    proposalSignatureId?: string | null;
  }
): Promise<JobPaymentCreateSuccess | JobPaymentRpcFailure> {
  if (!isUuidLike(input.companyId) || !isUuidLike(input.jobId)) {
    return { ok: false, code: "invalid_payload" };
  }
  if (input.kind === "deposit") {
    return { ok: false, code: "deposit_not_generic" };
  }
  const payload: Record<string, unknown> = {
    company_id: input.companyId,
    job_id: input.jobId,
    kind: input.kind,
    proposal_signature_id: input.proposalSignatureId ?? null,
  };
  const record = await rpcJson(supabase, CREATE_JOB_PAYMENT_REQUEST_RPC_V1, {
    p_payload: payload,
  });
  if (record.ok !== true) {
    return {
      ok: false,
      code: asString(record.code) ?? "invalid_payload",
      attention_id: asString(record.attention_id),
    };
  }
  return record as unknown as JobPaymentCreateSuccess;
}

export async function collectJobRemainingBalanceViaRpc(
  supabase: SupabaseClient,
  input: { companyId: string; jobId: string }
): Promise<JobPaymentCreateSuccess | JobPaymentRpcFailure> {
  return createJobPaymentRequestViaRpc(supabase, {
    companyId: input.companyId,
    jobId: input.jobId,
    kind: "balance",
  });
}

export async function collectJobPaymentViaRpc(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    jobId: string;
    amountMode: CollectAmountMode;
    percentageBps?: number | null;
    amountCents?: number | null;
  }
): Promise<JobPaymentCreateSuccess | JobPaymentRpcFailure> {
  if (!isUuidLike(input.companyId) || !isUuidLike(input.jobId)) {
    return { ok: false, code: "invalid_payload" };
  }
  const payload: Record<string, unknown> = {
    company_id: input.companyId,
    job_id: input.jobId,
    amount_mode: input.amountMode,
  };
  if (input.amountMode === "percentage") {
    payload.percentage_bps = input.percentageBps;
  }
  if (input.amountMode === "fixed") {
    payload.amount_cents = input.amountCents;
  }
  const record = await rpcJson(supabase, COLLECT_JOB_PAYMENT_RPC_V1, {
    p_payload: payload,
  });
  if (record.ok !== true) {
    return {
      ok: false,
      code: asString(record.code) ?? "invalid_payload",
      attention_id: asString(record.attention_id),
    };
  }
  return record as unknown as JobPaymentCreateSuccess;
}

export async function cancelJobPaymentRequestViaRpc(
  supabase: SupabaseClient,
  input: { companyId: string; paymentRequestId: string }
): Promise<Record<string, unknown>> {
  return rpcJson(supabase, CANCEL_JOB_PAYMENT_REQUEST_RPC_V1, {
    p_payload: {
      company_id: input.companyId,
      payment_request_id: input.paymentRequestId,
    },
  });
}

export async function ensureCompanyPaymentSettingsViaRpc(
  supabase: SupabaseClient,
  companyId: string
): Promise<Record<string, unknown>> {
  return rpcJson(supabase, ENSURE_COMPANY_PAYMENT_SETTINGS_RPC_V1, {
    p_company_id: companyId,
  });
}

export async function upsertCompanyPaymentSettingsViaRpc(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    mode: CompanyPaymentDepositMode;
    percentBps: number | null;
    fixedCents: number | null;
  }
): Promise<Record<string, unknown>> {
  return rpcJson(supabase, UPSERT_COMPANY_PAYMENT_SETTINGS_RPC_V1, {
    p_payload: {
      company_id: input.companyId,
      default_deposit_mode: input.mode,
      default_deposit_percent_bps: input.percentBps,
      default_deposit_fixed_cents: input.fixedCents,
    },
  });
}

export async function bindJobPaymentCheckoutSessionViaRpc(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    paymentRequestId: string;
    checkoutSessionId: string;
    checkoutGeneration: number;
    expiresAt?: string | null;
    providerAccountId: string;
  }
): Promise<Record<string, unknown>> {
  return rpcJson(supabase, BIND_JOB_PAYMENT_CHECKOUT_SESSION_RPC_V1, {
    p_payload: {
      company_id: input.companyId,
      payment_request_id: input.paymentRequestId,
      provider_checkout_session_id: input.checkoutSessionId,
      checkout_generation: input.checkoutGeneration,
      expires_at: input.expiresAt ?? null,
      provider_account_id: input.providerAccountId,
    },
  });
}

export async function resolvePublicJobPaymentCheckoutViaRpc(
  supabase: SupabaseClient,
  tokenHash: string
): Promise<Record<string, unknown>> {
  return rpcJson(supabase, RESOLVE_PUBLIC_JOB_PAYMENT_CHECKOUT_RPC_V1, {
    p_token_hash: tokenHash,
  });
}

export async function recordJobPaymentProviderEventViaRpc(
  supabase: SupabaseClient,
  command: JobPaymentProviderEventCommand
): Promise<Record<string, unknown>> {
  const recorded = await rpcJson(supabase, RECORD_JOB_PAYMENT_PROVIDER_EVENT_RPC_V1, {
    p_payload: {
      provider_event_id: command.provider_event_id,
      raw_type: command.raw_type,
      occurred_at: command.occurred_at,
      payment_request_id: command.payment_request_id,
      provider_checkout_session_id: command.provider_checkout_session_id,
      provider_account_id: command.provider_account_id,
      provider_payment_intent_id: command.provider_payment_intent_id,
      provider_charge_id: command.provider_charge_id,
      amount_cents: command.amount_cents,
      transaction_kind: command.transaction_kind,
      transaction_status: command.transaction_status,
      apply_request_status: command.apply_request_status,
    },
  });
  if (
    command.payment_method_label &&
    command.payment_request_id &&
    isUuidLike(command.payment_request_id)
  ) {
    await rpcJson(supabase, SET_JOB_PAYMENT_SETTLED_METHOD_RPC_V1, {
      p_payload: {
        payment_request_id: command.payment_request_id,
        label: command.payment_method_label,
      },
    });
  }
  return recorded;
}

export async function reserveJobPaymentRefundViaRpc(
  supabase: SupabaseClient,
  input: {
    id: string;
    companyId: string;
    jobId: string;
    paymentRequestId: string;
    canonicalCaptureTransactionId: string;
    amountCents: number;
    internalReason: string | null;
    idempotencyKey: string;
  }
): Promise<JobPaymentRefundReservationSuccess | JobPaymentRefundRpcFailure> {
  if (
    !isUuidLike(input.id) ||
    !isUuidLike(input.companyId) ||
    !isUuidLike(input.jobId) ||
    !isUuidLike(input.paymentRequestId) ||
    !isUuidLike(input.canonicalCaptureTransactionId) ||
    !Number.isSafeInteger(input.amountCents) ||
    input.amountCents < 1
  ) {
    return { ok: false, code: "invalid_payload" };
  }
  const record = await rpcJson(supabase, RESERVE_JOB_PAYMENT_REFUND_RPC_V1, {
    p_payload: {
      id: input.id,
      company_id: input.companyId,
      job_id: input.jobId,
      payment_request_id: input.paymentRequestId,
      canonical_capture_transaction_id: input.canonicalCaptureTransactionId,
      amount_cents: input.amountCents,
      internal_reason: input.internalReason,
      idempotency_key: input.idempotencyKey,
    },
  });
  if (record.ok !== true) return refundFailure(record);

  const status = asRefundStatus(record.status);
  const amount = asInteger(record.amount_cents);
  const id = asString(record.id);
  const account = asString(record.provider_account_id);
  const paymentIntent = asString(record.provider_payment_intent_id);
  if (
    !status ||
    amount == null ||
    !id ||
    !account ||
    !paymentIntent ||
    record.currency !== "usd" ||
    typeof record.idempotent_replay !== "boolean" ||
    record.job_stage_unchanged !== true
  ) {
    throw new JobPaymentPersistenceError(
      `${RESERVE_JOB_PAYMENT_REFUND_RPC_V1} returned an invalid success payload.`
    );
  }
  return {
    ok: true,
    id,
    status,
    amount_cents: amount,
    currency: "usd",
    provider_account_id: account,
    provider_payment_intent_id: paymentIntent,
    provider_charge_id: asString(record.provider_charge_id),
    provider_refund_id: asString(record.provider_refund_id),
    idempotent_replay: record.idempotent_replay === true,
    job_stage_unchanged: true,
  };
}

export async function reconcileJobPaymentRefundResultViaRpc(
  supabase: SupabaseClient,
  input: {
    id: string;
    providerAccountId: string;
    providerRefundId: string | null;
    providerChargeId: string | null;
    status: Exclude<JobPaymentRefundStatus, "initiating">;
    providerReasonCode?: string | null;
    providerReasonMessage?: string | null;
    providerCreatedAt?: string | null;
    providerUpdatedAt?: string | null;
  }
): Promise<JobPaymentRefundReconcileSuccess | JobPaymentRefundRpcFailure> {
  const record = await rpcJson(supabase, RECONCILE_JOB_PAYMENT_REFUND_RESULT_RPC_V1, {
    p_payload: {
      id: input.id,
      provider_account_id: input.providerAccountId,
      provider_refund_id: input.providerRefundId,
      provider_charge_id: input.providerChargeId,
      status: input.status,
      provider_reason_code: input.providerReasonCode ?? null,
      provider_reason_message: input.providerReasonMessage ?? null,
      provider_created_at: input.providerCreatedAt ?? null,
      provider_updated_at: input.providerUpdatedAt ?? null,
    },
  });
  if (record.ok !== true) return refundFailure(record);
  const id = asString(record.id);
  const status = asRefundStatus(record.status);
  if (!id || !status || record.job_stage_unchanged !== true) {
    throw new JobPaymentPersistenceError(
      `${RECONCILE_JOB_PAYMENT_REFUND_RESULT_RPC_V1} returned an invalid success payload.`
    );
  }
  return {
    ok: true,
    id,
    status,
    provider_refund_id: asString(record.provider_refund_id),
    job_stage_unchanged: true,
  };
}

export async function recordJobPaymentRefundEventViaRpc(
  supabase: SupabaseClient,
  command: JobPaymentRefundEventCommand
): Promise<JobPaymentRefundEventSuccess | JobPaymentRefundRpcFailure> {
  const record = await rpcJson(supabase, RECORD_JOB_PAYMENT_REFUND_EVENT_RPC_V1, {
    p_payload: {
      provider_event_id: command.provider_event_id,
      raw_type: command.raw_type,
      provider_event_created_at: command.provider_event_created_at,
      provider_account_id: command.provider_account_id,
      provider_refund_id: command.provider_refund_id,
      metadata_refund_command_id: command.metadata_refund_command_id,
      provider_payment_intent_id: command.provider_payment_intent_id,
      provider_charge_id: command.provider_charge_id,
      amount_cents: command.amount_cents,
      status: command.status,
      provider_reason_code: command.provider_reason_code,
      provider_reason_message: command.provider_reason_message,
      provider_created_at: command.provider_created_at,
    },
  });
  if (record.ok !== true) return refundFailure(record);
  const receiptId = asString(record.receipt_id);
  const disposition = asRefundDisposition(record.disposition);
  const correlation = asRefundCorrelation(record.correlation_method);
  if (!receiptId || !disposition) {
    throw new JobPaymentPersistenceError(
      `${RECORD_JOB_PAYMENT_REFUND_EVENT_RPC_V1} returned an invalid success payload.`
    );
  }
  return {
    ok: true,
    idempotent_replay: record.idempotent_replay === true,
    receipt_id: receiptId,
    refund_id: asString(record.refund_id),
    status: asRefundStatus(record.status),
    disposition,
    correlation_method: correlation ?? undefined,
    job_stage_unchanged:
      record.job_stage_unchanged === true ? true : record.job_stage_unchanged === null ? null : undefined,
  };
}

export async function upsertCompanyPaymentAccountFromProviderViaRpc(
  supabase: SupabaseClient,
  input: {
    companyId: string | null;
    providerAccountId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    disabled: boolean;
  }
): Promise<Record<string, unknown>> {
  return rpcJson(supabase, UPSERT_COMPANY_PAYMENT_ACCOUNT_FROM_PROVIDER_RPC_V1, {
    p_payload: {
      company_id: input.companyId,
      provider_account_id: input.providerAccountId,
      charges_enabled: input.chargesEnabled,
      payouts_enabled: input.payoutsEnabled,
      details_submitted: input.detailsSubmitted,
      disabled: input.disabled,
    },
  });
}
