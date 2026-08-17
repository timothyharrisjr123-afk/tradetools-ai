"use client";

import { useState } from "react";
import { formatUsdFromCents, parseUsdInputToCents } from "@/app/lib/jobPaymentMoney";
import { JOB_PAYMENT_MIN_AMOUNT_CENTS } from "@/app/lib/jobPaymentTypes";
import type { JobPaymentKind } from "@/app/lib/jobPaymentTypes";

type JobCardRequestPaymentModalProps = {
  open: boolean;
  kind: JobPaymentKind;
  prefillCents: number | null;
  remainingCents: number;
  acceptedTotalCents: number;
  unsigned: boolean;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (amountCents: number) => void;
};

function RequestPaymentForm({
  kind,
  prefillCents,
  remainingCents,
  acceptedTotalCents,
  unsigned,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: Omit<JobCardRequestPaymentModalProps, "open">) {
  const initial =
    prefillCents != null ? String((prefillCents / 100).toFixed(2)) : "";
  const [raw, setRaw] = useState(initial);
  const parsed = parseUsdInputToCents(raw);
  const valid =
    parsed != null &&
    parsed >= JOB_PAYMENT_MIN_AMOUNT_CENTS &&
    parsed <= remainingCents;
  const title = kind === "deposit" ? "Request deposit" : "Request remaining balance";

  return (
    <div
      className="fixed inset-0 z-50 m-auto flex items-center justify-center bg-slate-950/40 p-4"
      data-jobcard-request-payment-modal
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Accepted total {formatUsdFromCents(acceptedTotalCents)}. Remaining{" "}
          {formatUsdFromCents(remainingCents)}.
        </p>
        {unsigned ? (
          <p className="mt-2 text-xs text-slate-500">
            This proposal is accepted and unsigned. A signature is not required to request payment.
          </p>
        ) : null}
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Amount
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            inputMode="decimal"
            data-jobcard-request-payment-amount
          />
        </label>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!valid || submitting}
            onClick={() => parsed != null && onSubmit(parsed)}
          >
            {submitting ? "Requesting…" : title}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobCardRequestPaymentModal({
  open,
  kind,
  prefillCents,
  remainingCents,
  acceptedTotalCents,
  unsigned,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: JobCardRequestPaymentModalProps) {
  if (!open) return null;
  return (
    <RequestPaymentForm
      key={`${kind}:${prefillCents ?? "empty"}`}
      kind={kind}
      prefillCents={prefillCents}
      remainingCents={remainingCents}
      acceptedTotalCents={acceptedTotalCents}
      unsigned={unsigned}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
