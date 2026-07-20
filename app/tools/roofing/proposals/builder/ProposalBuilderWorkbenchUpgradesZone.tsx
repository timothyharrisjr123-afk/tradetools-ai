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
};

/**
 * Optional upgrades — collapsed by default; quiet follow-up copy.
 * Include/replace is not supported by current scope decisions
 * (manual_quantity | excluded | visibility_override only) — no fake Add buttons.
 *
 * Follow-up (document only): additive upgrades should add to the included
 * estimate; replacement upgrades should replace equivalent base items.
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
}: ProposalBuilderWorkbenchUpgradesZoneProps) {
  if (!zone.show) return null;

  const lines = zone.sections.flatMap((section) => section.lines);
  const availableCount = lines.length;

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
              {availableCount} available
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
          <p
            className="mb-2 text-[12px] leading-snug text-slate-500"
            data-builder-upgrade-selection-follow-up
          >
            Upgrade selection will be handled in a later proposal editing pass.
          </p>
          <ul>
            {lines.map((line) => {
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
                    <ProposalBuilderWorkbenchLineRow
                      variant="scope"
                      line={line}
                      as="div"
                      hideDetails
                      hideAttentionBadges
                      onEditQuantity={quantityAction?.onEdit}
                      editQuantityLabel={quantityAction?.label}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </details>
    </section>
  );
}
