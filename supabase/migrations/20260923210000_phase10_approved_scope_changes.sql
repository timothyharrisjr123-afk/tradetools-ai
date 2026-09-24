-- Phase 10 / Astra G9 — minimal approved scope changes (additive).
-- Original accepted agreement remains immutable.
-- Canonical contract total = base acceptance total + Σ authorized price_delta_cents.
-- Does not mutate proposal_acceptances, frozen proposal graphs, payment-request snapshots,
-- jobs.stage, or payment settlement truth.

-- ---------------------------------------------------------------------------
-- 0) Activity event types (expand Phase 7 set)
-- ---------------------------------------------------------------------------
alter table public.job_activity_events
  drop constraint if exists job_activity_events_type_check;

alter table public.job_activity_events
  add constraint job_activity_events_type_check check (
    event_type = any (
      array[
        'job_created'::text,
        'stage_changed'::text,
        'disposition_changed'::text,
        'job_scheduled'::text,
        'job_rescheduled'::text,
        'job_unscheduled'::text,
        'job_work_started'::text,
        'job_work_completed'::text,
        'production_lead_assigned'::text,
        'production_lead_changed'::text,
        'production_lead_cleared'::text,
        'scope_change_created'::text,
        'scope_change_proposed'::text,
        'scope_change_authorized'::text,
        'scope_change_declined'::text,
        'scope_change_voided'::text
      ]
    )
  );

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------
create table if not exists public.job_scope_changes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id uuid not null,
  base_proposal_id uuid not null,
  base_proposal_version_id uuid not null,
  base_acceptance_id uuid not null,
  status text not null,
  reason text null,
  timing_note text null,
  price_delta_cents integer not null,
  basis_contract_total_cents integer not null,
  proposed_at timestamptz null,
  authorized_at timestamptz null,
  declined_at timestamptz null,
  voided_at timestamptz null,
  created_by uuid null,
  updated_by uuid null,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint job_scope_changes_status_check check (
    status = any (array['draft'::text, 'proposed'::text, 'authorized'::text, 'declined'::text, 'voided'::text])
  ),
  constraint job_scope_changes_reason_len_check check (
    reason is null or char_length(reason) <= 500
  ),
  constraint job_scope_changes_timing_note_len_check check (
    timing_note is null or char_length(timing_note) <= 240
  ),
  constraint job_scope_changes_basis_total_check check (
    basis_contract_total_cents >= 0
  ),
  constraint job_scope_changes_row_version_check check (row_version >= 1),
  constraint job_scope_changes_status_timestamps_check check (
    (
      status = 'draft'
      and proposed_at is null
      and authorized_at is null
      and declined_at is null
      and voided_at is null
    )
    or (
      status = 'proposed'
      and proposed_at is not null
      and authorized_at is null
      and declined_at is null
      and voided_at is null
    )
    or (
      status = 'authorized'
      and proposed_at is not null
      and authorized_at is not null
      and declined_at is null
      and voided_at is null
    )
    or (
      status = 'declined'
      and proposed_at is not null
      and declined_at is not null
      and authorized_at is null
      and voided_at is null
    )
    or (
      status = 'voided'
      and voided_at is not null
      and authorized_at is null
      and declined_at is null
    )
  )
);

comment on table public.job_scope_changes is
  'Astra G9 additive approved scope-change header. Never mutates the original accepted agreement. Contract effect only when status=authorized.';

comment on column public.job_scope_changes.basis_contract_total_cents is
  'Canonical job contract total (base acceptance + prior authorized deltas) when this change basis was established. Stale if live rollup diverges.';

comment on column public.job_scope_changes.price_delta_cents is
  'Signed cents delta for this change. Must equal sum(job_scope_change_lines.line_delta_cents). Zero-price changes still require authorization.';

alter table public.job_scope_changes
  add constraint job_scope_changes_id_company_unique unique (id, company_id);

alter table public.job_scope_changes
  add constraint job_scope_changes_company_id_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

-- Composite FK relies on public.idx_jobs_id_company_unique (id, company_id).
alter table public.job_scope_changes
  add constraint job_scope_changes_job_company_fkey
  foreign key (job_id, company_id) references public.jobs (id, company_id) on delete restrict;

alter table public.job_scope_changes
  add constraint job_scope_changes_proposal_company_fkey
  foreign key (base_proposal_id, company_id) references public.proposals (id, company_id) on delete restrict;

-- Relies on proposal_versions_id_company_unique (id, company_id).
alter table public.job_scope_changes
  add constraint job_scope_changes_version_company_fkey
  foreign key (base_proposal_version_id, company_id) references public.proposal_versions (id, company_id) on delete restrict;

alter table public.job_scope_changes
  add constraint job_scope_changes_acceptance_company_fkey
  foreign key (base_acceptance_id, company_id) references public.proposal_acceptances (id, company_id) on delete restrict;

alter table public.job_scope_changes
  add constraint job_scope_changes_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.job_scope_changes
  add constraint job_scope_changes_updated_by_fkey
  foreign key (updated_by) references auth.users (id) on delete set null;

create index if not exists idx_job_scope_changes_job_status
  on public.job_scope_changes (company_id, job_id, status)
  where deleted_at is null;

create index if not exists idx_job_scope_changes_job_authorized
  on public.job_scope_changes (company_id, job_id, authorized_at)
  where status = 'authorized' and deleted_at is null;

-- One live proposed change per job (V1).
create unique index if not exists uq_job_scope_changes_one_proposed_per_job
  on public.job_scope_changes (company_id, job_id)
  where status = 'proposed' and deleted_at is null;

create table if not exists public.job_scope_change_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  scope_change_id uuid not null,
  change_kind text not null,
  description text not null,
  quantity numeric(14, 4) null,
  unit text null,
  unit_price_cents integer null,
  line_delta_cents integer not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint job_scope_change_lines_kind_check check (
    change_kind = any (array['add'::text, 'remove'::text])
  ),
  constraint job_scope_change_lines_description_check check (
    length(trim(description)) > 0 and char_length(description) <= 240
  ),
  constraint job_scope_change_lines_unit_len_check check (
    unit is null or (length(trim(unit)) > 0 and char_length(unit) <= 40)
  ),
  constraint job_scope_change_lines_sort_order_check check (sort_order >= 0),
  constraint job_scope_change_lines_kind_sign_check check (
    (change_kind = 'add' and line_delta_cents >= 0)
    or (change_kind = 'remove' and line_delta_cents <= 0)
  )
);

comment on table public.job_scope_change_lines is
  'Structured add/remove lines for one scope change. Frozen after propose; not a second authorized-scope store.';

alter table public.job_scope_change_lines
  add constraint job_scope_change_lines_id_company_unique unique (id, company_id);

alter table public.job_scope_change_lines
  add constraint job_scope_change_lines_company_id_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

alter table public.job_scope_change_lines
  add constraint job_scope_change_lines_scope_company_fkey
  foreign key (scope_change_id, company_id)
  references public.job_scope_changes (id, company_id)
  on delete cascade;

create index if not exists idx_job_scope_change_lines_scope
  on public.job_scope_change_lines (company_id, scope_change_id, sort_order);

