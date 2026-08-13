"use client";

import {
  isUpgradeLineScopeReviewEligible,
  type WorkbenchScopeLine,
  type WorkbenchUpgradesZone,
} from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_EDIT_QUANTITY_ACTION,
  WORKBENCH_MODULE_COMPACT,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_SET_QUANTITY_ACTION,
  WORKBENCH_UPGRADES_EMPTY,
  WORKBENCH_UPGRADES_ZONE,
  WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchInlineQuantityEditor from "./ProposalBuilderWorkbenchInlineQuantityEditor";

type ProposalBuilderWorkbenchUpgradesZoneProps = {
  zone: WorkbenchUpgradesZone;
  editingQuantityLineId?: string | null;
  onStartSetQuantity?: (templateItemId: string) => void;
  onCancelSetQuantity?: () => void;
  onSaveQuantity?: (
    templateItemId: string,
    quantity: string,
    quantityDisplayLabel?: string | null
  ) => Promise<void>;
  onClearManualQuantity?: (templateItemId: string) => Promise<void>;
  quantitySaveInFlight?: boolean;
  quantitySaveError?: string | null;
  manualQuantityEnabled?: boolean;
  onSetUpgradeSelected?: (
    templateItemId: string,
    selected: boolean
  ) => Promise<void>;
  selectionInFlight?: boolean;
  selectionError?: string | null;
};

function flattenUpgradeLines(zone: WorkbenchUpgradesZone): WorkbenchScopeLine[] {
  return zone.sections.flatMap((section) => section.lines);
}

function parseQtyDraft(qtyLabel: string): string {
  const match = qtyLabel.trim().match(/^(\d+(?:\.\d+)?)/);
  return match?.[1] ?? "";
}

function isAuthoritativePrice(label: string): boolean {
  return label.trim().startsWith("$");
}

function selectedCountLabel(count: number): string {
  return count === 1 ? "1 selected" : `${count} selected`;
}

/**
 * Optional upgrades — job-specific include/exclude of template-owned options.
 * Quantity editing belongs on the affected upgrade, not the estimate table.
 */
