import {
  MIN_MEASUREMENT_MAPPED_FOR_READY,
  type CatalogReadinessSummary,
} from "@/app/lib/catalogReadiness";
import { CARD } from "../catalogAdminConstants";

type CatalogReadinessTilesProps = {
  loading: boolean;
  readiness: CatalogReadinessSummary;
  unpricedCount: number;
  starterDisplay: string;
  catalogStatusLabel: string;
  statusPillClass: string;
  templateReadinessReady: boolean;
};

export default function CatalogReadinessTiles({
  loading,
  readiness,
  unpricedCount,
  starterDisplay,
  catalogStatusLabel,
  statusPillClass,
  templateReadinessReady,
}: CatalogReadinessTilesProps) {
  return (
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
        {!loading && <span className={statusPillClass}>{catalogStatusLabel}</span>}
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
  );
}
