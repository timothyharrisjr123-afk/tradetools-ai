# Phase 12.5 — Cursor Paid-UI + Cohesion Audit (audit record)

**Status:** audit record only. No product code was changed by this audit.
**Audit date:** 2026-09-24 (afternoon, UTC-5).
**Repo checkpoint at audit time:** HEAD `d13864a feat(closeout): add Astra G11 customer project record` (on `391586c`, `f59d1ae`). Worktree clean except untracked `.next/` and `tmp/`.
**Auditor:** Cursor agent (same session that implemented Phase 12).
**Screenshots:** `tmp/fielddive-ui-review/phase12-5-paid-ui-audit/` (41 PNGs; untracked `tmp/`).
**Original verdict:** `PHASE 12.5 AUDIT COMPLETE — READY FOR IMPLEMENTATION REVIEW`

## How this record was produced (read first)

- This file was written **after** the audit, from the same Cursor session's working context: the plan delivered to the user (sections A–S of the original reply), the observations made while inspecting each screenshot, the code inspections performed, and the screenshot directory. No replacement audit was run.
- The original deliverable was a chat reply structured **A–S** (Repo checkpoint → Verdict). This file re-expresses that content in the **A–AI** structure requested for Astra reconciliation. Where the requested structure asks for something the original audit did not cover, this file says so explicitly (`NOT INSPECTED IN ORIGINAL AUDIT` or `NOT RECOVERABLE FROM CURRENT CURSOR AUDIT RECORD`).
- The original audit used its own tags, not the Astra taxonomy:
  - **A — FIX NOW**
  - **B — PHASE 12.5 SYSTEMIC FIX**
  - **C — LOCAL FIX**
  - **D — DEFER**
  These tags are preserved verbatim below. Astra classification (ASTRA-EXPLICIT / ASTRA-ALIGNED / NEW DIRECTION) was **not** applied in the original audit because the governing prompt stated Phase 12.5 is not Astra-defined and Astra must not be used as the phase authority (see AF).
- Nothing Astra discovered after this audit has been added here.

---

## A. AUDIT SCOPE

### A.1 Method

