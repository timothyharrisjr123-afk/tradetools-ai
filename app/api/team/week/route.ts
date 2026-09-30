import { NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { calendarCivilRangeUtc, todayCivilIso } from "@/app/lib/jobScheduleMapper";
import { createClient } from "@/app/lib/supabase/server";
import { teamWeekRange, type TeamWeekJob } from "@/app/lib/team/teamWeek";

export const runtime = "nodejs";

function jobIdentity(row: Record<string, unknown>) {
  const customerName =
    String(row.customer_name ?? "").trim() ||
    String(row.job_name ?? "").replace(/ — roofing$/i, "").trim() ||
    "Job";
  const address =
    String(row.address_formatted ?? "").trim() ||
    [row.address_line1, row.address_city, row.address_state]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(", ");
  return { customerName, address };
}

/**
 * This week's scheduled work with each job's coordinator. Same reads (and the same
 * RLS) as the Calendar's schedule range; no crew-to-job relationship is implied.
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

  const { data: company } = await supabase.from("companies").select("timezone").eq("id", companyId).maybeSingle();
  const timezone = typeof company?.timezone === "string" && company.timezone ? company.timezone : null;
  if (!timezone) {
    return NextResponse.json({ ok: false, code: "company_timezone_required" }, { status: 409 });
  }

  const week = teamWeekRange(todayCivilIso(timezone));
  const range = calendarCivilRangeUtc({ firstVisibleOn: week.startsOn, afterLastVisibleOn: week.afterEndOn, timezone });
  const { data: schedules, error } = await supabase
    .from("job_schedules")
    .select("job_id,starts_on,ends_on")
    .eq("company_id", companyId)
    .eq("kind", "work")
    .eq("status", "scheduled")
    .lt("range_start_at", range.to)
    .gt("range_end_at", range.from);
  if (error) {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }

  const jobIds = [...new Set((schedules ?? []).map((row) => String(row.job_id)))];
  const jobsById = new Map<string, Record<string, unknown>>();
  if (jobIds.length > 0) {
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id,customer_name,job_name,assigned_to,status,deleted_at,address_formatted,address_line1,address_city,address_state")
      .eq("company_id", companyId)
      .in("id", jobIds);
    if (jobsError) {
      return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
    }
    for (const job of jobs ?? []) {
      if (job.deleted_at || job.status === "lost" || job.status === "closed") continue;
      jobsById.set(String(job.id), job);
    }
  }

  const jobs: TeamWeekJob[] = [];
  for (const row of schedules ?? []) {
    const job = jobsById.get(String(row.job_id));
    if (!job) continue;
    jobs.push({
      jobId: String(row.job_id),
      ...jobIdentity(job),
      startsOn: String(row.starts_on),
      endsOn: String(row.ends_on ?? row.starts_on),
      coordinatorUserId: typeof job.assigned_to === "string" ? job.assigned_to : null,
    });
  }

  return NextResponse.json({ ok: true, week: { ...week, jobs } });
}
