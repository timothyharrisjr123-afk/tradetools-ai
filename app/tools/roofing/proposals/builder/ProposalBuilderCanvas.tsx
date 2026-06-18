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
import type { ProposalPageType } from "@/app/lib/proposalPageTypes";
import type { ProposalPageRow } from "@/app/lib/proposalRecordStore";
import ProposalBuilderCoverPage from "./ProposalBuilderCoverPage";
import ProposalBuilderEditableTextPage from "./ProposalBuilderEditableTextPage";
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
}: ProposalBuilderCanvasProps) {
  const templateName = starterGraph?.template.name ?? STARTER_TEMPLATE_DISPLAY_NAME;
  const effectiveOptionId =
    selectedOptionId ?? (starterGraph ? getDefaultSelectedOptionId(starterGraph) : null);

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
      return <ProposalBuilderCoverPage viewModel={coverViewModel} />;
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
        />
      );
    }

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
            <h2 className="text-xl font-semibold leading-tight tracking-tight text-slate-950">
              Estimate
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Package options, line items, and totals for the customer proposal.
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
