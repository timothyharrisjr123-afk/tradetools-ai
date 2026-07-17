"use client";

import {
  CATALOG_COMING_SOON_LABEL,
  CATALOG_FILTERS_SORT_LABEL,
  CATALOG_MANAGE_MENU_ITEMS,
  CATALOG_PLANNED_LABEL,
} from "@/app/lib/catalogContractorLabels";
import {
  CATALOG_OPTIONAL_COLUMNS,
  type CatalogOptionalColumnId,
  type CatalogOptionalColumnVisibility,
} from "@/app/lib/catalogColumnVisibility";
import { CATALOG_REORDER_UNAVAILABLE_COPY } from "@/app/lib/catalogReorder";
import {
  CATALOG_TYPE_FILTER_OPTIONS,
  COMMAND_CONTROL_ACTIVE,
  COMMAND_CONTROL_DISABLED,
  COMMAND_CONTROL_SOON_BADGE,
  COMMAND_MENU_PANEL,
  FILTER_CHIP_BASE,
  FILTER_CHIP_OFF,
  FILTER_CHIP_ON,
  FILTERS_SORT_TRIGGER,
  PRIMARY_BUTTON,
  TOOLBAR_INPUT,
  type CatalogItemTypeFilter,
} from "../catalogAdminConstants";

type CatalogItemToolbarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  itemTypeFilter: CatalogItemTypeFilter;
  onItemTypeFilterChange: (value: CatalogItemTypeFilter) => void;
  showInactive: boolean;
  onShowInactiveChange: () => void;
  hasListFilters: boolean;
  onClearFilters: () => void;
  filteredItemsCount: number;
  sortedItemsCount: number;
  needsPriceCount: number;
  filteredNeedsPriceCount: number;
  compactStatusLine: string | null;
  onAddItem: () => void;
  addDisabled: boolean;
  columnVisibility: CatalogOptionalColumnVisibility;
  columnPrefsReady?: boolean;
  onColumnVisibilityChange: (columnId: CatalogOptionalColumnId, visible: boolean) => void;
  onResetColumnVisibility: () => void;
  onDownloadCsvTemplate: () => void;
  onExportCsv: () => void;
  onUploadCsv: () => void;
  csvActionsDisabled?: boolean;
  reorderMode?: boolean;
  reorderAvailable?: boolean;
  onEnterReorder?: () => void;
};

