-- Phase 13B-A: membership role fails closed at the database.
--
-- Before: company_memberships.role was free text with DEFAULT 'owner', so any insert
-- that omitted role created an Owner, and any string could be stored.
--
-- After:
-- - No default: every membership writer must state its role explicitly (the only writer,
--   bootstrap_current_user_company_v1, already inserts 'owner' explicitly).
-- - role must be one of the five stable keys. Custody stays companies.owner_user_id; this
--   migration does not derive, backfill, or change custody.
--
-- Preflight (read-only, 2026-09-25 production / 2026-09-27 staging): every stored role is
-- 'owner'. The guard below refuses to apply if any non-canonical value exists, rather than
-- rewriting it; non-canonical values need a reviewed mapping first.

do $$
declare
  v_noncanonical integer;
begin
  select count(*) into v_noncanonical
  from public.company_memberships
  where role is null
     or role not in ('owner', 'admin', 'office_sales', 'production_lead', 'field_user');
  if v_noncanonical > 0 then
    raise exception 'phase13b_a_noncanonical_membership_roles:%', v_noncanonical
      using errcode = '23514';
  end if;
end;
$$;

alter table public.company_memberships
  alter column role drop default;

alter table public.company_memberships
  add constraint company_memberships_role_canonical_chk
  check (role in ('owner', 'admin', 'office_sales', 'production_lead', 'field_user'));

comment on column public.company_memberships.role is
  'Stable role key: owner | admin | office_sales | production_lead | field_user. No default. owner is not custody; custody is companies.owner_user_id.';
