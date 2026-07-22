/**
 * R17D Phase 1 — pure scope decision merge into pricing input before snapshot build.
 *
 * Phase 1 fully implements manual_quantity for template-targeted lines.
 * Phase 3A implements excluded (omit from pricing input).
 * Phase 4 implements visibility_override (customer-hidden but still priced via hiddenButInCalc).
 * Other decision types are typed but produce explicit unsupported/warning entries.
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { ProposalBuilderPricingPreview } from "@/app/lib/proposalBuilderPricingPreview";
import type { ProposalQuantityPreviewContext } from "@/app/lib/proposalBuilderPreview";
import { buildCatalogItemById } from "@/app/lib/proposalBuilderPreview";
import { priceProposalLine, resolveProposalPricing } from "@/app/lib/proposalPricingEngine";
import { mapProposalPricingInput } from "@/app/lib/proposalPricingInputMapper";
import type { LinePricingStatus, PricingActorRole, PricingLineInput, PricingPolicy } from "@/app/lib/proposalPricingTypes";
import {
  alignQuantityResolutionEchoToPersistedQuantity,
  resolveProposalLineQuantityViaAdapter,
} from "@/app/lib/proposalQuantityResolutionAdapter";
import {
  type DraftInstantiateInput,
  type LineItemSnapshotInput,
  type OptionPricingSnapshotInput,
  templateItemToLineInput,
} from "@/app/lib/proposalSnapshotBuilder";
import { mapEngineLineStatusToSnapshot } from "@/app/lib/proposalSnapshotStatusMapper";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import {
  parseManualQuantityPayload,
  parseVisibilityOverridePayload,
  type ProposalScopeDecision,
  type ProposalScopeDecisionType,
} from "@/app/lib/proposalScopeDecisionTypes";
import {
  resolveOptionUpgradeChoiceRows,
  upgradeLineEchoesFromPricingLine,
} from "@/app/lib/proposalUpgradeTruth";
import type { ProposalOptionUpgradeChoicePersistRow } from "@/app/lib/proposalUpgradeTruthTypes";

// ---------------------------------------------------------------------------
// Merge report
// ---------------------------------------------------------------------------

export type ScopeDecisionMergeEntry = {
  decisionId: string;
  decisionType: ProposalScopeDecisionType;
  sourceTemplateItemId: string | null;
  instanceLineKey: string | null;
  message: string;
};

export type ProposalScopeDecisionMergeReport = {
  applied: ScopeDecisionMergeEntry[];
  ignored: ScopeDecisionMergeEntry[];
  stale: ScopeDecisionMergeEntry[];
  unsupported: ScopeDecisionMergeEntry[];
  warnings: string[];
};

export function createEmptyScopeDecisionMergeReport(): ProposalScopeDecisionMergeReport {
  return {
    applied: [],
    ignored: [],
    stale: [],
    unsupported: [],
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isBlockingLineStatus(status: LinePricingStatus): boolean {
  return status === "unpriced" || status === "unsupported" || status === "unresolved_quantity";
}

function isMissingCatalogLine(line: PricingLineInput): boolean {
  return line.itemType == null;
}

function sortOptionsByOrder<T extends { sort_order?: number | null; id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

export function hasAnyActiveScopeDecisions(
  byTemplateOptionId: Record<string, ProposalScopeDecision[]>
): boolean {
  return Object.values(byTemplateOptionId).some((decisions) =>
    decisions.some((decision) => decision.active)
  );
}

export function groupScopeDecisionsByTemplateOptionId(
  decisions: ProposalScopeDecision[],
  proposalOptionById: Map<string, { source_template_option_id: string | null }>
): Record<string, ProposalScopeDecision[]> {
  const grouped: Record<string, ProposalScopeDecision[]> = {};
  for (const decision of decisions) {
    if (!decision.active) continue;
    const optionRow = proposalOptionById.get(decision.proposalOptionId);
    const templateOptionId = optionRow?.source_template_option_id;
    if (!templateOptionId) continue;
    grouped[templateOptionId] = grouped[templateOptionId] ?? [];
    grouped[templateOptionId]!.push(decision);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// Per-option merge (pricing lines)
// ---------------------------------------------------------------------------

export type MergeScopeDecisionsIntoPricingLinesParams = {
  graph: ProposalTemplateGraph;
  templateOptionId: string;
  lines: PricingLineInput[];
  decisions: ProposalScopeDecision[];
  report: ProposalScopeDecisionMergeReport;
};

function applyExcludedDecisionsToPricingLines(
  graph: ProposalTemplateGraph,
  templateOptionId: string,
  lines: PricingLineInput[],
  decisions: ProposalScopeDecision[],
  report: ProposalScopeDecisionMergeReport
): { lines: PricingLineInput[]; excludedTemplateItemIds: Set<string> } {
  const excludedTemplateItemIds = new Set<string>();

  for (const decision of decisions) {
    if (!decision.active) {
      continue;
    }
    if (decision.decisionType !== "excluded") {
      continue;
    }

    const templateItemId = decision.sourceTemplateItemId;
    if (!templateItemId) {
      report.stale.push({
        decisionId: decision.id,
        decisionType: decision.decisionType,
        sourceTemplateItemId: decision.sourceTemplateItemId,
        instanceLineKey: decision.instanceLineKey,
        message: "excluded requires source_template_item_id.",
      });
      continue;
    }

    const templateItem = graph.items.find((item) => item.id === templateItemId);
    if (!templateItem || templateItem.option_id !== templateOptionId) {
      report.stale.push({
        decisionId: decision.id,
        decisionType: decision.decisionType,
        sourceTemplateItemId: templateItemId,
        instanceLineKey: decision.instanceLineKey,
        message: "source_template_item_id is missing or not on this option.",
      });
      continue;
    }

    excludedTemplateItemIds.add(templateItemId);
    report.applied.push({
      decisionId: decision.id,
      decisionType: decision.decisionType,
      sourceTemplateItemId: templateItemId,
      instanceLineKey: decision.instanceLineKey,
      message: "Excluded line from proposal option pricing input.",
    });
  }

  if (excludedTemplateItemIds.size === 0) {
    return { lines: lines.map((line) => ({ ...line })), excludedTemplateItemIds };
  }

  return {
    lines: lines
      .filter((line) => !excludedTemplateItemIds.has(line.templateItemId))
      .map((line) => ({ ...line })),
    excludedTemplateItemIds,
  };
}

export function mergeScopeDecisionsIntoPricingLines(
  params: MergeScopeDecisionsIntoPricingLinesParams
): PricingLineInput[] {
  const { graph, templateOptionId, lines, decisions, report } = params;
  if (decisions.length === 0) {
    return lines;
  }

  for (const decision of decisions) {
    if (!decision.active) {
      report.ignored.push({
        decisionId: decision.id,
        decisionType: decision.decisionType,
        sourceTemplateItemId: decision.sourceTemplateItemId,
        instanceLineKey: decision.instanceLineKey,
        message: "Decision is inactive.",
      });
    }
  }

  const { lines: merged, excludedTemplateItemIds } = applyExcludedDecisionsToPricingLines(
    graph,
    templateOptionId,
    lines,
    decisions,
    report
  );

  for (const decision of decisions) {
    if (!decision.active) {
      continue;
    }

    if (decision.decisionType === "excluded") {
      continue;
    }

    if (decision.decisionType === "visibility_override") {
      const templateItemId = decision.sourceTemplateItemId;
      if (templateItemId && excludedTemplateItemIds.has(templateItemId)) {
        report.ignored.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "visibility_override ignored because line is excluded.",
        });
        continue;
      }

      if (!templateItemId) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: decision.sourceTemplateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "visibility_override requires source_template_item_id.",
        });
        continue;
      }

      const templateItem = graph.items.find((item) => item.id === templateItemId);
      if (!templateItem || templateItem.option_id !== templateOptionId) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "source_template_item_id is missing or not on this option.",
        });
        continue;
      }

      const parsed = parseVisibilityOverridePayload(decision.payload as Record<string, unknown>);
      if (!parsed || parsed.visible_to_customer !== false) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "visibility_override payload must set visible_to_customer: false.",
        });
        continue;
      }

      const target = merged.find((line) => line.templateItemId === templateItemId);
      if (!target) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "Template line is not present in pricing input.",
        });
        continue;
      }

      target.hiddenButInCalc = true;
      report.applied.push({
        decisionId: decision.id,
        decisionType: decision.decisionType,
        sourceTemplateItemId: templateItemId,
        instanceLineKey: decision.instanceLineKey,
        message: "Line hidden from customer document but still priced in option total.",
      });
      continue;
    }

    if (decision.decisionType === "manual_quantity") {
      const templateItemId = decision.sourceTemplateItemId;
      if (templateItemId && excludedTemplateItemIds.has(templateItemId)) {
        report.ignored.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "manual_quantity ignored because line is excluded.",
        });
        continue;
      }

      if (!templateItemId) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: decision.sourceTemplateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "manual_quantity requires source_template_item_id.",
        });
        continue;
      }

      const templateItem = graph.items.find((item) => item.id === templateItemId);
      if (!templateItem || templateItem.option_id !== templateOptionId) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "source_template_item_id is missing or not on this option.",
        });
        continue;
      }

      const parsed = parseManualQuantityPayload(decision.payload as Record<string, unknown>);
      if (!parsed) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "manual_quantity payload is invalid.",
        });
        continue;
      }

      const target = merged.find((line) => line.templateItemId === templateItemId);
      if (!target) {
        report.stale.push({
          decisionId: decision.id,
          decisionType: decision.decisionType,
          sourceTemplateItemId: templateItemId,
          instanceLineKey: decision.instanceLineKey,
          message: "Template line is not present in pricing input.",
        });
        continue;
      }

      target.quantity = parsed.quantity;
      target.quantityUnresolved = false;
      report.applied.push({
        decisionId: decision.id,
        decisionType: decision.decisionType,
        sourceTemplateItemId: templateItemId,
        instanceLineKey: decision.instanceLineKey,
        message: `Applied manual quantity ${parsed.quantity}.`,
      });
      continue;
    }

    report.unsupported.push({
      decisionId: decision.id,
      decisionType: decision.decisionType,
      sourceTemplateItemId: decision.sourceTemplateItemId,
      instanceLineKey: decision.instanceLineKey,
      message: `${decision.decisionType} is not implemented in R17D scope decision merge.`,
    });
    report.warnings.push(
      `Scope decision ${decision.id} (${decision.decisionType}) is not implemented in scope decision merge.`
    );
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Draft instantiate input with scope decisions
// ---------------------------------------------------------------------------

export type BuildDraftInstantiateInputWithScopeDecisionsParams = {
  companyId: string;
  graph: ProposalTemplateGraph;
  catalogItems: CatalogItem[];
  quantityContext: ProposalQuantityPreviewContext | null;
  preview: ProposalBuilderPricingPreview;
  policy: PricingPolicy;
  pricingPolicyId: string;
  context: { job_id: string; template_id: string };
  selectedTemplateOptionId?: string | null;
  computedAt?: string;
  scopeDecisionsByTemplateOptionId: Record<string, ProposalScopeDecision[]>;
  /** Explicit persisted upgrade selections keyed by template option id (refresh path). */
  upgradeChoicesByTemplateOptionId?: Record<
    string,
    ProposalOptionUpgradeChoicePersistRow[]
  > | null;
};

