## A. Executive verdict

**Cursor’s direction is fundamentally right, but its implementation plan needs revision before execution.** It would make FieldDive more consistent without fully resolving why the product still feels assembled from separate capabilities.

My estimate is that Cursor captured **about 60% of the needed cohesion work**: roughly 80% of the visible UI-system problems, but substantially less of the workflow, information-priority, and state-evolution work. These are judgment estimates, not measured completion percentages.

The deeper problem is **which truth receives attention at each moment**:

- Overview often displays available facts rather than the current operating situation.
- The field brief substitutes agreement status for actual authorized scope.
- Activity and historical changes compete with present work.
- Completed jobs retain an active-work arrangement.
- Setup still teaches internal modules more than the contractor’s estimating process.
- Customer pages retain a sales-document structure after becoming an agreement, collection surface, and project record.
- Several scope-change interactions undermine continuity or accurately expressed consequences.

**Preserve the product architecture. Change its presentation priorities and repair the evidenced workflow seams.** No replacement dashboard, new Job Card, new portal, or new roadmap phase is warranted.

Review basis:

- Entire [Astra blueprint](/C:/dev/tradetools-ai/tmp/fielddive-ui-review/astra-future-state-fielddive-blueprint.md).
- Current Phase 1–12 truth in the [global handoff](/C:/dev/tradetools-ai/docs/fielddive-global-handoff.md).
- Entire reconstructed [Cursor audit](/C:/dev/tradetools-ai/docs/phase12-5-cursor-paid-ui-audit.md).
- All 41 Phase 12.5 screenshots, supplemental Phase 10–12 customer/closeout captures, and relevant source.
- Repository revision `d13864a22182ab31c61853a971cc50ba4657c5be`.

This was a read-only evidence review, not a fresh interactive test run. Source-confirmed defects, screenshot observations, and outstanding runtime proof are distinguished below. The report reconstruction is usable evidence; its limitations prevent treating its original “no P0/P1” conclusion as a whole-product clearance.

Classification shorthand throughout:

- **E — ASTRA-EXPLICIT**
- **I — ASTRA-ALIGNED IMPROVEMENT**
- **N — NEW DIRECTION; explicit approval required**

Where Astra envisioned something that remains an absent product capability, I classify adding that capability as **N for this implementation scope**, following your explicit rule.

## B. Astra-to-current-product crosswalk

| Astra target / intent | Current FieldDive reality | Product judgment / gap | Classification |
|---|---|---|---|
| One job; domain tabs own truth | Canonical Job Card and domain ownership exist | Preserve them. Overview should summarize and route into those domains, not reproduce their editors | E |
| Current decision before metadata | Approval has explicit situation copy; many other states do not | Give every lifecycle state a meaningful situation, including a legitimate “nothing to do” state | E |
| Activity subordinate to work | Permanent desktop rail remains across tabs | Remove its permanent column; retain complete, accessible chronology | E |
| Readable approved field brief | Base “scope” is populated from the proposal status label | Show actual existing authorized scope and applicable changes; disclose unavailable scope honestly | E |
| Context follows the contractor | Identity reuse and safe explicit return destinations exist | Strengthen domain links, return context, current version identity, and resumed scope-change work | E |
| Known facts are reused | Phase 5/6 foundations exist | Do not turn setup styling into another required configuration sequence | E |
| Unknown is not empty or zero | Core payment semantics are protected; UI still has false-empty flashes and a scope-editor fallback | Apply truth-state discipline to every dependent section, not only shared loaders | E |
| Normal progress changes hierarchy | Some states become text rows; completed Overview remains largely unchanged | Recompose the current-work area as jobs advance | E |
| Acceptance, approval, schedule, completion, money stay distinct | Completed phases establish these boundaries | Preserve them in all simplified copy and actions | E |
| Customer understands document, commitment, amount, next step | Project record exists below proposal-era framing | Make the live page state explicit without rewriting the original agreement | E |
| First proposal asks only relevant business questions | Contextual Prepare distinguishes direct-price and cost-based paths | Company Pricing still presents a cost/profitability-centric mental model | E |
| Catalog is usual scope/prices, not an admin checklist | Wide administrative columns and permanent Templates direction remain | Prioritize item, selling price, unit, quantity basis, and editing | E |
| Templates lead with the customer result | Landing page leads with template/package/item counts and structure | Bring the default proposal and essential editing tasks forward | E |
| Mobile preserves operational context | Correct four-slot navigation exists; heavy header/gutters delay work | Retain the navigation, improve first-screen context and contextual domain access | E |
| Auth resumes useful work | Explicit redirects are preserved; bare login falls back to `/` | Default successful contractor login to Jobs when no destination was requested | E |
| Recovery is self-explanatory | No password-recovery entry or implementation was found in searched application routes | A real recovery flow requires a separate capability decision, not login decoration | N |
| Restrained semantic visual system | Many local styles; some wrong semantics | Adopt a small shared layer without turning every fact into a badge/card | E/I |
| AI prepares; contractor verifies | No new AI capability is needed for this review | Do not add recommendation panels, automatic decisions, or AI summaries to fill empty space | E |

The handoff’s current launch posture is also controlling: **self-explanatory promoted controlled access**, not a product that depends on founder coaching. That raises the importance of understandable setup and recovery without authorizing additional features.

## C. End-to-end workflow findings

The underlying journey is coherent. The visible handoffs are less coherent.

