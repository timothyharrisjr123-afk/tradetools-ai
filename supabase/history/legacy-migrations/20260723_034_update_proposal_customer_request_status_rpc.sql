-- R3B3 — Contractor review status update for customer package requests.
-- REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
--
-- Authenticated company members may mark request rows seen/dismissed.
-- Does NOT mutate proposals.status, jobs.stage, selected_option_id,
-- options/upgrades, or proposal_events. Never exposes raw tokens.

create or replace function public.update_proposal_customer_request_status_v1(
  p_request_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.proposal_customer_requests%rowtype;
  v_next_status text;
  v_before_proposal_status text;
  v_before_selected_option_id uuid;
  v_before_job_stage text;
  v_after_proposal_status text;
  v_after_selected_option_id uuid;
  v_after_job_stage text;
  v_job_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  if p_request_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_request_id');
  end if;

  v_next_status := nullif(trim(coalesce(p_status, '')), '');
  if v_next_status is null or v_next_status not in ('seen', 'dismissed') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  -- Reject formal commitment statuses explicitly (defense in depth).
  if lower(coalesce(p_status, '')) in (
    'accepted', 'approved', 'signed', 'paid', 'won', 'scheduled'
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  select *
  into v_request
  from public.proposal_customer_requests r
  where r.id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if not exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = v_request.company_id
      and cm.user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  -- Allowed transitions: new → seen | dismissed; seen → dismissed.
  if v_request.status = v_next_status then
    -- Idempotent no-op success.
    null;
  elsif v_request.status = 'new' and v_next_status in ('seen', 'dismissed') then
    null;
  elsif v_request.status = 'seen' and v_next_status = 'dismissed' then
    null;
  else
    return jsonb_build_object('ok', false, 'code', 'invalid_transition');
  end if;

  select
    p.status,
    p.selected_option_id,
    p.job_id,
    j.stage
  into
    v_before_proposal_status,
    v_before_selected_option_id,
    v_job_id,
    v_before_job_stage
  from public.proposals p
  left join public.jobs j
    on j.id = p.job_id
   and j.company_id = p.company_id
  where p.id = v_request.proposal_id
    and p.company_id = v_request.company_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'proposal_unavailable');
  end if;

  if v_request.status is distinct from v_next_status then
    update public.proposal_customer_requests
    set status = v_next_status
    where id = v_request.id
      and company_id = v_request.company_id;
  end if;

  select
    p.status,
    p.selected_option_id,
    j.stage
  into
    v_after_proposal_status,
    v_after_selected_option_id,
    v_after_job_stage
  from public.proposals p
  left join public.jobs j
    on j.id = p.job_id
   and j.company_id = p.company_id
  where p.id = v_request.proposal_id
    and p.company_id = v_request.company_id;

  if v_after_proposal_status is distinct from v_before_proposal_status
    or v_after_selected_option_id is distinct from v_before_selected_option_id
    or v_after_job_stage is distinct from v_before_job_stage
  then
    raise exception 'update_proposal_customer_request_status_v1 must not mutate proposal/job truth';
  end if;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.id,
    'status', v_next_status,
    'previous_status', v_request.status,
    'proposal_id', v_request.proposal_id,
    'proposal_version_id', v_request.proposal_version_id,
    'proposal_status_unchanged', v_after_proposal_status,
    'selected_option_id_unchanged', v_after_selected_option_id,
    'job_stage_unchanged', v_after_job_stage
  );
end;
$$;

comment on function public.update_proposal_customer_request_status_v1(uuid, text) is
  'R3B3 — Authenticated company member marks a customer package request seen/dismissed. '
  'Does not mutate proposals.status, jobs.stage, selected_option_id, options/upgrades, or proposal_events. '
  'Never exposes raw tokens.';

revoke all on function public.update_proposal_customer_request_status_v1(uuid, text) from public;
revoke all on function public.update_proposal_customer_request_status_v1(uuid, text) from anon;
grant execute on function public.update_proposal_customer_request_status_v1(uuid, text) to authenticated;
grant execute on function public.update_proposal_customer_request_status_v1(uuid, text) to service_role;
