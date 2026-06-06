"use client";

import type { CatalogItem } from "@/app/lib/catalogTypes";
import AddCatalogItemModal from "@/app/admin/catalog/components/AddCatalogItemModal";
import CatalogItemDetailPanel from "@/app/admin/catalog/components/CatalogItemDetailPanel";
import CatalogItemTable from "@/app/admin/catalog/components/CatalogItemTable";
import CatalogItemToolbar from "@/app/admin/catalog/components/CatalogItemToolbar";
import { PRIMARY_BUTTON, type CatalogItemTypeFilter } from "@/app/admin/catalog/catalogAdminConstants";
import { CATALOG_ITEMS_SECTION } from "./catalogConstants";
import type {
  AddCatalogItemForm,
  CatalogItemEditDraft,
} from "@/app/admin/catalog/catalogAdminUtils";

type GroupedSection = {
  key: string;
  label: string;
  items: CatalogItem[];
};

type CatalogItemsWorkspaceProps = {
  loading: boolean;
  busy: boolean;
  unpricedCount: number;
  showInactive: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  itemTypeFilter: CatalogItemTypeFilter;
  onItemTypeFilterChange: (value: CatalogItemTypeFilter) => void;
  unpricedOnly: boolean;
  onUnpricedOnlyChange: () => void;
  onShowInactiveChange: () => void;
  hasListFilters: boolean;
  onClearFilters: () => void;
  groupByItemType: boolean;
  filteredItemsCount: number;
  sortedItemsCount: number;
  filteredUnpricedCount: number;
  sortedItems: CatalogItem[];
  filteredItems: CatalogItem[];
  groupedFilteredItems: GroupedSection[];
  editingItem: CatalogItem | null | undefined;
  editingItemId: string | null;
  editDraft: CatalogItemEditDraft | null;
  editError: string | null;
  savingItemId: string | null;
  togglingActiveId: string | null;
  onEditToggle: (item: CatalogItem) => void;
  onToggleActive: (item: CatalogItem) => void;
  onDraftChange: <K extends keyof CatalogItemEditDraft>(
    key: K,
    value: CatalogItemEditDraft[K]
  ) => void;
  onSaveItem: () => void;
  onCloseEditor: () => void;
  onAddItem: () => void;
  addModalOpen: boolean;
  addForm: AddCatalogItemForm;
  addError: string | null;
  creatingItem: boolean;
  onAddFormChange: <K extends keyof AddCatalogItemForm>(
    key: K,
    value: AddCatalogItemForm[K]
  ) => void;
  onCloseAddModal: () => void;
  onSubmitAdd: () => void;
};

export default function CatalogItemsWorkspace({
  loading,
  busy,
  unpricedCount,
  showInactive,
  searchQuery,
  onSearchChange,
  itemTypeFilter,
  onItemTypeFilterChange,
  unpricedOnly,
  onUnpricedOnlyChange,
  onShowInactiveChange,
  hasListFilters,
  onClearFilters,
  groupByItemType,
  filteredItemsCount,
  sortedItemsCount,
  filteredUnpricedCount,
  sortedItems,
  filteredItems,
  groupedFilteredItems,
  editingItem,
  editingItemId,
  editDraft,
  editError,
  savingItemId,
  togglingActiveId,
  onEditToggle,
  onToggleActive,
  onDraftChange,
  onSaveItem,
  onCloseEditor,
  onAddItem,
  addModalOpen,
  addForm,
  addError,
  creatingItem,
  onAddFormChange,
  onCloseAddModal,
  onSubmitAdd,
}: CatalogItemsWorkspaceProps) {
  return (
    <section id="catalog-configure-items" className={CATALOG_ITEMS_SECTION}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">Catalog items</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Company price book rows for templates and proposals. Edit customer-facing names,
            descriptions, and unit prices here — catalog setup only.
          </p>
        </div>
        <button type="button" onClick={onAddItem} disabled={busy} className={PRIMARY_BUTTON}>
          Add catalog item
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Pricing updates catalog setup only — no estimator or pricing engine bridge yet. Structural
        fields (unit, quantity source) stay read-only until a later pass.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading catalog items…</p>
      ) : (
        <>
          <CatalogItemToolbar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            itemTypeFilter={itemTypeFilter}
            onItemTypeFilterChange={onItemTypeFilterChange}
            unpricedOnly={unpricedOnly}
            onUnpricedOnlyChange={onUnpricedOnlyChange}
            showInactive={showInactive}
            onShowInactiveChange={onShowInactiveChange}
            hasListFilters={hasListFilters}
            onClearFilters={onClearFilters}
            groupByItemType={groupByItemType}
            filteredItemsCount={filteredItemsCount}
            sortedItemsCount={sortedItemsCount}
            unpricedCount={unpricedCount}
            filteredUnpricedCount={filteredUnpricedCount}
          />

          {sortedItems.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-800">No catalog items yet</p>
              <p className="mt-2 text-xs text-slate-500">
                {showInactive
                  ? "Install the starter roofing catalog or add a custom item."
                  : "Install the starter roofing catalog or add a custom item. Turn on Show inactive to see deactivated rows."}
              </p>
            </div>
          ) : null}

          {sortedItems.length > 0 && filteredItems.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-800">No matching catalog items</p>
              <p className="mt-2 text-xs text-slate-500">
                Try a different search term or loosen type / unpriced filters.
              </p>
              {hasListFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : sortedItems.length > 0 ? (
            <>
              <CatalogItemTable
                groupedFilteredItems={groupedFilteredItems}
                groupByItemType={groupByItemType}
                selectedItemId={editingItemId}
                savingItemId={savingItemId}
                togglingActiveId={togglingActiveId}
                busy={busy}
                onEditToggle={onEditToggle}
                onToggleActive={onToggleActive}
              />
              {editingItem && editDraft ? (
                <CatalogItemDetailPanel
                  item={editingItem}
                  editDraft={editDraft}
                  editError={editError}
                  isSaving={savingItemId === editingItem.id}
                  isTogglingActive={togglingActiveId === editingItem.id}
                  onDraftChange={onDraftChange}
                  onSave={onSaveItem}
                  onClose={onCloseEditor}
                  onToggleActive={() => onToggleActive(editingItem)}
                />
              ) : null}
            </>
          ) : null}
        </>
      )}

      <AddCatalogItemModal
        open={addModalOpen}
        form={addForm}
        error={addError}
        creatingItem={creatingItem}
        onChange={onAddFormChange}
        onClose={onCloseAddModal}
        onSubmit={onSubmitAdd}
      />
    </section>
  );
}
