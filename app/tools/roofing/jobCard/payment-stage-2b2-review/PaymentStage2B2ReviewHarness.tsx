"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  ACCEPTANCE_RECORDED_TITLE,
  DEPOSIT_CONTINUATION_COPY,
} from "@/app/lib/proposalAcceptanceDepositEnvelope";
import { PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_NEXT } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_PACKET_CTA_PRIMARY_DOMINANT,
  PROPOSAL_PACKET_FIELD_LABEL,
  PROPOSAL_PACKET_PURCHASE,
  PROPOSAL_PACKET_PURCHASE_DIVIDER,
} from "@/app/components/proposal-packet/proposalPacketStyles";

type CaseId =
  | "accepted-no-deposit"
  | "accepted-deposit-ready"
  | "accepted-setup-required"
  | "accepted-continuation-failed"
  | "accepted-processing"
  | "contractor-setup-required";

const CASES: { id: CaseId; label: string }[] = [
  { id: "accepted-no-deposit", label: "A. Accepted / no deposit" },
  { id: "accepted-deposit-ready", label: "B. Accepted / deposit ready" },
  { id: "accepted-setup-required", label: "C. Accepted / setup required" },
  {
    id: "accepted-continuation-failed",
    label: "D. Accepted / continuation problem",
  },
  { id: "accepted-processing", label: "E. Accepted / payment processing" },
  {
    id: "contractor-setup-required",
    label: "F. Contractor / payment setup required",
  },
];

function CustomerPartialCard(props: {
  depositNote: string | null;
  showPayCta?: boolean;
  processing?: boolean;
}) {
  return (
    <div
      className={PROPOSAL_PACKET_PURCHASE}
      data-phase2b2-customer
      style={{ maxWidth: 420 }}
    >
      <p className={PROPOSAL_PACKET_FIELD_LABEL}>Your package</p>
      <h2 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.03em] text-[#0b1f33]">
        Complete Roof System
      </h2>
      <p className="mt-1 text-[1.25rem] font-semibold tabular-nums text-[#0b1f33]">
        $18,500.00
      </p>
      <div className={PROPOSAL_PACKET_PURCHASE_DIVIDER} />
      <p className="text-[14px] font-semibold text-[#0b1f33]">{ACCEPTANCE_RECORDED_TITLE}</p>
      <p className="mt-0.5 text-[13px] text-[#64748b]">Accepted on Sep 20, 2026</p>
      <p className="mt-1 text-[13px] leading-relaxed text-[#64748b]">
        {PROPOSAL_CUSTOMER_PACKET_ACCEPT_SUCCESS_NEXT}
      </p>
      {props.processing ? (
        <p className="mt-2 text-[14px] font-semibold text-[#475569]">Payment processing</p>
      ) : null}
      {props.depositNote ? (
        <p
          className="mt-2 text-[13px] leading-relaxed text-[#64748b]"
          data-proposal-purchase-continuation
        >
          {props.depositNote}
        </p>
      ) : null}
      {props.showPayCta ? (
        <button
          type="button"
          className={`${PROPOSAL_PACKET_CTA_PRIMARY_DOMINANT} mt-4`}
          data-proposal-primary-action="pay"
        >
          Pay deposit
        </button>
      ) : null}
    </div>
  );
}

function ContractorSetupCard() {
  return (
    <div
      className="rounded-[12px] border border-[#e2e8f0] bg-white p-4"
      data-phase2b2-contractor
      style={{ maxWidth: 420 }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
        Proposal
      </p>
      <p className="mt-1 text-[15px] font-semibold text-[#0b1f33]">Customer accepted proposal</p>
      <p className="mt-3 text-[13px] text-[#475569]">
        Payment setup required — connect payments so the customer can pay the deposit.
      </p>
      <a
        href="/tools/settings"
        className="mt-3 inline-flex text-[13px] font-semibold text-[#2563eb]"
      >
        Connect payments
      </a>
    </div>
  );
}

/**
 * Review-only harness for Phase 2B2 partial-success visuals.
 * Fixture composition only — no live Stripe or acceptance writes.
 */
export default function PaymentStage2B2ReviewHarness() {
  const params = useSearchParams();
  const caseId = (params.get("case") as CaseId | null) ?? "accepted-setup-required";

  let body: ReactNode = null;
  switch (caseId) {
    case "accepted-no-deposit":
      body = <CustomerPartialCard depositNote={null} />;
      break;
    case "accepted-deposit-ready":
      body = (
        <CustomerPartialCard
          depositNote={DEPOSIT_CONTINUATION_COPY.ready}
          showPayCta
        />
      );
      break;
    case "accepted-setup-required":
      body = (
        <CustomerPartialCard depositNote={DEPOSIT_CONTINUATION_COPY.setup_required} />
      );
      break;
    case "accepted-continuation-failed":
      body = (
        <CustomerPartialCard
          depositNote={DEPOSIT_CONTINUATION_COPY.continuation_failed}
        />
      );
      break;
    case "accepted-processing":
      body = <CustomerPartialCard depositNote={null} processing />;
      break;
    case "contractor-setup-required":
      body = <ContractorSetupCard />;
      break;
    default:
      body = <CustomerPartialCard depositNote={DEPOSIT_CONTINUATION_COPY.setup_required} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-6" data-phase2b2-harness={caseId}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
        Phase 2B2 partial-success review
      </p>
      <nav className="mt-3 flex flex-wrap gap-2">
        {CASES.map((item) => (
          <a
            key={item.id}
            href={`?case=${item.id}`}
            className={`rounded-md px-2.5 py-1 text-[12px] ${
              item.id === caseId
                ? "bg-[#0b1f33] text-white"
                : "bg-white text-[#334155] ring-1 ring-[#e2e8f0]"
            }`}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="mt-6">{body}</div>
    </div>
  );
}
