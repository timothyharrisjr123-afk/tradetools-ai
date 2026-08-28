import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new JobAttachmentHttpError(401, "unauthorized");
    }
    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      throw new JobAttachmentHttpError(403, "forbidden");
    }
    const body = await req.json().catch(() => ({}));
    const attachment = await finalizeJobAttachmentUpload({
      supabase,
      admin: createAdminClient(),
      ctx: { userId: user.id, companyId },
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
