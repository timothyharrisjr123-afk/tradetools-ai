"use client";

import Link from "next/link";
import {
  MIN_MEASUREMENT_MAPPED_FOR_READY,
  formatCatalogNextStepCopy,
  formatCatalogReadinessLabel,
  type CatalogReadinessSummary,
} from "@/app/lib/catalogReadiness";
import {
  TEMPLATES_CARD,
  TEMPLATES_METRIC_TILE,
  catalogReadinessStatusPillClass,
} from "./templatesConstants";

type TemplatesCatalogGateProps = {
  loading: boolean;
  error: string | null;
  readiness: CatalogReadinessSummary;
  unpricedCount: number;
  catalogReady: boolean;
};

export default function TemplatesCatalogGate({
  loading,
  error,
  readiness,
  unpricedCount,
  catalogReady,
}: TemplatesCatalogGateProps) {
  if (catalogReady) {
    return null;
  }

  const statusLabel = formatCatalogReadinessLabel(readiness);
  const nextStep = formatCatalogNextStepCopy(readiness);
  const pillClass = catalogReadinessStatusPillClass(readiness.state);

  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-catalog-gate-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="templates-catalog-gate-heading" className="text-base font-semibold text-slate-900">
            Catalog required first
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Proposal templates link to catalog items. Finish catalog setup before installing the
            starter template.
          </p>
        </div>
        {!loading && !error && <span className={pillClass}>{statusLabel}</span>}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p className="mt-4 text-sm text-slate-500">Checking catalog readiness…</p>
      ) : (
        <>
          <p className="mt-3 text-sm font-medium text-slate-800">{nextStep}</p>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={TEMPLATES_METRIC_TILE}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Active items
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
                {readiness.activeItemCount}
              </dd>
            </div>
            <div className={TEMPLATES_METRIC_TILE}>
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
            <div className={TEMPLATES_METRIC_TILE}>
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
            <div className={TEMPLATES_METRIC_TILE}>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Template readiness
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">Blocked until catalog ready</dd>
            </div>
          </dl>
          <Link
            href="/tools/roofing/catalog"
            className="mt-5 inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Open catalog setup
          </Link>
        </>
      )}
    </section>
  );
}
