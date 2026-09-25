/**
 * Astra G5 — starter / first-use packet preview model.
 *
 * Builds a read-only customer-document view from starter template + catalog defs
 * and optional company branding. Reuses Customer Preview leaf view-model shapes.
 *
 * Does NOT invent: customer/property identity, measurements, prices, totals,
 * proposal/version IDs, acceptance, payment, or send state.
 */

import { DEFAULT_ROOFING_CATALOG_DEFINITIONS } from "@/app/lib/defaultRoofingCatalog";
import { DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS } from "@/app/lib/defaultRoofingProposalTemplates";
import {
  CUSTOMER_PREVIEW_LINE_INCLUDED_LABEL,
  type CustomerPreviewEstimateSectionPresentation,
  type CustomerPreviewEstimateTotalsPresentation,
  type CustomerPreviewPackageHero,
} from "@/app/lib/proposalCustomerEstimatePresenter";
import {
  DEFAULT_PACKET_OVERVIEW_BODY,
  DEFAULT_PACKET_OVERVIEW_TITLE,
  DEFAULT_PACKET_TERMS_BODY,
  DEFAULT_PACKET_TERMS_TITLE,
  DEFAULT_PACKET_WARRANTY_BODY,
  DEFAULT_PACKET_WARRANTY_TITLE,
} from "@/app/lib/proposalCustomerPacketDefaultContent";
import {
  PROPOSAL_COVER_DEFAULT_BRAND_ACCENT,
  buildProposalCoverViewModel,
  type ProposalCoverViewModel,
} from "@/app/lib/proposalCoverViewModel";
import type { ProposalCompanyContext } from "@/app/lib/proposalDraftGraphAdapter";
import type { ProposalDocumentContext } from "@/app/lib/proposalDocumentTokenTypes";
import type { DefaultProposalTemplateOptionDefinition } from "@/app/lib/proposalTemplateTypes";

export type AstraG5StarterCompanyBrandingInput = {
  companyName?: string | null;
  logoDataUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  license?: string | null;
  address?: string | null;
  website?: string | null;
  brandPrimaryColor?: string | null;
  brandSecondaryColor?: string | null;
  showLicenseOnCover?: boolean | null;
};

export type AstraG5StarterPackageOptionPreview = {
  label: string;
  description: string;
  isDefault: boolean;
};

export type AstraG5StarterDetailSection = {
  title: string;
  body: string;
};

export type AstraG5StarterPacketPreviewModel = {
  /** Same leaf shapes Customer Preview Cover / PackageStrip / Estimate use. */
  cover: ProposalCoverViewModel;
  accentColor: string;
  selectedPackageLabel: string;
  packageHero: CustomerPreviewPackageHero;
  packageOptions: readonly AstraG5StarterPackageOptionPreview[];
  estimateSections: CustomerPreviewEstimateSectionPresentation[];
  totals: CustomerPreviewEstimateTotalsPresentation;
  detailSections: readonly AstraG5StarterDetailSection[];
  templateTitle: string;
  /** Explicit proof flags for tests / UI honesty. */
  inventsPrices: false;
  inventsCustomerIdentity: false;
  inventsPropertyIdentity: false;
  inventsProposalIdentity: false;
  inventsMeasurement: false;
};

const EMPTY_TOTALS: CustomerPreviewEstimateTotalsPresentation = {
  show: false,
  subtotalLabel: null,
  discountLabel: null,
  taxLabel: null,
  totalLabel: null,
};

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function catalogLabelBySeedKey(seedKey: string): string {
  const def = DEFAULT_ROOFING_CATALOG_DEFINITIONS.find(
    (row) => row.metadata.seed_key === seedKey
  );
  if (!def) return seedKey;
  return nonEmpty(def.customer_name) ?? def.name;
}

function starterTemplate() {
  return DEFAULT_ROOFING_PROPOSAL_TEMPLATE_DEFINITIONS[0] ?? null;
}

function defaultOption(
  options: readonly DefaultProposalTemplateOptionDefinition[]
): DefaultProposalTemplateOptionDefinition | null {
  return options.find((option) => option.is_default) ?? options[0] ?? null;
}

function fillPacketTokens(
  body: string,
  tokens: { companyName: string | null; packageLabel: string }
): string {
  return body
    .replace(/\{\{\s*company_name\s*\}\}/g, tokens.companyName?.trim() || "Your company")
    .replace(
      /\{\{\s*selected_package_name\s*\}\}/g,
      tokens.packageLabel.trim() || "Standard"
    );
}

function buildCompanyContext(
  branding: AstraG5StarterCompanyBrandingInput | null | undefined
): ProposalCompanyContext {
  return {
    companyName: nonEmpty(branding?.companyName),
    companyLogoUrl: nonEmpty(branding?.logoDataUrl),
    companyPhone: nonEmpty(branding?.phone),
    companyEmail: nonEmpty(branding?.email),
    companyLicense: nonEmpty(branding?.license),
    companyAddress: nonEmpty(branding?.address),
    companyWebsite: nonEmpty(branding?.website),
    brandPrimaryColor: nonEmpty(branding?.brandPrimaryColor),
    brandSecondaryColor: nonEmpty(branding?.brandSecondaryColor),
    showLicenseOnCover: branding?.showLicenseOnCover === true,
  };
}

function buildStarterDocumentContext(input: {
  company: ProposalCompanyContext;
  templateTitle: string;
  packageLabel: string;
}): ProposalDocumentContext {
  return {
    company: input.company,
    customer: {
      customerId: null,
      customerName: null,
      customerEmail: null,
      customerPhone: null,
      customerAddress: null,
    },
    jobName: null,
    jobAddress: null,
    measurementSummary: null,
    proposalNumber: null,
    proposalTitle: `${input.templateTitle} proposal`,
    templateName: input.templateTitle,
    proposalCreatedDateIso: null,
    selectedPackage: {
      runtimeOptionId: null,
      packageName: input.packageLabel,
      customerTotalCents: null,
    },
  };
}

