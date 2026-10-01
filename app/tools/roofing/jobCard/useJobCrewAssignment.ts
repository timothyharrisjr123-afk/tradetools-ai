"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JobCrewAssignments } from "@/app/lib/jobCrewAssignmentModel";
import {
  isRetryableCrewFailure,
  readJobCrewAssignments,
  type JobCrewReadStatus,
} from "@/app/lib/jobCrewAssignmentView";

export type JobCrewLeadRef = { personId: string } | { userId: string } | null;

export type JobCrewSetPrimaryInput = {
  crewId: string;
  lead: JobCrewLeadRef;
  expectedPrimaryAssignmentId: string | null;
};

export type JobCrewWriteResult =
  | { ok: true; changed: boolean; body: Record<string, unknown> }
  | { ok: false; code: string };

function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `crew-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Malformed or failed reads are null (shown as "couldn't be loaded"), never an empty history. */
async function fetchJobCrewAssignments(jobId: string): Promise<JobCrewAssignments | null> {
  try {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/crew-assignment`, {
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return res.ok && body?.ok === true ? readJobCrewAssignments(body.crewAssignments) : null;
  } catch {
    return null;
  }
}

export function crewIntentSignature(input: JobCrewSetPrimaryInput): string {
  const lead = input.lead
    ? "personId" in input.lead
      ? `p:${input.lead.personId}`
      : `u:${input.lead.userId}`
    : "none";
  return `${input.crewId}|${lead}|${input.expectedPrimaryAssignmentId ?? "none"}`;
}

/**
 * Job → Crew read + writes for one job. The same intent keeps the same request id
 * until it settles, so a retry after a lost response replays instead of writing twice.
 * The read refreshes whenever the job's disposition changes (close ends assignments).
 */
export function useJobCrewAssignment(jobId: string | null, jobStatus: string | null | undefined) {
  const [read, setRead] = useState<{
    jobId: string | null;
    status: JobCrewReadStatus;
    model: JobCrewAssignments | null;
  }>({ jobId: null, status: "loading", model: null });
  const pendingRef = useRef<{ signature: string; requestId: string } | null>(null);
  const loadSeq = useRef(0);

  const reload = useCallback(async (): Promise<JobCrewAssignments | null> => {
    if (!jobId) return null;
    const seq = ++loadSeq.current;
    const parsed = await fetchJobCrewAssignments(jobId);
    if (seq !== loadSeq.current) return null;
    setRead({ jobId, status: parsed ? "ready" : "error", model: parsed });
    return parsed;
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const seq = ++loadSeq.current;
    void fetchJobCrewAssignments(jobId).then((parsed) => {
      if (cancelled || seq !== loadSeq.current) return;
      setRead({ jobId, status: parsed ? "ready" : "error", model: parsed });
    });
    return () => {
      cancelled = true;
    };
  }, [jobId, jobStatus]);

  const current = read.jobId === jobId;
  const status: JobCrewReadStatus = current ? read.status : "loading";
  const model = current ? read.model : null;

  const post = useCallback(
    async (payload: Record<string, unknown>): Promise<JobCrewWriteResult> => {
      if (!jobId) return { ok: false, code: "not_found" };
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/crew-assignment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (res.ok && body?.ok === true) {
          return { ok: true, changed: body.changed === true, body };
        }
        const code = typeof body?.code === "string" ? body.code : res.status >= 500 ? "crew_assignment_unavailable" : "network";
        return { ok: false, code };
      } catch {
        return { ok: false, code: "network" };
      }
    },
    [jobId]
  );

  const setPrimary = useCallback(
    async (input: JobCrewSetPrimaryInput): Promise<JobCrewWriteResult> => {
      const signature = `${jobId}|${crewIntentSignature(input)}`;
      if (pendingRef.current?.signature !== signature) {
        pendingRef.current = { signature, requestId: newRequestId() };
      }
      const { requestId } = pendingRef.current;
      const result = await post({
        action: "set_primary",
        crewId: input.crewId,
        ...(input.lead && "personId" in input.lead ? { assignmentLeadPersonId: input.lead.personId } : {}),
        ...(input.lead && "userId" in input.lead ? { assignmentLeadUserId: input.lead.userId } : {}),
        expectedPrimaryAssignmentId: input.expectedPrimaryAssignmentId,
        requestId,
      });
      if (result.ok || !isRetryableCrewFailure(result.code)) {
        pendingRef.current = null;
      }
      if (result.ok || result.code === "stale_assignment" || result.code === "crew_not_eligible") {
        await reload();
      }
      return result;
    },
    [jobId, post, reload]
  );

  const end = useCallback(
    async (assignmentId: string): Promise<JobCrewWriteResult> => {
      const result = await post({ action: "end", assignmentId });
      if (result.ok || result.code === "not_found") await reload();
      return result;
    },
    [post, reload]
  );

  return { status, model, reload, setPrimary, end };
}

export type JobCrewAssignmentController = ReturnType<typeof useJobCrewAssignment>;
