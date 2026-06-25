/**
 * 3J2B3 — Programmatic tests for proposalRecordStore.ts (mocked Supabase).
 *
 * Run: npx tsx --test app/lib/proposalRecordStore.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type { CompanyPricingPolicyResolution } from "./companyPricingPolicy";
import type { CompanyProfile } from "./companyProfile";
import type { CompanyBrandingExtendedFields } from "./companyBrandingProfileStore";
import type { MeasurementProposalHandoff } from "./measurementProposalHandoff";
import type { MeasurementQuantityMap } from "./measurementTypes";
import type { ProposalQuantityPreviewContext } from "./proposalBuilderPreview";
import {
  buildDraftPricingRefreshGraphSnapshotFromTables,
  PERSIST_DRAFT_PRICING_REFRESH_RPC_V1,
  persistDraftPricingRefreshSequential,
  validateDraftPricingRefreshGraphIntegrity,
  type DraftPricingRefreshPersistPayload,
} from "./proposalDraftPricingRefreshPersistence";
import {
  PERSIST_DRAFT_PROPOSAL_CREATE_RPC_V1,
  persistDraftProposalCreateSequential,
  type DraftProposalCreatePersistPayload,
} from "./proposalDraftCreatePersistence";
import type { ProposalSendFreezePersistPayload } from "./proposalSendFreezePersistence";
import {
  PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1,
} from "./proposalSendFreezeRpcPersistence";
import {
  DEFAULT_PROFITABILITY_TYPE,
  DEFAULT_QUANTITY_ROUNDING,
  DEFAULT_WASTE_MODEL,
  type PricingPolicy,
} from "./proposalPricingTypes";
import {
  appendProposalEvent,
  assertLineInsertRowCustomerSafe,
  buildDraftInstantiateInputFromPreview,
  buildPageIdByTemplateSectionId,
  CREATE_DRAFT_WRITE_STEPS,
  CREATE_DRAFT_RPC_PERSIST_STEP,
  createDraftProposal,
  freezeDraftToSentSnapshot,
  getDraftGraph,
  listProposalsForJob,
  ProposalRecordStoreError,
  PROPOSAL_SEND_FREEZE_RPC_PERSIST_STEP,
  refreshDraftPricing,
  sanitizeEffectiveMarginPct,
  updateDraftProposalPageContent,
  updateDraftProposalPageSettings,
  updateDraftProposalPageVisibility,
  updateDraftSelectedOption,
  type ProposalRecordStoreDeps,
} from "./proposalRecordStore";
import { buildProposalBuilderPricingPreview } from "./proposalBuilderPricingPreview";
import { deriveProposalPricingStale } from "./proposalStaleness";
import { PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS } from "./proposalLineSnapshotTypes";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type {
  ProposalTemplateItem,
  ProposalTemplateOption,
  ProposalTemplateSection,
} from "./proposalTemplateTypes";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";
const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";
const POLICY_ID = "44444444-4444-4444-8444-444444444444";
const CUSTOMER_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_CUSTOMER_ID = "66666666-6666-4666-8666-666666666666";

const TEST_COMPANY_CORE: CompanyProfile = {
  companyName: "Summit Roofing",
  phone: "918-555-0100",
  email: "hello@summit.com",
  license: "OK-12345",
  logoDataUrl: "data:image/png;base64,abc",
  notificationsEmail: "",
};

const TEST_COMPANY_BRANDING: CompanyBrandingExtendedFields = {
  address: "456 HQ Blvd",
  website: "https://summitroofing.com",
  brandPrimaryColor: "#112233",
  brandSecondaryColor: "#445566",
  showLicenseOnCover: true,
};

const CONFIGURED_POLICY: PricingPolicy = {
  profitabilityType: DEFAULT_PROFITABILITY_TYPE,
  defaultProfitabilityPct: 35,
  minimumProfitabilityPct: 25,
  quantityRounding: DEFAULT_QUANTITY_ROUNDING,
  wasteModel: DEFAULT_WASTE_MODEL,
  discount: null,
  tax: { salesTaxRatePct: 8, materialPurchaseTaxRatePct: null },
  subtotalOverrideCents: null,
};

const CONFIGURED_RESOLUTION: CompanyPricingPolicyResolution = {
  configured: true,
  source: "company",
  policy: CONFIGURED_POLICY,
  reason: null,
};

const UNCONFIGURED_RESOLUTION: CompanyPricingPolicyResolution = {
  configured: false,
  source: "missing",
  policy: null,
  reason: "Company pricing policy is not configured.",
};

type MockOp = {
  table: string;
  action: "insert" | "update" | "delete" | "select" | "rpc";
  payload?: unknown;
};

type MockRpcCall = {
  name: string;
  args: Record<string, unknown> | undefined;
};

function withRefreshPricingSequentialEnabled<T>(fn: () => Promise<T>): Promise<T> {
  const priorSequential = process.env.USE_REFRESH_DRAFT_PRICING_SEQUENTIAL;
  const priorLegacyRpc = process.env.USE_REFRESH_DRAFT_PRICING_RPC;
  const priorLegacyPublic = process.env.NEXT_PUBLIC_USE_REFRESH_DRAFT_PRICING_RPC;
  process.env.USE_REFRESH_DRAFT_PRICING_SEQUENTIAL = "1";
  delete process.env.USE_REFRESH_DRAFT_PRICING_RPC;
  delete process.env.NEXT_PUBLIC_USE_REFRESH_DRAFT_PRICING_RPC;
  return fn().finally(() => {
    if (priorSequential !== undefined) {
      process.env.USE_REFRESH_DRAFT_PRICING_SEQUENTIAL = priorSequential;
    } else {
      delete process.env.USE_REFRESH_DRAFT_PRICING_SEQUENTIAL;
    }
    if (priorLegacyRpc !== undefined) {
      process.env.USE_REFRESH_DRAFT_PRICING_RPC = priorLegacyRpc;
    } else {
      delete process.env.USE_REFRESH_DRAFT_PRICING_RPC;
    }
    if (priorLegacyPublic !== undefined) {
      process.env.NEXT_PUBLIC_USE_REFRESH_DRAFT_PRICING_RPC = priorLegacyPublic;
    } else {
      delete process.env.NEXT_PUBLIC_USE_REFRESH_DRAFT_PRICING_RPC;
    }
  });
}

function withCreateDraftProposalSequentialEnabled<T>(fn: () => Promise<T>): Promise<T> {
  const priorSequential = process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL;
  process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL = "1";
  return fn().finally(() => {
    if (priorSequential !== undefined) {
      process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL = priorSequential;
    } else {
      delete process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL;
    }
  });
}

function withCreateDraftProposalDefaultPath<T>(fn: () => Promise<T>): Promise<T> {
  const priorSequential = process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL;
  delete process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL;
  return fn().finally(() => {
    if (priorSequential !== undefined) {
      process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL = priorSequential;
    } else {
      delete process.env.USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL;
    }
  });
}

function withRefreshPricingDefaultPath<T>(fn: () => Promise<T>): Promise<T> {
  const priorSequential = process.env.USE_REFRESH_DRAFT_PRICING_SEQUENTIAL;
  const priorLegacyRpc = process.env.USE_REFRESH_DRAFT_PRICING_RPC;
  const priorLegacyPublic = process.env.NEXT_PUBLIC_USE_REFRESH_DRAFT_PRICING_RPC;
  delete process.env.USE_REFRESH_DRAFT_PRICING_SEQUENTIAL;
  delete process.env.USE_REFRESH_DRAFT_PRICING_RPC;
  delete process.env.NEXT_PUBLIC_USE_REFRESH_DRAFT_PRICING_RPC;
  return fn().finally(() => {
    if (priorSequential !== undefined) {
      process.env.USE_REFRESH_DRAFT_PRICING_SEQUENTIAL = priorSequential;
    } else {
      delete process.env.USE_REFRESH_DRAFT_PRICING_SEQUENTIAL;
    }
    if (priorLegacyRpc !== undefined) {
      process.env.USE_REFRESH_DRAFT_PRICING_RPC = priorLegacyRpc;
    } else {
      delete process.env.USE_REFRESH_DRAFT_PRICING_RPC;
    }
    if (priorLegacyPublic !== undefined) {
      process.env.NEXT_PUBLIC_USE_REFRESH_DRAFT_PRICING_RPC = priorLegacyPublic;
    } else {
      delete process.env.NEXT_PUBLIC_USE_REFRESH_DRAFT_PRICING_RPC;
    }
  });
}

function withProposalSendFreezeRpcEnabled<T>(fn: () => Promise<T>): Promise<T> {
  const prior = process.env.USE_PROPOSAL_SEND_FREEZE_RPC;
  process.env.USE_PROPOSAL_SEND_FREEZE_RPC = "1";
  return fn().finally(() => {
    if (prior === undefined) {
      delete process.env.USE_PROPOSAL_SEND_FREEZE_RPC;
    } else {
      process.env.USE_PROPOSAL_SEND_FREEZE_RPC = prior;
    }
  });
}

function withProposalSendFreezeRpcDisabled<T>(fn: () => Promise<T>): Promise<T> {
  const prior = process.env.USE_PROPOSAL_SEND_FREEZE_RPC;
  delete process.env.USE_PROPOSAL_SEND_FREEZE_RPC;
  return fn().finally(() => {
    if (prior === undefined) {
      delete process.env.USE_PROPOSAL_SEND_FREEZE_RPC;
    } else {
      process.env.USE_PROPOSAL_SEND_FREEZE_RPC = prior;
    }
  });
}

type MockState = {
  ops: MockOp[];
  tables: Record<string, Record<string, unknown>[]>;
  idSeq: number;
};

const MOCK_UUID_POOL: string[] = [];

function nextUuid(state: MockState, _prefix: number): string {
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
  options: { versionKind?: string } | undefined,
  mode: "many" | "one"
) {
  if (pendingInsert) {
    const base = clone(
      (Array.isArray(pendingInsert) ? pendingInsert[0] : pendingInsert) as Record<string, unknown>
    );
    const tableLen = state.tables[table]?.length ?? 0;
    const id = nextUuid(state, tableLen);
    const row: Record<string, unknown> = {
      id,
      created_at: "2026-06-06T00:00:00Z",
      updated_at: "2026-06-06T00:00:00Z",
      ...base,
    };
    if (table === "proposal_versions" && options?.versionKind) {
      row.version_kind = options.versionKind;
    }
    state.tables[table] = [...(state.tables[table] ?? []), row];
    return { data: mode === "one" ? row : [row], error: null };
  }

  let rows = queryTable(table, filters, state, isNullFilter);
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

function queryTable(
  table: string,
  filters: Record<string, unknown>,
  state: MockState,
  isNullFilter: { column: string } | null
) {
  let rows = state.tables[table] ?? [];
  rows = rows.filter((row) => {
    const record = row as Record<string, unknown>;
    if (isNullFilter && record[isNullFilter.column] != null) {
      return false;
    }
    return Object.entries(filters).every(([key, value]) => {
      if (key.startsWith("__in_")) {
        const column = key.slice(5);
        const ids = value as unknown[];
        return ids.includes(record[column]);
      }
      return record[key] === value;
    });
  });
  return rows;
}

function createMockSupabase(options?: {
  rejectCustomer?: boolean;
  versionKind?: string;
  failOn?: { table: string; action: "insert" | "update" | "delete" };
  shouldFailOn?: () => boolean;
  rpcFailOn?: string;
  rpcFailOnFor?: string;
  rpcMalformedFor?: string;
  rpcMalformedData?: unknown;
}) {
  const state: MockState = {
    ops: [],
    tables: {
      customers: [
        {
          id: CUSTOMER_ID,
          company_id: COMPANY_ID,
          name: "Jane Smith",
          email: "jane@example.com",
          phone: "918-555-0200",
          address: "99 Mailing Ln",
        },
        {
          id: OTHER_CUSTOMER_ID,
          company_id: COMPANY_ID,
          name: "Other Customer",
          email: "other@example.com",
        },
      ],
      jobs: [
        {
          id: JOB_ID,
          company_id: COMPANY_ID,
          customer_id: CUSTOMER_ID,
          job_name: "Smith Roof",
          address_formatted: "1 Main St",
          customer_name: "Wrong Job Denorm Name",
          customer_email: "wrong@job.com",
          customer_phone: "555-0000",
        },
      ],
      company_pricing_policies: [{ id: POLICY_ID, company_id: COMPANY_ID }],
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

  if (options?.rejectCustomer) {
    state.tables.customers = [];
  }

  function from(table: string) {
    const filters: Record<string, unknown> = {};
    let pendingInsert: unknown;
    let pendingUpdate: unknown;
    let pendingDelete = false;
    let orderSpec: { column: string; ascending: boolean } | null = null;
    let isNullFilter: { column: string } | null = null;
    let terminal: "many" | "one" | "maybeSingle" | "single" = "many";

    const chain = {
      select(_cols?: string) {
        state.ops.push({ table, action: "select" });
        return chain;
      },
      insert(data: unknown) {
        if (
          options?.failOn?.table === table &&
          options.failOn.action === "insert" &&
          (options.shouldFailOn?.() ?? true)
        ) {
          throw new Error(`mock failOn ${table}.insert`);
        }
        pendingInsert = data;
        state.ops.push({ table, action: "insert", payload: data });
        return chain;
      },
      update(data: unknown) {
        if (
          options?.failOn?.table === table &&
          options.failOn.action === "update"
        ) {
          throw new Error(`mock failOn ${table}.update`);
        }
        pendingUpdate = data;
        state.ops.push({ table, action: "update", payload: data });
        return chain;
      },
      delete() {
        if (
          options?.failOn?.table === table &&
          options.failOn.action === "delete"
        ) {
          throw new Error(`mock failOn ${table}.delete`);
        }
        pendingDelete = true;
        state.ops.push({ table, action: "delete" });
        return chain;
      },
      eq(column: string, value: unknown) {
        filters[column] = value;
        return chain;
      },
      is(column: string, value: string) {
        if (value === "null") {
          isNullFilter = { column };
        }
        return chain;
      },
      in(column: string, values: unknown[]) {
        filters[`__in_${column}`] = values;
        return chain;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        orderSpec = { column, ascending: opts?.ascending ?? true };
        return chain;
      },
      maybeSingle: async () => {
        terminal = "maybeSingle";
        const result = executeQuery(
          table,
          state,
          filters,
          pendingInsert,
          pendingUpdate,
          pendingDelete,
          orderSpec,
          isNullFilter,
          options,
          "one"
        );
        pendingInsert = undefined;
        pendingUpdate = undefined;
        pendingDelete = false;
        return result;
      },
      single: async () => {
        terminal = "single";
        const result = await chain.maybeSingle();
        if (!result.data) {
          return { data: null, error: { message: "not found" } };
        }
        return result;
      },
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
            options,
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

  const rpcCalls: MockRpcCall[] = [];

  async function rpc(name: string, args?: Record<string, unknown>) {
    rpcCalls.push({ name, args });
    state.ops.push({ table: "__rpc__", action: "rpc", payload: { name, args } });

    if (options?.rpcFailOn) {
      if (!options.rpcFailOnFor || options.rpcFailOnFor === name) {
        return { data: null, error: { message: options.rpcFailOn } };
      }
    }

    if (name === PERSIST_DRAFT_PRICING_REFRESH_RPC_V1) {
      const payload = args?.p_payload as DraftPricingRefreshPersistPayload | undefined;
      if (payload) {
        await persistDraftPricingRefreshSequential({ from, rpc } as never, payload);
      }
      return { data: { ok: true }, error: null };
    }

    if (name === PERSIST_DRAFT_PROPOSAL_CREATE_RPC_V1) {
      const payload = args?.p_payload as DraftProposalCreatePersistPayload | undefined;
      if (!payload) {
        return { data: null, error: { message: "missing create payload" } };
      }
      const result = await persistDraftProposalCreateSequential({ from, rpc } as never, payload);
      return { data: result, error: null };
    }

    if (name === PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1) {
      if (options?.rpcMalformedFor === name) {
        return {
          data: options.rpcMalformedData ?? { ok: true, proposal_id: "not-a-uuid" },
          error: null,
        };
      }

      const payload = args?.p_payload as ProposalSendFreezePersistPayload | undefined;
      if (!payload) {
        return { data: null, error: { message: "missing send-freeze payload" } };
      }

      const proposal = state.tables.proposals.find(
        (row) => row.id === payload.proposal_id
      ) as Record<string, unknown> | undefined;
      if (proposal) {
        proposal.latest_sent_version_id = payload.sent_version_id;
      }

      return {
        data: {
          ok: true,
          proposal_id: payload.proposal_id,
          draft_version_id: payload.draft_version_id,
          sent_version_id: payload.sent_version_id,
          version_number: payload.version_number,
          page_count: payload.pages.length,
          option_count: payload.options.length,
          latest_sent_version_id: payload.sent_version_id,
        },
        error: null,
      };
    }

    return { data: { ok: true }, error: null };
  }

  return {
    supabase: {
      from,
      rpc,
    },
    state,
    rpcCalls,
  };
}

async function seedSendFreezeReadyProposal(
  mock: ReturnType<typeof createMockSupabase>,
  deps: ProposalRecordStoreDeps = storeDeps(mock)
) {
  const quantityContext = readyContext();
  const created = await createDraftProposal(
    {
      company_id: COMPANY_ID,
      job_id: JOB_ID,
      template_id: TEMPLATE_ID,
      customer_id: CUSTOMER_ID,
      quantity_context: quantityContext,
    },
    deps
  );
  await refreshDraftPricing(
    COMPANY_ID,
    created.proposal.id,
    { quantity_context: quantityContext },
    deps
  );
  return created;
}

function catalog(overrides: Partial<CatalogItem> & Pick<CatalogItem, "id">): CatalogItem {
  return {
    company_id: COMPANY_ID,
    name: overrides.name ?? overrides.id,
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "cost_plus_margin",
    customer_visibility: "customer_visible",
    active: true,
    unit_cost_cents: 10_000,
    ...overrides,
  };
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
      {
        id: "99999999-9999-4999-8999-999999999999",
        template_id: TEMPLATE_ID,
        option_id: "77777777-7777-4777-8777-777777777777",
        kind: "terms",
        name: "Terms",
        sort_order: 1,
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
      roof_squares: 20,
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

/** readyContext at an explicit (adjusted) roof-square count for 2300→2500 goldens. */
function contextWithSquares(adjusted: number): ProposalQuantityPreviewContext {
  const base = readyContext();
  base.measurementHandoff!.quantities.roof_squares = adjusted;
  base.measurementHandoff!.quantities.adjusted_roof_squares = adjusted;
  base.measurementHandoff!.quantities.roof_area_sqft = adjusted * 100;
  base.quantityMap = { shingles_squares: adjusted };
  return base;
}

