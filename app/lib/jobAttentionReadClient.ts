import type {
  JobAttentionSafeItem,
  JobAttentionSummaryMap,
} from "@/app/lib/jobAttentionReadModel";

export const JOB_ATTENTION_API_PATH = "/api/jobs/attention";
export const JOB_ATTENTION_CHANGED_EVENT =
  "fielddive:job-attention-changed";

export function notifyJobAttentionChanged(detail?: {
  jobId?: string;
  attentionId?: string;
}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(JOB_ATTENTION_CHANGED_EVENT, { detail })
  );
}

export type JobAttentionSummaryFetchResult =
  | {
      ok: true;
      summaries: JobAttentionSummaryMap;
      truncated: boolean;
    }
  | { ok: false; error: string };

export type JobAttentionDetailFetchResult =
  | {
      ok: true;
      items: JobAttentionSafeItem[];
      selectedAttentionId: string | null;
    }
  | { ok: false; error: string };

function errorFromPayload(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as Record<string, unknown>).error;
  return typeof error === "string" && error.trim() ? error : fallback;
}

export async function fetchJobAttentionSummaries(): Promise<JobAttentionSummaryFetchResult> {
  try {
    const response = await fetch(JOB_ATTENTION_API_PATH, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== "object") {
      return { ok: false, error: errorFromPayload(payload, "load_failed") };
    }
    const record = payload as Record<string, unknown>;
    if (record.ok !== true || !record.summaries || typeof record.summaries !== "object") {
      return { ok: false, error: "invalid_response" };
    }
    const pagination =
      record.pagination && typeof record.pagination === "object"
        ? (record.pagination as Record<string, unknown>)
        : {};
    return {
      ok: true,
      summaries: record.summaries as JobAttentionSummaryMap,
      truncated: pagination.truncated === true,
    };
  } catch {
    return { ok: false, error: "load_failed" };
  }
}

export async function fetchJobAttentionDetail(
  jobId: string,
  requestedAttentionId?: string | null
): Promise<JobAttentionDetailFetchResult> {
  const params = new URLSearchParams({ jobId: jobId.trim() });
  if (requestedAttentionId?.trim()) {
    params.set("attentionId", requestedAttentionId.trim());
  }
  try {
    const response = await fetch(
      `${JOB_ATTENTION_API_PATH}?${params.toString()}`,
      { method: "GET", credentials: "same-origin" }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== "object") {
      return { ok: false, error: errorFromPayload(payload, "load_failed") };
    }
    const record = payload as Record<string, unknown>;
    if (record.ok !== true || !Array.isArray(record.items)) {
      return { ok: false, error: "invalid_response" };
    }
    return {
      ok: true,
      items: record.items as JobAttentionSafeItem[],
      selectedAttentionId:
        typeof record.selectedAttentionId === "string"
          ? record.selectedAttentionId
          : null,
    };
  } catch {
    return { ok: false, error: "load_failed" };
  }
}

export async function markDisplayedJobAttentionRead(
  jobId: string,
  attentionId: string
): Promise<boolean> {
  try {
    const response = await fetch(JOB_ATTENTION_API_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: jobId.trim(),
        attentionId: attentionId.trim(),
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload !== "object") return false;
    return (payload as Record<string, unknown>).ok === true;
  } catch {
    return false;
  }
}
