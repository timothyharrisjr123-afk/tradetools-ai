import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { parseRefundDollarText } from "@/app/tools/roofing/jobCard/JobCardRefundPaymentSheet";
import type {
  JobPaymentRefundRow,
  JobPaymentRequestRow,
} from "./jobPaymentReadModel";
import {
  buildJobPaymentWorkspace,
  type JobPaymentWorkspaceTransaction,
} from "./jobPaymentWorkspace";
import { buildPublicPaymentViewModel } from "./jobPaymentCustomerPresenter";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "./proposalPaymentTerms";

const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAPTURE_ID = "11111111-1111-4111-8111-111111111111";
const ROOT = process.cwd();

const request: JobPaymentRequestRow = {
  id: REQUEST_ID,
  company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  job_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  proposal_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  proposal_version_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  proposal_option_id: "22222222-2222-4222-8222-222222222222",
  proposal_acceptance_id: "33333333-3333-4333-8333-333333333333",
  proposal_signature_id: null,
  amount_cents: 10000,
  currency: "usd",
  kind: "balance",
  accepted_total_cents_snapshot: 10000,
  option_label_snapshot: "Premium",
  provider_account_id: "acct_test",
  provider_checkout_session_id: null,
  status: "paid",
  requested_at: "2026-08-28T12:00:00.000Z",
  paid_at: "2026-08-28T12:05:00.000Z",
  cancelled_at: null,
};

const capture: JobPaymentWorkspaceTransaction = {
  id: CAPTURE_ID,
  payment_request_id: REQUEST_ID,
  kind: "capture",
  status: "succeeded",
  amount_cents: 10000,
  occurred_at: "2026-08-28T12:05:00.000Z",
  provider_event_id: "evt_capture",
  provider_payment_intent_id: "pi_capture",
};

function refund(
  id: string,
  amount_cents: number,
  status: JobPaymentRefundRow["status"]
): JobPaymentRefundRow {
  const finalAt = "2026-08-28T13:00:00.000Z";
  return {
    id,
    company_id: request.company_id,
    job_id: request.job_id,
    payment_request_id: REQUEST_ID,
    canonical_capture_transaction_id: CAPTURE_ID,
    amount_cents,
    status,
    initiated_at: "2026-08-28T12:30:00.000Z",
    pending_at: status === "pending" ? finalAt : null,
    requires_action_at: status === "requires_action" ? finalAt : null,
    succeeded_at: status === "succeeded" ? finalAt : null,
    failed_at: status === "failed" ? finalAt : null,
    canceled_at: status === "canceled" ? finalAt : null,
    created_at: "2026-08-28T12:30:00.000Z",
    updated_at: finalAt,
  };
}

function workspace(refunds: JobPaymentRefundRow[]) {
  return buildJobPaymentWorkspace({
    jobStage: "complete",
    accepted: true,
    account: {
      charges_enabled: true,
      onboarding_status: "complete",
      details_submitted: true,
      payouts_enabled: true,
    },
    requests: [request],
    transactions: [capture],
    refunds,
    acceptedTotalCents: 10000,
    terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
  });
}

