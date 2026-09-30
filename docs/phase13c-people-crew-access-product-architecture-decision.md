# Phase 13C — People, Crew and access product/architecture decision

**Date:** 2026-09-30  
**Status:** Controlling Phase 13C product decision. Documentation only; implementation has not been authorized by this task.

## 1. Purpose / authority

This document converts the accepted [people/access/Crew research](phase13c-people-access-crew-operating-model-astra-research.md) and the latest explicit product decisions into the controlling interpretation for Job → Crew work. It supersedes only the conflicting assumptions identified in §13. Earlier documents remain intact as historical records; their unaffected security and lifecycle requirements remain binding.

The [execution standards](fielddive-product-execution-standards.md), [UI cohesion standard](fielddive-ui-product-cohesion-standard.md), and [audit playbook](fielddive-audit-playbook.md) continue to govern method, proof and protected systems. This decision does not reopen competitor research or authorize fixes, SQL, migrations, environment changes or release work.

Reconciled authorities:

- [Global handoff](fielddive-global-handoff.md): its September 28 checkpoint says 13C research next. For this people/Crew workstream, the present decision completes that synthesis and defines the next recommended boundary; it does not change the wider program or environment status.
- [Implementation blueprint](phase13-company-access-user-onboarding-implementation-blueprint.md), especially implementation checkpoints §§2.9–2.11, and [architecture v2](phase13-company-access-user-onboarding-astra-architecture-v2.md): secure access infrastructure remains; occupational role presentation is narrowed below.
- [Crew contract/reconciliation](phase13c-crew-product-contract-repo-reconciliation.md): mandatory assignment leadership, permanent assignment exclusivity, and the bundled Slice 4 sequence are explicitly superseded below.
- [Team handoff](phase13c-team-astra-implementation-handoff.md): retain the accepted visual baseline, but narrow person-first Crew identity and access-derived occupational descriptions.

**Current implementation is not this decision.** Inspected local source already contains independent people, named Crews, dated roster membership and nullable usual Lead. The older Team handoff predates that foundation. Stored roles remain `owner`, `admin`, `office_sales`, `production_lead`, `field_user`; Team still includes access-derived work labels and “Needs a Lead.” Weekly work uses `jobs.assigned_to`. Durable Job–Crew assignment is the next foundation, not a delivered feature. These are local-source observations, not staging/production verification. See [Team model](../app/lib/team/teamBoardModel.ts), [Team UI](../app/tools/team/TeamBoardClient.tsx), [weekly work](../app/lib/team/teamWeek.ts), and [access registry](../app/lib/access/registry.ts).

## 2. Core principles

**ACCESS FOLLOWS REAL WORK, NOT LABELS.** Access to an authorized workflow includes information intrinsic to performing it. Separate information or authority only where someone can legitimately do the work without it.

**PERSON ≠ SOFTWARE USER. TITLE ≠ AUTHORITY. CREW ≠ SECURITY GROUP. ASSIGNMENT ≠ SCHEDULE ≠ ACCESS.**

Use durable, stable, production-grade architecture with no unnecessary complexity. Power lives under the hood; clarity lives in the interface. Preserve tenant boundaries, domain eligibility and truthful states. Crew/team setup remains optional and must never block the first real proposal being sent. The model must work without titles, leadership or office hierarchy.

## 3. Person / title / access separation

| Concept | Meaning | Independent of |
|---|---|---|
| Person | Stable company-scoped human identity, including a worker who never logs in | Account, title, Crew, authority |
| Title | Optional company-entered description: Foreman, Partner, Production Manager, or blank | All permission and operational relationships |
| Software membership | Verified authenticated participation in a company | Whether that person belongs to a Crew |
| Access | Supported actions on authorized resources, starting from a default | Occupational title |
| Crew relationship | Membership or usual leadership of a reusable group | Login and job responsibility |
| Job responsibility | A real responsibility for a job or assignment | Company title and usual Crew role |

Changing a title must change **none** of access, navigation, authorization, Crew membership/leadership, job responsibility, pricing authority or payment authority. No prescribed title taxonomy. Optional descriptive title UI may come later.

