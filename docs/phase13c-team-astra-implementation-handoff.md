# Phase 13C Team workspace — Astra implementation handoff

Date: 2026-09-29. Uncommitted UI pass. Independent Cursor audit and live visual verification still required.

> **Status (2026-09-30):** The sections below dated 2026-09-29 are a historical record of the earlier person-anchor pass. They are kept for history. Where they conflict with `docs/phase13c-people-crew-access-product-architecture-decision.md` (controlling) or with "2026-09-30 accepted Team truth correction" at the end of this file, those two are current truth.

## Decision and scope

Team is now an Operations destination at `/tools/team`: a person-centered workspace, not a Company Settings access table. The old route redirects. The latest user instruction explicitly supersedes the earlier research/reconciliation recommendation to make Team and Crews separate primary surfaces. No other locked contract is superseded.

Current truthful model: person identity → work-profile description → verified current coordination/task facts, when available → secondary details/access action. Future durable Crew relationships belong beneath the same person anchor. Access and labor remain separate underneath, not separate primary destinations.

*(Historical, superseded 2026-09-30: placing the Crew mainly below a person anchor is no longer the model. A Crew is an independent operational group, and a Crew with no Lead is complete. See the 2026-09-30 section below.)*

This is not a delivered Crew product. It cannot yet answer who works with whom. It must not suggest otherwise. No Crew placeholder, fake name, crew count, membership inference, `crew_label` adapter, or `assigned_to`-as-Crew-Lead adapter was added.

## Screen intent and composition

- First scan: person name and practical profile; Owner first, other people alphabetically, not grouped into role-based leadership departments.
- Second scan: real open Coordinator/task responsibility underneath the person. These facts use the existing access-admin projection only. Ordinary directory zeros are never presented as work facts. No assertion that zero assignments means no work.
- Third scan: explicit FieldDive state; a secondary Details & access action.
- Main surface: one broad, restrained white workspace, max-w-6xl, unboxed person blocks and light dividers. No three-column access table, cards per person, metrics, or org chart.
- Invitations: separate secondary column only when populated; below the people on mobile. They are not active people.
- Removed access: preserved collapsible section below; handoff attention still forces visibility.
- Person block: identity/action region and optional relationship body are siblings. The relationship body is not wrapped in an editor button. Later direct Crew actions can live there without nested buttons or a new page composition.
- Mobile: person/context stacked with wrapping identity, shallow relationship guide, 44px controls. This is source intent, not measured 390px proof.
- Person sheet: current profile and real current work before FieldDive access. Existing Change access and specialist disclosure remain deliberate steps. No Crew or invented active-job sections.
- Initial unresolved viewer state now renders loading instead of briefly asserting an empty team.

## Benchmark synthesis — inspected local evidence

All paths below are under `tmp/fielddive-ui-review/phase13c-visual-research/`.

| Reference | Used | Deliberately rejected |
| --- | --- | --- |
| `acculynx-labor-manager.png` | Person/organization anchor with subordinate operational relationships; those relationships remain visible in the workspace | Dense nested tables, repeated column headers, app-invitation chrome, subcontractor schema assumptions |
| `buildbook-people.png` | Readable identity, restrained separators, small avatar | Flat access directory as the permanent product model; relationship-erasing columns |
| `linear-access-decoded.png` | Plain-language access explanation and deliberate choices | Permission administration as the Team landing page; enterprise matrix |
| `roofr-job-decoded.png` | Clear primary context, domain hierarchy and spacing | Repeated gray containers, copying its job-page composition into Team |
| `companycam-mobile.png` | Context before tools; field-friendly explicit actions | Its card dashboard, floating toolbar, and decorative composition |

Also inspected the rejected Team desktop rhythm, person-read and mobile screenshots in `tmp/fielddive-ui-review/phase13c-slice1-team-redesign/`. Those are comparison evidence, not proof of this implementation.

## Preserved versus restructured

Preserved: all Team mutation handlers and endpoint contracts; invitation lifecycle; strong sign-in; revision/idempotency handling; removal/handoff distinction; reactivation; ownership transfer; Owner exclusion from ordinary role choices; Office Manager/Lead primary chooser; Sales/Production Coordinator/Field specialists; TeamSheet and TeamAccessChooser; server guards; role keys; evaluator; grants; jobs.complete/progress split; schedule guards; Coordinator terminology; existing staging migration and authority tests; 13D behavior.

