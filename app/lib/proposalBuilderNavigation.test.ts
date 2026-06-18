import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUILDER_DEFAULT_PAGE_CONTEXT,
  BUILDER_DEFAULT_WORKSPACE_SECTION,
  buildPageContextStripItems,
  isEstimatePageContext,
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

  it("builds strip with cover disabled by default", () => {
    const { items } = buildPageContextStripItems([]);
    const ids = items.map((item) => item.id);
    assert.ok(ids.includes("cover"));
    assert.ok(ids.includes("estimate"));
    assert.ok(ids.includes("placeholder:terms"));
    assert.ok(ids.includes("add_page"));
    assert.ok(ids.includes("preview"));
    const cover = items.find((item) => item.id === "cover");
    assert.equal(cover?.enabled, false);
    assert.equal(cover?.showSoon, true);
    assert.equal(cover?.status, "soon");
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
    assert.equal(byId("estimate")?.status, "none");
    assert.equal(byId("placeholder:terms")?.status, "empty");
    assert.equal(byId("add_page")?.status, "soon");
    assert.equal(byId("preview")?.status, "locked");
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
});
