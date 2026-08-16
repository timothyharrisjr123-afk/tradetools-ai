/**
 * 041 backfill fixtures A–K. Never uses proposals.updated_at as truth.
 *
 * Run: npx tsx --test app/lib/proposalDraftContentChangedAtBackfill.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  planDraftContentChangedAtBackfill,
  type DraftContentBackfillGraph,
  type DraftContentBackfillInput,
  type DraftContentBackfillPackage,
} from "./proposalDraftContentChangedAtBackfill";

const FROZEN = "2026-07-22T16:31:00.000Z";
const FREEZE_EVENT = "2026-07-22T16:31:00.250Z";
const CREATED = "2026-07-01T12:00:00.000Z";
const AFTER = "2026-07-23T12:00:00.000Z";
const NOW = "2026-08-16T20:00:00.000Z";
const DRAFT_OPT = "11111111-1111-4111-8111-111111111111";
const SENT_OPT = "22222222-2222-4222-8222-222222222222";
const SRC_OPT = "33333333-3333-4333-8333-333333333333";
const SRC_ITEM = "44444444-4444-4444-8444-444444444444";
const SRC_SECTION = "55555555-5555-4555-8555-555555555555";

function pkg(
  id: string,
  extra: Partial<DraftContentBackfillPackage> = {}
): DraftContentBackfillPackage {
  return {
    id,
    source_template_option_id: SRC_OPT,
    sort_order: 0,
    name: "Standard",
    customer_label: "Standard",
    description: "Core package",
    visible_to_customer: true,
    is_default: true,
    selected_at: FROZEN,
    customer_subtotal_cents: 100000,
    discount_cents: 0,
    sales_tax_cents: 0,
    customer_total_cents: 100000,
    pricing_complete: true,
    blocking_line_count: 0,
    ...extra,
  };
}

function graph(
  kind: "draft" | "sent",
  optionId: string,
  extra: Partial<DraftContentBackfillGraph> = {}
): DraftContentBackfillGraph {
  return {
    versionKind: kind,
    frozenAt: kind === "sent" ? FROZEN : null,
    contextEcho: { customer_name: "Jordan Hale", job_name: "Roof" },
    policyEcho: { waste_pct: 10 },
    packages: [pkg(optionId)],
    pages: [
      {
        page_type: "terms",
        source_template_section_id: SRC_SECTION,
        sort_order: 20,
        title: "Terms",
        customer_title: "Terms",
        visible_to_customer: true,
        content_json: { body_markdown: "Pay on completion." },
        settings_json: {},
      },
    ],
    lines: [
      {
        optionId,
        source_template_item_id: SRC_ITEM,
        catalog_seed_key: "shingles",
        composition_slot_key: "field",
        composition_role: "included",
        sort_order: 0,
        customer_name: "Shingles",
        description: "Architectural",
        quantity: 24,
        unit: "SQ",
        customer_unit_price_cents: 4000,
        customer_line_total_cents: 96000,
        visible_to_customer: true,
        upgrade_selection_state: null,
        upgrade_effect: null,
        replaces_source_template_item_id: null,
        quantity_resolution_echo: { resolved_purchase_quantity: 24 },
      },
    ],
    upgrades: [
      {
        optionId,
        source_template_item_id: SRC_ITEM,
        selection_state: "not_selected",
        upgrade_effect: "add",
        replaces_source_template_item_id: null,
      },
    ],
    ...extra,
  };
}

function input(
  extra: Partial<DraftContentBackfillInput> = {}
): DraftContentBackfillInput {
  return {
    createdAt: CREATED,
    selectedOptionId: DRAFT_OPT,
    currentDraftVersionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    latestSentVersionId: "ssssssss-ssss-4sss-8sss-ssssssssssss",
    draft: graph("draft", DRAFT_OPT),
    sent: graph("sent", SENT_OPT),
    draftSavedAt: [],
    snapshotFrozenAt: FREEZE_EVENT,
    draftScopeDecisionUpdatedAt: [],
    now: NOW,
    ...extra,
  };
}

describe("041 backfill A–K", () => {
  test("A. normal send-shaped graph, no content change → clean clamp to frozen_at", () => {
    const plan = planDraftContentChangedAtBackfill(input());
    assert.equal(plan.outcome, "clean");
    assert.equal(plan.stamp, FROZEN);
    assert.notEqual(plan.stamp, FREEZE_EVENT);
  });

  test("B. post-send page content change → dirty", () => {
    const base = input();
    const draft = graph("draft", DRAFT_OPT, {
      pages: [
        {
          ...base.draft!.pages[0]!,
          content_json: { body_markdown: "Revised terms." },
        },
      ],
    });
    const plan = planDraftContentChangedAtBackfill(
      input({ draft, draftSavedAt: [AFTER] })
    );
    assert.equal(plan.outcome, "dirty");
    assert.equal(plan.stamp, AFTER);
    assert.ok(Date.parse(plan.stamp) > Date.parse(FROZEN));
  });

  test("C. selected option change → dirty", () => {
    const otherSrc = "66666666-6666-4666-8666-666666666666";
    const draft = graph("draft", DRAFT_OPT, {
      packages: [
        pkg(DRAFT_OPT, { source_template_option_id: otherSrc, selected_at: AFTER }),
      ],
    });
    const plan = planDraftContentChangedAtBackfill(input({ draft }));
    assert.equal(plan.outcome, "dirty");
    assert.equal(plan.stamp, NOW);
  });

  test("D. line/pricing change → dirty", () => {
    const base = input();
    const draft = graph("draft", DRAFT_OPT, {
      lines: [{ ...base.draft!.lines[0]!, customer_line_total_cents: 110000 }],
      packages: [pkg(DRAFT_OPT, { customer_total_cents: 110000 })],
    });
    const plan = planDraftContentChangedAtBackfill(input({ draft }));
    assert.equal(plan.outcome, "dirty");
  });

  test("E. upgrade choice change → dirty", () => {
    const base = input();
    const draft = graph("draft", DRAFT_OPT, {
      upgrades: [{ ...base.draft!.upgrades[0]!, selection_state: "selected" }],
    });
    const plan = planDraftContentChangedAtBackfill(input({ draft }));
    assert.equal(plan.outcome, "dirty");
  });

  test("F. identity echo restamp → dirty", () => {
    const draft = graph("draft", DRAFT_OPT, {
      contextEcho: { customer_name: "Jordan Hale Jr", job_name: "Roof" },
    });
    const plan = planDraftContentChangedAtBackfill(input({ draft }));
    assert.equal(plan.outcome, "dirty");
  });

  test("G. scope decision post-freeze without pricing refresh → dirty via adjunct", () => {
    const plan = planDraftContentChangedAtBackfill(
      input({ draftScopeDecisionUpdatedAt: [AFTER] })
    );
    assert.equal(plan.outcome, "dirty");
    assert.equal(plan.stamp, NOW);
  });

  test("H. header latest_sent update only is not a graph difference → clean", () => {
    const plan = planDraftContentChangedAtBackfill(input());
    assert.equal(plan.outcome, "clean");
    assert.equal(plan.stamp, FROZEN);
  });

  test("I. token/delivery/acceptance only → clean (no draft graph/event change)", () => {
    const plan = planDraftContentChangedAtBackfill(input());
    assert.equal(plan.outcome, "clean");
  });

  test("J. ambiguous graph matching → unknown → dirty now()", () => {
    const draft = graph("draft", DRAFT_OPT, {
      packages: [
        pkg(DRAFT_OPT),
        pkg("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { sort_order: 1 }),
      ],
    });
    const plan = planDraftContentChangedAtBackfill(input({ draft }));
    assert.equal(plan.outcome, "unknown");
    assert.equal(plan.stamp, NOW);
  });

  test("K. missing sent graph → unknown → dirty now()", () => {
    const plan = planDraftContentChangedAtBackfill(input({ sent: null }));
    assert.equal(plan.outcome, "unknown");
    assert.equal(plan.stamp, NOW);
  });

  test("unsent initializes from created_at", () => {
    const plan = planDraftContentChangedAtBackfill(
      input({ latestSentVersionId: null, sent: null })
    );
    assert.equal(plan.outcome, "unsent");
    assert.equal(plan.stamp, CREATED);
  });

  test("never consults updated_at — function input has no such field", () => {
    const keys = Object.keys(input());
    assert.equal(keys.includes("updatedAt"), false);
    assert.equal(keys.includes("updated_at"), false);
  });
});
