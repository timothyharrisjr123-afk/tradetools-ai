-- R3B1 — Customer package request truth (REVIEW ONLY — DO NOT APPLY WITHOUT EXPLICIT APPROVAL).
--
-- Append-only non-binding customer package requests from public /p/[token].
-- Does NOT mutate proposals.status, selected_option_id, frozen options, upgrades, or proposal_events.
--
-- Requires 20260626_014 (+ 015/016/017) applied first (tokens + assert RPC).

-- ---------------------------------------------------------------------------
-- 1. public.proposal_customer_requests
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_customer_requests (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_id uuid not null,
  proposal_version_id uuid not null,
  public_access_token_id uuid not null,

  intent text not null,
  requested_option_id uuid null,
  requested_option_label text null,

  message text null,
  customer_name text null,
  customer_email text null,
  customer_phone text null,

  status text not null default 'new',
  payload_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint proposal_customer_requests_id_company_unique
    unique (id, company_id),

  constraint proposal_customer_requests_proposal_company_fkey
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete cascade,

  constraint proposal_customer_requests_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete restrict,

  constraint proposal_customer_requests_token_company_fkey
    foreign key (public_access_token_id, company_id)
    references public.proposal_public_access_tokens (id, company_id)
    on delete cascade,

  constraint proposal_customer_requests_intent_check
    check (intent in ('request_package', 'ask_question', 'ask_about_package')),

  constraint proposal_customer_requests_status_check
    check (status in ('new', 'seen', 'dismissed')),

  constraint proposal_customer_requests_message_length_check
    check (message is null or char_length(message) <= 2000),

  constraint proposal_customer_requests_customer_name_length_check
    check (customer_name is null or char_length(customer_name) <= 120),

  constraint proposal_customer_requests_customer_email_length_check
    check (customer_email is null or char_length(customer_email) <= 254),

  constraint proposal_customer_requests_customer_phone_length_check
    check (customer_phone is null or char_length(customer_phone) <= 40),

  constraint proposal_customer_requests_option_label_length_check
    check (requested_option_label is null or char_length(requested_option_label) <= 120),

  constraint proposal_customer_requests_payload_object_check
    check (jsonb_typeof(payload_json) = 'object'),

  constraint proposal_customer_requests_request_package_option_check
    check (
      intent <> 'request_package'
      or (requested_option_id is not null and requested_option_label is not null)
    )
);

create index if not exists idx_proposal_customer_requests_company_proposal_created
  on public.proposal_customer_requests (company_id, proposal_id, created_at desc);

create index if not exists idx_proposal_customer_requests_company_version_created
  on public.proposal_customer_requests (company_id, proposal_version_id, created_at desc);

create index if not exists idx_proposal_customer_requests_token_created
  on public.proposal_customer_requests (public_access_token_id, created_at desc);

create index if not exists idx_proposal_customer_requests_company_status_created
  on public.proposal_customer_requests (company_id, status, created_at desc);

comment on table public.proposal_customer_requests is
  'R3B1 — Append-only non-binding customer package requests from public proposal links. '
  'Does not mutate proposals.status, selected_option_id, frozen options, upgrades, or proposal_events. '
  'Not a formal customer commitment or payment action.';

comment on column public.proposal_customer_requests.status is
  'Contractor review workflow only (new/seen/dismissed). Never a formal commitment status.';

comment on column public.proposal_customer_requests.requested_option_id is
  'Frozen proposal_options.id on the bound proposal_version_id at submit time.';

-- ---------------------------------------------------------------------------
-- 2. Append-only + token binding row guard
-- ---------------------------------------------------------------------------

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
    -- R3B3 may mark seen/dismissed; binding and request body stay immutable.
    if new.company_id is distinct from old.company_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.public_access_token_id is distinct from old.public_access_token_id
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
      raise exception 'proposal_customer_requests binding and body fields are immutable';
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

drop trigger if exists proposal_customer_requests_row_guard
  on public.proposal_customer_requests;
create trigger proposal_customer_requests_row_guard
  before insert or update or delete on public.proposal_customer_requests
  for each row
  execute function public.proposal_customer_requests_row_guard();

