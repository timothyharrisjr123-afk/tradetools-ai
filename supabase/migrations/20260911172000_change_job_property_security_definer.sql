-- FD-P2-PLACES-SURFACES follow-up:
-- change_job_property_v1 must be SECURITY DEFINER.
-- Authenticated lacks column UPDATE privilege on jobs.property_id (by design),
-- so SECURITY INVOKER cannot atomically attach property_id + refresh snapshot.
-- Do NOT grant casual authenticated UPDATE(property_id) — that would allow
-- split property_id/snapshot writes outside this RPC.
-- Membership + same-company checks remain mandatory in the function body.

create or replace function public.change_job_property_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_job_id uuid;
  v_existing_property_id uuid;
  v_line1 text;
  v_line2 text;
  v_city text;
  v_state text;
  v_zip text;
  v_formatted text;
  v_places_place_id text;
  v_member boolean := false;
  v_job public.jobs%rowtype;
  v_property public.properties%rowtype;
  v_resolved record;
  v_now timestamptz := now();
  v_before_property_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthorized');
  end if;

  begin
    v_company_id := nullif(p_payload->>'company_id', '')::uuid;
    v_job_id := nullif(p_payload->>'job_id', '')::uuid;
    v_existing_property_id := nullif(p_payload->>'property_id', '')::uuid;
    v_line1 := nullif(btrim(coalesce(p_payload->>'line1', '')), '');
    v_line2 := nullif(btrim(coalesce(p_payload->>'line2', '')), '');
    v_city := nullif(btrim(coalesce(p_payload->>'city', '')), '');
    v_state := nullif(btrim(coalesce(p_payload->>'state', '')), '');
    v_zip := nullif(btrim(coalesce(p_payload->>'zip', '')), '');
    v_formatted := nullif(btrim(coalesce(p_payload->>'formatted', '')), '');
    v_places_place_id := nullif(btrim(coalesce(p_payload->>'places_place_id', '')), '');
  exception when others then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end;

  if v_company_id is null or v_job_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload');
  end if;

  select exists (
    select 1 from public.company_memberships cm
    where cm.company_id = v_company_id
      and cm.user_id = v_uid
  ) into v_member;

  if not v_member then
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

  v_before_property_id := v_job.property_id;

  if v_existing_property_id is not null then
    select p.*
    into v_property
    from public.properties p
    where p.id = v_existing_property_id
      and p.company_id = v_company_id
    for share;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'property_not_found');
    end if;
  else
    if v_line1 is null and v_formatted is null then
      return jsonb_build_object('ok', false, 'code', 'property_address_invalid');
    end if;

    begin
      select *
      into v_resolved
      from public.resolve_company_property_v1(
        v_company_id,
        coalesce(v_line1, v_formatted),
        v_line2,
        v_city,
        v_state,
        v_zip,
        v_formatted,
        v_places_place_id
      );
    exception
      when sqlstate '42501' then
        return jsonb_build_object('ok', false, 'code', 'forbidden');
      when sqlstate '22023' then
        return jsonb_build_object('ok', false, 'code', 'property_address_invalid');
      when sqlstate '23505' then
        return jsonb_build_object('ok', false, 'code', 'property_identity_conflict');
      when others then
        return jsonb_build_object('ok', false, 'code', 'resolve_failed', 'detail', sqlerrm);
    end;

    if v_resolved.property_id is null then
      return jsonb_build_object('ok', false, 'code', 'resolve_failed');
    end if;

    select p.*
    into v_property
    from public.properties p
    where p.id = v_resolved.property_id
      and p.company_id = v_company_id;
  end if;

  -- Atomic pointer + operational snapshot refresh from the chosen same-company property.
  -- Does not rewrite proposal context_echo, deliveries, PDFs, or customer mailing.
  -- Does not mutate the shared properties row for one job's location change.
  update public.jobs j
  set
    property_id = v_property.id,
    address_line1 = v_property.address_line1,
    address_line2 = v_property.address_line2,
    address_city = v_property.address_city,
    address_state = v_property.address_state,
    address_zip = v_property.address_zip,
    address_country = coalesce(v_property.address_country, 'US'),
    address_formatted = coalesce(
      nullif(btrim(v_property.address_formatted), ''),
      nullif(
        btrim(
          concat_ws(
            ', ',
            nullif(btrim(coalesce(v_property.address_line1, '')), ''),
            nullif(btrim(coalesce(v_property.address_city, '')), ''),
            nullif(
              btrim(
                concat_ws(
                  ' ',
                  nullif(btrim(coalesce(v_property.address_state, '')), ''),
                  nullif(btrim(coalesce(v_property.address_zip, '')), '')
                )
              ),
              ''
            )
          )
        ),
        ''
      )
    ),
    updated_at = v_now,
    last_activity_at = v_now
  where j.id = v_job.id
    and j.company_id = v_company_id
  returning * into v_job;

  return jsonb_build_object(
    'ok', true,
    'job_id', v_job.id,
    'company_id', v_company_id,
    'property_id', v_property.id,
    'previous_property_id', v_before_property_id,
    'address_line1', v_job.address_line1,
    'address_line2', v_job.address_line2,
    'address_city', v_job.address_city,
    'address_state', v_job.address_state,
    'address_zip', v_job.address_zip,
    'address_country', v_job.address_country,
    'address_formatted', v_job.address_formatted,
    'resolution', case
      when v_existing_property_id is not null then 'selected'
      else coalesce(v_resolved.resolution, 'resolved')
    end
  );
end;
$$;

revoke all on function public.change_job_property_v1(jsonb) from public, anon;
grant execute on function public.change_job_property_v1(jsonb) to authenticated, service_role;

comment on function public.change_job_property_v1(jsonb) is
  'SECURITY DEFINER sole writer for atomic job property_id + operational address snapshot. Requires authenticated membership; enforces same-company property attach; never mutates shared property rows for one job; never rewrites frozen proposal echoes or customer mailing. Does not grant authenticated UPDATE(property_id).';
