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
import { buildPublicPaymentViewModel } from "@/app/lib/jobPaymentCustomerPresenter";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "@/app/lib/proposalPaymentTerms";
import type { JobPaymentsLoadStatus } from "@/app/lib/useJobPayments";
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

const ZERO_TERMS = {
  ...DEFAULT_PROPOSAL_PAYMENT_TERMS,
  depositMode: "none" as const,
  depositFixedCents: null,
  depositPercentBps: null,
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

const WORKSPACE_FIXTURES = {
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
  "positive-no-request": buildJobPaymentWorkspace({
    jobStage: "approved",
    accepted: true,
    account: ACCOUNT,
    terms: ZERO_TERMS,
    customerChosenTotalCents: 2702860,
    acceptedTotalCents: 2702860,
    requests: [],
    transactions: [],
  }),
  "balance-due-no-request": buildJobPaymentWorkspace({
    jobStage: "complete",
    accepted: true,
    account: ACCOUNT,
    terms: ZERO_TERMS,
    customerChosenTotalCents: 2702860,
    acceptedTotalCents: 2702860,
    requests: [],
    transactions: [],
  }),
  "known-zero": buildJobPaymentWorkspace({
    jobStage: "approved",
    accepted: true,
    account: ACCOUNT,
    terms: ZERO_TERMS,
    customerChosenTotalCents: 0,
    acceptedTotalCents: 0,
    requests: [],
    transactions: [],
  }),
  "contract-unavailable": buildJobPaymentWorkspace({
    jobStage: "approved",
    accepted: true,
    account: ACCOUNT,
    terms: DEPOSIT_TERMS,
    customerChosenTotalCents: null,
    acceptedTotalCents: null,
    requests: [],
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
      request({
        status: "paid",
        amount_cents: 2000000,
        paid_at: "2026-08-26T13:00:00.000Z",
        settled_payment_method_label: "Cards",
      }),
    ],
    transactions: [
      txn({
        amount_cents: 2000000,
        occurred_at: "2026-08-26T13:00:00.000Z",
      }),
    ],
    refunds: [
      {
        id: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr",
        company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        job_id: "jjjjjjjj-jjjj-4jjj-8jjj-jjjjjjjjjjjj",
        payment_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        canonical_capture_transaction_id: "11111111-1111-4111-8111-111111111111",
        amount_cents: 200000,
        status: "succeeded",
        initiated_at: "2026-08-27T15:00:00.000Z",
        pending_at: null,
        requires_action_at: null,
        succeeded_at: "2026-08-27T15:01:00.000Z",
        failed_at: null,
        canceled_at: null,
        created_at: "2026-08-27T15:00:00.000Z",
        updated_at: "2026-08-27T15:01:00.000Z",
      },
    ],
  }),
} as const;

type WorkspaceFixtureId = keyof typeof WORKSPACE_FIXTURES;
type LoadOnlyFixtureId = "loading" | "fetch-error";
type PublicFixtureId = "public-positive-no-request" | "public-known-zero";
type FixtureId = WorkspaceFixtureId | LoadOnlyFixtureId | PublicFixtureId;

function PublicHonestyPanel({ fixture }: { fixture: PublicFixtureId }) {
  const view =
    fixture === "public-known-zero"
      ? buildPublicPaymentViewModel({
          requests: [],
          transactions: [],
          refunds: [],
          accepted: true,
          contractTotalCents: 0,
          terms: ZERO_TERMS,
        })
      : buildPublicPaymentViewModel({
          requests: [],
          transactions: [],
          refunds: [],
          accepted: true,
          contractTotalCents: 2702860,
          terms: ZERO_TERMS,
        });

  return (
    <div
      className="mx-auto max-w-md bg-white p-6"
      data-phase2a-public={fixture}
      data-public-payment-state={view?.state ?? "none"}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Public payment (review)
      </p>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">
        {view?.heading ?? "—"}
      </h2>
      {view?.explanation ? (
        <p className="mt-2 text-sm text-slate-600">{view.explanation}</p>
      ) : null}
      {view?.amountLabel ? (
        <div className="mt-3">
          {view.kindLabel ? (
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {view.kindLabel}
            </p>
          ) : null}
          <p className="mt-0.5 text-sm font-medium tabular-nums text-slate-900">
            {view.amountLabel}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function PaymentStage2AReviewBody({
  show,
  initialTab,
}: {
  show: FixtureId;
  initialTab: JobCardTabId;
}) {
  const [tab, setTab] = useState<JobCardTabId>(initialTab);

  if (show === "public-positive-no-request" || show === "public-known-zero") {
    return <PublicHonestyPanel fixture={show} />;
  }

  const loadStatus: JobPaymentsLoadStatus =
    show === "loading" ? "loading" : show === "fetch-error" ? "error" : "ready";
  const workspace =
    show === "loading" || show === "fetch-error"
      ? null
      : WORKSPACE_FIXTURES[show as WorkspaceFixtureId] ??
        WORKSPACE_FIXTURES["deposit-received"];

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
            paymentStatusLabel={
              loadStatus === "error"
                ? "Payment information unavailable"
                : loadStatus === "loading"
                  ? null
                  : workspace?.overviewStatusLabel ?? null
            }
          />
        </JobCardSectionPanel>
        <JobCardSectionPanel
          tabId="payments"
          activeTab={tab}
          title="Payments"
          subtitle="Contract, received, and remaining"
        >
          <JobCardPaymentsWorkspace
            workspace={workspace}
            loadStatus={loadStatus}
          />
        </JobCardSectionPanel>
      </div>
    </div>
  );
}

export default function PaymentStage2AReviewHarness() {
  const search = useSearchParams();
  const show = (search.get("show") ?? "deposit-received") as FixtureId;
  const surface = search.get("surface") ?? "payments";
  const known: FixtureId[] = [
    ...Object.keys(WORKSPACE_FIXTURES),
    "loading",
    "fetch-error",
    "public-positive-no-request",
    "public-known-zero",
  ] as FixtureId[];
  const fixture: FixtureId = known.includes(show) ? show : "deposit-received";
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
