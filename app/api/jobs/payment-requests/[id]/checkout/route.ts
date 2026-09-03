import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { openHostedCheckoutForRequest } from "@/app/lib/jobPaymentCheckout.server";
import { appOriginFromRequest, withPaymentReturnHint } from "@/app/lib/jobPaymentStripe.server";
import {
  PUBLIC_ORIGIN_MISCONFIGURED_CODE,
  PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
  isPublicAppOriginError,
} from "@/app/lib/publicAppOrigin.server";
import { isUuidLike } from "@/app/lib/uuid";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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
    if (!isUuidLike(id)) {
      return NextResponse.json({ ok: false, code: "invalid_payload" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.amountCents != null || body?.amount != null || body?.stripeAccount) {
      return NextResponse.json({ ok: false, code: "amount_tamper" }, { status: 400 });
    }

    const { data: row } = await supabase
      .from("job_payment_requests")
      .select(
        "id,company_id,job_id,kind,status,amount_cents,currency,provider_account_id,provider_checkout_session_id,checkout_generation,proposal_id"
      )
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!row) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    const origin = appOriginFromRequest(req.headers.get("origin"));
    const publicToken =
      typeof body?.publicAccessToken === "string" ? body.publicAccessToken.trim() : "";
    const returnPath = publicToken
      ? `${origin}/p/${encodeURIComponent(publicToken)}`
      : `${origin}/tools/roofing?entry=job-card&job=${row.job_id}`;

    const opened = await openHostedCheckoutForRequest({
      request: {
        id: String(row.id),
        company_id: String(row.company_id),
        job_id: String(row.job_id),
        kind: row.kind as "deposit" | "balance",
        status: String(row.status),
        amount_cents: Number(row.amount_cents),
        currency: String(row.currency),
        provider_account_id: String(row.provider_account_id),
        provider_checkout_session_id: row.provider_checkout_session_id
          ? String(row.provider_checkout_session_id)
          : null,
        checkout_generation: Number(row.checkout_generation ?? 0),
      },
      successUrl: withPaymentReturnHint(returnPath, "pending"),
      cancelUrl: withPaymentReturnHint(returnPath, "cancelled"),
    });

    return NextResponse.json({ ok: true, url: opened.url, reused: opened.reused });
  } catch (error) {
    if (isPublicAppOriginError(error)) {
      console.error("[jobs/payment-requests/checkout]", PUBLIC_ORIGIN_MISCONFIGURED_CODE);
      return NextResponse.json(
        {
          ok: false,
          code: PUBLIC_ORIGIN_MISCONFIGURED_CODE,
          message: PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
        },
        { status: 503 }
      );
    }
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "internal_error";
    const status = code === "already_paid" || code === "not_payable" ? 409 : 500;
    return NextResponse.json({ ok: false, code }, { status });
  }
}
