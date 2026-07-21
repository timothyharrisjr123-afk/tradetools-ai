/**
 * FieldDive Proposal Pricing Engine (3I-1A).
 *
 * Pure deterministic pricing math — no React, Supabase, stores, persistence,
 * or legacy estimator imports. Consumes ProposalPricingInput (quantities from 3H-3
 * via future mapper); does not recompute geometry, waste, or coverage.
 *
 * Policy rules: docs/fielddive-global-handoff.md §6H.
 *
 * Mapper follow-up (3I-1B): populate PricingLineInput.itemType from CatalogItem.item_type
 * so material purchase tax and labor unit cost resolution apply correctly.
 *
 * Input hardening (3I-1A.1): negative quantity → unsupported/block; negative profitability
 * or fixed discount → unpriced or zero discount; quantity 0 → deliberate zero line amounts.
 */

import type { CatalogItemType } from "@/app/lib/catalogTypes";
import {
  DEFAULT_WASTE_MODEL,
  linePricingStatusLabel,
  type LinePricingStatus,
  type PricingActorRole,
  type PricingLineInput,
  type PricingPolicy,
  type ProfitabilityGuardrailResult,
  type ProposalLinePricing,
  type ProposalOptionPricing,
  type ProposalPricingInput,
  type ProposalPricingResult,
  type ProposalPricingTotals,
  type ProposalSectionPricing,
} from "@/app/lib/proposalPricingTypes";
import { upgradeLineContributesToTotals } from "@/app/lib/proposalUpgradeTruthTypes";

// ---------------------------------------------------------------------------
// Money helpers (integer cents, round half-up)
// ---------------------------------------------------------------------------

function isFiniteNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/** Round half-up to integer cents. */
function roundHalfUpCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 0) return Math.round(value);
  return -Math.round(-value);
}

function finiteCents(value: number | null | undefined): number | null {
  if (!isFiniteNumber(value)) return null;
  return roundHalfUpCents(value);
}

function isBlockingStatus(status: LinePricingStatus): boolean {
  return status === "unpriced" || status === "unsupported" || status === "unresolved_quantity";
}

// ---------------------------------------------------------------------------
// Visibility / contribution rules (§6H §9)
// ---------------------------------------------------------------------------

function contributesToCustomerSubtotal(line: PricingLineInput, linePriceCents: number | null): boolean {
  if (line.suppressedByReplacement === true) return false;
  if (line.pricingBasis === "included") return false;
  if (line.customerVisibility === "internal_only") return false;
  if (linePriceCents == null) return false;

  const isUpgradeLine = line.upgradeScope != null;
  if (
    !upgradeLineContributesToTotals({
      isUpgradeLine,
      selectionState: line.upgradeScope?.selectionState,
    })
  ) {
    return false;
  }

  return (
    line.customerVisibility === "customer_visible" ||
    line.customerVisibility === "grouped" ||
    line.hiddenButInCalc === true
  );
}

// ---------------------------------------------------------------------------
// Cost / price derivation
// ---------------------------------------------------------------------------

function primaryUnitCostCents(line: PricingLineInput): number | null {
  if (line.itemType === "labor") {
    return finiteCents(line.laborUnitCostCents ?? line.unitCostCents);
  }
  return finiteCents(line.unitCostCents);
}

function effectiveUnitCostCents(line: PricingLineInput, policy: PricingPolicy): number | null {
  const base = primaryUnitCostCents(line);
  if (base == null) return null;

  const purchaseTaxRate = policy.tax.materialPurchaseTaxRatePct;
  if (
    line.itemType === "material" &&
    isFiniteNumber(purchaseTaxRate) &&
    purchaseTaxRate > 0
  ) {
    return roundHalfUpCents(base + (base * purchaseTaxRate) / 100);
  }

  return base;
}

function deriveUnitCustomerPriceCents(
  effectiveCost: number,
  policy: PricingPolicy
): number | null {
  const pct = policy.defaultProfitabilityPct;
  if (!isFiniteNumber(pct) || pct < 0) return null;

  if (policy.profitabilityType === "margin") {
    if (pct >= 100) return null;
    const divisor = 1 - pct / 100;
    if (divisor <= 0) return null;
    return roundHalfUpCents(effectiveCost / divisor);
  }

  return roundHalfUpCents(effectiveCost * (1 + pct / 100));
}

/** Resolved quantity when not flagged unresolved; null if missing/non-finite. */
function lineQuantity(line: PricingLineInput): number | null {
  if (line.quantityUnresolved) return null;
  if (!isFiniteNumber(line.quantity)) return null;
  return line.quantity;
}

