# FieldDive Phase 13C — First-Time Business Activation and Contractor Operating Model

Research and implementation-neutral product recommendation. September 28, 2026 (America/Chicago).

Status: RESEARCH COMPLETE; PRODUCT DECISIONS REQUIRED. This report does not authorize implementation, alter Phase 13B, or approve production rollout.

## Executive decision

Design for an owner running a small business, not an owner assembling departments. Preserve the ability to add specialists, but do not make the contractor declare a salesperson, estimator, production manager, and office manager before doing useful work.

The evidence supports overlapping responsibilities, family participation, and both employed and subcontracted labor. It does **not** establish a representative organization chart, an employee-count threshold for hiring sales, or a universal rule that only the foreman should use software. Those claims would exceed the research.

Recommended direction:

1. Preserve the Phase 13B access engine. A person's authority, responsibility for a job, and membership in a physical crew are different things.
2. Keep Owner naturally capable of the whole operating journey. Do not require additional departmental identities or role switching.
3. Do not replace Production Lead with Crew Lead. The former currently has company-wide operational authority; the latter describes a potentially job-scoped responsibility. A reassuring label must not conceal broader access.
4. Make team setup optional. When inviting someone, explain the work and reach of the access rather than presenting an organization chart. Test “Office manager” as an alternative to Admin; do not silently rename the locked role.
5. Recommend a small, optional Crew concept with a lead/contact, independent of accounts. This is a NEW DIRECTION against the present free-text crew label and deferred workforce model. Approve it separately; it is not a prerequisite for first-proposal activation.
6. Retain FIRST REAL PROPOSAL SENT as the operational activation hypothesis. Track a contractor-reviewed, ready-to-send proposal as the earlier first-value signal. Neither is yet demonstrated to predict FieldDive retention.
7. Use a hybrid first-run experience: minimal company creation, a real job, a bounded preparation step when commercial inputs become necessary, contextual recovery, and optional setup access. Neither a compulsory global checklist nor a surprise chain of missing fields at Send is adequate.

Would a small roofer recognize this? The model accommodates credible operating arrangements without forcing departments or accounts for every worker. Whether it is easier than alternatives still requires observed contractor use; documentation research cannot honestly prove that outcome.

## Research contract, authority, and evidence method

### Scope and interpretation

The prompt's “28,” “13,” “45,” and “68” are treated as **2–8**, **1–3**, **4–5**, and **6–8** people, consistent with the canonical ICP. They are not 28-, 13-, 45-, or 68-person organizations. The 1–3 band includes the smallest adjacent owner-operated case.

“People” requires clarification in every interview: owners, office staff, payroll installers, temporary workers, subcontractor principals, and subcontractor installers are not interchangeable headcounts. Two office employees coordinating three outside crews are not operationally equivalent to a two-person repair business.

Primary context is US residential retail roofing and small exterior contracting. Adjacent remodeling, field-service, construction, scheduling, and SaaS sources inform patterns, not roofing prevalence. Insurance-restoration organizations, large commercial contractors, and enterprise dispatch are not the target model.

### Canonical material read first

- [Product execution standards](fielddive-product-execution-standards.md).
- [UI/product cohesion standard](fielddive-ui-product-cohesion-standard.md).
- [Audit playbook](fielddive-audit-playbook.md).
- [Phase 13 access implementation blueprint](phase13-company-access-user-onboarding-implementation-blueprint.md), including the completed Phase H record and production-rollout separation.
- [Supporting Astra architecture V2](phase13-company-access-user-onboarding-astra-architecture-v2.md).

The handoff and targeted access, responsibility, readiness, and send code were also inspected read-only. Repository reference at research time: `da6eb10f7c01c3167f47abb2e549c7aabe86a6aa`. Line references below describe that snapshot, not immutable future locations.

Phase 13B is closed for architecture, code, staging, adversarial, desktop, and true-390 proof. Production rollout is separate. Phase 13C owns business activation; a wholesale redesign of returning/invited destinations belongs to 13D, not this report.

### Evidence labels

| Label | Meaning |
| --- | --- |
| DOCUMENTED PATTERN | An authoritative source establishes the behavior or a credible study establishes the stated population result. An official feature document proves product behavior, not contractor preference. |
| LIKELY PATTERN | A reasoned synthesis consistent with multiple sources, but without representative prevalence evidence for this ICP. |
| ANECDOTAL SIGNAL | A named company, interview, self-description, or community account. Useful existence proof, not a percentage or universal rule. |
| REQUIRES VALIDATION | The evidence cannot settle the question; contractor observation or product testing is necessary. |

No competitor accounts were created and no live onboarding funnels were completed. “Best observed” means the strongest documented pattern among the sources reviewed, judged for this problem—not a measured market-wide winner. Steps are documented workflow steps; decision counts are lower bounds, not click counts, elapsed-time studies, or guaranteed signup requirements. Official commercial pages are weaker usability evidence than help workflows. No conversion uplift is inferred from a feature existing.

Sources were accessed during this research. Published/updated dates are recorded where recoverable; undated and relative timestamps are identified. Search crawl dates are not treated as publication dates. Community material is not used to establish product capabilities or employment-law conclusions.

### Recommendation classifications

- **ASTRA-EXPLICIT:** directly supported by established FieldDive architecture/governance, with research support where available.
- **ASTRA-ALIGNED IMPROVEMENT:** synthesis consistent with that foundation, without changing an established product boundary.
- **NEW DIRECTION:** changes a locked presentation, expands an operational model, or adds material capability. Explicit approval required even when research makes it attractive.

Research alone does not make a new capability ASTRA-EXPLICIT. The recommendation register in Part 8 governs classifications throughout; subrecommendations inherit the referenced ID unless explicitly classified otherwise.

### Current-product guardrails

| Current truth | Consequence for 13C |
| --- | --- |
| Blueprint §1.2/§1.10 lock Owner, Admin, Sales, Production Lead, Field. | Renaming or removing them is a decision, not copy cleanup. |
| Exactly one custody Owner; one company membership per user, including disabled membership constraints. | Do not promise two equal custody Owners or cross-company subcontractor accounts. Legal partnership is not the custody model. |
| Server-resolved creator eligibility, invitation, membership, disabled, and unavailable states already exist. | A signed-in person with no membership is not automatically entitled to create a business. |
| Owner profile enumerates active capabilities; it is not an unrestricted wildcard. | Multi-hat work can be natural without bypassing policy or future reserved capabilities. See `app/lib/access/registry.ts:107`. |
| Admin is a broad operating/team profile, not merely a receptionist; payments/pricing are not all default powers. | “Office” must not misleadingly imply narrow access or full financial authority. |
| Production Lead is company-scoped; Field is granted-job scoped. | A one-job foreman must not be made company-wide coordinator just to get an understandable title. |
| Job grants, task assignment, production responsibility, and scheduling have separate meanings, with some existing explicit coupling. | Preserve the designed mutation paths; do not infer access from a new crew roster. |
| `jobs.assigned_to` identifies a member; `crew_label` is optional text, not resource planning. | A persistent crew, non-login person, or separate onsite-lead record is new product modeling. See `app/lib/jobTypes.ts:189` and `app/lib/jobResponsibilityPersistence.ts:76`. |
| Strong sign-in is shipped for sensitive management actions, not ordinary work. | Do not repeat the superseded “MFA unavailable” limitation or put step-up in everyday field tasks. Blueprint §2.11 controls. |

Important uncertainty: `app/lib/access/registry.ts:189` marks `lead_assigned_work` active and scoped to granted jobs, while the completed Phase H record says it remains a later special-access package. Earlier delegation/proof text also differs from the registry's assignable-by declaration. This report does not adjudicate runtime exposure from one declaration. A launch lead preset requires reconciliation of the canonical closure record, UI availability, server delegation, and end-to-end proof. Do not represent that preset as already delivered.

## Part 1 — Real contractor operating model

### A. ICP reality summary

The strongest conclusion is variation with substantial role overlap, not a miniature departmental chart. A useful operating model describes who makes decisions and who carries out work on each job; titles and employment arrangements are secondary descriptors.

There is credible adjacent quantitative support for genuinely small construction businesses. NAHB's 2024 remodeler member census reports a median five employees. Its builder census reports six payroll employees and substantial reliance on subcontractors. These are association-member, adjacent-sector findings, not a roofing population estimate or proof of the same staffing mix at FieldDive customers. [NAHB remodelers, September 11, 2025](https://www.nahb.org/blog/2025/09/who-are-nahb-remodelers); [NAHB builders, August 26, 2025](https://www.nahb.org/blog/2025/08/nahb-member-census-builders-in-2024).

A contemporary roofing survey is not automatically more applicable: the residential respondent profile in Roofing Contractor's 2026 report has its largest employee-size group at 26–100. That sample cannot establish the organization chart of a 2–8-person firm. [Survey respondent profile](https://www.roofingcontractor.com/articles/101717-who-took-the-survey).

Operationally, distinguish three forms of small business:

- **Working owner with a small installation/repair crew:** the owner may sell and estimate around site work.
- **Owner/office core with one employed or mixed crew:** commercial work and field execution overlap but are not identical responsibilities.
- **Small contracting/coordination core using outside crews:** few internal staff can oversee considerably more physical labor.

These are LIKELY PATTERNS supported by the cases below, not mutually exclusive market segments with measured shares. Do not ask a first-time user to choose one before work; discover the distinction when assignments and collaboration become relevant. Recommendation R01, ASTRA-ALIGNED IMPROVEMENT.

### B. Common organization patterns and hypothesis verdicts

| Hypothesis | Research verdict | Evidence strength and limitation |
| --- | --- | --- |
| A. Owner + crew | Support as a credible arrangement; not a universal default roster. | Named owner-operated examples below; prevalence REQUIRES VALIDATION. |
| B. Owner + son/family member + crew | Support as an existing arrangement. Family members may sell, administer, lead, or install—not one family role. | ANECDOTAL SIGNAL from named family businesses. |
| C. Owner + spouse/office + crew | Support as an existing arrangement. The spouse may be a full business operator, not a clerical helper. | ANECDOTAL SIGNAL; broad quantitative frequency unavailable. |
| D. Owner + foreman + crew | Support the responsibility distinction; a supervisor need not manage all company production. | DOCUMENTED occupational duties plus company cases; size threshold unknown. |
| E. Owner + office + lead + crew | Plausible at the larger end or with outside crews; do not mandate these as three separate people. | LIKELY PATTERN, not a documented headcount formula. |
| F. Owner sells, estimates, schedules, and manages production | Strong existence evidence; preserve as a first-class path. | Multiple named cases; cannot quantify how often all duties remain with Owner. |
| G. Site-responsible person need not be company-wide Production Manager | Support. Responsibility scope matters more than title. | Occupational evidence supports supervision of particular work/crew; company-wide software authority is a separate design decision. |
| H. Many physical workers may not need accounts | Support “may”; reject “therefore most never need accounts.” | Products support supervisor reporting and non-user subcontractors; competing products encourage distributed photo contribution. Actual adoption rates unknown. |
| I. Dedicated Sales appears only beyond this ICP | Reject as a sizing rule. Keep Sales optional, not absent. | Small family-core counterexample includes multiple sellers; no reliable hiring threshold found. |

