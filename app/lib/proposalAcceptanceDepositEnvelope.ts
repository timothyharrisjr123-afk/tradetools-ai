/**
 * Phase 2B2 — FD-P1-05 partial-success envelope.
 *
 * Acceptance result and deposit continuation are separate truths.
 * Durable acceptance must never be reported as acceptance failure.
 */

import type { OpenJobDepositFromAcceptanceResult } from "@/app/lib/proposalPaymentTermsPersistence";

export const ACCEPTANCE_RECORDED_TITLE = "Your acceptance is recorded.";

export const DEPOSIT_CONTINUATION_COPY = {
  not_required: null as string | null,
  satisfied: null as string | null,
  ready: "Your deposit is ready for payment.",
  setup_required:
    "Payment is not available yet. The contractor will follow up.",
  conflict:
    "A payment request is already in progress. You do not need to accept again.",
  continuation_failed:
    "We could not finish the payment step yet. You do not need to accept again.",
  checking:
    "We’re checking the payment request. You do not need to accept again.",
} as const;

export type AcceptanceEnvelopeStatus = "accepted" | "replayed";

export type DepositContinuationStatus =
  | "not_required"
  | "satisfied"
  | "ready"
  | "setup_required"
  | "conflict"
  | "continuation_failed"
  | "checking";

export type AcceptanceResultEnvelope = {
  status: AcceptanceEnvelopeStatus;
  acceptanceId: string;
  acceptedAt: string;
  proposalVersionId?: string | null;
  idempotentReplay: boolean;
};

export type DepositContinuationEnvelope = {
  status: DepositContinuationStatus;
  code: string | null;
  paymentRequestId: string | null;
  amountCents: number | null;
  message: string | null;
};

export type CheckoutContinuationStatus =
  | "ready"
  | "already_paid"
  | "processing"
  | "not_payable"
  | "reconciliation_unavailable"
  | "failed";

export type CheckoutContinuationEnvelope = {
  status: CheckoutContinuationStatus;
  code: string | null;
  url: string | null;
  message: string | null;
};

export function mapDepositContinuation(
  result: OpenJobDepositFromAcceptanceResult
): DepositContinuationEnvelope {
  if (result.ok) {
    if (result.skipped) {
      const code = (result.code ?? "").trim();
      if (code === "deposit_satisfied") {
        return {
          status: "satisfied",
          code: code || "deposit_satisfied",
          paymentRequestId: result.id ?? null,
          amountCents: result.amount_cents ?? null,
          message: DEPOSIT_CONTINUATION_COPY.satisfied,
        };
      }
      return {
        status: "not_required",
        code: code || "no_deposit",
        paymentRequestId: result.id ?? null,
        amountCents: result.amount_cents ?? null,
        message: DEPOSIT_CONTINUATION_COPY.not_required,
      };
    }
    return {
      status: "ready",
      code: result.idempotent_replay ? "idempotent_replay" : null,
      paymentRequestId: result.id ?? null,
      amountCents: result.amount_cents ?? null,
      message: DEPOSIT_CONTINUATION_COPY.ready,
    };
  }

  const code = result.code;
  if (code === "not_connected") {
    return {
      status: "setup_required",
      code,
      paymentRequestId: null,
      amountCents: null,
      message: DEPOSIT_CONTINUATION_COPY.setup_required,
    };
  }
  if (code === "conflicting_request") {
    return {
      status: "conflict",
      code,
      paymentRequestId: null,
      amountCents: null,
      message: DEPOSIT_CONTINUATION_COPY.conflict,
    };
  }
  return {
    status: "continuation_failed",
    code,
    paymentRequestId: null,
    amountCents: null,
    message: DEPOSIT_CONTINUATION_COPY.continuation_failed,
  };
}

export function mapCheckoutContinuationError(
  code: string
): CheckoutContinuationEnvelope {
  if (code === "already_paid") {
    return {
      status: "already_paid",
      code,
      url: null,
      message: "This payment is already complete.",
    };
  }
  if (code === "processing") {
    return {
      status: "processing",
      code,
      url: null,
      message: "Payment processing. You do not need to pay again.",
    };
  }
  if (code === "checkout_reconciliation_unavailable") {
    return {
      status: "reconciliation_unavailable",
      code,
      url: null,
      message: DEPOSIT_CONTINUATION_COPY.checking,
    };
  }
  if (code === "not_payable") {
    return {
      status: "not_payable",
      code,
      url: null,
      message: DEPOSIT_CONTINUATION_COPY.continuation_failed,
    };
  }
  return {
    status: "failed",
    code,
    url: null,
    message: "We could not start this payment. Please try again.",
  };
}

export function depositContinuationNeedsCustomerAttention(
  status: DepositContinuationStatus
): boolean {
  return (
    status === "setup_required" ||
    status === "conflict" ||
    status === "continuation_failed" ||
    status === "checking"
  );
}
