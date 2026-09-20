-- Phase 1 agreement truth: reject NEW acceptance of a superseded sent version.
-- Historical proposal_acceptances rows already stored as
-- valid_review_required / older_sent_version are preserved and not rewritten.
-- Acceptance still never moves jobs.stage.

create or replace function public.classify_proposal_acceptance_guard_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_proposal_id uuid,
  p_proposal_version_id uuid,
  p_proposal_option_id uuid,
  p_acceptance_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_job public.jobs%rowtype;
  v_proposal public.proposals%rowtype;
  v_version public.proposal_versions%rowtype;
  v_frozen record;
  v_canonical text;
  v_dirty boolean := false;
  v_conflict boolean := false;
begin
  select j.*
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.company_id = p_company_id
    and j.deleted_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'job_mismatch');
  end if;

  select p.*
  into v_proposal
  from public.proposals p
  where p.id = p_proposal_id
    and p.company_id = p_company_id
    and p.job_id = p_job_id;

  if not found then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'job_mismatch');
  end if;

  select pv.*
  into v_version
  from public.proposal_versions pv
  where pv.id = p_proposal_version_id
    and pv.company_id = p_company_id
    and pv.proposal_id = p_proposal_id;

  if not found then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'invalid_binding');
  end if;

  if v_version.version_kind not in ('sent', 'signed') or v_version.frozen_at is null then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'version_not_frozen');
  end if;

  select *
  into v_frozen
  from public.proposal_acceptance_frozen_selected_option_v1(
    p_company_id,
    p_proposal_version_id
  );

  if v_frozen.option_id is null then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'option_not_on_version');
  end if;

  if v_frozen.option_id is distinct from p_proposal_option_id then
    return jsonb_build_object('ok', false, 'result', 'invalid', 'reason', 'option_not_selected_frozen');
  end if;

  v_canonical := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  v_dirty := v_proposal.draft_content_changed_at > v_version.frozen_at;

  select exists (
    select 1
    from public.proposal_acceptances a
    where a.company_id = p_company_id
      and a.proposal_id = p_proposal_id
      and (p_acceptance_id is null or a.id <> p_acceptance_id)
      and (
        a.proposal_version_id is distinct from p_proposal_version_id
        or a.proposal_option_id is distinct from p_proposal_option_id
      )
  )
  into v_conflict;

  if v_job.status = 'lost' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'lost'
    );
  end if;

  if v_job.status = 'closed' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'closed'
    );
  end if;

  if v_canonical in ('approved', 'scheduled', 'production', 'complete') then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'job_already_approved'
    );
  end if;

  if v_job.status = 'on_hold' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'on_hold'
    );
  end if;

  if v_canonical is distinct from 'proposal' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'job_not_in_proposal'
    );
  end if;

  -- Phase 1: NEW acceptance of a non-latest sent version is rejected.
  -- Does not mutate or promote historical valid_review_required rows.
  if v_proposal.latest_sent_version_id is distinct from p_proposal_version_id then
    return jsonb_build_object(
      'ok', false,
      'result', 'invalid',
      'reason', 'superseded'
    );
  end if;

  if v_dirty then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'dirty_revision'
    );
  end if;

  if v_job.active_proposal_id is distinct from p_proposal_id then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'proposal_lineage_conflict'
    );
  end if;

  if v_conflict then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'conflicting_acceptance'
    );
  end if;

  if v_job.status is distinct from 'active' then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'on_hold'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'result', 'valid_clean',
    'reason', null
  );
end;
$$;

comment on function public.classify_proposal_acceptance_guard_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) is
  'R3C shared acceptance guard. valid_clean = latest frozen sent version, clean draft, active Proposal-stage job, matching frozen selected package, unambiguous. Phase 1: accepting a superseded (non-latest) sent version returns invalid/superseded and is not recorded. Historical valid_review_required/older_sent_version rows remain classified in place. Neither valid result moves Job stage. Lost/closed are classified before later-stage so disposition remains visible.';
