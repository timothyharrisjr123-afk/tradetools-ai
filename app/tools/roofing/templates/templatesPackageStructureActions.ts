/**
 * Client orchestration for R1 package structure authorship.
 * Uses existing template store writes; does not mutate proposal drafts/sent.
 */

import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  createProposalTemplateItem,
  createProposalTemplateOption,
  createProposalTemplateSection,
  softRemoveProposalTemplateOption,
  updateProposalTemplateItem,
  updateProposalTemplateOption,
} from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateOption } from "@/app/lib/proposalTemplateTypes";
import {
  BLANK_PACKAGE_SHELL_SECTIONS,
  countIncludedAndUpgradeItems,
  nextPackageSortOrder,
  normalizePackageStructureDraft,
  planPackageRemove,
  planPackageReorder,
  sanitizeCopiedOptionMetadata,
  type PackageStructureDraft,
} from "./templatesPackageStructurePlanner";

export type PackageStructureActionResult =
  | { ok: true; optionId: string }
  | { ok: false; error: string };

async function clearAllDefaults(
  options: readonly ProposalTemplateOption[],
  scope: { companyId: string; templateId: string }
): Promise<string | null> {
  for (const option of options) {
    if (!option.is_default) continue;
    const cleared = await updateProposalTemplateOption(
      option.id,
      { is_default: false },
      scope
    );
    if (!cleared) return "Could not update default package.";
  }
  return null;
}

export async function copyExistingTemplatePackage(input: {
  companyId: string;
  templateId: string;
  graph: ProposalTemplateGraph;
  sourceOptionId: string;
  draft: PackageStructureDraft;
}): Promise<PackageStructureActionResult> {
  const normalized = normalizePackageStructureDraft(input.draft);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error ?? "Enter a package name." };
  }

  const source = input.graph.options.find((row) => row.id === input.sourceOptionId);
  if (!source) {
    return { ok: false, error: "Choose a package to copy." };
  }

  const scope = { companyId: input.companyId, templateId: input.templateId };

  if (normalized.isDefault) {
    const clearError = await clearAllDefaults(input.graph.options, scope);
    if (clearError) return { ok: false, error: clearError };
  }

  const created = await createProposalTemplateOption(
    {
      template_id: input.templateId,
      name: normalized.name,
      customer_label: normalized.customerLabel,
      description: normalized.description,
      selection_mode: source.selection_mode ?? "single",
      is_default: normalized.isDefault,
      visible_to_customer: source.visible_to_customer !== false,
      sort_order: nextPackageSortOrder(input.graph.options),
      metadata: sanitizeCopiedOptionMetadata(source.metadata),
    },
    scope
  );
  if (!created) {
    return { ok: false, error: "Could not create package." };
  }

  const sourceSections = input.graph.sections
    .filter((section) => section.option_id === source.id)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const sectionIdMap = new Map<string, string>();
  for (const section of sourceSections) {
    const createdSection = await createProposalTemplateSection(
      {
        template_id: input.templateId,
        option_id: created.id,
        kind: section.kind,
        name: section.name,
        customer_title: section.customer_title,
        customer_visibility: section.customer_visibility,
        sort_order: section.sort_order,
        content: section.content ? { ...section.content } : {},
        metadata: section.metadata ? { ...section.metadata } : {},
      },
      {
        companyId: input.companyId,
        templateId: input.templateId,
        optionId: created.id,
      }
    );
    if (!createdSection) {
      return { ok: false, error: "Could not copy package structure." };
    }
    sectionIdMap.set(section.id, createdSection.id);
  }

  const sourceItems = input.graph.items
    .filter((item) => item.option_id === source.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const itemIdMap = new Map<string, string>();
  for (const item of sourceItems) {
    const newSectionId = sectionIdMap.get(item.section_id);
    if (!newSectionId) continue;
    const createdItem = await createProposalTemplateItem(
      {
        template_id: input.templateId,
        option_id: created.id,
        section_id: newSectionId,
        catalog_item_id: item.catalog_item_id,
        catalog_seed_key: item.catalog_seed_key,
        item_role: item.item_role,
        customer_name_override: item.customer_name_override,
        description_override: item.description_override,
        customer_visibility: item.customer_visibility,
        quantity_rule: item.quantity_rule,
        upgrade_effect: item.upgrade_effect,
        replaces_template_item_id: null,
        default_selected: item.default_selected,
        sort_order: item.sort_order,
        metadata: item.metadata ? { ...item.metadata } : {},
      },
      {
        companyId: input.companyId,
        templateId: input.templateId,
        optionId: created.id,
        sectionId: newSectionId,
      }
    );
    if (!createdItem) {
      return { ok: false, error: "Could not copy included work." };
    }
    itemIdMap.set(item.id, createdItem.id);
  }

  for (const item of sourceItems) {
    if (!item.replaces_template_item_id) continue;
    const newItemId = itemIdMap.get(item.id);
    const newReplacesId = itemIdMap.get(item.replaces_template_item_id);
    if (!newItemId || !newReplacesId) continue;
    const updated = await updateProposalTemplateItem(
      newItemId,
      { replaces_template_item_id: newReplacesId },
      {
        companyId: input.companyId,
        templateId: input.templateId,
        optionId: created.id,
      }
    );
    if (!updated) {
      return { ok: false, error: "Could not finish copying package upgrades." };
    }
  }

  return { ok: true, optionId: created.id };
}

