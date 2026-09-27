# Phase 13 - Company Access & User Onboarding Foundation
## Astra Architecture & Broad Research Report - Version 2

- Date: 2026-09-27
- Repo HEAD reviewed: `752e25b1a54b19dc0d808bd02d225cb2654df39c`
- Version 1: [Preserved architecture report](phase13-company-access-user-onboarding-astra-architecture.md)
- Implementation performed: **NO**
- Database changes: **NO**
- Production changes: **NO**
- Product code, migrations, tests, packages, and handoff changes: **NONE**
- Commit, push, deployment, server management: **NONE**
- Research breadth: **12 benchmark products/systems**, plus Supabase as a technical enforcement reference.
- Status: Recommended architecture, not authorization to implement new product behavior.

POWER LIVES UNDER THE HOOD. CLARITY LIVES IN THE INTERFACE.

FieldDive should know more than it shows.

Do not simplify internal capability merely to simplify the interface. Sophisticated does not mean overengineered. Use the simplest durable model that supports strong defaults, granular authority, contextual scopes, sparse exceptions, delegation ceilings, auditability, and expansion without replacement.

## A. Broad research summary

Version 1 gets the basic shape right: company tenancy, authoritative membership, strong defaults, sparse exceptions, explicit joining, and database enforcement. Broader research does not justify replacing it with an enterprise role designer.

It does justify several substantial corrections:

1. Field access should not default to the whole company's operational data. A real assigned-job scope is a launch requirement before ordinary crew access is promoted as restricted.
2. Ownership is account custody as well as a powerful permission profile. Those concepts must be separate internally even if the UI says Owner.
3. Admin should be operationally broad, but company-wide financial reporting should be an explicit grant. Payment collection, full ledger visibility, cost visibility, and refunds are different authorities.
4. Permission to administer a bounded access package is not the same as permission to personally consume all its data. V1's strict personal-permission subset rule is safe but unnecessarily couples staffing to data visibility.
5. Restrictions, dependencies, scopes, role-version changes, and temporary grants need precise semantics. A simple union of capability names is insufficient.
6. Disablement must never wait for reassignment success. Security revocation and operational handoff need separate success states.
7. A one-company-per-user invariant currently includes disabled memberships. That is stronger than 'one active company' and requires an honest conflict/recovery path.
8. Strong sensitive-action authentication and explainable access-change previews belong in the foundation, not a future security console.

The target is a small deterministic authorization engine, not a general-purpose policy language. A contractor selects a role and occasionally a named access package. The system resolves the details.

### Method and limits

Research used official product/help documentation, including field-service and construction systems, not only collaboration products. Sources are identified in section B and the Research Sources appendix. Benchmark claims are documentation-level evidence, not independent penetration tests or hands-on validation of those vendors.

Repository checks covered the saved V1 report, handoff checkpoint, current role/session/membership code, secure bootstrap migration, responsibility schema, members API, and relevant baseline policies. HEAD is unchanged from V1. Production deployment, auth settings, RLS execution, invitation delivery, and browser behavior were not tested. No new screenshots or tests were created.

The pre-existing untracked V1 report is preserved. Its starting SHA-256 was `07CBC673A6FCEA217F7BAA6AB16F8BCB19550C6307A403DF58F10D8F514C091C`.

## B. Products / systems studied

Each conclusion below distinguishes documented behavior from FieldDive's proposed adaptation. No unsupported claim of complete benchmark parity is intended.

### 1. Jobber - field-service defaults and dependencies

Jobber documents crew-oriented presets, per-user customization, own-versus-all schedule access, and separate pricing/cost visibility. Some permissions have prerequisites, including payment access. Its documentation also acknowledges that updated presets can differ from existing users' retained permissions. [J1]

**Adapt:** role defaults, assigned-work visibility, cost separation, and explicit dependency handling. **Reject:** making contractors troubleshoot a web of low-level prerequisite toggles. FieldDive should show the complete access consequence as one meaningful package.

### 2. ServiceTitan - employee/technician separation

ServiceTitan documents role defaults with individual customization, technician access limited to assigned customers/jobs, and sensitive permissions associated with MFA. Applying role updates to existing technicians can replace individual customization. [ST1]

**Adapt:** field scopes and sensitive-action authentication. **Differ:** never silently discard FieldDive restrictions or grants when a role changes. No need to copy the full office/technician role catalog.

### 3. Housecall Pro - field and financial separation, with a caution

Housecall Pro documents Admin/Owner, Office Staff, and Field Tech roles with individual permissions. Its guidance warns that broadening a field worker to Office Staff for schedule access also exposes broader job/pricing abilities; employee pay visibility is separately configurable for Office Staff. [HC1]

**Adapt:** office/field distinction and sensitive-data controls. **Reject:** role promotion as the only way to grant a narrow operational ability. FieldDive should grant schedule visibility without granting price editing.

### 4. Procore - authority and project scope are different axes

Procore uses company/project permission templates, including global and project-specific templates, tool-level levels, and granular permissions. [P1]

**Adapt:** resource scope independent of action authority. **Reject for launch:** template designers per project and a full tool-by-tool configuration matrix. A roofer should not build an ACL template to send a crew to one roof.

### 5. HubSpot - record scope and bounded delegation

HubSpot separates record permissions into all, team-owned, and owned records; unassigned records require explicit consideration. Reusable permission sets support standardized access. Assigners are limited to sets containing permissions they themselves have; set assignment can override individual settings. [H1, H2]

**Adapt:** scope-aware actions and reusable access packages. **Differ:** FieldDive should preserve explicit restrictions through deliberate review and separate administrative delegation from data use within a tightly controlled ceiling.

### 6. Slack - account custody

Slack distinguishes Primary Owner, Owners, Admins, and other bounded roles. Certain custody actions remain with the Primary Owner. [SL1]

**Adapt:** a unique custody anchor and dedicated transfer. **Defer:** multiple FieldDive Owners until business demand warrants another ownership tier. Do not add a guest concept without resource enforcement.

### 7. Linear - suspension with attribution

Linear distinguishes administrative and bounded responsibilities; suspended users lose access while their work remains attributable. [L1]

**Adopt:** access revocation without deleting the actor. **Adapt:** productive first-entry destinations rather than an administration tour. The destination recommendation is FieldDive product reasoning, not a claim about Linear onboarding.

### 8. Stripe - financial platform ownership

Stripe's documented ownership transfer targets an eligible administrative user who has accepted access. Unavailable-owner cases use support recovery. [S1]

**Adapt:** accepted membership before transfer, explicit custody operations, and verified recovery. Do not interpret routine team administration as refund or payout authority.

### 9. Notion - resource sharing and inheritance pitfalls

Notion documents resource-level sharing and a broadest-access-wins rule across overlapping grants. Its member/guest distinction provides limited collaboration without whole-workspace membership. [N1, N2]

**Adapt:** an eventual external membership class with bounded resources. **Reject for FieldDive restrictions:** an unrelated broad grant silently defeating a deliberate deny. Never convert an external user into an internal employee based on email domain.

### 10. Asana - offboarding is also work continuity

Asana documents that removing a member leaves created work intact while assigned tasks become unassigned, and recommends reassignment. [A1]

**Adapt:** offboarding must expose unfinished work. **Differ:** revoke access first; then make handoff a visible recoverable operation. Do not rewrite completed-job responsibility.

### 11. Google Workspace - resilience against administrator loss

Google recommends multiple separately held super-admin accounts for resilience, limited use of those accounts, and stronger administrator authentication. It also distinguishes suspension from deletion. [G1, G2]

**Adapt:** recovery readiness and avoidance of a single operational administrator. **Differ:** FieldDive can retain one custody Owner while allowing several bounded Admins. Google is a counterexample to treating sole ownership as sufficient resilience.

