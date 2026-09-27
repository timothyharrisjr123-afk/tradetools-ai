import { NextRequest, NextResponse } from "next/server";
import { checkAccess, type AccessScope } from "@/app/lib/access/requireAccess";
import type { ActiveCapabilityKey } from "@/app/lib/access/registry";
import {
  JobTaskHttpError,
  completeJobTask,
  reopenJobTask,
  setJobTaskAssignee,
  softDeleteJobTask,
  updateJobTaskContent,
} from "@/app/lib/jobTaskPersistence";
import { parseJobTaskStatus } from "@/app/lib/jobTaskValidation";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(error: unknown) {
  if (error instanceof JobTaskHttpError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.status }
    );
  }
  return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
}

/** Assignment, content, and deletion need tasks.manage at the job; status needs tasks.complete at the task. */
async function requireAuth(capability: ActiveCapabilityKey, scope: AccessScope) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new JobTaskHttpError(401, "unauthorized");
  }
  const gate = await checkAccess(supabase, user.id, capability, scope);
  if (!gate.ok) {
    throw new JobTaskHttpError(gate.denial.status, gate.denial.code);
  }
  return { supabase, ctx: { userId: user.id, companyId: gate.session.companyId } };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ jobId: string; taskId: string }> }
) {
  try {
    const { jobId, taskId } = await context.params;
    const body = await req.json().catch(() => ({}));

    if (Object.prototype.hasOwnProperty.call(body, "assignedTo")) {
      const { supabase, ctx } = await requireAuth("tasks.manage", { jobId });
      const assignedTo =
        body.assignedTo === null ||
        body.assignedTo === undefined ||
        body.assignedTo === ""
          ? null
          : String(body.assignedTo).trim();
      const task = await setJobTaskAssignee({
        supabase,
        ctx,
        jobId,
        taskId,
        assignedTo,
      });
      return NextResponse.json({ ok: true, task });
    }

    if (body?.status != null) {
      const { supabase, ctx } = await requireAuth("tasks.complete", { jobId, taskId });
      const parsed = parseJobTaskStatus(body.status);
      if (!parsed.ok) {
        throw new JobTaskHttpError(400, parsed.code, parsed.message);
      }
      const task =
        parsed.status === "complete"
          ? await completeJobTask({ supabase, ctx, jobId, taskId })
          : await reopenJobTask({ supabase, ctx, jobId, taskId });
      return NextResponse.json({ ok: true, task });
    }

    const { supabase, ctx } = await requireAuth("tasks.manage", { jobId });
    const task = await updateJobTaskContent({
      supabase,
      ctx,
      jobId,
      taskId,
      title: body?.title,
      notes: body?.notes,
      dueOn: body?.dueOn,
    });
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string; taskId: string }> }
) {
  try {
    const { jobId, taskId } = await context.params;
    const { supabase, ctx } = await requireAuth("tasks.manage", { jobId });
    await softDeleteJobTask({ supabase, ctx, jobId, taskId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
