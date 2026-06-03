"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminNavLinks from "@/app/admin/AdminNavLinks";
import {
  countUnpricedCatalogItems,
  deriveCatalogReadiness,
  formatCatalogReadinessLabel,
  formatStarterCatalogAvailability,
} from "@/app/lib/catalogReadiness";
import {
  createCatalogItem,
  getActiveCatalogItemsByCompany,
  getCatalogItemsByCompany,
  setCatalogItemActive,
  updateCatalogItem,
} from "@/app/lib/catalogStore";
import type { CatalogItem, CatalogItemDraft } from "@/app/lib/catalogTypes";
import {
  installDefaultRoofingCatalog,
  type InstallDefaultRoofingCatalogResult,
} from "@/app/lib/defaultRoofingCatalogInstall";
import {
  CARD,
  CATALOG_TYPE_GROUP_SECTIONS,
  SETUP_STEP_ACTIVE_RING,
  SETUP_STEP_CARD,
  type CatalogItemTypeFilter,
} from "./catalogAdminConstants";
import {
  EMPTY_ADD_CATALOG_FORM,
  STARTER_DEFINITION_COUNT,
  buildEditDraftFromItem,
  catalogItemSearchHaystack,
  compareCatalogItemsForDisplay,
  hasAllStarterSeedKeys,
  isCatalogItemUnpriced,
  parseDollarsToCentsOrNull,
  parseSortOrderOrNull,
  type AddCatalogItemForm,
  type CatalogItemEditDraft,
} from "./catalogAdminUtils";
import AddCatalogItemModal from "./components/AddCatalogItemModal";
import CatalogItemDetailPanel from "./components/CatalogItemDetailPanel";
import CatalogItemTable from "./components/CatalogItemTable";
import CatalogItemToolbar from "./components/CatalogItemToolbar";
import CatalogQuickActions from "./components/CatalogQuickActions";
import CatalogReadinessTiles from "./components/CatalogReadinessTiles";
import CatalogRoadmapCards from "./components/CatalogRoadmapCards";
import CatalogSetupGuide from "./components/CatalogSetupGuide";
import CatalogSetupHub from "./components/CatalogSetupHub";

