-- 062 — legacy payments + subscriptions tenant isolation (SECURITY P0)
-- Forward only. Do not edit historical migrations.
-- 039 remains reserved / absent.
--
-- Closes: public.payments and public.subscriptions RLS disabled +
--         anon/authenticated full CRUD (cross-tenant / anonymous exposure).
-- Does not: migrate legacy payments into job_payment_*, redesign payments,
--           build subscriptions, change Stripe Connect / refunds / lifecycle.
-- Canonical job money remains job_payment_* (untouched).

-- ---------------------------------------------------------------------------
-- A. payments — immutable company_id (blocks authenticated spoof on UPDATE)
-- ---------------------------------------------------------------------------

create or replace function public.payments_prevent_company_id_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'payments.company_id is immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.payments_prevent_company_id_change() from public;
revoke all on function public.payments_prevent_company_id_change() from anon;
revoke all on function public.payments_prevent_company_id_change() from authenticated;
grant execute on function public.payments_prevent_company_id_change() to service_role;

drop trigger if exists payments_prevent_company_id_change on public.payments;
create trigger payments_prevent_company_id_change
  before update on public.payments
  for each row
  execute function public.payments_prevent_company_id_change();

-- ---------------------------------------------------------------------------
-- B. payments — RLS (SELECT + INSERT only; no authenticated UPDATE/DELETE)
-- ---------------------------------------------------------------------------

alter table public.payments enable row level security;

drop policy if exists "payments_select_company_scope" on public.payments;
create policy "payments_select_company_scope"
  on public.payments
  for select
  using (
    company_id is not null
    and company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "payments_insert_company_scope" on public.payments;
create policy "payments_insert_company_scope"
  on public.payments
  for insert
  with check (
    company_id is not null
    and company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- C. payments — grants (least privilege for accepted legacy paths)
-- ---------------------------------------------------------------------------

revoke all on table public.payments from public;
revoke all on table public.payments from anon;
revoke all on table public.payments from authenticated;
grant select, insert on table public.payments to authenticated;
grant all on table public.payments to service_role;

-- ---------------------------------------------------------------------------
-- D. subscriptions — closed by default (no product path)
-- ---------------------------------------------------------------------------

alter table public.subscriptions enable row level security;

-- No authenticated policies. Closed by default under RLS.

revoke all on table public.subscriptions from public;
revoke all on table public.subscriptions from anon;
revoke all on table public.subscriptions from authenticated;
grant all on table public.subscriptions to service_role;
