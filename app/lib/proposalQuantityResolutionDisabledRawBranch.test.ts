/**
 * Historical Phase 2 fixture helper + raw echo/staleness compare coverage.
 *
 * Run: npx tsx --test app/lib/proposalQuantityResolutionDisabledRawBranch.test.ts
 *
 * Production raw_plus_waste is policy-gated on the adapter path; this helper
 * stays unwired from draft create/refresh. Default remains adjusted_measurement.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { DEFAULT_QUANTITY_MODE } from "./catalogQuantityMode";
import type { CatalogItem } from "./catalogTypes";
import { resolveCompanyPricingPolicy } from "./companyPricingPolicy";
import type { PricingPolicy } from "./proposalPricingTypes";
import {
  RAW_PLUS_WASTE_PRODUCTION_ENABLED,
  resolveDisabledRawPlusWasteQuantityBranch,
  resolveProposalLineQuantityWithDisabledRawBranch,
  type RawPlusWasteQuantityResolutionEcho,
} from "./proposalQuantityResolutionDisabledRawBranch";
import { resolveProposalLineQuantityViaAdapter } from "./proposalQuantityResolutionAdapter";
import {
  compareAdjustedQuantityResolutionEcho,
  compareRawPlusWasteQuantityResolutionEcho,
} from "./proposalQuantityResolutionStaleness";
import {
  resolveProposalLineQuantity,
  type ProposalQuantityResolverInput,
} from "./proposalQuantityResolver";
import type {
  MeasurementProposalHandoff,
  ProposalQuantitySummary,
} from "./measurementProposalHandoff";
import type { MeasurementQuantityMap } from "./measurementTypes";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";
import { composeQuantityPreflightTrustSignal } from "./proposalBuilderTrustSignals";

const COMPANY_ID = "co-disabled-raw";
const TEMPLATE_ID = "tpl-disabled-raw";
const OPTION_ID = "opt-disabled-raw";
const SECTION_ID = "sec-disabled-raw";

function emptyQuantities(): ProposalQuantitySummary {
  return {
    roof_squares: null,
    adjusted_roof_squares: null,
    roof_area_sqft: null,
    waste_percent: null,
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
  };
}

function readyHandoff(
  quantities: Partial<ProposalQuantitySummary> = {}
): MeasurementProposalHandoff {
  return {
    proposalReady: true,
    blockers: [],
    selectedLabel: "Job #1",
    quantities: { ...emptyQuantities(), ...quantities },
    estimateReady: true,
    productionReady: false,
  };
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
    ...overrides,
  };
}

function templateItem(
  overrides: Partial<ProposalTemplateItem> & Pick<ProposalTemplateItem, "id">
): ProposalTemplateItem {
  return {
    template_id: TEMPLATE_ID,
    option_id: OPTION_ID,
    section_id: SECTION_ID,
    catalog_item_id: "cat-default",
    item_role: "standard",
    ...overrides,
  };
}

function rawEcho(
  overrides: Partial<RawPlusWasteQuantityResolutionEcho> = {}
): RawPlusWasteQuantityResolutionEcho {
  return {
    quantity_mode: "raw_plus_waste",
    source_measurement_key: "roof_squares",
    source_measurement_value: 100,
    coverage_rate_used: 50,
    waste_pct_used: 10,
    rounding_mode_used: "exact",
    resolved_purchase_quantity: 2.2,
    ...overrides,
  };
}

function validCompanyPolicy(overrides: Partial<PricingPolicy> = {}): PricingPolicy {
  return {
    profitabilityType: "margin",
    defaultProfitabilityPct: 50,
    minimumProfitabilityPct: 20,
    quantityRounding: "exact",
    wasteModel: "adjusted_measurement",
    tax: { salesTaxRatePct: 0, materialPurchaseTaxRatePct: null },
    discount: null,
    subtotalOverrideCents: null,
    ...overrides,
  };
}

describe("fixture raw helper — adjusted regression identity", () => {
  test("1–4. adjusted adapter still deep-equals resolver; ignores catalog coverage/waste", () => {
    const input: ProposalQuantityResolverInput = {
      measurementHandoff: readyHandoff({ adjusted_roof_squares: 24 }),
      quantityMap: { adjusted_roof_squares: 24 } as MeasurementQuantityMap,
      catalogItem: catalog({
        id: "cat-adj",
        quantity_source: "adjusted_roof_squares",
        coverage_rate: 33.3,
        waste_applies: true,
        waste_pct: 15,
      }),
      templateItem: templateItem({ id: "ti-adj", catalog_item_id: "cat-adj" }),
    };

    const direct = resolveProposalLineQuantity(input);
    const adapted = resolveProposalLineQuantityViaAdapter(input);
    assert.deepEqual(adapted.preview, direct);
    assert.equal(adapted.quantityMode, "adjusted_measurement");
    assert.equal(adapted.quantityResolutionEcho.coverage_rate_used, null);
    assert.equal(adapted.quantityResolutionEcho.waste_pct_used, null);
    assert.equal(adapted.preview.quantity, 24);

    const composed = resolveProposalLineQuantityWithDisabledRawBranch(input, {
      rawSourceQuantity: 100,
      coverageRate: 50,
      wastePct: 10,
      wasteApplies: true,
      sourceMeasurementKey: "roof_squares",
    });
    assert.deepEqual(composed.preview, direct);
    assert.equal(composed.productionQuantityMode, "adjusted_measurement");
    assert.equal(composed.productionEnabled, false);
  });
});

describe("fixture raw helper — raw_plus_waste math/echo", () => {
  test("5. computes source → coverage → waste → exact", () => {
    const result = resolveDisabledRawPlusWasteQuantityBranch({
      rawSourceQuantity: 100,
      coverageRate: 50,
      wastePct: 10,
      wasteApplies: true,
      sourceMeasurementKey: "roof_squares",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.resolvedQuantity, 2.2);
      assert.equal(result.quantityResolutionEcho.resolved_purchase_quantity, 2.2);
      assert.equal(result.quantityResolutionEcho.rounding_mode_used, "exact");
    }
  });

  test("6. requires raw source", () => {
    for (const bad of [null, undefined, Number.NaN]) {
      const result = resolveDisabledRawPlusWasteQuantityBranch({
        rawSourceQuantity: bad as number,
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, "missing_raw_source");
        assert.equal(result.productionEnabled, false);
      }
    }
  });

  test("7. rejects adjusted/already-wasted source", () => {
    const result = resolveDisabledRawPlusWasteQuantityBranch({
      rawSourceQuantity: 110,
      sourceAlreadyAdjusted: true,
      wastePct: 10,
      wasteApplies: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "double_waste_risk");
    }
  });

  test("8. rejects invalid coverage", () => {
    const result = resolveDisabledRawPlusWasteQuantityBranch({
      rawSourceQuantity: 100,
      coverageRate: 0,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_coverage");
    }
  });

  test("9. rejects invalid waste", () => {
    const result = resolveDisabledRawPlusWasteQuantityBranch({
      rawSourceQuantity: 100,
      wastePct: -5,
      wasteApplies: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_waste");
    }
  });

  test("10. skips waste when waste_applies=false (labor/fee)", () => {
    const result = resolveDisabledRawPlusWasteQuantityBranch({
      rawSourceQuantity: 12,
      coverageRate: null,
      wastePct: 15,
      wasteApplies: false,
      sourceMeasurementKey: "fixed",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.resolvedQuantity, 12);
      assert.equal(result.quantityResolutionEcho.waste_pct_used, null);
      assert.equal(result.quantityResolutionEcho.coverage_rate_used, null);
    }
  });

  test("11. marks coverage_rate_used/waste_pct_used correctly in echo", () => {
    const result = resolveDisabledRawPlusWasteQuantityBranch({
      rawSourceQuantity: 90,
      coverageRate: 30,
      wastePct: 10,
      wasteApplies: true,
      sourceMeasurementKey: "roof_squares",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.quantityResolutionEcho.quantity_mode, "raw_plus_waste");
      assert.equal(result.quantityResolutionEcho.coverage_rate_used, 30);
      assert.equal(result.quantityResolutionEcho.waste_pct_used, 10);
      assert.equal(result.quantityResolutionEcho.source_measurement_value, 90);
      assert.ok(Math.abs((result.resolvedQuantity as number) - 3.3) < 1e-12);
    }
  });

  test("12. whole rounding remains unsupported", () => {
    const result = resolveDisabledRawPlusWasteQuantityBranch({
      rawSourceQuantity: 10,
      roundingMode: "whole",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unsupported_rounding");
    }
  });

  test("13. fixture helper stays unwired; production gate is policy on adapter", () => {
    assert.equal(RAW_PLUS_WASTE_PRODUCTION_ENABLED, false);
    assert.equal(DEFAULT_QUANTITY_MODE, "adjusted_measurement");

    const result = resolveDisabledRawPlusWasteQuantityBranch({
      rawSourceQuantity: 10,
    });
    assert.equal(result.productionEnabled, false);
    if (result.ok) {
      assert.ok(
        result.notes.some((n) => /policy-gated via adapter/i.test(n))
      );
      assert.ok(
        result.notes.some((n) => /fixture helper; not the production adapter path/i.test(n))
      );
    }

    // Production adapter imports catalogQuantityMode for policy-gated raw path,
    // but default calls stay adjusted and this helper stays unwired.
    const adapterSrc = readFileSync(
      path.join(process.cwd(), "app/lib/proposalQuantityResolutionAdapter.ts"),
      "utf8"
    );
    assert.equal(adapterSrc.includes("resolveDisabledRawPlusWaste"), false);
    assert.match(
      adapterSrc,
      /raw_plus_waste activates only when options\.wasteModel === "raw_plus_waste"/
    );
  });
});

describe("fixture raw helper — staleness/preflight compare path", () => {
  test("14. matching raw echo can compare current", () => {
    const current = rawEcho();
    const result = compareRawPlusWasteQuantityResolutionEcho({
      persistedEcho: { ...current },
      currentEcho: current,
    });
    assert.equal(result.status, "current");
    assert.deepEqual(result.reasons, []);
  });

  test("15. raw echo quantity mismatch = stale", () => {
    const result = compareRawPlusWasteQuantityResolutionEcho({
      persistedEcho: { ...rawEcho(), resolved_purchase_quantity: 9 },
      currentEcho: rawEcho(),
    });
    assert.equal(result.status, "stale");
    assert.ok(result.reasons.includes("resolved_purchase_quantity_mismatch"));
  });

  test("16. raw echo mode mismatch = stale", () => {
    const result = compareRawPlusWasteQuantityResolutionEcho({
      persistedEcho: {
        ...rawEcho(),
        quantity_mode: "adjusted_measurement",
        coverage_rate_used: null,
        waste_pct_used: null,
      },
      currentEcho: rawEcho(),
    });
    assert.equal(result.status, "stale");
    assert.ok(result.reasons.includes("quantity_mode_mismatch"));
  });

  test("17. raw echo source mismatch = stale", () => {
    const key = compareRawPlusWasteQuantityResolutionEcho({
      persistedEcho: { ...rawEcho(), source_measurement_key: "eaves_lf" },
      currentEcho: rawEcho(),
    });
    assert.equal(key.status, "stale");
    assert.ok(key.reasons.includes("source_measurement_key_mismatch"));

    const value = compareRawPlusWasteQuantityResolutionEcho({
      persistedEcho: { ...rawEcho(), source_measurement_value: 50 },
      currentEcho: rawEcho(),
    });
    assert.equal(value.status, "stale");
    assert.ok(value.reasons.includes("source_measurement_value_mismatch"));
  });

  test("18. malformed/missing echo = unknown", () => {
    const missing = compareRawPlusWasteQuantityResolutionEcho({
      persistedEcho: null,
      currentEcho: rawEcho(),
    });
    assert.equal(missing.status, "unknown");
    assert.ok(missing.reasons.includes("missing_persisted_echo"));

    const malformed = compareRawPlusWasteQuantityResolutionEcho({
      persistedEcho: ["nope"],
      currentEcho: rawEcho(),
    });
    assert.equal(malformed.status, "unknown");
    assert.ok(malformed.reasons.includes("malformed_persisted_echo"));
  });

  test("19. adjusted and raw echoes do not compare as current across modes", () => {
    const adjustedCurrent = {
      quantity_mode: "adjusted_measurement" as const,
      source_measurement_key: "adjusted_roof_squares" as const,
      source_measurement_value: 24,
      coverage_rate_used: null,
      waste_pct_used: null,
      rounding_mode_used: "exact" as const,
      resolved_purchase_quantity: 24,
    };

    const viaAdjusted = compareAdjustedQuantityResolutionEcho({
      persistedEcho: { ...rawEcho() },
      currentEcho: adjustedCurrent,
    });
    assert.equal(viaAdjusted.status, "stale");
    assert.ok(viaAdjusted.reasons.includes("quantity_mode_mismatch"));

    const viaRaw = compareRawPlusWasteQuantityResolutionEcho({
      persistedEcho: { ...adjustedCurrent },
      currentEcho: rawEcho(),
    });
    assert.equal(viaRaw.status, "stale");
    assert.ok(viaRaw.reasons.includes("quantity_mode_mismatch"));
  });

  test("20. Builder trust composer keeps stale internal/non-blocking/customerVisible=false", () => {
    const signal = composeQuantityPreflightTrustSignal({
      quantityPreflight: {
        status: "stale",
        staleCount: 1,
        unknownCount: 0,
        currentCount: 0,
      },
    });
    assert.ok(signal);
    assert.equal(signal!.status, "stale");
    assert.equal(signal!.severity, "needs_review");
    assert.equal(signal!.shouldBlock, false);
    assert.equal(signal!.shouldAutoRefresh, false);
    assert.equal(signal!.customerVisible, false);
  });
});

describe("fixture raw helper — policy / production gates", () => {
  test("21. company policy may store raw_plus_waste; helper flag stays false; default adjusted", () => {
    const result = resolveCompanyPricingPolicy({
      storedPolicy: validCompanyPolicy({
        wasteModel: "raw_plus_waste",
      }),
    });
    assert.equal(result.configured, true);
    assert.equal(result.policy?.wasteModel, "raw_plus_waste");
    // This fixture helper's flag stays false; production gate is policy on adapter.
    assert.equal(RAW_PLUS_WASTE_PRODUCTION_ENABLED, false);
    assert.equal(DEFAULT_QUANTITY_MODE, "adjusted_measurement");
  });

  test("22. migration SQL file widens waste_model CHECK only (not applied by this unit test)", () => {
    const disabledSrc = readFileSync(
      path.join(process.cwd(), "app/lib/proposalQuantityResolutionDisabledRawBranch.ts"),
      "utf8"
    );
    assert.equal(disabledSrc.includes("ALTER TABLE"), false);

    const migration = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260716_023_allow_raw_plus_waste_policy_mode.sql"
      ),
      "utf8"
    );
    assert.match(migration, /REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL/);
    assert.match(migration, /waste_model in \('adjusted_measurement', 'raw_plus_waste'\)/);
    assert.equal(migration.includes("quantity_rounding in"), false);

    const adapterSrc = readFileSync(
      path.join(process.cwd(), "app/lib/proposalQuantityResolutionAdapter.ts"),
      "utf8"
    );
    assert.equal(adapterSrc.includes("waste_model in"), false);
  });

  test("23. DEFAULT_QUANTITY_MODE remains adjusted_measurement", () => {
    assert.equal(DEFAULT_QUANTITY_MODE, "adjusted_measurement");
  });
});
