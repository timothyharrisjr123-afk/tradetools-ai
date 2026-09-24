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
  type JobPaymentRefundRow,
  type JobPaymentRequestRow,
  type JobPaymentTransactionRow,
} from "@/app/lib/jobPaymentReadModel";
import { readProposalPaymentTerms } from "@/app/lib/proposalPaymentTermsPersistence";
import { DEFAULT_PROPOSAL_PAYMENT_TERMS } from "@/app/lib/proposalPaymentTerms";
import { readProposalPublicOptionChoiceCurrent } from "@/app/lib/proposalPublicOptionChoicePersistence";
import { isUuidLike } from "@/app/lib/uuid";
import {
  fetchJobContractTotalCentsOrNull,
  listAuthorizedScopeChangesWithApprovals,
} from "@/app/lib/jobScopeChangePersistence";
import {
  buildPublicProjectRecordViewModel,
  type PublicProjectRecordScopeChangeInput,
} from "@/app/lib/publicProjectRecordViewModel";

async function getAcceptanceForToken(input: {
  companyId: string;
  tokenId: string;
  proposalId: string;
  proposalVersionId: string;
}): Promise<{
  id: string;
  acceptedAt: string;
  contractTotalCents?: number | null;
  signedAt?: string | null;
  signerPrintedName?: string | null;
} | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("proposal_acceptances")
      .select("id,accepted_at,customer_chosen_total_cents,accepted_total_cents")
      .eq("company_id", input.companyId)
      .eq("proposal_id", input.proposalId)
      .eq("proposal_version_id", input.proposalVersionId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data?.accepted_at) return null;
    const acceptedAt = String(data.accepted_at);
    const acceptanceId = String(data.id ?? "").trim();
    // Mirrors proposal_acceptance_contract_total_cents_v1 (the rollup's base).
    const chosenCents = (data as { customer_chosen_total_cents?: number | null })
      .customer_chosen_total_cents;
    const acceptedCents = (data as { accepted_total_cents?: number | null })
      .accepted_total_cents;
    const contractTotalCents = Number.isInteger(chosenCents)
      ? (chosenCents as number)
      : Number.isInteger(acceptedCents)
        ? (acceptedCents as number)
        : null;
    if (!acceptanceId) return { id: "", acceptedAt, contractTotalCents };
    const { data: signature, error: signatureError } = await supabase
      .from("proposal_signatures")
      .select("signed_at,signer_printed_name")
      .eq("company_id", input.companyId)
      .eq("proposal_acceptance_id", acceptanceId)
      .eq("signer_slot", "customer_primary")
      .maybeSingle();
    if (signatureError || !signature?.signed_at) {
      return { id: acceptanceId, acceptedAt, contractTotalCents };
    }
    return {
      id: acceptanceId,
      acceptedAt,
      contractTotalCents,
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
  refunds: JobPaymentRefundRow[];
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
    if (error || !data) return { requests: [], transactions: [], refunds: [] };
    const requests = data as JobPaymentRequestRow[];
    const ids = requests.map((row) => row.id);
    const [{ data: txns }, { data: refunds }] = await Promise.all([
      ids.length > 0
        ? supabase
            .from("job_payment_transactions")
            .select(
              "id,payment_request_id,kind,status,amount_cents,occurred_at,provider_event_id,provider_payment_intent_id"
            )
            .in("payment_request_id", ids)
        : Promise.resolve({ data: [] }),
      supabase
        .from("job_payment_refunds")
        .select(
          "id,company_id,job_id,payment_request_id,canonical_capture_transaction_id,amount_cents,status,initiated_at,pending_at,requires_action_at,succeeded_at,failed_at,canceled_at,created_at,updated_at"
        )
        .eq("company_id", input.companyId)
        .eq("job_id", input.jobId)
        .order("created_at", { ascending: true }),
    ]);
    return {
      requests,
      transactions: (txns ?? []) as JobPaymentTransactionRow[],
      refunds: (refunds ?? []) as JobPaymentRefundRow[],
    };
  } catch {
    return { requests: [], transactions: [], refunds: [] };
  }
}

/**
 * Job facts for the project record, scoped by the token's company and the
 * proposal's own job. Never reads attachments.
 */
