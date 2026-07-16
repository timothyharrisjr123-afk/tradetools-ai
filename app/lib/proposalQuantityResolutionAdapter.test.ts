/**
 * S3D1/S3D2 — golden identity + adjusted echo computation (not persisted).
 *
 * Run: npx tsx --test app/lib/proposalQuantityResolutionAdapter.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type {
  MeasurementProposalHandoff,
  ProposalQuantitySummary,
} from "./measurementProposalHandoff";
import type { MeasurementQuantityMap } from "./measurementTypes";
import {
  alignAdjustedEchoToPersistedQuantity,
  resolveProposalLineQuantityViaAdapter,
} from "./proposalQuantityResolutionAdapter";
import {
  resolveProposalLineQuantity,
  type ProposalQuantityPreview,
  type ProposalQuantityResolverInput,
} from "./proposalQuantityResolver";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";

const COMPANY_ID = "co-adapter-test";
const TEMPLATE_ID = "tpl-adapter";
const OPTION_ID = "opt-adapter";
const SECTION_ID = "sec-adapter";

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

function assertPreviewIdentity(
  direct: ProposalQuantityPreview,
  adapted: ProposalQuantityPreview
): void {
  assert.deepEqual(adapted, direct);
  assert.equal(adapted.quantity, direct.quantity);
  assert.equal(adapted.status, direct.status);
  assert.equal(adapted.quantityDisplayLabel, direct.quantityDisplayLabel);
  assert.equal(adapted.sourceKey, direct.sourceKey);
  assert.equal(adapted.sourceLabel, direct.sourceLabel);
  assert.equal(adapted.ruleLabel, direct.ruleLabel);
  assert.equal(adapted.statusLabel, direct.statusLabel);
  assert.equal(adapted.unresolved, direct.unresolved);
}

function assertAdapterMatchesDirect(input: ProposalQuantityResolverInput): void {
  const direct = resolveProposalLineQuantity(input);
  const adapted = resolveProposalLineQuantityViaAdapter(input);
  assertPreviewIdentity(direct, adapted.preview);
  assert.equal(adapted.quantityMode, "adjusted_measurement");
}

describe("proposalQuantityResolutionAdapter — golden identity (S3D1)", () => {
  test("resolved adjusted_roof_squares matches direct resolver", () => {
    assertAdapterMatchesDirect({
      measurementHandoff: readyHandoff({ adjusted_roof_squares: 24.5 }),
      quantityMap: null,
      catalogItem: catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      templateItem: templateItem({ id: "line-shingles" }),
    });
  });

  test("fixed quantity matches direct resolver", () => {
    assertAdapterMatchesDirect({
      measurementHandoff: readyHandoff(),
      quantityMap: null,
      catalogItem: catalog({
        id: "permit",
        quantity_source: "fixed",
        default_quantity: 1,
        unit: "each",
        item_type: "fee",
      }),
      templateItem: templateItem({
        id: "line-fixed",
        quantity_rule: { mode: "fixed", fixed_quantity: 1 },
      }),
    });
  });

  test("multiplier path matches direct resolver", () => {
    assertAdapterMatchesDirect({
      measurementHandoff: readyHandoff({ adjusted_roof_squares: 20 }),
      quantityMap: null,
      catalogItem: catalog({ id: "labor", quantity_source: "adjusted_roof_squares" }),
      templateItem: templateItem({
        id: "line-mult",
        quantity_rule: {
          mode: "multiplier",
          quantity_source: "adjusted_roof_squares",
          quantity_multiplier: 1.1,
        },
      }),
    });
  });

  test("missing measurement matches direct resolver", () => {
    assertAdapterMatchesDirect({
      measurementHandoff: null,
      quantityMap: null,
      catalogItem: catalog({ id: "shingles" }),
      templateItem: templateItem({ id: "line-missing" }),
    });
  });

  test("missing quantity field matches direct resolver", () => {
    assertAdapterMatchesDirect({
      measurementHandoff: readyHandoff({ adjusted_roof_squares: null }),
      quantityMap: null,
      catalogItem: catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      templateItem: templateItem({ id: "line-null-qty" }),
    });
  });

  test("missing catalog matches direct resolver", () => {
    assertAdapterMatchesDirect({
      measurementHandoff: readyHandoff({ adjusted_roof_squares: 10 }),
      quantityMap: null,
      catalogItem: null,
      templateItem: templateItem({ id: "line-no-cat" }),
    });
  });

  test("quantity_map fallback matches direct resolver", () => {
    const quantityMap: MeasurementQuantityMap = {
      shingles_squares: 18,
      labor_squares: 18,
    };
    assertAdapterMatchesDirect({
      measurementHandoff: readyHandoff({ adjusted_roof_squares: null }),
      quantityMap,
      catalogItem: catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      templateItem: templateItem({ id: "line-map" }),
    });
  });

  test("quantityMode metadata is adjusted_measurement only", () => {
    const adapted = resolveProposalLineQuantityViaAdapter({
      measurementHandoff: readyHandoff({ adjusted_roof_squares: 12 }),
      quantityMap: null,
      catalogItem: catalog({ id: "shingles" }),
      templateItem: templateItem({ id: "line-mode" }),
    });
    assert.equal(adapted.quantityMode, "adjusted_measurement");
    assert.deepEqual(Object.keys(adapted).sort(), [
      "preview",
      "quantityMode",
      "quantityResolutionEcho",
    ]);
  });
});

describe("proposalQuantityResolutionAdapter — adjusted echo (S3D2, not persisted)", () => {
  test("resolved adjusted path produces honest echo matching preview quantity", () => {
    const input: ProposalQuantityResolverInput = {
      measurementHandoff: readyHandoff({ adjusted_roof_squares: 24.5 }),
      quantityMap: null,
      catalogItem: catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      templateItem: templateItem({ id: "line-echo-resolved" }),
    };
    const adapted = resolveProposalLineQuantityViaAdapter(input);
    const echo = adapted.quantityResolutionEcho;

    assert.equal(echo.quantity_mode, "adjusted_measurement");
    assert.equal(echo.source_measurement_key, "adjusted_roof_squares");
    assert.equal(echo.source_measurement_value, 24.5);
    assert.equal(echo.coverage_rate_used, null);
    assert.equal(echo.waste_pct_used, null);
    assert.equal(echo.rounding_mode_used, "exact");
    assert.equal(echo.resolved_purchase_quantity, 24.5);
    assert.equal(echo.resolved_purchase_quantity, adapted.preview.quantity);
  });

  test("unresolved path has null resolved_purchase_quantity and source value", () => {
    const adapted = resolveProposalLineQuantityViaAdapter({
      measurementHandoff: readyHandoff({ adjusted_roof_squares: null }),
      quantityMap: null,
      catalogItem: catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      templateItem: templateItem({ id: "line-echo-unresolved" }),
    });
    const echo = adapted.quantityResolutionEcho;
    assert.equal(adapted.preview.unresolved, true);
    assert.equal(echo.quantity_mode, "adjusted_measurement");
    assert.equal(echo.resolved_purchase_quantity, null);
    assert.equal(echo.source_measurement_value, null);
    assert.equal(echo.coverage_rate_used, null);
    assert.equal(echo.waste_pct_used, null);
    assert.equal(echo.rounding_mode_used, "exact");
  });

  test("fixed quantity path does not invent a measurement source value", () => {
    const adapted = resolveProposalLineQuantityViaAdapter({
      measurementHandoff: readyHandoff(),
      quantityMap: null,
      catalogItem: catalog({
        id: "permit",
        quantity_source: "fixed",
        default_quantity: 1,
        unit: "each",
        item_type: "fee",
      }),
      templateItem: templateItem({
        id: "line-echo-fixed",
        quantity_rule: { mode: "fixed", fixed_quantity: 1 },
      }),
    });
    const echo = adapted.quantityResolutionEcho;
    assert.equal(adapted.preview.quantity, 1);
    assert.equal(echo.resolved_purchase_quantity, 1);
    assert.equal(echo.source_measurement_value, null);
    assert.equal(echo.quantity_mode, "adjusted_measurement");
    assert.equal(echo.coverage_rate_used, null);
    assert.equal(echo.waste_pct_used, null);
  });

  test("multiplier path does not invent pre-multiplier source_measurement_value", () => {
    const adapted = resolveProposalLineQuantityViaAdapter({
      measurementHandoff: readyHandoff({ adjusted_roof_squares: 20 }),
      quantityMap: null,
      catalogItem: catalog({ id: "labor", quantity_source: "adjusted_roof_squares" }),
      templateItem: templateItem({
        id: "line-echo-mult",
        quantity_rule: {
          mode: "multiplier",
          quantity_source: "adjusted_roof_squares",
          quantity_multiplier: 1.1,
        },
      }),
    });
    const echo = adapted.quantityResolutionEcho;
    assert.equal(adapted.preview.quantity, 22);
    assert.equal(echo.resolved_purchase_quantity, 22);
    assert.equal(echo.source_measurement_key, "adjusted_roof_squares");
    // Pre-multiplier value is not exposed by the existing resolver preview.
    assert.equal(echo.source_measurement_value, null);
  });

  test("coverage_rate / waste_applies / waste_pct do not change echo or quantity", () => {
    const baseInput: ProposalQuantityResolverInput = {
      measurementHandoff: readyHandoff({
        roof_squares: 20,
        adjusted_roof_squares: 22,
        waste_percent: 10,
      }),
      quantityMap: null,
      catalogItem: catalog({
        id: "shingles",
        quantity_source: "adjusted_roof_squares",
        coverage_rate: null,
        waste_applies: false,
        waste_pct: null,
      }),
      templateItem: templateItem({ id: "line-echo-drivers" }),
    };

    const withDrivers: ProposalQuantityResolverInput = {
      ...baseInput,
      catalogItem: catalog({
        id: "shingles",
        quantity_source: "adjusted_roof_squares",
        coverage_rate: 33.3,
        waste_applies: true,
        waste_pct: 15,
      }),
    };

    const directBase = resolveProposalLineQuantity(baseInput);
    const adaptedBase = resolveProposalLineQuantityViaAdapter(baseInput);
    const adaptedDrivers = resolveProposalLineQuantityViaAdapter(withDrivers);

    assertPreviewIdentity(directBase, adaptedBase.preview);
    assertPreviewIdentity(directBase, adaptedDrivers.preview);
    assert.deepEqual(
      adaptedDrivers.quantityResolutionEcho,
      adaptedBase.quantityResolutionEcho
    );
    assert.equal(adaptedDrivers.quantityResolutionEcho.coverage_rate_used, null);
    assert.equal(adaptedDrivers.quantityResolutionEcho.waste_pct_used, null);
    assert.equal(adaptedDrivers.preview.quantity, 22);
  });
});

describe("alignAdjustedEchoToPersistedQuantity", () => {
  test("keeps source value when persisted qty matches passthrough echo", () => {
    const adapted = resolveProposalLineQuantityViaAdapter({
      measurementHandoff: readyHandoff({ adjusted_roof_squares: 24.5 }),
      quantityMap: null,
      catalogItem: catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      templateItem: templateItem({ id: "line-align" }),
    });
    const aligned = alignAdjustedEchoToPersistedQuantity(
      adapted.quantityResolutionEcho,
      24.5
    );
    assert.equal(aligned.resolved_purchase_quantity, 24.5);
    assert.equal(aligned.source_measurement_value, 24.5);
  });

  test("clears source value for manual qty alignment", () => {
    const adapted = resolveProposalLineQuantityViaAdapter({
      measurementHandoff: readyHandoff({ adjusted_roof_squares: 24.5 }),
      quantityMap: null,
      catalogItem: catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      templateItem: templateItem({ id: "line-align-manual" }),
    });
    const aligned = alignAdjustedEchoToPersistedQuantity(
      adapted.quantityResolutionEcho,
      30,
      { clearSourceMeasurementValue: true }
    );
    assert.equal(aligned.resolved_purchase_quantity, 30);
    assert.equal(aligned.source_measurement_value, null);
    assert.equal(aligned.quantity_mode, "adjusted_measurement");
  });
});

describe("proposalQuantityResolutionAdapter — catalog drivers ignored under adjusted mode", () => {
  test("coverage_rate / waste_applies / waste_pct do not change adapted preview", () => {
    const baseInput: ProposalQuantityResolverInput = {
      measurementHandoff: readyHandoff({
        roof_squares: 20,
        adjusted_roof_squares: 22,
        waste_percent: 10,
      }),
      quantityMap: null,
      catalogItem: catalog({
        id: "shingles",
        quantity_source: "adjusted_roof_squares",
        coverage_rate: null,
        waste_applies: false,
        waste_pct: null,
      }),
      templateItem: templateItem({ id: "line-drivers" }),
    };

    const withDrivers: ProposalQuantityResolverInput = {
      ...baseInput,
      catalogItem: catalog({
        id: "shingles",
        quantity_source: "adjusted_roof_squares",
        coverage_rate: 33.3,
        waste_applies: true,
        waste_pct: 15,
      }),
    };

    const directBase = resolveProposalLineQuantity(baseInput);
    const adaptedBase = resolveProposalLineQuantityViaAdapter(baseInput);
    const adaptedDrivers = resolveProposalLineQuantityViaAdapter(withDrivers);

    assertPreviewIdentity(directBase, adaptedBase.preview);
    assertPreviewIdentity(directBase, adaptedDrivers.preview);
    assert.equal(adaptedDrivers.preview.quantity, 22);
    assert.equal(adaptedDrivers.quantityMode, "adjusted_measurement");
  });
});
