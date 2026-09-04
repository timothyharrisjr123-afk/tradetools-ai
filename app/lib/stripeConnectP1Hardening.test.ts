import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  isStripeConnectEventContractError,
  mapStripeConnectEventToCommand,
} from "./jobPaymentWebhookMapper";
import {
  isConfirmedAccountPersistence,
  isConfirmedSettlementPersistence,
} from "./stripeConnectPersistenceContract";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const MUTATING_CONNECT_TYPES = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.succeeded",
  "payment_intent.processing",
  "payment_intent.payment_failed",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "refund.failed",
] as const;

describe("Stripe Connect signed account contract", () => {
  test("all connected-account money events require top-level event.account", () => {
    for (const type of MUTATING_CONNECT_TYPES) {
      const mapped = mapStripeConnectEventToCommand({
        id: `evt_missing_${type}`,
        type,
        data: {
          object: {
            id: type.startsWith("payment_intent.") ? "pi_test" : "obj_test",
            stripe_account: "acct_object_fallback_must_not_apply",
            metadata: { company_id: "company_metadata_must_not_apply" },
          },
        },
      });
      assert.equal(isStripeConnectEventContractError(mapped), true, type);
      if (isStripeConnectEventContractError(mapped)) {
        assert.equal(mapped.code, "missing_event_account");
        assert.equal(mapped.event_account_id, null);
      }
    }
  });

  test("money event with top-level account is accepted", () => {
    const mapped = mapStripeConnectEventToCommand({
      id: "evt_paid",
      type: "payment_intent.succeeded",
      account: "acct_company_a",
      data: { object: { id: "pi_paid", amount: 1000 } },
    });
    assert.equal(isStripeConnectEventContractError(mapped), false);
    assert.equal("ignore" in mapped, false);
    if (!("ignore" in mapped)) {
      assert.equal(mapped.provider_account_id, "acct_company_a");
    }
  });

  test("account.updated requires event.account equal to Account object id", () => {
    const missing = mapStripeConnectEventToCommand({
      id: "evt_account_missing",
      type: "account.updated",
      data: { object: { id: "acct_object" } },
    });
    assert.equal(isStripeConnectEventContractError(missing), true);

    const mismatch = mapStripeConnectEventToCommand({
      id: "evt_account_mismatch",
      type: "account.updated",
      account: "acct_event",
      data: { object: { id: "acct_object" } },
    });
    assert.equal(isStripeConnectEventContractError(mismatch), true);
    if (isStripeConnectEventContractError(mismatch)) {
      assert.equal(mismatch.code, "event_account_mismatch");
    }
  });

  test("checkout expiration is the only handled no-op with optional account", () => {
    const mapped = mapStripeConnectEventToCommand({
      id: "evt_expired",
      type: "checkout.session.expired",
      data: { object: { id: "cs_expired" } },
    });
    assert.deepEqual(mapped, { ignore: true, type: "checkout.session.expired" });
  });
});

describe("coarse account state input", () => {
  function accountUpdate(input: Record<string, unknown>) {
    const mapped = mapStripeConnectEventToCommand({
      id: "evt_account",
      type: "account.updated",
      account: "acct_test",
      data: { object: { id: "acct_test", ...input } },
    });
    assert.equal("ignore" in mapped, false);
    if ("ignore" in mapped) throw new Error("unexpected mapper result");
    return mapped.account_update;
  }

  test("ordinary incomplete onboarding stays pending input, not disabled", () => {
    const update = accountUpdate({
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      requirements: { disabled_reason: null },
    });
    assert.equal(update?.disabled, false);
    assert.equal(update?.details_submitted, false);
  });

  test("recoverable requirements stay restricted input", () => {
    const update = accountUpdate({
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: true,
      requirements: { disabled_reason: "requirements.past_due" },
    });
    assert.equal(update?.disabled, false);
    assert.equal(update?.details_submitted, true);
  });

  test("Stripe rejection is disabled and charge-ready is complete input", () => {
    assert.equal(
      accountUpdate({
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: true,
        requirements: { disabled_reason: "rejected.other" },
      })?.disabled,
      true
    );
    assert.equal(
      accountUpdate({
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
        requirements: { disabled_reason: null },
      })?.disabled,
      false
    );
  });
});

