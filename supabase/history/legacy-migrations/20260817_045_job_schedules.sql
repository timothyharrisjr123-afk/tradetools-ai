-- R3F — Job work schedules + company timezone.
-- REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT LIVE-APPLY APPROVAL.
--
-- Number 045 is next after 044 (Job Payments). 039 remains absent / reserved.
-- This migration does NOT:
--   - edit 038–044 in place
--   - add jobs.scheduled_at
--   - create calendar_events
--   - enable generic transition_job_stage_v1 to mint Scheduled
--   - implement crew, Google Calendar, notifications, or public schedule
--   - auto-start Production or Complete
--   - globally backfill companies.timezone

begin;

-- ---------------------------------------------------------------------------
-- 1. companies.timezone — IANA, nullable until explicitly configured
-- ---------------------------------------------------------------------------

alter table public.companies
  add column if not exists timezone text null;

comment on column public.companies.timezone is
  'IANA timezone for operational scheduling. Null until the contractor saves one. '
  'Never inferred from browser locale. job_schedules copies this value at insert.';

create or replace function public.job_schedule_is_iana_timezone(p_tz text)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_tz is not null
    and length(trim(p_tz)) > 0
    and exists (
      select 1
      from pg_timezone_names n
      where n.name = trim(p_tz)
    );
$$;

revoke all on function public.job_schedule_is_iana_timezone(text) from public;
revoke all on function public.job_schedule_is_iana_timezone(text) from anon;
grant execute on function public.job_schedule_is_iana_timezone(text) to authenticated;
grant execute on function public.job_schedule_is_iana_timezone(text) to service_role;

create or replace function public.companies_timezone_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.timezone is not null then
    new.timezone := trim(new.timezone);
    if new.timezone = '' then
      new.timezone := null;
    elsif not public.job_schedule_is_iana_timezone(new.timezone) then
      raise exception 'companies.timezone must be a valid IANA timezone'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_timezone_guard on public.companies;
create trigger companies_timezone_guard
  before insert or update of timezone on public.companies
  for each row
  execute function public.companies_timezone_guard();

revoke all on function public.companies_timezone_guard() from public;
revoke all on function public.companies_timezone_guard() from anon;
revoke all on function public.companies_timezone_guard() from authenticated;
grant execute on function public.companies_timezone_guard() to service_role;

-- ---------------------------------------------------------------------------
-- 2. Activity types — durable schedule facts (system-owned)
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
      'job_unscheduled'
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
    'job_unscheduled'
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
-- 3. job_schedules — canonical work-schedule owner
-- ---------------------------------------------------------------------------

create table if not exists public.job_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  job_id uuid not null,
  kind text not null default 'work',
  status text not null default 'scheduled',
  timezone text not null,
  all_day boolean not null default true,
  starts_on date not null,
  ends_on date not null,
  start_local_time time null,
  end_local_time time null,
  range_start_at timestamptz not null,
  range_end_at timestamptz not null,
  notes text null,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  updated_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  row_version integer not null default 1,

  constraint job_schedules_id_company_unique
    unique (id, company_id),

  constraint job_schedules_job_company_fkey
    foreign key (job_id, company_id)
    references public.jobs (id, company_id)
    on delete restrict,

  constraint job_schedules_kind_check
    check (kind = 'work'),

  constraint job_schedules_status_check
    check (status in ('scheduled', 'cancelled')),

  constraint job_schedules_row_version_check
    check (row_version >= 1),

  constraint job_schedules_dates_order_check
    check (ends_on >= starts_on),

  constraint job_schedules_all_day_times_check
    check (
      (all_day = true and start_local_time is null and end_local_time is null)
      or
      (all_day = false and start_local_time is not null and end_local_time is not null)
    ),

  constraint job_schedules_cancelled_at_check
    check (
      (status = 'scheduled' and cancelled_at is null)
      or
      (status = 'cancelled' and cancelled_at is not null)
    ),

  constraint job_schedules_notes_length_check
    check (notes is null or char_length(notes) <= 500)
);

comment on table public.job_schedules is
  'Canonical FieldDive work-schedule truth. Calendar/Job Card/Board read this table. '
  'One active kind=work status=scheduled row per Job. Cancelled rows are historical and immutable.';

comment on column public.job_schedules.starts_on is
  'Inclusive civil start date in the schedule timezone. Not midnight UTC.';
