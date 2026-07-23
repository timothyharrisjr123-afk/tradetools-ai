import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  getJobAttentionDetailForAuthenticatedContractor,
  getJobAttentionSummariesForAuthenticatedContractor,
  markDisplayedJobAttentionReadForAuthenticatedContractor,
} from "@/app/lib/jobAttentionRead.server";
import { isUuidLike } from "@/app/lib/jobStore";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

async function authenticatedContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: unauthorized() };
  const companyId = await getUserCompanyId(supabase, user.id);
  if (!companyId) return { ok: false as const, response: forbidden() };
  return { ok: true as const, supabase, user, companyId };
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "unauthorized" },
    { status: 401 }
  );
}

function forbidden() {
  return NextResponse.json(
    { ok: false, error: "forbidden" },
    { status: 403 }
  );
}

function notFound() {
  return NextResponse.json(
    { ok: false, error: "not_found" },
    { status: 404 }
  );
}

export async function GET(req: NextRequest) {
  try {
    const context = await authenticatedContext();
    if (!context.ok) return context.response;

    const jobId = req.nextUrl.searchParams.get("jobId")?.trim() ?? "";
    const requestedAttentionId =
      req.nextUrl.searchParams.get("attentionId")?.trim() ?? "";

    if (!jobId) {
      const result =
        await getJobAttentionSummariesForAuthenticatedContractor(
          context.supabase,
          context.companyId
        );
      return NextResponse.json({
        ok: true,
        summaries: result.summaries,
        pagination: {
          truncated: result.pagination.truncated,
          maxRows: result.pagination.maxRows,
        },
      });
    }

    if (
      !isUuidLike(jobId) ||
      (requestedAttentionId && !isUuidLike(requestedAttentionId))
    ) {
      return notFound();
    }

    const result = await getJobAttentionDetailForAuthenticatedContractor(
      context.supabase,
      {
        companyId: context.companyId,
        userId: context.user.id,
        jobId,
        requestedAttentionId: requestedAttentionId || null,
      }
    );
    if (!result.ok) return notFound();

    return NextResponse.json({
      ok: true,
      items: result.items,
      selectedAttentionId: result.selectedAttentionId,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    const attentionId =
      typeof body?.attentionId === "string" ? body.attentionId.trim() : "";
    if (!isUuidLike(jobId) || !isUuidLike(attentionId)) return notFound();

    const context = await authenticatedContext();
    if (!context.ok) return context.response;

    const result =
      await markDisplayedJobAttentionReadForAuthenticatedContractor(
        context.supabase,
        {
          companyId: context.companyId,
          userId: context.user.id,
          jobId,
          attentionId,
        }
      );
    if (!result.ok) return notFound();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}
