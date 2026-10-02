# FieldDive product and execution standards

**Status:** Mandatory standing authority for all FieldDive implementation work.

**Applies to:** GPT, Cursor, Astra, Sol, and any later session that proposes or changes FieldDive.

**Does not replace:** accepted code, locked program blueprints, or repo truth for a specific domain. Those remain the product truth for that domain. These standards govern how the work is done.

If a standard and a locked blueprint appear to conflict, stop and report the conflict. Do not pick a weaker reading, improvise a replacement, or silently drop either side.

Current checkpoint and program sequence live in `docs/fielddive-global-handoff.md`. Visible UI also follows `docs/fielddive-ui-product-cohesion-standard.md`. Whole-product and competitive audits follow `docs/fielddive-audit-playbook.md`. Active cross-cutting product locks and settled product decisions are indexed in `docs/fielddive-active-product-locks.md`, which every task reads first.

---

## Paid product standard

Canonical final question:

**WOULD THIS HOLD UP AS A PAID PRODUCT IN FRONT OF REAL CONTRACTORS?**

Tests passing is necessary, not sufficient.

Build passing is necessary, not sufficient.

Checklist compliance is necessary, not sufficient.

Correctness and product truth come before speed.

### All applicable standards apply together

A slice is accepted only when it satisfies every standard that applies to it, at the same time:

- product truth
- database invariants
- server authority
- tenant isolation
- identity
- lifecycle
- replay, idempotency and stale-write handling
- every legitimate write path, with no client bypass
- UI cohesion
- truthful loading, error and empty states
- desktop and mobile
- adjacent regressions
- fixture restoration
- environment safety
- visual review where the change is visible

Strength in one standard does not buy an exception in another:

- A green test suite does not override a broken product contract.
- A polished UI does not override incorrect authority.
- A correct isolated feature does not override whole-app incoherence.

---

## Core product principles

Preserve these as standing phrases:

FLOW WHEN NEEDED.

STAY QUIET WHEN NOT NEEDED.

KNOW IT → DO IT.

NEED INPUT → ASK THERE.

RISK → WARN CLEARLY.

FIELDIVE SHOULD KNOW MORE THAN IT SHOWS.

POWER LIVES UNDER THE HOOD.

CLARITY LIVES IN THE INTERFACE.

FieldDive should not simplify by removing capability. It should simplify by absorbing complexity internally and surfacing only what is useful in the moment. Advanced capability can be sophisticated under the hood while remaining contractor-simple in the interface.

Do not equate "avoid overbuilding" with "remove capability."

Use the simplest durable internal architecture that supports current launch needs, strong security, and future expansion without replacement.

The Astra architecture report wrote the three action lines with em dashes (`KNOW IT — DO IT`). The arrow form above is the standing phrase for future work. The meaning is the same.

HISTORY != CURRENT OPERATIONS.

FIELDIVE SHOULD REDUCE THE CONTRACTOR'S ADMINISTRATIVE MEMORY BURDEN, NOT MIRROR THE DATABASE BACK AT THEM.

---

## Contractor operating model first

**CONTRACTOR OPERATING MODEL FIRST.** This is the primary product lens.

FieldDive is designed around how a real contractor operates day to day, not around database tables, internal modules, state-machine convenience or software architecture.

Test: **"If a contractor used FieldDive all day without knowing how FieldDive is built, would the workflow feel obvious?"**

If a technically correct implementation feels unnatural to a contractor, the product flow is not finished.

### Real-world workflow reasoning method

Mandatory before designing, changing, auditing or approving a workflow.

**FOLLOW THE WORK, NOT THE SOFTWARE.**

**REAL CONTRACTOR EXAMPLE FIRST. PRODUCT BEHAVIOR SECOND. SYSTEM/ARCHITECTURE TRANSLATION THIRD.** Contractor examples precede system abstractions when reasoning about product behavior. System-oriented wording first causes product drift.

1. **Tell the real contractor story first.** Use actual people, customer, property and Job context when it helps. Example: "Mike is managing the Miller residence. Mike is sick. Mark takes over. What would the contractor expect FieldDive to show now?"
2. **Walk the work in the order it actually happens.** For example: customer/address → property visit → photos → measurement → scope → proposal → approval → scheduling → production → completion → financial/admin closeout → Closed.
3. **At every step ask:**
   - What happened in the real business?
   - What does the contractor believe is true right now?
   - What would they naturally do next?
   - What does FieldDive already know?
   - What should FieldDive do automatically?
   - What genuinely requires contractor judgment?
   - What should remain current?
   - What belongs only in history?
   - If this screen is never opened again, does the system remain truthful?
   - Is FieldDive reducing administrative work or creating it?