function computeLineMarginPct(linePriceCents: number, lineCostCents: number): number | null {
  if (linePriceCents <= 0) return null;
  return ((linePriceCents - lineCostCents) / linePriceCents) * 100;
}

function computeLineMarkupPct(linePriceCents: number, lineCostCents: number): number | null {
  if (lineCostCents <= 0) return null;
  return ((linePriceCents - lineCostCents) / lineCostCents) * 100;
}

type PricedLineCore = {
  status: LinePricingStatus;
  unresolved: boolean;
  blocking: boolean;
  unitCostCents: number | null;
  effectiveUnitCostCents: number | null;
  lineCostCents: number | null;
  unitPriceCents: number | null;
  linePriceCents: number | null;
  notes: string | null;
};

function isSupportedWasteModel(wasteModel: PricingPolicy["wasteModel"]): boolean {
  // Phase 5: accept adjusted_measurement (default) and policy-gated raw_plus_waste.
  // Engine never applies coverage/waste math — quantities are already resolved upstream.
  return (
    wasteModel === DEFAULT_WASTE_MODEL || wasteModel === "raw_plus_waste"
  );
}

function priceLine(line: PricingLineInput, policy: PricingPolicy): PricedLineCore {
  if (!isSupportedWasteModel(policy.wasteModel)) {
    return {
      status: "unsupported",
      unresolved: true,
      blocking: true,
      unitCostCents: null,
      effectiveUnitCostCents: null,
      lineCostCents: null,
      unitPriceCents: null,
      linePriceCents: null,
      notes: "Unsupported waste model for 3I-1A",
    };
  }

  if (line.quantityUnresolved) {
    return {
      status: "unresolved_quantity",
      unresolved: true,
      blocking: true,
      unitCostCents: finiteCents(line.unitCostCents),
      effectiveUnitCostCents: null,
      lineCostCents: null,
      unitPriceCents: finiteCents(line.unitPriceCents),
      linePriceCents: null,
      notes: null,
    };
  }

  const qty = lineQuantity(line);
  if (qty == null) {
    return {
      status: "unresolved_quantity",
      unresolved: true,
      blocking: true,
      unitCostCents: finiteCents(line.unitCostCents),
      effectiveUnitCostCents: null,
      lineCostCents: null,
      unitPriceCents: finiteCents(line.unitPriceCents),
      linePriceCents: null,
      notes: null,
    };
  }

  if (qty < 0) {
    return {
      status: "unsupported",
      unresolved: true,
      blocking: true,
      unitCostCents: finiteCents(line.unitCostCents),
      effectiveUnitCostCents: null,
      lineCostCents: null,
      unitPriceCents: finiteCents(line.unitPriceCents),
      linePriceCents: null,
      notes: "Invalid negative quantity",
    };
  }

  const effectiveCost = effectiveUnitCostCents(line, policy);
  const rawUnitCost = primaryUnitCostCents(line);

  switch (line.pricingBasis) {
    case "included": {
      const lineCost =
        effectiveCost != null ? roundHalfUpCents(effectiveCost * qty) : null;
      return {
        status: "included",
        unresolved: false,
        blocking: false,
        unitCostCents: rawUnitCost,
        effectiveUnitCostCents: effectiveCost,
        lineCostCents: lineCost,
        unitPriceCents: 0,
        linePriceCents: 0,
        notes: null,
      };
    }

    case "cost_plus_margin": {
      if (effectiveCost == null) {
        return {
          status: "unpriced",
          unresolved: false,
          blocking: true,
          unitCostCents: rawUnitCost,
          effectiveUnitCostCents: null,
          lineCostCents: null,
          unitPriceCents: null,
          linePriceCents: null,
          notes: "Missing unit cost for cost-plus pricing",
        };
      }
      const unitPrice = deriveUnitCustomerPriceCents(effectiveCost, policy);
      if (unitPrice == null) {
        return {
          status: "unpriced",
          unresolved: false,
          blocking: true,
          unitCostCents: rawUnitCost,
          effectiveUnitCostCents: effectiveCost,
          lineCostCents: null,
          unitPriceCents: null,
          linePriceCents: null,
          notes: "Invalid profitability for cost-plus pricing",
        };
      }
      const lineCost = roundHalfUpCents(effectiveCost * qty);
      const linePrice = roundHalfUpCents(unitPrice * qty);
      return {
        status: line.customerVisibility === "internal_only" ? "hidden" : "priced",
        unresolved: false,
        blocking: false,
        unitCostCents: rawUnitCost,
        effectiveUnitCostCents: effectiveCost,
        lineCostCents: lineCost,
        unitPriceCents: unitPrice,
        linePriceCents: linePrice,
        notes: null,
      };
    }

    case "unit_price": {
      const unitPrice = finiteCents(line.unitPriceCents);
      if (unitPrice == null) {
        return {
          status: "unpriced",
          unresolved: false,
          blocking: true,
          unitCostCents: rawUnitCost,
          effectiveUnitCostCents: effectiveCost,
          lineCostCents: effectiveCost != null ? roundHalfUpCents(effectiveCost * qty) : null,
          unitPriceCents: null,
          linePriceCents: null,
          notes: "Missing unit price",
        };
      }
      const linePrice = roundHalfUpCents(unitPrice * qty);
      return {
        status: line.customerVisibility === "internal_only" ? "hidden" : "priced",
        unresolved: false,
        blocking: false,
        unitCostCents: rawUnitCost,
        effectiveUnitCostCents: effectiveCost,
        lineCostCents: effectiveCost != null ? roundHalfUpCents(effectiveCost * qty) : null,
        unitPriceCents: unitPrice,
        linePriceCents: linePrice,
        notes: null,
      };
    }

    case "fixed_price": {
      const fixedUnitPrice = finiteCents(line.unitPriceCents);
      if (fixedUnitPrice == null) {
        return {
          status: "unpriced",
          unresolved: false,
          blocking: true,
          unitCostCents: rawUnitCost,
          effectiveUnitCostCents: effectiveCost,
          lineCostCents: effectiveCost != null ? roundHalfUpCents(effectiveCost * qty) : null,
          unitPriceCents: null,
          linePriceCents: null,
          notes: "Missing fixed price",
        };
      }
      const linePrice =
        line.unit === "fixed" ? fixedUnitPrice : roundHalfUpCents(fixedUnitPrice * qty);
      return {
        status: line.customerVisibility === "internal_only" ? "hidden" : "priced",
        unresolved: false,
        blocking: false,
        unitCostCents: rawUnitCost,
        effectiveUnitCostCents: effectiveCost,
        lineCostCents: effectiveCost != null ? roundHalfUpCents(effectiveCost * qty) : null,
        unitPriceCents: fixedUnitPrice,
        linePriceCents: linePrice,
        notes: null,
      };
    }

    default:
      return {
        status: "unsupported",
        unresolved: true,
        blocking: true,
        unitCostCents: rawUnitCost,
        effectiveUnitCostCents: effectiveCost,
        lineCostCents: null,
        unitPriceCents: finiteCents(line.unitPriceCents),
        linePriceCents: null,
        notes: "Unsupported pricing basis",
      };
  }
}

