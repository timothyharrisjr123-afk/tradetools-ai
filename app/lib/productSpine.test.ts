import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCleanDbJobCardHref,
  classifyProductSpine,
  evaluateDbProposalLaunchSpine,
  isMixedSpineContext,
  normalizeDbProposalHref,
} from "./productSpine";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const PROPOSAL_ID = "22222222-2222-4222-8222-222222222222";

describe("classifyProductSpine", () => {
  test("clean DB job route", () => {
    const result = classifyProductSpine({
      pathname: "/tools/roofing",
      entry: "job-card",
      job: JOB_ID,
    });
    assert.equal(result.spine, "db_job");
    assert.equal(result.isMixedContext, false);
  });

  test("DB Builder route with job and proposal", () => {
    const result = classifyProductSpine({
      pathname: "/tools/roofing/proposals/builder",
      job: JOB_ID,
      proposal: PROPOSAL_ID,
    });
    assert.equal(result.spine, "db_proposal_builder");
    assert.equal(result.isMixedContext, false);
  });

  test("DB Preview route with job and proposal", () => {
    const result = classifyProductSpine({
      pathname: "/tools/roofing/proposals/preview",
      job: JOB_ID,
      proposal: PROPOSAL_ID,
    });
    assert.equal(result.spine, "db_proposal_preview");
    assert.equal(result.isMixedContext, false);
  });

  test("legacy loadSaved route", () => {
    const result = classifyProductSpine({
      pathname: "/tools/roofing",
      entry: "job-card",
      loadSaved: "33333333-3333-4333-8333-333333333333",
    });
    assert.equal(result.spine, "legacy_estimate");
    assert.equal(result.isMixedContext, false);
  });

  test("legacy approval route", () => {
    const result = classifyProductSpine({
      pathname: "/approve/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    assert.equal(result.spine, "legacy_approval");
    assert.equal(result.isMixedContext, false);
  });

  test("mixed job UUID + loadSaved", () => {
    const result = classifyProductSpine({
      pathname: "/tools/roofing",
      entry: "job-card",
      job: JOB_ID,
      loadSaved: "33333333-3333-4333-8333-333333333333",
    });
    assert.equal(result.spine, "unknown");
    assert.equal(result.isMixedContext, true);
  });

  test("mixed job UUID + from=board", () => {
    const result = classifyProductSpine({
      pathname: "/tools/roofing",
      entry: "job-card",
      job: JOB_ID,
      from: "board",
    });
    assert.equal(result.spine, "unknown");
    assert.equal(result.isMixedContext, true);
  });

  test("unknown malformed job-card without job id", () => {
    const result = classifyProductSpine({
      pathname: "/tools/roofing",
      entry: "job-card",
    });
    assert.equal(result.spine, "unknown");
    assert.equal(result.isMixedContext, false);
  });
});

describe("isMixedSpineContext", () => {
  test("DB builder with from=board is mixed", () => {
    assert.equal(
      isMixedSpineContext({
        pathname: "/tools/roofing/proposals/builder",
        job: JOB_ID,
        proposal: PROPOSAL_ID,
        from: "board",
      }),
      true
    );
  });
});

describe("evaluateDbProposalLaunchSpine", () => {
  test("allows clean DB job route", () => {
    const result = evaluateDbProposalLaunchSpine({
      pathname: "/tools/roofing",
      entry: "job-card",
      job: JOB_ID,
    });
    assert.equal(result.allowed, true);
    assert.equal(result.reason, null);
  });

  test("blocks builder/preview without job using contractor-facing missing context", () => {
    const builder = evaluateDbProposalLaunchSpine({
      pathname: "/tools/roofing/proposals/builder",
    });
    assert.equal(builder.allowed, false);
    assert.equal(builder.reason, "missing_job_context");
    assert.equal(builder.errorMessage, "Open a job before creating a proposal.");
    assert.doesNotMatch(builder.errorMessage ?? "", /clean DB|database|fixture|smoke|harness/i);
    assert.equal(builder.normalizeHref, "/tools/roofing/saved");

    const preview = evaluateDbProposalLaunchSpine({
      pathname: "/tools/roofing/proposals/preview",
    });
    assert.equal(preview.allowed, false);
    assert.equal(preview.reason, "missing_job_context");
    assert.equal(preview.errorMessage, "Open a proposal from a job to preview it.");
    assert.doesNotMatch(preview.errorMessage ?? "", /clean DB|database|fixture|smoke|harness/i);
  });

  test("blocks mixed context with normalize href", () => {
    const result = evaluateDbProposalLaunchSpine({
      pathname: "/tools/roofing",
      entry: "job-card",
      job: JOB_ID,
      from: "board",
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "mixed_spine_context");
    assert.equal(result.normalizeHref, buildCleanDbJobCardHref(JOB_ID));
    assert.doesNotMatch(result.errorMessage ?? "", /clean DB/i);
  });

  test("blocks legacy loadSaved context", () => {
    const result = evaluateDbProposalLaunchSpine({
      pathname: "/tools/roofing",
      loadSaved: "33333333-3333-4333-8333-333333333333",
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "legacy_spine_blocked");
    assert.doesNotMatch(result.errorMessage ?? "", /DB Job Card route/i);
  });

  test("allows omitted hints for test-only callers", () => {
    const result = evaluateDbProposalLaunchSpine(null);
    assert.equal(result.allowed, true);
  });
});

describe("normalizeDbProposalHref", () => {
  test("strips loadSaved and from=board", () => {
    const href = normalizeDbProposalHref(
      `/tools/roofing?entry=job-card&job=${JOB_ID}&loadSaved=abc&from=board`
    );
    assert.equal(href, `/tools/roofing?entry=job-card&job=${JOB_ID}`);
  });

  test("buildCleanDbJobCardHref has no legacy params", () => {
    const href = buildCleanDbJobCardHref(JOB_ID);
    assert.doesNotMatch(href, /loadSaved/);
    assert.doesNotMatch(href, /from=board/);
  });
});

describe("legacyEstimateSendGuard", () => {
  test("rejects proposalId payload", async () => {
    const { validateLegacyEstimateSendPayload } = await import("./legacyEstimateSendGuard");
    const result = validateLegacyEstimateSendPayload({
      proposalId: PROPOSAL_ID,
      savedEstimateId: "33333333-3333-4333-8333-333333333333",
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /DB proposal drafts/i);
  });

  test("allows legitimate legacy saved estimate payload", async () => {
    const { validateLegacyEstimateSendPayload } = await import("./legacyEstimateSendGuard");
    const result = validateLegacyEstimateSendPayload({
      savedEstimateId: "33333333-3333-4333-8333-333333333333",
    });
    assert.equal(result.ok, true);
  });

  test("rejects db board synthetic saved id", async () => {
    const { validateLegacyEstimateSendPayload } = await import("./legacyEstimateSendGuard");
    const { DB_BOARD_JOB_ID_PREFIX } = await import("./jobBoardAdapter");
    const result = validateLegacyEstimateSendPayload({
      savedEstimateId: `${DB_BOARD_JOB_ID_PREFIX}${JOB_ID}`,
    });
    assert.equal(result.ok, false);
  });
});