4. **Reuse known information.** Do not make a contractor re-enter customer, property, person or Job context FieldDive already knows.
5. **Bring required setup into the workflow when practical.** Do not force the contractor to understand internal module organization. Example: if a proposal needs a template, ask whether a usable default should already exist, or whether the missing requirement should be handled in the proposal flow rather than sending the contractor to hunt through Setup.
6. **Automate consequences FieldDive can know.** Do not ask the contractor to clean up stale Crew, schedule, task or access state manually when the business event already determines the answer.
7. **Ask where real business intent is ambiguous.** Example: a scheduled Job placed On Hold. FieldDive cannot know whether the contractor wants to protect or release that capacity, so it asks there.
8. **Preserve history without making history behave like current operations.**
9. **Use tailored exceptions when real human behavior requires them.** Do not weaken a good main workflow to accommodate an edge case. Example: Lost is terminal, but a 24-hour "Lost by mistake" correction is a bounded exception for human error.
10. **Do not add complexity merely for architectural neatness.** No new state, page, module, role or workflow unless contractor reality requires it.
11. **Only after the contractor behavior is understood,** translate it into domain model, database invariants, server authority, permissions, components, screens, tests and history/audit representation.

Permanent test: **IF A CONTRACTOR HAS TO STOP AND THINK ABOUT HOW FIELDIVE IS ORGANIZED IN ORDER TO FINISH THEIR REAL-WORLD TASK, THE FLOW IS NOT FINISHED.**

This method is the design-side counterpart of the real-world contractor scenario audit in `docs/fielddive-audit-playbook.md`.

### Prompts are not standalone

An implementation, audit or research prompt is not a standalone product specification. Every task applies, in order:

1. current canonical governance;
2. `docs/fielddive-active-product-locks.md`;
3. the latest controlling domain decision;
4. task-specific instructions.

**LATEST EXPLICIT CONTROLLING PRODUCT DECISION WINS.** Historical docs, migrations, tests and screenshots are evidence, not authority over a newer explicit decision. A test that encodes a superseded assumption is updated when that behavior is implemented; it is not product authority merely because it passes. Do not ask an agent to independently re-decide a settled decision.

---

## Architecture standard

Use this phrase:

durable, stable, production-grade architecture with no unnecessary complexity

Prefer durable root-cause corrections over patches or shortcuts.

Do not add abstractions, generalized infrastructure, future-proofing, adjacent cleanup, or frameworks unless repo truth proves they are needed.

### Long-term correctness over ease

Durable production-grade architecture wins over the easiest implementation.

- Effort, difficulty, file count, or convenience are not reasons to choose a weaker architecture.
- Do not patch a symptom when the durable answer is a shared abstraction, a domain contract, a reusable primitive, a lifecycle rule, a database invariant, or a clearer product model. When repo truth shows the same truth or interaction in more than one place, that is the proof of need the rule above asks for.
- Protect already-correct systems while improving the architecture next to them.
- Avoid speculative overengineering, but never use that as a justification for knowingly weak architecture.

Acceptance consequence: a slice that knowingly ships the weaker architecture because the durable one was more work is not complete. The test stays the same: would this hold up as a paid product in front of real contractors?

Before editing a critical system, identify:

- current authority
- writer
- reader
- invariant
- retry path
- failure mode

If any of those is unclear, investigate before mutation.

---

## Fix-When-Found

If a confirmed issue:

- belongs to the current workflow or system
- has an understood root cause
- has a durable bounded correction
- can be fixed without violating protected systems

fix it in the current session.

Defer only for:

- a genuinely different product decision
- production mutation that requires authorization
- schema or architecture expansion beyond the approved boundary
- an unresolved root cause
- a genuinely separate system or phase

"Not in the original checklist" is not a reason to defer.

At the same time, do not expand a bounded implementation into unrelated cleanup or a broad redesign.

The same rule is locked for company access in the Phase 13B blueprint (§1.8). This document makes it standing for all FieldDive work.

---

## Error and state truth

ERROR != EMPTY

UNKNOWN != ZERO

FAILED != SUCCESS

DISABLED != NO ACCOUNT

PENDING INVITATION != MEMBERSHIP

DELIVERY != ACCESS AUTHORITY

Normal UI should show:

