"use client";

import { proposalTemplateReadinessStatusLabel, proposalTemplateStatusLabel } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { proposalTemplateReadinessStatusPillClass } from "@/app/lib/proposalTemplateReadiness";
import { TEMPLATES_LIBRARY_ROW } from "./templatesConstants";
import { countCatalogLinkedTemplateItems, sortTemplateOptionsByOrder } from "./templatesSetupUtils";

type TemplatesTemplateLibraryRowProps = {
  graph: ProposalTemplateGraph;
  proposalReadiness: ProposalTemplateReadiness;
};

export default function TemplatesTemplateLibraryRow({
  graph,
  proposalReadiness,
}: TemplatesTemplateLibraryRowProps) {
  const { template, options, sections, items } = graph;
  const sortedOptions = sortTemplateOptionsByOrder(options);
  const catalogLinkedCount = countCatalogLinkedTemplateItems(graph);
  const statusLabel = proposalTemplateStatusLabel(template.status);
  const readinessLabel = proposalTemplateReadinessStatusLabel(proposalReadiness.status);
  const readinessPill = proposalTemplateReadinessStatusPillClass(proposalReadiness.status);

  return (
    <article className={TEMPLATES_LIBRARY_ROW}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{template.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {sortedOptions.length} options · {sections.length} sections · {items.length} line items
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
            {statusLabel}
          </span>
          <span className={readinessPill}>{readinessLabel}</span>
        </div>
      </div>

      {template.description ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{template.description}</p>
      ) : null}

      <p className="mt-2 text-xs text-slate-600">
        {catalogLinkedCount} catalog-linked lines · {proposalReadiness.missing_catalog_item_count}{" "}
        missing links · {proposalReadiness.priced_catalog_item_count} priced (linked)
      </p>

      {sortedOptions.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {sortedOptions.map((option) => (
            <li
              key={option.id}
              className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs text-slate-800"
            >
              {option.customer_label ?? option.name}
              {option.is_default ? " (default)" : ""}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
