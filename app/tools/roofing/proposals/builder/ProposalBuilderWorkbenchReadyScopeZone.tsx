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
  WORKBENCH_REMOVE_FROM_OPTION_ACTION,
} from "./proposalBuilderConstants";
import ProposalBuilderWorkbenchLineRow from "./ProposalBuilderWorkbenchLineRow";
import ProposalBuilderWorkbenchLineDetails from "./ProposalBuilderWorkbenchLineDetails";
import ProposalBuilderWorkbenchRowMenu from "./ProposalBuilderWorkbenchRowMenu";
import ProposalBuilderWorkbenchInlineQuantityEditor from "./ProposalBuilderWorkbenchInlineQuantityEditor";

type ProposalBuilderWorkbenchReadyScopeZoneProps = {
  sections: readonly WorkbenchScopeSection[];
  /** When true, omit outer card shell — parent provides the estimate surface. */
  embedded?: boolean;
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
  embedded = false,
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
      className={embedded ? undefined : WORKBENCH_MODULE}
      aria-labelledby="workbench-ready-scope-heading"
      data-builder-included-estimate
      data-builder-included-estimate-table
      data-builder-itemized-estimate="true"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/70 px-5 py-2.5 sm:px-6">
        <p
          className="text-[13px] font-semibold text-slate-900"
          id="workbench-ready-scope-heading"
        >
          Included estimate
        </p>
        <span className="text-[11px] font-medium tabular-nums text-slate-400">
          {lineCount} item{lineCount === 1 ? "" : "s"}
        </span>
      </header>

      <div className="overflow-visible">
        {lineCount === 0 ? (
          <p className="px-5 py-5 text-sm text-slate-500 sm:px-6">
            No included lines yet. Finish the estimate to populate this section.
          </p>
        ) : (
          <div className="overflow-visible">
            <div
              className={`${WORKBENCH_INCLUDED_ROW_GRID} hidden border-b border-slate-200/60 bg-white/80 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:grid sm:px-6`}
              data-builder-estimate-column-headers
            >
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="overflow-visible divide-y divide-slate-100/90">
              {lines.map((line, index) => {
                const showDetails = detailsLineId === line.templateItemId;
                const canRemove = removeEnabled && Boolean(onRemoveFromProposal);
                const isEditing = editingQuantityLineId === line.templateItemId;
                const canEditQty =
                  Boolean(line.manualQuantityActive && onEditQuantityForLine);
                const hasAttention = line.attentionReasons.length > 0;
                const amountClass = hasAttention
                  ? WORKBENCH_LINE_AMOUNT_ATTENTION
                  : isIncludedAmount(line.amountLabel)
                    ? WORKBENCH_LINE_AMOUNT_INCLUDED
                    : WORKBENCH_LINE_AMOUNT;

                return (
                  <li
                    key={line.templateItemId}
                    className={`group/estimate-row overflow-visible transition-colors ${
                      isEditing
                        ? "bg-blue-50/55 ring-1 ring-inset ring-blue-100"
                        : index % 2 === 1
                          ? "bg-slate-50/30 hover:bg-blue-50/20"
                          : "bg-white hover:bg-blue-50/20"
                    }`}
                    data-builder-included-estimate-row
                    data-builder-inline-editing={isEditing ? "true" : undefined}
                  >
                    {isEditing && onSaveQuantity ? (
                      <div className="px-5 py-3 sm:px-6">
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
                      <div className={`${WORKBENCH_INCLUDED_ROW_GRID} px-5 py-4 sm:px-6`}>
                        <ProposalBuilderWorkbenchLineRow
                          variant="scope"
                          line={line}
                          as="div"
                          hideDetails
                          itemCellOnly
                        />
                        <div className="hidden sm:block sm:text-right">
                          <span
                            className={`inline-flex min-w-[3.25rem] justify-end rounded-md px-2 py-1 text-[13px] tabular-nums ${
                              line.qtyUnresolved
                                ? "bg-slate-50 text-slate-400"
                                : "bg-slate-50/90 font-semibold text-slate-800"
                            }`}
                          >
                            {line.qtyLabel}
                          </span>
                        </div>
                        <p className={`hidden sm:block ${amountClass}`}>{line.amountLabel}</p>
                        <div className="flex items-center justify-end gap-2">
                          {canEditQty ? (
                            <button
                              type="button"
                              onClick={() => onEditQuantityForLine!(line.templateItemId)}
                              className="hidden rounded-md px-2 py-1 text-[11.5px] font-semibold text-blue-700 opacity-0 transition hover:bg-blue-100/70 group-hover/estimate-row:opacity-100 group-focus-within/estimate-row:opacity-100 sm:inline-flex"
                              data-builder-edit-quantity
                            >
                              Edit qty
                            </button>
                          ) : null}
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
                              ...(canEditQty
                                ? [
                                    {
                                      id: "edit_qty",
                                      label: "Edit quantity",
                                      onSelect: () =>
                                        onEditQuantityForLine!(line.templateItemId),
                                    },
                                  ]
                                : []),
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
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:hidden">
                          <p className={WORKBENCH_LINE_QTY}>
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
                          {canEditQty ? (
                            <button
                              type="button"
                              onClick={() => onEditQuantityForLine!(line.templateItemId)}
                              className="text-[11.5px] font-semibold text-blue-700"
                              data-builder-edit-quantity
                            >
                              Edit qty
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}
                    {showDetails && !isEditing ? (
                      <div className="px-5 pb-3.5 sm:px-6" data-builder-included-line-details>
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
