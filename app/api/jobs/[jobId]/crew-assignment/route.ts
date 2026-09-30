import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/app/lib/access/requireAccess";
import {
  JobCrewAssignmentHttpError,
  endJobCrewAssignment,
  loadJobCrewAssignments,
  setPrimaryJobCrew,
} from "@/app/lib/jobCrewAssignmentPersistence";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof JobCrewAssignmentHttpError) {
    return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
  }
  return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
}

/** Crew assignment history for one job. Database-gated by jobs.read on that job. */
export async function GET(_req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
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
    const crewAssignments = await loadJobCrewAssignments(supabase, jobId);
    return NextResponse.json({ ok: true, crewAssignments });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * set_primary: assign, replace, or change/clear the Assignment Lead.
 * end: end/clear an assignment. Company-scope jobs.assign; the RPC re-checks it.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
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
    const gated = await requireAccess(supabase, user.id, "jobs.assign");
    if (!gated.ok) return gated.response;

    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    if (body.action === "set_primary") {
      const result = await setPrimaryJobCrew(supabase, {
        jobId,
        crewId: body.crewId,
        assignmentLeadPersonId: body.assignmentLeadPersonId,
        expectedPrimaryAssignmentId: body.expectedPrimaryAssignmentId,
        requestId: body.requestId,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "end") {
      const result = await endJobCrewAssignment(supabase, { jobId, assignmentId: body.assignmentId });
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
