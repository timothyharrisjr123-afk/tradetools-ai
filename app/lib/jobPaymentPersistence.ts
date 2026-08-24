/**
 * R3E payment RPC persistence. Authenticated contractor RPCs use the user
 * client. Webhook/checkout binding uses service_role.
 */

import { isUuidLike } from "@/app/lib/uuid";
import {
  BIND_JOB_PAYMENT_CHECKOUT_SESSION_RPC_V1,
  CANCEL_JOB_PAYMENT_REQUEST_RPC_V1,
  CREATE_JOB_PAYMENT_REQUEST_RPC_V1,
  ENSURE_COMPANY_PAYMENT_SETTINGS_RPC_V1,
  RECORD_JOB_PAYMENT_PROVIDER_EVENT_RPC_V1,
  RESOLVE_PUBLIC_JOB_PAYMENT_CHECKOUT_RPC_V1,
  UPSERT_COMPANY_PAYMENT_ACCOUNT_FROM_PROVIDER_RPC_V1,
  UPSERT_COMPANY_PAYMENT_SETTINGS_RPC_V1,
  type CompanyPaymentDepositMode,
  type JobPaymentKind,
} from "@/app/lib/jobPaymentTypes";
import type { JobPaymentProviderEventCommand } from "@/app/lib/jobPaymentWebhookMapper";
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
    amountCents: number;
    proposalSignatureId?: string | null;
  }
): Promise<JobPaymentCreateSuccess | JobPaymentRpcFailure> {
  if (!isUuidLike(input.companyId) || !isUuidLike(input.jobId)) {
    return { ok: false, code: "invalid_payload" };
  }
  const record = await rpcJson(supabase, CREATE_JOB_PAYMENT_REQUEST_RPC_V1, {
    p_payload: {
      company_id: input.companyId,
      job_id: input.jobId,
      kind: input.kind,
      amount_cents: input.amountCents,
      proposal_signature_id: input.proposalSignatureId ?? null,
    },
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
  return rpcJson(supabase, RECORD_JOB_PAYMENT_PROVIDER_EVENT_RPC_V1, {
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
