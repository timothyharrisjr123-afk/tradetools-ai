/**
 * Idempotent install of default roofing proposal templates into proposal template tables.
 *
 * Uses passive definitions from defaultRoofingProposalTemplates.ts and proposalTemplateStore
 * create/read helpers only. Resolves catalog_seed_key via catalog items (read-only catalogStore).
 *
 * Insert-only: never updates or deletes existing template graph rows.
 * Does not install catalog items, wire UI, or touch Proposal Builder / pricing.
 *
 * Stage 3G5: helper only — not wired from app routes yet.
 */

import { getCatalogItemsByCompany } from "@/app/lib/catalogStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS,
  DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY,
} from "@/app/lib/defaultRoofingProposalTemplates";
import type {
  DefaultProposalTemplateDefinition,
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
  getProposalTemplatesByCompany,
  type ProposalTemplateGraph,
} from "@/app/lib/proposalTemplateStore";

export type InstallDefaultRoofingProposalTemplatesResult = {
  companyId: string;
  templateId: string | null;
  templateSeedKey: string;
  createdTemplateCount: number;
  createdOptionCount: number;
  createdSectionCount: number;
  createdItemCount: number;
  skippedTemplateCount: number;
  skippedOptionCount: number;
  skippedSectionCount: number;
  skippedItemCount: number;
  failedCount: number;
  createdTemplateIds: string[];
  createdOptionIds: string[];
  createdSectionIds: string[];
  createdItemIds: string[];
  missingCatalogSeedKeys: string[];
  errors?: string[];
  installedOptionCount?: number;
  installedSectionCount?: number;
  installedItemCount?: number;
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
  if (seedKey) {
    base.seed_key = seedKey;
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

type TemplateGraphMaps = {
  optionSeedToId: Map<string, string>;
  sectionSeedToId: Map<string, string>;
  itemSeedToSectionItemKey: Map<string, string>;
};

function itemMapKey(sectionId: string, itemSeedKey: string): string {
  return `${sectionId}\0${itemSeedKey}`;
}

function buildGraphMaps(graph: ProposalTemplateGraph): TemplateGraphMaps {
  const optionSeedToId = new Map<string, string>();
  const sectionSeedToId = new Map<string, string>();
  const itemSeedToSectionItemKey = new Map<string, string>();

  for (const option of graph.options) {
    const seed = extractSeedKey(option.metadata ?? null);
    if (seed) optionSeedToId.set(seed, option.id);
  }

  for (const section of graph.sections) {
    const seed = extractSeedKey(section.metadata ?? null);
    if (seed) sectionSeedToId.set(seed, section.id);
  }

  for (const item of graph.items) {
    const seed = extractSeedKey(item.metadata ?? null);
    if (seed) itemSeedToSectionItemKey.set(itemMapKey(item.section_id, seed), item.id);
  }

  return { optionSeedToId, sectionSeedToId, itemSeedToSectionItemKey };
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

function recordMissingCatalogSeed(
  missingKeys: Set<string>,
  catalogSeedKey: string
): void {
  missingKeys.add(catalogSeedKey);
}

/**
 * Insert missing default proposal template graph rows for a company (insert-only, seed_key dedupe).
 */
export async function installDefaultRoofingProposalTemplates(
  companyId: string
): Promise<InstallDefaultRoofingProposalTemplatesResult | null> {
  const scopedCompanyId = String(companyId || "").trim();
  if (!isUuidLike(scopedCompanyId)) {
    console.error(
      "[defaultRoofingProposalTemplateInstall] installDefaultRoofingProposalTemplates: invalid company id"
    );
    return null;
  }

  const errors: string[] = [];
  const missingCatalogSeedKeys = new Set<string>();

  let createdTemplateCount = 0;
  let createdOptionCount = 0;
  let createdSectionCount = 0;
  let createdItemCount = 0;
  let skippedTemplateCount = 0;
  let skippedOptionCount = 0;
  let skippedSectionCount = 0;
  let skippedItemCount = 0;
  let failedCount = 0;

  const createdTemplateIds: string[] = [];
  const createdOptionIds: string[] = [];
  const createdSectionIds: string[] = [];
  const createdItemIds: string[] = [];

  const catalogItems = await getCatalogItemsByCompany(scopedCompanyId);
  const catalogSeedToItemId = buildCatalogSeedToItemIdMap(catalogItems);

  const existingTemplates = await getProposalTemplatesByCompany(scopedCompanyId);

  for (const templateDef of DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS) {
    const templateSeedKey =
      extractSeedKey(templateDef.metadata) ?? DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY;

    let templateId: string | null = null;

    const existingTemplate = existingTemplates.find(
      (row) => extractSeedKey(row.metadata ?? null) === templateSeedKey
    );

    if (existingTemplate?.id) {
      templateId = existingTemplate.id;
      skippedTemplateCount += 1;
    } else {
      const createdTemplate = await createProposalTemplate({
        company_id: scopedCompanyId,
        name: templateDef.name,
        description: templateDef.description ?? null,
        status: templateDef.status ?? "draft",
        active: true,
        sort_order: templateDef.sort_order ?? null,
        metadata: mergeMetadataWithSeedKey(templateSeedKey, templateDef.metadata),
      });

      if (createdTemplate?.id) {
        templateId = createdTemplate.id;
        createdTemplateCount += 1;
        createdTemplateIds.push(createdTemplate.id);
        existingTemplates.push(createdTemplate);
      } else {
        failedCount += 1;
        errors.push(`Failed to create proposal template: ${templateSeedKey}`);
        console.error(
          "[defaultRoofingProposalTemplateInstall] createProposalTemplate failed:",
          { companyId: scopedCompanyId, templateSeedKey }
        );
        continue;
      }
    }

    if (!templateId) {
      failedCount += 1;
      errors.push(`No template id available for seed: ${templateSeedKey}`);
      continue;
    }

    let graph = await getProposalTemplateGraph(templateId, { companyId: scopedCompanyId });
    if (!graph) {
      failedCount += 1;
      errors.push(`Failed to load proposal template graph: ${templateSeedKey}`);
      console.error(
        "[defaultRoofingProposalTemplateInstall] getProposalTemplateGraph failed:",
        { companyId: scopedCompanyId, templateId, templateSeedKey }
      );
      continue;
    }

    let maps = buildGraphMaps(graph);

    const options = templateDef.options ?? [];
    for (const optionDef of options) {
      const optionInstalled = await installOption({
        companyId: scopedCompanyId,
        templateId,
        optionDef,
        catalogSeedToItemId,
        maps,
        missingCatalogSeedKeys,
        errors,
        counters: {
          onOptionCreated: (id) => {
            createdOptionCount += 1;
            createdOptionIds.push(id);
          },
          onOptionSkipped: () => {
            skippedOptionCount += 1;
          },
          onSectionCreated: (id) => {
            createdSectionCount += 1;
            createdSectionIds.push(id);
          },
          onSectionSkipped: () => {
            skippedSectionCount += 1;
          },
          onItemCreated: (id) => {
            createdItemCount += 1;
            createdItemIds.push(id);
          },
          onItemSkipped: () => {
            skippedItemCount += 1;
          },
          onFailed: () => {
            failedCount += 1;
          },
        },
      });

      if (!optionInstalled) {
        continue;
      }

      graph = await getProposalTemplateGraph(templateId, { companyId: scopedCompanyId });
      if (graph) {
        maps = buildGraphMaps(graph);
      }
    }
  }

  const primaryTemplateId =
    existingTemplates.find(
      (row) =>
        extractSeedKey(row.metadata ?? null) === DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY
    )?.id ??
    createdTemplateIds[0] ??
    null;

  let installedOptionCount: number | undefined;
  let installedSectionCount: number | undefined;
  let installedItemCount: number | undefined;

  if (primaryTemplateId) {
    const finalGraph = await getProposalTemplateGraph(primaryTemplateId, {
      companyId: scopedCompanyId,
    });
    if (finalGraph) {
      installedOptionCount = finalGraph.options.length;
      installedSectionCount = finalGraph.sections.length;
      installedItemCount = finalGraph.items.length;
    }
  }

  const result: InstallDefaultRoofingProposalTemplatesResult = {
    companyId: scopedCompanyId,
    templateId: primaryTemplateId,
    templateSeedKey: DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY,
    createdTemplateCount,
    createdOptionCount,
    createdSectionCount,
    createdItemCount,
    skippedTemplateCount,
    skippedOptionCount,
    skippedSectionCount,
    skippedItemCount,
    failedCount,
    createdTemplateIds,
    createdOptionIds,
    createdSectionIds,
    createdItemIds,
    missingCatalogSeedKeys: [...missingCatalogSeedKeys].sort(),
    installedOptionCount,
    installedSectionCount,
    installedItemCount,
  };

  if (errors.length > 0) {
    result.errors = errors;
  }

  if (
    createdTemplateCount === 0 &&
    createdOptionCount === 0 &&
    createdSectionCount === 0 &&
    createdItemCount === 0 &&
    failedCount > 0 &&
    !primaryTemplateId
  ) {
    console.error(
      "[defaultRoofingProposalTemplateInstall] installDefaultRoofingProposalTemplates: install produced no template graph",
      { companyId: scopedCompanyId, failedCount, errors }
    );
  }

  return result;
}

type InstallCounters = {
  onOptionCreated: (id: string) => void;
  onOptionSkipped: () => void;
  onSectionCreated: (id: string) => void;
  onSectionSkipped: () => void;
  onItemCreated: (id: string) => void;
  onItemSkipped: () => void;
  onFailed: () => void;
};

async function installOption(params: {
  companyId: string;
  templateId: string;
  optionDef: DefaultProposalTemplateOptionDefinition;
  catalogSeedToItemId: Map<string, string>;
  maps: TemplateGraphMaps;
  missingCatalogSeedKeys: Set<string>;
  errors: string[];
  counters: InstallCounters;
}): Promise<boolean> {
  const {
    companyId,
    templateId,
    optionDef,
    catalogSeedToItemId,
    maps,
    missingCatalogSeedKeys,
    errors,
    counters,
  } = params;

  const optionSeedKey = optionDef.seed_key?.trim() || null;
  if (!optionSeedKey) {
    counters.onFailed();
    errors.push(`Option missing seed_key under template ${templateId}`);
    return false;
  }

  let optionId = maps.optionSeedToId.get(optionSeedKey) ?? null;

  if (optionId) {
    counters.onOptionSkipped();
  } else {
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
      counters.onFailed();
      errors.push(`Failed to create proposal template option: ${optionSeedKey}`);
      console.error(
        "[defaultRoofingProposalTemplateInstall] createProposalTemplateOption failed:",
        { companyId, templateId, optionSeedKey }
      );
      return false;
    }

    optionId = createdOption.id;
    maps.optionSeedToId.set(optionSeedKey, optionId);
    counters.onOptionCreated(optionId);
  }

  const sections = optionDef.sections ?? [];
  for (const sectionDef of sections) {
    const sectionOk = await installSection({
      companyId,
      templateId,
      optionId,
      sectionDef,
      catalogSeedToItemId,
      maps,
      missingCatalogSeedKeys,
      errors,
      counters,
    });
    if (!sectionOk) {
      continue;
    }
  }

  return true;
}

async function installSection(params: {
  companyId: string;
  templateId: string;
  optionId: string;
  sectionDef: DefaultProposalTemplateSectionDefinition;
  catalogSeedToItemId: Map<string, string>;
  maps: TemplateGraphMaps;
  missingCatalogSeedKeys: Set<string>;
  errors: string[];
  counters: InstallCounters;
}): Promise<boolean> {
  const {
    companyId,
    templateId,
    optionId,
    sectionDef,
    catalogSeedToItemId,
    maps,
    missingCatalogSeedKeys,
    errors,
    counters,
  } = params;

  const sectionSeedKey = sectionDef.seed_key?.trim() || null;
  if (!sectionSeedKey) {
    counters.onFailed();
    errors.push(`Section missing seed_key under option ${optionId}`);
    return false;
  }

  let sectionId = maps.sectionSeedToId.get(sectionSeedKey) ?? null;

  if (sectionId) {
    counters.onSectionSkipped();
  } else {
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
      counters.onFailed();
      errors.push(`Failed to create proposal template section: ${sectionSeedKey}`);
      console.error(
        "[defaultRoofingProposalTemplateInstall] createProposalTemplateSection failed:",
        { companyId, templateId, optionId, sectionSeedKey }
      );
      return false;
    }

    sectionId = createdSection.id;
    maps.sectionSeedToId.set(sectionSeedKey, sectionId);
    counters.onSectionCreated(sectionId);
  }

  const items = sectionDef.items ?? [];
  for (const itemDef of items) {
    await installItem({
      companyId,
      templateId,
      optionId,
      sectionId,
      sectionSeedKey,
      itemDef,
      catalogSeedToItemId,
      maps,
      missingCatalogSeedKeys,
      errors,
      counters,
    });
  }

  return true;
}

async function installItem(params: {
  companyId: string;
  templateId: string;
  optionId: string;
  sectionId: string;
  sectionSeedKey: string;
  itemDef: DefaultProposalTemplateItemDefinition;
  catalogSeedToItemId: Map<string, string>;
  maps: TemplateGraphMaps;
  missingCatalogSeedKeys: Set<string>;
  errors: string[];
  counters: InstallCounters;
}): Promise<void> {
  const {
    companyId,
    templateId,
    optionId,
    sectionId,
    sectionSeedKey,
    itemDef,
    catalogSeedToItemId,
    maps,
    missingCatalogSeedKeys,
    errors,
    counters,
  } = params;

  const catalogSeedKey = itemDef.catalog_seed_key?.trim();
  if (!catalogSeedKey) {
    counters.onFailed();
    errors.push(`Item missing catalog_seed_key under section ${sectionSeedKey}`);
    return;
  }

  const itemSeedKey = synthesizeItemSeedKey(sectionSeedKey, itemDef);
  const existingItemKey = itemMapKey(sectionId, itemSeedKey);
  if (maps.itemSeedToSectionItemKey.has(existingItemKey)) {
    counters.onItemSkipped();
    return;
  }

  const catalogItemId = catalogSeedToItemId.get(catalogSeedKey) ?? null;
  if (!catalogItemId) {
    counters.onItemSkipped();
    recordMissingCatalogSeed(missingCatalogSeedKeys, catalogSeedKey);
    errors.push(
      `Skipped item (missing catalog seed): ${catalogSeedKey} in section ${sectionSeedKey}`
    );
    return;
  }

  const itemDraft: ProposalTemplateItemDraft = {
    template_id: templateId,
    option_id: optionId,
    section_id: sectionId,
    catalog_item_id: catalogItemId,
    catalog_seed_key: catalogSeedKey,
    item_role: itemDef.item_role,
    customer_name_override: itemDef.customer_name_override ?? null,
    description_override: itemDef.description_override ?? null,
    customer_visibility: itemDef.customer_visibility ?? "inherit_catalog",
    quantity_rule: itemDef.quantity_rule ?? null,
    upgrade_effect: itemDef.upgrade_effect ?? null,
    replaces_template_item_id: null,
    default_selected: itemDef.default_selected === true,
    sort_order: itemDef.sort_order ?? null,
    metadata: mergeMetadataWithSeedKey(
      itemSeedKey,
      itemDef.metadata ?? { catalog_seed_key: catalogSeedKey }
    ),
  };

  const createdItem = await createProposalTemplateItem(itemDraft, {
    companyId,
    templateId,
    optionId,
    sectionId,
  });

  if (!createdItem?.id) {
    counters.onFailed();
    errors.push(`Failed to create proposal template item: ${itemSeedKey}`);
    console.error(
      "[defaultRoofingProposalTemplateInstall] createProposalTemplateItem failed:",
      { companyId, templateId, sectionId, itemSeedKey, catalogSeedKey }
    );
    return;
  }

  maps.itemSeedToSectionItemKey.set(existingItemKey, createdItem.id);
  counters.onItemCreated(createdItem.id);
}
