-- Phase 13C Team Board foundation: company people, reusable crews, crew rosters.
--
-- Contract: docs/phase13c-crew-product-contract-repo-reconciliation.md Parts 7-9, 18.
-- A person is not a login; a crew is not access; crew membership never grants
-- FieldDive access. No job crew assignments, crew-derived access, capacity, or
-- payroll here. Tables have no client privileges; reads and writes go through the
-- SECURITY DEFINER functions below, gated by company-scope jobs.assign (crew managers).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.company_people (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  display_name text not null,
  phone text,
  linked_user_id uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid,
  request_id text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1,
  constraint company_people_id_company_key unique (id, company_id),
  constraint company_people_display_name_chk
    check (char_length(btrim(display_name)) between 1 and 80 and display_name = btrim(display_name)),
  constraint company_people_phone_chk
    check (phone is null or char_length(btrim(phone)) between 1 and 40),
  constraint company_people_request_id_chk
    check (request_id is null or char_length(request_id) between 1 and 120)
);

create unique index company_people_linked_user_uidx
  on public.company_people (company_id, linked_user_id)
  where linked_user_id is not null;

create unique index company_people_request_uidx
  on public.company_people (company_id, request_id)
  where request_id is not null;

create index company_people_company_active_idx
  on public.company_people (company_id)
  where archived_at is null;

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  usual_lead_person_id uuid,
  archived_at timestamptz,
  archived_by uuid,
  request_id text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1,
  constraint crews_id_company_key unique (id, company_id),
  constraint crews_name_chk
    check (char_length(btrim(name)) between 1 and 80 and name = btrim(name)),
  constraint crews_request_id_chk
    check (request_id is null or char_length(request_id) between 1 and 120),
  constraint crews_usual_lead_fk
    foreign key (usual_lead_person_id, company_id)
    references public.company_people (id, company_id)
);

create unique index crews_active_name_uidx
  on public.crews (company_id, lower(name))
  where archived_at is null;

create unique index crews_request_uidx
  on public.crews (company_id, request_id)
  where request_id is not null;

create table public.crew_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  crew_id uuid not null,
  person_id uuid not null,
  added_at timestamptz not null default now(),
  added_by uuid,
  removed_at timestamptz,
  removed_by uuid,
  constraint crew_members_crew_fk
    foreign key (crew_id, company_id) references public.crews (id, company_id) on delete cascade,
  constraint crew_members_person_fk
    foreign key (person_id, company_id) references public.company_people (id, company_id) on delete cascade,
  constraint crew_members_removed_chk
    check (removed_at is null or removed_at >= added_at)
);

create unique index crew_members_active_uidx
  on public.crew_members (crew_id, person_id)
  where removed_at is null;

create index crew_members_person_active_idx
  on public.crew_members (company_id, person_id)
  where removed_at is null;

-- ---------------------------------------------------------------------------
-- Tenant consistency (contract Part 18)
-- ---------------------------------------------------------------------------
create or replace function private.company_people_tenant_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'company_people: company is immutable' using errcode = '23514';
    end if;
    -- The only permitted link change is losing the login (auth user deleted).
    if new.linked_user_id is distinct from old.linked_user_id and new.linked_user_id is not null then
      raise exception 'company_people: login link is immutable' using errcode = '23514';
    end if;
  end if;
  if new.linked_user_id is not null
     and (tg_op = 'INSERT' or new.linked_user_id is distinct from old.linked_user_id)
     and not exists (
       select 1 from public.company_memberships m
       where m.user_id = new.linked_user_id and m.company_id = new.company_id
     ) then
    raise exception 'company_people: linked login is not a member of this company' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger company_people_tenant
  before insert or update on public.company_people
  for each row execute function private.company_people_tenant_trg_v1();

create or replace function private.crews_tenant_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'crews: company is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger crews_tenant
  before insert or update on public.crews
  for each row execute function private.crews_tenant_trg_v1();

