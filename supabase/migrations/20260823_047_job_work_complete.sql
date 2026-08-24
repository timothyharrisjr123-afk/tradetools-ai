-- FieldDive R3H — guarded Complete job / Job completion truth
-- CORE SOURCE ONLY — DO NOT APPLY REMOTELY IN THIS PASS.
--
-- Locked ownership:
--   - jobs.completed_at is immutable actual Job-completion truth.
--   - complete_job_work_v1 alone owns Production -> Complete.
--   - job_schedules remains unchanged historical planned-work truth.
--   - jobs.stage controls whether scheduling is writable.
--   - transition_job_stage_v1 remains unable to mint Complete.
--   - 039 remains absent / reserved; migrations 038-046 are historical.

-- ---------------------------------------------------------------------------
-- 1. Durable actual-completion truth
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column if not exists completed_at timestamptz null;

comment on column public.jobs.completed_at is
  'R3H immutable actual Job-completion instant. Stamped by complete_job_work_v1 from DB transaction time; never schedule/browser/payment time.';

do $$
begin
  if exists (
    select 1
    from public.jobs j
    where (
      j.stage = 'complete'
      and (
        j.completed_at is null
        or j.production_started_at is null
        or j.completed_at < j.production_started_at
      )
    ) or (
      j.stage is distinct from 'complete'
      and j.completed_at is not null
    )
  ) then
    raise exception
      'R3H pre-apply integrity failure: complete jobs require audited completed_at truth'
      using errcode = 'P0001';
  end if;
end;
$$;

alter table public.jobs
  drop constraint if exists jobs_completed_at_stage_check;

alter table public.jobs
  add constraint jobs_completed_at_stage_check
  check (
    (
      stage = 'complete'
      and completed_at is not null
      and production_started_at is not null
      and completed_at >= production_started_at
    )
    or
    (
      stage is distinct from 'complete'
      and completed_at is null
    )
  );

-- Complements 038 stage GUC and 046 production-start GUC. This GUC is the
-- one-time Complete stamp only. It does not weaken existing guards.
create or replace function public.jobs_job_complete_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow_complete boolean :=
    current_setting('job_lifecycle.allow_job_complete_write', true) = '1';
begin
  if tg_op = 'INSERT' then
    if new.completed_at is not null then
      raise exception 'new jobs cannot have completed_at'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.completed_at is distinct from old.completed_at then
    if old.completed_at is not null then
      raise exception 'jobs.completed_at is immutable'
        using errcode = 'P0001';
    end if;

    if not v_allow_complete then
      raise exception 'jobs.completed_at may only be set by complete_job_work_v1'
        using errcode = 'P0001';
    end if;

    if old.stage is distinct from 'production'
       or new.stage is distinct from 'complete'
       or new.completed_at is null
       or new.production_started_at is null
       or new.completed_at < new.production_started_at
    then
      raise exception 'jobs.completed_at requires Production -> Complete'
        using errcode = 'P0001';
    end if;
  end if;

  if (
    new.stage = 'complete'
    and (
      new.completed_at is null
      or new.production_started_at is null
      or new.completed_at < new.production_started_at
    )
  ) or (
    new.stage is distinct from 'complete'
    and new.completed_at is not null
  ) then
    raise exception 'jobs.stage and completed_at are inconsistent'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_job_complete_guard on public.jobs;
create trigger jobs_job_complete_guard
  before insert or update of stage, completed_at, production_started_at on public.jobs
  for each row
  execute function public.jobs_job_complete_guard();

revoke all on function public.jobs_job_complete_guard() from public;
revoke all on function public.jobs_job_complete_guard() from anon;
revoke all on function public.jobs_job_complete_guard() from authenticated;
grant execute on function public.jobs_job_complete_guard() to service_role;

revoke update (completed_at) on table public.jobs from public;
revoke update (completed_at) on table public.jobs from anon;
revoke update (completed_at) on table public.jobs from authenticated;
revoke update (completed_at) on table public.jobs from service_role;

-- ---------------------------------------------------------------------------
-- 2. Durable system-owned Work completed Activity
-- ---------------------------------------------------------------------------

alter table public.job_activity_events
  drop constraint if exists job_activity_events_type_check;

alter table public.job_activity_events
  add constraint job_activity_events_type_check
  check (
    event_type in (
      'job_created',
      'stage_changed',
      'disposition_changed',
      'job_scheduled',
      'job_rescheduled',
      'job_unscheduled',
      'job_work_started',
      'job_work_completed'
    )
  );

create or replace function public.record_job_activity_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event_type text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  v_event_type := nullif(p_payload->>'event_type', '');
  if v_event_type is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_event_type in (
    'job_created',
    'stage_changed',
    'disposition_changed',
    'job_scheduled',
    'job_rescheduled',
    'job_unscheduled',
    'job_work_started',
    'job_work_completed'
  ) then
    return jsonb_build_object('ok', false, 'code', 'event_type_reserved');
  end if;

  return jsonb_build_object('ok', false, 'code', 'invalid_event_type');
end;
$$;

