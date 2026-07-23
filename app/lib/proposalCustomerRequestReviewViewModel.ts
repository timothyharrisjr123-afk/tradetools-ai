/**
 * R3B3 — Contractor-facing customer request review copy + view helpers.
 * Pure. No React, Supabase, or lifecycle mutation.
 */

import type {
  ProposalCustomerRequestContractorRow,
  ProposalCustomerRequestStatus,
} from "@/app/lib/proposalCustomerRequestPersistence";

export const CUSTOMER_REQUEST_REVIEW_SECTION_TITLE = "Customer requests";

export const CUSTOMER_REQUEST_REVIEW_SECTION_SUBTITLE =
  "Non-binding package interest from the customer. Review and confirm details.";

export const CUSTOMER_REQUEST_NONE_EVER_LABEL =
  "No customer package requests yet.";

export const CUSTOMER_REQUEST_NONE_ACTIVE_LABEL =
  "No active customer requests.";

export const CUSTOMER_REQUEST_HISTORY_TITLE = "Request history";

export const CUSTOMER_REQUEST_MARK_SEEN_LABEL = "Mark seen";

export const CUSTOMER_REQUEST_DISMISS_LABEL = "Dismiss";

export const CUSTOMER_REQUEST_REVIEW_LABEL = "Review request";

export const CUSTOMER_REQUEST_BUILDER_BANNER_HINT =
  "Review before revising or contacting the customer.";

export const CUSTOMER_REQUEST_STATUS_PILL_NEW = "New request";

export const CUSTOMER_REQUEST_STATUS_PILL_SEEN = "Seen";

export const CUSTOMER_REQUEST_STATUS_PILL_DISMISSED = "Dismissed";

/** Forbidden contractor-facing language for request review UI. */
export const CUSTOMER_REQUEST_REVIEW_FORBIDDEN_COPY =
  /\b(Accepted|Approved|Signed|Paid|Won|Ready to schedule|Customer selected package|Package confirmed)\b/i;

export function normalizeCustomerRequestPackageLabel(
  label: string | null | undefined
): string | null {
  const pkg = (label ?? "").trim().replace(/\s+package$/i, "").trim();
  return pkg || null;
}

export function formatCustomerRequestedHeadline(
  packageLabel: string | null | undefined
): string {
  const pkg = normalizeCustomerRequestPackageLabel(packageLabel);
  if (pkg) return `Customer requested ${pkg}`;
  return "Customer requested a package";
}

export function formatCustomerRequestStatusPill(
  status: ProposalCustomerRequestStatus
): string {
  switch (status) {
    case "new":
      return CUSTOMER_REQUEST_STATUS_PILL_NEW;
    case "seen":
      return CUSTOMER_REQUEST_STATUS_PILL_SEEN;
    case "dismissed":
      return CUSTOMER_REQUEST_STATUS_PILL_DISMISSED;
    default:
      return "Request";
  }
}

export function formatCustomerRequestActivityNote(
  row: Pick<
    ProposalCustomerRequestContractorRow,
    "message" | "status" | "requested_option_label"
  >
): string {
  const status = formatCustomerRequestStatusPill(row.status);
  const message = (row.message ?? "").trim();
  if (message) {
    const preview =
      message.length > 80 ? `${message.slice(0, 77).trimEnd()}…` : message;
    return `${status} · ${preview}`;
  }
  return `${status} · Review and confirm details.`;
}

export function formatCustomerRequestTimestamp(
  iso: string | null | undefined
): string | null {
  if (iso == null || iso.trim().length === 0) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

export type CustomerRequestReviewItemView = {
  id: string;
  proposalId: string;
  intent: ProposalCustomerRequestContractorRow["intent"];
  status: ProposalCustomerRequestStatus;
  statusPill: string;
  headline: string;
  packageLabel: string | null;
  messagePreview: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  createdAtLabel: string | null;
  createdAt: string;
  canMarkSeen: boolean;
  canDismiss: boolean;
};

export function isActiveCustomerRequestStatus(
  status: ProposalCustomerRequestStatus
): boolean {
  return status === "new" || status === "seen";
}

export function partitionCustomerRequestReviewItems(
  rows: readonly CustomerRequestReviewItemView[]
): {
  active: CustomerRequestReviewItemView[];
  history: CustomerRequestReviewItemView[];
} {
  return {
    active: rows.filter((row) => isActiveCustomerRequestStatus(row.status)),
    history: rows.filter((row) => row.status === "dismissed"),
  };
}

export function buildCustomerRequestReviewItemView(
  row: ProposalCustomerRequestContractorRow
): CustomerRequestReviewItemView {
  const packageLabel = normalizeCustomerRequestPackageLabel(
    row.requested_option_label
  );
  const message = (row.message ?? "").trim();
  const messagePreview =
    message.length === 0
      ? null
      : message.length > 120
        ? `${message.slice(0, 117).trimEnd()}…`
        : message;

  return {
    id: row.id,
    proposalId: row.proposal_id,
    intent: row.intent,
    status: row.status,
    statusPill: formatCustomerRequestStatusPill(row.status),
    headline: formatCustomerRequestedHeadline(row.requested_option_label),
    packageLabel,
    messagePreview,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    createdAtLabel: formatCustomerRequestTimestamp(row.created_at),
    createdAt: row.created_at,
    canMarkSeen: row.status === "new",
    canDismiss: row.status === "new" || row.status === "seen",
  };
}

/** Prefer the newest active request; dismissed rows are history only. */
export function pickPrimaryCustomerRequestForProposal(
  rows: readonly ProposalCustomerRequestContractorRow[],
  proposalId: string
): ProposalCustomerRequestContractorRow | null {
  const forProposal = rows.filter((row) => row.proposal_id === proposalId);
  if (forProposal.length === 0) return null;
  const open = forProposal.find((row) => row.status === "new");
  if (open) return open;
  const seen = forProposal.find((row) => row.status === "seen");
  if (seen) return seen;
  return null;
}

export function assertCustomerRequestReviewCopySafe(source: string): boolean {
  return !CUSTOMER_REQUEST_REVIEW_FORBIDDEN_COPY.test(source);
}
