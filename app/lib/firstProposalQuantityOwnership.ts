/**
 * Canonical first-proposal quantity ownership for the starter roof-replacement
 * template. Classify who owns each required quantity — do not invent formulas.
 *
 * Product owners:
 *   A — measurement / report geometry
 *   B — job / scope-specific input
 *   C — system-derived from existing canonical truth
 *   D — template model / ambiguous (do not silently redesign)
 */

import type { CatalogItem } from "@/app/lib/catalogTypes";
import type { MeasurementProposalHandoff } from "@/app/lib/measurementProposalHandoff";
import { deriveQuantityMapFromRecord } from "@/app/lib/measurementProposalHandoff";
import type { MeasurementQuantityMap } from "@/app/lib/measurementTypes";
import {
  getItemsForSection,
  getSectionsForOption,
} from "@/app/lib/proposalBuilderPreview";
import { resolveProposalLineQuantity } from "@/app/lib/proposalQuantityResolver";
import type { ProposalTemplateGraph } from "@/app/lib/proposalTemplateStore";
import type { ProposalTemplateItem } from "@/app/lib/proposalTemplateTypes";

export type QuantityProductOwner = "A" | "B" | "C" | "D";

export type StarterPackageName = "Standard" | "Enhanced" | "Premium";

export type StarterQuantityOwnershipRow = {
  catalogSeedKey: string;
  catalogName: string;
  packages: readonly StarterPackageName[];
  quantitySource: string;
  measurementFields: readonly string[];
  owner: QuantityProductOwner;
  /** Existing canonical fallback / derivation — not new math. */
  derivedFrom: readonly string[];
  sendBlocking: boolean;
};

export const STARTER_QUANTITY_OWNERSHIP: readonly StarterQuantityOwnershipRow[] = [
  {
    catalogSeedKey: "roofing.architectural_shingles",
    catalogName: "Shingles",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "adjusted_roof_squares",
    measurementFields: ["roof_area_sqft", "waste_percent"],
    owner: "C",
    derivedFrom: ["roof_area_sqft", "waste_percent"],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.synthetic_underlayment",
    catalogName: "Underlayment",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "adjusted_roof_squares",
    measurementFields: ["roof_area_sqft", "waste_percent"],
    owner: "C",
    derivedFrom: ["roof_area_sqft", "waste_percent"],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.starter_strip",
    catalogName: "Starter",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "starter_lf",
    measurementFields: ["starter_lf", "eaves_lf", "rakes_lf"],
    owner: "C",
    derivedFrom: ["eaves_lf", "rakes_lf"],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.ridge_cap",
    catalogName: "Ridge cap",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "ridge_cap_lf",
    measurementFields: ["ridge_cap_lf", "ridges_lf", "hips_lf"],
    owner: "C",
    derivedFrom: ["ridges_lf", "hips_lf"],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.drip_edge",
    catalogName: "Drip edge",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "drip_edge_lf",
    measurementFields: ["drip_edge_lf", "eaves_lf", "rakes_lf"],
    owner: "C",
    derivedFrom: ["eaves_lf", "rakes_lf"],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.ice_water_valley",
    catalogName: "Ice & water (valleys)",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "valleys_lf",
    measurementFields: ["valleys_lf"],
    owner: "A",
    derivedFrom: [],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.pipe_boot",
    catalogName: "Pipe boot",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "pipe_boots_count",
    measurementFields: ["pipe_boots_count"],
    owner: "B",
    derivedFrom: [],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.roof_vent",
    catalogName: "Roof vent",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "vents_count",
    measurementFields: ["vents_count"],
    owner: "B",
    derivedFrom: [],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.step_flashing",
    catalogName: "Step flashing",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "step_flashing_lf",
    measurementFields: ["step_flashing_lf"],
    owner: "A",
    derivedFrom: [],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.install_labor",
    catalogName: "Install labor",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "adjusted_roof_squares",
    measurementFields: ["roof_area_sqft", "waste_percent"],
    owner: "C",
    derivedFrom: ["roof_area_sqft", "waste_percent"],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.tear_off_labor",
    catalogName: "Tear-off",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "tear_off_squares",
    measurementFields: ["tear_off_required", "roof_squares"],
    owner: "B",
    derivedFrom: ["tear_off_required", "roof_squares"],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.disposal",
    catalogName: "Disposal",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "debris_tons",
    measurementFields: ["debris_tons_estimate"],
    owner: "B",
    derivedFrom: [],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.permit_admin_fee",
    catalogName: "Permit",
    packages: ["Standard", "Enhanced", "Premium"],
    quantitySource: "fixed",
    measurementFields: [],
    owner: "C",
    derivedFrom: ["catalog.default_quantity"],
    sendBlocking: true,
  },
  {
    catalogSeedKey: "roofing.ice_water_eaves",
    catalogName: "Ice & water (eaves)",
    packages: ["Enhanced", "Premium"],
    quantitySource: "eaves_lf",
    measurementFields: ["eaves_lf"],
    owner: "A",
    derivedFrom: [],
    sendBlocking: true,
  },
] as const;

