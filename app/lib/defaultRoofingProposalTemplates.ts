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
 * - Package-included material upgrades live on line_items as different Catalog products
 *   in the same composition slot (not label-only claims).
 * - upgrade_group holds only true elective add-ons (additive, default unselected).
 */

import type { CustomerVisibility } from "@/app/lib/catalogTypes";
import { resolveStarterCompositionIdentity } from "@/app/lib/packageCompositionIdentity";
import {
  DEFAULT_PACKET_OVERVIEW_BODY,
  DEFAULT_PACKET_OVERVIEW_TITLE,
  DEFAULT_PACKET_SCOPE_NOTES_BODY,
  DEFAULT_PACKET_SCOPE_NOTES_TITLE,
  DEFAULT_PACKET_TERMS_BODY,
  DEFAULT_PACKET_TERMS_TITLE,
  DEFAULT_PACKET_WARRANTY_BODY,
  DEFAULT_PACKET_WARRANTY_TITLE,
} from "@/app/lib/proposalCustomerPacketDefaultContent";
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
  CORE_LINE_SEEDS.map(({ catalog_seed_key, sort_order }) => {
    const identity = resolveStarterCompositionIdentity(catalog_seed_key, "included");
    return {
      catalog_seed_key,
      composition_role: identity?.compositionRole ?? null,
      composition_slot_key: identity?.compositionSlotKey ?? null,
      item_role: "standard",
      customer_visibility: "inherit_catalog",
      quantity_rule: INHERIT_CATALOG_QUANTITY,
      sort_order,
    };
  });

type LineItemOverride = {
  catalog_seed_key?: string;
  customer_name_override?: string;
  description_override?: string;
};

const ENHANCED_LINE_OVERRIDES: Readonly<Record<string, LineItemOverride>> = {
  "roofing.synthetic_underlayment": {
    catalog_seed_key: "roofing.premium_synthetic_underlayment",
    customer_name_override: "Upgraded underlayment",
    description_override:
      "Heavier synthetic underlayment included with this package for added weather resistance.",
  },
};

const PREMIUM_LINE_OVERRIDES: Readonly<Record<string, LineItemOverride>> = {
  ...ENHANCED_LINE_OVERRIDES,
  "roofing.architectural_shingles": {
    catalog_seed_key: "roofing.designer_shingles",
    customer_name_override: "Designer shingle package",
    description_override:
      "Designer architectural shingles included with this package for a longer-lasting, higher-end finish.",
  },
};

const ICE_WATER_EAVES_INCLUDED: DefaultProposalTemplateItemDefinition = {
  catalog_seed_key: "roofing.ice_water_eaves",
  composition_role: "ice_water",
  composition_slot_key: "ice_water.eaves",
  item_role: "standard",
  customer_name_override: "Ice and water protection at eaves",
  description_override:
    "Ice and water protection at the eaves included with this package, in addition to valley protection.",
  customer_visibility: "inherit_catalog",
  quantity_rule: INHERIT_CATALOG_QUANTITY,
  sort_order: 65,
};

/**
 * True optional add-on shared by Enhanced and Premium.
 * Same catalog family as included roof vents, but incremental fixed quantity (not inherit_catalog).
 */
const ADDITIONAL_ROOF_VENTILATION_UPGRADE: DefaultProposalTemplateItemDefinition = {
  catalog_seed_key: "roofing.roof_vent",
  composition_role: "ventilation",
  composition_slot_key: "ventilation.additional",
  item_role: "optional_addon",
  customer_name_override: "Additional roof ventilation",
  description_override:
    "Optional extra roof ventilation beyond what this package already includes. Choose only if your project needs additional vents.",
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
    const nextSeed = override.catalog_seed_key ?? item.catalog_seed_key;
    const identity = resolveStarterCompositionIdentity(nextSeed, "included");
    return {
      ...item,
      catalog_seed_key: nextSeed,
      composition_role: identity?.compositionRole ?? item.composition_role ?? null,
      composition_slot_key: identity?.compositionSlotKey ?? item.composition_slot_key ?? null,
      quantity_rule: item.quantity_rule ? { ...item.quantity_rule } : undefined,
      customer_name_override: override.customer_name_override ?? item.customer_name_override,
      description_override: override.description_override ?? item.description_override,
    };
  });
}

