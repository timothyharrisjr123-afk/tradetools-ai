/**
 * Phase 12 / Astra G11 — customer project record (pure composition).
 *
 * One read model for `/p/{token}` composed from canonical sources only:
 * accepted agreement + signature evidence, authorized scope changes with
 * approvals, `job_contract_total_cents_v1`, job payment rows, and
 * `jobs.stage` / `completed_at`. No closeout status, no new truth, no
 * attachments. Sections appear progressively as their facts exist.
 */

import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import type {
  JobPaymentRefundRow,
  JobPaymentRequestRow,
  JobPaymentTransactionRow,
} from "@/app/lib/jobPaymentReadModel";
import { JOB_PAYMENT_MIN_AMOUNT_CENTS } from "@/app/lib/jobPaymentTypes";
import {
  jobPaymentCollectibleRemainingCents,
  jobPaymentWorkspaceGrossCents,
  jobPaymentWorkspaceRefundedCents,
} from "@/app/lib/jobPaymentWorkspace";
import { publicPaymentReceivedKindLabel } from "@/app/lib/jobPaymentCustomerPresenter";

export const PUBLIC_PROJECT_RECORD_HEADING = "Project record";
export const PUBLIC_PROJECT_RECORD_AGREEMENT_HEADING = "Agreement";
export const PUBLIC_PROJECT_RECORD_CHANGES_HEADING = "Approved changes";
export const PUBLIC_PROJECT_RECORD_MONEY_HEADING = "Payments";
export const PUBLIC_PROJECT_RECORD_HISTORY_HEADING = "Payment history";
export const PUBLIC_PROJECT_RECORD_ORIGINAL_LABEL = "Original agreement";
export const PUBLIC_PROJECT_RECORD_CHANGES_TOTAL_LABEL = "Approved changes";
export const PUBLIC_PROJECT_RECORD_CURRENT_LABEL = "Current contract total";
export const PUBLIC_PROJECT_RECORD_RECEIVED_LABEL = "Payments received";
export const PUBLIC_PROJECT_RECORD_REFUNDED_LABEL = "Refunded";
export const PUBLIC_PROJECT_RECORD_NO_BALANCE = "No balance remaining";
export const PUBLIC_PROJECT_RECORD_BALANCE_LABEL = "Balance remaining";
export const PUBLIC_PROJECT_RECORD_MONEY_UNAVAILABLE =
  "Payment details unavailable — contact your contractor";
export const PUBLIC_PROJECT_RECORD_DOWNLOAD_SIGNED = "Download signed agreement";
export const PUBLIC_PROJECT_RECORD_DOWNLOAD_UNSIGNED = "Download agreement";
export const PUBLIC_PROJECT_RECORD_WORK_COMPLETE = "Work complete";
export const PUBLIC_PROJECT_RECORD_CHANGE_TOTAL_LABEL = "Change total";

export type PublicProjectRecordScopeChangeLineInput = {
  id: string;
  change_kind: "add" | "remove";
  description: string;
  quantity?: number | null;
  unit?: string | null;
  line_delta_cents: number;
  sort_order?: number;
};

export type PublicProjectRecordScopeChangeInput = {
  id: string;
  company_id: string;
  job_id: string;
  status: string;
  reason: string | null;
  authorized_at: string | null;
  price_delta_cents: number;
  lines: readonly PublicProjectRecordScopeChangeLineInput[];
  approval: { approved_at: string; approved_by_name: string } | null;
};

export type BuildPublicProjectRecordInput = {
  companyId: string;
  /** Null for legacy proposals with no linked job. */
  jobId: string | null;
  acceptance: {
    acceptedAt: string;
    signedAt?: string | null;
    signerPrintedName?: string | null;
  } | null;
  packageLabel: string | null;
  scopeChanges?: readonly PublicProjectRecordScopeChangeInput[];
  /** `proposal_acceptance_contract_total_cents_v1` basis — historical. */
  originalAgreementCents: number | null;
  /** `job_contract_total_cents_v1`; null means unavailable (never $0). */
  currentContractCents: number | null;
  requests?: readonly JobPaymentRequestRow[];
  transactions?: readonly JobPaymentTransactionRow[];
  refunds?: readonly JobPaymentRefundRow[];
  job: { stage: string | null; completedAt: string | null } | null;
  timeZone: string | null;
};

export type PublicProjectRecordChangeLine = {
  id: string;
  actionLabel: "Add" | "Remove";
  description: string;
  quantityLabel: string | null;
  deltaLabel: string;
};