create table if not exists public.job_scope_change_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  scope_change_id uuid not null,
  approved_at timestamptz not null default now(),
  approved_by_name text not null,
  approved_by_email text null,
  approval_method text not null,
  evidence_json jsonb null,
  proposal_signature_id uuid null,
  created_at timestamptz not null default now(),
  constraint job_scope_change_approvals_method_check check (
    approval_method = 'public_token'
  ),
  constraint job_scope_change_approvals_name_len_check check (
    length(trim(approved_by_name)) > 0 and char_length(approved_by_name) <= 120
  ),
  constraint job_scope_change_approvals_email_len_check check (
    approved_by_email is null or char_length(approved_by_email) <= 254
  ),
  constraint job_scope_change_approvals_evidence_object_check check (
    evidence_json is null or jsonb_typeof(evidence_json) = 'object'
  )
);

comment on table public.job_scope_change_approvals is
  'Immutable customer authorization evidence for one scope change. One approval row per change. Apply-once.';

alter table public.job_scope_change_approvals
  add constraint job_scope_change_approvals_id_company_unique unique (id, company_id);

alter table public.job_scope_change_approvals
  add constraint job_scope_change_approvals_scope_unique unique (scope_change_id);

alter table public.job_scope_change_approvals
  add constraint job_scope_change_approvals_scope_company_unique unique (scope_change_id, company_id);

alter table public.job_scope_change_approvals
  add constraint job_scope_change_approvals_company_id_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

alter table public.job_scope_change_approvals
  add constraint job_scope_change_approvals_scope_company_fkey
  foreign key (scope_change_id, company_id)
  references public.job_scope_changes (id, company_id)
  on delete restrict;

-- Relies on proposal_signatures_id_company_unique (id, company_id).
alter table public.job_scope_change_approvals
  add constraint job_scope_change_approvals_signature_company_fkey
  foreign key (proposal_signature_id, company_id)
  references public.proposal_signatures (id, company_id)
  on delete restrict;

-- ---------------------------------------------------------------------------
-- 1b) Customer-review public access tokens (hash-only; never store raw token)
-- ---------------------------------------------------------------------------
create table if not exists public.job_scope_change_public_access_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id uuid not null,
  scope_change_id uuid not null,
  token_hash text not null,
  token_prefix text not null,
  status text not null default 'active',
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  last_viewed_at timestamptz null,
  metadata_json jsonb not null default '{}'::jsonb,
  constraint job_scope_change_public_access_tokens_status_check check (
    status = any (array['active'::text, 'revoked'::text])
  ),
  constraint job_scope_change_public_access_tokens_token_hash_format_check check (
    length(trim(token_hash)) = 64 and token_hash ~ '^[0-9a-f]+$'
  ),
  constraint job_scope_change_public_access_tokens_token_prefix_check check (
    length(trim(token_prefix)) >= 6 and length(trim(token_prefix)) <= 16
  ),
  constraint job_scope_change_public_access_tokens_expires_at_future_at_create check (
    expires_at > created_at
  ),
  constraint job_scope_change_public_access_tokens_revoked_consistency_check check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  ),
  constraint job_scope_change_public_access_tokens_metadata_object_check check (
    jsonb_typeof(metadata_json) = 'object'
  )
);

comment on table public.job_scope_change_public_access_tokens is
  'Astra G9 hash-only customer-review tokens bound to company+job+scope_change. Raw token never stored. Public resolve via service_role RPC only.';

comment on column public.job_scope_change_public_access_tokens.token_hash is
  'SHA-256 hex digest of high-entropy public token. Global lookup key. Never store raw token.';

comment on column public.job_scope_change_public_access_tokens.token_prefix is
  'Non-secret prefix of raw token for support/log correlation. Not sufficient for auth.';

alter table public.job_scope_change_public_access_tokens
  add constraint job_scope_change_public_access_tokens_id_company_unique unique (id, company_id);

alter table public.job_scope_change_public_access_tokens
  add constraint job_scope_change_public_access_tokens_token_hash_unique unique (token_hash);

alter table public.job_scope_change_public_access_tokens
  add constraint job_scope_change_public_access_tokens_company_id_fkey
  foreign key (company_id) references public.companies (id) on delete restrict;

-- Composite FK relies on public.idx_jobs_id_company_unique (id, company_id).
alter table public.job_scope_change_public_access_tokens
  add constraint job_scope_change_public_access_tokens_job_company_fkey
  foreign key (job_id, company_id) references public.jobs (id, company_id) on delete restrict;

alter table public.job_scope_change_public_access_tokens
  add constraint job_scope_change_public_access_tokens_scope_company_fkey
  foreign key (scope_change_id, company_id)
  references public.job_scope_changes (id, company_id)
  on delete restrict;

alter table public.job_scope_change_public_access_tokens
  add constraint job_scope_change_public_access_tokens_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- One active customer-review token per scope change (V1).
create unique index if not exists uq_job_scope_change_public_access_tokens_one_active
  on public.job_scope_change_public_access_tokens (company_id, scope_change_id)
  where status = 'active';

create index if not exists idx_job_scope_change_public_access_tokens_scope
  on public.job_scope_change_public_access_tokens (company_id, scope_change_id, status);

-- ---------------------------------------------------------------------------
-- 2) RLS (membership-scoped read; writes via security-definer RPCs only)
-- ---------------------------------------------------------------------------
alter table public.job_scope_changes enable row level security;
alter table public.job_scope_change_lines enable row level security;
alter table public.job_scope_change_approvals enable row level security;
alter table public.job_scope_change_public_access_tokens enable row level security;

create policy job_scope_changes_select_company_scope
  on public.job_scope_changes
  for select
  using (
    company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.removed_at is null
    )
  );

create policy job_scope_change_lines_select_company_scope
  on public.job_scope_change_lines
  for select
  using (
    company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.removed_at is null
    )
  );

create policy job_scope_change_approvals_select_company_scope
  on public.job_scope_change_approvals
  for select
  using (
    company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.removed_at is null
    )
  );

create policy job_scope_change_public_access_tokens_select_company_scope
  on public.job_scope_change_public_access_tokens
  for select
  using (
    company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
        and cm.removed_at is null
    )
  );

grant select on table public.job_scope_changes to authenticated;
grant select on table public.job_scope_change_lines to authenticated;
grant select on table public.job_scope_change_approvals to authenticated;
grant select on table public.job_scope_change_public_access_tokens to authenticated;

grant all on table public.job_scope_changes to service_role;
grant all on table public.job_scope_change_lines to service_role;
grant all on table public.job_scope_change_approvals to service_role;
grant all on table public.job_scope_change_public_access_tokens to service_role;

-- ---------------------------------------------------------------------------
-- 3) Same-company binding guards (acceptances ↔ proposals ↔ jobs)
-- ---------------------------------------------------------------------------
create or replace function public.job_scope_changes_binding_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_acceptance public.proposal_acceptances%rowtype;
  v_proposal public.proposals%rowtype;
