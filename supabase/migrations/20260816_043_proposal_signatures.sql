-- R3D — Proposal signatures (customer_primary)
-- AUTHOR ONLY — DO NOT APPLY WITHOUT EXPLICIT LIVE-APPLY APPROVAL.
--
-- Number 043 is the next unused migration after 042.
-- 039 remains reserved for deferred C4 generic-email-mint hardening (NOT this file).
-- Migrations 038–042 are not rewritten here.
--
-- This migration does NOT:
--   - implement PDF, email, Sign Now, co-signers, countersign, witness
--   - write jobs.stage / stage_entered_at / proposals.signed_version_id
--   - encode payment or scheduling
--   - create a proposal_signers table
--
-- Public signing reuses proposal_assert_public_access_token_active_v1 and
-- record_proposal_acceptance_v1 inside one transaction.
-- Signature NEVER changes jobs.stage.

begin;

-- ---------------------------------------------------------------------------
-- 1. proposal_signatures — append-only immutable signature evidence
-- ---------------------------------------------------------------------------

create table if not exists public.proposal_signatures (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies(id) on delete restrict,
  job_id uuid not null,
  proposal_id uuid not null,
  proposal_version_id uuid not null,
  proposal_option_id uuid not null,
  proposal_acceptance_id uuid not null,
  public_access_token_id uuid not null,

  signer_slot text not null default 'customer_primary',
  signer_printed_name text not null,
  signer_email text null,
  typed_name_echo text not null,
  drawn_mark_json jsonb not null,
  acknowledgement_key text not null,
  acknowledgement_text text not null,

  signed_at timestamptz not null default now(),
  source text not null default 'public_token',
  method text not null default 'drawn_signature',
  created_at timestamptz not null default now(),

  constraint proposal_signatures_id_company_unique
    unique (id, company_id),

  constraint proposal_signatures_logical_unique
    unique (company_id, proposal_acceptance_id, signer_slot),

  constraint proposal_signatures_job_company_fkey
    foreign key (job_id, company_id)
    references public.jobs (id, company_id)
    on delete restrict,

  constraint proposal_signatures_proposal_company_fkey
    foreign key (proposal_id, company_id)
    references public.proposals (id, company_id)
    on delete restrict,

  constraint proposal_signatures_version_company_fkey
    foreign key (proposal_version_id, company_id)
    references public.proposal_versions (id, company_id)
    on delete restrict,

  constraint proposal_signatures_option_company_fkey
    foreign key (proposal_option_id, company_id)
    references public.proposal_options (id, company_id)
    on delete restrict,

  constraint proposal_signatures_acceptance_company_fkey
    foreign key (proposal_acceptance_id, company_id)
    references public.proposal_acceptances (id, company_id)
    on delete restrict,

  constraint proposal_signatures_token_company_fkey
    foreign key (public_access_token_id, company_id)
    references public.proposal_public_access_tokens (id, company_id)
    on delete restrict,

  constraint proposal_signatures_signer_slot_check
    check (signer_slot = 'customer_primary'),

  constraint proposal_signatures_source_check
    check (source = 'public_token'),

  constraint proposal_signatures_method_check
    check (method = 'drawn_signature'),

  constraint proposal_signatures_ack_key_check
    check (acknowledgement_key = 'fielddive_proposal_signature_v1'),

  constraint proposal_signatures_ack_text_check
    check (
      acknowledgement_text =
        'I accept and sign this proposal as shown, including the selected package and total.'
    ),

  constraint proposal_signatures_name_length_check
    check (
      length(trim(signer_printed_name)) > 0
      and char_length(signer_printed_name) <= 120
    ),

  constraint proposal_signatures_typed_echo_length_check
    check (
      length(trim(typed_name_echo)) > 0
      and char_length(typed_name_echo) <= 120
    ),

  constraint proposal_signatures_email_length_check
    check (signer_email is null or char_length(signer_email) <= 254),

  constraint proposal_signatures_mark_object_check
    check (jsonb_typeof(drawn_mark_json) = 'object')
);

