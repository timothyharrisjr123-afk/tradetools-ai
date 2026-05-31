"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminNavLinks from "@/app/admin/AdminNavLinks";
import {
  deriveCatalogReadiness,
  formatCatalogReadinessLabel,
  formatStarterCatalogAvailability,
} from "@/app/lib/catalogReadiness";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import {
  catalogItemTypeLabel,
  catalogUnitLabel,
  quantitySourceLabel,
} from "@/app/lib/catalogTypes";
import { getActiveCatalogItemsByCompany } from "@/app/lib/catalogStore";
import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import {
  installDefaultRoofingCatalog,
  type InstallDefaultRoofingCatalogResult,
} from "@/app/lib/defaultRoofingCatalogInstall";

const STARTER_DEFINITION_COUNT = DEFAULT_ROOFING_CATALOG_DEFINITIONS.length;

const STARTER_SEED_KEYS: readonly string[] = DEFAULT_ROOFING_CATALOG_DEFINITIONS.map(
  (definition) => definition.metadata.seed_key
);

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

function compareCatalogItemsForDisplay(a: CatalogItem, b: CatalogItem): number {
  const orderA = a.sort_order;
  const orderB = b.sort_order;
  if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB;
  if (orderA != null && orderB == null) return -1;
  if (orderA == null && orderB != null) return 1;
  return a.name.localeCompare(b.name);
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

  async function handleInstallStarter() {
    if (loading || installing) return;

    setInstalling(true);
    setError(null);
    setMessage(null);
    setInstallResult(null);

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

  const busy = loading || installing;
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
          Unit prices are blank until you configure them later. Starter install does not set
          cost or price cents.
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

      <div className="mb-6 rounded-lg bg-white/5 p-4">
        <h2 className="mb-2 font-medium">Installed catalog items</h2>
        <p className="mb-3 text-xs text-white/60">
          Review the active company catalog rows installed for proposal setup. Pricing/editing
          comes next.
        </p>
        {loading ? (
          <p className="text-sm text-white/60">Loading catalog items…</p>
        ) : sortedItems.length === 0 ? (
          <p className="text-sm text-white/60">
            No active catalog items found. Install the starter roofing catalog to begin.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Customer name</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Unit</th>
                  <th className="py-2 pr-2">Quantity source</th>
                  <th className="py-2 pr-2">Unit price</th>
                  <th className="py-2 pr-2">Unit cost</th>
                  <th className="py-2 pr-2">Active</th>
                  <th className="py-2 pr-2">Seed key</th>
                  <th className="py-2">Sort</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const seedKey = extractSeedKey(item.metadata ?? null);
                  return (
                    <tr key={item.id} className="border-b border-white/5">
                      <td className="py-2 pr-2 font-medium text-white/90">{item.name}</td>
                      <td className="py-2 pr-2 text-white/80">
                        {item.customer_name?.trim() || "—"}
                      </td>
                      <td className="py-2 pr-2 text-white/80">
                        {catalogItemTypeLabel(item.item_type)}
                      </td>
                      <td className="py-2 pr-2 text-white/80">{catalogUnitLabel(item.unit)}</td>
                      <td className="py-2 pr-2 text-white/80">
                        {quantitySourceLabel(item.quantity_source)}
                      </td>
                      <td className="py-2 pr-2 tabular-nums text-white/80">
                        {formatCents(item.unit_price_cents)}
                      </td>
                      <td className="py-2 pr-2 tabular-nums text-white/80">
                        {formatCents(item.unit_cost_cents)}
                      </td>
                      <td className="py-2 pr-2 text-white/80">{item.active ? "Yes" : "No"}</td>
                      <td className="py-2 pr-2 font-mono text-xs text-white/70">
                        {seedKey ?? "—"}
                      </td>
                      <td className="py-2 tabular-nums text-white/80">
                        {item.sort_order != null ? item.sort_order : "—"}
                      </td>
                    </tr>
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
