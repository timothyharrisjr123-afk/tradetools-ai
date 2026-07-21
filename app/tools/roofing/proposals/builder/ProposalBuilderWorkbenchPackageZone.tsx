"use client";

import { useState } from "react";
import { Check, Settings2 } from "lucide-react";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { WorkbenchPackageZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
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
        className="relative overflow-hidden rounded-2xl border border-blue-200/70 bg-[linear-gradient(135deg,#f4f8ff_0%,#ffffff_58%,#f6f9fe_100%)] px-5 py-5 shadow-[0_10px_28px_-20px_rgba(37,99,235,0.35)] sm:px-6"
        data-builder-package-summary
      >
        <span className="absolute inset-y-4 left-0 w-[3px] rounded-r-full bg-blue-600" aria-hidden />
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8">
          <div className="min-w-0 pl-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">
                Selected package
              </p>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-blue-700">
                Current
              </span>
            </div>
            <p
              className="mt-2 text-[1.35rem] font-semibold tracking-[-0.02em] text-slate-950"
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
            {packageZone.bullets.length > 0 ? (
              <ul
                className="mt-3 flex flex-wrap gap-x-4 gap-y-2"
                data-builder-package-bullets
              >
                {packageZone.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                    </span>
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
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
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 text-[12.5px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              data-builder-edit-package
              title={WORKBENCH_EDIT_SCOPE_HINT}
              aria-label={`${WORKBENCH_EDIT_PACKAGE_TITLE}. ${WORKBENCH_EDIT_SCOPE_HINT}`}
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              {WORKBENCH_EDIT_PACKAGE_TITLE}
            </button>
          </div>
        </div>
        <p className="mt-4 border-t border-blue-100/80 pt-3 text-[11.5px] leading-snug text-slate-500">
          <span className="font-medium text-slate-600">Change package</span> switches options.
          {" "}Use <span className="font-medium text-slate-600">Edit qty</span> for one line, or{" "}
          <span className="font-medium text-slate-600">Edit scope</span> to review all package quantity changes.
        </p>
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
