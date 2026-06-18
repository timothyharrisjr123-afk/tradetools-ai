import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUILDER_DEFAULT_PAGE_CONTEXT,
  BUILDER_DEFAULT_WORKSPACE_SECTION,
  buildPageContextStripItems,
  isEstimatePageContext,
  isOverflowPageContext,
  resolveActiveOverflowPage,
  resolveOverflowMenuTriggerState,
  resolvePageContextDisplayLabel,
} from "./proposalBuilderNavigation";
import type { ProposalPageRow } from "./proposalRecordStore";

function makePage(overrides: Partial<ProposalPageRow> & Pick<ProposalPageRow, "id" | "page_type">): ProposalPageRow {
  return {
    company_id: "co-1",
    proposal_version_id: "ver-1",
    sort_order: 0,
    title: overrides.page_type,
    customer_title: null,
    visible_to_customer: true,
    source_template_section_id: null,
    content_json: {},
    settings_json: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("proposalBuilderNavigation", () => {
  it("defaults to estimate page context and overview workspace", () => {
    assert.equal(BUILDER_DEFAULT_PAGE_CONTEXT, "estimate");
    assert.equal(BUILDER_DEFAULT_WORKSPACE_SECTION, "overview");
    assert.equal(isEstimatePageContext("estimate"), true);
    assert.equal(isEstimatePageContext("cover"), false);
  });

  it("builds strip in customer-logical order with cover disabled by default (R16A)", () => {
    const { items } = buildPageContextStripItems([]);
    const allIds = items.map((item) => item.id);
    const visibleIds = items.filter((item) => item.id !== "preview").map((item) => item.id);
    assert.deepEqual(visibleIds, [
      "cover",
      "placeholder:about",
      "estimate",
      "placeholder:terms",
      "placeholder:warranty",
      "placeholder:photos",
      "add_page",
    ]);
    assert.ok(allIds.includes("preview"));
    const cover = items.find((item) => item.id === "cover");
    assert.equal(cover?.enabled, false);
    assert.equal(cover?.showSoon, true);
    assert.equal(cover?.status, "soon");
    const estimate = items.find((item) => item.id === "estimate");
    assert.equal(estimate?.enabled, true);
    const addPage = items.find((item) => item.id === "add_page");
    assert.equal(addPage?.enabled, false);
    assert.equal(addPage?.showSoon, true);
  });

  it("enables cover when persisted proposal document path is active (R15)", () => {
    const { items } = buildPageContextStripItems([], { persistedProposalDocument: true });
    const cover = items.find((item) => item.id === "cover");
    assert.equal(cover?.enabled, true);
    assert.equal(cover?.showSoon, undefined);
    assert.equal(cover?.status, "none");
    const preview = items.find((item) => item.id === "preview");
    assert.equal(preview?.enabled, false);
    assert.equal(preview?.status, "locked");
    assert.equal(BUILDER_DEFAULT_PAGE_CONTEXT, "estimate");
  });

  it("maps persisted pages into strip slots by page_type", () => {
    const pages = [
      makePage({ id: "p-terms", page_type: "terms", customer_title: "Terms & Conditions" }),
    ];
    const { items } = buildPageContextStripItems(pages);
    const terms = items.find((item) => item.id === "p-terms");
    assert.ok(terms);
    assert.equal(terms?.fromDb, true);
    assert.equal(terms?.label, "Terms & Conditions");
    assert.ok(!items.some((item) => item.id === "placeholder:terms"));
  });

  it("assigns document-page status chips (3J4B6)", () => {
    const { items } = buildPageContextStripItems([]);
    const byId = (id: string) => items.find((item) => item.id === id);

    assert.equal(byId("cover")?.status, "soon");
    assert.equal(byId("placeholder:about")?.status, "empty");
    assert.equal(byId("estimate")?.status, "none");
    assert.equal(byId("placeholder:terms")?.status, "empty");
    assert.equal(byId("add_page")?.status, "soon");
    assert.equal(byId("preview")?.status, "locked");
    assert.equal(byId("preview")?.enabled, false);
  });

  it("persisted page slots use template status", () => {
    const pages = [
      makePage({ id: "p-warranty", page_type: "warranty", customer_title: "Warranty" }),
    ];
    const { items } = buildPageContextStripItems(pages);
    assert.equal(items.find((item) => item.id === "p-warranty")?.status, "template");
    assert.equal(items.find((item) => item.id === "placeholder:terms")?.status, "empty");
  });

  it("resolves display labels for placeholders and persisted pages", () => {
    const pages = [
      makePage({ id: "p-warranty", page_type: "warranty", customer_title: "Warranty" }),
    ];
    assert.equal(resolvePageContextDisplayLabel("placeholder:about", pages), "Project overview");
    assert.equal(resolvePageContextDisplayLabel("p-warranty", pages), "Warranty");
    assert.equal(resolvePageContextDisplayLabel("estimate", pages), "Estimate");
  });

  it("puts custom_text and duplicate page_type pages in overflow (R16C1)", () => {
    const pages = [
      makePage({ id: "p-overview", page_type: "project_overview", sort_order: 1 }),
      makePage({ id: "p-terms", page_type: "terms", sort_order: 2 }),
      makePage({ id: "p-warranty", page_type: "warranty", sort_order: 3 }),
      makePage({
        id: "p-custom",
        page_type: "custom_text",
        customer_title: "Custom Text",
        sort_order: 4,
      }),
      makePage({ id: "p-terms-2", page_type: "terms", customer_title: "Extra Terms", sort_order: 5 }),
    ];
    const { items, overflowPages } = buildPageContextStripItems(pages);

    assert.deepEqual(
      overflowPages.map((page) => page.id),
      ["p-custom", "p-terms-2"]
    );
    assert.ok(items.some((item) => item.id === "p-terms"));
    assert.ok(!items.some((item) => item.id === "p-custom"));
    assert.ok(!items.some((item) => item.id === "p-terms-2"));
  });

  it("never includes cover or estimate in overflow (R16C1)", () => {
    const pages = [
      makePage({ id: "p-cover", page_type: "cover", sort_order: 0 }),
      makePage({ id: "p-estimate", page_type: "estimate", sort_order: 1 }),
      makePage({ id: "p-custom", page_type: "custom_text", sort_order: 2 }),
    ];
    const { overflowPages } = buildPageContextStripItems(pages);

    assert.deepEqual(overflowPages.map((page) => page.id), ["p-custom"]);
    assert.ok(!overflowPages.some((page) => page.pageType === "cover"));
    assert.ok(!overflowPages.some((page) => page.pageType === "estimate"));
  });

  it("sorts overflow pages by sort_order (R16C1)", () => {
    const pages = [
      makePage({ id: "p-overview", page_type: "project_overview", sort_order: 0 }),
      makePage({ id: "p-z", page_type: "custom_text", customer_title: "Z Page", sort_order: 30 }),
      makePage({ id: "p-a", page_type: "custom_text", customer_title: "A Page", sort_order: 10 }),
    ];
    const { overflowPages } = buildPageContextStripItems(pages);

    assert.deepEqual(
      overflowPages.map((page) => page.id),
      ["p-a", "p-z"]
    );
  });

  it("resolves active overflow page state by persisted page id (R16C1)", () => {
    const pages = [
      makePage({ id: "p-overview", page_type: "project_overview", sort_order: 0 }),
      makePage({ id: "p-custom", page_type: "custom_text", customer_title: "Custom Text", sort_order: 1 }),
    ];
    const { overflowPages } = buildPageContextStripItems(pages);

    assert.equal(isOverflowPageContext("p-custom", overflowPages), true);
    assert.equal(isOverflowPageContext("estimate", overflowPages), false);
    assert.equal(isOverflowPageContext("placeholder:terms", overflowPages), false);

    const active = resolveActiveOverflowPage("p-custom", overflowPages);
    assert.equal(active?.label, "Custom Text");

    const trigger = resolveOverflowMenuTriggerState("p-custom", overflowPages);
    assert.equal(trigger.label, "Custom Text");
    assert.equal(trigger.isOverflowActive, true);
    assert.equal(trigger.overflowCount, 1);

    const idleTrigger = resolveOverflowMenuTriggerState("estimate", overflowPages);
    assert.equal(idleTrigger.label, "More pages");
    assert.equal(idleTrigger.isOverflowActive, false);
    assert.equal(idleTrigger.overflowCount, 1);
  });

  it("keeps primary strip behavior unchanged when overflow exists (R16C1)", () => {
    const pages = [
      makePage({ id: "p-overview", page_type: "project_overview", sort_order: 0 }),
      makePage({ id: "p-custom", page_type: "custom_text", sort_order: 1 }),
    ];
    const { items } = buildPageContextStripItems(pages);
    const visibleIds = items.filter((item) => item.id !== "preview").map((item) => item.id);

    assert.deepEqual(visibleIds, [
      "cover",
      "p-overview",
      "estimate",
      "placeholder:terms",
      "placeholder:warranty",
      "placeholder:photos",
      "add_page",
    ]);
  });

  it("carries customerVisible metadata without filtering hidden pages (R16C3)", () => {
    const pages = [
      makePage({
        id: "p-terms",
        page_type: "terms",
        customer_title: "Terms",
        visible_to_customer: false,
      }),
      makePage({
        id: "p-custom",
        page_type: "custom_text",
        customer_title: "Scope notes",
        visible_to_customer: false,
        sort_order: 10,
      }),
      makePage({ id: "p-overview", page_type: "project_overview", sort_order: 0 }),
    ];
    const { items, overflowPages } = buildPageContextStripItems(pages);

    const terms = items.find((item) => item.id === "p-terms");
    assert.equal(terms?.customerVisible, false);
    assert.ok(items.some((item) => item.id === "p-terms"));

    const scopeNotes = overflowPages.find((item) => item.id === "p-custom");
    assert.equal(scopeNotes?.customerVisible, false);
    assert.deepEqual(overflowPages.map((page) => page.id), ["p-custom"]);
  });
});