begin
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'job_scope_changes.company_id is immutable';
  end if;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.id = new.base_acceptance_id
    and a.company_id = new.company_id;

  if not found then
    raise exception 'job_scope_changes base_acceptance_id must belong to company';
  end if;

  if v_acceptance.job_id is distinct from new.job_id
     or v_acceptance.proposal_id is distinct from new.base_proposal_id
     or v_acceptance.proposal_version_id is distinct from new.base_proposal_version_id then
    raise exception 'job_scope_changes base binding must match acceptance row';
  end if;

  select p.*
  into v_proposal
  from public.proposals p
  where p.id = new.base_proposal_id
    and p.company_id = new.company_id;

  if not found or v_proposal.job_id is distinct from new.job_id then
    raise exception 'job_scope_changes proposal must belong to same job/company';
  end if;

  return new;
end;
$$;

drop trigger if exists job_scope_changes_binding_guard on public.job_scope_changes;
create trigger job_scope_changes_binding_guard
  before insert or update on public.job_scope_changes
  for each row execute function public.job_scope_changes_binding_guard();

create or replace function public.job_scope_change_approvals_row_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Inserts are allowed (authorize RPC). Updates/deletes are blocked (immutable evidence).
  if tg_op = 'INSERT' then
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'job_scope_change_approvals rows cannot be deleted';
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'job_scope_change_approvals rows cannot be updated';
  end if;
  return null;
end;
$$;

drop trigger if exists job_scope_change_approvals_row_guard on public.job_scope_change_approvals;
create trigger job_scope_change_approvals_row_guard
  before insert or delete or update on public.job_scope_change_approvals
  for each row execute function public.job_scope_change_approvals_row_guard();

revoke all on function public.job_scope_changes_binding_guard() from public;
grant all on function public.job_scope_changes_binding_guard() to service_role;

revoke all on function public.job_scope_change_approvals_row_guard() from public;
grant all on function public.job_scope_change_approvals_row_guard() to service_role;

-- ---------------------------------------------------------------------------
-- 4) Contract total rollup (extends payment contractual authority)
-- ---------------------------------------------------------------------------
create or replace function public.job_contract_total_cents_v1(
  p_company_id uuid,
  p_job_id uuid
) returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select (
    coalesce(
      (
        select public.proposal_acceptance_contract_total_cents_v1(a.company_id, a.id)
        from public.proposal_acceptances a
        where a.company_id = p_company_id
          and a.job_id = p_job_id
        order by a.accepted_at desc, a.created_at desc, a.id desc
        limit 1
      ),
      0
    )
    + coalesce(
      (
        select sum(sc.price_delta_cents)::integer
        from public.job_scope_changes sc
        where sc.company_id = p_company_id
          and sc.job_id = p_job_id
          and sc.status = 'authorized'
          and sc.deleted_at is null
      ),
      0
    )
  )::integer;
$$;

comment on function public.job_contract_total_cents_v1(uuid, uuid) is
  'Astra G9 canonical job contract total: latest acceptance contractual cents + sum(authorized scope-change deltas). Does not rewrite acceptance rows.';

alter function public.job_contract_total_cents_v1(uuid, uuid) owner to postgres;

revoke all on function public.job_contract_total_cents_v1(uuid, uuid) from public;
grant all on function public.job_contract_total_cents_v1(uuid, uuid) to authenticated;
grant all on function public.job_contract_total_cents_v1(uuid, uuid) to service_role;

create or replace function public.job_payment_current_contractual_total_cents_v1(
  p_company_id uuid,
  p_job_id uuid
) returns integer
language sql
stable
set search_path to 'public'
as $$
  select public.job_contract_total_cents_v1(p_company_id, p_job_id);
$$;

comment on function public.job_payment_current_contractual_total_cents_v1(uuid, uuid) is
  'Current contractual total for a job (acceptance + authorized scope-change deltas). Historical payment-request snapshots remain immutable.';

-- ---------------------------------------------------------------------------
-- 5) Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.job_scope_change_member_ok_v1(
  p_company_id uuid,
  p_user_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = p_company_id
      and cm.user_id = p_user_id
      and cm.removed_at is null
  );
$$;

revoke all on function public.job_scope_change_member_ok_v1(uuid, uuid) from public;
grant all on function public.job_scope_change_member_ok_v1(uuid, uuid) to service_role;

create or replace function public.job_scope_change_lines_json_v1(
  p_company_id uuid,
  p_scope_change_id uuid
) returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'company_id', l.company_id,
        'scope_change_id', l.scope_change_id,
        'change_kind', l.change_kind,
        'description', l.description,
        'quantity', l.quantity,
        'unit', l.unit,
        'unit_price_cents', l.unit_price_cents,
        'line_delta_cents', l.line_delta_cents,
        'sort_order', l.sort_order
      )
      order by l.sort_order, l.id
    ),
    '[]'::jsonb
  )
  from public.job_scope_change_lines l
  where l.company_id = p_company_id
    and l.scope_change_id = p_scope_change_id;
$$;

revoke all on function public.job_scope_change_lines_json_v1(uuid, uuid) from public;
grant all on function public.job_scope_change_lines_json_v1(uuid, uuid) to authenticated;
grant all on function public.job_scope_change_lines_json_v1(uuid, uuid) to service_role;

create or replace function public.job_scope_change_row_json_v1(
  p_row public.job_scope_changes
) returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'company_id', p_row.company_id,
    'job_id', p_row.job_id,
    'base_proposal_id', p_row.base_proposal_id,
    'base_proposal_version_id', p_row.base_proposal_version_id,
    'base_acceptance_id', p_row.base_acceptance_id,
    'status', p_row.status,
    'reason', p_row.reason,
    'timing_note', p_row.timing_note,
    'price_delta_cents', p_row.price_delta_cents,
    'basis_contract_total_cents', p_row.basis_contract_total_cents,
    'proposed_at', p_row.proposed_at,
    'authorized_at', p_row.authorized_at,
    'declined_at', p_row.declined_at,
    'voided_at', p_row.voided_at,
    'created_by', p_row.created_by,
    'updated_by', p_row.updated_by,
    'row_version', p_row.row_version,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at,
    'deleted_at', p_row.deleted_at
  );
$$;

revoke all on function public.job_scope_change_row_json_v1(public.job_scope_changes) from public;
grant all on function public.job_scope_change_row_json_v1(public.job_scope_changes) to authenticated;
grant all on function public.job_scope_change_row_json_v1(public.job_scope_changes) to service_role;

