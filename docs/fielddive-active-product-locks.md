# FieldDive active product locks

**Status:** Mandatory starting reference for every FieldDive implementation, audit, research or review task (Cursor, GPT, Astra, Sol, any agent).

**Role:** This is an index. It lists the *active* cross-cutting product truths and points to the canonical documents that hold the detail. It does not replace them and does not restate their contracts. Where this index and a canonical document appear to conflict, stop and report it. Do not pick a weaker reading.

**Answers one question:** what must every future FieldDive implementation or audit know before reasoning about behavior?

Last updated: 2026-10-04 (later): discovery-supersession, product advancement and Roofr-floor locks added (§1, §3A); measurement application locked (D10); Slice 1 status recorded (§6). Earlier the same day: plain-language product copy lock.

---

## 1. Precedence and supersession

**LATEST EXPLICIT CONTROLLING PRODUCT DECISION WINS.**

Historical docs, migrations, tests, screenshots and older handoff sections remain valuable evidence and history. They do not override a newer explicit product decision.

Tests that encode a superseded product assumption must be updated when that behavior is later implemented. A test is not product authority merely because it currently passes.

Every task applies, in this order:

1. current canonical governance (§7 below);
2. these Active Product Locks;
3. the latest controlling domain decision;
4. task-specific instructions.

**A task prompt is not a standalone product specification.** Agents must not independently re-decide a settled decision recorded here. If a task appears to require changing one, stop and raise it as a product decision.

**NEW DISCOVERY SUPERSEDES STALE ASSUMPTIONS.** When new evidence narrows or invalidates a prior assumption:
1. name the assumption;
2. find every active and upcoming slice that depends on it;
3. decide whether in-flight work stops, narrows or changes;
4. update the controlling docs immediately;
5. tell implementation agents what is no longer a lock.

- **DO NOT continue implementing an older assumption merely because it was previously approved.**
- **DO NOT BUILD SOMETHING WE ALREADY KNOW WE ARE LIKELY TO REMOVE.**
- Temporary compatibility behavior may stay for current truth or safety, but it must be labelled temporary and never presented visually or architecturally as the future model.
- **NEW PRODUCT DISCOVERY IS CROSS-CUTTING UNTIL PROVEN OTHERWISE.** Check it against the whole contractor journey when it touches any of these, not only the slice where it was found:
  - workflow;
  - required inputs;
  - availability;
  - lifecycle;
  - pricing;
  - navigation;
  - terminology;
  - next-action logic;
  - presentation.

Full procedure: execution standards → "Product advancement and discovery reconciliation".

---

## 2. Primary lock — CONTRACTOR OPERATING MODEL FIRST

FieldDive is designed around how a real contractor operates day to day, not around database tables, internal modules, state-machine convenience or software architecture.

Test: **"If a contractor used FieldDive all day without knowing how FieldDive is built, would the workflow feel obvious?"**

If a technically correct implementation feels unnatural to a contractor, the product flow is not finished.

Standing phrases (canonical in `docs/fielddive-product-execution-standards.md`):

- WOULD THIS HOLD UP AS A PAID PRODUCT IN FRONT OF REAL CONTRACTORS?
- FLOW WHEN NEEDED. STAY QUIET WHEN NOT NEEDED.
- KNOW IT → DO IT. NEED INPUT → ASK THERE. RISK → WARN CLEARLY.
- FIELDIVE SHOULD KNOW MORE THAN IT SHOWS.
- POWER LIVES UNDER THE HOOD. CLARITY LIVES IN THE INTERFACE.
- A TECHNICALLY CORRECT ISLAND IS NOT A FINISHED PRODUCT.
- HISTORY != CURRENT OPERATIONS.
- FIELDIVE SHOULD REDUCE THE CONTRACTOR'S ADMINISTRATIVE MEMORY BURDEN, NOT MIRROR THE DATABASE BACK AT THEM.
- THE CONTRACTOR SHOULD SEE WHAT SOMETHING MEANS, NOT HOW FIELDIVE IMPLEMENTS IT.

