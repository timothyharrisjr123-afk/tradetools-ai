/**
 * R17C1 — Pure document estimate presentation mapper for customer Preview.
 *
 * Maps snapshot-backed pricing preview + template line rows into a document-safe
 * DTO for authenticated Preview (and future public/PDF consumers).
 *
 * No React, DB, pricing math, or persistence. Does not mutate inputs.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalBuilderOptionCustomerView } from "@/app/lib/proposalBuilderPricingPreview";
import {
  buildCatalogItemById,
  buildLinePreviewRowsForSection,
  type ProposalPreviewLineRow,
} from "@/app/lib/proposalBuilderPreview";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateSection } from "@/app/lib/proposalTemplateTypes";
import { formatPriceCents } from "@/app/tools/roofing/proposals/builder/proposalBuilderConstants";

export const CUSTOMER_PREVIEW_ESTIMATE_FINALIZING_COPY =
  "Estimate details are being finalized.";

export const CUSTOMER_PREVIEW_LINE_INCLUDED_LABEL = "Included";
export const CUSTOMER_PREVIEW_LINE_IN_PACKAGE_LABEL = "In package";

export type CustomerPreviewPackageMetaInput = {
  description: string;
  bullets: string[];
};

export type CustomerPreviewEstimateLineKind = "priced" | "included" | "grouped";

export type CustomerPreviewEstimateLine = {
  templateItemId: string;
  name: string;
  kind: CustomerPreviewEstimateLineKind;
  /** Formatted price for priced lines; status label for included/grouped. */
  valueLabel: string;
};

export type CustomerPreviewEstimateSectionPresentation = {
  sectionId: string;
  title: string;
  lines: CustomerPreviewEstimateLine[];
};

export type CustomerPreviewPackageHero = {
  label: string | null;
  description: string | null;
  bullets: string[];
};

export type CustomerPreviewEstimateTotalsPresentation = {
  show: boolean;
  subtotalLabel: string | null;
  discountLabel: string | null;
  taxLabel: string | null;
  totalLabel: string | null;
};

export type CustomerPreviewEstimatePresentation = {
  packageHero: CustomerPreviewPackageHero;
  scopeSections: CustomerPreviewEstimateSectionPresentation[];
  upgradeSections: CustomerPreviewEstimateSectionPresentation[];
  totals: CustomerPreviewEstimateTotalsPresentation;
  suppressedBlockerCount: number;
  /** True when no document-safe scope or upgrade lines are available to render. */
  showFinalizingMessage: boolean;
};

export type BuildCustomerPreviewEstimatePresentationInput = {
  graph: ProposalTemplateGraph;
  sections: ProposalTemplateSection[];
  catalogItems: CatalogItem[];
  optionCustomerView: ProposalBuilderOptionCustomerView | null;
  selectedOptionLabel: string | null;
  packageMeta?: CustomerPreviewPackageMetaInput | null;
};

function sectionTitle(section: ProposalTemplateSection): string {
  return (section.customer_title ?? section.name).trim() || section.name;
}

function mapDocumentLine(
  row: ProposalPreviewLineRow,
  optionCustomerView: ProposalBuilderOptionCustomerView | null
): { line: CustomerPreviewEstimateLine | null; suppressed: boolean } {
  if (row.missingCatalog) {
    return { line: null, suppressed: true };
  }

  const lineView = optionCustomerView?.lineByTemplateItemId[row.id];
  if (!lineView) {
    return { line: null, suppressed: true };
  }

  const { displayStatus, showPrice, customerLinePriceCents } = lineView;

  if (displayStatus === "omitted") {
    return { line: null, suppressed: false };
  }

  if (displayStatus === "needs_quantity" || displayStatus === "not_priced") {
    return { line: null, suppressed: true };
  }

  if (displayStatus === "included") {
    return {
      line: {
        templateItemId: row.id,
        name: row.displayName,
        kind: "included",
        valueLabel: CUSTOMER_PREVIEW_LINE_INCLUDED_LABEL,
      },
      suppressed: false,
    };
  }

  if (displayStatus === "grouped") {
    return {
      line: {
        templateItemId: row.id,
        name: row.displayName,
        kind: "grouped",
        valueLabel: CUSTOMER_PREVIEW_LINE_IN_PACKAGE_LABEL,
      },
      suppressed: false,
    };
  }

  if (
    displayStatus === "priced" &&
    showPrice &&
    customerLinePriceCents != null &&
    Number.isFinite(customerLinePriceCents)
  ) {
    return {
      line: {
        templateItemId: row.id,
        name: row.displayName,
        kind: "priced",
        valueLabel: formatPriceCents(customerLinePriceCents),
      },
      suppressed: false,
    };
  }

  return { line: null, suppressed: true };
}

