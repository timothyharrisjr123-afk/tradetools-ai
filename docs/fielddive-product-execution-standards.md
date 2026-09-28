# FieldDive product and execution standards

**Status:** Mandatory standing authority for all FieldDive implementation work.

**Applies to:** GPT, Cursor, Astra, Sol, and any later session that proposes or changes FieldDive.

**Does not replace:** accepted code, locked program blueprints, or repo truth for a specific domain. Those remain the product truth for that domain. These standards govern how the work is done.

If a standard and a locked blueprint appear to conflict, stop and report the conflict. Do not pick a weaker reading, improvise a replacement, or silently drop either side.

Current checkpoint and program sequence live in `docs/fielddive-global-handoff.md`. Visible UI also follows `docs/fielddive-ui-product-cohesion-standard.md`. Whole-product and competitive audits follow `docs/fielddive-audit-playbook.md`.

---

## Paid product standard

Canonical final question:

**WOULD THIS HOLD UP AS A PAID PRODUCT IN FRONT OF REAL CONTRACTORS?**

Tests passing is necessary, not sufficient.

Build passing is necessary, not sufficient.

Checklist compliance is necessary, not sufficient.

Correctness and product truth come before speed.

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

---

## Architecture standard

Use this phrase:

durable, stable, production-grade architecture with no unnecessary complexity

Prefer durable root-cause corrections over patches or shortcuts.

Do not add abstractions, generalized infrastructure, future-proofing, adjacent cleanup, or frameworks unless repo truth proves they are needed.

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

Cursor inspects them itself.

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
