"use client";

import { useState } from "react";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import ProposalBuilderOptionsPanel from "./ProposalBuilderOptionsPanel";
import ProposalBuilderPackageCards from "./ProposalBuilderPackageCards";
import { resolvePackageMeta } from "@/app/lib/proposalPackagePresentation";

type ProposalBuilderPackageSelectorProps = {
  graph: ProposalTemplateGraph;
  /** Raw explicit selection (null until the contractor picks). */
  selectedOptionId: string | null;
  /** Option actually driving the estimate document (falls back to default). */
  effectiveOptionId: string | null;
  onSelectOption: (optionId: string) => void;
};

/**
 * 3J4C3 — document-flow package selector.
 *
 * Before an explicit selection: the full option cards are shown (choose).
 * After selection: collapses to a compact selected-package summary with a
 * "Change package" affordance that re-expands the cards. Selection still routes
 * through onSelectOption — persistence behavior is unchanged.
 */
export default function ProposalBuilderPackageSelector({
  graph,
  selectedOptionId,
  effectiveOptionId,
  onSelectOption,
}: ProposalBuilderPackageSelectorProps) {
  const hasExplicitSelection = (selectedOptionId ?? "").trim().length > 0;
  const [showAll, setShowAll] = useState(!hasExplicitSelection);
  const [showDetails, setShowDetails] = useState(false);

  const options = sortTemplateOptionsByOrder(graph.options);
  const summaryOption =
    options.find((o) => o.id === effectiveOptionId) ?? options[0] ?? null;

  const collapsed = hasExplicitSelection && summaryOption != null && !showAll;

  if (collapsed && summaryOption) {
    const label =
      (summaryOption.customer_label ?? summaryOption.name).trim() || summaryOption.name;
    const meta = resolvePackageMeta(label);

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200/90 bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
            <Check className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Selected package
            </p>
            <p className="truncate text-base font-semibold leading-tight text-slate-950" title={label}>
              {label}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-slate-600">{meta.description}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
              {meta.bullets.map((bullet, index) => (
                <span key={bullet} className="inline-flex items-center gap-1.5">
                  {index > 0 ? <span className="text-slate-300" aria-hidden>·</span> : null}
                  {bullet}
                </span>
              ))}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDetails((open) => !open)}
              aria-expanded={showDetails}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              {showDetails ? "Hide details" : "View details"}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Change package
            </button>
          </div>
        </div>

        {showDetails ? (
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 px-4 py-4">
            <ProposalBuilderOptionsPanel graph={graph} selectedOptionId={effectiveOptionId} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {hasExplicitSelection ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Choose the customer-facing package
          </p>
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      ) : null}

      <ProposalBuilderPackageCards
        graph={graph}
        selectedOptionId={effectiveOptionId}
        onSelectOption={(optionId) => {
          onSelectOption(optionId);
          setShowAll(false);
        }}
      />
    </div>
  );
}
