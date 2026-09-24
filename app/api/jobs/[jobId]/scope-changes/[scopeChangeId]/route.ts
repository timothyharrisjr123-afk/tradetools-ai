import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  declineJobScopeChangeViaRpc,
  getScopeChangeWithLines,
  JobScopeChangePersistenceError,
  mintScopeChangePublicAccessTokenViaRpc,
  proposeJobScopeChangeViaRpc,
  updateJobScopeChangeDraftViaRpc,
  voidJobScopeChangeViaRpc,
} from "@/app/lib/jobScopeChangePersistence";
import {
  parseScopeChangeLineInputs,
  scopeChangeHttpStatus,
  scopeChangeRpcFailureResponse,
  scopeChangeRpcSuccessBody,
  serializeScopeChange,
  serializeScopeChangeLine,
} from "@/app/lib/jobScopeChangeApi";
import {
  buildMintedJobScopeChangePublicAccessToken,
  buildPublicScopeChangeReviewUrl,
} from "@/app/lib/jobScopeChangePublicAccess";
import { JOB_SCOPE_CHANGE_AUTHOR_CAPABILITY } from "@/app/lib/jobScopeChangeTypes";
import { resolvePublicAppOrigin } from "@/app/lib/publicAppOrigin.server";
import { requireCapabilitySession } from "@/app/lib/requireCapabilitySession";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string; scopeChangeId: string }>;
};

async function requireAuthorContext(jobId: string, scopeChangeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, code: "unauthorized" },
        { status: 401 }
      ),
    };
  }
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, code: "forbidden" },
        { status: 403 }
      ),
    };
  }
  if (!isUuidLike(jobId) || !isUuidLike(scopeChangeId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      ),
    };
  }
  return { ok: true as const, supabase, user, companyId, jobId, scopeChangeId };
}

/**
 * After propose: mint hash-only public access token and build customer URL.
 * Raw token is returned once in the response URL — never persisted by the API.
 */
async function mintPublicReviewUrlForProposed(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  companyId: string;
  jobId: string;
  scopeChangeId: string;
}): Promise<string | null> {
  const minted = buildMintedJobScopeChangePublicAccessToken();
  const mintResult = await mintScopeChangePublicAccessTokenViaRpc(
    input.supabase,
    {
      company_id: input.companyId,
      job_id: input.jobId,
      scope_change_id: input.scopeChangeId,
      token_hash: minted.tokenHash,
      token_prefix: minted.tokenPrefix,
      expires_at: minted.expiresAt,
      metadata_json: { source: "contractor_propose" },
    }
  );
  if (!mintResult.ok) return null;
  const origin = resolvePublicAppOrigin();
  return buildPublicScopeChangeReviewUrl(origin, minted.rawToken);
}