create index if not exists idx_proposal_signatures_company_job_signed
  on public.proposal_signatures (company_id, job_id, signed_at desc);

create index if not exists idx_proposal_signatures_company_proposal_version
  on public.proposal_signatures (company_id, proposal_id, proposal_version_id);

create index if not exists idx_proposal_signatures_acceptance
  on public.proposal_signatures (company_id, proposal_acceptance_id);

comment on table public.proposal_signatures is
  'R3D append-only customer signature evidence. Binds to one proposal_acceptances '
  'row (frozen sent version + selected option). Not payment, schedule, or Job stage. '
  'Does not write proposals.signed_version_id.';

comment on column public.proposal_signatures.public_access_token_id is
  'Access evidence only. Logical identity is (company, acceptance, signer_slot).';

comment on column public.proposal_signatures.signer_slot is
  'V1 only customer_primary. Future slots are deferred.';

comment on column public.proposal_signatures.drawn_mark_json is
  'Compact versioned stroke JSON. No Storage object.';

-- ---------------------------------------------------------------------------
-- 2. Mark validation (internal)
-- ---------------------------------------------------------------------------

create or replace function public.proposal_signature_mark_error_v1(p_mark jsonb)
returns text
language plpgsql
immutable
security invoker
set search_path = public
as $$
declare
  v_strokes jsonb;
  v_stroke jsonb;
  v_point jsonb;
  v_stroke_count int;
  v_point_count int;
  v_total_points int := 0;
  v_i int;
  v_j int;
  v_x numeric;
  v_y numeric;
  v_t numeric;
  v_min_x numeric := 1;
  v_min_y numeric := 1;
  v_max_x numeric := 0;
  v_max_y numeric := 0;
  v_keys text[];
  v_point_keys text[];
begin
  if p_mark is null or jsonb_typeof(p_mark) <> 'object' then
    return 'invalid_mark';
  end if;

  if octet_length(p_mark::text) > 24576 then
    return 'mark_too_large';
  end if;

  select array_agg(k order by k)
  into v_keys
  from jsonb_object_keys(p_mark) as t(k);

  if v_keys is distinct from array['strokes', 'version']::text[] then
    return 'invalid_mark';
  end if;

  if jsonb_typeof(p_mark->'version') <> 'number'
    or (p_mark->>'version')::numeric <> 1 then
    return 'invalid_mark_version';
  end if;

  v_strokes := p_mark->'strokes';
  if jsonb_typeof(v_strokes) <> 'array' then
    return 'invalid_mark';
  end if;

  v_stroke_count := jsonb_array_length(v_strokes);
  if v_stroke_count < 1 or v_stroke_count > 24 then
    return 'invalid_mark';
  end if;

  for v_i in 0 .. v_stroke_count - 1 loop
    v_stroke := v_strokes->v_i;
    if jsonb_typeof(v_stroke) <> 'array' then
      return 'invalid_mark';
    end if;
    v_point_count := jsonb_array_length(v_stroke);
    if v_point_count < 2 or v_point_count > 256 then
      return 'invalid_mark';
    end if;
    v_total_points := v_total_points + v_point_count;
    if v_total_points > 1536 then
      return 'mark_too_large';
    end if;

    for v_j in 0 .. v_point_count - 1 loop
      v_point := v_stroke->v_j;
      if jsonb_typeof(v_point) <> 'object' then
        return 'invalid_mark';
      end if;

      select array_agg(k order by k)
      into v_point_keys
      from jsonb_object_keys(v_point) as t(k);

      if v_point_keys is distinct from array['x', 'y']::text[]
        and v_point_keys is distinct from array['t', 'x', 'y']::text[]
      then
        return 'invalid_mark';
      end if;

      if jsonb_typeof(v_point->'x') <> 'number'
        or jsonb_typeof(v_point->'y') <> 'number' then
        return 'invalid_mark';
      end if;

      v_x := (v_point->>'x')::numeric;
      v_y := (v_point->>'y')::numeric;
      if v_x is null or v_y is null
        or v_x < 0 or v_x > 1
        or v_y < 0 or v_y > 1 then
        return 'invalid_mark';
      end if;

      if v_point ? 't' then
        if jsonb_typeof(v_point->'t') <> 'number' then
          return 'invalid_mark';
        end if;
        v_t := (v_point->>'t')::numeric;
        if v_t is null or v_t < 0 then
          return 'invalid_mark';
        end if;
      end if;

      if v_x < v_min_x then v_min_x := v_x; end if;
      if v_y < v_min_y then v_min_y := v_y; end if;
      if v_x > v_max_x then v_max_x := v_x; end if;
      if v_y > v_max_y then v_max_y := v_y; end if;
    end loop;
  end loop;

  if (v_max_x - v_min_x) + (v_max_y - v_min_y) < 0.05 then
    return 'mark_too_small';
  end if;

  return null;
