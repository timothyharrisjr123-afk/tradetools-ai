"use client";

import {
  isUpgradeLineScopeReviewEligible,
  type WorkbenchUpgradesZone,
} from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_EDIT_QUANTITY_ACTION,
  WORKBENCH_MODULE_COMPACT,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_SET_QUANTITY_ACTION,
  WORKBENCH_UPGRADES_EMPTY,
  WORKBENCH_UPGRADES_ZONE,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";
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

/**
 * Optional upgrades — additive selection chrome for both additive and
 * replacement effects. Replacement behavior is explained quietly per row.
 */
export default function ProposalBuilderWorkbenchUpgradesZone({
  zone,
  editingQuantityLineId = null,
  onStartSetQuantity,
  onCancelSetQuantity,
  onSaveQuantity,
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

  return (
    <section
      className={WORKBENCH_UPGRADES_ZONE}
      aria-labelledby="workbench-upgrades-heading"
      data-builder-optional-upgrades
    >
      <details className="group" data-builder-optional-upgrades-collapsed>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <p
              className="text-sm font-semibold text-slate-900"
              id="workbench-upgrades-heading"
            >
              Optional upgrades
            </p>
            <p className="mt-0.5 text-[13px] text-slate-600">
              {zone.selectedCount > 0 ? `${zone.selectedCount} selected · ` : ""}
              {zone.availableCount} available
            </p>
          </div>
          <span className="shrink-0 text-[12px] font-medium text-blue-700 group-open:hidden">
            Review
          </span>
          <span className="hidden shrink-0 text-[12px] font-medium text-slate-500 group-open:inline">
            Hide
          </span>
        </summary>

        <div className={WORKBENCH_MODULE_INNER}>
          {selectionError ? (
            <p className="mb-3 text-[12px] font-medium text-red-700" role="alert">
              {selectionError}
            </p>
          ) : null}
          {[
            { title: "Selected upgrades", sections: zone.selectedSections, selected: true },
            { title: "Available upgrades", sections: zone.availableSections, selected: false },
          ].map((group) =>
            group.sections.length > 0 ? (
              <div key={group.title} className="mb-4 last:mb-0">
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                  {group.title}
                </p>
                <ul>
                  {group.sections.flatMap((section) => section.lines).map((line) => {
              const needsQuantity = isUpgradeLineScopeReviewEligible(line);
              const canSetQuantity =
                manualQuantityEnabled &&
                needsQuantity &&
                Boolean(onStartSetQuantity) &&
                Boolean(onSaveQuantity);
              const canEditQuantity =
                manualQuantityEnabled &&
                line.manualQuantityActive &&
                Boolean(onStartSetQuantity) &&
                Boolean(onSaveQuantity);
              const isEditing = editingQuantityLineId === line.templateItemId;
              const quantityAction =
                canSetQuantity
                  ? {
                      label: WORKBENCH_SET_QUANTITY_ACTION as typeof WORKBENCH_SET_QUANTITY_ACTION,
                      onEdit: () => onStartSetQuantity!(line.templateItemId),
                    }
                  : canEditQuantity
                    ? {
                        label: WORKBENCH_EDIT_QUANTITY_ACTION as typeof WORKBENCH_EDIT_QUANTITY_ACTION,
                        onEdit: () => onStartSetQuantity!(line.templateItemId),
                      }
                    : null;

              return (
                <li key={line.templateItemId} className="space-y-1 py-1">
                  {isEditing ? (
                    <ProposalBuilderWorkbenchInlineQuantityEditor
                      line={{
                        templateItemId: line.templateItemId,
                        name: line.name,
                        unitLabel: line.detailMeta.unit?.trim() || null,
                      }}
                      inFlight={quantitySaveInFlight}
                      error={quantitySaveError}
                      onCancel={() => onCancelSetQuantity?.()}
                      onSave={onSaveQuantity!}
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <ProposalBuilderWorkbenchLineRow
                          variant="scope"
                          line={line}
                          as="div"
                          hideDetails
                          hideAttentionBadges
                          onEditQuantity={quantityAction?.onEdit}
                          editQuantityLabel={quantityAction?.label}
                        />
                        {line.upgradeEffect === "replacement" ? (
                          <p className="px-3 pb-1 text-[11.5px] text-slate-500">
                            Replaces {line.replacesLineName ?? "included item"} when selected.
                          </p>
                        ) : null}
                      </div>
                      {onSetUpgradeSelected ? (
                        <button
                          type="button"
                          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={selectionInFlight}
                          onClick={() =>
                            void onSetUpgradeSelected(
                              line.templateItemId,
                              !group.selected
                            ).catch(() => undefined)
                          }
                          data-builder-upgrade-selection-action
                        >
                          {group.selected ? "Remove" : "Add to proposal"}
                        </button>
                      ) : null}
                    </div>
                  )}
                </li>
              );
                  })}
                </ul>
              </div>
            ) : null
          )}
        </div>
      </details>
    </section>
  );
}