CURRENT OUTCOME

+

NEXT USEFUL ACTION

Do not expose internal telemetry to ordinary contractors.

Example: "Email wasn't sent." Then check or correct the address, and retry. Do not show the provider event, the delivery attempt, webhook state, or retry history.

Accepted illustrations already in the product: a failed acceptance read is not "no acceptance"; a failed payment or proposal read is not zero; a disabled member is not someone who never belonged; a pending invitation is not a membership; a sent or failed email is not access.

---

## Domain ownership

One job.

Domain tabs own truth.

Overview may summarize only what materially affects understanding of current state or the next useful action.

Do not duplicate authoritative systems.

Examples:

- Payments owns money truth. Overview may summarize a payment consequence when it materially affects what the contractor needs to understand next.
- Activity owns chronology, not financial authority.
- Calendar owns scheduling mutation.
- Proposal acceptance is not operational approval.
- Permission never bypasses domain eligibility.

---

## Whole-product coherence

A technically correct island is not a finished product.

Before closing a meaningful feature cluster, verify that the same truth stays coherent across the adjacent surfaces and workflows, not only on the surface that changed.

If the same real-world thing appears on more than one surface, validate it across every relevant surface before moving on. Examples:

- **Person:** Team, invitations and access, Crew membership, Coordinator, Field brief, activity and history.
- **Crew:** Team, Job assignment, Job Overview, Field brief, Job Board where relevant, Calendar once integrated, activity and history.
- **Job:** Job Board, Job Card, Calendar, Crew assignment, proposals, payments, lifecycle.

Do not force an entity onto a screen where it does not belong. Wherever it legitimately appears, it shows one coherent truth: the same identity, the same name, the same state and the same source.

Acceptance consequence: a feature cluster is not closed until the cross-surface coherence gate in `docs/fielddive-audit-playbook.md` passes.

---

## Tenancy

No cross-tenant:

- association
- read
- write
- reassignment
- inference

through:

- UI
- API
- RPC
- RLS
- direct authenticated database access
- a stale session
- retry
- partial failure

Silent tenant mixing is a P0 launch blocker.

Company is the tenant. Authentication alone is never company access. Users never supply a company id as authority.

---

## People, titles and authority

PERSON != SOFTWARE USER

TITLE != AUTHORITY

CREW != SECURITY GROUP

JOB RESPONSIBILITY != TITLE

ASSIGNMENT != SCHEDULE != ACCESS

ACCESS FOLLOWS REAL WORK, NOT LABELS.

FieldDive controls the product concepts. The contractor controls what people are called. A company may call people Supervisor, Foreman, Project Manager, Lead, Coordinator, or anything else. Those labels never automatically define software authority, navigation, Crew relationships or Job responsibility.

Person association is by explicit identity, never inferred from name, phone or email.

The controlling Phase 13C interpretation is `docs/phase13c-people-crew-access-product-architecture-decision.md`.

### Team experience

Team can be sophisticated internally, but it must be simple externally. Without training, a contractor should understand how to:

- add a Person
- optionally give that Person FieldDive access, and understand what that access means
- create a Crew, and add or remove its members
- optionally set the Crew's usual leadership
- assign a Crew to a Job
- change any of those relationships later

The interface must not require the contractor to understand auth users, membership rows, raw capabilities, RLS, grant ledgers, or the internal identity architecture.

POWER LIVES UNDER THE HOOD. CLARITY LIVES IN THE INTERFACE.

---

## Access product direction

**This is product direction, not implemented state.** Access simplification has not been implemented. The current stored roles and occupational access presets (for example Office Manager, Production Coordinator, Lead, Sales, Field) are transitional. Current implementation status lives in `docs/fielddive-global-handoff.md`.

Access is a guardrail, not workflow. ACCESS FOLLOWS REAL WORK.

| Access | Direction |
|---|---|
| **Owner** | Protected custody with inherent authority. Not a normal selectable tier. |
| **Working Access** | Limited operational access to assigned or shared work. |
| **Full Team Access** | Broad normal operations. Does **not** automatically include authority to manage other people's FieldDive access. |
| **Additional Access** | Bounded authority layered onto an appropriate base access, grouped by understandable business purpose. |

Do not invent extra tiers for visual symmetry. Do not expose backend capability identifiers as the user's mental model. The existing capability evaluator, scopes, restrictions, delegation ceilings, custody and audit remain underneath.

### Manage FieldDive access

Manage People & Crews != Manage FieldDive access.

