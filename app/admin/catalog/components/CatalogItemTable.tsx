"use client";

import { Fragment, useEffect, useRef } from "react";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  catalogItemTypeLabel,
  catalogUnitLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import {
  CATALOG_CONTRACTOR_LABELS,
  CATALOG_SELECT_ALL_ARIA,
  CATALOG_SELECT_ROW_ARIA,
  catalogItemDisplayName,
  catalogStatusPillTone,
  formatCatalogItemStatus,
  formatProposalVisibilityShort,
  proposalVisibilityPillTone,
} from "@/app/lib/catalogContractorLabels";
import {
  catalogSelectionHeaderState,
  type CatalogSelectionHeaderState,
} from "@/app/lib/catalogSelection";
import {
  countVisibleOptionalCatalogColumns,
  isCatalogOptionalColumnVisible,
  type CatalogOptionalColumnVisibility,
} from "@/app/lib/catalogColumnVisibility";
import { formatCatalogQuantityDriversLine } from "../catalogAdminUtils";
import {
  CATALOG_PILL_PROPOSAL_GROUPED,
  CATALOG_PILL_PROPOSAL_HIDDEN,
  CATALOG_PILL_PROPOSAL_VISIBLE,
  CATALOG_PILL_STATUS_ACTIVE,
  CATALOG_PILL_STATUS_INACTIVE,
  CATALOG_PILL_STATUS_NEEDS_PRICE,
  CATALOG_SELECT_CHECKBOX,
  TABLE_TD,
  TABLE_TD_COMPACT,
  TABLE_TD_NAME,
  TABLE_TD_SELECT,
  TABLE_TD_UNIT,
  TABLE_TD_WIDE,
  TABLE_TH,
  TABLE_TH_ACTION,
  TABLE_TD_ACTION,
  TABLE_TH_COMPACT,
  TABLE_TH_SELECT,
  TABLE_TH_WIDE,
} from "../catalogAdminConstants";
import CatalogPriceTableCell from "./CatalogPriceTableCell";

export type CatalogItemTableSection = {
  key: string;
  label: string;
  items: CatalogItem[];
};

type CatalogItemTableProps = {
  /** Flat continuous list sections (P0D — no group divider rows). */
  groupedFilteredItems: CatalogItemTableSection[];
  /** Edit-panel highlight (not multi-select). */
  selectedItemId: string | null;
  /** Multi-select by catalog item id (in-memory only). */
  selectedIds: ReadonlySet<string>;
  savingItemId: string | null;
  togglingActiveId: string | null;
  busy: boolean;
  columnVisibility: CatalogOptionalColumnVisibility;
  onEditToggle: (item: CatalogItem) => void;
  onToggleActive: (item: CatalogItem) => void;
  onToggleRowSelect: (itemId: string) => void;
  onToggleSelectAllVisible: () => void;
};

function proposalPillClass(visibility: CatalogItem["customer_visibility"]): string {
  const tone = proposalVisibilityPillTone(visibility);
  if (tone === "visible") return CATALOG_PILL_PROPOSAL_VISIBLE;
  if (tone === "grouped") return CATALOG_PILL_PROPOSAL_GROUPED;
  if (tone === "hidden") return CATALOG_PILL_PROPOSAL_HIDDEN;
  return CATALOG_PILL_PROPOSAL_HIDDEN;
}

function statusPillClass(item: CatalogItem): string {
  const tone = catalogStatusPillTone(item);
  if (tone === "needs_price") return CATALOG_PILL_STATUS_NEEDS_PRICE;
  if (tone === "inactive") return CATALOG_PILL_STATUS_INACTIVE;
  return CATALOG_PILL_STATUS_ACTIVE;
}

function SelectAllCheckbox({
  headerState,
  disabled,
  onToggle,
}: {
  headerState: CatalogSelectionHeaderState;
  disabled: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = headerState === "some";
    }
  }, [headerState]);

  return (
    <input
      ref={ref}
      id="catalog-select-all"
      type="checkbox"
      className={CATALOG_SELECT_CHECKBOX}
      checked={headerState === "all"}
      disabled={disabled}
      onChange={onToggle}
      aria-label={CATALOG_SELECT_ALL_ARIA}
      title={CATALOG_SELECT_ALL_ARIA}
      data-catalog-select-all
      data-catalog-select-header={headerState}
    />
  );
}

