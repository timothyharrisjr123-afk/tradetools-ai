"use client";

import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplate } from "@/app/lib/proposalTemplateTypes";
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
  TEMPLATES_PREFERRED_BADGE_LABEL,
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
  /** Quiet selected-row lifecycle only — not a bordered admin action strip. */
  onArchive?: () => void;
  onRestore?: () => void;
  lifecycleBusy?: boolean;
  /** R2B — Preferred is a calm state badge here; Make preferred lives in the header. */
  isPreferred?: boolean;
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
  isPreferred = false,
}: TemplatesTemplateLibraryRowProps) {
  const archived = template.status === "archived";
  const rowClass = `${selected ? TEMPLATES_LIBRARY_ROW_SELECTED : TEMPLATES_LIBRARY_ROW}${
    archived && !selected ? " opacity-90" : ""
  }`;
  const sortedOptions = graph ? sortTemplateOptionsByOrder(graph.options) : [];
  const includedLinkedCount = graph ? countCatalogLinkedTemplateItems(graph) : null;
  const availableUpgradeCount = graph
    ? countCatalogLinkedAvailableUpgradeItems(graph)
    : null;
  const needsAttention =
    selected &&
    !archived &&
    proposalReadiness != null &&
    (proposalReadiness.status !== "ready_for_builder" ||
      (proposalReadiness.missing_catalog_item_count ?? 0) > 0);

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
            ? `${availableUpgradeCount} optional upgrade${
                availableUpgradeCount === 1 ? "" : "s"
              }`
            : null,
          proposalReadiness && proposalReadiness.missing_catalog_item_count > 0
            ? `${proposalReadiness.missing_catalog_item_count} missing`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  // Lifecycle actions only on the selected row (or archived rows in Archived view).
  const showLifecycleAction =
    (selected || archived) && Boolean(onArchive || onRestore);

  return (
    <article
      className={rowClass}
      data-templates-library-row={template.id}
      data-templates-library-archived={archived ? "true" : "false"}
      data-templates-library-preferred={isPreferred && !archived ? "true" : "false"}
      data-templates-setup-row={template.id}
      data-templates-setup-row-selected={selected ? "true" : "false"}
    >
      <div className="flex w-full items-start justify-between gap-3">
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
              className={`text-sm font-semibold tracking-tight ${
                archived ? "text-slate-600" : "text-slate-900"
              }`}
            >
              {template.name}
            </h3>
            {isPreferred && !archived ? (
              <span
                className="rounded-full bg-emerald-50/90 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200/70"
                data-templates-library-preferred-badge={template.id}
              >
                {TEMPLATES_PREFERRED_BADGE_LABEL}
              </span>
            ) : null}
            {needsAttention ? (
              <span
                className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200/80"
                data-templates-library-ready="false"
              >
                Needs attention
              </span>
            ) : null}
            {archived ? (
              <span className="text-[11px] font-medium text-slate-400">Archived</span>
            ) : null}
          </div>
          {!compact && shortDescription ? (
            <p className="mt-0.5 text-xs leading-snug text-slate-500">{shortDescription}</p>
          ) : null}
          {summaryLine ? (
            <p
              className="mt-1 text-xs text-slate-500"
              data-templates-library-summary
            >
              {summaryLine}
            </p>
          ) : archived && !selected ? (
            <p className="mt-1 text-[11px] text-slate-400">Not used for new proposals</p>
          ) : null}
        </button>

        {showLifecycleAction ? (
          <div
            className="flex shrink-0 items-center gap-2 pt-0.5"
            data-templates-library-row-actions={template.id}
          >
            {archived ? (
              onRestore ? (
                <button
                  type="button"
                  onClick={onRestore}
                  disabled={lifecycleBusy}
                  className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-50"
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
                className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-700 hover:underline disabled:opacity-50"
                data-templates-library-archive={template.id}
              >
                {lifecycleBusy ? "Archiving…" : TEMPLATES_ARCHIVE_ACTION_LABEL}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
