/**
 * R3E compact payment read models for Job Card and Public packet.
 * Payment is never a Job stage.
 */

import {
  formatUsdFromCents,
  remainingAcceptedCents,
} from "@/app/lib/jobPaymentMoney";
import {
  ACTIVITY_PAYMENT_FAILED_LABEL,
  ACTIVITY_PAYMENT_RECEIVED_LABEL,
  ACTIVITY_PAYMENT_REQUESTED_LABEL,
  ACTIVITY_REFUND_RECORDED_LABEL,
  JOB_CARD_PAYMENTS_NOT_CONNECTED,
  JOB_CARD_PAYMENTS_NOT_REQUESTED,
  JOB_CARD_PAYMENTS_PAID_IN_FULL,
  type JobPaymentKind,
  type JobPaymentRequestStatus,
} from "@/app/lib/jobPaymentTypes";

export type {
  PublicPaymentHistoryItem,
  PublicPaymentOriginalTerms,
  PublicPaymentViewModel,
  PublicPaymentViewState,
} from "@/app/lib/jobPaymentCustomerPresenter";
export {
  applyCustomerPaymentReturnHint,
  buildProspectiveDepositPaymentViewModel,
  buildPublicPaymentViewModel,
  customerCurrentRequest,
  isCustomerPaymentPayableState,
  publicCheckoutShouldOpenCanonicalDeposit,
  publicPaymentTitle,
} from "@/app/lib/jobPaymentCustomerPresenter";

export type JobPaymentRequestRow = {
  id: string;
  company_id: string;
  job_id: string;
  proposal_id: string;
  proposal_version_id: string;
  proposal_option_id: string;
  proposal_acceptance_id: string;
  proposal_signature_id: string | null;
  amount_cents: number;
  currency: string;
  kind: JobPaymentKind;
  accepted_total_cents_snapshot: number;
  option_label_snapshot: string;
  provider_account_id: string;
  provider_checkout_session_id: string | null;
  status: JobPaymentRequestStatus;
  requested_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  settled_payment_method_label?: string | null;
};

export type JobPaymentTransactionRow = {
  id: string;
  payment_request_id: string;
  kind: "capture" | "failure" | "refund";
  status: "succeeded" | "failed" | "refunded";
  amount_cents: number;
  occurred_at: string;
  provider_event_id: string;
  provider_payment_intent_id?: string | null;
};

export type CompanyPaymentAccountRow = {
  charges_enabled: boolean;
  onboarding_status: string;
  details_submitted: boolean;
  payouts_enabled: boolean;
};

export type JobCardPaymentAction =
  | "connect"
  | "request_deposit"
  | "request_balance"
  | null;

export type JobCardPaymentViewModel = {
  connected: boolean;
  chargesEnabled: boolean;
  headline: string;
  detail: string | null;
  action: JobCardPaymentAction;
  canRequestDeposit: boolean;
  canRequestBalance: boolean;
  remainingCents: number;
  acceptedTotalCents: number | null;
  unsignedApprovedEligible: boolean;
};

export function netPaidCents(
  requests: readonly JobPaymentRequestRow[],
  transactions: readonly JobPaymentTransactionRow[]
): number {
  const paid = requests
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + row.amount_cents, 0);
  const refunded = transactions
    .filter((row) => row.kind === "refund" && row.status === "refunded")
    .reduce((sum, row) => sum + row.amount_cents, 0);
  return Math.max(0, paid - refunded);
}

export function kindNetPaidCents(
  kind: JobPaymentKind,
  requests: readonly JobPaymentRequestRow[],
  transactions: readonly JobPaymentTransactionRow[]
): number {
  const ids = new Set(
    requests.filter((row) => row.kind === kind && row.status === "paid").map((row) => row.id)
  );
  const paid = requests
    .filter((row) => ids.has(row.id))
    .reduce((sum, row) => sum + row.amount_cents, 0);
  const refunded = transactions
    .filter(
      (row) =>
        row.kind === "refund" &&
        row.status === "refunded" &&
        ids.has(row.payment_request_id)
    )
    .reduce((sum, row) => sum + row.amount_cents, 0);
  return Math.max(0, paid - refunded);
}

