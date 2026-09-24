"use client";

import { useCallback, useEffect, useState } from "react";

export type JobScopeChangeClientRow = {
  id: string;
  status: string;
  reason: string | null;
  timingNote: string | null;
  priceDeltaCents: number;
  basisContractTotalCents: number;
  proposedAt: string | null;
  authorizedAt: string | null;
  declinedAt: string | null;
  voidedAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
  lines?: JobScopeChangeLineClient[];
};

export type JobScopeChangeLineClient = {
  id?: string;
  changeKind: "add" | "remove";
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPriceCents: number | null;
  lineDeltaCents: number;
  sortOrder: number;
};

export type JobScopeChangesState = {
  rows: JobScopeChangeClientRow[];
  contractTotalCents: number | null;
  loadStatus: "idle" | "loading" | "ready" | "error";
  error: string | null;
  refresh: () => Promise<void>;
  createDraft: (input: {
    reason?: string | null;
    timingNote?: string | null;
    lines: JobScopeChangeLineClient[];
  }) => Promise<{
    ok: boolean;
    scopeChangeId?: string;
    rowVersion?: number;
    message?: string;
  }>;
  saveDraft: (input: {
    scopeChangeId: string;
    expectedRowVersion: number;
    reason?: string | null;
    timingNote?: string | null;
    lines: JobScopeChangeLineClient[];
  }) => Promise<{ ok: boolean; rowVersion?: number; message?: string }>;
  runAction: (input: {
    scopeChangeId: string;
    action: "propose" | "void" | "decline";
    expectedRowVersion: number;
  }) => Promise<{
    ok: boolean;
    message?: string;
    publicReviewUrl?: string | null;
    rowVersion?: number;
  }>;
};

function toApiLines(lines: JobScopeChangeLineClient[]) {
  return lines.map((line, index) => ({
    changeKind: line.changeKind,
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPriceCents: line.unitPriceCents,
    lineDeltaCents: line.lineDeltaCents,
    sortOrder: line.sortOrder ?? index,
  }));
}

export function useJobScopeChanges(
  jobId: string | null | undefined
): JobScopeChangesState {
  const [rows, setRows] = useState<JobScopeChangeClientRow[]>([]);
  const [contractTotalCents, setContractTotalCents] = useState<number | null>(
    null
  );
  const [loadStatus, setLoadStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const id = String(jobId ?? "").trim();
    if (!id) {
      setRows([]);
      setContractTotalCents(null);
      setLoadStatus("idle");
      return;
    }
    setLoadStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${id}/scope-changes`, {
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        scopeChanges?: JobScopeChangeClientRow[];
        contractTotalCents?: number | null;
        message?: string;
      };
      if (!res.ok || body.ok !== true) {
        setError(body.message ?? "Scope changes could not be loaded.");
        setLoadStatus("error");
        return;
      }
      setRows(Array.isArray(body.scopeChanges) ? body.scopeChanges : []);
      setContractTotalCents(
        typeof body.contractTotalCents === "number"
          ? body.contractTotalCents
          : null
      );
      setLoadStatus("ready");
    } catch {
      setError("Scope changes could not be loaded.");
      setLoadStatus("error");
    }
  }, [jobId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createDraft = useCallback(
    async (input: {
      reason?: string | null;
      timingNote?: string | null;
      lines: JobScopeChangeLineClient[];
    }) => {
      const id = String(jobId ?? "").trim();
      if (!id) return { ok: false, message: "Job required." };
      const res = await fetch(`/api/jobs/${id}/scope-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: input.reason ?? null,
          timingNote: input.timingNote ?? null,
          lines: toApiLines(input.lines),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        scopeChange?: { id?: string; rowVersion?: number };
      };
      if (!res.ok || body.ok !== true) {
        return {
          ok: false,
          message: body.message ?? "Could not create scope change.",
        };
      }
      await refresh();
      return {
        ok: true,
        scopeChangeId: body.scopeChange?.id,
        rowVersion: body.scopeChange?.rowVersion,
      };
    },
    [jobId, refresh]
  );

  const saveDraft = useCallback(
    async (input: {
      scopeChangeId: string;
      expectedRowVersion: number;
      reason?: string | null;
      timingNote?: string | null;
      lines: JobScopeChangeLineClient[];
    }) => {
      const id = String(jobId ?? "").trim();
      if (!id) return { ok: false, message: "Job required." };
      const res = await fetch(
        `/api/jobs/${id}/scope-changes/${input.scopeChangeId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedRowVersion: input.expectedRowVersion,
            reason: input.reason ?? null,
            timingNote: input.timingNote ?? null,
            lines: toApiLines(input.lines),
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        scopeChange?: { rowVersion?: number };
      };
      if (!res.ok || body.ok !== true) {
        return {
          ok: false,
          message: body.message ?? "Could not save draft.",
        };
      }
      await refresh();
      return { ok: true, rowVersion: body.scopeChange?.rowVersion };
    },
    [jobId, refresh]
  );

  const runAction = useCallback(
    async (input: {
      scopeChangeId: string;
      action: "propose" | "void" | "decline";
      expectedRowVersion: number;
    }) => {
      const id = String(jobId ?? "").trim();
      if (!id) return { ok: false, message: "Job required." };
      const res = await fetch(
        `/api/jobs/${id}/scope-changes/${input.scopeChangeId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: input.action,
            expectedRowVersion: input.expectedRowVersion,
          }),
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        publicReviewUrl?: string | null;
        scopeChange?: { rowVersion?: number };
      };
      if (!res.ok || body.ok !== true) {
        return {
          ok: false,
          message: body.message ?? "Action failed.",
        };
      }
      await refresh();
      return {
        ok: true,
        publicReviewUrl: body.publicReviewUrl ?? null,
        rowVersion: body.scopeChange?.rowVersion,
      };
    },
    [jobId, refresh]
  );

  return {
    rows,
    contractTotalCents,
    loadStatus,
    error,
    refresh,
    createDraft,
    saveDraft,
    runAction,
  };
}
