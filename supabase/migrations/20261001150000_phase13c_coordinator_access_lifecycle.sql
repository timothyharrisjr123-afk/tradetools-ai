-- Phase 13C slice 2: Coordinator-derived Job access follows the responsibility.
--
-- job_access_grants keeps one active grant per (job, user) and records the reason that
-- opened it in `source`. This migration keeps that single reason system honest:
--   * Assigning a scoped Field member as Coordinator still opens the Job for them
--     (source production_lead_assignment, existing coupling trigger).
--   * When the Coordinator changes or is cleared, the former Coordinator's grant ends
--     only if its source is production_lead_assignment and no other live reason exists.
--     A live task assignment on the Job keeps the grant, re-sourced to task_assignment.
--     manual, invitation, migration, and task_assignment grants are never touched here.
--   * An explicit manual grant over a derived grant records the explicit reason (manual),
--     so it outlives the assignment that first opened the Job.
-- All of it runs inside the Coordinator write's transaction (AFTER trigger on jobs).

-- ---------------------------------------------------------------------------
-- Live derived reason for a member's access to one Job.
-- ---------------------------------------------------------------------------
create or replace function private.job_access_derived_reason_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when exists (
      select 1 from public.jobs j
      where j.id = p_job_id and j.company_id = p_company_id and j.assigned_to = p_user_id
    ) then 'production_lead_assignment'
    when exists (
      select 1 from public.job_tasks t
      where t.company_id = p_company_id and t.job_id = p_job_id
        and t.assigned_to = p_user_id and t.deleted_at is null
    ) then 'task_assignment'
  end;
$$;

comment on function private.job_access_derived_reason_v1(uuid, uuid, uuid) is
  'The assignment that currently justifies a member''s derived Job access: production_lead_assignment (they coordinate the Job), task_assignment (a live task on the Job), else null.';

-- ---------------------------------------------------------------------------
-- End the former Coordinator's Coordinator-sourced grant, and nothing else.
-- Returns: none | kept_independent | kept_current | kept_task_assignment | revoked.
-- ---------------------------------------------------------------------------
create or replace function private.retire_coordinator_job_access_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_grant public.job_access_grants%rowtype;
  v_member public.company_memberships%rowtype;
  v_reason text;
  v_new_revision bigint;
begin
  if p_user_id is null then
    return 'none';
  end if;

  select * into v_grant
  from public.job_access_grants g
  where g.company_id = p_company_id and g.job_id = p_job_id and g.user_id = p_user_id
    and g.revoked_at is null
  for update;
  if not found then
    return 'none';
  end if;
  if v_grant.source <> 'production_lead_assignment' then
    return 'kept_independent';
  end if;

  v_reason := private.job_access_derived_reason_v1(p_company_id, p_job_id, p_user_id);
  if v_reason = 'production_lead_assignment' then
    return 'kept_current';
  end if;
  if v_reason = 'task_assignment' then
    update public.job_access_grants set source = 'task_assignment' where id = v_grant.id;
    return 'kept_task_assignment';
  end if;

  update public.job_access_grants
  set revoked_at = now(), revoked_by = auth.uid()
  where id = v_grant.id;

  select * into v_member
  from public.company_memberships m
  where m.company_id = p_company_id and m.user_id = p_user_id
  for update;
  if found then
    v_new_revision := v_member.access_revision + 1;
    update public.company_memberships set access_revision = v_new_revision where id = v_member.id;
    perform private.record_access_event_v1(
      p_company_id, p_user_id, 'job_access_revoked', 'system', p_job_id,
      v_member.access_revision, v_new_revision, null, null, null, 'production_lead_assignment'
    );
  end if;
  return 'revoked';
end;
$$;

comment on function private.retire_coordinator_job_access_v1(uuid, uuid, uuid) is
  'Ends a former Coordinator''s production_lead_assignment grant on one Job unless another live reason exists. Never touches manual, invitation, migration, or task_assignment grants.';

-- ---------------------------------------------------------------------------
-- Assignment coupling: unchanged grant rules, plus Coordinator retirement.
-- ---------------------------------------------------------------------------
create or replace function private.job_assignment_access_coupling_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job_id uuid;
  v_source text;
  v_member public.company_memberships%rowtype;
  v_new_revision bigint;
