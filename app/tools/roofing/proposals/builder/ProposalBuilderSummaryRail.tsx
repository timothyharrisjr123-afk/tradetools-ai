import {
  formatCatalogReadinessLabel,
  type CatalogReadinessSummary,
} from "@/app/lib/catalogReadiness";
import {
  formatProposalQuantitiesDisplay,
  type MeasurementProposalHandoff,
} from "@/app/lib/measurementProposalHandoff";
import type { ProposalTemplateReadiness } from "@/app/lib/proposalTemplateTypes";
import { formatProposalTemplateReadinessLabel } from "@/app/lib/proposalTemplateReadiness";
import { proposalTemplateReadinessStatusPillClass } from "@/app/lib/proposalTemplateReadiness";
import { catalogReadinessStatusPillClass } from "@/app/tools/roofing/templates/templatesConstants";
import { BUILDER_CARD, BUILDER_RAIL_STAT } from "./proposalBuilderConstants";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";

type ProposalBuilderSummaryRailProps = {
  measurementHandoff: MeasurementProposalHandoff | null;
  catalogReadiness: CatalogReadinessSummary;
  templateReadiness: ProposalTemplateReadiness;
  starterGraph: ProposalTemplateGraph | null;
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
        <h2 className="text-sm font-semibold text-slate-900">Setup summary</h2>
        <p className="mt-1 text-xs text-slate-500">Read-only context for this Builder shell.</p>
      </div>
      <div className="space-y-2">
        <RailStat label="Measurement" value={measurementStatus} />
        <RailStat label="Quantities" value={quantitiesDisplay} />
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
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        Margin, markup, customer preview, send, sign, and payment controls are disabled in this
        stage. No proposal record or line snapshots are persisted.
      </p>
    </div>
  );
}
