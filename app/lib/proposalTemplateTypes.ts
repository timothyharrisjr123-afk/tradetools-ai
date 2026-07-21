/**
 * FieldDive Proposal Templates — type contract.
 *
 * Proposal templates define reusable company-owned packages: customer-facing
 * options (e.g. Good / Better / Best), ordered sections, and catalog-backed
 * line items. They sit between Catalog / Price Book and Proposal Builder.
 *
 * Templates do not own pricing truth, payment status, approval truth, send/PDF
 * state, or job pipeline status. They do not calculate totals or create sent
 * proposals. Runtime job proposals and frozen snapshots belong in a future
 * proposalTypes.ts (Proposal Builder and later stages).
 *
 * Architecture (later stages):
 *   MeasurementRecord → quantity_map
 *   CatalogItem → unit costs/prices and quantity_source defaults
 *   ProposalTemplate → options, sections, items referencing catalog
 *   Proposal (future) → job + measurement + template instance + snapshots
 *   Pricing engine → deterministic math (separate; protected)
 *
 * Quantity resolution order (future Proposal Builder — not implemented here):
 *   measurement → template TemplateQuantityRule → catalog item defaults
 *   → deterministic pricing engine
 *
 * This file is types and pure label helpers only. No DB, store, React, or
 * pricing math. Do not import catalogStore or wire UI from this module yet.
 */

import type { CustomerVisibility, QuantitySource } from "@/app/lib/catalogTypes";
import type { ProposalUpgradeEffect } from "@/app/lib/proposalUpgradeTruthTypes";

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

/** Lifecycle of a company proposal template (internal setup). */
export type ProposalTemplateStatus = "draft" | "active" | "archived";

/**
 * How a customer may select this option or items within it (Proposal Builder).
 */
export type ProposalTemplateOptionSelectionMode = "single" | "multi" | "included";

/** Ordered block kind inside a template option. */
export type ProposalTemplateSectionKind =
  | "line_items"
  | "text"
  | "upgrade_group"
  | "terms"
  | "warranty"
  | "image"
  | "signature_placeholder";

/** Role of a catalog-backed row within a section. */
export type ProposalTemplateItemRole =
  | "standard"
  | "included"
  | "upgrade"
  | "optional_addon"
  | "fee"
  | "discount";

/** How Proposal Builder resolves quantity for a template line (resolver deferred). */
export type TemplateQuantityMode =
  | "inherit_catalog"
  | "fixed"
  | "measurement"
  | "multiplier";

/** Company-level readiness for using templates in Proposal Builder (derive deferred). */
export type ProposalTemplateReadinessStatus =
  | "not_started"
  | "needs_catalog"
  | "needs_items"
  | "needs_pricing"
  | "ready_for_builder";

/** Item-level visibility: use catalog row or override. */
export type ProposalTemplateItemCustomerVisibility = CustomerVisibility | "inherit_catalog";

// ---------------------------------------------------------------------------
// Quantity rule
// ---------------------------------------------------------------------------

/**
 * Template-level quantity override for a line item.
 * Resolver implementation belongs in Proposal Builder — not in 3G1.
 *
 * Resolution order (future):
 *   1. Selected MeasurementRecord / quantity_map
 *   2. This rule (mode, multiplier, fixed, measurement key)
 *   3. CatalogItem.quantity_source, default_quantity, coverage_rate, waste
 *   4. Deterministic pricing engine (protected; separate module)
 */
export type TemplateQuantityRule = {
  mode: TemplateQuantityMode;
  quantity_source?: QuantitySource | null;
  /** Key into MeasurementQuantityMap or handoff summary when mode uses measurement. */
  measurement_quantity_key?: string | null;
  fixed_quantity?: number | null;
  quantity_multiplier?: number | null;
  waste_factor_override?: number | null;
  /** When true, Proposal Builder may let contractor adjust qty on the job proposal. */
  allow_manual_override?: boolean;
};

// ---------------------------------------------------------------------------
// Section content (minimal — no upload/render)
// ---------------------------------------------------------------------------

/** Placeholder content for text, terms, warranty, image sections. */
export type ProposalTemplateSectionContent = {
  title?: string | null;
  body_markdown?: string | null;
  layout_hint?: string | null;
  /** Opaque reference for a future attachment/asset store — not wired in 3G1. */
  asset_ref?: string | null;
};

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/**
 * Company-owned reusable proposal package.
 * `name` is internal (Roofr-style); customer-facing labels live on options/sections.
 */
export type ProposalTemplate = {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  status: ProposalTemplateStatus;
  active: boolean;
  sort_order?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
};

/**
 * One customer-facing package/choice within a template (e.g. Good / Better / Best).
 */
