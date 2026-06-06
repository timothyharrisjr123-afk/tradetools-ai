/**
 * 3J3B — proposalDraftEntry + buildProposalBuilderHref tests.
 *
 * Run: npx tsx --test app/lib/proposalDraftEntry.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildProposalBuilderHref } from "./proposalBuilderReadiness";
import type { ProposalRecord } from "./proposalRecordTypes";
import {
  resolveProposalDraftEntry,
  type ProposalDraftEntryDeps,
} from "./proposalDraftEntry";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_JOB_ID = "44444444-4444-4444-8444-444444444444";

function draftProposal(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: PROPOSAL_ID,
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    customer_id: null,
    template_id: "55555555-5555-4555-8555-555555555555",
    status: "draft",
    current_draft_version_id: null,
    latest_sent_version_id: null,
    signed_version_id: null,
    selected_option_id: null,
    measurement_record_id: null,
    pricing_policy_id: null,
    proposal_number: null,
    title: "Test draft",
    created_by: null,
    updated_by: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("buildProposalBuilderHref", () => {
  test("job-only route unchanged when proposalId omitted", () => {
    assert.equal(
      buildProposalBuilderHref(JOB_ID),
      `/tools/roofing/proposals/builder?job=${encodeURIComponent(JOB_ID)}`
    );
  });

  test("includes job and proposal params when proposalId valid", () => {
    const href = buildProposalBuilderHref(JOB_ID, PROPOSAL_ID);
    assert.equal(
      href,
      `/tools/roofing/proposals/builder?job=${encodeURIComponent(JOB_ID)}&proposal=${encodeURIComponent(PROPOSAL_ID)}`
    );
  });

  test("ignores invalid proposalId", () => {
    assert.equal(buildProposalBuilderHref(JOB_ID, "not-a-uuid"), buildProposalBuilderHref(JOB_ID));
    assert.equal(buildProposalBuilderHref(JOB_ID, ""), buildProposalBuilderHref(JOB_ID));
    assert.equal(buildProposalBuilderHref(JOB_ID, null), buildProposalBuilderHref(JOB_ID));
  });
});

describe("resolveProposalDraftEntry", () => {
  test("returns no_active_proposal when activeProposalId is null", async () => {
    const getProposalById = async () => {
      throw new Error("getProposalById must not be called");
    };
    const result = await resolveProposalDraftEntry(
      { companyId: COMPANY_ID, jobId: JOB_ID, activeProposalId: null },
      { getProposalById }
    );
    assert.equal(result.found, false);
    assert.equal(result.proposalId, null);
    assert.equal(result.reason, "no_active_proposal");
  });

  test("valid active draft returns found true + proposalId", async () => {
    let called = false;
    const deps: ProposalDraftEntryDeps = {
      getProposalById: async (companyId, proposalId) => {
        called = true;
        assert.equal(companyId, COMPANY_ID);
        assert.equal(proposalId, PROPOSAL_ID);
        return draftProposal();
      },
    };
    const result = await resolveProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: PROPOSAL_ID,
      },
      deps
    );
    assert.equal(called, true);
    assert.equal(result.found, true);
    assert.equal(result.proposalId, PROPOSAL_ID);
    assert.equal(result.reason, "active_draft");
  });

  test("non-draft proposal returns found false", async () => {
    const deps: ProposalDraftEntryDeps = {
      getProposalById: async () => draftProposal({ status: "sent" }),
    };
    const result = await resolveProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: PROPOSAL_ID,
      },
      deps
    );
    assert.equal(result.found, false);
    assert.equal(result.reason, "non_draft_status");
  });

  test("proposal for wrong job returns found false", async () => {
    const deps: ProposalDraftEntryDeps = {
      getProposalById: async () => draftProposal({ job_id: OTHER_JOB_ID }),
    };
    const result = await resolveProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: PROPOSAL_ID,
      },
      deps
    );
    assert.equal(result.found, false);
    assert.equal(result.reason, "wrong_job");
  });

  test("missing proposal returns found false", async () => {
    const deps: ProposalDraftEntryDeps = {
      getProposalById: async () => null,
    };
    const result = await resolveProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: PROPOSAL_ID,
      },
      deps
    );
    assert.equal(result.found, false);
    assert.equal(result.reason, "proposal_not_found");
  });

  test("wrong company on proposal row returns found false", async () => {
    const deps: ProposalDraftEntryDeps = {
      getProposalById: async () =>
        draftProposal({ company_id: "99999999-9999-4999-8999-999999999999" }),
    };
    const result = await resolveProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: PROPOSAL_ID,
      },
      deps
    );
    assert.equal(result.found, false);
    assert.equal(result.reason, "wrong_company");
  });

  test("invalid activeProposalId is treated as no_active_proposal without store call", async () => {
    let called = false;
    const deps: ProposalDraftEntryDeps = {
      getProposalById: async () => {
        called = true;
        return null;
      },
    };
    const result = await resolveProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: "bad-id",
      },
      deps
    );
    assert.equal(called, false);
    assert.equal(result.reason, "no_active_proposal");
  });

  test("resolver deps expose only getProposalById — read-only", async () => {
    const deps: ProposalDraftEntryDeps = {
      getProposalById: async () => draftProposal(),
    };
    assert.equal(typeof deps.getProposalById, "function");
    assert.equal("createDraftProposal" in deps, false);
    await resolveProposalDraftEntry(
      { companyId: COMPANY_ID, jobId: JOB_ID, activeProposalId: PROPOSAL_ID },
      deps
    );
  });
});
