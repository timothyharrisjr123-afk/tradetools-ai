import { NextRequest, NextResponse } from "next/server";
import { isUuidLike } from "@/app/lib/uuid";
import {
  JobSchedulePersistenceError,
  JobScheduleValidationError,
  scheduleJobViaRpc,
} from "@/app/lib/jobSchedulePersistence";
import { requireCapabilitySession } from "@/app/lib/requireCapabilitySession";
import { createClient } from "@/app/lib/supabase/server";
import {
  JobResponsibilityHttpError,
  setJobProductionLead,
} from "@/app/lib/jobResponsibilityPersistence";

export const runtime = "nodejs";

function statusForCode(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "forbidden") return 403;
  if (code === "not_found") return 404;
  if (code === "schedule_stale" || code === "already_scheduled") return 409;
  return 400;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
    }

    const gated = await requireCapabilitySession(
      supabase,
      user.id,
      "schedule_mutate"
    );
    if (!gated.ok) return gated.response;
    const companyId = gated.session.companyId;

    const body = await req.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    if (!isUuidLike(jobId)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const result = await scheduleJobViaRpc(supabase, companyId, {
      jobId,
      startsOn: String(body?.startsOn ?? "").trim(),
      endsOn: String(body?.endsOn ?? body?.startsOn ?? "").trim(),
      allDay: body?.allDay !== false,
      startLocalTime: typeof body?.startLocalTime === "string" ? body.startLocalTime : null,
      endLocalTime: typeof body?.endLocalTime === "string" ? body.endLocalTime : null,
      notes: typeof body?.notes === "string" ? body.notes : null,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: statusForCode(result.code) });
    }

    // Optional confirm/set of the SAME jobs.assigned_to production-lead fact.
    if (Object.prototype.hasOwnProperty.call(body, "assignedTo")) {
      const assignedTo =
        body.assignedTo === null ||
        body.assignedTo === undefined ||
        body.assignedTo === ""
          ? null
          : String(body.assignedTo).trim();
      try {
        const lead = await setJobProductionLead({
          supabase,
          companyId,
          jobId,
          actorUserId: user.id,
          assignedTo,
        });
        return NextResponse.json({ ...result, productionLead: lead });
      } catch (leadError) {
        if (leadError instanceof JobResponsibilityHttpError) {
          return NextResponse.json(
            {
              ok: false,
              code: leadError.code,
              message: leadError.message,
              schedule: result,
            },
            { status: leadError.status }
          );
        }
        throw leadError;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof JobScheduleValidationError) {
      return NextResponse.json({ ok: false, code: error.message }, { status: 400 });
    }
    if (error instanceof JobSchedulePersistenceError) {
      return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
    }
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
