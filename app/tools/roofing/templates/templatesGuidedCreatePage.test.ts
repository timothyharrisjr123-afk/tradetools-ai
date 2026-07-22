/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesGuidedCreatePage.test.ts
 *
 * Source-level assertions for Template Flow V1 guided + Template create foundation.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Template Flow V1 — guided + Template create", () => {
  test("+ Template is visible from page header", () => {
    const header = read("TemplatesPageHeader.tsx");
    const setup = read("TemplatesSetupClient.tsx");

    assert.ok(header.includes("+ Template"));
    assert.ok(header.includes("data-templates-add-template"));
    assert.ok(setup.includes("onAddTemplate={handleOpenGuidedCreate}"));
    assert.ok(setup.includes("TemplatesGuidedCreateOverlay"));
  });

  test("overlay covers basics, package setup, structure, packet, review", () => {
    const overlay = read("TemplatesGuidedCreateOverlay.tsx");
    const planner = read("templatesGuidedCreatePlanner.ts");

    assert.ok(overlay.includes("data-templates-guided-create-overlay"));
    assert.ok(overlay.includes("data-templates-guided-create-panel-basics"));
    assert.ok(overlay.includes("data-templates-guided-create-panel-package-setup"));
    assert.ok(overlay.includes("data-templates-guided-create-package-drafts"));
    assert.ok(overlay.includes("data-templates-guided-create-panel-packet"));
    assert.ok(overlay.includes("data-templates-guided-create-panel-confirm"));
    assert.ok(overlay.includes("data-templates-guided-create-submit"));
    assert.ok(overlay.includes("GUIDED_PACKAGE_MODEL_CHOICES"));
    assert.ok(planner.includes('"single"'));
    assert.ok(planner.includes('"double"'));
    assert.ok(planner.includes('"triple"'));
    assert.ok(planner.includes('"custom"'));
    assert.ok(planner.includes("buildDefaultGuidedPackageDrafts"));
    assert.ok(planner.includes("package_setup"));
    assert.ok(planner.includes("One package"));
    assert.ok(planner.includes("Two packages"));
    assert.ok(planner.includes("Three packages"));
    assert.ok(planner.includes("Custom package setup"));
    assert.ok(planner.includes("GUIDED_CREATE_PACKAGE_SETUP_HINT"));
  });

  test("create lands in quote review via guided helper, not draft proposal create", () => {
    const setup = read("TemplatesSetupClient.tsx");

    assert.ok(setup.includes("createGuidedProposalTemplate"));
    assert.ok(setup.includes('setWorkspaceMode("review")'));
    assert.ok(setup.includes("loadTemplates(result.templateId)"));
    assert.equal(setup.includes("createNewProposalDraftEntry"), false);
    assert.equal(setup.includes('href="/tools/roofing/proposals/builder"'), false);
    assert.equal(/data-templates-create-proposal/i.test(setup), false);
  });

  test("guided create uses dedicated helper, not starter install as primary path", () => {
    const helper = read("createGuidedProposalTemplate.ts");
    assert.ok(helper.includes("createProposalTemplate"));
    assert.ok(helper.includes("createProposalTemplateOption"));
    assert.ok(helper.includes("createProposalTemplateSection"));
    assert.ok(helper.includes("createProposalTemplateItem"));
    assert.equal(
      /\binstallDefaultRoofingProposalTemplates\s*\(/.test(helper),
      false
    );
    assert.ok(helper.includes("guided_create"));
  });
});