| Handoff | Where continuity weakens | Decision |
|---|---|---|
| New job → customer/property | Blank fields understate existing-customer search; “first job” wording appears in repeat use | **E:** label the existing search/select behavior clearly; preserve compact selected identities and Change |
| Property → measurements | A measurement can appear as a missing generic fact rather than the next relevant preparation task | **E:** surface the existing measurement/preparation entry when needed; do not make measurements a universal prerequisite |
| Measurements → proposal | Setup destinations can suggest Catalog → Templates → Job is the normal route | **E:** Prepare remains the primary job-context path; reusable setup remains optional/contextual |
| Builder → Preview | “Customer review” is ambiguous; sent content can still be labeled Draft | **I:** use “Review proposal”; **E:** state exact draft/sent/revision context |
| Customer acceptance → contractor approval | Existing explicit separation is sound | **E:** preserve it; approval readiness belongs in normal hierarchy |
| Approval → schedule | Schedule button is visually detached from the situation | **E:** pair “Ready to schedule” with Schedule; avoid a redundant unscheduled panel |
| Schedule → production | Date and assignment exist, but base scope and access context are incomplete in the brief | **E:** make the existing authorized work readable before asking the crew to act |
| Production → scope change | Draft resume, displayed totals, link recovery, and “Send” wording have evidenced problems | **E/I:** repair the existing workflow before presentation normalization |
| Completion → collection | Completion and remaining obligation exist but are not dominant enough together | **E:** lead with completion and the relevant financial state |
| Collection → closeout | Closeout is an appended block rather than the natural completed-job view | **E:** promote it within completed Overview |
| Closeout → repeat job | Identity reuse exists | **E:** preserve current company defaults and explicit measurement selection; never clone agreement/payment/job state |

The product should not prescribe a rigid wizard through this sequence. A contractor must be able to inspect another domain, save partial work, and return without losing the present task.

**No action is also a valid outcome.** A sent proposal awaiting the customer, an upcoming scheduled job, or a fully settled completed job does not need a manufactured prominent CTA.

## D. Job Board findings

Cursor judged the Board’s structure sound. I agree about the lanes, but not about the default information emphasis.

The captures still spend substantial card space on **Measured / Proposal / days in stage / Updated**. Those facts seldom explain what the contractor should do now. Stacked mobile lanes make a large Intake backlog precede later operational work.

Decisions:

- **E:** retain canonical operational lanes and Board/List alternatives. Do not introduce Accepted, Unpaid, or Measured lanes.
- **E:** prioritize identity → service address → one meaningful action/attention sentence → relevant date → responsible person.
- **E:** remove routine measurement/document indicators and update timestamps from default emphasis. Keep them where requested or relevant.
- **I:** label the displayed assignee accurately. If the value is `jobs.assigned_to`, use **Production lead**, not ambiguous **Owner**. Do not invent a coordinator field.
- **E:** default a phone without an explicit saved preference to compact List. Preserve a deliberate Board preference.
- **I:** use **Jobs** as the page title across Board and List; the current “Job Board” title is awkward in List mode.
- **E:** preserve search/filter/return context. Specific attention links may enter their owning domain; ordinary job selection opens Overview.
- **E:** keep consequential action confirmation and canonical eligibility. Fix loading labels without weakening blocked actions.
- **I:** do not use green for freshness or amber merely because time has passed. Age alone is not an overdue commitment.

Do not add a new attention engine or new filters during this pass unless existing facts and behavior already support them. Attractive “Needs attention” UI without dependable underlying meaning would create fake completeness.

## E. Job Card architecture findings

**Keep the Job Card. Its ownership model is right; its composition is incomplete.**

The source supplies meaningful situation copy primarily for pending changes and approval readiness. It passes the same field-brief structure into Overview across stages, then appends Closeout after Overview—including its mobile Activity teaser. That explains the screenshots’ lack of state evolution. [Source](/C:/dev/tradetools-ai/app/tools/roofing/jobCard/JobCardClient.tsx:1365)

### Header

**E:** keep job/customer identity, full service address, compact stage, and exceptional disposition. Contact shortcuts should be immediately usable.

**I:** keep property Change and More job actions subordinate. On mobile, a full raw email address should not consume several lines before the user reaches the work; retain an accessible Email action and full contact detail.

Do not combine customer, property, stage, payment, and proposal into a new compound status.

### Overview

**E:** replace the invariant inventory with a state-dependent current-work composition:

| State | First priority | Dominant action when eligible |
|---|---|---|
| Intake | What is needed to prepare this job | Existing measurement or Prepare proposal entry |
| Proposal draft | Current draft and actual blocking facts | Continue proposal / Review proposal |
| Proposal sent | Sent version and customer-response state | Often none; review/link/delivery actions remain secondary |
| Customer accepted, awaiting approval | Accepted agreement and explicit contractor decision | Approve job |
| Approved | Ready to schedule; authorized work | Schedule |
| Scheduled | Date/window, lead, access, authorized scope | Start work when eligible |
| Production | Current authorized work, relevant tasks, pending-work exception | Complete job when eligible |
| Complete, balance remaining | Completion date plus remaining/request state | Open Payments or review existing request |
| Complete, settled | Completion and project record | Review closeout; sharing secondary |
| On hold / Lost / Closed | Disposition and reason, preserving stage and commitments | Existing authorized recovery action |
| Closed during Production | Closed while work was in progress | Existing Reopen and complete flow |

Financial state modifies this composition; it does not replace operational state. A processing payment should not become a collection prompt. A pending scope change should not globally obscure unrelated authorized work.

### Activity

**E:** remove the permanent desktop rail, rather than adding a fade to preserve it.

Activity needs a clear desktop entry and full chronology, with a small recent-activity disclosure where useful. It should not occupy a third of an empty Measurements tab or sit beside payment history as a second event stream.

### Width and density

**I:** let the Job Card use available workspace width, but constrain paragraphs and forms inside it. Removing Activity must not simply produce wider blank sections.

**E:** use separators and meaningful sections. Do not fill the recovered space with additional counters or recommendations.

### Mobile More

**E:** retain Overview / Tasks / Photos / More. This is explicit Astra intent and already established product behavior.

More is acceptable **only if current work has direct contextual links**: Prepare proposal from Intake, approved scope from the brief, a current payment request from the money summary. Moving Proposals and Payments permanently into the primary rail is not necessary.

