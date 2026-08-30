import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  JOB_SEARCH_RESULT_LIMIT,
  jobSearchQueryIsActive,
  mapJobSearchRowToResult,
  type JobSearchRow,
} from "@/app/lib/jobSearch";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) return forbidden();

  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!jobSearchQueryIsActive(query)) {
    return NextResponse.json({ ok: true, jobs: [] });
  }

  const { data, error } = await supabase.rpc("search_company_jobs_v1", {
    p_query: query,
  });

  if (error) {
    console.error("[jobs/search] search_company_jobs_v1 failed", error.message);
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }

  const jobs = (Array.isArray(data) ? data : [])
    .map((row) => mapJobSearchRowToResult(row as JobSearchRow))
    .filter((row): row is NonNullable<typeof row> => row != null)
    .slice(0, JOB_SEARCH_RESULT_LIMIT);

  return NextResponse.json({ ok: true, jobs });
}
