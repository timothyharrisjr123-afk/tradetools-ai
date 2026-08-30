import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { fetchPlacesDetails } from "@/app/lib/placesClient";
import { isGooglePlacesConfigured } from "@/app/lib/placesConfig";
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

  if (!isGooglePlacesConfigured()) {
    return NextResponse.json({ ok: true, available: false, address: null });
  }

  const placeId = (req.nextUrl.searchParams.get("placeId") ?? "").trim();
  if (!placeId) {
    return NextResponse.json({ ok: true, available: true, address: null });
  }

  const sessionToken = (req.nextUrl.searchParams.get("sessionToken") ?? "").trim() || null;
  const result = await fetchPlacesDetails(placeId, sessionToken);
  return NextResponse.json({
    ok: true,
    available: result.available,
    address: result.address,
  });
}