## 3. Mandatory method — FIELDIVE REAL-WORLD WORKFLOW REASONING METHOD

**FOLLOW THE WORK, NOT THE SOFTWARE.**

**REAL CONTRACTOR EXAMPLE FIRST. PRODUCT BEHAVIOR SECOND. SYSTEM/ARCHITECTURE TRANSLATION THIRD.**

**IF A CONTRACTOR HAS TO STOP AND THINK ABOUT HOW FIELDIVE IS ORGANIZED IN ORDER TO FINISH THEIR REAL-WORLD TASK, THE FLOW IS NOT FINISHED.**

- Full method (design and implementation): `docs/fielddive-product-execution-standards.md` → "Real-world workflow reasoning method".
- Audit application (end-to-end contractor scenarios, domain correctness **and** real-world flow): `docs/fielddive-audit-playbook.md` → "Real-world contractor scenario audit".

## 3A. Mandatory method — PRODUCT ADVANCEMENT (locked 2026-10-04)

**FIELDIVE PRODUCT ADVANCEMENT LOOP:** contractor reality → repo truth → competitive benchmark → identify the stronger opportunity → impact-check the current roadmap → challenge if materially better → update controlling locks → implement → visually verify → reassess.

- **PROACTIVE PRODUCT ADVANCEMENT IS REQUIRED.** Before major workflow or UI decisions, evaluate:
  - the contractor's goal;
  - what FieldDive does now;
  - repo truth;
  - how Roofr and other leaders solve it;
  - what competitors do poorly;
  - what FieldDive can do more clearly, simply or intelligently.
- **DO NOT CONFUSE AGREEMENT WITH HELPFULNESS.** Agents must challenge a materially weaker direction with evidence, before implementation.
- **ROOFR PARITY IS A FLOOR, NOT A CEILING.**
  - Roofr is the primary structural and flow reference unless evidence supports a stronger pattern.
  - Then check JobNimbus, AccuLynx and others.
  - Classify as ADOPT / ADAPT / KEEP FIELDIVE / IMPROVE / DO NOT COPY.
  - Never copy only for parity. Never keep a weaker FieldDive pattern just because it exists.
- **Challenge threshold.** Interrupt only when one of these holds; otherwise park the improvement for the correct slice:
  - the flow is materially worse;
  - the UI is materially less clear than a proven pattern;
  - new evidence invalidates an active assumption;
  - a launch-critical capability is missing;
  - the work would likely be removed or reworked soon.
- **IMPROVE AGGRESSIVELY, BUT INTERRUPT ACTIVE WORK ONLY WHEN CONTINUING WOULD BUILD AGAINST A NOW-INVALID ASSUMPTION.**
- **Major UI Product Advancement Gate** (major surfaces only):
  - Record seven items:
    1. contractor goal;
    2. current truth;
    3. current presentation;
    4. Roofr / proven pattern;
    5. strongest FieldDive opportunity;
    6. recommendation (keep / refine / change presentation / change flow / product-domain change);
    7. impact on active work.
  - Then ask: **"IF WE SHIPPED THE CURRENT PLAN UNCHANGED, WHAT WOULD A STRONG COMPETITOR STILL MAKE FEEL OBVIOUSLY EASIER?"**

Full procedures: execution standards → "Product advancement and discovery reconciliation".

---

## 4. Settled product decisions (2026-10-02)

These decisions are settled. They are product behavior, not implemented state. **No implementation is authorized by recording them.** Each implementation slice needs its own authorization. Exact UI composition and data contracts are designed in that slice, constrained by these decisions.

### D1. Lost before Complete

A Job may be marked Lost at any point **before** it is successfully Complete, including after production has started or money has been received.

**LOST = THIS JOB WILL NOT PROCEED TO NORMAL COMPLETION.**

