/**
 * Measurement report experience V1 — contractor-facing presenters.
 * Quantities and workspace IA only. No pricing, proposal writes, or provider/PDF.
 */

import {
  formatMeasurementCapturedOn,
  formatMeasurementDisplayName,
  formatMeasurementQuantityLine,
  formatMeasurementReadinessLabel,
} from "@/app/lib/jobCardMeasurementPresentation";
import { deriveEstimateReadiness, formatMeasurementSourceLabel } from "@/app/lib/measurementReadiness";
import type { MeasurementRecord } from "@/app/lib/measurementTypes";
import { deriveProposalPricingStale } from "@/app/lib/proposalStaleness";

export const JOB_CARD_CURRENT_MEASUREMENT_LABEL = "Current measurement" as const;
export const JOB_CARD_ADD_MEASUREMENT_LABEL = "Add measurement" as const;
export const JOB_CARD_EDIT_MEASUREMENT_LABEL = "Edit" as const;
export const JOB_CARD_DETAILS_LABEL = "Details" as const;
export const JOB_CARD_EARLIER_MEASUREMENTS_LABEL = "Earlier measurements" as const;
export const JOB_CARD_MAKE_CURRENT_LABEL = "Make current" as const;
export const JOB_CARD_MEASUREMENTS_EMPTY = "No measurement yet" as const;
export const JOB_CARD_MAKE_CURRENT_CONFIRM_TITLE = "Set as current measurement?" as const;
export const JOB_CARD_MAKE_CURRENT_CONFIRM_BODY =
  "The draft proposal will need a pricing refresh." as const;
export const JOB_CARD_MAKE_CURRENT_CONFIRM_SET = "Set as current" as const;
export const JOB_CARD_DRAFT_USES_EARLIER =
  "Proposal draft uses an earlier measurement" as const;
export const JOB_CARD_SENT_USES_EARLIER =
  "Sent proposal is based on an earlier measurement" as const;
export const JOB_CARD_REVIEW_PROPOSAL_LABEL = "Review proposal" as const;

