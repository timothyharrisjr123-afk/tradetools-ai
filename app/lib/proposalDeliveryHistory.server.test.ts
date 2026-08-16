/**
 * R18D3C2 — proposalDeliveryHistory read path tests.
 *
 * Run: npx tsx --test app/lib/proposalDeliveryHistory.server.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import type { ProposalDeliveryAttemptRow } from "@/app/lib/proposalDeliveryAttemptTypes";
import {
  getProposalDeliveryHistory,
  type GetProposalDeliveryHistoryDeps,
} from "@/app/lib/proposalDeliveryHistory";
import { PROPOSAL_DELIVERY_ATTEMPT_SHORT_EXPLANATIONS } from "@/app/lib/proposalDeliveryAttemptViewModel";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const JOB_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_JOB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function proposalRecord(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: PROPOSAL_ID,
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    customer_id: null,
    template_id: "88888888-8888-4888-8888-888888888888",
    status: "draft",
    current_draft_version_id: "99999999-9999-4999-8999-999999999999",
    latest_sent_version_id: null,
    signed_version_id: null,
    selected_option_id: null,
    measurement_record_id: null,
    pricing_policy_id: null,
    proposal_number: null,
    title: "Roof Replacement",
    created_by: null,
    updated_by: null,
    created_at: "2026-06-26T12:00:00.000Z",
    updated_at: "2026-06-26T12:00:00.000Z",
    draft_content_changed_at: "2026-06-26T12:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function deliveryRow(
  overrides: Partial<ProposalDeliveryAttemptRow> = {}
): ProposalDeliveryAttemptRow {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: "44444444-4444-4444-8444-444444444444",
    proposal_public_access_token_id: "77777777-7777-4777-8777-777777777777",
    channel: "email",
    provider: "resend",
    recipient_email_hash: "a".repeat(64),
    recipient_email_redacted: "j***@example.com",
    token_prefix: "fd_pabc1",
    idempotency_key: "send-attempt-1",
    status: "provider_accepted",
    subject_snapshot: "Your roofing proposal",
    body_snapshot: "Please review your proposal.",
    provider_message_id: "resend-msg-1",
    error_code: null,
    error_message_safe: null,
    metadata_json: {},
    created_by: "88888888-8888-4888-8888-888888888888",
    created_at: "2026-06-26T12:00:00.000Z",
    updated_at: "2026-06-26T12:00:00.000Z",
    attempted_at: "2026-06-26T12:00:00.000Z",
    provider_accepted_at: "2026-06-26T12:05:00.000Z",
    failed_at: null,
    delivered_at: null,
    bounced_at: null,
    complained_at: null,
    ...overrides,
  };
}

function assertForbiddenFieldsAbsent(value: unknown): void {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /55555555-5555-4555-8555-555555555555/);
  assert.doesNotMatch(serialized, /77777777-7777-4777-8777-777777777777/);
  assert.doesNotMatch(serialized, /44444444-4444-4444-8444-444444444444/);
  assert.doesNotMatch(serialized, /resend-msg-1/);
  assert.doesNotMatch(serialized, /send-attempt-1/);
  assert.doesNotMatch(serialized, /a{64}/);
  assert.doesNotMatch(serialized, /\/p\//);
  assert.doesNotMatch(serialized, /http/i);
  assert.doesNotMatch(serialized, /recipient_email_hash/);
  assert.doesNotMatch(serialized, /proposal_public_access_token_id/);
  assert.doesNotMatch(serialized, /proposal_version_id/);
  assert.doesNotMatch(serialized, /provider_message_id/);
  assert.doesNotMatch(serialized, /idempotency_key/);
  assert.doesNotMatch(serialized, /body_snapshot/);
}

function historyDeps(
  overrides: Partial<GetProposalDeliveryHistoryDeps> = {}
): GetProposalDeliveryHistoryDeps {
  return {
    getProposal: async () => proposalRecord(),
    listDeliveryAttempts: async () => [],
    ...overrides,
  };
}

describe("getProposalDeliveryHistory", () => {
  test("missing proposalId returns missing_proposal_id", async () => {
    const result = await getProposalDeliveryHistory(
      { companyId: COMPANY_ID, proposalId: "" },
      historyDeps()
    );

    assert.deepEqual(result, { ok: false, error: "missing_proposal_id" });
  });

  test("invalid proposalId format returns invalid_proposal", async () => {
    const result = await getProposalDeliveryHistory(
      { companyId: COMPANY_ID, proposalId: "not-a-uuid" },
      historyDeps()
    );

    assert.deepEqual(result, { ok: false, error: "invalid_proposal" });
  });

  test("proposal not found returns invalid_proposal", async () => {
    const result = await getProposalDeliveryHistory(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID },
      historyDeps({
        getProposal: async () => null,
      })
    );

    assert.deepEqual(result, { ok: false, error: "invalid_proposal" });
  });

  test("jobId mismatch returns invalid_proposal", async () => {
    const result = await getProposalDeliveryHistory(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, jobId: OTHER_JOB_ID },
      historyDeps()
    );

    assert.deepEqual(result, { ok: false, error: "invalid_proposal" });
  });

  test("invalid jobId format returns invalid_proposal", async () => {
    const result = await getProposalDeliveryHistory(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, jobId: "bad-job" },
      historyDeps()
    );

    assert.deepEqual(result, { ok: false, error: "invalid_proposal" });
  });

  test("no attempts returns ok true with empty history VM", async () => {
    const result = await getProposalDeliveryHistory(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, jobId: JOB_ID },
      historyDeps()
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.history.isEmpty, true);
    assert.equal(result.history.latest, null);
    assert.deepEqual(result.history.history, []);
    assert.equal(result.history.totalCount, 0);
  });

  test("one provider_accepted attempt returns accepted VM", async () => {
    const result = await getProposalDeliveryHistory(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, jobId: JOB_ID },
      historyDeps({
        listDeliveryAttempts: async () => [deliveryRow()],
      })
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.history.isEmpty, false);
    assert.equal(result.history.totalCount, 1);
    assert.equal(result.history.latest?.resultCategory, "accepted");
    assert.equal(result.history.latest?.statusLabel, "Accepted by email provider");
    assert.equal(
      result.history.latest?.shortExplanation,
      PROPOSAL_DELIVERY_ATTEMPT_SHORT_EXPLANATIONS.provider_accepted
    );
    assert.match(
      result.history.latest?.shortExplanation ?? "",
      /does not confirm the customer received or opened/i
    );
  });

  test("failed attempt returns safe error only", async () => {
    const result = await getProposalDeliveryHistory(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, jobId: JOB_ID },
      historyDeps({
        listDeliveryAttempts: async () => [
          deliveryRow({
            status: "failed",
            error_message_safe: "Email provider rejected the request.",
            failed_at: "2026-06-26T12:10:00.000Z",
            provider_accepted_at: null,
          }),
        ],
      })
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.history.latest?.resultCategory, "failed");
    assert.equal(result.history.latest?.shortExplanation, "Email provider rejected the request.");
    assert.equal(result.history.latest?.safeError, "Email provider rejected the request.");
  });

  test("multiple attempts return newest-first history", async () => {
    const result = await getProposalDeliveryHistory(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, jobId: JOB_ID },
      historyDeps({
        listDeliveryAttempts: async () => [
          deliveryRow({
            id: "11111111-1111-4111-8111-111111111111",
            created_at: "2026-06-26T10:00:00.000Z",
            attempted_at: "2026-06-26T10:00:00.000Z",
            provider_accepted_at: "2026-06-26T10:05:00.000Z",
            subject_snapshot: "Older send",
          }),
          deliveryRow({
            id: "22222222-2222-4222-8222-222222222222",
            created_at: "2026-06-26T14:00:00.000Z",
            attempted_at: "2026-06-26T14:00:00.000Z",
            provider_accepted_at: "2026-06-26T14:05:00.000Z",
            subject_snapshot: "Newer send",
          }),
        ],
      })
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.history.totalCount, 2);
    assert.equal(result.history.latest?.subject, "Newer send");
    assert.equal(result.history.history[0]?.subject, "Newer send");
    assert.equal(result.history.history[1]?.subject, "Older send");
  });

  test("response serialization omits forbidden fields", async () => {
    const longBody = "x".repeat(200);
    const result = await getProposalDeliveryHistory(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, jobId: JOB_ID },
      historyDeps({
        listDeliveryAttempts: async () => [
          deliveryRow({ body_snapshot: longBody }),
        ],
      })
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assertForbiddenFieldsAbsent(result);
    assertForbiddenFieldsAbsent(result.history);
    assertForbiddenFieldsAbsent(result.history.latest);
    assert.ok(result.history.latest?.bodyPreview);
    assert.ok((result.history.latest?.bodyPreview?.length ?? 0) < longBody.length);
  });

  test("list helper receives company and proposal scope", async () => {
    const listCalls: Array<{ company_id: string; proposal_id: string }> = [];

    await getProposalDeliveryHistory(
      { companyId: COMPANY_ID, proposalId: PROPOSAL_ID, jobId: JOB_ID },
      historyDeps({
        listDeliveryAttempts: async (input) => {
          listCalls.push(input);
          return [];
        },
      })
    );

    assert.equal(listCalls.length, 1);
    assert.equal(listCalls[0]?.company_id, COMPANY_ID);
    assert.equal(listCalls[0]?.proposal_id, PROPOSAL_ID);
  });
});

describe("R18D3C2 delivery history guardrails", () => {
  test("server module is server-only and uses session client list helper", () => {
    const source = readFileSync(
      new URL("./proposalDeliveryHistory.server.ts", import.meta.url),
      "utf8"
    );

    assert.match(source, /import "server-only"/);
    assert.match(source, /getProposalDeliveryHistoryForContractor/);
    assert.match(source, /listProposalDeliveryAttemptsForProposalWithClient/);
    assert.match(source, /createClient/);
    assert.match(source, /getProposalById/);
    assert.doesNotMatch(source, /createAdminClient/);
    assert.doesNotMatch(source, /Resend|send_email|mintProposalPublicAccessToken/);
    assert.doesNotMatch(source, /proposal_events|jobs\.stage|proposals\.status/);
  });

  test("pure module has no route or supabase imports", () => {
    const source = readFileSync(
      new URL("./proposalDeliveryHistory.ts", import.meta.url),
      "utf8"
    );

    assert.match(source, /buildProposalDeliveryHistoryViewModel/);
    assert.doesNotMatch(source, /from "next\/server"/);
    assert.doesNotMatch(source, /from "@\/app\/lib\/supabase/);
    assert.doesNotMatch(source, /import .*Resend/);
  });

  test("api route requires auth and wires read handler only", () => {
    const source = readFileSync(
      new URL("../api/proposals/delivery-attempts/route.ts", import.meta.url),
      "utf8"
    );

    assert.match(source, /export async function GET/);
    assert.match(source, /getProposalDeliveryHistoryForContractor/);
    assert.match(source, /getUserCompanyId/);
    assert.match(source, /error: "unauthorized"/);
    assert.match(source, /searchParams\.get\("proposalId"\)/);
    assert.match(source, /searchParams\.get\("jobId"\)/);
    assert.doesNotMatch(source, /POST|sendProposalEmail|mintProposalPublicAccessToken/);
    assert.doesNotMatch(source, /token_hash|raw_token|rawToken|publicUrl/);
    assert.doesNotMatch(source, /createAdminClient/);
  });
});
