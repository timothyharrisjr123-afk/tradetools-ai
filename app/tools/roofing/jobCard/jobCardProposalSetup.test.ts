/**
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardProposalSetup.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  JOB_CARD_CREATE_ANOTHER_EXPLAINER,
  JOB_CARD_CREATE_ANOTHER_HEADLINE,
  JOB_CARD_CREATE_PROPOSAL_EXPLAINER,
  JOB_CARD_CURRENT_PROPOSAL_LABEL,
  JOB_CARD_DRAFT_FROZEN_NOTE,
  JOB_CARD_DRAFT_PACKAGE_CHANGE_NOTE,
  JOB_CARD_INCLUDED_REVIEW_NOTE,
  JOB_CARD_OPEN_PROPOSAL_EXPLAINER,
  JOB_CARD_SHOW_OLDER_DRAFTS_LABEL,
  buildJobCardDraftOpenSummary,
  buildJobCardPackageSetup,
  deriveJobCardSelectedTemplateEligibility,
  formatContractorProposalTitle,
  formatJobCardProposalsTabStatus,
  formatReturnToJobProposalsLabel,
  looksLikeInternalDraftTitle,
  resolveDefaultJobCardTemplateId,
  resolveDefaultPackageOptionId,
  sanitizeSetupReturnLabel,
} from "./jobCardProposalSetup";
import { deriveProposalTemplateReadiness } from "@/app/lib/proposalTemplateReadiness";
import type { CatalogReadinessSummary } from "@/app/lib/catalogReadiness";

describe("jobCardProposalSetup", () => {
  test("create explainer mentions measurements, template, Catalog, Builder", () => {
    assert.match(JOB_CARD_CREATE_PROPOSAL_EXPLAINER, /measurements/i);
    assert.match(JOB_CARD_CREATE_PROPOSAL_EXPLAINER, /template/i);
    assert.match(JOB_CARD_CREATE_PROPOSAL_EXPLAINER, /Catalog/i);
    assert.match(JOB_CARD_CREATE_PROPOSAL_EXPLAINER, /Proposal Builder/i);
    assert.doesNotMatch(JOB_CARD_CREATE_PROPOSAL_EXPLAINER, /snapshot/i);
  });

  test("open explainer does not imply selectors mutate existing draft", () => {
    assert.match(JOB_CARD_OPEN_PROPOSAL_EXPLAINER, /existing proposal draft/i);
    assert.match(JOB_CARD_OPEN_PROPOSAL_EXPLAINER, /do not change it/i);
    assert.match(JOB_CARD_DRAFT_FROZEN_NOTE, /freezes/i);
    assert.match(JOB_CARD_DRAFT_PACKAGE_CHANGE_NOTE, /Package changes happen in Builder/);
    assert.match(JOB_CARD_CREATE_ANOTHER_EXPLAINER, /separate draft/i);
    assert.match(JOB_CARD_CREATE_ANOTHER_EXPLAINER, /not changed/i);
    assert.equal(JOB_CARD_CREATE_ANOTHER_HEADLINE, "Start proposal");
    assert.equal(JOB_CARD_CURRENT_PROPOSAL_LABEL, "Current proposal");
    assert.match(JOB_CARD_SHOW_OLDER_DRAFTS_LABEL, /older drafts/i);
  });

  test("looksLikeInternalDraftTitle uses conservative fixture markers only", () => {
    assert.equal(looksLikeInternalDraftTitle("Coverage basis live smoke"), true);
    assert.equal(looksLikeInternalDraftTitle("RAW_PLUS_WASTE"), true);
    assert.equal(looksLikeInternalDraftTitle("Roof replacement"), false);
    assert.equal(looksLikeInternalDraftTitle("test"), false);
    assert.equal(looksLikeInternalDraftTitle("smoke"), false);
  });

  test("formatContractorProposalTitle softens known fixture titles as fallback", () => {
    assert.equal(
      formatContractorProposalTitle("Coverage basis live smoke"),
      "Saved proposal"
    );
    assert.equal(formatContractorProposalTitle("Roof replacement"), "Roof replacement");
    assert.equal(formatContractorProposalTitle(""), "Saved proposal");
  });

  test("resolveDefaultJobCardTemplateId skips internal smoke templates", () => {
    const templates = [
      { id: "smoke", name: "RAW_PLUS_WASTE", active: true },
      { id: "roof", name: "Roof replacement", active: true },
    ] as never;
    assert.equal(resolveDefaultJobCardTemplateId(templates, null), "roof");
    assert.equal(resolveDefaultJobCardTemplateId(templates, "smoke"), "roof");
    assert.equal(resolveDefaultJobCardTemplateId(templates, "roof"), "roof");
  });

  test("formatJobCardProposalsTabStatus mentions create another when ready", () => {
    const status = formatJobCardProposalsTabStatus({
      hasExistingDraft: true,
      createSetupReady: true,
      measurementHeaderLabel: "Ready",
      measurementReady: true,
    });
    assert.match(status.label, /create another/i);
    assert.equal(status.ready, true);
  });

  test("buildJobCardDraftOpenSummary requires proposal id", () => {
    assert.equal(buildJobCardDraftOpenSummary({ proposalId: "" }), null);
    const summary = buildJobCardDraftOpenSummary({
      proposalId: "61356e56-8ef8-4fb6-85b4-672f18103b98",
      title: "Coverage basis live smoke",
      templateName: "RAW smoke",
      packageLabel: "Complete-source smoke option",
      updatedAt: "2026-07-17T12:00:00.000Z",
    });
    assert.ok(summary);
    assert.equal(summary?.statusLabel, "Draft saved");
    assert.equal(summary?.packageLabel, "Complete-source smoke option");
  });

  test("formatJobCardProposalsTabStatus uses draft-open vs create vocabulary", () => {
    assert.deepEqual(
      formatJobCardProposalsTabStatus({
        hasExistingDraft: true,
        createSetupReady: true,
        measurementHeaderLabel: "Ready for template",
        measurementReady: true,
      }),
      { label: "Draft ready · can create another", ready: true }
    );
    assert.deepEqual(
      formatJobCardProposalsTabStatus({
        hasExistingDraft: true,
        createSetupReady: false,
        measurementHeaderLabel: "Ready for template",
        measurementReady: true,
      }),
      { label: "Draft ready to open", ready: true }
    );
    assert.deepEqual(
      formatJobCardProposalsTabStatus({
        hasExistingDraft: false,
        createSetupReady: true,
        measurementHeaderLabel: "Ready for template",
        measurementReady: true,
      }),
      { label: "Ready to create draft", ready: true }
    );
    assert.equal(
      formatJobCardProposalsTabStatus({
        hasExistingDraft: false,
        createSetupReady: false,
        measurementHeaderLabel: "Ready for template",
        measurementReady: true,
      }).label,
      "Needs attention"
    );
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

  test("Job Card package setup only sees active packages from filtered graph", () => {
    // Soft-removed options are excluded by getProposalTemplateGraph before Job Card.
    const catalogId = "11111111-1111-4111-8111-111111111111";
    const graph = {
      template: { id: "t1", name: "Roof", metadata: {} },
      options: [
        {
          id: "opt-plus",
          name: "Best Plus",
          customer_label: "Best Plus",
          sort_order: 10,
          is_default: true,
        },
        {
          id: "opt-best",
          name: "Best",
          customer_label: "Best",
          sort_order: 20,
          is_default: false,
        },
      ],
      sections: [
        {
          id: "sec-plus",
          option_id: "opt-plus",
          kind: "line_items",
          name: "Estimate",
          sort_order: 0,
        },
        {
          id: "sec-best",
          option_id: "opt-best",
          kind: "line_items",
          name: "Estimate",
          sort_order: 0,
        },
      ],
      items: [
        {
          id: "item-1",
          option_id: "opt-plus",
          section_id: "sec-plus",
          catalog_item_id: catalogId,
          sort_order: 0,
        },
      ],
    } as never;
    const catalogItems = [
      {
        id: catalogId,
        name: "Shingles",
        active: true,
        unit_price_cents: 1000,
      },
    ] as never;
    const setup = buildJobCardPackageSetup(graph, catalogItems, null);
    assert.deepEqual(
      setup.choices.map((row) => row.optionId),
      ["opt-plus", "opt-best"]
    );
    assert.equal(setup.choices.some((row) => row.optionId === "opt-good"), false);
    assert.equal(setup.selectedOptionId, "opt-plus");
  });

  test("package cards follow sort_order for Job Card selection order", () => {
    const catalogId = "11111111-1111-4111-8111-111111111111";
    const graph = {
      template: { id: "t1", name: "Roof", metadata: {} },
      options: [
        {
          id: "opt-good",
          name: "Good",
          customer_label: "Good",
          sort_order: 30,
          is_default: false,
        },
        {
          id: "opt-plus",
          name: "Best Plus",
          customer_label: "Best Plus",
          sort_order: 10,
          is_default: true,
        },
        {
          id: "opt-best",
          name: "Best",
          customer_label: "Best",
          sort_order: 20,
          is_default: false,
        },
      ],
      sections: [
        {
          id: "sec-plus",
          option_id: "opt-plus",
          kind: "line_items",
          name: "Estimate",
          sort_order: 0,
        },
        {
          id: "sec-best",
          option_id: "opt-best",
          kind: "line_items",
          name: "Estimate",
          sort_order: 0,
        },
        {
          id: "sec-good",
          option_id: "opt-good",
          kind: "line_items",
          name: "Estimate",
          sort_order: 0,
        },
      ],
      items: [
        {
          id: "item-1",
          option_id: "opt-plus",
          section_id: "sec-plus",
          catalog_item_id: catalogId,
          sort_order: 0,
        },
      ],
    } as never;
    const catalogItems = [
      {
        id: catalogId,
        name: "Shingles",
        active: true,
        unit_price_cents: 1000,
      },
    ] as never;
    const setup = buildJobCardPackageSetup(
      graph,
      catalogItems,
      resolveDefaultPackageOptionId(graph)
    );
    assert.deepEqual(
      setup.choices.map((row) => row.optionId),
      ["opt-plus", "opt-best", "opt-good"]
    );
    assert.equal(setup.selectedOptionId, "opt-plus");
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

describe("deriveJobCardSelectedTemplateEligibility", () => {
  const catalogId = "11111111-1111-4111-8111-111111111111";
  const catalogItems = [
    {
      id: catalogId,
      name: "Architectural shingles",
      active: true,
      unit_price_cents: 1000,
    },
  ] as never;

  function singlePackageGraph(templateId: string) {
    return {
      template: { id: templateId, name: "Guided Test", metadata: {}, active: true },
      options: [
        {
          id: "opt-one",
          name: "Standard",
          customer_label: "Standard",
          sort_order: 0,
          is_default: true,
        },
      ],
      sections: [
        {
          id: "sec-1",
          option_id: "opt-one",
          kind: "line_items",
          name: "Estimate",
          sort_order: 0,
        },
      ],
      items: [
        {
          id: "item-1",
          section_id: "sec-1",
          option_id: "opt-one",
          catalog_item_id: catalogId,
          sort_order: 0,
          customer_name_override: null,
          item_role: "material",
        },
      ],
    } as never;
  }

  function starterShapedGraph(templateId: string) {
    const options = ["opt-std", "opt-enh", "opt-prem"].map((id, i) => ({
      id,
      name: ["Standard", "Enhanced", "Premium"][i],
      customer_label: ["Standard", "Enhanced", "Premium"][i],
      sort_order: i,
      is_default: i === 0,
    }));
    const sections = options.map((opt, i) => ({
      id: `sec-${i}`,
      option_id: opt.id,
      kind: "line_items",
      name: "Estimate",
      sort_order: 0,
    }));
    const items = Array.from({ length: 13 }, (_, i) => ({
      id: `item-${i}`,
      section_id: "sec-0",
      option_id: "opt-std",
      catalog_item_id: catalogId,
      sort_order: i,
      customer_name_override: null,
      item_role: "material",
    }));
    return {
      template: {
        id: templateId,
        name: "Roof replacement",
        metadata: {},
        active: true,
      },
      options,
      sections,
      items,
    } as never;
  }

  test("starter-shaped template is usable and advances past template gate", () => {
    const graph = starterShapedGraph("starter-t");
    const eligibility = deriveJobCardSelectedTemplateEligibility({
      selectedTemplateId: "starter-t",
      graph,
      catalogItems,
    });
    assert.equal(eligibility.usable, true);
    assert.equal(eligibility.graphMatchesSelection, true);
    assert.equal(eligibility.reason, null);
  });

  test("single-package guided template is usable without company starter readiness", () => {
    const graph = singlePackageGraph("guided-t");
    const eligibility = deriveJobCardSelectedTemplateEligibility({
      selectedTemplateId: "guided-t",
      graph,
      catalogItems,
    });
    assert.equal(eligibility.usable, true);

    const catalogReadiness = {
      status: "ready",
      active_item_count: 20,
      priced_item_count: 20,
      unpriced_item_count: 0,
      missing_seed_key_count: 0,
    } as CatalogReadinessSummary;
    const companyReadiness = deriveProposalTemplateReadiness({
      catalogReadiness,
      activeCatalogItems: catalogItems,
      starterGraph: graph,
      templateCount: 1,
      activeTemplateCount: 1,
    });
    assert.notEqual(companyReadiness.status, "ready_for_builder");
  });

  test("not-ready selected template does not imply every template is blocked", () => {
    const emptyGraph = {
      template: { id: "empty-t", name: "Empty", metadata: {}, active: true },
      options: [
        {
          id: "opt-one",
          name: "Standard",
          customer_label: "Standard",
          sort_order: 0,
          is_default: true,
        },
      ],
      sections: [
        {
          id: "sec-1",
          option_id: "opt-one",
          kind: "line_items",
          name: "Estimate",
          sort_order: 0,
        },
      ],
      items: [],
    } as never;

    const emptyEligibility = deriveJobCardSelectedTemplateEligibility({
      selectedTemplateId: "empty-t",
      graph: emptyGraph,
      catalogItems,
    });
    assert.equal(emptyEligibility.usable, false);
    assert.match(emptyEligibility.reason ?? "", /Catalog items/i);

    const readyEligibility = deriveJobCardSelectedTemplateEligibility({
      selectedTemplateId: "guided-t",
      graph: singlePackageGraph("guided-t"),
      catalogItems,
    });
    assert.equal(readyEligibility.usable, true);
  });

  test("stale graph for a different template id is not usable yet", () => {
    const eligibility = deriveJobCardSelectedTemplateEligibility({
      selectedTemplateId: "next-t",
      graph: singlePackageGraph("prev-t"),
      catalogItems,
    });
    assert.equal(eligibility.usable, false);
    assert.equal(eligibility.graphMatchesSelection, false);
    assert.equal(eligibility.reason, null);
  });

  test("template with missing catalog links is not usable", () => {
    const graph = {
      template: { id: "bad-t", name: "Broken", metadata: {}, active: true },
      options: [
        {
          id: "opt-one",
          name: "Standard",
          customer_label: "Standard",
          sort_order: 0,
          is_default: true,
        },
      ],
      sections: [
        {
          id: "sec-1",
          option_id: "opt-one",
          kind: "line_items",
          name: "Estimate",
          sort_order: 0,
        },
      ],
      items: [
        {
          id: "item-1",
          section_id: "sec-1",
          option_id: "opt-one",
          catalog_item_id: null,
          sort_order: 0,
          customer_name_override: null,
          item_role: "material",
        },
      ],
    } as never;
    const eligibility = deriveJobCardSelectedTemplateEligibility({
      selectedTemplateId: "bad-t",
      graph,
      catalogItems,
    });
    assert.equal(eligibility.usable, false);
    assert.ok(eligibility.reason);
  });
});