"Manage FieldDive access" means inviting, changing access, removing access and restoring access. Owner has it inherently. Full Team Access does not automatically include it. Working Access should not offer it as a normal option.

### Payments

- **View payments:** balances, paid and unpaid state, payment history, and relevant payment status or issues. No active collection authority.
- **Full payment access:** includes View payments, plus requesting and sending payment collection, recording or confirming receipt where FieldDive supports it, and managing operational collection follow-up and issues. It does not imply Owner-only financial authority.

Refunds and credits stay separate and are never inherited from viewing, requesting or recording payments. Owner-only and sensitive financial controls (banking and payout configuration, FieldDive subscription billing, ownership and security) stay separate in protected Company Settings. Internal costs and profitability stay separate from customer prices. The full commercial and money rule, including the current cost-visibility limitation, lives in the controlling decision §5.

### Access explanation

Every user-facing access choice explains, before the contractor confirms it:

- what the person can see
- what they can do
- what they cannot do
- whether the access is company-wide or limited to assigned or shared work

Critical authority must never be explained only in a tooltip.

---

## Derived access lifecycle

If access exists because of an operational reason, the lifecycle must define what happens when that reason ends.

- Do not revoke blindly when another legitimate reason remains.
- Prefer source- and reason-aware authority and cleanup, enforced by the server and database, over client heuristics.
- Examples of reasons: Coordinator responsibility, task assignment, manual access, invitation or migration reasons.
- SOFTWARE ACCESS != JOB RESPONSIBILITY. A person's normal company access persists until the company changes or removes it. It is not created and removed per Job. A Job relationship may supply the scope or reason for a person whose access is intentionally limited to assigned or shared Jobs. Ending that relationship never erases unrelated company access.

Acceptance consequence: a slice that creates derived access, or changes the operational reason behind it, is not complete until create, change, clear, replace and replay are defined for that reason. This standard does not itself authorize any access implementation.

---

## External providers

External providers enrich FieldDive truth. They do not become tenant truth.

Stripe handles money. FieldDive orchestrates product state.

Provider delivery telemetry is operational and support truth, not contractor-facing product truth.

---

## Process and command authority

Future implementation prompts should authorize normal in-scope work without repeated permission prompts:

- reads and search
- git inspection
- edits inside the authorized scope
- tests
- typecheck
- bounded staging proof when that proof was specifically authorized

Ask only at real boundaries:

- scope expansion
- database, SQL, or migration work that was not already authorized
- production mutation
- package install or update
- server management
- git history rewrite
- destructive unrelated operations
- a genuinely new product direction
- a materially ambiguous UX or product decision

---

## Server ownership

The user owns `npm run dev`.

Agents must never start, stop, restart, or kill the user's dev server or Node processes unless explicitly authorized.

This applies to temporary proof servers too.

Phase 13 slice 0C lesson: temporary `next start`, or any similar process management, is still server management and requires explicit authority.

Do not clear or overwrite the main `.next` directory to satisfy a proof or a release.

---

## Browser and visual workflow

Standing visible-browser rule:

- Use the normal external or main browser.
- Do not use the Cursor embedded browser as primary proof.
- Use authenticated `http://localhost:3000`.
- Do not substitute `127.0.0.1` for signed-in proof. Browser origins and cookies differ.
- The visible browser is the primary visual proof, not a hidden or background browser, unless a technical block is recorded.

Cursor saves screenshots under `tmp/fielddive-ui-review/...`.

Cursor inspects them itself. That inspection is evidence, not acceptance: visible changes need independent visual review, and proof sets larger than 20 screenshots follow the ZIP gate. Both are defined in `docs/fielddive-ui-product-cohesion-standard.md`.

Cursor opens that folder in File Explorer afterward and leaves it open.

Material visual changes also follow `docs/fielddive-ui-product-cohesion-standard.md`. If the running app cannot validly exercise the change, do not fake proof. Record the proof debt and validate it at the next compatible gate.

---

## Real viewport requirements

Desktop proof:

`window.innerWidth >= 1200`

Mobile proof:

`window.innerWidth === 390`

and `scrollWidth <= 390`

A desktop-sized screenshot that contains a narrow browser viewport is not desktop proof.

---

## Astra usage

Define the problem, current FieldDive truth, product principles, constraints, and evaluation criteria tightly.

Do not over-constrain Astra's solution space to one or a few benchmark products.

Let Astra:

