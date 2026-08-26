"use client";

import ProposalPaymentTermsBlock from "@/app/components/proposal-packet/ProposalPaymentTermsBlock";
import ProposalPacketPayment from "@/app/components/proposal-packet/ProposalPacketPayment";
import ProposalPacketCustomerActions from "@/app/components/proposal-packet/ProposalPacketCustomerActions";
import ProposalPacketComparison from "@/app/components/proposal-packet/ProposalPacketComparison";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "@/app/lib/proposalPaymentTerms";
import {
  buildProspectiveDepositPaymentViewModel,
  buildPublicPaymentViewModel,
} from "@/app/lib/jobPaymentReadModel";
import { useSearchParams } from "next/navigation";

const PERCENT_TERMS = {
  ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
  depositMode: "percent" as const,
  depositPercentBps: 3000,
};

const REVIEW_CONTACT = {
  supportMessage: "",
  companyName: "Anderson Roofing",
  phone: "(555) 555-0100",
  email: "hello@andersonroofing.example",
  website: null,
  license: null,
  address: null,
};

const COMPARISON = {
  dimensions: [{ label: "Shingles" }, { label: "Warranty" }],
  options: [
    {
      optionKey: "standard",
      label: "Standard",
      description: "Reliable protection",
      isCurrent: false,
      accent: "standard" as const,
      totalInvestmentLabel: "$12,500",
      bullets: ["Architectural shingles", "10-year workmanship"],
      cells: [
        { valueLabel: "Architectural", availability: "included" as const },
        { valueLabel: "10 years", availability: "included" as const },
      ],
    },
    {
      optionKey: "premium",
      label: "Premium",
      description: "Enhanced protection",
      isCurrent: true,
      accent: "premium" as const,
      totalInvestmentLabel: "$15,000",
      bullets: ["Designer shingles", "25-year workmanship"],
      cells: [
        { valueLabel: "Designer", availability: "included" as const },
        { valueLabel: "25 years", availability: "included" as const },
      ],
    },
  ],
};

const REQUEST = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  job_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  proposal_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  proposal_version_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  proposal_option_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  proposal_acceptance_id: "99999999-9999-4999-8999-999999999999",
  proposal_signature_id: null as string | null,
  amount_cents: 450000,
  currency: "usd",
  kind: "deposit" as const,
  accepted_total_cents_snapshot: 1500000,
  option_label_snapshot: "Premium",
  provider_account_id: "acct_test",
  provider_checkout_session_id: null as string | null,
  status: "open" as const,
  requested_at: "2026-08-26T12:00:00.000Z",
  paid_at: null as string | null,
  cancelled_at: null as string | null,
  settled_payment_method_label: null as string | null,
};

export default function PaymentStage1FlowCorrectionReviewHarness() {
  const show = useSearchParams().get("show");
  const prospective =
    buildProspectiveDepositPaymentViewModel({
      terms: PERCENT_TERMS,
      selectedTotalCents: 1500000,
    })!;
  const due = buildPublicPaymentViewModel({ requests: [REQUEST] })!;
  const received = buildPublicPaymentViewModel({
    requests: [
      {
        ...REQUEST,
        status: "paid",
        paid_at: "2026-08-26T13:00:00.000Z",
        settled_payment_method_label: "Visa •••• 4242",
      },
    ],
  })!;

  return (
    <div className="mx-auto max-w-3xl space-y-8 bg-white p-6">
      {show == null || show === "single-before-pay" ? (
        <section data-flow-correction="single-before-pay">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Single option — review terms, Pay deposit
          </h2>
          <ProposalPaymentTermsBlock terms={PERCENT_TERMS} selectedTotalCents={1500000} />
          <div className="mt-4">
            <ProposalPacketPayment payment={prospective} publicAccessToken="review-token" />
          </div>
          <div className="mt-4">
            <ProposalPacketCustomerActions
              mode="public"
              contact={REVIEW_CONTACT}
              termsRequireDeposit
              publicAccessToken="review-token"
            />
          </div>
        </section>
      ) : null}

      {show == null || show === "multi-compare" ? (
        <section data-flow-correction="multi-compare">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Multi-option comparison</h2>
          <ProposalPacketComparison comparison={COMPARISON} />
        </section>
      ) : null}

      {show == null || show === "selected-pay" ? (
        <section data-flow-correction="selected-pay">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Selected package + payment terms + Pay
          </h2>
          <ProposalPaymentTermsBlock terms={PERCENT_TERMS} selectedTotalCents={1500000} />
          <div className="mt-4">
            <ProposalPacketPayment payment={due} publicAccessToken="review-token" />
          </div>
        </section>
      ) : null}

      {show == null || show === "no-deposit" ? (
        <section data-flow-correction="no-deposit">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">No-deposit — Confirm proposal</h2>
          <ProposalPaymentTermsBlock
            terms={DEFAULT_PROPOSAL_PAYMENT_TERMS}
            selectedTotalCents={1500000}
          />
          <div className="mt-4">
            <ProposalPacketCustomerActions
              mode="public"
              contact={REVIEW_CONTACT}
              termsRequireDeposit={false}
              publicAccessToken="review-token"
            />
          </div>
        </section>
      ) : null}

      {show == null || show === "confirmed" ? (
        <section data-flow-correction="confirmed">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Confirmed / received</h2>
          <ProposalPacketCustomerActions
            mode="public"
            contact={REVIEW_CONTACT}
            termsRequireDeposit={false}
            accepted
            acceptedOnLabel="August 26, 2026"
          />
          <div className="mt-4">
            <ProposalPacketPayment payment={received} publicAccessToken={null} />
          </div>
        </section>
      ) : null}

      {show == null || show === "company-profile" ? (
        <section data-flow-correction="company-profile">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Company profile owns payment setup (nav note)
          </h2>
          <p className="text-sm text-slate-600">
            Payments removed from Setup sidebar. Connect Stripe from Company profile → Payments
            card. Route <code>/tools/settings/payments</code> remains for deep links.
          </p>
        </section>
      ) : null}
    </div>
  );
}
