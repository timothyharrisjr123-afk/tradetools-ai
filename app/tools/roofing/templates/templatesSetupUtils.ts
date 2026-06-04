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