- A Lost reason is required.
- Lost may happen before or during production.
- Work, payment, agreement, photo and activity history remain truthful.
- Current operational commitments retire appropriately.
- Outstanding financial and administrative obligations remain truthful and actionable.
- Lost does **not** mean refunded, paid, forgiven, erased or never started.
- Once a Job is Complete, it does not subsequently become Lost.
- A returning customer gets a **new Job** using existing Customer/Property context. The Lost Job is not permanently reopened.
- Do not encode Lost narrowly as "pre-contract sales loss."

### D2. Closed

A Job cannot be Closed while meaningful work remains pending.

**CLOSED = THERE IS NO REMAINING OPERATIONAL, FINANCIAL, ADMINISTRATIVE, CUSTOMER OR CLOSEOUT WORK REQUIRING ACTION.**

Before Closed, all of these are resolved: balances; payment, refund and credit issues; open payment requests; meaningful admin follow-up; required closeout work; meaningful customer issues. Active operational commitments are over.

"Resolved" does not necessarily mean paid in full. A financial obligation may be deliberately paid, written off, credited, refunded, cancelled or otherwise formally settled. It cannot still be pending.

**COMPLETE = THE WORK IS FINISHED. CLOSED = EVERYTHING ABOUT THE JOB IS FINISHED.**

### D3. On Hold + Calendar

On Hold preserves the Job. When a currently scheduled Job is placed On Hold, FieldDive does not guess what happens to the Calendar slot. It asks:

- **Keep scheduled slot:** the Job stays On Hold; the scheduled time stays visible; the Calendar clearly shows On Hold; capacity stays reserved because the contractor deliberately kept it.
- **Release scheduled slot:** the Job stays On Hold; the active schedule retires; capacity becomes available; the prior planned date stays as history; the Job needs a fresh scheduling decision when resumed.

If a retained On Hold date passes, the expired date is not treated as a current reservation forever. It is preserved as past planning history, and a fresh scheduling decision is required before the Job returns to active scheduled work.

Exact UI composition is not decided. Only the product behavior is locked.

### D4. Job manager / Site Manager

Contractor example: Mike is Site Manager on the Miller residence. Mike stays Site Manager until the contractor deliberately replaces him. If Mark takes over, Mark becomes the current Site Manager and stays so until changed again or the Job ends.

- The current Site Manager stays current until deliberately replaced while the Job is active.
- Complete does **not** automatically remove the Job manager. The manager can continue through closeout.
- When the Job becomes Closed or Lost, active responsibility ends.
- Terminal history preserves who the last Site Manager was.
- Normal FieldDive company access is **not** repeatedly created and removed per Job.

**SOFTWARE ACCESS != JOB RESPONSIBILITY.** A person's normal company access persists until the company changes or removes it. Job assignment tells FieldDive who is responsible for that Job. If a person's access is intentionally scoped to assigned/shared Jobs, the Job relationship may provide the scope or reason for seeing that Job, but ending the Job relationship must not erase unrelated company access.

Terminology: today this responsibility is stored as the Job Coordinator (`jobs.assigned_to`, written only by `set_job_coordinator_v1`) and labelled "Coordinator" in the UI. "Site Manager" / "Job manager" describe the same real-world responsibility. The final human-facing term is not decided, and authority must never be hard-coded to the visible word.

### Terminal business-story snapshot

A Lost or Closed Job preserves the story of where the Job stood when it ended, like a frozen business snapshot. It may preserve and display customer/property, scheduled or planned date, Site Manager at the time, Crew at the time, stage reached, proposal and agreement context, payments, photos, activity, terminal date and Lost reason. Those facts no longer behave as active operational commitments.

**TERMINAL JOBS PRESERVE THE LAST KNOWN BUSINESS STORY WITHOUT PRESERVING ACTIVE OPERATIONAL RESPONSIBILITY.**

Do not "clean up" a terminal Job by deleting the story. Do not leave the story behaving like live work.

### D5. Tasks / Attention

When lifecycle changes make work obsolete, FieldDive cleans it up. It does not mark work Completed if it did not happen.

| Outcome | Meaning |
|---|---|
| **Completed** | the work actually happened |
| **No longer applicable / retired** | the business changed and that work should no longer happen |
| **Still pending** | despite the lifecycle change, this is still a real obligation |

