import { Sparkles } from "lucide-react";
import {
  isUpgradeLineExcludeEligible,
  isUpgradeLineScopeReviewEligible,
  WORKBENCH_SCOPE_REVIEW_FUTURE_ACTIONS,
  type WorkbenchUpgradesZone,
} from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_EDIT_OPTION_CHIP_ENABLED,
  WORKBENCH_EDIT_OPTION_CHIP_HINT,
  WORKBENCH_EDIT_OPTION_CHIP_SECONDARY,
  WORKBENCH_EDIT_QUANTITY_ACTION,
  WORKBENCH_FUTURE_ACTION_CHIP,
  WORKBENCH_MODULE_COMPACT,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_REMOVE_FROM_OPTION_ACTION,
  WORKBENCH_UPGRADES_EMPTY,
  WORKBENCH_UPGRADES_ZONE,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";

type ProposalBuilderWorkbenchUpgradesZoneProps = {
  zone: WorkbenchUpgradesZone;
  onSetQuantityForLine?: (templateItemId: string) => void;
  onEditQuantityForLine?: (templateItemId: string) => void;
  onRemoveFromOptionForLine?: (templateItemId: string) => void;
  manualQuantityEnabled?: boolean;
  excludeEnabled?: boolean;
};

export default function ProposalBuilderWorkbenchUpgradesZone({
  zone,
  onSetQuantityForLine,
  onEditQuantityForLine,
  onRemoveFromOptionForLine,
  manualQuantityEnabled = false,
  excludeEnabled = false,
}: ProposalBuilderWorkbenchUpgradesZoneProps) {
  if (!zone.show) return null;

  const lines = zone.sections.flatMap((section) => section.lines);

  if (zone.isEmpty) {
    return (
      <section
        className={WORKBENCH_MODULE_COMPACT}
        aria-labelledby="workbench-upgrades-heading"
        data-builder-optional-upgrades
      >
        <div className={`${WORKBENCH_MODULE_INNER} space-y-2`}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <p
              className="text-sm font-semibold text-slate-900"
              id="workbench-upgrades-heading"
            >
              Optional upgrades
            </p>
          </div>
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
      <header className="py-2">
        <p
          className="text-sm font-semibold text-slate-900"
          id="workbench-upgrades-heading"
        >
          Optional upgrades
        </p>
        <p className="mt-0.5 text-[13px] text-slate-600">
          Available for this proposal.
        </p>
      </header>

      <div className={WORKBENCH_MODULE_INNER}>
        <ul>
          {lines.map((line) => {
            const canSetQuantity =
              manualQuantityEnabled &&
              isUpgradeLineScopeReviewEligible(line) &&
              Boolean(onSetQuantityForLine);
            const canEditQuantity =
              line.manualQuantityActive && Boolean(onEditQuantityForLine);
            const canRemove =
              excludeEnabled &&
              isUpgradeLineExcludeEligible(line) &&
              Boolean(onRemoveFromOptionForLine);
            const showActionRow =
              canSetQuantity ||
              canEditQuantity ||
              (canRemove && line.attentionReasons.length > 0);

            return (
              <li key={line.templateItemId} className="space-y-1">
                <ProposalBuilderWorkbenchLineRow
                  variant="scope"
                  line={line}
                  as="div"
                  hideDetails
                />
                {showActionRow ? (
                  <div className="flex flex-wrap gap-1.5 pb-1.5">
                    {WORKBENCH_SCOPE_REVIEW_FUTURE_ACTIONS.map((action) => {
                      const isSetQuantity = action.id === "set_quantity";
                      const isRemove = action.id === "remove";

                      if (isSetQuantity && canSetQuantity) {
                        return (
                          <button
                            key={action.id}
                            type="button"
                            className={WORKBENCH_EDIT_OPTION_CHIP_ENABLED}
                            onClick={() => onSetQuantityForLine!(line.templateItemId)}
                          >
                            {action.label}
                          </button>
                        );
                      }

                      if (isRemove && canRemove) {
                        return (
                          <button
                            key={action.id}
                            type="button"
                            className={WORKBENCH_EDIT_OPTION_CHIP_SECONDARY}
                            onClick={() =>
                              onRemoveFromOptionForLine!(line.templateItemId)
                            }
                          >
                            {WORKBENCH_REMOVE_FROM_OPTION_ACTION}
                          </button>
                        );
                      }

                      if (isSetQuantity && manualQuantityEnabled) {
                        return (
                          <button
                            key={action.id}
                            type="button"
                            disabled
                            aria-disabled="true"
                            className={WORKBENCH_FUTURE_ACTION_CHIP}
                            title={WORKBENCH_EDIT_OPTION_CHIP_HINT}
                          >
                            {action.label}
                          </button>
                        );
                      }

                      return null;
                    })}
                    {canEditQuantity ? (
                      <button
                        type="button"
                        className={WORKBENCH_EDIT_OPTION_CHIP_ENABLED}
                        onClick={() => onEditQuantityForLine!(line.templateItemId)}
                      >
                        {WORKBENCH_EDIT_QUANTITY_ACTION}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
