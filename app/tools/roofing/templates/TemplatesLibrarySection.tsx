"use client";

import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { TEMPLATES_CARD } from "./templatesConstants";
import TemplatesLibraryEmptyState from "./TemplatesLibraryEmptyState";
import TemplatesTemplateLibraryRow from "./TemplatesTemplateLibraryRow";

type TemplatesLibrarySectionProps = {
  loading: boolean;
  graph: ProposalTemplateGraph | null;
  catalogReady: boolean;
  proposalReadiness: ProposalTemplateReadiness;
};

export default function TemplatesLibrarySection({
  loading,
  graph,
  catalogReady,
  proposalReadiness,
}: TemplatesLibrarySectionProps) {
  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-library-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="templates-library-heading" className="text-base font-semibold text-slate-900">
          Template library
        </h2>
        {!loading && (
          <span className="text-xs text-slate-500">
            {graph ? "1 template" : "0 templates"}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Company templates available for Proposal Builder later. Read-only on this page.
      </p>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading library…</p>
        ) : graph ? (
          <TemplatesTemplateLibraryRow graph={graph} proposalReadiness={proposalReadiness} />
        ) : (
          <TemplatesLibraryEmptyState catalogReady={catalogReady} />
        )}
      </div>
    </section>
  );
}
