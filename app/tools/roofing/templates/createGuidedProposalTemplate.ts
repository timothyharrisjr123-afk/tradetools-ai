/**
 * Materialize a guided Template Flow V1 create plan into proposal template tables.
 *
 * Uses proposalTemplateStore create helpers + catalog seed resolution.
 * Inserts a fresh template graph (not the idempotent starter install path).
 * No pricing math, Proposal Builder, or Job Card draft creation.
 */

import { getCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type {
  DefaultProposalTemplateItemDefinition,
  DefaultProposalTemplateOptionDefinition,
  DefaultProposalTemplateSectionDefinition,
  ProposalTemplateItemDraft,
  ProposalTemplateOptionDraft,
  ProposalTemplateSectionDraft,
} from "@/app/lib/proposalTemplateTypes";
import {
  createProposalTemplate,
  createProposalTemplateItem,
  createProposalTemplateOption,
  createProposalTemplateSection,
  getProposalTemplateGraph,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";
import type { GuidedTemplateCreatePlan } from "./templatesGuidedCreatePlanner";

export type CreateGuidedProposalTemplateResult = {
  ok: boolean;
  templateId: string | null;
  createdOptionCount: number;
  createdSectionCount: number;
  createdItemCount: number;
  skippedItemCount: number;
  missingCatalogSeedKeys: string[];
  errors: string[];
  graph: ProposalTemplateGraph | null;
};

function isUuidLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

function extractSeedKey(metadata: Record<string, unknown> | null | undefined): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = metadata.seed_key;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mergeMetadataWithSeedKey(
  seedKey: string | null | undefined,
  metadata?: Record<string, unknown> | null
): Record<string, unknown> {
  const base =
    metadata != null && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...metadata }
      : {};
  if (seedKey && seedKey.trim()) {
    base.seed_key = seedKey.trim();
  } else {
    delete base.seed_key;
  }
  return base;
}

function buildCatalogSeedToItemIdMap(items: CatalogItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    const seedKey = extractSeedKey(item.metadata ?? null);
    if (!seedKey) continue;

    const existingId = map.get(seedKey);
    if (!existingId) {
      map.set(seedKey, item.id);
      continue;
    }

    const existing = items.find((row) => row.id === existingId);
    if (existing && !existing.active && item.active) {
      map.set(seedKey, item.id);
    }
  }
  return map;
}

function synthesizeItemSeedKey(
  sectionSeedKey: string,
  itemDef: DefaultProposalTemplateItemDefinition
): string {
  const role = itemDef.item_role ?? "standard";
  const sortSuffix =
    itemDef.sort_order != null ? `.sort_${itemDef.sort_order}` : "";
  return `${sectionSeedKey}.item.${itemDef.catalog_seed_key}.${role}${sortSuffix}`;
}

function emptyResult(errors: string[]): CreateGuidedProposalTemplateResult {
  return {
    ok: false,
    templateId: null,
    createdOptionCount: 0,
    createdSectionCount: 0,
    createdItemCount: 0,
    skippedItemCount: 0,
    missingCatalogSeedKeys: [],
    errors,
    graph: null,
  };
}

/**
 * Create a new company template from a guided create plan.
 * Fresh insert path — not the idempotent starter-template install helper.
 */
