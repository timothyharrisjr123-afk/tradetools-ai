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
  BUILDER_INTERNAL_PROFITABILITY_LABEL_COST,
  BUILDER_INTERNAL_PROFITABILITY_LABEL_MARGIN,
  BUILDER_INTERNAL_PROFITABILITY_LABEL_PROFIT,
  BUILDER_INTERNAL_PROFITABILITY_SECTION_NOTE,
  BUILDER_INTERNAL_PROFITABILITY_SECTION_TITLE,
  BUILDER_RAIL_ACTIONS_NOTE,
  BUILDER_RAIL_BLOCKING_LINES_LABEL,
  BUILDER_RAIL_CARD,
  BUILDER_RAIL_GROUP_HEADING,
  BUILDER_RAIL_GUARDRAIL_LABEL,
  BUILDER_RAIL_PRICING_CONFIDENCE_TITLE,
  BUILDER_RAIL_PRICING_STATUS_LABEL,
  BUILDER_RAIL_SETUP_READINESS_TITLE,
  BUILDER_RAIL_STAT,
  formatOptionPricingTabStatusLabel,
  formatPricingPolicyConfiguredLabel,
  guardrailOutcomePillClass,
  guardrailRailMessage,
  guardrailRailStatusLabel,
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
    <div className={`${BUILDER_RAIL_STAT} flex items-baseline justify-between gap-2`}>
      <p className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="truncate text-right text-xs font-medium text-slate-900">{value}</p>
    </div>
  );
}

function RailGroupHeading({ title }: { title: string }) {
  return <p className={`${BUILDER_RAIL_GROUP_HEADING} pb-0.5`}>{title}</p>;
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

  const guardrailChecking = selectedOptionPricingStatus == null;
  const guardrailOutcome = selectedOptionPricingStatus?.guardrailOutcome ?? null;
  const guardrailPillKey = guardrailChecking
    ? "checking"
    : guardrailOutcome ?? "checking";
  const guardrailMessage = guardrailRailMessage(guardrailOutcome, guardrailChecking);

  return (
    <div className={`${BUILDER_RAIL_CARD} space-y-3`}>
      <div className="space-y-1">
        <RailGroupHeading title={BUILDER_RAIL_SETUP_READINESS_TITLE} />
        <RailStat label="Measurement" value={measurementStatus} />
        <RailStat label="Quantities" value={quantitiesDisplay} />
        {measurementHandoff?.selectedLabel ? (
          <RailStat label="Record" value={measurementHandoff.selectedLabel} />
        ) : null}
        <div className={`${BUILDER_RAIL_STAT} flex items-center justify-between gap-2`}>
          <p className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Catalog
          </p>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
            <span className={catalogReadinessStatusPillClass(catalogReadiness.state)}>
              {catalogLabel}
            </span>
            <span className="text-[11px] text-slate-600">{catalogReadiness.activeItemCount} active</span>
          </div>
        </div>
        <div className={`${BUILDER_RAIL_STAT} flex items-center justify-between gap-2`}>
          <p className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Template
          </p>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
            <span className={proposalTemplateReadinessStatusPillClass(templateReadiness.status)}>
              {templateLabel}
            </span>
            <span className="truncate text-[11px] text-slate-600" title={templateName}>
              {templateName}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1 border-t border-slate-100 pt-2">
        <RailGroupHeading title={BUILDER_RAIL_PRICING_CONFIDENCE_TITLE} />
        <RailStat
          label="Pricing policy"
          value={pricingPolicyRailStatusLabel(
            pricingPolicyLoadComplete,
            pricingPolicyConfigured
          )}
        />
        {selectedOptionPricingStatus ? (
          <>
            <RailStat
              label={BUILDER_RAIL_PRICING_STATUS_LABEL}
              value={formatOptionPricingTabStatusLabel(
                selectedOptionPricingStatus.pricingComplete
              )}
            />
            <RailStat
              label={BUILDER_RAIL_BLOCKING_LINES_LABEL}
              value={String(selectedOptionPricingStatus.blockingLineCount)}
            />
          </>
        ) : null}
        <div className={`${BUILDER_RAIL_STAT} flex items-center justify-between gap-2`}>
          <p className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {BUILDER_RAIL_GUARDRAIL_LABEL}
          </p>
          <span className={guardrailOutcomePillClass(guardrailPillKey)}>
            {guardrailRailStatusLabel(guardrailOutcome, guardrailChecking)}
          </span>
        </div>
        {guardrailMessage ? (
          <p className="px-0.5 text-[11px] leading-snug text-slate-600">{guardrailMessage}</p>
        ) : null}
        <div className={BUILDER_RAIL_STAT}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {BUILDER_INTERNAL_PROFITABILITY_SECTION_TITLE}
            </p>
            {!internalProfitability.warningCopy ? (
              <p className="text-[10px] text-slate-500">{BUILDER_INTERNAL_PROFITABILITY_SECTION_NOTE}</p>
            ) : null}
          </div>
          {internalProfitability.warningCopy ? (
            <p className="mt-1 text-[11px] leading-snug text-amber-800">
              {internalProfitability.warningCopy}
            </p>
          ) : null}
          {internalProfitability.shouldShowInternalNumbers ? (
            <dl className="mt-1.5 grid grid-cols-3 gap-1">
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {BUILDER_INTERNAL_PROFITABILITY_LABEL_COST}
                </dt>
                <dd className="text-xs tabular-nums font-medium text-slate-900">
                  {internalProfitability.costDisplay}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {BUILDER_INTERNAL_PROFITABILITY_LABEL_PROFIT}
                </dt>
                <dd className="text-xs tabular-nums font-medium text-slate-900">
                  {internalProfitability.profitDisplay}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {BUILDER_INTERNAL_PROFITABILITY_LABEL_MARGIN}
                </dt>
                <dd className="text-xs tabular-nums font-medium text-slate-900">
                  {internalProfitability.marginDisplay}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      </div>

      <p className="text-[11px] leading-snug text-slate-500">{BUILDER_RAIL_ACTIONS_NOTE}</p>
    </div>
  );
}
