/**
 * Phase 10 / Astra G9 — approved scope changes (persistence + field projection).
 * Run: npx tsx --test app/lib/astraG9ScopeChanges.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  capabilitiesForRole,
  hasCompanyCapability,
} from "./companyMembershipRoles";
import {
  buildApprovedChangesLabel,
  buildFieldBriefViewModel,
  buildPendingProposedWarning,
} from "./fieldBriefModel";
import { JOB_ACTIVITY_EVENT_TYPES } from "./jobLifecycleTypes";
import {
  buildScopeChangeTotalsDisplay,
  financialConflictDetail,
  financialConflictHeadline,
  isStaleBasis,
  jobContractTotalFromParts,
  scopeChangeFailureMessage,
  staleBasisDetail,
} from "./jobScopeChangeContract";
import {
  AUTHORIZE_JOB_SCOPE_CHANGE_RPC_V1,
  CREATE_JOB_SCOPE_CHANGE_RPC_V1,
  JOB_SCOPE_CHANGE_ACTIVITY_EVENT_TYPES,
  JOB_SCOPE_CHANGE_AUTHOR_CAPABILITY,
  JOB_SCOPE_CHANGE_ERROR_CODES,
  JOB_SCOPE_CHANGE_STATUSES,
  JOB_SCOPE_CHANGE_STATUS_LABELS,
  PROPOSE_JOB_SCOPE_CHANGE_RPC_V1,
  jobScopeChangeErrorLabel,
} from "./jobScopeChangeTypes";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const MIGRATION =
  "supabase/migrations/20260923210000_phase10_approved_scope_changes.sql";

describe("Astra G9 migration contracts", () => {
  const sql = read(MIGRATION);

  test("tables + one-proposed-per-job unique index", () => {
    assert.match(sql, /create table if not exists public\.job_scope_changes/);
    assert.match(sql, /create table if not exists public\.job_scope_change_lines/);
    assert.match(
      sql,
      /create table if not exists public\.job_scope_change_approvals/
    );
    assert.match(
      sql,
      /uq_job_scope_changes_one_proposed_per_job[\s\S]*status = 'proposed'/
    );
    assert.match(sql, /change_kind = any \(array\['add'::text, 'remove'::text\]\)/);
  });

  test("composite FKs rely on baseline (id, company_id) uniques", () => {
    assert.match(sql, /idx_jobs_id_company_unique/);
    assert.match(
      sql,
      /job_scope_changes_job_company_fkey[\s\S]*references public\.jobs \(id, company_id\)/
    );
    assert.match(sql, /proposal_versions_id_company_unique/);
    assert.match(
      sql,
      /job_scope_changes_version_company_fkey[\s\S]*proposal_versions \(id, company_id\)/
    );
    assert.match(sql, /proposal_signatures_id_company_unique/);
    assert.match(
      sql,
      /job_scope_change_approvals_signature_company_fkey[\s\S]*proposal_signatures \(id, company_id\)/
    );
  });

  test("activity event types expanded for scope changes", () => {
    for (const t of JOB_SCOPE_CHANGE_ACTIVITY_EVENT_TYPES) {
      assert.match(sql, new RegExp(`'${t}'::text`));
    }
  });

  test("authoring blocked uses canonical_job_stage_from_row full signature", () => {
    assert.match(
      sql,
      /canonical_job_stage_from_row\(\s*p_job\.stage,\s*p_job\.status,\s*coalesce\(p_job\.archived,\s*false\),\s*p_job\.active_proposal_id,\s*p_job\.latest_proposal_id\s*\)/
    );
    assert.match(sql, /complete_blocks_scope_change/);
    assert.match(sql, /disposition_blocks_scope_change/);
  });

  test("approval row_guard allows insert; blocks update/delete", () => {
    assert.match(
      sql,
      /job_scope_change_approvals_row_guard\(\)[\s\S]*?if tg_op = 'INSERT' then\s+return new;/
    );
    assert.match(
      sql,
      /job_scope_change_approvals_row_guard\(\)[\s\S]*?cannot be deleted/
    );
    assert.match(
      sql,
      /job_scope_change_approvals_row_guard\(\)[\s\S]*?cannot be updated/
    );
    // Insert path returns new before any raise.
    assert.match(
      sql,
      /if tg_op = 'INSERT' then\s+return new;\s+end if;/
    );
  });

  test("advisory locks use hashtext two-int form (no hashtextextended)", () => {
    assert.doesNotMatch(sql, /hashtextextended/);
    assert.match(
      sql,
      /pg_advisory_xact_lock\(\s*hashtext\('job_scope_change_propose:'/
    );
    assert.match(
      sql,
      /pg_advisory_xact_lock\(\s*hashtext\('job_scope_change_authorize:'/
    );
  });

  test("contract total rollup + payment current total rewire", () => {
    assert.match(sql, /create or replace function public\.job_contract_total_cents_v1/);
    assert.match(
      sql,
      /job_payment_current_contractual_total_cents_v1[\s\S]*select public\.job_contract_total_cents_v1/
    );
    assert.match(
      sql,
      /Historical payment-request snapshots remain immutable/
    );
    assert.doesNotMatch(
      sql,
      /update public\.proposal_acceptances[\s\S]*accepted_total_cents/
    );
    assert.doesNotMatch(
      sql,
      /update public\.job_payment_requests[\s\S]*amount_cents/
    );
  });

  test("state transition RPCs + authorize service_role only", () => {
    assert.match(sql, /create or replace function public\.create_job_scope_change_v1/);
    assert.match(sql, /propose_job_scope_change_v1/);
    assert.match(sql, /authorize_job_scope_change_v1/);
    assert.match(sql, /decline_job_scope_change_v1/);
    assert.match(sql, /void_job_scope_change_v1/);
    assert.match(sql, /stale_basis/);
    assert.match(sql, /financial_conflict/);
    assert.match(sql, /proposed_already_exists/);
    const authGrant = sql.match(
      /revoke all on function public\.authorize_job_scope_change_v1\(jsonb\) from public;[\s\S]*?grant all on function public\.authorize_job_scope_change_v1\(jsonb\) to service_role;/
    );
    assert.ok(authGrant);
    assert.doesNotMatch(
      authGrant![0],
      /grant all on function public\.authorize_job_scope_change_v1\(jsonb\) to authenticated/
    );
  });

  test("job_lifecycle_insert_activity granted for postgres owner RPCs", () => {
    assert.match(
      sql,
      /grant all on function public\.job_lifecycle_insert_activity\(uuid, uuid, text, uuid, jsonb, timestamptz\) to postgres/
    );
  });

  test("customer-review public token table binds company+job+scope_change", () => {
    assert.match(
      sql,
      /create table if not exists public\.job_scope_change_public_access_tokens/
    );
    assert.match(sql, /token_hash text not null/);
    assert.match(sql, /token_prefix text not null/);
    assert.match(
      sql,
      /job_scope_change_public_access_tokens_token_hash_unique unique \(token_hash\)/
    );
    assert.match(
      sql,
      /uq_job_scope_change_public_access_tokens_one_active[\s\S]*status = 'active'/
    );
    assert.match(
      sql,
      /job_scope_change_public_access_tokens_job_company_fkey[\s\S]*jobs \(id, company_id\)/
    );
    assert.match(
      sql,
      /job_scope_change_public_access_tokens_scope_company_fkey[\s\S]*job_scope_changes \(id, company_id\)/
    );
    // No raw-token column; only reject raw_token as forbidden metadata key.
    assert.doesNotMatch(
      sql,
      /job_scope_change_public_access_tokens[\s\S]{0,800}raw_token text/
    );
    assert.match(sql, /v_metadata \? 'raw_token'/);
  });

  test("authorize requires token_hash binding; resolve is service_role only", () => {
    assert.match(sql, /token_required/);
    assert.match(sql, /token_binding_mismatch/);
    assert.match(
      sql,
      /authorize_job_scope_change_v1[\s\S]*v_token_hash := lower\(trim\(coalesce\(p_payload->>'token_hash'/
    );
    assert.match(
      sql,
      /create or replace function public\.mint_job_scope_change_public_access_token_v1/
    );
    assert.match(
      sql,
      /create or replace function public\.resolve_job_scope_change_public_access_token_v1/
    );
    const resolveGrant = sql.match(
      /revoke all on function public\.resolve_job_scope_change_public_access_token_v1\(text\) from public;[\s\S]*?grant all on function public\.resolve_job_scope_change_public_access_token_v1\(text\) to service_role;/
    );
    assert.ok(resolveGrant);
    assert.doesNotMatch(
      resolveGrant![0],
      /grant all on function public\.resolve_job_scope_change_public_access_token_v1\(text\) to authenticated/
    );
    assert.doesNotMatch(
      sql,
      /grant all on function public\.authorize_job_scope_change_v1\(jsonb\) to authenticated/
    );
  });

  test("RLS select-only for authenticated; writes via RPC", () => {
    assert.match(sql, /job_scope_changes_select_company_scope/);
    assert.match(sql, /grant select on table public\.job_scope_changes to authenticated/);
    assert.doesNotMatch(
      sql,
      /create policy job_scope_changes_insert/
    );
  });
});

describe("Astra G9 state model + types", () => {
  test("five statuses with labels", () => {
    assert.deepEqual(JOB_SCOPE_CHANGE_STATUSES, [
      "draft",
      "proposed",
      "authorized",
      "declined",
      "voided",
    ]);
    assert.equal(JOB_SCOPE_CHANGE_STATUS_LABELS.proposed, "Pending approval");
    assert.equal(JOB_SCOPE_CHANGE_STATUS_LABELS.authorized, "Authorized");
  });

  test("activity types wired into jobLifecycleTypes", () => {
    for (const t of JOB_SCOPE_CHANGE_ACTIVITY_EVENT_TYPES) {
      assert.ok(
        (JOB_ACTIVITY_EVENT_TYPES as readonly string[]).includes(t),
        t
      );
    }
  });

  test("error codes include stale_basis and financial_conflict", () => {
    assert.ok(JOB_SCOPE_CHANGE_ERROR_CODES.includes("stale_basis"));
    assert.ok(JOB_SCOPE_CHANGE_ERROR_CODES.includes("financial_conflict"));
    assert.ok(JOB_SCOPE_CHANGE_ERROR_CODES.includes("proposed_already_exists"));
    assert.match(jobScopeChangeErrorLabel("stale_basis"), /rebase/i);
  });

  test("propose/price/send reuses proposal_author; no new capability", () => {
    assert.equal(JOB_SCOPE_CHANGE_AUTHOR_CAPABILITY, "proposal_author");
    assert.equal(hasCompanyCapability("owner", "proposal_author"), true);
    assert.equal(hasCompanyCapability("office_sales", "proposal_author"), true);
    assert.equal(
      hasCompanyCapability("production_lead", "proposal_author"),
      false
    );
    assert.equal(hasCompanyCapability("field_user", "proposal_author"), false);
    const roles = read("app/lib/companyMembershipRoles.ts");
    assert.match(roles, /Astra G9 scope-change propose\/price\/send/);
    assert.doesNotMatch(roles, /scope_change_author/);
    const caps = capabilitiesForRole("office_sales");
    assert.equal(caps.has("proposal_author"), true);
  });
});

describe("Astra G9 contract rollup math", () => {
  test("jobContractTotalFromParts is additive cents", () => {
    assert.equal(
      jobContractTotalFromParts({
        baseAcceptanceCents: 100_000,
        authorizedDeltasSum: 12_500,
      }),
      112_500
    );
    assert.equal(
      jobContractTotalFromParts({
        baseAcceptanceCents: 100_000,
        authorizedDeltasSum: -4_000,
      }),
      96_000
    );
    assert.equal(
      jobContractTotalFromParts({
        baseAcceptanceCents: 50_000,
        authorizedDeltasSum: 0,
      }),
      50_000
    );
  });

  test("buildScopeChangeTotalsDisplay shows original + prior + delta + proposed", () => {
    const d = buildScopeChangeTotalsDisplay({
      originalAgreementCents: 100_000,
      previouslyAuthorizedDeltasCents: 5_000,
      thisChangeDeltaCents: 2_500,
    });
    assert.equal(d.currentContractCents, 105_000);
    assert.equal(d.proposedNewTotalCents, 107_500);
    assert.equal(d.thisChangeDeltaCents, 2_500);
  });

  test("isStaleBasis detects divergence", () => {
    assert.equal(isStaleBasis(105_000, 105_000), false);
    assert.equal(isStaleBasis(105_000, 110_000), true);
  });

  test("financial conflict messaging", () => {
    assert.equal(financialConflictHeadline(), "Financial review required");
    assert.match(
      financialConflictDetail({ reason: "below_collected_gross" }),
      /collected/
    );
    assert.match(
      financialConflictDetail({ reason: "below_open_payment_requests" }),
      /open payment/
    );
    assert.match(
      scopeChangeFailureMessage("financial_conflict", {
        reason: "below_collected_gross",
      }),
      /Financial review required/
    );
    assert.match(
      staleBasisDetail({
        basisContractTotalCents: 10000,
        liveContractTotalCents: 12000,
      }),
      /\$120\.00/
    );
  });
});

describe("Astra G9 field brief wiring", () => {
  test("authorized summaries become approvedChangesLabel", () => {
    assert.equal(
      buildApprovedChangesLabel(["Additional decking", "Ridge vent"]),
      "Additional decking; Ridge vent"
    );
    const model = buildFieldBriefViewModel({
      authorizedChangeSummaries: ["Additional decking"],
      pendingProposedSummaries: [],
    });
    assert.equal(
      model.authorizedWork.approvedChangesLabel,
      "Additional decking"
    );
    assert.equal(model.authorizedWork.warningProposedVsAuthorized, null);
  });

  test("pending proposed uses specific Pending approval wording", () => {
    assert.equal(
      buildPendingProposedWarning(["Additional decking"]),
      "Additional decking — Pending approval"
    );
    const model = buildFieldBriefViewModel({
      authorizedChangeSummaries: ["Tear-off complete"],
      pendingProposedSummaries: ["Additional decking"],
    });
    assert.equal(
      model.authorizedWork.approvedChangesLabel,
      "Tear-off complete"
    );
    assert.equal(
      model.authorizedWork.warningProposedVsAuthorized,
      "Additional decking — Pending approval"
    );
  });

  test("proposed is never merged into authorized label", () => {
    const model = buildFieldBriefViewModel({
      authorizedChangeSummaries: [],
      pendingProposedSummaries: ["Skylight flashings"],
      proposedDiffersFromAuthorized: true,
    });
    assert.equal(model.authorizedWork.approvedChangesLabel, null);
    assert.match(
      String(model.authorizedWork.warningProposedVsAuthorized),
      /Skylight flashings — Pending approval/
    );
  });

  test("legacy proposedDiffersFromAuthorized still works without summaries", () => {
    const model = buildFieldBriefViewModel({
      proposedDiffersFromAuthorized: true,
    });
    assert.match(
      String(model.authorizedWork.warningProposedVsAuthorized),
      /Proposed work differs/
    );
  });
});

describe("Astra G9 persistence wrappers", () => {
  test("RPC wrappers mirror disposition pattern (rpc + p_payload)", () => {
    const persist = read("app/lib/jobScopeChangePersistence.ts");
    assert.match(persist, /createJobScopeChangeViaRpc/);
    assert.match(persist, /proposeJobScopeChangeViaRpc/);
    assert.match(persist, /authorizeJobScopeChangeViaRpc/);
    assert.match(persist, /mintScopeChangePublicAccessTokenViaRpc/);
    assert.match(persist, /resolveScopeChangePublicAccessTokenViaRpc/);
    assert.match(persist, /supabase\.rpc\(rpcName, \{ p_payload: payload \}/);
    assert.match(persist, /CREATE_JOB_SCOPE_CHANGE_RPC_V1/);
    assert.match(persist, /PROPOSE_JOB_SCOPE_CHANGE_RPC_V1/);
    assert.match(persist, /AUTHORIZE_JOB_SCOPE_CHANGE_RPC_V1/);
    assert.match(persist, /MINT_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1/);
    assert.match(persist, /RESOLVE_JOB_SCOPE_CHANGE_PUBLIC_ACCESS_TOKEN_RPC_V1/);
    assert.match(persist, /token_hash/);
    assert.equal(CREATE_JOB_SCOPE_CHANGE_RPC_V1, "create_job_scope_change_v1");
    assert.equal(PROPOSE_JOB_SCOPE_CHANGE_RPC_V1, "propose_job_scope_change_v1");
    assert.equal(
      AUTHORIZE_JOB_SCOPE_CHANGE_RPC_V1,
      "authorize_job_scope_change_v1"
    );
    assert.match(persist, /server-only/);
    assert.doesNotMatch(persist, /\.from\("job_scope_changes"\)[\s\S]*\.insert\(/);
    assert.doesNotMatch(persist, /\.from\("job_scope_changes"\)[\s\S]*\.update\(/);
  });

  test("public access helpers hash-only; never persist raw token", () => {
    const access = read("app/lib/jobScopeChangePublicAccess.ts");
    assert.match(access, /hashJobScopeChangePublicAccessToken/);
    assert.match(access, /hashProposalPublicAccessToken/);
    assert.match(access, /generateJobScopeChangePublicAccessToken/);
    assert.doesNotMatch(access, /from\("/);
  });

  test("types document proposal_author gate; no direct acceptance mutation helpers", () => {
    const types = read("app/lib/jobScopeChangeTypes.ts");
    assert.match(types, /proposal_author/);
    assert.match(types, /JOB_SCOPE_CHANGE_AUTHOR_CAPABILITY/);
    assert.match(types, /token_required/);
    const contract = read("app/lib/jobScopeChangeContract.ts");
    assert.doesNotMatch(contract, /accepted_total_cents\s*=/);
  });
});

describe("Astra G9 immutability assertions", () => {
  test("migration does not rewrite frozen proposal graph or acceptance totals", () => {
    const sql = read(MIGRATION);
    assert.doesNotMatch(sql, /update public\.proposal_pages/i);
    assert.doesNotMatch(sql, /update public\.proposal_options/i);
    assert.doesNotMatch(sql, /update public\.proposal_line_items/i);
    assert.doesNotMatch(sql, /update public\.proposal_acceptances/i);
    assert.doesNotMatch(sql, /update public\.proposal_signatures/i);
    assert.match(sql, /Original accepted agreement remains immutable/);
  });

  test("authorize is apply-once with unique approval per scope change", () => {
    const sql = read(MIGRATION);
    assert.match(
      sql,
      /job_scope_change_approvals_scope_unique unique \(scope_change_id\)/
    );
    assert.match(sql, /if v_change\.status = 'authorized'/);
    assert.match(sql, /'idempotent', true/);
  });
});
