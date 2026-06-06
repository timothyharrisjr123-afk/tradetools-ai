import {
  formatCatalogReadinessLabel,
  type CatalogReadinessSummary,
} from "@/app/lib/catalogReadiness";
import {
  formatProposalQuantitiesDisplay,
  type MeasurementProposalHandoff,
} from "@/app/lib/measurementProposalHandoff";
import type { ProposalBuilderOptionInternalView, ProposalBuilderOptionStatus } from "@/app/lib/proposalBuilderPricingPreview";
import { presentProposalInternalProfitability } from "@/app/lib/proposalProfitabilityPresenter";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import { formatProposalTemplateReadinessLabel } from "@/app/lib/proposalTemplateReadiness";
import { proposalTemplateReadinessStatusPillClass } from "@/app/lib/proposalTemplateReadiness";
import { catalogReadinessStatusPillClass } from "@/app/tools/roofing/templates/templatesConstants";
import {
  BUILDER_CARD,
  BUILDER_INTERNAL_PROFITABILITY_LABEL_COST,
  BUILDER_INTERNAL_PROFITABILITY_LABEL_MARGIN,
  BUILDER_INTERNAL_PROFITABILITY_LABEL_PROFIT,
  BUILDER_INTERNAL_PROFITABILITY_SECTION_NOTE,
  BUILDER_INTERNAL_PROFITABILITY_SECTION_TITLE,
  BUILDER_RAIL_STAT,
  formatGuardrailOutcomeLabel,
  formatOptionPricingTabStatusLabel,
  formatPricingPolicyConfiguredLabel,
} from "./proposalBuilderConstants";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";

type ProposalBuilderSummaryRailProps = {
  measurementHandoff: MeasurementProposalHandoff | null;
  catalogReadiness: CatalogReadinessSummary;
  templateReadiness: ProposalTemplateReadiness;
  starterGraph: ProposalTemplateGraph | null;
  /** Selected option pricing status — words only, no dollars. */
  selectedOptionPricingStatus: ProposalBuilderOptionStatus | null;
  /** 3I-3C: selected option internal profitability (contractor-only). */
  selectedOptionInternal: ProposalBuilderOptionInternalView | null;
  /** 3I-3B3c: company pricing policy configured (status-only; no policy detail). */
  pricingPolicyConfigured?: boolean;
  /** 3I-3B3c: resolver fetch finished — drives Checking vs Configured/Not configured. */
  pricingPolicyLoadComplete?: boolean;
};

function pricingPolicyRailStatusLabel(
  loadComplete: boolean,
  configured: boolean
): string {
  if (!loadComplete) return "Checking…";
  return formatPricingPolicyConfiguredLabel(configured);
}

function RailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={BUILDER_RAIL_STAT}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

export default function ProposalBuilderSummaryRail({
  measurementHandoff,
  catalogReadiness,
  templateReadiness,
  starterGraph,
  selectedOptionPricingStatus,
  selectedOptionInternal,
  pricingPolicyConfigured = false,
  pricingPolicyLoadComplete = false,
}: ProposalBuilderSummaryRailProps) {
  const quantitiesDisplay = measurementHandoff
    ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
    : "—";
  const measurementStatus = measurementHandoff?.proposalReady ? "Ready" : "Not ready";
  const catalogLabel = formatCatalogReadinessLabel(catalogReadiness);
  const templateLabel = formatProposalTemplateReadinessLabel(templateReadiness);
  const templateName = starterGraph?.template.name ?? "Starter template";

  const internalProfitability = presentProposalInternalProfitability({
    internalCostCents: selectedOptionInternal?.internalCostCents ?? null,
    internalProfitCents: selectedOptionInternal?.internalProfitCents ?? null,
    effectiveMarginPct: selectedOptionInternal?.effectiveMarginPct ?? null,
    pricingPolicyConfigured,
    pricingPolicyLoadComplete,
    hasBlockingIssues: selectedOptionPricingStatus
      ? !selectedOptionPricingStatus.pricingComplete
      : false,
  });

  return (
    <div className={`${BUILDER_CARD} space-y-4`}>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Job context</h2>
        <p className="mt-1 text-xs text-slate-500">
          Measurement and setup readiness for this proposal preview.
        </p>
      </div>
      <div className="space-y-2">
        <RailStat label="Measurement" value={measurementStatus} />
        <RailStat label="Quantities" value={quantitiesDisplay} />
        {measurementHandoff?.selectedLabel ? (
          <RailStat label="Record" value={measurementHandoff.selectedLabel} />
        ) : null}
        <div className={BUILDER_RAIL_STAT}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Catalog</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={catalogReadinessStatusPillClass(catalogReadiness.state)}>
              {catalogLabel}
            </span>
            <span className="text-xs text-slate-600">{catalogReadiness.activeItemCount} active</span>
          </div>
        </div>
        <div className={BUILDER_RAIL_STAT}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Template</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={proposalTemplateReadinessStatusPillClass(templateReadiness.status)}>
              {templateLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">{templateName}</p>
        </div>
        <RailStat
          label="Pricing policy"
          value={pricingPolicyRailStatusLabel(
            pricingPolicyLoadComplete,
            pricingPolicyConfigured
          )}
        />
        {selectedOptionPricingStatus ? (
          <div className={BUILDER_RAIL_STAT}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Option pricing
            </p>
            <div className="mt-1 space-y-1">
              <p className="text-sm font-medium text-slate-900">
                {formatOptionPricingTabStatusLabel(selectedOptionPricingStatus.pricingComplete)}
              </p>
              <p className="text-xs text-slate-600">
                Blocking issues: {selectedOptionPricingStatus.blockingLineCount}
              </p>
              <p className="text-xs text-slate-600">
                Guardrail: {formatGuardrailOutcomeLabel(selectedOptionPricingStatus.guardrailOutcome)}
              </p>
            </div>
          </div>
        ) : null}
        <div className={`${BUILDER_RAIL_STAT} border-slate-200/90 bg-slate-100/60`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {BUILDER_INTERNAL_PROFITABILITY_SECTION_TITLE}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            {BUILDER_INTERNAL_PROFITABILITY_SECTION_NOTE}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-700">{internalProfitability.statusLabel}</p>
          {internalProfitability.warningCopy ? (
            <p className="mt-2 text-xs leading-snug text-amber-800">{internalProfitability.warningCopy}</p>
          ) : null}
          {internalProfitability.shouldShowInternalNumbers ? (
            <dl className="mt-2 space-y-1.5">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {BUILDER_INTERNAL_PROFITABILITY_LABEL_COST}
                </dt>
                <dd className="text-sm tabular-nums font-medium text-slate-900">
                  {internalProfitability.costDisplay}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {BUILDER_INTERNAL_PROFITABILITY_LABEL_PROFIT}
                </dt>
                <dd className="text-sm tabular-nums font-medium text-slate-900">
                  {internalProfitability.profitDisplay}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {BUILDER_INTERNAL_PROFITABILITY_LABEL_MARGIN}
                </dt>
                <dd className="text-sm tabular-nums font-medium text-slate-900">
                  {internalProfitability.marginDisplay}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        Customer preview, send, sign, and payment controls are disabled in this stage. No proposal
        record or line snapshots are persisted.
      </p>
    </div>
  );
}
