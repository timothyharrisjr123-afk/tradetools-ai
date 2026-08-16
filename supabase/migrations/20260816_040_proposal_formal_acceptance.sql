-- R3C — Formal customer acceptance
-- AUTHOR ONLY — DO NOT APPLY WITHOUT EXPLICIT LIVE-APPLY APPROVAL.
--
-- Number 040 is the next unused migration after 038.
-- 039 remains reserved for deferred C4 generic-email-mint hardening (NOT this file).
-- Migration 038 remains Job Lifecycle Foundation and is not rewritten here.
--
-- This migration does NOT:
--   - implement signatures, payments, deposits, or scheduling
--   - change Proposal V2 freeze / pricing / token mint / C4 supersession
--   - mutate frozen versions, frozen line items, or proposals.selected_option_id
--   - globally enable transition_job_stage_v1(..., 'approved')
--   - author C4 generic-email-mint hardening
--
-- Public acceptance reuses proposal_assert_public_access_token_active_v1.
-- Customer acceptance NEVER changes jobs.stage or stage_entered_at.
-- Proposal → Approved is possible ONLY through explicit contractor Approve job
-- (confirm_proposal_acceptance_v1). There is no automatic Proposal → Approved
-- transition in R3C.
-- Later valid acceptance after Approved/Scheduled/Production/Complete is
-- historical awareness: record + Attention + Acknowledge. It does not regress
-- stage, reset stage_entered_at, change disposition, or replace confirmed_at.

begin;

-- ---------------------------------------------------------------------------
-- 1. proposal_acceptances — append-only immutable acceptance truth
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_acceptances (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete restrict,
  job_id uuid not null,
  proposal_id uuid not null,
  proposal_version_id uuid not null,
  proposal_option_id uuid not null,
  public_access_token_id uuid not null,

  accepted_at timestamptz not null default now(),
  accepted_by_name text null,
  accepted_by_email text null,

  source text not null default 'public_token',
  method text not null default 'formal_accept',

  accepted_option_label text not null,
  accepted_total_cents integer not null,

  guard_result text not null,
  ambiguity_reason text null,

  confirmed_at timestamptz null,
  confirmed_by_user_id uuid null references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),

  constraint proposal_acceptances_id_company_unique
    unique (id, company_id),

  -- Logical acceptance identity is frozen sent truth, not token issuance.
  -- C4 may mint multiple active tokens for the same sent version.
  constraint proposal_acceptances_logical_unique
    unique (company_id, proposal_id, proposal_version_id, proposal_option_id),

  constraint proposal_acceptances_job_company_fkey
    foreign key (job_id, company_id)
    references public.jobs (id, company_id)
    on delete restrict,

  constraint proposal_acceptances_proposal_company_fkey
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete restrict,

  constraint proposal_acceptances_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete restrict,

  constraint proposal_acceptances_option_company_fkey
    foreign key (proposal_option_id, company_id)
    references public.proposal_options (id, company_id)
    on delete restrict,

  constraint proposal_acceptances_token_company_fkey
    foreign key (public_access_token_id, company_id)
    references public.proposal_public_access_tokens (id, company_id)
    on delete restrict,

  constraint proposal_acceptances_source_check
    check (source = 'public_token'),

  constraint proposal_acceptances_method_check
    check (method = 'formal_accept'),

  constraint proposal_acceptances_guard_result_check
    check (guard_result in ('valid_clean', 'valid_review_required')),

  constraint proposal_acceptances_ambiguity_reason_check
    check (
      (guard_result = 'valid_clean' and ambiguity_reason is null)
      or (
        guard_result = 'valid_review_required'
        and ambiguity_reason in (
          'older_sent_version',
          'dirty_revision',
          'proposal_lineage_conflict',
          'version_pointer_conflict',
          'on_hold',
          'lost',
          'closed',
          'conflicting_acceptance',
          'job_not_in_proposal',
          'job_already_approved'
        )
      )
    ),

  constraint proposal_acceptances_confirmation_state_check
    check (
      (confirmed_at is null and confirmed_by_user_id is null)
      or (confirmed_at is not null and confirmed_by_user_id is not null)
    ),

  constraint proposal_acceptances_name_length_check
    check (accepted_by_name is null or char_length(accepted_by_name) <= 120),

  constraint proposal_acceptances_email_length_check
    check (accepted_by_email is null or char_length(accepted_by_email) <= 254),

  constraint proposal_acceptances_option_label_length_check
    check (
      length(trim(accepted_option_label)) > 0
      and char_length(accepted_option_label) <= 120
    ),

  constraint proposal_acceptances_total_cents_check
    check (accepted_total_cents >= 0)
);

