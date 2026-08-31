import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  formatPropertyDisplayAddress,
  normalizePropertyAddress,
  propertyAddressIsMatchable,
} from "@/app/lib/propertyAddressNormalize";
import { findPropertiesByNormalizedKey } from "@/app/lib/propertyStore";
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

  const address = {
    line1: req.nextUrl.searchParams.get("line1") ?? "",
    line2: req.nextUrl.searchParams.get("line2") ?? "",
    city: req.nextUrl.searchParams.get("city") ?? "",
    state: req.nextUrl.searchParams.get("state") ?? "",
    zip: req.nextUrl.searchParams.get("zip") ?? "",
    formatted: req.nextUrl.searchParams.get("formatted") ?? "",
  };

  if (!propertyAddressIsMatchable(address)) {
    return NextResponse.json({ ok: true, properties: [], normalized: "" });
  }

  const normalized = normalizePropertyAddress(address);
  const exact = await findPropertiesByNormalizedKey({
    supabase,
    companyId,
    address,
  });

  // Intake reuse is exact normalized key only. Token search is for typed
  // workspace findability — not a fuzzy merge offer on New Job.
  const seen = new Set<string>();
  const properties = exact
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      line1: row.address_line1,
      city: row.address_city,
      state: row.address_state,
      zip: row.address_zip,
      formatted:
        row.address_formatted ??
        formatPropertyDisplayAddress({
          line1: row.address_line1,
          city: row.address_city,
          state: row.address_state,
          zip: row.address_zip,
        }),
      jobCount: Number((row as { job_count?: number }).job_count ?? 0) || undefined,
    }));

  return NextResponse.json({
    ok: true,
    normalized,
    exactCount: exact.length,
    properties,
  });
}
