import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { isUuidLike } from "@/app/lib/uuid";
import type { JobCardActivityItem } from "@/app/tools/roofing/jobCard/JobCardActivityPanel";

type AcceptanceRow = {
  id: string;
  proposal_id?: string | null;
  proposal_version_id?: string | null;
  proposal_option_id?: string | null;
  accepted_at: string;
  accepted_option_label: string | null;
  accepted_total_cents?: number | null;
  accepted_by_name?: string | null;
  accepted_by_email?: string | null;
  confirmed_at: string | null;
  confirmed_by_user_id: string | null;
  guard_result: string | null;
  ambiguity_reason?: string | null;
  /** Human proposal version number when enriched from proposal_versions. */
  version_number?: number | null;
};

/** Job Card Activity item for one immutable proposal_acceptances row. */
export type ProposalAcceptanceActivityItem = JobCardActivityItem & {
  acceptanceId: string;
  acceptedAt: string;
  /** Exact accepted proposal_version_id — durable audit pointer, not display label. */
  proposalVersionId?: string;
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

function formatHumanVersionLabel(
  versionNumber: number | null | undefined
): string | null {
  const n = Number(versionNumber);
  if (!Number.isFinite(n) || n < 1) return null;
  return `Version ${Math.floor(n)}`;
}

export function composeProposalAcceptanceActivityItems(
  rows: readonly AcceptanceRow[]
): ProposalAcceptanceActivityItem[] {
  const items: ProposalAcceptanceActivityItem[] = [];
  for (const row of rows) {
    const pkg = (row.accepted_option_label ?? "").trim();
    const versionId = String(row.proposal_version_id ?? "").trim();
    // Contractor-facing chronology uses human Version N — never UUID/hash prefixes.
    const versionHint = formatHumanVersionLabel(row.version_number);
    const noteParts = [pkg ? `${pkg} package` : null, versionHint].filter(
      Boolean
    );
    items.push({
      label: "Proposal accepted",
      note: noteParts.length
        ? noteParts.join(" · ")
        : "Customer accepted this proposal",
      when: formatWhen(row.accepted_at),
      acceptanceId: row.id,
      acceptedAt: row.accepted_at,
      ...(versionId ? { proposalVersionId: versionId } : {}),
    });
  }
  return items;
}

export class ProposalAcceptanceReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalAcceptanceReadError";
  }
}

/**
 * Rejects with ProposalAcceptanceReadError when acceptance truth cannot be
 * read; an empty array always means a successful read found no acceptance.
 */
export async function listJobProposalAcceptances(
  jobId: string
): Promise<AcceptanceRow[]> {
  const id = jobId.trim();
  if (!isUuidLike(id)) return [];
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new ProposalAcceptanceReadError("Proposal acceptances could not be loaded.");
  }
  const { data, error } = await supabase
    .from("proposal_acceptances")
    .select(
      "id,proposal_id,proposal_version_id,proposal_option_id,accepted_at,accepted_option_label,accepted_total_cents,accepted_by_name,accepted_by_email,confirmed_at,confirmed_by_user_id,guard_result,ambiguity_reason"
    )
    .eq("job_id", id)
    .order("accepted_at", { ascending: true });
  if (error) {
    throw new ProposalAcceptanceReadError(
      error.message || "Proposal acceptances could not be loaded."
    );
  }
  const rows = (data ?? []) as AcceptanceRow[];
  if (rows.length === 0) return rows;

  const versionIds = Array.from(
    new Set(
      rows
        .map((row) => String(row.proposal_version_id ?? "").trim())
        .filter((versionId) => isUuidLike(versionId))
    )
  );
  if (versionIds.length === 0) return rows;

  const { data: versionRows, error: versionError } = await supabase
    .from("proposal_versions")
    .select("id,version_number")
    .in("id", versionIds);
  if (versionError || !versionRows?.length) return rows;

  const numberById = new Map<string, number>();
  for (const version of versionRows as Array<{
    id: string;
    version_number: number | null;
  }>) {
    const versionId = String(version.id ?? "").trim();
    const n = Number(version.version_number);
    if (isUuidLike(versionId) && Number.isFinite(n) && n >= 1) {
      numberById.set(versionId, Math.floor(n));
    }
  }

  return rows.map((row) => {
    const versionId = String(row.proposal_version_id ?? "").trim();
    const versionNumber = numberById.get(versionId);
    return versionNumber != null
      ? { ...row, version_number: versionNumber }
      : row;
  });
}
