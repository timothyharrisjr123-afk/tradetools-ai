/**
 * R18C4A — Pure render-ready public proposal document view model.
 *
 * Customer-safe contract for the future Roofr-style public proposal page.
 * Built exclusively from ProposalPublicGraphDto — no draft graph or stores.
 */

import { buildProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import { renderProposalDocumentPageBody } from "@/app/lib/proposalDocumentBodyRenderer";
import { buildCustomerPacketFromPublicDto } from "@/app/lib/proposalCustomerPacketPresenter";
import type { ProposalCustomerPacketViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  buildProposalPublicEstimateLayout,
  type ProposalPublicEstimateLayoutViewModel,
} from "@/app/lib/proposalPublicEstimatePresentation";
import type { ProposalPublicGraphDto, ProposalPublicGraphPageDto } from "@/app/lib/proposalPublicGraphDto";
import { readProposalPageBodyMarkdown } from "@/app/lib/proposalPageContentEditing";
import {
  buildProposalDocumentContextFromPublicDto,
  isPublicProposalPricingComplete,
  monogramFromCompanyName,
  proposalPublicAddressesMatch,
} from "@/app/lib/proposalPublicProposalContext";

export const PROPOSAL_PUBLIC_STATUS_LABEL = "Review proposal" as const;

export const PROPOSAL_PUBLIC_DEFERRED_SIGNATURE_MESSAGE =
  "Electronic signature will be available on this proposal in a future update.";

export const PROPOSAL_PUBLIC_DEFERRED_PAYMENT_MESSAGE =
  "Payment options will be available on this proposal in a future update.";

export const PROPOSAL_PUBLIC_PHOTOS_PLACEHOLDER =
  "Project photos will appear here when photo upload is enabled.";

export const PROPOSAL_PUBLIC_PDF_PLACEHOLDER =
  "PDF attachments will appear here when attachment support is enabled.";

export const PROPOSAL_PUBLIC_SUPPORT_MESSAGE =
  "Questions about this proposal? Reply to your contractor's email or use the contact details below.";

export type ProposalPublicFutureActionId = "sign_accept" | "download_pdf" | "payment_deposit";

export type ProposalPublicFutureActionViewModel = {
  id: ProposalPublicFutureActionId;
  label: string;
  description: string | null;
  availability: "deferred";
  disabledReason: string;
  showInUi: true;
  deferredPhase: "R18G" | "R18H" | "R18I";
};

export type ProposalPublicCompanyBrandingBlock = {
  companyName: string | null;
  logoUrl: string | null;
  logoMonogram: string | null;
  brandPrimaryColor: string | null;
  brandSecondaryColor: string | null;
  hasAnyField: boolean;
};

export type ProposalPublicCompanyContactBlock = {
  companyName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  license: string | null;
  address: string | null;
  hasAnyField: boolean;
};

export type ProposalPublicProposalIdentityBlock = {
  customerName: string | null;
  propertyAddress: string | null;
  proposalNumber: string | null;
  hasAnyField: boolean;
};

export type ProposalPublicCustomerIdentityBlock = {
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  hasAnyField: boolean;
};

export type ProposalPublicProjectIdentityBlock = {
  jobName: string | null;
  propertyAddress: string | null;
  hasAnyField: boolean;
};

export type ProposalPublicCoverPackageSummaryBlock = {
  packageName: string | null;
  totalDisplay: string | null;
  hasTotal: boolean;
};

export type ProposalPublicProposalHeaderViewModel = {
  company: ProposalPublicCompanyBrandingBlock;
  statusLabel: typeof PROPOSAL_PUBLIC_STATUS_LABEL;
  identity: ProposalPublicProposalIdentityBlock;
};

export type ProposalPublicCoverHeroContent = {
  pageType: "cover";
  title: string;
  bodyDisplay: string | null;
};

export type ProposalPublicProposalCoverSectionViewModel = {
  headline: string | null;
  company: ProposalPublicCompanyContactBlock;
  customer: ProposalPublicCustomerIdentityBlock;
  project: ProposalPublicProjectIdentityBlock;
  packageSummary: ProposalPublicCoverPackageSummaryBlock;
  heroContent: ProposalPublicCoverHeroContent | null;
};

export type ProposalPublicTextDocumentPageViewModel = {
  kind: "text";
  pageType: "project_overview" | "terms" | "warranty" | "custom_text";
  id: string;
  title: string;
  sortOrder: number;
  displayText: string;
  isEmpty: boolean;
};

export type ProposalPublicDeferredDocumentPageViewModel = {
  kind: "deferred";
  pageType: "signature" | "payment_schedule";
  id: string;
  title: string;
  sortOrder: number;
  message: string;
  deferredPhase: "R18G" | "R18I";
};

export type ProposalPublicPlaceholderDocumentPageViewModel = {
  kind: "placeholder";
  pageType: "photos" | "pdf_attachment";
  id: string;
  title: string;
  sortOrder: number;
  message: string;
};

export type ProposalPublicProposalDocumentPageViewModel =
  | ProposalPublicTextDocumentPageViewModel
  | ProposalPublicDeferredDocumentPageViewModel
  | ProposalPublicPlaceholderDocumentPageViewModel;

export type ProposalPublicProposalEstimateSectionViewModel = ProposalPublicEstimateLayoutViewModel;

export type ProposalPublicProposalFooterViewModel = {
  company: ProposalPublicCompanyContactBlock;
  supportMessage: string;
};

export type ProposalPublicProposalDocumentMeta = {
  statusLabel: typeof PROPOSAL_PUBLIC_STATUS_LABEL;
  versionKind: "sent" | "signed";
  frozenAt: string | null;
  proposalTitle: string | null;
};

export type ProposalPublicProposalDocumentViewModel = {
  kind: "document";
  meta: ProposalPublicProposalDocumentMeta;
  /** Shared customer packet — primary render contract for Public (and future Preview). */
  packet: ProposalCustomerPacketViewModel;
  header: ProposalPublicProposalHeaderViewModel;
  cover: ProposalPublicProposalCoverSectionViewModel;
  pages: ProposalPublicProposalDocumentPageViewModel[];
  estimate: ProposalPublicProposalEstimateSectionViewModel;
  futureActions: ProposalPublicFutureActionViewModel[];
  footer: ProposalPublicProposalFooterViewModel;
};

export type ProposalPublicProposalErrorCode =
  | "invalid_token"
  | "expired_token"
  | "revoked_token"
  | "superseded_token"
  | "proposal_unavailable"
  | "graph_unavailable"
  | "internal_error";

export type ProposalPublicProposalErrorViewModel = {
  kind: "error";
  code: ProposalPublicProposalErrorCode;
  title: string;
  message: string;
  header: ProposalPublicProposalHeaderViewModel | null;
};

export type BuildProposalPublicProposalViewModelOptions = {
  versionKind?: "sent" | "signed";
};

const TEXT_PAGE_TYPES = new Set<string>(["project_overview", "terms", "warranty", "custom_text"]);
const DEFERRED_PAGE_TYPES = new Set<string>(["signature", "payment_schedule"]);
const PLACEHOLDER_PAGE_TYPES = new Set<string>(["photos", "pdf_attachment"]);

const R18C4_DEFERRED_ACTIONS: ProposalPublicFutureActionViewModel[] = [
  {
    id: "sign_accept",
    label: "Sign / Accept proposal",
    description: "Review the full proposal before signing.",
    availability: "deferred",
    disabledReason: "Electronic signature is not available on this link yet.",
    showInUi: true,
    deferredPhase: "R18G",
  },
  {
    id: "download_pdf",
    label: "Download PDF",
    description: null,
    availability: "deferred",
    disabledReason: "PDF download is not available on this link yet.",
    showInUi: true,
    deferredPhase: "R18H",
  },
  {
    id: "payment_deposit",
    label: "Pay deposit",
    description: null,
    availability: "deferred",
    disabledReason: "Online payment is not available on this link yet.",
    showInUi: true,
    deferredPhase: "R18I",
  },
];

function hasAnyNonEmpty(...values: (string | null | undefined)[]): boolean {
  return values.some((v) => (v ?? "").trim().length > 0);
}

function pageStableId(page: ProposalPublicGraphPageDto): string {
  return `${page.page_type}:${page.sort_order}`;
}

function pageDisplayTitle(page: ProposalPublicGraphPageDto): string {
  const customerTitle = (page.customer_title ?? "").trim();
  if (customerTitle) return customerTitle;
  return (page.title ?? "").trim() || page.page_type;
}

function buildCompanyBrandingBlock(
  coverCompany: ReturnType<typeof buildProposalCoverViewModel>["company"]
): ProposalPublicCompanyBrandingBlock {
  return {
    companyName: coverCompany.companyName,
    logoUrl: coverCompany.logoUrl,
    logoMonogram: coverCompany.logoMonogram,
    brandPrimaryColor: coverCompany.brandPrimaryColor,
    brandSecondaryColor: coverCompany.brandSecondaryColor,
    hasAnyField: coverCompany.hasAnyField,
  };
}

function buildCompanyContactBlock(
  coverCompany: ReturnType<typeof buildProposalCoverViewModel>["company"]
): ProposalPublicCompanyContactBlock {
  return {
    companyName: coverCompany.companyName,
    phone: coverCompany.phone,
    email: coverCompany.email,
    website: coverCompany.website,
    license: coverCompany.license,
    address: coverCompany.address,
    hasAnyField: hasAnyNonEmpty(
      coverCompany.companyName,
      coverCompany.phone,
      coverCompany.email,
      coverCompany.website,
      coverCompany.license,
      coverCompany.address
    ),
  };
}

function buildHeader(
  coverVm: ReturnType<typeof buildProposalCoverViewModel>
): ProposalPublicProposalHeaderViewModel {
  return {
    company: buildCompanyBrandingBlock(coverVm.company),
    statusLabel: PROPOSAL_PUBLIC_STATUS_LABEL,
    identity: {
      customerName: coverVm.customer.customerName,
      propertyAddress: coverVm.project.jobAddress,
      proposalNumber: coverVm.meta.proposalNumber,
      hasAnyField: hasAnyNonEmpty(
        coverVm.customer.customerName,
        coverVm.project.jobAddress,
        coverVm.meta.proposalNumber
      ),
    },
  };
}


function buildCoverSection(
  dto: ProposalPublicGraphDto,
  coverVm: ReturnType<typeof buildProposalCoverViewModel>,
  heroContent: ProposalPublicCoverHeroContent | null
): ProposalPublicProposalCoverSectionViewModel {
  return {
    headline: coverVm.headline,
    company: buildCompanyContactBlock(coverVm.company),
    customer: {
      customerName: coverVm.customer.customerName,
      customerEmail: coverVm.customer.customerEmail,
      customerPhone: coverVm.customer.customerPhone,
      hasAnyField: coverVm.customer.hasAnyField,
    },
    project: {
      jobName: coverVm.project.jobName,
      propertyAddress: coverVm.project.jobAddress,
      hasAnyField: coverVm.project.hasAnyField,
    },
    packageSummary: {
      packageName: coverVm.packageSummary.packageName,
      totalDisplay: coverVm.packageSummary.totalDisplay,
      hasTotal: coverVm.packageSummary.totalDisplay != null,
    },
    heroContent,
  };
}

function mapDocumentPage(
  page: ProposalPublicGraphPageDto,
  documentContext: ReturnType<typeof buildProposalDocumentContextFromPublicDto>,
  pricingComplete: boolean
): ProposalPublicProposalDocumentPageViewModel | null {
  const pageType = page.page_type;
  const title = pageDisplayTitle(page);
  const id = pageStableId(page);
  const sortOrder = page.sort_order;

  if (pageType === "cover" || pageType === "estimate") {
    return null;
  }

  if (TEXT_PAGE_TYPES.has(pageType)) {
    const rawBody = readProposalPageBodyMarkdown(page.content_json);
    const rendered = rawBody
      ? renderProposalDocumentPageBody(rawBody, documentContext, { pricingComplete })
      : { displayText: "", diagnostics: { tokensFound: [], unknownTokensRemoved: [], moneyTokensSuppressed: 0, hasMalformedPlaceholders: false } };

    return {
      kind: "text",
      pageType: pageType as ProposalPublicTextDocumentPageViewModel["pageType"],
      id,
      title,
      sortOrder,
      displayText: rendered.displayText,
      isEmpty: rendered.displayText.trim().length === 0,
    };
  }

  if (DEFERRED_PAGE_TYPES.has(pageType)) {
    return {
      kind: "deferred",
      pageType: pageType as ProposalPublicDeferredDocumentPageViewModel["pageType"],
      id,
      title,
      sortOrder,
      message:
        pageType === "signature"
          ? PROPOSAL_PUBLIC_DEFERRED_SIGNATURE_MESSAGE
          : PROPOSAL_PUBLIC_DEFERRED_PAYMENT_MESSAGE,
      deferredPhase: pageType === "signature" ? "R18G" : "R18I",
    };
  }

  if (PLACEHOLDER_PAGE_TYPES.has(pageType)) {
    return {
      kind: "placeholder",
      pageType: pageType as ProposalPublicPlaceholderDocumentPageViewModel["pageType"],
      id,
      title,
      sortOrder,
      message:
        pageType === "photos" ? PROPOSAL_PUBLIC_PHOTOS_PLACEHOLDER : PROPOSAL_PUBLIC_PDF_PLACEHOLDER,
    };
  }

  return null;
}

function findCoverHeroContent(
  pages: ProposalPublicGraphPageDto[],
  documentContext: ReturnType<typeof buildProposalDocumentContextFromPublicDto>,
  pricingComplete: boolean
): ProposalPublicCoverHeroContent | null {
  const coverPage = pages.find((page) => page.page_type === "cover");
  if (!coverPage) return null;

  const rawBody = readProposalPageBodyMarkdown(coverPage.content_json);
  const bodyDisplay = rawBody
    ? renderProposalDocumentPageBody(rawBody, documentContext, { pricingComplete }).displayText
    : null;

  return {
    pageType: "cover",
    title: pageDisplayTitle(coverPage),
    bodyDisplay: bodyDisplay && bodyDisplay.trim().length > 0 ? bodyDisplay : null,
  };
}

export function buildProposalPublicFutureActions(): ProposalPublicFutureActionViewModel[] {
  return R18C4_DEFERRED_ACTIONS.map((action) => ({ ...action }));
}

export function buildProposalPublicProposalErrorViewModel(
  code: ProposalPublicProposalErrorCode,
  header: ProposalPublicProposalHeaderViewModel | null = null
): ProposalPublicProposalErrorViewModel {
  const copy = ERROR_COPY[code];
  return {
    kind: "error",
    code,
    title: copy.title,
    message: copy.message,
    header,
  };
}

const ERROR_COPY: Record<
  ProposalPublicProposalErrorCode,
  { title: string; message: string }
> = {
  invalid_token: {
    title: "Proposal link not found",
    message: "This proposal link is invalid or may have been typed incorrectly.",
  },
  expired_token: {
    title: "Proposal link expired",
    message: "This proposal link has expired. Contact your contractor for a new link.",
  },
  revoked_token: {
    title: "Proposal link unavailable",
    message: "This proposal link is no longer active. Contact your contractor for assistance.",
  },
  superseded_token: {
    title: "Proposal link replaced",
    message: "A newer version of this proposal may be available. Contact your contractor for the latest link.",
  },
  proposal_unavailable: {
    title: "Proposal unavailable",
    message: "This proposal is not available to view right now. Contact your contractor for assistance.",
  },
  graph_unavailable: {
    title: "Proposal unavailable",
    message: "We could not load this proposal document. Contact your contractor for assistance.",
  },
  internal_error: {
    title: "Something went wrong",
    message: "We could not open this proposal right now. Please try again later or contact your contractor.",
  },
};

export function buildProposalPublicProposalDocumentViewModel(
  dto: ProposalPublicGraphDto,
  options?: BuildProposalPublicProposalViewModelOptions
): ProposalPublicProposalDocumentViewModel {
  const documentContext = buildProposalDocumentContextFromPublicDto(dto);
  const pricingComplete = isPublicProposalPricingComplete(dto);
  const coverVm = buildProposalCoverViewModel(documentContext, { pricingComplete });
  const heroContent = findCoverHeroContent(dto.pages, documentContext, pricingComplete);
  const estimateLayout = buildProposalPublicEstimateLayout(dto, dto.displayPolicy);
  const packet = buildCustomerPacketFromPublicDto(dto);

  const pages = dto.pages
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((page) => mapDocumentPage(page, documentContext, pricingComplete))
    .filter((page): page is ProposalPublicProposalDocumentPageViewModel => page != null);

  const proposalTitle = coverVm.headline;

  return {
    kind: "document",
    meta: {
      statusLabel: PROPOSAL_PUBLIC_STATUS_LABEL,
      versionKind: options?.versionKind ?? "sent",
      frozenAt: dto.frozen_at,
      proposalTitle,
    },
    packet,
    header: buildHeader(coverVm),
    cover: buildCoverSection(dto, coverVm, heroContent),
    pages,
    estimate: estimateLayout,
    futureActions: buildProposalPublicFutureActions(),
    footer: {
      company: buildCompanyContactBlock(coverVm.company),
      supportMessage: PROPOSAL_PUBLIC_SUPPORT_MESSAGE,
    },
  };
}

/** Audit helper — ensures serialized customer VM excludes forbidden identifiers/secrets. */
export function assertPublicProposalDocumentViewModelSafe(
  value: ProposalPublicProposalDocumentViewModel | ProposalPublicProposalErrorViewModel
): void {
  const serialized = JSON.stringify(value);
  const forbiddenPatterns = [
    /"token_hash"\s*:/i,
    /"raw_token"\s*:/i,
    /"token_id"\s*:/i,
    /"company_id"\s*:/i,
    /"proposal_id"\s*:/i,
    /"proposal_version_id"\s*:/i,
    /"internal_unit_cost/i,
    /"internal_cost/i,
    /"scope_decision/i,
    /"blocking_line_count"/i,
    /"guardrail_outcome"/i,
    /"pricing_stale"/i,
    /getDraftGraph\(/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(serialized)) {
      throw new Error(`Public proposal view model contains forbidden content: ${pattern}`);
    }
  }
}

export { monogramFromCompanyName, proposalPublicAddressesMatch };
