-- ---------------------------------------------------------------------------
-- 052 — Durable pre-pay customer package choice
-- ---------------------------------------------------------------------------
--
-- 049 binds customer choice at acceptance INSERT. Until then, the public
-- packet held the homeowner's selected package only in React state, so
-- reload / direct URL forgot it. This migration adds one provisional choice
-- row per frozen sent offer. The sent version remains immutable.
--
-- Ownership:
--   proposal_public_option_choices  — one effective choice per
--     (company, proposal, frozen version)
--   record_proposal_public_option_choice_v1 — token-gated write
--   proposal_public_option_choice_current_v1 — canonical read
--
-- Mutable only while no proposal_acceptances row exists for that version.
-- After acceptance, the row is locked; acceptance remains contractual truth.
-- 049 / 050 / 051 are not rewritten.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_public_option_choices (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_id uuid not null,
  proposal_version_id uuid not null,
  public_access_token_id uuid not null,

  chosen_option_id uuid not null,
  chosen_option_key text not null,
  chosen_option_label text not null,
  chosen_total_cents integer not null,

  chosen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint proposal_public_option_choices_id_company_unique
    unique (id, company_id),

  constraint proposal_public_option_choices_offer_unique
    unique (company_id, proposal_id, proposal_version_id),

  constraint proposal_public_option_choices_proposal_company_fkey
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete cascade,

  constraint proposal_public_option_choices_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete restrict,

  constraint proposal_public_option_choices_token_company_fkey
    foreign key (public_access_token_id, company_id)
    references public.proposal_public_access_tokens (id, company_id)
    on delete cascade,

  constraint proposal_public_option_choices_option_company_fkey
    foreign key (chosen_option_id, company_id)
    references public.proposal_options (id, company_id)
    on delete restrict,

  constraint proposal_public_option_choices_key_not_empty
    check (length(trim(chosen_option_key)) > 0),

  constraint proposal_public_option_choices_key_length
    check (char_length(chosen_option_key) <= 200),

  constraint proposal_public_option_choices_label_length
    check (char_length(chosen_option_label) between 1 and 120),

  constraint proposal_public_option_choices_total_nonnegative
    check (chosen_total_cents >= 0)
);

create index if not exists idx_proposal_public_option_choices_version
  on public.proposal_public_option_choices (company_id, proposal_version_id);

comment on table public.proposal_public_option_choices is
  '052 — One provisional customer package choice per frozen sent proposal version. '
  'Does not mutate frozen options, contractor selected_option_id, or jobs.stage. '
  'Mutable until a proposal_acceptances row exists for the same version.';

comment on column public.proposal_public_option_choices.chosen_option_id is
  'Frozen proposal_options.id on the bound sent version. Never a client price.';

comment on column public.proposal_public_option_choices.chosen_option_key is
  'Stable source_template_option_id used by the public packet.';

comment on column public.proposal_public_option_choices.public_access_token_id is
  'Last public token that wrote this choice. Uniqueness is version-scoped, not token-scoped.';

-- ---------------------------------------------------------------------------
-- 2. Row guard — no deletes; freeze after acceptance; option must stay on version
-- ---------------------------------------------------------------------------