create or replace function public.job_scope_change_replace_lines_v1(
  p_company_id uuid,
  p_scope_change_id uuid,
  p_lines jsonb
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_elem jsonb;
  v_kind text;
  v_description text;
  v_quantity numeric;
  v_unit text;
  v_unit_price integer;
  v_line_delta integer;
  v_sort integer;
  v_sum integer := 0;
  v_count integer := 0;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1 then
    raise exception 'scope_change_lines_required' using errcode = 'P0001';
  end if;

  delete from public.job_scope_change_lines
  where company_id = p_company_id
    and scope_change_id = p_scope_change_id;

  for v_elem in select * from jsonb_array_elements(p_lines)
  loop
    v_kind := lower(nullif(trim(v_elem->>'change_kind'), ''));
    v_description := nullif(trim(v_elem->>'description'), '');
    begin
      v_quantity := nullif(v_elem->>'quantity', '')::numeric;
      v_unit_price := nullif(v_elem->>'unit_price_cents', '')::integer;
      v_line_delta := nullif(v_elem->>'line_delta_cents', '')::integer;
      v_sort := coalesce(nullif(v_elem->>'sort_order', '')::integer, v_count);
    exception when others then
      raise exception 'invalid_scope_change_line' using errcode = 'P0001';
    end;
    v_unit := nullif(trim(v_elem->>'unit'), '');

    if v_kind is null or v_description is null or v_line_delta is null then
      raise exception 'invalid_scope_change_line' using errcode = 'P0001';
    end if;

    insert into public.job_scope_change_lines (
      company_id,
      scope_change_id,
      change_kind,
      description,
      quantity,
      unit,
      unit_price_cents,
      line_delta_cents,
      sort_order
    ) values (
      p_company_id,
      p_scope_change_id,
      v_kind,
      left(v_description, 240),
      v_quantity,
      case when v_unit is null then null else left(v_unit, 40) end,
      v_unit_price,
      v_line_delta,
      v_sort
    );

    v_sum := v_sum + v_line_delta;
    v_count := v_count + 1;
  end loop;

  return v_sum;
end;
$$;

revoke all on function public.job_scope_change_replace_lines_v1(uuid, uuid, jsonb) from public;
grant all on function public.job_scope_change_replace_lines_v1(uuid, uuid, jsonb) to service_role;

create or replace function public.job_scope_change_authoring_blocked_v1(
  p_job public.jobs
) returns text
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v_stage text;
begin
  if p_job.status in ('lost', 'closed') then
    return 'disposition_blocks_scope_change';
  end if;

  -- Safest active-work rule: no new commercial mutation while paused.
  if p_job.status = 'on_hold' then
    return 'disposition_blocks_scope_change';
  end if;

  v_stage := public.canonical_job_stage_from_row(
    p_job.stage,
    p_job.status,
    coalesce(p_job.archived, false),
    p_job.active_proposal_id,
    p_job.latest_proposal_id
  );

  if v_stage = 'complete' then
    return 'complete_blocks_scope_change';
  end if;

  return null;
end;
$$;

revoke all on function public.job_scope_change_authoring_blocked_v1(public.jobs) from public;
grant all on function public.job_scope_change_authoring_blocked_v1(public.jobs) to service_role;

-- ---------------------------------------------------------------------------
-- 6) RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_job_scope_change_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_reason text;
  v_timing_note text;
  v_lines jsonb;
  v_job public.jobs%rowtype;
  v_acceptance public.proposal_acceptances%rowtype;
  v_block text;
  v_basis integer;
  v_delta integer;
  v_now timestamptz := now();
  v_change public.job_scope_changes%rowtype;
  v_activity_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  v_reason := nullif(trim(p_payload->>'reason'), '');
  v_timing_note := nullif(trim(p_payload->>'timing_note'), '');
  v_lines := p_payload->'lines';

  if v_company_id is null or v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;
  if v_timing_note is not null and char_length(v_timing_note) > 240 then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not public.job_scope_change_member_ok_v1(v_company_id, v_uid) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
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

  v_block := public.job_scope_change_authoring_blocked_v1(v_job);
  if v_block is not null then
    return jsonb_build_object('ok', false, 'code', v_block);
  end if;

  select a.*
  into v_acceptance
  from public.proposal_acceptances a
  where a.company_id = v_company_id
    and a.job_id = v_job_id
  order by a.accepted_at desc, a.created_at desc, a.id desc
  limit 1
  for share;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'acceptance_required');
  end if;

  v_basis := public.job_contract_total_cents_v1(v_company_id, v_job_id);

  begin
    insert into public.job_scope_changes (
      company_id,
      job_id,
      base_proposal_id,
      base_proposal_version_id,
      base_acceptance_id,
      status,
      reason,
      timing_note,
      price_delta_cents,
      basis_contract_total_cents,
      created_by,
      updated_by,
      created_at,
      updated_at
    ) values (
      v_company_id,
      v_job_id,
      v_acceptance.proposal_id,
      v_acceptance.proposal_version_id,
      v_acceptance.id,
      'draft',
      v_reason,
      v_timing_note,
      0,
      v_basis,
      v_uid,
      v_uid,
      v_now,
      v_now
    )
    returning * into v_change;

    v_delta := public.job_scope_change_replace_lines_v1(v_company_id, v_change.id, v_lines);

    update public.job_scope_changes
    set
      price_delta_cents = v_delta,
      updated_at = v_now
    where id = v_change.id
      and company_id = v_company_id
    returning * into v_change;
  exception
    when sqlstate 'P0001' then
      return jsonb_build_object('ok', false, 'code', sqlerrm);
    when check_violation then
      return jsonb_build_object('ok', false, 'code', 'invalid_scope_change_line');
  end;

  update public.jobs
  set last_activity_at = v_now
  where id = v_job_id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'scope_change_created',
    v_uid,
    jsonb_build_object(
      'scope_change_id', v_change.id,
      'from_status', null,
      'to_status', 'draft',
      'price_delta_cents', v_change.price_delta_cents,
      'basis_contract_total_cents', v_change.basis_contract_total_cents,
      'base_acceptance_id', v_change.base_acceptance_id,
      'base_proposal_id', v_change.base_proposal_id,
      'base_proposal_version_id', v_change.base_proposal_version_id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'scope_change', public.job_scope_change_row_json_v1(v_change),
    'lines', public.job_scope_change_lines_json_v1(v_company_id, v_change.id),
    'contract_total_cents', v_basis,
    'proposed_new_total_cents', v_basis + v_change.price_delta_cents,
    'activity_id', v_activity_id
  );
end;
$$;

comment on function public.create_job_scope_change_v1(jsonb) is
  'Create draft scope change with structured lines. Requires live accepted agreement; blocks Complete stage and lost/closed/on_hold disposition.';

