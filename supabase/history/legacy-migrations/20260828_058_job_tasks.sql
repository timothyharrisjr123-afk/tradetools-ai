-- ---------------------------------------------------------------------------
-- 058 — Job tasks (optional contractor memory / coordination)
-- ---------------------------------------------------------------------------
--
-- WHY THIS MIGRATION EXISTS
--
-- Tasks V1: durable job-scoped work a contractor needs to remember that is
-- NOT already represented by another FieldDive domain.
-- Tasks remember work. They do not become the workflow.
--
-- 039 remains reserved. 044–057 are not rewritten.
-- This file is the next SQL after 057. It is not a payment migration.
--
-- MODEL
--
--   job_tasks is job-scoped. Title required. Optional due_on (date, not
--   timestamptz) and optional short notes. Status is open | complete only.
--   Soft delete via deleted_at. No hard delete from this slice.
--   No assigned_to. No priority, blocking, subtasks, labels, templates,
--   attachment FK, AI/copilot, Activity, Calendar, or Attention writes.
--   NEVER writes jobs.stage, measurements, proposals, payments, schedules,
--   or attention.
--   Open tasks do NOT block Complete.
--
-- ---------------------------------------------------------------------------
-- A. Table
-- ---------------------------------------------------------------------------

create table if not exists public.job_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  title text not null,
  notes text null,
  status text not null,
  due_on date null,
  created_by uuid null,
  completed_at timestamptz null,
  completed_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint job_tasks_title_check
    check (char_length(title) between 1 and 120),
  constraint job_tasks_notes_check
    check (notes is null or char_length(notes) <= 500),
  constraint job_tasks_status_check
    check (status in ('open', 'complete')),
  constraint job_tasks_completion_check
    check (
      (status = 'open' and completed_at is null and completed_by is null)
      or (status = 'complete' and completed_at is not null)
    )
);

comment on table public.job_tasks is
  'Optional job-scoped contractor memory/coordination. Not workflow, Calendar, or Attention.';

comment on column public.job_tasks.due_on is
  'Civil due date. Calendar owns scheduled occurrence/time. Null is valid.';

comment on column public.job_tasks.status is
  'open | complete only. Open tasks do not block Job Complete.';

comment on column public.job_tasks.completed_at is
  'Server-authoritative completion instant. Cleared on reopen. Not client-supplied.';

-- ---------------------------------------------------------------------------
-- B. Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_job_tasks_company_id
  on public.job_tasks(company_id);

create index if not exists idx_job_tasks_job_active
  on public.job_tasks(job_id, status, due_on, created_at)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- C. updated_at trigger (reuses public.set_updated_at)
-- ---------------------------------------------------------------------------

drop trigger if exists job_tasks_set_updated_at on public.job_tasks;

create trigger job_tasks_set_updated_at
  before update on public.job_tasks
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- D. Write guard: company/job match, identity immutability, completion stamp
-- ---------------------------------------------------------------------------

create or replace function public.job_tasks_before_write()
returns trigger
language plpgsql
as $$
declare
  job_company uuid;
begin
  select j.company_id into job_company
  from public.jobs j
  where j.id = new.job_id;

  if job_company is null then
    raise exception 'job_tasks job not found';
  end if;

  if job_company is distinct from new.company_id then
    raise exception 'job_tasks company_id must match jobs.company_id';
  end if;

  if new.status = 'open' then
    new.completed_at := null;
    new.completed_by := null;
  elsif new.status = 'complete' then
    if tg_op = 'INSERT' or old.status is distinct from 'complete' then
      new.completed_at := now();
    elsif new.completed_at is distinct from old.completed_at
       or new.completed_by is distinct from old.completed_by then
      raise exception 'job_tasks completion fields are immutable while complete';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.job_id is distinct from old.job_id
       or new.created_by is distinct from old.created_by then
      raise exception 'job_tasks identity fields are immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists job_tasks_before_write on public.job_tasks;

create trigger job_tasks_before_write
  before insert or update on public.job_tasks
  for each row
  execute function public.job_tasks_before_write();

revoke all on function public.job_tasks_before_write() from public;
revoke all on function public.job_tasks_before_write() from anon;
revoke all on function public.job_tasks_before_write() from authenticated;
grant execute on function public.job_tasks_before_write() to service_role;

-- ---------------------------------------------------------------------------
-- E. RLS
-- ---------------------------------------------------------------------------

alter table public.job_tasks enable row level security;

drop policy if exists "job_tasks_select_company_scope" on public.job_tasks;
create policy "job_tasks_select_company_scope"
  on public.job_tasks
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "job_tasks_insert_company_scope" on public.job_tasks;
create policy "job_tasks_insert_company_scope"
  on public.job_tasks
  for insert
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
    and exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and j.company_id = job_tasks.company_id
    )
  );

drop policy if exists "job_tasks_update_company_scope" on public.job_tasks;
create policy "job_tasks_update_company_scope"
  on public.job_tasks
  for update
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  )
  with check (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
    and exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and j.company_id = job_tasks.company_id
    )
  );

-- No DELETE policy: V1 is soft-delete via UPDATE deleted_at.

-- ---------------------------------------------------------------------------
-- F. Grants
-- ---------------------------------------------------------------------------

revoke all on table public.job_tasks from public;
revoke all on table public.job_tasks from anon;
grant select, insert, update on table public.job_tasks to authenticated;
grant all on table public.job_tasks to service_role;
