import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import type { MeasurementQuantityMap } from "@/app/lib/measurementTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalBuilderPricingPreview } from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalSnapshotLineQuantityView } from "@/app/lib/proposalDraftGraphAdapter";
import {
  getDefaultSelectedOptionId,
  getSectionsForOption,
} from "@/app/lib/proposalBuilderPreview";
import {
  isEstimatePageContext,
  isPlaceholderPageContext,
  resolvePageContextDisplayLabel,
  resolvePersistedPageByContextId,
  type BuilderPageContextId,
} from "@/app/lib/proposalBuilderNavigation";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";
import ProposalBuilderDocumentTotals from "./ProposalBuilderDocumentTotals";
import ProposalBuilderPackageSelector from "./ProposalBuilderPackageSelector";
import ProposalBuilderSectionPreview from "./ProposalBuilderSectionPreview";
import {
  BUILDER_CANVAS,
  BUILDER_CANVAS_HERO_DIVIDER,
  BUILDER_CANVAS_INNER,
  BUILDER_CANVAS_KICKER,
  BUILDER_CANVAS_PLACEHOLDER,
  BUILDER_CANVAS_SUBTITLE,
  BUILDER_CANVAS_TITLE,
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
  snapshotQuantityByTemplateItemId?: Record<string, ProposalSnapshotLineQuantityView> | null;
  pricingPolicyConfigured?: boolean;
  activePageContextId: BuilderPageContextId;
  persistedPages: ProposalPageRow[] | null | undefined;
};

function CustomerPagePanel({
  title,
  body,
  placeholder,
}: {
  title: string;
  body: string;
  placeholder?: boolean;
}) {
  return (
    <div className={`${BUILDER_CANVAS_INNER} space-y-4`}>
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
      </div>
      {placeholder ? (
        <div className={`${BUILDER_CANVAS_PLACEHOLDER} min-h-[16rem]`}>
          <p className="text-sm font-medium text-slate-700">Page content comes in a later editing phase.</p>
          <p className="mt-2 text-xs text-slate-500">This page slot is reserved on the final proposal surface.</p>
        </div>
      ) : null}
    </div>
  );
}

export default function ProposalBuilderCanvas({
  starterGraph,
  selectedOptionId,
  onSelectOption,
  catalogItems,
  measurementHandoff,
  measurementQuantityMap,
  pricingPreview,
  snapshotQuantityByTemplateItemId,
  pricingPolicyConfigured = false,
  activePageContextId,
  persistedPages,
}: ProposalBuilderCanvasProps) {
  const templateName = starterGraph?.template.name ?? STARTER_TEMPLATE_DISPLAY_NAME;
  const effectiveOptionId =
    selectedOptionId ?? (starterGraph ? getDefaultSelectedOptionId(starterGraph) : null);

  const sections =
    starterGraph && effectiveOptionId
      ? getSectionsForOption(starterGraph, effectiveOptionId)
      : [];

  const optionCustomerView =
    effectiveOptionId != null
      ? (pricingPreview?.byOptionId[effectiveOptionId]?.customer ?? null)
      : null;

  const optionStatus =
    effectiveOptionId != null
      ? (pricingPreview?.byOptionId[effectiveOptionId]?.status ?? null)
      : null;

  const optionBlockingLineCount = optionStatus?.blockingLineCount ?? 0;
  const optionGuardrailAttention =
    optionStatus != null &&
    optionStatus.pricingComplete &&
    optionStatus.guardrailOutcome !== "pass";

  if (!starterGraph) {
    return (
      <article className={BUILDER_CANVAS}>
        <div className={`${BUILDER_CANVAS_INNER} space-y-4`}>
          <div>
            <p className={BUILDER_CANVAS_KICKER}>Proposal estimate</p>
            <h2 className={BUILDER_CANVAS_TITLE}>Proposal preview</h2>
            <p className={BUILDER_CANVAS_SUBTITLE}>Template graph is not available.</p>
          </div>
          <div className={BUILDER_CANVAS_PLACEHOLDER}>
            <p className="text-sm font-medium text-slate-700">{templateName}</p>
            <p className="mt-2 text-xs text-slate-500">Install the starter template to preview lines.</p>
          </div>
        </div>
      </article>
    );
  }

  if (!isEstimatePageContext(activePageContextId)) {
    const persistedPage = resolvePersistedPageByContextId(persistedPages, activePageContextId);
    const placeholder = isPlaceholderPageContext(activePageContextId);
    const pageTitle = resolvePageContextDisplayLabel(activePageContextId, persistedPages);

    return (
      <article className={BUILDER_CANVAS}>
        <CustomerPagePanel
          title={pageTitle}
          body={
            persistedPage
              ? "Read-only customer page from the saved draft. Full page editing comes in a later phase."
              : "This proposal page is reserved on the final surface. Content editing is not enabled in this stage."
          }
          placeholder={placeholder || !persistedPage}
        />
      </article>
    );
  }

  return (
    <article className={BUILDER_CANVAS}>
      <header className={BUILDER_CANVAS_HERO_DIVIDER}>
        <div className="space-y-4 px-7 pb-5 pt-5">
          <div>
            <div className="flex items-baseline gap-2">
              <p className={BUILDER_CANVAS_KICKER}>Proposal document</p>
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Customer-facing page
              </span>
            </div>
            <h2 className="text-xl font-semibold leading-tight tracking-tight text-slate-950">
              Estimate
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Customer-facing estimate document — package options, line items, and totals.
            </p>
          </div>

          <ProposalBuilderPackageSelector
            graph={starterGraph}
            selectedOptionId={selectedOptionId}
            effectiveOptionId={effectiveOptionId}
            onSelectOption={onSelectOption}
          />
        </div>
      </header>

      {/* 3J4C1: the estimate document is the primary canvas content — sections,
          line items, blocker indicators, and totals render inline (no longer
          hidden behind a Line Items tab). Sections carry their own dividers, so
          the inter-element gap stays modest (3J4D readability). */}
      <div className="space-y-6 px-7 pb-7 pt-6">
        {optionBlockingLineCount > 0 || optionGuardrailAttention ? (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">
              {optionBlockingLineCount > 0
                ? `${optionBlockingLineCount} line item${optionBlockingLineCount === 1 ? "" : "s"} need attention before Preview unlocks.`
                : "Profitability needs contractor review before this option is ready."}
            </p>
            <p className="mt-1 text-xs leading-snug text-amber-800">
              {optionBlockingLineCount > 0
                ? "Missing quantities or catalog prices are flagged below. Fixes happen from Measurement or Catalog setup."
                : "Contractor-only profitability is below target. Review before this option is ready."}
            </p>
          </div>
        ) : null}

        {sections.length === 0 ? (
          <p className="text-sm text-slate-500">No line items for the selected option.</p>
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
              snapshotQuantityByTemplateItemId={snapshotQuantityByTemplateItemId}
              pricingPolicyConfigured={pricingPolicyConfigured}
            />
          ))
        )}

        <ProposalBuilderDocumentTotals
          optionCustomerView={optionCustomerView}
          pricingPolicyConfigured={pricingPolicyConfigured}
        />
      </div>
    </article>
  );
}