export type ProposalTemplateOption = {
  id: string;
  template_id: string;
  name: string;
  customer_label?: string | null;
  description?: string | null;
  selection_mode?: ProposalTemplateOptionSelectionMode;
  is_default?: boolean;
  visible_to_customer?: boolean;
  sort_order?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** Ordered block inside a template option. */
export type ProposalTemplateSection = {
  id: string;
  template_id: string;
  option_id: string;
  kind: ProposalTemplateSectionKind;
  name: string;
  customer_title?: string | null;
  customer_visibility?: CustomerVisibility;
  sort_order?: number | null;
  content?: ProposalTemplateSectionContent | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Catalog-backed line in a section.
 *
 * Runtime/persisted rows: `catalog_item_id` → real company catalog_items row.
 * Default template definitions (3G4): `catalog_seed_key` for install-time resolution.
 * Future job proposals freeze customer-facing labels/prices in proposal snapshots —
 * do not add price override fields on template items in 3G1.
 */
export type ProposalTemplateItem = {
  id: string;
  template_id: string;
  option_id: string;
  section_id: string;
  catalog_item_id?: string | null;
  catalog_seed_key?: string | null;
  item_role: ProposalTemplateItemRole;
  customer_name_override?: string | null;
  description_override?: string | null;
  customer_visibility?: ProposalTemplateItemCustomerVisibility;
  quantity_rule?: TemplateQuantityRule | null;
  /**
   * True optional add-on behavior. Only valid for upgrade/optional_addon roles.
   * Package-included enhancements belong in line_items, not here.
   */
  upgrade_effect?: ProposalUpgradeEffect | null;
  /** Required when upgrade_effect is replacement; same-option included/standard target. */
  replaces_template_item_id?: string | null;
  /** V1 product default is false / unset → not selected on draft create. */
  default_selected?: boolean | null;
  sort_order?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export type ProposalTemplateDraft = Omit<
  ProposalTemplate,
  "id" | "created_at" | "updated_at" | "created_by" | "updated_by"
>;

export type ProposalTemplateOptionDraft = Omit<
  ProposalTemplateOption,
  "id" | "created_at" | "updated_at"
>;

export type ProposalTemplateSectionDraft = Omit<
  ProposalTemplateSection,
  "id" | "created_at" | "updated_at"
>;

export type ProposalTemplateItemDraft = Omit<
  ProposalTemplateItem,
  "id" | "created_at" | "updated_at"
>;

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

/** Lightweight row for template lists and admin pickers. */
export type ProposalTemplateSummary = {
  id: string;
  company_id: string;
  name: string;
  status: ProposalTemplateStatus;
  active: boolean;
  option_count: number;
  section_count: number;
  item_count: number;
  priced_catalog_item_count?: number;
  missing_catalog_item_count?: number;
  updated_at?: string | null;
};

/** Counts for one template's graph (options → sections → items). */
export type ProposalTemplateRelationshipSummary = {
  template_id: string;
  option_count: number;
  section_count: number;
  item_count: number;
  upgrade_count: number;
  addon_count: number;
};

/**
 * Readiness assessment shape for template → Proposal Builder gate.
 * Derivation (catalog link checks, pricing counts) deferred to 3G6+.
 */
export type ProposalTemplateReadiness = {
  status: ProposalTemplateReadinessStatus;
  template_count: number;
  active_template_count: number;
  option_count: number;
  section_count: number;
  item_count: number;
  linked_catalog_item_count: number;
  missing_catalog_item_count: number;
  priced_catalog_item_count: number;
  missing_required_fields?: string[];
};

// ---------------------------------------------------------------------------
// Passive default definitions (3G4 / 3G5 — no writes in 3G1)
// ---------------------------------------------------------------------------

export type DefaultProposalTemplateItemDefinition = {
  catalog_seed_key: string;
  item_role: ProposalTemplateItemRole;
  customer_name_override?: string | null;
  description_override?: string | null;
  customer_visibility?: ProposalTemplateItemCustomerVisibility;
  quantity_rule?: TemplateQuantityRule | null;
  upgrade_effect?: ProposalUpgradeEffect | null;
  /** Seed-key of the same-option included line this upgrade replaces, when replacement. */
  replaces_catalog_seed_key?: string | null;
  default_selected?: boolean | null;
  sort_order?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type DefaultProposalTemplateSectionDefinition = {
  kind: ProposalTemplateSectionKind;
  name: string;
  customer_title?: string | null;
  customer_visibility?: CustomerVisibility;
  sort_order?: number | null;
  content?: ProposalTemplateSectionContent | null;
  items?: readonly DefaultProposalTemplateItemDefinition[];
  metadata?: Record<string, unknown> | null;
  seed_key?: string;
};

export type DefaultProposalTemplateOptionDefinition = {
  name: string;
  customer_label?: string | null;
  description?: string | null;
  selection_mode?: ProposalTemplateOptionSelectionMode;
  is_default?: boolean;
  visible_to_customer?: boolean;
  sort_order?: number | null;
  sections?: readonly DefaultProposalTemplateSectionDefinition[];
  metadata?: Record<string, unknown> | null;
  seed_key?: string;
};

/**
 * Starter template without company scope — cloned per company at seed time.
 * Uses seed_key on template/options/sections for idempotent install (3G5).
 */
export type DefaultProposalTemplateDefinition = Omit<
  ProposalTemplateDraft,
  "company_id" | "active"
> & {
  metadata: { seed_key: string } & Record<string, unknown>;
  options?: readonly DefaultProposalTemplateOptionDefinition[];
};

// ---------------------------------------------------------------------------
// Const arrays (UI validation / selects)
// ---------------------------------------------------------------------------

export const PROPOSAL_TEMPLATE_STATUSES: readonly ProposalTemplateStatus[] = [
  "draft",
  "active",
  "archived",
] as const;

export const PROPOSAL_TEMPLATE_OPTION_SELECTION_MODES: readonly ProposalTemplateOptionSelectionMode[] =
  ["single", "multi", "included"] as const;

export const PROPOSAL_TEMPLATE_SECTION_KINDS: readonly ProposalTemplateSectionKind[] = [
  "line_items",
  "text",
  "upgrade_group",
  "terms",
  "warranty",
  "image",
  "signature_placeholder",
] as const;

export const PROPOSAL_TEMPLATE_ITEM_ROLES: readonly ProposalTemplateItemRole[] = [
  "standard",
  "included",
  "upgrade",
  "optional_addon",
  "fee",
  "discount",
] as const;

export const TEMPLATE_QUANTITY_MODES: readonly TemplateQuantityMode[] = [
  "inherit_catalog",
  "fixed",
  "measurement",
  "multiplier",
] as const;

export const PROPOSAL_TEMPLATE_READINESS_STATUSES: readonly ProposalTemplateReadinessStatus[] =
  [
    "not_started",
    "needs_catalog",
    "needs_items",
    "needs_pricing",
    "ready_for_builder",
  ] as const;

// ---------------------------------------------------------------------------
// Label helpers (pure)
// ---------------------------------------------------------------------------

const PROPOSAL_TEMPLATE_STATUS_LABELS: Record<ProposalTemplateStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

const PROPOSAL_TEMPLATE_OPTION_SELECTION_MODE_LABELS: Record<
  ProposalTemplateOptionSelectionMode,
  string
> = {
  single: "Single choice",
  multi: "Multiple choice",
  included: "Included",
};

const PROPOSAL_TEMPLATE_SECTION_KIND_LABELS: Record<ProposalTemplateSectionKind, string> =
  {
    line_items: "Line items",
    text: "Text",
    upgrade_group: "Upgrades",
    terms: "Terms",
    warranty: "Warranty",
    image: "Image",
    signature_placeholder: "Signature",
  };

const PROPOSAL_TEMPLATE_ITEM_ROLE_LABELS: Record<ProposalTemplateItemRole, string> = {
  standard: "Standard",
  included: "Included",
  upgrade: "Upgrade",
  optional_addon: "Optional add-on",
  fee: "Fee",
  discount: "Discount",
};

const TEMPLATE_QUANTITY_MODE_LABELS: Record<TemplateQuantityMode, string> = {
  inherit_catalog: "Inherit from catalog",
  fixed: "Fixed quantity",
  measurement: "From measurement",
  multiplier: "Measurement multiplier",
};

const PROPOSAL_TEMPLATE_READINESS_STATUS_LABELS: Record<
  ProposalTemplateReadinessStatus,
  string
> = {
  not_started: "Not started",
  needs_catalog: "Needs catalog",
  needs_items: "Needs items",
  needs_pricing: "Needs pricing",
  ready_for_builder: "Ready for builder",
};

export function proposalTemplateStatusLabel(value: ProposalTemplateStatus): string {
  return PROPOSAL_TEMPLATE_STATUS_LABELS[value];
}

export function proposalTemplateOptionSelectionModeLabel(
  value: ProposalTemplateOptionSelectionMode
): string {
  return PROPOSAL_TEMPLATE_OPTION_SELECTION_MODE_LABELS[value];
}

export function proposalTemplateSectionKindLabel(
  value: ProposalTemplateSectionKind
): string {
  return PROPOSAL_TEMPLATE_SECTION_KIND_LABELS[value];
}

export function proposalTemplateItemRoleLabel(value: ProposalTemplateItemRole): string {
  return PROPOSAL_TEMPLATE_ITEM_ROLE_LABELS[value];
}

export function templateQuantityModeLabel(value: TemplateQuantityMode): string {
  return TEMPLATE_QUANTITY_MODE_LABELS[value];
}

export function proposalTemplateReadinessStatusLabel(
  value: ProposalTemplateReadinessStatus
): string {
  return PROPOSAL_TEMPLATE_READINESS_STATUS_LABELS[value];
}
