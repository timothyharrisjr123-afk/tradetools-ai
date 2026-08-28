import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createAcceptedPaymentPublicLink } from "@/app/lib/jobPaymentPublicLink.server";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function resolveRequestOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (host) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/**
 * Contractor Copy payment link for the canonical accepted proposal version.
 * Does not freeze, send, or follow latest draft/latest_sent.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
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
    if (!isUuidLike(jobId)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const result = await createAcceptedPaymentPublicLink({
      companyId,
      jobId,
      userId: user.id,
      origin: resolveRequestOrigin(req),
    });
    if (!result.ok) {
      const status =
        result.code === "not_found" ? 404 : result.code === "no_acceptance" ? 409 : 400;
      return NextResponse.json(
        { ok: false, code: result.code, message: result.message },
        { status }
      );
    }
    return NextResponse.json({
      ok: true,
      publicUrl: result.publicUrl,
      tokenPrefix: result.tokenPrefix,
      expiresAt: result.expiresAt,
      proposalId: result.proposalId,
      proposalVersionId: result.proposalVersionId,
    });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