function optionTotalForVersion(
  mock: ReturnType<typeof createMockSupabase>
): number {
  const option = mock.state.tables.proposal_options[0] as Record<string, unknown>;
  return Number(option.customer_total_cents ?? 0);
}

function firstLineTotalForVersion(
  mock: ReturnType<typeof createMockSupabase>
): { quantity: number; total: number } {
  const line = mock.state.tables.proposal_line_items[0] as Record<string, unknown>;
  return {
    quantity: Number(line.quantity ?? 0),
    total: Number(line.customer_line_total_cents ?? 0),
  };
}

function storeDeps(
  mock: ReturnType<typeof createMockSupabase>,
  resolution: CompanyPricingPolicyResolution = CONFIGURED_RESOLUTION,
  companyContext?: {
    core?: CompanyProfile;
    branding?: CompanyBrandingExtendedFields | null;
    brandingLoadOk?: boolean;
  }
): ProposalRecordStoreDeps {
  const g = testGraph();
  const cat = catalog({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
  return {
    getSupabase: () => mock.supabase as never,
    getTemplateGraph: async () => g,
    getCatalogItems: async () => [cat],
    getResolvedPolicy: async () => resolution,
    loadProposalCompanyContext: async () => ({
      core: companyContext?.core ?? TEST_COMPANY_CORE,
      branding:
        companyContext && "branding" in companyContext
          ? (companyContext.branding ?? null)
          : TEST_COMPANY_BRANDING,
      brandingLoadOk: companyContext?.brandingLoadOk ?? true,
    }),
  };
}

describe("sanitizeEffectiveMarginPct", () => {
  test("effective_margin_pct >= 100 is clamped to 99.9999 before DB write", () => {
    assert.equal(sanitizeEffectiveMarginPct(100), 99.9999);
    assert.equal(sanitizeEffectiveMarginPct(150), 99.9999);
  });

  test("null stays null; negative throws", () => {
    assert.equal(sanitizeEffectiveMarginPct(null), null);
    assert.throws(() => sanitizeEffectiveMarginPct(-1), ProposalRecordStoreError);
  });
});

describe("buildPageIdByTemplateSectionId", () => {
  test("maps section id to runtime page id for page_id linking", () => {
    const map = buildPageIdByTemplateSectionId([
      { id: "page-1", source_template_section_id: "sec-a" },
      { id: "page-2", source_template_section_id: "sec-b" },
    ]);
    assert.equal(map.get("sec-a"), "page-1");
    assert.equal(map.get("sec-b"), "page-2");
  });
});

describe("createDraftProposal", () => {
  test("sequential escape hatch writes tables in correct order", async () => {
    await withCreateDraftProposalSequentialEnabled(async () => {
      const mock = createMockSupabase();
      const result = await createDraftProposal(
        {
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          template_id: TEMPLATE_ID,
          customer_id: CUSTOMER_ID,
        },
        storeDeps(mock)
      );

      assert.deepEqual(result.writeSteps, [...CREATE_DRAFT_WRITE_STEPS]);
      const insertTables = mock.state.ops
        .filter((op) => op.action === "insert")
        .map((op) => op.table);
      const firstProposalIdx = insertTables.indexOf("proposals");
      const versionIdx = insertTables.indexOf("proposal_versions");
      const pagesIdx = insertTables.indexOf("proposal_pages");
      const optionsIdx = insertTables.indexOf("proposal_options");
      const linesIdx = insertTables.indexOf("proposal_line_items");
      const summariesIdx = insertTables.indexOf("proposal_internal_summaries");
      assert.ok(firstProposalIdx < versionIdx);
      assert.ok(versionIdx < pagesIdx);
      assert.ok(pagesIdx < optionsIdx);
      assert.ok(optionsIdx < linesIdx);
      assert.ok(linesIdx <= summariesIdx);
    });
  });

  test("default create calls persist_draft_proposal_create_v1 and reloads graph", async () => {
    await withCreateDraftProposalDefaultPath(async () => {
      const mock = createMockSupabase();
      const result = await createDraftProposal(
        {
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          template_id: TEMPLATE_ID,
          customer_id: CUSTOMER_ID,
        },
        storeDeps(mock)
      );

      assert.deepEqual(result.writeSteps, [CREATE_DRAFT_RPC_PERSIST_STEP]);
      assert.equal(mock.rpcCalls.length, 1);
      assert.equal(mock.rpcCalls[0]!.name, PERSIST_DRAFT_PROPOSAL_CREATE_RPC_V1);
      assert.ok(mock.rpcCalls[0]!.args?.p_payload);
      assert.equal(result.proposal.current_draft_version_id, result.versionId);
      assert.equal(result.proposal.selected_option_id, result.selectedOptionId);
      assert.ok(result.proposal.id);
      assert.ok(mock.state.tables.proposals.length > 0);
      assert.ok(mock.state.tables.proposal_options.length > 0);
      assert.ok(mock.state.tables.proposal_line_items.length > 0);
    });
  });

  test("default create surfaces RPC failure as ProposalRecordStoreError without sequential fallback", async () => {
    await withCreateDraftProposalDefaultPath(async () => {
      const mock = createMockSupabase({
        rpcFailOn: "function does not exist",
        rpcFailOnFor: PERSIST_DRAFT_PROPOSAL_CREATE_RPC_V1,
      });
      const proposalsBefore = mock.state.tables.proposals.length;

      await assert.rejects(
        () =>
          createDraftProposal(
            {
              company_id: COMPANY_ID,
              job_id: JOB_ID,
              template_id: TEMPLATE_ID,
              customer_id: CUSTOMER_ID,
            },
            storeDeps(mock)
          ),
        (error: unknown) => {
          assert.ok(error instanceof ProposalRecordStoreError);
          assert.match(String(error.message), /function does not exist/);
          return true;
        }
      );

      assert.equal(mock.rpcCalls.length, 1);
      assert.equal(mock.state.tables.proposals.length, proposalsBefore);
    });
  });

  test("default create uses template title fallback when input title omitted", async () => {
    await withCreateDraftProposalDefaultPath(async () => {
      const mock = createMockSupabase();
      await createDraftProposal(
        {
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          template_id: TEMPLATE_ID,
        },
        storeDeps(mock)
      );

      const header = mock.state.tables.proposals[0] as Record<string, unknown>;
      assert.equal(header.title, "Standard Package");
    });
  });

  test("sequential escape hatch create uses direct table writes (no create RPC)", async () => {
    await withCreateDraftProposalSequentialEnabled(async () => {
      const mock = createMockSupabase();
      await createDraftProposal(
        {
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          template_id: TEMPLATE_ID,
        },
        storeDeps(mock)
      );

      assert.equal(mock.rpcCalls.length, 0);
      assert.ok(
        mock.state.ops.some(
          (op) => op.table === "proposals" && op.action === "insert"
        )
      );
      assert.ok(
        mock.state.ops.some(
          (op) => op.table === "proposal_line_items" && op.action === "insert"
        )
      );
    });
  });

  test("sequential create line insert failure leaves partial graph (documents non-atomic risk)", async () => {
    await withCreateDraftProposalSequentialEnabled(async () => {
      const mock = createMockSupabase({
        failOn: { table: "proposal_line_items", action: "insert" },
      });

      await assert.rejects(
        () =>
          createDraftProposal(
            {
              company_id: COMPANY_ID,
              job_id: JOB_ID,
              template_id: TEMPLATE_ID,
            },
            storeDeps(mock)
          ),
        /mock failOn proposal_line_items\.insert/
      );

      assert.ok(mock.state.tables.proposals.length > 0);
      assert.ok(mock.state.tables.proposal_versions.length > 0);
      assert.equal(mock.state.tables.proposal_line_items.length, 0);
    });
  });

  test("inserts proposal header with company_id, job_id, template_id, pricing_policy_id, status draft", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      storeDeps(mock)
    );

    const header = mock.state.tables.proposals[0] as Record<string, unknown>;
    assert.equal(header.company_id, COMPANY_ID);
    assert.equal(header.job_id, JOB_ID);
    assert.equal(header.template_id, TEMPLATE_ID);
    assert.equal(header.pricing_policy_id, POLICY_ID);
    assert.equal(header.status, "draft");
  });

  test("inserts proposal_versions v1 draft with frozen_at null", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      storeDeps(mock)
    );

    const version = mock.state.tables.proposal_versions[0] as Record<string, unknown>;
    assert.equal(version.version_number, 1);
    assert.equal(version.version_kind, "draft");
    assert.equal(version.frozen_at, null);
  });

  test("stamps company branding fields into context_echo at create", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      storeDeps(mock)
    );

    const version = mock.state.tables.proposal_versions[0] as Record<string, unknown>;
    const echo = version.context_echo as Record<string, unknown>;
    assert.equal(echo.company_name, "Summit Roofing");
    assert.equal(echo.company_logo_url, "data:image/png;base64,abc");
    assert.equal(echo.company_phone, "918-555-0100");
    assert.equal(echo.company_license, "OK-12345");
    assert.equal(echo.company_address, "456 HQ Blvd");
    assert.equal(echo.company_website, "https://summitroofing.com");
    assert.equal(echo.brand_primary_color, "#112233");
    assert.equal(echo.brand_secondary_color, "#445566");
    assert.equal(echo.show_license_on_cover, true);
    assert.equal(echo.address_formatted, "1 Main St");
    assert.notEqual(echo.company_address, echo.address_formatted);
    assert.equal("notifications_email" in echo, false);
  });

  test("stamps customer identity from customers row at create", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      storeDeps(mock)
    );

    const echo = (mock.state.tables.proposal_versions[0] as Record<string, unknown>)
      .context_echo as Record<string, unknown>;
    assert.equal(echo.customer_id, CUSTOMER_ID);
    assert.equal(echo.customer_name, "Jane Smith");
    assert.equal(echo.customer_email, "jane@example.com");
    assert.equal(echo.customer_phone, "918-555-0200");
    assert.equal(echo.customer_address, "99 Mailing Ln");
    assert.equal(echo.address_formatted, "1 Main St");
    assert.notEqual(echo.customer_address, echo.address_formatted);
    assert.notEqual(echo.customer_name, "Wrong Job Denorm Name");
    assert.notEqual(echo.customer_email, "wrong@job.com");
  });

  test("rejects payload customer_id mismatch with job customer_id", async () => {
    const mock = createMockSupabase();
    await assert.rejects(
      () =>
        createDraftProposal(
          {
            company_id: COMPANY_ID,
            job_id: JOB_ID,
            template_id: TEMPLATE_ID,
            customer_id: OTHER_CUSTOMER_ID,
          },
          storeDeps(mock)
        ),
      /does not match job customer_id/
    );
  });

  test("fail-soft null customer echo when loader returns empty slice", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        customer_id: CUSTOMER_ID,
      },
      {
        ...storeDeps(mock),
        loadProposalCustomerContext: async () => ({
          customer_name: null,
          customer_email: null,
          customer_phone: null,
          customer_address: null,
        }),
      }
    );

    const echo = (mock.state.tables.proposal_versions[0] as Record<string, unknown>)
      .context_echo as Record<string, unknown>;
    assert.equal(echo.customer_id, CUSTOMER_ID);
    assert.equal(echo.customer_name, null);
    assert.equal(echo.customer_email, null);
    assert.equal(echo.customer_phone, null);
    assert.equal(echo.customer_address, null);
    assert.equal(echo.address_formatted, "1 Main St");
  });

  test("missing branding row stamps core fields with null extended branding", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      storeDeps(mock, CONFIGURED_RESOLUTION, { branding: null })
    );

    const echo = (mock.state.tables.proposal_versions[0] as Record<string, unknown>)
      .context_echo as Record<string, unknown>;
    assert.equal(echo.company_name, "Summit Roofing");
    assert.equal(echo.company_phone, "918-555-0100");
    assert.equal(echo.company_address, null);
    assert.equal(echo.company_website, null);
    assert.equal(echo.brand_primary_color, null);
    assert.equal(echo.show_license_on_cover, false);
  });

  test("inserts pages before line items", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      storeDeps(mock)
    );

    assert.ok(mock.state.tables.proposal_pages.length >= 1);
    assert.ok(mock.state.tables.proposal_line_items.length >= 1);
    const pageOpIdx = mock.state.ops.findIndex(
      (op) => op.table === "proposal_pages" && op.action === "insert"
    );
    const lineOpIdx = mock.state.ops.findIndex(
      (op) => op.table === "proposal_line_items" && op.action === "insert"
    );
    assert.ok(pageOpIdx >= 0 && lineOpIdx > pageOpIdx);
  });

  test("links line page_id after pages inserted", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      storeDeps(mock)
    );

    const estimatePage = mock.state.tables.proposal_pages.find(
      (p) => p.page_type === "estimate"
    ) as Record<string, unknown>;
    assert.ok(estimatePage);
    const line = mock.state.tables.proposal_line_items[0] as Record<string, unknown>;
    assert.equal(line.page_id, estimatePage.id);
    assert.equal(line.section_id, "88888888-8888-4888-8888-888888888888");
  });

  test("inserts options with customer_subtotal_cents / sales_tax_cents / customer_total_cents", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: readyContext(),
      },
      storeDeps(mock)
    );

    const option = mock.state.tables.proposal_options[0] as Record<string, unknown>;
    assert.equal(typeof option.customer_subtotal_cents, "number");
    assert.ok(option.customer_subtotal_cents != null);
    assert.ok("sales_tax_cents" in option);
    assert.ok("customer_total_cents" in option);
    assert.ok(!("subtotal_cents" in option));
    assert.ok(!("tax_cents" in option));
    assert.ok(!("total_cents" in option));
  });

  test("inserts line items with no forbidden internal keys", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: readyContext(),
      },
      storeDeps(mock)
    );

    for (const line of mock.state.tables.proposal_line_items) {
      const keys = Object.keys(line);
      for (const forbidden of [...PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS, "policy_echo_json"]) {
        assert.ok(!keys.includes(forbidden), `forbidden key on line insert: ${forbidden}`);
      }
      assertLineInsertRowCustomerSafe(line as Record<string, unknown>);
    }
  });

  test("inserts internal summaries separately", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: readyContext(),
      },
      storeDeps(mock)
    );

    assert.equal(mock.state.tables.proposal_internal_summaries.length, 1);
    const summary = mock.state.tables.proposal_internal_summaries[0] as Record<string, unknown>;
    assert.ok("internal_cost_cents" in summary);
    assert.ok("internal_profit_cents" in summary);
    assert.ok("effective_margin_pct" in summary);
    assert.ok("policy_echo_json" in summary);
  });

  test("updates current_draft_version_id and selected_option_id", async () => {
    const mock = createMockSupabase();
    const result = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: readyContext(),
      },
      storeDeps(mock)
    );

    const header = mock.state.tables.proposals[0] as Record<string, unknown>;
    assert.equal(header.current_draft_version_id, result.versionId);
    assert.equal(header.selected_option_id, result.selectedOptionId);
  });

  test("appends created event", async () => {
    const mock = createMockSupabase();
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      storeDeps(mock)
    );

    const event = mock.state.tables.proposal_events.find(
      (e) => e.event_type === "created"
    ) as Record<string, unknown>;
    assert.ok(event);
    assert.equal(event.company_id, COMPANY_ID);
  });

  test("updates jobs.active_proposal_id only for same company/job", async () => {
    const mock = createMockSupabase();
    const result = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      storeDeps(mock)
    );

    const jobUpdate = mock.state.ops.find(
      (op) => op.table === "jobs" && op.action === "update"
    );
    assert.ok(jobUpdate);
    assert.equal((jobUpdate.payload as Record<string, unknown>).active_proposal_id, result.proposal.id);

    const job = mock.state.tables.jobs[0] as Record<string, unknown>;
    assert.equal(job.active_proposal_id, result.proposal.id);
    assert.equal(job.company_id, COMPANY_ID);
    assert.equal(job.id, JOB_ID);
  });

  test("rejects unconfigured/placeholder policy", async () => {
    const mock = createMockSupabase();
    await assert.rejects(
      () =>
        createDraftProposal(
          {
            company_id: COMPANY_ID,
            job_id: JOB_ID,
            template_id: TEMPLATE_ID,
          },
          storeDeps(mock, UNCONFIGURED_RESOLUTION)
        ),
      /not configured/i
    );
  });

  test("validates customer_id same company or fails closed", async () => {
    const mock = createMockSupabase({ rejectCustomer: true });
    await assert.rejects(
      () =>
        createDraftProposal(
          {
            company_id: COMPANY_ID,
            job_id: JOB_ID,
            template_id: TEMPLATE_ID,
            customer_id: OTHER_CUSTOMER_ID,
          },
          storeDeps(mock)
        ),
      ProposalRecordStoreError
    );
  });
});

