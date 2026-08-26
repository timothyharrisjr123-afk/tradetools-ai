import { createAdminClient } from "@/app/lib/supabase/admin";
import {
  OPEN_JOB_DEPOSIT_FROM_ACCEPTANCE_RPC_V1,
  UPSERT_DRAFT_PROPOSAL_PAYMENT_TERMS_RPC_V1,
  parseProposalPaymentTermsRow,
  type ProposalPaymentTerms,
} from "@/app/lib/proposalPaymentTerms";
import { resolveOnlineDepositSendReadiness } from "@/app/lib/proposalPaymentSendReadiness";
import { isUuidLike } from "@/app/lib/uuid";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function readProposalPaymentTerms(
  supabase: SupabaseClient,
  input: { companyId: string; proposalVersionId: string }
): Promise<ProposalPaymentTerms | null> {
  if (!isUuidLike(input.companyId) || !isUuidLike(input.proposalVersionId)) {
    return null;
  }
  const { data, error } = await supabase
    .from("proposal_version_payment_terms")
    .select(
      "deposit_mode,deposit_percent_bps,deposit_fixed_cents,deposit_due_trigger,balance_due_trigger"
    )
    .eq("company_id", input.companyId)
    .eq("proposal_version_id", input.proposalVersionId)
    .maybeSingle();
  if (error || !data) return null;
  return parseProposalPaymentTermsRow(data);
}

export async function upsertDraftProposalPaymentTermsViaRpc(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    proposalId: string;
    terms: ProposalPaymentTerms;
  }
): Promise<{ ok: true } | { ok: false; code: string }> {
  const { data, error } = await supabase.rpc(UPSERT_DRAFT_PROPOSAL_PAYMENT_TERMS_RPC_V1, {
    p_payload: {
      company_id: input.companyId,
      proposal_id: input.proposalId,
      deposit_mode: input.terms.depositMode,
      deposit_percent_bps: input.terms.depositPercentBps,
      deposit_fixed_cents: input.terms.depositFixedCents,
    },
  });
  if (error) return { ok: false, code: "internal_error" };
  const record = data && typeof data === "object" ? (data as { ok?: boolean; code?: string }) : null;
  if (record?.ok !== true) {
    return { ok: false, code: String(record?.code ?? "invalid_payload") };
  }
  return { ok: true };
}

export async function openJobDepositFromAcceptanceViaAdmin(input: {
  companyId: string;
  acceptanceId: string;
}): Promise<void> {
  if (!isUuidLike(input.companyId) || !isUuidLike(input.acceptanceId)) return;
  try {
    const admin = createAdminClient();
    await admin.rpc(OPEN_JOB_DEPOSIT_FROM_ACCEPTANCE_RPC_V1, {
      p_payload: {
        company_id: input.companyId,
        acceptance_id: input.acceptanceId,
      },
    });
  } catch {
    // Acceptance must remain valid if deposit open fails.
  }
}

export async function readDraftOnlineDepositSendReadiness(
  supabase: SupabaseClient,
  input: { companyId: string; proposalId: string }
): Promise<ReturnType<typeof resolveOnlineDepositSendReadiness>> {
  const { data: proposal } = await supabase
    .from("proposals")
    .select("current_draft_version_id")
    .eq("id", input.proposalId)
    .eq("company_id", input.companyId)
    .maybeSingle();
  const versionId = String(
    (proposal as { current_draft_version_id?: string } | null)?.current_draft_version_id ?? ""
  );
  const terms = isUuidLike(versionId)
    ? await readProposalPaymentTerms(supabase, {
        companyId: input.companyId,
        proposalVersionId: versionId,
      })
    : null;
  const { data: account } = await supabase
    .from("company_payment_accounts")
    .select("charges_enabled")
    .eq("company_id", input.companyId)
    .eq("provider", "stripe")
    .maybeSingle();
  return resolveOnlineDepositSendReadiness({
    terms,
    chargesEnabled: (account as { charges_enabled?: boolean } | null)?.charges_enabled === true,
  });
}
