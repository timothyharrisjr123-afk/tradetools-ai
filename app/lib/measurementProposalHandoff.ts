/**
 * Pure measurement → Proposal Builder handoff (read-only).
 * Quantities and readiness only — no React, Supabase, pricing, or DB writes.
 */

import type { MeasurementQuantityMap, MeasurementRecord } from "@/app/lib/measurementTypes";
import {
  deriveEstimateReadiness,
  deriveProductionReadiness,
  formatMeasurementSourceLabel,
  MEASUREMENT_MISSING_LABEL,
  type MeasurementWorkspaceState,
} from "@/app/lib/measurementReadiness";

export type ProposalQuantitySummary = {
  roof_squares: number | null;
  adjusted_roof_squares: number | null;
  roof_area_sqft: number | null;
  waste_percent: number | null;
  eaves_lf: number | null;
  rakes_lf: number | null;
  ridges_lf: number | null;
  hips_lf: number | null;
  valleys_lf: number | null;
  wall_flashing_lf: number | null;
  step_flashing_lf: number | null;
  transitions_lf: number | null;
  parapet_wall_lf: number | null;
  drip_edge_lf: number | null;
  starter_lf: number | null;
  ridge_cap_lf: number | null;
  pipe_boots_count: number | null;
  vents_count: number | null;
  skylights_count: number | null;
  chimneys_count: number | null;
  satellite_dishes_count: number | null;
};

export type MeasurementProposalHandoff = {
  proposalReady: boolean;
  blockers: string[];
  selectedLabel: string;
  quantities: ProposalQuantitySummary;
  estimateReady: boolean;
  productionReady: boolean;
};

export type MeasurementProposalHandoffInput = {
  record: MeasurementRecord;
  workspace: MeasurementWorkspaceState;
  hasUnsavedChanges: boolean;
  persistedRecord: MeasurementRecord | null;
};

