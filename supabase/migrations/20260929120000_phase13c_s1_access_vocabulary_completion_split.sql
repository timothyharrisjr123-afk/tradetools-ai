-- Phase 13C Slice 1 — access vocabulary, Lead preset, Start/Complete authority split.
--
-- 1. Registry re-sync from app/lib/access/registry.ts (generated block below):
--    - new capability jobs.complete (company scope) held by Owner, Admin
--      (Office Manager), Production Lead (Production Coordinator), and the
--      coordinate_production package; every prior completer keeps completion;
--    - lead_assigned_work (the Lead preset package) becomes tasks.manage,
--      tasks.read, jobs.progress: no schedule mutation, no completion, and no
--      Production Lead delegation (assignable by Owner and Admin only).
-- 2. start_job_work_v1: jobs.progress at the job AND at company scope (D-S1). A
--    job-scoped holder may start work only as the job's active assignment Lead,
--    which is added with assignment truth in Slice 4. No role-name check, no
--    jobs.assigned_to, no crew_label.
-- 3. complete_job_work_v1: jobs.complete at the job (was jobs.progress). It remains
--    the only writer allowed through jobs_job_complete_guard.
-- 4. list_company_directory_v1: drops the job-scope tasks.manage clause. Leads no
--    longer read the company directory; the Field brief carries the people of the
--    jobs they work.
--
-- Bodies of 2 and 3 are verbatim copies of 20260927193000 except the authority
-- clause. CREATE OR REPLACE keeps existing grants.


-- BEGIN GENERATED REGISTRY SYNC (app/lib/access/registrySql.ts)
do $registry_sync$
begin
  if exists (select 1 from public.access_capabilities where not (capability_key = any (array['customers.read', 'customers.manage', 'jobs.read', 'jobs.manage', 'jobs.assign', 'jobs.approve', 'jobs.progress', 'jobs.complete', 'jobs.hold', 'jobs.finalize', 'measurements.capture', 'measurements.select', 'photos.contribute', 'field_notes.contribute', 'tasks.read', 'tasks.complete', 'tasks.manage', 'schedule.read', 'schedule.manage', 'proposals.read', 'proposals.write', 'proposals.send', 'scope_changes.write', 'scope_changes.issue', 'pricing.manage', 'pricing.cost.read', 'templates.manage', 'payments.summary.read', 'payments.history.read', 'payments.request', 'payments.record', 'payments.refund', 'payments.configure', 'company_financials.read', 'company.manage', 'team.manage', 'access.delegate_sensitive', 'billing.manage', 'data.export', 'discounts.approve']::text[]))) then
    raise exception 'access registry sync: database holds a capability outside registry.ts';
  end if;
  if exists (select 1 from public.access_packages where not (package_key = any (array['request_payments', 'view_payment_history', 'view_company_financials', 'view_internal_costs', 'manage_pricing_templates', 'issue_scope_changes', 'refunds', 'approve_jobs', 'coordinate_production', 'lead_assigned_work', 'manage_customers_jobs']::text[]))) then
    raise exception 'access registry sync: database holds a package outside registry.ts';
  end if;
  if exists (select 1 from public.access_role_profiles where not ((role_key || ':' || version) = any (array['owner:1', 'admin:1', 'office_sales:1', 'production_lead:1', 'field_user:1']::text[]))) then
    raise exception 'access registry sync: database holds a role profile outside registry.ts';
  end if;
