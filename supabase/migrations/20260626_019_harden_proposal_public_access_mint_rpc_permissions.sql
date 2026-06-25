-- R18C3B permission hardening for public access token mint RPC.
--
-- Purpose:
-- - Ensure PUBLIC, anon, and authenticated cannot execute mint RPC.
-- - Grant EXECUTE to service_role only for mint (server-side Send/delivery later).
-- - Preserve R18C2A tables/RLS/triggers and R18C2B resolve/record permissions.
-- - Internal validator remains ungranted to service_role.
-- - No schema/table/data changes beyond function grants.

revoke all on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from public;

revoke all on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from anon;

revoke all on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) from authenticated;

grant execute on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) to service_role;

comment on function public.mint_proposal_public_access_token_v1(
  text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb, uuid, text
) is
  'R18C3B — Mint hash-only public access token. service_role execute only; '
  'Next.js server generates raw token, hashes before calling. Never stores raw token.';
