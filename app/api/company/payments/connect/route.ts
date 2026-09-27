import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/app/lib/access/requireAccess";
import {
  upsertCompanyPaymentAccountFromProviderViaRpc,
} from "@/app/lib/jobPaymentPersistence";
import {
  appOriginFromRequest,
  createAccountOnboardingLink,
  createStandardConnectedAccount,
  findStandardConnectedAccountForOperation,
  retrieveConnectedAccount,
} from "@/app/lib/jobPaymentStripe.server";
import {
  PUBLIC_ORIGIN_MISCONFIGURED_CODE,
  PUBLIC_ORIGIN_MISCONFIGURED_MESSAGE,
  isPublicAppOriginError,
} from "@/app/lib/publicAppOrigin.server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";
import { isConfirmedAccountPersistence } from "@/app/lib/stripeConnectPersistenceContract";
import { classifyStripeConnectAccountState } from "@/app/lib/jobPaymentWebhookMapper";
import { replaceCompanyStripeAccountAfterProviderValidation } from "@/app/lib/stripeAccountRecovery.server";
import {
  createOrRecoverStripeAccount,
  stripeConnectOperationToken,
} from "@/app/lib/stripeIdempotentCreation";
import { stripeMutationErrorIsAmbiguous } from "@/app/lib/stripeMutationSafety";

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

    const gated = await requireAccess(
      supabase,
      user.id,
      "payments.configure"
    );
    if (!gated.ok) return gated.response;
    const companyId = gated.session.companyId;

    const [existingResult, predecessorResult, candidateResult] = await Promise.all([
      supabase
        .from("company_payment_accounts")
        .select("provider_account_id,charges_enabled,details_submitted")
        .eq("company_id", companyId)
        .eq("provider", "stripe")
        .eq("is_current", true)
        .maybeSingle(),
      supabase
        .from("company_payment_accounts")
        .select("provider_account_id")
        .eq("company_id", companyId)
        .eq("provider", "stripe")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("company_payment_accounts")
        .select("provider_account_id,charges_enabled,details_submitted")
        .eq("company_id", companyId)
        .eq("provider", "stripe")
        .eq("is_current", false)
        .eq("connection_status", "active")
        .maybeSingle(),
    ]);
    if (existingResult.error || candidateResult.error || predecessorResult.error) {
      return NextResponse.json(
        { ok: false, code: "payment_account_lookup_failed" },
        { status: 503 }
      );
    }
    const existing = existingResult.data;
    const candidate = candidateResult.data;
    const predecessor = predecessorResult.data;

    const accountIsCurrent = Boolean(existing?.provider_account_id);
    const resumable = existing ?? candidate;

    let accountId = resumable?.provider_account_id
      ? String(resumable.provider_account_id)
      : "";

    const admin = createAdminClient();
    if (!accountId) {
      const operationToken = stripeConnectOperationToken({
        companyId,
        predecessorProviderAccountId: predecessor?.provider_account_id
          ? String(predecessor.provider_account_id)
          : null,
      });
      const created = await createOrRecoverStripeAccount({
        operationToken,
        findExisting: () =>
          findStandardConnectedAccountForOperation({ companyId, operationToken }),
        create: () => createStandardConnectedAccount({ companyId, operationToken }),
        isAmbiguous: stripeMutationErrorIsAmbiguous,
      });
      const account = created.account;
      accountId = account.id;
      const accountState = classifyStripeConnectAccountState(
        account as unknown as Record<string, unknown>
      );
      const upserted = await upsertCompanyPaymentAccountFromProviderViaRpc(admin, {
        companyId,
        providerAccountId: account.id,
        chargesEnabled: account.charges_enabled === true,
        payoutsEnabled: account.payouts_enabled === true,
        detailsSubmitted: account.details_submitted === true,
        disabled: accountState === "disabled",
      });
      if (upserted.ok !== true) {
        return NextResponse.json(
          { ok: false, code: String(upserted.code ?? "account_conflict") },
          { status: 409 }
        );
      }
    } else {
      const live = await retrieveConnectedAccount(accountId);
      const accountState = classifyStripeConnectAccountState(
        live as unknown as Record<string, unknown>
      );
      const persisted = await upsertCompanyPaymentAccountFromProviderViaRpc(admin, {
        companyId,
        providerAccountId: live.id,
        chargesEnabled: live.charges_enabled === true,
        payoutsEnabled: live.payouts_enabled === true,
        detailsSubmitted: live.details_submitted === true,
        disabled: accountState === "disabled",
      });
      if (!isConfirmedAccountPersistence(persisted, live.id)) {
        return NextResponse.json(
          {
            ok: false,
            code: "payment_account_refresh_failed",
            message: "We couldn't refresh your Stripe connection. Please try again.",
          },
          { status: 503 }
        );
      }
      if (live.charges_enabled) {
        if (!accountIsCurrent) {
          const replacement =
            await replaceCompanyStripeAccountAfterProviderValidation({
              companyId,
              expectedCurrentProviderAccountId: null,
              replacementProviderAccountId: live.id,
            });
          if (!replacement.ok) {
            return NextResponse.json(
              { ok: false, code: replacement.code },
              { status: 409 }
            );
          }
        }
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