create index if not exists idx_proposal_acceptances_company_job_accepted
  on public.proposal_acceptances (company_id, job_id, accepted_at desc);

create index if not exists idx_proposal_acceptances_company_proposal_version
  on public.proposal_acceptances (company_id, proposal_id, proposal_version_id);

create index if not exists idx_proposal_acceptances_token
  on public.proposal_acceptances (public_access_token_id);

create index if not exists idx_proposal_acceptances_unconfirmed
  on public.proposal_acceptances (company_id, job_id, accepted_at desc)
  where confirmed_at is null;

comment on table public.proposal_acceptances is
  'R3C append-only formal customer acceptance. Binds to one frozen sent version and '
  'that version''s selected package. Not a signature, payment, or schedule. '
  'Does not mutate Proposal V2 frozen truth or proposals.selected_option_id.';

comment on column public.proposal_acceptances.proposal_version_id is
  'Exact frozen sent/signed version the customer accepted. Never rewritten to latest.';

comment on column public.proposal_acceptances.proposal_option_id is
  'Frozen selected package on the accepted version (selected_at / default). '
  'Not live proposals.selected_option_id.';

comment on column public.proposal_acceptances.public_access_token_id is
  'First public-access token that recorded this logical acceptance. Evidence only — '
  'not the uniqueness key. Same-version resend tokens reuse this row.';

comment on column public.proposal_acceptances.accepted_total_cents is
  'Snapshot of frozen proposal_options.customer_total_cents at acceptance. Not a payment field.';

comment on column public.proposal_acceptances.guard_result is
  'Frozen classifier outcome at insert: valid_clean or valid_review_required. '
  'Neither value authorizes Job stage movement.';

comment on column public.proposal_acceptances.accepted_at is
  'Customer accepted this frozen proposal. Immutable.';

comment on column public.proposal_acceptances.confirmed_at is
  'Contractor approved operational progression (Approve job). '
  'Not a second customer acceptance.';

comment on column public.proposal_acceptances.confirmed_by_user_id is
  'Authenticated contractor who clicked Approve job.';

-- ---------------------------------------------------------------------------
-- 2. Immutability — no ordinary UPDATE/DELETE of acceptance identity
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

drop trigger if exists proposal_acceptances_row_guard on public.proposal_acceptances;
create trigger proposal_acceptances_row_guard
  before insert or update or delete on public.proposal_acceptances
  for each row
  execute function public.proposal_acceptances_row_guard();

revoke all on function public.proposal_acceptances_row_guard() from public;
revoke all on function public.proposal_acceptances_row_guard() from anon;
revoke all on function public.proposal_acceptances_row_guard() from authenticated;

-- ---------------------------------------------------------------------------
-- 3. RLS / grants — membership SELECT; writes via DEFINER RPCs only
-- ---------------------------------------------------------------------------

alter table public.proposal_acceptances enable row level security;

drop policy if exists "proposal_acceptances_select_company_scope"
  on public.proposal_acceptances;
create policy "proposal_acceptances_select_company_scope"
  on public.proposal_acceptances
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_acceptances_insert_company_scope"
  on public.proposal_acceptances;
drop policy if exists "proposal_acceptances_update_company_scope"
  on public.proposal_acceptances;
drop policy if exists "proposal_acceptances_delete_company_scope"
  on public.proposal_acceptances;

revoke all on table public.proposal_acceptances from public;
revoke all on table public.proposal_acceptances from anon;
revoke all on table public.proposal_acceptances from authenticated;
grant select on table public.proposal_acceptances to authenticated;
grant all on table public.proposal_acceptances to service_role;

-- ---------------------------------------------------------------------------
-- 4. Widen Attention CHECKs for acceptance confirmation
-- ---------------------------------------------------------------------------

alter table public.job_attention_items
  drop constraint if exists job_attention_items_source_company_fkey;

alter table public.job_attention_items
  drop constraint if exists job_attention_items_attention_type_check;

alter table public.job_attention_items
  add constraint job_attention_items_attention_type_check
  check (attention_type in (
    'customer_package_request',
    'customer_question',
    'acceptance_confirmation_required'
  ));

alter table public.job_attention_items
  drop constraint if exists job_attention_items_source_type_check;

alter table public.job_attention_items
  add constraint job_attention_items_source_type_check
  check (source_type in (
    'proposal_customer_requests',
    'proposal_acceptances'
  ));

create or replace function public.job_attention_items_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.proposal_customer_requests%rowtype;
  v_acceptance public.proposal_acceptances%rowtype;
  v_job_id uuid;
  v_attention_type text;
  v_expected_destination jsonb;
