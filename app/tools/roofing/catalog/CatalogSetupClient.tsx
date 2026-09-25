"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  countUnpricedCatalogItems,
  deriveCatalogReadiness,
} from "@/app/lib/catalogReadiness";
import {
  analyzeCatalogCsv,
  applyCatalogCsvImport,
  buildCatalogCsvExport,
  buildCatalogCsvTemplate,
  downloadCatalogCsvFile,
  type CatalogCsvAnalyzeResult,
} from "@/app/lib/catalogCsv";
import {
  applyCatalogBulkAction,
  applyCatalogBulkPurchaseTax,
  formatCatalogBulkPurchaseTaxResultMessage,
  formatCatalogBulkResultMessage,
  isCatalogBulkImmediateActionId,
  isCatalogBulkModalActionId,
  resolveBulkPurchaseTaxRate,
  type CatalogBulkLiveActionId,
  type CatalogBulkPurchaseTaxMode,
} from "@/app/lib/catalogBulkActions";
import {
  applyCatalogSortOrder,
  catalogReorderOrderChanged,
  formatCatalogReorderResultMessage,
  isCatalogReorderAvailable,
  moveCatalogItemInOrder,
  CATALOG_REORDER_UNAVAILABLE_COPY,
  type CatalogReorderDirection,
} from "@/app/lib/catalogReorder";
import {
  createCatalogItem,
  loadActiveCatalogItemsByCompany,
  loadCatalogItemsByCompany,
  setCatalogItemActive,
  updateCatalogItem,
} from "@/app/lib/catalogStore";
import {
  catalogSelectionHeaderState,
  pruneCatalogSelection,
  setCatalogVisibleSelection,
  toggleCatalogSelectionId,
} from "@/app/lib/catalogSelection";
import type { CatalogItem, CustomerVisibility } from "@/app/lib/catalogTypes";
import {
  installDefaultRoofingCatalog,
  type InstallDefaultRoofingCatalogResult,
} from "@/app/lib/defaultRoofingCatalogInstall";
import {
  catalogItemMatchesContractorFilter,
  formatCatalogCompactStatusLine,
  type CatalogContractorTypeFilter,
  type CatalogPageTab,
} from "@/app/lib/catalogContractorLabels";
import {
  EMPTY_ADD_CATALOG_FORM,
  STARTER_DEFINITION_COUNT,
  buildCatalogCreateDraft,
  buildCatalogUpdatePatch,
  buildEditDraftFromItem,
  catalogItemSearchHaystack,
  compareCatalogItemsForDisplay,
  hasAllStarterSeedKeys,
  isCatalogItemUnpriced,
  type AddCatalogItemForm,
  type CatalogItemEditDraft,
} from "@/app/admin/catalog/catalogAdminUtils";
import CatalogItemsWorkspace from "./CatalogItemsWorkspace";
import CatalogPageAlerts from "./CatalogPageAlerts";
import CatalogPageHeader from "./CatalogPageHeader";
import CatalogSettingsPanel from "./CatalogSettingsPanel";

const TAB_BASE =
  "shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300";
const TAB_ACTIVE = "border-slate-900 text-slate-900";
const TAB_INACTIVE = "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800";