export type PublicProjectRecordChange = {
  id: string;
  dateLabel: string | null;
  reason: string | null;
  lines: PublicProjectRecordChangeLine[];
  totalDeltaLabel: string;
  approvedByLabel: string | null;
};

export type PublicProjectRecordMoney =
  | {
      state: "available";
      currentContractLabel: string;
      paymentsReceivedLabel: string;
      refundedLabel: string | null;
      balanceLabel: string;
      hasBalance: boolean;
    }
  | { state: "unavailable"; message: string };

export type PublicProjectRecordHistoryItem = {
  id: string;
  label: "Payment received" | "Refund processing" | "Refund sent";
  kindLabel: string | null;
  amountLabel: string;
  dateLabel: string | null;
};

export type PublicProjectRecordViewModel = {
  agreement: {
    packageLabel: string | null;
    acceptedLabel: string;
    signedLabel: string | null;
    downloadLabel: string;
    signed: boolean;
  };
  approvedChanges: PublicProjectRecordChange[];
  contract: {
    originalLabel: string;
    changesLabel: string;
    currentLabel: string;
  } | null;
  money: PublicProjectRecordMoney | null;
  history: PublicProjectRecordHistoryItem[];
  completion: { label: string; dateLabel: string | null } | null;
};

function isCents(value: number | null | undefined): value is number {
  return value != null && Number.isInteger(value) && value >= 0;
}

/** Calendar date in the company timezone; falls back to UTC on a bad zone. */
export function formatProjectRecordDate(
  iso: string | null | undefined,
  timeZone: string | null | undefined
): string | null {
  const raw = (iso ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const zone = (timeZone ?? "").trim();
  try {
    return new Date(ms).toLocaleDateString("en-US", { ...options, timeZone: zone || "UTC" });
  } catch {
    return new Date(ms).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
  }
}

function signedCentsLabel(cents: number): string {
  if (cents > 0) return `+${formatUsdFromCents(cents)}`;
  if (cents < 0) return `−${formatUsdFromCents(Math.abs(cents))}`;
  return formatUsdFromCents(0);
}

function quantityLabel(line: PublicProjectRecordScopeChangeLineInput): string | null {
  if (line.quantity == null || !Number.isFinite(Number(line.quantity))) return null;
  const unit = (line.unit ?? "").trim();
  return unit ? `${line.quantity} ${unit}` : String(line.quantity);
}

function buildApprovedChanges(
  input: BuildPublicProjectRecordInput
): PublicProjectRecordChange[] {
  if (!input.jobId) return [];
  return (input.scopeChanges ?? [])
    .filter(
      (row) =>
        row.status === "authorized" &&
        row.company_id === input.companyId &&
        row.job_id === input.jobId
    )
    .slice()
    .sort((a, b) =>
      String(a.approval?.approved_at ?? a.authorized_at ?? "").localeCompare(
        String(b.approval?.approved_at ?? b.authorized_at ?? "")
      )
    )
    .map((row) => {
      const name = (row.approval?.approved_by_name ?? "").trim();
      return {
        id: row.id,
        dateLabel: formatProjectRecordDate(
          row.approval?.approved_at ?? row.authorized_at,
          input.timeZone
        ),
        reason: (row.reason ?? "").trim() || null,
        lines: row.lines
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((line) => ({
            id: line.id,
            actionLabel: line.change_kind === "remove" ? ("Remove" as const) : ("Add" as const),
            description: line.description,
            quantityLabel: quantityLabel(line),
            deltaLabel: signedCentsLabel(line.line_delta_cents),
          })),
        totalDeltaLabel: signedCentsLabel(row.price_delta_cents),
        approvedByLabel: name ? `Approved by ${name}` : null,
      };
    });
}

const VISIBLE_REFUND_STATUSES = new Set(["initiating", "pending", "requires_action", "succeeded"]);

function buildHistory(input: BuildPublicProjectRecordInput): PublicProjectRecordHistoryItem[] {
  if (!input.jobId) return [];
  const payments = (input.requests ?? [])
    .filter((row) => row.status === "paid")
    .map((row) => ({
      id: `payment:${row.id}`,
      label: "Payment received" as const,
      kindLabel: publicPaymentReceivedKindLabel(row.kind),
      amountLabel: formatUsdFromCents(row.amount_cents),
      occurredAt: row.paid_at ?? row.requested_at,
    }));
  const refunds = (input.refunds ?? [])
    .filter((row) => VISIBLE_REFUND_STATUSES.has(row.status))
    .map((row) => {
      const sent = row.status === "succeeded";
      return {
        id: `refund:${row.id}`,
        label: sent ? ("Refund sent" as const) : ("Refund processing" as const),
        kindLabel: null,
        amountLabel: formatUsdFromCents(row.amount_cents),
        occurredAt:
          (sent
            ? row.succeeded_at
            : row.requires_action_at ?? row.pending_at ?? row.initiated_at) ??
          row.created_at,
      };
    });
  return [...payments, ...refunds]
    .sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)))
    .map(({ occurredAt, ...item }) => ({
      ...item,
      dateLabel: formatProjectRecordDate(occurredAt, input.timeZone),
    }));
}

