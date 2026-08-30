-- 060 — customers tenant isolation (SECURITY P0)
-- Forward only. Do not edit historical migrations.
-- 039 remains reserved / absent.
--
-- Closes: public.customers RLS disabled + anon/public full privileges
--         allowed cross-company (and anonymous) row access.
-- Does not: add Property, CRM home, intake reuse, merge,
--           contacts, search, communication, or identity redesign.
-- FK unchanged: jobs.customer_id references customers(id) on delete set null.

-- ---------------------------------------------------------------------------
-- A. Immutable company_id (blocks authenticated company_id spoof on UPDATE)
-- ---------------------------------------------------------------------------

create or replace function public.customers_prevent_company_id_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'customers.company_id is immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.customers_prevent_company_id_change() from public;
revoke all on function public.customers_prevent_company_id_change() from anon;
revoke all on function public.customers_prevent_company_id_change() from authenticated;
grant execute on function public.customers_prevent_company_id_change() to service_role;

drop trigger if exists customers_prevent_company_id_change on public.customers;
create trigger customers_prevent_company_id_change
  before update on public.customers
  for each row
  execute function public.customers_prevent_company_id_change();

-- ---------------------------------------------------------------------------
-- B. RLS — company membership only. Broad always-true policies are forbidden.
-- ---------------------------------------------------------------------------

alter table public.customers enable row level security;

drop policy if exists "customers_select_company_scope" on public.customers;
create policy "customers_select_company_scope"
  on public.customers
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "customers_insert_company_scope" on public.customers;
create policy "customers_insert_company_scope"
  on public.customers
  for insert
  with check (
    company_id is not null
    and company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "customers_update_company_scope" on public.customers;
create policy "customers_update_company_scope"
  on public.customers
  for update
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  )
  with check (
    company_id is not null
    and company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "customers_delete_company_scope" on public.customers;
create policy "customers_delete_company_scope"
  on public.customers
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- C. Grants — revoke unsafe PUBLIC/anon; keep authenticated product paths
-- ---------------------------------------------------------------------------

revoke all on table public.customers from public;
revoke all on table public.customers from anon;
revoke all on table public.customers from authenticated;
grant select, insert, update, delete on table public.customers to authenticated;
grant all on table public.customers to service_role;
