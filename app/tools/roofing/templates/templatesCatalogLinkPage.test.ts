/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesCatalogLinkPage.test.ts
 *
 * Source-level assertions for Template ↔ Catalog linking UI (post Redesign P0).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  TEMPLATE_ADD_FROM_CATALOG_LABEL,
  TEMPLATE_CATALOG_DRAFT_REFRESH_COPY,
  TEMPLATE_CATALOG_SOT_COPY,
  TEMPLATE_RELINK_CATALOG_LABEL,
} from "@/app/lib/proposalTemplateCatalogLink";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Templates catalog link page (Integrated Flow P0 + Redesign P0)", () => {
  test("Add item from catalog control and picker are wired", () => {
    const setup = read("TemplatesSetupClient.tsx");
    const packages = read("TemplatesPackagesCatalogTab.tsx");
    const section = read("TemplatesStructureSectionRow.tsx");
    const panel = read("TemplatesSectionCatalogItems.tsx");
    const picker = read("TemplatesCatalogItemPickerModal.tsx");

    assert.ok(setup.includes("createProposalTemplateItem"));
    assert.ok(setup.includes("updateProposalTemplateItem"));
    assert.ok(setup.includes("TemplatesCatalogItemPickerModal"));
    assert.ok(setup.includes("getCatalogItemsByCompany"));
    assert.ok(setup.includes("handleOpenAddCatalogItem"));
    assert.ok(setup.includes("handleOpenRelinkCatalogItem"));
    assert.ok(packages.includes("onAddCatalogItemToSection"));
    assert.ok(packages.includes("onRelinkTemplateItem"));
    assert.ok(section.includes("TemplatesSectionCatalogItems"));
    assert.ok(panel.includes("data-templates-add-from-catalog"));
    assert.ok(panel.includes("TEMPLATE_ADD_FROM_CATALOG_LABEL") || panel.includes(TEMPLATE_ADD_FROM_CATALOG_LABEL));
    assert.ok(picker.includes("data-templates-catalog-picker"));
    assert.ok(picker.includes("Only active Catalog items"));
  });

  test("Catalog SoT remains in picker; Overview holds the single trust note", () => {
    const picker = read("TemplatesCatalogItemPickerModal.tsx");
    const overview = read("TemplatesOverviewPanel.tsx");
    const footnote = read("TemplatesBuilderFootnote.tsx");
    const header = read("TemplatesPageHeader.tsx");

    assert.match(TEMPLATE_CATALOG_SOT_COPY, /Catalog is the source of truth/i);
    assert.match(TEMPLATE_CATALOG_DRAFT_REFRESH_COPY, /snapshotted|refresh draft pricing/i);
    assert.ok(picker.includes("TEMPLATE_CATALOG_SOT_COPY") || picker.includes(TEMPLATE_CATALOG_SOT_COPY));
    assert.ok(overview.includes("TEMPLATES_WORKSPACE_TRUST_NOTE"));
    assert.ok(footnote.includes("Job Card"));
    assert.ok(!footnote.includes("later stage"));
    assert.ok(header.includes("Job Card"));
    assert.ok(!header.includes("later stages"));
    assert.equal(TEMPLATE_ADD_FROM_CATALOG_LABEL, "Add item from catalog");
    assert.equal(TEMPLATE_RELINK_CATALOG_LABEL, "Change catalog link");
  });

  test("no fake supplier sync / material ordering / proposal import claims", () => {
    const sources = [
      read("TemplatesSetupClient.tsx"),
      read("TemplatesSectionCatalogItems.tsx"),
      read("TemplatesCatalogItemPickerModal.tsx"),
      read("TemplatesBuilderFootnote.tsx"),
      read("TemplatesOverviewPanel.tsx"),
      TEMPLATE_CATALOG_SOT_COPY,
      TEMPLATE_CATALOG_DRAFT_REFRESH_COPY,
    ].join("\n");
    assert.equal(
      /supplier sync is active|material ordering is live|proposal import is live/i.test(sources),
      false
    );
  });

  test("inactive items are not addable by default in picker", () => {
    const picker = read("TemplatesCatalogItemPickerModal.tsx");
    assert.ok(picker.includes("listActiveCatalogItemsForPicker"));
    assert.match(picker, /Only active Catalog items can be linked/i);
  });

  test("re-link control is present for template items", () => {
    const panel = read("TemplatesSectionCatalogItems.tsx");
    assert.ok(panel.includes("data-templates-relink-catalog"));
    assert.ok(
      panel.includes("TEMPLATE_RELINK_CATALOG_LABEL") ||
        panel.includes(TEMPLATE_RELINK_CATALOG_LABEL)
    );
    assert.ok(panel.includes("data-templates-catalog-link-status"));
  });
});
