/**
 * Commercial Wedge Group 3 — trusted measurement in Prepare.
 * Run: npx tsx --test app/lib/commercialWedgeGroup3.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildManualMeasurementDraftFromFields,
  isManualMeasurementEstimateReady,
} from "./jobCardManualMeasurementDraft";
import {
  CREATE_PROPOSAL_MEASUREMENT_BLOCKED,
  PREPARE_PROPOSAL_ADD_MEASUREMENT_LABEL,
  PREPARE_PROPOSAL_MEASUREMENT_CAPTURE_HINT,
  canCreatePrepareProposal,
  resolvePrepareProposalMeasurement,
} from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("missing measurement stays contextual in Prepare", () => {
  test("blocked measurement keeps Add measurement in Prepare modal", () => {
    const field = resolvePrepareProposalMeasurement({
      eligible: [],
      selectedId: null,
    });
    assert.equal(field.state, "blocked");
    assert.equal(field.valueLabel, "Measurement required");
    assert.equal(field.fixPath, CREATE_PROPOSAL_MEASUREMENT_BLOCKED);
    assert.match(CREATE_PROPOSAL_MEASUREMENT_BLOCKED, /roof numbers/i);
    assert.equal(PREPARE_PROPOSAL_ADD_MEASUREMENT_LABEL, "Add measurement");

    const modal = read("app/tools/roofing/jobCard/JobCardCreateProposalModal.tsx");
    assert.match(modal, /data-jobcard-prepare-add-measurement/);
    assert.match(modal, /onAddMeasurement/);
    assert.doesNotMatch(modal, /\/tools\/roofing\/measurements|Go to Measurements/i);
  });

  test("no manual trip to Measurements tab required", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    const client = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.match(hook, /type CaptureOrigin = "tab" \| "prepare"/);
    assert.match(hook, /const openCapture = useCallback/);
    assert.match(client, /openCapture\("prepare", "add"\)/);
    assert.match(client, /data-jobcard-prepare-measurement-capture/);
    assert.doesNotMatch(hook, /setJobCardTab\("measurements"\)/);
  });
});

describe("canonical measurement writer reused", () => {
  test("Prepare save uses createMeasurementRecord / selectMeasurementRecord", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /createMeasurementRecord/);
    assert.match(hook, /selectMeasurementRecord/);
    assert.match(hook, /buildManualMeasurementDraftFromFields/);
    assert.doesNotMatch(hook, /localStorage/);
    assert.doesNotMatch(hook, /onboardingMeasurement|temporaryQuantity|firstProposalQuantity/i);
  });

  test("minimum required fields only — estimate-ready quartet", () => {
    assert.equal(
      isManualMeasurementEstimateReady({
        roof_area_sqft: 2400,
        waste_percent: 10,
        pitch_label: "6/12",
        stories: "1",
      }),
      true
    );
    assert.equal(
      isManualMeasurementEstimateReady({
        roof_area_sqft: 0,
        waste_percent: 10,
        pitch_label: "6/12",
        stories: "1",
      }),
      false
    );
    const capture = read("app/tools/roofing/jobCard/JobCardMeasurementCapture.tsx");
    assert.match(capture, /Roof area \(sq ft\)/);
    assert.match(capture, /Waste \(%\)/);
    assert.match(capture, /Pitch/);
    assert.match(capture, /Stories/);
    assert.doesNotMatch(capture, /Ridge \(lf\)|Valley \(lf\)|Eave \(lf\)|aerial|upload report/i);
  });
});

describe("missing measurement ≠ zero / invalid cannot create", () => {
  test("zero area is not estimate-ready", () => {
    assert.equal(
      isManualMeasurementEstimateReady({
        roof_area_sqft: 0,
        waste_percent: 10,
        pitch_label: "6/12",
        stories: "1",
      }),
      false
    );
  });

  test("missing waste is not estimate-ready (not invented)", () => {
    assert.equal(
      isManualMeasurementEstimateReady({
        roof_area_sqft: 2400,
        waste_percent: Number.NaN,
        pitch_label: "6/12",
        stories: "1",
      }),
      false
    );
  });

  test("Prepare create blocked without measurement", () => {
    assert.equal(
      canCreatePrepareProposal({
        measurement: "blocked",
        setup: "prepared",
        package: "prepared",
      }),
      false
    );
  });
});

describe("canonical current truth + report source", () => {
  test("draft writer stamps estimate_ready and optional report_source", () => {
    const draft = buildManualMeasurementDraftFromFields({
      companyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      jobId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      fields: {
        roof_area_sqft: 2400,
        waste_percent: 12,
        pitch_label: "6/12",
        stories: "2",
        report_source: "EagleView",
      },
    });
    assert.equal(draft.estimate_ready, true);
    assert.equal(draft.report_source, "EagleView");
    assert.equal(draft.source_type, "manual");
    assert.equal(draft.roof_squares, 24);
    assert.ok(draft.adjusted_roof_squares != null);
  });

  test("blank report source defaults Manual without inventing quantities", () => {
    const draft = buildManualMeasurementDraftFromFields({
      companyId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      jobId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      fields: {
        roof_area_sqft: 1800,
        waste_percent: 0,
        pitch_label: "5/12",
        stories: "1",
      },
    });
    assert.equal(draft.report_source, "Manual");
    assert.equal(draft.waste_percent, 0);
  });
});

describe("selection / stale rules preserved", () => {
  test("eligible filter excludes stale and rejected", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /status !== "stale"/);
    assert.match(hook, /status !== "rejected"/);
    assert.match(hook, /canMakeMeasurementCurrent/);
  });

  test("resolvePrepare never first-of-many without selection", () => {
    const field = resolvePrepareProposalMeasurement({
      eligible: [
        { id: "a", title: "A", summaryLine: "1", ready: true },
        { id: "b", title: "B", summaryLine: "2", ready: true },
      ],
      selectedId: null,
    });
    assert.equal(field.state, "choice_required");
    assert.equal(field.preparedId, null);
  });

  test("existing valid measurement prepares without first-run Add path state", () => {
    const field = resolvePrepareProposalMeasurement({
      eligible: [{ id: "m1", title: "Saved manual", summaryLine: "2,400 sq ft", ready: true }],
      selectedId: "m1",
    });
    assert.equal(field.state, "prepared");
    assert.equal(field.preparedId, "m1");
  });
});

describe("retry / duplicate guards", () => {
  test("measurement save and proposal create use in-flight refs", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /saveInFlightRef/);
    assert.match(hook, /createInFlightRef/);
  });
});

describe("Group 2 pricing + trusted measurement language preserved", () => {
  test("Prepare still wires pricing rules and catalog prices", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /upsertCompanyPricingPolicy/);
    assert.match(hook, /saveFirstProposalPrices/);
    assert.match(hook, /updateCatalogItem/);
  });

  test("capture uses trusted-report wording, not acquisition theater", () => {
    assert.match(PREPARE_PROPOSAL_MEASUREMENT_CAPTURE_HINT, /report you already trust/i);
    const capture = read("app/tools/roofing/jobCard/JobCardMeasurementCapture.tsx");
    const client = read("app/tools/roofing/jobCard/JobCardClient.tsx");
    assert.match(client, /PREPARE_PROPOSAL_MEASUREMENT_CAPTURE_HINT/);
    assert.doesNotMatch(capture, /instant measurement|aerial|satellite|drone|coming soon|order report/i);
  });
});