A future invitation of an existing person must verify and link that same identity transactionally with an audit trail, handle collisions explicitly, preserve history and avoid duplicates. Never match on name alone. The current linking constraint does not yet provide that complete flow. Preserve the prior requirement to complete safe person→login linking before full Crew-program closure; it is not part of this next assignment slice.

## 4. Contractor/user access model

| Contractor/user concept | Direction |
|---|---|
| **Owner** | Protected company custody, separate transfer/recovery; not an ordinary invitation choice. Full supported company authority remains subject to security, tenancy and domain rules; no wildcard grant of unknown/reserved powers. |
| **Working Access** | Work on shared/authorized jobs; no broad company administration by default. |
| **Full Team Access** | Broad normal operations: jobs, customers, normal proposal workflow, scheduling, Team/Crews, production and ordinary operational administration. Proposal create/edit/send authority inherently includes customer-facing selling prices; Full Team users must not separately enable “proposal pricing.” Full Team Access does not automatically include internal costs/margins/profitability, customer payment history, requesting payments, refunds/credits, pricing/catalog administration, banking/payout configuration, FieldDive SaaS subscription billing, or Owner custody/security authority. These remain separate where supported and appropriate. |

The two non-owner choices are **user-facing defaults**, not the complete policy. Preserve bounded additions, such as company production work or authorized proposal work, without inventing job-title roles. Delegating staffing administration remains bounded by existing ceilings. Exact labels and mappings to stored profiles are deferred; do not rename role keys or migrate existing members now.

Minimal contractor/user access experience:

- **Add person:** Name required; Phone optional. Title, Crew membership and Give FieldDive access can follow later.
- **Create Crew:** Crew name required. People, usual Lead and contact/business relationship can follow later. No email, login, access level, title, Lead or Coordinator required.
- **Give FieldDive access:** verified invitation identity plus Working Access or Full Team Access. Owner is excluded from this chooser.
- **Additional access:** only when authorized and needed, use work language: Proposals; Internal costs & profitability; View payments; Request payments. “Proposals” here is for cases such as a Working Access user needing bounded proposal authority; it is not a separate enablement step for Full Team users. Do not expose raw capability identifiers or require configuration during Crew creation. Do not ask Full Team users to separately enable proposal prices already intrinsic to their work.

These are the accepted direction, not a claim that the current chooser or every proposed combination is implemented.

## 5. Commercial + money access rule

Four conceptual areas control the design; this is not a permission matrix.

| Area | Decision |
|---|---|
| **Normal work** | Create/edit/send proposal authority includes customer selling prices, totals, options/upgrades and customer-facing scope/pricing. **Do not add a separate “view proposal price” permission.** Existing action distinctions remain where meaningful. |
| **Internal business numbers** | Material/labor costs, margin, profitability and internal reporting are separate from customer prices. Candidate additional authority: **View internal costs & profitability**, with scope explicit. Viewing numbers does not authorize changing pricing/catalog configuration. |
| **Customer money** | **View payments** covers permitted customer balance/payment/history information. **Request payments** means initiate/send the supported customer payment request workflow. **Refund / credit** is separate and higher consequence; never inherited from viewing or requesting. These are distinct consequences where supported. Do not conflate requesting payment with manually recording payment, charging a customer, receiving funds or issuing refunds; “collect” must not be used as a catch-all for these actions. Do not invent a visible “record payment” permission unless a real supported FieldDive workflow requires it. |
| **Company control** | Pricing/catalog administration; banking/payout/payment-provider configuration; FieldDive subscription billing; ownership/security are exceptional administrative authorities. They are not ordinary proposal/payment access and are not one interchangeable privilege. |

**Current limitation:** the [registry](../app/lib/access/registry.ts) and blueprint implementation checkpoint document that proposal authoring reads catalog costs and writes internal cost summaries. Cost visibility is not currently separable through a label or toggle. A truthful cost-hidden proposal experience requires enforcement across relevant reads, authoring, generated documents and other exposed data paths first. Do not promise Lisa hidden margin until that work is proved. This prerequisite does **not** block Job–Crew foundation and is outside its scope.