Restructured: landing composition, person blocks, invitation placement, page width, page/header language, person-read priority, shared navigation destination and legacy route compatibility. Removed the Settings Team row and settings back-link. No role determines whether the relationship body can exist.

Implementation files remain partly under `app/tools/settings/team/` to avoid an unrelated move of all existing lifecycle components and their imports. That folder is implementation organization, not the canonical route or product IA. It can be relocated mechanically later, but the UI does not depend on that relocation.

## Exact files touched by this pass

1. `app/tools/team/page.tsx` — new canonical route using the existing authenticated active-company boundary.
2. `app/tools/settings/team/page.tsx` — redirect for old bookmarks.
3. `app/tools/settings/team/CompanyTeamClient.tsx` — workspace composition, real work facts, person-read priority, initial loading truth.
4. `app/tools/settings/team/TeamPeopleList.tsx` — hierarchy-ready person blocks, optional real relationship body, current-work renderer, mobile wrapping.
5. `app/tools/roofing/fieldDiveNavConfig.ts` — Operations Team item/key.
6. `app/tools/roofing/FieldDiveAppShell.tsx` — Team active-nav type only.
7. `app/tools/roofing/useViewerNavAccess.ts` — Team nav presentation uses existing company-operating flags; unknown/scoped-only access does not advertise a company directory. No server authority changes.
8. `app/tools/settings/CompanySettingsClient.tsx` — remove primary Team row and its now-unused local variable.
9. `app/lib/companySettingsExperience.test.ts` — updated route/Settings presentation contract.
10. `app/lib/phase13cTeamSurface.test.ts` — workspace, nav, counts, structural rendering and no-fake-relationship checks; retained authority vocabulary assertions.
11. `docs/phase13c-team-astra-implementation-handoff.md` — this handoff.
12. `tmp/fielddive-ui-review/phase13c-team-astra/PROOF-STATUS.md` — explicitly records missing proof and required captures (tmp may be ignored by Git).

The worktree was already substantially dirty. Other changed files in Git status belong to the prior Slice 1 work, not this pass. In particular, the deleted `CompanySettingsTeamEditor.tsx`, new migration and authority changes were already present.

## Verification

- Focused run: **141 tests passed, 0 failed**, six files: phase13cTeamSurface, companySettingsExperience, phase13cSlice1Access, phase13gTeamUi, phase13hAccessLaunch, fieldDiveNavConfig.
- These include preserved Start/Complete/Lead/tenancy tests and two actual static React-rendering checks. Static HTML checks are not visual proof.
- `npm.cmd run typecheck`: failed on three generated `.next/types` references to missing `app/tools/roofing/ai/page.js`. Generated files left untouched; no server regeneration attempted.
- `npm.cmd run typecheck:test`: failed on existing/untouched fixture/type issues across starter preview, disposition, payment, task tests, and `phase13cSlice1Access.test.ts:149` (expected two arguments). These tests were not repaired or relaxed in this UI pass.
- Targeted ESLint: one error in the existing `FieldDiveAppShell.tsx` localStorage effect (`setJobCardHref`, now line 389). This pass changed only that file's active-nav union. No errors reported in changed Team components/routes/nav logic.
- `git diff --check`: passed; only line-ending notices.
- The Windows sandbox helper also failed for several commands with error 206. Read-only verification commands were rerun with explicit escalation approval where needed.
- External browser runtime could not initialize (same helper error). **No live page inspected, no screenshot captured, no desktop or 390px measurement proven.**

## Mandatory self-critique

