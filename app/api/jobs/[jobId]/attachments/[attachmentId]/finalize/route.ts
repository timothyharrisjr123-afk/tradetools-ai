import { NextRequest, NextResponse } from "next/server";
import { requireJobAttachmentSession } from "@/app/lib/jobAttachmentRouteAuth";
import {
  JobAttachmentHttpError,
  finalizeJobAttachmentUpload,
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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ jobId: string; attachmentId: string }> }
) {
  try {
    const { jobId, attachmentId } = await context.params;
    const supabase = await createClient();
    const ctx = await requireJobAttachmentSession(supabase, "mutate");
    const body = await req.json().catch(() => ({}));
    const attachment = await finalizeJobAttachmentUpload({
      supabase,
      admin: createAdminClient(),
      ctx,
      jobId,
      attachmentId,
      mimeType: body?.mimeType,
      filename: body?.filename,
      byteSize: body?.byteSize,
      captureSource: body?.captureSource,
      jobStageAtUpload: body?.jobStageAtUpload,
    });
    return NextResponse.json({ ok: true, attachment });
  } catch (error) {
    return jsonError(error);
  }
}
