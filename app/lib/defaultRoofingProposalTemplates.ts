/**
 * Passive default roofing proposal template definitions for FieldDive.
 *
 * These definitions do not insert rows, call Supabase, or use proposalTemplateStore.
 * Future install flows (3G5) clone them into company-owned proposal template tables.
 *
 * Roofr-style structure: one internal template, customer-facing options (packages),
 * sections (line items, upgrades, text/warranty/terms), catalog-backed items via seed_key.
 * No pricing, totals, legal terms, or Proposal Builder behavior in this file.
 *
 * Optional Upgrade Truth (v2):
 * - Package-included enhancements live on line_items via customer overrides.
 * - upgrade_group holds only true elective add-ons (additive, default unselected).
 */

import type { CustomerVisibility } from "@/app/lib/catalogTypes";
import type {
  DefaultProposalTemplateDefinition,
  DefaultProposalTemplateItemDefinition,
  DefaultProposalTemplateOptionDefinition,
  DefaultProposalTemplateSectionDefinition,
  TemplateQuantityRule,
} from "@/app/lib/proposalTemplateTypes";

export const DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY = "proposal.roof_replacement";

/** Metadata stamp for Optional Upgrade Truth starter semantics. */
export const OPTIONAL_UPGRADE_TRUTH_VERSION = 2 as const;

const CUSTOMER_VISIBLE: CustomerVisibility = "customer_visible";

const INHERIT_CATALOG_QUANTITY: TemplateQuantityRule = {
  mode: "inherit_catalog",
};

/** Incremental elective unit — not a reprice of the package measurement driver. */
const ADDITIONAL_VENT_QUANTITY: TemplateQuantityRule = {
  mode: "fixed",
  fixed_quantity: 1,
  allow_manual_override: true,
};

type CoreLineSeed = {
  catalog_seed_key: string;
  sort_order: number;
};

/** Catalog seed keys and sort order aligned with defaultRoofingCatalog.ts. */
const CORE_LINE_SEEDS: readonly CoreLineSeed[] = [
  { catalog_seed_key: "roofing.architectural_shingles", sort_order: 10 },
  { catalog_seed_key: "roofing.synthetic_underlayment", sort_order: 20 },
  { catalog_seed_key: "roofing.starter_strip", sort_order: 30 },
  { catalog_seed_key: "roofing.ridge_cap", sort_order: 40 },
  { catalog_seed_key: "roofing.drip_edge", sort_order: 50 },
  { catalog_seed_key: "roofing.ice_water_valley", sort_order: 60 },
  { catalog_seed_key: "roofing.pipe_boot", sort_order: 70 },
  { catalog_seed_key: "roofing.roof_vent", sort_order: 80 },
  { catalog_seed_key: "roofing.step_flashing", sort_order: 90 },
  { catalog_seed_key: "roofing.install_labor", sort_order: 100 },
  { catalog_seed_key: "roofing.tear_off_labor", sort_order: 110 },
  { catalog_seed_key: "roofing.disposal", sort_order: 120 },
  { catalog_seed_key: "roofing.permit_admin_fee", sort_order: 130 },
] as const;

/**
 * Shared core replacement line items (13 catalog seeds) for reuse across options and 3G5 install.
 * Callers that need per-option overrides must map/copy — do not mutate this constant.
 */
export const ROOF_REPLACEMENT_CORE_LINE_ITEMS: readonly DefaultProposalTemplateItemDefinition[] =
  CORE_LINE_SEEDS.map(({ catalog_seed_key, sort_order }) => ({
    catalog_seed_key,
    item_role: "standard",
    customer_visibility: "inherit_catalog",
    quantity_rule: INHERIT_CATALOG_QUANTITY,
    sort_order,
  }));

type LineItemOverride = {
  customer_name_override: string;
  description_override: string;
};

const ENHANCED_LINE_OVERRIDES: Readonly<Record<string, LineItemOverride>> = {
  "roofing.synthetic_underlayment": {
    customer_name_override: "Enhanced underlayment",
    description_override:
      "Enhanced underlayment protection included in this package. Product details confirmed by the contractor.",
  },
  "roofing.ice_water_valley": {
    customer_name_override: "Enhanced ice and water protection",
    description_override:
      "Enhanced ice and water protection included in this package. Scope confirmed on site.",
  },
};