comment on column public.job_schedules.ends_on is
  'Inclusive civil end date in the schedule timezone.';
comment on column public.job_schedules.range_start_at is
  'Derived timestamptz for indexed Calendar overlap queries. Not independent truth.';
comment on column public.job_schedules.range_end_at is
  'Derived timestamptz. All-day: exclusive start of the day after ends_on. Timed: exclusive of nothing — actual end instant.';

create unique index if not exists job_schedules_one_active_work
  on public.job_schedules (job_id)
  where kind = 'work' and status = 'scheduled';

create index if not exists job_schedules_company_status_range
  on public.job_schedules (company_id, status, range_start_at, range_end_at)
  where kind = 'work' and status = 'scheduled';

create index if not exists job_schedules_company_job_created
  on public.job_schedules (company_id, job_id, created_at desc);

alter table public.job_schedules enable row level security;

drop policy if exists "job_schedules_select_company_scope" on public.job_schedules;
create policy "job_schedules_select_company_scope"
  on public.job_schedules
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

revoke all on table public.job_schedules from public;
revoke all on table public.job_schedules from anon;
revoke all on table public.job_schedules from authenticated;
grant select on table public.job_schedules to authenticated;
grant all on table public.job_schedules to service_role;

-- ---------------------------------------------------------------------------
-- 4. Derive range instants from civil truth
-- ---------------------------------------------------------------------------

create or replace function public.job_schedule_derive_range(
  p_timezone text,
  p_all_day boolean,
  p_starts_on date,
  p_ends_on date,
  p_start_local_time time,
  p_end_local_time time
)
returns table (range_start_at timestamptz, range_end_at timestamptz)
language plpgsql
stable
set search_path = public
as $$
begin
  if p_all_day then
    range_start_at := (p_starts_on::timestamp at time zone p_timezone);
    range_end_at := ((p_ends_on + 1)::timestamp at time zone p_timezone);
    return next;
    return;
  end if;

  range_start_at := ((p_starts_on::timestamp + p_start_local_time) at time zone p_timezone);
  range_end_at := ((p_ends_on::timestamp + p_end_local_time) at time zone p_timezone);
  return next;
end;
$$;

revoke all on function public.job_schedule_derive_range(text, boolean, date, date, time, time) from public;
revoke all on function public.job_schedule_derive_range(text, boolean, date, date, time, time) from anon;
grant execute on function public.job_schedule_derive_range(text, boolean, date, date, time, time) to authenticated;
grant execute on function public.job_schedule_derive_range(text, boolean, date, date, time, time) to service_role;

