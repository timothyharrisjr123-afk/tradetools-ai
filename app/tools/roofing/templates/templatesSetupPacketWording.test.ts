/**
 * R3A — setup-owned packet wording editor.
 * Run: npx tsx --test app/tools/roofing/templates/templatesSetupPacketWording.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { mapTemplateSectionsToProposalPages } from "@/app/lib/proposalSnapshotBuilder";
import { isCustomerFacingTextPageType } from "@/app/lib/proposalCustomerPacketDetailContent";
import type { ProposalTemplateSection } from "@/app/lib/proposalTemplateTypes";
import {
  buildPacketWordingEditorViewModel,
  buildPacketWordingSavePlan,
  PACKET_WORDING_SLOT_LABELS,
  packetWordingUiHasForbiddenTerms,
  resolvePacketWordingSlotId,
  TEMPLATES_PACKET_CANCEL_ACTION,
  TEMPLATES_PACKET_EDIT_ACTION,
  TEMPLATES_PACKET_EDITOR_HINT,
  TEMPLATES_PACKET_SAVE_ACTION,
} from "./templatesSetupPacketWording";

const OPT_STD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OPT_ENH = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OPT_PREM = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function section(input: {
  id: string;
  optionId: string;
  kind: ProposalTemplateSection["kind"];
  name: string;
  customerTitle?: string;
  body: string;
  sortOrder?: number;
}): ProposalTemplateSection {
  return {
    id: input.id,
    template_id: "template-1",
    option_id: input.optionId,
    kind: input.kind,
    name: input.name,
    customer_title: input.customerTitle ?? input.name,
    customer_visibility: "customer_visible",
    sort_order: input.sortOrder ?? 10,
    content: { title: input.customerTitle ?? input.name, body_markdown: input.body },
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function multiOptionGraph() {
  const slots: Array<{
    kind: ProposalTemplateSection["kind"];
    name: string;
    customerTitle: string;
    body: string;
    sort: number;
    key: string;
  }> = [
    {
      kind: "text",
      name: "Overview",
      customerTitle: "Overview",
      body: "Standard overview wording.",
      sort: 10,
      key: "overview",
    },
    {
      kind: "text",
      name: "Project notes",
      customerTitle: "Project notes",
      body: "Standard notes wording.",
      sort: 40,
      key: "notes",
    },
    {
      kind: "warranty",
      name: "Warranty and protection",
      customerTitle: "Warranty and protection",
      body: "Standard warranty wording.",
      sort: 50,
      key: "warranty",
    },
    {
      kind: "terms",
      name: "Next steps",
      customerTitle: "Next steps",
      body: "Standard terms wording.",
      sort: 60,
      key: "terms",
    },
  ];

  const options = [
    {
      id: OPT_STD,
      template_id: "template-1",
      name: "Standard",
      customer_label: "Standard",
      description: null,
      is_default: true,
      sort_order: 10,
      metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      removed_at: null,
    },
    {
      id: OPT_ENH,
      template_id: "template-1",
      name: "Enhanced",
      customer_label: "Enhanced",
      description: null,
      is_default: false,
      sort_order: 20,
      metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      removed_at: null,
    },
    {
      id: OPT_PREM,
      template_id: "template-1",
      name: "Premium",
      customer_label: "Premium",
      description: null,
      is_default: false,
      sort_order: 30,
      metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      removed_at: null,
    },
  ];

  const sections: ProposalTemplateSection[] = [];
  for (const option of options) {
    for (const slot of slots) {
      sections.push(
        section({
          id: `${option.id.slice(0, 8)}-${slot.key}`,
          optionId: option.id,
          kind: slot.kind,
          name: slot.name,
          customerTitle: slot.customerTitle,
          body: `${option.name} ${slot.body}`,
          sortOrder: slot.sort,
        })
      );
    }
    sections.push(
      section({
        id: `${option.id.slice(0, 8)}-estimate`,
        optionId: option.id,
        kind: "line_items",
        name: "Estimate",
        body: "",
        sortOrder: 20,
      })
    );
  }

  return { options, sections, items: [] as never[] };
}

describe("resolvePacketWordingSlotId", () => {
  test("maps overview / notes / warranty / terms", () => {
    assert.equal(
      resolvePacketWordingSlotId(
        section({
          id: "1",
          optionId: OPT_STD,
          kind: "text",
          name: "Overview",
          body: "x",
        })
      ),
      "overview"
    );
    assert.equal(
      resolvePacketWordingSlotId(
        section({
          id: "2",
          optionId: OPT_STD,
          kind: "text",
          name: "Scope notes",
          customerTitle: "Project notes",
          body: "x",
        })
      ),
      "project_notes"
    );
    assert.equal(
      resolvePacketWordingSlotId(
        section({
          id: "3",
          optionId: OPT_STD,
          kind: "warranty",
          name: "Warranty and protection",
          body: "x",
        })
      ),
      "warranty"
    );
    assert.equal(
      resolvePacketWordingSlotId(
        section({
          id: "4",
          optionId: OPT_STD,
          kind: "terms",
          name: "Next steps",
          body: "x",
        })
      ),
      "terms"
    );
    assert.equal(
      resolvePacketWordingSlotId(
        section({
          id: "5",
          optionId: OPT_STD,
          kind: "line_items",
          name: "Estimate",
          body: "",
        })
      ),
      null
    );
  });
});

describe("buildPacketWordingEditorViewModel", () => {
  test("loads spine wording for the four customer slots", () => {
    const graph = multiOptionGraph();
    const view = buildPacketWordingEditorViewModel(graph);
    assert.equal(view.spineOptionId, OPT_STD);
    assert.deepEqual(
      view.slots.map((slot) => slot.slotId),
      ["overview", "project_notes", "warranty", "terms"]
    );
    assert.equal(view.slots[0]!.label, PACKET_WORDING_SLOT_LABELS.overview);
    assert.match(view.slots[0]!.body, /^Standard /);
    assert.equal(view.slots[0]!.spineSectionId.startsWith("aaaaaaaa"), true);
    assert.equal(view.slots[0]!.mirrorSectionIds.length, 3);
  });

  test("display bodies come from spine (default) option only", () => {
    const graph = multiOptionGraph();
    const view = buildPacketWordingEditorViewModel(graph);
    for (const slot of view.slots) {
      assert.match(slot.body, /^Standard /);
      assert.doesNotMatch(slot.body, /^Enhanced |^Premium /);
    }
  });
});

describe("buildPacketWordingSavePlan", () => {
  test("mirrors dirty slot updates across sibling package options", () => {
    const graph = multiOptionGraph();
    const plan = buildPacketWordingSavePlan(graph, {
      overview: "Updated overview for all packages.",
    });
    assert.equal(plan.isNoop, false);
    assert.equal(plan.items.length, 3);
    assert.ok(plan.items.every((item) => item.slotId === "overview"));
    assert.ok(
      plan.items.every(
        (item) => item.content.body_markdown === "Updated overview for all packages."
      )
    );
    const optionIds = new Set(plan.items.map((item) => item.optionId));
    assert.deepEqual([...optionIds].sort(), [OPT_STD, OPT_ENH, OPT_PREM].sort());
  });

  test("cancel-equivalent noop when drafts match spine", () => {
    const graph = multiOptionGraph();
    const view = buildPacketWordingEditorViewModel(graph);
    const drafts = Object.fromEntries(view.slots.map((slot) => [slot.slotId, slot.body]));
    const plan = buildPacketWordingSavePlan(graph, drafts);
    assert.equal(plan.isNoop, true);
    assert.equal(plan.items.length, 0);
  });

  test("save plan never targets proposal_pages or estimate lines", () => {
    const graph = multiOptionGraph();
    const plan = buildPacketWordingSavePlan(graph, {
      warranty: "New warranty wording.",
      terms: "New next-steps wording.",
    });
    assert.ok(plan.items.length >= 2);
    for (const item of plan.items) {
      assert.ok(item.sectionId);
      assert.ok(item.optionId);
      assert.ok(item.content.body_markdown);
      assert.ok(["warranty", "terms"].includes(item.slotId));
      assert.doesNotMatch(item.sectionId, /estimate/);
    }
  });
});

describe("create-copy uses spine packet wording", () => {
  test("new draft pages copy updated spine overview body, not sibling Enhanced body", () => {
    const graph = multiOptionGraph();
    const stdOverview = graph.sections.find(
      (row) => row.option_id === OPT_STD && resolvePacketWordingSlotId(row) === "overview"
    )!;
    stdOverview.content = {
      ...stdOverview.content,
      body_markdown: "Contractor-edited overview for new proposals.",
    };

    const pages = mapTemplateSectionsToProposalPages({
      company_id: "company-1",
      proposal_version_id: null,
      sections: graph.sections,
      spineOptionId: OPT_STD,
      template: null,
    });

    const overviewPage = pages.find((page) => page.page_type === "project_overview");
    assert.ok(overviewPage);
    assert.equal(
      (overviewPage!.content_json as { body_markdown?: string }).body_markdown,
      "Contractor-edited overview for new proposals."
    );

    const enhancedBody = graph.sections.find(
      (row) => row.option_id === OPT_ENH && resolvePacketWordingSlotId(row) === "overview"
    )!.content?.body_markdown;
    assert.match(String(enhancedBody), /^Enhanced /);
    assert.notEqual(
      (overviewPage!.content_json as { body_markdown?: string }).body_markdown,
      enhancedBody
    );
  });

  test("new draft pages copy updated Project notes into a custom_text page that Public/Preview will render", () => {
    const graph = multiOptionGraph();
    const stdNotes = graph.sections.find(
      (row) => row.option_id === OPT_STD && resolvePacketWordingSlotId(row) === "project_notes"
    )!;
    stdNotes.content = {
      ...stdNotes.content,
      body_markdown: "Debris removal is scheduled within 48 hours of completion.",
    };

    const pages = mapTemplateSectionsToProposalPages({
      company_id: "company-1",
      proposal_version_id: null,
      sections: graph.sections,
      spineOptionId: OPT_STD,
      template: null,
    });

    const notesPage = pages.find((page) => page.page_type === "custom_text");
    assert.ok(notesPage, "Project notes copies into a custom_text proposal page");
    assert.equal(notesPage!.customer_title, "Project notes");
    assert.equal(
      (notesPage!.content_json as { body_markdown?: string }).body_markdown,
      "Debris removal is scheduled within 48 hours of completion."
    );
    // R3A public-loop fix: this is exactly the page the public presenter now allows through.
    assert.equal(
      isCustomerFacingTextPageType(notesPage!.page_type, notesPage!.customer_title, notesPage!.title),
      true
    );
  });

  test("existing draft page payload is independent of later template edits (non-mutation model)", () => {
    const graph = multiOptionGraph();
    const pagesBefore = mapTemplateSectionsToProposalPages({
      company_id: "company-1",
      proposal_version_id: "ver-1",
      sections: graph.sections,
      spineOptionId: OPT_STD,
      template: null,
    });
    const overviewBefore = (
      pagesBefore.find((page) => page.page_type === "project_overview")!
        .content_json as { body_markdown?: string }
    ).body_markdown;

    // Simulate later setup edit (template rows change; prior draft payload stays as copied).
    const plan = buildPacketWordingSavePlan(graph, {
      overview: "Later setup edit should not rewrite existing draft pages.",
    });
    assert.ok(plan.items.length > 0);

    assert.equal(overviewBefore, "Standard Standard overview wording.");
    assert.notEqual(overviewBefore, "Later setup edit should not rewrite existing draft pages.");
  });

  test("existing draft's Project notes custom_text page is independent of later template edits", () => {
    const graph = multiOptionGraph();
    const pagesBefore = mapTemplateSectionsToProposalPages({
      company_id: "company-1",
      proposal_version_id: "ver-1",
      sections: graph.sections,
      spineOptionId: OPT_STD,
      template: null,
    });
    const notesBefore = (
      pagesBefore.find((page) => page.page_type === "custom_text")!.content_json as {
        body_markdown?: string;
      }
    ).body_markdown;

    // Simulate a later setup edit to the Project notes slot only.
    const plan = buildPacketWordingSavePlan(graph, {
      project_notes: "Later setup edit should not rewrite this existing draft's Project notes.",
    });
    assert.ok(plan.items.length > 0);
    assert.ok(plan.items.every((item) => item.slotId === "project_notes"));

    assert.equal(notesBefore, "Standard Standard notes wording.");
    assert.notEqual(
      notesBefore,
      "Later setup edit should not rewrite this existing draft's Project notes."
    );
  });
});

describe("R3A packet wording UI copy", () => {
  test("uses contractor labels without schema terms", () => {
    const copy = [
      TEMPLATES_PACKET_EDIT_ACTION,
      TEMPLATES_PACKET_SAVE_ACTION,
      TEMPLATES_PACKET_CANCEL_ACTION,
      TEMPLATES_PACKET_EDITOR_HINT,
      ...Object.values(PACKET_WORDING_SLOT_LABELS),
    ].join("\n");
    assert.equal(packetWordingUiHasForbiddenTerms(copy), false);
    assert.match(copy, /Edit customer wording/);
    assert.match(copy, /Project overview/);
    assert.match(copy, /Project notes/);
    assert.match(copy, /Warranty and protection/);
    assert.match(copy, /Terms \/ next steps/);
  });

  test("review surface wires packet wording editor instead of Advanced-only path", () => {
    const root = join(process.cwd(), "app/tools/roofing/templates");
    const review = readFileSync(join(root, "TemplatesQuoteSetupReview.tsx"), "utf8");
    const editor = readFileSync(join(root, "TemplatesPacketWordingEditor.tsx"), "utf8");
    const client = readFileSync(join(root, "TemplatesSetupClient.tsx"), "utf8");
    assert.ok(review.includes("TemplatesPacketWordingEditor"));
    assert.ok(review.includes("onSavePacketWording"));
    assert.ok(editor.includes("data-templates-edit-customer-wording"));
    assert.ok(editor.includes("data-templates-packet-wording-save"));
    assert.ok(editor.includes("data-templates-packet-wording-cancel"));
    assert.ok(client.includes("handleSavePacketWording"));
    assert.ok(client.includes("updateProposalTemplateSection"));
    assert.ok(!review.includes("Open packet pages"));
    assert.equal(packetWordingUiHasForbiddenTerms(editor), false);
  });
});