**I:** make the active More destination explicit in the navigation or nearby heading. Do not remove the “Payments” heading merely because the tab shell exists; on mobile the selected rail label says only “More.”

## F. Job Card domain-tab findings

| Domain | What the contractor needs to know/do | Decision |
|---|---|---|
| Tasks | What remains, who owns it, when it matters | **E:** open relevant tasks first; completion, title, assignee, due date together. Completed tasks subordinate. “No tasks” must not become an Overview setup prompt |
| Calendar | This job’s planned commitment and constraints | **E/I:** schedule summary before editing; keep notes before submit; clearly distinguish planned dates from actual start/completion |
| Measurements | Which measurement is current and where it came from | **E:** current selection/source/date first, other records below. Distinguish current job measurements from those frozen into an issued agreement |
| Proposals | Current draft/issued/accepted agreement and actionable change | **E:** current record first; pending/draft change next; authorized changes; older/voided history subordinate |
| Payments | Remaining obligation, current request, collection action | **E:** request-aware composition; historical requests and delivery attempts below current work |
| Photos | Capture and retrieve job evidence | **E/I:** explicit “Add photos or files,” item-level status/retry, private-by-default context; no duplicate empty copy |
| Activity | Explain what happened | **E:** complete chronological record on demand; never a substitute for current scope, request, or agreement truth |

Three deeper corrections matter particularly:

1. **E — Authorized scope must contain work.**  
   `approvedScopeLabel` receives `display.proposalLabel`, producing “Accepted” or “Signed.” The current caller also does not pass access notes into the brief. Reuse existing authorized scope and existing access/schedule notes through appropriate role-safe reads; do not create an editable second scope document. [Source](/C:/dev/tradetools-ai/app/tools/roofing/jobCard/JobCardClient.tsx:881)

2. **I — Separate current scope-change work from history.**  
   Three voided reductions appearing before the authorized addition is valid chronology but poor operational hierarchy. Preserve every historical record; default presentation should prioritize work still relevant to the current contract.

3. **I — Historical totals need historical labels.**  
   A voided change labeled simply **“New total −$1,050.00”** can imply a current contract result. Use **“Proposed total—not applied”** for unapplied history. For older authorized changes, identify the total after that change rather than implying it is today’s total. [Source](/C:/dev/tradetools-ai/app/tools/roofing/jobCard/JobCardScopeChangesPanel.tsx:130)

Do not automatically make every domain’s Add action prominent on completed jobs. Keep permitted corrections available, while allowing retrieval to become the dominant intent.

## G. Calendar findings

The company Calendar and job Calendar are not redundant: one answers **what is happening across the company**, the other **what is committed for this job**.

The mobile Calendar has a deeper issue than repeated loading: its month view renders a sequence of every date, including empty past days, with a Schedule action on each. Fixing the loader alone still leaves September 24 work far below September 1.

Decisions:

- **I:** make today easy to find and return to; enter the mobile current period at the relevant date rather than requiring a scroll through earlier empty days.
- **I:** reduce repeated empty-day cards and repeated Schedule actions while retaining a clear route to schedule any chosen date.
- **E:** show recognizable date, customer/property, time/window, and existing responsibility facts on scheduled work.
- **E:** distinguish planned schedule from actual work start/completion.
- **E:** preserve schedules when a job is held/closed, but clearly identify the disposition. A retained date must not look like an unqualified active commitment.
- **I:** selecting an event should first make the commitment understandable; editing should be an explicit action, particularly after work has started.
- **E:** retain one neutral structural loading state and explicit failure/retry.
- **I:** use friendly dates; retain the company timezone where it matters.

Keep the current calendar and scheduling commands. No resource planner, drag-and-drop rewrite, or notification promise.

## H. New Job / intake findings

The identity architecture is stronger than the blank form initially communicates.

- **E:** label the existing customer lookup as **Find or add customer**, with visible field labels and recognizable matching results.
- **E:** retain existing customer/property summaries and Change links. Do not ask again for already selected identity.
- **I:** use **New job** for the normal route. “Start my first job” can remain an explicit first-use entry CTA; it need not become a page title requiring another asynchronous company-history decision.
- **E:** make service property clearly distinct from mailing/contact information.
- **I:** use one coherent form with Customer and Property sections; remove the separate title card.
- **E:** preserve entered values and interrupted-create identity. Error recovery must not create another job.
- **E:** keep Create job as the consequence. Do not imply it creates a proposal, prices work, or schedules anything.

The correct success handoff is the new canonical job with the relevant preparation action visible—not another setup checklist.

## I. Setup flow findings

The setup relationship should be understandable as:

| Surface | Meaning |
|---|---|
| Company Settings | Who the contractor is and how the company operates |
| Pricing Rules | Applicable calculation and tax defaults |
| Catalog | Reusable work items, units, prices, quantity basis |
| Templates | How usual scope/options and customer wording form a proposal |
| Prepare / Builder | This job’s actual selection, quantities, price, and promises |

This is an explanation of ownership, **not a mandatory sequence**.

### Settings

- **E:** retain the compact summary/list structure.
- **I:** rename the company payment entry **Payment setup** or **Online payments** to distinguish it from job-level collection.
- **I:** a read-only connection panel needs Close, not Cancel plus disabled Done.
- **I:** use the existing focused-editor pattern for edits; do not force every small read-only panel into a full-height drawer merely for consistency.
- **E:** unknown preferences must not render “No timezone set.” The previously uninspected mobile capture shows that claim alongside other loading states.
- **I:** remove the unsupported Advanced/soon shelf from normal navigation; preserve supported historical destinations without advertising unavailable capability.

### Pricing Rules

Cursor called the field hierarchy clean. Visually, it is. Conceptually, it conflicts with Prepare’s direct-selling-price path.