function activeRequest(
  requests: readonly JobPaymentRequestRow[]
): JobPaymentRequestRow | null {
  return (
    requests.find((row) => row.status === "open" || row.status === "processing") ??
    requests.find((row) => row.status === "failed") ??
    null
  );
}

export function buildJobCardPaymentViewModel(input: {
  jobStage: string | null;
  jobDisposition: string | null;
  accepted: boolean;
  signed: boolean;
  account: CompanyPaymentAccountRow | null;
  requests: readonly JobPaymentRequestRow[];
  transactions: readonly JobPaymentTransactionRow[];
  acceptedTotalCents: number | null;
}): JobCardPaymentViewModel {
  const approved =
    input.jobStage === "approved" &&
    (input.jobDisposition ?? "active") === "active";
  const connected = Boolean(input.account);
  const chargesEnabled = input.account?.charges_enabled === true;
  const acceptedTotal = input.acceptedTotalCents;
  const paid = netPaidCents(input.requests, input.transactions);
  const remaining =
    acceptedTotal == null
      ? 0
      : remainingAcceptedCents({
          acceptedTotalCents: acceptedTotal,
          netPaidCents: paid,
        });
  const unsignedApprovedEligible =
    approved && input.accepted && !input.signed;
  const depositPaid = kindNetPaidCents(
    "deposit",
    input.requests,
    input.transactions
  );
  const current = activeRequest(input.requests);
  const refunded = input.transactions.some(
    (row) => row.kind === "refund" && row.status === "refunded"
  );

  const canRequestDeposit = false;

  const canRequestBalance =
    approved &&
    input.accepted &&
    chargesEnabled &&
    remaining >= 100 &&
    depositPaid > 0 &&
    !current;

  if (!connected || !chargesEnabled) {
    return {
      connected,
      chargesEnabled,
      headline: JOB_CARD_PAYMENTS_NOT_CONNECTED,
      detail: null,
      action: input.accepted ? "connect" : null,
      canRequestDeposit: false,
      canRequestBalance: false,
      remainingCents: remaining,
      acceptedTotalCents: acceptedTotal,
      unsignedApprovedEligible,
    };
  }

  if (!input.accepted) {
    return {
      connected: true,
      chargesEnabled: true,
      headline: JOB_CARD_PAYMENTS_NOT_REQUESTED,
      detail: null,
      action: null,
      canRequestDeposit: false,
      canRequestBalance: false,
      remainingCents: remaining,
      acceptedTotalCents: acceptedTotal,
      unsignedApprovedEligible,
    };
  }

  if (current?.status === "failed") {
    const label =
      current.kind === "deposit"
        ? `Deposit failed — ${formatUsdFromCents(current.amount_cents)}`
        : `Payment failed — ${formatUsdFromCents(current.amount_cents)}`;
    return {
      connected: true,
      chargesEnabled: true,
      headline: label,
      detail: "Customer payment did not complete.",
      action: current.kind === "balance" ? "request_balance" : "request_deposit",
      canRequestDeposit: current.kind === "deposit",
      canRequestBalance: current.kind === "balance",
      remainingCents: remaining,
      acceptedTotalCents: acceptedTotal,
      unsignedApprovedEligible,
    };
  }

  if (current?.status === "open" || current?.status === "processing") {
    const dueLabel =
      current.kind === "deposit"
        ? `Deposit due — ${formatUsdFromCents(current.amount_cents)}`
        : `Balance due — ${formatUsdFromCents(current.amount_cents)}`;
    const pendingLabel =
      current.kind === "deposit"
        ? `Deposit pending — ${formatUsdFromCents(current.amount_cents)}`
        : `Balance pending — ${formatUsdFromCents(current.amount_cents)}`;
    return {
      connected: true,
      chargesEnabled: true,
      headline: current.status === "processing" ? pendingLabel : dueLabel,
      detail: null,
      action: null,
      canRequestDeposit: false,
      canRequestBalance: false,
      remainingCents: remaining,
      acceptedTotalCents: acceptedTotal,
      unsignedApprovedEligible,
    };
  }

  if (remaining <= 0 && paid > 0 && !refunded) {
    return {
      connected: true,
      chargesEnabled: true,
      headline: JOB_CARD_PAYMENTS_PAID_IN_FULL,
      detail: null,
      action: null,
      canRequestDeposit: false,
      canRequestBalance: false,
      remainingCents: 0,
      acceptedTotalCents: acceptedTotal,
      unsignedApprovedEligible,
    };
  }

  if (refunded && remaining > 0) {
    return {
      connected: true,
      chargesEnabled: true,
      headline: `Refund recorded — ${formatUsdFromCents(paid)} collected`,
      detail: remaining >= 100 ? formatUsdFromCents(remaining) + " remaining" : null,
      action: canRequestDeposit
        ? "request_deposit"
        : canRequestBalance
          ? "request_balance"
          : null,
      canRequestDeposit,
      canRequestBalance,
      remainingCents: remaining,
      acceptedTotalCents: acceptedTotal,
      unsignedApprovedEligible,
    };
  }

  if (depositPaid > 0 && remaining >= 100) {
    return {
      connected: true,
      chargesEnabled: true,
      headline: `Deposit received — ${formatUsdFromCents(depositPaid)}`,
      detail: `Balance due — ${formatUsdFromCents(remaining)}`,
      action: "request_balance",
      canRequestDeposit: false,
      canRequestBalance,
      remainingCents: remaining,
      acceptedTotalCents: acceptedTotal,
      unsignedApprovedEligible,
    };
  }

  if (depositPaid > 0 && remaining < 100) {
    return {
      connected: true,
      chargesEnabled: true,
      headline: JOB_CARD_PAYMENTS_PAID_IN_FULL,
      detail: null,
      action: null,
      canRequestDeposit: false,
      canRequestBalance: false,
      remainingCents: remaining,
      acceptedTotalCents: acceptedTotal,
      unsignedApprovedEligible,
    };
  }

  return {
    connected: true,
    chargesEnabled: true,
    headline: JOB_CARD_PAYMENTS_NOT_REQUESTED,
    detail: null,
    action: canRequestDeposit ? "request_deposit" : null,
    canRequestDeposit,
    canRequestBalance,
    remainingCents: remaining,
    acceptedTotalCents: acceptedTotal,
    unsignedApprovedEligible,
  };
}

