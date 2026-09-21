/**
 * Phase 2B1 — Checkout session recovery / duplicate-charge hardening tests.
 *
 * Run: npx tsx --test app/lib/jobPaymentCheckoutRecovery.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  checkoutSessionBelongsToRequest,
  checkoutSessionLooksPaid,
  checkoutSessionMatchesPayableAmount,
  planCheckoutSessionRecovery,
  type CheckoutSessionSnapshot,
  type PayableRequestIdentity,
} from "@/app/lib/jobPaymentCheckoutRecovery";

const REQUEST: PayableRequestIdentity = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  job_id: "jjjjjjjj-jjjj-4jjj-8jjj-jjjjjjjjjjjj",
  amount_cents: 100_000,
  currency: "usd",
  provider_account_id: "acct_test",
};

function session(
  partial: Partial<CheckoutSessionSnapshot> & Pick<CheckoutSessionSnapshot, "id">
): CheckoutSessionSnapshot {
  return {
    url: `https://checkout.test/${partial.id}`,
    status: "open",
    payment_status: "unpaid",
    amount_total: REQUEST.amount_cents,
    currency: "usd",
    client_reference_id: REQUEST.id,
    metadata: {
      payment_request_id: REQUEST.id,
      company_id: REQUEST.company_id,
      job_id: REQUEST.job_id,
      checkout_generation: "1",
    },
    expires_at: 1_900_000_000,
    ...partial,
    metadata: {
      payment_request_id: REQUEST.id,
      company_id: REQUEST.company_id,
      job_id: REQUEST.job_id,
      checkout_generation: "1",
      ...(partial.metadata ?? {}),
    },
  };
}

describe("Phase 2B1 — session ownership / amount gates", () => {
  test("10 wrong company → deny belong", () => {
    const foreign = session({
      id: "cs_foreign",
      metadata: { company_id: "other-company" },
    });
    assert.equal(checkoutSessionBelongsToRequest(foreign, REQUEST), false);
  });

  test("11 wrong job metadata → deny belong", () => {
    const foreign = session({
      id: "cs_job",
      metadata: { job_id: "other-job" },
    });
    assert.equal(checkoutSessionBelongsToRequest(foreign, REQUEST), false);
  });

  test("13 amount mismatch → not reusable match", () => {
    const wrong = session({ id: "cs_amt", amount_total: 99_000 });
    assert.equal(checkoutSessionMatchesPayableAmount(wrong, REQUEST), false);
    assert.equal(
      checkoutSessionBelongsToRequest(wrong, REQUEST),
      true
    );
  });

  test("belongs when metadata company/job absent but client_reference matches", () => {
    const legacy = session({
      id: "cs_legacy",
      metadata: { payment_request_id: REQUEST.id },
    });
    assert.equal(checkoutSessionBelongsToRequest(legacy, REQUEST), true);
  });
});

describe("Phase 2B1 — recovery plan (generation bump / dual session)", () => {
  test("4 open prior session + generation bump intent → reuse A, retire none extra", () => {
    const a = session({
      id: "cs_a",
      metadata: { checkout_generation: "1" },
    });
    const plan = planCheckoutSessionRecovery({
      request: REQUEST,
      sessions: [a],
      preferredSessionId: "cs_a",
    });
    assert.equal(plan.action, "reuse");
    if (plan.action === "reuse") {
      assert.equal(plan.session.id, "cs_a");
      assert.equal(plan.retire.length, 0);
    }
  });

  test("4b two open payable sessions for one request → keep one, retire sibling", () => {
    const a = session({
      id: "cs_a",
      metadata: { checkout_generation: "1" },
    });
    const b = session({
      id: "cs_b",
      metadata: { checkout_generation: "2" },
    });
    const plan = planCheckoutSessionRecovery({
      request: REQUEST,
      sessions: [a, b],
      preferredSessionId: "cs_a",
    });
    assert.equal(plan.action, "reuse");
    if (plan.action === "reuse") {
      assert.equal(plan.session.id, "cs_a");
      assert.deepEqual(
        plan.retire.map((row) => row.id),
        ["cs_b"]
      );
    }
  });

  test("5 expired prior only → none (replacement allowed by orchestrator)", () => {
    const expired = session({ id: "cs_expired", status: "expired", url: null });
    const plan = planCheckoutSessionRecovery({
      request: REQUEST,
      sessions: [expired],
      preferredSessionId: null,
    });
    assert.equal(plan.action, "none");
  });

  test("6 completed prior session → already_paid", () => {
    const paid = session({
      id: "cs_paid",
      status: "complete",
      payment_status: "paid",
      url: null,
    });
    assert.equal(checkoutSessionLooksPaid(paid), true);
    const plan = planCheckoutSessionRecovery({
      request: REQUEST,
      sessions: [paid],
      preferredSessionId: null,
    });
    assert.equal(plan.action, "already_paid");
  });

  test("amount-mismatched open session → retire then replace", () => {
    const stale = session({ id: "cs_stale", amount_total: 50_000 });
    const plan = planCheckoutSessionRecovery({
      request: REQUEST,
      sessions: [stale],
      preferredSessionId: null,
    });
    assert.equal(plan.action, "retire_all_then_replace");
    if (plan.action === "retire_all_then_replace") {
      assert.equal(plan.retire[0]?.id, "cs_stale");
    }
  });

  test("9 two-tab: preferred bound session wins over later generation open", () => {
    const bound = session({
      id: "cs_bound",
      metadata: { checkout_generation: "1" },
    });
    const later = session({
      id: "cs_later",
      metadata: { checkout_generation: "2" },
    });
    const plan = planCheckoutSessionRecovery({
      request: REQUEST,
      sessions: [later, bound],
      preferredSessionId: "cs_bound",
    });
    assert.equal(plan.action, "reuse");
    if (plan.action === "reuse") {
      assert.equal(plan.session.id, "cs_bound");
      assert.equal(plan.retire.some((row) => row.id === "cs_later"), true);
    }
  });
});

describe("Phase 2B1 — orchestrator source contracts", () => {
  test("checkout orchestrator blocks processing and retires siblings before mint", () => {
    const checkout = readFileSync(
      join(process.cwd(), "app/lib/jobPaymentCheckout.server.ts"),
      "utf8"
    );
    assert.match(checkout, /status === "processing"/);
    assert.match(checkout, /planCheckoutSessionRecovery/);
    assert.match(checkout, /expireDirectCheckoutSession|expireOwned/);
    assert.match(checkout, /listCheckoutSessionsForPaymentRequest/);
    assert.match(checkout, /checkout_reconciliation_unavailable/);
    assert.doesNotMatch(checkout, /limit:\s*20/);
  });

  test("Stripe helper pages request sessions, supports expire, and surfaces truncation", () => {
    const stripe = readFileSync(
      join(process.cwd(), "app/lib/jobPaymentStripe.server.ts"),
      "utf8"
    );
    assert.match(stripe, /listCheckoutSessionsForPaymentRequest/);
    assert.match(stripe, /autoPagingEach/);
    assert.match(stripe, /checkout\.sessions\.expire/);
    assert.match(stripe, /truncated:\s*boolean/);
    assert.match(stripe, /truncated = true/);
    assert.doesNotMatch(
      stripe,
      /checkout\.sessions\.list\(\s*\{\s*limit:\s*20\s*\}/
    );
  });

  test("orchestrator fails closed when Session inventory is truncated", () => {
    const checkout = readFileSync(
      join(process.cwd(), "app/lib/jobPaymentCheckout.server.ts"),
      "utf8"
    );
    assert.match(checkout, /inventory\.truncated/);
    assert.match(
      checkout,
      /truncated[\s\S]*checkout_reconciliation_unavailable/
    );
  });

  test("1 same-generation key + createOrRecover remain wired", () => {
    const creation = readFileSync(
      join(process.cwd(), "app/lib/stripeIdempotentCreation.ts"),
      "utf8"
    );
    const checkout = readFileSync(
      join(process.cwd(), "app/lib/jobPaymentCheckout.server.ts"),
      "utf8"
    );
    assert.match(creation, /fielddive_r3e_checkout_/);
    assert.match(checkout, /createOrRecoverCheckoutSession/);
  });
});