### 12. Microsoft Entra - time, approval, and delegation scope

Microsoft Entra PIM documents time-limited and approval-based privileged activation. Administrative units demonstrate scoped administrative authority. [M1, M2]

**Adapt:** time and delegation scope as authorization inputs. **Defer:** activation dashboards, directory hierarchies, and enterprise identity governance workflows. Temporary grants can later be a simple 'Until Friday' control.

### Technical reference: Supabase

Supabase documents JWT/session lifetime behavior and that strong post-sign-out guarantees require more than assuming a token became invalid immediately. [SB1]

**Apply:** live membership checks for tenant access; session freshness checks for sensitive actions. Database enforcement is required independently of client navigation and JWT role snapshots.

## C. Cross-product patterns

### Strong recurring patterns

- Defaults reduce setup; exceptions prevent role explosion. Jobber, ServiceTitan, and HubSpot support this conclusion.
- Scope and action are separate dimensions. Procore, HubSpot, and field-service technician models show why.
- Financial information is not one indivisible permission. Pricing, cost, reporting, and collection differ operationally.
- Offboarding must preserve work and identity while ending access. Linear, Asana, and Google support this separation.
- Administrative continuity needs more than a single powerful login. Slack, Stripe, and Google use different mechanisms, but all require explicit custody/recovery design.
- Advanced privilege can be bounded by time and scope rather than by inventing more roles.

### Category-specific patterns

- Field-service: assigned jobs, phone-first use, customer address/access details, price hiding.
- Construction: project-scoped collaboration across employers.
- CRM: ownership/team record scopes and pipeline responsibilities.
- Financial platforms: money-moving and account-custody operations merit distinct controls.
- Productivity suites: broad sharing is useful, but its inheritance rules can be wrong for contractor financial restrictions.

### Patterns creating excessive burden

- Hundreds of visible permission switches.
- Per-project permission-template administration for routine crew work.
- Requiring elevated roles to solve one narrow visibility problem.
- Silent preset upgrades that expand privileges.
- Making every temporary need a new custom role.

### Most useful for a 2-8 or 28-person roofing company

Role defaults, assigned field access, operational managers without costs, request-payment without refund, safe staff removal, a backup operational Admin, and short access summaries deliver most of the value. These do not require an enterprise administration UI.

## D. Patterns rejected for FieldDive

1. Owner/Admin as one indistinguishable authority class.
2. Company-wide Field access merely because it is easier to implement.
3. Broadest-grant-wins over explicit restrictions.
4. Joining by known company ID or matching email domain.
5. Automatic business creation after any successful authentication.
6. Enterprise role designers and arbitrary policy expressions at launch.
7. Broad financial access bundled into office administration.
8. 'Remove user' that deletes attribution or delays revocation until work is reassigned.
9. Treating hidden tabs, search filters, or seats as security boundaries.
10. A copilot service key that bypasses the acting person's rights.

## E. Version 1 - what holds up

| V1 recommendation | V2 conclusion |
|---|---|
| Company is tenant; secure Slice 0A bootstrap | Preserve without weakening uniqueness or transaction authority |
| Five recognizable roles | Preserve, clarify Production Lead's scope and Owner's two meanings |
| Role defaults plus sparse grants/restrictions | Preserve; define scope, dependency, and revision semantics |
| Create versus join separation | Preserve; add controlled-access admission and invitation precedence safeguards |
| Pending invitation separate from membership | Preserve |
| Seven-day invite expiry | Preserve as a reasonable FieldDive default, not a benchmark mandate |
| One-company-per-user | Preserve current invariant; explicitly expose its disabled-membership consequence |
| One active/disabled membership state | Preserve; separate operational handoff and later termination/mobility design |
| Database/RPC enforcement | Preserve and make authority computation concrete |
| Quiet audit truth | Preserve; distinguish actor, grant authority, and executor |
| Simple Team UI | Preserve list; strengthen review in member detail |
| Role-aware first entry | Preserve using effective capabilities and scopes, not role name alone |

## F. Version 1 - what should change

| Topic | V1 weakness | V2 recommendation and impact |
|---|---|---|
| Field visibility | All operational jobs by default | Scoped Field membership; requires a bounded job-access relation, not repurposing production-lead assignment |
| Owner | Custody and role defaults blended | One custody anchor plus explicit owner profile; no wildcard bypass of tenant/business constraints |
| Admin money | Ledger/requesting default too broad | Operational Admin without company financials; grant collection and financial reporting separately |
| Production Lead | Full customer/property management too broad | Read job-linked customer context, manage execution; identity editing is not required by default |
| Delegation | Must personally possess every delegated capability | Separate can-use from can-assign; allow only Owner-approved standard packages within a fixed ceiling |
| Overrides | Dependencies and old grants underspecified | Explicit deny precedence, dependency validation, non-escalating role changes, policy revisions |
| Removal | Transactional handoff could block revocation | Disable and audit first; independently recoverable handoff |
| Owner resilience | Support recovery mentioned but not operationalized | Backup Admin for daily continuity, strong-auth recovery plan, no automatic ownership claim |
| Capability grouping | Write conflates capture/authority; money read too coarse | Separate measurement capture/selection, payment summary/history/company finance, scope drafting/issuing |
| Invite delivery | Hash-only token storage leaves delivery retry unspecified | Secure short-lived delivery envelope, no raw token in general records/logs, explicit resend semantics |
| Role evolution | Future defaults could silently expand access | Versioned profiles, reviewed privilege increases, fail-closed unknown capabilities |
| Account mobility | 'One company' sounds like one active membership | Existing uniqueness spans disabled records; no automatic cross-company joining |

These are recommendations. Scoped Field access and changed defaults are material product behavior requiring acceptance before implementation. No accepted business truth has been changed by this report.

## G. Final FieldDive access principles

1. Company is the tenant; identity is global; membership is tenant authority.
2. Authentication is not membership and no membership is not permission to create a company.
3. Authority answers: who, which company, what action, which resource, what fields, under what conditions, and until when?
4. One base role plus sparse exceptions; no stacking unrelated roles to form accidental superusers.
5. Account custody is explicit and recoverable.
6. Scope never expands because a user learned a URL or ID.
7. Explicit restrictions survive unrelated grants.
8. Delegation is a separately controlled power.
9. Capability checks do not replace lifecycle, pricing, payment, or acceptance invariants.
10. Deny on unknown role, missing scope, stale authority, or failed authorization read.
11. Strong defaults should handle ordinary staffing without manual permission design.
12. Removal ends access, not history.
13. UI clarity must not be purchased by weakening enforcement.

## H. Final canonical role model

### Owner

One active custody holder identified by `companies.owner_user_id`, with a corresponding Owner membership profile. This person controls ownership transfer, recovery-sensitive changes, and elevated authority assignment.

Owner is both a displayed archetype and a custody status, but these are distinct concepts internally. Owner does not bypass tenant boundaries, accepted-contract immutability, payment rules, or required authentication assurance. No unknown future capability is granted by a wildcard.

### Admin

Office/operations manager. Broad operational coordination, routine company details, ordinary staffing, proposal work and operational approval. No default internal costs, company financial reports, refunds, payout configuration, or exceptional pricing authority.

### Sales

Estimator/salesperson: customer/job preparation, measurements, proposal drafting and sending within established business rules. Operational approval, collections, and exceptional contractual authority are separate grants.

### Production Lead

Production manager/lead coordinating scheduling, task assignment, work start/completion, and responsibility. The role description must say it covers company-wide production coordination. A foreman leading one crew should normally be Field with a scoped 'Lead assigned work' package, not promoted to company-wide production management.

### Field

