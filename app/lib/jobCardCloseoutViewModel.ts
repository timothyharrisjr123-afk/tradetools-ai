/**
 * Phase 12 / Astra G11 — contractor Review closeout (Job Card Overview).
 *
 * Read-only composition of existing truth: canonical stage + completed_at,
 * accepted agreement, authorized scope-change deltas, and the payment
 * workspace money (same helpers as the customer project record). No closeout
 * status, no ready/shared/sent state, no editor.
 */

import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import {
  JOB_PAYMENT_INFORMATION_UNAVAILABLE,
  JOB_PAYMENT_MIN_AMOUNT_CENTS,
} from "@/app/lib/jobPaymentTypes";
import {
  formatProjectRecordDate,
  PUBLIC_PROJECT_RECORD_NO_BALANCE,
  PUBLIC_PROJECT_RECORD_WORK_COMPLETE,
} from "@/app/lib/publicProjectRecordViewModel";

export const JOB_CARD_CLOSEOUT_HEADING = "Closeout";
export const JOB_CARD_CLOSEOUT_REVIEW_CTA = "Review closeout";
export const JOB_CARD_CLOSEOUT_HIDE_CTA = "Hide closeout";
export const JOB_CARD_CLOSEOUT_COPY_LINK_CTA = "Copy customer link";
export const JOB_CARD_CLOSEOUT_COPIED = "Customer link copied — not sent";
export const JOB_CARD_CLOSEOUT_OPEN_PAYMENTS_CTA = "Open Payments";
export const JOB_CARD_CLOSEOUT_PAYMENTS_LOADING = "Checking payments…";

/** Copy confirmation; expiry comes from the server-issued link, never a hard-coded window. */
export function describeCloseoutLinkCopied(expiresAt: string | null | undefined): string {
  if (!expiresAt) return `${JOB_CARD_CLOSEOUT_COPIED}.`;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return `${JOB_CARD_CLOSEOUT_COPIED}.`;
  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${JOB_CARD_CLOSEOUT_COPIED}. Share it with your customer — it works until ${label}.`;
}
export const JOB_CARD_CLOSEOUT_COPY_FAILED = "Could not copy the customer link. Try again.";

export type JobCardCloseoutInput = {
  stage: string | null;
  completedAt: string | null;
  timeZone: string | null;
  accepted: boolean;
  signed: boolean;
  workspace: {
    contractTotalCents: number | null;
    receivedGrossCents: number;
    refundedCents: number;
    collectibleRemainingCents: number | null;
  } | null;
  scopeChanges: readonly { status: string; priceDeltaCents: number }[];
  /** Payment read still in flight: say so instead of "unavailable". */
  paymentsLoading?: boolean;
};

export type JobCardCloseoutRow = { key: string; label: string; value: string };

export type JobCardCloseoutViewModel = {
  completionLabel: string;
  /** Structured form of `completionLabel` for the leading closeout region. */
  completionTitle: string;
  /** Canonical completion date, or null when unknown. */
  completionDate: string | null;
  balanceLabel: string;
  /** Workspace amounts passed through unchanged; null when money is unknown. */
  contractTotalCents: number | null;
  remainingCents: number | null;
  rows: JobCardCloseoutRow[];
};

function signedCents(cents: number): string {
  if (cents > 0) return `+${formatUsdFromCents(cents)}`;
  if (cents < 0) return `−${formatUsdFromCents(Math.abs(cents))}`;
  return formatUsdFromCents(0);
}

/** Null unless the job is canonically Complete (Closed alone never counts). */
export function buildJobCardCloseoutViewModel(
  input: JobCardCloseoutInput
): JobCardCloseoutViewModel | null {
  if ((input.stage ?? "").trim().toLowerCase() !== "complete") return null;
  const date = formatProjectRecordDate(input.completedAt, input.timeZone);
  const completionLabel = date
    ? `${PUBLIC_PROJECT_RECORD_WORK_COMPLETE} · ${date}`
    : PUBLIC_PROJECT_RECORD_WORK_COMPLETE;

  const authorized = input.scopeChanges.filter((row) => row.status === "authorized");
  const deltaCents = authorized.reduce((sum, row) => sum + (Number(row.priceDeltaCents) || 0), 0);
  const contract = input.workspace?.contractTotalCents ?? null;
  const rows: JobCardCloseoutRow[] = [];

  if (input.accepted) {
    const original = contract != null ? contract - deltaCents : null;
    rows.push({
      key: "agreement",
      label: "Agreement",
      value: [input.signed ? "Signed" : "Accepted", original != null ? formatUsdFromCents(original) : null]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (authorized.length > 0) {
    rows.push({
      key: "changes",
      label: "Approved changes",
      value: `${authorized.length} · ${signedCents(deltaCents)}`,
    });
  }

  const completion = {
    completionLabel,
    completionTitle: PUBLIC_PROJECT_RECORD_WORK_COMPLETE,
    completionDate: date,
  };

  if (!input.workspace || contract == null || input.workspace.collectibleRemainingCents == null) {
    return {
      ...completion,
      contractTotalCents: null,
      remainingCents: null,
      balanceLabel:
        input.paymentsLoading && !input.workspace
          ? JOB_CARD_CLOSEOUT_PAYMENTS_LOADING
          : JOB_PAYMENT_INFORMATION_UNAVAILABLE,
      rows,
    };
  }

  const remaining = input.workspace.collectibleRemainingCents;
  const balanceLabel =
    remaining >= JOB_PAYMENT_MIN_AMOUNT_CENTS
      ? `Balance remaining ${formatUsdFromCents(remaining)}`
      : PUBLIC_PROJECT_RECORD_NO_BALANCE;
  rows.push({ key: "contract", label: "Current contract total", value: formatUsdFromCents(contract) });
  rows.push({
    key: "collected",
    label: "Collected",
    value: formatUsdFromCents(input.workspace.receivedGrossCents),
  });
  if (input.workspace.refundedCents > 0) {
    rows.push({
      key: "refunded",
      label: "Refunded",
      value: formatUsdFromCents(input.workspace.refundedCents),
    });
  }
  rows.push({
    key: "remaining",
    label: "Remaining",
    value: remaining >= JOB_PAYMENT_MIN_AMOUNT_CENTS ? formatUsdFromCents(remaining) : "None",
  });
  return {
    ...completion,
    contractTotalCents: contract,
    remainingCents: remaining,
    balanceLabel,
    rows,
  };
}
