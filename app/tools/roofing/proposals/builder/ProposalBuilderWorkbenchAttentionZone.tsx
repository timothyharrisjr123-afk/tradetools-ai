import { AlertTriangle, ClipboardList } from "lucide-react";
import type { WorkbenchNeedsAttentionZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import { WORKBENCH_SCOPE_REVIEW_FUTURE_ACTIONS } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_ATTENTION_COUNT_BADGE,
  WORKBENCH_ATTENTION_ITEM,
  WORKBENCH_ATTENTION_ITEM_INDEX,
  WORKBENCH_ATTENTION_ZONE,
  WORKBENCH_ATTENTION_ZONE_HEADER,
  WORKBENCH_EDIT_OPTION_CHIP_ENABLED,
  WORKBENCH_EDIT_OPTION_CHIP_HINT,
  WORKBENCH_EDIT_OPTION_TITLE,
  WORKBENCH_EDIT_OPTION_TRIGGER_SECONDARY,
  WORKBENCH_FUTURE_ACTION_CHIP,
  WORKBENCH_REMOVE_FROM_OPTION_ACTION,
  WORKBENCH_MODULE_DESC,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_MODULE_KICKER,
  WORKBENCH_MODULE_TITLE,
  WORKBENCH_SCOPE_REVIEW_COUNT_BADGE,
  WORKBENCH_SCOPE_REVIEW_ITEM,
  WORKBENCH_SCOPE_REVIEW_ITEM_INDEX,
  WORKBENCH_SCOPE_REVIEW_ZONE,
  WORKBENCH_SCOPE_REVIEW_ZONE_HEADER,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";

type ProposalBuilderWorkbenchAttentionZoneProps = {
  zone: WorkbenchNeedsAttentionZone;
  onOpenEditOption: () => void;
  onSetQuantityForLine?: (templateItemId: string) => void;
  onRemoveFromOptionForLine?: (templateItemId: string) => void;
  manualQuantityEnabled?: boolean;
  excludeEnabled?: boolean;
};

function HardBlockersSection({ zone }: { zone: WorkbenchNeedsAttentionZone["hardBlockers"] }) {
  if (!zone.show) return null;

  return (
    <section className={WORKBENCH_ATTENTION_ZONE} aria-labelledby="workbench-hard-blockers-heading">
      <header className={WORKBENCH_ATTENTION_ZONE_HEADER}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className={WORKBENCH_MODULE_KICKER} id="workbench-hard-blockers-heading">
                {zone.title}
              </p>
              <p className={WORKBENCH_MODULE_TITLE}>Setup must be resolved</p>
              <p className={`${WORKBENCH_MODULE_DESC} text-amber-900/70`}>{zone.description}</p>
            </div>
          </div>
          <span className={WORKBENCH_ATTENTION_COUNT_BADGE}>{zone.count}</span>
        </div>
      </header>

      <div className={`${WORKBENCH_MODULE_INNER} space-y-2`}>
        <ul className="space-y-2">
          {zone.lines.map((line, index) => (
            <li key={line.templateItemId} className={WORKBENCH_ATTENTION_ITEM}>
              <div className="flex gap-3">
                <span className={WORKBENCH_ATTENTION_ITEM_INDEX} aria-hidden>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <ProposalBuilderWorkbenchLineRow variant="hard_blocker" line={line} compact />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ScopeReviewSection({
  zone,
  onOpenEditOption,
  onSetQuantityForLine,
  manualQuantityEnabled = false,
  onRemoveFromOptionForLine,
  excludeEnabled = false,
}: {
  zone: WorkbenchNeedsAttentionZone["scopeReview"];
  onOpenEditOption: () => void;
  onSetQuantityForLine?: (templateItemId: string) => void;
  manualQuantityEnabled?: boolean;
  onRemoveFromOptionForLine?: (templateItemId: string) => void;
  excludeEnabled?: boolean;
}) {
  if (!zone.show) return null;

  return (
    <section className={WORKBENCH_SCOPE_REVIEW_ZONE} aria-labelledby="workbench-scope-review-heading">
      <header className={WORKBENCH_SCOPE_REVIEW_ZONE_HEADER}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <div>
              <p className={WORKBENCH_MODULE_KICKER} id="workbench-scope-review-heading">
                {zone.title}
              </p>
              <p className={WORKBENCH_MODULE_TITLE}>Review quantity</p>
              <p className={WORKBENCH_MODULE_DESC}>
                {zone.count === 1
                  ? "1 template item needs review before totals are final."
                  : `${zone.count} template items need review before totals are final.`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenEditOption}
              className={WORKBENCH_EDIT_OPTION_TRIGGER_SECONDARY}
              title="Open Edit option — set manual quantity for scope review lines"
            >
              {WORKBENCH_EDIT_OPTION_TITLE}
            </button>
            <span className={WORKBENCH_SCOPE_REVIEW_COUNT_BADGE}>{zone.count}</span>
          </div>
        </div>
      </header>

      <div className={`${WORKBENCH_MODULE_INNER} space-y-2`}>
        <ul className="space-y-2">
          {zone.lines.map((line, index) => (
            <li key={line.templateItemId} className={WORKBENCH_SCOPE_REVIEW_ITEM}>
              <div className="flex gap-3">
                <span className={WORKBENCH_SCOPE_REVIEW_ITEM_INDEX} aria-hidden>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <ProposalBuilderWorkbenchLineRow variant="scope_review" line={line} compact />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {WORKBENCH_SCOPE_REVIEW_FUTURE_ACTIONS.map((action) => {
                      const isSetQuantity = action.id === "set_quantity";
                      const isRemove = action.id === "remove";
                      const canSetQuantity =
                        isSetQuantity &&
                        manualQuantityEnabled &&
                        line.reasons.includes("needs_quantity") &&
                        Boolean(onSetQuantityForLine);
                      const canRemove =
                        isRemove && excludeEnabled && Boolean(onRemoveFromOptionForLine);

                      if (canSetQuantity) {
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

                      if (canRemove) {
                        return (
                          <button
                            key={action.id}
                            type="button"
                            className={WORKBENCH_EDIT_OPTION_CHIP_ENABLED}
                            onClick={() => onRemoveFromOptionForLine!(line.templateItemId)}
                          >
                            {WORKBENCH_REMOVE_FROM_OPTION_ACTION}
                          </button>
                        );
                      }

                      return (
                        <button
                          key={action.id}
                          type="button"
                          disabled
                          aria-disabled="true"
                          className={WORKBENCH_FUTURE_ACTION_CHIP}
                          title={
                            isSetQuantity && manualQuantityEnabled
                              ? WORKBENCH_EDIT_OPTION_CHIP_HINT
                              : "Coming soon — not enabled in this phase"
                          }
                        >
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function ProposalBuilderWorkbenchAttentionZone({
  zone,
  onOpenEditOption,
  onSetQuantityForLine,
  manualQuantityEnabled = false,
  onRemoveFromOptionForLine,
  excludeEnabled = false,
}: ProposalBuilderWorkbenchAttentionZoneProps) {
  if (!zone.show) return null;

  return (
    <div className="space-y-4">
      <HardBlockersSection zone={zone.hardBlockers} />
      <ScopeReviewSection
        zone={zone.scopeReview}
        onOpenEditOption={onOpenEditOption}
        onSetQuantityForLine={onSetQuantityForLine}
        manualQuantityEnabled={manualQuantityEnabled}
        onRemoveFromOptionForLine={onRemoveFromOptionForLine}
        excludeEnabled={excludeEnabled}
      />
    </div>
  );
}
