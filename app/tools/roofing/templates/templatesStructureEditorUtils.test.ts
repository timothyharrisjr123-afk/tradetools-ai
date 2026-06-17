/**
 * R10b — Pure tests for templatesStructureEditorUtils.ts.
 *
 * Run: npx tsx --test app/tools/roofing/templates/templatesStructureEditorUtils.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type {
  ProposalTemplate,
  ProposalTemplateOption,
  ProposalTemplateSection,
} from "@/app/lib/proposalTemplateTypes";
import {
  buildWorkspaceStructureViewModel,
  canMoveSectionInOption,
  computeReorderedSectionIds,
  describeRemoveSectionState,
  getOrderedSectionIdsForOption,
} from "./templatesStructureEditorUtils";

function makeTemplate(overrides: Partial<ProposalTemplate> = {}): ProposalTemplate {
  return {
    id: "tpl-1",
    company_id: "co-1",
    name: "Starter",
    description: null,
    status: "active",
    active: true,
    sort_order: 10,
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
    updated_by: null,
    ...overrides,
  };
}

function makeOption(id: string, name: string, sortOrder: number): ProposalTemplateOption {
  return {
    id,
    template_id: "tpl-1",
    name,
    customer_label: name,
    sort_order: sortOrder,
    selection_mode: "single",
    metadata: {},
  };
}

function makeSection(
  id: string,
  optionId: string,
  kind: ProposalTemplateSection["kind"],
  sortOrder: number
): ProposalTemplateSection {
  return {
    id,
    template_id: "tpl-1",
    option_id: optionId,
    kind,
    name: kind,
    customer_title: kind,
    customer_visibility: "customer_visible",
    sort_order: sortOrder,
    content: {},
    metadata: {},
  };
}

function makeGraph(): ProposalTemplateGraph {
  const optA = makeOption("opt-a", "Standard", 10);
  const optB = makeOption("opt-b", "Enhanced", 20);
  return {
    template: makeTemplate(),
    options: [optA, optB],
    sections: [
      makeSection("s-1", "opt-a", "line_items", 10),
      makeSection("s-2", "opt-a", "text", 20),
      makeSection("s-3", "opt-a", "terms", 30),
      makeSection("s-4", "opt-b", "line_items", 10),
    ],
    items: [],
  };
}

describe("buildWorkspaceStructureViewModel", () => {
  test("returns null for null graph", () => {
    assert.equal(buildWorkspaceStructureViewModel(null), null);
  });

  test("builds option groups from graph", () => {
    const viewModel = buildWorkspaceStructureViewModel(makeGraph());
    assert.ok(viewModel);
    assert.equal(viewModel.optionGroups.length, 2);
    assert.equal(getOrderedSectionIdsForOption(viewModel!, "opt-a").join(","), "s-1,s-2,s-3");
  });
});

describe("computeReorderedSectionIds", () => {
  const ordered = ["s-1", "s-2", "s-3"];

  test("moves section down", () => {
    assert.deepEqual(computeReorderedSectionIds(ordered, "s-2", "down"), ["s-1", "s-3", "s-2"]);
  });

  test("moves section up", () => {
    assert.deepEqual(computeReorderedSectionIds(ordered, "s-2", "up"), ["s-2", "s-1", "s-3"]);
  });

  test("returns null at boundaries", () => {
    assert.equal(computeReorderedSectionIds(ordered, "s-1", "up"), null);
    assert.equal(computeReorderedSectionIds(ordered, "s-3", "down"), null);
  });

  test("does not mutate input array", () => {
    const snapshot = [...ordered];
    computeReorderedSectionIds(ordered, "s-2", "down");
    assert.deepEqual(ordered, snapshot);
  });
});

describe("canMoveSectionInOption", () => {
  test("reflects boundary rules", () => {
    const ordered = ["a", "b", "c"];
    assert.equal(canMoveSectionInOption(ordered, "a", "up"), false);
    assert.equal(canMoveSectionInOption(ordered, "a", "down"), true);
    assert.equal(canMoveSectionInOption(ordered, "c", "down"), false);
  });
});

describe("describeRemoveSectionState", () => {
  test("blocks protected line_items", () => {
    const graph = makeGraph();
    const result = describeRemoveSectionState(graph, "s-1");
    assert.equal(result.status, "blocked");
    assert.equal(result.storeDeleteAvailable, false);
    assert.match(result.reason, /line-items/i);
  });

  test("blocks removable-looking sections until store delete exists", () => {
    const graph = makeGraph();
    const result = describeRemoveSectionState(graph, "s-2");
    assert.equal(result.status, "blocked");
    assert.match(result.reason, /not wired/i);
  });
});
