import { NextResponse } from "next/server";
import {
  JobScopeChangePersistenceError,
  resolveScopeChangePublicAccessTokenViaRpc,
} from "@/app/lib/jobScopeChangePersistence";
import {
  serializeScopeChange,
  serializeScopeChangeLine,
} from "@/app/lib/jobScopeChangeApi";
import { scopeChangeRequiresCustomerSignature } from "@/app/lib/jobScopeChangeSignaturePolicy";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

const SAFE_ERROR =
  "We could not load this scope change. Please try again or contact the contractor.";

/**
 * GET /api/scope-changes/public/[token]
 * Hashes raw token, resolves via service_role RPC. Never trusts client tenancy.
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const { token: rawToken } = await context.params;
    if (!String(rawToken ?? "").trim()) {
      return NextResponse.json(
        { ok: false, code: "invalid_token", message: SAFE_ERROR },
        { status: 404 }
      );
    }

    const admin = createAdminClient();
    const resolved = await resolveScopeChangePublicAccessTokenViaRpc(admin, {
      raw_token: rawToken,
    });

    if (!resolved.ok) {
      const code = String(resolved.code);
      const status =
        code === "expired" || code === "revoked" || code === "illegal_transition"
          ? 409
          : 404;
      return NextResponse.json(
        { ok: false, code, message: SAFE_ERROR },
        { status }
      );
    }

    const [{ data: acceptance }, { data: job }, { data: company }] = await Promise.all([
      admin
        .from("proposal_acceptances")
        .select(
          "id,accepted_total_cents,customer_chosen_total_cents,accepted_at,proposal_id,proposal_version_id"
        )
        .eq("id", resolved.scope_change.base_acceptance_id)
        .eq("company_id", resolved.company_id)
        .eq("job_id", resolved.job_id)
        .maybeSingle(),
      admin
        .from("jobs")
        .select("id,job_name,customer_name,address_formatted")
        .eq("id", resolved.job_id)
        .eq("company_id", resolved.company_id)
        .maybeSingle(),
      admin
        .from("companies")
        .select("name, phone")
        .eq("id", resolved.company_id)
        .maybeSingle(),
    ]);

    const originalAgreementCents =
      typeof acceptance?.customer_chosen_total_cents === "number"
        ? acceptance.customer_chosen_total_cents
        : typeof acceptance?.accepted_total_cents === "number"
          ? acceptance.accepted_total_cents
          : null;

    const currentContractCents =
      resolved.contract_total_cents ??
      resolved.scope_change.basis_contract_total_cents;
    const proposedNewTotalCents =
      resolved.proposed_new_total_cents ??
      currentContractCents + resolved.scope_change.price_delta_cents;

    return NextResponse.json({
      ok: true,
      scopeChange: serializeScopeChange(resolved.scope_change),
      lines: (resolved.lines ?? []).map(serializeScopeChangeLine),
      job: job
        ? {
            id: job.id,
            name: job.job_name ?? null,
            customerName: job.customer_name ?? null,
            addressFormatted: job.address_formatted ?? null,
          }
        : null,
      contractor: company
        ? {
            name: company.name ?? null,
            phone: company.phone ?? null,
          }
        : null,
      originalAgreement: acceptance
        ? {
            acceptanceId: acceptance.id,
            proposalId: acceptance.proposal_id,
            proposalVersionId: acceptance.proposal_version_id,
            acceptedAt: acceptance.accepted_at,
            totalCents: originalAgreementCents,
          }
        : null,
      currentContractTotalCents: currentContractCents,
      proposedNewTotalCents,
      priceDeltaCents: resolved.scope_change.price_delta_cents,
      signatureRequired: scopeChangeRequiresCustomerSignature({
        companyId: resolved.company_id,
      }),
      canAuthorize: resolved.scope_change.status === "proposed",
    });
  } catch (error) {
    if (error instanceof JobScopeChangePersistenceError) {
      return NextResponse.json(
        { ok: false, code: "internal_error", message: SAFE_ERROR },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, code: "internal_error", message: SAFE_ERROR },
      { status: 500 }
    );
  }
}
