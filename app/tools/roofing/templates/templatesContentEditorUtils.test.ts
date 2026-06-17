/**
 * R6 — Pure tests for templatesContentEditorUtils.ts.
 *
 * Run: npx tsx --test app/tools/roofing/templates/templatesContentEditorUtils.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { TemplateContentEditorViewModel } from "@/app/lib/proposalTemplateContentEditorView";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateSectionContent } from "@/app/lib/proposalTemplateTypes";
import {
  buildInitialSectionDrafts,
  buildSectionContentSavePatch,
  countDirtySectionDrafts,
  isSectionBodyDraftDirty,
} from "./templatesContentEditorUtils";

const existingContent: ProposalTemplateSectionContent = {
  title: "Warranty",
  body_markdown: "Original body",
  layout_hint: "full_width",
  asset_ref: "asset-123",
};

describe("buildSectionContentSavePatch", () => {
  test("builds content patch preserving title, layout_hint, and asset_ref", () => {
    const patch = buildSectionContentSavePatch(existingContent, "Updated body");

    assert.equal(patch.title, "Warranty");
    assert.equal(patch.layout_hint, "full_width");
    assert.equal(patch.asset_ref, "asset-123");
    assert.equal(patch.body_markdown, "Updated body");
  });

  test("updates only body_markdown", () => {
    const patch = buildSectionContentSavePatch(existingContent, "Only body changes");

    assert.equal(patch.body_markdown, "Only body changes");
    assert.equal(patch.title, existingContent.title);
    assert.equal(patch.layout_hint, existingContent.layout_hint);
    assert.equal(patch.asset_ref, existingContent.asset_ref);
  });

  test("blank and whitespace draft follows mergeSectionBodyMarkdown behavior", () => {
    assert.equal(buildSectionContentSavePatch(existingContent, "").body_markdown, null);
    assert.equal(buildSectionContentSavePatch(existingContent, "   ").body_markdown, null);
    assert.equal(buildSectionContentSavePatch(existingContent, "\n\t  ").body_markdown, null);
  });

  test("does not mutate input content", () => {
    const snapshot = { ...existingContent };
    buildSectionContentSavePatch(existingContent, "Changed");
    assert.deepEqual(existingContent, snapshot);
  });
});

describe("isSectionBodyDraftDirty", () => {
  test("returns false when unchanged", () => {
    assert.equal(isSectionBodyDraftDirty(existingContent, "Original body", "Original body"), false);
  });

  test("returns true when body differs", () => {
    assert.equal(
      isSectionBodyDraftDirty(existingContent, "Original body", "Changed body"),
      true
    );
  });

  test("handles null, undefined, and empty safely", () => {
    assert.equal(isSectionBodyDraftDirty(null, "", ""), false);
    assert.equal(isSectionBodyDraftDirty(undefined, "", ""), false);
    assert.equal(isSectionBodyDraftDirty(null, "", "New text"), true);
    assert.equal(isSectionBodyDraftDirty(existingContent, "Original body", "   "), true);
    assert.equal(
      isSectionBodyDraftDirty(existingContent, "Original body", "  Original body  "),
      false
    );
  });
});

describe("countDirtySectionDrafts", () => {
  const viewModel: TemplateContentEditorViewModel = {
    templateId: "tpl-1",
    templateName: "Template",
    templateStatus: "active",
    totalEditableSectionCount: 2,
    optionGroups: [
      {
        optionId: "opt-a",
        optionName: "A",
        optionLabel: "A",
        sortOrder: 1,
        sections: [
          {
            sectionId: "sec-1",
            templateId: "tpl-1",
            optionId: "opt-a",
            kind: "text",
            name: "Overview",
            displayTitle: "Overview",
            customerTitle: null,
            sortOrder: 1,
            bodyMarkdown: "Body one",
            contentTitle: null,
            layoutHint: null,
            assetRef: null,
          },
          {
            sectionId: "sec-2",
            templateId: "tpl-1",
            optionId: "opt-a",
            kind: "terms",
            name: "Terms",
            displayTitle: "Terms",
            customerTitle: null,
            sortOrder: 2,
            bodyMarkdown: "",
            contentTitle: null,
            layoutHint: null,
            assetRef: null,
          },
        ],
      },
    ],
  };

  const graph: ProposalTemplateGraph = {
    template: {
      id: "tpl-1",
      company_id: "co-1",
      name: "Template",
      status: "active",
      active: true,
    },
    options: [],
    sections: [
      {
        id: "sec-1",
        template_id: "tpl-1",
        option_id: "opt-a",
        kind: "text",
        name: "Overview",
        content: { body_markdown: "Body one" },
      },
      {
        id: "sec-2",
        template_id: "tpl-1",
        option_id: "opt-a",
        kind: "terms",
        name: "Terms",
        content: null,
      },
    ],
    items: [],
  };

  test("counts zero when all drafts match saved bodies", () => {
    const drafts = buildInitialSectionDrafts(viewModel);
    assert.equal(countDirtySectionDrafts(viewModel, graph, drafts), 0);
  });

  test("counts dirty sections independently", () => {
    const drafts = buildInitialSectionDrafts(viewModel);
    drafts["sec-1"] = "Changed body";
    assert.equal(countDirtySectionDrafts(viewModel, graph, drafts), 1);
  });
});
