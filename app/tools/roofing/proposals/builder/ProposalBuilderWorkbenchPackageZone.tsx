"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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
  /** Advanced scope drawer — omitted when ordinary row editing is canonical. */
  onOpenEditPackage?: () => void;
  /** Customer total from existing estimate presenter truth. */
  packageTotalLabel?: string | null;
};

function subscribeMinWidthSm(onStoreChange: () => void) {
  const media = window.matchMedia("(min-width: 640px)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function useMinWidthSm() {
  return useSyncExternalStore(
    subscribeMinWidthSm,
    () => window.matchMedia("(min-width: 640px)").matches,
    () => true
  );
}

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
  const isDesktop = useMinWidthSm();
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

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>("[data-builder-change-package]")
        ?.focus();
    });
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closePicker();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closePicker, pickerOpen]);

  return (
    <section
      className={`${WORKBENCH_PACKAGE_MODULE} overflow-visible`}
      aria-labelledby="workbench-package-zone-heading"
      data-builder-package-compact
      data-builder-package-context
      data-builder-package-picker-open={pickerOpen ? "true" : undefined}
    >
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
            {allowChangePackage && !pickerOpen ? (
              <ProposalBuilderPackageSelector
                graph={packageSelectorGraph}
                draftScoped={draftScopedPackagePicker}
                compact
                selectedOptionId={selectedOptionId}
                effectiveOptionId={effectiveOptionId}
                onSelectOption={onSelectOption}
                onPickerOpenChange={setPickerOpen}
                selectedPackageTotalLabel={totalLabel || null}
              />
            ) : null}
            {allowChangePackage && pickerOpen ? (
              <button
                type="button"
                onClick={closePicker}
                className="hidden min-h-[44px] items-center rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
                data-builder-package-done
              >
                Cancel
              </button>
            ) : null}
            {onOpenEditPackage ? (
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
            ) : null}
          </div>
        </div>
      </div>

      {pickerOpen && allowChangePackage ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/25 sm:hidden"
            aria-label="Close package list"
            data-builder-package-sheet-backdrop
            onClick={closePicker}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[min(85vh,36rem)] overflow-y-auto rounded-t-xl border border-slate-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] sm:static sm:z-auto sm:max-h-none sm:overflow-visible sm:rounded-none sm:border-0 sm:border-b sm:border-slate-200/80 sm:px-0 sm:pb-3 sm:pt-0 sm:shadow-none"
            role={isDesktop ? "region" : "dialog"}
            aria-modal={isDesktop ? undefined : true}
            aria-labelledby="builder-change-package-heading"
            data-builder-package-picker-panel
            data-builder-package-sheet
          >
            <div className="mb-2 flex items-center justify-between gap-3 sm:sr-only">
              <h3
                id="builder-change-package-heading"
                className="text-[15px] font-semibold text-slate-950"
              >
                Change package
              </h3>
              <button
                type="button"
                onClick={closePicker}
                className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                data-builder-package-sheet-cancel
              >
                Cancel
              </button>
            </div>
            <p className="mb-1 hidden text-[12.5px] font-medium text-slate-500 sm:block">
              Change package
            </p>
            <ProposalBuilderPackageSelector
              graph={packageSelectorGraph}
              draftScoped={draftScopedPackagePicker}
              compact
              forceOpen
              selectedOptionId={selectedOptionId}
              effectiveOptionId={effectiveOptionId}
              selectedPackageTotalLabel={totalLabel || null}
              onSelectOption={onSelectOption}
              onPickerOpenChange={(open) => {
                if (!open) closePicker();
                else setPickerOpen(true);
              }}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
