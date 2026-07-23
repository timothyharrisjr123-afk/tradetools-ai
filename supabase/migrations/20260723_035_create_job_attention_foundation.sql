-- R3B4A — Durable contractor attention foundation.
-- REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT LIVE-APPLY APPROVAL.
--
-- Source truth remains proposal_customer_requests.
-- Attention is an operational projection only. It must not mutate proposal,
-- package, upgrade, job-stage, lifecycle-event, payment, or scheduling truth.

begin;

-- ---------------------------------------------------------------------------
-- 1. Durable public-request submission idempotency
-- ---------------------------------------------------------------------------

alter table public.proposal_customer_requests
  add column if not exists submission_key uuid null;

create unique index if not exists idx_proposal_customer_requests_token_submission_key
  on public.proposal_customer_requests (public_access_token_id, submission_key)
  where submission_key is not null;

comment on column public.proposal_customer_requests.submission_key is
  'R3B4A client-generated idempotency key. Scoped to the bound public token. '
  'Null only for requests created before R3B4A. Never derived from request content.';

-- Keep request binding/body/submission identity immutable while preserving the
-- existing new -> seen/dismissed review transitions.
create or replace function public.proposal_customer_requests_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_token record;
begin
  if tg_op = 'DELETE' then
    raise exception 'proposal_customer_requests rows cannot be deleted';
  end if;

  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.public_access_token_id is distinct from old.public_access_token_id
      or new.submission_key is distinct from old.submission_key
      or new.intent is distinct from old.intent
      or new.requested_option_id is distinct from old.requested_option_id
      or new.requested_option_label is distinct from old.requested_option_label
      or new.message is distinct from old.message
      or new.customer_name is distinct from old.customer_name
      or new.customer_email is distinct from old.customer_email
      or new.customer_phone is distinct from old.customer_phone
      or new.payload_json is distinct from old.payload_json
      or new.created_at is distinct from old.created_at
      or new.id is distinct from old.id
    then
      raise exception 'proposal_customer_requests binding, submission identity, and body fields are immutable';
    end if;

    if new.status not in ('new', 'seen', 'dismissed') then
      raise exception 'proposal_customer_requests.status must be new, seen, or dismissed';
    end if;

    return new;
  end if;

  if public.proposal_forbidden_token_json_keys(new.payload_json) then
    raise exception 'proposal_customer_requests.payload_json must not contain raw token keys';
  end if;

  select
    ppt.company_id,
    ppt.proposal_id,
    ppt.proposal_version_id
  into v_token
  from public.proposal_public_access_tokens ppt
  where ppt.id = new.public_access_token_id;

  if not found then
    raise exception 'public_access_token_id % not found', new.public_access_token_id;
  end if;

  if v_token.company_id is distinct from new.company_id then
    raise exception 'public_access_token_id company_id mismatch';
  end if;

  if v_token.proposal_id is distinct from new.proposal_id then
    raise exception 'public_access_token_id proposal_id mismatch';
  end if;

  if v_token.proposal_version_id is distinct from new.proposal_version_id then
    raise exception 'public_access_token_id proposal_version_id mismatch';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Company-level operational attention
-- ---------------------------------------------------------------------------

-- jobs predates the later company-scoped composite-FK convention. Add the
-- matching unique key so attention cannot bind a job id to another company.
create unique index if not exists idx_jobs_id_company_unique
  on public.jobs (id, company_id);

