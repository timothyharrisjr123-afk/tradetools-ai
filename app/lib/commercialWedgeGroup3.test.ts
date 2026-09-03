/**
 * Commercial Wedge Group 3 — quantity ownership + sendable first proposal.
 * Run: npx tsx --test app/lib/commercialWedgeGroup3.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "./defaultRoofingCatalog";
import { ROOF_REPLACEMENT_CORE_LINE_ITEMS } from "./defaultRoofingProposalTemplates";
import {
  JOB_SCOPE_CAPTURE_FIELDS,
  REPORT_GEOMETRY_CAPTURE_FIELDS,
  STARTER_QUANTITY_OWNERSHIP,
  countUnresolvedRequiredLineQuantities,
} from "./firstProposalQuantityOwnership";
import {
  buildManualMeasurementDraftFromFields,
  isManualMeasurementEstimateReady,
  isManualMeasurementStarterQuantityInputComplete,
  type JobCardManualMeasurementFields,
} from "./jobCardManualMeasurementDraft";
import type { MeasurementRecord } from "./measurementTypes";
import {
  deriveProposalQuantitySummary,
  deriveQuantityMapFromRecord,
  type MeasurementProposalHandoff,
} from "./measurementProposalHandoff";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";
import {
  CREATE_PROPOSAL_MEASUREMENT_BLOCKED,
  PREPARE_PROPOSAL_ADD_MEASUREMENT_LABEL,
  PREPARE_PROPOSAL_MEASUREMENT_CAPTURE_HINT,
  canCreatePrepareProposal,
  resolvePrepareProposalMeasurement,
} from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";
import { JOB_CARD_PROPOSAL_STATUS_READY_TO_PREPARE } from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const COMPANY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const JOB_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function completeStarterFields(
  overrides: Partial<JobCardManualMeasurementFields> = {}
): JobCardManualMeasurementFields {
  return {
    roof_area_sqft: 2400,
    waste_percent: 10,
    pitch_label: "6/12",
    stories: "1",
    eaves_lf: 120,
    rakes_lf: 80,
    ridges_lf: 40,
    hips_lf: 24,
    valleys_lf: 32,
    step_flashing_lf: 16,
    pipe_boots_count: 3,
    vents_count: 2,
    tear_off_required: true,
    debris_tons_estimate: 2.5,
    ...overrides,
  };
}

function quartetOnlyFields(): JobCardManualMeasurementFields {
  return {
    roof_area_sqft: 2400,
    waste_percent: 10,
    pitch_label: "6/12",
    stories: "1",
  };
}

function starterCatalogItems(): CatalogItem[] {
  return DEFAULT_ROOFING_CATALOG_DEFINITIONS.map((definition) => ({
    ...definition,
    id: definition.metadata.seed_key,
    company_id: COMPANY_ID,
    active: true,
  }));
}

function coreTemplateItems(): ProposalTemplateItem[] {
  return ROOF_REPLACEMENT_CORE_LINE_ITEMS.map((item, index) => ({
    id: `line-${index}`,
    template_id: "tpl",
    option_id: "opt",
    section_id: "sec",
    catalog_item_id: item.catalog_seed_key,
    catalog_seed_key: item.catalog_seed_key,
    item_role: item.item_role ?? "standard",
    quantity_rule: item.quantity_rule ?? { mode: "inherit_catalog" },
    sort_order: item.sort_order ?? index,
  }));
}

function eavesIceWaterItem(): ProposalTemplateItem {
  return {
    id: "line-ice-eaves",
    template_id: "tpl",
    option_id: "opt",
    section_id: "sec",
    catalog_item_id: "roofing.ice_water_eaves",
    catalog_seed_key: "roofing.ice_water_eaves",
    item_role: "standard",
    quantity_rule: { mode: "inherit_catalog" },
    sort_order: 65,
  };
}

function resolveFromFields(fields: JobCardManualMeasurementFields, extraItems: ProposalTemplateItem[] = []) {
  const draft = buildManualMeasurementDraftFromFields({
    companyId: COMPANY_ID,
    jobId: JOB_ID,
    fields,
  });
  const record = { ...draft, id: "m1" } as MeasurementRecord;
  const handoff: MeasurementProposalHandoff = {
    proposalReady: true,
    blockers: [],
    selectedLabel: "Saved manual",
    quantities: deriveProposalQuantitySummary(record),
    estimateReady: true,
    productionReady: false,
  };
  return countUnresolvedRequiredLineQuantities({
    items: [...coreTemplateItems(), ...extraItems],
    catalogItems: starterCatalogItems(),
    measurementHandoff: handoff,
    quantityMap: deriveQuantityMapFromRecord(record),
  });
}

describe("quantity ownership mapping remains canonical", () => {
  test("Standard 13 core lines plus Enhanced/Premium eaves ice & water are owned", () => {
    const standard = STARTER_QUANTITY_OWNERSHIP.filter((row) =>
      row.packages.includes("Standard")
    );
    assert.equal(standard.length, 13);
    assert.equal(
      STARTER_QUANTITY_OWNERSHIP.some(
        (row) =>
          row.catalogSeedKey === "roofing.ice_water_eaves" &&
          row.packages.includes("Enhanced") &&
          row.packages.includes("Premium") &&
          !row.packages.includes("Standard")
      ),
      true
    );
    assert.equal(
      STARTER_QUANTITY_OWNERSHIP.every((row) => row.owner !== "D"),
      true
    );
  });

  test("report geometry vs job-scope capture fields stay separate", () => {
    assert.ok(REPORT_GEOMETRY_CAPTURE_FIELDS.includes("eaves_lf"));
    assert.ok(REPORT_GEOMETRY_CAPTURE_FIELDS.includes("valleys_lf"));
    assert.ok(JOB_SCOPE_CAPTURE_FIELDS.includes("pipe_boots_count"));
    assert.ok(JOB_SCOPE_CAPTURE_FIELDS.includes("vents_count"));
    assert.ok(JOB_SCOPE_CAPTURE_FIELDS.includes("tear_off_required"));
    assert.ok(JOB_SCOPE_CAPTURE_FIELDS.includes("debris_tons_estimate"));
    assert.equal(
      REPORT_GEOMETRY_CAPTURE_FIELDS.some((field) =>
        (JOB_SCOPE_CAPTURE_FIELDS as readonly string[]).includes(field)
      ),
      false
    );
  });
});

describe("Prepare cannot create while required quantities are unresolved", () => {
  test("estimate-ready quartet still leaves nine Standard lines unresolved", () => {
    assert.equal(isManualMeasurementEstimateReady(quartetOnlyFields()), true);
    assert.equal(isManualMeasurementStarterQuantityInputComplete(quartetOnlyFields()), false);
    assert.equal(resolveFromFields(quartetOnlyFields()), 9);
    assert.equal(
      canCreatePrepareProposal({
        measurement: "prepared",
        setup: "prepared",
        package: "prepared",
        unresolvedRequiredQuantityCount: 9,
      }),
      false
    );
  });

  test("hook createEnabled requires unresolvedRequiredQuantityCount === 0", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /countUnresolvedRequiredPackageQuantities/);
    assert.match(hook, /unresolvedRequiredQuantityCount === 0/);
    assert.match(hook, /if \(unresolvedRequiredQuantityCount !== 0\) return/);
  });
});

describe("complete canonical inputs resolve to zero required blockers", () => {
  test("Standard core lines resolve when report geometry + job scope are entered", () => {
    const fields = completeStarterFields();
    assert.equal(isManualMeasurementStarterQuantityInputComplete(fields), true);
    assert.equal(resolveFromFields(fields), 0);
    assert.equal(
      canCreatePrepareProposal({
        measurement: "prepared",
        setup: "prepared",
        package: "prepared",
        unresolvedRequiredQuantityCount: 0,
      }),
      true
    );
  });

  test("Enhanced eaves ice & water resolves from eaves_lf without extra math", () => {
    assert.equal(resolveFromFields(completeStarterFields(), [eavesIceWaterItem()]), 0);
  });

  test("starter and drip derive from eaves + rakes; ridge cap from ridges + hips", () => {
    const draft = buildManualMeasurementDraftFromFields({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      fields: completeStarterFields({ hips_lf: Number.NaN }),
    });
    const map = deriveQuantityMapFromRecord({ ...draft, id: "m1" } as MeasurementRecord);
    assert.equal(map.starter_lf, 200);
    assert.equal(map.drip_edge_lf, 200);
    assert.equal(map.ridge_cap_lf, 40);
  });
});

describe("job-specific counts are not mislabeled as report measurements", () => {
  test("capture keeps report geometry and job scope in separate groups", () => {
    const capture = read("app/tools/roofing/jobCard/JobCardMeasurementCapture.tsx");
    assert.match(capture, /data-jobcard-measurement-report-group/);
    assert.match(capture, /data-jobcard-measurement-scope-group/);
    assert.match(capture, /From the report/);
    assert.match(capture, /This job/);
    assert.match(capture, /Eaves \(lf\)/);
    assert.match(capture, /Pipe boots/);
    assert.match(capture, /Roof vents/);
    assert.doesNotMatch(
      capture,
      /data-jobcard-measurement-report-group[\s\S]*Pipe boots[\s\S]*data-jobcard-measurement-scope-group/
    );
    const reportBlock = capture.slice(
      capture.indexOf("data-jobcard-measurement-report-group"),
      capture.indexOf("data-jobcard-measurement-scope-group")
    );
    assert.doesNotMatch(reportBlock, /Pipe boots|Roof vents|Tear-off|Disposal/);
    const scopeBlock = capture.slice(capture.indexOf("data-jobcard-measurement-scope-group"));
    assert.match(scopeBlock, /Pipe boots/);
    assert.match(capture, /JOB_CARD_MEASUREMENT_SCOPE_GROUP_HINT/);
    assert.match(capture, /not copied from the report unless you already counted them/);
  });
});

describe("missing stays missing, never zero", () => {
  test("blank pipe boots stay unresolved; explicit 0 resolves", () => {
    assert.equal(
      resolveFromFields(completeStarterFields({ pipe_boots_count: Number.NaN })),
      1
    );
    const zeroDraft = buildManualMeasurementDraftFromFields({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      fields: completeStarterFields({ pipe_boots_count: 0 }),
    });
    assert.equal(zeroDraft.pipe_boots_count, 0);
    assert.equal(resolveFromFields(completeStarterFields({ pipe_boots_count: 0 })), 0);
  });

  test("unanswered tear-off stays unresolved; no is not invented into squares", () => {
    assert.equal(
      resolveFromFields(completeStarterFields({ tear_off_required: null })),
      1
    );
    const overlay = buildManualMeasurementDraftFromFields({
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      fields: completeStarterFields({ tear_off_required: false }),
    });
    assert.equal(overlay.tear_off_required, false);
    const map = deriveQuantityMapFromRecord({ ...overlay, id: "m1" } as MeasurementRecord);
    assert.equal(map.tear_off_squares, undefined);
    assert.equal(resolveFromFields(completeStarterFields({ tear_off_required: false })), 1);
  });
});

describe("logo absence is not a Send-blocking review", () => {
  test("Preview strip and Send hints do not treat missing logo as a blocker", () => {
    const summary = read(
      "app/tools/roofing/proposals/preview/ProposalPreviewReadinessSummary.tsx"
    );
    const sendPanel = read(
      "app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx"
    );
    const gate = read("app/lib/proposalSendGateReadiness.ts");
    assert.doesNotMatch(summary, /companyLogoMissing/);
    assert.doesNotMatch(summary, /CUSTOMER_PREVIEW_COMPANY_LOGO_MISSING_HINT/);
    assert.doesNotMatch(sendPanel, /CUSTOMER_PREVIEW_COMPANY_LOGO_MISSING_HINT/);
    assert.doesNotMatch(gate, /Company logo is missing\./);
    assert.match(sendPanel, /blockingLineCount/);
  });
});

describe("fresh Job Card does not claim create-ready without a proposal", () => {
  test("absent proposal uses Ready to prepare", () => {
    assert.equal(JOB_CARD_PROPOSAL_STATUS_READY_TO_PREPARE, "Ready to prepare");
    const helpers = read("app/tools/roofing/jobCard/jobCardProposalsTabModel.ts");
    assert.match(helpers, /JOB_CARD_PROPOSAL_STATUS_READY_TO_PREPARE/);
    assert.match(helpers, /formatAbsentProposalStatusLabel/);
  });
});

describe("New Job commercial entry hides unfinished theater", () => {
  test("packet workbench is customer + property + create job", () => {
    const roofing = read("app/tools/roofing/RoofingClient.tsx");
    const start = roofing.indexOf("function renderJobPacketWorkbench");
    const end = roofing.indexOf("function renderLegacyEstimateWorkspace");
    assert.ok(start >= 0 && end > start);
    const workbench = roofing.slice(start, end);
    assert.match(workbench, /Create job/);
    assert.match(workbench, /handleContinueToJobCard/);
    assert.doesNotMatch(workbench, /Continue to Job Card/);
    assert.doesNotMatch(workbench, /Coming soon/i);
    assert.doesNotMatch(workbench, /not wired/i);
    assert.doesNotMatch(workbench, /Packet draft/);
    assert.doesNotMatch(workbench, /No pricing yet/);
    assert.doesNotMatch(workbench, /Estimate path/);
    assert.doesNotMatch(workbench, /Save Packet/);
    assert.doesNotMatch(workbench, /Instant Estimate/);
    assert.doesNotMatch(workbench, /Site visit/i);
    assert.doesNotMatch(workbench, /COMING SOON/);
    assert.doesNotMatch(workbench, /No ZIP defaults saved/);
    assert.match(workbench, /\bCustomer\b/);
    assert.match(workbench, /\bProperty\b/);
    assert.match(roofing, /createJob\(draft\)/);
  });
});

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
    assert.match(client, /openCapture\("prepare"/);
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
    assert.doesNotMatch(hook, /onboardingMeasurement|temporaryQuantity/);
  });

  test("estimate-ready quartet remains the measurement-readiness contract", () => {
    assert.equal(isManualMeasurementEstimateReady(quartetOnlyFields()), true);
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
    assert.doesNotMatch(capture, /aerial|upload report|onboarding wizard/i);
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
      companyId: COMPANY_ID,
      jobId: JOB_ID,
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
      companyId: COMPANY_ID,
      jobId: JOB_ID,
      fields: {
        roof_area_sqft: 1800,
        waste_percent: 0,
        pitch_label: "5/12",
        stories: "1",
      },
    });
    assert.equal(draft.report_source, "Manual");
    assert.equal(draft.waste_percent, 0);
    assert.equal(draft.eaves_lf, null);
    assert.equal(draft.pipe_boots_count, null);
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
