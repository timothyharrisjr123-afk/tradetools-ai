"use client";

import {
  JOB_CARD_PAYMENTS_CONNECT_CTA,
  JOB_CARD_PAYMENTS_CONNECT_HREF,
  JOB_CARD_PAYMENTS_LABEL,
  JOB_CARD_PAYMENTS_REQUEST_BALANCE_CTA,
  JOB_CARD_PAYMENTS_REQUEST_DEPOSIT_CTA,
} from "@/app/lib/jobPaymentTypes";
import type { JobCardPaymentViewModel } from "@/app/lib/jobPaymentReadModel";

type JobCardPaymentsStripProps = {
  view: JobCardPaymentViewModel | null;
  onRequestDeposit?: () => void;
  onRequestBalance?: () => void;
};

export default function JobCardPaymentsStrip({
  view,
  onRequestDeposit,
  onRequestBalance,
}: JobCardPaymentsStripProps) {
  if (!view) return null;

  const action =
    view.action === "connect" ? (
      <a
        href={JOB_CARD_PAYMENTS_CONNECT_HREF}
        className="text-sm font-semibold text-cyan-700 hover:text-cyan-900"
        data-jobcard-payments-connect
      >
        {JOB_CARD_PAYMENTS_CONNECT_CTA}
      </a>
    ) : view.action === "request_deposit" ? (
      <button
        type="button"
        className="text-sm font-semibold text-cyan-700 hover:text-cyan-900"
        data-jobcard-request-deposit
        onClick={onRequestDeposit}
      >
        {JOB_CARD_PAYMENTS_REQUEST_DEPOSIT_CTA}
      </button>
    ) : view.action === "request_balance" ? (
      <button
        type="button"
        className="text-sm font-semibold text-cyan-700 hover:text-cyan-900"
        data-jobcard-request-balance
        onClick={onRequestBalance}
      >
        {JOB_CARD_PAYMENTS_REQUEST_BALANCE_CTA}
      </button>
    ) : null;

  return (
    <div
      className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4"
      data-jobcard-payments
      data-jobcard-payments-headline={view.headline}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {JOB_CARD_PAYMENTS_LABEL}
          </h3>
          <p className="mt-2 text-sm font-medium text-slate-800">{view.headline}</p>
          {view.detail ? (
            <p className="mt-0.5 text-xs text-slate-500">{view.detail}</p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  );
}
