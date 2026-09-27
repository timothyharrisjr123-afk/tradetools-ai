-- Phase 13B-A: interim scope-change author authority matches the app.
--
-- job_scope_change_author_ok_v1 "mirrors app proposal_author". Phase 13B-A makes
-- proposal_author Owner-only until Phase C role profiles exist; this helper still admitted
-- admin and office_sales (case-insensitively). mint_job_scope_change_public_access_token_v1
-- is granted to authenticated and calls this helper, so a direct RPC call could mint a
-- customer scope-change link that the app route would refuse.
--
-- After: exact stable key 'owner' on a live membership. Same signature, owner, grants,
-- search_path, and SECURITY DEFINER. Phase C replaces this with the capability evaluator.

create or replace function public.job_scope_change_author_ok_v1(
  p_company_id uuid,
  p_user_id uuid
) returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  -- Mirrors app proposal_author (Phase 13B-A interim: Owner only).
  select exists (
    select 1
    from public.company_memberships cm
    where cm.company_id = p_company_id
      and cm.user_id = p_user_id
      and cm.removed_at is null
      and cm.role = 'owner'
  );
$fn$;

alter function public.job_scope_change_author_ok_v1(uuid, uuid) owner to postgres;
revoke all on function public.job_scope_change_author_ok_v1(uuid, uuid) from public;
grant all on function public.job_scope_change_author_ok_v1(uuid, uuid) to service_role;