create or replace function public.job_schedule_validate_window(
  p_timezone text,
  p_all_day boolean,
  p_starts_on date,
  p_ends_on date,
  p_start_local_time time,
  p_end_local_time time
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_range record;
begin
  if not public.job_schedule_is_iana_timezone(p_timezone) then
    return 'invalid_timezone';
  end if;
  if p_starts_on is null or p_ends_on is null then
    return 'invalid_window';
  end if;
  if p_ends_on < p_starts_on then
    return 'invalid_window';
  end if;
  if p_all_day then
    if p_start_local_time is not null or p_end_local_time is not null then
      return 'invalid_window';
    end if;
  else
    if p_start_local_time is null or p_end_local_time is null then
      return 'invalid_window';
    end if;
    if p_starts_on = p_ends_on and p_end_local_time <= p_start_local_time then
      return 'invalid_window';
    end if;
  end if;

  select * into v_range
  from public.job_schedule_derive_range(
    p_timezone,
    p_all_day,
    p_starts_on,
    p_ends_on,
    p_start_local_time,
    p_end_local_time
  );

  if v_range.range_end_at <= v_range.range_start_at then
    return 'invalid_window';
  end if;

  return null;
end;
$$;

revoke all on function public.job_schedule_validate_window(text, boolean, date, date, time, time) from public;
revoke all on function public.job_schedule_validate_window(text, boolean, date, date, time, time) from anon;
grant execute on function public.job_schedule_validate_window(text, boolean, date, date, time, time) to service_role;

create or replace function public.job_schedules_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_range record;
  v_error text;
begin
  if tg_op = 'UPDATE' and old.status = 'cancelled' then
    raise exception 'cancelled job_schedules rows are immutable and must not be revived'
      using errcode = 'P0001';
  end if;

  if new.kind is distinct from 'work' then
    raise exception 'job_schedules.kind must be work'
      using errcode = 'P0001';
  end if;

  if new.notes is not null then
    new.notes := nullif(trim(new.notes), '');
  end if;

  v_error := public.job_schedule_validate_window(
    new.timezone,
    new.all_day,
    new.starts_on,
    new.ends_on,
    new.start_local_time,
    new.end_local_time
  );
  if v_error is not null then
    raise exception 'job_schedules window is invalid: %', v_error
      using errcode = 'P0001';
  end if;

  select * into v_range
  from public.job_schedule_derive_range(
    new.timezone,
    new.all_day,
    new.starts_on,
    new.ends_on,
    new.start_local_time,
    new.end_local_time
  );
  new.range_start_at := v_range.range_start_at;
  new.range_end_at := v_range.range_end_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_schedules_before_write on public.job_schedules;
create trigger job_schedules_before_write
  before insert or update on public.job_schedules
  for each row
  execute function public.job_schedules_before_write();

revoke all on function public.job_schedules_before_write() from public;
revoke all on function public.job_schedules_before_write() from anon;
revoke all on function public.job_schedules_before_write() from authenticated;
grant execute on function public.job_schedules_before_write() to service_role;

-- ---------------------------------------------------------------------------
-- 5. JSON helpers
-- ---------------------------------------------------------------------------

create or replace function public.job_schedule_row_json(p_row public.job_schedules)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'company_id', p_row.company_id,
    'job_id', p_row.job_id,
    'kind', p_row.kind,
    'status', p_row.status,
    'timezone', p_row.timezone,
    'all_day', p_row.all_day,
    'starts_on', p_row.starts_on,
    'ends_on', p_row.ends_on,
    'start_local_time', p_row.start_local_time,
    'end_local_time', p_row.end_local_time,
    'range_start_at', p_row.range_start_at,
    'range_end_at', p_row.range_end_at,
    'notes', p_row.notes,
    'created_by_user_id', p_row.created_by_user_id,
    'updated_by_user_id', p_row.updated_by_user_id,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at,
    'cancelled_at', p_row.cancelled_at,
    'row_version', p_row.row_version
  );
$$;

create or replace function public.job_schedule_window_json(
  p_all_day boolean,
  p_starts_on date,
  p_ends_on date,
  p_start_local_time time,
  p_end_local_time time,
  p_timezone text,
  p_notes text
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'all_day', p_all_day,
    'starts_on', p_starts_on,
    'ends_on', p_ends_on,
    'start_local_time', p_start_local_time,
    'end_local_time', p_end_local_time,
    'timezone', p_timezone,
    'notes', p_notes
  );
$$;

