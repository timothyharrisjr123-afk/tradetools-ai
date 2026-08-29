/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesPresentationTruth.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  TEMPLATES_STARTER_PURPOSE_COPY,
  formatPackageScopeCountLine,
  resolveTemplatePurposeDescription,
} from "./templatesWorkspaceFlow";
import {
  countCatalogLinkedAvailableUpgradeItems,
  countCatalogLinkedTemplateItems,
} from "./templatesSetupUtils";

const ROOT = join(process.cwd(), "app/tools/roofing/templates");

function read(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

describe("Template Flow V1 — presentation truth + quiet infrastructure", () => {
  test("library counts exclude available upgrades from included", () => {
    const graph = {
      sections: [
        { id: "line", kind: "line_items" },
        { id: "up", kind: "upgrade_group" },
      ],
      items: [
        { id: "a", section_id: "line", catalog_item_id: "c1" },
        { id: "b", section_id: "line", catalog_item_id: "c2" },
        { id: "c", section_id: "up", catalog_item_id: "c3" },
      ],
    } as never;
    assert.equal(countCatalogLinkedTemplateItems(graph), 2);
    assert.equal(countCatalogLinkedAvailableUpgradeItems(graph), 1);
  });

  test("Enhanced-style package line keeps 13 included + 1 available upgrade", () => {
    assert.equal(
      formatPackageScopeCountLine({
        optionId: "enhanced",
        optionLabel: "Enhanced",
        sectionCount: 6,
        catalogSectionCount: 2,
        linkedItemCount: 13,
        issueCount: 0,
        availableUpgradeCount: 1,
        availableUpgradeIssueCount: 0,
        status: "ready",
      }),
      "13 included · 1 optional upgrade"
    );
  });

  test("stale starter install copy is replaced on landing", () => {
    assert.equal(
      resolveTemplatePurposeDescription({
        description:
          "Starter roof replacement template with Standard, Enhanced, and Premium customer-facing options. Install catalog items before use.",
      }),
      TEMPLATES_STARTER_PURPOSE_COPY
    );
    assert.equal(TEMPLATES_STARTER_PURPOSE_COPY.includes("Install catalog"), false);
    const review = read("TemplatesQuoteSetupReview.tsx");
    assert.ok(review.includes("resolveTemplatePurposeDescription"));
  });

  test("setup strip is quiet diagnostics when complete; not first-impression chrome", () => {
    const zone = read("TemplatesOnboardingZone.tsx");
    assert.ok(zone.includes("data-templates-setup-diagnostics"));
    assert.ok(zone.includes("<details"));
    assert.ok(zone.includes("Setup"));
    assert.equal(zone.includes("Setup diagnostics"), false);
    assert.ok(!/Setup complete · Catalog ready · Starter installed/.test(zone));
    assert.ok(zone.includes("data-templates-setup-recheck"));
  });

  test("library filters known smoke fixtures and de-emphasizes archived", () => {
    const library = read("TemplatesLibrarySection.tsx");
    const row = read("TemplatesTemplateLibraryRow.tsx");
    const constants = read("templatesConstants.ts");
    assert.ok(library.includes("filterContractorVisibleTemplates"));
    assert.ok(library.includes('status !== "archived"'));
    assert.ok(library.includes("archivedTemplates"));
    assert.ok(library.includes("TEMPLATES_LIBRARY_HEADING"));
    assert.ok(library.includes("data-templates-setup-selector"));
    assert.ok(row.includes('data-templates-library-archived'));
    assert.ok(row.includes("opacity-90"));
    assert.ok(row.includes("countCatalogLinkedAvailableUpgradeItems"));
    assert.ok(row.includes("TEMPLATES_LIBRARY_ROW_SELECTED"));
    assert.ok(row.includes("data-templates-setup-row-selected"));
    assert.ok(constants.includes("TEMPLATES_LIBRARY_SHELL"));
    assert.ok(constants.includes("border-blue-300"));
    assert.ok(constants.includes("ring-1 ring-blue-100"));
    assert.ok(!constants.includes("ring-cyan-200"));
  });

  test("landing regression anchors remain as connected workspace, not stacked cards", () => {
    const review = read("TemplatesQuoteSetupReview.tsx");
    const header = read("TemplatesPageHeader.tsx");
    const included = read("TemplatesIncludedItemsManager.tsx");
    const upgrades = read("TemplatesAvailableUpgradesManager.tsx");
    assert.ok(header.includes("data-templates-add-template"));
    assert.ok(review.includes("data-templates-connected-workspace"));
    assert.ok(review.includes("TEMPLATES_CONNECTED_WORKSPACE"));
    assert.ok(review.includes("data-templates-packages-landing"));
    assert.ok(review.includes("TemplatesIncludedItemsManager"));
    assert.ok(review.includes("TemplatesAvailableUpgradesManager"));
    assert.ok(review.includes("data-templates-proposal-content"));
    assert.ok(review.includes("data-templates-next-use"));
    assert.ok(review.includes("data-templates-open-advanced"));
    assert.ok(review.includes("data-templates-hero-counts"));
    assert.ok(review.includes("TEMPLATES_NEXT_USE_COPY"));
    assert.ok(!review.includes("data-templates-command-surface"));
    assert.ok(!review.includes("data-templates-here-vs-later"));
    assert.ok(!review.includes("data-templates-hero-adjust-included"));
    assert.ok(!review.includes("data-templates-hero-review-content"));
    assert.ok(included.includes("data-templates-adjust-included-work"));
    assert.ok(included.includes("embedded"));
    assert.ok(included.includes("data-templates-prepared-scope-groups"));
    assert.ok(included.includes("ring-1 ring-slate-200/70"));
    assert.ok(upgrades.includes("data-templates-adjust-available-upgrades"));
    assert.ok(upgrades.includes("data-templates-available-upgrades-empty"));
    assert.ok(upgrades.includes("TEMPLATES_ADD_OPTIONAL_UPGRADE_ACTION"));
    assert.ok(!upgrades.includes("TEMPLATES_AVAILABLE_UPGRADES_EMPTY"));
    assert.ok(review.includes("ring-2 ring-blue-100"));
    assert.ok(review.includes("data-templates-proposal-content"));
  });
});
