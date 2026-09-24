import { NextRequest, NextResponse } from "next/server";
import {
  authorizeJobScopeChangeViaRpc,
  JobScopeChangePersistenceError,
  resolveScopeChangePublicAccessTokenViaRpc,
} from "@/app/lib/jobScopeChangePersistence";
import {
  scopeChangeRpcFailureResponse,
  scopeChangeRpcSuccessBody,
} from "@/app/lib/jobScopeChangeApi";
import { hashJobScopeChangePublicAccessToken } from "@/app/lib/jobScopeChangePublicAccess";
import { scopeChangeRequiresCustomerSignature } from "@/app/lib/jobScopeChangeSignaturePolicy";
import { isUuidLike } from "@/app/lib/uuid";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

const SAFE_ERROR =
  "We could not authorize this scope change. Please try again or contact the contractor.";

/**
 * POST /api/scope-changes/public/[token]/authorize
 * Resolve token → hash → authorize RPC with token_hash (required).
 * Company/job/scope_change never trusted from body.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { token: rawToken } = await context.params;
    if (!String(rawToken ?? "").trim()) {
      return NextResponse.json(
        { ok: false, code: "invalid_token", message: SAFE_ERROR },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    if (
      body?.companyId != null ||
      body?.jobId != null ||
      body?.scopeChangeId != null ||
      body?.tokenHash != null ||
      body?.token_hash != null
    ) {
      return NextResponse.json(
        { ok: false, code: "invalid_payload", message: SAFE_ERROR },
        { status: 400 }
      );
    }

    const approvedByName =
      typeof body?.approvedByName === "string" ? body.approvedByName.trim() : "";
    if (!approvedByName) {
      return NextResponse.json(
        { ok: false, code: "invalid_payload", message: SAFE_ERROR },
        { status: 400 }
      );
    }

    const approvedByEmail =
      typeof body?.approvedByEmail === "string"
        ? body.approvedByEmail.trim() || null
        : null;

    const proposalSignatureId =
      typeof body?.proposalSignatureId === "string"
        ? body.proposalSignatureId.trim()
        : "";

    const admin = createAdminClient();
    const resolved = await resolveScopeChangePublicAccessTokenViaRpc(admin, {
      raw_token: rawToken,
    });
    if (!resolved.ok) {
      const code = String(resolved.code);
      return NextResponse.json(
        { ok: false, code, message: SAFE_ERROR },
        { status: code === "illegal_transition" ? 409 : 404 }
      );
    }

    const signatureRequired = scopeChangeRequiresCustomerSignature({
      companyId: resolved.company_id,
    });
    if (signatureRequired && !isUuidLike(proposalSignatureId)) {
      return NextResponse.json(
        { ok: false, code: "invalid_signature", message: SAFE_ERROR },
        { status: 400 }
      );
    }
    if (proposalSignatureId && !isUuidLike(proposalSignatureId)) {
      return NextResponse.json(
        { ok: false, code: "invalid_signature", message: SAFE_ERROR },
        { status: 400 }
      );
    }

    const tokenHash = hashJobScopeChangePublicAccessToken(rawToken);

    const result = await authorizeJobScopeChangeViaRpc(admin, {
      company_id: resolved.company_id,
      job_id: resolved.job_id,
      scope_change_id: resolved.scope_change_id,
      token_hash: tokenHash,
      approved_by_name: approvedByName,
      approved_by_email: approvedByEmail,
      approval_method: "public_token",
      proposal_signature_id: proposalSignatureId || null,
      evidence_json: {
        source: "public_scope_change_authorize",
        token_bound: true,
        token_id: resolved.token_id,
      },
    });

    if (!result.ok) return scopeChangeRpcFailureResponse(result);
    return NextResponse.json(scopeChangeRpcSuccessBody(result));
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
