/**
 * Phase 11 / Astra G10 — collection communication contracts (source + unit).
 *
 * Run: npx tsx --test app/lib/astraG10CollectionCommunication.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildPaymentRequestEmailContentHash,
  buildPaymentRequestEmailSendIdempotencyKey,
  isPaymentRequestEmailEligibleStatus,
  normalizePaymentRequestEmailNote,
  PAYMENT_REQUEST_EMAIL_NOTE_MAX_CHARS,
} from "./jobPaymentRequestDeliveryTypes";
import {
  buildPaymentRequestEmailTemplate,
  paymentRequestKindEmailLabel,
} from "./jobPaymentRequestEmailTemplate";
import { JOB_ACTIVITY_EVENT_TYPES } from "./jobLifecycleTypes";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("Astra G10 migration + types", () => {
  test("dedicated payment-request delivery attempts table", () => {
    const sql = read(
      "supabase/migrations/20260924120000_phase11_payment_request_delivery.sql"
    );
    assert.match(sql, /job_payment_request_delivery_attempts/);
    assert.match(sql, /payment_request_emailed/);
    assert.match(sql, /payment_request_email_failed/);
    assert.doesNotMatch(sql, /due_at|due_date|overdue/i);
    assert.doesNotMatch(sql, /create table.*proposal_delivery_attempts/i);
  });

  test("activity types include payment request email events", () => {
    assert.ok(JOB_ACTIVITY_EVENT_TYPES.includes("payment_request_emailed"));
    assert.ok(JOB_ACTIVITY_EVENT_TYPES.includes("payment_request_email_failed"));
  });
});

describe("Astra G10 email eligibility + idempotency", () => {
  test("only open/processing are emailable", () => {
    assert.equal(isPaymentRequestEmailEligibleStatus("open"), true);
    assert.equal(isPaymentRequestEmailEligibleStatus("processing"), true);
    assert.equal(isPaymentRequestEmailEligibleStatus("paid"), false);
    assert.equal(isPaymentRequestEmailEligibleStatus("cancelled"), false);
    assert.equal(isPaymentRequestEmailEligibleStatus("expired"), false);
  });

  test("note is bounded and optional", () => {
    assert.equal(normalizePaymentRequestEmailNote("  hi  "), "hi");
    assert.equal(normalizePaymentRequestEmailNote(""), null);
    const long = "x".repeat(PAYMENT_REQUEST_EMAIL_NOTE_MAX_CHARS + 40);
    assert.equal(
      normalizePaymentRequestEmailNote(long)?.length,
      PAYMENT_REQUEST_EMAIL_NOTE_MAX_CHARS
    );
  });

  test("idempotency key is stable for same content", () => {
    const hash = buildPaymentRequestEmailContentHash({
      subject: "A",
      body: "B",
      note: "C",
    });
    const a = buildPaymentRequestEmailSendIdempotencyKey({
      paymentRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      recipientHash: "abcdef0123456789",
      contentHash: hash,
    });
    const b = buildPaymentRequestEmailSendIdempotencyKey({
      paymentRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      recipientHash: "abcdef0123456789",
      contentHash: hash,
    });
    assert.equal(a, b);
    assert.match(a, /^pay-email-send\/v1\//);
    const retry = buildPaymentRequestEmailSendIdempotencyKey({
      paymentRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      recipientHash: "abcdef0123456789",
      contentHash: hash,
      retrySuffix: "gen-2",
    });
    assert.notEqual(a, retry);
  });
});

describe("Astra G10 email template", () => {
  test("kind labels and no overdue/final-payment invention", () => {
    assert.equal(paymentRequestKindEmailLabel("deposit"), "Deposit");
    assert.equal(paymentRequestKindEmailLabel("progress"), "Progress payment");
    assert.equal(paymentRequestKindEmailLabel("balance"), "Balance");
    const tpl = buildPaymentRequestEmailTemplate({
      origin: "https://www.fielddive.com",
      rawToken: "tok_test_token",
      companyName: "Acme Roofing",
      kind: "progress",
      amountCents: 45000,
      contractTotalCents: 1895000,
      remainingCollectibleCents: 45000,
    });
    assert.match(tpl.subject, /Progress payment/);
    assert.match(tpl.html, /Pay now/);
    assert.match(tpl.html, /\$450\.00/);
    assert.match(tpl.html, /\$18,950\.00/);
    assert.doesNotMatch(tpl.html, /overdue|final payment/i);
    assert.doesNotMatch(tpl.text, /overdue|final payment/i);
  });
});

describe("Astra G10 API + capability wiring", () => {
  test("email route + capability on collect/copy/email", () => {
    const emailRoute = read(
      "app/api/jobs/[jobId]/payment-requests/[paymentRequestId]/email/route.ts"
    );
    assert.match(emailRoute, /payment_request/);
    assert.match(emailRoute, /sendPaymentRequestEmailForContractor/);
    assert.match(emailRoute, /Reject client-trusted destination/);
    assert.match(emailRoute, /recipientEmail\?: unknown/);

    const collect = read(
      "app/api/jobs/[jobId]/payment-requests/collect/route.ts"
    );
    assert.match(collect, /requireCapabilitySession/);
    assert.match(collect, /payment_request/);

    const link = read("app/api/jobs/[jobId]/payment-link/route.ts");
    assert.match(link, /requireCapabilitySession/);
    assert.match(link, /payment_request/);
  });

  test("webhook correlates payment attempts without second endpoint", () => {
    const webhook = read("app/lib/proposalDeliveryWebhookProcess.server.ts");
    assert.match(
      webhook,
      /findPaymentRequestDeliveryAttemptByProviderMessageIdWithClient/
    );
    const route = read("app/api/webhooks/resend/route.ts");
    assert.match(route, /processVerifiedResendWebhookEvent/);
  });

  test("Payments UI exposes email/resend/copy/delivery history", () => {
    const ui = read(
      "app/tools/roofing/jobCard/JobCardPaymentsWorkspace.tsx"
    );
    assert.match(ui, /data-jobcard-payments-email-send/);
    assert.match(ui, /data-jobcard-payments-delivery-history/);
    assert.match(ui, /data-jobcard-payments-partial-success/);
    assert.match(ui, /Email payment request|Resend email/);
  });

  test("copy-link metadata cleaned for communication source", () => {
    const link = read("app/lib/jobPaymentPublicLink.server.ts");
    assert.match(link, /payment_request_communication/);
    assert.doesNotMatch(link, /contractor_preview_qa/);
  });
});
