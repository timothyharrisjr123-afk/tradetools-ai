"use client";

import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import { filterActiveTemplateOptions } from "@/app/tools/roofing/templates/templatesPackageStructurePlanner";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { resolvePackageMeta } from "@/app/lib/proposalPackagePresentation";

type ProposalBuilderPackageChoiceListProps = {
  graph: ProposalTemplateGraph;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  /** Authoritative total for the currently selected package only. */
  selectedPackageTotalLabel?: string | null;
};

/**
 * Compact job-specific package decision list.
 * Selected total comes from existing loaded truth; other packages omit price.
 */
export default function ProposalBuilderPackageChoiceList({
  graph,
  selectedOptionId,
  onSelectOption,
  selectedPackageTotalLabel = null,
}: ProposalBuilderPackageChoiceListProps) {
  const options = sortTemplateOptionsByOrder(
    filterActiveTemplateOptions(graph.options)
  );
  const selectedTotal = (selectedPackageTotalLabel ?? "").trim();

  if (options.length === 0) {
    return <p className="text-sm text-slate-500">No packages on this proposal draft.</p>;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Proposal packages"
      data-builder-package-choice-list
      data-builder-package-choice-count={options.length}
      className="divide-y divide-slate-100"
    >
      {options.map((option) => {
        const label =
          (option.customer_label ?? option.name).trim() || option.name;
        const meta = resolvePackageMeta(label, option.description);
        const selected = option.id === selectedOptionId;

        return (
          <div
            key={option.id}
            role="radio"
            aria-checked={selected}
            tabIndex={0}
            data-builder-package-choice-row
            data-builder-package-choice-selected={selected ? "true" : undefined}
            onClick={() => onSelectOption(option.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectOption(option.id);
              }
            }}
            className={`flex min-h-[44px] cursor-pointer items-start gap-3 px-1 py-3 sm:px-0 ${
              selected ? "bg-slate-50/90" : "bg-transparent hover:bg-slate-50/60"
            }`}
          >
            <span
              className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                selected
                  ? "border-blue-600 bg-blue-600"
                  : "border-slate-300 bg-white"
              }`}
              aria-hidden
            >
              {selected ? (
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[14px] font-semibold leading-snug text-slate-950">
                  {label}
                </p>
                {selected && selectedTotal ? (
                  <p
                    className="shrink-0 tabular-nums text-[13.5px] font-semibold text-slate-950"
                    data-builder-package-choice-total
                  >
                    {selectedTotal}
                  </p>
                ) : null}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-slate-600">
                {meta.description}
              </p>
              {meta.bullets.length > 0 ? (
                <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">
                  {meta.bullets.join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="flex min-h-[44px] shrink-0 items-center sm:min-h-0">
              {selected ? (
                <span
                  className="text-[12.5px] font-semibold text-slate-700"
                  data-builder-package-choice-selected-label
                >
                  Selected
                </span>
              ) : (
                <span
                  className="text-[12.5px] font-semibold text-blue-700"
                  data-builder-package-choice-select
                >
                  Select
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
