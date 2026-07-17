/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesSetupTrustFlowPage.test.ts
 *
 * Source-level assertions for setup → Builder trust path (post Redesign P0).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Templates setup trust flow (Integrated Flow P1 + Redesign P0)", () => {
  test("Overview readiness actions include Fix links and Open Jobs", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const overview = read("TemplatesOverviewPanel.tsx");
    assert.ok(setup.includes("TemplatesOverviewPanel") || setup.includes("TemplatesSelectedWorkspace"));
    assert.ok(setup.includes("deriveTemplateCatalogLinkReadiness"));
    assert.ok(setup.includes("handleFixCatalogLinks"));
    assert.ok(overview.includes("data-templates-fix-links"));
    assert.ok(overview.includes("data-templates-open-jobs"));
    assert.ok(overview.includes("Open Jobs to create a proposal"));
  });

  test("no fake Create Proposal action on Templates page", () => {
    const overview = read("TemplatesOverviewPanel.tsx");
    const setup = read("TemplatesSetupClient.tsx");
    assert.ok(overview.includes("There is no Create proposal button on this page"));
    assert.ok(overview.includes("data-templates-open-jobs"));
    assert.equal(setup.includes('href="/tools/roofing/proposals/builder"'), false);
    assert.equal(/data-templates-create-proposal/i.test(overview + setup), false);
  });

  test("Fix links routes into Packages tab", () => {
    const setup = read("TemplatesSetupClient.tsx");
    assert.ok(setup.includes('setWorkspaceTab("packages")'));
    assert.ok(setup.includes("setFocusSectionId"));
  });
});
