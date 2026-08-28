import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
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

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const { supabase, ctx } = await requireAuth();
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
    const { supabase, ctx } = await requireAuth();
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
