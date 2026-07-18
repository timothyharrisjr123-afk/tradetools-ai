"use client";

import type { CatalogReadinessState } from "@/app/lib/catalogReadiness";

type JobCardProposalsSetupLinksProps = {
  catalogState: CatalogReadinessState;
  templateReady?: boolean;
  /** When ready, keep company setup links quiet — happy path stays on Job Card. */
  quietWhenReady?: boolean;
  fixCatalogHref?: string | null;
  fixTemplateHref?: string | null;
  onNavigate?: (href: string) => void;
};

/**
 * Blocker-only Catalog/Templates escape hatches for the Job Card Proposals tab.
 * Happy path (catalog + template ready) renders nothing — Create stays on the setup card.
 */
export default function JobCardProposalsSetupLinks({
  catalogState,
  templateReady = false,
  quietWhenReady = true,
  fixCatalogHref,
  fixTemplateHref,
  onNavigate,
}: JobCardProposalsSetupLinksProps) {
  const catalogReady = catalogState === "ready_for_templates";
  const catalogHref = fixCatalogHref ?? "/tools/roofing/catalog";
  const templatesHref = fixTemplateHref ?? "/tools/roofing/templates";

  const go = (href: string) => {
    if (onNavigate) {
      onNavigate(href);
      return;
    }
    if (typeof window !== "undefined") {
      window.location.assign(href);
    }
  };

  if (!catalogReady) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-3" data-jobcard-setup-links="catalog">
        <button
          type="button"
          onClick={() => go(catalogHref)}
          className="inline-flex items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900"
        >
          Open catalog setup
        </button>
        <p className="mt-1 text-xs text-slate-500">
          Finish Catalog pricing and measurement mapping before templates and proposals. You’ll
          return to this job’s Proposals tab.
        </p>
      </div>
    );
  }

  if (!templateReady) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-3" data-jobcard-setup-links="templates">
        <button
          type="button"
          onClick={() => go(templatesHref)}
          className="inline-flex items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900"
        >
          Fix template
        </button>
        <p className="mt-1 text-xs text-slate-500">
          Install or fix the company template, then return here to create the proposal for this job.
        </p>
      </div>
    );
  }

  if (quietWhenReady) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3" data-jobcard-setup-links="ready">
      <p className="text-xs text-slate-500">
        Company Templates and Catalog are ready. Create the proposal on this job above.
      </p>
    </div>
  );
}
