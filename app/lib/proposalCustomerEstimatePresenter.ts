/**
 * R17C1 — Pure document estimate presentation mapper for customer Preview.
 *
 * Maps snapshot-backed pricing preview + template line rows into a document-safe
 * DTO for authenticated Preview (and future public/PDF consumers).
 *
 * R17C4 Phase 4A — honors estimate page display policy from `settings_json`.
 *
 * No React, DB, pricing math, or persistence. Does not mutate inputs.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import { formatContractorEstimateQtyLabel } from "@/app/lib/proposalBuilderWorkbenchEstimatePresenter";
import type { ProposalBuilderOptionCustomerView } from "@/app/lib/proposalBuilderPricingPreview";
import {
  buildCatalogItemById,
  buildLinePreviewRowsForSection,
  type ProposalPreviewLineRow,
} from "@/app/lib/proposalBuilderPreview";
import {
  resolveCustomerPreviewEstimateDisplayPolicy,
  type ResolvedCustomerPreviewEstimateDisplayPolicy,
} from "@/app/lib/proposalCustomerEstimateDisplayPolicy";
import { resolveDraftOwnedLineCustomerLabel } from "@/app/lib/proposalDraftLinePresentation";
import type { ProposalSnapshotLineQuantityView } from "@/app/lib/proposalDraftGraphAdapter";
import type { ProposalPageSettings } from "@/app/lib/proposalPageTypes";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateSection } from "@/app/lib/proposalTemplateTypes";
import { formatPriceCents } from "@/app/tools/roofing/proposals/builder/proposalBuilderConstants";

export const CUSTOMER_PREVIEW_ESTIMATE_FINALIZING_COPY =
  "Estimate details are being finalized.";

export const CUSTOMER_PREVIEW_LINE_INCLUDED_LABEL = "Included";
export const CUSTOMER_PREVIEW_LINE_IN_PACKAGE_LABEL = "In package";

export type CustomerPreviewPackageMetaInput = {
  description: string | null;
  bullets: string[];
};

export type CustomerPreviewEstimateLineKind = "priced" | "included" | "grouped";

export type CustomerPreviewEstimateLine = {
  templateItemId: string;
  name: string;
  kind: CustomerPreviewEstimateLineKind;
  /**
   * Resolved quantity label for customer document (e.g. "27.5 SQ").
   * Null when no resolved snapshot quantity is available.
   * Manual quantities appear as normal values — never a "manual" badge.
   */
  qtyLabel: string | null;
  /**
   * Formatted price for priced lines; status label for included/grouped.
   * Null when display policy hides per-line dollar amounts.
   */
  valueLabel: string | null;
};

export type CustomerPreviewEstimateSectionPresentation = {
  sectionId: string;
  title: string;
  /** When false, customer Preview omits section heading chrome. */
  showHeading: boolean;
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
  displayPolicy: ResolvedCustomerPreviewEstimateDisplayPolicy;
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
  /** Estimate page settings from persisted `proposal_pages.settings_json`. */
  estimatePageSettings?: ProposalPageSettings | null;
  /** Snapshot-resolved quantities for customer-safe Qty column (display only). */
  snapshotQuantityByTemplateItemId?: Record<
    string,
    ProposalSnapshotLineQuantityView
  > | null;
};

function resolveCustomerQtyLabel(
  snapshotQty: ProposalSnapshotLineQuantityView | null | undefined
): string | null {
  const raw = snapshotQty?.quantityDisplayLabel?.trim();
  if (!raw) return null;
  // Customer document: show resolved qty as a normal value — never "manual".
  const cleaned = raw.replace(/\bmanual\b/gi, "").replace(/\s{2,}/g, " ").trim();
  if (!cleaned) return null;
  return formatContractorEstimateQtyLabel(cleaned);
}

function sectionTitle(section: ProposalTemplateSection): string {
  return (section.customer_title ?? section.name).trim() || section.name;
}

function mapDocumentLine(
  row: ProposalPreviewLineRow,
  optionCustomerView: ProposalBuilderOptionCustomerView | null,
  showLinePrices: boolean,
  snapshotQty: ProposalSnapshotLineQuantityView | null | undefined
): { line: CustomerPreviewEstimateLine | null; suppressed: boolean } {
  if (row.missingCatalog) {
    return { line: null, suppressed: true };
  }

  const lineView = optionCustomerView?.lineByTemplateItemId[row.id];
  if (!lineView) {
    return { line: null, suppressed: true };
  }

  if (!lineView.showOnCustomerDocument) {
    return { line: null, suppressed: false };
  }

  const { displayStatus, showPrice, customerLinePriceCents } = lineView;
  const qtyLabel = resolveCustomerQtyLabel(snapshotQty);

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
        qtyLabel,
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
        qtyLabel,
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
        qtyLabel,
        valueLabel: showLinePrices ? formatPriceCents(customerLinePriceCents) : null,
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
  optionCustomerView: ProposalBuilderOptionCustomerView | null,
  showLinePrices: boolean,
  showSectionHeadings: boolean,
  snapshotQuantityByTemplateItemId:
    | Record<string, ProposalSnapshotLineQuantityView>
    | null
    | undefined
): { section: CustomerPreviewEstimateSectionPresentation; suppressedCount: number } {
  const rows = buildLinePreviewRowsForSection(graph, section.id, catalogById, null);
  const lines: CustomerPreviewEstimateLine[] = [];
  let suppressedCount = 0;

  for (const row of rows) {
    const mapped = mapDocumentLine(
      row,
      optionCustomerView,
      showLinePrices,
      snapshotQuantityByTemplateItemId?.[row.id]
    );
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
      showHeading: showSectionHeadings,
      lines,
    },
    suppressedCount,
  };
}

