/**
 * Phase 13B-C Field brief (public.get_job_field_brief_v1): the operational projection
 * for members without commercial read access. Parsing keeps only the whitelisted
 * operational fields; anything else in the payload is dropped.
 */

import { isUuidLike } from "@/app/lib/uuid";

export const GET_JOB_FIELD_BRIEF_RPC_V1 = "get_job_field_brief_v1";

export type JobFieldBriefScopeChange = {
  status: "proposed" | "authorized";
  reason: string | null;
  lines: { description: string; changeKind: "add" | "remove" }[];
};

export type JobFieldBrief = {
  jobId: string;
  crewLabel: string | null;
  productionLeadUserId: string | null;
  approvedScopeLabel: string | null;
  hasAcceptedAgreement: boolean;
  scopeChanges: JobFieldBriefScopeChange[];
  people: { userId: string; displayName: string | null }[];
};

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Pure; exported for tests. Null when the payload is not a well-formed brief. */
export function parseJobFieldBrief(data: unknown): JobFieldBrief | null {
  const body = data as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body) || body.ok !== true) return null;
  const job = body.job as Record<string, unknown> | null;
  if (!job || typeof job !== "object" || typeof job.id !== "string" || !isUuidLike(job.id)) {
    return null;
  }
  if (!Array.isArray(body.scope_changes) || !Array.isArray(body.people)) return null;

  const scopeChanges: JobFieldBriefScopeChange[] = [];
  for (const raw of body.scope_changes as Record<string, unknown>[]) {
    if (raw?.status !== "proposed" && raw?.status !== "authorized") continue;
    const lines = Array.isArray(raw.lines) ? (raw.lines as Record<string, unknown>[]) : [];
    scopeChanges.push({
      status: raw.status,
      reason: textOrNull(raw.reason),
      lines: lines.flatMap((line) => {
        const description = textOrNull(line?.description);
        const kind = line?.change_kind;
        if (!description || (kind !== "add" && kind !== "remove")) return [];
        return [{ description, changeKind: kind }];
      }),
    });
  }

  const people: JobFieldBrief["people"] = [];
  for (const raw of body.people as Record<string, unknown>[]) {
    if (typeof raw?.user_id !== "string" || !isUuidLike(raw.user_id)) continue;
    people.push({ userId: raw.user_id, displayName: textOrNull(raw.display_name) });
  }

  const lead = job.production_lead_user_id;
  return {
    jobId: job.id,
    crewLabel: textOrNull(job.crew_label),
    productionLeadUserId: typeof lead === "string" && isUuidLike(lead) ? lead : null,
    approvedScopeLabel: textOrNull(body.approved_scope_label),
    hasAcceptedAgreement: body.has_accepted_agreement === true,
    scopeChanges,
    people,
  };
}
