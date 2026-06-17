/**
 * R4 — Pure tests for proposalTemplateContentEditorView.ts.
 *
 * Run: npx tsx --test app/lib/proposalTemplateContentEditorView.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildTemplateContentEditorViewModel } from "./proposalTemplateContentEditorView";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type {
  ProposalTemplate,
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
  templateOverrides: Partial<ProposalTemplate> = {}
): ProposalTemplateGraph {
  return {
    template: makeTemplate(templateOverrides),
    options,
    sections,
    items: [],
  };
}

/** Seed-like fixture: 3 options × 4 editable sections (text, text, warranty, terms). */
function makeSeedLikeGraph(): ProposalTemplateGraph {
  const options = [
    makeOption("opt-standard", {
      name: "Standard",
      customer_label: "Standard Package",
      sort_order: 10,
    }),
    makeOption("opt-enhanced", {
      name: "Enhanced",
      customer_label: "Enhanced Package",
      sort_order: 20,
    }),
    makeOption("opt-premium", {
      name: "Premium",
      customer_label: "Premium Package",
      sort_order: 30,
    }),
  ];

  const editableKinds: ProposalTemplateSection["kind"][] = [
    "text",
    "text",
    "warranty",
    "terms",
  ];

  const sections: ProposalTemplateSection[] = [];
  for (const option of options) {
    editableKinds.forEach((kind, index) => {
      sections.push(
        makeSection(`sec-${option.id}-${kind}-${index}`, option.id, kind, {
          name: `${option.name} ${kind} ${index}`,
          sort_order: (index + 1) * 10,
          customer_title: `${option.name} customer ${kind}`,
          content: {
            title: `${option.name} content ${kind}`,
            body_markdown: `Body for ${option.id} ${kind}`,
          },
        })
      );
    });
  }

  sections.push(
    makeSection("sec-line-items", "opt-standard", "line_items", { sort_order: 99 }),
    makeSection("sec-image", "opt-standard", "image", { sort_order: 100 }),
    makeSection("sec-signature", "opt-enhanced", "signature_placeholder", { sort_order: 101 }),
    makeSection("sec-upgrade", "opt-premium", "upgrade_group", { sort_order: 102 }),
    makeSection("sec-unknown", "opt-premium", "custom_unknown" as ProposalTemplateSection["kind"], {
      sort_order: 103,
    })
  );

  return makeGraph(options, sections);
}