describe("Refunds V1 canonical contractor model", () => {
  test("supports one cent, partial, full, multiple, and equal-amount UUID rows", () => {
    const rows = [
      refund("44444444-4444-4444-8444-444444444441", 1, "succeeded"),
      refund("44444444-4444-4444-8444-444444444442", 2499, "succeeded"),
      refund("44444444-4444-4444-8444-444444444443", 2500, "succeeded"),
      refund("44444444-4444-4444-8444-444444444444", 2500, "succeeded"),
      refund("44444444-4444-4444-8444-444444444445", 2500, "succeeded"),
    ];
    const view = workspace(rows);
    assert.equal(view.refundedCents, 10000);
    assert.equal(view.receivedGrossCents, 10000);
    assert.equal(view.collectibleRemainingCents, 0);
    assert.equal(view.timeline.filter((event) => event.type === "refund").length, 5);
    assert.equal(
      view.timeline.find((event) => event.type === "received")?.refundAction,
      null
    );
  });

  test("succeeded settles; in-flight reserves; failed and canceled release", () => {
    const view = workspace([
      refund("55555555-5555-4555-8555-555555555551", 2000, "succeeded"),
      refund("55555555-5555-4555-8555-555555555552", 3000, "pending"),
      refund("55555555-5555-4555-8555-555555555553", 1000, "requires_action"),
      refund("55555555-5555-4555-8555-555555555554", 9000, "failed"),
      refund("55555555-5555-4555-8555-555555555555", 9000, "canceled"),
    ]);
    assert.equal(view.refundedCents, 2000);
    assert.equal(view.cashNetCents, 8000);
    assert.equal(view.collectibleRemainingCents, 0);
    assert.deepEqual(
      view.timeline.find((event) => event.type === "received")?.refundAction,
      {
        captureId: CAPTURE_ID,
        originalPaymentCents: 10000,
        alreadyRefundedCents: 2000,
        inFlightCents: 4000,
        refundableCents: 4000,
      }
    );
  });

  test("binds refunds only by canonical capture id, never PI plus amount heuristics", () => {
    const otherCapture: JobPaymentWorkspaceTransaction = {
      ...capture,
      id: "99999999-9999-4999-8999-999999999999",
      provider_event_id: "evt_other_capture",
      provider_payment_intent_id: "pi_other_capture",
    };
    const explicitlyOtherRefund = {
      ...refund("55555555-5555-4555-8555-555555555556", 2500, "succeeded"),
      canonical_capture_transaction_id: otherCapture.id,
    };
    const view = buildJobPaymentWorkspace({
      jobStage: "complete",
      accepted: true,
      account: {
        charges_enabled: true,
        onboarding_status: "complete",
        details_submitted: true,
        payouts_enabled: true,
      },
      requests: [request],
      transactions: [capture, otherCapture],
      refunds: [explicitlyOtherRefund],
      acceptedTotalCents: 20000,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
    });
    const received = view.timeline.filter((event) => event.type === "received");
    assert.equal(received.length, 2);
    assert.equal(
      received.find((event) => event.capture?.canonicalTransactionId === CAPTURE_ID)
        ?.capture?.succeededRefundedCents,
      0
    );
    assert.equal(
      received.find(
        (event) => event.capture?.canonicalTransactionId === otherCapture.id
      )?.capture?.succeededRefundedCents,
      2500
    );
  });

  test("captures with missing or non-PI PaymentIntent never expose Refund", () => {
    for (const provider_payment_intent_id of [null, "", "ch_not_a_pi", "cs_checkout"]) {
      const rows = [
        refund("55555555-5555-4555-8555-555555555557", 1000, "succeeded"),
      ];
      const rebuilt = buildJobPaymentWorkspace({
        jobStage: "complete",
        accepted: true,
        account: {
          charges_enabled: true,
          onboarding_status: "complete",
          details_submitted: true,
          payouts_enabled: true,
        },
        requests: [request],
        transactions: [{ ...capture, provider_payment_intent_id }],
        refunds: rows,
        acceptedTotalCents: 10000,
        terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
      });
      assert.equal(
        rebuilt.timeline.find((event) => event.type === "received")?.refundAction,
        null,
        String(provider_payment_intent_id)
      );
    }
  });

  test("uses exact status titles, support, and one row per refund UUID", () => {
    const view = workspace([
      refund("66666666-6666-4666-8666-666666666661", 100, "pending"),
      refund("66666666-6666-4666-8666-666666666662", 100, "succeeded"),
      refund("66666666-6666-4666-8666-666666666663", 100, "failed"),
      refund("66666666-6666-4666-8666-666666666664", 100, "canceled"),
    ]);
    const events = view.timeline.filter((event) => event.type === "refund");
    assert.deepEqual(events.map((event) => event.title).sort(), [
      "Refund canceled",
      "Refund failed",
      "Refund processing",
      "Refund sent",
    ]);
    assert.ok(events.every((event) => event.id.startsWith("refund:66666666")));
    assert.equal(
      events.find((event) => event.title === "Refund processing")?.support,
      "Stripe is processing this refund."
    );
    assert.equal(
      events.find((event) => event.title === "Refund sent")?.support,
      "Stripe accepted this refund. Banks typically post it within 5–10 business days."
    );
    assert.equal(
      events.find((event) => event.title === "Refund failed")?.support,
      "The refund wasn’t completed. No money was deducted from collected totals."
    );
  });
});

