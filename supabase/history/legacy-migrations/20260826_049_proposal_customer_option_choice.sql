-- ---------------------------------------------------------------------------
-- 049  Customer-chosen package binding for a frozen sent proposal version
-- ---------------------------------------------------------------------------
--
-- WHY THIS MIGRATION EXISTS
--
-- Public proposals may offer more than one frozen package. Until now the
-- customer could not choose one: acceptance always bound to the CONTRACTOR's
-- frozen selection, resolved by proposal_acceptance_frozen_selected_option_v1
-- (040). classify_proposal_acceptance_guard_v1 actively rejects any other
-- option with reason 'option_not_selected_frozen', and
-- proposal_acceptances.proposal_option_id is documented as
-- "Frozen selected package on the accepted version (selected_at / default)".
--
-- Recording a customer choice in proposal_option_id would therefore change the
-- meaning of an existing column and require rewriting an existing guard. This
-- migration adds separate, additive truth instead.
--
-- MODEL
--
--   proposal_option_id          -> contractor frozen selection (UNCHANGED)
--   customer_chosen_option_id   -> what the customer actually chose (NEW)
--
-- customer_chosen_* is NULL when the customer made no explicit choice, which
-- is every single-option proposal and every pre-049 row. NULL therefore means
-- "contractor frozen selection governs" and preserves 040/044/048 behavior
-- exactly. When NOT NULL, the customer-chosen option governs the contractual
-- total and the deposit derived from it.
--
-- Keeping proposal_option_id as the contractor frozen option also preserves
-- proposal_acceptances_logical_unique as exactly ONE acceptance per frozen
-- version, so repeated Pay/Confirm presses replay the same row and the first
-- committed choice is contractual.
--
-- Selection is bound at the acceptance INSERT. It is never updated afterwards.
--
-- HISTORICAL MIGRATIONS ARE NOT EDITED.
-- 039 remains absent / reserved.
-- 040, 043, 044, 047, 048 files are unchanged.
-- Functions first defined in 040 and 048 are replaced here with
-- CREATE OR REPLACE, which is how 048 itself superseded 044's payment
-- functions. No historical file is rewritten.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Additive columns on proposal_acceptances
-- ---------------------------------------------------------------------------

alter table public.proposal_acceptances
  add column if not exists customer_chosen_option_id uuid null,
  add column if not exists customer_chosen_option_label text null,
  add column if not exists customer_chosen_total_cents integer null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'proposal_acceptances_customer_choice_option_fkey'
  ) then
    alter table public.proposal_acceptances
      add constraint proposal_acceptances_customer_choice_option_fkey
      foreign key (customer_chosen_option_id, company_id)
      references public.proposal_options (id, company_id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'proposal_acceptances_customer_choice_complete_check'
  ) then
    alter table public.proposal_acceptances
      add constraint proposal_acceptances_customer_choice_complete_check
      check (
        (
          customer_chosen_option_id is null
          and customer_chosen_option_label is null
          and customer_chosen_total_cents is null
        )
        or (
          customer_chosen_option_id is not null
          and customer_chosen_option_label is not null
          and customer_chosen_total_cents is not null
          and customer_chosen_total_cents >= 0
        )
      );
  end if;
end;
$$;

comment on column public.proposal_acceptances.customer_chosen_option_id is
  'Frozen package the CUSTOMER chose on the accepted version. NULL means the '
  'customer made no explicit choice (single-option proposal or pre-049 row) and '
  'proposal_option_id governs. Never rewritten after insert.';

comment on column public.proposal_acceptances.customer_chosen_option_label is
  'Snapshot of the chosen frozen option label at acceptance. Evidence only.';

comment on column public.proposal_acceptances.customer_chosen_total_cents is
  'Snapshot of the chosen frozen proposal_options.customer_total_cents at '
  'acceptance. Contractual total when present. Not a payment field.';