- **E:** explain when margin/markup settings apply. A direct-price contractor should not infer that a profit target is always required or that changing it necessarily changes every selling price.
- **E:** distinguish selling price, known cost, and calculated profitability. Unknown cost cannot imply a meaningful margin.
- **I:** explain “Exact measurements” and “Waste included in measurements” in business terms. The former refers to quantity handling, not a guarantee that measurements are accurate.
- **E:** preserve all pricing math. This pass corrects explanation and exposure, not the pricing engine.

### Catalog

- **E:** lead with Item, Selling price, Unit, Quantity basis, and relevant availability.
- **E:** move cost/mapping/visibility complexity into row editing or existing advanced controls.
- **E:** remove the permanent “Next: Templates” direction after setup.
- **I:** default the toolbar to search/filter and the task actually needed; subordinate reordering, columns, bulk management, and import.
- **E:** make mobile a price-and-item maintenance view, not a squeezed administration table.
- **E:** investigate/explain the visible unit mismatches—such as disposal measured in tons but sold as “Each”—without silently changing stored economics.
- **E:** no “Catalog ready” claim may authorize an actual proposal.

### Templates

- **E:** show the usual/default proposal and what the homeowner receives before internal counts.
- **E:** prioritize Edit scope, Edit terms/warranty, and Manage customer options; advanced composition remains available.
- **I:** distinguish the **selected template being inspected** from the **preferred template used for new work**. The captures show different records in those roles.
- **I:** make “Create another template” secondary once a usable default exists.
- **E:** preserve existing packages. Do not collapse a contractor’s three-option template simply because one-offer defaults are preferred for first use.
- **E:** state that reusable changes affect future preparation; never silently modify sent documents or an existing draft under review.

## J. Proposal builder / contractor preview findings

Builder should feel like **this job’s proposal workspace**, and Preview like **the exact document being reviewed**.

- **E:** keep customer/property context and Back to job visible.
- **I:** change **Customer review** to **Review proposal**. The existing phrase can sound like sending it to the customer or reading customer feedback.
- **E:** distinguish unsent draft, sent version, and editing revision. Do not derive these labels solely from whether fields are editable.
- **E:** prioritize scope, quantities, selling prices, total, and actual blockers over page-composition controls.
- **E:** make quantity × unit price → line amount understandable during review; retain the current engine and existing detailed editing controls.
- **I:** keep document-page navigation visually distinct from Job Card domain navigation.
- **E:** show delivery problems near distribution controls; healthy telemetry remains secondary.
- **E:** accepted Preview has agreement access and return-to-job actions, not ordinary Send/Revise.

**Cover-only historical Preview is not evidence that the current proposal renderer is broken.** Cursor correctly distinguished old frozen data from a current full document.

However, **E:** historical incompleteness needs an honest explanation when that record is supported and reachable. A polished cover must not imply a complete agreement is available. Do not reconstruct old pages from current templates or rewrite frozen history.

**I:** distinguish “Download original agreement” from “Download signed agreement.” The current project record is not automatically a new consolidated PDF.

No new PDF renderer, page-authoring system, or document-generation capability belongs in 12.5.

## K. Customer/public experience findings

**The same `/p` route can support the journey, but it must explain what the page is now.** It should not remain a buying interface with a project record appended below it.

| Customer state | Leading content | Action hierarchy |
|---|---|---|
| Sent, unaccepted | Contractor/property, proposal, offered scope and price | Review/select/accept as currently supported |
| Accepted | Acceptance recorded; original agreement; actual next step | Existing payment action if applicable, otherwise agreement access |
| Signed | Signed agreement identity and evidence | Agreement access; appropriate current action |
| Active payment request | Purpose, request amount, relationship to project balance | Pay the existing request |
| Payment processing | Processing state | Check existing status; no duplicate pay |
| Payment received, balance remains | Specific payment received plus remaining balance | No implied paid-in-full or invented new request |
| Authorized changes | Current contract summary and approved change record | Original agreement remains separately available |
| Work complete | Completion date, balance/settlement, project record | Collection only when an actionable request exists |
| Fully settled | Completed project record | Download/retrieve; no sales or payment prompt |

Decisions:

- **E:** promote the existing project record after acceptance. Preserve the frozen original proposal as an identified agreement/document section.
- **E:** label original agreement total and current contract total distinctly. An unlabeled original package price must not dominate the current total.
- **I:** use **“Pay $450”** where practical, paired with **Progress payment** and the overall balance. The requested amount is not necessarily the full remaining balance.
- **E:** suppress package-selection emphasis after acceptance. Retain the accepted choice as a fact.
- **I:** replace post-acceptance “Questions? …confirm details when you’re ready” with **Contact your contractor** and state-appropriate help text.
- **E:** do not rewrite frozen terms or historical proposal wording. Change the surrounding live interface, and label original terms as original.
- **I:** customer scope-change review should share contractor identity, property context, typography, and document language with `/p`. Its current plain form feels detached.
- **E:** remove internal language such as “the server decides” and “contract or payment truth changes” from customer-facing financial-conflict guidance.

The customer should never see internal hold/lost/closed disposition labels merely to explain contractor operations. Preserve Phase 12’s boundary.

### Scope-change continuity

Two distinct gaps must not be hidden by styling:

- **E/I:** the contractor’s customer-review link exists only in local UI state after proposing; the existing propose operation supports replay. Provide recovery using that existing operation, with truthful “link unavailable” partial-success handling. Do not call this email delivery.
- **N:** allowing the same customer scope-change token to reopen an already authorized change would extend its current read-access behavior. The resolver currently rejects non-proposed changes. This is a separate approval decision, even though durable customer records align with Astra. [Resolver](/C:/dev/tradetools-ai/supabase/migrations/20260923210000_phase10_approved_scope_changes.sql:1986)

Do not invent a double-applied contract-total defect here: the resolver’s current rejection prevents that authorized read path.

## L. Payments / collection / closeout findings

