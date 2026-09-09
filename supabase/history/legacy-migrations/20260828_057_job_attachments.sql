-- ---------------------------------------------------------------------------
-- 057 — Job attachments (generic private file spine)
-- ---------------------------------------------------------------------------
--
-- WHY THIS MIGRATION EXISTS
--
-- Photos / Attachments V1: durable private job file metadata + private
-- Storage bucket. This is the shared blob spine for documentation photos/files.
-- Measurement-source imagery, proposal embedding, and customer publishing are
-- NOT implemented here.
--
-- 039 remains reserved. 044–056 are not rewritten.
-- This file is the next SQL after 056. It is not a payment migration.
--
-- MODEL
--
--   job_attachments is generic job-scoped file metadata.
--   Storage bucket `job-attachments` is private. Metadata row is authority.
--   listed_in_job_gallery = documentation gallery membership (V1 uploads true).
--   visibility is internal in V1.
--   job_stage_at_upload is an optional snapshot, not stage authority.
--   Soft delete via deleted_at. No hard delete from this slice.
--   NEVER writes jobs.stage, measurements, proposals, or payments.
--
-- ---------------------------------------------------------------------------
-- A. Table
-- ---------------------------------------------------------------------------

create table if not exists public.job_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  kind text not null,
  mime_type text not null,
  byte_size bigint not null,
  original_filename text not null,
  storage_bucket text not null default 'job-attachments',
  storage_path text not null,
  width_px integer null,
  height_px integer null,

  capture_source text not null default 'unknown',
  job_stage_at_upload text null,
  caption text null,
  visibility text not null default 'internal',
  listed_in_job_gallery boolean not null default true,

  constraint job_attachments_kind_check
    check (kind in ('image', 'document')),
  constraint job_attachments_byte_size_check
    check (byte_size >= 0),
  constraint job_attachments_visibility_check
    check (visibility = 'internal'),
  constraint job_attachments_storage_bucket_check
    check (storage_bucket = 'job-attachments'),
  constraint job_attachments_filename_check
    check (char_length(original_filename) between 1 and 255),
  constraint job_attachments_caption_check
    check (caption is null or char_length(caption) <= 500)
);

comment on table public.job_attachments is
  'Generic private job file metadata. Documentation gallery uses listed_in_job_gallery. Not measurement acquisition.';

comment on column public.job_attachments.job_stage_at_upload is
  'Optional snapshot of jobs.stage at upload. Not live stage authority.';

comment on column public.job_attachments.listed_in_job_gallery is
  'When true and not deleted, file appears in Job Photos gallery. Measurement-source imagery stays false later.';

comment on column public.job_attachments.visibility is
  'V1 internal only. Customer/proposal publish is a later explicit association.';

comment on column public.job_attachments.capture_source is
  'Extensible text. V1: camera | library | file | unknown.';

-- ---------------------------------------------------------------------------
-- B. Indexes
-- ---------------------------------------------------------------------------

create unique index if not exists idx_job_attachments_storage_path
  on public.job_attachments(storage_path);

create index if not exists idx_job_attachments_company_id
  on public.job_attachments(company_id);

create index if not exists idx_job_attachments_job_created
  on public.job_attachments(job_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_job_attachments_job_gallery
  on public.job_attachments(job_id, created_at desc)
  where deleted_at is null and listed_in_job_gallery = true;

-- ---------------------------------------------------------------------------
-- C. updated_at trigger (reuses public.set_updated_at)
-- ---------------------------------------------------------------------------

drop trigger if exists job_attachments_set_updated_at on public.job_attachments;

create trigger job_attachments_set_updated_at
  before update on public.job_attachments
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- D. Write guard: company/job match, path prefix, identity immutability
-- ---------------------------------------------------------------------------

create or replace function public.job_attachments_before_write()
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
    raise exception 'job_attachments job not found';
  end if;

  if job_company is distinct from new.company_id then
    raise exception 'job_attachments company_id must match jobs.company_id';
  end if;

  if position(
    (new.company_id::text || '/' || new.job_id::text || '/' || new.id::text || '/')
    in new.storage_path
  ) <> 1 then
    raise exception 'job_attachments storage_path must be company/job/id prefixed';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.company_id is distinct from old.company_id
       or new.job_id is distinct from old.job_id
       or new.storage_bucket is distinct from old.storage_bucket
       or new.storage_path is distinct from old.storage_path
       or new.mime_type is distinct from old.mime_type
       or new.kind is distinct from old.kind
       or new.byte_size is distinct from old.byte_size
       or new.original_filename is distinct from old.original_filename
       or new.created_by is distinct from old.created_by
       or new.visibility is distinct from old.visibility
    then
      raise exception 'job_attachments identity fields are immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists job_attachments_before_write on public.job_attachments;

create trigger job_attachments_before_write
  before insert or update on public.job_attachments
  for each row
  execute function public.job_attachments_before_write();

revoke all on function public.job_attachments_before_write() from public;
revoke all on function public.job_attachments_before_write() from anon;
revoke all on function public.job_attachments_before_write() from authenticated;
grant execute on function public.job_attachments_before_write() to service_role;

-- ---------------------------------------------------------------------------
-- E. RLS
-- ---------------------------------------------------------------------------

alter table public.job_attachments enable row level security;

drop policy if exists "job_attachments_select_company_scope" on public.job_attachments;
create policy "job_attachments_select_company_scope"
  on public.job_attachments
  for select
  using (
    company_id in (
      select company_id
      from public.company_memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "job_attachments_insert_company_scope" on public.job_attachments;
create policy "job_attachments_insert_company_scope"
  on public.job_attachments
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
        and j.company_id = job_attachments.company_id
    )
  );

drop policy if exists "job_attachments_update_company_scope" on public.job_attachments;
create policy "job_attachments_update_company_scope"
  on public.job_attachments
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
        and j.company_id = job_attachments.company_id
    )
  );

-- No DELETE policy: V1 is soft-delete via UPDATE deleted_at.

-- ---------------------------------------------------------------------------
-- F. Grants
-- ---------------------------------------------------------------------------

revoke all on table public.job_attachments from public;
revoke all on table public.job_attachments from anon;
grant select, insert, update on table public.job_attachments to authenticated;
grant all on table public.job_attachments to service_role;

-- ---------------------------------------------------------------------------
-- G. Private storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-attachments',
  'job-attachments',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Blob access is service-role signed URLs only. No anon/authenticated object policies.

drop policy if exists "job_attachments_storage_select" on storage.objects;
drop policy if exists "job_attachments_storage_insert" on storage.objects;
drop policy if exists "job_attachments_storage_update" on storage.objects;
drop policy if exists "job_attachments_storage_delete" on storage.objects;
