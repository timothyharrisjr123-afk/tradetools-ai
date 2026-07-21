/**
 * Optional Upgrade Truth — pure inventory / repair planning for templates.
 *
 * Detects same-option catalog collisions between included line_items and
 * upgrade_group rows. Provides classify + recommended repair actions.
 *
 * Guardrail: sent / signed / superseded proposal snapshots must NEVER be mutated.
 * Repair applies only to template definitions and (later) opt-in mutable drafts.
 * This module is intentionally pure — no Supabase writes.
 */

import type {
  DefaultProposalTemplateDefinition,
  DefaultProposalTemplateItemDefinition,
  DefaultProposalTemplateOptionDefinition,
  TemplateQuantityRule,
  ProposalTemplateItem,
} from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";

/** Do not rewrite immutable proposal history when repairing templates. */
export const SENT_SNAPSHOT_MUTATION_FORBIDDEN =
  "Sent, signed, and superseded proposal snapshots must not be mutated. " +
  "Template repair may only affect reusable template graphs; commercial correction " +
  "of already-sent proposals requires a revised draft/send." as const;

export type CatalogCollisionSeverity = "unapproved" | "approved_incremental";

export type SameOptionCatalogCollision = {
  optionKey: string;
  optionName: string | null;
  catalogKey: string;
  includedItemIds: string[];
  upgradeItemIds: string[];
  severity: CatalogCollisionSeverity;
  reason: string;
};

export type UpgradeTruthRepairAction =
  | "move_package_enhancement_to_line_items"
  | "remove_duplicate_upgrade_row"
  | "convert_to_additive_incremental_quantity"
  | "leave_approved_incremental"
  | "archive_legacy_template_clone_corrected"
  | "skip_sent_snapshot";

export type UpgradeTruthRepairPlanItem = {
  optionKey: string;
  catalogKey: string;
  severity: CatalogCollisionSeverity;
  recommendedAction: UpgradeTruthRepairAction;
  detail: string;
};

export type UpgradeTruthRepairPlan = {
  /** Always true — documents immutable history guardrail. */
  sentSnapshotsMustNotBeMutated: true;
  sentSnapshotGuardrail: typeof SENT_SNAPSHOT_MUTATION_FORBIDDEN;
  collisions: SameOptionCatalogCollision[];
  recommendations: UpgradeTruthRepairPlanItem[];
  unapprovedCollisionCount: number;
};

function isIncrementalAdditiveQuantity(rule: TemplateQuantityRule | null | undefined): boolean {
  if (!rule || rule.mode !== "fixed") return false;
  const qty = rule.fixed_quantity;
  return typeof qty === "number" && Number.isFinite(qty) && qty > 0;
}

function classifyUpgradeAgainstIncluded(params: {
  upgradeEffect: string | null | undefined;
  quantityRule: TemplateQuantityRule | null | undefined;
}): { severity: CatalogCollisionSeverity; reason: string } {
  const effect = params.upgradeEffect ?? null;
  if (effect === "additive" && isIncrementalAdditiveQuantity(params.quantityRule)) {
    return {
      severity: "approved_incremental",
      reason:
        "Same catalog key appears in included scope and upgrade_group, but upgrade is additive with fixed incremental quantity.",
    };
  }
  return {
    severity: "unapproved",
    reason:
      "Same catalog key appears in both line_items and upgrade_group without approved additive incremental quantity rules — risks double-counting.",
  };
}

