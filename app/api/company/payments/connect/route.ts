import { NextRequest, NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import {
  upsertCompanyPaymentAccountFromProviderViaRpc,
} from "@/app/lib/jobPaymentPersistence";
import {
  appOriginFromRequest,
  createAccountOnboardingLink,
  createStandardConnectedAccount,
  retrieveConnectedAccount,
} from "@/app/lib/jobPaymentStripe.server";
import {
  PUBLIC_ORIGIN_MISCONFIGURED_CODE,
  PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
  isPublicAppOriginError,
} from "@/app/lib/publicAppOrigin.server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Start or resume Stripe-hosted Connect onboarding for the contractor company.
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

    const { data: existing } = await supabase
      .from("company_payment_accounts")
      .select("provider_account_id,charges_enabled,details_submitted")
      .eq("company_id", companyId)
      .eq("provider", "stripe")
      .maybeSingle();

    let accountId = existing?.provider_account_id
      ? String(existing.provider_account_id)
      : "";

    const admin = createAdminClient();
    if (!accountId) {
      const account = await createStandardConnectedAccount({ companyId });
      accountId = account.id;
      const upserted = await upsertCompanyPaymentAccountFromProviderViaRpc(admin, {
        companyId,
        providerAccountId: account.id,
        chargesEnabled: account.charges_enabled === true,
        payoutsEnabled: account.payouts_enabled === true,
        detailsSubmitted: account.details_submitted === true,
        disabled: false,
      });
      if (upserted.ok !== true) {
        return NextResponse.json(
          { ok: false, code: String(upserted.code ?? "account_conflict") },
          { status: 409 }
        );
      }
    } else {
      const live = await retrieveConnectedAccount(accountId);
      await upsertCompanyPaymentAccountFromProviderViaRpc(admin, {
        companyId,
        providerAccountId: live.id,
        chargesEnabled: live.charges_enabled === true,
        payoutsEnabled: live.payouts_enabled === true,
        detailsSubmitted: live.details_submitted === true,
        disabled: false,
      });
      if (live.charges_enabled) {
        return NextResponse.json({
          ok: true,
          connected: true,
          chargesEnabled: true,
          url: null,
        });
      }
    }

    let origin: string;
    try {
      origin = appOriginFromRequest(req.headers.get("origin"));
    } catch (error) {
      if (isPublicAppOriginError(error)) {
        console.error("[company/payments/connect]", PUBLIC_ORIGIN_MISCONFIGURED_CODE);
        return NextResponse.json(
          {
            ok: false,
            code: PUBLIC_ORIGIN_MISCONFIGURED_CODE,
            message: PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
          },
          { status: 503 }
        );
      }
      throw error;
    }
    const url = await createAccountOnboardingLink({
      accountId,
      returnUrl: `${origin}/tools/settings/payments?connect=return`,
      refreshUrl: `${origin}/tools/settings/payments?connect=refresh`,
    });

    return NextResponse.json({
      ok: true,
      connected: false,
      chargesEnabled: false,
      url,
    });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
