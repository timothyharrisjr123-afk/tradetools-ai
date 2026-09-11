/**
 * D1 — Resend/Svix signature verification fixtures.
 * Run: npx tsx --test app/lib/proposalDeliveryWebhookVerify.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Webhook } from "svix";

import {
  resolveResendWebhookSecret,
  verifyResendWebhookSignature,
} from "./proposalDeliveryWebhookVerify";

/** Svix test secret format (whsec_ + base64). */
const TEST_SECRET = "whsec_" + Buffer.from("fielddive-d1-webhook-test-secret").toString("base64");

function signPayload(payload: object, opts?: { id?: string; timestamp?: Date }) {
  const body = JSON.stringify(payload);
  const wh = new Webhook(TEST_SECRET);
  const id = opts?.id ?? `msg_d1_test_${Date.now()}`;
  const timestamp = opts?.timestamp ?? new Date();
  const signature = wh.sign(id, timestamp, body);
  return {
    body,
    id,
    timestamp: String(Math.floor(timestamp.getTime() / 1000)),
    signature,
  };
}

describe("D1 Resend webhook signature verification", () => {
  test("resolveResendWebhookSecret reads server env only", () => {
    assert.equal(resolveResendWebhookSecret({} as NodeJS.ProcessEnv), null);
    assert.equal(
      resolveResendWebhookSecret({
        RESEND_WEBHOOK_SECRET: "  whsec_abc  ",
      } as unknown as NodeJS.ProcessEnv),
      "whsec_abc"
    );
  });

  test("valid signature PASS for delivered fixture", () => {
    const signed = signPayload({
      type: "email.delivered",
      created_at: "2026-09-11T12:00:00.000Z",
      data: { email_id: "email_d1_delivered" },
    });
    const verified = verifyResendWebhookSignature({
      rawBody: signed.body,
      svixId: signed.id,
      svixTimestamp: signed.timestamp,
      svixSignature: signed.signature,
      secret: TEST_SECRET,
    });
    assert.equal(verified.type, "email.delivered");
  });

  test("valid signature PASS for delayed/bounce/fail/complaint fixtures", () => {
    for (const type of [
      "email.delivery_delayed",
      "email.bounced",
      "email.failed",
      "email.complained",
    ]) {
      const signed = signPayload({
        type,
        data: { email_id: `email_d1_${type}` },
      });
      const verified = verifyResendWebhookSignature({
        rawBody: signed.body,
        svixId: signed.id,
        svixTimestamp: signed.timestamp,
        svixSignature: signed.signature,
        secret: TEST_SECRET,
      });
      assert.equal(verified.type, type);
    }
  });

  test("invalid signature REJECT", () => {
    const signed = signPayload({
      type: "email.delivered",
      data: { email_id: "email_d1_bad_sig" },
    });
    assert.throws(
      () =>
        verifyResendWebhookSignature({
          rawBody: signed.body,
          svixId: signed.id,
          svixTimestamp: signed.timestamp,
          svixSignature: "v1,deadbeef",
          secret: TEST_SECRET,
        }),
      /Message timestamp too old|no matching signature|signature/i
    );
  });

  test("tampered body REJECT", () => {
    const signed = signPayload({
      type: "email.delivered",
      data: { email_id: "email_d1_tamper" },
    });
    assert.throws(() =>
      verifyResendWebhookSignature({
        rawBody: signed.body.replace("delivered", "bounced"),
        svixId: signed.id,
        svixTimestamp: signed.timestamp,
        svixSignature: signed.signature,
        secret: TEST_SECRET,
      })
    );
  });

  test("missing headers REJECT", () => {
    assert.throws(
      () =>
        verifyResendWebhookSignature({
          rawBody: "{}",
          svixId: null,
          svixTimestamp: "1",
          svixSignature: "v1,x",
          secret: TEST_SECRET,
        }),
      /resend_webhook_headers_missing/
    );
  });

  test("duplicate/replay uses same svix id payload verify identically", () => {
    const now = new Date();
    const signed = signPayload(
      {
        type: "email.delivered",
        data: { email_id: "email_d1_replay" },
      },
      { id: "msg_d1_replay_fixed", timestamp: now }
    );
    const a = verifyResendWebhookSignature({
      rawBody: signed.body,
      svixId: signed.id,
      svixTimestamp: signed.timestamp,
      svixSignature: signed.signature,
      secret: TEST_SECRET,
    });
    const b = verifyResendWebhookSignature({
      rawBody: signed.body,
      svixId: signed.id,
      svixTimestamp: signed.timestamp,
      svixSignature: signed.signature,
      secret: TEST_SECRET,
    });
    assert.equal(a.type, b.type);
    assert.equal(signed.id, "msg_d1_replay_fixed");
  });
});
