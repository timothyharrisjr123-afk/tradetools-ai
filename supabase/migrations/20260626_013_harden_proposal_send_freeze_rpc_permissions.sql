-- R18B3 permission hardening for send-freeze RPC.
-- Records the manual Supabase SQL Editor patch applied after
-- 20260626_012_create_proposal_send_freeze_rpc.sql.
--
-- Purpose:
-- - Ensure anon cannot execute persist_proposal_send_freeze_v1.
-- - Preserve authenticated/service_role execution only.
-- - No schema/table/data changes.
-- - No public route/token/send/sign/payment/PDF/lifecycle behavior.

REVOKE ALL ON FUNCTION public.persist_proposal_send_freeze_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.persist_proposal_send_freeze_v1(jsonb) FROM anon;

GRANT EXECUTE ON FUNCTION public.persist_proposal_send_freeze_v1(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.persist_proposal_send_freeze_v1(jsonb) TO service_role;