begin
  if tg_op = 'DELETE' then
    raise exception 'job_attention_items rows cannot be deleted';
  end if;

  if public.proposal_forbidden_token_json_keys(new.destination_json)
    or public.proposal_forbidden_token_json_keys(new.metadata_json)
  then
    raise exception 'job_attention_items JSON must not contain raw token keys';
  end if;

  if tg_op = 'INSERT' and new.source_type = 'proposal_customer_requests' then
    select r.*
    into v_request
    from public.proposal_customer_requests r
    where r.id = new.source_id
      and r.company_id = new.company_id;

    if not found then
      raise exception 'job_attention_items source request binding is invalid';
    end if;

    select p.job_id
    into v_job_id
    from public.proposals p
    join public.jobs j
      on j.id = p.job_id
     and j.company_id = p.company_id
    join public.proposal_versions pv
      on pv.id = v_request.proposal_version_id
     and pv.company_id = p.company_id
     and pv.proposal_id = p.id
    where p.id = v_request.proposal_id
      and p.company_id = v_request.company_id;

    if not found or v_job_id is null then
      raise exception 'job_attention_items source graph is invalid';
    end if;

    v_attention_type :=
      case
        when v_request.intent = 'request_package'
          then 'customer_package_request'
        when v_request.intent in ('ask_question', 'ask_about_package')
          then 'customer_question'
        else null
      end;

    v_expected_destination := jsonb_build_object(
      'proposal_id', v_request.proposal_id,
      'proposal_version_id', v_request.proposal_version_id,
      'request_id', v_request.id,
      'tab', 'proposals',
      'anchor', 'customer_request'
    );

    if new.job_id is distinct from v_job_id
      or new.proposal_id is distinct from v_request.proposal_id
      or new.proposal_version_id is distinct from v_request.proposal_version_id
      or new.attention_type is distinct from v_attention_type
      or new.source_occurred_at is distinct from v_request.created_at
      or new.opened_at is distinct from v_request.created_at
      or new.dedupe_key is distinct from
        ('customer_request:proposal_customer_requests:' || v_request.id::text)
      or new.destination_kind <> 'job_card_proposals'
      or new.destination_json is distinct from v_expected_destination
      or new.metadata_json->>'intent' is distinct from v_request.intent
      or (new.metadata_json - 'intent' - 'backfilled') <> '{}'::jsonb
      or (
        v_request.status = 'new'
        and (
          new.status <> 'open'
          or new.acknowledged_at is not null
          or new.acknowledged_by is not null
        )
      )
      or (
        v_request.status = 'seen'
        and (
          new.status <> 'acknowledged'
          or new.acknowledged_at is null
        )
      )
      or v_request.status = 'dismissed'
    then
      raise exception 'job_attention_items projection does not match verified source truth';
    end if;
  elsif tg_op = 'INSERT' and new.source_type = 'proposal_acceptances' then
    select a.*
    into v_acceptance
    from public.proposal_acceptances a
    where a.id = new.source_id
      and a.company_id = new.company_id;

    if not found then
      raise exception 'job_attention_items source acceptance binding is invalid';
    end if;

    if v_acceptance.guard_result not in ('valid_clean', 'valid_review_required') then
      raise exception 'job_attention_items acceptance attention requires a valid acceptance';
    end if;

    v_expected_destination := jsonb_build_object(
      'proposal_id', v_acceptance.proposal_id,
      'proposal_version_id', v_acceptance.proposal_version_id,
      'acceptance_id', v_acceptance.id,
      'tab', 'proposals',
      'anchor', 'acceptance_confirmation'
    );

    if new.job_id is distinct from v_acceptance.job_id
      or new.proposal_id is distinct from v_acceptance.proposal_id
      or new.proposal_version_id is distinct from v_acceptance.proposal_version_id
      or new.attention_type <> 'acceptance_confirmation_required'
      or new.source_occurred_at is distinct from v_acceptance.accepted_at
      or new.opened_at is distinct from v_acceptance.accepted_at
      or new.dedupe_key is distinct from
        ('acceptance_confirmation:proposal_acceptances:' || v_acceptance.id::text)
      or new.destination_kind <> 'job_card_proposals'
      or new.destination_json is distinct from v_expected_destination
      or new.metadata_json->>'guard_result' is distinct from v_acceptance.guard_result
      or new.metadata_json->>'ambiguity_reason' is distinct from v_acceptance.ambiguity_reason
      or (new.metadata_json - 'guard_result' - 'ambiguity_reason') <> '{}'::jsonb
      or new.status <> 'open'
      or new.acknowledged_at is not null
      or new.acknowledged_by is not null
    then
      raise exception 'job_attention_items acceptance projection does not match verified source truth';
    end if;
  elsif tg_op = 'INSERT' then
    raise exception 'job_attention_items source_type is not supported';
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.company_id is distinct from old.company_id
    or new.job_id is distinct from old.job_id
    or new.proposal_id is distinct from old.proposal_id
    or new.proposal_version_id is distinct from old.proposal_version_id
    or new.attention_type is distinct from old.attention_type
    or new.source_type is distinct from old.source_type
    or new.source_id is distinct from old.source_id
    or new.source_occurred_at is distinct from old.source_occurred_at
    or new.opened_at is distinct from old.opened_at
    or new.dedupe_key is distinct from old.dedupe_key
    or new.destination_kind is distinct from old.destination_kind
    or new.destination_json is distinct from old.destination_json
    or new.policy_version is distinct from old.policy_version
    or new.metadata_json is distinct from old.metadata_json
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'job_attention_items source binding and projection identity are immutable';
  end if;

  if tg_op = 'UPDATE' and old.status = 'resolved' and new.status <> 'resolved' then
    raise exception 'resolved job_attention_items cannot be reopened';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Frozen selected option on an immutable sent version
