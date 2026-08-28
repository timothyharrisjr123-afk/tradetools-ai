"use client";

import { useSearchParams } from "next/navigation";
import ProposalPacket from "@/app/components/proposal-packet/ProposalPacket";
import { buildPublicPaymentViewModel } from "@/app/lib/jobPaymentReadModel";
import type { JobPaymentRequestRow, JobPaymentTransactionRow } from "@/app/lib/jobPaymentReadModel";
import type { ProposalCustomerPacketViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import type { ProposalPaymentTerms } from "@/app/lib/proposalPaymentTerms";

const CONTRACT = 1850000;
const VERSION = "version-1";
const ACCEPTANCE = "acceptance-1";

const PERCENT_TERMS: ProposalPaymentTerms = {
  depositMode: "percent",
  depositPercentBps: 2500,
  depositFixedCents: null,
  depositDueTrigger: "on_acceptance",
  balanceDueTrigger: "on_completion",
};

const NONE_TERMS: ProposalPaymentTerms = {
  depositMode: "none",
  depositPercentBps: null,
  depositFixedCents: null,
  depositDueTrigger: "on_acceptance",
  balanceDueTrigger: "on_completion",
};

function req(
  overrides: Partial<JobPaymentRequestRow> = {}
): JobPaymentRequestRow {
  return {
    id: "req-1",
    company_id: "company-1",
    job_id: "job-1",
    proposal_id: "proposal-1",
    proposal_version_id: VERSION,
    proposal_option_id: "option-premium",
    proposal_acceptance_id: ACCEPTANCE,
    proposal_signature_id: null,
    amount_cents: 462500,
    currency: "usd",
    kind: "progress",
    accepted_total_cents_snapshot: CONTRACT,
    option_label_snapshot: "Premium",
    provider_account_id: "acct_test",
    provider_checkout_session_id: null,
    status: "open",
    requested_at: "2026-08-27T18:00:00.000Z",
    paid_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function capture(requestId: string, amount: number, pi = "pi_1"): JobPaymentTransactionRow {
  return {
    id: `txn-${requestId}`,
    payment_request_id: requestId,
    kind: "capture",
    status: "succeeded",
    amount_cents: amount,
    occurred_at: "2026-08-27T19:00:00.000Z",
    provider_event_id: `evt-${pi}`,
    provider_payment_intent_id: pi,
  };
}

function payment(
  requests: JobPaymentRequestRow[],
  extra: Parameters<typeof buildPublicPaymentViewModel>[0] = { requests }
) {
  return buildPublicPaymentViewModel({
    accepted: true,
    terms: NONE_TERMS,
    contractTotalCents: CONTRACT,
    proposalVersionId: VERSION,
    acceptanceId: ACCEPTANCE,
    ...extra,
    requests,
  });
}

const BASE: ProposalCustomerPacketViewModel = {
  cover: {
    proposalLabel: "Your roofing proposal",
    headline: "1842 Bellview Terrace",
    confidenceCopy: "A clear roof replacement proposal prepared for your home.",
    coverMediaUrl: null,
    company: {
      companyName: "Anderson Roofing",
      preparedByLabel: "Anderson Roofing",
      logoUrl: null,
      logoMonogram: "AR",
      brandPrimaryColor: null,
      brandSecondaryColor: null,
    },
    preparedFor: {
      customerName: "Jane Whitfield",
      customerEmail: "jane@example.com",
      customerPhone: null,
      hasAnyField: true,
    },
    project: {
      jobName: "Full roof replacement",
      propertyAddress: "1842 Bellview Terrace, Tulsa, OK 74104",
      hasAnyField: true,
    },
  },
  estimate: {
    optionKey: "premium",
    label: "Premium",
    description: "Designer shingles with the longest protection we offer.",
    bullets: ["Designer architectural shingles", "25-year warranty"],
    accent: "premium",
    totalInvestmentLabel: "$18,500",
    confidenceCopy: "",
    scopeGroupSummaries: [
      { title: "Tear-off & disposal", itemCount: 3, previewLabel: "Full tear-off to deck" },
    ],
    includedDetails: [
      {
        title: "Roofing system",
        lines: [
          { name: "Designer architectural shingles", valueLabel: "Included", kind: "included" },
        ],
      },
    ],
  },
  comparison: null,
  upgrades: { items: [{ name: "Ridge vent upgrade", valueLabel: "Included" }] },
  details: {
    tabs: [
      { id: "warranty", title: "Warranty", body: "25-year material warranty.", isEmpty: false },
    ],
  },
  contact: {
    supportMessage: "Questions about this proposal? We're happy to help.",
    companyName: "Anderson Roofing",
    phone: "(918) 555-0142",
    email: "hello@andersonroofing.com",
    website: "andersonroofing.com",
    license: "OK-RC-40219",
    address: "220 S Elgin Ave, Tulsa, OK",
  },
  footerMetadata: {
    proposalDateLabel: "August 27, 2026",
    proposalReferenceLabel: "P-1042",
    licenseLabel: "OK-RC-40219",
    insuredLabel: "Fully insured",
    hasAnyField: true,
  },
  acceptance: { status: "accepted", acceptedOnLabel: "August 27, 2026" },
  payment: null,
  paymentTerms: NONE_TERMS,
  selectedTotalCents: CONTRACT,
};

const DEPOSIT = req({ id: "deposit-1", kind: "deposit", amount_cents: 462500 });
const PROGRESS = req({ id: "progress-1", kind: "progress", amount_cents: 462500 });
const BALANCE = req({ id: "balance-1", kind: "balance", amount_cents: 925000 });
const PAID_PROGRESS = req({
  id: "progress-paid",
  kind: "progress",
  status: "paid",
  amount_cents: 462500,
  paid_at: "2026-08-27T19:00:00.000Z",
  requested_at: "2026-08-20T12:00:00.000Z",
});

const FIXTURES: Record<string, ProposalCustomerPacketViewModel> = {
  "deposit-due": {
    ...BASE,
    paymentTerms: PERCENT_TERMS,
    payment: payment([DEPOSIT], { requests: [DEPOSIT], terms: PERCENT_TERMS }),
  },
  "progress-due": {
    ...BASE,
    payment: payment([PROGRESS]),
  },
  "balance-due": {
    ...BASE,
    payment: payment([BALANCE]),
  },
  processing: {
    ...BASE,
    payment: payment([{ ...PROGRESS, status: "processing" }]),
  },
  "payment-received": {
    ...BASE,
    payment: payment([PAID_PROGRESS], {
      requests: [PAID_PROGRESS],
      transactions: [capture(PAID_PROGRESS.id, 462500)],
    }),
  },
  "paid-in-full": {
    ...BASE,
    payment: payment(
      [{ ...BALANCE, status: "paid", amount_cents: CONTRACT, paid_at: "2026-08-27T19:00:00.000Z" }],
      {
        requests: [
          { ...BALANCE, status: "paid", amount_cents: CONTRACT, paid_at: "2026-08-27T19:00:00.000Z" },
        ],
        transactions: [capture(BALANCE.id, CONTRACT)],
      }
    ),
  },
  "payments-complete": {
    ...BASE,
    payment: payment(
      [{ ...BALANCE, status: "paid", amount_cents: CONTRACT, paid_at: "2026-08-27T19:00:00.000Z" }],
      {
        requests: [
          { ...BALANCE, status: "paid", amount_cents: CONTRACT, paid_at: "2026-08-27T19:00:00.000Z" },
        ],
        transactions: [
          capture(BALANCE.id, CONTRACT),
          {
            id: "refund-1",
            payment_request_id: BALANCE.id,
            kind: "refund",
            status: "refunded",
            amount_cents: 50000,
            occurred_at: "2026-08-27T21:00:00.000Z",
            provider_event_id: "evt-refund",
            provider_payment_intent_id: "pi_1",
          },
        ],
      }
    ),
  },
  "failed-deposit-retry": {
    ...BASE,
    paymentTerms: PERCENT_TERMS,
    payment: payment([{ ...DEPOSIT, status: "failed" }], {
      requests: [{ ...DEPOSIT, status: "failed" }],
      terms: PERCENT_TERMS,
    }),
  },
  "failed-progress": {
    ...BASE,
    payment: payment([{ ...PROGRESS, status: "failed" }]),
  },
  "no-payment-due": {
    ...BASE,
    payment: payment([], { requests: [], terms: NONE_TERMS, transactions: [] }),
  },
  "terms-progress": {
    ...BASE,
    paymentTerms: NONE_TERMS,
    payment: payment([PROGRESS]),
  },
};

type FixtureId = keyof typeof FIXTURES;

export default function PaymentStage2DReviewHarness() {
  const search = useSearchParams();
  const show = (search.get("show") ?? "progress-due") as FixtureId;
  const fixture: FixtureId = show in FIXTURES ? show : "progress-due";
  return (
    <div data-stage2d-review={fixture}>
      <ProposalPacket
        packet={FIXTURES[fixture]}
        mode="public"
        publicAccessToken="stage-2d-review-token"
      />
    </div>
  );
}