describe("refreshDraftPricing", () => {
  test("refuses non-draft version", async () => {
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

    const version = mock.state.tables.proposal_versions[0] as Record<string, unknown>;
    version.version_kind = "sent";

    await assert.rejects(
      () => refreshDraftPricing(COMPANY_ID, created.proposal.id, {}, deps),
      /not mutable/i
    );
  });

  test("updates options/lines/internal summaries but not pages/content", async () => {
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

    const pagesBefore = clone(mock.state.tables.proposal_pages);
    const pageCountBefore = pagesBefore.length;

    await refreshDraftPricing(
      COMPANY_ID,
      created.proposal.id,
      { quantity_context: readyContext() },
      deps
    );

    assert.equal(mock.state.tables.proposal_pages.length, pageCountBefore);
    for (let i = 0; i < pageCountBefore; i += 1) {
      assert.equal(
        mock.state.tables.proposal_pages[i]!.title,
        pagesBefore[i]!.title
      );
    }

    const optionUpdate = mock.state.ops.some(
      (op) => op.table === "proposal_options" && op.action === "update"
    );
    const lineInsert = mock.state.ops.some(
      (op) => op.table === "proposal_line_items" && op.action === "insert"
    );
    const summaryInsert = mock.state.ops.some(
      (op) => op.table === "proposal_internal_summaries" && op.action === "insert"
    );
    assert.ok(optionUpdate);
    assert.ok(lineInsert);
    assert.ok(summaryInsert);
  });

  // Pricing Trust Hardening goldens -------------------------------------------

  test("Golden #3/#8: refresh at higher squares increases line quantity and totals", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: contextWithSquares(23),
      },
      deps
    );

    const before = firstLineTotalForVersion(mock);
    const optionTotalBefore = optionTotalForVersion(mock);
    assert.equal(before.quantity, 23);

    await refreshDraftPricing(
      COMPANY_ID,
      created.proposal.id,
      { quantity_context: contextWithSquares(25) },
      deps
    );

    const after = firstLineTotalForVersion(mock);
    const optionTotalAfter = optionTotalForVersion(mock);
    assert.equal(after.quantity, 25);
    assert.ok(after.total > before.total, "line total should grow with quantity");
    assert.ok(optionTotalAfter > optionTotalBefore, "option total should grow with quantity");
  });

  test("Golden #9: option customer total equals sum of contributing line totals after refresh", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: contextWithSquares(22),
      },
      deps
    );

    await refreshDraftPricing(
      COMPANY_ID,
      created.proposal.id,
      { quantity_context: contextWithSquares(26) },
      deps
    );

    const option = mock.state.tables.proposal_options[0] as Record<string, unknown>;
    const subtotal = Number(option.customer_subtotal_cents ?? 0);
    const lineSum = (mock.state.tables.proposal_line_items as Record<string, unknown>[])
      .filter((l) => l.pricing_status === "priced")
      .reduce((acc, l) => acc + Number(l.customer_line_total_cents ?? 0), 0);
    assert.equal(subtotal, lineSum);

    const total =
      subtotal -
      Number(option.discount_cents ?? 0) +
      Number(option.sales_tax_cents ?? 0);
    assert.equal(Number(option.customer_total_cents ?? 0), total);
  });

  test("Golden #4: refresh preserves selected option", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: contextWithSquares(22),
      },
      deps
    );

    const selectedBefore = (mock.state.tables.proposals[0] as Record<string, unknown>)
      .selected_option_id;

    const graph = await refreshDraftPricing(
      COMPANY_ID,
      created.proposal.id,
      { quantity_context: contextWithSquares(24) },
      deps
    );

    assert.ok(graph);
    assert.equal(graph.proposal.selected_option_id, selectedBefore);
  });

  test("Golden #14: refresh does not create a duplicate proposal/version", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: contextWithSquares(22),
      },
      deps
    );

    assert.equal(mock.state.tables.proposals.length, 1);
    assert.equal(mock.state.tables.proposal_versions.length, 1);

    await refreshDraftPricing(
      COMPANY_ID,
      created.proposal.id,
      { quantity_context: contextWithSquares(24) },
      deps
    );

    assert.equal(mock.state.tables.proposals.length, 1);
    assert.equal(mock.state.tables.proposal_versions.length, 1);
  });

  test("Golden #11: persisted lines stay customer-safe after refresh", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: contextWithSquares(22),
      },
      deps
    );

    await refreshDraftPricing(
      COMPANY_ID,
      created.proposal.id,
      { quantity_context: contextWithSquares(24) },
      deps
    );

    for (const line of mock.state.tables.proposal_line_items as Record<string, unknown>[]) {
      for (const key of PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS) {
        assert.equal(key in line, false, `forbidden key ${key} leaked into line`);
      }
    }
  });

  test("Golden #1/#13: refresh re-stamps context_echo measurement id so staleness clears", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const SNAPSHOT_MEAS = "abababab-abab-4bab-8bab-abababababab";
    const NEW_MEAS = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";

    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        measurement_record_id: SNAPSHOT_MEAS,
        quantity_context: contextWithSquares(23),
      },
      deps
    );

    // Job's selected measurement moved on -> stale before refresh.
    const versionBefore = mock.state.tables.proposal_versions[0] as Record<string, unknown>;
    const echoBefore = versionBefore.context_echo as Record<string, unknown>;
    assert.equal(echoBefore.measurement_record_id, SNAPSHOT_MEAS);
    assert.equal(
      deriveProposalPricingStale({
        snapshotMeasurementId: echoBefore.measurement_record_id as string,
        currentMeasurementId: NEW_MEAS,
      }).stale,
      true
    );

    await refreshDraftPricing(
      COMPANY_ID,
      created.proposal.id,
      {
        quantity_context: contextWithSquares(25),
        measurement_record_id: NEW_MEAS,
        measurement_quantities_display: "25.0 SQ",
      },
      deps
    );

    const versionAfter = mock.state.tables.proposal_versions[0] as Record<string, unknown>;
    const echoAfter = versionAfter.context_echo as Record<string, unknown>;
    assert.equal(echoAfter.measurement_record_id, NEW_MEAS);
    assert.equal(echoAfter.measurement_quantities_display, "25.0 SQ");
    // Other context_echo fields preserved (not wiped).
    assert.equal(echoAfter.job_id, JOB_ID);
    assert.equal(echoAfter.customer_id, CUSTOMER_ID);
    assert.equal(echoAfter.customer_name, "Jane Smith");
    assert.equal(echoAfter.customer_email, "jane@example.com");
    assert.equal(echoAfter.customer_phone, "918-555-0200");
    assert.equal(echoAfter.customer_address, "99 Mailing Ln");
    assert.equal(echoAfter.address_formatted, "1 Main St");
    assert.equal(echoAfter.company_name, "Summit Roofing");
    assert.equal(echoAfter.company_logo_url, "data:image/png;base64,abc");
    assert.equal(echoAfter.company_phone, "918-555-0100");
    assert.equal(echoAfter.company_license, "OK-12345");
    assert.equal(echoAfter.company_address, "456 HQ Blvd");
    assert.equal(echoAfter.company_website, "https://summitroofing.com");
    assert.equal(echoAfter.brand_primary_color, "#112233");
    assert.equal(echoAfter.brand_secondary_color, "#445566");
    assert.equal(echoAfter.show_license_on_cover, true);

    // Proposal header measurement id stays in sync.
    assert.equal(
      (mock.state.tables.proposals[0] as Record<string, unknown>).measurement_record_id,
      NEW_MEAS
    );

    // Staleness now clears.
    assert.equal(
      deriveProposalPricingStale({
        snapshotMeasurementId: echoAfter.measurement_record_id as string,
        currentMeasurementId: NEW_MEAS,
      }).stale,
      false
    );
  });

  test("sequential refresh line insert failure leaves corrupt graph (documents non-atomic risk)", async () => {
    await withRefreshPricingSequentialEnabled(async () => {
      let refreshStarted = false;
      const mock = createMockSupabase({
        failOn: { table: "proposal_line_items", action: "insert" },
        shouldFailOn: () => refreshStarted,
      });
      const deps = storeDeps(mock);
      const created = await createDraftProposal(
        {
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          template_id: TEMPLATE_ID,
          quantity_context: contextWithSquares(22),
        },
        deps
      );

      const linesBefore = mock.state.tables.proposal_line_items.length;
      assert.ok(linesBefore > 0);

      refreshStarted = true;

      await assert.rejects(
        () =>
          refreshDraftPricing(
            COMPANY_ID,
            created.proposal.id,
            { quantity_context: contextWithSquares(24) },
            deps
          ),
        /mock failOn proposal_line_items\.insert/
      );

      assert.equal(mock.state.tables.proposal_line_items.length, 0);

      const snapshot = buildDraftPricingRefreshGraphSnapshotFromTables({
        options: mock.state.tables.proposal_options as Record<string, unknown>[],
        lineItems: mock.state.tables.proposal_line_items as Record<string, unknown>[],
        internalSummaries:
          mock.state.tables.proposal_internal_summaries as Record<string, unknown>[],
      });

      const violations = validateDraftPricingRefreshGraphIntegrity(snapshot);
      assert.ok(
        violations.some((violation) => violation.code === "option_totals_without_lines"),
        "expected corrupt graph when line insert fails after delete"
      );
    });
  });

  test("sequential escape hatch: refresh uses direct table writes (no pricing refresh RPC)", async () => {
    await withRefreshPricingSequentialEnabled(async () => {
      const mock = createMockSupabase();
      const deps = storeDeps(mock);
      const created = await createDraftProposal(
        {
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          template_id: TEMPLATE_ID,
          quantity_context: contextWithSquares(22),
        },
        deps
      );

      mock.rpcCalls.length = 0;
      mock.state.ops.length = 0;

      await refreshDraftPricing(
        COMPANY_ID,
        created.proposal.id,
        { quantity_context: contextWithSquares(24) },
        deps
      );

      assert.equal(mock.rpcCalls.length, 0);
      assert.ok(
        mock.state.ops.some(
          (op) => op.table === "proposal_line_items" && op.action === "insert"
        )
      );
      assert.ok(
        mock.state.ops.some(
          (op) => op.table === "proposal_options" && op.action === "update"
        )
      );
    });
  });

  test("default refresh calls persist_draft_pricing_refresh_v1 and applies graph", async () => {
    await withRefreshPricingDefaultPath(async () => {
      const mock = createMockSupabase();
      const deps = storeDeps(mock);
      const created = await createDraftProposal(
        {
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          template_id: TEMPLATE_ID,
          quantity_context: contextWithSquares(23),
        },
        deps
      );

      mock.rpcCalls.length = 0;

      await refreshDraftPricing(
        COMPANY_ID,
        created.proposal.id,
        { quantity_context: contextWithSquares(25) },
        deps
      );

      assert.equal(mock.rpcCalls.length, 1);
      assert.equal(mock.rpcCalls[0]!.name, PERSIST_DRAFT_PRICING_REFRESH_RPC_V1);
      assert.ok(mock.rpcCalls[0]!.args?.p_payload);
      assert.equal(firstLineTotalForVersion(mock).quantity, 25);

      const pricingRefreshRpcOps = mock.state.ops.filter(
        (op) => op.action === "rpc" && (op.payload as { name?: string })?.name === PERSIST_DRAFT_PRICING_REFRESH_RPC_V1
      );
      assert.equal(pricingRefreshRpcOps.length, 1);
    });
  });

  test("default refresh surfaces RPC failure as ProposalRecordStoreError without sequential fallback", async () => {
    await withRefreshPricingDefaultPath(async () => {
      const mock = createMockSupabase({
        rpcFailOn: "function does not exist",
        rpcFailOnFor: PERSIST_DRAFT_PRICING_REFRESH_RPC_V1,
      });
      const deps = storeDeps(mock);
      const created = await createDraftProposal(
        {
          company_id: COMPANY_ID,
          job_id: JOB_ID,
          template_id: TEMPLATE_ID,
          quantity_context: contextWithSquares(22),
        },
        deps
      );

      const linesBefore = clone(mock.state.tables.proposal_line_items);
      const optionBefore = clone(mock.state.tables.proposal_options[0]);

      await assert.rejects(
        () =>
          refreshDraftPricing(
            COMPANY_ID,
            created.proposal.id,
            { quantity_context: contextWithSquares(24) },
            deps
          ),
        (error: unknown) => {
          assert.ok(error instanceof ProposalRecordStoreError);
          assert.match(String(error.message), /function does not exist/);
          return true;
        }
      );

      assert.deepEqual(mock.state.tables.proposal_line_items, linesBefore);
      assert.deepEqual(mock.state.tables.proposal_options[0], optionBefore);
      const refreshRpcCalls = mock.rpcCalls.filter(
        (call) => call.name === PERSIST_DRAFT_PRICING_REFRESH_RPC_V1
      );
      assert.equal(refreshRpcCalls.length, 1);
      assert.equal(refreshRpcCalls[0]!.name, PERSIST_DRAFT_PRICING_REFRESH_RPC_V1);
    });
  });
});

