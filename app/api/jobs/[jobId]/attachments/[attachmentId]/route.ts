import { NextRequest, NextResponse } from "next/server";
import { requireJobAttachmentSession } from "@/app/lib/jobAttachmentRouteAuth";
import {
  JobAttachmentHttpError,
  patchJobAttachmentCaption,
  signJobAttachmentReadUrl,
  softDeleteJobAttachment,
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
  context: { params: Promise<{ jobId: string; attachmentId: string }> }
) {
  try {
    const { jobId, attachmentId } = await context.params;
    const { supabase, admin, ctx } = await requireAuth("read");
    const signed = await signJobAttachmentReadUrl({
      supabase,
      admin,
      ctx,
      jobId,
      attachmentId,
    });
    return NextResponse.json({ ok: true, ...signed });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ jobId: string; attachmentId: string }> }
) {
  try {
    const { jobId, attachmentId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { supabase, admin, ctx } = await requireAuth("mutate");
    const attachment = await patchJobAttachmentCaption({
      supabase,
      admin,
      ctx,
      jobId,
      attachmentId,
      caption: body?.caption,
    });
    return NextResponse.json({ ok: true, attachment });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string; attachmentId: string }> }
) {
  try {
    const { jobId, attachmentId } = await context.params;
    const { supabase, ctx } = await requireAuth("mutate");
    await softDeleteJobAttachment({
      supabase,
      ctx,
      jobId,
      attachmentId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
