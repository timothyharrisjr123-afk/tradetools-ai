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
  buildProspectiveDepositPaymentViewModel,
  type JobPaymentRequestRow,
  type JobPaymentTransactionRow,
} from "@/app/lib/jobPaymentReadModel";
import { readProposalPaymentTerms } from "@/app/lib/proposalPaymentTermsPersistence";
import { openJobDepositFromAcceptanceViaAdmin } from "@/app/lib/proposalPaymentTermsPersistence";
import {
  DEFAULT_PROPOSAL_PAYMENT_TERMS,
  termsRequireOnlineDeposit,
} from "@/app/lib/proposalPaymentTerms";
import { readProposalPublicOptionChoiceCurrent } from "@/app/lib/proposalPublicOptionChoicePersistence";
import { isUuidLike } from "@/app/lib/uuid";

async function getAcceptanceForToken(input: {
  companyId: string;
  tokenId: string;
  proposalId: string;
  proposalVersionId: string;
}): Promise<{
  id: string;
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
    if (!acceptanceId) return { id: "", acceptedAt };
    const { data: signature, error: signatureError } = await supabase
      .from("proposal_signatures")
      .select("signed_at,signer_printed_name")
      .eq("company_id", input.companyId)
      .eq("proposal_acceptance_id", acceptanceId)
      .eq("signer_slot", "customer_primary")
      .maybeSingle();
    if (signatureError || !signature?.signed_at) {
      return { id: acceptanceId, acceptedAt };
    }
    return {
      id: acceptanceId,
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

async function resolveCustomerDisplayOptionKey(input: {
  companyId: string;
  proposalId: string;
  proposalVersionId: string;
}): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data: acceptance } = await supabase
      .from("proposal_acceptances")
      .select("customer_chosen_option_id")
      .eq("company_id", input.companyId)
      .eq("proposal_id", input.proposalId)
      .eq("proposal_version_id", input.proposalVersionId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const chosenOptionId = String(
      (acceptance as { customer_chosen_option_id?: string } | null)?.customer_chosen_option_id ??
        ""
    );
    if (isUuidLike(chosenOptionId)) {
      const { data: option } = await supabase
        .from("proposal_options")
        .select("source_template_option_id")
        .eq("id", chosenOptionId)
        .eq("company_id", input.companyId)
        .maybeSingle();
      const key = String(
        (option as { source_template_option_id?: string } | null)?.source_template_option_id ?? ""
      ).trim();
      if (key) return key;
    }

    const provisional = await readProposalPublicOptionChoiceCurrent(supabase, input);
    return provisional?.option_key ?? null;
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

async function getPaymentForJob(input: {
  companyId: string;
  jobId: string;
}): Promise<{
  requests: JobPaymentRequestRow[];
  transactions: JobPaymentTransactionRow[];
}> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("job_payment_requests")
      .select(
        "id,company_id,job_id,proposal_id,proposal_version_id,proposal_option_id,proposal_acceptance_id,proposal_signature_id,amount_cents,currency,kind,accepted_total_cents_snapshot,option_label_snapshot,provider_account_id,provider_checkout_session_id,status,requested_at,paid_at,cancelled_at,settled_payment_method_label"
      )
      .eq("company_id", input.companyId)
      .eq("job_id", input.jobId)
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
    resolveCustomerDisplayOptionKey:
      deps?.resolveCustomerDisplayOptionKey ?? resolveCustomerDisplayOptionKey,
  };

  const result = await loadPublicProposalByTokenCore(
    rawToken,
    viewMetadata,
    mergedDeps
  );
  if (!result.ok) return result;
  try {
    const supabase = createAdminClient();
    const terms =
      (await readProposalPaymentTerms(supabase, {
        companyId: result.tracking.company_id,
        proposalVersionId: result.tracking.proposal_version_id,
      })) ?? DEFAULT_PROPOSAL_PAYMENT_TERMS;

    const { data: proposal } = await supabase
      .from("proposals")
      .select("job_id")
      .eq("id", result.tracking.proposal_id)
      .eq("company_id", result.tracking.company_id)
      .maybeSingle();
    const jobId = String((proposal as { job_id?: string } | null)?.job_id ?? "");

    const currentComparisonOption = result.document.packet.comparison?.options.find(
      (option) => option.isCurrent
    );
    const selectedTotalCents =
      currentComparisonOption?.totalCents != null &&
      Number.isInteger(currentComparisonOption.totalCents)
        ? currentComparisonOption.totalCents
        : await (async () => {
            const { data: version } = await supabase
              .from("proposal_versions")
              .select("selected_option_id")
              .eq("id", result.tracking.proposal_version_id)
              .eq("company_id", result.tracking.company_id)
              .maybeSingle();
            const selectedOptionId = String(
              (version as { selected_option_id?: string } | null)?.selected_option_id ?? ""
            );
            if (!selectedOptionId) return null;
            const { data: option } = await supabase
              .from("proposal_options")
              .select("customer_total_cents")
              .eq("id", selectedOptionId)
              .eq("company_id", result.tracking.company_id)
              .maybeSingle();
            const cents = (option as { customer_total_cents?: number } | null)
              ?.customer_total_cents;
            return Number.isInteger(cents) ? (cents as number) : null;
          })();

    const acceptance = await getAcceptanceForToken({
      companyId: result.tracking.company_id,
      tokenId: result.tracking.token_id,
      proposalId: result.tracking.proposal_id,
      proposalVersionId: result.tracking.proposal_version_id,
    });
    if (acceptance?.id) {
      await openJobDepositFromAcceptanceViaAdmin({
        companyId: result.tracking.company_id,
        acceptanceId: acceptance.id,
      });
    }

    const loaded = jobId
      ? await getPaymentForJob({
          companyId: result.tracking.company_id,
          jobId,
        })
      : { requests: [], transactions: [] };

    const payableRequests = loaded.requests.filter((row) => {
      if (row.status === "paid" || row.status === "processing") return true;
      return row.proposal_version_id === result.tracking.proposal_version_id;
    });

    const payment =
      buildPublicPaymentViewModel({
        requests: payableRequests,
        transactions: loaded.transactions,
      }) ??
      (!acceptance && termsRequireOnlineDeposit(terms)
        ? buildProspectiveDepositPaymentViewModel({
            terms,
            selectedTotalCents,
          })
        : null);

    return {
      ...result,
      document: {
        ...result.document,
        packet: {
          ...result.document.packet,
          payment,
          paymentTerms: terms,
          selectedTotalCents,
        },
      },
    };
  } catch {
    return result;
  }
}
