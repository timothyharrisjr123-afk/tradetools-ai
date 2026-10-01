# FieldDive audit playbook

**Status:** Mandatory method for future FieldDive whole-product audits and competitive audits. The required audit map, cross-surface coherence gate and evidence rule below also apply to every meaningful feature or system audit and to feature-cluster closure.

**Also required:** `docs/fielddive-product-execution-standards.md` and, wherever a finding is about what the contractor sees, `docs/fielddive-ui-product-cohesion-standard.md`.

This playbook is the method. It is not a substitute for looking at the product, and it is not permission to expand the product because a competitor has a feature.

Older audits remain evidence. `docs/competitive-architecture-audit.md` and the Phase 12.5 cohesion audits are historical anchors. They do not limit later research to the products named in them, and they do not close findings that were never independently verified.

---

## Audit purpose

An audit inspects the actual product.

It does not stop at the roadmap, the intended architecture, the tests, the build, or the docs. Those are inputs. They are not the product.

An audit may surface a missing page, a missing capability, unsafe architecture, a product contradiction, a weak workflow, an unnecessary feature, a UX failure, or a launch blocker, even when that item is not on the current roadmap.

A finding does not automatically authorize random expansion.

A finding also must not be suppressed because it is "not on the roadmap."

Register it. Classify it. Decide explicitly whether it is in scope to fix now, deferred with a reason, or rejected with evidence.

The paid-product question for every audit is:

WOULD THIS HOLD UP AS A PAID PRODUCT IN FRONT OF REAL CONTRACTORS?

---

## Required audit map

A meaningful audit of any feature or system maps:

- **A. Entity:** the canonical real-world thing and its identity.
- **B. Source of truth:** the one authoritative record.
- **C. All readers:** every route, RPC, store, view, surface and derived summary that reads it.
- **D. All writers:** every legitimate write path, including RPCs, triggers, migrations, harnesses and stores. Confirm there is no direct client bypass.
- **E. Authority:** who may act, enforced where (server and database), within which tenant and scope.
- **F. Lifecycle:** create, change, clear or end, archive, restore, replace, replay, and stale or concurrent paths where relevant.
- **G. Derived consequences:** derived state and derived access, and what happens to each when its reason ends (see "Derived access lifecycle" in `docs/fielddive-product-execution-standards.md`).
- **H. Failure semantics:** loading, error, empty, unknown, partial failure and retry, kept distinct.
- **I. Cross-surface proof:** the same truth everywhere the entity legitimately appears.
- **J. Visual proof** where UI changed, following `docs/fielddive-ui-product-cohesion-standard.md`, including independent review and the ZIP gate.

A writer audit that stops at the obvious route is incomplete.

## Cross-surface coherence gate

This gate enforces "Whole-product coherence" in `docs/fielddive-product-execution-standards.md`. Before closing a feature cluster, audit at minimum:

- canonical entity identity and canonical source of truth
- every reader and every writer
- server and database authority, and security boundaries
- tenant isolation
- lifecycle, historical identity and derived state
- derived-access cleanup
- replay, idempotency and stale writes
- loading, error and empty states
- terminology, and picker or source consistency
- hidden setup dependencies and workflow dead ends
- desktop and mobile, and visual cohesion
- adjacent regressions

A cluster that fails the gate stays open, even if each slice inside it passed on its own.

## Evidence, not acceptance

Cursor PASS/FAIL labels and summaries are evidence only. Do not approve because Cursor says PASS.

Check every load-bearing claim independently against the actual evidence: the diff, the schema, RPC and trigger contract, the tests, the lifecycle behavior, the browser proof, the screenshots, and the relevant files.

When a class of problem keeps getting missed, apply the failure-class rule in the prompt-learning loop of `docs/fielddive-product-execution-standards.md`: future prompts and checklists test for that class explicitly.

---

## 13E-A — Whole-product / paid-product audit

Run the steps in this order. Do not let a later step anchor an earlier one.

### 1. Cursor repo truth first

Inventory what the repository actually contains:

- routes
- domains
- authorities (who writes, who reads, what is invariant)
- database and RPC security
- tests, including known failures
- debt
- staging versus production differences
- launch flows