describe("updateDraftSelectedOption", () => {
  test("validates option belongs to same proposal/version/company", async () => {
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

    const validOptionId = created.selectedOptionId!;
    const updated = await updateDraftSelectedOption(
      COMPANY_ID,
      created.proposal.id,
      validOptionId,
      deps
    );
    assert.ok(updated);
    assert.equal(updated.selected_option_id, validOptionId);

    await assert.rejects(
      () =>
        updateDraftSelectedOption(
          COMPANY_ID,
          created.proposal.id,
          "ffffffff-ffff-4fff-8fff-ffffffffffff",
          deps
        ),
      ProposalRecordStoreError
    );
  });

  test("appends draft_saved event with selected_option_id payload", async () => {
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

    const eventsBefore = mock.state.tables.proposal_events.length;
    await updateDraftSelectedOption(
      COMPANY_ID,
      created.proposal.id,
      created.selectedOptionId!,
      deps
    );

    assert.equal(mock.state.tables.proposal_events.length, eventsBefore + 1);
    const event = mock.state.tables.proposal_events.at(-1) as Record<string, unknown>;
    assert.equal(event.event_type, "draft_saved");
    assert.deepEqual(event.payload_json, { selected_option_id: created.selectedOptionId });
  });

  test("rejects non-draft proposal status", async () => {
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

    const header = mock.state.tables.proposals[0] as Record<string, unknown>;
    header.status = "sent";

    await assert.rejects(
      () =>
        updateDraftSelectedOption(
          COMPANY_ID,
          created.proposal.id,
          created.selectedOptionId!,
          deps
        ),
      (err: unknown) =>
        err instanceof ProposalRecordStoreError &&
        /not in draft status/i.test(err.message)
    );
  });

  test("getDraftGraph after update reflects persisted selected_option_id", async () => {
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

    const optionId = created.selectedOptionId!;
    await updateDraftSelectedOption(COMPANY_ID, created.proposal.id, optionId, deps);

    const graph = await getDraftGraph(COMPANY_ID, created.proposal.id, deps);
    assert.ok(graph);
    assert.equal(graph.proposal.selected_option_id, optionId);
  });
});

