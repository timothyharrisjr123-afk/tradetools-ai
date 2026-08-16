/**
 * V2F1 — Authoritative mutable-draft dirty signal ownership.
 *
 * Customer-visible child mutations must touch proposals.updated_at.
 * Job Card revision state and send-prep refreeze both read that header
 * timestamp against latest sent frozen_at (see isMutableDraftDirtyAfterSentFreeze).
 *
 * proposal_versions has no updated_at. Do not scan child rows in the UI.
 */

type TouchQuery = {
  update: (values: { updated_at: string }) => TouchQuery;
  eq: (column: string, value: string) => TouchQuery;
};

export function mutableDraftTouchFailureMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to touch proposal updated_at.";
}

/**
 * Bump the owning proposal header so draft-vs-freeze comparison sees the write.
 * Same-transaction freeze still uses strict `>` and will not look like a revision.
 */
export async function touchMutableDraftProposalUpdatedAt(
  supabase: { from: (table: string) => unknown },
  input: {
    companyId: string;
    proposalId: string;
    touchedAt?: string;
  }
): Promise<string> {
  const touchedAt = (input.touchedAt ?? new Date().toISOString()).trim();
  const query = supabase.from("proposals") as TouchQuery;
  const { error } = await (query
    .update({ updated_at: touchedAt })
    .eq("id", input.proposalId)
    .eq("company_id", input.companyId) as unknown as PromiseLike<{
    error: { message?: string } | null;
  }>);

  if (error) {
    throw new Error(error.message ?? "Failed to touch proposal updated_at.");
  }
  return touchedAt;
}
