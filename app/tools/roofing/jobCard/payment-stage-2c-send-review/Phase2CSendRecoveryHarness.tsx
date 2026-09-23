"use client";

/**
 * Phase 2C visual harness — mirrors ProposalCustomerPreviewSendGatePanel
 * partial/success treatments only. Case labels / outer cards are harness-only.
 */

import { CheckCircle2, AlertCircle, Mail } from "lucide-react";
import {
  SEND_GATE_DELIVERY_NEEDS_ATTENTION,
  SEND_GATE_EMAIL_PROVIDER_ACCEPTED_BODY_PREFIX,
  SEND_GATE_EMAIL_PROVIDER_ACCEPTED_TITLE,
  SEND_GATE_PROPOSAL_SENT_TITLE,
  SEND_GATE_RETRY_EMAIL_LABEL,
  SEND_GATE_SEND_PROPOSAL_LABEL,
} from "@/app/lib/proposalSendGateReadiness";
import { PROPOSAL_SENT_DELIVERY_COPY } from "@/app/lib/proposalSendDeliveryEnvelope";

const CASES = [
  {
    id: "A",
    title: "Normal sent + emailed",
    delivery: "submitted" as const,
  },
  {
    id: "B",
    title: "Sent + delivery failed",
    delivery: "failed" as const,
  },
  {
    id: "C",
    title: "Retry email available",
    delivery: "failed" as const,
    showRetry: true,
  },
  {
    id: "D",
    title: "Delivery checking",
    delivery: "checking" as const,
  },
] as const;

export default function Phase2CSendRecoveryHarness() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6" data-phase2c-send-harness data-phase2c-harness-rev="review-pass">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Phase 2C
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Proposal send / delivery partial-success
        </h1>
        <p className="text-sm text-slate-600">
          Proposal freeze truth stays primary. Email delivery continuation is secondary.
        </p>
      </header>

      {CASES.map((c) => (
        <section
          key={c.id}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          data-phase2c-case={c.id}
        >
          <h2 className="text-sm font-semibold text-slate-800">
            Case {c.id}: {c.title}
          </h2>

          {c.delivery === "submitted" ? (
            <div
              className="flex gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3.5"
              data-preview-send-success
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
              <div>
                <p className="text-[14px] font-semibold text-emerald-950">
                  {SEND_GATE_EMAIL_PROVIDER_ACCEPTED_TITLE}
                </p>
                <p className="mt-1 text-[13px] text-emerald-800">
                  {SEND_GATE_EMAIL_PROVIDER_ACCEPTED_BODY_PREFIX} j***@example.com
                </p>
              </div>
            </div>
          ) : (
            <div
              className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5"
              data-preview-send-partial
              data-preview-send-delivery-kind={c.delivery}
            >
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" aria-hidden />
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">
                    {SEND_GATE_PROPOSAL_SENT_TITLE}
                  </p>
                  <p className="mt-1 text-[13px] text-slate-600">
                    j***@example.com - Your roof proposal
                  </p>
                </div>
              </div>
              {c.delivery === "failed" ? (
                <div
                  className="flex gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2.5"
                  data-preview-send-delivery-attention
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                  <p className="text-[13px] text-amber-950">
                    {SEND_GATE_DELIVERY_NEEDS_ATTENTION}
                  </p>
                </div>
              ) : (
                <div
                  className="flex gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                  data-preview-send-delivery-checking
                  role="status"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                  <p className="text-[13px] text-slate-700">
                    {PROPOSAL_SENT_DELIVERY_COPY.checking}
                  </p>
                </div>
              )}
            </div>
          )}

          {"showRetry" in c && c.showRetry ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
              data-phase2c-retry-email
            >
              <Mail className="h-4 w-4" aria-hidden />
              {SEND_GATE_RETRY_EMAIL_LABEL}
            </button>
          ) : c.delivery === "submitted" ? (
            <p className="text-xs text-slate-500">
              Primary action after email success stays quiet — no {SEND_GATE_SEND_PROPOSAL_LABEL}{" "}
              recreate.
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
