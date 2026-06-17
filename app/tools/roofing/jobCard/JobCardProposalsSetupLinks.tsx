"use client";

import Link from "next/link";
import type { CatalogReadinessState } from "@/app/lib/catalogReadiness";

type JobCardProposalsSetupLinksProps = {
  catalogState: CatalogReadinessState;
};

export default function JobCardProposalsSetupLinks({ catalogState }: JobCardProposalsSetupLinksProps) {
  const catalogReady = catalogState === "ready_for_templates";

  if (catalogReady) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-3">
        <Link
          href="/tools/roofing/templates"
          className="inline-flex items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900"
        >
          Open proposal templates
        </Link>
        <p className="mt-1 text-xs text-slate-500">
          Install and manage reusable company templates. Use Create proposal on this job when setup is complete.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <Link
        href="/tools/roofing/catalog"
        className="inline-flex items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900"
      >
        Open catalog setup
      </Link>
      <p className="mt-1 text-xs text-slate-500">
        Finish catalog pricing before templates can be installed.
      </p>
    </div>
  );
}
