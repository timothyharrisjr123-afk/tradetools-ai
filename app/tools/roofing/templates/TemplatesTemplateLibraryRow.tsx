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
};

export default function TemplatesTemplateLibraryRow({
  template,
  selected,
  onSelect,
  graph = null,
  proposalReadiness = null,
  selectDisabled = false,
  selectDisabledTitle,
}: TemplatesTemplateLibraryRowProps) {
  const statusLabel = proposalTemplateStatusLabel(template.status);
  const rowClass = selected ? TEMPLATES_LIBRARY_ROW_SELECTED : TEMPLATES_LIBRARY_ROW;
  const sortedOptions = graph ? sortTemplateOptionsByOrder(graph.options) : [];
  const catalogLinkedCount = graph ? countCatalogLinkedTemplateItems(graph) : null;
  const ready =
    selected &&
    proposalReadiness?.status === "ready_for_builder" &&
    (proposalReadiness.missing_catalog_item_count ?? 0) === 0;

  return (
    <article className={rowClass} data-templates-library-row={template.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
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
          {template.description ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{template.description}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Company proposal template</p>
          )}
        </button>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
            {statusLabel}
          </span>
          {selected && proposalReadiness ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
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

      {selected && graph ? (
        <p className="mt-2 text-xs text-slate-600" data-templates-library-summary>
          {sortedOptions.length} options · {graph.sections.length} sections ·{" "}
          {catalogLinkedCount ?? 0} Catalog links
          {proposalReadiness && proposalReadiness.missing_catalog_item_count > 0
            ? ` · ${proposalReadiness.missing_catalog_item_count} missing`
            : ""}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Select to review readiness and make edits.</p>
      )}
    </article>
  );
}
