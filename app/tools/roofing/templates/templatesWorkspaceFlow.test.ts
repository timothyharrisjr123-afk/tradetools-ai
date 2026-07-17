/**
 * Run: npx tsx --test app/tools/roofing/templates/templatesWorkspaceFlow.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  TEMPLATES_WORKSPACE_TABS,
  TEMPLATES_WORKSPACE_TRUST_NOTE,
  defaultExpandedPackageOptionId,
  summarizePackageOptionsForWorkspace,
} from "./templatesWorkspaceFlow";

describe("templatesWorkspaceFlow", () => {
  test("tabs cover use vs edit surfaces", () => {
    assert.deepEqual(
      TEMPLATES_WORKSPACE_TABS.map((t) => t.id),
      ["overview", "packages", "estimate", "content"]
    );
    assert.match(TEMPLATES_WORKSPACE_TRUST_NOTE, /Catalog controls item pricing/i);
    assert.match(TEMPLATES_WORKSPACE_TRUST_NOTE, /frozen prices/i);
  });

  test("defaultExpandedPackageOptionId prefers needs_attention", () => {
    assert.equal(
      defaultExpandedPackageOptionId([
        {
          optionId: "a",
          optionLabel: "A",
          sectionCount: 1,
          catalogSectionCount: 1,
          linkedItemCount: 2,
          issueCount: 0,
          status: "ready",
        },
        {
          optionId: "b",
          optionLabel: "B",
          sectionCount: 1,
          catalogSectionCount: 1,
          linkedItemCount: 1,
          issueCount: 1,
          status: "needs_attention",
        },
      ]),
      "b"
    );
  });

  test("summarizePackageOptionsForWorkspace counts links and issues", () => {
    const graph = {
      template: { id: "t1", name: "Starter" },
      options: [],
      sections: [],
      items: [
        {
          id: "i1",
          section_id: "s1",
          option_id: "o1",
          catalog_item_id: "c1",
          sort_order: 10,
        },
        {
          id: "i2",
          section_id: "s1",
          option_id: "o1",
          catalog_item_id: null,
          sort_order: 20,
        },
      ],
    } as never;

    const structureViewModel = {
      templateName: "Starter",
      optionGroups: [
        {
          optionId: "o1",
          optionLabel: "Standard",
          sections: [
            {
              sectionId: "s1",
              optionId: "o1",
              kind: "line_items",
              name: "Line items",
              displayTitle: "Line items",
              itemCount: 2,
              sortOrder: 10,
              isReorderable: true,
              isRemovable: false,
              protectionReason: null,
            },
          ],
          addableKinds: [],
        },
      ],
    } as never;

    const catalogItems = [
      {
        id: "c1",
        name: "Shingles",
        active: true,
        company_id: "co",
      },
    ] as never;

    const rows = summarizePackageOptionsForWorkspace(
      graph,
      structureViewModel,
      catalogItems
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].linkedItemCount, 1);
    assert.equal(rows[0].issueCount, 1);
    assert.equal(rows[0].status, "needs_attention");
  });
});
