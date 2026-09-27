import { NextRequest, NextResponse } from "next/server";
import { requireCapabilitySession } from "@/app/lib/requireCapabilitySession";
import {
  confirmProposalAcceptanceViaRpc,
  ProposalAcceptancePersistenceError,
  ProposalAcceptanceValidationError,
} from "@/app/lib/proposalAcceptancePersistence";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Contractor Approve job — explicit operational approval of a real customer acceptance.
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

    const gated = await requireCapabilitySession(supabase, user.id, "job_approve");
    if (!gated.ok) return gated.response;
    const companyId = gated.session.companyId;

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

    const result = await confirmProposalAcceptanceViaRpc(supabase, {
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
