import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";
import {
  GET_JOB_FIELD_BRIEF_RPC_V1,
  parseJobFieldBrief,
} from "@/app/lib/jobFieldBrief";

export const runtime = "nodejs";

/**
 * Operational brief for members without commercial read access (Field, Production
 * Lead). The database projection omits prices, totals, terms, costs, payments, and
 * other jobs; an ungranted or foreign job is not_found.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    if (!isUuidLike(jobId)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc(GET_JOB_FIELD_BRIEF_RPC_V1, {
      p_job_id: jobId,
    });
    if (error) {
      return NextResponse.json({ ok: false, code: "brief_unavailable" }, { status: 503 });
    }
    const body = data as { ok?: unknown; code?: unknown } | null;
    if (body?.ok !== true) {
      const code = body?.code === "forbidden" ? "forbidden" : "not_found";
      return NextResponse.json(
        { ok: false, code },
        { status: code === "forbidden" ? 403 : 404 }
      );
    }
    const brief = parseJobFieldBrief(data);
    if (!brief) {
      return NextResponse.json({ ok: false, code: "brief_unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, brief });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
