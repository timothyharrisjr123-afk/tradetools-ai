"use client";

import {
  formatCatalogReadinessLabel,
  type CatalogReadinessSummary,
} from "@/app/lib/catalogReadiness";
import type { InstallDefaultRoofingCatalogResult } from "@/app/lib/defaultRoofingCatalogInstall";
import { STARTER_DEFINITION_COUNT } from "@/app/admin/catalog/catalogAdminUtils";
import {
  CATALOG_COMPACT_STAT,
  CATALOG_HERO_CARD,
  catalogReadinessStatusPillClass,
} from "./catalogConstants";
import CatalogInstallFeedback from "./CatalogInstallFeedback";

type CatalogStarterHeroCardProps = {
  loading: boolean;
  busy: boolean;
  readiness: CatalogReadinessSummary;
  starterInstalled: boolean;
  starterDisplay: string;
  unpricedCount: number;
  installButtonLabel: string;
  onInstallStarter: () => void;
  onStartPricingQueue: () => void;
  installResult: InstallDefaultRoofingCatalogResult | null;
};

export default function CatalogStarterHeroCard({
  loading,
  busy,
  readiness,
  starterInstalled,
  starterDisplay,
  unpricedCount,
  installButtonLabel,
  onInstallStarter,
  onStartPricingQueue,
  installResult,
}: CatalogStarterHeroCardProps) {
  const statusLabel = formatCatalogReadinessLabel(readiness);
  const pillClass = catalogReadinessStatusPillClass(readiness.state);

  return (
    <section className={CATALOG_HERO_CARD} aria-labelledby="catalog-starter-hero-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Starter roofing catalog
          </p>
          <h2 id="catalog-starter-hero-heading" className="mt-1 text-lg font-semibold text-slate-900">
            Default line items &amp; quantity rules
          </h2>
        </div>
        {!loading && (
          <div className="flex flex-wrap gap-2">
            <span className={pillClass}>{statusLabel}</span>
            {starterInstalled && (
              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                Starter installed
              </span>
            )}
          </div>
        )}
      </div>

      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        Install {STARTER_DEFINITION_COUNT} reusable roofing items with measurement quantity sources.
        Creates catalog rows only — not proposals and not estimator pricing.
      </p>
      <p className="mt-2 text-xs text-slate-500">{starterDisplay}</p>

      {!loading && (
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className={CATALOG_COMPACT_STAT}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Active items
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
              {readiness.activeItemCount}
            </dd>
          </div>
          <div className={CATALOG_COMPACT_STAT}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Measurement-mapped
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
              {readiness.measurementMappedItemCount}
            </dd>
          </div>
          <div className={CATALOG_COMPACT_STAT}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Priced
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
              {readiness.pricedItemCount}
            </dd>
          </div>
          <div className={CATALOG_COMPACT_STAT}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Unpriced
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{unpricedCount}</dd>
          </div>
        </dl>
      )}

      {unpricedCount > 0 && readiness.activeItemCount > 0 && !loading && (
        <p className="mt-3 text-xs text-amber-900">
          <span className="font-semibold">{unpricedCount} unpriced</span> active item
          {unpricedCount === 1 ? "" : "s"} — set unit prices in the catalog table below.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onInstallStarter}
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {installButtonLabel}
        </button>
        {starterInstalled && (
          <span className="text-xs text-slate-500">Recheck is insert-only for missing seed keys</span>
        )}
        {unpricedCount > 0 && readiness.activeItemCount > 0 && (
          <button
            type="button"
            onClick={onStartPricingQueue}
            disabled={busy}
            className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Price {unpricedCount} item{unpricedCount === 1 ? "" : "s"}
          </button>
        )}
      </div>

      {installResult ? <CatalogInstallFeedback result={installResult} /> : null}
    </section>
  );
}
