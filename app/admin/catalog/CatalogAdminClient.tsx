"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import AdminNavLinks from "@/app/admin/AdminNavLinks";
import {
  MIN_MEASUREMENT_MAPPED_FOR_READY,
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
import type {
  CatalogItem,
  CatalogItemDraft,
  CatalogItemType,
  CatalogUnit,
  CustomerVisibility,
  PricingBasis,
  QuantitySource,
} from "@/app/lib/catalogTypes";
import {
  CATALOG_UNITS,
  CUSTOMER_VISIBILITIES,
  PRICING_BASES,
  QUANTITY_SOURCES,
  catalogItemTypeLabel,
  catalogUnitLabel,
  customerVisibilityLabel,
  pricingBasisLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import {
  installDefaultRoofingCatalog,
  type InstallDefaultRoofingCatalogResult,
} from "@/app/lib/defaultRoofingCatalogInstall";

const STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;
const TABLE_COLUMN_COUNT = 11;

const CARD =
  "rounded-md border border-slate-200/80 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const SETUP_STEP_CARD =
  "flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm";
const SETUP_STEP_ACTIVE_RING = "ring-2 ring-cyan-200/90 border-cyan-200";
const FIELD_INPUT =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60";
const TABLE_TH =
  "px-3 py-3 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const TABLE_TH_WIDE = `${TABLE_TH} min-w-[9rem] pr-4`;
const TABLE_TH_COMPACT = `${TABLE_TH} whitespace-nowrap pr-2`;
const TABLE_TD = "px-3 py-3 pr-3 align-middle text-sm text-slate-700";
const TABLE_TD_WIDE = `${TABLE_TD} min-w-[9rem] pr-4`;
const TABLE_TD_NAME =
  "px-3 py-3 pr-4 align-middle text-sm font-medium text-slate-900 min-w-[11rem] lg:whitespace-nowrap";
const TABLE_TD_COMPACT = `${TABLE_TD} whitespace-nowrap pr-2`;
const TABLE_TD_UNIT = `${TABLE_TD} min-w-[6.5rem] whitespace-nowrap`;

const STARTER_SEED_KEYS: readonly string[] = DEFAULT_ROOFING_CATALOG_DEFINITIONS.map(
  (definition) => definition.metadata.seed_key
);

type CatalogItemTypeFilter = "all" | CatalogItemType;

const CATALOG_TYPE_FILTER_OPTIONS: readonly { value: CatalogItemTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "material", label: "Material" },
  { value: "labor", label: "Labor" },
  { value: "fee", label: "Fee" },
  { value: "service", label: "Service" },
  { value: "discount", label: "Discount" },
  { value: "package", label: "Package" },
] as const;

const CATALOG_TYPE_GROUP_SECTIONS: readonly {
  key: string;
  label: string;
  types: readonly CatalogItemType[];
}[] = [
  { key: "material", label: "Materials", types: ["material"] },
  { key: "labor", label: "Labor", types: ["labor"] },
  { key: "fee", label: "Fees", types: ["fee"] },
  {
    key: "other",
    label: "Other",
    types: ["service", "discount", "package"],
  },
] as const;

const TOOLBAR_INPUT =
  "w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100";
const FILTER_CHIP_BASE =
  "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200";
const FILTER_CHIP_ON =
  "border-slate-900 bg-slate-900 text-white shadow-sm";
const FILTER_CHIP_OFF =
  "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";
const ROADMAP_CARD =
  "flex flex-col rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 opacity-80";
const PRIMARY_BUTTON =
  "rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_BUTTON =
  "rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const CATALOG_ROADMAP_OPTIONS = [
  {
    title: "Import CSV",
    badge: "Planned",
    description: "Bulk add or update catalog rows from a spreadsheet when CSV import is scoped.",
  },
  {
    title: "Manufacturer catalogs",
    badge: "Planned",
    description: "Import starter packs from roofing systems and manufacturers in a later stage.",
  },
  {
    title: "Supplier pricing",
    badge: "Planned",
    description: "Connect live supplier pricing for material orders after proposals are in place.",
  },
] as const;

