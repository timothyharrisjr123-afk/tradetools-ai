-- 064 — Wave C Property identity + typed workspace search
-- Forward only. Do not edit historical migrations 060–063.
-- Target: rhquhnujjnzjhweypavd
--
-- Adds tenant-owned public.properties and jobs.property_id.
-- Job address columns remain as project/compatibility snapshot.
-- No Customer↔Property join table — relationship is inferred through jobs.
-- No frozen proposal / payment / lifecycle rewrite.
-- Search RPCs are SECURITY INVOKER + membership scoped.

-- ---------------------------------------------------------------------------
-- A. Address normalize (TS propertyAddressNormalize must stay aligned)
-- ---------------------------------------------------------------------------

create or replace function public.normalize_property_token_v1(p_token text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(p_token, '')))
    when 'n' then 'north'
    when 's' then 'south'
    when 'e' then 'east'
    when 'w' then 'west'
    when 'ne' then 'northeast'
    when 'nw' then 'northwest'
    when 'se' then 'southeast'
    when 'sw' then 'southwest'
    when 'st' then 'street'
    when 'str' then 'street'
    when 'ave' then 'avenue'
    when 'av' then 'avenue'
    when 'blvd' then 'boulevard'
    when 'rd' then 'road'
    when 'dr' then 'drive'
    when 'ln' then 'lane'
    when 'ct' then 'court'
    when 'cir' then 'circle'
    when 'hwy' then 'highway'
    when 'pkwy' then 'parkway'
    when 'pl' then 'place'
    when 'ter' then 'terrace'
    when 'terr' then 'terrace'
    else lower(trim(coalesce(p_token, '')))
  end;
$$;

