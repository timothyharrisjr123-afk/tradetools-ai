import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_PACKET_OVERVIEW_BODY,
  DEFAULT_PACKET_SCOPE_NOTES_BODY,
  DEFAULT_PACKET_TERMS_BODY,
  DEFAULT_PACKET_WARRANTY_BODY,
  LEGACY_PACKET_OVERVIEW_BODY,
  LEGACY_PACKET_SCOPE_NOTES_BODY,
  LEGACY_PACKET_TERMS_BODY,
  LEGACY_PACKET_WARRANTY_BODY,
  PRE_V2E5_PACKET_OVERVIEW_BODY,
  resolveCustomerFacingPacketBodyMarkdown,
} from "@/app/lib/proposalCustomerPacketDefaultContent";
import {
  buildDefaultPacketContentRepairPlan,
  PACKET_CONTENT_REPAIR_SENT_SNAPSHOT_GUARD,
} from "@/app/lib/proposalCustomerPacketContentRepair";
import { DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY } from "@/app/lib/defaultRoofingProposalTemplates";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";

function makeGraph(overrides?: {
  templateSeedKey?: string;
  overviewBody?: string;
  notesBody?: string;
  warrantyBody?: string;
  termsBody?: string;
  optionDescription?: string;
}): ProposalTemplateGraph {
  const templateSeedKey = overrides?.templateSeedKey ?? DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY;
  return {
    template: {
      id: "tmpl-1",
      company_id: "co-1",
      name: "Roof replacement",
      description: null,
      status: "active",
      active: true,
      sort_order: 0,
      metadata: { seed_key: templateSeedKey },
      created_at: null,
      updated_at: null,
    },
    options: [
      {
        id: "opt-1",
        company_id: "co-1",
        template_id: "tmpl-1",
        name: "Standard",
        description:
          overrides?.optionDescription ??
          "Standard roof replacement package with core materials, labor, disposal, and permit line items.",
        customer_label: "Standard",
        is_default: true,
        sort_order: 0,
        active: true,
        removed_at: null,
        metadata: { seed_key: `${templateSeedKey}.option.standard` },
        created_at: null,
        updated_at: null,
      },
    ],
    sections: [
      {
        id: "sec-overview",
        company_id: "co-1",
        template_id: "tmpl-1",
        option_id: "opt-1",
        kind: "text",
        name: "Overview",
        customer_title: "Overview",
        customer_visibility: "customer_visible",
        sort_order: 0,
        content: {
          title: "Overview",
          body_markdown: overrides?.overviewBody ?? LEGACY_PACKET_OVERVIEW_BODY,
        },
        metadata: { seed_key: `${templateSeedKey}.option.standard.overview` },
        created_at: null,
        updated_at: null,
      },
      {
        id: "sec-notes",
        company_id: "co-1",
        template_id: "tmpl-1",
        option_id: "opt-1",
        kind: "text",
        name: "Scope notes",
        customer_title: "Scope notes",
        customer_visibility: "customer_visible",
        sort_order: 1,
        content: {
          title: "Scope notes",
          body_markdown: overrides?.notesBody ?? LEGACY_PACKET_SCOPE_NOTES_BODY,
        },
        metadata: { seed_key: `${templateSeedKey}.option.standard.scope_notes` },
        created_at: null,
        updated_at: null,
      },
      {
        id: "sec-warranty",
        company_id: "co-1",
        template_id: "tmpl-1",
        option_id: "opt-1",
        kind: "warranty",
        name: "Warranty",
        customer_title: "Warranty",
        customer_visibility: "customer_visible",
        sort_order: 2,
        content: {
          title: "Warranty",
          body_markdown: overrides?.warrantyBody ?? LEGACY_PACKET_WARRANTY_BODY,
        },
        metadata: { seed_key: `${templateSeedKey}.option.standard.warranty` },
        created_at: null,
        updated_at: null,
      },
      {
        id: "sec-terms",
        company_id: "co-1",
        template_id: "tmpl-1",
        option_id: "opt-1",
        kind: "terms",
        name: "Terms",
        customer_title: "Terms",
        customer_visibility: "customer_visible",
        sort_order: 3,
        content: {
          title: "Terms",
          body_markdown: overrides?.termsBody ?? LEGACY_PACKET_TERMS_BODY,
        },
        metadata: { seed_key: `${templateSeedKey}.option.standard.terms` },
        created_at: null,
        updated_at: null,
      },
    ],
    items: [],
  } as unknown as ProposalTemplateGraph;
}

