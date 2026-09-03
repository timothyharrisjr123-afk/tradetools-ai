/**
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardCreateProposalModalModel.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filterContractorVisibleTemplates } from "@/app/lib/contractorFixtureIsolation";
import type { ProposalRecordStatusSummary } from "@/app/lib/proposalRecordTypes";
import {
  CREATE_PROPOSAL_MEASUREMENT_BLOCKED,
  PREPARE_PROPOSAL_CHANGE_LABEL,
  PREPARE_PROPOSAL_CREATE_LABEL,
  PREPARE_PROPOSAL_FOOTER,
  PREPARE_PROPOSAL_MEASUREMENT_REQUIRED,
  PREPARE_PROPOSAL_MEASUREMENT_CHOOSE,
  PREPARE_PROPOSAL_MEASUREMENT_LABEL,
  PREPARE_PROPOSAL_PACKAGE_CHOOSE,
  PREPARE_PROPOSAL_PACKAGE_LABEL,
  PREPARE_PROPOSAL_PACKAGE_NONE,
  PREPARE_PROPOSAL_SETUP_CHOOSE,
  PREPARE_PROPOSAL_SETUP_LABEL,
  PREPARE_PROPOSAL_SETUP_NONE,
  PREPARE_PROPOSAL_TITLE,
  buildCreateProposalMeasurementChoice,
  canCreatePrepareProposal,
  formatCreateProposalMeasurementSummary,
  formatCreateProposalMeasurementTitle,
  formatCreateProposalPackageCountLine,
  resolveCreateProposalPackageStepEyebrow,
  resolveCreateProposalPackageStepGuide,
  resolvePrepareProposalExpandedField,
  resolvePrepareProposalMeasurement,
  resolvePrepareProposalPackage,
  resolvePrepareProposalSetup,
} from "./jobCardCreateProposalModalModel";
import { filterJobCardCreateProposalTemplates } from "./jobCardProposalSetup";
import {
  JOB_CARD_PROPOSALS_ADD_LABEL,
  JOB_CARD_PROPOSALS_CREATE_LABEL,
  JOB_CARD_PROPOSALS_OPEN_LABEL,
  formatJobCardProposalRowTitle,
  buildJobCardProposalRowView,
} from "./jobCardProposalsTabModel";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function measurement(id: string, title: string) {
  return buildCreateProposalMeasurementChoice({
    id,
    selectedLabel: title,
    roofAreaSqft: 2500,
    wastePercent: 10,
    ready: true,
  });
}

describe("Prepare proposal V2A inference", () => {
  test("copy is restrained and contractor-facing", () => {
    assert.equal(PREPARE_PROPOSAL_TITLE, "Prepare proposal");
    assert.equal(PREPARE_PROPOSAL_MEASUREMENT_LABEL, "Measurement");
    assert.equal(PREPARE_PROPOSAL_SETUP_LABEL, "Template");
    assert.equal(PREPARE_PROPOSAL_PACKAGE_LABEL, "Starting package");
    assert.equal(PREPARE_PROPOSAL_CHANGE_LABEL, "Change");
    assert.equal(PREPARE_PROPOSAL_CREATE_LABEL, "Create proposal");
    assert.equal(PREPARE_PROPOSAL_FOOTER, "");
    assert.doesNotMatch(PREPARE_PROPOSAL_FOOTER, /accept|signature|payment|schedule/i);
    assert.doesNotMatch(PREPARE_PROPOSAL_FOOTER, /reusable setup/i);
    assert.doesNotMatch(PREPARE_PROPOSAL_PACKAGE_LABEL, /customer/i);
    assert.equal(JOB_CARD_PROPOSALS_ADD_LABEL, "+ Proposal");
    assert.equal(JOB_CARD_PROPOSALS_CREATE_LABEL, "Create proposal");
    assert.equal(JOB_CARD_PROPOSALS_OPEN_LABEL, "Open");
  });

  test("single valid measurement is prepared", () => {
    const field = resolvePrepareProposalMeasurement({
      eligible: [measurement("m1", "Saved manual")],
      selectedId: null,
    });
    assert.equal(field.state, "prepared");
    assert.equal(field.preparedId, "m1");
    assert.equal(field.valueLabel, "Saved manual report");
    assert.equal(field.showChange, false);
    assert.equal(field.showSelector, false);
  });

  test("canonical selected measurement is prepared among alternatives", () => {
    const field = resolvePrepareProposalMeasurement({
      eligible: [measurement("m1", "Saved manual"), measurement("m2", "Verified")],
      selectedId: "m2",
    });
    assert.equal(field.state, "alternative_available");
    assert.equal(field.preparedId, "m2");
    assert.equal(field.showChange, true);
  });

  test("multiple measurements without canonical truth require choice", () => {
    const field = resolvePrepareProposalMeasurement({
      eligible: [measurement("m1", "Saved manual"), measurement("m2", "Verified")],
      selectedId: null,
    });
    assert.equal(field.state, "choice_required");
    assert.equal(field.preparedId, null);
    assert.equal(field.valueLabel, PREPARE_PROPOSAL_MEASUREMENT_CHOOSE);
    assert.notEqual(field.preparedId, "m1");
  });

  test("no measurement blocks Create with exact fix path", () => {
    const field = resolvePrepareProposalMeasurement({
      eligible: [],
      selectedId: null,
    });
    assert.equal(field.state, "blocked");
    assert.equal(field.valueLabel, "Measurement required");
    assert.equal(field.fixPath, CREATE_PROPOSAL_MEASUREMENT_BLOCKED);
    assert.match(field.fixPath ?? "", /measurement report/i);
    assert.equal(field.showChange, false);
    assert.equal(
      canCreatePrepareProposal({
        measurement: "blocked",
        setup: "prepared",
        package: "prepared",
      }),
      false
    );
  });

  test("valid preferred setup is prepared", () => {
    const field = resolvePrepareProposalSetup({
      setups: [
        { id: "roof", name: "Roof Replacement", ready: true },
        { id: "repair", name: "Repair", ready: true },
      ],
      preferredId: "roof",
      starterId: "repair",
      explicitId: null,
    });
    assert.equal(field.state, "alternative_available");
    assert.equal(field.preparedId, "roof");
    assert.equal(field.valueLabel, "Roof Replacement");
    assert.equal(field.showChange, true);
  });

  test("one eligible setup fallback is prepared", () => {
    const field = resolvePrepareProposalSetup({
      setups: [{ id: "roof", name: "Roof Replacement", ready: true }],
      preferredId: null,
      starterId: null,
      explicitId: null,
    });
    assert.equal(field.state, "prepared");
    assert.equal(field.preparedId, "roof");
    assert.equal(field.showChange, false);
  });

  test("eligible company starter remains a named prepare rule", () => {
    const field = resolvePrepareProposalSetup({
      setups: [
        { id: "a", name: "A", ready: true },
        { id: "starter", name: "Roof Replacement", ready: true },
      ],
      preferredId: null,
      starterId: "starter",
      explicitId: null,
    });
    assert.equal(field.preparedId, "starter");
    assert.notEqual(field.preparedId, "a");
  });

  test("multiple setups without preference require choice", () => {
    const field = resolvePrepareProposalSetup({
      setups: [
        { id: "a", name: "A", ready: true },
        { id: "b", name: "B", ready: true },
      ],
      preferredId: null,
      starterId: null,
      explicitId: null,
    });
    assert.equal(field.state, "choice_required");
    assert.equal(field.preparedId, null);
    assert.equal(field.valueLabel, PREPARE_PROPOSAL_SETUP_CHOOSE);
  });

  test("archived setup cannot be prepared", () => {
    const field = resolvePrepareProposalSetup({
      setups: [
        { id: "arch", name: "Legacy", ready: true, archived: true },
        { id: "roof", name: "Roof Replacement", ready: true },
      ],
      preferredId: "arch",
      starterId: null,
      explicitId: null,
    });
    assert.equal(field.preparedId, "roof");
    assert.notEqual(field.preparedId, "arch");
  });

  test("no eligible setup blocks Create", () => {
    const field = resolvePrepareProposalSetup({
      setups: [{ id: "arch", name: "Legacy", ready: true, archived: true }],
      preferredId: "arch",
      starterId: null,
      explicitId: null,
    });
    assert.equal(field.state, "blocked");
    assert.equal(field.fixPath, PREPARE_PROPOSAL_SETUP_NONE);
    assert.equal(
      canCreatePrepareProposal({
        measurement: "prepared",
        setup: "blocked",
        package: "prepared",
      }),
      false
    );
  });

  test("starting package is prepared and alternatives expose Change", () => {
    const field = resolvePrepareProposalPackage({
      setupState: "prepared",
      choices: [
        {
          optionId: "std",
          label: "Standard",
          linkedItemCount: 8,
          availableUpgradeCount: 1,
          issueCount: 0,
          status: "ready",
        },
        {
          optionId: "enh",
          label: "Enhanced",
          linkedItemCount: 13,
          availableUpgradeCount: 2,
          issueCount: 0,
          status: "ready",
        },
      ],
      startingOptionId: "enh",
      explicitId: null,
      packagePresentationMode: "multi",
      graphReady: true,
    });
    assert.equal(field.state, "alternative_available");
    assert.equal(field.preparedId, "enh");
    assert.equal(field.valueLabel, "Enhanced");
    assert.equal(field.showChange, true);
  });

  test("one-package setup shows no unnecessary selector", () => {
    const field = resolvePrepareProposalPackage({
      setupState: "prepared",
      choices: [
        {
          optionId: "only",
          label: "Standard",
          linkedItemCount: 8,
          issueCount: 0,
          status: "ready",
        },
      ],
      startingOptionId: "only",
      explicitId: null,
      packagePresentationMode: "single",
      graphReady: true,
    });
    assert.equal(field.state, "prepared");
    assert.equal(field.preparedId, "only");
    assert.equal(field.showChange, false);
    assert.equal(field.showSelector, false);
  });

  test("invalid starting package requires package choice", () => {
    const field = resolvePrepareProposalPackage({
      setupState: "prepared",
      choices: [
        {
          optionId: "bad",
          label: "Broken",
          linkedItemCount: 0,
          issueCount: 2,
          status: "needs_attention",
        },
        {
          optionId: "good",
          label: "Enhanced",
          linkedItemCount: 13,
          issueCount: 0,
          status: "ready",
        },
        {
          optionId: "ok",
          label: "Premium",
          linkedItemCount: 16,
          issueCount: 0,
          status: "ready",
        },
      ],
      startingOptionId: "bad",
      explicitId: null,
      packagePresentationMode: "multi",
      graphReady: true,
    });
    assert.equal(field.state, "choice_required");
    assert.equal(field.preparedId, null);
    assert.equal(field.valueLabel, PREPARE_PROPOSAL_PACKAGE_CHOOSE);
    assert.notEqual(field.preparedId, "good");
  });

  test("invalid or removed package cannot be prepared", () => {
    const field = resolvePrepareProposalPackage({
      setupState: "prepared",
      choices: [
        {
          optionId: "bad",
          label: "Broken",
          linkedItemCount: 0,
          issueCount: 1,
          status: "needs_attention",
        },
      ],
      startingOptionId: "bad",
      explicitId: "bad",
      packagePresentationMode: "single",
      graphReady: true,
    });
    assert.equal(field.state, "blocked");
    assert.equal(field.preparedId, null);
    assert.equal(field.fixPath, PREPARE_PROPOSAL_PACKAGE_NONE);
  });

  test("changing setup recomputes package validity without first-item fallback", () => {
    const before = resolvePrepareProposalPackage({
      setupState: "prepared",
      choices: [
        {
          optionId: "enh",
          label: "Enhanced",
          linkedItemCount: 13,
          issueCount: 0,
          status: "ready",
        },
      ],
      startingOptionId: "enh",
      explicitId: "enh",
      packagePresentationMode: "single",
      graphReady: true,
    });
    assert.equal(before.preparedId, "enh");

    const after = resolvePrepareProposalPackage({
      setupState: "prepared",
      choices: [
        {
          optionId: "a",
          label: "A",
          linkedItemCount: 4,
          issueCount: 0,
          status: "ready",
        },
        {
          optionId: "b",
          label: "B",
          linkedItemCount: 8,
          issueCount: 0,
          status: "ready",
        },
      ],
      startingOptionId: null,
      explicitId: "enh",
      packagePresentationMode: "multi",
      graphReady: true,
    });
    assert.equal(after.state, "choice_required");
    assert.equal(after.preparedId, null);
    assert.notEqual(after.preparedId, "a");
  });

  test("setup with no valid package blocks Create", () => {
    const field = resolvePrepareProposalPackage({
      setupState: "prepared",
      choices: [],
      startingOptionId: null,
      explicitId: null,
      packagePresentationMode: "simple",
      graphReady: true,
    });
    assert.equal(field.state, "blocked");
    assert.equal(field.fixPath, PREPARE_PROPOSAL_PACKAGE_NONE);
    assert.equal(
      canCreatePrepareProposal({
        measurement: "prepared",
        setup: "prepared",
        package: "blocked",
      }),
      false
    );
  });

  test("choice required expands only that field", () => {
    const measurement = resolvePrepareProposalMeasurement({
      eligible: [
        buildCreateProposalMeasurementChoice({
          id: "m1",
          selectedLabel: "Saved manual",
          ready: true,
        }),
        buildCreateProposalMeasurementChoice({
          id: "m2",
          selectedLabel: "Verified",
          ready: true,
        }),
      ],
      selectedId: null,
    });
    const setup = resolvePrepareProposalSetup({
      setups: [{ id: "roof", name: "Roof Replacement", ready: true }],
      preferredId: "roof",
      starterId: null,
      explicitId: null,
    });
    const pkg = resolvePrepareProposalPackage({
      setupState: setup.state,
      choices: [
        {
          optionId: "enh",
          label: "Enhanced",
          linkedItemCount: 13,
          issueCount: 0,
          status: "ready",
        },
      ],
      startingOptionId: "enh",
      explicitId: null,
      packagePresentationMode: "single",
      graphReady: true,
    });
    assert.equal(
      resolvePrepareProposalExpandedField({
        measurement,
        setup,
        package: pkg,
        contractorExpanded: null,
      }),
      "measurement"
    );
    assert.equal(
      resolvePrepareProposalExpandedField({
        measurement,
        setup,
        package: pkg,
        contractorExpanded: "setup",
      }),
      null
    );
  });

  test("Create stays disabled until every field is prepared", () => {
    assert.equal(
      canCreatePrepareProposal({
        measurement: "prepared",
        setup: "alternative_available",
        package: "prepared",
      }),
      true
    );
    assert.equal(
      canCreatePrepareProposal({
        measurement: "choice_required",
        setup: "prepared",
        package: "prepared",
      }),
      false
    );
  });
});

describe("Prepare proposal V2A write boundary and wiring", () => {
  test("old four-step wizard is removed from the Job Card modal", () => {
    const modal = read("app/tools/roofing/jobCard/JobCardCreateProposalModal.tsx");
    const model = read(
      "app/tools/roofing/jobCard/jobCardCreateProposalModalModel.ts"
    );
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(modal, /PREPARE_PROPOSAL_TITLE/);
    assert.match(modal, /data-jobcard-prepare-proposal/);
    assert.match(model, /Prepare proposal/);
    assert.doesNotMatch(modal, /Create proposal steps/);
    assert.doesNotMatch(modal, /data-jobcard-create-proposal-steps/);
    assert.doesNotMatch(modal, /data-jobcard-create-proposal-panel-review/);
    assert.doesNotMatch(modal, /Use this measurement/);
    assert.doesNotMatch(modal, /Continue to Builder/);
    assert.doesNotMatch(model, /CREATE_PROPOSAL_STEPS/);
    assert.doesNotMatch(client, /createProposalModalStep/);
    assert.match(client, /onCreateProposal=\{handleCreateNewProposalDraft\}/);
    assert.match(client, /createNewProposalDraftEntry/);
    assert.doesNotMatch(modal, /useEffect/);
    assert.match(client, /createProposalModalOpen \? \(/);
  });

  test("expanded selector uses radio semantics and no loose Selected label", () => {
    const modal = read("app/tools/roofing/jobCard/JobCardCreateProposalModal.tsx");
    assert.match(modal, /role="radiogroup"/);
    assert.match(modal, /role="radio"/);
    assert.match(modal, /aria-checked/);
    assert.match(modal, /data-jobcard-prepare-radio/);
    assert.match(modal, /onSelectorKeyDown/);
    assert.doesNotMatch(modal, />\s*Selected\s*</);
    assert.equal(PREPARE_PROPOSAL_MEASUREMENT_REQUIRED, "Measurement required");
  });

  test("opening, changing, and cancel do not create; only Create proposal does", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    const openBlock = client.slice(
      client.indexOf("const openCreateProposalModal"),
      client.indexOf("const closeCreateProposalModal")
    );
    const closeBlock = client.slice(
      client.indexOf("const closeCreateProposalModal"),
      client.indexOf("const visibleCreateProposalTemplates")
    );
    const createBlock = client.slice(
      client.indexOf("const handleCreateNewProposalDraft"),
      client.indexOf("const handleNormalizeAndOpenJobCard")
    );
    assert.doesNotMatch(openBlock, /createNewProposalDraftEntry/);
    assert.doesNotMatch(closeBlock, /createNewProposalDraftEntry/);
    assert.match(createBlock, /createNewProposalDraftEntry/);
    assert.match(createBlock, /proposalLaunchInFlightRef\.current/);
    assert.match(createBlock, /setProposalLaunchError/);
    assert.match(
      createBlock,
      /router\.push\(buildProposalBuilderHref\(currentJobId, result\.proposalId\)\)/
    );
    assert.doesNotMatch(createBlock, /resolveOrCreateProposalDraftEntry/);
    assert.match(
      client,
      /selected_template_option_id: jobCardPackageSetup\.selectedOptionId/
    );
  });

  test("measurement first-item fallback is gone", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    const openBlock = client.slice(
      client.indexOf("const openCreateProposalModal"),
      client.indexOf("const closeCreateProposalModal")
    );
    assert.match(openBlock, /resolvePrepareProposalMeasurement/);
    assert.doesNotMatch(openBlock, /choices\[0\]/);
  });

  test("existing proposal rows still open Builder with job + proposal ids", () => {
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /onProposalAction/);
    assert.match(client, /buildProposalBuilderHref\(currentJobId, proposalId\)/);
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
        draft_content_changed_at: "2026-07-20T15:00:00.000Z",
      } satisfies ProposalRecordStatusSummary,
      packageLabel: "Standard",
      templateName: "Roof replacement",
    });
    assert.equal(formatJobCardProposalRowTitle({
      title: "Roof replacement",
      packageLabel: "Enhanced",
    }), "Roof replacement");
    assert.equal(row.packageLabel, "Standard");
  });

  test("preferred setup and create-modal template filter stay in place", () => {
    const visible = filterContractorVisibleTemplates([
      { id: "roof", name: "Roof replacement" },
      { id: "raw", name: "RAW_PLUS_WASTE live smoke" },
    ]);
    assert.equal(visible.length, 1);
    const createList = filterJobCardCreateProposalTemplates([
      { id: "roof", name: "Roof replacement", status: "active" },
      {
        id: "arch",
        name: "Roof replacement (legacy pre-upgrade-truth)",
        status: "archived",
      },
    ]);
    assert.equal(createList.length, 1);
    assert.equal(createList[0]?.id, "roof");
    const client = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(client, /getPreferredSetupTemplateId/);
    assert.match(client, /preferredSetupTemplateId/);
  });

  test("measurement formatters stay contractor-facing", () => {
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
    assert.equal(
      formatCreateProposalPackageCountLine({
        linkedItemCount: 13,
        availableUpgradeCount: 1,
      }),
      "13 included · 1 optional upgrade"
    );
    assert.match(
      resolveCreateProposalPackageStepEyebrow("multi", 4),
      /4 packages/i
    );
    assert.match(
      resolveCreateProposalPackageStepGuide("multi", 4),
      /Choose from 4 package options/i
    );
  });
});