function buildSectionPresentation(
  section: ProposalTemplateSection,
  graph: ProposalTemplateGraph,
  catalogById: Map<string, CatalogItem>,
  optionCustomerView: ProposalBuilderOptionCustomerView | null
): { section: CustomerPreviewEstimateSectionPresentation; suppressedCount: number } {
  const rows = buildLinePreviewRowsForSection(graph, section.id, catalogById, null);
  const lines: CustomerPreviewEstimateLine[] = [];
  let suppressedCount = 0;

  for (const row of rows) {
    const mapped = mapDocumentLine(row, optionCustomerView);
    if (mapped.suppressed) {
      suppressedCount += 1;
    }
    if (mapped.line) {
      lines.push(mapped.line);
    }
  }

  return {
    section: {
      sectionId: section.id,
      title: sectionTitle(section),
      lines,
    },
    suppressedCount,
  };
}

function buildTotals(
  optionCustomerView: ProposalBuilderOptionCustomerView | null
): CustomerPreviewEstimateTotalsPresentation {
  const complete = optionCustomerView?.pricingComplete ?? false;
  if (!complete) {
    return {
      show: false,
      subtotalLabel: null,
      discountLabel: null,
      taxLabel: null,
      totalLabel: null,
    };
  }

  const subtotal = optionCustomerView?.customerSubtotalCents ?? null;
  const discount = optionCustomerView?.discountCents ?? null;
  const tax = optionCustomerView?.salesTaxCents ?? null;
  const total = optionCustomerView?.customerTotalCents ?? null;

  if (subtotal == null || total == null) {
    return {
      show: false,
      subtotalLabel: null,
      discountLabel: null,
      taxLabel: null,
      totalLabel: null,
    };
  }

  const showDiscount = discount != null && discount !== 0;
  const showTax = tax != null && tax !== 0;

  return {
    show: true,
    subtotalLabel: formatPriceCents(subtotal),
    discountLabel: showDiscount && discount != null ? `−${formatPriceCents(Math.abs(discount))}` : null,
    taxLabel: showTax && tax != null ? formatPriceCents(tax) : null,
    totalLabel: formatPriceCents(total),
  };
}

/**
 * Build document-safe estimate presentation for customer Preview surfaces.
 */
export function buildCustomerPreviewEstimatePresentation(
  input: BuildCustomerPreviewEstimatePresentationInput
): CustomerPreviewEstimatePresentation {
  const catalogById = buildCatalogItemById(input.catalogItems);

  let suppressedBlockerCount = 0;
  const scopeSections: CustomerPreviewEstimateSectionPresentation[] = [];
  const upgradeSections: CustomerPreviewEstimateSectionPresentation[] = [];

  for (const section of input.sections) {
    const built = buildSectionPresentation(
      section,
      input.graph,
      catalogById,
      input.optionCustomerView
    );
    suppressedBlockerCount += built.suppressedCount;

    if (section.kind === "upgrade_group") {
      if (built.section.lines.length > 0) {
        upgradeSections.push(built.section);
      }
    } else if (section.kind === "line_items") {
      if (built.section.lines.length > 0) {
        scopeSections.push(built.section);
      }
    }
  }

  const documentLineCount =
    scopeSections.reduce((sum, section) => sum + section.lines.length, 0) +
    upgradeSections.reduce((sum, section) => sum + section.lines.length, 0);

  const packageMeta = input.packageMeta ?? null;

  return {
    packageHero: {
      label: input.selectedOptionLabel,
      description: packageMeta?.description ?? null,
      bullets: packageMeta?.bullets ?? [],
    },
    scopeSections,
    upgradeSections,
    totals: buildTotals(input.optionCustomerView),
    suppressedBlockerCount,
    showFinalizingMessage: documentLineCount === 0,
  };
}
