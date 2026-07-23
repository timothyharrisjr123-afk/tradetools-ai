import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  PROPOSAL_CUSTOMER_REQUEST_REVIEW_STATUSES,
  type ProposalCustomerRequestReviewStatus,
} from "@/app/lib/proposalCustomerRequestPersistence";
import {
  getProposalCustomerRequestsForAuthenticatedContractor,
  updateProposalCustomerRequestStatusForAuthenticatedContractor,
} from "@/app/lib/proposalCustomerRequestReview.server";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

function isReviewStatus(value: unknown): value is ProposalCustomerRequestReviewStatus {
  return (
    typeof value === "string" &&
    (PROPOSAL_CUSTOMER_REQUEST_REVIEW_STATUSES as readonly string[]).includes(value)
  );
}

function httpStatusForReadError(error: string): number {
  if (error === "forbidden") return 403;
  if (error === "missing_proposal_id" || error === "invalid_proposal") return 400;
  return 400;
}

function httpStatusForUpdateError(error: string): number {
  if (error === "unauthorized") return 401;
  if (error === "forbidden") return 403;
  if (error === "not_found") return 404;
  if (error === "invalid_transition" || error === "invalid_status") return 400;
  return 400;
}

export async function GET(req: NextRequest) {
  try {
    const proposalId = req.nextUrl.searchParams.get("proposalId")?.trim() ?? "";
    const jobId = req.nextUrl.searchParams.get("jobId")?.trim() ?? "";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const result = await getProposalCustomerRequestsForAuthenticatedContractor({
      companyId,
      proposalId,
      jobId: jobId.length > 0 ? jobId : undefined,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: httpStatusForReadError(result.error) });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestId =
      typeof body?.requestId === "string" ? body.requestId.trim() : "";
    const proposalId =
      typeof body?.proposalId === "string" ? body.proposalId.trim() : "";
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const status = body?.status;

    if (!requestId || !isReviewStatus(status)) {
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const result = await updateProposalCustomerRequestStatusForAuthenticatedContractor({
      companyId,
      requestId,
      status,
      proposalId: proposalId || undefined,
      jobId: jobId || undefined,
    });

    if (!result.ok) {
      return NextResponse.json(result, {
        status: httpStatusForUpdateError(result.error),
      });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
