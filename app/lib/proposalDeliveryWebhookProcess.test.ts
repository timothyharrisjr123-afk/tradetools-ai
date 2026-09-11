/**
 * D1 — Webhook process orchestration unit tests (no live Resend).
 * Run: npx tsx --test app/lib/proposalDeliveryWebhookProcess.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("D1 webhook route + migration contracts", () => {
  test("migration defines inbox, delayed status, and transition guards", () => {
    const sql = read(
      "supabase/migrations/20260911190000_proposal_delivery_webhook_truth.sql"
    );
    assert.match(sql, /proposal_delivery_provider_events/);
    assert.match(sql, /svix_id/);
    assert.match(sql, /unique \(svix_id\)/i);
    assert.match(sql, /'delayed'/);
    assert.match(sql, /delayed_at/);
    assert.match(sql, /old\.status = 'delayed'/);
    assert.match(sql, /old\.status = 'delivered' and new\.status = 'complained'/);
    assert.match(sql, /revoke all[\s\S]*authenticated/i);
    assert.doesNotMatch(sql, /grant select[\s\S]*authenticated/i);
  });

  test("webhook route verifies svix headers and never trusts company_id", () => {
    const route = read("app/api/webhooks/resend/route.ts");
    assert.match(route, /svix-id/);
    assert.match(route, /svix-timestamp/);
    assert.match(route, /svix-signature/);
    assert.match(route, /verifyResendWebhookSignature/);
    assert.match(route, /invalid_signature/);
    assert.doesNotMatch(route, /companyId|company_id\s*[:=]/);
    assert.match(route, /Never trusts client company_id/);
  });

  test("process module retains unresolved unknown provider IDs", () => {
    const src = read("app/lib/proposalDeliveryWebhookProcess.server.ts");
    assert.match(src, /processVerifiedResendWebhookEvent/);
    assert.match(src, /insertProposalDeliveryProviderEventWithClient/);
    const persistence = read("app/lib/proposalDeliveryWebhookPersistence.ts");
    assert.match(persistence, /unresolved/);
    assert.match(persistence, /no_matching_attempt/);
    assert.match(persistence, /reconcileUnresolvedEventsForProviderMessageIdWithClient/);
  });

  test("provider accepted path reconciles unresolved inbox", () => {
    const persistence = read("app/lib/proposalDeliveryAttemptPersistence.ts");
    assert.match(
      persistence,
      /reconcileUnresolvedEventsForProviderMessageIdWithClient/
    );
  });

  test("contractor copy stays quiet and actionable on failure", () => {
    const vm = read("app/lib/proposalDeliveryAttemptViewModel.ts");
    assert.match(vm, /provider_accepted: "Emailed"/);
    assert.match(vm, /failed: "Couldn't deliver"/);
    assert.match(vm, /bounced: "Couldn't deliver"/);
    assert.match(vm, /Check the customer's email and resend/);
    assert.doesNotMatch(vm, /Accepted by email provider/);
    assert.doesNotMatch(vm, /Resend accepted/);

    const jobCard = read("app/lib/proposalJobCardSentHistory.ts");
    assert.match(jobCard, /Couldn't deliver/);
    assert.match(jobCard, /delivered: null/);
    assert.match(jobCard, /delayed: null/);
  });
});