export default function CatalogAdminClient({
  companyId,
  showAdminNav = true,
}: {
  companyId: string;
  showAdminNav?: boolean;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<InstallDefaultRoofingCatalogResult | null>(
    null
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CatalogItemEditDraft | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState<CatalogItemTypeFilter>("all");
  const [unpricedOnly, setUnpricedOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddCatalogItemForm>(EMPTY_ADD_CATALOG_FORM);
  const [addError, setAddError] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);

  const fetchCatalogRows = useCallback(async () => {
    if (showInactive) {
      return getCatalogItemsByCompany(companyId);
    }
    return getActiveCatalogItemsByCompany(companyId);
  }, [companyId, showInactive]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCatalogRows();
      setItems(rows);
    } catch (err) {
      console.warn("[CatalogAdminClient] catalog fetch error:", err);
      setError("Could not load catalog items.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchCatalogRows]);

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

  const catalogStatusLabel = formatCatalogReadinessLabel(readiness);
  const starterDisplay = formatStarterCatalogAvailability(readiness);
  const starterInstalled = hasAllStarterSeedKeys(activeItems);
  const unpricedCount = useMemo(() => countUnpricedCatalogItems(activeItems), [activeItems]);
  const templateReadinessReady = readiness.state === "ready_for_templates";

  const unpricedMaterialCount = useMemo(
    () =>
      activeItems.filter((item) => item.item_type === "material" && isCatalogItemUnpriced(item))
        .length,
    [activeItems]
  );
  const unpricedLaborCount = useMemo(
    () =>
      activeItems.filter((item) => item.item_type === "labor" && isCatalogItemUnpriced(item)).length,
    [activeItems]
  );
  const unpricedFeeCount = useMemo(
    () => activeItems.filter((item) => item.item_type === "fee" && isCatalogItemUnpriced(item)).length,
    [activeItems]
  );

  const sortedItems = useMemo(() => [...items].sort(compareCatalogItemsForDisplay), [items]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => {
      if (itemTypeFilter !== "all" && item.item_type !== itemTypeFilter) {
        return false;
      }
      if (unpricedOnly && !isCatalogItemUnpriced(item)) {
        return false;
      }
      if (normalizedSearch && !catalogItemSearchHaystack(item).includes(normalizedSearch)) {
        return false;
      }
      return true;
    });
  }, [sortedItems, itemTypeFilter, unpricedOnly, normalizedSearch]);

  const filteredUnpricedCount = useMemo(
    () => filteredItems.filter((item) => isCatalogItemUnpriced(item)).length,
    [filteredItems]
  );

  const hasListFilters =
    normalizedSearch.length > 0 || itemTypeFilter !== "all" || unpricedOnly;

  const groupByItemType = itemTypeFilter === "all";

  const groupedFilteredItems = useMemo(() => {
    if (!groupByItemType) {
      return [{ key: "flat", label: "", items: filteredItems }];
    }
    const sections = CATALOG_TYPE_GROUP_SECTIONS.map((section) => ({
      key: section.key,
      label: section.label,
      items: filteredItems.filter((item) =>
        (section.types as readonly string[]).includes(item.item_type)
      ),
    })).filter((section) => section.items.length > 0);

    const groupedIds = new Set(sections.flatMap((section) => section.items.map((item) => item.id)));
    const uncategorized = filteredItems.filter((item) => !groupedIds.has(item.id));
    if (uncategorized.length > 0) {
      sections.push({
        key: "uncategorized",
        label: "Other types",
        items: [...uncategorized].sort(compareCatalogItemsForDisplay),
      });
    }
    return sections;
  }, [filteredItems, groupByItemType]);

  const editingItem = useMemo(
    () => (editingItemId ? items.find((item) => item.id === editingItemId) : null),
    [editingItemId, items]
  );

  function clearListFilters() {
    setSearchQuery("");
    setItemTypeFilter("all");
    setUnpricedOnly(false);
  }

  function startPricingQueue() {
    setUnpricedOnly(true);
    setSearchQuery("");
    setItemTypeFilter("all");
    document.getElementById("catalog-configure-items")?.scrollIntoView({ behavior: "smooth" });
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
    setAddForm((prev) => ({ ...prev, [key]: value }));
    setAddError(null);
  }

  async function handleCreateCatalogItem() {
    if (creatingItem) return;

    const name = addForm.name.trim();
    if (!name) {
      setAddError("Name is required.");
      return;
    }

    const unitPrice = parseDollarsToCentsOrNull(addForm.unit_price_dollars, "Unit price");
    if (unitPrice.error) {
      setAddError(unitPrice.error);
      return;
    }

    const unitCost = parseDollarsToCentsOrNull(addForm.unit_cost_dollars, "Unit cost");
    if (unitCost.error) {
      setAddError(unitCost.error);
      return;
    }

    const draft: CatalogItemDraft = {
      company_id: companyId,
      name,
      item_type: addForm.item_type,
      unit: addForm.unit,
      quantity_source: addForm.quantity_source,
      customer_name: addForm.customer_name.trim() || null,
      description: addForm.description.trim() || null,
      unit_price_cents: unitPrice.cents,
      unit_cost_cents: unitCost.cents,
      labor_unit_cost_cents: null,
      pricing_basis: addForm.pricing_basis,
      customer_visibility: addForm.customer_visibility,
      active: true,
      waste_applies: false,
      metadata: null,
    };

    setCreatingItem(true);
    setAddError(null);
    setError(null);

    try {
      const created = await createCatalogItem(draft);
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
      console.warn("[CatalogAdminClient] create error:", err);
      setAddError("Could not create catalog item. Try again.");
    } finally {
      setCreatingItem(false);
    }
  }

  async function handleToggleActive(item: CatalogItem) {
    if (togglingActiveId || savingItemId || creatingItem) return;

    setTogglingActiveId(item.id);
    setError(null);

    try {
      const updated = await setCatalogItemActive(item.id, !item.active, { companyId });
      if (!updated) {
        setError(
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
      console.warn("[CatalogAdminClient] active toggle error:", err);
      setError("Could not update catalog item status.");
    } finally {
      setTogglingActiveId(null);
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
    setEditDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setEditError(null);
  }

  async function handleSaveItem(item: CatalogItem) {
    if (!editDraft || savingItemId) return;

    const unitPrice = parseDollarsToCentsOrNull(editDraft.unit_price_dollars, "Unit price");
    if (unitPrice.error) {
      setEditError(unitPrice.error);
      return;
    }

    const unitCost = parseDollarsToCentsOrNull(editDraft.unit_cost_dollars, "Unit cost");
    if (unitCost.error) {
      setEditError(unitCost.error);
      return;
    }

    let laborCents: number | null | undefined = undefined;
    if (item.item_type === "labor") {
      const labor = parseDollarsToCentsOrNull(
        editDraft.labor_unit_cost_dollars,
        "Labor unit cost"
      );
      if (labor.error) {
        setEditError(labor.error);
        return;
      }
      laborCents = labor.cents;
    }

    const sortParsed = parseSortOrderOrNull(editDraft.sort_order);
    if (sortParsed.error) {
      setEditError(sortParsed.error);
      return;
    }

    const patch: Partial<CatalogItemDraft> = {
      customer_name: editDraft.customer_name.trim() || null,
      description: editDraft.description.trim() || null,
      unit_price_cents: unitPrice.cents,
      unit_cost_cents: unitCost.cents,
      pricing_basis: editDraft.pricing_basis,
      customer_visibility: editDraft.customer_visibility,
      sort_order: sortParsed.sort_order,
    };

    if (item.item_type === "labor") {
      patch.labor_unit_cost_cents = laborCents ?? null;
    }

    setSavingItemId(item.id);
    setEditError(null);
    setError(null);

    try {
      const updated = await updateCatalogItem(item.id, patch, { companyId });
      if (!updated) {
        setEditError("Could not save catalog item. Try again.");
        return;
      }

      setMessage("Catalog item saved.");
      closeEditor();
      await loadCatalog();
    } catch (err) {
      console.warn("[CatalogAdminClient] save error:", err);
      setEditError("Could not save catalog item. Try again.");
    } finally {
      setSavingItemId(null);
    }
  }

  async function handleInstallStarter() {
    if (loading || installing || savingItemId) return;

    setInstalling(true);
    setError(null);
    setMessage(null);
    setInstallResult(null);
    closeEditor();

    try {
      const result = await installDefaultRoofingCatalog(companyId);
      if (!result) {
        setError("Install failed: invalid company context.");
        return;
      }

      setInstallResult(result);

      if (result.failedCount > 0 && result.createdCount === 0) {
        setError(
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

      const rows = await fetchCatalogRows();
      setItems(rows);
    } catch (err) {
      console.warn("[CatalogAdminClient] install error:", err);
      setError("Install failed unexpectedly.");
    } finally {
      setInstalling(false);
    }
  }

  const busy =
    loading || installing || savingItemId != null || creatingItem || togglingActiveId != null;
  const installButtonLabel = installing
    ? "Installing…"
    : starterInstalled
      ? "Recheck starter catalog"
      : "Install starter roofing catalog";

  const statusPillClass =
    readiness.state === "needs_pricing"
      ? "inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
      : readiness.state === "ready_for_templates"
        ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200"
        : "inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200";

  const step1Complete = starterInstalled || readiness.activeItemCount > 0;
  const step2Active =
    step1Complete &&
    (readiness.state === "needs_pricing" ||
      readiness.state === "ready_for_templates" ||
      unpricedCount > 0);
  const step1CardClass = `${SETUP_STEP_CARD} ${!step1Complete ? SETUP_STEP_ACTIVE_RING : ""}`;
  const step2CardClass = `${SETUP_STEP_CARD} ${step2Active && unpricedCount > 0 ? SETUP_STEP_ACTIVE_RING : ""}`;

  return (
    <div className="w-full space-y-6 text-slate-900">
      {showAdminNav ? <AdminNavLinks current="catalog" /> : null}

      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Company setup</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Catalog</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Set up reusable materials, labor, fees, and quantity rules that power templates, proposals,
          and later material orders. This is account-wide catalog setup — not per-job. Changes here
          do not create proposals and do not change estimator pricing.
        </p>
        <p className="text-xs leading-relaxed text-slate-500">
          Separate from legacy{" "}
          <span className="font-medium text-slate-700">Price Book (Legacy)</span> in the sidebar (
          <code className="text-[11px]">service_items</code>). Use Catalog for measurement-driven
          templates and proposals.
        </p>
        <p className="rounded-md border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">Setup path:</span> Catalog setup → configure
          prices &amp; items → proposal templates (next) → proposals &amp; material orders (later).
          Instant Estimator and supplier workflows will build on this catalog later.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <CatalogSetupHub
        starterInstalled={starterInstalled}
        starterDisplay={starterDisplay}
        readiness={readiness}
        unpricedCount={unpricedCount}
        loading={loading}
        busy={busy}
        templateReadinessReady={templateReadinessReady}
        installButtonLabel={installButtonLabel}
        step1CardClass={step1CardClass}
        step2CardClass={step2CardClass}
        onInstallStarter={() => void handleInstallStarter()}
        onStartPricingQueue={startPricingQueue}
      />

      <CatalogReadinessTiles
        loading={loading}
        readiness={readiness}
        unpricedCount={unpricedCount}
        starterDisplay={starterDisplay}
        catalogStatusLabel={catalogStatusLabel}
        statusPillClass={statusPillClass}
        templateReadinessReady={templateReadinessReady}
      />

      <CatalogSetupGuide
        loading={loading}
        readiness={readiness}
        unpricedCount={unpricedCount}
        unpricedMaterialCount={unpricedMaterialCount}
        unpricedLaborCount={unpricedLaborCount}
        unpricedFeeCount={unpricedFeeCount}
        onJumpToConfigure={startPricingQueue}
      />

      <CatalogQuickActions busy={busy} onAddItem={openAddCatalogModal} />

      <CatalogRoadmapCards />

      <section id="catalog-configure-items" className={CARD}>
        <h2 className="text-sm font-semibold text-slate-900">Configure catalog items</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Company catalog rows for future proposal templates and proposals. Edit customer-facing names,
          descriptions, and unit prices here — catalog setup only.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-xs leading-relaxed text-slate-500">
          <li>Pricing changes update catalog setup only — no estimator or pricing engine bridge yet.</li>
          <li>Proposal templates and Proposal Builder are not available on this page yet.</li>
          <li>
            Structural fields (unit, quantity source) stay read-only until a later catalog pass.
          </li>
        </ul>
        {unpricedCount > 0 && readiness.activeItemCount > 0 && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5">
            <p className="text-xs leading-relaxed text-amber-900">
              <span className="font-semibold">{unpricedCount} unpriced</span> active item
              {unpricedCount === 1 ? "" : "s"} — select Edit on a row to open the detail panel and
              set unit prices before templates.
            </p>
          </div>
        )}
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading catalog items…</p>
        ) : (
          <>
            <CatalogItemToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              itemTypeFilter={itemTypeFilter}
              onItemTypeFilterChange={setItemTypeFilter}
              unpricedOnly={unpricedOnly}
              onUnpricedOnlyChange={() => setUnpricedOnly((prev) => !prev)}
              showInactive={showInactive}
              onShowInactiveChange={() => setShowInactive((prev) => !prev)}
              hasListFilters={hasListFilters}
              onClearFilters={clearListFilters}
              groupByItemType={groupByItemType}
              filteredItemsCount={filteredItems.length}
              sortedItemsCount={sortedItems.length}
              unpricedCount={unpricedCount}
              filteredUnpricedCount={filteredUnpricedCount}
            />

            {sortedItems.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                {showInactive
                  ? "No catalog items found. Install the starter roofing catalog or add a custom item."
                  : "No active catalog items found. Install the starter roofing catalog or add a custom item."}
              </p>
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
                    onClick={clearListFilters}
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
                  onEditToggle={handleEditToggle}
                  onToggleActive={(item) => void handleToggleActive(item)}
                />
                {editingItem && editDraft ? (
                  <CatalogItemDetailPanel
                    item={editingItem}
                    editDraft={editDraft}
                    editError={editError}
                    isSaving={savingItemId === editingItem.id}
                    isTogglingActive={togglingActiveId === editingItem.id}
                    onDraftChange={handleDraftChange}
                    onSave={() => void handleSaveItem(editingItem)}
                    onClose={closeEditor}
                    onToggleActive={() => void handleToggleActive(editingItem)}
                  />
                ) : null}
              </>
            ) : null}
          </>
        )}
      </section>

      <AddCatalogItemModal
        open={addModalOpen}
        form={addForm}
        error={addError}
        creatingItem={creatingItem}
        onChange={handleAddFormChange}
        onClose={closeAddCatalogModal}
        onSubmit={() => void handleCreateCatalogItem()}
      />

      {installResult && (
        <div className={`${CARD} text-sm`}>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Last install result</h2>
          <ul className="space-y-1 text-slate-700">
            <li>
              Created:{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {installResult.createdCount}
              </span>
            </li>
            <li>
              Skipped:{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {installResult.skippedCount}
              </span>
            </li>
            <li>
              Failed:{" "}
              <span className="font-semibold tabular-nums text-slate-900">
                {installResult.failedCount}
              </span>
            </li>
          </ul>
          {installResult.errors && installResult.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
              {installResult.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