-- ---------------------------------------------------------------------------

create or replace function public.proposal_acceptance_frozen_selected_option_v1(
  p_company_id uuid,
  p_proposal_version_id uuid
)
returns table (
  option_id uuid,
  option_label text,
  customer_total_cents integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    po.id,
    left(
      coalesce(nullif(trim(po.customer_label), ''), nullif(trim(po.name), ''), 'Package'),
      120
    ),
    po.customer_total_cents
  from public.proposal_options po
  where po.company_id = p_company_id
    and po.proposal_version_id = p_proposal_version_id
  order by
    case when po.selected_at is not null then 0 else 1 end,
    po.selected_at asc nulls last,
    case when po.is_default then 0 else 1 end,
    po.sort_order,
    po.id
  limit 1;
end;
$$;

revoke all on function public.proposal_acceptance_frozen_selected_option_v1(uuid, uuid)
  from public;
revoke all on function public.proposal_acceptance_frozen_selected_option_v1(uuid, uuid)
  from anon;
revoke all on function public.proposal_acceptance_frozen_selected_option_v1(uuid, uuid)
  from authenticated;
grant execute on function public.proposal_acceptance_frozen_selected_option_v1(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. Shared acceptance-stage classifier
-- ---------------------------------------------------------------------------

create or replace function public.classify_proposal_acceptance_guard_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_proposal_id uuid,
  p_proposal_version_id uuid,
  p_proposal_option_id uuid,
  p_acceptance_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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

  v_dirty := v_proposal.updated_at > v_version.frozen_at;

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

  if v_proposal.latest_sent_version_id is distinct from p_proposal_version_id then
    return jsonb_build_object(
      'ok', true,
      'result', 'valid_review_required',
      'reason', 'older_sent_version'
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

revoke all on function public.classify_proposal_acceptance_guard_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) from public;
revoke all on function public.classify_proposal_acceptance_guard_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) from anon;
revoke all on function public.classify_proposal_acceptance_guard_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) from authenticated;
grant execute on function public.classify_proposal_acceptance_guard_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) to service_role;

comment on function public.classify_proposal_acceptance_guard_v1(
  uuid, uuid, uuid, uuid, uuid, uuid
) is
  'R3C shared acceptance guard. valid_clean = latest frozen sent version, clean draft, '
  'active Proposal-stage job, matching frozen selected package, unambiguous. '
  'valid_review_required = valid historical/contextual acceptance needing contractor context, '
  'including later acceptance after Approved/Scheduled/Production/Complete '
  '(reason job_already_approved). Neither result moves Job stage. Invalid is not recorded. '
  'Lost/closed are classified before later-stage so disposition remains visible.';

-- ---------------------------------------------------------------------------
-- 7. Acceptance-owned Proposal → Approved writer
-- ---------------------------------------------------------------------------

