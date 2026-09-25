# FieldDive Job Card: hierarchy and readability review after Phase 12.5

Review date: September 25, 2026. Source revision: `413f791aca3a58ba68599838c8233f6092d2616a`.

Scope: independent source and existing screenshot review. No implementation, redesign of the product model, new features, commits, browser mutations, or new captures. This report is the sole authorized file addition.

Classification used for every recommendation:

- **E — EXISTING FIELDDIVE STANDARD / COHESION CORRECTION.** Restores the principles in the request or established FieldDive behavior.
- **A — ASTRA-ALIGNED IMPROVEMENT.** A proposed presentation choice consistent with those principles; not a claim that Astra prescribed its exact dimensions or design.
- **N — NEW DIRECTION.** Requires a separate decision. No N item is included in the recommended implementation scope.

Recommendations in tables inherit the classification in their row or column. Preservation requirements are E. Proposed proof and execution steps are classified in their sections.

## 1. Executive assessment

**The Job Card answers “what stage?” and “what next?” reasonably well, but does not yet answer the complete operational question at a glance.** Phase 12.5 improved the framework: Production now pairs its headline and desktop lifecycle action; Complete leads with closeout; mobile has a reachable sticky action; Activity no longer occupies a permanent rail. Those are material improvements.

The remaining weakness is composition. Most of the body is still an invariant field brief with a state heading attached. The contractor must assemble schedule, responsibility, scope, tasks, and money from separate, similarly weighted regions. Completing a job changes the first region more than it changes the rest of the page.

| Contractor question | Current assessment | Evidence boundary |
|---|---|---|
| What stage/state is this? | Mostly clear: compact stage badge plus plain-language headline | Current Production and Complete screenshots; other headlines confirmed in source |
| What is happening now? | Partial: “Work in progress” is clear, but date, lead, and actual start are disconnected | Production screenshot and current component order |
| What already happened? | Retrievable, weak at first glance: completion date is visible; actual start is far down; Activity requires navigation | Current source and historical Activity destination capture |
| What matters at this stage? | Weak: same Directions, When/lead, scope, tasks structure survives stage changes | Current source; current Complete and Production captures |
| Does anything need attention? | Partial: existing facts are present, but significance depends on reading rows; pending scope warning follows tasks | Source-confirmed; no fresh failure/overdue-task interaction proof |
| What is the next meaningful action? | Stronger for lifecycle advancement; Complete has an appropriate Payments entry when balance remains | Current source; final Production and earlier settled Complete mobile capture |
| Where is deeper information? | Good domain navigation; contextual routing from schedule/scope/tasks is uneven | Current tabs/More source and captures |

**E:** preserve the architecture and make current operating truth lead. **A:** achieve that with structured content slots, nearby metadata, deliberate section spacing, and a modest type scale. Another tint or heavier sentence will not solve this.

### Evidence basis and limitations

The newest available relevant set is `tmp/fielddive-ui-review/phase12-5-final-cohesion-depth/after/`. I visually opened its Production and Complete desktop Overviews, Production 390 Overview, both Payments widths, More, global navigation, and 1199/1200 Overviews. The corresponding six Job Card/More `before` images were also opened. SHA-256 checks confirmed those six before images are identical to the counterparts in `phase12-5-visual-depth-final/before/`; they are duplicate evidence, not an additional final pass.

I also opened all fourteen Job Card images in `phase12-5-paid-ui-audit/` and all twelve relevant Job Card/Activity/Photos/More/menu/keyboard/breakpoint images in `phase12-5-paid-ui-implementation/g2/`, plus both `g4/jobcard-payments` images. These earlier captures establish progression and domain context; they do not establish current visual defects where current source or final images supersede them. Unrelated setup, customer-page, board, and scope-editor screenshots are outside this focused review.

Important limits:

- Final desktop Complete shows **“Checking payments…” and “Checking authorized work…”**. It is not proof of settled completed-job money or scope presentation. The earlier G2 390 Complete capture does show an $18,500 remaining balance, Open Payments, Review closeout, and Copy customer link.
- No final 390 Complete capture or final Intake, Proposal, Approved, or Scheduled Overview capture was found in these Phase 12.5 sets. Their current behavior is assessed from source, with historical Approved screenshots clearly treated as historical.
- The original audit's `mobile/06-jobcard-more-sheet.png` does not show an open More sheet. The final `after/390-more-sheet.png` does.
- The image named `g2-11-keyboard-yields-390.png` shows focused Back to Jobs and no sticky CTA; it does not visibly prove an on-screen keyboard interaction. The final 1199 capture has a development indicator over the left end of the sticky region. Neither is complete interaction proof.
- The final fixture title includes “Production” even when its canonical badge is Complete. That is fixture naming, not evidence that canonical stage is wrong. Historic fixture dates are not evidence of overdue work.
- This is not a timed contractor usability study or a live accessibility test. Pixel positions below are approximate observations from supplied images, not browser measurements. Screenshot commit provenance was not independently established; the current source matches the principal final visual structure.