Authenticated employee doing work on explicitly accessible jobs. Capture measurements/photos/notes, see safe work instructions and job-linked contact details, and complete permitted assigned tasks. No general customer directory, financial workspace, pricing administration, or whole-company schedule by default.

### Questions resolved

- **Sales Manager:** no sixth role now. Sales plus explicit approval/visibility packages handles current needs. Add a role only if repeated exceptions reveal a stable distinct job.
- **Field versus Production:** keep separate. Performing work and coordinating all work are materially different.
- **Multiple owner-equivalent principals:** Admin plus explicit financial/commercial powers, without custody transfer rights. Multiple application Owners remain a valid later model, not implicit today.
- **Crew workers:** Field users use the same auth/membership engine. A worker who never signs in is a workforce/assignment record, not a shared login or pending membership.
- **Subcontractors:** future external membership kind with a narrower scope ceiling; not simply a normal Field employee with a different label.

## I. Final capability model

Represent action permissions separately from resource scope and information exposure. Do not create `jobs.view_all` and `jobs.view_assigned` as independent powers that can drift; prefer `jobs.read` evaluated against an authorized scope.

### Proposed registry

| Domain | Capabilities | Boundary |
|---|---|---|
| Customer/property | `customers.read`, `customers.manage` | Job-linked limited contact projection is not full directory access |
| Jobs | `jobs.read`, `jobs.manage`, `jobs.assign`, `jobs.approve`, `jobs.progress`, `jobs.hold`, `jobs.finalize` | Editing identity is not stage mutation or hard deletion |
| Measurements | `measurements.capture`, `measurements.select` | Capturing data is distinct from selecting the current proposal measurement |
| Photos/field notes | `photos.contribute`, `field_notes.contribute` | Contribution does not grant unrestricted deletion or all internal notes |
| Tasks | `tasks.read`, `tasks.complete`, `tasks.manage` | Assignment and completion scopes are distinct |
| Schedule | `schedule.read`, `schedule.manage` | Read visibility must not require price-edit authority |
| Proposals | `proposals.read`, `proposals.write`, `proposals.send` | Safe authorized-work read is not proposal financial read |
| Scope changes | `scope_changes.write`, `scope_changes.issue` | Draft preparation is not customer-facing contractual issuance |
| Commercial configuration | `pricing.manage`, `pricing.cost.read`, `templates.manage` | Cost, prices, and template terms are separate sensitivities |
| Payments | `payments.summary.read`, `payments.history.read`, `payments.request`, `payments.record`, `payments.refund`, `payments.configure` | Job collection, ledger history, and money movement are not one authority |
| Company finance | `company_financials.read` | Aggregate revenue/balance reporting; does not imply costs/margins |
| Administration | `company.manage`, `team.manage`, `access.delegate_sensitive`, `billing.manage`, `data.export` | Delegation and use evaluated separately; export remains bounded |

This vocabulary supports current domains, but a capability becomes enabled only where its operation/projection is implemented and tested. Do not add placeholder UI for absent features.

`discounts.approve`, approval thresholds, and additional reporting capabilities are future entries only when an actual workflow exists. Price editing is not discount approval. No arbitrary formula/policy language is needed.

Information categories are explicit: operational field brief; selling prices/proposal; payment collection summary; payment history; company financial totals; internal costs/margins; access-administration metadata. The same row or JSON object may contain more than one category, requiring a safe projection rather than a single row-level allow.

## J. Final role defaults

O = Owner; A = Admin; S = Sales; P = Production Lead; F = Field. 'Grant' means not default, available only through an authorized supported exception.

| Ability | O | A | S | P | F |
|---|---|---|---|---|---|
| Operational job scope | Company | Company | Company | Company | Explicit jobs |
| Full customer/property directory management | Yes | Yes | Yes | Grant | No |
| Job-linked safe contact/work brief | Yes | Yes | Yes | Yes | Scoped |
| Create/edit job identity | Yes | Yes | Yes | Grant | No |
| Capture measurements/photos | Yes | Yes | Yes | Yes | Scoped |
| Select current measurement | Yes | Yes | Yes | Grant | No |
| Read schedule | Company | Company | Company | Company | Scoped |
| Manage schedule/responsibility | Yes | Yes | Grant | Yes | Grant, scoped |
| Complete own assigned tasks | Yes | Yes | Yes | Yes | Scoped |
| Manage team tasks | Yes | Yes | Grant | Yes | Grant, scoped |
| Start/complete eligible work | Yes | Yes | Grant | Yes | Grant, scoped |
| Hold/resume | Yes | Yes | Grant | Yes | No |
| Finalize lost/closed/reopen disposition | Yes | Yes | Grant | No | No |
| Draft/read/send proposals | Yes | Yes | Yes | No | No |
| Operationally approve accepted work | Yes | Yes | Grant | Grant | No |
| Draft scope change | Yes | Yes | Yes | Grant | No |
| Issue contractual scope change | Yes | Grant | Grant | No | No |
| Request payment with necessary job summary | Yes | Grant | Grant | No | No |
| Payment history/company financial totals | Yes | Grant | Grant | No | No |
| Internal costs/margins | Yes | Grant | Grant | No | No |
| Pricing/template policy management | Yes | Grant | Grant | No | No |
| Record financial adjustment/refund | Yes | Grant | No | No | No |
| Routine company settings | Yes | Yes | No | No | No |
| Ordinary team administration | Yes | Bounded | No | No | No |
| Delegate sensitive privileges | Yes | Explicit bounded mandate | No | No | No |

Owner initially holds all supported ordinary powers plus custody operations; registry additions still require review. Admin's financial grants are independent: 'View company financials' does not secretly include labor costs or refund authority.

Sales company-wide operational visibility is retained for now because the current repo does not establish a separate sales-ownership model. Do not use production-lead assignment as sales ownership. A future sales-team scope must be explicit.

## K. Final special-privilege model

### Defaults, grants, restrictions

Each member has a versioned base role and sparse exceptions. A rule identifies capability/package, effect, scope, and optional validity period. Ordinary UI packages map to several internal permissions where genuinely required.

Examples: Request payments; View company financials; View internal costs; Approve jobs; Coordinate production; Lead assigned work. Display prerequisites and consequences together.

### Deterministic rules

1. Deny wins for the same action/resource within its specified scope.
2. A company-wide deny cannot be bypassed by a job-specific grant.
3. A job-specific deny does not remove permission on unrelated jobs.
4. Inherited role defaults are not copied into hundreds of member rows.
5. Dependency requirements are validated as a directed acyclic graph or equivalent fixed registry metadata; cycles fail validation.
6. Granting a dependent action proposes the minimal prerequisite bundle in the same reviewed mutation. It never silently clears a restriction.
7. Removing a prerequisite makes dependent actions unavailable; the editor explains the resulting change before save.
8. No write implies unrestricted read, no scope grant implies new action authority, and no export grant broadens data visibility.

### Role changes

Preview the effective before/after access. Retain restrictions by default. Revalidate grants against the new role, scope ceiling, and delegator mandate. Incompatible grants are suspended/removed explicitly, not hidden and later revived. Sensitive grants require affirmative retention. Store expected policy revision to reject stale concurrent edits.

### Role evolution

Version built-in profiles. Bug/security restrictions may roll out with audit/release explanation; increases in sensitive authority require an explicit migration/approval policy, never an accidental default caused by new code. Unknown registry entries deny.

### Time limits and custom roles

The rule evaluator accepts time bounds from the beginning; expiration must be checked on access, not solely by a cleanup job. Do not offer temporary grants until issuance, expiry, session/cache behavior, and audit are tested. Future custom roles reuse the same registry and ceiling; no arbitrary scripts or multi-parent role inheritance.