function recommendAction(collision: SameOptionCatalogCollision): UpgradeTruthRepairPlanItem {
  if (collision.severity === "approved_incremental") {
    return {
      optionKey: collision.optionKey,
      catalogKey: collision.catalogKey,
      severity: collision.severity,
      recommendedAction: "leave_approved_incremental",
      detail: collision.reason,
    };
  }

  // Heuristic: package-promise names / known seeds → move to included overrides.
  const packageEnhancementSeeds = new Set([
    "roofing.synthetic_underlayment",
    "roofing.ice_water_valley",
    "roofing.architectural_shingles",
  ]);

  if (packageEnhancementSeeds.has(collision.catalogKey)) {
    return {
      optionKey: collision.optionKey,
      catalogKey: collision.catalogKey,
      severity: collision.severity,
      recommendedAction: "move_package_enhancement_to_line_items",
      detail:
        "Treat as package-included enhancement: apply customer overrides on the included line_items row and remove the duplicate upgrade_group row.",
    };
  }

  if (collision.catalogKey === "roofing.roof_vent") {
    return {
      optionKey: collision.optionKey,
      catalogKey: collision.catalogKey,
      severity: collision.severity,
      recommendedAction: "convert_to_additive_incremental_quantity",
      detail:
        "Keep as true optional add-on only with upgrade_effect=additive, default_selected=false, and fixed incremental quantity (not inherit_catalog).",
    };
  }

  return {
    optionKey: collision.optionKey,
    catalogKey: collision.catalogKey,
    severity: collision.severity,
    recommendedAction: "remove_duplicate_upgrade_row",
    detail:
      "Remove or remodel the upgrade_group row so it no longer silently reprices the same included catalog measurement.",
  };
}

function collectCollisionsForOption(params: {
  optionKey: string;
  optionName: string | null;
  includedKeys: Map<string, string[]>;
  upgradeRows: Array<{
    itemId: string;
    catalogKey: string;
    upgradeEffect: string | null | undefined;
    quantityRule: TemplateQuantityRule | null | undefined;
  }>;
}): SameOptionCatalogCollision[] {
  const byKey = new Map<string, SameOptionCatalogCollision>();

  for (const upgrade of params.upgradeRows) {
    const includedIds = params.includedKeys.get(upgrade.catalogKey);
    if (!includedIds || includedIds.length === 0) continue;

    const classification = classifyUpgradeAgainstIncluded({
      upgradeEffect: upgrade.upgradeEffect,
      quantityRule: upgrade.quantityRule,
    });

    const existing = byKey.get(upgrade.catalogKey);
    if (existing) {
      existing.upgradeItemIds.push(upgrade.itemId);
      if (
        classification.severity === "unapproved" &&
        existing.severity === "approved_incremental"
      ) {
        existing.severity = "unapproved";
        existing.reason = classification.reason;
      }
      continue;
    }

    byKey.set(upgrade.catalogKey, {
      optionKey: params.optionKey,
      optionName: params.optionName,
      catalogKey: upgrade.catalogKey,
      includedItemIds: [...includedIds],
      upgradeItemIds: [upgrade.itemId],
      severity: classification.severity,
      reason: classification.reason,
    });
  }

  return [...byKey.values()];
}

function buildPlanFromCollisions(
  collisions: SameOptionCatalogCollision[]
): UpgradeTruthRepairPlan {
  const recommendations = collisions.map(recommendAction);
  return {
    sentSnapshotsMustNotBeMutated: true,
    sentSnapshotGuardrail: SENT_SNAPSHOT_MUTATION_FORBIDDEN,
    collisions,
    recommendations,
    unapprovedCollisionCount: collisions.filter((row) => row.severity === "unapproved")
      .length,
  };
}

function itemCatalogKeyFromDefinition(
  item: DefaultProposalTemplateItemDefinition
): string | null {
  const key = item.catalog_seed_key?.trim();
  return key ? key : null;
}

/**
 * Detect same-option catalog collisions in a passive default template definition.
 */
export function detectDefaultDefinitionCatalogCollisions(
  definition: DefaultProposalTemplateDefinition
): SameOptionCatalogCollision[] {
  const collisions: SameOptionCatalogCollision[] = [];

  for (const option of definition.options ?? []) {
    collisions.push(...detectDefaultOptionCollisions(option));
  }

  return collisions;
}

export function detectDefaultOptionCollisions(
  option: DefaultProposalTemplateOptionDefinition
): SameOptionCatalogCollision[] {
  const optionKey = option.seed_key?.trim() || option.name;
  const includedKeys = new Map<string, string[]>();
  const upgradeRows: Array<{
    itemId: string;
    catalogKey: string;
    upgradeEffect: string | null | undefined;
    quantityRule: TemplateQuantityRule | null | undefined;
  }> = [];

  for (const section of option.sections ?? []) {
    const items = section.items ?? [];
    if (section.kind === "line_items") {
      items.forEach((item, index) => {
        const key = itemCatalogKeyFromDefinition(item);
        if (!key) return;
        const id = `def:${optionKey}:line:${key}:${index}`;
        const list = includedKeys.get(key) ?? [];
        list.push(id);
        includedKeys.set(key, list);
      });
    } else if (section.kind === "upgrade_group") {
      items.forEach((item, index) => {
        const key = itemCatalogKeyFromDefinition(item);
        if (!key) return;
        upgradeRows.push({
          itemId: `def:${optionKey}:upgrade:${key}:${index}`,
          catalogKey: key,
          upgradeEffect: item.upgrade_effect,
          quantityRule: item.quantity_rule,
        });
      });
    }
  }

  return collectCollisionsForOption({
    optionKey,
    optionName: option.name,
    includedKeys,
    upgradeRows,
  });
}