The financial foundations should remain protected. The presentation still asks the user to reconcile too much.

**E:** distinguish three different amounts and states:

1. Current contractual total.
2. Remaining collectible obligation.
3. Amount/status of the particular active request.

For the audited job, **$18,950 remaining** and an **open $450 progress request** are not competing truths. They answer different questions and should be labeled together.

Decisions:

- **E:** Overview summarizes the relevant amount and request state, with a direct Payments destination. “Progress payment requested” alone is insufficient.
- **I:** do not reserve an equally prominent Refunded tile for `$0` in every normal case. Show refunds when present; preserve their place in detailed history.
- **I:** a quiet current request should not permanently expose an email-composition textarea. Expand the note when Email/Retry/Resend is initiated.
- **E:** current delivery failure stays visible and actionable; prior attempts collapse behind delivery history.
- **I:** cancelled/requested history should remain retrievable without dominating the page. Reducing a test-heavy history is not deleting evidence.
- **E:** payment processing must never produce a request for the same money again.
- **E:** refunds must not reopen collectible balance through a new display calculation.
- **E:** Closeout becomes a leading completed-job section, above history and stale preparation summaries.
- **I:** **Copy customer link** must report copying—not sending, sharing, or customer receipt. Its current expiry should be explained at the sharing interaction.
- **E:** work complete, paid, and closed remain independent.

Do not add invoices, late-payment language, due dates, reminders, receipt emails, or a closeout publication status.

## M. Mobile 390 findings

**No horizontal overflow is necessary but not sufficient.** Catalog demonstrated that a page can fit the viewport while losing usable columns.

Required decisions:

- **E/I:** make Job Card edge-to-edge below 640px while retaining approximately 16px internal content gutters. Edge-to-edge does not mean text against the screen edge.
- **E:** first view should include recognizable identity, contact/directions, current situation, and the beginning of the relevant work.
- **E:** keep task-local controls within their domains. Overview’s lifecycle CTA must disappear or become inaccessible behind menus, dialogs, focused editors, and the keyboard.
- **I:** fix overlay ownership, not just one z-index. The current global nav visibly leaves Schedule above it.
- **E:** preserve active-domain context under More and provide lifecycle-relevant direct links.
- **I:** use compact paired money rows or a 2×2 summary where labels fit; do not mandate grids for every financial statement.
- **E:** transform Catalog rows around item, price/unit, and Edit.
- **I:** reduce header repetition and unnecessary inset containers before shrinking text.
- **E:** verify one-handed task completion, contact/directions, photo upload/retry, proposal review, and payment—not just screenshots.

Evidence corrections:

- `mobile/14-builder.png` is Catalog.
- `mobile/06-jobcard-more-sheet.png` does not show an open sheet.
- The Settings capture shows “Checking…” and a premature “No timezone set.”
- Mobile Preview and several populated Job Card domains remain unproven by this audit.
- A screenshot filename containing “authorized” or “closeout” is not proof that the intended state is visible.

## N. Shared UI-system decision

| Primitive | Decision | Exact invariant | Classification |
|---|---|---|---|
| Button | **MODIFY** | At most one dominant action per active task context; zero is valid. Consistent pending/disabled/focus treatment. Navigation remains an actual link. No business eligibility inside the primitive | E/I |
| StatusBadge | **MODIFY** | Compact factual status with explicit label; normal stage neutral. It must not turn every metadata value into a pill or infer status from tone | E/I |
| InlineNotice | **MODIFY** | Specific risk/failure/blockage, placed at the affected scope. Ordinary information is prose; success is usually inline confirmation. Global banners only for global consequences | E |
| LoadingState | **MODIFY** | Neutral structure for unresolved initial data; one indicator per independently loading region. Preserve known content during refresh. Never substitute empty/zero/failure | E |
| EmptyState | **APPROVE AS PROPOSED** | Resolved empty only; concise title/help and optional relevant action; no frame by default | E/I |
| SectionHeader | **MODIFY** | Optional title/action alignment with real heading semantics. Do not delete the only domain heading when mobile navigation says More. Action not obligatorily right-aligned | I |
| StatGrid | **DO NOT CREATE as a generic primitive now** | Use a small responsive layout pattern where repeated statistics genuinely need it. Avoid a generic dashboard vocabulary for this product | I |
| MoneyRow | **MODIFY / CREATE** | Label, preformatted authoritative value, optional emphasis; unknown explicit; no arithmetic, collectible inference, or automatic success coloring | E/I |
| Form classes | **APPROVE AS PROPOSED**, with stronger legibility | Persistent labels, consistent focus, associated help/error, usable native controls, adequate touch targets, 16px mobile input text | E/I |

Additional boundaries:

- A read action can be primary when reading is the task—Review proposal before sending is an example. Cursor’s blanket “view must be secondary” rule is too rigid.
- The button component cannot enforce “one primary” by itself; page composition must.
- Do not create a generic workflow/action resolver inside shared UI.
- Reuse the existing focused-editor foundation instead of adding another modal system.
- Test state behavior and accessibility, not merely that a particular class string appears.

**Primary-color decision:** retain dark slate for contractor actions and blue for customer commitment/payment actions **[I]**. This is an intentional presentation distinction, not two behavioral systems. Shared sizing, disabled/pending semantics, typography, and interaction hierarchy remain consistent.

Cursor’s assertion that one primary color everywhere is necessarily NEW DIRECTION is too strong: Astra already specifies a navy primary system. Nevertheless, changing the established customer action color provides little benefit here, so it is not recommended.

## O. Visual language decision

