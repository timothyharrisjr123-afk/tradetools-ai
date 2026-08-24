import { isUuidLike } from "@/app/lib/jobStore";
import type { JobRecord } from "@/app/lib/jobTypes";

export function isCleanDbJobCardDeepLink(input: {
  entryMode: string;
  loadSavedId: string | null;
  isBoardOriginParam: boolean;
  jobCardBoardOrigin: boolean;
  jobParam: string | null;
}): boolean {
  return (
    input.entryMode === "job-card" &&
    !input.loadSavedId &&
    !input.isBoardOriginParam &&
    !input.jobCardBoardOrigin &&
    Boolean(input.jobParam) &&
    isUuidLike(input.jobParam ?? "")
  );
}

/** Server-authorized Job record that matches the current route + company context. */
export function matchingServerJobRecord(
  serverJobRecord: JobRecord | null | undefined,
  jobId: string | null | undefined,
  companyId: string | null | undefined
): JobRecord | null {
  const id = String(jobId ?? "").trim();
  const cid = String(companyId ?? "").trim();
  if (!serverJobRecord || !id || !cid || !isUuidLike(id)) return null;
  if (serverJobRecord.id !== id) return null;
  if (String(serverJobRecord.company_id || "").trim() !== cid) return null;
  return serverJobRecord;
}

/** Initial trusted seed for a clean authenticated Job Card deep-link (first render). */
export function resolveInitialServerJobSeed(input: {
  entryMode: string;
  loadSavedId: string | null;
  isBoardOriginParam: boolean;
  jobParam: string | null;
  companyId?: string;
  serverJobRecord?: JobRecord | null;
}): JobRecord | null {
  if (
    !isCleanDbJobCardDeepLink({
      entryMode: input.entryMode,
      loadSavedId: input.loadSavedId,
      isBoardOriginParam: input.isBoardOriginParam,
      jobCardBoardOrigin: false,
      jobParam: input.jobParam,
    })
  ) {
    return null;
  }
  return matchingServerJobRecord(
    input.serverJobRecord,
    input.jobParam,
    input.companyId ?? null
  );
}

export function shouldSkipClientCanonicalJobHydrate(input: {
  entryMode: string;
  loadSavedId: string | null;
  isBoardOriginParam: boolean;
  jobCardBoardOrigin: boolean;
  jobParam: string | null;
  companyId?: string;
  serverJobRecord?: JobRecord | null;
}): boolean {
  if (
    !isCleanDbJobCardDeepLink({
      entryMode: input.entryMode,
      loadSavedId: input.loadSavedId,
      isBoardOriginParam: input.isBoardOriginParam,
      jobCardBoardOrigin: input.jobCardBoardOrigin,
      jobParam: input.jobParam,
    })
  ) {
    return false;
  }
  return (
    matchingServerJobRecord(
      input.serverJobRecord,
      input.jobParam,
      input.companyId ?? null
    ) != null
  );
}
