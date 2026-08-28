/**
 * Stage 2E — Payments tab financial history presenter.
 *
 * Run: npx tsx --test app/lib/jobPaymentHistory.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildJobPaymentWorkspace,
  buildJobPaymentWorkspaceTimeline,
  groupJobPaymentHistory,
  jobPaymentCollectibleRemainingCents,
  type JobPaymentWorkspaceRequest,
  type JobPaymentWorkspaceTransaction,
} from "./jobPaymentWorkspace";
import type { JobPaymentRefundRow } from "./jobPaymentReadModel";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "./proposalPaymentTerms";
import {
  JOB_CARD_PAYMENTS_PAID_IN_FULL,
  JOB_CARD_PAYMENTS_PAYMENTS_COMPLETE,
  PUBLIC_PAYMENT_PAID_IN_FULL_TITLE,
  PUBLIC_PAYMENT_PAYMENTS_COMPLETE_TITLE,
} from "./jobPaymentTypes";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

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
    provider_payment_intent_id: "pi_shared",
    ...overrides,
  };
}

function canonicalRefund(
  overrides: Partial<JobPaymentRefundRow> = {}
): JobPaymentRefundRow {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    job_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    payment_request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    canonical_capture_transaction_id: "11111111-1111-4111-8111-111111111111",
    amount_cents: 50000,
    status: "succeeded",
    initiated_at: "2026-08-30T15:18:00.000Z",
    pending_at: null,
    requires_action_at: null,
    succeeded_at: "2026-08-30T15:20:00.000Z",
    failed_at: null,
    canceled_at: null,
    created_at: "2026-08-30T15:18:00.000Z",
    updated_at: "2026-08-30T15:20:00.000Z",
    ...overrides,
  };
}

describe("Stage 2E — summary remains canonical", () => {
  test("contract / collected / remaining still 053/054", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "production",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 1850000,
      requests: [request({ status: "paid", paid_at: "2026-08-24T14:20:00.000Z" })],
      transactions: [txn()],
    });
    assert.equal(workspace.contractTotalCents, 1850000);
    assert.equal(workspace.receivedGrossCents, 200000);
    assert.equal(workspace.collectibleRemainingCents, 1650000);
    assert.equal(
      jobPaymentCollectibleRemainingCents({
        contractTotalCents: 1850000,
        receivedGrossCents: 200000,
      }),
      1650000
    );
  });
});

describe("Stage 2E — requested rows", () => {
  test("deposit / progress / balance requested titles and amounts", () => {
    const timeline = buildJobPaymentWorkspaceTimeline({
      requests: [
        request(),
        request({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          kind: "progress",
          amount_cents: 462500,
          requested_at: "2026-08-27T18:52:00.000Z",
        }),
        request({
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          kind: "balance",
          amount_cents: 1187500,
          requested_at: "2026-08-28T16:00:00.000Z",
        }),
      ],
      transactions: [],
    });
    assert.deepEqual(
      timeline.filter((row) => row.type === "requested").map((row) => row.title),
      [
        "Remaining balance requested",
        "Progress payment requested",
        "Deposit requested",
      ]
    );
    assert.equal(timeline[0]?.amountCents, 1187500);
    assert.equal(timeline[1]?.amountCents, 462500);
    assert.equal(timeline[2]?.amountCents, 200000);
  });

  test("auto-created deposit still appears in Payments history", () => {
    const timeline = buildJobPaymentWorkspaceTimeline({
      requests: [request()],
      transactions: [],
    });
    assert.equal(timeline.some((row) => row.title === "Deposit requested"), true);
  });
});

describe("Stage 2E — received rows", () => {
  test("kind-specific received titles; dual PI/Checkout collapse", () => {
    const timeline = buildJobPaymentWorkspaceTimeline({
      requests: [
        request({
          status: "paid",
          paid_at: "2026-08-24T14:20:00.000Z",
          settled_payment_method_label: "Cards",
        }),
      ],
      transactions: [
        txn(),
        txn({
          id: "22222222-2222-4222-8222-222222222222",
          provider_event_id: "evt_cs",
          occurred_at: "2026-08-24T14:20:01.000Z",
        }),
      ],
    });
    const received = timeline.filter((row) => row.type === "received");
    assert.equal(received.length, 1);
    assert.equal(received[0]?.title, "Deposit received");
    assert.equal(received[0]?.amountCents, 200000);
    assert.equal(received[0]?.id.startsWith("received:pi:"), true);
  });
});

describe("Stage 2E — processing", () => {
  test("current processing is not a permanent history row", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "production",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 1850000,
      requests: [
        request({
          kind: "progress",
          status: "processing",
          amount_cents: 462500,
        }),
      ],
      transactions: [],
    });
    assert.equal(workspace.currentRequest?.status, "processing");
    assert.equal(
      (workspace.timeline as Array<{ type: string }>).some(
        (row) => row.type === "processing"
      ),
      false
    );
    assert.equal(
      workspace.timeline.some((row) => row.title === "Progress payment requested"),
      true
    );
  });
});

describe("Stage 2E — failed / cancelled / refund", () => {
  test("failed row has no processor details; retry keeps old failure", () => {
    const first = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const retry = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const timeline = buildJobPaymentWorkspaceTimeline({
      requests: [
        request({ id: first, status: "failed" }),
        request({
          id: retry,
          status: "open",
          requested_at: "2026-08-24T15:00:00.000Z",
        }),
      ],
      transactions: [
        txn({
          kind: "failure",
          status: "failed",
          payment_request_id: first,
          occurred_at: "2026-08-24T14:18:00.000Z",
          provider_event_id: "evt_fail",
          provider_payment_intent_id: "pi_fail",
        }),
      ],
    });
    const failed = timeline.filter((row) => row.type === "failed");
    assert.equal(failed.length, 1);
    assert.equal(failed[0]?.title, "Payment failed");
    assert.equal(failed[0]?.subtitle, "Deposit");
    assert.doesNotMatch(failed[0]?.title ?? "", /card_declined|insufficient|pi_/i);
    assert.doesNotMatch(JSON.stringify(failed[0]?.disclosure), /card_declined/);
    assert.equal(
      timeline.filter((row) => row.type === "requested").length,
      2
    );
  });

  test("cancelled request appears; open Checkout-cancel does not", () => {
    const cancelled = buildJobPaymentWorkspaceTimeline({
      requests: [
        request({
          kind: "progress",
          status: "cancelled",
          cancelled_at: "2026-08-28T20:00:00.000Z",
          amount_cents: 462500,
        }),
      ],
      transactions: [],
    });
    assert.equal(
      cancelled.some((row) => row.type === "cancelled"),
      true
    );
    assert.equal(
      cancelled.find((row) => row.type === "cancelled")?.title,
      "Payment request cancelled"
    );

    const checkoutLeftOpen = buildJobPaymentWorkspaceTimeline({
      requests: [request({ kind: "progress", status: "open" })],
      transactions: [],
    });
    assert.equal(
      checkoutLeftOpen.some((row) => row.type === "cancelled"),
      false
    );
    assert.equal(checkoutLeftOpen.some((row) => row.type === "requested"), true);
  });

  test("historical failure does not keep Paid in full in a failed status", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 1850000,
      requests: [
        request({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          kind: "progress",
          status: "failed",
          amount_cents: 462500,
          requested_at: "2026-08-22T17:00:00.000Z",
        }),
        request({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          kind: "progress",
          status: "paid",
          amount_cents: 1850000,
          requested_at: "2026-08-22T18:00:00.000Z",
          paid_at: "2026-08-22T18:10:00.000Z",
        }),
      ],
      transactions: [
        txn({
          kind: "failure",
          status: "failed",
          amount_cents: 462500,
          occurred_at: "2026-08-22T17:05:00.000Z",
          provider_event_id: "evt_fail",
          provider_payment_intent_id: "pi_fail",
        }),
        txn({
          id: "22222222-2222-4222-8222-222222222222",
          payment_request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          amount_cents: 1850000,
          occurred_at: "2026-08-22T18:10:00.000Z",
          provider_event_id: "evt_paid",
          provider_payment_intent_id: "pi_paid",
        }),
      ],
    });
    assert.equal(workspace.state, "paid_in_full");
    assert.equal(workspace.timeline.some((row) => row.type === "failed"), true);
  });

  test("refund recorded does not reopen collectible", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 1850000,
      requests: [
        request({
          status: "paid",
          amount_cents: 1850000,
          paid_at: "2026-08-28T18:00:00.000Z",
        }),
      ],
      transactions: [
        txn({ amount_cents: 1850000, occurred_at: "2026-08-28T18:00:00.000Z" }),
      ],
      refunds: [canonicalRefund()],
    });
    assert.equal(workspace.collectibleRemainingCents, 0);
    assert.equal(workspace.refundedCents, 50000);
    assert.equal(workspace.state, "payments_complete");
    assert.equal(workspace.statusLabel, "Payments complete");
    const refund = workspace.timeline.find((row) => row.type === "refund");
    assert.equal(refund?.title, "Refund sent");
    assert.equal(refund?.amountCents, 50000);
  });
});

describe("Stage 2F — contractor zero-collectible wording", () => {
  test("contractor labels stay aligned with customer Paid in full / Payments complete", () => {
    assert.equal(JOB_CARD_PAYMENTS_PAID_IN_FULL, PUBLIC_PAYMENT_PAID_IN_FULL_TITLE);
    assert.equal(
      JOB_CARD_PAYMENTS_PAYMENTS_COMPLETE,
      PUBLIC_PAYMENT_PAYMENTS_COMPLETE_TITLE
    );
  });

  test("collectible 0 / refunded 0 is Paid in full", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 1850000,
      requests: [
        request({
          status: "paid",
          amount_cents: 1850000,
          paid_at: "2026-08-28T18:00:00.000Z",
        }),
      ],
      transactions: [txn({ amount_cents: 1850000 })],
    });
    assert.equal(workspace.collectibleRemainingCents, 0);
    assert.equal(workspace.refundedCents, 0);
    assert.equal(workspace.state, "paid_in_full");
    assert.equal(workspace.statusLabel, "Paid in full");
    assert.equal(workspace.overviewStatusLabel, "Paid in full");
  });

  test("collectible 0 / refunded >0 is Payments complete, not Paid in full", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 1850000,
      requests: [
        request({
          status: "paid",
          amount_cents: 1850000,
          paid_at: "2026-08-28T18:00:00.000Z",
        }),
      ],
      transactions: [
        txn({ amount_cents: 1850000 }),
      ],
      refunds: [canonicalRefund()],
    });
    assert.equal(workspace.collectibleRemainingCents, 0);
    assert.equal(workspace.refundedCents, 50000);
    assert.equal(workspace.state, "payments_complete");
    assert.equal(workspace.statusLabel, "Payments complete");
    assert.equal(workspace.overviewStatusLabel, "Payments complete");
    assert.notEqual(workspace.statusLabel, "Paid in full");
    assert.equal(
      workspace.summaryRows.find((row) => row.label === "Remaining")?.cents,
      0
    );
  });

  test("collectible >0 is never Paid in full or Payments complete", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "production",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 1850000,
      requests: [request({ status: "paid", paid_at: "2026-08-24T14:20:00.000Z" })],
      transactions: [txn()],
    });
    assert.ok(workspace.collectibleRemainingCents > 0);
    assert.notEqual(workspace.state, "paid_in_full");
    assert.notEqual(workspace.state, "payments_complete");
    assert.notEqual(workspace.statusLabel, "Paid in full");
    assert.notEqual(workspace.statusLabel, "Payments complete");
  });

  test("refund does not reopen Remaining", () => {
    const workspace = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: ACCOUNT,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      customerChosenTotalCents: 1850000,
      requests: [
        request({
          status: "paid",
          amount_cents: 1850000,
          paid_at: "2026-08-28T18:00:00.000Z",
        }),
      ],
      transactions: [
        txn({ amount_cents: 1850000 }),
      ],
      refunds: [canonicalRefund()],
    });
    assert.equal(workspace.receivedGrossCents, 1850000);
    assert.equal(workspace.refundedCents, 50000);
    assert.equal(workspace.collectibleRemainingCents, 0);
    assert.equal(workspace.canCollectPayment, false);
    assert.equal(
      jobPaymentCollectibleRemainingCents({
        contractTotalCents: 1850000,
        receivedGrossCents: 1850000,
      }),
      0
    );
  });
});

describe("Stage 2E — sequential order and grouping", () => {
  test("newest-first chronology for request / fail / new request / received", () => {
    const timeline = buildJobPaymentWorkspaceTimeline({
      requests: [
        request({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          kind: "progress",
          status: "failed",
          amount_cents: 462500,
          requested_at: "2026-08-27T17:00:00.000Z",
        }),
        request({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          kind: "progress",
          status: "paid",
          amount_cents: 462500,
          requested_at: "2026-08-27T18:00:00.000Z",
          paid_at: "2026-08-27T18:10:00.000Z",
        }),
      ],
      transactions: [
        txn({
          kind: "failure",
          status: "failed",
          occurred_at: "2026-08-27T17:05:00.000Z",
          provider_event_id: "evt_fail",
          provider_payment_intent_id: "pi_fail",
        }),
        txn({
          id: "22222222-2222-4222-8222-222222222222",
          payment_request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          occurred_at: "2026-08-27T18:10:00.000Z",
          provider_event_id: "evt_paid",
          provider_payment_intent_id: "pi_paid",
        }),
      ],
    });
    assert.deepEqual(
      timeline.map((row) => row.type),
      ["received", "requested", "failed", "requested"]
    );
  });

  test("date grouping buckets newest days first", () => {
    const timeline = buildJobPaymentWorkspaceTimeline({
      requests: [
        request({ requested_at: "2026-08-24T14:10:00.000Z" }),
        request({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          kind: "progress",
          requested_at: "2026-08-28T18:14:00.000Z",
          amount_cents: 462500,
        }),
      ],
      transactions: [],
    });
    const groups = groupJobPaymentHistory(
      timeline,
      new Date(timeline[0]?.occurredAt ?? "2026-08-28T18:14:00.000Z")
    );
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.heading, "Today");
    assert.equal(groups[0]?.events[0]?.title, "Progress payment requested");
  });
});

describe("Stage 2E — Activity stays payment-free", () => {
  test("live Job Card skips payment enrichment and does not compose payment Activity", () => {
    const jobCard = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    const activity = read(
      "app/tools/roofing/jobCard/JobCardActivityPanelWithCustomerRequests.tsx"
    );
    assert.match(jobCard, /skipPaymentEnrichment/);
    assert.match(roofing, /skipPaymentEnrichment/);
    assert.doesNotMatch(jobCard, /composeJobPaymentActivityItems/);
    assert.doesNotMatch(roofing, /composeJobPaymentActivityItems/);
    assert.doesNotMatch(jobCard, /paymentItems=/);
    assert.doesNotMatch(roofing, /paymentItems=/);
    assert.match(activity, /skipPaymentEnrichment \? \[\] : paymentItems/);
  });

  test("Payments workspace is the history owner", () => {
    const ui = read("app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx");
    assert.match(ui, /Current payment/);
    assert.match(ui, /Payment history/);
    assert.doesNotMatch(ui, /Current request/);
    assert.match(ui, /groupJobPaymentHistory/);
    assert.match(ui, /data-jobcard-payments-history-measure/);
    assert.match(ui, /max-w-xl/);
    assert.match(ui, /sm:grid-cols-\[minmax\(0,1fr\)_auto\]/);
    assert.doesNotMatch(ui, /sm:justify-between/);
    assert.doesNotMatch(ui, /overflow-x-auto/);
    assert.doesNotMatch(ui, /<table/);
    assert.match(ui, /min-h-11/);
    assert.doesNotMatch(ui, /card_declined|stripe_error|payment_intent/i);
  });

  test("no migration 057", () => {
    assert.equal(
      existsSync(
        join(ROOT, "supabase/migrations/20260827_057_payment_history.sql")
      ),
      false
    );
    assert.equal(
      existsSync(
        join(ROOT, "supabase/migrations/20260828_057_payment_activity.sql")
      ),
      false
    );
  });
});
