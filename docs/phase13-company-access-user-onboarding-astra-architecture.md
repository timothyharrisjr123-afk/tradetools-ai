# Phase 13  Company Access & User Onboarding Foundation
## Astra Architecture & Research Report

- Date: 2026-09-27
- Repo HEAD reviewed: `752e25b1a54b19dc0d808bd02d225cb2654df39c`
- Implementation performed: **NO**
- Database changes performed: **NO**
- Production changed: **NO**
- Artifact status: Architecture and research only; no implementation approval implied.

## FieldDive Design Principles

POWER LIVES UNDER THE HOOD.
CLARITY LIVES IN THE INTERFACE.

FieldDive should know more than it shows.

Do not simplify capability merely to make UI simpler. A sophisticated internal access model is acceptable and desirable when it allows the product UI to remain minimal and contractor-friendly.

Use the simplest durable architecture that supports strong role defaults, granular capabilities, sparse user-specific exceptions, contextual authorization, secure multi-tenant enforcement, and future expansion without architectural replacement. Avoid both underpowered design and unnecessary abstraction.

FLOW WHEN NEEDED. STAY QUIET WHEN NOT NEEDED.

KNOW IT — DO IT. NEED INPUT — ASK THERE. RISK — WARN CLEARLY.

## A. Executive assessment

FieldDive should build this foundation around **one authoritative company membership, a small set of roles, and explicitly controlled exceptions**—not a permissions console.

The accepted Slice 0A foundation is sound and should remain:

- Company is the tenant.
- Bootstrap atomically creates the first company and Owner membership.
- One membership per user is enforced.
- Bootstrap is serialized and retry-safe.
- Clients cannot insert arbitrary memberships.
- Removed membership is not interpreted as permission to create another company.

The next phase must close the gap between that secure bootstrap and everyday team administration.

**The priority is authorization enforcement before invitation UI.** Current code has several material gaps: Owner/Admin conflation, unknown-role elevation, incomplete removed-member enforcement, and team mutations that do not yet have a complete database-authorized path.

Recommended direction:

- Five roles: **Owner, Admin, Sales, Production Lead, Field**.
- One transferable account Owner initially.
- Role defaults plus sparse grants **and restrictions**.
- Owner-controlled sensitive privileges.
- Invitations establish access only after authenticated, verified acceptance.
- Create-business and join-business are separate server-authorized transitions.
- Disabled membership immediately fails subsequent authorization checks.
- Simple Team UI; durable authority and audit history underneath.

This is a proposed architecture, not implementation approval.

### Checkpoint

Reviewed repository checkpoint: `752e25b1a54b19dc0d808bd02d225cb2654df39c`.

The working tree was clean during the architecture review. No files were modified during that review. No database operations, installations, deployments, or server management were performed. Live production policy deployment was not verified. This documentation artifact was subsequently added at the user's explicit request; it does not implement the architecture.

## B. Benchmark findings

### Slack