create table if not exists public.job_attention_items (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete restrict,
  job_id uuid not null,
  proposal_id uuid null,
  proposal_version_id uuid null,

  attention_type text not null,
  source_type text not null,
  source_id uuid not null,
  source_occurred_at timestamptz not null,

  status text not null default 'open',
  base_severity text not null default 'high',

  opened_at timestamptz not null,
  due_at timestamptz null,
  next_escalation_at timestamptz null,

  acknowledged_at timestamptz null,
  acknowledged_by uuid null,
  assigned_to_user_id uuid null,

  resolved_at timestamptz null,
  resolved_by uuid null,
  resolution_reason text null,

  dedupe_key text not null,
  destination_kind text not null,
  destination_json jsonb not null default '{}'::jsonb,
  policy_version text not null default 'r3b4a-v1',
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint job_attention_items_id_company_unique
    unique (id, company_id),

  constraint job_attention_items_job_company_fkey
    foreign key (job_id, company_id)
    references public.jobs (id, company_id)
    on delete restrict,

  constraint job_attention_items_proposal_company_fkey
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete restrict,

  constraint job_attention_items_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete restrict,

  constraint job_attention_items_source_company_fkey
    foreign key (source_id, company_id)
    references public.proposal_customer_requests (id, company_id)
    on delete restrict,

  constraint job_attention_items_attention_type_check
    check (attention_type in ('customer_package_request', 'customer_question')),

  constraint job_attention_items_source_type_check
    check (source_type = 'proposal_customer_requests'),

  constraint job_attention_items_status_check
    check (status in ('open', 'acknowledged', 'resolved')),

  constraint job_attention_items_base_severity_check
    check (base_severity in ('normal', 'high', 'critical')),

  constraint job_attention_items_destination_kind_check
    check (destination_kind = 'job_card_proposals'),

  constraint job_attention_items_dedupe_key_not_empty
    check (length(trim(dedupe_key)) > 0 and char_length(dedupe_key) <= 240),

  constraint job_attention_items_policy_version_not_empty
    check (length(trim(policy_version)) > 0 and char_length(policy_version) <= 80),

  constraint job_attention_items_destination_object_check
    check (jsonb_typeof(destination_json) = 'object'),

  constraint job_attention_items_metadata_object_check
    check (jsonb_typeof(metadata_json) = 'object'),

  constraint job_attention_items_acknowledgement_state_check
    check (
      (status = 'open' and acknowledged_at is null and acknowledged_by is null)
      or (status = 'acknowledged' and acknowledged_at is not null)
      or status = 'resolved'
    ),

  constraint job_attention_items_resolution_state_check
    check (
      (status <> 'resolved'
        and resolved_at is null
        and resolved_by is null
        and resolution_reason is null)
      or (status = 'resolved'
        and resolved_at is not null
        and resolution_reason is not null)
    ),

  constraint job_attention_items_source_unique
    unique (company_id, source_type, source_id),

  constraint job_attention_items_dedupe_unique
    unique (company_id, dedupe_key)
);

create index if not exists idx_job_attention_items_company_job_active
  on public.job_attention_items
    (company_id, job_id, base_severity, opened_at desc)
  where status in ('open', 'acknowledged');

create index if not exists idx_job_attention_items_company_active
  on public.job_attention_items
    (company_id, status, base_severity, opened_at desc);

create index if not exists idx_job_attention_items_company_proposal
  on public.job_attention_items
    (company_id, proposal_id, opened_at desc)
  where proposal_id is not null;

create index if not exists idx_job_attention_items_company_version
  on public.job_attention_items
    (company_id, proposal_version_id)
  where proposal_version_id is not null;

drop trigger if exists job_attention_items_set_updated_at
  on public.job_attention_items;
create trigger job_attention_items_set_updated_at
  before update on public.job_attention_items
  for each row
  execute function public.set_updated_at();

create or replace function public.job_attention_items_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.proposal_customer_requests%rowtype;
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

  if tg_op = 'INSERT' then
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

    if new.source_type <> 'proposal_customer_requests'
      or new.job_id is distinct from v_job_id
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

drop trigger if exists job_attention_items_row_guard
  on public.job_attention_items;
create trigger job_attention_items_row_guard
  before insert or update or delete on public.job_attention_items
  for each row
  execute function public.job_attention_items_row_guard();

comment on table public.job_attention_items is
  'R3B4A company-level operational attention projection. Source truth remains in '
  'domain tables. Attention status never changes proposal or job lifecycle truth.';

