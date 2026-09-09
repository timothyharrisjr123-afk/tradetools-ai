import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { fetchPlacesAutocomplete } from "@/app/lib/placesClient";
import { isGooglePlacesConfigured } from "@/app/lib/placesConfig";
import { checkPlacesRateLimit } from "@/app/lib/placesRateLimit";
import { parsePlacesAutocompleteRequest } from "@/app/lib/placesRequestContract";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 });
}

function unavailable(status = 503) {
  return NextResponse.json(
    { ok: false, available: false, code: "temporarily_unavailable", suggestions: [] },
    { status, headers: status === 429 ? { "Retry-After": "60" } : undefined }
  );
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

  const parsed = parsePlacesAutocompleteRequest(req);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, code: parsed.code }, { status: 400 });
  }
  const rateLimit = await checkPlacesRateLimit({
    operation: "autocomplete",
    userId: user.id,
    companyId,
  });
  if (!rateLimit.allowed) return unavailable(rateLimit.reason === "rate_limited" ? 429 : 503);

  const result = await fetchPlacesAutocomplete(
    parsed.value.query,
    parsed.value.sessionToken,
    parsed.value.locality
  );
  if (!result.available) return unavailable();
  return NextResponse.json({
    ok: true,
    available: result.available,
    suggestions: result.suggestions,
  });
}