Preserve existing supported payment/commercial action boundaries. Do not enable reserved capabilities, expose a new matrix, redesign pricing or imply requesting payments includes payout configuration.

## 6. Crew model

**A Crew is just a Crew:** a reusable company-defined operational group/resource with its own stable identity. Company naming is authoritative: Harris Crew, Tim & Jake, ABC Roofing or Repairs are all natural names, subject to ordinary validation.

A Crew with **only a name** is valid: no Lead, Coordinator, software user or complete roster required. An unknown roster means members are not listed, not that nobody works there. A business name may name a Crew; it must not become a fabricated human Person.

Crew membership is many-to-many where useful and effective-dated. A person may belong to multiple Crews and may lead multiple Crews. Neither fact asserts simultaneous attendance or capacity. Usual Crew Lead is an optional Person relationship, not a title, access level or parent identity. Changing it affects future defaults, never past assignments or existing assignment responsibility silently.

The Team baseline remains useful. Future approved refinement must treat absent title, Lead or Coordinator as valid, not incomplete. An entered title is secondary descriptive text. Crew must remain addressable independently of its usual Lead; a person-first presentation can remain one useful view. No Team redesign is authorized here.

## 7. Job → Crew assignment model

**Decision: Job Crew assignment itself is sufficient for Phase 13C. No explicit work-package/work-order system is required immediately.**

Each assignment has its own durable identity and conceptually records company, job, Crew, effective start/end or equivalent lifecycle, optional Assignment Lead, historical facts and actor/audit provenance. Job→assignments is one-to-many. A Crew can serve many jobs; the same Crew may return to the same job in a later assignment.

The row represents a Crew undertaking work, not “the Job's current Crew roster.” Preserve ended records. Replacement or changed assignment responsibility must preserve the earlier period, using a successor assignment or equally explicit immutable version history; never overwrite past attribution. Retain existing lifecycle intent: job closure ends its active assignments atomically; reopening does not silently restore them. Task assignments do not transfer merely because the Crew changes.

**Do not encode a permanent one-active-assignment-per-job invariant.** Assignment identity must support several historical rows and later concurrent assignments. A future work-package reference or grouping can be added to existing assignment identities without replacing them. Do not add a heavy package engine, trade taxonomy or speculative scheduling framework now.

First-UI baseline is **A: one primary active Crew at a time**, with replacement/history. This is a bounded interface/API operating mode, not a general uniqueness law on all active assignments. Scope any exclusivity enforcement to that primary mode; do not make readers depend on there being only one assignment forever. See §14 for the concurrency limit.

## 8. Lead / Coordinator decisions

| Relationship | Authoritative meaning |
|---|---|
| Usual Crew Lead | Optional Crew default; may be suggested for a new assignment, but never required. |
| Assignment Lead | Optional Person directing this assignment's work. Independent of company title, usual Lead, Coordinator and access. An explicit “no Lead” must remain possible even when the Crew has a usual Lead. |
| Coordinator | Optional job responsibility. Not required for job creation, Crew creation/assignment, scheduling or production. Never inferred from Owner, access default, Crew leadership or membership. |

An authorized company operator can schedule/start/manage leaderless work using the relevant existing authority and domain eligibility. Do not assign a fictional Lead to unlock ordinary work. **No relationship grants software authority by itself.**

Preserve current Start/Complete separation. Earlier D-S1 remains a possible narrow rule for *job-scoped* Start: a separately authorized, active logged-in assignment Lead may qualify only with the required capability and job access. It never requires every assignment to have a Lead or limits the existing company-scope branch. The next foundation does not activate new job-scoped Start powers.

`jobs.assigned_to` retains current Coordinator semantics and coupling; it is neither Crew assignment nor Assignment Lead. A later move toward Person-based coordination requires verified identity mapping, never guessed names. No such migration is included now.

## 9. History / roster truth