export default function CatalogSetupClient({ companyId }: { companyId: string }) {
  const [activeTab, setActiveTab] = useState<CatalogPageTab>("all_items");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<InstallDefaultRoofingCatalogResult | null>(
    null
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CatalogItemEditDraft | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState<CatalogContractorTypeFilter>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddCatalogItemForm>(EMPTY_ADD_CATALOG_FORM);
  const [addError, setAddError] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvAnalyzing, setCsvAnalyzing] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvAnalysis, setCsvAnalysis] = useState<CatalogCsvAnalyzeResult | null>(null);
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const [csvImportSuccess, setCsvImportSuccess] = useState<string | null>(null);
  const [csvExistingItems, setCsvExistingItems] = useState<CatalogItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [purchaseTaxModalOpen, setPurchaseTaxModalOpen] = useState(false);
  const [purchaseTaxMode, setPurchaseTaxMode] =
    useState<CatalogBulkPurchaseTaxMode>("set");
  const [purchaseTaxRateInput, setPurchaseTaxRateInput] = useState("");
  const [purchaseTaxError, setPurchaseTaxError] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [reorderItemsById, setReorderItemsById] = useState<Map<string, CatalogItem>>(
    () => new Map()
  );
  const [reorderOriginalIds, setReorderOriginalIds] = useState<string[]>([]);
  const [reorderOrderedIds, setReorderOrderedIds] = useState<string[]>([]);

  const fetchCatalogLoad = useCallback(async () => {
    if (showInactive) {
      return loadCatalogItemsByCompany(companyId);
    }
    return loadActiveCatalogItemsByCompany(companyId);
  }, [companyId, showInactive]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchCatalogLoad();
      if (!result.ok) {
        setLoadError(result.error);
        setItems([]);
        return;
      }
      setItems(result.items);
    } catch (err) {
      console.warn("[CatalogSetupClient] catalog fetch error:", err);
      setLoadError("Could not load catalog items.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchCatalogLoad]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadCatalog();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCatalog]);

  const activeItems = useMemo(() => items.filter((item) => item.active), [items]);

  const readiness = useMemo(
    () => deriveCatalogReadiness(activeItems, STARTER_DEFINITION_COUNT),
    [activeItems]
  );

  const starterInstalled = hasAllStarterSeedKeys(activeItems);
  const unpricedCount = useMemo(() => countUnpricedCatalogItems(activeItems), [activeItems]);

  const compactStatusLine = useMemo(
    () =>
      formatCatalogCompactStatusLine({
        pricedCount: readiness.pricedItemCount,
        activeCount: readiness.activeItemCount,
        needsPriceCount: unpricedCount,
      }),
    [readiness.pricedItemCount, readiness.activeItemCount, unpricedCount]
  );

  const sortedItems = useMemo(() => [...items].sort(compareCatalogItemsForDisplay), [items]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => {
      if (!catalogItemMatchesContractorFilter(item, itemTypeFilter)) {
        return false;
      }
      if (normalizedSearch && !catalogItemSearchHaystack(item).includes(normalizedSearch)) {
        return false;
      }
      return true;
    });
  }, [sortedItems, itemTypeFilter, normalizedSearch]);

  const filteredUnpricedCount = useMemo(
    () => filteredItems.filter((item) => isCatalogItemUnpriced(item)).length,
    [filteredItems]
  );

  const hasListFilters = normalizedSearch.length > 0 || itemTypeFilter !== "all";

  const reorderAvailable = isCatalogReorderAvailable({
    searchQuery,
    itemTypeFilter,
  });

  const reorderDisplayItems = useMemo(() => {
    if (!reorderMode) return [];
    return reorderOrderedIds
      .map((id) => reorderItemsById.get(id))
      .filter((item): item is CatalogItem => item != null);
  }, [reorderMode, reorderOrderedIds, reorderItemsById]);

  const displayFilteredItems = reorderMode ? reorderDisplayItems : filteredItems;
  const displaySortedItems = reorderMode ? reorderDisplayItems : sortedItems;

  /** P0D: continuous flat list — no MATERIALS/LABOR/FEES group divider rows. */
  const groupedFilteredItems = useMemo(
    () => [{ key: "flat", label: "", items: displayFilteredItems }],
    [displayFilteredItems]
  );

  const reorderDirty = catalogReorderOrderChanged(reorderOriginalIds, reorderOrderedIds);

  const visibleFilteredIds = useMemo(
    () => filteredItems.map((item) => item.id),
    [filteredItems]
  );

  // Keep selection only for ids that still exist in the loaded catalog.
  useEffect(() => {
    const existing = new Set(items.map((item) => item.id));
    setSelectedIds((prev) => {
      const next = pruneCatalogSelection(prev, existing);
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) {
        return prev;
      }
      return next;
    });
  }, [items]);

  // Drop selections that are no longer visible under current filters/search.
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = pruneCatalogSelection(prev, visibleFilteredIds);
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) {
        return prev;
      }
      return next;
    });
  }, [visibleFilteredIds]);

  const editingItem = useMemo(
    () => (editingItemId ? items.find((item) => item.id === editingItemId) : null),
    [editingItemId, items]
  );

  function clearListFilters() {
    setSearchQuery("");
    setItemTypeFilter("all");
  }

  function openAddCatalogModal() {
    setAddForm(EMPTY_ADD_CATALOG_FORM);
    setAddError(null);
    setAddModalOpen(true);
  }

  function closeAddCatalogModal() {
    setAddModalOpen(false);
    setAddError(null);
    setAddForm(EMPTY_ADD_CATALOG_FORM);
  }

  function handleAddFormChange<K extends keyof AddCatalogItemForm>(
    key: K,
    value: AddCatalogItemForm[K]
  ) {
    setAddForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "coverage_rate" && String(value).trim() === "") {
        next.coverage_basis = "";
      }
      return next;
    });
    setAddError(null);
  }

  async function handleCreateCatalogItem() {
    if (creatingItem) return;

    const built = buildCatalogCreateDraft(companyId, addForm);
    if (!built.ok) {
      setAddError(built.error);
      return;
    }

    setCreatingItem(true);
    setAddError(null);
    setLoadError(null);

    try {
      const created = await createCatalogItem(built.draft);
      if (!created) {
        setAddError("Could not create catalog item. Try again.");
        return;
      }

      setMessage("Catalog item created.");
      setAddModalOpen(false);
      setAddForm(EMPTY_ADD_CATALOG_FORM);
      setAddError(null);
      await loadCatalog();
    } catch (err) {
      console.warn("[CatalogSetupClient] create error:", err);
      setAddError("Could not create catalog item. Try again.");
    } finally {
      setCreatingItem(false);
    }
  }

  async function handleToggleActive(item: CatalogItem) {
    if (togglingActiveId || savingItemId || creatingItem || bulkBusy) return;

    setTogglingActiveId(item.id);
    setLoadError(null);

    try {
      const updated = await setCatalogItemActive(item.id, !item.active, { companyId });
      if (!updated) {
        setLoadError(
          item.active
            ? "Could not deactivate catalog item."
            : "Could not reactivate catalog item."
        );
        return;
      }

      if (item.active && editingItemId === item.id) {
        closeEditor();
      }

      setMessage(item.active ? "Catalog item deactivated." : "Catalog item reactivated.");
      await loadCatalog();
    } catch (err) {
      console.warn("[CatalogSetupClient] active toggle error:", err);
      setLoadError("Could not update catalog item status.");
    } finally {
      setTogglingActiveId(null);
    }
  }

  function handleToggleRowSelect(itemId: string) {
    if (bulkBusy) return;
    setSelectedIds((prev) => toggleCatalogSelectionId(prev, itemId));
  }

  function handleToggleSelectAllVisible() {
    if (bulkBusy || visibleFilteredIds.length === 0) return;
    const headerState = catalogSelectionHeaderState(selectedIds, visibleFilteredIds);
    const selectAll = headerState !== "all";
    setSelectedIds((prev) => setCatalogVisibleSelection(prev, visibleFilteredIds, selectAll));
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  function exitReorderMode() {
    setReorderMode(false);
    setReorderBusy(false);
    setReorderItemsById(new Map());
    setReorderOriginalIds([]);
    setReorderOrderedIds([]);
  }

  async function handleEnterReorder() {
    if (reorderMode || reorderBusy || bulkBusy || savingItemId != null || creatingItem) {
      return;
    }
    if (
      !isCatalogReorderAvailable({
        searchQuery,
        itemTypeFilter,
      })
    ) {
      setLoadError(null);
      setMessage(CATALOG_REORDER_UNAVAILABLE_COPY);
      return;
    }

    setReorderBusy(true);
    setLoadError(null);
    setMessage(null);
    setSelectedIds(new Set());
    closeEditor();
    closePurchaseTaxModal();

    try {
      const result = await loadCatalogItemsByCompany(companyId);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      const sorted = [...result.items].sort(compareCatalogItemsForDisplay);
      const ids = sorted.map((item) => item.id);
      setReorderItemsById(new Map(sorted.map((item) => [item.id, item])));
      setReorderOriginalIds(ids);
      setReorderOrderedIds(ids);
      setReorderMode(true);
      setMessage(null);
    } catch (err) {
      console.warn("[CatalogSetupClient] enter reorder error:", err);
      setLoadError("Could not load catalog items for reorder.");
    } finally {
      setReorderBusy(false);
    }
  }

  function handleCancelReorder() {
    if (reorderBusy) return;
    exitReorderMode();
    setMessage("Reorder cancelled. Catalog order unchanged.");
  }

  function handleReorderMove(itemId: string, direction: CatalogReorderDirection) {
    if (!reorderMode || reorderBusy) return;
    setReorderOrderedIds((prev) => moveCatalogItemInOrder(prev, itemId, direction));
  }

  async function handleSaveReorder() {
    if (!reorderMode || reorderBusy || !reorderDirty) return;

    setReorderBusy(true);
    setLoadError(null);
    setMessage(null);

    try {
      const currentById = new Map<string, number | null | undefined>();
      for (const [id, item] of reorderItemsById) {
        currentById.set(id, item.sort_order);
      }
      const result = await applyCatalogSortOrder({
        companyId,
        orderedIds: reorderOrderedIds,
        currentById,
        adapters: {
          updateSortOrder: async (id, sortOrder, options) =>
            updateCatalogItem(id, { sort_order: sortOrder }, options),
        },
      });
      const resultMessage = formatCatalogReorderResultMessage(result);
      if (result.ok) {
        setMessage(resultMessage);
        exitReorderMode();
        await loadCatalog();
      } else {
        setLoadError(resultMessage);
        if (result.successCount > 0) {
          await loadCatalog();
        }
      }
    } catch (err) {
      console.warn("[CatalogSetupClient] save reorder error:", err);
      setLoadError("Catalog reorder failed unexpectedly. Reload Catalog before retrying.");
      await loadCatalog();
    } finally {
      setReorderBusy(false);
    }
  }

  function openPurchaseTaxModal() {
    setPurchaseTaxModalOpen(true);
    setPurchaseTaxMode("set");
    setPurchaseTaxRateInput("");
    setPurchaseTaxError(null);
    setMessage(null);
    setLoadError(null);
  }

  function closePurchaseTaxModal() {
    if (bulkBusy) return;
    setPurchaseTaxModalOpen(false);
    setPurchaseTaxError(null);
  }

  async function handleBulkLiveAction(actionId: CatalogBulkLiveActionId) {
    if (
      reorderMode ||
      bulkBusy ||
      selectedIds.size === 0 ||
      savingItemId != null ||
      creatingItem ||
      togglingActiveId != null ||
      csvImporting ||
      installing
    ) {
      return;
    }

    if (isCatalogBulkModalActionId(actionId)) {
      openPurchaseTaxModal();
      return;
    }

    if (!isCatalogBulkImmediateActionId(actionId)) return;

    const ids = [...selectedIds];
    setBulkBusy(true);
    setLoadError(null);
    setMessage(null);

    try {
      const result = await applyCatalogBulkAction({
        companyId,
        actionId,
        selectedIds: ids,
        adapters: {
          setActive: setCatalogItemActive,
          updateVisibility: async (id, visibility, options) =>
            updateCatalogItem(
              id,
              { customer_visibility: visibility as CustomerVisibility },
              options
            ),
        },
      });

      const resultMessage = formatCatalogBulkResultMessage(actionId, result);
      if (result.ok) {
        setMessage(resultMessage);
        setSelectedIds(new Set());
      } else {
        setLoadError(resultMessage);
        if (result.successCount > 0) {
          setSelectedIds(new Set());
        }
      }
      await loadCatalog();
    } catch (err) {
      console.warn("[CatalogSetupClient] bulk action error:", err);
      setLoadError("Bulk update failed unexpectedly. Reload Catalog before retrying.");
      await loadCatalog();
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleConfirmPurchaseTax() {
    if (
      bulkBusy ||
      selectedIds.size === 0 ||
      savingItemId != null ||
      creatingItem ||
      togglingActiveId != null ||
      csvImporting ||
      installing
    ) {
      return;
    }

    const resolved = resolveBulkPurchaseTaxRate(purchaseTaxMode, purchaseTaxRateInput);
    if (!resolved.ok) {
      setPurchaseTaxError(resolved.error);
      return;
    }

    const ids = [...selectedIds];
    setBulkBusy(true);
    setPurchaseTaxError(null);
    setLoadError(null);
    setMessage(null);

    try {
      const result = await applyCatalogBulkPurchaseTax({
        companyId,
        selectedIds: ids,
        purchaseTaxRatePct: resolved.rate,
        adapters: {
          updatePurchaseTax: async (id, purchaseTaxRatePct, options) =>
            updateCatalogItem(id, { purchase_tax_rate_pct: purchaseTaxRatePct }, options),
        },
      });

      const resultMessage = formatCatalogBulkPurchaseTaxResultMessage(
        purchaseTaxMode,
        result
      );
      if (result.ok) {
        setMessage(resultMessage);
        setSelectedIds(new Set());
        setPurchaseTaxModalOpen(false);
        setPurchaseTaxRateInput("");
      } else {
        setPurchaseTaxError(resultMessage);
        if (result.successCount > 0) {
          setSelectedIds(new Set());
        }
      }
      await loadCatalog();
    } catch (err) {
      console.warn("[CatalogSetupClient] bulk purchase tax error:", err);
      setPurchaseTaxError(
        "Bulk purchase tax failed unexpectedly. Reload Catalog before retrying."
      );
      await loadCatalog();
    } finally {
      setBulkBusy(false);
    }
  }

  function closeEditor() {
    setEditingItemId(null);
    setEditDraft(null);
    setEditError(null);
  }

  function openEditor(item: CatalogItem) {
    setEditingItemId(item.id);
    setEditDraft(buildEditDraftFromItem(item));
    setEditError(null);
    setMessage(null);
    window.requestAnimationFrame(() => {
      document.getElementById("catalog-item-detail-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  function handleEditToggle(item: CatalogItem) {
    if (savingItemId) return;
    if (editingItemId === item.id) {
      closeEditor();
      return;
    }
    openEditor(item);
  }

  function handleDraftChange<K extends keyof CatalogItemEditDraft>(
    key: K,
    value: CatalogItemEditDraft[K]
  ) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      if (key === "coverage_rate" && String(value).trim() === "") {
        next.coverage_basis = "";
      }
      return next;
    });
    setEditError(null);
  }

  async function handleSaveItem(item: CatalogItem) {
    if (!editDraft || savingItemId) return;

    const built = buildCatalogUpdatePatch(item, editDraft);
    if (!built.ok) {
      setEditError(built.error);
      return;
    }

    setSavingItemId(item.id);
    setEditError(null);
    setLoadError(null);

    try {
      const updated = await updateCatalogItem(item.id, built.patch, { companyId });
      if (!updated) {
        setEditError("Could not save catalog item. Try again.");
        return;
      }

      setMessage("Catalog item saved.");
      closeEditor();
      await loadCatalog();
    } catch (err) {
      console.warn("[CatalogSetupClient] save error:", err);
      setEditError("Could not save catalog item. Try again.");
    } finally {
      setSavingItemId(null);
    }
  }

  function handleDownloadCsvTemplate() {
    downloadCatalogCsvFile("fielddive-catalog-template-v1.csv", buildCatalogCsvTemplate());
  }

  async function handleExportCsv() {
    if (busy) return;
    setLoadError(null);
    try {
      const result = await loadCatalogItemsByCompany(companyId);
      if (!result.ok) {
        setLoadError(result.error || "Could not export catalog CSV.");
        return;
      }
      downloadCatalogCsvFile(
        "fielddive-catalog-export.csv",
        buildCatalogCsvExport(result.items)
      );
      setMessage(`Exported ${result.items.length} catalog item${result.items.length === 1 ? "" : "s"}.`);
    } catch (err) {
      console.warn("[CatalogSetupClient] CSV export error:", err);
      setLoadError("Could not export catalog CSV.");
    }
  }

  function resetCsvImportState() {
    setCsvFileName(null);
    setCsvAnalysis(null);
    setCsvImportError(null);
    setCsvImportSuccess(null);
    setCsvExistingItems([]);
    setCsvAnalyzing(false);
  }

  function handleOpenCsvImport() {
    if (busy || csvImporting) return;
    resetCsvImportState();
    setCsvImportOpen(true);
  }

  function handleCloseCsvImport() {
    if (csvImporting) return;
    setCsvImportOpen(false);
    resetCsvImportState();
  }

  async function handlePickCsvFile(file: File) {
    if (csvImporting) return;
    setCsvAnalyzing(true);
    setCsvFileName(file.name);
    setCsvAnalysis(null);
    setCsvImportError(null);
    setCsvImportSuccess(null);
    try {
      const text = await file.text();
      const existing = await loadCatalogItemsByCompany(companyId);
      if (!existing.ok) {
        setCsvImportError(existing.error || "Could not load catalog for CSV validation.");
        setCsvExistingItems([]);
        setCsvAnalysis(null);
        return;
      }
      setCsvExistingItems(existing.items);
      setCsvAnalysis(analyzeCatalogCsv(text, existing.items));
    } catch (err) {
      console.warn("[CatalogSetupClient] CSV parse error:", err);
      setCsvImportError("Could not read CSV file.");
      setCsvAnalysis(null);
    } finally {
      setCsvAnalyzing(false);
    }
  }

  function handleClearCsvFile() {
    if (csvImporting || csvAnalyzing) return;
    resetCsvImportState();
  }

  async function handleConfirmCsvImport() {
    if (!csvAnalysis || !csvAnalysis.ok || csvImporting || csvAnalyzing) return;
    if (csvAnalysis.summary.createCount === 0 && csvAnalysis.summary.updateCount === 0) {
      setCsvImportError("Nothing to import — all rows are unchanged or empty.");
      return;
    }

    setCsvImporting(true);
    setCsvImportError(null);
    setCsvImportSuccess(null);
    setLoadError(null);

    try {
      const write = await applyCatalogCsvImport({
        companyId,
        analysis: csvAnalysis,
        existingItems: csvExistingItems,
        createItem: createCatalogItem,
        updateItem: updateCatalogItem,
      });

      if (!write.ok) {
        setCsvImportError(
          write.errors.length
            ? write.errors.join(" ")
            : "Import failed partway through. Reload Catalog and review rows before retrying."
        );
        await loadCatalog();
        return;
      }

      setCsvImportSuccess(
        `Imported ${write.createdCount} created, ${write.updatedCount} updated` +
          (write.skippedUnchangedCount > 0
            ? `, ${write.skippedUnchangedCount} unchanged skipped.`
            : ".")
      );
      setMessage(
        `CSV import complete: ${write.createdCount} created, ${write.updatedCount} updated.`
      );
      await loadCatalog();
    } catch (err) {
      console.warn("[CatalogSetupClient] CSV import error:", err);
      setCsvImportError("Import failed unexpectedly.");
    } finally {
      setCsvImporting(false);
    }
  }

  async function handleInstallStarter() {
    if (loading || installing || savingItemId || loadError) return;

    setInstalling(true);
    setLoadError(null);
    setMessage(null);
    setInstallResult(null);
    closeEditor();

    try {
      const result = await installDefaultRoofingCatalog(companyId);
      if (!result) {
        setLoadError("Install failed: invalid company context.");
        return;
      }

      setInstallResult(result);

      if (result.failedCount > 0 && result.createdCount === 0) {
        setLoadError(
          result.errors?.length
            ? result.errors.join(" ")
            : "Install failed for all starter items."
        );
      } else if (result.createdCount > 0) {
        setMessage(
          `Installed ${result.createdCount} starter item${result.createdCount === 1 ? "" : "s"}.`
        );
      } else if (result.skippedCount > 0 && result.createdCount === 0) {
        setMessage(
          `Starter catalog is installed. Recheck: ${result.createdCount} created, ${result.skippedCount} skipped, ${result.failedCount} failed.`
        );
      }

      const reload = await fetchCatalogLoad();
      if (!reload.ok) {
        setLoadError(reload.error);
        setItems([]);
        return;
      }
      setItems(reload.items);
    } catch (err) {
      console.warn("[CatalogSetupClient] install error:", err);
      setLoadError("Install failed unexpectedly.");
    } finally {
      setInstalling(false);
    }
  }

  const busy =
    loading ||
    installing ||
    savingItemId != null ||
    creatingItem ||
    togglingActiveId != null ||
    csvImporting ||
    bulkBusy ||
    reorderBusy;
  const showEmptyInstall = !loading && !loadError && sortedItems.length === 0;

  return (
    <div className="w-full space-y-3 text-slate-900">
      <CatalogPageHeader />

      <CatalogPageAlerts
        loadError={loadError}
        message={message}
        onRetryLoad={() => void loadCatalog()}
      />

      <div className="space-y-0">
        <div
          className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200 bg-transparent"
          role="tablist"
          aria-label="Catalog sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "all_items"}
            className={`${TAB_BASE} ${activeTab === "all_items" ? TAB_ACTIVE : TAB_INACTIVE}`}
            onClick={() => setActiveTab("all_items")}
          >
            All items
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "settings"}
            className={`${TAB_BASE} ${activeTab === "settings" ? TAB_ACTIVE : TAB_INACTIVE}`}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
        </div>

        {activeTab === "settings" ? (
          <div className="pt-3">
            <CatalogSettingsPanel />
          </div>
        ) : (
          <CatalogItemsWorkspace
            loading={loading}
            busy={busy}
            needsPriceCount={unpricedCount}
            compactStatusLine={compactStatusLine}
            showEmptyInstall={showEmptyInstall}
            starterInstalled={starterInstalled}
            installing={installing}
            installResult={installResult}
            onInstallStarter={() => void handleInstallStarter()}
            showInactive={showInactive}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            itemTypeFilter={itemTypeFilter}
            onItemTypeFilterChange={setItemTypeFilter}
            onShowInactiveChange={() => setShowInactive((prev) => !prev)}
            hasListFilters={hasListFilters}
            onClearFilters={clearListFilters}
            filteredItemsCount={displayFilteredItems.length}
            sortedItemsCount={displaySortedItems.length}
            filteredNeedsPriceCount={filteredUnpricedCount}
            sortedItems={displaySortedItems}
            filteredItems={displayFilteredItems}
            groupedFilteredItems={groupedFilteredItems}
            reorderMode={reorderMode}
            reorderAvailable={reorderAvailable}
            reorderDirty={reorderDirty}
            reorderBusy={reorderBusy}
            onEnterReorder={() => void handleEnterReorder()}
            onCancelReorder={handleCancelReorder}
            onSaveReorder={() => void handleSaveReorder()}
            onReorderMove={handleReorderMove}
            editingItem={editingItem}
            editingItemId={editingItemId}
            editDraft={editDraft}
            editError={editError}
            savingItemId={savingItemId}
            togglingActiveId={togglingActiveId}
            selectedIds={selectedIds}
            bulkBusy={bulkBusy}
            onToggleRowSelect={handleToggleRowSelect}
            onToggleSelectAllVisible={handleToggleSelectAllVisible}
            onClearSelection={handleClearSelection}
            onBulkLiveAction={(actionId) => void handleBulkLiveAction(actionId)}
            purchaseTaxModalOpen={purchaseTaxModalOpen}
            purchaseTaxMode={purchaseTaxMode}
            purchaseTaxRateInput={purchaseTaxRateInput}
            purchaseTaxError={purchaseTaxError}
            onPurchaseTaxModeChange={(mode) => {
              setPurchaseTaxMode(mode);
              setPurchaseTaxError(null);
            }}
            onPurchaseTaxRateInputChange={(value) => {
              setPurchaseTaxRateInput(value);
              setPurchaseTaxError(null);
            }}
            onClosePurchaseTaxModal={closePurchaseTaxModal}
            onConfirmPurchaseTax={() => void handleConfirmPurchaseTax()}
            onEditToggle={handleEditToggle}
            onToggleActive={(item) => void handleToggleActive(item)}
            onDraftChange={handleDraftChange}
            onSaveItem={() => editingItem && void handleSaveItem(editingItem)}
            onCloseEditor={closeEditor}
            onAddItem={openAddCatalogModal}
            addModalOpen={addModalOpen}
            addForm={addForm}
            addError={addError}
            creatingItem={creatingItem}
            onAddFormChange={handleAddFormChange}
            onCloseAddModal={closeAddCatalogModal}
            onSubmitAdd={() => void handleCreateCatalogItem()}
            onDownloadCsvTemplate={handleDownloadCsvTemplate}
            onExportCsv={() => void handleExportCsv()}
            onUploadCsv={handleOpenCsvImport}
            csvActionsDisabled={csvImporting || csvAnalyzing}
            csvImportOpen={csvImportOpen}
            csvFileName={csvFileName}
            csvAnalyzing={csvAnalyzing}
            csvImporting={csvImporting}
            csvAnalysis={csvAnalysis}
            csvImportError={csvImportError}
            csvImportSuccess={csvImportSuccess}
            onCloseCsvImport={handleCloseCsvImport}
            onPickCsvFile={(file) => void handlePickCsvFile(file)}
            onClearCsvFile={handleClearCsvFile}
            onConfirmCsvImport={() => void handleConfirmCsvImport()}
          />
        )}
      </div>
    </div>
  );
}