1. **Mental model:** people as operational anchors, with known responsibility beneath them and future reusable Crew relationships in place.
2. **Better than a flat software-user list:** work facts have their own subordinate region; invitation lifecycle is separate; the entire person/relationship block is not an access-editor click target. However, people without recorded work still necessarily have sparse, profile-led blocks today.
3. **AccuLynx:** retained the parent/operational-group relationship idea and workspace visibility, not its schema or visual table layout.
4. **BuildBook:** retained identity clarity and light visual rhythm, not a permanent flat directory.
5. **Linear:** retained plain-language current-state access and deliberate editing, not permissions-first Team.
6. **Rejected:** AccuLynx density/app split; BuildBook relationship-erasing flatness; Linear enterprise administration as the primary surface.
7. **Crew fit:** real Crew children attach under the existing person anchor, outside the person-sheet button. No placeholder is rendered today. *(Historical, superseded 2026-09-30: Crews are independent and may have no Lead.)*
8. **Page redesign needed later?** Not for the approved person → Crew → members structure. Data adapters and real relationship/action components are still needed; this is not a claim those are implemented.
9. **Owner can lead:** presentation has no role gate on relationship children. Actual eligibility remains future contract work.
10. **Production Coordinator can lead:** same, without equating profile with usual or assignment Lead.
11. **Lead can lead:** same. Existing scoped access remains unchanged.
12. **Person without Crew:** yes; ordinary complete person block, no empty Crew warning.
13. **Crew member without access:** future data projection must support it; not available from current membership-only records. No synthetic people added.
14. **Software user without membership in a Crew:** yes, no Crew requirement or role grouping.
15. **Future common actions in place:** relationship region can own Add/remove/change lead controls; sensitive access remains in the sheet. No dead controls shipped.
16. **Future drag/drop:** sibling person/relationship regions can support it without wrapping interactive children in buttons. Accessibility and reconciliation remain unimplemented future work.
17. **Access secondary:** yes relative to identity and available work context; it remains visible because it is real current truth. No raw permission matrix.
18. **Operational rather than administrative:** improved through Operations placement and work-first hierarchy. The complete labor relationship story remains impossible without Crew truth.
19. **Premium without clutter:** authored through spacing, alignment, restrained lines and one workspace surface. Visual quality is NOT signed off without browser proof.
20. **Exceeds AccuLynx operational clarity?** Cannot honestly claim this yet: actual Crew relationships are absent and the new UI has not been live-inspected. The structural direction supports it; the acceptance gate remains open.
21. **Crew-schema dependencies:** durable non-login people, reusable Crew identity, changing membership, usual Lead, assignment Lead, historical attribution, operational editing, assignment/schedule projections.
22. **Remaining debt:** live 390px/desktop validation; larger-team density and discoverability testing; legacy component folder naming; company directory projection cannot express non-login workers or provide all operational details to non-admin viewers. Do not broaden those server projections in a UI pass.

## Backend blockers and future boundary

No backend blocker was found for this bounded current-truth UI pass. The absence of durable Crew truth is an explicit known constraint, not silently repaired. Existing counts are access-admin-only and validated server-side; zero placeholders from ordinary directory rows are deliberately not used as operational data. A future broader read-only operational projection needs its own approved backend slice.

Future Crew work must supply real person identity independent of membership, Crew identity, memberships and lead relationships, assignment/history truth, and authorized in-place actions. Do not use software profiles to infer any of those relationships. Do not widen Lead company-directory access to fill this workspace.

## Handoff gate

Cursor independently audits the diff, runs authority/regression checks, and performs all eleven live captures listed in `tmp/fielddive-ui-review/phase13c-team-astra/PROOF-STATUS.md`. Paid-product visual acceptance, true-390 overflow, focus/keyboard and long-content behavior remain open. This pass stops here, without commit, push, production mutation, schema/migration changes, or dev-server management.

## Full worktree status at handoff

This includes pre-existing work. Untracked directory entries contain files omitted from ordinary `git diff --stat`; the exact pass-touched paths are listed above.

