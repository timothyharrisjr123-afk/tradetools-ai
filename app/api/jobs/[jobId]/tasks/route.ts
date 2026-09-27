import { NextRequest, NextResponse } from "next/server";
import { checkAccess } from "@/app/lib/access/requireAccess";
import type { ActiveCapabilityKey } from "@/app/lib/access/registry";
import {
  JobTaskHttpError,
  createJobTask,
  listJobTasks,
} from "@/app/lib/jobTaskPersistence";
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

async function requireAuth(capability: ActiveCapabilityKey, jobId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new JobTaskHttpError(401, "unauthorized");
  }
  const gate = await checkAccess(supabase, user.id, capability, { jobId });
  if (!gate.ok) {
    throw new JobTaskHttpError(gate.denial.status, gate.denial.code);
  }
  return { supabase, ctx: { userId: user.id, companyId: gate.session.companyId } };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const { supabase, ctx } = await requireAuth("tasks.read", jobId);
    const tasks = await listJobTasks({ supabase, ctx, jobId });
    return NextResponse.json({ ok: true, tasks });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { supabase, ctx } = await requireAuth("tasks.manage", jobId);
    const task = await createJobTask({
      supabase,
      ctx,
      jobId,
      title: body?.title,
      notes: body?.notes,
      dueOn: body?.dueOn,
    });
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return jsonError(error);
  }
}