Prior Astra cohesion review, especially its Job Card, domain, width, and typography findings, informs classification. Its old defects were rechecked against current source rather than copied forward.

## 2. Current scan-path analysis

### Desktop Production, 1440

The eye encounters:

1. Large customer/job identity, address and raw email; small stage and More job actions at the opposite side.
2. Domain navigation, then a second “Overview” heading and separator.
3. Wide situation strip: “Work in progress” on the left, Complete job at the far right.
4. Directions as an isolated outlined button, followed by a broad schedule/lead row.
5. Authorized work and site notes, then an equally separated empty Tasks region.
6. Financial state and amounts; Recent activity and the separate schedule/history component follow further down in source order.

The state/action pairing is correct. The interruption between state and operational facts is not. Directions wins a separate horizontal region before timing and responsibility. Schedule and lead belong together but are pushed to opposite edges of a roughly 1,060px content span. “No tasks yet” gets its own section before money. Actual work-started context is after the recent-activity entry.

### Mobile Production, 390 × 844 capture

Identity/contact/stage occupy the area down to approximately y=290; navigation ends around y=340. The duplicate Overview heading occupies the next region. The state strip starts around y=414, Directions around y=495, and schedule/lead around y=580. Authorized work begins around y=700; site notes reach the sticky footer. Financial and tasks are beyond the first screen.

The user can identify Production and Complete job without scrolling. They cannot see a useful scope description or a money/task attention summary in that same glance. The package word “Premium” barely helps explain the work. This is a hierarchy shortfall, not an overflow defect.

### Complete

Complete correctly inserts closeout first, but immediately returns to Directions → When/lead → Authorized work → Tasks. The current screenshot makes “Not scheduled” and “Unassigned” prominent after a completion declaration. Because it is loading, those particular values cannot be certified as final facts; the persistent structural priority is nevertheless source-confirmed.

**E:** target the same reading sequence across stages: identity and stage → current situation and meaningful action → relevant operational facts and existing exceptions → supporting financial/record context → history access. **A:** remove or compact the redundant visible Overview heading while keeping a semantic panel heading. Do not remove useful Payments/Calendar/Proposals headings when mobile navigation only says More.

## 3. Top hierarchy/readability problems

Priorities below indicate review importance, not financial or security incident severity.

| Priority | Finding and consequence | Recommendation | Class |
|---|---|---|---|
| High | State is formatted as one or more strings; completion joins title and date into one bold sentence | Give the state region distinct title, timing, supporting-context, and action slots; use one visual family | A |
| High | Complete continues to present an active-work inventory immediately below closeout | Make completion, financial/request state, and record access lead; demote routine plan/assignment history | E |
| High | Actual work-started context is below Recent activity; schedule and lead are separated from the situation | Bring existing relevant plan/start/lead facts into or immediately beneath the situation group; retain detailed history below | E |
| High | Authorized work now avoids status-only labels but resolves to a package name such as “Premium” | Show a short faithful summary of already authorized work where role-safe data exists, plus access to its owning domain | E |
| High | Empty task sections consume the same structural attention as scope and money; all open tasks can expand the brief without a preview limit | Omit healthy zero-task chrome from Overview or fold it into a quiet summary; bound populated previews and route to Tasks | A |
| Medium | Dates and scope are small body text under faint 11px uppercase labels | Use readable labels and stronger value size/line-height, with weight reserved for meaningful distinctions | A |
| Medium | Full-width distribution sends lead and amounts far from related labels | Use nearby metadata columns and bounded money rows within the existing broad workspace | A |
| Medium | Financial still appends Proposal and sometimes Measurement rows | Separate agreement/measurement context from money; prioritize payment state, relevant amount and current request | E |
| Medium | Overview's “Recent activity” contains only View activity, not a recent event | Keep the quiet history entry; label it “Activity” unless already available events actually populate a small teaser | A |
| Medium | Normal Call action can use a filled slate primary alongside lifecycle action | Make contact utilities secondary within Overview; preserve one dominant lifecycle action | E |

There is no basis for adding an attention score, a new closeout status, or a dashboard. Those would be **N**, excluded.

## 4. Stage-by-stage hierarchy recommendations

All stage priorities and protected action relationships in this table are **E**. Suggested hiding/collapsing and compact grouping are **A**. One common framework serves all six stages; content emphasis changes, not the navigation or product model.

