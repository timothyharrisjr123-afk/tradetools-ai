"use client";

import Link from "next/link";
import {
  formatCatalogNextStepCopy,
  type CatalogReadinessSummary,
} from "@/app/lib/catalogReadiness";
import { CATALOG_CARD } from "./catalogConstants";

type CatalogSetupChecklistProps = {
  loading: boolean;
  starterInstalled: boolean;
  readiness: CatalogReadinessSummary;
  unpricedCount: number;
  templateReadinessReady: boolean;
};

/**
 * Astra G5: scoped next fact only — not a global multi-step setup checklist.
 */
export default function CatalogSetupChecklist({
  loading,
  starterInstalled,
  readiness,
  unpricedCount,
  templateReadinessReady,
}: CatalogSetupChecklistProps) {
  void unpricedCount;

  let nextFact: string;
  if (loading) {
    nextFact = "Checking catalog…";
  } else if (!starterInstalled) {
    nextFact = "Install starter catalog items when you need them for a proposal.";
  } else if (readiness.state === "needs_pricing") {
    nextFact =
      "Price items on the offered package when you prepare a proposal — FieldDive does not invent prices.";
  } else if (!templateReadinessReady) {
    nextFact = formatCatalogNextStepCopy(readiness);
  } else {
    nextFact = "Catalog structure is ready. Open a job to prepare and send a proposal.";
  }

  return (
    <section className={CATALOG_CARD} aria-labelledby="catalog-next-fact-heading" data-catalog-next-fact>
      <h2 id="catalog-next-fact-heading" className="text-sm font-semibold text-slate-900">
        Next for proposals
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{nextFact}</p>
      {templateReadinessReady && !loading ? (
        <Link
          href="/tools/roofing/templates"
          className="mt-3 inline-block text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
        >
          Open Templates
        </Link>
      ) : null}
    </section>
  );
}
