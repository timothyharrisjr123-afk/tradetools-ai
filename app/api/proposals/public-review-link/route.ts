import { NextRequest, NextResponse } from "next/server";
import { resolveLiveMembership } from "@/app/lib/companyMembershipSession";
import { mapCapabilityGate } from "@/app/lib/requireCapabilitySession";
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

    const gate = mapCapabilityGate(
      await resolveLiveMembership(supabase, user.id),
      "proposal_author"
    );
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, code: gate.denial.code, message: PUBLIC_REVIEW_MINT_ERROR_MESSAGE },
        { status: gate.denial.status }
      );
    }
    const companyId = gate.session.companyId;

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
