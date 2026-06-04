"use client";

import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { BUILDER_OPTION_TAB, BUILDER_OPTION_TAB_ACTIVE } from "./proposalBuilderConstants";

type ProposalBuilderOptionTabsProps = {
  graph: ProposalTemplateGraph;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
};

export default function ProposalBuilderOptionTabs({
  graph,
  selectedOptionId,
  onSelectOption,
}: ProposalBuilderOptionTabsProps) {
  const options = sortTemplateOptionsByOrder(graph.options);

  if (options.length === 0) {
    return (
      <p className="text-sm text-slate-500">No customer-facing options are installed on this template.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Proposal options">
      {options.map((option) => {
        const active = option.id === selectedOptionId;
        const label = (option.customer_label ?? option.name).trim() || option.name;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? BUILDER_OPTION_TAB_ACTIVE : BUILDER_OPTION_TAB}
            onClick={() => onSelectOption(option.id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