| Stage | Dominate | Support | Demote | Hide/collapse until needed | Action relationship |
|---|---|---|---|---|---|
| Intake | Current preparation situation and the existing useful entry into proposal preparation | Known property/customer context; selected measurement if relevant to this job | Future assignment, schedule and financial absence | Healthy empty tasks; no-scope/no-schedule inventory; irrelevant measurement absence | Existing Prepare/measurement entry adjacent to the preparation context; do not make measurement universally required or invent a lifecycle command |
| Proposal | Current draft, sent/waiting, or accepted-awaiting-contractor-approval situation | Current document/version and existing relevant blockers | Field scheduling inventory, quiet agreement history | Completed tasks and older documents; healthy empty sections | Draft entry relates to the draft; sent waiting state may need no primary; accepted Proposal pairs explicitly with Approve |
| Approved | “Approved — ready to schedule” and Schedule | Authorized work, existing site notes and lead; payment state if relevant | Generic stage repetition and an independent “Not scheduled” block | Empty tasks, history, irrelevant measurements | Schedule is attached to readiness; acceptance remains distinct from approval |
| Scheduled | Planned date/window with scheduled state and Start work | Lead, scope, site notes; real task/payment exceptions | Repeated schedule text elsewhere | Completed tasks, history, healthy empty facts | Start work relates to the planned commitment; preserve canonical eligibility rather than introducing date-based gates |
| Production | Work in progress with planned window and actual start clearly distinguished | Responsible lead, authorized work and site constraints; meaningful open tasks | Proposal status, measurement metadata, quiet history | Empty tasks and duplicate schedule/history presentation | Complete job belongs to current work; it must not suggest payments/tasks are new completion prerequisites |
| Complete | Work complete, completion date, remaining/payment-request state where authorized | Review closeout, customer record sharing, current contract context | Routine Directions, lead assignment and planned schedule | Empty tasks and detailed work history; retain real unresolved tasks visibly | No forward lifecycle action. Open Payments relates to money review when applicable; Review closeout relates to records. Sharing remains secondary |

**E:** on hold, lost, and closed qualify the situation without replacing operational stage. Preserve existing recovery actions and commitments. “Closed during Production” must not acquire a completion appearance. A missing lead is not automatically a blocker, and a balance is not automatically overdue.

Source nuance: Approved already says “Approved — ready to schedule.” Do not report this copy as missing. Scheduled currently says “Scheduled” or “Scheduled — date not loaded”; its date is elsewhere. **A:** join the readable date/window to that situation while preserving honest loading/unavailable states.

## 5. Desktop recommendations

- **A:** retain the broad Job Card shell and full domain rail. Inside Overview, use a bounded operational grouping rather than stretching every value to the far edge. A starting proof range is roughly 42–48rem for explanatory work content and 24–30rem for a compact money group, fitted within available width; these are trial dimensions, not new app-wide tokens.
- **A:** place schedule and production lead in adjacent aligned blocks, with a deliberate gap. Their current opposing-edge placement makes responsibility feel unrelated to the plan. Keep Assign next to the lead value.
- **A:** where space warrants it, pair an operational summary and a smaller supporting money group in the normal content flow. Use whitespace or one divider, not new dashboard cards or a permanent side rail. Preserve mobile DOM reading order.
- **A:** constrain label/value money rows so the contractor can associate them without tracing across the page. Right-align numbers within that group, not the whole workspace.
- **E:** keep the current desktop lifecycle CTA in the state area. **A:** give the text side useful contextual structure instead of filling the resulting width with a single sentence.
- **A:** reduce separators between facts belonging to one group; keep more space between groups than between label/value pairs. Avoid a full-width Directions row.

Empty space is not universally bad. The problem here is its placement: the largest gaps disconnect related facts while equal section gaps imply equal importance.

## 6. Mobile recommendations

- **E:** preserve Overview / Tasks / Photos / More and the existing sticky lifecycle action. Preserve sheet/menu/keyboard yielding and safe-area clearance.
- **A:** reclaim space before current work by compacting raw contact metadata and the redundant Overview title region. Retain the job/customer name and full readable service address. Do not shrink the title until long identities become unreadable or hide necessary contact access.
- **A:** use one compact current-situation group with title first, planned/actual timing second, then lead/context as appropriate. Two short aligned metadata blocks can remain side by side at 390 when content fits; allow natural stacking for long names and larger text.
- **A:** group Directions/Call with property or operational context as secondary utilities. Their touch targets may remain at least 44px without requiring an isolated full-width visual section.
- **E:** surface actual exceptions next to the affected summary; do not put every possible absence in the first screen. **A:** let healthy empty task sections disappear from Overview, leaving Tasks consistently discoverable.
- **A:** keep ordinary scope preview short enough to scan and route to details. Never silently truncate a pending-work restriction or site-access constraint merely to meet a fold target.
- **E:** the first screen should communicate identity, state and next action. **A:** for ordinary-length fixtures, also aim to show the relevant date/lead and the beginning of actual work context above the footer. Do not promise every long-content case will fit or use a fixed-height state region.
- **E:** preserve the owning domain title when entering through More. The current Payments heading successfully orients the user even though the rail highlights More.

The footer is appropriately thumb-reachable. The remaining mobile cost is reading distance and repeated rows, not a need for another bottom navigation system.