/** Report-geometry fields asked as trusted measurement-report numbers. */
export const REPORT_GEOMETRY_CAPTURE_FIELDS = [
  "roof_area_sqft",
  "waste_percent",
  "pitch_label",
  "stories",
  "eaves_lf",
  "rakes_lf",
  "ridges_lf",
  "hips_lf",
  "valleys_lf",
  "step_flashing_lf",
] as const;

/** Job/scope fields — not labeled as report measurements. */
export const JOB_SCOPE_CAPTURE_FIELDS = [
  "pipe_boots_count",
  "vents_count",
  "tear_off_required",
  "debris_tons_estimate",
] as const;

function isRequiredPackageLine(item: ProposalTemplateItem): boolean {
  return item.item_role !== "upgrade" && item.item_role !== "optional_addon";
}

export function listRequiredPackageLineItems(
  graph: ProposalTemplateGraph,
  optionId: string
): ProposalTemplateItem[] {
  const sections = getSectionsForOption(graph, optionId).filter(
    (section) => section.kind === "line_items"
  );
  const items: ProposalTemplateItem[] = [];
  for (const section of sections) {
    for (const item of getItemsForSection(graph, section.id)) {
      if (isRequiredPackageLine(item)) items.push(item);
    }
  }
  return items;
}

export function countUnresolvedRequiredLineQuantities(input: {
  items: readonly ProposalTemplateItem[];
  catalogItems: readonly CatalogItem[];
  measurementHandoff: MeasurementProposalHandoff | null;
  quantityMap: MeasurementQuantityMap | null;
}): number {
  const catalogById = new Map(input.catalogItems.map((item) => [item.id, item]));
  let unresolved = 0;
  for (const templateItem of input.items) {
    const catalogId = (templateItem.catalog_item_id ?? "").trim();
    const catalog = catalogId ? catalogById.get(catalogId) ?? null : null;
    const preview = resolveProposalLineQuantity({
      measurementHandoff: input.measurementHandoff,
      quantityMap: input.quantityMap,
      catalogItem: catalog,
      templateItem,
    });
    if (preview.unresolved) unresolved += 1;
  }
  return unresolved;
}

/**
 * Same resolver contract Builder/Send uses for required package lines.
 * Optional upgrades are excluded (unselected add-ons are not first-proposal blockers).
 */
export function countUnresolvedRequiredPackageQuantities(input: {
  graph: ProposalTemplateGraph;
  optionId: string;
  catalogItems: readonly CatalogItem[];
  measurementHandoff: MeasurementProposalHandoff | null;
  quantityMap?: MeasurementQuantityMap | null;
  record?: Parameters<typeof deriveQuantityMapFromRecord>[0] | null;
}): number {
  const items = listRequiredPackageLineItems(input.graph, input.optionId);
  const quantityMap =
    input.quantityMap ??
    (input.record ? deriveQuantityMapFromRecord(input.record) : null);
  return countUnresolvedRequiredLineQuantities({
    items,
    catalogItems: input.catalogItems,
    measurementHandoff: input.measurementHandoff,
    quantityMap,
  });
}
