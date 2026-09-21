import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import Stripe from "stripe";
import {
  createOrRecoverCheckoutSession,
  createOrRecoverStripeAccount,
  stripeConnectAccountIdempotencyKey,
  stripeConnectOperationToken,
  stripeCheckoutIdempotencyKey,
} from "./stripeIdempotentCreation";
import { stripeMutationErrorIsAmbiguous } from "./stripeMutationSafety";

const ambiguous = Object.assign(new Error("connection_lost"), { ambiguous: true });
const isAmbiguous = (error: unknown) =>
  Boolean(error && typeof error === "object" && "ambiguous" in error);

describe("Stripe provider outcome classification", () => {
  test("connection and 5xx errors are ambiguous; 4xx and unknown errors are definitive", () => {
    assert.equal(
      stripeMutationErrorIsAmbiguous(
        new Stripe.errors.StripeConnectionError({ message: "connection lost" })
      ),
      true
    );
    assert.equal(
      stripeMutationErrorIsAmbiguous(
        new Stripe.errors.StripeAPIError({ message: "server error", statusCode: 500 })
      ),
      true
    );
    assert.equal(
      stripeMutationErrorIsAmbiguous(
        new Stripe.errors.StripeInvalidRequestError({
          message: "invalid request",
          statusCode: 400,
        })
      ),
      false
    );
    assert.equal(stripeMutationErrorIsAmbiguous(new Error("application error")), false);
  });
});

