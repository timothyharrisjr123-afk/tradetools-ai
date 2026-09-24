/**
 * Phase 11 / Astra G10 — payment-request delivery attempt types.
 * Communication only — never mutates money request identity.
 */

import { createHash } from "node:crypto";

import {
  hashNormalizedRecipientEmailSha256,
  normalizeRecipientEmail,
} from "@/app/lib/proposalSendPrep";
import {
  buildRecipientDeliveryFieldsFromEmail,
  type ProposalDeliveryAttemptStatus,
} from "@/app/lib/proposalDeliveryAttemptTypes";

export const PAYMENT_REQUEST_DELIVERY_ATTEMPT_STATUSES = [
  "prepared",
  "attempted",
  "provider_accepted",
  "delayed",
  "failed",
  "delivered",
  "bounced",
  "complained",
] as const;

export type PaymentRequestDeliveryAttemptStatus =
  (typeof PAYMENT_REQUEST_DELIVERY_ATTEMPT_STATUSES)[number];

export type PaymentRequestDeliveryAttemptRow = {
  id: string;
  company_id: string;
  job_id: string;
  payment_request_id: string;
  channel: "email";
  provider: "resend";
  recipient_email_hash: string;
  recipient_email_redacted: string | null;
  contractor_note_snapshot: string | null;
  token_prefix: string | null;
  public_access_token_id: string | null;
  idempotency_key: string;
  attempt_number: number;
  status: PaymentRequestDeliveryAttemptStatus;
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
  delayed_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
};

export type CreatePaymentRequestDeliveryAttemptInput = {
  company_id: string;
  job_id: string;
  payment_request_id: string;
  recipient_email_hash: string;
  recipient_email_redacted?: string | null;
  contractor_note_snapshot?: string | null;
  token_prefix?: string | null;
  public_access_token_id?: string | null;
  idempotency_key: string;
  attempt_number: number;
  subject_snapshot: string;
  body_snapshot: string;
  metadata_json?: Record<string, unknown> | null;
  created_by?: string | null;
};

export const PAYMENT_REQUEST_EMAIL_NOTE_MAX_CHARS = 500;

export function normalizePaymentRequestEmailNote(
  note: string | null | undefined
): string | null {
  const trimmed = String(note ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > PAYMENT_REQUEST_EMAIL_NOTE_MAX_CHARS) {
    return trimmed.slice(0, PAYMENT_REQUEST_EMAIL_NOTE_MAX_CHARS);
  }
  return trimmed;
}

export function normalizeRecipientEmailForPaymentDelivery(email: string): string {
  const normalized = normalizeRecipientEmail(email);
  if (!normalized) {
    throw new Error("Recipient email must be a valid normalized address.");
  }
  return normalized;
}

export function buildPaymentRecipientDeliveryFieldsFromEmail(email: string): {
  recipient_email_hash: string;
  recipient_email_redacted: string;
} {
  return buildRecipientDeliveryFieldsFromEmail(email);
}

export function hashRecipientEmailForPaymentDelivery(email: string): string {
  return hashNormalizedRecipientEmailSha256(
    normalizeRecipientEmailForPaymentDelivery(email)
  );
}

export function buildPaymentRequestEmailContentHash(input: {
  subject: string;
  body: string;
  note?: string | null;
}): string {
  const note = normalizePaymentRequestEmailNote(input.note) ?? "";
  return createHash("sha256")
    .update(`${input.subject.trim()}\n---\n${input.body.trim()}\n---\n${note}`)
    .digest("hex");
}

export function buildPaymentRequestEmailSendIdempotencyKey(input: {
  paymentRequestId: string;
  recipientHash: string;
  contentHash: string;
  retrySuffix?: string | null;
}): string {
  const base = `pay-email-send/v1/${input.paymentRequestId}/${input.recipientHash.slice(0, 8)}/${input.contentHash.slice(0, 16)}`;
  const retry = (input.retrySuffix ?? "").trim();
  const key = retry ? `${base}/retry/${retry}` : base;
  return key.length <= 256 ? key : key.slice(0, 256);
}

export function isPaymentRequestEmailEligibleStatus(
  status: string
): boolean {
  const s = status.trim().toLowerCase();
  return s === "open" || s === "processing";
}

/** Map shared delivery status naming. */
export type SharedDeliveryStatus = ProposalDeliveryAttemptStatus;
