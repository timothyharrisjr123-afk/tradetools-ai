import { buildTemplateContentEditorViewModel } from "@/app/lib/proposalTemplateContentEditorView";
import type { TemplateContentEditorViewModel } from "@/app/lib/proposalTemplateContentEditorView";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import { findStarterProposalTemplate } from "./templatesSetupUtils";

export function sortTemplatesByOrder(templates: ProposalTemplate[]): ProposalTemplate[] {
  return [...templates].sort((left, right) => {
    const leftOrder = left.sort_order ?? 0;
    const rightOrder = right.sort_order ?? 0;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.name.localeCompare(right.name);
  });
}

export function resolveDefaultSelectedTemplateId(templates: ProposalTemplate[]): string | null {
  if (templates.length === 0) return null;
  const starter = findStarterProposalTemplate(templates);
  if (starter?.id) return starter.id;
  return sortTemplatesByOrder(templates)[0]?.id ?? null;
}

export function isTemplateWorkspaceActive(
  templates: ProposalTemplate[],
  selectedGraph: ProposalTemplateGraph | null
): boolean {
  return templates.length > 0 && selectedGraph != null;
}

export function buildWorkspaceContentViewModel(
  graph: ProposalTemplateGraph | null
): TemplateContentEditorViewModel | null {
  if (!graph) return null;
  return buildTemplateContentEditorViewModel(graph);
}

export function summarizeSelectedTemplateGraph(graph: ProposalTemplateGraph): {
  optionCount: number;
  sectionCount: number;
  lineItemCount: number;
} {
  return {
    optionCount: graph.options.length,
    sectionCount: graph.sections.length,
    lineItemCount: graph.items.length,
  };
}