function finiteNumber(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function hasMeaningfulQuantity(value: number | null | undefined): boolean {
  const n = finiteNumber(value);
  return n != null && n !== 0;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean((value ?? "").trim());
}

function formatSquaresLabel(squares: number): string {
  return `${squares.toFixed(1)} SQ`;
}

export function deriveDisplaySquares(
  record: Pick<MeasurementRecord, "roof_squares" | "roof_area_sqft">
): number | null {
  const stored = finiteNumber(record.roof_squares);
  if (stored != null && stored > 0) return stored;
  const area = finiteNumber(record.roof_area_sqft);
  if (area != null && area > 0) return area / 100;
  return null;
}

export function formatMeasurementPitchLabel(
  record: Pick<MeasurementRecord, "pitch_label" | "predominant_pitch">
): string | null {
  const label = (record.pitch_label ?? "").trim();
  if (label) return label;
  const predominant = (record.predominant_pitch ?? "").trim();
  return predominant || null;
}

export function formatMeasurementStoriesLabel(
  record: Pick<MeasurementRecord, "stories">
): string | null {
  const stories = (record.stories ?? "").trim();
  if (!stories) return null;
  if (/stor(y|ies)/i.test(stories)) return stories;
  if (stories === "1") return "1 story";
  return `${stories} stories`;
}

function formatLinearFeet(value: number): string {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded} ft`;
}

function formatCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export type MeasurementDetailItem = {
  label: string;
  value: string;
};

export type MeasurementDetailGroup = {
  id: "geometry" | "lengths" | "flashing" | "penetrations" | "tearoff";
  title: string;
  items: MeasurementDetailItem[];
};

function pushIfMeaningful(
  items: MeasurementDetailItem[],
  label: string,
  value: number | null | undefined,
  format: (n: number) => string
): void {
  if (!hasMeaningfulQuantity(value)) return;
  items.push({ label, value: format(value as number) });
}

function pushIfText(
  items: MeasurementDetailItem[],
  label: string,
  value: string | null | undefined
): void {
  const text = (value ?? "").trim();
  if (!text) return;
  items.push({ label, value: text });
}

export function buildMeasurementDetailGroups(
  record: MeasurementRecord
): MeasurementDetailGroup[] {
  const geometry: MeasurementDetailItem[] = [];
  if (hasMeaningfulQuantity(record.roof_facets_count)) {
    geometry.push({
      label: "Facets",
      value: formatCount(record.roof_facets_count as number),
    });
  }
  pushIfText(geometry, "Roof type", record.roof_type);
  pushIfText(geometry, "Complexity", record.roof_complexity);

  const lengths: MeasurementDetailItem[] = [];
  pushIfMeaningful(lengths, "Eaves", record.eaves_lf, formatLinearFeet);
  pushIfMeaningful(lengths, "Rakes", record.rakes_lf, formatLinearFeet);
  pushIfMeaningful(lengths, "Ridges", record.ridges_lf, formatLinearFeet);
  pushIfMeaningful(lengths, "Hips", record.hips_lf, formatLinearFeet);
  pushIfMeaningful(lengths, "Valleys", record.valleys_lf, formatLinearFeet);

  const flashing: MeasurementDetailItem[] = [];
  pushIfMeaningful(flashing, "Wall flashing", record.wall_flashing_lf, formatLinearFeet);
  pushIfMeaningful(flashing, "Step flashing", record.step_flashing_lf, formatLinearFeet);
  pushIfMeaningful(flashing, "Transitions", record.transitions_lf, formatLinearFeet);
  pushIfMeaningful(flashing, "Parapet", record.parapet_wall_lf, formatLinearFeet);
  pushIfMeaningful(flashing, "Drip edge", record.drip_edge_lf, formatLinearFeet);
  pushIfMeaningful(flashing, "Starter", record.starter_lf, formatLinearFeet);
  pushIfMeaningful(flashing, "Ridge cap", record.ridge_cap_lf, formatLinearFeet);

  const penetrations: MeasurementDetailItem[] = [];
  pushIfMeaningful(penetrations, "Pipe boots", record.pipe_boots_count, formatCount);
  pushIfMeaningful(penetrations, "Vents", record.vents_count, formatCount);
  pushIfMeaningful(penetrations, "Skylights", record.skylights_count, formatCount);
  pushIfMeaningful(penetrations, "Chimneys", record.chimneys_count, formatCount);
  pushIfMeaningful(
    penetrations,
    "Satellite dishes",
    record.satellite_dishes_count,
    formatCount
  );
  if (record.other_penetrations && typeof record.other_penetrations === "object") {
    const entries = Object.entries(record.other_penetrations).filter(([, v]) => {
      if (typeof v === "number") return hasMeaningfulQuantity(v);
      return hasText(String(v ?? ""));
    });
    for (const [key, raw] of entries) {
      const value =
        typeof raw === "number" ? formatCount(raw) : String(raw).trim();
      if (value) penetrations.push({ label: key.replace(/_/g, " "), value });
    }
  }

  const tearoff: MeasurementDetailItem[] = [];
  if (hasMeaningfulQuantity(record.existing_layers_count)) {
    tearoff.push({
      label: "Existing layers",
      value: formatCount(record.existing_layers_count as number),
    });
  }
  if (record.tear_off_required === true) {
    tearoff.push({ label: "Tear-off", value: "Yes" });
  }
  if (hasMeaningfulQuantity(record.debris_tons_estimate)) {
    tearoff.push({
      label: "Debris",
      value: `${formatCount(record.debris_tons_estimate as number)} tons`,
    });
  }
  pushIfText(tearoff, "Disposal", record.disposal_notes);

  const groups: MeasurementDetailGroup[] = [];
  if (geometry.length) groups.push({ id: "geometry", title: "Roof geometry", items: geometry });
  if (lengths.length) groups.push({ id: "lengths", title: "Lengths", items: lengths });
  if (flashing.length) groups.push({ id: "flashing", title: "Flashing / edge", items: flashing });
  if (penetrations.length) {
    groups.push({ id: "penetrations", title: "Penetrations", items: penetrations });
  }
  if (tearoff.length) groups.push({ id: "tearoff", title: "Tear-off", items: tearoff });
  return groups;
}

export type MeasurementReportSummary = {
  id: string;
  name: string;
  statusLabel: string;
  areaLabel: string | null;
  squaresLabel: string | null;
  wasteLabel: string | null;
  pitchLabel: string | null;
  storiesLabel: string | null;
  sourceLabel: string;
  dateLabel: string | null;
  canEdit: boolean;
  isManual: boolean;
  detailGroups: MeasurementDetailGroup[];
};

export function buildMeasurementReportSummary(
  record: MeasurementRecord
): MeasurementReportSummary {
  const area = finiteNumber(record.roof_area_sqft);
  const squares = deriveDisplaySquares(record);
  const waste = finiteNumber(record.waste_percent);
  return {
    id: record.id,
    name: formatMeasurementDisplayName(record),
    statusLabel: formatMeasurementReadinessLabel(record),
    areaLabel:
      area != null && area > 0
        ? `${Math.round(area).toLocaleString()} sq ft`
        : null,
    squaresLabel: squares != null ? formatSquaresLabel(squares) : null,
    wasteLabel: waste != null ? `${waste}% waste` : null,
    pitchLabel: formatMeasurementPitchLabel(record),
    storiesLabel: formatMeasurementStoriesLabel(record),
    sourceLabel: formatMeasurementSourceLabel(record),
    dateLabel: formatMeasurementCapturedOn(record.created_at),
    canEdit: record.source_type === "manual",
    isManual: record.source_type === "manual",
    detailGroups: buildMeasurementDetailGroups(record),
  };
}

export type MeasurementHistoryRow = {
  id: string;
  name: string;
  quantityLine: string;
  sourceLabel: string;
  dateLabel: string | null;
  statusLabel: string;
  canMakeCurrent: boolean;
  detailGroups: MeasurementDetailGroup[];
};

export function canMakeMeasurementCurrent(record: MeasurementRecord, currentId: string | null): boolean {
  if (record.id === (currentId ?? "").trim()) return false;
  if (record.status === "rejected" || record.status === "stale") return false;
  return true;
}

/** Earlier measurements only — never includes the current/selected row. */
export function buildMeasurementHistoryRows(input: {
  records: readonly MeasurementRecord[];
  currentId: string | null;
}): MeasurementHistoryRow[] {
  const currentId = (input.currentId ?? "").trim();
  return [...input.records]
    .filter((record) => record.id !== currentId)
    .sort((a, b) => {
      const aTime = Date.parse(a.created_at) || 0;
      const bTime = Date.parse(b.created_at) || 0;
      return bTime - aTime;
    })
    .map((record) => ({
      id: record.id,
      name: formatMeasurementDisplayName(record),
      quantityLine: formatMeasurementQuantityLine(record),
      sourceLabel: formatMeasurementSourceLabel(record),
      dateLabel: formatMeasurementCapturedOn(record.created_at),
      statusLabel: formatMeasurementReadinessLabel(record),
      canMakeCurrent: canMakeMeasurementCurrent(record, currentId),
      detailGroups: buildMeasurementDetailGroups(record),
    }));
}

export function formatMakeCurrentConfirmIdentity(
  row: Pick<MeasurementHistoryRow, "quantityLine" | "dateLabel">
): string {
  return [row.quantityLine, row.dateLabel].filter(Boolean).join(" · ");
}

export type ManualMeasurementSaveMode = "create" | "update-incomplete";

export function resolveManualMeasurementSaveMode(input: {
  editingMeasurementId: string | null;
  current: MeasurementRecord | null;
}): ManualMeasurementSaveMode {
  const editingId = (input.editingMeasurementId ?? "").trim();
  if (!editingId || !input.current || input.current.id !== editingId) return "create";
  if (input.current.source_type !== "manual") return "create";
  if (deriveEstimateReadiness(input.current).ready) return "create";
  return "update-incomplete";
}

export function resolveManualMeasurementEditMode(
  current: MeasurementRecord | null
): "inplace" | "append" | "none" {
  if (!current || current.source_type !== "manual") return "none";
  return deriveEstimateReadiness(current).ready ? "append" : "inplace";
}

export type MeasurementProposalRef = {
  proposalId: string;
  measurementRecordId: string | null | undefined;
  updatedAt?: string | null;
};

export type MeasurementProposalBindingKind = "none" | "draft_earlier" | "sent_earlier";

export type MeasurementProposalBinding = {
  kind: MeasurementProposalBindingKind;
  message: string | null;
  reviewHref: string | null;
  proposalId: string | null;
};

function isStaleAgainstCurrent(input: {
  snapshotMeasurementId: string | null | undefined;
  currentMeasurementId: string | null;
  snapshotUpdatedAt?: string | null;
  measurementUpdatedAt?: string | null;
}): boolean {
  return deriveProposalPricingStale({
    snapshotMeasurementId: input.snapshotMeasurementId,
    currentMeasurementId: input.currentMeasurementId,
    snapshotUpdatedAt: input.snapshotUpdatedAt,
    measurementUpdatedAt: input.measurementUpdatedAt,
  }).stale;
}

export function resolveMeasurementProposalBinding(input: {
  currentMeasurementId: string | null;
  currentMeasurementUpdatedAt?: string | null;
  draft: MeasurementProposalRef | null;
  sent: MeasurementProposalRef | null;
  reviewHref?: string | null;
}): MeasurementProposalBinding {
  const currentId = (input.currentMeasurementId ?? "").trim() || null;
  if (
    input.draft &&
    isStaleAgainstCurrent({
      snapshotMeasurementId: input.draft.measurementRecordId,
      currentMeasurementId: currentId,
      snapshotUpdatedAt: input.draft.updatedAt,
      measurementUpdatedAt: input.currentMeasurementUpdatedAt,
    })
  ) {
    return {
      kind: "draft_earlier",
      message: JOB_CARD_DRAFT_USES_EARLIER,
      reviewHref: input.reviewHref ?? null,
      proposalId: input.draft.proposalId,
    };
  }
  if (
    input.sent &&
    isStaleAgainstCurrent({
      snapshotMeasurementId: input.sent.measurementRecordId,
      currentMeasurementId: currentId,
    })
  ) {
    return {
      kind: "sent_earlier",
      message: JOB_CARD_SENT_USES_EARLIER,
      reviewHref: null,
      proposalId: input.sent.proposalId,
    };
  }
  return {
    kind: "none",
    message: null,
    reviewHref: null,
    proposalId: null,
  };
}

export function wouldMakeDraftProposalStale(input: {
  draft: MeasurementProposalRef | null;
  candidate: Pick<MeasurementRecord, "id" | "updated_at"> | null;
}): boolean {
  if (!input.draft || !input.candidate) return false;
  return deriveProposalPricingStale({
    snapshotMeasurementId: input.draft.measurementRecordId,
    currentMeasurementId: input.candidate.id,
    snapshotUpdatedAt: input.draft.updatedAt,
    measurementUpdatedAt: input.candidate.updated_at,
  }).stale;
}

export function visibleReportCopyHasNoInternalLeakage(values: readonly string[]): boolean {
  const banned = [
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    /\bis_selected\b/i,
    /\bestimate_ready\b/i,
    /\bproduction_ready\b/i,
    /\bquantity_map\b/i,
    /\bsource_type\b/i,
    /\bmeasurement record\b/i,
    /\bneeds_review\b/i,
  ];
  return values.every((value) => !banned.some((re) => re.test(value)));
}

export function pickMeasurementProposalRefs(input: {
  summaries: readonly {
    id: string;
    measurement_record_id?: string | null;
    latest_sent_version_id?: string | null;
    updated_at?: string | null;
    status?: string | null;
  }[];
  draftProposalId?: string | null;
}): { draft: MeasurementProposalRef | null; sent: MeasurementProposalRef | null } {
  const draftId = (input.draftProposalId ?? "").trim();
  const draftRow = draftId
    ? input.summaries.find((row) => row.id === draftId) ?? null
    : input.summaries.find((row) => (row.status ?? "") === "draft") ?? null;
  const sentRow =
    input.summaries.find((row) => Boolean((row.latest_sent_version_id ?? "").trim())) ??
    null;
  return {
    draft: draftRow
      ? {
          proposalId: draftRow.id,
          measurementRecordId: draftRow.measurement_record_id ?? null,
          updatedAt: draftRow.updated_at ?? null,
        }
      : null,
    sent: sentRow
      ? {
          proposalId: sentRow.id,
          measurementRecordId: sentRow.measurement_record_id ?? null,
          updatedAt: sentRow.updated_at ?? null,
        }
      : null,
  };
}