## 7. Complete-state critique

Complete is improved but incomplete as a composition. The current leading closeout region has an 11px uppercase “Closeout,” an 18px semibold combined completion/date line, small balance copy, and actions. The tonal surface and restrained emerald edge distinguish the region; they do not establish an internal hierarchy. Beneath it, the active field brief resumes unchanged.

**A — proposed internal structure:**

1. “Work complete” as the principal state title.
2. “Completed August 23, 2026” as a separate supporting date, using the existing canonical date and timezone formatter.
3. The already-known payment state and relevant remaining amount as a distinct supporting group. If a request is processing, make that context intelligible without implying another collection action.
4. Existing action order: Open Payments when appropriate; Review closeout; quieter Copy customer link.
5. Supporting job record and meaningful unresolved work below; routine planned schedule and assignment history lower or disclosed.

This is a normal page section, not a success/warning banner or an oversized hero. No new closeout workflow is needed.

**E:** preserve “complete is not paid.” The current closeout model distinguishes unknown from no remaining balance; keep that. **A:** expose current contract total compactly alongside relevant remaining/payment context if it helps the completed-job glance, while retaining detailed collected/refunded/agreement rows behind Review closeout. Avoid duplicating the same balance elsewhere.

Source caveat: the caller suppresses `financialSummary` when `closeoutLeads`, but still passes `paymentStatusLabel`. Once populated, `JobCardOverviewSummary` can therefore render a second Financial section with Payment and Proposal rows after the field brief. **E:** give completed-job money presentation one owner; do not assume current code already fully deduplicates it.

Source copy issue: the closeout model reuses `JOB_PAYMENT_INFORMATION_UNAVAILABLE`; the earlier G2 desktop capture displays “Payment details unavailable — contact your contractor” inside the contractor Job Card. **E:** use contractor-appropriate unavailable copy within this presentation, preserving the unknown state and existing recovery destination. This is not justification for new retry behavior.

**E:** keep real open tasks accessible and visible enough to notice after completion; suppress only healthy empty chrome. Review closeout remains a disclosure of existing rows, not a document export. Copy customer link remains explicitly copied, not sent.

## 8. Production-state critique

Production succeeds at two things: the state sentence is obvious and Complete job is visually dominant. It falls short on the rest of the field handoff.

- Schedule is one small line under “WHEN,” after Directions.
- The lead sits at the far edge on desktop; “Unassigned” is faint while Assign is more noticeable.
- “Premium” names a package rather than describing the authorized work.
- Tasks precede Financial even when no tasks exist.
- Actual start lives in the separate Production schedule component after Overview's recent-activity entry. `productionStartedAt` is supplied to the situation resolver but does not contribute to its Production headline/details.
- Pending scope warning is placed after the field brief's task list, separating risk from scope. The situation resolver can also mention the same pending work at the top.

**E:** bring planned window, actual start, responsibility and useful authorized scope together before the historical material. **A:** use a modest state heading, a clearly labeled planned/started pair, and a compact lead block; retain the existing page framework.

**E:** locate the proposed-versus-authorized warning beside Authorized work and route to Proposals under the existing permissions. **A:** avoid repeating the full warning in two regions; a brief state-level reference is sufficient when the detailed warning is adjacent to scope.

**E:** actual scope must come from the accepted snapshot and authorized changes, not a current editable template or a sent-but-unaccepted revision. **A:** Overview should show a small set of recognizable work descriptions or one concise existing description, with package name as supporting identity. Full quantities, terms and line-item detail remain in the owning domain. If role-safe descriptive data is unavailable, say so honestly and use an allowed existing destination; do not expose commercial content to field users or invent a summary.

The scope gap is not fully solvable in CSS. The current read model only passes package labels and change summaries. Any later implementation must first establish the existing authorized, role-safe source for base scope before promising richer text.

## 9. Action hierarchy critique

| Action | Judgment and recommendation | Class |
|---|---|---|
| Approve / Schedule / Start work / Complete job | Keep one dominant eligible lifecycle action paired with state; keep desktop inline/mobile sticky ownership | E |
| More job actions | Correctly subordinate beside stage; preserve disposition confirmations and recovery semantics | E |
| Assign / Change lead | Keep contextual to lead, not equal to lifecycle CTA; enlarge hit area without making it a filled primary | A |
| Directions | Useful field utility, over-allocated as a separate region; place with location/operational context | A |
| Call | Source uses a filled slate control when phone exists, competing with lifecycle intent; use secondary utility treatment in Overview | E |
| Review closeout | Correct disclosure behavior; retain accessible expanded state and subordinate placement to money action when balance requires review | E |
| Open Payments | Good direct domain route. During active work keep it a supporting link; Complete can give it priority when supported by current facts | E |
| Copy customer link | Lower emphasis than review/necessary money action; a quiet action can retain the same touch target and copy feedback | A |
| View activity | Correct low prominence; keep as a history destination rather than a second primary | E |
| Domain actions | Keep editing/collection/preparation in their owning domains. Add contextual entry points only to existing permitted destinations | E |

