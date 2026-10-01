"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JobCoordinatorReadState, JobCoordinatorSnapshot } from "@/app/lib/jobCoordinatorView";

/** Failed or malformed reads are an error, never Unassigned. */
async function fetchJobCoordinator(jobId: string): Promise<JobCoordinatorReadState> {
  try {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/production-lead`, { cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      coordinator?: { assignedTo?: unknown; displayName?: unknown; email?: unknown };
    };
    if (!res.ok || body.ok !== true || !body.coordinator) return { status: "error" };
    const c = body.coordinator;
    return {
      status: "ready",
      assignedTo: typeof c.assignedTo === "string" ? c.assignedTo : null,
      displayName: typeof c.displayName === "string" ? c.displayName : null,
      email: typeof c.email === "string" ? c.email : null,
    };
  } catch {
    return { status: "error" };
  }
}

/** The Job's Coordinator, read through GET /api/jobs/[jobId]/production-lead. */
export function useJobCoordinator(jobId: string | null | undefined) {
  const id = typeof jobId === "string" ? jobId.trim() : "";
  const [keyed, setKeyed] = useState<{ jobId: string; read: JobCoordinatorReadState } | null>(null);
  const loadSeq = useRef(0);

  const reload = useCallback(async () => {
    if (!id) return;
    const seq = ++loadSeq.current;
    const read = await fetchJobCoordinator(id);
    if (seq !== loadSeq.current) return;
    setKeyed({ jobId: id, read });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const seq = ++loadSeq.current;
    void fetchJobCoordinator(id).then((read) => {
      if (cancelled || seq !== loadSeq.current) return;
      setKeyed({ jobId: id, read });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const applyWrite = useCallback(
    (next: JobCoordinatorSnapshot) => {
      if (!id) return;
      ++loadSeq.current;
      setKeyed({ jobId: id, read: { status: "ready", ...next } });
    },
    [id]
  );

  const state: JobCoordinatorReadState =
    keyed && keyed.jobId === id ? keyed.read : { status: "loading" };

  return { state, reload, applyWrite };
}
