/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesWorkspaceRedesignPage.test.ts
 *
 * Source-level assertions for Templates Workspace Redesign P0 (contractor-first flow).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { TEMPLATES_WORKSPACE_TRUST_NOTE } from "./templatesWorkspaceFlow";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Templates workspace redesign P0", () => {
  test("first view is Overview — not a full structure dump", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const workspace = read("TemplatesSelectedWorkspace.tsx");
    const packages = read("TemplatesPackagesCatalogTab.tsx");

    assert.ok(setup.includes("TemplatesSelectedWorkspace"));
    assert.ok(setup.includes('useState<TemplatesWorkspaceTabId>("overview")'));
    assert.ok(!setup.includes("TemplatesStructureSettingsShell"));
    assert.ok(workspace.includes('activeTab === "overview"'));
    assert.ok(workspace.includes("TemplatesOverviewPanel"));
    assert.ok(workspace.includes('data-templates-tab="packages"') || workspace.includes('id: "packages"') || workspace.includes("TEMPLATES_WORKSPACE_TABS"));
    assert.ok(packages.includes("data-templates-package-list"));
    assert.ok(packages.includes("Edit section"));
    assert.ok(packages.includes("showCatalogItems"));
  });

  test("Overview shows readiness, Open Jobs, and single trust note", () => {
    const overview = read("TemplatesOverviewPanel.tsx");
    assert.ok(overview.includes("data-templates-overview"));
    assert.ok(overview.includes("data-templates-open-jobs"));
    assert.ok(overview.includes("Open Jobs to create a proposal"));
    assert.ok(overview.includes("data-templates-fix-links"));
    assert.ok(overview.includes("data-templates-trust-note"));
    assert.ok(overview.includes("TEMPLATES_WORKSPACE_TRUST_NOTE"));
    assert.match(TEMPLATES_WORKSPACE_TRUST_NOTE, /Catalog controls item pricing/i);
    assert.ok(overview.includes("There is no Create proposal button"));
  });

  test("Estimate display is its own tab, not Overview dump", () => {
    const workspace = read("TemplatesSelectedWorkspace.tsx");
    const estimate = read("TemplatesEstimateDisplayTab.tsx");
    assert.ok(workspace.includes('activeTab === "estimate"'));
    assert.ok(estimate.includes("data-templates-estimate-tab"));
    assert.ok(estimate.includes("Does not change pricing or margin"));
    assert.ok(!read("TemplatesOverviewPanel.tsx").includes("EstimateSettingsToggles"));
  });

  test("Catalog add/re-link remain wired through Packages tab", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const packages = read("TemplatesPackagesCatalogTab.tsx");
    const section = read("TemplatesStructureSectionRow.tsx");
    const items = read("TemplatesSectionCatalogItems.tsx");
    assert.ok(setup.includes("handleOpenAddCatalogItem"));
    assert.ok(setup.includes("handleOpenRelinkCatalogItem"));
    assert.ok(packages.includes("onAddCatalogItemToSection"));
    assert.ok(packages.includes("onRelinkTemplateItem"));
    assert.ok(section.includes("TemplatesSectionCatalogItems"));
    assert.ok(items.includes("data-templates-add-from-catalog"));
    assert.ok(items.includes("data-templates-relink-catalog"));
    assert.ok(items.includes("Included Catalog items"));
  });

  test("header and footnote stay short — no repeated SoT essays", () => {
    const header = read("TemplatesPageHeader.tsx");
    const footnote = read("TemplatesBuilderFootnote.tsx");
    const items = read("TemplatesSectionCatalogItems.tsx");
    assert.ok(header.includes("Job Card"));
    assert.ok(!header.includes("source of truth"));
    assert.ok(footnote.includes("Job Card"));
    assert.ok(!items.includes("TEMPLATE_CATALOG_SOT_COPY"));
    assert.ok(!items.includes("TEMPLATE_CATALOG_DRAFT_REFRESH_COPY"));
  });

  test("no fake Create Proposal route on Templates", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const overview = read("TemplatesOverviewPanel.tsx");
    assert.equal(setup.includes('href="/tools/roofing/proposals/builder"'), false);
    assert.equal(/data-templates-create-proposal/i.test(setup + overview), false);
  });
});
