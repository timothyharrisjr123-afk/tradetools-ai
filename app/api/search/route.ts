import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createClient } from "@/app/lib/supabase/server";
import {
  WORKSPACE_SEARCH_RESULT_LIMIT,
  mapWorkspaceSearchRowToResult,
  workspaceSearchQueryIsActive,
  type WorkspaceSearchRow,
} from "@/app/lib/workspaceSearch";

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
  if (!workspaceSearchQueryIsActive(query)) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const { data, error } = await supabase.rpc("search_company_workspace_v1", {
    p_query: query,
  });

  if (error) {
    console.error("[search] search_company_workspace_v1 failed", error.message);
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }

  const results = (Array.isArray(data) ? data : [])
    .map((row) => mapWorkspaceSearchRowToResult(row as WorkspaceSearchRow))
    .filter((row): row is NonNullable<typeof row> => row != null)
    .slice(0, WORKSPACE_SEARCH_RESULT_LIMIT);

  return NextResponse.json({ ok: true, results });
}
