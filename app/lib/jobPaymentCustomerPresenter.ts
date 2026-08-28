/**
 * Stage 2D — canonical customer payment presenter.
 *
 * Derives public `/p/{token}` payment state from existing request, transaction,
 * terms, and 053/054 money truth. Does not mint requests. Does not change
 * collectible accounting. Failed is never Current request.
 */

import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import { JOB_PAYMENT_MIN_AMOUNT_CENTS, type JobPaymentKind } from "@/app/lib/jobPaymentTypes";
import {
  PUBLIC_PAYMENT_BALANCE_LABEL,
  PUBLIC_PAYMENT_CONTRACTOR_REQUESTED,
  PUBLIC_PAYMENT_DEPOSIT_DUE_TITLE,
  PUBLIC_PAYMENT_DEPOSIT_LABEL,
  PUBLIC_PAYMENT_DIDNT_GO_THROUGH,
  PUBLIC_PAYMENT_DUE_TITLE,
  PUBLIC_PAYMENT_FAILED_DEPOSIT_RETRY_EXPLANATION,
  PUBLIC_PAYMENT_FAILED_INACTIVE_EXPLANATION,
  PUBLIC_PAYMENT_NO_PAYMENT_DUE_NOW,
  PUBLIC_PAYMENT_PAID_IN_FULL_EXPLANATION,
  PUBLIC_PAYMENT_PAID_IN_FULL_TITLE,
  PUBLIC_PAYMENT_PAY_DEPOSIT_CTA,
  PUBLIC_PAYMENT_PAY_NOW_CTA,
  PUBLIC_PAYMENT_PAYMENTS_COMPLETE_EXPLANATION,
  PUBLIC_PAYMENT_PAYMENTS_COMPLETE_TITLE,
  PUBLIC_PAYMENT_PROCESSING_EXPLANATION,
  PUBLIC_PAYMENT_PROCESSING_TITLE,
  PUBLIC_PAYMENT_PROGRESS_LABEL,
  PUBLIC_PAYMENT_RECEIVED_TITLE,
  PUBLIC_PAYMENT_STRIPE_NOTE,
  PUBLIC_PAYMENT_TRY_AGAIN_CTA,
} from "@/app/lib/jobPaymentTypes";
import { PUBLIC_PAY_REMAINING_BALANCE_CTA } from "@/app/lib/proposalPaymentTerms";
import {
  formatProposalCustomerAcceptedOnLabel,
  PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_CTA,
} from "@/app/lib/proposalCustomerPacketViewModel";
import type {
  JobPaymentRequestRow,
  JobPaymentRefundRow,
  JobPaymentTransactionRow,
} from "@/app/lib/jobPaymentReadModel";
import {
  jobPaymentCollectibleRemainingCents,
  jobPaymentWorkspaceGrossCents,
  jobPaymentWorkspaceRefundedCents,
} from "@/app/lib/jobPaymentWorkspace";
import {
  formatOriginalProposalTermsCopy,
  resolveDepositObligationCents,
  termsRequireOnlineDeposit,
  type ProposalPaymentTerms,
} from "@/app/lib/proposalPaymentTerms";

export const CUSTOMER_PAYMENT_STATES = [
  "confirm_proposal",
  "deposit_due",
  "progress_due",
  "balance_due",
  "processing",
  "failed_deposit_retryable",
  "failed_inactive",
  "payment_received",
  "no_payment_due",
  "paid_in_full",
  "payments_complete_with_refund",
] as const;

export type PublicPaymentViewState = (typeof CUSTOMER_PAYMENT_STATES)[number];

export const CUSTOMER_PAYMENT_PAYABLE_STATES = [
  "deposit_due",
  "progress_due",
  "balance_due",
  "failed_deposit_retryable",
] as const;

export type CustomerPaymentPayableState =
  (typeof CUSTOMER_PAYMENT_PAYABLE_STATES)[number];

export type PublicPaymentHistoryItem = {
  id: string;
  type: "payment" | "refund";
  kind: JobPaymentKind | null;
  kindLabel: string;
  amountLabel: string;
  paidOnLabel: string | null;
  detail: string | null;
};

