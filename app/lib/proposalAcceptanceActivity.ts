import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { isUuidLike } from "@/app/lib/jobStore";
import type { JobCardActivityItem } from "@/app/tools/roofing/jobCard/JobCardActivityPanel";

type AcceptanceRow = {
  id: string;
  accepted_at: string;
  accepted_option_label: string | null;
  confirmed_at: string | null;
  confirmed_by_user_id: string | null;
  guard_result: string | null;
};

function parseTs(iso: string | null | undefined): number {
  const ts = Date.parse(String(iso ?? ""));
  return Number.isFinite(ts) ? ts : 0;
}

function formatWhen(iso: string | null | undefined): string | undefined {
  const ts = parseTs(iso);
  if (!ts) return undefined;
  return new Date(ts).toLocaleString();
}

export function composeProposalAcceptanceActivityItems(
  rows: readonly AcceptanceRow[]
): JobCardActivityItem[] {
  const items: JobCardActivityItem[] = [];
  for (const row of rows) {
    const pkg = (row.accepted_option_label ?? "").trim();
    items.push({
      label: "Proposal accepted",
      note: pkg ? `${pkg} package` : "Customer accepted this proposal",
      when: formatWhen(row.accepted_at),
    });
  }
  return items;
}

export async function listJobProposalAcceptances(jobId: string): Promise<AcceptanceRow[]> {
  const id = jobId.trim();
  if (!isUuidLike(id)) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("proposal_acceptances")
    .select(
      "id,accepted_at,accepted_option_label,confirmed_at,confirmed_by_user_id,guard_result"
    )
    .eq("job_id", id)
    .order("accepted_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as AcceptanceRow[];
}