function buildProposalLinePricing(
  line: PricingLineInput,
  policy: PricingPolicy
): ProposalLinePricing {
  const core = priceLine(line, policy);
  const linePrice = core.linePriceCents;
  const lineCost = core.lineCostCents;

  let profitCents: number | null = null;
  let marginPct: number | null = null;
  let markupPct: number | null = null;

  if (linePrice != null && lineCost != null) {
    profitCents = linePrice - lineCost;
    marginPct = computeLineMarginPct(linePrice, lineCost);
    markupPct = computeLineMarkupPct(linePrice, lineCost);
  }

  return {
    templateItemId: line.templateItemId,
    status: core.status,
    unresolved: core.unresolved,
    quantity: line.quantityUnresolved ? null : line.quantity,
    unit: line.unit,
    pricingBasis: line.pricingBasis,
    customerVisibility: line.customerVisibility,
    unitCostCents: core.unitCostCents,
    effectiveUnitCostCents: core.effectiveUnitCostCents,
    lineCostCents: core.lineCostCents,
    unitPriceCents: core.unitPriceCents,
    linePriceCents: core.linePriceCents,
    profitCents,
    marginPct,
    markupPct,
    taxable: false,
    salesTaxCents: null,
    statusLabel: linePricingStatusLabel(core.status),
    notes: core.notes,
  };
}

// ---------------------------------------------------------------------------
// Section rollup (when sectionId supplied on lines)
// ---------------------------------------------------------------------------