function buildTotals(
  optionCustomerView: ProposalBuilderOptionCustomerView | null,
  showOptionTotals: boolean
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
    show: showOptionTotals,
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
  const displayPolicy = resolveCustomerPreviewEstimateDisplayPolicy(input.estimatePageSettings);

  let suppressedBlockerCount = 0;
  const scopeSections: CustomerPreviewEstimateSectionPresentation[] = [];
  const upgradeSections: CustomerPreviewEstimateSectionPresentation[] = [];

  for (const section of input.sections) {
    const built = buildSectionPresentation(
      section,
      input.graph,
      catalogById,
      input.optionCustomerView,
      displayPolicy.showLinePrices,
      displayPolicy.showSectionHeadings,
      input.snapshotQuantityByTemplateItemId
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
    totals: buildTotals(input.optionCustomerView, displayPolicy.showOptionTotals),
    displayPolicy,
    suppressedBlockerCount,
    showFinalizingMessage: documentLineCount === 0,
  };
}

export type DraftPreviewEstimateLineInput = {
  sourceTemplateItemId: string;
  customerName: string;
  catalogSeedKey?: string | null;
  catalogItemId?: string | null;
  role: string | null;
  sortOrder: number;
};

export type BuildCustomerPreviewEstimatePresentationFromDraftInput = {
  draftLines: DraftPreviewEstimateLineInput[];
  catalogItems?: CatalogItem[];
  optionCustomerView: ProposalBuilderOptionCustomerView | null;
  selectedOptionLabel: string | null;
  packageMeta?: CustomerPreviewPackageMetaInput | null;
  estimatePageSettings?: ProposalPageSettings | null;
  snapshotQuantityByTemplateItemId?: Record<
    string,
    ProposalSnapshotLineQuantityView
  > | null;
};

/**
 * V2E1 — Preview estimate from persisted draft lines (no live Template composition).
 */
export function buildCustomerPreviewEstimatePresentationFromDraft(
  input: BuildCustomerPreviewEstimatePresentationFromDraftInput
): CustomerPreviewEstimatePresentation {
  const displayPolicy = resolveCustomerPreviewEstimateDisplayPolicy(input.estimatePageSettings);
  const showLinePrices = displayPolicy.showLinePrices;
  const showSectionHeadings = displayPolicy.showSectionHeadings;
  const catalogById = buildCatalogItemById(input.catalogItems ?? []);

  const scopeLines: CustomerPreviewEstimateLine[] = [];
  const upgradeLines: CustomerPreviewEstimateLine[] = [];
  let suppressedBlockerCount = 0;

  const sorted = [...input.draftLines].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.sourceTemplateItemId.localeCompare(b.sourceTemplateItemId);
  });

  for (const draftLine of sorted) {
    const catalogId = (draftLine.catalogItemId ?? "").trim();
    const catalog = catalogId ? catalogById.get(catalogId) : undefined;
    const displayName = resolveDraftOwnedLineCustomerLabel({
      customerName: draftLine.customerName,
      catalogSeedKey: draftLine.catalogSeedKey,
      catalogItem: catalog ?? null,
    });
    const row: ProposalPreviewLineRow = {
      id: draftLine.sourceTemplateItemId,
      displayName,
      itemTypeLabel: "",
      unitLabel: "",
      quantitySourceLabel: "",
      quantityRuleLabel: "",
      quantityDisplayLabel: "",
      quantityStatusLabel: "",
      quantityUnresolved: false,
      catalogSetupPriceLabel: "",
      roleLabel: draftLine.role ?? "",
      missingCatalog: false,
    };
    const mapped = mapDocumentLine(
      row,
      input.optionCustomerView,
      showLinePrices,
      input.snapshotQuantityByTemplateItemId?.[draftLine.sourceTemplateItemId]
    );
    if (mapped.suppressed) suppressedBlockerCount += 1;
    if (!mapped.line) continue;

    const role = (draftLine.role ?? "").trim().toLowerCase();
    if (role === "upgrade" || role === "optional_addon") {
      upgradeLines.push(mapped.line);
    } else {
      scopeLines.push(mapped.line);
    }
  }

  const scopeSections: CustomerPreviewEstimateSectionPresentation[] =
    scopeLines.length > 0
      ? [
          {
            sectionId: "draft-scope",
            title: "Included work",
            showHeading: showSectionHeadings,
            lines: scopeLines,
          },
        ]
      : [];
  const upgradeSections: CustomerPreviewEstimateSectionPresentation[] =
    upgradeLines.length > 0
      ? [
          {
            sectionId: "draft-upgrades",
            title: "Optional upgrades",
            showHeading: showSectionHeadings,
            lines: upgradeLines,
          },
        ]
      : [];

  const documentLineCount = scopeLines.length + upgradeLines.length;
  const packageMeta = input.packageMeta ?? null;

  return {
    packageHero: {
      label: input.selectedOptionLabel,
      description: packageMeta?.description ?? null,
      bullets: packageMeta?.bullets ?? [],
    },
    scopeSections,
    upgradeSections,
    totals: buildTotals(input.optionCustomerView, displayPolicy.showOptionTotals),
    displayPolicy,
    suppressedBlockerCount,
    showFinalizingMessage: documentLineCount === 0,
  };
}
