"use client";

import { useCallback, useState } from "react";
import {
  isCustomerPaymentPayableState,
  type PublicPaymentViewModel,
} from "@/app/lib/jobPaymentCustomerPresenter";
import {
  PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUPERSEDED_MESSAGE,
  PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_CTA,
  PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_BUSY,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  depositContinuationNeedsCustomerAttention,
  type DepositContinuationEnvelope,
  type CheckoutContinuationEnvelope,
} from "@/app/lib/proposalAcceptanceDepositEnvelope";
import { PUBLIC_PAY_DEPOSIT_CTA } from "@/app/lib/proposalPaymentTerms";

export const PROPOSAL_PURCHASE_PAY_BUSY_LABEL = "Opening…";

export const PROPOSAL_PURCHASE_PAY_ERROR =
  "We could not start this payment. Please try again.";

export const PROPOSAL_PURCHASE_CONFIRM_ERROR =
  "We could not confirm this proposal. Please try again.";

export const PROPOSAL_PURCHASE_RETRY_PAYMENT_CTA = "Retry payment";

/** Which real-world commitment this proposal asks the customer to make. */
export type ProposalPurchaseActionKind = "pay" | "confirm" | "none";

/**
 * Client surface for Phase 2B2 partial-success purchase outcomes.
 * Consumes the server acceptance/deposit/checkout envelopes — does not invent truth.
 */
export type ProposalPurchaseOutcome =
  | "idle"
  | "accepting"
  | "accepted"
  | "accepted_payment_ready"
  | "accepted_payment_setup_required"
  | "accepted_payment_continuation_failed"
  | "payment_processing"
  | "paid";

export type ProposalPurchaseAction = {
  kind: ProposalPurchaseActionKind;
  /** Label for the one primary action, or null when no action is offered. */
  label: string | null;
  busy: boolean;
  error: string | null;
  /** Secondary factual note after durable acceptance (payment continuation). */
  continuationNote: string | null;
  outcome: ProposalPurchaseOutcome;
  submit: () => void;
};

type UseProposalPurchaseActionInput = {
  payment: PublicPaymentViewModel | null;
  publicAccessToken: string | null;
  /** Frozen option key the customer chose. Null when there is nothing to choose. */
  chosenOptionKey: string | null;
  accepted: boolean;
  onConfirmed: () => void;
};

type PurchaseResponseBody = {
  ok?: boolean;
  url?: string;
  code?: string;
  title?: string;
  acceptance?: { status?: string; acceptanceId?: string } | null;
  deposit?: DepositContinuationEnvelope | null;
  checkout?: CheckoutContinuationEnvelope | null;
};

function outcomeFromDeposit(
  deposit: DepositContinuationEnvelope | null | undefined
): ProposalPurchaseOutcome {
  if (!deposit) return "accepted";
  switch (deposit.status) {
    case "ready":
      return "accepted_payment_ready";
    case "setup_required":
      return "accepted_payment_setup_required";
    case "conflict":
    case "continuation_failed":
    case "checking":
      return "accepted_payment_continuation_failed";
    case "not_required":
    case "satisfied":
    default:
      return "accepted";
  }
}

function paymentNoteFromEnvelopes(input: {
  deposit?: DepositContinuationEnvelope | null;
  checkout?: CheckoutContinuationEnvelope | null;
}): string | null {
  const checkout = input.checkout;
  if (checkout?.message) return checkout.message;
  const deposit = input.deposit;
  if (deposit && depositContinuationNeedsCustomerAttention(deposit.status)) {
    return deposit.message;
  }
  if (deposit?.status === "ready" && deposit.message) return deposit.message;
  return null;
}

/**
 * The single canonical customer commitment for this proposal.
 *
 * Called exactly once per page. The purchase composition and the sticky mobile
 * bar both render this same action, so there is one handler and one request —
 * the sticky bar is presentation, not a second code path.
 *
 * Phase 2B2: durable acceptance success is never discarded because payment
 * continuation failed. Payment-only errors use payment copy and CTAs.
 */
