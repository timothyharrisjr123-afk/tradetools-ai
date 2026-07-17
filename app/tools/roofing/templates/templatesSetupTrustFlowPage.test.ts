/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesSetupTrustFlowPage.test.ts
 *
 * Source-level assertions for Integrated Flow P1 setup → Builder trust path.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Templates setup trust flow (Integrated Flow P1)", () => {
  test("next-actions panel is wired with Fix links and Open Jobs", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const next = read("TemplatesSetupNextActions.tsx");
    assert.ok(setup.includes("TemplatesSetupNextActions"));
    assert.ok(setup.includes("deriveTemplateCatalogLinkReadiness"));
    assert.ok(setup.includes("handleFixCatalogLinks"));
    assert.ok(next.includes("data-templates-next-actions"));
    assert.ok(next.includes("data-templates-fix-links"));
    assert.ok(next.includes("data-templates-open-jobs"));
    assert.ok(next.includes("Open Jobs to create a proposal"));
  });

  test("no fake Create Proposal action on Templates page", () => {
    const next = read("TemplatesSetupNextActions.tsx");
    const checklist = read("TemplatesSetupChecklist.tsx");
    const setup = read("TemplatesSetupClient.tsx");
    assert.ok(next.includes("There is no Create proposal button on this page"));
    assert.ok(next.includes("data-templates-open-jobs"));
    assert.ok(checklist.includes("data-templates-checklist-open-jobs"));
    assert.equal(setup.includes('href="/tools/roofing/proposals/builder"'), false);
    assert.equal(/data-templates-create-proposal/i.test(next + checklist + setup), false);
  });

  test("checklist offers Open Jobs when ready_for_builder", () => {
    const checklist = read("TemplatesSetupChecklist.tsx");
    assert.ok(checklist.includes("data-templates-checklist-open-jobs"));
    assert.ok(checklist.includes("/tools/roofing/saved"));
  });
});
