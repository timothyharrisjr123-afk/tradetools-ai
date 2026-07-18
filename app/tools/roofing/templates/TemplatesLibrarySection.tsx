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
  templateSwitchDisabled?: boolean;
  templateSwitchDisabledReason?: string;
};

export default function TemplatesLibrarySection({
  loading,
  templates,
  selectedTemplateId,
  selectedGraph,
  catalogReady,
  proposalReadiness,
  onSelectTemplate,
  templateSwitchDisabled = false,
  templateSwitchDisabledReason,
}: TemplatesLibrarySectionProps) {
  const sortedTemplates = sortTemplatesByOrder(templates);
  const templateCountLabel =
    templates.length === 1 ? "1 template" : `${templates.length} templates`;

  return (
    <section
      className={`${TEMPLATES_CARD} !px-3 !py-3`}
      aria-labelledby="templates-library-heading"
      data-templates-library
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="templates-library-heading" className="text-sm font-semibold text-slate-900">
          Templates
        </h2>
        {!loading && (
          <span className="text-[11px] text-slate-500">{templateCountLabel}</span>
        )}
      </div>

      {templateSwitchDisabled ? (
        <p className="mt-1.5 text-xs text-amber-800" role="status">
          {templateSwitchDisabledReason ??
            "Save or revert unsaved content changes before switching templates."}
        </p>
      ) : null}

      <div className="mt-2 space-y-1.5">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
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
              selectDisabled={
                templateSwitchDisabled && template.id !== selectedTemplateId
              }
              selectDisabledTitle={templateSwitchDisabledReason}
              compact
            />
          ))
        ) : (
          <TemplatesLibraryEmptyState catalogReady={catalogReady} />
        )}
      </div>
    </section>
  );
}