function includedLineItems(
  option: DefaultProposalTemplateOptionDefinition
): CustomerPreviewEstimateSectionPresentation[] {
  const lineSection = (option.sections ?? []).find((section) => section.kind === "line_items");
  const items = lineSection?.items ?? [];
  if (items.length === 0) return [];

  return [
    {
      sectionId: "starter-scope",
      title: lineSection?.customer_title ?? "Roof replacement scope",
      showHeading: true,
      lines: items.map((item, index) => {
        const seed = (item.catalog_seed_key ?? "").trim();
        const name =
          nonEmpty(item.customer_name_override) ??
          (seed ? catalogLabelBySeedKey(seed) : `Item ${index + 1}`);
        return {
          templateItemId: `starter:${seed || index}`,
          name,
          kind: "included" as const,
          qtyLabel: null,
          valueLabel: CUSTOMER_PREVIEW_LINE_INCLUDED_LABEL,
        };
      }),
    },
  ];
}

function packageIncludeBullets(
  option: DefaultProposalTemplateOptionDefinition,
  limit = 6
): string[] {
  const lineSection = (option.sections ?? []).find((section) => section.kind === "line_items");
  const items = lineSection?.items ?? [];
  return items.slice(0, limit).map((item, index) => {
    const seed = (item.catalog_seed_key ?? "").trim();
    return (
      nonEmpty(item.customer_name_override) ??
      (seed ? catalogLabelBySeedKey(seed) : `Included item ${index + 1}`)
    );
  });
}

function detailSectionsForOption(
  option: DefaultProposalTemplateOptionDefinition,
  tokens: { companyName: string | null; packageLabel: string }
): AstraG5StarterDetailSection[] {
  const fromTemplate = (option.sections ?? [])
    .filter(
      (section) =>
        section.kind === "text" ||
        section.kind === "warranty" ||
        section.kind === "terms"
    )
    .map((section) => {
      const title =
        nonEmpty(section.content?.title) ??
        nonEmpty(section.customer_title) ??
        section.name;
      const body = nonEmpty(section.content?.body_markdown);
      if (!title || !body) return null;
      return {
        title,
        body: fillPacketTokens(body, tokens),
      };
    })
    .filter((row): row is AstraG5StarterDetailSection => row != null);

  if (fromTemplate.length > 0) return fromTemplate;

  return [
    {
      title: DEFAULT_PACKET_OVERVIEW_TITLE,
      body: fillPacketTokens(DEFAULT_PACKET_OVERVIEW_BODY, tokens),
    },
    {
      title: DEFAULT_PACKET_WARRANTY_TITLE,
      body: fillPacketTokens(DEFAULT_PACKET_WARRANTY_BODY, tokens),
    },
    {
      title: DEFAULT_PACKET_TERMS_TITLE,
      body: fillPacketTokens(DEFAULT_PACKET_TERMS_BODY, tokens),
    },
  ];
}

/**
 * Build the starter packet preview from passive template/catalog defs.
 * Optional branding fills company identity only — never invents job/customer/money.
 */
export function buildAstraG5StarterPacketPreviewModel(
  branding?: AstraG5StarterCompanyBrandingInput | null
): AstraG5StarterPacketPreviewModel | null {
  const template = starterTemplate();
  const templateOptions = template?.options;
  if (!template || !templateOptions || templateOptions.length === 0) return null;

  const selected = defaultOption(templateOptions);
  if (!selected) return null;

  const packageLabel =
    nonEmpty(selected.customer_label) ?? nonEmpty(selected.name) ?? "Standard";
  const company = buildCompanyContext(branding);
  const cover = buildProposalCoverViewModel(
    buildStarterDocumentContext({
      company,
      templateTitle: template.name,
      packageLabel,
    }),
    { pricingComplete: false }
  );

  const packageOptions: AstraG5StarterPackageOptionPreview[] = templateOptions.map(
    (option) => ({
      label: nonEmpty(option.customer_label) ?? option.name,
      description: nonEmpty(option.description) ?? "",
      isDefault: option.is_default === true,
    })
  );

  const accentColor =
    nonEmpty(company.brandPrimaryColor) ?? PROPOSAL_COVER_DEFAULT_BRAND_ACCENT;

  return {
    cover,
    accentColor,
    selectedPackageLabel: packageLabel,
    packageHero: {
      label: packageLabel,
      description: nonEmpty(selected.description),
      bullets: packageIncludeBullets(selected),
    },
    packageOptions,
    estimateSections: includedLineItems(selected),
    totals: EMPTY_TOTALS,
    detailSections: detailSectionsForOption(selected, {
      companyName: company.companyName,
      packageLabel,
    }),
    templateTitle: template.name,
    inventsPrices: false,
    inventsCustomerIdentity: false,
    inventsPropertyIdentity: false,
    inventsProposalIdentity: false,
    inventsMeasurement: false,
  };
}

/** First-use Prepare shows document preview; jobs that already have a proposal stay quiet. */
export function resolveShowFirstUseStarterDocumentPreview(input: {
  starterTemplateSelected: boolean;
  showFirstProposalPricingRules: boolean;
  showFirstProposalPricing: boolean;
  /** True when this job has no proposal yet (first create on the job). */
  firstProposalOnJob?: boolean;
}): boolean {
  // First create on a job: show starter customer-document preview before commit.
  if (input.firstProposalOnJob === true) return true;
  if (!input.starterTemplateSelected) return false;
  return (
    input.showFirstProposalPricingRules || input.showFirstProposalPricing
  );
}
