import { CheckCircle2, ImageIcon } from "lucide-react";
import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import { formatProposalQuantitiesDisplay } from "@/app/lib/measurementProposalHandoff";
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
  type BuilderWorkspaceSectionId,
} from "@/app/lib/proposalBuilderNavigation";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";
import ProposalBuilderDocumentTotals from "./ProposalBuilderDocumentTotals";
import ProposalBuilderOverviewPanel from "./ProposalBuilderOverviewPanel";
import ProposalBuilderPackageCards from "./ProposalBuilderPackageCards";
import ProposalBuilderSectionPreview from "./ProposalBuilderSectionPreview";
import ProposalBuilderWorkspaceTabs from "./ProposalBuilderWorkspaceTabs";
import {
  BUILDER_CANVAS,
  BUILDER_CANVAS_HERO_DIVIDER,
  BUILDER_CANVAS_INNER,
  BUILDER_CANVAS_KICKER,
  BUILDER_CANVAS_PLACEHOLDER,
  BUILDER_CANVAS_SUBTITLE,
  BUILDER_CANVAS_TITLE,
  BUILDER_PROJECT_IMAGE,
  BUILDER_SNAPSHOT_BADGE,
} from "./proposalBuilderConstants";
import { STARTER_TEMPLATE_DISPLAY_NAME } from "@/app/tools/roofing/templates/templatesSetupUtils";
import { sortTemplateOptionsByOrder } from "@/app/tools/roofing/templates/templatesSetupUtils";

type ProposalBuilderCanvasProps = {
  starterGraph: ProposalTemplateGraph | null;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  catalogItems: CatalogItem[];
  measurementHandoff: MeasurementProposalHandoff | null;
  measurementQuantityMap: MeasurementQuantityMap | null;
  pricingPreview: ProposalBuilderPricingPreview | null;
  snapshotQuantityByTemplateItemId?: Record<string, ProposalSnapshotLineQuantityView> | null;
  isPersistedSnapshot?: boolean;
  snapshotMeasurementDisplay?: string | null;
  pricingPolicyConfigured?: boolean;
  activePageContextId: BuilderPageContextId;
  activeWorkspaceSection: BuilderWorkspaceSectionId;
  onSelectWorkspaceSection: (section: BuilderWorkspaceSectionId) => void;
  persistedPages: ProposalPageRow[] | null | undefined;
  proposalId: string | null;
  recordLabel: string;
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

function ProjectImagePlaceholder() {
  return (
    <div className={BUILDER_PROJECT_IMAGE}>
      <div
        className="absolute inset-0 bg-gradient-to-br from-sky-200 via-slate-200 to-emerald-200"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.85),transparent_32%),linear-gradient(to_top,rgba(15,23,42,0.42),transparent_58%)]"
        aria-hidden
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-950/35 to-transparent"
        aria-hidden
      />
      <div
        className="absolute bottom-12 left-1/2 h-16 w-40 -translate-x-1/2 rounded-t-[2rem] bg-slate-800/70 shadow-2xl"
        aria-hidden
      />
      <div
        className="absolute bottom-12 left-1/2 h-12 w-60 -translate-x-1/2 bg-slate-950/75 [clip-path:polygon(50%_0,100%_100%,0_100%)]"
        aria-hidden
      />
      <span className="absolute left-4 top-4 rounded-md bg-slate-900/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
        Project image
      </span>
      <button
        type="button"
        disabled
        className="absolute bottom-4 right-4 z-10 inline-flex cursor-not-allowed items-center rounded-md border border-white/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-lg"
        title="Image management — available in a later phase"
      >
        <ImageIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        Change image
      </button>
    </div>
  );
}

function resolvePackageMetaLabel(graph: ProposalTemplateGraph, optionId: string | null): string {
  const options = sortTemplateOptionsByOrder(graph.options);
  const match = options.find((o) => o.id === optionId);
  if (!match) return "—";
  return (match.customer_label ?? match.name).trim() || match.name;
}

