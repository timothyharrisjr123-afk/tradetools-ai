/**
 * V2F — Resolve the immediately previous immutable sent version.
 *
 * Sent lineage is version_number, then frozen_at, then created_at.
 * parent_version_id points at the source draft, not the prior sent row.
 */

import { isUuidLike } from "@/app/lib/jobStore";

export type SentProposalVersionLineageFact = {
  id: string;
  versionNumber: number;
  frozenAt?: string | null;
  createdAt?: string | null;
};

function sortMs(value: string | null | undefined): number {
  const ms = Date.parse((value ?? "").trim());
  return Number.isFinite(ms) ? ms : 0;
}

export function sortSentProposalVersionLineageNewestFirst(
  versions: readonly SentProposalVersionLineageFact[]
): SentProposalVersionLineageFact[] {
  return [...versions]
    .filter((row) => isUuidLike((row.id ?? "").trim()))
    .sort((a, b) => {
      if (b.versionNumber !== a.versionNumber) {
        return b.versionNumber - a.versionNumber;
      }
      const frozenDelta = sortMs(b.frozenAt) - sortMs(a.frozenAt);
      if (frozenDelta !== 0) return frozenDelta;
      const createdDelta = sortMs(b.createdAt) - sortMs(a.createdAt);
      if (createdDelta !== 0) return createdDelta;
      return String(b.id).localeCompare(String(a.id));
    });
}

export function resolvePreviousSentVersionId(input: {
  currentSentVersionId?: string | null;
  sentVersions: readonly SentProposalVersionLineageFact[];
}): string | null {
  const currentId = (input.currentSentVersionId ?? "").trim();
  if (!isUuidLike(currentId)) return null;
  const sorted = sortSentProposalVersionLineageNewestFirst(input.sentVersions);
  const currentIndex = sorted.findIndex((row) => row.id === currentId);
  if (currentIndex < 0) return null;
  return sorted[currentIndex + 1]?.id ?? null;
}
