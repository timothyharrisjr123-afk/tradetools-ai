/**
 * Fixture policy + stage-aware proposal guidance + visible Job Card tabs.
 *
 * Run:
 * npx tsx --test app/lib/jobLifecycleFixtureCoherence.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  classifyKnownLifecycleFixture,
  isNegativeLifecycleFixture,
  isPreferredCanonicalVisualFixture,
  KNOWN_LIFECYCLE_FIXTURES,
  PREFERRED_CANONICAL_VISUAL_FIXTURES,
} from "./jobLifecycleFixturePolicy";
import {
  allowsJobCardProposalCreateGuidance,
  formatAbsentProposalStatusLabel,
  formatBoardProposalPresenceLabel,
  formatJobCardContractorProposalStatusLabel,
  JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE,
  JOB_CARD_PROPOSAL_STATUS_UNAVAILABLE,
} from "@/app/tools/roofing/jobCard/jobCardProposalsTabModel";
import {
  JOB_CARD_HIDDEN_TAB_IDS,
  JOB_CARD_TABS,
  JOB_CARD_VISIBLE_TAB_IDS,
  coerceJobCardVisibleTab,
  isJobCardVisibleTabId,
} from "@/app/tools/roofing/jobCard/jobCardTypes";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("lifecycle fixture policy", () => {
  test("classifies canonical visual Scheduled and negative Missing Schedule", () => {
    assert.equal(
      classifyKnownLifecycleFixture({
        name: "[R3G-046-VISUAL] Clean Scheduled",
      }),
      "canonical"
    );
    assert.equal(
      isPreferredCanonicalVisualFixture({
        id: "af6a9dc2-01a5-4e8c-8a8e-c10584713d27",
      }),
      true
    );
    assert.equal(
      isNegativeLifecycleFixture({
        name: "[R3G-046] Missing Schedule",
      }),
      true
    );
    assert.equal(
      classifyKnownLifecycleFixture({
        name: "[R3G-046] Mobile Scheduled",
      }),
      "synthetic_partial"
    );
    assert.ok(KNOWN_LIFECYCLE_FIXTURES.length >= 5);
  });

  test("preferred canonical visual set covers Intake through Complete", () => {
    assert.equal(
      PREFERRED_CANONICAL_VISUAL_FIXTURES.intake.id,
      "a9619d68-6d3f-43d2-8b07-7ed73ae87442"
    );
    assert.equal(
      PREFERRED_CANONICAL_VISUAL_FIXTURES.proposal.id,
      "d867e1a2-6dc3-4791-ab0f-e45c5f5d24aa"
    );
    assert.equal(
      PREFERRED_CANONICAL_VISUAL_FIXTURES.approved.id,
      "c34d3539-1dd3-489a-a25e-fb2ada68d827"
    );
    assert.equal(
      PREFERRED_CANONICAL_VISUAL_FIXTURES.scheduled.id,
      "af6a9dc2-01a5-4e8c-8a8e-c10584713d27"
    );
    assert.equal(
      PREFERRED_CANONICAL_VISUAL_FIXTURES.production.id,
      "85d41ad7-58d6-437d-95b3-80ac40a3c611"
    );
    assert.equal(
      PREFERRED_CANONICAL_VISUAL_FIXTURES.complete.id,
      "2b5319f1-54b0-4d23-a85c-096940c78378"
    );
    for (const preferred of Object.values(PREFERRED_CANONICAL_VISUAL_FIXTURES)) {
      assert.equal(classifyKnownLifecycleFixture(preferred), "canonical");
      assert.equal(isPreferredCanonicalVisualFixture(preferred), true);
    }
    assert.equal(
      isPreferredCanonicalVisualFixture({
        id: "366afed3-2eee-4558-8630-63e4f0dda99e",
      }),
      false
    );
  });
});

describe("stage-aware proposal guidance", () => {
  test("Intake / Proposal may show Ready to create proposal", () => {
    assert.equal(allowsJobCardProposalCreateGuidance("intake"), true);
    assert.equal(allowsJobCardProposalCreateGuidance("proposal"), true);
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [],
        stage: "intake",
      }),
      JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE
    );
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [],
        stage: "proposal",
      }),
      JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE
    );
  });

  test("Approved / Scheduled / Production / Complete use neutral absence", () => {
    for (const stage of [
      "approved",
      "scheduled",
      "production",
      "complete",
    ] as const) {
      assert.equal(allowsJobCardProposalCreateGuidance(stage), false, stage);
      assert.equal(
        formatAbsentProposalStatusLabel(stage),
        JOB_CARD_PROPOSAL_STATUS_UNAVAILABLE,
        stage
      );
      assert.equal(
        formatJobCardContractorProposalStatusLabel({
          visibleSummaries: [],
          stage,
        }),
        JOB_CARD_PROPOSAL_STATUS_UNAVAILABLE,
        stage
      );
      assert.notEqual(
        formatJobCardContractorProposalStatusLabel({
          visibleSummaries: [],
          stage,
        }),
        JOB_CARD_PROPOSAL_STATUS_READY_TO_CREATE,
        stage
      );
    }
  });

  test("does not fabricate proposal existence when later stage lacks pointers", () => {
    assert.equal(
      formatJobCardContractorProposalStatusLabel({
        visibleSummaries: [],
        stage: "scheduled",
        activeProposalId: null,
        latestProposalId: null,
      }),
      JOB_CARD_PROPOSAL_STATUS_UNAVAILABLE
    );
  });

  test("Board presence is stage-aware for canonical later stages", () => {
    assert.equal(formatBoardProposalPresenceLabel(false, "intake"), "No Proposal");
    assert.equal(
      formatBoardProposalPresenceLabel(false, "scheduled"),
      "Proposal unavailable"
    );
    assert.equal(
      formatBoardProposalPresenceLabel(false, "production"),
      "Proposal unavailable"
    );
    assert.equal(
      formatBoardProposalPresenceLabel(false, "complete"),
      "Proposal unavailable"
    );
    assert.equal(formatBoardProposalPresenceLabel(true, "scheduled"), "Proposal");
  });
});

describe("visible Job Card tabs", () => {
  test("Work Orders and Invoices are hidden but catalog retained", () => {
    assert.equal(isJobCardVisibleTabId("work_orders"), false);
    assert.equal(isJobCardVisibleTabId("invoices"), false);
    assert.ok(JOB_CARD_HIDDEN_TAB_IDS.includes("work_orders"));
    assert.ok(JOB_CARD_HIDDEN_TAB_IDS.includes("invoices"));
    assert.ok(JOB_CARD_TABS.some((tab) => tab.id === "work_orders"));
    assert.ok(JOB_CARD_TABS.some((tab) => tab.id === "invoices"));
    const tabs = read("app/tools/roofing/jobCard/JobCardTabs.tsx");
    assert.match(tabs, /JOB_CARD_VISIBLE_TABS/);
    assert.doesNotMatch(tabs, /JOB_CARD_TABS\.map/);
  });

  test("Material Orders and Job Costing hidden; Attachments + Measurements visible", () => {
    assert.equal(isJobCardVisibleTabId("material_orders"), false);
    assert.equal(isJobCardVisibleTabId("job_costing"), false);
    assert.equal(isJobCardVisibleTabId("instant_estimate"), false);
    assert.equal(isJobCardVisibleTabId("attachments"), true);
    assert.equal(isJobCardVisibleTabId("measurements"), true);
    assert.equal(isJobCardVisibleTabId("payments"), true);
    assert.ok(JOB_CARD_VISIBLE_TAB_IDS.includes("attachments"));
    assert.ok(JOB_CARD_VISIBLE_TAB_IDS.includes("measurements"));
    assert.ok(JOB_CARD_VISIBLE_TAB_IDS.includes("payments"));
    assert.equal(coerceJobCardVisibleTab("work_orders"), "overview");
  });

  test("underlying placeholder panels remain in SecondaryPanels", () => {
    const panels = read("app/tools/roofing/jobCard/JobCardSecondaryPanels.tsx");
    assert.match(panels, /work_orders/);
    assert.match(panels, /invoices/);
    assert.match(panels, /material_orders/);
    assert.match(panels, /job_costing/);
    assert.match(panels, /attachments/);
  });
});

describe("no fixture-name product branching", () => {
  test("Job Card / Board product sources do not key off R3G fixture names", () => {
    const paths = [
      "app/tools/roofing/jobCard/JobCardClient.tsx",
      "app/tools/roofing/jobCard/jobCardProposalsTabModel.ts",
      "app/tools/roofing/jobCard/JobCardTabs.tsx",
      "app/tools/roofing/saved/jobsBoardUtils.ts",
      "app/lib/jobBoardAdapter.ts",
    ];
    for (const rel of paths) {
      const source = read(rel);
      assert.doesNotMatch(source, /Missing Schedule/, rel);
      assert.doesNotMatch(source, /Blocked Hold/, rel);
      assert.doesNotMatch(source, /Mobile Scheduled/, rel);
      assert.doesNotMatch(source, /R3G-046/, rel);
      assert.doesNotMatch(source, /R3H-/, rel);
      assert.doesNotMatch(source, /R3I-/, rel);
    }
  });

  test("clients pass stage into proposal status formatter", () => {
    assert.match(
      read("app/tools/roofing/jobCard/JobCardClient.tsx"),
      /stage:\s*hydratedJobRecord\?\.stage/
    );
    assert.match(
      read("app/tools/roofing/RoofingClient.tsx"),
      /stage:\s*hydratedJobRecord\?\.stage/
    );
  });
});