function RowSelectCheckbox({
  itemId,
  checked,
  disabled,
  onToggle,
}: {
  itemId: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <input
      id={`catalog-select-${itemId}`}
      type="checkbox"
      className={CATALOG_SELECT_CHECKBOX}
      checked={checked}
      disabled={disabled}
      onChange={onToggle}
      onClick={(e) => e.stopPropagation()}
      aria-label={CATALOG_SELECT_ROW_ARIA}
      title={CATALOG_SELECT_ROW_ARIA}
      data-catalog-select-row={itemId}
    />
  );
}

export default function CatalogItemTable({
  groupedFilteredItems,
  selectedItemId,
  selectedIds,
  savingItemId,
  togglingActiveId,
  busy,
  columnVisibility,
  onEditToggle,
  onToggleActive,
  onToggleRowSelect,
  onToggleSelectAllVisible,
}: CatalogItemTableProps) {
  const flatItems = groupedFilteredItems.flatMap((section) => section.items);
  const visibleIds = flatItems.map((item) => item.id);
  const headerState = catalogSelectionHeaderState(selectedIds, visibleIds);
  const showType = isCatalogOptionalColumnVisible(columnVisibility, "type");
  const showMeasurement = isCatalogOptionalColumnVisible(columnVisibility, "measurement");
  const showUnit = isCatalogOptionalColumnVisible(columnVisibility, "unit");
  const showUnitCost = isCatalogOptionalColumnVisible(columnVisibility, "unit_cost");
  const showUnitPrice = isCatalogOptionalColumnVisible(columnVisibility, "unit_price");
  const showProposal = isCatalogOptionalColumnVisible(columnVisibility, "proposal");
  const showStatus = isCatalogOptionalColumnVisible(columnVisibility, "status");
  const visibleOptional = countVisibleOptionalCatalogColumns(columnVisibility);
  // Required: select + name + actions (3). Optional count drives min width.
  const minWidthRem = Math.max(28, 18 + visibleOptional * 5.5);
  const selectionDisabled = busy || visibleIds.length === 0;

  return (
    <div className="overflow-x-auto bg-white">
      <table
        className="w-full table-auto text-sm"
        style={{ minWidth: `${minWidthRem}rem` }}
        data-catalog-table
        data-catalog-visible-optional={visibleOptional}
      >
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100/80 text-left">
            <th className={TABLE_TH_SELECT} scope="col">
              <SelectAllCheckbox
                headerState={headerState}
                disabled={selectionDisabled}
                onToggle={onToggleSelectAllVisible}
              />
            </th>
            <th className={TABLE_TH_WIDE}>{CATALOG_CONTRACTOR_LABELS.name}</th>
            {showType ? <th className={TABLE_TH}>{CATALOG_CONTRACTOR_LABELS.type}</th> : null}
            {showMeasurement ? (
              <th className={TABLE_TH_WIDE}>{CATALOG_CONTRACTOR_LABELS.measurement}</th>
            ) : null}
            {showUnit ? <th className={TABLE_TH}>{CATALOG_CONTRACTOR_LABELS.unit}</th> : null}
            {showUnitCost ? (
              <th className={TABLE_TH_COMPACT}>{CATALOG_CONTRACTOR_LABELS.unitCost}</th>
            ) : null}
            {showUnitPrice ? (
              <th className={TABLE_TH_COMPACT}>{CATALOG_CONTRACTOR_LABELS.unitPrice}</th>
            ) : null}
            {showProposal ? (
              <th className={TABLE_TH_COMPACT}>{CATALOG_CONTRACTOR_LABELS.proposal}</th>
            ) : null}
            {showStatus ? (
              <th className={TABLE_TH_COMPACT}>{CATALOG_CONTRACTOR_LABELS.status}</th>
            ) : null}
            <th className={TABLE_TH_ACTION}>{CATALOG_CONTRACTOR_LABELS.actions}</th>
          </tr>
        </thead>
        <tbody>
          {flatItems.map((item) => {
            const isEditing = selectedItemId === item.id;
            const isRowSelected = selectedIds.has(item.id);
            const isSaving = savingItemId === item.id;
            const isTogglingActive = togglingActiveId === item.id;
            const display = catalogItemDisplayName(item);
            const quantityDriversLine = formatCatalogQuantityDriversLine(item);
            const status = formatCatalogItemStatus(item);
            const proposalLabel = formatProposalVisibilityShort(item.customer_visibility);

            return (
              <Fragment key={item.id}>
                <tr
                  className={`group border-b border-slate-100 transition-colors hover:bg-slate-50/90 ${isEditing ? "bg-slate-50 ring-1 ring-inset ring-slate-200" : ""} ${isRowSelected && !isEditing ? "bg-sky-50/40" : ""} ${!item.active ? "opacity-70" : ""}`}
                  data-catalog-row-selected={isRowSelected ? "true" : "false"}
                >
                  <td className={TABLE_TD_SELECT}>
                    <RowSelectCheckbox
                      itemId={item.id}
                      checked={isRowSelected}
                      disabled={busy}
                      onToggle={() => onToggleRowSelect(item.id)}
                    />
                  </td>
                  <td className={TABLE_TD_NAME}>
                    <span className="font-medium text-slate-900">{display.primary}</span>
                    {display.secondary ? (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        {display.secondary}
                      </span>
                    ) : null}
                    {quantityDriversLine ? (
                      <span
                        className="mt-0.5 block text-xs font-normal text-slate-500"
                        data-catalog-quantity-drivers-line
                      >
                        {quantityDriversLine}
                      </span>
                    ) : null}
                  </td>
                  {showType ? (
                    <td className={TABLE_TD}>
                      <span className="text-slate-600">{catalogItemTypeLabel(item.item_type)}</span>
                    </td>
                  ) : null}
                  {showMeasurement ? (
                    <td className={`${TABLE_TD_WIDE} max-w-[10rem] truncate text-slate-600`}>
                      {quantitySourceLabel(item.quantity_source)}
                    </td>
                  ) : null}
                  {showUnit ? (
                    <td className={TABLE_TD_UNIT}>{catalogUnitLabel(item.unit)}</td>
                  ) : null}
                  {showUnitCost ? (
                    <td className={TABLE_TD_COMPACT}>
                      <CatalogPriceTableCell cents={item.unit_cost_cents} emptyLabel="—" />
                    </td>
                  ) : null}
                  {showUnitPrice ? (
                    <td className={TABLE_TD_COMPACT}>
                      <CatalogPriceTableCell cents={item.unit_price_cents} />
                    </td>
                  ) : null}
                  {showProposal ? (
                    <td className={TABLE_TD_COMPACT}>
                      <span className={proposalPillClass(item.customer_visibility)}>
                        {proposalLabel}
                      </span>
                    </td>
                  ) : null}
                  {showStatus ? (
                    <td className={TABLE_TD_COMPACT}>
                      <span className={statusPillClass(item)}>{status}</span>
                    </td>
                  ) : null}
                  <td
                    className={`${TABLE_TD_ACTION} ${isEditing ? "bg-slate-50" : "bg-white group-hover:bg-slate-50/90"}`}
                  >
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => onEditToggle(item)}
                        disabled={
                          isSaving ||
                          isTogglingActive ||
                          (savingItemId != null && !isSaving)
                        }
                        className="text-sm font-semibold text-slate-900 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
                      >
                        {isEditing ? "Close" : "Edit"}
                      </button>
                      <span className="h-3.5 w-px shrink-0 bg-slate-200" aria-hidden />
                      <button
                        type="button"
                        onClick={() => onToggleActive(item)}
                        disabled={busy && !isTogglingActive}
                        className="text-xs font-medium text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isTogglingActive ? "…" : item.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
