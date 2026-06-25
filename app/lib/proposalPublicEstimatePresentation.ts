/**
 * R18C4A — Pure public proposal estimate/option card presentation from public DTO.
 *
 * Maps frozen sent snapshot lines and totals into customer-safe option cards.
 * No DB, React, draft graph, or pricing engine math.
 */

import type { ResolvedCustomerPreviewEstimateDisplayPolicy } from "@/app/lib/proposalCustomerEstimateDisplayPolicy";
import type {
  ProposalPublicGraphDto,
  ProposalPublicGraphLineDto,
  ProposalPublicGraphOptionDto,
} from "@/app/lib/proposalPublicGraphDto";
import { resolvePackageMeta, type PackageAccent } from "@/app/lib/proposalPackagePresentation";

export type ProposalPublicEstimateLineViewModel = {
  name: string;
  description: string | null;
  quantityLabel: string | null;
  unit: string | null;
  valueLabel: string | null;
  kind: "priced" | "included" | "informational";
};

export type ProposalPublicEstimateScopeSectionViewModel = {
  title: string;
  showHeading: boolean;
  lines: ProposalPublicEstimateLineViewModel[];
};

export type ProposalPublicOptionTotalsViewModel = {
  showTotals: boolean;
  subtotalLabel: string | null;
  discountLabel: string | null;
  taxLabel: string | null;
  totalLabel: string | null;
};

export type ProposalPublicOptionCardViewModel = {
  optionKey: string;
  label: string;
  customerLabel: string | null;
  sortOrder: number;
  accent: PackageAccent;
  isSelected: boolean;
  isRecommended: boolean;
  totals: ProposalPublicOptionTotalsViewModel;
  scopeSections: ProposalPublicEstimateScopeSectionViewModel[];
  upgradeSections: ProposalPublicEstimateScopeSectionViewModel[];
  visible: boolean;
};

export type ProposalPublicSelectedOptionViewModel = {
  optionKey: string;
  label: string;
  selectionMode: "frozen_default" | "frozen_selected";
};

function formatCustomerPriceCents(cents: number): string {
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
): ProposalPublicEstimateLineViewModel {
  const showQty = displayPolicy.showLinePrices;
  const quantityLabel =
    showQty && line.quantity_display_label
      ? line.quantity_display_label
      : showQty && line.quantity != null
        ? String(line.quantity)
        : null;

  let kind: ProposalPublicEstimateLineViewModel["kind"] = "informational";
  let valueLabel: string | null = null;

  if (line.pricing_status === "included" || line.pricing_status === "grouped") {
    kind = "included";
    valueLabel = "Included";
  } else if (line.pricing_status === "priced" && line.customer_line_total_cents != null) {
    kind = "priced";
    valueLabel = displayPolicy.showLinePrices
      ? formatCustomerPriceCents(line.customer_line_total_cents)
      : null;
  }

  return {
    name: line.customer_name,
    description: line.description,
    quantityLabel,
    unit: showQty ? line.unit : null,
    valueLabel,
    kind,
  };
}

function mapTotals(
  option: ProposalPublicGraphOptionDto,
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy
): ProposalPublicOptionTotalsViewModel {
  const showTotals = displayPolicy.showOptionTotals;
  if (!showTotals) {
    return {
      showTotals: false,
      subtotalLabel: null,
      discountLabel: null,
      taxLabel: null,
      totalLabel: null,
    };
  }

  const subtotal = option.customer_subtotal_cents;
  const discount = option.discount_cents;
  const tax = option.sales_tax_cents;
  const total = option.customer_total_cents;

  return {
    showTotals: true,
    subtotalLabel: subtotal != null ? formatCustomerPriceCents(subtotal) : null,
    discountLabel:
      discount != null && discount !== 0 ? `−${formatCustomerPriceCents(Math.abs(discount))}` : null,
    taxLabel: tax != null && tax !== 0 ? formatCustomerPriceCents(tax) : null,
    totalLabel: total != null ? formatCustomerPriceCents(total) : null,
  };
}

function mapScopeSections(
  lines: ProposalPublicGraphLineDto[],
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy
): ProposalPublicEstimateScopeSectionViewModel[] {
  const mappedLines = lines.map((line) => mapLine(line, displayPolicy));
  if (mappedLines.length === 0) {
    return [];
  }

  return [
    {
      title: "Included scope",
      showHeading: displayPolicy.showSectionHeadings,
      lines: mappedLines,
    },
  ];
}

export function buildProposalPublicOptionCards(
  dto: ProposalPublicGraphDto,
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy
): ProposalPublicOptionCardViewModel[] {
  const selectedKey = (dto.selected_template_option_id ?? "").trim();
  const visibleOptions = dto.options
    .filter((option) => option.visible_to_customer)
    .sort((a, b) => a.sort_order - b.sort_order);

  const defaultKey =
    visibleOptions.find((option) => option.source_template_option_id === selectedKey)
      ?.source_template_option_id ??
    visibleOptions[0]?.source_template_option_id ??
    null;

  return visibleOptions.map((option) => {
    const label = optionLabel(option);
    const accent = resolvePackageMeta(label).accent;
    const optionKey = option.source_template_option_id;
    const isSelected = selectedKey.length > 0 ? optionKey === selectedKey : optionKey === defaultKey;
    const isRecommended = optionKey === defaultKey;

    return {
      optionKey,
      label,
      customerLabel: option.customer_label,
      sortOrder: option.sort_order,
      accent,
      isSelected,
      isRecommended,
      totals: mapTotals(option, displayPolicy),
      scopeSections: mapScopeSections(option.line_items, displayPolicy),
      upgradeSections: [],
      visible: true,
    };
  });
}

export function buildProposalPublicSelectedOptionViewModel(
  dto: ProposalPublicGraphDto,
  optionCards: ProposalPublicOptionCardViewModel[]
): ProposalPublicSelectedOptionViewModel | null {
  const selectedKey = (dto.selected_template_option_id ?? "").trim();
  const card =
    optionCards.find((option) => option.isSelected) ??
    (selectedKey ? optionCards.find((option) => option.optionKey === selectedKey) : null) ??
    optionCards[0] ??
    null;

  if (!card) return null;

  return {
    optionKey: card.optionKey,
    label: card.label,
    selectionMode: selectedKey.length > 0 ? "frozen_selected" : "frozen_default",
  };
}
