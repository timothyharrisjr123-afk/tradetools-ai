-- Phase 13C: durable Job -> Crew assignment foundation.
--
-- Contract: docs/phase13c-people-crew-access-product-architecture-decision.md sections 7-11, 17-18.
-- An assignment records which Crew is currently assigned/responsible for a Job. "Active"
-- (ended_at is null) means currently assigned, never onsite attendance, hours, or payroll.
-- Assignment is not a schedule (Calendar stays authoritative), not the Crew roster, not
-- jobs.assigned_to (Coordinator), not a Crew Lead, and grants no software access.
--
-- Rows are write-once except the single end transition. Replacing the Crew or changing the
-- Assignment Lead ends the current row and inserts a successor. Only an active primary row is
-- unique per Job; future non-primary concurrent assignments stay possible.
--
-- Tables have no client privileges; reads and writes go through the SECURITY DEFINER
-- functions below. jobs.crew_label is legacy free text and is not read or written here.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.job_crew_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null,
  crew_id uuid not null,
  is_primary boolean not null default true,
  assignment_lead_person_id uuid,
  crew_name_snapshot text not null,
  assignment_lead_name_snapshot text,
  started_at timestamptz not null default now(),
  started_by uuid not null,
  ended_at timestamptz,
  ended_by uuid,
  end_reason text,
  request_id text,
  supersedes_assignment_id uuid,
  constraint job_crew_assignments_id_company_key unique (id, company_id),
  -- Relies on public.idx_jobs_id_company_unique (id, company_id).
  constraint job_crew_assignments_job_fk
    foreign key (job_id, company_id) references public.jobs (id, company_id) on delete cascade,
  constraint job_crew_assignments_crew_fk
    foreign key (crew_id, company_id) references public.crews (id, company_id),
  constraint job_crew_assignments_lead_fk
    foreign key (assignment_lead_person_id, company_id) references public.company_people (id, company_id),
  constraint job_crew_assignments_supersedes_fk
    foreign key (supersedes_assignment_id, company_id) references public.job_crew_assignments (id, company_id),
  constraint job_crew_assignments_crew_name_chk
    check (char_length(btrim(crew_name_snapshot)) between 1 and 80),
  constraint job_crew_assignments_lead_snapshot_chk
    check ((assignment_lead_person_id is null) = (assignment_lead_name_snapshot is null)),
  constraint job_crew_assignments_end_chk
    check ((ended_at is null) = (ended_by is null) and (ended_at is null) = (end_reason is null)),
  constraint job_crew_assignments_end_order_chk
    check (ended_at is null or ended_at >= started_at),
  constraint job_crew_assignments_end_reason_chk
    check (end_reason is null or end_reason in ('replaced', 'lead_changed', 'ended', 'job_closed')),
  constraint job_crew_assignments_request_id_chk
    check (request_id is null or char_length(request_id) between 1 and 120),
  constraint job_crew_assignments_supersedes_self_chk
    check (supersedes_assignment_id is null or supersedes_assignment_id <> id)
);

comment on table public.job_crew_assignments is
  'Durable Job -> Crew assignment. Active (ended_at is null) means currently assigned/responsible, not attendance. Not a schedule, roster, Coordinator, or access grant. Write-once except the single end transition.';

-- First-release primary mode only: one active primary Crew per Job. Non-primary rows are not constrained.
create unique index job_crew_assignments_one_active_primary_uidx
  on public.job_crew_assignments (job_id)
  where is_primary and ended_at is null;

create unique index job_crew_assignments_request_uidx
  on public.job_crew_assignments (company_id, request_id)
  where request_id is not null;

create unique index job_crew_assignments_supersedes_uidx
  on public.job_crew_assignments (supersedes_assignment_id)
  where supersedes_assignment_id is not null;

create index job_crew_assignments_job_history_idx
  on public.job_crew_assignments (company_id, job_id, started_at desc);

create index job_crew_assignments_crew_active_idx
  on public.job_crew_assignments (company_id, crew_id)
  where ended_at is null;

create index job_crew_assignments_lead_active_idx
  on public.job_crew_assignments (company_id, assignment_lead_person_id)
  where ended_at is null and assignment_lead_person_id is not null;

