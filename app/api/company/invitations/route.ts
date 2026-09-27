import { NextResponse } from "next/server";
import { issueCompanyInvitation } from "@/app/lib/invitations/invitationActions.server";
import { createClient } from "@/app/lib/supabase/server";

const KEY = /^[A-Za-z0-9._:-]{8,120}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Minimum invitation issue endpoint. Company authority comes from the session
 * inside the database, not from this body. Email is sent only after the
 * invitation transaction returns.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const role = typeof body.role === "string" ? body.role : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  const packages = Array.isArray(body.packages)
    ? body.packages.filter((item): item is string => typeof item === "string")
    : [];
  const jobIds = Array.isArray(body.jobIds)
    ? body.jobIds.filter((item): item is string => typeof item === "string" && UUID.test(item))
    : [];
  if (!KEY.test(idempotencyKey) || !email.trim() || !role.trim()) {
    return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
  }
  if (Array.isArray(body.jobIds) && jobIds.length !== body.jobIds.length) {
    return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
  }

  const result = await issueCompanyInvitation({
    email,
    role,
    packages,
    jobIds,
    idempotencyKey,
  });
  if (!result.ok) {
    const status = result.unavailable ? 503 : result.code === "unauthorized" ? 401 : 403;
    return NextResponse.json({ ok: false, code: result.code }, { status });
  }
  return NextResponse.json({
    ok: true,
    invitationId: result.invitationId,
    delivery: result.delivery,
    message: result.message,
  });
}
