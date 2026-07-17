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
  CATALOG_COMMAND_BAR_ACTIVE_CONTROLS,
  CATALOG_COMMAND_BAR_PLANNED_CONTROLS,
  CATALOG_COMING_SOON_LABEL,
  CATALOG_FIELD_HELPERS,
  CATALOG_FILTERS_SORT_LABEL,
  CATALOG_MANAGE_MENU_ITEMS,
  CATALOG_PAGE_SUBTITLE,
  CATALOG_PLANNED_LABEL,
  CATALOG_SETTINGS_PLANNED_TOOLS,
  CATALOG_TABLE_HEADERS,
} from "@/app/lib/catalogContractorLabels";
import {
  CATALOG_OPTIONAL_COLUMNS,
  CATALOG_REQUIRED_COLUMN_IDS,
} from "@/app/lib/catalogColumnVisibility";

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

  test("command bar has Search, Filters & sort, Columns, Manage catalog, and Add", () => {
    const source = readAdminComponent("CatalogItemToolbar.tsx");
    assert.ok(source.includes("Search catalog"));
    assert.ok(source.includes("CATALOG_FILTERS_SORT_LABEL") || source.includes(CATALOG_FILTERS_SORT_LABEL));
    assert.ok(source.includes("Show inactive"));
    assert.ok(source.includes("Add catalog item"));
    assert.ok(source.includes("CATALOG_COMMAND_BAR_PLANNED_CONTROLS"));
    assert.ok(source.includes("data-catalog-columns-menu"));
    assert.ok(source.includes("data-catalog-manage-menu"));
    assert.ok(source.includes("onColumnVisibilityChange"));
    assert.deepEqual(
      CATALOG_COMMAND_BAR_PLANNED_CONTROLS.map((c) => c.label),
      ["Re-order items"]
    );
    assert.deepEqual(
      CATALOG_COMMAND_BAR_ACTIVE_CONTROLS.map((c) => c.label),
      ["Columns", "Manage catalog"]
    );
    assert.equal(CATALOG_COMING_SOON_LABEL, "Coming soon");
    assert.ok(!source.includes("onReorder"));
  });

  test("Columns control toggles optional columns; required columns stay fixed", () => {
    const toolbar = readAdminComponent("CatalogItemToolbar.tsx");
    const table = readAdminComponent("CatalogItemTable.tsx");
    const workspace = readCatalogFile("CatalogItemsWorkspace.tsx");
    assert.ok(toolbar.includes("data-catalog-column-toggle"));
    assert.ok(toolbar.includes("CATALOG_OPTIONAL_COLUMNS"));
    assert.ok(toolbar.includes("Reset columns"));
    assert.ok(table.includes("columnVisibility"));
    assert.ok(table.includes("isCatalogOptionalColumnVisible"));
    assert.ok(workspace.includes("CATALOG_COLUMN_PREFS_STORAGE_KEY"));
    assert.ok(workspace.includes("localStorage"));
    assert.deepEqual([...CATALOG_REQUIRED_COLUMN_IDS], ["select", "name", "actions"]);
    assert.ok(CATALOG_OPTIONAL_COLUMNS.some((c) => c.id === "type"));
    assert.ok(CATALOG_OPTIONAL_COLUMNS.some((c) => c.id === "unit_price"));
    // Coverage / tax are not optional table columns in this shell.
    assert.equal(
      CATALOG_OPTIONAL_COLUMNS.some((c) => c.id === "coverage" || c.id === "tax"),
      false
    );
  });

  test("Manage Catalog menu activates CSV v1 and keeps supplier/bulk/reorder planned", () => {
    const source = readAdminComponent("CatalogItemToolbar.tsx");
    const setup = readCatalogFile("CatalogSetupClient.tsx");
    const workspace = readCatalogFile("CatalogItemsWorkspace.tsx");
    assert.ok(source.includes("CATALOG_MANAGE_MENU_ITEMS"));
    assert.ok(source.includes("data-catalog-manage-status=\"live\""));
    assert.ok(source.includes("data-catalog-manage-status=\"planned\""));
    assert.ok(source.includes("onDownloadCsvTemplate"));
    assert.ok(source.includes("onExportCsv"));
    assert.ok(source.includes("onUploadCsv"));
    assert.ok(source.includes("CATALOG_PLANNED_LABEL") || source.includes(CATALOG_PLANNED_LABEL));
    const labels = CATALOG_MANAGE_MENU_ITEMS.map((i) => i.label);
    assert.ok(labels.includes("Download template"));
    assert.ok(labels.includes("Download CSV"));
    assert.ok(labels.includes("Upload CSV"));
    assert.ok(labels.includes("Connect supplier"));
    assert.ok(labels.includes("Bulk edit purchase tax"));
    assert.ok(labels.includes("Jumpstart / import starter"));
    assert.ok(labels.includes("Reorder items"));
    const liveIds = CATALOG_MANAGE_MENU_ITEMS.filter((i) => i.status === "live").map((i) => i.id);
    assert.deepEqual(liveIds, ["download_template", "download_csv", "upload_csv"]);
    for (const item of CATALOG_MANAGE_MENU_ITEMS.filter((i) => i.status === "planned")) {
      assert.match(item.detail, /Planned/i);
    }
    assert.ok(setup.includes("analyzeCatalogCsv"));
    assert.ok(setup.includes("applyCatalogCsvImport"));
    assert.ok(setup.includes("buildCatalogCsvTemplate"));
    assert.ok(workspace.includes("CatalogCsvImportModal"));
    assert.ok(!source.includes("onConnectSupplier"));
    assert.ok(!source.includes("onBulkPurchaseTax"));
    assert.equal(/supplier is connected|bulk purchase tax is live/i.test(source), false);
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
    assert.match(coverageWaste!.detail, /item tax rates/i);
    assert.match(coverageWaste!.detail, /Proposal line-tax math/i);
    assert.match(coverageWaste!.detail, /quantity-mode switching/i);
    assert.match(coverageWaste!.detail, /remain planned/i);
    assert.equal(/raw_plus_waste/i.test(coverageWaste!.detail), false);
    assert.equal(/line-tax math is active/i.test(coverageWaste!.detail), false);
    const columnsTool = CATALOG_SETTINGS_PLANNED_TOOLS.find((t) => t.id === "columns");
    assert.ok(columnsTool);
    assert.match(columnsTool!.detail, /live on All items/i);
    const csvTool = CATALOG_SETTINGS_PLANNED_TOOLS.find((t) => t.id === "csv");
    assert.ok(csvTool);
    assert.match(csvTool!.detail, /CSV v1 is live/i);
    assert.match(csvTool!.detail, /Supplier SKU fields persist/i);
    const supplierTool = CATALOG_SETTINGS_PLANNED_TOOLS.find((t) => t.id === "supplier");
    assert.ok(supplierTool);
    assert.match(supplierTool!.detail, /SKU storage is live/i);
    assert.match(supplierTool!.detail, /remain Planned/i);
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

  test("item tax capture appears on add/edit; purchase tax marked internal; no active line-tax claim", () => {
    const edit = readAdminComponent("CatalogItemDetailPanel.tsx");
    const add = readAdminComponent("AddCatalogItemModal.tsx");
    assert.match(add, /data-catalog-tax="add"/);
    assert.match(edit, /data-catalog-tax="edit"/);
    assert.ok(add.includes("CATALOG_CONTRACTOR_LABELS.salesTax"));
    assert.ok(add.includes("CATALOG_CONTRACTOR_LABELS.purchaseTax"));
    assert.ok(edit.includes("CATALOG_CONTRACTOR_LABELS.salesTax"));
    assert.ok(edit.includes("CATALOG_CONTRACTOR_LABELS.purchaseTax"));
    assert.match(add, /\(internal\)/);
    assert.match(edit, /\(internal\)/);
    assert.ok(add.includes("CATALOG_FIELD_HELPERS.purchaseTax"));
    assert.ok(add.includes("CATALOG_FIELD_HELPERS.salesTax"));
    assert.equal(/line-tax math is active/i.test(add), false);
    assert.equal(/line-tax math is active/i.test(edit), false);
    const table = readAdminComponent("CatalogItemTable.tsx");
    assert.ok(!table.includes("sales_tax_rate_pct"));
    assert.ok(!table.includes("purchase_tax_rate_pct"));
  });

  test("supplier SKU storage appears on add/edit; no sync claim; table stays clean", () => {
    const edit = readAdminComponent("CatalogItemDetailPanel.tsx");
    const add = readAdminComponent("AddCatalogItemModal.tsx");
    assert.match(add, /data-catalog-supplier="add"/);
    assert.match(edit, /data-catalog-supplier="edit"/);
    assert.ok(add.includes("CATALOG_CONTRACTOR_LABELS.abcSku"));
    assert.ok(add.includes("CATALOG_CONTRACTOR_LABELS.qxoSku"));
    assert.ok(add.includes("CATALOG_CONTRACTOR_LABELS.srsSku"));
    assert.ok(add.includes("CATALOG_FIELD_HELPERS.supplierSection"));
    assert.ok(edit.includes("CATALOG_FIELD_HELPERS.supplierSection"));
    assert.match(CATALOG_FIELD_HELPERS.supplierSection, /No supplier sync is active yet/i);
    assert.equal(
      /supplier is connected|prices refresh|sync is live/i.test(
        add + edit + CATALOG_FIELD_HELPERS.supplierSection
      ),
      false
    );
    const table = readAdminComponent("CatalogItemTable.tsx");
    assert.ok(!table.includes("abc_sku"));
    assert.ok(!table.includes("qxo_sku"));
    assert.ok(!table.includes("srs_sku"));
  });

  test("Customer Preview sources stay free of purchase tax catalog fields", () => {
    const files = [
      "app/lib/proposalCustomerEstimatePresenter.ts",
      "app/lib/proposalCustomerPreviewViewModel.ts",
      "app/lib/proposalPricingEngine.ts",
    ];
    for (const rel of files) {
      const source = readFileSync(join(process.cwd(), rel), "utf8");
      assert.ok(!source.includes("purchase_tax_rate_pct"), rel);
      assert.ok(!source.includes("Material purchase tax"), rel);
      assert.ok(!source.includes("abc_sku"), rel);
      assert.ok(!source.includes("qxo_sku"), rel);
      assert.ok(!source.includes("srs_sku"), rel);
    }
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