create or replace function public.update_job_scope_change_draft_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_scope_change_id uuid;
  v_expected integer;
  v_reason text;
  v_timing_note text;
  v_lines jsonb;
  v_has_reason boolean := false;
  v_has_timing boolean := false;
  v_has_lines boolean := false;
  v_job public.jobs%rowtype;
  v_change public.job_scope_changes%rowtype;
  v_block text;
  v_delta integer;
  v_now timestamptz := now();
  v_live_total integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_scope_change_id := nullif(p_payload->>'scope_change_id', '')::uuid;
    v_expected := nullif(p_payload->>'expected_row_version', '')::integer;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_scope_change_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  v_has_reason := p_payload ? 'reason';
  v_has_timing := p_payload ? 'timing_note';
  v_has_lines := p_payload ? 'lines';

  if v_has_reason then
    v_reason := nullif(trim(p_payload->>'reason'), '');
    if v_reason is not null and char_length(v_reason) > 500 then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
  end if;
  if v_has_timing then
    v_timing_note := nullif(trim(p_payload->>'timing_note'), '');
    if v_timing_note is not null and char_length(v_timing_note) > 240 then
      return jsonb_build_object('ok', false, 'code', 'invalid_payload');
    end if;
  end if;
  if v_has_lines then
    v_lines := p_payload->'lines';
  end if;

  if not public.job_scope_change_member_ok_v1(v_company_id, v_uid) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
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

  v_block := public.job_scope_change_authoring_blocked_v1(v_job);
  if v_block is not null then
    return jsonb_build_object('ok', false, 'code', v_block);
  end if;

  select sc.*
  into v_change
  from public.job_scope_changes sc
  where sc.id = v_scope_change_id
    and sc.company_id = v_company_id
    and sc.job_id = v_job_id
    and sc.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_change.status <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'not_draft');
  end if;

  if v_expected is not null and v_change.row_version is distinct from v_expected then
    return jsonb_build_object(
      'ok', false,
      'code', 'row_version_conflict',
      'row_version', v_change.row_version
    );
  end if;

  begin
    if v_has_lines then
      v_delta := public.job_scope_change_replace_lines_v1(v_company_id, v_change.id, v_lines);
    else
      select coalesce(sum(l.line_delta_cents), 0)::integer
      into v_delta
      from public.job_scope_change_lines l
      where l.company_id = v_company_id
        and l.scope_change_id = v_change.id;
    end if;

    update public.job_scope_changes
    set
      reason = case when v_has_reason then v_reason else reason end,
      timing_note = case when v_has_timing then v_timing_note else timing_note end,
      price_delta_cents = v_delta,
      -- Re-stamp basis on draft edit so propose starts from current truth.
      basis_contract_total_cents = public.job_contract_total_cents_v1(v_company_id, v_job_id),
      updated_by = v_uid,
      updated_at = v_now,
      row_version = row_version + 1
    where id = v_change.id
      and company_id = v_company_id
    returning * into v_change;
  exception
    when sqlstate 'P0001' then
      return jsonb_build_object('ok', false, 'code', sqlerrm);
    when check_violation then
      return jsonb_build_object('ok', false, 'code', 'invalid_scope_change_line');
  end;

  v_live_total := public.job_contract_total_cents_v1(v_company_id, v_job_id);

  return jsonb_build_object(
    'ok', true,
    'scope_change', public.job_scope_change_row_json_v1(v_change),
    'lines', public.job_scope_change_lines_json_v1(v_company_id, v_change.id),
    'contract_total_cents', v_live_total,
    'proposed_new_total_cents', v_live_total + v_change.price_delta_cents
  );
end;
$$;

comment on function public.update_job_scope_change_draft_v1(jsonb) is
  'Replace draft lines/reason/timing_note only. Re-stamps basis_contract_total_cents to live rollup.';

create or replace function public.propose_job_scope_change_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_scope_change_id uuid;
  v_expected integer;
  v_job public.jobs%rowtype;
  v_change public.job_scope_changes%rowtype;
  v_block text;
  v_live_total integer;
  v_line_count integer;
  v_now timestamptz := now();
  v_activity_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_scope_change_id := nullif(p_payload->>'scope_change_id', '')::uuid;
    v_expected := nullif(p_payload->>'expected_row_version', '')::integer;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_scope_change_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not public.job_scope_change_member_ok_v1(v_company_id, v_uid) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtext('job_scope_change_propose:' || v_company_id::text),
    hashtext(v_job_id::text)
  );

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

  v_block := public.job_scope_change_authoring_blocked_v1(v_job);
  if v_block is not null then
    return jsonb_build_object('ok', false, 'code', v_block);
  end if;

  select sc.*
  into v_change
  from public.job_scope_changes sc
  where sc.id = v_scope_change_id
    and sc.company_id = v_company_id
    and sc.job_id = v_job_id
    and sc.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_change.status = 'proposed' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'scope_change', public.job_scope_change_row_json_v1(v_change),
      'lines', public.job_scope_change_lines_json_v1(v_company_id, v_change.id),
      'contract_total_cents', public.job_contract_total_cents_v1(v_company_id, v_job_id),
      'proposed_new_total_cents', public.job_contract_total_cents_v1(v_company_id, v_job_id) + v_change.price_delta_cents,
      'activity_id', null
    );
  end if;

  if v_change.status <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'illegal_transition');
  end if;

  if v_expected is not null and v_change.row_version is distinct from v_expected then
    return jsonb_build_object(
      'ok', false,
      'code', 'row_version_conflict',
      'row_version', v_change.row_version
    );
  end if;

  select count(*)::integer
  into v_line_count
  from public.job_scope_change_lines l
  where l.company_id = v_company_id
    and l.scope_change_id = v_change.id;

  if v_line_count < 1 then
    return jsonb_build_object('ok', false, 'code', 'scope_change_lines_required');
  end if;

  v_live_total := public.job_contract_total_cents_v1(v_company_id, v_job_id);
  if v_live_total is distinct from v_change.basis_contract_total_cents then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale_basis',
      'basis_contract_total_cents', v_change.basis_contract_total_cents,
      'live_contract_total_cents', v_live_total
    );
  end if;

  if exists (
    select 1
    from public.job_scope_changes sc
    where sc.company_id = v_company_id
      and sc.job_id = v_job_id
      and sc.status = 'proposed'
      and sc.deleted_at is null
      and sc.id <> v_change.id
  ) then
    return jsonb_build_object('ok', false, 'code', 'proposed_already_exists');
  end if;

  update public.job_scope_changes
  set
    status = 'proposed',
    proposed_at = v_now,
    updated_by = v_uid,
    updated_at = v_now,
    row_version = row_version + 1
  where id = v_change.id
    and company_id = v_company_id
  returning * into v_change;

  update public.jobs
  set last_activity_at = v_now
  where id = v_job_id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'scope_change_proposed',
    v_uid,
    jsonb_build_object(
      'scope_change_id', v_change.id,
      'from_status', 'draft',
      'to_status', 'proposed',
      'price_delta_cents', v_change.price_delta_cents,
      'basis_contract_total_cents', v_change.basis_contract_total_cents,
      'proposed_new_total_cents', v_live_total + v_change.price_delta_cents,
      'base_acceptance_id', v_change.base_acceptance_id,
      'base_proposal_version_id', v_change.base_proposal_version_id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'scope_change', public.job_scope_change_row_json_v1(v_change),
    'lines', public.job_scope_change_lines_json_v1(v_company_id, v_change.id),
    'contract_total_cents', v_live_total,
    'proposed_new_total_cents', v_live_total + v_change.price_delta_cents,
    'activity_id', v_activity_id
  );
end;
$$;

comment on function public.propose_job_scope_change_v1(jsonb) is
  'draft→proposed freeze. Stale-basis and one-proposed-per-job enforced. Does not change contract total.';

create or replace function public.authorize_job_scope_change_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company_id uuid;
  v_job_id uuid;
  v_scope_change_id uuid;
  v_name text;
  v_email text;
  v_method text;
  v_evidence jsonb;
  v_signature_id uuid;
  v_token_hash text;
  v_token public.job_scope_change_public_access_tokens%rowtype;
  v_job public.jobs%rowtype;
  v_change public.job_scope_changes%rowtype;
  v_approval public.job_scope_change_approvals%rowtype;
  v_live_total integer;
  v_new_total integer;
  v_gross integer;
  v_open_requests integer;
  v_now timestamptz := now();
  v_activity_id uuid;