const PREMIUM_LINE_OVERRIDES: Readonly<Record<string, LineItemOverride>> = {
  "roofing.architectural_shingles": {
    customer_name_override: "Premium shingle package",
    description_override:
      "Premium shingle selection included in this package. Product and scope confirmed by the contractor.",
  },
  "roofing.synthetic_underlayment": {
    customer_name_override: "Enhanced underlayment",
    description_override:
      "Enhanced underlayment protection included in this package. Product details confirmed by the contractor.",
  },
  "roofing.ice_water_valley": {
    customer_name_override: "Enhanced ice and water protection",
    description_override:
      "Enhanced ice and water protection included in this package. Scope confirmed on site.",
  },
};

/**
 * True optional add-on shared by Enhanced and Premium.
 * Same catalog family as included roof vents, but incremental fixed quantity (not inherit_catalog).
 */
const ADDITIONAL_ROOF_VENTILATION_UPGRADE: DefaultProposalTemplateItemDefinition = {
  catalog_seed_key: "roofing.roof_vent",
  item_role: "optional_addon",
  customer_name_override: "Additional roof ventilation",
  description_override:
    "Optional additional ventilation beyond the package’s included vents. Select only when extra units are needed.",
  customer_visibility: "inherit_catalog",
  quantity_rule: ADDITIONAL_VENT_QUANTITY,
  upgrade_effect: "additive",
  default_selected: false,
  sort_order: 10,
};

function cloneCoreLineItemsWithOverrides(
  overrides: Readonly<Record<string, LineItemOverride>>
): DefaultProposalTemplateItemDefinition[] {
  return ROOF_REPLACEMENT_CORE_LINE_ITEMS.map((item) => {
    const override = overrides[item.catalog_seed_key];
    if (!override) {
      return { ...item, quantity_rule: item.quantity_rule ? { ...item.quantity_rule } : undefined };
    }
    return {
      ...item,
      quantity_rule: item.quantity_rule ? { ...item.quantity_rule } : undefined,
      customer_name_override: override.customer_name_override,
      description_override: override.description_override,
    };
  });
}

const PROJECT_OVERVIEW_BODY = `This proposal outlines the recommended roofing work for your property based on the current job information, selected package, and contractor review.

The Estimate page shows the selected option, itemized roofing scope, quantities, and pricing. Supporting pages provide warranty, terms, and project notes so you can review the work clearly before approval.

Final scope details, site conditions, and any open items are confirmed by your contractor before work begins.`;

const SCOPE_NOTES_BODY = `Scope notes help clarify what is included, what may need confirmation, and any assumptions behind the proposal. Your final scope is based on the selected package, resolved line items, and contractor review.

If additional work is discovered or requested, your contractor will review the change before it is added to the project.`;

const WARRANTY_BODY = `Roofing warranties typically include two parts: manufacturer coverage for eligible material defects and workmanship coverage for installation-related issues.

Manufacturer coverage depends on the selected products and manufacturer terms. Workmanship coverage is provided by the contractor and should be reviewed with your final proposal documents.

Your contractor will confirm the applicable warranty details for the selected package before approval.`;

const TERMS_BODY = `Terms and conditions outline how the proposal is reviewed, approved, and completed. Final terms should be confirmed by the contractor before acceptance.

Items such as payment schedule, project timing, exclusions, change requests, site conditions, and warranty references may be completed or updated before the proposal is sent.

Any changes to the approved scope should be reviewed and confirmed in writing before being added to the project.`;

function sectionSeedKey(optionSeedKey: string, suffix: string): string {
  return `${optionSeedKey}${suffix}`;
}

function buildOptionSections(
  optionSeedKey: string,
  lineItems: readonly DefaultProposalTemplateItemDefinition[],
  upgradeItems: readonly DefaultProposalTemplateItemDefinition[]
): readonly DefaultProposalTemplateSectionDefinition[] {
  return [
    {
      kind: "text",
      name: "Project overview",
      customer_title: "Project overview",
      customer_visibility: CUSTOMER_VISIBLE,
      sort_order: 10,
      seed_key: sectionSeedKey(optionSeedKey, ".overview"),
      content: {
        title: "Project overview",
        body_markdown: PROJECT_OVERVIEW_BODY,
      },
    },
    {
      kind: "line_items",
      name: "Roof replacement scope",
      customer_title: "Roof replacement scope",
      customer_visibility: CUSTOMER_VISIBLE,
      sort_order: 20,
      seed_key: sectionSeedKey(optionSeedKey, ".line_items"),
      items: lineItems,
    },
    {
      kind: "upgrade_group",
      name: "Optional upgrades",
      customer_title: "Optional upgrades",
      customer_visibility: CUSTOMER_VISIBLE,
      sort_order: 30,
      seed_key: sectionSeedKey(optionSeedKey, ".upgrades"),
      items: upgradeItems.length > 0 ? upgradeItems : undefined,
    },
    {
      kind: "text",
      name: "Scope notes",
      customer_title: "Scope notes",
      customer_visibility: CUSTOMER_VISIBLE,
      sort_order: 40,
      seed_key: sectionSeedKey(optionSeedKey, ".scope_notes"),
      content: {
        title: "Scope notes",
        body_markdown: SCOPE_NOTES_BODY,
      },
    },
    {
      kind: "warranty",
      name: "Warranty",
      customer_title: "Warranty",
      customer_visibility: CUSTOMER_VISIBLE,
      sort_order: 50,
      seed_key: sectionSeedKey(optionSeedKey, ".warranty"),
      content: {
        title: "Warranty",
        body_markdown: WARRANTY_BODY,
      },
    },
    {
      kind: "terms",
      name: "Terms",
      customer_title: "Terms",
      customer_visibility: CUSTOMER_VISIBLE,
      sort_order: 60,
      seed_key: sectionSeedKey(optionSeedKey, ".terms"),
      content: {
        title: "Terms",
        body_markdown: TERMS_BODY,
      },
    },
  ];
}

