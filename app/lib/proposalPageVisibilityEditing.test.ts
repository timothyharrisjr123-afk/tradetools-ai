import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canToggleProposalPageVisibility,
  getCustomerPreviewPages,
  getProposalPageVisibilityState,
  PROPOSAL_PAGE_HIDDEN_FROM_CUSTOMER_BANNER,
  PROPOSAL_PAGE_VISIBILITY_HIDDEN_LABEL,
  PROPOSAL_PAGE_VISIBILITY_REQUIRED_NOTICE,
  PROPOSAL_PAGE_VISIBILITY_VISIBLE_LABEL,
  proposalPageVisibilityChanged,
  resolveProposalPageDisplayTitle,
} from "./proposalPageVisibilityEditing";

describe("proposalPageVisibilityEditing", () => {
  it("allows toggling content and media page types", () => {
    for (const pageType of [
      "project_overview",
      "terms",
      "warranty",
      "custom_text",
      "photos",
      "pdf_attachment",
    ] as const) {
      assert.equal(canToggleProposalPageVisibility(pageType), true);
    }
  });

  it("rejects required and deferred page types", () => {
    for (const pageType of [
      "cover",
      "estimate",
      "signature",
      "payment_schedule",
    ] as const) {
      assert.equal(canToggleProposalPageVisibility(pageType), false);
    }
  });

  it("returns visible labels and no banner when page is customer-visible", () => {
    const state = getProposalPageVisibilityState({
      page_type: "terms",
      visible_to_customer: true,
      title: "Terms",
    });
    assert.equal(state.visibleToCustomer, true);
    assert.equal(state.toggleLabel, PROPOSAL_PAGE_VISIBILITY_VISIBLE_LABEL);
    assert.equal(state.bannerText, null);
    assert.equal(state.canToggle, true);
    assert.equal(state.requiredNotice, null);
  });

  it("returns hidden labels and contractor banner when page is hidden", () => {
    const state = getProposalPageVisibilityState({
      page_type: "custom_text",
      visible_to_customer: false,
      customer_title: "Scope notes",
    });
    assert.equal(state.visibleToCustomer, false);
    assert.equal(state.toggleLabel, PROPOSAL_PAGE_VISIBILITY_HIDDEN_LABEL);
    assert.equal(state.bannerText, PROPOSAL_PAGE_HIDDEN_FROM_CUSTOMER_BANNER);
    assert.equal(state.canToggle, true);
  });

  it("returns required notice for cover and estimate", () => {
    for (const pageType of ["cover", "estimate"] as const) {
      const state = getProposalPageVisibilityState({
        page_type: pageType,
        visible_to_customer: true,
        title: pageType,
      });
      assert.equal(state.canToggle, false);
      assert.equal(state.requiredNotice, PROPOSAL_PAGE_VISIBILITY_REQUIRED_NOTICE);
      assert.equal(state.bannerText, null);
    }
  });

  it("detects visibility changes and no-ops when unchanged", () => {
    assert.equal(proposalPageVisibilityChanged(true, true), false);
    assert.equal(proposalPageVisibilityChanged(false, false), false);
    assert.equal(proposalPageVisibilityChanged(true, false), true);
    assert.equal(proposalPageVisibilityChanged(false, true), true);
  });

  it("resolves display title from customer_title then title", () => {
    assert.equal(
      resolveProposalPageDisplayTitle({
        page_type: "terms",
        customer_title: "Terms & Conditions",
        title: "Terms",
      }),
      "Terms & Conditions"
    );
    assert.equal(
      resolveProposalPageDisplayTitle({
        page_type: "terms",
        customer_title: null,
        title: "Terms",
      }),
      "Terms"
    );
  });

  it("filters customer preview pages by visible_to_customer and sort_order", () => {
    const pages = [
      { id: "b", visible_to_customer: true, sort_order: 2 },
      { id: "a", visible_to_customer: false, sort_order: 1 },
      { id: "c", visible_to_customer: true, sort_order: 1 },
    ];
    const preview = getCustomerPreviewPages(pages);
    assert.deepEqual(
      preview.map((page) => page.id),
      ["c", "b"]
    );
  });
});
