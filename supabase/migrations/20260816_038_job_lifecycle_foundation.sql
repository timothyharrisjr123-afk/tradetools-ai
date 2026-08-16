-- Job Lifecycle Foundation — canonical stage / disposition / activity.
-- REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT LIVE-APPLY APPROVAL.
--
-- Number 038 is the next unused repo migration after 037.
-- This file is NOT the deferred C4 public-token mint hardening that docs
-- historically reserved as a future "038". That C4 drain/hardening step
-- remains UNAUTHORED and must use a later number (039+) when it is written.
--
-- This migration does NOT:
--   - mint, revoke, or supersede public tokens
--   - change persist_draft_proposal_create_v1 / freeze RPCs
--   - implement acceptance, signatures, payments, or scheduling
--   - backfill fabricated stage_entered_at values
--   - remove legacy readable stage/status values
--   - write jobs.status='won' or jobs.status='archived'
--   - write jobs.stage='archived' or jobs.stage='measurement'
--
-- First-proposal AUTO (Intake → Proposal) is applied in the SAME statement as
-- jobs.active_proposal_id updates (including persist_draft_proposal_create_v1)
-- via a BEFORE UPDATE trigger. The 440-line draft-create RPC is not replaced.

begin;

-- ---------------------------------------------------------------------------
-- 1. jobs.stage_entered_at — nullable; no fabricated backfill
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column if not exists stage_entered_at timestamptz null;

comment on column public.jobs.stage_entered_at is
  'Trustworthy canonical stage-entry clock. Null means Time in stage must be omitted. '
  'Never backfilled from created_at, sent, payment, or schedule stamps.';

create index if not exists idx_jobs_company_stage_entered_at
  on public.jobs (company_id, stage_entered_at desc nulls last)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Widen jobs.stage CHECK with scheduled; keep legacy readable values
-- ---------------------------------------------------------------------------

alter table public.jobs
  drop constraint if exists jobs_stage_check;

alter table public.jobs
  add constraint jobs_stage_check check (
    stage in (
      'intake',
      'measurement',
      'estimating',
      'proposal',
      'approved',
      'scheduled',
      'production',
      'complete',
      'archived'
    )
  );

comment on constraint jobs_stage_check on public.jobs is
  'Canonical writes: intake, proposal, approved, scheduled, production, complete. '
  'Legacy readable: measurement, estimating, archived. scheduled is write-banned until R3F.';

-- jobs.status CHECK is unchanged: active, on_hold, won, lost, closed, archived.
-- Future operational writes: active, on_hold, lost, closed only.

-- ---------------------------------------------------------------------------
-- 3. Thin job-native Activity primitive
-- ---------------------------------------------------------------------------

create table if not exists public.job_activity_events (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete restrict,
  job_id uuid not null,

  event_type text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  payload_json jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint job_activity_events_id_company_unique
    unique (id, company_id),

  constraint job_activity_events_job_company_fkey
    foreign key (job_id, company_id)
    references public.jobs (id, company_id)
    on delete restrict,

  constraint job_activity_events_type_check check (
    event_type in (
      'job_created',
      'stage_changed',
      'disposition_changed'
    )
  )
);

create index if not exists idx_job_activity_events_job_occurred
  on public.job_activity_events (company_id, job_id, occurred_at desc);

create index if not exists idx_job_activity_events_company_occurred
  on public.job_activity_events (company_id, occurred_at desc);

comment on table public.job_activity_events is
  'Job-native durable Activity facts only (created, stage, disposition). '
  'Proposal sent/requests are composed from their native owners. Not event sourcing.';

alter table public.job_activity_events enable row level security;

drop policy if exists "job_activity_events_select_company_scope" on public.job_activity_events;
create policy "job_activity_events_select_company_scope"
  on public.job_activity_events
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

revoke all on table public.job_activity_events from public;
revoke all on table public.job_activity_events from anon;
revoke all on table public.job_activity_events from authenticated;
grant select on table public.job_activity_events to authenticated;
grant all on table public.job_activity_events to service_role;

-- No INSERT/UPDATE/DELETE policies: non-owner roles are denied those commands
-- by RLS default-deny. Authenticated is not the table owner. FORCE RLS is not
-- used so SECURITY DEFINER writers (function owner) can insert Activity.

-- ---------------------------------------------------------------------------
-- 4. Canonical read mapper (SQL, matches app/lib/jobLifecycleMapper.ts)
-- ---------------------------------------------------------------------------