function buildOptionDefinition(
  config: {
    name: string;
    seedKey: string;
    customerLabel: string;
    description: string;
    isDefault: boolean;
    sortOrder: number;
    lineItems: readonly DefaultProposalTemplateItemDefinition[];
    upgradeItems: readonly DefaultProposalTemplateItemDefinition[];
  }
): DefaultProposalTemplateOptionDefinition {
  return {
    name: config.name,
    seed_key: config.seedKey,
    customer_label: config.customerLabel,
    description: config.description,
    selection_mode: "single",
    is_default: config.isDefault,
    visible_to_customer: true,
    sort_order: config.sortOrder,
    sections: buildOptionSections(config.seedKey, config.lineItems, config.upgradeItems),
  };
}

const STANDARD_LINE_ITEMS = cloneCoreLineItemsWithOverrides({});
const ENHANCED_LINE_ITEMS = cloneCoreLineItemsWithOverrides(ENHANCED_LINE_OVERRIDES);
const PREMIUM_LINE_ITEMS = cloneCoreLineItemsWithOverrides(PREMIUM_LINE_OVERRIDES);

const ENHANCED_OPTIONAL_UPGRADES: readonly DefaultProposalTemplateItemDefinition[] = [
  { ...ADDITIONAL_ROOF_VENTILATION_UPGRADE },
];

const PREMIUM_OPTIONAL_UPGRADES: readonly DefaultProposalTemplateItemDefinition[] = [
  { ...ADDITIONAL_ROOF_VENTILATION_UPGRADE },
];

const ROOF_REPLACEMENT_OPTIONS: readonly DefaultProposalTemplateOptionDefinition[] = [
  buildOptionDefinition({
    name: "Standard",
    seedKey: "proposal.roof_replacement.standard",
    customerLabel: "Standard",
    description:
      "Standard roof replacement package with core materials, labor, disposal, and permit line items.",
    isDefault: true,
    sortOrder: 10,
    lineItems: STANDARD_LINE_ITEMS,
    upgradeItems: [],
  }),
  buildOptionDefinition({
    name: "Enhanced",
    seedKey: "proposal.roof_replacement.enhanced",
    customerLabel: "Enhanced",
    description:
      "Enhanced package with upgraded underlayment and ice and water protection included, plus optional additional ventilation.",
    isDefault: false,
    sortOrder: 20,
    lineItems: ENHANCED_LINE_ITEMS,
    upgradeItems: ENHANCED_OPTIONAL_UPGRADES,
  }),
  buildOptionDefinition({
    name: "Premium",
    seedKey: "proposal.roof_replacement.premium",
    customerLabel: "Premium",
    description:
      "Premium package with premium shingles, enhanced underlayment, and ice and water protection included, plus optional additional ventilation.",
    isDefault: false,
    sortOrder: 30,
    lineItems: PREMIUM_LINE_ITEMS,
    upgradeItems: PREMIUM_OPTIONAL_UPGRADES,
  }),
];

const ROOF_REPLACEMENT_TEMPLATE: DefaultProposalTemplateDefinition = {
  name: "Roof replacement",
    description:
    "Reusable roof replacement setup for future proposals.",
  status: "draft",
  sort_order: 10,
  metadata: {
    seed_key: DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY,
    optional_upgrade_truth_version: OPTIONAL_UPGRADE_TRUTH_VERSION,
  },
  options: ROOF_REPLACEMENT_OPTIONS,
};

export const DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS: readonly DefaultProposalTemplateDefinition[] =
  [ROOF_REPLACEMENT_TEMPLATE];
