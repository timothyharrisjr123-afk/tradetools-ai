"use client";

import { useState } from "react";
import { Check, ChevronDown, Pencil } from "lucide-react";
import {
  BUILDER_ONLY_ONE_PACKAGE_NOTE,
  canChangeBuilderDraftPackage,
} from "@/app/lib/proposalBuilderDraftPackageOptions";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import ProposalBuilderOptionsPanel from "./ProposalBuilderOptionsPanel";
import ProposalBuilderPackageChoiceList from "./ProposalBuilderPackageChoiceList";
import { resolvePackageMeta } from "@/app/lib/proposalPackagePresentation";

type ProposalBuilderPackageSelectorProps = {
  /**
   * Option list for the picker. On persisted drafts this must already be
   * draft-scoped (live-template-only options removed).
   */
  graph: ProposalTemplateGraph;
  /** Raw explicit selection (null until the contractor picks). */
  selectedOptionId: string | null;
  /** Option actually driving the estimate document (falls back to default). */
  effectiveOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  /**
   * When true (default), Change package follows draft option count.
   * Setup preview without a draft may still offer multi-option template choice.
   */
  draftScoped?: boolean;
  /**
   * Document-led Estimate: quiet Change control only — zone header already
   * names the package. Does not change picker persistence behavior.
   */
  compact?: boolean;
  /** When true, show the compact package choice list (parent-controlled open panel). */
  forceOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
  /** Authoritative total for the currently selected package only. */
  selectedPackageTotalLabel?: string | null;
};

/**
 * Document-flow package selector.
 *
 * Multi-option drafts: collapsed summary + Change package → draft-scoped cards.
 * One-option drafts: selected package only — no Change package, no dead picker.
 */
export default function ProposalBuilderPackageSelector({
  graph,
  selectedOptionId,
  effectiveOptionId,
  onSelectOption,
  draftScoped = false,
  compact = false,
  forceOpen = false,
  onPickerOpenChange,
  selectedPackageTotalLabel = null,
}: ProposalBuilderPackageSelectorProps) {
  const options = sortTemplateOptionsByOrder(graph.options);
  const optionCount = options.length;
  const allowChangePackage = draftScoped
    ? canChangeBuilderDraftPackage(optionCount)
    : optionCount >= 2;

  const hasExplicitSelection = (selectedOptionId ?? "").trim().length > 0;
  const [showAll, setShowAllState] = useState(
    forceOpen || (!hasExplicitSelection && allowChangePackage)
  );
  const [showDetails, setShowDetails] = useState(false);

  const setShowAll = (open: boolean) => {
    setShowAllState(open);
    onPickerOpenChange?.(open);
  };

  const summaryOption =
    options.find((o) => o.id === effectiveOptionId) ?? options[0] ?? null;

  const pickerVisible = forceOpen || showAll;
  const collapsed =
    !pickerVisible &&
    (!allowChangePackage ||
      (hasExplicitSelection && summaryOption != null && !showAll));

  if (!summaryOption) {
    return (
      <p className="text-sm text-slate-500">No package options on this proposal draft.</p>
    );
  }

  if (collapsed) {
    const label =
      (summaryOption.customer_label ?? summaryOption.name).trim() || summaryOption.name;
    const meta = resolvePackageMeta(label, summaryOption.description);

    if (compact) {
      return (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
          data-builder-package-selector
          data-builder-package-count={optionCount}
          data-builder-package-compact-controls
        >
          {allowChangePackage ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-blue-200/80 bg-blue-50/70 px-3 text-[12.5px] font-semibold text-blue-800 transition hover:bg-blue-50"
              data-builder-change-package
              aria-expanded={false}
              aria-haspopup="dialog"
              title="Switch between available packages."
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Change package
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-3" data-builder-package-selector data-builder-package-count={optionCount}>
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
            {!allowChangePackage ? (
              <p
                className="mt-1.5 text-[11px] leading-snug text-slate-500"
                data-builder-only-one-package-note
              >
                {BUILDER_ONLY_ONE_PACKAGE_NOTE}
              </p>
            ) : null}
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
            {allowChangePackage ? (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                data-builder-change-package
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Change package
              </button>
            ) : null}
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
    <div
      className="w-full overflow-visible"
      data-builder-package-selector
      data-builder-package-count={optionCount}
      data-builder-package-picker="open"
    >
      <ProposalBuilderPackageChoiceList
        graph={graph}
        selectedOptionId={effectiveOptionId}
        selectedPackageTotalLabel={selectedPackageTotalLabel}
        onSelectOption={(optionId) => {
          onSelectOption(optionId);
          setShowAll(false);
        }}
      />
    </div>
  );
}