**CURRENT CREW ROSTER ≠ HISTORICAL JOB PARTICIPANTS.** Preserve assignment-time Crew identity/name, optional responsible person identity/name and the known roster when recorded, with its capture point. Label this **“Listed at assignment”** or **“Members not listed.”** IDs preserve relationships; snapshots preserve the facts displayed at the time.

Roster changes, renames, usual-Lead changes, access removal and person archiving must not rewrite those facts. A roster snapshot is a recorded plan, not proof of attendance, hours, payroll or actual installer presence. Keep people/history when access ends. Do not build attendance, HR, payroll or timekeeping.

## 10. Job access relationship

Crew membership and Crew assignment create **no unconditional software access**. Assignment must succeed for non-login people, outside labor and incomplete rosters.

**Next-slice default: assignments do not create, revoke or recompute job grants.** Preserve current access behavior. This narrows the old combined assignment/reason-ledger slice; independent operational truth can ship before automated sharing.

Before any later assignment-derived sharing is enabled, define the eligible recipient, authorized scope/data, grant reason and end condition; audit it and enforce it through the existing evaluator. Independent manual, task, Coordinator and other legitimate reasons must survive ending the assignment reason. A single-source grant row is insufficient for that revocation policy: reason provenance and safe conversion of existing grants are prerequisites. Restrictions and disabled membership always prevail. Do not implement automatic grants first and repair provenance later.

## 11. Calendar relationship

Calendar remains the sole schedule authority, including its canonical model and mutation paths. Assignment effective periods describe responsibility lifecycle; they are **not** a second planned-work schedule.

Current Team weekly work is Coordinator/person-derived and labeled accordingly; do not relabel it as Crew work. Future Crew weekly work joins **durable assignments + authorized schedule truth**, not `jobs.assigned_to`.

The primary-Crew release can use the existing job schedule. Later independently dated concurrent work packages may require extending the canonical schedule association; they must not create a parallel Crew calendar. Do not manufacture separate Crew availability from a Coordinator workload or an unknown roster.

## 12. Conceptual model

```text
COMPANY
  PERSON ── optional descriptive TITLE
    optional verified SOFTWARE MEMBERSHIP
      ACCESS DEFAULT + bounded additional authority/restrictions
      JOB ACCESS ── authorized JOBS, with independent grant reasons
  CREW
    CREW MEMBERSHIP ── PERSON (many-to-many, effective-dated)
    optional USUAL CREW LEAD ── PERSON
  JOB
    JOB CREW ASSIGNMENT ── CREW (many over time; concurrent-capable)
      optional ASSIGNMENT LEAD ── PERSON
      effective lifecycle + historical facts
    optional JOB RESPONSIBILITIES ── PERSON
    SCHEDULE ── canonical Calendar truth
      assignment/work association where supported
  OWNER CUSTODY ── protected current custodian
```

There is no unconditional Title→authority, Crew membership→access, Crew Lead→access, or Coordinator→Crew identity relationship. Sharing policy is a separate authorized connection between operational facts and membership access.

## 13. Superseded / narrowed prior assumptions

“Old” includes implications, not just explicit schema requirements. In particular, usual Lead was already nullable in storage; the old contract required leadership for assignment and presented absence as deficient. Likewise, the old sharing plan granted only an assignment Lead, **not** the entire roster.