comment on column public.job_attention_items.destination_kind is
  'Structured navigation target. R3B4A uses job_card_proposals because the existing '
  'Job Card Proposals tab is the canonical actionable request-review context.';

-- ---------------------------------------------------------------------------
-- 3. Per-user consumption state
-- ---------------------------------------------------------------------------

create table if not exists public.job_attention_user_state (
  company_id uuid not null references public.companies(id) on delete cascade,
  attention_item_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,

  read_at timestamptz null,
  last_viewed_at timestamptz null,
  last_notified_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint job_attention_user_state_attention_company_fkey
    foreign key (attention_item_id, company_id)
    references public.job_attention_items (id, company_id)
    on delete cascade,

  constraint job_attention_user_state_pkey
    primary key (company_id, attention_item_id, user_id),

  constraint job_attention_user_state_read_view_check
    check (read_at is null or last_viewed_at is not null)
);

create index if not exists idx_job_attention_user_state_user_unread
  on public.job_attention_user_state (company_id, user_id, attention_item_id)
  where read_at is null;

create index if not exists idx_job_attention_user_state_attention
  on public.job_attention_user_state (attention_item_id, user_id);

drop trigger if exists job_attention_user_state_set_updated_at
  on public.job_attention_user_state;
create trigger job_attention_user_state_set_updated_at
  before update on public.job_attention_user_state
  for each row
  execute function public.set_updated_at();

comment on table public.job_attention_user_state is
  'R3B4A per-user consumption state only. Reading an item does not acknowledge or '
  'resolve company-level attention and does not change proposal_customer_requests.status.';

-- ---------------------------------------------------------------------------
-- 4. RLS and direct table permissions
-- ---------------------------------------------------------------------------

alter table public.job_attention_items enable row level security;
alter table public.job_attention_user_state enable row level security;

drop policy if exists "job_attention_items_select_company_scope"
  on public.job_attention_items;
create policy "job_attention_items_select_company_scope"
  on public.job_attention_items
  for select
  using (
    company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
    )
  );

drop policy if exists "job_attention_user_state_select_own"
  on public.job_attention_user_state;
create policy "job_attention_user_state_select_own"
  on public.job_attention_user_state
  for select
  using (
    user_id = auth.uid()
    and company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
    )
  );

revoke all on table public.job_attention_items from public;
revoke all on table public.job_attention_items from anon;
revoke all on table public.job_attention_items from authenticated;
grant select on table public.job_attention_items to authenticated;

revoke all on table public.job_attention_user_state from public;
revoke all on table public.job_attention_user_state from anon;
revoke all on table public.job_attention_user_state from authenticated;
grant select on table public.job_attention_user_state to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Guarded deterministic customer-request projection
-- ---------------------------------------------------------------------------