create or replace function public.job_schedule_windows_equal(
  p_a public.job_schedules,
  p_all_day boolean,
  p_starts_on date,
  p_ends_on date,
  p_start_local_time time,
  p_end_local_time time,
  p_notes text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    p_a.all_day is not distinct from p_all_day
    and p_a.starts_on is not distinct from p_starts_on
    and p_a.ends_on is not distinct from p_ends_on
    and p_a.start_local_time is not distinct from p_start_local_time
    and p_a.end_local_time is not distinct from p_end_local_time
    and p_a.notes is not distinct from p_notes;
$$;

revoke all on function public.job_schedule_row_json(public.job_schedules) from public;
revoke all on function public.job_schedule_row_json(public.job_schedules) from anon;
revoke all on function public.job_schedule_row_json(public.job_schedules) from authenticated;
grant execute on function public.job_schedule_row_json(public.job_schedules) to service_role;

revoke all on function public.job_schedule_window_json(boolean, date, date, time, time, text, text) from public;
revoke all on function public.job_schedule_window_json(boolean, date, date, time, time, text, text) from anon;
revoke all on function public.job_schedule_window_json(boolean, date, date, time, time, text, text) from authenticated;
grant execute on function public.job_schedule_window_json(boolean, date, date, time, time, text, text) to service_role;

revoke all on function public.job_schedule_windows_equal(public.job_schedules, boolean, date, date, time, time, text) from public;
revoke all on function public.job_schedule_windows_equal(public.job_schedules, boolean, date, date, time, time, text) from anon;
revoke all on function public.job_schedule_windows_equal(public.job_schedules, boolean, date, date, time, time, text) from authenticated;
grant execute on function public.job_schedule_windows_equal(public.job_schedules, boolean, date, date, time, time, text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Company timezone RPC
-- ---------------------------------------------------------------------------

create or replace function public.set_company_timezone_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_tz text;
  v_member boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  v_tz := nullif(trim(p_payload->>'timezone'), '');
  if v_company_id is null or v_tz is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not public.job_schedule_is_iana_timezone(v_tz) then
    return jsonb_build_object('ok', false, 'code', 'invalid_timezone');
  end if;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  update public.companies
  set timezone = v_tz
  where id = v_company_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'company_id', v_company_id,
    'timezone', v_tz
  );
end;
$$;

revoke all on function public.set_company_timezone_v1(jsonb) from public;
revoke all on function public.set_company_timezone_v1(jsonb) from anon;
grant execute on function public.set_company_timezone_v1(jsonb) to authenticated;
grant execute on function public.set_company_timezone_v1(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Internal stage writers (GUC pattern from Approve job). Not generic transition.
-- ---------------------------------------------------------------------------

create or replace function public.job_lifecycle_apply_scheduled_from_work_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_actor_user_id uuid,
  p_schedule_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_from text;
  v_now timestamptz := now();
  v_activity_id uuid;
begin
  select j.*
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.company_id = p_company_id
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

  if v_from = 'scheduled' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'from_stage', v_from,
      'to_stage', 'scheduled',
      'stage_entered_at', v_job.stage_entered_at,
      'activity_id', null
    );
  end if;

  if v_from <> 'approved' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'scheduled'
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);

  update public.jobs
  set
    stage = 'scheduled',
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = p_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    p_company_id,
    p_job_id,
    'stage_changed',
    p_actor_user_id,
    jsonb_build_object(
      'from_stage', v_from,
      'to_stage', 'scheduled',
      'reason', coalesce(nullif(p_reason, ''), 'scheduled_job'),
      'schedule_id', p_schedule_id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'from_stage', v_from,
    'to_stage', 'scheduled',
    'stage_entered_at', v_now,
    'activity_id', v_activity_id
  );
end;
$$;

create or replace function public.job_lifecycle_apply_approved_from_unschedule_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_actor_user_id uuid,
  p_schedule_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_from text;
  v_now timestamptz := now();
  v_activity_id uuid;
begin
  select j.*
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.company_id = p_company_id
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

  if v_from = 'approved' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'from_stage', v_from,
      'to_stage', 'approved',
      'stage_entered_at', v_job.stage_entered_at,
      'activity_id', null
    );
  end if;

  if v_from <> 'scheduled' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'approved'
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);

  update public.jobs
  set
    stage = 'approved',
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = p_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    p_company_id,
    p_job_id,
    'stage_changed',
    p_actor_user_id,
    jsonb_build_object(
      'from_stage', v_from,
      'to_stage', 'approved',
      'reason', 'unscheduled_job',
      'schedule_id', p_schedule_id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'from_stage', v_from,
    'to_stage', 'approved',
    'stage_entered_at', v_now,
    'activity_id', v_activity_id
  );
end;
$$;

revoke all on function public.job_lifecycle_apply_scheduled_from_work_v1(uuid, uuid, uuid, uuid, text) from public;
revoke all on function public.job_lifecycle_apply_scheduled_from_work_v1(uuid, uuid, uuid, uuid, text) from anon;
revoke all on function public.job_lifecycle_apply_scheduled_from_work_v1(uuid, uuid, uuid, uuid, text) from authenticated;
grant execute on function public.job_lifecycle_apply_scheduled_from_work_v1(uuid, uuid, uuid, uuid, text) to service_role;

