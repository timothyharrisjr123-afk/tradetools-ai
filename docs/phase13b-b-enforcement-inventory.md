# Phase 13B-B — Enforcement inventory (policies, functions/grants, routes, storage)

Status: reviewed inventory required by blueprint §14.9 / §14.10 / §16 Phase B entry gate.
Source: live **staging** catalogs (`tjtrhdckinjtorgbkirm`), read-only, 2026-09-27; reconciled
with `supabase/migrations`. Production was not read or written in this phase.

Families: **A** employee/member · **B** public customer token · **C** service/internal ·
**D** exceptional (self, custody, explicit deny).

## 1. RLS policy inventory (§14.9)

Machine-readable, per policy (table, command, name, roles, USING, WITH CHECK, family,
authority, removed-member behavior before, proposed replacement, migration presence,
regression proof): [`phase13b-b-policy-inventory.json`](./phase13b-b-policy-inventory.json).

| Metric | Value |
|---|---|
| Live policies (`public`, `storage`, `private`) | 126 on 52 tables |
| Family A (membership subquery) | 120 on 50 tables |
| Family D | 6 |
| Family B / C policies | 0 — no policy carries public-token or service authority |
| Live policies absent from migrations | 0 |
| Family A already checking `removed_at` | 4 (`job_scope_*` SELECT) |
| `storage.objects` policies | 0 |

Family D (unchanged):

| Table | Policy | Authority | Removed member |
|---|---|---|---|
| profiles | Users can insert own profile | self (`id = auth.uid()`) | own row only (identity bootstrap) |
| profiles | Users can view own profile | self | own row only |
| profiles | Users can update own profile | self | own row only |
| company_memberships | Users can view their memberships | self row | sees own disabled row → typed `removed`, never `none` |
| companies | Owners can update company | custody pointer | Owner cannot be disabled (I-4) |
| proposal_version_payment_terms | proposal_version_payment_terms_write_deny | `false` | n/a |

