/**
 * D1 — Process one verified Resend webhook into inbox + attempt truth.
 */

import "server-only";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  buildSafeResendEventMetadata,
  extractResendEmailId,
  isResendWebhookEventType,
} from "@/app/lib/proposalDeliveryWebhookNormalize";
import {
  findProposalDeliveryAttemptByProviderMessageIdWithClient,
  insertProposalDeliveryProviderEventWithClient,
  markProviderEventStateWithClient,
  processProviderEventAgainstAttemptWithClient,
  processProviderEventAgainstPaymentAttemptWithClient,
} from "@/app/lib/proposalDeliveryWebhookPersistence";
import { findPaymentRequestDeliveryAttemptByProviderMessageIdWithClient } from "@/app/lib/jobPaymentRequestDeliveryPersistence";
import type { VerifiedResendWebhookPayload } from "@/app/lib/proposalDeliveryWebhookVerify";

export type ProcessResendWebhookResult = {
  ok: true;
  duplicate: boolean;
  apply_state: string;
  apply_detail: string;
  matched: boolean;
};

export async function processVerifiedResendWebhookEvent(input: {
  svixId: string;
  payload: VerifiedResendWebhookPayload;
  getSupabase?: () => ReturnType<typeof createAdminClient>;
  now?: () => Date;
}): Promise<ProcessResendWebhookResult> {
  const supabase = input.getSupabase?.() ?? createAdminClient();
  const nowIso = (input.now ?? (() => new Date()))().toISOString();
  const eventType = input.payload.type;

  if (!isResendWebhookEventType(eventType)) {
    // Authenticated but unsupported type — acknowledge without attaching.
    return {
      ok: true,
      duplicate: false,
      apply_state: "ignored",
      apply_detail: "unsupported_event_type",
      matched: false,
    };
  }

  const data =
    input.payload.data && typeof input.payload.data === "object"
      ? input.payload.data
      : {};
  const providerEmailId = extractResendEmailId(data);
  if (!providerEmailId) {
    return {
      ok: true,
      duplicate: false,
      apply_state: "ignored",
      apply_detail: "missing_email_id",
      matched: false,
    };
  }

  const providerCreatedAt =
    typeof input.payload.created_at === "string"
      ? input.payload.created_at
      : typeof data.created_at === "string"
        ? data.created_at
        : null;

  const inserted = await insertProposalDeliveryProviderEventWithClient(supabase, {
    svix_id: input.svixId,
    provider_email_id: providerEmailId,
    event_type: eventType,
    provider_created_at: providerCreatedAt,
    safe_metadata: buildSafeResendEventMetadata(data),
  });

  if (inserted.duplicate) {
    await markProviderEventStateWithClient(supabase, {
      event_id: inserted.row.id,
      apply_state: "duplicate",
      apply_detail: "svix_id_replay",
    });
    return {
      ok: true,
      duplicate: true,
      apply_state: "duplicate",
      apply_detail: "svix_id_replay",
      matched: Boolean(inserted.row.delivery_attempt_id),
    };
  }

  const attempt = await findProposalDeliveryAttemptByProviderMessageIdWithClient(
    supabase,
    providerEmailId
  );

  if (attempt) {
    const processed = await processProviderEventAgainstAttemptWithClient(supabase, {
      event: inserted.row,
      attempt,
      nowIso,
    });

    return {
      ok: true,
      duplicate: false,
      apply_state: processed.apply_state,
      apply_detail: processed.apply_detail,
      matched: Boolean(processed.attempt),
    };
  }

  // Phase 11 — same Resend inbox may correlate to payment-request delivery.
  const paymentAttempt =
    await findPaymentRequestDeliveryAttemptByProviderMessageIdWithClient(
      supabase,
      providerEmailId
    );

  if (!paymentAttempt) {
    await markProviderEventStateWithClient(supabase, {
      event_id: inserted.row.id,
      apply_state: "unresolved",
      apply_detail: "no_matching_attempt",
    });
    return {
      ok: true,
      duplicate: false,
      apply_state: "unresolved",
      apply_detail: "no_matching_attempt",
      matched: false,
    };
  }

  const processedPayment = await processProviderEventAgainstPaymentAttemptWithClient(
    supabase,
    { event: inserted.row, attempt: paymentAttempt, nowIso }
  );

  return {
    ok: true,
    duplicate: false,
    apply_state: processedPayment.apply_state,
    apply_detail: "payment_request_delivery_attempt",
    matched: true,
  };
}
