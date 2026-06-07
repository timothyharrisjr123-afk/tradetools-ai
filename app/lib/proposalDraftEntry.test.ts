/**
 * 3J3B/3J3C — proposalDraftEntry + buildProposalBuilderHref tests.
 *
 * Run: npx tsx --test app/lib/proposalDraftEntry.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildProposalBuilderHref } from "./proposalBuilderReadiness";
import type { MeasurementProposalHandoff } from "./measurementProposalHandoff";
import type { MeasurementQuantityMap } from "./measurementTypes";
import type { ProposalRecord, ProposalRecordStatusSummary } from "./proposalRecordTypes";
import { ProposalSnapshotGuardError } from "./proposalSnapshotStatusMapper";
import {
  PROPOSAL_DRAFT_UNCONFIGURED_POLICY_MESSAGE,
  isExpectedProposalDraftEntryFailure,
  resolveProposalLaunchBlockerActions,
  resolveOrCreateProposalDraftEntry,
  resolveProposalDraftEntry,
  validateProposalDraftCreatePayload,
  type ProposalDraftCreatePayload,
  type ProposalDraftEntryDeps,
  type ResolveOrCreateProposalDraftEntryDeps,
} from "./proposalDraftEntry";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";
const LISTED_DRAFT_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_JOB_ID = "44444444-4444-4444-8444-444444444444";
const CUSTOMER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEMPLATE_ID = "55555555-5555-4555-8555-555555555555";
const MEASUREMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function draftProposal(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: PROPOSAL_ID,
    company_id: COMPANY_ID,
    job_id: JOB_ID,
    customer_id: null,
    template_id: TEMPLATE_ID,
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

function draftSummary(
  overrides: Partial<ProposalRecordStatusSummary> = {}
): ProposalRecordStatusSummary {
  return {
    id: LISTED_DRAFT_ID,
    job_id: JOB_ID,
    status: "draft",
    title: "Listed draft",
    proposal_number: null,
    template_id: TEMPLATE_ID,
    latest_sent_version_id: null,
    signed_version_id: null,
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function readyHandoff(): MeasurementProposalHandoff {
  return {
    proposalReady: true,
    blockers: [],
    selectedLabel: "Saved",
    quantities: {
      roof_squares: 10,
      adjusted_roof_squares: 11,
      roof_area_sqft: 1100,
      waste_percent: 10,
      eaves_lf: null,
      rakes_lf: null,
      ridges_lf: null,
      hips_lf: null,
      valleys_lf: null,
      wall_flashing_lf: null,
      step_flashing_lf: null,
      transitions_lf: null,
      parapet_wall_lf: null,
      drip_edge_lf: null,
      starter_lf: null,
      ridge_cap_lf: null,
      pipe_boots_count: null,
      vents_count: null,
      skylights_count: null,
      chimneys_count: null,
      satellite_dishes_count: null,
    },
    estimateReady: true,
    productionReady: false,
  };
}

function readyQuantityMap(): MeasurementQuantityMap {
  return { shingles_squares: 11 };
}

function readyCreatePayload(): ProposalDraftCreatePayload {
  return {
    customer_id: CUSTOMER_ID,
    template_id: TEMPLATE_ID,
    measurement_record_id: MEASUREMENT_ID,
    quantity_context: {
      measurementHandoff: readyHandoff(),
      quantityMap: readyQuantityMap(),
    },
  };
}

describe("isExpectedProposalDraftEntryFailure", () => {
  test("expected business failures include db_identity_not_ready and validation reasons", () => {
    assert.equal(isExpectedProposalDraftEntryFailure("db_identity_not_ready"), true);
    assert.equal(isExpectedProposalDraftEntryFailure("missing_customer_id"), true);
    assert.equal(isExpectedProposalDraftEntryFailure("missing_template_id"), true);
    assert.equal(isExpectedProposalDraftEntryFailure("missing_measurement_record_id"), true);
    assert.equal(isExpectedProposalDraftEntryFailure("missing_quantity_context"), true);
    assert.equal(isExpectedProposalDraftEntryFailure("unconfigured_pricing_policy"), true);
    assert.equal(isExpectedProposalDraftEntryFailure("no_active_proposal"), true);
    assert.equal(isExpectedProposalDraftEntryFailure("proposal_not_found"), true);
    assert.equal(isExpectedProposalDraftEntryFailure("wrong_company"), true);
    assert.equal(isExpectedProposalDraftEntryFailure("wrong_job"), true);
    assert.equal(isExpectedProposalDraftEntryFailure("non_draft_status"), true);
  });

  test("create_failed is unexpected and should allow console.error", () => {
    assert.equal(isExpectedProposalDraftEntryFailure("create_failed"), false);
  });
});

describe("resolveProposalLaunchBlockerActions", () => {
  test("db_identity_not_ready maps to Open DB-backed Job Card", () => {
    const actions = resolveProposalLaunchBlockerActions("db_identity_not_ready", {
      jobId: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(actions[0]?.label, "Open DB-backed Job Card");
    assert.equal(actions[0]?.actionType, "route");
    assert.match(actions[0]?.href ?? "", /entry=job-card/);
    assert.doesNotMatch(actions[0]?.href ?? "", /from=board/);
  });

  test("unconfigured_pricing_policy maps to Configure Pricing Policy", () => {
    const actions = resolveProposalLaunchBlockerActions("unconfigured_pricing_policy");
    assert.equal(actions[0]?.label, "Configure Pricing Policy");
    assert.equal(actions[0]?.href, "/tools/settings/pricing");
  });

  test("missing_template maps to Open Templates", () => {
    const actions = resolveProposalLaunchBlockerActions("missing_template");
    assert.equal(actions[0]?.label, "Open Templates");
    assert.equal(actions[0]?.href, "/tools/roofing/templates");
  });

  test("missing_quantity_context maps to Go to Measurements", () => {
    const actions = resolveProposalLaunchBlockerActions("missing_quantity_context");
    assert.equal(actions[0]?.label, "Go to Measurements");
    assert.equal(actions[0]?.targetTab, "measurements");
  });

  test("wrong_job maps to Return to Job Board", () => {
    const actions = resolveProposalLaunchBlockerActions("wrong_job");
    assert.equal(actions[0]?.label, "Return to Job Board");
    assert.equal(actions[0]?.href, "/tools/roofing/saved");
  });

  test("create_failed does not invent unsafe navigation", () => {
    assert.deepEqual(resolveProposalLaunchBlockerActions("create_failed"), []);
  });

  test("unknown reason returns empty safe state", () => {
    assert.deepEqual(resolveProposalLaunchBlockerActions("totally_unknown"), []);
  });

  test("catalogNotReady context maps to Open catalog setup", () => {
    const actions = resolveProposalLaunchBlockerActions(null, { catalogNotReady: true });
    assert.equal(actions[0]?.label, "Open catalog setup");
    assert.equal(actions[0]?.href, "/tools/roofing/catalog");
  });
});

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

describe("validateProposalDraftCreatePayload", () => {
  test("rejects missing customer_id", () => {
    const payload = readyCreatePayload();
    payload.customer_id = "";
    const result = validateProposalDraftCreatePayload(payload);
    assert.equal(result.valid, false);
    if (!result.valid) assert.equal(result.reason, "missing_customer_id");
  });
});

describe("resolveOrCreateProposalDraftEntry", () => {
  test("returns active draft without create", async () => {
    let createCalls = 0;
    const deps: ResolveOrCreateProposalDraftEntryDeps = {
      getProposalById: async () => draftProposal(),
      listProposalsForJob: async () => {
        throw new Error("listProposalsForJob must not be called when active draft valid");
      },
      createDraftProposal: async () => {
        createCalls += 1;
        throw new Error("createDraftProposal must not be called");
      },
    };
    const result = await resolveOrCreateProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: PROPOSAL_ID,
        createPayload: readyCreatePayload(),
      },
      deps
    );
    assert.equal(createCalls, 0);
    assert.equal(result.created, false);
    assert.equal(result.proposalId, PROPOSAL_ID);
    assert.equal(result.reason, "active_draft");
  });

  test("listed draft returned without create when active id invalid", async () => {
    let createCalls = 0;
    const deps: ResolveOrCreateProposalDraftEntryDeps = {
      getProposalById: async () => draftProposal({ status: "sent" }),
      listProposalsForJob: async () => [draftSummary()],
      createDraftProposal: async () => {
        createCalls += 1;
        throw new Error("createDraftProposal must not be called");
      },
    };
    const result = await resolveOrCreateProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: PROPOSAL_ID,
        createPayload: readyCreatePayload(),
      },
      deps
    );
    assert.equal(createCalls, 0);
    assert.equal(result.created, false);
    assert.equal(result.proposalId, LISTED_DRAFT_ID);
    assert.equal(result.reason, "existing_job_draft");
  });

  test("creates once when no active or listed draft", async () => {
    let createCalls = 0;
    const deps: ResolveOrCreateProposalDraftEntryDeps = {
      getProposalById: async () => null,
      listProposalsForJob: async () => [],
      createDraftProposal: async (input) => {
        createCalls += 1;
        assert.equal(input.company_id, COMPANY_ID);
        assert.equal(input.job_id, JOB_ID);
        return {
          proposal: draftProposal({ id: PROPOSAL_ID }),
          versionId: "77777777-7777-4777-8777-777777777777",
          selectedOptionId: null,
          writeSteps: [],
        };
      },
    };
    const result = await resolveOrCreateProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: null,
        createPayload: readyCreatePayload(),
      },
      deps
    );
    assert.equal(createCalls, 1);
    assert.equal(result.created, true);
    assert.equal(result.proposalId, PROPOSAL_ID);
    assert.equal(result.reason, "created_draft");
  });

  test("second call uses listed draft and does not create again", async () => {
    let createCalls = 0;
    const deps: ResolveOrCreateProposalDraftEntryDeps = {
      getProposalById: async () => null,
      listProposalsForJob: async () => [draftSummary({ id: PROPOSAL_ID })],
      createDraftProposal: async () => {
        createCalls += 1;
        throw new Error("createDraftProposal must not be called");
      },
    };
    const result = await resolveOrCreateProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: null,
        createPayload: readyCreatePayload(),
      },
      deps
    );
    assert.equal(createCalls, 0);
    assert.equal(result.reason, "existing_job_draft");
    assert.equal(result.proposalId, PROPOSAL_ID);
  });

  test("wrong-job active id still finds listed draft before create", async () => {
    let createCalls = 0;
    const deps: ResolveOrCreateProposalDraftEntryDeps = {
      getProposalById: async () => draftProposal({ job_id: OTHER_JOB_ID }),
      listProposalsForJob: async () => [draftSummary()],
      createDraftProposal: async () => {
        createCalls += 1;
        throw new Error("createDraftProposal must not be called");
      },
    };
    const result = await resolveOrCreateProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: PROPOSAL_ID,
        createPayload: readyCreatePayload(),
      },
      deps
    );
    assert.equal(createCalls, 0);
    assert.equal(result.reason, "existing_job_draft");
  });

  test("create failure surfaces unconfigured pricing policy", async () => {
    const deps: ResolveOrCreateProposalDraftEntryDeps = {
      getProposalById: async () => null,
      listProposalsForJob: async () => [],
      createDraftProposal: async () => {
        throw new ProposalSnapshotGuardError(
          "Pricing policy is not configured for persistence."
        );
      },
    };
    const result = await resolveOrCreateProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: null,
        createPayload: readyCreatePayload(),
      },
      deps
    );
    assert.equal(result.proposalId, null);
    assert.equal(result.created, false);
    assert.equal(result.reason, "unconfigured_pricing_policy");
    assert.equal(result.errorMessage, PROPOSAL_DRAFT_UNCONFIGURED_POLICY_MESSAGE);
  });

  test("missing create payload fails closed without create", async () => {
    let createCalls = 0;
    const deps: ResolveOrCreateProposalDraftEntryDeps = {
      getProposalById: async () => null,
      listProposalsForJob: async () => [],
      createDraftProposal: async () => {
        createCalls += 1;
        throw new Error("createDraftProposal must not be called");
      },
    };
    const result = await resolveOrCreateProposalDraftEntry(
      {
        companyId: COMPANY_ID,
        jobId: JOB_ID,
        activeProposalId: null,
        createPayload: null,
      },
      deps
    );
    assert.equal(createCalls, 0);
    assert.equal(result.reason, "db_identity_not_ready");
    assert.match(result.errorMessage ?? "", /persisted customer and measurement/i);
  });

  test("invalid company/job never creates", async () => {
    let createCalls = 0;
    const deps: ResolveOrCreateProposalDraftEntryDeps = {
      getProposalById: async () => null,
      listProposalsForJob: async () => [],
      createDraftProposal: async () => {
        createCalls += 1;
        throw new Error("createDraftProposal must not be called");
      },
    };
    const result = await resolveOrCreateProposalDraftEntry(
      {
        companyId: "bad",
        jobId: JOB_ID,
        activeProposalId: null,
        createPayload: readyCreatePayload(),
      },
      deps
    );
    assert.equal(createCalls, 0);
    assert.equal(result.reason, "invalid_company_or_job");
  });
});