- Typical Lost retirements: schedule Crew, order remaining materials, start production, install roof, ordinary production reminders.
- May legitimately remain: refund deposit, return purchased materials, resolve a cancellation fee, a legitimate amount still owed, insurance/admin paperwork, customer dispute, chargeback or legal follow-up.
- Attention works the same way: "Proposal awaiting acceptance" retires on Lost; "Refund due" remains until resolved.
- Closed is not allowed while meaningful pending obligations remain (D2).

**FIELDIVE CLEANS UP OBSOLETE WORK; IT DOES NOT ERASE REAL OBLIGATIONS OR FAKE COMPLETION.**

### D6. Lost by mistake

Lost stays terminal in normal use. For **24 hours** after marking Lost, FieldDive may expose a small, quiet **"Lost by mistake"** action.

- It is not permanent Reopen. It exists for 24 hours only, then disappears, and the Job stays Lost.
- It corrects an erroneous Lost action by restoring the **known pre-Lost business state**. Previous state is never reconstructed from guesses.
- The correction is recorded in Activity/audit.
- A customer who genuinely returns later gets a new Job using known Customer/Property context.
- Relationship to the Phase 13C decision §7 ("reopening does not silently restore" assignments): Lost by mistake is an explicit, audited, time-bounded correction, not a silent reopen. Which ended commitments it restores comes only from recorded pre-Lost state and is defined in its implementation slice.

**LOST BY MISTAKE = CORRECTING AN INPUT ERROR. CUSTOMER CAME BACK = NEW BUSINESS EVENT + NEW JOB.**

Exact visual treatment is designed later.

### D7. Inactive People / Crews

For real People and Crews with meaningful historical participation that are no longer active:

- preserve their durable identity and history and mark them **Inactive**;
- optionally show simple active/inactive dates where useful;
- remove them from normal current assignment and member choices;
- keep historical Job and activity attribution truthful;
- do not add noisy labels such as "Past team member."

If the same real Person or Crew returns, reactivate the same durable identity. Do **not** automatically restore old Crew membership, old Site Manager/Coordinator assignments, old Job responsibilities, old schedules, old scoped Job access or any other stale operational relationship. Current relationships and access are deliberately set according to what is true now.

Erroneous or unused records with no meaningful business history may use a separate cleanup/delete path.

**INACTIVE PRESERVES IDENTITY AND HISTORY WITHOUT PRESERVING CURRENT OPERATIONS.**

Sequencing (D9): the People side applies now wherever access removal and Site Manager handoff need it. Crew Inactive/reactivation implementation is parked.

### D8. Offline / manual payments

A canonical manual/offline payment-recording workflow is **required before launch**. It will be deliberately planned and mapped before implementation. Expected methods include, as applicable: check, cash, ACH/bank transfer outside the integrated provider, and other legitimate offline receipt.

Future design must:

- use the **same** canonical Job payment truth, with no second offline ledger;
- preserve payment provenance and distinguish provider-processed money from manually recorded money;
- include audit, correction and reversal behavior;
- define permissions deliberately (consistent with the money rule in the controlling Phase 13C decision §5).

Exact UI and data contract are not decided. **THIS CAPABILITY MUST BE PLANNED/MAPPED AND DELIVERED BEFORE LAUNCH.**

### D9. Core flow before Team/Crew expansion (sequencing lock)

**FIELDIVE CORE OPERATING FLOW FIRST. TEAM/CREW LATER AS AN ADDITION TO A STABLE PRODUCT.**

**THE CORE CONTRACTOR WORKFLOW MUST FEEL COMPLETE BEFORE OPTIONAL OPERATING COMPLEXITY IS ADDED.** **DO NOT ADD AN OPERATING LAYER ON TOP OF A CORE PRODUCT THAT IS NOT YET DIALED IN.**

Team/People/Crew work is **PARKED / PRESERVED / DEFERRED FROM THE ACTIVE ROADMAP**. It is not cancelled.

