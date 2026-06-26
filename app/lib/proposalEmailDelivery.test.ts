/**
 * R18D3B — proposalEmailDelivery tests.
 *
 * Run: npx tsx --test app/lib/proposalEmailDelivery.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { generateProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessTokenMint";
import type { ProposalPublicAccessMintRequest } from "@/app/lib/proposalPublicAccessTokenMintPersistence";
import type { ProposalDeliveryAttemptRow } from "@/app/lib/proposalDeliveryAttemptTypes";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import {
  buildProposalEmailContentHash,
  buildProposalEmailSendIdempotencyKey,
  EMAIL_SEND_ATTEMPT_METADATA,
  EMAIL_SEND_MINT_METADATA,
  mapResendErrorToSafeMessage,
  PROPOSAL_EMAIL_SEND_IN_PROGRESS_MESSAGE,
  PROPOSAL_EMAIL_SEND_NOT_CONFIGURED_MESSAGE,
  PROPOSAL_EMAIL_SEND_PERSIST_PENDING_MESSAGE,
  sendProposalEmail,
  type SendProposalEmailDeps,
} from "./proposalEmailDelivery";
import { hashNormalizedRecipientEmailSha256 } from "./proposalSendPrep";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const JOB_ID = "66666666-6666-4666-8666-666666666666";
const USER_ID = "77777777-7777-4777-8777-777777777777";
const DRAFT_VERSION_ID = "99999999-9999-4999-8999-999999999999";
const SENT_VERSION_ID = "44444444-4444-4444-8444-444444444444";
const TEMPLATE_ID = "88888888-8888-4888-8888-888888888888";
const TEMPLATE_OPT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RUNTIME_OPT_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PAGE_ESTIMATE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PAGE_OVERVIEW = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ATTEMPT_ID = "55555555-5555-4555-8555-555555555555";
const TOKEN_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const RECIPIENT_EMAIL = "jane@example.com";
const SUBJECT = "Your proposal from Summit Roofing";
const BODY = "Hi Jane,\n\nPlease review your proposal.";
const ORIGIN = "https://app.example.com";

function proposalRecord(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: PROPOSAL_ID,
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    customer_id: null,
    template_id: TEMPLATE_ID,
    status: "draft",
    current_draft_version_id: DRAFT_VERSION_ID,
    latest_sent_version_id: SENT_VERSION_ID,
    signed_version_id: null,
    selected_option_id: RUNTIME_OPT_A,
    measurement_record_id: null,
    pricing_policy_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    proposal_number: null,
    title: "Roof Replacement",
    created_by: null,
    updated_by: null,
    created_at: "2026-06-26T12:00:00.000Z",
    updated_at: "2026-06-26T12:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function readyDraftGraph(overrides: Partial<ProposalDraftGraph> = {}): ProposalDraftGraph {
  return {
    proposal: proposalRecord(overrides.proposal),
    version: {
      id: DRAFT_VERSION_ID,
      company_id: COMPANY_ID,
      proposal_id: PROPOSAL_ID,
      version_number: 1,
      version_kind: "draft",
      parent_version_id: null,
      frozen_at: null,
      context_echo: {
        customer_name: "Jane Doe",
        company_name: "Summit Roofing",
        address_formatted: "123 Main St",
        customer_email: RECIPIENT_EMAIL,
      },
      policy_echo: { configured: true },
      created_by: null,
      created_at: "2026-06-26T12:00:00.000Z",
      ...(overrides.version ?? {}),
    },
    pages: [
      {
        id: PAGE_OVERVIEW,
        company_id: COMPANY_ID,
        proposal_version_id: DRAFT_VERSION_ID,
        page_type: "project_overview",
        sort_order: 10,
        title: "Overview",
        customer_title: null,
        visible_to_customer: true,
        source_template_section_id: null,
        content_json: { body_markdown: "Hello" },
        settings_json: {},
        created_at: "2026-06-26T12:00:00.000Z",
        updated_at: "2026-06-26T12:00:00.000Z",
      },
      {
        id: PAGE_ESTIMATE,
        company_id: COMPANY_ID,
        proposal_version_id: DRAFT_VERSION_ID,
        page_type: "estimate",
        sort_order: 15,
        title: "Estimate",
        customer_title: "Your Estimate",
        visible_to_customer: true,
        source_template_section_id: null,
        content_json: {},
        settings_json: { show_line_prices: false, show_option_totals: true },
        created_at: "2026-06-26T12:00:00.000Z",
        updated_at: "2026-06-26T12:00:00.000Z",
      },
    ],
    options: [
      {
        id: RUNTIME_OPT_A,
        company_id: COMPANY_ID,
        proposal_version_id: DRAFT_VERSION_ID,
        source_template_option_id: TEMPLATE_OPT_A,
        name: "Option A",
        customer_label: "Good",
        sort_order: 0,
        is_default: true,
        visible_to_customer: true,
        customer_subtotal_cents: 10000,
        discount_cents: 0,
        sales_tax_cents: 800,
        customer_total_cents: 10800,
        pricing_complete: true,
        blocking_line_count: 0,
        guardrail_outcome: "pass",
        selected_at: null,
        created_at: "2026-06-26T12:00:00.000Z",
        updated_at: "2026-06-26T12:00:00.000Z",
      },
    ],
    lineItems: [],
    internalSummaries: [],
    scopeDecisions: [],
    ...overrides,
  };
}

function baseInput() {
  return {
    companyId: COMPANY_ID,
    proposalId: PROPOSAL_ID,
    jobId: JOB_ID,
    userId: USER_ID,
    recipientEmail: RECIPIENT_EMAIL,
    subject: SUBJECT,
    body: BODY,
    origin: ORIGIN,
  };
}

function attemptRow(overrides: Partial<ProposalDeliveryAttemptRow> = {}): ProposalDeliveryAttemptRow {
  const recipientHash = hashNormalizedRecipientEmailSha256(RECIPIENT_EMAIL);
  const idempotencyKey = buildProposalEmailSendIdempotencyKey({
    proposalId: PROPOSAL_ID,
    proposalVersionId: SENT_VERSION_ID,
    recipientEmailHash: recipientHash,
    subject: SUBJECT,
    body: BODY,
  });

  return {
    id: ATTEMPT_ID,
    company_id: COMPANY_ID,
    proposal_id: PROPOSAL_ID,
    proposal_version_id: SENT_VERSION_ID,
    proposal_public_access_token_id: TOKEN_ID,
    channel: "email",
    provider: "resend",
    recipient_email_hash: recipientHash,
    recipient_email_redacted: "j***@example.com",
    token_prefix: "fd_pabc1",
    idempotency_key: idempotencyKey,
    status: "attempted",
    subject_snapshot: SUBJECT,
    body_snapshot: BODY,
    provider_message_id: null,
    error_code: null,
    error_message_safe: null,
    metadata_json: EMAIL_SEND_ATTEMPT_METADATA,
    created_by: USER_ID,
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

function buildDeps(overrides: Partial<SendProposalEmailDeps> = {}): SendProposalEmailDeps {
  const rawToken = generateProposalPublicAccessToken();
  const mintCalls: ProposalPublicAccessMintRequest[] = [];
  const resendCalls: Array<{ idempotencyKey: string; to: string }> = [];

  return {
    getProposal: async () => proposalRecord(),
    getDraftGraph: async () => readyDraftGraph(),
    getSentVersionFrozenAt: async () => "2026-06-26T12:00:00.000Z",
    freezeDraft: async () => ({ sentVersionId: SENT_VERSION_ID }),
    isFreezeEnabled: () => true,
    mintToken: async (input) => {
      mintCalls.push(input);
      return {
        ok: true,
        raw_token: rawToken,
        token_prefix: rawToken.slice(0, 8),
        expires_at: "2099-12-31T23:59:59.000Z",
        token_id: TOKEN_ID,
      };
    },
    getEmailConfig: () => ({
      resendApiKey: "re_test_key",
      resendFrom: "noreply@example.com",
      origin: ORIGIN,
      replyTo: "contractor@example.com",
    }),
    createDeliveryAttempt: async (input) =>
      attemptRow({
        id: ATTEMPT_ID,
        idempotency_key: input.idempotency_key,
        status: "attempted",
      }),
    findDeliveryAttemptByIdempotencyKey: async () => null,
    markDeliveryAttemptProviderAccepted: async (input) =>
      attemptRow({
        status: "provider_accepted",
        provider_message_id: input.provider_message_id,
        idempotency_key: input.idempotency_key,
      }),
    markDeliveryAttemptFailed: async (input) =>
      attemptRow({
        id: input.attempt_id ?? ATTEMPT_ID,
        status: "failed",
        error_code: input.error_code ?? null,
        error_message_safe: input.error_message_safe,
      }),
    sendResendEmail: async (input) => {
      resendCalls.push({ idempotencyKey: input.idempotencyKey, to: input.to });
      return { ok: true, messageId: "resend-msg-123" };
    },
    isDuplicateIdempotencyError: () => false,
    ...overrides,
  };
}

describe("buildProposalEmailSendIdempotencyKey", () => {
  test("builds stable key under 256 chars", () => {
    const recipientHash = hashNormalizedRecipientEmailSha256(RECIPIENT_EMAIL);
    const key = buildProposalEmailSendIdempotencyKey({
      proposalId: PROPOSAL_ID,
      proposalVersionId: SENT_VERSION_ID,
      recipientEmailHash: recipientHash,
      subject: SUBJECT,
      body: BODY,
    });

    assert.match(key, /^prop-email-send\/v1\//);
    assert.ok(key.length <= 256);
    assert.equal(
      key,
      buildProposalEmailSendIdempotencyKey({
        proposalId: PROPOSAL_ID,
        proposalVersionId: SENT_VERSION_ID,
        recipientEmailHash: recipientHash,
        subject: SUBJECT,
        body: BODY,
      })
    );
  });

  test("content hash changes when subject or body changes", () => {
    const recipientHash = hashNormalizedRecipientEmailSha256(RECIPIENT_EMAIL);
    const base = buildProposalEmailSendIdempotencyKey({
      proposalId: PROPOSAL_ID,
      proposalVersionId: SENT_VERSION_ID,
      recipientEmailHash: recipientHash,
      subject: SUBJECT,
      body: BODY,
    });
    const changed = buildProposalEmailSendIdempotencyKey({
      proposalId: PROPOSAL_ID,
      proposalVersionId: SENT_VERSION_ID,
      recipientEmailHash: recipientHash,
      subject: "Different subject",
      body: BODY,
    });
    assert.notEqual(base, changed);
    assert.equal(
      buildProposalEmailContentHash(SUBJECT, BODY),
      buildProposalEmailContentHash(`  ${SUBJECT}  `, `  ${BODY}  `)
    );
  });
});

describe("sendProposalEmail orchestrator", () => {
  test("happy path: snapshot reuse, mint, attempt, resend, provider_accepted", async () => {
    const mintCalls: ProposalPublicAccessMintRequest[] = [];
    const createCalls: unknown[] = [];
    const resendCalls: string[] = [];

    const deps = buildDeps({
      mintToken: async (input) => {
        mintCalls.push(input);
        const rawToken = generateProposalPublicAccessToken();
        return {
          ok: true,
          raw_token: rawToken,
          token_prefix: rawToken.slice(0, 8),
          expires_at: "2099-12-31T23:59:59.000Z",
          token_id: TOKEN_ID,
        };
      },
      createDeliveryAttempt: async (input) => {
        createCalls.push(input);
        return attemptRow({ idempotency_key: input.idempotency_key });
      },
      sendResendEmail: async (input) => {
        resendCalls.push(input.idempotencyKey);
        return { ok: true, messageId: "resend-msg-123" };
      },
    });

    const result = await sendProposalEmail(baseInput(), deps);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.deliveryStatus, "provider_accepted");
    assert.equal(result.deliveryEnabled, true);
    assert.match(result.recipientDisplay, /\*/);
    assert.equal(mintCalls.length, 1);
    assert.deepEqual(mintCalls[0]?.metadata_json, EMAIL_SEND_MINT_METADATA);
    assert.equal(mintCalls[0]?.metadata_json.source, "contractor_email_send");
    assert.equal(mintCalls[0]?.metadata_json.channel, "customer_email");
    assert.equal(createCalls.length, 1);
    assert.equal(resendCalls.length, 1);
    assert.equal(resendCalls[0], (createCalls[0] as { idempotency_key: string }).idempotency_key);
    assert.ok(!("raw_token" in result));
    assert.ok(!("rawToken" in result));
    assert.ok(!("token_hash" in result));
    assert.ok(!("publicUrl" in result));
  });

  test("returns existing success for duplicate idempotency after provider_accepted", async () => {
    const accepted = attemptRow({ status: "provider_accepted", provider_message_id: "msg-1" });
    const deps = buildDeps({
      findDeliveryAttemptByIdempotencyKey: async () => accepted,
      mintToken: async () => {
        throw new Error("mint should not run");
      },
      createDeliveryAttempt: async () => {
        throw new Error("create should not run");
      },
      sendResendEmail: async () => {
        throw new Error("resend should not run");
      },
    });

    const result = await sendProposalEmail(baseInput(), deps);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.deliveryAttemptId, accepted.id);
  });

  test("blocks duplicate click while attempt is in flight", async () => {
    const inFlight = attemptRow({ status: "attempted" });
    const deps = buildDeps({
      findDeliveryAttemptByIdempotencyKey: async () => inFlight,
    });

    const result = await sendProposalEmail(baseInput(), deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "send_in_progress");
    assert.equal(result.message, PROPOSAL_EMAIL_SEND_IN_PROGRESS_MESSAGE);
  });

  test("retries failed attempt with retry suffix idempotency key", async () => {
    const failed = attemptRow({ status: "failed", id: "failed-attempt-id" });
    const createdKeys: string[] = [];

    const deps = buildDeps({
      findDeliveryAttemptByIdempotencyKey: async ({ idempotency_key }) => {
        if (createdKeys.includes(idempotency_key)) {
          return null;
        }
        return failed;
      },
      createDeliveryAttempt: async (input) => {
        createdKeys.push(input.idempotency_key);
        return attemptRow({ idempotency_key: input.idempotency_key });
      },
    });

    const result = await sendProposalEmail(baseInput(), deps);
    assert.equal(result.ok, true);
    assert.match(createdKeys[0] ?? "", /\/retry\/failed-attempt-id$/);
  });

  test("marks attempt failed when Resend returns error", async () => {
    const deps = buildDeps({
      sendResendEmail: async () => ({
        ok: false,
        code: "email_provider_rejected",
        message: "Provider rejected",
      }),
    });

    const result = await sendProposalEmail(baseInput(), deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.deliveryStatus, "failed");
    assert.equal(result.deliveryAttemptId, ATTEMPT_ID);
  });

  test("returns persist pending when Resend succeeds but DB update fails", async () => {
    const deps = buildDeps({
      markDeliveryAttemptProviderAccepted: async () => {
        throw new Error("db update failed");
      },
    });

    const result = await sendProposalEmail(baseInput(), deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "provider_accepted_persist_pending");
    assert.equal(result.message, PROPOSAL_EMAIL_SEND_PERSIST_PENDING_MESSAGE);
    assert.equal(result.deliveryAttemptId, ATTEMPT_ID);
  });

  test("fails when email delivery is not configured", async () => {
    const deps = buildDeps({
      getEmailConfig: () => null,
    });

    const result = await sendProposalEmail(baseInput(), deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "email_delivery_not_configured");
    assert.equal(result.message, PROPOSAL_EMAIL_SEND_NOT_CONFIGURED_MESSAGE);
  });

  test("attempt insert metadata uses r18d3b source", async () => {
    const createCalls: Array<{ metadata_json: Record<string, unknown> }> = [];
    const deps = buildDeps({
      createDeliveryAttempt: async (input) => {
        createCalls.push(input);
        return attemptRow({ idempotency_key: input.idempotency_key });
      },
    });

    await sendProposalEmail(baseInput(), deps);
    assert.deepEqual(createCalls[0]?.metadata_json, EMAIL_SEND_ATTEMPT_METADATA);
  });
});

