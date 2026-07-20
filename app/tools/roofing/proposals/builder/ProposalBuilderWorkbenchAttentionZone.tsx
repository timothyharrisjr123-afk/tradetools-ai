"use client";

import { AlertTriangle } from "lucide-react";
import type { WorkbenchNeedsAttentionZone } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_ATTENTION_COUNT_BADGE,
  WORKBENCH_ATTENTION_ITEM,
  WORKBENCH_ATTENTION_ZONE,
  WORKBENCH_ATTENTION_ZONE_HEADER,
  WORKBENCH_EDIT_OPTION_CHIP_ENABLED,
  WORKBENCH_MODULE_DESC,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_MODULE_KICKER,
  WORKBENCH_MODULE_TITLE,
  WORKBENCH_SCOPE_REVIEW_ZONE,
  WORKBENCH_SCOPE_REVIEW_ZONE_HEADER,
  WORKBENCH_SET_QUANTITY_ACTION,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";
import ProposalBuilderWorkbenchInlineQuantityEditor from "./ProposalBuilderWorkbenchInlineQuantityEditor";

type ProposalBuilderWorkbenchAttentionZoneProps = {
  zone: WorkbenchNeedsAttentionZone;
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
  highlightFinishEstimate?: boolean;
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
            <li
              key={line.templateItemId}
              className={`${WORKBENCH_ATTENTION_ITEM} !border-0 !bg-transparent !shadow-none px-0 py-2`}
            >
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
  editingQuantityLineId = null,
  onStartSetQuantity,
  onCancelSetQuantity,
  onSaveQuantity,
  quantitySaveInFlight = false,
  quantitySaveError = null,
  manualQuantityEnabled = false,
  highlightFinishEstimate = false,
}: {
  zone: WorkbenchNeedsAttentionZone["scopeReview"];
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
  highlightFinishEstimate?: boolean;
}) {
  if (!zone.show) return null;

  return (
    <section
      className={`${WORKBENCH_SCOPE_REVIEW_ZONE} transition-shadow duration-500 ${
        highlightFinishEstimate
          ? "rounded-md ring-2 ring-blue-300/80 ring-offset-2"
          : ""
      }`}
      aria-labelledby="workbench-scope-review-heading"
      data-builder-quantity-review
      data-builder-finish-estimate
      data-builder-finish-estimate-focus={highlightFinishEstimate ? "true" : undefined}
      id="builder-finish-estimate"
    >
      <header className={WORKBENCH_SCOPE_REVIEW_ZONE_HEADER}>
        <div className="min-w-0">
          <p
            className="text-[15px] font-semibold tracking-tight text-slate-950"
            id="workbench-scope-review-heading"
          >
            Finish estimate
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-slate-600">
            {zone.count === 1
              ? "1 item needs a quantity before totals are final."
              : `${zone.count} items need quantities before totals are final.`}
          </p>
        </div>
      </header>

      <div className={`${WORKBENCH_MODULE_INNER} py-1`}>
        <ul className="divide-y divide-slate-100" data-builder-quantity-review-list>
          {zone.lines.map((line, index) => {
            const canSetQuantity =
              manualQuantityEnabled &&
              line.reasons.includes("needs_quantity") &&
              Boolean(onStartSetQuantity) &&
              Boolean(onSaveQuantity);
            const isEditing = editingQuantityLineId === line.templateItemId;

            return (
              <li
                key={line.templateItemId}
                className="py-1.5"
                data-builder-quantity-review-row
                data-builder-quantity-review-row-index={String(index)}
                id={
                  index === 0
                    ? "builder-finish-estimate-first-row"
                    : undefined
                }
              >
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
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0 flex-1">
                      <ProposalBuilderWorkbenchLineRow
                        variant="scope_review"
                        line={line}
                        compact
                      />
                    </div>
                    <div className="flex shrink-0 items-center justify-end">
                      {canSetQuantity ? (
                        <button
                          type="button"
                          className={WORKBENCH_EDIT_OPTION_CHIP_ENABLED}
                          onClick={() => onStartSetQuantity!(line.templateItemId)}
                          data-builder-set-quantity
                        >
                          {WORKBENCH_SET_QUANTITY_ACTION}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
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
  editingQuantityLineId = null,
  onStartSetQuantity,
  onCancelSetQuantity,
  onSaveQuantity,
  quantitySaveInFlight = false,
  quantitySaveError = null,
  manualQuantityEnabled = false,
  highlightFinishEstimate = false,
}: ProposalBuilderWorkbenchAttentionZoneProps) {
  if (!zone.show) return null;

  return (
    <div className="space-y-3">
      <HardBlockersSection zone={zone.hardBlockers} />
      <ScopeReviewSection
        zone={zone.scopeReview}
        editingQuantityLineId={editingQuantityLineId}
        onStartSetQuantity={onStartSetQuantity}
        onCancelSetQuantity={onCancelSetQuantity}
        onSaveQuantity={onSaveQuantity}
        quantitySaveInFlight={quantitySaveInFlight}
        quantitySaveError={quantitySaveError}
        manualQuantityEnabled={manualQuantityEnabled}
        highlightFinishEstimate={highlightFinishEstimate}
      />
    </div>
  );
}
