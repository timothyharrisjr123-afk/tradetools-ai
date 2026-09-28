import { NextResponse } from "next/server";
import { resendCompanyInvitation } from "@/app/lib/invitations/invitationActions.server";
import { createClient } from "@/app/lib/supabase/server";

const KEY = /^[A-Za-z0-9._:-]{8,120}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ invitationId: string }> }
) {
  const { invitationId } = await context.params;
  if (!UUID.test(invitationId)) {
    return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
  }
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
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  const expectedGeneration = body.expectedGeneration;
  if (!KEY.test(idempotencyKey) || typeof expectedGeneration !== "number" || !Number.isInteger(expectedGeneration)) {
    return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
  }

  const result = await resendCompanyInvitation({
    invitationId,
    expectedGeneration,
    idempotencyKey,
  });
  if (!result.ok) {
    const status = result.unavailable ? 503 : 403;
    return NextResponse.json({ ok: false, code: result.code }, { status });
  }
  return NextResponse.json({
    ok: true,
    invitationId: result.invitationId,
    delivery: result.delivery,
    message: result.message,
    generation: typeof result.generation === "number" ? result.generation : null,
    expiresAt: typeof result.expiresAt === "string" ? result.expiresAt : null,
  });
}
