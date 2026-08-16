/**
 * R3D drawn signature mark — compact versioned stroke JSON.
 * Coordinates are normalized 0..1 within the pad.
 */

export const PROPOSAL_SIGNATURE_MARK_VERSION = 1 as const;

export const PROPOSAL_SIGNATURE_MARK_LIMITS = {
  maxSerializedBytes: 24576,
  maxStrokes: 24,
  minPointsPerStroke: 2,
  maxPointsPerStroke: 256,
  maxTotalPoints: 1536,
  minExtent: 0.05,
} as const;

export type ProposalSignatureMarkPoint = {
  x: number;
  y: number;
  t?: number;
};

export type ProposalSignatureMarkV1 = {
  version: typeof PROPOSAL_SIGNATURE_MARK_VERSION;
  strokes: ProposalSignatureMarkPoint[][];
};

export type ProposalSignatureMarkErrorCode =
  | "invalid_mark"
  | "invalid_mark_version"
  | "mark_too_large"
  | "mark_too_small";

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function proposalSignatureMarkError(
  mark: unknown
): ProposalSignatureMarkErrorCode | null {
  if (!isPlainObject(mark)) return "invalid_mark";
  const keys = Object.keys(mark).sort();
  if (keys.join(",") !== "strokes,version") return "invalid_mark";

  try {
    if (new TextEncoder().encode(JSON.stringify(mark)).length >
      PROPOSAL_SIGNATURE_MARK_LIMITS.maxSerializedBytes) {
      return "mark_too_large";
    }
  } catch {
    return "invalid_mark";
  }

  if (mark.version !== PROPOSAL_SIGNATURE_MARK_VERSION) {
    return "invalid_mark_version";
  }
  if (!Array.isArray(mark.strokes)) return "invalid_mark";
  const strokes = mark.strokes;
  if (
    strokes.length < 1 ||
    strokes.length > PROPOSAL_SIGNATURE_MARK_LIMITS.maxStrokes
  ) {
    return "invalid_mark";
  }

  let total = 0;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;

  for (const stroke of strokes) {
    if (!Array.isArray(stroke)) return "invalid_mark";
    if (
      stroke.length < PROPOSAL_SIGNATURE_MARK_LIMITS.minPointsPerStroke ||
      stroke.length > PROPOSAL_SIGNATURE_MARK_LIMITS.maxPointsPerStroke
    ) {
      return "invalid_mark";
    }
    total += stroke.length;
    if (total > PROPOSAL_SIGNATURE_MARK_LIMITS.maxTotalPoints) {
      return "mark_too_large";
    }
    for (const point of stroke) {
      if (!isPlainObject(point)) return "invalid_mark";
      const pointKeys = Object.keys(point).sort().join(",");
      if (pointKeys !== "x,y" && pointKeys !== "t,x,y") return "invalid_mark";
      if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
        return "invalid_mark";
      }
      if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
        return "invalid_mark";
      }
      if (point.t != null) {
        if (!isFiniteNumber(point.t) || point.t < 0) return "invalid_mark";
      }
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }

  if (maxX - minX + (maxY - minY) < PROPOSAL_SIGNATURE_MARK_LIMITS.minExtent) {
    return "mark_too_small";
  }
  return null;
}

export function assertProposalSignatureMark(
  mark: unknown
): asserts mark is ProposalSignatureMarkV1 {
  const code = proposalSignatureMarkError(mark);
  if (code) {
    const error = new Error(code);
    error.name = "ProposalSignatureMarkError";
    throw error;
  }
}