Repo truth comes before opinion. Distinguish production, staging, and local. A staging migration is not production protection. Do not echo secrets.

### 2. Sol independent first-principles audit

Sol audits first principles and repo truth before seeing Cursor's conclusions.

Purpose: avoid anchoring.

Question:

What would stop this from holding up as a paid product in front of real contractors?

### 3. Cursor live whole-app audit

Use the visible external browser and authenticated `http://localhost:3000`. Do not use `127.0.0.1` for signed-in proof. Do not use a hidden browser as the primary pass. Do not start, stop, restart, or kill the user's dev server.

Desktop: `window.innerWidth >= 1200`.

Mobile: `window.innerWidth === 390` and `scrollWidth <= 390`.

Audit the real states, not only the happy path:

- loading
- empty
- populated
- error
- retry
- permission denied
- disabled
- creator
- invited user
- role differences
- mobile
- sensitive actions
- lifecycle transitions

ERROR != EMPTY. UNKNOWN != ZERO. FAILED != SUCCESS. DISABLED != NO ACCOUNT. PENDING INVITATION != MEMBERSHIP. DELIVERY != ACCESS AUTHORITY.

If the running app cannot reach the schema under audit, record that limit. Do not fake the pass.

### 4. Cross-system audit

Trace one job across the real authorities:

auth → company → customer and job → measurement → proposal → send → acceptance → contractor approval → schedule → production → payment → completion

Audit tenancy, permissions, public authority, money truth, lifecycle, idempotency, retries, stale sessions, provider state, recovery, and supportability.

No cross-tenant association, read, write, reassignment, or inference. Silent tenant mixing is a P0 launch blocker.

Permission never bypasses domain eligibility. Proposal acceptance is not operational approval. Stripe handles money; FieldDive orchestrates product state. Provider telemetry is not contractor-facing product truth.

### 5. Compare independent findings afterward

Only after Cursor and Sol have each recorded their own pass, compare them.

Classify each item:

- CONFIRMED
- NOT CONFIRMED
- DUPLICATE
- NEW
- NEEDS LIVE PROOF

### 6. Canonical remediation plan

Write one plan. Name the authority, the root cause, the bounded correction, the protected systems, and the proof. Do not turn the plan into a silent redesign.

### 7. Fix-When-Found

A confirmed issue in the system under audit, with an understood root cause and a durable bounded correction that does not violate protected systems, is fixed in the current session.

Defer only for a genuine product decision, an unauthorized production mutation, expansion past the approved boundary, an unresolved root cause, or a genuinely separate system.

"Not in the original checklist" and "not on the roadmap" are not reasons to ignore a confirmed defect inside the audited system. They are also not permission to boil the ocean.

---

## 13E-B — Competitive capability and differentiation audit

Canonical launch rule:

"FieldDive does not need the most features. It does need a clear, evidence-backed reason for its ICP to choose it over more mature software."

That rule is a launch requirement.

Primary ICP: approximately a 2–8 person residential retail roofing company.

Stress-test larger users where that is useful. Do not redefine the ICP to match a larger product.

### Competitor research method

Research broadly.

Do not anchor only to Roofr, JobNimbus, AccuLynx, ServiceTitan, or Jobber. Those may be useful benchmarks. Research should also identify other excellent systems where they are relevant.

Study roofing software, field-service software, CRM, sales systems, estimating systems, operations platforms, and excellent modern SaaS.

Compare underlying problems and workflow quality, not feature count alone.

This is the same Astra research rule used for architecture: define FieldDive's problem, truth, principles, constraints, and evaluation criteria tightly, and do not over-constrain the solution space to a few benchmark products. Benchmarks inform. They do not dictate.

Classify what comes back as ASTRA-EXPLICIT, ASTRA-ALIGNED IMPROVEMENT, or NEW DIRECTION. A NEW DIRECTION needs an explicit product decision. It is not automatic authority.

### Capability matrix

Compare FieldDive across:

