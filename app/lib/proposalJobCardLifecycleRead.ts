/**
 * V2F1 — Job Card sent-version facts loader.
 *
 * Read-only. Does not write proposals.status, jobs.stage, tokens, or events.
 */

import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { isUuidLike } from "@/app/lib/jobStore";
import {
  buildJobCardSentHistoryView,
  type JobCardSentHistoryRowView,
  type JobCardSentVersionFact,
} from "@/app/lib/proposalJobCardSentHistory";
import type { ProposalDeliveryAttemptStatus } from "@/app/lib/proposalDeliveryAttemptTypes";

export type JobCardProposalSentFactsInput = {
  latestSentFrozenAt?: string | null;
  history?: readonly JobCardSentHistoryRowView[];
};

export type JobCardProposalSentFactsById = Record<string, JobCardProposalSentFactsInput>;

type VersionRow = {
  id: string;
  proposal_id: string;
  frozen_at: string | null;
};

type OptionRow = {
  proposal_version_id: string;
  name: string | null;
  customer_label: string | null;
  selected_at: string | null;
  is_default: boolean | null;
};

type AttemptRow = {
  proposal_version_id: string;
  status: string;
  created_at: string;
  attempted_at: string | null;
  provider_accepted_at: string | null;
  failed_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
};

function optionLabel(row: OptionRow): string | null {
  const customer = (row.customer_label ?? "").trim();
  if (customer) return customer.replace(/\s+package$/i, "").trim() || customer;
  const name = (row.name ?? "").trim();
  return name.replace(/\s+package$/i, "").trim() || name || null;
}

function attemptSortMs(row: AttemptRow): number {
  const raw =
    row.delivered_at ??
    row.failed_at ??
    row.bounced_at ??
    row.provider_accepted_at ??
    row.attempted_at ??
    row.created_at;
  return Date.parse(raw) || 0;
}

export async function loadJobCardProposalSentFacts(input: {
  companyId: string;
  proposalIds: readonly string[];
  latestSentVersionIdByProposalId: Readonly<Record<string, string | null | undefined>>;
  getSupabase?: typeof getSupabaseClient;
}): Promise<JobCardProposalSentFactsById> {
  const cid = input.companyId.trim();
  const ids = input.proposalIds.map((id) => id.trim()).filter((id) => isUuidLike(id));
  if (!cid || !isUuidLike(cid) || ids.length === 0) return {};

  const getSupabase = input.getSupabase ?? getSupabaseClient;
  const supabase = getSupabase();
  if (!supabase) return {};

  const { data: versionData, error: versionError } = await supabase
    .from("proposal_versions")
    .select("id, proposal_id, frozen_at")
    .eq("company_id", cid)
    .in("proposal_id", ids)
    .eq("version_kind", "sent");

  if (versionError || !versionData) return {};

  const versions = versionData as VersionRow[];
  const versionIds = versions.map((row) => row.id).filter((id) => isUuidLike(id));

  let options: OptionRow[] = [];
  if (versionIds.length > 0) {
    const { data: optionData } = await supabase
      .from("proposal_options")
      .select("proposal_version_id, name, customer_label, selected_at, is_default")
      .eq("company_id", cid)
      .in("proposal_version_id", versionIds);
    options = (optionData ?? []) as OptionRow[];
  }

  let attempts: AttemptRow[] = [];
  const { data: attemptData } = await supabase
    .from("proposal_delivery_attempts")
    .select(
      "proposal_version_id, status, created_at, attempted_at, provider_accepted_at, failed_at, delivered_at, bounced_at"
    )
    .eq("company_id", cid)
    .in("proposal_id", ids);
  attempts = (attemptData ?? []) as AttemptRow[];

  const packageByVersionId = new Map<string, string>();
  const optionsByVersion = new Map<string, OptionRow[]>();
  for (const option of options) {
    const vid = option.proposal_version_id;
    const list = optionsByVersion.get(vid) ?? [];
    list.push(option);
    optionsByVersion.set(vid, list);
  }
  for (const [versionId, list] of optionsByVersion) {
    const selected = list.find((row) => (row.selected_at ?? "").trim().length > 0);
    const fallback = list.find((row) => row.is_default) ?? list[0] ?? null;
    const label = optionLabel(selected ?? fallback ?? ({} as OptionRow));
    if (label) packageByVersionId.set(versionId, label);
  }

  const deliveryByVersionId = new Map<string, ProposalDeliveryAttemptStatus | string>();
  const latestAttemptMs = new Map<string, number>();
  for (const attempt of attempts) {
    const vid = attempt.proposal_version_id;
    const ms = attemptSortMs(attempt);
    const prev = latestAttemptMs.get(vid) ?? -1;
    if (ms >= prev) {
      latestAttemptMs.set(vid, ms);
      deliveryByVersionId.set(vid, attempt.status);
    }
  }

  const factsByProposal: Record<string, JobCardSentVersionFact[]> = {};
  for (const version of versions) {
    const proposalId = version.proposal_id;
    const list = factsByProposal[proposalId] ?? [];
    list.push({
      versionId: version.id,
      frozenAt: version.frozen_at,
      packageLabel: packageByVersionId.get(version.id) ?? null,
      deliveryStatus: deliveryByVersionId.get(version.id) ?? null,
    });
    factsByProposal[proposalId] = list;
  }

  const result: JobCardProposalSentFactsById = {};
  for (const proposalId of ids) {
    const history = buildJobCardSentHistoryView({
      latestSentVersionId: input.latestSentVersionIdByProposalId[proposalId] ?? null,
      versions: factsByProposal[proposalId] ?? [],
    });
    result[proposalId] = {
      latestSentFrozenAt: history.latestSentFrozenAt,
      history: history.rows,
    };
  }
  return result;
}
