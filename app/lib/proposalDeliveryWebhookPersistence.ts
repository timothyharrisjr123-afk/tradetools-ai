/**
 * D1 — Provider event inbox + attempt correlation persistence.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PROPOSAL_DELIVERY_ATTEMPTS_TABLE,
  ProposalDeliveryAttemptPersistenceError,
  truncateSafeDeliveryErrorMessage,
} from "@/app/lib/proposalDeliveryAttemptPersistence";
import type {
  ProposalDeliveryAttemptRow,
  ProposalDeliveryAttemptStatus,
} from "@/app/lib/proposalDeliveryAttemptTypes";
import {
  mapResendEventToTargetStatus,
  resolveDeliveryStatusApplyDecision,
  timestampColumnForDeliveryStatus,
  type DeliveryProviderApplyState,
  type ResendWebhookEventType,
} from "@/app/lib/proposalDeliveryWebhookNormalize";

export const PROPOSAL_DELIVERY_PROVIDER_EVENTS_TABLE =
  "proposal_delivery_provider_events";

export type ProposalDeliveryProviderEventRow = {
  id: string;
  svix_id: string;
  provider: "resend";
  provider_email_id: string;
  event_type: ResendWebhookEventType;
  provider_created_at: string | null;
  delivery_attempt_id: string | null;
  company_id: string | null;
  apply_state: DeliveryProviderApplyState;
  apply_detail: string | null;
  safe_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
};

function mapAttemptRow(row: Record<string, unknown>): ProposalDeliveryAttemptRow {
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
    status: row.status as ProposalDeliveryAttemptStatus,
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
    delivered_at: row.delivered_at == null ? null : String(row.delivered_at),
    bounced_at: row.bounced_at == null ? null : String(row.bounced_at),
    complained_at: row.complained_at == null ? null : String(row.complained_at),
    delayed_at: row.delayed_at == null ? null : String(row.delayed_at),
  };
}

function mapEventRow(row: Record<string, unknown>): ProposalDeliveryProviderEventRow {
  return {
    id: String(row.id),
    svix_id: String(row.svix_id),
    provider: "resend",
    provider_email_id: String(row.provider_email_id),
    event_type: row.event_type as ResendWebhookEventType,
    provider_created_at:
      row.provider_created_at == null ? null : String(row.provider_created_at),
    delivery_attempt_id:
      row.delivery_attempt_id == null ? null : String(row.delivery_attempt_id),
    company_id: row.company_id == null ? null : String(row.company_id),
    apply_state: row.apply_state as DeliveryProviderApplyState,
    apply_detail: row.apply_detail == null ? null : String(row.apply_detail),
    safe_metadata:
      row.safe_metadata != null &&
      typeof row.safe_metadata === "object" &&
      !Array.isArray(row.safe_metadata)
        ? (row.safe_metadata as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    applied_at: row.applied_at == null ? null : String(row.applied_at),
  };
}

export async function findProposalDeliveryAttemptByProviderMessageIdWithClient(
  supabase: SupabaseClient,
  providerMessageId: string
): Promise<ProposalDeliveryAttemptRow | null> {
  const id = providerMessageId.trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from(PROPOSAL_DELIVERY_ATTEMPTS_TABLE)
    .select()
    .eq("provider", "resend")
    .eq("provider_message_id", id)
    .maybeSingle();

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }
  if (!data) return null;
  return mapAttemptRow(data as Record<string, unknown>);
}

export async function insertProposalDeliveryProviderEventWithClient(
  supabase: SupabaseClient,
  input: {
    svix_id: string;
    provider_email_id: string;
    event_type: ResendWebhookEventType;
    provider_created_at?: string | null;
    safe_metadata?: Record<string, unknown>;
  }
): Promise<{ row: ProposalDeliveryProviderEventRow; duplicate: boolean }> {
  const payload = {
    svix_id: input.svix_id.trim(),
    provider: "resend",
    provider_email_id: input.provider_email_id.trim(),
    event_type: input.event_type,
    provider_created_at: input.provider_created_at ?? null,
    safe_metadata: input.safe_metadata ?? {},
    apply_state: "received",
  };

  const { data, error } = await supabase
    .from(PROPOSAL_DELIVERY_PROVIDER_EVENTS_TABLE)
    .insert(payload)
    .select()
    .single();

  if (error) {
    // unique svix_id → duplicate
    if (error.code === "23505") {
      const existing = await supabase
        .from(PROPOSAL_DELIVERY_PROVIDER_EVENTS_TABLE)
        .select()
        .eq("svix_id", payload.svix_id)
        .maybeSingle();
      if (existing.data) {
        return {
          row: mapEventRow(existing.data as Record<string, unknown>),
          duplicate: true,
        };
      }
    }
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }

  return {
    row: mapEventRow(data as Record<string, unknown>),
    duplicate: false,
  };
}

export async function markProviderEventStateWithClient(
  supabase: SupabaseClient,
  input: {
    event_id: string;
    apply_state: DeliveryProviderApplyState;
    apply_detail?: string | null;
    delivery_attempt_id?: string | null;
    company_id?: string | null;
    applied_at?: string | null;
  }
): Promise<ProposalDeliveryProviderEventRow> {
  const patch: Record<string, unknown> = {
    apply_state: input.apply_state,
    apply_detail: input.apply_detail ?? null,
  };
  if (input.delivery_attempt_id !== undefined) {
    patch.delivery_attempt_id = input.delivery_attempt_id;
  }
  if (input.company_id !== undefined) {
    patch.company_id = input.company_id;
  }
  if (input.applied_at !== undefined) {
    patch.applied_at = input.applied_at;
  }

  const { data, error } = await supabase
    .from(PROPOSAL_DELIVERY_PROVIDER_EVENTS_TABLE)
    .update(patch)
    .eq("id", input.event_id)
    .select()
    .single();

  if (error || !data) {
    throw new ProposalDeliveryAttemptPersistenceError(
      error?.message ?? "event update failed",
      error?.code
    );
  }
  return mapEventRow(data as Record<string, unknown>);
}

export async function listUnresolvedProviderEventsForEmailIdWithClient(
  supabase: SupabaseClient,
  providerEmailId: string
): Promise<ProposalDeliveryProviderEventRow[]> {
  const { data, error } = await supabase
    .from(PROPOSAL_DELIVERY_PROVIDER_EVENTS_TABLE)
    .select()
    .eq("provider", "resend")
    .eq("provider_email_id", providerEmailId.trim())
    .eq("apply_state", "unresolved")
    .order("created_at", { ascending: true });

  if (error) {
    throw new ProposalDeliveryAttemptPersistenceError(error.message, error.code);
  }
  return (data ?? []).map((row) => mapEventRow(row as Record<string, unknown>));
}

export async function applyNormalizedStatusToAttemptWithClient(
  supabase: SupabaseClient,
  input: {
    attempt: ProposalDeliveryAttemptRow;
    target: ProposalDeliveryAttemptStatus;
    at: string;
    error_code?: string | null;
    error_message_safe?: string | null;
  }
): Promise<{
  decision: "apply" | "noop" | "ignore";
  attempt: ProposalDeliveryAttemptRow;
}> {
  const decision = resolveDeliveryStatusApplyDecision(input.attempt.status, input.target);
  if (decision !== "apply") {
    return { decision, attempt: input.attempt };
  }

  const tsCol = timestampColumnForDeliveryStatus(input.target);
  const patch: Record<string, unknown> = {
    status: input.target,
  };
  if (tsCol) {
    patch[tsCol] = input.at;
  }
  if (input.target === "failed" || input.target === "bounced") {
    if (input.error_code) patch.error_code = input.error_code;
    if (input.error_message_safe) {
      patch.error_message_safe = truncateSafeDeliveryErrorMessage(
        input.error_message_safe
      );
    }
  }

  const { data, error } = await supabase
    .from(PROPOSAL_DELIVERY_ATTEMPTS_TABLE)
    .update(patch)
    .eq("id", input.attempt.id)
    .eq("company_id", input.attempt.company_id)
    .select()
    .single();

  if (error || !data) {
    // Transition rejected by DB guard → treat as ignore (out-of-order)
    if (error?.message?.includes("invalid proposal_delivery_attempts status transition")) {
      return { decision: "ignore", attempt: input.attempt };
    }
    throw new ProposalDeliveryAttemptPersistenceError(
      error?.message ?? "attempt status update failed",
      error?.code
    );
  }

  return {
    decision: "apply",
    attempt: mapAttemptRow(data as Record<string, unknown>),
  };
}

export async function processProviderEventAgainstAttemptWithClient(
  supabase: SupabaseClient,
  input: {
    event: ProposalDeliveryProviderEventRow;
    attempt: ProposalDeliveryAttemptRow | null;
    nowIso: string;
  }
): Promise<{
  apply_state: DeliveryProviderApplyState;
  apply_detail: string;
  attempt: ProposalDeliveryAttemptRow | null;
}> {
  const target = mapResendEventToTargetStatus(input.event.event_type);

  if (!input.attempt) {
    await markProviderEventStateWithClient(supabase, {
      event_id: input.event.id,
      apply_state: "unresolved",
      apply_detail: "no_matching_attempt",
      delivery_attempt_id: null,
      company_id: null,
    });
    return {
      apply_state: "unresolved",
      apply_detail: "no_matching_attempt",
      attempt: null,
    };
  }

  if (target == null) {
    await markProviderEventStateWithClient(supabase, {
      event_id: input.event.id,
      apply_state: "ignored",
      apply_detail: "event_noop",
      delivery_attempt_id: input.attempt.id,
      company_id: input.attempt.company_id,
      applied_at: input.nowIso,
    });
    return {
      apply_state: "ignored",
      apply_detail: "event_noop",
      attempt: input.attempt,
    };
  }

  const result = await applyNormalizedStatusToAttemptWithClient(supabase, {
    attempt: input.attempt,
    target,
    at: input.event.provider_created_at ?? input.nowIso,
    error_code:
      target === "bounced"
        ? "email_bounced"
        : target === "failed"
          ? "email_failed"
          : null,
    error_message_safe:
      target === "bounced"
        ? "Couldn't deliver. Check the customer's email and resend."
        : target === "failed"
          ? "Couldn't deliver. Check the customer's email and resend."
          : null,
  });

  const apply_state: DeliveryProviderApplyState =
    result.decision === "apply"
      ? "applied"
      : result.decision === "noop"
        ? "ignored"
        : "ignored";
  const apply_detail =
    result.decision === "apply"
      ? `status:${target}`
      : result.decision === "noop"
        ? "noop_same_or_sent"
        : "ignored_transition";

  await markProviderEventStateWithClient(supabase, {
    event_id: input.event.id,
    apply_state,
    apply_detail,
    delivery_attempt_id: input.attempt.id,
    company_id: input.attempt.company_id,
    applied_at: input.nowIso,
  });

  return { apply_state, apply_detail, attempt: result.attempt };
}

export async function reconcileUnresolvedEventsForProviderMessageIdWithClient(
  supabase: SupabaseClient,
  providerMessageId: string,
  now: () => Date = () => new Date()
): Promise<number> {
  const attempt = await findProposalDeliveryAttemptByProviderMessageIdWithClient(
    supabase,
    providerMessageId
  );
  if (!attempt) return 0;

  const unresolved = await listUnresolvedProviderEventsForEmailIdWithClient(
    supabase,
    providerMessageId
  );
  let applied = 0;
  let current = attempt;
  for (const event of unresolved) {
    const result = await processProviderEventAgainstAttemptWithClient(supabase, {
      event,
      attempt: current,
      nowIso: now().toISOString(),
    });
    if (result.attempt) current = result.attempt;
    if (result.apply_state === "applied") applied += 1;
  }
  return applied;
}
