/**
 * Phase 10 Group B — contractor/customer authorization UX + API contracts.
 * Run: npx tsx --test app/lib/astraG9ScopeChangesGroupB.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildMintedJobScopeChangePublicAccessToken,
  buildPublicScopeChangeReviewUrl,
  hashJobScopeChangePublicAccessToken,
} from "./jobScopeChangePublicAccess";
import {
  canShowProposeScopeChangeCta,
  JOB_CARD_PROPOSE_SCOPE_CHANGE_LABEL,
} from "./jobScopeChangeViewModel";
import { scopeChangeRequiresCustomerSignature } from "./jobScopeChangeSignaturePolicy";
import {
  MINT_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1,
  RESOLVE_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1,
} from "./jobScopeChangeTypes";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const MIGRATION =
  "supabase/migrations/20260923210000_phase10_approved_scope_changes.sql";

describe("Astra G9 Group B — public access tokens (DB)", () => {
  const sql = read(MIGRATION);

  test("migration defines hash-only public access token table", () => {
    assert.match(
      sql,
      /create table if not exists public\.job_scope_change_public_access_tokens/
    );
    assert.match(sql, /token_hash text not null/);
    assert.doesNotMatch(
      sql,
      /job_scope_change_public_access_tokens[\s\S]{0,400}raw_token/
    );
  });

  test("mint + resolve RPCs exist with correct grants", () => {
    assert.match(
      sql,
      /create or replace function public\.mint_job_scope_change_public_access_token_v1/
    );
    assert.match(
      sql,
      /create or replace function public\.resolve_job_scope_change_public_access_token_v1/
    );
    assert.match(
      sql,
      /grant all on function public\.resolve_job_scope_change_public_access_token_v1\(text\) to service_role/
    );
    assert.doesNotMatch(
      sql,
      /grant all on function public\.resolve_job_scope_change_public_access_token_v1\(text\) to authenticated/
    );
  });

  test("authorize requires token_hash bound to scope change", () => {
    assert.match(
      sql,
      /authorize_job_scope_change_v1[\s\S]*?token_hash is REQUIRED/
    );
    assert.match(
      sql,
      /from public\.job_scope_change_public_access_tokens t[\s\S]*?t\.token_hash = v_token_hash/
    );
  });

  test("app helpers hash raw tokens and never invent HMAC app tokens", () => {
    const access = read("app/lib/jobScopeChangePublicAccess.ts");
    assert.match(access, /hashJobScopeChangePublicAccessToken/);
    assert.match(access, /buildMintedJobScopeChangePublicAccessToken/);
    assert.match(access, /buildPublicScopeChangeReviewUrl/);
    assert.equal(
      MINT_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1,
      "mint_job_scope_change_public_access_token_v1"
    );
    assert.equal(
      RESOLVE_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1,
      "resolve_job_scope_change_public_access_token_v1"
    );

    const minted = buildMintedJobScopeChangePublicAccessToken();
    assert.equal(minted.tokenHash.length, 64);
    assert.equal(
      minted.tokenHash,
      hashJobScopeChangePublicAccessToken(minted.rawToken)
    );
    assert.match(
      buildPublicScopeChangeReviewUrl("https://app.example.com", minted.rawToken),
      /^https:\/\/app\.example\.com\/scope-changes\//
    );
  });
});

describe("Astra G9 Group B — API routes", () => {
  test("contractor propose mints token and returns publicReviewUrl", () => {
    const route = read(
      "app/api/jobs/[jobId]/scope-changes/[scopeChangeId]/route.ts"
    );
    assert.match(route, /proposeJobScopeChangeViaRpc/);
    assert.match(route, /mintScopeChangePublicAccessTokenViaRpc/);
    assert.match(route, /buildMintedJobScopeChangePublicAccessToken/);
    assert.match(route, /publicReviewUrl/);
    assert.match(route, /proposal_author|JOB_SCOPE_CHANGE_AUTHOR_CAPABILITY/);
    assert.doesNotMatch(route, /mintScopeChangePublicTokenForChange/);
  });

  test("public GET resolves via hash; no client-trusted company_id", () => {
    const route = read("app/api/scope-changes/public/[token]/route.ts");
    assert.match(route, /resolveScopeChangePublicAccessTokenViaRpc/);
    assert.match(route, /createAdminClient/);
    assert.match(route, /raw_token: rawToken/);
    assert.doesNotMatch(route, /body\?\.companyId/);
  });

  test("public authorize hashes raw token and passes token_hash", () => {
    const route = read(
      "app/api/scope-changes/public/[token]/authorize/route.ts"
    );
    assert.match(route, /hashJobScopeChangePublicAccessToken/);
    assert.match(route, /token_hash: tokenHash/);
    assert.match(route, /authorizeJobScopeChangeViaRpc/);
    assert.match(route, /body\?\.companyId != null/);
    assert.match(route, /scopeChangeRequiresCustomerSignature/);
  });

  test("list + create routes exist under job scope-changes", () => {
    const list = read("app/api/jobs/[jobId]/scope-changes/route.ts");
    assert.match(list, /listScopeChangesForJob/);
    assert.match(list, /createJobScopeChangeViaRpc/);
    assert.match(list, /getUserCompanyId/);
    assert.match(list, /serializeScopeChangeLine/);
  });

  test("payment workspace prefers job_contract_total_cents_v1", () => {
    const payments = read(
      "app/api/jobs/[jobId]/payment-requests/route.ts"
    );
    assert.match(payments, /fetchJobContractTotalCents/);
    assert.match(payments, /currentContractTotalCents/);
    const workspace = read("app/lib/jobPaymentWorkspace.ts");
    assert.match(workspace, /currentContractTotalCents/);
  });
});

describe("Astra G9 Group B — UX surfaces", () => {
  test("Propose scope change CTA label and eligibility", () => {
    assert.equal(JOB_CARD_PROPOSE_SCOPE_CHANGE_LABEL, "Propose scope change");
    assert.equal(
      canShowProposeScopeChangeCta({
        hasAcceptedAgreement: true,
        canAuthor: true,
        jobStage: "scheduled",
        jobDisposition: "active",
      }),
      true
    );
    assert.equal(
      canShowProposeScopeChangeCta({
        hasAcceptedAgreement: true,
        canAuthor: true,
        jobStage: "complete",
        jobDisposition: "active",
      }),
      false
    );
    assert.equal(
      canShowProposeScopeChangeCta({
        hasAcceptedAgreement: true,
        canAuthor: true,
        jobStage: "scheduled",
        jobDisposition: "lost",
      }),
      false
    );
  });

  test("Job Card Proposals tab hosts scope changes (no new tab)", () => {
    const tab = read("app/tools/roofing/jobCard/JobCardProposalsTab.tsx");
    assert.match(tab, /scopeChangesPanel/);
    const client = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.match(client, /JobCardScopeChangesPanel/);
    assert.match(client, /data-jobcard-propose-scope-change|Propose scope change|JOB_CARD_PROPOSE_SCOPE_CHANGE|canAuthorProposals/);
    assert.match(client, /authorizedChangeSummaries/);
    assert.match(client, /pendingProposedSummaries/);
    assert.doesNotMatch(client, /tabId=\"scope-changes\"/);
  });

  test("scope changes panel exposes Propose CTA and editor actions", () => {
    const panel = read(
      "app/tools/roofing/jobCard/JobCardScopeChangesPanel.tsx"
    );
    assert.match(panel, /data-jobcard-propose-scope-change/);
    assert.match(panel, /data-scope-change-draft-editor/);
    assert.match(panel, /data-scope-change-line-quantity/);
    assert.match(panel, /data-scope-change-line-unit/);
    assert.match(panel, /data-scope-change-line-delta/);
    assert.match(panel, /data-scope-change-propose/);
    assert.match(panel, /data-scope-change-save/);
    assert.match(panel, /data-scope-change-void/);
  });

  test("public review page shows approve + optional signature policy", () => {
    const page = read("app/scope-changes/[token]/page.tsx");
    assert.match(page, /PublicScopeChangeReviewClient/);
    const client = read(
      "app/scope-changes/[token]/PublicScopeChangeReviewClient.tsx"
    );
    assert.match(client, /data-scope-change-public-review/);
    assert.match(client, /data-scope-change-approve/);
    assert.match(client, /Approve scope change/);
    assert.match(client, /signatureRequired/);
    assert.equal(scopeChangeRequiresCustomerSignature({}), false);
  });

  test("public financial_conflict blocks ordinary Approve CTA", () => {
    const client = read(
      "app/scope-changes/[token]/PublicScopeChangeReviewClient.tsx"
    );
    assert.match(client, /financial_conflict/);
    assert.match(client, /data-scope-change-financial-review/);
    assert.match(client, /data-scope-change-authorization-blocked/);
    assert.match(client, /can’t be approved online yet/);
    assert.match(client, /data-scope-change-approve-recheck/);
    // The recheck control re-submits authorization, so it must say so.
    assert.match(client, /Try approving again/);
    assert.doesNotMatch(client, /Check again/);
    assert.doesNotMatch(client, /server decides/);
    // Ordinary Approve must not remain the active CTA while financialReview is set.
    assert.match(
      client,
      /financialReview \? \([\s\S]*can’t be approved online yet[\s\S]*\) : \([\s\S]*data-scope-change-approve/
    );
  });

  test("persistence authorize payload includes token_hash", () => {
    const persist = read("app/lib/jobScopeChangePersistence.ts");
    assert.match(persist, /token_hash: tokenHash/);
    assert.match(persist, /mintScopeChangePublicAccessTokenViaRpc/);
    assert.match(persist, /resolveScopeChangePublicAccessTokenViaRpc/);
  });
});
