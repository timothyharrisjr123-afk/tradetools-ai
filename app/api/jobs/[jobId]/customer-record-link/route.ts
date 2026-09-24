import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createAcceptedPaymentPublicLink } from "@/app/lib/jobPaymentPublicLink.server";
import {
  PUBLIC_ORIGIN_MISCONFIGURED_CODE,
  PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
  isPublicAppOriginError,
  resolvePublicAppOrigin,
} from "@/app/lib/publicAppOrigin.server";
import { requireCapabilitySession } from "@/app/lib/requireCapabilitySession";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Phase 12 — Copy customer link for the customer project record (`/p/{token}`).
 * `proposal_author` only. Mints a new accepted-version token per call and
 * mutates nothing else: no send, no status, no job or payment change.
 */
export async function POST(_req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
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
    const gated = await requireCapabilitySession(supabase, user.id, "proposal_author");
    if (!gated.ok) return gated.response;
    if (!isUuidLike(jobId)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    let origin: string;
    try {
      origin = resolvePublicAppOrigin();
    } catch (error) {
      if (isPublicAppOriginError(error)) {
        console.error("[jobs/customer-record-link]", PUBLIC_ORIGIN_MISCONFIGURED_CODE);
        return NextResponse.json(
          {
            ok: false,
            code: PUBLIC_ORIGIN_MISCONFIGURED_CODE,
            message: PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
          },
          { status: 503 }
        );
      }
      throw error;
    }

    const result = await createAcceptedPaymentPublicLink({
      companyId,
      jobId,
      userId: user.id,
      origin,
      source: "customer_record_share",
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
      expiresAt: result.expiresAt,
    });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