exception
  when others then
    return 'invalid_mark';
end;
$$;

revoke all on function public.proposal_signature_mark_error_v1(jsonb) from public;
revoke all on function public.proposal_signature_mark_error_v1(jsonb) from anon;
revoke all on function public.proposal_signature_mark_error_v1(jsonb) from authenticated;

comment on function public.proposal_signature_mark_error_v1(jsonb) is
  'INTERNAL. Returns an error code for invalid drawn_mark_json, or null when valid. '
  'Not granted to authenticated, anon, or public.';

-- ---------------------------------------------------------------------------
-- 3. Immutability
-- ---------------------------------------------------------------------------

create or replace function public.proposal_signatures_row_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_acceptance public.proposal_acceptances%rowtype;
  v_mark_error text;
begin
  if tg_op = 'DELETE' then
    raise exception 'proposal_signatures rows cannot be deleted';
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'proposal_signatures rows cannot be updated';
  end if;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = new.proposal_acceptance_id
    and a.company_id = new.company_id;

  if not found then
    raise exception 'proposal_signatures require a matching proposal_acceptance';
  end if;

  if new.job_id is distinct from v_acceptance.job_id
    or new.proposal_id is distinct from v_acceptance.proposal_id
    or new.proposal_version_id is distinct from v_acceptance.proposal_version_id
    or new.proposal_option_id is distinct from v_acceptance.proposal_option_id
  then
    raise exception 'proposal_signatures binding must match the acceptance row';
  end if;

  if new.typed_name_echo is distinct from new.signer_printed_name then
    raise exception 'proposal_signatures typed_name_echo must match signer_printed_name';
  end if;

  v_mark_error := public.proposal_signature_mark_error_v1(new.drawn_mark_json);
  if v_mark_error is not null then
    raise exception 'proposal_signatures drawn mark is invalid: %', v_mark_error;
  end if;

  return new;
end;
$$;

drop trigger if exists proposal_signatures_row_guard on public.proposal_signatures;
create trigger proposal_signatures_row_guard
  before insert or update or delete on public.proposal_signatures
  for each row
  execute function public.proposal_signatures_row_guard();

revoke all on function public.proposal_signatures_row_guard() from public;
revoke all on function public.proposal_signatures_row_guard() from anon;
revoke all on function public.proposal_signatures_row_guard() from authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS / grants
-- ---------------------------------------------------------------------------

alter table public.proposal_signatures enable row level security;

drop policy if exists "proposal_signatures_select_company_scope"
  on public.proposal_signatures;
create policy "proposal_signatures_select_company_scope"
  on public.proposal_signatures
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "proposal_signatures_insert_company_scope"
  on public.proposal_signatures;
drop policy if exists "proposal_signatures_update_company_scope"
  on public.proposal_signatures;
drop policy if exists "proposal_signatures_delete_company_scope"
  on public.proposal_signatures;