export type PublicPaymentOriginalTerms = {
  heading: string;
  depositLine: string;
  balanceLine: string | null;
};

export type PublicPaymentViewModel = {
  state: PublicPaymentViewState;
  kind: JobPaymentKind | null;
  amountLabel: string | null;
  kindLabel: string | null;
  heading: string;
  explanation: string | null;
  contextNote: string | null;
  ctaLabel: string | null;
  stripeNote: string | null;
  paidOnLabel: string | null;
  methodLabel: string | null;
  history: PublicPaymentHistoryItem[];
  originalTerms: PublicPaymentOriginalTerms | null;
};

export type PublicCheckoutRequestSnapshot = {
  kind: JobPaymentKind | string;
  status: string;
  proposal_version_id: string;
  proposal_acceptance_id: string;
  requested_at: string;
};

export function isCustomerPaymentPayableState(
  state: PublicPaymentViewState | null | undefined
): state is CustomerPaymentPayableState {
  return (
    state === "deposit_due" ||
    state === "progress_due" ||
    state === "balance_due" ||
    state === "failed_deposit_retryable"
  );
}

export function publicPaymentKindLabel(kind: JobPaymentKind): string {
  if (kind === "deposit") return PUBLIC_PAYMENT_DEPOSIT_LABEL;
  if (kind === "progress") return PUBLIC_PAYMENT_PROGRESS_LABEL;
  return PUBLIC_PAYMENT_BALANCE_LABEL;
}

export function obligationCta(kind: JobPaymentKind): string {
  if (kind === "deposit") return PUBLIC_PAYMENT_PAY_DEPOSIT_CTA;
  if (kind === "progress") return PUBLIC_PAYMENT_PAY_NOW_CTA;
  return PUBLIC_PAY_REMAINING_BALANCE_CTA;
}

export function publicPaymentTitle(
  state: PublicPaymentViewState,
  kind?: JobPaymentKind | null
): string {
  if (state === "processing") return PUBLIC_PAYMENT_PROCESSING_TITLE;
  if (state === "payment_received") {
    return kind === "deposit" ? "Deposit received" : PUBLIC_PAYMENT_RECEIVED_TITLE;
  }
  if (state === "paid_in_full") return PUBLIC_PAYMENT_PAID_IN_FULL_TITLE;
  if (state === "payments_complete_with_refund") {
    return PUBLIC_PAYMENT_PAYMENTS_COMPLETE_TITLE;
  }
  if (state === "failed_deposit_retryable" || state === "failed_inactive") {
    return PUBLIC_PAYMENT_DIDNT_GO_THROUGH;
  }
  if (state === "no_payment_due") return PUBLIC_PAYMENT_NO_PAYMENT_DUE_NOW;
  if (state === "deposit_due") return PUBLIC_PAYMENT_DEPOSIT_DUE_TITLE;
  if (state === "progress_due" || state === "balance_due") {
    return PUBLIC_PAYMENT_DUE_TITLE;
  }
  return PUBLIC_PAYMENT_DUE_TITLE;
}

function onVersion(
  row: { proposal_version_id: string },
  versionId: string | null | undefined
): boolean {
  if (!versionId) return true;
  return row.proposal_version_id === versionId;
}

function byRequestedAtDesc<T extends { requested_at: string }>(a: T, b: T): number {
  return String(b.requested_at).localeCompare(String(a.requested_at));
}

/**
 * Current request for the accepted-version portal: processing, else open.
 * Failed is never current.
 */
export function customerCurrentRequest(
  requests: readonly JobPaymentRequestRow[],
  proposalVersionId?: string | null
): JobPaymentRequestRow | null {
  const scoped = requests.filter((row) => onVersion(row, proposalVersionId));
  return (
    scoped.find((row) => row.status === "processing") ??
    scoped.find((row) => row.status === "open") ??
    null
  );
}

export function latestFailedRequestOnVersion(
  requests: readonly { kind: string; status: string; proposal_version_id: string; requested_at: string }[],
  proposalVersionId?: string | null
) {
  return requests
    .filter((row) => onVersion(row, proposalVersionId) && row.status === "failed")
    .slice()
    .sort(byRequestedAtDesc)[0] ?? null;
}

