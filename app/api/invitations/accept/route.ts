import { NextResponse } from "next/server";
import {
  acceptInvitationToken,
  acceptMyInvitation,
} from "@/app/lib/invitations/invitationActions.server";
import { decodeInvitationToken } from "@/app/lib/invitations/invitationToken";
import { createClient } from "@/app/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Explicit accept. GET never reaches this handler. The return path is built
 * here from the validated token or invitation id, not from a client URL.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const contentType = request.headers.get("content-type") ?? "";
  let token = "";
  let invitationId = "";
  let requestId: string | null = null;
  if (contentType.includes("application/json")) {
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object") {
        const body = parsed as Record<string, unknown>;
        token = typeof body.token === "string" ? body.token : "";
        invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
        requestId = typeof body.requestId === "string" ? body.requestId : null;
      }
    } catch {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }
  } else {
    const form = await request.formData();
    token = String(form.get("token") ?? "");
    invitationId = String(form.get("invitationId") ?? "");
    const rawRequest = form.get("requestId");
    requestId = typeof rawRequest === "string" && rawRequest ? rawRequest : null;
  }

  const returnPath = decodeInvitationToken(token)
    ? `/join/${token}`
    : UUID.test(invitationId)
      ? `/join/open/${invitationId}`
      : null;
  if (!returnPath) {
    return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  }
  if (!user) {
    return respond(request, contentType, returnPath, { ok: false, code: "unauthorized", companyLabel: null });
  }

  const result = decodeInvitationToken(token)
    ? await acceptInvitationToken(token, requestId)
    : await acceptMyInvitation(invitationId, requestId);
  return respond(request, contentType, returnPath, result);
}

function respond(
  request: Request,
  contentType: string,
  returnPath: string,
  result: { ok: boolean; code: string; companyLabel: string | null }
) {
  if (contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: result.ok, code: result.code },
      {
        status: result.ok
          ? 200
          : result.code === "authorization_unavailable"
            ? 503
            : result.code === "unauthorized"
              ? 401
              : 403,
      }
    );
  }
  const dest = new URL(returnPath, request.url);
  dest.searchParams.set("outcome", result.code);
  return NextResponse.redirect(dest, 303);
}
