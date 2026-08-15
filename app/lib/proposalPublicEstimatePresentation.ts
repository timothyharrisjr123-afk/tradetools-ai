/**
 * R18C4A — Public proposal estimate presentation (transitional).
 *
 * Delegates to shared customer packet presenter. Prefer buildCustomerPacketFromPublicDto.
 */

import type { ResolvedCustomerPreviewEstimateDisplayPolicy } from "@/app/lib/proposalCustomerEstimateDisplayPolicy";
import {
  buildCustomerPacketEstimateFromPublicDto,
  formatCustomerPacketPriceCents,
} from "@/app/lib/proposalCustomerPacketPresenter";
import type { PackageAccent } from "@/app/lib/proposalPackagePresentation";
import type {
  ProposalPublicGraphDto,
  ProposalPublicGraphLineDto,
  ProposalPublicGraphOptionDto,
} from "@/app/lib/proposalPublicGraphDto";

export type ProposalPublicEstimateLineViewModel = {
  name: string;
  description: string | null;
  quantityLabel: string | null;
  unit: string | null;
  valueLabel: string | null;
  kind: "priced" | "included" | "informational";
};

export type ProposalPublicScopeGroupViewModel = {
  title: string;
  lines: ProposalPublicEstimateLineViewModel[];
};

export type ProposalPublicOptionTotalsViewModel = {
  showTotals: boolean;
  subtotalLabel: string | null;
  discountLabel: string | null;
  taxLabel: string | null;
  totalLabel: string | null;
  totalInvestmentLabel: string | null;
};

export type ProposalPublicScopeGroupSummaryViewModel = {
  title: string;
  itemCount: number;
  previewLabel: string;
};

export type ProposalPublicPrimaryPackageViewModel = {
  optionKey: string;
  label: string;
  description: string;
  bullets: string[];
  accent: PackageAccent;
  totalInvestmentLabel: string | null;
  scopeGroups: ProposalPublicScopeGroupViewModel[];
  scopeGroupSummaries: ProposalPublicScopeGroupSummaryViewModel[];
  scopeHighlights: string[];
};

export type ProposalPublicAlternateOptionViewModel = {
  optionKey: string;
  label: string;
  description: string;
  totalInvestmentLabel: string | null;
  accent: PackageAccent;
};

export type ProposalPublicOptionalUpgradeViewModel = {
  name: string;
  valueLabel: string | null;
};

export type ProposalPublicSelectedOptionViewModel = {
  optionKey: string;
  label: string;
  selectionMode: "frozen_default" | "frozen_selected";
};

export type ProposalPublicEstimateLayoutViewModel = {
  layout: "selected_primary";
  primaryPackage: ProposalPublicPrimaryPackageViewModel | null;
  alternateOptions: ProposalPublicAlternateOptionViewModel[];
  optionalUpgrades: ProposalPublicOptionalUpgradeViewModel[];
  selectedOption: ProposalPublicSelectedOptionViewModel | null;
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy;
};

/** @deprecated Retained for transitional tests — prefer packet VM. */
export type ProposalPublicOptionCardViewModel = {
  optionKey: string;
  label: string;
  customerLabel: string | null;
  sortOrder: number;
  accent: PackageAccent;
  isSelected: boolean;
  totals: ProposalPublicOptionTotalsViewModel;
  scopeSections: ProposalPublicEstimateScopeSectionViewModel[];
  upgradeSections: ProposalPublicEstimateScopeSectionViewModel[];
  visible: boolean;
};

export type ProposalPublicEstimateScopeSectionViewModel = {
  title: string;
  showHeading: boolean;
  lines: ProposalPublicEstimateLineViewModel[];
};

function mapScopeGroups(
  includedDetails: { title: string; lines: { name: string; valueLabel: string | null; kind: string }[] }[]
): ProposalPublicScopeGroupViewModel[] {
  return includedDetails.map((group) => ({
    title: group.title,
    lines: group.lines.map((line) => ({
      name: line.name,
      description: null,
      quantityLabel: null,
      unit: null,
      valueLabel: line.valueLabel,
      kind: line.kind as ProposalPublicEstimateLineViewModel["kind"],
    })),
  }));
}