describe("Refunds V1 customer and form contracts", () => {
  test("customer shows pending and succeeded exact copy and omits failures", () => {
    const view = buildPublicPaymentViewModel({
      requests: [request],
      transactions: [capture],
      refunds: [
        refund("77777777-7777-4777-8777-777777777771", 1250, "pending"),
        refund("77777777-7777-4777-8777-777777777772", 2500, "succeeded"),
        refund("77777777-7777-4777-8777-777777777773", 500, "failed"),
        refund("77777777-7777-4777-8777-777777777774", 500, "canceled"),
      ],
      accepted: true,
      contractTotalCents: 10000,
      proposalVersionId: request.proposal_version_id,
      acceptanceId: request.proposal_acceptance_id,
      terms: DEFAULT_PROPOSAL_PAYMENT_TERMS,
    });
    assert.equal(view?.state, "payments_complete_with_refund");
    assert.equal(view?.history.length, 3);
    assert.equal(
      view?.history.find((item) => item.type === "payment")?.kindLabel,
      "Balance payment received"
    );
    assert.ok(
      !view?.history.some((item) => /Remaining balance/i.test(item.kindLabel)),
      "historical balance capture must not read as current Remaining"
    );
    assert.equal(
      view?.history.find((item) => item.kindLabel === "Refund processing")?.detail,
      "A refund of $12.50 is being processed."
    );
    assert.equal(
      view?.history.find((item) => item.kindLabel === "Refund sent")?.detail,
      "A refund of $25.00 was sent to your original payment method. Your bank may take 5–10 business days to post it."
    );
    assert.ok(!view?.history.some((item) => /failed|canceled/i.test(item.kindLabel)));
  });

  test("strict parser rejects malformed values without clamping", () => {
    assert.equal(parseRefundDollarText("0.01"), 1);
    assert.equal(parseRefundDollarText("100.00"), 10000);
    for (const value of [
      "",
      " ",
      "abc",
      "1e2",
      "-1",
      "+1",
      "$1.00",
      "1,000.00",
      "0",
      "0.00",
      "1.",
      "1.234",
      ".50",
      "90071992547409.92",
    ]) {
      assert.equal(parseRefundDollarText(value), null, value);
    }
    assert.equal(parseRefundDollarText(" 12.3 "), 1230);
    assert.equal(parseRefundDollarText("0001.01"), 101);
    assert.equal(parseRefundDollarText("100.01"), 10001);
  });

  test("source wiring posts canonical endpoint and does not add refunds to Activity", () => {
    const hook = readFileSync(join(ROOT, "app/lib/useJobPayments.ts"), "utf8");
    const workspaceUi = readFileSync(
      join(ROOT, "app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx"),
      "utf8"
    );
    const activity = readFileSync(
      join(ROOT, "app/tools/roofing/jobCard/JobCardActivityPanel.tsx"),
      "utf8"
    );
    assert.match(hook, /\/api\/jobs\/\$\{id\}\/payments\/\$\{captureId\}\/refunds/);
    assert.match(hook, /JSON\.stringify\(\{ amountCents, reason, commandId \}\)/);
    assert.match(workspaceUi, /data-jobcard-payment-refund/);
    assert.doesNotMatch(activity, /Refund processing|Refund sent|job_payment_refunds/);
  });
});