| Area | Decision |
|---|---|
| Typography | **E:** retain the existing system/body font for 12.5 and repair scale/contrast. **N:** Geist migration is optional and excluded pending explicit approval because Astra explicitly cautions against a font migration in this pass |
| Text scale | **E:** approximately 24px page titles, 18px section titles, 16px body/forms, 14px compact rows, 13px metadata. Small decorative eyebrows may be smaller; important operational facts may not |
| Neutral palette | **E:** slate/white light operational product; adequate text contrast |
| Primary | **E/I:** dark slate contractor primary; blue public commitment/payment primary |
| Secondary / links | **E:** outlined or quiet alternatives; blue actual navigation/interaction. Metadata should not look clickable |
| Destructive | **E:** clear named operation; red emphasis at consequential confirmation. Deactivate is not automatically equivalent to Delete |
| Loading | **E:** neutral; no amber. Preserve layout and known data |
| Empty | **E:** factual, contextual, calm; no forced Add action or onboarding lecture |
| Warning | **E:** amber for a real risk or prerequisite needing attention—not old age, ordinary readiness, or normal processing |
| Error | **E/I:** red for confirmed failure. A local email failure does not make the request or whole job failed |
| Success | **E:** restrained confirmed outcome. Avoid permanent green readiness panels and large celebratory completion boxes |
| Spacing | **E:** 4/8/12/16/24/32 rhythm; reduce duplicated padding and empty slots before compressing content |
| Surfaces | **E/I:** one primary work surface, separators for sections, cards for distinct objects, stronger elevation mainly for overlays |
| Nesting | **I:** two visible framed levels as a working ceiling, not an absolute structural rule. Semantic nesting can remain without nested boxes |
| Desktop widths | **MODIFY, E/I:** broad workspace, readable form/setup content, and document-appropriate canvas. Two rigid width families are insufficient |
| Mobile | **E/I:** 16px working gutters, responsive rows, readable labels, safe-area controls, keyboard-aware overlays |
| Shell | **I:** remove empty desktop strip and nested main landmark; move Sign out to account/nav controls |
| Root styles | **I:** isolate operational light styling safely. Do not globally remove marketing-dependent background behavior without verifying that dependency |

Cursor’s proposed 14px body / 12px metadata / 11px eyebrow scale is too small as the default for a contractor-first product. Changing Arial to Geist while retaining tiny operational text would miss the problem.

Login’s top alignment is not itself a paid-product defect. **I:** retain a layout that works with the phone keyboard; logo treatment is polish. Returning users to useful work matters more than vertical centering.

## P. Findings Cursor missed

The ranking below is product severity. “Source-confirmed” does not mean a live financial loss or production incident was reproduced.

### P0 — Correctness / trust

| Finding | Evidence and consequence | Decision |
|---|---|---|
| Scope editor misrepresents prior authorized reductions | `Math.max(0, previouslyAuthorized)` removes a negative cumulative change from displayed editor totals. `originalAgreementCents ?? 0` also supplies a fabricated basis if absence reaches the editor | **E:** preserve signed deltas; gate unavailable basis. Reproduce affected states before closing |
| “Check again” can approve a scope change | Customer financial-conflict button calls the authorization POST, not a read-only status check | **E/I:** either perform a genuine check or label the action explicitly **Try approving again**, with its consequence |

These are not claims that the authoritative ledger double-counts or that a customer was charged incorrectly. They are unsafe decision presentations in financially consequential workflows.

Sources: [editor basis](/C:/dev/tradetools-ai/app/tools/roofing/jobCard/JobCardScopeChangesPanel.tsx:468), [reduction clamp](/C:/dev/tradetools-ai/app/tools/roofing/jobCard/JobCardScopeChangesPanel.tsx:526), [Check again handler](/C:/dev/tradetools-ai/app/scope-changes/[token]/PublicScopeChangeReviewClient.tsx:418).

### P1 — Paid-product blocker

| Finding | Why it matters | Decision |
|---|---|---|
| Resumed scope-change draft initializes with a blank line | Saved work cannot be safely reviewed/continued; subsequent editing can replace prior content | **E:** hydrate existing lines and preserve the existing draft identity |
| “Propose / Send” does not send an email | Contractor may believe the customer has been notified | **I:** name proposal/link preparation honestly; do not add email implicitly |
| Proposed review link is not reachable after ordinary UI loss | URL is local state; proposed state suppresses the creation CTA | **E/I:** expose existing idempotent link-recovery behavior and partial success |
| Field brief does not convey base authorized work | A crew cannot execute “Accepted”; existing access notes are also absent from the caller | **E:** repair role-safe existing-fact projection |
| Completed Overview retains stale active-work priority | Completion and collection/closeout are buried below old scheduling/assignment facts | **E:** state-dependent hierarchy |
| Customer approval confirmation is not durable at the same scope-change URL | Success is local state; reopening an authorized token is rejected | **N:** separate durable-read decision; do not call current behavior a finished project-record experience |
| Password recovery is absent from inspected application flow | A returning contractor can be stranded; login polish does not solve it | **N:** separate capability decision; record as paid-launch gap |

Sources: [draft resume](/C:/dev/tradetools-ai/app/tools/roofing/jobCard/JobCardScopeChangesPanel.tsx:534), [scope-change controls](/C:/dev/tradetools-ai/app/tools/roofing/jobCard/JobCardScopeChangesPanel.tsx:413), [link detail behavior](/C:/dev/tradetools-ai/app/api/jobs/[jobId]/scope-changes/[scopeChangeId]/route.ts:126), [login](/C:/dev/tradetools-ai/app/login/page.tsx).

### P2 — Strong cohesion issue

- **E:** permanent Activity space and duplicated history compete with current work.
- **I:** voided “New total” wording is insufficiently historical.
- **E:** Overview’s Financial block mixes proposal and measurement status, while omitting useful amounts.
- **E/I:** the company Pricing mental model does not explain its relationship to direct selling prices.
- **E:** Catalog and Templates still expose administration before proposal preparation.
- **I:** calendar mobile month chronology delays today’s work behind empty past dates.
- **I:** preferred template and selected template are insufficiently distinguished.
- **E:** raw proposal status is mistaken for scope content.
- **E:** explicit auth return works, but bare login defaults to the marketing root.
- **I:** live scope-change review lacks the surrounding customer document identity and language.
- **E:** historical incomplete Preview needs an honest supported-history presentation.
- **I:** blanket deletion of tab headings would weaken mobile orientation.
- **I:** repeated cancelled requests, voided changes, and healthy delivery attempts need progressive disclosure.
- **E:** pending-work warning should be adjacent to the affected scope, not after an arbitrary task list.

