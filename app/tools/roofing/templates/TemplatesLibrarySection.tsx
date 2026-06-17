"use client";

import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { TEMPLATES_CARD } from "./templatesConstants";
import { sortTemplatesByOrder } from "./templatesWorkspaceUtils";
import TemplatesLibraryEmptyState from "./TemplatesLibraryEmptyState";
import TemplatesTemplateLibraryRow from "./TemplatesTemplateLibraryRow";

type TemplatesLibrarySectionProps = {
  loading: boolean;
  templates: ProposalTemplate[];
  selectedTemplateId: string | null;
  selectedGraph: ProposalTemplateGraph | null;
  catalogReady: boolean;
  proposalReadiness: ProposalTemplateReadiness;
  onSelectTemplate: (templateId: string) => void;
};

export default function TemplatesLibrarySection({
  loading,
  templates,
  selectedTemplateId,
  selectedGraph,
  catalogReady,
  proposalReadiness,
  onSelectTemplate,
}: TemplatesLibrarySectionProps) {
  const sortedTemplates = sortTemplatesByOrder(templates);
  const templateCountLabel =
    templates.length === 1 ? "1 template" : `${templates.length} templates`;

  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-library-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="templates-library-heading" className="text-base font-semibold text-slate-900">
          Template library
        </h2>
        {!loading && (
          <span className="text-xs text-slate-500">{templateCountLabel}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Company templates available for Proposal Builder. Select a template to review its workspace
        content below.
      </p>

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading library…</p>
        ) : sortedTemplates.length > 0 ? (
          sortedTemplates.map((template) => (
            <TemplatesTemplateLibraryRow
              key={template.id}
              template={template}
              selected={template.id === selectedTemplateId}
              onSelect={() => onSelectTemplate(template.id)}
              graph={template.id === selectedTemplateId ? selectedGraph : null}
              proposalReadiness={
                template.id === selectedTemplateId ? proposalReadiness : null
              }
            />
          ))
        ) : (
          <TemplatesLibraryEmptyState catalogReady={catalogReady} />
        )}
      </div>
    </section>
  );
}
