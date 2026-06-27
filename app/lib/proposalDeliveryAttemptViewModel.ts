/**
 * R18D3A / R18D3C1 — Contractor-safe delivery attempt view model.
 *
 * Does not expose hashes, internal IDs, provider message ids, or raw tokens/URLs.
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

export const PROPOSAL_DELIVERY_ATTEMPT_BODY_PREVIEW_MAX_LENGTH = 120;

export const PROPOSAL_DELIVERY_HISTORY_EMPTY_TITLE = "No emails sent yet";

export const PROPOSAL_DELIVERY_HISTORY_EMPTY_EXPLANATION =
  "Send a proposal by email above to create a delivery record.";

export const PROPOSAL_DELIVERY_ATTEMPT_SHORT_EXPLANATIONS: Record<
  ProposalDeliveryAttemptStatus,
  string
> = {
  prepared: "Delivery attempt prepared but not yet sent.",
  attempted:
    "Email handoff in progress. If this persists, try again or contact support.",
  provider_accepted:
    "Resend accepted the send request. This does not confirm the customer received or opened the email.",
  failed: "The email provider could not accept the send request.",
  delivered: "Reported delivered by email provider.",
  bounced: "Email provider reported a bounce.",
  complained: "Email provider reported a spam complaint.",
};

export type ProposalDeliveryAttemptStatusTone =
  | "neutral"
  | "pending"
  | "success"
  | "error"
  | "warning";

export type ProposalDeliveryAttemptResultCategory =
  | "accepted"
  | "failed"
  | "pending"
  | "future_tracking"
  | "unavailable";

export type ProposalDeliveryAttemptListItemViewModel = {
  statusLabel: string;
  statusTone: ProposalDeliveryAttemptStatusTone;
  resultCategory: ProposalDeliveryAttemptResultCategory;
  shortExplanation: string;
  recipientDisplay: string | null;
  subject: string;
  createdAt: string | null;
  displayTimestamp: string | null;
  bodyPreview: string | null;
  channelLabel: "Email";
  providerLabel: "Resend";
  supportLinkPrefix: string | null;
  attemptedAt: string | null;
  providerAcceptedAt: string | null;
  failedAt: string | null;
  safeError: string | null;
};

export type ProposalDeliveryHistoryViewModel = {
  isEmpty: boolean;
  latest: ProposalDeliveryAttemptListItemViewModel | null;
  history: ProposalDeliveryAttemptListItemViewModel[];
  totalCount: number;
  emptyStateTitle: string;
  emptyStateExplanation: string;
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

const RESULT_CATEGORIES: Record<
  ProposalDeliveryAttemptStatus,
  ProposalDeliveryAttemptResultCategory
> = {
  prepared: "pending",
  attempted: "pending",
  provider_accepted: "accepted",
  failed: "failed",
  delivered: "future_tracking",
  bounced: "future_tracking",
  complained: "future_tracking",
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

export function getProposalDeliveryAttemptResultCategory(
  status: ProposalDeliveryAttemptStatus
): ProposalDeliveryAttemptResultCategory {
  return RESULT_CATEGORIES[status] ?? "unavailable";
}

export function resolveProposalDeliveryAttemptDisplayTimestamp(
  row: ProposalDeliveryAttemptRow
): string | null {
  switch (row.status) {
    case "provider_accepted":
      return row.provider_accepted_at ?? row.attempted_at ?? row.created_at;
    case "failed":
      return row.failed_at ?? row.attempted_at ?? row.created_at;
    case "attempted":
    case "prepared":
      return row.attempted_at ?? row.created_at;
    case "delivered":
      return row.delivered_at ?? row.provider_accepted_at ?? row.created_at;
    case "bounced":
      return row.bounced_at ?? row.provider_accepted_at ?? row.created_at;
    case "complained":
      return row.complained_at ?? row.provider_accepted_at ?? row.created_at;
    default:
      return row.created_at;
  }
}

export function truncateProposalDeliveryAttemptBodyPreview(
  body: string | null | undefined
): string | null {
  if (body == null) {
    return null;
  }

  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length <= PROPOSAL_DELIVERY_ATTEMPT_BODY_PREVIEW_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, PROPOSAL_DELIVERY_ATTEMPT_BODY_PREVIEW_MAX_LENGTH - 1).trimEnd()}…`;
}

export function getProposalDeliveryAttemptShortExplanation(
  row: ProposalDeliveryAttemptRow
): string {
  if (row.status === "failed" && row.error_message_safe?.trim()) {
    return row.error_message_safe.trim();
  }

  return PROPOSAL_DELIVERY_ATTEMPT_SHORT_EXPLANATIONS[row.status];
}

function compareDeliveryAttemptsNewestFirst(
  a: ProposalDeliveryAttemptRow,
  b: ProposalDeliveryAttemptRow
): number {
  const timestampA = resolveProposalDeliveryAttemptDisplayTimestamp(a) ?? a.created_at;
  const timestampB = resolveProposalDeliveryAttemptDisplayTimestamp(b) ?? b.created_at;
  const parsedA = Date.parse(timestampA);
  const parsedB = Date.parse(timestampB);

  if (parsedB !== parsedA) {
    return parsedB - parsedA;
  }

  return Date.parse(b.created_at) - Date.parse(a.created_at);
}

export function sortProposalDeliveryAttemptsNewestFirst(
  rows: ProposalDeliveryAttemptRow[]
): ProposalDeliveryAttemptRow[] {
  return [...rows].sort(compareDeliveryAttemptsNewestFirst);
}

export function buildProposalDeliveryAttemptViewModel(
  row: ProposalDeliveryAttemptRow
): ProposalDeliveryAttemptListItemViewModel {
  return {
    statusLabel: getProposalDeliveryAttemptStatusLabel(row.status),
    statusTone: getProposalDeliveryAttemptStatusTone(row.status),
    resultCategory: getProposalDeliveryAttemptResultCategory(row.status),
    shortExplanation: getProposalDeliveryAttemptShortExplanation(row),
    recipientDisplay: row.recipient_email_redacted,
    subject: row.subject_snapshot,
    createdAt: row.created_at,
    displayTimestamp: resolveProposalDeliveryAttemptDisplayTimestamp(row),
    bodyPreview: truncateProposalDeliveryAttemptBodyPreview(row.body_snapshot),
    channelLabel: "Email",
    providerLabel: "Resend",
    supportLinkPrefix: row.token_prefix,
    attemptedAt: row.attempted_at,
    providerAcceptedAt: row.provider_accepted_at,
    failedAt: row.failed_at,
    safeError: row.status === "failed" ? row.error_message_safe : null,
  };
}

export function buildProposalDeliveryAttemptViewModels(
  rows: ProposalDeliveryAttemptRow[]
): ProposalDeliveryAttemptListItemViewModel[] {
  return sortProposalDeliveryAttemptsNewestFirst(rows).map(buildProposalDeliveryAttemptViewModel);
}

export function buildProposalDeliveryHistoryViewModel(
  rows: ProposalDeliveryAttemptRow[]
): ProposalDeliveryHistoryViewModel {
  if (rows.length === 0) {
    return {
      isEmpty: true,
      latest: null,
      history: [],
      totalCount: 0,
      emptyStateTitle: PROPOSAL_DELIVERY_HISTORY_EMPTY_TITLE,
      emptyStateExplanation: PROPOSAL_DELIVERY_HISTORY_EMPTY_EXPLANATION,
    };
  }

  const sorted = sortProposalDeliveryAttemptsNewestFirst(rows);
  const history = sorted.map(buildProposalDeliveryAttemptViewModel);

  return {
    isEmpty: false,
    latest: history[0] ?? null,
    history,
    totalCount: sorted.length,
    emptyStateTitle: PROPOSAL_DELIVERY_HISTORY_EMPTY_TITLE,
    emptyStateExplanation: PROPOSAL_DELIVERY_HISTORY_EMPTY_EXPLANATION,
  };
}
