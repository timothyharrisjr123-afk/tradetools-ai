"use client";

import type { PublicPaymentViewModel } from "@/app/lib/jobPaymentReadModel";
import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import {
  PROPOSAL_CUSTOMER_PACKET_CONFIRMED_TITLE,
  PROPOSAL_CUSTOMER_PACKET_DUE_TODAY_LABEL,
  PROPOSAL_CUSTOMER_PACKET_YOUR_PACKAGE_LABEL,
  formatProposalCustomerAcceptedOnSentence,
  proposalCustomerAmountLabel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  formatPaymentTermsCustomerCopy,
  resolveDepositObligationCents,
  termsRequireOnlineDeposit,
  type ProposalPaymentTerms,
} from "@/app/lib/proposalPaymentTerms";
import { IconCheck } from "./ProposalPacketIcons";
import {
  PROPOSAL_PACKET_CTA_PRIMARY_DOMINANT,
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_INVESTMENT,
  PROPOSAL_PACKET_PURCHASE,
  PROPOSAL_PACKET_PURCHASE_DIVIDER,
  PROPOSAL_PACKET_PURCHASE_DUE_AMOUNT,
} from "./proposalPacketStyles";
import type { ProposalPurchaseAction } from "./useProposalPurchaseAction";

export const PROPOSAL_PURCHASE_PROCESSING_TITLE = "Payment processing";
export const PROPOSAL_PURCHASE_FAILED_TITLE = "Payment didn't complete";

type ProposalPacketPurchaseProps = {
  packageLabel: string;
  packageDescription?: string | null;
  packageTotalLabel: string | null;
  packageTotalCents: number | null;
  differentiators?: readonly string[];
  terms: ProposalPaymentTerms | null;
  payment: PublicPaymentViewModel | null;
  accepted: boolean;
  acceptedOnLabel: string | null;
  action: ProposalPurchaseAction;
};

/**
 * The buying decision. One composition holds the chosen package, its price, the
 * payment terms, what is due today, and the single primary action — so payment
 * reads as part of the proposal rather than a bolted-on panel.
 */
export default function ProposalPacketPurchase({
  packageLabel,
  packageDescription = null,
  packageTotalLabel,
  packageTotalCents,
  differentiators = [],
  terms,
  payment,
  accepted,
  acceptedOnLabel,
  action,
}: ProposalPacketPurchaseProps) {
  const requiresDeposit = terms ? termsRequireOnlineDeposit(terms) : false;
  const state = payment?.state ?? null;

  // Terms copy never carries the amount; the amount belongs to the due-now line.
  const termsCopy = terms ? formatPaymentTermsCustomerCopy(terms, null) : null;

  // Before acceptance the customer may still change package, so what is due is
  // derived from the package they have chosen. Once accepted the choice is
  // contractual and the server-owned amount governs.
  const derivedDueCents =
    terms && requiresDeposit && packageTotalCents != null
      ? resolveDepositObligationCents({
          mode: terms.depositMode,
          percentBps: terms.depositPercentBps,
          fixedCents: terms.depositFixedCents,
          acceptedTotalCents: packageTotalCents,
        })
      : 0;

  const dueLabel = proposalCustomerAmountLabel(
    accepted || state === "failed"
      ? payment?.amountLabel
      : derivedDueCents > 0
        ? formatUsdFromCents(derivedDueCents)
        : payment?.amountLabel
  );

  const showDueLine = action.kind === "pay" && dueLabel != null;

  return (
    <div className={PROPOSAL_PACKET_PURCHASE} data-proposal-purchase data-proposal-purchase-state={state ?? "open"}>
      <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PROPOSAL_CUSTOMER_PACKET_YOUR_PACKAGE_LABEL}</p>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[1.5rem] font-semibold tracking-[-0.03em] text-[#0b1f33] sm:text-[1.7rem]">
          {packageLabel}
        </h2>
        {packageTotalLabel ? (
          <p className={PROPOSAL_PACKET_INVESTMENT}>{packageTotalLabel}</p>
        ) : null}
      </div>

      {packageDescription ? (
        <p className="mt-1.5 max-w-[34rem] text-[13.5px] leading-[1.55] text-[#64748b]">
          {packageDescription}
        </p>
      ) : differentiators.length > 0 ? (
        <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[#64748b]">
          {differentiators.slice(0, 3).join(" · ")}
        </p>
      ) : null}

      {termsCopy ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <div className="space-y-1">
            <p className="text-[13.5px] text-[#334155]">{termsCopy.depositLine}</p>
            {requiresDeposit ? (
              <p className="text-[13.5px] text-[#64748b]">{termsCopy.balanceLine}</p>
            ) : null}
          </div>
        </>
      ) : null}

      {state === "received" ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-medium text-emerald-700">
            <IconCheck className="h-4 w-4 shrink-0" />
            <span>
              {payment?.paidOnLabel
                ? `${payment.kindLabel} received ${payment.paidOnLabel}`
                : `${payment?.kindLabel ?? "Payment"} received`}
            </span>
          </p>
          {payment?.methodLabel ? (
            <p className="mt-1 text-[13px] text-[#64748b]" data-public-payment-method>
              {payment.methodLabel}
            </p>
          ) : null}
        </>
      ) : null}

      {state === "pending" ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <p className="text-[14px] font-medium text-[#475569]">{PROPOSAL_PURCHASE_PROCESSING_TITLE}</p>
          {payment?.explanation ? (
            <p className="mt-1 max-w-[34rem] text-[13px] leading-relaxed text-[#64748b]">
              {payment.explanation}
            </p>
          ) : null}
        </>
      ) : null}

      {state === "refunded" ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <p className="text-[14px] font-medium text-[#475569]">{payment?.kindLabel} refunded</p>
          {payment?.explanation ? (
            <p className="mt-1 text-[13px] leading-relaxed text-[#64748b]">{payment.explanation}</p>
          ) : null}
        </>
      ) : null}

      {state === "failed" ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <p className="text-[14px] font-medium text-[#b42318]">{PROPOSAL_PURCHASE_FAILED_TITLE}</p>
          {payment?.explanation ? (
            <p className="mt-1 text-[13px] leading-relaxed text-[#64748b]">{payment.explanation}</p>
          ) : null}
        </>
      ) : null}

      {accepted && action.kind === "none" && state !== "received" && state !== "pending" ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <p className="text-[14px] font-semibold text-[#0b1f33]">
            {PROPOSAL_CUSTOMER_PACKET_CONFIRMED_TITLE}
          </p>
          <p className="mt-0.5 text-[13px] text-[#64748b]">
            {formatProposalCustomerAcceptedOnSentence(acceptedOnLabel)}
          </p>
        </>
      ) : null}

      {action.kind !== "none" ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          {showDueLine ? (
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[14px] font-medium text-[#475569]">
                {PROPOSAL_CUSTOMER_PACKET_DUE_TODAY_LABEL}
              </p>
              <p className={PROPOSAL_PACKET_PURCHASE_DUE_AMOUNT} data-proposal-due-today>
                {dueLabel}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            className={PROPOSAL_PACKET_CTA_PRIMARY_DOMINANT}
            onClick={action.submit}
            disabled={action.busy}
            data-proposal-primary-action={action.kind}
            data-public-pay={action.kind === "pay" ? "" : undefined}
          >
            {action.label}
          </button>

          {action.error ? (
            <p className="mt-2 text-[13px] text-[#b42318]" role="alert">
              {action.error}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