begin
  -- Public customer path: Next.js calls with service_role. No auth.uid() required.
  -- token_hash is REQUIRED and must bind exactly to company+job+scope_change.
  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_scope_change_id := nullif(p_payload->>'scope_change_id', '')::uuid;
    v_signature_id := nullif(p_payload->>'proposal_signature_id', '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  v_name := nullif(trim(p_payload->>'approved_by_name'), '');
  v_email := nullif(trim(p_payload->>'approved_by_email'), '');
  v_method := coalesce(nullif(trim(p_payload->>'approval_method'), ''), 'public_token');
  v_evidence := p_payload->'evidence_json';
  v_token_hash := lower(trim(coalesce(p_payload->>'token_hash', '')));

  if v_company_id is null or v_job_id is null or v_scope_change_id is null or v_name is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_token_hash is null or length(v_token_hash) <> 64 or v_token_hash !~ '^[0-9a-f]+$' then
    return jsonb_build_object('ok', false, 'code', 'token_required');
  end if;

  if v_method <> 'public_token' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if v_evidence is not null and jsonb_typeof(v_evidence) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  perform pg_advisory_xact_lock(
    hashtext('job_scope_change_authorize:' || v_scope_change_id::text),
    hashtext(v_company_id::text)
  );

  select t.*
  into v_token
  from public.job_scope_change_public_access_tokens t
  where t.token_hash = v_token_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  if v_token.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  if v_token.expires_at <= v_now then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  if v_token.company_id is distinct from v_company_id
     or v_token.job_id is distinct from v_job_id
     or v_token.scope_change_id is distinct from v_scope_change_id then
    return jsonb_build_object('ok', false, 'code', 'token_binding_mismatch');
  end if;

  v_evidence := coalesce(v_evidence, '{}'::jsonb) || jsonb_build_object(
    'public_access_token_id', v_token.id,
    'token_prefix', v_token.token_prefix
  );

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

  select sc.*
  into v_change
  from public.job_scope_changes sc
  where sc.id = v_scope_change_id
    and sc.company_id = v_company_id
    and sc.job_id = v_job_id
    and sc.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_change.status = 'authorized' then
    select ap.*
    into v_approval
    from public.job_scope_change_approvals ap
    where ap.company_id = v_company_id
      and ap.scope_change_id = v_change.id;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'scope_change', public.job_scope_change_row_json_v1(v_change),
      'lines', public.job_scope_change_lines_json_v1(v_company_id, v_change.id),
      'approval_id', v_approval.id,
      'contract_total_cents', public.job_contract_total_cents_v1(v_company_id, v_job_id),
      'activity_id', null
    );
  end if;

  if v_change.status <> 'proposed' then
    return jsonb_build_object('ok', false, 'code', 'illegal_transition');
  end if;

  v_live_total := public.job_contract_total_cents_v1(v_company_id, v_job_id);
  if v_live_total is distinct from v_change.basis_contract_total_cents then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale_basis',
      'basis_contract_total_cents', v_change.basis_contract_total_cents,
      'live_contract_total_cents', v_live_total
    );
  end if;

  v_new_total := v_live_total + v_change.price_delta_cents;
  if v_new_total < 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'financial_conflict',
      'reason', 'negative_contract_total',
      'live_contract_total_cents', v_live_total,
      'price_delta_cents', v_change.price_delta_cents,
      'proposed_new_total_cents', v_new_total
    );
  end if;

  if v_change.price_delta_cents < 0 then
    v_gross := public.job_payment_gross_received_cents_v1(v_company_id, v_job_id);
    if v_new_total < v_gross then
      return jsonb_build_object(
        'ok', false,
        'code', 'financial_conflict',
        'reason', 'below_collected_gross',
        'live_contract_total_cents', v_live_total,
        'price_delta_cents', v_change.price_delta_cents,
        'proposed_new_total_cents', v_new_total,
        'gross_received_cents', v_gross
      );
    end if;

    select coalesce(sum(r.amount_cents), 0)::integer
    into v_open_requests
    from public.job_payment_requests r
    where r.company_id = v_company_id
      and r.job_id = v_job_id
      and r.status in ('open', 'processing');

    if v_new_total < v_open_requests then
      return jsonb_build_object(
        'ok', false,
        'code', 'financial_conflict',
        'reason', 'below_open_payment_requests',
        'live_contract_total_cents', v_live_total,
        'price_delta_cents', v_change.price_delta_cents,
        'proposed_new_total_cents', v_new_total,
        'open_payment_request_cents', v_open_requests
      );
    end if;
  end if;

  if v_signature_id is not null then
    if not exists (
      select 1
      from public.proposal_signatures s
      where s.id = v_signature_id
        and s.company_id = v_company_id
        and s.job_id = v_job_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'invalid_signature');
    end if;
  end if;

  insert into public.job_scope_change_approvals (
    company_id,
    scope_change_id,
    approved_at,
    approved_by_name,
    approved_by_email,
    approval_method,
    evidence_json,
    proposal_signature_id
  ) values (
    v_company_id,
    v_change.id,
    v_now,
    left(v_name, 120),
    case when v_email is null then null else left(v_email, 254) end,
    'public_token',
    v_evidence,
    v_signature_id
  )
  returning * into v_approval;

  update public.job_scope_changes
  set
    status = 'authorized',
    authorized_at = v_now,
    updated_at = v_now,
    row_version = row_version + 1
  where id = v_change.id
    and company_id = v_company_id
  returning * into v_change;

  update public.jobs
  set last_activity_at = v_now
  where id = v_job_id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'scope_change_authorized',
    null,
    jsonb_build_object(
      'scope_change_id', v_change.id,
      'from_status', 'proposed',
      'to_status', 'authorized',
      'price_delta_cents', v_change.price_delta_cents,
      'basis_contract_total_cents', v_change.basis_contract_total_cents,
      'resulting_contract_total_cents', v_new_total,
      'approval_id', v_approval.id,
      'base_acceptance_id', v_change.base_acceptance_id,
      'base_proposal_version_id', v_change.base_proposal_version_id
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'scope_change', public.job_scope_change_row_json_v1(v_change),
    'lines', public.job_scope_change_lines_json_v1(v_company_id, v_change.id),
    'approval_id', v_approval.id,
    'contract_total_cents', public.job_contract_total_cents_v1(v_company_id, v_job_id),
    'activity_id', v_activity_id
  );
end;
$$;

comment on function public.authorize_job_scope_change_v1(jsonb) is
  'proposed→authorized apply-once. Requires token_hash bound to company+job+scope_change. Stale-basis + financial-conflict guards. service_role only.';

create or replace function public.decline_job_scope_change_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_scope_change_id uuid;
  v_expected integer;
  v_change public.job_scope_changes%rowtype;
  v_now timestamptz := now();
  v_activity_id uuid;
  v_actor uuid;
  v_is_service boolean := false;
