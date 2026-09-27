import { NextRequest, NextResponse } from "next/server";
import { requireJobAttachmentSession } from "@/app/lib/jobAttachmentRouteAuth";
import {
  JobAttachmentHttpError,
  listJobAttachments,
  prepareJobAttachmentUpload,
} from "@/app/lib/jobAttachmentPersistence";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(error: unknown) {
  if (error instanceof JobAttachmentHttpError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.status }
    );
  }
  return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
}

async function requireAuth(access: "read" | "mutate") {
  const supabase = await createClient();
  const ctx = await requireJobAttachmentSession(supabase, access);
  return { supabase, admin: createAdminClient(), ctx };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const { supabase, admin, ctx } = await requireAuth("read");
    const attachments = await listJobAttachments({
      supabase,
      admin,
      ctx,
      jobId,
    });
    return NextResponse.json({ ok: true, attachments });
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
    const { supabase, admin, ctx } = await requireAuth("mutate");
    const prepared = await prepareJobAttachmentUpload({
      supabase,
      admin,
      ctx,
      jobId,
      mimeType: body?.mimeType,
      filename: body?.filename,
      byteSize: body?.byteSize,
      captureSource: body?.captureSource,
    });
    return NextResponse.json({ ok: true, ...prepared });
  } catch (error) {
    return jsonError(error);
  }
}