function latestPaidRequest(
  requests: readonly JobPaymentRequestRow[]
): JobPaymentRequestRow | null {
  return (
    [...requests]
      .filter((row) => row.status === "paid")
      .sort((a, b) => String(b.paid_at ?? "").localeCompare(String(a.paid_at ?? "")))[0] ??
    null
  );
}

function contractTotalFrom(
  input: {
    contractTotalCents?: number | null;
    requests: readonly JobPaymentRequestRow[];
  }
): number | null {
  if (
    input.contractTotalCents != null &&
    Number.isInteger(input.contractTotalCents) &&
    input.contractTotalCents >= 0
  ) {
    return input.contractTotalCents;
  }
  const snapshot = input.requests
    .map((row) => row.accepted_total_cents_snapshot)
    .filter((cents) => Number.isInteger(cents) && cents > 0)
    .sort((a, b) => b - a)[0];
  return snapshot ?? null;
}

export function depositRetryUncoveredCents(input: {
  terms: ProposalPaymentTerms | null | undefined;
  contractTotalCents: number | null;
  grossCents: number;
  collectibleCents: number;
}): number {
  if (!input.terms || !termsRequireOnlineDeposit(input.terms)) return 0;
  if (input.contractTotalCents == null) return 0;
  const obligation = resolveDepositObligationCents({
    mode: input.terms.depositMode,
    percentBps: input.terms.depositPercentBps,
    fixedCents: input.terms.depositFixedCents,
    acceptedTotalCents: input.contractTotalCents,
  });
  const uncovered = Math.max(0, obligation - Math.max(0, input.grossCents));
  const amount = Math.min(uncovered, Math.max(0, input.collectibleCents));
  if (amount < JOB_PAYMENT_MIN_AMOUNT_CENTS) return 0;
  return amount;
}

export function isFailedDepositRetryEligible(input: {
  failed: { kind: string; status: string; proposal_version_id: string; proposal_acceptance_id?: string };
  hasCurrentRequest: boolean;
  terms?: ProposalPaymentTerms | null;
  contractTotalCents: number | null;
  grossCents: number;
  collectibleCents: number;
  proposalVersionId?: string | null;
  acceptanceId?: string | null;
}): boolean {
  if (input.hasCurrentRequest) return false;
  if (input.failed.status !== "failed" || input.failed.kind !== "deposit") return false;
  if (
    input.proposalVersionId &&
    input.failed.proposal_version_id !== input.proposalVersionId
  ) {
    return false;
  }
  if (
    input.acceptanceId &&
    input.failed.proposal_acceptance_id &&
    input.failed.proposal_acceptance_id !== input.acceptanceId
  ) {
    return false;
  }
  if (input.terms && !termsRequireOnlineDeposit(input.terms)) return false;
  if (input.terms) {
    return (
      depositRetryUncoveredCents({
        terms: input.terms,
        contractTotalCents: input.contractTotalCents,
        grossCents: input.grossCents,
        collectibleCents: input.collectibleCents,
      }) >= JOB_PAYMENT_MIN_AMOUNT_CENTS
    );
  }
  // Terms omitted (fixture): fail open to the server helper, which still owns money.
  return true;
}

/**
 * Checkout may invoke the canonical deposit writer only for:
 * - resolve `not_found` (first deposit / no request history on the version)
 * - resolve `not_payable` when the latest failed row on this version is deposit
 *
 * Failed progress/balance and `already_paid` never enter the helper.
 */
export function publicCheckoutShouldOpenCanonicalDeposit(input: {
  resolveCode: string;
  requests: readonly PublicCheckoutRequestSnapshot[];
  proposalVersionId: string;
  acceptanceId: string;
}): boolean {
  const code = input.resolveCode;
  if (code === "already_paid") return false;
  if (code === "not_found") return true;
  if (code !== "not_payable") return false;

  const scoped = input.requests.filter(
    (row) => row.proposal_version_id === input.proposalVersionId
  );
  if (scoped.some((row) => row.status === "open" || row.status === "processing")) {
    return false;
  }
  const latestFailed = latestFailedRequestOnVersion(scoped, input.proposalVersionId);
  if (!latestFailed || latestFailed.kind !== "deposit") return false;
  const failed = scoped
    .filter((row) => row.status === "failed" && row.kind === "deposit")
    .slice()
    .sort(byRequestedAtDesc)[0];
  if (!failed) return false;
  if (failed.proposal_acceptance_id && failed.proposal_acceptance_id !== input.acceptanceId) {
    return false;
  }
  return true;
}

