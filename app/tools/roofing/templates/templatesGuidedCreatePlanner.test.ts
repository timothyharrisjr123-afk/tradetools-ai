/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesGuidedCreatePlanner.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  GUIDED_PACKAGE_MODEL_CHOICES,
  buildGuidedTemplateCreatePlan,
  formatGuidedPackageSummary,
  guidedPlanCopyExposesInternalLanguage,
  validateGuidedCreateBasics,
} from "./templatesGuidedCreatePlanner";

describe("templatesGuidedCreatePlanner", () => {
  test("validates template name", () => {
    assert.equal(validateGuidedCreateBasics({ name: "" }).ok, false);
    assert.equal(validateGuidedCreateBasics({ name: "   " }).ok, false);
    assert.equal(validateGuidedCreateBasics({ name: "Roof replacement" }).ok, true);
    assert.equal(
      validateGuidedCreateBasics({ name: "x".repeat(121) }).ok,
      false
    );
  });

  test("simple estimate plan hides packages and prepares one estimate container", () => {
    const plan = buildGuidedTemplateCreatePlan({
      name: "Simple roof estimate",
      description: "Everyday reroof quote",
      packageModel: "simple",
    });

    assert.equal(plan.presentsPackages, false);
    assert.deepEqual(plan.packageLabels, []);
    assert.match(formatGuidedPackageSummary(plan), /Simple estimate/i);
    assert.equal(plan.definition.options?.length, 1);
    assert.equal(plan.definition.options?.[0]?.name, "Estimate");
    assert.equal(plan.definition.options?.[0]?.selection_mode, "included");
    assert.ok(plan.contentAreas.some((row) => row.label === "Estimate"));
    assert.ok(plan.contentAreas.some((row) => row.label === "Warranty"));
    assert.ok(plan.contentAreas.some((row) => row.label === "Terms"));
    assert.ok(!plan.contentAreas.some((row) => /upgrade/i.test(row.label)));
  });

  test("single package plan creates Standard package label", () => {
    const plan = buildGuidedTemplateCreatePlan({
      name: "Single package roof",
      packageModel: "single",
    });

    assert.equal(plan.presentsPackages, true);
    assert.deepEqual(plan.packageLabels, ["Standard"]);
    assert.match(formatGuidedPackageSummary(plan), /Single package: Standard/i);
    assert.equal(plan.definition.options?.length, 1);
    assert.equal(plan.definition.options?.[0]?.name, "Standard");
  });

  test("triple package plan creates Standard / Enhanced / Premium", () => {
    const plan = buildGuidedTemplateCreatePlan({
      name: "Compare packages",
      packageModel: "triple",
    });

    assert.deepEqual(plan.packageLabels, ["Standard", "Enhanced", "Premium"]);
    assert.match(formatGuidedPackageSummary(plan), /Standard · Enhanced · Premium/);
    assert.equal(plan.definition.options?.length, 3);
    assert.deepEqual(
      plan.definition.options?.map((row) => row.name),
      ["Standard", "Enhanced", "Premium"]
    );
    assert.ok(plan.contentAreas.some((row) => /upgrade/i.test(row.label)));

    const upgradesFor = (name: string) => {
      const option = plan.definition.options?.find((row) => row.name === name);
      return (
        option?.sections?.find((section) => section.kind === "upgrade_group")?.items ?? []
      );
    };
    assert.deepEqual(upgradesFor("Standard"), []);
    assert.equal(upgradesFor("Enhanced").length, 1);
    assert.equal(upgradesFor("Enhanced")[0]?.catalog_seed_key, "roofing.roof_vent");
    assert.equal(upgradesFor("Enhanced")[0]?.upgrade_effect, "additive");
    assert.equal(upgradesFor("Premium").length, 1);
    assert.equal(upgradesFor("Premium")[0]?.catalog_seed_key, "roofing.roof_vent");

    const enhancedLines =
      plan.definition.options
        ?.find((row) => row.name === "Enhanced")
        ?.sections?.find((section) => section.kind === "line_items")?.items ?? [];
    assert.equal(
      enhancedLines.find((item) => item.catalog_seed_key === "roofing.synthetic_underlayment")
        ?.customer_name_override,
      "Enhanced underlayment"
    );
  });

  test("package model choice copy stays contractor-facing", () => {
    for (const choice of GUIDED_PACKAGE_MODEL_CHOICES) {
      assert.equal(guidedPlanCopyExposesInternalLanguage(choice.title), false);
      assert.equal(guidedPlanCopyExposesInternalLanguage(choice.description), false);
    }

    const plan = buildGuidedTemplateCreatePlan({
      name: "Roof replacement",
      packageModel: "triple",
    });
    assert.equal(guidedPlanCopyExposesInternalLanguage(formatGuidedPackageSummary(plan)), false);
    for (const area of plan.contentAreas) {
      assert.equal(guidedPlanCopyExposesInternalLanguage(area.label), false);
      assert.equal(guidedPlanCopyExposesInternalLanguage(area.detail), false);
    }
    for (const note of plan.structureNotes) {
      assert.equal(guidedPlanCopyExposesInternalLanguage(note), false);
    }
  });

  test("guided plan metadata does not claim the starter seed key", () => {
    const plan = buildGuidedTemplateCreatePlan({
      name: "Guided roof",
      packageModel: "single",
    });
    assert.notEqual(plan.definition.metadata.seed_key, "proposal.roof_replacement");
    assert.equal(plan.definition.metadata.guided_create, true);
    assert.equal(plan.definition.metadata.package_model, "single");
  });
});
