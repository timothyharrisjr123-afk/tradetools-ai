/**
 * D1 — Normalized Resend delivery event types and monotonic transition helpers.
 * Pure module: no I/O.
 */

import type { ProposalDeliveryAttemptStatus } from "@/app/lib/proposalDeliveryAttemptTypes";

export const RESEND_WEBHOOK_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.failed",
  "email.complained",
] as const;

export type ResendWebhookEventType = (typeof RESEND_WEBHOOK_EVENT_TYPES)[number];

export type DeliveryProviderApplyState =
  | "received"
  | "applied"
  | "ignored"
  | "unresolved"
  | "duplicate";

/** Strength for out-of-order protection. Higher must not regress to lower. */
export const DELIVERY_STATUS_STRENGTH: Record<ProposalDeliveryAttemptStatus, number> = {
  prepared: 0,
  attempted: 1,
  provider_accepted: 2,
  delayed: 3,
  failed: 4,
  bounced: 4,
  delivered: 4,
  complained: 5,
};

export function isResendWebhookEventType(value: string): value is ResendWebhookEventType {
  return (RESEND_WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}

export function mapResendEventToTargetStatus(
  eventType: ResendWebhookEventType
): ProposalDeliveryAttemptStatus | null {
  switch (eventType) {
    case "email.sent":
      return null; // already represented by provider_accepted from send API
    case "email.delivery_delayed":
      return "delayed";
    case "email.delivered":
      return "delivered";
    case "email.bounced":
      return "bounced";
    case "email.failed":
      return "failed";
    case "email.complained":
      return "complained";
    default:
      return null;
  }
}

export function isAllowedDeliveryStatusTransition(
  from: ProposalDeliveryAttemptStatus,
  to: ProposalDeliveryAttemptStatus
): boolean {
  if (from === to) return true;
  if (
    (from === "prepared" && to === "attempted") ||
    (from === "attempted" && (to === "provider_accepted" || to === "failed")) ||
    (from === "provider_accepted" &&
      (to === "delayed" ||
        to === "delivered" ||
        to === "bounced" ||
        to === "failed" ||
        to === "complained")) ||
    (from === "delayed" &&
      (to === "delivered" || to === "bounced" || to === "failed" || to === "complained")) ||
    (from === "delivered" && to === "complained")
  ) {
    return true;
  }
  return false;
}

/**
 * Decide whether an incoming target status should update the attempt row.
 * Same status → no-op apply. Weaker/regressive → ignore. Stronger/allowed → apply.
 */
export function resolveDeliveryStatusApplyDecision(
  current: ProposalDeliveryAttemptStatus,
  target: ProposalDeliveryAttemptStatus | null
): "apply" | "noop" | "ignore" {
  if (target == null) return "noop";
  if (current === target) return "noop";
  if (!isAllowedDeliveryStatusTransition(current, target)) {
    // Explicitly block regression even if DB would reject.
    if (DELIVERY_STATUS_STRENGTH[target] < DELIVERY_STATUS_STRENGTH[current]) {
      return "ignore";
    }
    return "ignore";
  }
  return "apply";
}

export function timestampColumnForDeliveryStatus(
  status: ProposalDeliveryAttemptStatus
):
  | "attempted_at"
  | "provider_accepted_at"
  | "failed_at"
  | "delayed_at"
  | "delivered_at"
  | "bounced_at"
  | "complained_at"
  | null {
  switch (status) {
    case "attempted":
      return "attempted_at";
    case "provider_accepted":
      return "provider_accepted_at";
    case "failed":
      return "failed_at";
    case "delayed":
      return "delayed_at";
    case "delivered":
      return "delivered_at";
    case "bounced":
      return "bounced_at";
    case "complained":
      return "complained_at";
    default:
      return null;
  }
}

export type ParsedResendWebhookEvent = {
  svixId: string;
  eventType: ResendWebhookEventType;
  providerEmailId: string;
  providerCreatedAt: string | null;
  safeMetadata: Record<string, unknown>;
};

export function extractResendEmailId(data: Record<string, unknown>): string | null {
  const emailId = data.email_id;
  if (typeof emailId === "string" && emailId.trim()) return emailId.trim();
  return null;
}

export function buildSafeResendEventMetadata(
  data: Record<string, unknown>
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  if (typeof data.subject === "string") {
    safe.subject_len = data.subject.length;
  }
  if (Array.isArray(data.to)) {
    safe.recipient_count = data.to.length;
  }
  const bounce = data.bounce;
  if (bounce && typeof bounce === "object" && !Array.isArray(bounce)) {
    const b = bounce as Record<string, unknown>;
    if (typeof b.type === "string") safe.bounce_type = b.type;
    if (typeof b.subType === "string") safe.bounce_subtype = b.subType;
  }
  return safe;
}
