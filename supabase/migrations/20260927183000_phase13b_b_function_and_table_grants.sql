-- Phase 13B-B — function / table grant hardening (§14.10 inventory:
-- docs/phase13b-b-enforcement-inventory.md).
--
-- Supabase default privileges grant EXECUTE on every new public function directly
-- to anon and authenticated; `revoke ... from public` does not remove those grants
-- and CREATE OR REPLACE keeps them (root cause of N13). Grants are narrowed only
-- where the inventory proves them unnecessary for every accepted caller class.

-- 1. Internal SECURITY DEFINER helpers: callers are definer parents only (they run
--    as the function owner), so no client role needs EXECUTE.
--    N13: job_scope_change_author_ok_v1 was a membership oracle for anon/authenticated.
revoke execute on function public.job_scope_change_author_ok_v1(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.job_scope_change_member_ok_v1(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.job_scope_change_lines_json_v1(uuid, uuid) from public, anon, authenticated;
-- Unauthenticated delete+reinsert of scope-change lines for any company.
revoke execute on function public.job_scope_change_replace_lines_v1(uuid, uuid, jsonb) from public, anon, authenticated;
-- Unauthenticated seeding of proposal payment terms for any company.
revoke execute on function public.proposal_payment_terms_seed_from_settings_v1(uuid, uuid, uuid) from public, anon, authenticated;
-- Cross-tenant acceptance option read for any authenticated caller.
revoke execute on function public.proposal_acceptance_contract_option_v1(uuid, uuid) from public, anon, authenticated;

-- 2. Public scope-change token RPCs: token-validated, documented and used as
--    service-role only (app/api/scope-changes/public/[token]/**). The public
--    customer flow is unchanged; direct PostgREST calls were never a product path.
revoke execute on function public.authorize_job_scope_change_v1(jsonb) from public, anon, authenticated;
revoke execute on function public.resolve_job_scope_change_public_access_token_v1(text) from public, anon, authenticated;

-- 3. Employee scope-change RPCs: require auth.uid() (anon always receives
--    unauthorized); authenticated contractors and service_role keep EXECUTE.
revoke execute on function public.create_job_scope_change_v1(jsonb) from public, anon;
revoke execute on function public.update_job_scope_change_draft_v1(jsonb) from public, anon;
revoke execute on function public.propose_job_scope_change_v1(jsonb) from public, anon;
revoke execute on function public.void_job_scope_change_v1(jsonb) from public, anon;
revoke execute on function public.decline_job_scope_change_v1(jsonb) from public, anon;
revoke execute on function public.mint_job_scope_change_public_access_token_v1(jsonb) from public, anon;

-- 4. job_contract_total_cents_v1: anon has no caller; authenticated keeps EXECUTE
--    with the in-body tenant guard added by 20260927181000.
revoke execute on function public.job_contract_total_cents_v1(uuid, uuid) from public, anon;

-- Service role keeps every function above.
grant execute on function public.job_scope_change_author_ok_v1(uuid, uuid) to service_role;
grant execute on function public.job_scope_change_member_ok_v1(uuid, uuid) to service_role;
grant execute on function public.job_scope_change_lines_json_v1(uuid, uuid) to service_role;
grant execute on function public.job_scope_change_replace_lines_v1(uuid, uuid, jsonb) to service_role;
grant execute on function public.proposal_payment_terms_seed_from_settings_v1(uuid, uuid, uuid) to service_role;
grant execute on function public.proposal_acceptance_contract_option_v1(uuid, uuid) to service_role;
grant execute on function public.authorize_job_scope_change_v1(jsonb) to service_role;
grant execute on function public.resolve_job_scope_change_public_access_token_v1(text) to service_role;

-- 5. company_memberships table grants: anon never reads memberships; no UPDATE
--    policy exists and Team writes now go through definer RPCs.
revoke select on table public.company_memberships from anon;
revoke update on table public.company_memberships from authenticated;
