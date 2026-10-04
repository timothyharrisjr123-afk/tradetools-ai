-- Phase 13C Crew integration slice 1: smart Crew lifecycle + current-Crew projections.
--
-- A Crew assignment says who is CURRENTLY responsible for doing the work on a Job.
-- History says who WAS responsible. When the work can no longer be done by that Crew
-- (Lost, Complete, Closed) the assignment ends on its own, in the same transaction as
-- the lifecycle transition, with an explicit end reason. Reopening never restores a
-- Crew. On hold keeps the Crew.
--
-- The single durable place is an AFTER UPDATE trigger on public.jobs: every writer of
-- jobs.status (change_job_disposition_v1) and of stage Complete (complete_job_work_v1)
-- already holds the Job row lock and runs through it, and no client can write either
-- column. change_job_disposition_v1 goes back to the exact 13B-C definition; its inline
-- close block moves here.
--
-- Semantic keys only. No display word (Crew, Lead, Coordinator, Project Manager) is
-- used for authority, lifecycle, or security. Names are returned for display only.

-- ---------------------------------------------------------------------------
-- End reasons: lifecycle reasons are explicit, never overloaded.
-- ---------------------------------------------------------------------------
alter table public.job_crew_assignments
  drop constraint job_crew_assignments_end_reason_chk;

alter table public.job_crew_assignments
  add constraint job_crew_assignments_end_reason_chk
    check (end_reason is null or end_reason in ('replaced', 'lead_changed', 'ended', 'job_lost', 'job_completed', 'job_closed'));

-- ---------------------------------------------------------------------------
-- Lifecycle: Lost / Complete / Closed end every active assignment of the Job.
-- ---------------------------------------------------------------------------
-- Idempotent by construction: only rows with ended_at is null are touched, so Close
-- after Complete (or a replayed transition) ends nothing and writes no event.
create or replace function private.job_crew_end_on_job_lifecycle_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_reason text;
  v_actor uuid := auth.uid();
  v_now timestamptz := now();
  v_row public.job_crew_assignments%rowtype;
begin
  if new.status is distinct from old.status and new.status = 'lost' then
    v_reason := 'job_lost';
  elsif new.status is distinct from old.status and new.status = 'closed' then
    v_reason := 'job_closed';
  elsif new.stage is distinct from old.stage and new.stage = 'complete' then
    v_reason := 'job_completed';
  else
    return null;
  end if;

  for v_row in
    update public.job_crew_assignments a
    set ended_at = v_now, ended_by = coalesce(v_actor, a.started_by), end_reason = v_reason
    where a.company_id = new.company_id
      and a.job_id = new.id
      and a.ended_at is null
    returning a.*
  loop
    perform public.job_lifecycle_insert_activity(
      new.company_id,
      new.id,
      'job_crew_assignment_ended',
      v_actor,
      jsonb_build_object(
        'assignment_id', v_row.id,
        'crew_id', v_row.crew_id,
        'crew_name', v_row.crew_name_snapshot,
        'is_primary', v_row.is_primary,
        'end_reason', v_reason
      ),
      v_now
    );
  end loop;

  return null;
end;
$$;

create trigger jobs_crew_assignment_lifecycle
  after update of status, stage on public.jobs
  for each row
  when (
    (new.status is distinct from old.status and new.status in ('lost', 'closed'))
    or (new.stage is distinct from old.stage and new.stage = 'complete')
  )
  execute function private.job_crew_end_on_job_lifecycle_trg_v1();

-- Backfill: Jobs already Lost / Closed / Complete keep no current Crew.
do $$
declare
  v_row record;
