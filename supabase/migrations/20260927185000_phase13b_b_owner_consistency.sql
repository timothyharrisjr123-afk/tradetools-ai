-- Phase 13B-B — owner consistency (I-3 / I-4).
--
-- I-3: at most one `owner` membership per company, and when a company has members
--      its owner membership is active and equals companies.owner_user_id.
-- I-4: the owner membership cannot be disabled or demoted (custody moves only by a
--      future ownership-transfer path, which can swap rows inside one transaction).
--
-- Enforcement is a partial unique index plus DEFERRED constraint triggers that
-- re-check only companies touched by a change, at commit. Bootstrap (company +
-- owner membership in one transaction) passes. Rejected at commit:
--   * owner membership disabled, demoted, or pointing away from the pointer;
--   * pointer set to a user without an active owner membership;
--   * members present with no owner;
--   * a new company inserted without a pointer.
-- Existing quarantined staging residue (membership-less companies with a NULL
-- pointer) is not rewritten and is not re-checked unless touched; any change that
-- adds members to such a company must also establish custody. Deleting an Owner's
-- auth account (FK SET NULL / CASCADE) is rejected while other members remain.
-- NOT NULL on owner_user_id is intentionally not added (auth FK is ON DELETE SET NULL).

create unique index if not exists company_memberships_one_owner_per_company_uidx
  on public.company_memberships (company_id)
  where role = 'owner';

create or replace function private.assert_company_owner_consistency_v1(
  p_company_id uuid,
  p_is_company_insert boolean default false
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pointer uuid;
  v_owner public.company_memberships%rowtype;
  v_owner_found boolean;
  v_has_members boolean;
begin
  if p_company_id is null then
    return;
  end if;

  select c.owner_user_id into v_pointer
  from public.companies c
  where c.id = p_company_id;
  if not found then
    return;
  end if;

  select * into v_owner
  from public.company_memberships m
  where m.company_id = p_company_id
    and m.role = 'owner';
  v_owner_found := found;

  if v_owner_found then
    if v_owner.removed_at is not null then
      raise exception 'company_owner_consistency: owner membership cannot be disabled'
        using errcode = '23514';
    end if;
    if v_pointer is distinct from v_owner.user_id then
      raise exception 'company_owner_consistency: owner membership must match companies.owner_user_id'
        using errcode = '23514';
    end if;
    return;
  end if;

  if v_pointer is not null then
    raise exception 'company_owner_consistency: owner pointer requires an active owner membership'
      using errcode = '23514';
  end if;

  if p_is_company_insert then
    raise exception 'company_owner_consistency: new company requires an owner'
      using errcode = '23514';
  end if;

  select exists (
    select 1 from public.company_memberships m where m.company_id = p_company_id
  ) into v_has_members;
  if v_has_members then
    raise exception 'company_owner_consistency: company members require an owner'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_company_owner_consistency_v1(uuid, boolean) from public;

create or replace function private.company_memberships_owner_consistency_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.assert_company_owner_consistency_v1(old.company_id, false);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if tg_op = 'INSERT' or new.company_id is distinct from old.company_id then
      perform private.assert_company_owner_consistency_v1(new.company_id, false);
    end if;
  end if;
  return null;
end;
$$;

create or replace function private.companies_owner_consistency_trg_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform private.assert_company_owner_consistency_v1(new.id, tg_op = 'INSERT');
  return null;
end;
$$;

revoke all on function private.company_memberships_owner_consistency_trg_v1() from public;
revoke all on function private.companies_owner_consistency_trg_v1() from public;

drop trigger if exists company_memberships_owner_consistency on public.company_memberships;
create constraint trigger company_memberships_owner_consistency
  after insert or update or delete on public.company_memberships
  deferrable initially deferred
  for each row execute function private.company_memberships_owner_consistency_trg_v1();

drop trigger if exists companies_owner_consistency on public.companies;
create constraint trigger companies_owner_consistency
  after insert or update of owner_user_id on public.companies
  deferrable initially deferred
  for each row execute function private.companies_owner_consistency_trg_v1();
