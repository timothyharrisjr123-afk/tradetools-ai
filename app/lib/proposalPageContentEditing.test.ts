/**
 * R16B — Pure tests for proposalPageContentEditing.ts
 *
 * Run: npx tsx --test app/lib/proposalPageContentEditing.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  bodyMarkdownChanged,
  EDITABLE_PROPOSAL_PAGE_TYPES,
  isEditableProposalPageType,
  mergeProposalPageBodyMarkdown,
  normalizeProposalPageBodyMarkdown,
  readProposalPageBodyMarkdown,
} from "./proposalPageContentEditing";

describe("isEditableProposalPageType", () => {
  test("accepts editable page types", () => {
    for (const pageType of EDITABLE_PROPOSAL_PAGE_TYPES) {
      assert.equal(isEditableProposalPageType(pageType), true);
    }
  });

  test("rejects non-editable page types", () => {
    assert.equal(isEditableProposalPageType("cover"), false);
    assert.equal(isEditableProposalPageType("estimate"), false);
    assert.equal(isEditableProposalPageType("photos"), false);
    assert.equal(isEditableProposalPageType("pdf_attachment"), false);
    assert.equal(isEditableProposalPageType("signature"), false);
    assert.equal(isEditableProposalPageType("payment_schedule"), false);
    assert.equal(isEditableProposalPageType(null), false);
  });
});

describe("normalizeProposalPageBodyMarkdown", () => {
  test("trims outer whitespace and preserves internal line breaks", () => {
    assert.equal(
      normalizeProposalPageBodyMarkdown("  line one\n\nline two  "),
      "line one\n\nline two"
    );
  });

  test("normalizes CRLF to LF", () => {
    assert.equal(normalizeProposalPageBodyMarkdown("a\r\nb"), "a\nb");
  });

  test("empty or whitespace-only becomes null", () => {
    assert.equal(normalizeProposalPageBodyMarkdown(""), null);
    assert.equal(normalizeProposalPageBodyMarkdown("   \n\t  "), null);
  });
});

describe("bodyMarkdownChanged", () => {
  test("detects meaningful edits", () => {
    assert.equal(bodyMarkdownChanged("Hello", "Hello world"), true);
    assert.equal(bodyMarkdownChanged("Hello", "Hello"), false);
    assert.equal(bodyMarkdownChanged(null, ""), false);
    assert.equal(bodyMarkdownChanged("Hi", "  Hi  "), false);
  });
});

describe("mergeProposalPageBodyMarkdown", () => {
  test("patch preserves non-body content_json keys", () => {
    const existing = {
      body_markdown: "Old",
      media_refs: [{ storage_key: "photo-1", caption: "Front", sort_order: 0 }],
      pdf_attachment_key: "pdf-abc",
    };

    const result = mergeProposalPageBodyMarkdown(existing, "Updated body");

    assert.equal(result.body_markdown, "Updated body");
    assert.deepEqual(result.media_refs, existing.media_refs);
    assert.equal(result.pdf_attachment_key, "pdf-abc");
  });

  test("clears body when next is whitespace-only", () => {
    const result = mergeProposalPageBodyMarkdown({ body_markdown: "Keep until cleared" }, "   ");
    assert.equal(result.body_markdown, null);
  });

  test("does not mutate input object", () => {
    const existing = { body_markdown: "Original", media_refs: [] };
    const copy = { ...existing, media_refs: [...existing.media_refs] };
    mergeProposalPageBodyMarkdown(existing, "New");
    assert.equal(existing.body_markdown, "Original");
    assert.notEqual(copy.body_markdown, "New");
  });
});

describe("readProposalPageBodyMarkdown", () => {
  test("reads string body_markdown", () => {
    assert.equal(readProposalPageBodyMarkdown({ body_markdown: "Text" }), "Text");
  });

  test("returns null for missing or invalid body", () => {
    assert.equal(readProposalPageBodyMarkdown(null), null);
    assert.equal(readProposalPageBodyMarkdown({ body_markdown: 42 }), null);
  });
});

describe("persistence format", () => {
  test("merge stores raw markdown including token placeholders — not rendered output", () => {
    const raw = "Hello {{customer_name}}, total {{proposal_total}}.";
    const merged = mergeProposalPageBodyMarkdown(null, raw);
    assert.equal(merged.body_markdown, raw);
    assert.match(merged.body_markdown!, /\{\{customer_name\}\}/);
  });
});
