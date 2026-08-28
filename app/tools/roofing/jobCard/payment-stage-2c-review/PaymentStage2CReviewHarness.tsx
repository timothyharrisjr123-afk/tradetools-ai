"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import JobCardPaymentsWorkspace from "@/app/tools/roofing/jobCard/JobCardPaymentsWorkspace";
import JobCardSectionPanel from "@/app/tools/roofing/jobCard/JobCardSectionPanel";
import JobCardTabs from "@/app/tools/roofing/jobCard/JobCardTabs";
import type { JobCardTabId } from "@/app/tools/roofing/jobCard/jobCardTypes";
import { coerceJobCardVisibleTab } from "@/app/tools/roofing/jobCard/jobCardTypes";
import {
  buildJobPaymentWorkspace,
  type JobPaymentWorkspaceRequest,
} from "@/app/lib/jobPaymentWorkspace";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "@/app/lib/proposalPaymentTerms";

const ACCOUNT = {
  charges_enabled: true,
  onboarding_status: "complete",
  details_submitted: true,
  payouts_enabled: true,
};

function request(
  overrides: Partial<JobPaymentWorkspaceRequest> = {}
): JobPaymentWorkspaceRequest {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    kind: "progress",
    status: "open",
    amount_cents: 1000000,
    requested_at: "2026-08-27T18:00:00.000Z",
    paid_at: null,
    settled_payment_method_label: null,
    ...overrides,
  };
}

const FIXTURES = {
  "progress-open": buildJobPaymentWorkspace({
    jobStage: "production",
    accepted: true,
    account: ACCOUNT,
    terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
    customerChosenTotalCents: 1850000,
    requests: [request()],
    transactions: [],
  }),
  "progress-processing": buildJobPaymentWorkspace({
    jobStage: "production",
    accepted: true,
    account: ACCOUNT,
    terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
    customerChosenTotalCents: 1850000,
    requests: [request({ status: "processing" })],
    transactions: [],
  }),
  "failed-collect": buildJobPaymentWorkspace({
    jobStage: "approved",
    accepted: true,
    account: ACCOUNT,
    terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
    customerChosenTotalCents: 1850000,
    requests: [request({ status: "failed", amount_cents: 25000 })],
    transactions: [],
  }),
} as const;

type FixtureId = keyof typeof FIXTURES;

export default function PaymentStage2CReviewHarness() {
  const search = useSearchParams();
  const show = (search.get("show") ?? "progress-open") as FixtureId;
  const fixture: FixtureId = show in FIXTURES ? show : "progress-open";
  const workspace = FIXTURES[fixture];
  const [tab, setTab] = useState<JobCardTabId>(
    coerceJobCardVisibleTab(search.get("tab") ?? "payments")
  );

  return (
    <div className="bg-white" data-stage2c-review={fixture}>
      <JobCardTabs activeTab={tab} onTabChange={setTab} />
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
            workspace.currentRequest ? async () => ({ ok: true, url: "/p/fixture" }) : undefined
          }
        />
      </JobCardSectionPanel>
    </div>
  );
}