begin
  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_scope_change_id := nullif(p_payload->>'scope_change_id', '')::uuid;
    v_expected := nullif(p_payload->>'expected_row_version', '')::integer;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_scope_change_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  -- Allow authenticated contractor decline OR service_role public decline.
  v_is_service := (current_setting('request.jwt.claim.role', true) = 'service_role')
    or (auth.role() = 'service_role');

  if v_uid is null and not v_is_service then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  if v_uid is not null and not public.job_scope_change_member_ok_v1(v_company_id, v_uid) and not v_is_service then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  v_actor := v_uid;

  perform pg_advisory_xact_lock(
    hashtext('job_scope_change_authorize:' || v_scope_change_id::text),
    hashtext(v_company_id::text)
  );

  select sc.*
  into v_change
  from public.job_scope_changes sc
  where sc.id = v_scope_change_id
    and sc.company_id = v_company_id
    and sc.job_id = v_job_id
    and sc.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_change.status = 'declined' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'scope_change', public.job_scope_change_row_json_v1(v_change),
      'activity_id', null
    );
  end if;

  if v_change.status <> 'proposed' then
    return jsonb_build_object('ok', false, 'code', 'illegal_transition');
  end if;

  if v_expected is not null and v_change.row_version is distinct from v_expected then
    return jsonb_build_object(
      'ok', false,
      'code', 'row_version_conflict',
      'row_version', v_change.row_version
    );
  end if;

  update public.job_scope_changes
  set
    status = 'declined',
    declined_at = v_now,
    updated_by = coalesce(v_actor, updated_by),
    updated_at = v_now,
    row_version = row_version + 1
  where id = v_change.id
    and company_id = v_company_id
  returning * into v_change;

  update public.jobs
  set last_activity_at = v_now
  where id = v_job_id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'scope_change_declined',
    v_actor,
    jsonb_build_object(
      'scope_change_id', v_change.id,
      'from_status', 'proposed',
      'to_status', 'declined',
      'price_delta_cents', v_change.price_delta_cents,
      'basis_contract_total_cents', v_change.basis_contract_total_cents
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'scope_change', public.job_scope_change_row_json_v1(v_change),
    'activity_id', v_activity_id
  );
end;
$$;

create or replace function public.void_job_scope_change_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_scope_change_id uuid;
  v_expected integer;
  v_change public.job_scope_changes%rowtype;
  v_from text;
  v_now timestamptz := now();
  v_activity_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_scope_change_id := nullif(p_payload->>'scope_change_id', '')::uuid;
    v_expected := nullif(p_payload->>'expected_row_version', '')::integer;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null or v_scope_change_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if not public.job_scope_change_member_ok_v1(v_company_id, v_uid) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select sc.*
  into v_change
  from public.job_scope_changes sc
  where sc.id = v_scope_change_id
    and sc.company_id = v_company_id
    and sc.job_id = v_job_id
    and sc.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_change.status = 'voided' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'scope_change', public.job_scope_change_row_json_v1(v_change),
      'activity_id', null
    );
  end if;

  if v_change.status not in ('draft', 'proposed') then
    return jsonb_build_object('ok', false, 'code', 'illegal_transition');
  end if;

  if v_expected is not null and v_change.row_version is distinct from v_expected then
    return jsonb_build_object(
      'ok', false,
      'code', 'row_version_conflict',
      'row_version', v_change.row_version
    );
  end if;

  v_from := v_change.status;

  update public.job_scope_changes
  set
    status = 'voided',
    voided_at = v_now,
    updated_by = v_uid,
    updated_at = v_now,
    row_version = row_version + 1
  where id = v_change.id
    and company_id = v_company_id
  returning * into v_change;

  update public.jobs
  set last_activity_at = v_now
  where id = v_job_id
    and company_id = v_company_id;

  v_activity_id := public.job_lifecycle_insert_activity(
    v_company_id,
    v_job_id,
    'scope_change_voided',
    v_uid,
    jsonb_build_object(
      'scope_change_id', v_change.id,
      'from_status', v_from,
      'to_status', 'voided',
      'price_delta_cents', v_change.price_delta_cents,
      'basis_contract_total_cents', v_change.basis_contract_total_cents
    ),
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'scope_change', public.job_scope_change_row_json_v1(v_change),
    'activity_id', v_activity_id
  );
end;
$$;

comment on function public.void_job_scope_change_v1(jsonb) is
  'draft|proposed → voided. History retained; no contract/field effect.';

create or replace function public.job_scope_change_author_ok_v1(
  p_company_id uuid,
  p_user_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  -- Mirrors app proposal_author: owner / admin / office_sales only.
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = p_company_id
      and cm.user_id = p_user_id
      and cm.removed_at is null
      and lower(cm.role) in ('owner', 'admin', 'office_sales')
  );
$fn$;

revoke all on function public.job_scope_change_author_ok_v1(uuid, uuid) from public;
grant all on function public.job_scope_change_author_ok_v1(uuid, uuid) to service_role;

create or replace function public.mint_job_scope_change_public_access_token_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_scope_change_id uuid;
  v_hash text;
  v_prefix text;
  v_expires_at timestamptz;
  v_metadata jsonb;
  v_change public.job_scope_changes%rowtype;
  v_existing public.job_scope_change_public_access_tokens%rowtype;
  v_inserted public.job_scope_change_public_access_tokens%rowtype;
  v_now timestamptz := now();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_scope_change_id := nullif(p_payload->>'scope_change_id', '')::uuid;
    v_expires_at := nullif(p_payload->>'expires_at', '')::timestamptz;
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  v_hash := lower(trim(coalesce(p_payload->>'token_hash', '')));
  v_prefix := trim(coalesce(p_payload->>'token_prefix', ''));
  v_metadata := coalesce(p_payload->'metadata_json', '{}'::jsonb);

  if v_company_id is null or v_job_id is null or v_scope_change_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if length(v_hash) <> 64 or v_hash !~ '^[0-9a-f]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_hash');
  end if;

  if length(v_prefix) < 6 or length(v_prefix) > 16 then
    return jsonb_build_object('ok', false, 'code', 'invalid_prefix');
  end if;

  if v_expires_at is null or v_expires_at <= v_now then
    return jsonb_build_object('ok', false, 'code', 'invalid_expires_at');
  end if;

  if jsonb_typeof(v_metadata) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  -- Never accept raw token keys in metadata.
  if v_metadata ? 'token'
     or v_metadata ? 'raw_token'
     or v_metadata ? 'token_hash'
     or v_metadata ? 'access_token' then
    return jsonb_build_object('ok', false, 'code', 'forbidden_metadata_keys');
  end if;

  if not public.job_scope_change_author_ok_v1(v_company_id, v_uid) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select sc.*
  into v_change
  from public.job_scope_changes sc
  where sc.id = v_scope_change_id
    and sc.company_id = v_company_id
    and sc.job_id = v_job_id
    and sc.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_change.status <> 'proposed' then
    return jsonb_build_object('ok', false, 'code', 'not_proposed');
  end if;

  -- Idempotent: same hash already bound to this scope change.
  select t.*
  into v_existing
  from public.job_scope_change_public_access_tokens t
  where t.token_hash = v_hash
  for update;

  if found then
    if v_existing.company_id is distinct from v_company_id
       or v_existing.job_id is distinct from v_job_id
       or v_existing.scope_change_id is distinct from v_scope_change_id then
      return jsonb_build_object('ok', false, 'code', 'duplicate_token_hash');
    end if;
    if v_existing.status = 'active' and v_existing.expires_at > v_now then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'token_id', v_existing.id,
        'token_prefix', v_existing.token_prefix,
        'expires_at', v_existing.expires_at,
        'status', v_existing.status
      );
    end if;
    -- Same hash but revoked/expired: reject reuse of that digest.
    return jsonb_build_object('ok', false, 'code', 'duplicate_token_hash');
  end if;

  -- Supersede: revoke any other active token for this scope change.
  update public.job_scope_change_public_access_tokens
  set
    status = 'revoked',
    revoked_at = v_now
  where company_id = v_company_id
    and scope_change_id = v_scope_change_id
    and status = 'active';

  insert into public.job_scope_change_public_access_tokens (
    company_id,
    job_id,
    scope_change_id,
    token_hash,
    token_prefix,
    status,
    expires_at,
    created_by,
    created_at,
    metadata_json
  ) values (
    v_company_id,
    v_job_id,
    v_scope_change_id,
    v_hash,
    v_prefix,
    'active',
    v_expires_at,
    v_uid,
    v_now,
    v_metadata
  )
  returning * into v_inserted;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'token_id', v_inserted.id,
    'token_prefix', v_inserted.token_prefix,
    'expires_at', v_inserted.expires_at,
    'status', v_inserted.status
  );