- All Team/People/Crew research, product decisions, migrations, UI work and the uncommitted Crew Slice 1 stay preserved. The preservation inventory is in the global handoff ("Team/Crew preservation").
- Team/Crew is removed from the active launch-critical roadmap.
- None of the following continues:
  - new Team/Crew feature implementation
  - Crew UI expansion
  - Crew scheduling projections
  - Team-week, Board or Calendar Crew integration
  - Crew archive/reactivation work
  - Crew-lead workflow
  - Team-driven access complexity
- Still active, because the core app needs them:
  - company members, invitations and Owner custody
  - access removal
  - the Site Manager/Coordinator Job responsibility (D4)
  - the People side of D7 where access removal needs it
  - security fixes in shared Job logic, including Job logic the parked Crew work touches
- **Reactivation gate.** Reassess whether Team/Crew belongs in launch or ships later only once all of these hold:
  - the core contractor flow is stable;
  - the first real proposal flow is clear;
  - photos, measurements, proposals, scheduling and payments are dialed in;
  - lifecycle truth is coherent;
  - error, loading and retry behavior is honest;
  - desktop and mobile are cohesive;
  - a whole-app audit no longer exposes core-product instability;
  - launch readiness is near.

Future prompts must not resume Team/Crew implementation unless the roadmap is deliberately reactivated after that core-product readiness review. Earlier Team/Crew locks stay recorded and binding as architecture whenever that work resumes. Their implementation is deferred.

**DO NOT DELETE TEAM/CREW RESEARCH OR ARCHITECTURE. DO NOT USE TEAM/CREW AS THE ACTIVE PRODUCT CENTER UNTIL CORE APP READINESS IS REASSESSED.**

### D10. Measurement application (2026-10-04)

**MEASURE WHAT IS TRUE. QUOTE WHAT WORK WILL BE PERFORMED.**

- The detailed roofing measurement workflow is **not a universal prerequisite for every Job**.
  - Full reroof / quantity-driven work may require measurement-driven quantities.
  - Small repairs, fixed-price work, known scope/price and direct-quote paths may not.
- Today's detailed measurement readiness may remain as **temporary compatibility** with the reroof proposal flow. It must not be presented visually or architecturally as a universal Job requirement.
- Before Proposal Slice 4A or any missing-path work, reconcile the measurement model with direct/small-job proposal paths.
- Job next-action architecture must stay able to select a truthful action other than "Add measurement".
- This supersedes the earlier Core Flow 1 lean "keep the measurement required".
- Detail: `docs/fielddive-core-flow-1-target-contract.md` §9 "Measurement application" and §18 Decisions 1 and 5.

---

## 5. Other active architecture locks (pointers)