**E:** do not interpret a balance alone as a demand to collect again, a pending payment as failure, or absence of tasks as missing setup. No new action eligibility or attention policy is proposed.

## 10. Typography, composition and information density

The system is not literally only bold/not bold: the title is 24px on mobile and about 26.4px on larger screens, state title is 18px, and panel title is 16px. However, most operational values are 14px; section labels repeat 11px uppercase, tracked, muted styling. Combined with identical separators, this produces a predominantly weight-based hierarchy within the work itself.

**A — suggested shared hierarchy for visual proof, retaining the current font:**

| Role | Proposed treatment | Purpose |
|---|---|---|
| Job/customer title | Retain current approximate 24–27px semibold scale; natural readable mobile wrapping | Identity stays recognizable |
| Current state title | Approximately 20px/26px semibold, below page-title dominance | Gives the current situation a distinct level without a hero |
| Relevant schedule date or remaining amount | Approximately 16–18px, selectively emphasized | Makes decision-bearing facts scan targets |
| Ordinary section heading | Approximately 14–16px medium/semibold, preferably sentence case | Avoids dependence on tiny uppercase labels |
| Operational value/scope/task text | Approximately 15–16px with comfortable 1.4–1.5 line-height | Improves practical reading without bolding every value |
| Supporting date/timezone/version metadata | Approximately 13–14px, regular weight, secondary tone | Clearly supports the main fact |
| Actions and links | Readable text, predictable underline/hover/focus behavior, adequate hit area | Distinguishes destinations from plain values |
| Money | Tabular numerals; one relevant amount emphasized; stable local alignment | Faster number comparison |

**A:** try 4–6px between label/value, 8–12px between related facts, and 20–24px between meaningful groups. These are review starting points; avoid global token churn before proving the Job Card. A divider should signal a change of topic, not merely the next value.

### Financial

Current active-work Overview has useful money: status, contract total, collectible remaining, current request amount/status when present, and Open Payments. This is a substantial improvement over the original audit. It is nevertheless low in the scan path and the amounts share equal boldness at the far edge. Proposal status and Measurement can still be appended under Financial.

**E:** money summary should answer payment state, total, remaining, and current request context without opening Payments. Do not replicate its history or collection editor. **A:** emphasize the currently relevant amount, keep contract total supporting, and keep status adjacent. Processing/open context must travel with the request amount. **E:** move unrelated measurement/proposal facts to their appropriate context or deeper domain; do not manufacture financial warnings from them.

During Production, money should not outrank operational state by default. On Complete, it belongs directly below completion because remaining obligations often determine the next meaningful action. Actual actionable request/delivery exceptions should use existing domain truth, not a new inferred urgency rule.

### Authorized work

The former Accepted/Signed substitution has been corrected in `resolveFieldBriefApprovedScopeLabel`: status-only labels are rejected. The remaining package-only summary is still insufficient. **E:** preserve that correction and improve descriptive content using existing authorized truth. **A:** retain a small preview and contextual detail access rather than making Overview a second proposal document. Existing site/schedule notes belong beside the work they qualify, not below unrelated tasks.

### Tasks

The active Overview uses `JobCardFieldBrief`, not `JobCardOverviewTasksSummary`; `tasksSummary={null}` is passed. The field brief renders every open task and always renders an empty task section. Therefore, changing the unused summary component alone would not fix this page.

**A:** use one compact task summary whose prominence depends on actual presence: none → no dedicated Overview block; a few open tasks → readable short preview; many → bounded preview and View tasks; completed history → Tasks domain. **E:** carry loading/error state into the chosen presenter before hiding zero-task content. The current field-brief input has task rows but no task loading/error signal, so an empty array alone cannot establish “no tasks.” Do not claim a live false-empty flash was reproduced in this review.

### Recent activity

The current Overview teaser contains no event summaries, only its heading and View activity. **A:** the simplest correction is a compact Activity entry. If already-available event data is later reused for a genuine teaser, keep it to one or two useful events with secondary dates; do not add an independent read/aggregation feature just to fill the region. **E:** retain the complete history destination and do not restore the rail.

## 11. What should stay unchanged

All items are **E — EXISTING FIELDDIVE STANDARD / COHESION CORRECTION** preservation requirements.

