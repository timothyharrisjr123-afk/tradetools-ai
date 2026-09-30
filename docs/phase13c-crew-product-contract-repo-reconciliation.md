# Phase 13C — Crew Product Contract and Repo Reconciliation

**Status:** **LOCKED product contract** (2026-09-29). Decisions in Part 0 are approved. No implementation, migration, SQL, UI, or test change is authorized by this document; each slice in Part 23 needs its own implementation prompt.
**Code checkpoint:** `da6eb10` (Phase 13B A–H closed on staging; 13B is **not** in production).
**Inputs:** the governance standards, the Phase 13 blueprint (§0.1, §2.9–2.11), Astra architecture v2, the two Phase 13C Astra research documents, the global handoff, and current code and migrations. Code wins over docs where they disagree; discrepancies are listed in Part 1.

Decision labels: **LOCKED** (approved in Part 0), **APPROVE WITH ADAPTATION**, **NEEDS PRODUCT DECISION**, **BLOCKED BY REPO TRUTH**, **NEW DIRECTION**.

---

## PART 0 — Locked decisions

| # | Decision | Status |
|---|---|---|
| L1 | Crew / Lead / person / assignment work is an **explicit Phase 13C scope extension**. Crew and team setup stay optional and **never block first-proposal activation**. | LOCKED |
| L2 | **Owner** unchanged. The Owner may be a Crew's usual Lead and a Job's assignment Lead with no extra account, duplicate person, or role switch. | LOCKED |
| L3 | **Office Manager** = contractor-facing presentation of the current `admin` authority. No broadening. Owner-only custody and sensitive boundaries preserved. | LOCKED |
| L4 | **Production Coordinator** = contractor-facing label for `production_lead`. Key and authority unchanged; optional specialist access, not primary setup. | LOCKED |
| L5 | **Lead** = `field_user` + corrected `lead_assigned_work` package. Access only to assigned or authorized jobs. No company-wide production, Calendar mutation, Team, proposal, pricing, payment, or broad activity access. | LOCKED |
| L6 | Lead does **not** see the company directory. Lead sees only people relevant to authorized work, through a scoped per-job projection. | LOCKED |
| L7 | Lead may **view** authorized schedule truth and may **not** reschedule at launch. | LOCKED |
| L8 | An authorized Lead may **start** assigned work but may **not** perform final **Complete job** at launch. This requires a capability split (Part 5A). "Work finished / Ready for review" is **not** approved here. | LOCKED (split design in Part 5A) |
| D-S1 | Only the **active assignment Lead** may use Lead-scoped (job-scoped) Start work authority. Job access is not job responsibility: access from a task, a manual grant, or any other reason does not qualify. Crew membership never qualifies. Company-wide operators keep their company-level Start work authority. Until durable assignment-Lead truth exists (Slice 4), job-scoped Start work is unavailable; there is no temporary substitute (`jobs.assigned_to` and `crew_label` are never assignment-Lead truth). | LOCKED (2026-09-29) |
| L9 | Durable `company_people`, `crews`, `crew_members`, `job_crew_assignments`. One active production Crew per Job; sequential history; no multi-crew planning. | LOCKED |
| L10 | Non-login people: name required, phone optional, nothing else required. Archive, never erase, once referenced. | LOCKED |
| L11 | **Person → user linking is required** for the complete Crew model. It is delivered in Slice 7, and **13C cannot close without it**. | LOCKED |
| L12 | Assignment Lead is explicit on the assignment. It defaults from the usual Lead; changing it creates new history; the Owner is eligible; an override never mutates the Crew. | LOCKED |
| L13 | `job_access_grant_reasons` explains why a grant exists. `job_access_grants` remains the only access-check input. The evaluator is not rewritten to read crews. | LOCKED |
| L14 | Manual removal ends only the **manual** reason family. It never silently removes access justified by another reason. An explicit deny is the existing **job-scoped restriction**, a separate concept (Part 12C). | LOCKED |
| L15 | Crew-derived access ends when the **reason ends**: Crew replaced, assignment Lead replaced, assignment ended, or Job closed (closing ends the active assignment). The grant is revoked only if no other live reason remains. | LOCKED |
| L16 | Task-derived access keeps current behavior (unassign never revokes). It is recorded as its own sticky reason. | LOCKED |
| L17 | Crew membership alone **never** grants job access, even for members with logins. | LOCKED |
| L18 | Reactivation restores nothing historic. An optional reviewed choice offers **currently** relevant assignments; default **OFF**; any restore is recomputed from current truth. | LOCKED |
| L19 | `jobs.assigned_to` is presented as **Coordinator** with behavior preserved. `jobs.crew_label` becomes read-only compatibility data; the durable assignment is authoritative. | LOCKED |
| L20 | Calendar stays the single schedule authority, with crew context only. Leads cannot mutate schedules. Known overlap shows a nonblocking **"Schedule overlap"** warning. Filtering only where useful. | LOCKED |
| L21 | Jobs Board shows crew only in the **Scheduled** and **Production** lanes. | LOCKED |
| L22 | Company Settings has **Team** (software access) and **Crews** (labor grouping). No dashboard. Contextual Create Crew returns to the pending assignment with the new crew selected; the user still saves explicitly. | LOCKED |
| L23 | Visual standard per Part 16 (research references and FieldDive rules). | LOCKED |
| L24 | Sales and Field stay as optional specialist access (Other access). Not deleted or migrated. | LOCKED |
| L25 | 13C / 13D ownership per Part 17. No 13D routing work in 13C. | LOCKED |

**Roadmap and governance implication (L1):**
- The roadmap (blueprint §0.1) defines 13C as First-Time Business Activation with the target "first real proposal sent".
- This contract adds the crew program to 13C as an approved extension. It does **not** replace the activation track.
- 13C closes only when **both** of these hold:
  - the activation track meets its own acceptance;
  - Slices 1–8 of Part 23 are complete, including person → user linking.
- The global handoff and blueprint are updated at the Slice 1 docs step or at 13C closure, **not** by this document.

---

## PART 1 — Repo truth summary

