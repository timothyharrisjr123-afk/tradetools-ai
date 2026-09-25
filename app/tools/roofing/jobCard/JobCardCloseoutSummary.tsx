"use client";

import { useState } from "react";
import { buttonClass } from "@/app/components/ui/buttonStyles";
import { formatMoneyRowValue } from "@/app/components/ui/MoneyRow";
import { COMPLETE_BAND } from "@/app/components/ui/surfaceStyles";
import { JOB_PAYMENT_MIN_AMOUNT_CENTS } from "@/app/lib/jobPaymentTypes";
import { JOB_CARD_OVERVIEW_COMPLETION_UNAVAILABLE } from "@/app/lib/jobCardOverviewComposition";
import {
  OVERVIEW_FACT_LABEL,
  OVERVIEW_META,
  OVERVIEW_STATE_TITLE,
} from "./jobCardOverviewStyles";
import {
  JOB_CARD_CLOSEOUT_COPY_FAILED,
  JOB_CARD_CLOSEOUT_COPY_LINK_CTA,
  JOB_CARD_CLOSEOUT_HEADING,
  JOB_CARD_CLOSEOUT_HIDE_CTA,
  JOB_CARD_CLOSEOUT_OPEN_PAYMENTS_CTA,
  JOB_CARD_CLOSEOUT_REVIEW_CTA,
  describeCloseoutLinkCopied,
  type JobCardCloseoutViewModel,
} from "@/app/lib/jobCardCloseoutViewModel";

type JobCardCloseoutSummaryProps = {
  model: JobCardCloseoutViewModel;
  jobId: string;
  /** `proposal_author` only; the server enforces the same capability. */
  canShareCustomerLink: boolean;
  /** Rendered first in a completed job's Overview. */
  leading?: boolean;
  /** Present when a balance remains or money needs checking in Payments. */
  onOpenPayments?: () => void;
  /** Canonical payment state label (leading region only). */
  paymentStatusLabel?: string | null;
  /** Open/processing request context (leading region only). */
  currentRequest?: { label: string; hint: string; amountCents: number } | null;
};

/** Amounts shown in the leading money group are not repeated in the review rows. */
const LEADING_MONEY_ROW_KEYS = new Set(["contract", "remaining"]);