async function getProjectRecordFactsForJob(input: {
  companyId: string;
  jobId: string;
}): Promise<{
  currentContractCents: number | null;
  scopeChanges: PublicProjectRecordScopeChangeInput[];
  job: { stage: string | null; completedAt: string | null } | null;
  timeZone: string | null;
}> {
  const supabase = createAdminClient();
  const scope = { company_id: input.companyId, job_id: input.jobId };
  const [currentContractCents, changes, jobRow, companyRow] = await Promise.all([
    fetchJobContractTotalCentsOrNull(supabase, scope).catch(() => null),
    listAuthorizedScopeChangesWithApprovals(supabase, scope).catch(() => []),
    supabase
      .from("jobs")
      .select("stage,completed_at")
      .eq("company_id", input.companyId)
      .eq("id", input.jobId)
      .maybeSingle()
      .then(
        ({ data }) => data as { stage?: string | null; completed_at?: string | null } | null,
        () => null
      ),
    supabase
      .from("companies")
      .select("timezone")
      .eq("id", input.companyId)
      .maybeSingle()
      .then(
        ({ data }) => data as { timezone?: string | null } | null,
        () => null
      ),
  ]);
  return {
    currentContractCents,
    scopeChanges: changes.map((row) => ({
      id: row.scope_change.id,
      company_id: row.scope_change.company_id,
      job_id: row.scope_change.job_id,
      status: row.scope_change.status,
      reason: row.scope_change.reason,
      authorized_at: row.scope_change.authorized_at,
      price_delta_cents: row.scope_change.price_delta_cents,
      lines: row.lines.map((line) => ({
        id: line.id,
        change_kind: line.change_kind,
        description: line.description,
        quantity: line.quantity ?? null,
        unit: line.unit ?? null,
        line_delta_cents: line.line_delta_cents,
        sort_order: line.sort_order,
      })),
      approval: row.approval
        ? { approved_at: row.approval.approved_at, approved_by_name: row.approval.approved_by_name }
        : null,
    })),
    job: jobRow
      ? { stage: jobRow.stage ?? null, completedAt: jobRow.completed_at ?? null }
      : null,
    timeZone: String(companyRow?.timezone ?? "").trim() || null,
  };
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

    const loaded = jobId
      ? await getPaymentForJob({
          companyId: result.tracking.company_id,
          jobId,
        })
      : { requests: [], transactions: [], refunds: [] };

    // Accepted jobs owe the current contract (base + authorized scope changes),
    // not the original option total. Unreadable rollup → unavailable, never $0.
    const hasJob = isUuidLike(jobId);
    const recordFacts =
      acceptance && hasJob
        ? await getProjectRecordFactsForJob({
            companyId: result.tracking.company_id,
            jobId,
          })
        : null;
    const currentContractCents = recordFacts?.currentContractCents ?? null;
    const contractTotalUnavailable = Boolean(acceptance && hasJob && currentContractCents == null);

    const originalAgreementCents = acceptance?.contractTotalCents ?? selectedTotalCents;
    const hasAuthorizedChanges = (recordFacts?.scopeChanges.length ?? 0) > 0;
    const payment = buildPublicPaymentViewModel({
      requests: loaded.requests,
      transactions: loaded.transactions,
      refunds: loaded.refunds,
      accepted: Boolean(acceptance),
      terms,
      contractTotalCents: hasJob && acceptance ? currentContractCents : originalAgreementCents,
      originalAgreementCents,
      proposalVersionId: result.tracking.proposal_version_id,
      acceptanceId: acceptance?.id ? acceptance.id : null,
      contractTotalUnavailable,
      hasAuthorizedChanges,
    });

    const packet = result.document.packet;
    const packageLabel =
      packet.comparison?.options.find((option) => option.isCurrent)?.label ??
      packet.estimate?.label ??
      null;
    const projectRecord = acceptance
      ? buildPublicProjectRecordViewModel({
          companyId: result.tracking.company_id,
          jobId: hasJob ? jobId : null,
          acceptance: {
            acceptedAt: acceptance.acceptedAt,
            signedAt: acceptance.signedAt ?? null,
            signerPrintedName: acceptance.signerPrintedName ?? null,
          },
          packageLabel,
          scopeChanges: recordFacts?.scopeChanges ?? [],
          originalAgreementCents: acceptance.contractTotalCents ?? null,
          currentContractCents,
          requests: loaded.requests,
          transactions: loaded.transactions,
          refunds: loaded.refunds,
          job: recordFacts?.job ?? null,
          timeZone: recordFacts?.timeZone ?? null,
        })
      : null;

    return {
      ...result,
      document: {
        ...result.document,
        packet: {
          ...packet,
          payment,
          paymentTerms: terms,
          selectedTotalCents,
          projectRecord,
        },
      },
    };
  } catch {
    return result;
  }
}