| Old assumption / source | New authoritative decision | Why | Implementation consequence |
|---|---|---|---|
| **1. Mandatory usual Lead / “Needs a Lead”** — Crew contract Part 7; current Team wording | Usual Lead optional; name-only Crew complete | Small companies need no formal leader | Preserve null; later remove deficiency/blocking treatment from touched approved flows |
| **2. Mandatory Assignment Lead** — Parts 10–11, L12 | Assignment Lead nullable; explicit absence valid | Assigning a resource does not require hierarchy | No required-lead validation or automatic fallback overriding “none” |
| **3. Lead unlocks ordinary Crew/Job operation** — Part 7, overbroad reading of D-S1 | Company-authorized work works without Lead; scoped Start still requires separate authority | Responsibility is not capability | Preserve company-scope path and Start/Complete safeguards; no fictional Lead |
| **4. One active Crew per Job forever** — L9, Part 10, S4 partial uniqueness | Many historical assignments; concurrent-capable domain; one primary is initial UI mode | Replacement, gutters/roofing and phases are real distinct work | No universal active-job uniqueness; extensible assignment identities/read contracts |
| **5. Crew exists beneath a person/Lead anchor** — Team handoff “Decision and scope” and “Mandatory self-critique” | Crew has independent identity/addressability; person-first is a view | Leaderless Crews and one person leading several must work | Do not key Crew identity/navigation solely by Lead; preserve accepted Team baseline otherwise |
| **6. Access names are company titles** — architecture v2 role descriptions, blueprint/preset presentation, Team work labels | Titles are optional company text and grant nothing; Working/Full are default direction | Access follows work, not occupational labels | Stored profiles/evaluator remain; later presentation/migration separately reviewed |
| **7. Coordinator is Crew responsibility/identity** — possible conflation with legacy `assigned_to` | Optional job relationship only; current semantics retained | Office contact and field resource can differ or be absent | Never adapt `assigned_to` into Crew or Lead; no guessed Person mapping |
| **8. Assignment implies access** — Part 12 / Slice 4 assignment-Lead grant plan | Operational assignment independent; later explicit audited policy only | Non-login work and unrelated grant reasons must survive | No grant effects in next slice; provenance before later automatic sharing; whole-roster grants remain forbidden |
| **9. One blanket financial toggle** — preliminary hypothesis | Four areas in §5; prices intrinsic to proposals; refunds/control separate | Information and consequence differ | No proposal-price toggle or new permission matrix; cost-safe prerequisite explicit |
| **10. Assignment foundation must bundle ledger/backfill and scoped Start enablement** — old Slice 4 | Stage operational foundation first with automatic sharing off | Secure separation limits scope without losing future authority | Ledger conversion/sharing/Start enablement get a subsequent explicit boundary; never partially enable them |
| **11. Research may separate “view price” inside authorized proposal work** — research §8 | Selling prices intrinsic to proposal workflow | Redundant controls contradict real work | Retain meaningful create/edit/send distinctions, not price visibility as another prerequisite |
| **12. Team handoff has no delivered people/Crew foundation; global NEXT remains research** | Local source is newer; this decision controls the next people/Crew boundary | Historical checkpoint is not current implementation truth | Reuse existing foundation; do not rebuild it or repeat competitor research; no deployment inference |

These are explicit replacements, not permission to weaken the governing standards. All unaffected custody, tenancy, lifecycle and audit requirements remain in force.

## 14. First-release constraints vs durable architecture

**Architecture decided now:** assignment is the durable unit; Lead/Coordinator optional; job→assignment one-to-many; history survives change; concurrent assignments must remain possible; Calendar owns dates; access is independent.

**Smallest initial UI direction:** one primary active Crew, replace/clear with history, no work-package editor. This resolves the implementation planning baseline in favor of **A**. Shipping concurrent work packages in the first UI remains a later scope choice, not a prerequisite for this foundation. Do not claim the initial UI schedules roofing and gutters independently at the same time.

The foundation should support an additive future work-package association and canonical schedule extension. “Without replacement” means retaining assignment identities/history, not promising that no additive schema evolution will ever be needed. Exact columns, revision strategy and primary-mode enforcement are implementation design details constrained by these invariants.

## 15. Deferred decisions

Deferred UI/policy work: final Working/Full labels; role-key and existing-member migration; optional title UI timing; exact cost-safe proposal implementation; final pricing/payment privilege bundles; advanced reporting; branch/multi-location access; arbitrary custom roles; external subcontractor portal; advanced Crew availability/capacity; payroll/timekeeping; concurrent-work-package release timing. None may silently expand the next slice.

**No unresolved product decision blocks designing the assignment-only foundation.** Implementation must still establish the exact write/read contract, concurrency control, lifecycle integration and environment proof plan before mutation. If that reveals an inability to preserve history, tenant isolation or existing authority, stop on that concrete conflict. Person linking is a later full-program closure dependency; cost-safe authoring blocks the cost-hidden access promise, not Crew assignment. Provenance/restriction proof blocks automatic sharing, which is deliberately excluded here.

