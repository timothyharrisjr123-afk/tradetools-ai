"use client";

import {
  fetchJobAttentionDetail,
  fetchJobAttentionSummaries,
  JOB_ATTENTION_CHANGED_EVENT,
  markDisplayedJobAttentionRead,
} from "@/app/lib/jobAttentionReadClient";
import {
  selectActiveAttention,
  type JobAttentionSafeItem,
  type JobAttentionSummaryMap,
} from "@/app/lib/jobAttentionReadModel";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useJobAttentionSummaries(enabled = true) {
  const [summaries, setSummaries] = useState<JobAttentionSummaryMap>({});
  const [loading, setLoading] = useState(enabled);
  const [truncated, setTruncated] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) {
      setSummaries({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await fetchJobAttentionSummaries();
    if (result.ok) {
      setSummaries(result.summaries);
      setTruncated(result.truncated);
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [reload]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      void reload();
    };
    window.addEventListener(JOB_ATTENTION_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener(JOB_ATTENTION_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [enabled, reload]);

  return { summaries, loading, truncated, reload };
}

export function useJobAttentionDetail(input: {
  jobId: string | null | undefined;
  requestedAttentionId?: string | null;
  enabled?: boolean;
}) {
  const enabled = input.enabled !== false && Boolean(input.jobId?.trim());
  const [items, setItems] = useState<JobAttentionSafeItem[]>([]);
  const [selectedAttentionId, setSelectedAttentionId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const jobId = input.jobId?.trim() ?? "";
    if (!enabled || !jobId) {
      setItems([]);
      setSelectedAttentionId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await fetchJobAttentionDetail(
      jobId,
      input.requestedAttentionId
    );
    if (result.ok) {
      setItems(result.items);
      setSelectedAttentionId(result.selectedAttentionId);
      setError(null);
    } else {
      setItems([]);
      setSelectedAttentionId(null);
      setError(result.error);
    }
    setLoading(false);
  }, [enabled, input.jobId, input.requestedAttentionId]);

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [reload]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ jobId?: string }>).detail;
      if (detail?.jobId && detail.jobId !== input.jobId) return;
      void reload();
    };
    window.addEventListener(JOB_ATTENTION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(JOB_ATTENTION_CHANGED_EVENT, refresh);
    };
  }, [enabled, input.jobId, reload]);

  const selectedItem = useMemo(
    () => selectActiveAttention(items, selectedAttentionId),
    [items, selectedAttentionId]
  );

  const selectItem = useCallback(
    (attentionId: string) => {
      if (!items.some((item) => item.id === attentionId)) return false;
      setSelectedAttentionId(attentionId);
      return true;
    },
    [items]
  );

  const markRead = useCallback(
    async (attentionId: string): Promise<boolean> => {
      const jobId = input.jobId?.trim() ?? "";
      if (!jobId || !items.some((item) => item.id === attentionId)) {
        return false;
      }
      return markDisplayedJobAttentionRead(jobId, attentionId);
    },
    [input.jobId, items]
  );

  return {
    items,
    selectedItem,
    selectedAttentionId,
    loading,
    error,
    reload,
    selectItem,
    markRead,
  };
}
