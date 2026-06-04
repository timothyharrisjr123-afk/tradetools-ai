"use client";

import type { CatalogReadinessSummary } from "@/app/lib/catalogReadiness";
import { formatCatalogSectionStatus } from "@/app/lib/catalogReadiness";
import {
  formatProposalTemplateNextStepCopy,
  formatProposalTemplateReadinessLabel,
} from "@/app/lib/proposalTemplateReadiness";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import { TEMPLATES_CARD, TEMPLATES_CHECKLIST_ITEM } from "./templatesConstants";

type TemplatesSetupChecklistProps = {
  loading: boolean;
  catalogReady: boolean;
  readiness: CatalogReadinessSummary;
  starterInstalled: boolean;
  proposalReadiness: ProposalTemplateReadiness;
};

function stepBadgeClass(done: boolean, active: boolean): string {
  if (done) {
    return "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200";
  }
  if (active) {
    return "rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200";
  }
  return "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200";
}

export default function TemplatesSetupChecklist({
  loading,
  catalogReady,
  readiness,
  starterInstalled,
  proposalReadiness,
}: TemplatesSetupChecklistProps) {
  const catalogSection = formatCatalogSectionStatus(readiness);
  const proposalLabel = formatProposalTemplateReadinessLabel(proposalReadiness);
  const proposalNextStep = formatProposalTemplateNextStepCopy(proposalReadiness);
  const builderReady = proposalReadiness.status === "ready_for_builder";

  return (
    <section className={TEMPLATES_CARD} aria-labelledby="templates-checklist-heading">
      <h2 id="templates-checklist-heading" className="text-sm font-semibold text-slate-900">
        Setup checklist
      </h2>
      <p className="mt-1 text-xs text-slate-500">Company setup before Proposal Builder.</p>

      <ol className="mt-4 space-y-2">
        <li className={TEMPLATES_CHECKLIST_ITEM}>
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
            1
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">Catalog ready</span>
              <span className={stepBadgeClass(catalogSection.ready, !catalogSection.ready && !loading)}>
                {loading ? "…" : catalogSection.ready ? "Done" : "Pending"}
              </span>
            </div>
            {!catalogSection.ready && !loading && (
              <p className="mt-0.5 text-[11px] text-slate-600">{catalogSection.label}</p>
            )}
          </div>
        </li>

        <li className={TEMPLATES_CHECKLIST_ITEM}>
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
            2
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">Starter template</span>
              <span
                className={stepBadgeClass(
                  starterInstalled,
                  catalogReady && !starterInstalled && !loading
                )}
              >
                {loading ? "…" : starterInstalled ? "Installed" : "Pending"}
              </span>
            </div>
            {catalogReady && !starterInstalled && !loading && (
              <p className="mt-0.5 text-[11px] text-slate-600">Install from the template card</p>
            )}
          </div>
        </li>

        <li className={TEMPLATES_CHECKLIST_ITEM}>
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              builderReady ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-500"
            }`}
          >
            3
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">Proposal Builder</span>
              <span className={stepBadgeClass(builderReady, false)}>{loading ? "…" : proposalLabel}</span>
            </div>
            {!loading && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{proposalNextStep}</p>
            )}
          </div>
        </li>
      </ol>
    </section>
  );
}