begin
  for v_row in
    update public.job_crew_assignments a
    set ended_at = greatest(now(), a.started_at),
        ended_by = a.started_by,
        end_reason = case
          when j.status = 'lost' then 'job_lost'
          when j.status = 'closed' then 'job_closed'
          else 'job_completed'
        end
    from public.jobs j
    where j.id = a.job_id
      and j.company_id = a.company_id
      and a.ended_at is null
      and j.deleted_at is null
      and (j.status in ('lost', 'closed') or j.stage = 'complete')
    returning a.*
  loop
    perform public.job_lifecycle_insert_activity(
      v_row.company_id,
      v_row.job_id,
      'job_crew_assignment_ended',
      null,
      jsonb_build_object(
        'assignment_id', v_row.id,
        'crew_id', v_row.crew_id,
        'crew_name', v_row.crew_name_snapshot,
        'is_primary', v_row.is_primary,
        'end_reason', v_row.end_reason,
        'source', 'lifecycle_backfill'
      ),
      v_row.ended_at
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- change_job_disposition_v1: restored exactly to
-- 20260927193000_phase13b_c_rpc_canonical_capabilities.sql. Closing no longer ends
-- assignments inline; jobs_crew_assignment_lifecycle does, in the same transaction.
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
-- set_primary_job_crew_v1: copied from 20260930120000_phase13c_job_crew_assignments.sql.
-- The only addition (between the phase13c crew lifecycle markers): a Job whose CURRENT
-- stage is Complete takes no new Crew. The guard reads only the locked row's current
-- stage, never history. Complete is terminal in the lifecycle (no writer leaves it and
-- completed_at is immutable); Reopen changes disposition only. A Job reopened from Lost,
-- Closed, or On hold at any non-Complete stage takes a new Crew explicitly.
-- ---------------------------------------------------------------------------
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

    -- phase13c crew lifecycle: begin
    if v_job.stage = 'complete' then
      return jsonb_build_object('ok', false, 'code', 'work_complete_blocks_assignment');
    end if;
    -- phase13c crew lifecycle: end

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
-- get_job_crew_assignments_v1: copied from 20260930120000_phase13c_job_crew_assignments.sql.
-- The only addition: the Assignment Lead's live Person name. Snapshots stay as history.
-- ---------------------------------------------------------------------------
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
        -- phase13c crew lifecycle: begin
        'assignment_lead_current_name', lp.display_name,
        -- phase13c crew lifecycle: end
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
-- archive_crew_v1: copied from 20260930120000_phase13c_job_crew_assignments.sql.
-- The only change: the block names the Job(s) keeping the Crew current. Jobs the caller
-- cannot read are counted, never named.
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
  -- phase13c crew lifecycle: begin
  if exists (
    select 1 from public.job_crew_assignments a
    where a.company_id = v_company_id and a.crew_id = p_crew_id and a.ended_at is null
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'crew_actively_assigned',
      'blocking_job_count', (
        select count(distinct a.job_id) from public.job_crew_assignments a
        where a.company_id = v_company_id and a.crew_id = p_crew_id and a.ended_at is null
      ),
      'blocking_jobs', coalesce((
        select jsonb_agg(jsonb_build_object('job_id', b.job_id, 'label', b.label) order by b.started_at desc, b.job_id)
        from (
          select a.job_id,
                 max(a.started_at) as started_at,
                 coalesce(nullif(btrim(j.customer_name), ''), nullif(btrim(j.job_name), ''), 'Job') as label
          from public.job_crew_assignments a
          join public.jobs j on j.id = a.job_id and j.company_id = a.company_id
          where a.company_id = v_company_id and a.crew_id = p_crew_id and a.ended_at is null
            and j.deleted_at is null
            and private.member_can_v1('jobs.read', a.job_id)
          group by a.job_id, j.customer_name, j.job_name
          order by max(a.started_at) desc, a.job_id
          limit 5
        ) b
      ), '[]'::jsonb)
    );
  end if;
  -- phase13c crew lifecycle: end

  update public.crews
  set archived_at = now(), archived_by = auth.uid(), updated_at = now(), row_version = row_version + 1
  where id = v_crew.id;

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Read: current Crew(s) for many Jobs (jobs.read on each Job; others omitted)
-- ---------------------------------------------------------------------------
-- Every readable Job is returned, with an empty list when it has no current Crew, so
-- "no Crew" is never confused with "not readable". A list per Job leaves room for
-- concurrent Crews. Live Crew and Person names; the Lead snapshot only as a fallback.
-- No role, title, email, login, access fact, Coordinator, or crew_label.
create or replace function public.list_job_current_crews_v1(p_job_ids uuid[])
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
  if p_job_ids is null or cardinality(p_job_ids) > 200 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  return jsonb_build_object(
    'ok', true,
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'job_id', j.id,
        'crews', coalesce((
          select jsonb_agg(jsonb_build_object(
            'assignment_id', a.id,
            'crew_id', a.crew_id,
            'crew_name', c.name,
            'is_primary', a.is_primary,
            'assignment_lead_person_id', a.assignment_lead_person_id,
            'assignment_lead_name', case
              when a.assignment_lead_person_id is null then null
              else coalesce(lp.display_name, a.assignment_lead_name_snapshot)
            end
          ) order by a.is_primary desc, a.started_at, a.id)
          from public.job_crew_assignments a
          join public.crews c on c.id = a.crew_id and c.company_id = a.company_id
          left join public.company_people lp on lp.id = a.assignment_lead_person_id and lp.company_id = a.company_id
          where a.company_id = v_company_id and a.job_id = j.id and a.ended_at is null
        ), '[]'::jsonb)
      ) order by j.id)
      from public.jobs j
      where j.company_id = v_company_id
        and j.id = any(p_job_ids)
        and j.deleted_at is null
        and private.member_can_v1('jobs.read', j.id)
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Read: Crew week (current assignment x Calendar schedule over a civil range)
-- ---------------------------------------------------------------------------
-- Read-only join of two truths: the Job's current Crew and the Job's Calendar work
-- schedule. Not a second scheduler; Crews carry no dates. A Job appears only when the
-- caller can read the Job and its schedule. Terminal Jobs have no current Crew.
-- Civil overlap: starts_on < after_end_on and ends_on >= starts_on (ends_on inclusive).
create or replace function public.get_crew_week_v1(p_starts_on date, p_after_end_on date)
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
  if p_starts_on is null or p_after_end_on is null
     or p_after_end_on <= p_starts_on or p_after_end_on - p_starts_on > 42 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  return jsonb_build_object(
    'ok', true,
    'starts_on', p_starts_on,
    'after_end_on', p_after_end_on,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'crew_id', a.crew_id,
        'crew_name', c.name,
        'assignment_id', a.id,
        'is_primary', a.is_primary,
        'assignment_lead_person_id', a.assignment_lead_person_id,
        'assignment_lead_name', case
          when a.assignment_lead_person_id is null then null
          else coalesce(lp.display_name, a.assignment_lead_name_snapshot)
        end,
        'job_id', j.id,
        'customer_name', coalesce(nullif(btrim(j.customer_name), ''), nullif(btrim(j.job_name), ''), 'Job'),
        'address', coalesce(
          nullif(btrim(j.address_formatted), ''),
          nullif(concat_ws(', ', nullif(btrim(j.address_line1), ''), nullif(btrim(j.address_city), ''), nullif(btrim(j.address_state), '')), ''),
          ''
        ),
        'job_status', j.status,
        'starts_on', s.starts_on,
        'ends_on', coalesce(s.ends_on, s.starts_on)
      ) order by s.starts_on, lower(c.name), a.crew_id, j.id)
      from public.job_crew_assignments a
      join public.crews c on c.id = a.crew_id and c.company_id = a.company_id
      join public.jobs j on j.id = a.job_id and j.company_id = a.company_id
      join public.job_schedules s
        on s.job_id = a.job_id and s.company_id = a.company_id and s.kind = 'work' and s.status = 'scheduled'
      left join public.company_people lp on lp.id = a.assignment_lead_person_id and lp.company_id = a.company_id
      where a.company_id = v_company_id
        and a.ended_at is null
        and j.deleted_at is null
        and j.status not in ('lost', 'closed')
        and j.stage <> 'complete'
        and s.starts_on < p_after_end_on
        and coalesce(s.ends_on, s.starts_on) >= p_starts_on
        and private.member_can_v1('jobs.read', j.id)
        and private.member_can_v1('schedule.read', j.id)
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Legacy crew_label: free text from before durable Crews. Read-only for clients.
-- Staging had no client UPDATE privilege; this keeps every environment the same.
-- ---------------------------------------------------------------------------
revoke update (crew_label) on public.jobs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on function private.job_crew_end_on_job_lifecycle_trg_v1() from public;

revoke all on function public.list_job_current_crews_v1(uuid[]) from public, anon, authenticated;
revoke all on function public.get_crew_week_v1(date, date) from public, anon, authenticated;

grant execute on function public.list_job_current_crews_v1(uuid[]) to authenticated, service_role;
grant execute on function public.get_crew_week_v1(date, date) to authenticated, service_role;