| # | Item | Code truth | Consequence for this contract |
|---|---|---|---|
| 1 | Roles | Five keys `owner, admin, office_sales, production_lead, field_user` (`app/lib/companyMembershipRoles.ts:11-17`); CHECK constraints in `20260927170000`, `190000`, `200000`. Labels: Owner, Admin, Sales, Production Lead, Field. | Keys stay; labels change (Office Manager, Production Coordinator). |
| 2 | Registry | Capabilities, role profiles, packages in `app/lib/access/registry.ts`, mirrored and parity-tested in `20260927190000`; invariants asserted by `private.access_registry_violations_v1`. | Registry edits are seed migrations plus parity tests. |
| 3 | Production Lead | Company scope: `customers.read, jobs.read, jobs.assign, jobs.progress, jobs.hold, measurements.capture, photos.contribute, tasks.read/complete/manage, schedule.read/manage`. | Not an onsite Lead (L4, L5). |
| 4 | Admin | Company scope: customers, all `jobs.*` including `finalize`, measurements, photos, tasks, schedule, proposals read/write/send, `scope_changes.write`, `company.manage`, `team.manage`. Excludes `scope_changes.issue`, `pricing.manage`, `templates.manage`, `payments.*`. Cannot invite or edit Admins or touch custody. | Office Manager mapping (Part 4). |
| 5 | `lead_assigned_work` | Active; `granted_jobs`; Field only; `tasks.manage, tasks.read, jobs.progress, schedule.manage, schedule.read`; `assignableBy` includes `production_lead`. | **Discrepancy:** no server path lets Production Lead assign it. Correct in Slice 1. |
| 6 | Task coupling | `private.job_assignment_access_coupling_trg_v1` (`20260927195000:533-599`) grants access when a task or `jobs.assigned_to` is assigned to an active `field_user` and the actor holds **company** `jobs.assign`. **Never revokes** (line 550). | Sticky task reason (L16). A Lead assigning a task creates no grant (Part 5 gap). |
| 7 | Manual grant/revoke | `grant_job_access_v1` / `revoke_job_access_v1` → `private.change_job_access_v1` (`20260927195000:415-531`). Tier Owner/Admin/Production Lead + `jobs.assign`; target must be an active `field_user`; revoke clears the single live row **whatever its source**. **No app caller** (tests and staging proof scripts only). | Semantics can change without breaking any product caller (Part 12C). |
| 8 | Explicit deny | `company_member_access_rules` `effect = 'restrict'` with `scope_kind = 'job'` + `scope_job_id`, set through `set_member_access_v1` restrictions (`20260927195000:250-320`). Evaluated before any allow (`20260927192000:84-97`). `member_job_ids_v1` filters candidates through `member_can_v1`, so a job restriction on `jobs.read` removes the job from granted-job reads. Admin cannot lift Owner restrictions; grant/restrict conflicts are rejected. | A durable deny **already exists** (Part 12C). |
| 9 | Start / Complete | `start_job_work_v1` and `complete_job_work_v1` (`20260927193000:2326-2366, 2559-2599`) both require `member_can_v1('jobs.progress', job)`. Routes `/api/jobs/start-work` and `/api/jobs/complete-work` both `requireAccess('jobs.progress')`. Callers: `JobCardClient.tsx:1136, 1165, 1253`, `SavedClient.tsx:3478, 3514`, legacy `RoofingClient.tsx:8486, 8525`. UI eligibility (`jobLifecycleActionEligibility.ts:122-131`) is **stage-only**, with no capability flag. | Split required (Part 5A). UI must become capability-aware. |
| 10 | `jobs.assigned_to` | One user id labelled "Production lead"; any live member; writes `production_lead_*` activity events from TS only; moved by handoff; drives `open_job_lead_count`; Board footer. | Becomes Coordinator (L19). |
| 11 | `jobs.crew_label` | Free text ≤ 80, written directly by `PATCH /api/jobs/[jobId]/production-lead` (`jobs.assign`), no audit or event; read by Job Card state region, Field brief, overview composition. | Read-only compatibility (L19). |
| 12 | Calendar | `job_schedules` (one active work row per job; no crew/lead column). Writes only via `schedule_job_v1 / reschedule_job_v1 / unschedule_job_v1`, gated by `schedule.manage`. Shared editor used by Calendar, Job Card Calendar tab, Jobs Board. | "Calendar authority" = the schedule model + RPCs. No schema change. |
| 13 | Job Card | Tabs Overview, Tasks, Calendar, Measurements, Proposals, Payments, Photos (+ Activity). No Production tab. `JobCardProductionLeadControl` edits lead + crew label in the Overview state region or brief. | Crew & Lead editor replaces it in place. |
| 14 | Team | Focused editor in Company Settings; not deep-linkable; panels invite, role, remove + handoff, reactivate, reassign, invitations, transfer. | Add Crews row; relabel. |
| 15 | Directory | `list_company_directory_v1` returns active members (name, role) to company `jobs.read` holders **or anyone with job-scoped `tasks.manage`** (`20260927195000:879-899`). | The job-scoped clause exposes the directory to Leads. **Remove it** (L6). |
| 16 | Task assignee validation | `setJobTaskAssignee` validates the assignee through `validateLiveCompanyMember`, which reads the directory (`app/lib/companyMemberValidation.ts:71-93`). | Narrowing the directory breaks Lead task assignment unless validation moves server-side (Slice 4). |
| 17 | Lifecycle | Disable makes grants inert. Handoff moves open `assigned_to` and open task assignees only. Reactivation revokes all rules and grants, then applies only the requested set. Transfer keeps job grants. | Reasons follow each (Part 12). |
| 18 | History | No assignment history. `company_access_events` records grant/revoke reasons; `job_activity_events` records `production_lead_*` from TS only; no task or crew events. | New assignment table + events. |
| 19 | Attribution | `job_attachments.created_by`, `job_tasks.completed_by`, `job_activity_events.actor_user_id`. | Never overwritten by crew data. |
| 20 | Landing | All active roles land on `/tools/roofing/saved`. | 13D. |

---

## PART 2 — Current role and capability map

| Capability group | Owner | Admin | Sales | Production Lead | Field |
|---|---|---|---|---|---|
| Customers read / manage | ✔ / ✔ | ✔ / ✔ | ✔ / ✔ | ✔ / pkg | — |
| Jobs read / manage | ✔ / ✔ | ✔ / ✔ | ✔ / ✔ | ✔ / pkg | granted / — |
| Assign, progress, hold, finalize, approve | all | all | pkg | assign, progress, hold; approve pkg | Lead pkg: progress (granted) |
| Tasks read / complete / manage | ✔ | ✔ | read, complete; manage pkg | ✔ company | granted read; own-task complete; Lead pkg: manage (granted) |
| Schedule read / manage | ✔ | ✔ | read; manage pkg | ✔ company | granted read; Lead pkg: manage (granted) |
| Proposals read / write / send | ✔ | ✔ | ✔ | — | — |
| Scope change write / issue | ✔ / ✔ | write / pkg | write / pkg | — | — |
| Pricing, templates | ✔ | pkg (Owner) | pkg (Owner) | — | — |
| Payments summary / history / request | ✔ | pkg (Owner) | pkg (Owner) | — | — |
| Refund, payments configure | ✔ | — | — | — | — |
| Company settings | ✔ | ✔ | read | read | read |
| Team | ✔ | ✔ (not Admins, not custody) | — | — | — |
| Custody, transfer, Admin promotion | ✔ (strong sign-in) | — | — | — | — |

---

## PART 3 — Owner contract — LOCKED (L2)

- All active capabilities, custody, strong sign-in for sensitive changes, exactly one Owner.
- Eligible as usual Lead and assignment Lead through the Owner's own linked person record, created idempotently on first selection. No second identity; no grant is needed because the Owner has company scope.
- Creates, edits, and archives crews and people; assigns crews; overrides Leads.
- Owner-only boundaries unchanged: transfer, Office Manager promotion and editing, Owner-granted packages, payment configuration, refunds.

---

## PART 4 — Office Manager contract — LOCKED (L3)

Office Manager is the label and description of the existing `admin` key. **The capability set does not change.**