export function buildProposalPublicEstimateLayout(
  dto: ProposalPublicGraphDto,
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy = dto.displayPolicy
): ProposalPublicEstimateLayoutViewModel {
  const { estimate, comparison, upgrades } = buildCustomerPacketEstimateFromPublicDto(dto, displayPolicy);

  const primaryPackage: ProposalPublicPrimaryPackageViewModel | null = estimate
    ? {
        optionKey: estimate.optionKey,
        label: estimate.label,
        description: estimate.description,
        bullets: [...estimate.bullets],
        accent: estimate.accent,
        totalInvestmentLabel: estimate.totalInvestmentLabel,
        scopeGroups: mapScopeGroups(estimate.includedDetails),
        scopeGroupSummaries: estimate.scopeGroupSummaries,
        scopeHighlights: estimate.includedDetails.flatMap((g) => g.lines.map((l) => l.name)).slice(0, 8),
      }
    : null;

  const alternateOptions: ProposalPublicAlternateOptionViewModel[] =
    comparison?.options
      .filter((option) => !option.isCurrent)
      .map((option) => ({
        optionKey: option.optionKey,
        label: option.label,
        description: option.description,
        totalInvestmentLabel: option.totalInvestmentLabel,
        accent: option.accent,
      })) ?? [];

  const optionalUpgrades: ProposalPublicOptionalUpgradeViewModel[] =
    upgrades?.items.map((item) => ({ name: item.name, valueLabel: item.valueLabel })) ?? [];

  const selectedKey = (dto.selected_template_option_id ?? "").trim();
  const selectedOption: ProposalPublicSelectedOptionViewModel | null = estimate
    ? {
        optionKey: estimate.optionKey,
        label: estimate.label,
        selectionMode: selectedKey.length > 0 ? "frozen_selected" : "frozen_default",
      }
    : null;

  return {
    layout: "selected_primary",
    primaryPackage,
    alternateOptions,
    optionalUpgrades,
    selectedOption,
    displayPolicy,
  };
}

export function buildProposalPublicOptionCards(
  dto: ProposalPublicGraphDto,
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy
): ProposalPublicOptionCardViewModel[] {
  const layout = buildProposalPublicEstimateLayout(dto, displayPolicy);
  const cards: ProposalPublicOptionCardViewModel[] = [];

  if (layout.primaryPackage) {
    const selectedOption = dto.options.find(
      (option) => option.source_template_option_id === layout.primaryPackage!.optionKey
    );
    if (selectedOption) {
      cards.push({
        optionKey: layout.primaryPackage.optionKey,
        label: layout.primaryPackage.label,
        customerLabel: selectedOption.customer_label,
        sortOrder: selectedOption.sort_order,
        accent: layout.primaryPackage.accent,
        isSelected: true,
        totals: {
          showTotals: displayPolicy.showOptionTotals,
          subtotalLabel: null,
          discountLabel: null,
          taxLabel: null,
          totalLabel: layout.primaryPackage.totalInvestmentLabel,
          totalInvestmentLabel: layout.primaryPackage.totalInvestmentLabel,
        },
        scopeSections: [
          {
            title: "Included scope",
            showHeading: displayPolicy.showSectionHeadings,
            lines: layout.primaryPackage.scopeGroups.flatMap((g) => g.lines),
          },
        ],
        upgradeSections: [],
        visible: true,
      });
    }
  }

  for (const alternate of layout.alternateOptions) {
    const option = dto.options.find((item) => item.source_template_option_id === alternate.optionKey);
    if (!option) continue;
    cards.push({
      optionKey: alternate.optionKey,
      label: alternate.label,
      customerLabel: option.customer_label,
      sortOrder: option.sort_order,
      accent: alternate.accent,
      isSelected: false,
      totals: {
        showTotals: displayPolicy.showOptionTotals,
        subtotalLabel: null,
        discountLabel: null,
        taxLabel: null,
        totalLabel: alternate.totalInvestmentLabel,
        totalInvestmentLabel: alternate.totalInvestmentLabel,
      },
      scopeSections: [],
      upgradeSections: [],
      visible: true,
    });
  }

  return cards.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function buildProposalPublicSelectedOptionViewModel(
  dto: ProposalPublicGraphDto,
  _optionCards: ProposalPublicOptionCardViewModel[]
): ProposalPublicSelectedOptionViewModel | null {
  return buildProposalPublicEstimateLayout(dto, dto.displayPolicy).selectedOption;
}

export { formatCustomerPacketPriceCents as formatProposalPublicCustomerPriceCents };