/**
 * GET detail + lines.
 * PATCH update draft.
 * POST actions: { action: "propose" | "void" | "decline" }.
 * Propose mints a customer-review token and returns publicReviewUrl once.
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const { jobId, scopeChangeId } = await context.params;
    const ctx = await requireAuthorContext(jobId, scopeChangeId);
    if (!ctx.ok) return ctx.response;

    const detail = await getScopeChangeWithLines(ctx.supabase, {
      company_id: ctx.companyId,
      job_id: ctx.jobId,
      scope_change_id: ctx.scopeChangeId,
    });
    if (!detail) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      scopeChange: serializeScopeChange(detail.scope_change),
      lines: detail.lines.map(serializeScopeChangeLine),
      // Raw token is only available at mint time (propose response).
      publicReviewUrl: null,
    });
  } catch (error) {
    if (error instanceof JobScopeChangePersistenceError) {
      return NextResponse.json(
        { ok: false, code: error.code ?? "internal_error" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { jobId, scopeChangeId } = await context.params;
    const ctx = await requireAuthorContext(jobId, scopeChangeId);
    if (!ctx.ok) return ctx.response;

    const gated = await requireCapabilitySession(
      ctx.supabase,
      ctx.user.id,
      JOB_SCOPE_CHANGE_AUTHOR_CAPABILITY
    );
    if (!gated.ok) return gated.response;

    const body = await req.json().catch(() => ({}));
    const lines =
      body?.lines === undefined
        ? undefined
        : parseScopeChangeLineInputs(body.lines);
    if (body?.lines !== undefined && (!lines || lines.length === 0)) {
      return NextResponse.json(
        { ok: false, code: "scope_change_lines_required" },
        { status: 400 }
      );
    }

    const result = await updateJobScopeChangeDraftViaRpc(ctx.supabase, {
      company_id: ctx.companyId,
      job_id: ctx.jobId,
      scope_change_id: ctx.scopeChangeId,
      expected_row_version:
        body?.expectedRowVersion != null
          ? Number(body.expectedRowVersion)
          : body?.expected_row_version != null
            ? Number(body.expected_row_version)
            : null,
      reason:
        body?.reason === undefined
          ? undefined
          : typeof body.reason === "string"
            ? body.reason
            : null,
      timing_note:
        body?.timingNote === undefined && body?.timing_note === undefined
          ? undefined
          : typeof body?.timingNote === "string"
            ? body.timingNote
            : typeof body?.timing_note === "string"
              ? body.timing_note
              : null,
      lines,
    });

    if (!result.ok) return scopeChangeRpcFailureResponse(result);
    return NextResponse.json(scopeChangeRpcSuccessBody(result));
  } catch (error) {
    if (error instanceof JobScopeChangePersistenceError) {
      const code = error.code ?? "internal_error";
      return NextResponse.json(
        { ok: false, code },
        { status: scopeChangeHttpStatus(code) }
      );
    }
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { jobId, scopeChangeId } = await context.params;
    const ctx = await requireAuthorContext(jobId, scopeChangeId);
    if (!ctx.ok) return ctx.response;

    const gated = await requireCapabilitySession(
      ctx.supabase,
      ctx.user.id,
      JOB_SCOPE_CHANGE_AUTHOR_CAPABILITY
    );
    if (!gated.ok) return gated.response;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim().toLowerCase();
    if (action !== "propose" && action !== "void" && action !== "decline") {
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }

    const expectedRowVersion =
      body?.expectedRowVersion != null
        ? Number(body.expectedRowVersion)
        : body?.expected_row_version != null
          ? Number(body.expected_row_version)
          : null;

    const transitionInput = {
      company_id: ctx.companyId,
      job_id: ctx.jobId,
      scope_change_id: ctx.scopeChangeId,
      expected_row_version: expectedRowVersion,
    };

    const result =
      action === "propose"
        ? await proposeJobScopeChangeViaRpc(ctx.supabase, transitionInput)
        : action === "void"
          ? await voidJobScopeChangeViaRpc(ctx.supabase, transitionInput)
          : await declineJobScopeChangeViaRpc(ctx.supabase, transitionInput);

    if (!result.ok) return scopeChangeRpcFailureResponse(result);

    let publicReviewUrl: string | null = null;
    if (action === "propose" && result.scope_change.status === "proposed") {
      try {
        publicReviewUrl = await mintPublicReviewUrlForProposed({
          supabase: ctx.supabase,
          companyId: result.scope_change.company_id,
          jobId: result.scope_change.job_id,
          scopeChangeId: result.scope_change.id,
        });
      } catch {
        publicReviewUrl = null;
      }
    }

    return NextResponse.json(
      scopeChangeRpcSuccessBody(result, { publicReviewUrl })
    );
  } catch (error) {
    if (error instanceof JobScopeChangePersistenceError) {
      const code = error.code ?? "internal_error";
      return NextResponse.json(
        { ok: false, code },
        { status: scopeChangeHttpStatus(code) }
      );
    }
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
