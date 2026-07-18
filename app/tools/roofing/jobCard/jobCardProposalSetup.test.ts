/**
 * Run: npx tsx --test app/tools/roofing/jobCard/jobCardProposalSetup.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  JOB_CARD_CREATE_ANOTHER_EXPLAINER,
  JOB_CARD_CREATE_PROPOSAL_EXPLAINER,
  JOB_CARD_DRAFT_FROZEN_NOTE,
  JOB_CARD_DRAFT_PACKAGE_CHANGE_NOTE,
  JOB_CARD_INCLUDED_REVIEW_NOTE,
  JOB_CARD_OPEN_PROPOSAL_EXPLAINER,
  buildJobCardDraftOpenSummary,
  buildJobCardPackageSetup,
  formatJobCardProposalsTabStatus,
  formatReturnToJobProposalsLabel,
  looksLikeInternalDraftTitle,
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

  test("open explainer does not imply selectors mutate existing draft", () => {
    assert.match(JOB_CARD_OPEN_PROPOSAL_EXPLAINER, /existing proposal draft/i);
    assert.match(JOB_CARD_OPEN_PROPOSAL_EXPLAINER, /do not change it/i);
    assert.match(JOB_CARD_DRAFT_FROZEN_NOTE, /freezes/i);
    assert.match(JOB_CARD_DRAFT_PACKAGE_CHANGE_NOTE, /Package changes happen in Builder/);
    assert.match(JOB_CARD_CREATE_ANOTHER_EXPLAINER, /separate draft/i);
    assert.match(JOB_CARD_CREATE_ANOTHER_EXPLAINER, /not changed/i);
  });

  test("looksLikeInternalDraftTitle flags smoke/test titles", () => {
    assert.equal(looksLikeInternalDraftTitle("Coverage basis live smoke"), true);
    assert.equal(looksLikeInternalDraftTitle("Roof replacement"), false);
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
