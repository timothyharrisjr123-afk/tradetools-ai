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
  test("Setup nav uses Catalog label, not Price book", () => {
    const setup = FIELD_DIVE_NAV_SECTIONS.find((section) => section.id === "setup");
    assert.ok(setup);
    const catalog = setup.items.find((item) => item.key === "catalog");
    assert.ok(catalog);
    assert.equal(catalog.label, "Catalog");
    assert.equal(catalog.href, "/tools/roofing/catalog");
  });

  test("keeps Jobs and Proposal templates reachable", () => {
    assert.equal(hasNavHref("/tools/roofing/saved"), true);
    assert.equal(hasNavHref("/tools/roofing/templates"), true);
    assert.equal(hasNavHref("/tools/roofing/catalog"), true);
    assert.equal(hasNavHref("/tools/settings"), true);
    assert.equal(hasNavHref("/tools/settings/pricing"), true);
    assert.equal(hasNavHref("/tools/settings/payments"), true);
  });

  test("uses Jobs label for Job Board route", () => {
    const jobs = getPrimaryWorkflowNavItems().find((item) => item.key === "jobs");
    assert.ok(jobs);
    assert.equal(jobs.label, "Jobs");
    assert.equal(jobs.href, "/tools/roofing/saved");
  });

  test("New job links directly to Job Packet intake", () => {
    const newJob = getPrimaryWorkflowNavItems().find((item) => item.key === "newJob");
    assert.ok(newJob);
    assert.equal(newJob.kind, "link");
    assert.equal(newJob.href, "/tools/roofing?entry=packet");
  });

  test("does not add Proposals hub nav before R16", () => {
    const hrefs = collectNavHrefs();
    assert.ok(!hrefs.some((href) => href.startsWith("/tools/roofing/proposals")));
    assert.ok(!flattenNavItems().some((item) => /proposals/i.test(item.label)));
  });

  test("removes Estimates from primary workflow group", () => {
    const primaryLabels = getPrimaryWorkflowNavItems().map((item) => item.label);
    assert.ok(!primaryLabels.includes("Estimates"));
    assert.ok(!primaryLabels.some((label) => label === "Estimates (Legacy)"));
  });

  test("places Instant Estimate in Advanced section", () => {
    const legacy = getLegacyAndFutureNavItems();
    const instant = legacy.find((item) => item.label === "Instant Estimate");
    assert.ok(instant);
    assert.equal(instant.kind, "soon");
  });

  test("places Estimates legacy item outside primary workflow", () => {
    const legacy = getLegacyAndFutureNavItems();
    const estimates = legacy.find((item) => item.label === "Estimates (Legacy)");
    assert.ok(estimates);
    assert.equal(estimates.kind, "soon");
    assert.equal(estimates.href, undefined);
  });

  test("keeps admin hrefs only in Advanced section", () => {
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

  test("Advanced section is collapsed by default", () => {
    const advanced = FIELD_DIVE_NAV_SECTIONS.find((section) => section.id === "legacyAndFuture");
    assert.ok(advanced);
    assert.equal(advanced.label, "Advanced");
    assert.equal(advanced.collapsedByDefault, true);
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
