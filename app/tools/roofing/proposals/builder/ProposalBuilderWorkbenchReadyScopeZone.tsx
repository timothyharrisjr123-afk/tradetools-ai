"use client";

import { useState } from "react";
import type { WorkbenchScopeSection } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_INCLUDED_ROW_GRID,
  WORKBENCH_LINE_AMOUNT,
  WORKBENCH_LINE_AMOUNT_ATTENTION,
  WORKBENCH_LINE_AMOUNT_INCLUDED,
  WORKBENCH_LINE_QTY,
  WORKBENCH_LINE_QTY_VALUE,
  WORKBENCH_MODULE,
  WORKBENCH_MODULE_INNER,
  WORKBENCH_REMOVE_FROM_OPTION_ACTION,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";
import ProposalBuilderWorkbenchLineDetails from "./ProposalBuilderWorkbenchLineDetails";
import ProposalBuilderWorkbenchRowMenu from "./ProposalBuilderWorkbenchRowMenu";
import ProposalBuilderWorkbenchInlineQuantityEditor from "./ProposalBuilderWorkbenchInlineQuantityEditor";

type ProposalBuilderWorkbenchReadyScopeZoneProps = {
  sections: readonly WorkbenchScopeSection[];
  onEditQuantityForLine?: (templateItemId: string) => void;
  editingQuantityLineId?: string | null;
  onCancelSetQuantity?: () => void;
  onSaveQuantity?: (
    templateItemId: string,
    quantity: string,
    quantityDisplayLabel?: string | null
  ) => Promise<void>;
  quantitySaveInFlight?: boolean;
  quantitySaveError?: string | null;
  onRemoveFromProposal?: (templateItemId: string) => void;
  removeEnabled?: boolean;
  removeInFlight?: boolean;
};

function isIncludedAmount(label: string): boolean {
  return label === "Included" || label === "In package";
}

/**
 * Block 4G — full-width shared itemized Included estimate (Item / Qty / Price / ⋯).
 * Spans the wide Builder canvas — do not compress with max-width.
 */
export default function ProposalBuilderWorkbenchReadyScopeZone({
  sections,
  onEditQuantityForLine,
  editingQuantityLineId = null,
  onCancelSetQuantity,
  onSaveQuantity,
  quantitySaveInFlight = false,
  quantitySaveError = null,
  onRemoveFromProposal,
  removeEnabled = false,
  removeInFlight = false,
}: ProposalBuilderWorkbenchReadyScopeZoneProps) {
  const lines = sections.flatMap((section) => section.lines);
  const lineCount = lines.length;
  const [detailsLineId, setDetailsLineId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <section
      className={WORKBENCH_MODULE}
      aria-labelledby="workbench-ready-scope-heading"
      data-builder-included-estimate
      data-builder-included-estimate-table
      data-builder-itemized-estimate="true"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 pb-1.5 pt-1">
        <p
          className="text-base font-semibold tracking-tight text-slate-950"
          id="workbench-ready-scope-heading"
        >
          Included estimate
        </p>
      </header>

      <div className={`${WORKBENCH_MODULE_INNER} overflow-visible`}>
        {lineCount === 0 ? (
          <p className="text-sm text-slate-500">
            No included lines yet. Finish the estimate to populate this section.
          </p>
        ) : (
          <div className="overflow-visible">
            <div
              className={`${WORKBENCH_INCLUDED_ROW_GRID} mb-1.5 hidden border-b border-slate-200/90 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid`}
              data-builder-estimate-column-headers
            >
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span />
            </div>
            <ul className="overflow-visible">
              {lines.map((line) => {
                const showDetails = detailsLineId === line.templateItemId;
                const canRemove = removeEnabled && Boolean(onRemoveFromProposal);
                const isEditing = editingQuantityLineId === line.templateItemId;
                const hasAttention = line.attentionReasons.length > 0;
                const amountClass = hasAttention
                  ? WORKBENCH_LINE_AMOUNT_ATTENTION
                  : isIncludedAmount(line.amountLabel)
                    ? WORKBENCH_LINE_AMOUNT_INCLUDED
                    : WORKBENCH_LINE_AMOUNT;

                return (
                  <li
                    key={line.templateItemId}
                    className={`overflow-visible border-b border-slate-200/70 last:border-b-0 ${
                      isEditing ? "rounded-md bg-blue-50/40 ring-1 ring-blue-100" : ""
                    }`}
                    data-builder-included-estimate-row
                    data-builder-inline-editing={isEditing ? "true" : undefined}
                  >
                    {isEditing && onSaveQuantity ? (
                      <div className="py-1.5">
                        <ProposalBuilderWorkbenchInlineQuantityEditor
                          line={{
                            templateItemId: line.templateItemId,
                            name: line.name,
                            unitLabel: line.detailMeta.unit?.trim() || null,
                          }}
                          inFlight={quantitySaveInFlight}
                          error={quantitySaveError}
                          onCancel={() => onCancelSetQuantity?.()}
                          onSave={onSaveQuantity}
                          alignToColumns
                        />
                      </div>
                    ) : (
                      <div className={`${WORKBENCH_INCLUDED_ROW_GRID} py-0.5`}>
                        <ProposalBuilderWorkbenchLineRow
                          variant="scope"
                          line={line}
                          as="div"
                          hideDetails
                          itemCellOnly
                          onEditQuantity={
                            line.manualQuantityActive && onEditQuantityForLine
                              ? () => onEditQuantityForLine(line.templateItemId)
                              : undefined
                          }
                        />
                        <p className={`${WORKBENCH_LINE_QTY} hidden sm:block`}>
                          <span
                            className={
                              line.qtyUnresolved ? "text-slate-400" : WORKBENCH_LINE_QTY_VALUE
                            }
                          >
                            {line.qtyLabel}
                          </span>
                        </p>
                        <p className={`hidden sm:block ${amountClass}`}>{line.amountLabel}</p>
                        <div className="flex justify-end">
                          <ProposalBuilderWorkbenchRowMenu
                            rowId={line.templateItemId}
                            rowLabel={line.name}
                            openMenuId={openMenuId}
                            onOpenMenuIdChange={setOpenMenuId}
                            actions={[
                              {
                                id: "details",
                                label: showDetails ? "Hide details" : "View details",
                                onSelect: () =>
                                  setDetailsLineId((current) =>
                                    current === line.templateItemId
                                      ? null
                                      : line.templateItemId
                                  ),
                              },
                              ...(canRemove
                                ? [
                                    {
                                      id: "remove",
                                      label: WORKBENCH_REMOVE_FROM_OPTION_ACTION,
                                      disabled: removeInFlight,
                                      onSelect: () =>
                                        onRemoveFromProposal!(line.templateItemId),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </div>
                        <p className={`${WORKBENCH_LINE_QTY} sm:hidden`}>
                          Qty{" "}
                          <span
                            className={
                              line.qtyUnresolved ? "text-slate-400" : WORKBENCH_LINE_QTY_VALUE
                            }
                          >
                            {line.qtyLabel}
                          </span>
                          <span className="mx-2 text-slate-300">·</span>
                          <span className={amountClass}>{line.amountLabel}</span>
                        </p>
                      </div>
                    )}
                    {showDetails && !isEditing ? (
                      <div className="pb-2" data-builder-included-line-details>
                        <ProposalBuilderWorkbenchLineDetails detailMeta={line.detailMeta} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