create or replace function public.project_proposal_customer_request_attention_v1(
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.proposal_customer_requests%rowtype;
  v_job_id uuid;
  v_attention_type text;
  v_attention_status text;
  v_attention_id uuid;
  v_existing_status text;
  v_dedupe_key text;
begin
  if p_request_id is null then
    raise exception 'request id is required for attention projection';
  end if;

  select r.*
  into v_request
  from public.proposal_customer_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'proposal_customer_requests source % not found', p_request_id;
  end if;

  if v_request.status not in ('new', 'seen') then
    raise exception 'only active proposal_customer_requests can create attention';
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
    raise exception 'customer request source has invalid company/job/proposal/version binding';
  end if;

  if v_request.intent = 'request_package' then
    v_attention_type := 'customer_package_request';
  elsif v_request.intent in ('ask_question', 'ask_about_package') then
    v_attention_type := 'customer_question';
  else
    raise exception 'customer request intent cannot create R3B4A attention';
  end if;

  v_attention_status :=
    case when v_request.status = 'seen' then 'acknowledged' else 'open' end;
  v_dedupe_key :=
    'customer_request:proposal_customer_requests:' || v_request.id::text;

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
    acknowledged_at,
    dedupe_key,
    destination_kind,
    destination_json,
    policy_version,
    metadata_json
  ) values (
    v_request.company_id,
    v_job_id,
    v_request.proposal_id,
    v_request.proposal_version_id,
    v_attention_type,
    'proposal_customer_requests',
    v_request.id,
    v_request.created_at,
    v_attention_status,
    'high',
    v_request.created_at,
    case when v_attention_status = 'acknowledged' then now() else null end,
    v_dedupe_key,
    'job_card_proposals',
    jsonb_build_object(
      'proposal_id', v_request.proposal_id,
      'proposal_version_id', v_request.proposal_version_id,
      'request_id', v_request.id,
      'tab', 'proposals',
      'anchor', 'customer_request'
    ),
    'r3b4a-v1',
    jsonb_build_object('intent', v_request.intent)
  )
  on conflict (company_id, dedupe_key) do nothing
  returning id, status into v_attention_id, v_existing_status;

  if v_attention_id is null then
    select ai.id, ai.status
    into v_attention_id, v_existing_status
    from public.job_attention_items ai
    where ai.company_id = v_request.company_id
      and ai.dedupe_key = v_dedupe_key
      and ai.source_type = 'proposal_customer_requests'
      and ai.source_id = v_request.id
      and ai.job_id = v_job_id
      and ai.proposal_id = v_request.proposal_id
      and ai.proposal_version_id = v_request.proposal_version_id
      and ai.attention_type = v_attention_type;

    if not found then
      raise exception 'existing attention dedupe row does not match verified source binding';
    end if;

    if v_existing_status = 'resolved' then
      raise exception 'resolved attention cannot be reopened';
    end if;

    if v_attention_status = 'acknowledged' and v_existing_status = 'open' then
      update public.job_attention_items
      set
        status = 'acknowledged',
        acknowledged_at = now(),
        acknowledged_by = null
      where id = v_attention_id
        and company_id = v_request.company_id
        and status = 'open'
      returning status into v_existing_status;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'attention_id', v_attention_id,
    'attention_status', v_existing_status,
    'attention_type', v_attention_type,
    'request_id', v_request.id,
    'company_id', v_request.company_id,
    'job_id', v_job_id,
    'proposal_id', v_request.proposal_id,
    'proposal_version_id', v_request.proposal_version_id
  );
end;
$$;

revoke all on function public.project_proposal_customer_request_attention_v1(uuid)
  from public;
revoke all on function public.project_proposal_customer_request_attention_v1(uuid)
  from anon;
revoke all on function public.project_proposal_customer_request_attention_v1(uuid)
  from authenticated;
