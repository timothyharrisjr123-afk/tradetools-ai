import { NextRequest, NextResponse } from "next/server";
import { requireJobAttachmentSession } from "@/app/lib/jobAttachmentRouteAuth";
import {
  jobAttachmentErrorBody,
  patchJobAttachmentCaption,
  signJobAttachmentReadUrl,
  softDeleteJobAttachment,
} from "@/app/lib/jobAttachmentPersistence";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(error: unknown, operation: string) {
  const { status, body } = jobAttachmentErrorBody(error, operation);
  return NextResponse.json(body, { status });
}

async function requireAuth(access: "read" | "mutate", jobId: string) {
  const supabase = await createClient();
  const ctx = await requireJobAttachmentSession(supabase, access, jobId);
  return { supabase, admin: createAdminClient(), ctx };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string; attachmentId: string }> }
) {
  try {
    const { jobId, attachmentId } = await context.params;
    const { supabase, admin, ctx } = await requireAuth("read", jobId);
    const signed = await signJobAttachmentReadUrl({
      supabase,
      admin,
      ctx,
      jobId,
      attachmentId,
    });
    return NextResponse.json({ ok: true, ...signed });
  } catch (error) {
    return jsonError(error, "sign_read");
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ jobId: string; attachmentId: string }> }
) {
  try {
    const { jobId, attachmentId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { supabase, admin, ctx } = await requireAuth("mutate", jobId);
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
    return jsonError(error, "caption");
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string; attachmentId: string }> }
) {
  try {
    const { jobId, attachmentId } = await context.params;
    const { supabase, ctx } = await requireAuth("mutate", jobId);
    await softDeleteJobAttachment({
      supabase,
      ctx,
      jobId,
      attachmentId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "remove");
  }
}
