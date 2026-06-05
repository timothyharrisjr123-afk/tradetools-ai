"use client";

import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  BUILDER_OPTION_PRICING_STATUS_PILL,
  BUILDER_OPTION_PRICING_STATUS_PILL_COMPLETE,
  BUILDER_OPTION_PRICING_STATUS_PILL_COMPLETE_ON_ACTIVE,
  BUILDER_OPTION_PRICING_STATUS_PILL_INCOMPLETE,
  BUILDER_OPTION_PRICING_STATUS_PILL_INCOMPLETE_ON_ACTIVE,
  BUILDER_OPTION_TAB,
  BUILDER_OPTION_TAB_ACTIVE,
  formatOptionPricingTabStatusLabel,
} from "./proposalBuilderConstants";

type ProposalBuilderOptionTabsProps = {
  graph: ProposalTemplateGraph;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  /** Per-option pricingComplete from orchestrator status slice — no dollars. */
  optionPricingCompleteById?: Record<string, boolean>;
};

export default function ProposalBuilderOptionTabs({
  graph,
  selectedOptionId,
  onSelectOption,
  optionPricingCompleteById,
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
        const pricingComplete = optionPricingCompleteById?.[option.id];
        const showPricingStatus = pricingComplete !== undefined;
        const statusLabel = showPricingStatus
          ? formatOptionPricingTabStatusLabel(pricingComplete)
          : null;
        const statusPillClass = showPricingStatus
          ? active
            ? pricingComplete
              ? BUILDER_OPTION_PRICING_STATUS_PILL_COMPLETE_ON_ACTIVE
              : BUILDER_OPTION_PRICING_STATUS_PILL_INCOMPLETE_ON_ACTIVE
            : pricingComplete
              ? BUILDER_OPTION_PRICING_STATUS_PILL_COMPLETE
              : BUILDER_OPTION_PRICING_STATUS_PILL_INCOMPLETE
          : "";

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`inline-flex items-center ${active ? BUILDER_OPTION_TAB_ACTIVE : BUILDER_OPTION_TAB}`}
            onClick={() => onSelectOption(option.id)}
          >
            <span>{label}</span>
            {showPricingStatus && statusLabel ? (
              <span className={`${BUILDER_OPTION_PRICING_STATUS_PILL} ${statusPillClass}`}>
                {statusLabel}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