export default function ProposalBuilderWorkbenchUpgradesZone({
  zone,
  editingQuantityLineId = null,
  onStartSetQuantity,
  onCancelSetQuantity,
  onSaveQuantity,
  onClearManualQuantity,
  quantitySaveInFlight = false,
  quantitySaveError = null,
  manualQuantityEnabled = false,
  onSetUpgradeSelected,
  selectionInFlight = false,
  selectionError = null,
}: ProposalBuilderWorkbenchUpgradesZoneProps) {
  if (!zone.show) return null;

  if (zone.isEmpty) {
    return (
      <section
        className={WORKBENCH_MODULE_COMPACT}
        aria-labelledby="workbench-upgrades-heading"
        data-builder-optional-upgrades
      >
        <div className={`${WORKBENCH_MODULE_INNER} space-y-2`}>
          <p
            className="text-sm font-semibold text-slate-900"
            id="workbench-upgrades-heading"
          >
            Optional upgrades
          </p>
          <p className={WORKBENCH_UPGRADES_EMPTY}>
            <span>{zone.emptyCopy}</span>
          </p>
        </div>
      </section>
    );
  }

  const lines = flattenUpgradeLines(zone);

  return (
    <section
      className={WORKBENCH_UPGRADES_ZONE}
      aria-labelledby="workbench-upgrades-heading"
      data-builder-optional-upgrades
    >
      <div className="flex items-baseline justify-between gap-3 px-5 py-3 sm:px-6">
        <p
          className="text-sm font-semibold text-slate-900"
          id="workbench-upgrades-heading"
        >
          Optional upgrades
        </p>
        <p className="shrink-0 text-[12.5px] font-medium tabular-nums text-slate-500">
          {selectedCountLabel(zone.selectedCount)}
        </p>
      </div>

      {selectionError ? (
        <p className="px-5 pb-2 text-[12px] font-medium text-red-700 sm:px-6" role="alert">
          {selectionError}
        </p>
      ) : null}

      <ul className="border-t border-slate-100">
        {lines.map((line) => {
          const selected = line.upgradeSelectionState === "selected";
          const needsQuantity = isUpgradeLineScopeReviewEligible(line);
          const quantityIssue = selected && needsQuantity;
          const canEditQuantity =
            selected &&
            manualQuantityEnabled &&
            Boolean(onStartSetQuantity) &&
            Boolean(onSaveQuantity);
          const isEditing = editingQuantityLineId === line.templateItemId;
          const quantityActionLabel = needsQuantity
            ? WORKBENCH_SET_QUANTITY_ACTION
            : WORKBENCH_EDIT_QUANTITY_ACTION;
          const priceLabel = isAuthoritativePrice(line.amountLabel)
            ? selected
              ? line.amountLabel
              : `+${line.amountLabel}`
            : null;

          return (
            <li
              key={line.templateItemId}
              className={`border-b border-slate-100 last:border-b-0 ${
                selected ? "bg-slate-50/70" : "bg-white"
              }`}
              data-builder-upgrade-row
              data-builder-upgrade-selected={selected ? "true" : "false"}
              data-builder-upgrade-quantity-issue={quantityIssue ? "true" : undefined}
            >
              {isEditing ? (
                <div className="px-5 py-3 sm:px-6">
                  <ProposalBuilderWorkbenchInlineQuantityEditor
                    line={{
                      templateItemId: line.templateItemId,
                      name: line.name,
                      unitLabel: line.detailMeta.unit?.trim() || null,
                    }}
                    initialQuantity={parseQtyDraft(line.qtyLabel)}
                    inFlight={quantitySaveInFlight}
                    error={quantitySaveError}
                    onCancel={() => onCancelSetQuantity?.()}
                    onSave={onSaveQuantity!}
                    onUseMeasuredQuantity={
                      line.manualQuantityActive && onClearManualQuantity
                        ? () => onClearManualQuantity(line.templateItemId)
                        : undefined
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 px-5 py-3 sm:px-6">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium leading-snug text-slate-900">
                      {line.name}
                    </p>
                    {line.description ? (
                      <p className="mt-0.5 text-[12.5px] leading-snug text-slate-600">
                        {line.description}
                      </p>
                    ) : null}
                    {line.upgradeEffect === "replacement" ? (
                      <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                        Replaces {line.replacesLineName ?? "included item"} when selected.
                      </p>
                    ) : null}
                    <div className="mt-1.5 space-y-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span
                          className={`text-[12px] font-medium ${
                            selected ? "text-slate-700" : "text-slate-500"
                          }`}
                        >
                          {selected ? "Selected" : "Not selected"}
                        </span>
                        {quantityIssue ? (
                          <span
                            className="text-[12px] font-semibold text-amber-800"
                            data-builder-upgrade-needs-quantity
                          >
                            Needs quantity
                          </span>
                        ) : null}
                      </p>
                      {selected || priceLabel ? (
                        <p className="flex items-baseline justify-between gap-3">
                          {selected ? (
                            <span className="text-[12.5px] tabular-nums text-slate-600">
                              Qty {quantityIssue ? "Not resolved" : line.qtyLabel}
                            </span>
                          ) : (
                            <span />
                          )}
                          {priceLabel ? (
                            <span className="text-[13px] font-semibold tabular-nums text-slate-900">
                              {priceLabel}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                    {canEditQuantity ? (
                      <button
                        type="button"
                        className="mt-2 inline-flex min-h-[44px] items-center text-[12.5px] font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:min-h-0 sm:h-8"
                        onClick={() => onStartSetQuantity!(line.templateItemId)}
                        aria-label={`${quantityActionLabel} for ${line.name}`}
                        data-builder-upgrade-qty-edit-trigger
                        data-builder-edit-quantity
                      >
                        {quantityActionLabel}
                      </button>
                    ) : null}
                    {line.manualQuantityActive &&
                    canEditQuantity &&
                    onClearManualQuantity &&
                    !needsQuantity ? (
                      <button
                        type="button"
                        className="ml-3 mt-2 inline-flex min-h-[44px] items-center text-[12px] font-medium text-slate-600 hover:text-slate-900 sm:min-h-0"
                        onClick={() => void onClearManualQuantity(line.templateItemId)}
                        aria-label={`${WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL} for ${line.name}`}
                        data-builder-use-measured-quantity
                      >
                        {WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL}
                      </button>
                    ) : null}
                  </div>
                  {onSetUpgradeSelected ? (
                    <label className="flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-start justify-end pt-0.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed"
                        checked={selected}
                        disabled={selectionInFlight}
                        onChange={() =>
                          void onSetUpgradeSelected(
                            line.templateItemId,
                            !selected
                          ).catch(() => undefined)
                        }
                        aria-label={
                          selected
                            ? `Remove ${line.name} from proposal`
                            : `Add ${line.name} to proposal`
                        }
                        data-builder-upgrade-selection-action
                      />
                    </label>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