end;
$registry_sync$;
insert into public.access_capabilities (capability_key, domain, status, sensitive, scope_kinds) values
  ('customers.read', 'customers', 'active', false, array['company']::text[]),
  ('customers.manage', 'customers', 'active', false, array['company']::text[]),
  ('jobs.read', 'jobs', 'active', false, array['company', 'granted_jobs', 'job']::text[]),
  ('jobs.manage', 'jobs', 'active', false, array['company']::text[]),
  ('jobs.assign', 'jobs', 'active', false, array['company']::text[]),
  ('jobs.approve', 'jobs', 'active', false, array['company']::text[]),
  ('jobs.progress', 'jobs', 'active', false, array['company', 'granted_jobs', 'job']::text[]),
  ('jobs.complete', 'jobs', 'active', false, array['company']::text[]),
  ('jobs.hold', 'jobs', 'active', false, array['company']::text[]),
  ('jobs.finalize', 'jobs', 'active', false, array['company']::text[]),
  ('measurements.capture', 'measurements', 'active', false, array['company', 'granted_jobs', 'job']::text[]),
  ('measurements.select', 'measurements', 'active', false, array['company']::text[]),
  ('photos.contribute', 'photos', 'active', false, array['company', 'granted_jobs', 'job']::text[]),
  ('field_notes.contribute', 'field_notes', 'reserved', false, array['company', 'granted_jobs', 'job']::text[]),
  ('tasks.read', 'tasks', 'active', false, array['company', 'granted_jobs', 'job']::text[]),
  ('tasks.complete', 'tasks', 'active', false, array['company', 'granted_jobs', 'job', 'own_task']::text[]),
  ('tasks.manage', 'tasks', 'active', false, array['company', 'granted_jobs', 'job']::text[]),
  ('schedule.read', 'schedule', 'active', false, array['company', 'granted_jobs', 'job']::text[]),
  ('schedule.manage', 'schedule', 'active', false, array['company', 'granted_jobs', 'job']::text[]),
  ('proposals.read', 'proposals', 'active', false, array['company']::text[]),
  ('proposals.write', 'proposals', 'active', false, array['company']::text[]),
  ('proposals.send', 'proposals', 'active', false, array['company']::text[]),
  ('scope_changes.write', 'scope_changes', 'active', false, array['company']::text[]),
  ('scope_changes.issue', 'scope_changes', 'active', true, array['company']::text[]),
  ('pricing.manage', 'commercial_config', 'active', true, array['company']::text[]),
  ('pricing.cost.read', 'commercial_config', 'reserved', true, array['company']::text[]),
  ('templates.manage', 'commercial_config', 'active', false, array['company']::text[]),
  ('payments.summary.read', 'payments', 'active', true, array['company']::text[]),
  ('payments.history.read', 'payments', 'active', true, array['company']::text[]),
  ('payments.request', 'payments', 'active', true, array['company']::text[]),
  ('payments.record', 'payments', 'reserved', true, array['company']::text[]),
  ('payments.refund', 'payments', 'active', true, array['company']::text[]),
  ('payments.configure', 'payments', 'active', true, array['company']::text[]),
  ('company_financials.read', 'company_finance', 'reserved', true, array['company']::text[]),
  ('company.manage', 'administration', 'active', false, array['company']::text[]),
  ('team.manage', 'administration', 'active', true, array['company']::text[]),
  ('access.delegate_sensitive', 'administration', 'reserved', true, array['company']::text[]),
  ('billing.manage', 'administration', 'reserved', true, array['company']::text[]),
  ('data.export', 'administration', 'reserved', true, array['company']::text[]),
  ('discounts.approve', 'proposals', 'reserved', true, array['company']::text[])
on conflict (capability_key) do update set
  domain = excluded.domain, status = excluded.status,
  sensitive = excluded.sensitive, scope_kinds = excluded.scope_kinds;
delete from public.access_capability_dependencies;
insert into public.access_capability_dependencies (capability_key, requires_capability_key) values
  ('customers.manage', 'customers.read'),
  ('jobs.manage', 'jobs.read'),
  ('jobs.assign', 'jobs.read'),
  ('jobs.approve', 'jobs.read'),
  ('jobs.progress', 'jobs.read'),
  ('jobs.complete', 'jobs.read'),
  ('jobs.hold', 'jobs.read'),
  ('jobs.finalize', 'jobs.read'),
  ('measurements.capture', 'jobs.read'),
  ('measurements.select', 'jobs.read'),
  ('photos.contribute', 'jobs.read'),
  ('field_notes.contribute', 'jobs.read'),
  ('tasks.read', 'jobs.read'),
  ('tasks.complete', 'tasks.read'),
  ('tasks.manage', 'tasks.read'),
  ('schedule.read', 'jobs.read'),
  ('schedule.manage', 'schedule.read'),
  ('proposals.read', 'jobs.read'),
  ('proposals.write', 'proposals.read'),
  ('proposals.send', 'proposals.read'),
  ('scope_changes.write', 'proposals.read'),
  ('scope_changes.issue', 'scope_changes.write'),
  ('payments.summary.read', 'jobs.read'),
  ('payments.history.read', 'payments.summary.read'),
  ('payments.request', 'payments.summary.read'),
  ('payments.record', 'payments.summary.read'),
  ('payments.refund', 'payments.history.read'),
  ('discounts.approve', 'proposals.read');
insert into public.access_role_profiles (role_key, version) values
  ('owner', 1),
  ('admin', 1),
  ('office_sales', 1),
  ('production_lead', 1),
  ('field_user', 1)