describe("updateDraftProposalPageContent", () => {
  function findEditablePage(mock: ReturnType<typeof createMockSupabase>, pageType: string) {
    return mock.state.tables.proposal_pages.find(
      (p) => (p as Record<string, unknown>).page_type === pageType
    ) as Record<string, unknown> | undefined;
  }

  test("updates body_markdown for editable page", async () => {
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

    const termsPage = findEditablePage(mock, "terms");
    assert.ok(termsPage?.id);

    const graph = await updateDraftProposalPageContent(
      COMPANY_ID,
      created.proposal.id,
      termsPage!.id as string,
      "Updated terms for this job only.",
      deps
    );

    assert.ok(graph);
    const updated = graph.pages.find((p) => p.id === termsPage!.id);
    assert.equal(
      (updated?.content_json as { body_markdown?: string }).body_markdown,
      "Updated terms for this job only."
    );
  });

  test("rejects non-draft proposal", async () => {
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

    const termsPage = findEditablePage(mock, "terms");
    (mock.state.tables.proposals[0] as Record<string, unknown>).status = "sent";

    await assert.rejects(
      () =>
        updateDraftProposalPageContent(
          COMPANY_ID,
          created.proposal.id,
          termsPage!.id as string,
          "Nope",
          deps
        ),
      (err: unknown) =>
        err instanceof ProposalRecordStoreError && /not in draft status/i.test(err.message)
    );
  });

  test("rejects wrong company", async () => {
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

    const termsPage = findEditablePage(mock, "terms");
    assert.ok(termsPage?.id);

    const result = await updateDraftProposalPageContent(
      "00000000-0000-4000-8000-000000000099",
      created.proposal.id,
      termsPage!.id as string,
      "Nope",
      deps
    );
    assert.equal(result, null);
  });

  test("rejects page not in current draft version", async () => {
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

    const termsPage = findEditablePage(mock, "terms");
    termsPage!.proposal_version_id = "ffffffff-ffff-4fff-8fff-ffffffffffff";

    await assert.rejects(
      () =>
        updateDraftProposalPageContent(
          COMPANY_ID,
          created.proposal.id,
          termsPage!.id as string,
          "Nope",
          deps
        ),
      ProposalRecordStoreError
    );
  });

  test("rejects non-editable page type", async () => {
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

    const estimatePage = findEditablePage(mock, "estimate");
    assert.ok(estimatePage?.id);

    await assert.rejects(
      () =>
        updateDraftProposalPageContent(
          COMPANY_ID,
          created.proposal.id,
          estimatePage!.id as string,
          "Nope",
          deps
        ),
      (err: unknown) =>
        err instanceof ProposalRecordStoreError && /not editable/i.test(err.message)
    );
  });

  test("rejects page not belonging to proposal", async () => {
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

    const other = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      deps
    );

    const otherTermsPage = mock.state.tables.proposal_pages.find(
      (p) =>
        (p as Record<string, unknown>).proposal_version_id === other.versionId &&
        (p as Record<string, unknown>).page_type === "terms"
    ) as Record<string, unknown> | undefined;

    assert.ok(otherTermsPage?.id);

    await assert.rejects(
      () =>
        updateDraftProposalPageContent(
          COMPANY_ID,
          created.proposal.id,
          otherTermsPage!.id as string,
          "Cross-proposal write",
          deps
        ),
      ProposalRecordStoreError
    );
  });

  test("does not mutate template rows", async () => {
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

    const templatesBefore = clone(mock.state.tables.proposal_templates ?? []);
    const sectionsBefore = clone(mock.state.tables.proposal_template_sections ?? []);
    const termsPage = findEditablePage(mock, "terms");

    await updateDraftProposalPageContent(
      COMPANY_ID,
      created.proposal.id,
      termsPage!.id as string,
      "Body only mutation",
      deps
    );

    assert.deepEqual(mock.state.tables.proposal_templates ?? [], templatesBefore);
    assert.deepEqual(mock.state.tables.proposal_template_sections ?? [], sectionsBefore);
  });

  test("preserves non-body content_json keys", async () => {
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

    const termsPage = findEditablePage(mock, "terms");
    termsPage!.content_json = {
      body_markdown: "Old",
      media_refs: [{ storage_key: "keep-me", sort_order: 0 }],
    };

    await updateDraftProposalPageContent(
      COMPANY_ID,
      created.proposal.id,
      termsPage!.id as string,
      "New body",
      deps
    );

    const row = mock.state.tables.proposal_pages.find((p) => p.id === termsPage!.id) as Record<
      string,
      unknown
    >;
    const content = row.content_json as {
      body_markdown?: string;
      media_refs?: unknown[];
    };
    assert.equal(content.body_markdown, "New body");
    assert.deepEqual(content.media_refs, [{ storage_key: "keep-me", sort_order: 0 }]);
  });

  test("appends draft_saved event with page_id and field metadata", async () => {
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

    const eventsBefore = mock.state.tables.proposal_events.length;
    const termsPage = findEditablePage(mock, "terms");

    await updateDraftProposalPageContent(
      COMPANY_ID,
      created.proposal.id,
      termsPage!.id as string,
      "Event test body",
      deps
    );

    assert.equal(mock.state.tables.proposal_events.length, eventsBefore + 1);
    const event = mock.state.tables.proposal_events.at(-1) as Record<string, unknown>;
    assert.equal(event.event_type, "draft_saved");
    assert.deepEqual(event.payload_json, {
      page_id: termsPage!.id,
      field: "body_markdown",
    });
  });

  test("does not mutate context_echo, options, or lines", async () => {
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

    const versionBefore = clone(mock.state.tables.proposal_versions[0]);
    const optionsBefore = clone(mock.state.tables.proposal_options);
    const linesBefore = clone(mock.state.tables.proposal_line_items);
    const termsPage = findEditablePage(mock, "terms");

    await updateDraftProposalPageContent(
      COMPANY_ID,
      created.proposal.id,
      termsPage!.id as string,
      "Isolation body",
      deps
    );

    assert.deepEqual(mock.state.tables.proposal_versions[0], versionBefore);
    assert.deepEqual(mock.state.tables.proposal_options, optionsBefore);
    assert.deepEqual(mock.state.tables.proposal_line_items, linesBefore);
  });

  test("refreshDraftPricing does not wipe edited body text", async () => {
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

    const termsPage = findEditablePage(mock, "terms");
    await updateDraftProposalPageContent(
      COMPANY_ID,
      created.proposal.id,
      termsPage!.id as string,
      "Persisted after refresh {{customer_name}}",
      deps
    );

    await refreshDraftPricing(
      COMPANY_ID,
      created.proposal.id,
      { quantity_context: readyContext() },
      deps
    );

    const row = mock.state.tables.proposal_pages.find((p) => p.id === termsPage!.id) as Record<
      string,
      unknown
    >;
    assert.equal(
      (row.content_json as { body_markdown?: string }).body_markdown,
      "Persisted after refresh {{customer_name}}"
    );
  });

  test("R17D: zero scope decisions — refresh output unchanged vs baseline instantiate", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const ctx = contextWithSquares(22);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: ctx,
      },
      deps
    );

    const beforeLine = firstLineTotalForVersion(mock);
    const beforeOptionTotal = optionTotalForVersion(mock);
    const decisionCountBefore = mock.state.tables.proposal_option_scope_decisions.length;

    await refreshDraftPricing(COMPANY_ID, created.proposal.id, { quantity_context: ctx }, deps);

    const afterLine = firstLineTotalForVersion(mock);
    const afterOptionTotal = optionTotalForVersion(mock);
    assert.equal(afterLine.quantity, beforeLine.quantity);
    assert.equal(afterLine.total, beforeLine.total);
    assert.equal(afterOptionTotal, beforeOptionTotal);
    assert.equal(mock.state.tables.proposal_option_scope_decisions.length, decisionCountBefore);
  });

  test("R17D: manual_quantity survives refresh and changes snapshot quantity/pricing", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const ctx = contextWithSquares(22);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: ctx,
      },
      deps
    );

    const runtimeOption = mock.state.tables.proposal_options[0] as Record<string, unknown>;
    const templateItemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const { upsertDraftScopeDecision } = await import("./proposalScopeDecisionStore");
    await upsertDraftScopeDecision(
      {
        company_id: COMPANY_ID,
        proposal_id: created.proposal.id,
        proposal_option_id: runtimeOption.id as string,
        decision_type: "manual_quantity",
        source_template_item_id: templateItemId,
        payload: { quantity: 18 },
      },
      deps
    );

    assert.equal(mock.state.tables.proposal_option_scope_decisions.length, 1);

    await refreshDraftPricing(COMPANY_ID, created.proposal.id, { quantity_context: ctx }, deps);

    assert.equal(mock.state.tables.proposal_option_scope_decisions.length, 1);
    const decisionRow = mock.state.tables.proposal_option_scope_decisions[0] as Record<
      string,
      unknown
    >;
    assert.equal(decisionRow.active, true);
    assert.equal((decisionRow.payload_json as { quantity: number }).quantity, 18);

    const line = mock.state.tables.proposal_line_items[0] as Record<string, unknown>;
    assert.equal(Number(line.quantity), 18);
    assert.equal(line.quantity_source_label, "Manual");
    assert.ok(Number(line.customer_line_total_cents) > 0);

    const lineDeleteOps = mock.state.ops.filter(
      (op) => op.table === "proposal_line_items" && op.action === "delete"
    );
    const lineInsertOps = mock.state.ops.filter(
      (op) => op.table === "proposal_line_items" && op.action === "insert"
    );
    assert.ok(lineDeleteOps.length > 0);
    assert.ok(lineInsertOps.length > 0);

    const lineUpdateOps = mock.state.ops.filter(
      (op) => op.table === "proposal_line_items" && op.action === "update"
    );
    assert.equal(lineUpdateOps.length, 0, "scope decisions must not patch proposal_line_items directly");
  });

  test("R17D Phase 2: applyManualQuantityScopeDecision upserts then refreshes graph", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const ctx = contextWithSquares(22);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: ctx,
      },
      deps
    );

    const runtimeOption = mock.state.tables.proposal_options[0] as Record<string, unknown>;
    const templateItemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const { applyManualQuantityScopeDecision } = await import("./proposalScopeDecisionActions");

    const { graph } = await applyManualQuantityScopeDecision(
      {
        companyId: COMPANY_ID,
        proposalId: created.proposal.id,
        runtimeProposalOptionId: runtimeOption.id as string,
        sourceTemplateItemId: templateItemId,
        quantity: 18.5,
        quantityDisplayLabel: "18.5 square",
        refreshContext: { quantity_context: ctx },
      },
      deps
    );

    assert.ok(graph);
    assert.equal(mock.state.tables.proposal_option_scope_decisions.length, 1);
    const line = mock.state.tables.proposal_line_items[0] as Record<string, unknown>;
    assert.equal(Number(line.quantity), 18.5);

    await applyManualQuantityScopeDecision(
      {
        companyId: COMPANY_ID,
        proposalId: created.proposal.id,
        runtimeProposalOptionId: runtimeOption.id as string,
        sourceTemplateItemId: templateItemId,
        quantity: 20,
        quantityDisplayLabel: "20 square",
        refreshContext: { quantity_context: ctx },
      },
      deps
    );

    assert.equal(mock.state.tables.proposal_option_scope_decisions.length, 1);
    assert.equal(
      (
        (mock.state.tables.proposal_option_scope_decisions[0] as Record<string, unknown>)
          .payload_json as { quantity: number; quantity_display_label?: string }
      ).quantity,
      20
    );
  });

  test("R17D Phase 2.5: clearManualQuantityScopeDecision clears manual snapshot and reverts to measurement", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const ctx = contextWithSquares(22);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: ctx,
      },
      deps
    );

    const runtimeOption = mock.state.tables.proposal_options[0] as Record<string, unknown>;
    const templateItemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const { applyManualQuantityScopeDecision, clearManualQuantityScopeDecision } = await import(
      "./proposalScopeDecisionActions"
    );

    await applyManualQuantityScopeDecision(
      {
        companyId: COMPANY_ID,
        proposalId: created.proposal.id,
        runtimeProposalOptionId: runtimeOption.id as string,
        sourceTemplateItemId: templateItemId,
        quantity: 18,
        quantityDisplayLabel: "18 square",
        refreshContext: { quantity_context: ctx },
      },
      deps
    );

    let line = mock.state.tables.proposal_line_items[0] as Record<string, unknown>;
    assert.equal(line.quantity_source_label, "Manual");
    assert.equal(Number(line.quantity), 18);

    mock.state.ops.length = 0;

    const { graph } = await clearManualQuantityScopeDecision(
      {
        companyId: COMPANY_ID,
        proposalId: created.proposal.id,
        runtimeProposalOptionId: runtimeOption.id as string,
        sourceTemplateItemId: templateItemId,
        refreshContext: { quantity_context: ctx },
      },
      deps
    );

    assert.ok(graph);
    assert.equal(
      (mock.state.tables.proposal_option_scope_decisions[0] as Record<string, unknown>).active,
      false
    );

    line = mock.state.tables.proposal_line_items[0] as Record<string, unknown>;
    assert.notEqual(line.quantity_source_label, "Manual");
    assert.equal(Number(line.quantity), 22);

    const lineUpdateOps = mock.state.ops.filter(
      (op) => op.table === "proposal_line_items" && op.action === "update"
    );
    assert.equal(lineUpdateOps.length, 0, "clear must rebuild line items without direct updates");
  });

  test("R17D Phase 2.5: clear without measurement reverts line to needs_quantity path", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: null,
      },
      deps
    );

    const runtimeOption = mock.state.tables.proposal_options[0] as Record<string, unknown>;
    const templateItemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const { applyManualQuantityScopeDecision, clearManualQuantityScopeDecision } = await import(
      "./proposalScopeDecisionActions"
    );

    await applyManualQuantityScopeDecision(
      {
        companyId: COMPANY_ID,
        proposalId: created.proposal.id,
        runtimeProposalOptionId: runtimeOption.id as string,
        sourceTemplateItemId: templateItemId,
        quantity: 18,
        refreshContext: { quantity_context: null },
      },
      deps
    );

    await clearManualQuantityScopeDecision(
      {
        companyId: COMPANY_ID,
        proposalId: created.proposal.id,
        runtimeProposalOptionId: runtimeOption.id as string,
        sourceTemplateItemId: templateItemId,
        refreshContext: { quantity_context: null },
      },
      deps
    );

    const line = mock.state.tables.proposal_line_items[0] as Record<string, unknown>;
    assert.equal(line.quantity, null);
    assert.notEqual(line.quantity_source_label, "Manual");
  });

  test("R17D Phase 2.5: second refresh preserves cleared manual quantity state", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    const ctx = contextWithSquares(22);
    const created = await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
        quantity_context: ctx,
      },
      deps
    );

    const runtimeOption = mock.state.tables.proposal_options[0] as Record<string, unknown>;
    const templateItemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const { applyManualQuantityScopeDecision, clearManualQuantityScopeDecision } = await import(
      "./proposalScopeDecisionActions"
    );

    await applyManualQuantityScopeDecision(
      {
        companyId: COMPANY_ID,
        proposalId: created.proposal.id,
        runtimeProposalOptionId: runtimeOption.id as string,
        sourceTemplateItemId: templateItemId,
        quantity: 18,
        refreshContext: { quantity_context: ctx },
      },
      deps
    );

    await clearManualQuantityScopeDecision(
      {
        companyId: COMPANY_ID,
        proposalId: created.proposal.id,
        runtimeProposalOptionId: runtimeOption.id as string,
        sourceTemplateItemId: templateItemId,
        refreshContext: { quantity_context: ctx },
      },
      deps
    );

    await refreshDraftPricing(COMPANY_ID, created.proposal.id, { quantity_context: ctx }, deps);

    const line = mock.state.tables.proposal_line_items[0] as Record<string, unknown>;
    assert.notEqual(line.quantity_source_label, "Manual");
    assert.equal(Number(line.quantity), 22);
    assert.equal(
      (mock.state.tables.proposal_option_scope_decisions[0] as Record<string, unknown>).active,
      false
    );
  });

  test("R17D Phase 2.5: clearManualQuantityScopeDecision rejects when no active manual quantity", async () => {
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
    const { clearManualQuantityScopeDecision } = await import("./proposalScopeDecisionActions");

    await assert.rejects(
      () =>
        clearManualQuantityScopeDecision(
          {
            companyId: COMPANY_ID,
            proposalId: created.proposal.id,
            runtimeProposalOptionId: runtimeOption.id as string,
            sourceTemplateItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            refreshContext: { quantity_context: null },
          },
          deps
        ),
      (err: unknown) => err instanceof ProposalRecordStoreError
    );
  });
});

