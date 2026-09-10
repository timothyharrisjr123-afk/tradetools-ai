-- FD-P1-02 phase 2: enforce unique estimate claims and same-company links.
--
-- Apply only after the bounded production remediation script has cleared the
-- losing latest_estimate_id claim for the one known duplicate-birth pair.

do $$
begin
  if exists (
    select 1
    from public.jobs j
    where nullif(btrim(j.latest_estimate_id), '') is not null
    group by j.company_id, btrim(j.latest_estimate_id)
    having count(*) > 1
  ) then
    raise exception 'duplicate_latest_estimate_id_claims_require_remediation'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.estimates e
    left join public.jobs j
      on j.id = e.job_id
     and j.company_id = e.company_id
    where e.job_id is not null
      and (e.company_id is null or j.id is null)
  ) then
    raise exception 'cross_company_or_orphan_estimate_job_links_require_remediation'
      using errcode = '23503';
  end if;
end;
$$;

create unique index if not exists idx_jobs_company_latest_estimate_unique
  on public.jobs (company_id, btrim(latest_estimate_id))
  where nullif(btrim(latest_estimate_id), '') is not null;

alter table public.estimates
  drop constraint if exists estimates_job_id_fkey;

alter table public.estimates
  add constraint estimates_job_company_fkey
  foreign key (job_id, company_id)
  references public.jobs (id, company_id)
  match simple
  on delete set null (job_id);

alter table public.estimates
  add constraint estimates_link_requires_company_check
  check (job_id is null or company_id is not null);

create or replace function public.estimates_company_id_immutable_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'estimate_company_id_immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.estimates_company_id_immutable_v1() from public, anon, authenticated;
grant execute on function public.estimates_company_id_immutable_v1() to service_role;

drop trigger if exists estimates_company_id_immutable_v1 on public.estimates;
create trigger estimates_company_id_immutable_v1
before update of company_id on public.estimates
for each row
execute function public.estimates_company_id_immutable_v1();

comment on constraint estimates_job_company_fkey on public.estimates
is 'FD-P1-02: an estimate may link only to a job in the same company; multiple estimates may link to one job.';