| Lock | Canonical source |
|---|---|
| PERSON != SOFTWARE USER; TITLE != AUTHORITY; CREW != SECURITY GROUP; JOB RESPONSIBILITY != TITLE; ASSIGNMENT != SCHEDULE != ACCESS; ACCESS FOLLOWS REAL WORK, NOT LABELS | execution standards → "People, titles and authority"; Phase 13C decision §§2–3 |
| COMPANY ACCESS != JOB RESPONSIBILITY (D4) | this index D4; execution standards → "Derived access lifecycle" |
| Team is the People + Crews operational home *(preserved; implementation parked under D9)* | handoff → "Team / People / Crew truths"; Phase 13C decision §6 |
| Calendar owns schedule truth; assignment is not a second schedule | execution standards → "Domain ownership"; Phase 13C decision §11 |
| Job Card owns deep Job work; domain tabs own truth; Overview summarizes | execution standards → "Domain ownership"; UI cohesion standard → "Information ownership" |
| Board is operational scanning, not duplicate domain authority | handoff 2026-09-25 Job Card / Job Board checkpoint; execution standards → "Domain ownership" |
| Durable Job → Crew assignment; one primary active Crew is a UI mode, not an invariant; closure ends active assignments and reopening does not restore them *(preserved; further implementation parked under D9)* | Phase 13C decision §§7, 14; handoff → "Job → Crew (authoritative)" |
| Deterministic pricing; AI does not invent pricing | handoff pricing sections (§6H–§6S); proposal generation contract |
| Payment truth separate from lifecycle truth; OPERATIONAL COMPLETION != FINANCIAL SETTLEMENT; Stripe handles money, FieldDive orchestrates product state | execution standards → "Domain ownership", "External providers"; Phase 13C decision §5 |
| ERROR != EMPTY; UNKNOWN != ZERO; FAILED != SUCCESS; DISABLED != NO ACCOUNT; PENDING INVITATION != MEMBERSHIP; DELIVERY != ACCESS AUTHORITY | execution standards → "Error and state truth"; UI cohesion standard → "Error, loading, and empty" |
| Tenancy: no cross-tenant association, read, write, reassignment or inference | execution standards → "Tenancy" |
| Derived access ends when its reason ends; independent reasons survive | execution standards → "Derived access lifecycle" |
| Proposal acceptance is not operational approval; permission never bypasses domain eligibility | execution standards → "Domain ownership" |
| Latest explicit controlling decision supersedes older assumptions; NEW DISCOVERY SUPERSEDES STALE ASSUMPTIONS; NEW PRODUCT DISCOVERY IS CROSS-CUTTING UNTIL PROVEN OTHERWISE | this index §1; execution standards → "Product advancement and discovery reconciliation" |
| PRODUCT ADVANCEMENT LOOP; ROOFR PARITY IS A FLOOR, NOT A CEILING; challenge threshold; Major UI Product Advancement Gate | this index §3A; execution standards → "Product advancement and discovery reconciliation" |
| Measurement is not a universal Job prerequisite; current readiness is temporary compatibility | this index D10; Core Flow 1 target contract §9 |
| **PLAIN-LANGUAGE PRODUCT COPY** — THE CONTRACTOR SHOULD SEE WHAT SOMETHING MEANS, NOT HOW FIELDIVE IMPLEMENTS IT. No FieldDive/system/lifecycle narration. COPY IS CONTEXTUAL, NOT MINIMAL BY DEFAULT: keep a short plain consequence note when removing it could leave a contractor unsure about an important consequence; otherwise don't add one | execution standards → "Plain-language product copy"; audit playbook → "Plain-language copy audit" |

---

## 6. Current implementation status of these decisions

Recording D1–D8 changes no code. Current code still differs from them in several places (for example permanent Reopen for Lost, an optional Lost reason, and schedules and Coordinator state that survive terminal transitions). Those differences are tracked in the global handoff's correction program, not here. Do not cite current behavior as evidence against a settled decision.

D9 sets the order of work. The active roadmap is core-app-first and lives in the global handoff's current checkpoint, along with the active correction ledger of non-Team audit findings.

D10 changes no code. The current measurement readiness and its Slice 1 presentation are temporary compatibility.

**Core Flow 1 Slice 1 (2026-10-04):**
- The truth/reliability **direction** is accepted for continuation.
- The current implementation remains **pending independent code/scope review** (uncommitted).
- Its visible error/validation presentation is **not** accepted as final FieldDive UI.
- **DO NOT treat the current Slice 1 screenshots as visual baselines.**
- Visual debt list: target contract §20 Slice 1 "Status"; handoff 2026-10-04 governance update.

## 7. Canonical governance documents

- `docs/fielddive-product-execution-standards.md` — how work is done, including the Real-World Workflow Reasoning Method.
- `docs/fielddive-ui-product-cohesion-standard.md` — mandatory for any visible UI.
- `docs/fielddive-audit-playbook.md` — audit method, including the real-world contractor scenario audit.
- `docs/fielddive-global-handoff.md` — current checkpoint, program sequence and correction order.
- `docs/phase13c-people-crew-access-product-architecture-decision.md` — controlling People / Crew / access decision (D4 and D7 extend it; they do not contradict it). Preserved. Its Team/Crew implementation is parked under D9, and its access and tenancy principles stay binding.
- `docs/fielddive-release-discipline.md` — release and environment isolation.
