/**
 * R18D3A — proposalDeliveryAttemptViewModel tests.
 *
 * Run: npx tsx --test app/lib/proposalDeliveryAttemptViewModel.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import type { ProposalDeliveryAttemptRow } from "./proposalDeliveryAttemptTypes";
import {
  buildProposalDeliveryAttemptViewModel,
  buildProposalDeliveryAttemptViewModels,
  getProposalDeliveryAttemptStatusLabel,
  PROPOSAL_DELIVERY_ATTEMPT_STATUS_LABELS,
} from "./proposalDeliveryAttemptViewModel";

function baseRow(
  overrides: Partial<ProposalDeliveryAttemptRow> = {}
): ProposalDeliveryAttemptRow {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    company_id: "22222222-2222-4222-8222-222222222222",
    proposal_id: "33333333-3333-4333-8333-333333333333",
    proposal_version_id: "44444444-4444-4444-8444-444444444444",
    proposal_public_access_token_id: "66666666-6666-4666-8666-666666666666",
    channel: "email",
    provider: "resend",
    recipient_email_hash: "a".repeat(64),
    recipient_email_redacted: "j***@example.com",
    token_prefix: "fd_pabc1",
    idempotency_key: "send-attempt-1",
    status: "attempted",
    subject_snapshot: "Your roofing proposal",
    body_snapshot: "Please review your proposal.",
    provider_message_id: "resend-msg-1",
    error_code: null,
    error_message_safe: null,
    metadata_json: {},
    created_by: "77777777-7777-4777-8777-777777777777",
    created_at: "2026-06-26T12:00:00.000Z",
    updated_at: "2026-06-26T12:00:00.000Z",
    attempted_at: "2026-06-26T12:00:00.000Z",
    provider_accepted_at: null,
    failed_at: null,
    delivered_at: null,
    bounced_at: null,
    complained_at: null,
    ...overrides,
  };
}

describe("proposalDeliveryAttemptViewModel status labels", () => {
  test("all status labels match contractor-safe copy", () => {
    assert.equal(PROPOSAL_DELIVERY_ATTEMPT_STATUS_LABELS.prepared, "Prepared");
    assert.equal(PROPOSAL_DELIVERY_ATTEMPT_STATUS_LABELS.attempted, "Sending");
    assert.equal(
      PROPOSAL_DELIVERY_ATTEMPT_STATUS_LABELS.provider_accepted,
      "Accepted by email provider"
    );
    assert.equal(PROPOSAL_DELIVERY_ATTEMPT_STATUS_LABELS.failed, "Failed");
    assert.equal(PROPOSAL_DELIVERY_ATTEMPT_STATUS_LABELS.delivered, "Delivered");
    assert.equal(PROPOSAL_DELIVERY_ATTEMPT_STATUS_LABELS.bounced, "Bounced");
    assert.equal(PROPOSAL_DELIVERY_ATTEMPT_STATUS_LABELS.complained, "Complaint received");
  });

  test("provider_accepted label is not sent to customer wording", () => {
    const label = getProposalDeliveryAttemptStatusLabel("provider_accepted");
    assert.notEqual(label, "Sent to customer");
    assert.notEqual(label.toLowerCase(), "sent to customer");
    assert.match(label, /email provider/i);
  });
});

describe("proposalDeliveryAttemptViewModel output", () => {
  test("omits hash, internal IDs, provider message id, and token prefix", () => {
    const vm = buildProposalDeliveryAttemptViewModel(baseRow({ status: "provider_accepted" }));
    const serialized = JSON.stringify(vm);

    assert.doesNotMatch(serialized, /55555555-5555-4555-8555-555555555555/);
    assert.doesNotMatch(serialized, /66666666-6666-4666-8666-666666666666/);
    assert.doesNotMatch(serialized, /resend-msg-1/);
    assert.doesNotMatch(serialized, /fd_pabc1/);
    assert.doesNotMatch(serialized, /a{64}/);
    assert.ok(!("id" in vm));
    assert.ok(!("recipient_email_hash" in vm));
    assert.ok(!("token_prefix" in vm));
    assert.ok(!("provider_message_id" in vm));
  });

  test("shows redacted recipient and subject", () => {
    const vm = buildProposalDeliveryAttemptViewModel(baseRow());
    assert.equal(vm.recipientDisplay, "j***@example.com");
    assert.equal(vm.subject, "Your roofing proposal");
    assert.equal(vm.statusLabel, "Sending");
    assert.equal(vm.statusTone, "pending");
    assert.equal(vm.attemptedAt, "2026-06-26T12:00:00.000Z");
  });

  test("failed row exposes safe error only when status is failed", () => {
    const failedVm = buildProposalDeliveryAttemptViewModel(
      baseRow({
        status: "failed",
        failed_at: "2026-06-26T12:00:02.000Z",
        error_message_safe: "Provider rejected the request.",
      })
    );
    assert.equal(failedVm.safeError, "Provider rejected the request.");
    assert.equal(failedVm.failedAt, "2026-06-26T12:00:02.000Z");

    const acceptedVm = buildProposalDeliveryAttemptViewModel(
      baseRow({
        status: "provider_accepted",
        provider_accepted_at: "2026-06-26T12:00:01.000Z",
        error_message_safe: "stale error",
      })
    );
    assert.equal(acceptedVm.safeError, null);
    assert.equal(acceptedVm.providerAcceptedAt, "2026-06-26T12:00:01.000Z");
  });

  test("buildProposalDeliveryAttemptViewModels maps rows in order", () => {
    const rows = [
      baseRow({ status: "attempted" }),
      baseRow({ status: "failed", error_message_safe: "Nope." }),
    ];
    const vms = buildProposalDeliveryAttemptViewModels(rows);
    assert.equal(vms.length, 2);
    assert.equal(vms[0]?.statusLabel, "Sending");
    assert.equal(vms[1]?.statusLabel, "Failed");
  });
});

describe("proposalDeliveryAttemptViewModel guardrails", () => {
  test("view model module has no Resend or route imports", () => {
    const source = readFileSync(
      new URL("./proposalDeliveryAttemptViewModel.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(source, /from "resend"|from 'resend'/i);
    assert.doesNotMatch(source, /\/api\/proposals\/send/);
    assert.doesNotMatch(source, /proposal_events|proposals\.status/);
  });
});