create or replace function public.canonical_job_stage_from_row(
  p_stage text,
  p_status text,
  p_archived boolean,
  p_active_proposal_id uuid,
  p_latest_proposal_id uuid
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_stage text := lower(coalesce(p_stage, ''));
  v_status text := lower(coalesce(p_status, ''));
begin
  -- Legacy archived stage: explicit resolution, never automatic Complete.
  if v_stage = 'archived' then
    if v_status = 'lost' then
      return 'proposal';
    end if;
    if v_status = 'won' then
      return 'approved';
    end if;
    if p_active_proposal_id is not null or p_latest_proposal_id is not null then
      return 'proposal';
    end if;
    return 'intake';
  end if;

  -- status=won + already later canonical stage → stage wins.
  if v_status = 'won' then
    if v_stage in ('approved', 'scheduled', 'production', 'complete') then
      return v_stage;
    end if;
    if v_stage in ('intake', 'measurement', 'estimating', 'proposal') then
      return 'approved';
    end if;
  end if;

  if v_stage in ('measurement', 'estimating') then
    return 'intake';
  end if;

  if v_stage in ('intake', 'proposal', 'approved', 'scheduled', 'production', 'complete') then
    return v_stage;
  end if;

  return 'intake';
end;
$$;

revoke all on function public.canonical_job_stage_from_row(text, text, boolean, uuid, uuid) from public;
grant execute on function public.canonical_job_stage_from_row(text, text, boolean, uuid, uuid) to authenticated;
grant execute on function public.canonical_job_stage_from_row(text, text, boolean, uuid, uuid) to service_role;

-- Durable first-proposal truth: jobs.active_proposal_id must point at a live
-- Proposal V2 header that belongs to this job+company and has at least one
-- owned version (draft/sent/signed/superseded). No new flag.
create or replace function public.job_lifecycle_has_proposal_truth(
  p_company_id uuid,
  p_job_id uuid,
  p_proposal_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_proposal_id is not null
    and exists (
      select 1
      from public.proposals p
      join public.proposal_versions pv
        on pv.proposal_id = p.id
       and pv.company_id = p.company_id
      where p.id = p_proposal_id
        and p.company_id = p_company_id
        and p.job_id = p_job_id
        and p.deleted_at is null
        and p.status is distinct from 'deleted'
    );
$$;

revoke all on function public.job_lifecycle_has_proposal_truth(uuid, uuid, uuid) from public;
revoke all on function public.job_lifecycle_has_proposal_truth(uuid, uuid, uuid) from anon;
revoke all on function public.job_lifecycle_has_proposal_truth(uuid, uuid, uuid) from authenticated;
grant execute on function public.job_lifecycle_has_proposal_truth(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Activity writer (definer — table inserts are revoked from authenticated)
-- ---------------------------------------------------------------------------

-- No authenticated manual Activity event exists in the current product.
-- Keep the function for architecture; EXECUTE is service_role-only.
-- System facts are written only by job_lifecycle_insert_activity (triggers/RPCs).
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

  if v_event_type in ('job_created', 'stage_changed', 'disposition_changed') then
    return jsonb_build_object('ok', false, 'code', 'event_type_reserved');
  end if;

  return jsonb_build_object('ok', false, 'code', 'invalid_event_type');
end;
$$;

revoke all on function public.record_job_activity_v1(jsonb) from public;
revoke all on function public.record_job_activity_v1(jsonb) from anon;
revoke all on function public.record_job_activity_v1(jsonb) from authenticated;
grant execute on function public.record_job_activity_v1(jsonb) to service_role;

create or replace function public.job_lifecycle_insert_activity(
  p_company_id uuid,
  p_job_id uuid,
  p_event_type text,
  p_actor_user_id uuid,
  p_payload jsonb,
  p_occurred_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_company_id uuid;
begin
  select j.company_id
  into v_company_id
  from public.jobs j
  where j.id = p_job_id
    and j.deleted_at is null;

  if not found or v_company_id is distinct from p_company_id then
    raise exception 'job_lifecycle_insert_activity: job/company mismatch'
      using errcode = 'P0001';
  end if;

  insert into public.job_activity_events (
    company_id,
    job_id,
    event_type,
    actor_user_id,
    payload_json,
    occurred_at
  ) values (
    p_company_id,
    p_job_id,
    p_event_type,
    p_actor_user_id,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_occurred_at, now())
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.job_lifecycle_insert_activity(uuid, uuid, text, uuid, jsonb, timestamptz) from public;
revoke all on function public.job_lifecycle_insert_activity(uuid, uuid, text, uuid, jsonb, timestamptz) from anon;
revoke all on function public.job_lifecycle_insert_activity(uuid, uuid, text, uuid, jsonb, timestamptz) from authenticated;
grant execute on function public.job_lifecycle_insert_activity(uuid, uuid, text, uuid, jsonb, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Stage / disposition write guards + first-proposal AUTO on pointer set
-- ---------------------------------------------------------------------------

create or replace function public.jobs_lifecycle_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Legacy callers may still INSERT measurement/estimating; canonicalize to Intake.
  -- Existing stored rows are not rewritten: this trigger is INSERT-only.
  if new.stage in ('measurement', 'estimating') then
    new.stage := 'intake';
  end if;

  if new.stage is distinct from 'intake' then
    raise exception 'new jobs must start in intake'
      using errcode = 'P0001';
  end if;

  if new.status in ('won', 'archived') then
    raise exception 'jobs.status write target % is not an operational disposition', new.status
      using errcode = 'P0001';
  end if;

  -- New canonical jobs start in Intake with a truthful clock.
  if new.stage = 'intake' and new.stage_entered_at is null then
    new.stage_entered_at := coalesce(new.created_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_lifecycle_before_insert on public.jobs;
create trigger jobs_lifecycle_before_insert
  before insert on public.jobs
  for each row
  execute function public.jobs_lifecycle_before_insert();

create or replace function public.jobs_lifecycle_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.job_lifecycle_insert_activity(
    new.company_id,
    new.id,
    'job_created',
    coalesce(new.created_by, auth.uid()),
    jsonb_build_object('stage', new.stage, 'status', new.status),
    coalesce(new.created_at, now())
  );
  return new;
end;
$$;

drop trigger if exists jobs_lifecycle_after_insert on public.jobs;
create trigger jobs_lifecycle_after_insert
  after insert on public.jobs
  for each row
  execute function public.jobs_lifecycle_after_insert();

create or replace function public.jobs_lifecycle_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from text;
  v_allow_stage boolean :=
    current_setting('job_lifecycle.allow_stage_write', true) = '1';
  v_allow_status boolean :=
    current_setting('job_lifecycle.allow_status_write', true) = '1';
  v_auto_first_proposal boolean := false;
begin
  v_from := public.canonical_job_stage_from_row(
    old.stage,
    old.status,
    coalesce(old.archived, false),
    old.active_proposal_id,
    old.latest_proposal_id
  );

  -- A. approved lifecycle RPC: transition_job_stage_v1 sets
  --    job_lifecycle.allow_stage_write=1 (transaction-local) then UPDATE.
  --    Column UPDATE(stage, stage_entered_at) is revoked from authenticated
  --    and service_role, so a client cannot spoof the GUC and SET stage.
  -- B. first-proposal AUTO: OLD.active_proposal_id IS NULL AND NEW pointer
  --    set AND canonical read = Intake. Mutates NEW (no second UPDATE).
  -- C. unauthorized direct UPDATE of stage / stage_entered_at / status:
  --    rejected here, and also denied by column privileges.
  if old.active_proposal_id is null
     and new.active_proposal_id is not null
     and v_from = 'intake'
     and public.job_lifecycle_has_proposal_truth(
       new.company_id,
       new.id,
       new.active_proposal_id
     )
  then
    v_auto_first_proposal := true;
    new.stage := 'proposal';
    new.stage_entered_at := now();
  end if;

  if new.stage is distinct from old.stage then
    if not v_allow_stage and not v_auto_first_proposal then
      raise exception 'jobs.stage may only change via transition_job_stage_v1'
        using errcode = 'P0001';
    end if;
    if new.stage not in (
      'intake',
      'proposal',
      'approved',
      'scheduled',
      'production',
      'complete'
    ) then
      raise exception 'jobs.stage write target % is not canonical', new.stage
        using errcode = 'P0001';
    end if;
  end if;

  if new.stage_entered_at is distinct from old.stage_entered_at
     and not v_allow_stage
     and not v_auto_first_proposal
  then
    raise exception 'jobs.stage_entered_at may only change via transition_job_stage_v1'
      using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if not v_allow_status then
      raise exception 'jobs.status may only change via change_job_disposition_v1'
        using errcode = 'P0001';
    end if;
    if new.status not in ('active', 'on_hold', 'lost', 'closed') then
      raise exception 'jobs.status write target % is not an operational disposition', new.status
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_lifecycle_before_update on public.jobs;
create trigger jobs_lifecycle_before_update
  before update on public.jobs
  for each row
  execute function public.jobs_lifecycle_before_update();

create or replace function public.jobs_lifecycle_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from text;
begin
  -- AUTO Activity only. RPC transitions write Activity themselves after UPDATE.
  -- Do not key this off the session GUC: that GUC is client-settable.
  if new.stage is distinct from old.stage
     and old.active_proposal_id is null
     and new.active_proposal_id is not null
     and new.stage = 'proposal'
     and public.job_lifecycle_has_proposal_truth(
       new.company_id,
       new.id,
       new.active_proposal_id
     )
  then
    v_from := public.canonical_job_stage_from_row(
      old.stage,
      old.status,
      coalesce(old.archived, false),
      old.active_proposal_id,
      old.latest_proposal_id
    );
    if v_from = 'intake' then
      perform public.job_lifecycle_insert_activity(
        new.company_id,
        new.id,
        'stage_changed',
        auth.uid(),
        jsonb_build_object(
          'from_stage', v_from,
          'to_stage', 'proposal',
          'reason', 'first_proposal_created',
          'mode', 'auto',
          'active_proposal_id', new.active_proposal_id
        ),
        now()
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_lifecycle_after_update on public.jobs;
create trigger jobs_lifecycle_after_update
  after update on public.jobs
  for each row
  execute function public.jobs_lifecycle_after_update();

-- ---------------------------------------------------------------------------
-- 7. transition_job_stage_v1
-- ---------------------------------------------------------------------------

create or replace function public.transition_job_stage_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_to text;
  v_reason text;
  v_job public.jobs%rowtype;
  v_from text;
  v_member boolean := false;
  v_now timestamptz := now();
  v_activity_id uuid;
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

  v_to := lower(nullif(p_payload->>'to_stage', ''));
  v_reason := nullif(p_payload->>'reason', '');

  if v_company_id is null or v_job_id is null or v_to is null then
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

  if v_to not in (
    'intake',
    'proposal',
    'approved',
    'scheduled',
    'production',
    'complete'
  ) then
    return jsonb_build_object('ok', false, 'code', 'noncanonical_target');
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

  if v_from = v_to then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job.id,
      'from_stage', v_from,
      'to_stage', v_to,
      'stage_entered_at', v_job.stage_entered_at,
      'status_unchanged', v_job.status
    );
  end if;

  -- Live write surface before R3C / R3F / production actions:
  -- only Intake → Proposal is enabled. Conceptual later edges stay blocked.
  if v_from = 'proposal' and v_to = 'approved' then
    return jsonb_build_object(
      'ok', false,
      'code', 'approved_blocked_until_r3c',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_from = 'approved' and v_to = 'scheduled' then
    return jsonb_build_object(
      'ok', false,
      'code', 'scheduled_blocked_until_r3f',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_to = 'scheduled' then
    return jsonb_build_object(
      'ok', false,
      'code', 'scheduled_blocked_until_r3f',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_from = 'scheduled' and v_to = 'production' then
    return jsonb_build_object(
      'ok', false,
      'code', 'production_blocked_until_start_work',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_to = 'production' then
    return jsonb_build_object(
      'ok', false,
      'code', 'production_blocked_until_start_work',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_from = 'production' and v_to = 'complete' then
    return jsonb_build_object(
      'ok', false,
      'code', 'complete_blocked_until_complete_action',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if v_to = 'complete' then
    return jsonb_build_object(
      'ok', false,
      'code', 'complete_blocked_until_complete_action',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if not (v_from = 'intake' and v_to = 'proposal') then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_edge',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  -- Intake → Proposal requires durable first-proposal truth. The RPC cannot
  -- manufacture Proposal when no real proposal exists. AUTO remains primary.
  if v_job.active_proposal_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'proposal_truth_required',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  if not public.job_lifecycle_has_proposal_truth(
    v_job.company_id,
    v_job.id,
    v_job.active_proposal_id
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'proposal_truth_mismatch',
      'from_stage', v_from,
      'to_stage', v_to
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);

  update public.jobs
  set
    stage = v_to,
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'stage_changed',
    v_uid,
    jsonb_build_object(
      'from_stage', v_from,
      'to_stage', v_to,
      'reason', v_reason,
      'mode', coalesce(nullif(p_payload->>'mode', ''), 'manual')
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job_id,
    'from_stage', v_from,
    'to_stage', v_to,
    'stage_entered_at', v_now,
    'status_unchanged', v_job.status,
    'activity_id', v_activity_id
  );
end;
$$;

comment on function public.transition_job_stage_v1(jsonb) is
  'Sole application writer of jobs.stage after Job Lifecycle Foundation. '
  'Live enabled edge: Intake→Proposal only, and only when jobs.active_proposal_id '
  'points at a live same-job/same-company Proposal V2 lineage. '
  'Idempotent same-target. Does not mutate jobs.status. '
  'Proposal→Approved blocked until R3C. Approved→Scheduled blocked until R3F. '
  'Scheduled→Production and Production→Complete blocked until those actions exist.';

revoke all on function public.transition_job_stage_v1(jsonb) from public;
revoke all on function public.transition_job_stage_v1(jsonb) from anon;
grant execute on function public.transition_job_stage_v1(jsonb) to authenticated;
grant execute on function public.transition_job_stage_v1(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 8. change_job_disposition_v1
-- ---------------------------------------------------------------------------

create or replace function public.change_job_disposition_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_to text;
  v_reason text;
  v_job public.jobs%rowtype;
  v_member boolean := false;
  v_now timestamptz := now();
  v_activity_id uuid;
  v_event_type text := 'disposition_changed';
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

  v_to := lower(nullif(p_payload->>'to_status', ''));
  v_reason := nullif(p_payload->>'reason', '');

  if v_company_id is null or v_job_id is null or v_to is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_to in ('won', 'archived') then
    return jsonb_build_object('ok', false, 'code', 'illegal_disposition_target');
  end if;

  if v_to not in ('active', 'on_hold', 'lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'illegal_disposition_target');
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

  if v_job.status = v_to then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job.id,
      'from_status', v_job.status,
      'to_status', v_to,
      'stage_unchanged', v_job.stage,
      'stage_entered_at_unchanged', v_job.stage_entered_at
    );
  end if;

  perform set_config('job_lifecycle.allow_status_write', '1', true);

  update public.jobs
  set
    status = v_to,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = v_company_id;

  if v_to = 'on_hold' then
    v_event_type := 'disposition_changed';
  elsif v_to = 'lost' then
    v_event_type := 'disposition_changed';
  elsif v_to = 'closed' then
    v_event_type := 'disposition_changed';
  elsif v_to = 'active' then
    v_event_type := 'disposition_changed';
  end if;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    v_event_type,
    v_uid,
    jsonb_build_object(
      'from_status', v_job.status,
      'to_status', v_to,
      'reason', v_reason,
      'stage_unchanged', v_job.stage,
      'reopened', (v_to = 'active' and v_job.status is distinct from 'active')
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job_id,
    'from_status', v_job.status,
    'to_status', v_to,
    'stage_unchanged', v_job.stage,
    'stage_entered_at_unchanged', v_job.stage_entered_at,
    'activity_id', v_activity_id
  );
end;
$$;

comment on function public.change_job_disposition_v1(jsonb) is
  'Sole application writer of operational jobs.status (active/on_hold/lost/closed). '
  'Preserves jobs.stage and stage_entered_at. won/archived are not legal targets.';

revoke all on function public.change_job_disposition_v1(jsonb) from public;
revoke all on function public.change_job_disposition_v1(jsonb) from anon;
grant execute on function public.change_job_disposition_v1(jsonb) to authenticated;
grant execute on function public.change_job_disposition_v1(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Column privileges: authenticated/service_role cannot SET stage/status
-- ---------------------------------------------------------------------------
-- Table-level UPDATE is replaced with an explicit column list that omits
-- stage, stage_entered_at, and status. SECURITY DEFINER RPCs run as the
-- function owner (migration role / postgres) and still write those columns.
-- BEFORE UPDATE AUTO may still mutate NEW.stage without the caller listing
-- those columns in SET (PostgreSQL column-privilege rule).

revoke update on table public.jobs from public;
revoke update on table public.jobs from anon;
revoke update on table public.jobs from authenticated;
revoke update on table public.jobs from service_role;

grant update (
  id,
  company_id,
  customer_id,
  job_name,
  source,
  priority,
  customer_name,
  customer_email,
  customer_phone,
  address_line1,
  address_line2,
  address_city,
  address_state,
  address_zip,
  address_country,
  address_formatted,
  assigned_to,
  created_by,
  updated_by,
  notes,
  summary,
  last_activity_at,
  archived,
  deleted_at,
  selected_measurement_id,
  active_proposal_id,
  latest_estimate_id,
  latest_proposal_id,
  source_metadata,
  custom_fields,
  created_at,
  updated_at
) on table public.jobs to authenticated;

grant update (
  id,
  company_id,
  customer_id,
  job_name,
  source,
  priority,
  customer_name,
  customer_email,
  customer_phone,
  address_line1,
  address_line2,
  address_city,
  address_state,
  address_zip,
  address_country,
  address_formatted,
  assigned_to,
  created_by,
  updated_by,
  notes,
  summary,
  last_activity_at,
  archived,
  deleted_at,
  selected_measurement_id,
  active_proposal_id,
  latest_estimate_id,
  latest_proposal_id,
  source_metadata,
  custom_fields,
  created_at,
  updated_at
) on table public.jobs to service_role;

commit;
