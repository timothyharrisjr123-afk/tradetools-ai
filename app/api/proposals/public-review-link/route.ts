import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { isUuidLike } from "@/app/lib/uuid";
import { createPublicProposalReviewLinkForContractor } from "@/app/lib/proposalPublicReviewLink.server";
import { PUBLIC_REVIEW_MINT_ERROR_MESSAGE } from "@/app/lib/proposalPublicReviewReadiness";
import {
  PUBLIC_ORIGIN_MISCONFIGURED_CODE,
  PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
  isPublicAppOriginError,
  resolvePublicAppOrigin,
} from "@/app/lib/publicAppOrigin.server";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const proposalId = String(body?.proposalId ?? "").trim();
    const jobId = String(body?.jobId ?? "").trim();

    if (!isUuidLike(proposalId) || !isUuidLike(jobId)) {
      return NextResponse.json(
        { ok: false, message: PUBLIC_REVIEW_MINT_ERROR_MESSAGE },
        { status: 400 }
      );
    }

    let origin: string;
    try {
      origin = resolvePublicAppOrigin();
    } catch (error) {
      if (isPublicAppOriginError(error)) {
        console.error("[proposals/public-review-link]", PUBLIC_ORIGIN_MISCONFIGURED_CODE);
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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: PUBLIC_REVIEW_MINT_ERROR_MESSAGE }, { status: 401 });
    }

    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ ok: false, message: PUBLIC_REVIEW_MINT_ERROR_MESSAGE }, { status: 403 });
    }

    const result = await createPublicProposalReviewLinkForContractor({
      companyId,
      proposalId,
      jobId,
      userId: user.id,
      origin,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { ok: false, message: PUBLIC_REVIEW_MINT_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}