Family A decision: rebuild in place with `ALTER POLICY` (same name, command, and every
non-membership conjunct), roles narrowed to `authenticated`, membership subquery →
`company_id = (SELECT private.current_active_company_id())`. Before: a disabled member
with an unexpired JWT passed every family-A policy (R5). After: denied. Cross-tenant
remains denied (helper returns only the caller's own active company). Same-company
EXISTS conjuncts on `job_attachments`, `job_tasks`, `measurement_records`, `proposals`,
`proposal_template_*` are preserved verbatim.

Special rows:
- `companies` "Users can view their company": `id = helper`.
- `job_attention_user_state_select_own`: self conjunct kept + helper.
- `proposal_public_access_tokens_select_company_scope` (R15): helper **and**
  `private.current_member_has_capability_v1('proposal_author')`. The app never reads this
  table with a user client; public validation uses service-role definer RPCs.

Migration: `20260927180000_phase13b_b_active_membership_rls.sql` (generated from the
inventory by a generator that fails on any unrecognized shape or leftover membership
reference).

Helper contract (§14.4): `private.current_active_company_id()` — SECURITY DEFINER,
STABLE, no arguments, `search_path = pg_catalog, public`, actor = `auth.uid()`, requires
`removed_at IS NULL` and a canonical role, returns NULL otherwise. `private` has USAGE
for `authenticated`, `service_role` only; EXECUTE revoked from PUBLIC; not exposed by
PostgREST.

## 2. SECURITY DEFINER function / grant inventory (§14.10)

Catalog: 170 public functions; 95 SECURITY DEFINER; 50 executable by `anon`, 97 by
`authenticated`; 52 trigger functions (not directly callable). All 35 definer
functions executable by `anon`/`authenticated` pin `search_path`. Owner: `postgres`.
Root cause of broad grants: `postgres` default privileges in `public` grant EXECUTE
to `anon`, `authenticated`, `service_role`; `revoke … from public` does not remove them.

### 2.1 Employee RPCs lacking an active-membership check (fixed)

Actor = `auth.uid()` (NULL → `unauthorized`); company from payload/row; internal check
was `exists(membership where company_id = X and user_id = uid)` without `removed_at`.
Grants unchanged (authenticated + service_role; anon none). Fix: same predicate plus
`removed_at IS NULL` and the capability that mirrors the route gate (interim: Owner).

| Function | App caller | Phase B DB check | Route gate |
|---|---|---|---|
| acknowledge_proposal_acceptance_attention_v1 | jobs/acknowledge-acceptance | active + `job_approve` | `job_approve` |
| confirm_proposal_acceptance_v1 | jobs/confirm-acceptance | active + `job_approve` | `job_approve` |
| cancel_job_payment_request_v1 | jobs/payment-requests/[id]/cancel | active + `payment_request` | `payment_request` |
| create_job_payment_request_v1 | jobs/payment-requests | active + `payment_request` | `payment_request` |
| collect_job_payment_v1 | [jobId]/payment-requests/collect, balance | active + `payment_request` | `payment_request` |
| reserve_job_payment_refund_v1 | [jobId]/payments/[paymentId]/refunds | active + `payment_admin` | `payment_admin` |
| upsert_company_payment_settings_v1 | company/payments/settings | active + `payment_admin` | `payment_admin` |
| ensure_company_payment_settings_v1 | company/payments/status (read) | active member | active member |
| set_company_timezone_v1 | company/timezone POST | active + `company_admin` | `company_admin` |
| schedule_job_v1 / reschedule_job_v1 / unschedule_job_v1 | jobs/schedule, reschedule, unschedule | active + `schedule_mutate` | `schedule_mutate` |
| start_job_work_v1 / complete_job_work_v1 | jobs/start-work, complete-work | active + `lifecycle_start_complete` | same |
| change_job_disposition_v1 | jobs/change-disposition | active + (`job_pause_resume` or `job_disposition_finalize`) | exact transition capability |
| change_job_property_v1 | JobCardChangePropertyPanel (browser client) | active member | n/a (direct RPC) |
| mark_job_attention_read_v1 | jobs/attention POST | active member | active member |
| update_proposal_customer_request_status_v1 | proposals/customer-requests PATCH | active + `proposal_author` | `proposal_author` |
| upsert_draft_proposal_payment_terms_v1 | proposals/[id]/payment-terms PUT | active + `proposal_author` | `proposal_author` |

Migration: `20260927181000_phase13b_b_rpc_active_membership_capability.sql` (each body =
live definition with exactly one predicate change, asserted by generator).

### 2.2 Internal helpers (grants revoked from anon/authenticated)

| Function | Purpose | Callers (all SECURITY DEFINER) | Before | After | Why |
|---|---|---|---|---|---|
| job_scope_change_author_ok_v1 (N13) | Owner-only authoring check | mint_job_scope_change_public_access_token_v1 | anon, auth | service_role | membership oracle; parents run as owner |
| job_scope_change_member_ok_v1 | active member check | create/update/propose/void/decline scope change | anon, auth | service_role | oracle |
| job_scope_change_lines_json_v1 | lines projection | create/update/propose/authorize/resolve | anon, auth | service_role | cross-tenant read |
| job_scope_change_replace_lines_v1 | delete+reinsert lines | create/update draft | anon, auth | service_role | **unauthenticated cross-tenant write** |
| proposal_payment_terms_seed_from_settings_v1 | seed terms | definer trigger | anon, auth | service_role | **unauthenticated cross-tenant write** |
| proposal_acceptance_contract_option_v1 | acceptance option | collect/create payment request, open_job_deposit_from_acceptance_v1 | auth | service_role | cross-tenant read |

### 2.3 Token and mixed-authority RPCs

| Function | Authority | Callers | Before | After |
|---|---|---|---|---|
| authorize_job_scope_change_v1 | B (token hash binding) | `app/api/scope-changes/public/[token]/authorize` via admin client | anon, auth | service_role only |
| resolve_job_scope_change_public_access_token_v1 | B | `app/api/scope-changes/public/[token]` (+authorize) via admin client | anon, auth | service_role only |
| decline_job_scope_change_v1 | A (member_ok) or C (service_role) | contractor scope-change route (user client) | anon, auth | auth, service_role |
| create/update/propose/void scope change, mint token | A (auth.uid required; mint Owner-only) | contractor routes | anon, auth | auth, service_role |
| job_contract_total_cents_v1 | A/C | contractor routes (user), payment email (user), public orchestrator (admin), invoker `job_payment_current_contractual_total_cents_v1`, definer parents | anon, auth | auth, service_role; body returns NULL when a signed-in caller asks for another company |
| bootstrap_current_user_company_v1 | A (self) | identity bootstrap | auth | unchanged |

Public customer authority (`/p` view/accept/sign/option choice, public PDF, public
payment checkout, public scope-change view/authorize) runs through service-role
routes and is unchanged; no token grants employee authority and employee disablement
does not touch token rows.

### 2.4 Team RPCs (new; authenticated + service_role; anon/PUBLIC revoked)

`list_company_directory_v1`, `list_company_access_admin_v1`, `set_company_member_role_v1`,
`disable_company_member_v1`, `handoff_member_open_work_v1` —
`20260927182000_phase13b_b_team_directory_and_member_rpcs.sql`. `access_revision` /
`expected_revision` deferred to Phase C (`set_member_access_v1` replaces the role RPC);
role change is deliberately idempotent (same role → `changed:false`).

### 2.5 Invoker functions

Anon/authenticated-executable SECURITY INVOKER functions run under the caller's RLS
and grants; they inherit the family-A rebuild. No change.

## 3. Table grants

| Object | Finding | Decision |
|---|---|---|
| company_memberships | anon SELECT; authenticated SELECT, UPDATE (no UPDATE policy) | revoke anon SELECT, authenticated UPDATE; keep authenticated SELECT (self-row typed resolution) |
| jobs | authenticated column UPDATE incl. `assigned_to`; RLS family A | unchanged (Field scoping is Phase C) |
| proposal_delivery_provider_events, subscriptions | RLS on, no policies, no grants | unchanged |
| `_synth_places_definer_proof`, `_synth_places_prop_proof`, `_synth_recovery_proof` | staging-only residue; RLS off; full anon/authenticated grants; not in migrations | **recorded, not dropped** (destructive cleanup out of scope); staging hygiene follow-up |
| Other tenant tables | broad anon table grants from defaults | RLS denies anon (every family-A policy now `TO authenticated`); unchanged |

Migration: `20260927183000_phase13b_b_function_and_table_grants.sql`.

## 4. Storage (§18)

| Item | Staging |
|---|---|
| Buckets | 0 (no `job-attachments` bucket on staging) |
| `storage.objects` policies | 0 (RLS on) |
| App access | `job-attachments`, service-role client only; signed read 600 s, signed upload 900 s, finalize probe 30 s; routes re-check membership per request |

Disabled member: no direct list/read/upload/update/delete (no member object policies);
route access requires an active membership (typed gate) → no new signed URLs. Already-
issued signed URLs stay valid until expiry (not retroactively revocable). Migration
`20260927184000_phase13b_b_job_attachments_bucket_private.sql` keeps the bucket
private wherever it exists (no-op on staging).

## 5. Route → authority inventory (§12)

Gate legend: **cap(x)** = typed active membership + capability x (`requireCapabilitySession`,
unavailable → 503); **active** = typed active membership; **legacy** = `getUserCompanyId`
(fail-closed: disabled/none/invalid/unavailable → 403). Tenant is always derived from the
session, never from the client. Phase C column = canonical capability (§5.4).

| Route | Methods | Before | Phase B | Phase C | Service role |
|---|---|---|---|---|---|
| company/members | GET | active (+`customers_jobs` list) | active → directory; `member_admin` → access-admin projection | team.manage | no |
| company/members | PATCH | cap(member_admin) + user-client writes | cap(member_admin) → RPCs | team.manage | no |
| company/payments/settings | POST | legacy | cap(payment_admin) | payments.configure | no |
| company/payments/connect | POST | legacy + cap(payment_admin) | cap(payment_admin) | payments.configure | yes |
| company/payments/status | GET | legacy | legacy (read) | payments.summary.read | no |
| company/timezone | GET / POST | legacy / legacy | legacy / cap(company_admin) | company.manage | no |
| jobs/confirm-acceptance | POST | legacy | cap(job_approve) | jobs.approve | no |
| jobs/acknowledge-acceptance | POST | legacy | cap(job_approve) | jobs.approve | no |
| jobs/payment-requests | POST | legacy | cap(payment_request) | payments.request | no |
| jobs/payment-requests/[id]/cancel | POST | legacy | cap(payment_request) | payments.request | no |
| jobs/payment-requests/[id]/checkout | POST | legacy | cap(payment_request) | payments.request | no |
| jobs/[jobId]/payment-requests/balance | POST | legacy | cap(payment_request) | payments.request | no |
| jobs/[jobId]/payment-requests | GET | legacy | legacy (read) | payments.summary.read | no |
| jobs/[jobId]/payment-requests/collect, payment-link, [paymentRequestId]/email | POST | legacy + cap(payment_request) | cap(payment_request) | payments.request | no |
| jobs/[jobId]/payments/[paymentId]/refunds | POST | legacy + cap(payment_admin) | cap(payment_admin) | payments.refund | yes |
| jobs/schedule | POST | legacy + cap(schedule_mutate) | cap(schedule_mutate) | schedule.manage | no |
| jobs/reschedule, jobs/unschedule | POST | legacy | cap(schedule_mutate) | schedule.manage | no |
| jobs/schedules | GET | legacy | legacy (read) | schedule.read | no |
| jobs/start-work, complete-work | POST | legacy + cap(lifecycle_start_complete) | cap(lifecycle_start_complete) | jobs.progress | no |
| jobs/change-disposition | POST | legacy + cap(transition) | cap(transition) | jobs.hold / jobs.finalize | no |
| jobs/[jobId]/production-lead | PATCH | cap(job_assign) | unchanged | jobs.assign | no |
| jobs/[jobId]/tasks | GET / POST | legacy / legacy | active / cap(task_assign) | tasks.read / tasks.manage | no |
| jobs/[jobId]/tasks/[taskId] | PATCH, DELETE | legacy + cap(task_assign / task_complete) | cap(task_assign / task_complete) | tasks.manage / tasks.complete | no |
| jobs/[jobId]/attachments | GET / POST | legacy / legacy | active / cap(photo_mutate) | photos.read / photos.contribute | yes (storage) |
| jobs/[jobId]/attachments/[attachmentId] | GET / PATCH, DELETE | legacy | active / cap(photo_mutate) | photos.read / photos.contribute | yes (storage) |
| jobs/[jobId]/attachments/[attachmentId]/finalize | POST | legacy | cap(photo_mutate) | photos.contribute | yes (storage) |
| jobs/[jobId]/scope-changes, [scopeChangeId] | GET / POST, PATCH | legacy + cap(proposal_author) | unchanged (typed via capability gate on writes) | scope_changes.* | no |
| jobs/[jobId]/customer-record-link | POST | legacy + cap(proposal_author) | cap(proposal_author) | proposals.send | no |
| jobs/attention | GET / POST | legacy | legacy (own read state) | jobs.read | no |
| proposals/send | POST | legacy + cap(proposal_author) | unchanged | proposals.send | no |
| proposals/[proposalId]/payment-terms | GET / PUT | legacy / legacy | legacy / cap(proposal_author) | proposals.read / proposals.write | no |
| proposals/customer-requests | GET / PATCH | legacy / legacy | legacy / cap(proposal_author) | proposals.read / proposals.write | no |
| proposals/public-review-link, send-prep | POST | legacy | cap(proposal_author) | proposals.send | no |
| proposals/delivery-attempts, [proposalId]/versions/[versionId]/pdf | GET | legacy | legacy (read) | proposals.read | no |
| customers/[customerId] | GET / PATCH | legacy | legacy (RLS family A) | customers.read / customers.write | no |
| customers/search, jobs/search, search, properties/*, places/* | GET | legacy | legacy (read) | customers/jobs read | no |
| email/generate, proposal/generate | POST | contractor session (typed) | contractor session: unavailable → 503 | proposals.write | no |
| Public: approve/[token], proposals/accept, sign, customer-request, public-option-choice, public/[token]/pdf, public/payment-requests/checkout, scope-changes/public/[token]/** | — | B token (service role) | unchanged | B | yes |
| Webhooks: payments/webhook, webhooks/stripe/connect, webhooks/resend; track/open | — | C signature / tracking | unchanged | C | yes |
| Retired (410): approval/batch-status, approval/confirm, approve, approve/check, approve/confirm, email/send, email/followup, estimate/send, payments/create-checkout, record-offline, status, status-batch; approval/status (legacy KV token read) | — | none | unchanged | — | no |

Reads remain on the fail-closed legacy helper in Phase B (no full Phase D); every
mutation above moves to a typed gate where unavailable → 503.

## 6. Owner-consistency preflight (staging)

| Check | Result |
|---|---|
| companies | 17 (1 with pointer, 16 quarantined residue: NULL pointer, 0 memberships) |
| memberships | 1 (owner, active); removed 0; roles `{owner:1}` |
| >1 owner per company / removed owner rows | 0 / 0 |
| pointer without active owner membership / owner row ≠ pointer | 0 / 0 |
| NULL-pointer companies with members | 0 |

Design: partial unique index + deferred constraint triggers that re-check only touched
companies at commit. Compatible with the residue (never rewritten, never re-checked unless
touched). Migration `20260927185000_phase13b_b_owner_consistency.sql`.

## 7. Deferred with explicit dependency

- `access_revision` / optimistic revision on Team writes → Phase C `set_member_access_v1`.
- Field-scoped RLS (non-Owner roles on family-A tables) → Phase C.
- Converting read routes off the legacy helper → Phase D.
- Supabase default function privileges for `anon` (future functions) → recommend
  explicit revokes per migration; changing defaults is a platform decision.
- `_synth_*` staging residue tables → staging hygiene task (destructive; not authorized).
- Session revocation for disabled members → Phase F (DB access already closed).
