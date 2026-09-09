-- Template Setup Authorship V1 — durable package description on proposal_options
-- REVIEW ONLY - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
--
-- Depends on:
--   20260721_028_optional_upgrade_truth_rpc_alignment.sql
--
-- Adds:
--   proposal_options.description (nullable text)
--     Authored package copy snapshotted from proposal_template_options.description
--     at draft create / send-freeze. Preview/Public prefer this over hardcoded
--     Standard/Enhanced/Premium marketing fallbacks.
--
-- RPC follow-up (same approval gate):
--   persist_draft_proposal_create_v1 and persist_proposal_send_freeze_v1 must INSERT
--   description from opt->>'description' once this column exists. Until those RPCs
--   are aligned, TypeScript payload builders still include description so sequential
--   / future RPC paths persist it. Apply RPC alignment in the same review window.
--
-- Does NOT:
--   - change pricing formulas or quantity math
--   - change optional-upgrade selection truth
--   - mutate existing frozen snapshots (null description → presenter fallback)

begin;

alter table public.proposal_options
  add column if not exists description text;

comment on column public.proposal_options.description is
  'Authored package description snapshotted from the template option; customer-facing package copy source of truth when present.';

commit;