end;
$fn$;

comment on function public.mint_job_scope_change_public_access_token_v1(jsonb) is
  'Mint hash-only customer-review token for a proposed scope change. App hashes raw token. Never returns token_hash or raw token. proposal_author roles only.';

create or replace function public.resolve_job_scope_change_public_access_token_v1(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_hash text;
  v_token public.job_scope_change_public_access_tokens%rowtype;
  v_change public.job_scope_changes%rowtype;
  v_now timestamptz := now();
begin
  v_hash := lower(trim(coalesce(p_token_hash, '')));
  if length(v_hash) <> 64 or v_hash !~ '^[0-9a-f]+$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_hash');
  end if;

  select t.*
  into v_token
  from public.job_scope_change_public_access_tokens t
  where t.token_hash = v_hash
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_token.status = 'revoked' then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;

  if v_token.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_token.expires_at <= v_now then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  select sc.*
  into v_change
  from public.job_scope_changes sc
  where sc.id = v_token.scope_change_id
    and sc.company_id = v_token.company_id
    and sc.job_id = v_token.job_id
    and sc.deleted_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if v_change.status <> 'proposed' then
    return jsonb_build_object(
      'ok', false,
      'code', 'illegal_transition',
      'scope_change_status', v_change.status
    );
  end if;

  update public.job_scope_change_public_access_tokens
  set last_viewed_at = v_now
  where id = v_token.id
    and company_id = v_token.company_id;

  return jsonb_build_object(
    'ok', true,
    'token_id', v_token.id,
    'company_id', v_token.company_id,
    'job_id', v_token.job_id,
    'scope_change_id', v_token.scope_change_id,
    'token_prefix', v_token.token_prefix,
    'expires_at', v_token.expires_at,
    'scope_change', public.job_scope_change_row_json_v1(v_change),
    'lines', public.job_scope_change_lines_json_v1(v_token.company_id, v_change.id),
    'contract_total_cents', public.job_contract_total_cents_v1(v_token.company_id, v_token.job_id),
    'proposed_new_total_cents', public.job_contract_total_cents_v1(v_token.company_id, v_token.job_id) + v_change.price_delta_cents
  );
end;
$fn$;

comment on function public.resolve_job_scope_change_public_access_token_v1(text) is
  'Resolve hash-only scope-change customer token to company/job/scope_change bindings + review envelope. service_role only. Never returns token_hash.';

-- Ensure activity helper remains executable by postgres-owned security definer RPCs.
grant all on function public.job_lifecycle_insert_activity(uuid, uuid, text, uuid, jsonb, timestamptz) to postgres;
grant all on function public.job_lifecycle_insert_activity(uuid, uuid, text, uuid, jsonb, timestamptz) to service_role;

-- Ownership + grants
alter function public.create_job_scope_change_v1(jsonb) owner to postgres;
alter function public.update_job_scope_change_draft_v1(jsonb) owner to postgres;
alter function public.propose_job_scope_change_v1(jsonb) owner to postgres;
alter function public.authorize_job_scope_change_v1(jsonb) owner to postgres;
alter function public.decline_job_scope_change_v1(jsonb) owner to postgres;
alter function public.void_job_scope_change_v1(jsonb) owner to postgres;
alter function public.mint_job_scope_change_public_access_token_v1(jsonb) owner to postgres;
alter function public.resolve_job_scope_change_public_access_token_v1(text) owner to postgres;
alter function public.job_scope_change_author_ok_v1(uuid, uuid) owner to postgres;

revoke all on function public.create_job_scope_change_v1(jsonb) from public;
grant all on function public.create_job_scope_change_v1(jsonb) to authenticated;
grant all on function public.create_job_scope_change_v1(jsonb) to service_role;

revoke all on function public.update_job_scope_change_draft_v1(jsonb) from public;
grant all on function public.update_job_scope_change_draft_v1(jsonb) to authenticated;
grant all on function public.update_job_scope_change_draft_v1(jsonb) to service_role;

revoke all on function public.propose_job_scope_change_v1(jsonb) from public;
grant all on function public.propose_job_scope_change_v1(jsonb) to authenticated;
grant all on function public.propose_job_scope_change_v1(jsonb) to service_role;

revoke all on function public.authorize_job_scope_change_v1(jsonb) from public;
-- Public customer authorize only via service_role (Next.js route with admin client).
grant all on function public.authorize_job_scope_change_v1(jsonb) to service_role;

revoke all on function public.decline_job_scope_change_v1(jsonb) from public;
grant all on function public.decline_job_scope_change_v1(jsonb) to authenticated;
grant all on function public.decline_job_scope_change_v1(jsonb) to service_role;

revoke all on function public.void_job_scope_change_v1(jsonb) from public;
grant all on function public.void_job_scope_change_v1(jsonb) to authenticated;
grant all on function public.void_job_scope_change_v1(jsonb) to service_role;

revoke all on function public.mint_job_scope_change_public_access_token_v1(jsonb) from public;
grant all on function public.mint_job_scope_change_public_access_token_v1(jsonb) to authenticated;
grant all on function public.mint_job_scope_change_public_access_token_v1(jsonb) to service_role;

revoke all on function public.resolve_job_scope_change_public_access_token_v1(text) from public;
-- Customer resolve only via service_role (Next.js hashes raw URL token).
grant all on function public.resolve_job_scope_change_public_access_token_v1(text) to service_role;