function buildSectionRollups(
  pricedLines: Array<{ input: PricingLineInput; output: ProposalLinePricing }>,
  hasBlockingIssues: boolean
): ProposalSectionPricing[] {
  const bySection = new Map<string, ProposalSectionPricing>();

  for (const { input: lineIn, output: lineOut } of pricedLines) {
    const sectionId = lineIn.sectionId ?? "__ungrouped__";
    let section = bySection.get(sectionId);
    if (!section) {
      section = {
        sectionId,
        customerSubtotalCents: hasBlockingIssues ? null : 0,
        internalCostCents: 0,
        lineCount: 0,
        unresolvedLineCount: 0,
      };
      bySection.set(sectionId, section);
    }

    section.lineCount += 1;
    if (lineOut.unresolved || isBlockingStatus(lineOut.status)) {
      section.unresolvedLineCount += 1;
    }

    if (
      lineOut.lineCostCents != null &&
      lineIn.suppressedByReplacement !== true &&
      !(
        lineIn.upgradeScope != null &&
        !upgradeLineContributesToTotals({
          isUpgradeLine: true,
          selectionState: lineIn.upgradeScope.selectionState,
        })
      )
    ) {
      section.internalCostCents = (section.internalCostCents ?? 0) + lineOut.lineCostCents;
    }

    if (
      !hasBlockingIssues &&
      contributesToCustomerSubtotal(lineIn, lineOut.linePriceCents) &&
      lineOut.linePriceCents != null &&
      section.customerSubtotalCents != null
    ) {
      section.customerSubtotalCents += lineOut.linePriceCents;
    }
  }

  return [...bySection.values()].map((section) => {
    const internalCost = section.internalCostCents ?? 0;
    return {
      ...section,
      internalCostCents: internalCost > 0 ? internalCost : null,
      customerSubtotalCents: hasBlockingIssues ? null : section.customerSubtotalCents,
    };
  });
}

// ---------------------------------------------------------------------------
// Option rollup — discount, tax, guardrail (§6H §1–§2, §6)
// ---------------------------------------------------------------------------

function computeDiscountCents(
  customerSubtotalCents: number,
  policy: PricingPolicy
): number {
  const discount = policy.discount;
  if (!discount || !isFiniteNumber(discount.value) || customerSubtotalCents <= 0) {
    return 0;
  }

  if (discount.kind === "percent") {
    const pct = Math.max(0, Math.min(100, discount.value));
    return roundHalfUpCents((customerSubtotalCents * pct) / 100);
  }

  if (discount.value < 0) {
    return 0;
  }

  return Math.min(roundHalfUpCents(discount.value), customerSubtotalCents);
}

function computeOptionActualPct(
  policy: PricingPolicy,
  customerSubtotalCents: number,
  discountCents: number,
  internalCostCents: number
): number | null {
  const netCustomerCents = customerSubtotalCents - discountCents;
  const profitCents = netCustomerCents - internalCostCents;

  if (policy.profitabilityType === "margin") {
    if (netCustomerCents <= 0) return null;
    return (profitCents / netCustomerCents) * 100;
  }

  if (internalCostCents <= 0) return null;
  return (profitCents / internalCostCents) * 100;
}

export function evaluateProfitabilityGuardrail(
  policy: PricingPolicy,
  actorRole: PricingActorRole,
  actualPct: number | null
): ProfitabilityGuardrailResult {
  const minimumPct = policy.minimumProfitabilityPct;
  const defaultPct = policy.defaultProfitabilityPct;
  const profitabilityType = policy.profitabilityType;

  if (actualPct == null || !Number.isFinite(actualPct)) {
    const outcome = actorRole === "rep" ? "block" : "warn";
    return {
      outcome,
      actorRole,
      profitabilityType,
      actualPct: null,
      minimumPct,
      defaultPct,
      message:
        outcome === "block"
          ? "Profitability cannot be calculated — rep blocked"
          : "Profitability cannot be calculated — manager warning",
    };
  }

  if (actualPct < minimumPct) {
    const outcome = actorRole === "rep" ? "block" : "warn";
    return {
      outcome,
      actorRole,
      profitabilityType,
      actualPct,
      minimumPct,
      defaultPct,
      message:
        outcome === "block"
          ? `Profitability ${actualPct.toFixed(1)}% is below minimum ${minimumPct}%`
          : `Profitability ${actualPct.toFixed(1)}% is below minimum ${minimumPct}% — manager override later`,
    };
  }

  return {
    outcome: "pass",
    actorRole,
    profitabilityType,
    actualPct,
    minimumPct,
    defaultPct,
    message: "Profitability meets minimum",
  };
}

