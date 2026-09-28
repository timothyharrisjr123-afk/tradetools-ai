# Phase 13 — Company Access & User Onboarding Foundation
## Canonical Implementation Blueprint

- Status: **CANONICAL IMPLEMENTATION AUTHORITY** for **Phase 13B — Company Access & User Onboarding Foundation** once accepted by Timothy. Architecture accepted as working direction; corrected 2026-09-27 (RG-0 status, program structure, policy/grant review safety, launch-gate dependency).
- Date: 2026-09-27
- Repo HEAD reconciled: `752e25b1a54b19dc0d808bd02d225cb2654df39c` (`main`)
- Architecture source: [Astra V2 architecture report](phase13-company-access-user-onboarding-astra-architecture-v2.md) (research/recommendation; not execution authority)
- Secondary source: [Global handoff](fielddive-global-handoff.md)
- Precedence: **repo truth > this blueprint > Astra V2 > Astra V1**. Where this blueprint and Astra V2 differ, this blueprint governs.
- Implementation performed while writing this document: **NONE** (no product code, migrations, SQL, DB changes, packages, deploys, pushes, or server management).

> **POWER LIVES UNDER THE HOOD. CLARITY LIVES IN THE INTERFACE.**
> FieldDive knows more than it shows. Internal authority is precise (capabilities, typed scopes, sparse grants/restrictions, delegation ceilings, validity windows, assurance, audit). The interface stays Person · Role · Status · occasional Special access. Sophisticated is not overengineered: relational tables, a versioned registry, a small deterministic evaluator, narrow transactional RPCs. No policy language, no permission matrix UI, no role designer.

### How future sessions must use this document