create or replace function public.job_lifecycle_apply_proposal_approved_from_acceptance_v1(
  p_company_id uuid,
  p_job_id uuid,
  p_acceptance_id uuid,
  p_actor_user_id uuid,
  p_mode text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_from text;
  v_now timestamptz := now();
  v_activity_id uuid;
  v_mode text := coalesce(nullif(p_mode, ''), 'confirm');
begin
  if v_mode <> 'confirm' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select j.*
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.company_id = p_company_id
    and j.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_job.status in ('lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_approval');
  end if;

  v_from := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_from = 'approved' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'job_id', v_job.id,
      'from_stage', v_from,
      'to_stage', 'approved',
      'stage_entered_at', v_job.stage_entered_at,
      'status_unchanged', v_job.status,
      'activity_id', null
    );
  end if;

  if v_from <> 'proposal' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_edge',
      'from_stage', v_from,
      'to_stage', 'approved'
    );
  end if;

  if not public.job_lifecycle_has_proposal_truth(
    v_job.company_id,
    v_job.id,
    v_job.active_proposal_id
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'proposal_truth_mismatch',
      'from_stage', v_from,
      'to_stage', 'approved'
    );
  end if;

  perform set_config('job_lifecycle.allow_stage_write', '1', true);

  update public.jobs
  set
    stage = 'approved',
    stage_entered_at = v_now,
    last_activity_at = v_now
  where id = v_job.id
    and company_id = p_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    p_company_id,
    p_job_id,
    'stage_changed',
    p_actor_user_id,
    jsonb_build_object(
      'from_stage', v_from,
      'to_stage', 'approved',
      'reason', coalesce(nullif(p_reason, ''), 'contractor_approved'),
      'mode', v_mode,
      'acceptance_id', p_acceptance_id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'job_id', p_job_id,
    'from_stage', v_from,
    'to_stage', 'approved',
    'stage_entered_at', v_now,
    'status_unchanged', v_job.status,
    'activity_id', v_activity_id
  );
end;
$$;

revoke all on function public.job_lifecycle_apply_proposal_approved_from_acceptance_v1(
  uuid, uuid, uuid, uuid, text, text
) from public;
revoke all on function public.job_lifecycle_apply_proposal_approved_from_acceptance_v1(
  uuid, uuid, uuid, uuid, text, text
) from anon;
revoke all on function public.job_lifecycle_apply_proposal_approved_from_acceptance_v1(
  uuid, uuid, uuid, uuid, text, text
) from authenticated;
grant execute on function public.job_lifecycle_apply_proposal_approved_from_acceptance_v1(
  uuid, uuid, uuid, uuid, text, text
) to service_role;

comment on function public.job_lifecycle_apply_proposal_approved_from_acceptance_v1(
  uuid, uuid, uuid, uuid, text, text
) is
  'R3C internal Proposal→Approved writer. Called only from contractor Approve job '
  '(confirm_proposal_acceptance_v1). Authenticated transition_job_stage_v1 remains '
  'blocked (approved_blocked_until_r3c). Public record_proposal_acceptance_v1 cannot '
  'call this. Lost/closed never approve. Does not mutate jobs.status.';

-- ---------------------------------------------------------------------------
-- 8. Attention projection for every valid unconfirmed acceptance
-- ---------------------------------------------------------------------------