create or replace function public.proposal_public_option_choices_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_option public.proposal_options%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'proposal_public_option_choices rows cannot be deleted';
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    select po.*
    into v_option
    from public.proposal_options po
    where po.id = new.chosen_option_id
      and po.company_id = new.company_id;

    if not found
      or v_option.proposal_version_id is distinct from new.proposal_version_id
      or v_option.visible_to_customer is not true
      or v_option.customer_total_cents is null
      or v_option.customer_total_cents is distinct from new.chosen_total_cents
    then
      raise exception 'proposal_public_option_choices must bind a visible priced option on the frozen version';
    end if;

    if trim(coalesce(v_option.source_template_option_id::text, ''))
         is distinct from trim(new.chosen_option_key)
    then
      raise exception 'proposal_public_option_choices option key must match frozen source_template_option_id';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.company_id is distinct from old.company_id
      or new.proposal_id is distinct from old.proposal_id
      or new.proposal_version_id is distinct from old.proposal_version_id
      or new.created_at is distinct from old.created_at
      or new.chosen_at is distinct from old.chosen_at
    then
      raise exception 'proposal_public_option_choices identity fields are immutable';
    end if;

    if exists (
      select 1
      from public.proposal_acceptances a
      where a.company_id = new.company_id
        and a.proposal_id = new.proposal_id
        and a.proposal_version_id = new.proposal_version_id
    ) and (
      new.chosen_option_id is distinct from old.chosen_option_id
      or new.chosen_option_key is distinct from old.chosen_option_key
      or new.chosen_total_cents is distinct from old.chosen_total_cents
    ) then
      raise exception 'proposal_public_option_choices cannot change after acceptance';
    end if;

    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists proposal_public_option_choices_row_guard
  on public.proposal_public_option_choices;
create trigger proposal_public_option_choices_row_guard
  before insert or update or delete on public.proposal_public_option_choices
  for each row
  execute function public.proposal_public_option_choices_row_guard();

revoke all on function public.proposal_public_option_choices_row_guard()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Canonical read
-- ---------------------------------------------------------------------------

