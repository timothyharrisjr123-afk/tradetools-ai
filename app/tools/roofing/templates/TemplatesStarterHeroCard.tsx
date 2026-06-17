"use client";

import {
  formatCatalogReadinessLabel,
  type CatalogReadinessSummary,
} from "@/app/lib/catalogReadiness";
import {
  formatProposalTemplateNextStepCopy,
  formatProposalTemplateReadinessLabel,
  proposalTemplateReadinessStatusPillClass,
} from "@/app/lib/proposalTemplateReadiness";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import type { InstallDefaultRoofingProposalTemplatesResult } from "@/app/lib/defaultRoofingProposalTemplateInstall";
import {
  TEMPLATES_CARD,
  TEMPLATES_COMPACT_STAT,
  TEMPLATES_HERO_CARD,
  TEMPLATES_OPTION_CHIP,
  catalogReadinessStatusPillClass,
} from "./templatesConstants";
import {
  STARTER_TEMPLATE_DISPLAY_DESCRIPTION,
  STARTER_TEMPLATE_DISPLAY_NAME,
  getPassiveStarterOptionLabels,
} from "./templatesSetupUtils";
import TemplatesInstallFeedback from "./TemplatesInstallFeedback";

type TemplatesStarterHeroCardProps = {
  loading: boolean;
  catalogReady: boolean;
  catalogReadiness: CatalogReadinessSummary;
  proposalReadiness: ProposalTemplateReadiness;
  starterInstalled: boolean;
  installButtonLabel: string;
  installDisabled: boolean;
  installDisabledTitle?: string;
  onInstallStarter: () => void;
  installResult: InstallDefaultRoofingProposalTemplatesResult | null;
  compact?: boolean;
};

export default function TemplatesStarterHeroCard({
  loading,
  catalogReady,
  catalogReadiness,
  proposalReadiness,
  starterInstalled,
  installButtonLabel,
  installDisabled,
  installDisabledTitle,
  onInstallStarter,
  installResult,
  compact = false,
}: TemplatesStarterHeroCardProps) {
  const optionLabels = getPassiveStarterOptionLabels();
  const catalogPill = catalogReadinessStatusPillClass(catalogReadiness.state);
  const proposalPill = proposalTemplateReadinessStatusPillClass(proposalReadiness.status);
  const proposalLabel = formatProposalTemplateReadinessLabel(proposalReadiness);
  const proposalNextStep = formatProposalTemplateNextStepCopy(proposalReadiness);
  const catalogLabel = formatCatalogReadinessLabel(catalogReadiness);

  return (
    <section
      className={compact ? TEMPLATES_CARD : TEMPLATES_HERO_CARD}
      aria-labelledby="templates-starter-hero-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {compact ? "Starter template install" : "Starter template"}
          </p>
          <h2
            id="templates-starter-hero-heading"
            className={`mt-1 font-semibold text-slate-900 ${compact ? "text-base" : "text-lg"}`}
          >
            {STARTER_TEMPLATE_DISPLAY_NAME}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {!loading && (
            <>
              <span className={catalogPill} title="Catalog dependency">
                Catalog: {catalogLabel}
              </span>
              <span className={proposalPill}>{proposalLabel}</span>
            </>
          )}
          {starterInstalled && !loading && (
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
              Installed
            </span>
          )}
        </div>
      </div>

      {!compact && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          {STARTER_TEMPLATE_DISPLAY_DESCRIPTION}
        </p>
      )}

      {!compact && optionLabels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {optionLabels.map((label) => (
            <span key={label} className={TEMPLATES_OPTION_CHIP}>
              {label}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-slate-600">
        {loading ? "Loading template state…" : proposalNextStep}
      </p>

      {!loading && !compact && (
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className={TEMPLATES_COMPACT_STAT}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Linked
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
              {proposalReadiness.linked_catalog_item_count}
            </dd>
          </div>
          <div className={TEMPLATES_COMPACT_STAT}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Missing links
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
              {proposalReadiness.missing_catalog_item_count}
            </dd>
          </div>
          <div className={TEMPLATES_COMPACT_STAT}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Priced (linked)
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
              {proposalReadiness.priced_catalog_item_count}
            </dd>
          </div>
          <div className={TEMPLATES_COMPACT_STAT}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Options
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
              {proposalReadiness.option_count || optionLabels.length}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={installDisabled}
          title={installDisabledTitle}
          onClick={onInstallStarter}
          className={`rounded-md px-4 py-2 text-sm font-semibold shadow-sm ${
            installDisabled
              ? "cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400"
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {installButtonLabel}
        </button>
        {!catalogReady && (
          <span className="text-xs text-slate-500">Complete catalog setup first</span>
        )}
        {catalogReady && starterInstalled && (
          <span className="text-xs text-slate-500">Recheck is insert-only</span>
        )}
      </div>

      {installResult ? <TemplatesInstallFeedback result={installResult} /> : null}
    </section>
  );
}