export function buildDefaultDefinitionRepairPlan(
  definition: DefaultProposalTemplateDefinition
): UpgradeTruthRepairPlan {
  return buildPlanFromCollisions(detectDefaultDefinitionCatalogCollisions(definition));
}

export type InstalledTemplateCollisionInput = {
  graph: ProposalTemplateGraph;
  /**
   * Optional map of catalog_item_id → catalog seed key.
   * Prefer item.catalog_seed_key when present; fall back to this map.
   */
  catalogSeedByItemId?: ReadonlyMap<string, string>;
};

function resolveInstalledCatalogKey(
  item: ProposalTemplateItem,
  catalogSeedByItemId?: ReadonlyMap<string, string>
): string | null {
  const seed = item.catalog_seed_key?.trim();
  if (seed) return seed;
  const catalogId = item.catalog_item_id?.trim();
  if (!catalogId) return null;
  const mapped = catalogSeedByItemId?.get(catalogId)?.trim();
  return mapped || catalogId;
}

/**
 * Detect same-option catalog collisions on an installed template graph.
 * Does not mutate the graph. Does not touch proposal snapshots.
 */
export function detectInstalledTemplateCatalogCollisions(
  input: InstalledTemplateCollisionInput
): SameOptionCatalogCollision[] {
  const { graph, catalogSeedByItemId } = input;
  const sectionById = new Map(graph.sections.map((section) => [section.id, section]));
  const collisions: SameOptionCatalogCollision[] = [];

  for (const option of graph.options) {
    const includedKeys = new Map<string, string[]>();
    const upgradeRows: Array<{
      itemId: string;
      catalogKey: string;
      upgradeEffect: string | null | undefined;
      quantityRule: TemplateQuantityRule | null | undefined;
    }> = [];

    for (const item of graph.items) {
      if (item.option_id !== option.id) continue;
      const section = sectionById.get(item.section_id);
      if (!section) continue;
      const catalogKey = resolveInstalledCatalogKey(item, catalogSeedByItemId);
      if (!catalogKey) continue;

      if (section.kind === "line_items") {
        const list = includedKeys.get(catalogKey) ?? [];
        list.push(item.id);
        includedKeys.set(catalogKey, list);
      } else if (section.kind === "upgrade_group") {
        upgradeRows.push({
          itemId: item.id,
          catalogKey,
          upgradeEffect: item.upgrade_effect,
          quantityRule: item.quantity_rule,
        });
      }
    }

    collisions.push(
      ...collectCollisionsForOption({
        optionKey: option.id,
        optionName: option.name,
        includedKeys,
        upgradeRows,
      })
    );
  }

  return collisions;
}

export function buildInstalledTemplateRepairPlan(
  input: InstalledTemplateCollisionInput
): UpgradeTruthRepairPlan {
  return buildPlanFromCollisions(detectInstalledTemplateCatalogCollisions(input));
}

/**
 * Classify a single upgrade row that shares a catalog key with included scope.
 * Pure helper for callers that already know a collision key exists.
 */
export function classifySameOptionCatalogCollision(params: {
  upgradeEffect: string | null | undefined;
  quantityRule: TemplateQuantityRule | null | undefined;
}): CatalogCollisionSeverity {
  return classifyUpgradeAgainstIncluded(params).severity;
}

/** Convenience: true when any unapproved collision exists. */
export function hasUnapprovedSameOptionCatalogCollisions(
  collisions: readonly SameOptionCatalogCollision[]
): boolean {
  return collisions.some((row) => row.severity === "unapproved");
}
