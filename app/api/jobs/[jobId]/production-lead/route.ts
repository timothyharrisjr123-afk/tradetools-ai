import { NextRequest, NextResponse } from "next/server";
import {
  JobResponsibilityHttpError,
  setJobProductionLead,
} from "@/app/lib/jobResponsibilityPersistence";
import { requireCapabilitySession } from "@/app/lib/requireCapabilitySession";
import { createClient } from "@/app/lib/supabase/server";
import { isUuidLike } from "@/app/lib/uuid";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    if (!isUuidLike(jobId)) {
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, code: "unauthorized" },
        { status: 401 }
      );
    }

    const gated = await requireCapabilitySession(supabase, user.id, "job_assign");
    if (!gated.ok) return gated.response;

    const body = await req.json().catch(() => ({}));
    const assignedToRaw = body?.assignedTo;
    const assignedTo =
      assignedToRaw === null || assignedToRaw === undefined || assignedToRaw === ""
        ? null
        : String(assignedToRaw).trim();

    const crewLabelRaw = body?.crewLabel;
    if (crewLabelRaw !== undefined) {
      const crewLabel =
        crewLabelRaw === null || String(crewLabelRaw).trim() === ""
          ? null
          : String(crewLabelRaw).trim().slice(0, 80);
      await supabase
        .from("jobs")
        .update({ crew_label: crewLabel })
        .eq("id", jobId)
        .eq("company_id", gated.session.companyId)
        .is("deleted_at", null);
    }

    const result = await setJobProductionLead({
      supabase,
      companyId: gated.session.companyId,
      jobId,
      actorUserId: user.id,
      assignedTo,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof JobResponsibilityHttpError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
