import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUILDER_ADD_PAGE_STRIP_POLICY,
  BUILDER_COVER_DRAFT_NOTE,
  BUILDER_DEFAULT_LANDING_PAGE_CONTEXT,
  BUILDER_DOCUMENT_READ_ONLY_FOOTER,
  BUILDER_HEADER_WORKSPACE_CONTEXT_NOTE,
  BUILDER_HEADER_WORKSPACE_KICKER,
  BUILDER_LIFECYCLE_ACTIONS_LOCKED,
  BUILDER_PREVIEW_STRIP_POLICY,
  PROPOSAL_BUILDER_ALL_PLACEHOLDER_SLOTS,
  PROPOSAL_BUILDER_PLACEHOLDERS_AFTER_ESTIMATE,
  PROPOSAL_BUILDER_PLACEHOLDERS_BEFORE_ESTIMATE,
  PROPOSAL_BUILDER_STRIP_ORDER,
  isChromeSurface,
  isDocumentSurface,
  visibleProposalBuilderStripItemIds,
} from "./proposalBuilderDocumentIa";

describe("proposalBuilderDocumentIa", () => {
  it("defines customer-logical strip order", () => {
    assert.deepEqual([...PROPOSAL_BUILDER_STRIP_ORDER], [
      "cover",
      "project_overview",
      "estimate",
      "terms",
      "warranty",
      "photos",
      "add_page",
    ]);
    assert.deepEqual(visibleProposalBuilderStripItemIds(), [...PROPOSAL_BUILDER_STRIP_ORDER]);
  });

  it("keeps Estimate as default landing policy", () => {
    assert.equal(BUILDER_DEFAULT_LANDING_PAGE_CONTEXT, "estimate");
  });

  it("exposes shared workspace and document copy", () => {
    assert.match(BUILDER_HEADER_WORKSPACE_KICKER, /workspace/i);
    assert.match(BUILDER_HEADER_WORKSPACE_CONTEXT_NOTE, /saved draft snapshot/i);
    assert.match(BUILDER_DOCUMENT_READ_ONLY_FOOTER, /read-only draft page/i);
    assert.equal(BUILDER_COVER_DRAFT_NOTE, "Draft proposal — not sent to customer.");
  });

  it("keeps Add Page and Preview lifecycle policy locked", () => {
    assert.equal(BUILDER_LIFECYCLE_ACTIONS_LOCKED, true);
    assert.equal(BUILDER_ADD_PAGE_STRIP_POLICY.enabled, false);
    assert.equal(BUILDER_ADD_PAGE_STRIP_POLICY.showSoon, true);
    assert.equal(BUILDER_PREVIEW_STRIP_POLICY.enabled, false);
    assert.equal(BUILDER_PREVIEW_STRIP_POLICY.status, "locked");
  });

  it("orders placeholder slots before and after Estimate", () => {
    assert.equal(PROPOSAL_BUILDER_PLACEHOLDERS_BEFORE_ESTIMATE.length, 1);
    assert.equal(
      PROPOSAL_BUILDER_PLACEHOLDERS_BEFORE_ESTIMATE[0]?.pageType,
      "project_overview"
    );
    assert.deepEqual(
      PROPOSAL_BUILDER_PLACEHOLDERS_AFTER_ESTIMATE.map((slot) => slot.pageType),
      ["terms", "warranty", "photos"]
    );
    assert.equal(
      PROPOSAL_BUILDER_ALL_PLACEHOLDER_SLOTS.length,
      PROPOSAL_BUILDER_PLACEHOLDERS_BEFORE_ESTIMATE.length +
        PROPOSAL_BUILDER_PLACEHOLDERS_AFTER_ESTIMATE.length
    );
  });

  it("classifies chrome vs document surfaces", () => {
    assert.equal(isChromeSurface("chrome"), true);
    assert.equal(isChromeSurface("document"), false);
    assert.equal(isDocumentSurface("document"), true);
    assert.equal(isDocumentSurface("chrome"), false);
  });
});
