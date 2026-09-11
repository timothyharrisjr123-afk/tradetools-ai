/**
 * D1 — Delivery webhook normalize + transition matrix tests.
 * Run: npx tsx --test app/lib/proposalDeliveryWebhookNormalize.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DELIVERY_STATUS_STRENGTH,
  isAllowedDeliveryStatusTransition,
  mapResendEventToTargetStatus,
  resolveDeliveryStatusApplyDecision,
} from "./proposalDeliveryWebhookNormalize";

describe("D1 Resend event → normalized status", () => {
  test("maps provider events without exposing jargon as status names", () => {
    assert.equal(mapResendEventToTargetStatus("email.sent"), null);
    assert.equal(mapResendEventToTargetStatus("email.delivery_delayed"), "delayed");
    assert.equal(mapResendEventToTargetStatus("email.delivered"), "delivered");
    assert.equal(mapResendEventToTargetStatus("email.bounced"), "bounced");
    assert.equal(mapResendEventToTargetStatus("email.failed"), "failed");
    assert.equal(mapResendEventToTargetStatus("email.complained"), "complained");
  });
});

describe("D1 transition matrix", () => {
  test("allows delayed→delivered and delayed→bounced", () => {
    assert.equal(isAllowedDeliveryStatusTransition("delayed", "delivered"), true);
    assert.equal(isAllowedDeliveryStatusTransition("delayed", "bounced"), true);
    assert.equal(isAllowedDeliveryStatusTransition("delayed", "failed"), true);
  });

  test("blocks delivered→provider_accepted regression", () => {
    assert.equal(
      isAllowedDeliveryStatusTransition("delivered", "provider_accepted"),
      false
    );
    assert.equal(
      resolveDeliveryStatusApplyDecision("delivered", "provider_accepted"),
      "ignore"
    );
    assert.ok(
      DELIVERY_STATUS_STRENGTH.delivered > DELIVERY_STATUS_STRENGTH.provider_accepted
    );
  });

  test("allows complaint after delivery", () => {
    assert.equal(isAllowedDeliveryStatusTransition("delivered", "complained"), true);
    assert.equal(resolveDeliveryStatusApplyDecision("delivered", "complained"), "apply");
  });

  test("noop on same status", () => {
    assert.equal(resolveDeliveryStatusApplyDecision("delivered", "delivered"), "noop");
  });

  test("provider_accepted can advance to delayed/delivered/bounce/fail/complaint", () => {
    for (const to of ["delayed", "delivered", "bounced", "failed", "complained"] as const) {
      assert.equal(isAllowedDeliveryStatusTransition("provider_accepted", to), true);
      assert.equal(resolveDeliveryStatusApplyDecision("provider_accepted", to), "apply");
    }
  });
});
