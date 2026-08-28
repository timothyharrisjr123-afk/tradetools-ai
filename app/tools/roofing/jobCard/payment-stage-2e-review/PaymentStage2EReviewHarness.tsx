"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import ProposalPacketPurchase from "@/app/components/proposal-packet/ProposalPacketPurchase";
import JobCardPaymentsWorkspace from "@/app/tools/roofing/jobCard/JobCardPaymentsWorkspace";
import JobCardActivityPanel from "@/app/tools/roofing/jobCard/JobCardActivityPanel";
import JobCardSectionPanel from "@/app/tools/roofing/jobCard/JobCardSectionPanel";
import JobCardTabs from "@/app/tools/roofing/jobCard/JobCardTabs";
import type { JobCardTabId } from "@/app/tools/roofing/jobCard/jobCardTypes";
import { coerceJobCardVisibleTab } from "@/app/tools/roofing/jobCard/jobCardTypes";
import { composeJobActivityItems } from "@/app/lib/jobActivityComposer";
import type { PublicPaymentViewModel } from "@/app/lib/jobPaymentCustomerPresenter";
import {
  buildJobPaymentWorkspace,
  type JobPaymentWorkspaceRequest,
  type JobPaymentWorkspaceTransaction,
} from "@/app/lib/jobPaymentWorkspace";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "@/app/lib/proposalPaymentTerms";
import type { JobPaymentRefundRow } from "@/app/lib/jobPaymentReadModel";

const ACCOUNT = {
  charges_enabled: true,
  onboarding_status: "complete",
  details_submitted: true,
  payouts_enabled: true,
};

const DEPOSIT_TERMS = {
  ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
  depositMode: "fixed" as const,
  depositFixedCents: 200000,
};

function request(
  overrides: Partial<JobPaymentWorkspaceRequest> = {}
): JobPaymentWorkspaceRequest {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    kind: "deposit",
    status: "open",
    amount_cents: 200000,
    requested_at: "2026-08-24T14:10:00.000Z",
    paid_at: null,
    cancelled_at: null,
    settled_payment_method_label: null,
    ...overrides,
  };
}

function txn(
  overrides: Partial<JobPaymentWorkspaceTransaction> = {}
): JobPaymentWorkspaceTransaction {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    payment_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    kind: "capture",
    status: "succeeded",
    amount_cents: 200000,
    occurred_at: "2026-08-24T14:20:00.000Z",
    provider_event_id: "evt_pi",
    provider_payment_intent_id: "pi_deposit",
    ...overrides,
  };
}

function refund(
  overrides: Partial<JobPaymentRefundRow> = {}
): JobPaymentRefundRow {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    company_id: "11111111-1111-4111-8111-111111111110",
    job_id: "11111111-1111-4111-8111-111111111109",
    payment_request_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    canonical_capture_transaction_id: "55555555-5555-4555-8555-555555555555",
    amount_cents: 50000,
    status: "succeeded",
    initiated_at: "2026-08-27T15:18:00.000Z",
    pending_at: null,
    requires_action_at: null,
    succeeded_at: "2026-08-27T15:20:00.000Z",
    failed_at: null,
    canceled_at: null,
    created_at: "2026-08-27T15:18:00.000Z",
    updated_at: "2026-08-27T15:20:00.000Z",
    ...overrides,
  };
}

const PAID_DEPOSIT = request({
  status: "paid",
  paid_at: "2026-08-24T14:20:00.000Z",
  settled_payment_method_label: "Cards",
});
const DEPOSIT_CAPTURE = txn();