Slack distinguishes a single Primary Owner from other administrative roles. Transfer/deletion authority is narrower than routine workspace administration. Its additional system roles demonstrate that selective delegation need not require giving someone full ownership. [Slack roles](https://slack.com/help/articles/360018112273-Types-of-roles-in-Slack), [ownership transfer](https://slack.com/intl/en-gb/help/articles/204401633-Transfer-ownership-of-a-workspace-or-org)

**Apply to FieldDive:**

- Separate account custody from everyday management.
- Make ownership transfer explicit.
- Do not make “can manage users” equivalent to “can grant anything.”
- Do not introduce Slack-like guest models until FieldDive has real resource-scoping enforcement.

### Linear

Linear separates workspace administration from more bounded team responsibilities. Suspended members lose access while remaining available for historical attribution. Its invitation flow assigns access before the recipient joins. [Linear roles](https://linear.app/docs/members-roles), [invitations](https://linear.app/docs/invite-members)

**Apply to FieldDive:**

- Production leadership deserves operational authority without account administration.
- Removal must preserve authorship and work history.
- The inviter—not the recipient—chooses role and access.
- Pending invitation and active membership must remain distinct.

### Stripe

Stripe’s invitation process selects the recipient and assigned roles together. Ownership transfer is a separate operation, directed to an eligible existing administrative user after invitation acceptance. [Stripe invitations](https://support.stripe.com/questions/invite-team-members-or-developers-to-access-your-stripe-account?locale=en-GB), [ownership transfer](https://support.stripe.com/questions/change-the-owner-of-a-stripe-account?locale=en-GB)

**Apply to FieldDive:**

- Treat financial authority as explicit authority.
- Invite acceptance precedes ownership transfer.
- Do not expose account ownership through an ordinary role dropdown.
- Provide a verified support recovery path for an unavailable Owner.

The installed Stripe CLI predates its current documentation command requirements. I did not upgrade it; the benchmark uses official public Stripe support material instead.

### Conclusion

The strongest shared pattern is:

**Simple role assignment, bounded delegation, explicit ownership, revocable membership, and durable attribution.**

FieldDive does not need their enterprise configuration surfaces to adopt those foundations.

## C. FieldDive access principles

1. **Company membership is authoritative.** Email, navigation, local storage, and user-editable auth metadata are not membership authority.
2. **Authentication is not company access.** A valid account may legitimately have no active membership.
3. **Joining never implicitly creates a business.**
4. **Unknown is denied, not promoted.** Unknown roles, failed membership reads, and invalid capability definitions fail closed.
5. **Capability permission and business eligibility are different.** Permission to approve a job does not make an unaccepted proposal approvable.
6. **Administrative authority is not automatically financial authority.**
7. **Every grant has a delegation boundary.**
8. **Disabling access preserves history.**
9. **UI hides complexity, not consequences.**
10. **Tenant isolation remains mandatory even when a capability is granted.**

“FieldDive should know more than it shows” means the system can explain a decision without displaying its entire authorization matrix.

## D. Recommended canonical roles

Retain the useful distinction between Production Lead and Field.

| Role | Typical user and purpose | Important boundary |
|---|---|---|
| **Owner** | Business principal responsible for the FieldDive account | Sole account-custody authority |
| **Admin** | Office manager or operations manager running the business day to day | Not automatically entitled to costs, refunds, pricing rules, or ownership |
| **Sales** | Estimator or salesperson preparing and sending proposals | Cannot automatically approve operational commitment or exceptional commercial terms |
| **Production Lead** | Production manager or crew lead coordinating execution | Operational authority without commercial administration |
| **Field** | Installer, inspector, technician, or crew member | Capture information and perform assigned work; no broad scheduling or contractual authority |

Multiple Admins, Sales users, Production Leads, and Field users are supported.

**Recommendation: one Owner at launch.** This is the application’s accountable custodian, not a statement about legal equity ownership. It aligns naturally with the existing `companies.owner_user_id`.

Additional business principals can be Admins with explicit privileges. Multiple application Owners remain possible later, but require a Primary Owner distinction and additional transfer/removal rules. That is a product decision, not something to introduce accidentally through the existing dropdown.

## E. Role → default capability model

Recommended defaults:

| Capability group | Owner | Admin | Sales | Production Lead | Field |
|---|---|---|---|---|---|
| Operational customer/property/job visibility | Yes | Yes | Yes | Yes | Yes |
| Create/edit customer, property, job records | Yes | Yes | Yes | Yes | No |
| Capture measurements/photos | Yes | Yes | Yes | Yes | Yes |
| Complete assigned tasks | Yes | Yes | Yes | Yes | Yes |
| Manage/assign tasks | Yes | Yes | No | Yes | No |
| Schedule and assign production responsibility | Yes | Yes | No | Yes | No |
| Start/complete eligible work | Yes | Yes | No | Yes | No |
| Hold/resume work | Yes | Yes | No | Yes | No |
| Finalize lost/closed disposition | Yes | Yes | No | No | No |
| Author/send proposals | Yes | Yes | Yes | No | No |
| Operationally approve accepted work | Yes | Yes | No | No | No |
| Issue customer-facing scope changes | Yes | Explicit grant | Explicit grant | No | No |
| View payment ledger/request payment | Yes | Yes | Explicit grant | No | No |
| Record financial adjustments/refund | Yes | Explicit grant | No | No | No |
| View internal costs/change pricing rules | Yes | Explicit grant | Explicit grant | No | No |
| Manage routine company settings | Yes | Yes | No | No | No |
| Manage ordinary team access | Yes | Bounded | No | No | No |
| Ownership, payout configuration, subscription control | Yes | No by default | No | No | No |

These are **proposed defaults**, not claims about current behavior.

Two important qualifications:

- Company-wide **operational** visibility is the bounded launch recommendation. An “Assigned to me” destination is a filter, not a security boundary.
- Operational visibility does not include unrestricted proposal payloads, internal costs, or financial records. Field users need safe authorized-work information, not the entire commercial source object.

If assigned-job-only access is a launch requirement, it needs a real resource-scope phase—not hidden navigation.

## F. Internal capability registry

Use domain-oriented permissions. Keep separate permissions only where authority genuinely differs.

| Domain | Proposed capabilities |
|---|---|
| Customer/property records | `customers.read`, `customers.manage` |
| Jobs | `jobs.read`, `jobs.manage`, `jobs.assign`, `jobs.approve`, `jobs.progress`, `jobs.hold`, `jobs.finalize` |
| Measurements/photos | `measurements.write`, `photos.write` |
| Tasks | `tasks.complete`, `tasks.manage` |
| Scheduling | `schedule.manage` |
| Proposals | `proposals.read`, `proposals.write`, `proposals.send` |
| Contract changes | `scope_changes.issue` |
| Commercial configuration | `pricing.manage`, `pricing.cost.read`, `templates.manage` |
| Money | `payments.read`, `payments.request`, `payments.record`, `payments.refund`, `payments.configure` |
| Company administration | `company.manage`, `team.manage`, `billing.manage`, `data.export` |

Operational reads for measurements, photos, tasks, and schedule can initially inherit authorized job visibility. Do not add separate read permissions without a genuine distinction.

Definitions must be precise:

- `jobs.manage` does not imply lifecycle approval, arbitrary stage writes, or hard deletion.
- `proposals.write` does not imply send, pricing-policy changes, or alteration of accepted truth.
- `payments.record` governs existing ledger-affecting manual actions; it is not a license to rewrite history.
- `data.export` never expands the underlying data the actor may read.
- `pricing.cost.read` covers cost exposure inside calculations, JSON, exports, and generated responses—not just a Cost column.

Reserve, but do not activate unsupported workflows such as `discounts.approve` or `reports.financial`. A permission name must not suggest that an approval workflow already exists.

Ownership transfer and company destruction should be dedicated invariant-protected operations, not ordinary assignable capabilities.

## G. Special-privilege / override model

Use **role defaults + sparse grants + explicit restrictions**.

A membership override has one effect:

- Grant
- Restrict
- No override: inherit role

Do not store a complete copied capability matrix for every user.

Resolution:

> Active membership → valid role → role defaults → explicit grants → explicit restrictions → resource and business constraints.

Restrictions win over grants. Tenant, membership, and ownership invariants win over everything.

### Simple interface

A member’s detail can show:

- Role: Sales
- Special access:
  - View internal costs
  - Request payments
  - Approve jobs
- Restrictions:
  - Cannot send proposals

Only meaningful, supported exceptions appear. The default view remains role-based.

### Delegation rules

- Owner can grant approved sensitive exceptions.
- Admin can manage ordinary users only within a defined delegation ceiling.
- Admin cannot grant a capability they lack.
- Possessing a capability does **not** automatically confer permission to delegate it.
- Admin cannot promote another Admin, alter Owner access, or elevate themselves.
- Ordinary users cannot edit their own access.

Role changes must display the resulting effective access. Existing exceptions are explicitly retained or cleared—not silently inherited into an unrelated role.

Owner constitutional authority cannot be restricted by an override. If the Owner needs a constrained account, transfer ownership first.

## H. High-risk / non-delegable capabilities

| Authority | Recommended control |
|---|---|
| Ownership transfer/company destruction | Owner only; recent authentication; dedicated workflow |
| Promote/demote Admin | Owner only |
| Grant sensitive financial/commercial exceptions | Owner only |
| Subscription billing | Owner default; optionally delegable later |
| Payout account/payment-provider configuration | Owner only initially |
| Refunds | Owner default; explicit Owner grant to trusted Admin |
| Internal cost visibility | Owner default; explicit grant |
| Pricing/catalog rules | Owner default; explicit grant |
| Proposal send | Owner/Admin/Sales default; retain send readiness and immutable-version rules |
| Operational approval | Owner/Admin default; explicit grant to another suitable user |
| Customer-facing scope changes | Separate explicit authority |
| Bulk export | Explicit grant; underlying read limits remain |
| Destructive data operations | Dedicated policy; never implied by generic edit |

Discount authority needs special care. Until FieldDive has enforceable discount rules, adding an “Approve discounts” checkbox would create false assurance. Define that workflow separately before exposing the privilege.

## I. Owner / Admin authority model

### Owner

- Initial creator becomes Owner through secure bootstrap.
- Can manage Admins and all ordinary roles.
- Can authorize sensitive exceptions.
- Can transfer ownership to an active, verified existing member.
- Cannot disable or demote themselves through ordinary member editing.

### Admin

- Can invite and manage Sales, Production Lead, and Field users.
- Can grant only explicitly delegable ordinary privileges.
- Cannot manage peer Admin authority or Owner authority.
- Cannot bypass their own restrictions through another account.

### Ownership transfer

Use a dedicated transaction that:

1. Reauthenticates the current Owner.
2. Verifies the target’s active same-company membership.
3. Locks the company and affected memberships.
4. Updates `companies.owner_user_id` and membership roles together.
5. Makes the former Owner an Admin under an explicitly reviewed access profile.
6. Records the transfer and notifies both parties.

Never expose Owner as an ordinary invitation role.

For an unavailable Owner, define a verified, audited support recovery procedure. Do not let an Admin “claim ownership” based on possession of the company ID or an email domain.

## J. Invitation / add-user lifecycle

Separate **invitation state** from **membership state**.

### Invitation

- Pending
- Accepted
- Revoked
- Expired, derived from its deadline

### Membership

- Active
- Disabled

A pending invitation is not an active user.

Recommended interaction:

**Add user → Email → Role → Optional special access → Send invitation**

Avoid “Create access” if that implies an unverified email immediately receives membership.

### Rules

- Default expiry: **seven days**, subject to product confirmation.
- Resend uses the same logical invitation, rotates its token, and invalidates older links.
- Duplicate submission returns the existing pending invitation; it must not silently change its role.
- Explicit access edits are separate, audited operations.
- Tokens are high-entropy, stored hashed, single-use, and never logged.
- Opening a link does not accept it. Email scanners must not consume invitations.
- Acceptance requires authenticated, verified email matching the invited identity.
- Do not collapse email aliases or infer equivalence from matching domains.
- Wrong-account sessions offer “Sign in with the invited email”; they receive no membership.
- Existing membership in another company produces an explicit conflict. No automatic move, merge, or second company.
- Disabled membership is not deleted to work around that constraint.

### Transaction and retry behavior

Acceptance atomically:

- Validates invitation, expiry, recipient, and current issuing authority.
- Acquires the same per-user serialization boundary used by bootstrap.
- Establishes exactly one existing-company membership.
- Marks the invitation accepted.
- Records the audit event.

A lost response can be retried and returns the already-established result. Two concurrent acceptances cannot create two memberships.

Invitation persistence and email delivery are separate. Failed email delivery leaves a recoverable pending invitation—not a second invitation or an active member.

If the inviter loses the authority needed to issue that invitation, acceptance stops and an authorized person must reissue it.

## K. Create-business vs join-business flow

This distinction must exist in server authority, not just page copy.

### Create a business

Authenticate → verify identity → explicitly request business creation → server checks eligibility → existing secure bootstrap transaction → Owner.

During controlled access, creation eligibility must reflect FieldDive’s chosen access policy.

### Join a business

Invitation → authenticate/verify invited identity → resolve invitation → accept → membership in existing company → role-appropriate destination.

### Returning sign-in

Resolve:

1. Active membership → enter company.
2. Disabled membership → access-removed explanation.
3. Valid pending invitation → join existing company.
4. No membership/invitation → explicit create-business or access-request path.
5. Read failure → retryable error, never automatic bootstrap.

**Critical correction:** general authentication/protected-page initialization must stop treating “no membership” as unconditional permission to create “My Company.”

Keep Slice 0A’s atomicity, uniqueness, and existing/removed/created semantics. Extend its admission boundary so directly calling the RPC cannot bypass join/create policy.

## L. Removed / disabled member model

Use one canonical access state: **disabled**.

The interface may say “Remove access.” Existing `removed_at` can represent this initially; there is no immediate need for separate removed, archived, and disabled authorization states.

After disablement:

- Subsequent API, RPC, database, and private-storage authorization fails.
- Existing JWTs do not preserve company access.
- Authorship, assignments, signatures, and activity remain.
- Completed work is not reassigned retroactively.
- Open tasks and active-job responsibility may be reassigned explicitly.
- Reassignment failures cannot be reported as success.

Session revocation is useful defense-in-depth, but live membership enforcement is the security boundary.

Previously downloaded files cannot be recalled. Existing signed-file URLs require bounded expiry or an access-gated delivery design; do not promise instantaneous revocation of already-issued bearer URLs.

Reactivation is an explicit authorized operation. Review role and exceptions before restoring access; never reactivate simply because the user signs in.

## M. Effective-permission resolution

The public interface can remain:

`can(actor, capability, resource?)`

Its authoritative evaluation must include:

- Authenticated subject
- Active membership
- Company match
- Valid role
- Role defaults
- Membership overrides
- Delegation constraints where applicable
- Resource scope
- Domain eligibility

Return structured denial reasons internally, such as:

- Membership disabled
- Capability missing
- Different company
- Resource outside scope
- Business prerequisite unmet
- Authorization unavailable

The UI can translate these into useful language without exposing internal policy details.

Do not rely exclusively on JWT role claims or indefinitely cached capability arrays. Use live authorization for sensitive operations; caches must have explicit invalidation and cannot preserve revoked access.

## N. Enforcement architecture

### Canonical truth

Store membership, role assignment, and overrides in the database.

Maintain a versioned capability registry and role definitions through reviewed code/migrations. TypeScript types and UI descriptions should derive from that registry or have enforced parity—not independently maintained competing permission maps.

### UI

- Filter irrelevant navigation.
- Hide actions the user can never perform.
- Explain disabled actions when a recoverable prerequisite is missing.
- Preserve local errors instead of pretending content is empty.

### Server/API

- Authenticate the caller.
- Resolve active company membership.
- Authorize capability and resource.
- Apply existing domain eligibility.
- Return safe, actionable errors.

### Domain services

Centralize operation-level authorization so multiple routes cannot apply different rules to the same action.

### RPC

Sensitive mutations must validate authority inside the transaction.

Role change, disablement, invitation acceptance, ownership transfer, and financial mutations cannot rely solely on a preceding application check.

### Database/RLS

- Independently require active same-company membership.
- Enforce capability restrictions for direct authenticated data access, or remove direct access and expose narrowly authorized operations.
- Protect commercial/cost fields through safe projections or storage separation where row-level policies are insufficient.
- Keep authorization tables non-client-writable.
- Harden `SECURITY DEFINER` functions with narrow grants, explicit identity checks, safe search paths, and constrained ownership.

Service-role execution must never trust a client-supplied actor or company ID as authority.

Public customer-token flows remain a distinct authorization model. Employee disablement should not arbitrarily invalidate legitimate customer agreements or links.

## O. Audit / support truth

Record immutable events for:

- Invitation created, resent, revoked, accepted
- Role changed
- Privilege granted/restricted/cleared
- Membership disabled/reactivated
- Ownership transferred

Include:

- Company
- Actor
- Subject
- Before/after access
- Timestamp
- Operation/request identifier
- Reason where required

Commit the event with the access mutation.

Keep invitation-delivery status separate from access authority. Never store raw invitation tokens or secrets in audit records.

Contractors need a quiet member history when relevant—not a security-event dashboard. Support needs durable evidence sufficient to explain who granted access and why it changed.

## P. Minimal Team UI

Default list:

| Person | Role | Status |
|---|---|---|
| John Smith | Sales | Active |
| Sarah Jones | Production Lead | Active |
| Mike Brown | Admin | Invitation pending |

Primary action: **Add user**.

Member detail:

- Identity
- Role
- Special access, collapsed when unused
- Restrictions, when present
- Resend/revoke for pending invitations
- Remove access for active users
- Restore access for disabled users

Owner transfer lives in a separate protected action, not the role selector.

Show a plain-language access-change summary before saving sensitive changes. Do not present the internal registry as a checkbox wall.

## Q. First-run experience by role

| Role | First destination |
|---|---|
| Owner | Normal business activation path, with contextual company/setup requirements |
| Admin | Existing Jobs operating surface |
| Sales | Jobs/proposal work, using existing destinations |
| Production Lead | Scheduled/active operational work |
| Field | Assigned work where available; useful explanation when nothing is assigned |

Joined users do not install starter company data, name a new company, or configure payment infrastructure.

No role-specific tours are necessary. A short “You joined Acme Roofing as Sales” confirmation and an appropriate destination are sufficient.

A user with no assigned work is not in a broken onboarding state.

## R. Current repo gaps

These are source findings, not assertions that live production has been independently tested.

| Finding | Consequence | Required treatment |
|---|---|---|
| Unknown/empty roles normalize to Owner | Fail-open privilege resolution | Fail closed; explicitly reconcile legacy values |
| Owner/Admin share `owner_admin`; choosing it writes `owner` | Role editing can misrepresent ownership | Separate roles and dedicated ownership authority |
| Generic identity initialization invokes bootstrap | Future invitees can enter create-business path | Add explicit access-state resolution and create/join admission |
| Many membership-based RLS predicates lack `removed_at` checks | Removed sessions can retain direct data access | Active-membership enforcement across tables, RPCs, storage |
| Existing Team persistence uses direct membership updates | No complete owner-authorized mutation path | Transactional access-management RPC/service boundary |
| Baseline membership/profile reads are self-only | Team directory reads do not match intended UI | Safe company directory projection, not broad profile exposure |
| No invitation model | No durable authenticated join path | Invitation authority and acceptance transaction |
| Removal and reassignment are separate writes; reassignment errors can be ignored | Partial removal/handoff can appear successful | Explicit transactional or recoverable handoff semantics |
| Reassignment targets all nondeleted jobs | Historical responsibility can be changed | Restrict optional reassignment to appropriate active work |
| No sparse override/audit foundation | Exceptions cannot be safely delegated or explained | Membership overrides and immutable access events |

Relevant source (repository-relative links):

- [Secure bootstrap migration](../supabase/migrations/20260925220856_secure_company_bootstrap_authority.sql)
- [Identity/bootstrap caller](../app/lib/ensureUserIdentity.ts)
- [Role definitions](../app/lib/companyMembershipRoles.ts)
- [Membership session](../app/lib/companyMembershipSession.ts)
- [Server capability guard](../app/lib/requireCapabilitySession.ts)
- [Membership persistence](../app/lib/companyMembershipPersistence.ts)
- [Members API](../app/api/company/members/route.ts)
- [Team editor](../app/tools/settings/CompanySettingsTeamEditor.tsx)
- [Baseline policies](../supabase/migrations/20260909130000_canonical_pre_recovery_baseline.sql)

The bootstrap migration correctly closes arbitrary self-membership insertion. This phase should not describe that old vulnerability as still unfixed.

## S. Promoted-launch foundation required now

Before enabling real company teams:

1. Fail-closed roles and distinct ownership.
2. Active-membership enforcement across every access path.
3. Safe team-directory reads.
4. Server-authorized role changes and disablement.
5. Explicit create/join resolution.
6. Retry-safe invitations and acceptance.
7. Bounded role defaults and sparse exception engine.
8. Secure authentication recovery that preserves invitation context.
9. Ownership transfer and a documented unavailable-owner recovery procedure.
10. Access audit records and truthful delivery/recovery states.
11. Real integration tests using different roles, tenants, and stale sessions.

Do not launch special-access controls for permissions whose underlying enforcement is incomplete.

## T. Advanced capabilities to support later

Prepare extension points, not unfinished features:

- Custom roles
- Job-team/assignment-based security scopes
- Branch/location scopes
- External subcontractor access
- Expiring access
- Multiple application Owners with a Primary Owner
- SSO/SCIM
- Approval thresholds
- Granular reporting access
- Temporary delegated authority
- AI/copilot access to authorized data and actions

Future AI must inherit the acting user’s effective authority. It must not receive an unrestricted service-role interpretation of “help this user.”

## U. Migration / data-model implications

Likely additions:

- Role/capability definitions
- Membership capability overrides
- Invitations with recipient, proposed access, token hash, expiry, issuer, and acceptance result
- Access audit events
- Authorization revision/version metadata
- Durable invitation-delivery intent/status where needed

Preserve:

- Existing company IDs
- `companies.owner_user_id`
- Membership identity and attribution
- One-company-per-user uniqueness
- Existing business records and public-token truth

Before migration:

- Inventory actual role values.
- Reconcile `owner` memberships against `owner_user_id`.
- Identify disabled memberships and ownership anomalies.
- Verify deployed grants/policies against repository migrations.
- Identify sensitive fields embedded in broadly readable records.

Do not silently promote ambiguous legacy memberships. Quarantine inconsistencies for explicit correction.

Deploy schema and enforcement compatibly, then enable the Team UI. Do not expose controls before their authority exists.

## V. Security / tenancy invariants

The implementation must prove:

- A user cannot choose their tenant through request parameters.
- A user cannot create or modify their own membership.
- An invitation cannot establish access for a different authenticated identity.
- Bootstrap and invitation acceptance cannot create competing memberships.
- Disabled membership fails authorization despite an unexpired session.
- Unknown role never grants access.
- Capability grants never bypass tenant isolation.
- Admin cannot escalate themselves or another user beyond their delegation ceiling.
- Owner identity and membership remain consistent.
- Ownership transfer cannot leave the company ownerless.
- Role changes cannot rewrite accepted commercial truth.
- Failed/lost-response retries do not duplicate memberships or access events.
- Sensitive data is protected in direct reads, exports, RPC results, and nested payloads.
- Audit truth cannot be edited by the people it records.

Revocation guarantees should be precise: new authorization after disablement fails. Already-completed downloads cannot be undone, and in-flight mutations require defined transaction ordering.

## W. Test matrix

| Area | Required tests |
|---|---|
| Bootstrap | First creation, repeat call, concurrent calls, disabled member, explicit create eligibility |
| Create/join race | Simultaneous bootstrap and acceptance; only one valid outcome |
| Invitation identity | Wrong email, unverified email, existing account, account in another company |
| Token lifecycle | Expired, revoked, rotated, reused, scanner GET, lost-response retry |
| Delegation | Admin self-escalation, peer Admin changes, denied privilege delegation, stale inviter authority |
| Overrides | Grant, restriction, deny precedence, role change, dependency validation |
| Membership | Disable/reactivate, stale JWT, direct REST/RPC/storage access |
| Ownership | Target inactive, different tenant, concurrent transfers, self-removal, recovery audit |
| Tenant isolation | Cross-company IDs in every relevant request and mutation |
| Sensitive data | Costs in JSON, commercial projections, exports, direct database reads |
| Removal handoff | Open vs completed work, reassignment failure, preserved authorship |
| Failures | Membership read error, email failure, transaction rollback, response lost after commit |
| UI/mobile | Pending/active/disabled states, wrong-account recovery, no accidental company setup |
| Regression | Proposal send, approval, scheduling, payment/refund truth, public customer access |

Use real database-policy integration tests in an isolated test environment. Mocked `can()` tests cannot prove RLS safety.

## X. Implementation phases in correct order

### 1. Reconcile authority and define the contract

Finalize roles, delegation, Owner semantics, capability definitions, and existing data anomalies.

**Stop if:** ownership or legacy role data cannot be safely mapped.

### 2. Close enforcement gaps

Implement active-membership enforcement, fail-closed roles, safe directory reads, protected mutations, and sensitive-data boundaries.

**Protected truth:** tenant IDs, commercial records, existing lifecycle eligibility.

**Proof:** direct database/API/RPC denial tests, including disabled sessions.

### 3. Establish access-state resolution

Separate authentication, existing membership, disabled access, invitation, and explicit business creation.

**Protected truth:** Slice 0A atomicity and one-company uniqueness.

**Proof:** all create/join races and unknown/error states.

### 4. Implement invitations and recovery

Add issuance, delivery status, resend/revoke, authenticated acceptance, and idempotency.

**Proof:** email mismatch, expiration, stale issuer authority, duplicate acceptance, lost responses.

### 5. Enable simple Team administration

Add bounded role changes, special access, disable/reactivate, and ownership transfer with audit history.

**Proof:** delegation ceilings and self-lockout protection.

### 6. Complete contextual entry and launch validation

Role-appropriate destinations, auth recovery, mobile checks, owner/team end-to-end journeys.

**Stop if:** any invited user can accidentally bootstrap a company, or any disabled user retains an authorization path.

Each phase should have deployable, compatible boundaries. No phase should temporarily expose broader authority to make the next one easier.

## Y. Items requiring Timothy’s product decision

Recommended choices:

1. **Owner count:** one transferable account Owner at launch.
2. **Canonical labels:** Owner, Admin, Sales, Production Lead, Field.
3. **Visibility scope:** company-wide operational visibility initially; assigned-work landing is not an ACL.
4. **Admin money defaults:** payment visibility/requesting, but no automatic refunds, costs, pricing-policy changes, or payout configuration.
5. **Sales defaults:** author/send proposals; operational approval and payment requests require special access.
6. **Invitation expiry:** seven days.
7. **Controlled-access admission:** who may create a new business after authentication?
8. **Cross-company account conflicts:** retain one-company-per-user; no automatic transfer.
9. **Ownership recovery:** define acceptable business verification and authorized support procedure.

If cost confidentiality or assigned-job-only visibility is nonnegotiable at launch, approve the corresponding enforcement work explicitly. Neither can be achieved honestly through navigation filtering.

## Z. Does this hold up against the benchmarks?

**Yes—as an architecture, provided enforcement precedes UI.**

It adopts the strongest underlying patterns:

- Explicit tenant ownership
- Authenticated invitation acceptance
- Bounded administrative delegation
- Separate financial authority
- Immediate authorization loss on disablement
- Preserved historical attribution
- Auditable access changes
- Dedicated ownership recovery

It remains simpler to operate because contractors normally see only:

**Person → Role → Occasional special access → Status.**

The sophistication belongs in the authorization engine, transactions, and recovery paths—not in a sprawling Team screen.

The unresolved risk is not whether FieldDive has enough role names. It is whether every data and mutation path consistently honors the same authority.

No implementation was performed. The repository was clean at the end of the architecture review; this report is the subsequent documentation-only addition. Production enforcement and end-to-end behavior remain to be verified during implementation.

## Research Sources

The following external sources materially informed the benchmark findings. Recommendations are FieldDive-specific architectural judgments, not claims that FieldDive already implements these systems' behavior.

| Product/system | Feature or pattern studied | Source URL | Useful pattern extracted | FieldDive disposition |
|---|---|---|---|---|
| Slack | Workspace role hierarchy and bounded administrative roles | https://slack.com/help/articles/360018112273-Types-of-roles-in-Slack | Separate account custody, routine administration, and selective delegation | **Adapt** the authority separation; **reject** mechanically copying the full role/guest UI into launch scope |
| Slack | Workspace/org ownership transfer | https://slack.com/intl/en-gb/help/articles/204401633-Transfer-ownership-of-a-workspace-or-org | Explicit transfer and protected account custody rather than ordinary role editing | **Adapt** to FieldDive's company Owner and verified recovery procedure |
| Linear | Member roles, bounded responsibility, suspension | https://linear.app/docs/members-roles | Operational responsibility can be separated from administration; suspension preserves historical attribution | **Adapt** role boundaries; **adopt** access removal without erasing history |
| Linear | Member invitations | https://linear.app/docs/invite-members | Inviter-defined access and a distinct pre-join invitation state | **Adapt** to verified existing-company acceptance and FieldDive's one-company constraint |
| Stripe | Invite team members and assign roles | https://support.stripe.com/questions/invite-team-members-or-developers-to-access-your-stripe-account?locale=en-GB | Simple identity-plus-role invitation with deliberate authority assignment | **Adapt** the simple interaction; do not copy Stripe's role vocabulary |
| Stripe | Account ownership transfer | https://support.stripe.com/questions/change-the-owner-of-a-stripe-account?locale=en-GB | Transfer to an eligible accepted user; separate ownership authority and unavailable-owner support recovery | **Adapt** to a dedicated transactional FieldDive ownership operation |

Research/tooling caveat: official public Stripe support sources were used because the installed CLI predates the current documentation-command requirements and package/tool installation was out of scope. No private Stripe account configuration or live production policy state was inspected as part of this architecture review.

Local Supabase security guidance informed the review method for membership authority, RLS, stale-session handling, and narrowly authorized database functions. The current FieldDive repository—not that guidance or the external benchmarks—was used as the evidence for the repo gaps in section R.

PHASE 13 COMPANY ACCESS & USER ONBOARDING ARCHITECTURE READY  NO IMPLEMENTATION PERFORMED
