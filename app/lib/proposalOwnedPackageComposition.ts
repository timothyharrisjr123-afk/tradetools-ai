/**
 * Draft / frozen proposal adapter for the generic package composition domain.
 *
 * Maps proposal-owned options + lines → PackageComposition, then delegates
 * comparison to the V2E2 engine. Never reads live Template rows.
 * Preview uses draft lines. Public uses frozen sent lines.
 */

import {
  buildPackageStepUpChain,
  inheritCatalogQuantity,
  type CompositionEntry,
  type CompositionQuantityConfig,
  type PackageComposition,
  type PackageStepUpItem,
} from "@/app/lib/packageComposition";
import { buildCustomerFactLinesByPackageId } from "@/app/lib/packageCompositionCustomerFacts";
import type {
  ProposalDraftGraph,
  ProposalOptionRow,
  ProposalVersionGraph,
} from "@/app/lib/proposalRecordStore";
import type { ProposalSendFreezeOptionPersistPayload } from "@/app/lib/proposalSendFreezePersistence";

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function isUpgradeRole(role: string | null | undefined): boolean {
  const normalized = (role ?? "").trim().toLowerCase();
  return normalized === "upgrade" || normalized === "optional_addon";
}

function isOmittedLine(line: {
  pricing_status?: string | null;
  visible_to_customer?: boolean;
}): boolean {
  if (line.visible_to_customer === false) return true;
  return (line.pricing_status ?? "").trim().toLowerCase() === "omitted";
}

function adaptLineQuantity(line: {
  quantity?: number | null;
  quantity_display_label?: string | null;
}): CompositionQuantityConfig {
  const display = norm(line.quantity_display_label);
  const qty = line.quantity;
  if (display) {
    return {
      mode: "resolved",
      summary: display,
      fingerprint: JSON.stringify({
        quantity: qty ?? null,
        display,
      }),
    };
  }
  if (qty != null && Number.isFinite(qty)) {
    return {
      mode: "resolved",
      summary: String(qty),
      fingerprint: JSON.stringify({ quantity: qty }),
    };
  }
  return inheritCatalogQuantity();
}

type OwnedLine = {
  id: string;
  optionPackageId: string;
  source_template_item_id?: string | null;
  catalog_item_id?: string | null;
  catalog_seed_key?: string | null;
  composition_role?: string | null;
  composition_slot_key?: string | null;
  customer_name: string;
  role?: string | null;
  sort_order?: number | null;
  quantity?: number | null;
  quantity_display_label?: string | null;
  pricing_status?: string | null;
  visible_to_customer?: boolean;
};

function toEntry(line: OwnedLine, role: CompositionEntry["role"]): CompositionEntry {
  const customerLabel = norm(line.customer_name) || "Line item";
  return {
    entryId: line.id,
    packageId: line.optionPackageId,
    role,
    compositionRole: norm(line.composition_role) || null,
    compositionSlotKey: norm(line.composition_slot_key) || null,
    productId: norm(line.catalog_item_id) || null,
    provenanceKey: norm(line.catalog_seed_key) || null,
    customerLabel,
    productName: customerLabel === "Line item" ? null : customerLabel,
    quantity: adaptLineQuantity(line),
    unitPriceCents: null,
  };
}

function optionPackageId(option: {
  id?: string | null;
  source_template_option_id?: string | null;
}): string {
  return (
    norm(option.source_template_option_id) ||
    norm(option.id) ||
    "package"
  );
}

function sortOptions<T extends { sort_order?: number | null; id?: string | null }>(
  options: readonly T[]
): T[] {
  return [...options].sort((a, b) => {
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return norm(a.id).localeCompare(norm(b.id));
  });
}

export function adaptProposalOwnedOptionsToPackageCompositions(input: {
  options: readonly {
    id?: string | null;
    source_template_option_id?: string | null;
    name: string;
    customer_label?: string | null;
    sort_order?: number | null;
    is_default?: boolean;
  }[];
  linesByOptionPackageId: Map<string, OwnedLine[]>;
}): PackageComposition[] {
  return sortOptions(input.options).map((option) => {
    const packageId = optionPackageId(option);
    const lines = (input.linesByOptionPackageId.get(packageId) ?? [])
      .filter((line) => !isOmittedLine(line))
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return {
      packageId,
      customerLabel: norm(option.customer_label) || norm(option.name) || "Package",
      order: option.sort_order ?? 0,
      isStartingDefault: option.is_default === true,
      included: lines
        .filter((line) => !isUpgradeRole(line.role))
        .map((line) => toEntry(line, "included")),
      optionalUpgrades: lines
        .filter((line) => isUpgradeRole(line.role))
        .map((line) => toEntry(line, "optional_upgrade")),
    };
  });
}

