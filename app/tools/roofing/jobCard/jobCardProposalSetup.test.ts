/**
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardProposalSetup.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  JOB_CARD_CREATE_PROPOSAL_EXPLAINER,
  JOB_CARD_INCLUDED_REVIEW_NOTE,
  buildJobCardPackageSetup,
  formatReturnToJobProposalsLabel,
  resolveDefaultJobCardTemplateId,
  resolveDefaultPackageOptionId,
  sanitizeSetupReturnLabel,
} from "./jobCardProposalSetup";

describe("jobCardProposalSetup", () => {
  test("create explainer mentions measurements, template, Catalog, Builder", () => {
    assert.match(JOB_CARD_CREATE_PROPOSAL_EXPLAINER, /measurements/i);
    assert.match(JOB_CARD_CREATE_PROPOSAL_EXPLAINER, /template/i);
    assert.match(JOB_CARD_CREATE_PROPOSAL_EXPLAINER, /Catalog/i);
    assert.match(JOB_CARD_CREATE_PROPOSAL_EXPLAINER, /Proposal Builder/i);
    assert.doesNotMatch(JOB_CARD_CREATE_PROPOSAL_EXPLAINER, /snapshot/i);
  });

  test("included review note steers edits to Builder / future templates", () => {
    assert.match(JOB_CARD_INCLUDED_REVIEW_NOTE, /Template changes affect future/i);
    assert.match(JOB_CARD_INCLUDED_REVIEW_NOTE, /Builder/i);
  });

  test("formatReturnToJobProposalsLabel uses job name", () => {
    assert.equal(
      formatReturnToJobProposalsLabel("Babby D"),
      "Return to Babby D · Proposals"
    );
    assert.equal(
      formatReturnToJobProposalsLabel(""),
      "Return to Job Card · Proposals"
    );
  });

  test("sanitizeSetupReturnLabel trims and caps length", () => {
    assert.equal(sanitizeSetupReturnLabel("  Babby D  "), "Babby D");
    assert.equal(sanitizeSetupReturnLabel("   "), null);
    assert.equal(sanitizeSetupReturnLabel("a".repeat(100))?.length, 80);
  });

  test("resolveDefaultJobCardTemplateId prefers starter", () => {
    const templates = [
      { id: "a", name: "A", active: true },
      { id: "starter", name: "Roof", active: true },
    ] as never;
    assert.equal(resolveDefaultJobCardTemplateId(templates, "starter"), "starter");
    assert.equal(resolveDefaultJobCardTemplateId(templates, null), "a");
  });

  test("resolveDefaultPackageOptionId prefers is_default", () => {
    const graph = {
      template: { id: "t1", name: "Roof" },
      options: [
        { id: "o1", name: "Standard", sort_order: 0, is_default: false },
        { id: "o2", name: "Enhanced", sort_order: 1, is_default: true },
      ],
      sections: [],
      items: [],
    } as never;
    assert.equal(resolveDefaultPackageOptionId(graph), "o2");
  });

  test("buildJobCardPackageSetup lists packages and included items", () => {
    const catalogId = "11111111-1111-4111-8111-111111111111";
    const graph = {
      template: { id: "t1", name: "Roof replacement", metadata: {} },
      options: [
        {
          id: "opt-std",
          name: "Standard",
          customer_label: "Standard",
          sort_order: 0,
          is_default: true,
        },
        {
          id: "opt-enh",
          name: "Enhanced",
          customer_label: "Enhanced",
          sort_order: 1,
        },
      ],
      sections: [
        {
          id: "sec-1",
          option_id: "opt-std",
          kind: "line_items",
          name: "Estimate",
          sort_order: 0,
        },
        {
          id: "sec-2",
          option_id: "opt-enh",
          kind: "line_items",
          name: "Estimate",
          sort_order: 0,
        },
      ],
      items: [
        {
          id: "item-1",
          section_id: "sec-1",
          option_id: "opt-std",
          catalog_item_id: catalogId,
          sort_order: 0,
          customer_name_override: null,
          item_role: "material",
        },
      ],
    } as never;

    const catalogItems = [
      {
        id: catalogId,
        name: "Architectural shingles",
        active: true,
        unit_price_cents: 1000,
      },
    ] as never;

    const setup = buildJobCardPackageSetup(graph, catalogItems, null);
    assert.ok(setup.choices.length >= 1);
    assert.equal(setup.selectedOptionId, "opt-std");
    assert.ok(setup.choices.some((c) => c.optionId === "opt-enh"));
    assert.equal(setup.includedItemCount, 1);
    assert.equal(setup.includedItems[0]?.label, "Architectural shingles");
    assert.ok(setup.customerFacingLine.length > 0);
  });
});
