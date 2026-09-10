-- FD-P1-02 bounded production remediation.
-- TARGET: production project rhquhnujjnzjhweypavd only.
-- DO NOT run until 20260910200000_quarantine_estimate_job_birth.sql is live.
-- This script clears only the losing soft latest_estimate_id claim. It does not
-- delete/merge either job or rewrite estimates/proposals/payments/history.

begin;

do $$
declare
  v_company_id constant uuid := 'e1fd48bb-fe22-4dfe-9622-3f25eb2109b6';
  v_estimate_id constant uuid := 'e9979843-67aa-42cc-9545-c7362b245269';
  v_winner_job_id constant uuid := 'fa196452-aac4-4524-9a20-eb8bcdf507b7';
  v_loser_job_id constant uuid := '212e66d2-47de-4345-a6f1-efc29f4ac99d';
  v_updated integer;
begin
  if (
    select count(*)
    from public.jobs j
    where j.company_id = v_company_id
      and j.id in (v_winner_job_id, v_loser_job_id)
      and j.latest_estimate_id = v_estimate_id::text
      and j.source_metadata ->> 'source' = 'estimate_snapshot'
      and j.stage = 'measurement'
      and j.status = 'active'
      and j.customer_id is null
      and j.property_id is null
  ) <> 2 then
    raise exception 'known_duplicate_job_shape_changed';
  end if;

  if not exists (
    select 1
    from public.estimates e
    where e.id = v_estimate_id
      and e.company_id = v_company_id
      and e.job_id = v_winner_job_id
  ) then
    raise exception 'estimate_no_longer_points_to_expected_winner';
  end if;

  -- The losing twin must remain an unreferenced operational shell. If any
  -- downstream truth has appeared, stop for a separate adjudication instead of
  -- clearing its claim automatically.
  if exists (select 1 from public.estimates where job_id = v_loser_job_id)
     or exists (select 1 from public.measurement_records where job_id = v_loser_job_id)
     or exists (select 1 from public.proposals where job_id = v_loser_job_id)
     or exists (select 1 from public.proposal_acceptances where job_id = v_loser_job_id)
     or exists (select 1 from public.proposal_signatures where job_id = v_loser_job_id)
     or exists (select 1 from public.job_payment_requests where job_id = v_loser_job_id)
     or exists (select 1 from public.job_payment_refunds where job_id = v_loser_job_id)
     or exists (select 1 from public.job_schedules where job_id = v_loser_job_id)
     or exists (select 1 from public.job_tasks where job_id = v_loser_job_id)
     or exists (select 1 from public.job_attachments where job_id = v_loser_job_id)
     or exists (select 1 from public.job_attention_items where job_id = v_loser_job_id)
     or exists (select 1 from public.job_activity_events where job_id = v_loser_job_id)
  then
    raise exception 'losing_job_has_downstream_truth';
  end if;

  update public.jobs
  set latest_estimate_id = null
  where id = v_loser_job_id
    and company_id = v_company_id
    and latest_estimate_id = v_estimate_id::text
    and source_metadata ->> 'source' = 'estimate_snapshot';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'expected_one_losing_claim_update_got_%', v_updated;
  end if;

  if (
    select count(*)
    from public.jobs
    where company_id = v_company_id
      and latest_estimate_id = v_estimate_id::text
  ) <> 1 then
    raise exception 'estimate_claim_not_reduced_to_one';
  end if;

  if not exists (
    select 1 from public.jobs
    where id = v_winner_job_id
      and company_id = v_company_id
      and latest_estimate_id = v_estimate_id::text
  ) then
    raise exception 'winner_claim_changed';
  end if;
end;
$$;

commit;