describe("proposalCustomerPacketContentRepair", () => {
  test("plans section + option repairs for exact legacy starter bodies", () => {
    const plan = buildDefaultPacketContentRepairPlan(makeGraph());
    assert.ok(plan);
    assert.equal(plan!.sentSnapshotsMustNotBeMutated, true);
    assert.equal(plan!.sentSnapshotGuardrail, PACKET_CONTENT_REPAIR_SENT_SNAPSHOT_GUARD);
    assert.equal(plan!.sectionRepairs.length, 4);
    assert.equal(plan!.optionDescriptionRepairs.length, 1);
    assert.ok(plan!.sentSnapshotGuardrail.includes("proposal_pages"));
  });

  test("skips non-starter templates", () => {
    const plan = buildDefaultPacketContentRepairPlan(
      makeGraph({ templateSeedKey: "custom.setup" })
    );
    assert.equal(plan, null);
  });

  test("does not repair already-new packet bodies", () => {
    const plan = buildDefaultPacketContentRepairPlan(
      makeGraph({
        overviewBody: DEFAULT_PACKET_OVERVIEW_BODY,
        notesBody: DEFAULT_PACKET_SCOPE_NOTES_BODY,
        warrantyBody: DEFAULT_PACKET_WARRANTY_BODY,
        termsBody: DEFAULT_PACKET_TERMS_BODY,
        optionDescription:
          "Solid, complete roof replacement with quality materials, professional installation, cleanup, and permit handling.",
      })
    );
    assert.ok(plan);
    assert.equal(plan!.sectionRepairs.length, 0);
    assert.equal(plan!.optionDescriptionRepairs.length, 0);
  });

  test("does not repair contractor-customized bodies", () => {
    const plan = buildDefaultPacketContentRepairPlan(
      makeGraph({
        overviewBody: "Our team wrote this custom overview for homeowners.",
        notesBody: "Custom notes only.",
        warrantyBody: "Custom warranty wording.",
        termsBody: "Custom next steps.",
        optionDescription: "Custom package pitch.",
      })
    );
    assert.ok(plan);
    assert.equal(plan!.sectionRepairs.length, 0);
    assert.equal(plan!.optionDescriptionRepairs.length, 0);
  });

  test("repairs pre-V2E5 recommended-path overview and R3A smoke notes", () => {
    const plan = buildDefaultPacketContentRepairPlan(
      makeGraph({
        overviewBody: PRE_V2E5_PACKET_OVERVIEW_BODY,
        notesBody:
          "R3A SMOKE TEST - Project notes: debris removal is scheduled within 48 hours of completion.",
        warrantyBody: DEFAULT_PACKET_WARRANTY_BODY,
        termsBody: DEFAULT_PACKET_TERMS_BODY,
        optionDescription:
          "Solid, complete roof replacement with quality materials, professional installation, cleanup, and permit handling.",
      })
    );
    assert.ok(plan);
    assert.equal(plan!.sectionRepairs.length, 2);
    assert.ok(plan!.sectionRepairs.some((row) => row.suffix === ".overview"));
    assert.ok(plan!.sectionRepairs.some((row) => row.suffix === ".scope_notes"));
    assert.equal(plan!.optionDescriptionRepairs.length, 0);
  });

  test("display-time legacy resolver does not rewrite already-new SoT bodies", () => {
    assert.equal(
      resolveCustomerFacingPacketBodyMarkdown("project_overview", DEFAULT_PACKET_OVERVIEW_BODY),
      DEFAULT_PACKET_OVERVIEW_BODY
    );
    assert.equal(
      resolveCustomerFacingPacketBodyMarkdown("custom_text", DEFAULT_PACKET_SCOPE_NOTES_BODY),
      DEFAULT_PACKET_SCOPE_NOTES_BODY
    );
    assert.equal(
      resolveCustomerFacingPacketBodyMarkdown("project_overview", LEGACY_PACKET_OVERVIEW_BODY),
      DEFAULT_PACKET_OVERVIEW_BODY
    );
  });

  test("repair module never imports proposal page writers", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(
      new URL("./proposalCustomerPacketContentRepair.ts", import.meta.url),
      "utf8"
    );
    assert.doesNotMatch(source, /from ["']@\/app\/lib\/proposalRecord/);
    assert.doesNotMatch(source, /updateProposalPage|freezeProposal|createProposalPage/);
    assert.match(source, /updateProposalTemplateSection/);
    assert.match(source, /updateProposalTemplateOption/);
    assert.match(source, /Existing draft and sent proposal_pages are never rewritten/);
  });
});
