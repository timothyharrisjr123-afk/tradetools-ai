-- Pre-Phase 12 correction: one canonical job_activity_events event-type CHECK.
--
-- Phase 11 added job_activity_events_event_type_check but left the Phase 10
-- job_activity_events_type_check in place. Both are enforced, so the Phase 10
-- list (without payment_request_*) rejected Phase 11 communication Activity.
-- This replaces both with a single canonical job_activity_events_type_check
-- matching JOB_ACTIVITY_EVENT_TYPES in app/lib/jobLifecycleTypes.ts.
-- Additive to allowed values only; no existing row is rewritten.

alter table public.job_activity_events
  drop constraint if exists job_activity_events_event_type_check;

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
        'production_lead_cleared'::text,
        'scope_change_created'::text,
        'scope_change_proposed'::text,
        'scope_change_authorized'::text,
        'scope_change_declined'::text,
        'scope_change_voided'::text,
        'payment_request_emailed'::text,
        'payment_request_email_failed'::text
      ]
    )
  );
