import "server-only";

import {
  listActiveAttentionSummaryRowsWithClient,
  listActiveJobAttentionDetailWithClient,
} from "@/app/lib/jobAttentionReadPersistence";
import {
  compareJobAttentionPriority,
  selectActiveAttention,
  summarizeActiveAttentionByJob,
} from "@/app/lib/jobAttentionReadModel";
import { markJobAttentionReadViaRpc } from "@/app/lib/jobAttentionPersistence";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getJobAttentionSummariesForAuthenticatedContractor(
  supabase: SupabaseClient,
  companyId: string
) {
  const result = await listActiveAttentionSummaryRowsWithClient(
    supabase,
    companyId
  );
  return {
    ok: true as const,
    summaries: summarizeActiveAttentionByJob(result.items),
    pagination: {
      pageSize: 500,
      maxRows: 5000,
      queryCount: result.queryCount,
      truncated: result.truncated,
    },
  };
}

export async function getJobAttentionDetailForAuthenticatedContractor(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    userId: string;
    jobId: string;
    requestedAttentionId?: string | null;
  }
) {
  const result = await listActiveJobAttentionDetailWithClient(supabase, input);
  if (!result.ok) return result;
  const items = [...result.items].sort(compareJobAttentionPriority);
  const selected = selectActiveAttention(items, input.requestedAttentionId);
  return {
    ok: true as const,
    items,
    selectedAttentionId: selected?.id ?? null,
    queryCount: result.queryCount,
  };
}

export async function markDisplayedJobAttentionReadForAuthenticatedContractor(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    userId: string;
    jobId: string;
    attentionId: string;
  }
) {
  const detail = await getJobAttentionDetailForAuthenticatedContractor(
    supabase,
    {
      companyId: input.companyId,
      userId: input.userId,
      jobId: input.jobId,
      requestedAttentionId: input.attentionId,
    }
  );
  if (!detail.ok) return detail;
  const exactActiveItem = detail.items.find(
    (item) => item.id === input.attentionId
  );
  if (!exactActiveItem) {
    return { ok: false as const, error: "not_found" as const };
  }

  const read = await markJobAttentionReadViaRpc(supabase, input.attentionId);
  if (!read.ok) {
    return { ok: false as const, error: "not_found" as const };
  }
  return {
    ok: true as const,
    attentionId: read.attention_id,
    readAt: read.read_at,
    lastViewedAt: read.last_viewed_at,
  };
}
