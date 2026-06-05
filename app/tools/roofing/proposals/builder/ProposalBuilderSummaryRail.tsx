import {
  formatCatalogReadinessLabel,
  type CatalogReadinessSummary,
} from "@/app/lib/catalogReadiness";
import {
  formatProposalQuantitiesDisplay,
  type MeasurementProposalHandoff,
} from "@/app/lib/measurementProposalHandoff";
import type { ProposalBuilderOptionStatus } from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import { formatProposalTemplateReadinessLabel } from "@/app/lib/proposalTemplateReadiness";
import { proposalTemplateReadinessStatusPillClass } from "@/app/lib/proposalTemplateReadiness";
import { catalogReadinessStatusPillClass } from "@/app/tools/roofing/templates/templatesConstants";
import {
  BUILDER_CARD,
  BUILDER_RAIL_STAT,
  formatGuardrailOutcomeLabel,
  formatOptionPricingTabStatusLabel,
} from "./proposalBuilderConstants";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";

type ProposalBuilderSummaryRailProps = {
  measurementHandoff: MeasurementProposalHandoff | null;
  catalogReadiness: CatalogReadinessSummary;
  templateReadiness: ProposalTemplateReadiness;
  starterGraph: ProposalTemplateGraph | null;
  /** Selected option pricing status — words only, no dollars. */
  selectedOptionPricingStatus: ProposalBuilderOptionStatus | null;
};

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
}: ProposalBuilderSummaryRailProps) {
  const quantitiesDisplay = measurementHandoff
    ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
    : "—";
  const measurementStatus = measurementHandoff?.proposalReady ? "Ready" : "Not ready";
  const catalogLabel = formatCatalogReadinessLabel(catalogReadiness);
  const templateLabel = formatProposalTemplateReadinessLabel(templateReadiness);
  const templateName = starterGraph?.template.name ?? "Starter template";

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
        {selectedOptionPricingStatus ? (
          <div className={BUILDER_RAIL_STAT}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Pricing</p>
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
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        Margin, markup, customer preview, send, sign, and payment controls are disabled in this
        stage. No proposal record or line snapshots are persisted.
      </p>
    </div>
  );
}
