"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import AdminNavLinks from "@/app/admin/AdminNavLinks";
import {
  deriveCatalogReadiness,
  formatCatalogReadinessLabel,
  formatStarterCatalogAvailability,
} from "@/app/lib/catalogReadiness";
import { getActiveCatalogItemsByCompany, updateCatalogItem } from "@/app/lib/catalogStore";
import type {
  CatalogItem,
  CatalogItemDraft,
  CustomerVisibility,
  PricingBasis,
} from "@/app/lib/catalogTypes";
import {
  CUSTOMER_VISIBILITIES,
  PRICING_BASES,
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

const STARTER_SEED_KEYS: readonly string[] = DEFAULT_ROOFING_CATALOG_DEFINITIONS.map(
  (definition) => definition.metadata.seed_key
);

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
      <span className="inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200/90">
        Unpriced
      </span>
    );
  }
  return <span className="tabular-nums text-white/80">{formatCents(cents)}</span>;
}

export default function CatalogAdminClient({ companyId }: { companyId: string }) {
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

  const fetchActiveCatalog = useCallback(async () => {
    const rows = await getActiveCatalogItemsByCompany(companyId);
    return rows;
  }, [companyId]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchActiveCatalog();
      setItems(rows);
    } catch (err) {
      console.warn("[CatalogAdminClient] catalog fetch error:", err);
      setError("Could not load catalog items.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchActiveCatalog]);

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

  const readiness = useMemo(
    () => deriveCatalogReadiness(items, STARTER_DEFINITION_COUNT),
    [items]
  );

  const catalogStatusLabel = formatCatalogReadinessLabel(readiness);
  const starterDisplay = formatStarterCatalogAvailability(readiness);
  const starterInstalled = hasAllStarterSeedKeys(items);

  const sortedItems = useMemo(
    () => [...items].sort(compareCatalogItemsForDisplay),
    [items]
  );

  const editingItem = useMemo(
    () => (editingItemId ? sortedItems.find((item) => item.id === editingItemId) : null),
    [editingItemId, sortedItems]
  );

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

      const rows = await fetchActiveCatalog();
      setItems(rows);
    } catch (err) {
      console.warn("[CatalogAdminClient] install error:", err);
      setError("Install failed unexpectedly.");
    } finally {
      setInstalling(false);
    }
  }

  const busy = loading || installing || savingItemId != null;
  const installButtonLabel = installing
    ? "Installing…"
    : starterInstalled
      ? "Recheck starter catalog"
      : "Install starter roofing catalog";

  return (
    <>
      <AdminNavLinks current="catalog" />
      <h1 className="mb-4 text-xl font-semibold">Catalog setup</h1>

      <p className="mb-4 text-sm text-white/70">
        Install company-wide catalog line items into{" "}
        <span className="text-white/90">catalog_items</span> for measurement-driven templates
        later. This is account setup, not per-job. It does not create proposals or pricing
        totals.
      </p>

      <p className="mb-4 text-xs text-white/50">
        Separate from legacy Price Book (service_items), which uses a different table and is
        not wired to the new catalog spine yet. Use Legacy Price Book in the nav above for
        service items.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <div className="mb-6 rounded-lg bg-white/5 p-4">
        <h2 className="mb-2 font-medium">Current catalog</h2>
        {loading ? (
          <p className="text-sm text-white/60">Loading catalog…</p>
        ) : (
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-white/5 py-1.5">
              <dt className="text-white/60">Catalog status</dt>
              <dd className="font-medium text-white/90">{catalogStatusLabel}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/5 py-1.5">
              <dt className="text-white/60">Active catalog items</dt>
              <dd className="font-medium tabular-nums text-white/90">
                {readiness.activeItemCount}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/5 py-1.5">
              <dt className="text-white/60">Measurement-mapped items</dt>
              <dd className="font-medium tabular-nums text-white/90">
                {readiness.measurementMappedItemCount}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/5 py-1.5">
              <dt className="text-white/60">Priced items</dt>
              <dd className="font-medium tabular-nums text-white/90">
                {readiness.pricedItemCount}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-white/5 py-1.5 sm:col-span-2">
              <dt className="text-white/60">Starter catalog</dt>
              <dd className="font-medium text-white/90">{starterDisplay}</dd>
            </div>
          </dl>
        )}
        <p className="mt-3 text-xs text-white/50">
          Configure unit prices on installed items below. This updates catalog setup only — not
          the estimator or Proposal Builder.
        </p>
      </div>

      <div className="mb-6 rounded-lg bg-white/5 p-4">
        <h2 className="mb-2 font-medium">Starter roofing catalog</h2>
        <p className="mb-3 text-xs text-white/60">
          Installs {STARTER_DEFINITION_COUNT} default items (shingles, underlayment, labor,
          disposal, permit, etc.) with measurement quantity sources. Safe to run again —
          existing seed keys are skipped.
        </p>
        <button
          type="button"
          onClick={() => void handleInstallStarter()}
          disabled={busy}
          className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {installButtonLabel}
        </button>
        {starterInstalled && (
          <p className="mt-2 text-xs text-white/50">
            All {STARTER_DEFINITION_COUNT} starter seed keys are present. Use Recheck to
            install any missing items without duplicating existing rows.
          </p>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-1 font-medium text-white/95">Installed catalog items</h2>
        <p className="mb-2 text-sm text-white/70">
          These rows power future templates and proposals. Configure prices and customer-facing
          labels here before building proposal templates.
        </p>
        <p className="mb-3 text-xs text-white/50">
          Editing identity fields like unit and quantity source will come later. Templates and
          Proposal Builder are not available yet.
        </p>
        <p className="mb-4 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100/80">
          Price the items you plan to use in templates. Templates and proposals stay locked until
          catalog setup is ready.
        </p>
        {loading ? (
          <p className="text-sm text-white/60">Loading catalog items…</p>
        ) : sortedItems.length === 0 ? (
          <p className="text-sm text-white/60">
            No active catalog items found. Install the starter roofing catalog to begin.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/60">
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Customer name</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Unit</th>
                  <th className="py-2 pr-2">Quantity source</th>
                  <th className="py-2 pr-2">Unit price</th>
                  <th className="py-2 pr-2">Unit cost</th>
                  <th className="py-2 pr-2">Active</th>
                  <th className="py-2 pr-2">Seed key</th>
                  <th className="py-2 pr-2">Sort</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const seedKey = extractSeedKey(item.metadata ?? null);
                  const isEditing = editingItemId === item.id;
                  const isSaving = savingItemId === item.id;

                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`border-b border-white/5 ${isEditing ? "bg-white/[0.04]" : ""}`}
                      >
                        <td className="py-2 pr-2 font-medium text-white/90">{item.name}</td>
                        <td className="py-2 pr-2 text-white/80">
                          {item.customer_name?.trim() || "—"}
                        </td>
                        <td className="py-2 pr-2 text-white/80">
                          {catalogItemTypeLabel(item.item_type)}
                        </td>
                        <td className="py-2 pr-2 text-white/80">
                          {catalogUnitLabel(item.unit)}
                        </td>
                        <td className="py-2 pr-2 text-white/80">
                          {quantitySourceLabel(item.quantity_source)}
                        </td>
                        <td className="py-2 pr-2">
                          <PriceTableCell cents={item.unit_price_cents} />
                        </td>
                        <td className="py-2 pr-2">
                          <PriceTableCell cents={item.unit_cost_cents} />
                        </td>
                        <td className="py-2 pr-2 text-white/80">{item.active ? "Yes" : "No"}</td>
                        <td className="py-2 pr-2 font-mono text-xs text-white/70">
                          {seedKey ?? "—"}
                        </td>
                        <td className="py-2 pr-2 tabular-nums text-white/80">
                          {item.sort_order != null ? item.sort_order : "—"}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => handleEditToggle(item)}
                            disabled={isSaving || (savingItemId != null && !isSaving)}
                            className="rounded border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:border-cyan-500/40 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isEditing ? "Close" : "Edit"}
                          </button>
                        </td>
                      </tr>
                      {isEditing && editDraft && editingItem?.id === item.id && (
                        <tr className="border-b border-white/5">
                          <td colSpan={TABLE_COLUMN_COUNT} className="px-2 py-3">
                            <div className="rounded-lg border border-cyan-500/25 bg-gradient-to-b from-white/[0.08] to-white/[0.04] p-4 shadow-sm">
                              <div className="mb-4 border-b border-white/10 pb-3">
                                <h3 className="font-medium text-white/95">
                                  Configure catalog item
                                </h3>
                                <p className="mt-1 text-xs text-white/55">
                                  Set the proposal-facing label and pricing used later by
                                  templates.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                  <span className="rounded bg-white/10 px-2 py-0.5 text-white/70">
                                    {pricingBasisLabel(item.pricing_basis)}
                                  </span>
                                  <span className="rounded bg-white/10 px-2 py-0.5 text-white/70">
                                    {customerVisibilityLabel(item.customer_visibility)}
                                  </span>
                                </div>
                              </div>

                              <dl className="mb-4 grid grid-cols-1 gap-2 rounded-md bg-black/20 p-3 text-xs sm:grid-cols-2">
                                <div>
                                  <dt className="text-white/50">Item</dt>
                                  <dd className="font-medium text-white/90">{item.name}</dd>
                                </div>
                                <div>
                                  <dt className="text-white/50">Type</dt>
                                  <dd className="text-white/85">
                                    {catalogItemTypeLabel(item.item_type)}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-white/50">Unit</dt>
                                  <dd className="text-white/85">{catalogUnitLabel(item.unit)}</dd>
                                </div>
                                <div>
                                  <dt className="text-white/50">Quantity source</dt>
                                  <dd className="text-white/85">
                                    {quantitySourceLabel(item.quantity_source)}
                                  </dd>
                                </div>
                                <div className="sm:col-span-2">
                                  <dt className="text-white/50">Seed key</dt>
                                  <dd className="font-mono text-white/80">
                                    {seedKey ?? "Custom"}
                                  </dd>
                                </div>
                              </dl>

                              {editError && (
                                <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                                  {editError}
                                </div>
                              )}

                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="block text-sm sm:col-span-2">
                                  <span className="mb-1 block text-white/80">
                                    Customer-facing name
                                  </span>
                                  <input
                                    type="text"
                                    className="w-full rounded bg-white/10 p-2 text-sm"
                                    value={editDraft.customer_name}
                                    onChange={(e) =>
                                      handleDraftChange("customer_name", e.target.value)
                                    }
                                    disabled={isSaving}
                                  />
                                </label>
                                <label className="block text-sm sm:col-span-2">
                                  <span className="mb-1 block text-white/80">Description</span>
                                  <textarea
                                    rows={2}
                                    className="w-full resize-y rounded bg-white/10 p-2 text-sm"
                                    value={editDraft.description}
                                    onChange={(e) =>
                                      handleDraftChange("description", e.target.value)
                                    }
                                    disabled={isSaving}
                                  />
                                </label>
                                <label className="block text-sm">
                                  <span className="mb-1 block text-white/80">Unit price</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="25.00"
                                    className="w-full rounded bg-white/10 p-2 text-sm tabular-nums"
                                    value={editDraft.unit_price_dollars}
                                    onChange={(e) =>
                                      handleDraftChange("unit_price_dollars", e.target.value)
                                    }
                                    disabled={isSaving}
                                  />
                                  <span className="mt-1 block text-xs text-white/45">
                                    Leave blank for Unpriced
                                  </span>
                                </label>
                                <label className="block text-sm">
                                  <span className="mb-1 block text-white/80">Unit cost</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="10.50"
                                    className="w-full rounded bg-white/10 p-2 text-sm tabular-nums"
                                    value={editDraft.unit_cost_dollars}
                                    onChange={(e) =>
                                      handleDraftChange("unit_cost_dollars", e.target.value)
                                    }
                                    disabled={isSaving}
                                  />
                                  <span className="mt-1 block text-xs text-white/45">
                                    Leave blank for Unpriced
                                  </span>
                                </label>
                                {item.item_type === "labor" && (
                                  <label className="block text-sm sm:col-span-2">
                                    <span className="mb-1 block text-white/80">
                                      Labor unit cost
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="Optional"
                                      className="w-full max-w-xs rounded bg-white/10 p-2 text-sm tabular-nums"
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
                                  <span className="mb-1 block text-white/80">Pricing basis</span>
                                  <select
                                    className="w-full rounded bg-white/10 p-2 text-sm"
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
                                  <span className="mb-1 block text-white/80">
                                    Customer visibility
                                  </span>
                                  <select
                                    className="w-full rounded bg-white/10 p-2 text-sm"
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
                                  <span className="mb-1 block text-white/80">Sort order</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Optional"
                                    className="w-full max-w-[8rem] rounded bg-white/10 p-2 text-sm tabular-nums"
                                    value={editDraft.sort_order}
                                    onChange={(e) =>
                                      handleDraftChange("sort_order", e.target.value)
                                    }
                                    disabled={isSaving}
                                  />
                                </label>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                                <button
                                  type="button"
                                  onClick={() => void handleSaveItem(item)}
                                  disabled={isSaving}
                                  className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isSaving ? "Saving…" : "Save item"}
                                </button>
                                <button
                                  type="button"
                                  onClick={closeEditor}
                                  disabled={isSaving}
                                  className="rounded border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
              </tbody>
            </table>
          </div>
        )}
      </div>

      {installResult && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
          <h2 className="mb-2 font-medium">Last install result</h2>
          <ul className="space-y-1 text-white/80">
            <li>
              Created: <span className="tabular-nums font-medium">{installResult.createdCount}</span>
            </li>
            <li>
              Skipped: <span className="tabular-nums font-medium">{installResult.skippedCount}</span>
            </li>
            <li>
              Failed: <span className="tabular-nums font-medium">{installResult.failedCount}</span>
            </li>
          </ul>
          {installResult.errors && installResult.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-red-300">
              {installResult.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