### P3 — Polish

- **I:** Jobs title across Board/List; explicit production-lead naming.
- **I:** precise download labels and consistent quantity-unit wording.
- **I:** eliminate empty situation slots and stray Setup labels.
- **I:** root metadata still describes “instant roofing estimates” rather than the operating product; align wording when that metadata is within the touched app scope.
- **I:** logo/wordmark consistency, restrained radii/shadows, and readable historical disclosure controls.

Not carried forward as defects:

- Optional signatures are the current launch policy. The dormant required-signature branch is not an active customer blocker.
- Fixture placeholder logos are not branding-renderer failures.
- Historical missing pages do not justify regenerating issued documents.
- Empty Calendar screenshots do not prove populated Calendar usability.
- Raw negative voided-history values are not evidence of an applied negative contract.

## Q. Final 12.5 implementation scope

### 1. MUST FIX NOW

**E unless marked I:**

1. Source-confirmed scope-change presentation/recovery defects:
   - negative prior-change totals and unavailable basis;
   - actual draft-line resume;
   - honest propose/link wording **[I]**;
   - existing proposed-link recovery;
   - explicit consequence for financial-conflict retry **[I]**.
2. Loading/empty/error truth across Board, Job Card, Settings, Calendar, and money/scope regions.
3. Role-safe field brief using actual existing authorized scope and access context.
4. Lifecycle-dependent Overview, including completed-job closeout priority.
5. Current action/request versus historical record hierarchy.
6. Customer `/p` state evolution, current-versus-original contract labels, and state-appropriate contact copy.
7. Mobile Catalog transformation, overlay ownership, meaningful More context, and readable operational text.
8. Builder version/state labels and New Job repeat-use language.
9. Minimal shared semantics and visible form labels **[E/I]**.

### 2. SHOULD FIX IN 12.5

- Remove the permanent Activity rail and provide accessible full history **[E]**.
- Simplify Board metadata and default phone entry **[E]**.
- Improve mobile Calendar relevance/date navigation **[I]**.
- Clarify setup ownership, Pricing applicability, preferred templates, and Catalog business terminology **[E/I]**.
- Reuse existing template preview presentation where it can be done without a new renderer **[E]**.
- Improve historical Preview explanation **[E]**.
- Reduce expanded delivery/history noise **[E/I]**.
- Correct shell gutters, empty header, landmarks, controls, and read-only panel behavior **[I]**.
- Default bare successful login to Jobs **[E]**.
- Align customer scope-change branding/context using already authorized public facts **[I]**.

### 3. LEAVE ALONE

Preservation decisions **[E]**:

- Canonical job, customer, property, proposal, measurement, schedule, payment, and attachment authorities.
- Stage/disposition separation and terminal Complete behavior.
- Existing acceptance/signature policy.
- Accepted agreement and issued request snapshots.
- Refund/collectible rules.
- Canonical eligibility, idempotency, tenancy, and capability enforcement.
- Existing mobile domain-navigation model.
- Existing packages, selected measurements, contractor prices, terms, and warranty content.
- Legacy historical data and quarantines.
- Existing PDF/email generation behavior, apart from verifying that touched links/copy remain truthful.
- Current font in this pass.
- Native date/select controls.
- Marketing design and commercial pricing/tiers.

### 4. NEW DIRECTION — explicit approval required

Excluded from the implementation plan:

- **N:** Geist/font migration against Astra’s retain-font recommendation.
- **N:** password-recovery capability not currently present.
- **N:** customer scope-change tokens reopening durable authorized records.
- **N:** scope-change email delivery or automated reminders.
- **N:** per-company action-color themes.
- **N:** new coordinator roles/fields, new attention machinery, adaptive/reordered domain tabs, or a new dashboard.
- **N:** photo galleries, closeout packets/PDFs, consolidated agreement documents, invoices, or receipt workflows.

The approved-link and password-recovery gaps remain visible paid-launch concerns. Excluding them from 12.5 does not establish that they are acceptable for launch.

## R. Consolidated implementation order

Use **four coherent groups**, each with hard gates. Do not perform a global class replacement first.

### Group 1 — Truth, consequence, and minimal semantics

Scope: evidenced scope-change corrections, async-state honesty, action vocabulary, small shared primitives.

Hard gates:

- Negative authorized change remains negative in subsequent editor totals.
- Existing draft reload preserves its lines.
- “Check” never conceals an approval mutation.
- Lost link response can recover the existing proposed change.
- Loading never claims empty/zero/missing scope.
- Existing authoritative guards remain intact.

### Group 2 — Contractor operating workflow

Scope: Jobs, Job Card architecture and domains, Calendar, New Job, mobile navigation/overlays.

Hard gates:

- One job remains recognizable from Board through every domain and back.
- Approved scope and existing access context are useful to a restricted field user.
- Overview changes appropriately from Intake through Complete and dispositions.
- Activity no longer competes with task work.
- Actual 390 interactions work with menus, keyboard, and sticky actions.
- No new lifecycle or payment policy appears.

### Group 3 — Proposal preparation and reusable setup

Scope: Settings/Pricing/Catalog/Templates, Prepare, Builder, contractor Preview.

Hard gates:

- First and second proposals use the same durable company defaults without repeated setup.
- Direct-price and cost-based wording are accurate.
- Catalog works at 390.
- Preferred/selected template roles are clear.
- Draft/sent/revision/accepted identities agree across Job Card and Preview.
- Historical documents are not rewritten.

