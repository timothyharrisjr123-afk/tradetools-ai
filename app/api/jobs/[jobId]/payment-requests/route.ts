import { NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  buildJobCardPaymentViewModel,
  type JobPaymentRequestRow,
  type JobPaymentTransactionRow,
} from "@/app/lib/jobPaymentReadModel";
import {
  buildJobPaymentWorkspace,
  proposalAcceptanceContractTotalCents,
} from "@/app/lib/jobPaymentWorkspace";
import { parseProposalPaymentTermsRow } from "@/app/lib/proposalPaymentTerms";
import { isUuidLike } from "@/app/lib/uuid";
import { resolveCanonicalJobStage } from "@/app/lib/jobLifecycleMapper";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * Contractor payment read model for one job.
 * Workspace omits provider ids from primary fields; timeline disclosure keeps
 * them behind progressive details only.
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
    }
    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
    }
    if (!isUuidLike(jobId)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const { data: job } = await supabase
      .from("jobs")
      .select("id,stage,status,archived,active_proposal_id,latest_proposal_id")
      .eq("id", jobId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!job) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    const [{ data: requests }, { data: account }, { data: acceptance }, { data: signature }] =
      await Promise.all([
        supabase
          .from("job_payment_requests")
          .select(
            "id,company_id,job_id,proposal_id,proposal_version_id,proposal_option_id,proposal_acceptance_id,proposal_signature_id,amount_cents,currency,kind,accepted_total_cents_snapshot,option_label_snapshot,provider_account_id,provider_checkout_session_id,status,requested_at,paid_at,cancelled_at,settled_payment_method_label"
          )
          .eq("job_id", jobId)
          .eq("company_id", companyId)
          .order("requested_at", { ascending: true }),
        supabase
          .from("company_payment_accounts")
          .select("charges_enabled,onboarding_status,details_submitted,payouts_enabled")
          .eq("company_id", companyId)
          .eq("provider", "stripe")
          .maybeSingle(),
        supabase
          .from("proposal_acceptances")
          .select(
            "id,accepted_total_cents,customer_chosen_total_cents,accepted_at,confirmed_at,proposal_version_id"
          )
          .eq("job_id", jobId)
          .eq("company_id", companyId)
          .order("accepted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("proposal_signatures")
          .select("id")
          .eq("job_id", jobId)
          .eq("company_id", companyId)
          .limit(1)
          .maybeSingle(),
      ]);

    const requestRows = (requests ?? []) as JobPaymentRequestRow[];
    const requestIds = requestRows.map((row) => row.id);
    const versionId =
      typeof acceptance?.proposal_version_id === "string"
        ? acceptance.proposal_version_id
        : "";
    const [{ data: transactions }, { data: termsRow }] = await Promise.all([
      requestIds.length > 0
        ? supabase
            .from("job_payment_transactions")
            .select(
              "id,payment_request_id,kind,status,amount_cents,occurred_at,provider_event_id,provider_payment_intent_id"
            )
            .in("payment_request_id", requestIds)
        : Promise.resolve({ data: [] }),
      versionId && isUuidLike(versionId)
        ? supabase
            .from("proposal_version_payment_terms")
            .select(
              "deposit_mode,deposit_percent_bps,deposit_fixed_cents,deposit_due_trigger,balance_due_trigger"
            )
            .eq("proposal_version_id", versionId)
            .eq("company_id", companyId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const canonical = resolveCanonicalJobStage(job as never);
    const jobStatus = String((job as { status?: string }).status ?? "active");
    const jobArchived = Boolean((job as { archived?: boolean }).archived);
    const accountRow = account
      ? {
          charges_enabled: Boolean(
            (account as { charges_enabled?: boolean }).charges_enabled
          ),
          onboarding_status: String(
            (account as { onboarding_status?: string }).onboarding_status ?? "pending"
          ),
          details_submitted: Boolean(
            (account as { details_submitted?: boolean }).details_submitted
          ),
          payouts_enabled: Boolean(
            (account as { payouts_enabled?: boolean }).payouts_enabled
          ),
        }
      : null;
    const transactionRows = (transactions ?? []) as JobPaymentTransactionRow[];
    const contractTotalCents = proposalAcceptanceContractTotalCents({
      customerChosenTotalCents:
        typeof acceptance?.customer_chosen_total_cents === "number"
          ? acceptance.customer_chosen_total_cents
          : null,
      acceptedTotalCents:
        typeof acceptance?.accepted_total_cents === "number"
          ? acceptance.accepted_total_cents
          : null,
    });
    const workspace = buildJobPaymentWorkspace({
      jobStage: canonical,
      accepted: Boolean(acceptance),
      account: accountRow,
      requests: requestRows,
      transactions: transactionRows,
      customerChosenTotalCents:
        typeof acceptance?.customer_chosen_total_cents === "number"
          ? acceptance.customer_chosen_total_cents
          : null,
      acceptedTotalCents:
        typeof acceptance?.accepted_total_cents === "number"
          ? acceptance.accepted_total_cents
          : null,
      terms: parseProposalPaymentTermsRow(termsRow),
      jobPaymentActive: !jobArchived && jobStatus === "active",
    });
    const view = buildJobCardPaymentViewModel({
      jobStage: canonical,
      jobDisposition: String((job as { status?: string }).status ?? "active"),
      accepted: Boolean(acceptance),
      signed: Boolean(signature),
      account: accountRow,
      requests: requestRows,
      transactions: transactionRows,
      acceptedTotalCents: contractTotalCents,
    });

    return NextResponse.json({
      ok: true,
      workspace,
      view,
      requests: requestRows.map((row) => ({
        id: row.id,
        kind: row.kind,
        status: row.status,
        amountCents: row.amount_cents,
        currency: row.currency,
        proposalSignatureId: row.proposal_signature_id,
        acceptedTotalCentsSnapshot: row.accepted_total_cents_snapshot,
        optionLabelSnapshot: row.option_label_snapshot,
        requestedAt: row.requested_at,
        paidAt: row.paid_at,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