export function useProposalPurchaseAction({
  payment,
  publicAccessToken,
  chosenOptionKey,
  accepted,
  onConfirmed,
}: UseProposalPurchaseActionInput): ProposalPurchaseAction {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [continuationNote, setContinuationNote] = useState<string | null>(null);
  const [localOutcome, setLocalOutcome] = useState<ProposalPurchaseOutcome | null>(
    null
  );

  const paymentState = payment?.state ?? null;
  const payableNow =
    isCustomerPaymentPayableState(paymentState) && Boolean(payment?.ctaLabel);

  const kind: ProposalPurchaseActionKind = !publicAccessToken
    ? "none"
    : payableNow
      ? "pay"
      : paymentState === "confirm_proposal"
        ? "confirm"
        : accepted
          ? "none"
          : paymentState
            ? "none"
            : "confirm";

  const derivedOutcome: ProposalPurchaseOutcome =
    paymentState === "processing"
      ? "payment_processing"
      : paymentState === "payment_received" ||
          paymentState === "paid_in_full" ||
          paymentState === "payments_complete_with_refund"
        ? "paid"
        : localOutcome
          ? localOutcome
          : accepted
            ? payableNow
              ? "accepted_payment_ready"
              : "accepted"
            : "idle";

  const submit = useCallback(() => {
    if (!publicAccessToken || busy || kind === "none") return;
    setBusy(true);
    setError(null);
    setContinuationNote(null);
    setLocalOutcome("accepting");

    const endpoint =
      kind === "pay" ? "/api/public/payment-requests/checkout" : "/api/proposals/accept";

    // Only an option key ever leaves the client. Amounts and bindings are
    // derived server-side from frozen truth.
    const body: { token: string; optionKey?: string } = { token: publicAccessToken };
    if (chosenOptionKey) {
      body.optionKey = chosenOptionKey;
    }

    void (async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await response.json().catch(() => null)) as PurchaseResponseBody | null;

        const acceptanceKnown =
          data?.ok === true &&
          data.acceptance != null &&
          (data.acceptance.status === "accepted" ||
            data.acceptance.status === "replayed");

        // Pre-acceptance hard failure only.
        if (!acceptanceKnown && (!response.ok || data?.ok !== true)) {
          if (kind === "pay") {
            setError(PROPOSAL_PURCHASE_PAY_ERROR);
          } else if (data?.code === "superseded") {
            setError(PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUPERSEDED_MESSAGE);
          } else {
            setError(PROPOSAL_PURCHASE_CONFIRM_ERROR);
          }
          setLocalOutcome(null);
          setBusy(false);
          return;
        }

        if (acceptanceKnown) {
          onConfirmed();
          const outcome = outcomeFromDeposit(data.deposit);
          setLocalOutcome(outcome);
          const note = paymentNoteFromEnvelopes({
            deposit: data.deposit,
            checkout: data.checkout,
          });
          setContinuationNote(note);

          if (kind === "pay") {
            const url =
              (typeof data.url === "string" && data.url) ||
              (typeof data.checkout?.url === "string" ? data.checkout.url : "");
            if (url) {
              window.location.assign(url);
              return;
            }
            // Acceptance durable; checkout did not open — payment-only issue.
            if (data.checkout?.status === "already_paid") {
              setLocalOutcome("paid");
              setError(null);
            } else if (data.checkout?.status === "processing") {
              setLocalOutcome("payment_processing");
              setError(null);
            } else if (
              data.checkout ||
              (data.deposit &&
                depositContinuationNeedsCustomerAttention(data.deposit.status))
            ) {
              setError(note ?? PROPOSAL_PURCHASE_PAY_ERROR);
            }
            setBusy(false);
            return;
          }

          // Confirm path: acceptance recorded; payment note is secondary.
          if (
            data.deposit &&
            depositContinuationNeedsCustomerAttention(data.deposit.status)
          ) {
            setError(null);
          }
          setBusy(false);
          return;
        }

        // Legacy success without envelope (should not happen after 2B2).
        if (kind === "pay") {
          const url = typeof data?.url === "string" ? data.url : "";
          if (!url) {
            setError(PROPOSAL_PURCHASE_PAY_ERROR);
            setLocalOutcome(null);
            setBusy(false);
            return;
          }
          window.location.assign(url);
          return;
        }

        onConfirmed();
        setLocalOutcome("accepted");
        setBusy(false);
      } catch {
        setError(kind === "pay" ? PROPOSAL_PURCHASE_PAY_ERROR : PROPOSAL_PURCHASE_CONFIRM_ERROR);
        setLocalOutcome(null);
        setBusy(false);
      }
    })();
  }, [busy, chosenOptionKey, kind, onConfirmed, publicAccessToken]);

  const label =
    kind === "pay"
      ? busy
        ? PROPOSAL_PURCHASE_PAY_BUSY_LABEL
        : (payment?.ctaLabel ?? PUBLIC_PAY_DEPOSIT_CTA)
      : kind === "confirm"
        ? busy
          ? PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_BUSY
          : PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_CTA
        : null;

  return {
    kind,
    label,
    busy,
    error,
    continuationNote,
    outcome: derivedOutcome,
    submit,
  };
}
