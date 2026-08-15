/**
 * Durable Template composition authoring plans (V2E2B).
 *
 * UI calls these planners, then persists with proposalTemplateStore.
 * No React. No role/slot codes in returned contractor copy.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  compositionGroupFromItemRole,
  generateCompositionInstanceSlotKey,
  normalizeCompositionRole,
  normalizeCompositionSlotKey,
  resolveStarterCompositionIdentity,
  type CompositionGroup,
} from "@/app/lib/packageCompositionIdentity";
import { extractCatalogSeedKey } from "@/app/lib/proposalTemplateCatalogLink";
import type {
  ProposalTemplateItem,
  ProposalTemplateItemDraft,
  ProposalTemplateItemRole,
  TemplateQuantityRule,
} from "@/app/lib/proposalTemplateTypes";

const INHERIT_CATALOG_QUANTITY: TemplateQuantityRule = { mode: "inherit_catalog" };

export type CompositionAuthoringItem = Pick<
  ProposalTemplateItem,
  | "id"
  | "option_id"
  | "section_id"
  | "catalog_item_id"
  | "catalog_seed_key"
  | "composition_role"
  | "composition_slot_key"
  | "item_role"
  | "customer_name_override"
  | "description_override"
  | "quantity_rule"
>;

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function namesOf(catalog: Pick<CatalogItem, "name" | "customer_name">): string[] {
  return [catalog.name, catalog.customer_name]
    .map((row) => norm(row).toLowerCase())
    .filter(Boolean);
}

export function usedCompositionSlotsInGroup(
  items: readonly CompositionAuthoringItem[],
  optionId: string,
  group: CompositionGroup
): Set<string> {
  const used = new Set<string>();
  for (const item of items) {
    if (item.option_id !== optionId) continue;
    if (compositionGroupFromItemRole(item.item_role) !== group) continue;
    const slot = normalizeCompositionSlotKey(item.composition_slot_key);
    if (slot) used.add(slot);
  }
  return used;
}

export function resolveCatalogCompositionRole(
  catalogItem: CatalogItem
): string | null {
  const fromCatalog = normalizeCompositionRole(catalogItem.composition_role);
  if (fromCatalog) return fromCatalog;
  const seed = extractCatalogSeedKey(catalogItem);
  return resolveStarterCompositionIdentity(seed, "included")?.compositionRole ?? null;
}

export function assignCompositionSlotKey(input: {
  compositionRole: string | null;
  group: CompositionGroup;
  usedSlots: ReadonlySet<string>;
}): string | null {
  const role = normalizeCompositionRole(input.compositionRole);
  if (!role) return null;
  if (!input.usedSlots.has(role)) return role;
  let next = generateCompositionInstanceSlotKey(role);
  while (input.usedSlots.has(next)) {
    next = generateCompositionInstanceSlotKey(role);
  }
  return next;
}

export function catalogProductFitsSlot(
  catalogItem: CatalogItem,
  compositionRole: string | null | undefined
): boolean {
  const slotRole = normalizeCompositionRole(compositionRole);
  if (!slotRole) return true;
  const productRole = resolveCatalogCompositionRole(catalogItem);
  if (!productRole) return true;
  return productRole === slotRole;
}

export function overrideMisrepresentsProduct(
  override: string | null | undefined,
  catalogItem: Pick<CatalogItem, "name" | "customer_name">
): boolean {
  const label = norm(override);
  if (!label) return false;
  return !namesOf(catalogItem).includes(label.toLowerCase());
}

export function planAddIncludedProduct(input: {
  catalogItem: CatalogItem;
  optionId: string;
  sectionId: string;
  itemRole: ProposalTemplateItemRole;
  existingItems: readonly CompositionAuthoringItem[];
  sortOrder: number;
}): Pick<
  ProposalTemplateItemDraft,
  | "option_id"
  | "section_id"
  | "catalog_item_id"
  | "catalog_seed_key"
  | "composition_role"
  | "composition_slot_key"
  | "item_role"
  | "customer_visibility"
  | "quantity_rule"
  | "sort_order"
  | "upgrade_effect"
  | "default_selected"
> {
  const group = compositionGroupFromItemRole(input.itemRole);
  const compositionRole = resolveCatalogCompositionRole(input.catalogItem);
  const usedSlots = usedCompositionSlotsInGroup(
    input.existingItems,
    input.optionId,
    group
  );
  const compositionSlotKey = assignCompositionSlotKey({
    compositionRole,
    group,
    usedSlots,
  });
  return {
    option_id: input.optionId,
    section_id: input.sectionId,
    catalog_item_id: input.catalogItem.id,
    catalog_seed_key: extractCatalogSeedKey(input.catalogItem),
    composition_role: compositionRole,
    composition_slot_key: compositionSlotKey,
    item_role: input.itemRole,
    customer_visibility: "inherit_catalog",
    quantity_rule: INHERIT_CATALOG_QUANTITY,
    sort_order: input.sortOrder,
    upgrade_effect: group === "optional" ? "additive" : null,
    default_selected: group === "optional" ? false : undefined,
  };
}

export function planReplaceProduct(input: {
  existingItem: CompositionAuthoringItem;
  catalogItem: CatalogItem;
  previousCatalogItem?: Pick<CatalogItem, "name" | "customer_name"> | null;
}): {
  compatible: boolean;
  patch: Partial<ProposalTemplateItemDraft>;
} {
  const compatible = catalogProductFitsSlot(
    input.catalogItem,
    input.existingItem.composition_role
  );
  const clearOverride = overrideMisrepresentsProduct(
    input.existingItem.customer_name_override,
    input.catalogItem
  );
  const clearDescription = Boolean(norm(input.existingItem.description_override));
  return {
    compatible,
    patch: {
      catalog_item_id: input.catalogItem.id,
      catalog_seed_key: extractCatalogSeedKey(input.catalogItem),
      customer_name_override: clearOverride
        ? null
        : input.existingItem.customer_name_override ?? null,
      description_override: clearDescription
        ? null
        : input.existingItem.description_override ?? null,
    },
  };
}

export function planQuantityRule(input: {
  mode: "inherit_catalog" | "fixed";
  fixedQuantity?: number | null;
}): TemplateQuantityRule {
  if (input.mode === "fixed") {
    const qty = Number(input.fixedQuantity);
    return {
      mode: "fixed",
      fixed_quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      allow_manual_override: true,
    };
  }
  return { mode: "inherit_catalog" };
}

export function summarizeQuantityRule(
  rule: TemplateQuantityRule | null | undefined
): string {
  if (!rule || rule.mode === "inherit_catalog") return "Uses Catalog quantity";
  if (rule.mode === "fixed") {
    const qty = rule.fixed_quantity;
    return qty != null && Number.isFinite(qty) ? `Fixed qty ${qty}` : "Fixed quantity";
  }
  if (rule.mode === "measurement") return "Uses measurement";
  if (rule.mode === "multiplier") return "Quantity multiplier";
  return "Uses Catalog quantity";
}