function SnapshotTrustBand({
  isPersistedSnapshot,
  measurementHandoff,
  activeWorkspaceSection,
  onSelectWorkspaceSection,
}: {
  isPersistedSnapshot: boolean;
  measurementHandoff: MeasurementProposalHandoff | null;
  activeWorkspaceSection: BuilderWorkspaceSectionId;
  onSelectWorkspaceSection: (section: BuilderWorkspaceSectionId) => void;
}) {
  const showPersisted = isPersistedSnapshot;
  const showLive = !isPersistedSnapshot && measurementHandoff?.proposalReady;

  if (!showPersisted && !showLive) return null;

  return (
    <div className="px-7 pb-1 pt-4">
      <div className={BUILDER_SNAPSHOT_BADGE}>
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <p className="text-sm font-medium text-emerald-900">
              {showPersisted ? "Snapshot measurement ready" : "Measurement ready"}
            </p>
            <p className="text-xs text-emerald-800/80">
              {showPersisted ? "Using saved measurement snapshot" : "Using job measurement record"}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={activeWorkspaceSection === "quantities"}
          onClick={() => onSelectWorkspaceSection("quantities")}
          className={`shrink-0 text-xs font-semibold ${
            activeWorkspaceSection === "quantities"
              ? "text-slate-400"
              : "text-blue-700 hover:text-blue-800"
          }`}
        >
          View details
        </button>
      </div>
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
  isPersistedSnapshot = false,
  snapshotMeasurementDisplay,
  pricingPolicyConfigured = false,
  activePageContextId,
  activeWorkspaceSection,
  onSelectWorkspaceSection,
  persistedPages,
  proposalId,
  recordLabel,
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

  const optionPricingComplete =
    effectiveOptionId != null
      ? (pricingPreview?.byOptionId[effectiveOptionId]?.status.pricingComplete ?? null)
      : null;

  const overviewText =
    (starterGraph?.template.description ?? "").trim() ||
    "Starter roof replacement template with Standard, Enhanced, and Premium customer-facing options. Install catalog items before use.";

  const quantitiesDetail = isPersistedSnapshot
    ? (snapshotMeasurementDisplay ?? "").trim() || "—"
    : measurementHandoff
      ? formatProposalQuantitiesDisplay(measurementHandoff.quantities)
      : "—";

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

  const packageLabel = resolvePackageMetaLabel(starterGraph, effectiveOptionId);
  const selectedOption = sortTemplateOptionsByOrder(starterGraph.options).find(
    (o) => o.id === effectiveOptionId
  );

  return (
    <article className={BUILDER_CANVAS}>
      <header className={BUILDER_CANVAS_HERO_DIVIDER}>
        <div className="grid gap-8 px-7 py-7 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_410px]">
          <div className="min-w-0 space-y-5">
            <div>
              <p className={BUILDER_CANVAS_KICKER}>Proposal estimate</p>
              <h2 className={BUILDER_CANVAS_TITLE}>{templateName}</h2>
              <p className={BUILDER_CANVAS_SUBTITLE}>Choose a package to build your proposal.</p>
            </div>

            <ProposalBuilderPackageCards
              graph={starterGraph}
              selectedOptionId={effectiveOptionId}
              onSelectOption={onSelectOption}
            />
          </div>

          <div className="hidden xl:flex xl:items-end xl:justify-end xl:pb-2">
            <ProjectImagePlaceholder />
          </div>
        </div>
      </header>

      <SnapshotTrustBand
        isPersistedSnapshot={isPersistedSnapshot}
        measurementHandoff={measurementHandoff}
        activeWorkspaceSection={activeWorkspaceSection}
        onSelectWorkspaceSection={onSelectWorkspaceSection}
      />

      <div className="mt-5">
        <ProposalBuilderWorkspaceTabs
          activeSection={activeWorkspaceSection}
          onSelectSection={onSelectWorkspaceSection}
        />
      </div>

      <div role="tabpanel" className="min-h-[16rem] px-7 py-6">
        {activeWorkspaceSection === "overview" ? (
          <ProposalBuilderOverviewPanel
            recordLabel={recordLabel}
            packageLabel={packageLabel}
            templateName={templateName}
            pricingComplete={optionPricingComplete}
            proposalOverviewText={overviewText}
            proposalId={proposalId}
            pricingPolicyConfigured={pricingPolicyConfigured}
          />
        ) : null}

        {activeWorkspaceSection === "options" ? (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Package details</h3>
            {selectedOption ? (
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-4 py-4">
                <p className="text-base font-semibold text-slate-900">
                  {(selectedOption.customer_label ?? selectedOption.name).trim() || selectedOption.name}
                </p>
                {(selectedOption.name ?? "").trim() &&
                selectedOption.customer_label &&
                selectedOption.name !== selectedOption.customer_label ? (
                  <p className="mt-1 text-xs text-slate-500">Internal name: {selectedOption.name}</p>
                ) : null}
                <p className="mt-3 text-sm text-slate-600">
                  Option details will be editable in a later draft editing step. Use the package cards
                  above to change the selected customer-facing option.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Option details will be editable in a later draft editing step.
              </p>
            )}
          </div>
        ) : null}

        {activeWorkspaceSection === "sections" ? (
          <div className="space-y-4">
            {sections.length === 0 ? (
              <p className="text-sm text-slate-500">No sections for the selected option.</p>
            ) : (
              sections.map((section) => (
                <div
                  key={section.id}
                  className="rounded-lg border border-slate-200/80 bg-slate-50/30 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {(section.customer_title ?? section.name).trim() || section.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 capitalize">{section.kind.replace(/_/g, " ")}</p>
                </div>
              ))
            )}
          </div>
        ) : null}

        {activeWorkspaceSection === "lines" ? (
          <div className="space-y-10">
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
        ) : null}

        {activeWorkspaceSection === "quantities" ? (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Quantity details</h3>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {isPersistedSnapshot ? "Snapshot quantities" : "Measurement quantities"}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">{quantitiesDetail}</p>
              {isPersistedSnapshot ? (
                <p className="mt-2 text-xs text-slate-500">
                  Quantities reflect the saved proposal snapshot, not the live job measurement.
                </p>
              ) : null}
            </div>
            {measurementHandoff?.selectedLabel ? (
              <p className="text-xs text-slate-500">Record: {measurementHandoff.selectedLabel}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
