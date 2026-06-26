/**
 * R18D3A — Contractor-safe delivery attempt view model.
 *
 * Does not expose hashes, internal IDs, provider message ids, or token prefixes.
 */

import type {
  ProposalDeliveryAttemptRow,
  ProposalDeliveryAttemptStatus,
} from "@/app/lib/proposalDeliveryAttemptTypes";

export const PROPOSAL_DELIVERY_ATTEMPT_STATUS_LABELS: Record<
  ProposalDeliveryAttemptStatus,
  string
> = {
  prepared: "Prepared",
  attempted: "Sending",
  provider_accepted: "Accepted by email provider",
  failed: "Failed",
  delivered: "Delivered",
  bounced: "Bounced",
  complained: "Complaint received",
};

export type ProposalDeliveryAttemptStatusTone =
  | "neutral"
  | "pending"
  | "success"
  | "error"
  | "warning";

export type ProposalDeliveryAttemptListItemViewModel = {
  statusLabel: string;
  statusTone: ProposalDeliveryAttemptStatusTone;
  recipientDisplay: string | null;
  subject: string;
  attemptedAt: string | null;
  providerAcceptedAt: string | null;
  failedAt: string | null;
  safeError: string | null;
};

const STATUS_TONES: Record<ProposalDeliveryAttemptStatus, ProposalDeliveryAttemptStatusTone> = {
  prepared: "neutral",
  attempted: "pending",
  provider_accepted: "success",
  failed: "error",
  delivered: "success",
  bounced: "warning",
  complained: "warning",
};

export function getProposalDeliveryAttemptStatusLabel(
  status: ProposalDeliveryAttemptStatus
): string {
  return PROPOSAL_DELIVERY_ATTEMPT_STATUS_LABELS[status];
}

export function getProposalDeliveryAttemptStatusTone(
  status: ProposalDeliveryAttemptStatus
): ProposalDeliveryAttemptStatusTone {
  return STATUS_TONES[status];
}

export function buildProposalDeliveryAttemptViewModel(
  row: ProposalDeliveryAttemptRow
): ProposalDeliveryAttemptListItemViewModel {
  return {
    statusLabel: getProposalDeliveryAttemptStatusLabel(row.status),
    statusTone: getProposalDeliveryAttemptStatusTone(row.status),
    recipientDisplay: row.recipient_email_redacted,
    subject: row.subject_snapshot,
    attemptedAt: row.attempted_at,
    providerAcceptedAt: row.provider_accepted_at,
    failedAt: row.failed_at,
    safeError: row.status === "failed" ? row.error_message_safe : null,
  };
}

export function buildProposalDeliveryAttemptViewModels(
  rows: ProposalDeliveryAttemptRow[]
): ProposalDeliveryAttemptListItemViewModel[] {
  return rows.map(buildProposalDeliveryAttemptViewModel);
}