create index if not exists idx_proposal_acceptances_customer_choice
  on public.proposal_acceptances (company_id, customer_chosen_option_id)
  where customer_chosen_option_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Immutability — the recorded choice can never be rewritten
-- ---------------------------------------------------------------------------

create or replace function public.proposal_acceptances_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'proposal_acceptances rows cannot be deleted';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.company_id is distinct from old.company_id
      or new.job_id is distinct from old.job_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.proposal_option_id is distinct from old.proposal_option_id
      or new.public_access_token_id is distinct from old.public_access_token_id
      or new.accepted_at is distinct from old.accepted_at
      or new.accepted_by_name is distinct from old.accepted_by_name
      or new.accepted_by_email is distinct from old.accepted_by_email
      or new.source is distinct from old.source
      or new.method is distinct from old.method
      or new.accepted_option_label is distinct from old.accepted_option_label
      or new.accepted_total_cents is distinct from old.accepted_total_cents
      or new.guard_result is distinct from old.guard_result
      or new.ambiguity_reason is distinct from old.ambiguity_reason
      or new.created_at is distinct from old.created_at
      or new.customer_chosen_option_id is distinct from old.customer_chosen_option_id
      or new.customer_chosen_option_label is distinct from old.customer_chosen_option_label
      or new.customer_chosen_total_cents is distinct from old.customer_chosen_total_cents
    then
      raise exception 'proposal_acceptances identity and evidence fields are immutable';
    end if;

    if old.confirmed_at is not null
      and (
        new.confirmed_at is distinct from old.confirmed_at
        or new.confirmed_by_user_id is distinct from old.confirmed_by_user_id
      )
    then
      raise exception 'proposal_acceptances confirmation fields cannot be rewritten';
    end if;

    if old.confirmed_at is null
      and new.confirmed_at is null
      and new.confirmed_by_user_id is null
    then
      raise exception 'proposal_acceptances UPDATE must set confirmation fields';
    end if;

    return new;
  end if;

  return new;
end;
$$;

revoke all on function public.proposal_acceptances_row_guard() from public;
revoke all on function public.proposal_acceptances_row_guard() from anon;
revoke all on function public.proposal_acceptances_row_guard() from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Resolve a customer-supplied option key against ONE frozen version
-- ---------------------------------------------------------------------------
--
-- The public DTO exposes options by source_template_option_id, never by
-- proposal_options.id. The customer therefore cannot supply a runtime option
-- UUID, and resolution is scoped to the version bound to their token.
--
-- An option is choosable only when it is on that exact version, visible to the
-- customer, and carries a frozen total.