on conflict (role_key, version) do nothing;
delete from public.access_role_profile_capabilities;
insert into public.access_role_profile_capabilities (role_key, version, capability_key, scope_kind) values
  ('owner', 1, 'customers.read', 'company'),
  ('owner', 1, 'customers.manage', 'company'),
  ('owner', 1, 'jobs.read', 'company'),
  ('owner', 1, 'jobs.manage', 'company'),
  ('owner', 1, 'jobs.assign', 'company'),
  ('owner', 1, 'jobs.approve', 'company'),
  ('owner', 1, 'jobs.progress', 'company'),
  ('owner', 1, 'jobs.complete', 'company'),
  ('owner', 1, 'jobs.hold', 'company'),
  ('owner', 1, 'jobs.finalize', 'company'),
  ('owner', 1, 'measurements.capture', 'company'),
  ('owner', 1, 'measurements.select', 'company'),
  ('owner', 1, 'photos.contribute', 'company'),
  ('owner', 1, 'tasks.read', 'company'),
  ('owner', 1, 'tasks.complete', 'company'),
  ('owner', 1, 'tasks.manage', 'company'),
  ('owner', 1, 'schedule.read', 'company'),
  ('owner', 1, 'schedule.manage', 'company'),
  ('owner', 1, 'proposals.read', 'company'),
  ('owner', 1, 'proposals.write', 'company'),
  ('owner', 1, 'proposals.send', 'company'),
  ('owner', 1, 'scope_changes.write', 'company'),
  ('owner', 1, 'scope_changes.issue', 'company'),
  ('owner', 1, 'pricing.manage', 'company'),
  ('owner', 1, 'templates.manage', 'company'),
  ('owner', 1, 'payments.summary.read', 'company'),
  ('owner', 1, 'payments.history.read', 'company'),
  ('owner', 1, 'payments.request', 'company'),
  ('owner', 1, 'payments.refund', 'company'),
  ('owner', 1, 'payments.configure', 'company'),
  ('owner', 1, 'company.manage', 'company'),
  ('owner', 1, 'team.manage', 'company'),
  ('admin', 1, 'customers.read', 'company'),
  ('admin', 1, 'customers.manage', 'company'),
  ('admin', 1, 'jobs.read', 'company'),
  ('admin', 1, 'jobs.manage', 'company'),
  ('admin', 1, 'jobs.assign', 'company'),
  ('admin', 1, 'jobs.approve', 'company'),
  ('admin', 1, 'jobs.progress', 'company'),
  ('admin', 1, 'jobs.complete', 'company'),
  ('admin', 1, 'jobs.hold', 'company'),
  ('admin', 1, 'jobs.finalize', 'company'),
  ('admin', 1, 'measurements.capture', 'company'),
  ('admin', 1, 'measurements.select', 'company'),
  ('admin', 1, 'photos.contribute', 'company'),
  ('admin', 1, 'tasks.read', 'company'),
  ('admin', 1, 'tasks.complete', 'company'),
  ('admin', 1, 'tasks.manage', 'company'),
  ('admin', 1, 'schedule.read', 'company'),
  ('admin', 1, 'schedule.manage', 'company'),
  ('admin', 1, 'proposals.read', 'company'),
  ('admin', 1, 'proposals.write', 'company'),
  ('admin', 1, 'proposals.send', 'company'),
  ('admin', 1, 'scope_changes.write', 'company'),
  ('admin', 1, 'company.manage', 'company'),
  ('admin', 1, 'team.manage', 'company'),
  ('office_sales', 1, 'customers.read', 'company'),
  ('office_sales', 1, 'customers.manage', 'company'),
  ('office_sales', 1, 'jobs.read', 'company'),
  ('office_sales', 1, 'jobs.manage', 'company'),
  ('office_sales', 1, 'measurements.capture', 'company'),
  ('office_sales', 1, 'measurements.select', 'company'),
  ('office_sales', 1, 'photos.contribute', 'company'),
  ('office_sales', 1, 'tasks.read', 'company'),
  ('office_sales', 1, 'tasks.complete', 'company'),
  ('office_sales', 1, 'schedule.read', 'company'),
  ('office_sales', 1, 'proposals.read', 'company'),
  ('office_sales', 1, 'proposals.write', 'company'),
  ('office_sales', 1, 'proposals.send', 'company'),
  ('office_sales', 1, 'scope_changes.write', 'company'),
  ('production_lead', 1, 'customers.read', 'company'),
  ('production_lead', 1, 'jobs.read', 'company'),
  ('production_lead', 1, 'jobs.assign', 'company'),
  ('production_lead', 1, 'jobs.progress', 'company'),
  ('production_lead', 1, 'jobs.complete', 'company'),
  ('production_lead', 1, 'jobs.hold', 'company'),
  ('production_lead', 1, 'measurements.capture', 'company'),
  ('production_lead', 1, 'photos.contribute', 'company'),
  ('production_lead', 1, 'tasks.read', 'company'),
  ('production_lead', 1, 'tasks.complete', 'company'),
  ('production_lead', 1, 'tasks.manage', 'company'),
  ('production_lead', 1, 'schedule.read', 'company'),
  ('production_lead', 1, 'schedule.manage', 'company'),
  ('field_user', 1, 'jobs.read', 'granted_jobs'),
  ('field_user', 1, 'tasks.read', 'granted_jobs'),
  ('field_user', 1, 'tasks.complete', 'own_task'),
  ('field_user', 1, 'schedule.read', 'granted_jobs'),
  ('field_user', 1, 'measurements.capture', 'granted_jobs'),
  ('field_user', 1, 'photos.contribute', 'granted_jobs');
