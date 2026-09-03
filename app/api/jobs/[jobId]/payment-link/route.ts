import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { createAcceptedPaymentPublicLink } from "@/app/lib/jobPaymentPublicLink.server";
import {
  PUBLIC_ORIGIN_MISCONFIGURED_CODE,
  PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
  isPublicAppOriginError,
  resolvePublicAppOrigin,
} from "@/app/lib/publicAppOrigin.server";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

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

    let origin: string;
    try {
      origin = resolvePublicAppOrigin();
    } catch (error) {
      if (isPublicAppOriginError(error)) {
        console.error("[jobs/payment-link]", PUBLIC_ORIGIN_MISCONFIGURED_CODE);
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