### Group 4 — Customer journey and whole-product proof

Scope: `/p`, existing scope-change customer presentation, closeout, auth-entry polish, final cross-surface verification.

Hard gates:

- Customer understands original agreement, current contract, requested amount, payment outcome, and completion independently.
- Post-acceptance sales prompts disappear from live chrome.
- Original documents remain retrievable.
- Public pages reveal no contractor-private data.
- All captures are inspected, correctly labeled, and tied to the target revision.
- New-direction items remain excluded or separately approved.

Shared visual corrections travel with each group. Each group exits only after correction of its failed evidence—not after a code checkpoint alone.

## S. Visual proof matrix

**E/I:** minimum proof must use actual product routes at desktop 1440 and true 390. Harnesses may supplement edge cases but cannot substitute for route proof.

| Route / surface | Minimum states at both widths |
|---|---|
| Jobs `/tools/roofing/saved` | Loaded Board and List; initial load; secondary schedule load; read failure; empty; long identity; action/attention case |
| Canonical Job Card Overview | Intake; draft/sent Proposal; accepted awaiting approval; Approved; Scheduled; Production; Complete with balance; Complete settled |
| Job Card dispositions | On hold; Lost; Closed; Closed during Production; recovery confirmation and partial-success presentation |
| Tasks | Empty; assigned/unassigned; due/overdue; completed; editor with keyboard |
| Job Calendar + company Calendar | Scheduled event; unscheduled eligible job; empty period; today navigation; load/error; changed date; post-start constraints |
| Measurements | Empty; selected source/date; multiple records; capture/edit; unavailable source |
| Proposals / scope changes | Draft/sent/accepted; saved change reopened; pending; authorized; voided; prior reduction; financial conflict; link recovery |
| Payments | No request; open request; failed email; processing; partial payment; paid; refund; unavailable contract; request review |
| Photos | Empty; populated; successful plus failed upload; item retry; phone capture/file selection |
| Navigation/overlays | More actually open; global nav open over Overview; More job actions; schedule/task/payment dialogs; focus restoration |
| New Job | New identity; existing customer/property; another property; duplicate hint; validation; interrupted resume |
| Usual roof / Prepare | First-use preview; direct-price; cost-based; missing relevant price; second-job reuse |
| Settings | Summary loaded/loading; Business, Branding, Preferences, Team; payment setup; validation/error |
| Pricing/Catalog/Templates | Populated/default; edit; validation; mobile price correction; preferred versus selected template; relevant loading/error |
| Builder / Preview | Draft; sent; unsent revision; accepted/signed; full modern document; supported incomplete historical record; mobile ordinary review |
| `/p/[token]` | Sent; accepted; signed; open request; processing; partial received; settled; authorized change; complete unpaid/paid; refund; unavailable financial truth |
| `/scope-changes/[token]` | Pending; immediate approval result; reload outcome under current supported behavior; stale/conflict; invalid/expired |
| Login | Desktop/390; invalid credentials; pending; safe explicit return; bare-login destination |

Additional proof requirements:

- Include a fresh representative job with usable scope and identity; historical smoke fixtures alone are insufficient.
- Capture transitions for the **same job**, not unrelated examples that happen to look correct.
- Record route, role, viewport, state, revision, and whether data is fixture or historical.
- Capture top viewport and relevant scrolled content; a very tall screenshot does not prove initial hierarchy.
- Force read failures through test-only network interception on isolated browser sessions. Do not add product “magic error” routes.
- Use staging/test-provider fixtures for mutation, payment, and interruption proof.
- Inspect every capture; reject wrong-route, loading-only, or mislabeled captures.
- Spot-check 1199/1200 navigation transition and larger text in addition to 390.
- Review representative existing PDF/email output for identity, amount, version, and destination continuity. This is proof, not authorization to redesign those renderers.

## T. Acceptance gate

Phase 12.5 can be called complete only when:

1. **Every implemented change is classified E or I**, or has separate explicit N approval.
2. **All MUST FIX NOW items are closed** with appropriate source, state, and runtime evidence.
3. **All SHOULD items have an explicit disposition**; none quietly disappears from the final scope.
4. **Current operating truth leads:** the contractor can identify the job, current situation, and next relevant action without reconstructing history.
5. **Field handoff is usable:** authorized work, relevant measurements/access, responsibility, and pending exceptions are understandable without exposing unauthorized commercial information.
6. **State evolution is evident:** Intake, awaiting approval, Scheduled, Production, and Complete do not share stale priorities.
7. **The customer understands the page now:** original agreement, approved changes, current contract, request amount, received payments, remaining obligation, and completion do not compete or contradict.
8. **No false completeness:** loading is not empty; unknown is not zero; copied is not sent; sent is not delivered; accepted is not approved; complete is not paid.
9. **Mobile interactions pass at true 390:** not merely overflow checks. Menus, keyboard, sticky actions, labels, focus, and touch targets work together.
10. **Canonical truth remains protected:** no competing writer, recalculated collectible balance, altered signature policy, snapshot rewrite, or loosened authorization.
11. **Verification is behavioral:** targeted regressions cover changed decisions and recovery paths. Class-string tests alone do not establish product correctness.
12. **Baselines are re-established at execution time:** do not blindly inherit Cursor’s 13-error typecheck count or old test totals. Identify unrelated existing failures and introduce no new ones.
13. **Evidence is complete and inspected**, with missing states explicitly resolved rather than labeled passed.
14. **Remaining launch limitations are stated separately.** Production delivery-event verification, absent password recovery, and the approved scope-change link limitation cannot be hidden behind “Phase 12.5 complete.”

**Final decision:** proceed to an implementation prompt based on this reconciled scope, not Cursor’s original styling-led plan. Preserve the existing product; make its current work, consequences, and transitions legible.

No files were modified. The only working-tree change remains your untracked Cursor audit report; no code, commits, or implementation were created.
