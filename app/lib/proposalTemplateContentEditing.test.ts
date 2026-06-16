/**
 * 3J4H — Pure tests for proposalTemplateContentEditing.ts.
 *
 * Run: npx tsx --test app/lib/proposalTemplateContentEditing.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  EDITABLE_TEXT_SECTION_KINDS,
  isEditableTextSection,
  mergeSectionBodyMarkdown,
} from "./proposalTemplateContentEditing";
import type { ProposalTemplateSectionContent } from "./proposalTemplateTypes";

describe("mergeSectionBodyMarkdown", () => {
  test("preserves title, layout_hint, and asset_ref while changing body_markdown", () => {
    const existing: ProposalTemplateSectionContent = {
      title: "Warranty",
      body_markdown: "Old body",
      layout_hint: "full_width",
      asset_ref: "asset-123",
    };

    const result = mergeSectionBodyMarkdown(existing, "Updated warranty text.");

    assert.equal(result.title, "Warranty");
    assert.equal(result.body_markdown, "Updated warranty text.");
    assert.equal(result.layout_hint, "full_width");
    assert.equal(result.asset_ref, "asset-123");
  });

  test("handles null existing content", () => {
    const result = mergeSectionBodyMarkdown(null, "New body");

    assert.equal(result.title, null);
    assert.equal(result.body_markdown, "New body");
    assert.equal(result.layout_hint, null);
    assert.equal(result.asset_ref, null);
  });

  test("handles undefined existing content", () => {
    const result = mergeSectionBodyMarkdown(undefined, "New body");

    assert.equal(result.title, null);
    assert.equal(result.body_markdown, "New body");
    assert.equal(result.layout_hint, null);
    assert.equal(result.asset_ref, null);
  });

  test("normalizes blank and whitespace-only body to null", () => {
    const existing: ProposalTemplateSectionContent = {
      title: "Terms",
      body_markdown: "Keep until cleared",
    };

    assert.equal(mergeSectionBodyMarkdown(existing, "").body_markdown, null);
    assert.equal(mergeSectionBodyMarkdown(existing, "   ").body_markdown, null);
    assert.equal(mergeSectionBodyMarkdown(existing, "\n\t  ").body_markdown, null);
  });

  test("does not mutate the original content object", () => {
    const existing: ProposalTemplateSectionContent = {
      title: "Project overview",
      body_markdown: "Original body",
      layout_hint: "stacked",
      asset_ref: "ref-a",
    };
    const snapshot = { ...existing };

    mergeSectionBodyMarkdown(existing, "Changed body");

    assert.deepEqual(existing, snapshot);
  });
});

describe("isEditableTextSection", () => {
  test("returns true for text, terms, and warranty", () => {
    assert.equal(isEditableTextSection("text"), true);
    assert.equal(isEditableTextSection("terms"), true);
    assert.equal(isEditableTextSection("warranty"), true);
  });

  test("returns false for non-editable section kinds", () => {
    assert.equal(isEditableTextSection("line_items"), false);
    assert.equal(isEditableTextSection("upgrade_group"), false);
    assert.equal(isEditableTextSection("image"), false);
    assert.equal(isEditableTextSection("signature_placeholder"), false);
  });

  test("returns false for unknown, null, and undefined input", () => {
    assert.equal(isEditableTextSection(null), false);
    assert.equal(isEditableTextSection(undefined), false);
    assert.equal(isEditableTextSection("custom_text"), false);
    assert.equal(isEditableTextSection(""), false);
  });
});

describe("EDITABLE_TEXT_SECTION_KINDS", () => {
  test("contains exactly text, terms, and warranty", () => {
    assert.deepEqual(EDITABLE_TEXT_SECTION_KINDS, ["text", "terms", "warranty"]);
  });
});
