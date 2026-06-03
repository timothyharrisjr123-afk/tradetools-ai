import {
  CATALOG_TYPE_FILTER_OPTIONS,
  FILTER_CHIP_BASE,
  FILTER_CHIP_OFF,
  FILTER_CHIP_ON,
  TOOLBAR_INPUT,
  type CatalogItemTypeFilter,
} from "../catalogAdminConstants";

type CatalogItemToolbarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  itemTypeFilter: CatalogItemTypeFilter;
  onItemTypeFilterChange: (value: CatalogItemTypeFilter) => void;
  unpricedOnly: boolean;
  onUnpricedOnlyChange: () => void;
  showInactive: boolean;
  onShowInactiveChange: () => void;
  hasListFilters: boolean;
  onClearFilters: () => void;
  groupByItemType: boolean;
  filteredItemsCount: number;
  sortedItemsCount: number;
  unpricedCount: number;
  filteredUnpricedCount: number;
};

export default function CatalogItemToolbar({
  searchQuery,
  onSearchChange,
  itemTypeFilter,
  onItemTypeFilterChange,
  unpricedOnly,
  onUnpricedOnlyChange,
  showInactive,
  onShowInactiveChange,
  hasListFilters,
  onClearFilters,
  groupByItemType,
  filteredItemsCount,
  sortedItemsCount,
  unpricedCount,
  filteredUnpricedCount,
}: CatalogItemToolbarProps) {
  return (
    <div
      className="mt-5 rounded-lg border border-slate-200 bg-slate-50/50 p-4"
      role="region"
      aria-label="Catalog item filters"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <label className="block min-w-0 flex-1">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search catalog
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Name, customer label, seed key, type, unit, quantity source…"
            className={TOOLBAR_INPUT}
            aria-label="Search catalog items"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onUnpricedOnlyChange}
            className={`${FILTER_CHIP_BASE} ${unpricedOnly ? FILTER_CHIP_ON : FILTER_CHIP_OFF}`}
            aria-pressed={unpricedOnly}
          >
            Unpriced only
          </button>
          <button
            type="button"
            onClick={onShowInactiveChange}
            className={`${FILTER_CHIP_BASE} ${showInactive ? FILTER_CHIP_ON : FILTER_CHIP_OFF}`}
            aria-pressed={showInactive}
          >
            Show inactive
          </button>
          {hasListFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className={`${FILTER_CHIP_BASE} ${FILTER_CHIP_OFF}`}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by item type">
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
      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-800">
          Showing {filteredItemsCount} of {sortedItemsCount}{" "}
          {showInactive ? "items" : "active items"}
        </span>
        {unpricedCount > 0 && (
          <>
            {" "}
            · <span className="text-amber-800">{unpricedCount} unpriced</span> in catalog
          </>
        )}
        {hasListFilters && filteredUnpricedCount > 0 && filteredUnpricedCount !== unpricedCount && (
          <>
            {" "}
            · <span className="text-amber-800">{filteredUnpricedCount} unpriced</span> in this view
          </>
        )}
        {groupByItemType && filteredItemsCount > 0 && <> · Grouped by type</>}
      </p>
    </div>
  );
}