const PROPOSAL_BLOCKER = {
  noSaved: "Save measurement first",
  unsavedChanges: "Save changes first",
  stale: "Stale measurement",
  rejected: "Rejected measurement",
} as const;

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function sumLf(...values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

export function deriveProposalQuantitySummary(record: MeasurementRecord): ProposalQuantitySummary {
  return {
    roof_squares: finiteOrNull(record.roof_squares),
    adjusted_roof_squares: finiteOrNull(record.adjusted_roof_squares),
    roof_area_sqft: finiteOrNull(record.roof_area_sqft),
    waste_percent: finiteOrNull(record.waste_percent),
    eaves_lf: finiteOrNull(record.eaves_lf),
    rakes_lf: finiteOrNull(record.rakes_lf),
    ridges_lf: finiteOrNull(record.ridges_lf),
    hips_lf: finiteOrNull(record.hips_lf),
    valleys_lf: finiteOrNull(record.valleys_lf),
    wall_flashing_lf: finiteOrNull(record.wall_flashing_lf),
    step_flashing_lf: finiteOrNull(record.step_flashing_lf),
    transitions_lf: finiteOrNull(record.transitions_lf),
    parapet_wall_lf: finiteOrNull(record.parapet_wall_lf),
    drip_edge_lf: finiteOrNull(record.drip_edge_lf),
    starter_lf: finiteOrNull(record.starter_lf),
    ridge_cap_lf: finiteOrNull(record.ridge_cap_lf),
    pipe_boots_count: finiteOrNull(record.pipe_boots_count),
    vents_count: finiteOrNull(record.vents_count),
    skylights_count: finiteOrNull(record.skylights_count),
    chimneys_count: finiteOrNull(record.chimneys_count),
    satellite_dishes_count: finiteOrNull(record.satellite_dishes_count),
  };
}

/** Catalog-shaped quantity keys for future template mapping — not persisted in 3E6. */
export function deriveQuantityMapFromRecord(record: MeasurementRecord): MeasurementQuantityMap {
  const q = deriveProposalQuantitySummary(record);
  const squares = q.adjusted_roof_squares ?? q.roof_squares ?? null;
  const starterLf = q.starter_lf ?? sumLf(q.eaves_lf, q.rakes_lf);
  const dripEdgeLf = q.drip_edge_lf ?? sumLf(q.eaves_lf, q.rakes_lf);
  const ridgeCapLf = q.ridge_cap_lf ?? sumLf(q.ridges_lf, q.hips_lf);

  const map: MeasurementQuantityMap = {};
  if (squares != null) {
    map.shingles_squares = squares;
    map.underlayment_squares = squares;
    map.labor_squares = q.roof_squares ?? squares;
  }
  if (starterLf != null) map.starter_lf = starterLf;
  if (dripEdgeLf != null) map.drip_edge_lf = dripEdgeLf;
  if (ridgeCapLf != null) map.ridge_cap_lf = ridgeCapLf;
  if (q.valleys_lf != null) map.valley_flashing_lf = q.valleys_lf;
  if (q.wall_flashing_lf != null) map.wall_flashing_lf = q.wall_flashing_lf;
  if (q.step_flashing_lf != null) map.step_flashing_lf = q.step_flashing_lf;
  if (q.pipe_boots_count != null) map.pipe_boots = q.pipe_boots_count;
  if (q.vents_count != null) map.vents = q.vents_count;
  if (q.chimneys_count != null) map.chimneys = q.chimneys_count;
  if (q.skylights_count != null) map.skylights = q.skylights_count;
  if (record.tear_off_required && q.roof_squares != null) {
    map.tear_off_squares = q.roof_squares;
  }
  if (record.existing_layers_count != null && Number.isFinite(record.existing_layers_count)) {
    map.tear_off_layers = record.existing_layers_count;
  }
  if (record.debris_tons_estimate != null && Number.isFinite(record.debris_tons_estimate)) {
    map.debris_tons = record.debris_tons_estimate;
  }
  return map;
}

function resolveSelectedLabel(
  workspace: MeasurementWorkspaceState,
  persistedRecord: MeasurementRecord | null
): string {
  if (persistedRecord) {
    if (workspace.isPersistedNonManual) {
      return persistedRecord.is_verified
        ? "Verified"
        : formatMeasurementSourceLabel(persistedRecord);
    }
    if (workspace.isPersistedManual && !workspace.hasUnsavedChanges) {
      return "Saved manual";
    }
    if (workspace.hasUnsavedChanges) {
      return "Saved manual (unsaved edits)";
    }
    return workspace.recordLabel;
  }
  if (workspace.hasLocalRoofSize) {
    return "Local draft (not saved)";
  }
  return "Not saved";
}

function deriveProposalBlockers(input: MeasurementProposalHandoffInput): string[] {
  const { record, hasUnsavedChanges, persistedRecord } = input;
  const blockers: string[] = [];

  if (!persistedRecord) {
    blockers.push(PROPOSAL_BLOCKER.noSaved);
    return blockers;
  }

  if (hasUnsavedChanges) {
    blockers.push(PROPOSAL_BLOCKER.unsavedChanges);
  }

  if (record.status === "stale") {
    blockers.push(PROPOSAL_BLOCKER.stale);
  }
  if (record.status === "rejected") {
    blockers.push(PROPOSAL_BLOCKER.rejected);
  }

  const estimate = deriveEstimateReadiness(record);
  for (const b of estimate.blockers) {
    if (!blockers.includes(b)) blockers.push(b);
  }

  return blockers;
}

export function buildMeasurementProposalHandoff(
  input: MeasurementProposalHandoffInput
): MeasurementProposalHandoff {
  const handoffRecord = input.persistedRecord && !input.hasUnsavedChanges
    ? input.persistedRecord
    : input.record;

  const estimate = deriveEstimateReadiness(handoffRecord);
  const production = deriveProductionReadiness(handoffRecord);
  const blockers = deriveProposalBlockers(input);
  const proposalReady =
    input.persistedRecord != null &&
    !input.hasUnsavedChanges &&
    estimate.ready &&
    input.persistedRecord.status !== "stale" &&
    input.persistedRecord.status !== "rejected";

  return {
    proposalReady,
    blockers,
    selectedLabel: resolveSelectedLabel(input.workspace, input.persistedRecord),
    quantities: deriveProposalQuantitySummary(handoffRecord),
    estimateReady: estimate.ready,
    productionReady: production.ready,
  };
}

export function formatProposalReadinessLabel(
  ready: boolean,
  blockers: string[],
  context?: { isPersistedNonManual?: boolean }
): string {
  if (ready && context?.isPersistedNonManual) return "Provider measurement ready";
  if (ready) return "Ready for template";
  if (blockers.includes(PROPOSAL_BLOCKER.unsavedChanges)) return "Save changes first";
  if (blockers.includes(PROPOSAL_BLOCKER.noSaved)) return "Save measurement first";
  if (blockers.includes(PROPOSAL_BLOCKER.stale)) return "Stale measurement";
  if (blockers.includes(PROPOSAL_BLOCKER.rejected)) return "Rejected measurement";
  if (blockers.includes(MEASUREMENT_MISSING_LABEL.roofSize)) return "Needs roof size";
  if (blockers.length > 0) return "Needs review";
  return "Not ready";
}

export function formatProposalSectionHeaderStatus(
  handoff: MeasurementProposalHandoff,
  context?: { isPersistedNonManual?: boolean }
): { label: string; ready: boolean } {
  if (handoff.proposalReady) {
    const label = formatProposalReadinessLabel(true, [], context);
    return { label, ready: true };
  }
  const label = formatProposalReadinessLabel(handoff.proposalReady, handoff.blockers, context);
  if (label === "Not ready") {
    return { label: "No proposal yet", ready: false };
  }
  return { label, ready: false };
}

export function formatProposalQuantitiesDisplay(quantities: ProposalQuantitySummary): string {
  const parts: string[] = [];
  if (quantities.roof_squares != null) {
    parts.push(`${quantities.roof_squares.toFixed(1)} SQ`);
  }
  if (
    quantities.adjusted_roof_squares != null &&
    quantities.adjusted_roof_squares !== quantities.roof_squares
  ) {
    parts.push(`${quantities.adjusted_roof_squares.toFixed(1)} adj SQ`);
  }
  if (quantities.roof_area_sqft != null) {
    parts.push(`${quantities.roof_area_sqft.toLocaleString()} sq ft`);
  }
  if (quantities.waste_percent != null) {
    parts.push(`${quantities.waste_percent}% waste`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function formatProposalMissingDisplay(blockers: string[]): string {
  return blockers.length > 0 ? blockers.join(", ") : "None";
}

export function resolveProposalHandoffNextAction(input: {
  handoff: MeasurementProposalHandoff;
  workspace: MeasurementWorkspaceState;
  persistedRecord: MeasurementRecord | null;
}): { title: string; subtitle: string; done: boolean } {
  const { handoff, workspace, persistedRecord } = input;

  if (!persistedRecord) {
    return {
      title: "Create proposal",
      subtitle: "Save measurement first",
      done: false,
    };
  }

  if (handoff.blockers.includes(PROPOSAL_BLOCKER.unsavedChanges)) {
    return {
      title: "Create proposal",
      subtitle: "Save measurement changes before building a proposal",
      done: false,
    };
  }

  if (!handoff.estimateReady) {
    if (handoff.blockers.includes(MEASUREMENT_MISSING_LABEL.roofSize)) {
      return {
        title: "Create proposal",
        subtitle: "Enter roof size in Measurements first",
        done: false,
      };
    }
    return {
      title: "Create proposal",
      subtitle: "Complete measurement details before proposal builder",
      done: false,
    };
  }

  if (handoff.proposalReady && workspace.isPersistedNonManual) {
    return {
      title: "Choose proposal template",
      subtitle: "Review provider measurement — catalog and builder coming soon",
      done: false,
    };
  }

  if (handoff.proposalReady) {
    return {
      title: "Choose proposal template",
      subtitle: "Catalog and Proposal Builder coming soon",
      done: false,
    };
  }

  if (handoff.blockers.includes(PROPOSAL_BLOCKER.stale) || handoff.blockers.includes(PROPOSAL_BLOCKER.rejected)) {
    return {
      title: "Create proposal",
      subtitle: handoff.blockers[0] ?? "Measurement not usable for proposals",
      done: false,
    };
  }

  return {
    title: "Create proposal",
    subtitle: "Save measurement and complete intake first",
    done: false,
  };
}
