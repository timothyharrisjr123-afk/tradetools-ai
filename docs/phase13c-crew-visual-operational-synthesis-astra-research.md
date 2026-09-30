# FieldDive Phase 13C — Deep Visual + Operational Synthesis Research

Research date: 2026-09-29. Status: decision-ready research, not an implementation authorization.

No application code, tests, migrations, UI, commits, deployments, or competitor accounts were changed. Public reference images were downloaded into `tmp/fielddive-ui-review/phase13c-visual-research/`. This report is the only new governance/research document produced by this assignment.

## Authority, scope, and evidence rules

Required context reviewed:

- [Completed first-time activation research](phase13c-first-time-activation-astra-research.md).
- [Product execution standards](fielddive-product-execution-standards.md).
- [UI/product cohesion standard](fielddive-ui-product-cohesion-standard.md).
- [Audit playbook](fielddive-audit-playbook.md).
- [Company access/onboarding implementation blueprint](phase13-company-access-user-onboarding-implementation-blueprint.md), especially the implemented contracts in §§2.10–2.11, which supersede earlier proposed UI.
- [Access architecture v2](phase13-company-access-user-onboarding-astra-architecture-v2.md).

The target remains the approximately **2–8-person** residential roofing/small exterior business established in the preceding research, not a 28-person organization. This is execution synthesis over that research, not another organization-prevalence study.

The user's leading direction is Owner / Office Manager / Lead plus reusable crews and optional non-login workers. It is a research direction, not permission to silently alter the closed Phase 13B engine. Persistent crews, people without memberships, changed role presets, and new field workflow semantics remain explicitly classified below.

Evidence labels:

- **DOCUMENTED:** official documentation or official product walkthrough establishes behavior. This does not prove adoption or usability superiority.
- **VISUALLY OBSERVED:** an actual published UI image was opened and inspected. It is not a live interaction test.
- **SYNTHESIS:** FieldDive product judgment, not a competitor fact.
- **UNVERIFIED:** public evidence did not resolve the question. Absence of documentation is not proof a feature is absent.

Benchmark labels: **ARCHITECTURE**, **INTERACTION**, **VISUAL**. Fit labels: **DIRECTLY FITS FIELDIVE**, **FIT WITH ADAPTATION**, **DOES NOT FIT FIELDIVE**. “Best observed” means strongest among the evidence inspected for this particular problem, not an exhaustive market ranking.

Recommendation classifications:

- **ASTRA-EXPLICIT:** preserves a stated FieldDive principle, established authority, or explicit requirement.
- **ASTRA-ALIGNED IMPROVEMENT:** synthesis consistent with those boundaries.
- **NEW DIRECTION:** changes established modeling, authority, or workflow; needs explicit approval even when research supports it.

Recommendation IDs R01–R30 in Part 19 govern all subordinate design intentions. Conditional recommendations do not become approved implementation scope by appearing in a screen description.

### Research limitations that matter

The in-app browser skill was used to attempt visible-browser research, but its runtime failed before a browser session could start because of a Windows sandbox-helper launch error. The fallback was public official documentation plus downloaded public UI assets, opened with an image viewer. Four AVIF/WebP assets were decoded to PNG without layout/content edits. No authenticated competitor workflow, hover/focus behavior, actual touch target, keyboard interaction, true-390 responsiveness, or live error was tested.

AccuLynx's support knowledge-base URL was not accessible through the research tool. Official walkthroughs, current product pages, its official Google Play listing, and published UI supplied evidence. Some are historical. In particular, an app updated in 2026 can still publish a screenshot showing June 2018. A recent article update is not a screenshot capture date.

All ten requested contractor products were inspected through official material. Public visual evidence was inspected for each, but unevenly: JobNimbus's selected task form is visibly historical; FieldPulse's image is a wide mobile/tablet-like composition; Roofr supplies staged composites; BuildBook's removal example is a browser-native confirmation. None justifies a blanket product-quality verdict. Loading, failure, reactivation, first-run prerequisite recovery, and complete mobile invitation flows remain visual proof gaps.

## PART 1 — Executive decision

**Proceed with the operating direction, subject to explicit product decisions.** A reusable crew managed by a responsible person is a better foundation for the requested experience than treating every installer as a software seat. AccuLynx is the strongest inspected roofing architecture reference for that distinction. It does **not** verify every detail of the proposed Carlos/Mike/Bob/Joe/Luis model.

The coherent FieldDive version is:

1. **Team controls product access. Crews organize labor. A job assignment connects a crew and a responsible Lead to work.** These concepts can link without becoming interchangeable.
2. Owner can perform every business function and lead a crew without creating extra identities or selecting multiple roles.
3. Office Manager and Lead are promising presentation defaults, but each must describe a reviewed capability/scope contract. “Lead” cannot be a friendly rename for company-wide Production Lead.
4. A crew is reusable; its current roster is not a retroactive statement of who worked every past job.
5. Assigning an existing crew should normally require one meaningful choice. Scheduling adds dates, not another round of worker selection.
6. Keep one adaptive product, with job-focused field participation. Do not reproduce AccuLynx's app split or a dispatch center.
7. Preserve first activation: minimal identity → real job → bounded preparation → contractor review → send. Crew setup is not a proposal prerequisite.

The strongest interaction/visual ingredients are Jobber's schedule control grouping, Roofr's restrained event hierarchy, CompanyCam's field-photo access, BuildBook's flat people rows, and Linear's readable permission explanations. None should supply FieldDive's whole visual system.

The hardest missing pieces are **assignment/access lifecycle, historical attribution, Lead substitution, and honest completion semantics**, not a Create Crew form. Simplicity requires these pieces to be durable underneath a small interface.

Decision: approve the product thesis for further specification; do not issue an implementation prompt until Part 20's gates are resolved. R01–R30 apply; the architecture-changing subset is NEW DIRECTION.

## PART 2 — Deep AccuLynx crew-model teardown

### 2.1 What the evidence actually establishes

