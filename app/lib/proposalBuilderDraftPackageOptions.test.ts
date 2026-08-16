/**
 * Builder package picker — draft-option truth helpers.
 *
 * Run: npx tsx --test app/lib/proposalBuilderDraftPackageOptions.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BUILDER_ONLY_ONE_PACKAGE_NOTE,
  JOB_CARD_DRAFT_PACKAGE_CHANGE_NOTE,
  canChangeBuilderDraftPackage,
  countDraftPackageOptions,
  isTemplateOptionOnDraft,
  listDraftPackageOptions,
  scopeTemplateGraphToDraftPackageOptions,
} from "./proposalBuilderDraftPackageOptions";
import type { ProposalDraftGraph, ProposalOptionRow } from "./proposalRecordStore";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type { ProposalTemplateOption } from "./proposalTemplateTypes";

const TEMPLATE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OPT_STD = "11111111-1111-4111-8111-111111111111";
const OPT_ENH = "22222222-2222-4222-8222-222222222222";
const OPT_PREM = "33333333-3333-4333-8333-333333333333";
const OPT_SMOKE = "44444444-4444-4444-8444-444444444444";
const OPT_LIVE_ONLY = "55555555-5555-4555-8555-555555555555";
const RUNTIME_STD = "66666666-6666-4666-8666-666666666666";
const RUNTIME_ENH = "77777777-7777-4777-8777-777777777777";
const RUNTIME_SMOKE = "88888888-8888-4888-8888-888888888888";

function templateOption(
  overrides: Partial<ProposalTemplateOption> & { id: string; name: string }
): ProposalTemplateOption {
  return {
    template_id: TEMPLATE_ID,
    customer_label: overrides.name,
    description: null,
    selection_mode: "single",
    is_default: false,
    visible_to_customer: true,
    sort_order: 0,
    metadata: null,
    ...overrides,
  };
}

function draftOption(
  overrides: Partial<ProposalOptionRow> & {
    id: string;
    source_template_option_id: string | null;
    name: string;
  }
): ProposalOptionRow {
  return {
    company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    proposal_version_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    customer_label: overrides.name,
    description: null,
    sort_order: 0,
    is_default: false,
    visible_to_customer: true,
    customer_subtotal_cents: null,
    discount_cents: null,
    sales_tax_cents: null,
    customer_total_cents: null,
    pricing_complete: true,
    blocking_line_count: 0,
    guardrail_outcome: "ok",
    selected_at: null,
    created_at: "2026-06-06T00:00:00.000Z",
    updated_at: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function templateGraph(options: ProposalTemplateOption[]): ProposalTemplateGraph {
  return {
    template: {
      id: TEMPLATE_ID,
      company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Roof replacement",
      description: null,
      status: "active",
      active: true,
      sort_order: 0,
      metadata: {},
      created_by: null,
      updated_by: null,
      created_at: "2026-06-06T00:00:00.000Z",
      updated_at: "2026-06-06T00:00:00.000Z",
    },
    options,
    sections: [],
    items: [],
  };
}

function draftGraph(options: ProposalOptionRow[]): ProposalDraftGraph {
  return {
    proposal: {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      job_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      customer_id: null,
      template_id: TEMPLATE_ID,
      status: "draft",
      current_draft_version_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      latest_sent_version_id: null,
      signed_version_id: null,
      selected_option_id: options[0]?.id ?? null,
      measurement_record_id: null,
      pricing_policy_id: null,
      proposal_number: null,
      title: "Draft",
      created_by: null,
      updated_by: null,
      created_at: "2026-06-06T00:00:00.000Z",
      updated_at: "2026-06-06T00:00:00.000Z",
      draft_content_changed_at: "2026-06-06T00:00:00.000Z",
      archived_at: null,
      deleted_at: null,
    },
    version: {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      proposal_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      version_number: 1,
      version_kind: "draft",
      parent_version_id: null,
      frozen_at: null,
      context_echo: {},
      policy_echo: {},
      created_by: null,
      created_at: "2026-06-06T00:00:00.000Z",
    },
    pages: [],
    options,
    lineItems: [],
    internalSummaries: [],
    scopeDecisions: [],
  };
}

describe("proposalBuilderDraftPackageOptions", () => {
  test("copy constants are contractor-clear", () => {
    assert.match(BUILDER_ONLY_ONE_PACKAGE_NOTE, /Only one package exists on this draft/);
    assert.match(JOB_CARD_DRAFT_PACKAGE_CHANGE_NOTE, /Package changes happen in Builder/);
  });

  test("canChangeBuilderDraftPackage requires two or more options", () => {
    assert.equal(canChangeBuilderDraftPackage(0), false);
    assert.equal(canChangeBuilderDraftPackage(1), false);
    assert.equal(canChangeBuilderDraftPackage(2), true);
    assert.equal(canChangeBuilderDraftPackage(3), true);
  });

  test("listDraftPackageOptions sorts and keeps draft rows", () => {
    const draft = draftGraph([
      draftOption({
        id: RUNTIME_ENH,
        source_template_option_id: OPT_ENH,
        name: "Enhanced",
        sort_order: 2,
      }),
      draftOption({
        id: RUNTIME_STD,
        source_template_option_id: OPT_STD,
        name: "Standard",
        sort_order: 1,
      }),
    ]);
    const listed = listDraftPackageOptions(draft);
    assert.deepEqual(
      listed.map((row) => row.name),
      ["Standard", "Enhanced"]
    );
    assert.equal(countDraftPackageOptions(draft), 2);
  });

  test("no draft leaves live template options unchanged", () => {
    const live = templateGraph([
      templateOption({ id: OPT_STD, name: "Standard", sort_order: 1 }),
      templateOption({ id: OPT_ENH, name: "Enhanced", sort_order: 2 }),
      templateOption({ id: OPT_LIVE_ONLY, name: "Live only", sort_order: 3 }),
    ]);
    const scoped = scopeTemplateGraphToDraftPackageOptions(live, null);
    assert.equal(scoped, live);
    assert.equal(scoped?.options.length, 3);
  });

  test("draft with one option scopes picker to that option only", () => {
    const live = templateGraph([
      templateOption({ id: OPT_SMOKE, name: "Complete-source smoke option", sort_order: 1 }),
      templateOption({ id: OPT_STD, name: "Standard", sort_order: 2 }),
      templateOption({ id: OPT_ENH, name: "Enhanced", sort_order: 3 }),
      templateOption({ id: OPT_PREM, name: "Premium", sort_order: 4 }),
    ]);
    const draft = draftGraph([
      draftOption({
        id: RUNTIME_SMOKE,
        source_template_option_id: OPT_SMOKE,
        name: "Complete-source smoke option",
        sort_order: 1,
      }),
    ]);
    const scoped = scopeTemplateGraphToDraftPackageOptions(live, draft);
    assert.ok(scoped);
    assert.deepEqual(
      scoped.options.map((option) => option.id),
      [OPT_SMOKE]
    );
    assert.equal(canChangeBuilderDraftPackage(scoped.options.length), false);
    assert.equal(isTemplateOptionOnDraft(draft, OPT_SMOKE), true);
    assert.equal(isTemplateOptionOnDraft(draft, OPT_STD), false);
    assert.equal(isTemplateOptionOnDraft(draft, OPT_LIVE_ONLY), false);
  });

  test("multi-option draft keeps draft options and drops live-only packages", () => {
    const live = templateGraph([
      templateOption({ id: OPT_STD, name: "Standard", sort_order: 1, is_default: true }),
      templateOption({ id: OPT_ENH, name: "Enhanced", sort_order: 2 }),
      templateOption({ id: OPT_PREM, name: "Premium", sort_order: 3 }),
      templateOption({ id: OPT_LIVE_ONLY, name: "Future package", sort_order: 4 }),
    ]);
    const draft = draftGraph([
      draftOption({
        id: RUNTIME_STD,
        source_template_option_id: OPT_STD,
        name: "Standard",
        sort_order: 1,
        is_default: true,
      }),
      draftOption({
        id: RUNTIME_ENH,
        source_template_option_id: OPT_ENH,
        name: "Enhanced",
        sort_order: 2,
      }),
    ]);
    const scoped = scopeTemplateGraphToDraftPackageOptions(live, draft);
    assert.ok(scoped);
    assert.deepEqual(
      scoped.options.map((option) => option.name),
      ["Standard", "Enhanced"]
    );
    assert.equal(
      scoped.options.some((option) => option.id === OPT_LIVE_ONLY),
      false
    );
    assert.equal(
      scoped.options.some((option) => option.id === OPT_PREM),
      false
    );
    assert.equal(canChangeBuilderDraftPackage(scoped.options.length), true);
  });

  test("V2E1 draft presentation wins over later live Template rename/description", () => {
    const live = templateGraph([
      templateOption({
        id: OPT_STD,
        name: "Essential",
        customer_label: "Essential",
        description: "Live template description after edit",
        sort_order: 99,
        is_default: false,
      }),
    ]);
    const draft = draftGraph([
      draftOption({
        id: RUNTIME_STD,
        source_template_option_id: OPT_STD,
        name: "Standard",
        customer_label: "Standard",
        description: "Copied draft description",
        sort_order: 1,
        is_default: true,
      }),
    ]);
    const scoped = scopeTemplateGraphToDraftPackageOptions(live, draft);
    assert.ok(scoped);
    assert.equal(scoped.options.length, 1);
    assert.equal(scoped.options[0]?.id, OPT_STD);
    assert.equal(scoped.options[0]?.name, "Standard");
    assert.equal(scoped.options[0]?.customer_label, "Standard");
    assert.equal(scoped.options[0]?.description, "Copied draft description");
    assert.equal(scoped.options[0]?.sort_order, 1);
    assert.equal(scoped.options[0]?.is_default, true);
  });

  test("draft option missing from live template is synthesized from draft row", () => {
    const live = templateGraph([
      templateOption({ id: OPT_STD, name: "Standard", sort_order: 1 }),
    ]);
    const draft = draftGraph([
      draftOption({
        id: RUNTIME_SMOKE,
        source_template_option_id: OPT_SMOKE,
        name: "Complete-source smoke option",
        customer_label: "Smoke package",
        description: "Smoke description",
        sort_order: 1,
      }),
    ]);
    const scoped = scopeTemplateGraphToDraftPackageOptions(live, draft);
    assert.ok(scoped);
    assert.equal(scoped.options.length, 1);
    assert.equal(scoped.options[0]?.id, OPT_SMOKE);
    assert.equal(scoped.options[0]?.name, "Complete-source smoke option");
    assert.equal(scoped.options[0]?.customer_label, "Smoke package");
    assert.equal(scoped.options[0]?.description, "Smoke description");
  });
});