Named evidence, with limits:

- Atlas profiles a roofing couple whose earlier arrangement had one partner handling office, marketing, appointments, and production before the other joined the office. This supports overlapping duties and evolving spouse participation, not a typical headcount. The undated page discusses early-2022 circumstances. [Atlas, Love Is in the Square](https://www.atlasroofing.com/asphalt-life/love-is-in-the-square).
- Sustainable Roofing's husband-and-wife interview describes hands-on administrative, lead, and customer work. Exact employee count is not established. [Roofing Contractor interview](https://www.roofingcontractor.com/articles/99364-sustainable-roofing-helping-roofs-breathe-easier).
- The Craddock interview describes father-and-sons selling, office administration, a superintendent, a spouse handling accounting, and longstanding crews. Its small internal core is not the complete onsite workforce. It directly challenges “small means no distinct sales.” The vendor-hosted transcript is an anecdote; its page date and references to an earlier award are inconsistent, so it is not treated as a freshly verified 2026 staffing census. [Roofr, Craddock interview](https://roofr.com/podcasts/all-in-the-family-tom-lawson-craddock).
- Roof-Tech describes two principals splitting production from sales, scheduling, and administration; a son progressed through field and lead responsibilities. The company does not establish a current 2–8 headcount, but demonstrates why partnership and responsibility must not be collapsed into one software title. [Roof-Tech, company description](https://www.rooftechrepairs.net/aboutus).
- Worrell's company profile describes an owner as the customer contact from estimate through invoice, six full-time workers, and subcontracted specialty work. This is company self-report with unverified freshness, not independently audited staffing. [Worrell Roofing company profile](https://www.linkedin.com/company/worrell-roofing-co.).

### C. Company-size evolution: scenarios, not hiring laws

No credible source reviewed establishes that Office appears at four people, Sales at six, or Production Manager at eight. The following is a product stress-test framework, not empirical frequency data.

| Size band | Credible operating arrangements to support | Software implication | What not to infer |
| --- | --- | --- | --- |
| 1–3 | Owner alone plus outside labor; owner + partner/spouse; owner + one or two field workers. | One account must complete the commercial journey. A second account is added for actual participation. | No crew, no subcontractors, low revenue, or no salesperson. |
| 4–5 | Working owner with a small crew; owner + office + installers; small commercial core coordinating subs. | Optional office access; job-scoped field contributor/lead; ability to describe work performed without every worker logging in. | Four distinct management roles or a full office department. |
| 6–8 | Owner + office + onsite lead + workers; two selling partners with subcontractor crews; mixed labor; some dedicated selling/coordinating. | Clear handoff and accountability become useful; optional specialist access can grow without resetting the business. | Dedicated production manager, one crew only, or eight paid software users. |

The evolution trigger should be repeated coordination pain or a new participant's real work, not a numeric company-size gate. R02, ASTRA-ALIGNED IMPROVEMENT.

#### Responsibility map to test across all three bands

| Work | Small-company candidate performer | When splitting becomes useful | Data/authority implication |
| --- | --- | --- | --- |
| Own the business | One owner, couple, family, or partners | Legal ownership can remain shared regardless of app custody | Do not infer equity from the custody Owner label. |
| Sell and discuss options | Owner, partner, dedicated salesperson | Concurrent leads or specialist selling | Optional commercial profile; not a compulsory department. |
| Estimate | Owner, salesperson with estimating skill, estimator | Volume/complexity | Pricing authority and ability to sell need not be identical. |
| Create proposals | Same person or office preparing for review | Clerical preparation separated from approval | Preparation does not automatically imply authority to change pricing policy. |
| Schedule | Owner, office, company coordinator | More simultaneous jobs/crews | Distinguish company scheduling from leading one assigned job. |
| Order materials | Owner, coordinator, lead, office placing an approved order | Procurement handoff | Material confirmation is not automatically purchase authority; no new ordering feature implied. |
| Talk to homeowner | Seller initially; owner/office/lead during work | Explicit handoff after sale | Current job contact should be understandable without exposing all internal roles. |
| Manage after sale | Owner or coordinator | Multiple concurrent jobs | May differ from physical onsite lead. |
| Direct crew/site safety and quality | Working owner or foreman/lead | Owner cannot remain onsite | Role terminology must communicate scope, not elevate the whole company. |
| Upload photos and close tasks | Lead, owner, or individual contributors | Evidence originates from multiple people | Account need depends on direct contribution and attribution requirements. |
| Office/admin | Owner, partner/spouse, employee, sometimes external bookkeeper | Repeated customer/admin load | “Trusted” does not specify which commercial or team powers are appropriate. |
| Payments | Owner or explicitly authorized office person | Collections delegated | Separate requesting payment, history, refunds, and sensitive account decisions. |

This map is LIKELY PATTERN synthesis, not a claim that every listed combination has been measured. O*NET documents construction supervisors directing work, coordinating schedules, estimating/requisitioning materials, inspecting, and keeping records; BLS describes roofers' installation, repair, and measurement duties. Neither source establishes account ownership or FieldDive role names. [O*NET 47-1011.00, 2026](https://www.onetonline.org/link/summary/47-1011.00); [BLS Roofers](https://www.bls.gov/ooh/construction-and-extraction/roofers.htm).

### D. Who actually uses software

There is no defensible researched percentage of 2–8-person roofers giving every installer a login. The product should accommodate several participation levels:

| Participant | When an account is valuable | When it may be unnecessary |
| --- | --- | --- |
| Owner | Creates/reviews proposals, schedules, approves, collects, reviews field evidence | The intended operating customer normally needs an account; do not create separate accounts per hat. |
| Office person | Maintains jobs/customers, prepares proposals, schedules, performs authorized collections | Occasional outside support receiving an authorized document may not need ongoing access. |
| Crew lead | Reads current assigned scope, contributes photos, manages permitted job work, reports issues | A lead receiving instructions by existing external communication may be represented without app access, with another person recording updates. |
| Installer/helper | Direct task ownership, own photos, measurement evidence, personal accountability | Work can be represented by crew and an authenticated reporter when individual digital participation provides no value. |
| Subcontractor principal | Ongoing direct collaboration across assigned jobs, if supported by company-access constraints | A contact receiving a work order is not necessarily a software user. |
| Temporary worker | Repeated direct contribution justifies onboarding | Short-term physical participation alone is insufficient reason to create access. |

These are product recommendations, not observed adoption statistics. R03, ASTRA-EXPLICIT for the separation; R04, ASTRA-ALIGNED IMPROVEMENT for participation-based invitation.

### E. Crew, foreman, and subcontractor model

“Crew” is useful when the same work group is assigned repeatedly, even if its individual members change. “Foreman” or “Crew Lead” describes who directs that work; it need not denote company-wide coordination or permission to view finances. Employment type and access type must remain independent.

Named examples and adjacent census evidence establish employed, subcontracted, and mixed arrangements. A March 2026 roofing discussion supplies additional mixed-crew accounts, but contradictory “most companies” assertions remain anecdotal and are not adopted. [Community discussion](https://www.reddit.com/r/Roofing/comments/1rjdv5i/do_most_roofing_companies_use_subcontractor_crews/).

Do not infer licensing, employment classification, insurance, or compliance from a “subcontractor” label. This report does not prescribe legal requirements. A non-login worker means no software identity, not an unlicensed worker.

Operationally distinguish company job coordinator, onsite lead, work group, and app reporter. In a simple job one person may occupy the first, second, and fourth positions. Show additional distinctions only when they differ. R05, ASTRA-ALIGNED IMPROVEMENT as a mental model; new stored responsibility/crew entities are N02/N03, NEW DIRECTION.

### F. Multi-hat owner model

The Owner should create a customer, measure, prepare/send a proposal, approve accepted work, schedule, contribute field evidence, request payment, and complete the job under one identity, subject to existing business gates. Do not ask which department they are acting as. R06, ASTRA-EXPLICIT.

Default to the current actor only where the existing workflow supports that responsibility and the choice remains visible/reversible. Do not populate a fictitious crew or invent separate sales/production assignees. Knowing that the creator is Owner does not prove they will install the roof or serve as onsite contact. R07, ASTRA-ALIGNED IMPROVEMENT.

### G. Family-business patterns

| Scenario | Natural FieldDive treatment | Risk to avoid |
| --- | --- | --- |
| Owner + spouse in office | Invite only when useful; choose authority from actual office/commercial duties; separately review sensitive powers. | Automatically treating spouse as Admin, financial controller, or low-authority receptionist. |
| Father + son + crew | Determine whether son sells, leads work, installs, or does several; use one identity with supported authority. | Encoding kinship or seniority as access. |
| Two partners + crew | Explain one platform custody Owner; second partner receives reviewed supported access. | Promising two equal Owners or full financial parity through packages currently reserved. |
| Owner + trusted foreman | Assigned-job operational access is the intended fit when only particular jobs are led. | Using company-wide Production Lead merely because it contains “Lead.” |

Software supports these arrangements best when it models work and access without demanding family labels. No reviewed evidence establishes one vendor as empirically best for family businesses. R08, ASTRA-ALIGNED IMPROVEMENT; custody and delegation limits remain ASTRA-EXPLICIT.

### H. Current assumptions research supports

- A small contractor needs one continuous job, not departmental identities.
- Owner should be operationally complete without a setup permission exercise.
- Access, assignment, responsibility, and crew should not be synonymous.
- Field-only participants should receive operational truth without commercial exposure by default.
- User invitations can wait until another person needs to participate.
- Readiness can be derived and explained near the relevant work.
- Proposal sending is a plausible meaningful operating milestone, stronger than account or job creation alone.

The first five have direct architectural support and operational evidence. The last two are design/activation hypotheses with benchmark support, not measured FieldDive outcomes.

### I. Current assumptions research challenges

- “Sales is too advanced for 2–8 people” is unsupported.
- “Production Lead” and “Crew Lead” are not interchangeable access scopes.
- “Office” alone is not a safe description of the broad existing Admin profile.
- “Every worker needs a user” is unnecessary; “only the lead needs a user” is also too rigid.
- A team-count field cannot reveal actual company structure or outsourced labor.
- A readiness engine does not eliminate the need for an understandable preparation step.
- An empty board's first-proposal CTA is not enough if the next experience is an unexplained settings dependency chain.
- “Sent” is not delivery, acceptance, or proven retention; commercial outcomes need honest distinctions.
- A free-text crew label is not already a persistent crew system.

## Part 2 — Benchmark analysis by problem

### 2.1 First-business setup and owner-only work

**Best observed combination:** ServiceM8's bounded startup guidance and real-job learning; Linear's start-small organizational approach. Not a recommendation to copy either complete onboarding.

ServiceM8 documents business setup, optional integrations/import, a test job, learning the job lifecycle, and later go-live preparation. Its app guide moves through a job card, checklist/notes, scheduling, quoting, and sending. This demonstrates a hybrid rather than a pure wizard or pure empty state. The advertised completion time is not a measured FieldDive target. [ServiceM8 getting started](https://support.servicem8.com/help-center/getting-started); [app starting guide](https://support.servicem8.com/help-center/app/basics/new-to-the-servicem8-app-start-here).

Linear begins with one team and allows organization to grow later; its demo is separate from production work. The valuable analogy is postponing organization design, not treating a default software team as a real roofing crew. [Linear workspaces](https://linear.app/docs/workspaces); [teams](https://linear.app/docs/teams); [start guide](https://linear.app/docs/start-guide).

**Decision burden:** ServiceM8's documentation describes several setup domains; it does not establish the exact minimum live signup decisions. Linear avoids initial multi-team design. FieldDive should not invent a competitor click count from help articles.

**Why it works:** useful work precedes organizational completeness; a bounded guide makes dependencies learnable.

**Weakness:** configuration instructions can still become homework. A test job can pollute real records unless isolated and unmistakable.

**Fit:** FIT WITH ADAPTATION. R09 hybrid activation; R01 no upfront org chart. A new demo/sandbox system is N06, NEW DIRECTION—not required for 13C.

Jobber's Core documentation provides a separate concrete example of a single-user quote/job/invoice workflow. Its Core startup guide recommends eight setup areas, with estimates totaling about an hour. Those are recommendations, not proven mandatory entry gates. Borrow lifecycle continuity, not the entire initial setup agenda. [Core plan, August 13, 2026](https://help.getjobber.com/en/articles/the-core-plan/); [Core first steps, June 2, 2025](https://help.getjobber.com/en/articles/first-steps-just-for-core/).

### 2.2 Adding office help and inviting users

**Best observed approach:** a short named-person invitation with a comprehensible access choice and optional advanced settings.

BuildBook documents account-level internal-team invitation using name/email and Admin or Member; external participants are invited at project level. This is one main access-policy decision after identity entry, with context handling the relationship. It is a particularly legible separation of internal business participation from project collaboration. [BuildBook team management, January 20, 2026](https://help.buildbook.co/en/articles/10030045-inviting-and-managing-your-team).

Jobber documents Manage Team → add person → name/email → permission level → optional customization → save/invite. It defaults the permission selection to Field crew rather than demanding a capability matrix. The relevant lower bound is one role choice plus identity; custom permissions add decisions. [Jobber team management, August 18, 2026](https://help.getjobber.com/en/articles/manage-teamhow-to-add-manage-and-deactivate-team-members/).

**Why it works:** identity, access, and invitation outcome are understandable; advanced options do not have to lead.

**Weakness:** a default can be mistaken for a recommendation, and “Admin” may be overly broad for an office helper. Invitation simplicity must not hide sensitive authority.

**Fit:** DIRECTLY FITS FIELDIVE at the pattern level, within the existing invite/security engine. Keep explicit selection where safety requires it; do not change the locked flow merely to match a competitor default. R04/R10. BuildBook's external participation model is only FIT WITH ADAPTATION; cross-company access is not current FieldDive capability.

### 2.3 Role selection and special access

**Best observed lesson:** familiar titles need a short scope explanation; title familiarity alone is not safety.

Jobber's permissions ladder distinguishes Field crew, Senior field crew, Crew lead, and Manager. Its Crew lead inherits commercial capabilities and adds broad schedule/timesheet visibility. Thus a seemingly perfect small-contractor label can mean much more than leading one installation. [Jobber user permissions, August 19, 2026](https://help.getjobber.com/en/articles/user-permissions/).

Housecall Pro uses Office Staff and Field Tech terminology, with configurable permissions. Its documentation illustrates that using Office Staff to solve a visibility need can bring job/pricing powers unless configured carefully. “Office” is a documented market term, not proof it matches FieldDive's current Admin grant. [Housecall Pro roles and permissions](https://help.housecallpro.com/en/articles/1073431-employee-roles-permissions-explained).

**Why it works when done well:** users choose a recognizable work pattern, then understand reach and exceptions.

**Weakness:** inherited permission ladders make apparently harmless choices powerful. Long customization lists recreate an access-control exercise.

**Fit:** FIT WITH ADAPTATION. Borrow concise role descriptions and progressive exceptions; DO NOT FIT FIELDIVE: copying competitor role grants, broadly elevating a foreman, or mapping spouse to Admin automatically. R10/R11; label change N01.

### 2.4 Adding a field lead without company-wide access

**Best observed boundary:** Buildxact Onsite distinguishes account-level access from invited crew access to selected job information, tasks, and shared documents/photos. Invitation still creates participation with identity; it is not evidence for anonymous crew users. [Buildxact Onsite](https://help.buildxact.com/en/articles/8388056-what-is-buildxact-onsite).

**Workflow:** choose relevant work and participant, invite, expose the shared field context. The exact initial screen count is not documented sufficiently for a numeric claim.

**Why it works:** field collaboration is framed around the job rather than ownership of the whole business.

**Weakness:** job access alone does not establish authority to coordinate other workers or change schedule. Those actions must remain explicit.

**Fit:** DIRECTLY FITS FIELDIVE's scoped-work principle. A polished FieldDive lead experience still depends on resolving the `lead_assigned_work` closure/exposure discrepancy. R11, ASTRA-ALIGNED IMPROVEMENT conditional on existing capability proof, not a claim of shipped UI.

### 2.5 Representing crews

**Best roofing-specific observed approach:** AccuLynx's crew-oriented field product and subcontractor crew management. Its official app listing describes named crews, lead contacts, and job assignment; its product page describes job instructions, photos, checklists, and job-request responses. These are vendor-documented workflows, not comparative usability results. [AccuLynx Crew App](https://acculynx.com/mobile-crew-app/); [official Android listing, updated July 14, 2026](https://play.google.com/store/apps/details?hl=en&id=com.acculynx.crew).

**Best simple batch-assignment example:** Jobber's September 8, 2026 crew feature groups team members for assignment. The documented creation choices are crew name and members, then Save. At research time it is web-only, permits one crew per member, and does not support a designated lead. Membership changes do not rewrite existing visit assignments. [Jobber crew scheduling](https://help.getjobber.com/en/articles/crew-scheduling/).

**Why these work:** repeated work groups can be selected once; field information stays tied to work rather than a general CRM.

**Weakness:** a roster built from paid users may exclude real non-login labor; rigid membership and desktop-only administration can fail an owner operating on a phone. Mature crew products can also add more coordination than one small crew needs.

**Fit:** FIT WITH ADAPTATION. Borrow a reusable crew identity and assignment history; do not copy an account-only roster, full dispatch product, or acceptance workflow wholesale. N02, NEW DIRECTION.

### 2.6 User versus worker; crews without individual logins

**Best direct roofing distinction:** JobNimbus explicitly distinguishes a subcontractor contact from a subcontractor team member. A contact can receive a static emailed work order without app access; a team member can use mobile work, photos, tasks, and forms. The two are different collaboration choices, not failed onboarding versus completed onboarding. [JobNimbus contact versus team member](https://support.jobnimbus.com/what-are-the-advantages-of-adding-a-subcontractor-as-a-team-member-instead-of-a-contact-).

Its documented non-user workflow is job → work orders → email action → related subcontractor recipient → send. That is a relevant alternative to manufacturing a login solely to communicate scope. A static document can become stale, so it is not equivalent to access to current job truth. [JobNimbus emailing work orders](https://support.jobnimbus.com/how-do-i-send-a-work-order-to-a-subcontractor).

**Best conceptual separation:** Float separates schedulable People from access-only Guests; a schedulable person may have no login, but still occupies a paid seat. Access and billing therefore require separate models too. [Float team model, July 17, 2026](https://support.float.com/en/articles/10629140-your-team); [People, August 24, 2026](https://support.float.com/en/articles/5228805-people); [Guests](https://support.float.com/en/articles/55476-guests).

**Best lead-as-reporter example:** ClockShark's CrewClock lets a supervisor record time for a crew without each person operating a phone. This proves device independence, not absence of employee records or free seats. [ClockShark crew timesheets](https://www.clockshark.com/tour/crew-timesheet-app).

**Fit:** DIRECTLY FITS FIELDIVE as distinctions; actual non-login entities are N02/N03, and a new external work-order sharing channel is N07, NEW DIRECTION. DO NOT FIT: assuming a shared login is an acceptable substitute for independent attribution.

### 2.7 Accountability without every worker logging in

**Best observed pattern:** Fieldwire separates the person recording a daily report from workforce information in that report; logs can describe work/labor without each worker submitting it. Its form behavior also distinguishes the device user from a separately captured signature. Borrow attribution clarity, not a new signature system. [Fieldwire daily reports, February 5, 2026](https://help.fieldwire.com/hc/en-us/articles/360004892152-Introduction-to-Daily-Report-Forms).

Its manpower documentation supports aggregate planning, illustrating that named digital identities are not the only way to represent physical work. This is not proof FieldDive needs labor-hour/resource planning. [Fieldwire manpower](https://help.fieldwire.com/hc/en-us/articles/360030865512-Manpower-on-the-Gantt-Chart).

**Why it works:** “reported by” need not falsely mean “person who performed every task.”

**Weakness:** aggregate reporting cannot provide individual attendance or accountability when that is genuinely required.

**Fit:** FIT WITH ADAPTATION. Preserve authenticated actor and job history now; add performed-by/crew facts only under an approved operational model. R12/N03.

### 2.8 First useful job and immediate field value

**Best observed short value loop:** CompanyCam documents project creation with name/location, taking a photo, and sharing useful evidence. Its collaboration documentation distinguishes account-based collaborators from guest participation. This is an example of making an artifact useful before configuring a business suite, not evidence to import its guest permissions into FieldDive. [CompanyCam getting started](https://help.companycam.com/en/articles/14808615-getting-started-with-companycam); [guests and collaborators](https://help.companycam.com/en/articles/15525961-guests-and-collaborators-explained).

Its crew-adoption guidance encourages wider participation. That is a useful counterweight to a foreman-only assumption, although vendor advice is not evidence that every roofer needs a seat. [CompanyCam crew adoption, August 10, 2026](https://help.companycam.com/en/articles/15934865-getting-your-crew-using-companycam-consistently).

**Why it works:** a small real artifact is visibly connected to a real property.

**Weakness:** photo value is not equivalent to adoption of estimating, contract, and job operations.

**Fit:** DIRECTLY FITS the real-job-first principle; FIT WITH ADAPTATION for role-specific contribution. Do not redefine company activation as uploading a photo. R09/R13.

### 2.9 First proposal

**Best domain fit:** Roofr's documented workflow connects job, measurements, template/catalog, proposal preparation, preview, and customer delivery. The send guide includes customer preview and multiple presentation/delivery paths. It is a useful model of continuity, not proof that first-time pricing setup is effortless. [Roofr creating proposals](https://academy.roofr.com/lesson-videos/creating-proposals); [templates](https://academy.roofr.com/lesson-videos/proposal-templates); [sending](https://academy.roofr.com/lesson-videos/sending-proposals).

**Best contextual-input adjunct:** Bonsai allows recipient selection while composing or at send and places final recipient/message review at the consequential moment. Its document import is not a structured roofing price-book import. [Bonsai document builder, August 27, 2026](https://help.hellobonsai.com/en/articles/15879228-document-builder-overview).

**Decision burden:** real scope, quantities, options/pricing, terms, and recipient cannot safely be eliminated. Templates reduce repetition; they do not establish correct contractor economics.

**Why it works:** prepared business knowledge supports a specific customer document; final review is distinct from authoring.

**Weakness:** inherited prices can look credible while being commercially wrong. A send action can hide substantial prior setup.

**Fit:** DIRECTLY FITS continuity and explicit review; FIT WITH ADAPTATION for focused setup recovery. R14/R15. New automated import is N08, not assumed delivered.

### 2.10 Onboarding progression and growth

**Best observed synthesis:** a small initial structure, contextual work, optional reusable setup, and a resumable path. The evidence supports a hybrid; it does not demonstrate that all checklists are good or all wizards are bad.

Harvest Forecast explicitly lets added people remain uninvited and without access. It is a useful growth pattern: record an operational participant before deciding whether to invite them. Its broad editing permission is not a template for FieldDive's delegation. [Harvest Forecast permissions](https://help.getharvest.com/forecast/team/manage/setting-permissions/).

BuildBook's published internal-team bands include a single-user business and small teams, while external collaboration is treated separately. This shows a growth model need not force all participants into the same internal-seat category. It is not a recommendation to copy plan boundaries. [BuildBook roles and permissions](https://help.buildbook.co/en/articles/10030044-roles-and-permissions-in-buildbook).

**Weakness:** a “progressive” system can become fragmented if it repeatedly ejects users into settings. A checklist can quietly become a sales/feature-adoption funnel rather than help with the chosen job.

**Fit:** FIT WITH ADAPTATION. R09/R16. No automatic company-size-triggered roles or forced invitation step.

### 2.11 Mobile field access

JobNimbus's subcontractor guide starts with current/upcoming work and job-specific instructions, products, photos, and actions. It also distinguishes a task checkbox from completing a work order—an important reminder not to conflate progress states. [JobNimbus subcontractor mobile guide](https://support.jobnimbus.com/how-do-i-navigate-the-mobile-app-as-a-subcontractor).

**Best observed approach:** job-first operational context with a small set of meaningful contributions. Benchmark usefulness comes from task fit, not a smaller version of the office CRM.

**Weakness:** good field tools can still depend on login, connectivity, and permissions that are unsuitable for a temporary worker; documentation is not true-390 proof.

**Fit:** DIRECTLY FITS FieldDive's restricted brief and domain truth. R17. New offline, translation, material-ordering, or guest-write capabilities require their own approval; none is smuggled into 13C.

### 2.12 Pricing/seat implications, not a pricing proposal

Competitors do not establish a single inevitable billing unit:

- Jobber ties team-user participation to plan/user capacity; its pending-user behavior also makes invitation a commercial consideration. See its team-management source in §2.2.
- Float charges for schedulable People even without login; its free Guests are access-only. See §2.6.
- ClockShark's pricing describes active-user billing; supervisor entry does not establish free worker records. [ClockShark pricing](https://www.clockshark.com/pricing/).
- ServiceM8 explains a different plan model using job and messaging allowances rather than a simple per-worker-login equation; regional entitlements must be checked before comparison. [ServiceM8 pricing explanation](https://support.servicem8.com/questions/general/how-does-servicem8-pricing-work).
- ServiceTitan documents managed and non-managed technicians, both potentially app users, with different participation constraints. “Non-managed” does not mean non-login. Its operational/billing distinctions are too specialized to copy as a small-roofer default. [ServiceTitan technician model, updated July 20, 2026](https://help.servicetitan.com/docs/managed-and-non-managed-technicians-in-fma).

For Owner + Office + Crew Lead + five workers, FieldDive should not force eight accounts solely to record the crew. Three direct app participants and five non-login workers is a valid candidate arrangement, not a mandated three-seat subscription. Billing choices remain open; avoid data modeling that predetermines them. R18, ASTRA-ALIGNED IMPROVEMENT; non-login entity capability remains N02/N03.

## Part 3 — Contractor-facing role recommendation

### 3.1 Verdict on the two proposed vocabularies

The current five-role vocabulary is architecturally coherent but not self-explanatory for every small firm. The four-role hypothesis is more familiar in places but loses useful distinctions:

| Label | Judgment |
| --- | --- |
| Owner | Keep. Explain platform custody only where managing ownership/partners, not on every job. |
| Admin | Recognizable software language, not necessarily contractor-natural. Existing authority is substantially broader than clerical office work. |
| Office | Familiar market language; too ambiguous by itself for broad Admin powers. Test a scoped description and “Office manager.” |
| Sales | Retain as an optional choice when someone actually sells/prepares proposals. Do not force the owner to choose it or require it during setup. |
| Production Lead | Retain under current lock; explain company-wide coordination. Do not treat it as an onsite foreman. |
| Crew Lead / Foreman | Use conceptually for job/crew responsibility. It is not an automatic replacement for a company-scoped access profile. Regional language preference remains untested. |
| Field | Retain as an optional login-access choice, described as work on assigned jobs. Do not use it as a roster category for everyone physically onsite. |

### 3.2 Recommended launch presentation

**Approval-safe 13C baseline:** retain all five locked labels and keys, remove organizational decisions from creator activation, and explain access at invitation time. This alone materially simplifies first use. R10, ASTRA-ALIGNED IMPROVEMENT.

**Preferred research candidate, pending approval and terminology testing:** Owner; Office manager; Field; with Sales and Production coordinator available when those work patterns are needed. This is presentation, not five required staff slots. “Production coordinator” replaces the confusing company-level “Lead,” not the authority underneath. N01, NEW DIRECTION. If not approved, retain Admin and Production Lead with clear descriptions.

Do not hide a needed role behind headcount, a growth plan, or a long “advanced” flow. Optional means not demanded during creation, not difficult to find during invitation.

| Proposed display / current mapping | Real work and ICP confidence | Conceptual default scope | Optional? Initial setup? | What it represents |
| --- | --- | --- | --- | --- |
| Owner / Owner | Multi-hat business operator; strong existence evidence | Current active Owner capabilities, existing sensitive-action assurance | One custody Owner required; assigned by legitimate creation, no role quiz | Software custody/access, not all legal ownership or physical duties |
| Office manager / Admin, N01 | Broad office/commercial operator; likely useful, exact frequency unknown | Existing broad Admin operations and team ceiling; additional money/pricing powers only as actually supported and reviewed | Optional; not initial setup | Software access profile, not spouse/family identity |
| Sales / Sales | Dedicated seller/estimator or selling partner; documented within small core firms | Current customer/job preparation, proposal and relevant measurement capabilities; no implicit team/scheduling/financial elevation | Optional; when inviting this participant | Software access profile |
| Production coordinator / Production Lead, N01 | Person coordinating jobs across company; need depends on workload, not count | Current company-wide operational coordination, without commercial proposal/payment exposure | Optional; not initial setup | Company-scoped software access plus work description |
| Field / Field | Direct mobile contributor; may be lead or installer, not every worker | Current granted-job brief, photos/measurement contributions, own-task work; additional scoped leadership only after proof/review | Optional; when direct contribution is useful | Software access profile |
| Crew Lead / no replacement role | Person directing a particular crew/site; occupationally grounded | No authority from title alone; login contributor needs explicit current job access and any approved lead capabilities | Optional operational designation; never initial company requirement | Job/crew responsibility, possibly linked to a user |

The conceptual capability descriptions above are summaries, not replacements for the registry. Reserved company-financials/internal-cost/refund packages must not be advertised as available grants. An Admin description must not promise that costs are invisible while proposal-authoring paths still involve pricing/cost inputs. `app/lib/access/registry.ts:179` through `:189` distinguishes active and reserved packages.

### 3.3 The narrow office-helper problem

A receptionist who only books visits and updates contact details is not necessarily safe under Admin. Do not solve this by calling broad Admin “Office” and assuming consent.

First test whether existing supported profiles plus reviewed restrictions/packages safely cover repeated real workflows, including dependency behavior. If not, a new narrow profile is **N04, NEW DIRECTION**, requiring repeated evidence and access proof. This report does not recommend adding it merely because a hypothetical person exists.

### 3.4 Concepts that should not become roles

- Wife, husband, son, daughter, family, trusted person, or partner.
- Crew membership, temporary status, payroll/subcontractor status, or helper.
- Onsite lead, job coordinator, salesperson-on-this-job, or performed-by attribution merely because they describe responsibility.
- Estimator, scheduler, or payment decision maker as mandatory separate identities for Owner.
- Pending invitation, disabled membership, or first-run status.
- Subscription/seat category.

These may be relationships, responsibilities, states, or future billing concepts. They are not automatic authorization profiles. R03/R08, ASTRA-EXPLICIT separation and ASTRA-ALIGNED presentation.

## Part 4 — Crew model recommendation

### 4.1 Decision

Recommend **an optional, simple Crew with a lead/contact**, not a mandatory employee roster. Allow a lead to be represented without requiring software membership. Do not require naming all workers; add individual non-login worker records only when a validated responsibility/reporting use case needs them.

This is **N02, NEW DIRECTION**, not a reinterpretation of the existing `crew_label`. It is justified as a candidate by repeated assignment patterns in §2.5–2.7, but it expands the current operational model and needs explicit approval. It should not delay owner-only first-proposal activation. A safe 13C without this approval retains the existing crew label and membership/access behavior and makes no claim to support a persistent crew roster.

Answer to “should Crew exist at launch?”: **yes for a launch that promises reusable crew operations, subject to explicit scope approval; no as a compulsory prerequisite to activating a business.** If the near-term launch promise is only existing job operations plus activation, defer the entity rather than adding an incomplete resource-planning system. The architecture must not preclude it.

### 4.2 Smallest useful concept, not a database schema

| Concept | Meaning | Required at first use? |
| --- | --- | --- |
| Crew | A reusable work-group identity selected for a job | Only if contractor chooses reusable crew assignment |
| Crew name | Contractor-recognizable label, not a generated department | Yes when creating that crew |
| Lead/contact | Person to contact about that crew's work | Ask when needed; may be Owner, another user, or non-login contact |
| Job assignment | This crew is doing this work, distinct from app access | Explicit at assignment |
| Authenticated reporter | User who records updates or completion in FieldDive | Required for authenticated mutations, not for physical presence |
| Optional members | Named workers only when a real workflow benefits | No; N03 for a first-class non-login roster |
| Optional headcount | Rough operational description, if validated useful | Not initial requirement; not a capacity/availability engine |
| Subcontractor relationship | Who the external crew belongs to/contact route | Only where relevant; no legal classification inference |

Do not ask for payroll details, trade certifications, employee status, a full crew hierarchy, time clocks, or availability rules to send the first proposal. Those are NOT NEEDED FOR ICP ACTIVATION, not assertions that the businesses never need them elsewhere.

### 4.3 Assignment and scheduling

Assigning a repeat crew can be easier than repeatedly choosing workers, but the product must still distinguish the crew from the company-side person accountable for the job. Owner may coordinate while an outside foreman directs installation.

Use the existing job/schedule authority. Do not create a separate crew calendar that competes with Company Calendar or silently changes approved scheduling. Crew selection must not assert that every member is free, available, or logged in.

A change to a reusable crew should not rewrite past job responsibility. Future work affected by a lead/member change needs an explicit review policy; do not silently change existing job access or assignment. A crew may be archived without erasing historic work. Preserve exact job assignment and authenticated actor history independently of today's crew roster. R12 and N02.

Do not constrain future data meaning to one permanent crew per person simply because a benchmark does. Equally, do not build split crews, resource optimization, or multi-trade dispatch before observed demand. The first implementation decision must state what happens when a crew changes between assignment and the work date.

### 4.4 Access and accountability

Crew membership never grants access by itself. Granting a lead access uses the Phase 13B engine and its legitimate delegation ceiling; revocation/disable behavior remains authoritative. Where an existing task assignment deliberately couples job access, retain that explicit server behavior rather than replacing it with arbitrary crew inference.

Distinguish:

- **Responsible for the job:** company-side operational responsibility.
- **Leading the crew onsite:** physical direction/contact.
- **Assigned the task:** the task's actual accountable assignee under current supported rules.
- **Recorded by:** authenticated actor who submitted a change.
- **Performed by / reported for:** optional operational fact, never impersonation.

Current task completion powers must not be widened to “complete everyone's work” just because a user is called lead. If aggregate crew completion is added, it needs an approved model and authority path; otherwise the lead reports through supported tasks and the owner/coordinator records the remaining truth. N03, NEW DIRECTION where new attribution or completion semantics are required.

Photos retain actual uploader and time. A note that a non-login worker performed the work must not overwrite uploader identity. Shared credentials are not a solution.

### 4.5 Subcontractors

A subcontractor crew may be represented operationally without receiving company membership. This is particularly important because the closed foundation does not support one user joining several FieldDive companies.

Do not create dummy emails, duplicate identities, or cross-company role exceptions to work around this. If authenticated external collaboration across companies becomes necessary, that is **N05, NEW DIRECTION**, with separate architecture and adversarial proof. A new emailed work-order/customer-like field portal is also not already available merely because JobNimbus offers one; N07 applies.

Until such a capability is approved, distinguish an internally recorded external crew from an authenticated FieldDive participant. Existing communication outside the app may remain part of the operating process; do not claim FieldDive has delivered instructions or collected acknowledgement when it has only stored a contact.

### 4.6 Growth path

Start with no crew requirement → optionally reuse a named crew/contact → add direct field contributors when useful → add specialist commercial or company-coordination access when needed. A later worker roster, multi-crew job, resource capacity, or subcontractor portal must preserve existing job and actor history.

The growth trigger is work complexity and participation, not employee count. No pricing decisions, payroll product, or scheduling optimizer are recommended here.

## Part 5 — Activation and onboarding recommendation

### 5.1 Activation event: challenge and decision

The earliest genuine value and the strongest initial operating commitment need not be the same event.

| Candidate | What it proves | Why it is insufficient or useful |
| --- | --- | --- |
| Company created | Access/bootstrap succeeded | Infrastructure, not contractor value. |
| First customer | One useful record | May be imported or abandoned; no operating outcome. |
| First job | Work has context | Necessary substrate, not evidence of useful output. |
| First measurement | A real estimating input exists | Potentially valuable, but narrower than FieldDive's operating promise. |
| First estimate | A commercial calculation exists | Can still be incomplete, unsafe, or never used. |
| First contractor-reviewed, ready proposal | Contractor has a usable priced customer artifact | Best earlier first-value candidate; review must be meaningful, not just draft creation. |
| First real proposal sent | Contractor has entrusted a customer-facing business action to FieldDive | Best current operational activation hypothesis; requires honest send evidence. |
| First customer acceptance | Customer outcome | Valuable downstream, but externally controlled and too delayed for the initial activation gate. |
| First scheduled/completed/paid job | Deeper operating adoption | Retention/expansion evidence, not a practical first-run completion requirement. |

**Decision:** retain FIRST REAL PROPOSAL SENT, R13 ASTRA-EXPLICIT, while adding the ready-proposal first-value signal, R14 ASTRA-ALIGNED IMPROVEMENT. This is a defended hypothesis, not a discovery that sending causes retention.

Activation research distinguishes onboarding, an initial value experience, and later value exchange; cohort behavior is needed to identify a meaningful retention predictor. It does not supply a universal milestone for roofing. [Amplitude, activating new users](https://amplitude.com/books/user-engagement/activating-new-users); [retention-analysis method](https://www.amplitude.com/docs/analytics/charts/retention-analysis/retention-analysis-build).

Validate against second real proposal, return to the same job, acceptance handling, scheduling, and subsequent use. Compare similar cohorts; seasonality, sales cycle, pre-existing pipeline, and assisted setup can confound results. Do not make customer acceptance a prerequisite to letting the user leave onboarding.

### 5.2 What “real” and “sent” must mean

For the activation hypothesis, the proposal represents an actual intended customer/job, has passed existing readiness gates, has been reviewed by the contractor, and has an authoritative successful send result on the supported channel. Exclude intentionally marked examples, internal tests, and failed attempts.

Avoid pretending the system can perfectly infer a fake customer or self-test from an email address. Use known test/sample contexts and explicit intent where necessary; do not penalize legitimate shared business/customer contact arrangements. “First real” remains partly an analytical definition until validated instrumentation exists.

Keep these states separate:

1. Draft exists.
2. Draft ready and reviewed.
3. Immutable/sendable version prepared.
4. Send requested or in progress.
5. Supported provider/server has confirmed successful submission.
6. Delivery confirmed, failed, or unknown, to the extent the existing channel exposes it.
7. Customer viewed or accepted, if actually recorded.

A freeze, link creation, button click, or optimistic client state is not successful sending. Provider acceptance is not proof of inbox receipt. Subsequent failure must remain visible and recoverable without quietly declaring the customer reached. Do not invent delivery telemetry the product does not have. R15, ASTRA-EXPLICIT truthfulness plus ASTRA-ALIGNED activation interpretation.

In-person presentation, download, or external manual sharing may deliver real value. Do not count an unobserved share as verified sending. Expanding the activation definition to a new confirmed-presentation/share workflow is N09, NEW DIRECTION, if it requires a new product capability or changes the locked target.

### 5.3 Readiness already exists; do not rebuild it as an onboarding database

Current source truth:

- `app/lib/companySetupReadiness.ts:65` derives company, pricing, catalog, and template signals. Its banner logic is not a mandate to complete every setting before entry; `:93` distinguishes known missing company information from unknown state.
- `app/lib/proposalBuilderReadiness.ts:70` requires job, measurement, catalog, and template readiness for new draft creation. A valid persisted draft has a specific catalog/template bypass; do not re-block it with an unrelated global onboarding score.
- `app/lib/proposalBuilderReadiness.ts:285` already preserves job/tab/return context in setup links. Reuse this continuity.
- `app/lib/proposalSendFreezeReadiness.ts:81` and following validate the draft, selected option, price consistency, customer/company identity, and policy state. Site address and logo are not universal hard blocks in that validator.
- `app/lib/proposalSendGateReadiness.ts` combines recipient/delivery, freeze, and pricing gates.
- `app/lib/proposalPaymentSendReadiness.ts:20` conditionally blocks online-deposit terms when charges are not enabled, and handles unknown terms. Payment provider connection is not a universal prerequisite.
- `app/api/proposals/send/route.ts` owns sending with access enforcement and platform delivery configuration. Contractor custom-domain/DNS setup is not established as an entry requirement.

The recommendation is a **coherent interpretation and presentation of existing readiness**, not a second authoritative “onboarding complete” flag. A checklist dismissal can be stored as presentation preference; it must not turn false or unknown commercial facts into ready. R16, ASTRA-ALIGNED IMPROVEMENT.

### 5.4 Setup requirement analysis

This table recommends when the contractor should be asked, and separately identifies current constraints. Categories can be conditional: “defaulted” is not permission to fabricate truth. “Required before product entry” refers to entering the operating business, not access to authentication/recovery pages.

| Item | Recommended classification | What to ask, derive, or defer | Current truth / boundary |
| --- | --- | --- | --- |
| Company name | REQUIRED BEFORE PRODUCT ENTRY for a creator; CAN BE DERIVED for invited member | One real display/business name; allow correction. Do not accept “My Company” as verified business identity. | Bootstrap has placeholder behavior; making the short creator step collect a valid name is R09, not new security admission. |
| Company contact information | REQUIRED BEFORE SEND where the document/channel needs it; CAN BE DERIVED in part | Reuse verified user contact as a candidate, visibly confirm business suitability; ask missing customer-facing details together. | Freeze validates company identity; exact required fields remain existing policy, not an invented legal checklist. |
| Logo/branding | CAN BE DEFERRED UNTIL LATER; CAN BE DEFAULTED for presentation | Clean text identity is sufficient; optional logo later. | Current logo warning must not become an arbitrary send block. |
| Service area | CAN BE DEFERRED UNTIL LATER | Ask only for a feature that truly uses it; property address is not company service area. | No need to infer service territory from first job. |
| User/team | Owner identity REQUIRED BEFORE PRODUCT ENTRY; other users CAN BE DEFERRED | Legitimate access resolution and one Owner; invitations when collaboration is needed. | Preserve creator admission and invitation precedence. |
| Roles | CAN BE DERIVED for creator/invited membership; others deferred | Owner comes from authorized bootstrap; invitation supplies reviewed access. No first-run role quiz. | Preserve all locked profiles and restrictions. |
| Crew | CAN BE DEFERRED UNTIL LATER | Ask at operational assignment, not company entry or proposal. | First-class crew is N02, not existing readiness. |
| Price book/catalog | REQUIRED BEFORE FIRST PROPOSAL for current fresh-draft path; CAN BE DEFAULTED only for reviewed structure | Prepare the minimum supported catalog/template combination needed for real work; do not require comprehensive inventory administration. | Current builder gate applies; persisted-draft exception must remain. Starter availability/completeness must be verified, not assumed. |
| Labor/material rates | REQUIRED BEFORE FIRST PROPOSAL insofar as used by its pricing | Ask/review actual contractor inputs; reuse confirmed rates. | No guessed “market” price or margin represented as contractor-approved. A new pricing model is out of scope. |
| Proposal template | REQUIRED BEFORE FIRST PROPOSAL for fresh drafts; CAN BE DEFAULTED if a valid reviewed template exists | Use a suitable starter only if actually available; make package/pricing implications reviewable. | A template existing does not prove its prices/terms fit the business. |
| Payment terms | REQUIRED BEFORE SEND; may be chosen during preparation | Make deposit/balance choices comprehensible before final review. | Conditional online-payment gate follows actual terms; unknown is not zero deposit. |
| Tax | REQUIRED BEFORE SEND when applicable to the proposal; CAN BE DERIVED from confirmed company policy | Carry known configuration; ask unresolved treatment before presenting authoritative totals. | No tax advice or universal zero-tax default. Do not add a new jurisdiction engine or legal hard gate through onboarding. |
| Financing | CAN BE DEFERRED UNTIL LATER | Not required for basic proposal activation; only show actual configured offering. | No invented financing availability. |
| Measurements | REQUIRED BEFORE FIRST PROPOSAL in current fresh-draft path | Capture/select a valid source and required quantities; preserve provenance. | Do not quietly bypass existing measurement readiness for easier activation. |
| Customer | REQUIRED BEFORE FIRST PROPOSAL; can be captured with first job | Minimum honest identity first; contact required for chosen send channel later. | Job-entry field requirements remain authoritative; no empty placeholder customers to game activation. |
| Property | REQUIRED BEFORE FIRST PROPOSAL as real work context | Capture/confirm location in the job flow; reuse known location. | Existing freeze treats missing site address as a warning, not universal hard block. This is a product-quality expectation, not permission to change validation silently. |
| Job | REQUIRED BEFORE FIRST PROPOSAL | The first useful operating object; ask only existing necessary intake truth. | No proposal onboarding disconnected from a real job. |
| Signature | CAN BE DEFERRED UNTIL LATER for customer signature; configured agreement policy REQUIRED BEFORE SEND | Customer signs after presentation; signature-capture setup is not a generic prerequisite. | Existing policy/snapshot rules still apply. Do not infer a universal contractor wet-signature requirement. |
| Payment provider | CAN BE DEFERRED unless online-payment terms require it; then REQUIRED BEFORE SEND | Explain the dependency at terms choice, with honest return/resume. | Charges-enabled gate applies conditionally. Never silently remove a deposit to bypass it. |
| Email sender configuration | Platform delivery REQUIRED BEFORE SEND; contractor custom-domain setup CAN BE DEFERRED / NOT NEEDED FOR ICP ACTIVATION | Confirm recipient/reply identity; platform outage/config failure belongs to recovery, not a DNS homework wizard. | Current server delivery and readiness govern. |
| Customer email/recipient | REQUIRED BEFORE SEND for email; CAN BE DEFERRED during early job work | Ask in customer/send context and retain it. | Do not confuse missing customer input with broken platform delivery. |

No mandatory crew count, org chart, invitation, financing account, full branding package, payroll record, accounting integration, or complete catalog cleanup is justified before useful work. R09/R16. This does not waive current commercial validity checks.

### 5.5 What FieldDive knows, must ask, and must not infer

**Knows from authoritative state:** authenticated identity, creator eligibility or invitation, current membership/authority, current company record, known setup facts, saved job/customer/measurement/draft, configured payment terms, and actual delivery outcomes available to the system.

**May derive safely:** creator's Owner profile; invited user's company/access; existing selected customer/property; previously confirmed catalog/template inputs; which readiness dependency blocks the intended next action; authorized return context. Derived values retain provenance and must not be presented as independently verified if they are only candidates.

**Must ask:** unknown business identity, actual customer/job truth, missing commercial inputs, consequential terms, meaningful review and send intent, and additional person's access when invited. Ask at a coherent point, not one question per error.

**Must not infer:** family authority, employee/subcontractor legal status, crew availability, real selling prices, tax treatment, permission from a job title, that Owner is onsite, or that a queued message reached a customer.

**Can wait:** team expansion, full reusable setup refinement, optional branding, financing, service-area configuration, accounting connections, and crew organization not needed for the current job.

### 5.6 Interaction architecture

1. **Resolve access before onboarding.** Existing admission/invitation/member states decide the path. Unavailable is not a new-business opportunity. R19, ASTRA-EXPLICIT.
2. **Creator: a short business-identity step.** Collect the necessary company name and any truly required unresolved identity; no employees/roles/crew/pricing survey. Explain creation once. Preserve replay-safe existing creation. R09.
3. **Offer useful work, with an unobtrusive preparation alternative.** Primary direction is a real first job/proposal. Someone without a live prospect can prepare supported business inputs without inventing sample customers. R09.
4. **Create the real job in existing context.** Customer/property/intake and measurement lead into proposal preparation; do not build a separate onboarding copy of the job. R20, ASTRA-EXPLICIT domain ownership.
5. **Resolve a bounded preparation set before priced output.** Explain the relationship: pricing rules determine calculations; catalog supplies reusable items; templates assemble proposal packages. If several are missing, present one comprehensible preparation sequence, not three disconnected settings errands. Review consequential values; retain job context. R16.
6. **Prepare and review the actual proposal.** Use valid known inputs; distinguish starter content from confirmed business data. Ask only remaining consequential questions. R14/R15.
7. **Send through existing gates.** Recipient, terms, conditional payment setup, document readiness, and delivery configuration are checked before claiming success. R15.
8. **Return to the operating job.** Show the present sent state and relevant job action. Do not leave a permanent “finish onboarding” banner or require unused capabilities for a completion score. R20.

A focused multi-step form is appropriate for a dependent task such as initial pricing preparation or a sensitive access action. A lightweight resumable checklist is appropriate when the contractor deliberately chooses business preparation. Neither should be a permanent universal progress meter. Dismissal hides guidance, not warnings about a real blocked send.

The principle KNOW IT → DO IT / NEED INPUT → ASK THERE survives research, with an important qualification: “there” means the nearest coherent work step, not the last possible button click. Quiet intelligence should reduce fragmentation, not conceal prerequisites until failure.

### 5.7 Failure and recovery

| Situation | Required product behavior | Boundary |
| --- | --- | --- |
| Access service unavailable | Honest retry state; preserve intended route | Never offer accidental company creation |
| Pending/wrong-account/expired invitation | Existing identity-specific recovery | No creator activation for an invite recipient |
| Creator leaves after creation | Resume existing company/work; no duplicate bootstrap | Do not restart an org questionnaire |
| Readiness read loading/failed | Distinguish unknown from missing; retry the failed read | Do not say “You have no catalog” on an error |
| Several real pricing dependencies missing | Explain a bounded preparation step, retaining job | No unexplained settings loop |
| Valid saved draft, company setup later incomplete | Honor existing draft-specific rules | No new global checklist block |
| Missing authority to configure a prerequisite | Explain who can resolve it, preserve work | Do not request unauthorized edits or imply technical failure |
| Online deposit chosen but payment account not ready | Explain consequence and offer authorized setup/resume or explicit terms review | Never silently change payment terms |
| Save succeeds but response is lost | Recover persisted truth before inviting duplicate work | Reuse existing safe mutation behavior |
| Send pending/failed/unknown | Preserve document and distinguish retry from duplicate send | Never infer delivery from a click |
| Another person changes relevant configuration | Re-evaluate against authoritative current/snapshot rules | No stale “ready” badge overriding real validation |
| No real job yet | Optional preparation path; easy later return | No fake data in production or fabricated activation |
| User skips optional setup | Contextual recovery when needed | No repeating general nag or penalty |

R15/R16/R19/R20. This report specifies experience invariants, not new retry algorithms or telemetry implementation.

## Part 6 — Best-pattern synthesis

### What FieldDive should borrow

- **Start small structurally:** allow useful work without declaring departments. Benchmark §2.1; R01/R09.
- **Invite a named person for a clear purpose:** short identity/access flow, with advanced authority reviewed separately. §2.2–2.4; R04/R10/R11.
- **Separate operational participants from access:** recording a crew/contact does not have to issue an invitation. §2.5–2.7; R03 and approval-dependent N02/N03.
- **Prepare a real artifact in real context:** measurement, pricing, review, and delivery stay attached to one job. §2.8–2.9; R14/R20.
- **Make field participation useful immediately:** current assigned work and meaningful contribution, not office setup. §2.11; R17.
- **Let the business grow without re-onboarding:** specialists and additional collaborators are optional extensions. §2.10; R02/R04.

### What FieldDive should improve

- Explain the reach of a role as carefully as its title. An onsite leadership label must not smuggle in company-wide visibility or money authority.
- Pair contextual setup with a coherent batch of related dependencies. Do not confuse a lack of global wizard with a complete activation experience.
- Treat the crew lead as responsibility first and software authority second; avoid forcing an account-only roster.
- Preserve the difference between recorder and performer, assignment and access, prepared and reviewed, sent and delivered.
- Make the owner-with-every-hat path ordinary rather than a degenerate version of a larger organization.
- Keep optional preparation useful without rewarding configuration for its own sake.

These are synthesis recommendations R03/R06/R09–R17, not claims that every benchmark fails them.

### What FieldDive should avoid

- A mandatory org chart, team invitation, or “select all your departments” step.
- Removing Sales because of company size, or promoting every foreman to company-wide coordination.
- Renaming broad Admin to reassuring Office without authority explanation.
- Copying an entire competitor permission ladder, crew portal, pricing plan, or dispatch system.
- Requiring individual logins merely to count workers, or banning them because the lead can report.
- Shared user credentials, dummy emails, unauthorized public field-write links, or cross-company workarounds.
- Starter rates represented as market truth, generic configuration-complete percentages, and congratulatory success before real send outcome.
- A second readiness source that contradicts domain validators.

### What the existing architecture lets FieldDive do better

The advantage is potential, not a demonstrated competitive win. FieldDive already has scope-aware authority, explicit delegation, sensitive-action assurance, restricted operational projections, and distinct lifecycle/readiness gates. These allow a calm explanation of “work on these jobs” without flattening everyone into an administrator, and a next action based on real state rather than feature-adoption checkboxes.

Existing job-preserving setup links make a contextual preparation path possible without a new onboarding workspace. Existing Owner capabilities support multi-hat operation without multiple identities. The opportunity is to make those distinctions understandable; complexity hidden underneath is valuable only if the contractor can safely predict what happens next.

## Part 7 — Risks, open questions, and validation

### 7.1 Conclusions with strong support

| Conclusion | Why confidence is strong | Limit |
| --- | --- | --- |
| Access, crew, and job responsibility are different concepts | Existing FieldDive architecture and multiple documented product models | Best presentation for this ICP still requires tests |
| Owner-only and multi-hat operation must work | Named real-company examples and single-user product workflows | Prevalence of each responsibility combination is unmeasured |
| A foreman is not necessarily a company-wide manager | Occupational duties and scope distinction | Preferred local label varies |
| Every physical worker need not personally operate an app | Documented non-user contact and supervisor-reporting workflows | Does not imply zero worker records or free seats |
| Removing Sales at small sizes would exclude real arrangements | Named small-core selling-family counterexample | No evidence for when most firms hire a dedicated seller |
| Phase 13B must remain authoritative | Closed governance and targeted source inspection | Production rollout remains separate |
| Proposal readiness cannot be reduced to onboarding completion | Existing draft/send/payment gates | Some presentation and terminology remain to be designed |

### 7.2 Weaker conclusions and explicit uncertainties

| Question | Current judgment | Evidence gap / reversible choice |
| --- | --- | --- |
| Is Office manager clearer than Admin or Office? | Promising candidate, not settled | Comparative comprehension tests with office helpers, spouses, and owners |
| Is Crew Lead or Foreman preferred? | Both plausible responsibility labels | Regional/trade/language differences; do not lock from software examples |
| Does most of the ICP have one recurring crew? | Unknown | Representative workforce and subcontractor evidence absent |
| Does a lead usually report for everyone? | Useful supported mode, not universal norm | Observe photos/tasks originating from actual workers |
| Are named non-login workers needed at launch? | Defer mandatory roster | Determine whether contact-level crew suffices for real assignment/history |
| Which first-value event predicts retention? | Ready proposal and real send are candidates | FieldDive cohorts and longitudinal outcomes required |
| How much pricing setup is tolerable before first value? | Bounded focused preparation likely better than scattered interruptions | Observed first-use tasks with real business data |
| Can current profiles cover a narrow office helper? | Not yet established | Repeated workflows and permission/dependency proof |
| Is scoped lead special access actually launch-ready? | Registry supports a concept; closure says later | Resolve server/UI/proof contract before promising it |
| How much mobile setup does Owner perform? | Cannot assume desktop-only | Observe actual devices, connectivity, interruptions, and 390px use |
| Are optional worker records commercially free? | No decision | Later subscription design; do not bake billing into identity semantics |

### 7.3 Major product risks

1. **Security disguised as wording.** A role rename can change the user's understanding without changing broad authority. Scope descriptions and safe grant paths are non-negotiable.
2. **Workforce feature creep.** A simple crew request can grow into timekeeping, payroll, attendance, skills, resource planning, and subcontractor compliance. None follows automatically from this research.
3. **Activation theater.** Generated documents, test customers, freeze events, or queued sends can inflate activation while the roofer has received little usable value.
4. **Incorrect economics.** Starter catalogs and templates may speed setup while creating wrong commercial output. Human verification must target actual rates/terms, not a ceremonial checkbox.
5. **Ambiguous accountability.** A lead completing a crew activity must not falsify individual performance, signature, or uploader attribution.
6. **Family-business overgeneralization.** Family trust does not imply broad money/team access, and a spouse may be a co-owner rather than an assistant.
7. **Headcount distortion.** Small internal staff can coordinate large subcontracted labor; payroll counts alone misclassify the operating model.
8. **Mobile exclusion.** Requiring desktop settings to complete a phone proposal can defeat the owner-operator path even if the final proposal page is responsive.
9. **Research overclaim.** Official help establishes what a product documents, not what users finish easily. Vendor cases are selected and often omit count, cost, and failed adoption.

### 7.4 Contractor validation plan before locking new direction

Use a purposive initial sample of approximately 9–12 firms across the three size bands, not a purported statistical prevalence study. Include owner-only software use, owner/spouse office, two partners, family seller/lead, employed crew, subcontracted crew, and mixed labor. Recruit beyond customers enthusiastic about software. Record both internal staff and typical outside labor.

Ask for a walkthrough of the last completed residential retail roof, using redacted artifacts with permission:

- Who received the lead, visited, measured, priced, prepared, reviewed, and sent the proposal?
- Who approved proceeding, ordered materials, scheduled, directed the site, and communicated changes?
- Who actually took photos, recorded tasks, reported issues, and requested/confirmed payment?
- Which names appeared in software, on texts, on paper, or only in the owner's memory?
- Which people used their own device/login, shared a device, or did not use software?
- Where did responsibility change, and how was the handoff communicated?
- What happened on the most recent job when the usual lead was absent or a subcontractor changed crew members?

Do not begin with “Which roles do you need?” or show a preferred org chart. First reconstruct actions and handoffs, then test labels against that reconstruction.

Test a proposed interaction architecture with these tasks:

1. Owner creates the business and prepares a real proposal using their actual pricing inputs.
2. Owner resumes after stopping midway through setup or a failed readiness read.
3. Owner invites an office participant and explains what that person can and cannot do.
4. Owner enables a lead on one job and predicts whether other jobs/finances are visible.
5. Contractor represents five workers without individual logins and identifies who reports work.
6. Two partners identify custody and actual operating authority without assuming equality the platform does not provide.
7. Owner and lead complete their relevant tasks at true 390px, with interrupted sessions and a long address/name.

Use the same realistic inputs when comparing an authorized trial of relevant competitors, preferably Roofr for proposal work, Jobber or ServiceM8 for first-job continuity, and a crew-oriented tool for field handoff. Do not claim comparative speed before observing these tasks. Do not send real customer communications or grant access during tests without explicit authorization.

Record decision count, misunderstood permissions, return-path loss, necessary help, error recovery, time to a valid reviewed artifact, and task completion—not just clicks or an overall preference score. Ask participants to explain the model back. A serious authority misunderstanding is a failure even if the flow is fast.

### 7.5 Reversible versus difficult-to-reverse decisions

Keep reversible: optional guidance wording, order of clearly equivalent preparation steps, checklist visibility, role explanations, and first-value analytics hypotheses.

Require approval before hardening: role display renames, new profile semantics, persistent crew/worker identities, separate onsite responsibility, new completion attribution, external collaboration, and activation-definition changes. These affect historical meaning, authority expectations, or product scope; they are not harmless onboarding preferences.

## Part 8 — Recommended Phase 13C product architecture

### 8.1 Operating model

One business contains real jobs. People may own, sell, administer, coordinate, lead onsite, or install; one person may do several. Software participation is optional for people who do not directly interact with the system. The job remains the context joining commercial and operational truth.

Keep three independent questions:

| Question | Authority / representation |
| --- | --- |
| Who may see or do this in FieldDive? | Existing authenticated membership, profile, grants, restrictions, scope, assurance |
| Who is responsible for this work? | Existing supported job/task responsibility; approved future responsibility extensions only |
| Which physical group is doing it? | Existing crew label; optional approved Crew model later/within explicitly approved scope |

History records who actually changed the system, regardless of who performed physical work. Do not allow the third answer to overwrite the first or second.

### 8.2 Role presentation

No creator role selector. Owner receives the existing legitimate Owner identity. When adding another person, use current roles with concise work/scope explanations; optional special access remains progressively disclosed and constrained by real authority.

Preferred label changes and scoped-lead affordances require the separate decisions identified in Part 3. Do not introduce a Crew Lead company role merely to make an invitation menu look shorter.

### 8.3 First-run state model

These are conceptual states, not proposed tables, APIs, or migrations:

| State dimension | Examples | Invariant |
| --- | --- | --- |
| Access/admission | Signed out, creator-eligible, pending invitation, active, disabled, unavailable | Existing Phase 13B authority, not onboarding inference |
| Business facts | Known valid, known missing, unknown/loading, failed read | A failed read is not missing setup |
| Intent | Start real job, prepare business first, resume existing work | Explicit current task, not permanent persona classification |
| Job/proposal progress | No job, intake, measurement, draft preparation, ready review, sent | Existing domain state owns truth |
| Readiness for action | Ready, blocked by input, blocked by authority, blocked by platform/service, not applicable | Evaluated for the next action, not one universal setup score |
| Presentation preference | Guidance visible, postponed, dismissed | Never overrides readiness or security |
| Activation evidence | First-value signal, successful real send candidate, known delivery failure/unknown | Analytical interpretation does not mutate business lifecycle |

A business may have sent its first proposal while a later user's personal introduction is incomplete. Do not force every invited person to send a proposal or initialize the company again. Conversely, an Owner may dismiss guidance without having achieved activation.

### 8.4 Readiness model

Derive from existing domain sources and retain reason/provenance. Separate business-wide reusable readiness from job-specific facts and action-specific delivery/payment conditions. Recompute when relevant state changes; never let a stored “done” flag waive existing validation.

Expose only the next coherent dependency set. “Need your pricing inputs for this proposal” is useful; “Company setup 62% complete” can imply arbitrary work and false precision. A voluntarily opened preparation view may show actual sections and known state without gamification.

Unknown, failed, absent, invalid, and not required are distinct. Where a user lacks authority, give a truthful handoff explanation instead of a Save button guaranteed to fail. An existing valid draft must be judged by its own readiness rules, not blanket company incompleteness.

### 8.5 Activation path and creator-versus-invited distinction

Creator path: authorized creation → minimal business identity → real job or optional preparation → measurement and bounded commercial preparation → reviewed proposal → explicit send → current job state.

Invited path: existing invitation/identity resolution → existing company and authorized work. No starter-data installation, no company creation, no Owner setup survey. If invited before work is assigned, retain an honest no-work state rather than a sales activation CTA.

13C must respect those boundaries; designing a new role-specific home, returning-user destination system, or full invited-user activation program is not silently absorbed from 13D. R19, ASTRA-EXPLICIT.

### 8.6 Progressive disclosure and recovery

Ask about people when adding a collaborator, about crews when assigning physical work, about payment connection when chosen terms require it, and about missing pricing when preparing priced output. Show consequences before commitment.

Preserve entered data, selected job, and authorized return destination across settings and provider steps. Resume from authoritative persisted state after interruption. Provide relevant retries and clear unresolved reasons; do not restart onboarding or fabricate success. See the recovery matrix in §5.7.

### 8.7 Mobile operating implications

The following is a role/task hypothesis grounded in field-oriented benchmark workflows, not a claim that every roofer uses the same device arrangement:

| Participant | Office/desktop work | At-jobsite phone work | Product judgment |
| --- | --- | --- | --- |
| Owner | Reusable pricing, longer proposals, customer administration, payment review | Customer/property lookup, measurement/photo review, estimate/proposal decisions, scheduling changes, calls, issues | Do not assume owner setup or proposal sending happens only on desktop |
| Office | Customer records, preparation, scheduling, authorized collections | Quick customer response and schedule/reference checks when away from desk | Mobile access can matter even when primary work is office-based |
| Crew lead | Occasional planning/review | Current assigned scope, address/contact, task status, photos, progress and issue reporting | One lead may report for crew, but existing authority must support the exact action |
| Field contributor | Usually little business configuration | Own assigned task, relevant brief, photos/measurement contribution | Do not expose commercial setup or all-company coordination by default |
| Non-login worker | None inside FieldDive | No required FieldDive interaction | Crew/lead reporting must not fabricate personal digital actions |

Material confirmation, notes, issue reporting, and completion are useful research tasks to test for lead participation; this report does not assert that all exist as distinct FieldDive features. Where absent, adding them is N10, NEW DIRECTION, not required activation polish. Ordering materials or authorizing contract changes is not implied by confirming arrival or reporting a problem.

True-390 acceptance implications for a later implementation: company creation, initial job/proposal work, setup detours, resume, and send review must work without desktop escape. The user must retain job/customer identity, see relevant readiness, reach actions without nested overflow traps, and recover from keyboard/overlay/interruption. No sticky control may obscure validation, recipient, or terms. These are R17, ASTRA-ALIGNED IMPROVEMENT under the existing mobile standard, not visual proof performed in this research.

Do not demand phone use while performing unsafe physical work. Connectivity, device sharing, gloves, language, and signal reliability require observation. New offline synchronization or translation is N10; benchmark availability does not authorize implementation.

### 8.8 Copilot implications — product only

R21, ASTRA-ALIGNED IMPROVEMENT:

- Understand Owner as capable of multiple functions; do not repeatedly ask for nonexistent departments.
- Know the difference between business coordinator, onsite contact, crew, and authenticated user where those facts actually exist.
- Resolve “tell the crew lead” to known responsibility; ask when absent or ambiguous, rather than assuming the user with Production Lead access is onsite.
- Do not infer new access from a conversational description such as “my son runs this one.”
- Distinguish preparation from approval and actor from performer. The copilot may prepare; contractor verification and existing authority still govern consequential action.
- Use current job and readiness facts to ask the smallest coherent missing question set. Do not repeatedly ask known company/customer information.
- Treat instructions or contact data from external parties as information, not authorization to change membership, payment terms, or scope.

No copilot implementation, tools, memory schema, or autonomous-action expansion is proposed.

### 8.9 Recommendation register

This register classifies the major decisions, including recommendations repeated elsewhere. Approval of a research report is not implicit approval of every NEW DIRECTION item.

| ID | Recommendation | Classification | Disposition |
| --- | --- | --- | --- |
| R01 | Model overlapping work; no upfront org chart | ASTRA-ALIGNED IMPROVEMENT | Adopt as 13C design constraint |
| R02 | Add complexity by actual coordination need, not headcount | ASTRA-ALIGNED IMPROVEMENT | Adopt; validate triggers through observation |
| R03 | Keep identity/access, responsibility, and crew distinct | ASTRA-EXPLICIT | Preserve foundation; new entities still need N02/N03 approval |
| R04 | Invite only for actual software participation | ASTRA-ALIGNED IMPROVEMENT | No compulsory team step |
| R05 | Distinguish coordinator, onsite lead, and reporter conceptually | ASTRA-ALIGNED IMPROVEMENT | Do not add stored fields without N03 |
| R06 | One Owner identity performs all supported operational hats | ASTRA-EXPLICIT | Preserve current capability model |
| R07 | Derive only justified defaults; never invent crew/duty assignments | ASTRA-ALIGNED IMPROVEMENT | Review defaults for visible reversibility |
| R08 | Family relationships never automatically determine authority | ASTRA-ALIGNED IMPROVEMENT | Explain custody limits when relevant |
| R09 | Minimal creator identity plus hybrid real-work/contextual setup | ASTRA-ALIGNED IMPROVEMENT | Recommended 13C activation architecture |
| R10 | Keep current roles absent approval; explain purpose and scope when inviting | ASTRA-ALIGNED IMPROVEMENT | No initial role picker |
| R11 | Prefer scoped field leadership over broad coordinator elevation | ASTRA-ALIGNED IMPROVEMENT | Conditional on closure/runtime/UI/proof reconciliation; no assumed shipped preset |
| R12 | Preserve actor and historical assignment truth | ASTRA-EXPLICIT | New performer/crew attribution remains N03 |
| R13 | Retain first real proposal sent as operational activation hypothesis | ASTRA-EXPLICIT | Validate with cohorts, not a causal claim |
| R14 | Track reviewed ready proposal as earlier first value | ASTRA-ALIGNED IMPROVEMENT | Define honest evidence, test usefulness |
| R15 | Separate prepared, reviewed, send attempt, send success, delivery, acceptance | ASTRA-EXPLICIT for truth; ASTRA-ALIGNED IMPROVEMENT for activation measurement | Reuse available evidence; no invented telemetry |
| R16 | Reuse action-specific readiness with coherent setup recovery | ASTRA-ALIGNED IMPROVEMENT | No competing authoritative onboarding status |
| R17 | Mobile-owner and job-focused lead paths, true 390 | ASTRA-ALIGNED IMPROVEMENT | Later real-device/browser proof required |
| R18 | Do not predetermine paid seats from physical workforce | ASTRA-ALIGNED IMPROVEMENT | Pricing remains undecided |
| R19 | Preserve creator/invited/security state boundaries and 13D scope | ASTRA-EXPLICIT | Mandatory |
| R20 | Keep activation within existing job/domain truth | ASTRA-EXPLICIT | No parallel onboarding job/document |
| R21 | Copilot understands actual hats/responsibility without authority inference | ASTRA-ALIGNED IMPROVEMENT | Product implications only |
| N01 | Rename Admin to Office manager and Production Lead to Production coordinator | NEW DIRECTION | Preferred terminology candidates; explicit approval and comprehension testing |
| N02 | Optional persistent Crew with lead/contact independent of accounts | NEW DIRECTION | Recommend bounded approval; not an activation dependency |
| N03 | Non-login worker roster, separate onsite responsibility, or new performer/crew-completion attribution | NEW DIRECTION | Approve only validated minimum; do not mandate roster |
| N04 | New narrow office-helper or other access profile | NEW DIRECTION | Not recommended without repeated unmet workflow evidence |
| N05 | Cross-company authenticated subcontractor collaboration | NEW DIRECTION | Defer; conflicts with current membership boundary |
| N06 | Isolated sample-data/demo environment | NEW DIRECTION | Optional future investigation, not 13C requirement |
| N07 | New external work-order sharing/acknowledgement/field portal | NEW DIRECTION | Do not infer from competitor workflow |
| N08 | Automatic price-book/business-document import and extraction | NEW DIRECTION | Defer capability design; manual confirmed reuse first |
| N09 | New confirmed presentation/share milestone replacing or expanding activation | NEW DIRECTION | Research if real delivery modes show current target exclusion |
| N10 | New field notes/material workflows, offline, or translation beyond current capabilities | NEW DIRECTION | Validate separately; not smuggled into mobile onboarding |

### 8.10 Decision gates before an implementation prompt

1. **Authority gate:** confirm current governance, 13C/13D boundary, production separation, and what the scoped-lead package actually exposes. No implementation prompt may resolve a doc/runtime discrepancy by assumption.
2. **Product-model gate:** choose approval-safe existing labels versus N01; approve/defer N02 and the exact subset of N03. State explicitly that unsupported cross-company access and new profile work are excluded.
3. **Activation gate:** define what counts as a real send using existing observable outcomes, how tests/failures are handled, and how earlier first value is distinguished. Do not claim retention validation without data.
4. **Readiness gate:** map every first-proposal prerequisite to its existing owner and return path. Confirm starter content availability and economic review; no fake defaults or new global checklist block.
5. **Comprehension/proof gate:** observe the owner-only, office, scoped lead, no-login crew, partner, failure/resume, and true-390 journeys. Any scope misunderstanding or fabricated readiness is a stop condition.

These are coherent architecture/acceptance groups, not a new roadmap phase or a permission to implement now.

## Evidence freshness and coverage notes

All linked sources above were accessed for this report. This compact ledger records important freshness and evidence qualifications; the supporting link sits beside each substantive claim rather than only in a bibliography.

| Source family | Date/status observed | Evidence role and limitation |
| --- | --- | --- |
| FieldDive governance and Phase H record | Current repo; Phase H September 28, 2026 | Canonical authority; production rollout not inferred complete |
| NAHB member census articles | August 26 / September 11, 2025; 2024 data | Quantitative adjacent-sector context, not roofing ICP prevalence |
| Roofing Contractor survey profile | 2026 report | Shows sample-size mismatch; not used to estimate tiny-firm roles |
| O*NET / BLS | Current occupational pages; O*NET 2026 | Duties, not software adoption or hiring thresholds |
| Atlas couple profile | Undated page; references early 2022 | Historical anecdote, not current staffing verification |
| Sustainable Roofing / Roof-Tech / Worrell | Interview/company pages; exact current headcount/freshness not established | Named operating examples only |
| Craddock transcript | Page date September 3, 2026; earlier internal event references | Date inconsistency noted; vendor-hosted anecdote |
| Roofing community thread | March 3, 2026 | Anecdotal contrast only |
| Jobber team / permissions / Core | August 18 / August 19 / August 13, 2026 | Official documented behavior, not live-tested usability |
| Jobber Core startup | June 2, 2025 | Recommended preparation, not mandatory signup funnel |
| Jobber crew scheduling | September 8, 2026 | Fresh limitations recorded; plan/app capabilities may change |
| BuildBook team / roles | Team article January 20, 2026; current roles page | Official internal/external participation pattern |
| Housecall Pro / Buildxact | Current help pages; exact stable date not retained | Official scope/workflow examples; no timing claims |
| JobNimbus | Current help pages; dates not established | Documented contact versus team-member distinction |
| AccuLynx | App listing updated July 14, 2026; product page current | Official app/product claims; no comparative trial |
| Float | Team July 17, 2026; People August 24, 2026 | Resource/access/billing distinctions |
| ClockShark / ServiceM8 | Current documentation/pricing explanations; dates not established | Billing-model implications, not prices or plan recommendation |
| Fieldwire daily reports | February 5, 2026 | Attribution/workforce pattern, not request to add daily-report module |
| CompanyCam | Getting-started/collaboration pages use relative updates; crew article August 10, 2026 | Artifact-first and participation contrast; no prevalence inference |
| Roofr Academy | Current lesson pages; stable publication dates not established | Documented proposal workflow, not measured setup speed |
| Bonsai | August 27, 2026 | Contextual recipient/review pattern, not roofing economics |
| ServiceTitan | January 23, 2026 publication / July 20 update | Counterexample: non-managed is not non-login |
| Linear / Harvest Forecast | Current docs; stable dates not established | Organizational/access patterns from adjacent software |
| Amplitude | Current conceptual/method pages; no FieldDive data | Activation research method, not proof of chosen metric |

Coverage limits: no representative 2–8-person roofing staffing survey was found; no quantified account-adoption study for that exact ICP; no live competitor signup, paid trial, or measured mobile comparison; no contractor interviews conducted in this session; no new FieldDive runtime, 390px, delivery-failure, or permission proof. Targeted repo inspection is not a re-audit of closed 13B. No tax, employment, licensing, or contract-law conclusion is offered.

## Final verdict

The right Phase 13C is not a smaller enterprise onboarding flow. It is a short route into a real job for a multi-hat owner, with coherent preparation when needed and honest recovery when blocked. Another person is invited because they have work to do in FieldDive; a worker is not made a user merely because they are present on a roof.

Preserve the security foundation. Make role reach understandable. Keep Sales available without assuming a sales department. Treat onsite leadership separately from company-wide production authority. Approve any persistent crew/worker expansion explicitly. Retain real proposal sending as the activation hypothesis while recognizing the earlier value of a reviewed usable proposal.

This is a credible, research-supported model for the target contractor. It is not yet proof that contractors prefer the exact labels or that the experience outperforms alternatives. The final “yes, that is how my company works” must come from contractors reconstructing their actual jobs and successfully using the proposed model—not from this report asserting certainty.

Only this research document was created. No app code, tests, migrations, UI, access configuration, production state, commits, or pushes were changed as part of this research.
