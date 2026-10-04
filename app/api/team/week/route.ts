import { NextResponse } from "next/server";
import { CurrentCrewReadError, loadCrewWeek } from "@/app/lib/crew/currentCrew";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { todayCivilIso } from "@/app/lib/jobScheduleMapper";
import { createClient } from "@/app/lib/supabase/server";
import { teamWeekRange } from "@/app/lib/team/teamWeek";

export const runtime = "nodejs";

/**
 * This week's work per Crew: current Job → Crew assignments joined to Calendar work
 * schedules by get_crew_week_v1, which checks jobs.read and schedule.read per Job.
 * The company's own timezone decides which week "this week" is.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) {
    return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
  }

  const { data: company, error: companyError } = await supabase.from("companies").select("timezone").eq("id", companyId).maybeSingle();
  if (companyError) {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
  const timezone = typeof company?.timezone === "string" && company.timezone ? company.timezone : null;
  if (!timezone) {
    return NextResponse.json({ ok: false, code: "company_timezone_required" }, { status: 409 });
  }

  try {
    const week = await loadCrewWeek(supabase, teamWeekRange(todayCivilIso(timezone)));
    return NextResponse.json({ ok: true, week });
  } catch (error) {
    const code = error instanceof CurrentCrewReadError ? error.code : "unavailable";
    const status = code === "forbidden" ? 403 : code === "invalid_payload" ? 400 : 503;
    return NextResponse.json({ ok: false, code }, { status });
  }
}
