/**
 * R7 — Pure tests for fieldDiveNavConfig.ts invariants.
 *
 * Run: npx tsx --test app/tools/roofing/fieldDiveNavConfig.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  FIELD_DIVE_NAV_SECTIONS,
  collectNavHrefs,
  flattenNavItems,
  getLegacyAndFutureNavItems,
  getPrimaryWorkflowNavItems,
  hasNavHref,
} from "./fieldDiveNavConfig";

describe("fieldDiveNavConfig", () => {
  test("keeps Job Board and Templates reachable", () => {
    assert.equal(hasNavHref("/tools/roofing/saved"), true);
    assert.equal(hasNavHref("/tools/roofing/templates"), true);
    assert.equal(hasNavHref("/tools/roofing/catalog"), true);
    assert.equal(hasNavHref("/tools/settings"), true);
  });

  test("does not add Proposals hub nav before R16", () => {
    const hrefs = collectNavHrefs();
    assert.ok(!hrefs.some((href) => href.startsWith("/tools/roofing/proposals")));
    assert.ok(!flattenNavItems().some((item) => /proposals/i.test(item.label)));
  });

  test("has no duplicate live top-level href to /tools/roofing in primary workflow", () => {
    const primaryRootMatches = getPrimaryWorkflowNavItems().filter(
      (item) => item.href === "/tools/roofing"
    );
    assert.equal(primaryRootMatches.length, 1);
    assert.equal(primaryRootMatches[0]?.key, "newJob");
  });

  test("removes Estimates from primary workflow group", () => {
    const primaryLabels = getPrimaryWorkflowNavItems().map((item) => item.label);
    assert.ok(!primaryLabels.includes("Estimates"));
    assert.ok(!primaryLabels.some((label) => label === "Estimates (Legacy)"));
  });

  test("places Estimates legacy item outside primary workflow", () => {
    const legacy = getLegacyAndFutureNavItems();
    const estimates = legacy.find((item) => item.label === "Estimates (Legacy)");
    assert.ok(estimates);
    assert.equal(estimates.kind, "soon");
    assert.equal(estimates.href, undefined);
  });

  test("keeps admin hrefs only in legacy section", () => {
    const primaryHrefs = collectNavHrefs(
      FIELD_DIVE_NAV_SECTIONS.filter((section) => section.id !== "legacyAndFuture")
    );
    assert.ok(!primaryHrefs.some((href) => href.startsWith("/admin/")));

    const legacyHrefs = collectNavHrefs(
      FIELD_DIVE_NAV_SECTIONS.filter((section) => section.id === "legacyAndFuture")
    );
    assert.ok(legacyHrefs.includes("/admin/customers"));
    assert.ok(legacyHrefs.includes("/admin/price-book"));
  });

  test("marks future placeholders as soon without href", () => {
    const legacy = getLegacyAndFutureNavItems();
    for (const label of ["Calendar", "Invoices", "Reports"]) {
      const item = legacy.find((row) => row.label === label);
      assert.ok(item, `missing ${label}`);
      assert.equal(item.kind, "soon");
      assert.equal(item.href, undefined);
    }
  });
});