revoke all on table public.proposal_signatures from public;
revoke all on table public.proposal_signatures from anon;
revoke all on table public.proposal_signatures from authenticated;
grant select on table public.proposal_signatures to authenticated;
grant all on table public.proposal_signatures to service_role;

-- ---------------------------------------------------------------------------
-- 5. record_proposal_signature_v1
-- ---------------------------------------------------------------------------

create or replace function public.record_proposal_signature_v1(
  p_token_hash text,
  p_signer_printed_name text,
  p_signer_email text,
  p_drawn_mark_json jsonb,
  p_payload_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_email text;
  v_payload jsonb;
  v_mark_error text;
  v_accept jsonb;
  v_acceptance public.proposal_acceptances%rowtype;
  v_signature public.proposal_signatures%rowtype;
  v_idempotent_replay boolean := false;
  v_acceptance_replay boolean := false;
  v_before_stage text;
  v_before_entered timestamptz;
  v_before_signed_version uuid;
  v_after_stage text;
  v_after_entered timestamptz;
  v_after_signed_version uuid;
  v_company_id uuid;
  v_job_id uuid;
  v_proposal_id uuid;
  v_ack_text constant text :=
    'I accept and sign this proposal as shown, including the selected package and total.';
begin
  v_name := nullif(trim(regexp_replace(coalesce(p_signer_printed_name, ''), '\s+', ' ', 'g')), '');
  if v_name is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_signer_name');
  end if;
  if char_length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_signer_name');
  end if;

  v_email := nullif(trim(coalesce(p_signer_email, '')), '');
  if v_email is not null and char_length(v_email) > 254 then
    return jsonb_build_object('ok', false, 'code', 'invalid_signer_email');
  end if;

  v_payload := coalesce(p_payload_json, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if public.proposal_forbidden_token_json_keys(v_payload) then
    return jsonb_build_object('ok', false, 'code', 'forbidden_payload_keys');
  end if;

  v_mark_error := public.proposal_signature_mark_error_v1(p_drawn_mark_json);
  if v_mark_error is not null then
    return jsonb_build_object('ok', false, 'code', v_mark_error);
  end if;

  -- Nested R3C owner shares this transaction. Later RAISE rolls it back.
  v_accept := public.record_proposal_acceptance_v1(
    p_token_hash,
    v_name,
    v_email,
    '{}'::jsonb
  );

  if coalesce((v_accept->>'ok')::boolean, false) is not true then
    return v_accept;
  end if;

  v_acceptance_replay := coalesce((v_accept->>'idempotent_replay')::boolean, false);
  v_company_id := (v_accept->>'company_id')::uuid;
  v_job_id := (v_accept->>'job_id')::uuid;
  v_proposal_id := (v_accept->>'proposal_id')::uuid;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = (v_accept->>'acceptance_id')::uuid
    and a.company_id = v_company_id
  for update;

  if not found then
    raise exception 'signature acceptance row missing after record_proposal_acceptance_v1';
  end if;

  select
    public.canonical_job_stage_from_row(
      j.stage, j.status, coalesce(j.archived, false), j.active_proposal_id, j.latest_proposal_id
    ),
    j.stage_entered_at,
    p.signed_version_id
  into v_before_stage, v_before_entered, v_before_signed_version
  from public.jobs j
  join public.proposals p
    on p.id = v_proposal_id
   and p.company_id = j.company_id
  where j.id = v_job_id
    and j.company_id = v_company_id;

  select s.*
  into v_signature
  from public.proposal_signatures s
  where s.company_id = v_company_id
    and s.proposal_acceptance_id = v_acceptance.id
    and s.signer_slot = 'customer_primary'
  for update;

  if found then
    v_idempotent_replay := true;
  else
    begin
      insert into public.proposal_signatures (
        company_id,
        job_id,
        proposal_id,
        proposal_version_id,
        proposal_option_id,
        proposal_acceptance_id,
        public_access_token_id,
        signer_slot,
        signer_printed_name,
        signer_email,
        typed_name_echo,
        drawn_mark_json,
        acknowledgement_key,
        acknowledgement_text,
        source,
        method
      ) values (
        v_acceptance.company_id,
        v_acceptance.job_id,
        v_acceptance.proposal_id,
        v_acceptance.proposal_version_id,
        v_acceptance.proposal_option_id,
        v_acceptance.id,
        (v_accept->>'token_id')::uuid,
        'customer_primary',
        v_name,
        v_email,
        v_name,
        p_drawn_mark_json,
        'fielddive_proposal_signature_v1',
        v_ack_text,
        'public_token',
        'drawn_signature'
      )
      returning * into v_signature;
    exception
      when unique_violation then
        select s.*
        into v_signature
        from public.proposal_signatures s
        where s.company_id = v_company_id
          and s.proposal_acceptance_id = v_acceptance.id
          and s.signer_slot = 'customer_primary'
        for update;
        v_idempotent_replay := true;
    end;
  end if;

  select
    public.canonical_job_stage_from_row(
      j.stage, j.status, coalesce(j.archived, false), j.active_proposal_id, j.latest_proposal_id
    ),
    j.stage_entered_at,
    p.signed_version_id
  into v_after_stage, v_after_entered, v_after_signed_version
  from public.jobs j
  join public.proposals p
    on p.id = v_proposal_id
   and p.company_id = j.company_id
  where j.id = v_job_id
    and j.company_id = v_company_id;

  if v_after_stage is distinct from v_before_stage
    or v_after_entered is distinct from v_before_entered
  then
    raise exception 'proposal signature must not change job stage';
  end if;

  if v_after_signed_version is distinct from v_before_signed_version then
    raise exception 'proposal signature must not write proposals.signed_version_id';
  end if;

  return jsonb_build_object(
    'ok', true,
    'signature_id', v_signature.id,
    'acceptance_id', v_acceptance.id,
    'token_id', v_signature.public_access_token_id,
    'company_id', v_signature.company_id,
    'job_id', v_signature.job_id,
    'proposal_id', v_signature.proposal_id,
    'proposal_version_id', v_signature.proposal_version_id,
    'proposal_option_id', v_signature.proposal_option_id,
    'signer_slot', v_signature.signer_slot,
    'signer_printed_name', v_signature.signer_printed_name,
    'signed_at', v_signature.signed_at,
    'accepted_at', v_acceptance.accepted_at,
    'accepted_option_label', v_acceptance.accepted_option_label,
    'accepted_total_cents', v_acceptance.accepted_total_cents,
    'acknowledgement_key', v_signature.acknowledgement_key,
    'job_stage', v_after_stage,
    'stage_entered_at', v_after_entered,
    'job_stage_unchanged', true,
    'signed_version_id_unchanged', v_after_signed_version,
    'idempotent_replay', v_idempotent_replay,
    'acceptance_replay', v_acceptance_replay,
    'attention_id', v_accept->'attention_id'
  );
end;
$$;

revoke all on function public.record_proposal_signature_v1(text, text, text, jsonb, jsonb)
  from public;
revoke all on function public.record_proposal_signature_v1(text, text, text, jsonb, jsonb)
  from anon;
revoke all on function public.record_proposal_signature_v1(text, text, text, jsonb, jsonb)
  from authenticated;
grant execute on function public.record_proposal_signature_v1(text, text, text, jsonb, jsonb)
  to service_role;

comment on function public.record_proposal_signature_v1(text, text, text, jsonb, jsonb) is
  'R3D public Accept & sign. Calls record_proposal_acceptance_v1 in the same '
  'transaction, then inserts one customer_primary signature. Invalid mark/name '
  'fails before acceptance. Later failures RAISE and roll back a newly created '
  'acceptance. NEVER writes jobs.stage or proposals.signed_version_id. '
  'Same-version resend tokens reuse the logical acceptance and signature row. '
  'Older still-active tokens sign that exact historical version.';

commit;
