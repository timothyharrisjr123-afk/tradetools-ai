"use client";

import Link from "next/link";
import {
  formatCatalogReadinessLabel,
  type CatalogReadinessSummary,
} from "@/app/lib/catalogReadiness";
import { CATALOG_CARD, CATALOG_CHECKLIST_ITEM } from "./catalogConstants";

type CatalogSetupChecklistProps = {
  loading: boolean;
  starterInstalled: boolean;
  readiness: CatalogReadinessSummary;
  unpricedCount: number;
  templateReadinessReady: boolean;
};

function stepBadgeClass(done: boolean, active: boolean): string {
  if (done) {
    return "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200";
  }
  if (active) {
    return "rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200";
  }
  return "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200";
}

export default function CatalogSetupChecklist({
  loading,
  starterInstalled,
  readiness,
  unpricedCount,
  templateReadinessReady,
}: CatalogSetupChecklistProps) {
  const pricingDone = readiness.activeItemCount > 0 && unpricedCount === 0;
  const pricingActive =
    starterInstalled && readiness.activeItemCount > 0 && unpricedCount > 0 && !pricingDone;
  const catalogLabel = formatCatalogReadinessLabel(readiness);

  return (
    <section className={CATALOG_CARD} aria-labelledby="catalog-checklist-heading">
      <h2 id="catalog-checklist-heading" className="text-sm font-semibold text-slate-900">
        Setup checklist
      </h2>
      <p className="mt-1 text-xs text-slate-500">Company catalog before templates and proposals.</p>

      <ol className="mt-4 space-y-2">
        <li className={CATALOG_CHECKLIST_ITEM}>
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
            1
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">Starter catalog installed</span>
              <span
                className={stepBadgeClass(
                  starterInstalled,
                  !starterInstalled && !loading && readiness.starterDefinitionCount > 0
                )}
              >
                {loading ? "…" : starterInstalled ? "Done" : "Pending"}
              </span>
            </div>
            {!starterInstalled && !loading && (
              <p className="mt-0.5 text-[11px] text-slate-600">Use Install on the starter card</p>
            )}
          </div>
        </li>

        <li className={CATALOG_CHECKLIST_ITEM}>
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
            2
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">Pricing configured</span>
              <span className={stepBadgeClass(pricingDone, pricingActive)}>
                {loading ? "…" : pricingDone ? "Done" : unpricedCount > 0 ? `${unpricedCount} left` : "Pending"}
              </span>
            </div>
            {pricingActive && !loading && (
              <p className="mt-0.5 text-[11px] text-slate-600">Set customer prices on active items</p>
            )}
          </div>
        </li>

        <li className={CATALOG_CHECKLIST_ITEM}>
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
            3
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">Proposal templates</span>
              <span className={stepBadgeClass(templateReadinessReady, !templateReadinessReady && pricingDone)}>
                {loading ? "…" : templateReadinessReady ? "Ready" : catalogLabel}
              </span>
            </div>
            {templateReadinessReady && !loading ? (
              <Link
                href="/tools/roofing/templates"
                className="mt-1.5 inline-block text-[11px] font-semibold text-cyan-800 underline underline-offset-2 hover:text-cyan-900"
              >
                Open proposal templates
              </Link>
            ) : (
              !loading && (
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Complete starter install and pricing first
                </p>
              )
            )}
          </div>
        </li>

        <li className={CATALOG_CHECKLIST_ITEM}>
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold text-slate-500">
            4
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">Proposal Builder</span>
              <span className={stepBadgeClass(false, false)}>Later</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
              Opens from Job Card after templates — not on this page.
            </p>
          </div>
        </li>
      </ol>
    </section>
  );
}
