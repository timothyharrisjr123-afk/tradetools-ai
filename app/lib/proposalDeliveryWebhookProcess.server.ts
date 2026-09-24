/**
 * D1 — Process one verified Resend webhook into inbox + attempt truth.
 */

import "server-only";

import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  buildSafeResendEventMetadata,
  extractResendEmailId,
  isResendWebhookEventType,
  mapResendEventToTargetStatus,
  resolveDeliveryStatusApplyDecision,
  timestampColumnForDeliveryStatus,
} from "@/app/lib/proposalDeliveryWebhookNormalize";
import {
  findProposalDeliveryAttemptByProviderMessageIdWithClient,
  insertProposalDeliveryProviderEventWithClient,
  markProviderEventStateWithClient,
  processProviderEventAgainstAttemptWithClient,
} from "@/app/lib/proposalDeliveryWebhookPersistence";
import {
  applyPaymentRequestDeliveryProviderStatusWithClient,
  findPaymentRequestDeliveryAttemptByProviderMessageIdWithClient,
} from "@/app/lib/jobPaymentRequestDeliveryPersistence";
import type { VerifiedResendWebhookPayload } from "@/app/lib/proposalDeliveryWebhookVerify";
import type { PaymentRequestDeliveryAttemptStatus } from "@/app/lib/jobPaymentRequestDeliveryTypes";
import type { ProposalDeliveryAttemptStatus } from "@/app/lib/proposalDeliveryAttemptTypes";

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

  const target = mapResendEventToTargetStatus(eventType) as ProposalDeliveryAttemptStatus;
  const decision = resolveDeliveryStatusApplyDecision(
    paymentAttempt.status as ProposalDeliveryAttemptStatus,
    target
  );
  const tsCol = timestampColumnForDeliveryStatus(target);

  if (decision === "apply" && tsCol) {
    await applyPaymentRequestDeliveryProviderStatusWithClient(supabase, {
      company_id: paymentAttempt.company_id,
      attempt_id: paymentAttempt.id,
      status: target as PaymentRequestDeliveryAttemptStatus,
      timestampColumn: tsCol as
        | "delayed_at"
        | "delivered_at"
        | "bounced_at"
        | "failed_at"
        | "complained_at"
        | "provider_accepted_at",
      occurred_at: providerCreatedAt ?? nowIso,
    });
  }

  await markProviderEventStateWithClient(supabase, {
    event_id: inserted.row.id,
    apply_state: decision === "apply" ? "applied" : "ignored",
    apply_detail:
      decision === "apply" ? "payment_request_delivery_attempt" : `payment_${decision}`,
    delivery_attempt_id: null,
    company_id: paymentAttempt.company_id,
    payment_request_delivery_attempt_id: paymentAttempt.id,
    applied_at: nowIso,
  });

  return {
    ok: true,
    duplicate: false,
    apply_state: decision === "apply" ? "applied" : "ignored",
    apply_detail: "payment_request_delivery_attempt",
    matched: true,
  };
}
