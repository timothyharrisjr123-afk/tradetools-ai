import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { isUuidLike } from "@/app/lib/jobStore";
import {
  JobProductionPersistenceError,
  JobProductionValidationError,
  startJobWorkViaRpc,
} from "@/app/lib/jobProductionPersistence";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function statusForCode(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (
    code === "illegal_stage" ||
    code === "disposition_blocks_start_work" ||
    code === "start_work_schedule_integrity_error" ||
    code === "production_start_integrity_error"
  ) {
    return 409;
  }
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
    if (!isUuidLike(jobId)) {
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }

    const result = await startJobWorkViaRpc(supabase, companyId, jobId);
    if (!result.ok) {
      return NextResponse.json(result, { status: statusForCode(result.code) });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof JobProductionValidationError) {
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }
    if (error instanceof JobProductionPersistenceError) {
      return NextResponse.json(
        { ok: false, code: "internal_error" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, code: "internal_error" },
      { status: 500 }
    );
  }
}

