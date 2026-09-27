import { createBusiness } from "@/app/lib/access/resolveAccess";
import { createClient } from "@/app/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Explicit create-business. The only application path that calls bootstrap v2.
 * Page loads never create a company. The RPC re-checks admission inside its transaction.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  let body: { companyName?: unknown; acknowledgePendingInvitations?: unknown } = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") body = parsed;
  } catch {
    body = {};
  }

  const companyName = typeof body.companyName === "string" ? body.companyName : null;
  const { result, unavailable } = await createBusiness(supabase, {
    companyName,
    acknowledgePendingInvitations: body.acknowledgePendingInvitations === true,
  });

  if (unavailable) {
    return NextResponse.json({ ok: false, code: "authorization_unavailable" }, { status: 503 });
  }
  if (result.ok) {
    return NextResponse.json({ ok: true, status: result.status, companyId: result.companyId });
  }
  const status = result.status === "invalid_payload" || result.status === "invalid_intent" ? 400 : 403;
  return NextResponse.json({ ok: false, code: result.status }, { status });
}