- research broadly
- inspect multiple excellent systems
- identify recurring patterns
- reject poor fits
- challenge FieldDive assumptions
- synthesize
- adapt to FieldDive

Benchmark products inform. They do not dictate.

Use Astra for high-leverage product research, architecture, strategic disagreement, and difficult system design. Not for routine implementation.

Classify Astra output:

- ASTRA-EXPLICIT
- ASTRA-ALIGNED IMPROVEMENT
- NEW DIRECTION

A NEW DIRECTION requires explicit product consideration. It is not silently treated as Astra authority.

---

## Sol audit lesson

For a major whole-product audit, Sol independently audits first principles and repo truth before seeing Cursor's conclusions.

Purpose: avoid anchoring.

Primary question:

What would stop this from holding up as a paid product in front of real contractors?

Compare independent findings only afterward.

The full method is `docs/fielddive-audit-playbook.md`.

---

## Cursor prompt lessons

Cursor quality improved materially when prompts were tighter.

Prompts should state:

- that `docs/fielddive-active-product-locks.md` and current governance apply
- the real contractor story the work serves
- purpose
- the screen or system job
- source of truth
- authority
- loading, empty, error, and retry behavior
- state-by-state requirements
- protected truth
- forbidden shortcuts
- scope
- stop conditions
- proof requirements
- the expected final report

Avoid vague prompts such as "polish this", "make it premium", or "clean this up" when the real information architecture can be specified.

---

## Prompt-learning loop

When Cursor, Astra, or Sol returns work that is technically correct and product-wrong, do not merely correct the output.

Identify what instruction was missing, vague, misleading, or overconstrained, and improve future prompts.

When Cursor or an implementation repeatedly misses a class of problem, future prompts and checklists must explicitly test for that class. The process must improve, not only the current defect.

Known failure classes to test for explicitly:

- occupational labels becoming authority
- a local patch instead of a shared abstraction
- incomplete writer audits
- missing lifecycle cleanup, including derived access
- cross-surface identity mismatch
- generic or CRUD-looking UI
- false loading, error or empty states
- the visual-proof packaging rule missed
- technically correct behavior that fails the contractor story (system-first reasoning)
- terminal or ended states that leave live operational commitments behind
- re-deciding a settled product decision instead of reading the active locks

Known examples:

- A fake desktop viewport led to requiring an actual `window.innerWidth`.
- A hidden browser led to requiring the visible external browser.
- "Preview-led" was misread, so the intended outcome has to be defined.
- Speculative failure names have to be replaced by the exact failure, proved.
- Too many micro-prompts led to: verify, implement, test, and continue while the tree is clean.
- Ambiguous network retry has to require server and database idempotency.
- Harness-only proof is not enough when authority or operational behavior matters. Require the real product route.
- A migration required by committed code is applied and proved on staging, and later coordinated to production. It is not silently left unapplied.
- UI hierarchy failures have to be met by an explicit scan order and explicit information ownership.

---

## Technology currentness

When touching dependency conventions, framework APIs, SDK APIs, auth or security conventions, Stripe, Resend, Supabase, or Next.js, perform a technology-current sanity check where it is relevant.

Do not rewrite merely because something newer exists.

A dedicated Technology Currency / Modernization Audit remains part of the commercial-launch roadmap. It is not an excuse to modernize inside an unrelated phase.

---

## Release and environment truth

- Local `main` is the canonical development branch unless it is intentionally changed.
- Production and staging database state must be distinguished explicitly. Staging is not production. A staging migration does not protect production.
- Do not blindly push `origin`.
- Production rollout is an explicit coordinated gate.
- Deployment provenance matters. Promote an exact deployment id or URL. Do not rely on an ambiguous "latest".
- Where the release requires it, database changes land before the app deploy that depends on them.
- Do not echo secrets. Never print `DATABASE_URL`, service keys, Stripe secrets, or JWTs. Classification only: `PRODUCTION`, `STAGING`, or `LOCAL`.

Established project identity, already used by the release guard:

- Production: `rhquhnujjnzjhweypavd`
- Staging: `tjtrhdckinjtorgbkirm`

Before any Supabase mutation, run `scripts/supabase-target-guard.ps1`. Ordinary CLI link stays staging unless a production task explicitly re-links and then restores staging. Release isolation and selective production builds follow `docs/fielddive-release-discipline.md`. Do not run a selective production install inside the main checkout when a release worktree exists for that purpose.

Do not push, and do not deploy tip `main`, unless that action was explicitly authorized.