- One canonical job with domain tabs owning truth and edits.
- Recognizable identity, service address, property/customer navigation and explicit Change behavior.
- Compact stage badge and separate disposition; no rainbow stage palette.
- Current desktop state/action pairing and plain-language lifecycle verbs.
- No forward lifecycle action after Complete.
- Mobile four-slot navigation, More destinations, and a visible domain heading after More navigation.
- Sticky CTA reachability, safe-area accommodation and overlay yielding.
- Dedicated Activity destination and absence of the old permanent Activity rail.
- Closeout's leading placement, existing disclosure, money-unknown distinction and honest copy-link feedback.
- Existing canonical money helpers, accepted document snapshots, authorized-change distinction and capability restrictions.
- Restrained white/cool-toned surfaces, purposeful blue navigation accents and limited semantic warning/error colors.
- Native scheduling controls and deeper domain workflows; no editor redesign is needed for this audit.

A useful contextual region does not require a new card. Existing healthy tabs and domain layouts should not be restyled merely to make every component look identical.

## 12. Root-cause implementation strategy

This section is a proposed strategy only; no implementation is authorized by this review.

| Root cause | Evidence | Durable correction | Class |
|---|---|---|---|
| Content is flattened too early | Situation becomes a newline-delimited string; completion/date become one `completionLabel` | Keep existing truth derivation but expose presentation fields for title, date/context and action relationship | A |
| Field brief is stage-invariant | Same rendered brief is passed for all stages | Give Overview a shared stage-aware composition using existing facts; avoid six separate pages | E |
| Responsibilities overlap | Closeout leads, brief repeats plan/tasks, Financial can reappear, ScheduleSection follows activity | Assign one presentation owner per summary fact and preserve exception rendering when relocating it | E |
| Scope projection lacks descriptive content | Caller supplies package labels and change summaries | Establish existing role-safe accepted-scope projection before rendering a richer preview | E |
| Local typography repeats | QuietLabel, Financial, Tasks and Activity duplicate 11px uppercase styling | Introduce/reuse small Job Card semantic typography/grouping primitives; prove locally before wider adoption | A |
| Layout uses full-width `justify-between` | Lead and monetary values become disconnected | Use bounded metadata groups and local number alignment | A |
| Density does not reflect relevance | Empty tasks, measurement absence and routine schedule facts retain standalone regions | Explicit summary visibility by resolved fact state and current stage, not by arbitrary CSS hiding | A |
| Loading truth is not uniformly represented | FieldBrief tasks/schedule lack the richer read states available elsewhere | Preserve and pass existing loading/error distinctions into the summary; never infer emptiness from missing reads | E |

The fix belongs primarily to Job Card composition and view-model shape, then shared presentation helpers. It does not require database changes, an attention engine, a new product status or a global font migration.

## 13. Exact files/components likely involved

Paths are relative to repository root. This is an impact map, not authorization to edit.

| File/component | Why it is involved | Proposed scope/class |
|---|---|---|
| `app/tools/roofing/jobCard/JobCardClient.tsx` | Situation inputs around line 860; field brief around 916; Overview assembly around 1394–1560; separate schedule block immediately afterward | Recompose existing facts, domain entries, money ownership and role-safe presentation — E |
| `app/tools/roofing/jobCard/JobCardOverviewSummary.tsx` | String headline renderer, section order, Financial fallback and appended Proposal/Measurement rows | Structured current-state layout and stage priorities — A/E as detailed above |
| `app/lib/jobCardOverviewSituation.ts` | Stage/disposition resolver and newline formatter; unused Production start input | Retain truth decisions; structure display data and existing timing — A |
| `app/tools/roofing/jobCard/JobCardCloseoutSummary.tsx` | Combined completion/date text, balance, disclosure and sharing action order | Completion hierarchy and action emphasis — A |
| `app/lib/jobCardCloseoutViewModel.ts` | Produces combined completion label and existing closeout money rows | Separate presentation fields and contractor-appropriate unavailable copy; preserve arithmetic/semantics — A/E |
| `app/tools/roofing/jobCard/JobCardFieldBrief.tsx` | Repeated QuietLabel, Directions/Call region, wide schedule/lead pairing, scope and unbounded tasks | Shared operational grouping and relevance-driven density — A |
| `app/lib/fieldBriefModel.ts` | Package-only base-scope projection; task/schedule input shape | Role-safe existing-fact scope and read-state projection — E |
| `app/tools/roofing/jobCard/JobCardScheduleSection.tsx` | Separate plan/start/completion/history presentation and errors | Move summary facts while preserving all errors, guards and domain controls — E |
| `app/tools/roofing/jobCard/JobCardHeader.tsx` | Title/contact density, raw email wrapping and stage/actions | Compact supporting metadata at 390 without losing identity access — A |
| `app/tools/roofing/jobCard/JobCardSectionPanel.tsx` | Always-visible title/divider creates duplicate Overview heading | Scoped Overview presentation option, preserving accessible heading/domain orientation — A |
| `app/tools/roofing/jobCard/JobCardOverviewTasksSummary.tsx` | Has loading/error and bounded preview behavior, but is not used in this Overview | Evaluate reuse; do not patch it alone or render two task summaries — A |
| `app/components/ui/MoneyRow.tsx` | Local amount emphasis/alignment; no arithmetic | Reuse existing formatter; apply bounded layout/tabular numbers without money changes — A |
| `app/components/ui/SectionHeader.tsx`, `surfaceStyles.ts`, `buttonStyles.ts` | Existing shared vocabulary | Reuse first; avoid global token changes unless independently justified — E |
| `app/tools/roofing/jobCard/JobCardForwardLifecycleAction.tsx`, `app/lib/jobCardForwardLifecycleAction.ts` | Inline/sticky ownership and canonical action selection | Mostly protected; verify composition does not duplicate or lose action — E |
| `JobCardProductionLeadControl.tsx`, `JobCardTabs.tsx`, `JobCardMoreSheet.tsx`, `jobCardMobileNav.ts` in the Job Card directory | Contextual action/navigation destinations | Mostly protected; spacing or contextual routing only if needed — E |
| `app/lib/stickyActionYield.ts`, `app/tools/roofing/jobCard/jobCardPhase8MobileHierarchy.test.ts`, `app/lib/phase125PaidUiTruth.test.ts` | Existing sticky/read-truth contracts and relevant regression coverage | Verification impact, not a request to rewrite working behavior — E |

