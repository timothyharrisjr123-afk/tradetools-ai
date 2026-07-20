"use client";

import { useState } from "react";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { WorkbenchPackageZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import ProposalBuilderPackageSelector from "./ProposalBuilderPackageSelector";
import {
  WORKBENCH_EDIT_PACKAGE_TITLE,
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
  const packageTitle = packageZone.label
    ? `${packageZone.label} package`
    : "Package";
  const bulletsLine =
    packageZone.bullets.length > 0 ? packageZone.bullets.join(" · ") : null;

  return (
    <section
      className={`${WORKBENCH_PACKAGE_MODULE} overflow-visible py-4`}
      aria-labelledby="workbench-package-zone-heading"
      data-builder-package-compact
      data-builder-package-context
      data-builder-package-picker-open={pickerOpen ? "true" : undefined}
    >
      <div
        className="rounded-lg border border-slate-200/90 bg-slate-50/60 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        data-builder-package-summary
      >
        <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
          <div className="min-w-0 max-w-2xl flex-1">
            <p
              className="text-base font-semibold tracking-tight text-slate-950"
              id="workbench-package-zone-heading"
              data-builder-package-title
            >
              {packageTitle}
            </p>
            {packageZone.description ? (
              <p
                className="mt-1 text-[14px] leading-relaxed text-slate-600"
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
            {bulletsLine ? (
              <p
                className="mt-1.5 text-[13px] leading-relaxed text-slate-500"
                data-builder-package-bullets
              >
                {bulletsLine}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3 self-center">
            {!pickerOpen ? (
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
              className="text-[13px] font-medium text-slate-500 hover:text-slate-700"
              data-builder-edit-package
              title="Advanced package settings for this proposal"
            >
              {WORKBENCH_EDIT_PACKAGE_TITLE}
            </button>
          </div>
        </div>
      </div>

      {pickerOpen ? (
        <div className="mt-3 w-full min-w-0 overflow-visible" data-builder-package-picker-panel>
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
      ) : null}
    </section>
  );
}
