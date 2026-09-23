/**
 * Astra G5 starter packet preview — pure model tests.
 * Run: npx tsx --test app/lib/astraG5StarterPacketPreview.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildAstraG5StarterPacketPreviewModel,
  resolveShowFirstUseStarterDocumentPreview,
} from "./astraG5StarterPacketPreview";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "./defaultRoofingCatalog";
import { DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS } from "./defaultRoofingProposalTemplates";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("buildAstraG5StarterPacketPreviewModel", () => {
  test("derives from starter template truth with default Standard package", () => {
    const model = buildAstraG5StarterPacketPreviewModel({
      companyName: "Anderson Roofing",
      phone: "555-123-4567",
    });
    assert.ok(model);
    const starter = DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0]!;
    const standard = starter.options.find((o) => o.is_default)!;
    assert.equal(model!.templateTitle, starter.name);
    assert.equal(
      model!.selectedPackageLabel,
      standard.customer_label ?? standard.name
    );
    assert.equal(model!.packageHero.description, standard.description);
    assert.equal(model!.cover.headline.toLowerCase().includes("roof"), true);
    assert.equal(model!.cover.company.companyName, "Anderson Roofing");
    assert.equal(model!.cover.company.phone, "555-123-4567");
    assert.ok(model!.packageOptions.some((o) => o.label === "Enhanced"));
    assert.ok(model!.packageOptions.some((o) => o.label === "Premium"));
    assert.ok(model!.estimateSections[0]!.lines.length > 0);
    assert.ok(model!.detailSections.some((s) => /overview/i.test(s.title)));
  });

  test("included scope lines match starter Standard catalog seed keys (not hard-coded preview labels)", () => {
    const model = buildAstraG5StarterPacketPreviewModel(null);
    assert.ok(model);
    const starter = DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0]!;
    const standard = starter.options.find((o) => o.is_default)!;
    const lineSection = standard.sections.find((s) => s.kind === "line_items");
    const seedKeys = (lineSection?.items ?? [])
      .map((item) => (item.catalog_seed_key ?? "").trim())
      .filter(Boolean);
    assert.ok(seedKeys.length > 0);
    assert.equal(model!.estimateSections[0]!.lines.length, seedKeys.length);

    const expectedLabels = seedKeys.map((seed) => {
      const def = DEFAULT_ROOFING_CATALOG_DEFINITIONS.find(
        (row) => row.metadata.seed_key === seed
      );
      assert.ok(def, `missing catalog def for ${seed}`);
      return (def!.customer_name ?? def!.name).trim();
    });
    const actualLabels = model!.estimateSections[0]!.lines.map((l) => l.name);
    assert.deepEqual(actualLabels, expectedLabels);
  });

  test("does not invent prices, customer, property, measurement, or proposal identity", () => {
    const model = buildAstraG5StarterPacketPreviewModel({
      companyName: "Anderson Roofing",
    });
    assert.ok(model);
    assert.equal(model!.inventsPrices, false);
    assert.equal(model!.inventsCustomerIdentity, false);
    assert.equal(model!.inventsPropertyIdentity, false);
    assert.equal(model!.inventsProposalIdentity, false);
    assert.equal(model!.inventsMeasurement, false);
    assert.equal(model!.totals.show, false);
    assert.equal(model!.totals.totalLabel, null);
    assert.equal(model!.cover.customer.hasAnyField, false);
    assert.equal(model!.cover.customer.customerName, null);
    assert.equal(model!.cover.project.jobAddress, null);
    assert.equal(model!.cover.measurementSummary, null);
    assert.equal(model!.cover.meta.proposalNumber, null);
    assert.equal(model!.cover.packageSummary.pricingComplete, false);
    assert.equal(model!.cover.packageSummary.totalDisplay, null);
    for (const line of model!.estimateSections.flatMap((s) => s.lines)) {
      assert.equal(line.kind, "included");
      assert.equal(line.qtyLabel, null);
      assert.match(line.valueLabel ?? "", /included/i);
      assert.doesNotMatch(line.valueLabel ?? "", /\$|USD|\d+\.\d{2}/);
    }
  });

  test("included line labels come from catalog defs, not fabricated dollars", () => {
    const model = buildAstraG5StarterPacketPreviewModel(null);
    assert.ok(model);
    const names = model!.estimateSections[0]!.lines.map((l) => l.name);
    assert.ok(names.some((n) => /shingle/i.test(n)));
    assert.ok(names.every((n) => !/\$/.test(n)));
  });
});

describe("resolveShowFirstUseStarterDocumentPreview", () => {
  test("shows for first-use pricing gates", () => {
    assert.equal(
      resolveShowFirstUseStarterDocumentPreview({
        starterTemplateSelected: true,
        showFirstProposalPricingRules: true,
        showFirstProposalPricing: false,
      }),
      true
    );
  });

  test("shows for first proposal on job even when pricing already configured", () => {
    assert.equal(
      resolveShowFirstUseStarterDocumentPreview({
        starterTemplateSelected: false,
        showFirstProposalPricingRules: false,
        showFirstProposalPricing: false,
        firstProposalOnJob: true,
      }),
      true
    );
  });

  test("stays quiet for repeat proposal on job when pricing already configured", () => {
    assert.equal(
      resolveShowFirstUseStarterDocumentPreview({
        starterTemplateSelected: true,
        showFirstProposalPricingRules: false,
        showFirstProposalPricing: false,
        firstProposalOnJob: false,
      }),
      false
    );
  });

  test("pricing gates still show preview when starter selected on repeat job proposal", () => {
    assert.equal(
      resolveShowFirstUseStarterDocumentPreview({
        starterTemplateSelected: true,
        showFirstProposalPricingRules: true,
        showFirstProposalPricing: false,
        firstProposalOnJob: false,
      }),
      true
    );
  });

  test("hidden when non-starter template selected and not first proposal on job", () => {
    assert.equal(
      resolveShowFirstUseStarterDocumentPreview({
        starterTemplateSelected: false,
        showFirstProposalPricingRules: true,
        showFirstProposalPricing: true,
        firstProposalOnJob: false,
      }),
      false
    );
  });
});

describe("starter preview reuses Customer Preview leaf authority", () => {
  test("UI imports packet leafs — no second renderer / no fake draft graph", () => {
    const previewUi = read(
      "app/tools/roofing/proposals/preview/AstraG5StarterPacketPreview.tsx"
    );
    assert.match(previewUi, /ProposalCustomerPreviewPacketCover/);
    assert.match(previewUi, /ProposalCustomerPreviewPackageStrip/);
    assert.match(previewUi, /ProposalCustomerPreviewEstimateTable/);
    assert.match(previewUi, /ProposalCustomerPreviewPacketSection/);
    assert.doesNotMatch(previewUi, /buildProposalCustomerPreviewDocument/);
    assert.doesNotMatch(previewUi, /ProposalDraftGraph|getDraftGraph/);
    assert.doesNotMatch(previewUi, /ProposalCustomerPreviewClient/);
  });

  test("usual-roof and Prepare wire the shared starter packet preview", () => {
    const usual = read("app/tools/roofing/usual-roof/UsualRoofSetupClient.tsx");
    const prepare = read(
      "app/tools/roofing/jobCard/JobCardFirstProposalTemplatePreview.tsx"
    );
    assert.match(usual, /AstraG5StarterPacketPreview/);
    assert.match(usual, /density=\"document\"/);
    assert.doesNotMatch(usual, /createJob\(/);
    assert.match(prepare, /AstraG5StarterPacketPreview/);
    assert.match(prepare, /density=\"compact\"/);
  });
});
