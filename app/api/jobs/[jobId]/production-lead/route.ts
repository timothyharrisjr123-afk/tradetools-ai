import { NextRequest, NextResponse } from "next/server";
import {
  JobResponsibilityHttpError,
  parseCoordinatorId,
  readJobCoordinator,
  setJobProductionLead,
} from "@/app/lib/jobResponsibilityPersistence";
import { requireAccess } from "@/app/lib/access/requireAccess";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";

export const runtime = "nodejs";

function errorJson(error: unknown) {
  if (error instanceof JobResponsibilityHttpError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message, ...(error.details ?? {}) },
      { status: error.status }
    );
  }
  return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
}

/** The Coordinator and its shared visible name. Authority is the database's jobs.read check. */
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
    const coordinator = await readJobCoordinator(supabase, jobId);
    return NextResponse.json({ ok: true, coordinator });
  } catch (error) {
    return errorJson(error);
  }
}

/**
 * Set or clear the Coordinator. Body: { assignedTo, expectedAssignedTo, requestId }.
 * expectedAssignedTo is the Coordinator the caller saw (null = Unassigned) and is required.
 */
export async function PATCH(
  req: NextRequest,
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

    const gated = await requireAccess(supabase, user.id, "jobs.assign");
    if (!gated.ok) return gated.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const assignedTo = parseCoordinatorId(body?.assignedTo);
    if (!assignedTo.ok) {
      return NextResponse.json({ ok: false, code: "invalid_assignee" }, { status: 400 });
    }
    const expected = parseCoordinatorId(body?.expectedAssignedTo);
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
    if (!Object.prototype.hasOwnProperty.call(body ?? {}, "expectedAssignedTo") || !expected.ok || !requestId) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const result = await setJobProductionLead({
      supabase,
      jobId,
      assignedTo: assignedTo.value,
      expectedPrevious: expected.value,
      requestId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorJson(error);
  }
}
