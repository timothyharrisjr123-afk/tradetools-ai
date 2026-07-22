"use client";

import { filterContractorVisibleTemplates } from "@/app/lib/contractorFixtureIsolation";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { TEMPLATES_LIBRARY_SHELL } from "./templatesConstants";
import {
  TEMPLATES_LIBRARY_HEADING,
  TEMPLATES_LIBRARY_HINT,
} from "./templatesWorkspaceFlow";
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
  const visibleTemplates = filterContractorVisibleTemplates(templates);
  // Keep a selected fixture visible if opened directly; do not advertise smoke rows.
  const libraryTemplates =
    selectedTemplateId &&
    !visibleTemplates.some((row) => row.id === selectedTemplateId)
      ? [
          ...visibleTemplates,
          ...templates.filter((row) => row.id === selectedTemplateId),
        ]
      : visibleTemplates;
  const ordered = sortTemplatesByOrder(libraryTemplates);
  const primaryTemplates = ordered.filter((row) => row.status !== "archived");
  const archivedTemplates = ordered.filter((row) => row.status === "archived");
  const sortedTemplates = [...primaryTemplates, ...archivedTemplates];
  const setupCountLabel =
    primaryTemplates.length === 1
      ? "1 setup"
      : `${primaryTemplates.length} setups`;

  return (
    <section
      className={TEMPLATES_LIBRARY_SHELL}
      aria-labelledby="templates-library-heading"
      data-templates-library
      data-templates-setup-selector
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="templates-library-heading"
            className="text-sm font-semibold text-slate-900"
          >
            {TEMPLATES_LIBRARY_HEADING}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{TEMPLATES_LIBRARY_HINT}</p>
        </div>
        {!loading ? (
          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-500 ring-1 ring-slate-200/80">
            {setupCountLabel}
          </span>
        ) : null}
      </div>

      {templateSwitchDisabled ? (
        <p className="mt-2 text-xs text-amber-800" role="status">
          {templateSwitchDisabledReason ??
            "Save or revert unsaved content changes before switching templates."}
        </p>
      ) : null}

      <div className="mt-3 space-y-2" data-templates-setup-selector-list>
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