create or replace function public.project_proposal_acceptance_attention_v1(
  p_acceptance_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acceptance public.proposal_acceptances%rowtype;
  v_attention public.job_attention_items%rowtype;
  v_destination jsonb;
begin
  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = p_acceptance_id
  for update;

  if not found then
    raise exception 'acceptance % not found for attention projection', p_acceptance_id;
  end if;

  if v_acceptance.guard_result not in ('valid_clean', 'valid_review_required') then
    return jsonb_build_object('ok', true, 'attention_id', null, 'projected', false);
  end if;

  if v_acceptance.confirmed_at is not null then
    select ai.*
    into v_attention
    from public.job_attention_items ai
    where ai.company_id = v_acceptance.company_id
      and ai.source_type = 'proposal_acceptances'
      and ai.source_id = v_acceptance.id;

    return jsonb_build_object(
      'ok', true,
      'attention_id', v_attention.id,
      'projected', false
    );
  end if;

  select ai.*
  into v_attention
  from public.job_attention_items ai
  where ai.company_id = v_acceptance.company_id
    and ai.source_type = 'proposal_acceptances'
    and ai.source_id = v_acceptance.id
  for update;

  if found then
    return jsonb_build_object(
      'ok', true,
      'attention_id', v_attention.id,
      'projected', false
    );
  end if;

  v_destination := jsonb_build_object(
    'proposal_id', v_acceptance.proposal_id,
    'proposal_version_id', v_acceptance.proposal_version_id,
    'acceptance_id', v_acceptance.id,
    'tab', 'proposals',
    'anchor', 'acceptance_confirmation'
  );

  insert into public.job_attention_items (
    company_id,
    job_id,
    proposal_id,
    proposal_version_id,
    attention_type,
    source_type,
    source_id,
    source_occurred_at,
    status,
    base_severity,
    opened_at,
    dedupe_key,
    destination_kind,
    destination_json,
    policy_version,
    metadata_json
  ) values (
    v_acceptance.company_id,
    v_acceptance.job_id,
    v_acceptance.proposal_id,
    v_acceptance.proposal_version_id,
    'acceptance_confirmation_required',
    'proposal_acceptances',
    v_acceptance.id,
    v_acceptance.accepted_at,
    'open',
    case
      when v_acceptance.ambiguity_reason in (
        'older_sent_version',
        'conflicting_acceptance',
        'lost',
        'closed',
        'proposal_lineage_conflict',
        'job_already_approved'
      ) then 'high'
      else 'normal'
    end,
    v_acceptance.accepted_at,
    'acceptance_confirmation:proposal_acceptances:' || v_acceptance.id::text,
    'job_card_proposals',
    v_destination,
    'r3c.v1',
    jsonb_build_object(
      'guard_result', v_acceptance.guard_result,
      'ambiguity_reason', v_acceptance.ambiguity_reason
    )
  )
  returning * into v_attention;

  return jsonb_build_object(
    'ok', true,
    'attention_id', v_attention.id,
    'projected', true
  );
end;
$$;

revoke all on function public.project_proposal_acceptance_attention_v1(uuid) from public;
revoke all on function public.project_proposal_acceptance_attention_v1(uuid) from anon;
revoke all on function public.project_proposal_acceptance_attention_v1(uuid) from authenticated;
grant execute on function public.project_proposal_acceptance_attention_v1(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Public record_proposal_acceptance_v1 — service_role only
-- ---------------------------------------------------------------------------

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
        ambiguity_reason
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
        v_reason
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
  from public;
revoke all on function public.record_proposal_acceptance_v1(text, text, text, jsonb)
  from anon;
revoke all on function public.record_proposal_acceptance_v1(text, text, text, jsonb)
  from authenticated;
grant execute on function public.record_proposal_acceptance_v1(text, text, text, jsonb)
  to service_role;

comment on function public.record_proposal_acceptance_v1(text, text, text, jsonb) is
  'R3C public formal acceptance. Validates the existing public-access token, inserts one '
  'immutable logical acceptance per frozen version+selected option, classifies '
  'valid_clean vs valid_review_required, and projects contractor Attention. '
  'NEVER updates jobs.stage or stage_entered_at. Never stores raw tokens. '
  'Same-version resend tokens reuse the logical row. '
  'Superseded/revoked/expired tokens are invalid and create no row.';

-- ---------------------------------------------------------------------------
-- 10. Contractor confirm_proposal_acceptance_v1
-- ---------------------------------------------------------------------------

create or replace function public.confirm_proposal_acceptance_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_acceptance_id uuid;
  v_member boolean := false;
  v_acceptance public.proposal_acceptances%rowtype;
  v_job public.jobs%rowtype;
  v_canonical text;
  v_now timestamptz := now();
  v_stage jsonb;
  v_attention_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_acceptance_id := nullif(p_payload->>'acceptance_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_acceptance_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('proposal_acceptance_confirm:' || v_acceptance_id::text, 0)
  );

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = v_acceptance_id
    and a.company_id = v_company_id
    and a.job_id = v_job_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_acceptance.confirmed_at is not null then
    select ai.id
    into v_attention_id
    from public.job_attention_items ai
    where ai.company_id = v_acceptance.company_id
      and ai.source_type = 'proposal_acceptances'
      and ai.source_id = v_acceptance.id;

    select j.*
    into v_job
    from public.jobs j
    where j.id = v_job_id
      and j.company_id = v_company_id
      and j.deleted_at is null;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;

    v_canonical := public.canonical_job_stage_from_row(
      v_job.stage,
      v_job.status,
      coalesce(v_job.archived, false),
      v_job.active_proposal_id,
      v_job.latest_proposal_id
    );

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'acceptance_id', v_acceptance.id,
      'proposal_version_id', v_acceptance.proposal_version_id,
      'proposal_option_id', v_acceptance.proposal_option_id,
      'guard_result', v_acceptance.guard_result,
      'ambiguity_reason', v_acceptance.ambiguity_reason,
      'confirmed_at', v_acceptance.confirmed_at,
      'confirmed_by_user_id', v_acceptance.confirmed_by_user_id,
      'attention_id', v_attention_id,
      'job_id', v_job_id,
      'job_stage', v_canonical,
      'stage_entered_at', v_job.stage_entered_at,
      'status_unchanged', v_job.status
    );
  end if;

  if exists (
    select 1
    from public.proposal_acceptances a
    where a.company_id = v_company_id
      and a.job_id = v_job_id
      and a.id is distinct from v_acceptance.id
      and a.confirmed_at is not null
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'job_already_approved'
    );
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

  v_canonical := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  if v_canonical in ('approved', 'scheduled', 'production', 'complete') then
    return jsonb_build_object(
      'ok', false,
      'code', 'job_already_approved'
    );
  end if;

  v_stage := public.job_lifecycle_apply_proposal_approved_from_acceptance_v1(
    v_company_id,
    v_job_id,
    v_acceptance.id,
    v_uid,
    'confirm',
    'contractor_approved'
  );

  if coalesce((v_stage->>'ok')::boolean, false) is not true then
    return v_stage;
  end if;

  update public.proposal_acceptances
  set
    confirmed_at = v_now,
    confirmed_by_user_id = v_uid
  where id = v_acceptance.id
    and company_id = v_company_id
    and confirmed_at is null;

  update public.job_attention_items
  set
    status = 'resolved',
    resolved_at = v_now,
    resolved_by = v_uid,
    resolution_reason = 'contractor_approved'
  where company_id = v_company_id
    and source_type = 'proposal_acceptances'
    and source_id = v_acceptance.id
    and status in ('open', 'acknowledged')
  returning id into v_attention_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', coalesce((v_stage->>'idempotent')::boolean, false),
    'acceptance_id', v_acceptance.id,
    'proposal_version_id', v_acceptance.proposal_version_id,
    'proposal_option_id', v_acceptance.proposal_option_id,
    'guard_result', v_acceptance.guard_result,
    'ambiguity_reason', v_acceptance.ambiguity_reason,
    'confirmed_at', v_now,
    'confirmed_by_user_id', v_uid,
    'attention_id', v_attention_id,
    'job_id', v_job_id,
    'from_stage', v_stage->>'from_stage',
    'to_stage', v_stage->>'to_stage',
    'stage_entered_at', v_stage->>'stage_entered_at',
    'activity_id', v_stage->>'activity_id'
  );