```text
M app/api/jobs/complete-work/route.ts
 M app/api/jobs/start-work/route.ts
 M app/lib/access/registry.ts
 M app/lib/access/registrySql.ts
 M app/lib/access/teamAccessPresentation.ts
 M app/lib/access/viewerAccess.ts
 M app/lib/boardGuardedMovement.test.ts
 M app/lib/boardGuardedMovement.ts
 M app/lib/companyMemberValidation.ts
 M app/lib/companyMembershipRoles.ts
 M app/lib/companySettingsExperience.test.ts
 M app/lib/invitations/invitationModel.ts
 M app/lib/jobActivityChronology.ts
 M app/lib/jobCardOverviewComposition.ts
 M app/lib/jobLifecycleActionEligibility.ts
 M app/lib/jobScheduleStageCoherence.test.ts
 M app/lib/jobTaskPersistence.ts
 M app/lib/phase125PaidUiTruth.test.ts
 M app/lib/phase13bAuthorityReconciliation.test.ts
 M app/lib/phase13bEnforcementHardening.test.ts
 M app/lib/phase13cAccessPolicy.test.ts
 M app/lib/phase13fCustodyRecovery.test.ts
 M app/lib/phase13gTeamUi.test.ts
 M app/lib/phase13hAccessLaunch.test.ts
 M app/lib/workspaceSearch.test.ts
 M app/tools/roofing/FieldDiveAppShell.tsx
 M app/tools/roofing/RoofingClient.tsx
 M app/tools/roofing/fieldDiveNavConfig.ts
 M app/tools/roofing/jobCard/JobCardClient.tsx
 M app/tools/roofing/jobCard/JobCardFieldBrief.tsx
 M app/tools/roofing/jobCard/JobCardProductionLeadControl.tsx
 M app/tools/roofing/jobCard/JobCardSecondaryPanels.tsx
 M app/tools/roofing/jobCard/JobCardTasksWorkspace.tsx
 M app/tools/roofing/jobCard/useCompanyMembers.ts
 M app/tools/roofing/saved/SavedClient.tsx
 M app/tools/roofing/saved/components/JobsBoardCard.tsx
 M app/tools/roofing/saved/components/JobsBoardListView.tsx
 M app/tools/roofing/useViewerNavAccess.ts
 M app/tools/settings/CompanySettingsClient.tsx
 D app/tools/settings/CompanySettingsTeamEditor.tsx
?? app/lib/phase13cSlice1Access.test.ts
?? app/lib/phase13cTeamSurface.test.ts
?? app/lib/teamSurfaceSource.testSupport.ts
?? app/tools/settings/team/
?? app/tools/team/
?? docs/phase13c-crew-product-contract-repo-reconciliation.md
?? docs/phase13c-crew-visual-operational-synthesis-astra-research.md
?? docs/phase13c-first-time-activation-astra-research.md
?? docs/phase13c-team-astra-implementation-handoff.md
?? supabase/migrations/20260929120000_phase13c_s1_access_vocabulary_completion_split.sql
```

### Tracked diff summary (entire worktree, not this pass alone)

```text
 app/api/jobs/complete-work/route.ts                |    2 +-
 app/api/jobs/start-work/route.ts                   |    3 +
 app/lib/access/registry.ts                         |   23 +-
 app/lib/access/registrySql.ts                      |  154 ++-
 app/lib/access/teamAccessPresentation.ts           |  177 +++-
 app/lib/access/viewerAccess.ts                     |   16 +
 app/lib/boardGuardedMovement.test.ts               |   40 +
 app/lib/boardGuardedMovement.ts                    |   28 +
 app/lib/companyMemberValidation.ts                 |   33 +-
 app/lib/companyMembershipRoles.ts                  |    4 +-
 app/lib/companySettingsExperience.test.ts          |   22 +-
 app/lib/invitations/invitationModel.ts             |   29 +-
 app/lib/jobActivityChronology.ts                   |    6 +-
 app/lib/jobCardOverviewComposition.ts              |    2 +-
 app/lib/jobLifecycleActionEligibility.ts           |   20 +
 app/lib/jobScheduleStageCoherence.test.ts          |    3 +
 app/lib/jobTaskPersistence.ts                      |    3 +-
 app/lib/phase125PaidUiTruth.test.ts                |    5 +-
 app/lib/phase13bAuthorityReconciliation.test.ts    |    5 +-
 app/lib/phase13bEnforcementHardening.test.ts       |    3 +-
 app/lib/phase13cAccessPolicy.test.ts               |   23 +-
 app/lib/phase13fCustodyRecovery.test.ts            |    3 +-
 app/lib/phase13gTeamUi.test.ts                     |   11 +-
 app/lib/phase13hAccessLaunch.test.ts               |   11 +-
 app/lib/workspaceSearch.test.ts                    |    2 +-
 app/tools/roofing/FieldDiveAppShell.tsx            |    1 +
 app/tools/roofing/RoofingClient.tsx                |   17 +-
 app/tools/roofing/fieldDiveNavConfig.ts            |    8 +
 app/tools/roofing/jobCard/JobCardClient.tsx        |   51 +-
 app/tools/roofing/jobCard/JobCardFieldBrief.tsx    |    4 +-
 .../jobCard/JobCardProductionLeadControl.tsx       |    8 +-
 .../roofing/jobCard/JobCardSecondaryPanels.tsx     |    4 +-
 .../roofing/jobCard/JobCardTasksWorkspace.tsx      |    6 +-
 app/tools/roofing/jobCard/useCompanyMembers.ts     |   25 +
 app/tools/roofing/saved/SavedClient.tsx            |   36 +-
 .../roofing/saved/components/JobsBoardCard.tsx     |    2 +-
 .../roofing/saved/components/JobsBoardListView.tsx |    4 +-
 app/tools/roofing/useViewerNavAccess.ts            |    3 +
 app/tools/settings/CompanySettingsClient.tsx       |   34 +-
 app/tools/settings/CompanySettingsTeamEditor.tsx   | 1106 --------------------
 40 files changed, 649 insertions(+), 1288 deletions(-)
```

