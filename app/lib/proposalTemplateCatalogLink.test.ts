/**
 * Run: npx tsx --test app/lib/proposalTemplateCatalogLink.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalTemplateItem } from "@/app/lib/proposalTemplateTypes";
import {
  TEMPLATE_ADD_FROM_CATALOG_LABEL,
  TEMPLATE_CATALOG_SOT_COPY,
  TEMPLATE_REMOVE_CONFIRM_COPY,
  TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL,
  TEMPLATE_RELINK_CATALOG_LABEL,
  buildCatalogByIdMap,
  buildTemplateCatalogLinkView,
  catalogItemIdsAlreadyInSection,
  defaultItemRoleForSectionKind,
  deriveTemplateCatalogLinkReadiness,
  extractCatalogSeedKey,
  listActiveCatalogItemsForPicker,
  nextTemplateItemSortOrder,
  resolveTemplateCatalogLinkStatus,
  sectionAcceptsCatalogItems,
} from "@/app/lib/proposalTemplateCatalogLink";

function catalog(partial: Partial<CatalogItem> & { id: string; name: string }): CatalogItem {
  return {
    id: partial.id,
    company_id: "co",
    name: partial.name,
    item_type: partial.item_type ?? "material",
    unit: partial.unit ?? "square",
    quantity_source: partial.quantity_source ?? "roof_squares",
    pricing_basis: partial.pricing_basis ?? "unit_price",
    customer_visibility: partial.customer_visibility ?? "customer_visible",
    active: partial.active ?? true,
    unit_price_cents: partial.unit_price_cents ?? 10000,
    unit_cost_cents: partial.unit_cost_cents ?? 5000,
    sort_order: partial.sort_order ?? null,
    metadata: partial.metadata ?? null,
    coverage_rate: null,
    coverage_basis: null,
    waste_applies: false,
    waste_pct: null,
    sales_tax_rate_pct: null,
    purchase_tax_rate_pct: null,
    abc_sku: null,
    qxo_sku: null,
    srs_sku: null,
    ...partial,
  } as CatalogItem;
}

function templateItem(
  partial: Partial<ProposalTemplateItem> & { id: string }
): ProposalTemplateItem {
  return {
    id: partial.id,
    template_id: "t1",
    option_id: "o1",
    section_id: "s1",
    catalog_item_id: partial.catalog_item_id ?? null,
    catalog_seed_key: partial.catalog_seed_key ?? null,
    item_role: partial.item_role ?? "standard",
    sort_order: partial.sort_order ?? 10,
    customer_visibility: "inherit_catalog",
    ...partial,
  };
}

describe("proposalTemplateCatalogLink", () => {
  test("section kinds and default roles", () => {
    assert.equal(sectionAcceptsCatalogItems("line_items"), true);
    assert.equal(sectionAcceptsCatalogItems("upgrade_group"), true);
    assert.equal(sectionAcceptsCatalogItems("terms"), false);
    assert.equal(defaultItemRoleForSectionKind("line_items"), "standard");
    assert.equal(defaultItemRoleForSectionKind("upgrade_group"), "upgrade");
  });

  test("link status: linked / inactive / missing", () => {
    const active = catalog({ id: "c1", name: "Shingles", active: true });
    const inactive = catalog({ id: "c2", name: "Old", active: false });
    const map = buildCatalogByIdMap([active, inactive]);

    assert.equal(
      resolveTemplateCatalogLinkStatus(templateItem({ id: "i1", catalog_item_id: "c1" }), map),
      "linked"
    );
    assert.equal(
      resolveTemplateCatalogLinkStatus(templateItem({ id: "i2", catalog_item_id: "c2" }), map),
      "inactive"
    );
    assert.equal(
      resolveTemplateCatalogLinkStatus(templateItem({ id: "i3", catalog_item_id: "gone" }), map),
      "missing_catalog"
    );
    assert.equal(
      resolveTemplateCatalogLinkStatus(templateItem({ id: "i4", catalog_item_id: null }), map),
      "missing_id"
    );
  });

  test("link view shows honest inactive warning", () => {
    const inactive = catalog({ id: "c2", name: "Ridge", active: false });
    const view = buildTemplateCatalogLinkView(
      templateItem({ id: "i1", catalog_item_id: "c2" }),
      buildCatalogByIdMap([inactive])
    );
    assert.equal(view.status, "inactive");
    assert.match(view.statusLabel, /Inactive/i);
    assert.match(view.statusDetail, /inactive/i);
    assert.equal(view.canRelink, true);
  });

  test("picker lists active only and excludes already-linked ids", () => {
    const items = [
      catalog({ id: "a", name: "Alpha", active: true, sort_order: 20 }),
      catalog({ id: "b", name: "Beta", active: false, sort_order: 10 }),
      catalog({ id: "c", name: "Gamma", active: true, sort_order: 10 }),
    ];
    const listed = listActiveCatalogItemsForPicker(items, {
      excludeCatalogItemIds: new Set(["a"]),
    });
    assert.deepEqual(
      listed.map((i) => i.id),
      ["c"]
    );
  });

  test("picker search filters by name", () => {
    const items = [
      catalog({ id: "a", name: "Architectural shingles", active: true }),
      catalog({ id: "b", name: "Labor tear off", active: true }),
    ];
    const listed = listActiveCatalogItemsForPicker(items, { searchQuery: "shingle" });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, "a");
  });

  test("next sort order and already-in-section ids", () => {
    assert.equal(nextTemplateItemSortOrder([]), 10);
    assert.equal(
      nextTemplateItemSortOrder([
        templateItem({ id: "1", sort_order: 10 }),
        templateItem({ id: "2", sort_order: 30 }),
      ]),
      40
    );
    const ids = catalogItemIdsAlreadyInSection([
      templateItem({ id: "1", catalog_item_id: "c1" }),
      templateItem({ id: "2", catalog_item_id: null }),
    ]);
    assert.equal(ids.has("c1"), true);
    assert.equal(ids.size, 1);
  });

  test("extractCatalogSeedKey and contractor copy constants", () => {
    assert.equal(
      extractCatalogSeedKey(catalog({ id: "1", name: "X", metadata: { seed_key: " ridge " } })),
      "ridge"
    );
    assert.equal(extractCatalogSeedKey(catalog({ id: "2", name: "Y", metadata: null })), null);
    assert.match(TEMPLATE_CATALOG_SOT_COPY, /Catalog is the source of truth/i);
    assert.equal(TEMPLATE_ADD_FROM_CATALOG_LABEL, "Add work item");
    assert.equal(TEMPLATE_RELINK_CATALOG_LABEL, "Replace item");
    assert.equal(TEMPLATE_REMOVE_FROM_TEMPLATE_LABEL, "Remove from this setup");
    assert.match(TEMPLATE_REMOVE_CONFIRM_COPY, /Catalog item will not be deleted/i);
    assert.equal(
      /supplier sync is active|material ordering is live|proposal import is live/i.test(
        TEMPLATE_CATALOG_SOT_COPY
      ),
      false
    );
  });

  test("deriveTemplateCatalogLinkReadiness ready / fix_links / add_items", () => {
    const active = catalog({ id: "c1", name: "A", active: true });
    const inactive = catalog({ id: "c2", name: "B", active: false });
    const map = buildCatalogByIdMap([active, inactive]);

    const ready = deriveTemplateCatalogLinkReadiness(
      [templateItem({ id: "i1", catalog_item_id: "c1" })],
      map
    );
    assert.equal(ready.severity, "ready");
    assert.equal(ready.nextAction, "open_jobs");

    const blocked = deriveTemplateCatalogLinkReadiness(
      [
        templateItem({ id: "i1", catalog_item_id: "c1" }),
        templateItem({ id: "i2", catalog_item_id: "c2" }),
        templateItem({ id: "i3", catalog_item_id: "gone" }),
      ],
      map
    );
    assert.equal(blocked.severity, "blocked");
    assert.equal(blocked.nextAction, "fix_links");
    assert.equal(blocked.inactive, 1);
    assert.equal(blocked.missingCatalog, 1);
    assert.equal(blocked.firstProblemItemId, "i2");

    const empty = deriveTemplateCatalogLinkReadiness([], map);
    assert.equal(empty.nextAction, "add_items");
  });
});
