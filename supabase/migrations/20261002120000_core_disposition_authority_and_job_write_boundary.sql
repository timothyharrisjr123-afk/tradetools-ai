-- Core safety: exact disposition authority + Job direct-write boundary.
--
-- Corrective follow-up to 20261001160000_phase13c_crew_lifecycle_projection.sql
-- (already applied; left unchanged).
--
-- 1. change_job_disposition_v1 enforces the exact capability for the transition
--    under the Job row lock (previously jobs.hold OR jobs.finalize admitted every
--    target). Locks: Lost any time before Complete, Lost requires a reason,
--    Complete never becomes Lost, Lost is terminal (permanent Lost Reopen is
--    superseded). Closed reopen is unchanged and stays under jobs.finalize.
--    Signature, return shape, grants, idempotent replay, and Activity payload are
--    preserved.
--
-- 2. Authenticated/anon lose direct UPDATE on every jobs column except the three
--    written by SECURITY INVOKER canonical paths (persist_draft_proposal_create_v1:
--    active_proposal_id; select_job_measurement_v1: selected_measurement_id,
--    updated_at), and lose DELETE/TRUNCATE/TRIGGER/REFERENCES/MAINTAIN on jobs.
--    No application or harness path updates or deletes jobs directly; every other
--    Job mutation runs through SECURITY DEFINER RPCs/triggers, which are
--    unaffected. SELECT and INSERT are unchanged.

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
  v_capability text;
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
  v_reason := nullif(btrim(coalesce(p_payload->>'reason', '')), '');

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

  -- Leaving or entering a terminal disposition (lost/closed) is finalize
  -- authority; pausing/resuming an open Job is hold authority.
  if v_to in ('lost', 'closed') or v_job.status in ('lost', 'closed') then
    v_capability := 'jobs.finalize';
  else
    v_capability := 'jobs.hold';
  end if;

  if not private.member_can_v1(v_capability, v_job.id) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
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

  if v_job.status = 'lost' then
    return jsonb_build_object('ok', false, 'code', 'lost_is_terminal');
  end if;

  if v_to = 'lost' and v_job.stage = 'complete' then
    return jsonb_build_object('ok', false, 'code', 'complete_cannot_be_lost');
  end if;

  if v_to = 'lost' and v_reason is null then
    return jsonb_build_object('ok', false, 'code', 'lost_reason_required');
  end if;

  perform set_config('job_lifecycle.allow_status_write', '1', true);

  update public.jobs
  set
    status = v_to,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = v_company_id;

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
-- Job direct-write boundary. Revoking table-level UPDATE also revokes every
-- column-level UPDATE grant; the INVOKER-path columns are granted back.
-- ---------------------------------------------------------------------------
revoke update, delete, truncate, trigger, references, maintain
  on table public.jobs from public, anon, authenticated;

grant update (active_proposal_id, selected_measurement_id, updated_at)
  on table public.jobs to authenticated;