const SEQUENTIAL_REQUESTS: JobPaymentWorkspaceRequest[] = [
  PAID_DEPOSIT,
  request({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    kind: "progress",
    status: "failed",
    amount_cents: 462500,
    requested_at: "2026-08-22T17:00:00.000Z",
  }),
  request({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    kind: "progress",
    status: "paid",
    amount_cents: 462500,
    requested_at: "2026-08-22T18:00:00.000Z",
    paid_at: "2026-08-22T18:10:00.000Z",
    settled_payment_method_label: "Cards",
  }),
  request({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    kind: "progress",
    status: "paid",
    amount_cents: 462500,
    requested_at: "2026-08-25T17:52:00.000Z",
    paid_at: "2026-08-25T18:14:00.000Z",
    settled_payment_method_label: "Cards",
  }),
  request({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    kind: "balance",
    status: "paid",
    amount_cents: 725000,
    requested_at: "2026-08-26T16:00:00.000Z",
    paid_at: "2026-08-26T16:12:00.000Z",
    settled_payment_method_label: "Cards",
  }),
];

const SEQUENTIAL_TXNS: JobPaymentWorkspaceTransaction[] = [
  DEPOSIT_CAPTURE,
  txn({
    id: "22222222-2222-4222-8222-222222222222",
    payment_request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    kind: "failure",
    status: "failed",
    amount_cents: 462500,
    occurred_at: "2026-08-22T17:05:00.000Z",
    provider_event_id: "evt_fail",
    provider_payment_intent_id: "pi_fail",
  }),
  txn({
    id: "33333333-3333-4333-8333-333333333333",
    payment_request_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    amount_cents: 462500,
    occurred_at: "2026-08-22T18:10:00.000Z",
    provider_event_id: "evt_p1",
    provider_payment_intent_id: "pi_p1",
  }),
  txn({
    id: "44444444-4444-4444-8444-444444444444",
    payment_request_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    amount_cents: 462500,
    occurred_at: "2026-08-25T18:14:00.000Z",
    provider_event_id: "evt_p2",
    provider_payment_intent_id: "pi_p2",
  }),
  txn({
    id: "55555555-5555-4555-8555-555555555555",
    payment_request_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    amount_cents: 725000,
    occurred_at: "2026-08-26T16:12:00.000Z",
    provider_event_id: "evt_bal",
    provider_payment_intent_id: "pi_bal",
  }),
];

const LONG_REQUESTS: JobPaymentWorkspaceRequest[] = [
  PAID_DEPOSIT,
  ...Array.from({ length: 8 }, (_, index) =>
    request({
      id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
      kind: "progress",
      status: "paid",
      amount_cents: 150000,
      requested_at: `2026-08-${String(20 + index).padStart(2, "0")}T15:00:00.000Z`,
      paid_at: `2026-08-${String(20 + index).padStart(2, "0")}T15:08:00.000Z`,
    })
  ),
];