function receivedHistory(
  requests: readonly JobPaymentRequestRow[],
  current: JobPaymentRequestRow | null,
  refunds: readonly JobPaymentRefundRow[]
): PublicPaymentHistoryItem[] {
  const paid = [...requests]
    .filter((row) => row.status === "paid")
    .sort((a, b) => String(a.paid_at ?? a.requested_at).localeCompare(String(b.paid_at ?? b.requested_at)));
  const visibleRefunds = refunds.filter(
    (row) =>
      row.status === "initiating" ||
      row.status === "pending" ||
      row.status === "requires_action" ||
      row.status === "succeeded"
  );
  const useful =
    visibleRefunds.length > 0 || paid.length >= 2 || (paid.length >= 1 && current != null);
  if (!useful) return [];
  const payments = paid.map((row) => ({
    id: `payment:${row.id}`,
    type: "payment" as const,
    kind: row.kind,
    kindLabel: `${publicPaymentKindLabel(row.kind)} received`,
    amountLabel: formatUsdFromCents(row.amount_cents),
    paidOnLabel: formatProposalCustomerAcceptedOnLabel(row.paid_at),
    detail: null,
    occurredAt: row.paid_at ?? row.requested_at,
  }));
  const refundItems = visibleRefunds.map((row) => {
    const processing = row.status !== "succeeded";
    const amountLabel = formatUsdFromCents(row.amount_cents);
    return {
      id: `refund:${row.id}`,
      type: "refund" as const,
      kind: null,
      kindLabel: processing ? "Refund processing" : "Refund sent",
      amountLabel,
      paidOnLabel: null,
      detail: processing
        ? `A refund of ${amountLabel} is being processed.`
        : `A refund of ${amountLabel} was sent to your original payment method. Your bank may take 5–10 business days to post it.`,
      occurredAt:
        (processing
          ? row.requires_action_at ?? row.pending_at ?? row.initiated_at
          : row.succeeded_at) ??
        row.updated_at ??
        row.created_at,
    };
  });
  return [...payments, ...refundItems]
    .sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)))
    .map((item) => ({
      id: item.id,
      type: item.type,
      kind: item.kind,
      kindLabel: item.kindLabel,
      amountLabel: item.amountLabel,
      paidOnLabel: item.paidOnLabel,
      detail: item.detail,
    }));
}

function originalTermsFor(
  terms: ProposalPaymentTerms | null | undefined,
  hideBalanceLine: boolean
): PublicPaymentOriginalTerms | null {
  if (!terms) return null;
  return formatOriginalProposalTermsCopy(terms, { hideBalanceLine });
}

function baseVm(
  partial: Omit<PublicPaymentViewModel, "history" | "originalTerms"> & {
    history?: PublicPaymentHistoryItem[];
    originalTerms?: PublicPaymentOriginalTerms | null;
  }
): PublicPaymentViewModel {
  return {
    history: partial.history ?? [],
    originalTerms: partial.originalTerms ?? null,
    ...partial,
  };
}

