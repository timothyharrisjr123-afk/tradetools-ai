/**
 * Run: npx tsx --test app/lib/contractorFixtureIsolation.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  classifyContractorFixtureText,
  filterContractorVisibleProposals,
  filterContractorVisibleTemplates,
  isInternalFixtureProposal,
  isInternalFixtureTemplate,
  pickContractorVisibleJobDraft,
} from "./contractorFixtureIsolation";

describe("contractorFixtureIsolation", () => {
  test("identifies known smoke/internal fixture titles", () => {
    const cases: Array<{ text: string; reason: string }> = [
      { text: "Coverage basis live smoke", reason: "coverage_basis_live_smoke" },
      {
        text: "Coverage basis live smoke — Babby D",
        reason: "coverage_basis_live_smoke",
      },
      { text: "RAW_PLUS_WASTE", reason: "raw_plus_waste" },
      { text: "raw plus waste fixture", reason: "raw_plus_waste" },
      {
        text: "Complete-source smoke option",
        reason: "complete_source_smoke",
      },
      { text: "S3D13 quantity echo smoke", reason: "s3d13" },
      { text: "smoke 2026 draft", reason: "smoke_2026" },
      { text: "controlled live smoke", reason: "controlled_live_smoke" },
      {
        text: "minimal complete-source live smoke",
        reason: "minimal_complete_source_live_smoke",
      },
    ];
    for (const { text, reason } of cases) {
      const result = classifyContractorFixtureText(text);
      assert.equal(result.isInternalFixture, true, text);
      assert.equal(result.reason, reason, text);
    }
  });

  test("does not hide normal contractor names", () => {
    const normals = [
      "Roof replacement",
      "Johnson residence",
      "Testimonial review proposal",
      "Sample board material quote",
      "Demo day walkthrough",
      "Standard package estimate",
      "",
      null,
      undefined,
    ];
    for (const text of normals) {
      assert.equal(
        classifyContractorFixtureText(text).isInternalFixture,
        false,
        String(text)
      );
    }
  });

  test("does not broad-match bare test/sample/demo/smoke alone", () => {
    assert.equal(classifyContractorFixtureText("test").isInternalFixture, false);
    assert.equal(classifyContractorFixtureText("sample").isInternalFixture, false);
    assert.equal(classifyContractorFixtureText("demo").isInternalFixture, false);
    assert.equal(classifyContractorFixtureText("smoke").isInternalFixture, false);
    assert.equal(
      classifyContractorFixtureText("Customer smoke alarm note").isInternalFixture,
      false
    );
  });

  test("filters proposal and template lists for contractor views", () => {
    const proposals = [
      { id: "1", title: "Roof replacement" },
      { id: "2", title: "Coverage basis live smoke" },
      { id: "3", title: "Johnson residence" },
    ];
    assert.deepEqual(
      filterContractorVisibleProposals(proposals).map((r) => r.id),
      ["1", "3"]
    );

    const templates = [
      { id: "a", name: "Roof replacement" },
      { id: "b", name: "RAW_PLUS_WASTE" },
      { id: "c", name: "Gutter repair" },
    ];
    assert.deepEqual(
      filterContractorVisibleTemplates(templates).map((r) => r.id),
      ["a", "c"]
    );
    assert.equal(isInternalFixtureProposal(proposals[1]!), true);
    assert.equal(isInternalFixtureTemplate(templates[1]!), true);
  });

  test("pickContractorVisibleJobDraft skips active smoke for current surface", () => {
    const drafts = [
      { id: "smoke", title: "Coverage basis live smoke" },
      { id: "real", title: "Roof replacement" },
    ];
    assert.equal(
      pickContractorVisibleJobDraft(drafts, "smoke")?.id,
      "real"
    );
    assert.equal(
      pickContractorVisibleJobDraft(drafts, "real")?.id,
      "real"
    );
    assert.equal(
      pickContractorVisibleJobDraft(
        [{ id: "smoke", title: "Coverage basis live smoke" }],
        "smoke"
      ),
      null
    );
  });
});