export default function CatalogItemToolbar({
  searchQuery,
  onSearchChange,
  itemTypeFilter,
  onItemTypeFilterChange,
  showInactive,
  onShowInactiveChange,
  hasListFilters,
  onClearFilters,
  filteredItemsCount,
  sortedItemsCount,
  needsPriceCount,
  filteredNeedsPriceCount,
  compactStatusLine,
  onAddItem,
  addDisabled,
  columnVisibility,
  columnPrefsReady = true,
  onColumnVisibilityChange,
  onResetColumnVisibility,
  onDownloadCsvTemplate,
  onExportCsv,
  onUploadCsv,
  csvActionsDisabled = false,
  reorderMode = false,
  reorderAvailable = true,
  onEnterReorder,
}: CatalogItemToolbarProps) {
  const activeFilterLabel =
    CATALOG_TYPE_FILTER_OPTIONS.find((option) => option.value === itemTypeFilter)?.label ?? "All";
  const searchFiltersDisabled = reorderMode;

  return (
    <div
      className="border-b border-slate-200/90 bg-slate-50/40 px-3.5 py-3.5 sm:px-4"
      role="region"
      aria-label="Catalog command bar"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
          <label className="block min-w-0 flex-1 sm:max-w-[16rem] lg:max-w-[18rem]">
            <span className="sr-only">Search catalog</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search catalog…"
              className={TOOLBAR_INPUT}
              aria-label="Search catalog"
              disabled={searchFiltersDisabled}
            />
          </label>

          <details className="relative">
            <summary
              className={`${FILTERS_SORT_TRIGGER} list-none [&::-webkit-details-marker]:hidden ${searchFiltersDisabled ? "pointer-events-none opacity-50" : ""}`}
            >
              <span>{CATALOG_FILTERS_SORT_LABEL}</span>
              <span className="font-medium text-slate-500">· {activeFilterLabel}</span>
              {showInactive ? (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  Inactive
                </span>
              ) : null}
            </summary>
            <div
              className="absolute left-0 z-20 mt-1.5 w-[min(100vw-2rem,18rem)] rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
              role="group"
              aria-label="Catalog filters"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Type
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CATALOG_TYPE_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onItemTypeFilterChange(option.value)}
                    className={`${FILTER_CHIP_BASE} ${
                      itemTypeFilter === option.value ? FILTER_CHIP_ON : FILTER_CHIP_OFF
                    }`}
                    aria-pressed={itemTypeFilter === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={onShowInactiveChange}
                  className={`${FILTER_CHIP_BASE} ${showInactive ? FILTER_CHIP_ON : FILTER_CHIP_OFF}`}
                  aria-pressed={showInactive}
                >
                  Show inactive
                </button>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Sort
                </p>
                <span
                  className={`${COMMAND_CONTROL_DISABLED} mt-2`}
                  aria-disabled="true"
                  title={`Sort — ${CATALOG_COMING_SOON_LABEL}`}
                >
                  <span>Sort options</span>
                  <span className={COMMAND_CONTROL_SOON_BADGE}>{CATALOG_COMING_SOON_LABEL}</span>
                </span>
              </div>
              {hasListFilters ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="mt-3 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </details>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Catalog tools"
          >
            <button
              type="button"
              className={COMMAND_CONTROL_ACTIVE}
              title={
                reorderMode
                  ? "Reorder mode is active"
                  : reorderAvailable
                    ? "Reorder Catalog display order"
                    : CATALOG_REORDER_UNAVAILABLE_COPY
              }
              data-catalog-command="reorder"
              data-catalog-reorder-available={reorderAvailable ? "true" : "false"}
              disabled={reorderMode || !onEnterReorder}
              onClick={() => onEnterReorder?.()}
            >
              <span>Re-order items</span>
            </button>

            <details className="relative" data-catalog-columns-menu>
              <summary className={COMMAND_CONTROL_ACTIVE} aria-label="Columns">
                <span>Columns</span>
              </summary>
              <div className={COMMAND_MENU_PANEL} role="group" aria-label="Catalog columns">
                <p className="px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Show columns
                </p>
                <p className="mb-2 px-1.5 text-[11px] leading-relaxed text-slate-500">
                  Name and Actions always stay visible. Coverage, waste, and tax stay on the item
                  detail panel.
                </p>
                <ul className="space-y-0.5">
                  {CATALOG_OPTIONAL_COLUMNS.map((col) => {
                    const checked = columnVisibility[col.id] !== false;
                    return (
                      <li key={col.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                            checked={checked}
                            disabled={!columnPrefsReady}
                            onChange={(e) => onColumnVisibilityChange(col.id, e.target.checked)}
                            data-catalog-column-toggle={col.id}
                          />
                          <span>{col.label}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={onResetColumnVisibility}
                  className="mt-2 w-full rounded-md px-1.5 py-1.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  data-catalog-columns-reset
                >
                  Reset columns
                </button>
              </div>
            </details>

            <details className="relative" data-catalog-manage-menu>
              <summary className={COMMAND_CONTROL_ACTIVE} aria-label="Manage catalog">
                <span>Manage catalog</span>
              </summary>
              <div
                className={COMMAND_MENU_PANEL}
                role="menu"
                aria-label="Manage catalog menu"
              >
                <p className="px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Manage catalog
                </p>
                <ul className="space-y-0.5">
                  {CATALOG_MANAGE_MENU_ITEMS.map((item) => {
                    const isLive = item.status === "live";
                    if (isLive) {
                      const onClick =
                        item.id === "download_template"
                          ? onDownloadCsvTemplate
                          : item.id === "download_csv"
                            ? onExportCsv
                            : item.id === "upload_csv"
                              ? onUploadCsv
                              : item.id === "reorder"
                                ? onEnterReorder
                                : undefined;
                      const disabled =
                        item.id === "reorder"
                          ? reorderMode || !onClick
                          : csvActionsDisabled || !onClick;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="flex w-full items-start justify-between gap-2 rounded-md px-1.5 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title={
                              item.id === "reorder" && !reorderAvailable
                                ? CATALOG_REORDER_UNAVAILABLE_COPY
                                : item.detail
                            }
                            role="menuitem"
                            data-catalog-manage-item={item.id}
                            data-catalog-manage-status="live"
                            disabled={disabled}
                            onClick={() => onClick?.()}
                          >
                            <span className="min-w-0">
                              <span className="block font-medium text-slate-900">{item.label}</span>
                              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                                {item.id === "reorder" && !reorderAvailable
                                  ? CATALOG_REORDER_UNAVAILABLE_COPY
                                  : item.detail}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    }
                    return (
                      <li key={item.id}>
                        <span
                          className="flex cursor-not-allowed select-none items-start justify-between gap-2 rounded-md px-1.5 py-1.5 text-sm text-slate-500"
                          aria-disabled="true"
                          title={item.detail}
                          role="menuitem"
                          data-catalog-manage-item={item.id}
                          data-catalog-manage-status="planned"
                        >
                          <span className="min-w-0">
                            <span className="block font-medium text-slate-600">{item.label}</span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
                              {item.detail}
                            </span>
                          </span>
                          <span className={`${COMMAND_CONTROL_SOON_BADGE} shrink-0`}>
                            {CATALOG_PLANNED_LABEL}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 border-t border-slate-100 px-1.5 pt-2 text-[11px] leading-relaxed text-slate-500">
                  CSV v1 and Catalog reorder are live. Supplier sync, Jumpstart, and the Manage
                  bulk-purchase-tax shortcut remain planned (use selection bulk bar for purchase tax).
                </p>
              </div>
            </details>
          </div>
          <button type="button" onClick={onAddItem} disabled={addDisabled} className={PRIMARY_BUTTON}>
            Add catalog item
          </button>
        </div>
      </div>
      <p className="mt-2.5 text-xs text-slate-500">
        <span className="font-medium text-slate-700">
          Showing {filteredItemsCount} of {sortedItemsCount}{" "}
          {showInactive ? "items" : "active items"}
        </span>
        {compactStatusLine ? (
          <>
            {" "}
            · <span className="text-slate-600">{compactStatusLine}</span>
          </>
        ) : null}
        {hasListFilters &&
          filteredNeedsPriceCount > 0 &&
          filteredNeedsPriceCount !== needsPriceCount && (
            <>
              {" "}
              · <span className="text-amber-800">{filteredNeedsPriceCount} need price</span> in
              this view
            </>
          )}
      </p>
    </div>
  );
}
