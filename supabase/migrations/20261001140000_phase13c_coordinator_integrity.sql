-- Phase 13C slice 2: Coordinator integrity.
--
-- The Coordinator (jobs.assigned_to) is a Job responsibility, not a title, access role,
-- or Crew Lead. Only a caller holding company-scope jobs.assign may change it, and only
-- to an active software member of the Job's company (or to nobody).
--
-- The database owns the rule:
--   * set_job_coordinator_v1 is the single app write path (stale-safe, replay-safe,
--     Activity in the same transaction).
--   * handoff_member_open_work_v1 moves open Jobs through the same core.
--   * jobs_coordinator_guard rejects any other real change that breaks the rule.
--   * Ordinary clients lose direct UPDATE on jobs.assigned_to.
-- Closed Jobs keep their historical Coordinator; nothing here clears it.
--
-- Names: private.member_display_name_v1 is the one resolver for a member's visible name
-- (linked Person name, then profile name; never the legacy "Team member" placeholder).
-- The company directory, the access-admin list, the Field brief, and the Coordinator read
-- all use it.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function private.member_display_name_v1(p_company_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    (
      select cp.display_name
      from public.company_people cp
      where cp.company_id = p_company_id
        and cp.linked_user_id = p_user_id
        and lower(cp.display_name) <> 'team member'
      limit 1
    ),
    (
      select nullif(btrim(pr.full_name), '')
      from public.profiles pr
      where pr.id = p_user_id
        and lower(btrim(pr.full_name)) <> 'team member'
    )
  );
$$;

comment on function private.member_display_name_v1(uuid, uuid) is
  'Visible name of a company member: linked Person name, then profile name, else null (callers show a neutral read-time label). Never returns the legacy Team member placeholder.';

create or replace function private.coordinator_eligible_v1(p_company_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.company_memberships m
    where m.company_id = p_company_id
      and m.user_id = p_user_id
      and m.removed_at is null
      and private.role_is_valid_v1(m.role)
  );
$$;

comment on function private.coordinator_eligible_v1(uuid, uuid) is
  'Coordinator eligibility: any active software member of the company. Not filtered by role or capability.';

-- ---------------------------------------------------------------------------
-- Request ledger (replay safety). No client privileges.
-- ---------------------------------------------------------------------------
create table public.job_coordinator_requests (
  company_id uuid not null references public.companies (id) on delete cascade,
  request_id text not null,
  job_id uuid not null,
  assigned_to uuid,
  actor_user_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint job_coordinator_requests_pkey primary key (company_id, request_id),
  -- Relies on public.idx_jobs_id_company_unique (id, company_id).
  constraint job_coordinator_requests_job_fk
    foreign key (job_id, company_id) references public.jobs (id, company_id) on delete cascade,
  constraint job_coordinator_requests_request_id_chk
    check (request_id ~ '^[A-Za-z0-9._:-]{8,120}$')
);

comment on table public.job_coordinator_requests is
  'One row per successful set_job_coordinator_v1 request (changes and no-ops). Replays return the stored result.';

alter table public.job_coordinator_requests enable row level security;
revoke all on table public.job_coordinator_requests from public, anon, authenticated;
grant select, insert on table public.job_coordinator_requests to service_role;

