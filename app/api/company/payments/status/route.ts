import { NextResponse } from "next/server";
import { getUserCompanyId } from "@/app/lib/ensureUserIdentity";
import { ensureCompanyPaymentSettingsViaRpc } from "@/app/lib/jobPaymentPersistence";
import { createClient } from "@/app/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Compact Payments status from stored FieldDive flags.
 * Does not return Stripe account ids.
 * Does not block the UI on a live Stripe retrieve — Connect POST and the
 * Connect webhook refresh charges_enabled / details_submitted / payouts_enabled.
 */
export async function GET() {
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

    const settings = await ensureCompanyPaymentSettingsViaRpc(supabase, companyId);
    const { data: account } = await supabase
      .from("company_payment_accounts")
      .select("charges_enabled,payouts_enabled,details_submitted,onboarding_status")
      .eq("company_id", companyId)
      .eq("provider", "stripe")
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      connected: Boolean(account),
      chargesEnabled: account?.charges_enabled === true,
      payoutsEnabled: account?.payouts_enabled === true,
      detailsSubmitted: account?.details_submitted === true,
      onboardingStatus: account?.onboarding_status ?? "pending",
      settings: {
        defaultDepositMode: settings.default_deposit_mode ?? "none",
        defaultDepositPercentBps: settings.default_deposit_percent_bps ?? null,
        defaultDepositFixedCents: settings.default_deposit_fixed_cents ?? null,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
