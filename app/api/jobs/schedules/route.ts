import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { isUuidLike } from "@/app/lib/jobStore";
import { parseJobScheduleList } from "@/app/lib/jobSchedulePersistence";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

const SCHEDULE_COLUMNS =
  "id,company_id,job_id,kind,status,timezone,all_day,starts_on,ends_on,start_local_time,end_local_time,range_start_at,range_end_at,notes,created_by_user_id,updated_by_user_id,created_at,updated_at,cancelled_at,row_version";

function jobIdentity(row: {
  customer_name?: string | null;
  job_name?: string | null;
  address_formatted?: string | null;
  address_line1?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
}) {
  const customerName =
    String(row.customer_name ?? "").trim() ||
    String(row.job_name ?? "").replace(/ — roofing$/i, "").trim() ||
    "Job";
  const address =
    String(row.address_formatted ?? "").trim() ||
    [row.address_line1, row.address_city, row.address_state, row.address_zip]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(", ");
  return { customerName, address };
}

export async function GET(req: NextRequest) {
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

  const url = req.nextUrl;
  const jobId = (url.searchParams.get("jobId") ?? "").trim();
  const candidates = url.searchParams.get("candidates") === "1";
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  const active = url.searchParams.get("active") === "1";

  if (candidates) {
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select(
        "id,customer_name,job_name,stage,status,address_formatted,address_line1,address_city,address_state,address_zip"
      )
      .eq("company_id", companyId)
      .eq("stage", "approved")
      .eq("status", "active")
      .is("deleted_at", null);
    if (jobsError) {
      return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
    }

    const { data: scheduled } = await supabase
      .from("job_schedules")
      .select("job_id")
      .eq("company_id", companyId)
      .eq("kind", "work")
      .eq("status", "scheduled");
    const taken = new Set((scheduled ?? []).map((row) => String(row.job_id)));

    const { data: due } = await supabase
      .from("job_payment_requests")
      .select("job_id,kind,status")
      .eq("company_id", companyId)
      .eq("kind", "deposit")
      .in("status", ["open", "processing"]);
    const dueJobs = new Set((due ?? []).map((row) => String(row.job_id)));

    const items = (jobs ?? [])
      .filter((job) => !taken.has(String(job.id)))
      .map((job) => {
        const identity = jobIdentity(job);
        return {
          jobId: job.id,
          customerName: identity.customerName,
          address: identity.address,
          depositDue: dueJobs.has(String(job.id)),
        };
      });

    return NextResponse.json({ ok: true, candidates: items });
  }

  let query = supabase
    .from("job_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("company_id", companyId)
    .eq("kind", "work");

  if (jobId) {
    if (!isUuidLike(jobId)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
    query = query.eq("job_id", jobId).order("created_at", { ascending: false });
  } else if (from && to) {
    query = query
      .eq("status", "scheduled")
      .lt("range_start_at", to)
      .gt("range_end_at", from)
      .order("range_start_at", { ascending: true });
  } else if (active) {
    query = query
      .eq("status", "scheduled")
      .order("starts_on", { ascending: true });
  } else {
    return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }

  const schedules = parseJobScheduleList(data);
  const jobIds = [...new Set(schedules.map((row) => row.job_id))];
  const jobsById = new Map<
    string,
    { customerName: string; address: string; stage: string; disposition: string }
  >();

  if (jobIds.length > 0) {
    const { data: jobs } = await supabase
      .from("jobs")
      .select(
        "id,customer_name,job_name,stage,status,address_formatted,address_line1,address_city,address_state,address_zip"
      )
      .eq("company_id", companyId)
      .in("id", jobIds);
    for (const job of jobs ?? []) {
      const identity = jobIdentity(job);
      jobsById.set(String(job.id), {
        customerName: identity.customerName,
        address: identity.address,
        stage: String(job.stage ?? ""),
        disposition: String(job.status ?? ""),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    schedules,
    events: schedules.map((schedule) => {
      const job = jobsById.get(schedule.job_id);
      return {
        schedule,
        jobId: schedule.job_id,
        customerName: job?.customerName ?? "Job",
        address: job?.address ?? "",
        stage: job?.stage ?? "",
        disposition: job?.disposition ?? "",
      };
    }),
  });
}
