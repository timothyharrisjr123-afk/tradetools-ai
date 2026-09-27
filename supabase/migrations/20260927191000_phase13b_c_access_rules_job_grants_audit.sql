-- Phase 13B-C — membership access state, sparse rules, Field job access, audit.
--
-- company_memberships gains the base-profile version, a monotonic access revision
-- (stale-edit guard), and disable provenance. Existing rows keep profile v1 and
-- revision 1; no existing member gains authority.
--
-- company_member_access_rules  sparse exceptions to the base profile. Grants carry
--                              packages only (launch); restrictions may target a
--                              package or a capability. Typed scope, validity window,
--                              authority source, soft revoke, revision stamp.
-- job_access_grants            Field job visibility/action scope (blueprint §8.3).
--                              Not production responsibility, task assignment,
--                              scheduling, or lifecycle truth.
-- company_access_events        append-only audit, written in the same transaction as
--                              the access change it records. No tokens or secrets.
--
-- All three: RLS on, no policies, no client grants. Mutations go through SECURITY
-- DEFINER RPCs (migration 20260927195000).

alter table public.company_memberships
  add column role_profile_version integer not null default 1,
  add column access_revision bigint not null default 1,
  add column disabled_by uuid references auth.users (id) on delete set null,
  add column disabled_reason text;

alter table public.company_memberships
  add constraint company_memberships_access_revision_chk check (access_revision >= 1),
  add constraint company_memberships_disabled_reason_len_chk
    check (disabled_reason is null or char_length(disabled_reason) <= 500),
  add constraint company_memberships_role_profile_fk
    foreign key (role, role_profile_version)
    references public.access_role_profiles (role_key, version);

-- ---------------------------------------------------------------------------
-- Sparse access rules
-- ---------------------------------------------------------------------------
create table public.company_member_access_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null,
  effect text not null check (effect in ('grant', 'restrict')),
  package_key text references public.access_packages (package_key),
  capability_key text references public.access_capabilities (capability_key),
  scope_kind text not null check (scope_kind in ('company', 'granted_jobs', 'job')),
  scope_job_id uuid references public.jobs (id) on delete cascade,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  authority_source text not null check (
    authority_source in ('owner', 'admin_ceiling', 'production_ceiling', 'migration_preserve', 'system')
  ),
  reason text check (reason is null or char_length(reason) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  access_revision bigint not null check (access_revision >= 1),
  foreign key (user_id, company_id)
    references public.company_memberships (user_id, company_id) on delete cascade,
  constraint company_member_access_rules_target_chk
    check ((package_key is null) <> (capability_key is null)),
  constraint company_member_access_rules_grant_package_chk
    check (effect = 'restrict' or package_key is not null),
  constraint company_member_access_rules_scope_job_chk
    check ((scope_kind = 'job') = (scope_job_id is not null)),
  constraint company_member_access_rules_window_chk
    check (valid_until is null or valid_until > valid_from),
  constraint company_member_access_rules_revoke_chk
    check (revoked_by is null or revoked_at is not null)
);

create unique index company_member_access_rules_active_uidx
  on public.company_member_access_rules (
    company_id, user_id, effect,
    coalesce(package_key, ''), coalesce(capability_key, ''),
    scope_kind, coalesce(scope_job_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where revoked_at is null;

create index company_member_access_rules_member_idx
  on public.company_member_access_rules (company_id, user_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Field job access
-- ---------------------------------------------------------------------------
create table public.job_access_grants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  source text not null check (source in ('manual', 'task_assignment', 'production_lead_assignment', 'migration')),
  foreign key (user_id, company_id)
    references public.company_memberships (user_id, company_id) on delete cascade
);

create unique index job_access_grants_active_uidx
  on public.job_access_grants (job_id, user_id)
  where revoked_at is null;

create index job_access_grants_member_idx
  on public.job_access_grants (company_id, user_id)
  where revoked_at is null;

-- Tenant consistency: the grant's company must be the job's company, and a rule's
-- scope_job_id must belong to the rule's company.
create or replace function private.job_access_grants_tenant_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.jobs j where j.id = new.job_id and j.company_id = new.company_id
  ) then
    raise exception 'job_access_grants: job does not belong to company' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (
    new.company_id is distinct from old.company_id
    or new.job_id is distinct from old.job_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'job_access_grants: identity columns are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger job_access_grants_tenant
  before insert or update on public.job_access_grants
  for each row execute function private.job_access_grants_tenant_trg_v1();

create or replace function private.company_member_access_rules_tenant_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.scope_job_id is not null and not exists (
    select 1 from public.jobs j where j.id = new.scope_job_id and j.company_id = new.company_id
  ) then
    raise exception 'company_member_access_rules: scope job does not belong to company' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (
    new.company_id is distinct from old.company_id
    or new.user_id is distinct from old.user_id
    or new.effect is distinct from old.effect
    or new.package_key is distinct from old.package_key
    or new.capability_key is distinct from old.capability_key
    or new.scope_kind is distinct from old.scope_kind
    or new.scope_job_id is distinct from old.scope_job_id
  ) then
    raise exception 'company_member_access_rules: rule content is immutable; revoke and recreate' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger company_member_access_rules_tenant
  before insert or update on public.company_member_access_rules
  for each row execute function private.company_member_access_rules_tenant_trg_v1();

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create table public.company_access_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  event_type text not null check (event_type in (
    'member_access_changed',
    'member_disabled',
    'member_open_work_handoff',
    'job_access_granted',
    'job_access_revoked'
  )),
  authority_source text not null check (
    authority_source in ('owner', 'admin_ceiling', 'production_ceiling', 'migration_preserve', 'system')
  ),
  job_id uuid,
  access_revision_before bigint,
  access_revision_after bigint,
  before_state jsonb,
  after_state jsonb,
  request_id text check (request_id is null or char_length(request_id) <= 120),
  reason text check (reason is null or char_length(reason) <= 500)
);

create index company_access_events_company_idx
  on public.company_access_events (company_id, occurred_at desc);

create or replace function private.company_access_events_append_only_trg_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  -- Referential cascades (company delete, auth user SET NULL) run at depth > 1.
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'company_access_events is append-only' using errcode = '42501';
end;
$$;

create trigger company_access_events_append_only
  before update or delete on public.company_access_events
  for each row execute function private.company_access_events_append_only_trg_v1();

alter table public.company_member_access_rules enable row level security;
alter table public.job_access_grants enable row level security;
alter table public.company_access_events enable row level security;

revoke all on table
  public.company_member_access_rules,
  public.job_access_grants,
  public.company_access_events
from public, anon, authenticated;

revoke all on function private.job_access_grants_tenant_trg_v1() from public;
revoke all on function private.company_member_access_rules_tenant_trg_v1() from public;
revoke all on function private.company_access_events_append_only_trg_v1() from public;
