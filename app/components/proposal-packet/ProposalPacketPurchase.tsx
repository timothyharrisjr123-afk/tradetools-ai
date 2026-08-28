"use client";

import type { PublicPaymentViewModel } from "@/app/lib/jobPaymentReadModel";
import { isCustomerPaymentPayableState } from "@/app/lib/jobPaymentCustomerPresenter";
import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import {
  PUBLIC_PAYMENT_HISTORY_HEADING,
} from "@/app/lib/jobPaymentTypes";
import {
  PROPOSAL_CUSTOMER_PACKET_CONFIRMED_TITLE,
  PROPOSAL_CUSTOMER_PACKET_YOUR_PACKAGE_LABEL,
  formatProposalCustomerAcceptedOnSentence,
  proposalCustomerAmountLabel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
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
export const PROPOSAL_PURCHASE_FAILED_TITLE = "Payment didn't go through";

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

function dueAmountLabel(input: {
  accepted: boolean;
  payment: PublicPaymentViewModel | null;
  terms: ProposalPaymentTerms | null;
  packageTotalCents: number | null;
}): string | null {
  const state = input.payment?.state ?? null;
  const serverAmount = proposalCustomerAmountLabel(input.payment?.amountLabel);
  if (input.accepted || isCustomerPaymentPayableState(state) || state === "processing") {
    return serverAmount;
  }
  const requiresDeposit = input.terms ? termsRequireOnlineDeposit(input.terms) : false;
  if (requiresDeposit && input.packageTotalCents != null && input.terms) {
    const cents = resolveDepositObligationCents({
      mode: input.terms.depositMode,
      percentBps: input.terms.depositPercentBps,
      fixedCents: input.terms.depositFixedCents,
      acceptedTotalCents: input.packageTotalCents,
    });
    if (cents > 0) return proposalCustomerAmountLabel(formatUsdFromCents(cents));
  }
  return serverAmount;
}

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
  const state = payment?.state ?? null;
  const dueLabel = dueAmountLabel({
    accepted,
    payment,
    terms,
    packageTotalCents,
  });
  const showDueBlock =
    action.kind === "pay" &&
    (state === "deposit_due" || state === "progress_due" || state === "balance_due") &&
    dueLabel != null;
  const originalTerms = payment?.originalTerms;
  const liveStatus =
    state === "processing" ||
    state === "payment_received" ||
    state === "paid_in_full" ||
    state === "payments_complete_with_refund" ||
    state === "failed_deposit_retryable" ||
    state === "failed_inactive" ||
    state === "no_payment_due";

  return (
    <div
      className={PROPOSAL_PACKET_PURCHASE}
      data-proposal-purchase
      data-proposal-purchase-state={state ?? "open"}
    >
      <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PROPOSAL_CUSTOMER_PACKET_YOUR_PACKAGE_LABEL}</p>

      <div className="mt-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="min-w-0 text-[1.5rem] font-semibold tracking-[-0.03em] text-[#0b1f33] [overflow-wrap:anywhere] sm:text-[1.7rem]">
          {packageLabel}
        </h2>
        {packageTotalLabel ? (
          <p className={`${PROPOSAL_PACKET_INVESTMENT} shrink-0`}>{packageTotalLabel}</p>
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

      {state === "processing" ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <div role="status" aria-live="polite">
            <h3 className="text-[14px] font-semibold text-[#0b1f33]">
              {payment?.heading ?? PROPOSAL_PURCHASE_PROCESSING_TITLE}
            </h3>
            {payment?.kindLabel ? (
              <p className="mt-1 text-[14px] font-medium text-[#475569]">{payment.kindLabel}</p>
            ) : null}
            {dueLabel ? (
              <p className={`${PROPOSAL_PACKET_PURCHASE_DUE_AMOUNT} mt-1`}>{dueLabel}</p>
            ) : null}
            {payment?.explanation ? (
              <p className="mt-1 max-w-[34rem] text-[13px] leading-relaxed text-[#64748b]">
                {payment.explanation}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {state === "failed_deposit_retryable" || state === "failed_inactive" ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <div role="status">
            <h3 className="text-[14px] font-semibold text-[#b42318]">
              {payment?.heading ?? PROPOSAL_PURCHASE_FAILED_TITLE}
            </h3>
            {payment?.explanation ? (
              <p className="mt-1 text-[13px] leading-relaxed text-[#64748b]">{payment.explanation}</p>
            ) : null}
          </div>
        </>
      ) : null}

      {state === "payment_received" ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <div role="status" aria-live="polite">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-medium text-emerald-700">
              <IconCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {payment?.paidOnLabel
                  ? `${payment.kindLabel} · ${payment.amountLabel} · ${payment.paidOnLabel}`
                  : `${payment?.kindLabel ?? "Payment"}${payment?.amountLabel ? ` · ${payment.amountLabel}` : ""}`}
              </span>
            </p>
            <h3 className="mt-1 text-[14px] font-semibold text-[#0b1f33]">
              {payment?.heading ?? "Payment received"}
            </h3>
            {payment?.explanation ? (
              <p className="mt-0.5 text-[13px] leading-relaxed text-[#64748b]">{payment.explanation}</p>
            ) : null}
            {payment?.methodLabel ? (
              <p className="mt-1 text-[13px] text-[#64748b]" data-public-payment-method>
                {payment.methodLabel}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {state === "paid_in_full" || state === "payments_complete_with_refund" || state === "no_payment_due" ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <div role="status" aria-live="polite">
            <h3 className="text-[14px] font-semibold text-[#0b1f33]">{payment?.heading}</h3>
            {payment?.explanation ? (
              <p className="mt-1 text-[13px] leading-relaxed text-[#64748b]">{payment.explanation}</p>
            ) : null}
          </div>
        </>
      ) : null}

      {payment?.history && payment.history.length > 0 ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <div>
            <p className={PROPOSAL_PACKET_FIELD_LABEL}>{PUBLIC_PAYMENT_HISTORY_HEADING}</p>
            <ul className="mt-2 space-y-1">
              {payment.history.map((item) => (
                <li
                  key={item.id}
                  className="text-[13.5px] text-[#334155]"
                >
                  <span>{item.kindLabel} — {item.amountLabel}</span>
                  {item.detail ? (
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[#64748b]">
                      {item.detail}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {accepted && action.kind === "none" && !liveStatus ? (
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
          {showDueBlock ? (
            <div className="mb-3">
              <h3 className="text-[14px] font-semibold text-[#0b1f33]">
                {payment?.heading}
              </h3>
              {payment?.kindLabel ? (
                <p className="mt-1 text-[14px] font-medium text-[#475569]">{payment.kindLabel}</p>
              ) : null}
              <p className={`${PROPOSAL_PACKET_PURCHASE_DUE_AMOUNT} mt-1`} data-proposal-payment-amount>
                {dueLabel}
              </p>
              {payment?.contextNote ? (
                <p className="mt-1 text-[13px] text-[#64748b]">{payment.contextNote}</p>
              ) : null}
            </div>
          ) : null}

          {state === "failed_deposit_retryable" && !showDueBlock ? (
            <div className="mb-3">
              {payment?.kindLabel && dueLabel ? (
                <>
                  <p className="text-[14px] font-medium text-[#475569]">{payment.kindLabel}</p>
                  <p className={`${PROPOSAL_PACKET_PURCHASE_DUE_AMOUNT} mt-1`} data-proposal-payment-amount>
                    {dueLabel}
                  </p>
                </>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className={PROPOSAL_PACKET_CTA_PRIMARY_DOMINANT}
            onClick={action.submit}
            disabled={action.busy}
            aria-busy={action.busy || undefined}
            aria-label={action.label ?? undefined}
            data-proposal-primary-action={action.kind}
            data-public-pay={action.kind === "pay" ? "" : undefined}
          >
            {action.label}
          </button>
          {action.kind === "pay" && payment?.stripeNote && !action.busy ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#64748b]">{payment.stripeNote}</p>
          ) : null}

          {action.error ? (
            <p className="mt-2 text-[13px] text-[#b42318]" role="alert">
              {action.error}
            </p>
          ) : null}
        </>
      ) : null}

      {originalTerms ? (
        <>
          <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
          <div data-proposal-original-terms>
            <p className={PROPOSAL_PACKET_FIELD_LABEL}>{originalTerms.heading}</p>
            <p className="mt-1.5 text-[13.5px] text-[#64748b]">{originalTerms.depositLine}</p>
            {originalTerms.balanceLine ? (
              <p className="mt-0.5 text-[13.5px] text-[#94a3b8]">{originalTerms.balanceLine}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
