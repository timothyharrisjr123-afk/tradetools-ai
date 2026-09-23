/**
 * Phase 2C — FD-P2-SEND-EMAIL-PARTIAL send/delivery envelope.
 *
 * Canonical proposal send/freeze truth and email delivery continuation are
 * separate. Durable sent snapshot must never be reported as “proposal not sent”
 * because a later email/provider step failed.
 */

import type { SendPrepSnapshotStatus } from "@/app/lib/proposalSendPrep";

/**
 * Durable freeze truth title — not email receipt.
 * Matches Preview chrome “Sent proposal” vocabulary and avoids “ready”
 * (FieldDive uses “ready” for preparatory link/deposit states).
 */
export const PROPOSAL_SENT_TITLE = "Sent version preserved.";

export const PROPOSAL_SENT_DELIVERY_COPY = {
  submitted: null as string | null,
  failed:
    "Email delivery needs attention. Check the customer's email and try again.",
  checking:
    "The email may have been sent, but delivery status could not be confirmed yet.",
  in_progress: "A proposal email send is already in progress. Please wait a moment.",
} as const;

export type ProposalSendEnvelopeStatus = "sent" | "replayed";

export type ProposalSendEnvelope = {
  status: ProposalSendEnvelopeStatus;
  proposalVersionId: string;
  snapshotStatus: SendPrepSnapshotStatus;
};

/**
 * Delivery continuation after durable proposal send.
 * `submitted` = provider accepted the message (not webhook-delivered).
 * `delivered` remains webhook-only and is not inferred here.
 */
export type ProposalDeliveryContinuationStatus =
  | "submitted"
  | "failed"
  | "checking"
  | "in_progress";

export type ProposalDeliveryContinuationEnvelope = {
  status: ProposalDeliveryContinuationStatus;
  attemptId: string | null;
  code: string | null;
  message: string | null;
};

export function proposalSendStatusFromSnapshot(
  snapshotStatus: SendPrepSnapshotStatus,
  opts?: { idempotentDeliveryReplay?: boolean }
): ProposalSendEnvelopeStatus {
  if (opts?.idempotentDeliveryReplay) return "replayed";
  if (snapshotStatus === "reused") return "replayed";
  return "sent";
}

export function mapSubmittedDelivery(input: {
  attemptId: string;
  code?: string | null;
}): ProposalDeliveryContinuationEnvelope {
  return {
    status: "submitted",
    attemptId: input.attemptId,
    code: input.code ?? null,
    message: PROPOSAL_SENT_DELIVERY_COPY.submitted,
  };
}

export function mapFailedDelivery(input: {
  attemptId?: string | null;
  code: string;
  message: string;
}): ProposalDeliveryContinuationEnvelope {
  return {
    status: "failed",
    attemptId: input.attemptId ?? null,
    code: input.code,
    message: input.message || PROPOSAL_SENT_DELIVERY_COPY.failed,
  };
}

export function mapCheckingDelivery(input: {
  attemptId?: string | null;
  code: string;
  message: string;
}): ProposalDeliveryContinuationEnvelope {
  return {
    status: "checking",
    attemptId: input.attemptId ?? null,
    code: input.code,
    message: input.message || PROPOSAL_SENT_DELIVERY_COPY.checking,
  };
}

export function mapInProgressDelivery(input: {
  attemptId: string;
  code?: string | null;
  message?: string | null;
}): ProposalDeliveryContinuationEnvelope {
  return {
    status: "in_progress",
    attemptId: input.attemptId,
    code: input.code ?? "send_in_progress",
    message: input.message || PROPOSAL_SENT_DELIVERY_COPY.in_progress,
  };
}
