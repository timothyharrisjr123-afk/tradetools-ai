"use client";

import { useCallback, useState } from "react";
import {
  isCustomerPaymentPayableState,
  type PublicPaymentViewModel,
} from "@/app/lib/jobPaymentCustomerPresenter";
import {
  PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_CTA,
  PROPOSAL_CUSTOMER_PACKET_CONFIRM_PROPOSAL_BUSY,
} from "@/app/lib/proposalCustomerPacketViewModel";
import { PUBLIC_PAY_DEPOSIT_CTA } from "@/app/lib/proposalPaymentTerms";

export const PROPOSAL_PURCHASE_PAY_BUSY_LABEL = "Opening…";

export const PROPOSAL_PURCHASE_PAY_ERROR =
  "We could not start this payment. Please try again.";

export const PROPOSAL_PURCHASE_CONFIRM_ERROR =
  "We could not confirm this proposal. Please try again.";

/** Which real-world commitment this proposal asks the customer to make. */
export type ProposalPurchaseActionKind = "pay" | "confirm" | "none";

export type ProposalPurchaseAction = {
  kind: ProposalPurchaseActionKind;
  /** Label for the one primary action, or null when no action is offered. */
  label: string | null;
  busy: boolean;
  error: string | null;
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

/**
 * The single canonical customer commitment for this proposal.
 *
 * Called exactly once per page. The purchase composition and the sticky mobile
 * bar both render this same action, so there is one handler and one request —
 * the sticky bar is presentation, not a second code path.
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

  const submit = useCallback(() => {
    if (!publicAccessToken || busy || kind === "none") return;
    setBusy(true);
    setError(null);

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
        const data = (await response.json().catch(() => null)) as
          | { ok?: boolean; url?: string }
          | null;

        if (!response.ok || data?.ok !== true) {
          setError(kind === "pay" ? PROPOSAL_PURCHASE_PAY_ERROR : PROPOSAL_PURCHASE_CONFIRM_ERROR);
          setBusy(false);
          return;
        }

        if (kind === "pay") {
          const url = typeof data.url === "string" ? data.url : "";
          if (!url) {
            setError(PROPOSAL_PURCHASE_PAY_ERROR);
            setBusy(false);
            return;
          }
          window.location.assign(url);
          return;
        }

        onConfirmed();
      } catch {
        setError(kind === "pay" ? PROPOSAL_PURCHASE_PAY_ERROR : PROPOSAL_PURCHASE_CONFIRM_ERROR);
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

  return { kind, label, busy, error, submit };
}