| Current Admin authority | Office Manager meaning | Flag |
|---|---|---|
| Customers read/manage; jobs read/manage/approve/hold; measurements; photos | Office runs customers and jobs | Fits |
| Tasks manage; schedule manage; jobs assign/progress | Office schedules and assigns crews | Fits |
| Proposals read/write/send; scope change write | Office prepares proposals | Fits. Authoring reads pricing inputs; never advertise "costs hidden". |
| `jobs.finalize` (mark lost/closed, reopen) | Office closes out jobs | Fits |
| `jobs.complete` (new, Part 5A; inherited from `jobs.progress`) | Office records completion | Fits |
| `company.manage` (business identity, branding, timezone) | Office keeps business details current | **FLAG F1:** branding and identity are owner-flavored for some contractors. Not changed; revisit only with contractor evidence. |
| `team.manage` (invite and manage non-Office-Manager members; grant Admin-delegable packages: approve jobs, coordinate production, Lead assigned work, manage customers and jobs) | Office adds team members | **FLAG F2:** broader than "office work" for some owners. Bounded by the delegation ceiling (no Office Managers, no Owner-only packages, strong sign-in). Not changed. |
| Pricing/templates, payment summary/history/request, scope-change issue | — | Stay Owner-granted special access |
| Payments configure, refunds, custody, Office Manager promotion | — | Stay Owner-only |

- **Description:** "Runs the office: customers, jobs, proposals, scheduling, and crews. Can add team members. Money settings, pricing, and ownership stay with the Owner unless you give them access."
- **Label-dependent surfaces:**
  - `COMPANY_MEMBERSHIP_ROLE_LABELS`, `TEAM_ROLE_BLURB`
  - invite and role pickers, Team row copy
  - `owner_required` error copy, strong sign-in copy, transfer "Your next role" default
  - Phase G/H tests that assert "Admin"
- Delegation tier `'admin'` and `TeamDelegator` keep internal names.
- The narrow office helper (no `team.manage`, no `jobs.finalize`) is deferred NEW DIRECTION N04.

---

## PART 5 — Lead contract — LOCKED (L5–L8)

**Preset:** role `field_user` + package `lead_assigned_work`, corrected to:
- **capabilities:** `tasks.read`, `tasks.manage`, `jobs.progress` (start work only, after Part 5A); **no** `schedule.manage`;
- **assignable by:** Owner, Office Manager (`production_lead` removed);
- **scope:** `granted_jobs`.

**Lead sees and does:**
- assigned-job context, customer contact, and address (existing Field projection on granted jobs);
- schedule read on granted jobs;
- tasks: complete any task on the job (covers non-login workers), create and assign within the scoped picker;
- photos, measurements capture;
- Start work;
- crew context through the scoped people projection.

**Lead never gets:**
- company-wide production or Calendar mutation
- rescheduling (L7)
- Complete job (L8)
- Team
- proposals, pricing, payments
- the company directory (L6)
- activity outside granted jobs

**Three separate facts:**
1. software access (membership role + packages)
2. usual Lead of a Crew
3. assignment Lead on a Job

They are often the same person, but never forced to be.

### 5A — Start work vs Complete job (LOCKED meaning; smallest durable split)

- **Existing writers:**
  - RPCs `start_job_work_v1`, `complete_job_work_v1` (both `jobs.progress` at the job);
  - routes `/api/jobs/start-work`, `/api/jobs/complete-work` (both `requireAccess('jobs.progress')`).
- **Existing readers:**
  - holders of `jobs.progress` (Owner, Admin, Production Lead at company scope; Sales with `coordinate_production`; Field with `lead_assigned_work` on granted jobs);
  - legacy crosswalk `lifecycle_start_complete → jobs.progress`;
  - UI actions: Job Card primary lifecycle action and `JobCardScheduleSection` ("Start work" / "Complete job"), Board card and list actions, legacy `RoofingClient`.
- **Proposed boundary:**
  - Add a new active capability **`jobs.complete`** (company scope, depends on `jobs.read`).
  - `complete_job_work_v1` and `/api/jobs/complete-work` check `jobs.complete`.
  - `jobs.progress` keeps meaning **start work** only.
- **Grants of `jobs.complete`:**
  - Owner (all active);
  - `admin` and `production_lead` profiles;
  - the `coordinate_production` package.
  - **Not** `lead_assigned_work`.
- **Lifecycle invariant:**
  - Start work (Scheduled → Production) needs `jobs.progress` at the job.
  - Complete job (Production → Complete) needs `jobs.complete`.
  - No other path reaches Complete.
  - Field reporting never writes final completion.
- **Registry and migration implications:**
  - TS registry + seed: new capability row, dependency, profile rows, package rows.
  - Registry violation function and parity tests updated.
  - `complete_job_work_v1` redefined.
  - Crosswalk `lifecycle_start_complete → ["jobs.progress", "jobs.complete"]`.
  - 13B is not in production, so this lands **before** any production rollout.
- **Backward compatibility:** every current company-scope holder of `jobs.progress` also receives `jobs.complete`. Owner, Office Manager, Production Coordinator, and Sales with Coordinate production see no change. Only the Lead package loses completion.
- **Affected UI:**
  - Lifecycle eligibility must combine stage with job-scope capability. New flags come from `get_member_effective_access_v1` job capabilities: `canStartWork = stage rule && jobs.progress@job`, `canCompleteJob = stage rule && jobs.complete`.
  - Leads see Start work and never Complete job.
  - Today's stage-only eligibility can show buttons the server then refuses. That is fixed in Slice 1.
- **D-S1 — LOCKED (2026-09-29): only the active assignment Lead.**
  - The capability engine has no "assignment Lead" scope, so `jobs.progress` alone cannot express responsibility. The evaluator does distinguish scope: `member_can_v1('jobs.progress')` with no job is true only for a **company-scope** source; job-scoped sources (the Lead package on granted jobs) answer only at a job.
  - Server contract for `start_job_work_v1`:
    1. the caller holds `jobs.progress` at the job (restrictions win); **and**
    2. the caller holds it at company scope, **or** (Slice 4) the caller is the job's current active assignment Lead.
  - Slice 1 ships clause 1 plus the company-scope branch only. The assignment branch is added in Slice 4 inside the same RPC, reading `job_crew_assignments`; the evaluator is not changed. No role-name check, no `jobs.assigned_to`, no `crew_label`.
  - Until then the Lead package carries `jobs.progress` (the locked product meaning) but no Lead can start work, and the UI never offers it: `canStartWork` requires company-scope `jobs.progress` plus `jobs.progress` at the job.
- **Verification STOP:** Slice 1 must confirm no other writer moves a job to Complete (board drag, legacy update paths). If one exists, it must also require `jobs.complete`.

### 5B — Scoped people projection (L6)

- **Remove** the `cardinality(private.member_job_ids_v1('tasks.manage')) > 0` clause from `list_company_directory_v1`.
  - Company `jobs.read` holders keep the directory.
  - Field and Lead see only themselves.
  - The only members affected are granted-job `tasks.manage` holders, which means Leads.
