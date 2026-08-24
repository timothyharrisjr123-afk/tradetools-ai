import { isUuidLike } from "@/app/lib/uuid";
import type { JobRecord } from "@/app/lib/jobTypes";

/** Authenticated DB Job Card route with a uuid job param (excludes loadSaved legacy). */
export function isTrustedDbJobCardRoute(input: {
  entryMode: string;
  loadSavedId: string | null;
  jobParam: string | null;
}): boolean {
  return (
    input.entryMode === "job-card" &&
    !input.loadSavedId &&
    Boolean(input.jobParam) &&
    isUuidLike(input.jobParam ?? "")
  );
}

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

/** Server-authorized Job seed for any trusted DB Job Card route. */
export function resolveTrustedJobCardSeed(input: {
  entryMode: string;
  loadSavedId: string | null;
  jobParam: string | null;
  companyId?: string;
  serverJobRecord?: JobRecord | null;
}): JobRecord | null {
  if (!isTrustedDbJobCardRoute(input)) return null;
  return matchingServerJobRecord(
    input.serverJobRecord,
    input.jobParam,
    input.companyId ?? null
  );
}

/** Initial trusted seed for authenticated Job Card display (all origins). */
export function resolveInitialServerJobSeed(input: {
  entryMode: string;
  loadSavedId: string | null;
  isBoardOriginParam: boolean;
  jobParam: string | null;
  companyId?: string;
  serverJobRecord?: JobRecord | null;
}): JobRecord | null {
  void input.isBoardOriginParam;
  return resolveTrustedJobCardSeed(input);
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
  void input.isBoardOriginParam;
  void input.jobCardBoardOrigin;
  return (
    resolveTrustedJobCardSeed({
      entryMode: input.entryMode,
      loadSavedId: input.loadSavedId,
      jobParam: input.jobParam,
      companyId: input.companyId,
      serverJobRecord: input.serverJobRecord,
    }) != null
  );
}