1. Every Company Access implementation session starts by reading this blueprint, then the section for its phase.
2. Role/access behavior not specified here is **not** improvised. Stop and ask (see §21 and each phase's stop conditions).
3. Decisions marked **LOCKED** are approved product truth. Items marked **TIMOTHY DECISION** must be answered before the phase that depends on them starts.
4. The **Fix-When-Found rule** (§1.8) applies inside this program.
5. This program never weakens the protected systems in §19.

---

## Contents

0. Phase 13 program context and launch-gate status
1. Approved FieldDive product decisions
2. Repo-truth reconciliation
3. Canonical data / authority model
4. Canonical roles
5. Capability model
6. Role defaults
7. Special-access model
8. Scope model
9. Use / delegate / custody rules
10. Create / join model
11. Invitation lifecycle
12. Revocation / custody
13. Team UI contract
14. Enforcement layers
15. AI / copilot authority contract
16. Implementation phases A–H
17. Test / proof requirements
18. Production / staging boundaries
19. Protected systems
20. Deferred extension points
21. Known risks / unresolved implementation questions

---

## 0. Phase 13 program context and launch-gate status

### 0.1 Phase 13 program structure (preserved ownership and sequencing)

| Program | Scope | Status / owner document |
|---|---|---|
| **13A — Launch Gate / Security Foundation** | Slices 0A / 0B / 0C | Implementation checkpoint complete; **coordinated production rollout pending** (§0.2) |
| **13B — Company Access & User Onboarding Foundation** | Tenancy, roles, capabilities, scopes, Field job access, create vs join, invitations, revocation/custody, minimal Team UI | **THIS blueprint** (Phases A–H) |
| **13C — First-Time Business Activation & Product Onboarding** | Simplified first-run experience for a new business Owner; sophisticated readiness/state under the hood; minimal contextual UI; activation target **FIRST REAL PROPOSAL SENT**. Must not be reduced to a generic checklist/wizard | Separate future architecture + implementation program. **Not designed here** |
| **13D — Returning / Invited User Entry** | Resolve membership, role, scope, and a useful destination for returning and invited users; no repeated business onboarding | Separate future program. **Not designed here** |

Boundaries with 13C/13D:
- 13B supplies the authority primitives 13C/13D consume: the access resolver states (§10.1), explicit create-business path (§10.2), join path (§10.3/§11), and capability-based first destination (§13.6).
- 13B Phase D state screens (disabled, invalid role, no access, create business, unavailable) are **minimal honest states only**. They are not activation UX and not returning-user destination design; those belong to 13C and 13D respectively.
- Nothing in this blueprint authorizes 13C or 13D design or implementation.

### 0.2 RG-0 (13A) canonical state — IMPLEMENTATION CHECKPOINT COMPLETE — PRODUCTION ROLLOUT PENDING

| Slice | Commit | Implementation | Proof | Production |
|---|---|---|---|---|
| 0A — secure company bootstrap authority | `8d80f65` | Accepted | Migration applied and verified on **STAGING** | **NOT applied to production** |
| 0B — clean production typecheck | `fc3571e` | Accepted locally | Isolated production typecheck/build proof passed | **NOT deployed to production** as part of this launch gate |
| 0C — hide internal production surfaces | `752e25b` | Accepted locally | Isolated production build + production-mode route proof passed | **NOT deployed to production** as part of this launch gate |

- The coordinated 0A/0B/0C production rollout review and explicit production authorization are **still pending**.
- **Production is not yet protected by 0A.** Production still carries the pre-0A self-membership exposure until 0A is applied there. No section of this blueprint may be read as implying otherwise.

### 0.3 Launch-gate dependency rule

1. Phase 13B implementation (code, local tests, staging migrations and proof) **may be planned and executed while the 13A production rollout is pending**.
2. Production deployment or production migration of any new 13B access behavior **must not leapfrog** the unresolved 13A rollout/provenance. RG-0 reaches production (with its exact SHAs/deployment ids recorded) before RG-1 production application, unless Timothy explicitly authorizes a combined, reviewed rollout.
3. Each phase in §16 states its **13A dependency** explicitly. Any phase depending on bootstrap v2 or on production 0A authority (shared per-user lock, one-per-user unique index, revoked client INSERT) must verify that dependency in its production preflight and stop if it is not met.
4. Production rollout of 13B must be based on a known release provenance (selective release SHA or an explicitly authorized full-main cutover), per `docs/fielddive-release-discipline.md`.

| Phase | 13A dependency |
|---|---|
| A | None for code. Production read-only preflight is independent of 13A rollout (approval still required) |
| B | Staging: none. Production: RG-0 in production first (policy rebuild must not be the first production change on top of unknown bootstrap state) |
| C | Production: RG-0 + RG-1 in production |
| D | **Hard:** 0A applied in production (bootstrap v2 is a forward migration on 0A's lock, index, and grants) |
| E | **Hard:** Phase D (and therefore 0A) in production; accept path shares 0A's lock key |
| F | RG-0..RG-2 in production |
| G | Consumes B–F; production flag off until H |
| H | All of RG-0..RG-3 in production with recorded provenance |

---

## 1. Approved FieldDive product decisions (LOCKED)

### 1.1 Company / tenancy

- Company is the tenant. Identity (Supabase auth user) is global. **Membership is company access authority.**
- Authentication alone is never company access.
- **One company membership per user** (any state) remains the launch invariant, enforced by Slice 0A's `company_memberships_one_per_user_uidx (user_id)`.
- Users never choose company IDs and never self-create memberships. Memberships are created only by (a) the Slice 0A bootstrap authority for a business creator or (b) the invitation-acceptance authority (Phase E).

### 1.2 Canonical display roles

`Owner` · `Admin` · `Sales` · `Production Lead` · `Field`. No additional displayed roles unless implementation proof shows a repeated archetype cannot be represented safely by role + special access.

### 1.3 Owner

- Exactly **one custody Owner** per company at launch: `companies.owner_user_id`.
- Custody is internally distinct from capability resolution (§9).
- Ownership transfer is a dedicated protected operation (Phase F). The normal role control can never assign or remove Owner.
- Owner never bypasses tenant, lifecycle, proposal, payment, or contractual invariants. Owner holds every *registered, active* capability by profile — never a wildcard.

### 1.4 Admin

Broad operational administration. **Not by default:** internal costs, company financial reporting, refunds, payout/payment-provider configuration, sensitive privilege delegation.

### 1.5 Sales

Customer/job preparation, measurement participation, proposal drafting/sending. **Not by default:** operational approval. **Special access:** request payments, internal costs, company financials.

### 1.6 Production Lead

Company-wide production coordination: scheduling, production responsibility, task assignment, work start/complete, hold/resume. **Not by default:** proposal, pricing, financial administration.

### 1.7 Field

- Restricted to **explicitly authorized jobs** via a real multi-user job-access relation (§8.3).
- Safe job-linked customer/work context only. No customer directory. No proposal/pricing/financial visibility.
- Field scoping is **never** faked with hidden navigation, `jobs.assigned_to`, task assignment, or client-side filtering.
- Ordinary Field users are not promoted as "restricted" until Phase C enforcement and Phase H proof pass.

### 1.8 Fix-When-Found rule

A confirmed defect in the access/onboarding system is fixed in the current phase when its root cause is understood, the durable correction is bounded, and protected truth stays safe. Defer only when a material product decision is needed, production mutation requires explicit approval, root cause is unresolved, or it belongs to a genuinely separate system. Every deferral is recorded in the phase report with the reason.

This rule stays active through every phase. If Phase A/B (or any later phase) confirms a current access/security defect that (1) belongs to this system, (2) has an understood root cause, and (3) has a bounded durable fix, it is fixed **in the owning phase** — including defects that were not in the Astra reports or in §2. Do not create a growing "later" bucket merely because a defect was newly discovered.

### 1.9 Other locked decisions

| Topic | Locked decision |
|---|---|
| Authorization model | Role default + sparse grants + sparse restrictions + typed scope + optional validity window + domain eligibility + assurance where required (§3.4) |
| Deny semantics | Restrictions win within their scope (§3.5) |
| Use / delegate / custody | Separate powers; `canUse(X)` never implies `canDelegate(X)` (§9) |
| Delegation at launch | Owner manages Admin authority and all sensitive packages; Admin manages ordinary Sales/Production Lead/Field staffing within a fixed ceiling; no recursive delegation, no self-elevation, no peer-Admin elevation |
| Create vs join | Distinct server-authorized paths; no membership ≠ create a company (§10) |
| Invitation states | Invitation: `pending` / `accepted` / `revoked`; expiry is a deadline (`expires_at`), not a stored state. Membership: `active` / `disabled` |
| Invite expiry | 7 days default; not contractor-configurable at launch |
| Removal | "Remove access" = disable first; operational handoff second; handoff failure never restores access (§12) |
| Strong auth | Required for custody and genuinely high-risk operations; never for ordinary field work; a confirmation dialog is not reauthentication (§12.5) |
| Team UI | Person · Role · Status (+ quiet Special access indicator); member drawer with explicit Save; no matrix; no "Full access" (§13) |
| Copilot | Acts strictly on behalf of the authenticated human; never broader (§15) |
| Field job access | **APPROVED for the foundation** (Phase C) |

### 1.10 Locked architecture — not reopened without new repo evidence

The following are not reopened by implementation sessions, reviews, or later reports unless **new repo evidence** shows one cannot be implemented safely (in which case: stop, report the evidence, ask):

- Company is the tenant.
- Roles: Owner / Admin / Sales / Production Lead / Field.
- One custody Owner at launch.
- Invalid/unknown roles fail closed.
- Field is limited to explicit job scope.
- Role defaults + sparse grants/restrictions.
- Typed scopes.
- Use / delegate / custody separation.
- Explicit create vs join.
- Seven-day invitation expiry.
- Disable first, handoff second.
- Strong auth for sensitive actions.
- Copilot inherits (never exceeds) the acting human's authority.
- Minimal Team UI over sophisticated authorization.

---

## 2. Repo-truth reconciliation

Evidence was read from source at HEAD `752e25b`. Database findings are **source-level** (migrations; the baseline migration is the authoritative pre-recovery production schema dump). No live SQL was run in this session; every DB finding below requires Phase A read-only confirmation on staging and production before a migration is written.

Legend: **CONFIRMED** · **NOT CONFIRMED** · **CHANGED SINCE ASTRA** · **INCONCLUSIVE** · **NEW** (not in Astra V2).

### 2.1 Astra V2 findings

| # | Astra V2 finding | Status | Repo evidence | Consequence |
|---|---|---|---|---|
| R1 | Unknown/empty role ⇒ Owner | **CONFIRMED** | `app/lib/companyMembershipRoles.ts` `normalizeCompanyMembershipRole` final branch `return "owner"` | Fail-open elevation. Phase A |
| R2 | `owner_admin` conflation | **CONFIRMED + WORSE** | `presetFromMembershipRole` maps `owner` and `admin` to one preset `owner_admin`; `roleValueForPreset("owner_admin")` returns **`"owner"`**; Team PATCH writes that value | Any "Owner / Admin" assignment would write `role='owner'` for a non-custody member. (Currently blocked only because the write path lacks RLS authority — R6.) Phase A/B |
| R3 | Session role fallback to Owner | **CONFIRMED (×2)** | `companyMembershipSession.ts:35` and `companyMembershipPersistence.ts:94` both use `role ?? "owner"` | Second/third elevation path. Phase A |
| R4 | `ensureUserIdentity` unconditional bootstrap | **CONFIRMED** | `ensureUserIdentity.ts` always calls `bootstrap_current_user_company_v1`; called from 14 server entrypoints (13 protected pages + `admin/layout.tsx`). The RPC admits every authenticated caller | Any authenticated user with no membership receives "My Company" + Owner on first protected page load. Invitations cannot ship on top of this (§10.6). Phase D |
| R5 | `removed_at` not enforced in RLS | **CONFIRMED** | 117 `CREATE POLICY` statements across 45 tables reference `company_memberships`; **0** check `removed_at` (baseline predates the Phase 7 `removed_at` column). Only Phase 10 scope-change functions check `removed_at` | A disabled member with a still-valid JWT can read/write tenant rows through direct PostgREST. Server routes are safe (they use `getUserCompanyId`, which checks `removed_at`). Phase B |
| R6 | Team persistence lacks DB authority | **CONFIRMED + WORSE** | `company_memberships` has only self-row SELECT (`"Users can view their memberships"`); no UPDATE policy. `profiles` SELECT is self-only. `companyMembershipPersistence.ts` updates role/`removed_at` via the user-session client | Team list returns only the viewer; role change and removal update 0 rows → `not_found`. The Team feature cannot work for real multi-user companies today. Phase B |
| R7 | Directory/profile read boundary | **CONFIRMED (latent)** | `GET /api/company/members` gated by `customers_jobs` (held by Field) returns emails + assignment counts; `validateLiveCompanyMember` / `listLiveCompanyMembers` read other users' membership + profile rows through the user client | Widening `profiles`/membership SELECT naively would expose emails/access metadata to Field. Must use minimal projections. Phase B |
| R8 | Remove/reassign partial failure | **CONFIRMED** | `removeCompanyMember`: sets `removed_at`, then separate job/task updates whose errors are ignored; returns counts from `data?.length ?? 0` | Handoff failure reported as "0 cleared"; outcome conflated with revocation. Phase B (honest result) / F (handoff model) |
| R9 | Assignment counts failed-as-zero | **CONFIRMED** | `loadOpenAssignmentCounts` ignores `error`, returns `count ?? 0` | Unknown work shown as zero. Phase B |
| R10 | Historical reassignment scope | **CONFIRMED** | Removal reassigns `jobs.assigned_to` for every non-deleted job (no stage/lifecycle filter) | Completed/closed/lost job responsibility can be rewritten. Phase B |
| R11 | No invitations | **CONFIRMED** | No invitation table, RPC, route, or UI. Team editor empty state says "Invite people when you're ready to share jobs." | Copy promises an absent feature (placeholder). Phase G removes/replaces |
| R12 | No sparse override / audit foundation | **CONFIRMED** | No grant/restriction/audit tables; capabilities are hard-coded preset sets in TS; no profile versioning | Phase C |
| R13 | Field job-access relation gap | **CONFIRMED** | Only `jobs.assigned_to` (single production lead) and `job_tasks.assigned_to`. All job/customer/proposal/payment RLS is company-wide. Field "restriction" is presentation only (`JobCardClient` `suppressCommercial`, `isRestrictedFieldRole`) | Field users can read every job, customer, proposal, price, and payment in their company via API/PostgREST. Phase C |
| R14 | One-company invariant spans disabled rows | **CONFIRMED** | Slice 0A unique index on `(user_id)` regardless of `removed_at`; bootstrap returns `removed` | Disabled user cannot join another company; honest conflict/support path required (Phase D/E) |
| R15 | Public-token metadata company-scoped SELECT | **CONFIRMED (low)** | `proposal_public_access_tokens_select_company_scope` allows any member (incl. Field, incl. disabled per R5) to read token rows (hashes, not raw tokens) | Restrict to proposal readers in Phase B/C; not an exploit claim |
| R16 | Handoff date / Slice 0A arbitrary self-membership | **CHANGED SINCE ASTRA (fixed in code + staging; production pending)** | Slice 0A (`8d80f65`) dropped the self-insert policy and revoked client INSERT; migration applied/verified on **staging only** | Resolved at the implementation level; do not re-scope into 13B. **Production remains exposed until the 13A coordinated rollout applies 0A** (§0.2, §18.4) |

### 2.2 New findings (not in Astra V2)

| # | Finding | Status | Evidence | Consequence |
|---|---|---|---|---|
| N1 | Member validation/listing for assignment is broken under RLS | **NEW / CONFIRMED (source)** | `validateLiveCompanyMember` selects another user's membership via the user client; self-only SELECT ⇒ `member_not_found`. `listLiveCompanyMembers` returns only self | Assigning another member as production lead / task assignee, and member pickers, cannot work for multi-user companies today. Directory RPC in Phase B fixes all callers |
| N2 | Membership read failure collapses to "no membership" | **NEW / CONFIRMED** | `getUserCompanyId` returns `null` on error; `loadLiveMembershipSession` returns `null` on error (→ 403 `forbidden`); `validateLiveCompanyMember` maps error → `member_not_found` | UNKNOWN becomes EMPTY. Phase B typed results |
| N3 | Pages discard the typed identity result | **NEW / CONFIRMED** | All protected pages call `await ensureUserIdentity(...)` and ignore the result, then `getUserCompanyId` → `null` ⇒ `redirect("/login?...")` while the user is still signed in | Disabled member / read failure gets a login redirect instead of an honest "access removed" / "couldn't verify access" state. Phase D |
| N4 | Several sensitive routes are membership-only (no capability) | **NEW / CONFIRMED** | `confirm-acceptance`, `acknowledge-acceptance` (operational approval), `company/payments/settings` (payment configuration), `company/timezone`, `jobs/payment-requests` (create request), `jobs/[jobId]/tasks` (create), `jobs/[jobId]/attachments` use only `getUserCompanyId` | Any active member (incl. Field) can approve jobs, change payment settings, and create payment requests by direct API call. Phase B |
| N5 | `company_admin` capability is unused | **NEW / CONFIRMED** | No route references `"company_admin"` | Company settings mutations are ungated by role (N4). Phase B |
| N6 | Current route capability map | **NEW (inventory)** | `payment_admin`: payments/connect, refunds · `payment_request`: payment-link, payment-requests collect, payment-request email · `proposal_author`: proposals/send, customer-record-link, scope-changes · `schedule_mutate`: jobs/schedule · `job_assign`: production-lead · `task_assign`/`task_complete`: tasks/[taskId] · `lifecycle_start_complete`: start-work, complete-work · `job_pause_resume`/`job_disposition_finalize`: change-disposition · `member_admin`: members PATCH · `customers_jobs`: members GET | Basis for the Phase A capability mapping (§5.4) |
| N7 | Function EXECUTE grants need review | **NEW / INCONCLUSIVE** | Baseline dump grants EXECUTE on 75 `public` functions to `anon`/`authenticated` (106 grants; 74 `SECURITY DEFINER` occurrences). Later migrations revoke some. `create_job_payment_request_v1`, `collect_job_payment_v1`, `select_job_measurement_v1`, `change_job_property_v1`, `resolve_company_property_v1` are granted to `authenticated` | Each definer function must validate active membership (+ capability where relevant) internally. Phase B function/grant inventory on live catalogs (§14.10); grants change only where proven excessive or unsafe |
| N8 | Storage policies not in migrations | **INCONCLUSIVE** | No `storage.objects` policy in `supabase/migrations`; attachments are served via service-role routes + signed URLs | Phase B must read live storage policies and confirm the bucket is private with no member-wide object policies |
| N9 | `companies` SELECT/UPDATE policies | **CONFIRMED (partial)** | SELECT via membership subquery without `removed_at`; UPDATE only when `owner_user_id = auth.uid()` | Disabled members can read company row; Admin company-settings writes that rely on RLS UPDATE fail for non-Owner. Phase B inventory decides RPC vs policy |
| N10 | Removed-member session after disable | **CONFIRMED (server) / INCONCLUSIVE (direct)** | Every server route re-reads membership per request (live). Direct PostgREST inherits R5 | Phase B closes direct path; optional session revocation in Phase F |

### 2.3 Not confirmed / nuanced

- **"Team persistence could let Admins edit Owner"** — NOT CONFIRMED in practice: writes fail under RLS (R6). The *code* contains the defect (R2) and must be fixed before any write path is authorized.
- **"Public tokens stealable"** — NOT CONFIRMED; rows hold hashes. Treated as metadata minimization only.
- **Live policy set** — INCONCLUSIVE until Phase A compares `pg_policies` on staging and production with the migration set.

### 2.4 Phase A reconciliation record (2026-09-27)

- **Observed role values:** staging (read-only, 2026-09-27) `owner`=1 live, 0 removed; production (read-only 0A preflight, 2026-09-25) `owner`=1, 0 removed. No alias, null, or legacy values anywhere ⇒ §4.7 resolved: the reader accepts **only** the five stable keys, with no alias data migration.
- **Production custody:** 1 company, 0 pointer/role mismatches, 0 null pointers, 0 orphan companies (2026-09-25).
- **Staging custody drift (N11, NEW):** all 17 staging companies have `owner_user_id` NULL. All were created 2026-09-09 by service-role proof scripts that inserted companies directly (no pointer). STG-COMPANY-01 is the synthetic staging tenant (one live `owner` membership, small product graph): repair-eligible by setting the pointer to its sole owner membership. STG-COMPANY-02..17 are synthetic payment-account concurrency/recovery proof residue (payment-account rows only, no memberships, 12 already renamed `[CONC-CLEANED]`); deletion is blocked by the `company_payment_accounts_row_guard` delete guard and `ON DELETE RESTRICT`. Staging is **not** a valid custody fixture until an authorized repair; the I-3/I-4 constraint (Phase B) must exempt or first resolve membership-less residue. Pre-0A and 0A creation code both set the pointer; this is data drift, not a code path.
  - **Repaired (staging, 2026-09-27):** STG-COMPANY-01 pointer set to its sole live owner membership in one guarded statement (pointer NULL, exactly one live owner, owner user in auth with no other membership/pointer, exactly one row updated). Staging now: 17 companies, 1 pointer, pointer = live owner membership, 0 companies with a live member and no pointer.
  - **Quarantined (staging):** STG-COMPANY-02..17 remain (16 companies, 46 payment-account rows, no memberships, no other rows in any `company_id` table). `company_payment_accounts_row_guard` rejects every DELETE unconditionally (SECURITY INVOKER, no role branch) and the FK is `ON DELETE RESTRICT`; retirement would require disabling the guard (`DISABLE TRIGGER` or `session_replication_role = replica`, which also skips FK triggers). Not done. Phase B I-3/I-4 constraints must exempt membership-less companies or a reviewed retirement path must exist first.
- **Interim capabilities (Phase A):** only `owner` holds capabilities. `admin`, `office_sales`, `production_lead`, `field_user` are recognized identities with **no** capabilities until Phase C role profiles; no non-Owner users exist in staging or production. `job_scope_change_author_ok_v1` (reachable via authenticated `mint_job_scope_change_public_access_token_v1`) is brought to parity by forward migration `20260927171000_phase13b_a_scope_change_author_interim_owner_only.sql` (applied to staging 2026-09-27; production pending).
- **Author helper EXECUTE exposure (N13, NEW, pre-existing since Phase 10):** live staging shows `anon` and `authenticated` hold EXECUTE on `job_scope_change_author_ok_v1` despite `revoke all … from public` (Supabase default privileges grant directly to those roles; `create or replace` preserves the ACL). It grants no authority (mint still returns `forbidden` for every non-Owner), but it is a membership oracle for callers who already hold both UUIDs. Owned by the Phase B function/grant review (§14.10): revoke from `anon, authenticated` explicitly and sweep other SECURITY DEFINER helpers for the same pattern.
- **Silent company-settings save (N12, NEW, fixed in A):** `companies` UPDATE is custody-only (`owner_user_id = auth.uid()`), so non-custody saves updated 0 rows yet reported success. The save now requires a returned row.
- **Live `company_memberships` grants:** `anon` SELECT and `authenticated` UPDATE table grants remain (no UPDATE policy, so they are inert under RLS). Recorded for the Phase B grant inventory (§14.10); not changed in A.
- **Phase A forward migration (applied to staging 2026-09-27; production pending):** `20260927170000_phase13b_a_membership_role_fail_closed.sql` drops `role DEFAULT 'owner'` and adds the stable-key CHECK, refusing to apply if any non-canonical value exists. No custody changes.
- **Phase A staging proof (2026-09-27):** post-apply, `role` has no default, is NOT NULL, and carries the validated five-key CHECK; 0 violating rows. A rolled-back fixture transaction proved: bootstrap (as `authenticated`) creates one `owner` membership with pointer and is idempotent; the four non-Owner keys persist; `invalid_role`, `Owner`, and unknown updates are rejected (23514); a missing role is rejected (23502), not defaulted; direct client promotion to `owner` updates 0 rows (Owner or Admin actor); `companies` UPDATE succeeds only with the pointer (Owner role without pointer: 0 rows); the author helper admits only `owner`; direct `mint_job_scope_change_public_access_token_v1` returns `forbidden` for Admin, Office / Sales, Production lead, Field and non-members, and passes the author gate for the Owner (`not_found` on a synthetic scope change). No fixtures remained.
- **Phase A status:** CLOSED for code + staging. Production application of the two Phase A migrations rides with the 13A/13B production rollout (§0.3, §18.4). Carried into Phase B: N11 residue quarantine (I-3/I-4 exemption or reviewed retirement), N13 helper grants, `company_memberships` inert table grants.

### 2.5 Phase B enforcement record (2026-09-27)

- **Inventories (entry gate):** [`phase13b-b-enforcement-inventory.md`](phase13b-b-enforcement-inventory.md) (policies, definer functions, grants, storage, routes, owner preflight) and the generated [`phase13b-b-policy-inventory.json`](phase13b-b-policy-inventory.json) (126 live policies with full `USING`/`WITH CHECK`, all present in migrations). Every policy classified: **120 family A** (employee/member, on 50 tables — every policy that referenced `company_memberships`) and **6 family D** (self-row profile/membership, custody-only `companies` UPDATE, payment-terms write deny). No family was unclear.
- **Forward migrations (applied to staging 2026-09-27; production pending):**
  - `20260927180000_phase13b_b_active_membership_rls.sql` — `private` schema (no `anon` usage); `private.current_active_company_id()` (SECURITY DEFINER, stable, `auth.uid()`, `removed_at IS NULL`, canonical role); interim `private.role_has_capability_v1` mirroring `OWNER_CAPABILITIES` exactly; the 120 family-A policies rebuilt with `ALTER POLICY … TO authenticated` using the helper, all other conjuncts verbatim. R15: token-metadata SELECT additionally requires `proposal_author`.
  - `20260927181000_phase13b_b_rpc_active_membership_capability.sql` — the 19 employee definer RPCs that ignored `removed_at` now require an active membership plus the capability mirroring their route gate (money, configuration, acceptance, schedule, lifecycle, authoring). `job_contract_total_cents_v1` returns NULL for a signed-in caller outside its active company.
  - `20260927182000_phase13b_b_team_directory_and_member_rpcs.sql` — `list_company_directory_v1` (active members of the caller's company: id, display name, role; **no email**); `list_company_access_admin_v1` (`member_admin`; emails, disabled members, open-work counts); `set_company_member_role_v1` (no `owner`, no self-change, Admin changes need custody, idempotent); `disable_company_member_v1` (revocation only, idempotent, no self/owner); `handoff_member_open_work_v1` (disabled targets only; open work only — not deleted, not archived, stage not complete/archived, status not lost/closed/archived; open tasks only; reassign target must be an active same-company member). R6, R7, R8, R9, R10, N1 resolved.
  - `20260927183000_phase13b_b_function_and_table_grants.sql` — N13 resolved: internal helpers (`job_scope_change_author_ok/member_ok/lines_json/replace_lines`, `proposal_payment_terms_seed_from_settings_v1`, `proposal_acceptance_contract_option_v1`) and the service-role-only public scope-change token RPCs lose `anon`/`authenticated` EXECUTE; employee scope-change RPCs and `job_contract_total_cents_v1` lose `anon`. `company_memberships` loses `anon` SELECT and `authenticated` UPDATE.
  - `20260927184000_phase13b_b_job_attachments_bucket_private.sql` — keeps `job-attachments` private if created (staging has 0 buckets and 0 object policies; N8).
  - `20260927185000_phase13b_b_owner_consistency.sql` — I-3/I-4: partial unique owner index + deferred constraint triggers on `company_memberships` and `companies` (owner row active and equal to the pointer; pointer requires owner row; new companies and companies with members require an owner). Checks only companies touched by a statement, so the 16 quarantined N11 residue companies (no pointer, no members) are untouched and remain valid. No memberships fabricated; payment-account guard unchanged.
- **Server (N2, N4, N5):** typed company access (`active`/`disabled`/`none`/`invalid_role`/`unavailable`); `getUserCompanyId` returns a company only for an active canonical membership; unavailable maps to 503 `authorization_unavailable`, never 403/empty. N4 routes gated: acceptance confirm/acknowledge `job_approve`; payment settings `payment_admin`; payment requests/checkout/cancel/balance `payment_request`; timezone `company_admin`; reschedule/unschedule `schedule_mutate`; payment terms, customer requests, review link, send-prep `proposal_author`; task create `task_assign`; attachment writes `photo_mutate`. `job_approve` added to the interim registry (Owner only). Team persistence is RPC-only; removal is disable-first then handoff, and a handoff failure is reported as failed (never "0 cleared"); the Team editor shows load failure and pending handoffs.
- **Staging proof (2026-09-27, rolled back, 0 fixtures remaining):** catalog — 120 policies use the helper, 0 reference `company_memberships`, all 19 RPCs check `removed_at`, grants as above, 0 public buckets. Adversarial matrix (2 bootstrapped tenants, 5 roles, disabled member, stranger, anon): disabled member with a valid JWT sees 0 jobs/tasks/company rows, is denied every RPC and insert, and its helper resolves NULL; cross-tenant reads 0, writes 0 rows or 42501; Field denied timezone/role/disable/access-admin; directory keys are `user_id, display_name, role` only; role RPC rejects self, `owner`, and other-tenant targets and is idempotent; disable leaves assignments untouched; handoff moves only the open job and open task, leaving closed/archived/deleted jobs and completed tasks; anon and authenticated get 42501 on internal helpers, token RPCs, directory, and `private`; owner constraints reject disabling/deleting the owner row, a second owner, a pointer without owner row, and ownerless new companies; residue count 16 before and after.
- **Deferred (by design):** `access_revision` / `expected_revision` → Phase C (`set_member_access_v1` replaces the Phase B role RPC); Field-scoped RLS → Phase C; read-route capability classification → Phase D; session revocation on disable → Phase F; Supabase default-privilege tightening and `_synth_*` table hygiene → separate reviewed task; Team visual proof (desktop + 390) not captured (user-owned runtime).
- **Phase B status:** CLOSED for code + staging. Production application rides with the 13A/13B production rollout (§0.3, §18.4).

### 2.6 Phase C policy foundation record (2026-09-27)

- **Single source of truth:** `app/lib/access/registry.ts` holds capabilities (39: 31 ACTIVE, 8 RESERVED), dependencies (DAG, validated), role profiles v1 for the five roles, and 11 packages (8 ACTIVE, 3 RESERVED). `app/lib/access/registrySql.ts` generates the SQL seed; a parity test fails when the migration seed and the TS registry diverge. TypeScript never evaluates access; it maps the database decision.
- **Forward migrations (applied to staging 2026-09-27; production pending):**
  - `20260927190000_phase13b_c_access_registry.sql` — registry tables (RLS on, no client grants) + generated seed + `private.access_registry_violations_v1()` (unknown/reserved profile entries, dependency cycles, scope mismatches); migration aborts on any violation.
  - `20260927191000_phase13b_c_access_rules_job_grants_audit.sql` — `company_memberships.role_profile_version` (FK to profiles), `access_revision` (≥ 1), `disabled_by`, `disabled_reason`; `company_member_access_rules` (grant = package only; restrict = package or capability; typed scope `company | granted_jobs | job`; `valid_from`/`valid_until`; authority source; soft revoke; content immutable; tenant trigger); `job_access_grants` (§8.3 relation; tenant trigger; one active grant per job/user; `source` manual / task_assignment / production_lead_assignment / migration); `company_access_events` (append-only). No client grants on any of the three.
  - `20260927192000_phase13b_c_access_evaluator.sql` — `private.evaluate_access_v1` is the only evaluator (precedence: membership → capability ACTIVE → resource in company → restriction → profile/grant at scope → dependencies → assurance; database `now()`; reason codes `allowed | not_member | membership_disabled | invalid_role | capability_missing | scope_missing | restricted | dependency_missing | authorization_unavailable`; cross-tenant and nonexistent resources both return `scope_missing`, never `different_company`). Wrappers: `private.member_can_v1`, `private.member_job_ids_v1`, `private.delegation_tier_v1` (service-role only), `public.check_my_access_v1` (routes), `public.get_member_effective_access_v1` (client projection: capability keys only).
  - `20260927193000_phase13b_c_rpc_canonical_capabilities.sql` — the 19 Phase B RPCs plus scope-change propose/token and `job_contract_total_cents_v1` now call the evaluator with canonical capabilities (and `jobId` where job-scoped). `job_contract_total_cents_v1` returns NULL without `proposals.read` (Fix-When-Found: contract total leak to non-commercial roles).
  - `20260927194000_phase13b_c_capability_scoped_rls.sql` — 118 family-A policies gain capability predicates (tenant predicate and other conjuncts verbatim; `companies` and `company_branding_profiles` SELECT unchanged; family D untouched); jobs, tasks, schedules, attachments, and measurements admit Field via `member_job_ids_v1(<cap>)`; commercial tables (proposals, estimates, payments, pricing, templates, scope changes) require commercial capabilities.
  - `20260927195000_phase13b_c_access_mutations_field_brief.sql` — `set_member_access_v1(target, role, expected_revision, packages, restrictions, request_id)` replaces `set_company_member_role_v1`; `grant_job_access_v1` / `revoke_job_access_v1`; assignment coupling trigger (Q1b); `disable_company_member_v1` with expected revision and audit; `handoff_member_open_work_v1` audited; `list_company_access_admin_v1` adds revision / packages / restriction count / granted-job count; directory scoped (below); `get_job_field_brief_v1`; legacy `role_has_capability_v1` / `current_member_has_capability_v1` dropped after a zero-reference check.
- **Delegation (§9):** Owner = custody (all non-Owner roles, every ACTIVE package, every restriction). Admin ceiling = Sales / Production Lead / Field targets, `admin`-assignable packages only, never self / Owner / Admin targets, never a target holding an Owner-only package, never lifts an Owner-set restriction. Production Lead ceiling = Field job access only. Use-authority never implies delegation. Every mutation: target row locked, expected revision (stale → `stale_revision`), revision bump, one audit row in the same transaction. Packages are never dropped implicitly on role change (`packages_incompatible`); grant + restriction on the same authority is rejected (`grant_restriction_conflict`); restrictions are never silently cleared.
- **§21 Admin boundary held:** Admin has no payments, pricing/templates, `scope_changes.issue`, or reserved capabilities by default. Admin holds `team.manage` (sensitive) because the ordinary delegation ceiling requires it; all sensitive packages remain Owner-assignable only (Q3 Owner-only).
- **Scope-change split:** drafts (create / edit / void / decline) require `scope_changes.write` (Owner, Admin, Sales); propose and the customer review link require `scope_changes.issue` (Owner, or the Owner-granted `issue_scope_changes` package). Job Card hides Propose without issue authority.
- **Field projection (§8.3 / §11):** Field (and Production Lead, who lacks `proposals.read`) render the Job Card through `/api/jobs/[jobId]/field-brief` → `get_job_field_brief_v1`: job/customer/address, crew label, production lead, approved scope label, accepted flag, proposed/authorized scope-change reasons and line descriptions (no deltas), and names of people on the job. No prices, totals, terms, costs, margins, payments, or other jobs. The parser whitelists fields.
- **Decisions applied (blueprint recommendations; confirm before production):** Q1b assignment coupling — assigning an active Field member as task assignee or production lead creates an explicit audited grant in the same transaction when the actor holds company-scope `jobs.assign` (or there is no end-user actor); unassigning never revokes. Q2 — moot at this checkpoint: staging and production have no non-Owner members, so no grandfather migration is needed. Q7 — no production Field members, so no backfill.
- **Reported boundaries (no silent broadening):**
  - `pricing.cost.read` stays RESERVED: proposal authoring computes from catalog costs through `proposals.write`, so a real cost-read boundary needs a product change (cost-free authoring projection).
  - Payment accounts / settings SELECT remains readable with `proposals.write` because authoring seeds payment terms from settings.
  - Activity and attention feeds are company-scope `jobs.read` only (stricter than §8.3: Field sees none rather than granted-job items).
  - Production Lead has no `proposals.read`; it gets the restricted Job Card presentation and the Field brief.
  - Directory: members with company-scope `jobs.read` or job-scope `tasks.manage` see names/roles; plain Field sees only its own row (the brief carries the names it needs).
  - Role change keeps held packages and refuses incompatible ones; job-access grants persist across role changes (inert for company-scope roles).
  - The `lead_assigned_work` package lists `production_lead` in `assignable_by`, but `set_member_access_v1` admits only Owner/Admin tiers; Production Lead package delegation is deferred to Phase G.
- **App:** routes use `requireAccess` / `checkAccess` with canonical capabilities and `jobId`; `authorization_unavailable` → 503; the members route returns viewer access flags from `get_member_effective_access_v1` (503 when unavailable, never silent no-admin); Team editor sends `expectedRevision`; role labels Owner / Admin / Sales / Production Lead / Field; attachment routes are job-scoped (`photos.contribute` / `jobs.read` with `jobId`); legacy TS capability sets removed.
- **Tests:** `app/lib/phase13cAccessPolicy.test.ts` (registry validation, seed parity, SQL precedence/fail-closed/`now()`/no `different_company`, delegation tiers, legacy vocabulary absent from app/api, app/lib, app/tools, RLS job-scope, Field brief without money, client mappers). Full suite 4464 tests: only the 25 recorded baseline failures; source `tsc` clean.
- **Staging proof (2026-09-27, rolled back, 0 fixtures remaining):** DryRun listed exactly the six migrations; ApplyPending succeeded. Adversarial matrix (2 bootstrapped tenants; Owner, Admin, 2 Sales, Production Lead, 2 Field, stranger, anon): Owner reserved/unknown → `capability_missing` (not a wildcard); Admin denied payments/pricing/issue, allowed `team.manage`/send; Sales allowed send/write, denied assign/team/issue; Production Lead denied proposals/payments, allowed assign/tasks; Field reads only the granted job (RLS 1 job, search 1, tasks only on that job, sibling/cross-tenant/missing → `scope_missing`, brief sibling/cross → `not_found`, 0 proposals, 0 payment requests, contract total NULL, brief has no money keys, directory 1 row, own task allowed / other task `scope_missing`, sibling updates 0 rows); sparse grant (Issue package) → allowed; restriction beats grant; job-scoped restriction; restricted prerequisite → `dependency_missing`; validity future/expired → denied, live → allowed; reserved/unknown/ineligible packages rejected; Admin ceiling (`owner_role_protected`, `owner_required` ×4, `package_not_delegable`, `cannot_change_own_access`); PL grant/revoke Field job access, non-Field target `target_ineligible`, PL/Sales/Field `set_member_access` denied; stale revision rejected (member and job access, disable); audit rows carry revision before/after, actor, request id; forced failure after a mutation rolled back change + audit together (0 events); events update/delete 42501; rule content immutable, cross-tenant grants/scope jobs 23514, unknown profile version 23503; disabled Field (valid JWT) sees 0 jobs/tasks, evaluator `membership_disabled`; cross-tenant Owner: 0 rows, all RPCs `not_found`/`scope_missing`, no directory leak; anon/authenticated 42501 on registry, access tables, evaluator, tier function, events; legacy role RPC gone; residue 16 before/after. Post-proof: 0 rules, 0 grants, 0 events, all memberships revision 1 / profile v1, registry violations 0.
- **Not done here (by design):** visual proof — the local runtime (user-owned) targets production, which does not have Phase B/C migrations, so no Field runtime fixture exists; Team UI redesign (Phase G); resolver/invitations/MFA/ownership transfer (D–F).
- **Phase C status:** CLOSED for code + staging. Production application rides with the 13A/13B production rollout (§0.3, §18.4).

### 2.7 Phase D access-resolution record (2026-09-27)

- **Resolver:** `resolve_current_user_access_v1()` (SECURITY DEFINER, `auth.uid()` only, no arguments). States: `active`, `disabled`, `invalid_role`, `pending_invitation`, `creator_eligible`, `no_access`. A failed read is not a state; the server maps it to `authorization_unavailable` and never to `no_access` or `creator_eligible`.
- **Precedence:** membership occupies the one-per-user slot, so it outranks invitations and admission. Order: active valid membership → removed membership (`disabled`, even if a pending invitation exists) → invalid role or profile version → pending invitations for the **verified** email (`email_confirmed_at` set; exact lower-trimmed match; not expired) → live creator admission → `no_access`. Several pending invitations are all returned, ordered by expiry then id, with company label, proposed role, and expiry only — no company id, no packages, no jobs. None is auto-selected and none grants a membership.
- **Creator admission (Q4, controlled access, per the Phase D command):** `company_creator_admissions` (`issued` / `consumed` / `revoked`), optional expiry, source `support` | `migration` | `system`, consumed timestamp and resulting company. One live admission per user. No client grants. Absence of a membership is not eligibility. There is no public issue RPC; issuing an admission is a service/support write until a later phase.
- **Bootstrap v2:** `bootstrap_current_user_company_v2(intent, company_name, acknowledge_pending_invitations)`. Intent must be `create_business`. Inside the transaction: shared lock, existing membership returns `existing` (replay; no second company), removed returns `removed`, invalid role returns `invalid_role`, an unacknowledged pending invitation for the verified email returns `pending_invitation` (admission not consumed), a missing or expired admission returns `admission_required`, otherwise one company + one `owner` membership and the admission is consumed in the same transaction. The caller cannot choose a company id or a role. A name longer than 80 characters is `invalid_payload`; a blank name stays `My Company`.
- **Acknowledging an invitation does not accept or delete it.** It only lets an admitted creator proceed. The invitation stays `pending`. Once the membership exists the resolver returns `active`. Phase E accept will see the membership and return `membership_conflict`.
- **Shared lock:** `private.lock_user_membership(uid)` takes `hashtextextended('fielddive.bootstrap_current_user_company_v1:' || uid, 0)`. Bootstrap v2 calls it. Phase E `accept_company_invitation_v1` must call the same function before it reads or writes that user's membership. Authenticated cannot call the lock directly.
- **v1:** replaced with `bootstrap_v1_retired` (42501) and EXECUTE revoked from `public`, `anon`, and `authenticated`. Deliberate deviation from the blueprint's "keep v1 granted until production proof" note: a granted v1 would recreate implicit company creation. Production cutover must ship this app and these migrations together; rollback is a forward fix, not a re-grant of v1.
- **Invitation read model:** `company_invitations` matches §11.1 (no issue/accept/resend/revoke RPCs, no delivery log). RLS on, no client grants. Phase E adds the mutations.
- **Callers:** `ensureUserIdentity` syncs the profile only. Fourteen protected pages and `app/admin/layout.tsx` call `requireActiveCompanyPage`, which resolves and redirects every non-active state to `/start`. `/start` renders the six non-active states and posts to `/api/access/create-business`, the only caller of bootstrap v2. API routes still take the active company id from `getUserCompanyId` (no bootstrap; an unavailable read stays fail-closed). Auth callback and a session-present signup land on `/start` when no return path was given, so an invitation or admission survives confirmation. `/p/[token]` does not use the resolver.
- **Company delete:** `20260927201000` changes the admission's resulting-company foreign key from `ON DELETE SET NULL` to `ON DELETE CASCADE`. SET NULL cleared the pointer while status stayed `consumed`, which the check rejected, so the company could not be deleted.
- **Staging proof (2026-09-27, rolled back except one committed race that was then deleted):** active → `active`, bootstrap `existing`; disabled (with a pending invitation) → `disabled`, bootstrap `removed`, no company created; invalid role (constraints dropped only inside a rolled-back transaction, and present again after) → `invalid_role` / `invalid_role`; two pending invitations returned in expiry order with no company id, bootstrap without acknowledgement → `pending_invitation`, acknowledgement without an admission → `admission_required`; unverified email with a pending row → `no_access`; expired admission and an expired invitation → `no_access` / `admission_required`; creator → `creator_eligible`, one company, replay `existing` with the same company, one consumed admission; explicit acknowledge creates one company and leaves the invitation pending, after which the resolver is `active`; no-access bootstrap `admission_required`; bad intent `invalid_intent`; v1, anon resolver, anon bootstrap, and direct reads of admissions, invitations, and the lock are 42501; cross-tenant resolver payloads do not contain the other company's label; two concurrent bootstrap sessions returned one `created` and one `existing` for the same company. Residue 16 before and after. After cleanup: 0 proof users, 0 proof companies, 0 admissions, 0 invitations.
- **Not done here:** invitation issue/accept (Phase E); Team UI (Phase G); visual proof of `/start` (the only runtime targets production, which does not have this schema). Owned by 13D / Phase H once a compatible runtime exists.
- **Phase D status:** CLOSED for code + staging. Production application requires 0A in production first (§0.3, §18.4) and must ship with this app.

### 2.8 Phase E invitation lifecycle record (2026-09-27)

- **Pending is not membership.** Email delivery is not membership. Opening a link is not membership. The only access change is an authenticated, verified acceptance in one transaction: `private.lock_user_membership` (the same key as bootstrap v2), one membership in the existing company, invitation `accepted`, one `invitation_accepted` audit row.
- **Schema (forward migration `20260927210000`, staging only):** Phase D `company_invitations` gains `role_profile_version` (FK to the role profile), `proposal_fingerprint`, and `resend_idempotency_key`. Unique `token_hash`. Unique `(company_id, idempotency_key)` where the key is present. `company_invitation_delivery_attempts` records `issue` | `resend`, `sent` | `failed`, a short `error_class`, and an optional provider message id. RLS on, **no client grants** (support-only). That is tighter than §11.1's "team managers can read." Access-event types add `invitation_issued`, `invitation_resent`, `invitation_revoked`, `invitation_accepted`. Job-grant source adds `invitation`.
- **States:** `pending` | `accepted` | `revoked`. Expired is derived (`expires_at <= now()` while still pending). Default life is 7 days from database `now()`, reset on resend. Phase D access states are unchanged.
- **Issue:** `issue_company_invitation_v1` takes the actor from `auth.uid()` and the company from `private.current_active_company_id()`. No caller-supplied company. Owner and Admin only. Admin cannot invite an Admin (`owner_required`), cannot grant Owner (`role_not_assignable`), and cannot delegate a package outside the Admin ceiling. Reserved packages are `package_unavailable`. Sales, Production Lead, and Field are `capability_denied`. Self-invite is rejected. Any existing membership for that email, in any company, active or disabled, is `recipient_membership_exists` (stricter than §11.2's same-company check, because one membership row per user includes disabled). Same idempotency key and same fingerprint returns the existing row and does not send again. Same key and a different fingerprint is `idempotency_conflict`. A second key while a pending row exists for that email is `invitation_pending`.
- **Token:** 32 random bytes, base64url in the link (no padding). Authority stores SHA-256 of the raw bytes. Invalid hashes are `not_found`. The raw token is not stored, logged, audited, or written on the delivery row. GET and preview never accept.
- **Delivery:** the access RPC commits first. The server then sends through the existing Resend path and records the attempt. A failed send leaves the invitation pending, creates no membership, and does not create a second invitation. The contractor-facing message is "Invitation wasn't sent." Provider bodies stay off the normal response. If the process dies after commit and before send, the raw token is gone and the recovery is resend. Staging proof recorded a failed attempt; it did not send live mail.
- **Resend:** same invitation row. A new idempotency key with the expected generation replaces the hash, bumps generation, and sets a new 7-day expiry. The previous link becomes `not_found`. Proposed role, packages, and jobs stay. An authorized resender re-stamps issuer, authority, access revision, and the current profile version. The same resend key returns the current generation and does not rotate again.
- **Revoke:** pending becomes `revoked`, generation increments, and the hash is kept so the link previews as revoked. Idempotent (`already_revoked`). No membership exists to change.
- **Accept:** `accept_company_invitation_v1(token hash)` and `accept_my_company_invitation_v1(invitation id)`. Order: authenticate, read `email_confirmed_at` and `auth.users.email` (never profile email or metadata), take the shared lock, lock the invitation, re-check the token hash under that lock, then verified-email match, pending, not expired or revoked, no membership, issuer still Owner or Admin with `team.manage`, issuer `access_revision` still equal to `access_revision_at_issue`, stored profile version still the current maximum, proposal still valid for that pinned version and the issuer's current tier. Then one membership, package rules, job grants (`source = invitation`), status `accepted`, one audit row. A generation change after the lock raises and rolls back.
- **Replay:** the same recipient, after commit, gets `already_accepted` with the membership as it is now. No second membership, no second audit row, no privilege re-grant. A later disable returns `accepted_disabled` and does not reactivate or move the person.
- **Create/join lock:** both paths call `private.lock_user_membership`. Staging ran two overlapping sessions (one backend in `pg_sleep` holding the transaction, the other waiting on `Lock: advisory`). Accept first: one `office_sales` membership in the inviting company, invitation `accepted`, creator admission still `issued`, bootstrap returned `existing`. Bootstrap first: one `owner` membership in the new company, invitation still `pending`, admission `consumed`, accept returned `membership_conflict`. Neither run produced two memberships or moved a membership.
- **Other invitations:** left pending when one is accepted. A later accept returns `membership_conflict`.
- **Conflicts:** another company's membership, or a disabled membership, is `membership_conflict` and the invitation stays pending. An active membership in the inviting company is `already_member` (no extra grants). Nothing is deleted to make room.
- **Stale authority and profile drift:** disabled issuer, lost delegation, access-revision mismatch, or a newer role-profile version returns `reauthorization_required` and grants nothing. Resend by someone who currently has authority re-pins the current profile version without adding packages or jobs.
- **Preview tradeoff:** `preview_company_invitation_v1` is executable by anon so a link can show a safe screen before sign-in: company label, role, expiry, inviter display name, and whether extra access exists. It does not return member lists, package keys, company id, or customer data, and an unknown token is `not_found`. Package labels are shown only after the signed-in verified email matches. `preview_my_company_invitation_v1` requires that match or returns `not_found`. Accepted-by-someone-else does not reveal the company label.
- **App:** `POST /api/company/invitations` issues (idempotency key required; company id ignored). Resend and revoke are POST under that invitation id. Accept is POST `/api/invitations/accept` only. `/join/[token]` and `/join/open/[invitationId]` render `InvitationJoinScreen` and do not accept on load. `/start` links each pending invitation to `/join/open/…` and still does not accept or delete it when the person chooses create-business. Middleware sets `Referrer-Policy: no-referrer` on `/join`. Login and signup keep `redirectTo` through the existing auth callback. There is no password-recovery page in this repo; none was added. Wrong account signs out and returns to login with the join path preserved.
- **Audit:** issued, resent, revoked, and accepted rows record actor, canonical email, company, role, profile version, packages, jobs, generation, and request id. No raw token. Delivery rows are not access events.
- **Staging proof (2026-09-27, rolled back except two committed races that were then deleted):** issue; admin ceiling; Sales/Production Lead/Field denied; Owner role denied; reserved package denied; wrong email; unverified email; expired; revoked; resend invalidates the old token; duplicate issue; accept creates one membership; replay; both create/join orders; active and disabled conflicts; stale inviter; profile-version bump requires reissue; cross-tenant id preview/accept `not_found`; anon mutations 42501; failed delivery leaves pending and zero memberships; bootstrap v2 still registered. After cleanup: 0 proof users, 0 proof companies, 0 invitations, 0 delivery attempts, 0 admissions, residue 16, companies 17.
- **Tests:** `app/lib/phase13eInvitationLifecycle.test.ts`. Full suite 327 files, 4484 tests, 4459 pass, 25 fail — the same 25 baseline failures. Source `tsc` clean.
- **Not done here:** full Team UI (Phase G); polished invited-user landing (13D); visual proof (the user-owned runtime targets production, which does not have this schema); live Resend to a controlled inbox; password-recovery page; Production Lead package delegation.
- **Phase E status:** CLOSED for code + staging. Production application requires 0A in production first (§0.3, §18.4) and must ship with this app. No production migration was applied.

### 2.9 Phase F revocation, recovery, and custody record (2026-09-27)

Implemented shape replaces the two-step `company_ownership_transfers` flow in §12.6 for launch. A pending acknowledgement would be a second custody race, and the target is already an active member. One transaction is the custody boundary. §12 remains the product intent; this section is what shipped.

- **Revoke first.** `disable_company_member_v1` is unchanged in signature and is not assurance-gated. A lost handoff cannot restore access. Historical membership is not deleted. `created_by` and completed or closed work stay put.
- **Session.** A disabled member can still hold a JWT. That JWT does not keep company access. `private.current_active_company_id()` is null, the resolver returns `state = disabled`, directory and job lists return nothing, and protected RPCs return `forbidden`. No auth session is revoked. This stack has no confirmed admin sign-out to rely on, and sign-out would not be the authorization boundary anyway. `/start` already says access has been removed.
- **Handoff.** `handoff_member_open_work_v1(target, reassign_to, expected_revision, request_id)`. The two-argument call still works. Open work is `private.job_is_open_work_v1` plus tasks with `status = 'open'` and `deleted_at` null. Only `assigned_to` moves. A bad target is `invalid_reassign` and the member stays disabled. The same request id replays. The same id with a different target is `idempotency_conflict`. A wrong revision is `stale_revision`. Pending work is already visible as open job and task counts on the access-admin list.
- **Reactivation** is only `reactivate_company_member_v1`. It takes the shared `private.lock_user_membership` lock, requires Owner or Admin, an expected revision, and an idempotency key. It clears `removed_at` and `disabled_by`, sets the requested role and current profile version, revokes every live package grant and job grant, then inserts only the requested packages and, for Field, the requested in-company jobs (`source = manual`). It does not restore Owner. Admin cannot reactivate an Admin, cannot reactivate to Admin, and cannot pass an Owner-only package (`owner_required`). Sales, Production Lead, and Field are `capability_denied`. A cross-tenant target is `not_found`. The same key and fingerprint replays. A different fingerprint is `idempotency_conflict`. Login, clearing `removed_at` from a client, and replaying an invitation do not reactivate. A disabled membership still blocks joining another company. That mobility limit is unchanged.
- **Custody.** Exactly one active `owner` membership, matching `companies.owner_user_id`. The unique owner index is immediate, so a transfer demotes the current Owner before it promotes the target, then moves the pointer. The deferred owner trigger sees one owner at commit.
- **Transfer** is `transfer_company_ownership_v1(target, former_role, owner_revision, target_revision, idempotency_key)`. The caller must be the current custody Owner. Former role is an explicit argument: `admin`, `office_sales`, `production_lead`, or `field_user`. There is no silent default. After the company custody lock, a stored idempotency key returns the original result even if the caller is no longer Owner and even without fresh assurance. A new key then requires assurance and the current pointer, so a retry cannot swap custody back. Disabled, cross-tenant, and already-owner targets are rejected. Admin is `custody_required`. A direct `UPDATE` of `owner_user_id` and a direct `DELETE` of the owner membership do not move custody. Owner-only and role-ineligible live grants on the former Owner are revoked. Restrictions stay. Job grants stay. Historical attribution stays.
- **Assurance now.** `private.assurance_satisfied_v1` is true only when the JWT `aal` is `aal2` and `iat` is within 15 minutes. It is required for ownership transfer, Admin promotion, and delegating a package that is `strong_auth_required` or sensitive and not Admin-assignable (the active Owner-only packages, including request payments). The check is inside `set_member_access_v1`, `issue_company_invitation_v1`, reactivation, and transfer. It is not in the use-time evaluator. Disable, ordinary role edits, `approve_jobs`, field brief, tasks, and schedule updates do not require it. Payments connect, payment settings, and refund execution are not aal2-gated: no user can reach aal2 until enrollment exists, and gating those routes now would make Connect impossible. That is a deliberate deviation from §12.5. The app does not pretend MFA enrollment exists. The blocked message is: "This change needs a recent strong sign-in. That step isn't available in the app yet."
- **Unavailable Owner.** No in-product backdoor and no automatic Admin succession. `recover_company_custody_v1` is granted only to `service_role`. Anon and authenticated callers get `42501` before the body. The body also requires the JWT role `service_role`. A reason of 8–500 characters is required. The same atomic swap runs with authority `system`, outcome `recovered`, and one `support_custody_recovered` audit row. Actor is null because there is no end-user id. The runbook is `docs/phase13f-unavailable-owner-recovery.md`. There is no support console.
- **Audit.** New event types: `member_reactivated`, `ownership_transferred`, `support_custody_recovered`. Rows record actor (when there is one), subject, company, before/after, revisions, request id, and reason when one was required. A forced abort after disable leaves no disable event and leaves the member active. No token, password, or MFA material is stored. `company_custody_operations` stores the idempotency result for reactivation, transfer, and support recovery. RLS on, no client grants.
- **Locks.** Reactivation uses the existing per-user lock. Transfer and support recovery use `private.lock_company_custody_v1` (`fielddive.company_custody_v1:` plus company id) and lock the two membership rows in `user_id` order. Unrelated Team edits are not globally serialized.
- **App.** `PATCH /api/company/members` accepts `reactivate` behind `team.manage`; the RPC still enforces Owner versus Admin. `POST /api/company/ownership/transfer` is session-only; the RPC enforces custody. The Team editor's handoff failure sentence is "Work reassignment still needs attention." The remove path already prefixes "Access removed." No transfer form and no new Team surface. Phase G owns that UI.
- **Staging (2026-09-27, project staging, migration `20260927220000` applied after target guard, dry run, and a begin/rollback compile check).** Rolled-back matrix: live disabled session denied; handoff moved one open job and one open task and left closed, archived, deleted, and completed work; failed handoff stayed revoked; replay and conflict; explicit reactivation did not restore the payment package; unauthorized reactivation denied; stale revisions rejected; Owner disable and delete denied; one transfer; cross-tenant and disabled-target denied; replay did not transfer twice; former Owner became the chosen Admin with the sensitive grant revoked; aal1 and stale `iat` denied on sensitive grant, Admin promotion, sensitive invitation, and transfer; ordinary grant and ordinary invitation succeeded at aal1; anon and authenticated support recovery `42501`; service-role recovery once, then replay; audit abort left no event; attribution unchanged; cross-tenant and anon mutations denied; public invitation preview still returns `not_found` for an unknown token; evaluator source does not call assurance. Two committed races, then deleted: overlapping transfers (holder in `pg_sleep`, waiter blocked on `Lock:advisory`) left one Owner, former role Admin, one transfer event, and the loser `custody_required`. Transfer versus disable (waiter blocked on `Lock:transactionid`) left the transfer winner as the only Owner and the disable as `cannot_remove_owner`, with zero disable events. After cleanup: 0 proof users, 0 proof companies, 0 invitations, 0 deliveries, 0 admissions, 0 custody operations, 0 proof access events, residue 16, companies 17.
- **Tests:** `app/lib/phase13fCustodyRecovery.test.ts` (5). Full suite 328 files, 4489 tests, 4464 pass, 25 fail — the same 25 baseline failures. Source `tsc` clean.
- **Not done here:** full Team UI (Phase G); MFA enrollment and Supabase MFA project configuration (Phase H / Q5); use-time assurance on payments connect, settings, and refunds once enrollment exists; session revocation; two-party transfer acknowledgement; employment mobility; visual proof (the user-owned runtime targets production, which does not have this schema).
- **Phase F status:** CLOSED for code + staging. No production migration was applied.

### 2.10 Phase G team access management record (2026-09-28)

Governance for this work is [product execution](fielddive-product-execution-standards.md), [UI cohesion](fielddive-ui-product-cohesion-standard.md), and [audit playbook](fielddive-audit-playbook.md). This section records what shipped. It does not restate those standards.

- **Screen.** Settings → Team, in the existing focused editor. Person, then role and status, then special access or attention only when it changes the next action. Five roles only: Owner, Admin, Sales, Production Lead, Field. Owner is not a role option. Transfer ownership is a separate Owner action with an explicit confirmation. The running product cannot complete strong sign-in, so the transfer surface says so and does not pretend the transfer finished.
- **Statuses.** Active, Invited, and Access removed. Unresolved open work adds "Work reassignment still needs attention." Expiry is a date on the invitation, not another status. A failed read says "Team members are unavailable right now." It is not an empty list.
- **Actions.** Add team member (email, role, then eligible special access, send). Resend and revoke. Explicit role save at the expected revision. Remove access, then reassignment. Reactivate chooses a current role and special access; earlier grants are not restored. Role save omits packages unless the contractor changed them. An explicit package list keeps packages the current person cannot delegate.
- **Omitted from the UI.** Capability ids, package ids, revisions, profile versions, policy reasons, scope JSON, audit ids, database identifiers, reserved packages, and a generated can/cannot list. Field access is "Assigned jobs (N)" or "No jobs assigned yet." There is no job-id editor on Team. Assigning the person to work stays on the job.
- **Directory.** People without team management see names and roles. Emails, disabled members, invitations, special access, and counts stay on the access-admin read.
- **Invitation list.** No new migration and no new RPC. `GET /api/company/invitations/pending` requires `team.manage`, takes the company from the live membership, and reads pending rows with the service role. The response has no token hash, delivery error class, or provider id. A failed read is "Invitations are unavailable right now."
- **Not done here.** New-business activation, proposal onboarding, first-job wizard, invited-user destination, returning-user home, onboarding checklist (13C/13D). MFA enrollment (Phase H). Manual job picking inside Team. Visual proof: the user-owned dev server points at production, which does not have the Phase B–F schema. No second server was started. Proof remains pending for Phase H.
- **Phase G status:** CLOSED for code. No production migration was applied.

---

## 3. Canonical data / authority model

### 3.1 Authority sources (database is authority)

| Concept | Canonical source | Notes |
|---|---|---|
| Tenant | `companies` | |
| Custody | `companies.owner_user_id` | Exactly one; must equal the single active membership with role `owner` (invariant I-3) |
| Membership | `company_memberships` (one row per user) | `role`, `removed_at` (NULL = active; non-NULL = disabled), + Phase C columns |
| Role profile | Versioned registry tables (Phase C) | Materialized in DB; TS registry parity-tested |
| Sparse rules | `company_member_access_rules` (Phase C) | Grants and restrictions |
| Field job scope | `job_access_grants` (Phase C) | Visibility/action scope only |
| Invitations | `company_invitations` (Phase E) | Pending invitation is **not** membership |
| Creator admission | `company_creator_admissions` (Phase D, only if controlled admission is chosen — §21 Q4) | |
| Audit | `company_access_events` (Phase C) | Append-only |
| Ownership transfer | `company_custody_operations` (Phase F, §2.9) | Idempotency record. The custody change itself is one transaction on `companies.owner_user_id` |

### 3.2 Membership states

`active` ⇔ `removed_at IS NULL`. `disabled` ⇔ `removed_at IS NOT NULL`. The existing column is retained as the single disablement truth (no parallel `status` column that could drift). Phase C adds `disabled_by uuid`, `disabled_reason text` (bounded), `access_revision bigint not null default 1`, `role_profile_version int not null`.

### 3.3 Stored role keys (LOCKED mapping)

Storage keys stay stable to avoid data churn; display labels change.

| Stored `role` | Display | Notes |
|---|---|---|
| `owner` | Owner | Only the custody holder. Never assignable through role control |
| `admin` | Admin | |
| `office_sales` | Sales | Existing key retained |
| `production_lead` | Production Lead | |
| `field_user` | Field | Existing key retained |

Any other stored value is **invalid** (fail closed, §4.6). A `CHECK (role in (...))` constraint is added in Phase B **after** Phase A preflight proves no other values exist (or they are resolved by an approved remediation).

### 3.4 Effective authorization (conceptual contract)

```
allowed =
  active_same_tenant          -- live membership, removed_at IS NULL, company matches resource
  AND supported_capability    -- capability registered AND status = 'active'
  AND scoped_allow            -- role profile default or grant covers (capability, scope, resource)
  AND NOT applicable_deny     -- no restriction covering (capability, scope ⊇ resource)
  AND dependencies_satisfied  -- registry prerequisites also allowed
  AND validity_satisfied      -- now() (DB time) within rule window
  AND assurance_satisfied     -- AAL / recency for sensitive capabilities
  AND domain_eligible         -- existing business rules (lifecycle, acceptance, send-freeze, money)
```

The evaluator returns `{ allowed, reason_code }`. Reason codes are safe (`not_member`, `disabled`, `capability_unsupported`, `out_of_scope`, `restricted`, `missing_dependency`, `expired`, `assurance_required`, `ineligible`, `authorization_unavailable`). Clients never receive rule internals or evidence of unrelated resources.

Phase F enforces `assurance_satisfied` on custody transfer and on sensitive delegation (Admin promotion and Owner-only or `strong_auth_required` packages), not inside `evaluate_access_core_v1`. Use-time payment and refund routes stay on capability checks until MFA enrollment exists (§2.9).

### 3.5 Deterministic rule semantics (LOCKED)

1. Deny wins over allow for the same capability when the deny scope contains the resource.
2. A company-scope deny cannot be bypassed by a job-scope grant.
3. A job-scope deny does not affect other jobs.
4. Role defaults are evaluated from the profile; they are never copied into per-member rows.
5. Dependencies are fixed registry metadata forming a DAG; migrations/tests reject cycles.
6. Granting a package grants its complete prerequisite bundle in the same reviewed mutation; it never silently clears a restriction (a conflicting restriction makes the save fail with an explanation).
7. Removing a prerequisite makes dependents unavailable; the editor previews this before Save.
8. No write implies unrestricted read; no scope grant implies new action authority; no export implies broader visibility.
9. Unknown capability, unknown role, unknown scope kind, or authorization read failure ⇒ deny.
10. Expiry is evaluated at access time with DB `now()`; cleanup jobs are housekeeping only.

### 3.6 Invariants (enforced in DB where possible)

| ID | Invariant | Enforcement |
|---|---|---|
| I-1 | One membership row per user | Existing unique index (0A) |
| I-2 | Company derives from auth, never from client input | RPC/route pattern; tests |
| I-3 | Exactly one `owner` membership per company, active, equal to `companies.owner_user_id` | Partial unique index `(company_id) WHERE role='owner'` + constraint trigger checking pointer consistency (Phase B, after preflight) |
| I-4 | Owner membership cannot be disabled | Disable RPC rejects; trigger backstop |
| I-5 | Membership/role/rule/job-access/invitation writes only via reviewed RPCs | No client INSERT/UPDATE/DELETE grants or policies on these tables |
| I-6 | Every tenant RLS predicate requires an **active** membership | Phase B helper + parity test |
| I-7 | Audit rows are append-only for all non-`postgres` roles | Grants + no UPDATE/DELETE policies |
| I-8 | Invitation acceptance and bootstrap serialize on the **same** per-user lock | Shared lock key (§10.5) |

---

## 4. Canonical roles

### 4.1 Owner (`owner`)
Custody holder plus the Owner profile: every active registered capability at company scope, custody operations (transfer, sensitive delegation, Admin management, payout/provider configuration). Subject to all domain invariants and assurance requirements.

### 4.2 Admin (`admin`)
Office/operations manager. Company-scope operational work, proposals, operational approval, routine company settings, ordinary staffing within the Admin ceiling (§9.3). Financial reporting, internal costs, refunds, payment provider/payout, sensitive delegation: **not default** — Owner-granted packages only.

### 4.3 Sales (`office_sales`)
Company-scope customers/jobs/proposals, measurement capture and selection, proposal send, scope-change drafting. Operational approval, payment requests, internal costs, company financials: **special access**.

### 4.4 Production Lead (`production_lead`)
Company-scope production coordination (schedule, production lead assignment, tasks, start/complete, hold/resume), job-linked customer/work context, measurement/photo capture. Proposals/pricing/financials: **not default**. Role description must say "company-wide production coordination".

### 4.5 Field (`field_user`)
Explicit-job scope only (§8.3). Field brief projection, own-task completion, photo/measurement capture on accessible jobs. No directory, no proposals/prices/payments, no company-wide schedule.

### 4.6 Invalid / unknown role (fail closed)
Unknown, empty, or unparseable stored role ⇒ membership state `invalid_role`: **no capabilities**, access resolver returns an explicit "Your access needs attention — contact your company owner" state, audit/telemetry records it. Never mapped to Owner, never to Field.

### 4.7 Legacy normalization
`normalizeCompanyMembershipRole` currently accepts aliases (`office`, `sales`, `production`, `prod_lead`, `field`, `crew`, `technician`). Phase A decides per preflight: if production contains alias values, a one-time reviewed forward migration rewrites them to canonical keys (audited); afterwards the reader accepts **only** canonical keys. No alias → `owner` path survives Phase A.

---

## 5. Capability model

### 5.1 Principles
- Capabilities are **actions**, scope is separate (`jobs.read` at `company` vs `job` scope — never `jobs.view_all` / `jobs.view_assigned`).
- A capability has registry status `active` (enforced + tested) or `reserved` (vocabulary only; always denies; never shown in UI).
- A capability becomes `active` only when its operation/projection exists and is enforced at every layer (§14).

### 5.2 Registry (initial)

| Domain | Capability | Status at Phase C | Boundary / notes |
|---|---|---|---|
| Customers | `customers.read` | active | Full directory/detail. Field uses brief projection instead |
| | `customers.manage` | active | Create/edit customer & property identity |
| Jobs | `jobs.read` | active | Scoped |
| | `jobs.manage` | active | Create/edit job identity (not stage) |
| | `jobs.assign` | active | Production lead (`jobs.assigned_to`) + Field job access grants (§8.3) |
| | `jobs.approve` | active | Operational approval (`confirm-acceptance`, `acknowledge-acceptance`); accepted ≠ approved remains a domain rule |
| | `jobs.progress` | active | Start / complete work |
| | `jobs.hold` | active | Hold / resume |
| | `jobs.finalize` | active | Lost / close / reopen |
| Measurements | `measurements.capture` | active | Create measurement records |
| | `measurements.select` | active | `select_job_measurement_v1` (authoritative selection) |
| Photos | `photos.contribute` | active | Upload/list job attachments; delete own recent uploads only per existing rules |
| Field notes | `field_notes.contribute` | reserved | Activate only if a field-notes workflow exists (Phase A inventory) |
| Tasks | `tasks.read` | active | |
| | `tasks.complete` | active | Own-task scope for Field |
| | `tasks.manage` | active | Create/assign/edit tasks |
| Schedule | `schedule.read` | active | Calendar/schedule projections |
| | `schedule.manage` | active | Schedule/reschedule/unschedule |
| Proposals | `proposals.read` | active | Includes prices |
| | `proposals.write` | active | Draft/revise |
| | `proposals.send` | active | Existing readiness/freeze/idempotency rules unchanged |
| Scope changes | `scope_changes.write` | active | Draft |
| | `scope_changes.issue` | active | Propose to customer / mint review link |
| Commercial config | `pricing.manage` | active | Pricing policies, catalog |
| | `pricing.cost.read` | active **iff** Phase A proves an internal cost/margin surface (candidate: `proposal_internal_summaries`, catalog cost fields); otherwise reserved |
| | `templates.manage` | active | Proposal templates, Usual Roof setup |
| Payments | `payments.summary.read` | active | Job balance/status needed to collect |
| | `payments.history.read` | active | Transaction/refund ledger |
| | `payments.request` | active | Create/send/collect payment requests, payment links |
| | `payments.refund` | active | Refunds (sensitive) |
| | `payments.configure` | active | Stripe Connect, payment settings (sensitive) |
| | `payments.record` | reserved | Offline recording route is retired (410) |
| Company finance | `company_financials.read` | active **iff** Phase A identifies an aggregate revenue/balance surface (candidate: Jobs Board overview money metrics); otherwise reserved |
| Administration | `company.manage` | active | Routine company settings (timezone, branding, profile) |
| | `team.manage` | active | Ordinary staffing within ceiling |
| | `access.delegate_sensitive` | reserved at launch | Owner-only path; mandate model deferred (§9.4) |
| | `billing.manage` | reserved | No subscription billing workflow exists |
| | `data.export` | reserved | No export workflow exists |

### 5.3 Required separations (LOCKED)
capture ≠ select measurement · proposal write ≠ send · scope drafting ≠ issuance · payment summary ≠ history ≠ request ≠ refund ≠ configure · company financial totals ≠ internal costs · manage/edit ≠ lifecycle authority · export ≠ read.

### 5.4 Current → canonical mapping (Phase A deliverable, verified per route)

| Current capability | Current routes (N6) | Canonical capability |
|---|---|---|
| `customers_jobs` | members GET; implied everywhere via RLS | `customers.read`, `jobs.read` (scoped) |
| `proposal_author` | proposals/send, customer-record-link, scope-changes | `proposals.write`/`proposals.send`; `scope_changes.write`/`scope_changes.issue`; customer-record-link → `proposals.send` |
| `payment_request` | payment-link, payment-requests collect/email | `payments.request` (+ `payments.summary.read` dependency) |
| `payment_admin` | payments/connect, refunds | `payments.configure`, `payments.refund` |
| `schedule_mutate` | jobs/schedule (+ reschedule/unschedule to verify) | `schedule.manage` |
| `job_assign` | production-lead | `jobs.assign` |
| `task_assign` / `task_complete` | tasks/[taskId] | `tasks.manage` / `tasks.complete` |
| `lifecycle_start_complete` | start-work, complete-work, task completion side-effects | `jobs.progress` |
| `job_pause_resume` / `job_disposition_finalize` | change-disposition | `jobs.hold` / `jobs.finalize` |
| `member_admin` | members PATCH | `team.manage` (+ custody checks) |
| `company_admin` | *unused* | `company.manage` |
| `photo_mutate` | (verify) attachments | `photos.contribute` |
| — (membership-only today, N4) | confirm/acknowledge-acceptance | `jobs.approve` |
| — | company/payments/settings | `payments.configure` |
| — | company/timezone | `company.manage` |
| — | jobs/payment-requests (create) | `payments.request` |
| — | jobs/[jobId]/tasks (create) | `tasks.manage` |
| — | jobs/[jobId]/attachments | `photos.contribute` (scoped) |

Phase A produces the complete route/RPC/table inventory; any route not in this table is classified before Phase B edits it.

---

## 6. Role defaults

`C` = company scope · `J` = explicit job scope · `T` = own task (within J) · `G` = grantable special access · `—` = not available.

| Capability | Owner | Admin | Sales | Production Lead | Field |
|---|---|---|---|---|---|
| `customers.read` | C | C | C | C | — (brief projection at J) |
| `customers.manage` | C | C | C | G | — |
| `jobs.read` | C | C | C | C | J |
| `jobs.manage` | C | C | C | G | — |
| `jobs.assign` | C | C | G | C | — |
| `jobs.approve` | C | C | G | G | — |
| `jobs.progress` | C | C | G | C | G(J) |
| `jobs.hold` | C | C | G | C | — |
| `jobs.finalize` | C | C | G | — | — |
| `measurements.capture` | C | C | C | C | J |
| `measurements.select` | C | C | C | G | — |
| `photos.contribute` | C | C | C | C | J |
| `tasks.read` | C | C | C | C | J |
| `tasks.complete` | C | C | C | C | T |
| `tasks.manage` | C | C | G | C | G(J) |
| `schedule.read` | C | C | C | C | J |
| `schedule.manage` | C | C | G | C | G(J) |
| `proposals.read` / `write` / `send` | C | C | C | — | — |
| `scope_changes.write` | C | C | C | G | — |
| `scope_changes.issue` | C | G | G | — | — |
| `pricing.manage`, `templates.manage` | C | G | G | — | — |
| `pricing.cost.read` | C | G | G | — | — |
| `payments.summary.read` | C | G | G | — | — |
| `payments.request` | C | G | G | — | — |
| `payments.history.read` | C | G | G | — | — |
| `company_financials.read` | C | G | G | — | — |
| `payments.refund` | C | G (Owner-assigned, strong auth) | — | — | — |
| `payments.configure` | C (strong auth) | — (launch) | — | — | — |
| `company.manage` | C | C | — | — | — |
| `team.manage` | C | C (ceiling §9.3) | — | — | — |

**Default-change impact (TIMOTHY DECISION Q2):** relative to current code, this table removes from Sales: `schedule_mutate`, `lifecycle_start_complete`, `job_pause_resume`, `job_disposition_finalize`, `payment_request`, `task_assign`, `job_assign` defaults; removes from Admin: `payment_admin`, `payment_request`; removes company-wide reads from Field. Existing members may be grandfathered via explicit migration-authored grants (audited `authority_source='migration_preserve'`) or tightened. No silent change either way.

**Sales operational visibility** stays company-wide at launch (no sales-ownership model exists). A future sales-team scope is a separate typed scope, never derived from `jobs.assigned_to`.

---

## 7. Special-access model

### 7.1 Packages (UI surface)
The UI shows **named packages**, never capabilities. A package = fixed capability set + scope rule + dependencies + eligible roles + assignable-by ceiling. Packages are registry rows (versioned with the registry), not user-authored.

### 7.2 Launch package catalogue

| Package (UI label) | Grants | Eligible roles | Assignable by | Launch condition |
|---|---|---|---|---|
| Request payments | `payments.request`, `payments.summary.read` | Admin, Sales | Owner | Phase C–H proof |
| View payment history | `payments.history.read` (+ summary) | Admin, Sales | Owner | Phase C–H proof |
| View company financials | `company_financials.read` | Admin, Sales | Owner | Only if capability active (§5.2) |
| View internal costs | `pricing.cost.read` | Admin, Sales | Owner | Only if capability active and projections enforced |
| Manage pricing & templates | `pricing.manage`, `templates.manage` | Admin, Sales | Owner | Phase C–H proof |
| Issue scope changes | `scope_changes.issue` | Admin, Sales | Owner | Phase C–H proof |
| Refunds | `payments.refund` (+ history) | Admin | Owner (strong auth) | Phase F strong auth live |
| Approve jobs | `jobs.approve` | Sales, Production Lead | Owner, Admin | Phase C–H proof |
| Coordinate production | `schedule.manage`, `tasks.manage`, `jobs.progress`, `jobs.hold`, `jobs.assign` | Sales | Owner, Admin | Phase C–H proof |
| Lead assigned work | `tasks.manage`, `jobs.progress`, `schedule.manage` at **J** | Field | Owner, Admin, Production Lead | Phase C–H proof |
| Manage customers & jobs | `customers.manage`, `jobs.manage`, `measurements.select` | Production Lead | Owner, Admin | Phase C–H proof |

Rules: a package is shown only when every capability it contains is `active`, enforced, and tested (no placeholders). Restrictions (UI "Restrict …") exist only for packages/capabilities Phase C explicitly supports (initially: "Cannot see internal costs", "Cannot request payments", per-job removal of Field access). Dependencies are displayed as one consequence sentence.

### 7.3 Role changes
Before/after effective access preview; restrictions retained by default; grants revalidated against new role eligibility and assigner ceiling; incompatible grants explicitly shown as "will be removed" and removed (not hidden/suspended for silent revival); sensitive grants require affirmative retention; `expected_access_revision` rejects stale edits.

### 7.4 Profile evolution
Profiles are versioned (`role_profile_version`). Security tightenings may ship with audit + release note. Any increase in sensitive authority requires an explicit reviewed migration that records affected members; new code never silently expands a profile.

### 7.5 Validity windows
`valid_from` / `valid_until` columns exist from Phase C and are evaluated at access time. **No temporary-access UI** until expiry, session behavior, and audit are tested (deferred, §20).

---

## 8. Scope model

### 8.1 Scope kinds (typed, closed set)
| Kind | Meaning | Status |
|---|---|---|
| `company` | All company resources of that domain | active |
| `job` | Resources linked to specific job(s) via `job_access_grants` or rule `scope_job_id` | active |
| `own_task` | Tasks where `job_tasks.assigned_to = auth.uid()` **and** the job is in `job` scope | active |
| `branch`, `sales_team` | Reserved extension kinds | reserved (deny) |

No JSON expressions; scope is a column (`scope_kind`) plus typed reference columns.

### 8.2 Scope application rules
- Scope predicates apply **before** pagination, counts, aggregation, and search ranking (SQL, not client filtering).
- The same scope applies to lists, counts, search RPCs, calendar/schedule projections, attention items, activity, attachments/signed URLs, PDFs, notifications, exports, and AI retrieval.
- A job read never traverses sibling jobs of the same customer/property.

### 8.3 Field job-access relation (APPROVED)

**Table `job_access_grants`** (Phase C):

| Column | Notes |
|---|---|
| `id uuid pk` | |
| `company_id uuid not null` | Must equal job's company; FK-validated via trigger |
| `job_id uuid not null` | |
| `user_id uuid not null` | Must be an active member of `company_id` whose role uses `job` scope (Field) at grant time |
| `granted_by uuid not null`, `granted_at timestamptz not null default now()` | |
| `revoked_by uuid`, `revoked_at timestamptz` | Soft revoke; history retained |
| `source text not null` | `manual` \| `task_assignment` \| `production_lead_assignment` \| `migration` (provenance only; authority is the row) |
| Unique | `(job_id, user_id) WHERE revoked_at IS NULL` |

Semantics:
- Grants **visibility/action scope only**. It is not production responsibility (`jobs.assigned_to`), not task assignment, not scheduling truth, not crew planning.
- Multiple Field users per job; a Field user may have many jobs.
- Created/revoked only via `grant_job_access_v1` / `revoke_job_access_v1` (holders of `jobs.assign` at company scope; ceiling §9.3).
- **Assignment coupling (TIMOTHY DECISION Q1b, recommended):** assigning a Field member to a task (or as production lead) on a job the member cannot access **creates an explicit grant in the same transaction** with `source='task_assignment'`/`'production_lead_assignment'`, visible in audit and in the member's access summary. Unassigning does **not** auto-revoke (revocation is explicit). Task assignment alone never grants access without this recorded row.
- Disabled membership makes all grants inert immediately (active-member predicate); reactivation does not restore grants automatically (§12.4).
- Job soft-deletion/closure does not delete grants; historical access rows remain for audit. Whether Field keeps read access to closed jobs is governed by the grant (explicit revoke), not inferred.

**Field read surface (enforced in Phase C):**
- RLS for `jobs`, `job_tasks`, `job_schedules`, `job_attachments`, `job_activity_events` (filtered event types), `job_attention_items`, `measurement_records`: company-scope roles as today (active member); Field only where `can_access_job(job_id)`.
- `customers`, `properties`, all `proposal_*`, `estimates`, `payments`, `job_payment_*`, pricing/template/catalog tables, `proposal_public_access_tokens`: **no Field access** at the table level.
- Job-linked customer contact, address, access notes, approved-scope label, schedule, lead, tasks, photo count: served by **`get_job_field_brief_v1(p_job_id)`** (SECURITY DEFINER, scope-checked, returns only operational fields; no prices/totals/terms). The Field Job Card and field brief switch to this projection; visual output unchanged (accepted UI).
- Search RPCs (`search_company_*`, SECURITY INVOKER) inherit RLS; definer RPCs add explicit scope predicates.

---

## 9. Use / delegate / custody rules

### 9.1 Definitions
- **Use** — what the member may personally see/do (§3.4).
- **Delegate** — what access the member may assign to others (roles, packages, restrictions, Field job access), bounded by a ceiling independent of personal use.
- **Custody** — ownership transfer, Admin management, sensitive package assignment, payout/provider configuration, recovery.

`canUse(X) ⇏ canDelegate(X)`. `team.manage ⇏` grant everything.

### 9.2 Owner (custody)
Assigns/removes Admin role; assigns/removes every package including sensitive; transfers ownership; configures payments/payout; cannot disable self; cannot change own role except via transfer.

### 9.3 Admin ordinary ceiling (fixed registry metadata, LOCKED for launch)
Admin (with `team.manage`) may:
- invite/assign/change roles among **Sales, Production Lead, Field** only;
- assign/remove packages whose `assignable_by` includes `admin` (Approve jobs, Coordinate production, Lead assigned work, Manage customers & jobs);
- grant/revoke Field job access;
- disable/reactivate members whose role is Sales/Production Lead/Field **and** who hold no Owner-only package.

Admin may **not**: change self; change/disable the Owner or any Admin; promote to Admin; assign/remove Owner-only packages (all financial, cost, pricing, refund, scope-issue, configure); disable a member holding an Owner-only package; issue delegation of any kind.

Production Lead may grant/revoke Field job access and assign "Lead assigned work" (operational) — nothing else in team administration.

### 9.4 Sensitive delegation
Launch: **Owner-only** (no mandate table). The schema keeps an extension point (`authority_source` on rules/events: `owner` \| `admin_ceiling` \| `production_ceiling` \| `migration_preserve` \| future `mandate:<id>`). Mandates (Owner-issued, non-recursive, package-bounded) are deferred (§20; TIMOTHY DECISION Q3 confirms Owner-only launch).

### 9.5 Universal delegation rules
No recursive delegation · no self-elevation · no peer-Admin elevation · target must be an active member (or invitation) of the same company · resulting target access must satisfy role eligibility + dependency completeness + assigner ceiling in one transaction · stale `expected_access_revision` rejects.

---

## 10. Create / join model

### 10.1 Access resolver (Phase D)
`resolve_current_user_access_v1()` (SECURITY DEFINER, `auth.uid()` only, no args) returns exactly one state:

| State | Meaning | UI destination |
|---|---|---|
| `active` | Live membership, valid role | Capability-derived first destination (§13.6) |
| `disabled` | Membership exists, `removed_at` set | "Your access to {company} was removed" + support path; no creation CTA |
| `invalid_role` | Membership with unknown role | "Your access needs attention"; no capabilities |
| `pending_invitation` | No membership; ≥1 valid pending invitation matching the **verified** auth email | Invitation chooser (accept/decline); creation offered only as an explicit secondary choice if eligible |
| `creator_eligible` | No membership, no pending invitation (or all declined), creator admission satisfied | "Create your business" explicit step |
| `no_access` | No membership, no invitation, not eligible | "You don't have access yet" + account/switch/sign-out |

Errors are **not** states: RPC/network failure ⇒ `authorization_unavailable` in TS ⇒ retry/recovery screen. UNKNOWN/FAILED never becomes `no_access`, `creator_eligible`, or empty.

### 10.2 Create business
authenticate → resolver says `creator_eligible` → explicit "Create business" POST (server route) → `bootstrap_current_user_company_v2(p_intent => 'create_business')` → Owner.

- The bootstrap RPC re-checks eligibility **inside** its transaction (direct RPC calls cannot bypass): not a member, no unresolved pending invitation for the verified email (unless `p_acknowledge_pending_invitations => true` from an explicit UI choice), creator admission satisfied (§21 Q4).
- Preserves 0A: same advisory lock key, same atomic company + owner membership insert, same `created`/`existing`/`removed` outcomes, owner `postgres`, fixed `search_path`, EXECUTE only to `authenticated`.
- Company name is collected in the create step (replacing the hard-coded "My Company" default only through the explicit path; the default may remain as fallback if name omitted — Phase D decision within scope).

### 10.3 Join business
invite → authenticate (sign-up/sign-in; email confirmation preserves context) → verified auth email matches invitation → explicit POST accept → `accept_company_invitation_v1` → membership in existing company with the invitation's reviewed role/packages/job access.

### 10.4 Rules (LOCKED)
- General page loads, auth callback, and middleware **never** create companies or memberships.
- No membership ≠ eligibility. Query strings, profile fields, client flags, metadata are never eligibility.
- A pending invitation is surfaced before any creation option and survives password recovery/confirmation.
- A malicious third-party invite cannot veto an admitted creator: decline is explicit and unblocks creation.
- Joined users never trigger starter catalog/template installation.

### 10.5 Shared per-user lock
Bootstrap v1 locks `hashtextextended('fielddive.bootstrap_current_user_company_v1:' || uid, 0)`. Acceptance and bootstrap v2 **must use this exact key** (extracted into `private.lock_user_membership(uid)`), so accept and create serialize with each other and with any still-deployed v1 caller. Changing the key text is prohibited.

### 10.6 Required changes to Slice 0A behavior (before invitations ship)

| 0A behavior today | Required change | Phase |
|---|---|---|
| `ensureUserIdentity` calls bootstrap on every protected page | Replace with access resolver; bootstrap only from explicit create POST | D |
| Bootstrap RPC admits every authenticated caller | Add in-transaction eligibility (pending-invitation check against verified email; creator admission if controlled access) via `bootstrap_current_user_company_v2`; revoke EXECUTE on v1 from `authenticated` after all callers move | D |
| Pages redirect to `/login` on `companyId = null` | Route by resolver state (§10.1) | D |
| Lock key private to bootstrap | Shared helper with identical key | D/E |

Preserved unchanged: atomic company+owner creation, advisory lock, unique `(user_id)`, `removed` refusal, idempotent `existing` replay. **0A must still roll out to production first** (it closes the self-membership P0); Phase D is a forward migration on top.

---

## 11. Invitation lifecycle

### 11.1 Data (`company_invitations`, Phase E)

| Column | Notes |
|---|---|
| `id`, `company_id` | |
| `email_canonical text` | Lower-cased, trimmed; exact match against auth verified email (no alias/dot/plus rewriting) |
| `role text` | Canonical role key; never `owner` |
| `packages text[]`, `job_ids uuid[]` | Proposed access, validated against registry/ceiling at issue and at accept |
| `status text` | `pending` \| `accepted` \| `revoked` |
| `expires_at timestamptz` | `issued_at + 7 days` per generation |
| `generation int` | Increments on resend/reauthorization |
| `token_hash bytea` | SHA-256 of current generation token; raw token never stored |
| `issued_by`, `issued_at`, `authority_source` | Revalidated at accept |
| `access_revision_at_issue` | For stale checks |
| `accepted_by_user_id`, `accepted_at`, `revoked_by`, `revoked_at` | |
| `idempotency_key` | Issue/resend dedupe |
| Unique | `(company_id, email_canonical) WHERE status='pending'` |

`company_invitation_delivery_attempts` (operational log; not authority): invitation id, generation, provider, provider message id, status, error class, timestamps. RLS: team managers read own company; no client writes.

### 11.2 Issue
Authorized actor (Owner/Admin within ceiling) → server route → server generates 32-byte random token (Node `crypto`), computes hash → `issue_company_invitation_v1(email, role, packages, job_ids, token_hash, idempotency_key)` validates entire proposed access + ceiling + no active membership in this company for that verified email → commit → **post-commit** email send through existing Resend infrastructure → delivery attempt recorded. Same key + same payload ⇒ original result; same key + different payload ⇒ conflict.

**Delivery design (LOCKED for launch):** no raw-token storage and no encrypted delivery envelope. If post-commit send fails, the invitation stays `pending` with delivery `failed`; the Team UI offers **Resend** (rotates token). A lost HTTP response after a successful send is safe: retry with the same idempotency key returns "already sent (generation N)" without rotating or re-sending. Automatic background retry is intentionally not provided (would require token custody).

### 11.3 Resend / revoke
- `resend_company_invitation_v1(id, new_token_hash, expected_generation, idempotency_key)`: generation+1, new hash, new `expires_at`, old links invalid immediately. Re-validates issuer authority; if the proposed access now exceeds the resender's ceiling, requires an authorized resender.
- `revoke_company_invitation_v1(id)`: `status='revoked'`; idempotent.

### 11.4 Accept
- `GET /join/[token]` (or fragment variant, §21 Q9) renders a safe preview (company name, role label, inviter display name) — **never accepts**. `Referrer-Policy: no-referrer`, no third-party scripts, token never logged/analytics-tagged.
- Accept = authenticated explicit POST → `accept_company_invitation_v1(p_token, p_idempotency_key)`:
  1. `auth.uid()` required; read **verified** email from `auth.users` (`email_confirmed_at IS NOT NULL`), never `profiles.email`/metadata.
  2. Hash token; lock invitation row `FOR UPDATE`; shared per-user lock (§10.5).
  3. Validate: `status='pending'`, generation hash matches, `now() < expires_at`, email matches, company active, issuer authority still covers proposed access (else `reauthorization_required`), user has no membership (else `already_member` for same company replay / `membership_conflict` for other company or disabled).
  4. Insert membership (role, profile version), rules, job access; mark accepted; audit — one transaction.
- Replay by the same identity after success returns the established membership **as it is now** (never re-grants old role, never reactivates a disabled member).
- Wrong account ⇒ `email_mismatch` with account-switch path; no information about other invitations.
- Multiple pending invitations to different companies: user chooses; first successful accept wins the uniqueness race; others then return `membership_conflict`.

### 11.5 Issuer departure
Once accepted, membership does not depend on the inviter. Pending invitations whose issuer is disabled or lost authority fail acceptance with `reauthorization_required`; an authorized member can reissue (new generation, same invitation identity).

---

## 12. Revocation / custody

The launch implementation is §2.9. This section is the original product intent. Where they differ, §2.9 wins: one Owner transaction with an explicit former role, no two-party acknowledgement, no fake MFA enrollment, and no use-time aal2 gate on payments until enrollment exists.

### 12.1 Disable ("Remove access")
`disable_company_member_v1(target, expected_access_revision, reason)`:
1. Authorize (ceiling §9.3; Owner can never be target), lock membership row, set `removed_at`, `disabled_by`, bump `access_revision`, revoke pending invitations the target issued **only if** policy says so (default: leave; acceptance revalidates issuer), append audit. **Commit.**
2. Return `{ disabled: true, open_work: { job_leads: n, open_tasks: m, field_job_access: k } }` computed after commit with typed errors (never zero-on-failure).

### 12.2 Operational handoff (separate)
`handoff_member_open_work_v1(target, to_user | null, expected_access_revision)`:
- Scope: **active-work only** — jobs in non-terminal lifecycle stages (exact stage set defined in Phase A from `jobs.stage`/disposition truth) and open tasks. Completed/closed/lost jobs and historical actors are never rewritten.
- Target recipient must be an active member eligible for the work (production lead eligibility).
- Returns explicit `succeeded` / `partial` / `failed` with counts; failures never undo disablement and never claim success. Retryable.

### 12.3 Sessions
Live membership in every RLS predicate and server route blocks a disabled user regardless of JWT. Phase F adds defense-in-depth session revocation (service-role sign-out of the target's sessions) — failure of that call is logged, not a revocation failure.

### 12.4 Reactivation
`reactivate_company_member_v1(target, role, packages, job_ids, expected_access_revision)` — explicit review; prior sensitive packages and job access are **not** restored unless re-selected; expired rules stay expired; audit. Same ceiling as disable.

### 12.5 Strong authentication
- Mechanism: Supabase MFA (TOTP) with `aal2` plus recency (`auth.jwt()->>'iat'` or MFA verification time within a bounded window, default 15 minutes — tunable in Phase F).
- Required for: ownership transfer (both parties), assigning/removing sensitive packages, Admin role changes, refunds, payment provider/payout configuration, member disable when target holds sensitive packages.
- Enforced inside the sensitive RPCs/routes (not only UI). Ordinary field work never requires step-up.
- Rollout requires Supabase Auth MFA configuration on staging then production (production config change ⇒ explicit approval) and TIMOTHY DECISION Q5.

### 12.6 Ownership transfer
- `company_ownership_transfers`: `from_user_id`, `to_user_id`, `status` (`pending`/`accepted_by_target`/`completed`/`cancelled`/`expired`), `expires_at` (72 h default), timestamps.
- Flow: Owner initiates (aal2) → target (active member) acknowledges (aal2) → Owner confirms → `complete_ownership_transfer_v1` atomically updates `companies.owner_user_id`, sets target role `owner`, former Owner role `admin` (with explicitly reviewed packages), bumps revisions, audits. Pending transfer grants nothing.
- Owner cannot leave/disable self; must transfer first.

### 12.7 Unavailable-owner recovery
Operational support runbook (not a product feature at launch): verified business evidence, notification to the Owner's verified email, waiting period, FieldDive-staff execution through an audited service procedure, no domain-based claims. Runbook authored in Phase F; executed only with explicit production approval per case.

### 12.8 One-company constraint
Disabled membership blocks joining another company (I-1). The resolver shows `disabled` with a support route; invitation acceptance returns `membership_conflict`. No second-identity workaround is recommended; portable employment is a separate future redesign (§20).

---

## 13. Team UI contract (Phase G)

Phase G shipped the launch screen in §2.10. Where §13.1–§13.7 describe a drawer, a generated can/cannot summary, an invitation-expired status, or an in-team job picker, §2.10 is the implemented contract.

### 13.1 List (Settings → Team)
Columns: **Person** (name, email for team managers only) · **Role** · **Status** (`Active` / `Invited` / `Invitation expired` / `Removed`). Quiet **Special access** indicator only when grants/restrictions exist. Filters: Active · Invited · Removed. Visible to members with `team.manage`; others see no Team settings (assignment pickers use the directory projection, §14.4).

### 13.2 Member drawer / detail
Identity · role + one-line role description · plain-language scope ("All company jobs" / "Assigned jobs (3)") · special access (collapsed when none) · restrictions (when present) · effective-access summary ("Can send proposals. Cannot see internal costs.") · pending changes → **Save** with before/after consequences · Resend/Revoke invite · Remove access / Restore access · "Why this access?" (role/package source only).

### 13.3 Add user
Email → Role → optional Special access (only packages within the actor's ceiling) → Field: optional initial jobs → Send invitation. Errors: already a member, pending invite exists (offer resend), email delivery failed (offer resend).

### 13.4 Behavior rules
No autosave for role/access changes · no permission matrix · no "Full access" control · ordinary role selection has no warning theater; scope widening, financial access, sensitive grants, and removal show specific consequences · stale edit ⇒ "This member's access changed. Review the latest before saving." · Ownership transfer lives in a separate Owner-only section · disabled actions for recoverable prerequisites only, with reason.

### 13.5 Removal UX
"Remove access" → confirm with consequences → success shows access removed **immediately**, then an "Open work" panel with handoff choice and honest partial/failed states and Retry.

### 13.6 First destination by effective capability
Owner/Admin/Sales/Production Lead → Jobs Board (existing). Field → accessible jobs list; if none: "No work assigned yet" + company contact. No company creation or setup CTA for joined users. Authorized resume destinations respected; external/unauthorized deep links rejected (existing `safeInternalRedirect`).

### 13.7 Proof
Desktop + true 390 px for: list, drawer, add user, invite states, removal + handoff, stale edit, wrong-account accept, disabled screen, no-access screen, Field empty state.

---

## 14. Enforcement layers

### 14.1 Policy ownership
DB registry + profiles + rules + job access + custody are authority. TS registry (`app/lib/access/registry.ts`) mirrors names/labels and is **parity-tested** against DB rows. One evaluator implementation: **SQL** (`private.has_capability(company_id, capability, job_id)`); TS calls the resolver/evaluator RPCs or uses a precomputed per-request effective-access snapshot returned by the DB — no second hand-written algorithm.

### 14.2 UI / routes
Navigation and actions are projections of effective access. Direct routes resolve authority before loading protected content. `authorization_unavailable` ≠ empty.

### 14.3 Server / API / domain services
Pattern for every contractor route: authenticate → resolve active membership (typed: ok / none / disabled / invalid_role / unavailable) → check capability + resource scope → domain eligibility → operation. Never accept caller-supplied company/actor authority. Replace `requireCapabilitySession` with `requireAccess(supabase, capability, { jobId? })` backed by the DB evaluator.

### 14.4 RLS / direct data
- Helper `private.current_active_company_id()` (SECURITY DEFINER, stable, fixed `search_path`, no args, returns company for `auth.uid()` only when `removed_at IS NULL` and role valid) replaces inline `company_memberships` subqueries **only in policies the §14.9 inventory classifies as authenticated employee/member authority** (source count: ~117 policies across 45 tables, to be confirmed live). Avoids recursion; single place for the employee active predicate. It never replaces public customer-token, service/internal, or other exceptional authority.
- Helper `private.can_access_job(job_id)` for job-linked tables (company-scope roles ⇒ company match; Field ⇒ active `job_access_grants`).
- Capability-sensitive tables (pricing costs, payments, proposals) add `private.has_capability(...)` predicates where direct reads are exposed.
- **Directory projection** `list_company_directory_v1()`: active members' `user_id`, display name, role label — for any active member (assignment pickers). **Access-admin projection** `list_company_access_admin_v1()`: emails, status, invitations, packages, open-work counts (typed) — `team.manage` only. `profiles` and `company_memberships` SELECT stay self-only.
- Membership/rule/job-access/invitation/audit tables: no client INSERT/UPDATE/DELETE grants.

### 14.5 RPC / transactions
Access mutations, acceptance, disable, handoff, transfer, and sensitive money operations revalidate inside one transaction with consistent lock order: per-user membership lock → membership row → invitation/transfer row → target resources. Idempotency keys on issue/resend/accept/disable/handoff/transfer. Every SECURITY DEFINER function: owner `postgres`, `search_path = pg_catalog, public` (or `private`), EXECUTE revoked from `public`/`anon`, actor from `auth.uid()`, active-membership check, capability check.

### 14.6 Storage
Private bucket(s); no member-wide object policies; downloads via access-checked route issuing short-lived signed URLs after `can_access_job` + `photos.contribute`/`jobs.read`.

### 14.7 Revocation ordering
Operations authorized before a disable commit may finish per lock boundary; after commit, new authorizations fail. High-risk writes check `access_revision` under lock to prevent stale prechecks committing.

### 14.8 Public customer tokens
Separate, narrowly scoped authority; unaffected by employee changes. Removing an employee never invalidates accepted agreements or rotates customer links.

### 14.9 Policy-rebuild safety (gate before any Phase B policy change)

The shared active-membership helper direction stands. A **blind or mechanical rewrite** of the ~117 membership policies (e.g., regex/codegen replacement of every `company_memberships` subquery) is **prohibited**.

Before Phase B changes any policy, produce a reviewed **policy inventory** from live `pg_policies` (staging and production, read-only, counts/classes only for production) reconciled with the migration set. Minimum columns per policy:

| Column | Content |
|---|---|
| Table | Schema-qualified table |
| Operation | SELECT / INSERT / UPDATE / DELETE / ALL, and `USING` vs `WITH CHECK` |
| Current predicate | Exact current expression |
| Authority type | Authority family (below) |
| Current tenant/member behavior | Who can do what today (active member, any role) |
| Removed-member behavior | What a `removed_at IS NOT NULL` member can do today |
| Proposed replacement | Exact new expression (helper, `can_access_job`, `has_capability`, or unchanged) |
| Exceptional business/public authority | Any intentional non-employee or special path the policy supports |
| Regression proof required | The specific test(s) that prove parity + the intended change |

Authority families:
1. **Authenticated employee/member authority** — company members acting in the contractor app. Only this family moves to `private.current_active_company_id()` / `private.can_access_job` / `private.has_capability`.
2. **Public customer-token authority** — `/p` proposals, public scope-change authorization, public payment checkout, approval links, open tracking. **Unchanged** by the employee helper; reviewed separately and only minimized where §2 identifies metadata over-exposure (e.g., R15).
3. **Service/internal authority** — service-role routes, webhooks (Stripe, Resend), definer functions acting as internal authority. Not rewritten through the employee helper.
4. **Other explicit exceptional authority** — e.g., company Owner custody (`companies.owner_user_id`), self-row access (`profiles`, own membership), any intentionally separate model found by the inventory. Each is preserved or changed explicitly, never swept.

Rules:
- A policy whose family is unclear is a **stop condition**; it is not rewritten until classified.
- The employee helper must not alter public customer-token authority or any other intentionally separate authorization model, directly or through shared helper functions.
- The policy-parity test asserts: every family-1 policy uses the helper(s); no family-2/3/4 policy references the employee helper unless the inventory records why.
- Rewrite migrations are generated from the reviewed inventory (not from raw `pg_policies` text alone), and the diff is reviewed per table.

### 14.10 Function / grant review safety (gate before any Phase B grant change)

Source shows ~75 functions with ~106 `anon`/`authenticated` EXECUTE grants in the baseline (to be confirmed live). **Do not revoke a grant merely because it appears broad.** Several functions are intentionally callable by `anon` (public-token flows) or `authenticated` (contractor RPCs).

For each function, the Phase B inventory establishes:

| Field | Content |
|---|---|
| Purpose | What business operation it performs |
| Owner | Function owner role |
| Security mode | `SECURITY DEFINER` / `SECURITY INVOKER` |
| Accepted caller classes | anon / authenticated employee / service / internal-only |
| Actor/company derivation | From `auth.uid()`, a public token, arguments (unsafe unless validated), or none |
| `search_path` safety | Fixed `search_path` set? Schema-qualified references? |
| Direct authenticated execution | Intentional? Which app routes call it? |
| Anon access | Intentional? Which public flow depends on it? |
| Public-token dependency | Token type and validation performed, if any |
| Proposed grant state | Keep / narrow / revoke, with justification |
| Regression test | Test proving intended callers still work and unintended callers are denied |

Then change **only** grants proven excessive or unsafe. Missing internal checks (active membership, capability, `search_path`) are fixed inside the function where the grant is intentional, rather than by revoking a grant a legitimate caller depends on. A function with unclear intended callers is a stop condition.

---

## 15. AI / copilot authority contract

1. Copilot acts **on behalf of** the authenticated human; its effective authority ⊆ that human's effective access at execution time.
2. Every tool execution re-evaluates: active membership, capability, scope, sensitive-field projection, domain eligibility. No bearer capability tokens handed to the model.
3. No unrestricted service-role execution for "help this user". Server tools use the user-session client or definer RPCs that check `auth.uid()` authority.
4. Retrieval/search/embeddings/cached context honor the same scope; cost/financial data never enters a prompt for a user lacking the capability.
5. Retrieved content is untrusted input; it cannot grant authority or alter tool policy.
6. User confirmation is not authority; sensitive sends/contractual/refund/privilege actions require the same approval + assurance as manual.
7. Queued actions recheck authority at execution; changed membership, amount, or document revision invalidates stale approval.
8. Audit records initiating human, assistant channel, approved intent, executor, and resulting operation.
9. Autonomous service principals are not part of this program (§20).

No copilot implementation is part of Phases A–H; any future copilot tool must pass the §17 policy-parity tests.

---

## 16. Implementation phases A–H

**Execution groups and production rollout groups**

| Rollout group | Phases | Production-visible behavior |
|---|---|---|
| RG-0 (13A) | Slice 0A/0B/0C | **IMPLEMENTATION CHECKPOINT COMPLETE — PRODUCTION ROLLOUT PENDING.** 0A applied/verified on staging only; 0B/0C proven in isolated production builds, not deployed. Coordinated rollout review + explicit production authorization pending. Must reach production before RG-1 (§0.2, §0.3, §18.4) |
| RG-1 | A + B | Fail-closed roles, active-member enforcement, gated sensitive routes, working directory; no new UI |
| RG-2 | C + D | Policy foundation, Field scope, resolver, explicit create; single-owner companies see no change except honest states |
| RG-3 | E + F + G | Invitations, revocation/custody, Team UI — deployed **dark** (server flag off) |
| RG-4 | H | Proof, then enable invitations in production by explicit approval |

Each phase ends with a local commit (or small commit set) and a phase report; production application of migrations happens only per rollout group with explicit authorization. Each phase lists its **13A dependency** (§0.3); local/staging work may proceed while 13A production rollout is pending, production application may not leapfrog it.

---

### PHASE A — Authority reconciliation

- **Objective:** Establish exact current authority truth and a fail-closed role/profile contract before any enforcement change.
- **13A dependency:** none for code/local/staging work; production read-only preflight requires explicit approval but not 13A rollout.
- **Existing authority:** `companyMembershipRoles.ts` presets; `companyMembershipSession.ts`; `requireCapabilitySession.ts`; `getUserCompanyId`; baseline RLS; 0A bootstrap.
- **Root problem:** Fail-open role parsing (R1, R3), owner/admin conflation (R2), undocumented route/RPC capability map (N4–N6), unknown live policy state.
- **Files/systems:** `app/lib/companyMembershipRoles.ts`, `companyMembershipSession.ts`, `companyMembershipPersistence.ts`, `requireCapabilitySession.ts`, new `app/lib/access/registry.ts` (data only), every `app/api/**/route.ts` (inventory), `supabase/migrations/*` (inventory).
- **DB/RPC:** None changed. Read-only preflight SQL (staging, then production with approval, counts/classes only): role value distribution; `owner` rows per company; `companies.owner_user_id` vs owner-role mismatches; memberships whose company is missing; companies without owner membership; disabled member counts; companies with >1 member; members per role; `pg_policies`, function grants/definer list, storage policies vs migration set.
- **API/server:** Fail-closed parsing: unknown/empty role ⇒ `invalid_role` (no capabilities); remove `?? "owner"` fallbacks; `presetFromMembershipRole` stops producing `owner_admin` for writes; Team PATCH rejects any value that would write `owner`.
- **UI:** None beyond unavoidable label mapping (display "Owner"/"Admin" separately where already rendered).
- **Migrations:** None.
- **Protected truth:** All §19.
- **Tests:** unit — every stored key, aliases (per preflight decision), null/empty/unknown ⇒ no capabilities; `owner` never writable via preset; registry snapshot; route inventory test asserting every contractor route declares a canonical capability (initially as a documented map).
- **Staging proof:** preflight SQL results recorded (counts only).
- **Visual proof:** none.
- **Production preflight:** read-only inventory with explicit approval; guard script before every DB operation; no values/emails/UUID lists printed.
- **Stop conditions:** any company with ≠1 owner-role row or pointer mismatch; unknown role values in production; membership rows without company. Stop and report remediation options — never promote by fallback.
- **Rollback/forward-fix:** Code-only; revert commit restores prior behavior (not recommended — fail-open).
- **Commit:** `fix(access): fail closed on unknown membership roles` + docs inventory.

### PHASE B — Enforcement hardening

- **Status (2026-09-27):** CLOSED for code + staging; production pending. Record: §2.5.
- **Objective:** Close disabled-member access, gate every sensitive operation by capability, make Team/directory reads work safely, and make access states honest.
- **13A dependency:** staging work none; production application requires RG-0 in production first (§0.3).
- **Entry gate:** reviewed policy inventory (§14.9) and function/grant inventory (§14.10) complete and recorded under `docs/` before any policy or grant migration is written.
- **Existing authority:** 117 inline membership RLS predicates; self-only membership/profile SELECT; membership-only routes (N4); user-client Team writes (R6).
- **Root problem:** R5, R6, R7, R8, R9, R10, N1, N2, N4, N5, N7, N8, N9, R15.
- **Files/systems:** new migration(s); `app/lib/ensureUserIdentity.ts` (`getUserCompanyId` typed), `contractorCapabilityAuth.ts`, `companyMembershipSession.ts`, `requireCapabilitySession.ts` → `requireAccess`, `companyMemberValidation.ts`, `companyMembershipPersistence.ts`, `api/company/members/route.ts`, routes in N4, `useCompanyMembers.ts`, `CompanySettingsTeamEditor.tsx` (data path only).
- **DB/RPC:**
  - `private` schema + `private.current_active_company_id()`; rebuild **family-1 (employee/member) policies only** per the reviewed §14.9 inventory — no blind/mechanical rewrite; public customer-token, service/internal, and exceptional-authority policies are preserved or changed only by explicit inventory decision.
  - `companies` SELECT via helper.
  - Directory RPCs (§14.4).
  - `set_company_member_role_v1(target, role, expected_revision)` enforcing §9 rules (no `owner`; Admin changes Owner-only; no self-change).
  - `disable_company_member_v1` (revocation-first) and `handoff_member_open_work_v1` (active-work scope, typed result) — minimal versions; Phase F extends.
  - `access_revision` column (if not deferred to C — prefer here, since B's RPCs need it).
  - Role `CHECK` constraint and owner-consistency constraint (I-3/I-4) after preflight.
  - Function/grant changes per the §14.10 inventory only: add missing active-membership/capability/`search_path` checks inside intentionally granted functions; revoke/narrow only grants proven excessive or unsafe (never merely because they look broad); restrict `proposal_public_access_tokens` SELECT to proposal-capable roles without affecting public-token validation paths.
  - Confirm storage bucket privacy (read-only) and document.
- **API/server:** typed membership resolution (`ok`/`none`/`disabled`/`invalid_role`/`unavailable`); map `unavailable` to 503-style recoverable errors, not 403/empty; add capability checks to N4 routes using the current capability set mapped to canonical names (§5.4); Team GET returns access-admin projection only for `team.manage`; assignment counts typed.
- **UI:** Team editor consumes typed states (loading/error/count); no redesign.
- **Migrations:** 1–2 forward migrations (policy rewrite; RPCs + constraints). No historical migration edits.
- **Protected truth:** public-token routes, acceptance/send/payment RPC semantics unchanged; only authorization predicates added.
- **Tests:** each inventory row's recorded regression proof; public-token flows (`/p` view/accept/sign/option choice, public scope-change authorize, public payment checkout, approval links) unchanged under anon; every intentionally granted function still works for its accepted caller classes; real-policy integration on staging with ≥2 companies × roles × {active, disabled}: disabled user JWT denied on every table (REST), every authenticated-granted RPC, attachments route; Field denied N4 operations; directory exposes no emails to non-managers; role RPC rejects `owner`, self, Admin-by-Admin; disable succeeds when handoff fails; counts never zero on error; completed jobs untouched by handoff; policy parity test: no policy references `company_memberships` except via helper.
- **Staging proof:** apply via `scripts/supabase-staging.ps1`; adversarial SQL (transaction-rolled-back) as in 0A.
- **Visual proof:** Team editor error/loading states desktop + 390 (no redesign).
- **Production preflight:** Phase A inventory current; policy count parity staging vs production; lock-time estimate for policy rewrite (DDL on 45 tables — run in one transaction, low-traffic window).
- **Stop conditions:** policy or function inventory incomplete/unreviewed; any policy's authority family unclear; any rewrite would touch public customer-token or other exceptional authority without an explicit inventory decision; live policies diverge from migrations beyond known set; a definer function's intended callers unclear; any route whose capability classification is ambiguous; constraint preflight finds violations.
- **Rollback/forward-fix:** forward-fix only (restoring removed-member access is not an acceptable rollback). Keep a reviewed "restore previous policy text" script for emergency only with approval.
- **Commits:** `fix(access): enforce active membership across tenant data`; `fix(access): gate sensitive routes and add safe team directory`.

### PHASE C — Policy foundation

- **Status (2026-09-27):** CLOSED for code + staging; production pending. Record: §2.6.
- **Objective:** Versioned registry, sparse rules, typed scopes, delegation ceilings, audit, and the Field job-access relation with enforced Field scope.
- **13A dependency:** production application requires RG-0 + RG-1 in production.
- **Existing authority:** hard-coded TS preset sets; no rules/audit; company-wide Field access.
- **Root problem:** R12, R13; default changes (§6) need data model.
- **Files/systems:** migrations; `app/lib/access/*` (registry parity, evaluator client, packages), `requireAccess`, Job Card field path (`JobCardClient.tsx`, field brief composition/model files) switched to `get_job_field_brief_v1`, jobs list/board/calendar/search data paths for Field, attachments routes.
- **DB/RPC:** tables `access_capabilities`, `access_role_profiles`, `access_role_profile_capabilities`, `access_packages`, `access_package_capabilities`, `access_capability_dependencies`, `company_member_access_rules`, `job_access_grants`, `company_access_events`; membership columns (`role_profile_version`, `disabled_by`, `disabled_reason`); `private.has_capability`, `private.can_access_job`; `resolve_member_effective_access_v1`; `grant_job_access_v1`/`revoke_job_access_v1`; `set_member_access_v1(target, role, packages, restrictions, expected_revision)` replacing the Phase B role RPC; `get_job_field_brief_v1`; Field-scoped RLS on job-linked tables and deny on commercial tables.
- **API/server:** all routes use `requireAccess` with canonical capabilities and `jobId` scope; default-change migration per Q2 (grandfather or tighten).
- **UI:** Field Job Card/list/calendar data-path switch with identical visuals; no Team UI yet.
- **Migrations:** 2–3 forward migrations (registry+rules+audit; job access + Field RLS; default-change data migration if approved).
- **Protected truth:** proposal/payment/lifecycle semantics unchanged; field brief content unchanged except removal of anything commercial that previously leaked.
- **Tests:** registry parity (DB ⇔ TS); DAG/cycle rejection; deny precedence matrix; dependency bundles; validity window at DB time; Field: sibling job (same customer/property) invisible in lists, counts, search, calendar, attention, activity, attachments, direct id; Field cannot read proposals/prices/payments/customers tables; own-task scope; job access grant requires active Field member; grants inert when disabled; audit row per mutation; no client writes to access tables.
- **Staging proof:** two companies; Field with 2 of 5 jobs where 2 share a customer; full adversarial matrix via REST + RPC + routes.
- **Visual proof:** Field Job Card and Jobs list desktop + 390 before/after (identical except intended scoping); Owner/Admin/Sales/PL unchanged.
- **Production preflight:** existing Field members count and their current usage; Q1b/Q2 decisions recorded; backfill plan for existing Field members (explicit grants with `source='migration'` for approved jobs, or none).
- **Stop conditions:** Field brief cannot be served without commercial fields; any Job Card field path still requires proposal reads; crew scope cannot be represented without conflating responsibility.
- **Rollback/forward-fix:** forward-fix; emergency lever = temporarily grant company-scope `jobs.read` to Field via reviewed profile version (audited), never disabling RLS.
- **Commits:** `feat(access): add capability registry, sparse rules, and audit`; `feat(access): scope field users to explicit job access`.

### PHASE D — Access resolver + create/join separation

- **Status (2026-09-27):** CLOSED for code + staging; production pending (0A must be in production first). Record: §2.7.
- **Objective:** Replace implicit bootstrap with an explicit resolver and explicit create-business path; no accidental company creation.
- **13A dependency (HARD):** `bootstrap_current_user_company_v2` is a forward migration on 0A's advisory lock, one-per-user unique index, and revoked client INSERT. Local/staging work may proceed; production application requires 0A applied and verified in production.
- **13C/13D boundary:** state screens here are minimal honest states; first-run activation (13C) and returning/invited destination (13D) are out of scope.
- **Existing authority:** `ensureUserIdentity` + `bootstrap_current_user_company_v1` (0A).
- **Root problem:** R4, N3, R14 honesty; prerequisite for invitations (§10.6).
- **Files/systems:** `app/lib/ensureUserIdentity.ts` (split: profile sync vs access resolution), 14 protected page/layout callers, `app/auth/callback/route.ts` (context preservation), new onboarding route(s) (`/start` or equivalent) for create-business / no-access / disabled / invitation chooser, login/signup return handling.
- **DB/RPC:** `resolve_current_user_access_v1`; `bootstrap_current_user_company_v2` (eligibility in-transaction, shared lock, optional company name); `private.lock_user_membership`; `company_creator_admissions` only if Q4 = controlled; revoke `authenticated` EXECUTE on v1 once no caller remains (same or later migration).
- **API/server:** POST create-business route; pages route by resolver state; `authorization_unavailable` screen.
- **UI:** minimal state screens (disabled, invalid role, no access, create business, unavailable) using existing shell primitives; no activation UX expansion.
- **Migrations:** 1 forward migration.
- **Protected truth:** 0A atomicity/idempotency/uniqueness/lock; existing single-owner users unaffected (resolver returns `active`).
- **Tests:** resolver per state; RPC failure ⇒ unavailable (never create); direct v2 RPC with pending invitation ⇒ refused without acknowledgment; concurrent create ×2 ⇒ one company; page load with no membership never creates; disabled user sees disabled screen, not login loop; v1 revoked ⇒ direct call denied.
- **Staging proof:** fresh user flows (new creator, disabled, pending-invite placeholder rows inserted via service role in a rolled-back transaction or test company), concurrency harness reused from 0A.
- **Visual proof:** each state screen desktop + 390.
- **Production preflight:** confirm 0A applied in production; count users with no membership (orphans) to understand first-visit behavior change.
- **Stop conditions:** 0A not in production; any page still calls bootstrap implicitly; resolver cannot read verified email reliably.
- **Rollback/forward-fix:** keep v1 EXECUTE until v2 path proven in production; rollback = redeploy prior app while v1 still granted.
- **Commit:** `feat(access): separate business creation from access resolution`.

### PHASE E — Invitations

- **Status (2026-09-27):** CLOSED for code + staging; production pending (0A must be in production first). Record: §2.8.
- **Objective:** Secure, idempotent, verifiable invitations joining existing companies.
- **13A dependency (HARD):** Phase D (bootstrap v2) and therefore 0A in production; the accept path shares 0A's per-user lock key and unique index.
- **Existing authority:** none.
- **Root problem:** R11; join path absent.
- **Files/systems:** migration; `app/lib/access/invitations*.ts`; routes: issue, resend, revoke, preview (POST), accept; `/join` page; Resend email template (reuse delivery infrastructure patterns, not proposal tables); optional Resend webhook mapping for invitation deliveries.
- **DB/RPC:** `company_invitations`, `company_invitation_delivery_attempts`; `issue_/resend_/revoke_/accept_company_invitation_v1`; preview RPC returning safe fields for a valid token.
- **API/server:** token generation in Node; post-commit send; idempotency; `Referrer-Policy: no-referrer`; token redaction in logs.
- **UI:** join preview/accept/wrong-account/expired/revoked/conflict states (Team add-user UI in Phase G).
- **Migrations:** 1 forward migration.
- **Protected truth:** 0A lock/uniqueness; no auto-join by domain; email delivery never holds access transactions.
- **Tests:** scanner GET never accepts; verified vs unverified vs changed email; expired/revoked/old generation; resend rotation invalidates old link; lost-response replay (issue, resend, accept); concurrent accept ×2; accept vs bootstrap race; accept after disable of target (conflict); issuer disabled ⇒ reauthorization_required; multiple companies' invitations; provider failure ⇒ pending + resend; tokens absent from logs/DB/audit payloads.
- **Staging proof:** real email to controlled inboxes on staging project; adversarial SQL.
- **Visual proof:** join states desktop + 390.
- **Production preflight:** Resend domain/sender configured for invitation template; Supabase auth email confirmation redirect URLs include `/join` context; feature flag off.
- **Stop conditions:** Phase D not complete; verified-email source ambiguous; any path requires storing raw tokens.
- **Rollback/forward-fix:** flag off disables issue/accept routes; tables inert.
- **Commit:** `feat(auth): add secure company invitation lifecycle`.

### PHASE F — Revocation / recovery / custody

- **Status (2026-09-27):** CLOSED for code + staging. Record: §2.9. No production migration was applied.
- **Objective:** Complete disable/reactivate/handoff model, strong authentication, ownership transfer, unavailable-owner runbook.
- **13A dependency:** production application requires RG-0..RG-2 in production.
- **Existing authority:** Phase B minimal disable/handoff; `companies.owner_user_id`.
- **Root problem:** custody operations absent; sensitive actions lack assurance.
- **Files/systems:** migrations; access RPCs; routes for disable/reactivate/handoff/transfer; MFA enrollment/step-up screens (Supabase MFA APIs); refund and payments-connect/settings routes add assurance checks; runbook doc under `docs/`.
- **DB/RPC:** `reactivate_company_member_v1`; `company_ownership_transfers` + `initiate_/acknowledge_/complete_/cancel_ownership_transfer_v1`; `private.assurance_ok(max_age)`; assurance checks in sensitive RPCs.
- **API/server:** optional session revocation on disable (service role, logged); step-up flows.
- **UI:** transfer section (Owner-only), MFA enrollment prompt when a sensitive action is attempted, handoff panel.
- **Migrations:** 1–2.
- **Protected truth:** refunds/payment semantics unchanged apart from added assurance; historical attribution immutable.
- **Tests:** transfer concurrency/lost response/inactive target/expiry; former Owner becomes Admin with reviewed packages; Owner cannot self-disable; aal1 denied on sensitive RPCs; stale session (old iat) denied; ordinary field operations never prompt; reactivation doesn't restore sensitive grants/job access.
- **Staging proof:** MFA enabled on staging; full custody flows.
- **Visual proof:** transfer + MFA prompts desktop + 390.
- **Production preflight:** Supabase MFA configuration change approved (Q5); support runbook approved.
- **Stop conditions:** MFA cannot be enabled without affecting existing sign-in; assurance claims unavailable in JWT.
- **Rollback/forward-fix:** assurance checks behind a server flag only for rollout sequencing; never disable disable-first semantics.
- **Commit:** `feat(auth): harden membership recovery and custody`.

### PHASE G — Minimal Team UI

- **Status:** CLOSED for code (2026-09-28). Record: §2.10.
- **Objective:** Ship the contractor Team screen on top of B–F authority.
- **13A dependency:** inherits B–F; production flag stays off until Phase H.
- **DB/RPC:** none new. Pending invitations are read in the app after `team.manage`, from the session company, because the table has no client grant and no list RPC.
- **Migrations:** none.
- **UI:** list, add team member, invitation states, explicit role save, remove and reassignment, reactivation, Owner transfer with an honest strong-sign-in block. No permission matrix. No job-id editor.
- **Protected truth:** A–F authority unchanged. Accepted Job Card/Board UI unchanged. No settings redesign beyond Team.
- **Tests:** `app/lib/phase13gTeamUi.test.ts` plus A–F regressions.
- **Visual proof:** pending. The user-owned runtime targets production, which does not have this schema. Validate at Phase H.
- **Commit:** `feat(team): add launch-ready company access management`.

### PHASE H — End-to-end launch proof

- **Objective:** Prove the whole system on staging, then production-safe verification, then enable.
- **13A dependency:** RG-0..RG-3 in production with recorded release provenance (exact SHAs / deployment ids).
- **Scope:** journeys for Owner, Admin, Sales, Production Lead, Field (scoped); invitation flow; wrong identity; stale session; disabled user; cross-tenant adversarial; mobile/desktop; direct DB/API/RPC/storage.
- **Tests:** §17 matrix executed; results recorded with evidence paths under `tmp/fielddive-ui-review/phase13-access/`.
- **Production preflight:** all RG-1..RG-3 migrations applied with approval; exact deployment id promoted; read-only production policy parity check; invitation flag enable requires explicit approval.
- **Stop conditions:** any role promising a restriction the DB cannot enforce; any failed-as-empty state; any cross-tenant read.
- **Commit:** `docs: record company access launch proof` (+ handoff update in that session only).

---

## 17. Test / proof requirements

### 17.1 Layers
Unit (registry, parsing, evaluator client, UI state) are necessary but insufficient. Every phase touching authority requires **real-policy integration tests** against staging with ≥2 companies and all roles, exercising PostgREST, RPC, server routes, and storage/signed URLs. No production writes for testing.

### 17.2 Matrix (cumulative; each phase adds its rows)

| Area | Required proof |
|---|---|
| Role parsing | every key; unknown/null/empty ⇒ no capabilities; `owner` never assignable |
| Active membership | disabled user + old JWT denied on all tables/RPCs/routes/storage |
| Capability gates | each N4 route denied for roles lacking capability; allowed for holders |
| Directory | non-managers see names/roles only; managers see emails; no cross-tenant |
| Deny precedence | company deny beats job grant; job deny isolated |
| Dependencies | incomplete bundle rejected; cycle rejected; prerequisite removal previewed |
| Delegation | Admin ceiling (all "may not" items); PL job-access only; no self/peer/recursive |
| Field scope | sibling jobs hidden in list/count/search/calendar/attention/activity/files/direct id; no commercial tables; brief projection has no money |
| Create/join | no implicit creation; direct RPC eligibility; accept vs create race; disabled conflict |
| Invitations | §PHASE E list |
| Revocation | disable-first; handoff failure honest; completed attribution unchanged; reactivation review |
| Custody | transfer atomicity/concurrency; Owner undisableable; recovery runbook dry-run |
| Assurance | aal2 + recency on sensitive; none on field work |
| Policy parity | DB evaluator ⇔ TS labels; no route without `requireAccess`; no definer function without actor/membership check |
| Regression | acceptance ≠ approval; send-freeze; immutable sent versions; pricing; payment/refund math; lifecycle; public tokens; historical attribution |
| Full suite | known-failure baseline unchanged or reduced; canonical typecheck 0; isolated production build PASS |

### 17.3 Visual proof
Desktop + true 390 px for every new/changed screen; stored under `tmp/fielddive-ui-review/phase13-access/<phase>/`. Accepted Job Card/Board screens re-captured only to prove "unchanged" where a data path changed (Phase C).

---

## 18. Production / staging boundaries

1. Production `rhquhnujjnzjhweypavd`; staging `tjtrhdckinjtorgbkirm`. CLI link stays staging.
2. `scripts/supabase-target-guard.ps1` before **every** DB operation; production requires `-AllowProduction -ProductionAuthorization …` and explicit per-task approval.
3. Migrations apply to staging first (`scripts/supabase-staging.ps1`), with adversarial verification; production only per rollout group with explicit approval.
4. **Slice 0A/0B/0C (13A) coordinated production rollout precedes RG-1 production application.** That rollout review and its explicit production authorization are still pending; 0A is on staging only, and production is not yet protected by 0A. 13B local/staging work may proceed meanwhile; production application of 13B must not leapfrog 13A (§0.3). Phases D and E hard-depend on 0A being live in production.
5. Production reads during preflight: counts/classifications only; never print emails, names, UUID lists, keys, tokens, `DATABASE_URL`.
6. Selective builds/installs only in isolated worktrees; main `.next`/`node_modules`/port 3000 belong to the user.
7. No push/deploy without explicit authorization; promote exact deployment ids.
8. Supabase Auth configuration changes (MFA, redirect URLs, email templates) are production configuration changes requiring approval.
9. Invitation feature flag defaults off in production until Phase H approval.

---

## 19. Protected systems (must not weaken)

Tenant isolation · Slice 0A bootstrap atomicity, idempotency, advisory lock, uniqueness · proposal acceptance authority · accepted ≠ operationally approved · proposal send-freeze · immutable sent versions · pricing truth · payment/refund truth and idempotency · job lifecycle truth · schedule truth · public customer-token authority · historical attribution (actors, activity, completed-job responsibility) · accepted Job Card/Board UI · Phase 12.5 cohesion.

Access permission never overrides business eligibility. Authorization changes add predicates; they never relax domain rules.

---

## 20. Deferred extension points (supported by design, not implemented)

| Extension | Hook in this design |
|---|---|
| Custom roles | Stable role keys + versioned profiles + registry; role designer absent |
| Branch/location scope | Reserved `scope_kind='branch'` |
| Sales-team scope | Reserved `scope_kind='sales_team'` (never from `jobs.assigned_to`) |
| Subcontractor/external membership | Future `membership_kind` + narrower ceiling; requires one-company invariant redesign |
| Temporary-access UI | `valid_from`/`valid_until` evaluated already |
| SSO/SCIM | Identity-independent membership |
| Multiple Owners / Primary Owner | Custody pointer + owner profile separation |
| Delegation mandates | `authority_source='mandate:<id>'`; table added when needed |
| Approval thresholds / discount approval | Domain-eligibility hook; no capability until workflow exists |
| Advanced report scopes / export | `data.export` reserved; scope survives export |
| Autonomous service principals | Separate registered principal with company-owned authority; not the copilot |
| Portable employment | Membership history + unique active binding; requires explicit invariant change |

None may appear as partially working UI controls.

---

## 21. Known risks / unresolved implementation questions

### 21.1 Risks

| Risk | Mitigation |
|---|---|
| Rebuilding ~117 policies | No blind/mechanical rewrite; reviewed §14.9 inventory by authority family; only employee/member policies use the helper; per-row regression proof; parity test; staging adversarial proof; low-traffic window |
| Employee helper alters public customer-token authority | Authority-family classification; public-token flows in Phase B regression suite; unclear family = stop |
| Revoking a grant a legitimate caller needs | §14.10 per-function inventory; change only grants proven excessive/unsafe; caller-class regression tests |
| 13B production changes leapfrog pending 13A rollout | §0.3 dependency rule; per-phase 13A dependency; production preflight verifies RG-0 provenance |
| Live DB diverges from migrations | Phase A catalog comparison is a gate |
| Field scoping breaks Job Card/Board data paths | Phase C switches Field to projection RPC with visual parity proof |
| Default tightening surprises existing users | Q2 decision; grandfather option; preflight counts; release note |
| Directory exposure | Two projections; profiles/memberships remain self-only |
| Lock-key drift between bootstrap and accept | Shared helper with identical key text; test asserting key text |
| MFA rollout friction | Step-up only on sensitive actions; enrollment prompted at first sensitive attempt |
| One-company invariant blocks rehiring elsewhere | Honest disabled state + support path; redesign deferred |
| Membership-only sensitive routes live today (N4) | Phase B priority; Fix-When-Found |

### 21.2 TIMOTHY DECISIONS required

| # | Decision | Needed before | Recommendation |
|---|---|---|---|
| Q1 | Confirm Field job access is a launch requirement (vs limiting launch onboarding to company-scope roles) | Phase C | Implement (already approved in this program brief) |
| Q1b | Should assigning a Field member to a task/production lead auto-create an explicit, audited job-access grant? | Phase C | Yes, same transaction, `source` recorded; no auto-revoke |
| Q2 | Accept §6 default changes for Admin/Sales, and choose **grandfather** (explicit migration grants for existing members) vs **tighten** | Phase C | Grandfather existing members; new members get new defaults |
| Q3 | Launch sensitive delegation Owner-only (no mandates) | Phase C | Owner-only |
| Q4 | Business creation admission: open self-serve sign-up vs controlled creator admission | Phase D | Decide based on go-to-market; if controlled, add `company_creator_admissions` |
| Q5 | MFA/step-up for Owner and sensitive actions, and an unavailable-owner support process owner | Phase F | Require for listed actions; Timothy names support owner |
| Q6 | Accept disabled-membership cross-company limitation for launch | Phase E | Accept; document support path |
| Q7 | Existing production Field members (if any): backfill job access from current task/lead assignments, or start empty | Phase C | Backfill from open-work assignments with `source='migration'` |
| Q8 | Label "Production Lead" vs "Production Manager" | Phase G | Keep "Production Lead" with role description |
| Q9 | Invite link token placement: path (`/join/[token]`, consistent with `/p/[token]`) vs URL fragment (keeps token out of server logs; needs client handoff through auth) | Phase E | Path + no-referrer + log redaction for consistency |
| Q10 | Admin: Owner-grantable "Payment provider settings" package post-launch, or Owner-only permanently | Post-launch | Owner-only at launch |

### 21.3 Open implementation questions (resolved inside phases, no product decision)

- Exact non-terminal lifecycle stage set for handoff (Phase A from `jobs.stage`/disposition truth).
- Whether `pricing.cost.read` and `company_financials.read` have real surfaces today (Phase A).
- Whether a field-notes workflow exists (Phase A).
- Storage bucket policy state (Phase B read-only).
- Company settings writes: RPC vs policy for Admin (`companies` UPDATE is Owner-only today) (Phase B).
- Session revocation API behavior on Supabase plan in use (Phase F).
- Invitation Resend webhook mapping reuse vs separate handler (Phase E).

---

*End of blueprint. 13C (First-Time Business Activation) and 13D (Returning / Invited User Entry) are separate programs (§0.1). This document authorizes planning only; migrations, production changes, deploys, and pushes each require separate explicit authorization.*
