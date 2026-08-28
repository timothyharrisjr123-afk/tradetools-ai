import { NextRequest, NextResponse } from "next/server";
import {
  recordJobPaymentRefundEventViaRpc,
  recordJobPaymentProviderEventViaRpc,
  upsertCompanyPaymentAccountFromProviderViaRpc,
} from "@/app/lib/jobPaymentPersistence";
import {
  listDirectChargeRefunds,
  verifyStripeConnectWebhook,
} from "@/app/lib/jobPaymentStripe.server";
import {
  isIgnoredStripeConnectCommand,
  mapStripeRefundObjectToCommand,
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

    if (mapped.refund_event) {
      const recorded = await recordJobPaymentRefundEventViaRpc(admin, mapped.refund_event);
      if (!recorded.ok) throw new Error(`refund_event_${recorded.code}`);
    }

    if (mapped.reconcile_charge_refunds) {
      const signal = mapped.reconcile_charge_refunds;
      const audit = await recordJobPaymentRefundEventViaRpc(admin, {
        ...signal,
        provider_refund_id: null,
        metadata_refund_command_id: null,
        amount_cents: null,
        status: null,
        provider_reason_code: null,
        provider_reason_message: null,
        provider_created_at: null,
      });
      if (!audit.ok) throw new Error(`refund_audit_${audit.code}`);

      if (signal.provider_account_id && signal.provider_charge_id) {
        const refunds = await listDirectChargeRefunds({
          connectedAccountId: signal.provider_account_id,
          chargeId: signal.provider_charge_id,
        });
        for (const refund of refunds) {
          const recorded = await recordJobPaymentRefundEventViaRpc(
            admin,
            mapStripeRefundObjectToCommand({
              object: refund as unknown as Record<string, unknown>,
              providerEventId: `${signal.provider_event_id}:${refund.id}`,
              rawType: "charge.refunded.refund",
              eventCreated: event.created,
              connectedAccountId: signal.provider_account_id,
            })
          );
          if (!recorded.ok) throw new Error(`refund_reconcile_${recorded.code}`);
        }
      }
    }

    if (
      !mapped.refund_event &&
      !mapped.reconcile_charge_refunds &&
      (mapped.apply_request_status ||
        mapped.transaction_kind ||
        mapped.payment_request_id ||
        mapped.provider_checkout_session_id)
    ) {
      await recordJobPaymentProviderEventViaRpc(admin, mapped);
    }

    return NextResponse.json({ ok: true, type: mapped.raw_type });
  } catch {
    return NextResponse.json({ ok: false, code: "internal_error" }, { status: 500 });
  }
}
