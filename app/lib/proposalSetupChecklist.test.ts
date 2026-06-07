import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveProposalSetupChecklist,
  type ProposalSetupChecklistInput,
} from "./proposalSetupChecklist";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";

function baseInput(
  overrides: Partial<ProposalSetupChecklistInput> = {}
): ProposalSetupChecklistInput {
  return {
    jobId: JOB_ID,
    isBoardOrigin: false,
    identityFromJobRecord: true,
    customerId: CUSTOMER_ID,
    measurementProposalReady: true,
    hasPersistedMeasurement: true,
    hasUnsavedMeasurementChanges: false,
    catalogReady: true,
    templateReady: true,
    pricingPolicyConfigured: true,
    pricingPolicyLoadComplete: true,
    activeProposalId: null,
    hasCreatePayload: true,
    ...overrides,
  };
}

describe("deriveProposalSetupChecklist", () => {
  test("board-origin with otherwise complete setup → Open DB-backed Job Card, not Go to Measurements", () => {
    const result = deriveProposalSetupChecklist(
      baseInput({
        isBoardOrigin: true,
        identityFromJobRecord: false,
      })
    );

    assert.equal(result.primaryAction.label, "Open DB-backed Job Card");
    assert.equal(result.primaryAction.actionType, "normalize_job_card");
    const href = result.primaryAction.href ?? "";
    assert.match(href, /entry=job-card/);
    assert.match(href, new RegExp(`job=${JOB_ID}`));
    assert.match(href, /tab=proposals/);
    assert.doesNotMatch(href, /from=board/);
    assert.doesNotMatch(href, /loadSaved/);
    assert.notEqual(result.primaryAction.label, "Go to Measurements");
    assert.equal(result.activeBlockerId, "db_job_card");
    assert.equal(result.quiet, false);
  });

  test("missing measurement on direct job → Go to Measurements", () => {
    const result = deriveProposalSetupChecklist(
      baseInput({
        hasPersistedMeasurement: false,
        measurementProposalReady: false,
      })
    );

    assert.equal(result.primaryAction.label, "Go to Measurements");
    assert.equal(result.primaryAction.actionType, "job_card_tab");
    assert.equal(result.primaryAction.targetTab, "measurements");
    assert.equal(result.activeBlockerId, "measurement");
  });

  test("unsaved measurement changes → Save Measurement", () => {
    const result = deriveProposalSetupChecklist(
      baseInput({
        hasUnsavedMeasurementChanges: true,
        measurementProposalReady: true,
        hasPersistedMeasurement: true,
      })
    );

    assert.equal(result.primaryAction.label, "Save Measurement");
    assert.equal(result.primaryAction.actionType, "job_card_tab");
    assert.equal(result.activeBlockerId, "measurement");
  });

  test("catalog not ready → Open Catalog Setup", () => {
    const result = deriveProposalSetupChecklist(
      baseInput({
        catalogReady: false,
      })
    );

    assert.equal(result.primaryAction.label, "Open Catalog Setup");
    const catalogHref = result.primaryAction.href ?? "";
    assert.match(catalogHref, /^\/tools\/roofing\/catalog\?/);
    assert.match(catalogHref, /returnTo=/);
    assert.match(catalogHref, new RegExp(`job=${JOB_ID}`));
    assert.match(catalogHref, /tab=proposals/);
    assert.match(
      decodeURIComponent(catalogHref),
      new RegExp(`returnTo=/tools/roofing\\?entry=job-card&job=${JOB_ID}&tab=proposals`)
    );
    assert.equal(result.activeBlockerId, "catalog");
  });

  test("template not ready → Open Templates", () => {
    const result = deriveProposalSetupChecklist(
      baseInput({
        templateReady: false,
      })
    );

    assert.equal(result.primaryAction.label, "Open Templates");
    const templatesHref = result.primaryAction.href ?? "";
    assert.match(templatesHref, /^\/tools\/roofing\/templates\?/);
    assert.match(templatesHref, /returnTo=/);
    assert.match(templatesHref, new RegExp(`job=${JOB_ID}`));
    assert.match(templatesHref, /tab=proposals/);
    assert.equal(result.activeBlockerId, "template");
  });

  test("pricing policy unconfigured → Configure Pricing Policy", () => {
    const result = deriveProposalSetupChecklist(
      baseInput({
        pricingPolicyConfigured: false,
      })
    );

    assert.equal(result.primaryAction.label, "Configure Pricing Policy");
    const pricingHref = result.primaryAction.href ?? "";
    assert.match(pricingHref, /^\/tools\/settings\/pricing\?/);
    assert.match(pricingHref, /returnTo=/);
    assert.match(pricingHref, new RegExp(`job=${JOB_ID}`));
    assert.match(pricingHref, /tab=proposals/);
    assert.equal(result.activeBlockerId, "pricing_policy");
  });

  test("pricing policy unknown after load → Configure Pricing Policy", () => {
    const result = deriveProposalSetupChecklist(
      baseInput({
        pricingPolicyConfigured: null,
        pricingPolicyLoadComplete: true,
      })
    );

    assert.equal(result.primaryAction.label, "Configure Pricing Policy");
    assert.equal(result.activeBlockerId, "pricing_policy");
  });

  test("all ready + no draft → Create Proposal", () => {
    const result = deriveProposalSetupChecklist(baseInput());

    assert.equal(result.primaryAction.label, "Create Proposal");
    assert.equal(result.primaryAction.actionType, "create_proposal");
    assert.equal(result.activeBlockerId, "proposal_draft");
    assert.equal(result.quiet, true);
  });

  test("existing draft → Open Proposal Builder", () => {
    const result = deriveProposalSetupChecklist(
      baseInput({
        activeProposalId: PROPOSAL_ID,
      })
    );

    assert.equal(result.primaryAction.label, "Open Proposal Builder");
    assert.equal(result.primaryAction.actionType, "open_builder");
    assert.match(result.primaryAction.href ?? "", new RegExp(PROPOSAL_ID));
    assert.equal(result.quiet, true);
  });

  test("completed items collapse/quiet state when ready", () => {
    const result = deriveProposalSetupChecklist(baseInput());

    assert.equal(result.quiet, true);
    assert.match(result.statusText, /ready/i);
    const incomplete = result.items.filter(
      (item) => item.status !== "complete" && item.status !== "optional"
    );
    assert.equal(incomplete.length, 1);
    assert.equal(incomplete[0]?.id, "proposal_draft");
  });

  test("invalid job id → Return to Job Board without unsafe href", () => {
    const result = deriveProposalSetupChecklist(
      baseInput({
        jobId: "not-a-uuid",
      })
    );

    assert.equal(result.primaryAction.label, "Return to Job Board");
    assert.equal(result.primaryAction.href, "/tools/roofing/saved");
  });

  test("missing customer → Complete Customer Info", () => {
    const result = deriveProposalSetupChecklist(
      baseInput({
        customerId: null,
      })
    );

    assert.equal(result.primaryAction.label, "Complete Customer Info");
    assert.equal(result.primaryAction.targetTab, "overview");
    assert.equal(result.activeBlockerId, "customer");
  });

  test("unsupported launch reason still follows fact-based next action", () => {
    const result = deriveProposalSetupChecklist(
      baseInput({
        catalogReady: false,
        proposalLaunchReason: "totally_unknown",
      })
    );

    assert.equal(result.primaryAction.label, "Open Catalog Setup");
    assert.match(result.primaryAction.href ?? "", /^\/tools\/roofing\/catalog\?/);
  });
});
