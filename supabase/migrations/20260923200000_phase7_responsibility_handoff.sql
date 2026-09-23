-- Phase 7 / Astra G7 — small-team responsibility + field handoff (additive).
-- - job_tasks.assigned_to: nullable task assignee (NULL = Unassigned)
-- - company_memberships.removed_at: soft-remove (future access blocked)
-- - jobs.crew_label: optional text label (not resource planning)
-- - activity event types for production-lead chronology
-- Does not rewrite historical actors, stages, proposals, or payments.

alter table public.job_tasks
  add column if not exists assigned_to uuid null;

comment on column public.job_tasks.assigned_to is
  'Astra G7 task assignee (company member user id). NULL = Unassigned. Independent of jobs.assigned_to and task status.';

create index if not exists idx_job_tasks_assigned_to
  on public.job_tasks (company_id, assigned_to)
  where assigned_to is not null and deleted_at is null;

alter table public.company_memberships
  add column if not exists removed_at timestamptz null;

comment on column public.company_memberships.removed_at is
  'Astra G7 soft-remove. Non-null blocks future access. Historical created_by/completed_by/activity actors remain visible.';

create index if not exists idx_company_memberships_live
  on public.company_memberships (company_id, user_id)
  where removed_at is null;

alter table public.jobs
  add column if not exists crew_label text null;

comment on column public.jobs.crew_label is
  'Optional Astra G7 crew label (text only). Not a resource-planning engine.';

alter table public.jobs
  drop constraint if exists jobs_crew_label_len_check;

alter table public.jobs
  add constraint jobs_crew_label_len_check
  check (crew_label is null or char_length(crew_label) <= 80);

-- Expand Activity event types for production-lead chronology.
alter table public.job_activity_events
  drop constraint if exists job_activity_events_type_check;

alter table public.job_activity_events
  add constraint job_activity_events_type_check check (
    event_type = any (
      array[
        'job_created'::text,
        'stage_changed'::text,
        'disposition_changed'::text,
        'job_scheduled'::text,
        'job_rescheduled'::text,
        'job_unscheduled'::text,
        'job_work_started'::text,
        'job_work_completed'::text,
        'production_lead_assigned'::text,
        'production_lead_changed'::text,
        'production_lead_cleared'::text
      ]
    )
  );

comment on column public.jobs.assigned_to is
  'Astra G7 production lead (company member user id). NULL = Unassigned. Assignment does not change stage, proposal, payment, schedule, or task status.';
