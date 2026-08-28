import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  JobTaskHttpError,
  completeJobTask,
  reopenJobTask,
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

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new JobTaskHttpError(401, "unauthorized");
  }
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    throw new JobTaskHttpError(403, "forbidden");
  }
  return { supabase, ctx: { userId: user.id, companyId } };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ jobId: string; taskId: string }> }
) {
  try {
    const { jobId, taskId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { supabase, ctx } = await requireAuth();

    if (body?.status != null) {
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
    const { supabase, ctx } = await requireAuth();
    await softDeleteJobTask({ supabase, ctx, jobId, taskId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