-- Roster listed at assignment: actual active Crew members when the row started. A usual Lead
-- who is not a member is not listed. Zero rows means members not listed, not that nobody worked.
create table public.job_crew_assignment_roster (
  assignment_id uuid not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  person_id uuid not null,
  display_name_snapshot text not null,
  constraint job_crew_assignment_roster_pkey primary key (assignment_id, person_id),
  constraint job_crew_assignment_roster_assignment_fk
    foreign key (assignment_id, company_id) references public.job_crew_assignments (id, company_id) on delete cascade,
  constraint job_crew_assignment_roster_person_fk
    foreign key (person_id, company_id) references public.company_people (id, company_id),
  constraint job_crew_assignment_roster_name_chk
    check (char_length(btrim(display_name_snapshot)) between 1 and 80)
);

comment on table public.job_crew_assignment_roster is
  'Crew members listed when a Job Crew assignment started. A recorded plan, not attendance, hours, or payroll. Immutable.';

create index job_crew_assignment_roster_person_idx
  on public.job_crew_assignment_roster (company_id, person_id);

-- ---------------------------------------------------------------------------
-- Immutability
-- ---------------------------------------------------------------------------
create or replace function private.job_crew_assignments_immutable_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.ended_at is not null then
    raise exception 'job_crew_assignments: ended assignment is immutable' using errcode = '23514';
  end if;
  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.job_id is distinct from old.job_id
     or new.crew_id is distinct from old.crew_id
     or new.is_primary is distinct from old.is_primary
     or new.assignment_lead_person_id is distinct from old.assignment_lead_person_id
     or new.crew_name_snapshot is distinct from old.crew_name_snapshot
     or new.assignment_lead_name_snapshot is distinct from old.assignment_lead_name_snapshot
     or new.started_at is distinct from old.started_at
     or new.started_by is distinct from old.started_by
     or new.request_id is distinct from old.request_id
     or new.supersedes_assignment_id is distinct from old.supersedes_assignment_id then
    raise exception 'job_crew_assignments: assignment facts are immutable' using errcode = '23514';
  end if;
  if new.ended_at is null or new.ended_by is null or new.end_reason is null then
    raise exception 'job_crew_assignments: only the end transition is allowed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger job_crew_assignments_immutable
  before update on public.job_crew_assignments
  for each row execute function private.job_crew_assignments_immutable_trg_v1();

create or replace function private.job_crew_assignment_roster_immutable_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception 'job_crew_assignment_roster: roster snapshot is immutable' using errcode = '23514';
end;
$$;

create trigger job_crew_assignment_roster_immutable
  before update on public.job_crew_assignment_roster
  for each row execute function private.job_crew_assignment_roster_immutable_trg_v1();

alter table public.job_crew_assignments enable row level security;
alter table public.job_crew_assignment_roster enable row level security;

revoke all on table public.job_crew_assignments, public.job_crew_assignment_roster
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Result helper: the committed outcome of a set_primary_job_crew_v1 row
-- ---------------------------------------------------------------------------
create or replace function private.job_crew_set_result_v1(
  p_row public.job_crew_assignments,
  p_changed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_previous_crew_id uuid;
  v_kind text := 'assigned';
begin
  if p_row.supersedes_assignment_id is not null then
    select a.crew_id into v_previous_crew_id
    from public.job_crew_assignments a
    where a.id = p_row.supersedes_assignment_id and a.company_id = p_row.company_id;
    v_kind := case when v_previous_crew_id = p_row.crew_id then 'lead_changed' else 'replaced' end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'changed', p_changed,
    'kind', v_kind,
    'job_id', p_row.job_id,
    'assignment_id', p_row.id,
    'supersedes_assignment_id', p_row.supersedes_assignment_id,
    'current_primary_assignment_id', (
      select a.id from public.job_crew_assignments a
      where a.company_id = p_row.company_id and a.job_id = p_row.job_id
        and a.is_primary and a.ended_at is null
    )
  );
end;
$$;