export default function JobCardCloseoutSummary({
  model,
  jobId,
  canShareCustomerLink,
  leading = false,
  onOpenPayments,
  paymentStatusLabel = null,
  currentRequest = null,
}: JobCardCloseoutSummaryProps) {
  const moneyKnown = model.remainingCents != null && model.contractTotalCents != null;
  const balanceRemains =
    model.remainingCents != null && model.remainingCents >= JOB_PAYMENT_MIN_AMOUNT_CENTS;
  const reviewRows = leading
    ? model.rows.filter((row) => !(moneyKnown && LEADING_MONEY_ROW_KEYS.has(row.key)))
    : model.rows;
  const [expanded, setExpanded] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState<
    { kind: "copied"; expiresAt: string | null } | { kind: "failed" } | null
  >(null);

  async function copyCustomerLink() {
    if (copyBusy) return;
    setCopyBusy(true);
    setCopyStatus(null);
    try {
      const response = await fetch(
        `/api/jobs/${encodeURIComponent(jobId)}/customer-record-link`,
        { method: "POST" }
      );
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; publicUrl?: string; expiresAt?: string | null }
        | null;
      if (!response.ok || data?.ok !== true || typeof data.publicUrl !== "string") {
        setCopyStatus({ kind: "failed" });
        return;
      }
      await navigator.clipboard.writeText(data.publicUrl);
      setCopyStatus({
        kind: "copied",
        expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : null,
      });
    } catch {
      setCopyStatus({ kind: "failed" });
    } finally {
      setCopyBusy(false);
    }
  }

  return (
    <section
      className={
        leading
          ? COMPLETE_BAND
          : "border-t border-slate-100 pt-4"
      }
      data-jobcard-closeout
      data-jobcard-closeout-leading={leading ? "true" : undefined}
      aria-label={JOB_CARD_CLOSEOUT_HEADING}
    >
      {leading ? (
        <>
          <h3 className={OVERVIEW_STATE_TITLE} data-jobcard-closeout-completion>
            {model.completionTitle}
          </h3>
          <p className="mt-0.5 text-sm text-slate-600" data-jobcard-closeout-completed-on>
            {model.completionDate
              ? `Completed ${model.completionDate}`
              : JOB_CARD_OVERVIEW_COMPLETION_UNAVAILABLE}
          </p>
          {moneyKnown ? (
            <div className="mt-4 max-w-sm" data-jobcard-closeout-money>
              {paymentStatusLabel ? (
                <p className={OVERVIEW_META} data-jobcard-closeout-payment-status>
                  Payments · {paymentStatusLabel}
                </p>
              ) : null}
              <dl className="mt-1.5 space-y-1 text-sm tabular-nums">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-slate-700">Remaining</dt>
                  <dd
                    className={`whitespace-nowrap font-semibold ${balanceRemains ? "text-lg text-slate-950" : "text-base text-slate-800"}`}
                    data-jobcard-closeout-balance
                  >
                    {balanceRemains ? formatMoneyRowValue(model.remainingCents) : "None"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className={OVERVIEW_FACT_LABEL}>Contract total</dt>
                  <dd className="whitespace-nowrap text-slate-700">
                    {formatMoneyRowValue(model.contractTotalCents)}
                  </dd>
                </div>
                {currentRequest ? (
                  <div
                    className="flex items-baseline justify-between gap-4"
                    data-jobcard-closeout-request
                  >
                    <dt className={OVERVIEW_FACT_LABEL}>
                      {currentRequest.label} request · {currentRequest.hint}
                    </dt>
                    <dd className="whitespace-nowrap text-slate-700">
                      {formatMoneyRowValue(currentRequest.amountCents)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-700" data-jobcard-closeout-balance>
              {model.balanceLabel}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            {JOB_CARD_CLOSEOUT_HEADING}
          </p>
          <p
            className="mt-1 text-sm font-semibold text-slate-900"
            data-jobcard-closeout-completion
          >
            {model.completionLabel}
          </p>
          <p className="text-sm text-slate-700" data-jobcard-closeout-balance>
            {model.balanceLabel}
          </p>
        </>
      )}

      {expanded && reviewRows.length > 0 ? (
        <dl className="mt-3 max-w-sm space-y-1 text-sm tabular-nums" data-jobcard-closeout-rows>
          {reviewRows.map((row) => (
            <div key={row.key} className="flex min-w-0 items-baseline justify-between gap-4">
              <dt className="text-slate-500">{row.label}</dt>
              <dd className="shrink-0 whitespace-nowrap tabular-nums text-slate-800">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onOpenPayments ? (
          <button
            type="button"
            className={buttonClass(balanceRemains ? "primary" : "secondary", { size: "sm" })}
            onClick={onOpenPayments}
            data-jobcard-closeout-open-payments
          >
            {JOB_CARD_CLOSEOUT_OPEN_PAYMENTS_CTA}
          </button>
        ) : null}
        <button
          type="button"
          className={buttonClass("secondary", { size: "sm" })}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          data-jobcard-closeout-review
        >
          {expanded ? JOB_CARD_CLOSEOUT_HIDE_CTA : JOB_CARD_CLOSEOUT_REVIEW_CTA}
        </button>
        {canShareCustomerLink ? (
          <button
            type="button"
            className={buttonClass("quiet", {
              size: "sm",
              className: "disabled:cursor-wait",
            })}
            onClick={() => void copyCustomerLink()}
            disabled={copyBusy}
            aria-busy={copyBusy || undefined}
            data-jobcard-closeout-copy-link
          >
            {JOB_CARD_CLOSEOUT_COPY_LINK_CTA}
          </button>
        ) : null}
      </div>
      {copyStatus ? (
        <p
          className={`mt-1.5 text-xs ${copyStatus.kind === "copied" ? "text-slate-600" : "text-red-700"}`}
          role="status"
          data-jobcard-closeout-copy-status={copyStatus.kind}
        >
          {copyStatus.kind === "copied"
            ? describeCloseoutLinkCopied(copyStatus.expiresAt)
            : JOB_CARD_CLOSEOUT_COPY_FAILED}
        </p>
      ) : null}
    </section>
  );
}
