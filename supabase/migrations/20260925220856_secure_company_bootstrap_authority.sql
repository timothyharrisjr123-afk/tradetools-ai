-- Phase 13 Slice 0A: secure company bootstrap authority.
--
-- Before: ensureUserIdentity inserted companies + company_memberships directly as the
-- authenticated user. companies had no INSERT policy (new users could not bootstrap), and
-- "Users can insert their membership" allowed WITH CHECK (user_id = auth.uid()) for any
-- company_id and any role (cross-tenant owner self-membership).
--
-- After:
-- - bootstrap_current_user_company_v1() is the sole tenant-creation path. It creates one
--   company + one owner membership for auth.uid() in one transaction, serialized per user.
-- - Clients cannot INSERT/DELETE companies or company_memberships.
-- - One membership row per user (current single-company product model; production preflight
--   2026-09-25: 0 users with >1 membership, 0 removed rows, 0 orphan companies).
-- - Removed members are not re-bootstrapped (status 'removed', nothing created).
-- Existing SELECT policies and owner companies UPDATE (Company settings) are unchanged.

create unique index if not exists company_memberships_one_per_user_uidx
  on public.company_memberships (user_id);

create or replace function public.bootstrap_current_user_company_v1()
returns table (company_id uuid, status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_existing_company_id uuid;
  v_existing_removed_at timestamptz;
  v_found boolean := false;
  v_company_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('fielddive.bootstrap_current_user_company_v1:' || v_uid::text, 0)
  );

  select m.company_id, m.removed_at, true
    into v_existing_company_id, v_existing_removed_at, v_found
  from public.company_memberships m
  where m.user_id = v_uid
  limit 1;

  if v_found then
    if v_existing_removed_at is not null then
      return query select null::uuid, 'removed'::text;
      return;
    end if;
    return query select v_existing_company_id, 'existing'::text;
    return;
  end if;

  insert into public.companies (name, owner_user_id)
  values ('My Company', v_uid)
  returning id into v_company_id;

  insert into public.company_memberships (user_id, company_id, role)
  values (v_uid, v_company_id, 'owner');

  return query select v_company_id, 'created'::text;
end;
$$;

alter function public.bootstrap_current_user_company_v1() owner to postgres;

revoke all on function public.bootstrap_current_user_company_v1() from public, anon;
grant execute on function public.bootstrap_current_user_company_v1() to authenticated;

comment on function public.bootstrap_current_user_company_v1() is
  'Sole tenant bootstrap. Requires auth.uid(); per-user advisory xact lock; returns existing live company (existing), refuses removed members (removed), else creates one company + one owner membership atomically (created). Role is set internally.';

drop policy if exists "Users can insert their membership" on public.company_memberships;

revoke insert, delete, truncate, references, trigger on table public.companies from anon, authenticated;
revoke update on table public.companies from anon;

revoke insert, delete, truncate, references, trigger on table public.company_memberships from anon, authenticated;
revoke update on table public.company_memberships from anon;