- **Add** a per-job people projection. Extend `get_job_field_brief_v1.people`, readable only for jobs the viewer may read. Each entry: `{ person_id, user_id|null, name, relation, assignable }`.
  - `relation` ∈ `assignment_lead`, `crew_listed` (from the assignment's roster snapshot), `coordinator` (`jobs.assigned_to`), `task_assignee`.
  - `assignable` = true only for authenticated active members who already have access to this job.
  - **No** phone numbers, email, roles, other crews, or other jobs at launch. The customer contact stays as today.
- **Task picker for Leads:** people with `assignable = true` + Unassigned.
- **Server:** task-assignee validation moves from the directory to a server-side membership check (SECURITY DEFINER or service-role validation), so narrowing the directory does not break assignment. The coupling rule is unchanged.

---

## PART 6 — Sales / Field / Production Coordinator — LOCKED (L4, L24)

- **Dependencies:**
  - `office_sales`: package eligibility (payments, pricing, scope issue, approve jobs, coordinate production); Board "author" state.
  - `field_user`: the only target of coupling, manual grants, invitation `job_ids`, reactivation `job_ids`; `restrictedFieldRole` projection; **underpins the Lead preset**.
  - `production_lead`: `approve_jobs` / `manage_customers_jobs` eligibility; delegation tier for `change_job_access_v1`; Board "coordinator" state.
- **Invite presentation:**
  - Primary choices: **Office Manager**, **Lead**.
  - Collapsed **Other access**, each with one sentence:
    - Sales: prepares customers and proposals.
    - Production Coordinator: coordinates all jobs, schedules, and tasks, without money.
    - Field access: photos and tasks on jobs you give them.
- Existing members keep their real labels.
- Hiding these from the primary list breaks nothing server-side. Nothing is deleted or migrated.

---

## PART 7 — Crew domain model — LOCKED (L9)

- **Fields:**
  - `id`, `company_id`
  - `name` (1–80; unique among active crews per company, case-insensitive)
  - `usual_lead_person_id` (nullable)
  - `archived_at`, `archived_by`
  - `created_by`, `created_at`, `updated_at`, `row_version`
- **A crew without a usual Lead:** shown as "Needs a Lead" and not selectable for assignment unless a Lead is chosen in the assignment editor.
- **Owns nothing else:** no permissions, payroll, HR, time, schedule, pricing, or ownership.
- **Subcontractor crews:** same object; an optional short company note may be added later; no vendor compliance or cross-company identity.
- **Managers:** company-scope `jobs.assign` holders (Owner, Office Manager, Production Coordinator, Sales with Coordinate production). No Lead roster editing at launch.

---

## PART 8 — Non-login people — LOCKED (L10, L11)

- **Fields:**
  - `id`, `company_id`
  - `display_name` (1–80, not unique)
  - `phone` (optional; never identity)
  - `linked_user_id` (nullable; unique per company)
  - `archived_at`
  - `created_by`, `created_at`, `updated_at`, `row_version`
- **Visibility:**
  - Phone numbers are visible only to crew managers.
  - The Lead projection carries names only (5B).
- **Members:** a linked person record is created idempotently when a member is first chosen as a Lead or roster member (`upsert on (company_id, linked_user_id)`). No bulk backfill.
- **Linking (Slice 7):**
  - "Give FieldDive access" starts the invite from the person; the invitation carries `person_id`; acceptance links in the same transaction.
  - When a person is created or invited, possible matches are listed for review: same linked user, identical normalized name in the company, or same phone.
  - Never merge by name alone. Never treat phone or email as identity.
  - An existing linked person blocks a duplicate link.
  - History on the person stays. Authenticated actions start at linking.
- **Separate acts:**
  - Archive person ≠ disable login.
  - Disable login ≠ archive person.

---

## PART 9 — Crew membership lifecycle — LOCKED (L9)

- `crew_members(crew_id, person_id, added_at, added_by, removed_at, removed_by)`, one active row per (crew, person). Past rows kept.
- A person may be on several crews; a Lead may lead several crews. Nothing implies presence.
- **Remove member:** closes the row; no history or access change.
- **Rename:** current views show the new name; assignments keep their snapshot.
- **Archive:** blocked while an active assignment exists (the editor lists those jobs); restore with review.
- **Usual Lead change:** future assignments only. Active assignments keep their Lead; the editor says how many.

---

## PART 10 — Job assignment model — LOCKED (L9, L12, L15, L19)

- **Unit:** `job_crew_assignments` row = job + crew + assignment Lead + snapshots. One active row per job; ended rows are immutable history.
- **Flow:** Assign crew → pick "Carlos Crew — Carlos" → the editor shows the Lead and the access consequence → **Save**. One choice plus confirmation.
- **Truth after save:**
  - Crew, Lead, schedule; "Not scheduled" when there is no date.
  - "Carlos doesn't use FieldDive yet" for a non-linked or pending Lead.
  - Never "received".
- **End reasons:**
  - `replaced` (new crew)
  - `lead_changed` (same crew, new Lead)
  - `cleared` (deliberately ended)
  - `job_closed` (Job reaches Complete, or disposition lost/closed)
- **Job close:** a trigger on `jobs` (after stage/disposition update) ends the active assignment in the same transaction, whatever path closed the job. Reopening does **not** restore it; the office reassigns.
- **Tasks:** never transferred on reassignment. Old actors are untouched.
- **Authority:** company-scope `jobs.assign`.
- **Idempotency:** `request_id` replay returns the original result; `expected_active_assignment_id` mismatch returns `stale_assignment`.
- **Failure:** assignment, reasons, grant change, and activity event form one transaction.
- **Coordinator (L19):**
  - `jobs.assigned_to` is shown as **Coordinator**, with handoff, counts, and coupling unchanged.
  - When the Coordinator equals the assignment Lead, show one line.
- **Legacy `crew_label` read precedence:**
  1. active assignment (crew name);
  2. else, when the job has any ended assignment, show nothing current;
  3. else, a non-empty `crew_label` shows read-only as "Crew note: …".

  `crew_label` is never written by new code, never parsed into crews, and never used for access.

---

## PART 11 — Assignment Lead override — LOCKED (L12)

- `lead_person_id` is always explicit on the row, filled from the crew's usual Lead at save unless the user picks another person.
- `lead_overridden` is stored at save time.
- Summaries show "Lead: Tim (covering for Carlos)" only when overridden.
- Changing the Lead ends the row (`lead_changed`) and inserts a new one. Reasons move with it.
- The crew's usual Lead is never changed by an override.
- The Owner is eligible.

---

## PART 12 — Access provenance contract — LOCKED (L13–L18)

### 12A — Ledger

- **Table:** `job_access_grant_reasons`
  - `id, company_id, job_id, user_id`
  - `reason_kind`
  - `reason_ref uuid null`
  - `created_by, created_at, ended_by, ended_at, end_cause`
- **Reason kinds and families:**

  | Kind | Family | Ended by |
  |---|---|---|
  | `manual` | explicit | manual removal; reactivation |
  | `invitation` | explicit | manual removal; reactivation |
  | `migration` | explicit | manual removal; reactivation |
  | `task_assignment` | sticky | reactivation only (unassign never ends it; L16) |
  | `coordinator_assignment` (today's `production_lead_assignment` source) | sticky | reactivation only |
  | `crew_assignment_lead` (`reason_ref` = assignment id) | assignment | assignment end (any end reason); reactivation |

- **Core invariant:** a live `job_access_grants` row exists for (job, user) **iff** at least one live reason exists.
- **Evaluator:** unchanged. `evaluate_access_core_v1`, `member_job_ids_v1`, and RLS keep reading `job_access_grants`.
- **Higher-order denials, unchanged:**
  - Disabled membership wins (`membership_disabled`).
  - A job-scoped restriction wins over any grant.

### 12B — Writers (SECURITY DEFINER, same transaction, tenant-checked)

- **Crew assignment save:**
  - If the assignment Lead's person is linked to an **active** member whose role scope is `granted_jobs`, add a `crew_assignment_lead` reason and create the grant if none is live.
  - Company-scope Leads get no reason. Non-linked, pending, or disabled Leads get none, and the UI says so.
- **Assignment end** (any end reason): end that reason; revoke the grant only if no live reason remains, logging `job_access_revoked` with cause `crew_assignment_ended`.
- **Coupling trigger:** same grant conditions as today; also records its sticky reason, even when a grant already exists.
- **Manual grant:** adds `manual`.
- **Manual removal:** see 12C.
- **Invitation accept:**
  - adds `invitation` reasons for `job_ids`;
  - with a linked `person_id` (Slice 7), derives `crew_assignment_lead` reasons for **currently active** assignments that name that person as Lead. The invite form discloses "Mike leads 2 active jobs".
- **Role change to a `granted_jobs` role:** Team review shows currently led active assignments. The reasons are derived only if the reviewer confirms. Default on, because it reflects current truth; the reviewer can clear it.
- **Reactivation (L18):** ends **all** reasons and revokes all grants, as today. The reviewed option "Give access to jobs they currently lead" (default **OFF**) derives `crew_assignment_lead` reasons from active assignments only. Tasks are not restored.
- **Disable:** no change. Reasons and grants stay, inert.
- **Transfer:** no change.

### 12C — Manual removal and explicit deny (L14)

- **How it works now:** `revoke_job_access_v1` sets `revoked_at` on the single live grant whatever its source, even if the user still has tasks on the job. It logs `job_access_revoked` with reason `manual`.
- **Callers:** none in `app/`. Callers are tests (Phase 13B suites) and staging proof scripts only. 13B is not in production.
- **Locked contract:**
  - Manual removal ends reasons in the **explicit** family (`manual`, `invitation`, `migration`) for that job and user.
  - If sticky or assignment reasons remain, the grant stays. The RPC returns `{ ok: true, still_has_access: true, remaining: [kinds] }`, and the UI explains ("Still has access: leads this job's crew").
- **Explicit deny** ("never allow this person on this job even if another reason would"):
  - This is the **existing job-scoped restriction**: `set_member_access_v1` with `{ capability: 'jobs.read', scope: 'job', job_id }`.
  - It is already evaluated first, already filters RLS job lists through `member_job_ids_v1 → member_can_v1`, is audited, and Admin cannot lift an Owner restriction.
  - Deny is a separate act from removal and is **not** exposed in launch UI unless a later slice approves it.
  - Slice 4 must prove on staging that a job restriction hides the job from every granted-job read path.
- **Migration and backfill:**
  - For every live grant, insert one reason from `source` (`production_lead_assignment → coordinator_assignment`).
  - **Also** insert sticky reasons reconstructed from current truth: a `task_assignment` reason where the user is assignee of any non-deleted task on the job, and a `coordinator_assignment` reason where `jobs.assigned_to` = user.
  - Earlier task assignments that are no longer current cannot be reconstructed. Their grants keep whatever reason `source` gave them.
  - Staging now; production in the same rollout as 13B.
  - Tests and proof scripts that expect "revoke removes everything" must change to the new contract.

### 12D — Crew members with logins (L17)

- Only the assignment Lead derives access.
- Listed crew members derive nothing, with or without a login.
- Their access comes only from their own task, manual, or invitation reasons.

---

## PART 13 — History semantics — LOCKED

| Truth | Stored as | Survives |
|---|---|---|
| Listed roster | active `crew_members` rows | freely changes; past rows kept |
| Assigned crew | assignment row + `crew_name_snapshot` | rename, archive, roster change |
| Assignment Lead | `lead_person_id` + `lead_name_snapshot` + `lead_overridden` | usual-Lead change, rename, link, disable |
| Listed-at-assignment roster | `roster_snapshot` (ids + names) | later roster edits |
| Authenticated actor | existing `created_by`, `completed_by`, `actor_user_id` | everything |
| Onsite attendance | **not recorded** | — |

- **Copy:**
  - "Listed crew", "Crew at assignment", "Members not listed".
  - Never "worked on site" or a headcount.
- **Activity events:** `crew_assigned`, `crew_changed`, `crew_cleared`, `assignment_lead_changed`, `crew_assignment_closed`, written by the assignment RPC or close trigger in the same transaction.
- The assignment table is the source of truth; events are the feed.

---

## PART 14 — Calendar integration — LOCKED (L20)

- **No schedule schema change and no second calendar.**
- The schedules read path adds the active assignment's crew and Lead names under the reader's RLS. Leads see only granted jobs.
- **States:**

  | State | Treatment |
  |---|---|
  | Scheduled + crew | normal |
  | Scheduled, no crew | quiet "No crew" |
  | Crew, not scheduled | in the existing ready-to-schedule picker with its crew |
  | Assignment read failed | dates shown; "Crew unavailable" + Retry (never "No crew") |
  | Known overlap | "Schedule overlap" note (below) |

- **Schedule overlap:**
  - Shown when the same crew has another active assignment whose schedule range intersects.
  - Nonblocking and contextual, in the assignment and schedule editors and on the event detail.
  - Wording: "Schedule overlap: Carlos Crew is also on Jones Roof Oct 6–7."
  - No capacity arithmetic, no "double booked".
- **Filter:**
  - A Crew filter (All / each active crew / No crew) for members with company schedule read.
  - No Lead filter at launch; for launch it duplicates the crew filter.
  - Hidden for Leads.
- **Leads:** schedule mutation stays with `schedule.manage` holders; the Lead package no longer carries it.

---

## PART 15 — Job Card integration — LOCKED

- **Crew & Lead editor** (focused editor) replaces the crew-label input in `JobCardProductionLeadControl`, in the same place, and also holds the Coordinator select.
- **Overview summary rows** (no new card):
  - Crew
  - Lead (override shown only when different)
  - Schedule (read from the schedule; **Change** opens the existing Calendar tab)
- **No Production tab.**
- **Earlier crews:** list inside the editor. Activity shows the new events.
- **Lead Job Card:** Field brief with crew context (5B). Start work visible; Complete job hidden (5A). Commercial tabs hidden as today.
- **Board (L21):** "Carlos Crew" in the Scheduled and Production lanes only.

---

## PART 16 — Team / Crews UI and visual standard — LOCKED (L22, L23)

- **Team** (software access):
  - relabels; Lead preset; Other access;
  - remove panel adds "Leads N active crew jobs";
  - reactivation review (L18);
  - role-change review (12B);
  - invite from person (Slice 7).
- **Crews** (labor grouping):
  - A Company Settings row under Team ("3 crews" / "No crews yet" / "Could not load crews") opens a focused editor.
  - Rows: crew name (primary); usual Lead, listed members, next scheduled work (secondary).
  - One primary action: Create crew.
  - Crew detail: name, usual Lead, optional members with inline "Add name", and a quiet Archive.
  - Deep link `crews`. No new route or top-level nav.
  - Visible to company-scope members; editable by crew managers; hidden from Field and Lead.
- **Contextual create:** from the assignment editor → compact create → return with the new crew selected → the user still presses Save.
- **References:**
  - AccuLynx: architecture only.
  - BuildBook: flat people rows.
  - Linear: plain-language access explanations.
  - Roofr: restrained calendar hierarchy.
  - CompanyCam: job-first mobile contribution.
  - Jobber: selected contextual scheduling interactions.
  - ServiceTitan: complexity contrast, not copied.
- **FieldDive rules:**
  - Structure and hierarchy:
    - fewer boxes and nested borders
    - spacing creates structure; typography creates hierarchy
  - Actions:
    - one dominant action; quiet secondary actions
  - Color and state:
    - contextual color only
    - normal state changes integrated into rows; banners only for exceptional, blocking, risk, or failure
  - Layout:
    - mobile composed for 390, keyboard-safe full-height editors
    - no permission matrix, metric cards, org chart, or workforce dashboard

---

## PART 17 — 13C / 13D boundary — LOCKED (L25)

| 13C owns | 13D owns |
|---|---|
| Planned activation track (first real proposal sent) | Returning Lead landing destination |
| Crew, person, roster model; person → user linking | Invited-user landing after accept |
| Role presentation contract | Role-aware post-auth orientation |
| Crew assignment, assignment Lead, access provenance | Lead mobile home / current-next work orientation |
| Team and Crews surfaces; Job Card integration; Calendar crew context | Replacing `LOGIN_DEFAULT_DESTINATION` and join `continueHref` |
| Field brief integration needed to use an assigned job | |

In 13C, Leads keep today's Jobs Board landing (granted jobs only) and existing empty states.

---

## PART 18 — Final schema delta

Every new table carries `company_id`:
- composite FKs `(x_id, company_id)`;
- tenant-immutability triggers (the `job_access_grants` pattern);
- RLS on `private.current_active_company_id()` + capabilities;
- writes only through SECURITY DEFINER RPCs with explicit checks; no client writes.

### S1 — `company_people` (Slice 2)
- **Why:** no non-login worker exists; assignee fields hold user ids only.
- **Writer:** person RPCs (crew managers), member auto-link upsert, invitation accept (Slice 7).
- **Reader:** crew managers (full); the Lead via 5B (names).
- **Invariants:** name 1–80; `linked_user_id` unique per company and a member of the same company; archived not selectable.
- **Retry:** `request_id`; link idempotent on (person, user).
- **Failure:** typed codes, nothing partial.
- **History:** archive only once referenced.
- **Tenant isolation:** company-scoped; link requires same-company membership.

### S2 — `crews` (Slice 3)
- **Why:** `crew_label` is unowned text.
- **Writer:** create/edit/archive/restore RPCs.
- **Reader:** company `jobs.read` holders; the Lead via snapshots.
- **Invariants:** unique active name (case-insensitive); usual Lead active and same company; no archive with an active assignment.
- **Retry:** `request_id` create; `row_version` edit.
- **History:** archive only.

### S3 — `crew_members` (Slice 3)
- **Why:** effective-dated roster.
- **Writer:** roster-diff RPC in one transaction.
- **Invariant:** one active row per (crew, person); same company.
- **History:** closed rows kept.

### S4 — `job_crew_assignments` (Slice 4)
- **Why:** no assignment entity or history.
- **Writer:** `set_job_crew_assignment_v1(job, crew|null, lead_person|null, expected_active_assignment_id, request_id)`; close trigger on `jobs`.
- **Reader:** job readers under RLS; schedules read; Field brief.
- **Invariants:**
  - one active row per job (unique partial index `ended_at is null`);
  - active crew and active same-company Lead;
  - snapshots immutable;
  - `end_reason ∈ (replaced, lead_changed, cleared, job_closed)`.
- **Retry and failure:** replay and stale handling; one transaction with S5 and events.
- **History:** never deleted.

### S5 — `job_access_grant_reasons` (Slice 4, before any crew-derived grant)
- **Why:** single-source grants cannot remove only assignment-justified access.
- **Writer:** assignment RPC, close trigger, coupling trigger, manual grant/removal, invitation accept, role-change review, reactivation.
- **Reader:** RPCs and admin projection; **not** the evaluator.
- **Invariants:** grant ⇔ ≥ 1 live reason; sticky kinds end only on reactivation; one live reason per (job, user, kind, ref).
- **Retry:** upsert on the live key.
- **Failure:** rolls back with the parent.
- **History:** ended reasons kept, plus `company_access_events`.
- **Backfill:** per 12C.

### S6 — Registry, constraint, and column changes
- **Registry** (Slice 1): new `jobs.complete`; `lead_assigned_work` drops `schedule.manage` and `production_lead` assigner; profiles and packages per 5A; `complete_job_work_v1` redefined.
- **Directory** (Slice 1): `list_company_directory_v1` drops the job-scoped `tasks.manage` clause.
- **Events** (Slice 4): `job_activity_events.event_type` += `crew_assigned, crew_changed, crew_cleared, assignment_lead_changed, crew_assignment_closed`; access-event causes += `crew_assignment_ended`.
- **Invitations** (Slice 7): `company_invitations.person_id uuid null` (composite FK to people).
- **Field brief** (Slice 4): `get_job_field_brief_v1` people projection per 5B; `crew_label` read precedence per Part 10.

**Unchanged:** the evaluator, `job_access_grants` columns, `job_schedules`, role keys and constraints, `jobs.crew_label` column (kept, no new writes).

---

## PART 19 — Required app changes (by slice)

- **Slice 1:**
  - labels and descriptions; Lead preset; Other access;
  - capability-aware lifecycle eligibility (Start vs Complete);
  - directory narrowing.
- **Slice 2–3:** Crews focused editor in Company Settings, inline people, deep link.
- **Slice 4:**
  - server-side assignee validation;
  - assignment API;
  - Field brief people projection;
  - Coordinator relabel;
  - stop writing `crew_label`.
- **Slice 5:**
  - Job Card Crew & Lead editor, Overview summary, earlier crews;
  - contextual Create crew;
  - Board crew line (Scheduled/Production).
- **Slice 6:** Calendar crew text, states, filter, schedule overlap.
- **Slice 7:** invite/link from person, match review, acceptance-derived reasons, reactivation and role-change reviews, remove-panel counts.
- **Slice 8:** closure proof and docs.

---

## PART 20 — Required test coverage

- **Registry parity:** `jobs.complete`, corrected `lead_assigned_work`, crosswalk.
- **Lifecycle:** Lead can start and cannot complete (route + RPC); all prior holders can still complete.
- **Evaluator regression:** unchanged results across the 13B A–H suites.
- **Provenance matrix (staging, real sessions):**
  - Assignment changes:
    - crew replace; Lead change
    - job close ends the assignment and revokes only when no other reason remains
    - Lead with a task reason survives the crew end
    - manual grant survives the crew end
    - manual removal leaves assignment and task access (`still_has_access`)
  - Explicit deny: a job restriction hides the job on every read path.
  - Lead login state:
    - non-linked, pending, disabled
    - company-scope Lead (no row)
  - Membership lifecycle:
    - reactivation ends everything; the reviewed option restores only current assignments
    - role-change review
  - Concurrency and isolation:
    - concurrent save returns `stale_assignment`; replayed `request_id` returns the original result
    - cross-tenant ids rejected
  - A roster-only member with a login gains nothing.
  - Backfill: reconstructs sticky reasons; invariant holds for every live grant.
- **Directory:**
  - Lead sees self only in the directory and only relevant people in the job projection.
  - Task assignment still validates server-side.
- **History:**
  - rename, archive, member removal, usual-Lead change, person link
  - snapshots and actors unchanged; events written in the same transaction
- **UI model tests:**
  - summary states; override line
  - "Members not listed"; Calendar five states and filter
  - create-in-context returns without saving
  - `crew_label` precedence

---

## PART 21 — Migration / rollout implications

- 13C migrations append after 13B (`…220000`). 13B is not in production, so registry corrections, the capability split, and directory narrowing ship **with** 13B's production rollout at no data cost.
- **Production order** (each step explicitly authorized):
  1. 13A gate
  2. 13B migrations + TOTP
  3. 13C migrations + reason backfill
  4. deploy an exact SHA
  5. security and visual proof
- **Existing production data:**
  - `crew_label` stays readable per the precedence rule;
  - `assigned_to` becomes Coordinator;
  - roles keep their authority under new labels.
- **Safety valve:** a server flag can hold crew-derived reasons (automatic assignment access) off while crews ship. The evaluator is untouched, so crew data alone cannot widen access.
- The staging CLI link stays staging; the target guard runs before every mutation.

---

## PART 22 — Remaining decisions and blockers

**True blockers:** none for starting Slice 1. Slice 4 has one hard gate: the staging proof that a job-scoped restriction hides the job on every read path (12C). If it fails, explicit deny is **BLOCKED BY REPO TRUTH** and needs its own fix before Slice 4 ships.

| ID | Open item | Recommendation | Needed by |
|---|---|---|---|
| D-S1 | Start work scope: any Lead with job access, or only the assignment Lead | **LOCKED 2026-09-29: only the active assignment Lead.** Job-scoped Start work stays unavailable until Slice 4 supplies assignment truth. | Closed |
| F1 | Office Manager holds `company.manage` (branding and identity) | Keep; revisit only with contractor evidence | Informational |
| F2 | Office Manager holds `team.manage` | Keep; bounded by delegation ceiling | Informational |
| G10 | Contractor vocabulary test (Office Manager, Lead, Crew, Coordinator) | Run before Slice 5 visual commitment | Slice 5 |

---

## PART 23 — Implementation sequence

Every slice follows the same rules:
- **Tests and checks:** source `tsc` and the affected + full suite (baseline 25 unrelated failures).
- **Staging:** the target guard before any staging mutation; staging-only apply.
- **Git:** no push or deploy; one commit per slice with explicit paths; `tmp/` and `.next` never staged.
- **Proof:** security proof accompanies visual proof wherever authority changes.

### Slice 1 — Access vocabulary, Lead preset, Start/Complete split, directory narrowing
- **Objective:** make the locked role model true in authority and presentation before any crew data exists.
- **Files and areas:**
  - `app/lib/access/registry.ts`, `app/lib/companyMembershipRoles.ts`, `app/lib/access/teamAccessPresentation.ts`, `app/lib/access/viewerAccess.ts`
  - `app/lib/jobLifecycleActionEligibility.ts` and its callers (`JobCardClient.tsx`, `JobCardScheduleSection.tsx`, `SavedClient.tsx`, `JobsBoardCard.tsx`, `JobsBoardListView.tsx`)
  - `app/api/jobs/complete-work/route.ts`
  - `CompanySettingsTeamEditor.tsx` (labels, Lead preset, Other access)
  - registry/Team tests; blueprint §2.12 + handoff docs step
- **DB:**
  - seed migration: `jobs.complete`, profile/package rows, `lead_assigned_work` corrections;
  - redefine `start_job_work_v1` (D-S1: `jobs.progress`@job **and** company-scope `jobs.progress`);
  - redefine `complete_job_work_v1`;
  - redefine `list_company_directory_v1`.
- **Directory narrowing note:** a Lead's task-assignee picker and assignee validation fall back to the job's field-brief people (coordinator and current task assignees). The fuller server-side validation lands in Slice 4.
- **Authority invariant:**
  - Complete needs `jobs.complete`; Start needs `jobs.progress`@job plus company scope (the assignment-Lead branch arrives in Slice 4).
  - The Lead package has no schedule mutation and no completion.
  - Every prior completer keeps completion.
- **Lifecycle invariant:** no path reaches Complete without `jobs.complete`.
- **Historical invariant:** no existing member's authority narrows except the Lead package (staging-only data).
- **Tenant invariant:** unchanged RLS; the directory never widens.
- **Tests:**
  - registry parity; RPC/route matrix for start/complete by role;
  - directory by role; eligibility flags;
  - Team labels; A–H regressions.
- **Visual proof:** Team invite (Office Manager, Lead, Other access) desktop + 390; Lead Job Card shows neither Start work (D-S1, until Slice 4) nor Complete.
- **STOP if:**
  - another writer reaches Complete;
  - any existing role would lose completion;
  - directory narrowing breaks a non-Lead read;
  - Lead Start work could only be enabled through a stand-in for assignment truth (D-S1: it stays unavailable until Slice 4).
- **Commit:** `feat(access): lock Phase 13C role presets and split job completion`.

### Slice 2 — Company people (identity before roster)
- **Objective:** durable non-login people and member auto-link, with no UI mutation of crews yet.
- **Files and areas:** migration S1; `app/lib/people/*` (types, persistence, validation); `/api/people` (list/create/edit/archive); tests.
- **DB:** S1 + RLS + RPCs + member upsert.
- **Authority invariant:** only company `jobs.assign` holders write; phone visible only to them.
- **Lifecycle invariant:** archive never erases; archive ≠ disable.
- **Historical invariant:** person id is stable across rename.
- **Tenant invariant:** cross-company link impossible (composite FK + membership check).
- **Tests:** RPC matrix by role; duplicate-link rejection; idempotent upsert; cross-tenant; archive.
- **Visual proof:** none (no UI).
- **STOP if:** a link can be created without explicit action, or a Field/Lead can read phone numbers.
- **Commit:** `feat(crews): add company people records`.

### Slice 3 — Crews and roster, with Crews surface
- **Objective:** reusable crews with usual Lead and effective-dated roster; Crews editor in Company Settings.
- **Files and areas:**
  - migrations S2, S3; `app/lib/crews/*`; `/api/crews`
  - `CompanySettingsClient.tsx` (Crews row, deep link), new `CompanySettingsCrewsEditor.tsx`
  - `app/tools/settings/page.tsx` deep-link editors; tests
- **DB:** S2, S3, RLS, RPCs.
- **Authority invariant:** crew managers only; crews grant nothing.
- **Lifecycle invariant:**
  - archive blocked with an active assignment (no assignments exist yet, so enforced as a check);
  - usual-Lead change affects future assignments only.
- **Historical invariant:** closed roster rows kept; rename does not touch history.
- **Tenant invariant:** composite FKs to people.
- **Tests:** roster diff idempotency; unique active name; missing Lead state; archive/restore; role matrix; UI model.
- **Visual proof:** Crews empty, one/two crews, long and duplicate names, missing Lead, archive, edit failure; desktop + 390.
- **STOP if:** Crews UI needs assignment data to be meaningful, or any crew row affects access.
- **Commit:** `feat(crews): add reusable crews and Crews settings`.

### Slice 4 — Assignment truth + reason ledger + backfill (no assignment UI yet)
- **Objective:** durable assignment history and provenance before any UI can mutate assignments or derive access.
- **Files and areas:**
  - migrations S4, S5, S6-events, S6-field-brief
  - coupling trigger update; `change_job_access_v1` redefined per 12C
  - close trigger on `jobs`; `app/lib/crewAssignment/*`
  - `/api/jobs/[jobId]/crew-assignment`
  - server-side task-assignee validation (`companyMemberValidation.ts`, `jobTaskPersistence.ts`)
  - D-S1: add the active-assignment-Lead branch to `start_job_work_v1` (reads `job_crew_assignments`; no evaluator change); enable `canStartWork` for that Lead at the job
  - `jobFieldBrief.ts` parser; stop writing `crew_label` in `production-lead/route.ts`
  - Coordinator relabel (`jobCardOverviewComposition.ts`, board presentation); tests
- **DB:** S4, S5 with backfill, event constraints, field brief projection.
- **Authority invariant:**
  - grant ⇔ ≥ 1 live reason;
  - only the assignment Lead derives access;
  - manual removal ends explicit reasons only;
  - disable and restriction win.
- **Lifecycle invariant:** every end reason (including job close) ends the crew reason and revokes only without another reason; the assignment flag can be held off.
- **Historical invariant:** snapshots immutable; ended rows immutable; events in the same transaction.
- **Tenant invariant:** composite FKs; the RPC checks the job, crew, and person company.
- **Tests:** the full provenance matrix (Part 20), backfill invariant, restriction-hides-job proof, directory/projection, `crew_label` precedence.
- **Visual proof:** none beyond the Coordinator label spot-check (no assignment UI yet).
- **STOP if:**
  - the backfill violates the invariant for any live grant;
  - the restriction proof fails;
  - any evaluator change appears necessary;
  - task unassign behavior changes.
- **Commit:** `feat(crews): add job crew assignments and access reason ledger`.

### Slice 5 — Job Card assignment surface
- **Objective:** assign, reassign, override, and clear crews from the Job Card on top of Slice 4 truth.
- **Files and areas:**
  - `JobCardProductionLeadControl.tsx` → Crew & Lead editor; `JobCardClient.tsx` Overview summary
  - earlier-crews list; contextual Create crew (reuses the Slice 3 form)
  - Board crew line (`JobsBoardCard.tsx`, `jobsBoardCardPresentation.ts`, Scheduled/Production only)
  - Field brief crew context in `JobCardFieldBrief.tsx`; tests
- **DB:** none.
- **Authority invariant:** UI offers mutation only to `jobs.assign` holders; the server remains the authority.
- **Lifecycle invariant:** create-in-context never saves the assignment; truthful post-save states.
- **Historical invariant:** earlier crews read from ended rows.
- **Tenant invariant:** no new reads outside the job.
- **Tests:** UI models (summary, override line, not scheduled, no login, stale handling), editor dirty/cancel.
- **Visual proof:**
  - select existing crew; create-in-context return
  - unscheduled; override; reassignment; access consequence and failure
  - Lead view of the same job
  - desktop + 390
- **STOP if:** G10 vocabulary testing contradicts labels, or any surface implies attendance or delivery.
- **Commit:** `feat(crews): assign crews and Leads on the Job Card`.

### Slice 6 — Calendar crew context
- **Objective:** crew context, states, filter, and schedule-overlap note on the existing Calendar.
- **Files and areas:** `app/api/jobs/schedules/route.ts` read path, `FieldDiveCalendarClient.tsx`, `ScheduleJobModal` / `JobScheduleWorkspace` overlap note; tests.
- **DB:** none (read join under RLS).
- **Authority invariant:** Leads read only granted jobs; no schedule mutation for Leads.
- **Lifecycle invariant:** Calendar remains the only schedule writer path.
- **Historical invariant:** read-only.
- **Tenant invariant:** RLS-bound reads.
- **Tests:** five states, filter, overlap detection (intersecting ranges, all-day, multiday), read failure never "No crew".
- **Visual proof:** assigned, unassigned, unscheduled, overlap, filter empty, read failure; desktop + 390 non-drag edit.
- **STOP if:** overlap needs capacity data, or the filter needs a Lead dimension to be useful.
- **Commit:** `feat(calendar): show crew context and schedule overlap`.

### Slice 7 — Person → user linking and lifecycle reviews (required for 13C closure)
- **Objective:** link existing people to authenticated members without duplicates; complete lifecycle reviews.
- **Files and areas:**
  - `company_invitations.person_id` migration
  - `accept_company_invitation_core_v1` link + acceptance-derived reasons
  - issue invitation from person; match-review model and UI in Team/Crews
  - reactivation review (default OFF); role-change review; remove-panel "Leads N active crew jobs"
  - `invitationActions.server.ts`, `CompanySettingsTeamEditor.tsx`; tests
- **DB:** S6-invitations; accept core redefined.
- **Authority invariant:** linking only through accept or explicit link by `team.manage` within the ceiling; never by name alone.
- **Lifecycle invariant:** reactivation restores nothing unless reviewed; restores recompute from current assignments only.
- **Historical invariant:** the person's past references remain; authenticated actions start at link.
- **Tenant invariant:** link requires same-company membership; person id company-checked.
- **Tests:**
  - duplicate prevention; match review; accept idempotency
  - pending-invite Lead gains access on accept only for current assignments
  - reactivation OFF/ON matrix; role-change review
- **Visual proof:** invite from person, match review, accept, reactivation review; desktop + 390.
- **STOP if:** any path merges by name, or acceptance restores historic access.
- **Commit:** `feat(crews): link people to FieldDive access`.

### Slice 8 — 13C crew closure proof
- **Objective:** end-to-end staging proof of the full crew model and contract closure.
- **Files and areas:** docs (blueprint §2.12 closure, global handoff), proof scripts under `tmp/`, screenshots under `tmp/fielddive-ui-review/phase13c-crews/`.
- **DB:** fixtures only (staging), cleaned up after.
- **Invariants:** re-prove all provenance, history, tenant, and lifecycle invariants with real sessions.
- **Tests:** full suite + source `tsc`; the Part 20 matrix end to end.
- **Visual proof:** Part 20 surfaces at desktop and true 390.
- **STOP if:** any invariant fails, or activation acceptance is not independently met (13C closure needs both tracks).
- **Commit:** `docs(crews): close Phase 13C crew program`.

**Sequencing guarantees:**
- The reason ledger (Slice 4) precedes automatic access and assignment UI (Slice 5).
- People (Slice 2) precede the roster (Slice 3).
- Assignment history (Slice 4) precedes assignment mutation UI (Slice 5).
- Start/Complete is resolved first (Slice 1).
- `crew_label` stops being written in Slice 4 and is never authoritative.
- Linking (Slice 7) completes before closure (Slice 8).
- Every visual slice follows its truth slice.
- The activation track proceeds independently and is never blocked by crew work.

---

## Final standard — answers

| Question | Answer |
|---|---|
| Owner / Office Manager / Lead / Crews without learning permissions? | **Yes.** Presets with one-sentence explanations; specialists under Other access. |
| Lead runs onsite work without office clutter? | **Yes.** Granted jobs, scoped people, Start work only, commercial tabs hidden. |
| Physical workers without fake accounts? | **Yes, from Slice 2.** |
| Same Crew reused safely? | **Yes.** Durable crew, effective-dated roster, snapshots. |
| Assignment change without rewriting history? | **Yes.** Sequential rows, immutable snapshots, untouched actors. |
| Job access follows responsibility without overgranting? | **Yes, with S5** (Slice 4), gated on the restriction proof. |
| Owner runs everything naturally? | **Yes.** |
| Sales/Field specialist access later? | **Yes.** Preserved; Field underpins Lead. |
| UI premium and calm? | **Yes, under Part 16.** |
| Paid product in front of real contractors? | **Yes, conditionally** on D-S1 and G10 vocabulary testing. |
