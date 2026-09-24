/**
 * Phase 11 — server-only payment-request delivery store.
 */

import "server-only";

import {
  applyPaymentRequestDeliveryProviderStatusWithClient,
  countPaymentRequestDeliveryAttemptsWithClient,
  createPaymentRequestDeliveryAttemptedWithClient,
  findPaymentRequestDeliveryAttemptByIdempotencyKeyWithClient,
  findPaymentRequestDeliveryAttemptByProviderMessageIdWithClient,
  listPaymentRequestDeliveryAttemptsForRequestWithClient,
  markPaymentRequestDeliveryAttemptFailedWithClient,
  markPaymentRequestDeliveryAttemptProviderAcceptedWithClient,
} from "@/app/lib/jobPaymentRequestDeliveryPersistence";
import type {
  CreatePaymentRequestDeliveryAttemptInput,
  PaymentRequestDeliveryAttemptRow,
  PaymentRequestDeliveryAttemptStatus,
} from "@/app/lib/jobPaymentRequestDeliveryTypes";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type PaymentRequestDeliveryStoreDeps = {
  getSupabase?: () => ReturnType<typeof createAdminClient>;
  now?: () => Date;
};

function resolveSupabase(deps?: PaymentRequestDeliveryStoreDeps) {
  return deps?.getSupabase?.() ?? createAdminClient();
}

export async function createPaymentRequestDeliveryAttempted(
  input: CreatePaymentRequestDeliveryAttemptInput,
  deps?: PaymentRequestDeliveryStoreDeps
): Promise<PaymentRequestDeliveryAttemptRow> {
  return createPaymentRequestDeliveryAttemptedWithClient(
    resolveSupabase(deps),
    input,
    deps?.now
  );
}

export async function findPaymentRequestDeliveryAttemptByIdempotencyKey(
  input: { company_id: string; idempotency_key: string },
  deps?: PaymentRequestDeliveryStoreDeps
): Promise<PaymentRequestDeliveryAttemptRow | null> {
  return findPaymentRequestDeliveryAttemptByIdempotencyKeyWithClient(
    resolveSupabase(deps),
    input
  );
}

export async function findPaymentRequestDeliveryAttemptByProviderMessageId(
  providerMessageId: string,
  deps?: PaymentRequestDeliveryStoreDeps
): Promise<PaymentRequestDeliveryAttemptRow | null> {
  return findPaymentRequestDeliveryAttemptByProviderMessageIdWithClient(
    resolveSupabase(deps),
    providerMessageId
  );
}

export async function listPaymentRequestDeliveryAttemptsForRequest(
  input: { company_id: string; payment_request_id: string },
  deps?: PaymentRequestDeliveryStoreDeps
): Promise<PaymentRequestDeliveryAttemptRow[]> {
  return listPaymentRequestDeliveryAttemptsForRequestWithClient(
    resolveSupabase(deps),
    input
  );
}

export async function countPaymentRequestDeliveryAttempts(
  input: { company_id: string; payment_request_id: string },
  deps?: PaymentRequestDeliveryStoreDeps
): Promise<number> {
  return countPaymentRequestDeliveryAttemptsWithClient(
    resolveSupabase(deps),
    input
  );
}

export async function markPaymentRequestDeliveryAttemptProviderAccepted(
  input: {
    company_id: string;
    attempt_id?: string;
    idempotency_key?: string;
    provider_message_id: string;
  },
  deps?: PaymentRequestDeliveryStoreDeps
): Promise<PaymentRequestDeliveryAttemptRow> {
  return markPaymentRequestDeliveryAttemptProviderAcceptedWithClient(
    resolveSupabase(deps),
    input,
    deps?.now
  );
}

export async function markPaymentRequestDeliveryAttemptFailed(
  input: {
    company_id: string;
    attempt_id?: string;
    idempotency_key?: string;
    error_code?: string | null;
    error_message_safe: string;
  },
  deps?: PaymentRequestDeliveryStoreDeps
): Promise<PaymentRequestDeliveryAttemptRow> {
  return markPaymentRequestDeliveryAttemptFailedWithClient(
    resolveSupabase(deps),
    input,
    deps?.now
  );
}

export async function applyPaymentRequestDeliveryProviderStatus(
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
  },
  deps?: PaymentRequestDeliveryStoreDeps
): Promise<PaymentRequestDeliveryAttemptRow> {
  return applyPaymentRequestDeliveryProviderStatusWithClient(
    resolveSupabase(deps),
    input
  );
}
