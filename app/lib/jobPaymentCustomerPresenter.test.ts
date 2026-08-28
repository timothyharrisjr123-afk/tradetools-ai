/**
 * Stage 2D — canonical customer payment presenter + checkout routing.
 *
 * Run: npx tsx --test app/lib/jobPaymentCustomerPresenter.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  applyCustomerPaymentReturnHint,
  buildPublicPaymentViewModel,
  customerCurrentRequest,
  publicCheckoutShouldOpenCanonicalDeposit,
} from "./jobPaymentCustomerPresenter";
import type {
  JobPaymentRefundRow,
  JobPaymentRequestRow,
  JobPaymentTransactionRow,
} from "./jobPaymentReadModel";
import {
  PUBLIC_PAYMENT_PAY_DEPOSIT_CTA,
  PUBLIC_PAYMENT_PAY_NOW_CTA,
  PUBLIC_PAYMENT_TRY_AGAIN_CTA,
} from "./jobPaymentTypes";
import { PUBLIC_PAY_REMAINING_BALANCE_CTA } from "./proposalPaymentTerms";
import type { ProposalPaymentTerms } from "./proposalPaymentTerms";

const ROOT = process.cwd();
const VERSION = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const ACCEPTANCE = "22222222-2222-4222-8222-222222222222";
const OTHER_VERSION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

function request(
  overrides: Partial<JobPaymentRequestRow> = {}
): JobPaymentRequestRow {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    job_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    proposal_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    proposal_version_id: VERSION,
    proposal_option_id: "11111111-1111-4111-8111-111111111111",
    proposal_acceptance_id: ACCEPTANCE,
    proposal_signature_id: null,
    amount_cents: 462500,
    currency: "usd",
    kind: "progress",
    accepted_total_cents_snapshot: 1850000,
    option_label_snapshot: "Premium",
    provider_account_id: "acct_1",
    provider_checkout_session_id: null,
    status: "open",
    requested_at: "2026-08-27T18:00:00.000Z",
    paid_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function capture(
  requestId: string,
  amount: number,
  at = "2026-08-27T19:00:00.000Z",
  pi = "pi_1"
): JobPaymentTransactionRow {
  return {
    id: `txn-${requestId}-${amount}`,
    payment_request_id: requestId,
    kind: "capture",
    status: "succeeded",
    amount_cents: amount,
    occurred_at: at,
    provider_event_id: `evt-${pi}`,
    provider_payment_intent_id: pi,
  };
}

function refund(
  requestId: string,
  amount: number,
  status: JobPaymentRefundRow["status"] = "succeeded"
): JobPaymentRefundRow {
  return {
    id: `refund-${requestId}-${amount}`,
    company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    job_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    payment_request_id: requestId,
    canonical_capture_transaction_id: `txn-${requestId}-1850000`,
    amount_cents: amount,
    status,
    initiated_at: "2026-08-27T20:00:00.000Z",
    pending_at: status === "pending" ? "2026-08-27T20:01:00.000Z" : null,
    requires_action_at: null,
    succeeded_at: status === "succeeded" ? "2026-08-27T20:02:00.000Z" : null,
    failed_at: status === "failed" ? "2026-08-27T20:02:00.000Z" : null,
    canceled_at: status === "canceled" ? "2026-08-27T20:02:00.000Z" : null,
    created_at: "2026-08-27T20:00:00.000Z",
    updated_at: "2026-08-27T20:02:00.000Z",
  };
}

function vm(
  requests: JobPaymentRequestRow[],
  extra: Parameters<typeof buildPublicPaymentViewModel>[0] = { requests }
) {
  return buildPublicPaymentViewModel({
    accepted: true,
    terms: NONE_TERMS,
    contractTotalCents: 1850000,
    proposalVersionId: VERSION,
    acceptanceId: ACCEPTANCE,
    ...extra,
    requests,
  });
}

describe("Stage 2D — current request", () => {
  test("open is current; failed is never current", () => {
    const open = request({ status: "open", kind: "progress" });
    const failed = request({
      id: "failed-row",
      status: "failed",
      kind: "deposit",
      requested_at: "2026-08-27T17:00:00.000Z",
    });
    assert.equal(customerCurrentRequest([failed, open], VERSION)?.id, open.id);
    assert.equal(customerCurrentRequest([failed], VERSION), null);
  });

  test("newer open on this version wins over older failed deposit", () => {
    const view = vm([
      request({
        id: "old-failed",
        kind: "deposit",
        status: "failed",
        amount_cents: 462500,
        requested_at: "2026-08-27T10:00:00.000Z",
      }),
      request({ kind: "progress", status: "open", amount_cents: 500000 }),
    ]);
    assert.equal(view?.state, "progress_due");
    assert.equal(view?.ctaLabel, PUBLIC_PAYMENT_PAY_NOW_CTA);
  });
});

describe("Stage 2D — due states", () => {
  test("open deposit", () => {
    const view = vm([request({ kind: "deposit", amount_cents: 462500 })], {
      requests: [request({ kind: "deposit", amount_cents: 462500 })],
      terms: PERCENT_TERMS,
    });
    assert.equal(view?.state, "deposit_due");
    assert.equal(view?.heading, "Deposit due");
    assert.equal(view?.kindLabel, "Deposit");
    assert.equal(view?.amountLabel, "$4,625.00");
    assert.equal(view?.ctaLabel, PUBLIC_PAYMENT_PAY_DEPOSIT_CTA);
    assert.match(view?.originalTerms?.depositLine ?? "", /deposit due upon agreement/);
  });

  test("open progress", () => {
    const view = vm([request()]);
    assert.equal(view?.state, "progress_due");
    assert.equal(view?.heading, "Payment due");
    assert.equal(view?.kindLabel, "Progress payment");
    assert.equal(view?.ctaLabel, PUBLIC_PAYMENT_PAY_NOW_CTA);
    assert.equal(view?.contextNote, "Your contractor requested this payment.");
    assert.equal(view?.originalTerms?.depositLine, "No deposit was required.");
    assert.equal(view?.originalTerms?.balanceLine, null);
  });

  test("open balance", () => {
    const view = vm([request({ kind: "balance", amount_cents: 1000000 })]);
    assert.equal(view?.state, "balance_due");
    assert.equal(view?.kindLabel, "Remaining balance");
    assert.equal(view?.ctaLabel, PUBLIC_PAY_REMAINING_BALANCE_CTA);
  });
});

describe("Stage 2D — processing", () => {
  test("processing has amount/type and no Pay", () => {
    const view = vm([request({ status: "processing" })]);
    assert.equal(view?.state, "processing");
    assert.equal(view?.ctaLabel, null);
    assert.match(view?.explanation ?? "", /don't need to pay again/i);
    assert.doesNotMatch(view?.explanation ?? "", /requires_capture|processing/i);
  });
});

describe("Stage 2D — failed deposit vs progress/balance", () => {
  test("retryable failed deposit offers Try payment again", () => {
    const view = vm(
      [request({ kind: "deposit", status: "failed", amount_cents: 462500 })],
      {
        requests: [request({ kind: "deposit", status: "failed", amount_cents: 462500 })],
        terms: PERCENT_TERMS,
        transactions: [],
      }
    );
    assert.equal(view?.state, "failed_deposit_retryable");
    assert.equal(view?.ctaLabel, PUBLIC_PAYMENT_TRY_AGAIN_CTA);
    assert.match(view?.explanation ?? "", /try the deposit payment again/i);
  });

  test("satisfied deposit obligation is inactive", () => {
    const failed = request({ kind: "deposit", status: "failed", amount_cents: 462500 });
    const view = vm([failed], {
      requests: [failed],
      terms: PERCENT_TERMS,
      transactions: [capture(failed.id, 462500)],
      contractTotalCents: 1850000,
    });
    assert.equal(view?.state, "failed_inactive");
    assert.equal(view?.ctaLabel, null);
  });

  test("failed progress has no Pay and no retry", () => {
    const view = vm([request({ kind: "progress", status: "failed" })]);
    assert.equal(view?.state, "failed_inactive");
    assert.equal(view?.ctaLabel, null);
    assert.match(view?.explanation ?? "", /contractor can create a new payment request/i);
    assert.doesNotMatch(view?.explanation ?? "", /new payment link|expired/i);
  });

  test("failed balance has no Pay and no retry", () => {
    const view = vm([request({ kind: "balance", status: "failed" })]);
    assert.equal(view?.state, "failed_inactive");
    assert.equal(view?.ctaLabel, null);
  });
});

describe("Stage 2D — collected states", () => {
  test("paid progress with remaining is Payment received, not Paid in full", () => {
    const paid = request({
      kind: "progress",
      status: "paid",
      amount_cents: 462500,
      paid_at: "2026-08-27T19:00:00.000Z",
    });
    const view = vm([paid], {
      requests: [paid],
      transactions: [capture(paid.id, 462500)],
    });
    assert.equal(view?.state, "payment_received");
    assert.equal(view?.explanation, "No payment is due right now.");
    assert.notEqual(view?.heading, "Paid in full");
  });

  test("collectible 0 / refund 0 is Paid in full", () => {
    const paid = request({
      kind: "balance",
      status: "paid",
      amount_cents: 1850000,
      paid_at: "2026-08-27T19:00:00.000Z",
    });
    const view = vm([paid], {
      requests: [paid],
      transactions: [capture(paid.id, 1850000)],
    });
    assert.equal(view?.state, "paid_in_full");
    assert.equal(view?.ctaLabel, null);
    assert.match(view?.explanation ?? "", /No further payment is due/);
  });

  test("collectible 0 / refund >0 is Payments complete", () => {
    const paid = request({
      kind: "balance",
      status: "paid",
      amount_cents: 1850000,
      paid_at: "2026-08-27T19:00:00.000Z",
    });
    const view = vm([paid], {
      requests: [paid],
      transactions: [capture(paid.id, 1850000)],
      refunds: [refund(paid.id, 50000)],
    });
    assert.equal(view?.state, "payments_complete_with_refund");
    assert.equal(view?.heading, "Payments complete");
    assert.match(view?.explanation ?? "", /A refund was recorded/);
    assert.doesNotMatch(view?.explanation ?? "", /outstanding|Paid in full/);
    assert.equal(view?.ctaLabel, null);
    assert.equal(view?.history.length, 2);
    assert.equal(view?.history[0]?.kindLabel, "Balance payment received");
    assert.equal(view?.history[0]?.amountLabel, "$18,500.00");
    assert.ok(
      !view?.history.some((item) => /Remaining balance/i.test(item.kindLabel)),
      "zero collectible must not imply current money due via Remaining balance"
    );
    assert.equal(view?.history[1]?.kindLabel, "Refund sent");
  });

  test("no current request with remaining is idle", () => {
    const view = vm([], {
      requests: [],
      accepted: true,
      terms: NONE_TERMS,
      contractTotalCents: 1850000,
      transactions: [],
    });
    assert.equal(view?.state, "no_payment_due");
    assert.equal(view?.ctaLabel, null);
    assert.equal(view?.amountLabel, null);
  });
});

describe("Stage 2D — sequential history", () => {
  test("prior settled + new progress shows compact received history", () => {
    const deposit = request({
      id: "deposit-paid",
      kind: "deposit",
      status: "paid",
      amount_cents: 200000,
      paid_at: "2026-08-20T12:00:00.000Z",
      requested_at: "2026-08-20T11:00:00.000Z",
    });
    const progress = request({
      id: "progress-open",
      kind: "progress",
      status: "open",
      amount_cents: 500000,
    });
    const view = vm([deposit, progress], {
      requests: [deposit, progress],
      transactions: [capture(deposit.id, 200000, "2026-08-20T12:00:00.000Z", "pi_d")],
    });
    assert.equal(view?.state, "progress_due");
    assert.equal(view?.history.length, 1);
    assert.match(view?.history[0]?.kindLabel ?? "", /Deposit received/);
  });

  test("balance history uses event wording while open balance due keeps Remaining balance", () => {
    const balancePaid = request({
      id: "balance-paid",
      kind: "balance",
      status: "paid",
      amount_cents: 725000,
      paid_at: "2026-08-26T12:00:00.000Z",
      requested_at: "2026-08-26T11:00:00.000Z",
    });
    const balanceOpen = request({
      id: "balance-open",
      kind: "balance",
      status: "open",
      amount_cents: 100000,
      requested_at: "2026-08-27T11:00:00.000Z",
    });
    const view = vm([balancePaid, balanceOpen], {
      requests: [balancePaid, balanceOpen],
      transactions: [capture(balancePaid.id, 725000, "2026-08-26T12:00:00.000Z", "pi_b")],
      contractTotalCents: 1850000,
    });
    assert.equal(view?.state, "balance_due");
    assert.equal(view?.kindLabel, "Remaining balance");
    assert.equal(view?.amountLabel, "$1,000.00");
    assert.equal(view?.history.length, 1);
    assert.equal(view?.history[0]?.kindLabel, "Balance payment received");
    assert.equal(view?.history[0]?.amountLabel, "$7,250.00");
    assert.ok(!/Remaining balance/i.test(view?.history[0]?.kindLabel ?? ""));
  });
});

describe("Stage 2D — return hint", () => {
  test("pending overlays open due but never fakes paid or hides failed", () => {
    const due = vm([request()]);
    const overlay = applyCustomerPaymentReturnHint(due, "pending");
    assert.equal(overlay?.state, "processing");
    assert.equal(overlay?.ctaLabel, null);

    const paid = request({
      kind: "progress",
      status: "paid",
      paid_at: "2026-08-27T19:00:00.000Z",
      amount_cents: 462500,
    });
    const received = vm([paid], {
      requests: [paid],
      transactions: [capture(paid.id, 462500)],
    });
    assert.equal(applyCustomerPaymentReturnHint(received, "pending")?.state, "payment_received");

    const failed = vm([request({ status: "failed" })]);
    assert.equal(applyCustomerPaymentReturnHint(failed, "pending")?.state, "failed_inactive");
    assert.equal(applyCustomerPaymentReturnHint(due, "cancelled")?.state, "progress_due");
  });
});

describe("Stage 2D — checkout routing", () => {
  const snapshot = {
    kind: "deposit" as const,
    status: "failed",
    proposal_version_id: VERSION,
    proposal_acceptance_id: ACCEPTANCE,
    requested_at: "2026-08-27T18:00:00.000Z",
  };

  test("not_found may open canonical deposit", () => {
    assert.equal(
      publicCheckoutShouldOpenCanonicalDeposit({
        resolveCode: "not_found",
        requests: [],
        proposalVersionId: VERSION,
        acceptanceId: ACCEPTANCE,
      }),
      true
    );
  });

  test("not_payable opens helper only for failed deposit on this version", () => {
    assert.equal(
      publicCheckoutShouldOpenCanonicalDeposit({
        resolveCode: "not_payable",
        requests: [snapshot],
        proposalVersionId: VERSION,
        acceptanceId: ACCEPTANCE,
      }),
      true
    );
    assert.equal(
      publicCheckoutShouldOpenCanonicalDeposit({
        resolveCode: "not_payable",
        requests: [{ ...snapshot, kind: "progress" }],
        proposalVersionId: VERSION,
        acceptanceId: ACCEPTANCE,
      }),
      false
    );
    assert.equal(
      publicCheckoutShouldOpenCanonicalDeposit({
        resolveCode: "not_payable",
        requests: [{ ...snapshot, kind: "balance" }],
        proposalVersionId: VERSION,
        acceptanceId: ACCEPTANCE,
      }),
      false
    );
    assert.equal(
      publicCheckoutShouldOpenCanonicalDeposit({
        resolveCode: "already_paid",
        requests: [snapshot],
        proposalVersionId: VERSION,
        acceptanceId: ACCEPTANCE,
      }),
      false
    );
  });

  test("open request or other version suppresses deposit retry helper", () => {
    assert.equal(
      publicCheckoutShouldOpenCanonicalDeposit({
        resolveCode: "not_payable",
        requests: [
          snapshot,
          {
            ...snapshot,
            kind: "progress",
            status: "open",
            requested_at: "2026-08-27T19:00:00.000Z",
          },
        ],
        proposalVersionId: VERSION,
        acceptanceId: ACCEPTANCE,
      }),
      false
    );
    assert.equal(
      publicCheckoutShouldOpenCanonicalDeposit({
        resolveCode: "not_payable",
        requests: [{ ...snapshot, proposal_version_id: OTHER_VERSION }],
        proposalVersionId: VERSION,
        acceptanceId: ACCEPTANCE,
      }),
      false
    );
  });
});

describe("Stage 2D — source locks", () => {
  test("checkout is kind-aware and GET does not mint", () => {
    const checkout = readFileSync(
      join(ROOT, "app/api/public/payment-requests/checkout/route.ts"),
      "utf8"
    );
    assert.match(checkout, /publicCheckoutShouldOpenCanonicalDeposit/);
    assert.match(checkout, /not_payable/);
    assert.match(checkout, /already_paid/);
    const purchase = readFileSync(
      join(ROOT, "app/components/proposal-packet/ProposalPacketPurchase.tsx"),
      "utf8"
    );
    assert.doesNotMatch(purchase, /Due today/);
    assert.doesNotMatch(purchase, /DUE_TODAY/);
    const sticky = readFileSync(
      join(ROOT, "app/components/proposal-packet/ProposalPacketStickyPurchaseBar.tsx"),
      "utf8"
    );
    assert.doesNotMatch(sticky, /Due today/);
    assert.doesNotMatch(sticky, /DUE_TODAY/);
    const orchestrator = readFileSync(
      join(ROOT, "app/lib/proposalPublicAccessOrchestrator.server.ts"),
      "utf8"
    );
    assert.doesNotMatch(orchestrator, /openCanonicalDepositFromAcceptedProposal/);
  });

  test("no migration 057", () => {
    assert.equal(
      existsSync(
        join(ROOT, "supabase/migrations/20260827_057_customer_payment_experience.sql")
      ),
      false
    );
  });
});
