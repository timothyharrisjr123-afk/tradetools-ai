import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { isUuidLike } from "@/app/lib/uuid";
import type { JobCardActivityItem } from "@/app/tools/roofing/jobCard/JobCardActivityPanel";

export type ProposalSignatureRow = {
  id: string;
  proposal_id: string;
  proposal_version_id: string;
  signed_at: string;
  signer_printed_name: string | null;
  accepted_option_label?: string | null;
};

export type ProposalSignatureActivityItem = JobCardActivityItem & {
  signatureId: string;
  signedAt: string;
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

export function composeProposalSignatureActivityItems(
  rows: readonly ProposalSignatureRow[]
): ProposalSignatureActivityItem[] {
  const items: ProposalSignatureActivityItem[] = [];
  for (const row of rows) {
    const signer = (row.signer_printed_name ?? "").trim();
    items.push({
      label: "Proposal signed",
      note: signer || "Customer signed this proposal",
      when: formatWhen(row.signed_at),
      signatureId: row.id,
      signedAt: row.signed_at,
    });
  }
  return items;
}

export async function listJobProposalSignatures(
  jobId: string
): Promise<ProposalSignatureRow[]> {
  const id = jobId.trim();
  if (!isUuidLike(id)) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("proposal_signatures")
    .select("id,proposal_id,proposal_version_id,signed_at,signer_printed_name")
    .eq("job_id", id)
    .order("signed_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as ProposalSignatureRow[];
}