end;
$$;

revoke all on function public.confirm_proposal_acceptance_v1(jsonb) from public;
revoke all on function public.confirm_proposal_acceptance_v1(jsonb) from anon;
grant execute on function public.confirm_proposal_acceptance_v1(jsonb) to authenticated;
grant execute on function public.confirm_proposal_acceptance_v1(jsonb) to service_role;

comment on function public.confirm_proposal_acceptance_v1(jsonb) is
  'R3C contractor Approve job. Requires a real unresolved proposal_acceptance. '
  'Preserves the historical accepted version. Resolves related Attention and '
  'transitions Proposal→Approved through the acceptance-owned lifecycle writer. '
  'Does not rewrite acceptance onto latest_sent_version_id. '
  'Does not silently reopen lost/closed. Explicit on_hold Approve may move stage '
  'while status stays on_hold. Refuses Approve job after Approved/Scheduled/'
  'Production/Complete so a later acceptance cannot become the confirmed basis. '
  'Already-confirmed retry is idempotent and returns the current canonical Job '
  'stage, not a hardcoded approved value.';

-- ---------------------------------------------------------------------------
-- 10b. Acknowledge later acceptance Attention without stage change
-- ---------------------------------------------------------------------------

create or replace function public.acknowledge_proposal_acceptance_attention_v1(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_acceptance_id uuid;
  v_member boolean := false;
  v_acceptance public.proposal_acceptances%rowtype;
  v_attention public.job_attention_items%rowtype;
  v_job public.jobs%rowtype;
  v_canonical text;
  v_now timestamptz := now();
  v_before_stage text;
  v_before_entered timestamptz;
  v_before_status text;
  v_before_confirmed timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_acceptance_id := nullif(p_payload->>'acceptance_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_acceptance_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('proposal_acceptance_ack:' || v_acceptance_id::text, 0)
  );

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = v_acceptance_id
    and a.company_id = v_company_id
    and a.job_id = v_job_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
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

  v_before_stage := v_job.stage;
  v_before_entered := v_job.stage_entered_at;
  v_before_status := v_job.status;
  v_before_confirmed := v_acceptance.confirmed_at;

  v_canonical := public.canonical_job_stage_from_row(
    v_job.stage,
    v_job.status,
    coalesce(v_job.archived, false),
    v_job.active_proposal_id,
    v_job.latest_proposal_id
  );

  select ai.*
  into v_attention
  from public.job_attention_items ai
  where ai.company_id = v_company_id
    and ai.source_type = 'proposal_acceptances'
    and ai.source_id = v_acceptance.id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_attention.job_id is distinct from v_job_id
    or v_attention.proposal_id is distinct from v_acceptance.proposal_id
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_binding');
  end if;

  if v_attention.status = 'resolved' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'acceptance_id', v_acceptance.id,
      'attention_id', v_attention.id,
      'resolution_reason', v_attention.resolution_reason,
      'confirmed_at', v_acceptance.confirmed_at,
      'job_stage', v_canonical,
      'stage_entered_at', v_job.stage_entered_at,
      'status_unchanged', v_job.status
    );
  end if;

  if v_job.status in ('lost', 'closed') then
    return jsonb_build_object('ok', false, 'code', 'disposition_blocks_approval');
  end if;

  if v_acceptance.confirmed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'already_confirmed');
  end if;

  if v_canonical = 'proposal' then
    return jsonb_build_object('ok', false, 'code', 'approve_job_required');
  end if;

  if v_canonical not in ('approved', 'scheduled', 'production', 'complete') then
    return jsonb_build_object('ok', false, 'code', 'acknowledge_not_available');
  end if;

  update public.job_attention_items
  set
    status = 'resolved',
    resolved_at = v_now,
    resolved_by = v_uid,
    resolution_reason = 'later_acceptance_acknowledged'
  where id = v_attention.id
    and company_id = v_company_id
    and status in ('open', 'acknowledged')
  returning * into v_attention;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if exists (
    select 1
    from public.proposal_acceptances a
    where a.id = v_acceptance.id
      and a.company_id = v_company_id
      and a.confirmed_at is distinct from v_before_confirmed
  ) or exists (
    select 1
    from public.jobs j
    where j.id = v_job_id
      and j.company_id = v_company_id
      and (
        j.stage is distinct from v_before_stage
        or j.stage_entered_at is distinct from v_before_entered
        or j.status is distinct from v_before_status
      )
  ) then
    raise exception 'acknowledge must not mutate acceptance confirmation or job stage';
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'acceptance_id', v_acceptance.id,
    'attention_id', v_attention.id,
    'resolution_reason', 'later_acceptance_acknowledged',
    'resolved_at', v_attention.resolved_at,
    'resolved_by', v_attention.resolved_by,
    'confirmed_at', v_acceptance.confirmed_at,
    'job_stage', v_canonical,
    'stage_entered_at', v_job.stage_entered_at,
    'status_unchanged', v_job.status
  );
