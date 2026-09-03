/**
 * Commercial Wedge Group 2 final — pricing-policy contextual Prepare.
 * Run: npx tsx --test app/lib/commercialWedgeGroup2FinalCorrection.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  DEFAULT_STARTER_PRICING_POLICY,
  resolveCompanyPricingPolicy,
} from "./companyPricingPolicy";
import {
  buildFirstProposalPricingPolicyFromDraft,
  emptyFirstProposalPricingRulesDraft,
  resolveShowFirstProposalPricing,
  resolveShowFirstProposalPricingRules,
} from "./firstProposalPrepare";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("blank company — no Pricing Settings detour", () => {
  test("Prepare hook never routes to /tools/settings/pricing", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    const modal = read("app/tools/roofing/jobCard/JobCardCreateProposalModal.tsx");
    const rules = read("app/tools/roofing/jobCard/JobCardFirstProposalPricingRules.tsx");
    for (const src of [hook, modal, rules]) {
      assert.doesNotMatch(src, /\/tools\/settings\/pricing/);
      assert.doesNotMatch(src, /Configure pricing policy/i);
      assert.doesNotMatch(src, /Pricing readiness|Company pricing setup/i);
    }
  });

  test("missing policy is handled in Prepare via canonical resolve + upsert", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /getResolvedCompanyPricingPolicy/);
    assert.match(hook, /upsertCompanyPricingPolicy/);
    assert.match(hook, /showFirstProposalPricingRules/);
    assert.match(hook, /pricingPolicyConfigured === true/);
    assert.equal(
      resolveShowFirstProposalPricingRules(
        resolveCompanyPricingPolicy({ storedPolicy: null })
      ),
      true
    );
  });

  test("no contractor pricing assumption invented from starter defaults", () => {
    const helpers = read("app/lib/firstProposalPrepare.ts");
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.doesNotMatch(helpers, /DEFAULT_STARTER_PRICING_POLICY/);
    assert.doesNotMatch(hook, /DEFAULT_STARTER_PRICING_POLICY/);
    const draft = emptyFirstProposalPricingRulesDraft();
    assert.equal(draft.defaultProfitabilityPct, "");
    assert.equal(draft.salesTaxRatePct, "");
    assert.equal(buildFirstProposalPricingPolicyFromDraft(draft).ok, false);
    // Starter seed exists for Settings form only — never auto-persisted from Prepare.
    assert.equal(DEFAULT_STARTER_PRICING_POLICY.defaultProfitabilityPct, 50);
  });
});

describe("policy state matrix at Prepare", () => {
  test("A missing row → show rules UI", () => {
    assert.equal(
      resolveShowFirstProposalPricingRules(
        resolveCompanyPricingPolicy({ storedPolicy: null })
      ),
      true
    );
  });

  test("B starter seed is not company configured → show rules UI", () => {
    // Prepare never silently persists starter; resolution of a real stored starter-shaped
    // row would be configured if valid — blank companies have no row (case A).
    const missing = resolveCompanyPricingPolicy({ storedPolicy: null });
    assert.equal(missing.configured, false);
    assert.equal(resolveShowFirstProposalPricingRules(missing), true);
  });

  test("C invalid/partial stored → not configured → show rules UI", () => {
    const partial = resolveCompanyPricingPolicy({
      storedPolicy: {
        ...DEFAULT_STARTER_PRICING_POLICY,
        defaultProfitabilityPct: Number.NaN,
      },
    });
    assert.equal(partial.configured, false);
    assert.equal(resolveShowFirstProposalPricingRules(partial), true);
  });

  test("D fully configured → hide first-run rules UI", () => {
    const configured = resolveCompanyPricingPolicy({
      storedPolicy: {
        profitabilityType: "margin",
        defaultProfitabilityPct: 42,
        minimumProfitabilityPct: 20,
        quantityRounding: "exact",
        wasteModel: "adjusted_measurement",
        discount: null,
        tax: { salesTaxRatePct: 6.5, materialPurchaseTaxRatePct: null },
        subtotalOverrideCents: null,
      },
    });
    assert.equal(configured.configured, true);
    assert.equal(resolveShowFirstProposalPricingRules(configured), false);
  });

  test("E custom existing company with policy → no first-run UI", () => {
    const custom = resolveCompanyPricingPolicy({
      storedPolicy: {
        profitabilityType: "markup",
        defaultProfitabilityPct: 55,
        minimumProfitabilityPct: 30,
        quantityRounding: "exact",
        wasteModel: "adjusted_measurement",
        discount: null,
        tax: { salesTaxRatePct: 0, materialPurchaseTaxRatePct: null },
        subtotalOverrideCents: null,
      },
    });
    assert.equal(resolveShowFirstProposalPricingRules(custom), false);
  });
});

describe("canonical write + overwrite guards", () => {
  test("contextual build uses upsert path only when not already configured", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /pricingPolicyConfigured === true/);
    assert.match(hook, /upsertCompanyPricingPolicy\(cid, built\.policy\)/);
    assert.match(hook, /onConflict:\s*"company_id"|upsertCompanyPricingPolicy/);
  });

  test("store upsert is company_id conflict (no duplicate rows on retry)", () => {
    const store = read("app/lib/companyPricingPolicyStore.ts");
    assert.match(store, /upsert\(row,\s*\{\s*onConflict:\s*"company_id"\s*\}\)/);
  });

  test("save path refuses upsert when policy already configured", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(
      hook,
      /pricingPolicyConfigured === true[\s\S]*?return;[\s\S]*?upsertCompanyPricingPolicy/
    );
  });
});

describe("proposal create still requires policy truth", () => {
  test("createEnabled requires pricingRulesComplete", () => {
    const hook = read("app/tools/roofing/jobCard/useJobCardPrepareProposal.ts");
    assert.match(hook, /pricingRulesComplete &&/);
    assert.match(hook, /if \(!pricingRulesComplete\) return;/);
  });

  test("createDraftProposal still asserts configured policy (engine gate unchanged)", () => {
    const store = read("app/lib/proposalRecordStore.ts");
    assert.match(store, /assertConfiguredPolicyForPersistence/);
    assert.match(store, /getResolvedPolicy\(companyId\)/);
  });
});

describe("Catalog focused pricing + measurement preserved", () => {
  test("Price this proposal path remains", () => {
    assert.equal(
      resolveShowFirstProposalPricing({
        preferredTemplateId: null,
        starterTemplateId: "s",
        selectedTemplateId: "s",
        pricingLines: [
          {
            catalogItemId: "a",
            name: "A",
            unitLabel: "SQ",
            unitPriceCents: null,
            needsPrice: true,
          },
        ],
      }),
      true
    );
    const modal = read("app/tools/roofing/jobCard/JobCardCreateProposalModal.tsx");
    assert.match(modal, /JobCardFirstProposalPricing/);
    assert.match(modal, /showFirstProposalPricingRules/);
  });

  test("measurement prepare field wiring unchanged", () => {
    const modal = read("app/tools/roofing/jobCard/JobCardCreateProposalModal.tsx");
    assert.match(modal, /resolvePrepareProposalMeasurement/);
    assert.match(modal, /canCreatePrepareProposal/);
    assert.match(modal, /onAddMeasurement/);
  });
});

describe("no pricing engine / authority drift", () => {
  test("correction does not touch pricing engine modules", () => {
    // Source-guard: this correction file only asserts Prepare/policy orchestration files.
    const touched = [
      "app/lib/firstProposalPrepare.ts",
      "app/tools/roofing/jobCard/useJobCardPrepareProposal.ts",
      "app/tools/roofing/jobCard/JobCardFirstProposalPricingRules.tsx",
      "app/tools/roofing/jobCard/JobCardCreateProposalModal.tsx",
      "app/tools/roofing/jobCard/JobCardClient.tsx",
    ];
    for (const rel of touched) {
      const src = read(rel);
      assert.doesNotMatch(src, /function computeLine|marginToMultiplier|applyWaste/);
    }
  });
});
