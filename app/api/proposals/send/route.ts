import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { isUuidLike } from "@/app/lib/uuid";
import { PROPOSAL_EMAIL_SEND_ERROR_MESSAGE } from "@/app/lib/proposalEmailDelivery";
import { sendProposalEmailForContractor } from "@/app/lib/proposalEmailDelivery.server";
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
    const recipientEmail = String(body?.recipientEmail ?? "").trim();
    const subject = String(body?.subject ?? "").trim();
    const messageBody = String(body?.body ?? "").trim();

    if (!isUuidLike(proposalId) || !isUuidLike(jobId)) {
      return NextResponse.json(
        { ok: false, code: "invalid_request", message: PROPOSAL_EMAIL_SEND_ERROR_MESSAGE },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, code: "unauthorized", message: PROPOSAL_EMAIL_SEND_ERROR_MESSAGE },
        { status: 401 }
      );
    }

    const companyId = await getUserCompanyId(supabase, user.id);
    if (!companyId) {
      return NextResponse.json(
        { ok: false, code: "forbidden", message: PROPOSAL_EMAIL_SEND_ERROR_MESSAGE },
        { status: 403 }
      );
    }

    const result = await sendProposalEmailForContractor({
      companyId,
      proposalId,
      jobId,
      userId: user.id,
      recipientEmail,
      subject,
      body: messageBody,
      origin: resolveRequestOrigin(req),
      replyTo: user.email ?? null,
    });

    if (!result.ok) {
      const status =
        result.code === "unauthorized"
          ? 401
          : result.code === "forbidden"
            ? 403
            : result.code === "send_in_progress"
              ? 409
              : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { ok: false, code: "internal_error", message: PROPOSAL_EMAIL_SEND_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}
