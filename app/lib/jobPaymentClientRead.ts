import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { isUuidLike } from "@/app/lib/jobStore";
import type {
  JobPaymentRequestRow,
  JobPaymentTransactionRow,
} from "@/app/lib/jobPaymentReadModel";
import type { CompanyPaymentAccountRow } from "@/app/lib/jobPaymentReadModel";

const REQUEST_COLUMNS =
  "id,company_id,job_id,proposal_id,proposal_version_id,proposal_option_id,proposal_acceptance_id,proposal_signature_id,amount_cents,currency,kind,accepted_total_cents_snapshot,option_label_snapshot,provider_account_id,provider_checkout_session_id,status,requested_at,paid_at,cancelled_at";

const TRANSACTION_COLUMNS =
  "id,payment_request_id,kind,status,amount_cents,occurred_at,provider_event_id";

export async function listJobPaymentRequests(
  jobId: string
): Promise<JobPaymentRequestRow[]> {
  const id = jobId.trim();
  if (!isUuidLike(id)) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("job_payment_requests")
    .select(REQUEST_COLUMNS)
    .eq("job_id", id)
    .order("requested_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as JobPaymentRequestRow[];
}

export async function listJobPaymentTransactionsForRequests(
  requestIds: readonly string[]
): Promise<JobPaymentTransactionRow[]> {
  const ids = requestIds.filter((id) => isUuidLike(id));
  if (ids.length === 0) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("job_payment_transactions")
    .select(TRANSACTION_COLUMNS)
    .in("payment_request_id", ids)
    .order("occurred_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as JobPaymentTransactionRow[];
}

export async function getCompanyPaymentAccount(): Promise<CompanyPaymentAccountRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("company_payment_accounts")
    .select("charges_enabled,onboarding_status,details_submitted,payouts_enabled")
    .eq("provider", "stripe")
    .maybeSingle();
  if (error || !data) return null;
  return data as CompanyPaymentAccountRow;
}

export async function getCompanyPaymentSettings(): Promise<{
  default_deposit_mode: "none" | "percent" | "fixed";
  default_deposit_percent_bps: number | null;
  default_deposit_fixed_cents: number | null;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("company_payment_settings")
    .select(
      "default_deposit_mode,default_deposit_percent_bps,default_deposit_fixed_cents"
    )
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    default_deposit_mode: "none" | "percent" | "fixed";
    default_deposit_percent_bps: number | null;
    default_deposit_fixed_cents: number | null;
  };
}