function dueStateForKind(kind: JobPaymentKind): "deposit_due" | "progress_due" | "balance_due" {
  if (kind === "deposit") return "deposit_due";
  if (kind === "progress") return "progress_due";
  return "balance_due";
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
    input.selectedTotalCents < JOB_PAYMENT_MIN_AMOUNT_CENTS
  ) {
    return null;
  }
  const cents = resolveDepositObligationCents({
    mode: input.terms.depositMode,
    percentBps: input.terms.depositPercentBps,
    fixedCents: input.terms.depositFixedCents,
    acceptedTotalCents: input.selectedTotalCents,
  });
  if (cents < JOB_PAYMENT_MIN_AMOUNT_CENTS) return null;
  return baseVm({
    state: "deposit_due",
    kind: "deposit",
    amountLabel: formatUsdFromCents(cents),
    kindLabel: PUBLIC_PAYMENT_DEPOSIT_LABEL,
    heading: PUBLIC_PAYMENT_DEPOSIT_DUE_TITLE,
    explanation: null,
    contextNote: null,
    ctaLabel: PUBLIC_PAYMENT_PAY_DEPOSIT_CTA,
    stripeNote: PUBLIC_PAYMENT_STRIPE_NOTE,
    paidOnLabel: null,
    methodLabel: null,
    originalTerms: originalTermsFor(input.terms, true),
  });
}

