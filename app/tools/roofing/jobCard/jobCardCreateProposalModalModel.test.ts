/**
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardCreateProposalModalModel.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { filterContractorVisibleTemplates } from "@/app/lib/contractorFixtureIsolation";
import {
  CREATE_PROPOSAL_CONTINUE_TO_BUILDER,
  CREATE_PROPOSAL_HELPER,
  CREATE_PROPOSAL_MEASUREMENT_BLOCKED,
  CREATE_PROPOSAL_MODAL_TITLE,
  CREATE_PROPOSAL_USE_MEASUREMENT,
  CREATE_PROPOSAL_USE_TEMPLATE,
  canContinueCreateProposal,
  formatCreateProposalIncludedLine,
  formatCreateProposalMeasurementDetail,
  formatCreateProposalTemplateMetaLine,
  nextCreateProposalStep,
  prevCreateProposalStep,
} from "./jobCardCreateProposalModalModel";
import {
  JOB_CARD_PROPOSALS_ADD_LABEL,
  JOB_CARD_PROPOSALS_CREATE_LABEL,
  JOB_CARD_PROPOSALS_ENTRY_PLACEHOLDER,
  JOB_CARD_PROPOSALS_OPEN_LABEL,
} from "./jobCardProposalsTabModel";

describe("jobCardCreateProposalModalModel", () => {
  test("approved modal copy", () => {
    assert.equal(CREATE_PROPOSAL_MODAL_TITLE, "Create proposal");
    assert.equal(CREATE_PROPOSAL_USE_MEASUREMENT, "Use this measurement");
    assert.equal(CREATE_PROPOSAL_USE_TEMPLATE, "Use this template");
    assert.equal(CREATE_PROPOSAL_CONTINUE_TO_BUILDER, "Continue to Builder");
    assert.match(CREATE_PROPOSAL_HELPER, /Existing proposals are not changed/i);
    assert.equal(JOB_CARD_PROPOSALS_ADD_LABEL, "+ Proposal");
    assert.equal(JOB_CARD_PROPOSALS_CREATE_LABEL, "Create proposal");
    assert.equal(JOB_CARD_PROPOSALS_OPEN_LABEL, "Open");
    assert.doesNotMatch(CREATE_PROPOSAL_CONTINUE_TO_BUILDER, /Create proposal draft/i);
    assert.doesNotMatch(CREATE_PROPOSAL_MODAL_TITLE, /Create proposal draft/i);
    assert.doesNotMatch(JOB_CARD_PROPOSALS_ADD_LABEL, /Create another proposal/i);
    assert.doesNotMatch(JOB_CARD_PROPOSALS_OPEN_LABEL, /Open saved proposal/i);
    assert.match(JOB_CARD_PROPOSALS_ENTRY_PLACEHOLDER, /measurement.*template.*package/i);
  });

  test("step navigation order", () => {
    assert.equal(nextCreateProposalStep("measurement"), "template");
    assert.equal(nextCreateProposalStep("template"), "package");
    assert.equal(nextCreateProposalStep("package"), "review");
    assert.equal(nextCreateProposalStep("review"), null);
    assert.equal(prevCreateProposalStep("review"), "package");
    assert.equal(prevCreateProposalStep("measurement"), null);
  });

  test("measurement detail is contractor-readable", () => {
    assert.equal(
      formatCreateProposalMeasurementDetail({
        selectedLabel: "Saved manual report",
        quantitiesLine: "2,500 sq ft · 10% waste",
      }),
      "Saved manual report · 2,500 sq ft · 10% waste"
    );
    assert.match(CREATE_PROPOSAL_MEASUREMENT_BLOCKED, /measurement/i);
  });

  test("template meta hides ids and shows ready counts", () => {
    const line = formatCreateProposalTemplateMetaLine({
      linkedItemCount: 13,
      packageCount: 3,
      ready: true,
    });
    assert.equal(line, "13 linked catalog items · 3 packages · Ready");
    assert.doesNotMatch(line, /source template|RAW_PLUS|smoke/i);
  });

  test("review included line", () => {
    assert.equal(
      formatCreateProposalIncludedLine({
        includedItemCount: 13,
        customerFacingLine: "Estimate packages · Terms · Warranty",
      }),
      "13 catalog items · Estimate packages · Terms · Warranty"
    );
  });

  test("Continue gates on measurement, template, package, and createEnabled", () => {
    assert.equal(
      canContinueCreateProposal({
        measurementReady: true,
        templateReady: true,
        packageSelected: true,
        packageIssueCount: 0,
        createEnabled: true,
      }),
      true
    );
    assert.equal(
      canContinueCreateProposal({
        measurementReady: false,
        templateReady: true,
        packageSelected: true,
        packageIssueCount: 0,
        createEnabled: true,
      }),
      false
    );
    assert.equal(
      canContinueCreateProposal({
        measurementReady: true,
        templateReady: false,
        packageSelected: true,
        packageIssueCount: 0,
        createEnabled: true,
      }),
      false
    );
    assert.equal(
      canContinueCreateProposal({
        measurementReady: true,
        templateReady: true,
        packageSelected: false,
        packageIssueCount: 0,
        createEnabled: true,
      }),
      false
    );
    assert.equal(
      canContinueCreateProposal({
        measurementReady: true,
        templateReady: true,
        packageSelected: true,
        packageIssueCount: 0,
        createEnabled: false,
      }),
      false
    );
  });

  test("template step hides internal/smoke templates", () => {
    const visible = filterContractorVisibleTemplates([
      { id: "roof", name: "Roof replacement" },
      { id: "raw", name: "RAW_PLUS_WASTE live smoke" },
      { id: "cov", name: "Coverage basis live smoke" },
    ]);
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.name, "Roof replacement");
  });
});