describe("appendProposalEvent", () => {
  test("inserts only — store exposes no update/delete event methods", async () => {
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

    const event = await appendProposalEvent(
      {
        company_id: COMPANY_ID,
        proposal_id: created.proposal.id,
        proposal_version_id: created.versionId,
        event_type: "draft_saved",
        payload_json: { test: true },
      },
      deps
    );
    assert.ok(event);

    const exported = [
      "getProposalById",
      "listProposalsForJob",
      "getDraftGraph",
      "createDraftProposal",
      "refreshDraftPricing",
      "updateDraftSelectedOption",
      "appendProposalEvent",
    ];
    assert.ok(!exported.some((name) => name.includes("updateProposalEvent")));
    assert.ok(!exported.some((name) => name.includes("deleteProposalEvent")));
  });
});

describe("reads", () => {
  test("getDraftGraph reads header/version/pages/options/lines/internal summaries by company scope", async () => {
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

    const graph = await getDraftGraph(COMPANY_ID, created.proposal.id, deps);
    assert.ok(graph);
    assert.equal(graph.proposal.id, created.proposal.id);
    assert.equal(graph.version.version_kind, "draft");
    assert.ok(graph.pages.length > 0);
    assert.ok(graph.options.length > 0);
    assert.ok(graph.lineItems.length > 0);
    assert.ok(graph.internalSummaries.length > 0);

    for (const line of graph.lineItems) {
      assert.ok(!("internal_cost_cents" in line));
      assert.ok(!("policy_echo_json" in line));
    }
  });

  test("listProposalsForJob scopes by company_id and job_id", async () => {
    const mock = createMockSupabase();
    const deps = storeDeps(mock);
    await createDraftProposal(
      {
        company_id: COMPANY_ID,
        job_id: JOB_ID,
        template_id: TEMPLATE_ID,
      },
      deps
    );

    const list = await listProposalsForJob(COMPANY_ID, JOB_ID, deps);
    assert.equal(list.length, 1);
    assert.equal(list[0]!.job_id, JOB_ID);

    const other = await listProposalsForJob(
      COMPANY_ID,
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      deps
    );
    assert.equal(other.length, 0);
  });
});

