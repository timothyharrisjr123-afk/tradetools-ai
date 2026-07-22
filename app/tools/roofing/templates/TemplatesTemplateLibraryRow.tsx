"use client";

import {
  proposalTemplateStatusLabel,
  type ProposalTemplate,
  type ProposalTemplateReadiness,
} from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  TEMPLATES_LIBRARY_ROW,
  TEMPLATES_LIBRARY_ROW_SELECTED,
} from "./templatesConstants";
import {
  countCatalogLinkedAvailableUpgradeItems,
  countCatalogLinkedTemplateItems,
  sortTemplateOptionsByOrder,
} from "./templatesSetupUtils";
import {
  TEMPLATES_ARCHIVE_ACTION_LABEL,
  TEMPLATES_RESTORE_ACTION_LABEL,
} from "./templatesWorkspaceFlow";

type TemplatesTemplateLibraryRowProps = {
  template: ProposalTemplate;
  selected: boolean;
  onSelect: () => void;
  graph?: ProposalTemplateGraph | null;
  proposalReadiness?: ProposalTemplateReadiness | null;
  selectDisabled?: boolean;
  selectDisabledTitle?: string;
  compact?: boolean;
  /** R2A — archive/restore row actions. Omitted callbacks hide the action. */
  onArchive?: () => void;
  onRestore?: () => void;
  lifecycleBusy?: boolean;
};

export default function TemplatesTemplateLibraryRow({
  template,
  selected,
  onSelect,
  graph = null,
  proposalReadiness = null,
  selectDisabled = false,
  selectDisabledTitle,
  compact = false,
  onArchive,
  onRestore,
  lifecycleBusy = false,
}: TemplatesTemplateLibraryRowProps) {
  const statusLabel = proposalTemplateStatusLabel(template.status);
  const archived = template.status === "archived";
  const rowClass = `${selected ? TEMPLATES_LIBRARY_ROW_SELECTED : TEMPLATES_LIBRARY_ROW}${
    archived && !selected ? " bg-slate-50/70 opacity-60" : ""
  }`;
  const sortedOptions = graph ? sortTemplateOptionsByOrder(graph.options) : [];
  const includedLinkedCount = graph ? countCatalogLinkedTemplateItems(graph) : null;
  const availableUpgradeCount = graph
    ? countCatalogLinkedAvailableUpgradeItems(graph)
    : null;
  const ready =
    selected &&
    proposalReadiness?.status === "ready_for_builder" &&
    (proposalReadiness.missing_catalog_item_count ?? 0) === 0;

  const description = template.description?.trim() ?? "";
  const shortDescription =
    description.length > 90 ? `${description.slice(0, 87).trimEnd()}…` : description;

  const summaryLine =
    includedLinkedCount == null
      ? null
      : [
          `${sortedOptions.length} package${sortedOptions.length === 1 ? "" : "s"}`,
          `${includedLinkedCount} included`,
          availableUpgradeCount && availableUpgradeCount > 0
            ? `${availableUpgradeCount} available upgrade${
                availableUpgradeCount === 1 ? "" : "s"
              }`
            : null,
          proposalReadiness && proposalReadiness.missing_catalog_item_count > 0
            ? `${proposalReadiness.missing_catalog_item_count} missing`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const showLifecycleActions = Boolean(onArchive || onRestore);

  return (
    <article
      className={rowClass}
      data-templates-library-row={template.id}
      data-templates-library-archived={archived ? "true" : "false"}
      data-templates-setup-row={template.id}
      data-templates-setup-row-selected={selected ? "true" : "false"}
    >
      <div className="flex w-full flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          disabled={selectDisabled}
          title={selectDisabled ? selectDisabledTitle : undefined}
          className={`min-w-0 flex-1 text-left ${
            selectDisabled ? "cursor-not-allowed opacity-60" : ""
          }`}
          aria-pressed={selected}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-sm font-semibold ${
                archived ? "text-slate-600" : "text-slate-900"
              }`}
            >
              {template.name}
            </h3>
            {selected ? (
              <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Selected
              </span>
            ) : null}
          </div>
          {!compact && shortDescription ? (
            <p className="mt-0.5 text-xs leading-snug text-slate-500">{shortDescription}</p>
          ) : null}
          {selected && summaryLine ? (
            <p
              className="mt-1.5 text-xs font-medium text-slate-600"
              data-templates-library-summary
            >
              {summaryLine}
            </p>
          ) : archived && !selected ? (
            <p className="mt-1 text-[11px] text-slate-500">Archived · not used by default</p>
          ) : null}
        </button>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
              archived
                ? "bg-slate-100 text-slate-500 ring-slate-200/80"
                : "bg-slate-50 text-slate-600 ring-slate-200/80"
            }`}
          >
            {statusLabel}
          </span>
          {selected && proposalReadiness && !archived ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                ready
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : "bg-amber-50 text-amber-800 ring-amber-200"
              }`}
              data-templates-library-ready={ready ? "true" : "false"}
            >
              {ready ? "Ready" : "Needs attention"}
            </span>
          ) : null}
        </div>
      </div>

      {showLifecycleActions ? (
        <div
          className="mt-2 flex justify-end gap-1.5 border-t border-slate-100 pt-2"
          data-templates-library-row-actions={template.id}
        >
          {archived ? (
            onRestore ? (
              <button
                type="button"
                onClick={onRestore}
                disabled={lifecycleBusy}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                data-templates-library-restore={template.id}
              >
                {lifecycleBusy ? "Restoring…" : TEMPLATES_RESTORE_ACTION_LABEL}
              </button>
            ) : null
          ) : onArchive ? (
            <button
              type="button"
              onClick={onArchive}
              disabled={lifecycleBusy}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              data-templates-library-archive={template.id}
            >
              {lifecycleBusy ? "Archiving…" : TEMPLATES_ARCHIVE_ACTION_LABEL}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
