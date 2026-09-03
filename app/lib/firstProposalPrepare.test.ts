/**
 * Commercial Wedge Group 2 — first proposal prepare helpers.
 * Run: npx tsx --test app/lib/firstProposalPrepare.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import type { CatalogItem } from "./catalogTypes";
import {
  buildFirstProposalPricingPolicyFromDraft,
  collectLinkedCatalogPricingLines,
  emptyFirstProposalPricingRulesDraft,
  firstProposalPricingComplete,
  formatCentsAsDollarInput,
  resolveFirstProposalStructureNeed,
  resolveShowFirstProposalPricing,
  resolveShowFirstProposalPricingRules,
} from "./firstProposalPrepare";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type { ProposalTemplate } from "./proposalTemplateTypes";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function catalog(partial: Partial<CatalogItem> & { id: string; name: string }): CatalogItem {
  return {
    company_id: "c1",
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "unit_price",
    customer_visibility: "customer_visible",
    active: true,
    unit_price_cents: null,
    ...partial,
  } as CatalogItem;
}

function template(id: string, seed?: string): ProposalTemplate {
  return {
    id,
    company_id: "c1",
    name: seed ? "Roof replacement" : "Custom",
    status: "active",
    active: true,
    metadata: seed ? { seed_key: seed } : {},
  } as ProposalTemplate;
}

describe("resolveFirstProposalStructureNeed", () => {
  test("blank company may bootstrap starter structure", () => {
    const need = resolveFirstProposalStructureNeed({
      activeCatalogItems: [],
      templates: [],
      preferredTemplateId: null,
      starterTemplateId: null,
    });
    assert.equal(need.needsCatalogStructure, true);
    assert.equal(need.needsTemplateStructure, true);
    assert.equal(need.mayBootstrapStarterStructure, true);
  });

  test("custom preferred template blocks starter bootstrap", () => {
    const starter = template("starter-1", "proposal.roof_replacement");
    const custom = template("custom-1");
    const need = resolveFirstProposalStructureNeed({
      activeCatalogItems: [],
      templates: [starter, custom],
      preferredTemplateId: custom.id,
      starterTemplateId: starter.id,
    });
    assert.equal(need.mayBootstrapStarterStructure, false);
  });

  test("existing starter does not need template reinstall", () => {
    const starter = template("starter-1", "proposal.roof_replacement");
    const need = resolveFirstProposalStructureNeed({
      activeCatalogItems: [catalog({ id: "i1", name: "Shingles" })],
      templates: [starter],
      preferredTemplateId: null,
      starterTemplateId: starter.id,
    });
    assert.equal(need.needsCatalogStructure, false);
    assert.equal(need.needsTemplateStructure, false);
    assert.equal(need.mayBootstrapStarterStructure, false);
  });
});

describe("collectLinkedCatalogPricingLines", () => {
  test("dedupes linked catalog items and marks missing prices (not $0)", () => {
    const items = [
      catalog({ id: "a", name: "Architectural shingles", unit_price_cents: null }),
      catalog({ id: "b", name: "Underlayment", unit_price_cents: 2500 }),
    ];
    const graph = {
      items: [
        { catalog_item_id: "a" },
        { catalog_item_id: "a" },
        { catalog_item_id: "b" },
      ],
    } as unknown as ProposalTemplateGraph;
    const lines = collectLinkedCatalogPricingLines(graph, items);
    assert.equal(lines.length, 2);
    const shingles = lines.find((row) => row.catalogItemId === "a");
    assert.ok(shingles);
    assert.equal(shingles.needsPrice, true);
    assert.equal(shingles.unitPriceCents, null);
    assert.equal(formatCentsAsDollarInput(shingles.unitPriceCents), "");
    const under = lines.find((row) => row.catalogItemId === "b");
    assert.ok(under);
    assert.equal(under.needsPrice, false);
  });

  test("pricing complete requires every linked line priced", () => {
    const lines = collectLinkedCatalogPricingLines(
      {
        items: [{ catalog_item_id: "a" }, { catalog_item_id: "b" }],
      } as unknown as ProposalTemplateGraph,
      [
        catalog({ id: "a", name: "A", unit_price_cents: 100 }),
        catalog({ id: "b", name: "B", unit_price_cents: null }),
      ]
    );
    assert.equal(firstProposalPricingComplete(lines), false);
    const priced = lines.map((row) =>
      row.catalogItemId === "b"
        ? { ...row, unitPriceCents: 200, needsPrice: false }
        : row
    );
    assert.equal(firstProposalPricingComplete(priced), true);
  });
});

describe("resolveShowFirstProposalPricing", () => {
  test("shows only for starter selection without custom preferred", () => {
    const lines = [
      {
        catalogItemId: "a",
        name: "A",
        unitLabel: "SQ",
        unitPriceCents: null,
        needsPrice: true,
      },
    ];
    assert.equal(
      resolveShowFirstProposalPricing({
        preferredTemplateId: null,
        starterTemplateId: "starter",
        selectedTemplateId: "starter",
        pricingLines: lines,
      }),
      true
    );
    assert.equal(
      resolveShowFirstProposalPricing({
        preferredTemplateId: "custom",
        starterTemplateId: "starter",
        selectedTemplateId: "starter",
        pricingLines: lines,
      }),
      false
    );
    assert.equal(
      resolveShowFirstProposalPricing({
        preferredTemplateId: null,
        starterTemplateId: "starter",
        selectedTemplateId: "other",
        pricingLines: lines,
      }),
      false
    );
  });

  test("hides when all linked starter prices exist", () => {
    assert.equal(
      resolveShowFirstProposalPricing({
        preferredTemplateId: null,
        starterTemplateId: "starter",
        selectedTemplateId: "starter",
        pricingLines: [
          {
            catalogItemId: "a",
            name: "A",
            unitLabel: "SQ",
            unitPriceCents: 100,
            needsPrice: false,
          },
        ],
      }),
      false
    );
  });
});

describe("first proposal pricing rules (policy)", () => {
  test("missing policy shows contextual rules ask", () => {
    assert.equal(
      resolveShowFirstProposalPricingRules({
        configured: false,
        source: "missing",
        policy: null,
        reason: "Company pricing policy is not configured.",
      }),
      true
    );
  });

  test("configured policy hides first-run rules UI", () => {
    assert.equal(
      resolveShowFirstProposalPricingRules({
        configured: true,
        source: "company",
        policy: {
          profitabilityType: "margin",
          defaultProfitabilityPct: 40,
          minimumProfitabilityPct: 20,
          quantityRounding: "exact",
          wasteModel: "adjusted_measurement",
          discount: null,
          tax: { salesTaxRatePct: 0, materialPurchaseTaxRatePct: null },
          subtotalOverrideCents: null,
        },
        reason: null,
      }),
      false
    );
  });

  test("empty draft does not invent margin or tax percentages", () => {
    const draft = emptyFirstProposalPricingRulesDraft();
    assert.equal(draft.defaultProfitabilityPct, "");
    assert.equal(draft.salesTaxRatePct, "");
    const built = buildFirstProposalPricingPolicyFromDraft(draft);
    assert.equal(built.ok, false);
  });

  test("build refuses blank target rate without inventing starter margin", () => {
    const built = buildFirstProposalPricingPolicyFromDraft({
      profitabilityType: "margin",
      defaultProfitabilityPct: "",
      salesTaxRatePct: "0",
    });
    assert.equal(built.ok, false);
    if (!built.ok) assert.match(built.reason, /required/i);
  });

  test("build persists contractor answers with locked structural fields only", () => {
    const built = buildFirstProposalPricingPolicyFromDraft({
      profitabilityType: "markup",
      defaultProfitabilityPct: "35",
      salesTaxRatePct: "8.25",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.policy.profitabilityType, "markup");
    assert.equal(built.policy.defaultProfitabilityPct, 35);
    assert.equal(built.policy.minimumProfitabilityPct, 35);
    assert.equal(built.policy.tax.salesTaxRatePct, 8.25);
    assert.equal(built.policy.quantityRounding, "exact");
    assert.equal(built.policy.wasteModel, "adjusted_measurement");
    assert.equal(built.policy.discount, null);
    assert.equal(built.policy.subtotalOverrideCents, null);
  });

  test("sales tax 0 is explicit contractor truth, not invented", () => {
    const built = buildFirstProposalPricingPolicyFromDraft({
      profitabilityType: "margin",
      defaultProfitabilityPct: "40",
      salesTaxRatePct: "0",
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.policy.tax.salesTaxRatePct, 0);
  });
});

describe("Group 2 wiring contracts", () => {
  test("Prepare hook uses canonical installers and catalog update", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /installDefaultRoofingCatalog/);
    assert.match(hook, /installDefaultRoofingProposalTemplates/);
    assert.match(hook, /updateCatalogItem/);
    assert.match(hook, /parseDollarsToCentsOrNull/);
    assert.match(hook, /ensureFirstProposalStructure/);
    assert.doesNotMatch(hook, /localStorage/);
    assert.doesNotMatch(hook, /onboardingPrices|temporaryPrice/);
  });

  test("Prepare keeps pricing policy in context via canonical upsert", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /getResolvedCompanyPricingPolicy/);
    assert.match(hook, /upsertCompanyPricingPolicy/);
    assert.match(hook, /buildFirstProposalPricingPolicyFromDraft/);
    assert.match(hook, /saveFirstProposalPricingRules/);
    assert.match(hook, /pricingPolicyConfigured === true/);
    assert.doesNotMatch(hook, /\/tools\/settings\/pricing/);
    assert.doesNotMatch(hook, /DEFAULT_STARTER_PRICING_POLICY/);
  });

  test("modal surfaces focused pricing without wizard copy", () => {
    const modal = read("app/tools/roofing/jobCard/JobCardCreateProposalModal.tsx");
    assert.match(modal, /JobCardFirstProposalPricing/);
    assert.match(modal, /JobCardFirstProposalPricingRules/);
    assert.match(modal, /showFirstProposalPricing/);
    assert.match(modal, /showFirstProposalPricingRules/);
    assert.doesNotMatch(modal, /Step 2 of|Installing your catalog|Configuration completed/i);
    assert.doesNotMatch(modal, /Configure pricing policy|Pricing readiness|Company pricing setup/i);
  });

  test("contextual rules UI uses contractor language and canonical copy constants", () => {
    const ui = read("app/tools/roofing/jobCard/JobCardFirstProposalPricingRules.tsx");
    assert.match(ui, /FIRST_PROPOSAL_RULES_TITLE/);
    assert.match(ui, /How do you price this work\?/);
    assert.match(ui, /Save pricing/);
    assert.doesNotMatch(ui, /\/tools\/settings\/pricing/);
    assert.doesNotMatch(ui, /Configure pricing policy|Pricing readiness/i);
  });

  test("installers remain insert-only and null-priced", () => {
    const catalogInstall = read("app/lib/defaultRoofingCatalogInstall.ts");
    const templateInstall = read("app/lib/defaultRoofingProposalTemplateInstall.ts");
    assert.match(catalogInstall, /Insert missing starter catalog rows/);
    assert.match(catalogInstall, /seed_key/);
    assert.match(templateInstall, /Insert-only/);
    const defs = read("app/lib/defaultRoofingCatalog.ts");
    assert.match(defs, /unit_price_cents: null/);
  });
});