Shared primitives already exist. Recommending their creation from scratch would repeat a superseded pre-12.5 finding.

## 14. Recommended implementation order

1. **E:** establish settled baseline captures for the missing stages/roles, and confirm current source/test baseline. Do not use the loading Complete shot as a paid/unpaid acceptance reference.
2. **E:** map one owner for each current fact and exception. Confirm existing role-safe scope availability and existing task/schedule read states before deciding presentation density.
3. **A:** introduce the shared structured state presentation and local label/value/grouping hierarchy. Prove Production and Complete first because they expose the main weaknesses.
4. **E:** recompose Complete: completion/date, money/request context and closeout; remove repeated money and stale active-work priority while preserving unresolved facts.
5. **E:** recompose Production and Scheduled around timing, lead, authorized work and relevant exceptions; preserve the existing lifecycle action path.
6. **E:** apply the same framework to Approved, accepted Proposal, sent/draft Proposal and Intake; no forced action while waiting.
7. **A:** compact empty tasks, contact utilities and redundant Overview chrome; bound desktop metadata/money widths and verify mobile order.
8. **E:** run focused behavior/regression and visual proof. Correct evidenced issues only; preserve unrelated healthy domains and shared app styling.

Do not begin with a global search-and-replace of font sizes, uppercase labels or surface colors. The order of facts must be right before polishing their type.

## 15. Screenshot/proof plan

**E:** capture the actual canonical Job Card route at 1440 × 900 and 390 × 844 for each state below, with top viewport plus relevant scrolled/full-page evidence. Record revision, route/job, role, viewport, scroll position and settled read state. **A:** add same-job progression pairs in a controlled test environment to demonstrate continuity rather than unrelated page designs.

| State set | Required proof |
|---|---|
| Intake | Known identity with and without selected measurement; existing preparation entry; no irrelevant empty inventory dominance |
| Proposal | Draft; sent awaiting response; sent with revision draft; accepted awaiting operational approval |
| Approved | Ready to schedule and Schedule visually paired; useful scope and no duplicate unscheduled panel |
| Scheduled | Date/window and lead beside current state; eligible Start work; long window/lead labels |
| Production | Planned versus actual start; assigned/unassigned; useful base scope and authorized changes; no tasks/few/many; pending change warning adjacent to scope |
| Complete | Balance remaining/no request; current open request; processing; no remaining balance; refunded scenario; unavailable/loading money; unknown completion date |
| Dispositions | On hold, lost, closed, closed during Production, and applicable recovery action; stage retained |
| Restricted field role | Scope/plan/tasks remain useful without money, proposal-author controls or customer-link sharing leakage |
| Navigation | More genuinely open; Payments/Calendar/Proposals/Activity destination headings; global menu and More job actions over a job with sticky action |
| Read states | Initial and refresh loading/error for schedule, tasks, scope and payments; no false empty or settled labels |

**E — interaction gates:** one visible eligible lifecycle CTA at a time; existing confirmation/busy/error behavior; no CTA through an overlay; focus restored after More; safe-area and scroll clearance; larger text and long content; no horizontal overflow. Check 1199 and 1200 explicitly. Verify the actual on-screen keyboard rather than inferring it from a filename or focused link.

**A — comprehension check:** show the top viewport briefly to a contractor unfamiliar with the fixture and ask stage, current situation, relevant time/person, and next action. Then ask where to find scope, money and history. Record answers instead of calling a screenshot a measured “five-second pass.” For Complete, ask separately whether work is complete and whether money remains. For Production, ask whether the shown dates are planned or actual.

