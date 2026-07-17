/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesWorkspaceRedesignPage.test.ts
 *
 * Source-level assertions for Templates Flow Redesign P1 (Use-first / Edit-mode).
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

describe("Templates Flow Redesign P1 — Use-first / Edit-mode", () => {
  test("1–2. default opens in use/summary mode — no edit tabs as first-load IA", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const workspace = read("TemplatesSelectedWorkspace.tsx");

    assert.ok(setup.includes('useState<TemplatesWorkspaceMode>("use")'));
    assert.ok(setup.includes("TemplatesSelectedWorkspace"));
    assert.ok(workspace.includes('mode === "use"'));
    assert.ok(workspace.includes("TemplatesUseSurface"));
    assert.ok(workspace.includes('data-templates-workspace-mode="use"'));
    // Edit tabs only render in edit mode
    assert.ok(workspace.includes("data-templates-edit-tabs"));
    assert.ok(workspace.includes('data-templates-workspace-mode="edit"'));
    // First-load Use surface has no tab strip / edit IA
    const useSurface = read("TemplatesUseSurface.tsx");
    assert.ok(!useSurface.includes('role="tablist"'));
    assert.ok(!useSurface.includes("Packages & Catalog"));
    assert.ok(!useSurface.includes("data-templates-tab="));
    assert.ok(!useSurface.includes("data-templates-edit-tabs"));
  });

  test("3–5. readiness hero, what this creates, Open Jobs primary when ready", () => {
    const use = read("TemplatesUseSurface.tsx");
    assert.ok(use.includes("data-templates-use-surface"));
    assert.ok(use.includes("data-templates-use-status"));
    assert.ok(use.includes("Ready to use"));
    assert.ok(use.includes("Needs attention"));
    assert.ok(use.includes("data-templates-what-this-creates"));
    assert.ok(use.includes("What this creates"));
    assert.ok(use.includes("data-templates-open-jobs"));
    assert.ok(use.includes("Open Jobs to create a proposal"));
    assert.ok(use.includes('data-templates-primary-cta="open_jobs"'));
  });

  test("6. no fake Create Proposal action", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const use = read("TemplatesUseSurface.tsx");
    assert.equal(setup.includes('href="/tools/roofing/proposals/builder"'), false);
    assert.equal(/data-templates-create-proposal/i.test(setup + use), false);
    assert.ok(use.includes("There is no Create proposal button"));
  });

  test("7–9. Edit template enters edit mode; Back exits; packages only in edit", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const workspace = read("TemplatesSelectedWorkspace.tsx");
    const use = read("TemplatesUseSurface.tsx");

    assert.ok(use.includes("data-templates-edit-template"));
    assert.ok(use.includes("Edit template"));
    assert.ok(setup.includes("handleEnterEditMode"));
    assert.ok(setup.includes("handleBackToSummary"));
    assert.ok(setup.includes('setWorkspaceMode("edit")'));
    assert.ok(setup.includes('setWorkspaceMode("use")'));
    assert.ok(workspace.includes("data-templates-back-to-summary"));
    assert.ok(workspace.includes("Back to template summary"));
    assert.ok(workspace.includes("data-templates-edit-mode-heading"));
    assert.ok(workspace.includes("Editing "));
    assert.ok(workspace.includes('editTab === "packages"'));
    assert.ok(workspace.includes("TemplatesPackagesCatalogTab"));
  });

  test("10–12. Catalog add / re-link / link states preserved in Packages edit tool", () => {
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
    assert.ok(items.includes("data-templates-catalog-link-status"));
  });

  test("13–14. Customer display + Content exist in edit mode only as tools", () => {
    const workspace = read("TemplatesSelectedWorkspace.tsx");
    const estimate = read("TemplatesEstimateDisplayTab.tsx");
    assert.ok(workspace.includes('editTab === "estimate"'));
    assert.ok(workspace.includes('editTab === "content"'));
    assert.ok(workspace.includes("TemplatesEstimateDisplayTab"));
    assert.ok(workspace.includes("TemplatesContentEditorShell"));
    assert.ok(estimate.includes("data-templates-estimate-tab"));
    assert.ok(estimate.includes("Does not change pricing or margin"));
  });

  test("15. trust note is concise and not repeated under every section", () => {
    const use = read("TemplatesUseSurface.tsx");
    const items = read("TemplatesSectionCatalogItems.tsx");
    const header = read("TemplatesPageHeader.tsx");
    const footnote = read("TemplatesBuilderFootnote.tsx");
    assert.ok(use.includes("data-templates-trust-note"));
    assert.ok(use.includes("TEMPLATES_WORKSPACE_TRUST_NOTE"));
    assert.match(TEMPLATES_WORKSPACE_TRUST_NOTE, /Catalog controls item pricing/i);
    assert.ok(!items.includes("TEMPLATE_CATALOG_SOT_COPY"));
    assert.ok(!items.includes("TEMPLATE_CATALOG_DRAFT_REFRESH_COPY"));
    assert.ok(header.includes("Job Card"));
    assert.ok(!header.includes("source of truth"));
    assert.ok(footnote.includes("Job Card"));
  });
});