describe("persistence acknowledgement contracts", () => {
  test("settlement accepts canonical success and safe replay only", () => {
    assert.equal(isConfirmedSettlementPersistence({ ok: true, ignored: false }), true);
    assert.equal(
      isConfirmedSettlementPersistence({
        ok: true,
        ignored: false,
        idempotent_replay: true,
      }),
      true
    );
    assert.equal(
      isConfirmedSettlementPersistence({ ok: true, ignored: true, reason: "unbound_event" }),
      false
    );
    assert.equal(isConfirmedSettlementPersistence({ ok: false, code: "account_mismatch" }), false);
    assert.equal(isConfirmedSettlementPersistence({}), false);
  });

  test("account persistence requires exact account round-trip", () => {
    const success = {
      ok: true,
      company_id: "company-a",
      provider_account_id: "acct_a",
    };
    assert.equal(isConfirmedAccountPersistence(success, "acct_a"), true);
    assert.equal(isConfirmedAccountPersistence(success, "acct_b"), false);
    assert.equal(isConfirmedAccountPersistence({ ok: false }, "acct_a"), false);
    assert.equal(isConfirmedAccountPersistence({ ok: true }, "acct_a"), false);
  });

  test("webhook and Connect routes enforce persistence before success", () => {
    const webhook = read("app/api/webhooks/stripe/connect/route.ts");
    assert.match(webhook, /isConfirmedSettlementPersistence\(persisted\)/);
    assert.match(webhook, /settlement_persistence_rejected/);
    assert.match(webhook, /isConfirmedAccountPersistence\(/);
    assert.match(webhook, /account_update_persistence_rejected/);
    assert.match(webhook, /\{ status: 400 \}/);
    assert.match(webhook, /\{ status: 500 \}/);

    const connect = read("app/api/company/payments/connect/route.ts");
    const existingBranch = connect.slice(connect.indexOf("} else {"));
    assert.match(existingBranch, /const persisted = await upsertCompanyPaymentAccountFromProviderViaRpc/);
    assert.match(existingBranch, /isConfirmedAccountPersistence\(persisted, live\.id\)/);
    assert.match(existingBranch, /payment_account_refresh_failed/);
    assert.match(existingBranch, /status: 503/);
    assert.ok(
      existingBranch.indexOf("isConfirmedAccountPersistence") <
        existingBranch.indexOf("createAccountOnboardingLink")
    );
  });
});

describe("legacy Checkout containment and regression boundaries", () => {
  test("server tombstone cannot reach Stripe or secrets", () => {
    const legacy = read("app/api/payments/create-checkout/route.ts");
    assert.match(legacy, /legacy_checkout_disabled/);
    assert.match(legacy, /status: 410/);
    assert.doesNotMatch(legacy, /STRIPE_SECRET_KEY|new Stripe|checkout\.sessions\.create/);
    assert.doesNotMatch(legacy, /slice\(|substring\(|console\./);
  });

  test("legacy initiating UI is disabled while canonical Connect remains", () => {
    const saved = read("app/tools/roofing/saved/SavedClient.tsx");
    assert.match(saved, /const LEGACY_PLATFORM_CHECKOUT_ENABLED = false/);
    assert.match(saved, /LEGACY_PLATFORM_CHECKOUT_ENABLED && !isFullyPaid/);

    const canonical = read("app/lib/jobPaymentStripe.server.ts");
    assert.match(canonical, /stripeAccount: input\.connectedAccountId/);
    assert.match(canonical, /createDirectPaymentRefund/);
    assert.match(canonical, /verifyStripeConnectWebhook/);
  });

  test("webhook hardening introduces no job lifecycle mutation", () => {
    const webhook = read("app/api/webhooks/stripe/connect/route.ts");
    const contract = read("app/lib/stripeConnectPersistenceContract.ts");
    assert.doesNotMatch(webhook + contract, /transition_job_stage|update\s+public\.jobs|stage_entered_at/);
  });
});
