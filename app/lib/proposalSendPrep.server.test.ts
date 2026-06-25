/**
 * R18D2 — proposalSendPrep tests.
 *
 * Run: npx tsx --test app/lib/proposalSendPrep.server.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { generateProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessTokenMint";
import type { ProposalPublicAccessMintRequest } from "@/app/lib/proposalPublicAccessTokenMintPersistence";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";
import type { ProposalDraftGraph } from "@/app/lib/proposalRecordStore";
import {
  hashNormalizedRecipientEmailSha256,
  needsSendPrepRefreeze,
  normalizeRecipientEmail,
  prepareProposalCustomerSendLink,
  SEND_PREP_FREEZE_UNAVAILABLE_MESSAGE,
  SEND_PREP_MINT_METADATA,
  SEND_PREP_MISSING_RECIPIENT_MESSAGE,
  SEND_PREP_READINESS_BLOCKED_MESSAGE,
} from "@/app/lib/proposalSendPrep";

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
const FIXED_NOW = new Date("2026-06-26T12:00:00.000Z");
const RECIPIENT_EMAIL = "jane@example.com";

function proposalRecord(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: PROPOSAL_ID,
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    customer_id: null,
    template_id: TEMPLATE_ID,
    status: "draft",
    current_draft_version_id: DRAFT_VERSION_ID,
    latest_sent_version_id: null,
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

function baseInput(overrides: Partial<Parameters<typeof prepareProposalCustomerSendLink>[0]> = {}) {
  return {
    companyId: COMPANY_ID,
    proposalId: PROPOSAL_ID,
    jobId: JOB_ID,
    userId: USER_ID,
    origin: "https://app.example.com",
    recipientEmail: RECIPIENT_EMAIL,
    ...overrides,
  };
}

describe("needsSendPrepRefreeze", () => {
  test("returns true when no sent snapshot exists", () => {
    assert.equal(
      needsSendPrepRefreeze({
        hasSentSnapshot: false,
        hasSignedSnapshot: false,
        draftUpdatedAt: "2026-06-26T12:00:00.000Z",
        sentVersionFrozenAt: null,
        pricingStale: false,
      }),
      true
    );
  });

  test("returns false when signed snapshot exists", () => {
    assert.equal(
      needsSendPrepRefreeze({
        hasSentSnapshot: true,
        hasSignedSnapshot: true,
        draftUpdatedAt: "2026-06-27T12:00:00.000Z",
        sentVersionFrozenAt: "2026-06-26T12:00:00.000Z",
        pricingStale: true,
      }),
      false
    );
  });

  test("returns true when draft updated after frozen snapshot", () => {
    assert.equal(
      needsSendPrepRefreeze({
        hasSentSnapshot: true,
        hasSignedSnapshot: false,
        draftUpdatedAt: "2026-06-27T12:00:00.000Z",
        sentVersionFrozenAt: "2026-06-26T12:00:00.000Z",
        pricingStale: false,
      }),
      true
    );
  });

  test("returns true when pricing is stale", () => {
    assert.equal(
      needsSendPrepRefreeze({
        hasSentSnapshot: true,
        hasSignedSnapshot: false,
        draftUpdatedAt: "2026-06-26T12:00:00.000Z",
        sentVersionFrozenAt: "2026-06-26T12:00:00.000Z",
        pricingStale: true,
      }),
      true
    );
  });
});

describe("recipient email helpers", () => {
  test("normalizes lowercase trim and hashes recipient email", () => {
    assert.equal(normalizeRecipientEmail("  Jane@Example.COM "), "jane@example.com");
    assert.equal(
      hashNormalizedRecipientEmailSha256("  Jane@Example.COM "),
      hashNormalizedRecipientEmailSha256("jane@example.com")
    );
  });
});

describe("prepareProposalCustomerSendLink", () => {
  test("creates snapshot when none exists, then mints customer link", async () => {
    const rawToken = generateProposalPublicAccessToken();
    const freezeCalls: Array<{ companyId: string; proposalId: string }> = [];
    const mintCalls: ProposalPublicAccessMintRequest[] = [];
    let proposal = proposalRecord();

    const result = await prepareProposalCustomerSendLink(baseInput(), {
      now: () => FIXED_NOW,
      isFreezeEnabled: () => true,
      getProposal: async () => proposal,
      getDraftGraph: async () => readyDraftGraph({ proposal }),
      getSentVersionFrozenAt: async () => null,
      freezeDraft: async (input) => {
        freezeCalls.push(input);
        proposal = proposalRecord({
          latest_sent_version_id: SENT_VERSION_ID,
          updated_at: "2026-06-26T12:00:00.000Z",
        });
        return { sentVersionId: SENT_VERSION_ID };
      },
      mintToken: async (input) => {
        mintCalls.push(input);
        return {
          ok: true,
          raw_token: rawToken,
          token_prefix: rawToken.slice(0, 8),
          expires_at: "2099-12-31T23:59:59.000Z",
        };
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.snapshotStatus, "created");
    assert.equal(result.deliveryEnabled, false);
    assert.equal(result.publicUrl, `https://app.example.com/p/${encodeURIComponent(rawToken)}`);
    assert.equal(freezeCalls.length, 1);
    assert.equal(mintCalls.length, 1);
    assert.equal(mintCalls[0]?.proposal_version_id, SENT_VERSION_ID);
    assert.equal(mintCalls[0]?.recipient_email_hash, hashNormalizedRecipientEmailSha256(RECIPIENT_EMAIL));
    assert.deepEqual(mintCalls[0]?.metadata_json, SEND_PREP_MINT_METADATA);
    assert.ok(!("raw_token" in result));
    assert.ok(!("token_hash" in result));
  });

  test("reuses fresh sent snapshot without freeze", async () => {
    const rawToken = generateProposalPublicAccessToken();
    const mintCalls: ProposalPublicAccessMintRequest[] = [];

    const result = await prepareProposalCustomerSendLink(baseInput(), {
      isFreezeEnabled: () => true,
      getProposal: async () =>
        proposalRecord({
          latest_sent_version_id: SENT_VERSION_ID,
          updated_at: "2026-06-26T12:00:00.000Z",
        }),
      getDraftGraph: async () =>
        readyDraftGraph({
          proposal: proposalRecord({
            latest_sent_version_id: SENT_VERSION_ID,
            updated_at: "2026-06-26T12:00:00.000Z",
          }),
        }),
      getSentVersionFrozenAt: async () => "2026-06-26T12:00:00.000Z",
      freezeDraft: async () => {
        throw new Error("freeze should not be called");
      },
      mintToken: async (input) => {
        mintCalls.push(input);
        return {
          ok: true,
          raw_token: rawToken,
          token_prefix: rawToken.slice(0, 8),
          expires_at: "2099-12-31T23:59:59.000Z",
        };
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.snapshotStatus, "reused");
    assert.equal(mintCalls.length, 1);
    assert.equal(mintCalls[0]?.proposal_version_id, SENT_VERSION_ID);
  });

  test("refreezes stale sent snapshot when draft updated after frozen_at", async () => {
    const rawToken = generateProposalPublicAccessToken();
    const freezeCalls: unknown[] = [];
    let proposal = proposalRecord({
      latest_sent_version_id: SENT_VERSION_ID,
      updated_at: "2026-06-27T12:00:00.000Z",
    });

    const result = await prepareProposalCustomerSendLink(baseInput(), {
      isFreezeEnabled: () => true,
      getProposal: async () => proposal,
      getDraftGraph: async () =>
        readyDraftGraph({
          proposal,
        }),
      getSentVersionFrozenAt: async () => "2026-06-26T12:00:00.000Z",
      freezeDraft: async (input) => {
        freezeCalls.push(input);
        proposal = proposalRecord({
          latest_sent_version_id: "55555555-5555-4555-8555-555555555555",
          updated_at: "2026-06-27T12:00:00.000Z",
        });
        return { sentVersionId: "55555555-5555-4555-8555-555555555555" };
      },
      mintToken: async () => ({
        ok: true,
        raw_token: rawToken,
        token_prefix: rawToken.slice(0, 8),
        expires_at: "2099-12-31T23:59:59.000Z",
      }),
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.snapshotStatus, "refrozen");
    assert.equal(freezeCalls.length, 1);
  });

  test("refreezes when pricing is stale", async () => {
    const freezeCalls: unknown[] = [];
    let proposal = proposalRecord({
      latest_sent_version_id: SENT_VERSION_ID,
      updated_at: "2026-06-26T12:00:00.000Z",
    });

    const result = await prepareProposalCustomerSendLink(
      baseInput({ pricingStale: true }),
      {
        isFreezeEnabled: () => true,
        getProposal: async () => proposal,
        getDraftGraph: async () => readyDraftGraph({ proposal }),
        getSentVersionFrozenAt: async () => "2026-06-26T12:00:00.000Z",
        freezeDraft: async () => {
          freezeCalls.push(true);
          proposal = proposalRecord({
            latest_sent_version_id: "55555555-5555-4555-8555-555555555555",
          });
          return { sentVersionId: "55555555-5555-4555-8555-555555555555" };
        },
        mintToken: async () => ({
          ok: true,
          raw_token: generateProposalPublicAccessToken(),
          token_prefix: "abcd1234",
          expires_at: "2099-12-31T23:59:59.000Z",
        }),
      }
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.snapshotStatus, "refrozen");
    assert.equal(freezeCalls.length, 1);
  });

  test("fails safely when freeze env gate is unavailable", async () => {
    const result = await prepareProposalCustomerSendLink(baseInput(), {
      isFreezeEnabled: () => false,
      getProposal: async () => proposalRecord(),
      getDraftGraph: async () => readyDraftGraph(),
      getSentVersionFrozenAt: async () => null,
      freezeDraft: async () => {
        throw new Error("freeze should not be called");
      },
      mintToken: async () => {
        throw new Error("mint should not be called");
      },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.message, SEND_PREP_FREEZE_UNAVAILABLE_MESSAGE);
  });

  test("blocks when readiness is not satisfied", async () => {
    const result = await prepareProposalCustomerSendLink(baseInput(), {
      isFreezeEnabled: () => true,
      getProposal: async () => proposalRecord(),
      getDraftGraph: async () =>
        readyDraftGraph({
          options: [
            {
              ...readyDraftGraph().options[0]!,
              pricing_complete: false,
              blocking_line_count: 2,
            },
          ],
        }),
      getSentVersionFrozenAt: async () => null,
      freezeDraft: async () => {
        throw new Error("freeze should not be called");
      },
      mintToken: async () => {
        throw new Error("mint should not be called");
      },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.message, SEND_PREP_READINESS_BLOCKED_MESSAGE);
  });

  test("rejects missing or invalid recipient email", async () => {
    const missing = await prepareProposalCustomerSendLink(baseInput({ recipientEmail: "" }), {
      isFreezeEnabled: () => true,
      getProposal: async () => proposalRecord(),
      getDraftGraph: async () => readyDraftGraph(),
      getSentVersionFrozenAt: async () => null,
      freezeDraft: async () => ({ sentVersionId: SENT_VERSION_ID }),
      mintToken: async () => ({
        ok: true,
        raw_token: generateProposalPublicAccessToken(),
        token_prefix: "abcd1234",
        expires_at: "2099-12-31T23:59:59.000Z",
      }),
    });

    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.message, SEND_PREP_MISSING_RECIPIENT_MESSAGE);

    const invalid = await prepareProposalCustomerSendLink(
      baseInput({ recipientEmail: "not-an-email" }),
      {
        isFreezeEnabled: () => true,
        getProposal: async () => proposalRecord(),
        getDraftGraph: async () => readyDraftGraph(),
        getSentVersionFrozenAt: async () => null,
        freezeDraft: async () => ({ sentVersionId: SENT_VERSION_ID }),
        mintToken: async () => ({
          ok: true,
          raw_token: generateProposalPublicAccessToken(),
          token_prefix: "abcd1234",
          expires_at: "2099-12-31T23:59:59.000Z",
        }),
      }
    );

    assert.equal(invalid.ok, false);
    if (invalid.ok) return;
    assert.equal(invalid.message, SEND_PREP_MISSING_RECIPIENT_MESSAGE);
  });

  test("does not place raw email in mint metadata", async () => {
    const mintCalls: ProposalPublicAccessMintRequest[] = [];
    let proposal = proposalRecord();

    await prepareProposalCustomerSendLink(baseInput(), {
      isFreezeEnabled: () => true,
      getProposal: async () => proposal,
      getDraftGraph: async () => readyDraftGraph({ proposal }),
      getSentVersionFrozenAt: async () => null,
      freezeDraft: async () => {
        proposal = proposalRecord({ latest_sent_version_id: SENT_VERSION_ID });
        return { sentVersionId: SENT_VERSION_ID };
      },
      mintToken: async (input) => {
        mintCalls.push(input);
        return {
          ok: true,
          raw_token: generateProposalPublicAccessToken(),
          token_prefix: "abcd1234",
          expires_at: "2099-12-31T23:59:59.000Z",
        };
      },
    });

    assert.equal(mintCalls.length, 1);
    const metadata = JSON.stringify(mintCalls[0]?.metadata_json ?? {});
    assert.doesNotMatch(metadata, /jane@example.com/i);
    assert.equal(mintCalls[0]?.recipient_email_hash, hashNormalizedRecipientEmailSha256(RECIPIENT_EMAIL));
  });
});

describe("R18D2 send prep guardrails", () => {
  test("server module is server-only and wires freeze + mint", () => {
    const source = readFileSync(
      new URL("./proposalSendPrep.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /import "server-only"/);
    assert.match(source, /freezeDraftToSentSnapshot/);
    assert.match(source, /mintProposalPublicAccessToken/);
    assert.doesNotMatch(source, /send_email|Resend|proposals\.status\s*=\s*["']sent["']/);
    assert.doesNotMatch(source, /event_type.*sent/);
  });

  test("api route does not expose forbidden fields", () => {
    const source = readFileSync(
      new URL("../api/proposals/send-prep/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /prepareProposalCustomerSendLinkForContractor/);
    assert.doesNotMatch(source, /token_hash|raw_token|rawToken/);
    assert.doesNotMatch(source, /send_email|\/approve\//);
  });

  test("send gate panel uses send-prep route without forbidden imports", () => {
    const panel = readFileSync(
      new URL(
        "../tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(panel, /SEND_GATE_PREPARE_CUSTOMER_LINK_LABEL/);
    assert.match(panel, /\/api\/proposals\/send-prep/);
    assert.match(panel, /Open customer proposal/);
    assert.match(panel, /Copy customer send link/);
    assert.match(panel, /Send proposal/);
    assert.doesNotMatch(panel, /localStorage/);
    assert.doesNotMatch(panel, /token_hash|raw_token|rawToken/);
    assert.doesNotMatch(panel, /freezeDraftToSentSnapshot|mintProposalPublicAccessToken/);
    assert.doesNotMatch(panel, /Resend|send_email/);
  });
});
