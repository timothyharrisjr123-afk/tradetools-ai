-- Phase 13B-B — job attachment storage stays private.
--
-- Attachments are only reached through contractor routes that re-check active
-- membership on every request and mint short-lived signed URLs with the service
-- role (read 600 s, upload 900 s). No storage.objects policy grants anon or
-- authenticated access, so a disabled member cannot list, read, upload, update,
-- delete, or mint URLs. Already-issued signed URLs remain valid until expiry.
-- This keeps the bucket private wherever it exists; no-op when absent.
update storage.buckets
set public = false
where id = 'job-attachments'
  and public is distinct from false;
