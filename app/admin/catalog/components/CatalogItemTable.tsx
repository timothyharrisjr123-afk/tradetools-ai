import { Fragment } from "react";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  catalogItemTypeLabel,
  catalogUnitLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import {
  TABLE_COLUMN_COUNT,
  TABLE_TD,
  TABLE_TD_COMPACT,
  TABLE_TD_NAME,
  TABLE_TD_UNIT,
  TABLE_TD_WIDE,
  TABLE_TH,
  TABLE_TH_COMPACT,
  TABLE_TH_WIDE,
} from "../catalogAdminConstants";
import { extractSeedKey } from "../catalogAdminUtils";
import CatalogPriceTableCell from "./CatalogPriceTableCell";

export type CatalogItemTableSection = {
  key: string;
  label: string;
  items: CatalogItem[];
};

type CatalogItemTableProps = {
  groupedFilteredItems: CatalogItemTableSection[];
  groupByItemType: boolean;
  selectedItemId: string | null;
  savingItemId: string | null;
  togglingActiveId: string | null;
  busy: boolean;
  onEditToggle: (item: CatalogItem) => void;
  onToggleActive: (item: CatalogItem) => void;
};

export default function CatalogItemTable({
  groupedFilteredItems,
  groupByItemType,
  selectedItemId,
  savingItemId,
  togglingActiveId,
  busy,
  onEditToggle,
  onToggleActive,
}: CatalogItemTableProps) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/40 p-2 sm:p-3">
      <table className="w-full min-w-[76rem] table-auto text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100/80 text-left">
            <th className={TABLE_TH_WIDE}>Name</th>
            <th className={TABLE_TH_WIDE}>Customer name</th>
            <th className={TABLE_TH}>Type</th>
            <th className={TABLE_TH}>Unit</th>
            <th className={TABLE_TH_WIDE}>Quantity source</th>
            <th className={TABLE_TH_COMPACT}>Unit price</th>
            <th className={TABLE_TH_COMPACT}>Unit cost</th>
            <th className={TABLE_TH_COMPACT}>Active</th>
            <th className={TABLE_TH_WIDE}>Seed key</th>
            <th className={TABLE_TH_COMPACT}>Sort</th>
            <th className={TABLE_TH_COMPACT}>Action</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {groupedFilteredItems.map((section) => (
            <Fragment key={section.key}>
              {groupByItemType && section.label ? (
                <tr className="border-b border-slate-200 bg-slate-100/70">
                  <td
                    colSpan={TABLE_COLUMN_COUNT}
                    className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {section.label}
                    <span className="ml-2 font-normal normal-case text-slate-500">
                      ({section.items.length})
                    </span>
                  </td>
                </tr>
              ) : null}
              {section.items.map((item) => {
                const seedKey = extractSeedKey(item.metadata ?? null);
                const isSelected = selectedItemId === item.id;
                const isSaving = savingItemId === item.id;
                const isTogglingActive = togglingActiveId === item.id;

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${isSelected ? "bg-cyan-50/60 ring-1 ring-inset ring-cyan-200" : ""} ${!item.active ? "bg-slate-50/60 opacity-75" : ""}`}
                  >
                    <td className={TABLE_TD_NAME}>
                      {item.name}
                      {!item.active && (
                        <span className="ml-2 inline-block rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className={TABLE_TD_WIDE}>{item.customer_name?.trim() || "—"}</td>
                    <td className={TABLE_TD}>{catalogItemTypeLabel(item.item_type)}</td>
                    <td className={TABLE_TD_UNIT}>{catalogUnitLabel(item.unit)}</td>
                    <td className={`${TABLE_TD_WIDE} lg:whitespace-nowrap`}>
                      {quantitySourceLabel(item.quantity_source)}
                    </td>
                    <td className={TABLE_TD_COMPACT}>
                      <CatalogPriceTableCell cents={item.unit_price_cents} />
                    </td>
                    <td className={TABLE_TD_COMPACT}>
                      <CatalogPriceTableCell cents={item.unit_cost_cents} />
                    </td>
                    <td className={TABLE_TD_COMPACT}>
                      <span
                        className={
                          item.active
                            ? "text-emerald-700 font-medium"
                            : "text-slate-500 font-medium"
                        }
                      >
                        {item.active ? "Yes" : "No"}
                      </span>
                    </td>
                    <td
                      className={`${TABLE_TD_WIDE} font-mono text-xs text-slate-600 lg:whitespace-nowrap`}
                    >
                      {seedKey ?? "—"}
                    </td>
                    <td className={`${TABLE_TD_COMPACT} tabular-nums`}>
                      {item.sort_order != null ? item.sort_order : "—"}
                    </td>
                    <td className={TABLE_TD_COMPACT}>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => onEditToggle(item)}
                          disabled={
                            isSaving ||
                            isTogglingActive ||
                            (savingItemId != null && !isSaving)
                          }
                          className="text-sm font-semibold text-cyan-700 hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSelected ? "Close" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleActive(item)}
                          disabled={busy && !isTogglingActive}
                          className="text-left text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isTogglingActive ? "…" : item.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