grant execute on function public.project_proposal_customer_request_attention_v1(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 6. Atomic, idempotent request + attention producer
-- ---------------------------------------------------------------------------

drop function if exists public.record_proposal_customer_request_v1(
  text, text, uuid, text, text, text, text, jsonb
);

create or replace function public.record_proposal_customer_request_v1(
  p_token_hash text,
  p_intent text,
  p_requested_option_id uuid default null,
  p_message text default null,
  p_customer_name text default null,
  p_customer_email text default null,
  p_customer_phone text default null,
  p_payload_json jsonb default '{}'::jsonb,
  p_submission_key uuid default null
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
  v_intent text;
  v_message text;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_payload jsonb;
  v_option_id uuid;
  v_option_label text;
  v_request public.proposal_customer_requests%rowtype;
  v_attention jsonb;
  v_attention_id uuid;
  v_attention_status text;
  v_before_status text;
  v_before_selected_option_id uuid;
  v_before_job_stage text;
  v_after_status text;
  v_after_selected_option_id uuid;
  v_after_job_stage text;
  v_locked_token record;
  v_idempotent_replay boolean := false;
begin
  if p_submission_key is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_submission_key');
  end if;

  v_assert := public.proposal_assert_public_access_token_active_v1(p_token_hash);

  if coalesce((v_assert->>'ok')::boolean, false) is not true then
    return v_assert;
  end if;

  v_token_id := (v_assert->>'token_id')::uuid;
  v_company_id := (v_assert->>'company_id')::uuid;
  v_proposal_id := (v_assert->>'proposal_id')::uuid;
  v_proposal_version_id := (v_assert->>'proposal_version_id')::uuid;

  -- Lock token lifecycle and immutable version binding through source insert.
  select
    t.id,
    t.company_id,
    t.proposal_id,
    t.proposal_version_id,
    t.status,
    t.expires_at,
    pv.version_kind
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
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_binding');
  end if;

  select p.status, p.selected_option_id, p.job_id, j.stage
  into
    v_before_status,
    v_before_selected_option_id,
    v_job_id,
    v_before_job_stage
  from public.proposals p
  join public.jobs j
    on j.id = p.job_id
   and j.company_id = p.company_id
  where p.id = v_proposal_id
    and p.company_id = v_company_id
  for share of p, j;

  if not found or v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'proposal_unavailable');
  end if;

  v_intent := nullif(trim(coalesce(p_intent, '')), '');
  if v_intent is null
    or v_intent not in ('request_package', 'ask_question', 'ask_about_package') then
    return jsonb_build_object('ok', false, 'code', 'invalid_intent');
  end if;

  v_message := nullif(trim(coalesce(p_message, '')), '');
  if v_message is not null and char_length(v_message) > 2000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_message');
  end if;

  v_customer_name := nullif(trim(coalesce(p_customer_name, '')), '');
  if v_customer_name is not null and char_length(v_customer_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_name');
  end if;

  v_customer_email := nullif(trim(coalesce(p_customer_email, '')), '');
  if v_customer_email is not null and char_length(v_customer_email) > 254 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_email');
  end if;

  v_customer_phone := nullif(trim(coalesce(p_customer_phone, '')), '');
  if v_customer_phone is not null and char_length(v_customer_phone) > 40 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer_phone');
  end if;

  v_payload := coalesce(p_payload_json, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if public.proposal_forbidden_token_json_keys(v_payload) then
    return jsonb_build_object('ok', false, 'code', 'forbidden_payload_keys');
  end if;

  v_payload := v_payload
    - 'company_id'
    - 'job_id'
    - 'proposal_id'
    - 'proposal_version_id'
    - 'token_id'
    - 'public_access_token_id'
    - 'raw_token'
    - 'token'
    - 'token_hash'
    - 'attention_type'
    - 'attention_id';

  if v_intent in ('request_package', 'ask_about_package') then
    if p_requested_option_id is null then
      return jsonb_build_object('ok', false, 'code', 'option_required');
    end if;

    select
      po.id,
      left(
        coalesce(nullif(trim(po.customer_label), ''), nullif(trim(po.name), ''), 'Package'),
        120
      )
    into v_option_id, v_option_label
    from public.proposal_options po
    where po.company_id = v_company_id
      and po.proposal_version_id = v_proposal_version_id
      and po.visible_to_customer = true
      and (
        po.id = p_requested_option_id
        or po.source_template_option_id = p_requested_option_id
      )
    order by
      case when po.id = p_requested_option_id then 0 else 1 end,
      po.sort_order
    limit 1;

    if v_option_id is null then
      return jsonb_build_object('ok', false, 'code', 'option_not_on_version');
    end if;
  else
    v_option_id := null;
    v_option_label := null;
  end if;

  -- Serialize retries for this token + deliberate submission occurrence.
  perform pg_advisory_xact_lock(
    hashtextextended(v_token_id::text || ':' || p_submission_key::text, 0)
  );

  select r.*
  into v_request
  from public.proposal_customer_requests r
  where r.public_access_token_id = v_token_id
    and r.submission_key = p_submission_key
  for update;

  if found then
    v_idempotent_replay := true;
    if v_request.company_id is distinct from v_company_id
      or v_request.proposal_id is distinct from v_proposal_id
      or v_request.proposal_version_id is distinct from v_proposal_version_id
      or v_request.intent is distinct from v_intent
      or v_request.requested_option_id is distinct from v_option_id
      or v_request.message is distinct from v_message
      or v_request.customer_name is distinct from v_customer_name
      or v_request.customer_email is distinct from v_customer_email
      or v_request.customer_phone is distinct from v_customer_phone
      or v_request.payload_json is distinct from v_payload
    then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;

    if v_request.status in ('new', 'seen') then
      v_attention :=
        public.project_proposal_customer_request_attention_v1(v_request.id);
      v_attention_id := (v_attention->>'attention_id')::uuid;
    else
      select ai.id, ai.status
      into v_attention_id, v_attention_status
      from public.job_attention_items ai
      where ai.company_id = v_request.company_id
        and ai.source_type = 'proposal_customer_requests'
        and ai.source_id = v_request.id
        and ai.job_id = v_job_id
        and ai.proposal_id = v_request.proposal_id
        and ai.proposal_version_id = v_request.proposal_version_id
        and ai.attention_type = case
          when v_request.intent = 'request_package'
            then 'customer_package_request'
          else 'customer_question'
        end
        and ai.source_occurred_at = v_request.created_at
        and ai.dedupe_key =
          ('customer_request:proposal_customer_requests:' || v_request.id::text)
        and ai.destination_kind = 'job_card_proposals'
        and ai.destination_json = jsonb_build_object(
          'proposal_id', v_request.proposal_id,
          'proposal_version_id', v_request.proposal_version_id,
          'request_id', v_request.id,
          'tab', 'proposals',
          'anchor', 'customer_request'
        );

      if not found then
        raise exception 'idempotent request exists without its required attention item';
      end if;

      if v_attention_status <> 'resolved' then
        raise exception 'dismissed idempotent request must retain resolved attention';
      end if;
    end if;
  else
    insert into public.proposal_customer_requests (
      company_id,
      proposal_id,
      proposal_version_id,
      public_access_token_id,
      submission_key,
      intent,
      requested_option_id,
      requested_option_label,
      message,
      customer_name,
      customer_email,
      customer_phone,
      status,
      payload_json
    ) values (
      v_company_id,
      v_proposal_id,
      v_proposal_version_id,
      v_token_id,
      p_submission_key,
      v_intent,
      v_option_id,
      v_option_label,
      v_message,
      v_customer_name,
      v_customer_email,
      v_customer_phone,
      'new',
      v_payload
    )
    returning * into v_request;

    -- Same transaction: any projection exception rolls back the source insert.
    v_attention :=
      public.project_proposal_customer_request_attention_v1(v_request.id);
    v_attention_id := (v_attention->>'attention_id')::uuid;
  end if;

  select p.status, p.selected_option_id, j.stage
  into v_after_status, v_after_selected_option_id, v_after_job_stage
  from public.proposals p
  join public.jobs j
    on j.id = p.job_id
   and j.company_id = p.company_id
  where p.id = v_proposal_id
    and p.company_id = v_company_id;

  if v_after_status is distinct from v_before_status
    or v_after_selected_option_id is distinct from v_before_selected_option_id
    or v_after_job_stage is distinct from v_before_job_stage
  then
    raise exception 'customer request attention producer must not mutate proposal/job/package/lifecycle truth';
  end if;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.id,
    'attention_id', v_attention_id,
    'intent', v_request.intent,
    'status', v_request.status,
    'token_id', v_token_id,
    'proposal_id', v_proposal_id,
    'proposal_version_id', v_proposal_version_id,
    'requested_option_id', v_request.requested_option_id,
    'requested_option_label', v_request.requested_option_label,
    'idempotent_replay', v_idempotent_replay,
    'proposal_status_unchanged', v_after_status,
    'selected_option_id_unchanged', v_after_selected_option_id,
    'job_stage_unchanged', v_after_job_stage
  );
end;
$$;

revoke all on function public.record_proposal_customer_request_v1(
  text, text, uuid, text, text, text, text, jsonb, uuid
) from public;
revoke all on function public.record_proposal_customer_request_v1(
  text, text, uuid, text, text, text, text, jsonb, uuid
) from anon;
revoke all on function public.record_proposal_customer_request_v1(
  text, text, uuid, text, text, text, text, jsonb, uuid
) from authenticated;
grant execute on function public.record_proposal_customer_request_v1(
  text, text, uuid, text, text, text, text, jsonb, uuid
) to service_role;

comment on function public.record_proposal_customer_request_v1(
  text, text, uuid, text, text, text, text, jsonb, uuid
) is
  'R3B4A atomically creates or reuses one idempotent customer request and exactly '
  'one linked attention item. Never stores raw tokens or mutates lifecycle truth.';

-- ---------------------------------------------------------------------------
-- 7. Transactional request review -> attention state mapping
-- ---------------------------------------------------------------------------

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
  v_attention jsonb;
  v_attention_id uuid;
  v_attention_status text;
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

  if lower(coalesce(p_status, '')) in (
    'accepted', 'approved', 'signed', 'paid', 'won', 'scheduled'
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  select *
  into v_request
  from public.proposal_customer_requests r
  where r.id = p_request_id
    and exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = r.company_id
        and cm.user_id = v_uid
    )
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_request.status = v_next_status then
    null;
  elsif v_request.status = 'new' and v_next_status in ('seen', 'dismissed') then
    null;
  elsif v_request.status = 'seen' and v_next_status = 'dismissed' then
    null;
  else
    return jsonb_build_object('ok', false, 'code', 'invalid_transition');
  end if;

  select p.status, p.selected_option_id, p.job_id, j.stage
  into
    v_before_proposal_status,
    v_before_selected_option_id,
    v_job_id,
    v_before_job_stage
  from public.proposals p
  join public.jobs j
    on j.id = p.job_id
   and j.company_id = p.company_id
  where p.id = v_request.proposal_id
    and p.company_id = v_request.company_id
  for share of p, j;

  if not found or v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'proposal_unavailable');
  end if;

  -- R3B4A rows must retain resolved attention. Pre-R3B4A dismissed history
  -- (submission_key null) intentionally remains source history only.
  if v_request.status = 'dismissed' and v_next_status = 'dismissed' then
    select ai.id, ai.status
    into v_attention_id, v_attention_status
    from public.job_attention_items ai
    where ai.company_id = v_request.company_id
      and ai.source_type = 'proposal_customer_requests'
      and ai.source_id = v_request.id;

    if found then
      if v_attention_status <> 'resolved' then
        raise exception 'dismissed request must retain resolved attention';
      end if;
    elsif v_request.submission_key is not null then
      raise exception 'R3B4A request exists without its required attention item';
    end if;
  else
    v_attention :=
      public.project_proposal_customer_request_attention_v1(v_request.id);
    v_attention_id := (v_attention->>'attention_id')::uuid;

    if v_request.status is distinct from v_next_status then
      update public.proposal_customer_requests
      set status = v_next_status
      where id = v_request.id
        and company_id = v_request.company_id;
    end if;

    if v_next_status = 'seen' then
      update public.job_attention_items
      set
        status = 'acknowledged',
        acknowledged_at = coalesce(acknowledged_at, now()),
        acknowledged_by = coalesce(acknowledged_by, v_uid)
      where id = v_attention_id
        and company_id = v_request.company_id
        and status in ('open', 'acknowledged');
    else
      update public.job_attention_items
      set
        status = 'resolved',
        resolved_at = coalesce(resolved_at, now()),
        resolved_by = coalesce(resolved_by, v_uid),
        resolution_reason = coalesce(resolution_reason, 'request_dismissed')
      where id = v_attention_id
        and company_id = v_request.company_id
        and status in ('open', 'acknowledged', 'resolved');
    end if;

    select ai.status
    into v_attention_status
    from public.job_attention_items ai
    where ai.id = v_attention_id
      and ai.company_id = v_request.company_id;

    if v_next_status = 'seen' and v_attention_status <> 'acknowledged' then
      raise exception 'seen request must map to acknowledged attention';
    end if;

    if v_next_status = 'dismissed' and v_attention_status <> 'resolved' then
      raise exception 'dismissed request must map to resolved attention';
    end if;
  end if;

  select p.status, p.selected_option_id, j.stage
  into
    v_after_proposal_status,
    v_after_selected_option_id,
    v_after_job_stage
  from public.proposals p
  join public.jobs j
    on j.id = p.job_id
   and j.company_id = p.company_id
  where p.id = v_request.proposal_id
    and p.company_id = v_request.company_id;

  if v_after_proposal_status is distinct from v_before_proposal_status
    or v_after_selected_option_id is distinct from v_before_selected_option_id
    or v_after_job_stage is distinct from v_before_job_stage
  then
    raise exception 'request attention update must not mutate proposal/job/package/lifecycle truth';
  end if;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.id,
    'attention_id', v_attention_id,
    'attention_status', v_attention_status,
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

revoke all on function public.update_proposal_customer_request_status_v1(uuid, text)
  from public;
revoke all on function public.update_proposal_customer_request_status_v1(uuid, text)
  from anon;
grant execute on function public.update_proposal_customer_request_status_v1(uuid, text)
  to authenticated;
grant execute on function public.update_proposal_customer_request_status_v1(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 8. Personal read state only
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

revoke all on function public.mark_job_attention_read_v1(uuid) from public;
revoke all on function public.mark_job_attention_read_v1(uuid) from anon;
grant execute on function public.mark_job_attention_read_v1(uuid) to authenticated;
grant execute on function public.mark_job_attention_read_v1(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Idempotent active-request backfill
-- ---------------------------------------------------------------------------

do $backfill$
declare
  v_request_id uuid;
begin
  for v_request_id in
    select r.id
    from public.proposal_customer_requests r
    where r.status in ('new', 'seen')
      and r.intent in ('request_package', 'ask_question', 'ask_about_package')
    order by r.created_at, r.id
  loop
    perform public.project_proposal_customer_request_attention_v1(v_request_id);
  end loop;

  -- Do not accept a dedupe conflict as success unless the persisted projection
  -- exactly matches every active source occurrence.
  if exists (
    select 1
    from public.proposal_customer_requests r
    join public.proposals p
      on p.id = r.proposal_id
     and p.company_id = r.company_id
    join public.jobs j
      on j.id = p.job_id
     and j.company_id = p.company_id
    join public.proposal_versions pv
      on pv.id = r.proposal_version_id
     and pv.company_id = r.company_id
     and pv.proposal_id = r.proposal_id
    left join public.job_attention_items ai
      on ai.company_id = r.company_id
     and ai.source_type = 'proposal_customer_requests'
     and ai.source_id = r.id
    where r.status in ('new', 'seen')
      and r.intent in ('request_package', 'ask_question', 'ask_about_package')
      and (
        ai.id is null
        or ai.job_id is distinct from p.job_id
        or ai.proposal_id is distinct from r.proposal_id
        or ai.proposal_version_id is distinct from r.proposal_version_id
        or ai.source_occurred_at is distinct from r.created_at
        or ai.dedupe_key is distinct from
          ('customer_request:proposal_customer_requests:' || r.id::text)
        or ai.status is distinct from
          (case when r.status = 'seen' then 'acknowledged' else 'open' end)
      )
  ) then
    raise exception 'R3B4A active-request backfill postcondition failed';
  end if;
end;
$backfill$;

commit;
