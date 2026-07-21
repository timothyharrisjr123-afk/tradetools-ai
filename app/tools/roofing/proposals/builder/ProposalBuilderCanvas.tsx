import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import type { MeasurementQuantityMap } from "@/app/lib/measurementTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalBuilderPricingPreview } from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalSnapshotLineQuantityView } from "@/app/lib/proposalDraftGraphAdapter";
import {
  getDefaultSelectedOptionId,
  getSectionsForOption,
  filterSectionsForEstimateCanvas,
} from "@/app/lib/proposalBuilderPreview";
import {
  isCoverPageContext,
  isEstimatePageContext,
  isPlaceholderPageContext,
  resolvePageContextDisplayLabel,
  resolvePageTypeForContext,
  resolvePersistedPageByContextId,
  type BuilderPageContextId,
} from "@/app/lib/proposalBuilderNavigation";
import type { ProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import type { ProposalDocumentContext } from "@/app/lib/proposalDocumentTokenTypes";
import {
  isEditableProposalPageType,
  readProposalPageBodyMarkdown,
} from "@/app/lib/proposalPageContentEditing";
import {
  getProposalPageVisibilityState,
  type ProposalPageVisibilityState,
} from "@/app/lib/proposalPageVisibilityEditing";
import type { ProposalPageType } from "@/app/lib/proposalPageTypes";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";
import ProposalBuilderCoverPage from "./ProposalBuilderCoverPage";
import ProposalBuilderEditableTextPage from "./ProposalBuilderEditableTextPage";
import ProposalBuilderPageVisibilityControl from "./ProposalBuilderPageVisibilityControl";
import ProposalBuilderWorkbenchEstimateDocument from "./ProposalBuilderWorkbenchEstimateDocument";
import {
  BUILDER_CANVAS,
  BUILDER_CANVAS_HERO_DIVIDER,
  BUILDER_CANVAS_INNER,
  BUILDER_CANVAS_KICKER,
  BUILDER_CANVAS_PLACEHOLDER,
  BUILDER_CANVAS_SUBTITLE,
  BUILDER_CANVAS_TITLE,
  BUILDER_PAGE_HIDDEN_BANNER,
  BUILDER_PAGE_VISIBILITY_REQUIRED_NOTICE,
} from "./proposalBuilderConstants";
import { STARTER_TEMPLATE_DISPLAY_NAME } from "@/app/tools/roofing/templates/templatesSetupUtils";

type ProposalBuilderCanvasProps = {
  starterGraph: ProposalTemplateGraph | null;
  /** Draft-scoped option list for package picker; falls back to starterGraph. */
  packageSelectorGraph?: ProposalTemplateGraph | null;
  draftScopedPackagePicker?: boolean;
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
  coverViewModel?: ProposalCoverViewModel | null;
  proposalDocumentContext?: ProposalDocumentContext | null;
  pricingComplete?: boolean;
  /** R16B — persisted draft path enables page body editing and estimate de-duplication. */
  persistedProposalPath?: boolean;
  pageEditActiveContextId?: BuilderPageContextId | null;
  pageEditDraftBody?: string;
  onPageEditDraftBodyChange?: (value: string) => void;
  onStartPageEdit?: (contextId: BuilderPageContextId, rawBody: string | null) => void;
  onCancelPageEdit?: () => void;
  onSavePageEdit?: () => void;
  pageEditSaveDisabled?: boolean;
  pageEditSaveInFlight?: boolean;
  pageEditSaveError?: string | null;
  onTogglePageVisibility?: (pageId: string, visibleToCustomer: boolean) => void;
  pageVisibilityToggleInFlight?: boolean;
  onToggleEstimateDisplaySetting?: (
    key: import("@/app/tools/roofing/templates/templatesStructureEditorUtils").EstimateSettingsToggleKey,
    nextValue: boolean
  ) => void;
  estimateSettingsSaveInFlight?: boolean;
  estimateSettingsSaveError?: string | null;
  persistedDraftEnabled?: boolean;
  activeScopeDecisionsForOption?: import("@/app/lib/proposalScopeDecisionTypes").ProposalScopeDecision[];
  manualQuantityInFlight?: boolean;
  manualQuantityError?: string | null;
  excludeInFlight?: boolean;
  excludeError?: string | null;
  visibilityInFlight?: boolean;
  visibilityError?: string | null;
  upgradeSelectionInFlight?: boolean;
  upgradeSelectionError?: string | null;
  onApplyManualQuantity?: (
    templateItemId: string,
    quantity: string,
    quantityDisplayLabel?: string | null
  ) => Promise<void>;
  onClearManualQuantity?: (templateItemId: string) => Promise<void>;
  onExcludeLine?: (templateItemId: string) => Promise<void>;
  onRestoreExcludedLine?: (templateItemId: string) => Promise<void>;
  onHideLine?: (templateItemId: string) => Promise<void>;
  onRestoreVisibility?: (templateItemId: string) => Promise<void>;
  onSetUpgradeSelected?: (templateItemId: string, selected: boolean) => Promise<void>;
};

/** 3J4F — text page types that render as read-only customer document pages. */
const CUSTOMER_TEXT_PAGE_TYPES: readonly ProposalPageType[] = [
  "project_overview",
  "terms",
  "warranty",
  "custom_text",
] as const;

function isCustomerTextPageType(pageType: ProposalPageType | null): boolean {
  return pageType != null && CUSTOMER_TEXT_PAGE_TYPES.includes(pageType);
}

/** Page-specific calm empty state shown when no body content exists yet. */
function emptyStateTextForPageType(pageType: ProposalPageType): string {
  switch (pageType) {
    case "project_overview":
      return "Project overview content will appear here.";
    case "terms":
      return "Terms will appear here before sending.";
    case "warranty":
      return "Warranty details will appear here before sending.";
    default:
      return "Page content will appear here.";
  }
}

/** Safely read content_json.body_markdown off a loosely-typed persisted page. */
function readPageBodyMarkdown(page: ProposalPageRow | null): string | null {
  if (!page) return null;
  return readProposalPageBodyMarkdown(page.content_json);
}

function CustomerPagePanel({
  title,
  body,
  placeholder,
  pageVisibility = null,
  onToggleVisibility,
  visibilityToggleInFlight = false,
}: {
  title: string;
  body: string;
  placeholder?: boolean;
  pageVisibility?: ProposalPageVisibilityState | null;
  onToggleVisibility?: () => void;
  visibilityToggleInFlight?: boolean;
}) {
  const showVisibilityControl =
    pageVisibility != null &&
    (pageVisibility.canToggle || pageVisibility.requiredNotice != null);

  return (
    <article className={BUILDER_CANVAS}>
      {showVisibilityControl ? (
        <>
          <div className={`${BUILDER_CANVAS_HERO_DIVIDER} border-b border-slate-200/80 bg-slate-50/60`}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Proposal page workspace
              </p>
              <ProposalBuilderPageVisibilityControl
                pageTitle={title}
                visibleToCustomer={pageVisibility!.visibleToCustomer}
                canToggle={pageVisibility!.canToggle}
                requiredNotice={pageVisibility!.requiredNotice}
                onToggle={onToggleVisibility}
                toggleInFlight={visibilityToggleInFlight}
              />
            </div>
          </div>
          {pageVisibility?.bannerText ? (
            <div className={BUILDER_PAGE_HIDDEN_BANNER} role="status">
              {pageVisibility.bannerText}
            </div>
          ) : null}
        </>
      ) : null}
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
    </article>
  );
}

export default function ProposalBuilderCanvas({
  starterGraph,
  packageSelectorGraph = null,
  draftScopedPackagePicker = false,
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
  coverViewModel,
  proposalDocumentContext,
  pricingComplete = false,
  persistedProposalPath = false,
  pageEditActiveContextId = null,
  pageEditDraftBody = "",
  onPageEditDraftBodyChange,
  onStartPageEdit,
  onCancelPageEdit,
  onSavePageEdit,
  pageEditSaveDisabled = false,
  pageEditSaveInFlight = false,
  pageEditSaveError = null,
  onTogglePageVisibility,
  pageVisibilityToggleInFlight = false,
  onToggleEstimateDisplaySetting,
  estimateSettingsSaveInFlight = false,
  estimateSettingsSaveError = null,
  persistedDraftEnabled = false,
  activeScopeDecisionsForOption = [],
  manualQuantityInFlight = false,
  manualQuantityError = null,
  excludeInFlight = false,
  excludeError = null,
  visibilityInFlight = false,
  visibilityError = null,
  upgradeSelectionInFlight = false,
  upgradeSelectionError = null,
  onApplyManualQuantity,
  onClearManualQuantity,
  onExcludeLine,
  onRestoreExcludedLine,
  onHideLine,
  onRestoreVisibility,
  onSetUpgradeSelected,
}: ProposalBuilderCanvasProps) {
  const templateName = starterGraph?.template.name ?? STARTER_TEMPLATE_DISPLAY_NAME;
  const optionGraphForSelection = packageSelectorGraph ?? starterGraph;
  const effectiveOptionId =
    selectedOptionId ??
    (optionGraphForSelection
      ? getDefaultSelectedOptionId(optionGraphForSelection)
      : null);

  const allSections =
    starterGraph && effectiveOptionId
      ? getSectionsForOption(starterGraph, effectiveOptionId)
      : [];

  const sections = persistedProposalPath
    ? filterSectionsForEstimateCanvas(allSections)
    : allSections;

  const optionCustomerView =
    effectiveOptionId != null
      ? (pricingPreview?.byOptionId[effectiveOptionId]?.customer ?? null)
      : null;

  function resolvePageVisibility(page: ProposalPageRow | null): ProposalPageVisibilityState | null {
    if (!page) return null;
    return getProposalPageVisibilityState(page);
  }

  function handleToggleVisibilityForPage(page: ProposalPageRow | null) {
    if (!page || !onTogglePageVisibility) return;
    onTogglePageVisibility(page.id, !page.visible_to_customer);
  }

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
    if (isCoverPageContext(activePageContextId) && coverViewModel) {
      const coverVisibility = getProposalPageVisibilityState({
        page_type: "cover",
        visible_to_customer: true,
        title: "Cover",
      });
      return (
        <>
          <div className={`${BUILDER_CANVAS} border-b-0`}>
            <div className={`${BUILDER_CANVAS_HERO_DIVIDER} border-b border-slate-200/80 bg-slate-50/60`}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Proposal page workspace
                </p>
                <span className={BUILDER_PAGE_VISIBILITY_REQUIRED_NOTICE}>
                  {coverVisibility.requiredNotice}
                </span>
              </div>
            </div>
          </div>
          <ProposalBuilderCoverPage viewModel={coverViewModel} />
        </>
      );
    }

    const persistedPage = resolvePersistedPageByContextId(persistedPages, activePageContextId);
    const placeholder = isPlaceholderPageContext(activePageContextId);
    const pageTitle = resolvePageContextDisplayLabel(activePageContextId, persistedPages);
    const pageType = resolvePageTypeForContext(activePageContextId, persistedPages);

    // 3J4F: customer-facing text pages render as read-only document pages with
    // the persisted body (or a calm page-specific empty state). Cover, Photos,
    // PDF attachments, and other media/editor-dependent pages stay honestly
    // reserved behind the placeholder panel.
    if (isCustomerTextPageType(pageType)) {
      const rawBodyMarkdown = readPageBodyMarkdown(persistedPage);
      const canEdit =
        persistedProposalPath &&
        persistedPage != null &&
        isEditableProposalPageType(pageType) &&
        onStartPageEdit != null;
      const pageVisibility = resolvePageVisibility(persistedPage);

      return (
        <ProposalBuilderEditableTextPage
          pageType={pageType as ProposalPageType}
          title={pageTitle}
          rawBodyMarkdown={rawBodyMarkdown}
          emptyStateText={emptyStateTextForPageType(pageType as ProposalPageType)}
          proposalDocumentContext={proposalDocumentContext}
          pricingComplete={pricingComplete}
          isEditing={pageEditActiveContextId === activePageContextId}
          editDraftBody={pageEditDraftBody}
          onEditDraftBodyChange={onPageEditDraftBodyChange ?? (() => {})}
          onStartEdit={() =>
            onStartPageEdit?.(activePageContextId, rawBodyMarkdown)
          }
          onCancelEdit={() => onCancelPageEdit?.()}
          onSaveEdit={() => onSavePageEdit?.()}
          saveDisabled={pageEditSaveDisabled}
          saveInFlight={pageEditSaveInFlight}
          saveError={pageEditSaveError}
          canEdit={canEdit}
          pageVisibility={pageVisibility}
          onToggleVisibility={
            persistedPage && pageVisibility?.canToggle
              ? () => handleToggleVisibilityForPage(persistedPage)
              : undefined
          }
          visibilityToggleInFlight={pageVisibilityToggleInFlight}
        />
      );
    }

    const pageVisibility = resolvePageVisibility(persistedPage);

    return (
      <CustomerPagePanel
        title={pageTitle}
        body={
          persistedPage
            ? "Read-only customer page from the saved draft. Full page editing comes in a later phase."
            : "This proposal page is reserved on the final surface. Content editing is not enabled in this stage."
        }
        placeholder={placeholder || !persistedPage}
        pageVisibility={persistedPage ? pageVisibility : null}
        onToggleVisibility={
          persistedPage && pageVisibility?.canToggle
            ? () => handleToggleVisibilityForPage(persistedPage)
            : undefined
        }
        visibilityToggleInFlight={pageVisibilityToggleInFlight}
      />
    );
  }

  const estimateVisibility = getProposalPageVisibilityState({
    page_type: "estimate",
    visible_to_customer: true,
    title: "Estimate",
  });

  return (
    <ProposalBuilderWorkbenchEstimateDocument
      graph={starterGraph}
      packageSelectorGraph={optionGraphForSelection ?? starterGraph}
      draftScopedPackagePicker={draftScopedPackagePicker}
      sections={sections}
      catalogItems={catalogItems}
      selectedOptionId={selectedOptionId}
      effectiveOptionId={effectiveOptionId}
      onSelectOption={onSelectOption}
      measurementHandoff={measurementHandoff}
      measurementQuantityMap={measurementQuantityMap}
      optionCustomerView={optionCustomerView}
      snapshotQuantityByTemplateItemId={snapshotQuantityByTemplateItemId}
      pricingPolicyConfigured={pricingPolicyConfigured}
      persistedPages={persistedPages}
      estimateVisibilityNotice={estimateVisibility.requiredNotice}
      persistedDraftEnabled={persistedDraftEnabled}
      activeScopeDecisionsForOption={activeScopeDecisionsForOption}
      manualQuantityInFlight={manualQuantityInFlight}
      manualQuantityError={manualQuantityError}
      excludeInFlight={excludeInFlight}
      excludeError={excludeError}
      visibilityInFlight={visibilityInFlight}
      visibilityError={visibilityError}
      upgradeSelectionInFlight={upgradeSelectionInFlight}
      upgradeSelectionError={upgradeSelectionError}
      onApplyManualQuantity={onApplyManualQuantity}
      onClearManualQuantity={onClearManualQuantity}
      onExcludeLine={onExcludeLine}
      onRestoreExcludedLine={onRestoreExcludedLine}
      onHideLine={onHideLine}
      onRestoreVisibility={onRestoreVisibility}
      onSetUpgradeSelected={onSetUpgradeSelected}
      estimateSettingsSaveInFlight={estimateSettingsSaveInFlight}
      estimateSettingsSaveError={estimateSettingsSaveError}
      onToggleEstimateDisplaySetting={onToggleEstimateDisplaySetting}
    />
  );
}
