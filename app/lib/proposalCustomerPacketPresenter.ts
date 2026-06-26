/**
 * R18E — Shared customer proposal packet presenter.
 *
 * Pure mapping from public/preview inputs into ProposalCustomerPacketViewModel.
 * No React, DB, pricing engine recalculation, or lifecycle mutation.
 */

import { buildProposalCoverViewModel } from "@/app/lib/proposalCoverViewModel";
import {
  formatCustomerFacingLineLabel,
  formatCustomerFacingUnit,
} from "@/app/lib/proposalCustomerFacingLabel";
import type { ResolvedCustomerPreviewEstimateDisplayPolicy } from "@/app/lib/proposalCustomerEstimateDisplayPolicy";
import { renderProposalDocumentPageBody } from "@/app/lib/proposalDocumentBodyRenderer";
import { readProposalPageBodyMarkdown } from "@/app/lib/proposalPageContentEditing";
import {
  finalizeCustomerPacketDetailBody,
  isCustomerPacketMeaningfulDetailBody,
  normalizeCustomerPacketDetailBody,
} from "@/app/lib/proposalCustomerPacketDetailContent";
import type {
  ProposalCustomerPacketComparisonViewModel,
  ProposalCustomerPacketContactViewModel,
  ProposalCustomerPacketCoverViewModel,
  ProposalCustomerPacketDetailsViewModel,
  ProposalCustomerPacketEstimateLineViewModel,
  ProposalCustomerPacketEstimateViewModel,
  ProposalCustomerPacketScopeGroupSummaryViewModel,
  ProposalCustomerPacketScopeGroupViewModel,
  ProposalCustomerPacketUpgradesViewModel,
  ProposalCustomerPacketViewModel,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  PROPOSAL_CUSTOMER_PACKET_COVER_CONFIDENCE,
  PROPOSAL_CUSTOMER_PACKET_ESTIMATE_CONFIDENCE,
  PROPOSAL_CUSTOMER_PACKET_PROPOSAL_LABEL,
  PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE,
} from "@/app/lib/proposalCustomerPacketViewModel";
import type {
  ProposalPublicGraphDto,
  ProposalPublicGraphLineDto,
  ProposalPublicGraphOptionDto,
  ProposalPublicGraphPageDto,
} from "@/app/lib/proposalPublicGraphDto";
import { resolvePackageMeta, type PackageMeta } from "@/app/lib/proposalPackagePresentation";
import {
  buildProposalDocumentContextFromPublicDto,
  isPublicProposalPricingComplete,
  monogramFromCompanyName,
} from "@/app/lib/proposalPublicProposalContext";

const SCOPE_GROUP_RULES: ReadonlyArray<{ title: string; pattern: RegExp }> = [
  { title: "Permits & fees", pattern: /permit|fee|inspection/i },
  { title: "Cleanup & disposal", pattern: /disposal|haul|dump|cleanup|debris/i },
  { title: "Ventilation & flashing", pattern: /vent|ridge|flashing|boot|pipe|step/i },
  { title: "Installation & labor", pattern: /install|tear|removal|labor/i },
  {
    title: "Roofing materials",
    pattern: /shingle|underlayment|starter|drip|ice|shield|felt|nail|cap|edge/i,
  },
];

const TEXT_DETAIL_PAGE_TYPES = new Set<string>([
  "project_overview",
  "terms",
  "warranty",
  "custom_text",
]);

