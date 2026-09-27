import { NextRequest, NextResponse } from "next/server";
import { resolveLiveMembership } from "@/app/lib/companyMembershipSession";
import { isUuidLike } from "@/app/lib/uuid";
import {
  JobLifecyclePersistenceError,
  changeJobDispositionViaRpc,
} from "@/app/lib/jobLifecyclePersistence";
import {
  mapDispositionMutationError,
  normalizeDispositionReason,
} from "@/app/lib/jobDispositionManagement";
import { capabilityForDispositionTransition } from "@/app/lib/jobDispositionAuthority";
import { assertOperationalDispositionWrite } from "@/app/lib/jobLifecycleMapper";
import {
  mapActiveMembershipGate,
  requireCapabilitySession,
} from "@/app/lib/requireCapabilitySession";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function statusForCode(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden" || code === "capability_denied") return 403;
  if (code === "not_found") return 404;
  if (code === "illegal_disposition_target") return 409;
  return 400;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, code: "unauthorized" },
        { status: 401 }
      );
    }

    const active = mapActiveMembershipGate(await resolveLiveMembership(supabase, user.id));
    if (!active.ok) {
      return NextResponse.json(
        { ok: false, code: active.denial.code },
        { status: active.denial.status }
      );
    }
    const companyId = active.session.companyId;

    const body = await req.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const toStatusRaw =
      typeof body?.toStatus === "string" ? body.toStatus.trim() : "";
    if (!isUuidLike(jobId)) {
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }

    let toStatus;
    try {
      toStatus = assertOperationalDispositionWrite(toStatusRaw);
    } catch {
      return NextResponse.json(
        { ok: false, code: "illegal_disposition_target" },
        { status: 409 }
      );
    }

    const { data: jobRow, error: jobError } = await supabase
      .from("jobs")
      .select("id, status, company_id, deleted_at")
      .eq("id", jobId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (jobError) {
      return NextResponse.json(
        { ok: false, code: "internal_error" },
        { status: 500 }
      );
    }
    if (
      !jobRow ||
      (jobRow as { deleted_at?: string | null }).deleted_at
    ) {
      return NextResponse.json(
        { ok: false, code: "not_found" },
        { status: 404 }
      );
    }

    const fromStatus =
      typeof (jobRow as { status?: string | null }).status === "string"
        ? (jobRow as { status: string }).status
        : null;
    const requiredCapability = capabilityForDispositionTransition(
      fromStatus,
      toStatus
    );
    const gated = await requireCapabilitySession(
      supabase,
      user.id,
      requiredCapability
    );
    if (!gated.ok) return gated.response;

    const reason = normalizeDispositionReason(
      typeof body?.reason === "string" ? body.reason : null
    );

    const result = await changeJobDispositionViaRpc(supabase, {
      company_id: companyId,
      job_id: jobId,
      to_status: toStatus,
      reason,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: statusForCode(result.code) });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof JobLifecyclePersistenceError) {
      return NextResponse.json(
        {
          ok: false,
          code: "internal_error",
          message: mapDispositionMutationError("internal_error"),
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, code: "internal_error" },
      { status: 500 }
    );
  }
}
