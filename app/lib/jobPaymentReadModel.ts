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
  PUBLIC_PAYMENT_BALANCE_LABEL,
  PUBLIC_PAYMENT_DEPOSIT_LABEL,
  PUBLIC_PAYMENT_DUE_TITLE,
  PUBLIC_PAYMENT_PARTIAL_REFUND_EXPLANATION,
  PUBLIC_PAYMENT_PENDING_EXPLANATION,
  PUBLIC_PAYMENT_PENDING_TITLE,
  PUBLIC_PAYMENT_PAY_DEPOSIT_CTA,
  PUBLIC_PAYMENT_RECEIVED_TITLE,
  PUBLIC_PAYMENT_REFUNDED_EXPLANATION,
  PUBLIC_PAYMENT_REFUNDED_TITLE,
  type JobPaymentKind,
  type JobPaymentRequestStatus,
} from "@/app/lib/jobPaymentTypes";
import { PUBLIC_PAY_REMAINING_BALANCE_CTA } from "@/app/lib/proposalPaymentTerms";
import {
  resolveDepositObligationCents,
  termsRequireOnlineDeposit,
  type ProposalPaymentTerms,
} from "@/app/lib/proposalPaymentTerms";
import { formatProposalCustomerAcceptedOnLabel } from "@/app/lib/proposalCustomerPacketViewModel";

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

export type PublicPaymentViewState =
  | "due"
  | "pending"
  | "received"
  | "failed"
  | "refunded";

export type PublicPaymentViewModel = {
  state: PublicPaymentViewState;
  kind: JobPaymentKind;
  amountLabel: string;
  kindLabel: string;
  paidOnLabel: string | null;
  explanation: string | null;
  ctaLabel: string | null;
  methodLabel: string | null;
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

function obligationCta(kind: JobPaymentKind): string {
  return kind === "deposit" ? PUBLIC_PAYMENT_PAY_DEPOSIT_CTA : PUBLIC_PAY_REMAINING_BALANCE_CTA;
}

export function buildPublicPaymentViewModel(input: {
  requests: readonly JobPaymentRequestRow[];
  transactions?: readonly JobPaymentTransactionRow[];
  returnHint?: "pending" | "cancelled" | null;
}): PublicPaymentViewModel | null {
  const current = activeRequest(input.requests);
  const paid = [...input.requests]
    .filter((row) => row.status === "paid")
    .sort((a, b) => String(b.paid_at ?? "").localeCompare(String(a.paid_at ?? "")))[0];
  const refunded = (input.transactions ?? []).some(
    (row) => row.kind === "refund" && row.status === "refunded"
  );
  const methodLabel = (paid?.settled_payment_method_label ?? "").trim() || null;

  if (current?.status === "failed") {
    return {
      state: "failed",
      kind: current.kind,
      amountLabel: formatUsdFromCents(current.amount_cents),
      kindLabel:
        current.kind === "deposit"
          ? PUBLIC_PAYMENT_DEPOSIT_LABEL
          : PUBLIC_PAYMENT_BALANCE_LABEL,
      paidOnLabel: null,
      explanation: "This payment did not complete. You can try again.",
      ctaLabel: obligationCta(current.kind),
      methodLabel: null,
    };
  }

  if (current) {
    const pending =
      current.status === "processing" || input.returnHint === "pending";
    return {
      state: pending ? "pending" : "due",
      kind: current.kind,
      amountLabel: formatUsdFromCents(current.amount_cents),
      kindLabel:
        current.kind === "deposit"
          ? PUBLIC_PAYMENT_DEPOSIT_LABEL
          : PUBLIC_PAYMENT_BALANCE_LABEL,
      paidOnLabel: null,
      explanation: pending ? PUBLIC_PAYMENT_PENDING_EXPLANATION : null,
      ctaLabel: pending ? null : obligationCta(current.kind),
      methodLabel: null,
    };
  }

  if (paid && !refunded) {
    return {
      state: "received",
      kind: paid.kind,
      amountLabel: formatUsdFromCents(paid.amount_cents),
      kindLabel:
        paid.kind === "deposit"
          ? PUBLIC_PAYMENT_DEPOSIT_LABEL
          : PUBLIC_PAYMENT_BALANCE_LABEL,
      paidOnLabel: formatProposalCustomerAcceptedOnLabel(paid.paid_at),
      explanation: null,
      ctaLabel: null,
      methodLabel,
    };
  }

  if (paid && refunded) {
    const net = netPaidCents(input.requests, input.transactions ?? []);
    const refundedCents = (input.transactions ?? [])
      .filter((row) => row.kind === "refund" && row.status === "refunded")
      .reduce((sum, row) => sum + row.amount_cents, 0);
    const full = net < 100;
    return {
      state: "refunded",
      kind: paid.kind,
      amountLabel: formatUsdFromCents(full ? paid.amount_cents : refundedCents),
      kindLabel:
        paid.kind === "deposit"
          ? PUBLIC_PAYMENT_DEPOSIT_LABEL
          : PUBLIC_PAYMENT_BALANCE_LABEL,
      paidOnLabel: null,
      explanation: full
        ? PUBLIC_PAYMENT_REFUNDED_EXPLANATION
        : `${PUBLIC_PAYMENT_PARTIAL_REFUND_EXPLANATION} ${formatUsdFromCents(net)} remains.`,
      ctaLabel: null,
      methodLabel,
    };
  }

  return null;
}

/**
 * Shows deposit Pay before canonical acceptance when terms require it.
 * Checkout creates acceptance idempotently, then opens the deposit request.
 */
export function buildProspectiveDepositPaymentViewModel(input: {
  terms: ProposalPaymentTerms;
  selectedTotalCents: number | null;
}): PublicPaymentViewModel | null {
  if (!termsRequireOnlineDeposit(input.terms)) return null;
  if (
    input.selectedTotalCents == null ||
    !Number.isInteger(input.selectedTotalCents) ||
    input.selectedTotalCents < 100
  ) {
    return null;
  }
  const cents = resolveDepositObligationCents({
    mode: input.terms.depositMode,
    percentBps: input.terms.depositPercentBps,
    fixedCents: input.terms.depositFixedCents,
    acceptedTotalCents: input.selectedTotalCents,
  });
  if (cents < 100) return null;
  return {
    state: "due",
    kind: "deposit",
    amountLabel: formatUsdFromCents(cents),
    kindLabel: PUBLIC_PAYMENT_DEPOSIT_LABEL,
    paidOnLabel: null,
    explanation: null,
    ctaLabel: PUBLIC_PAYMENT_PAY_DEPOSIT_CTA,
    methodLabel: null,
  };
}

export function publicPaymentTitle(
  state: PublicPaymentViewState,
  kind?: JobPaymentKind
): string {
  if (state === "pending") {
    return kind === "deposit" ? "Deposit pending" : PUBLIC_PAYMENT_PENDING_TITLE;
  }
  if (state === "received") {
    return kind === "deposit" ? "Deposit received" : PUBLIC_PAYMENT_RECEIVED_TITLE;
  }
  if (state === "refunded") return PUBLIC_PAYMENT_REFUNDED_TITLE;
  return kind === "deposit" ? "Deposit due" : PUBLIC_PAYMENT_DUE_TITLE;
}

export type JobPaymentActivityItem = {
  label: string;
  note: string;
  when?: string;
  identity: string;
  occurredAt: string;
};

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