## L. High-risk authority model

| Action/data | Default/exception | Additional boundary |
|---|---|---|
| Ownership transfer | Custody Owner only | Dedicated two-party intent/confirmation flow, recent strong authentication, atomic transfer |
| Company deletion | Custody Owner only if feature exists | Dedicated retention/export consequences; no new deletion feature in this phase |
| Add/change Admin | Owner | Not a normal Admin delegation option |
| Ordinary staffing | Owner/Admin | Approved roles/packages and target ceilings |
| Sensitive privilege assignment | Owner; explicitly mandated Admin only | Nonrecursive mandate, no self/peer elevation |
| Internal costs | Explicit except Owner | Server projections and derived values must honor restriction |
| Pricing/template rules | Explicit except Owner | Contract terms and costs reviewed separately; no accepted-truth rewrite |
| Proposal send | Owner/Admin/Sales | Existing readiness/freeze/idempotency; no automatic discount override |
| Operational approval | Owner/Admin; explicit suitable grant | Accepted is not approved; existing eligibility remains |
| Payment requests | Explicit except Owner | Minimum job balance/request context, no refund or payout rights |
| Payment history/company financials | Explicit except Owner | Separate from cost and labor-rate access |
| Refund/manual ledger changes | Owner or explicit trusted Admin | Existing money rules, strong authentication, audit and idempotency |
| Payment-provider/payout configuration | Owner initially | Dedicated sensitive operation; never routine branding settings |
| Subscription billing | Owner default; explicit trusted Admin grant | No implication of payout or ownership authority |
| Export | Explicit | Scope and field filters survive export; async execution rechecks authority |
| Contractual scope issuance | Owner or explicit approved user | Existing customer acceptance required where applicable |
| Destructive operations | Dedicated authority | Never inferred from manage/edit permissions |

Require MFA-capable strong authentication for custody and sensitive access/money operations. Ordinary field reads must not repeatedly demand a challenge. Exact assurance window and recovery UX need implementation design; a generic confirmation modal is not reauthentication.

## M. Owner / Admin / delegation model

### Separate three powers

- **Use:** perform an operation or see data.
- **Delegate:** assign an approved package to an eligible target within a scope ceiling.
- **Custody:** transfer account control and authorize the highest-risk delegation boundaries.

An Admin can assign standard Sales/Production/Field roles without seeing internal costs. A custom mandate can let a trusted Admin administer a specific financial package without receiving its data-use power. This is intentional, not a broad bypass: delegation has its own named package ceiling, target classes, scope, expiry, and authorizer.

Initial ordinary Admin delegation excludes Owner/Admin promotion, financial/cost exceptions, payout access, exports, and delegation itself. Default users cannot delegate. Sensitive delegation requires an Owner-issued mandate; mandates cannot mint other mandates.

Admin cannot change their own rights, the Owner, peer Admins, or an elevated target's protected rights. An Admin can perform ordinary operational assignment without altering those access rights. Removal of a member holding protected authority requires Owner or an explicitly authorized security mandate, not incidental staffing permission.

### Ownership continuity

Keep one custody Owner. Encourage an additional operational Admin when a business has another trusted person, but do not force a two-person requirement on a sole proprietor. An unavailable Owner uses documented verified recovery with business evidence, notifications, audit, and no automatic domain-based claim.

Transfer to an existing verified active member only. Prefer target acknowledgment before the final Owner-authorized transfer; the final transaction updates the custody pointer and both profiles together. Former Owner becomes Admin under explicitly reviewed exceptions. Pending transfer expires/revokes independently and grants nothing by itself.

Multiple Owners are a valid future alternative if partnerships demand equal custody. They are not necessary for multiple trusted operational/financial principals now.

## N. Invitation / join model

Invitation states: pending, accepted, revoked; expiry is a deadline-derived terminal condition for acceptance. Delivery status is separate. Membership states: active, disabled.

Recommended expiry remains seven days. It is a product default, not a universal researched standard. Do not make ordinary contractors configure it.

### Issue

- Authorized actor selects email, role, optional access packages, and scope where needed.
- Server validates the entire effective proposed access and delegation ceiling.
- Deduplicate pending invitations by company and canonical auth-compatible email identity.
- Same idempotency key and same payload returns the original result; changed payload conflicts instead of silently editing authority.
- Recipient does not select company IDs or their own role.

### Delivery and resend

- Store token hash, expiry, issuer, proposed access revision, and recipient identity binding.
- Deliver through a durable post-commit intent; never hold an access transaction open for an email provider.
- If delivery retry needs the token, use a tightly scoped encrypted short-lived delivery envelope, inaccessible to ordinary database clients and scrubbed after use/expiry. Hash-only authority storage is not a delivery queue.
- Explicit resend rotates the token and increments invitation generation. Old links stop working. Retries of the same resend do not rotate repeatedly.
- Do not log raw tokens, use them in analytics/referrers, or display them in the Team list.

### Accept

- GET renders a safe invitation view; only authenticated explicit POST accepts. Scanners cannot join.
- Require verified recipient email from auth authority, not editable profile email or metadata.
- No domain autojoin or alias guessing. Wrong account gets a clear account-switch route.
- Validate token generation, expiry, invitation revision, issuing authority, company state, and membership conflict.
- Acquire the same per-user lock/unique membership boundary as Slice 0A, plus invitation lock.
- Create the existing-company membership, mark accepted, and append audit atomically.
- Lost-response replay returns the established result to the same authorized identity; it never regrants an old role or reactivates a subsequently disabled member.

If issuer authority is gone or no longer covers the proposed access, require reauthorization. Reauthorization can preserve the invitation identity but issues a new reviewed generation. Once accepted, membership is company authority and does not depend on the inviter retaining employment.

Multiple pending invitations to different companies are possible before membership. The user explicitly chooses; the first accepted valid membership wins the uniqueness race. Other invitations cannot silently move the account.

## O. Create-business model

Authentication has separate outcomes: active member, disabled member, pending invitation, authorized business creator, no access, or unavailable/error.

Create business requires explicit user intent and server-controlled eligibility. A query string, client checkbox, profile field, or absence of membership is not eligibility. A pending invite must be surfaced before creation; it must not be lost during confirmation/password recovery or generic sign-in.

During controlled access, recommend a separate creator admission record/invitation, consumed by the bootstrap transaction. Team invites cannot mint creator eligibility. A malicious third-party invite must not permanently veto a legitimately admitted creator: provide explicit decline/resolution without automatic creation.

Preserve Slice 0A's company+Owner atomicity, advisory locking, uniqueness, and existing/removed/created meaning. Extend the admission check on the authoritative operation, including direct RPC calls. A hidden create button is insufficient.

Replays after membership creation return that membership. A read failure renders recovery, not an empty identity state. Auth success without membership is a valid temporary state.

## P. Removal / disablement model

Use active/disabled for current access. 'Remove access' is the UI action; deletion and archival are not synonyms for authorization revocation.

### Disablement sequence

1. Authorize target, lock/revalidate membership, disable it, advance revision, cancel pending delegated invitations as policy requires, and append audit.
2. Commit revocation without depending on task/job reassignment.
3. Revoke relevant sessions as defense-in-depth and invalidate caches.
4. Offer/retry operational handoff separately with explicit pending/failed/succeeded status.

No failure in step 4 restores step 1. Company work remains visible to authorized coworkers. Historical attribution is immutable; completed jobs are not reassigned by bulk offboarding.

### Sessions, files, and return

Live membership and scope checks block subsequent authorized data access even with an old JWT. Sensitive actions also validate session assurance/freshness. Supabase session behavior is a reason not to rely on sign-out alone. [SB1]