create or replace function public.normalize_property_line_v1(p_line text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
  part text;
  out_text text := '';
begin
  cleaned := lower(trim(regexp_replace(coalesce(p_line, ''), '[.,#''\"]+', ' ', 'g')));
  cleaned := trim(regexp_replace(cleaned, '\s+', ' ', 'g'));
  if cleaned = '' then
    return '';
  end if;
  foreach part in array string_to_array(cleaned, ' ')
  loop
    part := public.normalize_property_token_v1(part);
    part := regexp_replace(part, '[^a-z0-9]', '', 'g');
    if part <> '' then
      if out_text = '' then
        out_text := part;
      else
        out_text := out_text || ' ' || part;
      end if;
    end if;
  end loop;
  return out_text;
end;
$$;

create or replace function public.normalize_property_address_v1(
  p_line1 text,
  p_line2 text,
  p_city text,
  p_state text,
  p_zip text,
  p_formatted text default null
)
returns text
language plpgsql
immutable
as $$
declare
  line1 text;
  line2 text;
  city text;
  state text;
  zip5 text;
begin
  line1 := public.normalize_property_line_v1(coalesce(nullif(trim(p_line1), ''), p_formatted));
  line2 := public.normalize_property_line_v1(p_line2);
  city := public.normalize_property_line_v1(p_city);
  state := public.normalize_property_line_v1(p_state);
  zip5 := left(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g'), 5);
  if line1 = '' then
    return '';
  end if;
  -- Street-like: require a letter and a digit so ZIP-only / city-only rows are not Properties.
  if line1 !~ '[a-z]' or line1 !~ '[0-9]' then
    return '';
  end if;
  return line1 || '|' || line2 || '|' || city || '|' || state || '|' || zip5;
end;
$$;

revoke all on function public.normalize_property_token_v1(text) from public;
revoke all on function public.normalize_property_token_v1(text) from anon;
grant execute on function public.normalize_property_token_v1(text) to authenticated;
grant execute on function public.normalize_property_token_v1(text) to service_role;

revoke all on function public.normalize_property_line_v1(text) from public;
revoke all on function public.normalize_property_line_v1(text) from anon;
grant execute on function public.normalize_property_line_v1(text) to authenticated;
grant execute on function public.normalize_property_line_v1(text) to service_role;

revoke all on function public.normalize_property_address_v1(text, text, text, text, text, text) from public;
revoke all on function public.normalize_property_address_v1(text, text, text, text, text, text) from anon;
grant execute on function public.normalize_property_address_v1(text, text, text, text, text, text) to authenticated;
grant execute on function public.normalize_property_address_v1(text, text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- B. properties table
-- ---------------------------------------------------------------------------

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  address_line1 text,
  address_line2 text,
  address_city text,
  address_state text,
  address_zip text,
  address_country text default 'US',
  address_formatted text,
  address_normalized text not null,
  places_place_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_address_normalized_check check (length(trim(address_normalized)) > 0)
);

create index if not exists idx_properties_company_id
  on public.properties (company_id);

create index if not exists idx_properties_company_normalized
  on public.properties (company_id, address_normalized);

create index if not exists idx_properties_company_updated
  on public.properties (company_id, updated_at desc);

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row
  execute function public.set_updated_at();

create or replace function public.properties_prevent_company_id_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'properties.company_id is immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.properties_prevent_company_id_change() from public;
revoke all on function public.properties_prevent_company_id_change() from anon;
revoke all on function public.properties_prevent_company_id_change() from authenticated;
grant execute on function public.properties_prevent_company_id_change() to service_role;

drop trigger if exists properties_prevent_company_id_change on public.properties;
create trigger properties_prevent_company_id_change
  before update on public.properties
  for each row
  execute function public.properties_prevent_company_id_change();

-- ---------------------------------------------------------------------------
-- C. jobs.property_id (nullable compatibility pointer)
-- ---------------------------------------------------------------------------

alter table public.jobs
  add column if not exists property_id uuid references public.properties(id) on delete set null;

create index if not exists idx_jobs_property_id
  on public.jobs (property_id);

-- ---------------------------------------------------------------------------
-- D. RLS + grants
-- ---------------------------------------------------------------------------

alter table public.properties enable row level security;

drop policy if exists "properties_select_company_scope" on public.properties;
create policy "properties_select_company_scope"
  on public.properties
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "properties_insert_company_scope" on public.properties;
create policy "properties_insert_company_scope"
  on public.properties
  for insert
  with check (
    company_id is not null
    and company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "properties_update_company_scope" on public.properties;
create policy "properties_update_company_scope"
  on public.properties
  for update
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  )
  with check (
    company_id is not null
    and company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "properties_delete_company_scope" on public.properties;
create policy "properties_delete_company_scope"
  on public.properties
  for delete
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

revoke all on table public.properties from public;
revoke all on table public.properties from anon;
revoke all on table public.properties from authenticated;
grant select, insert, update, delete on table public.properties to authenticated;
grant all on table public.properties to service_role;

-- ---------------------------------------------------------------------------
-- E. Deterministic tenant-scoped backfill
-- Eligible jobs: street-like address (letter + digit after normalize).
-- Identical normalized key within a company → one Property.
-- Empty / ZIP-only / letter-less rows stay unlinked.
-- Never crosses companies. Never calls Google. Never rewrites job addresses
-- or proposal/payment history.
-- ---------------------------------------------------------------------------

insert into public.properties (
  company_id,
  address_line1,
  address_line2,
  address_city,
  address_state,
  address_zip,
  address_country,
  address_formatted,
  address_normalized
)
select
  grouped.company_id,
  grouped.address_line1,
  grouped.address_line2,
  grouped.address_city,
  grouped.address_state,
  grouped.address_zip,
  grouped.address_country,
  grouped.address_formatted,
  grouped.address_normalized
from (
  select distinct on (j.company_id, norm.key)
    j.company_id,
    j.address_line1,
    j.address_line2,
    j.address_city,
    j.address_state,
    j.address_zip,
    coalesce(nullif(trim(j.address_country), ''), 'US') as address_country,
    j.address_formatted,
    norm.key as address_normalized
  from public.jobs j
  cross join lateral (
    select public.normalize_property_address_v1(
      j.address_line1,
      j.address_line2,
      j.address_city,
      j.address_state,
      j.address_zip,
      j.address_formatted
    ) as key
  ) norm
  where j.deleted_at is null
    and norm.key <> ''
  order by j.company_id, norm.key, j.updated_at desc nulls last, j.id
) grouped
where not exists (
  select 1
  from public.properties p
  where p.company_id = grouped.company_id
    and p.address_normalized = grouped.address_normalized
);

update public.jobs j
set property_id = p.id
from public.properties p
where j.property_id is null
  and j.deleted_at is null
  and p.company_id = j.company_id
  and p.address_normalized = public.normalize_property_address_v1(
    j.address_line1,
    j.address_line2,
    j.address_city,
    j.address_state,
    j.address_zip,
    j.address_formatted
  )
  and public.normalize_property_address_v1(
    j.address_line1,
    j.address_line2,
    j.address_city,
    j.address_state,
    j.address_zip,
    j.address_formatted
  ) <> '';

-- ---------------------------------------------------------------------------
-- F. Property candidate search (intake) — exact normalized + token assist
-- ---------------------------------------------------------------------------

create or replace function public.search_company_properties_v1(p_query text)
returns table (
  id uuid,
  address_line1 text,
  address_city text,
  address_state text,
  address_zip text,
  address_formatted text,
  address_normalized text,
  job_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select
      trim(coalesce(p_query, '')) as raw,
      lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as text
  )
  select
    p.id,
    p.address_line1,
    p.address_city,
    p.address_state,
    p.address_zip,
    p.address_formatted,
    p.address_normalized,
    (
      select count(*)
      from public.jobs j
      where j.property_id = p.id
        and j.deleted_at is null
        and coalesce(j.archived, false) = false
    ) as job_count
  from public.properties p
  cross join q
  where auth.uid() is not null
    and p.company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
    )
    and length(q.raw) >= 3
    and (
      p.address_normalized = q.text
      or strpos(p.address_normalized, q.text) > 0
      or (
        q.text <> ''
        and (
          select bool_and(
            length(part) = 0
            or strpos(
              lower(concat_ws(' ',
                coalesce(p.address_line1, ''),
                coalesce(p.address_line2, ''),
                coalesce(p.address_city, ''),
                coalesce(p.address_state, ''),
                coalesce(p.address_zip, ''),
                coalesce(p.address_formatted, ''),
                coalesce(p.address_normalized, '')
              )),
              part
            ) > 0
          )
          from unnest(string_to_array(q.text, ' ')) as part
        )
      )
    )
  order by p.updated_at desc nulls last, p.id
  limit 8;
$$;

revoke all on function public.search_company_properties_v1(text) from public;
revoke all on function public.search_company_properties_v1(text) from anon;
grant execute on function public.search_company_properties_v1(text) to authenticated;
grant execute on function public.search_company_properties_v1(text) to service_role;

-- ---------------------------------------------------------------------------
-- G. Typed workspace search — jobs + customers + properties
-- Does not replace historical search_company_jobs_v1 (061).
-- ---------------------------------------------------------------------------

create or replace function public.search_company_workspace_v1(p_query text)
returns table (
  entity_type text,
  id uuid,
  primary_label text,
  secondary_label text,
  job_stage text,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select
      trim(coalesce(p_query, '')) as raw,
      lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as text,
      regexp_replace(trim(coalesce(p_query, '')), '[^0-9]', '', 'g') as digits
  ),
  member_companies as (
    select cm.company_id
    from public.company_memberships cm
    where cm.user_id = auth.uid()
  ),
  job_hits as (
    select
      'job'::text as entity_type,
      j.id,
      coalesce(nullif(trim(j.customer_name), ''), nullif(trim(j.job_name), ''), 'Job') as primary_label,
      coalesce(
        nullif(trim(j.address_formatted), ''),
        nullif(trim(concat_ws(', ',
          nullif(trim(j.address_line1), ''),
          nullif(trim(j.address_city), ''),
          nullif(trim(j.address_state), ''),
          nullif(trim(j.address_zip), '')
        )), ''),
        ''
      ) as secondary_label,
      j.stage as job_stage,
      j.updated_at
    from public.jobs j
    cross join q
    where auth.uid() is not null
      and j.company_id in (select company_id from member_companies)
      and coalesce(j.archived, false) = false
      and j.deleted_at is null
      and length(q.raw) >= 2
      and (
        (
          q.text <> ''
          and (
            select bool_and(
              length(part) = 0
              or strpos(
                lower(concat_ws(' ',
                  coalesce(j.customer_name, ''),
                  coalesce(j.customer_email, ''),
                  coalesce(j.job_name, ''),
                  coalesce(j.address_formatted, ''),
                  coalesce(j.address_line1, ''),
                  coalesce(j.address_city, ''),
                  coalesce(j.address_state, ''),
                  coalesce(j.address_zip, '')
                )),
                part
              ) > 0
              or (
                length(regexp_replace(part, '[^0-9]', '', 'g')) >= 7
                and strpos(
                  regexp_replace(coalesce(j.customer_phone, ''), '[^0-9]', '', 'g'),
                  regexp_replace(part, '[^0-9]', '', 'g')
                ) > 0
              )
              or (
                part ~ '^[0-9a-f-]{8,36}$'
                and j.id::text ilike part || '%'
              )
            )
            from unnest(string_to_array(q.text, ' ')) as part
          )
        )
        or (
          length(q.digits) >= 7
          and strpos(
            regexp_replace(coalesce(j.customer_phone, ''), '[^0-9]', '', 'g'),
            q.digits
          ) > 0
        )
      )
    order by j.updated_at desc nulls last, j.id
    limit 8
  ),
  customer_hits as (
    select
      'customer'::text as entity_type,
      c.id,
      coalesce(nullif(trim(c.name), ''), 'Customer') as primary_label,
      nullif(trim(concat_ws(' · ', nullif(trim(c.email), ''), nullif(trim(c.phone), ''))), '') as secondary_label,
      null::text as job_stage,
      c.created_at as updated_at
    from public.customers c
    cross join q
    where auth.uid() is not null
      and c.company_id in (select company_id from member_companies)
      and length(q.raw) >= 2
      and (
        (
          q.text <> ''
          and (
            lower(coalesce(c.email, '')) = q.text
            or strpos(lower(coalesce(c.email, '')), q.text) > 0
            or strpos(lower(coalesce(c.name, '')), q.text) > 0
            or (
              select bool_and(
                length(part) = 0
                or strpos(lower(coalesce(c.name, '')), part) > 0
              )
              from unnest(string_to_array(q.text, ' ')) as part
            )
          )
        )
        or (
          length(q.digits) >= 7
          and strpos(
            regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'),
            q.digits
          ) > 0
        )
      )
    order by c.created_at desc nulls last, c.id
    limit 8
  ),
  property_hits as (
    select
      'property'::text as entity_type,
      p.id,
      coalesce(
        nullif(trim(p.address_line1), ''),
        nullif(trim(p.address_formatted), ''),
        'Property'
      ) as primary_label,
      nullif(trim(concat_ws(', ',
        nullif(trim(p.address_city), ''),
        nullif(trim(p.address_state), ''),
        nullif(trim(p.address_zip), '')
      )), '') as secondary_label,
      null::text as job_stage,
      p.updated_at
    from public.properties p
    cross join q
    where auth.uid() is not null
      and p.company_id in (select company_id from member_companies)
      and length(q.raw) >= 2
      and q.text <> ''
      and (
        select bool_and(
          length(part) = 0
          or strpos(
            lower(concat_ws(' ',
              coalesce(p.address_line1, ''),
              coalesce(p.address_line2, ''),
              coalesce(p.address_city, ''),
              coalesce(p.address_state, ''),
              coalesce(p.address_zip, ''),
              coalesce(p.address_formatted, ''),
              coalesce(p.address_normalized, '')
            )),
            part
          ) > 0
        )
        from unnest(string_to_array(q.text, ' ')) as part
      )
    order by p.updated_at desc nulls last, p.id
    limit 8
  )
  select * from job_hits
  union all
  select * from customer_hits
  union all
  select * from property_hits;
$$;

revoke all on function public.search_company_workspace_v1(text) from public;
revoke all on function public.search_company_workspace_v1(text) from anon;
grant execute on function public.search_company_workspace_v1(text) to authenticated;
grant execute on function public.search_company_workspace_v1(text) to service_role;
