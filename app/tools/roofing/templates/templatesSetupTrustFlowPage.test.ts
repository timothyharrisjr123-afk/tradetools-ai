/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesSetupTrustFlowPage.test.ts
 *
 * Source-level assertions for setup → Builder trust path (post Use-first P1).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Templates setup trust flow (Integrated Flow P1 + Use-first P1)", () => {
  test("Use surface readiness actions include Fix links and Open Jobs", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const use = read("TemplatesUseSurface.tsx");
    assert.ok(setup.includes("TemplatesUseSurface") || setup.includes("TemplatesSelectedWorkspace"));
    assert.ok(setup.includes("deriveTemplateCatalogLinkReadiness"));
    assert.ok(setup.includes("handleFixCatalogLinks"));
    assert.ok(use.includes("data-templates-fix-links"));
    assert.ok(use.includes("data-templates-open-jobs"));
    assert.ok(use.includes("Open Jobs to create a proposal"));
  });

  test("no fake Create Proposal action on Templates page", () => {
    const use = read("TemplatesUseSurface.tsx");
    const setup = read("TemplatesSetupClient.tsx");
    assert.ok(use.includes("There is no Create proposal button on this page"));
    assert.ok(use.includes("data-templates-open-jobs"));
    assert.equal(setup.includes('href="/tools/roofing/proposals/builder"'), false);
    assert.equal(/data-templates-create-proposal/i.test(use + setup), false);
  });

  test("Fix links enters edit mode Packages tool", () => {
    const setup = read("TemplatesSetupClient.tsx");
    assert.ok(setup.includes('setWorkspaceMode("edit")'));
    assert.ok(setup.includes('setEditTab("packages")'));
    assert.ok(setup.includes("setFocusSectionId"));
  });
});