- Code inspection first (shared styles/components/tokens, button/radius/type pattern counts), then the visible Playwright browser against authenticated `http://localhost:3000` (production data via `.env.local`; read-only browsing).
- Desktop viewport **1440×1000** (`window.innerWidth` 1440). Mobile viewport **390×844** (`window.innerWidth` 390).
- The user's dev server was not started, stopped, or restarted.
- The audit browser session was the Playwright MCP browser (not the user's personal browser window).

### A.2 Code inspected

- `app/globals.css`, `app/layout.tsx`
- `app/tools/roofing/FieldDiveAppShell.tsx`
- `app/components/**` (inventory — only `ui/FocusedEditor.tsx` is shared UI)
- `app/tools/settings/settingsConstants.ts`
- `app/tools/roofing/catalog/catalogConstants.ts`
- `app/tools/roofing/templates/templatesConstants.ts`
- Grep inventory of local `PRIMARY_BUTTON` / `*_BUTTON_CLASS` constants:
  - `JobCardNextActionPanel.tsx`
  - `JobCardForwardLifecycleAction.tsx`
  - `jobCardProposalsTabModel.ts`
  - `settingsConstants.ts`
  - `app/admin/catalog/catalogAdminConstants.ts`
- `app/tools/roofing/saved/SavedClient.tsx` (loading/amber regions, ~lines 4160–4280)
- `app/lib/jobScheduleStageCoherence.ts` (`boardScheduleLoadBanner`, `resolvePlannedScheduleCoherence`, `plannedScheduleIntegrityLabel`)
- `app/lib/packetIdentityEntry.ts` (`resolvePacketIntakeTitle`)
- `app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx`
- `app/lib/proposalCustomerPreviewViewModel.ts` (cover-only preview investigation)
- `app/components/proposal-packet/ProposalPacketCompanyMark.tsx`, monogram helpers (logo "FD" investigation)
- `app/tools/roofing/jobCard/jobCardTypes.ts` (tab ids)

### A.3 Pattern counts captured (app/, excluding dev-harness/admin/tests)

| Pattern | Uses | Files |
|---|---|---|
| `bg-slate-900` | 73 | 49 |
| `bg-slate-950` | 8 | 5 |
| `bg-blue-600` | 32 | 22 |
| `bg-blue-700` | 23 | 16 |
| `bg-cyan-*` | 66 | 11 |
| `bg-emerald-600` | 8 | 3 |
| `bg-[#hex]` arbitrary | 63 | 20 |
| `bg-red-600` | 1 | 1 |
| `rounded-md` | 343 | 88 |
| `rounded-lg` | 237 | 84 |
| `rounded-xl` | 150 | 43 |
| `rounded-2xl` | 66 | 17 |
| `rounded-full` | 277 | 49 |
| `text-[10px]` | 187 | 32 |
| `text-[11px]` | 289 | 71 |
| `focus:ring-cyan` | 6 | 4 |
| `focus:ring-blue` | 20 | 9 |
| `focus-visible:ring` | 97 | 20 |
| `animate-pulse` | 6 | 4 |
| `animate-spin` | 5 | 3 |

Loading-copy inventory (grep of `>Loading…<` text nodes in `.tsx`): about 16 distinct ad-hoc strings. Examples: "Loading…" ×5, "Loading jobs…" ×2, "Loading team…", "Loading scheduled work…", "Loading preview…", "Loading scope changes…", "Loading catalog items…", "Loading scope change…", "Loading measurements", "Loading payment details…", "Loading tasks…".

`SETTINGS_ALERT_LOAD` (amber) exists in `settingsConstants.ts` and has **zero** usages.

### A.4 Routes / screens / states inspected

**Desktop 1440 (screenshots inspected):**
- **Jobs Board**
  - "Loading jobs…" state: captured, **not visually inspected** (`loading/01`).
  - Amber "Loading planned schedules…" state: inspected.
  - Settled board: inspected.
- **Jobs Board List view**
  - Full-page capture: too tall to judge.
  - Viewport capture: inspected; it was taken while the amber banner was still showing.
- **Job Card, job A** `[R3G-046-VISUAL] Clean Approved` (`c34d3539-…`, approved, 1 authorized change, open $450 progress request): Overview, Tasks, Calendar, Measurements, Proposals, Payments, Photos.
- **Job Card, job G5A** `G5 Proof Customer A` (`0ed5c74f-…`, Proposal stage, sent proposal): Proposals tab.
- **Company Calendar** (`/tools/roofing/calendar`, September 2026, empty month).
- **New Job** (`/tools/roofing?entry=packet`).
- **Company settings** (`/tools/settings`).
- **Payments slide-over** (`/tools/settings/payments`, rendered as a panel over Company settings).
- **Pricing rules** (`/tools/settings/pricing`).
- **Catalog** (`/tools/roofing/catalog`).
- **Templates** (`/tools/roofing/templates`).
- **Proposal Builder** for the G5A sent proposal: opened read-only, no edits.
- **Contractor Preview**
  - Accepted sent-record for job A: cover only.
  - Signed sent-record for job B `R3E-044-SMOKE signed` (`c1d157bf-…`): cover only.
  - Sent-record for G5A: full document.

**True 390 (`innerWidth` 390):**

| Screen | `scrollWidth` | Inspected |
|---|---|---|
| Jobs Board | 375 | yes |
| Job Card A Overview (early) | 375 | yes |
| Job Card A Overview (settled) | — | yes |
| Job Card A Payments | 375 | yes |
| Job Card A Proposals | 375 | yes |
| Job Card B Overview (complete job) | 375 | yes |
| Navigation sheet (opened over Job Card) | — | yes |
| New Job | — | yes |
| Company Calendar | — | yes |
| Pricing rules | — | yes |
| Catalog | 375 | yes |
| Templates | 375 | yes |
| Login | 390 | not inspected (desktop login was) |
| Job Card "More" sheet (`mobile/06`) | — | **not inspected**; the file size equals the settled Overview, so the sheet probably did not open |
| Company settings (`mobile/10`) | — | **not inspected** |
| Builder (`mobile/14`) | — | **not inspected** (the capture script timed out around the builder step) |

`scrollWidth` 375 is the page width minus the scrollbar. No horizontal page overflow was measured on any captured contractor route.

**Customer / public (evidence reused, not recaptured in this audit):**
- `/p/[token]` project-record states from Phase 12, same code at `d13864a`: `tmp/fielddive-ui-review/phase12-customer-project-record/` (A desktop inspected in this audit; B/D inspected earlier the same day during Phase 12 closure).
- `/p` pre-Phase-12 current-contract view: `tmp/fielddive-ui-review/phase11-collection-communication/final-correction/02-desktop-public-current-contract.png` (inspected).
- Scope-change customer review: `tmp/fielddive-ui-review/phase10-approved-scope-changes/04-desktop-customer-review.png` (inspected). This is a **harness** capture ("4 · CUSTOMER REVIEW" eyebrow), not the live `/scope-changes/[token]` route.
- Login: signed-out anonymous context, desktop + 390 (`customer/login-*.png`).

**Loading / error / empty states reviewed:**
- Loading: Jobs Board (jobs and schedules), Job Card Overview early render at 390, Company Calendar at 390.
- Empty: Tasks, Measurements, Photos, Company Calendar desktop (empty month).
- Error: **no live error state was captured**. Error-state findings come from code only: `JobsBoardErrorState` is amber, and `boardScheduleLoadBanner` error copy shares the amber box.

### A.5 Not inspected in the original audit

- **Team editor** (Company settings → Team → Manage): not opened.
- **Business / Branding / Preferences** editors: not opened (only the summary rows on Company settings).
- **Job Card "More job actions"** menu/sheet: not opened.
- **Disposition / recovery states** (Lost, On hold) on the Job Card: not captured in this audit. They were captured on `/p` in Phase 12.
- **Job Card Payments** at desktop for a complete job, and refund states on the Job Card: not captured (job A only).
- **Closeout block on Job Card:**
  - Not recaptured desktop in this audit.
  - The Phase 12 closure captures (`phase12-customer-project-record/G-jobcard-closeout-*.png`) were inspected earlier the same day.
  - At 390, job B Overview was captured but the closeout block was below the fold.
- **Contractor Preview at 390**: not captured.
- **Builder at 390**: captured, not inspected.
- **Live scope-change customer route** `/scope-changes/[token]`: not opened. The Phase 10 harness capture was used.
- **Settings "Checking…" loading state**: not observed. `NOT RECOVERABLE FROM CURRENT CURSOR AUDIT RECORD` whether such a state exists or how it looks.
- **Modals** (Accept/Sign modals, board movement confirm dialog, Create Proposal modal, task editor): not opened.
- **Proposal PDF** output: not reviewed.
- **Email templates** (proposal / payment request): not reviewed.
- **Dark estimate lanes** in `SavedClient` (`statusFilter !== "all"`): not rendered. Code-only observation of amber-heavy dark styles.
- **Homepage / marketing `/`**: out of scope; only noted as a risk for the root-background change.

---

## B. EXECUTIVE VERDICT

**Current whole-product paid-UI condition:** functionally coherent and mostly calm (light slate canvas, consistent sidebar, consistent Job Card tab shell), but visibly **assembled page-by-page**. There is no shared button, badge, notice, loading or empty-state layer, so each surface invented its own. The product does not yet read as one operating system: equivalent actions change color between tabs, loading looks like a warning, and first-use copy leaks into repeat use.

**Systemic vs local:**
- Most findings are **systemic**: button families, loading semantics, banners for normal states, typography (Arial, tiny type), and framing inconsistency.
- A smaller set is **local**: Overview action row, Activity rail clipping, Calendar tab control order, Payments slide-over shape, Catalog deactivate styling, Templates stray label, builder "Draft" label, unit formatting, login polish.

**Feels cohesive as one operating system?** Not yet. The biggest cohesion breaks are:
1. **Black vs blue vs teal** primaries for equivalent actions, sometimes on the same Job Card.
2. **Loading shown as warning or as a false negative fact:**
   - the amber board banner
   - "Planned schedule status unavailable; lifecycle actions are blocked." on every approved/scheduled card during load
   - "No authorized scope on file" during load
3. **Three different empty-state patterns** inside one Job Card.
4. **Banners for normal states** (the Catalog success banner).
5. **Arial font** everywhere (Geist referenced but never loaded).

**Strongest paid-product blockers:**
1. Loading presented as failure or as a negative fact (Jobs Board, Job Card).
2. Primary action color inconsistency.
3. "Start my first job" shown to an established company.
4. Catalog table broken at 390.
5. The sticky Schedule bar rendering over the open navigation sheet at 390.
6. `/p` keeping pre-acceptance framing after acceptance, with the package price competing with the current contract total.
7. Arial plus pervasive 10–11px type.

**P0/P1 correctness / tenancy / money / lifecycle / customer-trust defects:** **none found.**

Three **product-truth presentation defects** (explicitly not P0/P1) were found and placed in Fix Now:
- loading shown as blocked/unavailable (Jobs Board)
- loading shown as an empty fact (Job Card Overview)
- first-job copy shown on repeat use (New Job)

---

## C. SHARED UI / SYSTEM FINDINGS

Severity uses the original tags (A fix now / B systemic / C local / D defer).

### C.1 Shared Button absence / inconsistency — **B** (the black-vs-blue collisions are also listed as **A**)

- **Evidence:**
  - No shared Button component. Private primary constants differ per file:
    - `JobCardNextActionPanel` (`rounded-md`, slate-900, `min-h-11`)
    - `JobCardForwardLifecycleAction` (`rounded-lg`, slate-900, `min-h-[44px]`, full-width mobile)
    - `jobCardProposalsTabModel.JOB_CARD_PROPOSALS_PRIMARY_BUTTON_CLASS` (blue-600, `border-blue-300`)
    - `SETTINGS_PRIMARY_BUTTON` (slate-900)
    - `catalogAdminConstants.PRIMARY_BUTTON`
  - Counts: slate-900 73/49 files, blue-600/700 55 uses, cyan 66/11 files.
- **Affected surfaces:**
  - Job Card: Overview "Schedule" is black; Proposals "View accepted proposal" and "Propose scope change" are blue.
  - Templates "+ Template": blue.
  - Board "+ New job": black.
  - Board "Start work": teal.
  - Board "Schedule job": outline.
  - Pricing "Save pricing rules": light blue at reduced opacity.
  - Builder "Customer review": blue.
  - Catalog: two dark primaries.
  - Company Calendar mobile "Schedule": teal text.
- **Proposed correction:** five families — Primary (slate-900), Secondary (white + slate-200 border), Quiet (text), Destructive (red text/outline; solid only in confirm), Link (blue text, navigation only). One primary per surface.
- **Shared primitive justified:** yes (repeated evidence across ≥8 files).

### C.2 Badge / status inconsistency — **B**

- **Evidence:**
  - Catalog and Templates each define an identical `catalogReadinessStatusPillClass`.
  - Stage chips, the "Premium"/"Current" markers, the "Preferred" chip (green), "Visible"/"Active" catalog chips, and scope-change status as plain bold text ("Voided", "Authorized") are each styled locally.
- **Affected:** Catalog, Templates, Job Card header status, Proposals tab, scope-change history, board cards.
- **Correction:** `StatusBadge` with tones neutral / info / success / warning / error.
- **Shared primitive justified:** yes.

### C.3 Notice / banner inconsistency — **B**

- **Evidence:**
  - Separate banner constant sets per module: `SETTINGS_GUIDANCE_*`, `SETTINGS_ALERT_*`, `CATALOG_MESSAGE_BANNER`, `CATALOG_ERROR_BANNER`, `TEMPLATES_*_BANNER`.
  - The board amber schedule banner.
  - The Catalog permanent green "Catalog ready for templates" banner (success banner for a normal state).
  - `SETTINGS_ALERT_LOAD` is amber and unused.
- **Affected:** Catalog, Templates, Settings, Jobs Board.
- **Correction:** `InlineNotice` for exceptional conditions only (warning / error / info). Success becomes inline text, not a banner.
- **Shared primitive justified:** yes.

### C.4 Loading-state inconsistency — **B** (specific false states **A**)

- **Evidence:** about 16 ad-hoc loading strings; the amber board banner; per-day "Loading schedules…" on Calendar at 390; false negative facts during load (see D).
- **Correction:** `LoadingState` (skeleton + single inline indicator); never render negative facts before reads are authoritative.
- **Shared primitive justified:** yes.

### C.5 Empty-state inconsistency — **B**

- **Evidence:** within one Job Card:
  - Tasks: left-aligned "No tasks yet" + helper, button top-right.
  - Measurements: inline "No measurement yet" + button right, no helper.
  - Photos: centered framed box, "No photos yet" + redundant "No photos or files yet" + button inside the frame.
  - Company Calendar: empty month with no empty line.
- **Correction:** `EmptyState` (title, one helper line, optional action, no frame by default).
- **Shared primitive justified:** yes.

### C.6 Section header hierarchy — **B / C**

- **Evidence:** each Job Card tab repeats its own name as an H2 directly under the active tab ("Overview" under Overview, "Proposals" under Proposals, etc.). The action is sometimes top-right (Tasks "Add task"), sometimes inline (Measurements), sometimes floating alone (Overview "Schedule").
- **Correction:** `SectionHeader` (title + optional right action); remove redundant tab-name headings.
- **Shared primitive justified:** yes.

### C.7 Money / stat presentation — **B**

- **Evidence:**
  - Job Card Payments stat row on desktop (Contract total / Collected / Remaining / Refunded) is fine.
  - At 390 the four stats stack into four tall rows.
  - Money label/value styles differ between Job Card Payments, the Phase 12 closeout rows, and `/p` project record rows.
- **Correction:** `StatGrid` / `MoneyRow` (one label/value treatment, tabular figures, 2×2 on mobile). **Display only; no money math change.**
- **Shared primitive justified:** yes.

### C.8 Form / input styles — **B**

- **Evidence:**
  - New Job uses placeholder-only fields (no visible labels).
  - `SETTINGS_INPUT` uses a cyan focus ring while other surfaces use blue (`focus:ring-cyan` 6 uses vs `focus:ring-blue` 20).
  - Native selects and date inputs appear unstyled (Pricing "Profitability type", Job Card Calendar date fields).
- **Correction:** shared form classes: visible labels, one blue focus ring; native controls aligned in border/radius/focus only.
- **Shared primitive justified:** yes (class module; not a component framework).

### C.9 Typography — **B**

- **Evidence:**
  - `globals.css` `body { font-family: Arial, Helvetica, sans-serif }` overrides the Geist variable, and Geist is never loaded in `layout.tsx`.
  - `text-[10px]` 187 uses, `text-[11px]` 289 uses.
- **Correction:** load Geist via `next/font`; remove the Arial override. Scale:
  - page title 24px semibold
  - section title 16px semibold
  - eyebrow 11px uppercase tracked (10px removed)
  - body 14px
  - metadata 12px
  - money in tabular figures

### C.10 Colors — **B**

- **Evidence:**
  - amber used for loading
  - amber used for a load failure (`JobsBoardErrorState`)
  - red and rose used interchangeably
  - green used for "1 day in stage" (freshness)
  - teal/cyan as a third action color
  - disabled shown three different ways (slate fill, opacity, dark grey)
- **Correction:** see Z.

### C.11 Page widths — **C**

- **Evidence:** Company settings and Pricing use a narrow centered column; Jobs, Calendar, Catalog and Templates are full width.
- **Assessment:** the narrow column was judged **acceptable** as a "form page" width.
- **Correction:** formalize two width families: full-width workspace and form width.

### C.12 Gutters — **C**

- **Evidence:** at 390 the Job Card is a bordered card inside the shell's `p-4` gutter, costing about 30px per side.
- **Correction:** edge-to-edge Job Card below 640px.

### C.13 Card / surface nesting — **B**

- **Evidence:**
  - Board header framed in a card, while Catalog, Templates, Settings and Calendar headers are unframed.
  - New Job header framed in its own card.
  - Templates "Included work" nests three levels (section → group box → item boxes).
  - Photos empty state framed inside the tab panel.
- **Correction:** page headers unframed on the canvas; no box deeper than two levels.

### C.14 Responsive patterns — **B / C**

- **Evidence:**
  - Good: sticky bottom lifecycle CTA on the Job Card at 390; Job Card 4-slot mobile tab rail (Overview / Tasks / Photos / More).
  - Bad: Catalog table not transformed at 390; Company Calendar transforms to day cards but repeats loading per card and shows ISO dates.
- **Correction:** Catalog stacked rows below 640; Calendar single loader and friendly dates.

### C.15 Shell / header behavior — **B**

- **Evidence:**
  - Desktop: the 56px `<header>` in `FieldDiveAppShell` renders an empty white strip (the menu button is `lg:hidden` and the right cluster is `lg:hidden`).
  - Mobile: the header shows only the menu and "Sign out".
  - The root layout `body` has `bg-[#070A12] text-white`, and a `prefers-color-scheme: dark` block exists.
  - The Job Card renders a nested `<main>` inside the shell's `<main>`, found when a Playwright `locator('main')` resolved to two elements.
- **Correction:** hide the desktop header strip; move Sign out into the navigation sheet footer; remove the nested `<main>`; move the dark root background to the marketing page only after verifying `/`.

### C.16 Mobile behavior — see X.

---

## D. LOADING / ASYNC TRUTH FINDINGS

1. **Yellow/amber loading semantics (Jobs Board)** — **A**
   - `SavedClient.tsx` renders `boardScheduleLoadBanner(r3fSchedulesLoadStatus)` in `rounded-md border border-amber-200 bg-amber-50 … text-amber-900`.
   - For status `loading` the copy is "Loading planned schedules…".
   - For `error` the copy is "Could not load planned schedules. Schedule actions are blocked until refresh succeeds." in the **same** amber box.
   - Seen in: `loading/02-jobs-board-amber-schedule-loading.png`, `desktop/board-list-viewport.png`, `mobile/01-board.png`.
   - The banner appeared about 2.9s after navigation and disappeared about 0.3s later (polling at 100ms). On slower loads it persisted longer; it was still visible in the List and mobile captures.
2. **False negative facts during schedule load (Jobs Board cards)** — **A**
   - Every Approved/Scheduled card shows **"Planned schedule status unavailable; lifecycle actions are blocked."** in red-orange text while schedules load.
   - Cause: `resolvePlannedScheduleCoherence` returns `unknown` when the read is not authoritative (loading or error), and `plannedScheduleIntegrityLabel('unknown')` returns the failure copy.
   - The action-blocking behavior is **correct** and must stay. Only the label/presentation is wrong.
   - Seen in `loading/02-…png` (settled comparison: `loading/03-jobs-board-loaded.png`, where cards show "Schedule job" / "Start work").
3. **"Loading jobs…"** — the board shows plain centered slate text "Loading jobs…" before the core read. Captured at `loading/01-jobs-board-loading-jobs.png` but **not visually inspected**. Judged from code as neutral but not designed; it would become the `LoadingState` skeleton.
4. **List view during load** — the Action column shows "—" for every row while schedules load. Same root cause as item 2. Seen in `desktop/board-list-viewport.png`.
5. **Job Card false empty fact** — **A**
   - At 390, job A Overview showed **"No authorized scope on file"** during the first render.
   - After settling it showed "Accepted · Ridge vent upgrade" (the desktop capture showed the settled value).
   - The sticky "Schedule" CTA also appeared only after load.
   - Evidence: `mobile/02-jobcard-A-overview.png` (early) vs `mobile/02b-jobcard-A-overview-settled.png`.
   - An initial automated sampling attempt was invalid because of the nested `<main>` strict-mode error; the settled state was confirmed by a follow-up read.
6. **Company Calendar repeated loading cards (390)** — **A**
   - Every day card shows "Loading schedules…" (about 30 repeats), plus a page-level "Loading schedules…".
   - Evidence: `mobile/09-calendar.png` (a Next.js dev "Compiling" badge is visible and is not product UI).
7. **Settings "Checking…"** — **NOT RECOVERABLE FROM CURRENT CURSOR AUDIT RECORD.** Not observed; no finding was made.
8. **Skeletons vs text loaders**
   - Finding: there is no skeleton pattern anywhere in the inspected product. `animate-pulse` has 6 uses in 4 files, but no designed skeleton was observed.
   - Proposal: skeletons for structural regions; one inline neutral indicator for secondary reads.
9. **Normal loading vs warning/error semantics**
   - Load failure on the board uses amber (`JobsBoardErrorState`, `border-amber-200 bg-amber-50`) and should be **red**.
   - `BoardMovementConfirmDialog` uses `role="alert"` with amber text. Recorded from code; classification was not refined further in the original audit.
10. **Contractor Preview loading** — "Loading preview…" is plain text (code only).

---

## E. JOB BOARD FINDINGS (Board + List)

**Evidence:** `loading/02`, `loading/03`, `desktop/board-list.png`, `desktop/board-list-viewport.png`, `mobile/01-board.png`.

**Hierarchy**
- Page header framed in a card (title, subtitle, search, Board/List toggle, "Filters & sort", dark "+ New job") — **C** (unframed headers elsewhere).
- Overall board hierarchy (stage columns with group eyebrows, counts, cards) was judged sound.
- A column-eyebrow inconsistency was noticed (the "Approved" column showed no group eyebrow while Intake / Proposal / Scheduled did) but **not confirmed**; it may be a spanning group label. Not included as a finding in the final plan.

**Density:** cards are readable at desktop. No density finding was made beyond the framing and loading issues.

**Table / list behavior**
- List (desktop): columns Customer, Address, Action, Updated, Owner, Stage. Address truncates with an ellipsis (acceptable).
- Action "—" during load (see D.4).
- The full list capture showed the list is very long (100+ rows, including many test/smoke fixtures). No pagination or virtualization finding was raised except as **D** (virtualization / density modes deferred).

**Card behavior**
- Equivalent next actions use different styles: "Schedule job" (white outline) vs "Start work" (solid teal) — **B**.
- Age indicator: green "1 day in stage" (success color for freshness) should be neutral; orange for aging is acceptable — **C**.

**Warning placement:**
- The amber loading banner sits between the header and the columns — **A**.
- The per-card false blocked label — **A**.

**Planned schedule loading:** see D.1–D.2.

**Action hierarchy:** "+ New job" dark primary (consistent with the Primary family); "Filters & sort" secondary; the Board/List segmented control is fine.

**Owner / stage presentation:**
- List "Owner" shows "Unassigned" / "Team member", and Stage is plain text.
- No specific finding beyond the StatusBadge systemic item.

**Long-board usability:** not assessed beyond the virtualization/density deferral.

**Mobile (390):**
- Header card with search, Board/List, Filters & sort, "+ New job" is large.
- The amber loading banner is present.
- Columns stack vertically. No overflow (`scrollWidth` 375).

**Legacy dark estimate lane** (`statusFilter !== "all"` in `SavedClient.tsx`: amber-heavy dark styles such as `text-amber-200`, `bg-amber-500/15`) — code only, **D** (delete with estimateStore cutover debt, not restyle).

---

## F. JOB CARD — GLOBAL SHELL

**Evidence:** `desktop/jobcard-A-01…07`, `desktop/jobcard-G5A-proposals-sent.png`, `mobile/02*`, `03`, `04`, `05`, `07`.

- **Header:** "← Back to Jobs", H1 job name, address with a "Change" link, email line, status chip ("Approved"/"Complete") and "More job actions" at the right. No specific header finding was made beyond the mobile items below.
- **Status:** the stage chip is a slate pill. At 390 an "Active" disposition value was present in the text stream. No finding.
- **More job actions:** **NOT INSPECTED IN ORIGINAL AUDIT** (not opened).
- **Desktop width:** the Job Card sits in a single white card with the Activity rail on the right. No width finding.
- **Activity rail** — **C**: fixed height, clips mid-entry (e.g. "Delta -$20,000.00" cut off) with no fade and no "Show all". Job A's rail was dominated by voided/proposed/drafted scope-change entries (test data). Rail content was judged truthful chronology and not altered.
- **Tab system:**
  - Desktop tabs: Overview, Tasks, Calendar, Measurements, Proposals, Payments, Photos (underline active state). Consistent.
  - Each tab repeats its name as an H2 under the tab bar — **C / B** (SectionHeader).
- **Mobile tab rail / More:** the 4-slot rail (Overview / Tasks / Photos / More) was observed, and Payments and Proposals map under "More" (active "More" underline). The **More sheet itself was not verified** (`mobile/06` likely did not open it).
- **Lifecycle CTA:**
  - Desktop: "Schedule" is a dark button floating alone at the right of the Overview, separated from "Directions" (own row) with dead space — **C**.
  - Mobile: a sticky bottom bar "Schedule" (good pattern; appears after load).
- **Sticky CTA:** renders **above the open navigation sheet** at 390 (the sheet is `z-50`, and the sticky bar remains visible on top) — **A**. Evidence: `mobile/07-nav-sheet.png`.
- **Dead space:** Overview white gap above "Directions" on mobile, where the primary action slot is empty during load, and the floating Schedule on desktop.
- **Hierarchy problems:** black vs blue primaries across tabs (C.1); three empty-state patterns (C.5).
- **Duplicated / redundant information:** repeated tab-name headings; Photos empty state duplicate lines.
- **Responsive behavior:**
  - At 390 the card sits inside the gutter (double gutter) — **C**.
  - The email wraps mid-word "…example.co / m" — **C**.
  - Nested `<main>` landmark — **C**.

---

## G. JOB CARD — OVERVIEW

**Evidence:** `desktop/jobcard-A-01-overview.png`, `mobile/02-…`, `mobile/02b-…`, `mobile/05-jobcard-B-overview-closeout.png`.

- **Operational hierarchy:** the field brief order (When / Production lead → Authorized work → Tasks → Financial) was judged sound. The action row was not.
- **Directions:** an outlined full-width (mobile) / intrinsic (desktop) secondary button on its own row, disconnected from the primary — **C** (make one action row: primary + Directions).
- **Schedule:** the desktop dark primary floats alone at the right — **C**; the mobile sticky bar is good.
- **Production lead:** "Unassigned" with a blue "Assign" link. No finding.
- **Authorized work:** shows a **false empty fact during load** at 390 ("No authorized scope on file") — **A**. Settled: "Accepted / Ridge vent upgrade".
- **Tasks:** "No tasks yet" (grey). No separate finding beyond EmptyState.
- **Financial summary:**
  - Job A "Progress payment requested"; rows "Proposal Accepted", "Measurement No measurement".
  - Job B "Balance due".
  - No specific finding recorded.
- **Completed job behavior (B):**
  - "Aug 19 · All day", "America/Chicago", Authorized work "Signed", Financial "Balance due", "Recent activity" below.
  - No finding beyond the global ones.
  - The desktop closeout was inspected during Phase 12 closure (`phase12-customer-project-record/G-jobcard-closeout-*.png`), not recaptured here.
- **Closeout:** not re-audited in 12.5 beyond the above. **No 12.5 finding recorded.**
- **Pending scope warnings:** **NOT INSPECTED IN ORIGINAL AUDIT** (job A had no pending change at audit time).
- **Empty-state language:** covered by C.5.

---

## H. JOB CARD — TASKS

**Evidence:** `desktop/jobcard-A-02-tasks.png`.

- **Empty state:** left-aligned "No tasks yet" + "Capture the next field action when you're ready." (one of three empty patterns) — **B**.
- **Add task:** dark primary with an icon, top-right of the "Tasks" heading. Consistent with the Primary family.
- **Whitespace / density:** large empty panel below. No separate finding beyond EmptyState.
- **Responsibility presentation:** **NOT INSPECTED IN ORIGINAL AUDIT** (no tasks on job A).
- **Mobile:** **NOT INSPECTED IN ORIGINAL AUDIT** (Tasks not captured at 390).

---

## I. JOB CARD — CALENDAR

**Evidence:** `desktop/jobcard-A-03-calendar.png`.

- **Job-specific calendar:** a month grid with a "Timezone: America/Chicago" line and plain-text "Previous" / "Next". Some day numbers render in a reddish tint (not investigated).
- **Navigation hierarchy:** plain-text Previous/Next. No separate finding recorded (company Calendar uses buttons — an inconsistency implied but not explicitly listed).
- **Schedule controls** — **C**:
  - Start/End native date inputs, "All day" checkbox, "Add times" link.
  - The **"Schedule job" button sits between the date fields and the Notes field** (action before an input it depends on).
  - The **disabled button is dark grey** and reads as enabled.
- **Cancelled history:** uses the browser's native `<details>` disclosure triangle — **C**.
- **Company Calendar relationship:** a "View company Calendar" link at the bottom. No finding.
- **Desktop / mobile:** mobile **NOT INSPECTED IN ORIGINAL AUDIT**.

---

## J. JOB CARD — MEASUREMENTS

**Evidence:** `desktop/jobcard-A-04-measurements.png`.

- **Empty state:** inline "No measurement yet" with no helper text (one of three empty patterns) — **B**.
- **Add measurement:** dark primary on the right of the empty line.
- **Whitespace:** large blank panel.
- **Hierarchy:** repeated "Measurements" H2 under the tab.
- **Mobile:** **NOT INSPECTED IN ORIGINAL AUDIT**.

---

## K. JOB CARD — PROPOSALS

**Evidence:** `desktop/jobcard-A-05-proposals.png`, `desktop/jobcard-G5A-proposals-sent.png`, `mobile/04-jobcard-A-proposals.png`.

- **List / state hierarchy:**
  - Proposal row: name, "Premium" chip, "Current" marker, "Accepted" / "Sent", "Last sent …".
  - The G5A row adds a "+ Proposal" outlined button in the header and a "Revise proposal" text action.
- **Accepted / sent states:** "View accepted proposal" / "View sent proposal" are **blue solid primaries**. Viewing a record should be **secondary** — **B / A**.
- **Primary actions:** job A has **two blue primaries** in one tab ("View accepted proposal", "Propose scope change") — **A** (one primary per surface; contractor primary is slate-900).
- **Scope changes:**
  - Heading "Scope changes" + explanatory sentence + blue "Propose scope change".
  - History rows show plain bold status text ("Voided", "Authorized") + delta + title + "New total …". Status should use StatusBadge — **B**.
- **Voided history density:**
  - Job A shows three voided −$20,000 rows (test data) with "New total -$1,050.00" each.
  - Recorded as an observation (the voided proposal snapshot shows a negative new total). **Not raised as a defect**, because the rows are voided historical proofs.
  - No density fix was proposed.
- **Proposal CTA colors:** blue here vs black elsewhere — **B**.
- **Mobile:** two blue primaries stacked; mid-word email wrap in the header. No overflow.

---

## L. JOB CARD — PAYMENTS

**Evidence:** `desktop/jobcard-A-06-payments.png`, `mobile/03-jobcard-A-payments.png`.

- **Money / stat hierarchy:** desktop 4-column stat row (Contract total $18,950 / Collected $0 / Remaining $18,950 / Refunded $0) judged good.
- **Current payment:**
  - "Progress payment $450.00 Open".
  - An optional note textarea ("email only").
- **Retry / Resend:** dark "Retry email" (primary), outlined "Copy payment link" (secondary), text "Cancel request" (quiet). **Judged correct hierarchy.**
- **Copy link:** secondary. Correct.
- **Delivery attempts:**
  - "Attempt 2 · Email wasn't sent" in an amber/brown tone with the provider message.
  - Judged a **correct warning** (the request stays valid; the email failed).
- **Payment history:**
  - A long dated list (Today / Aug 27 groups) of "Progress payment requested" / "Payment request cancelled" rows, with grey dots and amounts.
  - Test-data-heavy. No finding recorded.
- **Long history / density:** no finding recorded.
- **Desktop / mobile:** at 390 the four stats stack into four tall rows — **C** (2×2 via StatGrid).
- **Financial wording:** no wording finding recorded in 12.5 (Phase 11/12 wording was accepted).

---

## M. JOB CARD — PHOTOS

**Evidence:** `desktop/jobcard-A-07-attachments.png`.

- **Empty state:**
  - A centered **framed box** containing "No photos yet" and a redundant second line "No photos or files yet" — **B** (EmptyState).
  - The frame is also a box-in-box — **B** (nesting).
- **Add / upload:** dark "+ Add" primary inside the frame.
- **Visual density:** large empty panel.
- **Mobile:** **NOT INSPECTED IN ORIGINAL AUDIT** for Photos.

---

## N. COMPANY CALENDAR

**Evidence:** `desktop/calendar.png`, `mobile/09-calendar.png`.

- **Desktop grid:**
  - Month grid with dark "Month" active, outlined "Week", "Previous", "Next".
  - September 2026 was empty.
  - **No today marker and no empty-state line** — **C**.
- **Mobile transformation:** the grid becomes a list of day cards, each with a date and a "Schedule" action.
- **Loading / repeated loading rows:** "Loading schedules…" in **every** day card plus the page header — **A** (a single loader).
- **Date labels:** raw ISO ("2026-09-01") — **C**.
- **Schedule actions:** teal text "Schedule" (a third action color) — **B**.
- **Navigation hierarchy:** Month/Week/Previous/Next as four equal-weight buttons. No separate finding recorded.

---

## O. NEW JOB

**Evidence:** `desktop/new-job.png`, `mobile/08-new-job.png`.

- **First-use vs repeat wording** — **A**:
  - The title "Start my first job" is shown to a company with 100+ jobs.
  - `resolvePacketIntakeTitle` returns `PACKET_FIRST_JOB_TITLE` unless there is a selected customer or property, "another property", or identity params. That makes it the title for sidebar "New job" and board "+ New job".
  - Proposed fix: "New job" when the company already has jobs.
- **Cards / sections:** a header card ("Start my first job" + subtitle), a Customer card (icon eyebrow), a Property card (icon eyebrow, address autocomplete, "Enter address manually" link).
- **Form hierarchy:** **placeholder-only fields** (Customer name, Email address, Phone optional, address) — **B**.
- **CTA hierarchy:** "Create job →" disabled in grey (disabled-state consistency covered by C.1).
- **Excessive boxing:** the header framed in its own card — **C**.
- **Desktop / mobile:** mobile is the same structure, no overflow.

---

## P. COMPANY SETTINGS

**Evidence:** `desktop/company-settings.png`, `desktop/payments-settings.png`. `mobile/10-company-settings.png` was captured but **not inspected**.

- **Business / Branding / Payments / Pricing / Preferences / Team:**
  - One card with row sections, each with an uppercase label, a summary value and a blue "Edit ›" / "Manage ›" link.
  - Blue links judged **semantically correct** (navigation).
- **Hierarchy:** narrow centered column judged acceptable as a "form page" width.
- **Loading states:** not observed. "Checking…" **NOT RECOVERABLE FROM CURRENT CURSOR AUDIT RECORD**.
- **Slide-over behavior (Payments)** — **C**:
  - Opens as a **short floating box in the top-right corner** (auto height) rather than a full-height sheet, with a heavy blur over the whole page.
  - Read-only content ("Stripe Connected", explanatory text) yet offers **Cancel + a grey "Done"**; it needs a single Close.
- **Team / Business / Branding / Preferences editors:** **NOT INSPECTED IN ORIGINAL AUDIT**.
- **Code:** `SETTINGS_ALERT_LOAD` (amber) unused — **C** (delete so it isn't reused).
- **Mobile:** not inspected.

---

## Q. PRICING RULES

**Evidence:** `desktop/pricing-rules.png`, `mobile/11-pricing-rules.png`.

- **Field hierarchy:**
  - Sections Pricing method / Profitability / Tax / Measurement assumptions, with labels and helper text.
  - Judged clean.
  - Native select for "Profitability type".
- **Save CTA** — **B**: "Save pricing rules" is **light blue** (blue at reduced opacity when disabled), while the Settings family primary (`SETTINGS_PRIMARY_BUTTON`) is slate-900.
- **Disabled / loading behavior:** the disabled treatment is reduced-opacity blue, inconsistent with other disabled states.
- **Mobile:** fields stack cleanly, no overflow observed.
- **Typography / density:** no separate finding beyond the global typography item.

---

## R. CATALOG

**Evidence:** `desktop/catalog.png`, `mobile/12-catalog.png`.

- **Permanent success / readiness banner** — **B**:
  - A green "Catalog ready for templates" banner (normal state shown as a success banner), with explanatory copy.
  - It has its own **dark "Open Templates"** button next to the toolbar's dark "Add catalog item": **two primaries**.
  - Proposed: a quiet status line with one primary.
- **Toolbar hierarchy:** search, "Filters · All", outlined "Re-order items", "Columns", "Manage catalog", dark "Add catalog item". No separate finding beyond the two primaries.
- **Disabled / planned actions:** "Deactivate" is light grey text and reads as disabled — **C** (quiet destructive styling).
- **Table density (desktop):** 16 rows, columns Name / Type / Measurement / Unit / Unit cost / Unit price / Proposal / Status / Actions. Judged fine.
- **Mobile table failure** — **A**:
  - The table is squeezed inside its card: "Material" truncates to "Mater", and the Actions header overlaps the Measurement header.
  - Columns are effectively lost.
  - Proposed: stacked rows below 640px.
- **Truncation / column loss:** as above.
- **Action hierarchy:** "Edit" bold vs "Deactivate" faint.
- **Status chips:** "Visible" and "Active" chips (the StatusBadge systemic item).
- **Card nesting:** readiness banner card + table card. No separate nesting finding beyond the banner.
- **Relationship to Templates:** the banner directs to Templates ("Next: link these items in Templates…"). No finding beyond the banner/primary issue.
- **Code:** `CATALOG_*` constants duplicate `TEMPLATES_*` constants, and `catalogReadinessStatusPillClass` is duplicated verbatim — **B**.

---

## S. TEMPLATES

**Evidence:** `desktop/templates.png`, `mobile/13-templates.png`.

- **Page hierarchy:**
  - Title + subtitle + **blue "+ Template"** top-right (vs board's dark "+ New job" for an equivalent create action) — **B**.
  - A stray micro-label "Setup" under the header — **C**.
- **Your templates list:** Active/Archived tabs; the selected row has a blue ring; the "Test" row has a green "Preferred" chip; an "Archive" text action.
- **Nested cards / boxes-in-boxes** — **B**: "Included work" = section → group box (Materials / Labor / Fees with count chips) → **each item in its own box** (three levels).
- **Packages:** three package cards (Standard selected with a blue ring and "Starting" chip; Enhanced; Premium, with "View changes" links). No separate finding.
- **Included work:** see nesting.
- **Upgrades:** "Optional upgrades" row with an "Add optional upgrade" link. No finding.
- **Proposal packet:**
  - Numbered page rows (Project overview, Project notes, Warranty and protection, Terms / next steps) with truncated previews.
  - A **dark "Edit customer wording"** button.
  - No separate finding beyond the button families.
- **Primary / secondary actions:** "Make preferred" outlined, "Advanced" text, "Adjust packages" / "Adjust included work" outlined, dark "Edit customer wording", blue "+ Template". Mixed primaries — **B**.
- **Mobile:** blue "+ Template" full-width-ish; the list and template detail stack. No overflow.
- **Relationship to Catalog:** "Start a proposal from a Job Card to use this setup · Open Jobs" footer line. No finding.

---

## T. PROPOSAL BUILDER

**Evidence:** `desktop/proposal-builder.png` (`mobile/14-builder.png` captured, not inspected).

- **Builder shell:**
  - "← Back to Job Card", customer name + **"Draft"** label, address, "Saved Sep 23, 12:11 PM".
  - A **blue "Customer review"** primary and "··· More" at the right.
  - Page tabs: Cover, Overview, Estimate, Next steps, Warranty and protection, Project Photos, "More pages (1)".
- **Customer review:** the blue primary — **B** (contractor primary should be slate-900).
- **Estimate:**
  - Package header "Standard package" + $15,457.00 + outlined "Change package".
  - "Included estimate / 13 items" table (Item / Qty / Price / ··· row menu), zebra rows.
- **Package hierarchy:** no separate finding.
- **Page tabs:** consistent underline tabs. No finding.
- **Draft / current / sent wording** — **C**: an already-sent proposal is labeled "Draft". Proposal: show the draft label only when there are real unsent edits (a display rule on the existing lifecycle helper `isMutableDraftDirtyAfterSentFreeze`; no lifecycle change).
- **Units** — **C**: "24.2 SQ" (uppercase) beside "200 linear ft" / "2 each" (lowercase words) — inconsistent unit formatting.
- **Action hierarchy:** blue primary vs slate elsewhere.
- **Separate mini-product feel:** `proposalBuilderConstants.ts` is a local style module, part of the local mini-design-system systemic finding (C.3/C.1). No further builder-specific finding recorded.
- **Mobile:** **NOT INSPECTED IN ORIGINAL AUDIT**.

---

## U. CONTRACTOR PREVIEW / ACCEPTED PREVIEW

**Evidence:** `desktop/proposal-preview-accepted.png` (job A), `desktop/proposal-preview-B-accepted.png` (job B signed), `desktop/proposal-preview-G5A-sent.png`.

- **Preview hierarchy:**
  - A command card ("← Back to Job Card", name · address, "Accepted proposal · Version 2 · Sent …", outlined "Download PDF").
  - Job B additionally shows "Download signed PDF".
  - Then the customer document card.
- **Download PDF:** outlined secondary. No finding.
- **Proposal content (G5A, current):**
  - Full document: company header with logo, "PROPOSAL / Roof replacement proposal", a 4-cell identity strip, selected package card with checklist, "TOTAL INVESTMENT $15,457.00", estimate detail.
  - Judged premium.
- **Empty / dead space; accepted preview; signed preview** — **D**:
  - For jobs A and B, the sent-record preview renders **only the cover** (title + date), with a large empty workspace below.
  - Investigation: `buildProposalCustomerPreviewDocument` always adds the cover, then only the visible DB pages. These August versions were frozen before page snapshotting, so no visible pages or selected-option pricing exist in their version graphs.
  - The current sent version (G5A) renders fully. Classified as **legacy data**, not a current writer and not P0/P1.
  - Owner: data cleanup if those fixtures matter.
- **Logo:**
  - The company logo in the G5A preview is a `placehold.co` placeholder image (company test data).
  - The grey box is fixture content, not a bug.
  - The `/p` "FD" monogram for job A comes from the company name frozen into the older proposal snapshot. Not a live defect.
  - The Phase 12 media guard was ruled out as a cause (`placehold.co` is public https).
- **Relationship to Builder:** the Builder uses a blue primary and "Draft"; the Preview uses an outlined Download. No separate finding.

---

## V. CUSTOMER / PUBLIC EXPERIENCE

**Evidence (reused):**
- `tmp/fielddive-ui-review/phase12-customer-project-record/A-desktop-accepted-changes-open-request.png`
- `tmp/fielddive-ui-review/phase11-collection-communication/final-correction/02-desktop-public-current-contract.png`
- `tmp/fielddive-ui-review/phase10-approved-scope-changes/04-desktop-customer-review.png` (harness)
- Phase 12 B/D captures inspected earlier the same day.

**`/p` after acceptance** — **A**:
- It keeps pre-acceptance framing:
  - header eyebrow "Your roofing proposal" + H1 "Proposal"
  - "Questions? Review the proposal, ask questions, and confirm details when you're ready."
  - footer "Thank you for reviewing this proposal. We are ready to protect your home."
- The **large package price ($18,500.00)** in "Your package" competes with the project record's **Current contract total ($18,950.00)**.
- Presentation only; the numbers are true.
- The copy strings need user review (customer-facing).

**Other items:**
- **Payment due:** "Payment due / Progress payment / $450 / Your contractor requested this payment." + blue "Pay now" + Stripe note. No finding.
- **Payment received:** Phase 12 B/D states (history rows, "Balance remaining"). No 12.5 finding.
- **Scope changes:**
  - The harness capture of customer review: summary table (Original / Current / This change / Proposed new total / Status "Pending approval"), a "What is changing" line card, the reason, "Signature is not required.", and a blue "Approve scope change".
  - Judged cohesive with the packet style.
  - The live route was not opened.
- **Current contract summary / project record:** judged cohesive (Phase 12). No 12.5 finding beyond the hero-price competition.
- **Questions section:** stale copy after acceptance (above).
- **Post-acceptance wording:** above.
- **Closeout / completion:** "Work complete · {date}" (Phase 12). No 12.5 finding.
- **Mobile:** Phase 12 captures proved 390 with no overflow. No 12.5-specific mobile finding.
- **Branding / visual consistency:**
  - The customer primary is blue ("Pay now", "Approve scope change").
  - The audit proposed **keeping blue as the customer-facing primary** (the established brand accent for the customer document), distinct from the contractor slate primary. This is flagged as a decision for review (see Z / AF).
  - Per-company brand colors on `/p`: **D / NEW DIRECTION**.

---

## W. LOGIN / AUTH SURFACE

**Evidence:** `customer/login-desktop.png` (`customer/login-390.png` captured; `scrollWidth` 390; not visually inspected).

- **Visual hierarchy:** a single card with "FieldDive" text, "Sign in", subtitle "Roofing jobs, proposals, and payments.", Email/Password with visible labels, a blue "Sign in", and "No account? Create one".
- **Branding:** a **text-only wordmark**, without the logo mark used in the app shell — **C**.
- **Width / position:** the card is **pinned near the top** instead of vertically centered — **C**.
- **Primary color:** blue (contractor product) → proposed dark slate — **C**.
- **Consistency with authenticated FieldDive:** judged plain / prototype-like for a paid product.

---

## X. MOBILE SYSTEM FINDINGS (390)

| Finding | Tag | Evidence |
|---|---|---|
| Navigation drawer opens correctly, but the sticky Schedule bar renders **on top of** the open sheet | A | `mobile/07-nav-sheet.png` |
| Sticky lifecycle CTA (bottom bar) — good pattern; appears only after load | keep | `mobile/02b` |
| More tab/sheet — rail observed; **sheet itself not verified** | — | `mobile/06` (not inspected) |
| Content gutters — Job Card bordered card inside the shell gutter (about 30px per side) | C | `mobile/02b`, `03`, `04`, `05` |
| Tables — Catalog table breaks (truncation, header overlap) | A | `mobile/12-catalog.png` |
| Card nesting — board header card large; New Job header card | C | `mobile/01`, `08` |
| Email wrapping mid-word ("example.co / m") | C | `mobile/02`, `03`, `04` |
| Money / stat stacking — 4 tall rows | C | `mobile/03` |
| Action reachability — sticky CTA good; two stacked blue primaries on Proposals | B | `mobile/04` |
| Overflow — none (`scrollWidth` 375 on all contractor routes, 390 on login) | — | all mobile |
| Calendar — per-day loading repeats; ISO dates; teal Schedule | A / C / B | `mobile/09` |
| Job Card Overview false empty fact during load | A | `mobile/02` vs `02b` |
| Mobile header shows only menu + "Sign out" | C | all mobile shell captures |
| Builder / Preview mobile proof — builder captured but **not inspected**; preview **not captured** | — | `mobile/14` |
| Incomplete / misleading proof — `mobile/06` probably shows the Overview, not the More sheet; `mobile/10` and `mobile/14` not inspected | — | — |

---

## Y. PROPOSED SHARED PRIMITIVES

Location proposed: `app/components/ui/` (small React components plus one class-token module; "no framework, no giant design system").

### Button

- **Why:** eight or more private primary strings and three primary colors for equivalent actions.
- **Fixes:**
  - `JobCardNextActionPanel`, `JobCardForwardLifecycleAction`, `jobCardProposalsTabModel` button classes
  - `SETTINGS_PRIMARY_BUTTON`
  - Templates / Builder / Pricing blue primaries
  - teal board / calendar actions
- **Invariant:**
  - Families: Primary / Secondary / Quiet / Destructive / Link.
  - Sizes: 44px minimum on mobile, 36–40px on desktop.
  - `rounded-md` for controls.
  - One disabled treatment (slate-100 fill, slate-400 text).
  - One primary per surface.
- **Used:** every contractor surface; customer surfaces via the customer-primary variant (pending decision).
- **Must NOT become:** a polymorphic mega-component with arbitrary color props or per-surface overrides.

### StatusBadge

- **Why:** locally styled pills and chips; the duplicated `catalogReadinessStatusPillClass`.
- **Invariant:** tones neutral / info / success / warning / error only.
- **Used:**
  - catalog readiness and visible/active chips
  - template "Preferred" / "Starting"
  - proposal markers
  - Job Card stage chip
  - scope-change status ("Voided", "Authorized", "Pending approval")
- **Must NOT become:** a place to encode lifecycle logic. Tone mapping stays in the existing view models.

### InlineNotice

- **Why:** per-module banner constants; banners used for normal states.
- **Invariant:** exceptional conditions only (warning / error / info). Success is inline text, not a banner.
- **Used:**
  - replaces `SETTINGS_GUIDANCE_*` / `SETTINGS_ALERT_*` / `CATALOG_*_BANNER` / `TEMPLATES_*_BANNER`
  - board schedule-error notice
  - `JobsBoardErrorState` (red)
- **Must NOT become:** a routine status or loading surface.

### LoadingState

- **Why:** amber loading, about 16 ad-hoc strings, per-item repeated loading, false negative facts.
- **Invariant:** neutral slate only; a skeleton variant for unknown structure; a single inline indicator for secondary reads; never repeated per item.
- **Used:** Jobs Board (core and schedules), Job Card sections, company Calendar, Preview, Tasks, Scope changes, Payments, Team.
- **Must NOT become:** decoration shown after data is ready, or a way to hide errors.

### EmptyState

- **Why:** three empty patterns in one Job Card.
- **Invariant:** title, one helper line, optional action, no frame by default.
- **Used:** Tasks, Measurements, Photos, Proposals (none yet), company Calendar empty month.
- **Must NOT become:** an oversized illustration hero.

### SectionHeader

- **Why:** repeated tab-name H2s; actions placed inconsistently.
- **Invariant:** title + optional right-aligned action; no duplicate of the active tab label.
- **Used:** Job Card tab panels, Settings sections, Catalog / Templates sections.
- **Must NOT become:** a page header with breadcrumbs, or a nav system.

### StatGrid / MoneyRow

- **Why:** money label/value styles differ (Job Card Payments, Phase 12 closeout rows, `/p` project record); mobile 4-row stacking.
- **Invariant:** one label/value treatment, tabular figures, 2×2 on mobile. **Display only; no money math.**
- **Used:** Job Card Payments stats, closeout rows, project record rows, scope-change summary.
- **Must NOT become:** a computation layer. Values arrive preformatted from the existing presenters.

### Shared form/input classes

- **Why:** placeholder-only fields; cyan vs blue focus; native controls unaligned.
- **Invariant:** visible labels; one blue focus ring; consistent border and radius; native selects and dates retained.
- **Used:** New Job, Settings, Pricing, Job Card Calendar, Catalog / Templates editors.
- **Must NOT become:** custom-built select/date widgets (deferred).

### Others actually proposed

- **Global foundation:**
  - Geist via `next/font`
  - remove the Arial override
  - move the root dark background to the marketing page after verifying `/`
  - drop the `prefers-color-scheme: dark` flip
- **App shell corrections:** hide the empty desktop header; Sign out moves to the nav sheet footer; nested `<main>` removed.
- **Migration path:** the local constant files (`settingsConstants`, `catalogConstants`, `templatesConstants`) first **re-export** from the shared module so existing call sites keep working, then get trimmed.

---

## Z. TYPOGRAPHY / COLOR / SURFACE PROPOSAL (as proposed by Cursor)

- **Font:** Geist (already referenced via `--font-geist-sans`), loaded through `next/font`. Remove `body { font-family: Arial… }`.
- **Neutral:** slate (text, borders, loading, disabled).
- **Blue:** information, selection, focus rings, links (navigation only). Also the **customer-facing primary** (Pay now, Approve scope change) — **decision for review**.
- **Dark slate (slate-900):** the **contractor primary** (existing majority, 73 uses). Login moves to dark.
- **Emerald:** success only for real completion (Paid, Work complete, Connected); inline, not as banners. Not for freshness ("1 day in stage").
- **Amber:** warning / needs attention only. **Never loading.**
- **Red:** error / failed / blocked by failure. Replaces rose-for-error and amber-for-error.
- **Loading color semantics:** neutral slate only; skeletons for structure; a single inline indicator for secondary reads.
- **Customer / public vs contractor primary:** contractor slate-900; customer blue. The alternative (one primary everywhere) was explicitly labeled a **new direction** requiring the user's choice.
- **Hierarchy:**
  - Page title 24px semibold.
  - Section title 16px semibold.
  - Eyebrow 11px uppercase with tracking (10px removed).
  - Body 14px.
  - Metadata 12px.
  - Money uses tabular figures.
- **Width families:** full-width workspace (Board, Calendar, Catalog, Templates, Job Card) and form width (Settings, Pricing).
- **Card depth / nesting:** page headers unframed on the slate-50 canvas; Job Card and proposal document stay single record surfaces; no box deeper than two levels.
- **Spacing:** keep gutter `p-4 sm:p-6`; 24px between sections, 12px within; card padding 20px desktop / 16px mobile.
- **Mobile edge-to-edge:** the Job Card goes edge-to-edge below 640px (removes the double gutter).

---

## AA. FIX-NOW FINDINGS

The original list (verbatim intent, section J of the original reply):

1. Jobs Board loading semantics: remove the amber banner; no "unavailable/blocked" label while loading (board and list).
2. Job Card loading: no negative facts before reads finish (authorized work and equivalent empty lines).
3. Company Calendar at 390: one loading indicator instead of per day; friendly dates.
4. New Job title: "New job" when the company already has jobs.
5. Catalog table at 390: stacked rows.
6. Mobile layering: the Schedule bar must sit under the navigation sheet.
7. One primary per surface; resolve black vs blue per the button families.
8. `/p` after acceptance: project framing and copy; the package price no longer competes with the current contract total.
9. Load failures shown in red, not amber.

Items tagged **B** or **C** in the original audit that were planned for implementation inside Phase 12.5 (not deferred). Under the current rule these are also in-scope fixes:

- **Systemic (B):**
  - shared primitives
  - Geist and removing Arial
  - root background / dark-mode flip
  - desktop header strip
  - board card action consistency
  - Templates "+ Template" color
  - Templates three-level nesting
  - Builder blue primary
  - Pricing Save color
  - Catalog success banner and two primaries
  - teal Calendar "Schedule"
  - placeholder-only New Job fields
  - unified empty states
  - StatusBadge adoption
- **Local (C):**
  - Overview single action row
  - repeated tab-name headings
  - Activity rail fade and "Show all"
  - Job Card Calendar action order, disabled state, native disclosure
  - mid-word email wrap
  - Payments 2×2 stats at 390
  - Job Card edge-to-edge at 390
  - neutral stage-age color
  - board header unframed
  - New Job header unframed
  - Payments slide-over as a full-height sheet with a single Close
  - delete unused `SETTINGS_ALERT_LOAD`
  - Catalog "Deactivate" as quiet destructive
  - Templates stray "Setup" label
  - Builder "Draft" label rule
  - unit formatting
  - company Calendar today marker and empty line
  - mobile Sign out into the nav sheet
  - nested `<main>`
  - login logo mark / centering / dark primary

---

## AB. DEFERRED / DO-NOT-TOUCH FINDINGS

**Protected truth systems — do not alter (explicit in the original risk notes):**
- `plannedScheduleReadIsAuthoritative` and schedule action-blocking behavior (only labels and pre-load rendering change).
- Money math, pricing engine math, payment semantics (StatGrid/MoneyRow display only).
- Proposal acceptance / signature / lifecycle; the Builder "Draft" label change is a display rule only.
- Phase 10 scope-change, Phase 11 communication and Phase 12 project-record truth; the `/p` copy change is presentation only.
- Tenancy and capabilities.

**Deliberately deferred (D):**

| Item | Reason | Owner |
|---|---|---|
| Legacy dark estimate lane in `SavedClient` | Legacy shelf; delete, don't restyle | Existing P1 cutover debt (estimateStore removal) |
| Cover-only accepted preview for pre-snapshot versions | Legacy data, not a current writer | Data cleanup if fixtures matter |
| Dark mode | Product is light-only | Future |
| Per-company brand colors on `/p` | **New direction** | Future, needs approval |
| Proposal PDF styling | Separate renderer, frozen documents | Future document phase |
| Custom date/select widgets | Native is accessible; align border/radius/focus only | Future |
| Board/list virtualization or density modes | Performance/feature, not cohesion | Future |

**Requiring a NEW DIRECTION decision:**
- A single primary color everywhere (instead of contractor slate / customer blue).
- Per-company brand colors on `/p`.

**Also flagged for user review (not labeled new direction):** the exact `/p` post-acceptance copy strings (customer-facing).

**Outside cohesion scope** (per prompt; not audited): new features, RBAC, automation, SMS, AI, marketing site, dependency modernization, migrations, schema cleanup.

---

## AC. PROPOSED IMPLEMENTATION GROUPING

Original order:

1. **Foundation and semantics:**
   - font and root background
   - shared primitives
   - re-point the local constant files
   - app shell fixes
   - all loading and false-state fixes (Jobs Board, Job Card, Calendar)
   - red for errors
2. **Core contractor surfaces:**
   - Jobs Board (board and list)
   - every Job Card tab
   - company Calendar
   - New Job (title and labels)
   - mobile layering
3. **Setup and proposal internals:**
   - Settings, Pricing, Payments slide-over, Team
   - Catalog, including the mobile table
   - Templates
   - Builder and Preview header
4. **Customer-facing and auth:**
   - `/p` post-acceptance hierarchy and copy
   - project record and scope-change alignment
   - login
5. **Whole-app sweep:** desktop + 390 verification, fixing only what the captures show.

Execution rule per group: check prerequisites → implement the bounded group → tests → visual proof → continue if clean.

---

## AD. VISUAL PROOF PLAN

- **Routes:** the same set as the audit:
  - Jobs Board (board and list)
  - every Job Card tab plus the More sheet and navigation sheet
  - Calendar
  - New Job
  - Settings, Pricing, Payments slide-over, Team
  - Catalog, Templates
  - Builder, Preview
  - `/p` states A–F (Phase 12 set)
  - scope-change review
  - login
- **Widths:** desktop 1440 and 390; `innerWidth` 390 and `scrollWidth` ≤ 390 on every page.
- **Loading:** poll during load to capture loading and settled states for the Jobs Board, the Job Card and the Calendar.
- **Empty:** Tasks, Measurements, Photos, empty Calendar month.
- **Warning / error:** implied by the plan (red load failure, amber real warnings) but **no explicit capture procedure** was specified for forcing error states. `NOT RECOVERABLE FROM CURRENT CURSOR AUDIT RECORD` how error states would be induced.
- **Public / customer:** `/p` A–F and scope-change review.
- **Output:** before/after pairs, with this audit as "before", saved under `tmp/fielddive-ui-review/phase12-5-paid-ui-implementation/`.

---

## AE. TEST / REGRESSION PLAN

**Targeted tests (new):**
- The schedule integrity label returns nothing while loading; failure copy only on error or real incoherence.
- `resolvePacketIntakeTitle` returns "New job" when the company has jobs.
- Button / badge / notice variant maps (families and tones as data).
- A guard that loading copy and constants never use amber.
- A guard that contractor surfaces don't use blue primaries after migration.

**Tests expected to need deliberate updates (they assert class strings):**
- `jobCardProposalsTabModel.test.ts`
- `jobCardProposalSetupCard.test.ts`
- `commercialWedgeFinalVisualGate.test.ts`
- `companySettingsExperience.test.ts`

**Regression:**
- Phase 7–12 suites plus the 78-file regression list (`tmp/phase12-regression-files.txt`), with exact totals.
- The known `jobPayments044` line-ending hash mismatch is tracked separately (pre-existing).

**Typecheck:** hold the 13-error baseline (all in untouched files).

**Visual review:** section AD; inspect every capture before reporting.

**No protected-truth regression:** section AB list.

---

## AF. CURSOR'S FINAL AUDIT CLASSIFICATION

The original audit **did not** apply ASTRA-EXPLICIT / ASTRA-ALIGNED IMPROVEMENT / NEW DIRECTION to its findings. The governing prompt for the delivered audit stated Phase 12.5 is not Astra-defined and forbade using Astra as the phase authority. An earlier superseded prompt asked for that taxonomy, but the audit was delivered under the later prompt.

| Recommendation group | Original tag(s) | Astra classification |
|---|---|---|
| Shared primitives (Button, StatusBadge, InlineNotice, LoadingState, EmptyState, SectionHeader, StatGrid/MoneyRow, form classes) | B | UNCLASSIFIED IN ORIGINAL AUDIT |
| Geist / remove Arial / root background / dark flip | B | UNCLASSIFIED IN ORIGINAL AUDIT |
| App shell (desktop header, mobile Sign out, nested main) | B / C | UNCLASSIFIED IN ORIGINAL AUDIT |
| Jobs Board loading semantics + false blocked labels | A | UNCLASSIFIED IN ORIGINAL AUDIT |
| Job Card false empty facts during load | A | UNCLASSIFIED IN ORIGINAL AUDIT |
| Company Calendar per-day loading / ISO dates / teal | A / C / B | UNCLASSIFIED IN ORIGINAL AUDIT |
| New Job "Start my first job" | A | UNCLASSIFIED IN ORIGINAL AUDIT |
| Catalog mobile table | A | UNCLASSIFIED IN ORIGINAL AUDIT |
| Sticky CTA over nav sheet | A | UNCLASSIFIED IN ORIGINAL AUDIT |
| One primary per surface / black vs blue | A / B | UNCLASSIFIED IN ORIGINAL AUDIT |
| `/p` post-acceptance framing and hero price | A | UNCLASSIFIED IN ORIGINAL AUDIT |
| Red for load failures | A | UNCLASSIFIED IN ORIGINAL AUDIT |
| Local fixes (section AA local list) | C | UNCLASSIFIED IN ORIGINAL AUDIT |
| Contractor slate / customer blue primary split | decision for review | UNCLASSIFIED IN ORIGINAL AUDIT (the *alternative*, one primary everywhere, was called a new direction) |
| Single primary color everywhere | — | **NEW DIRECTION** (labeled in original) |
| Per-company brand colors on `/p` | D | **NEW DIRECTION** (labeled in original) |
| Deferred items (legacy lane, legacy preview, dark mode, PDF, custom controls, virtualization) | D | UNCLASSIFIED IN ORIGINAL AUDIT |

---

## AG. OPEN QUESTIONS / UNCERTAINTIES

1. **More sheet at 390** not verified (`mobile/06` probably did not open it).
2. `mobile/10-company-settings.png`, `mobile/14-builder.png`, `customer/login-390.png` and `loading/01-jobs-board-loading-jobs.png` were captured but **not visually inspected**.
3. **Team editor, Business / Branding / Preferences editors, More job actions, modals, PDF, emails**: not inspected.
4. **Settings "Checking…"** state: not observed; existence unknown.
5. **Error states**: no live capture; findings are code-based.
6. **Live scope-change route** not opened; harness evidence used.
7. **Board column eyebrow** inconsistency ("Approved" with no eyebrow) noticed but unconfirmed; dropped from the plan.
8. **Job Card Calendar reddish day numbers**: noticed, not investigated.
9. **Voided scope-change "New total -$1,050.00"**: recorded as observation; not treated as a defect because the rows are voided proofs. Not independently verified against Phase 10 rules in this audit.
10. **Root dark background removal** depends on whether `/` (marketing) relies on it; not checked.
11. **Customer primary color decision** (contractor slate vs customer blue) left to the user.
12. **`/p` post-acceptance copy strings** not drafted in the audit; flagged for user review.
13. The amber board banner's on-screen duration varies with load speed (about 0.3s in one desktop sample; persistent in the list and mobile captures).
14. The audit browser was the Playwright MCP browser, not the user's personal browser window.

---

## AH. SOURCE / EVIDENCE INDEX

Paths relative to `tmp/fielddive-ui-review/phase12-5-paid-ui-audit/` unless noted. "Inspected" means the image was opened and reviewed during the audit.

| File | Inspected | Findings |
|---|---|---|
| `loading/01-jobs-board-loading-jobs.png` | no | D.3 |
| `loading/02-jobs-board-amber-schedule-loading.png` | yes | D.1, D.2, E |
| `loading/03-jobs-board-loaded.png` | yes | D.2 (settled), E card actions, stage-age color |
| `desktop/board-list.png` | yes (too tall to judge) | E long list |
| `desktop/board-list-viewport.png` | yes | D.1, D.4, E list |
| `desktop/jobcard-A-01-overview.png` | yes | F, G (floating Schedule, Directions row, repeated heading, Activity rail clip) |
| `desktop/jobcard-A-02-tasks.png` | yes | H, C.5 |
| `desktop/jobcard-A-03-calendar.png` | yes | I |
| `desktop/jobcard-A-04-measurements.png` | yes | J, C.5 |
| `desktop/jobcard-A-05-proposals.png` | yes | K (two blue primaries, scope-change history) |
| `desktop/jobcard-A-06-payments.png` | yes | L |
| `desktop/jobcard-A-07-attachments.png` | yes | M, C.5, C.13 |
| `desktop/jobcard-G5A-proposals-sent.png` | yes | K (blue "View sent proposal") |
| `desktop/calendar.png` | yes | N desktop |
| `desktop/new-job.png` | yes | O |
| `desktop/company-settings.png` | yes | P, C.11 |
| `desktop/payments-settings.png` | yes | P slide-over |
| `desktop/pricing-rules.png` | yes | Q |
| `desktop/catalog.png` | yes | R |
| `desktop/templates.png` | yes | S |
| `desktop/proposal-builder.png` | yes | T |
| `desktop/proposal-preview-accepted.png` | yes | U (cover-only, legacy) |
| `desktop/proposal-preview-B-accepted.png` | yes | U (signed, cover-only, legacy) |
| `desktop/proposal-preview-G5A-sent.png` | yes | U (full current document) |
| `mobile/01-board.png` | yes | E mobile, D.1 |
| `mobile/02-jobcard-A-overview.png` | yes | D.5, G, X (email wrap, gutter) |
| `mobile/02b-jobcard-A-overview-settled.png` | yes | D.5 settled, sticky CTA |
| `mobile/03-jobcard-A-payments.png` | yes | L mobile stacking |
| `mobile/04-jobcard-A-proposals.png` | yes | K mobile |
| `mobile/05-jobcard-B-overview-closeout.png` | yes | G completed job |
| `mobile/06-jobcard-more-sheet.png` | no | — (probably not the More sheet) |
| `mobile/07-nav-sheet.png` | yes | F / X sticky CTA over nav sheet |
| `mobile/08-new-job.png` | yes | O mobile |
| `mobile/09-calendar.png` | yes | D.6, N mobile |
| `mobile/10-company-settings.png` | no | — |
| `mobile/11-pricing-rules.png` | yes | Q mobile |
| `mobile/12-catalog.png` | yes | R mobile table failure |
| `mobile/13-templates.png` | yes | S mobile |
| `mobile/14-builder.png` | no | — |
| `customer/login-desktop.png` | yes | W |
| `customer/login-390.png` | no | W (`scrollWidth` 390 measured) |

**External evidence reused:**
- `tmp/fielddive-ui-review/phase12-customer-project-record/A-desktop-accepted-changes-open-request.png` → V
- `tmp/fielddive-ui-review/phase11-collection-communication/final-correction/02-desktop-public-current-contract.png` → V
- `tmp/fielddive-ui-review/phase10-approved-scope-changes/04-desktop-customer-review.png` (harness) → V

**Code evidence:**
- `app/globals.css`, `app/layout.tsx` → C.9, C.15
- `app/tools/roofing/FieldDiveAppShell.tsx` → C.15
- `app/tools/roofing/saved/SavedClient.tsx` (schedule banner, "Loading jobs…", legacy dark lane) → D, E
- `app/lib/jobScheduleStageCoherence.ts` → D.1, D.2
- `app/tools/roofing/saved/components/JobsBoardErrorState.tsx` → D.9
- `app/tools/roofing/saved/components/BoardMovementConfirmDialog.tsx` → D.9
- `app/lib/packetIdentityEntry.ts` → O
- `app/tools/settings/settingsConstants.ts`, `app/tools/roofing/catalog/catalogConstants.ts`, `app/tools/roofing/templates/templatesConstants.ts` → C.1–C.3
- `app/tools/roofing/jobCard/jobCardProposalsTabModel.ts`, `JobCardNextActionPanel.tsx`, `JobCardForwardLifecycleAction.tsx` → C.1
- `app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx`, `app/lib/proposalCustomerPreviewViewModel.ts` → U
- `app/components/proposal-packet/ProposalPacketCompanyMark.tsx` → U (logo / monogram)

---

## AI. ORIGINAL FULL AUDIT SUMMARY (narrative reconstruction)

Cursor audited FieldDive at `d13864a` after Phase 12 closed. It read the handoff doc's Phase 12.5 scope, inventoried the styling layer in code, and inspected the authenticated product at desktop 1440 and true 390, plus login signed-out. Customer-facing `/p` and scope-change evidence was reused from the Phase 10–12 captures of the same code.

The code inventory showed **no shared UI layer**:
- only `FocusedEditor` lives in `app/components/ui/`
- `globals.css` has no semantic tokens
- Arial overrides Geist globally
- the root body is dark navy with white text, masked by the app shell
- settings, catalog and templates each carry their own card, banner and pill constants (with verbatim duplicates)
- at least five private "primary button" strings exist, split between slate-900, blue-600 and teal

In the product, the most important finding was **loading presented as a problem**:
- The Jobs Board shows an amber "Loading planned schedules…" banner (the same box it uses for the real error).
- While that read is pending, every approved or scheduled card claims "Planned schedule status unavailable; lifecycle actions are blocked."
- On mobile, the Job Card Overview briefly states "No authorized scope on file" before showing the accepted work.
- The company Calendar repeats "Loading schedules…" in every day card.

The blocking logic is correct; the presentation turns ordinary loading into warnings or false facts. Cursor classified these as fix-now product-truth presentation defects, **not** P0/P1, and found **no** P0/P1 correctness, tenancy, money, lifecycle or customer-trust defects.

The second theme was **action-language drift**:
- Equivalent primaries are black on one Job Card tab and blue on the next.
- Templates' create button is blue while the board's is black.
- Board and calendar scheduling actions are teal.
- Pricing's save button is faded blue.
- The builder's primary is blue.
- Catalog and the Job Card Proposals tab each show two primaries.

Cursor proposed five button families (slate-900 Primary, outlined Secondary, text Quiet, red Destructive, blue Link) with one primary per surface. It proposed keeping blue as the customer-facing primary, a decision left to the user; one primary everywhere was labeled a new direction.

Further systemic issues:
- three empty-state patterns inside one Job Card
- banners used for normal states (the Catalog readiness success banner)
- 476 uses of 10–11px type
- inconsistent framing (header cards on some pages, three-level nesting in Templates, card-in-gutter on mobile)
- an empty desktop header strip and a Sign-out-only mobile header
- a nested `<main>` landmark

Local and mobile defects included:
- "Start my first job" on repeat use
- the Catalog table breaking at 390
- the sticky Schedule bar rendering above the navigation sheet
- mid-word email wrapping
- four stacked payment stats
- ISO dates on the mobile Calendar
- the Payments slide-over as a short floating box with redundant Cancel/Done
- the clipped Activity rail
- Job Card Calendar control order
- the builder labelling a sent proposal "Draft"
- inconsistent unit formatting
- a plain login page

On the customer side, `/p` keeps pre-acceptance framing after acceptance, and its large package price competes with the current contract total. Presentation only; flagged for copy review.

Cursor investigated and **dismissed** as non-defects:
- the cover-only accepted previews (legacy pre-snapshot fixtures)
- the grey logo box (a `placehold.co` fixture)
- the "FD" monogram (frozen snapshot company name); the Phase 12 media guard was ruled out

Cursor proposed a minimal shared layer in `app/components/ui/`:
- Button
- StatusBadge
- InlineNotice
- LoadingState
- EmptyState
- SectionHeader
- StatGrid / MoneyRow
- form classes

Global foundation changes: Geist, background and shell. Local constant files re-export first to keep call sites stable. Protected truth stays untouched: schedule authority, money math, proposal lifecycle, and the Phase 10/11/12 truth.

Work was grouped into four implementation passes plus a whole-app desktop/390 sweep:
1. foundation and semantics
2. core contractor surfaces
3. setup and proposal internals
4. customer and auth

The plan included targeted tests, updates to the class-asserting tests, the 78-file regression list, the 13-error typecheck baseline, and before/after visual proof.

Known coverage gaps:
- Team and other settings editors, More job actions, modals, PDFs and emails
- the More sheet at 390
- live error states
- the live scope-change route
- four captured-but-uninspected screenshots

**Original verdict:** `PHASE 12.5 AUDIT COMPLETE — READY FOR IMPLEMENTATION REVIEW`
