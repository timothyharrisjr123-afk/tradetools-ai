-- FD-P1-06 / A4: operational stage and planned-work schedule convergence.
--
-- jobs.stage is the lifecycle authority. A job_schedules row with
-- kind='work' and status='scheduled' is the retained planned work window.
--
-- Modern operational cardinality (final committed state):
--   intake/proposal/approved → 0 planned
--   scheduled/production/complete → exactly 1 planned
--
-- Legacy-readable non-operational stages (measurement/estimating/archived):
--   preserved rows remain readable; must carry 0 planned schedules;
--   cannot become alternate schedule/lifecycle write paths.
--
-- Cross-table checks are DEFERRABLE so schedule_job_v1 / unschedule_job_v1
-- may perform schedule-row then stage-row statements in one transaction.
--
-- NOTE: do not use top-level LOCK TABLE — supabase db push executes
-- statement-at-a-time outside an explicit transaction block.

-- Canonical baseline already owns same-company schedule/job integrity.
alter table public.job_schedules
  validate constraint job_schedules_job_company_fkey;

do $$
declare
  v_bad_tenant_rows bigint;
  v_bad_cardinality_rows bigint;
begin
  lock table public.jobs in share row exclusive mode;
  lock table public.job_schedules in share row exclusive mode;

  select count(*)
  into v_bad_tenant_rows
  from public.job_schedules s
  left join public.jobs j
    on j.id = s.job_id
   and j.company_id = s.company_id
  where j.id is null;

  if v_bad_tenant_rows <> 0 then
    raise exception 'a4_schedule_job_company_preflight_failed:%', v_bad_tenant_rows
      using errcode = '23503';
  end if;

  select count(*)
  into v_bad_cardinality_rows
  from public.jobs j
  left join lateral (
    select count(*)::integer as planned_count
    from public.job_schedules s
    where s.job_id = j.id
      and s.company_id = j.company_id
      and s.kind = 'work'
      and s.status = 'scheduled'
  ) planned on true
  where case
    when j.stage in (
      'intake', 'proposal', 'approved',
      'measurement', 'estimating', 'archived'
    ) then coalesce(planned.planned_count, 0) <> 0
    when j.stage in ('scheduled', 'production', 'complete')
      then coalesce(planned.planned_count, 0) <> 1
    else true -- invalid / unknown stage tokens fail closed
  end;

  if v_bad_cardinality_rows <> 0 then
    raise exception 'a4_stage_planned_schedule_preflight_failed:%', v_bad_cardinality_rows
      using errcode = '23514',
            hint = 'Run the separately reviewed bounded A4 remediation before this migration.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_indexes i
    where i.schemaname = 'public'
      and i.tablename = 'job_schedules'
      and i.indexname = 'job_schedules_one_active_work'
      and i.indexdef ilike 'create unique index%'
      and i.indexdef like '%(job_id)%'
      and i.indexdef like '%kind%work%'
      and i.indexdef like '%status%scheduled%'
  ) then
    raise exception 'a4_one_planned_schedule_unique_index_missing'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.job_stage_planned_schedule_assert_v1(
  p_job_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_stage text;
  v_planned_count integer;
  v_expected_count integer;
begin
  select j.company_id, j.stage
  into v_company_id, v_stage
  from public.jobs j
  where j.id = p_job_id;

  if not found then
    return;
  end if;

  -- MODERN_OPERATIONAL: exact planned cardinality.
  -- LEGACY_READABLE_NONOPERATIONAL (measurement/estimating/archived): zero planned only.
  -- INVALID: reject.
  v_expected_count := case
    when v_stage in ('intake', 'proposal', 'approved') then 0
    when v_stage in ('scheduled', 'production', 'complete') then 1
    when v_stage in ('measurement', 'estimating', 'archived') then 0
    else null
  end;

  if v_expected_count is null then
    raise exception 'job_stage_planned_schedule_invariant: invalid stage'
      using errcode = '23514',
            detail = format('job_id=%s stage=%s', p_job_id, v_stage);
  end if;

  select count(*)::integer
  into v_planned_count
  from public.job_schedules s
  where s.job_id = p_job_id
    and s.company_id = v_company_id
    and s.kind = 'work'
    and s.status = 'scheduled';

  if v_planned_count <> v_expected_count then
    raise exception 'job_stage_planned_schedule_invariant'
      using errcode = '23514',
            detail = format(
              'job_id=%s company_id=%s stage=%s expected_planned_count=%s actual_planned_count=%s',
              p_job_id, v_company_id, v_stage, v_expected_count, v_planned_count
            );
  end if;
end;
$$;

create or replace function public.jobs_stage_planned_schedule_constraint_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.job_stage_planned_schedule_assert_v1(new.id);
  if tg_op = 'UPDATE' and old.id is distinct from new.id then
    perform public.job_stage_planned_schedule_assert_v1(old.id);
  end if;
  return null;
end;
$$;

create or replace function public.job_schedules_stage_planned_constraint_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'DELETE' then
    perform public.job_stage_planned_schedule_assert_v1(new.job_id);
  end if;
  if tg_op <> 'INSERT'
     and (
       tg_op = 'DELETE'
       or old.job_id is distinct from new.job_id
       or old.company_id is distinct from new.company_id
     )
  then
    perform public.job_stage_planned_schedule_assert_v1(old.job_id);
  end if;
  return null;
end;
$$;

create or replace function public.job_schedules_stage_write_guard_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
begin
  if tg_op = 'DELETE' then
    raise exception 'job_schedules rows cannot be deleted'
      using errcode = '23514';
  end if;

  -- Cancelled rows are immutable historical records (align with
  -- job_schedules_before_write + table comment).
  if tg_op = 'UPDATE' and old.status = 'cancelled' then
    raise exception 'cancelled job_schedules rows are immutable and must not be revived'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and (
       old.job_id is distinct from new.job_id
       or old.company_id is distinct from new.company_id
     )
  then
    raise exception 'job_schedules job/company identity is immutable'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and new.kind = 'work' and new.status = 'scheduled' then
    select j.stage
    into v_stage
    from public.jobs j
    where j.id = new.job_id
      and j.company_id = new.company_id;

    if not found then
      raise exception 'job_schedules job/company relationship is invalid'
        using errcode = '23503';
    end if;

    -- Only Approved may mint a new planned window (schedule_job_v1).
    -- Legacy-readable stages cannot bypass into scheduling.
    if v_stage <> 'approved' then
      raise exception 'planned work may only be created while the job is Approved'
        using errcode = '23514',
              detail = format('job_id=%s stage=%s', new.job_id, v_stage);
    end if;
  end if;

  if tg_op = 'UPDATE' and old.kind = 'work' and old.status = 'scheduled' then
    select j.stage
    into v_stage
    from public.jobs j
    where j.id = old.job_id
      and j.company_id = old.company_id;

    if not found then
      raise exception 'job_schedules job/company relationship is invalid'
        using errcode = '23503';
    end if;

    -- Planned window is mutable only while Scheduled (reschedule/unschedule).
    -- Production/Complete retain the planned row as read-only history.
    if v_stage <> 'scheduled' then
      raise exception 'planned work is read-only outside the Scheduled stage'
        using errcode = '23514',
              detail = format('job_id=%s stage=%s', old.job_id, v_stage);
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.job_schedules_reject_truncate_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'job_schedules cannot be truncated'
    using errcode = '23514';
end;
$$;

drop trigger if exists jobs_stage_planned_schedule_insert_a4 on public.jobs;
create constraint trigger jobs_stage_planned_schedule_insert_a4
after insert on public.jobs
deferrable initially deferred
for each row
execute function public.jobs_stage_planned_schedule_constraint_v1();

drop trigger if exists jobs_stage_planned_schedule_update_a4 on public.jobs;
create constraint trigger jobs_stage_planned_schedule_update_a4
after update of id, company_id, stage on public.jobs
deferrable initially deferred
for each row
execute function public.jobs_stage_planned_schedule_constraint_v1();

drop trigger if exists job_schedules_stage_planned_insert_a4 on public.job_schedules;
create constraint trigger job_schedules_stage_planned_insert_a4
after insert on public.job_schedules
deferrable initially deferred
for each row
execute function public.job_schedules_stage_planned_constraint_v1();

drop trigger if exists job_schedules_stage_planned_update_a4 on public.job_schedules;
create constraint trigger job_schedules_stage_planned_update_a4
after update of job_id, company_id, kind, status on public.job_schedules
deferrable initially deferred
for each row
execute function public.job_schedules_stage_planned_constraint_v1();

drop trigger if exists job_schedules_stage_planned_delete_a4 on public.job_schedules;
create constraint trigger job_schedules_stage_planned_delete_a4
after delete on public.job_schedules
deferrable initially deferred
for each row
execute function public.job_schedules_stage_planned_constraint_v1();

drop trigger if exists job_schedules_stage_write_guard_a4 on public.job_schedules;
create trigger job_schedules_stage_write_guard_a4
before insert or update or delete on public.job_schedules
for each row
execute function public.job_schedules_stage_write_guard_v1();

drop trigger if exists job_schedules_reject_truncate_a4 on public.job_schedules;
create trigger job_schedules_reject_truncate_a4
before truncate on public.job_schedules
for each statement
execute function public.job_schedules_reject_truncate_v1();

-- Generic client transition writer has no supported product caller.
revoke all on function public.transition_job_stage_v1(jsonb) from public;
revoke all on function public.transition_job_stage_v1(jsonb) from anon;
revoke all on function public.transition_job_stage_v1(jsonb) from authenticated;
revoke all on function public.transition_job_stage_v1(jsonb) from service_role;

comment on function public.transition_job_stage_v1(jsonb) is
  'A4 quarantined prototype transition surface. No current application caller; specialized lifecycle RPCs own all reachable stage changes.';

revoke all on function public.job_stage_planned_schedule_assert_v1(uuid) from public;
revoke all on function public.job_stage_planned_schedule_assert_v1(uuid) from anon;
revoke all on function public.job_stage_planned_schedule_assert_v1(uuid) from authenticated;
revoke all on function public.job_stage_planned_schedule_assert_v1(uuid) from service_role;
revoke all on function public.jobs_stage_planned_schedule_constraint_v1() from public;
revoke all on function public.jobs_stage_planned_schedule_constraint_v1() from anon;
revoke all on function public.jobs_stage_planned_schedule_constraint_v1() from authenticated;
revoke all on function public.jobs_stage_planned_schedule_constraint_v1() from service_role;
revoke all on function public.job_schedules_stage_planned_constraint_v1() from public;
revoke all on function public.job_schedules_stage_planned_constraint_v1() from anon;
revoke all on function public.job_schedules_stage_planned_constraint_v1() from authenticated;
revoke all on function public.job_schedules_stage_planned_constraint_v1() from service_role;
revoke all on function public.job_schedules_stage_write_guard_v1() from public;
revoke all on function public.job_schedules_stage_write_guard_v1() from anon;
revoke all on function public.job_schedules_stage_write_guard_v1() from authenticated;
revoke all on function public.job_schedules_stage_write_guard_v1() from service_role;
revoke all on function public.job_schedules_reject_truncate_v1() from public;
revoke all on function public.job_schedules_reject_truncate_v1() from anon;
revoke all on function public.job_schedules_reject_truncate_v1() from authenticated;
revoke all on function public.job_schedules_reject_truncate_v1() from service_role;

revoke insert, update, delete, truncate on table public.job_schedules
  from public, anon, authenticated, service_role;

comment on table public.job_schedules is
  'Canonical planned work-window truth. Scheduled is editable; Production/Complete retain one read-only kind=work status=scheduled row. Cancelled rows are immutable history.';
comment on function public.job_stage_planned_schedule_assert_v1(uuid) is
  'A4 internal final-state assertion. Modern operational stages enforce exact planned cardinality. Legacy-readable measurement/estimating/archived require zero planned rows and cannot mint schedules.';
comment on function public.job_schedules_stage_write_guard_v1() is
  'A4 stage-owned writability guard. Planned work mutable only in Scheduled; Production/Complete plans and cancelled history are read-only; legacy stages cannot create planned work.';