const LONG_TXNS: JobPaymentWorkspaceTransaction[] = [
  DEPOSIT_CAPTURE,
  ...Array.from({ length: 8 }, (_, index) =>
    txn({
      id: `66666666-6666-4666-8666-66666666666${index}`,
      payment_request_id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb${index}`,
      amount_cents: 150000,
      occurred_at: `2026-08-${String(20 + index).padStart(2, "0")}T15:08:00.000Z`,
      provider_event_id: `evt_long_${index}`,
      provider_payment_intent_id: `pi_long_${index}`,
    })
  ),
];

const FIXTURES = {
  empty: buildJobPaymentWorkspace({
    jobStage: "approved",
    accepted: true,
    account: ACCOUNT,
    terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
    customerChosenTotalCents: 1850000,
    requests: [],
    transactions: [],
  }),
  "current-open": buildJobPaymentWorkspace({
    jobStage: "production",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 1850000,
    requests: [
      PAID_DEPOSIT,
      request({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        kind: "progress",
        status: "cancelled",
        amount_cents: 300000,
        requested_at: "2026-08-26T16:00:00.000Z",
        cancelled_at: "2026-08-26T17:00:00.000Z",
      }),
      request({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        kind: "progress",
        status: "open",
        amount_cents: 462500,
        requested_at: "2026-08-27T17:52:00.000Z",
      }),
    ],
    transactions: [DEPOSIT_CAPTURE],
  }),
  "failed-retry": buildJobPaymentWorkspace({
    jobStage: "approved",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 1850000,
    requests: [
      request({ status: "failed" }),
      request({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "open",
        requested_at: "2026-08-24T15:00:00.000Z",
      }),
    ],
    transactions: [
      txn({
        kind: "failure",
        status: "failed",
        occurred_at: "2026-08-24T14:18:00.000Z",
        provider_event_id: "evt_fail",
        provider_payment_intent_id: "pi_fail",
      }),
    ],
  }),
  sequential: buildJobPaymentWorkspace({
    jobStage: "complete",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 1850000,
    requests: SEQUENTIAL_REQUESTS,
    transactions: SEQUENTIAL_TXNS,
  }),
  refund: buildJobPaymentWorkspace({
    jobStage: "complete",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 1850000,
    requests: SEQUENTIAL_REQUESTS,
    transactions: SEQUENTIAL_TXNS,
    refunds: [refund()],
  }),
  "refund-processing": buildJobPaymentWorkspace({
    jobStage: "complete",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 1850000,
    requests: SEQUENTIAL_REQUESTS,
    transactions: SEQUENTIAL_TXNS,
    refunds: [
      refund({
        status: "pending",
        pending_at: "2026-08-27T15:20:00.000Z",
        succeeded_at: null,
      }),
    ],
  }),
  "refund-failed": buildJobPaymentWorkspace({
    jobStage: "complete",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 1850000,
    requests: SEQUENTIAL_REQUESTS,
    transactions: SEQUENTIAL_TXNS,
    refunds: [
      refund({
        status: "failed",
        failed_at: "2026-08-27T15:20:00.000Z",
        succeeded_at: null,
      }),
    ],
  }),
  "refund-multiple": buildJobPaymentWorkspace({
    jobStage: "complete",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 1850000,
    requests: SEQUENTIAL_REQUESTS,
    transactions: SEQUENTIAL_TXNS,
    refunds: [
      refund({ amount_cents: 25000 }),
      refund({
        id: "88888888-8888-4888-8888-888888888888",
        amount_cents: 25000,
        status: "pending",
        pending_at: "2026-08-27T16:20:00.000Z",
        succeeded_at: null,
        updated_at: "2026-08-27T16:20:00.000Z",
      }),
    ],
  }),
  "long-history": buildJobPaymentWorkspace({
    jobStage: "production",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 3200000,
    requests: LONG_REQUESTS,
    transactions: LONG_TXNS,
  }),
} as const;

type FixtureId = keyof typeof FIXTURES | "activity" | "customer-refund";

const CUSTOMER_REFUND_PAYMENT: PublicPaymentViewModel = {
  state: "payments_complete_with_refund",
  kind: null,
  amountLabel: null,
  kindLabel: null,
  heading: "Payments complete",
  explanation: "A refund was recorded. No further payment is due on this proposal.",
  contextNote: null,
  ctaLabel: null,
  stripeNote: null,
  paidOnLabel: null,
  methodLabel: null,
  history: [
    {
      id: "payment:fixture",
      type: "payment",
      kind: "balance",
      kindLabel: "Remaining balance",
      amountLabel: "$7,250.00",
      paidOnLabel: "Aug 26, 2026",
      detail: null,
    },
    {
      id: "refund:pending",
      type: "refund",
      kind: null,
      kindLabel: "Refund processing",
      amountLabel: "$250.00",
      paidOnLabel: null,
      detail: "A refund of $250.00 is being processed.",
    },
    {
      id: "refund:succeeded",
      type: "refund",
      kind: null,
      kindLabel: "Refund sent",
      amountLabel: "$500.00",
      paidOnLabel: null,
      detail:
        "A refund of $500.00 was sent to your original payment method. Your bank may take 5–10 business days to post it.",
    },
  ],
  originalTerms: null,
};

const ACTIVITY_ITEMS = composeJobActivityItems({
  jobCreatedAt: "2026-08-20T12:00:00.000Z",
  jobActivityEvents: [
    {
      id: "evt-created",
      company_id: "co",
      job_id: "job",
      event_type: "job_created",
      actor_user_id: null,
      payload_json: { stage: "intake", status: "active" },
      occurred_at: "2026-08-20T12:00:00.000Z",
      created_at: "2026-08-20T12:00:00.000Z",
    },
    {
      id: "evt-work",
      company_id: "co",
      job_id: "job",
      event_type: "job_work_started",
      actor_user_id: null,
      payload_json: { production_started_at: "2026-08-26T13:00:00.000Z" },
      occurred_at: "2026-08-26T13:00:00.000Z",
      created_at: "2026-08-26T13:00:00.000Z",
    },
    {
      id: "evt-complete",
      company_id: "co",
      job_id: "job",
      event_type: "job_work_completed",
      actor_user_id: null,
      payload_json: { completed_at: "2026-08-29T15:00:00.000Z" },
      occurred_at: "2026-08-29T15:00:00.000Z",
      created_at: "2026-08-29T15:00:00.000Z",
    },
  ],
  acceptanceItems: [
    {
      label: "Proposal accepted",
      note: "Premium package",
      acceptedAt: "2026-08-24T14:00:00.000Z",
      acceptanceId: "acc-1",
    },
  ],
  paymentItems: [],
});

export default function PaymentStage2EReviewHarness() {
  const search = useSearchParams();
  const show = (search.get("show") ?? "current-open") as FixtureId;
  const fixture: FixtureId =
    show === "activity" || show === "customer-refund" || show in FIXTURES
      ? show
      : "current-open";
  const [tab, setTab] = useState<JobCardTabId>(
    coerceJobCardVisibleTab(search.get("tab") ?? "payments")
  );

  if (fixture === "activity") {
    return (
      <div className="bg-white" data-stage2e-review="activity">
        <JobCardActivityPanel items={ACTIVITY_ITEMS} />
      </div>
    );
  }

  if (fixture === "customer-refund") {
    return (
      <main className="min-h-screen bg-[#f3f6f8] px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <ProposalPacketPurchase
            packageLabel="Roof replacement"
            packageDescription="Architectural shingles with complete tear-off and installation."
            packageTotalLabel="$18,500.00"
            packageTotalCents={1850000}
            terms={DEFAULT_PROPOSAL_PAYMENT_TERMS}
            payment={CUSTOMER_REFUND_PAYMENT}
            accepted
            acceptedOnLabel="Aug 24, 2026"
            action={{
              kind: "none",
              label: null,
              busy: false,
              error: null,
              submit: () => undefined,
            }}
          />
        </div>
      </main>
    );
  }

  const workspace = FIXTURES[fixture];
  return (
    <div className="bg-white" data-stage2e-review={fixture}>
      <JobCardTabs activeTab={tab} onTabChange={setTab} />
      <div className="px-4 py-4 sm:px-6">
        <JobCardSectionPanel
          tabId="payments"
          activeTab={tab}
          title="Payments"
          subtitle="Contract, collected, and remaining"
        >
          <JobCardPaymentsWorkspace
            workspace={workspace}
            onCollectPayment={
              workspace.canCollectPayment ? async () => ({ ok: true }) : undefined
            }
            onCancelCurrentRequest={
              workspace.currentRequest?.status === "open"
                ? async () => ({ ok: true })
                : undefined
            }
            onCopyPaymentLink={
              workspace.currentRequest
                ? async () => ({ ok: true, url: "/p/fixture" })
                : undefined
            }
            onIssueRefund={async () => ({ ok: true })}
          />
        </JobCardSectionPanel>
      </div>
    </div>
  );
}