export async function createGuidedProposalTemplate(input: {
  companyId: string;
  plan: GuidedTemplateCreatePlan;
}): Promise<CreateGuidedProposalTemplateResult> {
  const companyId = String(input.companyId || "").trim();
  if (!isUuidLike(companyId)) {
    return emptyResult(["Invalid company context."]);
  }

  const { plan } = input;
  const errors: string[] = [];
  const missingCatalogSeedKeys = new Set<string>();
  let createdOptionCount = 0;
  let createdSectionCount = 0;
  let createdItemCount = 0;
  let skippedItemCount = 0;

  const catalogItems = await getCatalogItemsByCompany(companyId);
  const catalogSeedToItemId = buildCatalogSeedToItemIdMap(catalogItems);

  const templateMetadata = mergeMetadataWithSeedKey(null, {
    guided_create: true,
    package_model: plan.packageModel,
  });

  const createdTemplate = await createProposalTemplate({
    company_id: companyId,
    name: plan.name,
    description: plan.description,
    status: plan.definition.status ?? "active",
    active: true,
    sort_order: plan.definition.sort_order ?? 20,
    metadata: templateMetadata,
  });

  if (!createdTemplate?.id) {
    return emptyResult(["Could not create the template. Try again."]);
  }

  const templateId = createdTemplate.id;
  const options = plan.definition.options ?? [];

  for (const optionDef of options) {
    const optionResult = await createOptionGraph({
      companyId,
      templateId,
      optionDef,
      catalogSeedToItemId,
      missingCatalogSeedKeys,
      errors,
    });
    if (!optionResult.ok) {
      continue;
    }
    createdOptionCount += 1;
    createdSectionCount += optionResult.createdSectionCount;
    createdItemCount += optionResult.createdItemCount;
    skippedItemCount += optionResult.skippedItemCount;
  }

  const graph = await getProposalTemplateGraph(templateId, { companyId });
  const ok = graph != null && createdOptionCount > 0;

  if (!ok) {
    errors.push("Template was created but package structure could not be completed.");
  }

  return {
    ok,
    templateId,
    createdOptionCount,
    createdSectionCount,
    createdItemCount,
    skippedItemCount,
    missingCatalogSeedKeys: [...missingCatalogSeedKeys].sort(),
    errors,
    graph,
  };
}

async function createOptionGraph(params: {
  companyId: string;
  templateId: string;
  optionDef: DefaultProposalTemplateOptionDefinition;
  catalogSeedToItemId: Map<string, string>;
  missingCatalogSeedKeys: Set<string>;
  errors: string[];
}): Promise<{
  ok: boolean;
  createdSectionCount: number;
  createdItemCount: number;
  skippedItemCount: number;
}> {
  const {
    companyId,
    templateId,
    optionDef,
    catalogSeedToItemId,
    missingCatalogSeedKeys,
    errors,
  } = params;

  let createdSectionCount = 0;
  let createdItemCount = 0;
  let skippedItemCount = 0;

  const optionSeedKey = optionDef.seed_key?.trim() || null;
  const optionDraft: ProposalTemplateOptionDraft = {
    template_id: templateId,
    name: optionDef.name,
    customer_label: optionDef.customer_label ?? null,
    description: optionDef.description ?? null,
    selection_mode: optionDef.selection_mode ?? "single",
    is_default: optionDef.is_default ?? false,
    visible_to_customer: optionDef.visible_to_customer ?? true,
    sort_order: optionDef.sort_order ?? null,
    metadata: mergeMetadataWithSeedKey(optionSeedKey, optionDef.metadata),
  };

  const createdOption = await createProposalTemplateOption(optionDraft, {
    companyId,
    templateId,
  });

  if (!createdOption?.id) {
    errors.push(`Could not create package “${optionDef.customer_label ?? optionDef.name}”.`);
    return { ok: false, createdSectionCount, createdItemCount, skippedItemCount };
  }

  const optionId = createdOption.id;
  for (const sectionDef of optionDef.sections ?? []) {
    const sectionResult = await createSectionGraph({
      companyId,
      templateId,
      optionId,
      sectionDef,
      catalogSeedToItemId,
      missingCatalogSeedKeys,
      errors,
    });
    if (sectionResult.ok) {
      createdSectionCount += 1;
      createdItemCount += sectionResult.createdItemCount;
      skippedItemCount += sectionResult.skippedItemCount;
    }
  }

  return { ok: true, createdSectionCount, createdItemCount, skippedItemCount };
}

