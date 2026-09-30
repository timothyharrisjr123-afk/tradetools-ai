-- Phase 13C Team Board: edit an operational person's name and phone.
--
-- The person record is the operational identity shown on the Team Board. A person
-- linked to a FieldDive login keeps that link; editing the person never changes the
-- login, its profile, its role, or its access. Same capability as every crew RPC
-- (company-scope jobs.assign through private.crew_manager_company_v1()).

create or replace function public.update_company_person_v1(
  p_person_id uuid,
  p_expected_row_version bigint,
  p_display_name text,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_company_id uuid;
  v_person public.company_people%rowtype;
  v_name text := btrim(coalesce(p_display_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_version bigint;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;
  v_company_id := private.crew_manager_company_v1();
  if v_company_id is null then
    return jsonb_build_object('ok', false, 'code', 'capability_denied');
  end if;
  if p_person_id is null or p_expected_row_version is null
     or char_length(v_name) not between 1 and 80
     or (v_phone is not null and char_length(v_phone) > 40) then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select * into v_person from public.company_people p
  where p.id = p_person_id and p.company_id = v_company_id
  for update;
  if not found or v_person.archived_at is not null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_person.row_version <> p_expected_row_version then
    return jsonb_build_object('ok', false, 'code', 'stale_revision', 'row_version', v_person.row_version);
  end if;
  if v_person.display_name = v_name and v_person.phone is not distinct from v_phone then
    return jsonb_build_object('ok', true, 'changed', false, 'row_version', v_person.row_version);
  end if;

  update public.company_people
  set display_name = v_name, phone = v_phone, updated_at = now(), row_version = row_version + 1
  where id = p_person_id
  returning row_version into v_version;

  return jsonb_build_object('ok', true, 'changed', true, 'row_version', v_version);
end;
$$;

revoke all on function public.update_company_person_v1(uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.update_company_person_v1(uuid, bigint, text, text) to authenticated, service_role;