## 2026-09-30 accepted Team truth correction

- **Code checkpoint:** `f3331735c01263e3f1f7d55cc7b200b788db507c`, `fix(phase13c): align team board with crew truth`. It sits on the accepted Team/access foundation `8836af9`. Local only; not pushed; no deploy.
- **Status:** Team truth correction is **COMPLETE**. It was a truth correction, not a Team redesign.
- **Files:** `app/lib/team/teamBoardModel.ts`, `app/tools/team/TeamBoardClient.tsx`, `app/lib/phase13cTeamBoard.test.ts`.

### Correction summary

- A Crew without a usual Lead is a valid, complete Crew and renders as a normal Crew card. The "Needs a Lead" deficiency, the fake missing-person placeholder and the required-Lead call to action are removed. The usual Lead is optional and is chosen or changed through the Crew's ⋯ menu.
- The normal Team board no longer presents access profiles (Owner, Office Manager, Production Coordinator, Lead, Sales, Field) as occupational titles. A Lead's subline shows facts only, such as "2 crews".
- The access-derived "Office & coordination" grouping is removed. Everyone not on a Crew appears under **"Not on a crew"**.
- The filters are **All crews / Leads / Not on a crew / Invited**. Leads derives from the actual usual-Crew-Lead relationship. "Coordinators" is removed.
- Ordering is neutral and name-based, not access-ranked. The Crew Lead picker is alphabetical.
- The subtitle is "Your people and crews." Adding a person says "{name} added to your team." without implying they should join a Crew.
- Software access appears only in real access contexts: the person sheet's "Signs in as …" fact and the Invited panel.
- The Coordinator weekly row is unchanged.

### Backend

Unchanged. The existing model already supports a nullable usual Lead, a name-only Crew, Crew identity independent of its Lead, many-to-many dated membership, a Person without a login or a Crew, and access removal without deleting Person or Crew history. No schema, RPC, access or auth change.

### Tests

- `phase13cTeamBoard`: **54 / 54** pass.
- Broader Team / access regression set: **228 / 228** pass.
- Full suite: 4639 tests, 4614 pass, **25 fail**. These match the prior 9/29 baseline, including the `jobSchedules045` expectation and stale `.next/types` debt, with no Team regression. The repo is **not** green.

### Visual proof (STAGING-backed localhost, not production)

- **Folder:** `tmp/fielddive-ui-review/phase13c-team-truth-correction/`, which holds 9 screenshots: desktop 1440 and mobile 390, with `scrollWidth` ≤ 390.
- **Leaderless proof:** the seeded Gutter Crew was set to "No usual Lead" through the normal staging UI and rendered as a complete Crew on desktop and mobile. Its original usual Lead, Carlos Rivera, was then restored and verified.
- The access context stayed intact, and a Person with no login stayed valid.
- Checks A–G and the interaction checks passed, with no console errors.

### Usual Lead and membership independence

- The usual Crew Lead and Crew membership are independent relationships.
- Setting a Lead does not create membership, and adding a member does not make them Lead; a Person may be both.
- A Lead who is not a member is not counted. A Lead who is also a member counts, for example "3 people, including Mike", and is shown once, above the roster.
- Future Job → Crew roster snapshots must record actual active membership separately from the usual Lead and the Assignment Lead.

### Current Team truths

- Team is a first-class operational People + Crews workspace. It is not an org chart, an HR surface, a permission directory, or a software-user hierarchy.
- PERSON ≠ SOFTWARE USER, and Crew membership ≠ software access.
- A Crew with only a name is valid. A Crew may have no Lead, no Coordinator and no software users.
- A Person may have no login, lead several Crews, and belong to several Crews.
- A job title, the usual Lead and Crew membership are not authority. A Crew relationship grants no software authority.

### Superseded earlier wording

The following statements are historical and superseded; they are not current truth:

- "Needs a Lead" as a Crew deficiency;
- access-derived occupational labels on the Team board;
- placing the Crew mainly below a person anchor;
- "Office & coordination" as the current grouping.

The earlier text is kept above as history.

### Next dependency

**DURABLE JOB → CREW ASSIGNMENT FOUNDATION** is next. It is **not** started or implemented. First-time activation/onboarding remains open Phase 13C work, and production rollout remains open. See `docs/fielddive-global-handoff.md`.
