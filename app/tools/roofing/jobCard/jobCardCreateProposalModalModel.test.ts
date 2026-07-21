/**
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardCreateProposalModalModel.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { filterContractorVisibleTemplates } from "@/app/lib/contractorFixtureIsolation";
import {
  CREATE_PROPOSAL_CONTINUE_TO_BUILDER,
  CREATE_PROPOSAL_HELPER,
  CREATE_PROPOSAL_INCLUDED_PRIMARY,
  CREATE_PROPOSAL_MEASUREMENT_BLOCKED,
  CREATE_PROPOSAL_MEASUREMENT_GUIDE,
  CREATE_PROPOSAL_MODAL_TITLE,
  CREATE_PROPOSAL_PACKAGE_GUIDE,
  CREATE_PROPOSAL_PACKAGE_ONE_ONLY,
  CREATE_PROPOSAL_REVIEW_TITLE,
  CREATE_PROPOSAL_TEMPLATE_BLOCKED,
  CREATE_PROPOSAL_TEMPLATE_GUIDE,
  CREATE_PROPOSAL_TEMPLATE_READY,
  CREATE_PROPOSAL_TEMPLATE_STRUCTURE,
  CREATE_PROPOSAL_USE_MEASUREMENT,
  CREATE_PROPOSAL_USE_TEMPLATE,
  buildCreateProposalMeasurementChoice,
  canContinueCreateProposal,
  formatCreateProposalIncludedPrimary,
  formatCreateProposalMeasurementSummary,
  formatCreateProposalMeasurementTitle,
  formatCreateProposalPricingItemsReady,
  formatCreateProposalTemplateMetaLine,
  formatCreateProposalTemplateSecondaryDetail,
  nextCreateProposalStep,
  prevCreateProposalStep,
  resolveCreateProposalTemplateStepMessage,
} from "./jobCardCreateProposalModalModel";
import {
  JOB_CARD_PROPOSALS_ADD_LABEL,
  JOB_CARD_PROPOSALS_CREATE_LABEL,
  JOB_CARD_PROPOSALS_OPEN_LABEL,
  formatJobCardProposalRowTitle,
  buildJobCardProposalRowView,
} from "./jobCardProposalsTabModel";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";

describe("jobCardCreateProposalModalModel polish", () => {
  test("approved modal copy stays contractor-facing", () => {
    assert.equal(CREATE_PROPOSAL_MODAL_TITLE, "Create proposal");
    assert.equal(CREATE_PROPOSAL_USE_MEASUREMENT, "Use this measurement");
    assert.equal(CREATE_PROPOSAL_USE_TEMPLATE, "Use this template");
    assert.equal(CREATE_PROPOSAL_CONTINUE_TO_BUILDER, "Continue to Builder");
    assert.equal(CREATE_PROPOSAL_HELPER, "Existing proposals are not changed.");
    assert.equal(CREATE_PROPOSAL_REVIEW_TITLE, "Ready to build proposal");
    assert.doesNotMatch(CREATE_PROPOSAL_REVIEW_TITLE, /field|admin|draft/i);
    assert.match(CREATE_PROPOSAL_MEASUREMENT_GUIDE, /completed measurement/i);
    assert.match(CREATE_PROPOSAL_TEMPLATE_GUIDE, /proposal structure/i);
    assert.match(CREATE_PROPOSAL_PACKAGE_GUIDE, /change it later in Builder/i);
    assert.equal(CREATE_PROPOSAL_PACKAGE_ONE_ONLY, "This template has one package.");
    assert.equal(JOB_CARD_PROPOSALS_ADD_LABEL, "+ Proposal");
    assert.equal(JOB_CARD_PROPOSALS_CREATE_LABEL, "Create proposal");
    assert.equal(JOB_CARD_PROPOSALS_OPEN_LABEL, "Open");
    assert.doesNotMatch(CREATE_PROPOSAL_CONTINUE_TO_BUILDER, /Create proposal draft/i);
    assert.doesNotMatch(CREATE_PROPOSAL_HELPER, /Create another proposal/i);
  });

  test("step navigation order", () => {
    assert.equal(nextCreateProposalStep("measurement"), "template");
    assert.equal(nextCreateProposalStep("template"), "package");
    assert.equal(nextCreateProposalStep("package"), "review");
    assert.equal(nextCreateProposalStep("review"), null);
    assert.equal(prevCreateProposalStep("review"), "package");
    assert.equal(prevCreateProposalStep("measurement"), null);
  });

  test("measurement step uses contractor-facing title and summary", () => {
    assert.equal(
      formatCreateProposalMeasurementTitle("Saved manual"),
      "Saved manual report"
    );
    assert.equal(
      formatCreateProposalMeasurementSummary({
        roofAreaSqft: 2500,
        wastePercent: 10,
        ready: true,
      }),
      "2,500 sq ft · 10% waste · Report complete"
    );
    assert.doesNotMatch(
      formatCreateProposalMeasurementSummary({
        roofAreaSqft: 2500,
        wastePercent: 10,
      }),
      /adj SQ|roof_squares/i
    );
    assert.match(CREATE_PROPOSAL_MEASUREMENT_BLOCKED, /measurement/i);
  });

  test("measurement choices support multiple ready records", () => {
    const a = buildCreateProposalMeasurementChoice({
      id: "m1",
      selectedLabel: "Saved manual",
      roofAreaSqft: 2500,
      wastePercent: 10,
      ready: true,
    });
    const b = buildCreateProposalMeasurementChoice({
      id: "m2",
      selectedLabel: "Verified",
      roofAreaSqft: 1800,
      wastePercent: 12,
      ready: true,
    });
    assert.equal(a.id, "m1");
    assert.equal(a.title, "Saved manual report");
    assert.match(a.summaryLine, /2,500 sq ft/);
    assert.equal(b.id, "m2");
    assert.notEqual(a.id, b.id);
  });

  test("template step uses structure copy — not linked catalog admin text", () => {
    assert.match(CREATE_PROPOSAL_TEMPLATE_STRUCTURE, /estimate/i);
    assert.match(CREATE_PROPOSAL_TEMPLATE_STRUCTURE, /terms/i);
    assert.match(CREATE_PROPOSAL_TEMPLATE_STRUCTURE, /customer-facing sections/i);
    assert.doesNotMatch(CREATE_PROPOSAL_TEMPLATE_STRUCTURE, /customer proposal pages/i);
    assert.equal(CREATE_PROPOSAL_TEMPLATE_READY, "Ready to use");
    assert.equal(formatCreateProposalTemplateMetaLine({
      linkedItemCount: 13,
      packageCount: 3,
      ready: true,
    }), "Ready to use");
    const secondary = formatCreateProposalTemplateSecondaryDetail({
      linkedItemCount: 13,
      packageCount: 3,
    });
    assert.equal(secondary, "13 pricing items · 3 packages");
    assert.doesNotMatch(secondary, /linked catalog|pricing items ready/i);
    assert.doesNotMatch(CREATE_PROPOSAL_TEMPLATE_STRUCTURE, /linked catalog|source template/i);
  });

  test("review included content is contractor-facing", () => {
    assert.equal(
      CREATE_PROPOSAL_INCLUDED_PRIMARY,
      "Estimate · Package details · Terms · Warranty · Customer-facing sections"
    );
    assert.doesNotMatch(CREATE_PROPOSAL_INCLUDED_PRIMARY, /customer proposal pages/i);
    assert.doesNotMatch(CREATE_PROPOSAL_INCLUDED_PRIMARY, /Package options/i);
    assert.equal(
      formatCreateProposalIncludedPrimary("13 linked catalog items · Terms"),
      CREATE_PROPOSAL_INCLUDED_PRIMARY
    );
    assert.equal(
      formatCreateProposalPricingItemsReady(13),
      "13 pricing items ready"
    );
    assert.doesNotMatch(CREATE_PROPOSAL_INCLUDED_PRIMARY, /linked catalog/i);
    assert.doesNotMatch(CREATE_PROPOSAL_REVIEW_TITLE, /draft/i);
  });

  test("Continue gates unchanged", () => {
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
  });

  test("orange template blocker only when no templates or selected is truly unusable", () => {
    assert.equal(
      resolveCreateProposalTemplateStepMessage({
        templatesLength: 0,
        selectedTemplateId: null,
        templateReady: false,
        selectedUnusableReason: null,
      }),
      CREATE_PROPOSAL_TEMPLATE_BLOCKED
    );
    assert.match(CREATE_PROPOSAL_TEMPLATE_BLOCKED, /Create or finish/i);

    // Templates exist; nothing selected / still loading → no global orange block
    assert.equal(
      resolveCreateProposalTemplateStepMessage({
        templatesLength: 2,
        selectedTemplateId: "t1",
        templateReady: false,
        selectedUnusableReason: null,
      }),
      null
    );
    assert.equal(
      resolveCreateProposalTemplateStepMessage({
        templatesLength: 2,
        selectedTemplateId: "t1",
        templateReady: true,
        selectedUnusableReason: null,
      }),
      null
    );

    // Selected template loaded and unusable → quiet reason only
    assert.equal(
      resolveCreateProposalTemplateStepMessage({
        templatesLength: 2,
        selectedTemplateId: "t-bad",
        templateReady: false,
        selectedUnusableReason:
          "This template needs included Catalog items before it can start a proposal.",
      }),
      "This template needs included Catalog items before it can start a proposal."
    );
  });

  test("Job Card create flow remains Measurement → Template → Package → Review → Builder", () => {
    assert.deepEqual(
      [
        nextCreateProposalStep("measurement"),
        nextCreateProposalStep("template"),
        nextCreateProposalStep("package"),
        nextCreateProposalStep("review"),
      ],
      ["template", "package", "review", null]
    );
    assert.equal(CREATE_PROPOSAL_CONTINUE_TO_BUILDER, "Continue to Builder");
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

  test("proposal rows use package badge not title link text", () => {
    assert.equal(
      formatJobCardProposalRowTitle({
        title: "Roof replacement",
        packageLabel: "Enhanced",
      }),
      "Roof replacement"
    );
    const row = buildJobCardProposalRowView({
      summary: {
        id: "p1",
        job_id: "j1",
        status: "draft",
        title: "Roof replacement",
        proposal_number: null,
        template_id: "t1",
        selected_option_id: "o1",
        latest_sent_version_id: null,
        signed_version_id: null,
        created_at: null,
        updated_at: "2026-07-20T15:00:00.000Z",
      } satisfies ProposalRecordStatusSummary,
      packageLabel: "Standard",
      templateName: "Roof replacement",
    });
    assert.equal(row.title, "Roof replacement");
    assert.equal(row.packageLabel, "Standard");
    assert.match(row.metaLine, /^Draft · Updated/);
    assert.doesNotMatch(row.metaLine, /Standard package/);
  });
});
