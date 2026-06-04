import type { InstallDefaultRoofingProposalTemplatesResult } from "@/app/lib/defaultRoofingProposalTemplateInstall";
import {
  DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY,
  DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS,
} from "@/app/lib/defaultRoofingProposalTemplates";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";

export const STARTER_TEMPLATE_DEFINITION_COUNT =
  DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS.length;

export function extractTemplateSeedKey(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = metadata.seed_key;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function findStarterProposalTemplate(
  templates: ProposalTemplate[]
): ProposalTemplate | null {
  return (
    templates.find(
      (row) =>
        extractTemplateSeedKey(row.metadata ?? null) === DEFAULT_ROOF_REPLACEMENT_TEMPLATE_SEED_KEY
    ) ?? null
  );
}

export function formatStarterTemplateAvailability(installed: boolean): string {
  if (installed) {
    return "Installed";
  }
  if (STARTER_TEMPLATE_DEFINITION_COUNT <= 0) {
    return "Not available";
  }
  return `${STARTER_TEMPLATE_DEFINITION_COUNT} starter template available, not installed`;
}

export function countCatalogLinkedTemplateItems(graph: ProposalTemplateGraph): number {
  return graph.items.filter(
    (item) => item.catalog_item_id != null && String(item.catalog_item_id).trim().length > 0
  ).length;
}

export function sortTemplateOptionsByOrder<T extends { sort_order?: number | null }>(
  options: T[]
): T[] {
  return [...options].sort((a, b) => {
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return 0;
  });
}

export function getPassiveStarterOptionLabels(): string[] {
  const def = DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0];
  if (!def?.options?.length) return [];
  return def.options.map((opt) => opt.customer_label ?? opt.name);
}

export function sumInstallCreatedCounts(result: InstallDefaultRoofingProposalTemplatesResult): number {
  return (
    result.createdTemplateCount +
    result.createdOptionCount +
    result.createdSectionCount +
    result.createdItemCount
  );
}

export function sumInstallSkippedCounts(result: InstallDefaultRoofingProposalTemplatesResult): number {
  return (
    result.skippedTemplateCount +
    result.skippedOptionCount +
    result.skippedSectionCount +
    result.skippedItemCount
  );
}

export function deriveInstallFeedback(result: InstallDefaultRoofingProposalTemplatesResult): {
  message: string | null;
  error: string | null;
} {
  const createdTotal = sumInstallCreatedCounts(result);
  const skippedTotal = sumInstallSkippedCounts(result);

  if (result.failedCount > 0 && createdTotal === 0 && !result.templateId) {
    return {
      message: null,
      error:
        result.errors?.length && result.errors.length > 0
          ? result.errors.join(" ")
          : "Install failed. No starter template graph was created.",
    };
  }

  if (createdTotal > 0) {
    const parts: string[] = [];
    if (result.createdTemplateCount > 0) {
      parts.push(
        `${result.createdTemplateCount} template${result.createdTemplateCount === 1 ? "" : "s"}`
      );
    }
    if (result.createdOptionCount > 0) {
      parts.push(
        `${result.createdOptionCount} option${result.createdOptionCount === 1 ? "" : "s"}`
      );
    }
    if (result.createdSectionCount > 0) {
      parts.push(
        `${result.createdSectionCount} section${result.createdSectionCount === 1 ? "" : "s"}`
      );
    }
    if (result.createdItemCount > 0) {
      parts.push(`${result.createdItemCount} line item${result.createdItemCount === 1 ? "" : "s"}`);
    }
    return {
      message: `Installed ${parts.join(", ")}.`,
      error:
        result.failedCount > 0 || result.missingCatalogSeedKeys.length > 0
          ? "Some rows were skipped or failed. See last install result below."
          : null,
    };
  }

  if (skippedTotal > 0 && result.templateId) {
    return {
      message: `Starter template recheck complete. Created ${createdTotal}, skipped ${skippedTotal}, failed ${result.failedCount}.`,
      error:
        result.missingCatalogSeedKeys.length > 0
          ? "Some line items are still missing catalog seed keys. Install or recheck catalog items, then recheck the template."
          : result.failedCount > 0
            ? "Some rows failed during recheck. See details below."
            : null,
    };
  }

  if (result.failedCount > 0) {
    return {
      message: null,
      error:
        result.errors?.length && result.errors.length > 0
          ? result.errors.join(" ")
          : "Install completed with failures.",
    };
  }

  return { message: "Install finished. No new rows were created.", error: null };
}
