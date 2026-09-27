"use client";

import { useEffect, useState } from "react";
import type { JobFieldBrief } from "@/app/lib/jobFieldBrief";

export type JobFieldBriefState =
  | { status: "idle" | "loading" | "error"; brief: null }
  | { status: "ready"; brief: JobFieldBrief };

/** Loads the operational Field brief; only enabled for non-commercial viewers. */
export function useJobFieldBrief(
  jobId: string | null | undefined,
  enabled: boolean
): JobFieldBriefState {
  const [state, setState] = useState<JobFieldBriefState>({ status: "idle", brief: null });
  const id = typeof jobId === "string" ? jobId.trim() : "";

  useEffect(() => {
    if (!enabled || !id) {
      setState({ status: "idle", brief: null });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", brief: null });
    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(id)}/field-brief`, {
          cache: "no-store",
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          brief?: JobFieldBrief;
        };
        if (cancelled) return;
        if (!res.ok || body.ok !== true || !body.brief) {
          setState({ status: "error", brief: null });
          return;
        }
        setState({ status: "ready", brief: body.brief });
      } catch {
        if (!cancelled) setState({ status: "error", brief: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, id]);

  return state;
}
