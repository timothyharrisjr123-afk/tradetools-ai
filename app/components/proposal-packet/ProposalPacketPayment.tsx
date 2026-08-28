"use client";

import { useState } from "react";
import {
  publicPaymentTitle,
  type PublicPaymentViewModel,
} from "@/app/lib/jobPaymentReadModel";
import {
  PROPOSAL_PACKET_CTA_PRIMARY,
  PROPOSAL_PACKET_STORY_SECTION,
} from "./proposalPacketStyles";

type ProposalPacketPaymentProps = {
  payment: PublicPaymentViewModel;
  publicAccessToken: string | null;
};

export default function ProposalPacketPayment({
  payment,
  publicAccessToken,
}: ProposalPacketPaymentProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = (publicAccessToken ?? "").trim();

  const pay = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/public/payment-requests/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json()) as { ok?: boolean; url?: string };
      if (!response.ok || !payload.url) {
        setError("We could not start this payment. Please try again.");
        return;
      }
      window.location.href = payload.url;
    } catch {
      setError("We could not start this payment. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const cta =
    payment.ctaLabel && token ? (
      <button
        type="button"
        className={PROPOSAL_PACKET_CTA_PRIMARY}
        data-public-pay
        disabled={busy}
        onClick={() => void pay()}
      >
        {busy ? "Opening…" : payment.ctaLabel}
      </button>
    ) : null;

  return (
    <section
      className={PROPOSAL_PACKET_STORY_SECTION}
      aria-label="Payment"
      data-public-payment={payment.state}
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {publicPaymentTitle(payment.state, payment.kind)}
        </p>
        {payment.kindLabel ? (
          <p className="mt-1 text-sm font-medium text-slate-800">{payment.kindLabel}</p>
        ) : null}
        {payment.amountLabel ? (
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-950">
            {payment.amountLabel}
          </p>
        ) : null}
        {payment.state === "payment_received" && payment.paidOnLabel ? (
          <p className="mt-1 text-sm text-slate-600">Paid {payment.paidOnLabel}</p>
        ) : null}
        {payment.state === "payment_received" && payment.methodLabel ? (
          <p className="mt-1 text-sm text-slate-600" data-public-payment-method>
            {payment.methodLabel}
          </p>
        ) : null}
        {payment.explanation ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{payment.explanation}</p>
        ) : null}
        {cta ? <div className="mt-3">{cta}</div> : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
    </section>
  );
}
