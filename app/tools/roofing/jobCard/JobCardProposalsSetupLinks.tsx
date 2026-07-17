"use client";

import Link from "next/link";
import type { CatalogReadinessState } from "@/app/lib/catalogReadiness";

type JobCardProposalsSetupLinksProps = {
  catalogState: CatalogReadinessState;
  templateReady?: boolean;
};

export default function JobCardProposalsSetupLinks({
  catalogState,
  templateReady = false,
}: JobCardProposalsSetupLinksProps) {
  const catalogReady = catalogState === "ready_for_templates";

  if (!catalogReady) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-3" data-jobcard-setup-links="catalog">
        <Link
          href="/tools/roofing/catalog"
          className="inline-flex items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900"
        >
          Open catalog setup
        </Link>
        <p className="mt-1 text-xs text-slate-500">
          Finish Catalog pricing and measurement mapping before templates and proposals.
        </p>
      </div>
    );
  }

  if (!templateReady) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-3" data-jobcard-setup-links="templates">
        <Link
          href="/tools/roofing/templates"
          className="inline-flex items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900"
        >
          Open proposal templates
        </Link>
        <p className="mt-1 text-xs text-slate-500">
          Install the starter template and confirm Catalog items are linked. Then use Create
          proposal on this job.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3" data-jobcard-setup-links="ready">
      <p className="text-xs font-semibold text-slate-800">Setup ready for proposals</p>
      <p className="mt-1 text-xs text-slate-500">
        Proposals compile job measurement + template structure + live Catalog economics into a
        frozen draft. Use Create proposal / Open proposal above when the checklist allows.
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        <Link
          href="/tools/roofing/templates"
          className="inline-flex items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900"
        >
          Review templates
        </Link>
        <Link
          href="/tools/roofing/catalog"
          className="inline-flex items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900"
        >
          Review catalog
        </Link>
      </div>
    </div>
  );
}
