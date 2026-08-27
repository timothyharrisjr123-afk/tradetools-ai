-- ---------------------------------------------------------------------------
-- 050 — Align job_payment_requests row guard with 049 customer choice truth
-- ---------------------------------------------------------------------------
--
-- 049 binds deposit requests to proposal_acceptance_contract_option_v1
-- (customer-chosen frozen option when present). The 044 row guard still
-- required proposal_option_id and accepted_total_cents_snapshot to match
-- the contractor frozen columns on proposal_acceptances, blocking every
-- multi-option Pay deposit where the customer chose a non-default package.
--
-- Updates ONLY job_payment_requests_row_guard. 044, 047, 048, and 049
-- remain historical.

create or replace function public.job_payment_requests_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_acceptance public.proposal_acceptances%rowtype;
  v_signature public.proposal_signatures%rowtype;
  v_contract_option_id uuid;
  v_contract_total_cents integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'job_payment_requests rows cannot be deleted';
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    select a.*
    into v_acceptance
    from public.proposal_acceptances a
    where a.id = new.proposal_acceptance_id
      and a.company_id = new.company_id;

    if not found then
      raise exception 'job_payment_requests require a matching proposal_acceptance';
    end if;

    v_contract_option_id :=
      coalesce(v_acceptance.customer_chosen_option_id, v_acceptance.proposal_option_id);
    v_contract_total_cents :=
      coalesce(v_acceptance.customer_chosen_total_cents, v_acceptance.accepted_total_cents);

    if new.job_id is distinct from v_acceptance.job_id
      or new.proposal_id is distinct from v_acceptance.proposal_id
      or new.proposal_version_id is distinct from v_acceptance.proposal_version_id
      or new.proposal_option_id is distinct from v_contract_option_id
    then
      raise exception 'job_payment_requests binding must match the acceptance row';
    end if;

    if new.accepted_total_cents_snapshot is distinct from v_contract_total_cents
      and tg_op = 'INSERT'
    then
      raise exception 'job_payment_requests accepted_total_cents_snapshot must match acceptance';
    end if;

    if new.proposal_signature_id is not null then
      select s.*
      into v_signature
      from public.proposal_signatures s
      where s.id = new.proposal_signature_id
        and s.company_id = new.company_id;

      if not found then
        raise exception 'job_payment_requests signature binding is invalid';
      end if;

      if v_signature.job_id is distinct from new.job_id
        or v_signature.proposal_id is distinct from new.proposal_id
        or v_signature.proposal_version_id is distinct from new.proposal_version_id
        or v_signature.proposal_option_id is distinct from new.proposal_option_id
        or v_signature.proposal_acceptance_id is distinct from new.proposal_acceptance_id
      then
        raise exception 'job_payment_requests signature must match the same acceptance binding';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.company_id is distinct from old.company_id
      or new.job_id is distinct from old.job_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.proposal_option_id is distinct from old.proposal_option_id
      or new.proposal_acceptance_id is distinct from old.proposal_acceptance_id
      or new.proposal_signature_id is distinct from old.proposal_signature_id
      or new.amount_cents is distinct from old.amount_cents
      or new.currency is distinct from old.currency
      or new.kind is distinct from old.kind
      or new.accepted_total_cents_snapshot is distinct from old.accepted_total_cents_snapshot
      or new.option_label_snapshot is distinct from old.option_label_snapshot
      or new.provider is distinct from old.provider
      or new.provider_account_id is distinct from old.provider_account_id
      or new.requested_at is distinct from old.requested_at
      or new.created_by_user_id is distinct from old.created_by_user_id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'job_payment_requests financial identity is immutable';
    end if;

    if old.status = 'paid' and new.status is distinct from 'paid' then
      raise exception 'paid job_payment_requests cannot regress';
    end if;

    if old.status in ('cancelled', 'expired')
      and new.status is distinct from old.status
    then
      raise exception 'cancelled/expired job_payment_requests cannot change status';
    end if;

    new.updated_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.job_payment_requests_row_guard() from public, anon, authenticated;

comment on function public.job_payment_requests_row_guard() is
  '044 payment-request immutability guard, extended in 050 so proposal_option_id and '
  'accepted_total_cents_snapshot validate against contractual acceptance truth '
  '(customer-chosen frozen option when present, otherwise contractor frozen option).';
