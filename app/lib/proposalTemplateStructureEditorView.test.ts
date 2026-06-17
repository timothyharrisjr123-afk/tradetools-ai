/**
 * R10a — Pure tests for proposalTemplateStructureEditorView.ts
 *
 * Run: npx tsx --test app/lib/proposalTemplateStructureEditorView.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildTemplateStructureEditorViewModel } from "./proposalTemplateStructureEditorView";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type {
  ProposalTemplate,
  ProposalTemplateItem,
  ProposalTemplateOption,
  ProposalTemplateSection,
} from "./proposalTemplateTypes";

function makeTemplate(overrides: Partial<ProposalTemplate> = {}): ProposalTemplate {
  return {
    id: "tpl-1",
    company_id: "co-1",
    name: "Roofing default",
    status: "active",
    active: true,
    ...overrides,
  };
}

function makeOption(
  id: string,
  overrides: Partial<ProposalTemplateOption> = {}
): ProposalTemplateOption {
  return {
    id,
    template_id: "tpl-1",
    name: `Option ${id}`,
    sort_order: 0,
    ...overrides,
  };
}

function makeSection(
  id: string,
  optionId: string,
  kind: ProposalTemplateSection["kind"],
  overrides: Partial<ProposalTemplateSection> = {}
): ProposalTemplateSection {
  return {
    id,
    template_id: "tpl-1",
    option_id: optionId,
    kind,
    name: `Section ${id}`,
    sort_order: 0,
    ...overrides,
  };
}

function makeGraph(
  options: ProposalTemplateOption[],
  sections: ProposalTemplateSection[],
  items: ProposalTemplateItem[] = []
): ProposalTemplateGraph {
  return {
    template: makeTemplate(),
    options,
    sections,
    items,
  };
}

describe("buildTemplateStructureEditorViewModel", () => {
  test("groups sections by option", () => {
    const graph = makeGraph(
      [makeOption("opt-a", { sort_order: 10 }), makeOption("opt-b", { sort_order: 20 })],
      [
        makeSection("s1", "opt-a", "line_items", { sort_order: 10 }),
        makeSection("s2", "opt-a", "terms", { sort_order: 20 }),
        makeSection("s3", "opt-b", "line_items", { sort_order: 10 }),
      ]
    );

    const vm = buildTemplateStructureEditorViewModel(graph);
    assert.equal(vm.optionGroups.length, 2);
    assert.equal(vm.optionGroups[0]?.optionId, "opt-a");
    assert.equal(vm.optionGroups[0]?.sections.length, 2);
    assert.equal(vm.optionGroups[1]?.optionId, "opt-b");
    assert.equal(vm.optionGroups[1]?.sections.length, 1);
  });

  test("sorts by sort_order with stable fallback", () => {
    const graph = makeGraph(
      [makeOption("opt-a")],
      [
        makeSection("s-low", "opt-a", "terms", { sort_order: 30 }),
        makeSection("s-high", "opt-a", "line_items", { sort_order: 10 }),
        makeSection("s-mid", "opt-a", "warranty", { sort_order: 20 }),
      ]
    );

    const vm = buildTemplateStructureEditorViewModel(graph);
    const ids = vm.optionGroups[0]?.sections.map((section) => section.sectionId);
    assert.deepEqual(ids, ["s-high", "s-mid", "s-low"]);
  });

  test("preserves all section kinds", () => {
    const kinds: ProposalTemplateSection["kind"][] = [
      "line_items",
      "upgrade_group",
      "image",
      "text",
      "terms",
      "warranty",
    ];

    const sections = kinds.map((kind, index) =>
      makeSection(`s-${kind}`, "opt-a", kind, { sort_order: (index + 1) * 10 })
    );

    const graph = makeGraph([makeOption("opt-a")], sections);
    const vm = buildTemplateStructureEditorViewModel(graph);
    const resultKinds = vm.optionGroups[0]?.sections.map((section) => section.kind);
    assert.deepEqual(resultKinds, kinds);
  });

  test("marks protected sections as non-removable", () => {
    const graph = makeGraph(
      [makeOption("opt-a")],
      [
        makeSection("s-li", "opt-a", "line_items"),
        makeSection("s-up", "opt-a", "upgrade_group"),
        makeSection("s-text", "opt-a", "text"),
      ]
    );

    const vm = buildTemplateStructureEditorViewModel(graph);
    const byId = new Map(
      vm.optionGroups[0]?.sections.map((section) => [section.sectionId, section])
    );

    assert.equal(byId.get("s-li")?.isRemovable, false);
    assert.match(byId.get("s-li")?.protectionReason ?? "", /line-items/i);
    assert.equal(byId.get("s-up")?.isRemovable, false);
    assert.equal(byId.get("s-text")?.isRemovable, true);
    assert.equal(byId.get("s-text")?.protectionReason, null);
  });

  test("handles missing option fallback safely", () => {
    const graph = makeGraph(
      [],
      [makeSection("orphan", "missing-opt", "text", { name: "Orphan section" })]
    );

    const vm = buildTemplateStructureEditorViewModel(graph);
    assert.equal(vm.optionGroups.length, 1);
    assert.equal(vm.optionGroups[0]?.optionId, "missing-opt");
    assert.equal(vm.optionGroups[0]?.optionLabel, "Unassigned option");
    assert.equal(vm.optionGroups[0]?.sections[0]?.displayTitle, "Orphan section");
  });

  test("does not mutate input graph", () => {
    const graph = makeGraph(
      [makeOption("opt-a")],
      [makeSection("s1", "opt-a", "line_items", { sort_order: 10 })]
    );
    const snapshot = JSON.stringify(graph);
    buildTemplateStructureEditorViewModel(graph);
    assert.equal(JSON.stringify(graph), snapshot);
  });

  test("counts items per section", () => {
    const graph = makeGraph(
      [makeOption("opt-a")],
      [
        makeSection("s-li", "opt-a", "line_items"),
        makeSection("s-text", "opt-a", "text"),
      ],
      [
        {
          id: "item-1",
          template_id: "tpl-1",
          option_id: "opt-a",
          section_id: "s-li",
          item_role: "standard",
        },
        {
          id: "item-2",
          template_id: "tpl-1",
          option_id: "opt-a",
          section_id: "s-li",
          item_role: "upgrade",
        },
      ]
    );

    const vm = buildTemplateStructureEditorViewModel(graph);
    const lineItems = vm.optionGroups[0]?.sections.find((s) => s.sectionId === "s-li");
    const text = vm.optionGroups[0]?.sections.find((s) => s.sectionId === "s-text");
    assert.equal(lineItems?.itemCount, 2);
    assert.equal(text?.itemCount, 0);
  });
});
