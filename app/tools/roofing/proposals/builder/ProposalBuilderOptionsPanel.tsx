import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";

type ProposalBuilderOptionsPanelProps = {
  graph: ProposalTemplateGraph;
  selectedOptionId: string | null;
};

/**
 * Read-only package detail surface.
 * Shows authored description when present. Does not invent Standard/Enhanced/Premium copy.
 */
export default function ProposalBuilderOptionsPanel({
  graph,
  selectedOptionId,
}: ProposalBuilderOptionsPanelProps) {
  const options = sortTemplateOptionsByOrder(graph.options);
  const selectedOption =
    options.find((o) => o.id === selectedOptionId) ?? options[0] ?? null;

  if (!selectedOption) {
    return (
      <p className="text-sm text-slate-500">
        No customer-facing options are installed on this template.
      </p>
    );
  }

  const authoredDescription = selectedOption.description?.trim() || null;
  const showInternalName =
    Boolean((selectedOption.name ?? "").trim()) &&
    Boolean(selectedOption.customer_label) &&
    selectedOption.name !== selectedOption.customer_label;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Package details
        </p>
        {showInternalName ? (
          <p className="mt-0.5 text-xs text-slate-500">Internal name: {selectedOption.name}</p>
        ) : null}
      </div>

      {authoredDescription ? (
        <dl className="divide-y divide-slate-200/70">
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-xs font-medium text-slate-500">Customer-facing description</dt>
            <dd className="max-w-[60%] text-right text-sm text-slate-700">{authoredDescription}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
