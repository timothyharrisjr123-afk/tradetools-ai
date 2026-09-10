-- FD-P0-01 / FD-P1-08: retire public.payments as a live money writer.
--
-- Historical rows remain intact and company-scoped SELECT remains available.
-- Canonical live money authority is public.job_payment_*.
-- service_role deliberately retains maintenance access; application routes must
-- not use it to write this retained historical table.

drop policy if exists "payments_insert_company_scope" on public.payments;

revoke insert on table public.payments from public;
revoke insert on table public.payments from anon;
revoke insert on table public.payments from authenticated;

-- Restate the intended retained read contract explicitly. No historical row is
-- rewritten and no current-money write privilege is granted.
alter table public.payments enable row level security;

drop policy if exists "payments_select_company_scope" on public.payments;
create policy "payments_select_company_scope"
  on public.payments
  for select
  to authenticated
  using (
    company_id is not null
    and company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

grant select on table public.payments to authenticated;