describe("Checkout creation idempotency", () => {
  const checkoutKeyInput = {
    connectedAccountId: "acct_a",
    paymentRequestId: "request-a",
    companyId: "company-a",
    jobId: "job-a",
    kind: "deposit",
    amountCents: 12_345,
    currency: "usd",
    successUrl: "https://fielddive.test/success",
    cancelUrl: "https://fielddive.test/cancel",
    checkoutGeneration: 4,
  };

  test("same parameters derive the same key and any changed parameter derives a new key", () => {
    const key = stripeCheckoutIdempotencyKey(checkoutKeyInput);
    assert.equal(key, stripeCheckoutIdempotencyKey({ ...checkoutKeyInput }));
    assert.notEqual(
      key,
      stripeCheckoutIdempotencyKey({ ...checkoutKeyInput, amountCents: 12_346 })
    );
    assert.notEqual(
      key,
      stripeCheckoutIdempotencyKey({ ...checkoutKeyInput, successUrl: "https://fielddive.test/other" })
    );
  });

  test("normal creation returns the authoritative provider Session", async () => {
    const result = await createOrRecoverCheckoutSession({
      create: async () => ({ id: "cs_normal", url: "https://checkout.test/normal" }),
      reconcile: async () => null,
      isAmbiguous,
    });
    assert.equal(result.session.id, "cs_normal");
    assert.equal(result.recovered, false);
  });

  test("ambiguous replay uses the exact same closure, key, and params", async () => {
    const params = Object.freeze({ amount: 12_345, currency: "usd" });
    const key = "fielddive_r3e_checkout_request_4";
    const calls: { params: typeof params; key: string }[] = [];
    let attempt = 0;
    const create = async () => {
      calls.push({ params, key });
      if (attempt++ === 0) throw ambiguous;
      return { id: "cs_replayed", url: "https://checkout.test/replayed" };
    };
    const result = await createOrRecoverCheckoutSession({
      create,
      reconcile: async () => null,
      isAmbiguous,
    });
    assert.equal(result.session.id, "cs_replayed");
    assert.equal(calls.length, 2);
    assert.strictEqual(calls[0]?.params, calls[1]?.params);
    assert.equal(calls[0]?.key, calls[1]?.key);
  });

  test("provider success followed by timeout reconciles without replay", async () => {
    const provider = { id: "cs_created", url: "https://checkout.test/created" };
    let createCount = 0;
    let listed: typeof provider | null = null;
    const result = await createOrRecoverCheckoutSession({
      create: async () => {
        createCount += 1;
        listed = provider;
        throw ambiguous;
      },
      reconcile: async () => listed,
      isAmbiguous,
    });
    assert.equal(result.session.id, "cs_created");
    assert.equal(createCount, 1);
  });

  test("definitive rejection is never retried or reconciled", async () => {
    let creates = 0;
    let reconciles = 0;
    await assert.rejects(
      createOrRecoverCheckoutSession({
        create: async () => {
          creates += 1;
          throw new Error("invalid_request");
        },
        reconcile: async () => {
          reconciles += 1;
          return null;
        },
        isAmbiguous,
      }),
      /invalid_request/
    );
    assert.equal(creates, 1);
    assert.equal(reconciles, 0);
  });

  test("concurrent same-generation calls converge through one provider key", async () => {
    const providerObjects = new Map<string, { id: string; url: string }>();
    const key = "fielddive_r3e_checkout_request_8";
    const create = async () => {
      await Promise.resolve();
      const existing = providerObjects.get(key);
      if (existing) return existing;
      const session = { id: "cs_single", url: "https://checkout.test/single" };
      providerObjects.set(key, session);
      return session;
    };
    const operation = () =>
      createOrRecoverCheckoutSession({ create, reconcile: async () => null, isAmbiguous });
    const [left, right] = await Promise.all([operation(), operation()]);
    assert.equal(left.session.id, right.session.id);
    assert.equal(providerObjects.size, 1);
  });

  test("public and authenticated routes share the canonical orchestrator", () => {
    for (const path of [
      "app/api/jobs/payment-requests/[id]/checkout/route.ts",
      "app/api/public/payment-requests/checkout/route.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      assert.match(source, /openHostedCheckoutForRequest/);
      assert.doesNotMatch(source, /checkout\.sessions\.create|idempotencyKey/);
    }
  });

  test("production source binds generation metadata and fails closed if reconciliation is unavailable", () => {
    const stripe = readFileSync(
      join(process.cwd(), "app/lib/jobPaymentStripe.server.ts"),
      "utf8"
    );
    const checkout = readFileSync(
      join(process.cwd(), "app/lib/jobPaymentCheckout.server.ts"),
      "utf8"
    );
    assert.match(stripe, /checkout_generation: String\(input\.checkoutGeneration\)/);
    assert.match(stripe, /stripeCheckoutIdempotencyKey\(input\)/);
    assert.match(stripe, /listCheckoutSessionsForPaymentRequest/);
    assert.match(stripe, /checkout\.sessions\.expire/);
    assert.doesNotMatch(stripe, /payment_method_types/);
    assert.match(checkout, /checkout_reconciliation_unavailable/);
    assert.match(checkout, /createOrRecoverCheckoutSession/);
    assert.match(checkout, /planCheckoutSessionRecovery/);
    assert.match(checkout, /status === "processing"/);
  });
});

describe("connected-account creation idempotency", () => {
  test("operation identity is tenant-scoped, retry-stable, and predecessor-scoped", () => {
    const initial = stripeConnectOperationToken({ companyId: "company-a", predecessorProviderAccountId: null });
    assert.equal(
      initial,
      stripeConnectOperationToken({ companyId: "company-a", predecessorProviderAccountId: null })
    );
    assert.notEqual(
      initial,
      stripeConnectOperationToken({ companyId: "company-b", predecessorProviderAccountId: null })
    );
    assert.notEqual(
      initial,
      stripeConnectOperationToken({ companyId: "company-a", predecessorProviderAccountId: "acct_old" })
    );
    assert.match(stripeConnectAccountIdempotencyKey(initial), /^fielddive_connect_account_[a-f0-9]{64}$/);
  });

  test("normal create and same logical retry recover one provider account", async () => {
    let stored: { id: string } | null = null;
    let creates = 0;
    const run = () =>
      createOrRecoverStripeAccount({
        operationToken: "op",
        findExisting: async () => stored,
        create: async () => {
          creates += 1;
          stored = { id: "acct_one" };
          return stored;
        },
        isAmbiguous,
      });
    assert.equal((await run()).account.id, "acct_one");
    assert.equal((await run()).account.id, "acct_one");
    assert.equal(creates, 1);
  });

  test("provider success plus client timeout recovers the created account", async () => {
    const provider = { id: "acct_timeout" };
    let listed: typeof provider | null = null;
    let creates = 0;
    const result = await createOrRecoverStripeAccount({
      operationToken: "op-timeout",
      findExisting: async () => listed,
      create: async () => {
        creates += 1;
        listed = provider;
        throw ambiguous;
      },
      isAmbiguous,
    });
    assert.equal(result.account.id, "acct_timeout");
    assert.equal(creates, 1);
  });

  test("parallel same-company attempts converge on one idempotent provider object", async () => {
    const providerObjects = new Map<string, { id: string }>();
    const key = "same-operation";
    const create = async () => {
      await Promise.resolve();
      const existing = providerObjects.get(key);
      if (existing) return existing;
      const account = { id: "acct_parallel" };
      providerObjects.set(key, account);
      return account;
    };
    const run = () =>
      createOrRecoverStripeAccount({
        operationToken: key,
        findExisting: async () => providerObjects.get(key) ?? null,
        create,
        isAmbiguous,
      });
    const [left, right] = await Promise.all([run(), run()]);
    assert.equal(left.account.id, right.account.id);
    assert.equal(providerObjects.size, 1);
  });

  test("definitive rejection does not retry account creation", async () => {
    let creates = 0;
    await assert.rejects(
      createOrRecoverStripeAccount({
        operationToken: "op-rejected",
        findExisting: async () => null,
        create: async () => {
          creates += 1;
          throw new Error("account_rejected");
        },
        isAmbiguous,
      }),
      /account_rejected/
    );
    assert.equal(creates, 1);
  });

  test("production account create uses operation metadata and a stable idempotency key", () => {
    const stripe = readFileSync(
      join(process.cwd(), "app/lib/jobPaymentStripe.server.ts"),
      "utf8"
    );
    const route = readFileSync(
      join(process.cwd(), "app/api/company/payments/connect/route.ts"),
      "utf8"
    );
    assert.match(stripe, /fielddive_connect_operation: input\.operationToken/);
    assert.match(stripe, /stripeConnectAccountIdempotencyKey\(input\.operationToken\)/);
    assert.match(stripe, /findStandardConnectedAccountForOperation/);
    assert.match(route, /predecessorProviderAccountId/);
    assert.match(route, /createOrRecoverStripeAccount/);
    assert.match(route, /payment_account_lookup_failed/);
  });
});
