"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
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
  /** Customer total from existing estimate presenter truth. */
  packageTotalLabel?: string | null;
};

export default function ProposalBuilderWorkbenchPackageZone({
  packageZone,
  packageSelectorGraph,
  draftScopedPackagePicker = false,
  selectedOptionId,
  effectiveOptionId,
  onSelectOption,
  onOpenEditPackage,
  packageTotalLabel = null,
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
  const totalLabel = (packageTotalLabel ?? "").trim();
  const highlights = packageZone.bullets.filter((bullet) => bullet.trim().length > 0);

  return (
    <section
      className={`${WORKBENCH_PACKAGE_MODULE} overflow-visible`}
      aria-labelledby="workbench-package-zone-heading"
      data-builder-package-compact
      data-builder-package-context
      data-builder-package-picker-open={pickerOpen ? "true" : undefined}
    >
      {pickerOpen ? (
        <div
          className="border-b border-slate-200/80 pb-4"
          data-builder-package-summary
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                id="workbench-package-zone-heading"
                className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900"
                data-builder-package-chooser-heading
              >
                Choose package
              </h3>
              <p className="mt-0.5 text-[12.5px] leading-snug text-slate-500">
                Select the package for this proposal. You can adjust included work below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
              data-builder-package-done
            >
              Done
            </button>
          </div>
          <div className="mt-3 w-full min-w-0" data-builder-package-picker-panel>
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
        </div>
      ) : (
        <div
          className="flex flex-col gap-3 border-b border-slate-200/80 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
          data-builder-package-summary
          data-builder-package-selected-summary
        >
          <div className="min-w-0 flex-1">
            <h3
              id="workbench-package-zone-heading"
              className="text-[15px] font-semibold tracking-[-0.015em] text-slate-950"
              data-builder-package-chooser-heading
              data-builder-package-title
            >
              {packageTitle}
            </h3>
            {packageZone.description ? (
              <p
                className="mt-0.5 text-[13px] leading-snug text-slate-600"
                data-builder-package-description
              >
                {packageZone.description}
              </p>
            ) : packageZone.startingPackageHelper ? (
              <p
                className="mt-0.5 text-[13px] leading-snug text-slate-600"
                data-builder-package-helper
              >
                {packageZone.startingPackageHelper}
              </p>
            ) : null}
            {highlights.length > 0 ? (
              <p
                className="mt-1 text-[12.5px] leading-snug text-slate-500"
                data-builder-package-bullets
              >
                {highlights.join(" · ")}
              </p>
            ) : null}
            {!allowChangePackage ? (
              <p className="mt-1 text-[11.5px] text-slate-500" data-builder-only-one-package-note>
                This proposal has one package.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {totalLabel ? (
              <p
                className="tabular-nums text-[15px] font-semibold text-slate-950"
                data-builder-package-total
              >
                {totalLabel}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {allowChangePackage ? (
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
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                data-builder-edit-package
                title={WORKBENCH_EDIT_SCOPE_HINT}
                aria-label={`${WORKBENCH_EDIT_PACKAGE_TITLE}. ${WORKBENCH_EDIT_SCOPE_HINT}`}
              >
                <Settings2 className="h-3.5 w-3.5" aria-hidden />
                {WORKBENCH_EDIT_PACKAGE_TITLE}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
