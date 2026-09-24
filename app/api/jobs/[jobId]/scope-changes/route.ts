import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  createJobScopeChangeViaRpc,
  fetchJobContractTotalCents,
  JobScopeChangePersistenceError,
  listScopeChangesForJob,
} from "@/app/lib/jobScopeChangePersistence";
import {
  parseScopeChangeLineInputs,
  scopeChangeHttpStatus,
  scopeChangeRpcFailureResponse,
  scopeChangeRpcSuccessBody,
  serializeScopeChange,
} from "@/app/lib/jobScopeChangeApi";
import { JOB_SCOPE_CHANGE_AUTHOR_CAPABILITY } from "@/app/lib/jobScopeChangeTypes";
import { requireCapabilitySession } from "@/app/lib/requireCapabilitySession";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * GET /api/jobs/[jobId]/scope-changes — company-scoped list.
 * POST — create draft (proposal_author only).
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
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }

    const { data: job } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!job) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    const [changes, contractTotalCents] = await Promise.all([
      listScopeChangesForJob(supabase, {
        company_id: companyId,
        job_id: jobId,
      }),
      fetchJobContractTotalCents(supabase, {
        company_id: companyId,
        job_id: jobId,
      }).catch(() => null),
    ]);

    const changeIds = changes.map((row) => row.id);
    const { data: lineRows } =
      changeIds.length > 0
        ? await supabase
            .from("job_scope_change_lines")
            .select(
              "id,company_id,scope_change_id,change_kind,description,quantity,unit,unit_price_cents,line_delta_cents,sort_order"
            )
            .eq("company_id", companyId)
            .in("scope_change_id", changeIds)
            .order("sort_order", { ascending: true })
        : { data: [] as never[] };

    const linesByScope = new Map<string, ReturnType<typeof serializeScopeChangeLine>[]>();
    for (const raw of lineRows ?? []) {
      const line = {
        id: String((raw as { id: string }).id),
        company_id: String((raw as { company_id: string }).company_id),
        scope_change_id: String((raw as { scope_change_id: string }).scope_change_id),
        change_kind: String((raw as { change_kind: string }).change_kind) as
          | "add"
          | "remove",
        description: String((raw as { description: string }).description ?? ""),
        quantity:
          (raw as { quantity?: number | null }).quantity == null
            ? null
            : Number((raw as { quantity: number }).quantity),
        unit:
          (raw as { unit?: string | null }).unit == null
            ? null
            : String((raw as { unit: string }).unit),
        unit_price_cents:
          (raw as { unit_price_cents?: number | null }).unit_price_cents == null
            ? null
            : Number((raw as { unit_price_cents: number }).unit_price_cents),
        line_delta_cents: Number(
          (raw as { line_delta_cents?: number }).line_delta_cents ?? 0
        ),
        sort_order: Number((raw as { sort_order?: number }).sort_order ?? 0),
      };
      const list = linesByScope.get(line.scope_change_id) ?? [];
      list.push(serializeScopeChangeLine(line));
      linesByScope.set(line.scope_change_id, list);
    }

    return NextResponse.json({
      ok: true,
      scopeChanges: changes.map((change) => ({
        ...serializeScopeChange(change),
        lines: linesByScope.get(change.id) ?? [],
      })),
      contractTotalCents,
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

export async function POST(req: NextRequest, context: RouteContext) {
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
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }

    const gated = await requireCapabilitySession(
      supabase,
      user.id,
      JOB_SCOPE_CHANGE_AUTHOR_CAPABILITY
    );
    if (!gated.ok) return gated.response;

    const body = await req.json().catch(() => ({}));
    const lines = parseScopeChangeLineInputs(body?.lines);
    if (!lines || lines.length === 0) {
      return NextResponse.json(
        { ok: false, code: "scope_change_lines_required" },
        { status: 400 }
      );
    }

    const result = await createJobScopeChangeViaRpc(supabase, {
      company_id: companyId,
      job_id: jobId,
      reason:
        typeof body?.reason === "string" ? body.reason : null,
      timing_note:
        typeof body?.timingNote === "string"
          ? body.timingNote
          : typeof body?.timing_note === "string"
            ? body.timing_note
            : null,
      lines,
    });

    if (!result.ok) return scopeChangeRpcFailureResponse(result);
    return NextResponse.json(scopeChangeRpcSuccessBody(result), { status: 201 });
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