## 16. Acceptance scenarios

These are required future outcomes, **not tests executed by this decision task**.

| Case | Required outcome |
|---|---|
| 1. Tim + Jake, Harris Crew; no titles, Lead or Coordinator | PASS: Owner assigns and schedules the Crew using existing authority; no fabricated responsibility required. |
| 2. Mike, title Production Manager, Full Team Access | PASS: access comes from membership/policy; changing title changes no authority. Title/default UI delivery remains later. |
| 3. Carlos, usual Crew Lead, Working Access | PASS: Crew relationship alone adds no grants/actions; work still requires authorized job access. |
| 4. Bob, roster member with no login | PASS: full operational Person; no invitation/account prerequisite. |
| 5. Roofing Crew and Gutter Crew on one Job | PASS architecturally: distinct assignments can coexist in the durable model; first primary-only UI limitation is disclosed. Independent scheduling follows canonical Calendar extension. |
| 6. Lisa prepares/sends proposals | PASS architecturally: selling prices included; internal margin not automatically included. Current cost-reading implementation is an explicit unresolved prerequisite to the hidden-cost experience. |
| 7. Lisa sees payment status | PASS: this alone authorizes neither refund/credit nor payout-bank changes. |
| 8. Crew changes usual Lead next month | PASS: earlier assignment responsibility and recorded roster remain unchanged; active assignment Lead is not silently replaced. |

## 17. Implementation guardrails

Preserve capability/action distinctions, resource scopes, grant provenance, restrictions, delegation ceilings, dependencies, invitation lifecycle, immediate revocation, protected Owner custody, audit history and fail-closed enforcement. Keep the existing evaluator; no new role-name authority checks. Permission never bypasses domain eligibility.

Before a later implementation, identify authority, writer, reader, invariant, retry and failure path. Assignment writes must validate company/resource identity server-side, reject stale changes, replay safely, and commit lifecycle/history/activity atomically. Preserve non-login identities and historical records. Do not parse `crew_label` or names into authoritative IDs; retain legacy text only as non-authoritative compatibility data. No backfill by guessing.

Verify leaderless/Coordinator-free work, history across replacement and close/reopen, tenant isolation, stale/replayed writes, archived-reference handling and absence of unintended grant changes. Test the real protected paths when authorized; green static tests alone are not runtime proof. Any later UI work follows the visible desktop/390px standards, honest loading/error states and user-owned server rule. Do not run a new whole-product audit or redesign adjacent surfaces as part of this bounded slice.

## 18. Exact next authorized Phase 13C implementation boundary

**Next recommended slice: DURABLE JOB → CREW ASSIGNMENT FOUNDATION.** This is the scope to authorize in the next implementation task; this document itself authorizes **no implementation**.

Deliver durable assignment identity/lifecycle, optional Assignment Lead, multiple historical assignments, preserved assignment-time facts, company-safe reads/writes, atomic activity/history, retry/stale-write protection and closure behavior on top of the existing people/Crew foundation. Preserve the ability to add concurrent work packages without replacing assignment identities. Use existing company-scope assignment authority and Calendar schedule truth. No assignment-derived access effects or new job-scoped Start powers in this slice.

The foundation must work with a Crew having no Lead, a Job having no Coordinator, and no Crew member having a login. Its read contract must keep assignment history distinct from current roster and Coordinator-based weekly work. A minimal assignment API/read model is in scope; assignment UI integration is a subsequent bounded surface, not a Team redesign.

**Excluded:** access-role redesign; stored-role/member migration; title UI; broad financial redesign or cost-safe proposal implementation; Team redesign; a second scheduling system; availability/capacity; payroll/timekeeping; route optimization; external subcontractor portal; automatic sharing/reason-ledger conversion; work-package UI; commits, pushes or deployments without separate authorization.

**Stop condition:** foundation and authorized proof complete; report actual local/staging/production state and remaining proof debt. Do not continue into the excluded work or treat this decision as permission to execute SQL, apply migrations or mutate an environment.
