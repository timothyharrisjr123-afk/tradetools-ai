/**
 * R17D Phase 1 — proposalScopeDecisionStore tests (mocked Supabase).
 *
 * Run: npx tsx --test app/lib/proposalScopeDecisionStore.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  clearDraftScopeDecision,
  getScopeDecisionsForDraftVersion,
  getScopeDecisionsForProposalOption,
  upsertDraftScopeDecision,
} from "./proposalScopeDecisionStore";
import {
  createDraftProposal,
  ProposalRecordStoreError,
  type ProposalRecordStoreDeps,
} from "./proposalRecordStore";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";

// The import above does not export helpers — duplicate minimal harness inline.

import type { CatalogItem } from "./catalogTypes";
import type { CompanyPricingPolicyResolution } from "./companyPricingPolicy";
import type { CompanyBrandingExtendedFields } from "./companyBrandingProfileStore";
import type { CompanyProfile } from "./companyProfile";
import type { MeasurementProposalHandoff } from "./measurementProposalHandoff";
import type { MeasurementQuantityMap } from "./measurementTypes";
import type { ProposalQuantityPreviewContext } from "./proposalBuilderPreview";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
} from "./proposalPricingTypes";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";

const CONFIGURED_RESOLUTION: CompanyPricingPolicyResolution = {
  configured: true,
  source: "company",
  policy: {
    profitabilityType: DEFAULT_PROFITABILITY_TYPE,
    defaultProfitabilityPct: 35,
    minimumProfitabilityPct: 25,
    quantityRounding: DEFAULT_QUANTITY_ROUNDING,
    wasteModel: DEFAULT_WASTE_MODEL,
    discount: null,
    tax: { salesTaxRatePct: 8, materialPurchaseTaxRatePct: null },
    subtotalOverrideCents: null,
  },
  reason: null,
};

const TEST_COMPANY_CORE: CompanyProfile = {
  companyName: "Summit Roofing",
  phone: "918-555-0100",
  email: "hello@summit.com",
  license: "OK-12345",
  logoDataUrl: "data:image/png;base64,abc",
  notificationsEmail: "",
};

type MockOp = { table: string; action: string; payload?: unknown };
type MockState = {
  ops: MockOp[];
  tables: Record<string, Record<string, unknown>[]>;
  idSeq: number;
};

const MOCK_UUID_POOL: string[] = [];

function nextUuid(state: MockState): string {
  state.idSeq += 1;
  while (MOCK_UUID_POOL.length < state.idSeq) {
    const i = MOCK_UUID_POOL.length + 1;
    MOCK_UUID_POOL.push(
      `${String(i).padStart(8, "0")}-1111-4111-8111-${String(i).padStart(12, "1")}`
    );
  }
  return MOCK_UUID_POOL[state.idSeq - 1]!;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function executeQuery(
  table: string,
  state: MockState,
  filters: Record<string, unknown>,
  pendingInsert: unknown,
  pendingUpdate: unknown,
  pendingDelete: boolean,
  orderSpec: { column: string; ascending: boolean } | null,
  isNullFilter: { column: string } | null,
  mode: "many" | "one"
) {
  if (pendingInsert) {
    const base = clone(
      (Array.isArray(pendingInsert) ? pendingInsert[0] : pendingInsert) as Record<string, unknown>
    );
    const row: Record<string, unknown> = {
      id: nextUuid(state),
      created_at: "2026-06-18T00:00:00Z",
      updated_at: "2026-06-18T00:00:00Z",
      ...base,
    };
    state.tables[table] = [...(state.tables[table] ?? []), row];
    return { data: mode === "one" ? row : [row], error: null };
  }

  let rows = (state.tables[table] ?? []).filter((row) => {
    const record = row as Record<string, unknown>;
    if (isNullFilter && record[isNullFilter.column] != null) return false;
    return Object.entries(filters).every(([key, value]) => record[key] === value);
  });

  if (orderSpec) {
    rows = [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[orderSpec.column] as number;
      const bv = (b as Record<string, unknown>)[orderSpec.column] as number;
      return orderSpec.ascending ? av - bv : bv - av;
    });
  }

  if (pendingUpdate) {
    rows.forEach((row) => Object.assign(row as object, pendingUpdate as object));
    return { data: mode === "one" ? rows[0] ?? null : rows, error: null };
  }

  if (pendingDelete) {
    const toDelete = new Set(rows.map((r) => r.id));
    state.tables[table] = (state.tables[table] ?? []).filter((r) => !toDelete.has(r.id));
    return { data: mode === "one" ? null : [], error: null };
  }

  return { data: mode === "one" ? rows[0] ?? null : rows, error: null };
}

function createMockSupabase() {
  const state: MockState = {
    ops: [],
    tables: {
      customers: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          company_id: COMPANY_ID,
        },
      ],
      jobs: [{ id: JOB_ID, company_id: COMPANY_ID, customer_id: "55555555-5555-4555-8555-555555555555" }],
      company_pricing_policies: [{ id: "44444444-4444-4444-8444-444444444444", company_id: COMPANY_ID }],
      proposals: [],
      proposal_versions: [],
      proposal_pages: [],
      proposal_options: [],
      proposal_line_items: [],
      proposal_internal_summaries: [],
      proposal_events: [],
      proposal_option_scope_decisions: [],
    },
    idSeq: 0,
  };

  function from(table: string) {
    const filters: Record<string, unknown> = {};
    let pendingInsert: unknown;
    let pendingUpdate: unknown;
    let pendingDelete = false;
    let orderSpec: { column: string; ascending: boolean } | null = null;
    let isNullFilter: { column: string } | null = null;
    let terminal: "many" | "one" = "many";

    const chain = {
      select() {
        return chain;
      },
      insert(data: unknown) {
        pendingInsert = data;
        state.ops.push({ table, action: "insert", payload: data });
        return chain;
      },
      update(data: unknown) {
        pendingUpdate = data;
        state.ops.push({ table, action: "update", payload: data });
        return chain;
      },
      delete() {
        pendingDelete = true;
        return chain;
      },
      eq(column: string, value: unknown) {
        filters[column] = value;
        return chain;
      },
      is(column: string, value: string) {
        if (value === "null") isNullFilter = { column };
        return chain;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        orderSpec = { column, ascending: opts?.ascending ?? true };
        return chain;
      },
      maybeSingle: async () => {
        terminal = "one";
        const result = executeQuery(
          table,
          state,
          filters,
          pendingInsert,
          pendingUpdate,
          pendingDelete,
          orderSpec,
          isNullFilter,
          "one"
        );
        pendingInsert = undefined;
        pendingUpdate = undefined;
        pendingDelete = false;
        return result;
      },
      single: async () => chain.maybeSingle(),
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        const mode = terminal === "many" ? "many" : "one";
        return Promise.resolve(
          executeQuery(
            table,
            state,
            filters,
            pendingInsert,
            pendingUpdate,
            pendingDelete,
            orderSpec,
            isNullFilter,
            mode
          )
        ).then((result) => {
          pendingInsert = undefined;
          pendingUpdate = undefined;
          pendingDelete = false;
          return onFulfilled(result);
        }, onRejected);
      },
    };
    return chain;
  }

  return { supabase: { from }, state };
}

function testGraph(): ProposalTemplateGraph {
  return {
    template: {
      id: TEMPLATE_ID,
      company_id: COMPANY_ID,
      name: "Standard Package",
      status: "active",
      active: true,
    },
    options: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        template_id: TEMPLATE_ID,
        name: "Standard",
        is_default: true,
        visible_to_customer: true,
        sort_order: 0,
      },
    ],
    sections: [
      {
        id: "88888888-8888-4888-8888-888888888888",
        template_id: TEMPLATE_ID,
        option_id: "77777777-7777-4777-8777-777777777777",
        kind: "line_items",
        name: "Estimate",
        sort_order: 0,
      },
    ],
    items: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        template_id: TEMPLATE_ID,
        option_id: "77777777-7777-4777-8777-777777777777",
        section_id: "88888888-8888-4888-8888-888888888888",
        catalog_item_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        item_role: "standard",
        sort_order: 0,
      },
    ],
  };
}

function readyContext(): ProposalQuantityPreviewContext {
  const handoff: MeasurementProposalHandoff = {
    proposalReady: true,
    blockers: [],
    selectedLabel: "Job",
    quantities: {
      roof_squares: 22,
      adjusted_roof_squares: 22,
      roof_area_sqft: 2200,
      waste_percent: 10,
      eaves_lf: null,
      rakes_lf: null,
      ridges_lf: null,
      hips_lf: null,
      valleys_lf: null,
      wall_flashing_lf: null,
      step_flashing_lf: null,
      transitions_lf: null,
      parapet_wall_lf: null,
      drip_edge_lf: null,
      starter_lf: null,
      ridge_cap_lf: null,
      pipe_boots_count: null,
      vents_count: null,
      skylights_count: null,
      chimneys_count: null,
      satellite_dishes_count: null,
    },
    estimateReady: true,
    productionReady: false,
  };
  const quantityMap: MeasurementQuantityMap = { shingles_squares: 22 };
  return { measurementHandoff: handoff, quantityMap };
}

function storeDeps(mock: ReturnType<typeof createMockSupabase>): ProposalRecordStoreDeps {
  const cat: CatalogItem = {
    company_id: COMPANY_ID,
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Shingles",
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "cost_plus_margin",
    customer_visibility: "customer_visible",
    active: true,
    unit_cost_cents: 10_000,
  };
  return {
    getSupabase: () => mock.supabase as never,
    getTemplateGraph: async () => testGraph(),
    getCatalogItems: async () => [cat],
    getResolvedPolicy: async () => CONFIGURED_RESOLUTION,
    loadProposalCompanyContext: async () => ({
      core: TEST_COMPANY_CORE,
      branding: null,
      brandingLoadOk: true,
    }),
    loadProposalCustomerContext: async () => ({
      customer_name: "Jane",
      customer_email: "jane@example.com",
      customer_phone: "918-555-0200",
      customer_address: "99 Mailing Ln",
    }),
  };
}

describe("proposalScopeDecisionStore", () => {
  test("upsertDraftScopeDecision inserts and reads back", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: readyContext(),
      },
      deps
    );

    const runtimeOption = mock.state.tables.proposal_options[0] as Record<string, unknown>;
    const saved = await upsertDraftScopeDecision(
      {
        company_id: COMPANY_ID,
        proposal_id: created.proposal.id,
        proposal_option_id: runtimeOption.id as string,
        decision_type: "manual_quantity",
        source_template_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        payload: { quantity: 19 },
      },
      deps
    );

    assert.equal(saved.decisionType, "manual_quantity");
    assert.equal(saved.payload.quantity, 19);

    const byOption = await getScopeDecisionsForProposalOption(
      COMPANY_ID,
      runtimeOption.id as string,
      undefined,
      deps
    );
    assert.equal(byOption.length, 1);

    const byVersion = await getScopeDecisionsForDraftVersion(
      COMPANY_ID,
      created.versionId,
      undefined,
      deps
    );
    assert.equal(byVersion.length, 1);
  });

  test("upsert updates existing active decision for same target", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      deps
    );
    const runtimeOption = mock.state.tables.proposal_options[0] as Record<string, unknown>;

    await upsertDraftScopeDecision(
      {
        company_id: COMPANY_ID,
        proposal_id: created.proposal.id,
        proposal_option_id: runtimeOption.id as string,
        decision_type: "manual_quantity",
        source_template_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        payload: { quantity: 10 },
      },
      deps
    );

    await upsertDraftScopeDecision(
      {
        company_id: COMPANY_ID,
        proposal_id: created.proposal.id,
        proposal_option_id: runtimeOption.id as string,
        decision_type: "manual_quantity",
        source_template_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        payload: { quantity: 12 },
      },
      deps
    );

    assert.equal(mock.state.tables.proposal_option_scope_decisions.length, 1);
    const row = mock.state.tables.proposal_option_scope_decisions[0] as Record<string, unknown>;
    assert.equal((row.payload_json as { quantity: number }).quantity, 12);
  });

  test("clearDraftScopeDecision deactivates row", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      deps
    );
    const runtimeOption = mock.state.tables.proposal_options[0] as Record<string, unknown>;

    const saved = await upsertDraftScopeDecision(
      {
        company_id: COMPANY_ID,
        proposal_id: created.proposal.id,
        proposal_option_id: runtimeOption.id as string,
        decision_type: "manual_quantity",
        source_template_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        payload: { quantity: 10 },
      },
      deps
    );

    await clearDraftScopeDecision(
      {
        company_id: COMPANY_ID,
        proposal_id: created.proposal.id,
        decision_id: saved.id,
      },
      deps
    );

    const active = await getScopeDecisionsForProposalOption(
      COMPANY_ID,
      runtimeOption.id as string,
      undefined,
      deps
    );
    assert.equal(active.length, 0);
    assert.equal(
      (mock.state.tables.proposal_option_scope_decisions[0] as Record<string, unknown>).active,
      false
    );
  });

  test("rejects invalid source_template_item_id", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      deps
    );
    const runtimeOption = mock.state.tables.proposal_options[0] as Record<string, unknown>;

    await assert.rejects(
      () =>
        upsertDraftScopeDecision(
          {
            company_id: COMPANY_ID,
            proposal_id: created.proposal.id,
            proposal_option_id: runtimeOption.id as string,
            decision_type: "manual_quantity",
            source_template_item_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            payload: { quantity: 10 },
          },
          deps
        ),
      (err: unknown) => err instanceof ProposalRecordStoreError
    );
  });
});