export function buildDraftInstantiateInputWithScopeDecisions(
  params: BuildDraftInstantiateInputWithScopeDecisionsParams
): { input: DraftInstantiateInput; mergeReport: ProposalScopeDecisionMergeReport } {
  const mergeReport = createEmptyScopeDecisionMergeReport();

  if (!hasAnyActiveScopeDecisions(params.scopeDecisionsByTemplateOptionId)) {
    throw new Error(
      "buildDraftInstantiateInputWithScopeDecisions requires at least one active scope decision; use buildDraftInstantiateInputFromPreview for the zero-decision path."
    );
  }

  const catalogById = buildCatalogItemById(params.catalogItems);
  const actorRole = params.preview.actorRole;
  const optionPricing: OptionPricingSnapshotInput[] = [];
  const lineItemsByTemplateOptionId: Record<string, LineItemSnapshotInput[]> = {};
  const upgradeChoicesByTemplateOptionId: Record<
    string,
    ProposalOptionUpgradeChoicePersistRow[]
  > = {};
  const internalSummaryByTemplateOptionId: Record<
    string,
    {
      internal_cost_cents: number | null;
      internal_profit_cents: number | null;
      effective_margin_pct: number | null;
    }
  > = {};

  for (const templateOption of sortOptionsByOrder(params.graph.options)) {
    const optionId = templateOption.id;
    const optionPreview = params.preview.byOptionId[optionId];
    if (!optionPreview) continue;

    const optionDecisions = params.scopeDecisionsByTemplateOptionId[optionId] ?? [];
    const optionHasActiveDecisions = optionDecisions.some((d) => d.active);

    const explicitUpgradeChoices = params.upgradeChoicesByTemplateOptionId?.[optionId] ?? null;
    const resolvedUpgrades = resolveOptionUpgradeChoiceRows({
      graph: params.graph,
      optionId,
      explicit: explicitUpgradeChoices,
    });
    upgradeChoicesByTemplateOptionId[optionId] = resolvedUpgrades.rows;

    if (!optionHasActiveDecisions) {
      const mappedInput = mapProposalPricingInput({
        optionId,
        policy: params.policy,
        actorRole,
        graph: params.graph,
        catalogItems: catalogById,
        quantityContext: params.quantityContext,
        upgradeChoicesByTemplateItemId: resolvedUpgrades.choicesByTemplateItemId,
      });

      // Preview totals assume template-default selections; explicit persisted
      // choices require a reprice so totals honor the stored selections.
      const repricedOption = explicitUpgradeChoices
        ? resolveProposalPricing(mappedInput).options[0]
        : null;

      let blockingLineCount = 0;
      const lineInputs: LineItemSnapshotInput[] = [];
      for (const line of mappedInput.lines) {
        const priced = priceProposalLine(line, params.policy);
        if (isBlockingLineStatus(priced.status)) {
          blockingLineCount += 1;
        }
        const templateItem = params.graph.items.find((item) => item.id === line.templateItemId);
        if (!templateItem) continue;

        const catalog = line.catalogItemId ? catalogById.get(line.catalogItemId) : undefined;
        const qtyResolved = resolveProposalLineQuantityViaAdapter(
          {
            measurementHandoff: params.quantityContext?.measurementHandoff ?? null,
            quantityMap: params.quantityContext?.quantityMap ?? null,
            catalogItem: catalog ?? null,
            templateItem,
          },
          { wasteModel: params.policy.wasteModel }
        );
        const qtyPreview = qtyResolved.preview;
        const quantityResolutionEcho = alignQuantityResolutionEchoToPersistedQuantity(
          qtyResolved.quantityResolutionEcho,
          line.quantity
        );

        const previewLine = optionPreview.customer.lineByTemplateItemId[line.templateItemId];
        const showPrice = previewLine?.displayStatus === "priced";
        const upgradeEchoes = upgradeLineEchoesFromPricingLine(line);

        lineInputs.push(
          templateItemToLineInput(templateItem, {
            engineStatus: priced.status,
            customerVisibility: line.customerVisibility,
            catalogItemMissing: isMissingCatalogLine(line),
            quantity: line.quantity,
            quantityDisplayLabel: qtyPreview.quantityDisplayLabel,
            quantitySourceLabel: qtyPreview.sourceLabel ?? null,
            unit: line.unit,
            customerUnitPriceCents: showPrice ? priced.unitPriceCents : null,
            customerLineTotalCents: showPrice ? priced.linePriceCents : null,
            hiddenButInCalc: line.hiddenButInCalc === true,
            quantityResolutionEcho,
            upgradeSelectionState: upgradeEchoes.upgradeSelectionState,
            upgradeEffect: upgradeEchoes.upgradeEffect,
            replacesSourceTemplateItemId: upgradeEchoes.replacesSourceTemplateItemId,
          })
        );
      }
      lineItemsByTemplateOptionId[optionId] = lineInputs;
      internalSummaryByTemplateOptionId[optionId] = repricedOption
        ? {
            internal_cost_cents: repricedOption.internalCostCents,
            internal_profit_cents: repricedOption.internalProfitCents,
            effective_margin_pct: repricedOption.effectiveMarginPct,
          }
        : {
            internal_cost_cents: optionPreview.internal.internalCostCents,
            internal_profit_cents: optionPreview.internal.internalProfitCents,
            effective_margin_pct: optionPreview.internal.effectiveMarginPct,
          };

      optionPricing.push({
        source_template_option_id: optionId,
        name: templateOption.name,
        customer_label: templateOption.customer_label ?? null,
        description: templateOption.description ?? null,
        sort_order: templateOption.sort_order ?? 0,
        is_default: templateOption.is_default ?? false,
        visible_to_customer: templateOption.visible_to_customer ?? true,
        customer_subtotal_cents: repricedOption
          ? repricedOption.customerSubtotalCents
          : optionPreview.customer.customerSubtotalCents,
        discount_cents: repricedOption
          ? repricedOption.discountCents
          : optionPreview.customer.discountCents,
        sales_tax_cents: repricedOption
          ? repricedOption.salesTaxCents
          : optionPreview.customer.salesTaxCents,
        customer_total_cents: repricedOption
          ? repricedOption.customerTotalCents
          : optionPreview.customer.customerTotalCents,
        pricing_complete: repricedOption
          ? !repricedOption.hasBlockingIssues
          : optionPreview.customer.pricingComplete,
        blocking_line_count: repricedOption
          ? blockingLineCount
          : optionPreview.status.blockingLineCount,
        guardrail_outcome: repricedOption
          ? repricedOption.guardrail.outcome
          : optionPreview.status.guardrailOutcome,
        is_selected: params.preview.selectedOptionId === optionId,
      });
      continue;
    }

    const mappedInput = mapProposalPricingInput({
      optionId,
      policy: params.policy,
      actorRole,
      graph: params.graph,
      catalogItems: catalogById,
      quantityContext: params.quantityContext,
      upgradeChoicesByTemplateItemId: resolvedUpgrades.choicesByTemplateItemId,
    });

    const mergedLines = mergeScopeDecisionsIntoPricingLines({
      graph: params.graph,
      templateOptionId: optionId,
      lines: mappedInput.lines,
      decisions: optionDecisions,
      report: mergeReport,
    });

    const mergedPricingInput = { ...mappedInput, lines: mergedLines };
    const pricingResult = resolveProposalPricing(mergedPricingInput);
    const repricedOption = pricingResult.options[0];

    let blockingLineCount = 0;
    const lineInputs: LineItemSnapshotInput[] = [];
    for (const line of mergedLines) {
      const priced = priceProposalLine(line, params.policy);
      if (isBlockingLineStatus(priced.status)) {
        blockingLineCount += 1;
      }

      const templateItem = params.graph.items.find((item) => item.id === line.templateItemId);
      if (!templateItem) continue;

      const catalog = line.catalogItemId ? catalogById.get(line.catalogItemId) : undefined;
      const qtyResolved = resolveProposalLineQuantityViaAdapter(
        {
          measurementHandoff: params.quantityContext?.measurementHandoff ?? null,
          quantityMap: params.quantityContext?.quantityMap ?? null,
          catalogItem: catalog ?? null,
          templateItem,
        },
        { wasteModel: params.policy.wasteModel }
      );
      const qtyPreview = qtyResolved.preview;

      const manualDecision = optionDecisions.find(
        (d) =>
          d.active &&
          d.decisionType === "manual_quantity" &&
          d.sourceTemplateItemId === line.templateItemId
      );
      const manualPayload = manualDecision
        ? parseManualQuantityPayload(manualDecision.payload as Record<string, unknown>)
        : null;

      const quantityResolutionEcho = alignQuantityResolutionEchoToPersistedQuantity(
        qtyResolved.quantityResolutionEcho,
        line.quantity,
        { clearSourceMeasurementValue: Boolean(manualPayload) }
      );

      const displayStatus = mapEngineLineStatusToSnapshot({
        engineStatus: priced.status,
        customerVisibility: line.customerVisibility,
        catalogItemMissing: isMissingCatalogLine(line),
      });
      const showPrice = displayStatus === "priced";
      const upgradeEchoes = upgradeLineEchoesFromPricingLine(line);

      lineInputs.push(
        templateItemToLineInput(templateItem, {
          engineStatus: priced.status,
          customerVisibility: line.customerVisibility,
          catalogItemMissing: isMissingCatalogLine(line),
          quantity: line.quantity,
          quantityDisplayLabel:
            manualPayload?.quantity_display_label ?? qtyPreview.quantityDisplayLabel,
          quantitySourceLabel: manualPayload ? "Manual" : qtyPreview.sourceLabel ?? null,
          unit: line.unit,
          customerUnitPriceCents: showPrice ? priced.unitPriceCents : null,
          customerLineTotalCents: showPrice ? priced.linePriceCents : null,
          hiddenButInCalc: line.hiddenButInCalc === true,
          quantityResolutionEcho,
          upgradeSelectionState: upgradeEchoes.upgradeSelectionState,
          upgradeEffect: upgradeEchoes.upgradeEffect,
          replacesSourceTemplateItemId: upgradeEchoes.replacesSourceTemplateItemId,
        })
      );
    }

    lineItemsByTemplateOptionId[optionId] = lineInputs;
    internalSummaryByTemplateOptionId[optionId] = {
      internal_cost_cents: repricedOption?.internalCostCents ?? null,
      internal_profit_cents: repricedOption?.internalProfitCents ?? null,
      effective_margin_pct: repricedOption?.effectiveMarginPct ?? null,
    };

    optionPricing.push({
      source_template_option_id: optionId,
      name: templateOption.name,
      customer_label: templateOption.customer_label ?? null,
      description: templateOption.description ?? null,
      sort_order: templateOption.sort_order ?? 0,
      is_default: templateOption.is_default ?? false,
      visible_to_customer: templateOption.visible_to_customer ?? true,
      customer_subtotal_cents: repricedOption?.customerSubtotalCents ?? null,
      discount_cents: repricedOption?.discountCents ?? null,
      sales_tax_cents: repricedOption?.salesTaxCents ?? null,
      customer_total_cents: repricedOption?.customerTotalCents ?? null,
      pricing_complete: repricedOption ? !repricedOption.hasBlockingIssues : false,
      blocking_line_count: blockingLineCount,
      guardrail_outcome: repricedOption?.guardrail.outcome ?? "block",
      is_selected: params.preview.selectedOptionId === optionId,
    });
  }

  return {
    input: {
      company_id: params.companyId,
      context: params.context,
      policy: {
        configured: true,
        source: "company",
        policy: params.policy,
        pricingPolicyId: params.pricingPolicyId,
      },
      templateOptions: params.graph.options,
      templateSections: params.graph.sections,
      template: params.graph.template,
      optionPricing,
      lineItemsByTemplateOptionId,
      internalSummaryByTemplateOptionId,
      upgradeChoicesByTemplateOptionId,
      selectedTemplateOptionId: params.selectedTemplateOptionId ?? params.preview.selectedOptionId,
      computedAt: params.computedAt,
    },
    mergeReport,
  };
}

// Re-export actor role type for tests
export type { PricingActorRole };
