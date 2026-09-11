-- FD-P1-04 / A5: jobs.company_id is immutable after canonical creation.
-- Ownership is assigned once by INSERT and may never change.

do $$
declare
  v_company_id_nullable text;
  v_null_company_rows bigint;
  v_missing_company_rows bigint;
begin
  select c.is_nullable into v_company_id_nullable
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'jobs'
    and c.column_name = 'company_id';

  if v_company_id_nullable is distinct from 'NO' then
    raise exception 'a5_jobs_company_id_not_null_preflight_failed'
      using errcode = '23502';
  end if;

  select count(*) into v_null_company_rows
  from public.jobs j where j.company_id is null;

  if v_null_company_rows <> 0 then
    raise exception 'a5_jobs_null_company_preflight_failed:%', v_null_company_rows
      using errcode = '23502';
  end if;

  select count(*) into v_missing_company_rows
  from public.jobs j
  left join public.companies c on c.id = j.company_id
  where c.id is null;

  if v_missing_company_rows <> 0 then
    raise exception 'a5_jobs_missing_company_preflight_failed:%', v_missing_company_rows
      using errcode = '23503';
  end if;
end;
$$;

create or replace function public.jobs_company_id_immutable_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'jobs.company_id is immutable after job creation'
      using errcode = '23514',
            detail = format('job_id=%s', old.id);
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_company_id_immutable_a5 on public.jobs;
create trigger jobs_company_id_immutable_a5
before update of company_id on public.jobs
for each row
execute function public.jobs_company_id_immutable_v1();

-- Defense in depth. Production currently has no table-level UPDATE grant for
-- these roles, so the narrow column revoke is effective without rebuilding the
-- existing safe-column grant matrix.
revoke update (company_id) on table public.jobs
  from public, anon, authenticated, service_role;

do $$
declare
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated', 'service_role']
  loop
    if has_column_privilege(v_role, 'public.jobs', 'company_id', 'UPDATE') then
      raise exception 'a5_jobs_company_id_effective_update_privilege_remains:%', v_role
        using errcode = '42501';
    end if;
  end loop;
end;
$$;

revoke all on function public.jobs_company_id_immutable_v1() from public;
revoke all on function public.jobs_company_id_immutable_v1() from anon;
revoke all on function public.jobs_company_id_immutable_v1() from authenticated;
revoke all on function public.jobs_company_id_immutable_v1() from service_role;

comment on column public.jobs.company_id is
  'Immutable tenant owner assigned at canonical job creation. No application role, including service_role, may change it.';
comment on function public.jobs_company_id_immutable_v1() is
  'A5 null-safe ownership guard. Rejects every jobs.company_id change, independent of RLS, membership, caller privilege, or child-table state.';
