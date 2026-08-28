"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import JobCardOverviewSummary from "@/app/tools/roofing/jobCard/JobCardOverviewSummary";
import JobCardPaymentsWorkspace from "@/app/tools/roofing/jobCard/JobCardPaymentsWorkspace";
import JobCardSectionPanel from "@/app/tools/roofing/jobCard/JobCardSectionPanel";
import JobCardTabs from "@/app/tools/roofing/jobCard/JobCardTabs";
import type { JobCardTabId } from "@/app/tools/roofing/jobCard/jobCardTypes";
import { coerceJobCardVisibleTab } from "@/app/tools/roofing/jobCard/jobCardTypes";
import {
  buildJobPaymentWorkspace,
  type JobPaymentWorkspaceRequest,
  type JobPaymentWorkspaceTransaction,
} from "@/app/lib/jobPaymentWorkspace";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "@/app/lib/proposalPaymentTerms";
import type { JobCardDisplayModel } from "@/app/tools/roofing/jobCard/jobCardDisplayTypes";

const ACCOUNT = {
  charges_enabled: true,
  onboarding_status: "complete",
  details_submitted: true,
  payouts_enabled: true,
};

const DEPOSIT_TERMS = {
  ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
  depositMode: "fixed" as const,
  depositFixedCents: 100000,
};

function request(
  overrides: Partial<JobPaymentWorkspaceRequest> = {}
): JobPaymentWorkspaceRequest {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    kind: "deposit",
    status: "open",
    amount_cents: 100000,
    requested_at: "2026-08-26T12:00:00.000Z",
    paid_at: null,
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
    amount_cents: 100000,
    occurred_at: "2026-08-26T13:00:00.000Z",
    provider_event_id: "evt_pi_succeeded",
    provider_payment_intent_id: "pi_shared",
    ...overrides,
  };
}

const DISPLAY: JobCardDisplayModel = {
  customerName: "Anderson",
  address: "101 Oak Street",
  stageLabel: "Approved",
  dispositionLabel: "Active",
  valueLabel: "—",
  lastUpdatedDisplay: null,
  timeInStage: null,
  timeInStageTone: "neutral",
  reportLabel: "Ready",
  proposalLabel: "Accepted",
  tasksLabel: "None",
};

const FIXTURES = {
  "deposit-due": buildJobPaymentWorkspace({
    jobStage: "approved",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 2702860,
    acceptedTotalCents: 1850000,
    requests: [request()],
    transactions: [],
  }),
  "deposit-received": buildJobPaymentWorkspace({
    jobStage: "production",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 2702860,
    acceptedTotalCents: 1850000,
    requests: [
      request({
        status: "paid",
        paid_at: "2026-08-26T13:00:00.000Z",
        settled_payment_method_label: "Cards",
      }),
    ],
    transactions: [txn()],
  }),
  "balance-due": buildJobPaymentWorkspace({
    jobStage: "complete",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 2702860,
    acceptedTotalCents: 1850000,
    requests: [
      request({
        status: "paid",
        paid_at: "2026-08-26T13:00:00.000Z",
        settled_payment_method_label: "Cards",
      }),
    ],
    transactions: [txn()],
  }),
  "paid-in-full": buildJobPaymentWorkspace({
    jobStage: "complete",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 100000,
    acceptedTotalCents: 100000,
    requests: [
      request({
        status: "paid",
        paid_at: "2026-08-26T13:00:00.000Z",
        settled_payment_method_label: "Cards",
      }),
    ],
    transactions: [txn()],
  }),
  processing: buildJobPaymentWorkspace({
    jobStage: "approved",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 2702860,
    requests: [request({ status: "processing" })],
    transactions: [],
  }),
  failed: buildJobPaymentWorkspace({
    jobStage: "approved",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 2702860,
    requests: [request({ status: "failed" })],
    transactions: [
      txn({
        kind: "failure",
        status: "failed",
        provider_event_id: "evt_fail",
        provider_payment_intent_id: "pi_fail",
      }),
    ],
  }),
  refund: buildJobPaymentWorkspace({
    jobStage: "complete",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: 2000000,
    acceptedTotalCents: 2000000,
    requests: [
      request({ status: "paid", paid_at: "2026-08-26T13:00:00.000Z" }),
      request({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        kind: "balance",
        status: "paid",
        amount_cents: 1900000,
        requested_at: "2026-08-27T12:00:00.000Z",
        paid_at: "2026-08-27T13:00:00.000Z",
      }),
    ],
    transactions: [
      txn(),
      txn({
        id: "22222222-2222-4222-8222-222222222222",
        payment_request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        amount_cents: 1900000,
        occurred_at: "2026-08-27T13:00:00.000Z",
        provider_event_id: "evt_balance",
        provider_payment_intent_id: "pi_balance",
      }),
      txn({
        id: "33333333-3333-4333-8333-333333333333",
        kind: "refund",
        status: "refunded",
        amount_cents: 50000,
        occurred_at: "2026-08-27T15:00:00.000Z",
        provider_event_id: "evt_refund",
        provider_payment_intent_id: "pi_balance",
      }),
    ],
  }),
} as const;

type FixtureId = keyof typeof FIXTURES;

function PaymentStage2AReviewBody({
  show,
  initialTab,
}: {
  show: FixtureId;
  initialTab: JobCardTabId;
}) {
  const workspace = FIXTURES[show] ?? FIXTURES["deposit-received"];
  const [tab, setTab] = useState<JobCardTabId>(initialTab);

  return (
    <div className="bg-white" data-stage2a-review={show}>
      <JobCardTabs activeTab={tab} onTabChange={setTab} />
      <div className="p-5 sm:p-6">
        <JobCardSectionPanel
          tabId="overview"
          activeTab={tab}
          title="Overview"
          subtitle="Job summary and status at a glance"
        >
          <JobCardOverviewSummary
            proposalLabel="Accepted"
            measurementLabel="2,400 sq ft · 10% waste"
            paymentStatusLabel={workspace.overviewStatusLabel}
          />
        </JobCardSectionPanel>
        <JobCardSectionPanel
          tabId="payments"
          activeTab={tab}
          title="Payments"
          subtitle="Contract, received, and remaining"
        >
          <JobCardPaymentsWorkspace workspace={workspace} />
        </JobCardSectionPanel>
      </div>
    </div>
  );
}

export default function PaymentStage2AReviewHarness() {
  const search = useSearchParams();
  const show = (search.get("show") ?? "deposit-received") as FixtureId;
  const surface = search.get("surface") ?? "payments";
  const fixture: FixtureId = show in FIXTURES ? show : "deposit-received";
  const initialTab = coerceJobCardVisibleTab(
    search.get("tab") ?? (surface === "overview" ? "overview" : "payments")
  );
  return (
    <PaymentStage2AReviewBody
      key={`${fixture}-${surface}-${initialTab}`}
      show={fixture}
      initialTab={initialTab}
    />
  );
}