type CatalogItemEditDraft = {
  customer_name: string;
  description: string;
  unit_price_dollars: string;
  unit_cost_dollars: string;
  labor_unit_cost_dollars: string;
  pricing_basis: PricingBasis;
  customer_visibility: CustomerVisibility;
  sort_order: string;
};

type AddCatalogItemForm = {
  name: string;
  item_type: CatalogItemType;
  unit: CatalogUnit;
  quantity_source: QuantitySource;
  customer_name: string;
  description: string;
  unit_price_dollars: string;
  unit_cost_dollars: string;
  pricing_basis: PricingBasis;
  customer_visibility: CustomerVisibility;
};

const EMPTY_ADD_CATALOG_FORM: AddCatalogItemForm = {
  name: "",
  item_type: "material",
  unit: "each",
  quantity_source: "fixed",
  customer_name: "",
  description: "",
  unit_price_dollars: "",
  unit_cost_dollars: "",
  pricing_basis: "unit_price",
  customer_visibility: "customer_visible",
};

function extractSeedKey(metadata: Record<string, unknown> | null | undefined): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = metadata.seed_key;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasAllStarterSeedKeys(items: CatalogItem[]): boolean {
  const existing = new Set<string>();
  for (const item of items) {
    const key = extractSeedKey(item.metadata ?? null);
    if (key) existing.add(key);
  }
  return STARTER_SEED_KEYS.every((key) => existing.has(key));
}

function formatCents(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Unpriced";
  return `$${(value / 100).toFixed(2)}`;
}

function isUnpricedCents(value: number | null | undefined): boolean {
  return value == null || !Number.isFinite(value);
}

function formatCentsForInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return (value / 100).toFixed(2);
}

function parseDollarsToCentsOrNull(
  value: string,
  fieldLabel: string
): { cents: number | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { cents: null, error: null };
  const normalized = trimmed.replace(/,/g, "");
  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return { cents: null, error: `${fieldLabel} must be a valid number.` };
  }
  if (parsed < 0) {
    return { cents: null, error: `${fieldLabel} cannot be negative.` };
  }
  return { cents: Math.round(parsed * 100), error: null };
}

function parseSortOrderOrNull(value: string): { sort_order: number | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { sort_order: null, error: null };
  if (!/^-?\d+$/.test(trimmed)) {
    return { sort_order: null, error: "Sort order must be a whole number." };
  }
  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    return { sort_order: null, error: "Sort order must be a whole number." };
  }
  return { sort_order: parsed, error: null };
}

function buildEditDraftFromItem(item: CatalogItem): CatalogItemEditDraft {
  return {
    customer_name: item.customer_name?.trim() ?? "",
    description: item.description?.trim() ?? "",
    unit_price_dollars: formatCentsForInput(item.unit_price_cents),
    unit_cost_dollars: formatCentsForInput(item.unit_cost_cents),
    labor_unit_cost_dollars: formatCentsForInput(item.labor_unit_cost_cents),
    pricing_basis: item.pricing_basis,
    customer_visibility: item.customer_visibility,
    sort_order: item.sort_order != null ? String(item.sort_order) : "",
  };
}

function isCatalogItemUnpriced(item: CatalogItem): boolean {
  return isUnpricedCents(item.unit_price_cents);
}

function catalogItemSearchHaystack(item: CatalogItem): string {
  const seedKey = extractSeedKey(item.metadata ?? null) ?? "";
  return [
    item.name,
    item.customer_name ?? "",
    item.description ?? "",
    seedKey,
    item.item_type,
    catalogItemTypeLabel(item.item_type),
    item.unit,
    catalogUnitLabel(item.unit),
    item.quantity_source,
    quantitySourceLabel(item.quantity_source),
  ]
    .join(" ")
    .toLowerCase();
}

function compareCatalogItemsForDisplay(a: CatalogItem, b: CatalogItem): number {
  const orderA = a.sort_order;
  const orderB = b.sort_order;
  if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB;
  if (orderA != null && orderB == null) return -1;
  if (orderA == null && orderB != null) return 1;
  return a.name.localeCompare(b.name);
}