create index job_coordinator_requests_job_idx
  on public.job_coordinator_requests (company_id, job_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Core: lock, validate, stale check, write, Activity. Callers own authority checks;
-- jobs_coordinator_guard re-checks them for every real change.
-- ---------------------------------------------------------------------------
create or replace function private.set_job_coordinator_core_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_assigned_to uuid,
  p_expected_previous uuid,
  p_actor_user_id uuid,
  p_request_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_job public.jobs%rowtype;
  v_event text;
  v_payload jsonb;
begin
  select * into v_job
  from public.jobs j
  where j.id = p_job_id and j.company_id = p_company_id and j.deleted_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if p_assigned_to is not null and not private.coordinator_eligible_v1(p_company_id, p_assigned_to) then
    return jsonb_build_object('ok', false, 'code', 'coordinator_not_eligible');
  end if;

  if v_job.assigned_to is not distinct from p_assigned_to then
    return jsonb_build_object(
      'ok', true,
      'changed', false,
      'job_id', v_job.id,
      'previous_assigned_to', v_job.assigned_to,
      'assigned_to', v_job.assigned_to,
      'display_name', case when v_job.assigned_to is not null
        then private.member_display_name_v1(p_company_id, v_job.assigned_to) end,
      'event_type', null
    );
  end if;

  if v_job.assigned_to is distinct from p_expected_previous then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale_coordinator',
      'current_assigned_to', v_job.assigned_to
    );
  end if;

  update public.jobs
  set assigned_to = p_assigned_to,
      updated_by = p_actor_user_id
  where id = v_job.id;

  v_event := case
    when v_job.assigned_to is null then 'production_lead_assigned'
    when p_assigned_to is null then 'production_lead_cleared'
    else 'production_lead_changed'
  end;
  v_payload := jsonb_build_object(
    'previous_assigned_to', v_job.assigned_to,
    'assigned_to', p_assigned_to
  );
  if p_request_id is not null then
    v_payload := v_payload || jsonb_build_object('request_id', p_request_id);
  end if;
  if p_reason is not null then
    v_payload := v_payload || jsonb_build_object('reason', p_reason);
  end if;
  perform public.job_lifecycle_insert_activity(
    p_company_id, v_job.id, v_event, p_actor_user_id, v_payload, now()
  );

  return jsonb_build_object(
    'ok', true,
    'changed', true,
    'job_id', v_job.id,
    'previous_assigned_to', v_job.assigned_to,
    'assigned_to', p_assigned_to,
    'display_name', case when p_assigned_to is not null
      then private.member_display_name_v1(p_company_id, p_assigned_to) end,
    'event_type', v_event
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public write: set or clear the Coordinator.
-- p_expected_previous is the Coordinator the caller saw (null = Unassigned).
-- Order: auth, company, company-scope jobs.assign, payload, replay, core, ledger.
-- ---------------------------------------------------------------------------
create or replace function public.set_job_coordinator_v1(
  p_job_id uuid,
  p_assigned_to uuid,
  p_expected_previous uuid,
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
  v_prior public.job_coordinator_requests%rowtype;
  v_result jsonb;
  v_inserted integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.current_active_company_id();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if not private.member_can_v1('jobs.assign') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_job_id is null or p_request_id is null or p_request_id !~ '^[A-Za-z0-9._:-]{8,120}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_prior
  from public.job_coordinator_requests r
  where r.company_id = v_company_id and r.request_id = p_request_id;
  if found then
    if v_prior.job_id is distinct from p_job_id or v_prior.assigned_to is distinct from p_assigned_to then
      return jsonb_build_object('ok', false, 'code', 'request_id_conflict');
    end if;
    return v_prior.result || jsonb_build_object('replay', true);
  end if;

  v_result := private.set_job_coordinator_core_v1(
    v_company_id, p_job_id, p_assigned_to, p_expected_previous, v_uid, p_request_id, null
  );
  if (v_result ->> 'ok')::boolean is not true then
    return v_result;
  end if;

  insert into public.job_coordinator_requests (company_id, request_id, job_id, assigned_to, actor_user_id, result)
  values (v_company_id, p_request_id, p_job_id, p_assigned_to, v_uid, v_result)
  on conflict (company_id, request_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    -- An identical request committed while this one waited on the Job lock; this run was a no-op.
    select * into v_prior
    from public.job_coordinator_requests r
    where r.company_id = v_company_id and r.request_id = p_request_id;
    if v_prior.job_id is distinct from p_job_id or v_prior.assigned_to is distinct from p_assigned_to then
      raise exception 'set_job_coordinator_v1: request_id reused concurrently' using errcode = '40001';
    end if;
    return v_prior.result || jsonb_build_object('replay', true);
  end if;

  return v_result || jsonb_build_object('replay', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Public read: the Coordinator of one Job, with its resolved visible name.
-- A removed member keeps their historical name; email only for team.manage viewers.
-- ---------------------------------------------------------------------------
create or replace function public.get_job_coordinator_v1(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid := private.current_active_company_id();
  v_assigned uuid;
  v_name text;
begin
  if auth.uid() is null or v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_job_id is null or not private.member_can_v1('jobs.read', p_job_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select j.assigned_to into v_assigned
  from public.jobs j
  where j.id = p_job_id and j.company_id = v_company_id and j.deleted_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_assigned is not null then
    v_name := private.member_display_name_v1(v_company_id, v_assigned);
  end if;

  return jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'assigned_to', v_assigned,
    'display_name', v_name,
    'email', case
      when v_assigned is not null and v_name is null and private.member_can_v1('team.manage')
        then (select nullif(btrim(pr.email), '') from public.profiles pr where pr.id = v_assigned)
    end,
    'coordinator_active', v_assigned is not null and private.coordinator_eligible_v1(v_company_id, v_assigned),
    'can_assign', private.member_can_v1('jobs.assign')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Column invariant. Fires only when assigned_to is written; unchanged values pass.
-- A non-null Coordinator is always an active member of the Job's company. End users
-- (auth.uid() present) never set it on insert and change it only with company-scope
-- jobs.assign in the Job's company. Service/maintenance contexts keep target integrity.
-- ---------------------------------------------------------------------------
create or replace function private.jobs_coordinator_guard_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then
    return new;
  end if;
  if tg_op = 'INSERT' and new.assigned_to is null then
    return new;
  end if;

  if new.assigned_to is not null and not private.coordinator_eligible_v1(new.company_id, new.assigned_to) then
    raise exception 'jobs: the Coordinator must be an active member of the job''s company' using errcode = '23514';
  end if;

  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      raise exception 'jobs: a new job has no Coordinator; set one with set_job_coordinator_v1' using errcode = '42501';
    end if;
    if private.current_active_company_id() is distinct from new.company_id
       or not private.member_can_v1('jobs.assign') then
      raise exception 'jobs: changing the Coordinator requires company-scope jobs.assign' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger jobs_coordinator_guard
  before insert or update of assigned_to on public.jobs
  for each row execute function private.jobs_coordinator_guard_trg_v1();

-- ---------------------------------------------------------------------------
-- Handoff: open Jobs move through the Coordinator core (Activity per Job). Unchanged
-- otherwise: same authority, scope, revision, replay, and task handoff.
-- ---------------------------------------------------------------------------
create or replace function public.handoff_member_open_work_v1(
  p_target_user_id uuid,
  p_reassign_to_user_id uuid default null,
  p_expected_revision bigint default null,
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
  v_tier text;
  v_target public.company_memberships%rowtype;
  v_prev jsonb;
  v_jobs integer := 0;
  v_tasks integer := 0;
  v_job_id uuid;
  v_step jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.current_active_company_id();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  v_tier := private.delegation_tier_v1();
  if v_tier is null or v_tier not in ('owner', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_target_user_id is null
     or (p_request_id is not null and p_request_id !~ '^[A-Za-z0-9._:-]{8,120}$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if p_request_id is not null then
    select e.after_state into v_prev
    from public.company_access_events e
    where e.company_id = v_company_id
      and e.target_user_id = p_target_user_id
      and e.event_type = 'member_open_work_handoff'
      and e.request_id = p_request_id
    order by e.occurred_at desc
    limit 1;
    if found then
      if (v_prev ->> 'reassigned_to') is distinct from p_reassign_to_user_id::text then
        return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
      end if;
      return jsonb_build_object(
        'ok', true,
        'replay', true,
        'user_id', p_target_user_id,
        'reassigned_to', p_reassign_to_user_id,
        'cleared_job_leads', coalesce((v_prev ->> 'job_leads')::integer, 0),
        'cleared_task_assignees', coalesce((v_prev ->> 'tasks')::integer, 0)
      );
    end if;
  end if;

  select * into v_target
  from public.company_memberships m
  where m.company_id = v_company_id and m.user_id = p_target_user_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.removed_at is null then
    return jsonb_build_object('ok', false, 'code', 'member_active');
  end if;
  if v_tier = 'admin' and v_target.role = 'admin' then
    return jsonb_build_object('ok', false, 'code', 'owner_required');
  end if;
  if p_expected_revision is not null and v_target.access_revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'access_revision', v_target.access_revision);
  end if;

  if p_reassign_to_user_id is not null then
    if p_reassign_to_user_id = p_target_user_id
       or not exists (
         select 1
         from public.company_memberships r
         where r.company_id = v_company_id
           and r.user_id = p_reassign_to_user_id
           and r.removed_at is null
           and private.role_is_valid_v1(r.role)
         for update
       ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_reassign');
    end if;
  end if;

  for v_job_id in
    select j.id
    from public.jobs j
    where j.company_id = v_company_id
      and j.assigned_to = p_target_user_id
      and private.job_is_open_work_v1(j.stage, j.status, j.archived, j.deleted_at)
    order by j.id
  loop
    v_step := private.set_job_coordinator_core_v1(
      v_company_id, v_job_id, p_reassign_to_user_id, p_target_user_id, v_uid, null, 'member_open_work_handoff'
    );
    if (v_step ->> 'ok')::boolean is not true then
      raise exception 'handoff_member_open_work_v1: coordinator handoff failed (%)', v_step ->> 'code'
        using errcode = '40001';
    end if;
    if (v_step ->> 'changed')::boolean then
      v_jobs := v_jobs + 1;
    end if;
  end loop;

  update public.job_tasks t
  set assigned_to = p_reassign_to_user_id
  where t.company_id = v_company_id
    and t.assigned_to = p_target_user_id
    and t.status = 'open'
    and t.deleted_at is null;
  get diagnostics v_tasks = row_count;

  if v_jobs > 0 or v_tasks > 0 or p_request_id is not null then
    perform private.record_access_event_v1(
      v_company_id, p_target_user_id, 'member_open_work_handoff', private.tier_authority_source_v1(v_tier), null,
      v_target.access_revision, v_target.access_revision, null,
      jsonb_build_object(
        'reassigned_to', p_reassign_to_user_id,
        'job_leads', v_jobs,
        'tasks', v_tasks
      ),
      p_request_id, null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'replay', false,
    'user_id', p_target_user_id,
    'reassigned_to', p_reassign_to_user_id,
    'cleared_job_leads', v_jobs,
    'cleared_task_assignees', v_tasks
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Name sources: same visible name everywhere.
-- ---------------------------------------------------------------------------
create or replace function public.list_company_directory_v1()
returns table(user_id uuid, display_name text, role text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select m.user_id,
         private.member_display_name_v1(m.company_id, m.user_id) as display_name,
         m.role
  from public.company_memberships m
  where m.company_id = private.current_active_company_id()
    and m.removed_at is null
    and (
      m.user_id = auth.uid()
      or private.member_can_v1('jobs.read')
    )
  order by m.created_at, m.user_id;
$$;

create or replace function public.list_company_access_admin_v1()
returns table(
  user_id uuid,
  display_name text,
  email text,
  role text,
  removed_at timestamp with time zone,
  created_at timestamp with time zone,
  open_job_lead_count integer,
  open_task_assignee_count integer,
  access_revision bigint,
  package_keys text[],
  restriction_count integer,
  granted_job_count integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid := private.current_active_company_id();
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_company_id is null or not private.member_can_v1('team.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select m.user_id,
         private.member_display_name_v1(v_company_id, m.user_id),
         nullif(btrim(p.email), ''),
         m.role,
         m.removed_at,
         m.created_at,
         (
           select count(*)::integer from public.jobs j
           where j.company_id = v_company_id and j.assigned_to = m.user_id
             and private.job_is_open_work_v1(j.stage, j.status, j.archived, j.deleted_at)
         ),
         (
           select count(*)::integer from public.job_tasks t
           where t.company_id = v_company_id and t.assigned_to = m.user_id
             and t.status = 'open' and t.deleted_at is null
         ),
         m.access_revision,
         (
           select coalesce(array_agg(distinct r.package_key order by r.package_key), '{}'::text[])
           from public.company_member_access_rules r
           where r.company_id = v_company_id and r.user_id = m.user_id and r.effect = 'grant'
             and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
         ),
         (
           select count(*)::integer from public.company_member_access_rules r
           where r.company_id = v_company_id and r.user_id = m.user_id and r.effect = 'restrict'
             and private.access_rule_is_live_v1(r.revoked_at, r.valid_from, r.valid_until)
         ),
         (
           select count(*)::integer from public.job_access_grants g
           where g.company_id = v_company_id and g.user_id = m.user_id and g.revoked_at is null
         )
  from public.company_memberships m
  left join public.profiles p on p.id = m.user_id
  where m.company_id = v_company_id
  order by m.created_at, m.user_id;
end;
$$;

create or replace function public.get_job_field_brief_v1(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid := private.current_active_company_id();
  v_job public.jobs%rowtype;
begin
  if auth.uid() is null or v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if p_job_id is null or not private.member_can_v1('jobs.read', p_job_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into v_job from public.jobs j where j.id = p_job_id and j.company_id = v_company_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'job', jsonb_build_object(
      'id', v_job.id,
      'job_name', v_job.job_name,
      'stage', v_job.stage,
      'status', v_job.status,
      'customer_name', v_job.customer_name,
      'customer_phone', v_job.customer_phone,
      'customer_email', v_job.customer_email,
      'address_line1', v_job.address_line1,
      'address_line2', v_job.address_line2,
      'address_city', v_job.address_city,
      'address_state', v_job.address_state,
      'address_zip', v_job.address_zip,
      'address_formatted', v_job.address_formatted,
      'crew_label', v_job.crew_label,
      'production_lead_user_id', v_job.assigned_to
    ),
    'approved_scope_label', (
      select coalesce(a.customer_chosen_option_label, a.accepted_option_label)
      from public.proposal_acceptances a
      where a.company_id = v_company_id and a.job_id = v_job.id
      order by a.accepted_at desc, a.created_at desc, a.id desc
      limit 1
    ),
    'has_accepted_agreement', exists (
      select 1 from public.proposal_acceptances a
      where a.company_id = v_company_id and a.job_id = v_job.id
    ),
    'scope_changes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'status', sc.status,
        'reason', sc.reason,
        'lines', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'description', l.description,
            'change_kind', l.change_kind
          ) order by l.sort_order, l.created_at), '[]'::jsonb)
          from public.job_scope_change_lines l
          where l.company_id = v_company_id and l.scope_change_id = sc.id
        )
      ) order by sc.created_at), '[]'::jsonb)
      from public.job_scope_changes sc
      where sc.company_id = v_company_id and sc.job_id = v_job.id
        and sc.deleted_at is null and sc.status in ('proposed', 'authorized')
    ),
    'people', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'display_name', private.member_display_name_v1(v_company_id, m.user_id)
      ) order by m.user_id), '[]'::jsonb)
      from public.company_memberships m
      where m.company_id = v_company_id
        and m.removed_at is null
        and (
          m.user_id = v_job.assigned_to
          or m.user_id in (
            select t.assigned_to from public.job_tasks t
            where t.company_id = v_company_id and t.job_id = v_job.id and t.deleted_at is null
          )
        )
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke update (assigned_to) on public.jobs from anon, authenticated;

revoke all on function private.member_display_name_v1(uuid, uuid) from public;
revoke all on function private.coordinator_eligible_v1(uuid, uuid) from public;
revoke all on function private.set_job_coordinator_core_v1(uuid, uuid, uuid, uuid, uuid, text, text) from public;
revoke all on function private.jobs_coordinator_guard_trg_v1() from public;

revoke all on function public.set_job_coordinator_v1(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_job_coordinator_v1(uuid, uuid, uuid, text) to authenticated, service_role;

revoke all on function public.get_job_coordinator_v1(uuid) from public, anon, authenticated;
grant execute on function public.get_job_coordinator_v1(uuid) to authenticated, service_role;
