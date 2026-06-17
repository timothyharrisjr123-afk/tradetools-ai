/**
 * R10a — Pure tests for proposalTemplateStructureMutations.ts
 *
 * Run: npx tsx --test app/lib/proposalTemplateStructureMutations.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  planAddSection,
  planRemoveSection,
  planReorderSections,
} from "./proposalTemplateStructureMutations";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type {
  ProposalTemplate,
  ProposalTemplateItem,
  ProposalTemplateOption,
  ProposalTemplateSection,
} from "./proposalTemplateTypes";

function makeGraph(
  sections: ProposalTemplateSection[],
  items: ProposalTemplateItem[] = []
): ProposalTemplateGraph {
  return {
    template: {
      id: "tpl-1",
      company_id: "co-1",
      name: "Template",
      status: "active",
      active: true,
    } as ProposalTemplate,
    options: [
      {
        id: "opt-a",
        template_id: "tpl-1",
        name: "Standard",
        sort_order: 10,
      } as ProposalTemplateOption,
      {
        id: "opt-b",
        template_id: "tpl-1",
        name: "Enhanced",
        sort_order: 20,
      } as ProposalTemplateOption,
    ],
    sections,
    items,
  };
}

describe("planReorderSections", () => {
  test("produces normalized sort_order", () => {
    const graph = makeGraph([
      {
        id: "s1",
        template_id: "tpl-1",
        option_id: "opt-a",
        kind: "line_items",
        name: "A",
        sort_order: 99,
      },
      {
        id: "s2",
        template_id: "tpl-1",
        option_id: "opt-a",
        kind: "terms",
        name: "B",
        sort_order: 1,
      },
    ]);

    const result = planReorderSections({
      graph,
      optionId: "opt-a",
      orderedSectionIds: ["s2", "s1"],
    });

    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;

    assert.deepEqual(result.patches, [
      { sectionId: "s2", sort_order: 10 },
      { sectionId: "s1", sort_order: 20 },
    ]);
  });

  test("refuses cross-option movement", () => {
    const graph = makeGraph([
      {
        id: "s-a",
        template_id: "tpl-1",
        option_id: "opt-a",
        kind: "line_items",
        name: "A",
      },
      {
        id: "s-b",
        template_id: "tpl-1",
        option_id: "opt-b",
        kind: "line_items",
        name: "B",
      },
    ]);

    const result = planReorderSections({
      graph,
      optionId: "opt-a",
      orderedSectionIds: ["s-b"],
    });

    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.match(result.reason, /across package options/i);
    }
  });
});

describe("planAddSection", () => {
  test("creates safe defaults for allowed kinds", () => {
    const graph = makeGraph([
      {
        id: "s1",
        template_id: "tpl-1",
        option_id: "opt-a",
        kind: "line_items",
        name: "Estimate",
        sort_order: 20,
      },
    ]);

    const result = planAddSection({
      graph,
      optionId: "opt-a",
      kind: "text",
      name: "  Extra notes  ",
    });

    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;

    assert.equal(result.draft.kind, "text");
    assert.equal(result.draft.name, "Extra notes");
    assert.equal(result.draft.customer_title, "Extra notes");
    assert.equal(result.sort_order, 30);
    assert.equal(result.draft.content?.title, "Extra notes");
  });

  test("rejects unsupported kinds", () => {
    const graph = makeGraph([
      {
        id: "s1",
        template_id: "tpl-1",
        option_id: "opt-a",
        kind: "line_items",
        name: "Estimate",
      },
    ]);

    const duplicateLineItems = planAddSection({
      graph,
      optionId: "opt-a",
      kind: "line_items",
    });
    assert.equal(duplicateLineItems.status, "blocked");

    const signature = planAddSection({
      graph,
      optionId: "opt-a",
      kind: "signature_placeholder",
    });
    assert.equal(signature.status, "blocked");
  });
});

describe("planRemoveSection", () => {
  test("blocks protected sections", () => {
    const graph = makeGraph([
      {
        id: "s-li",
        template_id: "tpl-1",
        option_id: "opt-a",
        kind: "line_items",
        name: "Estimate",
      },
    ]);

    const result = planRemoveSection({ graph, sectionId: "s-li" });
    assert.equal(result.status, "blocked");
    assert.match(result.reason, /cannot be removed/i);
    assert.equal(result.storeDeleteAvailable, false);
  });

  test("reports item-count / FK safety for removable sections", () => {
    const graph = makeGraph(
      [
        {
          id: "s-text",
          template_id: "tpl-1",
          option_id: "opt-a",
          kind: "text",
          name: "Notes",
        },
      ],
      [
        {
          id: "item-1",
          template_id: "tpl-1",
          option_id: "opt-a",
          section_id: "s-text",
          item_role: "standard",
        },
      ]
    );

    const result = planRemoveSection({ graph, sectionId: "s-text" });
    assert.equal(result.status, "blocked");
    assert.equal(result.itemCount, 1);
    assert.equal(result.itemsWouldCascade, true);
    assert.equal(result.storeDeleteAvailable, false);
    assert.match(result.reason, /not wired in the store/i);
  });

  test("does not mutate input arrays", () => {
    const sections = [
      {
        id: "s-text",
        template_id: "tpl-1",
        option_id: "opt-a",
        kind: "text" as const,
        name: "Notes",
      },
    ];
    const graph = makeGraph(sections);
    const before = JSON.stringify(graph);
    planRemoveSection({ graph, sectionId: "s-text" });
    assert.equal(JSON.stringify(graph), before);
  });
});
