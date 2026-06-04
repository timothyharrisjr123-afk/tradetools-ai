"use client";

import Link from "next/link";
import {
  formatCatalogNextStepCopy,
  formatCatalogReadinessLabel,
  type CatalogReadinessSummary,
} from "@/app/lib/catalogReadiness";
import { TEMPLATES_PREREQ_BANNER, catalogReadinessStatusPillClass } from "./templatesConstants";

type TemplatesCatalogPrerequisiteProps = {
  loading: boolean;
  error: string | null;
  readiness: CatalogReadinessSummary;
  catalogReady: boolean;
};

export default function TemplatesCatalogPrerequisite({
  loading,
  error,
  readiness,
  catalogReady,
}: TemplatesCatalogPrerequisiteProps) {
  if (catalogReady) {
    return null;
  }

  const statusLabel = formatCatalogReadinessLabel(readiness);
  const nextStep = formatCatalogNextStepCopy(readiness);
  const pillClass = catalogReadinessStatusPillClass(readiness.state);

  return (
    <div className={TEMPLATES_PREREQ_BANNER} role="status" aria-labelledby="templates-catalog-prereq-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="templates-catalog-prereq-heading" className="text-sm font-semibold text-amber-950">
          Catalog setup required
        </h2>
        {!loading && !error && <span className={pillClass}>{statusLabel}</span>}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p className="mt-2 text-sm text-amber-900">Checking catalog…</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-amber-900">{nextStep}</p>
          <p className="mt-1 text-xs text-amber-800">
            {readiness.measurementMappedItemCount} measurement-mapped items ·{" "}
            {readiness.activeItemCount} active catalog items
          </p>
          <Link
            href="/tools/roofing/catalog"
            className="mt-3 inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Open catalog setup
          </Link>
        </>
      )}
    </div>
  );
}
