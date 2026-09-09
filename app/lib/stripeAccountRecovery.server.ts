import "server-only";

import {
  replaceCompanyPaymentAccountViaRpc,
} from "@/app/lib/jobPaymentPersistence";
import { retrieveConnectedAccount } from "@/app/lib/jobPaymentStripe.server";
import { classifyStripeConnectAccountState } from "@/app/lib/jobPaymentWebhookMapper";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type StripeAccountReplacementResult =
  | {
      ok: true;
      idempotentReplay: boolean;
      providerAccountId: string;
    }
  | { ok: false; code: string };

/**
 * Internal replacement boundary. The browser never supplies account truth to
 * the RPC: this server retrieves the exact account through Stripe first, then
 * the service-only RPC atomically compares and swaps canonical ownership.
 */
export async function replaceCompanyStripeAccountAfterProviderValidation(input: {
  companyId: string;
  expectedCurrentProviderAccountId: string | null;
  replacementProviderAccountId: string;
}): Promise<StripeAccountReplacementResult> {
  const live = await retrieveConnectedAccount(input.replacementProviderAccountId);
  if (live.id !== input.replacementProviderAccountId) {
    return { ok: false, code: "provider_account_mismatch" };
  }

  const state = classifyStripeConnectAccountState(
    live as unknown as Record<string, unknown>
  );
  if (state !== "complete") {
    return { ok: false, code: "replacement_not_usable" };
  }

  const result = await replaceCompanyPaymentAccountViaRpc(createAdminClient(), {
    companyId: input.companyId,
    expectedCurrentProviderAccountId: input.expectedCurrentProviderAccountId,
    replacementProviderAccountId: live.id,
    chargesEnabled: live.charges_enabled === true,
    payoutsEnabled: live.payouts_enabled === true,
    detailsSubmitted: live.details_submitted === true,
    disabled: false,
  });
  if (
    result.ok !== true ||
    result.provider_account_id !== live.id ||
    typeof result.idempotent_replay !== "boolean"
  ) {
    return { ok: false, code: String(result.code ?? "replacement_failed") };
  }
  return {
    ok: true,
    idempotentReplay: result.idempotent_replay,
    providerAccountId: live.id,
  };
}
