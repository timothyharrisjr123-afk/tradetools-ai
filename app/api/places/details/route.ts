import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { fetchPlacesDetails } from "@/app/lib/placesClient";
import { isGooglePlacesConfigured } from "@/app/lib/placesConfig";
import { checkPlacesRateLimit } from "@/app/lib/placesRateLimit";
import { parsePlacesDetailsRequest } from "@/app/lib/placesRequestContract";
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
    { ok: false, available: false, code: "temporarily_unavailable", address: null },
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
    return NextResponse.json({ ok: true, available: false, address: null });
  }

  const parsed = parsePlacesDetailsRequest(req);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, code: parsed.code }, { status: 400 });
  }
  const rateLimit = await checkPlacesRateLimit({
    operation: "details",
    userId: user.id,
    companyId,
  });
  if (!rateLimit.allowed) return unavailable(rateLimit.reason === "rate_limited" ? 429 : 503);

  const result = await fetchPlacesDetails(parsed.value.placeId, parsed.value.sessionToken);
  if (!result.available) return unavailable();
  return NextResponse.json({
    ok: true,
    available: result.available,
    address: result.address,
  });
}
