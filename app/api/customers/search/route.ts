import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  CUSTOMER_SEARCH_RESULT_LIMIT,
  buildCustomerSearchRpcQuery,
  customerSearchQueryIsActive,
  rankCustomerSearchCandidates,
  type CustomerSearchRow,
} from "@/app/lib/customerMatch";
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

  const name = req.nextUrl.searchParams.get("name") ?? "";
  const email = req.nextUrl.searchParams.get("email") ?? "";
  const phone = req.nextUrl.searchParams.get("phone") ?? "";
  const q = req.nextUrl.searchParams.get("q") ?? "";

  const input = { name, email, phone, q };
  if (!customerSearchQueryIsActive(input)) {
    return NextResponse.json({ ok: true, customers: [] });
  }

  // Query each active signal separately so a typed email does not hide name/phone matches.
  const rpcQueries = new Set<string>();
  const emailNorm = (email || "").trim().toLowerCase();
  if (emailNorm.includes("@") && emailNorm.includes(".")) rpcQueries.add(emailNorm);
  const phoneDigits = (phone || "").replace(/[^0-9]/g, "");
  if (phoneDigits.length >= 7) rpcQueries.add(phoneDigits);
  const nameTrim = (name || "").trim().replace(/\s+/g, " ");
  if (nameTrim.length >= 2) rpcQueries.add(nameTrim);
  const qTrim = (q || "").trim();
  if (qTrim.length >= 2) rpcQueries.add(qTrim);
  if (rpcQueries.size === 0) {
    rpcQueries.add(buildCustomerSearchRpcQuery(input));
  }

  const rowById = new Map<string, CustomerSearchRow>();
  for (const rpcQuery of rpcQueries) {
    const { data, error } = await supabase.rpc("search_company_customers_v1", {
      p_query: rpcQuery,
    });
    if (error) {
      console.error("[customers/search] search_company_customers_v1 failed", error.message);
      return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
    }
    for (const row of Array.isArray(data) ? data : []) {
      const id = String((row as CustomerSearchRow)?.id ?? "").trim();
      if (!id || rowById.has(id)) continue;
      rowById.set(id, row as CustomerSearchRow);
    }
  }

  const customers = rankCustomerSearchCandidates(
    [...rowById.values()],
    input
  ).slice(0, CUSTOMER_SEARCH_RESULT_LIMIT);

  return NextResponse.json({ ok: true, customers });
}