-- ---------------------------------------------------------------------------
-- 3. record_proposal_customer_request_v1 — service_role only
-- ---------------------------------------------------------------------------

create or replace function public.record_proposal_customer_request_v1(
  p_token_hash text,
  p_intent text,
  p_requested_option_id uuid default null,
  p_message text default null,
  p_customer_name text default null,
  p_customer_email text default null,
  p_customer_phone text default null,
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
  v_intent text;
  v_message text;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_payload jsonb;
  v_option_id uuid;
  v_option_label text;
  v_request_id uuid;
  v_before_status text;
  v_before_selected_option_id uuid;
begin
  v_assert := public.proposal_assert_public_access_token_active_v1(p_token_hash);

  if coalesce((v_assert->>'ok')::boolean, false) is not true then
    return v_assert;
  end if;

  v_token_id := (v_assert->>'token_id')::uuid;
  v_company_id := (v_assert->>'company_id')::uuid;
  v_proposal_id := (v_assert->>'proposal_id')::uuid;
  v_proposal_version_id := (v_assert->>'proposal_version_id')::uuid;

  -- Capture proposal truth before insert so callers can prove non-mutation.
  select p.status, p.selected_option_id
  into v_before_status, v_before_selected_option_id
  from public.proposals p
  where p.id = v_proposal_id
    and p.company_id = v_company_id;

  if not found then
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

  -- Strip any client attempt to override binding ids via payload.
  v_payload := v_payload
    - 'company_id'
    - 'proposal_id'
    - 'proposal_version_id'
    - 'token_id'
    - 'public_access_token_id'
    - 'raw_token'
    - 'token'
    - 'token_hash';

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

  insert into public.proposal_customer_requests (
    company_id,
    proposal_id,
    proposal_version_id,
    public_access_token_id,
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
  returning id into v_request_id;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'intent', v_intent,
    'status', 'new',
    'token_id', v_token_id,
    'proposal_id', v_proposal_id,
    'proposal_version_id', v_proposal_version_id,
    'requested_option_id', v_option_id,
    'requested_option_label', v_option_label,
    'proposal_status_unchanged', v_before_status,
    'selected_option_id_unchanged', v_before_selected_option_id
  );
end;
$$;

comment on function public.record_proposal_customer_request_v1(
  text, text, uuid, text, text, text, text, jsonb
) is
  'R3B1 — Append a non-binding customer package request for a valid public access token. '
  'Resolves company/proposal/version/token server-side. Validates option on bound version. '
  'Does not mutate proposals.status, selected_option_id, frozen options, upgrades, or proposal_events. '
  'Never stores raw token.';

-- ---------------------------------------------------------------------------
-- 4. RLS — SELECT for company members; writes via service_role RPC only
-- ---------------------------------------------------------------------------

alter table public.proposal_customer_requests enable row level security;

drop policy if exists "proposal_customer_requests_select_company_scope"
  on public.proposal_customer_requests;
create policy "proposal_customer_requests_select_company_scope"
  on public.proposal_customer_requests
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_customer_requests_insert_company_scope"
  on public.proposal_customer_requests;
drop policy if exists "proposal_customer_requests_update_company_scope"
  on public.proposal_customer_requests;
drop policy if exists "proposal_customer_requests_delete_company_scope"
  on public.proposal_customer_requests;

-- ---------------------------------------------------------------------------
-- 5. Grants / RPC permissions — service_role execute only
-- ---------------------------------------------------------------------------

revoke all on table public.proposal_customer_requests from anon;
revoke all on table public.proposal_customer_requests from public;
grant select on table public.proposal_customer_requests to authenticated;

revoke all on function public.record_proposal_customer_request_v1(
  text, text, uuid, text, text, text, text, jsonb
) from public;
revoke all on function public.record_proposal_customer_request_v1(
  text, text, uuid, text, text, text, text, jsonb
) from anon;
revoke all on function public.record_proposal_customer_request_v1(
  text, text, uuid, text, text, text, text, jsonb
) from authenticated;
grant execute on function public.record_proposal_customer_request_v1(
  text, text, uuid, text, text, text, text, jsonb
) to service_role;