create or replace function public.proposal_resolve_customer_chosen_option_v1(
  p_company_id uuid,
  p_proposal_version_id uuid,
  p_option_key text
)
returns table (
  option_id uuid,
  option_label text,
  total_cents integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    po.id,
    left(trim(coalesce(nullif(trim(po.customer_label), ''), po.name)), 120),
    po.customer_total_cents
  from public.proposal_options po
  where po.company_id = p_company_id
    and po.proposal_version_id = p_proposal_version_id
    and trim(coalesce(p_option_key, '')) <> ''
    and trim(coalesce(po.source_template_option_id::text, '')) = trim(coalesce(p_option_key, ''))
    and po.visible_to_customer is true
    and po.customer_total_cents is not null
  order by po.sort_order, po.id
  limit 1;
$$;

revoke all on function public.proposal_resolve_customer_chosen_option_v1(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.proposal_resolve_customer_chosen_option_v1(uuid, uuid, text)
  to service_role;

comment on function public.proposal_resolve_customer_chosen_option_v1(uuid, uuid, text) is
  'Resolves a customer-supplied source_template_option_id to a frozen '
  'proposal_options row on exactly one version. Rejects options that are not on '
  'the version, hidden from the customer, or unpriced. Server-side price '
  'authority: the total is read from frozen truth, never from the client.';

-- ---------------------------------------------------------------------------
-- 4. Contractual option/label/total for an acceptance
-- ---------------------------------------------------------------------------
--
-- Single source of truth for "what did this acceptance actually buy".
-- Customer choice wins when present; contractor frozen selection otherwise.

create or replace function public.proposal_acceptance_contract_option_v1(
  p_company_id uuid,
  p_acceptance_id uuid
)
returns table (
  option_id uuid,
  option_label text,
  total_cents integer,
  customer_chose boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(a.customer_chosen_option_id, a.proposal_option_id),
    coalesce(a.customer_chosen_option_label, a.accepted_option_label),
    coalesce(a.customer_chosen_total_cents, a.accepted_total_cents),
    a.customer_chosen_option_id is not null
  from public.proposal_acceptances a
  where a.id = p_acceptance_id
    and a.company_id = p_company_id;
$$;

revoke all on function public.proposal_acceptance_contract_option_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.proposal_acceptance_contract_option_v1(uuid, uuid)
  to authenticated, service_role;

comment on function public.proposal_acceptance_contract_option_v1(uuid, uuid) is
  'Contractual option/label/total for one acceptance. Customer-chosen package '
  'governs when present, otherwise the contractor frozen selection. Use this '
  'wherever money is derived from an acceptance.';

-- ---------------------------------------------------------------------------
-- 5. record_proposal_acceptance_v1 — bind the customer choice at INSERT
-- ---------------------------------------------------------------------------
--
-- Signature is UNCHANGED. The optional choice travels in the existing
-- p_payload_json as 'customer_option_key', which is already validated as a
-- JSON object and already screened for forbidden token keys.
--
-- Behavior when no key is supplied is byte-for-byte the 040 behavior.

create or replace function public.record_proposal_acceptance_v1(
  p_token_hash text,
  p_accepted_by_name text default null,
  p_accepted_by_email text default null,
  p_payload_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assert jsonb;
  v_token_id uuid;
  v_company_id uuid;
  v_proposal_id uuid;
  v_proposal_version_id uuid;
  v_job_id uuid;
  v_locked_token record;
  v_proposal public.proposals%rowtype;
  v_job public.jobs%rowtype;
  v_frozen record;
  v_name text;
  v_email text;
  v_payload jsonb;
  v_before_selected_option_id uuid;
  v_acceptance public.proposal_acceptances%rowtype;
  v_idempotent_replay boolean := false;
  v_guard jsonb;
  v_guard_result text;
  v_reason text;
  v_attention jsonb;
  v_attention_id uuid;
  v_after_selected_option_id uuid;
  v_option_key text;
  v_choice_option_id uuid := null;
  v_choice_option_label text := null;
  v_choice_total_cents integer := null;
begin
  v_assert := public.proposal_assert_public_access_token_active_v1(p_token_hash);

  if coalesce((v_assert->>'ok')::boolean, false) is not true then
    return v_assert;
  end if;

  v_token_id := (v_assert->>'token_id')::uuid;
  v_company_id := (v_assert->>'company_id')::uuid;
  v_proposal_id := (v_assert->>'proposal_id')::uuid;
  v_proposal_version_id := (v_assert->>'proposal_version_id')::uuid;

  select
    t.id,
    t.company_id,
    t.proposal_id,
    t.proposal_version_id,
    t.status,
    t.expires_at,
    pv.version_kind,
    pv.frozen_at
  into v_locked_token
  from public.proposal_public_access_tokens t
  join public.proposal_versions pv
    on pv.id = t.proposal_version_id
   and pv.company_id = t.company_id
   and pv.proposal_id = t.proposal_id
  where t.id = v_token_id
    and t.token_hash = trim(coalesce(p_token_hash, ''))
  for share of t, pv;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_binding');
  end if;

  if v_locked_token.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;

  if v_locked_token.status = 'superseded' then
    return jsonb_build_object('ok', false, 'code', 'superseded');
  end if;

  if v_locked_token.status <> 'active'
    or v_locked_token.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  if v_locked_token.company_id is distinct from v_company_id
    or v_locked_token.proposal_id is distinct from v_proposal_id
    or v_locked_token.proposal_version_id is distinct from v_proposal_version_id
    or v_locked_token.version_kind not in ('sent', 'signed')
    or v_locked_token.frozen_at is null
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_binding');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('proposal_acceptance:' || v_proposal_id::text, 0)
  );

  select p.*
  into v_proposal
  from public.proposals p
  where p.id = v_proposal_id
    and p.company_id = v_company_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'proposal_unavailable');
  end if;

  v_job_id := v_proposal.job_id;
  v_before_selected_option_id := v_proposal.selected_option_id;

  if v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'proposal_unavailable');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_job_id
    and j.company_id = v_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'job_mismatch');
  end if;

  select *
  into v_frozen
  from public.proposal_acceptance_frozen_selected_option_v1(
    v_company_id,
    v_proposal_version_id
  );

  if v_frozen.option_id is null then
    return jsonb_build_object('ok', false, 'code', 'option_not_on_version');
  end if;

  v_name := nullif(trim(coalesce(p_accepted_by_name, '')), '');
  if v_name is not null and char_length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_name');
  end if;

  v_email := nullif(trim(coalesce(p_accepted_by_email, '')), '');
  if v_email is not null and char_length(v_email) > 254 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_email');
  end if;

  v_payload := coalesce(p_payload_json, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if public.proposal_forbidden_token_json_keys(v_payload) then
    return jsonb_build_object('ok', false, 'code', 'forbidden_payload_keys');
  end if;

  -- Customer package choice. Absent key preserves pre-049 behavior exactly.
  v_option_key := nullif(trim(coalesce(v_payload->>'customer_option_key', '')), '');

  if v_option_key is not null then
    if char_length(v_option_key) > 200 then
      return jsonb_build_object('ok', false, 'code', 'invalid_option_choice');
    end if;

    select c.option_id, c.option_label, c.total_cents
    into v_choice_option_id, v_choice_option_label, v_choice_total_cents
    from public.proposal_resolve_customer_chosen_option_v1(
      v_company_id,
      v_proposal_version_id,
      v_option_key
    ) c;

    if v_choice_option_id is null or v_choice_total_cents is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_option_choice');
    end if;
  end if;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.company_id = v_company_id
    and a.proposal_id = v_proposal_id
    and a.proposal_version_id = v_proposal_version_id
    and a.proposal_option_id = v_frozen.option_id
  for update;

  if found then
    v_idempotent_replay := true;
  else
    v_guard := public.classify_proposal_acceptance_guard_v1(
      v_company_id,
      v_job_id,
      v_proposal_id,
      v_proposal_version_id,
      v_frozen.option_id,
      null
    );

    if coalesce(v_guard->>'result', '') = 'invalid' then
      return jsonb_build_object(
        'ok', false,
        'code', coalesce(v_guard->>'reason', 'invalid_binding')
      );
    end if;

    v_guard_result := v_guard->>'result';
    v_reason := nullif(v_guard->>'reason', '');

    begin
      insert into public.proposal_acceptances (
        company_id,
        job_id,
        proposal_id,
        proposal_version_id,
        proposal_option_id,
        public_access_token_id,
        accepted_by_name,
        accepted_by_email,
        accepted_option_label,
        accepted_total_cents,
        guard_result,
        ambiguity_reason,
        customer_chosen_option_id,
        customer_chosen_option_label,
        customer_chosen_total_cents
      ) values (
        v_company_id,
        v_job_id,
        v_proposal_id,
        v_proposal_version_id,
        v_frozen.option_id,
        v_token_id,
        v_name,
        v_email,
        v_frozen.option_label,
        v_frozen.customer_total_cents,
        v_guard_result,
        v_reason,
        v_choice_option_id,
        v_choice_option_label,
        v_choice_total_cents
      )
      returning * into v_acceptance;
    exception
      when unique_violation then
        select a.*
        into v_acceptance
        from public.proposal_acceptances a
        where a.company_id = v_company_id
          and a.proposal_id = v_proposal_id
          and a.proposal_version_id = v_proposal_version_id
          and a.proposal_option_id = v_frozen.option_id
        for update;
        v_idempotent_replay := true;
    end;
  end if;

  -- Customer acceptance never moves Job stage. Always surface Attention
  -- until the contractor explicitly Approves job — unless this logical
  -- acceptance was already operationally confirmed.
  if v_acceptance.confirmed_at is null then
    v_attention := public.project_proposal_acceptance_attention_v1(v_acceptance.id);
    v_attention_id := nullif(v_attention->>'attention_id', '')::uuid;
  else
    select ai.id
    into v_attention_id
    from public.job_attention_items ai
    where ai.company_id = v_acceptance.company_id
      and ai.source_type = 'proposal_acceptances'
      and ai.source_id = v_acceptance.id;
  end if;

  select p.selected_option_id
  into v_after_selected_option_id
  from public.proposals p
  where p.id = v_proposal_id
    and p.company_id = v_company_id;

  if v_after_selected_option_id is distinct from v_before_selected_option_id then
    raise exception 'formal acceptance must not mutate proposals.selected_option_id';
  end if;

  return jsonb_build_object(
    'ok', true,
    'acceptance_id', v_acceptance.id,
    'token_id', v_token_id,
    'company_id', v_company_id,
    'job_id', v_job_id,
    'proposal_id', v_proposal_id,
    'proposal_version_id', v_proposal_version_id,
    'proposal_option_id', v_acceptance.proposal_option_id,
    'accepted_option_label', v_acceptance.accepted_option_label,
    'accepted_total_cents', v_acceptance.accepted_total_cents,
    'customer_chosen_option_id', v_acceptance.customer_chosen_option_id,
    'customer_chosen_option_label', v_acceptance.customer_chosen_option_label,
    'customer_chosen_total_cents', v_acceptance.customer_chosen_total_cents,
    'contract_total_cents', coalesce(
      v_acceptance.customer_chosen_total_cents,
      v_acceptance.accepted_total_cents
    ),
    'accepted_at', v_acceptance.accepted_at,
    'guard_result', v_acceptance.guard_result,
    'ambiguity_reason', v_acceptance.ambiguity_reason,
    'attention_id', v_attention_id,
    'job_stage', (
      select public.canonical_job_stage_from_row(
        j.stage, j.status, coalesce(j.archived, false), j.active_proposal_id, j.latest_proposal_id
      )
      from public.jobs j
      where j.id = v_job_id and j.company_id = v_company_id
    ),
    'stage_entered_at', (
      select j.stage_entered_at
      from public.jobs j
      where j.id = v_job_id and j.company_id = v_company_id
    ),
    'job_stage_unchanged', true,
    'idempotent_replay', v_idempotent_replay,
    'selected_option_id_unchanged', v_after_selected_option_id
  );
end;
$$;

revoke all on function public.record_proposal_acceptance_v1(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_proposal_acceptance_v1(text, text, text, jsonb)
  to service_role;

comment on function public.record_proposal_acceptance_v1(text, text, text, jsonb) is
  'R3C public formal acceptance, extended in 049 with customer package choice. '
  'Validates the existing public-access token, inserts one immutable logical '
  'acceptance per frozen version + contractor-selected option, and binds the '
  'customer-chosen frozen option when p_payload_json.customer_option_key is '
  'supplied. The chosen option must be on the bound version, visible to the '
  'customer, and priced; its total is read from frozen truth, never the client. '
  'Classifies valid_clean vs valid_review_required and projects contractor '
  'Attention. NEVER updates jobs.stage or stage_entered_at. Never stores raw '
  'tokens. Same-version resend tokens reuse the logical row, so the first '
  'committed customer choice is contractual.';

-- ---------------------------------------------------------------------------
-- 6. open_job_deposit_from_acceptance_v1 — derive money from contract truth
-- ---------------------------------------------------------------------------
--
-- Identical to the 048 function except that the option, label, and total now
-- come from proposal_acceptance_contract_option_v1 instead of reading
-- proposal_option_id / accepted_total_cents directly. When no customer choice
-- exists the contract helper returns exactly those columns, so behavior for
-- every pre-049 acceptance is unchanged.

create or replace function public.open_job_deposit_from_acceptance_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_acceptance_id uuid;
  v_acceptance public.proposal_acceptances%rowtype;
  v_contract_option_id uuid;
  v_contract_option_label text;
  v_contract_total_cents integer;
  v_contract_customer_chose boolean := false;
  v_job public.jobs%rowtype;
  v_terms public.proposal_version_payment_terms%rowtype;
  v_account public.company_payment_accounts%rowtype;
  v_existing public.job_payment_requests%rowtype;
  v_failed public.job_payment_requests%rowtype;
  v_request public.job_payment_requests%rowtype;
  v_net integer;
  v_amount integer;
  v_signature_id uuid;
  v_before_stage text;
  v_before_entered timestamptz;
  v_after_stage text;
  v_after_entered timestamptz;
begin
  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_acceptance_id := nullif(p_payload->>'acceptance_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_acceptance_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = v_acceptance_id
    and a.company_id = v_company_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_acceptance');
  end if;

  if exists (
    select 1
    from public.proposal_acceptances later
    where later.company_id = v_company_id
      and later.job_id = v_acceptance.job_id
      and later.accepted_at > v_acceptance.accepted_at
  ) then
    return jsonb_build_object('ok', false, 'code', 'superseded');
  end if;

  select c.option_id, c.option_label, c.total_cents, c.customer_chose
  into
    v_contract_option_id,
    v_contract_option_label,
    v_contract_total_cents,
    v_contract_customer_chose
  from public.proposal_acceptance_contract_option_v1(v_company_id, v_acceptance_id) c;

  if v_contract_option_id is null or v_contract_total_cents is null then
    return jsonb_build_object('ok', false, 'code', 'no_acceptance');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'job_payment_request:' || v_company_id::text || ':' || v_acceptance.job_id::text,
      0
    )
  );

  select j.*
  into v_job
  from public.jobs j
  where j.id = v_acceptance.job_id
    and j.company_id = v_company_id
  for update;

  if not found
    or coalesce(v_job.archived, false)
    or coalesce(v_job.status, 'active') <> 'active'
  then
    return jsonb_build_object('ok', false, 'code', 'job_not_active');
  end if;

  select s.job_stage, s.stage_entered_at
  into v_before_stage, v_before_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_acceptance.job_id) s;

  -- Stale open/failed requests on prior acceptances must not collect.
  -- Leave processing in flight until webhook settlement.
  update public.job_payment_requests
  set
    status = 'cancelled',
    cancelled_at = coalesce(cancelled_at, now())
  where company_id = v_company_id
    and job_id = v_acceptance.job_id
    and status in ('open', 'failed')
    and proposal_acceptance_id is distinct from v_acceptance.id;

  select t.*
  into v_terms
  from public.proposal_version_payment_terms t
  where t.proposal_version_id = v_acceptance.proposal_version_id
    and t.company_id = v_company_id;

  if not found or v_terms.deposit_mode = 'none' then
    return jsonb_build_object('ok', true, 'skipped', true, 'code', 'no_deposit');
  end if;

  v_net := public.job_payment_net_received_cents_v1(v_company_id, v_acceptance.job_id);
  v_amount := public.job_payment_additional_deposit_cents_v1(
    v_terms.deposit_mode,
    v_terms.deposit_percent_bps,
    v_terms.deposit_fixed_cents,
    v_contract_total_cents,
    v_net
  );

  if v_amount < 100 then
    return jsonb_build_object('ok', true, 'skipped', true, 'code', 'deposit_satisfied');
  end if;

  select r.*
  into v_existing
  from public.job_payment_requests r
  where r.company_id = v_company_id
    and r.job_id = v_acceptance.job_id
    and r.proposal_acceptance_id = v_acceptance.id
    and r.kind = 'deposit'
    and r.status in ('open', 'processing')
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'id', v_existing.id,
      'amount_cents', v_existing.amount_cents,
      'idempotent_replay', true,
      'skipped', false
    );
  end if;

  select a.*
  into v_account
  from public.company_payment_accounts a
  where a.company_id = v_company_id
    and a.provider = 'stripe'
  for update;

  if not found or not v_account.charges_enabled then
    return jsonb_build_object('ok', false, 'code', 'not_connected');
  end if;

  select s.id
  into v_signature_id
  from public.proposal_signatures s
  where s.company_id = v_company_id
    and s.proposal_acceptance_id = v_acceptance.id
    and s.signer_slot = 'customer_primary'
  limit 1;

  select r.*
  into v_failed
  from public.job_payment_requests r
  where r.company_id = v_company_id
    and r.job_id = v_acceptance.job_id
    and r.kind = 'deposit'
    and r.status = 'failed'
    and r.proposal_acceptance_id = v_acceptance.id
  order by r.requested_at desc
  limit 1
  for update;

  if found then
    update public.job_payment_requests
    set
      status = 'open',
      amount_cents = v_amount,
      provider_checkout_session_id = null,
      checkout_generation = checkout_generation + 1
    where id = v_failed.id
    returning * into v_request;

    perform public.job_payment_resolve_attention_v1(
      v_company_id,
      'payment_failed:job_payment_requests:' || v_request.id::text
    );
  else
    insert into public.job_payment_requests (
      company_id,
      job_id,
      proposal_id,
      proposal_version_id,
      proposal_option_id,
      proposal_acceptance_id,
      proposal_signature_id,
      amount_cents,
      currency,
      kind,
      accepted_total_cents_snapshot,
      option_label_snapshot,
      provider,
      provider_account_id,
      status,
      created_by_user_id
    )
    values (
      v_company_id,
      v_acceptance.job_id,
      v_acceptance.proposal_id,
      v_acceptance.proposal_version_id,
      v_contract_option_id,
      v_acceptance.id,
      v_signature_id,
      v_amount,
      'usd',
      'deposit',
      v_contract_total_cents,
      left(trim(v_contract_option_label), 120),
      'stripe',
      v_account.provider_account_id,
      'open',
      null
    )
    returning * into v_request;
  end if;

  select s.job_stage, s.stage_entered_at
  into v_after_stage, v_after_entered
  from public.job_payment_snapshot_stage_v1(v_company_id, v_acceptance.job_id) s;

  if v_after_stage is distinct from v_before_stage
    or v_after_entered is distinct from v_before_entered
  then
    raise exception 'job payment request must not change job stage';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_request.id,
    'amount_cents', v_request.amount_cents,
    'customer_chose_option', coalesce(v_contract_customer_chose, false),
    'idempotent_replay', false,
    'skipped', false,
    'job_stage_unchanged', true
  );
end;
$$;

revoke all on function public.open_job_deposit_from_acceptance_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.open_job_deposit_from_acceptance_v1(jsonb) to service_role;

comment on function public.open_job_deposit_from_acceptance_v1(jsonb) is
  'Opens the terms-driven deposit for one acceptance, extended in 049 to derive '
  'the option, label, and total from proposal_acceptance_contract_option_v1 so a '
  'customer-chosen package governs the amount. Server-owned amount. Refuses '
  'superseded acceptances, cancels stale requests from prior acceptances, and '
  'never changes job stage.';
