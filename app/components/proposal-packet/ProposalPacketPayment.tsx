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
  variant?: "section" | "banner";
};

export default function ProposalPacketPayment({
  payment,
  publicAccessToken,
  variant = "section",
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

  if (variant === "banner") {
    return (
      <section
        className="border-b border-[#dbe4ef] bg-[#f4f8fd] px-5 py-3 sm:px-7 lg:px-9"
        aria-label="Payment"
        data-public-payment={payment.state}
        data-public-payment-banner
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563eb]">
              {publicPaymentTitle(payment.state)}
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#0b1f33]">
              {payment.amountLabel}
            </p>
            {payment.state === "pending" && payment.explanation ? (
              <p className="mt-1 max-w-xl text-[13px] leading-snug text-[#475569]">
                {payment.explanation}
              </p>
            ) : null}
          </div>
          {cta}
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </section>
    );
  }

  return (
    <section
      className={PROPOSAL_PACKET_STORY_SECTION}
      aria-label="Payment"
      data-public-payment={payment.state}
    >
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {publicPaymentTitle(payment.state)}
        </p>
        <p className="mt-1 text-sm font-medium text-slate-800">{payment.kindLabel}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-950">
          {payment.amountLabel}
        </p>
        {payment.state === "received" && payment.paidOnLabel ? (
          <p className="mt-1 text-sm text-slate-600">Paid {payment.paidOnLabel}</p>
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
