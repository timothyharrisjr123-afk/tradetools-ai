/**
 * Payment Stage 2A — canonical Job Card Payments workspace read model.
 *
 * Run: npx tsx --test app/lib/jobPaymentWorkspace.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  applyJobCardTabToSearch,
  coerceJobCardVisibleTab,
  isJobCardVisibleTabId,
  JOB_CARD_TABS,
  JOB_CARD_VISIBLE_TAB_IDS,
} from "@/app/tools/roofing/jobCard/jobCardTypes";
import {
  buildJobPaymentWorkspace,
  jobPaymentCanonicalCaptureIdentity,
  jobPaymentCollectibleRemainingCents,
  jobPaymentWorkspaceCashNetCents,
  jobPaymentWorkspaceGrossCents,
  jobPaymentWorkspaceSummaryRows,
  proposalAcceptanceContractTotalCents,
  type JobPaymentWorkspaceRequest,
  type JobPaymentWorkspaceTransaction,
} from "./jobPaymentWorkspace";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "./proposalPaymentTerms";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

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

describe("canonical contract total", () => {
  test("customer-chosen cents precede legacy accepted_total_cents", () => {
    assert.equal(
      proposalAcceptanceContractTotalCents({
        customerChosenTotalCents: 2702860,
        acceptedTotalCents: 1850000,
      }),
      2702860
    );
  });

  test("falls back to accepted_total_cents when no customer choice", () => {
    assert.equal(
      proposalAcceptanceContractTotalCents({
        customerChosenTotalCents: null,
        acceptedTotalCents: 1850000,
      }),
      1850000
    );
  });

  test("Job Card payment route reads customer-chosen contract truth", () => {
    const route = read("app/api/jobs/[jobId]/payment-requests/route.ts");
    assert.match(route, /customer_chosen_total_cents/);
    assert.match(route, /proposalAcceptanceContractTotalCents|buildJobPaymentWorkspace/);
    assert.match(route, /provider_payment_intent_id/);
  });
});

describe("collectible vs net", () => {
  test("collectible is contract minus gross, not net", () => {
    const contract = 2000000;
    const gross = 2000000;
    const refunded = 100000;
    const net = jobPaymentWorkspaceCashNetCents({
      receivedGrossCents: gross,
      refundedCents: refunded,
    });
    assert.equal(net, 1900000);
    assert.equal(
      jobPaymentCollectibleRemainingCents({
        contractTotalCents: contract,
        receivedGrossCents: gross,
      }),
      0
    );
  });

  test("refund does not reopen collectible", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEPOSIT_TERMS,
      customerChosenTotalCents: 2000000,
      acceptedTotalCents: 1850000,
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
    });
    assert.equal(workspace.receivedGrossCents, 2000000);
    assert.equal(workspace.refundedCents, 50000);
    assert.equal(workspace.cashNetCents, 1950000);
    assert.equal(workspace.collectibleRemainingCents, 0);
    assert.equal(workspace.state, "paid_in_full");
    assert.equal(workspace.nextStep, null);
    assert.ok(workspace.summaryRows.some((row) => row.label === "Refunded"));
  });

  test("cash net remains distinct from Remaining", () => {
    const rows = jobPaymentWorkspaceSummaryRows({
      contractTotalCents: 2000000,
      receivedGrossCents: 2000000,
      collectibleRemainingCents: 0,
      refundedCents: 50000,
    });
    assert.deepEqual(
      rows.map((row) => row.label),
      ["Contract", "Received", "Remaining", "Refunded"]
    );
    assert.equal(
      rows.find((row) => row.label === "Remaining")?.cents,
      0
    );
  });
});

describe("duplicate capture display suppression", () => {
  test("two events for one PaymentIntent count once for money and timeline", () => {
    const duplicate = [
      txn({
        id: "11111111-1111-4111-8111-111111111111",
        provider_event_id: "evt_pi",
        provider_payment_intent_id: "pi_shared",
      }),
      txn({
        id: "22222222-2222-4222-8222-222222222222",
        provider_event_id: "evt_cs",
        provider_payment_intent_id: "pi_shared",
        occurred_at: "2026-08-26T13:00:01.000Z",
      }),
    ];
    assert.equal(jobPaymentWorkspaceGrossCents(duplicate), 100000);
    const workspace = buildJobPaymentWorkspace({
      jobStage: "approved",
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
      transactions: duplicate,
    });
    assert.equal(workspace.receivedGrossCents, 100000);
    assert.equal(workspace.collectibleRemainingCents, 2602860);
    assert.equal(
      workspace.timeline.filter((row) => row.type === "received").length,
      1
    );
    assert.equal(
      jobPaymentCanonicalCaptureIdentity({
        providerPaymentIntentId: "pi_shared",
        providerEventId: "evt_pi",
      }),
      jobPaymentCanonicalCaptureIdentity({
        providerPaymentIntentId: "pi_shared",
        providerEventId: "evt_cs",
      })
    );
  });
});

describe("payment-state presenter", () => {
  test("no acceptance is no payment required yet", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "intake",
      accepted: false,
      account: ACCOUNT,
      terms: DEPOSIT_TERMS,
      requests: [],
      transactions: [],
    });
    assert.equal(workspace.state, "no_payment_required");
    assert.equal(workspace.statusLabel, "No payment required yet");
    assert.equal(workspace.overviewStatusLabel, null);
    assert.equal(workspace.nextStep, null);
    assert.equal(workspace.timeline.length, 0);
  });

  test("accepted no-deposit proposal is balance due on completion before Complete", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "approved",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 1500000,
      acceptedTotalCents: 1500000,
      requests: [],
      transactions: [],
    });
    assert.equal(workspace.state, "balance_not_yet_due");
    assert.equal(workspace.statusLabel, "Remaining to collect");
    assert.equal(workspace.overviewStatusLabel, "Remaining to collect");
    assert.equal(workspace.collectibleRemainingCents, 1500000);
    assert.doesNotMatch(workspace.overviewStatusLabel ?? "", /\$/);
  });

  test("deposit required unpaid is Deposit due", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "approved",
      accepted: true,
      account: ACCOUNT,
      terms: DEPOSIT_TERMS,
      customerChosenTotalCents: 2702860,
      acceptedTotalCents: 1850000,
      requests: [request()],
      transactions: [],
    });
    assert.equal(workspace.state, "deposit_due");
    assert.equal(workspace.statusLabel, "Deposit due");
    assert.equal(workspace.overviewStatusLabel, "Payment pending");
    assert.equal(workspace.depositNotReceived, true);
    assert.equal(workspace.nextStep, null);
    assert.equal(workspace.currentRequest?.status, "open");
  });

  test("deposit processing", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "approved",
      accepted: true,
      account: ACCOUNT,
      terms: DEPOSIT_TERMS,
      customerChosenTotalCents: 2702860,
      requests: [request({ status: "processing" })],
      transactions: [],
    });
    assert.equal(workspace.state, "deposit_processing");
    assert.equal(workspace.statusLabel, "Deposit processing");
    assert.equal(workspace.overviewStatusLabel, "Payment pending");
    assert.equal(workspace.nextStep, null);
    assert.equal(workspace.currentRequest?.status, "processing");
    assert.equal(
      workspace.timeline.some((row) => row.type === "processing"),
      true
    );
  });

  test("deposit received uses 053 contract total and remaining collectible", () => {
    const workspace = buildJobPaymentWorkspace({
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
    });
    assert.equal(workspace.contractTotalCents, 2702860);
    assert.equal(workspace.receivedGrossCents, 100000);
    assert.equal(workspace.collectibleRemainingCents, 2602860);
    assert.equal(workspace.state, "deposit_received");
    assert.equal(workspace.statusLabel, "Deposit received");
    assert.equal(workspace.overviewStatusLabel, "Deposit received");
    assert.equal(workspace.nextStep, null);
    assert.equal(workspace.depositNotReceived, false);
  });

  test("failed request", () => {
    const workspace = buildJobPaymentWorkspace({
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
    });
    assert.equal(workspace.state, "payment_failed");
    assert.equal(workspace.statusLabel, "Payment failed");
    assert.equal(workspace.overviewStatusLabel, "Payment failed");
    assert.equal(workspace.nextStep, null);
    assert.equal(workspace.currentRequest, null);
    assert.equal(workspace.canCollectPayment, true);
  });

  test("balance due only on Complete", () => {
    const before = buildJobPaymentWorkspace({
      jobStage: "production",
      accepted: true,
      account: ACCOUNT,
      terms: DEPOSIT_TERMS,
      customerChosenTotalCents: 2702860,
      requests: [
        request({
          status: "paid",
          paid_at: "2026-08-26T13:00:00.000Z",
        }),
      ],
      transactions: [txn()],
    });
    assert.equal(before.state, "deposit_received");
    assert.equal(before.canCollectRemainingBalance, false);
    assert.notEqual(before.statusLabel, "Balance due");

    const after = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEPOSIT_TERMS,
      customerChosenTotalCents: 2702860,
      requests: [
        request({
          status: "paid",
          paid_at: "2026-08-26T13:00:00.000Z",
        }),
      ],
      transactions: [txn()],
    });
    assert.equal(after.state, "balance_due");
    assert.equal(after.statusLabel, "Balance due");
    assert.equal(after.overviewStatusLabel, "Balance due");
    assert.equal(after.canCollectRemainingBalance, true);
    assert.doesNotMatch(after.nextStep?.label ?? "", /Stage 2|coming in Stage/i);
  });

  test("paid in full", () => {
    const workspace = buildJobPaymentWorkspace({
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
        }),
      ],
      transactions: [txn()],
    });
    assert.equal(workspace.state, "paid_in_full");
    assert.equal(workspace.collectibleRemainingCents, 0);
    assert.equal(workspace.overviewStatusLabel, "Paid in full");
    assert.equal(workspace.nextStep, null);
    assert.equal(workspace.canCollectRemainingBalance, false);
  });

  test("Stripe not connected", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "approved",
      accepted: true,
      account: null,
      terms: DEPOSIT_TERMS,
      customerChosenTotalCents: 2702860,
      requests: [],
      transactions: [],
    });
    assert.equal(workspace.state, "setup_required");
    assert.equal(workspace.statusLabel, "Payments setup required");
    assert.ok(workspace.nextStep?.connectHref);
  });

  test("Overview status never includes a dollar amount", () => {
    const states = [
      buildJobPaymentWorkspace({
        jobStage: "approved",
        accepted: true,
        account: ACCOUNT,
        terms: DEPOSIT_TERMS,
        customerChosenTotalCents: 2702860,
        requests: [request()],
        transactions: [],
      }),
      buildJobPaymentWorkspace({
        jobStage: "complete",
        accepted: true,
        account: ACCOUNT,
        terms: DEPOSIT_TERMS,
        customerChosenTotalCents: 2702860,
        requests: [request({ status: "paid" })],
        transactions: [txn()],
      }),
    ];
    for (const workspace of states) {
      assert.doesNotMatch(workspace.overviewStatusLabel ?? "", /\$|USD|\d{3,}/);
    }
  });
});

describe("Payments tab routing", () => {
  test("Payments is a visible tab after Proposals", () => {
    assert.ok(JOB_CARD_TABS.some((tab) => tab.id === "payments"));
    const visible = JOB_CARD_VISIBLE_TAB_IDS as readonly string[];
    assert.equal(visible.includes("payments"), true);
    assert.ok(visible.indexOf("proposals") < visible.indexOf("payments"));
    assert.ok(visible.indexOf("payments") < visible.indexOf("attachments"));
    assert.equal(isJobCardVisibleTabId("payments"), true);
    assert.equal(coerceJobCardVisibleTab("payments"), "payments");
    assert.equal(coerceJobCardVisibleTab("invoices"), "overview");
  });

  test("direct tab=payments survives search rewrite", () => {
    const qs = applyJobCardTabToSearch("entry=job-card&job=abc", "payments");
    assert.match(qs, /tab=payments/);
    const overview = applyJobCardTabToSearch(qs, "overview");
    assert.doesNotMatch(overview, /tab=/);
  });

  test("Job Card clients render the Payments panel", () => {
    const jobCard = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(jobCard, /tabId="payments"/);
    assert.match(jobCard, /JobCardPaymentsWorkspace/);
    assert.match(roofing, /tabId="payments"/);
    assert.match(roofing, /JobCardPaymentsWorkspace/);
    assert.match(jobCard, /applyJobCardTabToSearch/);
  });

  test("390 workspace stays stacked, not a horizontal money table", () => {
    const ui = read("app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx");
    assert.match(ui, /flex-col/);
    assert.doesNotMatch(ui, /overflow-x-auto/);
    assert.doesNotMatch(ui, /table/);
    assert.doesNotMatch(ui, /sticky/);
  });

  test("Overview quiet line has no dollars and Board is untouched", () => {
    const overview = read("app/tools/roofing/jobCard/JobCardOverviewSummary.tsx");
    assert.match(overview, /paymentStatusLabel/);
    assert.match(overview, /data-jobcard-overview-payment/);
    assert.doesNotMatch(overview, /formatUsdFromCents/);
    const board = read("app/tools/roofing/saved/components/JobsBoardCard.tsx");
    assert.doesNotMatch(board, /data-board-payment/);
    assert.doesNotMatch(board, /JobCardPaymentsWorkspace/);
  });

  test("payment Attention destinations land on the Payments tab", () => {
    const model = read("app/lib/jobAttentionReadModel.ts");
    assert.match(model, /tab: "payments"/);
    assert.match(model, /record\.tab !== "payments"/);
  });

  test("contractor-facing Payments UI has no internal stage/roadmap copy", () => {
    const presenter = read("app/lib/jobPaymentWorkspace.ts");
    const workspaceUi = read("app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx");
    const overview = read("app/tools/roofing/jobCard/JobCardOverviewSummary.tsx");
    const harness = read(
      "app/tools/roofing/jobCard/payment-stage-2a-review/PaymentStage2AReviewHarness.tsx"
    );
    for (const source of [presenter, workspaceUi, overview, harness]) {
      assert.doesNotMatch(source, /coming in Stage/);
      assert.doesNotMatch(source, /collection setup coming/);
      assert.doesNotMatch(source, /Stage 2B/);
    }
    assert.doesNotMatch(workspaceUi, /Stage 2A/);
    assert.doesNotMatch(overview, /Stage 2A/);
    assert.doesNotMatch(harness, /Stage 2A/);
  });

  test("Payments surface has no Next step heading; Collect is the action", () => {
    const ui = read("app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx");
    assert.doesNotMatch(ui, />Next step</);
    assert.doesNotMatch(ui, /data-jobcard-payments-next/);
    assert.match(ui, /JOB_CARD_PAYMENTS_COLLECT_CTA/);
    assert.match(ui, /workspace\.nextStep\?\.connectHref/);
  });

  test("tab rail scrolls the active tab into view", () => {
    const tabs = read("app/tools/roofing/jobCard/JobCardTabs.tsx");
    assert.match(tabs, /scrollJobCardTabIntoRailView/);
    assert.match(tabs, /useLayoutEffect/);
    assert.match(tabs, /onFocus=\{onTabFocus\}/);
    assert.match(tabs, /overflow-x-auto/);
    assert.match(tabs, /shrink-0/);
    assert.doesNotMatch(tabs, /text-\[9px\]|text-\[10px\]/);
  });
});