create or replace function public.proposal_public_option_choice_current_v1(
  p_company_id uuid,
  p_proposal_id uuid,
  p_proposal_version_id uuid
)
returns table (
  option_id uuid,
  option_key text,
  option_label text,
  total_cents integer,
  chosen_at timestamptz,
  updated_at timestamptz,
  locked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.chosen_option_id,
    c.chosen_option_key,
    c.chosen_option_label,
    c.chosen_total_cents,
    c.chosen_at,
    c.updated_at,
    exists (
      select 1
      from public.proposal_acceptances a
      where a.company_id = c.company_id
        and a.proposal_id = c.proposal_id
        and a.proposal_version_id = c.proposal_version_id
    ) as locked
  from public.proposal_public_option_choices c
  where c.company_id = p_company_id
    and c.proposal_id = p_proposal_id
    and c.proposal_version_id = p_proposal_version_id;
$$;

revoke all on function public.proposal_public_option_choice_current_v1(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.proposal_public_option_choice_current_v1(uuid, uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Token-gated write
-- ---------------------------------------------------------------------------

create or replace function public.record_proposal_public_option_choice_v1(
  p_token_hash text,
  p_option_key text
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
  v_option_key text;
  v_option_id uuid;
  v_option_label text;
  v_total_cents integer;
  v_existing public.proposal_public_option_choices%rowtype;
  v_row public.proposal_public_option_choices%rowtype;
  v_locked boolean := false;
begin
  v_assert := public.proposal_assert_public_access_token_active_v1(p_token_hash);
  if coalesce(v_assert->>'ok', '') <> 'true' then
    return v_assert;
  end if;

  v_token_id := (v_assert->>'token_id')::uuid;
  v_company_id := (v_assert->>'company_id')::uuid;
  v_proposal_id := (v_assert->>'proposal_id')::uuid;
  v_proposal_version_id := (v_assert->>'proposal_version_id')::uuid;

  v_option_key := nullif(trim(coalesce(p_option_key, '')), '');
  if v_option_key is null or char_length(v_option_key) > 200 then
    return jsonb_build_object('ok', false, 'code', 'invalid_option_choice');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'proposal_public_option_choice:' || v_company_id::text || ':' || v_proposal_version_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.proposal_acceptances a
    where a.company_id = v_company_id
      and a.proposal_id = v_proposal_id
      and a.proposal_version_id = v_proposal_version_id
  ) then
    v_locked := true;
  end if;

  select c.option_id, c.option_label, c.total_cents
  into v_option_id, v_option_label, v_total_cents
  from public.proposal_resolve_customer_chosen_option_v1(
    v_company_id,
    v_proposal_version_id,
    v_option_key
  ) c;

  if v_option_id is null or v_total_cents is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_option_choice');
  end if;

  select *
  into v_existing
  from public.proposal_public_option_choices c
  where c.company_id = v_company_id
    and c.proposal_id = v_proposal_id
    and c.proposal_version_id = v_proposal_version_id
  for update;

  if found then
    if v_locked and v_existing.chosen_option_id is distinct from v_option_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'choice_locked',
        'option_key', v_existing.chosen_option_key,
        'option_id', v_existing.chosen_option_id,
        'option_label', v_existing.chosen_option_label,
        'total_cents', v_existing.chosen_total_cents
      );
    end if;

    if v_existing.chosen_option_id is not distinct from v_option_id
      and v_existing.chosen_total_cents is not distinct from v_total_cents
    then
      update public.proposal_public_option_choices
      set public_access_token_id = v_token_id
      where id = v_existing.id
      returning * into v_row;

      return jsonb_build_object(
        'ok', true,
        'id', v_row.id,
        'option_id', v_row.chosen_option_id,
        'option_key', v_row.chosen_option_key,
        'option_label', v_row.chosen_option_label,
        'total_cents', v_row.chosen_total_cents,
        'idempotent_replay', true,
        'locked', v_locked
      );
    end if;

    update public.proposal_public_option_choices
    set
      public_access_token_id = v_token_id,
      chosen_option_id = v_option_id,
      chosen_option_key = v_option_key,
      chosen_option_label = v_option_label,
      chosen_total_cents = v_total_cents
    where id = v_existing.id
    returning * into v_row;
  else
    if v_locked then
      return jsonb_build_object('ok', false, 'code', 'choice_locked');
    end if;

    insert into public.proposal_public_option_choices (
      company_id,
      proposal_id,
      proposal_version_id,
      public_access_token_id,
      chosen_option_id,
      chosen_option_key,
      chosen_option_label,
      chosen_total_cents
    )
    values (
      v_company_id,
      v_proposal_id,
      v_proposal_version_id,
      v_token_id,
      v_option_id,
      v_option_key,
      v_option_label,
      v_total_cents
    )
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'option_id', v_row.chosen_option_id,
    'option_key', v_row.chosen_option_key,
    'option_label', v_row.chosen_option_label,
    'total_cents', v_row.chosen_total_cents,
    'idempotent_replay', false,
    'locked', false
  );
end;
$$;

revoke all on function public.record_proposal_public_option_choice_v1(text, text)
  from public, anon, authenticated;
grant execute on function public.record_proposal_public_option_choice_v1(text, text)
  to service_role;

comment on function public.record_proposal_public_option_choice_v1(text, text) is
  '052 public customer package choice. Token-gated. Resolves the option against '
  'the frozen sent version via proposal_resolve_customer_chosen_option_v1. One '
  'row per version. Same selection is idempotent. Switch allowed until acceptance. '
  'Never changes jobs.stage or frozen proposal content.';

-- ---------------------------------------------------------------------------
-- 5. RLS / grants — no anonymous or authenticated table writes
-- ---------------------------------------------------------------------------

alter table public.proposal_public_option_choices enable row level security;

drop policy if exists "proposal_public_option_choices_select_company_scope"
  on public.proposal_public_option_choices;
create policy "proposal_public_option_choices_select_company_scope"
  on public.proposal_public_option_choices
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_public_option_choices_insert_company_scope"
  on public.proposal_public_option_choices;
drop policy if exists "proposal_public_option_choices_update_company_scope"
  on public.proposal_public_option_choices;
drop policy if exists "proposal_public_option_choices_delete_company_scope"
  on public.proposal_public_option_choices;

revoke all on table public.proposal_public_option_choices from anon;
revoke all on table public.proposal_public_option_choices from public;
grant select on table public.proposal_public_option_choices to authenticated;
