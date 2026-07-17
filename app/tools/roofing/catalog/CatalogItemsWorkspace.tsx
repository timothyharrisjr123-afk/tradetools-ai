"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { InstallDefaultRoofingCatalogResult } from "@/app/lib/defaultRoofingCatalogInstall";
import {
  CATALOG_COLUMN_PREFS_STORAGE_KEY,
  defaultCatalogOptionalColumnVisibility,
  normalizeCatalogOptionalColumnVisibility,
  parseCatalogOptionalColumnVisibilityJson,
  serializeCatalogOptionalColumnVisibility,
  type CatalogOptionalColumnId,
  type CatalogOptionalColumnVisibility,
} from "@/app/lib/catalogColumnVisibility";
import AddCatalogItemModal from "@/app/admin/catalog/components/AddCatalogItemModal";
import CatalogItemDetailPanel from "@/app/admin/catalog/components/CatalogItemDetailPanel";
import CatalogItemTable from "@/app/admin/catalog/components/CatalogItemTable";
import CatalogItemToolbar from "@/app/admin/catalog/components/CatalogItemToolbar";
import {
  CATALOG_SURFACE_CARD,
  PRIMARY_BUTTON,
  type CatalogItemTypeFilter,
} from "@/app/admin/catalog/catalogAdminConstants";
import CatalogInstallFeedback from "./CatalogInstallFeedback";
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
  needsPriceCount: number;
  compactStatusLine: string | null;
  showEmptyInstall: boolean;
  starterInstalled: boolean;
  installing: boolean;
  installResult: InstallDefaultRoofingCatalogResult | null;
  onInstallStarter: () => void;
  showInactive: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  itemTypeFilter: CatalogItemTypeFilter;
  onItemTypeFilterChange: (value: CatalogItemTypeFilter) => void;
  onShowInactiveChange: () => void;
  hasListFilters: boolean;
  onClearFilters: () => void;
  filteredItemsCount: number;
  sortedItemsCount: number;
  filteredNeedsPriceCount: number;
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
  needsPriceCount,
  compactStatusLine,
  showEmptyInstall,
  starterInstalled,
  installing,
  installResult,
  onInstallStarter,
  showInactive,
  searchQuery,
  onSearchChange,
  itemTypeFilter,
  onItemTypeFilterChange,
  onShowInactiveChange,
  hasListFilters,
  onClearFilters,
  filteredItemsCount,
  sortedItemsCount,
  filteredNeedsPriceCount,
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
  const [columnVisibility, setColumnVisibility] = useState<CatalogOptionalColumnVisibility>(
    defaultCatalogOptionalColumnVisibility
  );
  const [columnPrefsHydrated, setColumnPrefsHydrated] = useState(false);

  // Hydrate before paint so toggles are not overwritten by a late localStorage read.
  useLayoutEffect(() => {
    try {
      setColumnVisibility(
        parseCatalogOptionalColumnVisibilityJson(
          window.localStorage.getItem(CATALOG_COLUMN_PREFS_STORAGE_KEY)
        )
      );
    } catch {
      setColumnVisibility(defaultCatalogOptionalColumnVisibility());
    }
    setColumnPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!columnPrefsHydrated) return;
    try {
      window.localStorage.setItem(
        CATALOG_COLUMN_PREFS_STORAGE_KEY,
        serializeCatalogOptionalColumnVisibility(columnVisibility)
      );
    } catch {
      // Ignore quota / private-mode write failures — in-memory prefs still work.
    }
  }, [columnVisibility, columnPrefsHydrated]);

  const handleColumnVisibilityChange = (
    columnId: CatalogOptionalColumnId,
    visible: boolean
  ) => {
    setColumnVisibility((prev) =>
      normalizeCatalogOptionalColumnVisibility({ ...prev, [columnId]: visible })
    );
  };

  const handleResetColumnVisibility = () => {
    setColumnVisibility(defaultCatalogOptionalColumnVisibility());
  };

  return (
    <div id="catalog-configure-items" className="space-y-3">
      <div className={CATALOG_SURFACE_CARD}>
        <CatalogItemToolbar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          itemTypeFilter={itemTypeFilter}
          onItemTypeFilterChange={onItemTypeFilterChange}
          showInactive={showInactive}
          onShowInactiveChange={onShowInactiveChange}
          hasListFilters={hasListFilters}
          onClearFilters={onClearFilters}
          filteredItemsCount={filteredItemsCount}
          sortedItemsCount={sortedItemsCount}
          needsPriceCount={needsPriceCount}
          filteredNeedsPriceCount={filteredNeedsPriceCount}
          compactStatusLine={compactStatusLine}
          onAddItem={onAddItem}
          addDisabled={busy}
          columnVisibility={columnVisibility}
          columnPrefsReady={columnPrefsHydrated}
          onColumnVisibilityChange={handleColumnVisibilityChange}
          onResetColumnVisibility={handleResetColumnVisibility}
        />

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">Loading catalog items…</div>
        ) : showEmptyInstall ? (
          <div className="border-t border-dashed border-slate-200 px-5 py-12 text-center">
            <p className="text-sm font-semibold text-slate-900">No catalog items yet</p>
            <p className="mt-2 text-sm text-slate-600">
              Start with common roofing materials, labor, and fees.
            </p>
            <button
              type="button"
              onClick={onInstallStarter}
              disabled={busy}
              className={`${PRIMARY_BUTTON} mt-5`}
            >
              {installing
                ? "Installing…"
                : starterInstalled
                  ? "Recheck starter catalog"
                  : "Install starter catalog"}
            </button>
            {showInactive ? (
              <p className="mt-3 text-xs text-slate-500">
                Turn on Show inactive to see deactivated rows, or add a custom item.
              </p>
            ) : null}
            {installResult ? (
              <div className="mx-auto mt-4 max-w-md text-left">
                <CatalogInstallFeedback result={installResult} />
              </div>
            ) : null}
          </div>
        ) : sortedItems.length > 0 && filteredItems.length === 0 ? (
          <div className="border-t border-dashed border-slate-200 px-5 py-10 text-center">
            <p className="text-sm font-semibold text-slate-800">No matching catalog items</p>
            <p className="mt-2 text-xs text-slate-500">Try a different search term or filter.</p>
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
        ) : (
          <CatalogItemTable
            groupedFilteredItems={groupedFilteredItems}
            selectedItemId={editingItemId}
            savingItemId={savingItemId}
            togglingActiveId={togglingActiveId}
            busy={busy}
            columnVisibility={columnVisibility}
            onEditToggle={onEditToggle}
            onToggleActive={onToggleActive}
          />
        )}
      </div>

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

      <AddCatalogItemModal
        open={addModalOpen}
        form={addForm}
        error={addError}
        creatingItem={creatingItem}
        onChange={onAddFormChange}
        onClose={onCloseAddModal}
        onSubmit={onSubmitAdd}
      />
    </div>
  );
}