describe("buildTemplateContentEditorViewModel", () => {
  test("builds a view model from a template graph", () => {
    const graph = makeSeedLikeGraph();
    const view = buildTemplateContentEditorViewModel(graph);

    assert.equal(view.templateId, "tpl-1");
    assert.equal(view.templateName, "Roofing default");
    assert.equal(view.templateStatus, "active");
    assert.equal(view.optionGroups.length, 3);
    assert.equal(view.totalEditableSectionCount, 12);
  });

  test("filters out non-editable kinds", () => {
    const graph = makeSeedLikeGraph();
    const view = buildTemplateContentEditorViewModel(graph);
    const sectionIds = view.optionGroups.flatMap((group) =>
      group.sections.map((section) => section.sectionId)
    );

    assert.ok(!sectionIds.includes("sec-line-items"));
    assert.ok(!sectionIds.includes("sec-image"));
    assert.ok(!sectionIds.includes("sec-signature"));
    assert.ok(!sectionIds.includes("sec-upgrade"));
    assert.ok(!sectionIds.includes("sec-unknown"));
  });

  test("includes only text, terms, and warranty", () => {
    const graph = makeSeedLikeGraph();
    const view = buildTemplateContentEditorViewModel(graph);
    const kinds = new Set(
      view.optionGroups.flatMap((group) => group.sections.map((section) => section.kind))
    );

    assert.deepEqual([...kinds].sort(), ["terms", "text", "warranty"]);
  });

  test("groups editable sections by option/package", () => {
    const graph = makeSeedLikeGraph();
    const view = buildTemplateContentEditorViewModel(graph);

    for (const group of view.optionGroups) {
      assert.ok(
        group.sections.every((section) => section.optionId === group.optionId),
        `group ${group.optionId} should only contain its option sections`
      );
    }
  });

  test("seed-like case: 3 options × 4 editable sections = 3 groups with 4 sections each", () => {
    const view = buildTemplateContentEditorViewModel(makeSeedLikeGraph());

    assert.equal(view.optionGroups.length, 3);
    for (const group of view.optionGroups) {
      assert.equal(group.sections.length, 4);
    }
  });

  test("sorts option groups by option sort_order", () => {
    const graph = makeGraph(
      [
        makeOption("opt-c", { name: "C", sort_order: 30 }),
        makeOption("opt-a", { name: "A", sort_order: 10 }),
        makeOption("opt-b", { name: "B", sort_order: 20 }),
      ],
      [
        makeSection("s1", "opt-c", "text", { sort_order: 1 }),
        makeSection("s2", "opt-a", "terms", { sort_order: 1 }),
        makeSection("s3", "opt-b", "warranty", { sort_order: 1 }),
      ]
    );

    const view = buildTemplateContentEditorViewModel(graph);
    assert.deepEqual(
      view.optionGroups.map((group) => group.optionId),
      ["opt-a", "opt-b", "opt-c"]
    );
  });

  test("sorts sections by section sort_order", () => {
    const graph = makeGraph(
      [makeOption("opt-1", { sort_order: 1 })],
      [
        makeSection("late", "opt-1", "text", { sort_order: 30 }),
        makeSection("early", "opt-1", "terms", { sort_order: 10 }),
        makeSection("mid", "opt-1", "warranty", { sort_order: 20 }),
      ]
    );

    const sections = buildTemplateContentEditorViewModel(graph).optionGroups[0].sections;
    assert.deepEqual(
      sections.map((section) => section.sectionId),
      ["early", "mid", "late"]
    );
  });

  test("preserves section IDs", () => {
    const graph = makeGraph(
      [makeOption("opt-1")],
      [makeSection("preserve-me", "opt-1", "text")]
    );
    const section = buildTemplateContentEditorViewModel(graph).optionGroups[0].sections[0];
    assert.equal(section.sectionId, "preserve-me");
  });

  test("preserves option IDs", () => {
    const view = buildTemplateContentEditorViewModel(makeSeedLikeGraph());
    assert.deepEqual(
      view.optionGroups.map((group) => group.optionId),
      ["opt-standard", "opt-enhanced", "opt-premium"]
    );
  });

  test("option label fallback: customer_label → name → Option", () => {
    const graph = makeGraph(
      [
        makeOption("opt-customer", { customer_label: "Customer label", name: "Internal" }),
        makeOption("opt-name-only", { customer_label: null, name: "Internal only" }),
        makeOption("opt-fallback", { customer_label: "  ", name: "  " }),
      ],
      [
        makeSection("s1", "opt-customer", "text"),
        makeSection("s2", "opt-name-only", "text"),
        makeSection("s3", "opt-fallback", "text"),
      ]
    );

    const labels = buildTemplateContentEditorViewModel(graph).optionGroups.map(
      (group) => group.optionLabel
    );
    assert.deepEqual(labels, ["Customer label", "Internal only", "Option"]);
  });

  test("section title fallback: customer_title → content.title → name → Template section", () => {
    const graph = makeGraph(
      [makeOption("opt-1")],
      [
        makeSection("s-customer", "opt-1", "text", {
          customer_title: "Customer title",
          name: "Internal",
          content: { title: "Content title" },
        }),
        makeSection("s-content", "opt-1", "terms", {
          customer_title: null,
          name: "Internal",
          content: { title: "Content title" },
        }),
        makeSection("s-name", "opt-1", "warranty", {
          customer_title: null,
          name: "Internal name",
          content: { title: null },
        }),
        makeSection("s-default", "opt-1", "text", {
          customer_title: null,
          name: "  ",
          content: { title: "  " },
        }),
      ]
    );

    const titles = buildTemplateContentEditorViewModel(graph).optionGroups[0].sections.map(
      (section) => section.displayTitle
    );
    assert.deepEqual(titles, [
      "Customer title",
      "Content title",
      "Internal name",
      "Template section",
    ]);
  });

  test("reads body_markdown and falls back to empty string", () => {
    const graph = makeGraph(
      [makeOption("opt-1")],
      [
        makeSection("with-body", "opt-1", "text", {
          content: { body_markdown: "Hello world" },
        }),
        makeSection("no-body", "opt-1", "terms", { content: {} }),
        makeSection("null-content", "opt-1", "warranty", { content: null }),
      ]
    );

    const bodies = buildTemplateContentEditorViewModel(graph).optionGroups[0].sections.map(
      (section) => section.bodyMarkdown
    );
    assert.deepEqual(bodies, ["Hello world", "", ""]);
  });

  test("handles empty options/sections safely", () => {
    const view = buildTemplateContentEditorViewModel(makeGraph([], []));

    assert.equal(view.optionGroups.length, 0);
    assert.equal(view.totalEditableSectionCount, 0);
    assert.equal(view.templateId, "tpl-1");
  });

  test("handles missing option references with fallback group", () => {
    const graph = makeGraph(
      [makeOption("opt-known")],
      [
        makeSection("orphan", "opt-missing", "text", { name: "Orphan section" }),
        makeSection("no-option-id", "", "terms", { name: "Blank option id" }),
      ]
    );

    const view = buildTemplateContentEditorViewModel(graph);
    assert.equal(view.optionGroups.length, 2);

    const missingGroup = view.optionGroups.find((group) => group.optionId === "opt-missing");
    assert.ok(missingGroup);
    assert.equal(missingGroup.optionLabel, "Unassigned option");
    assert.equal(missingGroup.sections.length, 1);

    const unassignedGroup = view.optionGroups.find((group) => group.optionId === "unassigned");
    assert.ok(unassignedGroup);
    assert.equal(unassignedGroup.optionLabel, "Unassigned option");
    assert.equal(unassignedGroup.sections.length, 1);
  });

  test("does not mutate the input graph", () => {
    const graph = makeSeedLikeGraph();
    const snapshot = JSON.parse(JSON.stringify(graph)) as ProposalTemplateGraph;

    buildTemplateContentEditorViewModel(graph);

    assert.deepEqual(graph, snapshot);
  });

  test("confirms there is no bulk/shared-field structure across options", () => {
    const view = buildTemplateContentEditorViewModel(makeSeedLikeGraph());
    const termsSections = view.optionGroups.map(
      (group) => group.sections.find((section) => section.kind === "terms")!
    );

    assert.equal(termsSections.length, 3);
    const bodies = new Set(termsSections.map((section) => section.bodyMarkdown));
    assert.equal(bodies.size, 3);

    const ids = new Set(termsSections.map((section) => section.sectionId));
    assert.equal(ids.size, 3);

    for (const group of view.optionGroups) {
      assert.ok(
        group.sections.every((section) => section.optionId === group.optionId),
        "each section remains scoped to its option group"
      );
    }

    assert.ok(!("sharedSections" in view));
    assert.ok(!("bulkFields" in view));
  });
});
