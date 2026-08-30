"use client";

import Link from "next/link";
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
import CatalogBulkActionBar from "@/app/admin/catalog/components/CatalogBulkActionBar";
import CatalogBulkPurchaseTaxModal from "@/app/admin/catalog/components/CatalogBulkPurchaseTaxModal";
import CatalogCsvImportModal from "@/app/admin/catalog/components/CatalogCsvImportModal";
import CatalogItemDetailPanel from "@/app/admin/catalog/components/CatalogItemDetailPanel";
import CatalogItemTable from "@/app/admin/catalog/components/CatalogItemTable";
import CatalogItemToolbar from "@/app/admin/catalog/components/CatalogItemToolbar";
import CatalogReorderBar from "@/app/admin/catalog/components/CatalogReorderBar";
import {
  CATALOG_SURFACE_CARD,
  PRIMARY_BUTTON,
  type CatalogItemTypeFilter,
} from "@/app/admin/catalog/catalogAdminConstants";
import type {
  CatalogBulkLiveActionId,
  CatalogBulkPurchaseTaxMode,
} from "@/app/lib/catalogBulkActions";
import type { CatalogReorderDirection } from "@/app/lib/catalogReorder";
import type { CatalogCsvAnalyzeResult } from "@/app/lib/catalogCsv";
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
  /** When true, show action-backed next step to Templates (not Create proposal). */
  catalogReadyForTemplates?: boolean;
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
  selectedIds: ReadonlySet<string>;
  bulkBusy: boolean;
  onToggleRowSelect: (itemId: string) => void;
  onToggleSelectAllVisible: () => void;
  onClearSelection: () => void;
  onBulkLiveAction: (actionId: CatalogBulkLiveActionId) => void;
  purchaseTaxModalOpen: boolean;
  purchaseTaxMode: CatalogBulkPurchaseTaxMode;
  purchaseTaxRateInput: string;
  purchaseTaxError: string | null;
  onPurchaseTaxModeChange: (mode: CatalogBulkPurchaseTaxMode) => void;
  onPurchaseTaxRateInputChange: (value: string) => void;
  onClosePurchaseTaxModal: () => void;
  onConfirmPurchaseTax: () => void;
  reorderMode: boolean;
  reorderAvailable: boolean;
  reorderDirty: boolean;
  reorderBusy: boolean;
  onEnterReorder: () => void;
  onCancelReorder: () => void;
  onSaveReorder: () => void;
  onReorderMove: (itemId: string, direction: CatalogReorderDirection) => void;
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
  onDownloadCsvTemplate: () => void;
  onExportCsv: () => void;
  onUploadCsv: () => void;
  csvActionsDisabled?: boolean;
  csvImportOpen: boolean;
  csvFileName: string | null;
  csvAnalyzing: boolean;
  csvImporting: boolean;
  csvAnalysis: CatalogCsvAnalyzeResult | null;
  csvImportError: string | null;
  csvImportSuccess: string | null;
  onCloseCsvImport: () => void;
  onPickCsvFile: (file: File) => void;
  onClearCsvFile: () => void;
  onConfirmCsvImport: () => void;
};

export default function CatalogItemsWorkspace({
  loading,
  busy,
  needsPriceCount,
  compactStatusLine,
  catalogReadyForTemplates = false,
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
  selectedIds,
  bulkBusy,
  onToggleRowSelect,
  onToggleSelectAllVisible,
  onClearSelection,
  onBulkLiveAction,
  purchaseTaxModalOpen,
  purchaseTaxMode,
  purchaseTaxRateInput,
  purchaseTaxError,
  onPurchaseTaxModeChange,
  onPurchaseTaxRateInputChange,
  onClosePurchaseTaxModal,
  onConfirmPurchaseTax,
  reorderMode,
  reorderAvailable,
  reorderDirty,
  reorderBusy,
  onEnterReorder,
  onCancelReorder,
  onSaveReorder,
  onReorderMove,
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
  onDownloadCsvTemplate,
  onExportCsv,
  onUploadCsv,
  csvActionsDisabled = false,
  csvImportOpen,
  csvFileName,
  csvAnalyzing,
  csvImporting,
  csvAnalysis,
  csvImportError,
  csvImportSuccess,
  onCloseCsvImport,
  onPickCsvFile,
  onClearCsvFile,
  onConfirmCsvImport,
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
      {catalogReadyForTemplates && !showEmptyInstall ? (
        <div
          className="flex flex-col gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          data-catalog-next-templates
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Catalog ready for templates</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Next: link these items in Templates. Create proposals from a Job Card after
              the template is ready — not from Catalog.
            </p>
          </div>
          <Link
            href="/tools/roofing/templates"
            className={`${PRIMARY_BUTTON} shrink-0`}
            data-catalog-open-templates
          >
            Open Templates
          </Link>
        </div>
      ) : null}
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
          columnVisibility={columnVisibility}
          columnPrefsReady={columnPrefsHydrated}
          onColumnVisibilityChange={handleColumnVisibilityChange}
          onResetColumnVisibility={handleResetColumnVisibility}
          onDownloadCsvTemplate={onDownloadCsvTemplate}
          onExportCsv={onExportCsv}
          onUploadCsv={onUploadCsv}
          csvActionsDisabled={csvActionsDisabled || busy || reorderMode}
          reorderMode={reorderMode}
          reorderAvailable={reorderAvailable}
          onEnterReorder={onEnterReorder}
          addDisabled={busy || reorderMode}
        />

        <CatalogReorderBar
          active={reorderMode}
          available={reorderAvailable}
          dirty={reorderDirty}
          busy={reorderBusy || busy}
          itemCount={filteredItemsCount}
          onCancel={onCancelReorder}
          onSave={onSaveReorder}
        />

        {!reorderMode ? (
          <CatalogBulkActionBar
            selectedCount={selectedIds.size}
            busy={busy || bulkBusy}
            onClearSelection={onClearSelection}
            onLiveAction={onBulkLiveAction}
          />
        ) : null}

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
            {!showInactive ? (
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
            selectedIds={selectedIds}
            savingItemId={savingItemId}
            togglingActiveId={togglingActiveId}
            busy={busy || bulkBusy || reorderBusy}
            columnVisibility={columnVisibility}
            reorderMode={reorderMode}
            onEditToggle={onEditToggle}
            onToggleActive={onToggleActive}
            onToggleRowSelect={onToggleRowSelect}
            onToggleSelectAllVisible={onToggleSelectAllVisible}
            onReorderMove={onReorderMove}
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

      <CatalogCsvImportModal
        open={csvImportOpen}
        fileName={csvFileName}
        analyzing={csvAnalyzing}
        importing={csvImporting}
        analysis={csvAnalysis}
        importError={csvImportError}
        importSuccess={csvImportSuccess}
        onClose={onCloseCsvImport}
        onPickFile={onPickCsvFile}
        onClearFile={onClearCsvFile}
        onConfirmImport={onConfirmCsvImport}
      />

      <CatalogBulkPurchaseTaxModal
        open={purchaseTaxModalOpen}
        selectedCount={selectedIds.size}
        mode={purchaseTaxMode}
        rateInput={purchaseTaxRateInput}
        error={purchaseTaxError}
        busy={bulkBusy}
        onModeChange={onPurchaseTaxModeChange}
        onRateInputChange={onPurchaseTaxRateInputChange}
        onClose={onClosePurchaseTaxModal}
        onConfirm={onConfirmPurchaseTax}
      />
    </div>
  );
}
