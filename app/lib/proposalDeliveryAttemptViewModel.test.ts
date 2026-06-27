/**
 * R18D3A / R18D3C1 — proposalDeliveryAttemptViewModel tests.
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
  buildProposalDeliveryHistoryViewModel,
  getProposalDeliveryAttemptShortExplanation,
  getProposalDeliveryAttemptStatusLabel,
  PROPOSAL_DELIVERY_ATTEMPT_BODY_PREVIEW_MAX_LENGTH,
  PROPOSAL_DELIVERY_ATTEMPT_SHORT_EXPLANATIONS,
  PROPOSAL_DELIVERY_ATTEMPT_STATUS_LABELS,
  PROPOSAL_DELIVERY_HISTORY_EMPTY_EXPLANATION,
  PROPOSAL_DELIVERY_HISTORY_EMPTY_TITLE,
  resolveProposalDeliveryAttemptDisplayTimestamp,
  truncateProposalDeliveryAttemptBodyPreview,
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

function assertForbiddenFieldsAbsent(vm: Record<string, unknown>): void {
  assert.ok(!("id" in vm));
  assert.ok(!("recipient_email_hash" in vm));
  assert.ok(!("proposal_public_access_token_id" in vm));
  assert.ok(!("proposal_version_id" in vm));
  assert.ok(!("provider_message_id" in vm));
  assert.ok(!("idempotency_key" in vm));
  assert.ok(!("body_snapshot" in vm));
  assert.ok(!("token_prefix" in vm));

  const serialized = JSON.stringify(vm);
  assert.doesNotMatch(serialized, /55555555-5555-4555-8555-555555555555/);
  assert.doesNotMatch(serialized, /66666666-6666-4666-8666-666666666666/);
  assert.doesNotMatch(serialized, /44444444-4444-4444-8444-444444444444/);
  assert.doesNotMatch(serialized, /resend-msg-1/);
  assert.doesNotMatch(serialized, /send-attempt-1/);
  assert.doesNotMatch(serialized, /a{64}/);
  assert.doesNotMatch(serialized, /\/p\//);
  assert.doesNotMatch(serialized, /http/i);
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
  test("omits forbidden internal fields while allowing supportLinkPrefix", () => {
    const vm = buildProposalDeliveryAttemptViewModel(baseRow({ status: "provider_accepted" }));
    assertForbiddenFieldsAbsent(vm as Record<string, unknown>);
    assert.equal(vm.supportLinkPrefix, "fd_pabc1");
  });

  test("shows redacted recipient, subject, and pending category", () => {
    const vm = buildProposalDeliveryAttemptViewModel(baseRow());
    assert.equal(vm.recipientDisplay, "j***@example.com");
    assert.equal(vm.subject, "Your roofing proposal");
    assert.equal(vm.statusLabel, "Sending");
    assert.equal(vm.statusTone, "pending");
    assert.equal(vm.resultCategory, "pending");
    assert.equal(vm.attemptedAt, "2026-06-26T12:00:00.000Z");
    assert.equal(vm.createdAt, "2026-06-26T12:00:00.000Z");
    assert.equal(vm.displayTimestamp, "2026-06-26T12:00:00.000Z");
    assert.equal(vm.channelLabel, "Email");
    assert.equal(vm.providerLabel, "Resend");
    assert.equal(vm.bodyPreview, "Please review your proposal.");
  });

  test("provider_accepted uses accepted category and provider-safe explanation", () => {
    const vm = buildProposalDeliveryAttemptViewModel(
      baseRow({
        status: "provider_accepted",
        provider_accepted_at: "2026-06-26T12:00:01.000Z",
      })
    );

    assert.equal(vm.resultCategory, "accepted");
    assert.equal(
      vm.shortExplanation,
      PROPOSAL_DELIVERY_ATTEMPT_SHORT_EXPLANATIONS.provider_accepted
    );
    assert.match(vm.shortExplanation, /Resend accepted the send request/i);
    assert.match(vm.shortExplanation, /does not confirm the customer received or opened/i);
    assert.doesNotMatch(vm.shortExplanation, /customer opened/i);
    assert.doesNotMatch(vm.shortExplanation, /sent to customer/i);
    assert.equal(vm.displayTimestamp, "2026-06-26T12:00:01.000Z");
    assert.equal(vm.safeError, null);
  });

  test("failed row exposes safe error in shortExplanation and safeError", () => {
    const failedVm = buildProposalDeliveryAttemptViewModel(
      baseRow({
        status: "failed",
        failed_at: "2026-06-26T12:00:02.000Z",
        error_message_safe: "Provider rejected the request.",
      })
    );
    assert.equal(failedVm.resultCategory, "failed");
    assert.equal(failedVm.safeError, "Provider rejected the request.");
    assert.equal(failedVm.shortExplanation, "Provider rejected the request.");
    assert.equal(failedVm.failedAt, "2026-06-26T12:00:02.000Z");
    assert.equal(failedVm.displayTimestamp, "2026-06-26T12:00:02.000Z");

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

  test("prepared and attempted map to pending category", () => {
    const preparedVm = buildProposalDeliveryAttemptViewModel(
      baseRow({ status: "prepared", attempted_at: null })
    );
    assert.equal(preparedVm.resultCategory, "pending");
    assert.equal(preparedVm.displayTimestamp, "2026-06-26T12:00:00.000Z");

    const attemptedVm = buildProposalDeliveryAttemptViewModel(baseRow({ status: "attempted" }));
    assert.equal(attemptedVm.resultCategory, "pending");
  });

  test("delivered, bounced, and complained map to future_tracking without open/view claims", () => {
    for (const status of ["delivered", "bounced", "complained"] as const) {
      const vm = buildProposalDeliveryAttemptViewModel(
        baseRow({
          status,
          delivered_at: status === "delivered" ? "2026-06-26T12:00:03.000Z" : null,
          bounced_at: status === "bounced" ? "2026-06-26T12:00:04.000Z" : null,
          complained_at: status === "complained" ? "2026-06-26T12:00:05.000Z" : null,
        })
      );
      assert.equal(vm.resultCategory, "future_tracking");
      assert.doesNotMatch(vm.shortExplanation, /customer opened/i);
      assert.doesNotMatch(vm.shortExplanation, /viewed/i);
      assert.doesNotMatch(vm.shortExplanation, /delivered to inbox/i);
    }

    assert.equal(
      getProposalDeliveryAttemptShortExplanation(baseRow({ status: "delivered" })),
      "Reported delivered by email provider."
    );
    assert.equal(
      getProposalDeliveryAttemptShortExplanation(baseRow({ status: "bounced" })),
      "Email provider reported a bounce."
    );
    assert.equal(
      getProposalDeliveryAttemptShortExplanation(baseRow({ status: "complained" })),
      "Email provider reported a spam complaint."
    );
  });

  test("buildProposalDeliveryAttemptViewModels sorts newest first", () => {
    const rows = [
      baseRow({
        status: "failed",
        created_at: "2026-06-26T11:00:00.000Z",
        attempted_at: "2026-06-26T11:00:00.000Z",
        failed_at: "2026-06-26T11:00:01.000Z",
        error_message_safe: "Nope.",
      }),
      baseRow({
        status: "provider_accepted",
        created_at: "2026-06-26T12:00:00.000Z",
        provider_accepted_at: "2026-06-26T12:00:01.000Z",
      }),
    ];
    const vms = buildProposalDeliveryAttemptViewModels(rows);
    assert.equal(vms.length, 2);
    assert.equal(vms[0]?.resultCategory, "accepted");
    assert.equal(vms[1]?.resultCategory, "failed");
  });
});

describe("proposalDeliveryAttemptViewModel body preview", () => {
  test("truncates long body_snapshot", () => {
    const longBody = "x".repeat(PROPOSAL_DELIVERY_ATTEMPT_BODY_PREVIEW_MAX_LENGTH + 20);
    const preview = truncateProposalDeliveryAttemptBodyPreview(longBody);
    assert.ok(preview);
    assert.ok(preview.length <= PROPOSAL_DELIVERY_ATTEMPT_BODY_PREVIEW_MAX_LENGTH);
    assert.match(preview, /…$/);

    const vm = buildProposalDeliveryAttemptViewModel(baseRow({ body_snapshot: longBody }));
    assert.equal(vm.bodyPreview, preview);
    assert.ok(!("body_snapshot" in vm));
  });

  test("handles empty and whitespace-only body", () => {
    assert.equal(truncateProposalDeliveryAttemptBodyPreview(""), null);
    assert.equal(truncateProposalDeliveryAttemptBodyPreview("   "), null);
    assert.equal(truncateProposalDeliveryAttemptBodyPreview(null), null);

    const vm = buildProposalDeliveryAttemptViewModel(baseRow({ body_snapshot: "   " }));
    assert.equal(vm.bodyPreview, null);
  });
});

describe("proposalDeliveryAttemptViewModel displayTimestamp", () => {
  test("uses accepted, failed, attempted, and created fallbacks", () => {
    assert.equal(
      resolveProposalDeliveryAttemptDisplayTimestamp(
        baseRow({
          status: "provider_accepted",
          provider_accepted_at: "2026-06-26T12:00:01.000Z",
        })
      ),
      "2026-06-26T12:00:01.000Z"
    );

    assert.equal(
      resolveProposalDeliveryAttemptDisplayTimestamp(
        baseRow({
          status: "failed",
          failed_at: "2026-06-26T12:00:02.000Z",
        })
      ),
      "2026-06-26T12:00:02.000Z"
    );

    assert.equal(
      resolveProposalDeliveryAttemptDisplayTimestamp(
        baseRow({
          status: "attempted",
          attempted_at: "2026-06-26T12:00:03.000Z",
        })
      ),
      "2026-06-26T12:00:03.000Z"
    );

    assert.equal(
      resolveProposalDeliveryAttemptDisplayTimestamp(
        baseRow({
          status: "prepared",
          attempted_at: null,
          created_at: "2026-06-26T12:00:04.000Z",
        })
      ),
      "2026-06-26T12:00:04.000Z"
    );
  });
});

describe("proposalDeliveryHistoryViewModel", () => {
  test("empty rows produce empty history VM", () => {
    const history = buildProposalDeliveryHistoryViewModel([]);
    assert.equal(history.isEmpty, true);
    assert.equal(history.latest, null);
    assert.deepEqual(history.history, []);
    assert.equal(history.totalCount, 0);
    assert.equal(history.emptyStateTitle, PROPOSAL_DELIVERY_HISTORY_EMPTY_TITLE);
    assert.equal(history.emptyStateExplanation, PROPOSAL_DELIVERY_HISTORY_EMPTY_EXPLANATION);
  });

  test("one provider_accepted attempt becomes latest with accepted category", () => {
    const history = buildProposalDeliveryHistoryViewModel([
      baseRow({
        status: "provider_accepted",
        provider_accepted_at: "2026-06-26T12:00:01.000Z",
      }),
    ]);

    assert.equal(history.isEmpty, false);
    assert.equal(history.totalCount, 1);
    assert.equal(history.latest?.resultCategory, "accepted");
    assert.equal(history.history.length, 1);
    assert.equal(history.history[0]?.statusLabel, "Accepted by email provider");
  });

  test("multiple attempts sorted newest first in history", () => {
    const history = buildProposalDeliveryHistoryViewModel([
      baseRow({
        status: "failed",
        created_at: "2026-06-26T10:00:00.000Z",
        attempted_at: "2026-06-26T10:00:00.000Z",
        failed_at: "2026-06-26T10:00:01.000Z",
      }),
      baseRow({
        status: "provider_accepted",
        created_at: "2026-06-26T12:00:00.000Z",
        provider_accepted_at: "2026-06-26T12:00:01.000Z",
      }),
    ]);

    assert.equal(history.totalCount, 2);
    assert.equal(history.latest?.resultCategory, "accepted");
    assert.equal(history.history[0]?.resultCategory, "accepted");
    assert.equal(history.history[1]?.resultCategory, "failed");
  });

  test("history items omit forbidden fields", () => {
    const history = buildProposalDeliveryHistoryViewModel([baseRow({ status: "provider_accepted" })]);
    for (const item of history.history) {
      assertForbiddenFieldsAbsent(item as Record<string, unknown>);
    }
    const serialized = JSON.stringify(history);
    assert.doesNotMatch(serialized, /http/i);
    assert.doesNotMatch(serialized, /\/p\//);
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
