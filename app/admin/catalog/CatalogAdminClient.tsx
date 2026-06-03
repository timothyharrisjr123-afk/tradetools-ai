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
  const unpricedCount = useMemo(() => countUnpricedCatalogItems(items), [items]);
  const templateReadinessReady = readiness.state === "ready_for_templates";

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
              <p className="mt-3 text-xs font-medium text-cyan-800">
                Configure unpriced items in the table below.
              </p>
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
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-900">
            <span className="font-semibold">{unpricedCount} unpriced</span> active item
            {unpricedCount === 1 ? "" : "s"} — use Edit on each row to set unit prices before
            templates.
          </p>
        )}
        {loading ? (
          <p className="text-sm text-slate-500">Loading catalog items…</p>
        ) : sortedItems.length === 0 ? (
          <p className="text-sm text-slate-500">
            No active catalog items found. Install the starter roofing catalog to begin.
          </p>
        ) : (
          <div className="mt-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/40 p-2 sm:p-3">
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
                {sortedItems.map((item) => {
                  const seedKey = extractSeedKey(item.metadata ?? null);
                  const isEditing = editingItemId === item.id;
                  const isSaving = savingItemId === item.id;

                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${isEditing ? "bg-cyan-50/40" : ""}`}
                      >
                        <td className={TABLE_TD_NAME}>{item.name}</td>
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
                        <td className={TABLE_TD_COMPACT}>{item.active ? "Yes" : "No"}</td>
                        <td
                          className={`${TABLE_TD_WIDE} font-mono text-xs text-slate-600 lg:whitespace-nowrap`}
                        >
                          {seedKey ?? "—"}
                        </td>
                        <td className={`${TABLE_TD_COMPACT} tabular-nums`}>
                          {item.sort_order != null ? item.sort_order : "—"}
                        </td>
                        <td className={TABLE_TD_COMPACT}>
                          <button
                            type="button"
                            onClick={() => handleEditToggle(item)}
                            disabled={isSaving || (savingItemId != null && !isSaving)}
                            className="text-sm font-semibold text-cyan-700 hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isEditing ? "Close" : "Edit"}
                          </button>
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
                                  disabled={isSaving}
                                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isSaving ? "Saving…" : "Save item"}
                                </button>
                                <button
                                  type="button"
                                  onClick={closeEditor}
                                  disabled={isSaving}
                                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
      </section>

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