revoke all on function public.job_lifecycle_apply_approved_from_unschedule_v1(uuid, uuid, uuid, uuid) from public;
revoke all on function public.job_lifecycle_apply_approved_from_unschedule_v1(uuid, uuid, uuid, uuid) from anon;
revoke all on function public.job_lifecycle_apply_approved_from_unschedule_v1(uuid, uuid, uuid, uuid) from authenticated;
grant execute on function public.job_lifecycle_apply_approved_from_unschedule_v1(uuid, uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 8. schedule_job_v1 — insert NEW scheduled row; never revive cancelled
-- ---------------------------------------------------------------------------

create or replace function public.schedule_job_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_member boolean;
  v_job public.jobs%rowtype;
  v_from text;
  v_tz text;
  v_all_day boolean;
  v_starts_on date;
  v_ends_on date;
  v_start_time time;
  v_end_time time;
  v_notes text;
  v_window_error text;
  v_active public.job_schedules%rowtype;
  v_row public.job_schedules%rowtype;
  v_now timestamptz := now();
  v_activity_id uuid;
  v_stage jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_starts_on := nullif(p_payload->>'starts_on', '')::date;
    v_ends_on := coalesce(nullif(p_payload->>'ends_on', '')::date, v_starts_on);
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_starts_on is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  v_all_day := coalesce((p_payload->>'all_day')::boolean, true);
  v_notes := nullif(trim(p_payload->>'notes'), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  begin
    if v_all_day then
      v_start_time := null;
      v_end_time := null;
    else
      v_start_time := nullif(p_payload->>'start_local_time', '')::time;
      v_end_time := nullif(p_payload->>'end_local_time', '')::time;
    end if;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_window');
  end;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
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

  if v_job.status in ('lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_schedule');
  end if;

  if v_job.status = 'on_hold' then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_schedule');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  select c.timezone into v_tz
  from public.companies c
  where c.id = v_company_id;

  if v_tz is null or not public.job_schedule_is_iana_timezone(v_tz) then
    return jsonb_build_object('ok', false, 'code', 'company_timezone_required');
  end if;

  v_window_error := public.job_schedule_validate_window(
    v_tz, v_all_day, v_starts_on, v_ends_on, v_start_time, v_end_time
  );
  if v_window_error is not null then
    return jsonb_build_object('ok', false, 'code', coalesce(v_window_error, 'invalid_window'));
  end if;

  select s.*
  into v_active
  from public.job_schedules s
  where s.job_id = v_job_id
    and s.company_id = v_company_id
    and s.kind = 'work'
    and s.status = 'scheduled'
  for update;

  if found then
    if v_from = 'scheduled'
      and public.job_schedule_windows_equal(
        v_active, v_all_day, v_starts_on, v_ends_on, v_start_time, v_end_time, v_notes
      )
    then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'job_id', v_job_id,
        'from_stage', v_from,
        'to_stage', 'scheduled',
        'stage_entered_at', v_job.stage_entered_at,
        'schedule', public.job_schedule_row_json(v_active),
        'activity_id', null,
        'stage_activity_id', null
      );
    end if;
    return jsonb_build_object('ok', false, 'code', 'already_scheduled');
  end if;

  if v_from <> 'approved' and v_from <> 'scheduled' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'scheduled'
    );
  end if;

  if v_from = 'scheduled' then
    return jsonb_build_object('ok', false, 'code', 'schedule_stage_mismatch');
  end if;

  insert into public.job_schedules (
    company_id,
    job_id,
    kind,
    status,
    timezone,
    all_day,
    starts_on,
    ends_on,
    start_local_time,
    end_local_time,
    range_start_at,
    range_end_at,
    notes,
    created_by_user_id,
    updated_by_user_id,
    created_at,
    updated_at,
    cancelled_at,
    row_version
  )
  values (
    v_company_id,
    v_job_id,
    'work',
    'scheduled',
    v_tz,
    v_all_day,
    v_starts_on,
    v_ends_on,
    v_start_time,
    v_end_time,
    v_now,
    v_now,
    v_notes,
    v_uid,
    v_uid,
    v_now,
    v_now,
    null,
    1
  )
  returning * into v_row;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'job_scheduled',
    v_uid,
    jsonb_build_object(
      'schedule_id', v_row.id,
      'window', public.job_schedule_window_json(
        v_row.all_day,
        v_row.starts_on,
        v_row.ends_on,
        v_row.start_local_time,
        v_row.end_local_time,
        v_row.timezone,
        v_row.notes
      )
    ),
    v_now
  );

  v_stage := public.job_lifecycle_apply_scheduled_from_work_v1(
    v_company_id,
    v_job_id,
    v_uid,
    v_row.id,
    'scheduled_job'
  );

  if coalesce(v_stage->>'ok', '') <> 'true' then
    raise exception 'schedule stage synchronization failed: %', v_stage
      using errcode = 'P0001';
  end if;

  update public.jobs
  set last_activity_at = v_now
  where id = v_job_id
    and company_id = v_company_id
    and last_activity_at is distinct from v_now;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job_id,
    'from_stage', v_stage->>'from_stage',
    'to_stage', v_stage->>'to_stage',
    'stage_entered_at', v_stage->>'stage_entered_at',
    'schedule', public.job_schedule_row_json(v_row),
    'activity_id', v_activity_id,
    'stage_activity_id', v_stage->'activity_id'
  );