describe("updateDraftProposalPageVisibility", () => {
  function findPageByType(mock: ReturnType<typeof createMockSupabase>, pageType: string) {
    return mock.state.tables.proposal_pages.find(
      (p) => (p as Record<string, unknown>).page_type === pageType
    ) as Record<string, unknown> | undefined;
  }

  test("toggles visible_to_customer for toggleable page", async () => {
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

    const termsPage = findPageByType(mock, "terms");
    assert.ok(termsPage?.id);
    assert.equal(termsPage!.visible_to_customer, true);

    const graph = await updateDraftProposalPageVisibility(
      COMPANY_ID,
      created.proposal.id,
      termsPage!.id as string,
      false,
      deps
    );

    assert.ok(graph);
    const updated = graph.pages.find((p) => p.id === termsPage!.id);
    assert.equal(updated?.visible_to_customer, false);
  });

  test("rejects non-draft proposal", async () => {
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

    const termsPage = findPageByType(mock, "terms");
    (mock.state.tables.proposals[0] as Record<string, unknown>).status = "sent";

    await assert.rejects(
      () =>
        updateDraftProposalPageVisibility(
          COMPANY_ID,
          created.proposal.id,
          termsPage!.id as string,
          false,
          deps
        ),
      (err: unknown) =>
        err instanceof ProposalRecordStoreError && /not in draft status/i.test(err.message)
    );
  });

  test("rejects wrong company", async () => {
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

    const termsPage = findPageByType(mock, "terms");
    const result = await updateDraftProposalPageVisibility(
      "00000000-0000-4000-8000-000000000099",
      created.proposal.id,
      termsPage!.id as string,
      false,
      deps
    );
    assert.equal(result, null);
  });

  test("rejects non-toggleable page types", async () => {
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

    const estimatePage = findPageByType(mock, "estimate");
    assert.ok(estimatePage?.id);

    await assert.rejects(
      () =>
        updateDraftProposalPageVisibility(
          COMPANY_ID,
          created.proposal.id,
          estimatePage!.id as string,
          false,
          deps
        ),
      (err: unknown) =>
        err instanceof ProposalRecordStoreError && /not toggleable/i.test(err.message)
    );
  });

  test("only mutates visible_to_customer and updated_at", async () => {
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

    const termsPage = findPageByType(mock, "terms");
    termsPage!.content_json = { body_markdown: "Keep me" };
    termsPage!.sort_order = 42;
    const contentBefore = clone(termsPage!.content_json);
    const sortOrderBefore = termsPage!.sort_order;

    await updateDraftProposalPageVisibility(
      COMPANY_ID,
      created.proposal.id,
      termsPage!.id as string,
      false,
      deps
    );

    const row = mock.state.tables.proposal_pages.find((p) => p.id === termsPage!.id) as Record<
      string,
      unknown
    >;
    assert.equal(row.visible_to_customer, false);
    assert.deepEqual(row.content_json, contentBefore);
    assert.equal(row.sort_order, sortOrderBefore);
  });

  test("appends draft_saved event with visible_to_customer metadata", async () => {
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

    const eventsBefore = mock.state.tables.proposal_events.length;
    const termsPage = findPageByType(mock, "terms");

    await updateDraftProposalPageVisibility(
      COMPANY_ID,
      created.proposal.id,
      termsPage!.id as string,
      false,
      deps
    );

    assert.equal(mock.state.tables.proposal_events.length, eventsBefore + 1);
    const event = mock.state.tables.proposal_events.at(-1) as Record<string, unknown>;
    assert.equal(event.event_type, "draft_saved");
    assert.deepEqual(event.payload_json, {
      page_id: termsPage!.id,
      field: "visible_to_customer",
      value: false,
    });
  });

  test("no-ops when visibility unchanged", async () => {
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

    const termsPage = findPageByType(mock, "terms");
    const eventsBefore = mock.state.tables.proposal_events.length;

    await updateDraftProposalPageVisibility(
      COMPANY_ID,
      created.proposal.id,
      termsPage!.id as string,
      true,
      deps
    );

    assert.equal(mock.state.tables.proposal_events.length, eventsBefore);
  });
});

