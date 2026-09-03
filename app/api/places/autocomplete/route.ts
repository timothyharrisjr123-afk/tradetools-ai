import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { fetchPlacesAutocomplete } from "@/app/lib/placesClient";
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
    return NextResponse.json({ ok: true, available: false, suggestions: [] });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const sessionToken = (req.nextUrl.searchParams.get("sessionToken") ?? "").trim() || null;
  const city = (req.nextUrl.searchParams.get("city") ?? "").trim() || null;
  const state = (req.nextUrl.searchParams.get("state") ?? "").trim() || null;
  const zip = (req.nextUrl.searchParams.get("zip") ?? "").trim() || null;
  const locality =
    city || state || zip ? { city, state, zip } : null;
  const result = await fetchPlacesAutocomplete(q, sessionToken, locality);
  return NextResponse.json({
    ok: true,
    available: result.available,
    suggestions: result.suggestions,
  });
}