insert into public.access_packages (package_key, status, sensitive, strong_auth_required, scope_kind, eligible_roles, assignable_by) values
  ('request_payments', 'active', true, false, 'company', array['admin', 'office_sales']::text[], array['owner']::text[]),
  ('view_payment_history', 'active', true, false, 'company', array['admin', 'office_sales']::text[], array['owner']::text[]),
  ('view_company_financials', 'reserved', true, false, 'company', array['admin', 'office_sales']::text[], array['owner']::text[]),
  ('view_internal_costs', 'reserved', true, false, 'company', array['admin', 'office_sales']::text[], array['owner']::text[]),
  ('manage_pricing_templates', 'active', true, false, 'company', array['admin', 'office_sales']::text[], array['owner']::text[]),
  ('issue_scope_changes', 'active', true, false, 'company', array['admin', 'office_sales']::text[], array['owner']::text[]),
  ('refunds', 'reserved', true, true, 'company', array['admin']::text[], array['owner']::text[]),
  ('approve_jobs', 'active', false, false, 'company', array['office_sales', 'production_lead']::text[], array['owner', 'admin']::text[]),
  ('coordinate_production', 'active', false, false, 'company', array['office_sales']::text[], array['owner', 'admin']::text[]),
  ('lead_assigned_work', 'active', false, false, 'granted_jobs', array['field_user']::text[], array['owner', 'admin']::text[]),
  ('manage_customers_jobs', 'active', false, false, 'company', array['production_lead']::text[], array['owner', 'admin']::text[])
on conflict (package_key) do update set
  status = excluded.status, sensitive = excluded.sensitive,
  strong_auth_required = excluded.strong_auth_required, scope_kind = excluded.scope_kind,
  eligible_roles = excluded.eligible_roles, assignable_by = excluded.assignable_by;
delete from public.access_package_capabilities;
insert into public.access_package_capabilities (package_key, capability_key) values
  ('request_payments', 'payments.request'),
  ('request_payments', 'payments.summary.read'),
  ('view_payment_history', 'payments.history.read'),
  ('view_payment_history', 'payments.summary.read'),
  ('view_company_financials', 'company_financials.read'),
  ('view_internal_costs', 'pricing.cost.read'),
  ('manage_pricing_templates', 'pricing.manage'),
  ('manage_pricing_templates', 'templates.manage'),
  ('issue_scope_changes', 'scope_changes.issue'),
  ('issue_scope_changes', 'scope_changes.write'),
  ('refunds', 'payments.refund'),
  ('refunds', 'payments.history.read'),
  ('refunds', 'payments.summary.read'),
  ('approve_jobs', 'jobs.approve'),
  ('coordinate_production', 'schedule.manage'),
  ('coordinate_production', 'schedule.read'),
  ('coordinate_production', 'tasks.manage'),
  ('coordinate_production', 'tasks.read'),
  ('coordinate_production', 'jobs.progress'),
  ('coordinate_production', 'jobs.complete'),
  ('coordinate_production', 'jobs.hold'),
  ('coordinate_production', 'jobs.assign'),
  ('lead_assigned_work', 'tasks.manage'),
  ('lead_assigned_work', 'tasks.read'),
  ('lead_assigned_work', 'jobs.progress'),
  ('manage_customers_jobs', 'customers.manage'),
  ('manage_customers_jobs', 'customers.read'),
  ('manage_customers_jobs', 'jobs.manage'),
  ('manage_customers_jobs', 'measurements.select');
do $registry_sync_check$
declare
  v_violations text[] := private.access_registry_violations_v1();
begin
  if cardinality(v_violations) > 0 then
    raise exception 'access registry invalid: %', array_to_string(v_violations, '; ');
  end if;
