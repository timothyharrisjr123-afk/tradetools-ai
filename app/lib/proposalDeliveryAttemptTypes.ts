/**
 * R18D3A — Proposal delivery attempt types and pure email helpers.
 *
 * No Resend, routes, lifecycle, or proposal_events helpers.
 */

import { createHash } from "node:crypto";

import {
  hashNormalizedRecipientEmailSha256,
  normalizeRecipientEmail,
} from "@/app/lib/proposalSendPrep";

export const PROPOSAL_DELIVERY_ATTEMPT_STATUSES = [
  "prepared",
  "attempted",
  "provider_accepted",
  "failed",
  "delivered",
  "bounced",
  "complained",
] as const;

export type ProposalDeliveryAttemptStatus =
  (typeof PROPOSAL_DELIVERY_ATTEMPT_STATUSES)[number];

export type ProposalDeliveryAttemptChannel = "email";
export type ProposalDeliveryAttemptProvider = "resend";

export type ProposalDeliveryAttemptRow = {
  id: string;
  company_id: string;
  proposal_id: string;
  proposal_version_id: string;
  proposal_public_access_token_id: string | null;
  channel: ProposalDeliveryAttemptChannel;
  provider: ProposalDeliveryAttemptProvider;
  recipient_email_hash: string;
  recipient_email_redacted: string | null;
  token_prefix: string | null;
  idempotency_key: string;
  status: ProposalDeliveryAttemptStatus;
  subject_snapshot: string;
  body_snapshot: string;
  provider_message_id: string | null;
  error_code: string | null;
  error_message_safe: string | null;
  metadata_json: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  attempted_at: string | null;
  provider_accepted_at: string | null;
  failed_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
};

export type CreateProposalDeliveryAttemptInput = {
  company_id: string;
  proposal_id: string;
  proposal_version_id: string;
  proposal_public_access_token_id?: string | null;
  token_prefix?: string | null;
  recipient_email_hash: string;
  recipient_email_redacted?: string | null;
  idempotency_key: string;
  subject_snapshot: string;
  body_snapshot: string;
  metadata_json?: Record<string, unknown> | null;
  created_by?: string | null;
};

export type MarkProposalDeliveryAttemptProviderAcceptedInput = {
  company_id: string;
  attempt_id?: string;
  idempotency_key?: string;
  provider_message_id: string;
};

export type MarkProposalDeliveryAttemptFailedInput = {
  company_id: string;
  attempt_id?: string;
  idempotency_key?: string;
  error_code?: string | null;
  error_message_safe: string;
};

export type ListProposalDeliveryAttemptsInput = {
  company_id: string;
  proposal_id: string;
};

export function normalizeRecipientEmailForDelivery(email: string): string {
  const normalized = normalizeRecipientEmail(email);
  if (!normalized) {
    throw new Error("Recipient email must be a valid normalized address.");
  }
  return normalized;
}

export function hashNormalizedRecipientEmailForDelivery(normalizedEmail: string): string {
  return hashNormalizedRecipientEmailSha256(normalizedEmail);
}

export function redactRecipientEmailForDisplay(email: string): string | null {
  const normalized = normalizeRecipientEmail(email);
  if (!normalized) {
    return null;
  }

  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) {
    return null;
  }

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  if (!domain) {
    return null;
  }

  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function hashRecipientEmailForDelivery(email: string): string {
  return hashNormalizedRecipientEmailForDelivery(normalizeRecipientEmailForDelivery(email));
}

export function buildRecipientDeliveryFieldsFromEmail(email: string): {
  recipient_email_hash: string;
  recipient_email_redacted: string | null;
} {
  const normalized = normalizeRecipientEmailForDelivery(email);
  return {
    recipient_email_hash: createHash("sha256").update(normalized, "utf8").digest("hex"),
    recipient_email_redacted: redactRecipientEmailForDisplay(normalized),
  };
}
