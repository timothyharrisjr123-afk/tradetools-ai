"use client";

import { useMemo, useState } from "react";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  catalogItemTypeLabel,
  catalogUnitLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import {
  TEMPLATE_ADD_FROM_CATALOG_LABEL,
  TEMPLATE_RELINK_CATALOG_LABEL,
  formatCatalogPickerPriceLine,
  listActiveCatalogItemsForPicker,
} from "@/app/lib/proposalTemplateCatalogLink";
import { formatProposalVisibilityShort } from "@/app/lib/catalogContractorLabels";

export type TemplatesCatalogPickerMode = "add" | "relink";

type TemplatesCatalogItemPickerModalProps = {
  open: boolean;
  mode: TemplatesCatalogPickerMode;
  catalogItems: readonly CatalogItem[];
  excludeCatalogItemIds?: ReadonlySet<string>;
  busy: boolean;
  onClose: () => void;
  onSelect: (catalogItem: CatalogItem) => void;
};

export default function TemplatesCatalogItemPickerModal({
  open,
  mode,
  catalogItems,
  excludeCatalogItemIds,
  busy,
  onClose,
  onSelect,
}: TemplatesCatalogItemPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const activeRows = useMemo(
    () =>
      listActiveCatalogItemsForPicker(catalogItems, {
        searchQuery,
        excludeCatalogItemIds,
      }),
    [catalogItems, searchQuery, excludeCatalogItemIds]
  );

  if (!open) return null;

  const title = mode === "relink" ? TEMPLATE_RELINK_CATALOG_LABEL : TEMPLATE_ADD_FROM_CATALOG_LABEL;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="templates-catalog-picker-title"
      data-templates-catalog-picker
      data-templates-catalog-picker-mode={mode}
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2
            id="templates-catalog-picker-title"
            className="text-lg font-semibold text-slate-900"
          >
            {title}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Prices come from Catalog. Only active items can be added.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Inactive Catalog items are hidden from this list.
          </p>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <label className="block">
            <span className="sr-only">Search catalog items</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active catalog items…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              aria-label="Search catalog items"
              disabled={busy}
              data-templates-catalog-picker-search
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {activeRows.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-slate-500">
              No active Catalog items match. Add or reactivate items in Catalog setup.
            </p>
          ) : (
            <ul className="space-y-1" role="listbox" aria-label="Active catalog items">
              {activeRows.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSelect(item)}
                    className="flex w-full flex-col items-start rounded-md px-3 py-2.5 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    data-templates-catalog-picker-item={item.id}
                  >
                    <span className="text-sm font-semibold text-slate-900">{item.name}</span>
                    <span className="mt-0.5 text-xs text-slate-500">
                      {catalogItemTypeLabel(item.item_type)} · {catalogUnitLabel(item.unit)} ·{" "}
                      {quantitySourceLabel(item.quantity_source)}
                    </span>
                    <span className="mt-0.5 text-xs tabular-nums text-slate-600">
                      {formatCatalogPickerPriceLine(item)} · Proposal{" "}
                      {formatProposalVisibilityShort(item.customer_visibility)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