**E — regression checks:** retain action eligibility and terminal completion tests, accepted-versus-approved distinction, schedule authority, money unknown/loading semantics, scope authorization and field-role restrictions. Add meaningful tests for changed presentation decisions (such as healthy empty tasks versus loading/error, or completed money appearing only once), not a suite that merely repeats Tailwind strings. Refresh the test baseline rather than inheriting old report counts.

Acceptance is not “the tint changed.” It is that state/action/context are understandable together, real attention is visible without reading every row, quiet states stay quiet, and deeper domains remain obvious.

### Screenshot evidence index

All names below were visually inspected during this review unless explicitly described as hash-identical duplicates.

- **Final evidence**, `tmp/fielddive-ui-review/phase12-5-final-cohesion-depth/after/`: `1440-jobcard-overview-production.png`, `1440-jobcard-overview-complete.png`, `390-jobcard-overview.png`, `1199-jobcard-overview.png`, `1200-jobcard-overview.png`, `1440-jobcard-payments.png`, `390-jobcard-payments.png`, `390-more-sheet.png`, `390-global-nav.png`.
- **Immediate before evidence**, same directory's `before/`: `1440-jobcard-overview-production.png`, `1440-jobcard-overview-complete.png`, `390-jobcard-overview.png`, `1440-jobcard-payments.png`, `390-jobcard-payments.png`, `390-more-sheet.png`. The same six under `phase12-5-visual-depth-final/before/` were verified as hash-identical duplicates.
- **Implementation G2**, `tmp/fielddive-ui-review/phase12-5-paid-ui-implementation/g2/`: `g2-02-jobcard-complete-1440.png`, `g2-03-activity-destination-1440.png`, `g2-04-payments-1440.png`, `g2-05-photos-1440.png`, `g2-06-jobcard-complete-390.png`, `g2-07-more-sheet-390.png`, `g2-09-production-sticky-390.png`, `g2-10-menu-yields-390.png`, `g2-11-keyboard-yields-390.png`, `g2-14-jobcard-production-1199.png`, `g2-14-jobcard-production-1200.png`. This list is eleven files; the evidence-basis reference to twelve includes no additional file and should be read as eleven.
- **Implementation G4**, same implementation directory's `g4/`: `jobcard-payments-1440.png`, `jobcard-payments-390.png`.
- **Original audit desktop**, `tmp/fielddive-ui-review/phase12-5-paid-ui-audit/desktop/`: `jobcard-A-01-overview.png`, `jobcard-A-02-tasks.png`, `jobcard-A-03-calendar.png`, `jobcard-A-04-measurements.png`, `jobcard-A-05-proposals.png`, `jobcard-A-06-payments.png`, `jobcard-A-07-attachments.png`, `jobcard-G5A-proposals-sent.png`.
- **Original audit mobile**, same audit directory's `mobile/`: `02-jobcard-A-overview.png`, `02b-jobcard-A-overview-settled.png`, `03-jobcard-A-payments.png`, `04-jobcard-A-proposals.png`, `05-jobcard-B-overview-closeout.png`, `06-jobcard-more-sheet.png`.

## 16. Risks / protected behavior to preserve

All protections below are **E**.

- Operational stage and disposition remain separate; accepted proposal is not operational approval; Complete is not Closed or Paid.
- Existing forward-action eligibility, confirmations, busy states, server authorization and idempotency remain authoritative. No new payment, task or assignment prerequisite is implied by improved prominence.
- Planned dates, actual start and completion date retain their distinct meanings and timezone formatting.
- Accepted snapshots and authorized changes own scope; summaries must not substitute a mutable template, draft revision or pending proposal.
- Unknown/loading/error must not become empty, zero, unassigned, unscheduled or settled through a compact presenter.
- Money remains derived by existing canonical helpers. No new collectible-balance arithmetic, collection policy, due-date inference, refund treatment or invoice behavior.
- Field-role visibility and customer-link capabilities remain enforced. A richer scope summary does not authorize exposing prices or restricted proposal routes.
- Relocating/removing duplicate schedule chrome must preserve start/complete errors, stale-read warnings and action blocking. Lower-page errors must not disappear with the container.
- Removing an empty task region must not hide unresolved tasks, failures or loading. A large task list must not push scope restrictions and payment exceptions indefinitely downward.
- Mobile visual reordering must match accessible reading/focus order. Sticky controls and overlays retain their existing ownership.
- Copy customer link remains a copy/share action with honest success/failure/expiry feedback, never an assertion that the customer was notified.

**N — excluded, not approved:** new attention scoring or automated recommendations, new closeout statuses/checklists, new scope documents/editors, new notification behavior, new customer record features, new coordinator roles, adaptive domain tabs, and app-wide layout/font/color redesign. None is necessary to address the evidenced hierarchy defects.

Review conclusion: retain the FieldDive Job Card and its domain model. Its next improvement should be a shared, stage-aware composition of existing truth, with Complete and Production as the first proof cases. The current weakness is primarily the relationship and priority of facts, not their color.
