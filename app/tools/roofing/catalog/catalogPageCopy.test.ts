/**
 * Run: npx tsx --test app/tools/roofing/catalog/catalogPageCopy.test.ts
 *
 * Pure assertions for Catalog P0B–P0D page shell, command bar, and Settings
 * (no React DOM required).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  CATALOG_BULK_SELECTION_PLANNED_TITLE,
  CATALOG_COMMAND_BAR_PLANNED_CONTROLS,
  CATALOG_COMING_SOON_LABEL,
  CATALOG_FILTERS_SORT_LABEL,
  CATALOG_PAGE_SUBTITLE,
  CATALOG_SETTINGS_PLANNED_TOOLS,
  CATALOG_TABLE_HEADERS,
} from "@/app/lib/catalogContractorLabels";

const ROOT = join(process.cwd(), "app/tools/roofing/catalog");
const ADMIN_ROOT = join(process.cwd(), "app/admin/catalog/components");
const HANDOFF = join(process.cwd(), "docs/fielddive-global-handoff.md");

function readCatalogFile(name: string): string {
  return readFileSync(join(ROOT, name), "utf8");
}

function readAdminComponent(name: string): string {
  return readFileSync(join(ADMIN_ROOT, name), "utf8");
}

describe("Catalog P0B–P0D page shell", () => {
  test("header uses exact compact subtitle", () => {
    const source = readCatalogFile("CatalogPageHeader.tsx");
    assert.ok(source.includes("CATALOG_PAGE_SUBTITLE") || source.includes(CATALOG_PAGE_SUBTITLE));
    assert.equal(CATALOG_PAGE_SUBTITLE, "Manage the materials, labor, and fees used in proposals.");
  });

  test("SetupClient renders All items and Settings tabs with All items default", () => {
    const source = readCatalogFile("CatalogSetupClient.tsx");
    assert.ok(source.includes('useState<CatalogPageTab>("all_items")'));
    assert.ok(source.includes("All items"));
    assert.ok(source.includes("Settings"));
    assert.ok(source.includes("CatalogSettingsPanel"));
    assert.ok(!source.includes("CatalogSetupChecklist"));
    assert.ok(!source.includes("CatalogStarterHeroCard"));
    assert.ok(!source.includes("CatalogRoadmapFootnote"));
    assert.ok(!source.includes("CatalogWorkspaceLayout"));
  });

  test("P0D All items is continuous flat list without group divider rows", () => {
    const setup = readCatalogFile("CatalogSetupClient.tsx");
    assert.ok(setup.includes('key: "flat"'));
    assert.ok(!setup.includes("CATALOG_TYPE_GROUP_SECTIONS"));
    assert.ok(!setup.includes("groupByItemType"));
    const table = readAdminComponent("CatalogItemTable.tsx");
    assert.ok(!table.includes("Materials"));
    assert.ok(!table.includes("Fees & Other"));
    assert.ok(!table.includes("section.label"));
    assert.ok(!table.includes("Grouped by type"));
  });

  test("command bar has Search, Filters & sort, planned controls, and Add", () => {
    const source = readAdminComponent("CatalogItemToolbar.tsx");
    assert.ok(source.includes("Search catalog"));
    assert.ok(source.includes("CATALOG_FILTERS_SORT_LABEL") || source.includes(CATALOG_FILTERS_SORT_LABEL));
    assert.ok(source.includes("Show inactive"));
    assert.ok(source.includes("Add catalog item"));
    assert.ok(source.includes("CATALOG_COMMAND_BAR_PLANNED_CONTROLS"));
    assert.ok(source.includes("aria-disabled"));
    assert.ok(source.includes("CATALOG_COMING_SOON_LABEL"));
    assert.deepEqual(
      CATALOG_COMMAND_BAR_PLANNED_CONTROLS.map((c) => c.label),
      ["Re-order items", "Columns", "Manage catalog"]
    );
    assert.equal(CATALOG_COMING_SOON_LABEL, "Coming soon");
    assert.ok(!source.includes("Manage catalog menu"));
    assert.ok(!source.includes("onManageCatalog"));
    assert.ok(!source.includes("onColumns"));
    assert.ok(!source.includes("onReorder"));
  });

  test("disabled selection column renders without bulk bar", () => {
    const source = readAdminComponent("CatalogItemTable.tsx");
    assert.ok(source.includes('type="checkbox"'));
    assert.ok(source.includes("disabled"));
    assert.ok(source.includes("aria-disabled"));
    assert.ok(
      source.includes("CATALOG_BULK_SELECTION_PLANNED_TITLE") ||
        source.includes(CATALOG_BULK_SELECTION_PLANNED_TITLE)
    );
    assert.ok(!source.includes("selectedCount"));
    assert.ok(!source.includes("bulk"));
    assert.ok(!source.includes("Bulk actions"));
    assert.ok(!source.includes("onSelect"));
    assert.ok(!source.includes("Sales tax"));
    assert.ok(!source.includes("Supplier"));
    // Coverage/Waste live on item edit + name secondary line — not table columns.
    assert.ok(!source.includes("CATALOG_CONTRACTOR_LABELS.coverage"));
    assert.ok(!source.includes("CATALOG_CONTRACTOR_LABELS.waste"));
  });

  test("Settings panel links to Pricing rules and Proposal templates without tax forms", () => {
    const source = readCatalogFile("CatalogSettingsPanel.tsx");
    assert.ok(source.includes("Catalog settings"));
    assert.ok(source.includes("/tools/settings/pricing"));
    assert.ok(source.includes("/tools/roofing/templates"));
    assert.ok(source.includes("Open Pricing rules"));
    assert.ok(source.includes("Open Proposal templates"));
    assert.ok(source.includes("CATALOG_SETTINGS_PLANNED_TOOLS"));
    assert.ok(source.includes("Future Catalog tools"));
    assert.ok(source.includes("Coming soon") || source.includes("CATALOG_COMING_SOON_LABEL"));
    assert.ok(!source.includes("salesTax"));
    assert.ok(!source.includes("sales_tax"));
    assert.ok(!source.includes("waste_applies"));
    assert.ok(!source.includes("coverage_rate"));
    assert.ok(!source.includes('type="number"'));
    assert.ok(!source.includes("wasteModel"));
    assert.ok(!/raw_plus_waste|mode switch/i.test(source));
    assert.ok(CATALOG_SETTINGS_PLANNED_TOOLS.some((t) => t.title.includes("Catalog defaults")));
    assert.ok(CATALOG_SETTINGS_PLANNED_TOOLS.length >= 5);
    const coverageWaste = CATALOG_SETTINGS_PLANNED_TOOLS.find(
      (t) => t.id === "coverage_waste_tax"
    );
    assert.ok(coverageWaste);
    assert.match(coverageWaste!.detail, /editable on each catalog item/i);
    assert.match(coverageWaste!.detail, /quantity-mode switching/i);
    assert.match(coverageWaste!.detail, /remain planned/i);
    assert.equal(/raw_plus_waste/i.test(coverageWaste!.detail), false);
  });

  test("load failure retry path is available and empty install is load-error gated", () => {
    const alerts = readCatalogFile("CatalogPageAlerts.tsx");
    const setup = readCatalogFile("CatalogSetupClient.tsx");
    assert.ok(alerts.includes("onRetryLoad"));
    assert.ok(alerts.includes("Retry"));
    assert.ok(setup.includes("!loadError && sortedItems.length === 0"));
    assert.ok(setup.includes("loadCatalogItemsByCompany") || setup.includes("loadActiveCatalogItemsByCompany"));
  });

  test("Phase 7 Coverage/Waste appear on catalog item edit/add surfaces", () => {
    const edit = readAdminComponent("CatalogItemDetailPanel.tsx");
    const add = readAdminComponent("AddCatalogItemModal.tsx");
    assert.match(edit, /data-catalog-quantity-drivers="edit"/);
    assert.match(add, /data-catalog-quantity-drivers="add"/);
    assert.match(edit, /data-catalog-coverage-basis="edit"/);
    assert.match(add, /data-catalog-coverage-basis="add"/);
    assert.ok(edit.includes("CATALOG_CONTRACTOR_LABELS.coverage"));
    assert.ok(edit.includes("CATALOG_CONTRACTOR_LABELS.coverageBasis"));
    assert.ok(edit.includes("CATALOG_CONTRACTOR_LABELS.waste"));
    assert.ok(edit.includes("CATALOG_FIELD_HELPERS.quantityDriversSection"));
    assert.ok(add.includes("CATALOG_FIELD_HELPERS.quantityDriversSection"));
  });

  test("table renders Proposal/Status pills and spaced actions", () => {
    const source = readAdminComponent("CatalogItemTable.tsx");
    assert.ok(source.includes("formatProposalVisibilityShort"));
    assert.ok(source.includes("formatCatalogItemStatus"));
    assert.ok(source.includes("proposalPillClass") || source.includes("CATALOG_PILL_PROPOSAL"));
    assert.ok(source.includes("statusPillClass") || source.includes("CATALOG_PILL_STATUS"));
    assert.ok(source.includes("Edit"));
    assert.ok(source.includes("Deactivate"));
    assert.ok(!source.includes("Delete"));
  });

  test("table headers contract matches supported columns", () => {
    assert.deepEqual([...CATALOG_TABLE_HEADERS], [
      "Name",
      "Type",
      "Measurement",
      "Unit",
      "Unit cost",
      "Unit price",
      "Proposal",
      "Status",
      "Actions",
    ]);
  });

  test("handoff documents P0D deferred bulk and planned controls", () => {
    const handoff = readFileSync(HANDOFF, "utf8");
    assert.ok(handoff.includes("P0D"));
    assert.ok(handoff.includes("continuous ungrouped") || handoff.includes("ungrouped"));
    assert.ok(handoff.includes("Disabled checkbox column") || handoff.includes("checkbox column"));
    assert.ok(handoff.includes("Manage catalog CSV") || handoff.includes("CSV import/export"));
    assert.ok(handoff.includes("Re-order items"));
    assert.ok(handoff.includes("Columns / display"));
  });
});