end;
$registry_sync_check$;
-- END GENERATED REGISTRY SYNC

-- start_job_work_v1: active membership + jobs.progress at the job and at company scope (D-S1)
CREATE OR REPLACE FUNCTION public.start_job_work_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_job public.jobs%rowtype;
  v_schedule public.job_schedules%rowtype;
  v_from text;
  v_active_count integer := 0;
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
      and cm.removed_at is null
      and private.member_can_v1('jobs.progress', v_job_id)
      -- D-S1: job-scoped jobs.progress (the Lead package) also requires being the
      -- job's active assignment Lead. Assignment truth arrives in Phase 13C Slice 4;
      -- until then only company-scope holders may start work.
      and private.member_can_v1('jobs.progress')
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

  if v_from = 'complete' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'production'
    );
  end if;

  if v_from = 'production' and v_job.production_started_at is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'production_start_integrity_error',
      'from_stage', v_from,
      'to_stage', 'production'
    );
  end if;

  if v_from <> 'scheduled' and v_from <> 'production' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_stage',
      'from_stage', v_from,
      'to_stage', 'production'
    );
  end if;

  if v_from = 'scheduled' and v_job.status <> 'active' then
    return jsonb_build_object(
      'ok', false,
      'code', 'disposition_blocks_start_work',
      'from_stage', v_from,
      'to_stage', 'production',
      'disposition', v_job.status
    );
  end if;

  if v_from = 'scheduled' and v_job.production_started_at is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'production_start_integrity_error',
      'from_stage', v_from,
      'to_stage', 'production'
    );
  end if;

  select count(*)::integer
  into v_active_count
  from public.job_schedules s
  where s.company_id = v_company_id
    and s.job_id = v_job_id
    and s.kind = 'work'
    and s.status = 'scheduled';

  if v_active_count <> 1 then
    return jsonb_build_object(
      'ok', false,
      'code', 'start_work_schedule_integrity_error',
      'from_stage', v_from,
      'to_stage', 'production',
      'active_schedule_count', v_active_count
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

  if v_from = 'production' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job.id,
      'from_stage', v_from,
      'to_stage', 'production',
      'production_started_at', v_job.production_started_at,
      'stage_entered_at', v_job.stage_entered_at,
      'disposition_unchanged', v_job.status,
      'schedule', public.job_schedule_row_json(v_schedule),
      'activity_id', null,
      'stage_activity_id', null,
      'job', jsonb_build_object(
        'id', v_job.id,
        'company_id', v_job.company_id,
        'stage', 'production',
        'status', v_job.status,
        'production_started_at', v_job.production_started_at,
        'stage_entered_at', v_job.stage_entered_at
      )
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);
  perform set_config('job_lifecycle.allow_production_start_write', '1', true);

  update public.jobs
  set
    stage = 'production',
    production_started_at = v_now,
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'job_work_started',
    v_uid,
    jsonb_build_object(
      'production_started_at', v_now,
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
      'to_stage', 'production',
      'reason', 'work_started',
      'schedule_id', v_schedule.id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', v_job.id,
    'from_stage', v_from,
    'to_stage', 'production',
    'production_started_at', v_now,
    'stage_entered_at', v_now,
    'disposition_unchanged', v_job.status,
    'schedule', public.job_schedule_row_json(v_schedule),
    'activity_id', v_activity_id,
    'stage_activity_id', v_stage_activity_id,
    'job', jsonb_build_object(
      'id', v_job.id,
      'company_id', v_job.company_id,
      'stage', 'production',
      'status', v_job.status,
      'production_started_at', v_now,
      'stage_entered_at', v_now
    )
  );
end;
$function$;

-- complete_job_work_v1: active membership + jobs.complete at the job
CREATE OR REPLACE FUNCTION public.complete_job_work_v1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and cm.removed_at is null
      and private.member_can_v1('jobs.complete', v_job_id)
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
$function$;

-- Directory: names and role labels for members who work across jobs (company-scope
-- jobs.read). Everyone else (Field, Lead) sees only their own row; the Field brief
-- carries the people of the jobs they work.
create or replace function public.list_company_directory_v1()
returns table (user_id uuid, display_name text, role text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select m.user_id,
         nullif(btrim(p.full_name), '') as display_name,
         m.role
  from public.company_memberships m
  left join public.profiles p on p.id = m.user_id
  where m.company_id = private.current_active_company_id()
    and m.removed_at is null
    and (
      m.user_id = auth.uid()
      or private.member_can_v1('jobs.read')
    )
  order by m.created_at, m.user_id;
$$;