Previously downloaded information cannot be recalled. Signed URLs need bounded lifetimes; sensitive files may require an access-gated fetch. Client/offline caches should be cleared on detected revocation, but this is not a guarantee against retained copies. Realtime and background exports require explicit revocation coverage.

Reactivation requires review. Expired grants stay expired; old sensitive grants are not silently restored. New sessions must not resurrect disabled memberships.

### Leaving and the one-company constraint

Non-Owner self-departure can use the same disable semantics, subject to an explicit future UI decision; it must not delete authorship. Owner transfers custody first. Under today's unique `user_id` membership invariant, disabled membership still blocks another-company joining. Explain this honestly and provide a support route; do not recommend a second identity as the normal workaround.

Portable employment across companies requires a separately approved membership-history transition model. No automatic migration, deletion of the old row, or weakening of uniqueness is authorized here.

## Q. Effective-permission engine

Canonical input: verified subject, company, active membership and revision, versioned role, applicable rules, resource facts, current database time, authentication assurance, and operation-specific business state.

Conceptual result:

`allowed = active_same_tenant AND supported_capability AND scoped_allow AND NOT applicable_deny AND dependencies_satisfied AND assurance_satisfied AND domain_eligible`

The result can include safe reason codes and an internal explanation of the rule/profile supplying authority. A boolean alone is inadequate for debugging and UI recovery, but clients never receive protected policy internals or unrelated resource existence.

Scope examples: company, explicit job access, own task, and future branch. Use typed scope kinds, not arbitrary JSON expressions. A job read does not traverse every other job at the same customer/property.

For listing/search/counts, apply scope predicates before pagination/aggregation. Filtering after loading all rows leaks counts and produces broken pagination. The same restriction follows downloads, notifications, calendar feeds, reports, and AI retrieval.

Separate `canUse` from `canDelegate`; validate resulting target access against package, scope, target, and privilege ceilings. A grant without dependencies is rejected, not partially saved.

Use database time for expiry. Cache within a request where safe; persistent caches include policy/scope revisions and have a proven invalidation strategy. Sensitive authorization is rechecked transactionally, not trusted from page-load state.

## R. Enforcement layers

### Canonical policy ownership

Database membership, overrides, scope relations, and custody are authority. Keep a reviewed versioned registry and profile definitions materialized in the database for direct-data/RPC checks; generate or parity-test TypeScript names and labels. Do not maintain two hand-written effective-permission algorithms.

### UI and routes

Navigation is a projection of effective access. Hide irrelevant domains; disable only recoverable prerequisites or informative requests for access. Direct routes resolve authority before loading protected content. Authorization unavailable is not zero/empty.

### Server/API/domain service

Authenticate, derive company, resolve capability and resource, apply business eligibility, then perform the operation. Do not accept caller-supplied actor authority. Shared domain services own operation-level rules; individual buttons do not.

### RPC/transactions

Access mutations, ownership transfer, invitation acceptance, and sensitive money operations revalidate inside a transaction. Use consistent lock order and idempotency keys. Prevent time-of-check/time-of-use escalation when role change, disablement, assignment, and sensitive mutation race.

### RLS/direct data

Every exposed path independently enforces active membership and relevant scope/capability. Use safe projections for field briefs and money-restricted views; RLS cannot hide individual fields inside an otherwise accessible row. Audit views, storage policies, RPC grants, exports, nested JSON, token metadata, and service-role routes.

Avoid membership-policy recursion by using a narrowly scoped private authorization helper where required. Security-definer functions require safe search paths, explicit grants, and actor validation. A definer is not a generic fix for permission errors.

### Revocation ordering

Operations authorized before a disable transaction may finish according to a documented lock/commit boundary. After revocation commits, new authorizations fail. For high-risk writes, membership revision/locking must prevent a stale precheck from committing as if authority were current. Do not promise retroactive cancellation of already-committed effects.

Public customer tokens remain separate, narrowly scoped authority. Removing an employee does not invalidate the customer's accepted agreement or arbitrarily rotate public access tokens.

## S. Audit model

Append immutable access events in the same transaction as the access change. Record company, actor, subject, operation, before/after access, authority source, role/profile version, scope, timestamps, request ID, and reason for sensitive changes.

Events include invitation issue/resend/revoke/accept, role change, grant/restriction change, scope change, disable/reactivate, ownership transfer, and sensitive delegation mandate change. Time-bound rules retain their scheduled expiry; distinguish actual expiry from a later housekeeping event.

Delivery attempts are operational logs, not membership truth. Failed authorization attempts belong in bounded security/support telemetry, not a noisy contractor activity stream. Redact tokens, unnecessary personal data, and financial values from audit payloads.

Audit visibility is itself restricted. Retention and support access require an explicit policy. Append-only application permissions do not justify claims of tamper-proof compliance storage.

## T. Team UI

Keep the default list: Person, Role, Status. Add a quiet 'Special access' indicator only when exceptions exist. Pending invitations and disabled users have simple filters, not separate administration products.

Use a member drawer/detail for changes rather than autosaving a powerful role dropdown inline. It contains:

- Identity and current role description.
- Access scope in plain language, for example 'Assigned jobs'.
- Named special-access packages and restrictions, collapsed when unused.
- A short effective-access summary: 'Can send proposals. Cannot see internal costs.'
- Changes pending, then Save with before/after consequences.
- Appropriate resend/revoke/remove/restore actions.

Ordinary role selection needs no warning theater. Scope widening, financial access, sensitive grants, and removal show specific consequences. Ownership transfer is a separate protected operation. Concurrent stale edits require refresh/review rather than overwriting silently.

No giant matrix, no invented security dashboard, and no vague 'Full access' checkbox. A small 'Why this access?' explanation can expose the role/package source without teaching users the registry.

## U. First-run experience

- **Owner:** enter normal Jobs/activation flow; ask company details where needed for real proposal sending. No invitation path creates another company.
- **Admin:** normal operating surface; team access only if authorized, financial setup only if granted and relevant.
- **Sales:** Jobs/proposal preparation. Empty state explains the first useful job action.
- **Production Lead:** scheduled/active work in existing operating surfaces.
- **Field:** accessible assigned work; if none, 'No work assigned yet' and a useful company contact. No company creation or setup CTA.

Select destinations from effective capabilities, not role string alone. Respect a valid authorized resume destination; reject external/open redirects and unauthorized deep links. Joined users never install company-wide starter catalog/template data. Password recovery and email confirmation preserve the join context without accepting unverified access.

## V. Contractor-scenario test results

Counts below are access-policy choices beyond typing identity and confirming the invite; choosing individual work assignments remains normal operations, not recurring permissions administration.

| Scenario | Role and special access | Visible decisions | Precision/result |
|---|---|---|---|
| A. Two people: Owner + Sales/Field hybrid | Owner; Sales for hybrid, field capture already included; add Lead assigned work only if they run execution | 1 role; 0-1 package | No dual-role union. Sales visibility is explicitly broader than crew-only access |
| B. Four people: Owner, Sales, Production Lead, Field | Standard defaults; Field receives job access through approved assignment/access relationship | 3 role choices, no exceptions | Approval remains Owner; Sales sends; Production coordinates; Field sees only accessible work |
| C. Eight people: Owner, Admin, two Sales, Production Lead, three Field | Defaults; optionally give Admin Request payments if they collect | 7 role choices; 0-1 extra package | No custom roles; no financial power accidentally given to crew |
| D. Office manager must not see costs | Admin, no cost grant; optional collection package | 1 role; 0-1 package | Operational staffing and proposal work without internal costs |
| E. Salesperson requests payment, never refunds | Sales + Request payments | 1 role + 1 package | Minimal job collection context; refund/configuration/history not automatically granted |
| F. Production manager schedules, cannot alter pricing | Production Lead | 1 role | Scheduling does not imply pricing, proposals, or company financials |
| G. Trusted Admin sees financials | Admin + View company financials; add View internal costs only if actually intended | 1 role + 1-2 distinct grants | Revenue/balance access is not margin/labor-cost access or money movement |
| H. Temporary internal worker | Field with explicit job access and, when supported, expiry | Role + scope + optional end date | Time expires on authorization, not a reminder; no shared crew account |
| H2. External subcontractor | Future external membership kind, explicit job scope, narrower action ceiling | Type + role/package + jobs + optional end date | Not safe to claim support until cross-company identity and external data boundaries are designed |

