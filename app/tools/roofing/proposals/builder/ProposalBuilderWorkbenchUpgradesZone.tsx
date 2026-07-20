import { Info, Sparkles } from "lucide-react";
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
  WORKBENCH_HINT_STRIP,
  WORKBENCH_MODULE_COMPACT,
  WORKBENCH_MODULE_DESC,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_MODULE_KICKER,
  WORKBENCH_MODULE_TITLE,
  WORKBENCH_REMOVE_FROM_OPTION_ACTION,
  WORKBENCH_SCOPE_COUNT_CHIP,
  WORKBENCH_SCOPE_SECTION,
  WORKBENCH_SCOPE_SECTION_TITLE,
  WORKBENCH_UPGRADES_EMPTY,
  WORKBENCH_UPGRADES_ZONE,
  WORKBENCH_ZONE_HEADER,
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

  const lineCount = zone.sections.reduce((sum, section) => sum + section.lines.length, 0);

  if (zone.isEmpty) {
    return (
      <section
        className={WORKBENCH_MODULE_COMPACT}
        aria-labelledby="workbench-upgrades-heading"
      >
        <div className={`${WORKBENCH_MODULE_INNER} space-y-2`}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <p
              className="text-[12px] font-semibold text-slate-700"
              id="workbench-upgrades-heading"
            >
              Optional upgrades
            </p>
          </div>
          <p className={WORKBENCH_UPGRADES_EMPTY}>
            <span>{zone.emptyCopy}</span>
          </p>
          {zone.customerSelectionHint ? (
            <p className={WORKBENCH_HINT_STRIP}>
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <span>{zone.customerSelectionHint}</span>
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className={WORKBENCH_UPGRADES_ZONE} aria-labelledby="workbench-upgrades-heading">
      <header className={WORKBENCH_ZONE_HEADER}>
        <div className="flex min-w-0 items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
          <div>
            <p className={WORKBENCH_MODULE_KICKER} id="workbench-upgrades-heading">
              Optional upgrades
            </p>
            <p className={WORKBENCH_MODULE_TITLE}>Available for this proposal</p>
            <p className={WORKBENCH_MODULE_DESC}>
              These can be reviewed before previewing.
            </p>
          </div>
        </div>
        <span className={WORKBENCH_SCOPE_COUNT_CHIP}>{lineCount}</span>
      </header>

      <div className={`${WORKBENCH_MODULE_INNER} space-y-3`}>
        {zone.sections.map((section) =>
          section.lines.length > 0 ? (
            <div key={section.sectionId} className={WORKBENCH_SCOPE_SECTION}>
              <div className={WORKBENCH_SCOPE_SECTION_TITLE}>
                <span>{section.title}</span>
                <span className={WORKBENCH_SCOPE_COUNT_CHIP}>{section.lines.length}</span>
              </div>
              <ul className="mt-1.5">
                {section.lines.map((line) => {
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
                    <li key={line.templateItemId} className="space-y-2">
                      <ProposalBuilderWorkbenchLineRow
                        variant="scope"
                        line={line}
                        as="div"
                      />
                      {showActionRow ? (
                        <div className="flex flex-wrap gap-1.5 pl-0.5">
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
                                  onClick={() => onRemoveFromOptionForLine!(line.templateItemId)}
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
          ) : null
        )}

        {zone.customerSelectionHint ? (
          <p className={WORKBENCH_HINT_STRIP}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span>{zone.customerSelectionHint}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
