-- FD-P1-02 phase 1: permanently retire estimate-driven job birth.
--
-- Existing estimate-born jobs remain usable historical operational records,
-- while old/stale clients can no longer create even the first job from an
-- estimate snapshot or add a retired soft claim in a second write. Canonical
-- New Job rows do not carry latest_estimate_id and use job_packet provenance.

create or replace function public.reject_estimate_job_birth_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT'
     and (
       nullif(btrim(new.latest_estimate_id), '') is not null
       or coalesce(new.source_metadata ->> 'source', '') = 'estimate_snapshot'
     ) then
    raise exception 'estimate_job_birth_retired'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
     and coalesce(new.source_metadata ->> 'source', '') = 'estimate_snapshot'
     and coalesce(old.source_metadata ->> 'source', '') <> 'estimate_snapshot' then
    raise exception 'estimate_snapshot_source_retired'
      using errcode = '23514';
  end if;

  -- estimates.job_id is now the only attachment relationship. Historical soft
  -- claims may remain unchanged or be cleared, but no new/reassigned claim may
  -- be introduced through a two-step raw write.
  if tg_op = 'UPDATE'
     and nullif(btrim(new.latest_estimate_id), '') is not null
     and new.latest_estimate_id is distinct from old.latest_estimate_id then
    raise exception 'latest_estimate_claim_retired'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_estimate_job_birth_v1() from public, anon, authenticated;
grant execute on function public.reject_estimate_job_birth_v1() to service_role;

drop trigger if exists jobs_reject_estimate_job_birth_v1 on public.jobs;
create trigger jobs_reject_estimate_job_birth_v1
before insert or update of latest_estimate_id, source_metadata on public.jobs
for each row
execute function public.reject_estimate_job_birth_v1();

comment on function public.reject_estimate_job_birth_v1()
is 'FD-P1-02 forward guard: rejects retired estimate-snapshot job INSERTs and new soft estimate claims while preserving existing rows and canonical New Job creation.';