### Twenty-eight-person stress case

One Owner, two operational Admins, six Sales, three Production Leads, and sixteen Field users still use the same archetypes. If several Sales need the same repeated package, a named internal package suffices before custom roles. Office staff can administer ordinary staffing without cost access. Crew membership/job-access assignment should be driven by existing operational context once authoritative; it must not require editing 16 independent capability matrices.

### Important limitation

These are architecture scenario results, not executed product tests. Current `jobs.assigned_to` represents one responsibility/lead and tasks have independent assignees. That is not a full crew-access relation. Do not pretend all sixteen Field users can be securely scoped today by reusing that one field. Section AA identifies the required bounded addition and decision gate.

## W. AI / copilot authority

Interactive copilot actions run on behalf of the authenticated human. The model does not receive a capability bearer that authorizes arbitrary API calls. Server tools reconstruct identity and check live membership, scope, fields, and operation eligibility on each execution.

- Retrieval, search, summaries, embeddings, and cached conversation context honor the same data scope.
- No cost or financial data is placed in a prompt merely because the output might hide it.
- Retrieved notes/documents are untrusted input and cannot grant authority or change tool policy.
- User confirmation is not sufficient authority; permission and business rules still apply.
- Sensitive sending, contractual changes, refunds, and privilege changes require the same human approval/assurance boundaries as manual actions.
- A queued action rechecks rights at execution; changed membership/amount/document revision invalidates stale approval.
- Audit records initiating human, assistant execution channel, approved intent, actual executor, and resulting domain operation.

Future autonomous automation may use a separately registered narrow service principal with explicit company-owned authority and audit. It must not masquerade as the human copilot or inherit an unrestricted service-role key. No autonomous service-authority feature is proposed for launch.

## X. Advanced capability extension points

| Capability | Initial architecture | Initial product scope |
|---|---|---|
| Dependency metadata | Required | Meaningful package previews, no matrix |
| Company/job action scopes | Required | Field job boundary before restricted crew rollout |
| Field/financial projections | Required | Protect existing domain data |
| Delegation ceilings | Required | Fixed ordinary ceiling; narrow sensitive mandate only if implemented fully |
| Expiring rules | Evaluator/data shape supported | UI deferred until expiration and revocation tested |
| Custom roles | Stable role IDs/profile versions | No role designer now |
| Branch/location scope | Typed scope extension | No branch hierarchy now |
| Sales-team scope | Separate future relation | Do not reuse production responsibility |
| External membership | Kind/ceiling conceptual extension | No external onboarding until one-company conflict is resolved |
| Approval thresholds | Contextual decision boundary | No invented discount approval workflow |
| AI authority | On-behalf-of contract | No broad service-agent rights |
| SSO/SCIM | Identity-independent membership | Future integration, not launch prerequisite |
| Workforce-only records | Separate from login identity | Future staffing need, not fake memberships |

Do not build arbitrary nested groups, policy scripting, a Zanzibar-style graph platform, or a custom identity provider. Relational membership, typed scopes, versioned profiles, sparse rules, and narrow transactions are sufficient.

## Y. Current repo gaps

### Reconfirmed source defects and incomplete foundations

| Evidence | Gap/consequence | Correction |
|---|---|---|
| `companyMembershipRoles.ts`: unknown/empty returns Owner | Fail-open authority | Explicit legacy mapping and fail-closed unknown role |
| Same file: `owner_admin` maps back to `owner` | Custody/admin confusion | Separate profiles and protect owner pointer consistency |
| `companyMembershipSession.ts`: missing role falls back to Owner | Second elevation fallback | Invalid membership state, no capability grant |
| `ensureUserIdentity.ts`: protected-page helper always calls bootstrap | Generic auth can create company | Explicit access resolver and creator admission |
| Slice 0A: unique membership by user, including removed rows | Disabled user cannot move companies automatically | Preserve invariant and truthful conflict/support path |
| Baseline policies: membership existence without active-state predicate | Removed user can retain direct tenant access where policies remain deployed | Inventory/harden tables, functions, views, storage; live verification required |
| Members persistence plus self-only membership/profile SELECT baseline | Intended team read/update path lacks complete database authority | Safe directory and owner-authorized transactional mutations |
| `removeCompanyMember`: disable then job/task updates, errors not propagated | Revocation/handoff outcome conflated | Keep revocation durable; track/report handoff failure |
| Assignment count queries ignore errors and use `count ?? 0` | Unknown handoff work appears zero | Typed loading/error/count result; never zero on failure |
| Job reassignment filters nondeleted jobs, not active lifecycle only | Historical responsibility can be rewritten | Explicit active-work handoff boundary |
| Team GET uses broad `customers_jobs`, returns member emails/counts | Expanding directory RLS could expose unnecessary admin data | Split assignment directory from access-management projection |

### New stress-test findings

1. **Restricted Field scope has no adequate crew relation in the reviewed responsibility foundation.** One lead and independent task assignees cannot safely stand in for job-team access. A task assignment must not accidentally reveal every customer job or private proposal.
2. **Directory hardening has a second-order privacy risk.** Fixing self-only SELECT by exposing all profile rows would also expose emails and access metadata to users who only need an assignee picker. Use minimal projections.
3. **Role-version changes need explicit migration semantics.** Current hard-coded preset sets do not record the access profile a member was approved under. New defaults could change everyone silently.
4. **Hash-only invitation design needs secure delivery retry mechanics.** V1 did not fully specify this. Do not resolve it by storing raw invitation tokens in a client-readable table.
5. **Public-token metadata is a separate sensitive read surface.** The baseline has company-scoped SELECT on `proposal_public_access_tokens`; records use hashes, not raw token disclosure. Do not overstate this as a demonstrated token-stealing exploit. Restrict unnecessary metadata while preserving legitimate public-token semantics.

### Relevant repository references

- [Handoff](fielddive-global-handoff.md) - top checkpoint predates secure bootstrap; current source governs.
- [Bootstrap migration](../supabase/migrations/20260925220856_secure_company_bootstrap_authority.sql)
- [Identity helper](../app/lib/ensureUserIdentity.ts)
- [Role profiles](../app/lib/companyMembershipRoles.ts)
- [Membership session](../app/lib/companyMembershipSession.ts)
- [Capability guard](../app/lib/requireCapabilitySession.ts)
- [Team persistence](../app/lib/companyMembershipPersistence.ts)
- [Members API](../app/api/company/members/route.ts)
- [Team UI](../app/tools/settings/CompanySettingsTeamEditor.tsx)
- [Responsibility migration](../supabase/migrations/20260923200000_phase7_responsibility_handoff.sql)
- [Responsibility persistence](../app/lib/jobResponsibilityPersistence.ts)
- [Baseline policies](../supabase/migrations/20260909130000_canonical_pre_recovery_baseline.sql)

No live exploit test or production policy comparison was performed. Slice 0A's arbitrary self-membership fix remains accepted; do not re-report it as unfixed. Existing public customer/acceptance/payment behavior must be preserved during enforcement changes.

## Z. Promoted-launch requirements

### Required before any real team access