describe("mapResendErrorToSafeMessage", () => {
  test("maps auth, domain, rate limit, and 5xx errors", () => {
    assert.equal(
      mapResendErrorToSafeMessage({ statusCode: 401, name: "invalid_api_key" }).code,
      "email_delivery_not_configured"
    );
    assert.equal(
      mapResendErrorToSafeMessage({
        statusCode: 403,
        message: "The domain is not verified",
      }).code,
      "email_delivery_domain_error"
    );
    assert.equal(
      mapResendErrorToSafeMessage({ statusCode: 429, name: "rate_limit_exceeded" }).code,
      "email_delivery_rate_limited"
    );
    assert.equal(
      mapResendErrorToSafeMessage({ statusCode: 503 }).code,
      "email_provider_unavailable"
    );
  });
});

describe("R18D3B email delivery guardrails", () => {
  test("pure module avoids legacy routes and lifecycle mutation", () => {
    const source = readFileSync(new URL("./proposalEmailDelivery.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /\/api\/estimate\/send|sendEstimateClient|\/approve\//);
    assert.doesNotMatch(source, /UPDATE public\.proposals|INSERT INTO public\.proposal_events|\.from\("jobs"\)/);
    assert.doesNotMatch(source, /raw_token.*return|return.*raw_token/);
  });
});
