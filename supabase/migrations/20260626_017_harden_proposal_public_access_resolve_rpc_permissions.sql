-- R18C2B permission hardening for public access resolve/record RPCs.
-- Records the manual Supabase SQL Editor patch applied after
-- 20260626_016_create_proposal_public_access_resolve_rpc.sql.
--
-- Purpose:
-- - Ensure anon and authenticated cannot execute public access RPCs.
-- - Grant EXECUTE to service_role only for resolve/record (server-side public route later).
-- - Internal validator remains ungranted to service_role — callable only by definer-owned RPCs.
-- - No schema/table/data changes.
-- - No public route/token minting/Send/PDF/Sign/Payment/lifecycle behavior.

revoke all on function public.proposal_assert_public_access_token_active_v1(text) from public;
revoke all on function public.proposal_assert_public_access_token_active_v1(text) from anon;
revoke all on function public.proposal_assert_public_access_token_active_v1(text) from authenticated;
revoke all on function public.proposal_assert_public_access_token_active_v1(text) from service_role;

revoke all on function public.resolve_proposal_public_access_token_v1(text) from public;
revoke all on function public.resolve_proposal_public_access_token_v1(text) from anon;
revoke all on function public.resolve_proposal_public_access_token_v1(text) from authenticated;

revoke all on function public.record_proposal_customer_view_v1(text, text, text, text, jsonb) from public;
revoke all on function public.record_proposal_customer_view_v1(text, text, text, text, jsonb) from anon;
revoke all on function public.record_proposal_customer_view_v1(text, text, text, text, jsonb) from authenticated;

grant execute on function public.resolve_proposal_public_access_token_v1(text) to service_role;
grant execute on function public.record_proposal_customer_view_v1(text, text, text, text, jsonb) to service_role;

comment on function public.resolve_proposal_public_access_token_v1(text) is
  'R18C2B — Resolve hash-only public access token to IDs. service_role execute only; '
  'Next.js server-side /p/[token] route (R18C4+) hashes raw URL token before calling.';

comment on function public.record_proposal_customer_view_v1(text, text, text, text, jsonb) is
  'R18C2B — Record customer view activity. service_role execute only; '
  'called from Next.js server after successful public proposal serve (R18C4+).';
