import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import { formatProposalQuantitiesDisplay } from "@/app/lib/measurementProposalHandoff";
import type { MeasurementQuantityMap } from "@/app/lib/measurementTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalBuilderPricingPreview } from "@/app/lib/proposalBuilderPricingPreview";
import {
  getDefaultSelectedOptionId,
  getSectionsForOption,
} from "@/app/lib/proposalBuilderPreview";
import ProposalBuilderOptionTabs from "./ProposalBuilderOptionTabs";
import ProposalBuilderSectionPreview from "./ProposalBuilderSectionPreview";
import ProposalBuilderDocumentTotals from "./ProposalBuilderDocumentTotals";
import {
  BUILDER_CANVAS_PLACEHOLDER,
  BUILDER_CONTEXT_STRIP,
  BUILDER_DOCUMENT_PAGE,
  BUILDER_DOCUMENT_SURFACE,
} from "./proposalBuilderConstants";
import { STARTER_TEMPLATE_DISPLAY_NAME } from "@/app/tools/roofing/templates/templatesSetupUtils";

type ProposalBuilderCanvasProps = {
  starterGraph: ProposalTemplateGraph | null;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  catalogItems: CatalogItem[];
  measurementHandoff: MeasurementProposalHandoff | null;
  measurementQuantityMap: MeasurementQuantityMap | null;
  pricingPreview: ProposalBuilderPricingPreview | null;
  /** 3I-3B3c: drives preview banner/footer copy. Defaults to placeholder behavior. */
  pricingPolicyConfigured?: boolean;
};

function buildMeasurementContextLine(handoff: MeasurementProposalHandoff | null): string | null {
  if (!handoff) return null;
  const quantities = formatProposalQuantitiesDisplay(handoff.quantities);
  if (quantities === "—") return null;
  return `Measurement context: ${quantities}`;
}

export default function ProposalBuilderCanvas({
  starterGraph,
  selectedOptionId,
  onSelectOption,
  catalogItems,
  measurementHandoff,
  measurementQuantityMap,
  pricingPreview,
  pricingPolicyConfigured = false,
}: ProposalBuilderCanvasProps) {
  const templateName = starterGraph?.template.name ?? STARTER_TEMPLATE_DISPLAY_NAME;
  const effectiveOptionId =
    selectedOptionId ??
    (starterGraph ? getDefaultSelectedOptionId(starterGraph) : null);

  const sections =
    starterGraph && effectiveOptionId
      ? getSectionsForOption(starterGraph, effectiveOptionId)
      : [];

  const measurementContextLine = buildMeasurementContextLine(measurementHandoff);

  const optionCustomerView =
    effectiveOptionId != null
      ? (pricingPreview?.byOptionId[effectiveOptionId]?.customer ?? null)
      : null;

  const optionPricingCompleteById = pricingPreview
    ? Object.fromEntries(
        Object.entries(pricingPreview.byOptionId).map(([optionId, preview]) => [
          optionId,
          preview.status.pricingComplete,
        ])
      )
    : undefined;

  if (!starterGraph) {
    return (
      <div className={BUILDER_DOCUMENT_SURFACE}>
        <div className={`${BUILDER_DOCUMENT_PAGE} space-y-4`}>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Proposal preview</h2>
            <p className="mt-1 text-sm text-slate-500">Template graph is not available.</p>
          </div>
          <div className={BUILDER_CANVAS_PLACEHOLDER}>
            <p className="text-sm font-medium text-slate-700">{templateName}</p>
            <p className="mt-2 text-xs text-slate-500">Install the starter template to preview lines.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={BUILDER_DOCUMENT_SURFACE}>
      <article className={`${BUILDER_DOCUMENT_PAGE} space-y-8`}>
        <header className="space-y-4 border-b border-slate-200/90 pb-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
              Proposal document
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{templateName}</h2>
            {(starterGraph.template.description ?? "").trim() ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {starterGraph.template.description}
              </p>
            ) : null}
          </div>

          <ProposalBuilderOptionTabs
            graph={starterGraph}
            selectedOptionId={effectiveOptionId}
            onSelectOption={onSelectOption}
            optionPricingCompleteById={optionPricingCompleteById}
          />

          {measurementContextLine ? (
            <p className={BUILDER_CONTEXT_STRIP}>{measurementContextLine}</p>
          ) : null}
        </header>

        <div className="space-y-10">
          {sections.length === 0 ? (
            <p className="text-sm text-slate-500">No sections for the selected option.</p>
          ) : (
            sections.map((section) => (
              <ProposalBuilderSectionPreview
                key={section.id}
                graph={starterGraph}
                section={section}
                catalogItems={catalogItems}
                measurementHandoff={measurementHandoff}
                measurementQuantityMap={measurementQuantityMap}
                optionCustomerView={optionCustomerView}
                pricingPolicyConfigured={pricingPolicyConfigured}
              />
            ))
          )}
        </div>

        <ProposalBuilderDocumentTotals
          optionCustomerView={optionCustomerView}
          pricingPolicyConfigured={pricingPolicyConfigured}
        />
      </article>
    </div>
  );
}