describe("updateDraftProposalPageSettings", () => {
  function findPageByType(mock: ReturnType<typeof createMockSupabase>, pageType: string) {
    return mock.state.tables.proposal_pages.find(
      (p) => (p as Record<string, unknown>).page_type === pageType
    ) as Record<string, unknown> | undefined;
  }

  test("updates settings_json on estimate page only", async () => {
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

    const estimatePage = findPageByType(mock, "estimate");
    assert.ok(estimatePage?.id);

    const graph = await updateDraftProposalPageSettings(
      COMPANY_ID,
      created.proposal.id,
      estimatePage!.id as string,
      { show_line_prices: false },
      deps
    );

    assert.ok(graph);
    const updated = graph.pages.find((p) => p.id === estimatePage!.id);
    assert.equal(updated?.settings_json.show_line_prices, false);
    assert.equal(updated?.settings_json.show_option_totals, true);
  });

  test("rejects non-estimate page types", async () => {
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

    const termsPage = findPageByType(mock, "terms");
    assert.ok(termsPage?.id);

    await assert.rejects(
      () =>
        updateDraftProposalPageSettings(
          COMPANY_ID,
          created.proposal.id,
          termsPage!.id as string,
          { show_line_prices: false },
          deps
        ),
      (err: unknown) =>
        err instanceof ProposalRecordStoreError && /does not support estimate display settings/i.test(err.message)
    );
  });

  test("only mutates settings_json and updated_at", async () => {
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

    const estimatePage = findPageByType(mock, "estimate");
    estimatePage!.content_json = { body_markdown: "Keep me" };
    estimatePage!.visible_to_customer = true;
    const contentBefore = clone(estimatePage!.content_json);
    const visibleBefore = estimatePage!.visible_to_customer;

    await updateDraftProposalPageSettings(
      COMPANY_ID,
      created.proposal.id,
      estimatePage!.id as string,
      { show_option_totals: false },
      deps
    );

    const row = mock.state.tables.proposal_pages.find((p) => p.id === estimatePage!.id) as Record<
      string,
      unknown
    >;
    assert.deepEqual(row.settings_json, {
      show_line_prices: true,
      show_option_totals: false,
      show_section_headings: true,
    });
    assert.deepEqual(row.content_json, contentBefore);
    assert.equal(row.visible_to_customer, visibleBefore);
  });

  test("does not mutate proposal_line_items or option totals", async () => {
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

    const lineItemsBefore = clone(mock.state.tables.proposal_line_items);
    const optionsBefore = clone(mock.state.tables.proposal_options);
    const estimatePage = findPageByType(mock, "estimate");

    await updateDraftProposalPageSettings(
      COMPANY_ID,
      created.proposal.id,
      estimatePage!.id as string,
      { show_section_headings: false },
      deps
    );

    assert.deepEqual(mock.state.tables.proposal_line_items, lineItemsBefore);
    assert.deepEqual(mock.state.tables.proposal_options, optionsBefore);
  });

  test("appends draft_saved event with settings_json metadata", async () => {
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

    const eventsBefore = mock.state.tables.proposal_events.length;
    const estimatePage = findPageByType(mock, "estimate");

    await updateDraftProposalPageSettings(
      COMPANY_ID,
      created.proposal.id,
      estimatePage!.id as string,
      { show_line_prices: false },
      deps
    );

    assert.equal(mock.state.tables.proposal_events.length, eventsBefore + 1);
    const event = mock.state.tables.proposal_events.at(-1) as Record<string, unknown>;
    assert.equal(event.event_type, "draft_saved");
    assert.deepEqual(event.payload_json, {
      page_id: estimatePage!.id,
      field: "settings_json",
      patch: { show_line_prices: false },
    });
  });
});

describe("freezeDraftToSentSnapshot", () => {
  test("flag OFF throws before graph load or RPC", async () => {
    await withProposalSendFreezeRpcDisabled(async () => {
      const mock = createMockSupabase();
      const created = await seedSendFreezeReadyProposal(mock);
      const opsBefore = mock.state.ops.length;

      await assert.rejects(
        () => freezeDraftToSentSnapshot(COMPANY_ID, created.proposal.id, {}, storeDeps(mock)),
        (error: unknown) => {
          assert.ok(error instanceof ProposalRecordStoreError);
          assert.match(String(error.message), /not enabled/);
          return true;
        }
      );

      assert.equal(mock.state.ops.length, opsBefore);
      assert.equal(
        mock.rpcCalls.filter((call) => call.name === PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1).length,
        0
      );
    });
  });

  test("readiness failure blocks RPC", async () => {
    await withProposalSendFreezeRpcEnabled(async () => {
      const mock = createMockSupabase();
      const deps = storeDeps(mock);
      const created = await seedSendFreezeReadyProposal(mock, deps);
      const option = mock.state.tables.proposal_options[0] as Record<string, unknown>;
      option.pricing_complete = false;

      await assert.rejects(
        () => freezeDraftToSentSnapshot(COMPANY_ID, created.proposal.id, {}, deps),
        (error: unknown) => {
          assert.ok(error instanceof ProposalRecordStoreError);
          assert.match(String(error.message), /Send-freeze blocked/);
          assert.match(String(error.message), /pricing is incomplete/);
          return true;
        }
      );

      assert.equal(
        mock.rpcCalls.filter((call) => call.name === PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1).length,
        0
      );
    });
  });

  test("flag ON + ready graph calls persist_proposal_send_freeze_v1 with client_page_id", async () => {
    await withProposalSendFreezeRpcEnabled(async () => {
      const mock = createMockSupabase();
      const deps = storeDeps(mock);
      const created = await seedSendFreezeReadyProposal(mock, deps);
      const draftVersionIdBefore = created.proposal.current_draft_version_id;
      const statusBefore = created.proposal.status;
      const linesBefore = clone(mock.state.tables.proposal_line_items);
      const optionsBefore = clone(mock.state.tables.proposal_options);
      const scopeBefore = clone(mock.state.tables.proposal_option_scope_decisions);

      const result = await freezeDraftToSentSnapshot(COMPANY_ID, created.proposal.id, {}, deps);

      const freezeRpc = mock.rpcCalls.find(
        (call) => call.name === PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1
      );
      assert.ok(freezeRpc);
      const payload = freezeRpc.args?.p_payload as ProposalSendFreezePersistPayload;
      assert.ok(payload.pages.every((page) => page.client_page_id));
      assert.ok(!("scope_decisions" in (payload as object)));
      assert.ok(!("public_token" in (payload as object)));

      assert.deepEqual(result.writeSteps, [PROPOSAL_SEND_FREEZE_RPC_PERSIST_STEP]);
      assert.equal(result.proposalId, created.proposal.id);
      assert.equal(result.draftVersionId, draftVersionIdBefore);
      assert.ok(result.sentVersionId);
      assert.equal(result.latestSentVersionId, result.sentVersionId);
      assert.equal(result.readiness.ready, true);

      const header = mock.state.tables.proposals[0] as Record<string, unknown>;
      assert.equal(header.latest_sent_version_id, result.sentVersionId);
      assert.equal(header.current_draft_version_id, draftVersionIdBefore);
      assert.equal(header.status, statusBefore);
      assert.notEqual(header.status, "sent");

      assert.deepEqual(mock.state.tables.proposal_line_items, linesBefore);
      assert.deepEqual(mock.state.tables.proposal_options, optionsBefore);
      assert.deepEqual(mock.state.tables.proposal_option_scope_decisions, scopeBefore);
    });
  });

  test("RPC error wraps as ProposalRecordStoreError without sequential fallback", async () => {
    await withProposalSendFreezeRpcEnabled(async () => {
      const mock = createMockSupabase({
        rpcFailOn: "permission denied for function persist_proposal_send_freeze_v1",
        rpcFailOnFor: PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1,
      });
      const deps = storeDeps(mock);
      const created = await seedSendFreezeReadyProposal(mock, deps);
      const latestSentBefore = (mock.state.tables.proposals[0] as Record<string, unknown>)
        .latest_sent_version_id;

      await assert.rejects(
        () => freezeDraftToSentSnapshot(COMPANY_ID, created.proposal.id, {}, deps),
        (error: unknown) => {
          assert.ok(error instanceof ProposalRecordStoreError);
          assert.match(String(error.message), /permission denied/);
          return true;
        }
      );

      assert.equal(
        (mock.state.tables.proposals[0] as Record<string, unknown>).latest_sent_version_id,
        latestSentBefore
      );
    });
  });

  test("malformed RPC response rejected", async () => {
    await withProposalSendFreezeRpcEnabled(async () => {
      const mock = createMockSupabase({
        rpcMalformedFor: PERSIST_PROPOSAL_SEND_FREEZE_RPC_V1,
      });
      const deps = storeDeps(mock);
      const created = await seedSendFreezeReadyProposal(mock, deps);

      await assert.rejects(
        () => freezeDraftToSentSnapshot(COMPANY_ID, created.proposal.id, {}, deps),
        (error: unknown) => {
          assert.ok(error instanceof ProposalRecordStoreError);
          return true;
        }
      );
    });
  });

  test("store freezeDraftToSentSnapshot has no sequential fallback path", () => {
    const source = readFileSync(new URL("./proposalRecordStore.ts", import.meta.url), "utf8");
    const fnMatch = source.match(
      /export async function freezeDraftToSentSnapshot\([\s\S]*?\n\}/
    );
    assert.ok(fnMatch);
    const freezeFn = fnMatch[0]!;
    assert.doesNotMatch(freezeFn, /persistProposalSendFreezeSequential/);
    assert.doesNotMatch(freezeFn, /refreshDraftPricing/);
    assert.doesNotMatch(source, /\/approve\/|app\/lib\/kv/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_USE_PROPOSAL_SEND_FREEZE/);
  });
});

describe("buildDraftInstantiateInputFromPreview", () => {
  test("customer policy echo is separate from internal summary path", () => {
    const g = testGraph();
    const cat = catalog({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
    const preview = buildProposalBuilderPricingPreview({
      graph: g,
      catalogItems: [cat],
      quantityContext: readyContext(),
      policy: CONFIGURED_POLICY,
    });

    const input = buildDraftInstantiateInputFromPreview({
      companyId: COMPANY_ID,
      graph: g,
      catalogItems: [cat],
      quantityContext: readyContext(),
      preview,
      policy: CONFIGURED_POLICY,
      pricingPolicyId: POLICY_ID,
      context: { job_id: JOB_ID, template_id: TEMPLATE_ID },
    });

    assert.ok(input.internalSummaryByTemplateOptionId["77777777-7777-4777-8777-777777777777"]);
    assert.ok(input.lineItemsByTemplateOptionId["77777777-7777-4777-8777-777777777777"]!.length > 0);
    assert.equal(input.policy.configured, true);
  });
});