export function buildPublicPaymentViewModel(input: {
  requests: readonly JobPaymentRequestRow[];
  transactions?: readonly JobPaymentTransactionRow[];
  refunds?: readonly JobPaymentRefundRow[];
  returnHint?: "pending" | "cancelled" | null;
  accepted?: boolean;
  terms?: ProposalPaymentTerms | null;
  contractTotalCents?: number | null;
  proposalVersionId?: string | null;
  acceptanceId?: string | null;
}): PublicPaymentViewModel | null {
  const transactions = input.transactions ?? [];
  const refunds = input.refunds ?? [];
  const current = customerCurrentRequest(input.requests, input.proposalVersionId);
  const paid = latestPaidRequest(input.requests);
  const contractTotalCents = contractTotalFrom(input);
  const grossCents = jobPaymentWorkspaceGrossCents(transactions);
  const refundedCents = jobPaymentWorkspaceRefundedCents(refunds);
  const collectibleCents = jobPaymentCollectibleRemainingCents({
    contractTotalCents,
    receivedGrossCents: grossCents,
  });
  const fullyCollected =
    contractTotalCents != null &&
    collectibleCents < JOB_PAYMENT_MIN_AMOUNT_CENTS &&
    grossCents > 0;
  const hideBalanceLine =
    current?.kind === "progress" ||
    current?.kind === "balance" ||
    current?.kind === "deposit";
  const termsVm = originalTermsFor(input.terms, hideBalanceLine);
  const history = receivedHistory(input.requests, current, refunds);

  const overlayPending =
    input.returnHint === "pending" && current?.status === "open";

  if (current) {
    const processing = current.status === "processing" || overlayPending;
    const kind = current.kind;
    if (processing) {
      return baseVm({
        state: "processing",
        kind,
        amountLabel: formatUsdFromCents(current.amount_cents),
        kindLabel: publicPaymentKindLabel(kind),
        heading: PUBLIC_PAYMENT_PROCESSING_TITLE,
        explanation: PUBLIC_PAYMENT_PROCESSING_EXPLANATION,
        contextNote: null,
        ctaLabel: null,
        stripeNote: null,
        paidOnLabel: null,
        methodLabel: null,
        history,
        originalTerms: termsVm,
      });
    }
    const state = dueStateForKind(kind);
    return baseVm({
      state,
      kind,
      amountLabel: formatUsdFromCents(current.amount_cents),
      kindLabel: publicPaymentKindLabel(kind),
      heading:
        kind === "deposit" ? PUBLIC_PAYMENT_DEPOSIT_DUE_TITLE : PUBLIC_PAYMENT_DUE_TITLE,
      explanation: null,
      contextNote: kind === "progress" ? PUBLIC_PAYMENT_CONTRACTOR_REQUESTED : null,
      ctaLabel: obligationCta(kind),
      stripeNote: PUBLIC_PAYMENT_STRIPE_NOTE,
      paidOnLabel: null,
      methodLabel: null,
      history,
      originalTerms: termsVm,
    });
  }

  const failed = latestFailedRequestOnVersion(input.requests, input.proposalVersionId);
  if (failed) {
    const retryable = isFailedDepositRetryEligible({
      failed,
      hasCurrentRequest: false,
      terms: input.terms,
      contractTotalCents,
      grossCents,
      collectibleCents,
      proposalVersionId: input.proposalVersionId,
      acceptanceId: input.acceptanceId,
    });
    if (retryable) {
      const failedRow = input.requests.find(
        (row) =>
          row.status === "failed" &&
          row.kind === "deposit" &&
          onVersion(row, input.proposalVersionId) &&
          row.requested_at === failed.requested_at
      );
      const uncovered = input.terms
        ? depositRetryUncoveredCents({
            terms: input.terms,
            contractTotalCents,
            grossCents,
            collectibleCents,
          })
        : 0;
      const amountCents =
        uncovered >= JOB_PAYMENT_MIN_AMOUNT_CENTS
          ? uncovered
          : failedRow?.amount_cents ?? 0;
      return baseVm({
        state: "failed_deposit_retryable",
        kind: "deposit",
        amountLabel: amountCents > 0 ? formatUsdFromCents(amountCents) : null,
        kindLabel: PUBLIC_PAYMENT_DEPOSIT_LABEL,
        heading: PUBLIC_PAYMENT_DIDNT_GO_THROUGH,
        explanation: PUBLIC_PAYMENT_FAILED_DEPOSIT_RETRY_EXPLANATION,
        contextNote: null,
        ctaLabel: PUBLIC_PAYMENT_TRY_AGAIN_CTA,
        stripeNote: PUBLIC_PAYMENT_STRIPE_NOTE,
        paidOnLabel: null,
        methodLabel: null,
        history,
        originalTerms: originalTermsFor(input.terms, true),
      });
    }
    const failedRow = input.requests.find(
      (row) =>
        row.status === "failed" &&
        onVersion(row, input.proposalVersionId) &&
        row.requested_at === failed.requested_at
    );
    return baseVm({
      state: "failed_inactive",
      kind: (failedRow?.kind ?? failed.kind) as JobPaymentKind,
      amountLabel: failedRow ? formatUsdFromCents(failedRow.amount_cents) : null,
      kindLabel: failedRow ? publicPaymentKindLabel(failedRow.kind) : null,
      heading: PUBLIC_PAYMENT_DIDNT_GO_THROUGH,
      explanation: PUBLIC_PAYMENT_FAILED_INACTIVE_EXPLANATION,
      contextNote: null,
      ctaLabel: null,
      stripeNote: null,
      paidOnLabel: null,
      methodLabel: null,
      history,
      originalTerms: termsVm,
    });
  }

  if (fullyCollected && refundedCents > 0) {
    return baseVm({
      state: "payments_complete_with_refund",
      kind: paid?.kind ?? null,
      amountLabel: null,
      kindLabel: null,
      heading: PUBLIC_PAYMENT_PAYMENTS_COMPLETE_TITLE,
      explanation: PUBLIC_PAYMENT_PAYMENTS_COMPLETE_EXPLANATION,
      contextNote: null,
      ctaLabel: null,
      stripeNote: null,
      paidOnLabel: null,
      methodLabel: null,
      history,
      originalTerms: originalTermsFor(input.terms, true),
    });
  }

  if (fullyCollected && refundedCents === 0) {
    return baseVm({
      state: "paid_in_full",
      kind: paid?.kind ?? null,
      amountLabel: null,
      kindLabel: null,
      heading: PUBLIC_PAYMENT_PAID_IN_FULL_TITLE,
      explanation: PUBLIC_PAYMENT_PAID_IN_FULL_EXPLANATION,
      contextNote: null,
      ctaLabel: null,
      stripeNote: null,
      paidOnLabel: null,
      methodLabel: null,
      history,
      originalTerms: originalTermsFor(input.terms, true),
    });
  }

  if (paid && collectibleCents >= JOB_PAYMENT_MIN_AMOUNT_CENTS) {
    return baseVm({
      state: "payment_received",
      kind: paid.kind,
      amountLabel: formatUsdFromCents(paid.amount_cents),
      kindLabel: publicPaymentKindLabel(paid.kind),
      heading: PUBLIC_PAYMENT_RECEIVED_TITLE,
      explanation: PUBLIC_PAYMENT_NO_PAYMENT_DUE_NOW,
      contextNote: null,
      ctaLabel: null,
      stripeNote: null,
      paidOnLabel: formatProposalCustomerAcceptedOnLabel(paid.paid_at),
      methodLabel: (paid.settled_payment_method_label ?? "").trim() || null,
      history,
      originalTerms: originalTermsFor(input.terms, false),
    });
  }

  if (paid && !fullyCollected) {
    return baseVm({
      state: "payment_received",
      kind: paid.kind,
      amountLabel: formatUsdFromCents(paid.amount_cents),
      kindLabel: publicPaymentKindLabel(paid.kind),
      heading: PUBLIC_PAYMENT_RECEIVED_TITLE,
      explanation: PUBLIC_PAYMENT_NO_PAYMENT_DUE_NOW,
      contextNote: null,
      ctaLabel: null,
      stripeNote: null,
      paidOnLabel: formatProposalCustomerAcceptedOnLabel(paid.paid_at),
      methodLabel: (paid.settled_payment_method_label ?? "").trim() || null,
      history,
      originalTerms: originalTermsFor(input.terms, false),
    });
  }

  const uncoveredDeposit = depositRetryUncoveredCents({
    terms: input.terms,
    contractTotalCents,
    grossCents,
    collectibleCents,
  });
  if (input.accepted && uncoveredDeposit >= JOB_PAYMENT_MIN_AMOUNT_CENTS) {
    return baseVm({
      state: "deposit_due",
      kind: "deposit",
      amountLabel: formatUsdFromCents(uncoveredDeposit),
      kindLabel: PUBLIC_PAYMENT_DEPOSIT_LABEL,
      heading: PUBLIC_PAYMENT_DEPOSIT_DUE_TITLE,
      explanation: null,
      contextNote: null,
      ctaLabel: PUBLIC_PAYMENT_PAY_DEPOSIT_CTA,
      stripeNote: PUBLIC_PAYMENT_STRIPE_NOTE,
      paidOnLabel: null,
      methodLabel: null,
      history,
      originalTerms: originalTermsFor(input.terms, true),
    });
  }

  if (input.accepted && collectibleCents >= JOB_PAYMENT_MIN_AMOUNT_CENTS) {
    return baseVm({
      state: "no_payment_due",
      kind: null,
      amountLabel: null,
      kindLabel: null,
      heading: PUBLIC_PAYMENT_NO_PAYMENT_DUE_NOW,
      explanation: null,
      contextNote: null,
      ctaLabel: null,
      stripeNote: null,
      paidOnLabel: null,
      methodLabel: null,
      history,
      originalTerms: originalTermsFor(input.terms, false),
    });
  }

  if (!input.accepted && input.terms) {
    const prospective = buildProspectiveDepositPaymentViewModel({
      terms: input.terms,
      selectedTotalCents: input.contractTotalCents ?? null,
    });
    if (prospective) return prospective;
    return baseVm({
      state: "confirm_proposal",
      kind: null,
      amountLabel: null,
      kindLabel: null,
      heading: PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_CTA,
      explanation: null,
      contextNote: null,
      ctaLabel: PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_CTA,
      stripeNote: null,
      paidOnLabel: null,
      methodLabel: null,
      originalTerms: originalTermsFor(input.terms, false),
    });
  }

  return null;
}

/**
 * `?payment=pending` may overlay processing only while the request is still open.
 * It must never manufacture paid, and must not hide failed/fully-collected truth.
 */
export function applyCustomerPaymentReturnHint(
  payment: PublicPaymentViewModel | null,
  hint: "pending" | "cancelled" | null | undefined
): PublicPaymentViewModel | null {
  if (!payment || hint !== "pending") return payment;
  if (
    payment.state !== "deposit_due" &&
    payment.state !== "progress_due" &&
    payment.state !== "balance_due"
  ) {
    return payment;
  }
  return {
    ...payment,
    state: "processing",
    heading: PUBLIC_PAYMENT_PROCESSING_TITLE,
    explanation: PUBLIC_PAYMENT_PROCESSING_EXPLANATION,
    ctaLabel: null,
    stripeNote: null,
    contextNote: null,
  };
}
