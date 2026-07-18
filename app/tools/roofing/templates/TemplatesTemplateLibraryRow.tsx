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
import { countCatalogLinkedTemplateItems, sortTemplateOptionsByOrder } from "./templatesSetupUtils";

type TemplatesTemplateLibraryRowProps = {
  template: ProposalTemplate;
  selected: boolean;
  onSelect: () => void;
  graph?: ProposalTemplateGraph | null;
  proposalReadiness?: ProposalTemplateReadiness | null;
  selectDisabled?: boolean;
  selectDisabledTitle?: string;
  compact?: boolean;
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
}: TemplatesTemplateLibraryRowProps) {
  const statusLabel = proposalTemplateStatusLabel(template.status);
  const rowClass = `${selected ? TEMPLATES_LIBRARY_ROW_SELECTED : TEMPLATES_LIBRARY_ROW}${
    compact ? " !px-3 !py-2" : ""
  }`;
  const sortedOptions = graph ? sortTemplateOptionsByOrder(graph.options) : [];
  const catalogLinkedCount = graph ? countCatalogLinkedTemplateItems(graph) : null;
  const ready =
    selected &&
    proposalReadiness?.status === "ready_for_builder" &&
    (proposalReadiness.missing_catalog_item_count ?? 0) === 0;

  const description = template.description?.trim() ?? "";
  const shortDescription =
    description.length > 90 ? `${description.slice(0, 87).trimEnd()}…` : description;

  return (
    <article className={rowClass} data-templates-library-row={template.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
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
            <h3 className="text-sm font-semibold text-slate-900">{template.name}</h3>
            {selected ? (
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-800 ring-1 ring-cyan-200">
                Selected
              </span>
            ) : null}
          </div>
          {!compact && shortDescription ? (
            <p className="mt-0.5 text-xs leading-snug text-slate-500">{shortDescription}</p>
          ) : null}
          {compact && selected && graph ? (
            <p className="mt-0.5 text-[11px] text-slate-500" data-templates-library-summary>
              {sortedOptions.length} packages · {catalogLinkedCount ?? 0} items
              {proposalReadiness && proposalReadiness.missing_catalog_item_count > 0
                ? ` · ${proposalReadiness.missing_catalog_item_count} missing`
                : ""}
            </p>
          ) : null}
        </button>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
            {statusLabel}
          </span>
          {selected && proposalReadiness ? (
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

      {!compact && selected && graph ? (
        <p className="mt-1.5 text-xs text-slate-600" data-templates-library-summary>
          {sortedOptions.length} packages · {catalogLinkedCount ?? 0} Catalog links
          {proposalReadiness && proposalReadiness.missing_catalog_item_count > 0
            ? ` · ${proposalReadiness.missing_catalog_item_count} missing`
            : ""}
        </p>
      ) : null}
    </article>
  );
}