- Fail-closed role/session handling and reconciled ownership.
- Active-membership enforcement across direct and server access.
- Distinct use/delegation/custody authority.
- Safe directory and typed error states.
- Authorized access mutation transactions and audit.
- Explicit create/join routing and bootstrap admission.
- Verified, expiring, revocable, retry-safe invitations.
- Honest membership conflicts and recovery.
- Strong authentication for sensitive authority and money operations.
- Role/default and financial-data boundaries enforced end to end.

### Required before restricted Field/crew access is promoted

- Explicit job-access relation and assignment/access UX.
- Scoped lists, detail reads, customer projections, files, tasks, and schedule.
- No sensitive proposal/cost payload leakage.
- Proven revocation of resource access, not merely membership removal.

If the scope work is not approved for launch, do not silently ship a role called restricted Field with company-wide access. Limit launch membership classes or obtain an explicit informed broader-access product decision. This is a release-scope decision, not permission to weaken the design.

### Not required to launch trustworthy internal teams

Custom-role UI, branches, subcontractor accounts, temporary-access UI, SSO/SCIM, autonomous AI, and threshold approval systems. Their extension points should not become partially working controls.

## AA. Migration / data-model implications

Proposed logical records, subject to implementation design:

- Existing company custody pointer and existing membership, with role/profile version and access revision.
- Versioned capability/profile registry, protected from ordinary writes.
- Sparse membership rules with effect, capability/package, typed scope, validity, authorizer, and revision.
- Bounded delegation mandates independent of data-use grants.
- Invitations, invitation generations, and secure delivery intent.
- Access audit events.
- Minimal company-scoped job-access relation for multiple authorized Field users, distinct from `jobs.assigned_to`.
- Optional transfer intent for ownership acknowledgment; final transfer remains atomic.

Do not replace existing customer, job, proposal, lifecycle, pricing, or payment authority. A job-access relation grants visibility/action scope only; it does not become a new schedule or production-responsibility truth.

Field access may derive from carefully defined existing relations where sound, but task assignment alone should grant at most the specifically required task/job brief, not arbitrary full-domain access. Explicit job access is needed for workers without tasks. Validate this mapping before coding.

Preserve one membership per user across states. Future cross-company employment/external collaboration would require an explicit invariant change: retained historical membership plus a unique active binding and a selected-tenant context. That is not authorized in this phase.

Migration preflight must inventory owner/profile mismatches, unknown roles, removed members, and effective old permissions. Role/default tightening is a deliberate product migration with before/after review, not incidental refactoring. Never guess that all legacy `owner` strings are actual custody owners.

Deploy schema and enforcement compatibly before UI. Use forward migrations in the future implementation; do not edit historical migration truth or perform silent production data repair.

## AB. Security invariants

1. Company derives from verified authority, not client selection.
2. Identity verification does not itself create company access.
3. Bootstrap and acceptance serialize per user and respect current uniqueness.
4. Accepted invitation replay cannot restore disabled access or old privileges.
5. Role, scope, delegation, and custody changes are authorized independently of presentation.
6. Unknown roles/capabilities and authorization errors deny.
7. Explicit deny cannot be widened away by another grant.
8. Scope applies to lists, counts, search, files, history, exports, and nested data.
9. Field job access does not expose unrelated customer/property work.
10. Assignment cannot be used to self-grant unauthorized access.
11. Disabled users fail subsequent authorization despite stale tokens.
12. Revocation is not rolled back because reassignment failed.
13. Owner transfer is atomic, acknowledged, auditable, and cannot orphan custody.
14. Sensitive delegation is bounded, nonrecursive, and cannot elevate self or protected peers.
15. Public customer tokens remain distinct from employee membership.
16. Cost restrictions cover derived values and stored snapshots, not only display columns.
17. Money/contract actions retain existing domain and idempotency rules.
18. Service-role execution does not trust client-provided actor authority.
19. AI cannot retrieve or act beyond the effective human boundary.
20. Audit remains immutable to ordinary members and access administrators.

## AC. Test matrix

| Area | Positive and adversarial proof |
|---|---|
| Role resolution | Every profile, legacy mapping, unknown/null roles, future unknown capability |
| Use/delegation | Admin can staff allowed roles without costs; cannot grant financial power without mandate; no recursive/self/peer elevation |
| Scope | Company/job/own-task; cross-company IDs; unassigned records; same customer with hidden sibling jobs |
| Dependencies | Valid package; denied prerequisite; cycles; removed dependency; no silent widening |
| Profile changes | Before/after preview; retained denies; sensitive grants require retention; stale editor rejected |
| Invites | Verified/wrong email, changed email, expired/revoked generation, scanner GET, replay after disablement |
| Invite delivery | Provider failure, secure envelope expiry, resend rotation, lost response, concurrent resend/accept |
| Create/join | Direct RPC admission bypass attempt; multiple invitations; race with bootstrap; disabled conflict |
| Membership revocation | Old JWT, direct REST/RPC, storage, realtime, async export, cached scope |
| Handoff | Disable succeeds with failed reassignment; counts fail honestly; completed attribution unchanged |
| Ownership | Concurrent transfer, inactive target, lost response, absent Owner recovery, self-removal |
| Financial projection | Costs hidden in JSON/PDF/export/search; collection grant does not expose ledger/refund/payout |
| Authentication | Sensitive step-up, recovery, stolen stale session handling, invitation context preservation |
| Policy parity | Database and server decisions match; no unguarded alternate endpoint or service-role path |
| AI | Prompt injection cannot grant authority; permission loss before queued action; retrieval isolation |
| Regression | Acceptance != approval; schedule authority, immutable sends, money/refund semantics, public links |
| Mobile/UX | 390px Team detail/invite errors; correct first destination; no accidental company setup |

Use isolated real-policy integration tests, not production writes. Unit tests for the resolver and UI are necessary but insufficient. Test authorization at the actual database/API/storage boundary with at least two tenants and multiple roles. No tests were run or changed during this planning pass.

## AD. Implementation order

### 1. Decide defaults and reconcile authority

Approve scope/default differences, inventory legacy membership/custody, and freeze the capability/delegation contract. Stop on ambiguous owner records rather than promoting by fallback.

### 2. Close current enforcement gaps

Fail-closed roles, active-member predicates, safe directory projections, direct-access review, and protected access mutations. Keep existing domain truth unchanged. Prove disabled/direct-access denial before inviting more people.

### 3. Build the deterministic policy foundation

Versioned profiles, sparse rules, typed scopes, delegation ceiling, audit, and parity checks. Introduce minimum job-access authority if Field launch is approved. Stop if crew scope cannot be represented without confusing operational responsibility.

### 4. Separate create/join and implement invitations

Creator admission, access resolver, auth return handling, secure delivery, accepted membership transaction, retries/conflicts. Preserve Slice 0A uniqueness and locking. Prove direct-RPC policy enforcement.

### 5. Complete revocation, recovery, and custody

Strong-auth sensitive actions, disable/reactivate, recoverable handoff, ownership transfer, unavailable-owner procedure. Never delay revocation for cleanup.

### 6. Expose minimal Team and contextual entry

Roles, meaningful packages, access summary, invitation status, and capability-aware destinations. No raw registry UI. Existing product domains change only as necessary to enforce their approved access boundary.

### 7. Launch verification

Run the scenario matrix, actual policy tests, mobile/desktop proof, provider/auth environment checks, and cross-tenant regression. Stop on any role that promises a restriction the database cannot enforce.

Implementation requires later explicit authorization for migrations, deployment, and production verification. This document grants none.

## AE. Timothy decisions

### Recommended defaults - do not make every detail configurable

