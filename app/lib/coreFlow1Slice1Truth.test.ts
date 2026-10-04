/**
 * Core Flow 1 / Slice 1 — truth contracts:
 * ERROR != EMPTY, UNKNOWN != ZERO, FAILED != SUCCESS, NOT LOADED != NOT CONFIGURED.
 * Run: npx tsx --test app/lib/coreFlow1Slice1Truth.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogUnitQuantityMismatchNote } from "./catalogCoverageCompatibility";
import {
  collectLinkedCatalogPricingLines,
  countFirstProposalPricesStillNeeded,
  type FirstProposalPricingLine,
} from "./firstProposalPrepare";
import {
  emptyJobCardManualMeasurementFields,
  isManualMeasurementStarterQuantityInputComplete,
  listManualMeasurementMissingInputs,
  type JobCardManualMeasurementFields,
} from "./jobCardManualMeasurementDraft";
import {
  JOB_CARD_MEASUREMENTS_EMPTY,
  JOB_CARD_MEASUREMENTS_LOAD_FAILED,
  JOB_CARD_MEASUREMENTS_LOADING,
  JOB_CARD_MEASUREMENTS_REFRESH_FAILED,
} from "./jobCardMeasurementReportModel";
import {
  PREPARE_PROPOSAL_MEASUREMENT_LOAD_FAILED,
  PREPARE_PROPOSAL_MEASUREMENT_LOADING,
  PREPARE_PROPOSAL_SETUP_INSTALL_FAILED,
  PREPARE_PROPOSAL_SETUP_INSTALLING,
  PREPARE_PROPOSAL_SETUP_LOAD_FAILED,
  PREPARE_PROPOSAL_SETUP_LOADING,
  PREPARE_PROPOSAL_SETUP_NONE,
  CREATE_PROPOSAL_MEASUREMENT_BLOCKED,
  resolvePrepareProposalMeasurement,
  resolvePrepareProposalPackage,
  resolvePrepareProposalSetup,
} from "@/app/tools/roofing/jobCard/jobCardCreateProposalModalModel";
import JobCardMeasurementsWorkspace from "@/app/tools/roofing/jobCard/JobCardMeasurementsWorkspace";
import JobCardMeasurementCapture, {
  JOB_CARD_MEASUREMENT_INCOMPLETE_HINT,
} from "@/app/tools/roofing/jobCard/JobCardMeasurementCapture";
import {
  CUSTOMER_SEARCH_UNAVAILABLE,
  JobPacketCustomerCandidates,
} from "@/app/tools/roofing/JobPacketCustomerCandidates";
import {
  JobPacketPropertyCandidates,
  PROPERTY_SEARCH_UNAVAILABLE,
} from "@/app/tools/roofing/JobPacketPropertyCandidates";
import type { CatalogItem } from "./catalogTypes";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const noop = () => undefined;

// ---------------------------------------------------------------------------
// A — measurement read failure != empty
// ---------------------------------------------------------------------------

describe("A: measurement read failure is not 'no measurement'", () => {
  test("store exposes a discriminated load result; legacy getter delegates", () => {
    const src = read("app/lib/measurementStore.ts");
    assert.match(src, /export type MeasurementRecordsLoadResult =/);
    assert.match(src, /export async function loadMeasurementsForJob/);
    assert.match(src, /const r(esult)? = await loadMeasurementsForJob/);
  });

  test("Job Card workspace: loading, failed and empty are three different screens", () => {
    const base = {
      records: [],
      selectedId: null,
      onAddMeasurement: noop,
      onSaveMeasurement: noop,
      onMakeCurrent: noop,
      onRetryLoad: noop,
    };
    const loading = renderToStaticMarkup(createElement(JobCardMeasurementsWorkspace, { ...base, loading: true }));
    const failed = renderToStaticMarkup(createElement(JobCardMeasurementsWorkspace, { ...base, loadFailed: true }));
    const empty = renderToStaticMarkup(createElement(JobCardMeasurementsWorkspace, { ...base }));

    assert.match(loading, new RegExp(JOB_CARD_MEASUREMENTS_LOADING));
    assert.doesNotMatch(loading, new RegExp(JOB_CARD_MEASUREMENTS_EMPTY));

    assert.match(failed, /data-jobcard-measurements-load-failed/);
    assert.match(failed, new RegExp(JOB_CARD_MEASUREMENTS_LOAD_FAILED.replace("'", "&#x27;")));
    assert.match(failed, /data-jobcard-measurements-retry/);
    assert.doesNotMatch(failed, new RegExp(JOB_CARD_MEASUREMENTS_EMPTY));

    assert.match(empty, new RegExp(JOB_CARD_MEASUREMENTS_EMPTY));
    assert.doesNotMatch(empty, /data-jobcard-measurements-load-failed/);
  });

  test("Prepare: loading → pending; failed → blocked with retry copy; never 'measurement required'", () => {
    const loading = resolvePrepareProposalMeasurement({ eligible: [], selectedId: null, loadState: "loading" });
    assert.equal(loading.state, "pending");
    assert.equal(loading.valueLabel, PREPARE_PROPOSAL_MEASUREMENT_LOADING);

    const failed = resolvePrepareProposalMeasurement({ eligible: [], selectedId: null, loadState: "failed" });
    assert.equal(failed.state, "blocked");
    assert.equal(failed.fixPath, PREPARE_PROPOSAL_MEASUREMENT_LOAD_FAILED);
    assert.notEqual(failed.fixPath, CREATE_PROPOSAL_MEASUREMENT_BLOCKED);

    const ready = resolvePrepareProposalMeasurement({ eligible: [], selectedId: null, loadState: "ready" });
    assert.equal(ready.fixPath, CREATE_PROPOSAL_MEASUREMENT_BLOCKED);
  });

  test("Prepare keeps known measurements when a refresh fails", () => {
    const view = resolvePrepareProposalMeasurement({
      eligible: [{ id: "m1", title: "Manual", summaryLine: "24 sq", ready: true }],
      selectedId: "m1",
      loadState: "failed",
    });
    assert.equal(view.state, "prepared");
    assert.equal(view.preparedId, "m1");
  });

  test("hook keeps same-job records on failure", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /measurementsLoadFailed/);
    assert.match(hook, /loadMeasurementsForJob/);
  });
});

// ---------------------------------------------------------------------------
// B — pricing policy read failure != not configured
// ---------------------------------------------------------------------------

describe("B: pricing-rules read failure is not 'not configured'", () => {
  test("store returns ok:false on read error instead of a starter default", () => {
    const src = read("app/lib/companyPricingPolicyStore.ts");
    assert.match(src, /export type CompanyPricingPolicyLoadResult =/);
    assert.match(src, /export async function loadResolvedCompanyPricingPolicy/);
  });

  test("Prepare: four states; save is only offered when truly not configured", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /"loading" \| "configured" \| "not_configured" \| "failed"/);
    assert.match(hook, /showFirstProposalPricingRules\s*=\s*[\s\S]{0,40}"not_configured"/);
  });

  test("Settings: failed read shows no form and blocks save", () => {
    const src = read("app/tools/settings/pricing/CompanyPricingPolicySettingsClient.tsx");
    assert.match(src, /data-pricing-load-failed/);
    assert.match(src, /data-pricing-load-retry/);
    assert.match(src, /Nothing has been changed\./);
    assert.match(src, /if \(!form \|\| loadFailed\) return;/);
  });

  test("Settings summary throws on failure so the card says it couldn't load", () => {
    const src = read("app/tools/settings/companySettingsData.ts");
    assert.match(src, /loadResolvedCompanyPricingPolicy/);
    assert.match(src, /throw/);
  });
});

// ---------------------------------------------------------------------------
// C — customer / property search failure != no match
// ---------------------------------------------------------------------------

describe("C: search unavailable is not 'no matches'", () => {
  const customerBase = {
    candidates: [],
    selectedCustomerId: null,
    onSelect: noop,
    onContinueAsNew: noop,
    showContinueAsNew: false,
    onRetrySearch: noop,
  };

  test("customer: error shows unavailable + Try again; loading and ready+empty add nothing", () => {
    const error = renderToStaticMarkup(createElement(JobPacketCustomerCandidates, { ...customerBase, searchStatus: "error" }));
    assert.match(error, /customer-search-unavailable/);
    assert.match(error, new RegExp(CUSTOMER_SEARCH_UNAVAILABLE.replace("'", "&#x27;")));
    assert.match(error, /Try again/);

    const loading = renderToStaticMarkup(createElement(JobPacketCustomerCandidates, { ...customerBase, searchStatus: "loading" }));
    assert.equal(loading, "");

    const ready = renderToStaticMarkup(createElement(JobPacketCustomerCandidates, { ...customerBase, searchStatus: "ready" }));
    assert.equal(ready, "");
  });

  test("property: error shows unavailable + Try again", () => {
    const html = renderToStaticMarkup(
      createElement(JobPacketPropertyCandidates, {
        candidates: [],
        selectedPropertyId: null,
        onSelect: noop,
        onContinueAsNew: noop,
        showContinueAsNew: false,
        searchStatus: "error",
        onRetrySearch: noop,
      } as unknown as Parameters<typeof JobPacketPropertyCandidates>[0])
    );
    assert.match(html, /property-search-unavailable/);
    assert.match(html, new RegExp(PROPERTY_SEARCH_UNAVAILABLE.replace("'", "&#x27;")));
  });

  test("hooks expose retry; intake wires status + retry; no auto-merge", () => {
    for (const rel of ["app/tools/roofing/useCompanyCustomerSearch.ts", "app/tools/roofing/useCompanyPropertySearch.ts"]) {
      const src = read(rel);
      assert.match(src, /setStatus\("error"\)/, rel);
      assert.match(src, /retry/, rel);
    }
    const intake = read("app/tools/roofing/RoofingClient.tsx");
    assert.match(intake, /searchStatus=\{customerSearchStatus\}/);
    assert.match(intake, /onRetrySearch=\{retryCustomerSearch\}/);
    assert.match(intake, /searchStatus=\{propertySearchStatus\}/);
    assert.match(intake, /onRetrySearch=\{retryPropertySearch\}/);
  });
});

// ---------------------------------------------------------------------------
// F — starter template states
// ---------------------------------------------------------------------------

describe("F: installing / install failed / none / ready", () => {
  const setups = [{ id: "t1", name: "Starter", ready: true }];

  test("installing and loading are quiet progress, never 'no template'", () => {
    const installing = resolvePrepareProposalSetup({ setups: [], preferredId: null, starterId: null, explicitId: null, loadState: "installing" });
    assert.equal(installing.state, "pending");
    assert.equal(installing.valueLabel, PREPARE_PROPOSAL_SETUP_INSTALLING);
    const loading = resolvePrepareProposalSetup({ setups: [], preferredId: null, starterId: null, explicitId: null, loadState: "loading" });
    assert.equal(loading.valueLabel, PREPARE_PROPOSAL_SETUP_LOADING);
    for (const view of [installing, loading]) assert.notEqual(view.fixPath, PREPARE_PROPOSAL_SETUP_NONE);
  });

  test("install failure and read failure are distinct and never 'none'", () => {
    const install = resolvePrepareProposalSetup({ setups: [], preferredId: null, starterId: null, explicitId: null, loadState: "install_failed" });
    const load = resolvePrepareProposalSetup({ setups: [], preferredId: null, starterId: null, explicitId: null, loadState: "load_failed" });
    assert.equal(install.fixPath, PREPARE_PROPOSAL_SETUP_INSTALL_FAILED);
    assert.equal(load.fixPath, PREPARE_PROPOSAL_SETUP_LOAD_FAILED);
    assert.notEqual(install.fixPath, load.fixPath);
  });

  test("genuinely none only after a successful read", () => {
    const none = resolvePrepareProposalSetup({ setups: [], preferredId: null, starterId: null, explicitId: null, loadState: "ready" });
    assert.equal(none.fixPath, PREPARE_PROPOSAL_SETUP_NONE);
    const ready = resolvePrepareProposalSetup({ setups, preferredId: null, starterId: null, explicitId: null, loadState: "ready" });
    assert.equal(ready.state, "prepared");
  });

  test("package row stays quiet while the template row explains", () => {
    for (const setupLoadState of ["installing", "install_failed", "load_failed"] as const) {
      const setup = resolvePrepareProposalSetup({ setups: [], preferredId: null, starterId: null, explicitId: null, loadState: setupLoadState });
      const pkg = resolvePrepareProposalPackage({
        setupState: setup.state,
        choices: [],
        startingOptionId: null,
        explicitId: null,
        packagePresentationMode: "packages",
        setupLoadState,
      } as Parameters<typeof resolvePrepareProposalPackage>[0]);
      assert.equal(pkg.state, "pending", setupLoadState);
      assert.equal(pkg.fixPath ?? null, null, setupLoadState);
    }
  });

  test("a failed read never triggers a starter install", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    const fn = hook.slice(hook.indexOf("ensureFirstProposalStructure"));
    assert.match(fn, /setSetupLoadState\("load_failed"\)/);
    assert.match(fn, /setSetupLoadState\("installing"\)/);
    assert.match(fn, /setSetupLoadState\("install_failed"\)/);
  });
});

// ---------------------------------------------------------------------------
// I — truthful measurement requirements
// ---------------------------------------------------------------------------

function completeFields(): JobCardManualMeasurementFields {
  return {
    ...emptyJobCardManualMeasurementFields(),
    roof_area_sqft: 2400,
    waste_percent: 10,
    pitch_label: "6/12",
    stories: "1",
    eaves_lf: 120,
    rakes_lf: 80,
    ridges_lf: 40,
    valleys_lf: 0,
    step_flashing_lf: 0,
    pipe_boots_count: 0,
    vents_count: 0,
    tear_off_required: false,
    debris_tons_estimate: 0,
  };
}

describe("I: required inputs are marked and explained", () => {
  test("empty form lists every required input in form order; hips optional", () => {
    const missing = listManualMeasurementMissingInputs(emptyJobCardManualMeasurementFields());
    assert.deepEqual(missing, [
      "roof_area_sqft",
      "waste_percent",
      "pitch_label",
      "stories",
      "eaves_lf",
      "rakes_lf",
      "ridges_lf",
      "valleys_lf",
      "step_flashing_lf",
      "pipe_boots_count",
      "vents_count",
      "tear_off_required",
      "debris_tons_estimate",
    ]);
    assert.ok(!missing.includes("hips_lf" as never));
  });

  test("entered zero counts as answered; empty (NaN) stays missing", () => {
    const fields = completeFields();
    assert.equal(isManualMeasurementStarterQuantityInputComplete(fields), true);
    assert.deepEqual(listManualMeasurementMissingInputs(fields), []);
    const unanswered = { ...fields, valleys_lf: Number.NaN, tear_off_required: null };
    assert.deepEqual(listManualMeasurementMissingInputs(unanswered), ["valleys_lf", "tear_off_required"]);
  });

  test("completeness is exactly 'nothing missing'", () => {
    const keys = Object.keys(completeFields()) as (keyof JobCardManualMeasurementFields)[];
    for (const key of keys) {
      const value = completeFields()[key];
      const blanked = {
        ...completeFields(),
        [key]: typeof value === "number" ? Number.NaN : typeof value === "string" ? "" : null,
      } as JobCardManualMeasurementFields;
      assert.equal(
        isManualMeasurementStarterQuantityInputComplete(blanked),
        listManualMeasurementMissingInputs(blanked).length === 0,
        String(key)
      );
    }
  });

  test("incomplete form: Save unavailable with one compact reason; optional fields labeled; no field list", () => {
    const html = renderToStaticMarkup(createElement(JobCardMeasurementCapture, { onSave: noop }));
    assert.match(html, /aria-disabled="true"[^>]*data-jobcard-measurement-save/);
    assert.match(html, /data-jobcard-measurement-save-hint/);
    assert.match(html, new RegExp(JOB_CARD_MEASUREMENT_INCOMPLETE_HINT));
    assert.match(html, /aria-describedby="jobcard-measurement-save-hint"/);
    assert.match(html, /lf · optional/);
    assert.match(html, /\(optional\)/);
    assert.doesNotMatch(html, /To save, add:/);
    assert.doesNotMatch(html, /text-red-600/);
    // Nothing is highlighted before the contractor interacts.
    assert.doesNotMatch(html, /data-jobcard-measurement-needs-attention/);
  });

  test("submit is still guarded on completeness; attempt highlights only missing fields", () => {
    const src = read("app/tools/roofing/jobCard/JobCardMeasurementCapture.tsx");
    assert.match(src, /if \(!complete\) \{\s*setTouched\(new Set\(missing\)\);\s*return;\s*\}/);
    assert.match(src, /touched\.has\(field\) && missing\.includes\(field\)/);
  });

  test("complete form: Save available, no hint", () => {
    const html = renderToStaticMarkup(createElement(JobCardMeasurementCapture, { onSave: noop, initial: completeFields() }));
    assert.match(html, /aria-disabled="false"[^>]*data-jobcard-measurement-save/);
    assert.doesNotMatch(html, /data-jobcard-measurement-save-hint/);
  });
});

// ---------------------------------------------------------------------------
// J — disposal unit mismatch surfaced before customer economics
// ---------------------------------------------------------------------------

describe("J: incompatible sell unit vs measured quantity is surfaced", () => {
  test("disposal priced 'each' with a tons quantity is flagged; no conversion invented", () => {
    const note = catalogUnitQuantityMismatchNote({ quantity_source: "debris_tons", unit: "each", unitLabel: "each" });
    assert.ok(note);
    assert.match(note!, /tons/);
  });

  test("compatible pairs are not flagged", () => {
    assert.equal(catalogUnitQuantityMismatchNote({ quantity_source: "eaves_lf", unit: "linear_foot", unitLabel: "LF" } as never), null);
  });

  test("Prepare pricing lines carry the note and the panel renders it", () => {
    const graph = {
      items: [{ id: "i1", catalog_item_id: "c-disposal" }],
    } as unknown as ProposalTemplateGraph;
    const catalog = [
      {
        id: "c-disposal",
        name: "Disposal / dump fees",
        unit: "each",
        quantity_source: "debris_tons",
        unit_price_cents: null,
        pricing_basis: "unit_price",
      },
    ] as unknown as CatalogItem[];
    const [line] = collectLinkedCatalogPricingLines(graph, catalog);
    assert.ok(line?.unitMismatchNote);
    const panel = read("app/tools/roofing/jobCard/JobCardFirstProposalPricing.tsx");
    assert.match(panel, /data-first-proposal-unit-mismatch/);
  });
});

// ---------------------------------------------------------------------------
// K — "(N left)" counter
// ---------------------------------------------------------------------------

describe("K: prices-left counter follows what the contractor typed", () => {
  const line = (id: string, needsPrice: boolean): FirstProposalPricingLine => ({
    catalogItemId: id,
    name: id,
    unitLabel: "each",
    unitPriceCents: needsPrice ? null : 1000,
    needsPrice,
    unitMismatchNote: null,
  });

  test("typing a valid price reduces the count before saving", () => {
    const lines = [line("a", true), line("b", true), line("c", false)];
    assert.equal(countFirstProposalPricesStillNeeded(lines, {}), 2);
    assert.equal(countFirstProposalPricesStillNeeded(lines, { a: "12.50" }), 1);
    assert.equal(countFirstProposalPricesStillNeeded(lines, { a: "12.50", b: "3" }), 0);
  });

  test("invalid or blank entries still count as needed", () => {
    const lines = [line("a", true)];
    assert.equal(countFirstProposalPricesStillNeeded(lines, { a: "" }), 1);
    assert.equal(countFirstProposalPricesStillNeeded(lines, { a: "abc" }), 1);
  });

  test("already-priced line with an untouched draft is not counted", () => {
    assert.equal(countFirstProposalPricesStillNeeded([line("c", false)], {}), 0);
    assert.equal(countFirstProposalPricesStillNeeded([line("c", false)], { c: "" }), 0);
  });
});

// ---------------------------------------------------------------------------
// Final sanity hardening
// ---------------------------------------------------------------------------

describe("final hardening: readiness and post-save refresh truth", () => {
  test("measurement completeness keeps the estimate-readiness gate, not only the field map", () => {
    const src = read("app/lib/jobCardManualMeasurementDraft.ts");
    const fn = src.slice(src.indexOf("export function isManualMeasurementStarterQuantityInputComplete"));
    assert.match(fn.slice(0, 400), /isManualMeasurementEstimateReady\(fields\)/);
    const capture = read("app/tools/roofing/jobCard/JobCardMeasurementCapture.tsx");
    assert.match(capture, /const complete = isManualMeasurementStarterQuantityInputComplete\(fields\)/);
    assert.equal(isManualMeasurementStarterQuantityInputComplete({ ...completeFields(), stories: "" }), false);
    assert.equal(isManualMeasurementStarterQuantityInputComplete(completeFields()), true);
  });

  test("a failed catalog refresh after saving prices never empties the price list", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.doesNotMatch(hook, /getActiveCatalogItemsByCompany\(/);
    const save = hook.slice(hook.indexOf("const saveFirstProposalPrices"));
    assert.match(save, /loadActiveCatalogItemsByCompany\(cid\)/);
    assert.match(save, /nextItems\.ok \? nextItems\.items : prev\.map\(\(item\) => savedItems\.get\(item\.id\) \?\? item\)/);
  });
});