end;
$$;

revoke all on function public.schedule_job_v1(jsonb) from public;
revoke all on function public.schedule_job_v1(jsonb) from anon;
grant execute on function public.schedule_job_v1(jsonb) to authenticated;
grant execute on function public.schedule_job_v1(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 9. reschedule_job_v1 — mutate SAME active row
-- ---------------------------------------------------------------------------

create or replace function public.reschedule_job_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_expected integer;
  v_member boolean;
  v_job public.jobs%rowtype;
  v_from text;
  v_all_day boolean;
  v_starts_on date;
  v_ends_on date;
  v_start_time time;
  v_end_time time;
  v_notes text;
  v_window_error text;
  v_active public.job_schedules%rowtype;
  v_previous jsonb;
  v_now timestamptz := now();
  v_activity_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_expected := nullif(p_payload->>'expected_row_version', '')::integer;
    v_starts_on := nullif(p_payload->>'starts_on', '')::date;
    v_ends_on := coalesce(nullif(p_payload->>'ends_on', '')::date, v_starts_on);
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_starts_on is null or v_expected is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  v_all_day := coalesce((p_payload->>'all_day')::boolean, true);
  v_notes := nullif(trim(p_payload->>'notes'), '');
  if v_notes is not null and char_length(v_notes) > 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  begin
    if v_all_day then
      v_start_time := null;
      v_end_time := null;
    else
      v_start_time := nullif(p_payload->>'start_local_time', '')::time;
      v_end_time := nullif(p_payload->>'end_local_time', '')::time;
    end if;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_window');
  end;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
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

  if v_job.status in ('lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_reschedule');
  end if;

  if v_job.status = 'on_hold' then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_reschedule');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from <> 'scheduled' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from
    );
  end if;

  select s.*
  into v_active
  from public.job_schedules s
  where s.job_id = v_job_id
    and s.company_id = v_company_id
    and s.kind = 'work'
    and s.status = 'scheduled'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_active_schedule');
  end if;

  if v_active.row_version is distinct from v_expected then
    return jsonb_build_object(
      'ok', false,
      'code', 'schedule_stale',
      'row_version', v_active.row_version
    );
  end if;

  v_window_error := public.job_schedule_validate_window(
    v_active.timezone,
    v_all_day,
    v_starts_on,
    v_ends_on,
    v_start_time,
    v_end_time
  );
  if v_window_error is not null then
    return jsonb_build_object('ok', false, 'code', coalesce(v_window_error, 'invalid_window'));
  end if;

  if public.job_schedule_windows_equal(
    v_active, v_all_day, v_starts_on, v_ends_on, v_start_time, v_end_time, v_notes
  ) then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job_id,
      'from_stage', v_from,
      'to_stage', v_from,
      'stage_entered_at', v_job.stage_entered_at,
      'schedule', public.job_schedule_row_json(v_active),
      'activity_id', null
    );
  end if;

  v_previous := public.job_schedule_window_json(
    v_active.all_day,
    v_active.starts_on,
    v_active.ends_on,
    v_active.start_local_time,
    v_active.end_local_time,
    v_active.timezone,
    v_active.notes
  );

  update public.job_schedules
  set
    all_day = v_all_day,
    starts_on = v_starts_on,
    ends_on = v_ends_on,
    start_local_time = v_start_time,
    end_local_time = v_end_time,
    notes = v_notes,
    updated_by_user_id = v_uid,
    row_version = v_active.row_version + 1
  where id = v_active.id
    and company_id = v_company_id
  returning * into v_active;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'job_rescheduled',
    v_uid,
    jsonb_build_object(
      'schedule_id', v_active.id,
      'previous_window', v_previous,
      'window', public.job_schedule_window_json(
        v_active.all_day,
        v_active.starts_on,
        v_active.ends_on,
        v_active.start_local_time,
        v_active.end_local_time,
        v_active.timezone,
        v_active.notes
      )
    ),
    v_now
  );

  update public.jobs
  set last_activity_at = v_now
  where id = v_job_id
    and company_id = v_company_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job_id,
    'from_stage', v_from,
    'to_stage', v_from,
    'stage_entered_at', v_job.stage_entered_at,
    'schedule', public.job_schedule_row_json(v_active),
    'activity_id', v_activity_id
  );
