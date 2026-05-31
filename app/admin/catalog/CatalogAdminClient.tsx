"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deriveCatalogReadiness,
  formatCatalogReadinessLabel,
  formatStarterCatalogAvailability,
} from "@/app/lib/catalogReadiness";
import type { CatalogItem } from "@/app/lib/catalogTypes";
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

  async function handleInstallStarter() {
    if (loading || installing || starterInstalled) return;

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
      } else if (result.skippedCount > 0) {
        setMessage("Starter catalog is already installed (all items skipped).");
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
  const installButtonLabel = starterInstalled
    ? "Starter catalog installed"
    : installing
      ? "Installing…"
      : "Install starter roofing catalog";

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Catalog setup</h1>

      <p className="mb-4 text-sm text-white/70">
        Install company-wide catalog line items into{" "}
        <span className="text-white/90">catalog_items</span> for measurement-driven templates
        later. This is account setup, not per-job. It does not create proposals or pricing
        totals.
      </p>

      <p className="mb-4 text-xs text-white/50">
        Separate from legacy{" "}
        <Link href="/admin/price-book" className="text-cyan-400 hover:text-cyan-300 underline">
          Price Book (service items)
        </Link>
        , which uses a different table and is not wired to the new catalog spine yet.
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
          disabled={busy || starterInstalled}
          className="rounded bg-cyan-500 px-4 py-2 text-sm font-semibold hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {installButtonLabel}
        </button>
        {starterInstalled && (
          <p className="mt-2 text-xs text-white/50">
            All {STARTER_DEFINITION_COUNT} starter seed keys are present. Re-run is only
            needed if items were removed.
          </p>
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