end;
$$;

revoke all on function public.acknowledge_proposal_acceptance_attention_v1(jsonb)
  from public;
revoke all on function public.acknowledge_proposal_acceptance_attention_v1(jsonb)
  from anon;
grant execute on function public.acknowledge_proposal_acceptance_attention_v1(jsonb)
  to authenticated;
grant execute on function public.acknowledge_proposal_acceptance_attention_v1(jsonb)
  to service_role;

comment on function public.acknowledge_proposal_acceptance_attention_v1(jsonb) is
  'R3C Acknowledge later historical acceptance after Job has progressed beyond Proposal '
  '(Approved, Scheduled, Production, or Complete). Resolves Attention only. '
  'Does not set confirmed_at, does not change jobs.stage, stage_entered_at, or disposition. '
  'Not a substitute for Approve job while Proposal. Lost/closed still blocked.';

-- ---------------------------------------------------------------------------
-- 11. Personal read: acceptance source has no request status
-- ---------------------------------------------------------------------------

create or replace function public.mark_job_attention_read_v1(
  p_attention_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attention public.job_attention_items%rowtype;
  v_read_at timestamptz;
  v_last_viewed_at timestamptz := now();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  if p_attention_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_attention_id');
  end if;

  select ai.*
  into v_attention
  from public.job_attention_items ai
  where ai.id = p_attention_id
    and exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = ai.company_id
        and cm.user_id = v_uid
    );

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  insert into public.job_attention_user_state (
    company_id,
    attention_item_id,
    user_id,
    read_at,
    last_viewed_at
  ) values (
    v_attention.company_id,
    v_attention.id,
    v_uid,
    v_last_viewed_at,
    v_last_viewed_at
  )
  on conflict (company_id, attention_item_id, user_id)
  do update set
    read_at = coalesce(public.job_attention_user_state.read_at, excluded.read_at),
    last_viewed_at = excluded.last_viewed_at
  returning read_at into v_read_at;

  return jsonb_build_object(
    'ok', true,
    'attention_id', v_attention.id,
    'user_id', v_uid,
    'read_at', v_read_at,
    'last_viewed_at', v_last_viewed_at,
    'attention_status_unchanged', v_attention.status,
    'request_status_unchanged', (
      select r.status
      from public.proposal_customer_requests r
      where r.id = v_attention.source_id
        and v_attention.source_type = 'proposal_customer_requests'
    )
  );
end;
$$;

commit;
