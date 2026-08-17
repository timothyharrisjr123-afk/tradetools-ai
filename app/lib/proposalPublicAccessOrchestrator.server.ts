/**
 * R18C4A — Server-only entry for public proposal access orchestrator.
 */

import "server-only";

import {
  loadPublicProposalByToken as loadPublicProposalByTokenCore,
  type LoadPublicProposalByTokenFailure,
  type LoadPublicProposalByTokenResult,
  type LoadPublicProposalByTokenSuccess,
  type ProposalPublicAccessOrchestratorDeps,
  type ProposalPublicViewTrackingEnvelope,
} from "@/app/lib/proposalPublicAccessOrchestrator";
import type { ProposalPublicAccessCustomerViewMetadata } from "@/app/lib/proposalPublicAccessRpcPersistence";
import {
  recordProposalCustomerView,
  resolveProposalPublicAccessToken,
} from "@/app/lib/proposalPublicAccessRpcStore.server";
import { buildProposalPublicGraphDto } from "@/app/lib/proposalPublicGraphDto";
import { buildProposalPublicProposalDocumentViewModel } from "@/app/lib/proposalPublicProposalViewModel";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getPublicProposalVersionGraph } from "@/app/lib/proposalVersionGraphStore.server";
import {
  buildPublicPaymentViewModel,
  type JobPaymentRequestRow,
  type JobPaymentTransactionRow,
} from "@/app/lib/jobPaymentReadModel";

async function getAcceptanceForToken(input: {
  companyId: string;
  tokenId: string;
  proposalId: string;
  proposalVersionId: string;
}): Promise<{
  acceptedAt: string;
  signedAt?: string | null;
  signerPrintedName?: string | null;
} | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("proposal_acceptances")
      .select("id,accepted_at")
      .eq("company_id", input.companyId)
      .eq("proposal_id", input.proposalId)
      .eq("proposal_version_id", input.proposalVersionId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.accepted_at) return null;
    const acceptedAt = String(data.accepted_at);
    const acceptanceId = String(data.id ?? "").trim();
    if (!acceptanceId) return { acceptedAt };
    const { data: signature, error: signatureError } = await supabase
      .from("proposal_signatures")
      .select("signed_at,signer_printed_name")
      .eq("company_id", input.companyId)
      .eq("proposal_acceptance_id", acceptanceId)
      .eq("signer_slot", "customer_primary")
      .maybeSingle();
    if (signatureError || !signature?.signed_at) {
      return { acceptedAt };
    }
    return {
      acceptedAt,
      signedAt: String(signature.signed_at),
      signerPrintedName: signature.signer_printed_name
        ? String(signature.signer_printed_name)
        : null,
    };
  } catch {
    return null;
  }
}

export type {
  LoadPublicProposalByTokenFailure,
  LoadPublicProposalByTokenResult,
  LoadPublicProposalByTokenSuccess,
  ProposalPublicAccessOrchestratorDeps,
  ProposalPublicViewTrackingEnvelope,
};

async function getPaymentForToken(input: {
  companyId: string;
  proposalId: string;
  proposalVersionId: string;
}): Promise<{
  requests: JobPaymentRequestRow[];
  transactions: JobPaymentTransactionRow[];
}> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("job_payment_requests")
      .select(
        "id,company_id,job_id,proposal_id,proposal_version_id,proposal_option_id,proposal_acceptance_id,proposal_signature_id,amount_cents,currency,kind,accepted_total_cents_snapshot,option_label_snapshot,provider_account_id,provider_checkout_session_id,status,requested_at,paid_at,cancelled_at"
      )
      .eq("company_id", input.companyId)
      .eq("proposal_id", input.proposalId)
      .eq("proposal_version_id", input.proposalVersionId)
      .order("requested_at", { ascending: true });
    if (error || !data) return { requests: [], transactions: [] };
    const requests = data as JobPaymentRequestRow[];
    const ids = requests.map((row) => row.id);
    if (ids.length === 0) return { requests, transactions: [] };
    const { data: txns } = await supabase
      .from("job_payment_transactions")
      .select("id,payment_request_id,kind,status,amount_cents,occurred_at,provider_event_id")
      .in("payment_request_id", ids);
    return {
      requests,
      transactions: (txns ?? []) as JobPaymentTransactionRow[],
    };
  } catch {
    return { requests: [], transactions: [] };
  }
}

export async function loadPublicProposalByToken(
  rawToken: string,
  viewMetadata: ProposalPublicAccessCustomerViewMetadata = {},
  deps?: Partial<ProposalPublicAccessOrchestratorDeps>
): Promise<LoadPublicProposalByTokenResult> {
  const mergedDeps: ProposalPublicAccessOrchestratorDeps = {
    resolveToken: deps?.resolveToken ?? resolveProposalPublicAccessToken,
    getVersionGraph: deps?.getVersionGraph ?? getPublicProposalVersionGraph,
    buildDto: deps?.buildDto ?? buildProposalPublicGraphDto,
    buildDocumentViewModel: deps?.buildDocumentViewModel ?? buildProposalPublicProposalDocumentViewModel,
    recordView: deps?.recordView ?? recordProposalCustomerView,
    getAcceptanceForToken: deps?.getAcceptanceForToken ?? getAcceptanceForToken,
  };

  const result = await loadPublicProposalByTokenCore(
    rawToken,
    viewMetadata,
    mergedDeps
  );
  if (!result.ok) return result;
  try {
    const loaded = await getPaymentForToken({
      companyId: result.tracking.company_id,
      proposalId: result.tracking.proposal_id,
      proposalVersionId: result.tracking.proposal_version_id,
    });
    const payment = buildPublicPaymentViewModel({
      requests: loaded.requests,
      transactions: loaded.transactions,
    });
    if (!payment) return result;
    return {
      ...result,
      document: {
        ...result.document,
        packet: {
          ...result.document.packet,
          payment,
        },
      },
    };
  } catch {
    return result;
  }
}
