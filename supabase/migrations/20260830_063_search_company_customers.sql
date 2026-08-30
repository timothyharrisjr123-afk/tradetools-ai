-- 063 — Wave B company customer findability (SECURITY INVOKER)
-- Forward only. Do not edit historical migrations 060/061/062.
--
-- Adds authenticated, membership-scoped customer candidate search for New Job intake.
-- Does not: Property table, Customer workspace, merge, auto-create, or global shell search.
-- company_id cannot be spoofed — derived from company_memberships + auth.uid().
-- Result columns are recognition-only (id, name, email, phone). No address dump.

create index if not exists idx_customers_company_id_email_lower
  on public.customers (company_id, lower(email));

create index if not exists idx_customers_company_id_name_lower
  on public.customers (company_id, lower(name));

create or replace function public.search_company_customers_v1(p_query text)
returns table (
  id uuid,
  name text,
  email text,
  phone text
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
    c.id,
    c.name,
    c.email,
    c.phone
  from public.customers c
  cross join q
  where auth.uid() is not null
    and c.company_id in (
      select cm.company_id
      from public.company_memberships cm
      where cm.user_id = auth.uid()
    )
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
  order by
    case when lower(coalesce(c.email, '')) = q.text then 0 else 1 end,
    case
      when length(q.digits) >= 7
        and strpos(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'), q.digits) > 0
      then 0 else 1
    end,
    lower(coalesce(c.name, '')),
    c.id
  limit 8;
$$;

revoke all on function public.search_company_customers_v1(text) from public;
revoke all on function public.search_company_customers_v1(text) from anon;
grant execute on function public.search_company_customers_v1(text) to authenticated;
grant execute on function public.search_company_customers_v1(text) to service_role;