AccuLynx describes a Labor Manager that can represent a single crew resource or a subcontractor with multiple crews. Its published interface separates subcontractor details, crew rows, and invitation/linkage to the Crew App. This is an operational hierarchy, not simply a list of full CRM users. [Official labor/crew walkthrough, published May 22, 2019, updated November 5, 2024](https://acculynx.com/improving-collaboration-with-subcontractors-and-crews/).

The official Android listing describes subcontractor permissions to create/manage crews, name and color them, keep Crew Lead contact details, and view managed crews' work in calendar or list form. It does not establish a named installer roster with add/remove/history semantics. [Crew App listing, updated July 14, 2026](https://play.google.com/store/apps/details?hl=en&id=com.acculynx.crew).

The production walkthrough connects a scheduled crew and approved Labor Order to a Labor Ticket, with selected job information, instructions, photos, and checklists. That is the important handoff: a bounded package of work, not an unrestricted CRM record. [Production/labor tools walkthrough, May 15, 2019, updated November 5, 2024](https://acculynx.com/big-changes-to-production-and-labor-tools-in-acculynx/).

The current Crew App page describes accepting/rejecting requests, subcontractor reassignment between crews, job information, messages, photos, and field updates. The separate broader Field App serves a different audience. [Crew App](https://acculynx.com/mobile-crew-app/), [business management/Field App](https://acculynx.com/features/roofing-business-management/). These are official product claims, not live-tested transitions.

### 2.2 Object map and confidence

| Concept | Established by the evidence | Do not infer |
|---|---|---|
| Subcontractor/labor resource | Contact/business layer; can organize multiple crews | Every contractor must create a separate subcontracting company |
| Crew | Named, reusable operational resource | Crew equals a full-product user |
| Crew Lead | Contact associated with crew in app documentation | Every Lead contact automatically has a login or company authority |
| Crew member/installer | Individual roster CRUD was not established | Named non-login installer entity or its mandatory fields |
| App participant | Invitation/app linkage is distinct from labor record | App is accountless, free, or licensed per every physical worker |
| Labor Order/Ticket | Work package and crew/job scheduling handoff | FieldDive needs a new commercial labor-order subsystem |
| Job file | Destination for labor-related communication/evidence | Current roster rewrites past job participants |
| Assignment | Crew-related work can be scheduled/reassigned | Exact database cardinality, conflict enforcement, or immutable snapshots |

This table synthesizes the preceding sources; unverified cells are deliberate limits, not negative feature claims.

### 2.3 Answers A–O

**A — Actual model.** Labor organization + reusable crew + work package + controlled app participation. FieldDive should borrow the separation, not AccuLynx's complete procurement/admin model.

**B — Separate objects.** Subcontractor, crew, app connection, job, and labor work package are distinguishable in public evidence. A separate persisted individual installer object is unverified.

**C — Accounts.** People participating through the app need its access/invitation relationship. Public evidence does not settle every Crew Lead's identity requirement or entitlement rule. Do not require FieldDive accounts for every installer by analogy.

**D — Non-login people.** The evidence supports separating a labor resource from full CRM access. It does not prove that AccuLynx stores Mike/Bob/Joe/Luis as individual non-login records.

**E — Creation/editing.** Office-side Labor Manager and subcontractor crew-management permissions are documented. Exact office-role permissions and every crew-edit permission were not publicly verified.

**F — Recipient.** Work is exposed through crew/subcontractor app relationships and labor assignments. Exact push recipients, shared-device behavior, and multiple-recipient rules require a current demonstration.

**G — Multiple crews.** Yes for a subcontractor managing crews. Do not equate that automatically to one onsite person physically supervising simultaneous jobs.

**H — Reuse.** Existing crew resources are selected/scheduled repeatedly. This supports persistent crew identity, not repeatedly typing installers into each job.

**I — Membership change.** Individual roster-change propagation is unverified. FieldDive must decide its own current-versus-historical policy.

**J — History.** AccuLynx describes crew/job history and labor performance information; exact roster snapshots and rename behavior are not established. [Official crew-management article](https://acculynx.com/where-and-how-to-find-roofing-crews/).

**K — Office view.** Labor Manager and production scheduling expose assigned labor. The official production overview supports calendar filtering and crew coordination. [Production management](https://acculynx.com/features/roofing-production-management/).

**L — Onsite view.** The bounded labor detail supplies where/when/instructions, supported evidence, and field contributions. Check-in/out and completion controls are documented or pictured; their relationship to final commercial job closure is unverified.

**M — Visually useful.** Crew hierarchy is visible in the desktop rows. Mobile work detail makes address/date/instructions identifiable. Photo capture stays in job context.

**N — Weaknesses in inspected images.** Historical desktop uses dense columns, wrapped trade lists, and substantial container chrome. Historical mobile prioritizes a large property photo and thin headings. These are critiques of those assets, not claims about every current screen.

**O — Do not copy.** Separate apps, vendor compliance/document administration, attendance tracking, labor costing, or an approval chain are not prerequisites for FieldDive's approved outcome. Do not copy an ambiguous “Job Complete” button into the contractor lifecycle.

### 2.4 Changes and exceptions that must not be missed

AccuLynx's 2022 recap documents multiple crews on a job and additional labor-order/signoff capabilities. It was published January 11, 2023 and updated September 24, 2025. This proves a mature roofing model can need more than a single permanent job/crew slot; it does not require FieldDive to expose simultaneous multi-crew planning at launch. [2022 recap](https://acculynx.com/2022-recap/).

**FieldDive synthesis, R05/R08/R09/R22:** permit a job's work assignment history to change over time. Decide the launch unit of assignment—job-wide production assignment versus scheduled work segment—before implementation. If launch is one active crew, say so and support replacement safely. Do not claim full multi-trade/multi-crew planning merely because a selector exists.

### 2.5 Teardown verdict

**ARCHITECTURE BENCHMARK; FIT WITH ADAPTATION.** Borrow durable crew reuse, separation of labor from software access, and bounded field handoff. Improve continuity by keeping FieldDive's existing job identity, domain ownership, and effective-access model. FieldDive's named-worker lifecycle and precise history rules are its own NEW DIRECTION decisions, not copied facts.

## PART 3 — Architecture benchmark findings

| Benchmark | Documented pattern and useful boundary | Fit and FieldDive decision |
|---|---|---|
| AccuLynx | Labor resource/crew/app/work package separation, Part 2 | FIT WITH ADAPTATION; primary crew architecture reference, R05–R09 |
| BuildBook | A contact with No Access can be assigned a task; inviting participation is separate | DIRECTLY FITS FIELDIVE conceptually; keep assignment and authentication distinct, not its entire project permission model. [Assign tasks](https://help.buildbook.co/en/articles/10029930-assign-tasks) |
| FieldPulse | Assignment User receives work by email without app access; other presets distinguish company, team, and assigned-work reach | FIT WITH ADAPTATION; validates participation levels, but do not name non-login labor a “User” in FieldDive. [Role details](https://help.fieldpulse.com/settings/users-teams/user-roles) |
| JobNimbus | Subcontractor as contact versus subscribed team member yields different participation | FIT WITH ADAPTATION; explicitly distinguish operational record from app collaboration. Not our crew authority model. [Subcontractor contact/member comparison](https://support.jobnimbus.com/what-are-the-advantages-of-adding-a-subcontractor-as-a-team-member-instead-of-a-contact-) |
| Buildxact | Onsite participation is invited against jobs; crew templates help repeat selection | FIT WITH ADAPTATION for job-scoped participation; not a replacement for the selected AccuLynx-inspired crew model. [Onsite invitations](https://help.buildxact.com/en/articles/8270604-invite-users-to-the-buildxact-onsite-app) |
| HubSpot | Reusable permission sets, copying from a user, and cloning sets are distinct operations | FIT WITH ADAPTATION only if a future repeated-access need is demonstrated; no launch custom-role builder. [Permission sets, September 8, 2026](https://knowledge.hubspot.com/user-management/create-permission-sets) |
| Linear | Suspended members remain historically visible while access is removed | DIRECTLY FITS FIELDIVE's attribution/access distinction. Do not borrow workspace autojoin. [Members and roles](https://linear.app/docs/members-roles) |

Jobber, Housecall Pro, Roofr, and ServiceTitan are not selected as FieldDive crew architecture authorities. They inform interactions and information presentation below. This prevents incompatible identity assumptions from entering through an attractive calendar.

**Current authority crosswalk, R01/R02/R18/R30:**

- Existing role presets are Owner/Admin/Sales/Production Lead/Field. The proposed display set changes their presentation and potentially their authority. It is not already shipped.
- `jobs.assigned_to` is member responsibility; `crew_label` is text. Neither is a durable crew. Prior research references `app/lib/jobTypes.ts:189` and `app/lib/jobResponsibilityPersistence.ts:76`; these are inherited evidence pointers, not a new source-code audit in this report.
- Existing Field task assignment deliberately grants job access; unassignment does not automatically revoke it. Crew removal must not silently redefine that behavior.
- `lead_assigned_work` appears active in the registry while the closure record describes a later package. Resolve the discrepancy across UI, server authority, delegation, and proof before calling Lead ready.
- Team's shipped focused Settings editor supersedes the earlier drawer proposal. Do not “improve” it back to superseded architecture. Blueprint §2.10 controls.
- Phase 13D owns returning/invited destination design. This assignment researches Lead destination intent, but does not silently move implementation ownership to 13C.

## PART 4 — Interaction benchmark findings

### 4.1 Schedule assignment: preserve context, reveal the decision

**Jobber — INTERACTION/VISUAL; FIT WITH ADAPTATION.** Current new-schedule documentation describes day/week/month, filters, and an optional unscheduled panel; day view supports reassignment by dragging. Best observed ingredient: locating unplanned work beside the schedule instead of making the user leave it. Weakness for FieldDive: many controls and colored event kinds can compete. Borrow contextual editing and visible filters; avoid its user-based crew assumptions and default map/dispatch tooling. Improve with a crew-first picker and date-only roofing work where exact times are unknown. [Schedule overview, updated August 11, 2026](https://help.getjobber.com/en/articles/schedule-overview-new-schedule/), [day view, July 6, 2026](https://help.getjobber.com/en/articles/day-view-of-the-schedule-new-schedule/). New-schedule availability should not be assumed universal.

**Housecall Pro — INTERACTION/VISUAL; FIT WITH ADAPTATION.** Its documented schedule distinguishes unscheduled work, views, and color modes; drag changes can be followed by a customer-notification choice. Borrow the distinction between moving work and notifying someone. Avoid route optimization, too many view modes, or color that alternately means person/area/status without clear context. Improve by showing the actual effect of a date or crew change before an external message. [Schedule guide](https://help.housecallpro.com/en/articles/6367496-how-to-use-the-schedule-tab-calendar).

**JobNimbus — INTERACTION; FIT WITH ADAPTATION.** Mobile supports multiple calendar views and a simplified subcontractor experience. Borrow the narrower work view; avoid making a month grid the mandatory first scan for someone asking “where am I going today?” Improve with today/next work and a date control. [Mobile calendar](https://support.jobnimbus.com/how-do-i-navigate-the-mobile-app-calendar). Its record-scheduling feature is separately configured; do not conflate a task, job schedule, and work order. [Record scheduling](https://support.jobnimbus.com/how-do-i-use-record-scheduling).

**ServiceTitan — INTERACTION/VISUAL; FIT WITH ADAPTATION for context, DOES NOT FIT FIELDIVE as a whole board.** Official dispatch documentation shows an adjacent work tray and detailed resource scheduling. Borrow opening a focused job editor without losing schedule context. Avoid simultaneous activity center, dispatch telemetry, large status tray, and technician-wide dispatch controls. Improve with one relevant exception near the affected job. [Daily/weekly dispatch documentation](https://help.servicetitan.com/docs/use-the-new-daily-and-weekly-dispatch-board).

**AccuLynx — ARCHITECTURE/INTERACTION; FIT WITH ADAPTATION.** Borrow assignment to an existing operational resource plus a bounded work brief. Avoid turning initial assignment into vendor onboarding. Improve by retaining the same FieldDive job and its authoritative domains. Part 2 supplies the evidence.

R08/R11/R12 govern these adaptations. Drag/drop is optional enhancement, never the only way to assign or reschedule, and not an implied Phase 13C requirement.

### 4.2 Add a person without designing an organization

BuildBook's invitation flow uses email and a short Admin/Member selection, with invitation management in the same area. This is a strong low-decision pattern, but its labels and access breadth are not FieldDive's contracts. [Team invitations, January 20, 2026](https://help.buildbook.co/en/articles/10030045-inviting-and-managing-your-team). **INTERACTION; FIT WITH ADAPTATION.** Borrow a focused invite task; avoid requiring project-by-project permission decisions during every company invitation.

Linear documents inviting by email with role and optional team selection, plus status filtering. **INTERACTION; FIT WITH ADAPTATION.** Borrow clear pending state and recovery in place. Do not borrow reusable invite links or approved-domain autojoin; those conflict with FieldDive's controlled admission. [Invite members](https://linear.app/docs/invite-members).

FieldPulse's add-user workflow exposes rates, commissions, tags, and role configuration. **INTERACTION; DOES NOT FIT FIELDIVE for initial invitation.** It is useful counter-evidence: mature software can combine unrelated setup obligations. FieldDive should not require labor rates to let Carlos see work. [Adding users](https://help.fieldpulse.com/settings/users-teams/adding-users).

### 4.3 Field contribution

CompanyCam directly associates photos with checklist fields and supports capturing them in the work context. **INTERACTION/VISUAL; FIT WITH ADAPTATION.** Borrow context retention and evidence near the task; do not add a new checklist engine or AI completion semantics merely to match it. [Creating a checklist](https://help.companycam.com/en/articles/6828391-creating-a-checklist).

Buildxact's Site Diary flow has a job-bound update, optional photos, review, and posting. **INTERACTION/VISUAL; FIT WITH ADAPTATION.** Borrow the bounded contribution loop, not a social feed, timesheets, or a second job record. [Site Diary guide, July 31, 2026](https://help.buildxact.com/en/articles/8114529-how-do-i-use-the-daily-log-site-diary-on-buildxact-onsite).

### 4.4 First useful work

BuildBook's quick start permits beginning useful project/estimate work, rather than treating all administration as the product. CompanyCam documents a four-step new-account checklist including a project, mobile app, team, and integration. These are **INTERACTION** benchmarks, not evidence that every FieldDive owner needs those steps. [BuildBook quick start](https://help.buildbook.co/en/articles/10030042-quick-start-guide), [CompanyCam home](https://help.companycam.com/en/articles/15861466-navigating-the-companycam-web-home-screen).

**FIT WITH ADAPTATION:** make the next meaningful task accessible. **DOES NOT FIT FIELDIVE:** counting optional invitations/integrations as incomplete business activation. No comparative conversion data or timed onboarding test was obtained. R15/R16 preserve the prior research's conclusion instead of manufacturing a new activation winner.

## PART 5 — Visual benchmark findings

These are observations of the catalogued images, not inferred live behavior. Recommendations are R10–R17/R26/R27.

| Reference | What specifically works | What FieldDive should not copy |
|---|---|---|
| Jobber week/unscheduled | Bold date anchors the left; view switch is grouped; filters occupy a second tier; side panel keeps unscheduled work beside dates | Several strong green controls and saturated red blocks compete; narrow columns truncate job names |
| Roofr daily calendar | Event title/time have a stable order; light fills and narrow colored edges leave text dominant; one event action is visually stronger than navigation | Permanent right filter rail and person columns are too much at 390; staged image has inconsistent date labels, so it is not correctness proof |
| Roofr job/calendar area | Upcoming dates read before collapsed past events; task completion is visibly different from pending work | Gray section cards inside the record, extra boxes, and exposed red trash icons on each task |
| CompanyCam mobile checklist | Large named rows, dark selected tab, numerical completion, clear chevron, reachable add control | Progress rings plus repeated counts may be redundant; a large search field is excessive for two items |
| CompanyCam mobile job | Strong job/address identity and a visually dominant camera action | Large header, multiple capability tiles, sales summary, AI button, and recaps compete with field intent |
| BuildBook people | Aligned names and secondary columns; thin row separators; restrained overflow controls | Clock-only invitation status and email-as-name require interpretation; show explicit Invited wording |
| Linear team permissions | Each row pairs a plain-language action with a one-line explanation; controls align consistently; section grouping avoids a cell matrix | Dark theme and spacious desktop geometry are not mandatory; broad team settings are not crew permissions |
| Buildxact mobile diary/post | One job context, one update task, prominent submit progression | Large imagery/feed can bury work; photo-only step has excessive blank area; do not copy its yellow brand as warning color |
| ServiceTitan board | Technician/time alignment makes occupancy comparable; job detail stays adjacent | Board, tray, activity rail, global navigation, color tags, and striping create multiple simultaneous scan demands |
| FieldPulse schedule | Time block and job title are easy to locate; work is presented as rows rather than tiny calendar markers | Long people lists, commercial stamps, timesheets, and multiple navigation modes exceed a Lead's need |
| AccuLynx labor/mobile | Parent/crew distinction and job-address/photo context are legible | Historic typography, nested panels, oversized invitation treatment, and photo-first detail are not the premium target |
| JobNimbus task form | Explicit Save; related record and assignee visible in one transaction | Historical nine-field form exposes configuration before intent, with small labels and generic desktop-dialog chrome |

No competitor consistently satisfies every FieldDive cohesion rule in the inspected evidence. The right result is a single FieldDive grammar with selected mechanisms, not a collage of their widgets.

## PART 6 — Premium visual-quality analysis

### 6.1 Premium means disciplined prioritization, not decorative consistency

**SYNTHESIS, R26/R27:** A contractor should identify the current job, responsible person, next action, and relevant risk before noticing interface furniture. Refinement comes from stable alignment, deliberate density, legible values, and controls shown at the point of use.

| Mechanism | FieldDive rule | Reference lesson |
|---|---|---|
| Spacing | Use existing spacing tokens; larger gaps separate decisions, smaller gaps bind a label/value or related controls | Linear's explanation rows; Jobber's primary/secondary toolbar tiers |
| Width | Focus forms into one readable column; allow calendar width for actual comparison, not giant stretched fields | Do not give Create Crew a dashboard-sized canvas |
| Gutters | Preserve usable width at 390; one page inset, not page + card + nested card padding | CompanyCam's touchable rows help, but its nested mobile tiles are not required |
| Type | Job/name/action values stronger than labels and metadata; avoid uppercase labels everywhere | Roofr event title/time order; contrast with historical AccuLynx thin headings |
| Label/value | Put “Crew” near Carlos Crew; place Lead secondary when already implied; show difference when substituted | Reduce repeated identity, not accountability |
| Surfaces | Flat sections and rows by default; contain a genuinely independent task or overlay | BuildBook rows outperform admin cards for small lists |
| Borders/shadows | Dividers distinguish adjacent rows; shadow communicates overlay elevation, not importance | Avoid ServiceTitan-like multiple framing systems |
| Buttons | One dominant action for the current task; navigation is not a competing primary | Create/Save/Assign have explicit verbs; view links remain quieter |
| Icons | Familiar action with text where meaning is consequential; no icon-only access state | Invitation clock requires a word; destructive action needs explicit meaning |
| Color | Status/risk meaning independent of crew color; text names remain present | Roofr light event fill is useful; Jobber's saturated task blocks are not global FieldDive semantics |
| Selected state | Use clear text/shape/contrast, not hue alone | CompanyCam's selected tab is unambiguous in the image |
| Overlays | Focused task with named target, one close/cancel path, deliberate save; restore origin | An assignment editor can preserve calendar context; Team retains its shipped focused editor |
| Mobile sheet | Short picker can use a sheet; longer editing needs a full-height treatment with keyboard-safe action | No stacked sheets or bottom CTA covering the picker |
| Forms | Ask only material decisions; optional worker names remain optional; labels persist | Reject the historical JobNimbus all-fields-first pattern |
| Empty | State what is missing and the one relevant action; do not simulate data or imply failure | Empty crew list is not an onboarding crisis |
| Loading | Preserve structure; unknown is not zero workers/no crew/no jobs | Published images did not prove loading quality; this comes from FieldDive governance |
| Success | Update the row/assignment truth and use brief local confirmation if needed | No permanent “crew saved” banner |
| Risk/error | Adjacent specific explanation and recovery; banner only when exceptional/blocking across the surface | Reassignment access risk is different from normal save completion |
| Hover/focus | Keyboard-visible focus and non-hover-only actions; focus returns after dismissing an overlay | Not verified in public screenshots; mandatory FieldDive proof |

Do not invent a new font, global primary palette, exact competitor spacing measurement, or second component framework. Apply the existing cohesion standard. The photographs and published screenshots cannot establish accessible contrast ratios or actual tap dimensions. Later design must demonstrate readable long names, visible focus, and suitably sized separated touch targets at true 390, not claim them from this research.

### 6.2 What should feel different from competitors

FieldDive can be calmer because it need not expose every function simultaneously. Owner's broad capability does not imply a dashboard of every department. Lead's narrow scope does not imply an impoverished product: complete instructions, useful evidence, clear responsibility, and honest recovery can fit in a small surface.

A normal reassignment changes the job's crew line. A failed access handoff becomes a specific exception. A completed upload becomes a photo in the job. A pending upload remains visibly pending. This is a stronger paid-product signal than repeated success cards.

## PART 7 — Team/access recommendation

**R02–R04/R18: proposed presentation, not a silent role migration.**

| Contractor-facing choice | Meaning to communicate | Initial setup | Classification |
|---|---|---|---|
| Owner | Account custody plus ability to perform normal business work; can personally lead a crew | Derived for business creator; not an invite-role shortcut | ASTRA-EXPLICIT preservation |
| Office Manager | Runs agreed office workflows; exact financial/settings/team authority must be stated | Optional when inviting office help; never mandatory for owner-only activation | NEW DIRECTION if replacing/redefining Admin |
| Lead | Responsible for assigned work onsite; scoped operational contribution, not all-company production management | Optional when inviting someone who needs direct field participation | NEW DIRECTION for launch preset/mapping |
| Other work access | Existing supported Sales or Field participation where needed, revealed deliberately | Not first-run departments to configure | ASTRA-ALIGNED IMPROVEMENT in progressive presentation; authority preserved |

Do not delete Sales or Field merely to make the list look elegant. A dedicated salesperson and a worker who only uploads photos remain legitimate distinct needs. Do not label a photo-only worker Lead. Do not label an office assistant Office Manager if the selected preset silently grants powers the owner did not intend.

The Team list should show name, access profile, and honest Active/Invited/Access removed state, plus relevant action. Email is secondary and wraps. Pending invitation is not active access. The Owner row makes custody visible without offering routine remove/change-role controls.

Invite: identity/email → choose a supported work-access preset → concise scope explanation → explicit invite. Advanced supported exceptions are disclosed only when needed and permitted by the inviter's delegation ceiling. Do not expose raw capability keys or a matrix. Do not resurrect the blueprint's superseded exhaustive generated can/cannot summary; use focused accurate explanations.

Revoke/disable first, then hand off open work. Handoff failure must not restore access. Reactivation requires fresh review and does not restore old sensitive grants automatically. Resend invitation must not imply that delivery or acceptance is known. These preserve the closed 13B contract.

An office spouse, partner, or son gets their own identity. Family relationship is not a permission. Two business partners do not require two custody Owners; a trusted operating role can be broad while account ownership stays singular.

## PART 8 — Lead recommendation

**R03/R04/R07/R20.** Use **Lead** as the leading concise label, with “Runs assigned jobs onsite” or similarly tested scope explanation. This is a product-language hypothesis, not a validated finding that every roofer prefers it.

- Crew Lead/Foreman are useful testing alternatives: more site-specific, but may suggest one crew or a particular hierarchy.
- Production Lead risks implying company-wide scheduling and production authority, the precise old problem to avoid.
- Superintendent is unnecessarily institutional for this ICP.
- Project Lead may be confused with sales/project coordination rather than onsite responsibility.
- Field Lead is more explicit but slightly less natural; test comprehension, not preference alone.

Keep three facts separate: **software access preset**, **usual manager of a crew**, and **responsible Lead on this assignment**. They often name Carlos; they need not always do so. Owner can be the latter two without changing software profile.

Lead should see assigned job brief, relevant schedule, permitted customer contact, photos, and allowed tasks. Whether Lead manages others' tasks or crew membership requires a specific grant and scoped directory projection. It must not imply team.manage, company-wide Calendar editing, proposal finances, payment decisions, or global activity access.

Allow one Lead to manage multiple durable crews in the model, but do not infer that this person is physically onsite everywhere. A temporary assignment Lead override handles absence without rewriting the crew's usual manager. Surface the override explicitly only when it differs. This is part of NEW DIRECTION assignment semantics.

## PART 9 — Reusable Crew recommendation

**R05/R07/R08: NEW DIRECTION, recommended conditional on approval.**

A Crew is a company-local reusable operational group with a recognizable name and usual Lead. It is not a login, a permission group, a payroll department, or a separate tenant.

Minimum creation decisions:

1. Crew name, with an editable suggestion such as Carlos Crew after choosing Carlos.
2. Usual Lead, selectable from eligible people; Owner is valid.
3. Optional members, selected from existing worker records or added by name.

No mandatory trade, color, phone, email, photo, license, capacity, notes, rate, or subcontractor company. A contact number belongs to the responsible person's contact context, not duplicated on every crew. If no Lead is known, permit an incomplete draft crew but make it ineligible for an accountable production assignment until responsibility is resolved; do not fabricate a lead.

**Canonical home:** a compact Crews area associated with operational organization, reachable from Team and Calendar where appropriate. Team continues to own access; Crews owns labor grouping. The exact navigation placement is a decision gate, not authorization for a new top-level module. Contextual Create Crew from assignment returns to the pending job and selects the new crew, without saving the job assignment silently.

The list needs crew name, usual Lead, current known roster summary, and relevant current/upcoming assignment. Future work/history can be opened rather than repeated across every row. Availability means known scheduled overlap only, not payroll attendance or a capacity promise.

Archive rather than erase crews with history. Archived crews disappear from new assignment choices, remain readable historically, and require review if restored. Do not make archiving delete members or revoke unrelated software access.

Subcontractor crews use the same small operational representation. Optional business/contact identification can distinguish a vendor's crews if needed. Do not add vendor compliance, labor billing, external tenant federation, or a separate subcontractor portal in this outcome.

## PART 10 — Non-login worker recommendation

**R06/R09/R19: NEW DIRECTION, recommended minimum.**

A company-local worker/person may exist without authentication. Required user-entered information is a name; a stable internal identity is needed to preserve continuity. Crew membership is a relationship to that person, not repeated text on each job.

Optional phone is justified only when direct contact is useful; it must not be required or interpreted as verified identity. Omit mandatory email, image, trade, employment classification, cost, pay, license, emergency contact, and HR notes. Active/archived status is useful for current selection and history, not employment management.

Roster is optional. A contractor may know Carlos Crew without tracking all four installers. In that case show “Members not listed” when the distinction matters, not “0 workers.” If only three names are recorded, say “3 listed members,” not a factual site headcount. Do not add capacity arithmetic just to fill a stat.

Adding software access later is an explicit **link/invite** operation for that existing person. Match candidates for review; never merge on name alone or silently claim that an unverified phone/email is the authenticated identity. Preserve the person's prior operational references and the distinct authenticated actor of each action. If Mike was listed on a job but Carlos uploaded its photos, those photos remain Carlos's contribution.

Duplicate names need small disambiguation at selection, such as current crew or optional contact fragment visible only to authorized viewers. Avoid a public employee directory. A Lead's operational roster projection must not expose all memberships, private contact details, roles, finances, or security metadata.

Crew departure does not mean company departure. Removing Mike from Carlos Crew must not erase Mike's history or remove software access he independently holds. Disabling a login does not prove the person stopped being an operational worker. Both actions require honest separate meanings.

## PART 11 — Job assignment recommendation

**R08/R09/R10/R19/R22.**

Normal interaction: open Assign crew in the job's operational context → select **Carlos Crew — Carlos** → review the resulting assignment → Save. For an existing eligible crew, this is **one substantive selection plus confirmation**, not a measured competitor click count. Dates are only required if the contractor is also scheduling work.

Use a short list/picker for a few crews, searchable when needed. A picker row shows crew name first, usual Lead second, and a relevant known conflict or inactive state. Do not expose every installer in the picker. Use a focused editor when assignment includes date/Lead changes; desktop can preserve context beside the job/calendar, while mobile needs a keyboard-safe full-height treatment if the task is long.

Immediately after save, show the actual crew, assignment Lead, and schedule truth. If no date exists, say Not scheduled; do not imply assigning a crew scheduled the job. If no software invitation was accepted, do not say the Lead received the work.

Reassignment must review affected work and access. Existing task ownership is not silently transferred to all crew members. The new crew is not marked responsible for old photos/tasks. Replacing a Lead does not rewrite prior actor attribution.

Separate four meanings without four permanent panels:

- **Crew:** labor group doing this work.
- **Assignment Lead:** accountable onsite person for this assignment.
- **Company job responsibility:** office/sales coordinator under the existing model.
- **Schedule:** when the work is expected, owned by Calendar.

When coordinator and Lead are the same, avoid redundant display, but preserve the distinctions internally. When different, use clear labels at the point of coordination. Crew defaults can prepare an assignment; defaults must not silently rewrite accepted assignment history.

### Access consequence is a hard product gate

Recommended outcome: an eligible authenticated assignment Lead gets only the job access needed for the approved work, and the UI makes that consequence clear. **This is not a claim the engine already supports crew-derived grants.** Define provenance and revocation first: replacing a crew must remove only access justified solely by that assignment, while preserving independent valid grants and existing task-grant rules. Disabling membership always wins.

Do not implement this as “set one grant row on assign, delete it on unassign” without accounting for multiple legitimate access reasons. If that durable behavior is not approved, use explicit existing job-access review and do not advertise automatic crew handoff. This is R19, NEW DIRECTION.

## PART 12 — Calendar/schedule recommendation

**R11/R12/R22.** Keep Calendar the single schedule owner. Add crew context to existing job scheduling; do not create a competing production calendar merely because the benchmark has one.

Default intent: “Smith Roof — Tuesday — Carlos Crew.” Desktop week is useful for planning; mobile chronological list is the recommended starting view. Keep existing useful modes, but do not add day/week/month/dispatch/map/resource views as a mandatory package.

Crew filter should be textual and persistent enough to remain understandable. A Lead sees authorized work, not a cosmetic filter over all-company payloads. Owner/Office can filter by crew or Lead when those are meaningful, not every non-login worker by default.

Distinguish:

- Scheduled but no crew assigned.
- Crew assigned but not scheduled.
- Scheduled and assigned.
- Schedule/assignment could not be loaded.
- Known overlapping work.

Only the last two are exceptional/risk conditions. The first two can be ordinary inline truth. “Unassigned” must not ambiguously mean both missing date and missing crew.

Use a compact job label, date/time when known, and crew text. If colors are introduced, they are secondary resource recognition, not success/warning meanings. Do not require the owner to choose a color to create a crew. No exact start time should be fabricated for an all-day roof replacement.

Known overlap deserves a contextual warning with the other job and dates, not a universal hard block: split crews, travel, partial days, and changing weather complicate actual capacity. A lead managing two crews is not automatically an onsite conflict; a person committed onsite to both may be. Define what the data knows before warning.

Borrow/avoid/improve summary:

| Product | Borrow | Avoid | FieldDive improvement |
|---|---|---|---|
| Jobber | Nearby unscheduled work and grouped filters | User-based crew model and many equal controls | Crew selection without installer-account selection |
| Housecall Pro | Explicit effect of a moved appointment | Route optimization and overloaded color modes | Keep notification choice tied to the actual changed promise |
| JobNimbus | Reduced subcontractor view and agenda option | Month-first field scanning, task/record ambiguity | Job-centered Today list with clear schedule ownership |
| ServiceTitan | Context-preserving detail/editing | Permanent dispatch tray/activity center | Reveal exceptions only for affected work |
| AccuLynx | Crew-aware production handoff | Labor administration as scheduling prerequisite | Reuse the existing job brief and Calendar |
| Roofr | Light event treatment, readable title/time | Multi-person horizontal mobile grid | One-column mobile job list with reachable date/filter controls |

Evidence is in Parts 2/4 and visual catalog. These are INTERACTION/VISUAL adaptations; only AccuLynx is the selected crew ARCHITECTURE reference. Major new resource views, drag/drop, conflict rules, or schedule cardinality are NEW DIRECTION, not styling.

## PART 13 — Lead mobile recommendation

**R13/R14/R20/R21/R27.** One adaptive FieldDive product, not a shrunken office CRM or a separate app by default.

First screen intent: **assigned work now and next**. First scan is today's job, address, timing, and a meaningful exception. Second is scope/instructions and who to contact. Third is tasks, photos, and other permitted contributions. Empty today can show next assigned work; no assignments must not look like an error or a request to set up pricing.

At the job, preserve identity while opening photos/tasks. Lead should not reconstruct which house a camera upload or task belongs to. Navigate/call are contextual actions, with homeowner information limited to what the job role needs. No commercial panels just because the same user could theoretically receive additional permissions.

Photo loop: open capture in job → take/select → review if needed → upload → visible pending/success/failure state in the same job. Retry cannot duplicate or falsely mark success. Existing photo behavior is reused; a new offline queue is not assumed.

Task loop: see current assigned/authorized tasks → complete allowed task → confirmation integrated into its row. Managing others' tasks is a scoped Lead decision, not inherited from the title. Non-login workers may be described operationally, but cannot be recorded as authenticated actors.

Issue/progress loop: if existing supported job contributions suffice, use them. A new structured issue, site note, material confirmation, or work-finished report is **R20 NEW DIRECTION** and needs an owner, recipient, state, and recovery path. Do not pretend the reserved field-notes capability is live.

Completion: a Lead reporting physical work finished must not silently trigger contractor final completion, customer closeout, financial settlement, or scope authorization. If a distinct report/verification state is necessary, explicitly approve it; otherwise remain within existing task/photo semantics and describe the limitation.

Connectivity: disclose unsent work and preserve recoverable input to the extent the approved product supports. Do not claim offline capability. Buildxact's Onsite guidance explicitly requires internet, while FieldPulse documents role-dependent offline behavior; “field app” does not imply offline parity. [Buildxact Onsite](https://help.buildxact.com/en/articles/8388056-what-is-buildxact-onsite), [FieldPulse field workflow](https://help.fieldpulse.com/getting-started/role/field-technician).

Lead-home implementation scope intersects 13D. This report supplies research intent; it does not authorize a new returning-user routing program inside 13C.

## PART 14 — First-run visual/interaction recommendation

**R15/R16/R17; activation direction preserved.** The creator should feel they are preparing a real customer's proposal, not installing an operating system.

1. Resolve existing access/creator state through 13B. Never disguise a removed/unavailable membership as an empty new business.
2. Ask missing minimal business identity in a short focused task. No department chart, team size survey, crew roster, branding project, or payment connection as universal entry gates.
3. Enter useful job work with a clear first action. Empty state explains what the job gives them, not a tour of all capabilities.
4. When proposal preparation genuinely needs missing commercial inputs, preserve the job, explain the dependency, and batch related questions into bounded preparation.
5. Return to the same proposal/task with the supplied values and an honest next action. Do not send the contractor across Settings, Pricing, Catalog, and Templates without a return path.
6. Show review before external send. A prepared draft is not sent, and a send failure is not activation.

The visual pattern is a **hybrid**: tiny initial form, task-local prerequisite editor, and optional resumable preparation guidance. A short multi-step sequence is appropriate when fields depend on earlier answers; a universal setup checklist is not mandatory.

CompanyCam's documented checklist is useful evidence for progressive guidance, but its inspected home image is a populated account without the checklist. Therefore this report does **not** claim to have visually inspected that checklist or a pristine first-run account. The image's Jump Back In treatment suggests continuity; its broad feed/dashboard is not the proposed first-run layout.

FieldDive's preparation progress should describe the current outcome, such as remaining requirements before review/send, rather than a global percentage of the product configured. Derive readiness from canonical product truth. A dismissed hint does not waive required commercial facts; a completed optional integration does not make pricing trustworthy.

Recovery states: save partial preparation; retry failed read without showing false missing setup; retain origin through reauthentication; disclose failed send; do not duplicate job/proposal on replay; return from a skipped optional step without punitive nags. If current behavior cannot support these outcomes, identify the durable missing piece before implementation, rather than pretending a wizard supplies persistence.

Invited Lead/Office users join an existing business. They do not create its identity, pricing, or first proposal unless authorized and intentionally doing that work. Crew creation is contextual operational setup after it becomes useful, not an activation milestone replacement.

## PART 15 — Access-copy/custom-access analysis

**R23: NEW DIRECTION candidate; do not launch by default.**

HubSpot officially documents copying an existing user's permissions to new users, as well as permission sets whose edits apply to their assigned users. This is direct evidence that **copy once** and **linked reusable configuration** are different product concepts. It is not proof that copying a person is simpler for a two-to-eight-person roofing company. [Permission-set guide, September 8, 2026](https://knowledge.hubspot.com/user-management/create-permission-sets).

### Recommended launch decision

Use reviewed presets plus the existing supported special-access mechanisms. Do not introduce either an arbitrary custom-role builder or “Same access as Sarah” as an everyday choice. A compact preset explanation is usually less ambiguous than understanding Sarah's accumulated exceptions.

If repeated real cases justify copying later, label it **Copy access from…**, then explicitly say it is a starting point and later changes to the source person will not update the recipient. “Same access as…” sounds like an enduring guarantee and should be avoided for a one-time copy.

### Required rules if approved

- Copy only supported, reviewable configuration within the current inviter's delegation ceiling.
- Do not copy custody Owner status, authentication/session state, MFA assurance, invitations, crew responsibility, or job assignment.
- Do not silently clone person-specific job grants, sensitive delegations, expiry dates, exceptions, or restrictions. Present a reviewed target configuration; dropping a source deny can accidentally broaden access.
- Resolve live effective policy at save, not only the earlier displayed source. A stale source or changed inviter must fail/review honestly.
- Show source provenance for the copy operation, but not a permanent person-to-person dependency.
- Audit actor, source configuration, resulting reviewed target, and time; changing Sarah later does not mutate Mike.
- Reactivation still requires its own review. Copy is not a way around removal, ownership transfer, or sensitive step-up.

Copied configurations drift by design. Repeated shared policy should eventually use a named supported profile, not a chain of people copying one another. Custom profiles become worthwhile when several people genuinely share a maintained nonstandard contract; they are not justified merely by one unusual helper.

Benchmark fit: **INTERACTION/ARCHITECTURE; FIT WITH ADAPTATION if later justified.** Linked-person access is **DOES NOT FIT FIELDIVE**. A new company-defined role editor is deferred NEW DIRECTION, not a prerequisite for Carlos's crew.

## PART 16 — FieldDive product synthesis

### 16.1 One operating model

| Question | Proposed FieldDive answer | Governing recommendation |
|---|---|---|
| Company access | Owner derived; Office Manager and scoped Lead prominent when inviting; other supported work access optional | R02–R04 |
| Crew | Reusable company-local labor group, independent of app entitlement | R05 |
| Lead | Usual crew manager plus explicit responsible person on an assignment; not automatic company-wide authority | R03/R07/R08 |
| Workers | Optional named operational people, not compulsory users or seats | R06/R24 |
| Assignment | Choose an existing crew; derive its usual Lead; review exceptions and access consequences | R08/R19 |
| Calendar | One authoritative schedule, enriched with crew context | R11/R12 |
| Job Card | Overview summarizes; authoritative assignment editor owns changes; Calendar owns dates | R10 |
| Mobile | Current assigned work, brief, photos, tasks, honest contribution states | R13/R14/R20 |
| Unusual access | Supported presets/exceptions first; no custom-role builder or person-linked permissions by default | R04/R23 |
| Growth | Add people, crews, and specialist access only when needed; preserve the same job and worker identities | R25 |

### 16.2 Five household-sized business scenarios

**Owner running the crew:** creates business, prepares/sends a proposal without crew setup. When scheduling becomes useful, can create a crew and select themselves as Lead. No second Owner/Lead account, departmental profile switching, or worker invitations.

**Owner + spouse in office:** invite spouse to the reviewed Office Manager contract. Spouse can handle authorized office work using their own identity. Do not infer ownership, payroll access, refunds, or authority to manage all users from the relationship.

**Father/son:** relationship does not determine access. If son runs the site, Lead; if son sells, supported Sales access; if both run the business, reviewed broad operating access under one custody Owner. UI must not force “son” into a production department.

**Owner + one Lead + crew:** Carlos has direct job participation; Mike/Bob/Joe/Luis are reusable optional roster records. Choosing Carlos Crew prepares its Lead once. The same crew can be assigned to the next job without recreating people.

**Owner + Office Manager + two Leads + two crews:** each crew has its usual Lead; Office sees crew/date context and known conflicts; each Lead receives only authorized work. Moving one crew's member does not mutate the other crew's access or past job attribution.

These are design walkthroughs, not observed customer tests. They establish what must be tested in Part 21.

### 16.3 What FieldDive should borrow, improve, avoid

**Borrow:** AccuLynx's durable labor distinction; contextual assignment from scheduling products; BuildBook's separation of contact from participation; CompanyCam's evidence-in-work context; restrained row/label hierarchy from Linear and the strongest contractor screenshots.

**Improve:** one job identity across office and field; explicit assignment versus access effects; optional roster without fake headcount; reviewed commercial preparation without settings scavenger hunts; visible pending/failed contributions; clear field-report versus contractor-completion boundaries.

**Avoid:** full worker seat requirements, arbitrary role creation, copied mutable-person authority, giant workforce panels, permanent dispatch telemetry, mandatory timekeeping, payroll/HR, route optimization, ERP, advanced capacity planning, separate subcontractor companies, and unapproved offline architecture.

**Use the existing architecture:** effective capability/scope checks, explicit membership states, deny/delegation rules, sensitive-action assurance, domain-owned job truth, and readiness derivation. These permit a small interface without concealing broad uncontrolled access. Do not replace them with label checks or hidden navigation.

### 16.4 Future copilot implications, not implementation

R28: distinguish who can act from who is responsible and who is listed on the crew. The Owner is not missing a salesperson simply because no salesperson account exists. Carlos's usual crew responsibility is not proof he is onsite on every assignment. A copilot may prepare an assignment from known defaults, but must not invent a Lead, grant access, authorize scope changes, or mark work complete from a roster entry.

Keep declared, derived, and confirmed facts distinguishable. An unlisted roster means unknown individual participation, not an empty jobsite. A failed upload is not evidence received. No copilot implementation is authorized here.

## PART 17 — Screen-by-screen design intent

These are content/interaction contracts, not final UI designs. Existing shell, typography, visual tokens, and domain ownership remain authoritative. Each surface inherits R26/R27 and the recommendation IDs shown. “Production area” below describes an operational content area, **not approval for a new Production tab**.

### 17.1 TEAM — R02–R04/R18

- **Screen job:** explain who can use FieldDive and manage that access safely.
- **First scan:** people, access profile, Active/Invited/Access removed state.
- **Second scan:** each person's actual relevant scope and invitation recovery.
- **Third scan:** advanced supported access and sensitive management actions on demand.
- **Primary action:** Invite person when permitted; inside an editor, Save changes.
- **Secondary actions:** resend/review invitation, edit supported access, remove/reactivate, dedicated ownership flow.
- **What it owns:** software membership/invitation management and accurate access presentation.
- **What it must not own:** crew roster, job scheduling, labor history, or employee HR.
- **What to preserve:** shipped focused Settings editor, explicit save, delegation ceiling, strong sign-in for sensitive actions.
- **What to omit:** giant matrix, raw capability IDs, all-access claims, compulsory worker invitations, role proliferation.
- **Allowed visual mechanisms:** flat rows, clear status words, restrained overflow, focused single-person editor, inline errors.
- **Disallowed visual mechanisms:** card per permission, hover-only critical actions, ambiguous clock-only state, a routine Owner-delete button.

### 17.2 CREWS — R05/R07/R09/R25

- **Screen job:** find and maintain reusable labor groups.
- **First scan:** crew names and usual Leads.
- **Second scan:** current/next assignment when known and relevant.
- **Third scan:** optional roster and history on opening a crew.
- **Primary action:** Create crew.
- **Secondary actions:** open/edit, view scheduled work, archive/reactivate with reviewed effects.
- **What it owns:** current crew identity and organization.
- **What it must not own:** app permissions, payroll, attendance, or independent schedule truth.
- **What to preserve:** persistent identity across jobs and readable historical references.
- **What to omit:** empty capacity stats, worker cost columns, mandatory vendor tiers, map views.
- **Allowed visual mechanisms:** compact list, text filter when useful, progressive detail, understated assignment link.
- **Disallowed visual mechanisms:** organization chart, boxed dashboard metrics, automatic green “available” from absence of data.

### 17.3 CREATE/EDIT CREW — R05–R07/R09

- **Screen job:** name a reusable crew and establish its usual responsibility.
- **First scan:** crew name and usual Lead.
- **Second scan:** optional members selected/reused by name.
- **Third scan:** effect of changing an existing crew on active/future assignments, if any.
- **Primary action:** Create crew or Save changes.
- **Secondary actions:** cancel; add existing/new operational person; deliberate archive where appropriate.
- **What it owns:** current crew defaults and roster, not silently changed job snapshots.
- **What it must not own:** account creation, salary, license tracking, job completion.
- **What to preserve:** pending assignment context when opened from a job; entered data after recoverable failure.
- **What to omit:** mandatory trade/color/phone/photo, invite-everyone actions, nested person-detail forms.
- **Allowed visual mechanisms:** short form, optional member list, inline add-name input, targeted change-impact review.
- **Disallowed visual mechanisms:** multistep wizard for three simple fields, sheet-on-sheet chains, bulk silent history rewrite.

### 17.4 JOB — PRODUCTION AREA — R08–R10/R19/R20

- **Screen job:** establish who is doing current production work and whether the handoff is usable.
- **First scan:** actual assignment, responsible Lead, schedule truth, blocking exception if present.
- **Second scan:** current brief/instructions and task/photo entry points.
- **Third scan:** roster details and prior assignments when requested.
- **Primary action:** Assign crew when genuinely needed; otherwise the existing lifecycle-appropriate action.
- **Secondary actions:** change crew/Lead, open Calendar, contact responsible person, view assignment history.
- **What it owns:** current operational assignment and the path to its authoritative editor.
- **What it must not own:** duplicate Calendar dates, proposal/pricing truth, final payment state, full Team management.
- **What to preserve:** one job identity and domain navigation; Overview remains summary.
- **What to omit:** giant workforce panel, repeated customer card, installer avatars without meaning, stale sales priorities.
- **Allowed visual mechanisms:** compact label/value row or small section; actionable crew name; exception beside affected assignment.
- **Disallowed visual mechanisms:** another dashboard, permanent “assigned successfully” notice, access status falsely presented as delivery confirmation.

### 17.5 CALENDAR — R11/R12/R22

- **Screen job:** understand and change when work happens, with crew context.
- **First scan:** date range and scheduled jobs.
- **Second scan:** assigned crew and relevant known overlaps/missing assignment.
- **Third scan:** filters, unscheduled work, alternative view when requested.
- **Primary action:** schedule selected work; selected-event editing has one Save action.
- **Secondary actions:** date navigation, crew/Lead filter, open job, reschedule or cancel under existing rules.
- **What it owns:** schedule truth and effects of changing dates/times.
- **What it must not own:** labor rates, custody, worker login creation, speculative resource capacity.
- **What to preserve:** existing schedule/lifecycle coherence and job links.
- **What to omit:** route optimization, permanent activity center, timesheets, every worker as a lane.
- **Allowed visual mechanisms:** restrained grid on desktop, chronological list at 390, small filter bar, contextual editor.
- **Disallowed visual mechanisms:** mandatory horizontal drag at 390, tiny month markers as only job representation, color-only meaning.

### 17.6 LEAD MOBILE HOME / ASSIGNED WORK — R13/R21

- **Screen job:** answer “where am I needed now, and what comes next?”
- **First scan:** today's assigned work, address/timing, relevant exception.
- **Second scan:** next scheduled work or genuinely unscheduled assigned work.
- **Third scan:** date/filter control and prior work where allowed.
- **Primary action:** open the relevant job; Navigate may be contextual, not a universal replacement for opening work.
- **Secondary actions:** contact office, change date, open permitted task/photo work.
- **What it owns:** scoped work orientation, not new job or schedule truth.
- **What it must not own:** company setup, sales pipeline, all-company feed, hidden unauthorized payloads.
- **What to preserve:** known membership/access states and meaningful no-work versus unavailable distinction.
- **What to omit:** billing onboarding, role switching, general analytics, month grid before job identity.
- **Allowed visual mechanisms:** one-column named job rows, readable timing, clear empty-state wording, reachable navigation.
- **Disallowed visual mechanisms:** desktop sidebar shrunk to phone, two jobs clipped into columns, nagging setup checklist.

### 17.7 LEAD JOB VIEW — R13/R14/R20/R27

- **Screen job:** perform permitted work with complete context and reliable contribution.
- **First scan:** property identity/address, current instructions, significant risk or changed scope that is actually authorized.
- **Second scan:** tasks, photos, and responsible contacts.
- **Third scan:** supporting documents and roster when useful.
- **Primary action:** context-dependent current work action; in Photos, Add photos; in Tasks, complete permitted task.
- **Secondary actions:** navigate/call, inspect scope, contribute supported update, view schedule.
- **What it owns:** field presentation of authoritative job domains and supported contributions.
- **What it must not own:** price approval, customer contract changes, settlement, or automatic commercial closure.
- **What to preserve:** job identity through capture, upload feedback, attribution, draft/retry recovery where supported.
- **What to omit:** large decorative hero photo, customer sales totals, office controls without permission.
- **Allowed visual mechanisms:** compact identity, direct domain entry, camera action in context, local pending/error states.
- **Disallowed visual mechanisms:** ambiguous Job Complete button, success before upload confirmation, sticky actions covering keyboard/sheets.

### 17.8 INVITE USER — R02–R04/R18/R23

- **Screen job:** give a specific person reviewed software access.
- **First scan:** identity and destination email.
- **Second scan:** supported work-access preset with concise scope explanation.
- **Third scan:** supported special access only if necessary and authorized.
- **Primary action:** Send invitation after review.
- **Secondary actions:** cancel; return to an existing person's access rather than create a duplicate.
- **What it owns:** invitation intent and reviewed access request.
- **What it must not own:** adding every physical worker, assigning crews, ownership transfer, linked-person permission inheritance.
- **What to preserve:** invitation acceptance validation, clear pending state, issuer authority, explicit handling of existing/removed identity.
- **What to omit:** labor rates, commission, personal password creation, broad custom-role builder, compulsory crew selection.
- **Allowed visual mechanisms:** compact form, small preset choice with explanation, focused review and local delivery failure.
- **Disallowed visual mechanisms:** prechecked broad privileges, vague “Full access,” green Active state for an invitation.

### 17.9 FIRST-RUN CREATOR FLOW — R15–R17

- **Screen job:** help an authorized creator reach useful real-job/proposal work.
- **First scan:** current real task and next action.
- **Second scan:** only missing prerequisites for that task.
- **Third scan:** optional preparation or help when requested.
- **Primary action:** Continue the real task, then Review/Send when appropriate.
- **Secondary actions:** save/return later, skip genuinely optional setup, inspect prepared information.
- **What it owns:** creator activation orchestration over existing business/job/readiness truth.
- **What it must not own:** independent readiness database, invited-user company creation, returning-user routing redesign.
- **What to preserve:** prior research's activation hypothesis, contractor review, draft continuity, existing identity/access resolver.
- **What to omit:** compulsory crew/team/payment/brand setup and invented commercial defaults.
- **Allowed visual mechanisms:** short form, bounded dependent steps, contextual prerequisite explanation, quiet resume affordance.
- **Disallowed visual mechanisms:** giant global checklist, fake example jobs in real workflow, settings scavenger hunt, repeated success banners.

## PART 18 — Visual reference catalog

All files below are under `tmp/fielddive-ui-review/phase13c-visual-research/`. They are public vendor assets, not FieldDive route captures. Open the named file to reproduce the visual observation. Source links locate the official surface even if signed asset URLs expire. Original image formats for Roofr/Linear had `.png` download names; use the `-decoded.png` copies for inspection.

### V01 — AccuLynx Labor Manager

- **Source:** [labor walkthrough](https://acculynx.com/improving-collaboration-with-subcontractors-and-crews/), image `Labor-Manager2.png`; local `acculynx-labor-manager.png`.
- **Freshness:** asset path May 2019; article updated November 2024. Historical UI.
- **Useful/borrow:** readable parent/child labor hierarchy; crew and app linkage are separate.
- **Avoid:** desktop column density and wrapped trade lists as launch presentation.
- **Class/fit:** ARCHITECTURE, VISUAL; FIT WITH ADAPTATION. Not a premium styling target.

### V02 — AccuLynx Subcontractor Details

- **Source:** same [walkthrough](https://acculynx.com/improving-collaboration-with-subcontractors-and-crews/), `Subcontractor-Details.png`; local `acculynx-subcontractor.png`.
- **Freshness:** historical May 2019 asset.
- **Useful/borrow:** explicit distinction between business/contact, crews, and app invitation.
- **Avoid:** giant invitation panel, compliance-document table, nested administrative boxes.
- **Class/fit:** ARCHITECTURE, VISUAL; FIT WITH ADAPTATION for separation only.

### V03 — AccuLynx Scheduled Jobs / Labor Details

- **Source:** [official Android listing](https://play.google.com/store/apps/details?hl=en&id=com.acculynx.crew); local `acculynx-crew-2.png`, `acculynx-crew-3.png`.
- **Freshness:** listing updated July 14, 2026; schedule screenshot visibly June 2018. Do not call it a 2026 capture.
- **Useful/borrow:** company/crew filtering and prominent address/date context.
- **Avoid:** tiny month markers as primary work navigation and oversized property photo before instructions.
- **Class/fit:** INTERACTION, VISUAL; FIT WITH ADAPTATION. `acculynx-crew-1.png` is a splash/promotional image and supplies no UI evidence.

### V04 — AccuLynx current published Crew App composite

- **Source:** [Crew App page](https://acculynx.com/mobile-crew-app/), hero asset `Mobile-Crew-App_Hero-Graphic_Man-using-his-phone…`; local `acculynx-current-mobile.png`.
- **Freshness:** asset path March 2025; pictured job March 2024; current page undated.
- **Useful/borrow:** job identity persists across detail/photos; capture versus select is explicit.
- **Avoid:** image-heavy header and copying Job Complete without understanding its semantics.
- **Class/fit:** INTERACTION, VISUAL; FIT WITH ADAPTATION. Staged composition, not live flow proof.

### V05 — Jobber week schedule with unscheduled side panel

- **Source:** [new schedule overview](https://help.getjobber.com/en/articles/schedule-overview-new-schedule/); image asset `40755553640855.Wt2KOFCS_2chkyp.webp`; local `jobber-unscheduled.webp`.
- **Freshness:** documentation August 2026; pictured April 2025 with test-account footer.
- **Useful/borrow:** date/control hierarchy and adjacent unscheduled work.
- **Avoid:** importing all control modes or saturated resource blocks.
- **Class/fit:** INTERACTION, VISUAL; FIT WITH ADAPTATION, explicitly not crew ARCHITECTURE.

### V06 — Housecall Pro calendar controls

- **Source:** [schedule guide](https://help.housecallpro.com/en/articles/6367496-how-to-use-the-schedule-tab-calendar), first calendar-toolbar annotated image; local `hcp-calendar2.png`.
- **Freshness:** pictured June 28–July 4, 2026; article accessible September 29, 2026.
- **Useful/borrow:** toolbar separates date movement, unscheduled work, and view settings.
- **Avoid:** dispatch/route controls and icon-only settings proliferation.
- **Class/fit:** INTERACTION, VISUAL; FIT WITH ADAPTATION. Red circles/arrows are documentation annotations, not UI.
- `hcp-calendar.png` is the preceding home-dashboard image highlighting the Schedule link, not a calendar screenshot; it illustrates excess dashboard surfaces, not schedule behavior.

### V07 — JobNimbus Create Task

- **Source:** [create task](https://support.jobnimbus.com/how-do-i-create-a-task), image titled Calendar - Task Create; local `jobnimbus-task.png`.
- **Freshness:** image shows November 3, 2020; historical despite current help availability.
- **Useful/borrow:** explicit assignment/related-record context and Save.
- **Avoid:** small generic dialog typography and nine-field configuration-first layout.
- **Class/fit:** INTERACTION, VISUAL; FIT WITH ADAPTATION for context, DOES NOT FIT FIELDIVE as visual target.

### V08 — Roofr job/calendar area

- **Source:** [Calendar page](https://roofr.com/calendar), “Job detail page showing scheduled events and a task checklist…”; local `roofr-job-decoded.png`.
- **Freshness:** undated current marketing asset, not a verified current release capture.
- **Useful/borrow:** upcoming work above collapsed past events.
- **Avoid:** box-in-box gray groupings and every-row destructive icon.
- **Class/fit:** VISUAL, INTERACTION; FIT WITH ADAPTATION.

### V09 — Roofr daily calendar and mobile calendar

- **Source:** [Calendar page](https://roofr.com/calendar), daily view split by Jojo Robinson/Rebecca Law/Jonathan Poppins and mobile April 9 image; local `roofr-calendar-decoded.png`, `roofr-mobile-decoded.png`.
- **Freshness:** staged images show inconsistent 2024/2025 date labels; mobile shows April 9, 2025.
- **Useful/borrow:** text-led events, light fill, narrow color edge.
- **Avoid:** multi-column mobile clipping and permanent people-filter rail.
- **Class/fit:** VISUAL; FIT WITH ADAPTATION. Do not derive calendar correctness or true-390 usability from these composites.

### V10 — ServiceTitan dispatch board

- **Source:** [new daily/weekly dispatch board](https://help.servicetitan.com/docs/use-the-new-daily-and-weekly-dispatch-board), image alt “ServiceTitan interface showing scheduled jobs and notifications for technicians”; local `servicetitan-board.png`.
- **Freshness:** pictured October 7, 2025, sandbox banner; current documentation includes newer material.
- **Useful/borrow:** aligned resource/time comparison and contextual detail.
- **Avoid:** simultaneous Activity Center, job tray, dense tags, striped rows, and wide operational chrome.
- **Class/fit:** INTERACTION, VISUAL; FIT WITH ADAPTATION for context, DOES NOT FIT FIELDIVE wholesale.

### V11 — BuildBook people and access detail

- **Source:** [Managing People](https://help.buildbook.co/en/articles/10029414-managing-people); local `buildbook-people.png`, `buildbook-person.png`.
- **Freshness:** article January 20, 2026; underlying image capture dates not established for these selected assets.
- **Useful/borrow:** flat aligned list and progressive person detail.
- **Avoid:** icon-only pending state, broad repeated “Everything” access values, duplicate-looking names without explanation.
- **Class/fit:** INTERACTION, VISUAL; FIT WITH ADAPTATION.

### V12 — BuildBook remove person confirmation

- **Source:** [Team management](https://help.buildbook.co/en/articles/10030045-inviting-and-managing-your-team); local `buildbook-remove.png`.
- **Freshness:** article January 2026; asset filename indicates January 2024.
- **Useful/borrow:** consequence explanation before removal.
- **Avoid:** browser-native alert presentation, generic OK, and ambiguous long-running access removal. FieldDive preserves disable-first.
- **Class/fit:** INTERACTION; FIT WITH ADAPTATION for explanation, DOES NOT FIT FIELDIVE as visual/access model.

### V13 — Buildxact Onsite job diary / photo step

- **Source:** [Site Diary guide](https://help.buildxact.com/en/articles/8114529-how-do-i-use-the-daily-log-site-diary-on-buildxact-onsite); local `buildxact-job.png`, `buildxact-post.png`.
- **Freshness:** guide July 31, 2026; assets identify 2023-era captures. Small phone-frame images limit detail.
- **Useful/borrow:** bounded job-context contribution with one next action.
- **Avoid:** feed-first priorities and an unnecessarily sparse separate photo screen.
- **Class/fit:** INTERACTION, VISUAL; FIT WITH ADAPTATION.

### V14 — CompanyCam mobile project and checklist list

- **Source:** [Creating a Checklist](https://help.companycam.com/en/articles/6828391-creating-a-checklist), mobile mockups after web instructions; local `companycam-mobile.png`, `companycam-checklist.png`.
- **Freshness:** guide updated this week when accessed; project image displays July 2026 data.
- **Useful/borrow:** strong camera action, readable checklist rows, unambiguous selected tab.
- **Avoid:** large header/capability tiles and duplicative completion graphics.
- **Class/fit:** INTERACTION, VISUAL; FIT WITH ADAPTATION. Annotation arrows are not product controls.

### V15 — CompanyCam populated home

- **Source:** [Web home guide](https://help.companycam.com/en/articles/15861466-navigating-the-companycam-web-home-screen); local `companycam-first-run.png`.
- **Freshness:** article updated over a week before access; capture date not established.
- **Useful/borrow:** resume recent work without searching again.
- **Avoid:** a broad live feed/dashboard as compulsory creator activation. Faint placeholder-like task rows are an empty illustration here, not proven loading behavior.
- **Class/fit:** VISUAL; FIT WITH ADAPTATION. Despite the local filename, **this is not a first-run checklist capture**.

### V16 — FieldPulse mobile/tablet schedule

- **Source:** [Field technician getting started](https://help.fieldpulse.com/getting-started/role/field-technician), asset labelled mobile job record; local `fieldpulse-mobile.png`.
- **Freshness:** current official guide, screenshot date unknown.
- **Useful/borrow:** prominent time and job title in a work list.
- **Avoid:** long assignee lists, invoice stamps, and timesheet/sales navigation in a narrow Lead experience.
- **Class/fit:** INTERACTION, VISUAL; FIT WITH ADAPTATION. Actual image is a wide schedule composition, not a 390px job-detail proof; source alt text does not override what is visible.

### V17 — Linear team permissions

- **Source:** [Members and roles](https://linear.app/docs/members-roles), Team permissions image; local `linear-access-decoded.png`.
- **Freshness:** current undated documentation, capture date unknown.
- **Useful/borrow:** action/explanation/control alignment and restrained row separation.
- **Avoid:** copying theme, team hierarchy, or broad authority defaults.
- **Class/fit:** VISUAL, INTERACTION; FIT WITH ADAPTATION.

### Coverage exclusions and next evidence needs

No published screenshot was treated as a live 390px test. There is no inspected complete invite/accept/reactivate sequence for a competitor, no reliable current AccuLynx individual roster editor, and no visual proof of roster-history behavior. Competitor failure/retry/offline flows were not exercised. First-run missing-prerequisite return is supported here by FieldDive's prior research and product judgment, not a claimed observed competitor session.

Later implementation references should start with V05 for schedule composition, V09 for event treatment, V14 for field interaction emphasis, V11 for people rows, and V17 for explanatory access rows. V01–V04 guide operating distinctions. Do not use V07/V10 as a target merely because they are mature products.

## PART 19 — Recommendation register

All major recommendations in this report map to this register. Research support does not convert a NEW DIRECTION into existing authority.

| ID | Recommendation | Classification | Decision/status and rationale |
|---|---|---|---|
| R01 | Preserve closed 13B capability, scope, deny, delegation, custody, and strong-sign-in contracts | ASTRA-EXPLICIT | Mandatory; product labels cannot replace the security engine |
| R02 | Present/redefine Office Manager over an approved office capability contract | NEW DIRECTION | Approve exact mapping; not cosmetic Admin rename |
| R03 | Introduce a scoped Lead launch preset/presentation | NEW DIRECTION | Resolve package exposure/proof discrepancy and migration of existing Production Lead users |
| R04 | Keep other supported Sales/Field access discoverable, not mandatory at startup | ASTRA-ALIGNED IMPROVEMENT | Preserve legitimate specialist needs without adding departments |
| R05 | Persistent company-local reusable Crew with name/usual Lead and archival lifecycle | NEW DIRECTION | Required for promised reusable crew outcome; current text label is insufficient |
| R06 | Optional durable non-login person/worker records with explicit later identity linking | NEW DIRECTION | Prevent worker recreation and forced seats; no HR expansion |
| R07 | Distinguish crew manager from assignment Lead; Owner eligible; Lead may manage multiple crews | NEW DIRECTION | Approve substitution/roster-management authority, not physical-presence inference |
| R08 | Durable job/work assignment with crew selection, derived Lead, reviewed reassignment | NEW DIRECTION | Approve assignment unit/cardinality and save semantics |
| R09 | Preserve assignment/roster history without retroactive attribution changes | NEW DIRECTION | Define snapshot/effective-history behavior before promising job rosters |
| R10 | Compact Job Card summary, one assignment owner, Overview summary only | ASTRA-ALIGNED IMPROVEMENT | No giant workforce panel or automatically added Production tab |
| R11 | Add crew context/filtering to the existing Calendar | ASTRA-ALIGNED IMPROVEMENT | Conditional on approved crew model; no competing schedule owner |
| R12 | Introduce crew overlap rules, resource views, or drag/drop beyond current behavior only by explicit decision | NEW DIRECTION | Minimal overlap warning proposed; advanced board not necessary |
| R13 | One adaptive, assigned-work-focused mobile experience | ASTRA-ALIGNED IMPROVEMENT | Effective access, not product split or role-string filtering |
| R14 | Job-context photo/task contribution with truthful pending/failure/retry | ASTRA-EXPLICIT | Reuse current domains; no invented upload success |
| R15 | Preserve minimal identity → real job → bounded prep → review → send | ASTRA-EXPLICIT | Prior research is authority; crew setup not prerequisite |
| R16 | Contextual prerequisite editor and quiet resume instead of global compulsory checklist | ASTRA-ALIGNED IMPROVEMENT | Batch related questions; reuse readiness and preserve return context |
| R17 | Creator and invited-user separation; no repeated business onboarding | ASTRA-EXPLICIT | Consume 13B access states and preserve 13D boundary |
| R18 | Honest invitation/removal/reactivation with disable-first and reviewed restoration | ASTRA-EXPLICIT | Preserve implemented §2.10–2.11 contracts |
| R19 | Crew-derived access lifecycle and safe scoped roster/contact projection | NEW DIRECTION | Separate reasons for access; preserve independent grants and directory boundaries |
| R20 | New field notes/issues/material confirmation/work-finished report semantics | NEW DIRECTION | Approve only what approved field outcome needs; contractor completion stays distinct |
| R21 | New Lead-home/returning destination routing implementation inside 13C | NEW DIRECTION | Research intent supplied; explicitly resolve 13C/13D ownership before implementation |
| R22 | Multiple crews/work segments and durable sequential reassignment semantics | NEW DIRECTION | Choose launch cardinality; do not imply resource-planning completeness |
| R23 | Access copy/custom company profiles | NEW DIRECTION | Defer launch; copy-once only if justified; reject mutable-person linked access |
| R24 | Separate worker representation from paid/app participation | ASTRA-ALIGNED IMPROVEMENT | Product-model implication only; no seat prices or billing implementation |
| R25 | Progressive growth without mandatory re-onboarding | ASTRA-ALIGNED IMPROVEMENT | Add crew/specialist only when useful; preserve identities |
| R26 | Existing FieldDive hierarchy/type/spacing/color grammar, not competitor visual collage | ASTRA-EXPLICIT | Premium via information priority and restraint |
| R27 | True-390/keyboard/long-content/error proof, no desktop shrink | ASTRA-EXPLICIT | Later proof gate, not claimed completed by screenshot research |
| R28 | Copilot distinguishes authority, responsibility, participation, and unknown truth | ASTRA-ALIGNED IMPROVEMENT | Product implications only; no copilot implementation |
| R29 | Validate vocabulary, assignment, and field completeness with real contractors | ASTRA-ALIGNED IMPROVEMENT | No unsupported claim that leading labels are universally natural |
| R30 | Reconcile canonical closure, package availability, current UI, and scope before implementation | ASTRA-EXPLICIT | Do not resolve conflicting evidence through assumption |

### Explicitly not proposed for this outcome

Payroll, HR, attendance/timekeeping, route optimization, advanced resource optimization, ERP, vendor compliance administration, multi-company subcontractor identity federation, general offline synchronization, and an arbitrary permission-matrix builder. A competitor supporting them is not evidence FieldDive needs them for this outcome.

### Pricing/seat implication only

Owner + Office + Carlos + five physical workers need not imply eight software identities. This is an operational model decision, not a proposed subscription price or promise of free labor records. Crew creation must not automatically send invitations or create paid-seat obligations. Any future billing must distinguish login entitlement from optional labor representation and disclose charges before granting participation. R24.

## PART 20 — Product decision gates before implementation

These are explicit questions with recommended answers, not open-ended requests to redesign the product. Decisions should be recorded against recommendation IDs. A gate passes only when the authority and intended behavior are unambiguous.

### G1 — Scope and authority

**Decide:** which crew/Lead recommendations are authorized for 13C, and which Lead-entry work remains 13D?

**Recommended:** approve crew synthesis as a bounded product extension only if desired; keep production rollout separate. Resolve `lead_assigned_work` registry/closure/UI/server-proof discrepancy. Do not issue an implementation plan that calls all of this ordinary activation polish. R01/R21/R30.

**Pass evidence:** recorded scope decision; current canonical authority referenced; no unapproved roadmap move.

### G2 — Office and Lead access contracts

**Decide:** exact powers/scope behind Office Manager and Lead; treatment of current Admin/Production Lead accounts; optional Sales/Field entry.

**Recommended:** Office is a reviewed supported preset, not automatic all-company sensitive authority. Lead is assigned-work scope, not company-wide Production Lead. No silent downscope/upscope of existing members and no cost-hiding promises unsupported by actual payload boundaries. R02–R04/R19.

**Pass evidence:** contractor-readable capability/scope contract, migration/presentation decision, delegation/removal behavior, and named proof requirements.

### G3 — Crew/person model and navigation

**Decide:** persistent Crew, optional non-login people, usual Lead relationship, membership edit authority, canonical Crews home.

**Recommended:** name + usual Lead, optional reusable people; Owner can lead; no mandatory worker contact or invite. Owner/authorized office create/manage crews initially; Lead roster editing is an explicit separately scoped choice, not presumed team management. R05–R07.

**Pass evidence:** approved conceptual object boundaries and lifecycle; incomplete crew handling; archive/reactivate; duplicate-person/linking rules; no accidental HR scope.

### G4 — Assignment unit, cardinality, and substitution

**Decide:** one active production crew per job at launch, or per scheduled work segment/multiple simultaneous crews? What happens when Carlos is absent?

**Recommended:** keep launch interaction one crew selection, but explicitly support sequential reassignment and assignment Lead substitution. If one active crew is chosen, disclose that limit. Do not build a generalized labor-ticket product without a real requirement. R08/R22.

**Pass evidence:** examples for same crew across two jobs, replacement mid-job, two Leads/two crews, return visit, second trade, and missing Lead; each has one defined source of truth.

### G5 — Access and accountability through changes

**Decide:** whether assignment automatically grants Lead job access; which changes revoke what; who sees operational roster/contact information.

**Recommended:** scoped access tied to approved responsibility, with explicit provenance and preservation of independent grants. Do not grant all members access or use names as authority. Disable-first remains unconditional; handoff is recoverable and separate. R18/R19.

**Pass evidence:** cases for crew replacement, task-derived grant, manual grant, Lead removal, reactivation, failed handoff, invite not accepted, concurrent edit, and expired/revoked access. No case gains access from a roster-only membership.

### G6 — Historical truth

**Decide:** what roster/Lead information is captured for an assignment and what counts as confirmed onsite participation.

**Recommended:** preserve assignment identity, effective changes, responsible Lead, and known roster-at-assignment context; label it planned/listed rather than actual attendance. Do not rewrite completed history when a crew changes or attribute Carlos's actions to Mike. R06/R09.

**Pass evidence:** rename, member move, archive, later login, duplicate names, and reassignment examples retain correct old attribution. No unsupported attendance claim.

### G7 — Calendar behavior

**Decide:** required views and filter behavior, whether overlap warning is included, and notification effects of schedule changes.

**Recommended:** existing Calendar plus crew context, desktop planning and mobile list; no dispatch board. Separate unscheduled from unassigned. Warn only from known overlapping commitments. No new automatic customer messaging without an approved policy. R11/R12.

**Pass evidence:** date-only/multiday work, missing crew/date, known overlap, no data, stale save, and notification failure have defined outcomes; non-drag edit works at 390.

### G8 — Complete field participation

**Decide:** whether current brief/photos/tasks are sufficient, or whether an issue/work-finished report is required for this approved outcome.

**Recommended:** reuse existing contributions, but do not hide a genuinely missing office feedback loop. If a report is required, approve its recipient, state, verification, attribution, and retry behavior. Do not equate field report with contractor closure. Do not add offline architecture by implication. R13/R14/R20.

**Pass evidence:** Lead can understand work, contribute evidence, communicate the required exception, and indicate completion through an explicitly supported path; office can see the result without reconstructing it from unrelated surfaces.

### G9 — First-run continuity and optional access complexity

**Decide:** bounded missing-prerequisite interaction and whether access copying is actually necessary at launch.

**Recommended:** preserve activation milestone hypothesis and context-return path; crew/team setup optional. Defer access-copy/custom roles; if approved, use reviewed copy-once, never person-linked inheritance. R15–R17/R23.

**Pass evidence:** owner-only first proposal, skipped optional setup, failed readiness read, interrupted preparation, failed send, and invited Lead entry each have honest recovery without duplicate business/job creation.

### G10 — Contractor comprehension and visual proof contract

**Decide:** vocabulary and required field outcomes through actual task-based testing, then approve representative visual execution.

**Recommended:** test the five scenarios in Part 16 with real small roofers; ask participants to explain access versus crew versus job responsibility, not merely rate the look. R26/R27/R29.

**Pass evidence before final UI commitment:** no unresolved misunderstanding that could grant broad access, send work to the wrong person, rewrite history, or falsely complete a job. Record disagreements and revise the contract rather than averaging a preference score.

### Subsequent implementation acceptance evidence — not performed here

Minimum desktop + **true 390px** proof must cover:

| Surface/state | Required evidence |
|---|---|
| Team | Owner-only, active Office/Lead, invited, removed, resend failure, reactivation review, long names/emails |
| Crew list/editor | Empty, one/two crews, optional blank roster, long/duplicate names, missing Lead, archive with history, edit failure |
| Assignment | Select existing crew, create-in-context return, unscheduled assignment, Lead override, reassignment, access consequence/failure |
| Calendar | Assigned/unassigned/unscheduled distinction, date-only/multiday, overlap if included, filter empty, read failure, non-drag edit |
| Job Card | Overview summary consistent with authoritative assignment and Calendar; current versus prior assignment |
| Lead work | Today/next/none/unavailable, only authorized jobs, permitted contact/scope, no office payload leakage |
| Contributions | Photo pending/failure/retry, task completion/reopen if supported, required issue/completion feedback, stale access during action |
| Creator first-run | Minimal identity, real job, missing preparation, preserved return, reviewed proposal, send failure/retry, optional crew skipped |
| Invited user | Correct existing company, accepted invitation, useful authorized destination, no business-setup loop |
| Interaction integrity | Keyboard and focus, sheet/modal stacking, sticky action and keyboard, long content, loading versus empty, destructive review |

Security proof must accompany visual proof where authority changes. A screenshot of hidden controls is not evidence of scoped data access. Completion requires the approved outcomes, not merely passing types/tests or reproducing a competitor's layout.

## PART 21 — Open questions requiring actual contractor testing

### Strongly supported enough to guide the model

- Labor organization and app access can be separated; multiple official products demonstrate forms of that distinction.
- AccuLynx is an appropriate reusable roofing-crew architecture reference, with multiple crews under a subcontractor documented.
- Existing FieldDive access contracts must survive presentation changes.
- Named worker presence is not authenticated contribution, and a roster is not attendance.
- Published competitor images provide concrete hierarchy lessons, but not evidence of live 390px usability or success rates.

### Recommended, but not yet validated with this ICP

- Lead is clearer than Crew Lead/Foreman for all five family/small-business scenarios.
- Office Manager is the right label for both a spouse doing light office work and a trusted full-time coordinator.
- Optional named members are useful often enough to warrant launch representation, rather than crew identity alone.
- One active crew with sequential reassignment is sufficient for launch work, including gutters, repairs, and return visits.
- A Today-first Lead view outperforms a mobile calendar for this population.
- The proposed bounded commercial-preparation interaction is the right amount of setup, rather than too fragmented or too long.

### Test tasks and what would change the recommendation

| Question | Task, not opinion poll | Evidence that changes the decision |
|---|---|---|
| Lead vocabulary | Invite the person who runs the roof while Owner sells; explain what they can see/change | Participants expect company-wide authority or cannot distinguish Lead from salesperson |
| Office breadth | Invite a spouse to schedule and collect; ask about refunds, team changes, and pricing | Label conceals sensitive authority or forces a custom profile for ordinary office work |
| Owner multi-hat | Owner sells, prepares proposal, schedules, then runs crew | Any perceived need to create a second identity or switch department |
| Roster value | Reuse Carlos Crew next week after Bob leaves and Luis joins | Contractors do not track names, or expect automatic history rewrite; revise optionality/explanation |
| Subcontractor realism | Vendor controls two crews and changes who attends | A single company-member Lead cannot represent necessary external responsibility; explicitly scope a different contact/access relationship |
| Assignment unit | Roof tear-off, next-day install, gutter crew, and punch-list return | One job-wide assignment loses meaningful accountability; approve work-segment modeling |
| Lead absence | Carlos is away; Owner or another Lead covers one job | Users confuse temporary assignment override with permanent crew management |
| Access consequence | Replace crew after its Lead has uploaded photos and holds an independent task grant | Users cannot predict continuing visibility; revise policy/explanation before shipping |
| Later login | Mike, already listed on two jobs, now needs to upload photos | Duplicate identity or wrong historical attribution occurs in the intended flow |
| Mobile field loop | Open today's house, inspect instructions, take photos, finish a task, raise an issue | Essential action/context is buried or requires unauthorized office work |
| Completion | Lead says work is finished while payment/punch items remain | Users read field action as financial/final closure; separate semantics more clearly |
| First preparation | Real roofer prepares a real first proposal with missing rates/terms | Repeated interruptions or settings navigation make context loss unavoidable |
| Crew discovery | Create crew from first production assignment; later find/edit it | Canonical placement is not discoverable without explanation |
| Access-copy demand | Add two unusual users using supported presets/exceptions | Repeated configuration genuinely burdens users; consider reviewed copy-once/profile decision |
| Poor signal | Attempt field contribution in actual unreliable connectivity | Approved workflow cannot function without durable offline support; identify separately, do not fake completion |

### Assumptions that should remain reversible

Keep display vocabulary, initial navigation placement, default Calendar view, optional roster fields, and guidance presentation reversible. Preserve durable identities and attribution from the outset; those are expensive to retrofit. Never make a cosmetic label the source of authorization.

Do not infer employee/subcontractor prevalence, language needs, device ownership, seat adoption, or title preference from these vendor screens. A current AccuLynx guided demonstration should resolve its roster/history questions if those details materially affect the decision; FieldDive can still choose a defensible independent model without pretending the competitor proves it.

### Final verdict

**The leading model is coherent and worth pursuing. It is not yet an approved implementation contract.**

A small roofer should encounter people who use the product, crews who do the work, and one clear responsibility on each job—not software roles masquerading as a workforce. AccuLynx supplies the strongest inspected roofing operational precedent; the best visual/interaction references supply specific refinements, not a product to clone.

FieldDive can improve the result through one job, one adaptive experience, quiet contextual preparation, and explicit responsibility/access/history boundaries. The claim that real contractors will find it natural and premium remains a testable product hypothesis until the decision gates and representative contractor tasks are passed. No implementation or commit is authorized by this report.
