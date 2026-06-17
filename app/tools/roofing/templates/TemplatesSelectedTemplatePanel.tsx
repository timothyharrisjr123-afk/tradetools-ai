"use client";

import { proposalTemplateStatusLabel } from "@/app/lib/proposalTemplateTypes";
import type { TemplateContentEditorViewModel } from "@/app/lib/proposalTemplateContentEditorView";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import { TEMPLATES_CARD } from "./templatesConstants";
import { summarizeSelectedTemplateGraph } from "./templatesWorkspaceUtils";

type TemplatesSelectedTemplatePanelProps = {
  graph: ProposalTemplateGraph;
  contentViewModel: TemplateContentEditorViewModel;
};

export default function TemplatesSelectedTemplatePanel({
  graph,
  contentViewModel,
}: TemplatesSelectedTemplatePanelProps) {
  const { template } = graph;
  const summary = summarizeSelectedTemplateGraph(graph);
  const statusLabel = proposalTemplateStatusLabel(template.status);

  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-selected-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Selected template
          </p>
          <h2 id="templates-selected-heading" className="mt-1 text-lg font-semibold text-slate-900">
            {template.name}
          </h2>
          {template.description ? (
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{template.description}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          {statusLabel}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Options
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {summary.optionCount}
          </dd>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Sections
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {summary.sectionCount}
          </dd>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Line items
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {summary.lineItemCount}
          </dd>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Editable prose
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
            {contentViewModel.totalEditableSectionCount}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-slate-500">
        Master template content below saves per section and applies to future proposal drafts.
        Template structure and estimate settings expand in a later stage.
      </p>
    </section>
  );
}
