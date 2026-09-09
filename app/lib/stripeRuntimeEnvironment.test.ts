import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  requireStripeConnectWebhookSecret,
  requireStripeSecretKey,
  resolveFieldDiveEnvironment,
  stripeEventModeMatchesEnvironment,
} from "./stripeRuntimeEnvironment";

const liveKey = "sk_live_example_not_a_real_secret";
const testKey = "sk_test_example_not_a_real_secret";

describe("Stripe environment and key contract", () => {
  test("production accepts live and rejects test, missing, and malformed keys", () => {
    assert.equal(
      requireStripeSecretKey({ FIELDDIVE_ENV: "production", STRIPE_SECRET_KEY: liveKey }),
      liveKey
    );
    assert.throws(() => requireStripeSecretKey({ FIELDDIVE_ENV: "production", STRIPE_SECRET_KEY: testKey }));
    assert.throws(() => requireStripeSecretKey({ FIELDDIVE_ENV: "production" }));
    assert.throws(() => requireStripeSecretKey({ FIELDDIVE_ENV: "production", STRIPE_SECRET_KEY: "secret" }));
  });

  test("staging and local accept test and reject live", () => {
    for (const environment of ["staging", "local"] as const) {
      assert.equal(requireStripeSecretKey({ FIELDDIVE_ENV: environment, STRIPE_SECRET_KEY: testKey }), testKey);
      assert.throws(() => requireStripeSecretKey({ FIELDDIVE_ENV: environment, STRIPE_SECRET_KEY: liveKey }));
    }
  });

  test("local and test derive safely; production builds require an explicit environment", () => {
    assert.equal(resolveFieldDiveEnvironment({ NODE_ENV: "development" }), "local");
    assert.equal(resolveFieldDiveEnvironment({ NODE_ENV: "test" }), "test");
    assert.throws(() => resolveFieldDiveEnvironment({ NODE_ENV: "production" }));
    assert.throws(() => resolveFieldDiveEnvironment({ FIELDDIVE_ENV: "preview" }));
  });
});

describe("Stripe Connect webhook boundary", () => {
  test("requires the dedicated Connect secret and never substitutes the legacy secret", () => {
    assert.equal(requireStripeConnectWebhookSecret({ STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect" }), "whsec_connect");
    assert.throws(() => requireStripeConnectWebhookSecret({}));
    assert.throws(() => requireStripeConnectWebhookSecret({ STRIPE_WEBHOOK_SECRET: "whsec_legacy" }));
    assert.throws(() => requireStripeConnectWebhookSecret({ STRIPE_CONNECT_WEBHOOK_SECRET: "not-a-secret" }));
  });

  test("accepts only the event livemode assigned to the environment", () => {
    assert.equal(stripeEventModeMatchesEnvironment(true, { FIELDDIVE_ENV: "production" }), true);
    assert.equal(stripeEventModeMatchesEnvironment(false, { FIELDDIVE_ENV: "production" }), false);
    assert.equal(stripeEventModeMatchesEnvironment(false, { FIELDDIVE_ENV: "staging" }), true);
    assert.equal(stripeEventModeMatchesEnvironment(true, { FIELDDIVE_ENV: "staging" }), false);
    assert.equal(stripeEventModeMatchesEnvironment(false, { FIELDDIVE_ENV: "local" }), true);
    assert.equal(stripeEventModeMatchesEnvironment(true, { FIELDDIVE_ENV: "local" }), false);
  });

  test("route rejects bad signatures and quarantines wrong-mode events before persistence", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/webhooks/stripe/connect/route.ts"),
      "utf8"
    );
    const signatureCheck = route.indexOf("invalid_signature");
    const modeCheck = route.indexOf("stripe_mode_mismatch");
    const persistence = route.indexOf("createAdminClient()");
    assert.ok(signatureCheck >= 0);
    assert.ok(modeCheck > signatureCheck);
    assert.ok(persistence > modeCheck);
    assert.match(route, /stripeEventModeMatchesEnvironment\(event\.livemode\)/);
    assert.match(route, /ignored: true/);
  });

  test("legacy webhook is a write-free tombstone", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/payments/webhook/route.ts"),
      "utf8"
    );
    assert.match(route, /legacy_payments_webhook_disabled/);
    assert.match(route, /status: 410/);
    assert.doesNotMatch(route, /STRIPE_|constructEvent|createAdminClient|\.from\(/);
  });

  test("canonical Stripe client pins the reviewed request API version centrally", () => {
    const source = readFileSync(
      join(process.cwd(), "app/lib/jobPaymentStripe.server.ts"),
      "utf8"
    );
    assert.match(source, /new Stripe\(requireStripeSecretKey\(\), \{/);
    assert.match(source, /apiVersion: "2026-07-29\.dahlia"/);
  });
});