export function adaptDraftGraphToPackageCompositions(
  graph: Pick<ProposalDraftGraph | ProposalVersionGraph, "options" | "lineItems">
): PackageComposition[] {
  const linesByOptionPackageId = new Map<string, OwnedLine[]>();
  const optionIdToPackageId = new Map<string, string>();
  for (const option of graph.options) {
    optionIdToPackageId.set(option.id, optionPackageId(option));
  }
  for (const line of graph.lineItems) {
    const packageId =
      optionIdToPackageId.get(line.proposal_option_id) ?? line.proposal_option_id;
    const owned: OwnedLine = {
      id: line.id,
      optionPackageId: packageId,
      source_template_item_id: line.source_template_item_id,
      catalog_item_id: line.catalog_item_id,
      catalog_seed_key: line.catalog_seed_key,
      composition_role: line.composition_role,
      composition_slot_key: line.composition_slot_key,
      customer_name: line.customer_name,
      role: line.role,
      sort_order: line.sort_order,
      quantity: line.quantity,
      quantity_display_label: line.quantity_display_label,
      pricing_status: line.pricing_status,
      visible_to_customer: line.visible_to_customer,
    };
    const bucket = linesByOptionPackageId.get(packageId) ?? [];
    bucket.push(owned);
    linesByOptionPackageId.set(packageId, bucket);
  }
  return adaptProposalOwnedOptionsToPackageCompositions({
    options: graph.options,
    linesByOptionPackageId,
  });
}

export function adaptFreezeOptionsToPackageCompositions(
  options: readonly ProposalSendFreezeOptionPersistPayload[]
): PackageComposition[] {
  const linesByOptionPackageId = new Map<string, OwnedLine[]>();
  for (const option of options) {
    const packageId = optionPackageId(option);
    linesByOptionPackageId.set(
      packageId,
      option.line_items.map((line, index) => ({
        id: `${packageId}:${line.source_template_item_id ?? index}`,
        optionPackageId: packageId,
        source_template_item_id: line.source_template_item_id,
        catalog_item_id: line.catalog_item_id,
        catalog_seed_key: line.catalog_seed_key,
        composition_role: line.composition_role,
        composition_slot_key: line.composition_slot_key,
        customer_name: line.customer_name,
        role: line.role,
        sort_order: line.sort_order,
        quantity: line.quantity,
        quantity_display_label: line.quantity_display_label,
        pricing_status: line.pricing_status,
        visible_to_customer: line.visible_to_customer,
      }))
    );
  }
  return adaptProposalOwnedOptionsToPackageCompositions({
    options,
    linesByOptionPackageId,
  });
}

export function buildProposalOwnedPackageStepUpChain(
  packages: readonly PackageComposition[]
): PackageStepUpItem[] {
  return buildPackageStepUpChain(packages);
}

export function buildProposalOwnedCustomerFactLinesFromDraft(
  graph: Pick<ProposalDraftGraph | ProposalVersionGraph, "options" | "lineItems">
): Map<string, string[]> {
  return buildCustomerFactLinesByPackageId(
    buildProposalOwnedPackageStepUpChain(adaptDraftGraphToPackageCompositions(graph))
  );
}

export function buildProposalOwnedCustomerFactLinesFromFreeze(
  options: readonly ProposalSendFreezeOptionPersistPayload[]
): Map<string, string[]> {
  return buildCustomerFactLinesByPackageId(
    buildProposalOwnedPackageStepUpChain(adaptFreezeOptionsToPackageCompositions(options))
  );
}

export function lookupProposalOwnedCustomerFactLines(
  factsByPackageId: Map<string, string[]>,
  option: Pick<ProposalOptionRow, "id" | "source_template_option_id">
): string[] {
  const sourceId = norm(option.source_template_option_id);
  if (sourceId && factsByPackageId.has(sourceId)) {
    return factsByPackageId.get(sourceId) ?? [];
  }
  const runtimeId = norm(option.id);
  return factsByPackageId.get(runtimeId) ?? [];
}
