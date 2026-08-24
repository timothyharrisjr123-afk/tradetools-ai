import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { isUuidLike } from "@/app/lib/uuid";
import { createPublicProposalReviewLinkForContractor } from "@/app/lib/proposalPublicReviewLink.server";
import { PUBLIC_REVIEW_MINT_ERROR_MESSAGE } from "@/app/lib/proposalPublicReviewReadiness";
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
      origin: resolveRequestOrigin(req),
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