function withEavesIceWater(
  items: readonly DefaultProposalTemplateItemDefinition[]
): DefaultProposalTemplateItemDefinition[] {
  const copied = items.map((item) => ({
    ...item,
    quantity_rule: item.quantity_rule ? { ...item.quantity_rule } : undefined,
  }));
  const insertAt = copied.findIndex((item) => item.catalog_seed_key === "roofing.ice_water_valley");
  const eaves = {
    ...ICE_WATER_EAVES_INCLUDED,
    quantity_rule: ICE_WATER_EAVES_INCLUDED.quantity_rule
      ? { ...ICE_WATER_EAVES_INCLUDED.quantity_rule }
      : undefined,
  };
  if (insertAt < 0) return [...copied, eaves];
  copied.splice(insertAt + 1, 0, eaves);
  return copied;
}

const PROJECT_OVERVIEW_BODY = DEFAULT_PACKET_OVERVIEW_BODY;
const SCOPE_NOTES_BODY = DEFAULT_PACKET_SCOPE_NOTES_BODY;
const WARRANTY_BODY = DEFAULT_PACKET_WARRANTY_BODY;
const TERMS_BODY = DEFAULT_PACKET_TERMS_BODY;

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
      name: "Overview",
      customer_title: DEFAULT_PACKET_OVERVIEW_TITLE,
      customer_visibility: CUSTOMER_VISIBLE,
      sort_order: 10,
      seed_key: sectionSeedKey(optionSeedKey, ".overview"),
      content: {
        title: DEFAULT_PACKET_OVERVIEW_TITLE,
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
      name: "Project notes",
      customer_title: DEFAULT_PACKET_SCOPE_NOTES_TITLE,
      customer_visibility: CUSTOMER_VISIBLE,
      sort_order: 40,
      seed_key: sectionSeedKey(optionSeedKey, ".scope_notes"),
      content: {
        title: DEFAULT_PACKET_SCOPE_NOTES_TITLE,
        body_markdown: SCOPE_NOTES_BODY,
      },
    },
    {
      kind: "warranty",
      name: "Warranty and protection",
      customer_title: DEFAULT_PACKET_WARRANTY_TITLE,
      customer_visibility: CUSTOMER_VISIBLE,
      sort_order: 50,
      seed_key: sectionSeedKey(optionSeedKey, ".warranty"),
      content: {
        title: DEFAULT_PACKET_WARRANTY_TITLE,
        body_markdown: WARRANTY_BODY,
      },
    },
    {
      kind: "terms",
      name: "Next steps",
      customer_title: DEFAULT_PACKET_TERMS_TITLE,
      customer_visibility: CUSTOMER_VISIBLE,
      sort_order: 60,
      seed_key: sectionSeedKey(optionSeedKey, ".terms"),
      content: {
        title: DEFAULT_PACKET_TERMS_TITLE,
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
const ENHANCED_LINE_ITEMS = withEavesIceWater(
  cloneCoreLineItemsWithOverrides(ENHANCED_LINE_OVERRIDES)
);
const PREMIUM_LINE_ITEMS = withEavesIceWater(
  cloneCoreLineItemsWithOverrides(PREMIUM_LINE_OVERRIDES)
);

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
      "Solid, complete roof replacement with quality materials, professional installation, cleanup, and permit handling.",
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
      "Stronger weather protection with upgraded underlayment and ice and water at the eaves included — plus optional extra ventilation if you need it.",
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
      "Our highest-protection package with designer shingles, upgraded underlayment, and ice and water at the eaves — plus optional extra ventilation if you need it.",
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
