/**
 * Pure customer-facing label formatting for public proposal presentation.
 *
 * Display-only transforms — raw keys remain in persisted/frozen data.
 */

const UNIT_LABELS: Record<string, string> = {
  SQ: "Squares",
  EA: "Each",
  LF: "Linear feet",
};

function humanizeSegment(segment: string): string {
  return segment
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

export function formatCustomerFacingLineLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Line item";
  }

  if (/^[a-z0-9_]+\.[a-z0-9_]+$/i.test(trimmed)) {
    const segments = trimmed.split(".");
    const leaf = segments[segments.length - 1] ?? trimmed;
    return humanizeSegment(leaf);
  }

  if (trimmed.includes("_") && !trimmed.includes(" ")) {
    return humanizeSegment(trimmed);
  }

  return trimmed;
}

export function formatCustomerFacingUnit(unit: string | null | undefined): string | null {
  if (!unit) {
    return null;
  }
  const trimmed = unit.trim();
  if (!trimmed) {
    return null;
  }
  return UNIT_LABELS[trimmed.toUpperCase()] ?? trimmed;
}

export function looksLikeInternalCatalogKey(value: string): boolean {
  const trimmed = value.trim();
  return /^[a-z0-9_]+\.[a-z0-9_]+$/i.test(trimmed) || (trimmed.includes("_") && !trimmed.includes(" "));
}
