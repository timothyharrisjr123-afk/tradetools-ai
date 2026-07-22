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
    assert.ok(picker.includes("active Catalog") || picker.includes("Inactive Catalog"));
  });

  test("Catalog SoT constant retained; reusable setup keeps Job Card boundary", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    const flow = read("templatesWorkspaceFlow.ts");
    const footnote = read("TemplatesBuilderFootnote.tsx");
    const header = read("TemplatesPageHeader.tsx");

    assert.match(TEMPLATE_CATALOG_SOT_COPY, /Catalog is the source of truth/i);
    assert.match(TEMPLATE_CATALOG_DRAFT_REFRESH_COPY, /snapshotted|refresh draft pricing/i);
    assert.ok(flow.includes("TEMPLATES_WORKSPACE_TRUST_NOTE"));
    assert.ok(review.includes("TEMPLATES_NEXT_USE_COPY") || review.includes("data-templates-next-use"));
    assert.ok(footnote.includes("Job Card"));
    assert.ok(!footnote.includes("later stage"));
    assert.ok(header.includes("Job Card"));
    assert.ok(!header.includes("later stages"));
    assert.equal(TEMPLATE_ADD_FROM_CATALOG_LABEL, "Add work item");
    assert.equal(TEMPLATE_RELINK_CATALOG_LABEL, "Replace item");
  });

  test("no fake supplier sync / material ordering / proposal import claims", () => {
    const sources = [
      read("TemplatesSetupClient.tsx"),
      read("TemplatesSectionCatalogItems.tsx"),
      read("TemplatesCatalogItemPickerModal.tsx"),
      read("TemplatesBuilderFootnote.tsx"),
      read("TemplatesQuoteSetupReview.tsx"),
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
    assert.match(picker, /Only active items can be added|Inactive Catalog items are hidden/i);
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
