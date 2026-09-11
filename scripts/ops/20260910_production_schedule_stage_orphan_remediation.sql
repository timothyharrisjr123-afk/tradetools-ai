-- FD-P1-06 / A4 bounded production remediation.
-- TARGET: production project rhquhnujjnzjhweypavd only.
-- ORDER: run after a read-only reconfirmation and before
-- 20260910214259_schedule_stage_convergence.sql.
--
-- This corrects one audited synthetic negative fixture from Scheduled to its
-- uninterrupted Intake truth. It does not insert Activity, create/cancel a
-- schedule, or touch any other row.

begin;

do $$
declare
  v_company_id constant uuid := 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6';
  v_job_id constant uuid := '366afed3-2eee-4558-8630-63e4f0dda99e';
  v_updated integer;
begin
  perform 1
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
  for update;

  if not found then
    raise exception 'a4_known_orphan_not_found';
  end if;

  if (
    select count(*)
    from public.jobs j
    where j.id = v_job_id
      and j.company_id = v_company_id
      and j.stage = 'scheduled'
      and j.status = 'active'
      and coalesce(j.archived, false) = false
      and j.deleted_at is null
      and j.production_started_at is null
      and j.completed_at is null
  ) <> 1 then
    raise exception 'a4_known_orphan_job_shape_changed';
  end if;

  if exists (
    select 1
    from public.job_schedules s
    where s.job_id = v_job_id
  ) then
    raise exception 'a4_known_orphan_has_schedule_truth';
  end if;

  if exists (
    select 1
    from public.proposals p
    where p.job_id = v_job_id
  ) then
    raise exception 'a4_known_orphan_has_proposal_truth';
  end if;

  if exists (
    select 1
    from public.proposal_acceptances a
    where a.job_id = v_job_id
  ) or exists (
    select 1
    from public.proposal_signatures s
    where s.job_id = v_job_id
  ) then
    raise exception 'a4_known_orphan_has_downstream_proposal_truth';
  end if;

  if (
    select count(*)
    from public.job_activity_events e
    where e.job_id = v_job_id
      and e.company_id = v_company_id
  ) <> 1 or not exists (
    select 1
    from public.job_activity_events e
    where e.job_id = v_job_id
      and e.company_id = v_company_id
      and e.event_type = 'job_created'
  ) then
    raise exception 'a4_known_orphan_activity_shape_changed';
  end if;

  if exists (
    select 1
    from public.job_activity_events e
    where e.job_id = v_job_id
      and e.company_id = v_company_id
      and e.event_type in (
        'job_scheduled',
        'job_rescheduled',
        'job_unscheduled',
        'job_work_started',
        'job_work_completed',
        'stage_changed'
      )
  ) then
    raise exception 'a4_known_orphan_has_lifecycle_activity';
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);

  update public.jobs j
  set
    stage = 'intake',
    stage_entered_at = j.created_at
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.stage = 'scheduled'
    and j.status = 'active'
    and coalesce(j.archived, false) = false
    and j.deleted_at is null
    and j.production_started_at is null
    and j.completed_at is null;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'a4_expected_one_orphan_update_got_%', v_updated;
  end if;

  if not exists (
    select 1
    from public.jobs j
    where j.id = v_job_id
      and j.company_id = v_company_id
      and j.stage = 'intake'
      and j.stage_entered_at = j.created_at
      and j.status = 'active'
      and j.production_started_at is null
      and j.completed_at is null
  ) then
    raise exception 'a4_known_orphan_postcondition_failed';
  end if;

  if (
    select count(*)
    from public.job_activity_events e
    where e.job_id = v_job_id
      and e.company_id = v_company_id
  ) <> 1 then
    raise exception 'a4_remediation_must_not_fabricate_activity';
  end if;
end;
$$;

commit;
