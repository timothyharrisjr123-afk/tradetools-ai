import { NextRequest, NextResponse } from "next/server";
import {
  recordJobPaymentProviderEventViaRpc,
  upsertCompanyPaymentAccountFromProviderViaRpc,
} from "@/app/lib/jobPaymentPersistence";
import { verifyStripeConnectWebhook } from "@/app/lib/jobPaymentStripe.server";
import {
  isIgnoredStripeConnectCommand,
  mapStripeConnectEventToCommand,
} from "@/app/lib/jobPaymentWebhookMapper";
import { createAdminClient } from "@/app/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * R3E Stripe Connect webhook. Raw body + signature required.
 * Does not extend legacy /api/payments/webhook.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, code: "missing_signature" }, { status: 400 });
  }

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_body" }, { status: 400 });
  }

  let event;
  try {
    event = verifyStripeConnectWebhook(rawBody, signature);
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_signature" }, { status: 400 });
  }

  const mapped = mapStripeConnectEventToCommand({
    id: event.id,
    type: event.type,
    created: event.created,
    account: "account" in event ? String(event.account ?? "") : null,
    data: { object: event.data.object as unknown as Record<string, unknown> },
  });

  if (isIgnoredStripeConnectCommand(mapped)) {
    return NextResponse.json({ ok: true, ignored: true, type: mapped.type });
  }

  try {
    const admin = createAdminClient();
    if (mapped.account_update) {
      await upsertCompanyPaymentAccountFromProviderViaRpc(admin, {
        companyId: mapped.account_update.company_id,
        providerAccountId: mapped.account_update.provider_account_id,
        chargesEnabled: mapped.account_update.charges_enabled,
        payoutsEnabled: mapped.account_update.payouts_enabled,
        detailsSubmitted: mapped.account_update.details_submitted,
        disabled: mapped.account_update.disabled,
      });
    }

    if (
      mapped.apply_request_status ||
      mapped.transaction_kind ||
      mapped.payment_request_id ||
      mapped.provider_checkout_session_id
    ) {
      await recordJobPaymentProviderEventViaRpc(admin, mapped);
    }

    return NextResponse.json({ ok: true, type: mapped.raw_type });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
