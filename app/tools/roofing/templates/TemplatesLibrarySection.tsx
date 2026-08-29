"use client";

import { useState } from "react";
import { filterContractorVisibleTemplates } from "@/app/lib/contractorFixtureIsolation";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { TEMPLATES_LIBRARY_SHELL } from "./templatesConstants";
import {
  TEMPLATES_ACTIVE_FILTER_LABEL,
  TEMPLATES_ARCHIVED_FILTER_LABEL,
  TEMPLATES_LIBRARY_HEADING,
  TEMPLATES_LIBRARY_HINT,
} from "./templatesWorkspaceFlow";
import { sortTemplatesByOrder } from "./templatesWorkspaceUtils";
import TemplatesArchiveTemplateConfirmModal from "./TemplatesArchiveTemplateConfirmModal";
import TemplatesLibraryEmptyState from "./TemplatesLibraryEmptyState";
import TemplatesTemplateLibraryRow from "./TemplatesTemplateLibraryRow";

type TemplatesLibraryFilter = "active" | "archived";

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
  /** R2A — archive/restore. Omit both to hide lifecycle actions entirely. */
  onArchiveTemplate?: (templateId: string) => void;
  onRestoreTemplate?: (templateId: string) => void;
  lifecycleBusyTemplateId?: string | null;
  lifecycleError?: string | null;
  /** R2B — preferred setup for roofing proposals. */
  preferredTemplateId?: string | null;
  onMakePreferred?: (templateId: string) => void;
  preferenceBusy?: boolean;
  preferenceError?: string | null;
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
  onArchiveTemplate,
  onRestoreTemplate,
  lifecycleBusyTemplateId = null,
  lifecycleError = null,
  preferredTemplateId = null,
  onMakePreferred: _onMakePreferred,
  preferenceBusy: _preferenceBusy = false,
  preferenceError = null,
}: TemplatesLibrarySectionProps) {
  const [libraryFilter, setLibraryFilter] = useState<TemplatesLibraryFilter>("active");
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  // Make preferred lives on the selected setup header (R2B primary control).
  void _onMakePreferred;
  void _preferenceBusy;

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
  const hasArchived = archivedTemplates.length > 0;
  const activeFilter = hasArchived ? libraryFilter : "active";
  const filteredTemplates =
    activeFilter === "archived" ? archivedTemplates : primaryTemplates;
  // Keep the selected setup visible even if it moved to the other lifecycle
  // filter (e.g. archived a setup while still reviewing it).
  const selectedTemplateRow = ordered.find((row) => row.id === selectedTemplateId) ?? null;
  const sortedTemplates =
    selectedTemplateRow &&
    !filteredTemplates.some((row) => row.id === selectedTemplateRow.id)
      ? [...filteredTemplates, selectedTemplateRow]
      : filteredTemplates;
  const setupCountLabel =
    primaryTemplates.length === 1
      ? "1 template"
      : `${primaryTemplates.length} templates`;
  const confirmArchiveTemplate = confirmArchiveId
    ? ordered.find((row) => row.id === confirmArchiveId) ?? null
    : null;

  const handleRequestArchive = (templateId: string) => setConfirmArchiveId(templateId);
  const handleCancelArchive = () => setConfirmArchiveId(null);
  const handleConfirmArchive = () => {
    if (confirmArchiveId) onArchiveTemplate?.(confirmArchiveId);
    setConfirmArchiveId(null);
  };

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

      {hasArchived ? (
        <div
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-100 p-0.5"
          role="tablist"
          aria-label="Reusable setup lifecycle filter"
          data-templates-library-filter
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === "active"}
            onClick={() => setLibraryFilter("active")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              activeFilter === "active"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            data-templates-library-filter-active
          >
            {TEMPLATES_ACTIVE_FILTER_LABEL}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === "archived"}
            onClick={() => setLibraryFilter("archived")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              activeFilter === "archived"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            data-templates-library-filter-archived
          >
            {TEMPLATES_ARCHIVED_FILTER_LABEL} ({archivedTemplates.length})
          </button>
        </div>
      ) : null}

      {lifecycleError ? (
        <p className="mt-2 text-xs text-red-700" role="alert" data-templates-library-lifecycle-error>
          {lifecycleError}
        </p>
      ) : null}

      {preferenceError ? (
        <p className="mt-2 text-xs text-red-700" role="alert" data-templates-library-preference-error>
          {preferenceError}
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
              onArchive={
                onArchiveTemplate && template.status !== "archived"
                  ? () => handleRequestArchive(template.id)
                  : undefined
              }
              onRestore={
                onRestoreTemplate && template.status === "archived"
                  ? () => onRestoreTemplate(template.id)
                  : undefined
              }
              lifecycleBusy={lifecycleBusyTemplateId === template.id}
              isPreferred={preferredTemplateId === template.id}
            />
          ))
        ) : activeFilter === "archived" ? (
          <p className="text-sm text-slate-500">No archived setups.</p>
        ) : (
          <TemplatesLibraryEmptyState catalogReady={catalogReady} />
        )}
      </div>

      <TemplatesArchiveTemplateConfirmModal
        open={confirmArchiveTemplate != null}
        templateName={confirmArchiveTemplate?.name ?? ""}
        busy={lifecycleBusyTemplateId === confirmArchiveId}
        onCancel={handleCancelArchive}
        onConfirm={handleConfirmArchive}
      />
    </section>
  );
}
