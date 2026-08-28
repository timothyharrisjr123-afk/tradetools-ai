"use client";

import { useState } from "react";
import type {
  WorkbenchScopeLine,
  WorkbenchScopeSection,
} from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import {
  WORKBENCH_INCLUDED_ROW_GRID,
  WORKBENCH_LINE_AMOUNT,
  WORKBENCH_LINE_AMOUNT_ATTENTION,
  WORKBENCH_LINE_AMOUNT_INCLUDED,
  WORKBENCH_LINE_NAME,
  WORKBENCH_MODULE,
  WORKBENCH_REMOVE_FROM_OPTION_ACTION,
  WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL,
} from "./proposalBuilderConstants";
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
  onClearManualQuantity?: (templateItemId: string) => Promise<void>;
  onRemoveFromProposal?: (templateItemId: string) => void;
  removeEnabled?: boolean;
  removeInFlight?: boolean;
  onHideFromCustomer?: (templateItemId: string) => void;
  onShowToCustomer?: (templateItemId: string) => void;
  visibilityInFlight?: boolean;
  excludeError?: string | null;
  excludeErrorLineId?: string | null;
  visibilityError?: string | null;
  visibilityErrorLineId?: string | null;
};

function isIncludedAmount(label: string): boolean {
  return label === "Included" || label === "In package";
}

function parseQtyDraft(qtyLabel: string): string {
  const match = qtyLabel.trim().match(/^(\d+(?:\.\d+)?)/);
  return match?.[1] ?? "";
}

function lineNeedsQuantity(line: WorkbenchScopeLine): boolean {
  return (
    line.qtyUnresolved ||
    line.attentionReasons.includes("needs_quantity")
  );
}