end;
$$;

revoke all on function public.reschedule_job_v1(jsonb) from public;
revoke all on function public.reschedule_job_v1(jsonb) from anon;
grant execute on function public.reschedule_job_v1(jsonb) to authenticated;
grant execute on function public.reschedule_job_v1(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 10. unschedule_job_v1 — cancel active row; Scheduled → Approved
-- ---------------------------------------------------------------------------

create or replace function public.unschedule_job_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_expected integer;
  v_member boolean;
  v_job public.jobs%rowtype;
  v_from text;
  v_active public.job_schedules%rowtype;
  v_now timestamptz := now();
  v_activity_id uuid;
  v_stage jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_expected := nullif(p_payload->>'expected_row_version', '')::integer;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
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

  if v_job.status in ('lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_unschedule');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from = 'production' then
    return jsonb_build_object('ok', false, 'code', 'unschedule_blocked_production');
  end if;

  if v_from = 'complete' then
    return jsonb_build_object('ok', false, 'code', 'unschedule_blocked_complete');
  end if;

  select s.*
  into v_active
  from public.job_schedules s
  where s.job_id = v_job_id
    and s.company_id = v_company_id
    and s.kind = 'work'
    and s.status = 'scheduled'
  for update;

  if not found then
    if v_from = 'approved' then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'job_id', v_job_id,
        'from_stage', v_from,
        'to_stage', 'approved',
        'stage_entered_at', v_job.stage_entered_at,
        'schedule', null,
        'activity_id', null,
        'stage_activity_id', null
      );
    end if;
    if v_from = 'scheduled' then
      return jsonb_build_object('ok', false, 'code', 'schedule_stage_mismatch');
    end if;
    return jsonb_build_object('ok', false, 'code', 'no_active_schedule');
  end if;

  if v_expected is not null and v_active.row_version is distinct from v_expected then
    return jsonb_build_object(
      'ok', false,
      'code', 'schedule_stale',
      'row_version', v_active.row_version
    );
  end if;

  if v_from <> 'scheduled' and v_from <> 'approved' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from
    );
  end if;

  if v_from = 'approved' then
    return jsonb_build_object('ok', false, 'code', 'schedule_stage_mismatch');
  end if;

  update public.job_schedules
  set
    status = 'cancelled',
    cancelled_at = v_now,
    updated_by_user_id = v_uid,
    row_version = v_active.row_version + 1
  where id = v_active.id
    and company_id = v_company_id
  returning * into v_active;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'job_unscheduled',
    v_uid,
    jsonb_build_object(
      'schedule_id', v_active.id,
      'previous_window', public.job_schedule_window_json(
        v_active.all_day,
        v_active.starts_on,
        v_active.ends_on,
        v_active.start_local_time,
        v_active.end_local_time,
        v_active.timezone,
        v_active.notes
      )
    ),
    v_now
  );

  v_stage := public.job_lifecycle_apply_approved_from_unschedule_v1(
    v_company_id,
    v_job_id,
    v_uid,
    v_active.id
  );

  if coalesce(v_stage->>'ok', '') <> 'true' then
    raise exception 'unschedule stage synchronization failed: %', v_stage
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job_id,
    'from_stage', v_stage->>'from_stage',
    'to_stage', v_stage->>'to_stage',
    'stage_entered_at', v_stage->>'stage_entered_at',
    'schedule', public.job_schedule_row_json(v_active),
    'activity_id', v_activity_id,
    'stage_activity_id', v_stage->'activity_id'
  );
end;
$$;

revoke all on function public.unschedule_job_v1(jsonb) from public;
revoke all on function public.unschedule_job_v1(jsonb) from anon;
grant execute on function public.unschedule_job_v1(jsonb) to authenticated;
grant execute on function public.unschedule_job_v1(jsonb) to service_role;

comment on function public.schedule_job_v1(jsonb) is
  'R3F: insert a NEW active work schedule and atomically move Approved → Scheduled. '
  'Never revives cancelled rows. Generic transition_job_stage_v1 remains blocked.';

comment on function public.reschedule_job_v1(jsonb) is
  'R3F: update the SAME active work schedule. Does not change Job stage or stage_entered_at.';

comment on function public.unschedule_job_v1(jsonb) is
  'R3F: cancel the active work schedule and atomically move Scheduled → Approved. '
  'Blocked for Production and Complete. Does not reopen disposition.';

commit;