async function createSectionGraph(params: {
  companyId: string;
  templateId: string;
  optionId: string;
  sectionDef: DefaultProposalTemplateSectionDefinition;
  catalogSeedToItemId: Map<string, string>;
  missingCatalogSeedKeys: Set<string>;
  errors: string[];
}): Promise<{
  ok: boolean;
  createdItemCount: number;
  skippedItemCount: number;
}> {
  const {
    companyId,
    templateId,
    optionId,
    sectionDef,
    catalogSeedToItemId,
    missingCatalogSeedKeys,
    errors,
  } = params;

  let createdItemCount = 0;
  let skippedItemCount = 0;

  const sectionSeedKey = sectionDef.seed_key?.trim() || null;
  const sectionDraft: ProposalTemplateSectionDraft = {
    template_id: templateId,
    option_id: optionId,
    kind: sectionDef.kind,
    name: sectionDef.name,
    customer_title: sectionDef.customer_title ?? null,
    customer_visibility: sectionDef.customer_visibility ?? "customer_visible",
    sort_order: sectionDef.sort_order ?? null,
    content: sectionDef.content ?? {},
    metadata: mergeMetadataWithSeedKey(sectionSeedKey, sectionDef.metadata),
  };

  const createdSection = await createProposalTemplateSection(sectionDraft, {
    companyId,
    templateId,
    optionId,
  });

  if (!createdSection?.id) {
    errors.push(`Could not create “${sectionDef.customer_title ?? sectionDef.name}”.`);
    return { ok: false, createdItemCount, skippedItemCount };
  }

  const sectionId = createdSection.id;
  for (const itemDef of sectionDef.items ?? []) {
    const itemOk = await createItemRow({
      companyId,
      templateId,
      optionId,
      sectionId,
      sectionSeedKey: sectionSeedKey ?? sectionId,
      itemDef,
      catalogSeedToItemId,
      missingCatalogSeedKeys,
      errors,
    });
    if (itemOk === "created") createdItemCount += 1;
    if (itemOk === "skipped") skippedItemCount += 1;
  }

  return { ok: true, createdItemCount, skippedItemCount };
}

async function createItemRow(params: {
  companyId: string;
  templateId: string;
  optionId: string;
  sectionId: string;
  sectionSeedKey: string;
  itemDef: DefaultProposalTemplateItemDefinition;
  catalogSeedToItemId: Map<string, string>;
  missingCatalogSeedKeys: Set<string>;
  errors: string[];
}): Promise<"created" | "skipped" | "failed"> {
  const {
    companyId,
    templateId,
    optionId,
    sectionId,
    sectionSeedKey,
    itemDef,
    catalogSeedToItemId,
    missingCatalogSeedKeys,
    errors,
  } = params;

  const catalogSeedKey = itemDef.catalog_seed_key?.trim();
  if (!catalogSeedKey) {
    errors.push("A prepared catalog line was missing its Catalog link key.");
    return "failed";
  }

  const catalogItemId = catalogSeedToItemId.get(catalogSeedKey) ?? null;
  if (!catalogItemId) {
    missingCatalogSeedKeys.add(catalogSeedKey);
    return "skipped";
  }

  const itemSeedKey = synthesizeItemSeedKey(sectionSeedKey, itemDef);
  const itemDraft: ProposalTemplateItemDraft = {
    template_id: templateId,
    option_id: optionId,
    section_id: sectionId,
    catalog_item_id: catalogItemId,
    catalog_seed_key: catalogSeedKey,
    composition_role: itemDef.composition_role ?? null,
    composition_slot_key: itemDef.composition_slot_key ?? null,
    item_role: itemDef.item_role,
    customer_name_override: itemDef.customer_name_override ?? null,
    description_override: itemDef.description_override ?? null,
    customer_visibility: itemDef.customer_visibility ?? "inherit_catalog",
    quantity_rule: itemDef.quantity_rule ?? null,
    upgrade_effect: itemDef.upgrade_effect ?? null,
    replaces_template_item_id: null,
    default_selected: itemDef.default_selected === true,
    sort_order: itemDef.sort_order ?? null,
    metadata: mergeMetadataWithSeedKey(itemSeedKey, {
      ...(itemDef.metadata ?? {}),
      catalog_seed_key: catalogSeedKey,
    }),
  };

  const createdItem = await createProposalTemplateItem(itemDraft, {
    companyId,
    templateId,
    optionId,
    sectionId,
  });

  if (!createdItem?.id) {
    errors.push("Could not link a Catalog item into the new template.");
    return "failed";
  }

  return "created";
}
