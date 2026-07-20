import { AlertTriangle, ClipboardList } from "lucide-react";
import type { WorkbenchNeedsAttentionZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import { WORKBENCH_SCOPE_REVIEW_FUTURE_ACTIONS } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_ATTENTION_COUNT_BADGE,
  WORKBENCH_ATTENTION_ITEM,
  WORKBENCH_ATTENTION_ZONE,
  WORKBENCH_ATTENTION_ZONE_HEADER,
  WORKBENCH_EDIT_OPTION_CHIP_ENABLED,
  WORKBENCH_EDIT_OPTION_CHIP_HINT,
  WORKBENCH_EDIT_OPTION_CHIP_SECONDARY,
  WORKBENCH_EDIT_OPTION_TITLE,
  WORKBENCH_EDIT_OPTION_TRIGGER_SECONDARY,
  WORKBENCH_FUTURE_ACTION_CHIP,
  WORKBENCH_MODULE_DESC,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_MODULE_KICKER,
  WORKBENCH_MODULE_TITLE,
  WORKBENCH_REMOVE_FROM_OPTION_ACTION,
  WORKBENCH_SCOPE_REVIEW_COUNT_BADGE,
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

      <div className={`${WORKBENCH_MODULE_INNER} space-y-1`}>
        <ul className="divide-y divide-slate-100">
          {zone.lines.map((line) => (
            <li key={line.templateItemId} className={`${WORKBENCH_ATTENTION_ITEM} !border-0 !shadow-none !bg-transparent px-0 py-2`}>
              <ProposalBuilderWorkbenchLineRow variant="hard_blocker" line={line} compact />
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
    <section
      className={`${WORKBENCH_SCOPE_REVIEW_ZONE} border-slate-200/70 bg-slate-50/40`}
      aria-labelledby="workbench-scope-review-heading"
      data-builder-quantity-review
    >
      <header className={`${WORKBENCH_SCOPE_REVIEW_ZONE_HEADER} py-2.5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                id="workbench-scope-review-heading"
              >
                Needs quantity review
              </p>
              <p className="mt-0.5 text-[13px] text-slate-600">
                {zone.count === 1
                  ? "1 item needs a quantity before totals are final."
                  : `${zone.count} items need quantities before totals are final.`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenEditOption}
              className={WORKBENCH_EDIT_OPTION_TRIGGER_SECONDARY}
              title="Open Edit option — set quantity for review lines"
            >
              {WORKBENCH_EDIT_OPTION_TITLE}
            </button>
            <span className={WORKBENCH_SCOPE_REVIEW_COUNT_BADGE}>{zone.count}</span>
          </div>
        </div>
      </header>

      <div className={`${WORKBENCH_MODULE_INNER} py-2`}>
        <ul className="divide-y divide-slate-100" data-builder-quantity-review-list>
          {zone.lines.map((line) => {
            const canSetQuantity =
              manualQuantityEnabled &&
              line.reasons.includes("needs_quantity") &&
              Boolean(onSetQuantityForLine);
            const canRemove = excludeEnabled && Boolean(onRemoveFromOptionForLine);

            return (
              <li
                key={line.templateItemId}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
                data-builder-quantity-review-row
              >
                <div className="min-w-0 flex-1">
                  <ProposalBuilderWorkbenchLineRow variant="scope_review" line={line} compact />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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
                          data-builder-set-quantity
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

                    if (isSetQuantity || isRemove) {
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
                              : undefined
                          }
                        >
                          {isRemove ? WORKBENCH_REMOVE_FROM_OPTION_ACTION : action.label}
                        </button>
                      );
                    }

                    return null;
                  })}
                </div>
              </li>
            );
          })}
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
    <div className="space-y-3">
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
