import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  acknowledgeProposalAcceptanceViaRpc,
  ProposalAcceptancePersistenceError,
  ProposalAcceptanceValidationError,
} from "@/app/lib/proposalAcceptancePersistence";
import { isUuidLike } from "@/app/lib/jobStore";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Contractor Acknowledge — resolve later-acceptance Attention after Job has
 * progressed beyond Proposal (Approved, Scheduled, Production, or Complete).
 * Does not Approve job and does not set confirmed_at.
 */
export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const acceptanceId =
      typeof body?.acceptanceId === "string" ? body.acceptanceId.trim() : "";

    if (!isUuidLike(jobId) || !isUuidLike(acceptanceId)) {
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }

    const result = await acknowledgeProposalAcceptanceViaRpc(supabase, {
      companyId,
      jobId,
      acceptanceId,
    });

    if (!result.ok) {
      const status =
        result.code === "not_found"
          ? 404
          : result.code === "forbidden"
            ? 403
            : result.code === "unauthorized"
              ? 401
              : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProposalAcceptanceValidationError) {
      return NextResponse.json(
        { ok: false, code: "invalid_payload" },
        { status: 400 }
      );
    }
    if (error instanceof ProposalAcceptancePersistenceError) {
      return NextResponse.json(
        { ok: false, code: "internal_error" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