function buildMoney(input: BuildPublicProjectRecordInput): PublicProjectRecordMoney | null {
  if (!input.jobId) return null;
  if (!isCents(input.currentContractCents)) {
    return { state: "unavailable", message: PUBLIC_PROJECT_RECORD_MONEY_UNAVAILABLE };
  }
  const grossCents = jobPaymentWorkspaceGrossCents(input.transactions ?? []);
  const refundedCents = jobPaymentWorkspaceRefundedCents(input.refunds ?? []);
  const collectible =
    jobPaymentCollectibleRemainingCents({
      contractTotalCents: input.currentContractCents,
      receivedGrossCents: grossCents,
    }) ?? 0;
  const hasBalance = collectible >= JOB_PAYMENT_MIN_AMOUNT_CENTS;
  return {
    state: "available",
    currentContractLabel: formatUsdFromCents(input.currentContractCents),
    paymentsReceivedLabel: formatUsdFromCents(grossCents),
    refundedLabel: refundedCents > 0 ? formatUsdFromCents(refundedCents) : null,
    balanceLabel: hasBalance
      ? `${PUBLIC_PROJECT_RECORD_BALANCE_LABEL} ${formatUsdFromCents(collectible)}`
      : PUBLIC_PROJECT_RECORD_NO_BALANCE,
    hasBalance,
  };
}

function buildContract(
  input: BuildPublicProjectRecordInput
): PublicProjectRecordViewModel["contract"] {
  if (!input.jobId) return null;
  if (!isCents(input.originalAgreementCents) || !isCents(input.currentContractCents)) {
    return null;
  }
  const delta = input.currentContractCents - input.originalAgreementCents;
  if (delta === 0) return null;
  return {
    originalLabel: formatUsdFromCents(input.originalAgreementCents),
    changesLabel: signedCentsLabel(delta),
    currentLabel: formatUsdFromCents(input.currentContractCents),
  };
}

function buildCompletion(
  input: BuildPublicProjectRecordInput
): PublicProjectRecordViewModel["completion"] {
  if (!input.jobId || !input.job) return null;
  if ((input.job.stage ?? "").trim().toLowerCase() !== "complete") return null;
  return {
    label: PUBLIC_PROJECT_RECORD_WORK_COMPLETE,
    dateLabel: formatProjectRecordDate(input.job.completedAt, input.timeZone),
  };
}

/** Null until the customer has accepted; the record never precedes agreement. */
export function buildPublicProjectRecordViewModel(
  input: BuildPublicProjectRecordInput
): PublicProjectRecordViewModel | null {
  if (!input.acceptance) return null;
  const acceptedDate = formatProjectRecordDate(input.acceptance.acceptedAt, input.timeZone);
  const signedDate = formatProjectRecordDate(input.acceptance.signedAt, input.timeZone);
  const signerName = (input.acceptance.signerPrintedName ?? "").trim();
  const signed = Boolean(signedDate);
  return {
    agreement: {
      packageLabel: (input.packageLabel ?? "").trim() || null,
      acceptedLabel: acceptedDate ? `Accepted ${acceptedDate}` : "Accepted",
      signedLabel: signed
        ? signerName
          ? `Signed ${signedDate} · ${signerName}`
          : `Signed ${signedDate}`
        : null,
      downloadLabel: signed ? PUBLIC_PROJECT_RECORD_DOWNLOAD_SIGNED : PUBLIC_PROJECT_RECORD_DOWNLOAD_UNSIGNED,
      signed,
    },
    approvedChanges: buildApprovedChanges(input),
    contract: buildContract(input),
    money: buildMoney(input),
    history: buildHistory(input),
    completion: buildCompletion(input),
  };
}