export type JobPaymentActivityItem = {
  label: string;
  note: string;
  when?: string;
  identity: string;
  occurredAt: string;
};

/**
 * Legacy Activity composer. Kept for tests/review harnesses.
 * Live Job Card Activity is not fed from this composer (`skipPaymentEnrichment`).
 * Stage 2E payment history lives on the Payments tab instead.
 */
export function composeJobPaymentActivityItems(input: {
  requests: readonly JobPaymentRequestRow[];
  transactions: readonly JobPaymentTransactionRow[];
}): JobPaymentActivityItem[] {
  const items: JobPaymentActivityItem[] = [];
  for (const request of input.requests) {
    items.push({
      label: ACTIVITY_PAYMENT_REQUESTED_LABEL,
      note:
        request.kind === "deposit"
          ? `Deposit · ${formatUsdFromCents(request.amount_cents)}`
          : request.kind === "progress"
            ? `Progress · ${formatUsdFromCents(request.amount_cents)}`
            : `Balance · ${formatUsdFromCents(request.amount_cents)}`,
      identity: `payment_request:${request.id}`,
      occurredAt: request.requested_at,
    });
  }
  for (const txn of input.transactions) {
    if (txn.kind === "capture" && txn.status === "succeeded") {
      items.push({
        label: ACTIVITY_PAYMENT_RECEIVED_LABEL,
        note: formatUsdFromCents(txn.amount_cents),
        identity: `payment_transaction:${txn.id}`,
        occurredAt: txn.occurred_at,
      });
    } else if (txn.kind === "failure") {
      items.push({
        label: ACTIVITY_PAYMENT_FAILED_LABEL,
        note: formatUsdFromCents(txn.amount_cents),
        identity: `payment_transaction:${txn.id}`,
        occurredAt: txn.occurred_at,
      });
    } else if (txn.kind === "refund") {
      items.push({
        label: ACTIVITY_REFUND_RECORDED_LABEL,
        note: formatUsdFromCents(txn.amount_cents),
        identity: `payment_transaction:${txn.id}`,
        occurredAt: txn.occurred_at,
      });
    }
  }
  return items;
}
