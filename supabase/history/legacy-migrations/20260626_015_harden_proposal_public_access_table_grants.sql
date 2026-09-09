-- R18C2A follow-up — Harden table-level grants on public access token tables (REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL).
--
-- Follows manual apply of 20260626_014_create_proposal_public_access_tables.sql.
-- On legacy Supabase projects, new public-schema tables may inherit default
-- SELECT/INSERT/UPDATE/DELETE grants to anon/authenticated via PUBLIC or
-- default privileges. R18C2A intended authenticated SELECT-only at the grant
-- layer; this migration enforces that after table creation.
--
-- Public customer access will use server-side controlled RPC later (R18C2B+).
-- No anon table access. Authenticated contractor/admin access is SELECT-only
-- and RLS company-scoped via company_memberships.
--
-- NOT APPLIED: staged for manual review on configured Supabase project after explicit approval.
-- No INSERT/UPDATE/DELETE policies. No RPCs. No public route/token minting.
-- No Send/PDF/Sign/Payment/lifecycle behavior.
--
-- service_role: not modified here. Supabase service_role bypasses RLS and uses
-- owner-level table access for server-side RPC persistence (R18C2B/R18C3).

-- ---------------------------------------------------------------------------
-- 1. Revoke broad table privileges — proposal_public_access_tokens
-- ---------------------------------------------------------------------------

revoke all on table public.proposal_public_access_tokens from public;
revoke all on table public.proposal_public_access_tokens from anon;
revoke all on table public.proposal_public_access_tokens from authenticated;

grant select on table public.proposal_public_access_tokens to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Revoke broad table privileges — proposal_customer_activity
-- ---------------------------------------------------------------------------

revoke all on table public.proposal_customer_activity from public;
revoke all on table public.proposal_customer_activity from anon;
revoke all on table public.proposal_customer_activity from authenticated;

grant select on table public.proposal_customer_activity to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Recreate SELECT policies with explicit TO authenticated
-- ---------------------------------------------------------------------------

drop policy if exists "proposal_public_access_tokens_select_company_scope"
  on public.proposal_public_access_tokens;
create policy "proposal_public_access_tokens_select_company_scope"
  on public.proposal_public_access_tokens
  for select
  to authenticated
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_customer_activity_select_company_scope"
  on public.proposal_customer_activity;
create policy "proposal_customer_activity_select_company_scope"
  on public.proposal_customer_activity
  for select
  to authenticated
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- Append-only / mint-revoke writes remain deferred to R18C2B/R18C3 service_role RPCs.
-- No INSERT/UPDATE/DELETE policies on either table.