revoke all on function public.record_job_activity_v1(jsonb) from public;
revoke all on function public.record_job_activity_v1(jsonb) from anon;
revoke all on function public.record_job_activity_v1(jsonb) from authenticated;
grant execute on function public.record_job_activity_v1(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3. complete_job_work_v1 — sole Production -> Complete owner
-- ---------------------------------------------------------------------------

create or replace function public.complete_job_work_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_job public.jobs%rowtype;
  v_schedule public.job_schedules%rowtype;
  v_from text;
  v_planned_count integer := 0;
  v_now timestamptz := transaction_timestamp();
  v_activity_id uuid;
  v_stage_activity_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from = 'complete' and (
    v_job.completed_at is null
    or v_job.production_started_at is null
    or v_job.completed_at < v_job.production_started_at
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'complete_work_integrity_error',
      'from_stage', v_from,
      'to_stage', 'complete'
    );
  end if;

  if v_from <> 'production' and v_from <> 'complete' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'complete'
    );
  end if;

  if v_from = 'production' and v_job.status <> 'active' then
    return jsonb_build_object(
      'ok', false,
      'code', 'disposition_blocks_complete',
      'from_stage', v_from,
      'to_stage', 'complete',
      'disposition', v_job.status
    );
  end if;

  if v_from = 'production' and v_job.production_started_at is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'complete_work_integrity_error',
      'from_stage', v_from,
      'to_stage', 'complete'
    );
  end if;

  -- Exactly one canonical planned work schedule. status='scheduled' is planned
  -- historical truth after Production/Complete; jobs.stage owns writability.
  select count(*)::integer
  into v_planned_count
  from public.job_schedules s
  where s.company_id = v_company_id
    and s.job_id = v_job_id
    and s.kind = 'work'
    and s.status = 'scheduled';

  if v_planned_count <> 1 then
    return jsonb_build_object(
      'ok', false,
      'code', 'complete_work_schedule_integrity_error',
      'from_stage', v_from,
      'to_stage', 'complete',
      'planned_schedule_count', v_planned_count
    );
  end if;

  select s.*
  into v_schedule
  from public.job_schedules s
  where s.company_id = v_company_id
    and s.job_id = v_job_id
    and s.kind = 'work'
    and s.status = 'scheduled'
  for update;

  if v_from = 'complete' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job.id,
      'from_stage', v_from,
      'to_stage', 'complete',
      'completed_at', v_job.completed_at,
      'production_started_at', v_job.production_started_at,
      'stage_entered_at', v_job.stage_entered_at,
      'disposition_unchanged', v_job.status,
      'schedule', public.job_schedule_row_json(v_schedule),
      'activity_id', null,
      'stage_activity_id', null,
      'job', jsonb_build_object(
        'id', v_job.id,
        'company_id', v_job.company_id,
        'stage', 'complete',
        'status', v_job.status,
        'completed_at', v_job.completed_at,
        'production_started_at', v_job.production_started_at,
        'stage_entered_at', v_job.stage_entered_at
      )
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);
  perform set_config('job_lifecycle.allow_job_complete_write', '1', true);

  update public.jobs
  set
    stage = 'complete',
    completed_at = v_now,
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'job_work_completed',
    v_uid,
    jsonb_build_object(
      'completed_at', v_now,
      'production_started_at', v_job.production_started_at,
      'schedule_id', v_schedule.id,
      'planned_window', public.job_schedule_window_json(
        v_schedule.all_day,
        v_schedule.starts_on,
        v_schedule.ends_on,
        v_schedule.start_local_time,
        v_schedule.end_local_time,
        v_schedule.timezone,
        v_schedule.notes
      )
    ),
    v_now
  );

  v_stage_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'stage_changed',
    v_uid,
    jsonb_build_object(
      'from_stage', v_from,
      'to_stage', 'complete',
      'reason', 'work_completed',
      'schedule_id', v_schedule.id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job.id,
    'from_stage', v_from,
    'to_stage', 'complete',
    'completed_at', v_now,
    'production_started_at', v_job.production_started_at,
    'stage_entered_at', v_now,
    'disposition_unchanged', v_job.status,
    'schedule', public.job_schedule_row_json(v_schedule),
    'activity_id', v_activity_id,
    'stage_activity_id', v_stage_activity_id,
    'job', jsonb_build_object(
      'id', v_job.id,
      'company_id', v_job.company_id,
      'stage', 'complete',
      'status', v_job.status,
      'completed_at', v_now,
      'production_started_at', v_job.production_started_at,
      'stage_entered_at', v_now
    )
  );
end;
$$;

revoke all on function public.complete_job_work_v1(jsonb) from public;
revoke all on function public.complete_job_work_v1(jsonb) from anon;
grant execute on function public.complete_job_work_v1(jsonb) to authenticated;
grant execute on function public.complete_job_work_v1(jsonb) to service_role;

comment on function public.complete_job_work_v1(jsonb) is
  'R3H sole Production -> Complete writer. Requires one canonical planned work schedule, stamps immutable completed_at and Complete stage_entered_at from one DB transaction time, preserves production_started_at/schedule/payment/signature/disposition, and is idempotent under Job locking.';