export async function createBlankTemplatePackageShell(input: {
  companyId: string;
  templateId: string;
  graph: ProposalTemplateGraph;
  draft: PackageStructureDraft;
}): Promise<PackageStructureActionResult> {
  const normalized = normalizePackageStructureDraft(input.draft);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error ?? "Enter a package name." };
  }

  const scope = { companyId: input.companyId, templateId: input.templateId };

  if (normalized.isDefault) {
    const clearError = await clearAllDefaults(input.graph.options, scope);
    if (clearError) return { ok: false, error: clearError };
  }

  const created = await createProposalTemplateOption(
    {
      template_id: input.templateId,
      name: normalized.name,
      customer_label: normalized.customerLabel,
      description: normalized.description,
      selection_mode: "single",
      is_default: normalized.isDefault,
      visible_to_customer: true,
      sort_order: nextPackageSortOrder(input.graph.options),
      metadata: {},
    },
    scope
  );
  if (!created) {
    return { ok: false, error: "Could not create package shell." };
  }

  for (const shell of BLANK_PACKAGE_SHELL_SECTIONS) {
    const section = await createProposalTemplateSection(
      {
        template_id: input.templateId,
        option_id: created.id,
        kind: shell.kind,
        name: shell.name,
        customer_title: shell.customer_title,
        customer_visibility: "customer_visible",
        sort_order: shell.sort_order,
        content: {},
        metadata: {},
      },
      {
        companyId: input.companyId,
        templateId: input.templateId,
        optionId: created.id,
      }
    );
    if (!section) {
      return { ok: false, error: "Could not prepare package shell." };
    }
  }

  return { ok: true, optionId: created.id };
}

export async function reorderTemplatePackages(input: {
  companyId: string;
  templateId: string;
  graph: ProposalTemplateGraph;
  optionId: string;
  direction: "up" | "down";
}): Promise<PackageStructureActionResult> {
  const plan = planPackageReorder(input.graph.options, input.optionId, input.direction);
  if (!plan.ok) {
    return { ok: false, error: plan.error };
  }

  for (let index = 0; index < plan.orderedIds.length; index += 1) {
    const id = plan.orderedIds[index]!;
    const updated = await updateProposalTemplateOption(
      id,
      { sort_order: (index + 1) * 10 },
      { companyId: input.companyId, templateId: input.templateId }
    );
    if (!updated) {
      return { ok: false, error: "Could not reorder packages." };
    }
  }

  return { ok: true, optionId: input.optionId };
}

export async function removeTemplatePackage(input: {
  companyId: string;
  templateId: string;
  graph: ProposalTemplateGraph;
  removeOptionId: string;
  replacementDefaultOptionId?: string | null;
}): Promise<PackageStructureActionResult> {
  const plan = planPackageRemove({
    options: input.graph.options,
    removeOptionId: input.removeOptionId,
    replacementDefaultOptionId: input.replacementDefaultOptionId,
  });
  if (!plan.ok) {
    return { ok: false, error: plan.error };
  }
  if (!plan.nextDefaultOptionId) {
    return { ok: false, error: "Keep at least one package in this setup." };
  }

  const removing = input.graph.options.find((row) => row.id === input.removeOptionId);
  const remaining = input.graph.options.filter((row) => row.id !== input.removeOptionId);
  const remainingHasDefault = remaining.some((row) => row.is_default === true);

  const scope = { companyId: input.companyId, templateId: input.templateId };

  // Soft-remove first: set removed_at and clear is_default so the unique
  // one-default-per-template index can accept a new active default.
  // Does not mutate sent proposal_options (source_template_option_id stays).
  const softRemoved = await softRemoveProposalTemplateOption(input.removeOptionId, scope);
  if (!softRemoved) {
    return {
      ok: false,
      error: "Could not remove this package from the setup.",
    };
  }

  if (removing?.is_default === true || !remainingHasDefault) {
    const set = await updateProposalTemplateOption(
      plan.nextDefaultOptionId,
      { is_default: true },
      scope
    );
    if (!set) return { ok: false, error: "Could not assign a new default package." };
  }

  return { ok: true, optionId: plan.nextDefaultOptionId };
}

export function summarizeSourcePackageForCopy(
  graph: ProposalTemplateGraph,
  sourceOptionId: string
): {
  optionId: string;
  label: string;
  includedCount: number;
  availableUpgradeCount: number;
} | null {
  const option = graph.options.find((row) => row.id === sourceOptionId);
  if (!option) return null;
  const counts = countIncludedAndUpgradeItems({
    optionId: option.id,
    sections: graph.sections,
    items: graph.items,
  });
  return {
    optionId: option.id,
    label: option.customer_label?.trim() || option.name,
    includedCount: counts.includedCount,
    availableUpgradeCount: counts.availableUpgradeCount,
  };
}