-- A previously committed request: same parameters replay the original result; different
-- parameters are a conflict. Returns null when the request id is unused.
create or replace function private.job_crew_replay_v1(
  p_company_id uuid,
  p_request_id text,
  p_job_id uuid,
  p_crew_id uuid,
  p_assignment_lead_person_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_prior public.job_crew_assignments%rowtype;
begin
  select * into v_prior from public.job_crew_assignments a
  where a.company_id = p_company_id and a.request_id = p_request_id;
  if not found then
    return null;
  end if;
  if v_prior.job_id is distinct from p_job_id
     or v_prior.crew_id is distinct from p_crew_id
     or v_prior.assignment_lead_person_id is distinct from p_assignment_lead_person_id then
    return jsonb_build_object('ok', false, 'code', 'request_id_conflict');
  end if;
  return private.job_crew_set_result_v1(v_prior, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Assign / Replace / Change Assignment Lead (primary mode)
-- ---------------------------------------------------------------------------
-- Order: auth, company-scope jobs.assign, payload, REPLAY, lock Job, disposition,
-- stale expected primary, Crew/Lead eligibility, write. Replay precedes every
-- current-state check so a lost-response retry returns its original success.
create or replace function public.set_primary_job_crew_v1(
  p_job_id uuid,
  p_crew_id uuid,
  p_assignment_lead_person_id uuid default null,
  p_expected_primary_assignment_id uuid default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_replay jsonb;
  v_job public.jobs%rowtype;
  v_current public.job_crew_assignments%rowtype;
  v_has_current boolean := false;
  v_crew public.crews%rowtype;
  v_lead_name text;
  v_kind text;
  v_now timestamptz := now();
  v_row public.job_crew_assignments%rowtype;
  v_roster_count integer;
  v_event_type text;
  v_payload jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_job_id is null or p_crew_id is null or p_request_id is null
     or char_length(p_request_id) not between 1 and 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  v_replay := private.job_crew_replay_v1(
    v_company_id, p_request_id, p_job_id, p_crew_id, p_assignment_lead_person_id
  );
  if v_replay is not null then
    return v_replay;
  end if;

  begin
    select * into v_job from public.jobs j
    where j.id = p_job_id and j.company_id = v_company_id and j.deleted_at is null
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;

    -- A concurrent identical request may have committed while this one waited on the Job lock.
    v_replay := private.job_crew_replay_v1(
      v_company_id, p_request_id, p_job_id, p_crew_id, p_assignment_lead_person_id
    );
    if v_replay is not null then
      return v_replay;
    end if;

    if v_job.status in ('on_hold', 'lost', 'closed') then
      return jsonb_build_object('ok', false, 'code', 'disposition_blocks_assignment');
    end if;

    select * into v_current from public.job_crew_assignments a
    where a.company_id = v_company_id and a.job_id = p_job_id and a.is_primary and a.ended_at is null
    for update;
    v_has_current := found;

    if (case when v_has_current then v_current.id end) is distinct from p_expected_primary_assignment_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'stale_assignment',
        'current_primary_assignment_id', case when v_has_current then v_current.id end
      );
    end if;

    select * into v_crew from public.crews c
    where c.id = p_crew_id and c.company_id = v_company_id and c.archived_at is null;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'crew_not_eligible');
    end if;

    if p_assignment_lead_person_id is not null then
      select p.display_name into v_lead_name from public.company_people p
      where p.id = p_assignment_lead_person_id and p.company_id = v_company_id and p.archived_at is null;
      if not found then
        return jsonb_build_object('ok', false, 'code', 'lead_not_eligible');
      end if;
    end if;

    if v_has_current
       and v_current.crew_id = p_crew_id
       and v_current.assignment_lead_person_id is not distinct from p_assignment_lead_person_id then
      return private.job_crew_set_result_v1(v_current, false);
    end if;

    v_kind := case
      when not v_has_current then 'assigned'
      when v_current.crew_id <> p_crew_id then 'replaced'
      else 'lead_changed'
    end;

    if v_has_current then
      update public.job_crew_assignments
      set ended_at = v_now, ended_by = v_uid, end_reason = v_kind
      where id = v_current.id;
    end if;

    insert into public.job_crew_assignments (
      company_id, job_id, crew_id, is_primary, assignment_lead_person_id,
      crew_name_snapshot, assignment_lead_name_snapshot, started_at, started_by,
      request_id, supersedes_assignment_id
    ) values (
      v_company_id, p_job_id, p_crew_id, true, p_assignment_lead_person_id,
      v_crew.name, v_lead_name, v_now, v_uid,
      p_request_id, case when v_has_current then v_current.id end
    )
    returning * into v_row;

    insert into public.job_crew_assignment_roster (assignment_id, company_id, person_id, display_name_snapshot)
    select v_row.id, v_company_id, p.id, p.display_name
    from public.crew_members cm
    join public.company_people p on p.id = cm.person_id and p.company_id = cm.company_id
    where cm.company_id = v_company_id and cm.crew_id = p_crew_id
      and cm.removed_at is null and p.archived_at is null;
    get diagnostics v_roster_count = row_count;

    v_payload := jsonb_build_object(
      'assignment_id', v_row.id,
      'crew_id', v_row.crew_id,
      'crew_name', v_row.crew_name_snapshot,
      'is_primary', v_row.is_primary,
      'assignment_lead_person_id', v_row.assignment_lead_person_id,
      'assignment_lead_name', v_row.assignment_lead_name_snapshot,
      'roster_listed_count', v_roster_count
    );
    if v_kind = 'assigned' then
      v_event_type := 'job_crew_assigned';
    elsif v_kind = 'replaced' then
      v_event_type := 'job_crew_replaced';
      v_payload := v_payload || jsonb_build_object(
        'previous_assignment_id', v_current.id,
        'previous_crew_id', v_current.crew_id,
        'previous_crew_name', v_current.crew_name_snapshot
      );
    else
      v_event_type := 'job_crew_assignment_lead_changed';
      v_payload := v_payload || jsonb_build_object(
        'previous_assignment_id', v_current.id,
        'previous_assignment_lead_person_id', v_current.assignment_lead_person_id,
        'previous_assignment_lead_name', v_current.assignment_lead_name_snapshot
      );
    end if;

    perform public.job_lifecycle_insert_activity(
      v_company_id, p_job_id, v_event_type, v_uid, v_payload, v_now
    );

    return private.job_crew_set_result_v1(v_row, true);
  exception
    when unique_violation then
      v_replay := private.job_crew_replay_v1(
        v_company_id, p_request_id, p_job_id, p_crew_id, p_assignment_lead_person_id
      );
      if v_replay is not null then
        return v_replay;
      end if;
      return jsonb_build_object('ok', false, 'code', 'stale_assignment');
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- End / Clear (allowed in every disposition; idempotent by assignment id)
-- ---------------------------------------------------------------------------
create or replace function public.end_job_crew_assignment_v1(
  p_job_id uuid,
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_row public.job_crew_assignments%rowtype;
  v_now timestamptz := now();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_job_id is null or p_assignment_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  perform 1 from public.jobs j
  where j.id = p_job_id and j.company_id = v_company_id and j.deleted_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into v_row from public.job_crew_assignments a
  where a.id = p_assignment_id and a.company_id = v_company_id and a.job_id = p_job_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_row.ended_at is not null then
    return jsonb_build_object(
      'ok', true, 'changed', false, 'job_id', p_job_id,
      'assignment_id', v_row.id, 'end_reason', v_row.end_reason
    );
  end if;

  update public.job_crew_assignments
  set ended_at = v_now, ended_by = v_uid, end_reason = 'ended'
  where id = v_row.id;

  perform public.job_lifecycle_insert_activity(
    v_company_id, p_job_id, 'job_crew_assignment_ended', v_uid,
    jsonb_build_object(
      'assignment_id', v_row.id,
      'crew_id', v_row.crew_id,
      'crew_name', v_row.crew_name_snapshot,
      'is_primary', v_row.is_primary,
      'end_reason', 'ended'
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true, 'changed', true, 'job_id', p_job_id,
    'assignment_id', v_row.id, 'end_reason', 'ended'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Read: assignment history for one Job (jobs.read on that Job)
-- ---------------------------------------------------------------------------
-- Names only. No phone, email, login id, actor id, access fact, current roster, or Coordinator.
create or replace function public.get_job_crew_assignments_v1(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid := private.current_active_company_id();
begin
  if auth.uid() is null or v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_job_id is null or not private.member_can_v1('jobs.read', p_job_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if not exists (
    select 1 from public.jobs j
    where j.id = p_job_id and j.company_id = v_company_id and j.deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'primary_active_assignment_id', (
      select a.id from public.job_crew_assignments a
      where a.company_id = v_company_id and a.job_id = p_job_id and a.is_primary and a.ended_at is null
    ),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'crew_id', a.crew_id,
        'is_primary', a.is_primary,
        'started_at', a.started_at,
        'ended_at', a.ended_at,
        'end_reason', a.end_reason,
        'supersedes_assignment_id', a.supersedes_assignment_id,
        'crew_name_snapshot', a.crew_name_snapshot,
        'crew_current_name', c.name,
        'crew_archived', c.archived_at is not null,
        'assignment_lead_person_id', a.assignment_lead_person_id,
        'assignment_lead_name_snapshot', a.assignment_lead_name_snapshot,
        'assignment_lead_archived', case when a.assignment_lead_person_id is null then null else lp.archived_at is not null end,
        'roster', coalesce((
          select jsonb_agg(jsonb_build_object(
            'person_id', r.person_id,
            'display_name_snapshot', r.display_name_snapshot
          ) order by lower(r.display_name_snapshot), r.person_id)
          from public.job_crew_assignment_roster r
          where r.company_id = v_company_id and r.assignment_id = a.id
        ), '[]'::jsonb),
        'roster_listed_count', (
          select count(*) from public.job_crew_assignment_roster r
          where r.company_id = v_company_id and r.assignment_id = a.id
        )
      ) order by a.started_at desc, a.id desc)
      from public.job_crew_assignments a
      join public.crews c on c.id = a.crew_id and c.company_id = a.company_id
      left join public.company_people lp on lp.id = a.assignment_lead_person_id and lp.company_id = a.company_id
      where a.company_id = v_company_id and a.job_id = p_job_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Person archival: blocked while that Person is an active Assignment Lead.
-- Copied from 20260929130000_phase13c_team_board_people_crews.sql; the only
-- addition is the person_active_assignment_lead check.
-- ---------------------------------------------------------------------------
create or replace function public.archive_company_person_v1(
  p_person_id uuid,
  p_expected_row_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_person public.company_people%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_person_id is null or p_expected_row_version is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_person from public.company_people p
  where p.id = p_person_id and p.company_id = v_company_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_person.archived_at is not null then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;
  if v_person.row_version <> p_expected_row_version then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'row_version', v_person.row_version);
  end if;
  if v_person.linked_user_id is not null and exists (
    select 1 from public.company_memberships m
    where m.user_id = v_person.linked_user_id and m.company_id = v_company_id and m.removed_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'linked_login_active');
  end if;
  -- An active assignment cannot keep an archived Person as its current Assignment Lead.
  -- The user changes or clears the Lead, or ends the assignment, first. History is never rewritten.
  if exists (
    select 1 from public.job_crew_assignments a
    where a.company_id = v_company_id and a.assignment_lead_person_id = p_person_id and a.ended_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'person_active_assignment_lead');
  end if;

  update public.crew_members
  set removed_at = now(), removed_by = auth.uid()
  where company_id = v_company_id and person_id = p_person_id and removed_at is null;

  update public.crews
  set usual_lead_person_id = null, updated_at = now(), row_version = row_version + 1
  where company_id = v_company_id and usual_lead_person_id = p_person_id and archived_at is null;

  update public.company_people
  set archived_at = now(), archived_by = auth.uid(), updated_at = now(), row_version = row_version + 1
  where id = p_person_id;

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Crew archival: blocked while the Crew has any active assignment.
-- Copied from 20260929130000_phase13c_team_board_people_crews.sql; the only
-- addition is the crew_actively_assigned check. Roster history is kept.
-- ---------------------------------------------------------------------------
create or replace function public.archive_crew_v1(
  p_crew_id uuid,
  p_expected_row_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_crew public.crews%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_crew_id is null or p_expected_row_version is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_crew from public.crews c
  where c.id = p_crew_id and c.company_id = v_company_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_crew.archived_at is not null then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;
  if v_crew.row_version <> p_expected_row_version then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'row_version', v_crew.row_version);
  end if;
  if exists (
    select 1 from public.job_crew_assignments a
    where a.company_id = v_company_id and a.crew_id = p_crew_id and a.ended_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'crew_actively_assigned');
  end if;

  update public.crews
  set archived_at = now(), archived_by = auth.uid(), updated_at = now(), row_version = row_version + 1
  where id = v_crew.id;

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- change_job_disposition_v1: copied exactly from
-- 20260927193000_phase13b_c_rpc_canonical_capabilities.sql. The only additions are
-- the regions between the phase13c job crew markers: a transition to closed ends
-- every active Crew assignment (primary and non-primary) with end_reason job_closed
-- and writes one job_crew_assignment_ended event each, in the same transaction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_job_disposition_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- phase13c job crew: begin
  v_crew_assignment public.job_crew_assignments%rowtype;
  -- phase13c job crew: end
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
      and cm.removed_at is null
      and (private.member_can_v1('jobs.hold') or private.member_can_v1('jobs.finalize'))
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

  -- phase13c job crew: begin
  if v_to = 'closed' then
    for v_crew_assignment in
      update public.job_crew_assignments a
      set ended_at = v_now, ended_by = v_uid, end_reason = 'job_closed'
      where a.company_id = v_company_id
        and a.job_id = v_job_id
        and a.ended_at is null
      returning a.*
    loop
      perform public.job_lifecycle_insert_activity(
        v_company_id,
        v_job_id,
        'job_crew_assignment_ended',
        v_uid,
        jsonb_build_object(
          'assignment_id', v_crew_assignment.id,
          'crew_id', v_crew_assignment.crew_id,
          'crew_name', v_crew_assignment.crew_name_snapshot,
          'is_primary', v_crew_assignment.is_primary,
          'end_reason', 'job_closed'
        ),
        v_now
      );
    end loop;
  end if;
  -- phase13c job crew: end

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
$function$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on function private.job_crew_assignments_immutable_trg_v1() from public;
revoke all on function private.job_crew_assignment_roster_immutable_trg_v1() from public;
revoke all on function private.job_crew_set_result_v1(public.job_crew_assignments, boolean) from public;
revoke all on function private.job_crew_replay_v1(uuid, text, uuid, uuid, uuid) from public;

revoke all on function public.set_primary_job_crew_v1(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.end_job_crew_assignment_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_job_crew_assignments_v1(uuid) from public, anon, authenticated;

grant execute on function public.set_primary_job_crew_v1(uuid, uuid, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.end_job_crew_assignment_v1(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_job_crew_assignments_v1(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Activity event types (canonical list; must match JOB_ACTIVITY_EVENT_TYPES).
-- Keep this the final statement in the file.
-- ---------------------------------------------------------------------------
alter table public.job_activity_events
  drop constraint if exists job_activity_events_type_check;

alter table public.job_activity_events
  add constraint job_activity_events_type_check check (
    event_type = any (
      array[
        'job_created'::text,
        'stage_changed'::text,
        'disposition_changed'::text,
        'job_scheduled'::text,
        'job_rescheduled'::text,
        'job_unscheduled'::text,
        'job_work_started'::text,
        'job_work_completed'::text,
        'production_lead_assigned'::text,
        'production_lead_changed'::text,
        'production_lead_cleared'::text,
        'scope_change_created'::text,
        'scope_change_proposed'::text,
        'scope_change_authorized'::text,
        'scope_change_declined'::text,
        'scope_change_voided'::text,
        'payment_request_emailed'::text,
        'payment_request_email_failed'::text,
        'job_crew_assigned'::text,
        'job_crew_replaced'::text,
        'job_crew_assignment_ended'::text,
        'job_crew_assignment_lead_changed'::text
      ]
    )
  );
