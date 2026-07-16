import { Fragment } from "react";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  catalogItemTypeLabel,
  catalogUnitLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import {
  CATALOG_BULK_SELECTION_PLANNED_TITLE,
  CATALOG_CONTRACTOR_LABELS,
  catalogItemDisplayName,
  catalogStatusPillTone,
  formatCatalogItemStatus,
  formatProposalVisibilityShort,
  proposalVisibilityPillTone,
} from "@/app/lib/catalogContractorLabels";
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
  selectedItemId: string | null;
  savingItemId: string | null;
  togglingActiveId: string | null;
  busy: boolean;
  onEditToggle: (item: CatalogItem) => void;
  onToggleActive: (item: CatalogItem) => void;
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

function PlannedSelectCheckbox({ id }: { id: string }) {
  return (
    <input
      id={id}
      type="checkbox"
      disabled
      aria-disabled="true"
      tabIndex={-1}
      className={CATALOG_SELECT_CHECKBOX}
      title={CATALOG_BULK_SELECTION_PLANNED_TITLE}
      aria-label={CATALOG_BULK_SELECTION_PLANNED_TITLE}
    />
  );
}

export default function CatalogItemTable({
  groupedFilteredItems,
  selectedItemId,
  savingItemId,
  togglingActiveId,
  busy,
  onEditToggle,
  onToggleActive,
}: CatalogItemTableProps) {
  const flatItems = groupedFilteredItems.flatMap((section) => section.items);

  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[54rem] table-auto text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100/80 text-left">
            <th className={TABLE_TH_SELECT} scope="col">
              <PlannedSelectCheckbox id="catalog-select-all-planned" />
            </th>
            <th className={TABLE_TH_WIDE}>{CATALOG_CONTRACTOR_LABELS.name}</th>
            <th className={TABLE_TH}>{CATALOG_CONTRACTOR_LABELS.type}</th>
            <th className={TABLE_TH_WIDE}>{CATALOG_CONTRACTOR_LABELS.measurement}</th>
            <th className={TABLE_TH}>{CATALOG_CONTRACTOR_LABELS.unit}</th>
            <th className={TABLE_TH_COMPACT}>{CATALOG_CONTRACTOR_LABELS.unitCost}</th>
            <th className={TABLE_TH_COMPACT}>{CATALOG_CONTRACTOR_LABELS.unitPrice}</th>
            <th className={TABLE_TH_COMPACT}>{CATALOG_CONTRACTOR_LABELS.proposal}</th>
            <th className={TABLE_TH_COMPACT}>{CATALOG_CONTRACTOR_LABELS.status}</th>
            <th className={TABLE_TH_ACTION}>{CATALOG_CONTRACTOR_LABELS.actions}</th>
          </tr>
        </thead>
        <tbody>
          {flatItems.map((item) => {
            const isSelected = selectedItemId === item.id;
            const isSaving = savingItemId === item.id;
            const isTogglingActive = togglingActiveId === item.id;
            const display = catalogItemDisplayName(item);
            const quantityDriversLine = formatCatalogQuantityDriversLine(item);
            const status = formatCatalogItemStatus(item);
            const proposalLabel = formatProposalVisibilityShort(item.customer_visibility);

            return (
              <Fragment key={item.id}>
                <tr
                  className={`group border-b border-slate-100 transition-colors hover:bg-slate-50/90 ${isSelected ? "bg-slate-50 ring-1 ring-inset ring-slate-200" : ""} ${!item.active ? "opacity-70" : ""}`}
                >
                  <td className={TABLE_TD_SELECT}>
                    <PlannedSelectCheckbox id={`catalog-select-${item.id}`} />
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
                  <td className={TABLE_TD}>
                    <span className="text-slate-600">{catalogItemTypeLabel(item.item_type)}</span>
                  </td>
                  <td className={`${TABLE_TD_WIDE} max-w-[10rem] truncate text-slate-600`}>
                    {quantitySourceLabel(item.quantity_source)}
                  </td>
                  <td className={TABLE_TD_UNIT}>{catalogUnitLabel(item.unit)}</td>
                  <td className={TABLE_TD_COMPACT}>
                    <CatalogPriceTableCell cents={item.unit_cost_cents} emptyLabel="—" />
                  </td>
                  <td className={TABLE_TD_COMPACT}>
                    <CatalogPriceTableCell cents={item.unit_price_cents} />
                  </td>
                  <td className={TABLE_TD_COMPACT}>
                    <span className={proposalPillClass(item.customer_visibility)}>
                      {proposalLabel}
                    </span>
                  </td>
                  <td className={TABLE_TD_COMPACT}>
                    <span className={statusPillClass(item)}>{status}</span>
                  </td>
                  <td
                    className={`${TABLE_TD_ACTION} ${isSelected ? "bg-slate-50" : "bg-white group-hover:bg-slate-50/90"}`}
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
                        {isSelected ? "Close" : "Edit"}
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