function PriceTableCell({ cents }: { cents: number | null | undefined }) {
  if (isUnpricedCents(cents)) {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
        Unpriced
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap tabular-nums text-sm font-medium text-slate-800">
      {formatCents(cents)}
    </span>
  );
}

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

  const sortedItems = useMemo(
    () => [...items].sort(compareCatalogItemsForDisplay),
    [items]
  );

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
    const sections: { key: string; label: string; items: CatalogItem[] }[] =
      CATALOG_TYPE_GROUP_SECTIONS.map((section) => ({
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

      <section className={CARD} aria-labelledby="catalog-setup-hub-heading">
        <h2 id="catalog-setup-hub-heading" className="text-base font-semibold text-slate-900">
          Catalog setup
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Work through these steps before proposal templates and Proposal Builder are enabled.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={step1CardClass}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                1
              </span>
              <span
                className={
                  starterInstalled
                    ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200"
                    : "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200"
                }
              >
                {starterInstalled ? "Installed" : "Not installed"}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Starter catalog</h3>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">
              Install {STARTER_DEFINITION_COUNT} reusable roofing line items with measurement quantity
              rules. Creates catalog rows only — not proposals and not estimator pricing changes.
            </p>
            <p className="mt-2 text-xs text-slate-500">{starterDisplay}</p>
            <button
              type="button"
              onClick={() => void handleInstallStarter()}
              disabled={busy}
              className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {installButtonLabel}
            </button>
            {starterInstalled && (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                All starter seed keys are present. Recheck installs any missing rows without
                duplicating existing items.
              </p>
            )}
          </div>

          <div className={step2CardClass}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                2
              </span>
              <span
                className={
                  unpricedCount === 0 && readiness.activeItemCount > 0
                    ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200"
                    : "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
                }
              >
                {loading
                  ? "…"
                  : `${readiness.pricedItemCount} priced · ${unpricedCount} unpriced`}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Configure pricing</h3>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">
              Set unit prices and customer-facing labels on the items you plan to use. Proposal
              templates stay locked until catalog setup meets readiness below.
            </p>
            {readiness.activeItemCount === 0 ? (
              <p className="mt-3 text-xs font-medium text-slate-500">
                Install the starter catalog first.
              </p>
            ) : unpricedCount > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-cyan-800">
                  Configure unpriced items in the table below.
                </p>
                <button
                  type="button"
                  onClick={startPricingQueue}
                  disabled={busy}
                  className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Price {unpricedCount} item{unpricedCount === 1 ? "" : "s"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs font-medium text-emerald-800">
                All active items have unit prices set.
              </p>
            )}
          </div>

          <div className={`${SETUP_STEP_CARD} opacity-95`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-600">
                3
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                After catalog (3G6)
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Templates next</h3>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600">
              Proposal templates will use these catalog items after setup is ready. The templates
              route is not available yet — coming in stage 3G6 after catalog alignment.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              {templateReadinessReady
                ? "Catalog meets template readiness — templates UI is the next implementation stage."
                : "Complete steps 1–2 and pricing readiness before templates."}
            </p>
          </div>
        </div>
      </section>

      <section className={CARD} aria-labelledby="catalog-readiness-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="catalog-readiness-heading" className="text-sm font-semibold text-slate-900">
              Setup readiness
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Actionable checks before templates and Proposal Builder. Threshold:{" "}
              {MIN_MEASUREMENT_MAPPED_FOR_READY} measurement-mapped items for template readiness.
            </p>
          </div>
          {!loading && (
            <span className={statusPillClass}>{catalogStatusLabel}</span>
          )}
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading readiness…</p>
        ) : (
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Starter installed
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{starterDisplay}</dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Active items
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {readiness.activeItemCount}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Measurement-mapped
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {readiness.measurementMappedItemCount}
                <span className="text-xs font-normal text-slate-500">
                  {" "}
                  / {MIN_MEASUREMENT_MAPPED_FOR_READY} needed
                </span>
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Priced items
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {readiness.pricedItemCount}
                {unpricedCount > 0 && (
                  <span className="text-xs font-normal text-amber-700">
                    {" "}
                    · {unpricedCount} unpriced
                  </span>
                )}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 sm:col-span-2 lg:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Template readiness
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {templateReadinessReady ? "Ready for templates (UI in 3G6)" : "Not ready yet"}
              </dd>
              <dd className="mt-1 text-xs text-slate-500">
                Templates and Proposal Builder remain unavailable until later stages.
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className={CARD} aria-labelledby="catalog-setup-guide-heading">
        <h2 id="catalog-setup-guide-heading" className="text-sm font-semibold text-slate-900">
          Setup guide
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Rules-based guidance only — catalog setup does not change estimator pricing or create
          proposals.
        </p>
        {loading ? (
          <p className="mt-3 text-xs text-slate-500">Loading setup status…</p>
        ) : readiness.activeItemCount === 0 ? (
          <p className="mt-3 text-xs text-slate-600">
            Install the starter catalog, then configure prices on the items you plan to use in
            templates.
          </p>
        ) : unpricedCount > 0 ? (
          <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">
                You have {unpricedCount} unpriced active item{unpricedCount === 1 ? "" : "s"}.
              </span>{" "}
              Start with materials ({unpricedMaterialCount} unpriced), then labor (
              {unpricedLaborCount}), then fees ({unpricedFeeCount}).
            </p>
            <button
              type="button"
              onClick={startPricingQueue}
              disabled={busy}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Price {unpricedCount} item{unpricedCount === 1 ? "" : "s"}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-emerald-800">
            Active catalog items have unit prices. Template setup UI (3G6) is the next stage after
            catalog alignment.
          </p>
        )}
      </section>

      <section className={CARD} aria-labelledby="catalog-quick-actions-heading">
        <h2 id="catalog-quick-actions-heading" className="text-sm font-semibold text-slate-900">
          Quick actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openAddCatalogModal}
            disabled={busy}
            className={PRIMARY_BUTTON}
          >
            Add catalog item
          </button>
          <button
            type="button"
            onClick={() => setShowInactive((prev) => !prev)}
            disabled={busy}
            className={`${FILTER_CHIP_BASE} ${showInactive ? FILTER_CHIP_ON : FILTER_CHIP_OFF}`}
            aria-pressed={showInactive}
          >
            Show inactive
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Custom items do not receive starter seed keys. Deactivated items stay in the catalog for
          later reactivation.
        </p>
      </section>

      <section className={CARD} aria-labelledby="catalog-roadmap-heading">
        <h2 id="catalog-roadmap-heading" className="text-sm font-semibold text-slate-900">
          Expand catalog later
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Planned capabilities — not available in this stage. Shown so the setup path stays clear.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CATALOG_ROADMAP_OPTIONS.map((option) => (
            <div key={option.title} className={ROADMAP_CARD} aria-disabled="true">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700">{option.title}</h3>
                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {option.badge}
                </span>
              </div>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-500">
                {option.description}
              </p>
              <button
                type="button"
                disabled
                className="mt-3 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400"
              >
                Coming later
              </button>
            </div>
          ))}
        </div>
      </section>

      <section id="catalog-configure-items" className={CARD}>
        <h2 className="text-sm font-semibold text-slate-900">Configure catalog items</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Company catalog rows for future proposal templates and proposals. Edit customer-facing
          names, descriptions, and unit prices here — catalog setup only.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-xs leading-relaxed text-slate-500">
          <li>Pricing changes update catalog setup only — no estimator or pricing engine bridge yet.</li>
          <li>Proposal templates and Proposal Builder are not available on this page yet.</li>
          <li>
            Structural fields (unit, quantity source) stay read-only until a later catalog pass.
          </li>
        </ul>
        {unpricedCount > 0 && readiness.activeItemCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5">
            <p className="text-xs leading-relaxed text-amber-900">
              <span className="font-semibold">{unpricedCount} unpriced</span> active item
              {unpricedCount === 1 ? "" : "s"} — use Edit on each row to set unit prices before
              templates.
            </p>
            <button
              type="button"
              onClick={startPricingQueue}
              disabled={busy}
              className="shrink-0 rounded-md bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Price {unpricedCount} item{unpricedCount === 1 ? "" : "s"}
            </button>
          </div>
        )}
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading catalog items…</p>
        ) : (
          <>
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name, customer label, seed key, type, unit, quantity source…"
                    className={TOOLBAR_INPUT}
                    aria-label="Search catalog items"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUnpricedOnly((prev) => !prev)}
                    className={`${FILTER_CHIP_BASE} ${unpricedOnly ? FILTER_CHIP_ON : FILTER_CHIP_OFF}`}
                    aria-pressed={unpricedOnly}
                  >
                    Unpriced only
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInactive((prev) => !prev)}
                    className={`${FILTER_CHIP_BASE} ${showInactive ? FILTER_CHIP_ON : FILTER_CHIP_OFF}`}
                    aria-pressed={showInactive}
                  >
                    Show inactive
                  </button>
                  {hasListFilters && (
                    <button
                      type="button"
                      onClick={clearListFilters}
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
                    onClick={() => setItemTypeFilter(option.value)}
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
                  Showing {filteredItems.length} of {sortedItems.length}{" "}
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
                    · <span className="text-amber-800">{filteredUnpricedCount} unpriced</span> in
                    this view
                  </>
                )}
                {groupByItemType && filteredItems.length > 0 && (
                  <> · Grouped by type</>
                )}
              </p>
            </div>

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
                  const isEditing = editingItemId === item.id;
                  const isSaving = savingItemId === item.id;
                  const isTogglingActive = togglingActiveId === item.id;

                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${isEditing ? "bg-cyan-50/40" : ""} ${!item.active ? "bg-slate-50/60 opacity-75" : ""}`}
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
                          <PriceTableCell cents={item.unit_price_cents} />
                        </td>
                        <td className={TABLE_TD_COMPACT}>
                          <PriceTableCell cents={item.unit_cost_cents} />
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
                              onClick={() => handleEditToggle(item)}
                              disabled={
                                isSaving ||
                                isTogglingActive ||
                                (savingItemId != null && !isSaving)
                              }
                              className="text-sm font-semibold text-cyan-700 hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isEditing ? "Close" : "Edit"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleActive(item)}
                              disabled={busy && !isTogglingActive}
                              className="text-left text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isTogglingActive
                                ? "…"
                                : item.active
                                  ? "Deactivate"
                                  : "Reactivate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isEditing && editDraft && editingItem?.id === item.id && (
                        <tr className="border-b border-slate-100">
                          <td colSpan={TABLE_COLUMN_COUNT} className="px-4 py-4">
                            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-5">
                              <div className="mb-5 border-b border-slate-200 pb-4">
                                <h3 className="text-sm font-semibold text-slate-900">
                                  Configure catalog item
                                </h3>
                                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                                  Set the proposal-facing label and pricing used later by templates.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200">
                                    {pricingBasisLabel(item.pricing_basis)}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200">
                                    {customerVisibilityLabel(item.customer_visibility)}
                                  </span>
                                </div>
                              </div>

                              <dl className="mb-5 grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 text-xs sm:grid-cols-2">
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Item
                                  </dt>
                                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                                    {item.name}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Type
                                  </dt>
                                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                                    {catalogItemTypeLabel(item.item_type)}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Unit
                                  </dt>
                                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                                    {catalogUnitLabel(item.unit)}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Quantity source
                                  </dt>
                                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                                    {quantitySourceLabel(item.quantity_source)}
                                  </dd>
                                </div>
                                <div className="sm:col-span-2">
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Seed key
                                  </dt>
                                  <dd className="mt-0.5 font-mono text-sm text-slate-800">
                                    {seedKey ?? "Custom"}
                                  </dd>
                                </div>
                              </dl>

                              {editError && (
                                <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                  {editError}
                                </div>
                              )}

                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="block text-sm sm:col-span-2">
                                  <span className="mb-1.5 block text-xs font-medium text-slate-700">
                                    Customer-facing name
                                  </span>
                                  <input
                                    type="text"
                                    className={FIELD_INPUT}
                                    value={editDraft.customer_name}
                                    onChange={(e) =>
                                      handleDraftChange("customer_name", e.target.value)
                                    }
                                    disabled={isSaving}
                                  />
                                </label>
                                <label className="block text-sm sm:col-span-2">
                                  <span className="mb-1.5 block text-xs font-medium text-slate-700">
                                    Description
                                  </span>
                                  <textarea
                                    rows={2}
                                    className={`${FIELD_INPUT} resize-y`}
                                    value={editDraft.description}
                                    onChange={(e) =>
                                      handleDraftChange("description", e.target.value)
                                    }
                                    disabled={isSaving}
                                  />
                                </label>
                                <label className="block text-sm">
                                  <span className="mb-1.5 block text-xs font-medium text-slate-700">
                                    Unit price
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="25.00"
                                    className={`${FIELD_INPUT} tabular-nums`}
                                    value={editDraft.unit_price_dollars}
                                    onChange={(e) =>
                                      handleDraftChange("unit_price_dollars", e.target.value)
                                    }
                                    disabled={isSaving}
                                  />
                                  <span className="mt-1 block text-xs text-slate-500">
                                    Leave blank for Unpriced
                                  </span>
                                </label>
                                <label className="block text-sm">
                                  <span className="mb-1.5 block text-xs font-medium text-slate-700">
                                    Unit cost
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="10.50"
                                    className={`${FIELD_INPUT} tabular-nums`}
                                    value={editDraft.unit_cost_dollars}
                                    onChange={(e) =>
                                      handleDraftChange("unit_cost_dollars", e.target.value)
                                    }
                                    disabled={isSaving}
                                  />
                                  <span className="mt-1 block text-xs text-slate-500">
                                    Leave blank for Unpriced
                                  </span>
                                </label>
                                {item.item_type === "labor" && (
                                  <label className="block text-sm sm:col-span-2">
                                    <span className="mb-1.5 block text-xs font-medium text-slate-700">
                                      Labor unit cost
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="Optional"
                                      className={`${FIELD_INPUT} max-w-xs tabular-nums`}
                                      value={editDraft.labor_unit_cost_dollars}
                                      onChange={(e) =>
                                        handleDraftChange(
                                          "labor_unit_cost_dollars",
                                          e.target.value
                                        )
                                      }
                                      disabled={isSaving}
                                    />
                                  </label>
                                )}
                                <label className="block text-sm">
                                  <span className="mb-1.5 block text-xs font-medium text-slate-700">
                                    Pricing basis
                                  </span>
                                  <select
                                    className={FIELD_INPUT}
                                    value={editDraft.pricing_basis}
                                    onChange={(e) =>
                                      handleDraftChange(
                                        "pricing_basis",
                                        e.target.value as PricingBasis
                                      )
                                    }
                                    disabled={isSaving}
                                  >
                                    {PRICING_BASES.map((basis) => (
                                      <option key={basis} value={basis}>
                                        {pricingBasisLabel(basis)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-sm">
                                  <span className="mb-1.5 block text-xs font-medium text-slate-700">
                                    Customer visibility
                                  </span>
                                  <select
                                    className={FIELD_INPUT}
                                    value={editDraft.customer_visibility}
                                    onChange={(e) =>
                                      handleDraftChange(
                                        "customer_visibility",
                                        e.target.value as CustomerVisibility
                                      )
                                    }
                                    disabled={isSaving}
                                  >
                                    {CUSTOMER_VISIBILITIES.map((visibility) => (
                                      <option key={visibility} value={visibility}>
                                        {customerVisibilityLabel(visibility)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-sm">
                                  <span className="mb-1.5 block text-xs font-medium text-slate-700">
                                    Sort order
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Optional"
                                    className={`${FIELD_INPUT} max-w-[8rem] tabular-nums`}
                                    value={editDraft.sort_order}
                                    onChange={(e) =>
                                      handleDraftChange("sort_order", e.target.value)
                                    }
                                    disabled={isSaving}
                                  />
                                </label>
                              </div>

                              <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
                                <button
                                  type="button"
                                  onClick={() => void handleSaveItem(item)}
                                  disabled={isSaving || isTogglingActive}
                                  className={PRIMARY_BUTTON}
                                >
                                  {isSaving ? "Saving…" : "Save item"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleToggleActive(item)}
                                  disabled={isSaving || isTogglingActive}
                                  className={SECONDARY_BUTTON}
                                >
                                  {isTogglingActive
                                    ? "Updating…"
                                    : item.active
                                      ? "Deactivate item"
                                      : "Reactivate item"}
                                </button>
                                <button
                                  type="button"
                                  onClick={closeEditor}
                                  disabled={isSaving || isTogglingActive}
                                  className={SECONDARY_BUTTON}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                        );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </section>

      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-catalog-item-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h2 id="add-catalog-item-title" className="text-lg font-semibold text-slate-900">
              Add catalog item
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Manual lines use a fixed quantity source by default. No starter seed key is assigned.
            </p>

            {addError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {addError}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Name *</span>
                <input
                  type="text"
                  className={FIELD_INPUT}
                  value={addForm.name}
                  onChange={(e) => handleAddFormChange("name", e.target.value)}
                  disabled={creatingItem}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Item type *</span>
                <select
                  className={FIELD_INPUT}
                  value={addForm.item_type}
                  onChange={(e) =>
                    handleAddFormChange("item_type", e.target.value as CatalogItemType)
                  }
                  disabled={creatingItem}
                >
                  {CATALOG_TYPE_FILTER_OPTIONS.filter((o) => o.value !== "all").map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Unit *</span>
                <select
                  className={FIELD_INPUT}
                  value={addForm.unit}
                  onChange={(e) => handleAddFormChange("unit", e.target.value as CatalogUnit)}
                  disabled={creatingItem}
                >
                  {CATALOG_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {catalogUnitLabel(unit)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-slate-700">
                  Quantity source *
                </span>
                <select
                  className={FIELD_INPUT}
                  value={addForm.quantity_source}
                  onChange={(e) =>
                    handleAddFormChange("quantity_source", e.target.value as QuantitySource)
                  }
                  disabled={creatingItem}
                >
                  {QUANTITY_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {quantitySourceLabel(source)}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-slate-500">
                  Default <span className="font-medium">Fixed quantity</span> for custom manual lines.
                </span>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-slate-700">
                  Customer-facing name
                </span>
                <input
                  type="text"
                  className={FIELD_INPUT}
                  value={addForm.customer_name}
                  onChange={(e) => handleAddFormChange("customer_name", e.target.value)}
                  disabled={creatingItem}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Description</span>
                <textarea
                  rows={2}
                  className={`${FIELD_INPUT} resize-y`}
                  value={addForm.description}
                  onChange={(e) => handleAddFormChange("description", e.target.value)}
                  disabled={creatingItem}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Unit price</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Optional"
                  className={`${FIELD_INPUT} tabular-nums`}
                  value={addForm.unit_price_dollars}
                  onChange={(e) => handleAddFormChange("unit_price_dollars", e.target.value)}
                  disabled={creatingItem}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Unit cost</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Optional"
                  className={`${FIELD_INPUT} tabular-nums`}
                  value={addForm.unit_cost_dollars}
                  onChange={(e) => handleAddFormChange("unit_cost_dollars", e.target.value)}
                  disabled={creatingItem}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Pricing basis</span>
                <select
                  className={FIELD_INPUT}
                  value={addForm.pricing_basis}
                  onChange={(e) =>
                    handleAddFormChange("pricing_basis", e.target.value as PricingBasis)
                  }
                  disabled={creatingItem}
                >
                  {PRICING_BASES.map((basis) => (
                    <option key={basis} value={basis}>
                      {pricingBasisLabel(basis)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-slate-700">Visibility</span>
                <select
                  className={FIELD_INPUT}
                  value={addForm.customer_visibility}
                  onChange={(e) =>
                    handleAddFormChange(
                      "customer_visibility",
                      e.target.value as CustomerVisibility
                    )
                  }
                  disabled={creatingItem}
                >
                  {CUSTOMER_VISIBILITIES.map((visibility) => (
                    <option key={visibility} value={visibility}>
                      {customerVisibilityLabel(visibility)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={closeAddCatalogModal}
                disabled={creatingItem}
                className={SECONDARY_BUTTON}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateCatalogItem()}
                disabled={creatingItem}
                className={PRIMARY_BUTTON}
              >
                {creatingItem ? "Creating…" : "Create item"}
              </button>
            </div>
          </div>
        </div>
      )}

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