/**
 * Canonical estimate table: Item / Qty / Price / ⋯
 * Quantity edits happen on the row. No nested editor card.
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
  onClearManualQuantity,
  onRemoveFromProposal,
  removeEnabled = false,
  removeInFlight = false,
  onHideFromCustomer,
  onShowToCustomer,
  visibilityInFlight = false,
  excludeError = null,
  excludeErrorLineId = null,
  visibilityError = null,
  visibilityErrorLineId = null,
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
            No included lines yet.
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
                const canEditQty = Boolean(onEditQuantityForLine);
                const needsQty = lineNeedsQuantity(line);
                const hasAttention = line.attentionReasons.length > 0;
                const amountClass = hasAttention
                  ? WORKBENCH_LINE_AMOUNT_ATTENTION
                  : isIncludedAmount(line.amountLabel)
                    ? WORKBENCH_LINE_AMOUNT_INCLUDED
                    : WORKBENCH_LINE_AMOUNT;
                const canUseMeasured =
                  Boolean(onClearManualQuantity) && line.manualQuantityActive;
                const canHide =
                  Boolean(onHideFromCustomer) && !line.hiddenFromCustomer;
                const canShow =
                  Boolean(onShowToCustomer) && line.hiddenFromCustomer;

                return (
                  <li
                    key={line.templateItemId}
                    className={`overflow-visible ${
                      isEditing
                        ? "bg-slate-50/80"
                        : needsQty
                          ? "bg-amber-50/40"
                          : index % 2 === 1
                            ? "bg-slate-50/30"
                            : "bg-white"
                    }`}
                    data-builder-included-estimate-row
                    data-builder-inline-editing={isEditing ? "true" : undefined}
                    data-builder-quantity-issue-row={needsQty ? "true" : undefined}
                  >
                    {isEditing && onSaveQuantity ? (
                      <div className="px-5 py-3 sm:px-6">
                        <ProposalBuilderWorkbenchInlineQuantityEditor
                          key={line.templateItemId}
                          line={{
                            templateItemId: line.templateItemId,
                            name: line.name,
                            unitLabel: line.detailMeta.unit?.trim() || null,
                          }}
                          initialQuantity={parseQtyDraft(line.qtyLabel)}
                          inFlight={quantitySaveInFlight}
                          error={quantitySaveError}
                          onCancel={() => onCancelSetQuantity?.()}
                          onSave={onSaveQuantity}
                          alignToColumns
                          onUseMeasuredQuantity={
                            canUseMeasured
                              ? () => onClearManualQuantity!(line.templateItemId)
                              : undefined
                          }
                        />
                      </div>
                    ) : (
                      <div className="px-5 py-3 sm:px-6">
                        <div
                          className={`${WORKBENCH_INCLUDED_ROW_GRID} grid-cols-[minmax(0,1fr)_2.75rem] [grid-template-areas:'name_menu'_'qty_price'] sm:[grid-template-areas:'name_qty_price_menu']`}
                          data-builder-mobile-estimate-row
                        >
                          <div className="min-w-0 [grid-area:name]">
                            <p className={WORKBENCH_LINE_NAME}>{line.name}</p>
                            {needsQty ? (
                              <p
                                className="mt-0.5 text-[12px] font-medium text-amber-800"
                                data-builder-row-quantity-issue
                              >
                                Needs quantity
                              </p>
                            ) : null}
                            {line.hiddenFromCustomer ? (
                              <p
                                className="mt-0.5 text-[12px] text-slate-500"
                                data-builder-row-hidden-from-customer
                              >
                                Hidden from customer
                              </p>
                            ) : null}
                          </div>
                          <div className="[grid-area:qty] sm:text-right">
                            {canEditQty ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onEditQuantityForLine!(line.templateItemId)
                                }
                                className={`inline-flex min-h-[44px] min-w-[3.25rem] items-center rounded-md px-2 text-[13px] tabular-nums sm:min-h-0 sm:h-8 sm:w-full sm:justify-end ${
                                  needsQty
                                    ? "font-medium text-amber-800 underline decoration-amber-300 underline-offset-2"
                                    : "font-semibold text-slate-800 hover:bg-slate-100"
                                }`}
                                data-builder-qty-edit-trigger
                                data-builder-edit-quantity
                                aria-label={`Edit quantity for ${line.name}`}
                              >
                                <span className="sm:hidden">
                                  Qty{"\u00A0"}
                                </span>
                                {needsQty ? "Not resolved" : line.qtyLabel}
                              </button>
                            ) : (
                              <span
                                className={`inline-flex min-h-[44px] min-w-[3.25rem] items-center px-2 text-[13px] tabular-nums sm:min-h-0 sm:w-full sm:justify-end ${
                                  needsQty ? "text-slate-400" : "font-semibold text-slate-800"
                                }`}
                              >
                                <span className="sm:hidden">
                                  Qty{"\u00A0"}
                                </span>
                                {needsQty ? "Not resolved" : line.qtyLabel}
                              </span>
                            )}
                          </div>
                          <p className={`${amountClass} [grid-area:price]`}>{line.amountLabel}</p>
                          <div className="flex items-start justify-end [grid-area:menu] sm:items-center">
                            <ProposalBuilderWorkbenchRowMenu
                              rowId={line.templateItemId}
                              rowLabel={line.name}
                              openMenuId={openMenuId}
                              onOpenMenuIdChange={setOpenMenuId}
                              actions={[
                                ...(canEditQty
                                  ? [
                                      {
                                        id: "edit_qty",
                                        label: needsQty
                                          ? "Set quantity"
                                          : "Edit quantity",
                                        onSelect: () =>
                                          onEditQuantityForLine!(
                                            line.templateItemId
                                          ),
                                      },
                                    ]
                                  : []),
                                ...(canUseMeasured
                                  ? [
                                      {
                                        id: "use_measured",
                                        label:
                                          WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL,
                                        dataAttr: "data-builder-use-measured-quantity",
                                        onSelect: () =>
                                          void onClearManualQuantity!(
                                            line.templateItemId
                                          ),
                                      },
                                    ]
                                  : []),
                                ...(canHide
                                  ? [
                                      {
                                        id: "hide",
                                        label: "Hide from customer",
                                        disabled: visibilityInFlight,
                                        dataAttr:
                                          "data-builder-hide-from-customer",
                                        onSelect: () =>
                                          onHideFromCustomer!(
                                            line.templateItemId
                                          ),
                                      },
                                    ]
                                  : []),
                                ...(canShow
                                  ? [
                                      {
                                        id: "show",
                                        label: "Show to customer",
                                        disabled: visibilityInFlight,
                                        dataAttr:
                                          "data-builder-show-to-customer",
                                        onSelect: () =>
                                          onShowToCustomer!(
                                            line.templateItemId
                                          ),
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
                                          onRemoveFromProposal!(
                                            line.templateItemId
                                          ),
                                      },
                                    ]
                                  : []),
                                {
                                  id: "details",
                                  label: showDetails
                                    ? "Hide details"
                                    : "View details",
                                  onSelect: () =>
                                    setDetailsLineId((current) =>
                                      current === line.templateItemId
                                        ? null
                                        : line.templateItemId
                                    ),
                                },
                              ]}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {excludeError && excludeErrorLineId === line.templateItemId ? (
                      <p
                        className="px-5 pb-2 text-[12px] leading-snug text-red-700 sm:px-6"
                        role="alert"
                        data-builder-row-exclude-error
                      >
                        {excludeError}
                      </p>
                    ) : null}
                    {visibilityError && visibilityErrorLineId === line.templateItemId ? (
                      <p
                        className="px-5 pb-2 text-[12px] leading-snug text-red-700 sm:px-6"
                        role="alert"
                        data-builder-row-visibility-error
                      >
                        {visibilityError}
                      </p>
                    ) : null}
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