export function formatCustomerPacketPriceCents(cents: number): string {
  const dollars = (Math.round(cents) / 100).toFixed(2);
  const [whole, dec] = dollars.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${dec}`;
}

function optionLabel(option: ProposalPublicGraphOptionDto): string {
  return (option.customer_label ?? option.name).trim() || option.name;
}

function mapLine(
  line: ProposalPublicGraphLineDto,
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy
): ProposalCustomerPacketEstimateLineViewModel {
  let kind: ProposalCustomerPacketEstimateLineViewModel["kind"] = "informational";
  let valueLabel: string | null = null;

  if (line.pricing_status === "included" || line.pricing_status === "grouped") {
    kind = "included";
    valueLabel = "Included";
  } else if (line.pricing_status === "priced" && line.customer_line_total_cents != null) {
    kind = "priced";
    valueLabel = displayPolicy.showLinePrices
      ? formatCustomerPacketPriceCents(line.customer_line_total_cents)
      : null;
  }

  return {
    name: formatCustomerFacingLineLabel(line.customer_name),
    valueLabel,
    kind,
  };
}

function resolveScopeGroupTitle(lineName: string): string {
  for (const rule of SCOPE_GROUP_RULES) {
    if (rule.pattern.test(lineName)) {
      return rule.title;
    }
  }
  return "Included scope";
}

function buildScopeGroups(
  lines: ProposalCustomerPacketEstimateLineViewModel[]
): ProposalCustomerPacketScopeGroupViewModel[] {
  if (lines.length === 0) {
    return [];
  }

  const groups = new Map<string, ProposalCustomerPacketEstimateLineViewModel[]>();
  for (const line of lines) {
    const title = resolveScopeGroupTitle(line.name);
    const bucket = groups.get(title) ?? [];
    bucket.push(line);
    groups.set(title, bucket);
  }

  return [...groups.entries()].map(([title, groupLines]) => ({
    title,
    lines: groupLines,
  }));
}

function buildScopeGroupSummaries(
  groups: ProposalCustomerPacketScopeGroupViewModel[]
): ProposalCustomerPacketScopeGroupSummaryViewModel[] {
  return groups.map((group) => {
    const names = group.lines.map((line) => line.name);
    const previewNames = names.slice(0, 2);
    const remaining = names.length - previewNames.length;
    const previewLabel =
      remaining > 0
        ? `${previewNames.join(", ")}, +${remaining} more`
        : previewNames.join(", ") || "Included";

    return {
      title: group.title,
      itemCount: group.lines.length,
      previewLabel,
    };
  });
}

function splitSelectedOptionLines(option: ProposalPublicGraphOptionDto): {
  includedLines: ProposalPublicGraphLineDto[];
  upgradeLines: ProposalPublicGraphLineDto[];
} {
  const includedLines: ProposalPublicGraphLineDto[] = [];
  const upgradeLines: ProposalPublicGraphLineDto[] = [];

  for (const line of option.line_items) {
    if (line.line_presentation_group === "upgrade") {
      upgradeLines.push(line);
    } else {
      includedLines.push(line);
    }
  }

  return { includedLines, upgradeLines };
}

function resolveSelectedOptionKey(
  dto: ProposalPublicGraphDto,
  visibleOptions: ProposalPublicGraphOptionDto[]
): string | null {
  const selectedKey = (dto.selected_template_option_id ?? "").trim();
  if (selectedKey.length > 0) {
    const match = visibleOptions.find((option) => option.source_template_option_id === selectedKey);
    if (match) {
      return match.source_template_option_id;
    }
    return null;
  }

  return visibleOptions[0]?.source_template_option_id ?? null;
}

function formatTotalInvestment(
  option: ProposalPublicGraphOptionDto,
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy
): string | null {
  if (!displayPolicy.showOptionTotals) {
    return null;
  }
  const total = option.customer_total_cents;
  return total != null ? formatCustomerPacketPriceCents(total) : null;
}

export function buildCustomerPacketEstimateFromPublicDto(
  dto: ProposalPublicGraphDto,
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy = dto.displayPolicy
): {
  estimate: ProposalCustomerPacketEstimateViewModel | null;
  comparison: ProposalCustomerPacketComparisonViewModel | null;
  upgrades: ProposalCustomerPacketUpgradesViewModel | null;
} {
  const visibleOptions = dto.options
    .filter((option) => option.visible_to_customer)
    .sort((a, b) => a.sort_order - b.sort_order);

  const selectedKey = resolveSelectedOptionKey(dto, visibleOptions);
  if (!selectedKey) {
    return { estimate: null, comparison: null, upgrades: null };
  }

  const selectedOption = visibleOptions.find((option) => option.source_template_option_id === selectedKey)!;
  const selectedLabel = optionLabel(selectedOption);
  const selectedMeta = resolvePackageMeta(selectedLabel);
  const { includedLines, upgradeLines } = splitSelectedOptionLines(selectedOption);
  const mappedIncluded = includedLines.map((line) => mapLine(line, displayPolicy));
  const scopeGroups = buildScopeGroups(mappedIncluded);

  const estimate: ProposalCustomerPacketEstimateViewModel = {
    optionKey: selectedKey,
    label: selectedLabel,
    description: selectedMeta.description,
    bullets: [...selectedMeta.bullets],
    accent: selectedMeta.accent,
    totalInvestmentLabel: formatTotalInvestment(selectedOption, displayPolicy),
    confidenceCopy: PROPOSAL_CUSTOMER_PACKET_ESTIMATE_CONFIDENCE,
    scopeGroupSummaries: buildScopeGroupSummaries(scopeGroups),
    includedDetails: scopeGroups,
  };

  const alternates = visibleOptions.filter((option) => option.source_template_option_id !== selectedKey);
  const comparison: ProposalCustomerPacketComparisonViewModel | null =
    alternates.length > 0
      ? {
          options: alternates.map((option) => {
            const label = optionLabel(option);
            const meta = resolvePackageMeta(label);
            return {
              optionKey: option.source_template_option_id,
              label,
              description: meta.description,
              totalInvestmentLabel: formatTotalInvestment(option, displayPolicy),
              accent: meta.accent,
            };
          }),
        }
      : null;

  const upgradeItems = upgradeLines.map((line) => {
    const mapped = mapLine(line, displayPolicy);
    return { name: mapped.name, valueLabel: mapped.valueLabel };
  });
  const upgrades: ProposalCustomerPacketUpgradesViewModel | null =
    upgradeItems.length > 0 ? { items: upgradeItems } : null;

  return { estimate, comparison, upgrades };
}

function readOptionalCompanyEmail(contextEcho: Record<string, unknown>): string | null {
  const value = contextEcho.company_email;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function pageStableId(page: ProposalPublicGraphPageDto): string {
  return `${page.page_type}:${page.sort_order}`;
}

function pageDisplayTitle(page: ProposalPublicGraphPageDto): string {
  const customerTitle = (page.customer_title ?? "").trim();
  if (customerTitle) return customerTitle;
  return (page.title ?? "").trim() || page.page_type;
}

function buildCoverFromPublicDto(dto: ProposalPublicGraphDto): ProposalCustomerPacketCoverViewModel {
  const documentContext = buildProposalDocumentContextFromPublicDto(dto);
  const pricingComplete = isPublicProposalPricingComplete(dto);
  const coverVm = buildProposalCoverViewModel(documentContext, { pricingComplete });
  const companyName = coverVm.company.companyName;

  return {
    proposalLabel: PROPOSAL_CUSTOMER_PACKET_PROPOSAL_LABEL,
    headline: coverVm.headline,
    confidenceCopy: PROPOSAL_CUSTOMER_PACKET_COVER_CONFIDENCE,
    company: {
      companyName,
      preparedByLabel: companyName,
      logoUrl: coverVm.company.logoUrl,
      logoMonogram: coverVm.company.logoMonogram ?? monogramFromCompanyName(companyName),
      brandPrimaryColor: coverVm.company.brandPrimaryColor,
      brandSecondaryColor: coverVm.company.brandSecondaryColor,
    },
    preparedFor: {
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
  };
}

function buildDetailsFromPublicDto(dto: ProposalPublicGraphDto): ProposalCustomerPacketDetailsViewModel | null {
  const documentContext = buildProposalDocumentContextFromPublicDto(dto);
  const pricingComplete = isPublicProposalPricingComplete(dto);

  const tabs = dto.pages
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((page) => TEXT_DETAIL_PAGE_TYPES.has(page.page_type))
    .map((page) => {
      const rawBody = readProposalPageBodyMarkdown(page.content_json);
      const rendered = rawBody
        ? renderProposalDocumentPageBody(rawBody, documentContext, { pricingComplete })
        : { displayText: "" };
      const body = finalizeCustomerPacketDetailBody(
        page.page_type,
        rendered.displayText
      );
      return {
        id: pageStableId(page),
        title: pageDisplayTitle(page),
        body,
        isEmpty: body.length === 0,
      };
    })
    .filter((tab) => !tab.isEmpty && isCustomerPacketMeaningfulDetailBody(tab.body));

  return tabs.length > 0 ? { tabs } : null;
}

function buildContactFromPublicDto(dto: ProposalPublicGraphDto): ProposalCustomerPacketContactViewModel | null {
  const documentContext = buildProposalDocumentContextFromPublicDto(dto);
  const pricingComplete = isPublicProposalPricingComplete(dto);
  const coverVm = buildProposalCoverViewModel(documentContext, { pricingComplete });
  const companyEmail = readOptionalCompanyEmail(dto.context_echo);

  const contact: ProposalCustomerPacketContactViewModel = {
    supportMessage: PROPOSAL_CUSTOMER_PACKET_SUPPORT_MESSAGE,
    companyName: coverVm.company.companyName,
    phone: coverVm.company.phone,
    email: companyEmail,
    website: coverVm.company.website,
    license: coverVm.company.license,
    address: coverVm.company.address,
  };

  const hasAny =
    (contact.companyName ?? "").trim().length > 0 ||
    (contact.phone ?? "").trim().length > 0 ||
    (contact.email ?? "").trim().length > 0 ||
    (contact.website ?? "").trim().length > 0 ||
    (contact.supportMessage ?? "").trim().length > 0;

  return hasAny ? contact : null;
}

export function buildCustomerPacketFromPublicDto(
  dto: ProposalPublicGraphDto
): ProposalCustomerPacketViewModel {
  const { estimate, comparison, upgrades } = buildCustomerPacketEstimateFromPublicDto(
    dto,
    dto.displayPolicy
  );

  return {
    cover: buildCoverFromPublicDto(dto),
    estimate,
    comparison,
    upgrades,
    details: buildDetailsFromPublicDto(dto),
    contact: buildContactFromPublicDto(dto),
  };
}

/** Preview adapter — Phase 2. Contract placeholder for shared architecture. */
export type BuildCustomerPacketFromPreviewGraphInput = {
  graph: unknown;
  templateGraph: unknown;
  catalogItems: unknown;
};

export function buildCustomerPacketFromPreviewGraph(
  _input: BuildCustomerPacketFromPreviewGraphInput
): ProposalCustomerPacketViewModel {
  throw new Error("buildCustomerPacketFromPreviewGraph is not implemented — Preview wiring is Phase 2.");
}

export { formatCustomerFacingUnit, formatCustomerFacingLineLabel };
