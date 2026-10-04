import { NextRequest, NextResponse } from "next/server";
import { requireJobAttachmentSession } from "@/app/lib/jobAttachmentRouteAuth";
import {
  jobAttachmentErrorBody,
  listJobAttachments,
  prepareJobAttachmentUpload,
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
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const { supabase, admin, ctx } = await requireAuth("read", jobId);
    const attachments = await listJobAttachments({
      supabase,
      admin,
      ctx,
      jobId,
    });
    return NextResponse.json({ ok: true, attachments });
  } catch (error) {
    return jsonError(error, "list");
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { supabase, admin, ctx } = await requireAuth("mutate", jobId);
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
    return jsonError(error, "prepare");
  }
}
