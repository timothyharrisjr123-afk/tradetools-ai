/**
 * Conservative isolation for internal/smoke/fixture proposal & template artifacts.
 *
 * Hide-not-delete for normal contractor list/picker surfaces (Block 1).
 * Direct Builder/Preview URLs by id remain allowed — this helper only classifies
 * and filters contractor-facing lists. No DB mutations.
 *
 * Prefer durable metadata when it exists; today classification is conservative
 * known-fixture text matching only (no broad "test"/"sample"/"demo").
 */

export type ContractorFixtureClassification = {
  isInternalFixture: boolean;
  /** Stable reason token for tests/debugging; null when not a fixture. */
  reason: string | null;
};

/**
 * Known fixture markers — case-insensitive substring match on normalized text.
 * Longer / more specific markers first so `reason` stays precise.
 */
const KNOWN_FIXTURE_MARKERS: ReadonlyArray<{ marker: string; reason: string }> = [
  { marker: "minimal complete-source live smoke", reason: "minimal_complete_source_live_smoke" },
  { marker: "coverage basis live smoke", reason: "coverage_basis_live_smoke" },
  { marker: "controlled live smoke", reason: "controlled_live_smoke" },
  { marker: "complete-source smoke", reason: "complete_source_smoke" },
  { marker: "raw_plus_waste", reason: "raw_plus_waste" },
  { marker: "raw plus waste", reason: "raw_plus_waste" },
  { marker: "smoke 2026", reason: "smoke_2026" },
  { marker: "s3d13", reason: "s3d13" },
];

function normalizeFixtureText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Classify free text (proposal title, template name, option label, etc.). */
export function classifyContractorFixtureText(
  text: string | null | undefined
): ContractorFixtureClassification {
  const raw = (text ?? "").trim();
  if (!raw) return { isInternalFixture: false, reason: null };
  const normalized = normalizeFixtureText(raw);
  for (const { marker, reason } of KNOWN_FIXTURE_MARKERS) {
    if (normalized.includes(normalizeFixtureText(marker))) {
      return { isInternalFixture: true, reason };
    }
  }
  return { isInternalFixture: false, reason: null };
}

export function isInternalFixtureProposal(input: {
  title?: string | null;
}): boolean {
  return classifyContractorFixtureText(input.title).isInternalFixture;
}

export function isInternalFixtureTemplate(input: {
  name?: string | null;
}): boolean {
  return classifyContractorFixtureText(input.name).isInternalFixture;
}

export function filterContractorVisibleProposals<
  T extends { title?: string | null },
>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isInternalFixtureProposal(row));
}

export function filterContractorVisibleTemplates<
  T extends { name?: string | null },
>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isInternalFixtureTemplate(row));
}

/**
 * Prefer the job's active draft when it is contractor-visible; otherwise the
 * newest visible draft. Never falls back to an internal/smoke draft for the
 * normal contractor "current proposal" surface.
 */
export function pickContractorVisibleJobDraft<
  T extends { id: string; title?: string | null },
>(drafts: readonly T[], activeProposalId: string | null | undefined): T | null {
  const visible = filterContractorVisibleProposals(drafts);
  if (visible.length === 0) return null;
  const activeId = (activeProposalId ?? "").trim();
  if (activeId) {
    const match = visible.find((row) => row.id === activeId);
    if (match) return match;
  }
  return visible[0] ?? null;
}
