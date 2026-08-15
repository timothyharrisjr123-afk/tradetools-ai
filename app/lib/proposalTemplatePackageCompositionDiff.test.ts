/**
 * V2E2A — Template adapter + starter Roof replacement step-up goldens.
 *
 * Run: npx tsx --test app/lib/proposalTemplatePackageCompositionDiff.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "./defaultRoofingCatalog";
import { DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS } from "./defaultRoofingProposalTemplates";
import {
  buildPackageStepUpChain,
  inheritCatalogQuantity,
  type PackageComposition,
} from "./packageComposition";
import type { CatalogItem } from "./catalogTypes";
import type { ProposalTemplateGraph } from "./proposalTemplateStore";
import type {
  ProposalTemplateItem,
  ProposalTemplateOption,
  ProposalTemplateSection,
  TemplateQuantityRule,
} from "./proposalTemplateTypes";
import {
  adaptTemplateGraphToPackageCompositions,
  buildPackageCompositionDiff,
  buildTemplatePackageStepUpChain,
  resolvePackageCompositionComparisonBaseOptionId,
  resolveTemplateItemDualIdentity,
} from "./proposalTemplatePackageCompositionDiff";

const COMPANY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TEMPLATE = "tttttttt-tttt-4ttt-8ttt-tttttttttttt";
const OPT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OPT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAT_SHINGLE = "11111111-1111-4111-8111-111111111111";
const CAT_DESIGNER = "22222222-2222-4222-8222-222222222222";

function catalog(overrides: Partial<CatalogItem> & { id: string; name: string }): CatalogItem {
  return {
    company_id: COMPANY,
    item_type: "material",
    unit: "square",
    quantity_source: "adjusted_roof_squares",
    pricing_basis: "unit_price",
    customer_visibility: "customer_visible",
    active: true,
    unit_cost_cents: 10_000,
    unit_price_cents: 25_000,
    customer_name: overrides.customer_name ?? overrides.name,
    ...overrides,
  };
}

function option(
  id: string,
  label: string,
  sort: number,
  isDefault = false
): ProposalTemplateOption {
  return {
    id,
    template_id: TEMPLATE,
    name: label,
    customer_label: label,
    is_default: isDefault,
    sort_order: sort,
    visible_to_customer: true,
  };
}

function section(
  id: string,
  optionId: string,
  kind: "line_items" | "upgrade_group",
  sort: number
): ProposalTemplateSection {
  return {
    id,
    template_id: TEMPLATE,
    option_id: optionId,
    kind,
    name: kind,
    sort_order: sort,
    customer_visibility: "customer_visible",
  };
}

function item(input: {
  id: string;
  optionId: string;
  sectionId: string;
  catalogItemId: string | null;
  seed?: string | null;
  override?: string | null;
  qty?: TemplateQuantityRule | null;
  role?: ProposalTemplateItem["item_role"];
  sort?: number;
}): ProposalTemplateItem {
  return {
    id: input.id,
    template_id: TEMPLATE,
    option_id: input.optionId,
    section_id: input.sectionId,
    catalog_item_id: input.catalogItemId,
    catalog_seed_key: input.seed ?? null,
    item_role: input.role ?? "standard",
    customer_name_override: input.override ?? null,
    quantity_rule: input.qty ?? { mode: "inherit_catalog" },
    sort_order: input.sort ?? 10,
  };
}

function graph(input: {
  options: ProposalTemplateOption[];
  sections: ProposalTemplateSection[];
  items: ProposalTemplateItem[];
}): ProposalTemplateGraph {
  return {
    template: {
      id: TEMPLATE,
      company_id: COMPANY,
      name: "Roof replacement",
      status: "active",
      active: true,
    },
    options: input.options,
    sections: input.sections,
    items: input.items,
  };
}

function compositionsFromStarterSeed(): PackageComposition[] {
  const catalogNameBySeed = new Map(
    DEFAULT_ROOFING_CATALOG_DEFINITIONS.map((row) => [row.metadata.seed_key, row.name])
  );
  const def = DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0];
  assert.ok(def);
  return def.options.map((opt) => {
    const lineSection = opt.sections.find((s) => s.kind === "line_items");
    const upgradeSection = opt.sections.find((s) => s.kind === "upgrade_group");
    const toEntry = (
      row: NonNullable<typeof lineSection>["items"] extends readonly (infer I)[] | undefined
        ? I
        : never,
      role: "included" | "optional_upgrade",
      packageId: string
    ) => {
      const seed = row.catalog_seed_key;
      const productName = catalogNameBySeed.get(seed) ?? seed;
      return {
        entryId: `${packageId}:${seed}:${role}`,
        packageId,
        role,
        compositionRole: row.composition_role ?? null,
        compositionSlotKey: row.composition_slot_key ?? null,
        productId: seed,
        provenanceKey: seed,
        customerLabel: row.customer_name_override ?? productName,
        productName,
        quantity: row.quantity_rule?.mode === "fixed"
          ? {
              mode: "fixed",
              summary: `Fixed quantity ${row.quantity_rule.fixed_quantity ?? ""}`.trim(),
              fingerprint: `fixed:${row.quantity_rule.fixed_quantity ?? ""}`,
            }
          : inheritCatalogQuantity(),
        unitPriceCents: null,
      };
    };
    return {
      packageId: opt.seed_key,
      customerLabel: opt.customer_label,
      order: opt.sort_order,
      isStartingDefault: opt.is_default,
      included: (lineSection?.items ?? []).map((row) => toEntry(row, "included", opt.seed_key)),
      optionalUpgrades: (upgradeSection?.items ?? []).map((row) =>
        toEntry(row, "optional_upgrade", opt.seed_key)
      ),
    } satisfies PackageComposition;
  });
}

describe("Template adapter", () => {
  test("16. Template graph adapts to generic composition", () => {
    const g = graph({
      options: [option(OPT_A, "West Slope", 10, true), option(OPT_B, "East Slope", 20)],
      sections: [
        section("sa", OPT_A, "line_items", 10),
        section("sb", OPT_B, "line_items", 10),
      ],
      items: [
        item({
          id: "ia",
          optionId: OPT_A,
          sectionId: "sa",
          catalogItemId: CAT_SHINGLE,
          seed: "roofing.architectural_shingles",
        }),
        item({
          id: "ib",
          optionId: OPT_B,
          sectionId: "sb",
          catalogItemId: CAT_SHINGLE,
          seed: "roofing.architectural_shingles",
          override: "Premium shingle package",
        }),
      ],
    });
    const packages = adaptTemplateGraphToPackageCompositions({
      graph: g,
      catalogItems: [
        catalog({ id: CAT_SHINGLE, name: "Architectural shingles" }),
      ],
    });
    assert.equal(packages.length, 2);
    assert.equal(packages[0]?.customerLabel, "West Slope");
    assert.equal(packages[1]?.included[0]?.customerLabel, "Premium shingle package");
    assert.equal(packages[1]?.included[0]?.productName, "Architectural shingles");
    assert.equal(packages[1]?.included[0]?.provenanceKey, "roofing.architectural_shingles");
  });

  test("15. same result independent of Templates UI — adapter then domain", () => {
    const g = graph({
      options: [option(OPT_A, "Alpha", 10, true), option(OPT_B, "Bravo", 20)],
      sections: [
        section("sa", OPT_A, "line_items", 10),
        section("sb", OPT_B, "line_items", 10),
      ],
      items: [
        item({
          id: "ia",
          optionId: OPT_A,
          sectionId: "sa",
          catalogItemId: CAT_SHINGLE,
          seed: "roofing.architectural_shingles",
        }),
        item({
          id: "ib",
          optionId: OPT_B,
          sectionId: "sb",
          catalogItemId: CAT_DESIGNER,
          seed: "roofing.architectural_shingles",
        }),
      ],
    });
    const catalogs = [
      catalog({ id: CAT_SHINGLE, name: "Architectural shingles", unit_price_cents: 25_000 }),
      catalog({
        id: CAT_DESIGNER,
        name: "Designer architectural shingles",
        unit_price_cents: 32_000,
      }),
    ];
    const viaAdapter = buildPackageCompositionDiff({
      graph: g,
      catalogItems: catalogs,
      baseOptionId: OPT_A,
      targetOptionId: OPT_B,
    });
    const packages = adaptTemplateGraphToPackageCompositions({
      graph: g,
      catalogItems: catalogs,
    });
    const viaDomain = buildPackageStepUpChain(packages)[1]?.diff;
    assert.equal(viaAdapter.counts.productReplacement, 1);
    assert.equal(viaDomain?.counts.productReplacement, 1);
    assert.equal(viaAdapter.entries[0]?.unitPriceDeltaCents, 7_000);
  });

  test("step-up follows persisted order, not is_default", () => {
    const g = graph({
      options: [option(OPT_A, "First", 10, false), option(OPT_B, "Starting later", 20, true)],
      sections: [],
      items: [],
    });
    assert.equal(resolvePackageCompositionComparisonBaseOptionId(g), OPT_A);
    const chain = buildTemplatePackageStepUpChain({ graph: g, catalogItems: [] });
    assert.equal(chain[0]?.package.packageId, OPT_A);
    assert.equal(chain[1]?.previous?.packageId, OPT_A);
  });
});

describe("starter Roof replacement step-up truth", () => {
  const chain = buildPackageStepUpChain(compositionsFromStarterSeed());

  test("17. default Roof replacement produces three ordered packages", () => {
    assert.deepEqual(
      chain.map((item) => item.package.customerLabel),
      ["Standard", "Enhanced", "Premium"]
    );
    assert.equal(chain[0]?.package.isStartingDefault, true);
  });

  test("18. Enhanced step-up vs Standard", () => {
    const enhanced = chain[1];
    assert.equal(enhanced?.previous?.customerLabel, "Standard");
    assert.equal(enhanced?.diff.counts.productReplacement, 1);
    assert.equal(enhanced?.diff.counts.addedIncluded, 1);
    assert.equal(enhanced?.diff.counts.upgradeAdded, 1);
    assert.ok(enhanced?.diff.counts.labelOnly === 0 || enhanced?.diff.counts.labelOnly === 1);
    assert.ok(
      enhanced?.diff.entries.some(
        (e) => e.kind === "PRODUCT_REPLACEMENT" && /underlayment/i.test(e.title)
      )
    );
    assert.ok(
      enhanced?.diff.entries.some(
        (e) => e.kind === "ADDED_INCLUDED_SCOPE" && /eaves/i.test(e.title)
      )
    );
    assert.ok(
      enhanced?.diff.entries.some(
        (e) => e.kind === "OPTIONAL_UPGRADE_ADDED" && /ventilation/i.test(e.title)
      )
    );
  });

  test("19. Premium step-up vs Enhanced — not Standard", () => {
    const premium = chain[2];
    assert.equal(premium?.previous?.customerLabel, "Enhanced");
    assert.equal(premium?.diff.baseLabel, "Enhanced");
    assert.equal(premium?.diff.counts.productReplacement, 1);
    assert.equal(premium?.diff.counts.upgradeAdded, 0);
    assert.ok(
      premium?.diff.entries.some(
        (e) => e.kind === "PRODUCT_REPLACEMENT" && /shingle/i.test(e.title)
      )
    );
    assert.ok((premium?.diff.changeCount ?? 0) >= 1);
  });
});

describe("resolveTemplateItemDualIdentity", () => {
  test("24. dual Catalog/customer identity", () => {
    const dual = resolveTemplateItemDualIdentity(
      { customer_name_override: "Premium shingle package", catalog_seed_key: null },
      { name: "Architectural shingles", customer_name: "Shingles" }
    );
    assert.equal(dual.customerLabel, "Premium shingle package");
    assert.equal(dual.catalogProductName, "Architectural shingles");
    assert.equal(dual.showCatalogProduct, true);
  });
});