begin
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return null;
  end if;
  if tg_table_name = 'jobs' then
    v_job_id := new.id;
    v_source := 'production_lead_assignment';
    if tg_op = 'UPDATE' and old.assigned_to is not null then
      perform private.retire_coordinator_job_access_v1(new.company_id, new.id, old.assigned_to);
    end if;
  else
    v_job_id := new.job_id;
    v_source := 'task_assignment';
  end if;
  if new.assigned_to is null then
    return null;
  end if;

  select * into v_member
  from public.company_memberships m
  where m.company_id = new.company_id and m.user_id = new.assigned_to and m.removed_at is null
  for update;
  if not found or v_member.role <> 'field_user' then
    return null;
  end if;
  if exists (
    select 1 from public.job_access_grants g
    where g.job_id = v_job_id and g.user_id = new.assigned_to and g.revoked_at is null
  ) then
    return null;
  end if;
  if auth.uid() is not null and not private.member_can_v1('jobs.assign') then
    return null;
  end if;

  insert into public.job_access_grants (company_id, job_id, user_id, granted_by, source)
  values (new.company_id, v_job_id, new.assigned_to, auth.uid(), v_source);
  v_new_revision := v_member.access_revision + 1;
  update public.company_memberships set access_revision = v_new_revision where id = v_member.id;
  perform private.record_access_event_v1(
    new.company_id, new.assigned_to, 'job_access_granted', 'system', v_job_id,
    v_member.access_revision, v_new_revision, null, null, null, v_source
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Manual grant/revoke: unchanged, except an explicit grant over a derived grant
-- records the explicit reason.
-- ---------------------------------------------------------------------------
create or replace function private.change_job_access_v1(
  p_grant boolean,
  p_target_user_id uuid,
  p_job_id uuid,
  p_expected_revision bigint,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_tier text;
  v_target public.company_memberships%rowtype;
  v_grant_id uuid;
  v_grant_source text;
  v_new_revision bigint;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.current_active_company_id();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  v_tier := private.delegation_tier_v1();
  if v_tier is null or not private.member_can_v1('jobs.assign') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_target_user_id is null or p_job_id is null
     or (p_request_id is not null and char_length(p_request_id) > 120) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if p_target_user_id = v_uid then
    return jsonb_build_object('ok', false, 'code', 'cannot_change_own_access');
  end if;
  if not exists (select 1 from public.jobs j where j.id = p_job_id and j.company_id = v_company_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into v_target
  from public.company_memberships m
  where m.company_id = v_company_id and m.user_id = p_target_user_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.removed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'member_disabled');
  end if;
  if v_target.role <> 'field_user' then
    return jsonb_build_object('ok', false, 'code', 'target_ineligible');
  end if;
  if p_expected_revision is not null and v_target.access_revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'access_revision', v_target.access_revision);
  end if;

  select g.id, g.source into v_grant_id, v_grant_source
  from public.job_access_grants g
  where g.job_id = p_job_id and g.user_id = p_target_user_id and g.revoked_at is null
  for update;

  if p_grant and v_grant_id is not null
     and v_grant_source not in ('task_assignment', 'production_lead_assignment') then
    return jsonb_build_object('ok', true, 'changed', false, 'access_revision', v_target.access_revision);
  end if;
  if not p_grant and v_grant_id is null then
    return jsonb_build_object('ok', true, 'changed', false, 'access_revision', v_target.access_revision);
  end if;

  if p_grant and v_grant_id is not null then
    -- Access already open through an assignment; the explicit grant becomes its reason.
    update public.job_access_grants set source = 'manual', granted_by = v_uid where id = v_grant_id;
  elsif p_grant then
    insert into public.job_access_grants (company_id, job_id, user_id, granted_by, source)
    values (v_company_id, p_job_id, p_target_user_id, v_uid, 'manual');
  else
    update public.job_access_grants set revoked_at = now(), revoked_by = v_uid where id = v_grant_id;
  end if;

  v_new_revision := v_target.access_revision + 1;
  update public.company_memberships set access_revision = v_new_revision where id = v_target.id;
  perform private.record_access_event_v1(
    v_company_id, p_target_user_id,
    case when p_grant then 'job_access_granted' else 'job_access_revoked' end,
    private.tier_authority_source_v1(v_tier), p_job_id,
    v_target.access_revision, v_new_revision, null, null, p_request_id, 'manual'
  );
  return jsonb_build_object('ok', true, 'changed', true, 'access_revision', v_new_revision);
end;
$$;

-- ---------------------------------------------------------------------------
-- One-time reconciliation: Coordinator-sourced grants whose holder no longer
-- coordinates the Job.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select g.company_id, g.job_id, g.user_id
    from public.job_access_grants g
    join public.jobs j on j.id = g.job_id and j.company_id = g.company_id
    where g.revoked_at is null
      and g.source = 'production_lead_assignment'
      and j.assigned_to is distinct from g.user_id
    order by g.job_id, g.user_id
  loop
    perform private.retire_coordinator_job_access_v1(r.company_id, r.job_id, r.user_id);
  end loop;
end;
$$;

revoke all on function private.job_access_derived_reason_v1(uuid, uuid, uuid) from public;
revoke all on function private.retire_coordinator_job_access_v1(uuid, uuid, uuid) from public;
revoke all on function private.job_assignment_access_coupling_trg_v1() from public;
revoke all on function private.change_job_access_v1(boolean, uuid, uuid, bigint, text) from public;
