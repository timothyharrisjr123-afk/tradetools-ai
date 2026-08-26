import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { isUuidLike } from "@/app/lib/uuid";
import {
  JobLifecyclePersistenceError,
  changeJobDispositionViaRpc,
} from "@/app/lib/jobLifecyclePersistence";
import {
  mapDispositionMutationError,
  normalizeDispositionReason,
} from "@/app/lib/jobDispositionManagement";
import { assertOperationalDispositionWrite } from "@/app/lib/jobLifecycleMapper";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function statusForCode(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
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

    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json(
        { ok: false, code: "forbidden" },
        { status: 403 }
      );
    }

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
