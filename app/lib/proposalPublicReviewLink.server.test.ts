/**
 * R18C4C — proposalPublicReviewLink tests.
 *
 * Run: npx tsx --test app/lib/proposalPublicReviewLink.server.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { generateProposalPublicAccessToken } from "@/app/lib/proposalPublicAccessTokenMint";
import {
  createPublicProposalReviewLink,
  PUBLIC_REVIEW_LINK_MINT_METADATA,
} from "@/app/lib/proposalPublicReviewLink";
import type { ProposalPublicAccessMintRequest } from "@/app/lib/proposalPublicAccessTokenMintPersistence";
import type { ProposalRecord } from "@/app/lib/proposalRecordTypes";
import { PUBLIC_REVIEW_MINT_ERROR_MESSAGE } from "@/app/lib/proposalPublicReviewReadiness";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const JOB_ID = "66666666-6666-4666-8666-666666666666";
const USER_ID = "77777777-7777-4777-8777-777777777777";
const SENT_VERSION_ID = "44444444-4444-4444-8444-444444444444";
const FIXED_NOW = new Date("2026-06-26T12:00:00.000Z");

function proposalRecord(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: PROPOSAL_ID,
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    customer_id: null,
    template_id: "88888888-8888-4888-8888-888888888888",
    status: "draft",
    current_draft_version_id: "99999999-9999-4999-8999-999999999999",
    latest_sent_version_id: SENT_VERSION_ID,
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
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("createPublicProposalReviewLink", () => {
  test("mints with latest sent version and returns publicUrl once", async () => {
    const rawToken = generateProposalPublicAccessToken();
    const mintCalls: ProposalPublicAccessMintRequest[] = [];

    const result = await createPublicProposalReviewLink(
      {
        companyId: COMPANY_ID,
        proposalId: PROPOSAL_ID,
        jobId: JOB_ID,
        userId: USER_ID,
        origin: "https://app.example.com",
      },
      {
        now: () => FIXED_NOW,
        getProposal: async () => proposalRecord(),
        mintToken: async (input) => {
          mintCalls.push(input);
          return {
            ok: true,
            raw_token: rawToken,
            token_prefix: rawToken.slice(0, 8),
            expires_at: "2099-12-31T23:59:59.000Z",
          };
        },
      }
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.publicUrl, `https://app.example.com/p/${encodeURIComponent(rawToken)}`);
    assert.equal(result.tokenPrefix, rawToken.slice(0, 8));
    assert.ok(!("token_hash" in result));
    assert.ok(!("raw_token" in result));

    assert.equal(mintCalls.length, 1);
    assert.equal(mintCalls[0]?.proposal_version_id, SENT_VERSION_ID);
    assert.deepEqual(mintCalls[0]?.metadata_json, PUBLIC_REVIEW_LINK_MINT_METADATA);
    assert.equal(mintCalls[0]?.created_by, USER_ID);
  });

  test("rejects missing sent snapshot", async () => {
    const result = await createPublicProposalReviewLink(
      {
        companyId: COMPANY_ID,
        proposalId: PROPOSAL_ID,
        jobId: JOB_ID,
        userId: USER_ID,
        origin: "https://app.example.com",
      },
      {
        getProposal: async () => proposalRecord({ latest_sent_version_id: null }),
        mintToken: async () => {
          throw new Error("mint should not be called");
        },
      }
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.message, PUBLIC_REVIEW_MINT_ERROR_MESSAGE);
  });

  test("rejects foreign proposal/job binding", async () => {
    const foreignJob = await createPublicProposalReviewLink(
      {
        companyId: COMPANY_ID,
        proposalId: PROPOSAL_ID,
        jobId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        userId: USER_ID,
        origin: "https://app.example.com",
      },
      {
        getProposal: async () => proposalRecord(),
        mintToken: async () => ({ ok: false, code: "binding_mismatch" }),
      }
    );

    assert.equal(foreignJob.ok, false);

    const missingProposal = await createPublicProposalReviewLink(
      {
        companyId: COMPANY_ID,
        proposalId: PROPOSAL_ID,
        jobId: JOB_ID,
        userId: USER_ID,
        origin: "https://app.example.com",
      },
      {
        getProposal: async () => null,
        mintToken: async () => ({ ok: false, code: "proposal_not_found" }),
      }
    );

    assert.equal(missingProposal.ok, false);
  });

  test("returns safe failure when mint fails", async () => {
    const result = await createPublicProposalReviewLink(
      {
        companyId: COMPANY_ID,
        proposalId: PROPOSAL_ID,
        jobId: JOB_ID,
        userId: USER_ID,
        origin: "https://app.example.com",
      },
      {
        getProposal: async () => proposalRecord(),
        mintToken: async () => ({ ok: false, code: "invalid_version_kind" }),
      }
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.message, PUBLIC_REVIEW_MINT_ERROR_MESSAGE);
  });
});

describe("proposalPublicReviewLink server guardrails", () => {
  test("server module is server-only and uses mint store", () => {
    const source = readFileSync(
      new URL("./proposalPublicReviewLink.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /import "server-only"/);
    assert.match(source, /mintProposalPublicAccessToken/);
    assert.doesNotMatch(source, /send_email|proposal_events|proposals\.status/);
  });

  test("api route does not expose token_hash or raw_token fields", () => {
    const source = readFileSync(
      new URL("../api/proposals/public-review-link/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /createPublicProposalReviewLinkForContractor/);
    assert.doesNotMatch(source, /token_hash|raw_token|rawToken/);
    assert.doesNotMatch(source, /send_email|\/api\/email/);
  });
});

describe("preview panel source guardrails", () => {
  test("preview panel lives on contractor preview only", () => {
    const previewClient = readFileSync(
      new URL(
        "../tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx",
        import.meta.url
      ),
      "utf8"
    );
    const panel = readFileSync(
      new URL(
        "../tools/roofing/proposals/preview/ProposalCustomerPreviewPublicAccessPanel.tsx",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(previewClient, /ProposalCustomerPreviewPublicAccessPanel/);
    assert.match(panel, /\/api\/proposals\/public-review-link/);
    assert.match(panel, /Open customer view/);
    assert.match(panel, /Copy review link/);
    assert.match(panel, /window\.open\(sessionLink\.publicUrl/);
    assert.doesNotMatch(panel, /createAdminClient|mintProposalPublicAccessToken/);
    assert.doesNotMatch(panel, /token_hash|raw_token|rawToken/);
    assert.doesNotMatch(panel, /onClick=\{[^}]*send/i);
  });

  test("builder does not include public access panel", () => {
    const builderClient = readFileSync(
      new URL(
        "../tools/roofing/proposals/builder/ProposalBuilderClient.tsx",
        import.meta.url
      ),
      "utf8"
    );
    assert.doesNotMatch(builderClient, /ProposalCustomerPreviewPublicAccessPanel/);
    assert.doesNotMatch(builderClient, /public-review-link/);
  });
});