function buildOptionPricing(
  input: ProposalPricingInput,
  pricedLines: Array<{ input: PricingLineInput; output: ProposalLinePricing }>
): ProposalOptionPricing {
  const { policy, actorRole, optionId } = input;

  let hasBlockingIssues = false;
  const upgradeLineIds: string[] = [];

  for (const { input: lineIn, output: lineOut } of pricedLines) {
    if (lineOut.unresolved || isBlockingStatus(lineOut.status)) {
      hasBlockingIssues = true;
    }
    if (lineIn.upgradeScope?.parentOptionId === optionId) {
      upgradeLineIds.push(lineIn.templateItemId);
    }
  }

  let internalCostCents = 0;
  for (const { input: lineIn, output: lineOut } of pricedLines) {
    if (lineOut.lineCostCents == null) continue;
    if (lineIn.suppressedByReplacement === true) continue;
    if (
      lineIn.upgradeScope != null &&
      !upgradeLineContributesToTotals({
        isUpgradeLine: true,
        selectionState: lineIn.upgradeScope.selectionState,
      })
    ) {
      continue;
    }
    internalCostCents += lineOut.lineCostCents;
  }

  const sections = buildSectionRollups(pricedLines, hasBlockingIssues);

  if (hasBlockingIssues) {
    return {
      optionId,
      sections,
      customerSubtotalCents: null,
      discountCents: null,
      salesTaxCents: null,
      customerTotalCents: null,
      internalCostCents: internalCostCents > 0 ? internalCostCents : null,
      internalProfitCents: null,
      effectiveMarginPct: null,
      upgradeLineIds,
      guardrail: evaluateProfitabilityGuardrail(policy, actorRole, null),
      hasBlockingIssues: true,
    };
  }

  let customerSubtotalCents = 0;
  for (const { input: lineIn, output: lineOut } of pricedLines) {
    if (contributesToCustomerSubtotal(lineIn, lineOut.linePriceCents)) {
      customerSubtotalCents += lineOut.linePriceCents as number;
    }
  }

  const discountCents = computeDiscountCents(customerSubtotalCents, policy);
  const netCustomerCents = customerSubtotalCents - discountCents;
  const salesTaxRate = isFiniteNumber(policy.tax.salesTaxRatePct)
    ? Math.max(0, policy.tax.salesTaxRatePct)
    : 0;
  const salesTaxCents = roundHalfUpCents((netCustomerCents * salesTaxRate) / 100);
  const customerTotalCents = netCustomerCents + salesTaxCents;

  const internalProfitCents = netCustomerCents - internalCostCents;
  const actualPct = computeOptionActualPct(
    policy,
    customerSubtotalCents,
    discountCents,
    internalCostCents
  );
  const guardrail = evaluateProfitabilityGuardrail(policy, actorRole, actualPct);

  const effectiveMarginPct =
    policy.profitabilityType === "margin"
      ? actualPct
      : computeOptionActualPct(
          { ...policy, profitabilityType: "margin" },
          customerSubtotalCents,
          discountCents,
          internalCostCents
        );

  return {
    optionId,
    sections,
    customerSubtotalCents,
    discountCents: discountCents > 0 ? discountCents : null,
    salesTaxCents: salesTaxCents > 0 ? salesTaxCents : null,
    customerTotalCents,
    internalCostCents: internalCostCents > 0 ? internalCostCents : null,
    internalProfitCents: Number.isFinite(internalProfitCents) ? internalProfitCents : null,
    effectiveMarginPct,
    upgradeLineIds,
    guardrail,
    hasBlockingIssues: false,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function resolveProposalPricing(input: ProposalPricingInput): ProposalPricingResult {
  const pricedLines = input.lines.map((line) => ({
    input: line,
    output: buildProposalLinePricing(line, input.policy),
  }));

  let measurementResolved = true;
  let allLinesPriced = true;

  for (const { input: lineIn, output: lineOut } of pricedLines) {
    if (lineIn.quantityUnresolved) {
      measurementResolved = false;
    }
    if (lineOut.unresolved || isBlockingStatus(lineOut.status)) {
      allLinesPriced = false;
    }
  }

  const optionPricing = buildOptionPricing(input, pricedLines);

  const totals: ProposalPricingTotals = {
    selectedOptionId: input.optionId,
    customerTotalCents: optionPricing.customerTotalCents,
    depositCents: null,
    financingAvailable: false,
  };

  return {
    options: [optionPricing],
    totals,
    policyEcho: input.policy,
    generatedFrom: {
      measurementResolved,
      allLinesPriced,
    },
  };
}

/** Line-level pricing without option rollup — for mapper/tests (3I-1C). */
export function priceProposalLine(
  line: PricingLineInput,
  policy: PricingPolicy
): ProposalLinePricing {
  return buildProposalLinePricing(line, policy);
}

/** Whether material purchase tax can apply — requires itemType from mapper. */
export function canApplyMaterialPurchaseTax(itemType: CatalogItemType | null | undefined): boolean {
  return itemType === "material";
}
