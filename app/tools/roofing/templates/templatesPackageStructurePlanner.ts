/**
 * Pure planners for R1 package structure authorship (add / copy / blank / reorder / remove).
 * No store / network / UI.
 */

import type {
  ProposalTemplateItem,
  ProposalTemplateOption,
  ProposalTemplateSection,
  ProposalTemplateSectionKind,
} from "@/app/lib/proposalTemplateTypes";
import { sortTemplateOptionsByOrder } from "./templatesSetupUtils";

export type PackageAddMode = "copy_existing" | "start_blank";

export type PackageStructureDraft = {
  name: string;
  customerLabel: string;
  description: string;
  isDefault: boolean;
};

export type BlankPackageShellSection = {
  kind: ProposalTemplateSectionKind;
  name: string;
  customer_title: string;
  sort_order: number;
};

/** Valid empty package shell — same section kinds as guided create packet. */
export const BLANK_PACKAGE_SHELL_SECTIONS: readonly BlankPackageShellSection[] = [
  {
    kind: "text",
    name: "Project overview",
    customer_title: "Project overview",
    sort_order: 10,
  },
  {
    kind: "line_items",
    name: "Estimate",
    customer_title: "Estimate",
    sort_order: 20,
  },
  {
    kind: "upgrade_group",
    name: "Optional upgrades",
    customer_title: "Optional upgrades",
    sort_order: 30,
  },
  {
    kind: "text",
    name: "Scope notes",
    customer_title: "Scope notes",
    sort_order: 40,
  },
  {
    kind: "warranty",
    name: "Warranty",
    customer_title: "Warranty",
    sort_order: 50,
  },
  {
    kind: "terms",
    name: "Terms",
    customer_title: "Terms",
    sort_order: 60,
  },
] as const;

export function normalizePackageStructureDraft(
  draft: PackageStructureDraft
): {
  ok: boolean;
  name: string;
  customerLabel: string;
  description: string | null;
  isDefault: boolean;
  error: string | null;
} {
  const name = draft.name.trim();
  const customerLabel = draft.customerLabel.trim() || name;
  const description = draft.description.trim() ? draft.description.trim() : null;
  if (!name) {
    return {
      ok: false,
      name: "",
      customerLabel: "",
      description: null,
      isDefault: draft.isDefault,
      error: "Enter a package name.",
    };
  }
  return {
    ok: true,
    name,
    customerLabel,
    description,
    isDefault: draft.isDefault === true,
    error: null,
  };
}

export function nextPackageSortOrder(
  options: readonly { sort_order?: number | null }[]
): number {
  let max = 0;
  for (const option of options) {
    const value = Number(option.sort_order);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max + 10;
}

export function planPackageReorder(
  options: readonly ProposalTemplateOption[],
  optionId: string,
  direction: "up" | "down"
): { ok: true; orderedIds: string[] } | { ok: false; error: string } {
  const ordered = sortTemplateOptionsByOrder(filterActiveTemplateOptions(options));
  const index = ordered.findIndex((row) => row.id === optionId);
  if (index < 0) {
    return { ok: false, error: "Package not found." };
  }
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length) {
    return { ok: false, error: "Package is already at the edge." };
  }
  const next = [...ordered];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved!);
  return { ok: true, orderedIds: next.map((row) => row.id) };
}

export function planPackageRemove(input: {
  options: readonly ProposalTemplateOption[];
  removeOptionId: string;
  replacementDefaultOptionId?: string | null;
}):
  | {
      ok: true;
      removeOptionId: string;
      nextDefaultOptionId: string | null;
      remainingOptionIds: string[];
    }
  | { ok: false; error: string } {
  const ordered = sortTemplateOptionsByOrder(
    filterActiveTemplateOptions(input.options)
  );
  if (ordered.length <= 1) {
    return { ok: false, error: "Keep at least one package in this setup." };
  }
  const removing = ordered.find((row) => row.id === input.removeOptionId);
  if (!removing) {
    return { ok: false, error: "Package not found." };
  }
  const remaining = ordered.filter((row) => row.id !== input.removeOptionId);
  const remainingIds = remaining.map((row) => row.id);
  const wasDefault = removing.is_default === true;
  if (!wasDefault) {
    const currentDefault = remaining.find((row) => row.is_default === true);
    return {
      ok: true,
      removeOptionId: removing.id,
      nextDefaultOptionId: currentDefault?.id ?? remaining[0]?.id ?? null,
      remainingOptionIds: remainingIds,
    };
  }

  const requested = String(input.replacementDefaultOptionId ?? "").trim();
  if (requested && remainingIds.includes(requested)) {
    return {
      ok: true,
      removeOptionId: removing.id,
      nextDefaultOptionId: requested,
      remainingOptionIds: remainingIds,
    };
  }

  return {
    ok: true,
    removeOptionId: removing.id,
    nextDefaultOptionId: remaining[0]?.id ?? null,
    remainingOptionIds: remainingIds,
  };
}

export function countIncludedAndUpgradeItems(input: {
  optionId: string;
  sections: readonly ProposalTemplateSection[];
  items: readonly ProposalTemplateItem[];
}): { includedCount: number; availableUpgradeCount: number } {
  const optionSections = input.sections.filter((section) => section.option_id === input.optionId);
  const upgradeSectionIds = new Set(
    optionSections.filter((section) => section.kind === "upgrade_group").map((section) => section.id)
  );
  const optionSectionIds = new Set(optionSections.map((section) => section.id));
  let includedCount = 0;
  let availableUpgradeCount = 0;
  for (const item of input.items) {
    if (!optionSectionIds.has(item.section_id)) continue;
    if (upgradeSectionIds.has(item.section_id)) {
      availableUpgradeCount += 1;
    } else {
      includedCount += 1;
    }
  }
  return { includedCount, availableUpgradeCount };
}

/** Strip seed_key so unique (template_id, seed_key) index stays valid on copy. */
export function sanitizeCopiedOptionMetadata(
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const next = { ...metadata };
  delete next.seed_key;
  return next;
}

/** Active package = not soft-removed (removed_at null/empty). */
export function isActiveTemplateOption(option: {
  removed_at?: string | null;
}): boolean {
  const removedAt = option.removed_at;
  if (removedAt == null) return true;
  return String(removedAt).trim().length === 0;
}

export function filterActiveTemplateOptions<T extends { removed_at?: string | null }>(
  options: readonly T[]
): T[] {
  return options.filter(isActiveTemplateOption);
}

/**
 * Defense-in-depth filter for graphs that might include soft-removed options.
 * Store getProposalTemplateGraph already excludes removed options by default.
 */
export function filterActiveTemplateGraph<
  TOption extends { id: string; removed_at?: string | null },
  TSection extends { option_id: string },
  TItem extends { option_id: string },
>(input: {
  options: readonly TOption[];
  sections: readonly TSection[];
  items: readonly TItem[];
}): {
  options: TOption[];
  sections: TSection[];
  items: TItem[];
} {
  const options = filterActiveTemplateOptions(input.options);
  const activeIds = new Set(options.map((row) => row.id));
  return {
    options,
    sections: input.sections.filter((row) => activeIds.has(row.option_id)),
    items: input.items.filter((row) => activeIds.has(row.option_id)),
  };
}

export function buildCopiedPackageSummary(input: {
  sourceLabel: string;
  includedCount: number;
  availableUpgradeCount: number;
}): { title: string; detail: string } {
  return {
    title: `Copied from ${input.sourceLabel}`,
    detail:
      "Included work and available upgrades will be copied so you can adjust from a working package.",
  };
}
