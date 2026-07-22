"use client";

import { useState } from "react";
import { Check, Settings2 } from "lucide-react";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { WorkbenchPackageZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import { canChangeBuilderDraftPackage } from "@/app/lib/proposalBuilderDraftPackageOptions";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import ProposalBuilderPackageSelector from "./ProposalBuilderPackageSelector";
import {
  WORKBENCH_EDIT_PACKAGE_TITLE,
  WORKBENCH_EDIT_SCOPE_HINT,
  WORKBENCH_PACKAGE_MODULE,
} from "./proposalBuilderConstants";

type ProposalBuilderWorkbenchPackageZoneProps = {
  packageZone: WorkbenchPackageZone;
  packageSelectorGraph: ProposalTemplateGraph;
  draftScopedPackagePicker?: boolean;
  selectedOptionId: string | null;
  effectiveOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  onOpenEditPackage: () => void;
};

export default function ProposalBuilderWorkbenchPackageZone({
  packageZone,
  packageSelectorGraph,
  draftScopedPackagePicker = false,
  selectedOptionId,
  effectiveOptionId,
  onSelectOption,
  onOpenEditPackage,
}: ProposalBuilderWorkbenchPackageZoneProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const options = sortTemplateOptionsByOrder(packageSelectorGraph.options);
  const optionCount = options.length;
  const allowChangePackage = draftScopedPackagePicker
    ? canChangeBuilderDraftPackage(optionCount)
    : optionCount >= 2;

  const packageTitle = packageZone.label
    ? `${packageZone.label} package`
    : "Package";

  return (
    <section
      className={`${WORKBENCH_PACKAGE_MODULE} overflow-visible`}
      aria-labelledby="workbench-package-zone-heading"
      data-builder-package-compact
      data-builder-package-context
      data-builder-package-picker-open={pickerOpen ? "true" : undefined}
    >
      <div
        className="rounded-xl border border-slate-200/80 bg-white px-4 py-4 sm:px-5"
        data-builder-package-summary
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <h3
              id="workbench-package-zone-heading"
              className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900"
              data-builder-package-chooser-heading
            >
              {pickerOpen ? "Choose package" : "Package"}
            </h3>
            <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">
              {pickerOpen
                ? "Select the package for this proposal. You can adjust included work below."
                : "Review included work below, or change the package for this proposal."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {pickerOpen ? (
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50"
                data-builder-package-done
              >
                Done
              </button>
            ) : allowChangePackage ? (
              <ProposalBuilderPackageSelector
                graph={packageSelectorGraph}
                draftScoped={draftScopedPackagePicker}
                compact
                selectedOptionId={selectedOptionId}
                effectiveOptionId={effectiveOptionId}
                onSelectOption={onSelectOption}
                onPickerOpenChange={setPickerOpen}
              />
            ) : null}
            <button
              type="button"
              onClick={onOpenEditPackage}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              data-builder-edit-package
              title={WORKBENCH_EDIT_SCOPE_HINT}
              aria-label={`${WORKBENCH_EDIT_PACKAGE_TITLE}. ${WORKBENCH_EDIT_SCOPE_HINT}`}
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              {WORKBENCH_EDIT_PACKAGE_TITLE}
            </button>
          </div>
        </div>

        {pickerOpen ? (
          <div className="mt-4 w-full min-w-0" data-builder-package-picker-panel>
            <ProposalBuilderPackageSelector
              graph={packageSelectorGraph}
              draftScoped={draftScopedPackagePicker}
              compact
              forceOpen
              selectedOptionId={selectedOptionId}
              effectiveOptionId={effectiveOptionId}
              onSelectOption={onSelectOption}
              onPickerOpenChange={setPickerOpen}
            />
          </div>
        ) : (
          <div
            className="mt-4 rounded-lg border border-slate-200/70 bg-slate-50/50 px-4 py-3.5"
            data-builder-package-selected-summary
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Selected package
              </p>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700 ring-1 ring-blue-100">
                Current
              </span>
            </div>
            <p
              className="mt-1.5 text-[1.05rem] font-semibold tracking-[-0.015em] text-slate-950"
              data-builder-package-title
            >
              {packageTitle}
            </p>
            {packageZone.description ? (
              <p
                className="mt-1 text-[13px] leading-relaxed text-slate-600"
                data-builder-package-description
              >
                {packageZone.description}
              </p>
            ) : packageZone.startingPackageHelper ? (
              <p
                className="mt-1 text-[13px] leading-relaxed text-slate-600"
                data-builder-package-helper
              >
                {packageZone.startingPackageHelper}
              </p>
            ) : null}
            {packageZone.bullets.length > 0 ? (
              <ul
                className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5"
                data-builder-package-bullets
              >
                {packageZone.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700"
                  >
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/90 text-white">
                      <Check className="h-2 w-2" strokeWidth={3} aria-hidden />
                    </span>
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
            {!allowChangePackage ? (
              <p className="mt-2 text-[11.5px] text-slate-500" data-builder-only-one-package-note>
                This proposal has one package.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
