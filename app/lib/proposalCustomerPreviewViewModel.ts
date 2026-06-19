/**
 * R17A — Pure customer Preview document view model for persisted proposal drafts.
 *
 * Assembles customer-visible pages from frozen draft graph truth only.
 * No DB, React, pricing math, persistence, or lifecycle mutation.
 */

import type { ProposalBuilderOptionPreview } from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import { buildProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import {
  adaptProposalDraftGraphToBuilderPreview,
  resolveSelectedTemplateOptionIdFromGraph,
  type ProposalSnapshotLineQuantityView,
} from "@/app/lib/proposalDraftGraphAdapter";
import {
  renderProposalDocumentPageBody,
  type ProposalDocumentPageBodyDiagnostics,
} from "@/app/lib/proposalDocumentBodyRenderer";
import { readProposalPageBodyMarkdown } from "@/app/lib/proposalPageContentEditing";
import type { ProposalPageType } from "@/app/lib/proposalPageTypes";
import {
  getCustomerPreviewPages,
  resolveProposalPageDisplayTitle,
} from "@/app/lib/proposalPageVisibilityEditing";
import type { ProposalDraftGraph, ProposalPageRow } from "@/app/lib/proposalRecordStore";
import type { ProposalPricingStaleResult } from "@/app/lib/proposalStaleness";

/** Lifecycle page types excluded from R17 customer Preview. */
export const CUSTOMER_PREVIEW_DEFERRED_PAGE_TYPES = [
  "signature",
  "payment_schedule",
] as const;

const DEFERRED_PAGE_TYPE_SET = new Set<string>(CUSTOMER_PREVIEW_DEFERRED_PAGE_TYPES);

const TEXT_PAGE_TYPES = new Set<string>([
  "project_overview",
  "terms",
  "warranty",
  "custom_text",
]);

const PLACEHOLDER_PAGE_TYPES = new Set<string>(["photos", "pdf_attachment"]);

export const CUSTOMER_PREVIEW_COVER_TITLE = "Cover";
export const CUSTOMER_PREVIEW_PHOTOS_PLACEHOLDER =
  "Project photos will appear here when photo upload is enabled.";
export const CUSTOMER_PREVIEW_PDF_PLACEHOLDER =
  "PDF attachments will appear here when attachment support is enabled.";

export type ProposalCustomerPreviewCoverPage = {
  kind: "cover";
  id: "cover";
  pageType: "cover";
  title: string;
  sortOrder: number;
  viewModel: ProposalCoverViewModel;
};

export type ProposalCustomerPreviewTextPage = {
  kind: "text";
  id: string;
  pageType: "project_overview" | "terms" | "warranty" | "custom_text";
  title: string;
  sortOrder: number;
  displayText: string;
  isEmpty: boolean;
  diagnostics: ProposalDocumentPageBodyDiagnostics;
};

export type ProposalCustomerPreviewEstimatePage = {
  kind: "estimate";
  id: string;
  pageType: "estimate";
  title: string;
  sortOrder: number;
  selectedTemplateOptionId: string | null;
  selectedOptionLabel: string | null;
  optionPreview: ProposalBuilderOptionPreview | null;
  snapshotQuantityByTemplateItemId: Record<string, ProposalSnapshotLineQuantityView>;
  pricingPolicyConfigured: boolean;
};

export type ProposalCustomerPreviewPlaceholderPage = {
  kind: "placeholder";
  id: string;
  pageType: "photos" | "pdf_attachment";
  title: string;
  sortOrder: number;
  message: string;
};

export type ProposalCustomerPreviewPage =
  | ProposalCustomerPreviewCoverPage
  | ProposalCustomerPreviewTextPage
  | ProposalCustomerPreviewEstimatePage
  | ProposalCustomerPreviewPlaceholderPage;

export type ProposalCustomerPreviewReadiness = {
  hiddenPageCount: number;
  pricingComplete: boolean;
  blockingLineCount: number;
  pricingStale: boolean;
  estimatePagePresent: boolean;
  warnings: string[];
};

export type ProposalCustomerPreviewDocument = {
  pages: ProposalCustomerPreviewPage[];
  readiness: ProposalCustomerPreviewReadiness;
  templateId: string;
  templateTitle: string | null;
  selectedTemplateOptionId: string | null;
};

export type BuildProposalCustomerPreviewOptions = {
  pricingStale?: ProposalPricingStaleResult | null;
};

export function buildProposalCustomerPreviewHref(
  jobId: string,
  proposalId: string
): string {
  return `/tools/roofing/proposals/preview?job=${encodeURIComponent(jobId)}&proposal=${encodeURIComponent(proposalId)}`;
}

function isDeferredCustomerPreviewPageType(pageType: string): boolean {
  return DEFERRED_PAGE_TYPE_SET.has(pageType);
}

function resolveSelectedOptionLabel(
  graph: ProposalDraftGraph,
  selectedTemplateOptionId: string | null
): string | null {
  if (!selectedTemplateOptionId) return null;
  const runtimeOption = graph.options.find(
    (option) => (option.source_template_option_id ?? "").trim() === selectedTemplateOptionId
  );
  if (!runtimeOption) return null;
  const customerLabel = (runtimeOption.customer_label ?? "").trim();
  if (customerLabel) return customerLabel;
  const name = (runtimeOption.name ?? "").trim();
  return name || null;
}

function placeholderMessageForPageType(pageType: ProposalPageType): string {
  switch (pageType) {
    case "photos":
      return CUSTOMER_PREVIEW_PHOTOS_PLACEHOLDER;
    case "pdf_attachment":
      return CUSTOMER_PREVIEW_PDF_PLACEHOLDER;
    default:
      return "Content for this page is not available yet.";
  }
}

function buildReadinessWarnings(input: {
  hiddenPageCount: number;
  pricingComplete: boolean;
  blockingLineCount: number;
  pricingStale: boolean;
  estimatePagePresent: boolean;
}): string[] {
  const warnings: string[] = [];

  if (input.hiddenPageCount > 0) {
    warnings.push(
      `${input.hiddenPageCount} page${input.hiddenPageCount === 1 ? "" : "s"} hidden from customer view.`
    );
  }

  if (input.pricingStale) {
    warnings.push(
      "Draft pricing snapshot may be stale relative to the current job measurement."
    );
  }

  if (!input.pricingComplete) {
    warnings.push("Pricing is incomplete — totals and money tokens may be suppressed.");
  }

  if (input.blockingLineCount > 0) {
    warnings.push(
      `${input.blockingLineCount} line item${input.blockingLineCount === 1 ? "" : "s"} need pricing attention.`
    );
  }

  if (!input.estimatePagePresent) {
    warnings.push("Estimate page is missing from the customer-visible page list.");
  }

  return warnings;
}

function mapVisibleDbPage(
  page: ProposalPageRow,
  graph: ProposalDraftGraph,
  adapter: ReturnType<typeof adaptProposalDraftGraphToBuilderPreview>,
  selectedTemplateOptionId: string | null,
  pricingComplete: boolean
): ProposalCustomerPreviewPage | null {
  const pageType = page.page_type;
  const title = resolveProposalPageDisplayTitle(page);

  if (pageType === "cover") {
    return null;
  }

  if (pageType === "estimate") {
    const optionPreview =
      selectedTemplateOptionId != null
        ? (adapter.pricingPreview.byOptionId[selectedTemplateOptionId] ?? null)
        : null;

    return {
      kind: "estimate",
      id: page.id,
      pageType: "estimate",
      title,
      sortOrder: page.sort_order,
      selectedTemplateOptionId,
      selectedOptionLabel: resolveSelectedOptionLabel(graph, selectedTemplateOptionId),
      optionPreview,
      snapshotQuantityByTemplateItemId:
        selectedTemplateOptionId != null
          ? (adapter.snapshotQuantityByOptionId[selectedTemplateOptionId] ?? {})
          : {},
      pricingPolicyConfigured: adapter.pricingPolicyConfigured,
    };
  }

  if (TEXT_PAGE_TYPES.has(pageType)) {
    const rawBody = readProposalPageBodyMarkdown(page.content_json);
    const rendered = rawBody
      ? renderProposalDocumentPageBody(rawBody, adapter.proposalDocumentContext, {
          pricingComplete,
        })
      : {
          displayText: "",
          diagnostics: {
            tokensFound: [],
            unknownTokensRemoved: [],
            moneyTokensSuppressed: 0,
            hasMalformedPlaceholders: false,
          },
        };

    return {
      kind: "text",
      id: page.id,
      pageType: pageType as ProposalCustomerPreviewTextPage["pageType"],
      title,
      sortOrder: page.sort_order,
      displayText: rendered.displayText,
      isEmpty: rendered.displayText.trim().length === 0,
      diagnostics: rendered.diagnostics,
    };
  }

  if (PLACEHOLDER_PAGE_TYPES.has(pageType)) {
    return {
      kind: "placeholder",
      id: page.id,
      pageType: pageType as ProposalCustomerPreviewPlaceholderPage["pageType"],
      title,
      sortOrder: page.sort_order,
      message: placeholderMessageForPageType(pageType),
    };
  }

  return null;
}

/**
 * Build the customer-visible Preview document from a persisted draft graph.
 * Does not mutate the input graph.
 */
export function buildProposalCustomerPreviewDocument(
  graph: ProposalDraftGraph,
  options?: BuildProposalCustomerPreviewOptions
): ProposalCustomerPreviewDocument {
  const adapter = adaptProposalDraftGraphToBuilderPreview(graph);
  const selectedTemplateOptionId = resolveSelectedTemplateOptionIdFromGraph(graph);
  const selectedOptionPreview =
    selectedTemplateOptionId != null
      ? (adapter.pricingPreview.byOptionId[selectedTemplateOptionId] ?? null)
      : null;

  const pricingComplete = selectedOptionPreview?.status.pricingComplete ?? false;
  const blockingLineCount = selectedOptionPreview?.status.blockingLineCount ?? 0;

  const hiddenPageCount = graph.pages.filter((page) => page.visible_to_customer !== true).length;

  const visibleDbPages = getCustomerPreviewPages(graph.pages).filter(
    (page) => !isDeferredCustomerPreviewPageType(page.page_type)
  );

  const estimatePagePresent = visibleDbPages.some((page) => page.page_type === "estimate");

  const pricingStale = options?.pricingStale?.stale === true;

  const coverViewModel = buildProposalCoverViewModel(adapter.proposalDocumentContext, {
    pricingComplete,
  });

  const pages: ProposalCustomerPreviewPage[] = [
    {
      kind: "cover",
      id: "cover",
      pageType: "cover",
      title: CUSTOMER_PREVIEW_COVER_TITLE,
      sortOrder: Number.MIN_SAFE_INTEGER,
      viewModel: coverViewModel,
    },
  ];

  for (const page of visibleDbPages) {
    const mapped = mapVisibleDbPage(
      page,
      graph,
      adapter,
      selectedTemplateOptionId,
      pricingComplete
    );
    if (mapped) {
      pages.push(mapped);
    }
  }

  return {
    pages,
    readiness: {
      hiddenPageCount,
      pricingComplete,
      blockingLineCount,
      pricingStale,
      estimatePagePresent,
      warnings: buildReadinessWarnings({
        hiddenPageCount,
        pricingComplete,
        blockingLineCount,
        pricingStale,
        estimatePagePresent,
      }),
    },
    templateId: adapter.templateId,
    templateTitle: adapter.templateTitle,
    selectedTemplateOptionId,
  };
}
