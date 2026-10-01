import { NextResponse } from "next/server";
import { issueCompanyInvitation } from "@/app/lib/invitations/invitationActions.server";
import { createClient } from "@/app/lib/supabase/server";

const KEY = /^[A-Za-z0-9._:-]{8,120}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID_CODES = new Set(["invalid_email", "person_required", "invalid_person_name"]);
const CONFLICT_CODES = new Set([
  "invitation_pending",
  "recipient_membership_exists",
  "idempotency_conflict",
  "person_not_found",
  "person_unavailable",
  "person_already_linked",
]);

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
  const personId = typeof body.personId === "string" ? body.personId : null;
  const personName = typeof body.name === "string" ? body.name.trim() : "";
  if ((personId === null) === (personName === "")) {
    return NextResponse.json({ ok: false, code: "person_required" }, { status: 400 });
  }
  if (personId !== null && !UUID.test(personId)) {
    return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
  }

  const result = await issueCompanyInvitation({
    email,
    role,
    packages,
    jobIds,
    idempotencyKey,
    person: personId !== null ? { personId } : { personName },
  });
  if (!result.ok) {
    const status = result.unavailable
      ? 503
      : result.code === "unauthorized"
        ? 401
        : INVALID_CODES.has(result.code)
          ? 400
          : CONFLICT_CODES.has(result.code)
            ? 409
            : 403;
    return NextResponse.json({ ok: false, code: result.code }, { status });
  }
  return NextResponse.json({
    ok: true,
    invitationId: result.invitationId,
    delivery: result.delivery,
    message: result.message,
    generation: typeof result.generation === "number" ? result.generation : null,
    expiresAt: typeof result.expiresAt === "string" ? result.expiresAt : null,
    personId: result.personId ?? null,
  });
}