create or replace function private.crew_members_history_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.company_id is distinct from old.company_id
     or new.crew_id is distinct from old.crew_id
     or new.person_id is distinct from old.person_id
     or new.added_at is distinct from old.added_at
     or new.added_by is distinct from old.added_by
     or (old.removed_at is not null and (
       new.removed_at is distinct from old.removed_at or new.removed_by is distinct from old.removed_by
     )) then
    raise exception 'crew_members: roster history is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger crew_members_history
  before update on public.crew_members
  for each row execute function private.crew_members_history_trg_v1();

alter table public.company_people enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;

revoke all on table public.company_people, public.crews, public.crew_members
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Actor gate: active member of a company holding company-scope jobs.assign.
-- ---------------------------------------------------------------------------
create or replace function private.crew_manager_company_v1()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  v_company_id := private.current_active_company_id();
  if v_company_id is null or not private.member_can_v1('jobs.assign') then
    return null;
  end if;
  return v_company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Board read projection (crew managers only; phone included)
-- ---------------------------------------------------------------------------
create or replace function public.get_team_board_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;

  return jsonb_build_object(
    'ok', true,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'phone', p.phone,
        'linked_user_id', p.linked_user_id,
        'row_version', p.row_version,
        'created_at', p.created_at
      ) order by p.created_at, p.id)
      from public.company_people p
      where p.company_id = v_company_id and p.archived_at is null
    ), '[]'::jsonb),
    'crews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'usual_lead_person_id', c.usual_lead_person_id,
        'row_version', c.row_version,
        'created_at', c.created_at
      ) order by c.created_at, c.id)
      from public.crews c
      where c.company_id = v_company_id and c.archived_at is null
    ), '[]'::jsonb),
    'crew_members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'crew_id', cm.crew_id,
        'person_id', cm.person_id,
        'added_at', cm.added_at
      ) order by cm.added_at, cm.id)
      from public.crew_members cm
      join public.crews c on c.id = cm.crew_id and c.company_id = cm.company_id
      where cm.company_id = v_company_id and cm.removed_at is null and c.archived_at is null
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create or replace function public.create_company_person_v1(
  p_display_name text,
  p_phone text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_name text := btrim(coalesce(p_display_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_existing uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if char_length(v_name) not between 1 and 80
     or (v_phone is not null and char_length(v_phone) > 40)
     or (p_request_id is not null and char_length(p_request_id) not between 1 and 120) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if p_request_id is not null then
    select p.id into v_existing from public.company_people p
    where p.company_id = v_company_id and p.request_id = p_request_id;
    if found then
      return jsonb_build_object('ok', true, 'changed', false, 'person_id', v_existing);
    end if;
  end if;

  insert into public.company_people (company_id, display_name, phone, request_id, created_by)
  values (v_company_id, v_name, v_phone, p_request_id, auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'changed', true, 'person_id', v_id);
end;
$$;

-- Idempotent operational person for an existing company login, created the first
-- time that member is chosen as a crew Lead or roster member. Never merges by name.
create or replace function public.ensure_member_person_v1(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_person public.company_people%rowtype;
  v_name text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select coalesce(nullif(btrim(pr.full_name), ''), 'Team member') into v_name
  from public.company_memberships m
  left join public.profiles pr on pr.id = m.user_id
  where m.user_id = p_user_id and m.company_id = v_company_id and m.removed_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into v_person from public.company_people p
  where p.company_id = v_company_id and p.linked_user_id = p_user_id
  for update;
  if found then
    if v_person.archived_at is not null then
      update public.company_people
      set archived_at = null, archived_by = null, updated_at = now(), row_version = row_version + 1
      where id = v_person.id;
      return jsonb_build_object('ok', true, 'changed', true, 'person_id', v_person.id);
    end if;
    return jsonb_build_object('ok', true, 'changed', false, 'person_id', v_person.id);
  end if;

  insert into public.company_people (company_id, display_name, linked_user_id, created_by)
  values (v_company_id, left(v_name, 80), p_user_id, auth.uid())
  on conflict (company_id, linked_user_id) where linked_user_id is not null do nothing
  returning id into v_person.id;
  if v_person.id is null then
    select p.id into v_person.id from public.company_people p
    where p.company_id = v_company_id and p.linked_user_id = p_user_id;
    return jsonb_build_object('ok', true, 'changed', false, 'person_id', v_person.id);
  end if;
  return jsonb_build_object('ok', true, 'changed', true, 'person_id', v_person.id);
end;
$$;

-- Archiving a person is operational only; it never disables a login. A person
-- linked to an active login stays until that access is removed.
create or replace function public.archive_company_person_v1(
  p_person_id uuid,
  p_expected_row_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_person public.company_people%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_person_id is null or p_expected_row_version is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_person from public.company_people p
  where p.id = p_person_id and p.company_id = v_company_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_person.archived_at is not null then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;
  if v_person.row_version <> p_expected_row_version then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'row_version', v_person.row_version);
  end if;
  if v_person.linked_user_id is not null and exists (
    select 1 from public.company_memberships m
    where m.user_id = v_person.linked_user_id and m.company_id = v_company_id and m.removed_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'linked_login_active');
  end if;

  update public.crew_members
  set removed_at = now(), removed_by = auth.uid()
  where company_id = v_company_id and person_id = p_person_id and removed_at is null;

  update public.crews
  set usual_lead_person_id = null, updated_at = now(), row_version = row_version + 1
  where company_id = v_company_id and usual_lead_person_id = p_person_id and archived_at is null;

  update public.company_people
  set archived_at = now(), archived_by = auth.uid(), updated_at = now(), row_version = row_version + 1
  where id = p_person_id;

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Crews
-- ---------------------------------------------------------------------------
create or replace function public.create_crew_v1(
  p_name text,
  p_usual_lead_person_id uuid default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_existing uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if char_length(v_name) not between 1 and 80
     or (p_request_id is not null and char_length(p_request_id) not between 1 and 120) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  if p_request_id is not null then
    select c.id into v_existing from public.crews c
    where c.company_id = v_company_id and c.request_id = p_request_id;
    if found then
      return jsonb_build_object('ok', true, 'changed', false, 'crew_id', v_existing);
    end if;
  end if;

  if p_usual_lead_person_id is not null and not exists (
    select 1 from public.company_people p
    where p.id = p_usual_lead_person_id and p.company_id = v_company_id and p.archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'lead_ineligible');
  end if;

  if exists (
    select 1 from public.crews c
    where c.company_id = v_company_id and c.archived_at is null and lower(c.name) = lower(v_name)
  ) then
    return jsonb_build_object('ok', false, 'code', 'crew_name_taken');
  end if;

  insert into public.crews (company_id, name, usual_lead_person_id, request_id, created_by)
  values (v_company_id, v_name, p_usual_lead_person_id, p_request_id, auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'changed', true, 'crew_id', v_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'crew_name_taken');
end;
$$;

-- Rename and/or change the usual Lead. p_set_lead = true applies
-- p_usual_lead_person_id (null clears the Lead; the crew remains).
create or replace function public.update_crew_v1(
  p_crew_id uuid,
  p_expected_row_version bigint,
  p_name text default null,
  p_set_lead boolean default false,
  p_usual_lead_person_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_crew public.crews%rowtype;
  v_name text;
  v_lead uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_crew_id is null or p_expected_row_version is null
     or (p_name is not null and char_length(btrim(p_name)) not between 1 and 80) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_crew from public.crews c
  where c.id = p_crew_id and c.company_id = v_company_id
  for update;
  if not found or v_crew.archived_at is not null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_crew.row_version <> p_expected_row_version then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'row_version', v_crew.row_version);
  end if;

  v_name := coalesce(btrim(p_name), v_crew.name);
  v_lead := case when coalesce(p_set_lead, false) then p_usual_lead_person_id else v_crew.usual_lead_person_id end;

  if v_lead is not null and v_lead is distinct from v_crew.usual_lead_person_id and not exists (
    select 1 from public.company_people p
    where p.id = v_lead and p.company_id = v_company_id and p.archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'lead_ineligible');
  end if;
  if lower(v_name) <> lower(v_crew.name) and exists (
    select 1 from public.crews c
    where c.company_id = v_company_id and c.archived_at is null and c.id <> v_crew.id
      and lower(c.name) = lower(v_name)
  ) then
    return jsonb_build_object('ok', false, 'code', 'crew_name_taken');
  end if;

  if v_name = v_crew.name and v_lead is not distinct from v_crew.usual_lead_person_id then
    return jsonb_build_object('ok', true, 'changed', false, 'row_version', v_crew.row_version);
  end if;

  update public.crews
  set name = v_name, usual_lead_person_id = v_lead, updated_at = now(), row_version = row_version + 1
  where id = v_crew.id
  returning row_version into v_crew.row_version;

  return jsonb_build_object('ok', true, 'changed', true, 'row_version', v_crew.row_version);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'crew_name_taken');
end;
$$;

-- Archive keeps the crew's roster history. Job crew assignments do not exist yet,
-- so there is no active-assignment block to evaluate.
create or replace function public.archive_crew_v1(
  p_crew_id uuid,
  p_expected_row_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_crew public.crews%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_crew_id is null or p_expected_row_version is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_crew from public.crews c
  where c.id = p_crew_id and c.company_id = v_company_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_crew.archived_at is not null then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;
  if v_crew.row_version <> p_expected_row_version then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'row_version', v_crew.row_version);
  end if;

  update public.crews
  set archived_at = now(), archived_by = auth.uid(), updated_at = now(), row_version = row_version + 1
  where id = v_crew.id;

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Roster
-- ---------------------------------------------------------------------------
create or replace function public.add_crew_member_v1(
  p_crew_id uuid,
  p_person_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_crew_id is null or p_person_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  perform 1 from public.crews c
  where c.id = p_crew_id and c.company_id = v_company_id and c.archived_at is null
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if not exists (
    select 1 from public.company_people p
    where p.id = p_person_id and p.company_id = v_company_id and p.archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'person_not_found');
  end if;
  if exists (
    select 1 from public.crew_members cm
    where cm.crew_id = p_crew_id and cm.person_id = p_person_id and cm.removed_at is null
  ) then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  insert into public.crew_members (company_id, crew_id, person_id, added_by)
  values (v_company_id, p_crew_id, p_person_id, auth.uid());

  return jsonb_build_object('ok', true, 'changed', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'changed', false);
end;
$$;

create or replace function public.remove_crew_member_v1(
  p_crew_id uuid,
  p_person_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_rows integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_crew_id is null or p_person_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  update public.crew_members
  set removed_at = now(), removed_by = auth.uid()
  where company_id = v_company_id and crew_id = p_crew_id and person_id = p_person_id
    and removed_at is null;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on function private.company_people_tenant_trg_v1() from public;
revoke all on function private.crews_tenant_trg_v1() from public;
revoke all on function private.crew_members_history_trg_v1() from public;
revoke all on function private.crew_manager_company_v1() from public;

revoke all on function public.get_team_board_v1() from public, anon, authenticated;
revoke all on function public.create_company_person_v1(text, text, text) from public, anon, authenticated;
revoke all on function public.ensure_member_person_v1(uuid) from public, anon, authenticated;
revoke all on function public.archive_company_person_v1(uuid, bigint) from public, anon, authenticated;
revoke all on function public.create_crew_v1(text, uuid, text) from public, anon, authenticated;
revoke all on function public.update_crew_v1(uuid, bigint, text, boolean, uuid) from public, anon, authenticated;
revoke all on function public.archive_crew_v1(uuid, bigint) from public, anon, authenticated;
revoke all on function public.add_crew_member_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_crew_member_v1(uuid, uuid) from public, anon, authenticated;

grant execute on function public.get_team_board_v1() to authenticated, service_role;
grant execute on function public.create_company_person_v1(text, text, text) to authenticated, service_role;
grant execute on function public.ensure_member_person_v1(uuid) to authenticated, service_role;
grant execute on function public.archive_company_person_v1(uuid, bigint) to authenticated, service_role;
grant execute on function public.create_crew_v1(text, uuid, text) to authenticated, service_role;
grant execute on function public.update_crew_v1(uuid, bigint, text, boolean, uuid) to authenticated, service_role;
grant execute on function public.archive_crew_v1(uuid, bigint) to authenticated, service_role;
grant execute on function public.add_crew_member_v1(uuid, uuid) to authenticated, service_role;
grant execute on function public.remove_crew_member_v1(uuid, uuid) to authenticated, service_role;