- Five displayed archetypes, one base role per member.
- One custody Owner with explicit transfer.
- Operational Admin without default company financials/costs/refunds.
- Company scope for Sales/Production coordination; explicit jobs for Field.
- Seven-day invitation expiry.
- Deny precedence and nonrecursive delegation mandates.
- Drawer-based access review, not inline autosave or a matrix.
- Disable first, recover handoff separately.

### Valid alternatives

- 'Production Manager' label instead of Production Lead if it better communicates company-wide authority.
- Collection package preselected for Admin in businesses where office collections are universal, provided the grant remains explicit and reviewable.
- Multiple Owners plus one Primary Owner if equal-principal custody becomes a demonstrated requirement.

### Requires Timothy's decision before implementation

1. **Field launch scope:** approve minimal multi-user job access now, or explicitly limit who can be onboarded at launch. V2 recommends implementing it before ordinary crew invitations.
2. **Commercial default changes:** accept Admin/Sales payment and approval boundaries and migration consequences for existing roles.
3. **Sensitive delegation:** permit a narrow Owner-issued mandate for trusted Admins, or launch Owner-only assignment while retaining the model. Recommended default is Owner-only until a mandate is genuinely needed.
4. **Controlled access:** define who receives business-creation eligibility. Recommendation: separate creator admission from team invitation.
5. **Strong-auth rollout/recovery:** approve privileged-user MFA/step-up and an operational recovery process before enabling sensitive powers.
6. **Employment mobility:** accept the current disabled-membership cross-company limitation for launch, or authorize a separate membership-history redesign. Do not hide this decision inside invitation code.

No decision is needed to fix unknown-role elevation, stale-session tenant access, misleading zero assignment counts, or incomplete access-mutation authority. Those are correctness/security work within this system, not optional UX strategy.

## AF. Final benchmark assessment

**Does this architecture provide high-end/enterprise-grade capability under the hood while remaining substantially simpler to operate than typical enterprise permission systems?**

**Yes in architectural capability and direction; not yet as a verified implementation or certification claim.**

It supports action authority, resource/data scopes, explicit restrictions, bounded delegation, time conditions, sensitive-action assurance, durable attribution, audit, and future custom profiles. These are high-end authorization characteristics. It deliberately avoids enterprise directory administration, role-matrix setup, and speculative workflow engines.

The practical interface remains Person, Role, Status, occasional Special access, and a short access summary. Scope is surfaced only where it affects real work. The system owns dependency calculation and policy explanation.

V2 is stronger than V1 because it does not treat company-wide Field access as harmless simplification, does not confuse custody with role strings, and does not make financial visibility the price of staffing authority. It is also more honest about what current repo truth cannot yet support.

Success depends on enforcement parity, deployment verification, and understandable recovery. Until those are implemented and tested, this is an architecture ready for decision and sequencing, not a declaration that FieldDive's access system is launch-safe.

## Research Sources

All links below are primary vendor documentation. Research date: 2026-09-27. Feature availability and plan gates may change; none are assumed to dictate FieldDive pricing or packaging. Twelve benchmark systems are counted; Supabase is listed separately as technical evidence. Microsoft Entra is one system, not counted again as Microsoft 365.

| ID | System and pattern | Source | Extracted pattern / disposition |
|---|---|---|---|
| J1 | Jobber - presets, own/all scopes, permission dependencies | [User Permissions](https://help.getjobber.com/en/articles/user-permissions/) | Adapt defaults and field scopes; hide dependency mechanics behind reviewed packages |
| ST1 | ServiceTitan - employee/technician defaults and exceptions | [Set permissions for an employee or technician role](https://help.servicetitan.com/docs/set-permissions-for-an-employee-or-technician-role) | Adapt technician scopes and sensitive-auth boundaries; reject silent loss of exceptions |
| HC1 | Housecall Pro - office/field and sensitive visibility | [Team Member Roles & Permissions](https://help.housecallpro.com/en/articles/1073431-team-member-roles-permissions) | Adapt financial separation; reject broad promotion to satisfy narrow needs |
| P1 | Procore - project/global templates and granular permission | [Create a Project Permissions Template](https://support.procore.com/products/online/user-guide/company-level/permissions/tutorials/create-a-project-permissions-template) | Adapt action/scope separation; defer template UI |
| H1 | HubSpot - all/team/owned records and export authority | [User permissions guide](https://knowledge.hubspot.com/user-management/hubspot-user-permissions-guide) | Adapt typed scope and separate export authority |
| H2 | HubSpot - reusable profiles and assignment ceilings | [Create and assign permission sets](https://knowledge.hubspot.com/user-management/create-permission-sets?app=1) | Adapt bounded delegation; differ with explicit use/delegation split |
| SL1 | Slack - Primary Owner versus administrative roles | [Types of roles in Slack](https://slack.com/help/articles/360018112273-Types-of-roles-in-Slack) | Adapt custody boundary; defer multiple-owner hierarchy |
| L1 | Linear - roles and suspended-member attribution | [Members and roles](https://linear.app/docs/members-roles) | Adopt disable-with-history, adapt bounded leadership |
| S1 | Stripe - ownership transfer and recovery | [Change the owner of a Stripe account](https://support.stripe.com/questions/change-the-owner-of-a-stripe-account?locale=en-GB) | Adapt accepted target and verified recovery; official indexed support evidence |
| N1 | Notion - resource access and broadest-access inheritance | [Sharing and permissions](https://www.notion.com/help/sharing-and-permissions) | Adapt resource scope; reject broad grant overriding explicit restriction |
| N2 | Notion - member versus guest | [Who should be a workspace member and who should be a guest?](https://www.notion.com/help/guides/who-should-be-a-workspace-member-who-should-be-a-guest) | Adapt eventual external class; no automatic domain upgrade |
| A1 | Asana - removal and work continuity | [Manage people in your organization](https://help.asana.com/s/article/managing-people-in-organizations) | Adopt attribution preservation; adapt recoverable reassignment |
| G1 | Google Workspace - resilient administrator custody | [Administrator security best practices](https://support.google.com/a/answer/9011373?hl=es-419) | Adapt backup administration and strong auth; reject mandatory multiple all-powerful accounts for tiny firms |
| G2 | Google Workspace - suspension versus deletion | [Google Workspace setup FAQ](https://support.google.com/a/answer/6142901?hl=en-PH) | Adopt access suspension without deleting business history |
| M1 | Microsoft Entra - time/approval privileged access | [Plan a PIM deployment](https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-deployment-plan) | Adapt time-bound rule semantics; defer activation machinery |
| M2 | Microsoft Entra - scoped administration | [Administrative units](https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/administrative-units) | Adapt delegation scope; defer directory hierarchy |
| SB1 | Supabase - JWT and session revocation behavior | [User sessions](https://supabase.com/docs/guides/auth/sessions) | Live membership checks and sensitive-session validation; not counted as a benchmark product |

### Provenance and uncertainty notes

- Some support pages were available through official indexed text rather than a successful direct page fetch; Stripe ownership evidence and Google's localized security guidance are identified accordingly. No third-party competitor comparison was used as authority.
- Sources do not establish each vendor's complete internal enforcement architecture, default invite lifetime, last-owner transaction behavior, or every onboarding destination. Where not documented, no such claim is made.
- Seven-day invitations, FieldDive role names, financial defaults, delegation mandates, and scoped crew rollout are FieldDive recommendations, not copied benchmark requirements.
- Local Supabase skill guidance informed the read-only security checklist. No CLI update, package install, SQL, or live configuration inspection was performed.
- This report does not independently verify vendor security, certify FieldDive compliance, or approve production migration.

PHASE 13 ACCESS ARCHITECTURE V2 - RESEARCH AND PLAN ONLY - NO IMPLEMENTATION PERFORMED
