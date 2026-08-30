-- 061 — Stage-1 company job findability
-- Forward only. Do not edit historical migrations.
--
-- Adds SECURITY INVOKER search for authenticated company members.
-- company_id is derived from auth.uid() membership — it cannot be spoofed.
-- Returns explicit recognition columns only. No email/phone in the result.
-- Multi-word queries AND-match tokens across name/email/job name/address fields
-- so "123 Main" can hit a formatted address or split line1 + city fields.

create or replace function public.search_company_jobs_v1(p_query text)
returns table (
  id uuid,
  customer_name text,
  job_name text,
  address_formatted text,
  address_line1 text,
  address_city text,
  address_state text,
  address_zip text,
  stage text,
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
  )
  select
    j.id,
    j.customer_name,
    j.job_name,
    j.address_formatted,
    j.address_line1,
    j.address_city,
    j.address_state,
    j.address_zip,
    j.stage,
    j.updated_at
  from public.jobs j
  cross join q
  where auth.uid() is not null
    and j.company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
    )
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
      or (
        q.raw ~ '^[0-9a-fA-F-]{8,36}$'
        and j.id::text ilike q.raw || '%'
      )
    )
  order by j.updated_at desc nulls last, j.id
  limit 25;
$$;

revoke all on function public.search_company_jobs_v1(text) from public;
revoke all on function public.search_company_jobs_v1(text) from anon;
grant execute on function public.search_company_jobs_v1(text) to authenticated;
grant execute on function public.search_company_jobs_v1(text) to service_role;