- lead and intake
- customers
- property
- measurement
- pricing and catalog
- estimates and proposals
- upgrades and options
- financing
- signature
- customer review
- acceptance
- contractor approval
- scheduling
- tasks
- production
- field use
- scope changes
- communication
- payments
- refunds
- company and team access
- reporting
- automation
- integrations
- AI and copilot
- onboarding
- mobile
- recovery and support

For each, distinguish internally:

- absent
- basic
- strong
- best-in-class candidate
- needs live verification

Also record importance to the ICP and gap severity.

A cell marked strong or best-in-class still needs live verification before it is used as a marketing claim.

### Workflow benchmarking

Do not rely only on feature presence. Run equivalent contractor scenarios.

NEW RETAIL ROOF LEAD → proposal ready to send.

Measure user effort, elapsed time, screens, duplicated entry, required decisions, setup prerequisites, error exposure, and proposal quality.

UPGRADE REQUEST → recalculate → preserve margin → update the customer proposal.

PROPOSAL ACCEPTED → contractor approval → schedule → production.

FIELD WORKER RECEIVES JOB → useful work with the correct access.

JOB COMPLETE / BALANCE DUE → understand the remaining closeout action → request payment.

Add scenarios where the research shows they matter. Do not invent a favorable path by skipping steps the contractor actually has to take.

### Prove marketing claims

Do not claim "faster", "easier", "more intelligent", "less setup", or "better AI" without evidence.

If FieldDive claims faster proposal creation, compare the same starting inputs and the same target outcome against relevant alternatives.

Distinguish an instant homeowner quote from a verified contractor-ready proposal. Do not blur different workflows to create a favorable claim.

### Differentiation

Potential differentiators are hypotheses until they are proved or rejected.

Examples, not claims:

- less software operation and a more natural job flow
- proposal-to-production continuity
- sophisticated capability with simpler day-to-day interaction
- AI or copilot grounded in actual job truth
- faster activation
- stronger cross-domain context

Do not treat these as marketing truth because they sound compelling.

### AI and copilot benchmark

"Has a chatbot" is not meaningful AI differentiation.

Ask whether the copilot can safely use real customer, job, measurement, pricing, proposal, payment, team, lifecycle, and scope context without making the contractor explain the job again.

Evaluate context quality, authority safety, useful preparation, action capability, error and recovery, and time saved.

The copilot acts on behalf of the authenticated person. It does not exceed that person's authority, and permission still does not bypass domain eligibility.

### Launch differentiation gate

Before commercial launch, FieldDive should be able to state approximately three to five concrete reasons why the target roofing company should choose FieldDive instead of a more mature alternative.

Each reason needs:

- an actual supporting product capability
- workflow proof
- an appropriate competitor comparison
- a truthful boundary or qualification

If that answer is weak, do not invent stronger marketing. Improve the product.

---

## 13F — Remediation and competitive gap closure

13F fixes:

- confirmed P0 findings
- confirmed P1 findings
- appropriate P2 findings

and the missing capabilities that 13E-B proves are genuinely required for FieldDive to compete credibly.

Do not add a capability merely because a competitor has it.

Feature inclusion standard: does it materially improve daily workflow, admin burden, conversion, job execution, mistake reduction, customer experience, or useful tier differentiation for the intended ICP?

---

## Audit closure

A finding moves through:

FOUND → REGISTERED → ROOT CAUSE PLANNED → CORRECTED → INDEPENDENTLY VERIFIED → CLOSED

Do not call a finding closed because code changed.

Independent verification means a separate pass against the actual product behavior, not a reread of the diff that introduced the change. Where the behavior is visual, that pass uses the visible-browser and viewport rules. Where the behavior is authority, it uses the real route or the real database policy, not only a harness.

---

## What an audit must not do

- Do not anchor Sol to Cursor's conclusions.
- Do not anchor research to a short list of competitors.
- Do not treat tests, a green build, or a checklist as the paid-product answer.
- Do not suppress a real finding because it was not on the roadmap.
- Do not treat a finding as authorization to build whatever was found.
- Do not claim a differentiator that has not been proved.
- Do not mix production and staging evidence.
- Do not manage the user's server in order to run the audit.
