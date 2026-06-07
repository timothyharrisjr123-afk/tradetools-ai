/**
 * Pure unit tests for proposalQuantityResolver.ts (3H-3).
 *
 * Run: npx tsx --test app/lib/proposalQuantityResolver.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import type { MeasurementProposalHandoff, ProposalQuantitySummary } from "./measurementProposalHandoff";
import type { MeasurementQuantityMap } from "./measurementTypes";
import { resolveProposalLineQuantity } from "./proposalQuantityResolver";
import type { ProposalTemplateItem } from "./proposalTemplateTypes";

const COMPANY_ID = "co-test";
const TEMPLATE_ID = "tpl-1";
const OPTION_ID = "opt-1";
const SECTION_ID = "sec-1";

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

function notReadyHandoff(): MeasurementProposalHandoff {
  return {
    proposalReady: false,
    blockers: ["Save measurement first"],
    selectedLabel: "Not saved",
    quantities: emptyQuantities(),
    estimateReady: false,
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

function resolve(
  catalogItem: CatalogItem | null,
  templateItemOverrides: Partial<ProposalTemplateItem> & Pick<ProposalTemplateItem, "id">,
  handoff: MeasurementProposalHandoff | null = readyHandoff(),
  quantityMap: MeasurementQuantityMap | null = null
) {
  return resolveProposalLineQuantity({
    measurementHandoff: handoff,
    quantityMap,
    catalogItem,
    templateItem: templateItem(templateItemOverrides),
  });
}

describe("resolveProposalLineQuantity — area / square drivers", () => {
  test("adjusted_roof_squares from handoff resolves square-based line", () => {
    const result = resolve(
      catalog({ id: "shingles", quantity_source: "adjusted_roof_squares", unit: "square" }),
      { id: "line-shingles" },
      readyHandoff({ adjusted_roof_squares: 24.5 })
    );
    assert.equal(result.status, "resolved");
    assert.equal(result.quantity, 24.5);
    assert.equal(result.unresolved, false);
    assert.equal(result.sourceKey, "adjusted_roof_squares");
    assert.match(result.quantityDisplayLabel, /24\.5 SQ/);
  });

  test("roof_area_sqft resolves sqft unit display", () => {
    const result = resolve(
      catalog({ id: "underlay", quantity_source: "roof_area_sqft", unit: "sqft" }),
      { id: "line-underlay" },
      readyHandoff({ roof_area_sqft: 2400 })
    );
    assert.equal(result.status, "resolved");
    assert.equal(result.quantity, 2400);
    assert.match(result.quantityDisplayLabel, /sq ft/i);
  });

  test("falls back to quantity_map shingles_squares when handoff summary is null", () => {
    const result = resolve(
      catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      { id: "line-map" },
      readyHandoff({ adjusted_roof_squares: null }),
      { shingles_squares: 26 }
    );
    assert.equal(result.status, "resolved");
    assert.equal(result.quantity, 26);
    assert.equal(result.unresolved, false);
  });

  test("waste-adjusted quantity is upstream — resolver uses supplied handoff value", () => {
    const result = resolve(
      catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      { id: "line-waste" },
      readyHandoff({ roof_squares: 20, adjusted_roof_squares: 22, waste_percent: 10 })
    );
    assert.equal(result.quantity, 22);
    assert.equal(result.status, "resolved");
  });
});

describe("resolveProposalLineQuantity — linear drivers", () => {
  test("eaves_lf resolves LF quantity", () => {
    const result = resolve(
      catalog({ id: "eaves", quantity_source: "eaves_lf", unit: "linear_foot" }),
      { id: "line-eaves" },
      readyHandoff({ eaves_lf: 120 })
    );
    assert.equal(result.quantity, 120);
    assert.equal(result.sourceKey, "eaves_lf");
    assert.match(result.quantityDisplayLabel, /120 LF/);
  });

  test("rakes_lf resolves LF quantity", () => {
    const result = resolve(
      catalog({ id: "rakes", quantity_source: "rakes_lf", unit: "linear_foot" }),
      { id: "line-rakes" },
      readyHandoff({ rakes_lf: 85 })
    );
    assert.equal(result.quantity, 85);
    assert.equal(result.sourceKey, "rakes_lf");
  });

  test("ridges_lf and hips_lf resolve independently", () => {
    const ridges = resolve(
      catalog({ id: "ridges", quantity_source: "ridges_lf", unit: "linear_foot" }),
      { id: "line-ridges" },
      readyHandoff({ ridges_lf: 40 })
    );
    const hips = resolve(
      catalog({ id: "hips", quantity_source: "hips_lf", unit: "linear_foot" }),
      { id: "line-hips" },
      readyHandoff({ hips_lf: 30 })
    );
    assert.equal(ridges.quantity, 40);
    assert.equal(hips.quantity, 30);
  });

  test("valleys_lf resolves from handoff summary", () => {
    const result = resolve(
      catalog({ id: "valleys", quantity_source: "valleys_lf", unit: "linear_foot" }),
      { id: "line-valleys" },
      readyHandoff({ valleys_lf: 55 })
    );
    assert.equal(result.quantity, 55);
    assert.equal(result.sourceKey, "valleys_lf");
  });

  test("valleys_lf falls back to quantity_map valley_flashing_lf", () => {
    const result = resolve(
      catalog({ id: "valleys", quantity_source: "valleys_lf", unit: "linear_foot" }),
      { id: "line-valley-map" },
      readyHandoff({ valleys_lf: null }),
      { valley_flashing_lf: 48 }
    );
    assert.equal(result.quantity, 48);
    assert.equal(result.unresolved, false);
  });

  test("starter_lf derives from eaves + rakes when not directly set", () => {
    const result = resolve(
      catalog({ id: "starter", quantity_source: "starter_lf", unit: "linear_foot" }),
      { id: "line-starter" },
      readyHandoff({ eaves_lf: 100, rakes_lf: 50, starter_lf: null })
    );
    assert.equal(result.quantity, 150);
    assert.equal(result.sourceKey, "starter_lf");
  });

  test("ridge_cap_lf derives from ridges + hips when not directly set", () => {
    const result = resolve(
      catalog({ id: "ridge-cap", quantity_source: "ridge_cap_lf", unit: "linear_foot" }),
      { id: "line-ridge-cap" },
      readyHandoff({ ridges_lf: 40, hips_lf: 20, ridge_cap_lf: null })
    );
    assert.equal(result.quantity, 60);
  });
});

describe("resolveProposalLineQuantity — count / each drivers", () => {
  test("pipe_boots_count resolves each quantity", () => {
    const result = resolve(
      catalog({ id: "pipe-boot", quantity_source: "pipe_boots_count", unit: "each" }),
      { id: "line-pipe" },
      readyHandoff({ pipe_boots_count: 4 })
    );
    assert.equal(result.quantity, 4);
    assert.match(result.quantityDisplayLabel, /4 each/);
  });

  test("vents_count resolves from handoff", () => {
    const result = resolve(
      catalog({ id: "vent", quantity_source: "vents_count", unit: "each" }),
      { id: "line-vent" },
      readyHandoff({ vents_count: 3 })
    );
    assert.equal(result.quantity, 3);
  });

  test("pipe_boots falls back to quantity_map when summary is null", () => {
    const result = resolve(
      catalog({ id: "pipe-boot", quantity_source: "pipe_boots_count", unit: "each" }),
      { id: "line-pipe-map" },
      readyHandoff({ pipe_boots_count: null }),
      { pipe_boots: 2 }
    );
    assert.equal(result.quantity, 2);
    assert.equal(result.unresolved, false);
  });
});

describe("resolveProposalLineQuantity — missing quantity", () => {
  test("missing measurement field returns unresolved, not fake quantity", () => {
    const result = resolve(
      catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      { id: "line-missing" },
      readyHandoff({ adjusted_roof_squares: null }),
      null
    );
    assert.equal(result.status, "missing_quantity_field");
    assert.equal(result.quantity, null);
    assert.equal(result.unresolved, true);
    assert.equal(result.quantityDisplayLabel, "Not resolved");
  });

  test("measurement not ready blocks resolution", () => {
    const result = resolve(
      catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      { id: "line-not-ready" },
      notReadyHandoff()
    );
    assert.equal(result.status, "missing_measurement");
    assert.equal(result.quantity, null);
    assert.equal(result.unresolved, true);
    assert.match(result.statusLabel, /Save measurement first/i);
  });

  test("null handoff returns missing_measurement", () => {
    const result = resolveProposalLineQuantity({
      measurementHandoff: null,
      quantityMap: null,
      catalogItem: catalog({ id: "shingles" }),
      templateItem: templateItem({ id: "line-null-handoff" }),
    });
    assert.equal(result.status, "missing_measurement");
    assert.equal(result.unresolved, true);
  });
});

describe("resolveProposalLineQuantity — unsupported drivers", () => {
  test("custom catalog quantity_source returns unsupported_rule", () => {
    const result = resolve(
      catalog({ id: "custom", quantity_source: "custom" }),
      { id: "line-custom" }
    );
    assert.equal(result.status, "unsupported_rule");
    assert.equal(result.quantity, null);
    assert.equal(result.unresolved, true);
  });

  test("labor_multiplier catalog quantity_source returns unsupported_rule", () => {
    const result = resolve(
      catalog({ id: "labor-mult", quantity_source: "labor_multiplier" }),
      { id: "line-labor-mult" }
    );
    assert.equal(result.status, "unsupported_rule");
    assert.equal(result.unresolved, true);
  });

  test("measurement mode with measurement_quantity_key but no quantity_source is unsupported", () => {
    const result = resolve(
      catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      {
        id: "line-bad-rule",
        quantity_rule: { mode: "measurement", measurement_quantity_key: "custom_key" },
      }
    );
    assert.equal(result.status, "unsupported_rule");
    assert.equal(result.unresolved, true);
  });
});

describe("resolveProposalLineQuantity — catalog / template mapping", () => {
  test("template measurement rule with quantity_source overrides catalog driver", () => {
    const result = resolve(
      catalog({ id: "generic", quantity_source: "adjusted_roof_squares", unit: "linear_foot" }),
      {
        id: "line-rule",
        quantity_rule: { mode: "measurement", quantity_source: "eaves_lf" },
      },
      readyHandoff({ adjusted_roof_squares: 22, eaves_lf: 140 })
    );
    assert.equal(result.quantity, 140);
    assert.equal(result.sourceKey, "eaves_lf");
  });

  test("multiplier mode applies quantity_multiplier to resolved measurement", () => {
    const result = resolve(
      catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      {
        id: "line-mult",
        quantity_rule: {
          mode: "multiplier",
          quantity_source: "adjusted_roof_squares",
          quantity_multiplier: 1.1,
        },
      },
      readyHandoff({ adjusted_roof_squares: 20 })
    );
    assert.equal(result.quantity, 22);
    assert.equal(result.status, "resolved");
  });

  test("fixed quantity mode uses rule fixed_quantity", () => {
    const result = resolve(
      catalog({ id: "fixed-item", quantity_source: "fixed", unit: "each" }),
      {
        id: "line-fixed",
        quantity_rule: { mode: "fixed", fixed_quantity: 2 },
      }
    );
    assert.equal(result.status, "fixed_quantity");
    assert.equal(result.quantity, 2);
    assert.equal(result.unresolved, false);
  });

  test("missing catalog item returns missing_catalog", () => {
    const result = resolveProposalLineQuantity({
      measurementHandoff: readyHandoff(),
      quantityMap: null,
      catalogItem: null,
      templateItem: templateItem({ id: "line-no-catalog" }),
    });
    assert.equal(result.status, "missing_catalog");
    assert.equal(result.quantity, null);
    assert.equal(result.unresolved, true);
  });

  test("allow_manual_override sets manual_later status when quantity resolves", () => {
    const result = resolve(
      catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      {
        id: "line-manual",
        quantity_rule: { mode: "inherit_catalog", allow_manual_override: true },
      },
      readyHandoff({ adjusted_roof_squares: 18 })
    );
    assert.equal(result.status, "manual_later");
    assert.equal(result.quantity, 18);
    assert.equal(result.unresolved, false);
  });
});

describe("resolveProposalLineQuantity — unit display", () => {
  test("square unit formats as SQ", () => {
    const result = resolve(
      catalog({ id: "sq", quantity_source: "adjusted_roof_squares", unit: "square" }),
      { id: "line-sq" },
      readyHandoff({ adjusted_roof_squares: 22 })
    );
    assert.match(result.quantityDisplayLabel, /22 SQ/);
  });

  test("linear_foot unit formats as LF", () => {
    const result = resolve(
      catalog({ id: "lf", quantity_source: "eaves_lf", unit: "linear_foot" }),
      { id: "line-lf" },
      readyHandoff({ eaves_lf: 100 })
    );
    assert.match(result.quantityDisplayLabel, /100 LF/);
  });

  test("each unit formats as each — no implicit unit conversion", () => {
    const result = resolve(
      catalog({ id: "ea", quantity_source: "vents_count", unit: "each" }),
      { id: "line-ea" },
      readyHandoff({ vents_count: 5 })
    );
    assert.match(result.quantityDisplayLabel, /5 each/);
    assert.doesNotMatch(result.quantityDisplayLabel, /SQ|LF/i);
  });
});

describe("resolveProposalLineQuantity — guardrails", () => {
  test("zero quantity resolves as valid finite quantity", () => {
    const result = resolve(
      catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      { id: "line-zero" },
      readyHandoff({ adjusted_roof_squares: 0 })
    );
    assert.equal(result.status, "resolved");
    assert.equal(result.quantity, 0);
    assert.equal(result.unresolved, false);
  });

  test("negative quantity passes through resolver — rejection is engine responsibility", () => {
    const result = resolve(
      catalog({ id: "shingles", quantity_source: "adjusted_roof_squares" }),
      { id: "line-negative" },
      readyHandoff({ adjusted_roof_squares: -5 })
    );
    assert.equal(result.quantity, -5);
    assert.equal(result.status, "resolved");
    assert.equal(result.unresolved, false);
  });

  test("fixed mode without fixed value returns missing_quantity_field", () => {
    const result = resolve(
      catalog({ id: "fixed-empty", quantity_source: "adjusted_roof_squares", default_quantity: null }),
      {
        id: "line-fixed-missing",
        quantity_rule: { mode: "fixed" },
      }
    );
    assert.equal(result.status, "missing_quantity_field");
    assert.equal(result.quantity, null);
    assert.equal(result.unresolved, true);
  });

  test("tear_off_squares missing returns explicit status message", () => {
    const result = resolve(
      catalog({ id: "tear-off", quantity_source: "tear_off_squares", unit: "square" }),
      { id: "line-tear-off" },
      readyHandoff()
    );
    assert.equal(result.status, "missing_quantity_field");
    assert.equal(result.unresolved, true);
    assert.match(result.statusLabel, /tear-off/i);
  });
});
