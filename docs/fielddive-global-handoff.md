# FieldDive Global Handoff

**Purpose:** Single source of truth for GPT, Cursor, and humans when resuming work. Prevents drift across chat transitions. Read this file **before** proposing or implementing code changes.

**Related docs (secondary anchors):**

- `docs/fielddive-flow-map.md` — IA / screen flow map
- `docs/competitive-architecture-audit.md` — module vs legacy calculator audit
- `docs/fielddive-estimate-proposal-flow-model.md` — estimate/proposal UX model notes
- `docs/fielddive-feature-placement-map.md` — feature placement matrix

**When to read related docs:**

- Read **`docs/fielddive-flow-map.md`** when changing routes, IA, screen flow, or Job Board / Job Card navigation — but **§6BO.13 / §6AL / §6AM / §6AN / §6AO supersede** older flow-map terminology where they conflict (e.g. Job Board vs Command Center — **no separate Command Center** per §6BO.13).
- Read **`docs/competitive-architecture-audit.md`** when adding modules, changing dashboard/Job Board architecture, or comparing against Roofr/competitor-style workflow.
- Read **§6AL** before any recovery or template/Builder/lifecycle work — **mandatory stage order**.
- Read **§6AN** before Job Board / `saved` route work, board partition, or legacy saved-estimate boundaries.
- Read **§6AO** before Proposals hub / Templates / Builder route placement or lifecycle ownership.
- Read **§6AP** before R10 template structure work — pre-R10 audit + P1 Job Card truth fixes.
- Read **§6AQ** before R11 Settings branding work — R10 completion summary (historical).
- Read **§6AR** before R11 Settings branding work — R11a/R11b completion summary (historical).
- Read **§6AS** before R15 branded cover/display work — R11c company branding context_echo stamping summary, P2 carryover, visual-check guardrail.
- Read **§6AT** before R13/R15 proposal document truth or customer/company display work — R12 customer identity context_echo stamping summary, post-R12 audit, authenticated Playwright verification, P2 carryover.
- Read **§6AU** before R14/R15 proposal document truth work — R13 frozen document token foundation (registry, `ProposalDocumentContext`, resolver), post-R13 audit, P2 carryover.
- Read **§6AV** before R16+ lifecycle work — R15 read-only branded cover, address dedupe, post-R15 audit, P2 carryover.
- Read **§6AW** before R17 lifecycle, Preview/PDF, or template token authoring — R14 read-only body/page token merge, post-R14 audit, P3 carryover.
- Read **§6AX** before any Builder chrome/document IA, page strip, or workspace-header change — R16A builder chrome vs customer document separation, post-R16A audit, P3 carryover.
- Read **§6AY** before any Builder body authoring, page content edit/save, Estimate section filtering, or `updateDraftProposalPageContent` work — R16B proposal body authoring foundation, post-R16B validation, P2/P3 carryover.
- Read **§6AZ** before choosing the next Builder stage after R16B — whole-app Roofr-aligned audit (2026-06-18), P2/P3 findings, R16C planning guidance.
- Read **§6BA** before any Builder strip overflow navigation, More pages menu, or overflow page routing work — R16C1 overflow navigation foundation, portal menu fix, post-R16C1 validation.
- Read **§6BB** before any Builder document token picker, Insert field control, or R16B editor token insertion work — R16C2 registry-driven token picker foundation, post-R16C2 validation.
- Read **§6BC** before any Builder page visibility / hide-show, `visible_to_customer`, `updateDraftProposalPageVisibility`, or R17 Preview page-filter contract work — R16C3 page visibility foundation, post-R16C3 validation.
- Read **§6BD** before R17 Preview planning context or post-R16C Builder integration history — R16C final whole-Builder audit (2026-06-18), stable foundation verdict, mobile findings, R17 planning gate (**historical — superseded by §6BE / §6BF for current resume**).
- Read **§6BE** before R17A/R17B customer Preview foundation context — authenticated contractor Preview route, Builder wiring, R17A VM (**historical foundation — superseded by §6BF for current Preview Estimate resume**).
- Read **§6BF** before R17C1 Preview Estimate document presentation context — R17C1 Preview Estimate document presentation layer, architecture separation, validation (**historical Preview foundation — superseded by §6BG for current Builder Estimate resume**).
- Read **§6BG** before R17C2 Builder Estimate workbench context — R17C2 Builder Estimate workbench hierarchy, scope review semantics, gated Edit Option shell (**historical Builder workbench resume — superseded by §6BK for current Edit Option / scope decision resume**).
- Read **§6BH** before R17D Phase 1 scope decision overlay backend context — merge-on-refresh contract, migration/store/merge foundation (**historical Phase 1 resume — superseded by §6BI / §6BJ / §6BK for current R17D resume**).
- Read **§6BI** before R17D Phase 2 manual quantity set/update context — Phase 2 code + full audit (**historical Phase 2 resume — superseded by §6BJ / §6BK for current manual quantity / Edit Option resume**).
- Read **§6BJ** before R17D Phase 2.5 manual quantity reset context — Phase 2.5 code + full audit (**historical Phase 2.5 resume — superseded by §6BK for current exclude/remove Edit Option resume**).
- Read **§6BK** for historical R17D Phase 3A exclude/remove context only — **superseded by §6BL** for current audit remediation resume.
- Read **§6BL** before R18/public proposal architecture work — **Audit Remediation Track complete** + **second whole-app audit before R18 passed** (§6BL.21).
- Read **§6BM** before any R18 implementation — **R18A public proposal architecture plan** (immutable sent snapshot first; Send/PDF/Sign/Payment remain phased/disabled; **read-only public route exists** at §6BN.11). **R18B4D send-freeze smoke PASS** documented at **§6BM.13**.
- Read **§6BN** before R18 public proposal work — **R18D3C contractor delivery status/history UI complete + browser smoke PASS** at **`e17eab5`** (§6BN.20); **R18D3B proposal send email template polish complete + Gmail-approved** at **`20a239d`** (§6BN.19); **R18D3B real proposal email send orchestration complete + live-smoked** at **`e7cdc51`** (§6BN.18); **optional-upgrade Builder readiness fix** at **`79e4c4f`** (§6BN.18.8); **R18D3A delivery attempt foundation complete** at **`57786ca`** (§6BN.17); **R18D2 contractor Preview customer send link prep complete** at **`845e8d5`** (§6BN.15); **R18D1 contractor Preview Send gate readiness complete** at **`304ed0f`** (§6BN.13); **R18C4C contractor Preview public review link panel complete** at **`bab25c8`** (§6BN.12); **R18C4B public proposal route + customer shell complete** at **`265d8f6`** (§6BN.11); **R18C4A orchestrator + view model complete** at **`8523812`** (§6BN.10).
- Read **§6BO** for **completed** public proposal packet + Stage A/B truth-pipeline **remediation side-track** (`4402821`, `99de56b`, `d3e2d13`, `10a1971`, `ee643d0`, §6BO.7 smoke PASS), **§6BO.11** for **approved Stage C token supersession / stale-link policy**, **§6BO.12** for **operating-flow audit sequencing** (complete — outcome recorded in **§6BO.13**), and **§6BO.13** for **approved page-by-page UI flow roadmap + P0 implementation sequence** — **§6BO.13 supersedes** any earlier separate Command Center language; recover next step from **§6BO.13** / **§11 override** (§6BO.0 for R18 letter-phase history only).

**Last updated checkpoint:**

- **Code checkpoint:** **`40ea180`** — polish(proposals): clarify builder estimate actions (Block 4D; prior **`d8125ec`** / **`ea39fa7`**)
- **Docs checkpoint:** **Block 4D Builder action clarity + estimate editing** (this header + **§6BO.13.4.9** T.3). Prior: T.2 (**`d8125ec`**); T.1 (**`ea39fa7`**); T (**`2ae400b`**).
- **Prior code:** **`40ea180`** action clarity; **`d8125ec`** visual continuity; **`ea39fa7`** document-led Builder
- **Next coding:** **Block 5** — Preview document-first (only after Block 4D review). Do **not** start Blocks 6–7 until Block 5 is approved. Do **not** add full proposal management, template rebuild/import of live options into existing drafts, supplier sync, material ordering, proposal import, CSV mapping assistant, raw mode switch, or whole rounding. **R18D3D remains blocked** until at least **Stage C4** is live and smoke-validated **plus P0 trust fixes**, then explicitly approved (§6BO.11, §6BO.13).
- **Historical note:** Block 4D action clarity: Review quantities → Finish estimate focus; Set quantity → item panel; Edit package → advanced drawer; optional upgrades collapsed; included row More → Remove; protected systems unchanged.

**Trust order:** Header/current checkpoint → **§6BO.13** (approved page-by-page UI flow roadmap + P0 implementation sequence — **supersedes separate Command Center language**) → **§6BM** / **§6BN** (R18 letter-phase roadmap + R18C–R18D3C implementation history) → **§6BO** / **§6BO.11** / **§6BO.12** (completed remediation side-track + **approved Stage C policy** + **operating-flow audit sequencing — complete; outcome in §6BO.13**) → **§6BL** → **§11 override**. Stage B browser smoke required local-only **`USE_PROPOSAL_SEND_FREEZE_RPC=1`** in `.env.local` (gitignored, not committed). **Do not proceed** to docs-only or next feature work unless working tree is clean. **Still do not** mutate `proposals.status = sent`, write sent `proposal_events`, move Jobs Board cards, add Job Card send activity, enable PDF/Sign/Payment, or add webhooks unless separately approved.

**DB-first foundation is live** (§6AD). **3J3E option selection persists** (§6AE). **Pricing trust hardening complete** (§6AF). **3J4C document-first Builder complete** (§6AG) — Estimate page renders the actual proposal document inline (package selector, sections, line items, totals); right rail is a contextual **Proposal Helper** inspector; old workspace tabs and Overview panel **removed**. **R16A** (§6AX) removed the amber **Preview-unlock blocker banner** from the Estimate **canvas**; pricing/blocking guidance remains in the rail. **3J4D** refined Estimate line readability (§6AH). **3J4E** refined package/options surface inside Estimate (§6AI). **3J4F** extended Builder to customer-facing text pages — Terms, Warranty, Project Overview, custom_text render persisted `body_markdown` when present (§6AJ). **R14** adds display-time `{{token_name}}` merge on those text pages from frozen `proposalDocumentContext` + R13 resolver (`f359ad4`, §6AW) — stored `body_markdown` unchanged; no write-back. **R4–R6** template content editor on `/tools/roofing/templates` **complete** (`9db2030`–`3c6214c`). **R7** light global IA nav **complete** (`05b9c54`). **R8** light Jobs Board identity **complete** (`1191ddd`). **R9** Job Card create/open draft flow **satisfied** (`1915b2d` + pre-R10 P1 at `d0ba188`). **R10** template structure + estimate settings **complete** (`bc42b1e`–`b3dd904`, §6AQ). **R11** company branding Settings **complete** (`0146dac`–`139e8a3`, §6AR). **R11c** stamps company core + branding into `proposal_versions.context_echo` at new draft create only (`29722a0`, §6AS) — **no Builder cover UI**. **R12** stamps DB-truth customer identity into `proposal_versions.context_echo` at new draft create only (`31059e3`, §6AT) — **no Job Card UI changes, no Builder customer display**. **R13** adds pure frozen document token foundation (`e40db30`, §6AU) — registry, `ProposalDocumentContext`, resolver. **R15** adds read-only branded **Cover** tab in Proposal Builder (`ab5a400`, §6AV) — consumes `proposalDocumentContext` + resolver; **not** Preview/PDF/send/sign/payment. **R14** wires body text pages to the same frozen context at display time (`f359ad4`, §6AW). **R16A** separates contractor workspace chrome from customer document IA (`18cebca`, §6AX) — customer-logical page strip order, workspace header, simplified body shell; **not** Preview/PDF/lifecycle/hub. **R16B** adds per-proposal draft body authoring for text pages (`589f5a0`, §6AY) — raw `body_markdown` persist, R14 display merge only, Estimate line-items-only de-duplication on persisted path; **not** token picker, page visibility, media, Preview, or lifecycle. **R16C1** adds Builder strip overflow page navigation (`967f0de`, §6BA) — More pages menu for persisted overflow pages by `page.id`, dirty-edit guard preserved, portal menu fix; **not** page visibility, Preview, or lifecycle. **R16C2** adds registry-driven document token picker in the R16B editor (`0cf76d2`, §6BB) — Insert field menu inserts raw `{{token_name}}` only; R14 display-time merge unchanged; save persists raw `body_markdown` only; **not** page visibility, Preview, or lifecycle. **R16C3** adds DB-backed proposal page visibility hide-show foundation (`25f1375`, §6BC) — toggles existing `proposal_pages.visible_to_customer` via `updateDraftProposalPageVisibility`; hidden pages remain contractor-visible and editable in Builder; Cover/Estimate required; `getCustomerPreviewPages` R17 contract helper only; **not** Preview, customer route, PDF, or lifecycle. **R17A/R17B** adds authenticated contractor Customer Preview foundation (`8ac2bcb`, §6BE) — pure `proposalCustomerPreviewViewModel` + `/tools/roofing/proposals/preview?job=&proposal=` route; header Preview enabled when persisted draft loads; dirty-edit guard before Preview navigation; **not** public/tokenized customer access, PDF, Send, Sign, Payment, or lifecycle. **R17C1** adds Preview Estimate document presentation layer (`9c2244a`, §6BF) — pure `proposalCustomerEstimatePresenter` + Preview-only estimate UI; shared `proposalPackagePresentation`; Preview Estimate no longer imports Builder workbench table components; **not** R17C2 Builder workbench hierarchy (now complete at `3e65774`, §6BG), R17C3 typography polish, R18, PDF, Send, Sign, Payment, or lifecycle. **R17C2 Phase 1** adds pure Builder workbench estimate presenter (`3c04322`, §6BG) — `proposalBuilderWorkbenchEstimatePresenter` DTO only; no UI. **R17C2 Phase 2** adds zoned Builder Estimate workbench UI + scope review / hard blocker split + gated Edit Option shell (`3e65774`, §6BG) — **not** R17D scope decision backend, R17C3 typography, R18, PDF, Send, Sign, Payment, or lifecycle. **R17D Phase 1** adds persisted scope decision overlay + merge-on-refresh foundation (`43c83a2`, §6BH) — `proposal_option_scope_decisions` migration (`20260618_009`); **`manual_quantity` proven in tests**; zero-decision refresh unchanged; migration **appears applied** on configured project per §6BI. **R17D Phase 2** adds manual quantity UI/API — first real Edit Option action wired in Builder (`f5712ff`, §6BI); **`manual_quantity` only**; other Edit Option actions remain disabled; **full post-Phase-2 audit passed** (§6BI); **not** R17C3 typography, R18, PDF, Send, Sign, Payment, or lifecycle. Main workflow: **Job Board → DB job card (`job=`) → Create proposal / Open proposal → create/reuse DB proposal draft → Builder (`job=` + `proposal=`) → package selection persists to DB; refresh draft pricing when measurement changes**. Legacy `loadSaved=` / `currentSaved` / board-origin paths are **preserved but separated** — they **cannot create DB proposals directly**. **DB proposal math uses the new spine only** (`measurement_records` → `proposalQuantityResolver` → `proposalPricingEngine` → snapshots) — **not** legacy saved-estimate / Core-Enhanced-Premium estimator math. **`createDraftProposal`** runs from Job Card **Create proposal** only when checklist + pricing gates pass; **Builder reads** persisted drafts via **`getDraftGraph`** + **`proposalDraftGraphAdapter`** when `?proposal=` is present — **no Builder create path**, **no silent fallback** on invalid `proposal=`. **Do not** persist placeholder/unconfigured pricing policy. **Catalog custom delete/deactivate** is **not implemented** and remains a **separate later scope**.

### Recent committed sequence (recovery R0–R17C2; then 3G6 spine + 3J + 3J4)

| Commit | Summary |
|--------|---------|
| *(pending)* | **Docs** — Catalog naming roadmap correction before Slice 2 (§6BO.13) |
| `36a0b55` | **Slice 1** — Jobs command surface P0: default route → Job Board; Jobs/Setup/Advanced nav; setup guidance; legacy de-emphasis; Roofr-style job card snapshots; **no lifecycle/status movement** |
| `fc86123` | **Docs** — Record approved page-by-page UI flow roadmap + P0 implementation sequence (§6BO.13) |
| `ba3659e` | **Docs** — Record Stage C policy + operating-flow audit sequencing decision (§6BO.11, §6BO.12) |
| `6d0e021` | **Docs** — Record R18D3C contractor delivery status/history UI checkpoint (§6BN.20) |
| `e17eab5` | **R18D3C3** — Preview Send panel read-only **Email delivery history** UI; client fetch/refetch after send success; **13/13** client + **1021/1021** proposal lib tests; **R18D3C4 browser smoke PASS** (§6BN.20.8); **no Send orchestration/lifecycle/status/job-board/public-route changes** |
| `1811f7a` | **R18D3C2** — Authenticated read API `GET /api/proposals/delivery-attempts?proposalId=&jobId=`; session-scoped list + history VM; **14/14** server + **1008/1008** proposal lib tests; **no UI/lifecycle/SQL/email minting** |
| `f0627e1` | **R18D3C1** — Pure delivery history presenter/view-model + tests; contractor-safe copy; forbidden-field omission; **17/17** VM tests |
| `4599126` | **Docs** — Correct R18 roadmap recovery after truth pipeline side-track (§6BO.0) |
| `5efcc45` | **Docs** — Record public proposal packet + Stage A/B identity truth pipeline checkpoint (§6BO) |
| `ee643d0` | **Stage B server-deps fix** — Pass server Supabase deps through identity restamp nested live-identity loader; branding/measurement server reads inherit `buildProposalSendSnapshotServerDeps(supabase)`; routes return guarded **400 `freeze_unavailable`** instead of **500** when freeze RPC disabled locally; **984/984** proposal lib tests (§6BO.6) |
| `10a1971` | **Stage B** — Restamp identity echo before send freeze; live identity → diff → merge allowlist keys into draft `context_echo` → existing refreeze/freeze path; **983/983** proposal lib tests at commit (§6BO.5) |
| `d3e2d13` | **Stage A** — Pure identity/contact echo staleness detection; allowlist diff only; **19/19** identity tests + **976/976** proposal lib tests at commit (§6BO.4) |
| `99de56b` | **Public proposal packet polish** — Customer-facing proposal packet presentation under `app/components/proposal-packet`; package/add-ons/total/details/contact/footer; no hero price card; no standalone “Included in this estimate”; **Current**-style package language; Save PDF/Share coming-soon only (§6BO.2) |
| `4402821` | **Public proposal packet foundation** — Shared `proposalCustomerPacketViewModel` + presenter + public adapter; wired public route; removed old public UI (§6BO.2) |
| `9d8b63c` | **Docs** — Record R18D3B email polish checkpoint (§6BN.19) |
| `20a239d` | **R18D3B email polish** — Professional pass-3 proposal send email template; project-only summary; no price/package/options in email; no visible localhost dev artifact; Gmail visual review approved “ok for now”; **15/15** template + **17/17** send gate + **12/12** delivery + **5/5** server + **914/914** proposal lib tests; **no orchestration/token/delivery-attempt/lifecycle/public-page changes** |
| `55a5f83` | **Docs** — Record R18D3B live-send verification checkpoint (§6BN.18) |
| `e7cdc51` | **R18D3B** — Real proposal email send orchestration; POST `/api/proposals/send`; Resend HTTP + delivery attempts; Preview Send UI; **72/72** R18D3B targeted + **902/902** proposal lib tests; **no lifecycle/status/job-board/PDF/Sign/Payment/webhooks** |
| `79e4c4f` | **Builder readiness fix** — Enable optional upgrade scope actions in Builder (§6BN.18.8) |
| `a1f8933` | **Docs** — Record R18D3A migration `020` live-applied + verified (§6BN.17.7) |
| `670ed59` | **Docs** — Checkpoint after R18D3A delivery attempt foundation |
| `57786ca` | **R18D3A** — Delivery attempt foundation; migration `20260626_020` **live-applied + verified PASS** on `rhquhnujjnzjhweypavd`; types + persistence + server store + view model + tests; **875/875** proposal lib tests; **no Send/email/Resend/lifecycle/PDF/Sign/Payment/pricing** |
| `d2bb22c` | **Docs** — Record R18D2 contractor Preview customer send link prep checkpoint (§6BN.15) |
| `845e8d5` | **R18D2** — Contractor Preview customer send link prep; POST `/api/proposals/send-prep`; freeze/reuse/refreeze + mint customer-send token; open/copy session URL; **852/852** proposal lib tests; authenticated browser smoke PASS with documented fixture caveat (§6BN.15); **no Send/email/Resend/lifecycle/PDF/Sign/Payment/SQL/pricing** |
| `6339cc9` | **Docs** — Record R18D1 contractor Preview Send gate readiness checkpoint (§6BN.13) |
| `304ed0f` | **R18D1** — Contractor Preview Send gate readiness + email draft review panel; pure `proposalSendGateReadiness` VM; Send button disabled; **13/13** targeted + **834/834** proposal lib tests; authenticated browser smoke PASS (§6BN.13); **no Send/email/Resend/freeze/mint/PDF/Sign/Payment/lifecycle/SQL/pricing** |
| `c11826c` | **Docs** — Record R18C4C contractor Preview public review link panel checkpoint (§6BN.12) |
| `bab25c8` | **R18C4C** — Contractor Preview public review link panel; POST `/api/proposals/public-review-link`; mint bridge to R18C3B; opens R18C4B `/p/[token]`; authenticated browser smoke PASS (§6BN.12); **no Send / email / PDF / Sign / Payment / lifecycle** |
| `21f05b3` | **Docs** — Record R18C4A/R18C4B public proposal orchestrator + `/p/[token]` route checkpoint (§6BN.10–§6BN.11) |
| `265d8f6` | **R18C4B** — Public proposal route `/p/[token]` + premium read-only customer shell; server admin graph loader fix (`proposalVersionGraphStore.server.ts`); browser smoke PASS (§6BN.11); **no Send / PDF / Sign / Payment / lifecycle** |
| `8523812` | **R18C4A** — Public access orchestrator + render-ready public proposal document view model (§6BN.10); **no route/UI** |
| `1585f9e` | **Docs** — Record R18C3B public access token minting + live DB verification checkpoint (§6BN.9) |
| `5c47854` | **R18C3B** — Public access token minting: pure generator + mint RPC persistence + server-only facade + migrations `018`/`019` (§6BN.9); **live-verified PASS** on `rhquhnujjnzjhweypavd`; disposable mint→resolve smoke |
| `887631c` | **Docs** — Record R18C3A public access token server boundary checkpoint (§6BN.7) |
| `b51383a` | **R18C3A** — Public access token server boundary: SHA-256 hash helper + server-only `service_role` RPC facade + injectable persistence layer (§6BN.7); **`server-only` dependency**; **no public route / no token mint / no customer UI** |
| `9f3acad` | **Docs** — Record R18C2B public access resolve RPCs checkpoint (§6BN) |
| `e7798a7` | **R18C2B** — Public access resolve/record RPCs + permission hardening (`016`/`017`); internal validator `service_role` revoke; **live-verified PASS** on `rhquhnujjnzjhweypavd` (§6BN); **no public route / no app wrappers** |
| `b651c7a` | **R18C2A** — Public access token tables + RLS/triggers (`014`/`015`) |
| `53973f0` | **R18C1** — Sent version graph loader (`getProposalVersionGraph`) |
| `ce94094` | **Docs** — Record R18B4D send-freeze smoke PASS (§6BM.13) |
| `76840d1` | **R18B** — Env-gated send freeze store wrapper |
| `5efbe6e` | **Docs** — Record R18A public proposal architecture plan (§6BM) |
| `f55566d` | **Docs** — Record R17D Phase 4A + 4B estimate display settings checkpoint |
| `38a126e` | **R17D Phase 4B** — Builder proposal-level estimate display settings editing; persists to `proposal_pages.settings_json`; Preview consumes via Phase 4A; no template/line_items/pricing refresh mutation; **647/647** tests; browser smoke passed (§6BL.15) |
| `1424f1e` | **R17D Phase 4A** — Customer Preview estimate display policy consumer from `settings_json`; **637/637** tests; Preview no-regression smoke (§6BL.14) |
| `1dd303a` | **Docs** — Record R17D Phase 4 Hide from customer checkpoint |
| `e79c53a` | **R17D Phase 4 Hide from customer** — `visibility_override` scope decisions; customer-hidden-but-still-priced; Builder Hide/Restore + Edit Option drawer; merge `hiddenButInCalc`; Preview omits hidden lines; **624/624** tests; browser smoke passed (§6BL.13) |
| `8dd8e7f` | **Mark N/A drift cleanup** — Remove non-Roofr-aligned Mark N/A visible UI/copy from Builder Edit Option surfaces; **no Mark N/A behavior/persistence/scope decisions**; Remove/Exclude/Restore preserved; **25/25** + **619/619** tests; browser smoke passed (§6BL.12) |
| `50b6a4d` | **Docs** — Record post-transaction audit and Mark N/A drift cleanup |
| `21e2c79` | **Docs** — Record audit remediation 3A and transactional create checkpoints |
| `f684b73` | **Audit Remediation 4C** — Default `createDraftProposal` persistence to transactional RPC `persist_draft_proposal_create_v1`; normalize line section ids to spine estimate page section; sequential only via `USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL=1`; **619/619** tests; live browser smoke passed (§6BL) |
| `daf5268` | **Audit Remediation 4A** — Stage transactional draft creation persistence foundation; migration staged; live path still sequential at checkpoint; **608/608** tests (§6BL) |
| `b65c684` | **Audit Remediation 3A** — Dual spine isolation guardrails for DB vs legacy routes; **703/703** tests; browser smoke passed (§6BL) |
| `d32ded6` | **Docs** — Record audit remediation 1 and 2B RPC default checkpoint |
| `377dfe2` | **Audit Remediation 2B-D** — Default `refreshDraftPricing` persistence to transactional RPC `persist_draft_pricing_refresh_v1`; sequential only via `USE_REFRESH_DRAFT_PRICING_SEQUENTIAL=1`; legacy RPC opt-in env ignored; **587/587** tests; browser smoke passed (§6BL) |
| `68d8747` | **Audit Remediation 2B-C** — Fix RPC-on refresh persistence test harness; mock RPC applies payload; RPC failure tests; **587/587** RPC-off and RPC-on |
| `558e755` | **Audit Remediation 2B preapply** — RPC env-gate tests; `hiddenButInCalc` snapshot contract fix; **584/584** tests |
| `c2c02dc` | **Audit Remediation 2A** — Transactional pricing refresh persistence foundation; migration staged; live path still sequential at checkpoint; **579/579** tests |
| `6e27716` | **Audit Remediation 1** — Harden Preview readiness/gating + customer hidden-line filtering; **570/570** tests |
| `c4dcf88` | **Docs** — Record R17D Phase 3A exclude/remove from option audit |
| `2dca3c0` | **R17D Phase 3A** — Exclude/remove from proposal option + restore; `excluded` scope decision merge + actions; Builder decision trace zone **Removed from this option**; **564/564** tests; **full audit passed** (§6BK) |
| `c9fe4a5` | **Docs** — Record R17D Phase 2.5 manual quantity reset audit |
| `a12fb92` | **R17D Phase 2.5** — Manual quantity reset/clear; `clearDraftScopeDecisionByTarget`; `clearManualQuantityScopeDecision`; Customer-ready **Edit quantity** chip + drawer **Use measurement quantity**; **559/559** tests; **full audit passed** (§6BJ) |
| `184d971` | **Docs** — Record R17D Phase 2 manual quantity audit |
| `f5712ff` | **R17D Phase 2** — Manual quantity set/update UI/API; `applyManualQuantityScopeDecision`; Builder Set quantity chip + Edit Option drawer quantity section live; other Edit Option actions remain disabled; **547/547** tests; **full audit passed** (§6BI) |
| `9b66bf4` | **Docs** — Checkpoint after R17D Phase 1 scope decision overlay foundation |
| `43c83a2` | **R17D Phase 1** — Scope decision overlay foundation; `proposal_option_scope_decisions` migration (`20260618_009`); types/store/merge lib; `refreshDraftPricing` merge-on-refresh; **`manual_quantity` proven**; zero-decision path unchanged; **541/541** tests; migration **appears applied** on configured project per §6BI |
| `ccbd30d` | **Docs** — Checkpoint after R17C2 Builder estimate workbench |
| `3e65774` | **R17C2 Phase 2** — Builder Estimate workbench zones; zoned UI (package, settings entry, ready scope, scope review / hard blockers, upgrades, totals); gated Edit Option shell; scope review semantics; **529/529** tests |
| `3c04322` | **R17C2 Phase 1** — Builder workbench estimate presenter foundation; pure `proposalBuilderWorkbenchEstimatePresenter` DTO; no UI |
| `16c38e6` | **Docs** — Checkpoint after R17C1 Preview estimate document presentation |
| `9c2244a` | **R17C1** — Preview Estimate document presentation layer; pure `proposalCustomerEstimatePresenter` + Preview-only estimate UI; shared `proposalPackagePresentation`; Roofr-aligned package hero + included scope panel; Preview no longer imports Builder workbench table components; Builder package files import-only refactor; **328/328** tests |
| `f6e8225` | **Docs** — Checkpoint after R17A/R17B customer preview foundation |
| `8ac2bcb` | **R17A/R17B** — Customer Preview foundation; pure `proposalCustomerPreviewViewModel`; authenticated contractor Preview route; header Preview enabled; dirty-edit guard; Builder copy distinguishes Preview available vs Send/Sign/Payment/PDF/public sharing disabled; lifecycle Send/Sign/Payment still locked |
| `333da7c` | **Docs** — Checkpoint after R16C3 page visibility hide-show foundation |
| `25f1375` | **R16C3** — Page visibility hide-show foundation; `visible_to_customer` toggle; hidden indicators + contractor banner; hidden pages remain in Builder nav; lifecycle still locked |
| `e6e6b78` | **Docs** — Checkpoint after R16C2 document token picker in R16B editor |
| `0cf76d2` | **R16C2** — Registry-driven document token picker in R16B editor; Insert field menu; raw `{{token}}` insert only; R14 merge preview unchanged; lifecycle still locked |
| `7530433` | **Docs** — Checkpoint after R16C1 builder strip overflow navigation |
| `967f0de` | **R16C1** — Builder strip overflow page navigation; More pages menu; overflow pages navigate by persisted `page.id`; portal menu fix; dirty-edit guard preserved; lifecycle still locked |
| `589f5a0` | **R16B** — Draft body page authoring foundation; `proposalPageContentEditing` + `updateDraftProposalPageContent`; Builder Edit/Save/Cancel; Estimate filters to line_items/upgrade_group only on persisted path; lifecycle still locked |
| `e5dd2fb` | **Docs** — Checkpoint after R16A builder chrome and document IA separation |
| `18cebca` | **R16A** — Separate Builder chrome from customer document IA; pure `proposalBuilderDocumentIa`; customer-logical page strip; workspace header; Estimate canvas banner removed; lifecycle still locked |
| `ead672f` | **Docs** — Checkpoint after R14 read-only body page token merge |
| `f359ad4` | **R14** — Display-time token merge for read-only body pages; `proposalDocumentBodyRenderer` + Builder wiring; frozen `proposalDocumentContext` + R13 resolver only; stored `body_markdown` unchanged |
| `1921b0a` | **Docs** — Checkpoint after R15 read-only branded proposal cover |
| `ab5a400` | **R15** — Read-only branded Cover tab/page in Proposal Builder; `proposalCoverViewModel` + `ProposalBuilderCoverPage`; frozen `proposalDocumentContext` + R13 resolver only; address dedupe; Cover nav enabled for persisted proposal path |
| `b294226` | **Docs** — Checkpoint after R13 document token foundation |
| `e40db30` | **R13** — Frozen document token registry + `ProposalDocumentContext` + pure resolver; adapter exposes `proposalDocumentContext` DTO (read-only; no markdown merge) |
| `89ef2ba` | **Docs** — Checkpoint after R12 customer identity context echo |
| `31059e3` | **R12** — Stamp DB-truth customer identity into `proposal_versions.context_echo` at draft create; adapter `proposalCustomerContext` DTO (read-only; no Builder customer display) |
| `f4d9874` | **Docs** — Checkpoint after R11c company branding context echo |
| `29722a0` | **R11c** — Stamp company core + branding into `proposal_versions.context_echo` at draft create; adapter `proposalCompanyContext` DTO (read-only; no Builder cover UI) |
| `9d57a82` | **Docs** — Checkpoint after R11b company branding settings |
| `139e8a3` | **R11b** — Company branding Settings workspace on `/tools/settings` (FieldDive shell, single client draft/save path, DB-truth persistence, merge/regressive-draft guards) |
| `097d25e` | **R11b** — `company_branding_profiles` migration SQL + store foundation |
| `0146dac` | **R11a** — Company branding profile pure helpers + tests (no UI) |
| `67832c7` | **Docs** — Checkpoint after R10 — R0–R10 complete, next R11 audit |
| `e33e659` | **R10b** — Templates Workspace Structure & estimate settings UI on `/tools/roofing/templates` |
| `bc42b1e` | **R10a** — Pure structure/settings helpers + tests (view model, mutation planners, estimate metadata) |
| `0106f9f` | **Docs** — Checkpoint before R10 — R0–R9 and audit complete |
| `d0ba188` | **Pre-R10 P1** — Job Card proposal truth alignment: header CTA gates match checklist/pricing; post-create job refresh; draft-connected Proposals tab UI; Create vs Open labels (§6AP) |
| `1191ddd` | **R8** — Light Jobs Board identity correction (§6AN) |
| `05b9c54` | **R7** — Light global IA nav correction (§6AM) |
| `3c6214c` | **R6** — Template content editor save wiring (per-section `body_markdown`) |
| `ffc1cc0` | **R5** — Template Workspace shell on `/tools/roofing/templates` |
| `9db2030` | **R4** — Template content editor view-model (`buildTemplateContentEditorViewModel`) |
| `5927ab5` | **Docs** — R3 Proposals hub ownership map (§6AO) |
| `2e1c36b` | **Docs** — R2 Jobs Board saved identity map (§6AN) |
| `b70cdd7` | **Docs** — R1 global IA module ownership map (§6AM) |
| `f1dba95` | **Docs** — R0 RoofrExact recovery playbook (§6AL) |
| `8c04c2a` | **3J4H** — Add template content editing helper (`proposalTemplateContentEditing.ts`) |
| `40e5f5b` | **Docs** — Correct proposal content IA after Roofr audit (§6AK) |
| `ce7aa39` | **3J4G** — Improve fallback seed copy in `defaultRoofingProposalTemplates.ts` (§6AK) |
| `57108bd` | **Docs** — Align handoff on proposal content architecture (§6AK initial) |
| `72768ae` | **3J4E** — Package/options detail surface: selected-package summary, grouped "Details to complete later", Change Package card comparison (§6AI) |
| `c42a559` | **3J4D** — Estimate readability: line row hierarchy, default-closed "Line details" disclosures, section spacing (§6AH) |
| `7bda418` | **Docs** — Update handoff after 3J4C document-first Builder |
| `f8bffde` | **3J4C** — Document-first Proposal Builder: Estimate renders inline document (package selector, blocker banner, sections, line items, totals); Proposal Helper inspector rail; removed Overview panel + workspace tabs; `proposalBuilderGuidance.ts` + tests (§6AG) |
| `4c9a77d` | **3J4A** — Builder final-surface navigation checkpoint (page context strip, document page model) |
| `0763799` | **Docs** — Record passed DB-first smoke gate |
| `ce3d6bc` | **Pricing trust hardening** — No mixed truth in persisted Builder path; `proposalStaleness` stale detection; amber stale banner + Refresh draft pricing wired; `refreshDraftPricing` re-stamps `context_echo` measurement id/display; golden tests (§6AF) |
| `e96aaab` | **Docs** — Update handoff after 3J3E option persistence (§6AE) |
| `a7249b3` | **3J3E** — Persist Builder option selection to DB draft via `updateDraftSelectedOption`; template↔runtime option id mapping; optimistic UI + revert on failure (§6AE) |
| `4f24f1f` | **Test** — `proposalQuantityResolver.test.ts` (32 tests); closes top pricing-foundation quantity-bridge gap; test-only |
| `3b5138a` | **Docs** — Record DB-first foundation Phases A–D (§6AD) |
| `87be1b4` | **Phase D** — Test lock: `validateProposalDraftGraphForJob` rejects wrong job, non-draft, zero options; invalid `proposal=` cannot become valid persisted draft (§6AD) |
| `e1a8f7c` | **Phase C** — Enforce DB `job=` as main Job Card identity; clear `currentLoadedSavedId` on clean routes; legacy session cannot bleed into DB job card (§6AD) |
| `a62ad93` | **Phase B** — Partition DB jobs from legacy saved estimates on Job Board; primary kanban = DB jobs; legacy section labeled separately (§6AD) |
| `2694bc4` | **Phase A** — Sparse measurement update mapper; partial saves no longer wipe `quantity_map` / line fields / proposal context; write `jobs.selected_measurement_id` after save (§6AD) |
| `0649e04` | **Phase A** — Sparse job update via `jobDraftToInsertRow`; `updateJob({ customer_id })` no longer wipes customer/contact/address fields (§6AD) |
| `e38b276` | **3J3D** — Builder reads persisted draft via `getDraftGraph` + `proposalDraftGraphAdapter`; error banner on invalid/wrong-job draft; live preview unchanged without `proposal=` (§6AC) |
| `1915b2d` | **3J3C** — Job Card **+ Proposal** create/reuse draft via `resolveOrCreateProposalDraftEntry` + `createDraftProposal`; navigate with `?proposal=` (§6AC) |
| `fc43849` | **3J3B** — Read-only active draft detection; `buildProposalBuilderHref(jobId, proposalId?)` (§6AC) |
| `b24275b` | docs: record 3J2 proposal persistence spine (§6AB) |
| `13b4e72` | **3J2B3** — `proposalRecordStore` + mocked tests; first DB-writing proposal lib layer (§6AB) |
| `213e322` | **3J2B2** — Pure `proposalSnapshotBuilder` + tests; row-shape assembly only |
| `1033cd9` | **3J2B1** — `proposalSnapshotStatusMapper` + customer-safe/configured-policy guards |
| `5b9fe19` | docs: record 3J1C proposal records migration apply in production (§6AA) |
| `7b23415` | **3J1B** — Harden proposal records before apply (007 migration) |
| `387993e` | **3J1A** — Proposal records schema migration (006) |
| `3ae5e39` | **3J0** — Proposal architecture types (§6Z) |
| `fbdedbe` | **3I-3D1** — Builder right rail regrouped: Setup readiness + Pricing confidence; guardrail row; compact rail (§6V) |
| `aa0073a` | **3I-3D0** — Builder rail pricing-confidence grouping spec (§6U) |
| `79c4b02` | **3I-3B3c** — Builder wired to `getResolvedCompanyPricingPolicy`; configured path passes real company `policy` into orchestrator; missing/loading/error keeps placeholder fallback; conditional banner/copy + status-only rail row (§6Q) |
| `003e00b` | **3I-3B3b** — Company pricing policy settings UI at `/tools/settings/pricing` (§6P) |
| `630d278` | docs: record 3I-3B3a manual migration apply (§6O) |
| `b5bbc7f` | **3I-3B2B** — Company pricing policy store (`companyPricingPolicyStore.ts`) |
| `76b87b8` | **3I-3B2A** — `company_pricing_policies` migration SQL |
| `c1b52ee` | **3I-3B1** — Pure company pricing policy resolver (§6M) |
| `637b85a` | **3I-2C** — Builder pricing status surfaces: option tabs show **Complete / Incomplete** only; right rail **Pricing** block (status, blocking count, guardrail word); no dollars; no document UI changes |
| `f5bbd84` | **3I-2B** — Customer document pricing preview UI: line prices/statuses + totals footer + persistent preview banner in document canvas only; `formatPriceCents` in Builder constants (not orchestrator) |
| `5626c47` | **3I-2A** — Pure Builder pricing preview orchestrator: `proposalBuilderPricingPreview.ts` + 9 tests; 3H-3 → mapper → engine → customer/status DTO |
| `8f12db2` | docs: post-3I-1 audit + Opus-corrected 3I-2 guardrails (§6J) |
| `117859a` | docs: update handoff after 3I-1 pricing foundation |
| `52b7148` | **3I-1B** — Pure pricing input mapper: `proposalPricingInputMapper.ts` + 16 mapper tests; template graph + catalog + 3H-3 quantity → `ProposalPricingInput`; no UI, no persistence |
| `d67910d` | **3I-1C** — Proposal pricing engine tests: 22 programmatic cases in `proposalPricingEngine.test.ts` |
| `1ddee44` | **3I-1A.1** — Harden engine inputs: negative quantity, negative profitability, negative fixed discount |
| `162f9be` | **3I-1A** — Pure proposal pricing engine: `proposalPricingEngine.ts`; `resolveProposalPricing` + guardrails; consumes `ProposalPricingInput` only |
| `ac589d8` | docs: close 3I1 pricing engine decisions (§6H) |
| `6f9cbe1` | **3I-0** — Proposal pricing type contract: `proposalPricingTypes.ts`; policy/input/output/guardrail types; function signatures only |
| `40e6720` | **3H-3** — Read-only proposal quantity preview: pure `proposalQuantityResolver.ts`; Builder line rows show Qty / Source / Rule / Status; no totals, no qty × price, no persistence |
| `a522ea8` | docs: update handoff after 3H-2 proposal preview |
| `00fbf64` | **3H-2** — Read-only Proposal Builder preview: document-style canvas, option pills, section/line preview; `proposalBuilderPreview.ts` + Builder UI components; no persistence/pricing/totals |
| `ae97a6b` | docs: update handoff after packet session bleed fix |
| `c12ea4d` | **Packet Job Card session bleed fix** — stale saved-estimate session no longer overrides packet-created Job Card; board-origin gating for estimate→job link and hydration |
| `d4b4f25` | docs: update handoff after pre-3H-2 source-of-truth fix |
| `abd718d` | **Pre-3H-2 source-of-truth** — Activity rail uses Builder readiness; fresh packet intake reset; Job Card `?job=` identity from persisted `JobRecord` |
| `cf3706f` | docs: update handoff after packet fix and 3H-1 |
| `feec663` | **3H-1** — Proposal Builder shell and gates: `/tools/roofing/proposals/builder?job=<uuid>`, composite readiness, Job Card `+ Proposal` launch when gates pass |
| `fd87152` | **Packet handoff fix** — stale `currentJobId` cleared on fresh packet; Continue gated; create-only from packet (no stale job reopen) |
| `b78c9ee` | **3G6E** — passive Job Card Proposals tab → Templates setup link (`JobCardProposalsSetupLinks.tsx`); stale catalog next-step copy fixed |
| `29ca190` | **3G6D3** — align catalog workspace surface (Catalog D2) |
| `227061c` | **3G6D2** — align templates workspace surface (Templates D2) |
| `1d8e849` | **3G6D** — add proposal template readiness (`proposalTemplateReadiness.ts`) |
| `bd2ed04` | **3G6C** — wire starter template install and recheck |
| `3f7b3ff` | **3G6B** — add templates setup catalog gate |
| `15ad732` | **3G6A** — add proposal templates setup route |
| `5824a3a` | docs checkpoint after 3F9C Job Card WIP |
| `0015be1` | **3F9C** — Roofr Job Card architecture and visual shell |
| `b27a444` | **3F9B4** — RoofrExact Job Board visual and controls checkpoint |

---

## 1. STRICT MODE / NO DRIFT RULES

- **Do not guess.** Inspect the repo and running behavior before changing code.
- **Always inspect current repo state** before code changes:
  - `git status --short`
  - `git log --oneline -12` (or `-15` before larger work)
- **Ask for generous surrounding code** when a change touches protected or monolithic files.
- **Use exact current code only** — match naming, patterns, and file boundaries already in the tree.
- **Make surgical changes** — smallest diff that solves the scoped stage; no drive-by refactors.
- **One Cursor-ready prompt at a time** — finish and verify one stage before stacking the next.
- **Protect** pricing, payments, approval, status, saved estimates, send/PDF (see §9).
- **AI must not touch pricing truth** — no “helpful” pricing math in catalog, measurement, or handoff modules.
- **Do not enable** proposal builder, create-proposal flows, payment capture, or status pipeline changes casually.
- **Best long-term architecture beats the easiest shortcut** — e.g. company catalog setup in FieldDive app shell, not hidden per-job auto-install.

### Full-surface product safety audits (stage-close standard)

When closing a stage that touches **Settings**, **shell**, **persistence**, **proposal truth**, **pricing**, **Templates**, or **Builder**, run a **full-surface product safety audit** — **not** a drift-only check.

**Must verify:**

- Route load / crash / stuck loading / blank pages
- Save / load / reload / hard refresh / auth hydration
- DB truth vs cache vs UI draft (no silent data loss)
- Auth / RLS / failure messaging (no misleading success)
- Source-of-truth per domain (no mixed old/new logic on the same page)
- Protected-system regression (pricing math, snapshots, Builder lifecycle locks, Job Card gates, Templates, Jobs Board)
- Visual / UX fit with FieldDive shell (not off-brand standalone screens)
- Bad-path behavior: unauthenticated user, partial save failure, invalid inputs, double-click save, browser back/forward

**Passing helper/unit tests alone is not sufficient** for stage-close sign-off. Manual smoke on critical user paths is required when the stage touches visible forms or persistence.

**Do not** use Supabase service-role terminal scripts in Cursor for routine audits or smoke.

**Branded cover/display stages (R15+):** When work renders company branding on the cover or customer-facing proposal surface, the stage-close audit **must include an explicit browser visual check** of that surface. **R11c context_echo stamping alone does not require** visible branding in Builder. **R12 customer identity stamping alone does not require** visible customer display in Builder.

### Playwright MCP / browser testing guardrail (test-only audits)

- **Playwright MCP is allowed** for **test-only** browser audits — route load, workflow smoke, visual inspection.
- Browser testing during audits **must not edit files** or fix as it goes.
- **If Playwright has no auth session**, Cursor must report protected routes as **unauthenticated** (redirect to `/login`) and **must not claim** protected workflows were verified.
- **Route 200 / login-shell load is not full workflow verification** — proposal flow requires authenticated session.
- Future authenticated browser audits should use a **logged-in session or Playwright `storageState`** — **do not add secrets to the repo**.
- **Configured local auth (R12 close):** outside-repo `storageState` at `C:\Users\sabre\.cursor\fielddive-playwright-auth.json` — session expiry requires normal login and re-save; no repo auth/session files. **Do not use** `C:\Users\sabre.cursor\...` (missing `.` before `cursor`) — common typo.
- When Playwright auth is missing, cite **unit/integration tests** for `context_echo` stamping proof and note **user manual smoke** if reported separately.

### No-drift warnings (catalog / proposal spine)

- **Mandatory recovery order:** **§6AL** — do not fix downstream features before upstream IA/module docs (R1–R3).
- **Catalog is a first-class FieldDive route** — canonical `/tools/roofing/catalog` in `FieldDiveAppShell`; not hidden dark admin UI.
- **`/admin/catalog` redirects** to `/tools/roofing/catalog` (alias only).
- **Job Card** should later show readiness / link to Catalog setup — **Job Card must not become the catalog editor**.
- **Do not** route back to Manual Estimate as the active path.
- **Do not** use `service_items` as the new catalog truth without an explicit migration plan.
- **Do not** wire `catalog_items` into estimator pricing too early — pricing bridge must be **deterministic** and deliberate.
- **Templates come after catalog setup** — template install depends on catalog `metadata.seed_key` rows being available.
- **Proposal Builder shell (3H-1) exists** — read-only, gated; **3H-2** adds read-only line/option preview; **3H-3** adds read-only quantity preview on Builder line rows — **no** pricing bridge, persistence, or send/PDF yet. Do not enable customer-send or proposal records without explicit scope.
- **Do not** add AI pricing.
- **Do not** auto-install catalog rows from Job Card.
- **Do not** auto-install proposal templates from Job Card.
- **Do not** overwrite user-modified template rows — install helpers are insert-only (seed_key dedupe).
- **Do not** create proposal records / line snapshots until Proposal Builder is deliberately scoped.
- **Do not** create PDF / send / approval bridges before proposal records exist.
- **Do not** touch payment / status / approval while working catalog or template setup (unless the stage explicitly scopes it).
- **Do not treat table/store existence as product completion** — audit **architecture, functionality, layout, and UI** together before advancing the spine.
- **3G6 Templates setup surface is complete** (3G6A–E + D2/D3) — **3H-1 Proposal Builder shell** (`feec663`); **3H-2 read-only proposal preview** (`00fbf64`); **3H-3 read-only quantity preview** (`40e6720`); **3I-1 pure pricing engine + input mapper** (`162f9be`–`52b7148`); **3I-2 read-only Builder pricing preview** (`5626c47`–`637b85a`) — **wired from Builder route only** via orchestrator; **3I-3** company policy resolver **done**; **3J2** lib persistence spine **done** (`13b4e72`, §6AB); **3J3** Job Card → persisted Builder draft flow **done** (`e38b276`, §6AC); **DB-first foundation Phases A–D done** (`87be1b4`, §6AD); **3J3E** option selection persistence **done** (`a7249b3`, §6AE); **Pricing trust hardening done** (`ce3d6bc`, §6AF); **3J4C document-first Builder done** (`f8bffde`, §6AG); **3J4D estimate readability done** (`c42a559`, §6AH); **3J4E package/options surface done** (`72768ae`, §6AI); **3J4F customer text pages done** (`bfa0454`, §6AJ) — **do not revert** to Overview/workspace-tab workbench; **3K** (PDF/send adapters) remains later; do not enable Preview/Send/Sign/Payment without explicit scope.
- **Do not casually patch pricing** during catalog/template/Job Card link work — see **§11 — Pricing (protected + future redesign)**.

---

## 2. PRODUCT NORTH STAR

**FieldDive / TradeTools AI** is an **AI-powered contractor operating system / back office**, starting with roofing.

It is **not**:

- Just a roofing calculator
- An Angi-style lead marketplace

**Core workflow (target spine):**

```
Job / Job Card
  → Measurements
  → Catalog / Price Book
  → Proposal Templates
  → Proposal Builder
  → Signed Proposal
  → Material Orders / Work Orders / Invoices / Job Costing (later)
```

**Manual Estimate** is inactive (`?entry=manual&legacy=1` legacy path remains in repo — not canonical). **Proposal templates** have a **live FieldDive route** (`/tools/roofing/templates`) with install/recheck UI. **Proposal Builder (3H-1 shell + 3H-2 preview + 3H-3 quantity preview)** exists at `/tools/roofing/proposals/builder?job=<uuid>` — read-only, gated; shows document-style template preview with resolved quantities when gates pass; not a sendable customer proposal yet.

---

## 3. ROOFR-STYLE RESEARCH-BACKED PATH

Public Roofr-style training/help indicates:

- **Catalog** = library of job items (materials, labor, services/resources) used across proposals and material orders.
- Users can add items manually, import systems, or bulk CSV — catalog is **account/company setup**, not a one-off per job side effect.
- **Proposals** combine **measurements**, **catalog items**, and **templates**.
- **Material orders** follow signed proposals.

**Therefore FieldDive implementation order:**

```
Measurement Records (public.measurement_records)
  → Catalog Items (public.catalog_items)
  → Proposal Templates (tables + store + defaults + install helper — **3G6 DONE**)
  → Proposal Builder (**3H-1 shell DONE** — **3H-2 read-only preview DONE** — **3H-3 quantity preview DONE** — persistence / pricing bridge later)
  → Proposal output / PDF / send (protected legacy paths today)
  → Material / order operations (later)
```

Do **not** skip catalog + templates and jump to Proposal Builder or pricing bridge.

### ROOFR / RESEARCH-BASED IMPLEMENTATION STANDARD

FieldDive should follow a **proven contractor workflow**, with **Roofr-style structure and visual behavior** as the primary reference where applicable.

Every meaningful **visual, navigation, workflow, or module-placement** change must be checked against the research docs **before** implementation:

- Read **`docs/competitive-architecture-audit.md`** before changing module architecture, dashboard behavior, proposal workflow layout, or competitor-aligned surfaces.
- Read **`docs/fielddive-flow-map.md`** before changing routes, IA, Job Board, Job Card, setup flows, navigation, or module movement.
- Read **`docs/fielddive-estimate-proposal-flow-model.md`** before changing estimate/proposal lifecycle, proposal Builder, draft refresh behavior, proposal records, send/sign/payment gates, or proposal state.
- Read **`docs/fielddive-feature-placement-map.md`** before adding, moving, or removing a feature from a module.

**Visual direction:**

- Get as close to **Roofr-style clarity, hierarchy, spacing, and workflow** as possible without copying branding.
- Do **not** make FieldDive slower, bulkier, or visually heavier just to add polish.
- Prefer **clean, proven, contractor-friendly flows** over experimental UX.
- Avoid boxes-inside-boxes, wasted space, duplicate panels, and visual clutter.
- Keep the app **fast, clear, and mobile-aware**.
- Do **not** leave important Roofr/proven workflow features out; place them in the **correct phase/module** if they are not ready yet.
- Do **not** add features randomly. Every feature must belong to the **DB-first** job → measurement → proposal → approval → payment → production spine or a clearly documented **later** module.
- Visual changes must **not** weaken DB identity, pricing trust, proposal snapshot trust, or lifecycle gates.

**Roofr-aligned product principle (3J4F+):**

We are **copying Roofr’s proven proposal flow/system shape first**, then improving only where it makes sense for the **exact page/workflow** being worked on.

Do **not** treat “improve” as always adding trust/readiness intelligence. Improvements must be **contextual**:

| Workflow moment | Appropriate improvement focus |
|-----------------|------------------------------|
| **Estimate** | Readability, option clarity, pricing/page hierarchy |
| **Package/options** | Customer comparison and differentiators |
| **Text pages** | Customer-facing document content quality |
| **Photos/cover** | Media/storytelling — **only when media dependencies exist** |
| **Send/sign/PDF** | Lifecycle — **only when snapshot/record/customer-document path is ready** |
| **Trust/readiness** | Only where it supports the specific user moment — not as default polish |

**Builder-specific rule (3J4C–3J4F — document-first):**

- **Do not reintroduce** the old workbench/tab-first Builder (Overview tab, workspace tabs as primary flow, diagnostic-dashboard rail).
- **Estimate page is the document** — package selector, blocker banner, sections, line items, and totals render **inline** on the Estimate canvas (§6AG).
- **Text pages are customer document pages** — Terms, Warranty, Project Overview, custom_text render read-only persisted `body_markdown` when present; calm empty states when missing (§6AJ).
- **Line details collapsed by default** — Source / Rule / Unit / Role / resolved quantity status in per-row "Line details" disclosures, not inline on customer-facing rows (§6AH).
- **Package/options inside Estimate** — selected-package summary + Change package / View details; no separate options workbench (§6AI).
- **Right rail is Proposal Helper / contextual inspector** — Next Action + Pricing Readiness visible; Setup Readiness, Guided Path, About This Proposal **collapsed by default**.
- **Page strip is document navigation** — Cover, Estimate, Terms, Warranty, Project Overview, Project Photos; **Preview / Send / Sign / Payment only in header** (disabled until 3K+).
- **Cover / Photos / Add Page / Preview / PDF remain locked** until their dependencies are ready — no fake media upload, page editing, or lifecycle enablement.
- Quantities remain **trust-safe / read-only** unless a later scoped edit flow is approved.
- **Preview / Send / Sign / Payment remain disabled** until their lifecycle phases.

**Smoke gate:** **PASSED** manually (recorded after docs `3ec6f42`). Full pass: **§6AE.5** → **§6AF.9** → **§6AD.7**. **NEXT** proposal draft slice is open when explicitly scoped — see **§11 Roadmap buckets — NEXT**.

---

## 4. COMPLETED MEASUREMENT STAGE 3E

| Commit | Summary |
|--------|---------|
| `6d34895` | Add measurement store foundation — `measurementStore.ts`, types, migration `measurement_records` |
| `abd91cd` | Read selected measurement on Job Card — `getSelectedMeasurementForJob`, display |
| `8368798` | Persist manual measurement from Job Card — save/update manual rows |
| `a245ef4` | Polish measurement readiness on Job Card — `measurementReadiness.ts`, labels, blockers |
| `6dfb7cd` | Add measurement report path shell on Job Card — passive report path UI |
| `34c047e` | Add measurement proposal handoff on Job Card — `measurementProposalHandoff.ts`, passive proposal input |

### Current measurement state

- Job Card can **save/update** selected **manual** `measurement_records` (blocks overwrite of non-manual/provider rows).
- Job Card **reads** selected measurement by `job_id`.
- Manual measurement workspace exists **inside Job Card** (`entry=job-card`).
- Readiness/status truth is centralized in `measurementReadiness.ts`.
- Report/provider/photo path shell exists but is **passive** (actions disabled).
- Measurement → Proposal handoff is **passive** (quantities/readiness display only).
- **Proposal buttons remain disabled** on Job Card.
- **No** pricing / payment / approval / status / send / PDF logic was changed in 3E.

**Key files:** `app/lib/measurementTypes.ts`, `app/lib/measurementStore.ts`, `app/lib/measurementReadiness.ts`, `app/lib/measurementProposalHandoff.ts`, Job Card sections in `app/tools/roofing/RoofingClient.tsx`.

---

## 5. COMPLETED CATALOG STAGE 3F (THROUGH SHELL ALIGNMENT)

| Commit | Summary |
|--------|---------|
| `d2e7dd0` | Add catalog type foundation — `catalogTypes.ts` |
| `81b8f03` | Add catalog_items table foundation — migration `20260531_003_create_catalog_items.sql` |
| `df82fba` | Add catalog store foundation — `catalogStore.ts` |
| `60e9f46` | Add default roofing catalog definitions — `defaultRoofingCatalog.ts` (13 passive items) |
| `c9f3fbe` | Add passive Job Card catalog readiness UI — `catalogReadiness.ts`, read-only counts on Job Card |
| `506c52b` | Add default roofing catalog install helper — `defaultRoofingCatalogInstall.ts` |
| `1202605` | Add admin catalog starter install UI — `/admin/catalog`, `CatalogAdminClient.tsx`, nav links |
| `a62addb` | Add admin catalog starter install UI — polish: `AdminNavLinks`, **Recheck starter catalog** (idempotent), admin nav on catalog / price-book / customers |
| `6b37370` | **Stage 3F7A** — Show installed catalog items in admin (read-only table in `CatalogAdminClient.tsx`) |
| `81a70e3` | **Stage 3F7B** — Add catalog item pricing editor in admin (`CatalogAdminClient.tsx`) |
| `01e2d9e` | **Catalog route/shell alignment** — canonical `/tools/roofing/catalog`, FieldDive shell, light UI, wider table |

### Stage 3F7A complete — read-only installed catalog list

- **Commit:** `6b37370`
- **Changed only:** `app/admin/catalog/CatalogAdminClient.tsx`
- Added read-only **Installed catalog items** section (uses existing active `items` state from `getActiveCatalogItemsByCompany`)
- Displays: name, customer name, type, unit, quantity source, unit price/cost (**Unpriced** when null), active, `metadata.seed_key`, sort order
- **No** edit/save/`updateCatalogItem` calls added
- Protected systems untouched

### Stage 3F7B complete — catalog item pricing / config editor

- **Commit:** `81a70e3`
- **Changed only:** `app/admin/catalog/CatalogAdminClient.tsx`
- Row-expanded editor (Edit/Close), read-only identity summary, Save item / Cancel
- **Editable:** `customer_name`, `description`, `unit_price_cents`, `unit_cost_cents`, `labor_unit_cost_cents` (labor rows only), `pricing_basis`, `customer_visibility`, `sort_order`
- **Deferred:** `active` toggle, structural fields (`name`, `item_type`, `unit`, `quantity_source`), `metadata`/seed_key, create/delete
- Empty dollar inputs save as **null**, not zero; invalid/negative blocked
- **No** pricing bridge, templates, or Proposal Builder
- Protected systems untouched

### Catalog route + shell alignment complete

- **Commit:** `01e2d9e`
- **Canonical route:** `/tools/roofing/catalog`
- **New files:** `app/tools/roofing/catalog/page.tsx`, `app/tools/roofing/catalog/CatalogAppPage.tsx`
- Renders `CatalogAdminClient` inside **`FieldDiveAppShell`** with `showAdminNav={false}`
- Sidebar **Catalog** → `/tools/roofing/catalog`; `activeNav="catalog"` supported
- **`/admin/catalog`** → redirect to `/tools/roofing/catalog`
- `SavedClient` quick action href → `/tools/roofing/catalog`
- Catalog UI restyled: dark admin → light FieldDive / Job Card shell; wider table layout for readability
- **3F7B editor behavior preserved**; protected systems untouched

### Roadmap position (catalog spine)

Catalog stages through **3F7B** and shell alignment (`01e2d9e`) are complete. See **§6** for full spine including proposal templates (3G1–3G5).

### Current catalog state

- `public.catalog_items` table exists; migration **applied** in Supabase.
- `catalogStore.ts` — company-scoped CRUD; **`updateCatalogItem` used by admin catalog UI** for 3F7B fields only.
- `defaultRoofingCatalog.ts` — 13 starter definitions with `metadata.seed_key`.
- `installDefaultRoofingCatalog(companyId)` — insert-only, dedupe by `seed_key`; **not** auto-run on page load.
- **`/tools/roofing/catalog`** — canonical catalog **product workspace** (**3G6D3 / Catalog D2**): starter roofing catalog hero, compact setup checklist, **catalog items table primary**, inline install feedback, muted “Later” footnote; orchestrated by `CatalogSetupClient` + shared table/detail components. **Removed** dashboard-style sections: `CatalogSetupHub`, `CatalogReadinessTiles`, `CatalogSetupGuide`, `CatalogRoadmapCards`, `CatalogQuickActions`.
- **`/admin/catalog`** — redirect only to `/tools/roofing/catalog`.
- Starter catalog **installed successfully** in dev (verified): **13** rows typical when seeded.
- **`service_items`** and legacy **`/admin/price-book`** unchanged (`PriceBookAdminClient` → `service_items` only).
- Job Card **catalog readiness** reads `getActiveCatalogItemsByCompany` — display only; **not** a catalog/template editor on Job Card.
- **3G6E (Proposals tab):** catalog not ready → **Open catalog setup** → `/tools/roofing/catalog`; `ready_for_templates` → **Open proposal templates** → `/tools/roofing/templates` (`JobCardProposalsSetupLinks.tsx`). Overview unchanged (catalog link when not ready only).
- **+ Proposal (3H-1):** enabled only when composite Builder gates pass (job + measurement + catalog + template); navigates to `/tools/roofing/proposals/builder?job=<uuid>`; **no proposal record created**. Disabled otherwise with gate-specific `title`. Template row: **Not selected**. **No** `installDefaultRoofingProposalTemplates` or template install from Job Card.
- **Activity rail (pre-3H-2 `abd718d`):** proposal timeline copy uses `resolveJobCardProposalActivityLine` / `proposalBuilderReadiness` — aligned with `+ Proposal` gate state; does not imply Send/PDF/Payment/pricing is live.
- **Proposal Builder (3H-1 + 3H-2 + 3H-3):** route, gates, read-only context loads, document-style option/section/line preview with quantity preview (`40e6720`); **no** pricing bridge, persistence, or PDF/send integration yet.
- **No pricing bridge** from `catalog_items` to estimator `useMemo` yet.

**Key files:** `app/lib/catalogTypes.ts`, `app/lib/catalogStore.ts`, `app/lib/defaultRoofingCatalog.ts`, `app/lib/defaultRoofingCatalogInstall.ts`, `app/lib/catalogReadiness.ts`, `app/tools/roofing/catalog/CatalogSetupClient.tsx`, `app/tools/roofing/catalog/*` (workspace components), `app/admin/catalog/catalogAdminConstants.ts`, `app/admin/catalog/catalogAdminUtils.ts`, `app/admin/catalog/components/*` (table, toolbar, detail panel), `app/admin/catalog/CatalogAdminClient.tsx` (thin wrapper), `app/tools/roofing/jobCard/JobCardProposalsSetupLinks.tsx`, `app/tools/roofing/FieldDiveAppShell.tsx`.

---

## 6. COMPLETED PROPOSAL TEMPLATE STAGE 3G (THROUGH INSTALL HELPER)

| Commit | Summary |
|--------|---------|
| `d1a205b` | **3G1** — Proposal template type foundation — `proposalTemplateTypes.ts` |
| `c825942` | **3G2** — Proposal template tables foundation — migration `20260531_004_create_proposal_template_tables.sql` |
| `03d9793` | **3G3** — Proposal template store foundation — `proposalTemplateStore.ts` |
| `201ada1` | **3G4** — Default roofing proposal template definitions — `defaultRoofingProposalTemplates.ts` |
| `07b3c1d` | **3G5** — Default roofing proposal template install helper — `defaultRoofingProposalTemplateInstall.ts` |

### Stage 3G1 complete — Proposal Template type foundation

- **Commit:** `d1a205b`
- **Added only:** `app/lib/proposalTemplateTypes.ts`
- Pure TypeScript type foundation (Roofr-style proposal template contracts):
  - `ProposalTemplate`, `ProposalTemplateOption`, `ProposalTemplateSection`, `ProposalTemplateItem`
  - `TemplateQuantityRule`, drafts, summaries, readiness, default-definition shapes
  - Readonly arrays and label helpers
- **No** React / Supabase / DB / app imports
- **No** pricing, PDF/send, approval, payment, status, Proposal Builder, or UI wiring
- Protected systems untouched

### Stage 3G2 complete — Proposal template tables foundation

- **Commit:** `c825942`
- **Added only:** `supabase/migrations/20260531_004_create_proposal_template_tables.sql`
- Normalized four-table schema:
  - `proposal_templates`
  - `proposal_template_options`
  - `proposal_template_sections`
  - `proposal_template_items`
- Company scoping, RLS (16 policies), constraints/checks, indexes, `set_updated_at` triggers, rollback notes
- Additive `catalog_items_id_company_unique` for company-safe catalog item composite FK
- **Excludes:** proposal records, snapshots, pricing totals/overrides, send/PDF/approval/payment/status, material/work orders, invoices, `jobs.active_proposal_id`, `service_items`, app/store/UI wiring
- **Applied live in Supabase** (verified):
  - `tables_found` = 4
  - all four template table row counts = 0 at verify time
  - `rls_enabled_count` = 4
  - `policy_count` = 16
  - `trigger_count` = 4
  - `key_constraint_count` = 2 (verification query scope)

### Stage 3G3 complete — Proposal template store foundation

- **Commit:** `03d9793`
- **Added only:** `app/lib/proposalTemplateStore.ts`
- **Not wired/imported by app code yet**
- Row types, select constants, pure helpers, mappers, draft/patch mappers
- Company-scoped read/write helpers; normalized `ProposalTemplateGraph` loading
- Mirrors `catalogStore`: `getSupabaseClient`, `[proposalTemplateStore]` logging, `null`/`[]` on failure, explicit `companyId` scoping
- **No** `catalogStore` import; **no** UI/routes/SQL/deletes
- Protected systems untouched

### Stage 3G4 complete — Default roofing proposal template definitions

- **Commit:** `201ada1`
- **Added only:** `app/lib/defaultRoofingProposalTemplates.ts`
- Passive definitions only — **no** Supabase/store calls
- One Roofr-style **Roof replacement** starter template (`metadata.seed_key`: `proposal.roof_replacement`)
- Three customer-facing options: **Standard** (default), **Enhanced**, **Premium** — `selection_mode: single`
- Six sections per option: overview, line_items, upgrades, scope_notes, warranty, terms
- Shared **13** starter catalog `catalog_seed_key` core line items; optional add-ons reuse existing catalog seeds only
- Generic non-legal placeholder text for text/warranty/terms sections
- **No** install helper, UI, routes, pricing, Proposal Builder, or SQL in this stage
- Protected systems untouched

### Stage 3G5 complete — Default roofing proposal template install helper

- **Commit:** `07b3c1d`
- **Added only:** `app/lib/defaultRoofingProposalTemplateInstall.ts`
- **`installDefaultRoofingProposalTemplates(companyId)`** — **not wired/imported by app code yet**
- Installs default definitions in FK order: template → options → sections → items
- Resolves `catalog_seed_key` → `catalog_item_id` via read-only `getCatalogItemsByCompany`
- Dedupes by `metadata.seed_key` (synthesized item seed keys: `{sectionSeedKey}.item.{catalog_seed_key}.{item_role}`)
- **Insert-only**, idempotent, safe to rerun; backfills missing child rows on partial installs
- Skips unresolved catalog-backed items; records `missingCatalogSeedKeys`
- **Never** updates, deletes, or overwrites user-modified template rows
- **Does not** call `installDefaultRoofingCatalog` — catalog install remains a separate explicit setup step
- **No SQL** run in repo for this stage; **no** UI/routes/app wiring
- Protected systems untouched

### Roadmap position (full spine through 3G5)

**Completed:**

- Measurement Records / Job Card measurement truth (Stage 3E)
- Catalog foundation (types, migration, store, default definitions)
- Starter catalog install (FieldDive catalog route)
- Installed catalog list (3F7A)
- Catalog pricing editor (3F7B)
- Catalog moved into FieldDive app shell (`/tools/roofing/catalog`)
- **3F8** Catalog Product Surface Alignment — setup workspace, detail panel, Job Card link (Pass B/C-D/E)
- Proposal Template type foundation (3G1)
- Proposal Template tables foundation — committed and **live in Supabase** (3G2)
- Proposal Template store foundation (3G3)
- Default roofing proposal template definitions (3G4)
- Default roofing proposal template install helper (3G5)

### Stage 3G6 complete — Templates setup/readiness/install surface (3G6A–E + D2)

| Commit | Summary |
|--------|---------|
| `15ad732` | **3G6A** — `/tools/roofing/templates` route + `FieldDiveAppShell` Templates nav |
| `3f7b3ff` | **3G6B** — catalog gate on templates page (`deriveCatalogReadiness`) |
| `bd2ed04` | **3G6C** — click-only `installDefaultRoofingProposalTemplates` install/recheck |
| `1d8e849` | **3G6D** — `proposalTemplateReadiness.ts` (pure/read-only) |
| `227061c` | **3G6D2** — Templates workspace surface (hero + library + compact checklist; removed stacked readiness dashboards) |
| `b78c9ee` | **3G6E** — passive Job Card Proposals tab link to templates when catalog ready |

**Templates workspace (3G6D2) — `/tools/roofing/templates`:**

- Header, page alerts, optional catalog prerequisite banner
- Starter roof replacement **template hero** (install/recheck, inline install feedback)
- **Template library** (read-only starter graph)
- Compact **setup checklist** rail (catalog → starter template → Builder later)
- Builder-later footnote — **not** Proposal Builder
- Install/recheck is **click-only**; `catalogReady` (`ready_for_templates`) gates install
- **No** Create proposal, Choose template, proposal records, pricing bridge, send/PDF/approval/payment/status changes

**Key template files:** `app/tools/roofing/templates/TemplatesSetupClient.tsx`, `app/tools/roofing/templates/*`, `app/lib/proposalTemplateReadiness.ts`, `app/lib/proposalTemplateStore.ts` (read from UI), `app/lib/defaultRoofingProposalTemplateInstall.ts`.

### Current proposal template state

- Four `proposal_template_*` tables live in Supabase with RLS; rows after explicit install from Templates page.
- **`/tools/roofing/templates`** — live; Templates nav in `FieldDiveAppShell`.
- `proposalTemplateReadiness.ts` — pure derivation; used on Templates page (and related UI).
- `installDefaultRoofingProposalTemplates(companyId)` — **click-only from Templates route**; catalog `ready_for_templates` gates install; **not** from Job Card.
- **+ Proposal** on Job Card — **enabled when Builder gates pass** (`feec663`); launches read-only Builder with **3H-2 preview + 3H-3 quantity preview** when ready; **no** per-job template selection persistence; **no** proposal records.
- **Proposal Builder (3H-1 + 3H-2 + 3H-3)** — route, gates, read-only context loads, document-style option/section/line preview with quantity preview (`40e6720`); **no** pricing bridge, persistence, or PDF/send integration yet.

**Key files:** `app/lib/proposalTemplateTypes.ts`, `app/lib/proposalTemplateStore.ts`, `app/lib/defaultRoofingProposalTemplates.ts`, `app/lib/defaultRoofingProposalTemplateInstall.ts`, `app/lib/proposalTemplateReadiness.ts`, `app/lib/proposalBuilderReadiness.ts`, `app/lib/proposalBuilderPreview.ts`, `app/lib/proposalQuantityResolver.ts`, `app/tools/roofing/templates/*`, `app/tools/roofing/proposals/builder/*`, `supabase/migrations/20260531_004_create_proposal_template_tables.sql`.

---

## 6A. PACKET HANDOFF FIX (`fd87152`)

**Goal:** Fix Job Packet → Job Card stale job id handoff — no code beyond `RoofingClient.tsx` packet regions.

**Committed:** `fd87152` — Fix Job Packet to Job Card handoff state

**Behavior:**

- **Stale `currentJobId` fixed** for fresh **`entry=packet`** or **`entry=instant`** when URL has **no** `job` param — clears `currentJobId` and `jobHydratedRef`.
- **Continue gated** by packet minimum completeness (`getPacketMinimumFieldsComplete` / `packetMinimumComplete`).
- **Fresh packet no longer reopens old job** via stale in-memory `currentJobId`.
- **Continue creates a new job** when no explicit URL `job` is present (resume only when URL explicitly carries `?job=<uuid>`).
- **Required packet fields:**
  - Contact: **name OR email OR phone**
  - Street address
  - ZIP (5 digits)
  - City **and** state

**Known gap (addressed in `abd718d` for navigate-away/back; remainder below):**

- **`fd87152` only:** entering a fresh packet cleared job id but did not reset form fields — **fixed in `abd718d`** for fresh `entry=packet|instant` (no `?job=`, no `loadSaved`, not board-origin): contact/property fields reset; stored ZIP skipped on fresh packet entry; ZIP preset still applies when user types ZIP.
- **Remaining:** same-URL Job Packet nav click while already on packet may **not** re-trigger reset — future **packet draft lifecycle** (Start new / Discard / Resume) should address this; do not patch casually.

**Helpers added (pure, module-level in `RoofingClient.tsx`):** `getPacketReadinessRows`, `getPacketMinimumFieldsComplete`, `PacketFieldSnapshot`.

**Protected systems:** untouched.

---

## 6B. PROPOSAL BUILDER SHELL — 3H-1 (`feec663`)

**Goal:** Dedicated Proposal Builder route + visual shell + read-only composite readiness gates. **Not** 3H-2/3H-3, persistence, or pricing bridge.

**Committed:** `feec663` — 3H1: add proposal builder shell and gates

**Route:** `/tools/roofing/proposals/builder?job=<uuid>`

**Delivered:**

| Area | Detail |
|------|--------|
| **Pure helper** | `app/lib/proposalBuilderReadiness.ts` — composite gates: job → measurement → catalog → template |
| **Server route** | `app/tools/roofing/proposals/builder/page.tsx` — auth + `companyId` |
| **Shell** | `ProposalBuilderAppPage`, `ProposalBuilderClient`, layout/header/canvas/summary/blocked states |
| **Blocked states** | Missing job, invalid job, measurement not ready, catalog not ready, template not ready — with next-step links |
| **Ready state** | Roofr-style shell — section nav placeholder, **3H-2** document canvas with option/section/line preview (`00fbf64`), setup summary rail |
| **Read-only loads** | Job, measurement handoff, active catalog, catalog readiness, starter template graph, template readiness |
| **Disabled actions** | Preview / Send / Sign / Payment — visible but disabled |
| **Job Card wiring** | `+ Proposal` enabled only when all gates pass; `title` shows primary blocker when disabled; click navigates to Builder URL only |

**Explicitly not in 3H-1:**

- Proposal records / line snapshots
- Proposal line tables — **3H-2 DONE** (`00fbf64`); quantity preview — **3H-3 DONE** (`40e6720`); see **§6E**, **§6F**
- Pricing bridge / customer totals
- SQL / migrations
- PDF / send / sign / payment / approval / status changes
- Template selection persistence
- `installDefaultRoofingProposalTemplates` from Builder or Job Card

**Key files:** `app/lib/proposalBuilderReadiness.ts`, `app/tools/roofing/proposals/builder/*`, scoped Proposals tab regions in `app/tools/roofing/RoofingClient.tsx`.

**Protected systems:** untouched.

**Post-commit smoke (code-reviewed; browser confirmation recommended):**

- Builder without `job` → blocked missing job
- Invalid job → blocked
- Valid job missing gates → blocked with links
- All gates pass → shell only; no proposal created
- Packet fix behaviors from `fd87152` preserved

---

## 6C. PRE-3H-2 SOURCE-OF-TRUTH FIX (`abd718d`)

**Goal:** Correct Job Card / packet / Activity rail architecture drift **before** 3H-2 line preview — read-only display and intake reset only. **Not** 3H-2, persistence, pricing bridge, board migration, or legacy cleanup.

**Committed:** `abd718d` — Refine pre-3H2 job flow source of truth

**Delivered:**

| Area | Detail |
|------|--------|
| **A — Activity rail copy** | `resolveJobCardProposalActivityLine()` in `proposalBuilderReadiness.ts`; Activity rail uses same `proposalBuilderReadiness` as `+ Proposal`. Ready → “Proposal Builder ready” (Send/pricing later). Blocked → gate-specific blocker copy. Loading → setup check copy. |
| **B — Fresh packet intake reset** | `resetPacketIntakeFields()` on fresh `entry=packet|instant` (no `?job=`, no `loadSaved`, not board-origin). Clears contact/property fields; does **not** call legacy `reset()` or touch pricing/estimator state. Fresh packet skips `getStoredLastZip()` on mount; ZIP preset still works when user types ZIP. `currentJobId` clear from `fd87152` preserved. Continue gating unchanged. |
| **C — Job Card identity (`?job=`)** | `hydratedJobRecord` + `jobCardIdentityUtils.ts` — direct/packet-origin Job Card header/overview prefer persisted `JobRecord` when not board-origin. Board-origin saved-estimate overlay **unchanged**. Builder route still loads its own context in `ProposalBuilderClient`. |

**Key files:** `app/lib/proposalBuilderReadiness.ts`, `app/tools/roofing/RoofingClient.tsx`, `app/tools/roofing/jobCard/jobCardIdentityUtils.ts`.

**Explicitly not in `abd718d`:** 3H-2 line preview, quantity resolver, pricing bridge, proposal persistence, SQL, PDF/send/approval/payment/status, Jobs Board migration, legacy route hard-gating, full `JobCardViewModel`.

**Protected systems:** untouched.

**Remaining known gaps (do not casual-patch):**

- Same-URL Job Packet click may not re-trigger intake reset — scope **packet draft lifecycle** later (Start new packet / Discard current draft / Resume draft).
- Job Board is **DB-primary + legacy-secondary** (§6AD Phase B, §6AN) — primary kanban = `public.jobs`; legacy saved estimates isolated in labeled section below; see **§6AN** for current truth.
- Job Card identity improved for `?job=` paths only — **not** full `JobCardViewModel` yet.
- Legacy routes (`?entry=manual&legacy=1`, V2 preview, dead shells) still reachable — cleanup later.

---

## 6D. PACKET JOB CARD SESSION BLEED FIX (`c12ea4d`)

**Goal:** Fix stale saved-estimate session overriding packet-created Job Card display and navigation — **RoofingClient.tsx only**; no protected systems.

**Committed:** `c12ea4d` — Fix packet Job Card saved-estimate session bleed

**Root cause:**

- `sessionStorage` **`getCurrentLoadedSavedId()`** could retain a prior saved estimate (e.g. “Timothy baker55555”) after the user opened a fresh Job Packet.
- **`buildJobCardDisplayModel(currentSaved ?? null, …)`** preferred that estimate’s customer name/address over packet/`JobRecord` identity on packet-origin Job Card.
- **Estimate→job link effect** ran on any `entry=job-card` when a loaded estimate id existed — could replace the new packet job UUID with the estimate-linked job.
- **Hydration `fillEmptyOnly`** was true whenever a stale loaded estimate id existed — could preserve old React contact fields instead of overwriting from the new `JobRecord`.

**Delivered:**

| Area | Detail |
|------|--------|
| **Fresh packet session** | `setCurrentLoadedSavedId(null)` on fresh `entry=packet|instant` reset — clears stale saved-estimate session |
| **After createJob** | Packet Continue clears loaded estimate id; sets `hydratedJobRecord`; hydrates with `fillEmptyOnly: false`; sets `jobHydratedRef` before navigate |
| **Estimate→job link** | Effect gated with `if (!isJobCardBoardContext) return` — board-origin only |
| **Hydration merge** | `fillEmptyOnly` only when `isJobCardBoardContext` |
| **Job Card display** | `buildJobCardDisplayModel(isBoardOrigin ? currentSaved : null, …)` — packet/direct job paths use persisted `JobRecord` identity via `resolveJobCardIdentityFromRecord` / fallbacks, not stale estimate overlay |

**Key files:** `app/tools/roofing/RoofingClient.tsx` only.

**Explicitly not in `c12ea4d`:** 3H-2 line preview, quantity resolver, pricing bridge, proposal persistence, SQL, PDF/send/approval/payment/status, Jobs Board migration, Proposal Builder changes, catalog/template stores.

**Protected systems:** untouched.

**Browser smoke — CONFIRMED (user, post-`c12ea4d`):**

- Entered info in Job Packet → Job Card showed correct packet-created info
- Refreshing Job Card preserved persisted job info
- Returning to Job Packet started clean for a new job
- Stale “Timothy baker55555” saved-estimate data **no longer** appeared on packet-created Job Card
- Dual packet flow (different UUIDs, correct values per job) — confirmed

---

## 6E. PROPOSAL BUILDER READ-ONLY PREVIEW — 3H-2 (`00fbf64`)

**Goal:** Read-only Proposal Builder template option/section/line preview on the Builder route — Roofr-style document surface, no persistence, no pricing totals, no protected systems.

**Committed:** `00fbf64` — 3H2: add read-only proposal preview lines

**Working tree:** clean at commit. **Typecheck:** only **6** pre-existing errors in `RoofingClientV2.tsx` — unchanged. **Protected systems:** untouched.

### 3H-2 summary

| Area | Detail |
|------|--------|
| **Pure helper** | `app/lib/proposalBuilderPreview.ts` — section/option/line preview joins, catalog setup price labels, quantity rule labels; display only |
| **New Builder UI** | `ProposalBuilderLinePreviewTable.tsx`, `ProposalBuilderOptionTabs.tsx`, `ProposalBuilderSectionPreview.tsx` |
| **Modified** | Builder route files only — `ProposalBuilderCanvas.tsx`, `ProposalBuilderClient.tsx`, `ProposalBuilderPageAlerts.tsx`, `ProposalBuilderPageHeader.tsx`, `ProposalBuilderSectionNav.tsx`, `ProposalBuilderSummaryRail.tsx`, `proposalBuilderConstants.ts` |
| **Not modified** | `RoofingClient.tsx`, `SavedClient.tsx`, Catalog/Templates/Jobs Board routes, SQL/migrations, protected systems |

### 3H-2 data spine (reads only)

Builder preview reads **only** from:

- `public.jobs` (via `getJobById`)
- Selected measurement / `measurementProposalHandoff` (via `getSelectedMeasurementForJob` + `buildMeasurementProposalHandoff`)
- `catalog_items` (via `getActiveCatalogItemsByCompany`)
- Proposal template graph (via `getProposalTemplateGraph` on starter template)

Builder preview **does NOT** read from:

- Legacy estimator fields
- Old pricing `useMemo`
- Saved estimate snapshot
- `loadSaved` restore state
- Old FieldDive calculator / payment spine

### 3H-2 UI behavior

- **Proposal document-style center canvas** — gray workspace (`BUILDER_DOCUMENT_SURFACE`) + centered white document page (`BUILDER_DOCUMENT_PAGE`)
- **Standard / Enhanced / Premium** option pills switch sections per template option
- **Sections** render as proposal document sections (headings + prose blocks) — not dashboard cards
- **Line items** render as proposal rows (primary name, muted meta, catalog setup price reference) — not catalog/admin table
- **Text / warranty / terms** render as prose blocks
- **Catalog setup prices** display as **reference only** — labeled; not customer contract amounts
- **Measurement context** demoted — subtle context strip in canvas; primary detail in right **Job context** rail
- **Disabled actions** — Preview / Send / Sign / Payment remain visible but disabled
- **Copy preserved:** “Read-only proposal preview. Pricing, PDF, send, signature, and payment come later.”; catalog setup price warning (no proposal totals)

### Temporary fixture review (removed before commit)

- A **temporary development-only** visual fixture was used for signed-in browser review: `?fixture=ready` gated by `process.env.NODE_ENV === "development"`
- Fixture showed a visible **TEMPORARY dev fixture** banner
- Fixture used the same production Builder components with realistic mock JobRecord / measurement handoff / catalog / template graph data — **no DB writes**
- **Removed completely before commit** — grep confirmed **no** remaining references to `TEMPORARY`, `fixture=ready`, or `proposalBuilderReadyFixture`
- **User visual review — PASSED:** document surface, option pills, proposal sections/rows, no totals, disabled actions, fixture banner as expected

### Hard boundaries preserved (3H-2)

**No:**

- Resolved quantities
- qty × price
- Subtotals / totals
- Tax
- Margin / markup
- Customer-facing contract amount
- Proposal records
- Proposal persistence
- SQL / migrations
- Pricing bridge
- PDF generation
- Send / email
- Approval / e-signature
- Payment / status integration
- Material orders / work orders / invoices

### Explicitly not in 3H-2

- ~~Quantity resolver (3H-3)~~ — **DONE** (`40e6720`); see **§6F**
- Proposal records / line snapshots (3J)
- Pricing bridge / customer totals (3I)
- Template selection persistence beyond in-session option tab state
- `installDefaultRoofingProposalTemplates` from Builder or Job Card
- Changes to `proposalBuilderReadiness` gate logic beyond passing preview props when `shellReady`

**Key files:** `app/lib/proposalBuilderPreview.ts`, `app/tools/roofing/proposals/builder/*` (listed above).

**Protected systems:** untouched.

---

## 6F. PROPOSAL BUILDER READ-ONLY QUANTITY PREVIEW — 3H-3 (`40e6720`)

**Goal:** Pure read-only quantity resolver preview on Builder line rows — answers “what quantity would this line use?” without pricing, persistence, or protected systems.

**Committed:** `40e6720` — 3H3: add read-only proposal quantity preview

**Working tree:** clean at commit. **Typecheck:** only **6** pre-existing errors in `RoofingClientV2.tsx` — unchanged. **Protected systems:** untouched.

### 3H-3 summary

| Area | Detail |
|------|--------|
| **Pure resolver** | `app/lib/proposalQuantityResolver.ts` — read-only quantity resolution from measurement + catalog + template rule; no React, Supabase, stores, or pricing |
| **Modified preview helper** | `app/lib/proposalBuilderPreview.ts` — `ProposalQuantityPreviewContext`; line rows call `resolveProposalLineQuantity` |
| **Modified Builder UI only** | `ProposalBuilderCanvas.tsx`, `ProposalBuilderClient.tsx`, `ProposalBuilderLinePreviewTable.tsx`, `ProposalBuilderSectionPreview.tsx` |
| **Not modified** | `RoofingClient.tsx`, `SavedClient.tsx`, `estimateStore`, SQL/migrations, protected systems |

### 3H-3 quantity spine (reads only)

Quantity preview uses **only**:

- Selected measurement record (via `getSelectedMeasurementForJob` in Builder client)
- `measurementProposalHandoff` (`buildMeasurementProposalHandoff`)
- `deriveQuantityMapFromRecord` → `MeasurementQuantityMap`
- Catalog item `quantity_source` / `unit` / `default_quantity`
- Template item `quantity_rule`
- Builder line row quantity preview (`buildLinePreviewRow` → `resolveProposalLineQuantity`)

3H-3 **does NOT** use:

- Old estimator area/waste/labor fields
- Saved estimate snapshot
- `loadSaved` restore state
- `estimateStore`
- Old pricing `useMemo`
- Payment / status / send / PDF state
- `localStorage` estimate state
- Board card model fields

### 3H-3 UI behavior

- **Line rows** show quantity preview inside proposal document rows (3H-2 layout preserved)
- **Examples (fixture smoke):** Shingles **27.5 SQ**; Starter **142 LF**; Ridge cap **72 LF**
- **Qty / Source / Rule / Status** shown subtly as metadata under item name
- **Missing quantities** → `Qty: Not resolved` + subtle amber note (e.g. needs measurement field)
- **Fixed quantities** → fixed status from template `fixed_quantity` or catalog `default_quantity`
- **Catalog setup price** remains **reference only** — not multiplied by quantity
- **No** qty × price, subtotals, totals, tax, margin, markup, or customer contract amount
- **Standard / Enhanced / Premium** option pills still switch section content
- **Disabled actions** — Preview / Send / Sign / Payment remain visible but disabled

### Temporary fixture / smoke (removed before commit)

- Brief **development-only** fixture used for visual/programmatic smoke: `?fixture=ready` gated by `process.env.NODE_ENV === "development"`
- Visible **TEMPORARY dev fixture** banner during review
- **Standard / Enhanced / Premium** behavior checked; Standard scope line sections had **13 rows**, all resolved in fixture run
- Fixture included `measurementQuantityMap` via `deriveQuantityMapFromRecord` on mock measurement record
- **Removed completely before commit** — grep clean except historical handoff doc references to past 3H-2 fixture

### Non-blocking deferred notes (preserve for later)

- **Disposal unit display** — catalog unit may show “each” while source is `debris_tons`; may need “tons” label before pricing/material orders
- **`roof_squares` map fallback edge case** — review before pricing/material orders (raw vs adjusted conflation risk on non-starter catalog items)
- **`coverage_rate` / bundle conversion** — not applied in 3H-3
- **Exact vs rounded quantity setting** — deferred; 3H-3 shows exact values only
- **Manual quantity overrides** — `manual_later` status only; no override UI
- **`labor_multiplier` / `custom` quantity sources** — `unsupported_rule`; no fake values

### Hard boundaries preserved (3H-3)

**No:**

- qty × price
- Line totals / subtotals / totals
- Tax / margin / markup
- Customer-facing contract amount
- Pricing bridge
- Proposal records / persistence
- SQL / migrations
- PDF / send / sign / payment / status integration
- Material orders / work orders / invoices

**Key files:** `app/lib/proposalQuantityResolver.ts`, `app/lib/proposalBuilderPreview.ts`, `app/tools/roofing/proposals/builder/*` (listed above).

**Protected systems:** untouched.

---

## 6G. PROPOSAL PRICING TYPE CONTRACT — 3I-0 (`6f9cbe1`)

**Goal:** Pure pricing architecture type contract for the new proposal spine — approved decision sheet locked; types only, no engine math, no UI, no persistence.

**Committed:** `6f9cbe1` — 3I0: add proposal pricing contract types

### 3I-0 approved policy defaults (decision sheet)

| Decision | Locked default |
|----------|----------------|
| Waste model | `wasteModel = "adjusted_measurement"` — 3H-3 quantities already include waste; engine must not re-apply `waste_applies` / `coverage_rate` |
| Profitability | Both `margin` and `markup` supported; **default** `"margin"`. Formulas locked in **§6H** (3I-1) |
| Pricing basis | Cost-plus is RoofrExact default; `unit_price` is explicit override; `fixed_price` / `included` are contract behaviors only |
| Quantity rounding | Union includes `"exact" \| "whole"` — **only `"exact"` honored** until later approved rounding phase; `"whole"` not implemented in 3I-0 or 3I-1 |
| Tax | `salesTaxRatePct` + `materialPurchaseTaxRatePct` in `PricingPolicy` / `PricingTaxInput` only — **do not** add tax fields to `CatalogItem` yet |
| Discount/tax ordering | **Locked in §6H** — discount before tax; option-level only in 3I-1 |
| Guardrails | `pass \| warn \| block` typed; rep → block, manager → warn; enforcement deferred — see **§6H** |
| Naming | Engine/view: camelCase `...Cents`; future 3J persistence: snake_case `..._cents` |
| Visibility | `included` → $0 customer price; `internal_only` / `hiddenButInCalc` → in calc, hidden; `grouped` → section/package rollup |

### 3I-0 deliverable

| Area | Detail |
|------|--------|
| **Pure types module** | `app/lib/proposalPricingTypes.ts` — policy unions, input/output shapes, guardrail + snapshot intent types, function-type signatures (no bodies), label helpers |
| **Engine signatures** | `ResolveProposalPricing`, `EvaluateProfitabilityGuardrail` — declared only; **3I-1** implements |
| **Snapshot intent** | `PRICING_SNAPSHOT_INTENTS` — documents freeze-on-send / lock-on-sign boundary for **3J**; no persistence |
| **Not modified** | `RoofingClient.tsx`, `SavedClient.tsx`, `estimateStore`, `catalogTypes.ts`, Builder UI, SQL/migrations, protected APIs |

### 3I-0 pricing spine (contract only — no runtime wiring)

Pricing contract **consumes** (later, in 3I-1):

- `ProposalQuantityPreview` / resolved quantity from `proposalQuantityResolver.ts` (3H-3)
- `CatalogItem` economics: `unit_cost_cents`, `unit_price_cents`, `pricing_basis`, `customer_visibility`
- `ProposalTemplateItemRole`, option/section structure from templates

3I-0 **does NOT** use or import:

- Old estimator area/waste/labor fields or pricing `useMemo`
- Saved estimate snapshot / `loadSaved` / `estimateStore`
- Payment / status / send / PDF state
- Any pricing math or totals rendering

### Hard boundaries preserved (3I-0)

**No:**

- Pricing engine math or `ResolveProposalPricing` body
- Guardrail enforcement UI or send blocking
- qty × price totals in Builder UI
- Proposal records / SQL / migrations
- CatalogItem tax field changes
- `"whole"` quantity rounding behavior

**Deferred to later stages:**

- `raw_plus_waste`, coverage/bundle conversion (quantity-layer migration)
- Line-level tax overrides on `PricingTaxInput` (post–catalog tax pass)
- Manual subtotal override logic (`subtotalOverrideCents`)
- Deposit / financing / payment (3K)
- Snapshot persistence tables (3J)

**Key file:** `app/lib/proposalPricingTypes.ts`

**Protected systems:** untouched (types-only stage).

---

## 6H. PROPOSAL PRICING ENGINE DECISIONS — 3I-1 (approved — implemented in §6I)

**Goal:** Lock all pricing-policy decisions required before implementing the pure pricing engine. **Approved in chat; documented here.** **Implementation complete** — see **§6I** (`162f9be`–`52b7148`).

**Prerequisite:** 3I-0 type contract (`6f9cbe1`, `proposalPricingTypes.ts`). **3I-1 consumes 3H-3 resolved quantities** — not legacy estimator fields or saved-estimate snapshots.

### 1. Discount / tax ordering

| Rule | Locked for 3I-1 |
|------|------------------|
| Order | **Discount before tax** |
| Sales tax base | **Post-discount customer subtotal** |
| Discount scope | **Option-level only** via `PricingPolicy.discount` (percent or fixed) |
| Line-level discounts | **Not in 3I-1** |
| Manual subtotal override | **`subtotalOverrideCents` not implemented** in 3I-1 |

**Flow:** line prices → customer subtotal → apply option discount → taxable subtotal → sales tax → customer total.

### 2. Sales tax

| Rule | Locked for 3I-1 |
|------|------------------|
| Rate source | **Option-level `policy.tax.salesTaxRatePct` only** |
| Line-level override | **`PricingTaxInput.salesTaxRatePct` ignored** in 3I-1 (reserved for later catalog/tax pass) |
| Customer visibility | **Option rollup only** — `salesTaxCents` + `customerTotalCents` on `ProposalOptionPricing`; per-line `salesTaxCents` may be `null` |

### 3. Material purchase tax

| Rule | Locked for 3I-1 |
|------|------------------|
| Visibility | **Internal cost-side only** — never on customer price or sales tax base |
| Scope | **Materials only** (`item_type === "material"` when known on input) |
| Rate source | **`policy.tax.materialPurchaseTaxRatePct`** — policy is source of truth; line `PricingTaxInput` overrides **ignored** in 3I-1 |
| Effective cost | `effectiveUnitCostCents = unitCostCents + round(unitCostCents × materialPurchaseTaxRatePct / 100)` when applicable |

### 4. Margin / markup

| Rule | Locked for 3I-1 |
|------|------------------|
| Margin formula | `price = cost / (1 - marginPct / 100)` |
| Markup formula | `price = cost * (1 + markupPct / 100)` |
| Application | **Per line** for `cost_plus_margin` using **`policy.defaultProfitabilityPct`** |
| Guardrail scope | **Option rollup** — `EvaluateProfitabilityGuardrail` uses option-level `actualPct`, not per-line |
| Missing cost | **`cost_plus_margin` without finite cost → `unpriced`** — no fallback to `unit_price_cents` |

### 5. `pricing_basis` precedence

| Basis | Customer price | Internal cost | Notes |
|-------|----------------|---------------|-------|
| **`cost_plus_margin`** | Derived from effective unit cost + margin/markup × qty | cost × qty | Requires finite cost + resolved qty |
| **`unit_price`** | **`unitPriceCents × qty`** — stored customer price wins | cost for profit display | Requires finite `unitPriceCents` + resolved qty |
| **`fixed_price`** | **`unitPriceCents`** as line total when `unit === "fixed"`; else `unitPriceCents × qty` | cost × qty when available | Requires finite `unitPriceCents` |
| **`included`** | **$0** customer line price | cost × qty rolls to internal profitability | Status `included` |

**Labor cost:** for labor rows, primary cost = `laborUnitCostCents ?? unitCostCents`.

### 6. Guardrails

| Rule | Locked for 3I-1 |
|------|------------------|
| Engine output | **`pass \| warn \| block` only** |
| Rep below minimum | **`block`** |
| Manager below minimum | **`warn`** |
| UI enforcement | **None** in 3I-1 |
| Send blocking | **None** in 3I-1 |
| Protected paths | **No changes** to send/approval/payment/status |

**`actualPct` source (option rollup, pre-tax, post-discount):**

- **Margin:** `(customerSubtotalCents - discountCents - internalCostCents) / (customerSubtotalCents - discountCents) × 100`
- **Markup:** `(customerSubtotalCents - discountCents - internalCostCents) / internalCostCents × 100`
- Invalid denominator or blocking issues → `actualPct = null`; rep → `block`, manager → `warn`

### 7. Rounding / waste

| Rule | Locked for 3I-1 |
|------|------------------|
| Quantities | **`exact` only** — use 3H-3 resolved values as-is |
| `quantityRounding: "whole"` | **Ignored** in 3I-1 |
| Waste model | **`adjusted_measurement` only** — `adjusted_roof_squares` already includes waste |
| Forbidden in engine | Re-applying `waste_applies`, proposal waste, `coverage_rate`, bundle conversion |
| Future | `raw_plus_waste` — quantity-layer migration, not pricing engine |

### 8. Unresolved / unpriced behavior

| Condition | Behavior |
|-----------|----------|
| `quantityUnresolved === true` | Line status **`unresolved_quantity`** — **no default to 0** |
| Missing required cost/price | Line status **`unpriced`** |
| Any blocking line on option | **`hasBlockingIssues = true`** |
| Customer totals | **`customerTotalCents = null`** — **not partial** when blocking issues exist |
| Completeness flag | **`generatedFrom.allLinesPriced = false`** when any line blocking |

### 9. Visibility

| Visibility / flag | Customer subtotal | Internal cost/profit |
|-------------------|-------------------|----------------------|
| **`customer_visible`** | Contributes | Contributes |
| **`grouped`** | Contributes (section/package rollup) | Contributes |
| **`hiddenButInCalc`** | Contributes (hidden line detail later) | Contributes |
| **`internal_only`** | **Does not contribute** | Contributes |
| **`included` basis** | **$0** customer line price | Cost rolls internally |

**3I-1:** no Builder customer-facing rendering change — UI totals deferred to **3I-2**.

### 10. Implementation sequence (approved — 3I-1A/B/C complete)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **3I-1A** | Pure `proposalPricingEngine.ts` — `resolveProposalPricing` + `evaluateProfitabilityGuardrail` | **DONE** (`162f9be`, hardened `1ddee44`) |
| **3I-1B** | `proposalPricingInputMapper.ts` — catalog + 3H-3 preview → `ProposalPricingInput` | **DONE** (`52b7148`) |
| **3I-1C** | Programmatic engine + mapper tests | **DONE** (`d67910d`, mapper tests in `52b7148`) |
| **3I-2** | Read-only Builder pricing preview (orchestrator + document UI + status surfaces) | **DONE** (`5626c47`–`637b85a`) — see **§6K** |

**Committed order:** `docs: close 3I1 pricing engine decisions` → `3I1: add proposal pricing engine` → `3I1: harden proposal pricing engine inputs` → `3I1: add proposal pricing engine tests` → `3I1: add proposal pricing input mapper` → *(next)* `docs: update handoff after 3I1 pricing foundation` → *(later)* `3I2: add read-only builder pricing preview`.

### 3I-1A files allowed

| Allowed | Purpose |
|---------|---------|
| `app/lib/proposalPricingEngine.ts` | **New** — core deterministic math |
| `app/lib/proposalPricingTypes.ts` | JSDoc / decision constants only if needed |
| `docs/fielddive-global-handoff.md` | This section |

### 3I-1A files forbidden

**Do not touch in 3I-1A:**

- `RoofingClient.tsx`, `SavedClient.tsx`, `RoofingClientV2.tsx`
- `estimateStore.ts`, `paymentsTable.ts`
- `/api/payments/*`, `/api/proposal/*`, `/api/estimate/send`, `/api/approve/*`, `/api/approval/*`, `/api/email/*`
- `supabase/migrations/*` (SQL/migrations)
- `app/tools/roofing/proposals/builder/*` (Builder UI — **3I-2**)
- `app/lib/proposalBuilderPreview.ts` (Builder preview — **3I-2**)
- `app/lib/proposalQuantityResolver.ts` (quantity layer frozen at 3H-3)
- `catalogTypes.ts`, `catalogStore.ts`, `proposalTemplateStore.ts`

### Hard boundaries preserved (3I-1 decision closeout — still apply to 3I-2+)

**3I-1 lib modules do NOT include:**

- Builder UI totals or customer-facing price display (**3I-2**)
- Proposal records / SQL / snapshots (**3J**)
- Legacy estimator `useMemo` replacement
- Send / PDF / payment / approval / status integration

**Old FieldDive pricing/payment remains adapter-later, not product spine.**

**Protected systems (legacy):** untouched through 3I-1 — no changes to `RoofingClient.tsx`, `SavedClient.tsx`, `estimateStore`, payments, send/PDF, approval, or status paths.

---

## 6I. PROPOSAL PRICING FOUNDATION — 3I-1 COMPLETE (`162f9be`–`52b7148`)

**Goal:** Pure deterministic pricing engine + input mapper for the new proposal spine. **Lib-only** — consumes 3H-3 quantities via mapper; **no Builder UI wiring**, **no persistence**, **no legacy estimator imports**.

**Working tree:** clean at `52b7148`. **Typecheck:** only **6** pre-existing errors in `RoofingClientV2.tsx` — unchanged. **Protected systems:** legacy pricing/payment/send/PDF/status **untouched**.

### 3I-1 commit sequence

| Commit | Summary |
|--------|---------|
| `ac589d8` | docs: close 3I1 pricing engine decisions (§6H) |
| `162f9be` | **3I-1A** — Pure `proposalPricingEngine.ts`: `resolveProposalPricing`, `evaluateProfitabilityGuardrail`, `priceProposalLine`, `canApplyMaterialPurchaseTax` |
| `1ddee44` | **3I-1A.1** — Input hardening: negative quantity → blocking; negative `defaultProfitabilityPct` → unpriced; negative fixed discount → treated as 0 |
| `d67910d` | **3I-1C** — Engine tests: 22/22 pass (`proposalPricingEngine.test.ts`) |
| `52b7148` | **3I-1B** — Pure `proposalPricingInputMapper.ts` + mapper tests: 16/16 pass |

### Key files

| File | Role |
|------|------|
| `app/lib/proposalPricingTypes.ts` | Type contract (3I-0) — policy, input/output, guardrails |
| `app/lib/proposalPricingEngine.ts` | Pure pricing math — consumes `ProposalPricingInput` only |
| `app/lib/proposalPricingEngine.test.ts` | Engine programmatic tests (Node `node:test` via `tsx`) |
| `app/lib/proposalPricingInputMapper.ts` | Template graph + catalog + 3H-3 quantity → `ProposalPricingInput` |
| `app/lib/proposalPricingInputMapper.test.ts` | Mapper programmatic tests |

### Pricing engine boundaries

**Pure engine only:**

- Consumes **`ProposalPricingInput`** (built by mapper or tests)
- **No UI totals** — nothing rendered in app routes
- **No persistence** — no proposal records, SQL, or snapshots
- **No protected systems** — does not import or call legacy estimator, `estimateStore`, `loadSaved`, `currentSaved`, board card state, payments, send/PDF, approval, or status
- **No old estimator imports** — no `RoofingClient.tsx` pricing `useMemo`
- **No SQL/migrations**

**Mapper boundaries (same spirit):**

- Maps template graph + catalog items + `ProposalQuantityPreviewContext` (3H-3) + `PricingPolicy` + `actorRole`
- **No money calculation** in mapper
- **No quantity resolving** in mapper — delegates exclusively to `resolveProposalLineQuantity` (3H-3)
- **Wired** from Builder UI via `proposalBuilderPricingPreview.ts` (3I-2A) — see **§6K**

### Engine rules implemented (§6H → code)

| Rule | Implemented |
|------|-------------|
| Discount before tax | Yes — line prices → subtotal → discount → taxable base → sales tax |
| Option-level discount only | Yes — `PricingPolicy.discount` only; no line-level discounts |
| Sales tax on post-discount subtotal | Yes — `policy.tax.salesTaxRatePct` on discounted subtotal |
| Material purchase tax | Internal-only, materials-only (`itemType === "material"`) via `policy.tax.materialPurchaseTaxRatePct` |
| Margin / markup formulas | Per-line for `cost_plus_margin`; option rollup for guardrails |
| `pricing_basis` precedence | `cost_plus_margin`, `unit_price`, `fixed_price`, `included` per §6H table |
| Blocking behavior | `quantityUnresolved`, `unpriced`, or `unsupported` line → `hasBlockingIssues = true` |
| Customer totals when blocked | `customerSubtotalCents` / `customerTotalCents` = **`null`** — no partial totals |
| Quantity rounding | **`exact` only** — 3H-3 values used as-is; `"whole"` ignored |
| Waste model | **`adjusted_measurement` only** — no re-application of waste/coverage/bundle conversion |
| Guardrails | `pass \| warn \| block` returned only — **not enforced** in UI or send paths |

### Test coverage

| Suite | Result | Command |
|-------|--------|---------|
| Engine tests | **22/22 pass** | `npx tsx --test app/lib/proposalPricingEngine.test.ts` |
| Mapper tests | **16/16 pass** | `npx tsx --test app/lib/proposalPricingInputMapper.test.ts` |

**No `package.json` or lockfile changes** — tests use Node built-in `node:test` + `tsx`.

### Mapper behavior (`proposalPricingInputMapper.ts`)

**Input:** `MapProposalPricingInputParams` — `optionId`, `policy`, `actorRole`, `ProposalTemplateGraph`, catalog items (array or Map), `ProposalQuantityPreviewContext | null`.

**Output:** `ProposalPricingInput` — one option's `lines: PricingLineInput[]` from `line_items` + `upgrade_group` sections only.

**Per-line mapping (`PricingLineInput`):**

| Field | Source |
|-------|--------|
| `templateItemId` | `ProposalTemplateItem.id` |
| `catalogItemId` | Template catalog link or `null` when missing |
| `sectionId` | `ProposalTemplateItem.section_id` |
| `itemRole` | `ProposalTemplateItem.item_role` |
| `itemType` | `CatalogItem.item_type` when catalog exists; **`null` when missing** |
| `unit` | `CatalogItem.unit` when catalog exists; structural `"fixed"` placeholder when missing |
| `pricingBasis` | `CatalogItem.pricing_basis` when catalog exists; structural placeholder when missing |
| `customerVisibility` | Template override, or `inherit_catalog` → catalog row, or `"customer_visible"` when catalog missing |
| `quantity` / `quantityUnresolved` | From `resolveProposalLineQuantity` (3H-3) — mapper does not recompute |
| `unitCostCents` / `unitPriceCents` / `laborUnitCostCents` | Catalog cents fields; **`null` when catalog missing** — no fake economics |
| `tax` | Always **`null`** — catalog tax fields do not exist yet |
| `hiddenButInCalc` | Only when `templateItem.metadata.hidden_but_in_calc === true` |
| `upgradeScope` | `{ parentOptionId }` for `upgrade` / `optional_addon` roles on mapped option only |

**Cases covered in mapper tests:** material `cost_plus_margin`, labor (`laborUnitCostCents`), `unit_price` override, `fixed_price`, `included`, `internal_only`, missing catalog (blocking), unresolved quantity, material vs labor `itemType`, tax null, no mapper totals, engine compatibility smoke.

**Missing catalog safety:** `quantity: null`, `quantityUnresolved: true`, all cent fields `null`, `itemType: null`. Structural placeholders (`unit: "fixed"`, `pricingBasis: "cost_plus_margin"`) cannot accidentally price — engine blocks → `customerSubtotalCents = null`.

**Engine compatibility (tests):** Mapped material/labor lines pass into `resolveProposalPricing`; missing catalog blocks option totals.

### Remaining deferred (preserve)

| Item | Stage |
|------|-------|
| Builder read-only pricing preview | **DONE** — **§6K** (`5626c47`–`637b85a`) |
| Internal profitability rail/drawer (cost/profit/margin dollars) | **3I-3 or later** (deferred per §6J) |
| Proposal records / snapshots | **3J** |
| PDF / send / sign / payment adapters | **3K** |
| Tax fields on `CatalogItem` | Later catalog/pricing pass |
| Line-level sales tax | Later |
| `"whole"` quantity rounding | Later |
| `raw_plus_waste` / `coverage_rate` / bundle conversion | Later quantity-layer migration |
| Manual subtotal override (`subtotalOverrideCents`) | Later |
| Guardrail UI enforcement / manager override | Later |
| Material orders / work orders / invoices | Later |

### Hard boundaries preserved (3I-1 complete)

**No:**

- Builder UI pricing totals or qty × price display
- Mapper/engine wired from `ProposalBuilderClient.tsx`
- Proposal records / SQL / migrations
- Legacy estimator replacement
- Send / PDF / payment / approval / status changes
- `localStorage`, Supabase calls, or saved-estimate state in mapper/engine

**Protected systems:** legacy paths **untouched**.

---

## 6J. POST-3I-1 AUDIT + OPUS-CORRECTED 3I-2 GUARDRAILS (historical — implemented in §6K)

**Status:** Pricing foundation audited after 3I-1; Opus reviewed the 3I-2 plan; guardrails below were **binding during 3I-2A/B/C implementation** and are **verified implemented** at `637b85a` — see **§6K**. This section remains the historical guardrail reference.

### 1. 3I-0 / 3I-1 foundation audit — **PASS**

Read-only audit of `proposalPricingTypes.ts`, `proposalPricingEngine.ts` (+ tests), `proposalPricingInputMapper.ts` (+ tests), `proposalQuantityResolver.ts`, `proposalBuilderPreview.ts` against §6H:

- **No computation drift** — engine matches §6H decisions.
- **No old estimator / saved-estimate / `loadSaved` bleed** — mapper/engine import only the new spine.
- **No waste / coverage / bundle math** — no `coverage_rate`, `waste_applies`, or bundle conversion anywhere.
- **`"whole"` rounding inert** — present in union/const only; engine uses `exact` (qty as-is). Verified `10.7 → 107000`.
- **`subtotalOverrideCents` inert** — on `PricingPolicy` type; **never read** by engine.
- **No partial customer totals** — blocking nulls `customerSubtotalCents` / `customerTotalCents` at both section and option level.
- **No `unit_price` fallback** — `cost_plus_margin` without finite cost → `unpriced` (blocking).
- **Material purchase tax** — material-only (`itemType === "material"`) and internal-only (folds into effective cost; never on sales tax base).
- **Discount before tax** — discount on customer subtotal, sales tax on post-discount net.
- **Guardrail return-only** — `pass | warn | block` returned; no UI/send enforcement.
- **Per-line `tax` (`PricingTaxInput`) inert** — only `policy.tax` is read; mapper sets line `tax: null`.

**Verdict:** No 3I-1 code fixes required before 3I-2.

### 2. Customer / internal separation risk (top structural note)

- `ProposalLinePricing` is a **flat object** carrying **both** customer fields (`unitPriceCents`, `linePriceCents`) **and** internal fields (`unitCostCents`, `effectiveUnitCostCents`, `lineCostCents`, `profitCents`, `marginPct`, `markupPct`). `ProposalOptionPricing` likewise carries `internalCostCents` / `internalProfitCents`.
- This is **correct for engine truth** (engine is the internal source of record) but **risky for UI** — the type does not structurally prevent internal dollars from reaching customer components.
- On a **blocked** option, `internalCostCents` is **not** nulled (stays a number while customer total is null) — a further reason to keep internal dollars out of 3I-2.
- **Rule:** the **3I-2 orchestrator DTO must enforce customer/internal separation**. The customer document may receive **only customer-safe fields** (line price / status / visibility, option customer subtotal/discount/tax/total). Internal cost/profit/margin **dollars are deferred** to the later internal-profitability phase (3I-3 or later).

### 3. Opus-corrected 3I-2 rules (binding)

- **No** internal cost / profit / margin **dollars** in any 3I-2 UI surface.
- **No** dollar totals on option tabs. Option tabs show **status only**: **Priced** / **Incomplete**.
- Customer prices / totals may appear **only inside the document canvas**.
- **Persistent preview banner required** on the document totals block (not a footnote):
  > "Preview pricing — uses a placeholder 50% margin, not your company's configured pricing. Not a customer quote."
- **Grouped** lines show **name only** and roll into the section/option subtotal (no per-line dollar).
- **`internal_only`** lines are **omitted** from the customer document.
- Rail may show **status words only**: **Complete / Incomplete**, blocking-issue count, guardrail word (Pass / Warning / Blocked). **No internal dollar values** in the rail for 3I-2.
- Internal profitability rail / drawer (cost/profit/margin dollars) is **deferred to 3I-3 or later**.

### 4. `included` + unresolved quantity — **DECISION LOCKED**

- **`included` + `quantityUnresolved` remains BLOCKING for 3I-2.**
- **Reason:** even though the customer price is **$0**, internal cost / profit / material-order truth depends on quantity. Blocking is safer than allowing a fake "complete" total.
- Revisit later only if product policy changes (e.g., included lines that never need quantity).

### 5. Tests to add with 3I-2A (orchestrator)

- `included` + unresolved quantity → **blocks** the option (locks decision §4).
- Mixed section: `customer_visible` + `internal_only` + `included` → customer subtotal counts only visible; internal cost includes internal_only + included.
- `grouped` + `customer_visible` in one section → section `customerSubtotalCents` rollup correctness.
- Orchestrator **loops `resolveProposalPricing` per option** (engine returns `options: [single]` per call; orchestrator must not assume one call covers all options).
- Orchestrator **customer DTO excludes** `profitCents`, `marginPct`, `markupPct`, `lineCostCents`, `internalCostCents`, `internalProfitCents`.

### 6. Next implementation step — **3I-2A only**

| Allowed | Detail |
|---------|--------|
| `app/lib/proposalBuilderPricingPreview.ts` | **New** — pure orchestrator: maps + prices all options (loop per option); returns DTO with separated customer-display vs internal data |
| `app/lib/proposalBuilderPricingPreview.test.ts` | **New** — tests in §5 above |
| `BUILDER_PREVIEW_PRICING_POLICY` | Single labeled preview-only policy constant (50% margin, 20% min, exact, `adjusted_measurement`, no tax, no discount, `actorRole: "rep"`) |

**Forbidden in 3I-2A:**

- **No** Builder UI wiring (no component changes)
- **No** protected systems, persistence, SQL/migrations, old estimator/saved estimates
- **No** Send / PDF / sign / payment / status

**Stop for review after 3I-2A** before any Builder component wiring (3I-2B+). **3I-2A/B/C complete** — see **§6K**.

---

## 6K. READ-ONLY BUILDER PRICING PREVIEW — 3I-2 COMPLETE (`5626c47`–`637b85a`)

**Goal:** Wire 3I-1 mapper + engine into the Proposal Builder as a **read-only pricing preview** — customer dollars in the document canvas only; status words on option tabs and right rail; **no persistence**, **no internal profitability dollars**, **no company pricing policy UI**.

**Working tree:** clean at `637b85a`. **Typecheck:** only **6** pre-existing errors in `RoofingClientV2.tsx` — unchanged. **Protected systems:** legacy pricing/payment/send/PDF/status/saved estimates **untouched**.

### 3I-2 commit sequence

| Commit | Slice | Summary |
|--------|-------|---------|
| `5626c47` | **3I-2A** | Pure Builder pricing preview orchestrator |
| `f5bbd84` | **3I-2B** | Customer document pricing preview UI |
| `637b85a` | **3I-2C** | Option-tab + right-rail pricing status surfaces |

### 3I-2A — Pure orchestrator (`5626c47`)

| File | Role |
|------|------|
| `app/lib/proposalBuilderPricingPreview.ts` | Pure orchestrator: 3H-3 quantity context → `mapProposalPricingInput` → `resolveProposalPricing` / `priceProposalLine` → `ProposalBuilderPricingPreview` DTO |
| `app/lib/proposalBuilderPricingPreview.test.ts` | Orchestrator tests — **9/9 pass** |
| `BUILDER_PREVIEW_PRICING_POLICY` | Preview-only policy constant (50% margin, 20% min, exact, `adjusted_measurement`, no tax, no discount, `actorRole: "rep"`) — **not** company configuration |

**DTO separation:**

- **`customer` slice** — customer-safe line display + customer subtotal/discount/tax/total only; **no** internal cost/profit/margin fields.
- **`status` slice** — `pricingComplete`, `blockingLineCount`, `guardrailOutcome` only; **no dollars**.

**Orchestrator rules implemented:**

- All template options computed **independently** (loop per option).
- Missing catalog → line `not_priced`; option totals **null** when blocked.
- **`included` + unresolved quantity** → **blocking** (§6J decision locked).
- **`grouped`** → rolls into subtotal; no per-line customer dollar in DTO (`showPrice: false`).
- **`internal_only` / hidden** → `omitted` in customer line view.
- Missing-catalog lines distinguished from genuine unresolved quantity via `itemType == null`.

### 3I-2B — Customer document pricing UI (`f5bbd84`)

**Builder files changed:**

| File | Role |
|------|------|
| `ProposalBuilderClient.tsx` | Single `useMemo` → `buildProposalBuilderPricingPreview`; passes `pricingPreview` to canvas |
| `ProposalBuilderCanvas.tsx` | Derives selected option **customer** view; threads to sections + totals |
| `ProposalBuilderSectionPreview.tsx` | Filters `omitted` lines; passes `lineByTemplateItemId` |
| `ProposalBuilderLinePreviewTable.tsx` | Customer price/status column in document rows only |
| `ProposalBuilderDocumentTotals.tsx` | **New** — subtotal/total or "Pricing incomplete"; persistent preview banner |
| `proposalBuilderConstants.ts` | Document/totals styles + `formatPriceCents` (UI layer only — orchestrator frozen) |

**Document behavior (3I-2B only — no tab/rail status in this slice):**

- Line prices/statuses appear **only inside the document canvas**.
- Persistent preview banner (required):
  > "Preview pricing — uses a placeholder 50% margin, not your company's configured pricing. Not a customer quote."
- **`grouped`** → **In package** (no per-line dollar).
- **`included`** → **Included**.
- **`internal_only` / hidden** → omitted from customer document.
- Incomplete pricing → **Pricing incomplete** footer; **no** subtotal/tax/total numbers.
- Discount/tax rows hidden when 0/null.
- 3H-3 quantity metadata (Qty/Source/Rule/Unit/Role) preserved on line rows.

### 3I-2C — Pricing status surfaces (`637b85a`)

**Builder files changed:**

| File | Role |
|------|------|
| `ProposalBuilderOptionTabs.tsx` | Small **Complete / Incomplete** pill per option — **no dollars** |
| `ProposalBuilderSummaryRail.tsx` | **Pricing** status block: Complete/Incomplete, blocking count, guardrail word |
| `ProposalBuilderCanvas.tsx` | Passes `optionPricingCompleteById` to tabs (status slice only) |
| `ProposalBuilderClient.tsx` | Passes `selectedOptionPricingStatus` to rail |
| `proposalBuilderConstants.ts` | Status pill styles + label helpers |

**Guardrail copy mapping (informational only — no enforcement):**

| `guardrailOutcome` | Display |
|--------------------|---------|
| `pass` | Pass |
| `warn` | Warning |
| `block` | Blocked |

**3I-2C explicitly did not change:** document line prices, totals footer, preview banner, disabled Preview/Send/Sign/Payment.

### Boundaries preserved (3I-2 full)

- **Preview / Send / Sign / Payment** remain **disabled** (`ProposalBuilderDisabledActions.tsx` unchanged).
- **No proposal persistence** — no proposal records, line snapshots, or Supabase writes from Builder pricing preview.
- **No SQL/migrations.**
- **No PDF / send / sign / payment / status** adapters.
- **No old estimator / saved estimate / `loadSaved` paths** in Builder pricing wiring.
- **No protected systems touched** — `RoofingClient.tsx`, `SavedClient.tsx`, `estimateStore`, payments tables/APIs unchanged.
- **No company pricing policy UI** — preview uses `BUILDER_PREVIEW_PRICING_POLICY` only.
- **No editable margin / tax / discount controls.**
- **No internal profitability drawer/rail** (cost/profit/margin dollars deferred to **3I-3**).

### Test coverage (3I-2 checkpoint)

| Suite | Result | Command |
|-------|--------|---------|
| Orchestrator tests | **9/9 pass** | `npx tsx --test app/lib/proposalBuilderPricingPreview.test.ts` |
| Engine tests | **22/22 pass** | `npx tsx --test app/lib/proposalPricingEngine.test.ts` |
| Mapper tests | **16/16 pass** | `npx tsx --test app/lib/proposalPricingInputMapper.test.ts` |
| Typecheck | **6** pre-existing `RoofingClientV2.tsx` errors only | `npx tsc --noEmit` |

### Visual / RoofrExact guardrails (3I-2)

- Builder remains **proposal-document-first** — not a pricing spreadsheet or admin table.
- **Customer prices/totals only inside the document canvas** (white document page).
- **Internal pricing/profitability still deferred** — no cost/profit/margin dollars in any 3I-2 UI surface.
- **Option tabs** are package selectors with small status pills — **not** quote-comparison cards with dollar totals.
- **Right rail** shows informational pricing status only — **not** a profitability dashboard.
- **Persistent placeholder pricing banner required** because policy is temporary preview-only.
- **50% margin is preview-only** — not company configuration, not a customer quote.

### Remaining known notes / future polish

| Note | Detail |
|------|--------|
| Catalog setup price fallback | Opus review: `LinePriceCell` may still show catalog setup price label when `lineView` is undefined (edge case before preview computes); tighten in a future polish pass if needed |
| Preview policy | `BUILDER_PREVIEW_PRICING_POLICY` is temporary — not persisted, not company truth |
| Company/template pricing settings | **Not built yet** — decide in **3I-3** planning |
| Internal profitability rail/drawer | **Deferred to 3I-3** (cost/profit/margin dollars) |
| Proposal snapshots / persistence | **Deferred to 3J** |
| PDF / send / sign / payment adapters | **Deferred to 3K** |
| Line-level tax, `"whole"` rounding, `raw_plus_waste`, coverage/bundle conversion | Deferred per §6I |
| Material orders / work orders / invoices | Later |

### Next recommended path (no code until planned)

**Do not jump straight to more UI.** Run an **Opus architecture pass** to choose the next phase:

| Candidate | Question |
|-----------|----------|
| **3I-3** — Company pricing policy + internal profitability | Do we build company pricing policy controls and internal profitability rail **first**? |
| **3J** — Proposal snapshot persistence | Or proposal record / line snapshot persistence **first**? |

**Decided (Opus architecture pass, `38081c0`):** **3I-3 before 3J**, starting with **3I-3A pricing-policy source-of-truth spec (docs/types only)** — see **§6L**. Rationale: persisting/snapshotting the placeholder 50% policy would persist a lie; real company/template pricing must exist before proposal records/snapshots; draft pricing stays **live** until send per `PRICING_SNAPSHOT_INTENTS`.

---

## 6L. PRICING POLICY SOURCE OF TRUTH — 3I-3A SPEC (docs/types only — no runtime)

**Status:** Specification slice. **No runtime behavior, no UI, no SQL, no persistence, no engine/mapper/orchestrator change.** Locks the pricing-policy source of truth **before** any further pricing UI (3I-3B/C), persistence (3J), or migrations. Builder still runs `BUILDER_PREVIEW_PRICING_POLICY` (50% placeholder) until 3I-3B.

### 1. Why 3I-3A comes before 3J

- **Persisting the placeholder = persisting a lie.** `BUILDER_PREVIEW_PRICING_POLICY` is a loudly-disclaimed 50% margin ("not your company's configured pricing. Not a customer quote."). A proposal record or snapshot of those numbers gives permanence to data the UI itself says is fake.
- **Real policy is the precondition for meaningful persistence.** Company (and later template/job) pricing must resolve to real numbers before a draft proposal or a snapshot has value.
- **Draft pricing stays live until send.** The 3I-0 contract already encodes this — every field class in `PRICING_SNAPSHOT_INTENTS` is `liveOnlyInDraft: true` with `freezeStage: "freeze_on_send"` (or `lock_on_sign` for `option_selection`). A draft proposal record can exist while pricing recomputes live; it does **not** freeze policy.
- **Snapshot/freeze belongs at send, not now.** Building freeze/lock semantics before send exists is speculative.

### 2. Pricing policy source precedence (proposed)

Resolution order for the effective `PricingPolicy` (highest precedence wins per field, later layers optional and deferred):

1. **Company default pricing policy** — the base real policy (3I-3B target source).
2. **Template override** *(optional, later)* — per-`ProposalTemplate` adjustments; **deferred**.
3. **Proposal/job override** *(optional, later)* — per-proposal adjustments; **deferred**.

**Fallback when no company policy exists:**

- Builder must remain **clearly labeled preview-only** (existing banner) **or block sendability**.
- The placeholder may be used **only** as a labeled preview default — never silently treated as real configuration.

**Decided:**

- **3I-3B replaces `BUILDER_PREVIEW_PRICING_POLICY` with resolved company policy** in the production-ready Builder pricing path.
- Until company policy is configured, Builder stays preview-only / non-sendable.

### 3. Placeholder policy retirement plan

`BUILDER_PREVIEW_PRICING_POLICY`:

- **Is temporary** — preview-only assumption.
- **Must not be persisted.**
- **Must not be snapshotted.**
- **Must not be treated as company configuration.**
- **Replaced by resolved company policy in 3I-3B.**
- Banner copy remains required while any placeholder/preview policy is in effect.

### 4. Company pricing policy settings (future fields — 3I-3B)

Real company policy will source these (shape mirrors existing `PricingPolicy`):

| Field | 3I-3B intent |
|-------|--------------|
| `profitabilityType` | `margin` \| `markup` |
| `defaultProfitabilityPct` | company default |
| `minimumProfitabilityPct` | company floor (guardrail input) |
| `quantityRounding` | **`exact` only** for now |
| `wasteModel` | **`adjusted_measurement` only** for now |
| `salesTaxRatePct` | company default sales tax |
| `materialPurchaseTaxRatePct` | internal material purchase tax (materials-only) |
| `discount` policy | **deferred** unless explicitly scoped |
| `subtotalOverrideCents` | **deferred** |
| manager override | **deferred** |

### 5. Guardrail policy

- Guardrail remains **return-only** (`pass | warn | block`) — see §6I/§6J.
- Rep/manager behavior stays **typed but not enforced**.
- **Enforcement / send-blocking deferred.**
- **Manager override deferred.**

### 6. Draft/live vs snapshot/freeze model (confirm — no change)

- **Builder draft pricing is live / recomputed** every render from current job/measurement/catalog/template + resolved policy.
- **Proposal draft record (3J) persists references / option selection / customer copy — not frozen pricing.**
- **Snapshot freezes pricing at send** (`freeze_on_send`).
- **`lock_on_sign`** remains later for signed option/terms.
- `PRICING_SNAPSHOT_INTENTS` already supports this; **no behavior change** in 3I-3A. Additive types/JSDoc only if clarification is needed.

### 7. 3I-3B (next after 3I-3A)

- Resolve **company pricing policy** (precedence layer 1).
- **Remove placeholder** from the production-ready Builder pricing path.
- **Minimal settings / source only** — not a full pricing admin suite.
- **SQL only if** policy cannot live in an existing company/settings structure.
- **No internal profitability rail yet.**

### 8. 3I-3C (after 3I-3B)

- Internal profitability rail/drawer — **after** real policy resolution.
- May show internal cost / profit / margin **dollars**.
- **Internal-only** — never customer-facing.
- **Does not** enable send / sign / payment.

### 9. 3J (after 3I-3)

- **3J0** — proposal snapshot/record architecture, **docs/types only**.
- **3J1** — SQL + draft records, **after** policy source is real.
- **No PDF / send / sign / payment** until 3J is stable.

### 10. Decisions required before any SQL

1. **Where company pricing policy is stored** (existing company/settings store vs new table).
2. **Whether template overrides exist** (and precedence).
3. **Whether proposal/job overrides exist** (and precedence).
4. **What a draft proposal persists vs recomputes** (persist references/selection/copy; recompute pricing live until send).
5. **Lifecycle states** (draft → sent → signed) and which `freezeStage` each triggers.
6. **Freeze-stage rules** confirmed against `PRICING_SNAPSHOT_INTENTS`.
7. **Policy versioning / audit expectations** (does a sent proposal record which policy version produced it?).

### Boundaries (3I-3A)

- **No** runtime behavior, UI, SQL/migrations, persistence, or snapshots.
- **No** engine / mapper / orchestrator / Builder UI changes.
- **No** PDF / send / sign / payment / status.
- **No** old estimator / saved-estimate / `loadSaved` coupling.
- **No** protected systems touched.
- Optional: additive types/JSDoc in `proposalPricingTypes.ts` only — no engine behavior, no runtime UI imports.

---

## 6M. COMPANY PRICING POLICY RESOLVER — 3I-3B1 (pure lib + tests — no SQL/UI/Builder)

**Status:** **3I-3B1 complete (pending review).** Pure policy-resolution contract only. **No SQL, no UI, no Builder wiring, no orchestrator change.** Builder still uses `BUILDER_PREVIEW_PRICING_POLICY` until **3I-3B3**.

### 1. What shipped (3I-3B1)

| Artifact | Role |
|----------|------|
| `app/lib/companyPricingPolicy.ts` | Pure resolver: `resolveCompanyPricingPolicy(source)`, `validateCompanyPricingPolicy`, `DEFAULT_STARTER_PRICING_POLICY`, `resolveStarterPricingPolicySeed` |
| `app/lib/companyPricingPolicy.test.ts` | Node built-in tests — configured/missing/invalid/starter/pass-through/stable shape |
| **§6M (this section)** | Handoff lock for 3I-3B split |

**Resolution contract (`CompanyPricingPolicyResolution`):**

- `configured: boolean` — `true` only when a **valid stored company policy** was supplied.
- `source: "company" \| "starter_default" \| "missing"` — where the result came from.
- `policy: PricingPolicy \| null` — resolved policy when configured; `null` when missing/invalid.
- `reason: string \| null` — human-readable message when not configured.

**Rules (locked):**

- Real stored company policy present and valid → `configured: true`, `source: "company"`.
- Missing or invalid policy → `configured: false`, `source: "missing"`, `policy: null` — **never** silently treat starter as real company policy.
- `DEFAULT_STARTER_PRICING_POLICY` / `resolveStarterPricingPolicySeed()` → settings-form seed only (`source: "starter_default"`, `configured: false`). **Not persisted, not snapshotted, not sendable, not a customer quote.**
- No Supabase, localStorage, `companyProfile.ts`, I/O, writes, or runtime side effects.

**Validation alignment (post-3I-3B2B fix):** resolver, store, DB migration, and engine now **agree on margin policies** — for `profitabilityType === "margin"`, both `defaultProfitabilityPct` and `minimumProfitabilityPct` must be **`< 100`** (margin `>= 100` is unpriced in the engine and rejected by the migration CHECK). **Markup 100 remains valid.** This rule is centralized in `validateCompanyPricingPolicy`; the store's `validateStorableCompanyPricingPolicy` **delegates** to it (no divergent store rule), so a margin-100 policy can never be validated, resolved-as-configured, or written.

### 2. Storage decision (for 3I-3B2 — not implemented in 3I-3B1)

- **Preferred:** new **`company_pricing_policies`** table (one row per company, FK to `companies`).
- **Rejected/deferred:** adding pricing columns directly to **`companies`** — blast radius too high; profile row already owns unrelated fields.
- **3I-3B2 next:** migration + read/write store that feeds `storedPolicy` into `resolveCompanyPricingPolicy()`.

### 3. Precedence (unchanged from §6L — 3I-3B scope)

1. **Company default pricing policy** — **first and only real source in 3I-3B** (layer 1).
2. **Template override** — **deferred**.
3. **Proposal/job override** — **deferred**.

**Missing policy:** Builder remains **preview-only / non-sendable** (existing banner + placeholder until 3I-3B3 wiring).

**Placeholder policy lock (unchanged):** `BUILDER_PREVIEW_PRICING_POLICY` (50% margin preview default) **must not** be persisted, snapshotted, or treated as company configuration. It remains Builder preview-only until **3I-3B3** retires it on the configured path.

**3J deferral:** Proposal records/snapshots (**3J**) remain **deferred until real company policy exists** (3I-3B2 + 3I-3B3). Do not persist or snapshot placeholder/starter policy values.

### 4. Next slices

| Slice | Scope |
|-------|--------|
| **3I-3B2** | Persistence decision + SQL migration + store (`company_pricing_policies`) |
| **3I-3B3** | Settings UI + wire Builder Client to pass resolved `policy` + retire `BUILDER_PREVIEW_PRICING_POLICY` on configured path |
| **3I-3C** | Internal profitability rail (after real policy) |
| **3J** | Proposal snapshots/persistence — **after 3I-3** |

### 5. Boundaries (3I-3B1)

- **No** SQL/migrations, UI, Builder/orchestrator/engine/mapper changes.
- **No** PDF / send / sign / payment / status.
- **No** proposal persistence or snapshots.
- **No** protected systems touched.

---

## 6N. COMPANY PRICING POLICY PERSISTENCE — 3I-3B2 (migration + store — no UI/Builder)

**Status:** **3I-3B2A migration committed** (`76b87b8`) and **manually applied** (3I-3B3a — §6O); **3I-3B2B store committed** (`b5bbc7f`); **3I-3B3 path complete** (`003e00b` settings UI + `79c4b02` Builder wiring — §6P/§6Q/§6R). On the **configured path**, Builder uses saved company policy; on **missing/loading/error**, orchestrator placeholder fallback remains.

### 1. 3I-3B2A — migration (`76b87b8`)

- `supabase/migrations/20260605_005_create_company_pricing_policies.sql` — committed schema; **applied manually** in Supabase SQL Editor (see **§6O**).
- One row per company (`unique(company_id)`), FK → `companies(id) on delete cascade`.
- Flat typed columns + CHECK constraints (no JSONB for locked fields; `metadata jsonb` is a forward-compat hook only).
- Margin policies enforced `< 100` (default and minimum); markup may be `<= 100`. `minimum <= default`. Tax `>= 0` / null.
- **No** discount columns, **no** subtotal-override columns, **no** seed data; `companies` untouched.
- RLS enabled; four `company_memberships`-scoped policies; reuses shared `public.set_updated_at()` trigger.

### 2. 3I-3B2B — store (`app/lib/companyPricingPolicyStore.ts`)

- Follows **`catalogStore.ts`** conventions: `getSupabaseClient()` + RLS, local `CompanyPricingPolicyRow` type (no generated Supabase types), `COMPANY_PRICING_POLICY_SELECT_COLUMNS`, pure row↔policy mappers, `isUuidLike` + nullable-number normalization, returns `null`/resolver-miss on failure with `console.error`.
- **No localStorage cache** — a stale cached policy is exactly the "fake configured" risk the resolver prevents.
- **No** `companyProfile` import, Builder import, or proposal/payment/PDF/send write. **No delete** function this phase.

**Store API:**

| Function | Returns |
|----------|---------|
| `getCompanyPricingPolicy(companyId)` | `PricingPolicy \| null` (mapped row) |
| `getResolvedCompanyPricingPolicy(companyId)` | `CompanyPricingPolicyResolution` (feeds row into `resolveCompanyPricingPolicy`) |
| `upsertCompanyPricingPolicy(companyId, policy)` | `PricingPolicy \| null` (validate → upsert `on conflict (company_id)`) |

**Write rules:** validates with `validateStorableCompanyPricingPolicy` before any write; invalid policy is refused; **starter default is never auto-saved** (callers pass explicit user-edited policy); `created_by`/`updated_by` left null (no auth complexity this slice).

**Storable validation layer:** `validateStorableCompanyPricingPolicy` is a thin store entry point that **delegates to `validateCompanyPricingPolicy`** — the single source of truth. The `margin < 100` rule lives in the resolver (see §6M validation-alignment note), so resolver, store, DB migration, and engine cannot drift. The named store export is retained as a clear "is this writable?" hook and a home for any future store-only checks.

**Mapping:** row → policy maps the locked fields; `discount`/`subtotalOverrideCents` always `null`. policy → row emits locked columns only — never discount or subtotal-override fields.

### 3. Unchanged locks

- `company_pricing_policies` remains the **preferred** table (columns on `companies` rejected — blast radius).
- **Missing policy** still means Builder remains **preview-only / non-sendable**.
- Placeholder 50% policy must not be persisted, snapshotted, or treated as company configuration.
- **3J** deferred until real company policy is wired.

### 4. Next slices (3I-3B3 split)

| Slice | Scope |
|-------|--------|
| **3I-3B3a** | **DONE** — manual migration apply + verify (§6O); no app code |
| **3I-3B3b** | **DONE** — minimal settings UI at `/tools/settings/pricing` (§6P); no Builder wiring |
| **3I-3B3c** | **DONE** — Builder wiring (`79c4b02`): `getResolvedCompanyPricingPolicy` → orchestrator `policy` when configured (§6Q); placeholder fallback when missing |
| **3I-3B3d** | **Skipped** — copy/status polish absorbed into 3I-3B3c; no separate slice needed unless gaps found in review |

### 5. Boundaries (3I-3B2B)

- **No** UI, Builder wiring, orchestrator/engine/mapper changes.
- **No** new migration in 3I-3B2B/3I-3B3a (apply only; SQL file unchanged at `76b87b8`).
- **No** proposal persistence/snapshots, PDF/send/sign/payment/status, old estimator.
- **No** protected systems touched.

---

## 6O. MANUAL MIGRATION APPLY — 3I-3B3a (environment action — no app code)

**Status:** **3I-3B3a complete.** Environment action only — **no app code changed**, **no commit** for the apply itself, **no seed data inserted**, **`companies` table untouched**.

### 1. What was done

- User **intentionally** ran `supabase/migrations/20260605_005_create_company_pricing_policies.sql` manually in the **Supabase SQL Editor**.
- Supabase UI target shown as: **TradeTools AI / tradetools-ai / main / production** (user-selected project; applied per user decision).
- Additive migration only: creates `public.company_pricing_policies`; does not alter `public.companies`.

### 2. Verification (post-apply SQL)

**Table exists:**

```sql
select to_regclass('public.company_pricing_policies');
-- Result: public.company_pricing_policies
```

**RLS policies verified:**

- `company_pricing_policies_delete_company_scope`
- `company_pricing_policies_insert_company_scope`
- `company_pricing_policies_select_company_scope`
- `company_pricing_policies_update_company_scope`

**Constraints verified (key):**

- `company_pricing_policies_company_id_unique`
- `company_pricing_policies_margin_default_lt_100_check`
- `company_pricing_policies_margin_minimum_lt_100_check`
- `company_pricing_policies_quantity_rounding_check` (`exact` only)
- `company_pricing_policies_waste_model_check` (`adjusted_measurement` only)
- Plus: profitability type (`margin` \| `markup`), percent range, sales tax, material tax, `minimum <= default` checks

### 3. Unchanged

- No app code changed for 3I-3B3a.
- Builder still uses `BUILDER_PREVIEW_PRICING_POLICY` until **3I-3B3c**.
- Store (`b5bbc7f`) can now read/write the table when a company policy row exists.

### 4. Next

- **3I-3B3b** — minimal company pricing policy settings UI only.

### 5. Boundaries (3I-3B3a)

- **No** app code, UI, Builder wiring, orchestrator/engine/mapper changes.
- **No** SQL/migration file edits.
- **No** proposal persistence/snapshots, PDF/send/sign/payment/status, old estimator.
- **No** protected systems touched.

---

## 6P. COMPANY PRICING POLICY SETTINGS UI — 3I-3B3b

**Status:** **3I-3B3b complete** (`003e00b`). UI-only slice at `/tools/settings/pricing`. Builder wiring delivered in **3I-3B3c** (`79c4b02`). Migration was already applied manually in 3I-3B3a (§6O).

### 1. Route

- New route **`/tools/settings/pricing`**.
- Server wrapper `app/tools/settings/pricing/page.tsx` resolves `companyId` server-side via the existing `getUserCompanyId` pattern (same as Builder): `createClient()` → `auth.getUser()` → `ensureUserIdentity()` → `getUserCompanyId()`. If unauthenticated / no company, it redirects to `/login?redirectTo=/tools/settings/pricing` (safe blocked path; no `getCurrentCompanyId` duplication).
- `companyId` is passed as a prop into the client component.

### 2. Client component

`app/tools/settings/pricing/CompanyPricingPolicySettingsClient.tsx`:

- On load: `getResolvedCompanyPricingPolicy(companyId)`.
  - `configured: true` → form pre-fills from the resolved policy; status label **“Company pricing policy configured.”**
  - `configured: false` → form pre-fills from `resolveStarterPricingPolicySeed()`; status label **“Starter defaults — not saved yet.”**
- **Starter defaults never auto-save.** Save only on user click → `upsertCompanyPricingPolicy(companyId, policy)`.
- After save, re-fetch via `getResolvedCompanyPricingPolicy(companyId)` and reflect configured state. Success/error states surfaced.
- **No** localStorage, **no** proposal writes, **no** Builder writes.

### 3. Form fields

- **Editable:** `profitabilityType` (margin/markup), `defaultProfitabilityPct`, `minimumProfitabilityPct`, `salesTaxRatePct`, `materialPurchaseTaxRatePct` (empty input → `null`).
- **Display-only locked:** `quantityRounding = exact`, `wasteModel = adjusted_measurement`.
- **Not rendered/forced null:** `discount`, `subtotalOverrideCents` (always `null`); no template/job/manager overrides.

### 4. Pure form utilities + validation

`app/tools/settings/pricing/pricingPolicyFormUtils.ts` (no React, no Supabase, no I/O):

- `policyToPricingPolicyFormState(policy)`, `starterSeedToPricingPolicyFormState(resolution)`, `pricingPolicyFormStateToPolicy(formState)`, `validatePricingPolicyFormState(formState)`.
- Validation **delegates to `validateCompanyPricingPolicy`** (resolver contract — same single source of truth shared with store + DB). No drift: margin < 100 blocked, markup 100 allowed, minimum > default blocked, negative tax blocked, empty material tax → null.
- Tests: `app/tools/settings/pricing/pricingPolicyFormUtils.test.ts` — **17** passing (mapping, locked fields, margin/markup boundaries, tax rules, starter seed carries no `configured` flag).

### 5. Settings link

- `app/tools/settings/page.tsx`: added a single navigation card linking to `/tools/settings/pricing`. Company profile save behavior unchanged; no settings restructure.

### 6. Boundaries (3I-3B3b)

- **No** Builder wiring or Builder pricing-behavior change; placeholder policy still active in Builder until **3I-3B3c**.
- **No** engine / mapper / `proposalBuilderPricingPreview` changes; **no** SQL/migrations; **no** proposal records/snapshots; **no** PDF/send/sign/payment/status; **no** old estimator/saved-estimate paths; **no** `package.json`/lockfiles.

### 7. Next

- **3I-3B3c** — committed (`79c4b02`). See **§6Q** and path-complete summary **§6R**.

---

## 6Q. BUILDER COMPANY PRICING POLICY WIRING — 3I-3B3c

**Status:** **3I-3B3c complete** (`79c4b02`). Builder-only slice — **no orchestrator/engine/mapper/settings/SQL changes**. Preview / Send / Sign / Payment remain **disabled**. No proposal persistence/snapshots.

### 1. Policy source (Builder)

`ProposalBuilderClient.tsx`:

- Uses existing `companyId` prop.
- Calls **`getResolvedCompanyPricingPolicy(companyId)` only** — **never** raw `getCompanyPricingPolicy`.
- **Never** imports `DEFAULT_STARTER_PRICING_POLICY` or auto-saves/writes policy from Builder.
- `configured: true` with valid `policy` → passes `policy` into `buildProposalBuilderPricingPreview({ ..., policy })`.
- `configured: false`, loading, or error → **omits** `policy` so orchestrator falls back to `BUILDER_PREVIEW_PRICING_POLICY` (50% margin placeholder).
- `pricingPreview` `useMemo` depends on `configuredPolicy` so totals recompute when resolution loads.

### 2. Copy / display (conditional)

Driven by `pricingPolicyConfigured` boolean (prop plumbing only through Canvas → SectionPreview / DocumentTotals):

| State | Document totals banner | Line footer | Summary rail |
|-------|------------------------|-------------|--------------|
| **Configured** | “Preview based on your company pricing. Not a sent quote.” (softer slate banner) | Company pricing preview copy | **Pricing policy: Configured** |
| **Not configured** | Strong placeholder 50% margin warning + link to `/tools/settings/pricing` | Placeholder warning copy | **Pricing policy: Not configured** |
| **Loading** | Placeholder until load completes | Placeholder | **Pricing policy: Checking…** |

Constants live in `proposalBuilderConstants.ts`. **No pricing math or totals logic changed.**

### 3. Summary rail (status-only)

`ProposalBuilderSummaryRail.tsx` — new **Pricing policy** row: Configured / Not configured / Checking. No dollars, no policy detail, no edit controls, no internal cost/profit/margin.

### 4. Boundaries (3I-3B3c)

- **No** engine / mapper / `proposalBuilderPricingPreview` changes.
- **No** settings UI changes; **no** SQL/migrations.
- **No** proposal records/snapshots; **no** PDF/send/sign/payment/status; **no** old estimator paths.
- **No** enabling Preview / Send / Sign / Payment.

### 5. Next

- Path complete — see **§6R** for checkpoint; **§6S** for architecture roadmap (next: **3I-3C**).

---

## 6R. CHECKPOINT — 3I-3B3 COMPANY PRICING POLICY PATH COMPLETE

**Status:** **3I-3B3 complete** (`79c4b02` latest commit). End-to-end company pricing policy path from resolver → persistence → settings UI → Builder wiring is **done**. **No code until next phase is explicitly scoped.**

### 1. Committed sequence (3I-3B3)

| Slice | Commit | What shipped |
|-------|--------|--------------|
| **3I-3B3a** | `630d278` (docs) | `company_pricing_policies` migration **manually applied** in Supabase SQL Editor and verified (§6O). Target: TradeTools AI / tradetools-ai / main / production. |
| **3I-3B3b** | `003e00b` | Settings UI at **`/tools/settings/pricing`** — save/load company policy via store; starter seed pre-fill only; no auto-save (§6P). |
| **3I-3B3c** | `79c4b02` | Builder reads **`getResolvedCompanyPricingPolicy(companyId)` only**; passes real `policy` when configured; placeholder fallback when missing/loading/error (§6Q). |

Underlying foundation (pre-3I-3B3): **3I-3B1 resolver** (`c1b52ee`), **3I-3B2A migration SQL** (`76b87b8`), **3I-3B2B store** (`b5bbc7f`).

### 2. Builder behavior (post-3I-3B3c)

- **Configured company policy exists** → Builder passes resolved `policy` into `buildProposalBuilderPricingPreview`; customer document prices reflect saved company profitability/tax settings.
- **Missing / loading / error / not configured** → Builder **omits** `policy`; orchestrator uses `BUILDER_PREVIEW_PRICING_POLICY` (50% margin placeholder).
- **Raw `getCompanyPricingPolicy` is not used by Builder.**
- **`DEFAULT_STARTER_PRICING_POLICY` is not used by Builder** (settings seed only; never masquerades as configured).
- Conditional copy: configured path softens banner/footers; unconfigured path keeps strong placeholder warning + link to `/tools/settings/pricing`.
- Summary rail: **Pricing policy** status-only row (Configured / Not configured / Checking) — no dollars, no policy detail.

### 3. Explicitly unchanged / not started

- **Preview / Send / Sign / Payment** remain **disabled** in Builder.
- **No proposal persistence / snapshots** (3J not started).
- **No PDF / send / sign / payment / status** flows touched.
- **No old estimator / saved-estimate / loadSaved** paths touched.
- **No internal profitability rail** (3I-3C not started — internal cost/profit/margin dollars still deferred).
- **No 3J0 proposal record architecture** yet.
- **Catalog custom delete/deactivate** — **not implemented**; separate later scope; **do not mix into pricing work**.

### 4. Verification at checkpoint

- **Tests:** **103/103** pass (form utils 17 + resolver 18 + store 21 + orchestrator 9 + engine 22 + mapper 16).
- **Typecheck:** only **6** pre-existing errors in `app/tools/roofing-v2/RoofingClientV2.tsx`.
- Manual smoke passed for configured-policy Builder path (banner, line footer, rail status, pricing updates after settings save).

### 5. Next recommended

**Architecture decision closed** — see **§6S** for the full RoofrExact pricing → proposal roadmap.

| Phase | Scope | Status |
|-------|-------|--------|
| **3I-3C** | Internal profitability rail/drawer — contractor-only; customer document unchanged | **Done** (§6T — pending commit) |
| **3J0** | Proposal records / snapshot architecture — docs/types only | **Next** |

**Do not** start 3J1 persistence, enable send/PDF/sign/payment, or skip 3I-3C. **Do not** bundle catalog delete/deactivate into pricing/proposal work.

---

## 6S. ROOFR-EXACT PRICING → PROPOSAL ARCHITECTURE ROADMAP

**Status:** **Architecture roadmap locked** (docs only — no app code). **Checkpoint:** `eec7c78` / **3I-3B3 complete** (`79c4b02`). **Purpose:** Prevent drift before implementation continues. **Read this section before scoping any post-3I-3B3 work.**

### 1. Key verdict

- **3I-3C internal profitability rail is next** — not 3J0, not send/PDF, not persistence.
- **3I-3C is not optional compared to 3J0** — it is the **trust gate** before snapshots. Contractors must verify live cost/profit/margin **before** anything is frozen into proposal records/snapshots.
- **The pricing engine already computes internal profitability** — `ProposalOptionPricing.internalCostCents`, `internalProfitCents`, `effectiveMarginPct`; per-line `profitCents`, `marginPct`, `markupPct` in `proposalPricingTypes.ts` / engine output. **It is not surfaced in the UI yet.**
- **Do not freeze numbers before they are visible/trusted.** Building snapshots (3J2) before the contractor can see live margin (3I-3C) risks freezing wrong numbers.
- **3J0 (docs/types) follows 3I-3C** — snapshot field classification and lifecycle states are designed on paper only after live margin is visible and trusted.

### 2. Phase order (RoofrExact arc)

| Phase | ID | Name | Nature | Gate it unlocks |
|-------|-----|------|--------|-----------------|
| **P1** | **3I-3C** | Internal profitability rail/drawer | UI only — read-only, contractor-only | Contractor trusts live pricing |
| **P2** | **3I-3D** | Guardrail surfacing | UI only — optional small follow-up | Visible warn/block before send (no enforcement yet) |
| **P3** | **3J0b** | Proposal record + snapshot architecture | **Docs/types** — **done** (`3ae5e39`, §6Z) |
| **P4** | **3J1** | Proposal draft record | SQL **committed + applied + verified** (§6AA); lib store **done** (§6AB) | Draft has id; survives reload |
| **P5** | **3J2** | Proposal persistence spine (mapper + builder + store) | **Done** (`1033cd9`–`13b4e72`, §6AB) | Draft graph can be written/read in lib layer |
| **P5b** | **3J3** | Job Card → persisted Builder draft flow | **Done** (`fc43849`–`e38b276`, §6AC) | Builder/Job Card use real proposal records |
| **P5c** | **3J3E** | Option selection persistence | **Done** (`a7249b3`, §6AE) | Builder option tab persists via `updateDraftSelectedOption` |
| **P5d** | **Pricing trust** | Snapshot display + stale refresh | **Done** (`ce3d6bc`, §6AF) | No mixed truth; stale banner; refresh re-stamps context |
| **P6** | **3K0** | Preview | UI — reads snapshot | Preview button can light up |
| **P7** | **3K1** | Send bridge | PDF + transmit | Send can light up |
| **P8** | **3K2** | Approval / signature state | SQL + UI | Sign can light up |
| **P9** | **3K3** | Deposits / payment schedule | SQL + UI | Payment can light up |
| **P10** | **3L** | Material / work orders / invoices | SQL + UI | Post-acceptance fulfillment |
| *(separate)* | — | Catalog delete/deactivate cleanup | Small UI/store slice | **Not on critical path** |

#### P1 / 3I-3C — Internal profitability rail/drawer

- **UI only** — read-only, contractor-only.
- **No SQL**, **no persistence**, **no customer exposure**.
- Uses existing engine/orchestrator internal fields (`ProposalOptionPricing`, line-level profitability from `ProposalPricingResult`).
- Recomputes live with existing Builder preview pipeline — no new pricing math.

#### P2 / 3I-3D — Guardrail surfacing (optional small follow-up)

- **UI only** — warn/block badge from `ProfitabilityGuardrailResult.outcome`.
- **No enforcement yet** — display only; send blocking deferred to 3K1+.

#### P3 / 3J0 — Proposal record + snapshot architecture

- **Docs/types only** — no SQL, no runtime bodies.
- Lifecycle states (draft → sent → signed → …).
- Draft/live vs freeze-on-send vs lock-on-sign (extends `PRICING_SNAPSHOT_INTENTS` in `proposalPricingTypes.ts`).
- Snapshot vs reference field map (what freezes at send; what stays a live reference).
- Revision / change-order rules (what bumps a version).

#### P4 / 3J1 — Proposal draft record

- **SQL + store** — `proposals` table (or equivalent).
- Draft has **id** and survives reload.
- **No send yet** — Preview/Send/Sign/Payment remain disabled.

#### P5 / 3J2 — Snapshot-on-send writer

- Snapshot builder + store.
- Freezes resolved pricing, quantities, policy echo (`policyEcho`), customer copy per P3 classification.
- **Still no send UI** until snapshot is stable and tested.

#### P6 / 3K0 — Preview

- Reads **snapshot** — not live Builder recompute.
- Preview button can light up **only after** snapshot exists and is stable.

#### P7 / 3K1 — Send bridge

- PDF + transmit adapters.
- Send can light up **only after** preview/snapshot stable.

#### P8 / 3K2 — Approval / signature state

- Customer-visible acceptance flow; contractor/internal status tracking.

#### P9 / 3K3 — Deposits / payment schedule

- Introduced **after** signed/accepted proposal (P8).
- Deposit/financing fields exist as types only in `ProposalPricingTotals` today — remain deferred until P9.

#### P10 / 3L — Material / work orders / invoices

- **Post-acceptance only** — data flows from accepted proposal lines.
- Too early before P8; no fulfillment tables until proposal acceptance model exists.

### 3. Why this order matches RoofrExact

1. **Trust before freeze** — Roofr shows contractor live margin in builder; P1 surfaces numbers already computed so correctness is verified before P5 snapshots.
2. **Snapshot intent already declared** — `PRICING_SNAPSHOT_INTENTS` in `proposalPricingTypes.ts`; P3 turns declaration into record schema on paper before SQL.
3. **Draft before snapshot** — snapshot = freeze the draft's resolved pricing; no draft id (P4) → nothing to freeze (P5).
4. **Customer document reads snapshot, not live builder** — P6 Preview / P7 Send / P8 Sign / P9 Payment each require stable frozen data; enabling buttons early violates RoofrExact.
5. **Payments follow approval; fulfillment follows acceptance** — P9 deposits only after P8 sign; P10 orders/invoices only after acceptance.

### 4. Hard guardrails (all phases)

- **Preview / Send / Sign / Payment** remain **disabled** until their **data prerequisites** exist (see phase table).
- **Customer document / PDF** must **never** show internal cost / profit / margin.
- **Placeholder pricing** (`BUILDER_PREVIEW_PRICING_POLICY`, 50% margin) must **never** be persisted or snapshotted — gate all persistence on configured company policy.
- **Old estimator / saved-estimate / loadSaved / estimateStore** remain **protected** — new proposal spine is separate.
- **Catalog delete/deactivate** is **separate scope** — must not mix into pricing/proposal commits.
- **No proposal SQL before 3J0 docs/types are locked.**
- **No snapshot SQL before field freeze/reference classification is locked** (P3 complete).
- **No PDF / send / sign / payment** until snapshot (P5) is stable.

### 5. Immediate next slice — 3I-3C only

**Scope:**

- Add internal profitability presenter utility + tests.
- Surface **option-level** internal cost / profit / effective margin in **right rail only** (`ProposalBuilderSummaryRail`).
- **Placeholder-aware labeling** — when policy unconfigured, label margin as placeholder / not real; never masquerade as configured profitability.
- **No customer document changes.**
- **No pricing math changes** (engine/mapper/orchestrator unchanged).
- **No SQL / persistence.**

**Files likely touched (3I-3C):**

| File | Role |
|------|------|
| `app/tools/roofing/proposals/builder/ProposalBuilderSummaryRail.tsx` | Surface internal profitability (contractor-only) |
| `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts` | Placeholder-aware copy constants |
| `app/lib/proposalProfitabilityPresenter.ts` | Pure presenter (format internal numbers + labels) |
| `app/lib/proposalProfitabilityPresenter.test.ts` | Unit tests |
| `docs/fielddive-global-handoff.md` | §6S checkpoint update after 3I-3C |
| `ProposalBuilderClient.tsx` / `ProposalBuilderCanvas.tsx` | **Optional** — prop threading only if rail cannot read preview result otherwise |

**Files forbidden (3I-3C):**

| File / area | Reason |
|-------------|--------|
| `app/lib/proposalPricingEngine.ts` | No pricing math changes |
| `app/lib/proposalPricingInputMapper.ts` | No pricing math changes |
| `app/lib/proposalBuilderPricingPreview.ts` | Forbidden unless read-only type access is absolutely unavoidable |
| `app/tools/roofing/proposals/builder/ProposalBuilderDocumentTotals.tsx` | Customer-facing — no internal numbers |
| Customer-facing line columns in `ProposalBuilderLinePreviewTable.tsx` | Customer-facing — no internal numbers |
| Settings files (`/tools/settings/pricing`, `companyPricingPolicy*`) | Out of scope |
| SQL / migrations | No persistence |
| APIs / send / payment / sign / status | Protected / deferred |
| Old estimator / saved-estimate / loadSaved paths | Protected |

**Tests / smoke (3I-3C):**

- Unit tests: presenter formatting, placeholder-policy labeling.
- Manual smoke: rail shows margin for configured policy; shows placeholder warning when unconfigured; **confirm no internal numbers in customer document**.
- Regression: **103/103** tests pass; typecheck unchanged (6 pre-existing `RoofingClientV2.tsx` errors only).

### 6. Drift risks to watch

1. **Freezing before trusting** — skip 3I-3C → snapshot wrong numbers.
2. **Placeholder leaking into persistence** — never write 50% placeholder as real policy/pricing.
3. **Internal numbers bleeding to customer document** — strict customer vs internal column boundary.
4. **Snapshot vs reference confusion** — live `catalog_item_id` where frozen unit price needed → sent doc mutates after send.
5. **Coupling proposal records to legacy estimate/payment KV** — keep spines separate.
6. **Enabling Preview/Send buttons early** — buttons stay disabled until data prerequisite exists.
7. **Revision semantics undefined** — decide in P3 before P5 snapshot writer.
8. **Catalog cleanup creeping into pricing commits** — keep isolated.

### 7. Catalog cleanup (separate scope)

- **Not on critical path** — does not block proposal correctness.
- Deactivate via existing catalog UI or SQL is sufficient for stray test rows.
- Scope as small standalone slice between phases if needed; **never bundle into 3I-3C or 3J commits**.

---

## 6T. INTERNAL PROFITABILITY RAIL — 3I-3C (contractor-only Builder rail)

**Status:** **3I-3C committed** (`3491e48`). **Prior checkpoint:** `9a7d5ac` (§6S roadmap). **Purpose:** Surface already-computed internal cost/profit/margin in the contractor-only Builder right rail — trust gate before 3J0 snapshots.

### 1. What shipped

| Deliverable | Location |
|-------------|----------|
| **Pure presenter** | `app/lib/proposalProfitabilityPresenter.ts` — format/label only; no pricing math |
| **Presenter tests** | `app/lib/proposalProfitabilityPresenter.test.ts` |
| **Orchestrator read-only extension** | `app/lib/proposalBuilderPricingPreview.ts` — `ProposalBuilderOptionInternalView` on `ProposalBuilderOptionPreview.internal` (pass-through from engine; no math change) |
| **Summary rail UI** | `ProposalBuilderSummaryRail.tsx` — internal profitability block |
| **Copy constants** | `proposalBuilderConstants.ts` — rail labels |
| **Client threading** | `ProposalBuilderClient.tsx` — passes `selectedOptionInternal` to rail |

### 2. Behavior

- **Contractor-only** — internal cost, profit, and effective margin appear **only** in the right rail internal profitability block.
- **Read-only** — no edit controls, no persistence, no SQL.
- **Option-level** — selected option's `internalCostCents`, `internalProfitCents`, `effectiveMarginPct` from orchestrator internal branch.
- **Configured company policy** → trusted internal dollars + margin when pricing complete (no blocking issues).
- **Missing/unconfigured/loading policy** → internal dollars **hidden**; placeholder-aware warning shown instead.
- **Blocking pricing issues** → internal dollars hidden; blocked warning shown.
- **Customer document unchanged** — `ProposalBuilderDocumentTotals`, customer line columns, option tabs remain customer-safe only.
- **Preview / Send / Sign / Payment** remain **disabled**.
- **No proposal persistence / snapshots** (3J not started).

### 3. Explicitly unchanged / forbidden

- **No pricing math changes** — engine, mapper, company policy resolver/store untouched.
- **No settings UI** changes.
- **No SQL / migrations**.
- **No PDF / send / sign / payment / status** paths touched.
- **Old estimator / saved-estimate / loadSaved / estimateStore** untouched.
- **Catalog delete/deactivate** — separate scope; not in this slice.

### 4. Verification (3I-3C)

- Unit tests: presenter formatting, placeholder/blocking/loading states.
- Orchestrator test: internal branch populated; customer views still leak-free.
- Manual smoke: ready Builder shows internal profitability in right rail only; customer document/option tabs clean; Preview/Send/Sign/Payment disabled; unconfigured policy does not show trusted internal dollars.
- Regression: full test suite + typecheck (6 pre-existing `RoofingClientV2.tsx` errors only).

### 5. Next recommended

| Phase | Scope | Status |
|-------|-------|--------|
| **3I-3D** | Builder rail pricing-confidence regrouping (rail-only) — **§6U** spec, **§6V** implementation | **Complete** (`fbdedbe`) |
| **3I-3D2A** | Builder navigation model decision — **§6Y** | **Complete** (`d3a969b`) |
| **3J0b** | Proposal records / versions / pages architecture — **§6Z** | **Complete** (`3ae5e39`; SQL applied §6AA) |
| **3J1** | Proposal SQL migrations + RLS | **Done** (applied §6AA) |
| **3J2** | Proposal stores + snapshot builder | **Complete** (`13b4e72`, §6AB) |
| **3J3** | Job Card → persisted Builder draft flow | **Complete** (`e38b276`, §6AC) |
| **3J3E** | Option selection persistence | **Done** (`a7249b3`, §6AE) |

**Do not** enable Preview/Send/Sign/Payment until **3K+**. See **§6AC** phase boundaries and **§6AE** for 3J3E completion. **3I-3D2 visual work** remains deferred until smoke passes.

---

## 6U. BUILDER RAIL PRICING-CONFIDENCE GROUPING SPEC — 3I-3D0 (docs/spec only)

**Status:** **Spec locked** (docs only — no app code). **Checkpoint:** `23bbb8e` (clean); pricing/proposal checkpoint `3491e48` (§6T). **Purpose:** Define the RoofrExact Builder right-rail regrouping before implementing **3I-3D1**. **Read before any rail change.**

### 1. Verdict

- **No broad page redesign.** The current 3-column Builder layout (`12rem nav / canvas / 17rem rail`, `ProposalBuilderWorkspaceLayout.tsx`) is acceptable / RoofrExact-enough for now.
- **Do not blindly add another badge.** The problem is rail **structure**, not a missing pill.
- **Root issue:** the rail mixes **setup readiness** (measurement/quantities/catalog/template) and **pricing confidence** (policy/pricing status/guardrail/internal profitability) under a single flat "Job context" stack. Guardrail is buried as the third text line inside "Option pricing."
- **3I-3D is a rail-only regrouping** — headings, ordering, labels, a dedicated guardrail row, and copy de-duplication. Nothing else.

### 2. Desired rail structure

RoofrExact: the **customer document canvas** carries customer truth (price/status only); the **contractor rail** carries contractor intelligence, grouped by concern. Replace the single "Job context" header with two labeled groups + an actions note.

**Group 1 — Setup readiness** ("Can I price this?")

| Row | Value |
|-----|-------|
| Measurement | Ready / Not ready |
| Quantities | summary |
| Record | label (optional row — only when present) |
| Catalog | readiness pill · N active |
| Template | readiness pill · template name |

**Group 2 — Pricing confidence** (contractor-only — "Is the price good and safe?")

| Row | Value |
|-----|-------|
| Pricing policy | Configured / Not configured / Checking… |
| Pricing status | Complete / Incomplete |
| Blocking lines | count |
| Guardrail | Pass / Warning / Blocked |
| Internal profitability | cost / profit / margin, **or** warning copy when hidden |

**Actions status note** (status-only):

- Preview / Send / Sign / Payment remain **disabled** until the proposal record/snapshot phases (3J+).
- **No action enablement in 3I-3D.**

### 3. Guardrail decision

- Guardrail becomes its **own visible row** in the Pricing confidence group (today it is a text line under "Option pricing").
- Labeling: **Pass / Warning / Blocked** (reuse `formatGuardrailOutcomeLabel`; add a small pass/warn/block pill class in `proposalBuilderConstants.ts`).
- **Status-only.** No enforcement, no send-gating, no manager approval or override in 3I-3D.

### 4. Dedup rule

- Avoid repeating "Configured / Complete" wording across rows.
- **Pricing policy** owns Configured / Not configured / Checking.
- **Pricing status** owns Complete / Incomplete (rename from "Option pricing" — "option" is redundant with the tabs).
- **Internal profitability** must **not** restate policy/completeness status **except** in its warning/hidden state (e.g. placeholder or blocking → short warning explaining why dollars are hidden).

### 5. Allowed changes in 3I-3D1

- `app/tools/roofing/proposals/builder/ProposalBuilderSummaryRail.tsx`
- `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts`
- `docs/fielddive-global-handoff.md` (completion note)
- Scope limited to: rail ordering, group headings, labels, the new guardrail row, copy cleanup. No new props or client wiring expected — the rail already receives `selectedOptionPricingStatus` (carries `guardrailOutcome`) and `selectedOptionInternal`.

### 6. Forbidden changes (3I-3D)

- No page grid redesign (`ProposalBuilderWorkspaceLayout.tsx`).
- No document canvas changes (`ProposalBuilderCanvas.tsx`).
- No option tab changes (`ProposalBuilderOptionTabs.tsx`).
- No Preview / Send / Sign / Payment enablement (`ProposalBuilderDisabledActions.tsx`).
- No pricing math / engine / mapper / orchestrator changes (`proposalPricingEngine.ts`, `proposalPricingInputMapper.ts`, `proposalBuilderPricingPreview.ts`).
- No customer document changes (`ProposalBuilderDocumentTotals.tsx`, customer columns in `ProposalBuilderLinePreviewTable.tsx`).
- No internal cost/profit/margin in customer document / PDF.
- No SQL / persistence / snapshots.
- No settings / catalog changes.
- No old estimator / saved-estimate / loadSaved / `estimateStore` changes.

### 7. Next sequence

| Slice | Scope |
|-------|-------|
| **3I-3D0** | This spec (docs only) |
| **3I-3D1** | Rail-only implementation per §6U §2–§4 — **done** (`fbdedbe`) |
| **3I-3D2A** | Builder navigation model decision — **§6Y** (docs only) — **done** |
| **3I-3D2** | Hybrid Page Context Strip scaffold — **§6Y** + **§6W** |
| **3J0** | Proposal record / snapshot architecture — docs/types only |

**Stable-before-3J0:** the *names and meaning* of pricing-confidence states (policy configured, pricing complete, blocking count, guardrail outcome) are frozen by this spec so the 3J0 snapshot field map can reference them. All rail values remain **live-only** (read from the live preview) until 3J1/3J2 — the rail must never read from a persisted record in 3I-3D.

---

## 6V. BUILDER RAIL PRICING-CONFIDENCE GROUPING — 3I-3D1 (rail-only implementation)

**Status:** **Complete** (committed `fbdedbe`). **Spec:** **§6U**. **Prior checkpoint:** `aa0073a` (3I-3D0). **Scope:** UI/status surfacing only — no page redesign, no pricing math, no engine/mapper/orchestrator changes, no customer document changes at time of slice, no action enablement, no SQL/persistence.

### What shipped

- **`ProposalBuilderSummaryRail.tsx`** — replaced flat "Job context" stack with two labeled groups:
  - **Setup readiness** — Measurement, Quantities, Record (when present), Catalog, Template.
  - **Pricing confidence** — Pricing policy, Pricing status (renamed from "Option pricing"), Blocking lines, Guardrail (own row), Internal profitability (3I-3C logic unchanged).
- **`proposalBuilderConstants.ts`** — group heading labels, guardrail pill classes, guardrail status messages (Pass / Warning / Blocked / Checking…), actions status note.
- **Dedup** — pricing policy owns Configured / Not configured / Checking…; pricing status owns Complete / Incomplete; internal profitability omits redundant "From company pricing" status when showing trusted dollars; warning copy only when values hidden.
- **Guardrail row** — promoted to its own labeled row with pill + message; **status-only** — no enforcement, no send-gating.

### Explicitly unchanged

- Customer document canvas, option tabs, page grid (`ProposalBuilderWorkspaceLayout`), Preview / Send / Sign / Payment (remain disabled).
- Pricing engine, mapper, orchestrator, profitability presenter.
- No proposal records, line snapshots, or API writes.

### Verification

- Typecheck: 6 pre-existing `RoofingClientV2.tsx` errors only.
- Tests: 111/111 pass (presenter, policy, orchestrator, engine, mapper).
- Only `ProposalBuilderSummaryRail.tsx`, `proposalBuilderConstants.ts`, and this doc changed.

### Next

| Slice | Scope |
|-------|-------|
| **3I-3D2A** | Builder navigation model decision — **§6Y** — **done** |
| **3I-3D2** | Hybrid Page Context Strip scaffold — **§6Y** + **§6W** |
| **3J0** | Proposal record / snapshot architecture — docs/types only |

---

## 6W. ROOFR-EXACT BUILDER HYBRID WORKSPACE SPEC — 3I-3D2 (docs/spec only)

**Status:** **Spec locked** (docs only — no app code). **Checkpoint:** `fbdedbe` (3I-3D1 committed). **Purpose:** Define the RoofrExact center-Builder restructure before implementing **3I-3D2**. **Read before any canvas/document UI change.**

### 1. Verdict

- **The long-paper center canvas is structurally wrong** for the Builder stage. FieldDive currently renders one narrow, centered white document page (`BUILDER_DOCUMENT_PAGE`) with all template sections stacked vertically — it reads as a read-only PDF scroll, not a proposal builder.
- **Roofr's proposal builder/editor** is closer to a **structured proposal/estimate workspace**: left page/section menu, central estimate/editor workspace, option/package context, compact line-item table, settings/status side context, and **separate customer preview/output** (Preview mode) — not one endless blank paper.
- **3I-3D2 is not a random visual polish pass.** It converts the center Builder from a long-paper metaphor into a **RoofrExact hybrid workspace** while preserving all current pricing and customer/internal boundaries.
- **Do not fully implement page CRUD or customer Preview mode yet.** No proposal pages editor, no show/hide line toggles, no Preview button enablement — those belong to post-3J0/post-snapshot slices.
- **Use a hybrid workspace now:** estimate/editor panel **primary**, customer content preview **secondary**.
- **Keep the 3-column layout:** left nav (`12rem`) · center workspace (`minmax(0,1fr)`) · right rail (`17rem`) — `ProposalBuilderWorkspaceLayout.tsx` unchanged unless a future slice proves unavoidable.
- **Keep 3I-3D1 right rail grouping** (Setup readiness + Pricing confidence) — do not regress rail structure in 3I-3D2.

### 2. Roofr reference vs FieldDive today

| Roofr surface | FieldDive today | 3I-3D2 target |
|---------------|-----------------|---------------|
| Left page menu (Cover, Estimate, + pages) | Static disabled stubs (`BUILDER_SECTIONS`) — not wired to content | **Leave as-is for 3I-3D2** — defer to optional **3I-3D3** |
| Central estimate workspace | Single `<article>` document page with all sections in one scroll | **Full-width workspace** with estimate panel + content preview panel |
| Option/package tabs | Embedded inside document header | **Workspace header** bar |
| Line-item table | Tall list rows with contractor meta (Source, Rule, Unit, Role) | **Compact table/grid** — customer price/status only in center |
| Estimate settings / status | Mixed into document footers + rail | Rail owns contractor confidence; center owns customer-safe totals |
| Customer preview | Separate Preview mode | **Secondary preview panel** for prose sections — not dominant |

### 3. Target center structure

#### 3.1 Workspace header

- Template name / proposal type label
- **Option/package tabs** (`ProposalBuilderOptionTabs`) — moved out of document letterhead into header bar
- Measurement context (compact one-line strip)
- Selected option pricing status (Complete / Incomplete — **words only**, no dollars)
- **Customer-safe only** — no internal cost/profit/margin

#### 3.2 Estimate panel — primary

- **Primary work surface** — visually dominant
- Compact section groups for line-item sections only
- **Line-item table/grid**, not tall paragraph-style rows
- Columns (minimum): Item name · Qty · Unit · Customer price/status
- Contractor debug meta (quantity source/rule/role) **removed from center** or collapsed — blocking/unresolved states remain visible via compact price/status cells and right rail
- **Totals at panel foot** (`ProposalBuilderDocumentTotals`) — customer-safe subtotal/discount/tax/total or incomplete messaging
- Pricing preview banner (configured vs placeholder) — **one instance** in estimate panel; dedupe line-list footers where redundant
- **No internal cost/profit/margin**

#### 3.3 Customer content preview panel — secondary

- Non-line-item template sections only: project overview, scope notes, warranty, terms, custom text blocks
- **Read-only** for now — no inline editing
- **Less dominant** than estimate panel — smaller typography, lighter framing, clearly labeled (e.g. "Customer content preview")
- Prose/warranty/terms — not mixed into the line-item scroll

#### 3.4 Right rail — unchanged structure

- **Setup readiness** + **Pricing confidence** groups (3I-3D1)
- Guardrail row (status-only)
- Internal profitability (contractor-only; 3I-3C presenter logic unchanged)
- Tiny copy dedup only if center banner reduction requires it

#### 3.5 Left nav — deferred

- **Leave current nav as-is for 3I-3D2** unless absolutely needed for visual-only scroll targets
- **Defer true page/section nav** (Cover, Estimate, custom pages, wired scroll/filter) to optional **3I-3D3**

### 4. Expected implementation approach (3I-3D2 code slice)

Visual/layout only — **same props, same data sources, same pricing preview paths**:

1. Replace single narrow `BUILDER_DOCUMENT_PAGE` center with a **full-width workspace surface** (`BUILDER_WORKSPACE` token).
2. Split `ProposalBuilderCanvas.tsx` into workspace header + estimate panel + content preview panel.
3. Move option tabs into workspace header (visual integration in `ProposalBuilderOptionTabs.tsx` allowed).
4. Refactor `ProposalBuilderLinePreviewTable.tsx` to compact table/grid rows.
5. Refactor `ProposalBuilderSectionPreview.tsx` to route line-item sections → estimate panel layout; text sections → content preview panel layout.
6. Attach `ProposalBuilderDocumentTotals.tsx` to estimate panel foot (not buried after all prose sections).
7. Add workspace tokens in `proposalBuilderConstants.ts`; narrow or repurpose `BUILDER_DOCUMENT_PAGE` for preview sub-panel only.
8. Reduce duplicate preview/placeholder copy across line footers, totals, and rail.
9. Keep unresolved quantity/pricing states visible but compact (status cells, rail blocking count).

### 5. Allowed files (3I-3D2 implementation)

- `app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderSectionPreview.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderLinePreviewTable.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderDocumentTotals.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderOptionTabs.tsx` — visual integration only
- `app/tools/roofing/proposals/builder/ProposalBuilderSummaryRail.tsx` — only if center copy dedup requires a tiny adjustment
- `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts`
- `docs/fielddive-global-handoff.md`

### 6. Forbidden files (3I-3D2)

- `app/lib/proposalPricingEngine.ts`
- `app/lib/proposalPricingInputMapper.ts`
- `app/lib/proposalBuilderPricingPreview.ts`
- `app/lib/proposalProfitabilityPresenter.ts`
- `app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx` — unless unavoidable for visual-only prop threading (prefer Canvas-local layout)
- `app/tools/roofing/proposals/builder/ProposalBuilderDisabledActions.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderWorkspaceLayout.tsx` — defer unless D2 review proves unavoidable
- `app/tools/roofing/proposals/builder/ProposalBuilderSectionNav.tsx` — defer to **3I-3D3**
- Settings / catalog files
- APIs
- SQL / migrations
- Package files
- Old estimator / saved-estimate / loadSaved paths

### 7. Hard rules (3I-3D2)

**No:**

- Pricing math changes
- Pricing data shape changes
- Engine / mapper / orchestrator changes
- Proposal persistence
- Snapshots
- Preview / Send / Sign / Payment enablement
- Internal cost/profit/margin in customer document or estimate panel
- Customer/internal boundary changes
- Catalog / settings changes

**Yes:**

- Visual restructure of center column only
- Same live preview data paths
- Customer prices/status/totals remain customer-safe in estimate panel
- Internal profitability remains rail-only

### 8. Verification (3I-3D2)

| Check | Expectation |
|-------|-------------|
| `npx tsc --noEmit` | 6 pre-existing `RoofingClientV2.tsx` errors only |
| Test suites (presenter, policy, orchestrator, engine, mapper) | **111/111 pass** |
| Builder center | Reads as **workspace**, not long paper |
| Option tabs | Still switch options; status pills unchanged |
| Right rail | Setup readiness + Pricing confidence groups intact |
| Customer areas | No internal cost/profit/margin |
| Actions | Preview / Send / Sign / Payment remain disabled |
| Persistence | No writes / snapshots / API calls |

### 9. Next sequence

| Slice | Scope |
|-------|-------|
| **3I-3D2A** | Navigation model decision — **§6Y** (docs only) — **done** |
| **3I-3D2 impl** | Hybrid Page Context Strip scaffold per **§6Y** + **§6W** §3–§4 |
| **3J0** | Proposal record / snapshot architecture — docs/types only |

**Stable-before-3J0:** 3I-3D2 does not change pricing-confidence state names or meanings frozen by §6U — rail and estimate panel continue to read live preview only until 3J1/3J2.

---

## 6W-Reset. FIELDIVE BUILDER STRATEGY CORRECTION — 3I-3D2 (docs only)

**Status:** **Correction locked** (docs only — no app code). **Checkpoint base:** `b2c2e31`. **Purpose:** Reset rejected 3I-3D2 visual attempts and define the correct FieldDive-optimized Roofr capability model before any further Builder UI work.

### 1. Current 3I-3D2 visual attempt — rejected

The uncommitted 3I-3D2 Builder visual implementation (RoofrExact baseline scaffold / inner page tree) is **rejected and reverted**. Do not keep tweaking that approach.

### 2. Reason for rejection

| Issue | Detail |
|-------|--------|
| **Sidebar-inside-sidebar** | An inner left page rail/panel inside FieldDive’s existing 3-column Builder shell reads as a second navigation system — bulky, not premium, and not native to FieldDive’s app chrome. |
| **Partial Roofr copy** | Copying Roofr’s page-menu **placement** without Roofr’s full page/preview architecture (proposal records, snapshots, real page routing, Preview mode) creates clutter without the payoff. |
| **Rough page-tree stubs** | Faking Cover / customer pages / Preview as disabled tree items inside a nested rail slows scanning and feels like placeholder UI, not intentional Builder IA. |
| **Not faster or cleaner** | The result was not faster to scan, not cleaner than committed baseline, and not clearly better than leaving navigation decisions until architecture is chosen. |

### 3. Correct principle — FieldDive-optimized Roofr capability model

This is **not** permission to ignore Roofr or do a random FieldDive redesign.

| Rule | Meaning |
|------|---------|
| **Roofr capabilities = source of truth** | Every Roofr Builder capability must eventually exist in FieldDive. |
| **Roofr IA/workflow = baseline** | Cover → Estimate → customer pages → Preview/Send is the workflow model. |
| **Layout may adapt** | FieldDive may improve **placement and density** only when literal Roofr placement creates clutter or slows workflow **inside FieldDive’s app shell** — without dropping capabilities. |
| **Final place, disabled if unavailable** | Future features (Cover, customer pages, Preview, Send, Sign, Payment) sit in their **logical final place**, clearly disabled — no fake routing, no fake saves. |
| **No fake behavior** | No stub page trees that imply navigation that does not exist. No second-app-sidebar metaphors. |

### 4. Roofr capabilities to preserve (non-negotiable)

| Capability | Notes |
|------------|-------|
| **Proposal pages** | Cover, Estimate, and customer content pages are first-class pages — not random inline blocks. |
| **Cover** | Future proposal page; disabled until record/snapshot phases. |
| **Estimate** | Primary Builder work surface — compact line-item grid, section/category grouping, customer-safe price/status, attached totals. |
| **Option packages** | Good/Better/Best (or template options) tied to Estimate — selectable, status-visible, no behavior regression. |
| **Customer pages / content** | Prose, warranty, terms, photos — proposal pages, not mixed into the estimate scroll. |
| **Estimate grid** | Compact Item / Qty / Unit / Price (customer-safe); contractor debug meta stays out of customer document. |
| **Right pricing / settings / profitability context** | 3I-3D1 rail: Setup readiness, Pricing confidence, Guardrail, Internal profitability (contractor-only). |
| **Preview / Send mode** | Separate customer-output mode — not the Builder edit surface. Disabled until post-3J0. |
| **Signing / payment** | Later phases — disabled, final header placement only. |

### 5. FieldDive layout direction — evaluate before next code

Do **not** implement another visual pass until one navigation model is chosen.

| Option | Description | Tradeoffs |
|--------|-------------|-----------|
| **A — Literal inner left page rail** | Roofr-like page tree in the Builder left column (Cover / Estimate / pages / Preview). | Closest to Roofr placement; highest risk of sidebar-inside-sidebar in FieldDive shell. |
| **B — Compact Builder page strip / header** | Horizontal page/context strip above the estimate workspace (pages + option context); left column reserved or minimized. | Faster scan, less nested chrome; must still expose full page model clearly. |
| **C — Builder popout / drawer page tree** | Page tree in a slide-over drawer; center stays full-width estimate workspace. | Reduces permanent clutter; adds one click for page context. |
| **D — Expandable app-sidebar Builder tree** | Proposal pages live in the **app-level** sidebar when Builder is active — not a nested inner rail. | Native to FieldDive shell; requires app-sidebar integration discipline. |
| **E — Hybrid** | e.g. Estimate + options in workspace header/strip; Cover/customer pages/Preview in drawer or app sidebar; center = estimate-only. | Likely best fit — match Roofr **capabilities** without copying Roofr **chrome** literally. |

**§6W center-workspace targets** (estimate panel, compact grid, secondary content handling, right rail unchanged) **remain valid** regardless of which navigation option is selected.

### 6. Selection criteria (for 3I-3D2A decision)

Choose the model that best satisfies **all** of:

1. **Fastest to scan** — estimate grid and option context visible with minimal nested chrome.
2. **Least clutter** — no sidebar-inside-sidebar, no box-in-box card stacks, no long-paper scroll.
3. **Closest to Roofr capability model** — all pages and modes accounted for, even if disabled.
4. **Easiest to enable future proposal pages / snapshots** — chosen chrome maps cleanly to 3J0 record + page routing.
5. **No fake behavior** — disabled controls do not imply working navigation or persistence.

### 7. Next step — 3I-3D2A (architecture / design decision only)

| Slice | Scope |
|-------|-------|
| **3I-3D2A** | **Decision only** — pick Option A–E (or hybrid variant); document wireframe-level placement for Cover, Estimate, options, customer pages, Preview, right rail, header actions. **No app code.** |
| **3I-3D2** | Implement **one** selected navigation + center workspace model per §6W §3–§4 + §6W-Reset §4–§5. Visual/layout only; same pricing/data boundaries. |
| **3J0** | Proposal record / snapshot architecture — docs/types only — after 3I-3D2 layout is stable. |

**Do not** resume 3I-3D2 implementation until **§6Y** is reviewed and committed. **Decision locked in §6Y** — Option E (Hybrid Page Context Strip, E-B variant).

---

## 6Y. BUILDER NAVIGATION MODEL DECISION — 3I-3D2A (docs only)

**Status:** **Decision locked** (docs only — no app code). **Checkpoint base:** `5467a92`. **Purpose:** Lock the Builder navigation/layout model before **3I-3D2** implementation. **Read before any Builder UI change.**

### 1. Decision

**Selected model:** **Option E — Hybrid Page Context Strip (E-B variant).**

- **Primary navigation:** horizontal **Builder Page Context Strip** below the page header.
- **Primary work surface:** full-width **Estimate workspace** (center column).
- **Contractor context:** unchanged **Setup / Pricing rail** (right column).
- **Overflow (later):** Pages dropdown expands or opens a drawer when customer page count exceeds strip capacity — not a permanent inner left page rail.

### 2. Why this wins

| Reason | Detail |
|--------|--------|
| **Roofr capability model preserved** | Cover, Estimate, customer pages, option packages, estimate grid, right pricing/profitability context, Preview/Send mode — all accounted for in final placement. |
| **Avoids sidebar-inside-sidebar** | FieldDive already has `FieldDiveAppShell` app sidebar; no second permanent inner left page rail inside Builder. |
| **Estimate editor dominant** | Removing the permanent inner left column recovers horizontal space for the compact estimate grid. |
| **Works with FieldDive app shell** | Page strip is Builder-native chrome; app sidebar stays global module navigation. |
| **Disabled future features in final place** | Cover, Pages, Preview segments sit where they will live when enabled — clearly disabled now, no fake routing. |
| **Minimizes 3J/3K rework** | Strip segments map to proposal `pageId` routes; Preview becomes mode switch; Pages menu becomes persisted page list — no layout redesign expected. |
| **Faster to scan** | Page context, option tabs, and estimate grid visible in one vertical slice without nested navigation chrome. |

### 3. Rejected options

| Option | Verdict | Reason |
|--------|---------|--------|
| **A — Literal inner left page rail** | **Rejected** | Creates sidebar-inside-sidebar with `FieldDiveAppShell`, wastes ~12rem width, and fakes a page tree before proposal records/pages exist. Prior visual attempt rejected for this pattern (§6W-Reset). |
| **B — Compact page strip only** | **Strong but incomplete alone** | Correct primary IA, but many future customer pages need overflow beyond a single horizontal row. |
| **C — Popout/drawer only** | **Overflow only** | Useful when page count grows, but hides IA if used as primary navigation; extra click to discover pages. |
| **D — App-sidebar Builder tree** | **Deferred** | Requires `FieldDiveAppShell` changes; blurs app modules vs proposal pages; premature before proposal records/snapshots (3J0+). |
| **E — Hybrid** | **Chosen** | Page Context Strip is primary; drawer/menu handles overflow later; matches FieldDive-optimized Roofr capability model (§6W-Reset §3). |

### 4. Locked Builder structure

```
┌ FieldDiveAppShell (global app sidebar — unchanged) ─────────────────┐
│ ProposalBuilderPageHeader                                          │
│   ← Back · Job title · [Preview][Send][Sign][Payment] (disabled)   │
├────────────────────────────────────────────────────────────────────┤
│ Builder Page Context Strip                                         │
│   [Cover]  [Estimate ●]  [Pages ▾]  ············  [Preview]      │
│   disabled    active      labels/disabled          disabled        │
├──────────────────────────────────────────────┬─────────────────────┤
│ Estimate Workspace (primary)                  │ Setup / Pricing    │
│   Toolbar: template · option tabs · meas     │ Rail (3I-3D1)      │
│   Compact line-item grid (customer-safe)      │ unchanged          │
│   Totals attached to estimate foot            │                    │
└──────────────────────────────────────────────┴─────────────────────┘
```

| Rule | Detail |
|------|--------|
| **App sidebar** | `FieldDiveAppShell` remains global app navigation — unchanged in 3I-3D2. |
| **Page Context Strip** | New horizontal strip below page header: Cover (disabled), Estimate (active), Pages dropdown/overflow (labels only / disabled), Preview (disabled). |
| **Workspace columns** | **2-column:** center Estimate workspace + right Setup/Pricing rail. **Remove permanent inner left Builder sidebar** in 3I-3D2. |
| **Estimate grid** | Primary work surface — compact Item / Qty / Unit / Price; customer-safe only. |
| **Option packages** | Stay tied to Estimate — horizontal tabs in workspace toolbar (`ProposalBuilderOptionTabs`). |
| **Customer pages** | **Not stacked inline** under estimate scroll; listed in Pages dropdown only until page routing exists. |
| **Preview** | Separate future mode — disabled in header **and** strip; not inline content in Builder center. |
| **Right rail** | 3I-3D1 grouping unchanged: Setup readiness, Pricing confidence, Guardrail, Internal profitability. |

### 5. Future enablement (3J / 3K — no redesign expected)

| Feature | Enablement path |
|---------|-----------------|
| **Persisted proposal pages** | Pages dropdown populates from proposal record page list; strip segments navigate by `pageId`. |
| **Snapshots** | Estimate grid reads snapshot when in preview/review mode; layout unchanged. |
| **Preview mode** | Header Preview + strip Preview enable → separate customer-output surface (not Builder edit grid). |
| **Send / Sign / Payment** | Header actions enable; Builder remains edit mode. |
| **Page CRUD** | Pages menu gains add/reorder/delete when records exist; optional drawer for long page lists. |
| **Cover page editor** | Cover strip segment enables → center renders Cover editor instead of Estimate grid. |

No Builder layout redesign should be required when these features arrive — only wiring and enablement.

### 6. 3I-3D2 implementation scope (after §6Y commit)

**Visual/layout scaffold only** — same props, data sources, and pricing preview paths.

**Allowed files:**

- `app/tools/roofing/proposals/builder/ProposalBuilderWorkspaceLayout.tsx` — 2-column grid
- `app/tools/roofing/proposals/builder/ProposalBuilderSectionNav.tsx` — repurpose or replace with Page Context Strip component
- `app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx` — estimate-first workspace
- `app/tools/roofing/proposals/builder/ProposalBuilderSectionPreview.tsx` — line sections → grid; prose → Pages menu labels only
- `app/tools/roofing/proposals/builder/ProposalBuilderLinePreviewTable.tsx` — compact grid
- `app/tools/roofing/proposals/builder/ProposalBuilderDocumentTotals.tsx` — attached estimate foot
- `app/tools/roofing/proposals/builder/ProposalBuilderOptionTabs.tsx` — toolbar integration
- `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts` — strip + workspace tokens
- `app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx` — minimal compose wiring for strip page labels only
- `docs/fielddive-global-handoff.md` — post-impl status update

**Implementation requirements:**

- 2-column Builder workspace (center + right rail)
- Page Context Strip with disabled Cover / active Estimate / Pages dropdown / disabled Preview
- Estimate-first center (no long-paper metaphor, no box-in-box)
- Compact estimate grid (customer-safe columns only)
- Disabled future controls in final place — no fake routing or persistence
- Right rail unchanged (3I-3D1)
- Header Preview / Send / Sign / Payment remain disabled

### 7. Forbidden (3I-3D2)

- `app/lib/*` — pricing engine, mapper, orchestrator, presenter, stores
- Engine / mapper / orchestrator changes
- Proposal persistence, snapshots, API calls
- Preview / Send / Sign / Payment enablement
- SQL / migrations
- Settings / catalog / package changes
- `FieldDiveAppShell.tsx` — app shell changes (Option D deferred)
- `RoofingClient.tsx`, `SavedClient.tsx`, `estimateStore.ts`, `paymentsTable.ts`
- Old estimator / saved-estimate / loadSaved paths

### 8. Next sequence

| Slice | Scope |
|-------|-------|
| **3I-3D2A** | This decision (§6Y) — **done** (`d3a969b`) |
| **3J0b** | Proposal architecture docs + types (§6Z) — **done** (`3ae5e39`) |
| **3J1** | Proposal SQL migrations + RLS — **done** (applied §6AA) |
| **3J2** | Proposal stores + snapshot builder — **done** (`13b4e72`, §6AB) |
| **3J3** | Job Card → persisted Builder draft flow — **done** (`e38b276`, §6AC) |
| **3J3E** | Option selection persistence — **done** (`a7249b3`, §6AE) |
| **3J4** | Page Context Strip backed by `proposal_pages` |
| **3K** | Preview / PDF / send |

---

## 6Z. 3J0 PROPOSAL RECORDS / VERSIONS / PAGES ARCHITECTURE (docs + types; SQL applied §6AA)

**Status:** **3J0b committed** (`3ae5e39`). **3J1A/3J1B migrations committed** (`387993e`, `7b23415`); **3J1C applied + verified in production** — see **§6AA**. **3J2 lib persistence spine complete** — see **§6AB** (`13b4e72`). **3J3 Job Card → persisted Builder draft flow complete** — see **§6AC** (`e38b276`). **Purpose:** Lock proposal record, snapshot, page, and lifecycle architecture before Builder persistence.

### 1. Why 3J0 is needed

- The Builder today is a **live pricing preview** — template + catalog + measurement + policy recomputed in memory; nothing survives reload.
- **3I-3D2 visual attempts were rejected** because there are no real `proposalId`, `proposal_pages`, or frozen snapshots to navigate or render — UI polish cannot fix missing domain objects.
- Roofr-style proposals require **real records**, **pages**, **option packages**, and **immutable sent/signed snapshots** before Preview/Send/Sign/Payment can enable.
- Architecture must precede more Builder UI work (**3J3+**).

### 2. Approved entity model (M1–M8)

| Entity | Purpose |
|--------|---------|
| **`proposals`** | Lifecycle header — many per job; `jobs.active_proposal_id` → current working draft |
| **`proposal_versions`** | Draft / sent / signed / superseded rows — **not** `current_snapshot_id`-only (M1) |
| **`proposal_pages`** | Cover, Estimate, Terms, Warranty, photos, custom content — Page Context Strip maps here (§6Y) |
| **`proposal_options`** | Standard / Enhanced / Premium snapshots with customer-safe totals |
| **`proposal_line_items`** | Normalized customer-safe estimate rows (M2) |
| **`proposal_internal_summaries`** | Contractor-only cost/profit/margin — separate table (M4) |
| **`proposal_events`** | Append-only audit (created, sent, viewed, signed, …) |

**Type files (3J0b):** `proposalRecordTypes.ts`, `proposalVersionTypes.ts`, `proposalPageTypes.ts`, `proposalLifecycleTypes.ts`, `proposalLineSnapshotTypes.ts`, `proposalSnapshotTypes.ts`.

### 3. Lifecycle rules

| Rule | Detail |
|------|--------|
| **Draft mutable** | Latest `version_kind = draft` editable; pricing **live-recomputes** on draft open + manual refresh (M3) |
| **Sent immutable** | `version_kind = sent` — no UPDATE to lines, pages, customer prices |
| **Signed immutable** | `version_kind = signed` — legal/commercial truth |
| **Edit after send** | Creates **new draft version**; prior sent preserved (`revised` status) |
| **Customer link** | Always reads **sent** version (M7); preview-before-send may be ephemeral |
| **Sign locks option** | `option_selection` — `lock_on_sign` per `PRICING_SNAPSHOT_INTENTS` |
| **Placeholder policy** | `BUILDER_PREVIEW_PRICING_POLICY` (50% margin) **must never** snapshot or send |

### 4. Snapshot boundaries

**Frozen customer-visible at send:** job/customer/company echo, pages/content, options, line items, quantities, customer prices/totals, terms/warranty/notes, measurement echo, customer-safe policy echo.

**Never customer-visible:** unit cost, internal cost, profit, margin, markup, supplier/internal catalog metadata, full pricing policy document.

**Internal profitability (M4):** recompute live in draft; **frozen copy** in `proposal_internal_summaries` at send.

### 5. Page model

Types: `cover`, `estimate`, `terms`, `warranty`, `project_overview`, `photos`, `pdf_attachment`, `custom_text`, `payment_schedule` (later), `signature` (later).

**Instantiate (M5):** copy template graph → proposal pages/options/lines on create; draft **detaches** from template after create.

### 6. Database plan (3J1 — committed; applied + verified §6AA)

**Migrations (committed; applied manually in production):**

- `supabase/migrations/20260606_006_create_proposal_records.sql` (3J1A) — **applied**
- `supabase/migrations/20260607_007_harden_proposal_records_before_apply.sql` (3J1B) — **applied**

Tables: `proposals`, `proposal_versions`, `proposal_pages`, `proposal_options`, `proposal_line_items`, `proposal_internal_summaries`, `proposal_events`.

- Normalized lines/options/pages; JSONB for page prose, context echoes, policy echoes, event payloads (M2).
- `company_id` RLS on all tables; composite `(id, company_id)` pattern (matches templates/catalog).
- `proposal_number` partial unique per company when non-empty (M8).

### 7. UI implications (future — no UI in 3J0b)

| Surface | After 3J3+ |
|---------|------------|
| Builder | Open/create draft `proposals` record |
| Page Context Strip | Navigate `proposal_pages` by `pageId` |
| Preview | Render `proposal_versions` (sent or ephemeral draft preview) |
| Send | Freeze draft → `version_kind = sent` |
| Sign / Payment | Attach to signed version + events |
| Job Card | List proposals for job |

**3I-3D2 UI remains deferred** until persisted Builder flow is proven by manual smoke (3J3 complete — §6AC).

### 8. Next sequence

| Slice | Scope |
|-------|-------|
| **3J0b** | This section + domain type files — **done** (`3ae5e39`) |
| **3J1A/3J1B** | SQL migrations + RLS hardening — **committed + applied** (`387993e`, `7b23415`) |
| **3J1C** | Manual apply + verification — **done** (§6AA); production apply verified |
| **3J2** | Stores + snapshot builder + tests — **done** (`13b4e72`, §6AB) |
| **3J3** | Job Card → persisted Builder draft flow — **done** (`e38b276`, §6AC) |
| **3J3E** | Option selection persistence — **done** (`a7249b3`, §6AE) |
| **3J4** | Page Context Strip backed by `proposal_pages` |
| **3K** | Preview / PDF / send |
| **3L** | Sign / payment |

### 9. Guardrails (unchanged)

- Do not alter pricing engine / mapper / orchestrator math.
- Do not expose internal summaries to customer routes.
- Do not enable Preview/Send/Sign/Payment until **3K+** (lib persistence spine is stable — §6AB).
- Do not couple to legacy estimate KV / `RoofingClient` useMemo path.

---

## 6AA. 3J1C PROPOSAL RECORDS MIGRATION MANUAL APPLY — APPLIED + VERIFIED

**Status:** **3J1C complete.** Migrations **006 + 007 applied manually** in Supabase SQL Editor and **post-apply verification passed** (all 10 checks). **No rollback was run.** **No seed rows created.**

### 1. Apply record

| Item | Detail |
|------|--------|
| **Target** | **tradetools-ai** / **PRODUCTION** / ref **`rhquhnujnzjhweypavd`** |
| **Method** | Manual paste + run in Supabase SQL Editor (user-confirmed target) |
| **Order** | **006 first**, then **007** (only after 006 succeeded) |
| **Preflight** | Passed before apply (§4 checks; all parent tables present including `customers`) |

| File | Commit | Status |
|------|--------|--------|
| `supabase/migrations/20260606_006_create_proposal_records.sql` | `387993e` (3J1A) | **Applied** |
| `supabase/migrations/20260607_007_harden_proposal_records_before_apply.sql` | `7b23415` (3J1B) | **Applied** |

### 2. Post-apply verification (all PASS)

| # | Check | Result |
|---|-------|--------|
| 01 | Tables exist (all seven) | PASS |
| 02 | RLS policy counts | PASS |
| 03 | No internal line columns on `proposal_line_items` | PASS |
| 04 | `proposal_options` customer-safe column names | PASS |
| 05 | `guardrail_outcome` pass/warn/block only | PASS |
| 06 | Composite FKs from 007 present | PASS |
| 07 | Old id-only FKs absent | PASS |
| 08 | `set_updated_at` triggers on mutable tables only | PASS |
| 09 | Key indexes present | PASS |
| 10 | No seed rows (all counts 0) | PASS |

**Verified boundaries:**

- `proposal_line_items` customer-safe — no internal cost/profit/margin/markup/`policy_echo_json` columns
- `proposal_events` append-only RLS shape — SELECT + INSERT only; no app-user UPDATE/DELETE policies
- `proposal_options` uses `customer_subtotal_cents`, `discount_cents`, `sales_tax_cents`, `customer_total_cents`
- 007 composite FKs present; id-only header/catalog FKs replaced as expected

### 3. Preflight reference (for future environments)

Use before applying 006/007 to **staging or other targets** — proposal tables must not already exist; parent tables + composite uniques must be present. See queries in prior §6AA revision (preflight SQL preserved in chat history / 3J1C apply plan).

**Important:** `public.customers` must exist or 006 fails (`proposals.customer_id` FK). No customers migration in repo bundle.

### 4. Failure handling (unchanged — for future applies)

- **If 006 fails:** do **not** run 007. Copy exact error text.
- **If 006 partially succeeds:** stop; report table/policy state. Do not cleanup without review.
- **If 007 fails after 006 succeeds:** stop; copy exact error. 006 objects remain until reviewed.
- Do **not** run rollback blocks without review.
- Do **not** drop `public.set_updated_at()` (shared by jobs and other tables).
- Do **not** drop proposal tables unless explicitly directed after review.

### 5. Next sequence

**Superseded by §6AC** — at time of 3J1C apply, next was 3J2. **3J3 complete** — see **§6AC**.

| Step | Scope |
|------|-------|
| **Done** | **3J2** — `proposalSnapshotStatusMapper`, `proposalSnapshotBuilder`, `proposalRecordStore` + tests (§6AB) |
| **Done** | **3J3** — Job Card create/reuse + Builder persisted draft read path (§6AC) |
| **Done** | **3J3E** — option selection persistence (`a7249b3`, §6AE) |
| **Later** | **3J4** Page Context Strip; **3K** preview/PDF/send; **3L** sign/payment |

### 6. Guardrails (post-apply)

**Historical (3J1C apply time):** guardrails below applied before 3J2 lib work. **Current guardrails:** see **§6AB**.

- **Do not resume Builder UI (3I-3D2 / §6Y)** until persisted Builder flow is proven by manual smoke (**3J3 done** — §6AC).
- **Do not enable Preview/Send/Sign/Payment** until **3K+**.
- **Customer-facing line snapshots** must remain free of internal cost/profit/margin/markup — internal fields only on `proposal_internal_summaries`.
- **`proposalRecordStore` wired** — Job Card create path + Builder read path (§6AC); **no Builder create path**.

### 7. Boundaries (3J1C)

- **No** further migration apply needed on production for 006/007.
- **No** app code, Builder UI, pricing engine/mapper/orchestrator, APIs/stores/settings/catalog changes in 3J1C docs slice.
- **No** edits to committed 006/007 migration files.
- **No** protected systems touched.

---

## 6AB. 3J2 PROPOSAL PERSISTENCE SPINE COMPLETE

**Status:** **3J2 complete.** **Checkpoint:** `13b4e72` (3J2B3). **Prior:** `213e322` (3J2B2), `1033cd9` (3J2B1). **Purpose:** Record completion of the lib-layer proposal persistence spine before **3J3** UI/API wiring.

### 1. Committed slices

| Slice | Commit | Module | Scope |
|-------|--------|--------|-------|
| **3J2B1** | `1033cd9` | `proposalSnapshotStatusMapper.ts` | Engine/preview line status → persisted snapshot status mapping; `assertCustomerSafeLineRow`; `assertConfiguredPolicyForPersistence`; extract-only reuse in `proposalBuilderPricingPreview.ts` |
| **3J2B2** | `213e322` | `proposalSnapshotBuilder.ts` | Pure row-shape assembly for draft/version/page/option/line/internal-summary payloads; no Supabase, no UI, no pricing math duplication |
| **3J2B3** | `13b4e72` | `proposalRecordStore.ts` | First DB-writing proposal lib layer; mocked Supabase tests; sequential multi-table draft create/refresh/update |

### 2. Boundaries (3J2 did not touch)

- **Builder UI** — baseline unchanged; no create/open draft wiring
- **Preview / Send / Sign / Payment** — remain disabled
- **APIs** — no new routes; store not exposed over HTTP yet
- **Pricing math** — `proposalPricingEngine.ts`, `proposalPricingInputMapper.ts` unchanged
- **Old estimator / saved estimate / loadSaved paths** — untouched
- **SQL/migrations** — 006/007 already applied (§6AA); no new migrations in 3J2
- **Settings / catalog / package files** — untouched

### 3. `proposalRecordStore` capabilities now available (lib layer)

| Method | Purpose |
|--------|---------|
| `getProposalById` | Read one proposal header by company scope |
| `listProposalsForJob` | Read proposal summaries for a job (company-scoped) |
| `getDraftGraph` | Read header + current draft version + pages + options + line items + internal summaries (internal summaries kept separate from customer line rows) |
| `createDraftProposal` | Create full draft proposal graph via snapshot builder + sequential Supabase writes |
| `refreshDraftPricing` | Recompute pricing for **draft only** — updates options, line items, internal summaries; does not mutate pages/content |
| `updateDraftSelectedOption` | Update `selected_option_id` for mutable draft only |
| `appendProposalEvent` | **Insert-only** event writer — no update/delete helpers |

### 4. High-risk safeguards handled (3J2B3)

| Risk | Handling |
|------|----------|
| **Non-atomic multi-table writes** | Explicit documented write order (`CREATE_DRAFT_WRITE_STEPS`); code comments state Supabase JS is not one DB transaction; tests assert order |
| **`customer_id` validation** | Same-company lookup fails closed when `customer_id` present — does not silently trust input |
| **`jobs.active_proposal_id`** | Update scoped by job `id` + `company_id`; proposal id validated before write |
| **`effective_margin_pct` DB CHECK** | `sanitizeEffectiveMarginPct`: null → null; negative → throws; `>= 100` → clamps to `99.9999`; applied on internal summary insert/refresh |
| **`page_id` linking** | Pages inserted before line items; `buildPageIdByTemplateSectionId` maps `source_template_section_id` → runtime page id; `section_id` remains template-section echo |
| **Customer/internal boundary** | `proposal_line_items` inserts customer-safe only (`assertLineInsertRowCustomerSafe`); internal cost/profit/margin/policy echo only on `proposal_internal_summaries` |
| **Configured policy guard** | `assertConfiguredPolicyForPersistence` blocks placeholder/unconfigured policies on create and refresh |
| **Policy echo split** | Customer-safe `ProposalVersionPolicyEcho` → `proposal_versions.policy_echo`; internal echo → `proposal_internal_summaries.policy_echo_json` only; full `PricingPolicy` not persisted as customer echo |
| **Draft-only mutation** | `refreshDraftPricing` and `updateDraftSelectedOption` reject non-`draft` `version_kind` |
| **Events append-only** | `appendProposalEvent` inserts only; no update/delete event methods in store |

### 5. Verification (3J2)

| Check | Result |
|-------|--------|
| **Tests** | **180/180** pass across proposal/pricing suites |
| **Typecheck** | Only **6** known pre-existing `RoofingClientV2.tsx` errors |
| **Forbidden files** | No Builder UI, API, migration, pricing engine/mapper, old estimator, or package changes in 3J2 commits |

### 6. Phase boundary — what 3J3 unlocked (historical — **3J3 now complete**, see **§6AC**)

| State | Detail |
|-------|--------|
| **Builder UI** | **3J3D:** persisted draft read when `?proposal=`; live preview fallback when absent |
| **Failed 3I-3D2 visual attempts** | Remain reverted — do not resume sidebar-inside-sidebar or competing layout experiments until smoke passes |
| **3J3 scope (done)** | Job Card **+ Proposal** → `createDraftProposal` / reuse; Builder → `getDraftGraph` + adapter |
| **3J3E (done)** | `updateDraftSelectedOption` from Builder option tabs (`a7249b3`, §6AE) |
| **3I-3D2 / §6Y visual work** | Deferred until persisted Builder flow proven by manual smoke |
| **Preview / Send / Sign / Payment** | Remain disabled until **3K+** |

### 7. Roadmap position (3J band)

| Slice | Status |
|-------|--------|
| **3J0** types | **Done** (`3ae5e39`, §6Z) |
| **3J1** migrations applied + verified | **Done** (§6AA) |
| **3J2** store + snapshot builder | **Done** (`13b4e72`, §6AB) |
| **3J3** Job Card → persisted Builder draft flow | **Done** (`e38b276`, §6AC) |
| **3J3E** | Option selection persistence — **done** (`a7249b3`, §6AE) |
| **3J4** | Page Context Strip backed by `proposal_pages` |
| **3K+** | Preview / PDF / send / sign / payment |

**Current status:** see **§6AC**.

---

## 6AC. 3J3 JOB CARD TO PERSISTED BUILDER DRAFT FLOW COMPLETE

**Status:** **3J3 complete.** **Checkpoint:** `e38b276` (3J3D). **Prior:** `1915b2d` (3J3C), `fc43849` (3J3B). **Purpose:** Record completion of the Job Card → real proposal draft → Builder persisted read path. **Follow-on:** **3J3E done** (`a7249b3`, §6AE).

### 1. Committed slices

| Slice | Commit | Module / surface | Scope |
|-------|--------|------------------|-------|
| **3J3B** | `fc43849` | `proposalDraftEntry.ts` | Read-only `resolveProposalDraftEntry`; `buildProposalBuilderHref(jobId, proposalId?)` adds optional `proposal=` param |
| **3J3C** | `1915b2d` | `RoofingClient.tsx` (Job Card **+ Proposal** only) | `resolveOrCreateProposalDraftEntry`: active draft → listed draft → `createDraftProposal` once; navigate with `?proposal=` |
| **3J3D** | `e38b276` | `proposalDraftGraphAdapter.ts`, `ProposalBuilderClient.tsx` | Builder reads `getDraftGraph` when valid `?proposal=`; adapter maps graph to existing Builder preview DTOs |

### 2. Boundaries (3J3 did not touch)

- **Builder visual redesign** — no canvas/rail/table/layout changes; existing UI structure preserved
- **Preview / Send / Sign / Payment** — remain disabled (`ProposalBuilderDisabledActions.tsx` unchanged)
- **APIs** — no new routes; store called from client lib only
- **SQL / migrations** — 006/007 unchanged; no new migrations in 3J3
- **Pricing engine / math** — `proposalPricingEngine.ts`, `proposalPricingInputMapper.ts` unchanged
- **Old estimator / saved estimate / loadSaved paths** — untouched outside the exact Job Card **+ Proposal** launch flow
- **Settings / catalog / package files** — untouched

### 3. Current workflow

```
Job Card → + Proposal click
  → If hydratedJobRecord.active_proposal_id is valid draft → open existing proposal (no create)
  → If active pointer missing/stale/non-draft/wrong job → listProposalsForJob; reuse existing draft if present
  → If no draft and clean DB identity available → createDraftProposal creates real draft once
  → Navigate to /tools/roofing/proposals/builder?job=<jobId>&proposal=<proposalId>

Builder load
  → If ?proposal=<valid uuid> → getDraftGraph(companyId, proposalId)
  → validateProposalDraftGraphForJob (draft status, job match, options present)
  → adaptProposalDraftGraphToBuilderPreview → existing Builder preview/rail surfaces
  → Invalid proposal / wrong job / missing draft → error banner; no workspace; no silent live fallback
  → ?job= only (no proposal param) → unchanged live preview via buildProposalBuilderPricingPreview
```

**Builder has no create path** — create runs from Job Card **+ Proposal** only when validation passes.

### 4. Safeguards

| Safeguard | Detail |
|-----------|--------|
| **Duplicate prevention** | active draft → listed draft → create once |
| **Board-origin / non-hydrated jobs** | Fail closed for create — no silent draft creation |
| **Missing customer/template/measurement/quantity context** | Blocks create |
| **Unconfigured policy** | Shows *"Configure pricing policy before creating a proposal draft."* — no navigation |
| **Customer/internal boundary** | Adapter `PROPOSAL_LINE_CUSTOMER_FORBIDDEN_KEYS` guard throws on polluted persisted line rows |
| **Internal summaries** | Mapped to `option.internal` only — contractor-only rail; never merged into customer line rows |
| **Preview / Send / Sign / Payment** | Remain disabled |
| **Builder create path** | Does not exist — Builder reads persisted draft only when `?proposal=` present |
| **Visual/layout work** | None in 3J3 — deferred **3I-3D2 / §6Y** until smoke proves persisted flow |

### 5. Verification (3J3)

| Checkpoint | Tests | Typecheck |
|------------|-------|-----------|
| **3J3B** (`fc43849`) | **90/90** pass | 6 known `RoofingClientV2.tsx` errors only |
| **3J3C** (`1915b2d`) | **99/99** pass | same |
| **3J3D** (`e38b276`) | **109/109** pass | same |

**3J3D test files:** `proposalDraftGraphAdapter.test.ts` (10 tests at 3J3D; **13** after Phase D test lock — §6AD).

### 6. Manual smoke checklist (3J3 — historical; superseded by §6AE.5 → §6AF.9 → §6AD.7)

- [ ] Packet/direct Job Card + configured policy → **+ Proposal** creates draft once; URL includes `proposal=`
- [ ] Second **+ Proposal** click reuses same proposal id (no duplicate create)
- [ ] Existing active draft opens with `proposal=` without creating
- [ ] Unconfigured policy shows error; no fake persisted proposal; no navigation
- [ ] Board-origin job does not create if DB identity is not clean
- [ ] Builder with `?proposal=` loads persisted totals/lines (not live recompute as primary)
- [ ] Wrong `job` + valid `proposal` shows error banner
- [ ] Invalid/missing draft shows error banner
- [ ] `?job=` only (no `proposal`) still uses live preview
- [ ] Preview / Send / Sign / Payment remain disabled

### 7. Roadmap position (post-3J3)

| Slice | Status |
|-------|--------|
| **3J0** types | **Done** (`3ae5e39`, §6Z) |
| **3J1** migrations applied + verified | **Done** (§6AA) |
| **3J2** persistence spine | **Done** (`13b4e72`, §6AB) |
| **3J3** Job Card → persisted Builder draft flow | **Done** (this section) |
| **3J3E** | Option selection persistence — **done** (`a7249b3`, §6AE) |
| **3J4** | Page Context Strip backed by `proposal_pages` |
| **3K** | Preview / PDF / send — **later** |
| **3I-3D2** | Visual work — **deferred** until persisted Builder flow proven by smoke |

### 8. Next recommended (historical — superseded by §6AE + §6AD.8)

1. **Manual smoke** — **§6AE.5** (3J3E option persistence) → **§6AF.9** (pricing trust) → **§6AD.7** (full DB-first).
2. **Next proposal draft slice** or **legacy import planning** — after smoke.
3. **Do not** enable Preview/Send/Sign/Payment until **3K+**.
4. **Do not** resume **3I-3D2 / §6Y** visual work until smoke passes.

---

## 6AD. DB-FIRST FOUNDATION PHASES A–D COMPLETE

**Status:** **DB-first foundation complete (Phases A–D).** **Checkpoint:** `87be1b4`. **Follow-on:** **3J3E complete** (`a7249b3`, §6AE); **pricing trust hardening complete** (`ce3d6bc`, §6AF); quantity resolver tests (`4f24f1f`). **Prior:** `e1a8f7c` (Phase C), `a62ad93` (Phase B), `2694bc4` / `0649e04` (Phase A), `e38b276` (3J3, §6AC). **Purpose:** Record the repair work that makes DB records the main FieldDive foundation while preserving legacy localStorage estimates in a separated, non-destructive path.

### 1. Committed slices (Phases A–D)

| Phase | Commit | Module / surface | Scope |
|-------|--------|------------------|-------|
| **A — customer preservation** | `0649e04` | `jobStore.ts` | `jobDraftToInsertRow` sparse on update; `updateJob({ customer_id })` no longer wipes customer/contact/address fields when linking customer from Job Packet |
| **A — measurement preservation** | `2694bc4` | `measurementStore.ts`, `RoofingClient.tsx` | Split insert vs sparse update mappers; partial measurement saves no longer null-wipe omitted fields; `jobs.selected_measurement_id` written after measurement save/select |
| **B — Job Board partition** | `a62ad93` | `jobBoardAdapter.ts`, `SavedClient.tsx` | DB jobs render in primary kanban; legacy saved estimates in labeled secondary section; canonical open href resolution |
| **C — job= identity** | `e1a8f7c` | `RoofingClient.tsx`, `SavedClient.tsx` | Clean `entry=job-card&job=<uuid>` is authoritative; `currentLoadedSavedId` / session storage cleared on DB routes; board open to `job=` clears legacy sticky id |
| **D — validation test lock** | `87be1b4` | `proposalDraftGraphAdapter.test.ts` | Pure tests lock contract: invalid `proposal=` (wrong job, non-draft, zero options) returns `valid:false` — must not silently fall back to live preview |

**Phase D audit:** No production code changes required — existing 3J3 + Phases A–C already enforce DB-only proposal create/open. Phase D adds test coverage only.

### 2. Main source of truth

DB-first records are now the **main FieldDive foundation**:

| Table / record | Role |
|----------------|------|
| `jobs` | Job identity, stage, customer link, `selected_measurement_id`, `active_proposal_id` |
| `customers` | Persisted customer records |
| `measurement_records` | Roof measurement truth (quantities, `quantity_map`, proposal handoff context) |
| `catalog_items` | Company catalog line items + quantity drivers |
| `proposal_templates` (+ template graph tables) | Reusable proposal packages |
| `company_pricing_policies` | Company pricing policy |
| `proposals` | Job-specific proposal instance |
| `proposal_versions` | Draft/sent version rows |
| `proposal_pages` | Page snapshots |
| `proposal_options` | Option snapshots |
| `proposal_line_items` | Line item snapshots |
| `proposal_internal_summaries` | Contractor-only profitability summaries |
| `proposal_events` | Proposal lifecycle events |

**Job Card source of truth:** persisted `JobRecord` + linked `measurement_records` + `proposals` — not legacy saved-estimate JSON.

### 3. Legacy source status

Legacy localStorage saved estimates are **preserved but separated**:

| Rule | Detail |
|------|--------|
| **`loadSaved=`** | Legacy/import-only — opens saved estimate overlay path |
| **`currentSaved` / `currentLoadedSavedId`** | Legacy session keys only — not authoritative for DB job cards |
| **`roofing_current_loaded_saved_id`** | Cannot bleed into clean `job=` routes (Phase C clears/ignores on DB entry) |
| **Job Board** | Legacy saved estimates appear in a **separate labeled section** ("Legacy saved estimates"); primary kanban = DB jobs only |
| **Linked legacy** | Legacy estimate with valid `jobId` opens `job=` (DB-backed Job Card) |
| **Legacy-only** | No linked `jobId` still opens `loadSaved=` |
| **Data safety** | **No localStorage data deleted** — legacy rows remain accessible |
| **No backfill implied** | Old saved estimates are **not** automatically converted to DB jobs/proposals |

### 4. Route rules

**Main workflow (DB-first):**

```
Job Board → DB job card
  → /tools/roofing?entry=job-card&job=<jobId>
  → Job Card source of truth = job= (persisted JobRecord)
  → + Proposal (when checklist ready)
  → create/reuse DB proposal draft
  → /tools/roofing/proposals/builder?job=<jobId>&proposal=<proposalId>
  → Builder reads persisted proposal graph only
```

**Legacy paths (preserved, restricted):**

| Route / flag | Status |
|--------------|--------|
| `loadSaved=<estimateId>` | Legacy/import-only |
| `from=board` | Legacy/old path marker — not used on clean DB reopen |
| Board-origin + no DB identity | **Cannot create DB proposals directly** |
| Legacy-only estimate | No create-proposal action; checklist directs to open DB-backed Job Card or return to board |

### 5. Data preservation fixes

| Fix | Detail |
|-----|--------|
| **`jobDraftToInsertRow` sparse on update** | `updateJob(patch)` only writes keys explicitly present in patch — omitted fields are not nulled |
| **Customer link preservation** | `updateJob({ customer_id })` no longer wipes `customer_name`, `customer_email`, `customer_phone`, or address fields (`0649e04`) |
| **Measurement sparse update mapper** | `measurementRecordToUpdateRow(patch)` replaces full-row mapper for updates; insert uses `measurementDraftToInsertRowFields` |
| **Measurement re-save safety** | Re-save no longer wipes `quantity_map`, line fields, or proposal-relevant measurement context |
| **`jobs.selected_measurement_id`** | Written after measurement save/select on Job Card (`2694bc4`) |
| **`measurement_records.is_selected`** | Remains on row for compatibility; job pointer is authoritative for Job Card |

### 6. Proposal DB-only flow

Combines **§6AC** implementation with **Phases A–D** identity gates:

| Rule | Detail |
|------|--------|
| **Create requires clean DB `job=` identity** | `identityFromJobRecord` must be true; `proposalDraftCreatePayload` null otherwise |
| **Legacy / `loadSaved` blocked** | Cannot create DB proposal from legacy saved-estimate session |
| **Board-origin blocked** | `isBoardOrigin` without clean DB identity cannot create |
| **Create/reuse order** | `active_proposal_id` (valid draft) → listed job draft → `createDraftProposal` once |
| **`jobs.active_proposal_id`** | Written by `createDraftProposal` in `proposalRecordStore`; Job Card re-hydrates on return |
| **Builder with `proposal=`** | Reads `getDraftGraph` → `validateProposalDraftGraphForJob` → `adaptProposalDraftGraphToBuilderPreview` |
| **Invalid persisted draft** | Wrong job, non-draft status, missing graph, zero options → **error banner**; **no silent live-preview fallback** |
| **`job=` only (no `proposal=`)** | Live preview / no-persistence mode — clearly separate from persisted draft path |
| **Preview / Send / Sign / Payment** | **Remain disabled** — not ready |
| **DB proposal pricing spine** | **New foundation only** — `measurement_records` + `catalog_items` + `company_pricing_policies` + `proposalPricingEngine`; **not** legacy saved-estimate / tier estimator math |

**Test lock (`87be1b4`):** `validateProposalDraftGraphForJob` unit tests document the invalid-`proposal=` contract at the lib boundary the Builder relies on.

**Quantity resolver tests (`4f24f1f`):** `proposalQuantityResolver.test.ts` (32 tests) — waste upstream, no hidden unit conversion, missing quantity does not fake price, negative quantities pass resolver (blocked downstream by engine).

### 7. Manual smoke standard (DB-first foundation)

**Smoke order (full pass):** **§6AE.5** (3J3E option persistence) → **§6AF.9** (pricing trust) → **this checklist** (§6AD.7 full DB-first).

Run **§6AE.5** and **§6AF.9** before this checklist if not already done.

**Fresh DB job:**

- [ ] Create packet job with **unique** name / email / phone / address
- [ ] Confirm Job Card shows same fields after create
- [ ] Hard refresh Job Card — fields persist from DB
- [ ] Save measurement **2400** sqft (or equivalent)
- [ ] Hard refresh — selected measurement persists; `jobs.selected_measurement_id` set
- [ ] Re-save measurement **2500** — hard refresh — **no measurement context wipe** (`quantity_map`, line fields intact)
- [ ] Confirm Job Board shows DB job in **primary board** (not legacy section)
- [ ] Confirm lane filter still shows DB job
- [ ] Reopen from board via `job=` — URL has **no** `loadSaved=` and **no** `from=board` on clean DB path
- [ ] Create proposal **only when checklist says ready** (customer + measurement + catalog + template + pricing configured)
- [ ] Builder opens with `job=` **and** `proposal=`
- [ ] Second **+ Proposal** click reuses same proposal id (no duplicate)
- [ ] Invalid `proposal=` (wrong job / non-draft / empty options) shows error — **does not fall back silently** to live preview

**Legacy:**

- [ ] Legacy section still visible on Job Board
- [ ] Legacy-only estimate opens via `loadSaved=`
- [ ] Linked legacy estimate with valid `jobId` opens `job=`
- [ ] Legacy-only / board-origin **cannot create DB proposal directly** — checklist shows open DB-backed Job Card or return to board

**Still disabled (do not smoke as ready):**

- [ ] Preview / Send / Sign / Payment remain disabled

### 8. Remaining roadmap (post Phases A–D + 3J3E + pricing trust)

| Option | Notes |
|--------|-------|
| **3J3E** | Option selection persistence — **DONE** (`a7249b3`, §6AE) |
| **Pricing trust** | Snapshot display + stale refresh — **DONE** (`ce3d6bc`, §6AF); pricing engine/math untouched |
| **Next proposal draft slice** | Further draft editing/persistence (e.g. line copy, page context) — **after smoke**; **not** the pricing-trust stale/refresh fix (already done) |
| **Legacy conversion/import** | Plan path to migrate linked legacy estimates to DB jobs — **no automatic backfill today** |
| **Job Board legacy labeling** | Polish labels/badges after smoke confirms partition behavior |
| **3J4** | Page Context Strip backed by `proposal_pages` |
| **3K** | Preview / PDF / send — **later**; not ready |
| **3I-3D2 / §6Y** | Visual work — **deferred** until DB-first + pricing-trust smoke passes |

**Do not return to `loadSaved` / `currentSaved` as the main workflow.** **Do not mark Preview/Send/Sign/Payment as ready.** **Do not mark legacy system deleted.** **Do not imply old rows are backfilled.** **Do not touch Builder visuals unless explicitly scoped.**

### 9. Verification (Phases A–D)

| Checkpoint | Tests | Typecheck |
|------------|-------|-----------|
| **Phase D** (`87be1b4`) | **128/128** pass at Phase D; `proposalDraftGraphAdapter` **13/13** (+3 validation tests) | 6 known `RoofingClientV2.tsx` errors only |
| **3J3E** (`a7249b3`) | `proposalRecordStore` **26/26**; `proposalDraftGraphAdapter` **16/16** | same |
| **Quantity resolver** (`4f24f1f`) | `proposalQuantityResolver` **32/32** | same |
| **Phase C** (`e1a8f7c`) | `jobBoardAdapter`, `proposalSetupChecklist` extended | same |
| **Phase B** (`a62ad93`) | `jobBoardAdapter` partition + href tests | same |
| **Phase A** (`2694bc4`) | `measurementStore` sparse update tests (7) | same |

---

## 6AE. 3J3E — PERSIST PROPOSAL OPTION SELECTION COMPLETE

**Status:** **3J3E complete.** **Checkpoint:** `a7249b3`. **Prior:** `4f24f1f` (quantity resolver tests), `3b5138a` (§6AD docs), `87be1b4` (Phase D). **Purpose:** Persist Builder option tab selection to the DB proposal draft without reprice, line mutation, or duplicate create.

### 1. Committed slice

| Commit | Module / surface | Scope |
|--------|------------------|-------|
| `a7249b3` | `ProposalBuilderClient.tsx`, `proposalDraftGraphAdapter.ts` (+ tests), `proposalRecordStore.test.ts` | Builder option click persists via existing `updateDraftSelectedOption`; pure template↔runtime id mapping; optimistic UI + amber inline error + revert on failure |

**Production `proposalRecordStore.ts` unchanged** — `updateDraftSelectedOption` already implemented correctly.

### 2. Option ID mapping (critical — do not confuse)

| Layer | ID type | Example role |
|-------|---------|--------------|
| **Builder UI / `selectedOptionId` state** | Template option id (`source_template_option_id`) | Option tabs from `starterGraph.options[].id` |
| **DB `proposals.selected_option_id`** | Runtime `proposal_options.id` | UUID written on persist |
| **Load: runtime → template** | `resolveSelectedTemplateOptionIdFromGraph(graph)` | Initial tab on Builder open |
| **Save: template → runtime** | `resolveRuntimeOptionIdFromTemplateOptionId(graph, templateOptionId)` | Before `updateDraftSelectedOption` |

### 3. Behavior

| Rule | Detail |
|------|--------|
| **Initial load (`proposal=`)** | Selected tab from persisted `proposal.selected_option_id` via adapter |
| **Live preview (no `proposal=`)** | Local `selectedOptionId` only — no DB write |
| **User selects option** | Map template id → runtime id → `updateDraftSelectedOption(companyId, proposalId, runtimeOptionId)` |
| **Store side effects** | Updates `proposals.selected_option_id`; clears/sets `proposal_options.selected_at`; appends `draft_saved` event with `{ selected_option_id }` |
| **On success** | Local `persistedGraph.proposal.selected_option_id` updated for refresh consistency |
| **On failure** | Revert to previous tab; inline amber error; `ProposalRecordStoreError` inline only (no navigation) |
| **Explicitly NOT done** | No duplicate proposal create; no reprice; no line/item/total mutation; no navigation |
| **Preview / Send / Sign / Payment** | **Remain disabled** |

### 4. Quantity resolver test coverage (`4f24f1f`)

**File:** `app/lib/proposalQuantityResolver.test.ts` — **32/32 tests**. **Test-only commit** — no production files changed.

| Contract documented | Detail |
|---------------------|--------|
| **Waste upstream** | Resolver uses supplied handoff / `quantity_map` values — does not apply waste itself |
| **No hidden unit conversion** | SQ / LF / EA display only; no implicit conversion |
| **Missing quantity** | `unresolved` / `missing_quantity_field` — **no fake priced quantity** |
| **Negative quantity** | Passes through resolver; **pricing engine blocks downstream** |
| **Coverage gap closed** | Top missing pure-test layer between DB measurement context and proposal line quantities |

### 5. Manual smoke — 3J3E option persistence (next GPT: run first)

Requires a DB job with a proposal draft that has **multiple options**.

- [ ] Open Builder with `job=<jobId>&proposal=<proposalId>`
- [ ] Confirm selected tab matches persisted selected option
- [ ] Select a **different** option tab
- [ ] Confirm UI updates immediately
- [ ] Hard refresh Builder — **same option remains selected**
- [ ] Return to Job Card → **+ Proposal** again
- [ ] Confirm **same proposal id** and **same selected option**
- [ ] Confirm **no duplicate proposal** created
- [ ] Confirm totals/lines **unchanged** except selected-option view (snapshotted options, not recomputed)
- [ ] Confirm Preview / Send / Sign / Payment remain disabled

Then run **§6AF.9** (pricing trust smoke), then **§6AD.7** (full DB-first) if not already done.

### 6. Verification (3J3E)

| Checkpoint | Tests | Typecheck |
|------------|-------|-----------|
| **3J3E** (`a7249b3`) | `proposalRecordStore` **26/26** (+3 updateDraftSelectedOption); `proposalDraftGraphAdapter` **16/16** (+3 mapping) | 6 known `RoofingClientV2.tsx` errors only |
| **Quantity resolver** (`4f24f1f`) | `proposalQuantityResolver` **32/32** | same |

### 7. Next after smoke

See **§11 Roadmap buckets — NEXT** (proposal draft editing/persistence slices). Legacy import/conversion is **LATER**.

- **Do not** enable Preview/Send/Sign/Payment until **3K+**
- **Do not** return to `loadSaved` / `currentSaved` as main workflow

---

## 6AF. PRICING TRUST HARDENING — SNAPSHOT DISPLAY + STALE REFRESH COMPLETE

**Status:** **Pricing trust hardening complete.** **Checkpoint:** `ce3d6bc`. **Prior:** `a7249b3` (3J3E, §6AE), `e96aaab` (docs). **Purpose:** Fix trust-critical mixed-source display in persisted Builder path and wire manual refresh when job measurement changes after proposal snapshot.

### 1. Root issue

| Problem | Detail |
|---------|--------|
| **Mixed truth** | Persisted proposal path showed **live/current measurement quantities** (from `measurementHandoff` + `proposalQuantityResolver`) beside **stale snapshot prices** (from `proposal_line_items` via `proposalDraftGraphAdapter`) |
| **No stale signal** | Nothing compared `proposal_versions.context_echo.measurement_record_id` to the job's currently selected measurement |
| **Refresh not wired** | `refreshDraftPricing` existed in store but was **not imported or called** from Builder UI |
| **Context not re-stamped** | Refresh updated lines/options/summaries but did **not** update `context_echo` measurement fields — stale state could not clear |

**Not a formula bug:** pricing engine/resolver were sound; issue was **display/snapshot freshness contract** (§6AF.6).

### 2. Committed slice

| Commit | Module / surface | Scope |
|--------|------------------|-------|
| `ce3d6bc` | `proposalStaleness.ts` (+ test), `proposalPricingTrustFixtures.test.ts`, `proposalDraftGraphAdapter.ts` (+ test), `proposalRecordStore.ts` (+ test), Builder client/canvas/section/line table | Snapshot qty display; stale detection; amber banner; refresh action; context_echo re-stamp |

### 3. Fix — no mixed truth

| Rule | Detail |
|------|--------|
| **Persisted path quantities** | Line qty labels from **`proposal_line_items`** snapshot via adapter `snapshotQuantityByOptionId` — same source as prices |
| **Persisted path prices** | Unchanged — `customer_line_total_cents` from persisted snapshot |
| **Live measurement** | Still loaded for staleness detection + refresh input only — **not** shown as priced qty when `?proposal=` |
| **Context strip** | Persisted path: **`Measurement context (snapshot): …`** from `context_echo.measurement_quantities_display` |
| **Live preview (no `proposal=`)** | Unchanged — live measurement context + live qty preview |

### 4. Stale detection (`proposalStaleness.ts`)

| Rule | Detail |
|------|--------|
| **Pure module** | No Supabase, React, fetch, localStorage, pricing math |
| **Primary compare** | `context_echo.measurement_record_id` vs currently selected measurement id |
| **Equal ids** | Not stale (unless optional timestamp path: measurement `updated_at` newer than snapshot proxy → `measurement_updated`) |
| **Different ids** | Stale — `measurement_changed` |
| **Missing snapshot id** | Stale trust-first — `measurement_unknown` (refresh records id and clears) |
| **Banner copy** | *"Proposal pricing is based on an older measurement. Refresh draft pricing."* |

### 5. Stale banner + Refresh draft pricing (Builder)

| Rule | Detail |
|------|--------|
| **Banner** | Amber, non-blocking; shown when persisted draft + stale |
| **Refresh action** | Draft-only button in banner; **persisted `?proposal=` context only** |
| **Refresh input** | Current live `quantity_context` + `measurement_record_id` + `measurement_quantities_display` |
| **On success** | `setPersistedGraph(updatedGraph)` from store `getDraftGraph`; stale clears; inline success feedback |
| **On failure** | Inline error; no navigation |
| **Explicitly NOT done** | No `createDraftProposal`; no navigation; no Preview/Send/Sign/Payment enablement |
| **Preview / Send / Sign / Payment** | **Remain disabled** (`ProposalBuilderDisabledActions.tsx` unchanged) |

### 6. Store refresh (`refreshDraftPricing`)

| Rule | Detail |
|------|--------|
| **Draft-only** | Rejects non-draft version (existing + tested) |
| **Re-snapshot** | Deletes/re-inserts line items + internal summaries; updates option totals |
| **Preserves** | `selected_option_id`, pages/template structure |
| **Re-stamps** | Merges `context_echo.measurement_record_id` + `measurement_quantities_display` without wiping other context keys; syncs `proposals.measurement_record_id` |
| **Event** | Appends `draft_saved` with `{ reason: "refresh_draft_pricing" }` |
| **Boundary** | Customer/internal separation unchanged — forbidden keys still guarded |

### 7. Golden tests (pre-commit audit)

| File | Coverage |
|------|----------|
| `proposalStaleness.test.ts` | Stale detection (2300→2500 class), equal ids, missing snapshot id, timestamp path, banner copy, stale clears after refresh id re-stamp |
| `proposalPricingTrustFixtures.test.ts` | Pure engine: `unit_price`, `fixed_price`, `cost_plus_margin`, option total = line sum, missing qty blocks, `included` |
| `proposalDraftGraphAdapter.test.ts` | Golden #2 snapshot qty same source as price; missing qty no fake price |
| `proposalRecordStore.test.ts` | Refresh qty/total increase, option sum, preserve selected option, reject non-draft, no duplicate proposal/version, customer-safe lines, context_echo re-stamp |

**Results:** **175/175** tests passed in pre-commit audit. **Typecheck:** only **6** known `RoofingClientV2.tsx` errors — unchanged.

**Component-level gap:** ~~stale banner render, refresh button click, post-refresh UI~~ — **PASSED** in manual smoke (§6AF.9).

### 8. Protected math confirmation

**No pricing engine/math files changed:**

| File | Status |
|------|--------|
| `proposalPricingEngine.ts` | **Untouched** |
| `proposalPricingInputMapper.ts` | **Untouched** |
| `proposalQuantityResolver.ts` | **Untouched** |
| `proposalSnapshotBuilder.ts` | **Untouched** |

The fix was **display/snapshot freshness**, not a formula-engine bug.

### 9. Manual smoke

**User-reported (partial — aligns with fix):**

- Proposal numbers change correctly after measurement changes / refresh
- Builder showed **"Measurement context (snapshot)"**
- Shingles and underlayment values updated after refresh (e.g. shingles/underlayment totals realigned to snapshot)

**Full checklist — PASSED** (smoke gate; recorded after docs `3ec6f42`):

- [x] Create/open proposal at ~2300 sq ft
- [x] Change selected measurement to ~2500 sq ft
- [x] Open Builder with `?proposal=`
- [x] Confirm **amber stale banner** appears
- [x] Confirm line quantities are **snapshot** quantities, not live 2500
- [x] Confirm context strip says **snapshot**
- [x] Click **Refresh draft pricing**
- [x] Confirm shingles/underlayment quantities and totals update
- [x] Hard refresh Builder — refreshed values persist
- [x] Switch option, hard refresh — selection persists (§6AE)
- [x] Confirm **no duplicate proposal**
- [x] Confirm Preview / Send / Sign / Payment remain disabled

**§6AD.7** full DB-first smoke — **PASSED** (recorded after docs `3ec6f42`).

### 10. Verification (pricing trust)

| Checkpoint | Tests | Typecheck |
|------------|-------|-----------|
| **`ce3d6bc`** | **175/175** (see §6AF.7) | 6 known `RoofingClientV2.tsx` errors only |

### 11. Next after smoke

See **§11 Roadmap buckets — NEXT** (proposal draft editing/persistence slices). Legacy import/conversion is **LATER**.

- **Do not** enable Preview/Send/Sign/Payment until **3K+**
- **Do not** return to `loadSaved` / `currentSaved` as main workflow

---

## 6AG. 3J4C — DOCUMENT-FIRST PROPOSAL BUILDER COMPLETE

**Status:** **3J4C document-first Builder complete.** **Checkpoint:** `f8bffde`. **Prior:** `4c9a77d` (3J4A final-surface navigation), `ce3d6bc` (pricing trust, §6AF), `0763799` (smoke gate docs). **Purpose:** Pivot Builder from workbench/tab-first to **document-first** — the Estimate page is the customer-facing proposal document; guidance and trust systems support the workflow without dominating it.

### 1. Architecture change (workbench → document-first)

| Before (3J4B and earlier) | After (3J4C) |
|---------------------------|--------------|
| Workspace tabs (Overview, Options, Sections, Line Items, Quantities) as primary flow | **Removed** — Estimate document is primary |
| Line items hidden behind Line Items tab | **Inline** on Estimate page |
| Overview panel as dashboard recap | **Removed** — content relocated to inspector/header |
| Right rail as diagnostics dashboard + guided-path ladder | **Proposal Helper** contextual inspector |
| Internal profitability visible on main rail | **Removed** from visible main rail |
| Package cards as hero board | **Package selector** — full cards before selection; compact summary + Change package / View details after |

### 2. Inline Estimate document (primary canvas)

When **Estimate** is the active page context, the canvas renders the actual proposal document inline:

| Element | Component / behavior |
|---------|-------------------|
| **Package selector** | `ProposalBuilderPackageSelector.tsx` — full cards before explicit selection; compact selected-package summary after; inline View details expansion |
| **Blocker banner** | Short amber banner above line items when pricing blockers or guardrail attention (copy shortened in readability pass) |
| **Proposal sections** | `ProposalBuilderSectionPreview` per template section |
| **Line item tables** | `ProposalBuilderLinePreviewTable` — document-style rows with customer price; internal metadata (Source, Rule, Unit, Role) in default-closed **Line details** disclosures (§6AH) |
| **Document totals** | `ProposalBuilderDocumentTotals` |

Non-estimate pages (Cover, Terms, Warranty, Project Overview, Project Photos) render as customer-facing document pages or honest placeholders. **3J4F** (`bfa0454`, §6AJ) extended text pages to read-only customer document rendering with persisted `body_markdown`.

### 3. Proposal Helper / contextual inspector (secondary right rail)

`ProposalBuilderSummaryRail.tsx` — **not** a diagnostics dashboard.

| Visible (primary) | Collapsed by default (`<details>`) |
|-------------------|-------------------------------------|
| **Next Action** card (from `proposalBuilderGuidance.ts`) | **Setup Readiness** (measurement, quantities, catalog, template) |
| **Pricing Readiness** (policy, status, blocking lines, guardrail words only) | **Guided Path** (11-step ambient ladder) |
| Footer note (lifecycle disabled — status only) | **About This Proposal** (template description, draft status, draft ID) |

**Explicitly removed from visible main rail:** internal profitability dollars/margin.

### 4. Header + page strip (unchanged role, refined)

| Surface | Role |
|---------|------|
| **Header** (`ProposalBuilderPageHeader.tsx`) | Job-specific Proposal Builder identity; template/package chips; Draft/Saved status; **locked** Preview / Send / Sign / Payment (`ProposalBuilderDisabledActions.tsx`) |
| **Page strip** (`ProposalBuilderPageContextStrip.tsx`) | Document navigation — Cover, Estimate, Terms, Warranty, Project Overview, Project Photos, Add Page (locked/future); status chips (Active, Template, Empty, Soon, Locked); **no duplicate Preview** control |

### 5. Protected systems unchanged (3J4C code commit)

**3J4C did not change:**

| System | Status |
|--------|--------|
| Pricing math (`proposalPricingEngine`, mapper, resolver) | **Untouched** |
| Proposal totals display logic | **Untouched** |
| Quantity resolver | **Untouched** |
| Proposal snapshot builder | **Untouched** |
| Stale banner behavior | **Untouched** |
| `refreshDraftPricing` behavior | **Untouched** |
| Selected-option persistence (`updateDraftSelectedOption`) | **Untouched** |
| DB proposal identity (`?job=` + `?proposal=`) | **Untouched** |
| Legacy routing | **Untouched** |
| Preview / Send / Sign / Payment disabled behavior | **Untouched** |
| SQL / migrations / package files / docs (code commit) | **Untouched** |

### 6. File-level changes (`f8bffde`)

**Added:**

| File | Purpose |
|------|---------|
| `app/lib/proposalBuilderGuidance.ts` | Pure guided-flow model — steps, next action, lifecycle locks (UI-independent) |
| `app/lib/proposalBuilderGuidance.test.ts` | 13 tests for guidance derivation |
| `app/tools/roofing/proposals/builder/ProposalBuilderOptionsPanel.tsx` | Read-only package detail surface (inline via selector View details) |
| `app/tools/roofing/proposals/builder/ProposalBuilderPackageSelector.tsx` | Document-flow package selector (collapse/expand, Change package) |

**Deleted:**

| File | Reason |
|------|--------|
| `ProposalBuilderOverviewPanel.tsx` | Redundant with inspector + header; old workbench pattern |
| `ProposalBuilderWorkspaceTabs.tsx` | Tabs removed — document is primary |

**Modified (builder UI + navigation):**

`proposalBuilderNavigation.ts` / `.test.ts`, `ProposalBuilderCanvas.tsx`, `ProposalBuilderClient.tsx`, `ProposalBuilderDisabledActions.tsx`, `ProposalBuilderLinePreviewTable.tsx`, `ProposalBuilderPackageCards.tsx`, `ProposalBuilderPageAlerts.tsx`, `ProposalBuilderPageContextStrip.tsx`, `ProposalBuilderPageHeader.tsx`, `ProposalBuilderSummaryRail.tsx`, `proposalBuilderConstants.ts`

### 7. Validation (`f8bffde` pre-commit audit)

| Check | Result |
|-------|--------|
| `proposalBuilderGuidance.test.ts` + `proposalBuilderNavigation.test.ts` | **19/19** pass |
| `npx tsc --noEmit` | Only **6** known pre-existing `RoofingClientV2.tsx` errors |
| Working tree after commit | **Clean** |

### 8. No-drift Builder rules (3J4C–3J4F)

**Do not reintroduce:**

- Old **Overview-first** Builder
- Old **workspace tabs** as the primary flow (Overview, Options, Sections, Line Items, Quantities tabs)
- **Diagnostic-dashboard rail** as the main surface
- **Internal profitability** in the visible customer-facing Builder rail
- **Preview duplicated** as both page-strip control and lifecycle action
- **Fake media upload**, **fake page editing**, or **fake Preview/PDF/Send/Sign/Payment enablement**

**Keep:**

- **Document-first Estimate** — inline package selector, blocker banner, sections, line items, totals
- **Package/options inside Estimate** — selected-package summary, Change package, View details (§6AI)
- **Line details collapsed by default** for contractor/internal metadata (§6AH)
- **Text pages as read-only customer document pages** — persisted `body_markdown` or calm empty states (§6AJ)
- **Proposal Helper / inspector** pattern — Next Action + Pricing Readiness visible; other sections collapsed
- **Page strip** as document navigation only
- **Lifecycle actions** only in header (disabled until 3K+)
- **Cover / Photos / Add Page / Preview / PDF locked** until scoped dependencies exist
- **Protected pricing/trust systems** (§6AF, §6AE, §6AD)
- **Explicit locked/future states** on lifecycle and Add Page

### 9. Next roadmap after 3J4C (superseded by §6AH–§6AJ, §11)

| Priority | Work | Status |
|----------|------|--------|
| ~~Estimate document readability~~ | Line row hierarchy, Line details disclosures | **DONE** (`c42a559`, §6AH) |
| ~~Package/options detail surface~~ | Selected-package summary, grouped placeholders | **DONE** (`72768ae`, §6AI) |
| ~~Customer text page rendering~~ | Terms/Warranty/Project Overview/custom_text | **DONE** (`bfa0454`, §6AJ) |
| **Later** | See **§11 — Future / Later bucket → Proposal Builder (document-first)** | **OPEN** |
| **3K+** | Preview / PDF / Send — **remain disabled** | **LOCKED** |
| **3L+** | Sign / Payment — **remain disabled** | **LOCKED** |

- **Do not** enable Preview/Send/Sign/Payment without explicit scope
- **Do not** revert to workbench/tab-first Builder layout
- **Continue Roofr research** before each major page/workflow build to prevent drift

---

## 6AH. 3J4D — ESTIMATE READABILITY COMPLETE

**Status:** **3J4D Estimate readability complete.** **Checkpoint:** `c42a559`. **Prior:** `f8bffde` (3J4C document-first Builder). **Purpose:** Refine Estimate line-item presentation for customer-facing readability without changing document-first architecture or protected systems.

### 1. What changed (presentation only)

| File | Change |
|------|--------|
| `ProposalBuilderLinePreviewTable.tsx` | Line rows read as customer estimate lines; Source/Rule/Unit/Role moved to default-closed **Line details** `<details>` |
| `ProposalBuilderCanvas.tsx` | Section spacing tightened (`space-y-6`); no Estimate logic changes |
| `ProposalBuilderSectionPreview.tsx` | Section titles bumped to `text-lg` for clearer hierarchy |

### 2. Line row hierarchy

- **Primary:** item name (15px semibold) + blocker pill when needed
- **Visible:** quantity (bold tabular value) + customer price (right column)
- **Collapsed by default:** Source, Rule, Unit, Role, resolved quantity status in per-row **Line details** disclosure
- Needs-attention rows (catalog missing + needs quantity) share subtle `bg-amber-50/40` tint

### 3. Protected systems unchanged

No changes to pricing/math, proposal totals, quantities, selected-option persistence, stale banner, `refreshDraftPricing`, DB proposal identity, legacy routing, or lifecycle enablement. Preview / Send / Sign / Payment remain disabled.

### 4. Validation (`c42a559`)

| Check | Result |
|-------|--------|
| `proposalBuilderGuidance.test.ts` + `proposalBuilderNavigation.test.ts` | **19/19** pass |
| `npx tsc --noEmit` | Only **6** known pre-existing `RoofingClientV2.tsx` errors |

---

## 6AI. 3J4E — PACKAGE / OPTIONS DETAIL SURFACE COMPLETE

**Status:** **3J4E package/options surface complete.** **Checkpoint:** `72768ae`. **Prior:** `c42a559` (3J4D). **Purpose:** Refine Standard / Enhanced / Premium package/options presentation inside the document-first Estimate without changing selection persistence or protected systems.

### 1. What changed (presentation only)

| File | Change |
|------|--------|
| `ProposalBuilderPackageSelector.tsx` | Clearer selected-package summary hierarchy; dot-separated spec line from differentiators; clearer Done button |
| `ProposalBuilderOptionsPanel.tsx` | Real values as clean spec rows; missing fields grouped under **Details to complete later** (no repeated "Not set (placeholder)" rows) |
| `ProposalBuilderPackageCards.tsx` | Selected card badge reads **Current**; others **Included**; removed dead non-interactive View details span |

### 2. Behavior preserved

- Selected-option persistence unchanged (`onSelectOption` path)
- View details / Change package behavior unchanged
- Package selector remains inside Estimate document header
- No fake add-ons, editing, or live manufacturer/catalog content

### 3. Protected systems unchanged

No changes to pricing/math, proposal totals, quantities, selected-option persistence, stale banner, `refreshDraftPricing`, DB proposal identity, legacy routing, or lifecycle enablement. Preview / Send / Sign / Payment remain disabled.

### 4. Validation (`72768ae`)

| Check | Result |
|-------|--------|
| `proposalBuilderGuidance.test.ts` + `proposalBuilderNavigation.test.ts` | **19/19** pass |
| `npx tsc --noEmit` | Only **6** known pre-existing `RoofingClientV2.tsx` errors |

---

## 6AJ. 3J4F — CUSTOMER CONTENT PAGE RENDERING COMPLETE

**Status:** **3J4F customer text pages complete.** **Checkpoint:** `bfa0454`. **Prior:** `72768ae` (3J4E). **Purpose:** Extend document-first Builder beyond Estimate by rendering customer-facing text pages as clean, read-only proposal document pages — Roofr-aligned page model, presentation only.

### 1. Architecture extension

| Page type | Behavior after 3J4F |
|-----------|---------------------|
| **Estimate** | Unchanged — inline document (§6AG) |
| **project_overview** | Read-only customer document page; renders persisted `content_json.body_markdown` when present |
| **terms** | Same |
| **warranty** | Same |
| **custom_text** | Same (overflow pages from DB) |
| **cover** | Honestly locked — Soon/disabled; no image upload |
| **photos** | Honestly reserved placeholder — no media gallery |
| **pdf_attachment** | Not rendered |
| **add_page** | Disabled/Soon |

### 2. Persistence check (C0 audit)

1. **Canvas receives persisted pages** — yes, via `persistedGraph?.pages` from `ProposalBuilderClient`.
2. **`content_json.body_markdown` exists** — yes, copied at draft instantiate from template sections (`proposalSnapshotBuilder.buildPageContent`); starter template ships real bodies in `defaultRoofingProposalTemplates.ts`.
3. **Strip slots** — persisted proposals use real DB pages (`fromDb: true`); unpersisted drafts use `MOCK_PLACEHOLDER_PAGES` (empty states).
4. **Prior discard point** — `ProposalBuilderCanvas` non-Estimate branch used generic `CustomerPagePanel` and ignored `body_markdown`.
5. **Empty state location** — same branch, via `ProposalBuilderCustomerPage` when body is missing.

### 3. File-level changes (`bfa0454`)

**Added:**

| File | Purpose |
|------|---------|
| `ProposalBuilderCustomerPage.tsx` | Read-only customer text page renderer — safe paragraph/bullet parsing; no markdown package; no `dangerouslySetInnerHTML` |

**Modified:**

| File | Change |
|------|--------|
| `ProposalBuilderCanvas.tsx` | Routes supported text page types to customer page renderer; Estimate branch untouched |
| `proposalBuilderNavigation.ts` | One additive pure helper `resolvePageTypeForContext` — no existing navigation logic changed |

### 4. Empty states (when no body)

| Page | Copy |
|------|------|
| Project overview | "Project overview content will appear here." |
| Terms | "Terms will appear here before sending." |
| Warranty | "Warranty details will appear here before sending." |
| Custom text | "Page content will appear here." |

Secondary line on all: "Page content is added in a later editing phase."

### 5. Protected systems unchanged

No changes to pricing/math, proposal totals, quantities, selected-option persistence, stale banner, `refreshDraftPricing`, DB proposal identity, legacy routing, or lifecycle enablement. No media upload, PDF generation, signing, payment, page editing, or page reordering added. Preview / Send / Sign / Payment / Add Page remain disabled.

### 6. Validation (`bfa0454`)

| Check | Result |
|-------|--------|
| `proposalBuilderGuidance.test.ts` + `proposalBuilderNavigation.test.ts` | **19/19** pass |
| `npx tsc --noEmit` | Only **6** known pre-existing `RoofingClientV2.tsx` errors |

### 7. No-drift rules (3J4F+)

See **§3 Builder-specific rule** and **§6AG.8** — do not reintroduce Overview/workspace tabs, diagnostics rail, fake lifecycle enablement, or fake media/editing.

### 8. Continue Roofr research before major builds

Before each major page/workflow slice (Cover, Photos, Preview/PDF/Send, customer option selection at signing), run Roofr research pass to confirm proven flow shape — do not invent FieldDive-only systems. Tracked in **§11 — Future / Later bucket → Proposal Builder (document-first)**.

---

## 6AK. 3J4G-ROADMAP + 3J4H-R — PROPOSAL CONTENT ARCHITECTURE (DOCS ONLY)

**Status:** **3J4G-Roadmap** (`57108bd`) + **3J4H-R Roofr IA correction** (`40e5f5b`) + **R0–R3** recovery docs complete (`f1dba95`–`5927ab5`, §6AL–§6AO) + **R4–R6** template content editor **complete** (`9db2030`–`3c6214c`) + **R10** structure/settings **complete** (`bc42b1e`–`b3dd904`, §6AQ) + **pre-R10 P1** Job Card truth (`d0ba188`, §6AP). **Code checkpoint:** `b3dd904`. **Purpose:** Lock **proposal content-authoring architecture**. Hardcoded seed bodies are **fallback seed content only** — not the final contractor-controlled content system.

**Recovery order:** **§6AL — RoofrExact Recovery Playbook** is the **mandatory execution order** for all future work. This section records content architecture only — **sequencing is in §6AL**, not duplicated here.

### 1. Full-roadmap alignment note

Full-roadmap audit (post-3J4F) + **deep Roofr architecture audit (3J4H-R)** — FieldDive is **on course** on the main spine:

| Finding | Verdict |
|---------|---------|
| **3J4C–3J4F on-roadmap?** | **Yes** — Stage **3J / 3J4** document-first Proposal Builder (§6AG–§6AJ) |
| **3J4C + 3J4F before Preview/PDF?** | **Yes** — Preview/PDF needs a stable **multi-page customer document** (Estimate + text pages rendered) |
| **3J4D + 3J4E** | Scoped **presentation** improvements — **stop here**; avoid endless Builder polish |
| **Spine prerequisites skipped?** | **No** — Jobs Board, Job Card, Measurement, Catalog, Templates, proposal persistence (3J), pricing trust are **done** |
| **Main open foundation** | **Template content editor** on `/tools/roofing/templates` — reusable proposal prose lives in **templates** (Roofr model), not company-level Terms/Warranty defaults |

**3J4H-R critical Roofr finding:** Terms, Warranty, Scope, About, What-to-Expect, Reviews, and Product Overview are **template-level reusable page content** — not company-level proposal content defaults. Roofr company settings hold **branding/identity** (logo, name, address, brand colors, license) and **profitability type** — not reusable Terms/Warranty body text.

### 2. Four-layer proposal content model (Roofr-aligned)

```
Company branding / identity settings
  → Proposal Template content defaults
    → Job-specific Proposal pages
      → Customer-facing rendered proposal
```

| Layer | Role |
|-------|------|
| **Company branding / identity settings** | Account-wide business identity: company name, website, **address**, **logo**, **brand colors**, **license/contractor identity**, notifications email; **profitability type** at `/tools/settings/pricing`. Feeds **cover/branding and dynamic fields** — **not** reusable Terms/Warranty prose. |
| **Proposal Template content defaults** | Reusable **template-specific** page content: Terms, Warranty, Scope, About, What to Expect, Reviews, Product Overview, Post-install, etc. (`proposal_template_sections.content`). **Primary home for proposal prose** (Roofr: Proposals ▸ Templates). |
| **Job-specific Proposal pages** | **Copy-on-create** snapshots from the selected template at draft instantiate (`proposal_pages.content_json`). Per-job edits in Builder later — **must not mutate the master template**. |
| **Customer-facing rendered proposal** | Builder read path today: `proposal_pages.content_json.body_markdown` → `ProposalBuilderCustomerPage.tsx`. Future Preview/Present/PDF reads job-specific pages + snapshot truth. |

**Critical rules:**

- `defaultRoofingProposalTemplates.ts` is only the **app fallback seed floor** for new template installs — pre-fills template section content on install; not contractor-controlled content; not retroactive proposal rewrites.
- **Do not** describe Terms/Warranty/Scope as **company-level defaults**.
- **Do not** build `/tools/settings/proposals` as a Terms/Warranty content-default store.

### 3. Current content chain (implementation truth)

```
defaultRoofingProposalTemplates.ts
  → installDefaultRoofingProposalTemplates (insert-only, seed_key dedupe)
    → proposal_template_sections.content
      → buildDraftInstantiatePayload / mapTemplateSectionsToProposalPages / buildPageContent
        → proposal_pages.content_json.body_markdown
          → ProposalBuilderCustomerPage.tsx (3J4F read-only render)
```

**Current gaps (no UI today):**

| Capability | Status |
|------------|--------|
| Edit company branding beyond basic profile | **Partial** — `/tools/settings` has name/phone/email/license/logo; missing address, website, brand colors, CLN-on-cover |
| Edit template page text (Terms/Warranty/Scope/etc.) | **Available (R6)** — per-section `body_markdown` editor on `/tools/roofing/templates` |
| Edit template structure + estimate display settings | **Available (R10)** — Structure & estimate settings on `/tools/roofing/templates` (§6AQ); **not** pricing policy/margins |
| Edit job-specific proposal page text | **Not available** — only `updateDraftSelectedOption` persists; no `updateProposalPage` mutation path |

**Persistence semantics:**

- Existing persisted `proposal_pages` **keep** copied `body_markdown` at draft create.
- Changing seed copy in `defaultRoofingProposalTemplates.ts` affects **new installs / new drafts only** — does **not** retroactively rewrite existing proposals.
- Editing template sections affects **future drafts** from that template — not existing `proposal_pages` unless re-instantiated.

### 4. Corrected stage sequence (from current checkpoint)

**Full ordered recovery:** **§6AL** (R0–R23). Summary mapping to legacy stage labels:

| §6AL | Legacy label | Scope |
|------|--------------|-------|
| **R4–R6** | **3J4H** | Template content editor (view-model → workspace → save) |
| **R10** | **3J4I** | Template page/content structure + estimate settings | **DONE** (`bc42b1e`–`b3dd904`, §6AQ) |
| **R12** | **3J4J** | Job-specific proposal page editor |
| **R11** | Later | Company branding/identity in Settings + context_echo stamping | **DONE** (`0146dac`–`29722a0`, §6AR + §6AS) |
| **R14** | Later | Media foundation |
| **R17–R20** | **3K0–3K3** | Preview → Send → Sign → Payment |
| **R21** | **3L / 3M** | Production spine |

**Do not** make company-level Terms/Warranty defaults any stage. **R1–R3** docs gates **complete**; **R4–R6** template content editor **complete**.

### 5. 3J4G guardrails (completed at `ce7aa39`)

**3J4G allowed:** improve starter seed copy in `defaultRoofingProposalTemplates.ts` only.

**3J4G did not:** add company settings, template editor, job editor, rewrite existing `proposal_pages`, touch Builder layout/lifecycle, or enable Preview/Send/Sign/Payment.

### 6. Settings / Admin guidance (3J4H-R)

- **Do not** build `/tools/settings/proposals` Terms/Warranty content-default store at this stage.
- **`/tools/settings`** remains the right place for **company identity and branding** (extend later with address, website, brand colors, CLN-on-cover).
- **`/tools/settings/pricing`** remains the current **company pricing policy** surface.
- Company settings feed proposal **branding and dynamic fields**, not reusable Terms/Warranty body text.
- **Do not** place proposal content defaults under **`/admin/*`** — admin is legacy/data-shelf territory, not the main FieldDive workflow spine.

### 7. Templates guidance (3J4H — sequenced by §6AL)

- **`/tools/roofing/templates`** remains the **interim durable route** for reusable proposal content editing until a future **Proposals hub** exists (§6AL **R16**; ownership **§6AO**). Roofr long-term: Proposals ▸ Templates; **no route migration until R16**.
- **`/tools/roofing/templates`** is the **Template Workspace** (R5–R6 **complete**) — install, readiness, per-section content editor.
- Use existing **`proposal_template_sections.content`**; **`updateProposalTemplateSection`** wired — **R6 complete**.
- **§6AL mapping:** **R4** = Pass 3B view-model helper (**done**); **R5** = Pass 3C workspace shell (**done**); **R6** = Pass 3D content editor + save (**done**); **R10** = structure + estimate settings (**done**, §6AQ).
- **First slice (R6):** edit existing **text sections only** — Terms, Warranty, Project Overview/Scope; `body_markdown` in section content.
- **R10 (done):** add/reorder template sections per option; estimate display settings (`ProposalPageSettings`); new drafts receive estimate `settings_json` (§6AQ).
- **Do not start with:** job-specific editing (**R12**), catalog item detail editing inside templates.
- **Catalog** remains the single source for line item definitions; templates reference catalog items only.

### 8. Job-specific Builder guidance (3J4J — later)

- Job-specific page editing belongs in **Proposal Builder** after template editor foundation.
- Requires future **`updateProposalPage`** mutation/path on `proposal_pages` only.
- Per-job edits **must not** mutate the master template (existing helper copy: *"editing here does not change the master template"*).
- Builder already renders job-specific `body_markdown` read-only (3J4F).

### 9. Content-architecture drift risks

Treat as **drift** if a session:

- **Builds a company-level Terms/Warranty content store** before template editor
- **Puts proposal content defaults under `/admin/*`**
- **Treats Settings as the home for reusable proposal prose** instead of templates
- **Builds template editor UI** before **R0–R3** recovery docs gates (§6AL)
- **Edits catalog item definitions inside templates** (Roofr: items must exist in catalog; no catalog detail editing at template level)
- **Builds job-specific editor** before reusable template editing
- **Builds Preview/PDF/Send** before template and job content semantics are stable
- **Over-polishes Builder presentation** instead of content/editor infrastructure
- **Hardcodes seed copy** and treats it as the final contractor-controlled system
- **Returns to `loadSaved` / `currentSaved`** as the main proposal workflow
- **Reintroduces Overview/workspace tabs** or enables **Preview/Send/Sign/Payment** too early
- **Invents FieldDive-only flows** instead of Roofr multi-page document shape

- **Builds downstream proposal/template/lifecycle features** before upstream IA/module ownership is documented (§6AL)
- **Uses `/admin/*` shelves** as primary module architecture
- **Preserves old setup-page identity** on Templates route just because it exists

See also **§11 — What counts as drift** and **§6AL** recovery guardrails.

### 10. Next code step (sequenced by §6AL)

**Immediate:** **Do not auto-start R15.** After R13 docs checkpoint (§6AU), **R15 scoping/planning** (branded cover/display) **only after explicit direction**.

**Do not start implementation** without scoped audit. Do not touch pricing policy/math unless explicitly scoped; do not reopen R11b/R11c paths unless bugfix-scoped; do not create Proposals hub; do not enable lifecycle actions.

Full mandatory order: **§6AL**. Open checklist with §6AL stage IDs: **§11 — Future / Later bucket** only — **no duplicate list**.

---

## 6AL. ROOFR EXACT RECOVERY PLAYBOOK

**Status:** **R0** complete (`f1dba95`). **R1** complete (`b70cdd7`, §6AM). **R2** complete (`2e1c36b`, §6AN). **R3** complete (`5927ab5`, §6AO). **R4** complete (`9db2030`). **R5** complete (`ffc1cc0`). **R6** complete (`3c6214c`). **R7** complete (`05b9c54`). **R8** complete (`1191ddd`). **R9** complete/satisfied (`1915b2d` + pre-R10 audit; P1 truth at `d0ba188`). **R10** complete (`bc42b1e`–`b3dd904`, §6AQ). **R11** complete (`0146dac`–`139e8a3`, §6AR). **R11c** complete (`29722a0`, §6AS). **R12** complete (`31059e3`, §6AT). **R13** complete (`e40db30`, §6AU). **Pre-R10 P1 bugfix** complete (`d0ba188`, §6AP). **Purpose:** Single ordered recovery roadmap from the earliest confirmed product-shell drift through templates, Builder, lifecycle, and production.

**Next required gate:** **Explicit-direction scoping** — **R15** branded cover/display (§6AU). **Do not auto-start code.**

**Opening rules (mandatory):**

- FieldDive’s **DB-first proposal data spine** is mostly Roofr-aligned and **protected** (catalog → templates → copy-on-create proposals → Builder → pricing/snapshots).
- **Product shell / module ownership drift** starts **earlier than Templates** (global IA, Jobs Board identity, missing Proposals module, Job Card create flow, legacy admin shelves).
- Recovery must start at **global IA / module ownership documentation** — **not** downstream UI or lifecycle features.
- **This section is the mandatory order** for future GPT/Cursor work. **Do not skip stages** without explicitly updating §6AL.
- **§11** is the single open-work checklist — items reference **§6AL stage IDs**; do not duplicate the full playbook elsewhere.

### Earliest confirmed drift point

**Global IA / left navigation / module ownership** — not Templates, not Builder. Chronologically older legacy (`estimateStore`, `RoofingClient`) is **isolate/retire later** (R23), not the first recovery code slice.

### Ordered recovery stages (R0–R23)

| Stage | Type | Purpose | Depends on | Stop gate | Do not touch |
|-------|------|---------|------------|-----------|--------------|
| **R0** | Docs | Lock this playbook in handoff | — | §6AL committed; header/§11 aligned | App code |
| **R1** | Docs | Global IA / module ownership (target + interim nav) | R0 | Target module map + current shell nav truth + interim rules documented (**§6AM**); nav code deferred **R7**; Proposals hub deferred **R16** | Route migration; nav code |
| **R2** | Docs | Jobs Board / `saved` identity; legacy boundary | R0 | Route = Job Board (**§6AN**); DB-primary + legacy-secondary partition; Job Board vs Proposals lifecycle boundary; R8 scope; flow-map conflict noted; protected systems untouched | Route migration; `estimateStore` migration |
| **R3** | Docs | Proposals hub ownership (defer hub route) | R1 | Future hub ownership + route truth + interim posture documented (**§6AO**); R4–R6 guardrails; R9 vs R16; no route migration / hub UI / lifecycle actions | Building hub UI; route migration |
| **R4** | Code | 3J4H Pass 3B — `buildTemplateContentEditorViewModel` + tests | R0 | Helper tests pass; lib-only diff | UI, store changes |
| **R5** | Code | 3J4H Pass 3C — Template Workspace shell | R1, R3, R4 | Workspace zones render; install unchanged | Save wiring, lifecycle |
| **R6** | Code | 3J4H Pass 3D — content editor + per-section save | R5 | `body_markdown` persists per section | Bulk edit, job pages |
| **R7** | Code | Global IA nav code (light) | R1, R3; R6 preferred | Nav labels/grouping updated | Full hub build |
| **R8** | Code | Jobs Board identity code (light) | R2 | Copy/sections clarify DB vs legacy | Status lane polish |
| **R9** | Code | Job Card + Proposal create flow (+ measurement → template) | R6 | E2E create/open from Job Card Proposals tab; pre-R10 P1 truth at `d0ba188` | Preview/Send |
| **R10** | Code | 3J4I — template structure + estimate settings | R6 | Add/reorder sections; estimate display settings on template + draft `settings_json` (**done** `bc42b1e`–`b3dd904`, §6AQ) | Job editor |
| **R11** | Code | Settings branding expansion (not Terms prose) | R1 | Identity + extended branding persist on `/tools/settings` (**done** `0146dac`–`139e8a3`, §6AR) | R11c echo stamping |
| **R11c** | Code | Company branding → `context_echo` at draft create | R11b | Stamp DB-truth branding into `proposal_versions.context_echo`; adapter DTO only (**done** `29722a0`, §6AS) | Builder cover UI |
| **R12** | Code | 3J4J — job-specific page editor (`updateProposalPage`) | R6, R10 | Job edits don't mutate template | Template rows |
| **R13** | Code | Frozen document token foundation (registry + context + resolver) | R11c, R12 | 23 tokens resolve from frozen graph only (**done** `e40db30`, §6AU) | Builder UI, markdown merge, lifecycle |
| **R14** | Code | Media foundation (cover/photos/PDF/report) | R10 | Storage + refs exist | Fake upload UI |
| **R15** | Code | Builder layout (left rail + right settings drawer) | R12, R14 | Roofr-shaped editor chrome | Enable Preview |
| **R16** | Code | Proposals hub foundation (Draft/Sent/Won/Lost) | R7, R9 | Hub list + status filters | Retire Templates route |
| **R17** | Code | 3K0 Preview / Present | R12, R15 | Preview uses snapshot + pages | Send |
| **R18** | Code | 3K1 Send / PDF | R17 | Draft→sent status | Sign |
| **R19** | Code | 3K2 Sign / approval bridge | R18 | Signed copy; won/lost hooks | Payment |
| **R20** | Code | 3K3 Payment / deposits | R19 | Deposit on signed proposal | Production |
| **R21** | Code | 3L/3M production spine | R20 | Work orders, material orders, invoices | Legacy cleanup |
| **R22** | Code | Automations / follow-ups | R16, R19 | Stage ↔ proposal status | — |
| **R23** | Code | Legacy cleanup | R16, R21 | No new features on `estimateStore` | Protected pricing APIs |

### 3J4H pause / resume rules

| Pass | §6AL | Status |
|------|------|--------|
| Pass 2 helper (`8c04c2a`) | Pre-R4 | **DONE** |
| Pass 3B view-model (`9db2030`) | **R4** | **DONE** |
| Pass 3C workspace shell (`ffc1cc0`) | **R5** | **DONE** |
| Pass 3D editor + save (`3c6214c`) | **R6** | **DONE** |
| R10a helpers (`bc42b1e`) | **R10** | **DONE** |
| R10b Structure/Settings UI (`e33e659`) | **R10** | **DONE** |
| R10c draft `settings_json` (`b3dd904`) | **R10** | **DONE** |

Template content editor **completed** at **R4–R6**. Template structure + estimate settings **completed** at **R10** (§6AQ). **Next template-adjacent work:** **R12** job-specific page editor — **audit before code**.

### Cursor pass start/stop gate rule

**Every future Cursor pass must state:**

1. **Current stage ID** (e.g. R4)
2. **Start condition** (what must already be done)
3. **Action** (scoped work for this pass)
4. **Stop condition** (validation / review gate)
5. **Next allowed stage**
6. **Protected systems untouched** (unless stage explicitly scopes them)

**No pass may jump to a downstream stage** unless the upstream stage’s stop condition is satisfied **or §6AL is intentionally updated** in a docs commit.

### R-stage satisfaction check rule (mandatory)

After each **R-stage** docs or code commit, run a **satisfaction check** before starting the next R-stage:

1. **Confirm** the stage stop gate is satisfied (see §6AL table + stage sections §6AM / §6AN / §6AO / etc.).
2. **Identify** missing docs, stale handoff lines, or conflicts with secondary anchors (e.g. `fielddive-flow-map.md`).
3. **Patch only if needed** — docs-only gate stages prefer compact section commits over rewriting §6AL.
4. **Commit after review** — do not stack the next R-stage on uncommitted gate docs.
5. **Only then proceed** to the next R-stage in §6AL order.

This rule exists to catch drift before it compounds across template, Builder, and lifecycle work.

### Recovery guardrails

- **Roofr evidence first** — Help Center, Academy, product pages before inventing flows.
- **Repo truth second** — handoff §6AK + §6AL + §6AM + §6AN + §6AO + §11.
- **Recovery order is mandatory** — see start/stop gate rule above.
- **Long-term correct architecture over easy reuse** — reshape misaligned components.
- **Old FieldDive surfaces** may be reused only if they fit Roofr-aligned architecture cleanly.
- **Do not preserve old setup-page identity** on Templates just because it exists.
- **Do not build downstream proposal/template/lifecycle features** before upstream IA/module ownership is documented (R1–R3).
- **Do not use `/admin/*` shelves** as primary module architecture.
- **Do not revive** `loadSaved` / `currentSaved` / `estimateStore` as the main proposal path.
- **Protected systems** remain frozen unless a stage explicitly scopes them (see §9, §11).

### Old FieldDive reuse / reshape / retire policy

| Surface | Policy |
|---------|--------|
| `/tools/roofing/saved` | **Reshape** as Job Board; isolate legacy status/estimate behavior (**R2**, **R8**) |
| `RoofingClient` monolith | **Isolate / retire later** — machinery OK; not UX architecture driver |
| `estimateStore` / saved estimates | **Isolate / retire later** — no new features (**R23**) |
| `/admin/customers` | **Isolate → migrate later** — not primary workflow nav (**R7**, **R23**) |
| `/admin/price-book` | **Retire later** — replaced by `/tools/roofing/catalog` |
| `TemplatesSetupClient` | **Reshape** → Template Workspace orchestrator (**R5**) |
| `TemplatesStarterHeroCard` | **Demote** to onboarding/setup zone only (**R5**) |
| `FieldDiveAppShell` | **Reshape** nav ownership (**R7**) |
| Legacy approval/payment APIs | **Reuse frozen** — bridge only at **R19–R20** |

### Dependency summary (hard rules)

- **R6** (template content) before **R12** (job editor)
- **R12** before **R17** (Preview)
- **R17** before **R18** (Send) before **R19** (Sign) before **R20** (Payment)
- **R20** before **R21** (production)
- **R16** (Proposals hub) does **not** block **R4–R6** (interim `/tools/roofing/templates` route)
- **R9** (Job Card create) after **R6** recommended; does not block **R4**

**R1 detail:** see **§6AM**. **R2 detail:** see **§6AN**. **R3 detail:** see **§6AO**.

---

## 6AM. R1 — GLOBAL IA / MODULE OWNERSHIP MAP

**Status:** **R1** complete (`b70cdd7`). **Depends on:** **R0** (`f1dba95`, §6AL). **Type:** **Docs only** — does **not** change routes, navigation code, or app behavior.

**Mandatory statements:**

- **R1 is docs-only.** No route migration. No `FieldDiveAppShell` code changes.
- **Nav code** remains **R7** (light label/grouping updates only).
- **Proposals hub code** remains **R16** (Draft/Sent/Won/Lost list + filters).
- **R2** (Jobs Board / `saved` identity) and **R3** (Proposals hub ownership spec) are separate docs gates — detail in **§6AN** (R2) and **§6AO** (R3); this section does not replace them.

### Flow-map cross-link

`docs/fielddive-flow-map.md` remains a secondary IA anchor. Where it conflicts with the recovery roadmap — e.g. framing `/tools/roofing/saved` as **Command Center** instead of **Job Board** — **§6AL / §6AM / §6AN supersede** the older terminology. **`/tools/roofing/saved` is Job Board** in the RoofrExact recovery model. **§6AN** documents Jobs Board / saved identity and legacy boundaries in detail.

### Current shell nav truth (`FieldDiveAppShell.tsx`)

Repo truth as of code checkpoint **`b3dd904`**. `activeNav` keys: `jobs` | `newJob` | `catalog` | `templates`.

| Label | Href | Nav key | Status | RoofrExact ownership | Interim rule | Future stage |
|-------|------|---------|--------|----------------------|--------------|--------------|
| **Job Board** | `/tools/roofing/saved` | `jobs` | **Live** | **Jobs / Job Board** — operational pipeline + DB job cards | Treat as **Job Board**, not Command Center or status-page architecture | **§6AN**; **R8 complete** (`1191ddd`) |
| **New Job** | `/tools/roofing` | `newJob` | **Live** (expandable group) | **Job intake** — entry to Job Packet / Job Card | Primary intake path; not Proposals module | **R7** nav grouping |
| ↳ Job Packet | `/tools/roofing?entry=packet` | sub `packet` | **Live** (default sub) | Job Packet intake | Keep lightweight prep flow | — |
| ↳ Job Card | `/tools/roofing?entry=job-card` (recovery href may use last `job=`) | sub `job-card` | **Live** | **Job Card** — measurement → catalog → template → proposal readiness | Main execution launchpad; **Create proposal / Open proposal** → Builder | **R9 complete** (`d0ba188`) |
| ↳ Instant Estimate | — | sub `instant` | **Soon** (no href) | Legacy estimator shortcut | **Do not expand**; not primary workflow | Isolate / retire (**R23**) |
| **Calendar** | `#` (placeholder) | — | **Placeholder** | Scheduling (future) | Not a final feature surface; no nav investment | Later / TBD |
| **Estimates** | `/tools/roofing` | — | **Live** (drift) | **Legacy label** — collides with New Job root | **Collision:** same href as New Job — **interim only**; does **not** define final Proposals architecture; **do not expand** saved-estimate nav | **R7** relabel/remove/hide; retire with legacy (**R23**) |
| **Invoices** | `#` (placeholder) | — | **Placeholder** | Invoices / billing (future) | Not a final feature surface | **R21** production spine |
| **Customers** | `/admin/customers` | — | **Live** (legacy shelf) | **Customers** data — company-scoped admin | **Legacy `/admin/*` shelf** — not primary workflow nav; do not wire as main module | **R7** migrate off primary nav; **R23** cleanup |
| **Price Book (Legacy)** | `/admin/price-book` | — | **Live** (legacy) | Retired concept — replaced by **Catalog** | Label already marks legacy; do not expand | **Retire** (**R23**); catalog is truth |
| **Catalog** | `/tools/roofing/catalog` | `catalog` | **Live** | **Catalog** — item definitions, pricing, quantity drivers | Canonical FieldDive catalog route | — |
| **Templates** | `/tools/roofing/templates` | `templates` | **Live** | **Proposal Templates** — reusable template install + future Template Workspace | **Interim durable route** for template setup/content until Proposals hub (**R16**); **not** "Soon" | **R5–R6** workspace; hub at **R16** |
| **AI Conductor** | `/tools/roofing/ai` | — | **Live** | AI / automation assist (future module) | Secondary; not proposal spine | **R22** automations alignment |
| **Reports** | `#` (placeholder) | — | **Placeholder** | Reporting / measurement reports (future) | Not a final feature surface | Later |
| **Settings / Company** | Identity, branding, license, notifications, profitability **type** | Terms/Warranty/Scope body prose | `/tools/settings`, `/tools/settings/pricing` | Same | **R11 + R11c complete** (§6AR + §6AS); **R15** cover/display deferred |

**Documented drift (R1):**

- **Estimates** and **New Job** both resolve to `/tools/roofing` — interim collision; must not be read as final Proposals module placement.
- **Customers** and **Price Book (Legacy)** use **`/admin/*`** — data shelves, not final primary modules.
- **Templates** is **live** at `/tools/roofing/templates` — interim Template Workspace route until **R16**.
- **Calendar / Invoices / Reports** `#` placeholders are not final surfaces.
- **`/tools/roofing/saved`** = **Job Board** (not Command Center per older flow-map framing).

### Target RoofrExact module ownership

| Module | Owns | Must not own | Current route (if any) | Future target route | Stage |
|--------|------|--------------|------------------------|---------------------|-------|
| **Jobs / Job Board** | Operational pipeline, stage columns, DB job card entry, board → Job Card navigation | Proposal editing, template prose, pricing math internals, proposal lifecycle list | `/tools/roofing/saved` | Same (reshape in place) | **§6AN**; **R8** |
| **Job Card** | Per-job readiness: measurement, catalog, template, proposal launch gates | Master template editing, company Terms defaults | `/tools/roofing?entry=job-card` + `?job=` | Same | **R9** |
| **Measurements / Reports** | Roof measurement truth, quantity drivers | Catalog line definitions, proposal lifecycle | Job Card + `measurement_records` | Job Card + measurement surfaces | Done (data); UI polish later |
| **Catalog** | Reusable line items, unit cost/price, quantity_source, install/readiness | Template package options, proposal snapshots | `/tools/roofing/catalog` | Same | Done |
| **Proposals hub** | Proposal list, Draft/Sent/Won/Lost filters, hub → Templates / Builder links | Template content editing, Builder document canvas | **Missing** (no hub route) | `/tools/roofing/proposals` (planned) | **R16** code; **§6AO** (R3) |
| **Proposal Templates** | Reusable packages, options, sections, template prose defaults, install | Job-specific `proposal_pages`, lifecycle send/sign | `/tools/roofing/templates` (interim) | Under Proposals hub long-term; **keep interim route until R16** | **R4–R6**, **R10** (§6AQ) |
| **Proposal Builder** | Job-specific proposal editing, Estimate + customer pages, package selection | Master template rows, company Terms store | `/tools/roofing/proposals/builder?job=&proposal=` | Same | **R12–R15**, **R17–R20** |
| **Settings / Company** | Identity, branding, license, notifications, profitability **type** | Terms/Warranty/Scope body prose | `/tools/settings`, `/tools/settings/pricing` | Same | **R11 + R11c complete** (§6AR + §6AS); **R15** cover/display deferred |
| **Customers** | Company-scoped customer records | Primary workflow nav driver | `/admin/customers` (legacy shelf) | Future FieldDive-native route | **R7**, **R23** |
| **Invoices / Payments** | Invoicing, deposits, payment truth (when scoped) | Draft proposal editing | Placeholder nav; protected APIs exist | Future module routes | **R20–R21** |
| **Production / Work Orders / Material Orders** | Post-signature execution | Proposal authoring | Not built | Future routes | **R21** |
| **Automations** | Follow-ups, stage ↔ status hooks | Core proposal spine | `/tools/roofing/ai` (partial) | TBD | **R22** |
| **Legacy / admin data shelves** | Historical data access, migration sources | **Final module architecture** | `/admin/*`, `estimateStore`, `RoofingClient` monolith | Isolate → retire (**R23**) | **R23** |

**Ownership rules (locked):**

- **Jobs** own operational pipeline and Job Card entry — not proposal document editing.
- **Catalog** owns item definitions and price book truth — templates reference catalog items only.
- **Proposal Templates** own reusable proposal content and package/template setup — not job-specific pages.
- **Proposals hub** (later) owns proposal list/lifecycle — **R16**; not built in R1.
- **Builder** owns job-specific proposal editing — not master template rows.
- **Settings** owns company identity/branding/pricing policy — **not** Terms/Warranty body prose (§6AK).
- **`/admin/*` shelves** do not drive final module architecture.

### Interim navigation rules (until **R7** nav code and **R16** Proposals hub)

1. **Keep** `/tools/roofing/templates` as the **interim Template Workspace** route — live today; reshape at **R5–R6**, not retire until **R16**.
2. **Do not create** `/tools/roofing/proposals/templates` (or similar nested URLs) before the Proposals hub exists.
3. **Do not migrate** the Templates route to match Roofr URL structure prematurely — hub migration is **R16**.
4. **Future** `/tools/roofing/proposals` hub (**R16**) should link to Templates and Builder — spec in **§6AO**.
5. **Before R16**, proposal access remains through **Job Card → Builder** (`?job=` + `?proposal=`) and the **Templates** route — no primary nav Proposals module yet.
6. **Do not point** primary workflow nav to **`/admin/*`** — Customers and Price Book remain legacy shelves until **R7**/**R23**.
7. **Do not expand** legacy **Estimates** nav or saved-estimate workflow — collision with New Job is interim only.
8. **Do not enable** Preview / Send / Sign / Payment from nav or module-placement changes — lifecycle is **R17–R20**.

---

## 6AN. R2 — JOBS BOARD / SAVED IDENTITY

**Status:** **R2** complete (`2e1c36b`). **Depends on:** **R0** (`f1dba95`, §6AL); complements **R1** (`b70cdd7`, §6AM). **Type:** **Docs only** — does **not** change route behavior, board UI code, or protected systems.

**Mandatory statements:**

- **R2 is docs-only.** No route migration. **`SavedClient` / board UI code** updated at **R8** (`1191ddd`).
- **Proposals hub / proposal document lifecycle list** remains **R16** — not Job Board.

### Flow-map cross-link

`docs/fielddive-flow-map.md` may still frame `/tools/roofing/saved` as **Command Center** or status-lane architecture. **§6AL / §6AM / §6AN supersede** that terminology where it conflicts. **`/tools/roofing/saved` is Job Board** in the recovery roadmap. Older Command Center / status-page framing is **legacy terminology** until `fielddive-flow-map.md` is separately updated — **do not edit flow-map in R2**.

### Route / file truth (`/tools/roofing/saved`)

Repo truth as of code checkpoint **`b3dd904`**.

| Item | Truth |
|------|-------|
| **Route** | `/tools/roofing/saved` |
| **Current identity** | **Job Board** — operational jobs pipeline + Job Card entry |
| **Not** | Command Center; standalone status-page architecture; final **Proposals lifecycle hub** (that is **R16**) |
| **Page route** | `app/tools/roofing/saved/page.tsx` — Suspense fallback: “Loading Jobs Board…” |
| **Page title (UI)** | `JobsBoardHeader.tsx` — **“Job Board”** |
| **Main orchestrator** | `app/tools/roofing/saved/SavedClient.tsx` |
| **Board utilities** | `jobsBoardUtils.ts`, `components/JobsBoard*.tsx` |
| **DB adapter** | `app/lib/jobBoardAdapter.ts` — maps `public.jobs` → board rows; `buildDbJobCardHref` → `?entry=job-card&job=` |
| **Primary board** | **DB jobs** (`public.jobs`) render in primary kanban columns (Phase B, §6AD) |
| **Legacy section** | **Legacy saved estimates** isolated below in labeled section **“Legacy saved estimates”** — secondary; no new features |
| **Hybrid adapter** | DB jobs are mapped into **legacy lane structures** (`RoofingEstimate`-shaped rows, `jobsBoardUtils` column keys) for interim UI reuse — **not** final architecture |
| **Legacy-only metrics** | **Command Deck**, revenue summaries, funnel metrics in `SavedClient` apply to **legacy estimates only** — must **not** drive future module architecture |

**Identity rules (locked):**

- `/tools/roofing/saved` is the **operational Job Board route** for jobs and Job Card entry.
- It is **not** the final home for proposal document lifecycle (Draft/Sent/Won/Lost lists) — **R16 Proposals hub** owns that later.
- Lifecycle-like column labels on the board today (e.g. “Proposal Sent”, “Proposal Signed”) are **interim lane mapping** via `jobBoardAdapter` + legacy `jobsBoardUtils` — **not** final Proposals module ownership.

### DB-primary + legacy-secondary partition

| Layer | Role | Interim rule |
|-------|------|--------------|
| **Primary kanban** | DB `jobs` via `jobBoardAdapter` | Authoritative for **new work**; open → `?entry=job-card&job=<uuid>` |
| **Legacy section** | `estimateStore` saved estimates via `partitionLegacyEstimatesForBoardSection` | **Isolated / secondary**; preserved not deleted; linked legacy may open `job=` when `jobId` exists |
| **Session keys** | `loadSaved`, `currentSaved`, `currentLoadedSavedId` | Legacy-only — **not** main proposal workflow (§6AD) |
| **No backfill** | Old saved estimates | **Not** auto-converted to DB jobs/proposals |

Full route and legacy rules: **§6AD** §§2–4. R2 adds **identity framing**; it does not duplicate the full §6AD smoke checklist.

### Job Board vs Proposals lifecycle boundary

| Concern | Owner (now / later) |
|---------|---------------------|
| Operational job pipeline, stage columns, board → Job Card | **Job Board** (`/tools/roofing/saved`) |
| Job Card readiness, **+ Proposal** → Builder | **Job Card** + **Builder** |
| Proposal document lifecycle list (Draft / Sent / Won / Lost) | **R16 Proposals hub** — **not** Job Board |
| Template reusable content | `/tools/roofing/templates` (interim until **R16**) |
| Preview / Send / Sign / Payment | **R17–R20** — remain disabled |

### Interim R2 rules (until **R16** Proposals hub)

**R8** light Jobs Board identity code **complete** (`1191ddd`). Remaining interim rules:

1. **`/tools/roofing/saved` remains Job Board** — no route migration.
2. **DB jobs are primary records** on the board; legacy saved estimates stay **isolated/secondary**.
3. **Do not add new product features** to the legacy saved-estimate section.
4. **Job Board owns** operational job pipeline and **Job Card entry** — not proposal document editing.
5. **Proposal document lifecycle list ownership** belongs to **R16 Proposals hub** later.
6. **Existing lifecycle-like column labels** are interim mapping — not final module ownership.
7. **Do not polish status lanes** as standalone product architecture (defer to **R16** / lifecycle spine).
8. **Do not expand** `estimateStore`, `loadSaved`, or `currentSaved` as the primary proposal workflow.
9. **Do not touch** pricing, proposal snapshots, stale refresh, approval, payment, or Preview/Send/Sign locks from Job Board work.
10. **Protected systems** remain frozen unless an R-stage explicitly scopes them (§9, §11).

### R8 future code scope (light identity only)

**R8 may later:**

- Light copy / header cleanup (“Job Board”, section headings)
- Section labeling — clarify **primary DB jobs** vs **legacy saved estimates**
- Reduce stray **Command Center** wording in board UI copy
- Keep routes stable (`/tools/roofing/saved` unchanged)

**R8 must not:**

- Big board redesign or kanban re-architecture
- Route migration
- Build the **Proposals lifecycle module** (that is **R16**)
- Status-lane polish as end-state product architecture
- Pricing / proposal record / snapshot / stale-refresh changes
- Protected system changes (`estimateStore` expansion, send/PDF, approval, payment)
- Legacy `estimateStore` feature expansion

**R2 detail:** see **§6AN**. **R3** Proposals hub ownership — **§6AO**.

---

## 6AO. R3 — PROPOSALS HUB OWNERSHIP

**Status:** **R3** complete (`5927ab5`). **Depends on:** **R1** (`b70cdd7`, §6AM); complements **R2** (`2e1c36b`, §6AN). **Type:** **Docs only** — does **not** create the Proposals hub route, change navigation code, migrate Templates, or enable lifecycle actions.

**Mandatory statements:**

- **R3 is docs-only.** No `/tools/roofing/proposals` hub route. No Templates migration. No Preview / Send / Sign / Payment.
- **Proposals hub code** remains **R16** only.
- **Template Workspace / editor** remains on interim `/tools/roofing/templates` through **R4–R6**.

### Current proposal route truth

Repo truth as of code checkpoint **`b3dd904`**.

| Route / surface | Status | Identity | Interim rule | Future stage |
|-----------------|--------|----------|--------------|--------------|
| `/tools/roofing/proposals` | **Not present** | Future **Proposals hub** — list/dashboard/lifecycle | **Do not create** before **R16** | **R16** code |
| `/tools/roofing/proposals/builder?job=&proposal=` | **Live** | Contextual **Proposal Builder** — job-specific document editing | May exist **before** hub; opens by `job=` + `proposal=` | **R12–R15**, **R17–R20** |
| `/tools/roofing/templates` | **Live** | Interim **Template Workspace** — install, readiness, future content editor | **Keep** as durable interim route; **do not migrate** under Proposals before **R16** | **R4–R6** workspace; hub link at **R16** |
| `/tools/roofing/proposals/templates` | **Must not exist** | Orphan nested Templates URL | **Do not create** before hub exists | — |
| Job Card **Proposals** tab | **Live** | Per-job proposal entry — readiness, template link, **Create proposal / Open proposal** → Builder | **R9 satisfied** + pre-R10 P1 truth (`d0ba188`); **does not require** R16 hub | — |
| `/tools/roofing/saved` | **Live** | **Job Board** — operational job pipeline | **Not** proposal lifecycle hub (§6AN) | **R8 complete** (`1191ddd`) |

**Key truths:**

- The **Builder** route can exist before the hub because it is **contextual** (one job + one proposal).
- **Templates** can remain at `/tools/roofing/templates` before the hub.
- The future **hub** is a **list/dashboard/lifecycle owner** — **not** the only way to open a proposal (Job Card **+ Proposal** remains valid).

**Key files (inspect only):** `app/tools/roofing/proposals/builder/page.tsx`, `app/tools/roofing/templates/page.tsx`, `app/tools/roofing/jobCard/JobCardProposalsSetupLinks.tsx`, scoped Proposals tab in `RoofingClient.tsx` (`resolveOrCreateProposalDraftEntry`).

### Future `/tools/roofing/proposals` hub ownership (R16)

**Hub owns later:**

- Proposal **list / dashboard**
- **Draft / Sent / Won / Lost** lifecycle views
- Proposal **search / filter / list** surfaces
- Links to open **Builder** (`?job=` + `?proposal=`)
- Links to **Proposal Templates** (interim `/tools/roofing/templates` until route retirement at R16)
- Proposal **document lifecycle overview**
- Proposal **status visibility** across jobs

**Hub must not own:**

- **Job Board** operational job pipeline (§6AN)
- **Job Card** core job workspace
- **Master template editing** — interim at `/tools/roofing/templates` (**R5–R6** before hub)
- **Job-specific page editing** — **R12** (`updateProposalPage`)
- **Preview / Present** — **R17**
- **Send / PDF** — **R18**
- **Sign / approval** — **R19**
- **Payment / deposits** — **R20**
- Legacy **saved-estimate** / `loadSaved` / `currentSaved` workflow
- **Pricing math / snapshots / stale refresh** protected systems

### Interim proposals posture (before **R16**)

1. **Do not create** `/tools/roofing/proposals` hub before **R16**.
2. **Do not migrate** Templates under `/tools/roofing/proposals/*` before **R16**.
3. **Keep** `/tools/roofing/templates` as the interim durable **Template Workspace** route.
4. **Keep** Builder contextual at `/tools/roofing/proposals/builder?job=&proposal=`.
5. **Job Card** may create/open proposals before the hub — **R9 complete** (not R16).
6. **R9** provides **Create proposal / Open proposal → measurement → template → create/reuse draft → open Builder** without the full hub.
7. **R16** later provides the **list/dashboard/lifecycle module**.
8. **Job Board** remains operational pipeline; **Proposals hub** later owns proposal **document lifecycle list** (not Job Board lanes).
9. **Do not enable** Preview / Send / Sign / Payment from R3 / R4 / R5 / R6 / R9 work.
10. **Do not route-churn** to mimic Roofr URL nesting before the hub exists.

### R3 relationship to **R4–R6** (Template editor)

| Stage | Scope | R3 guardrail |
|-------|-------|--------------|
| **R4** | `buildTemplateContentEditorViewModel` + tests (lib-only) | May proceed after **R0–R3** docs gates; **no hub** |
| **R5** | Template Workspace shell on **`/tools/roofing/templates`** | **Must not** build Proposals hub; **must not** move Templates route |
| **R6** | Content editor + per-section save on **master templates** | **Must not** create lifecycle list/dashboard; **must not** enable Preview/Send/Sign/Payment |

**R16 does not block R4–R6** (§6AL dependency summary) — interim Templates route stays until hub ships.

### R3 relationship to **R9** and **R16**

| Stage | Role |
|-------|------|
| **R9** | **Job Card + Proposal create flow** — **Create proposal / Open proposal** → select measurement → select template → create/reuse draft → open Builder (`?job=` + `?proposal=`) |
| **R9** | **Satisfied** by `1915b2d` + pre-R10 P1 truth alignment (`d0ba188`, §6AP); **does not require** R16 Proposals hub |
| **R16** | **Proposals hub foundation** — list, filters, Draft/Sent/Won/Lost surfaces |
| **R16** | Adds dashboard/lifecycle **after** Job Card create/open is stable; depends on **R7** + **R9** per §6AL |

**R3 detail:** committed at `5927ab5`.

---

## 6AP. PRE-R10 AUDIT + P1 JOB CARD BUGFIX

**Status:** **Pre-R10 audit complete**; **P1 bugfix complete** (`d0ba188`). **Depends on:** **R9** satisfied. **Historical next (completed):** R10 full-stage satisfaction/scope check → R10a/b/c implementation (`bc42b1e`–`b3dd904`, §6AQ).

### Complete bug/issue audit (before R10)

- **No P0 issues** — DB-first spine structurally sound; duplicate draft creation prevented by `resolveOrCreateProposalDraftEntry` + tests.
- **138/138** audit tests passed before bugfix; **TypeScript** only known `RoofingClientV2.tsx` errors.
- **R9** create/open path **already satisfied** by existing repo (`1915b2d`); audit found **targeted P1** Job Card proposal truth UI/gating gaps only.

### Pre-R10 P1 fixes (`d0ba188`)

| Fix | Detail |
|-----|--------|
| Header CTA gates | `isProposalHeaderLaunchEnabled` aligns header with checklist — includes **pricing policy** gate |
| Post-create truth | `refreshHydratedJobRecord` after successful create/open before Builder navigation |
| Proposals tab UI | **Draft proposal connected** when `active_proposal_id` exists; no stale “No proposals created yet” |
| Header labels | **Create proposal** vs **Open proposal** from checklist state |
| Setup copy | Removed stale “Proposal Builder on this job comes later” (`JobCardProposalsSetupLinks.tsx`) |

**Validation:** **141/141** tests after bugfix. **No** Proposals hub/list/lifecycle module added. **No** Templates/Builder/Nav/Jobs Board/pricing/protected systems changed.

### R9 satisfied — current behavior

- Job Card **Proposals** tab uses **create/open draft** flow via `resolveOrCreateProposalDraftEntry`.
- **Existing draft** opens without duplicate; **new draft** creates DB proposal and opens Builder with `job` + `proposal` params.
- **Proposals hub** remains deferred to **R16**.
- **Preview / Send / Sign / Payment** remain locked.

### R10 guardrail (historical — satisfied by §6AQ)

**R10 full-stage satisfaction/scope check** completed; **R10a/b/c** implemented and audited. **Next gate:** **R11** (§6AQ).

**Protected systems remain frozen:** pricing math, proposal totals, quantity resolver, snapshot pricing trust, stale banner / `refreshDraftPricing`, approval/status/payment, Preview/Send/Sign/Payment locks, SQL/migrations/packages, legacy routes unless scoped.

---

## 6AQ. R10 COMPLETION — TEMPLATE STRUCTURE + ESTIMATE SETTINGS

**Status:** **R10 complete** (`bc42b1e`–`b3dd904`). **R10 completion audit passed.** **Depends on:** **R6**. **Next (historical):** R11 — **complete** (`0146dac`–`139e8a3`, §6AR); **R11c** — **complete** (`29722a0`, §6AS).

### R10 implementation commits

| Commit | Pass | Scope |
|--------|------|-------|
| `bc42b1e` | **R10a** | Pure structure/settings helpers + tests (`proposalTemplateStructureEditorView`, `proposalTemplateStructureMutations`, `proposalTemplateEstimateSettings`) |
| `e33e659` | **R10b** | Templates Workspace Structure & estimate settings UI (`TemplatesStructureSettingsShell`, `TemplatesSetupClient` wiring) |
| `b3dd904` | **R10c** | Template estimate settings → draft `proposal_pages.settings_json` (`mapTemplateSectionsToProposalPages`, `proposalRecordStore` template pass-through) |

### R10 completion audit (at `b3dd904`)

- **R10 + safety tests:** **217/217** pass
- **TypeScript:** only known `RoofingClientV2.tsx` errors (6)
- **Working tree:** clean at audit
- **No P0/P1 issues**
- **Optional read-only DB smoke** for `settings_json` on new drafts **not performed**; unit coverage covers defaults, template metadata, per-option overrides, non-estimate pages `{}`, and input immutability

### R10 behavior now true (`/tools/roofing/templates`)

- **Structure view** — Standard / Enhanced / Premium separated; sections ordered by `sort_order`
- **Add section** — allowed kinds only: `text`, `terms`, `warranty`, `image` (`createProposalTemplateSection`)
- **Reorder** — within same option only via `sort_order` patches (`planReorderSections` + `updateProposalTemplateSection`)
- **Remove/delete** — **intentionally blocked** until safe store delete semantics approved (`planRemoveSection`; UI disabled with reason)
- **Estimate display settings** (`ProposalPageSettings`, **not** pricing policy):
  - `show_line_prices`
  - `show_option_totals`
  - `show_section_headings`
- **Storage:** `template.metadata.estimate_page_settings` + per-option `line_items` section metadata
- **New drafts:** resolved settings on estimate page `settings_json` at instantiate; non-estimate pages keep `{}`
- **Existing job `proposal_pages`:** not retroactively changed
- **R6 content editor:** `body_markdown` per-section save **unchanged**

### R10 deferred / boundaries (preserve)

| Item | Status |
|------|--------|
| Section delete/remove | **Deferred** — no `deleteProposalTemplateSection`; remove buttons blocked by design |
| Builder rendering of `settings_json` toggles | **Deferred** — **R15** (Builder layout + settings drawer) or later Builder pass |
| `refreshDraftPricing` syncing `settings_json` | **Not implemented** — existing drafts unchanged unless product later scopes sync |
| Job-specific `proposal_pages` editing | **R12** |
| Proposals hub | **R16** |
| Preview / Send / Sign / Payment | **R17+** |
| Pricing policy / margins | **`/tools/settings/pricing`** — not template estimate display settings |

### R11 guardrail (historical — satisfied by §6AR)

**R11 full-stage satisfaction/scope check** completed; **R11a/b/c** implemented; smoke + post-R11/post-R11c audits passed. **Next gate:** explicit-direction **R12** or **R15** scoping (§6AS).

**Protected systems remain frozen:** pricing math, proposal totals, quantity resolver, snapshot builder pricing trust, stale banner / `refreshDraftPricing`, approval/status/payment, Preview/Send/Sign/Payment locks, SQL/migrations/packages, legacy routes unless scoped.

---

## 6AR. R11 COMPLETION — COMPANY BRANDING SETTINGS (R11a + R11b)

**Status:** **R11 complete** (`0146dac`–`139e8a3`). **R11b manual smoke passed.** **Post-R11 full-surface product safety audit passed** — no P0/P1 blockers. **Depends on:** **R1** (Settings module ownership), **R10** (Templates boundaries). **Next (historical):** **R11c** — **complete** (`29722a0`, §6AS).

### R11 implementation commits

| Commit | Pass | Scope |
|--------|------|-------|
| `0146dac` | **R11a** | Pure company branding profile helpers + tests (`companyBrandingProfile.ts`); Option B split: core on `companies`, extended on `company_branding_profiles`; **no UI** |
| `097d25e` | **R11b store** | Migration SQL `20260617_008_create_company_branding_profiles.sql` + `companyBrandingProfileStore.ts` (read/upsert extended fields only) |
| `139e8a3` | **R11b UI** | `/tools/settings` FieldDive Settings workspace — server auth gate + shell; client single draft/save; persistence DB-truth load/save/reload; utils + regression tests |

**Manual Supabase migration:** `company_branding_profiles` migration was **applied successfully** in the target environment before/at R11b workspace smoke (not applied by app code).

### R11a summary

- Added **company branding profile foundation** — normalization, split-save helpers, readiness view-model, `mapCompanyBrandingToProposalContextEcho` (pure; not yet wired to Builder).
- **`public.companies`** remains **core company identity** (name, contact, license, logo, notifications).
- **`public.company_branding_profiles`** owns **extended proposal/customer-facing branding** (address, website, colors, CLN-on-cover).
- **No UI wiring** in R11a — helpers/tests only.

### R11b summary — Settings workspace (`/tools/settings`)

- **Clean new FieldDive Settings logic** — not mixed old/new page logic. Prior monolithic settings page replaced.
- **FieldDive shell/workspace style** — `FieldDiveAppShell` wrapper; slate workspace zones; readiness card + pricing link card.
- **Ownership:**
  - **Server `page.tsx`** — auth gate (`ensureUserIdentity`, `getUserCompanyId`), shell render only; **no form state**.
  - **`SettingsCompanyBrandingClient.tsx`** — sole owner of draft state, load/save handlers, auth retry.
  - **`settingsCompanyBrandingPersistence.ts`** — single load/save/reload orchestration path.
  - **`settingsCompanyBrandingUtils.ts`** — pure gates, split helpers, `resolveDraftAfterSave`, regressive replacement guards.
- **DB-truth load** — `loadCompanyProfileResultFromSupabase({ dbTruthOnly: true })`; Settings **never** treats localStorage cache fallback as display truth.
- **Split save** — core → `companies` via `saveCompanyProfileToSupabase`; extended → `company_branding_profiles` via `upsertCompanyBrandingProfile`; post-save reload confirms DB truth before optional draft replace.
- **Bugs fixed during R11b:**
  - **`mergeCompanyBrandingProfile`** — branding-row mapper produced empty core defaults; spreading them wiped real `companies` fields (address-only symptom). **Fix:** only **deferred branding fields** may be spread from branding row.
  - **`rowToCompanyBrandingProfileFields`** — returns **explicit deferred fields only** at runtime.
  - **Save-clears-form class** — `resolveDraftAfterSave` + `isRegressiveDraftReplacement` refuse unsafe reload replacement; auth listener skips load while saving; save reads latest draft via **`draftRef`**.
- **Manual smoke passed:** full profile load (not address-only); typing preserves partials; Save does not clear form; hard refresh persists all values.

### Source-of-truth map (R11b lock)

| Domain | Table / store | Fields / notes |
|--------|---------------|----------------|
| **Core company identity** | `public.companies` | `name`, `owner_email`, `phone`, `license`, `logo_url`, `notifications_email`, `owner_user_id` |
| **Extended branding** | `public.company_branding_profiles` | `address`, `website`, `brand_primary_color`, `brand_secondary_color`, `show_license_on_cover`, `metadata` (flat extensions only) |
| **Pricing policy** | `public.company_pricing_policies` | Profitability/tax/rounding — **`/tools/settings/pricing` only** |
| **Template content/structure** | `proposal_template_*` | Reusable packages, sections, `body_markdown`, estimate display settings |
| **Job proposal pages** | `proposal_pages` | Job-specific pages + `settings_json` |
| **Proposal snapshots** | Frozen proposal rows | Customer/pricing document truth at instantiate/refresh |

**Settings does NOT write:** Templates, Builder, `proposal_pages`, snapshots, pricing policy, approval, payment, send, or PDF systems.

**No duplicated core identity** in `company_branding_profiles` rows (store + upsert payload enforce).

### R11b smoke and audit results (at `139e8a3`)

**Manual smoke passed:**

- Hard refresh loads **full profile** (not address-only)
- Typing works; partial website/colors preserved while editing
- Save does not clear form
- Hard refresh after save persists all values
- Settings end-to-end working

**Post-R11 full-surface product safety audit:** **passed** — no P0/P1; protected systems unchanged.

**Tests:**

| Suite | Result |
|-------|--------|
| Audit total (core + pricing + template) | **351/351** pass |
| R11b core safety suite | **228/228** pass |
| Pricing tests | **88/88** pass |
| Template structure/content tests | **35/35** pass |

**TypeScript:** only **6** known pre-existing `RoofingClientV2.tsx` errors.

**Working tree:** clean after `139e8a3`.

### Bugs found and lessons learned (guardrails)

| Lesson | Detail |
|--------|--------|
| **No mixed old/new FieldDive pages** | Do not migrate old logic into new surfaces unless explicitly approved. Build clean pages with one owner each for server/client/persistence. |
| **Tests ≠ user flows** | Passing helper tests is not enough; run **full-surface product safety audits** before stage-close. |
| **Address-only root cause** | `rowToCompanyBrandingProfileFields` / normalize produced full profile with empty core defaults → `mergeCompanyBrandingProfile` spread wiped `companies` fields. **Only deferred branding fields** may merge from branding row. |
| **Save-clears-form class** | Never replace visible draft from sparse/unsafe reload; never use cache fallback as Settings DB truth; never normalize destructive fields on keystroke (normalize on save only). |
| **No service-role scripts in Cursor** | Do not use Supabase service-role terminal scripts for routine audit/smoke. |

### Known P2/P3 debt (non-blocking before R11c)

| Item | Priority | Notes |
|------|----------|-------|
| Legacy `RoofingClient` / PDF / email / packet may read **localStorage core only** | P2 | May not consume `context_echo` branding yet |
| Builder **does not render** `proposalCompanyContext` / branded cover yet | P2 | By design — **R15** or display stage; see §6AS visual-check guardrail |
| Pricing Settings page **visually differs** from new branding Settings workspace | P2 | Pre-existing dark standalone UI at `/tools/settings/pricing` |
| Settings route has **neutral sidebar** (no `activeNav` highlight) | P3 | `FieldDiveAppShell` without active module key |
| `saveCompanyProfileToSupabase` could verify update row count | P3 | Currently checks `error` only |
| `RoofingClientV2.tsx` TypeScript errors (6) | P3 | Pre-existing |

**These are not R11b blockers** — tracked in **§6AS** post-R11c carryover.

### R11c guardrail (historical — satisfied by §6AS)

**R11c scoping + stamping** completed at `29722a0`. **Next:** explicit-direction scoping only — **R12** customer echo **or** **R15** branded cover/display (§6AS).

**Do not:** start R12/R15 code without scoped audit; touch pricing math; reopen R11b Settings save path unless bugfix-scoped; create Proposals hub (R16).

---

## 6AS. R11c COMPLETION — COMPANY BRANDING CONTEXT_ECHO STAMPING

**Status:** **R11c complete** (`29722a0`). **Post-R11c full-surface product safety audit passed** — no P0/P1 blockers. **Depends on:** **R11b** (Settings + `company_branding_profiles` store). **Next:** **Do not auto-start R11d / R12 / R15** — choose scoping pass only after explicit direction.

### R11c implementation commit

| Commit | Pass | Scope |
|--------|------|-------|
| `29722a0` | **R11c** | Stamp company core + extended branding into `proposal_versions.context_echo` at **new draft creation only**; read-only `proposalCompanyContext` on adapter DTO |

**R11c changed only scoped lib/test files (no SQL/docs/packages):**

- `app/lib/proposalVersionTypes.ts`
- `app/lib/companyBrandingProfile.ts` + `.test.ts`
- `app/lib/proposalSnapshotBuilder.ts` + `.test.ts`
- `app/lib/proposalRecordStore.ts` + `.test.ts`
- `app/lib/proposalDraftGraphAdapter.ts` + `.test.ts`

**Not in R11c:** Builder cover UI; customer preview/PDF/send/sign/payment; branding refresh action; backfill of old drafts; SQL/migrations; package changes.

### R11c summary

- **`createDraftProposal`** loads **DB-truth** company core (`companies`) + extended branding (`company_branding_profiles`) via injectable `loadProposalCompanyContext` — **no localStorage/cache**.
- Merges with **R11b-safe** `mergeCompanyBrandingProfile` (deferred-fields-only spread).
- Stamps company slice into **`proposal_versions.context_echo`** before draft version insert.
- **`address_formatted`** remains **job/site address** from `jobs`; **`company_address`** is company/business address — distinct fields.
- **Missing branding row:** core fields stamped; extended fields null/empty — draft creation continues.
- **Branding read error:** core-only stamp; draft creation continues (fail-soft).
- **`refreshDraftPricing`:** merge-only update of measurement fields; **preserves** all company branding context fields (regression tested).
- **`proposalDraftGraphAdapter`** exposes read-only **`proposalCompanyContext`** from stamped `context_echo` — for future Builder/display work only; **not consumed in Builder UI yet**.
- **Visible branded cover is NOT expected in R11c** — cover page remains placeholder; deferred to **R15** or branded display stage.

### `context_echo` company branding fields

**Retained (pre-R11c):**

| Field | Source |
|-------|--------|
| `company_name` | `companies.name` |
| `company_logo_url` | `companies.logo_url` |

**New optional fields (stamped at create):**

| Field | Source |
|-------|--------|
| `company_phone` | `companies.phone` |
| `company_license` | `companies.license` (stored even when `show_license_on_cover` false) |
| `company_address` | `company_branding_profiles.address` |
| `company_website` | `company_branding_profiles.website` |
| `brand_primary_color` | `company_branding_profiles.brand_primary_color` |
| `brand_secondary_color` | `company_branding_profiles.brand_secondary_color` |
| `show_license_on_cover` | `company_branding_profiles.show_license_on_cover` |

**Exclusions (not stamped into branding slice):**

- `notificationsEmail` — Settings/internal routing only
- Owner `email` (`owner_email`) — not customer document identity
- Pricing policy fields — `policy_echo` / line snapshots only
- Template fields — `proposal_template_*` / `proposal_pages` only

### Source-of-truth rules (R11c lock)

| Domain | Live truth | Proposal draft truth |
|--------|------------|----------------------|
| Core company identity | `public.companies` | `context_echo` at draft create |
| Extended branding | `public.company_branding_profiles` | `context_echo` at draft create |
| Job site address | `jobs.address_formatted` | `context_echo.address_formatted` |
| Company business address | branding row | `context_echo.company_address` |
| Pricing policy | `company_pricing_policies` | `policy_echo` + snapshots |
| Templates | `proposal_template_*` | `proposal_pages` copy-on-create |

**Builder persisted path** must read stamped **`context_echo`** (via adapter DTO), **not** live Settings or localStorage.

**Pre-R11c drafts** (created before `29722a0`) may have **null/missing** branding keys — **no backfill** was done; adapter tolerates missing keys.

**Settings changes after draft create** do **not** auto-update existing draft echo — branding refresh action deferred.

### Post-R11c smoke and audit results (at `29722a0`)

**Post-R11c full-surface product safety audit:** **passed** — no P0/P1; protected systems unchanged.

**Tests:**

| Suite | Result |
|-------|--------|
| Safety suite (11 files) | **253/253** pass |
| Pricing tests | **88/88** pass |
| Template tests | **92/92** pass |
| **Audit total** | **433/433** pass |

**TypeScript:** only **6** known pre-existing `RoofingClientV2.tsx` errors.

**Browser/visual (manual):**

- Settings, Catalog, Builder loaded
- Preview / Send / Sign / Payment remained disabled
- Empty website/colors/toggle in echo are **expected** when user intentionally left Settings fields blank
- **No visible branded cover** — deferred, **not a defect**

**Working tree:** clean after `29722a0`.

### Known P2/P3 carryover (post-R11c)

| Item | Priority | Notes |
|------|----------|-------|
| Legacy `RoofingClient` / packet may use **localStorage** for legacy surfaces | P2 | Not `context_echo` path |
| **Old drafts** before `29722a0` lack stamped branding | P2 | No backfill by design |
| **Customer echo** (`customer_name`, etc.) may still be null at create | P2 | **Addressed in R12** (`31059e3`, §6AT) for new drafts; pre-R12 drafts unchanged |
| Builder does **not render** `proposalCompanyContext` yet | P2 | **R15** branded cover/display |
| **Branding staleness / refresh action** for existing drafts | P2 | Deferred |
| Pricing Settings page **visual mismatch** vs new Settings workspace | P2 | Pre-R11b debt |
| Settings route **neutral sidebar** (no `activeNav`) | P3 | Pre-existing |
| `RoofingClientV2.tsx` TypeScript errors (6) | P3 | Pre-existing |

### Branded cover visual-check guardrail

When **branded cover/display** work begins (**R15** or dedicated display stage):

- **Must include explicit visual check** of the actual cover/customer-facing branding surface in browser.
- **R11c stamping alone does not require** visible branding in Builder — echo may be populated while cover remains placeholder.

### Next stage guidance (historical — superseded by §6AT)

**Do not start R11d, R12, or R15 code automatically.**

**Recommended (at R11c close):** scoping pass only — choose **one** after explicit user direction:

| Option | Focus |
|--------|--------|
| **R12 scoping** | Customer echo / customer identity stamping (separate from company branding) — **now complete** (`31059e3`, §6AT) |
| **R15 scoping** | Branded cover/display — read `proposalCompanyContext`, render cover; **requires visual check** |

**Current next stage:** see **§6AU** — **R15 scoping/planning only** after explicit direction.

**Any next stage must preserve:**

- Preview / Send / Sign / Payment **disabled**
- Pricing trust + snapshot safety
- `context_echo` frozen-truth rules
- Templates / Job Card / Jobs Board boundaries
- No mixed live Settings + frozen proposal pricing truth

---

## 6AT. R12 COMPLETION — CUSTOMER IDENTITY CONTEXT_ECHO STAMPING

**Status:** **R12 complete** (`31059e3`). **Post-R12 full-surface product safety audit passed** — code/test/source-of-truth + **authenticated Playwright MCP** verification; no P0/P1 blockers. **Depends on:** **R11c** (company branding echo, §6AS). **Next:** **Do not auto-start R13 / R15** — scoping only after explicit direction.

### R12 implementation commit

| Commit | Pass | Scope |
|--------|------|-------|
| `31059e3` | **R12** | Stamp DB-truth customer identity into `proposal_versions.context_echo` at **new draft creation only**; read-only `proposalCustomerContext` on adapter DTO |

**R12 changed only scoped lib/test files (no SQL/docs/packages):**

- `app/lib/proposalVersionTypes.ts`
- `app/lib/proposalCustomerContext.ts` + `.test.ts`
- `app/lib/proposalSnapshotBuilder.ts` + `.test.ts`
- `app/lib/proposalRecordStore.ts` + `.test.ts`
- `app/lib/proposalDraftGraphAdapter.ts` + `.test.ts`

**Not in R12:** Job Card UI changes; Builder UI / customer display; customer preview/PDF/send/sign/payment; customer refresh/staleness action; backfill of old drafts; SQL/migrations; package changes.

### R12 summary

- **R12 mirrors R11c frozen-truth architecture** — stamp at draft create only; Builder persisted path reads frozen echo.
- **`createDraftProposal`** loads customer identity from **`customers`** (company-scoped) via `loadProposalCustomerContextFromDatabase` — **no localStorage, no estimateStore, no Job Card context passthrough for customer echo fields**.
- Stamps customer slice into **`proposal_versions.context_echo`** before draft version insert.
- **`address_formatted`** remains **job/site address** from `jobs`; **`customer_address`** is **customer mailing address** from `customers.address` — **distinct fields; must never be overloaded or mixed**.
- Job denormalized customer fields on `jobs` (`customer_name`, etc.) are **Job Card/intake UX only** — **not** proposal document truth (regression-tested).
- **`refreshDraftPricing`:** merge-only update of measurement/pricing snapshot fields; **preserves** all customer + company echo fields (regression-tested).
- **`proposalDraftGraphAdapter`** exposes read-only **`proposalCustomerContext`** from stamped `context_echo` — for **future display work only**; **not consumed in Builder UI yet**.
- **Visible customer display is NOT expected in R12** — deferred to **R15** or dedicated display stage.

### `context_echo` customer identity fields

**Existing (pre-R12):**

| Field | Source / meaning |
|-------|------------------|
| `customer_id` | Resolved from create payload / job pointer at draft create |
| `customer_name` | **`customers.name`** at create (R12) |
| `customer_email` | **`customers.email`** at create (R12) |
| `customer_phone` | **`customers.phone`** at create (R12) |
| `address_formatted` | **Job/site address** — `jobs.address_formatted` |

**New (R12):**

| Field | Source / meaning |
|-------|------------------|
| `customer_address` | **Customer mailing/customer address** — `customers.address` |

**Field separation (mandatory):**

- **`customer_address`** = customer mailing/customer address from **`customers.address`**
- **`address_formatted`** = job/site address from **job record**
- These **must never be overloaded or mixed**.

**Company branding fields from R11c** remain present/preserved on the same `context_echo` blob.

### Source-of-truth rules (R12 lock)

| Domain | Live truth | Proposal draft truth |
|--------|------------|----------------------|
| Customer identity (name, email, phone, mailing address) | **`public.customers`** | `context_echo` customer fields at draft create |
| Customer pointer on proposal | **`proposals.customer_id`** + **`jobs.customer_id`** | `context_echo.customer_id` |
| Job/site address | **`jobs.address_formatted`** | `context_echo.address_formatted` |
| Job denormalized customer display fields | **`jobs` denorm columns** | **Not used** — Job Card/intake UX only |
| Company branding | §6AS | `context_echo` company fields (unchanged) |

**Builder persisted path** must read stamped **`context_echo`** (via adapter DTO), **not** live `customers` / `jobs` / localStorage / estimateStore.

**Pre-R12 drafts** (created before `31059e3`) may have **null/missing** customer identity keys — **no backfill** was done; adapter tolerates missing keys.

**Customer/Settings changes after draft create** do **not** auto-update existing draft echo — customer refresh/staleness action **deferred**.

### R12 implementation behavior

- **`createDraftProposal`** resolves `customer_id` from create payload and/or job pointer.
- If payload `customer_id` and job `customer_id` both exist and **differ**, creation **fails closed**.
- Customer identity loaded from **`customers`** scoped by `company_id` + `customer_id`.
- **Missing customer row / read error:** fail-soft to **null** customer name/email/phone/address while preserving `customer_id` and job/site `address_formatted`.
- **`refreshDraftPricing`** preserves customer + company echo fields; updates pricing snapshots and optionally re-stamps measurement fields only (merge onto existing echo).
- **`proposalDraftGraphAdapter.readProposalCustomerContextFromEcho`** exposes read-only DTO — **future display only**; Builder does **not** live-read customer DB.

### Post-R12 audit results (at `31059e3`)

**Post-R12 full-surface product safety audit:** **passed** from code/test/source-of-truth perspective — no P0/P1; protected systems unchanged in R12 scope.

**Tests:**

| Suite | Result |
|-------|--------|
| Requested audit tests (12 files) | **265/265** pass |
| Pricing/template validation (R11c/R12 checks) | **61/61** pass |
| **Combined audit run** | **326/326** pass |

**TypeScript:** only **6** known pre-existing `RoofingClientV2.tsx` errors — unchanged.

**Playwright MCP (authenticated re-audit):**

| Check | Result |
|-------|--------|
| MCP available | **Yes** |
| Auth method | Outside-repo `storageState`: `C:\Users\sabre\.cursor\fielddive-playwright-auth.json` |
| Auth / RLS bypass | **None** — normal Supabase session; no repo auth files |
| Protected routes (5) | **All loaded without `/login` redirect** — settings, settings/pricing, saved, catalog, templates |
| Route errors / console errors (error level) | **None observed** |
| Visual regression | **None obvious** |
| Jobs Board | Loaded DB job cards after wait (~12–15s); cards are **`<article>` click targets**, not ordinary `href` job links |

**Authenticated proposal workflow verified (existing draft open — not new draft create):**

| Step | Route / action |
|------|----------------|
| 1 | `/tools/roofing/saved` — Jobs Board |
| 2 | Click job card article (Mike Jones / Proposal Draft) |
| 3 | Job Card `?entry=job-card&job=6bddd1bf-7900-4b0a-b867-675f343fbb94` |
| 4 | **Proposals** tab → **Open Proposal Builder** |
| 5 | Builder `.../proposals/builder?job=6bddd1bf-...&proposal=0165fa1d-...` |

**Builder checks on opened draft:** pricing totals displayed (e.g. `$6,737.50`); **Preview / Send / Sign / Payment disabled**; **no Proposals hub nav**; stale banner not visible on this draft.

**Do not overstate:** this run verified protected-route access and **opening an existing proposal** — it did **not** create a brand-new draft. **Create-time R12 stamping** is proven by unit tests (`proposalRecordStore.test.ts`, `proposalSnapshotBuilder.test.ts`, `proposalDraftGraphAdapter.test.ts`).

**Live `context_echo` read (RLS-scoped Supabase response during Builder load — non-mutating app read path):**

| Draft | `proposal` id | Echo observation |
|-------|---------------|------------------|
| Stamped (R11c + R12) | `f3a12198-fc90-4d7d-8079-f0d15b47a2b7` | `customer_id`, `customer_name` (Mike Jones), `customer_email`, `customer_phone`, `customer_address`, `address_formatted` present; `company_name` (Anderson Roofing), `company_license`, `company_address`, `show_license_on_cover: false` present |
| Pre-R12 / pre-stamping | `0165fa1d-dd17-4daa-bab0-ff48a06682d8` | `customer_id` + `address_formatted` only; customer name/email/phone/address and company branding fields **null** — **expected**, not a defect |

Pre-R12 drafts may remain null because **no backfill** was scoped.

**Working tree:** clean at `31059e3` before this docs commit.

### Known P2/P3 carryover (post-R12)

| Item | Priority | Notes |
|------|----------|-------|
| **Playwright `storageState` session expiry** | P3 | Re-login + re-save `C:\Users\sabre\.cursor\fielddive-playwright-auth.json` when session expires |
| **Pre-R12 drafts** lack stamped customer echo fields | P2 | No backfill by design — expected nulls on old drafts |
| Builder does **not render** `proposalCustomerContext` yet | P2 | **R15** or display stage |
| **Customer refresh/staleness action** for existing drafts | P2 | Deferred |
| `mergeCustomerContextEchoInput` theoretical override path | P3 | Production Job Card does **not** pass customer overrides in `context` today |
| Legacy `RoofingClient` / packet **localStorage** surfaces | P2 | Not `context_echo` path |
| Pricing Settings page visual mismatch vs Settings workspace | P2 | Pre-R11b debt |
| `RoofingClientV2.tsx` TypeScript errors (6) | P3 | Pre-existing |

### Next stage guidance (after this docs checkpoint)

**Do not start R13 or R15 code automatically.**

**Recommended:** scoping pass only — choose **one** after explicit user direction:

| Option | Focus |
|--------|--------|
| **R13 scoping** | Continue proposal document/customer/company/page truth work (if directed) |
| **R15 scoping** | Branded/customer cover/display — read `proposalCompanyContext` + `proposalCustomerContext`; **requires visual check** |

**Any next stage must preserve:**

- Preview / Send / Sign / Payment **disabled**
- Pricing trust + snapshot safety
- `context_echo` frozen-truth rules (customers = live truth at create; echo = frozen document identity)
- Templates / Job Card / Jobs Board boundaries
- No mixed old/new logic (no Job Card payload / localStorage / estimateStore as proposal echo truth)

**Note on §6AL stage IDs:** In the recovery playbook table, historical **R12 = 3J4J job page editor** referred to a later content-editing slice. The **R12 completed at `31059e3`** is **customer identity context_echo stamping** — reconcile §6AL references before starting job-page editor work.

**Superseded by §6AU:** R13 scoping guidance below — **R13 is complete** at `e40db30`.

---

## 6AU. R13 COMPLETION — FROZEN DOCUMENT TOKEN FOUNDATION

**Status:** **R13 complete** (`e40db30`). **Post-R13 full-surface product safety audit passed**. **Superseded for next-stage guidance by §6AV** (R15 complete at `ab5a400`). **Depends on:** **R11c** (company echo, §6AS) + **R12** (customer echo, §6AT).

### R13 implementation commit

| Commit | Pass | Scope |
|--------|------|-------|
| `e40db30` | **R13** | Pure frozen document token foundation — registry, context builder, resolver, adapter DTO; **lib-only** |

**R13 changed only scoped app/lib files (no SQL/docs/packages):**

- `app/lib/proposalDocumentTokenTypes.ts`
- `app/lib/proposalDocumentTokenRegistry.ts` + `.test.ts`
- `app/lib/proposalDocumentContext.ts` + `.test.ts`
- `app/lib/proposalDocumentTokenResolver.ts` + `.test.ts`
- `app/lib/proposalDraftGraphAdapter.ts` + `.test.ts` (minimal integration — exposes `proposalDocumentContext`)

**Not in R13:** Builder cover/display UI; token rendering in Builder; markdown substitution in customer-facing pages; template editor changes; Job Card / Jobs Board changes; Preview/Send/Sign/Payment enablement; SQL/migrations; package changes; pricing recalculation; legacy `RoofingClient` PDF path; `estimateStore` reuse.

### R13 summary

- **R13 is a pure frozen document token foundation** — lib-only; unblocks later R15 branded cover/display and future text merge without wiring visual UI now.
- Added **central token registry** (23 available tokens), **`ProposalDocumentContext`** builder, **pure resolver** (+ optional `substituteProposalDocumentTokens` helper), and **adapter integration**.
- **No Builder UI** was added; **no token rendering** wired into Builder; **no markdown substitution** wired into `ProposalBuilderCustomerPage` or template bodies.
- Dynamic fields resolve from **persisted proposal graph data only** — not live Settings/customers/jobs, not localStorage/cache, not pricing engine recalculation.

### Token registry (23 available tokens)

**Public future syntax:** `{{token_name}}` (stable snake_case names).

**Company (9):** `company_name`, `company_logo_url`, `company_phone`, `company_license`, `company_address`, `company_website`, `brand_primary_color`, `brand_secondary_color`, `show_license_on_cover`

**Customer (4):** `customer_name`, `customer_email`, `customer_phone`, `customer_address`

**Job (2):** `job_name`, `job_address`

**Measurement (1):** `measurement_summary`

**Proposal (4):** `proposal_number`, `proposal_title`, `template_name`, `proposal_created_date`

**Selected package / pricing (3):** `selected_package_name`, `selected_package_total`, `proposal_total` (alias of selected package total)

**Field separation (mandatory):**

- **`customer_address`** = `context_echo.customer_address` (customer mailing)
- **`job_address`** = `context_echo.address_formatted` (job/site) — **must never be conflated**

**Not available yet:** `proposal_expires_date`, `sales_rep_name`, signature/payment/lifecycle tokens — absent from registry until explicit product + stamping decisions.

**§6AL reconciliation:** Historical §6AL labeled **R13** as “Dynamic fields (job card → text)”. **R13 completed at `e40db30`** is the **pure token foundation** only. **Text substitution / body merge** in `proposal_pages.body_markdown` belongs to **later slices** (post-R15 or dedicated merge stage) — not R13.

### `ProposalDocumentContext`

**Builder:** `buildProposalDocumentContextFromDraftGraph(graph)` — persisted `ProposalDraftGraph` rows only.

| Source | Fields |
|--------|--------|
| R11c/R12 echo readers | `company`, `customer` slices from `context_echo` |
| `context_echo` | `job_name`, `address_formatted` → jobAddress, `measurement_quantities_display`, `template_name` |
| `proposals` row | `proposal_number`, `title` |
| `proposal_versions` row | `created_at` → proposalCreatedDateIso |
| Selected runtime `proposal_options` row | `customer_label` / `name` → packageName; `customer_total_cents` → customerTotalCents |

**Selected option resolution order:**

1. `proposals.selected_option_id` → matching runtime option
2. Else `is_default` option
3. Else first option by `sort_order`

**Tolerates** old drafts with missing R11c/R12 echo keys (null slices; no throw).

**Must not import:** Supabase, stores, localStorage, `estimateStore`, `RoofingClient`, `proposalPricingEngine`, live Settings/customers/jobs loaders.

### Resolver behavior (pure)

| Function | Role |
|----------|------|
| `resolveProposalDocumentToken(tokenName, context)` | Single token → `{ value, resolved }` |
| `resolveAllProposalDocumentTokens(context)` | All registry tokens → map |
| `substituteProposalDocumentTokens(text, context)` | Replace `{{token}}` in text — **pure; not wired to UI** |

**Rules:**

- Unknown/unavailable tokens → empty string, `resolved: false`; **must not throw**
- Missing string values → empty string
- Missing `show_license_on_cover` → `"false"`
- Money tokens → format **persisted cents only** (no repricing)
- Date tokens → stable UTC `en-US` long format (e.g. `June 10, 2026`)
- Substitution → unresolved placeholders become empty strings (no raw `{{token}}` leak to customer-facing output)

### Source-of-truth rules (R13 lock)

| Token domain | Frozen source | Live reads in resolver path? |
|--------------|---------------|------------------------------|
| Company tokens | `context_echo` (R11c) | **No** |
| Customer tokens | `context_echo` (R12) | **No** |
| Job/site address | `context_echo.address_formatted` | **No** |
| Customer mailing | `context_echo.customer_address` | **No** |
| `proposal_total` / package total | Selected runtime option `customer_total_cents` | **No** — not pricing engine |
| Template/page prose | `proposal_pages.content_json.body_markdown` (static copy-on-create) | N/A — **no token duplication in pages introduced** |

**R15, Preview, PDF, and send must consume the same resolver** to avoid drift from `context_echo` + snapshot truth.

**Adapter:** `adaptProposalDraftGraphToBuilderPreview` exposes read-only **`proposalDocumentContext`**. **R15 Cover** and **R14 body pages** consume it — see **§6AV** and **§6AW**.

### Post-R13 audit results (at `e40db30`)

**Post-R13 full-surface product safety audit:** **passed** — no P0/P1; protected systems unchanged in R13 scope.

**Tests:**

| Suite | Result |
|-------|--------|
| R13 + safety suites (15 files) | **291/291** pass |
| Pricing/template validation | **59/59** pass |
| **Combined audit run** | **350/350** pass |

**TypeScript:** only **6** known pre-existing `RoofingClientV2.tsx` errors — unchanged.

**Playwright MCP (authenticated light audit):**

| Check | Result |
|-------|--------|
| MCP available | **Yes** |
| Auth | Outside-repo `storageState`: `C:\Users\sabre\.cursor\fielddive-playwright-auth.json` |
| `/tools/settings` | Loaded — no `/login` redirect |
| `/tools/roofing/saved` (Jobs Board) | Loaded |
| `/tools/roofing/templates` | Loaded |
| `/tools/roofing/catalog` | **Transient `net::ERR_ABORTED`** on navigate (×2) — navigation flake; **not** auth failure; **not** R13 regression — retry in later browser audit |
| Builder (existing route) | Opened — pricing lines visible; **Preview/Send/Sign/Payment disabled**; **no Proposals hub nav**; **no token UI** (expected for R13) |
| Console errors (error level) | **None observed** on verified routes |

**Working tree:** clean at `e40db30` before this docs commit.

### Known P2/P3 carryover (post-R13)

| Item | Priority | Notes |
|------|----------|-------|
| **Builder header chrome uses live `JobRecord`** | P2 | R15 Cover uses `proposalDocumentContext` — see **§6AV**; header alignment deferred |
| **`proposalDocumentContext` unused by UI** | P3 | **Addressed in R15 + R14** — Cover (§6AV) + body pages (§6AW) |
| **Catalog Playwright navigation flake** | P2 | Retry `/tools/roofing/catalog` in later browser audit |
| **Text merge / `{{token}}` in `body_markdown`** | P2 | **Addressed in R14** (`f359ad4`, §6AW) — display-time merge; stored markdown unchanged |
| Pre-R11c/R12 drafts missing echo keys | P2 | No backfill — resolver returns empty strings |
| Customer/company refresh for existing drafts | P2 | Deferred |
| Legacy `RoofingClient` / packet localStorage | P2 | Not token resolver path |
| `RoofingClientV2.tsx` TypeScript errors (6) | P3 | Pre-existing |

### Next stage guidance (historical — superseded by §6AV)

**Do not start R15 code automatically.**

**Recommended:** **R15 scoping/planning** after explicit user direction — branded cover/display consuming **`proposalDocumentContext` + resolver**.

**R15 must:**

- Read frozen proposal graph truth only — **no live Settings/customers/jobs**
- **Not** use legacy `RoofingClient` PDF / `estimateStore`
- **Not** enable Preview / Send / Sign / Payment
- Include **explicit visual/browser checks** — first customer-facing document display slice

**Any next stage must preserve:**

- Preview / Send / Sign / Payment **disabled**
- Pricing trust + snapshot safety
- `context_echo` frozen-truth rules
- Templates / Job Card / Jobs Board boundaries
- Single shared resolver for all future customer-facing surfaces

---

## 6AV. R15 COMPLETION — READ-ONLY BRANDED PROPOSAL COVER

**Status:** **R15 complete** (`ab5a400`). **Post-R15 full-surface product safety audit passed** — code/test/source-of-truth + **authenticated Playwright MCP** visual verification; no P0/P1 blockers. **Depends on:** **R13** frozen document token foundation (§6AU) + **R11c/R12** context_echo stamping (§6AS, §6AT). **Next-stage guidance:** superseded by **§6AW** (R14 complete at `f359ad4`).

### R15 implementation commit

| Commit | Pass | Scope |
|--------|------|-------|
| `ab5a400` | **R15** | Read-only branded Cover tab/page in Proposal Builder — view model + presentational cover page + Builder wiring; **no lifecycle enablement** |

**R15 changed exactly 10 files (no SQL/docs/packages):**

- `app/lib/proposalCoverViewModel.ts`
- `app/lib/proposalCoverViewModel.test.ts`
- `app/tools/roofing/proposals/builder/ProposalBuilderCoverPage.tsx`
- `app/lib/proposalBuilderNavigation.ts`
- `app/lib/proposalBuilderNavigation.test.ts`
- `app/lib/proposalDraftGraphAdapter.test.ts`
- `app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderPageContextStrip.tsx`
- `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts`

**Not in R15:** PDF; Preview/Send/Sign/Payment enablement; customer preview route; markdown token substitution in body pages; template editor token picker; cover editing; token authoring UI; Job Card / Jobs Board / Templates changes; pricing engine/snapshot math changes; SQL/migrations; package changes; legacy `RoofingClient` PDF; `estimateStore` reuse; live Settings/customers/jobs reads for cover content.

### R15 summary

- **R15 added a read-only branded Cover tab/page** inside Proposal Builder — first customer-facing document surface consuming frozen proposal truth.
- Cover consumes **`proposalDocumentContext` + R13 resolver only** — not live Settings/customers/jobs, not `JobRecord`, not pricing engine recalculation.
- Cover is **visible UI**, but still **not** Preview / PDF / send / sign / payment.
- Cover does **not** wire markdown token substitution into Terms/Warranty/body pages.
- Cover does **not** reuse legacy `RoofingClient` PDF logic or `estimateStore`.

### Cover architecture

**Data flow:**

```
persisted graph
  → adaptProposalDraftGraphToBuilderPreview
  → proposalDocumentContext
  → buildProposalCoverViewModel(context, { pricingComplete })
  → ProposalBuilderCoverPage(viewModel)
```

| Layer | Role |
|-------|------|
| `ProposalBuilderCoverPage` | **Presentational only** — accepts cover view model props; no stores/DB |
| `proposalCoverViewModel` | **Pure** — builds cover DTO from frozen context via `resolveProposalDocumentToken` |
| `proposalDocumentContext` | Frozen slices from `context_echo` + proposal/version rows + selected runtime option snapshot cents (R13) |
| `ProposalBuilderClient` | Builds view model when `adapterResult.proposalDocumentContext` exists; passes `pricingComplete` from pricing preview status (display gate only — **no repricing**) |

**Navigation (Builder page strip):**

- **Cover tab enabled** when persisted proposal path has `proposalDocumentContext` (`persistedProposalDocument: true`).
- Cover **no longer shows “Soon”** when enabled.
- **Default Builder page remains Estimate** (`BUILDER_DEFAULT_PAGE_CONTEXT = "estimate"`).
- **Preview / Send / Sign / Payment remain disabled** — lifecycle flags unchanged in guidance.

### Cover behavior

| Area | Behavior |
|------|----------|
| **Company identity** | Logo/monogram, company name, optional address/phone/website from frozen tokens |
| **License** | Shown **only** when `show_license_on_cover === "true"` |
| **Logo fallback** | Missing logo → monogram from company name |
| **Brand colors** | Missing colors → FieldDive default accent (`#3b82f6`) |
| **Proposal title / meta** | Title, date, proposal number from frozen tokens |
| **Prepared for** | Customer name, email, phone; mailing address per dedupe rule below |
| **Project** | Job name + site address from frozen job tokens |
| **Investment summary** | Selected package name; **proposal total only when pricing complete** |
| **Incomplete pricing** | Suppresses fabricated total; shows incomplete-pricing message |
| **Missing echo fields** | Old/missing R11c/R12 fields collapse gracefully — no throw |
| **Draft note** | Clear that Preview/send/signature remain unavailable |

### Address dedupe rule (mandatory)

| Token / field | Meaning |
|---------------|---------|
| `customer_address` | Customer **mailing** address |
| `job_address` / `address_formatted` | Job **site** address |

**Dedupe logic** (`proposalCoverAddressesMatch`):

- Compare mailing vs site after **trim + case-insensitive** equality.
- **If identical:** omit mailing address from Prepared for; show address **once** as Project **Site address**.
- **Email and phone remain visible** in Prepared for when mailing is deduped.
- **If different:** show **both** with distinct labels — **“Mailing address”** and **“Site address”**.

### Pricing / total safety (cover)

- Cover **does not recalculate** prices.
- Cover total uses **persisted selected package `customer_total_cents`** through R13 `proposal_total` token — only when `pricingComplete` is true from existing pricing preview status.
- Estimate tab preview lines/totals **unchanged**.
- Stale pricing banner + `refreshDraftPricing` **unchanged** in R15 scope.

### Post-R15 audit results (at `ab5a400`)

**Post-R15 full-surface product safety audit:** **passed** — no P0/P1; protected systems unchanged in R15 scope.

**Tests:**

| Suite | Result |
|-------|--------|
| R15 + safety + guidance (18 suites) | **326/326** pass |
| Pricing/template validation | **61/61** pass |
| **Combined audit run** | **387/387** pass |

**TypeScript:** only **6** known pre-existing `RoofingClientV2.tsx` errors — unchanged.

**Authenticated Playwright visual audit** (storageState: `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`; draft `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`):

| Check | Result |
|-------|--------|
| Builder opened without login redirect | **Pass** |
| Cover tab clickable; no “Soon” | **Pass** |
| Company / prepared-for / project / investment / draft note rendered | **Pass** |
| Address dedupe (identical mailing/site) | **Pass** — site once; email/phone visible |
| License hidden when `show_license_on_cover` false | **Pass** |
| No fake total on incomplete-pricing draft | **Pass** |
| Estimate tab pricing content | **Pass** |
| Preview/Send/Sign/Payment disabled | **Pass** |
| No raw `{{token}}` visible | **Pass** |
| No console errors (error level) | **Pass** |
| No Proposals hub nav | **Pass** |
| Mobile ~390px — no horizontal overflow | **Pass** |
| Visual quality (document-first, not dashboard clutter) | **Pass** — acceptable first pass |

**Partial/pre-R12 draft:** not live-audited; unit tests cover missing echo collapse.

**Working tree:** clean at `ab5a400` before this docs commit.

### Known P2/P3 carryover (post-R15)

| Item | Priority | Notes |
|------|----------|-------|
| **Builder header chrome uses live `JobRecord`** | P2 | Cover uses frozen `proposalDocumentContext`; header/document alignment can be scoped later |
| **Complete-pricing cover↔Estimate total parity** | P2 | Unit-tested; audit draft had incomplete pricing — not browser-verified when total shown |
| **Partial/pre-R12 cover** | P3 | Unit-tested only; no live partial-draft browser audit |
| **Markdown/body token substitution** | P2 | **Addressed in R14** (`f359ad4`, §6AW) — display-time merge only; no write-back |
| **Template token authoring UI** | P2 | Not wired |
| **PDF / Preview / send / sign / payment** | P2 | Future lifecycle stages (R17–R20) |
| **`RoofingClientV2.tsx` TypeScript errors (6)** | P3 | Pre-existing |
| Pre-R11c/R12 drafts missing echo keys | P2 | No backfill — graceful empty/collapse |

### Next stage guidance (historical — superseded by §6AW)

**Do not start R16/R17 automatically.**

**Do not enable Preview / Send / Sign / Payment.**

**Recommended next architectural stage to scope:** **R14 body/page token merge foundation** — **now complete** at `f359ad4` (§6AW).

**R16** (Proposals hub code) and **R17–R20** (lifecycle) remain **later** — not next by default.

**Any next stage must preserve:**

- Preview / Send / Sign / Payment **disabled**
- Pricing trust + snapshot safety
- `context_echo` frozen-truth rules
- Templates / Job Card / Jobs Board boundaries
- Single shared resolver for all customer-facing surfaces

---

## 6AW. R14 COMPLETION — READ-ONLY BODY/PAGE TOKEN MERGE FOUNDATION

**Status:** **R14 complete** (`f359ad4`). **Post-R14 full-surface product safety audit passed** — code/test/source-of-truth + **authenticated Playwright MCP** visual verification; no P0/P1 blockers. **Depends on:** **R13** frozen document token foundation (§6AU) + **R15** cover proof that Builder can consume frozen context safely (§6AV). **Next:** **Do not auto-start R16/R17** — scope next stage only after explicit direction.

### R14 implementation commit

| Commit | Pass | Scope |
|--------|------|-------|
| `f359ad4` | **R14** | Display-time token merge for read-only body text pages — pure body renderer + minimal Builder wiring; **no lifecycle enablement** |

**R14 changed exactly 5 files (no SQL/docs/packages):**

- `app/lib/proposalDocumentBodyRenderer.ts`
- `app/lib/proposalDocumentBodyRenderer.test.ts`
- `app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderCustomerPage.tsx`

**Not in R14:** PDF; Preview/Send/Sign/Payment enablement; customer preview route; template editor token picker; token insertion UI; body-page editing; template/draft backfill; DB writes/migrations; pricing engine/snapshot math changes; Job Card / Jobs Board / Templates changes; R15 cover rework; legacy `RoofingClient` PDF; `estimateStore` reuse; live Settings/customers/jobs reads for document rendering; `JobRecord` as proposal document truth.

### R14 summary

- Added **display-time token merge** for read-only Builder body text pages.
- Body pages now render `{{token_name}}` placeholders using frozen **`proposalDocumentContext`** + **R13 resolver**.
- Stored **`content_json.body_markdown`** remains **unchanged** — no write-back of rendered text.
- **No DB writes. No migrations.**
- **No** template editor token picker, token insertion UI, or body editing.
- **No** Preview / PDF / send / sign / payment.
- **No** live Settings/customers/jobs reads for document rendering.
- **No** `JobRecord` as proposal document truth.
- **No** pricing recalculation, `RoofingClient` PDF, or `estimateStore`.

### Body renderer architecture

**Data flow:**

```
raw body_markdown + proposalDocumentContext + { pricingComplete }
  → renderProposalDocumentPageBody(...)
  → { displayText, diagnostics }
  → ProposalBuilderCustomerPage (plain React text nodes)
```

| Layer | Role |
|-------|------|
| `proposalDocumentBodyRenderer` | **Pure** — token substitution + diagnostics; no I/O |
| R13 registry + `resolveProposalDocumentToken` | Frozen context → string values |
| `ProposalBuilderCanvas` | Calls renderer for customer text page types when context exists; fallback to raw body when absent |
| `ProposalBuilderCustomerPage` | Existing safe plain-text parser (paragraphs + bullets); optional muted `contractorNotice` |

**Safety:**

- Renderer is **plain text only** — no markdown HTML rendering.
- Existing body display path remains **React text nodes** — no `dangerouslySetInnerHTML`.
- **Diagnostics** track: tokens found, unknown tokens removed, money tokens suppressed, malformed placeholders remaining.

### Page coverage

**Token merge applies** (read-only customer text pages only):

- `project_overview`
- `terms`
- `warranty`
- `custom_text`

**Token merge does not apply:**

| Page / surface | Path |
|----------------|------|
| **Cover** | R15 `buildProposalCoverViewModel` → `ProposalBuilderCoverPage` (§6AV) |
| **Estimate** | Snapshot pricing / line items (unchanged) |
| **Photos / media** | Placeholder panel |
| **Add Page** | Disabled / “Soon” |
| **Preview** | Locked / disabled |
| **Signature / payment future pages** | Not token-merged; not enabled |

### Token policy

| Rule | Behavior |
|------|----------|
| Syntax | `{{token_name}}` — snake_case registry tokens only |
| Known tokens | Resolve through R13 resolver from frozen context |
| Unknown R13-pattern tokens | Empty string — not leaked |
| Missing values | Empty string — no throw |
| Repeated tokens | Consistent resolution |
| Paragraphs + bullet lines | Tokens resolve **before** display parsing |
| Supported raw tokens | Must not remain visible after render |
| Malformed placeholders | e.g. `{{ customer_name }}`, `{{CUSTOMER_NAME}}` may remain — tested/documented |
| `customer_address` vs `job_address` | Resolve **independently** in body text |
| R15 cover address dedupe | **Not** applied to body text |

### Pricing token policy

| Token | When `pricingComplete === false` | When `pricingComplete === true` |
|-------|----------------------------------|----------------------------------|
| `proposal_total` | Empty string | Persisted snapshot cents via R13 resolver |
| `selected_package_total` | Empty string | Persisted snapshot cents via R13 resolver |

- **No pricing engine recalculation** in R14.
- **Estimate tab** pricing content unchanged.
- **Cover** pricing/total gating unchanged (R15).

### Stored vs rendered content (mandatory)

| Layer | Rule |
|-------|------|
| **`proposal_pages.content_json.body_markdown`** | Raw source text — **never mutated** by R14 |
| **Rendered display text** | Derived at **display time only** in Builder |
| **Write-back** | **None** — no rendered text persisted |
| **Template migration / backfill** | **None** |
| **Future Preview/PDF** | Must **reuse `renderProposalDocumentPageBody`** — **no second substitution path** |

### Post-R14 audit results (at `f359ad4`)

**Post-R14 full-surface product safety audit:** **passed** — no P0/P1; protected systems unchanged in R14 scope.

**Tests:**

| Suite | Result |
|-------|--------|
| R14/R13/R15 focused (8 files) | **96/96** pass |
| Full combined relevant run (R14 + safety + pricing/template) | **380/380** pass |

**TypeScript:** only **6** known pre-existing `RoofingClientV2.tsx` errors — unchanged.

**Authenticated Playwright visual audit** (storageState: `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`; draft `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`):

| Check | Result |
|-------|--------|
| Builder opened without login redirect | **Pass** |
| Cover worked; matched R15 baseline | **Pass** |
| Cover had no raw `{{token}}` | **Pass** |
| Estimate worked unchanged | **Pass** |
| Project Overview, Terms, Warranty read-only | **Pass** |
| Custom text page | **N/A** — not on audit draft strip |
| Seeded bodies had no tokens | **Pass** — no regression; unit tests prove merge |
| Preview/Send/Sign/Payment disabled | **Pass** |
| No Proposals hub | **Pass** |
| No console errors (error level) | **Pass** |
| Mobile ~390px — no horizontal overflow | **Pass** |
| Contractor notice | **N/A** — not triggered (no suppressed/unknown tokens on draft) |

**Auth path note:** correct path is `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`. **`C:\Users\sabre.cursor\...`** (missing `.` before `cursor`) is a **typo** — do not reuse.

**Working tree:** clean at `f359ad4` before this docs commit.

### Known P3 carryover (post-R14)

| Item | Priority | Notes |
|------|----------|-------|
| **Browser-visible token merge on live draft** | P3 | Seeded body pages are static prose (no `{{tokens}}`); substitution proven by unit tests only |
| **Custom text page browser verification** | P3 | Audit draft had no `custom_text` page; code + tests include `custom_text` |
| **Future tokenized test fixture** | P3 | Safe non-production fixture would improve browser verification |
| **Template token picker / authoring** | P2 | Not wired |
| **Body page editing** | P2 | Not wired |
| **Preview / PDF / customer route / send / sign / payment** | P2 | Future lifecycle stages (R17–R20) |
| **`RoofingClientV2.tsx` TypeScript errors (6)** | P3 | Pre-existing |
| **Builder header chrome uses live `JobRecord`** | P2 | Cover + body use frozen context; header alignment deferred |
| Pre-R11c/R12 drafts missing echo keys | P2 | No backfill — graceful empty/collapse |

### Protected systems (unchanged in R14)

- Pricing math/totals; stale pricing trust; proposal snapshot builder totals
- Selected option persistence; proposal DB identity; `refreshDraftPricing` (pages/content untouched)
- Approval/status/payment/send/PDF locks; Builder disabled lifecycle chain
- R15 cover architecture and address dedupe
- Job Card proposal gates; Templates save behavior; Jobs Board identity/stages
- R11c company branding stamping; R12 customer identity stamping; R13 resolver behavior

### Next stage guidance (after this docs checkpoint)

**Do not auto-start R16/R17.**

**Do not enable Preview / Send / Sign / Payment.**

**Next stage should be scoped only after explicit direction.** Recommended **planning** options (scoping only — **no implementation** until approved):

| Option | Focus |
|--------|--------|
| **Full Roofr/document comparison audit** | Now that Cover + body pages are visible |
| **Proposal document page polish / document IA audit** | Read-only document surface quality |
| **Template token authoring / picker scope** | Authoring UX — separate from R14 display merge |
| **Preview / PDF / customer-facing route scope** | Lifecycle boundary — R17+ |

**Any visible document/lifecycle work needs authenticated Playwright visual checks** (test-only; outside-repo `storageState`; no auth/RLS bypass; route 200 ≠ full verification).

**Any next stage must preserve:**

- Preview / Send / Sign / Payment **disabled**
- Pricing trust + snapshot safety
- `context_echo` frozen-truth rules
- Templates / Job Card / Jobs Board boundaries
- Single shared resolver + body renderer for all future customer-facing surfaces

---

## 6AX. R16A COMPLETION — BUILDER CHROME / CUSTOMER DOCUMENT IA SEPARATION

**Status:** **R16A complete** (`18cebca`). **Post-R16A product safety audit passed** — code/test/source-of-truth + **authenticated Playwright MCP** visual verification; no P0/P1 blockers. **Naming:** **R16A ≠ §6AL R16 Proposals hub**. **R16A** = Builder chrome / customer document IA polish. **§6AL R16** Proposals hub (Draft/Sent/Won/Lost list) remains **not started**.

### 1. Scope completed

- **R16A** is complete and committed at **`18cebca`**.
- **R16A is not the same as §6AL R16 Proposals hub.**
- **R16A** = Builder chrome / customer document IA polish.
- **§6AL R16** Proposals hub remains **not started**.

### 2. R16A implementation commit and files changed

| Commit | Pass | Scope |
|--------|------|-------|
| `18cebca` | **R16A** | Separate Builder chrome from customer document IA — pure IA/copy/order module + Builder UI wiring; **no lifecycle enablement** |

**R16A changed exactly 11 files (no SQL/docs/packages):**

- `app/lib/proposalBuilderDocumentIa.ts`
- `app/lib/proposalBuilderDocumentIa.test.ts`
- `app/lib/proposalBuilderNavigation.ts`
- `app/lib/proposalBuilderNavigation.test.ts`
- `app/tools/roofing/proposals/builder/ProposalBuilderPageHeader.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderCustomerPage.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderCoverPage.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderPageContextStrip.tsx`
- `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts`

**Not in R16A:** Preview/Send/Sign/Payment enablement; PDF; customer preview route; body-page editing; token picker; token insertion UI; media/photos implementation; Proposals hub; pricing engine/snapshot math changes; `refreshDraftPricing` behavior changes; R15 cover VM logic changes; R14 body renderer logic changes; R13 token resolver/registry changes; Job Card / Jobs Board / Templates UI changes; SQL/migrations/packages; legacy `RoofingClient` PDF; `estimateStore` reuse.

### 3. Behavior added / changed

- New pure IA/copy/order module: **`proposalBuilderDocumentIa.ts`**.
- **Customer-logical page strip order:**
  **Cover → Project Overview → Estimate → Terms → Warranty → Project Photos → Add Page**.
- **Default landing remains Estimate.**
- **Header** is explicitly **contractor workspace chrome** (`Proposal workspace` kicker).
- **Header no longer shows template/package chips.**
- **Header includes live-context / saved-snapshot distinction:**
  “Live job context — document pages use saved draft snapshot”.
- **Estimate canvas no longer shows** the amber **Preview-unlock blocker banner** (guidance moved to rail only).
- **Pricing/blocking guidance remains** in the Proposal Helper rail / guidance area.
- **Body pages** have simplified shell and **standardized read-only footer**
  (“Read-only draft page. Content editing comes in a later phase.”).
- **Cover draft note shortened** to: **“Draft proposal — not sent to customer.”**
  (no Preview/send/signature lifecycle wording).
- **Page strip renders in navigation order** (customer-logical order enforced in strip component).
- **Add Page** remains **disabled / Soon**.
- **Preview** remains **locked** and **not active in visible strip UI** (filtered from strip; lifecycle disabled).

### 4. Source-of-truth boundary

| Surface | Rule |
|---------|------|
| **Header / workspace chrome** | May use live **`JobRecord`** only as **workspace context** (title, address, back link) — **not** document truth |
| **Cover** | R15 **`buildProposalCoverViewModel`** from frozen **`proposalDocumentContext`** |
| **Body text pages** | R14 **`renderProposalDocumentPageBody`** from frozen **`proposalDocumentContext`** + persisted `body_markdown` |
| **Estimate** | Existing persisted graph + pricing preview path (unchanged) |

**Mandatory boundaries preserved:**

- **No** live Settings/customers/jobs reads for proposal **document rendering**.
- **No** `JobRecord` for Cover/body document truth.
- **No** pricing recalculation introduced.
- **No** token-rendered text persisted.
- **R15** cover VM **unchanged** (module not in R16A diff).
- **R14** body renderer **unchanged** (module not in R16A diff).
- **R13** token resolver/registry **unchanged**.

### 5. Protected systems unchanged

- **No** docs/SQL/packages in R16A code commit.
- **No** pricing engine changes.
- **No** proposal snapshot builder changes.
- **No** `refreshDraftPricing` behavior changes.
- **No** payment/approval/status/send/PDF changes.
- **No** Job Card / Jobs Board / Templates UI changes.
- **Preview / Send / Sign / Payment remain disabled.**
- **No** PDF / customer route.
- **No** Proposals hub.
- **No** body editing.
- **No** token picker.
- **No** media/photos implementation.

### 6. Post-R16A audit results (at `18cebca`)

**Verdict:** **Proceed to docs checkpoint.** **No P0/P1 blockers.**

**Tests:**

| Suite | Result |
|-------|--------|
| R16A IA + navigation + guidance + R14/R15/R13 + safety suites | **345/345** pass |

**TypeScript:** only **6** known pre-existing `RoofingClientV2.tsx` errors — unchanged.

**Authenticated Playwright visual audit** (storageState: `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`; draft `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`):

| Check | Result |
|-------|--------|
| Builder opened without login redirect | **Pass** |
| Default tab Estimate | **Pass** |
| Strip order Cover → Project Overview → Estimate → Terms → Warranty → Project Photos → Add Page | **Pass** |
| Cover renders (R15 baseline) | **Pass** |
| Cover draft note shortened and customer-safe | **Pass** |
| Project Overview / Terms / Warranty read-only | **Pass** |
| Estimate package / lines / totals | **Pass** |
| No amber Preview-unlock banner on Estimate canvas | **Pass** |
| Header workspace label; no template/package chips | **Pass** |
| Rail shows Proposal Helper / Blocking / Pricing status | **Pass** |
| Preview / Send / Sign / Payment disabled | **Pass** |
| No Proposals hub | **Pass** |
| **0** console errors after clean reload | **Pass** |
| Mobile ~390px — no horizontal overflow | **Pass** |
| Visual duplication reduced vs pre-R16A | **Pass** |

**Working tree:** clean at `18cebca` at time of R16A audit; doc-only WIP for this checkpoint.

### 7. Known P3 carryover (post-R16A, non-blocking)

| Item | Priority | Notes |
|------|----------|-------|
| **Rail copy “Preview based on your company pricing”** | P3 | Future **R16B** polish can rephrase to “Draft pricing preview” |
| **Compact chrome alert “Read-only preview”** | P3 | Optional future copy tighten in workspace chrome |
| **Header live context vs frozen document context** | P3 | Intentional separation — keep documented |
| **`BUILDER_PREVIEW_BANNER` constant unused** | P3 | Orphan after canvas banner removal; optional cleanup later |
- **`+1` strip overflow chip** | P3 | **Addressed in R16C1** (`967f0de`, §6BA) — replaced by More pages menu |
| **Transient HMR-only console error** | P4 | `optionBlockingLineCount` observed during hot reload only; clean reload **0** errors; grep confirmed no committed-code defect |

### 8. Next-stage guidance (after this docs checkpoint)

**Do not start Preview / PDF / lifecycle (R17–R20) automatically.**

**Do not start §6AL R16 Proposals hub, body editing, token picker, or media/photos without explicit scope.**

**Use the live-web Roofr research addendum as future alignment input — do not implement from it yet.**

**Recommended immediate next (planning/audit only):**

| Option | Focus |
|--------|--------|
| **Roofr-aligned duplication/drift audit** | Header vs document, strip order, Preview gate, page hide/show, drawer-vs-canvas, signed immutability, payments separate from proposal send |
| **Small scoped R16B polish** | Rail/copy cleanup (e.g. “Draft pricing preview”) |
| **Body-authoring scope decision** | `updateProposalPage`, token picker — separate explicit stage |

**Continue combining docs checkpoints where safe**, but document source-of-truth / lifecycle / pricing / document-boundary changes promptly.

**Any next stage must preserve:**

- Preview / Send / Sign / Payment **disabled**
- Frozen **`proposalDocumentContext`** for customer document surfaces
- Pricing trust + snapshot safety
- Templates / Job Card / Jobs Board boundaries
- Single shared resolver + body renderer for future customer-facing surfaces

---

## 6AY. R16B COMPLETION — PROPOSAL BODY AUTHORING FOUNDATION

**Status:** **R16B complete** (`589f5a0`). **Post-R16B validation passed** — code/test/source-of-truth + **authenticated Playwright MCP** visual verification; no P0/P1 blockers. **Naming:** **R16B ≠ §6AL R16 Proposals hub**. **R16B** = per-proposal draft body authoring foundation. **§6AL R16** Proposals hub (Draft/Sent/Won/Lost list) remains **not started**.

### 1. Scope completed

- **R16B** is complete and committed at **`589f5a0`**.
- **R16B is not the same as §6AL R16 Proposals hub.**
- **R16B** = per-proposal draft body authoring for text pages on persisted Builder path.
- **R16C** (proposed) = Builder authoring completion + page visibility foundation — **complete**: **R16C1** overflow navigation **complete** at `967f0de` (§6BA); **R16C2** token picker **complete** at `0cf76d2` (§6BB); **R16C3** page visibility **complete** at `25f1375` (§6BC).

### 2. R16B implementation commit and files changed

| Commit | Pass | Scope |
|--------|------|-------|
| `589f5a0` | **R16B** | Draft body page authoring foundation — pure editing helpers, draft-only store mutation, Builder edit UI, Estimate de-duplication; **no lifecycle enablement** |

**R16B changed exactly 14 app files (no docs/SQL/migrations/packages):**

- `app/lib/proposalBuilderDocumentIa.test.ts`
- `app/lib/proposalBuilderDocumentIa.ts`
- `app/lib/proposalBuilderPreview.ts`
- `app/lib/proposalBuilderPreview.test.ts`
- `app/lib/proposalPageContentEditing.test.ts`
- `app/lib/proposalPageContentEditing.ts`
- `app/lib/proposalRecordStore.test.ts`
- `app/lib/proposalRecordStore.ts`
- `app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderCustomerPage.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderEditableTextPage.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderPageEditor.tsx`
- `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts`

**Not in R16B:** Preview/Send/Sign/Payment enablement; PDF; customer preview route; token picker UI; page visibility/hide-show; page reorder; media/photos upload; Proposals hub; pricing engine/snapshot math changes; `refreshDraftPricing` behavior changes; R15 cover VM logic changes; R14 body renderer logic changes; R13 token resolver/registry changes; Job Card / Jobs Board / Templates UI changes; SQL/migrations/packages; legacy `RoofingClient` PDF; `estimateStore` reuse on DB proposals; `customer_title` edit; reset-from-template action.

### 3. Behavior added / changed

- Adds **per-proposal draft body authoring** for **`project_overview`**, **`terms`**, **`warranty`**, and **`custom_text`** page types.
- New pure helper: **`proposalPageContentEditing.ts`** — editable type guards, body markdown normalization, `content_json` patch, change detection.
- New draft-only store mutation: **`updateDraftProposalPageContent`** — validates draft status, company, page on current draft version, editable page type; writes only `proposal_pages.content_json.body_markdown` + `updated_at`; appends `draft_saved` event `{ page_id, field: "body_markdown" }`.
- **Saves raw `body_markdown` only** — rendered token output is **never** persisted.
- **R14 display-time token merge** remains the **only** rendered output path (read view + optional edit merge preview).
- Builder edit UI: **Edit / Save / Cancel** in **contractor workspace chrome** (not customer document content).
- **Local merge preview** under textarea is **display-only** (same R14 renderer path against local buffer).
- **Dirty navigation:** confirm/block when switching page strip tabs with unsaved edits — does not silently discard.
- **Estimate canvas de-duplication:** on persisted proposal path, **`filterSectionsForEstimateCanvas`** keeps only **`line_items`** and **`upgrade_group`** sections.
- **Estimate no longer renders** Project Overview / Terms / Warranty / Custom Text prose from template graph.
- **`proposal_pages`** is now the **authoritative source** for text/prose pages on the persisted Builder path.
- **Cover R15 VM unchanged.** **R14 body renderer unchanged.** **Pricing/snapshot/`refreshDraftPricing` unchanged.**
- **Preview / Send / Sign / Payment remain disabled.**

### 4. Source-of-truth guardrails

| Surface | Rule |
|---------|------|
| **Text page job-specific edits** | Write **only** `proposal_pages.content_json.body_markdown` via `updateDraftProposalPageContent` |
| **Template rows** | **Do not mutate** `proposal_templates` / `proposal_template_sections` from Builder body edits |
| **`context_echo`** | **Do not mutate** from Builder body edits |
| **Pricing / lifecycle** | **Do not mutate** options, lines, snapshots, pricing fields, lifecycle fields, page order, or `visible_to_customer` from body edits |
| **Customer document read view** | Raw `body_markdown` + frozen **`proposalDocumentContext`** + **R14** `renderProposalDocumentPageBody` |
| **Estimate page** | Owns **pricing / line-item display only** on persisted path |
| **Text/prose pages** | Own **document prose** via `proposal_pages` + R14 renderer |

**Not built yet (explicit deferrals):**

- **Token picker** — **addressed in R16C2** (`0cf76d2`, §6BB) — registry-driven Insert field menu; raw `{{token}}` insert; R14 display-time merge preserved.
- **Page visibility / hide-show** — **addressed in R16C3** (`25f1375`, §6BC) — DB-backed `visible_to_customer` toggle; hidden pages remain contractor-visible in Builder; R17 contract helper `getCustomerPreviewPages` only.
- **Custom Text overflow navigation** — **addressed in R16C1** (`967f0de`, §6BA) — More pages menu; Scope notes reachable.
- **Media / photos / PDF / report pages** — placeholder panels only.
- **Preview / customer route** — not built.

### 5. Protected systems unchanged

- **No** docs/SQL/migrations/packages in R16B code commit.
- **No** pricing engine changes.
- **No** proposal snapshot builder changes.
- **No** `refreshDraftPricing` behavior changes (edited body text preserved — tested).
- **No** payment/approval/status/send/PDF changes.
- **No** Job Card / Jobs Board / Templates UI changes.
- **No** R14 body renderer module changes.
- **No** R15 cover view model module changes.
- **Preview / Send / Sign / Payment remain disabled.**

### 6. R16B validation (at `589f5a0`)

**Verdict:** **Proceed.** **No P0/P1 blockers.**

| Check | Result |
|-------|--------|
| R16B committed 14 app files only | **Pass** |
| No docs/SQL/migrations/packages in R16B commit | **Pass** |
| Pre-commit test suite | **363/363** pass |
| Whole-app audit suite (later) | **370/370** pass |
| `npx tsc --noEmit` | Only **6** known `RoofingClientV2.tsx` errors |

**Authenticated Playwright** (storageState: `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`; draft `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`):

| Check | Result |
|-------|--------|
| Builder opens without login redirect | **Pass** |
| Default tab Estimate | **Pass** |
| Strip order correct | **Pass** |
| Project Overview edit/save/cancel | **Pass** |
| Terms edit/save | **Pass** |
| Warranty edit/save | **Pass** |
| Read view uses R14 merged display | **Pass** |
| Raw `{{token}}` remains raw in edit textarea | **Pass** |
| Rendered token output not persisted | **Pass** |
| Estimate no duplicated prose | **Pass** |
| Cover unchanged (R15) | **Pass** |
| Header / rail unchanged | **Pass** |
| Preview / Send / Sign / Payment disabled | **Pass** |
| Mobile ~390px — no horizontal overflow (incl. edit mode) | **Pass** |

**Known non-blockers (post-R16B):**

| Item | Priority | Notes |
|------|----------|-------|
| **Custom Text behind `+1` overflow — no navigation UI** | P2 | **Addressed in R16C1** (`967f0de`, §6BA) — More pages menu; Scope notes reachable |
| **Transient RSC/fetch console behavior** | P3 | Observed during multi-route Playwright sweep; no functional impact |
| **Stamped draft audit marker text** | P3 | Prior Playwright edit tests may have left `R16B-AUDIT-*` markers on test draft |

### 7. Naming guardrails

| Label | Meaning | Status |
|-------|---------|--------|
| **R16A** | Builder chrome / customer document IA separation | **Complete** at `18cebca` (§6AX) |
| **R16B** | Proposal body authoring foundation | **Complete** at `589f5a0` (§6AY) |
| **R16C** | Proposed Builder authoring completion + page visibility foundation | **Complete** — **R16C1** overflow navigation **complete** at `967f0de` (§6BA); **R16C2** token picker **complete** at `0cf76d2` (§6BB); **R16C3** page visibility **complete** at `25f1375` (§6BC) |
| **§6AL R16** | Future Proposals hub / Draft-Sent-Won-Lost lifecycle module | **Not started** — distinct from R16A/B/C |

### 8. Next-stage guidance (historical — superseded by §6AZ)

**Do not start R17 Preview, PDF, lifecycle (R17–R20), or §6AL R16 hub without explicit approval.** See **§6AZ** for whole-app audit findings; **§6BD** for R16C final audit verdict and R17 planning gate.

---

## 6AZ. WHOLE-APP ROOFR-ALIGNED AUDIT AFTER R16B

**Audit date:** **2026-06-18**. **Code checkpoint audited:** **`589f5a0`**. **Docs checkpoint at audit time:** **`e5dd2fb`** (R16A — lagged R16B until this docs commit).

### 1. Executive verdict

- **Proceed.** No P0/P1 blockers.
- **No implementation to stop or revert.**
- **Working tree clean** at audit time.
- **App-wide proposal spine is credible and DB-first** (Job Board → Job Card → catalog/templates gates → draft create → Builder → frozen context → customer document surfaces).
- **R16B body authoring is valid** — raw persist + R14 display merge preserved.
- **Estimate prose duplication is resolved** on persisted Builder path (R16B de-duplication).
- **Lifecycle remains locked** (Preview/Send/Sign/Payment disabled on DB spine).

### 2. Source selection

| Role | Source |
|------|--------|
| **Primary Roofr evidence** | **Roofr / FieldDive Proposal Flow Research — Live Web Addendum** (Help Center, Academy, roofr.com product/blog — live/public web) |
| **Secondary FieldDive mapping** | **Comprehensive Roofr / FieldDive Proposal Flow Research Report** — FieldDive mapping only; **not** used for Roofr behavior claims |
| **Tertiary** | **`docs/fielddive-global-handoff.md`** — checkpoints, guardrails, stage history |

**Evidence limits:** No Roofr screenshots in repo; Roofr plan gating not fully enumerated; page order in Roofr is drag-reorder + hide (not fixed global order); payment-at-signature vs separate invoice workflow medium confidence.

### 3. Audit results summary

| Layer | Result |
|-------|--------|
| Tests | **370/370** pass (whole-app audit suite) |
| TypeScript | Only **6** known `RoofingClientV2.tsx` errors |
| Playwright whole-flow | **Pass** — root/marketing, Jobs Board, Job Card, Builder, Cover, Project Overview, Estimate, Terms, Warranty, Photos placeholder, Catalog, Templates, Settings branding, mobile 390px |
| Protected systems | **No regressions** — pricing engine, snapshot builder, quantity resolver, pricing trust/staleness, `refreshDraftPricing`, approval, status, payment, send/PDF, `estimateStore`, RoofingClient PDF, legacy saved estimates, Job Card gates, Templates, Jobs Board |

### 4. Whole-app flow assessment (abbreviated)

| Area | Status |
|------|--------|
| Job Board (DB-primary + legacy partition) | **Implemented** |
| Job Card → create/open proposal | **Aligned** with live-web Roofr job-card path |
| Catalog / Templates setup | **Implemented** |
| Settings branding | **Implemented** |
| Builder document-first + default Estimate | **Aligned** |
| R16B text page authoring | **Implemented** |
| Estimate line-items-only (persisted path) | **Aligned** — duplication resolved |
| Photos / Add Page / Preview / lifecycle | **Placeholder by design** |
| Legacy send/approve/payment on estimates | **Isolated parallel spine** — handle carefully at R18–R20 bridge |

### 5. P2 findings (important partials — fix before Preview or next Builder stage)

| Finding | App area | Fix before next impl? |
|---------|----------|----------------------|
| **`+1` strip overflow not navigable; Custom Text unreachable** | Builder strip | **Addressed in R16C1** (`967f0de`, §6BA) |
| **No token picker; manual `{{token}}` only** | Builder authoring | **Addressed in R16C2** (`0cf76d2`, §6BB) |
| **No page visibility / hide-show** | Builder pages | **Addressed in R16C3** (`25f1375`, §6BC) |
| **Project Photos / media placeholder** | Builder pages | Before R17 Preview |
| **Dual legacy estimate send/approve/payment spine** | Board / RoofingClient / APIs | At lifecycle bridge (R18–R20) |
| **Docs lagged R16B until this checkpoint** | Handoff | **Yes** — this commit |

### 6. P3 findings (polish / documented limitations)

| Finding | Notes |
|---------|-------|
| Stamped draft audit marker text | Test residue on stamped draft |
| Templates copy references “Builder later” | Stale footnote in Templates workspace |
| Transient console/RSC/fetch during route sweep | Non-blocking |
| Marketing “Real approvals” copy | May imply lifecycle DB proposals lack |
| Builder nav may highlight Templates | Minor IA drift |
| “Preview based on your company pricing” / “Read-only preview” copy | Can tighten later |

### 7. Recommended next code stage (planning only — not started)

**R16C — Builder authoring completion + page visibility foundation** (proposed working name; not yet in §6AL table).

Likely scope (in order):

1. **Strip overflow navigation** — **Complete** at **`967f0de`** (§6BA) — More pages menu; Scope notes / Custom Text reachable.
2. **Token picker** — **Complete** at **`0cf76d2`** (§6BB) — Insert field in R16B editor; raw `{{token}}` insert; R14 display-time merge preserved.
3. **Page visibility / hide-show foundation** — **Complete** at **`25f1375`** (§6BC) — DB-backed `visible_to_customer` toggle; hidden indicators + contractor banner; hidden pages remain in Builder.
4. Preserve: raw `body_markdown` persistence; R14 renderer; Preview/Send/Sign/Payment **disabled**.

**Do not start yet:**

- **R17** Preview / customer route
- **R18** PDF / Send
- **R19** Sign
- **R20** Payment
- **§6AL R16** Proposals hub
- Media upload UI (unless explicitly scoped)
- Legacy RoofingClient PDF reuse on DB proposals
- `estimateStore` reuse on DB proposals
- Pricing / snapshot / `refreshDraftPricing` changes

---

## 6BA. R16C1 COMPLETION — BUILDER STRIP OVERFLOW PAGE NAVIGATION

**Status:** **R16C1 complete** (`967f0de`). **Post-R16C1 browser audit after portal fix passed** — full functional verification; no P0/P1 blockers. **Naming:** **R16C1 ≠ §6AL R16 Proposals hub**. **R16C1** = Builder strip overflow page navigation (first slice of proposed **R16C** program). **§6AL R16** Proposals hub (Draft/Sent/Won/Lost list) remains **not started**.

### 1. Scope completed

- **R16C1** is complete and committed at **`967f0de`**.
- **R16C1 is not the same as §6AL R16 Proposals hub.**
- **R16C1** = Builder strip overflow page navigation — More pages menu for persisted overflow proposal pages.
- **R16C program status:** **R16C1** overflow navigation **complete**; **R16C2** token picker **complete** at `0cf76d2` (§6BB); **R16C3** page visibility **complete** at `25f1375` (§6BC).

### 2. R16C1 implementation commit and files changed

| Commit | Pass | Scope |
|--------|------|-------|
| `967f0de` | **R16C1** | Builder strip overflow page navigation — More pages menu, overflow routing by `page.id`, portal menu fix; **no lifecycle enablement** |

**R16C1 changed exactly 6 app files (no docs/SQL/migrations/packages):**

- `app/lib/proposalBuilderDocumentIa.ts`
- `app/lib/proposalBuilderNavigation.ts`
- `app/lib/proposalBuilderNavigation.test.ts`
- `app/tools/roofing/proposals/builder/ProposalBuilderPageContextStrip.tsx`
- `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts`
- `app/tools/roofing/proposals/builder/ProposalBuilderOverflowMenu.tsx` (**new**)

**Not in R16C1:** Preview/Send/Sign/Payment enablement; PDF; customer preview route; token picker UI; page visibility/hide-show; page reorder; media/photos upload; Proposals hub; pricing engine/snapshot math changes; `refreshDraftPricing` behavior changes; R15 cover VM logic changes; R14 body renderer logic changes; `updateDraftProposalPageContent` / store changes; Job Card / Jobs Board / Templates UI changes; SQL/migrations/packages; legacy `RoofingClient` PDF; `estimateStore` reuse on DB proposals; template/context_echo mutation.

### 3. Behavior added / changed

- Replaced dead/non-functional **`+N` overflow badge** with first-class **More pages** menu in Builder workspace chrome.
- **More pages** lists all persisted **overflow** proposal pages from the pure navigation model (`overflowPages`).
- Overflow navigation uses persisted **`proposal_pages.id`** / **`page.id`** — same `BuilderPageContextId` as primary strip pages.
- **Scope notes** (`custom_text` on stamped audit draft) is now reachable from More pages.
- Overflow page selection routes through existing **`onSelectPageContext`** → **`handleSelectPageContext`** — **R16B dirty-edit guard preserved**.
- **No** parallel `selectedOverflowPageId` state.
- **No** `custom_text` hardcoding — any overflow persisted page type supported.
- **Active overflow page** updates trigger label (e.g. **Scope notes** instead of generic More pages + count).
- **Primary strip IA unchanged:**
  **Cover → Project overview → Estimate → Terms → Warranty → Project Photos → More pages → Add Page**
- **Add Page** remains disabled (Soon).
- **Preview / Send / Sign / Payment remain disabled.**

### 4. Important browser fix (portal menu)

**Initial implementation issue:** Menu opened in React state but was **not visibly usable** — menu was **clipped** by strip `overflow-x-auto` (which also computed `overflow-y: auto`).

| Aspect | Before fix | After fix |
|--------|------------|-----------|
| Menu positioning | `absolute` inside scroll/overflow strip | **Portaled to `document.body`** with **`position: fixed`** from trigger `getBoundingClientRect()` |
| Strip shell | Single `overflow-x-auto` nav | Shell **without overflow**; primary tabs in inner **`BUILDER_PAGE_STRIP_SCROLL`** row |
| More pages + Add Page | Inside scroll container | **`shrink-0`** controls **outside** inner scroll row |
| Outside click | mousedown listener | Deferred **`pointerdown`** listener; closes on outside click and item selection |

**390px viewport:** verified — no horizontal page overflow; More pages trigger reachable.

### 5. Source-of-truth guardrails

| Surface | Rule |
|---------|------|
| **Overflow navigation** | Read-only routing — sets `activePageContextId` to persisted `page.id` only |
| **Store / DB** | **No new writes** — navigation-only UI |
| **Dirty edit guard** | Reuses **R16B** `handleSelectPageContext` — no bypass |
| **Primary strip IA** | **Unchanged** — R16A customer-logical order preserved |

**Not built yet (explicit deferrals):**

- **R16C2 token picker** — **complete** at `0cf76d2` (§6BB).
- **R16C3 page visibility / hide-show** — **complete** at `25f1375` (§6BC).
- **Preview / customer route** — not built (**R17 planning only** — §6BD).
- **Media / photos / PDF / report pages** — placeholder panels only.

### 6. Protected systems unchanged

- **No** docs/SQL/migrations/packages in R16C1 code commit.
- **No** `proposalRecordStore` / store changes.
- **No** pricing engine / snapshot builder / `refreshDraftPricing` changes.
- **No** R14 body renderer / R15 cover VM changes.
- **No** payment/approval/status/send/PDF changes.
- **No** template / `context_echo` mutation.
- **Preview / Send / Sign / Payment remain disabled.**

### 7. R16C1 validation (at `967f0de`)

**Verdict:** **Proceed.** **No P0/P1 blockers.**

| Check | Result |
|-------|--------|
| R16C1 committed 6 app files only | **Pass** |
| No docs/SQL/migrations/packages in R16C1 commit | **Pass** |
| Relevant test suites (navigation, IA, R16B-adjacent, readiness, safety) | **167/167** pass |
| `npx tsc --noEmit` | Only **6** known `RoofingClientV2.tsx` errors |

**Authenticated Playwright — full browser audit after portal fix** (storageState: `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`; draft `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`):

| Check | Result |
|-------|--------|
| Builder opens without login redirect | **Pass** |
| Primary strip order correct (incl. More pages before Add Page) | **Pass** |
| More pages opens **visible** menu | **Pass** |
| Menu lists Scope notes / Custom text | **Pass** |
| Clicking Scope notes opens Custom Text page | **Pass** |
| Active trigger label = Scope notes | **Pass** |
| Outside click closes menu | **Pass** |
| Item selection closes menu | **Pass** |
| Dirty guard Terms → Scope notes (dismiss + accept) | **Pass** |
| Dirty guard Scope notes → Terms (dismiss) | **Pass** |
| Estimate line-items-only — no prose duplication | **Pass** |
| Preview / Send / Sign / Payment disabled | **Pass** |
| Mobile ~390px — no horizontal overflow | **Pass** |
| **0** functional console errors | **Pass** |

**Known non-code note (not a git issue):**

The stamped audit draft still contains **`"Saved R16C1 marker text."`** on the Scope notes overflow page from an earlier browser save test. Optional restore: Builder → More pages → Scope notes → Edit → replace body with `Final scope, quantities, and schedule should be confirmed by the contractor before work begins.` → Save.

### 8. Naming guardrails

| Label | Meaning | Status |
|-------|---------|--------|
| **R16A** | Builder chrome / customer document IA separation | **Complete** at `18cebca` (§6AX) |
| **R16B** | Proposal body authoring foundation | **Complete** at `589f5a0` (§6AY) |
| **R16C1** | Builder strip overflow page navigation | **Complete** at `967f0de` (§6BA) |
| **R16C2** | Document token picker in R16B editor | **Complete** at `0cf76d2` (§6BB) |
| **R16C3** | Proposed page visibility / hide-show foundation | **Complete** at `25f1375` (§6BC) |
| **§6AL R16** | Future Proposals hub / Draft-Sent-Won-Lost lifecycle module | **Not started** — distinct from R16A/B/C |

### 9. Next-stage guidance (historical — superseded by §6BB)

**Do not start R16C3 implementation until explicitly approved.**

**Do not start Preview / PDF / lifecycle (R17–R20) automatically** — R17 remains blocked until R16C3 is properly scoped/completed.

**Do not start §6AL R16 Proposals hub, media/photos upload, or pricing/snapshot changes without explicit scope.**

**Recommended immediate next (historical at R16C1 docs time; superseded by §6BB):**

| Option | Focus |
|--------|--------|
| ~~**R16C2 planning only**~~ | **Complete** at `0cf76d2` (§6BB) — document token picker in R16B editor |

**Continue preserving:**

- Preview / Send / Sign / Payment **disabled**
- Frozen **`proposalDocumentContext`** for customer document surfaces
- Raw `body_markdown` persistence + R14 display merge only
- Pricing trust + snapshot safety
- Single `activePageContextId` navigation model (no parallel overflow state)

---

## 6BB. R16C2 COMPLETION — DOCUMENT TOKEN PICKER IN R16B EDITOR

**Status:** **R16C2 complete** (`0cf76d2`). **Pre-commit audit passed** — code/test/source-of-truth + authenticated Playwright browser verification; no P0/P1 blockers. **Naming:** **R16C2 ≠ §6AL R16 Proposals hub**. **R16C2** = registry-driven document token picker inside the existing R16B text editor (second slice of proposed **R16C** program). **§6AL R16** Proposals hub (Draft/Sent/Won/Lost list) remains **not started**.

### 1. Scope completed

- **R16C2** is complete and committed at **`0cf76d2`**.
- **R16C2 is not the same as §6AL R16 Proposals hub.**
- **R16C2** = registry-driven document token picker in the R16B editor — Insert field control for persisted text pages.
- **R16C program status:** **R16C1** overflow navigation **complete** at `967f0de` (§6BA); **R16C2** token picker **complete** at `0cf76d2` (§6BB); **R16C3** page visibility **complete** at `25f1375` (§6BC).

### 2. R16C2 implementation commit and files changed

| Commit | Pass | Scope |
|--------|------|-------|
| `0cf76d2` | **R16C2** | Registry-driven document token picker in R16B editor — raw `{{token}}` insert only; portaled menu; R14 merge preview unchanged; **no lifecycle enablement** |

**R16C2 changed exactly 6 app files (no docs/SQL/migrations/packages):**

- `app/lib/proposalDocumentTokenPicker.ts` (**new**)
- `app/lib/proposalDocumentTokenPicker.test.ts` (**new**)
- `app/tools/roofing/proposals/builder/ProposalBuilderTokenPickerMenu.tsx` (**new**)
- `app/tools/roofing/proposals/builder/ProposalBuilderPageEditor.tsx`
- `app/lib/proposalBuilderDocumentIa.ts`
- `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts`

**Not in R16C2:** Preview/Send/Sign/Payment enablement; PDF; customer preview route; page visibility/hide-show; page reorder; media/photos upload; Proposals hub; pricing engine/snapshot math changes; `refreshDraftPricing` behavior changes; R15 cover VM logic changes; R14 body renderer logic changes; R13 registry/resolver semantics changes; `proposalRecordStore` / store changes; Job Card / Jobs Board / Templates UI changes; SQL/migrations/packages; legacy `RoofingClient` PDF; `estimateStore` reuse on DB proposals; template/context_echo mutation.

### 3. Behavior added / changed

- **Insert field** control appears in **R16B edit mode only** — editor chrome above the textarea (not customer read surface).
- Menu heading: **Document fields**.
- Picker model **`proposalDocumentTokenPicker.ts`** derives from existing **R13 token registry** — not a hardcoded UI-only token list.
- **19 body-text tokens** available, grouped by domain: Company, Customer, Job, Measurement, Proposal, Selected package, Pricing.
- **Cover/styling-only tokens excluded** from body-text picker: `company_logo_url`, `brand_primary_color`, `brand_secondary_color`, `show_license_on_cover`.
- **Pricing tokens** (`proposal_total`, `selected_package_total`) remain **insertable** with hint when pricing incomplete: *Preview hidden until pricing is complete.*
- Clicking a token inserts canonical raw lowercase snake_case placeholder only, e.g. **`{{customer_name}}`** — **never** resolved/rendered values.
- Menu closes on token click; focus returns to textarea with cursor after inserted token.
- Selected text replacement and cursor insertion supported via pure `insertTextAtCursor` helper.
- Unfocused textarea: insert at end of document.
- **Merge preview** updates immediately through existing **R14** `renderProposalDocumentPageBody` path on local draft.
- **Save** still persists raw **`body_markdown` only** via existing **R16B** `updateDraftProposalPageContent` — unchanged.
- Manual custom/malformed tokens remain manually typable in textarea.
- **Dirty-edit guard** preserved — token insertion routes through `onDraftBodyChange` only; no parallel draft/token state in Client.
- **Portaled menu** to `document.body` with fixed positioning (R16C1 overflow menu pattern) — not clipped by canvas/strip overflow.
- **Preview / Send / Sign / Payment remain disabled.**

### 4. Architecture (picker model)

| Layer | Role |
|-------|------|
| **R13 registry** | Canonical token names, domains, availability — unchanged |
| **`proposalDocumentTokenPicker.ts`** | Presentation metadata, domain grouping, body surface filter, placeholder format, insertion helpers |
| **`ProposalBuilderTokenPickerMenu.tsx`** | Portaled Insert field UI |
| **`ProposalBuilderPageEditor.tsx`** | Textarea ref, insert wiring, merge preview (existing R14 path) |

**Token coverage test:** every available registry token is either included for `body_text` surface or explicitly excluded with reason (`cover_styling`).

### 5. Source-of-truth guardrails

| Surface | Rule |
|---------|------|
| **Token insertion** | Raw `{{token_name}}` placeholders only — never rendered output |
| **Persistence** | `proposal_pages.content_json.body_markdown` stores raw text including tokens |
| **Display merge** | **R14 only** — read view + edit merge preview |
| **Registry** | **R13** remains source of supported tokens — picker does not invent tokens |
| **Store / DB** | **No new writes** beyond existing R16B body save path |
| **Templates / context_echo** | **Not mutated** from picker |

### 6. Protected systems unchanged

- **No** docs/SQL/migrations/packages in R16C2 code commit.
- **No** `proposalRecordStore` changes.
- **No** pricing engine / snapshot builder / `refreshDraftPricing` changes.
- **No** R14 body renderer / R15 cover VM changes.
- **No** R13 registry/resolver semantics changes.
- **No** payment/approval/status/send/PDF changes.
- **No** template / `context_echo` mutation.
- **Preview / Send / Sign / Payment remain disabled.**

### 7. R16C2 validation (at `0cf76d2`)

**Verdict:** **Proceed.** **No P0/P1 blockers.**

| Check | Result |
|-------|--------|
| R16C2 committed 6 app files only | **Pass** |
| No docs/SQL/migrations/packages in R16C2 commit | **Pass** |
| Pre-commit audit | **Pass** |
| Combined relevant test suites | **103/103** pass |
| `npx tsc --noEmit` | Only **6** known `RoofingClientV2.tsx` errors |

**Authenticated Playwright — browser audit** (storageState: `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`; draft `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`):

| Check | Result |
|-------|--------|
| Builder opens without login redirect | **Pass** |
| Project Overview edit mode shows Insert field | **Pass** |
| Insert field opens **visible** menu (not clipped) | **Pass** |
| Token domain groups appear | **Pass** |
| Insert `{{customer_name}}` → raw in textarea | **Pass** |
| Merge preview resolves customer name | **Pass** |
| Save/reload/edit → source remains raw token | **Pass** |
| Read view renders merged value | **Pass** |
| More pages → Scope notes still works | **Pass** |
| Insert field works on Scope notes | **Pass** |
| Dirty guard after token insert without save | **Pass** |
| Estimate line-items-only — no prose duplication | **Pass** |
| Preview / Send / Sign / Payment disabled | **Pass** |
| Mobile ~390px — token menu usable; no horizontal page overflow | **Pass** (in edit mode) |
| **0** functional console errors | **Pass** |

**Known DB draft residue (not git issues):**

| Page | Residue | Optional restore |
|------|---------|------------------|
| **Project overview** | Appended **`{{customer_name}}`** from R16C2 browser save test | Edit → remove trailing `{{customer_name}}` → Save |
| **Scope notes** | **`Saved R16C1 marker text.`** from R16C1 browser save test | More pages → Scope notes → Edit → replace with `Final scope, quantities, and schedule should be confirmed by the contractor before work begins.` → Save |

**Known follow-up / non-blocker:**

At **390px cold load**, strip tab clicks may hit a **pre-existing More pages overlap/tap-target issue** from **R16C1** strip layout — **R16C2 did not cause or worsen it**. Token picker menu itself is usable at 390px once in edit mode. Track as **Builder strip mobile polish** — likely before or during **R16C3**; **do not fix in R16C2**.

### 8. Naming guardrails

| Label | Meaning | Status |
|-------|---------|--------|
| **R16A** | Builder chrome / customer document IA separation | **Complete** at `18cebca` (§6AX) |
| **R16B** | Proposal body authoring foundation | **Complete** at `589f5a0` (§6AY) |
| **R16C1** | Builder strip overflow page navigation | **Complete** at `967f0de` (§6BA) |
| **R16C2** | Document token picker in R16B editor | **Complete** at `0cf76d2` (§6BB) |
| **R16C3** | Proposed page visibility / hide-show foundation | **Complete** at `25f1375` (§6BC) |
| **§6AL R16** | Future Proposals hub / Draft-Sent-Won-Lost lifecycle module | **Not started** — distinct from R16A/B/C |

### 9. Next-stage guidance (historical — superseded by §6BC)

**Do not start R16C3 implementation until explicitly approved.** *(R16C3 is now complete at `25f1375` — see §6BC.)*

**Do not start Preview / PDF / lifecycle (R17–R20) automatically** — **R17 remains planning-only** until R16C final audit passes and R17 is explicitly scoped.

**Do not start §6AL R16 Proposals hub, media/photos upload, or pricing/snapshot changes without explicit scope.**

**Recommended immediate next (historical at R16C2 docs time; superseded by §6BC):**

| Option | Focus |
|--------|--------|
| ~~**R16C3 planning only**~~ | **Complete** at `25f1375` (§6BC) — page visibility / hide-show foundation |

**Continue preserving:**

- Preview / Send / Sign / Payment **disabled**
- Frozen **`proposalDocumentContext`** for customer document surfaces
- Raw `body_markdown` persistence + R14 display merge only
- Pricing trust + snapshot safety
- Single `activePageContextId` navigation model (no parallel overflow state)
- Insert field inserts raw tokens only — never rendered output
- Visibility toggles persist independently of body Save/Cancel — never mutate `body_markdown` from visibility path

---

## 6BC. R16C3 COMPLETION — PAGE VISIBILITY / HIDE-SHOW FOUNDATION

**Status:** **R16C3 complete** (`25f1375`). **Pre-commit audit passed** — code/test/source-of-truth + authenticated Playwright browser verification; no P0/P1 blockers. **Naming:** **R16C3 ≠ §6AL R16 Proposals hub**. **R16C3** = DB-backed proposal page customer visibility toggle in Builder (third slice of proposed **R16C** program). **§6AL R16** Proposals hub (Draft/Sent/Won/Lost list) remains **not started**. **R17 Preview not started.**

### 1. Scope completed

- **R16C3** is complete and committed at **`25f1375`**.
- **R16C3 is not the same as §6AL R16 Proposals hub.**
- **R16C3** = page visibility / hide-show foundation — contractor toggles `proposal_pages.visible_to_customer` on persisted draft pages.
- **R16C program status:** **R16C1** overflow navigation **complete** at `967f0de` (§6BA); **R16C2** token picker **complete** at `0cf76d2` (§6BB); **R16C3** page visibility **complete** at `25f1375` (§6BC). **R16C final whole-Builder audit passed** (§6BD).

### 2. R16C3 implementation commit and files changed

| Commit | Pass | Scope |
|--------|------|-------|
| `25f1375` | **R16C3** | Page visibility hide-show foundation — `updateDraftProposalPageVisibility`; hidden indicators + contractor banner; hidden pages remain in Builder nav; **no lifecycle enablement** |

**R16C3 changed exactly 14 app files (no docs/SQL/migrations/packages):**

- `app/lib/proposalPageVisibilityEditing.ts` (**new**)
- `app/lib/proposalPageVisibilityEditing.test.ts` (**new**)
- `app/tools/roofing/proposals/builder/ProposalBuilderPageVisibilityControl.tsx` (**new**)
- `app/lib/proposalRecordStore.ts`
- `app/lib/proposalRecordStore.test.ts`
- `app/lib/proposalBuilderDocumentIa.ts`
- `app/lib/proposalBuilderNavigation.ts`
- `app/lib/proposalBuilderNavigation.test.ts`
- `app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderEditableTextPage.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderPageContextStrip.tsx`
- `app/tools/roofing/proposals/builder/ProposalBuilderOverflowMenu.tsx`
- `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts`

**Not in R16C3:** Preview/Send/Sign/Payment enablement; PDF; customer preview route; R17 Preview UI; page reorder; media/photos upload; Proposals hub; pricing engine/snapshot math changes; `refreshDraftPricing` behavior changes; R15 cover VM logic changes; R14 body renderer logic changes; R13 registry/resolver semantics changes; token picker logic changes (picker still works on hidden pages); Job Card / Jobs Board / Templates UI changes; SQL/migrations/packages; legacy `RoofingClient` PDF; `estimateStore` reuse on DB proposals; template/context_echo mutation; `content_json.body_markdown` mutation from visibility path.

### 3. Behavior added / changed

- **DB-backed visibility toggle** using existing **`proposal_pages.visible_to_customer`** — **no SQL/migrations**.
- New pure policy module: **`proposalPageVisibilityEditing.ts`** — toggleable vs required vs deferred page types; visibility state labels; R17 contract helper **`getCustomerPreviewPages`** (filter `visible_to_customer === true` by `sort_order`).
- New UI control: **`ProposalBuilderPageVisibilityControl.tsx`** — eye/eye-off toggle in workspace chrome for persisted toggleable pages.
- New draft-only store mutation: **`updateDraftProposalPageVisibility`** — validates draft status, company, page on current draft version, toggleable page type; writes only **`visible_to_customer`** + **`updated_at`**; appends **`draft_saved`** event `{ page_id, field: "visible_to_customer", value }`; no-op when unchanged.
- **Hidden metadata** on Builder navigation items — **`customerVisible`** carried without filtering hidden pages from strip or overflow.
- **Hidden indicators** in primary page strip and **More pages** overflow row (eye-off icon + accessible label).
- **Contractor-only hidden banner** on hidden pages — **not** part of R14 body content.
- **Hidden pages remain visible and editable** in Builder — navigation does not filter them out.
- **Visibility toggles persist immediately** and **independently** of body Save/Cancel — body Cancel does not revert visibility; body Save does not change visibility.
- **Cover and Estimate cannot be hidden** — show **Required on the customer proposal.** notice instead of toggle.
- **Token picker still works** on hidden text pages (Insert field unchanged).
- **Add Page** remains disabled (Soon).
- **Preview / Send / Sign / Payment remain disabled.**

### 4. Toggle policy

**Toggleable page types:**

- `project_overview`
- `terms`
- `warranty`
- `custom_text`
- `photos`
- `pdf_attachment`

**Not toggleable:**

- `cover` — required on customer proposal
- `estimate` — required on customer proposal
- `signature` — deferred (R19)
- `payment_schedule` — deferred (R20)

### 5. R17 contract (planning only — not implemented)

- **`getCustomerPreviewPages`** in **`proposalPageVisibilityEditing.ts`** defines the future R17 Preview page-filter contract.
- Future **R17 Preview** should filter proposal pages by **`visible_to_customer === true`** (plus sort order).
- Hidden pages remain available in contractor Builder.
- **R17 is still not implemented** — no customer preview route, PDF, send, sign, or payment work was added.

### 6. Source-of-truth guardrails

| Surface | Rule |
|---------|------|
| **Visibility persistence** | Write **only** `proposal_pages.visible_to_customer` + `updated_at` via `updateDraftProposalPageVisibility` |
| **Body content** | **Not mutated** from visibility toggle path — `content_json.body_markdown` unchanged |
| **Templates / context_echo** | **Not mutated** from visibility path |
| **Pricing / lifecycle** | **Not mutated** — options, lines, snapshots, lifecycle fields unchanged |
| **Builder navigation** | Hidden pages **remain in nav** — contractor-only indicators; no customer Preview filtering in Builder |
| **R14 body renderer** | **Unchanged** — hidden banner is contractor workspace chrome, not body merge output |
| **Dirty edit guard** | **Preserved** — visibility toggle does not discard dirty body text; nav confirm still works |

### 7. Protected systems unchanged

- **No** docs/SQL/migrations/packages in R16C3 code commit.
- **No** pricing engine / snapshot builder / `refreshDraftPricing` changes.
- **No** R14 body renderer / R15 cover VM changes.
- **No** R13 registry/resolver semantics changes.
- **No** payment/approval/status/send/PDF changes.
- **No** template / `context_echo` mutation from visibility path.
- **Preview / Send / Sign / Payment remain disabled.**

### 8. R16C3 validation (at `25f1375`)

**Verdict:** **Proceed.** **No P0/P1 blockers.**

| Check | Result |
|-------|--------|
| R16C3 committed 14 app files only | **Pass** |
| No docs/SQL/migrations/packages in R16C3 commit | **Pass** |
| Pre-commit audit | **Pass** |
| Combined relevant test suites | **187/187** pass |
| `npx tsc --noEmit` | Only **6** known `RoofingClientV2.tsx` errors |

**Authenticated Playwright — browser audit** (storageState: `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`; draft `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`):

| Check | Result |
|-------|--------|
| Builder opens without login redirect | **Pass** |
| More pages → Scope notes still works | **Pass** |
| Insert field still works on visible page | **Pass** |
| Toggle Terms hidden | **Pass** |
| Hidden strip indicator appears | **Pass** |
| Hidden banner appears | **Pass** |
| Terms remains editable while hidden | **Pass** |
| Token picker works on hidden Terms | **Pass** |
| Reload; hidden state persists | **Pass** |
| Toggle Terms visible again | **Pass** |
| Toggle Scope notes hidden via More pages | **Pass** |
| Hidden indicator in More pages row | **Pass** |
| Scope notes remains editable while hidden | **Pass** |
| Toggle Scope notes visible again | **Pass** |
| Cover / Estimate cannot be hidden | **Pass** |
| Dirty body edit guard after visibility toggle | **Pass** |
| Visibility toggle does not discard dirty body text | **Pass** |
| Estimate line-items-only — no prose duplication | **Pass** |
| Preview / Send / Sign / Payment disabled | **Pass** |
| Mobile ~390px — no new horizontal page overflow | **Pass** (strip internal scroll/tap overlap remains known R16C1 issue) |
| **0** functional console errors | **Pass** |

**DB final state after audit (visibility restored; no body saves during R16C3 audit):**

| Item | State |
|------|-------|
| **Terms visibility** | **Visible** (restored) |
| **Scope notes visibility** | **Visible** (restored) |
| **Project overview body** | Trailing **`{{customer_name}}`** from R16C2 browser save test — unchanged |
| **Scope notes body** | **`Saved R16C1 marker text.`** from R16C1 browser save test — unchanged |

### 9. Naming guardrails

| Label | Meaning | Status |
|-------|---------|--------|
| **R16A** | Builder chrome / customer document IA separation | **Complete** at `18cebca` (§6AX) |
| **R16B** | Proposal body authoring foundation | **Complete** at `589f5a0` (§6AY) |
| **R16C1** | Builder strip overflow page navigation | **Complete** at `967f0de` (§6BA) |
| **R16C2** | Document token picker in R16B editor | **Complete** at `0cf76d2` (§6BB) |
| **R16C3** | Page visibility / hide-show foundation | **Complete** at `25f1375` (§6BC) |
| **R16C** | Builder authoring completion + page visibility program | **Complete** (R16C1 + R16C2 + R16C3) |
| **§6AL R16** | Future Proposals hub / Draft-Sent-Won-Lost lifecycle module | **Not started** — distinct from R16A/B/C |

### 10. Next-stage guidance (historical — superseded by §6BD)

**Do not start R17 Preview implementation until explicitly approved.**

**Do not start Preview / PDF / lifecycle (R17–R20) automatically** — **R17 remains planning-only** until R16C final whole-Builder audit passes. *(Audit now passed — see §6BD.)*

**Do not start §6AL R16 Proposals hub, media/photos upload, or pricing/snapshot changes without explicit scope.**

**Recommended immediate next (historical at R16C3 docs time; superseded by §6BD):**

| Option | Focus |
|--------|--------|
| ~~**R16C final whole-Builder audit**~~ | **Passed** (§6BD) — 2026-06-18 |
| **R17 planning only** | Customer Preview contract — use `getCustomerPreviewPages`; filter by `visible_to_customer`; **no implementation** until explicitly scoped |

**Continue preserving:**

- Preview / Send / Sign / Payment **disabled**
- Frozen **`proposalDocumentContext`** for customer document surfaces
- Raw `body_markdown` persistence + R14 display merge only
- Pricing trust + snapshot safety
- Single `activePageContextId` navigation model (no parallel overflow state)
- Insert field inserts raw tokens only — never rendered output
- Visibility toggles independent of body Save/Cancel

---

## 6BD. R16C FINAL WHOLE-BUILDER AUDIT BEFORE R17 PLANNING

**Historical context:** This section records the R16C final audit that gated R17 planning. **For current resume state, read §6BF** — R17C1 Preview Estimate document presentation layer is **complete** at **`9c2244a`** (R17A/R17B foundation at **`8ac2bcb`**, §6BE).

**Audit date:** **2026-06-18**. **Code checkpoint audited:** **`25f1375`**. **Docs checkpoint at audit time:** **`333da7c`**. **Audit type:** Final integrated whole-Builder audit — **R16C1** overflow navigation + **R16C2** token picker + **R16C3** page visibility together. **No code changes during audit.** **Working tree clean before and after audit.**

### 1. Executive verdict

- **Proceed to R17 planning only.**
- **No P0/P1 blockers.**
- **R16C is complete and stable** as a Builder foundation.
- **R17 Preview implementation remains blocked** until R17 is explicitly scoped and approved.
- **No Preview / Send / Sign / Payment / PDF / customer route / lifecycle enablement** from R16C.

### 2. R16C foundation confirmed

| Slice | Commit | Role | Status |
|-------|--------|------|--------|
| **R16C1** | `967f0de` (§6BA) | Builder strip overflow / More pages navigation | **Stable** |
| **R16C2** | `0cf76d2` (§6BB) | Registry-driven document token picker in R16B editor | **Stable** |
| **R16C3** | `25f1375` (§6BC) | DB-backed page visibility / hide-show foundation | **Stable** |

**R16C1 + R16C2 + R16C3 work together** as a coherent Proposal Builder surface without source-of-truth drift.

### 3. Automated validation

| Check | Result |
|-------|--------|
| R16C core + broader proposal batch | **298/298** pass |
| Includes `proposalPageVisibilityEditing`, `proposalRecordStore` (incl. `refreshDraftPricing`), `proposalBuilderNavigation`, `proposalDocumentTokenPicker`, `proposalPageContentEditing`, R14 body renderer, R15 cover VM, snapshot builder | **Pass** |
| Working tree before audit | **Clean** at `333da7c` / `25f1375` |
| Working tree after audit | **Clean** — no files changed |

**Stamped audit draft:** `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`. **Playwright auth:** `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`.

### 4. Authenticated browser audit (integrated R16C)

**Verdict:** **Pass.** **Functional console errors: 0.**

| Area | Confirmations |
|------|----------------|
| **Builder load** | Authenticated load; no redirect; workspace vs live job context distinction intact |
| **Primary strip** | Cover, Project overview, Estimate, Terms, Warranty, Project Photos, More pages, Add Page present; **Add Page disabled** |
| **R16C1 overflow** | More pages opens; Scope notes / Custom text listed; Scope notes opens; overflow trigger updates; menu usable after navigate away/back; hidden indicator in More pages when page hidden |
| **R16C2 token picker** | Insert field in edit mode; menu visible and not clipped (desktop); all domain groups (Company, Customer, Job, Measurement, Proposal, Selected package, Pricing); raw `{{token_name}}` in textarea only; merge preview resolves via R14; dirty state triggered; rendered values **not** inserted into textarea; works on hidden pages |
| **R16C3 visibility** | Hide/show Terms and Scope notes; strip + More pages hidden indicators; contractor-only hidden banner; hidden pages remain editable; reload persists; Cover/Estimate show required notice only — **cannot hide** |
| **Dirty guard** | Unsaved body text survives visibility toggle; nav confirm dialog on leave; dismiss stays with dirty text; accept navigates and discards unsaved body; visibility independent of body Save/Cancel |
| **Estimate / pricing** | Line-items-only; no Terms/Warranty/Overview prose duplication; package selector and incomplete pricing surfaces unchanged |
| **Cover / body truth** | Cover R15 read-only from frozen context; no Edit on Cover; text pages use R16B edit path; R14 display merge in read/preview only; saved source remains raw markdown |
| **Lifecycle locked** | Preview / Send / Sign / Payment / Add Page **disabled** |

### 5. Source-of-truth / protected systems

**Unchanged and verified:**

- **R13** registry/resolver semantics
- **R14** body renderer (display-time merge only)
- **R15** cover VM (read-only Cover)
- Pricing engine / snapshot builder / **`refreshDraftPricing`**
- Templates / **`context_echo`** — not mutated by R16C paths
- Body persist — raw **`body_markdown`** only via R16B save
- Visibility persist — **`visible_to_customer`** + **`updated_at`** only; independent of body Save/Cancel
- **`getCustomerPreviewPages`** — R17 contract helper only; no Preview UI

### 6. Mobile findings (390px)

| Check | Result |
|-------|--------|
| Page-level horizontal overflow | **None** |
| More pages menu | **Usable, not clipped** |
| Nav strip internal scroll | **Present** (pre-existing R16C1 behavior) |
| Strip tap-target overlap at 390px | **Known non-blocker** — More pages can overlap primary tab clicks; **not introduced or worsened by R16C3**; **does not block R17 planning** |
| Insert field at 390px | Usable once in edit mode (prior R16C2/R16C3 audits); optional re-spot-check during mobile polish |

**Recommendation:** Track **390px strip tap-target overlap** as **separate Builder mobile polish** — may be scheduled **before or alongside R17 planning**; **not a blocker** for R17 planning or implementation unless product requires flawless strip navigation first.

### 7. Final DB state after audit

| Item | State |
|------|-------|
| **Terms visibility** | **Visible** (restored) |
| **Scope notes visibility** | **Visible** (restored) |
| **Body text saved during audit** | **No** |
| **Project Overview trailing `{{customer_name}}`** | **Yes** — R16C2 audit residue (unchanged) |
| **Scope notes `Saved R16C1 marker text.`** | **Yes** — R16C1 audit residue (unchanged) |

DB draft residue is **not a git blocker**.

### 8. Blockers

**None.**

### 9. Non-blocking follow-ups

1. **390px strip tap-target overlap** (R16C1) — separate mobile polish task.
2. **Optional DB draft marker cleanup** on stamped audit draft — cosmetic only.
3. **390px Insert field** — optional dedicated mobile polish spot-check.

### 10. Next-stage guidance (historical — superseded by §6BE)

**Do not start R17 Preview implementation until explicitly approved.** *(R17A/R17B is now complete at `8ac2bcb` — see §6BE.)*

**Do not start Preview / PDF / lifecycle (R17–R20) or §6AL R16 Proposals hub automatically.**

**Recommended immediate next (historical at R16C final audit docs time; superseded by §6BE):**

| Option | Focus |
|--------|--------|
| ~~**R17 planning only**~~ | **Complete** at `8ac2bcb` (§6BE) — customer Preview foundation |
| **R18 Send planning only** | Public/tokenized customer access scoping — **no implementation** until explicitly approved (§6BE) |

**Continue preserving:**

- Preview / Send / Sign / Payment **disabled**
- Frozen **`proposalDocumentContext`** for customer document surfaces
- Raw `body_markdown` persistence + R14 display merge only
- Pricing trust + snapshot safety
- R16C navigation model (single `activePageContextId`; overflow + visibility metadata without filtering contractor nav)
- Insert field inserts raw tokens only — never rendered output
- Visibility toggles independent of body Save/Cancel

---

## 6BE. R17A/R17B CUSTOMER PREVIEW FOUNDATION

**Status:** **Complete (historical foundation).** **Code checkpoint:** **`8ac2bcb` — feat(proposals): add customer preview foundation in R17A/R17B**. **Docs checkpoint:** **`f6e8225`** — docs: checkpoint after R17A/R17B customer preview foundation. **For current resume on Preview Estimate presentation, read §6BF** — R17C1 document presentation layer at **`9c2244a`**. **Working tree:** clean after code commit `8ac2bcb`; superseded for current resume by §6BF after R17C1 at `9c2244a`.

### 1. Executive verdict

- **R17A/R17B complete and stable.**
- **Authenticated contractor Customer Preview** is available from Builder header when persisted draft graph loads.
- **No public/tokenized customer access** was added.
- **Send / Sign / Payment / PDF / public customer sharing remain disabled.**
- **No P0/P1 blockers** from pre-commit audit.

### 2. R17A — Pure customer Preview view model

| Artifact | Path |
|----------|------|
| View model | `app/lib/proposalCustomerPreviewViewModel.ts` |
| Tests | `app/lib/proposalCustomerPreviewViewModel.test.ts` |

**Contract:**

- **Input:** persisted **`ProposalDraftGraph`** only — uses existing DB-backed proposal spine, **not** legacy `estimateStore`.
- **Adapter boundary:** `adaptProposalDraftGraphToBuilderPreview` → frozen **`proposalDocumentContext`**.
- **Cover:** synthetic first page via **R15** `buildProposalCoverViewModel`.
- **Text pages:** raw `body_markdown` source; **R14** `renderProposalDocumentPageBody` at display time only — rendered token output **never persisted**.
- **Page filter:** **R16C3** `getCustomerPreviewPages` / `visible_to_customer`; hidden pages excluded; DB pages in `sort_order`.
- **Deferred page types:** `signature`, `payment_schedule` excluded from customer Preview.
- **Estimate:** required; snapshot-backed; line-items-only via adapter pricing preview.
- **Photos / PDF:** placeholder messages only when page is visible.
- **Readiness / diagnostics:** hidden page count; pricing incomplete / blocking line count; stale warnings where available.
- **Pure:** does not mutate input graph; no DB, React, pricing math, persistence, or lifecycle mutation.

### 3. R17B — Authenticated contractor Preview route

| Artifact | Path |
|----------|------|
| Route entry | `app/tools/roofing/proposals/preview/page.tsx` |
| App page | `app/tools/roofing/proposals/preview/ProposalCustomerPreviewAppPage.tsx` |
| Client loader | `app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx` |
| Document view | `app/tools/roofing/proposals/preview/ProposalCustomerPreviewDocument.tsx` |
| Estimate section | `app/tools/roofing/proposals/preview/ProposalCustomerPreviewEstimateSection.tsx` |

**Route:** `/tools/roofing/proposals/preview?job=<jobId>&proposal=<proposalId>`

**Access:**

- Mirrors Builder auth / company access pattern (`ensureUserIdentity`, `getUserCompanyId`).
- Requires valid **`job`** + **`proposal`** UUID query params.
- Validates proposal/job/company relationship via existing `validateProposalDraftGraphForJob`.
- Missing / invalid / wrong params fail safely with error message — **no customer document content leak**.
- **Authenticated contractor-only** — **no** public route or tokenized customer access.

### 4. Builder wiring

- Header **Preview** enabled when persisted draft graph loads successfully (`previewEnabled` in guidance model).
- Preview navigates to `/tools/roofing/proposals/preview?job=&proposal=`.
- **Dirty body edit guard** (`BUILDER_UNSAVED_PAGE_EDIT_CONFIRM`) runs before Preview navigation.
- **Dismiss/cancel** keeps user in Builder edit mode with unsaved text.
- **Accept/confirm** navigates to Preview and discards unsaved body text.
- **Send / Sign / Payment remain disabled.**
- Strip Preview tab policy **unchanged** (`BUILDER_PREVIEW_STRIP_POLICY.enabled: false`).
- Builder copy updated — no longer says Preview is disabled once Preview is available:
  - Preview available as **contractor draft preview**
  - Send / Sign / Payment / PDF / public sharing **not enabled**
- Copy surfaces: compact read-only alert, summary rail footer (`resolveBuilderRailActionsNote`), pricing blocker guidance when `previewEnabled`.

### 5. Preview UI rules

**Document-only stacked Preview.** Top chrome only:

- Back to Builder
- draft-not-sent notice
- readiness / warning banner (hidden page count, pricing/stale warnings)

**Not present in Preview:**

- Builder strip, More pages menu, Edit controls, Insert field / token picker, visibility toggles, Add Page, package selector interaction, Send / Sign / Payment / PDF / customer actions, contractor-only hidden-page banners inside document pages.

Hidden-page count may appear in Preview chrome as contractor guidance.

### 6. Preview source-of-truth

**Preview uses:**

- Persisted draft graph
- Frozen `proposalDocumentContext`
- R15 cover VM
- R14 display-time body renderer
- Snapshot-backed pricing preview
- R16C3 `visible_to_customer` filtering

**Preview does not use:**

- Live Settings / customer / job reads as document truth
- localStorage / cache
- Live templates as body source
- `estimateStore`
- RoofingClient PDF
- Rendered token output as persisted data
- `refreshDraftPricing` during Preview render
- Pricing math changes, proposal snapshot math changes, or R13 / R14 / R15 semantic changes

### 7. Automated validation

| Check | Result |
|-------|--------|
| R17 + broader proposal regression batch | **313/313** pass |
| Includes `proposalCustomerPreviewViewModel`, `proposalBuilderGuidance`, `proposalPageVisibilityEditing`, `proposalRecordStore`, `proposalBuilderNavigation`, `proposalDocumentTokenPicker`, `proposalPageContentEditing`, `proposalBuilderPreview`, `proposalBuilderReadiness`, `proposalDocumentBodyRenderer`, `proposalCoverViewModel`, `proposalSnapshotBuilder`, `proposalBuilderDocumentIa`, `proposalDraftGraphAdapter`, `proposalDraftEntry`, `proposalStaleness`, `proposalBuilderPricingPreview`, `proposalPricingEngine`, `proposalDocumentTokenRegistry`, `proposalDocumentContext` | **Pass** |
| Pre-commit audit | **Passed** |
| Working tree before code commit | **Clean** at `118aa14` / `8ac2bcb` |

**Stamped audit draft:** `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`. **Playwright auth:** `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`.

### 8. Authenticated browser audit

**Verdict:** **Pass.** **Functional console errors: 0** (desktop + 390px).

| Area | Confirmations |
|------|----------------|
| **Builder lifecycle** | Preview enabled; Send / Sign / Payment disabled |
| **Dirty edit guard** | Confirm on Preview click; dismiss stays on Builder with unsaved text; accept navigates to Preview |
| **Visibility → Preview** | Hide Terms → Preview excludes Terms; hidden-page count banner in Preview chrome; restore Terms → Terms reappears in Preview |
| **Document truth** | Cover renders frozen context; Project Overview resolves customer token (no raw `{{customer_name}}` when value exists); Scope notes marker visible when page visible; Estimate line-items-only + selected package read-only |
| **Preview chrome** | No Builder strip, edit/token/visibility/More pages/Add Page controls |
| **390px mobile** | Preview button reachable/enabled; Preview opens; no page-level horizontal overflow; Cover, Project Overview, Estimate, Scope notes render; Back to Builder usable; no edit controls |

### 9. Final DB state after audit

| Item | State |
|------|-------|
| **Terms visibility** | **Visible** (restored) |
| **Scope notes visibility** | **Visible** (restored) |
| **Body text saved during R17 audit** | **No** |
| **Project Overview audit/body residue** | Useful for token resolution validation (unchanged from prior audits) |
| **Scope notes marker** | **Present** — visible in Preview |
| **Visibility state left changed** | **No** — Terms and Scope notes restored to visible |

### 10. Protected systems (unchanged in R17 code commit)

- No docs in code commit
- No SQL / migrations, package files
- No pricing math, proposal snapshot math, or `refreshDraftPricing` changes
- No R13 registry/resolver, R14 renderer, or R15 cover VM semantic changes
- No template / `context_echo` mutation
- No PDF, public customer route, Send / Sign / Payment / lifecycle enablement

### 11. R18 guardrails

- **R18 should be Send planning only next** — after this docs checkpoint is committed.
- **R18 must not be implemented** until scoped and approved.
- **R18 should own public/tokenized customer access** when implemented — R17 Preview is **authenticated contractor-only**.
- **Do not add PDF, Sign, Payment, or lifecycle in R18 planning** unless explicitly scoped.
- **Do not reuse RoofingClient PDF or `estimateStore`.**

### 12. Next-stage guidance (historical — superseded by §6BF)

**Do not start R18 Send implementation, §6AL R16 Proposals hub, PDF, or lifecycle enablement automatically.** *(R17C1 Preview Estimate presentation is now complete at `9c2244a` — see §6BF.)*

**Recommended immediate next (historical at R17A/R17B docs time; superseded by §6BF):**

| Option | Focus |
|--------|--------|
| ~~**R18 Send planning only**~~ | Deferred — **decide R17C2 vs R17C3 first** (§6BF) |

**Continue preserving:**

- R17 authenticated contractor Preview route foundation (`8ac2bcb`, §6BE)
- Send / Sign / Payment / PDF / public customer sharing **disabled**
- Frozen **`proposalDocumentContext`** for customer document surfaces
- Raw `body_markdown` persistence + R14 display merge only
- Pricing trust + snapshot safety
- R16C navigation + visibility model in Builder
- Insert field inserts raw tokens only — never rendered output

---

## 6BF. R17C1 PREVIEW ESTIMATE DOCUMENT PRESENTATION LAYER

**Status:** **Complete (Preview foundation).** **Code checkpoint:** **`9c2244a` — feat(proposals): elevate Preview estimate document presentation in R17C1**. **Docs checkpoint:** **`16c38e6`** — docs: checkpoint after R17C1 Preview estimate document presentation. **For current resume on Builder Estimate workbench, read §6BG** — R17C2 complete at **`3e65774`**. **Working tree:** clean after R17C2 code commits; doc-only WIP for §6BG checkpoint. **R18 Send planning remains blocked** until R17D scope decisions and R17C3/R17C4 presentation alignment are explicitly resolved.

### 1. Executive verdict

- **R17C1 complete and stable.**
- **Not a patch** — implements the confirmed long-term architecture: one proposal truth model, pure surface-specific presentation mappers, separate UI surfaces.
- **Builder Estimate = contractor workbench** (unchanged in R17C1).
- **Authenticated Preview Estimate = proposal/document review** (elevated in R17C1).
- **Future public/PDF consumers** should reuse **document presentation**, not Builder workbench UI.
- **No public/tokenized customer access**, Send, Sign, Payment, PDF, or lifecycle enablement.
- **No P0/P1 blockers** from pre-commit audit.

### 2. R17C1 purpose

R17C1 fixes **Preview Estimate information presentation** without starting R17C2, R17C3, or R18. It separates document review from contractor workbench setup while preserving all pricing/snapshot truth boundaries from R17A/R17B.

### 3. Artifacts

| Artifact | Path |
|----------|------|
| Document estimate presenter | `app/lib/proposalCustomerEstimatePresenter.ts` |
| Presenter tests | `app/lib/proposalCustomerEstimatePresenter.test.ts` |
| Shared package presentation metadata | `app/lib/proposalPackagePresentation.ts` |
| Package presentation tests | `app/lib/proposalPackagePresentation.test.ts` |
| Preview estimate document | `app/tools/roofing/proposals/preview/ProposalCustomerPreviewEstimateDocument.tsx` |
| Preview line list | `app/tools/roofing/proposals/preview/ProposalCustomerPreviewLineList.tsx` |
| Preview totals | `app/tools/roofing/proposals/preview/ProposalCustomerPreviewTotals.tsx` |
| Preview estimate section (wiring) | `app/tools/roofing/proposals/preview/ProposalCustomerPreviewEstimateSection.tsx` |
| Preview estimate copy / surface tokens | `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts` (Preview-only constants) |
| Builder import-only refactor | `ProposalBuilderPackageCards.tsx`, `ProposalBuilderPackageSelector.tsx`, `ProposalBuilderOptionsPanel.tsx` |

### 4. Architecture separation

**Preview Estimate no longer imports:**

- `ProposalBuilderSectionPreview`
- `ProposalBuilderLinePreviewTable`
- `ProposalBuilderDocumentTotals`

**Explicitly not done in R17C1:**

- No `presentationMode` prop on Builder table components
- No Builder workbench behavior changes
- No hiding labels inside Builder components to make Preview look different

**Package metadata moved to shared pure lib:**

- `resolvePackageMeta` extracted from Builder UI into `app/lib/proposalPackagePresentation.ts`
- Preview must not depend on Builder UI components for package metadata

**Future architecture:**

- **R17C2** can add a **workbench estimate presenter** as sibling to document presenter
- **Public route / PDF** should consume **document presentation DTO**, not Builder React workbench UI

### 5. Preview Estimate behavior (R17C1)

**Document-style estimate section:**

- **“Proposal estimate”** kicker + chapter title + subtitle
- **Selected package hero** — prominent offer card with selected indicator, description, bullets
- **Included scope panel** — grouped section with item count; avoids accidental duplicate chapter/section titles
- **Card-style document-safe rows** — name + price / Included / In package
- **Optional upgrades block** — only when document-safe upgrade lines exist (no loud empty block)
- **Totals** — only when `pricingComplete`; “Investment summary” panel when shown
- **Calm partial-pricing note** when pricing incomplete but safe scope lines exist

**Preview body does not show internal Builder setup labels:**

- No “Customer price”
- No “Needs quantity”
- No “Qty Not resolved”
- No “Line details”
- No “Set up company pricing”
- No unresolved setup rows as document content
- No fabricated total when pricing is incomplete

**Incomplete pricing:**

- Warnings remain in **Preview chrome/readiness** (from R17A VM)
- Document body stays clean

### 6. Source-of-truth unchanged

- No pricing math changes
- No proposal snapshot builder changes
- No `refreshDraftPricing` changes
- No R13 registry/resolver semantic changes
- No R14 body renderer semantic changes
- No R15 cover VM semantic changes
- No `proposalCustomerPreviewViewModel` changes
- No route/auth changes
- No DB schema changes
- No template / `context_echo` mutation
- No rendered token output persistence
- No `estimateStore` / RoofingClient PDF reuse

### 7. Automated validation

| Check | Result |
|-------|--------|
| R17 + broader proposal regression batch | **328/328** pass |
| Includes `proposalCustomerEstimatePresenter`, `proposalPackagePresentation`, prior R17/R16 proposal lib tests | **Pass** |
| Pre-commit audit | **Passed** |
| Working tree before code commit | **Clean** at `9c2244a` |

**Stamped audit draft:** `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`. **Playwright auth:** `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`.

### 8. Authenticated browser audit

**Verdict:** **Pass.** **Functional console errors: 0** (desktop + 390px).

| Area | Confirmations |
|------|----------------|
| **Desktop Preview** | Authenticated; package hero visible; included scope hierarchy; partial pricing note + chrome warnings; forbidden labels absent; no fabricated total; no Builder controls; no horizontal overflow |
| **390px Preview** | Authenticated; package hero readable; included scope + prices readable; Back to Builder visible; forbidden labels absent; no horizontal overflow |
| **Builder regression** | Workbench table unchanged (Customer price, Needs quantity, Line details still in Builder); Preview enabled and opens Preview; Send / Sign / Approval / Payment disabled; dirty edit guard works |

### 9. Final DB state after audit

| Item | State |
|------|-------|
| **Body text saved during R17C1 audit** | **No** |
| **Terms visibility** | **Unchanged** — visible |
| **Scope notes visibility** | **Unchanged** — visible |
| **Any DB mutations** | **No** |

### 10. Known remaining visual/product gaps

| Gap | Stage |
|-----|-------|
| ~~**R17C2** — Builder Estimate workbench hierarchy~~ | **Complete** at `3e65774` (§6BG) |
| **R17D** — Scope Decisions / Edit Option backend | Not started — required before real line editing |
| **R17C3** — Cover / Project Overview / document typography rhythm | Not started |
| **R17C4** — Estimate display policy consumer from `settings_json` | Not started |
| **Project Overview audit/demo residue** on stamped draft | DB content residue — not a git issue |
| **Section subtotals / richer investment story** | Later presentation improvement |
| **Optional upgrades** on stamped draft | No document-safe upgrade lines existed |
| **R18 Send / public route / PDF / Sign / Payment / lifecycle** | Blocked |

### 11. R18 guardrails (unchanged)

- **Do not start R18 Send planning or implementation** until R17D vs R17C3 decision is made and scope decisions foundation is explicitly scoped.
- **R18 must not be implemented** until explicitly scoped and approved.
- **R18 should own public/tokenized customer access** when implemented — authenticated Preview remains contractor-only.
- **Do not add PDF, Sign, Payment, or lifecycle in R18 planning** unless explicitly scoped.
- **Do not reuse RoofingClient PDF or `estimateStore`.**

### 12. Next-stage guidance (historical — superseded by §6BG)

**Do not start R18 Send planning, R18 implementation, §6AL R16 Proposals hub, PDF, or lifecycle enablement automatically.** *(R17C2 Builder Estimate workbench is now complete at `3e65774` — see §6BG.)*

**Recommended immediate next (historical at R17C1 docs time; superseded by §6BG):**

| Option | Focus |
|--------|--------|
| ~~**R17C2**~~ | **Complete** — Builder Estimate workbench hierarchy (§6BG) |
| **R17C3** | Cover / Project Overview / document typography rhythm |
| **R17D** | Scope Decisions / Edit Option backend |

**Continue preserving:**

- R17C1 document presentation layer (`9c2244a`)
- R17A/R17B Preview route + VM foundation (`8ac2bcb`)
- Send / Sign / Payment / PDF / public customer sharing **disabled**
- Preview Estimate **must not** re-import Builder workbench table components
- Frozen **`proposalDocumentContext`** for customer document surfaces
- Raw `body_markdown` persistence + R14 display merge only
- Pricing trust + snapshot safety

---

## 6BG. R17C2 BUILDER ESTIMATE WORKBENCH HIERARCHY

**Status:** **Complete (R17C2).** **Code checkpoint:** **`3e65774` — feat(proposals): add Builder estimate workbench zones in R17C2** (Phase 1 presenter: **`3c04322`**). **Docs checkpoint:** **`ccbd30d`** — docs: checkpoint after R17C2 Builder estimate workbench. **For current Edit Option / scope decision resume, read §6BI** — R17D Phase 2 at **`f5712ff`**. **Working tree:** clean after code commit `3e65774`; superseded for Edit Option/backend resume by §6BI after R17D Phase 2 at `f5712ff`.

### 1. Executive verdict

- **R17C2 complete and stable.**
- **R17C2 completes the Builder-side half of the R17C dual-surface architecture.**
- **R17C1** = Preview / customer document estimate presentation (`9c2244a`, §6BF).
- **R17C2** = contractor Builder Estimate workbench (`3e65774`, this section).
- **Builder and Preview remain separate surfaces** — do not reuse Builder workbench UI for Preview; do not reuse Preview document UI for Builder; **no `presentationMode` patch**.
- **Edit Option shell is UI-only** — all line-editing controls are disabled/gated; real actions require **R17D**.
- **No public/tokenized customer access**, Send, Sign, Payment, PDF, or lifecycle enablement.
- **No P0/P1 blockers** from pre-commit audit.

### 2. R17C2 purpose

R17C2 replaces the flat mixed Builder Estimate list with a **zoned contractor workbench** that classifies template lines into customer-ready scope, scope review, hard blockers, upgrades, and totals — while preserving pricing/snapshot truth boundaries. It frames unresolved template quantity lines as **scope review decisions** (Roofr-like product semantics), not mandatory hard errors.

### 3. R17C2 Phase 1 — presenter foundation (`3c04322`)

| Artifact | Path |
|----------|------|
| Workbench estimate presenter | `app/lib/proposalBuilderWorkbenchEstimatePresenter.ts` |
| Presenter tests | `app/lib/proposalBuilderWorkbenchEstimatePresenter.test.ts` |

**Pure presenter DTO zones:** `packageZone`, `readyScope`, `needsAttention`, `upgradesZone`, `totalsZone`, `displaySettingsEntry`, `meta`.

**Phase 1:** presenter only; **no UI**; no protected systems changed.

### 4. R17C2 Phase 2 / 2.5 / 2.6 — workbench UI (`3e65774`)

| Artifact | Path |
|----------|------|
| Workbench document orchestrator | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx` |
| Package / option zone | `ProposalBuilderWorkbenchPackageZone.tsx` |
| Locked display settings entry | `ProposalBuilderWorkbenchSettingsEntry.tsx` |
| Customer-ready scope zone | `ProposalBuilderWorkbenchReadyScopeZone.tsx` |
| Attention zones (hard blockers + scope review) | `ProposalBuilderWorkbenchAttentionZone.tsx` |
| Optional upgrades zone | `ProposalBuilderWorkbenchUpgradesZone.tsx` |
| Totals / readiness zone | `ProposalBuilderWorkbenchTotalsZone.tsx` |
| Line row + details | `ProposalBuilderWorkbenchLineRow.tsx`, `ProposalBuilderWorkbenchLineDetails.tsx` |
| Gated Edit Option shell | `ProposalBuilderWorkbenchEditOptionShell.tsx` |
| Canvas wiring | `ProposalBuilderCanvas.tsx` |
| Workbench surface tokens | `proposalBuilderConstants.ts` |

**Modified for scope review semantics:** `proposalBuilderWorkbenchEstimatePresenter.ts` + tests.

### 5. Builder Estimate behavior (R17C2)

**Builder Estimate no longer uses one flat mixed workbench list.** Zones shown:

1. **Package / option** — existing selected-option persistence unchanged
2. **Estimate display settings entry** — visible, locked/coming soon
3. **Customer-ready scope** — priced/included/grouped lines ready for customer document
4. **Scope review** (slate) — unresolved quantity lines needing job-specific review
5. **Pricing blockers** (amber) — missing catalog / missing price / missing pricing view
6. **Optional upgrades** — upgrade_group sections isolated
7. **Totals / readiness** — no fabricated totals when pricing incomplete
8. **Edit Option shell** — right-side drawer; UI-only; honest coming-soon copy

**Product correction (Phase 2.5):**

- Unresolved template quantity → **scope review**, not hard error
- Missing catalog / price / pricing view → **hard blockers**
- Matches Roofr-like model: template = starting superset; proposal option = job-specific editable scope

**Edit Option shell (Phase 2.6) — disabled/gated future workflow sections:**

- Set quantity · Mark N/A / remove from proposal · Add from catalog · Add custom line · Move to optional upgrade · Hide from customer / contractor-only · Quantity source / measurement mapping

**All Edit Option controls remain disabled.** No backend actions enabled.

### 6. Roofr research / R17D discovery (recorded, not implemented)

Roofr **Edit Option** workflow (research): add/remove catalog lines per proposal, specify quantities, add upgrades, hide line items/pages, tailor template scope per job.

**FieldDive backend limitation today:**

- `proposal_line_items` are rebuilt from template + pricing preview during `refreshDraftPricing`
- Without a persisted **scope decision overlay** and **merge-on-refresh** contract, manual line edits would be lost or corrupt pricing trust

**Therefore R17D is recommended before R18:**

- Scope Decisions / Edit Option backend
- Persisted proposal-option scope decision overlay
- Merge-on-refresh contract
- Line mutation APIs one by one

### 7. Architecture separation (R17C dual-surface)

| Surface | Role | Presenter / UI |
|---------|------|----------------|
| **Builder Estimate** | Contractor workbench — setup, review, scope decisions (UI shell only until R17D) | `proposalBuilderWorkbenchEstimatePresenter` + `ProposalBuilderWorkbench*` zones |
| **Preview Estimate** | Customer/document review | `proposalCustomerEstimatePresenter` + Preview-only components (§6BF) |

**Explicitly not done in R17C2:**

- No changes to `proposalCustomerEstimatePresenter` or Preview components
- No `presentationMode` on shared table components
- No Preview re-import of Builder workbench zones

### 8. Source-of-truth unchanged (R17C2 commits)

- No docs in code commits · No SQL/migrations · No package files
- No scope decision table · No line mutation APIs · No `proposal_line_items` mutation path
- No `refreshDraftPricing` / pricing math / snapshot builder changes
- No R13/R14/R15 semantic changes
- No `proposalCustomerEstimatePresenter` / `proposalCustomerPreviewViewModel` changes
- No routes/auth / templates/`context_echo` mutation
- No public route/PDF/Send/Sign/Payment/lifecycle work

### 9. Automated validation

| Check | Result |
|-------|--------|
| R17C2 Phase 1 presenter tests | **Pass** |
| `proposalBuilderWorkbenchEstimatePresenter.test.ts` | **21/21** pass |
| `proposalCustomerEstimatePresenter.test.ts` | **13/13** pass |
| `proposalPackagePresentation.test.ts` | **2/2** pass |
| Full `app/lib/proposal*.test.ts` batch | **529/529** pass |
| Working tree before code commit | **Clean** at `3e65774` |

**Stamped audit draft:** `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`. **Playwright auth:** `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`.

### 10. Authenticated browser audit

**Verdict:** **Pass.** **Functional console errors introduced by R17C2 pass: 0** (desktop + 390px).

| Area | Confirmations |
|------|----------------|
| **Desktop Builder** | Workbench zones visible; package zone; locked settings entry; customer-ready scope; **7 scope review rows** on stamped draft; hard blockers distinct when present; upgrades empty state; totals pending without fabricated values; Edit Option shell opens; all Edit Option controls disabled/gated; Send/Sign/Payment/PDF disabled; Preview works |
| **390px Builder** | Zones stack; no horizontal overflow; Edit Option drawer full-width/readable; scope review readable; disabled chips do not overflow |
| **Preview regression** | R17C1 Preview document unchanged; forbidden Builder labels absent in Preview body |

### 11. Final DB state after audit

| Item | State |
|------|-------|
| **Body text saved during audit** | **No** |
| **Visibility changes** | **No** |
| **Any DB mutations** | **No** |

### 12. Known remaining gaps

| Gap | Stage |
|-----|-------|
| **R17D Phase 1** — scope decision overlay + merge-on-refresh foundation | **Complete** at `43c83a2` (§6BH) |
| **R17D Phase 2** — manual quantity UI/API (first real Edit Option action) | **Complete** at `f5712ff` (§6BI); **full audit passed** |
| **R17D Phase 2.5+ / Phase 3+** — reset/clear manual qty; exclude/N/A; hide; add catalog/custom; move to upgrade; quantity source | Not started |
| **R17C3** — Cover / Project Overview / document typography rhythm | Not started |
| **R17C4** — estimate display policy consumer from existing `settings_json` | Not started — likely before R18 |
| **R18 Send / public route / PDF / Sign / Payment / lifecycle** | Blocked |

### 13. R18 guardrails (unchanged)

- **Do not start R18 Send planning or implementation** until R17D scope decisions and presentation alignment (R17C3/R17C4) are explicitly resolved.
- **Do not enable real Edit Option actions** without R17D merge-on-refresh contract.
- **R18 should own public/tokenized customer access** when implemented.
- **Do not reuse RoofingClient PDF or `estimateStore`.**

### 14. Next-stage guidance (historical — superseded by §6BI)

**Superseded.** R17D Phase 1 is complete at `43c83a2` (§6BH); R17D Phase 2 code is complete at `f5712ff` (§6BI). See §6BI for current next-stage guidance.

**Historical recommended path (pre-R17D Phase 1):**

1. ~~**R17D Phase 1** — Scope Decisions data model + merge-on-refresh foundation~~ **Done** (§6BH)
2. **R17D actions** one-by-one (quantity, exclude/N/A, visibility, catalog add, custom line, upgrade move, quantity source)
3. **R17C3** document typography rhythm
4. **R17C4** estimate display policy consumer
5. **R18 Send/public planning** — only after scope decisions and presentation alignment are explicitly resolved

---

## 6BH. R17D PHASE 1 SCOPE DECISION OVERLAY FOUNDATION

**Status:** **Complete (R17D Phase 1).** **Code checkpoint:** **`43c83a2` — feat(proposals): add scope decision overlay foundation in R17D**. **Docs checkpoint:** **`9b66bf4` — docs: checkpoint after R17D Phase 1 scope decision overlay foundation**. **For current R17D resume, read §6BI** — R17D Phase 2 at **`f5712ff`**. **Working tree:** clean after code commit `43c83a2`. **Migration apply status at Phase 1 docs checkpoint:** committed to repo only; **superseded by §6BI** — migration **appears applied** on configured project `rhquhnujjnzjhweypavd`.

### 1. Executive verdict

- **R17D Phase 1 complete and stable.**
- **R17D is the real Edit Option / Scope Decisions backend foundation.**
- **R17C2** created the Builder UI surface and gated Edit Option shell (`3e65774`, §6BG).
- **R17D Phase 1** creates the long-term **proposal-option scope decision overlay** so contractor edits can survive `refreshDraftPricing`.
- **This is not a patch** — it prevents unsafe direct mutation of `proposal_line_items`, which are deleted/rebuilt on refresh.
- **Phase 1 fully proves `manual_quantity`.** Other decision types are typed but not behavior-enabled yet.
- **No Builder UI changes.** **No Edit Option controls enabled.** **No Preview UI changes.**
- **R18 Send / public route / PDF / Sign / Payment / lifecycle remain blocked.**

### 2. R17D purpose

| Layer | Role |
|-------|------|
| **R17C2** | Builder Estimate workbench UI + gated Edit Option shell (UI-only) |
| **R17D** | Persisted contractor scope decisions + merge-on-refresh before snapshot rebuild |
| **Later surfaces** | Builder / Preview / public / PDF consume **post-decision snapshot graph**, not local UI fake state |

**Core contract:**

- `proposal_line_items` remain **derived snapshot output**.
- `proposal_option_scope_decisions` stores **persisted contractor intent**.
- `refreshDraftPricing` loads active scope decisions and **merges them before rebuilding** `proposal_line_items`.
- **Templates are never mutated** for job-specific proposal scope.
- **Decision rows survive refresh** — refresh deletes/reinserts line items only; decision rows are never deleted by refresh.
- **Pricing engine and snapshot builder remain the trust boundary** — no direct line-item patching as source of truth.

### 3. R17D Phase 1 artifacts

| Artifact | Path |
|----------|------|
| Migration | `supabase/migrations/20260618_009_create_proposal_option_scope_decisions.sql` — **appears applied** on configured project per §6BI |
| Types | `app/lib/proposalScopeDecisionTypes.ts` |
| Pure merge | `app/lib/proposalScopeDecisionMerge.ts` |
| Merge tests | `app/lib/proposalScopeDecisionMerge.test.ts` |
| Store | `app/lib/proposalScopeDecisionStore.ts` |
| Store tests | `app/lib/proposalScopeDecisionStore.test.ts` |
| Refresh wiring | `app/lib/proposalRecordStore.ts` (modified) |
| Integration tests | `app/lib/proposalRecordStore.test.ts` (modified) |

### 4. Decision model

**Types modeled (all 8):**

| `decision_type` | Phase 1 merge behavior |
|-----------------|------------------------|
| `manual_quantity` | **Fully implemented** — applies to `PricingLineInput.quantity` before repricing |
| `excluded` | Typed only — explicit unsupported/warning |
| `not_applicable` | Typed only — explicit unsupported/warning; **do not implement** (Mark N/A drift; §6BL.12) |
| `visibility_override` | Typed only — explicit unsupported/warning |
| `role_override` | Typed only — explicit unsupported/warning |
| `added_catalog` | Typed only — explicit unsupported/warning |
| `added_custom` | Typed only — explicit unsupported/warning |
| `quantity_source_override` | Typed only — explicit unsupported/warning |

**Unsupported types produce explicit warnings** in `ProposalScopeDecisionMergeReport` — they do **not** silently pretend to work.

### 5. Migration / table — `proposal_option_scope_decisions`

**Scoped by:** `company_id`, `proposal_id`, `proposal_version_id`, `proposal_option_id`

**Columns:** `decision_type`, nullable `source_template_item_id`, nullable `instance_line_key`, `payload_json`, `active`, `created_at` / `updated_at`, `created_by` / `updated_by`

**Constraints:**

- Target-shape check — template-target types require `source_template_item_id`; `added_*` types require `instance_line_key`
- Partial unique indexes on active template-target and instance-line keys

**RLS:** company_memberships pattern matching `proposal_line_items`. **No public policies.**

**Apply status (historical at Phase 1 docs checkpoint):** migration **committed to repo only**. **Current status (§6BI):** migration **appears applied** manually in Supabase SQL Editor on configured project **`rhquhnujjnzjhweypavd`** (dashboard label: **Production**); verification query returned constraints/indexes/policies for `proposal_option_scope_decisions`. **Not a separate DEV target.**

### 6. Store / API foundation

| Function | Purpose |
|----------|---------|
| `getScopeDecisionsForProposalOption` | Read by runtime option |
| `getScopeDecisionsForDraftVersion` / `getScopeDecisionsForDraftGraph` | Batch load for refresh |
| `upsertDraftScopeDecision` | Draft-only upsert |
| `clearDraftScopeDecision` | Deactivates decision (`active = false`) |

**Guards:** draft status · draft version kind · option belongs to current version · template item belongs to proposal template + option · instance line key validation for added-line types · no direct `proposal_line_items` edits

**Events:** existing `draft_saved` with `reason: "scope_decision_upsert"` / `"scope_decision_clear"` — **no `proposal_events` CHECK migration required.**

### 7. Merge behavior

| Function | Role |
|----------|------|
| `mergeScopeDecisionsIntoPricingLines` | Applies decisions to pricing input lines |
| `buildDraftInstantiateInputWithScopeDecisions` | Builds instantiate input with repriced options when decisions present |
| `ProposalScopeDecisionMergeReport` | `applied`, `ignored`, `stale`, `unsupported`, `warnings` |

**`refreshDraftPricing` wiring:**

| Condition | Path |
|-----------|--------|
| Zero active decisions | Existing `buildDraftInstantiateInputFromPreview` — **unchanged** |
| Active decisions present | `buildDraftInstantiateInputWithScopeDecisions` for affected options |
| Line rebuild | `proposal_line_items` still delete/reinsert from merged instantiate input |
| Decision rows | **Never deleted** by refresh |

**Confirmed:**

- Zero-decision refresh output unchanged
- `manual_quantity` survives refresh and updates rebuilt snapshot quantity/pricing through existing trusted path
- No direct `proposal_line_items` mutation for decisions

### 8. Automated validation (pre-commit)

| Check | Result |
|-------|--------|
| `proposalScopeDecisionMerge.test.ts` | **6/6** pass |
| `proposalScopeDecisionStore.test.ts` | **4/4** pass |
| `proposalRecordStore.test.ts` | **57/57** pass |
| `proposalBuilderWorkbenchEstimatePresenter.test.ts` | **21/21** pass |
| `proposalCustomerEstimatePresenter.test.ts` | **13/13** pass |
| `proposalPackagePresentation.test.ts` | **2/2** pass |
| Full `app/lib/proposal*.test.ts` batch | **541/541** pass |

### 9. Source-of-truth unchanged (R17D Phase 1 commit)

- **No Builder UI changes** · **No Preview UI changes** · **No Edit Option controls enabled**
- **No public route** · **No PDF** · **No Send / Sign / Payment / lifecycle work**
- **No pricing engine math changes** · **No snapshot builder math changes**
- **No R13/R14/R15 semantic changes** · **No package files**
- Migration **appears applied** on configured project per §6BI (supersedes Phase 1 “committed only” note)

### 10. Known follow-ups

| Follow-up | Stage |
|-----------|-------|
| **R17D Phase 2** — first real Edit Option action: **manual quantity UI/API** | **Complete** at `f5712ff` (§6BI); **full audit passed** |
| **R17D Phase 3A** — exclude/remove | **Complete** at `2dca3c0` (§6BK) |
| **R17D Phase 3B (Mark N/A)** | **Superseded** — product drift; visible UI removed at `8dd8e7f` (§6BL.12); **do not implement** |
| **R17D Phase 4** — hide from customer | **Complete** at `e79c53a` (§6BL.13) |
| **R17D later phases** — move to upgrade, add catalog/custom, quantity source mapping | Not started |
| **`added_catalog` / `added_custom`** | Need adapter/snapshot type extensions before custom/add lines appear in draft graph |
| **Unsupported decision types** | Currently warn/no-op in merge |
| **R17C3** | Document typography still pending |
| **R17C4** | Estimate display policy consumer likely pending before R18 |
| **R18** | Send/public/PDF/Sign/Payment/lifecycle **blocked** |

### 11. R18 guardrails (unchanged)

- **Do not start R18 Send planning or implementation** until scope decisions are stable and presentation alignment (R17C3/R17C4) is explicitly resolved.
- **Do not enable real Edit Option actions** without using the R17D overlay (Phase 2+).
- **R18 should own public/tokenized customer access** when implemented.
- **Do not reuse RoofingClient PDF or `estimateStore`.**

### 12. Next-stage guidance (historical — superseded by §6BI)

**Superseded.** R17D Phase 1 is complete at `43c83a2` (§6BH); R17D Phase 2 code is complete at `f5712ff` (§6BI). See §6BI for current next-stage guidance.

---

## 6BI. R17D PHASE 2 MANUAL QUANTITY UI/API + FULL AUDIT CHECKPOINT

**Status:** **Complete (R17D Phase 2 code + audit).** **Code checkpoint:** **`f5712ff` — feat(proposals): enable manual quantity scope decisions in R17D**. **Docs checkpoint:** **`184d971` — docs: record R17D Phase 2 manual quantity audit**. **For current R17D manual quantity reset / Edit Option resume, read §6BJ** — R17D Phase 2.5 at **`a12fb92`**. **Working tree:** clean after Phase 2.5 code commit `a12fb92`. **Full audit:** **completed** after R17D Phase 2 (static scope, tests, read-only DB verification, desktop/mobile browser, Preview cleanliness, DB sanity after save). **Migration:** `20260618_009_create_proposal_option_scope_decisions.sql` **appears applied** to the currently configured Supabase project **`rhquhnujjnzjhweypavd`** (Supabase dashboard label: **Production**; manual SQL Editor apply; verification query returned constraints/indexes/policies). **This was not a separate DEV target — no separate DEV Supabase target is configured.**

### 1. Executive verdict

- **R17D Phase 2 code, tests, and full audit complete and stable.**
- **First real Edit Option action enabled:** **`manual_quantity` only.**
- Uses **R17D Phase 1 scope decision overlay** (`43c83a2`, §6BH) — not direct line-item patching.
- **Full post-Phase-2 audit passed** — static scope, **547/547** tests, read-only DB verification, desktop/mobile browser manual quantity flow, Preview cleanliness, DB sanity after save.
- **Other Edit Option actions remain disabled** (Remove, Mark N/A, Hide, Add catalog/custom, Move upgrade, Quantity source).
- **R18 Send / public route / PDF / Sign / Payment / lifecycle remain blocked.**

### 2. R17D Phase 2 purpose

- Enables the first real Edit Option action: **`manual_quantity`**.
- Persists contractor intent as a **`manual_quantity`** row in `proposal_option_scope_decisions`.
- Save path: **`upsertDraftScopeDecision` → `refreshDraftPricing` → refreshed `persistedGraph` / workbench render**.
- **`proposal_line_items` remain derived snapshot output** — rebuilt through refresh, never patched as decision truth.
- **Templates are not mutated** for job-specific scope.

### 3. R17D Phase 2 code artifacts

| Artifact | Path |
|----------|------|
| Action helper | `app/lib/proposalScopeDecisionActions.ts` |
| Action tests | `app/lib/proposalScopeDecisionActions.test.ts` |
| Builder client handler | `app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx` |
| Canvas props | `app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx` |
| Workbench document / drawer wiring | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx` |
| Edit Option drawer quantity section | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEditOptionShell.tsx` |
| Scope Review Set quantity chip | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx` |
| Package zone tooltip copy | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchPackageZone.tsx` |
| Workbench constants / copy tokens | `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts` |
| Presenter test update | `app/lib/proposalBuilderWorkbenchEstimatePresenter.test.ts` |
| Store integration test update | `app/lib/proposalRecordStore.test.ts` |

**Not changed in Phase 2 code commit:** docs, package files, migrations, pricing engine, snapshot builder, Preview UI, public route, PDF, Send, Sign, Payment, lifecycle.

### 4. UI behavior

| Surface | Behavior |
|---------|----------|
| **Scope Review “Set quantity” chip** | Enabled on `needs_quantity` rows when persisted draft path (`?proposal=`) is active |
| **Chip / row click** | Opens existing Edit Option drawer **focused on that line** |
| **Edit Option drawer — quantity section** | **Live:** line picker (multi-line), focused line name, decimal numeric input, unit suffix, inline validation, Save/Cancel footer, loading state |
| **Package/header “Edit option”** | Opens drawer in general workflow mode (first scope-review line pre-selected when applicable) |
| **Other drawer sections** | Disabled with honest coming-soon copy |
| **After save** | Drawer closes only after successful persisted decision + refresh; workbench updates from refreshed `persistedGraph` — **no fake local row movement** |

### 5. Other Edit Option actions still disabled

- Remove
- Mark N/A
- Hide from customer
- Add catalog
- Add custom
- Move upgrade
- Quantity source mapping

### 6. Store / action flow

| Step | Detail |
|------|--------|
| Helper | `applyManualQuantityScopeDecision` |
| Validation | Finite; `>= 0`; decimals allowed; empty string rejected |
| Persist | Upserts `decision_type: "manual_quantity"` via `upsertDraftScopeDecision` |
| Refresh | Calls `refreshDraftPricing`; returns updated graph |
| Client | `ProposalBuilderClient.handleApplyManualQuantity` resolves runtime `proposal_option_id` from selected template option via persisted graph option rows |
| Gating | Persisted draft path only — not enabled on unsaved/non-persisted proposal path |
| Context | Reuses existing refresh context / measurement quantity context from `handleRefreshDraftPricing` |
| Feedback | Success uses existing refresh banner pattern; errors surface in drawer |

### 7. Automated validation (pre-commit)

| Check | Result |
|-------|--------|
| `proposalScopeDecisionActions.test.ts` | Added — validation + reject paths |
| `proposalRecordStore.test.ts` | Updated — `applyManualQuantityScopeDecision` integration (decimal, upsert+refresh, second update) |
| `proposalBuilderWorkbenchEstimatePresenter.test.ts` | Updated — resolved snapshot qty moves line from scope review → ready scope |
| Full `app/lib/proposal*.test.ts` batch | **547/547** pass |

**Confirmed in tests:**

- Manual quantity action helper validates and rejects invalid input
- Decimal quantity allowed
- Upsert + refresh flow tested in order
- Second update/refresh preserves manual quantity
- Presenter classification tested for resolved snapshot → ready scope
- No `proposal_line_items` direct update ops used as decision truth

### 8. Full audit results (post-R17D Phase 2)

**Full audit completed** after R17D Phase 2 code at `f5712ff`. Prior docs checkpoint `4446f8d` recorded code save only; this commit records audit completion.

#### 8a. Automated tests

| Check | Result |
|-------|--------|
| `npx tsx --test app/lib/proposal*.test.ts` | **547/547** pass |

#### 8b. Static scope audit — **PASS**

| Check | Result |
|-------|--------|
| Only `manual_quantity` enabled | **Pass** |
| Remove / Mark N/A / Hide / Add catalog / Add custom / Move upgrade / Quantity source | **Disabled/gated** |
| No direct `proposal_line_items` mutation as decision truth | **Pass** |
| No template mutation | **Pass** |
| No pricing engine math changes | **Pass** |
| No snapshot builder math changes | **Pass** |
| No Preview UI changes in Phase 2 commit | **Pass** |
| No public route / PDF / Send / Sign / Payment / lifecycle work | **Pass** |

#### 8c. DB status (read-only verification)

| Check | Result |
|-------|--------|
| `proposal_option_scope_decisions` table exists | **Yes** — REST probe **200** on configured project |
| Migration `20260618_009` | **Appears applied** on **`rhquhnujjnzjhweypavd`** |
| Dashboard label | **Production** — **not a separate DEV target** |
| Separate DEV Supabase target configured | **No** — future schema/browser testing should use a true DEV target if possible |

#### 8d. Browser audit — **PASS**

Completed through **live Playwright MCP session** (saved `storageState` at `C:\Users\sabre\.cursor\fielddive-playwright-auth.json` was **expired for fresh contexts**).

**Stamped draft:**

- Builder: `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`, `page=estimate`

| Step | Result |
|------|--------|
| Builder desktop (~1280×900) | Loaded; Estimate workbench visible |
| Scope Review before edit | **7** rows |
| Set quantity enabled | Only on `needs_quantity` rows |
| Mark N/A / Remove | **Disabled** |
| Set quantity → Edit Option drawer | Opens existing R17C2 drawer, focused on **Starter** |
| Saved quantity | **18** |
| Success feedback | Toast: **“Manual quantity saved and draft pricing refreshed.”** |
| Post-save workbench | Refreshed from `persistedGraph`; **Starter** → Customer-ready (**18 Linear foot**, **$72.00**); Scope Review **7 → 6** |
| Hard refresh | Manual quantity **preserved** |
| Console errors on save flow | **None** |
| Standalone “Refresh draft pricing” banner | **Not visible** — graph not stale after save-orchestrated `refreshDraftPricing`; save path exercised refresh |

#### 8e. Preview audit — **PASS**

| Check | Result |
|-------|--------|
| Preview loads | Yes — `/tools/roofing/proposals/preview?job=&proposal=&page=estimate` |
| Starter reflected | **$72.00** in included scope via snapshot graph |
| Builder-only labels absent | No “Needs quantity”, “Set quantity”, “Scope Review”, “Edit Option”, “Customer price”, “Qty Not resolved” |
| Lifecycle actions | No Send/Sign/Payment/PDF/public lifecycle enabled |

#### 8f. Disabled future actions audit — **PASS**

Mark N/A, Remove, Hide from customer, Add catalog, Add custom, Move to upgrade, Quantity source mapping — all **disabled** with honest coming-soon copy; no fake success.

#### 8g. Mobile audit (~390px) — **PASS**

Builder Estimate workbench usable; Scope Review rows wrap; Set quantity reachable; Edit Option drawer full-width/readable; numeric input and Save/Cancel footer usable; no horizontal overflow observed.

#### 8h. DB sanity after browser save (read-only)

| Check | Result |
|-------|--------|
| Active `manual_quantity` decision rows | **Exactly 1** for Starter on Standard option |
| Payload | `{ quantity: 18, quantity_display_label: "18 Linear foot" }` |
| Rebuilt snapshot quantity | Verified via UI/Preview (**18 Linear foot**, **$72.00**) |
| Leakage to other options | **No evidence** |
| Direct `proposal_line_items` patch as decision truth | **No** — decision row + refresh rebuild path |

**Decision row snapshot (read-only REST, service role):**

- `proposal_option_id`: `241c56d3-497f-4e32-894f-cb747274fb4d` (Standard)
- `source_template_item_id`: `8e8ad03f-9a2e-46f3-940e-0cf578537878` (Starter)
- `payload_json.quantity`: **18**

**Auth path note:** use `C:\Users\sabre\.cursor\fielddive-playwright-auth.json` (not `C:\Users\sabre.cursor\...` typo path).

### 9. Source-of-truth unchanged (R17D Phase 2 code commit)

- **No docs/package/migration changes** in Phase 2 code commit
- **No pricing engine math changes** · **No snapshot builder math changes**
- **No Preview UI changes** · **No public route** · **No PDF**
- **No Send / Sign / Payment / lifecycle work**
- Migration `20260618_009` **appears applied** on configured project `rhquhnujjnzjhweypavd` (Production-labeled; not a separate DEV target)

### 10. Known follow-ups

| Follow-up | Stage |
|-----------|-------|
| **Refresh/resave Playwright storageState** | **Housekeeping** — `C:\Users\sabre\.cursor\fielddive-playwright-auth.json` (expired for fresh contexts; audit used live MCP session) |
| **Configure true DEV Supabase target** | **DB environment follow-up** — before future migrations/browser tests (current apply/audit on Production-labeled configured project) |
| **Optional TypeScript cleanup** | Later — `ProposalBuilderCanvas.tsx` nullability note; known pre-existing `RoofingClientV2.tsx` errors; test fixture typing |
| **Optional standalone Refresh draft pricing audit** | When stale banner is visible (not shown post-save because graph was fresh) |
| **R17D Phase 2.5** — clear/reset manual quantity | **Complete** at `a12fb92` (§6BJ); **full audit passed** |
| **R17D Phase 3A** — exclude/remove | **Complete** at `2dca3c0` (§6BK) |
| **R17D Phase 3B (Mark N/A)** | **Superseded** — product drift; visible UI removed at `8dd8e7f` (§6BL.12); **do not implement** |
| **R17D Phase 4** — hide from customer | **Complete** at `e79c53a` (§6BL.13) |
| **R17D later phases** — move to upgrade, add catalog/custom, quantity source mapping | Not started |
| **R17C3** | Document typography still pending |
| **R17C4** | Estimate display policy consumer likely pending before R18 |
| **R18** | Send/public/PDF/Sign/Payment/lifecycle **blocked** |

### 11. R18 guardrails (unchanged)

- **Do not start R18 Send planning or implementation** until scope decisions are stable, browser smoke passes, and presentation alignment (R17C3/R17C4) is explicitly resolved.
- **Do not enable additional Edit Option actions** without using the R17D overlay.
- **R18 should own public/tokenized customer access** when implemented.
- **Do not reuse RoofingClient PDF or `estimateStore`.**

### 12. Next-stage guidance (historical — superseded by §6BK)

**Superseded.** R17D Phase 2 is complete at `f5712ff` (§6BI); R17D Phase 2.5 is complete at `a12fb92` (§6BJ); R17D Phase 3A is complete at `2dca3c0` (§6BK). See §6BK for current next-stage guidance.

---

## 6BJ. R17D PHASE 2.5 MANUAL QUANTITY RESET + FULL AUDIT CHECKPOINT

**Status:** **Complete (R17D Phase 2.5 code + audit).** **Code checkpoint:** **`a12fb92` — feat(proposals): add manual quantity reset in R17D**. **Docs checkpoint:** **`c9fe4a5` — docs: record R17D Phase 2.5 manual quantity reset audit**. **For current R17D exclude/remove Edit Option resume, read §6BK** — R17D Phase 3A at **`2dca3c0`**. **Working tree:** clean after Phase 2.5 code commit `a12fb92`. **Full audit:** **completed** after R17D Phase 2.5 (tests, desktop browser reset flow, hard refresh, Preview cleanliness, read-only DB sanity, mobile layout).

### 1. Executive verdict

- **R17D Phase 2.5 completes the first real Edit Option action loop.**
- **Phase 2** (`f5712ff`, §6BI) enabled **`manual_quantity` set/update**.
- **Phase 2.5** (`a12fb92`) adds the durable **reset/clear** path for **`manual_quantity`**.
- Contractor can return a manually-set line to measurement/template-driven quantity behavior.
- Uses existing **scope decision overlay** + **`refreshDraftPricing`** truth path — not direct line-item patching.
- **Other Edit Option actions remain disabled** except **Remove from option** (complete in Phase 3A at `2dca3c0`, §6BK), **Hide from customer** (complete in Phase 4 at `e79c53a`, §6BL.13), **Set quantity**, and **manual quantity reset**. **Mark N/A visible UI removed** at `8dd8e7f` (§6BL.12); Add catalog/custom, Move upgrade, Quantity source remain disabled.
- **R18 Send / public route / PDF / Sign / Payment / lifecycle remain blocked.**

### 2. R17D Phase 2.5 purpose

- Safe undo path for the first real Edit Option action.
- **Clear/deactivate** active `manual_quantity` decision for targeted runtime proposal option + source template item.
- **Refresh** rebuilds `proposal_line_items` through normal preview/merge path.
- UI never holds raw decision IDs — clear uses **by-target** store helper.
- **Templates are not mutated** for job-specific scope.

### 3. R17D Phase 2.5 code artifacts

| Artifact | Path |
|----------|------|
| By-target clear store helper | `app/lib/proposalScopeDecisionStore.ts` — `clearDraftScopeDecisionByTarget` |
| Clear action helper | `app/lib/proposalScopeDecisionActions.ts` — `clearManualQuantityScopeDecision` |
| Store tests | `app/lib/proposalScopeDecisionStore.test.ts` |
| Action tests | `app/lib/proposalScopeDecisionActions.test.ts` |
| Record store integration tests | `app/lib/proposalRecordStore.test.ts` |
| Presenter `manualQuantityActive` flag | `app/lib/proposalBuilderWorkbenchEstimatePresenter.ts` |
| Presenter tests | `app/lib/proposalBuilderWorkbenchEstimatePresenter.test.ts` |
| Workbench constants / copy tokens | `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts` |
| Builder client clear handler | `app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx` |
| Canvas props | `app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx` |
| Workbench document wiring | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx` |
| Edit Option drawer manual-active + reset UI | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEditOptionShell.tsx` |
| Customer-ready **Edit quantity** chip | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx`, `ProposalBuilderWorkbenchLineRow.tsx` |

**Not changed in Phase 2.5 code commit:** docs, package files, migrations, pricing engine, snapshot builder math, Preview UI, public route, PDF, Send, Sign, Payment, lifecycle.

### 4. Store / action behavior

| Step | Detail |
|------|--------|
| Store helper | `clearDraftScopeDecisionByTarget` |
| Action helper | `clearManualQuantityScopeDecision` |
| Clear targets | `company_id`, `proposal_id`, `proposal_option_id`, `decision_type: "manual_quantity"`, `source_template_item_id`, `active = true` |
| Persist | Deactivates matching `manual_quantity` row only |
| Audit | Appends same audit event style as existing clear path |
| Refresh | Calls `refreshDraftPricing`; returns updated graph |
| Client | `ProposalBuilderClient.handleClearManualQuantity` resolves runtime `proposal_option_id` same as Phase 2 apply |
| Gating | Persisted draft path only |
| Line items | Rebuilt through refresh — **no direct `proposal_line_items` mutation** |
| Templates | **Not mutated** |
| Errors | Throws safely if no active row; UI surfaces inline errors in drawer |

### 5. UI behavior

| Surface | Behavior |
|---------|----------|
| **Customer-ready manual quantity rows** | Small **“Edit quantity”** action (detected via snapshot `quantitySourceLabel === "Manual"` / presenter `manualQuantityActive`) |
| **Edit quantity click** | Opens existing Edit Option drawer **focused on that line** |
| **Drawer manual-active state** | Focused line name; current quantity read-only; **“Manual quantity”** badge; helper: *“Return this line to measurement-driven quantity for this package.”*; secondary **“Use measurement quantity”** |
| **During clear** | **“Clearing…”** loading state; inline errors on failure |
| **After success** | Drawer closes (consistent with Phase 2 save); success toast: **“Manual quantity cleared and draft pricing refreshed.”** |
| **Scope Review Save quantity** | Unchanged from Phase 2 |
| **Other drawer sections** | Disabled/gated with honest coming-soon copy |

### 6. Other Edit Option actions still disabled

- Remove
- Mark N/A
- Hide from customer
- Add catalog
- Add custom
- Move upgrade
- Quantity source mapping

### 7. Automated validation

| Check | Result |
|-------|--------|
| Full `app/lib/proposal*.test.ts` batch | **559/559** pass |
| Store tests | By-target clear; no active row; type isolation; option isolation |
| Action tests | Missing-ID validation |
| Record store tests | Apply → clear → measurement/template path; clear without measurement → `needs_quantity`; second refresh preserves clear; reject when no active row; zero `proposal_line_items` update ops |
| Presenter tests | `manualQuantityActive` flag; cleared unresolved line returns to Scope Review |

### 8. Full audit results (post-R17D Phase 2.5)

**Stamped draft:**

- Builder: `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`

#### 8a. Desktop reset flow — **PASS**

| Step | Result |
|------|--------|
| Pre-clear state | Starter **18 Linear foot / $72.00** in Customer-ready |
| Edit quantity → drawer | Manual-active UI: read-only qty, badge, helper, **Use measurement quantity** |
| Clear action | Success toast; workbench refreshed from `persistedGraph` |
| Post-clear workbench | Starter → Scope Review **#1 Needs quantity**; **6 customer-ready / 7 to review** |
| Hard refresh | Cleared state **persisted** |
| Console errors on clear flow | **None** (post import-fix) |

#### 8b. Preview audit — **PASS**

| Check | Result |
|-------|--------|
| Preview loads | Yes |
| Starter after clear | **Absent** from included scope (6 items) |
| Builder-only labels absent | No Needs quantity, Set quantity, Edit quantity, Scope Review, Edit Option, etc. |
| Lifecycle actions | Send/Sign/Payment/PDF/public remain disabled |

#### 8c. DB sanity (read-only) — **PASS**

| Check | Result |
|-------|--------|
| `manual_quantity` row for Starter | Exists; **`active=false`** |
| Active `manual_quantity` on proposal | **Zero** |
| Other options | **Unaffected** |
| Direct `proposal_line_items` patch | **No** — decision deactivate + refresh rebuild |

#### 8d. Mobile (~390px) — **PASS (layout)**

| Check | Result |
|-------|--------|
| Builder Estimate workbench | Usable |
| Edit Option drawer | Full-width/readable; footer actions visible |
| Full mobile DB-write clear flow | **Optional follow-up** — desktop verified persisted clear path |

#### 8e. Implementation note (pre-audit fix)

- Missing import `WORKBENCH_USE_MEASUREMENT_QUANTITY_LABEL` in `ProposalBuilderWorkbenchEditOptionShell.tsx` caused runtime crash on Edit quantity — **fixed in `a12fb92` before audit completion**.

### 9. Source-of-truth unchanged (R17D Phase 2.5 code commit)

- **No docs/package/migration changes** in Phase 2.5 code commit
- **No SQL or Supabase changes** in commit step
- **No pricing engine math changes** · **No snapshot builder math changes**
- **No Preview UI changes** · **No public route** · **No PDF**
- **No Send / Sign / Payment / lifecycle work**

### 10. Known follow-ups

| Follow-up | Stage |
|-----------|-------|
| **Optional full mobile DB-write reset flow audit** | Housekeeping |
| **Refresh/resave Playwright storageState** | Housekeeping |
| **Configure true DEV Supabase target** | DB environment follow-up — continue using current configured project as approved working DB until then |
| **R17D Phase 3B (Mark N/A)** | **Superseded** — Mark N/A was product drift; visible UI removed at `8dd8e7f` (§6BL.12); **do not implement Mark N/A** |
| **R17D Phase 4** — hide from customer | **Complete** at `e79c53a` (§6BL.13) |
| **R17D later phases** — move to upgrade, add catalog/custom, quantity source mapping | Not started |
| **R17C3** | Document typography still pending |
| **R17C4** | Estimate display policy consumer likely pending before R18 |
| **R18** | Send/public/PDF/Sign/Payment/lifecycle **blocked** |

### 11. R18 guardrails (unchanged)

- **Do not start R18 Send planning or implementation** until scope decisions are stable, browser smoke passes, and presentation alignment (R17C3/R17C4) is explicitly resolved.
- **Do not enable additional Edit Option actions** without using the R17D overlay.
- **R18 should own public/tokenized customer access** when implemented.
- **Do not reuse RoofingClient PDF or `estimateStore`.**

### 12. Next-stage guidance (historical — superseded by §6BK)

**Superseded.** R17D Phase 2 is complete at `f5712ff` (§6BI); R17D Phase 2.5 is complete at `a12fb92` (§6BJ); R17D Phase 3A is complete at `2dca3c0` (§6BK). See §6BK for current next-stage guidance.

---

## 6BK. R17D PHASE 3A EXCLUDE / REMOVE FROM OPTION + FULL AUDIT CHECKPOINT

**Status:** **Complete (R17D Phase 3A code + audit).** **Code checkpoint:** **`2dca3c0` — feat(proposals): add exclude option scope decisions in R17D**. **Docs checkpoint:** **`c4dcf88` — docs: record R17D Phase 3A exclude/remove from option audit** (Phase 3A docs complete; **current resume: §6BL** Audit Remediation Track). **Working tree:** clean after code commit `2dca3c0`. **Full audit:** **completed** after R17D Phase 3A (tests, desktop browser remove/restore flow, hard refresh, Preview cleanliness, disabled future actions, mobile layout). **Post-Phase-3A whole-app audit** subsequently triggered Audit Remediation Track (§6BL).

### 1. Executive verdict

- **R17D Phase 3A implements exclude/remove from this proposal option plus restore.**
- **This is different from Mark N/A** — Mark N/A was **product drift**; visible UI **removed** at `8dd8e7f` (§6BL.12); **do not implement Mark N/A**.
- **`excluded` means:** *“This template line is not part of this package for this job.”*
- **Customer Preview result:** line is **absent** from customer estimate — **no customer-facing N/A row**.
- **Builder result:** line leaves customer-ready / scope review / hard blocker zones and appears in Builder-only **“Removed from this option”** decision trace zone.
- **Restore result:** **“Include in this option again”** clears active `excluded` and refreshes back to normal template/measurement classification.
- Uses existing **scope decision overlay** + **`refreshDraftPricing`** truth path — **not** direct line-item patching or template mutation.
- **Phase 3B (Mark N/A) superseded** — Mark N/A is product drift; visible UI removed at `8dd8e7f` (§6BL.12); **do not implement**.
- **R18 Send / public route / PDF / Sign / Payment / lifecycle remain blocked.**

### 2. Product boundary (exclude vs Mark N/A)

| Concept | Phase 3A (`excluded`) | Mark N/A / `not_applicable` — **superseded (drift)** |
|---------|----------------------|------------------------------------------------------|
| Meaning | Line not part of this package for this job | Was proposed Phase 3B; **not Roofr-aligned** — **do not implement** |
| Customer Preview | Line **omitted** — no row | N/A — no customer-facing N/A row |
| Builder UI | **Removed from this option** trace zone | Visible UI **removed** at `8dd8e7f` (§6BL.12) |
| Status | **Complete** at `2dca3c0` | **Superseded** — schema/type may exist historically; **no behavior/UI** |

### 3. R17D Phase 3A code artifacts

| Artifact | Path |
|----------|------|
| Excluded merge (before pricing) | `app/lib/proposalScopeDecisionMerge.ts` |
| Merge tests | `app/lib/proposalScopeDecisionMerge.test.ts` |
| Conflict clear helper | `app/lib/proposalScopeDecisionStore.ts` — `clearDraftScopeDecisionByTargetIfActive` |
| Exclude/restore actions | `app/lib/proposalScopeDecisionActions.ts` — `excludeLineFromProposalOption`, `clearExcludedLine` |
| Action tests | `app/lib/proposalScopeDecisionActions.test.ts` |
| Draft graph scope decisions | `app/lib/proposalRecordStore.ts` — `ProposalDraftGraph.scopeDecisions` |
| Presenter decision trace zone | `app/lib/proposalBuilderWorkbenchEstimatePresenter.ts` |
| Presenter tests | `app/lib/proposalBuilderWorkbenchEstimatePresenter.test.ts` |
| Workbench constants / copy tokens | `app/tools/roofing/proposals/builder/proposalBuilderConstants.ts` |
| Builder client exclude/restore handlers | `app/tools/roofing/proposals/builder/ProposalBuilderClient.tsx` |
| Canvas props | `app/tools/roofing/proposals/builder/ProposalBuilderCanvas.tsx` |
| Workbench document wiring | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEstimateDocument.tsx` |
| Edit Option drawer exclude section | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchEditOptionShell.tsx` |
| Customer-ready **Remove from option** chip | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchReadyScopeZone.tsx`, `ProposalBuilderWorkbenchLineRow.tsx` |
| Scope review secondary remove | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchAttentionZone.tsx` |
| Decision trace zone (new) | `app/tools/roofing/proposals/builder/ProposalBuilderWorkbenchDecisionTraceZone.tsx` |
| Fixture updates (`scopeDecisions: []`) | `app/lib/proposalDraftGraphAdapter.test.ts`, `proposalDocumentContext.test.ts`, `proposalCustomerPreviewViewModel.test.ts`, `proposalDocumentTokenResolver.test.ts` |

**Note:** `app/lib/proposalRecordStore.test.ts` was expected in planning but had **no final changes** and was **not committed**.

**Not changed in Phase 3A code commit:** docs, package files, migrations, pricing engine math, snapshot builder math, Preview UI, public route, PDF, Send, Sign, Payment, lifecycle.

### 4. Source-of-truth / merge behavior

| Rule | Detail |
|------|--------|
| Apply timing | Active `excluded` decisions applied **before** pricing |
| Pricing input | Matching template lines **omitted** from merged pricing input |
| Totals / blockers | Omitted lines do **not** contribute to subtotals, blockers, or rebuilt `proposal_line_items` |
| Merge report | Records applied `excluded` decisions |
| `not_applicable` | Typed only — **do not implement** (Mark N/A is product drift; visible UI removed `8dd8e7f`, §6BL.12) |
| Precedence | `excluded` **wins** over `manual_quantity` on same target |
| Conflict clear | Exclude action clears conflicting `manual_quantity` in action layer |
| Truth path | `refreshDraftPricing` remains authoritative |
| Line items | **No direct `proposal_line_items` mutation** |
| Templates | **Not mutated** |

### 5. Graph / presenter behavior

| Rule | Detail |
|------|--------|
| Draft graph | `ProposalDraftGraph` includes active `scopeDecisions` via `getDraftGraph` |
| Presenter input | Workbench presenter receives active scope decisions for selected option |
| Trace zone | `decisionTraceZone.excluded` — **“Removed from this option”** |
| Zone exclusion | Excluded lines do **not** appear in customer-ready, scope review, or hard blocker zones |
| Trace row content | Line name; optional quantity context; **Removed** pill; restore action metadata |
| Header counts | Ready/review/blocker tallies **exclude** removed lines |

### 6. Store / action helpers

| Helper | Behavior |
|--------|----------|
| `excludeLineFromProposalOption(...)` | Validates IDs; clears conflicting `manual_quantity`; upserts `decision_type: "excluded"`; calls `refreshDraftPricing`; returns updated graph |
| `clearExcludedLine(...)` | Deactivates active `excluded` by target; calls `refreshDraftPricing`; returns updated graph |
| `clearDraftScopeDecisionByTargetIfActive` | Internal conflict helper |
| UI | Remains unaware of decision IDs |

### 7. UI behavior

| Surface | Behavior |
|---------|----------|
| **Customer-ready rows** | **“Remove from option”** chip |
| **Scope review rows** | Optional secondary **“Remove from option”** |
| **Remove click** | Opens existing Edit Option drawer focused on line |
| **Drawer exclude section** | Live **“Remove from this option”**; helper: *“This line won't appear on the customer proposal for this package. The template is unchanged.”* |
| **During exclude** | **“Removing…”** loading state; inline errors on failure |
| **After success** | Success toast after persisted decision + refresh: **“Line removed from this option and draft pricing refreshed.”** |
| **Decision trace zone** | **“Removed from this option”** — visible when count > 0 |
| **Restore** | **“Include in this option again”** — success: **“Line restored to this option and draft pricing refreshed.”** |
| **Not used** | No destructive delete modal; no generic admin form; no combined Remove/N/A action |

### 8. Other Edit Option actions still disabled

- **Mark N/A** — **removed from visible UI** at `8dd8e7f` (§6BL.12); **do not implement**
- Hide from customer
- Add catalog
- Add custom
- Move upgrade
- Quantity source mapping

### 9. Automated validation

| Check | Result |
|-------|--------|
| Full `app/lib/proposal*.test.ts` batch | **564/564** pass |
| Merge tests | Excluded omit; totals; merge report; manual_quantity precedence; option isolation |
| Action tests | Exclude/clear order; validation; conflict clear; no line-item patch |
| Presenter tests | Trace zone routing; zone exclusion; restore classification |
| Fixture updates | `scopeDecisions: []` on draft graph helpers |

### 10. Full audit results (post-R17D Phase 3A)

**Stamped draft:**

- Builder: `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`

#### 10a. Desktop remove/restore flow — **PASS**

| Step | Result |
|------|--------|
| Builder / Estimate workbench loads | Yes |
| Remove from option → drawer focused on Shingles | Yes |
| Helper copy (template unchanged) | Confirmed |
| Apply remove + loading + success toast | Pass |
| Line left ready zone | **6 → 5** customer-ready |
| Trace zone | Shingles + **Removed** |
| Hard refresh | Removed state **persisted** |
| Include in this option again + success toast | Pass |
| Line returned to customer-ready | **6 lines** |
| Hard refresh after restore | Restored state **persisted** |
| Console errors on Builder loads | **None** |

#### 10b. Preview audit — **PASS**

| Check | Result |
|-------|--------|
| Shingles excluded from estimate included scope | **Absent** (5 items remain) |
| Package descriptor “25 Year Shingles” | Still present as product/package name — **expected** |
| Builder-only labels absent | No Removed from this option, Remove from option, Include in this option again, Scope Review, Edit Option, Customer price, Qty Not resolved, Mark N/A, Contractor estimate workbench |
| Lifecycle actions | Send / Sign / Payment remain disabled in header |

#### 10c. Disabled future actions — **PASS**

| Control | Result |
|---------|--------|
| Mark N/A | **Removed from visible UI** at `8dd8e7f` (post-Phase-3A drift cleanup; §6BL.12) |
| Send / Sign / Payment | Disabled |
| Add Page | Disabled |
| Browse catalog / Add custom / Move upgrade / Hide / Quantity source | Disabled / coming soon |

#### 10d. Mobile (~390px) — **PASS**

| Check | Result |
|-------|--------|
| Remove from option reachable | Yes |
| Trace zone + restore when excluded | Yes |
| Drawer full-width within viewport | Yes |
| Helper copy visible | Yes |
| Horizontal overflow | **None** |

#### 10e. DB sanity — **NOT DIRECTLY QUERIED**

| Check | Result |
|-------|--------|
| Direct read-only query on `proposal_option_scope_decisions` | **Not run** in this pass |
| Persistence cycles | Exclude + hard refresh + restore + hard refresh **verified in browser** |
| Unit tests | Store/action lifecycle verified on mock Supabase |
| Optional follow-up | Direct row sanity query for active `excluded` decisions if desired before future work |

### 11. Protected systems unchanged (R17D Phase 3A code commit)

- **No docs/package/migration changes** in Phase 3A code commit
- **No SQL or Supabase changes** in commit step
- **No pricing engine math changes** · **No snapshot builder math changes**
- **No Preview UI changes** · **No public route** · **No PDF**
- **No Send / Sign / Payment / lifecycle work**

### 12. Known follow-ups

| Follow-up | Stage |
|-----------|-------|
| **This docs checkpoint (Phase 3A)** | **Complete** at `c4dcf88` |
| **Post-Phase-3A whole-app audit + remediation** | **§6BL** — in progress |
| **Optional direct DB row sanity query** for `excluded` decisions | Housekeeping |
| **Refresh/resave Playwright storageState** | Housekeeping |
| **Configure true DEV Supabase target** | DB environment follow-up — continue using current configured project as approved working DB until then |
| **R17D Phase 3B (Mark N/A)** | **Superseded** — Mark N/A was product drift; visible UI removed at `8dd8e7f` (§6BL.12); **do not implement Mark N/A** |
| **R17D Phase 4** — hide from customer | **Complete** at `e79c53a` (§6BL.13) |
| **R17D later phases** — move to upgrade, add catalog/custom, quantity source mapping | Not started |
| **R17C3** | Document typography still pending |
| **R17C4** | Estimate display policy consumer likely pending before R18 |
| **R18** | Send/public/PDF/Sign/Payment/lifecycle **blocked** |

### 13. R18 guardrails (unchanged)

- **Do not start R18 Send planning or implementation** until scope decisions are stable, browser smoke passes, and presentation alignment (R17C3/R17C4) is explicitly resolved.
- **Do not enable additional Edit Option actions** without using the R17D overlay.
- **R18 should own public/tokenized customer access** when implemented.
- **Do not reuse RoofingClient PDF or `estimateStore`.**

### 14. Next-stage guidance (after Phase 3A — historical)

**Superseded by §6BL.** Post-Phase-3A whole-app audit triggered Audit Remediation Track; **new feature roadmap frozen** until remediation complete. **Do not resume R17D Phase 3B / R18 from this section.**

**Historical immediate next (Phase 3A era — no longer current):**

1. **Refresh/resave Playwright storageState** at `C:\Users\sabre\.cursor\fielddive-playwright-auth.json`
2. **Plan/configure a true DEV Supabase target** before future migrations/browser tests (continue using current configured project as approved working database)
3. **Plan R17D Phase 3B** — Mark N/A — **superseded** by Mark N/A drift cleanup at `8dd8e7f` (§6BL.12); **do not implement Mark N/A**; **or R17C3** typography — **do not auto-start R18**

**Current resume:** **§6BL** — continue audit remediation.

**Continue preserving (historical Phase 3A contract):**

- R17D Phase 1 overlay + merge-on-refresh contract (`43c83a2`, §6BH)
- R17D Phase 2 manual quantity set/update (`f5712ff`, §6BI)
- R17D Phase 2.5 manual quantity reset (`a12fb92`, §6BJ)
- R17D Phase 3A exclude/remove + restore (`2dca3c0`, §6BK)
- R17C2 workbench zones + scope review semantics (`3e65774`, §6BG)
- R17C1 document presentation layer (`9c2244a`, §6BF)
- Send / Sign / Payment / PDF / public customer sharing **disabled**
- Preview Estimate **must not** re-import Builder workbench UI
- Pricing trust + snapshot safety

---

## 6BL. AUDIT REMEDIATION TRACK — POST WHOLE-APP AUDIT CHECKPOINT

**Status:** **Complete.** **Second whole-app audit before R18:** **PASS** (§6BL.21). **R18A public proposal architecture planning:** **complete** (§6BM). **R18B4D send-freeze smoke:** **PASS** (§6BM.13). **Code checkpoint:** **`76840d1` — feat(proposals): add env-gated send freeze store wrapper**. **Docs checkpoint:** **pending this commit** (prior: **`5efbe6e`** — docs: record R18A public proposal architecture plan). **Next:** **R18C planning only** — sent graph read path; token/public access architecture; public DTO route boundary; **no public route implementation until planned**.

### 1. Executive verdict

- **Whole-app audit completed** after R17D Phase 3A (`2dca3c0`, §6BK); findings drove **Audit Remediation Track** — not new feature roadmap work.
- **Audit Remediation Track complete** — all targeted remediations done or intentionally deferred.
- **Second whole-app audit before R18 passed** (§6BL.21) — **no blockers found**.
- **Next:** **R18C planning only** (§6BM.13) — sent graph read path / version graph loader; token/public access architecture; public DTO route boundary; **R18B immutable sent snapshot foundation smoke-validated** at `76840d1` (§6BM.13); **do not enable Send/PDF/Sign/Payment/public route/lifecycle** until each R18 phase is explicitly approved.
- **Completed:** Remediation 1 (Preview/customer-trust); Remediation 2A–2B (transactional `refreshDraftPricing` RPC persistence); Remediation 3A (dual spine isolation); transactional create Remediation 4A–4C (`createDraftProposal` RPC persistence); **post-transaction spine audit** (§6BL.11); **Mark N/A drift cleanup** (`8dd8e7f`, §6BL.12); **R17D Phase 4 Hide from customer** (`e79c53a`, §6BL.13); **R17D Phase 4A estimate display policy consumer** (`1424f1e`, §6BL.14); **R17D Phase 4B Builder proposal-level display settings editing** (`38a126e`, §6BL.15); **existing-template-line Edit Option parity closed** for Roofr-aligned scope (§6BL.21).
- **Intentionally deferred (not blockers):** Add catalog, Add custom line, Move to upgrade, Quantity source override, Phase 4C qty/unit/subtotal granularity, Mark N/A (product drift — do not implement), Send/Sign/Payment/PDF/public route/lifecycle (R18+ architecture approval required).
- **Protected systems unchanged across remediation commits:** no Mark N/A behavior, Send/Sign/Payment/PDF/public route/lifecycle enabled; no pricing engine math changes; no direct `proposal_line_items` mutation outside refresh/create persistence paths; no template mutation from Phase 4B display settings edits.
- **DB proposal spine is now:** clean-route guarded; legacy-isolated; transactional on pricing refresh; transactional on initial draft creation; post-transaction audit passed; Mark N/A visible drift removed; **Phase 4 Hide enabled** via scope decisions; **Phase 4A/4B estimate display settings** consumer + Builder editing enabled; **second whole-app audit passed** (§6BL.21).

### 2. Audit Remediation 1 — Preview readiness + customer line visibility

**Commit:** **`6e27716` — fix(proposals): harden preview readiness and customer line visibility**

| Area | Fix |
|------|-----|
| **Preview readiness / gating** | Distinguish **customer-ready Preview** vs **contractor-review Preview** state; no misleading customer-ready language when blockers/stale/incomplete |
| **Customer hidden-line filtering** | Lines with `showOnCustomerDocument: false` omitted from customer Preview scope lists; **option totals remain authoritative** — not re-summed from visible rows |
| **`hiddenButInCalc` vs `internal_only`** | Hidden priced line can be hidden from customer document while still included in totals; **`internal_only` remains non-contributing/omitted** |

| Validation | Result |
|------------|--------|
| Full `app/lib/proposal*.test.ts` batch | **570/570** pass |
| Phase 4 Hide action | **Not enabled** |
| Mark N/A | **Not enabled** |
| Send/Sign/Payment/PDF/public route/lifecycle | **Not enabled** |

### 3. Audit Remediation 2A — Transactional pricing refresh persistence foundation

**Commit:** **`c2c02dc` — feat(proposals): stage transactional pricing refresh persistence**

| Artifact | Detail |
|----------|--------|
| **Persistence module** | `app/lib/proposalDraftPricingRefreshPersistence.ts` — graph integrity invariants, persist payload preparation, RPC wrapper, failure-injection tests |
| **Review-only migration (staged)** | `supabase/migrations/20260624_010_create_refresh_draft_pricing_rpc.sql` |
| **RPC function** | `persist_draft_pricing_refresh_v1(p_payload jsonb)` |
| **Migration apply at checkpoint** | **Staged only** — **not applied** in that commit |
| **Live app path at checkpoint** | Remained **sequential** multi-request persistence |

| Validation | Result |
|------------|--------|
| Full `app/lib/proposal*.test.ts` batch | **579/579** pass |

### 4. Audit Remediation 2B preapply + manual migration apply

**Commit:** **`558e755` — test(proposals): cover pricing refresh rpc gate and hidden line payload**

| Change | Detail |
|--------|--------|
| **RPC env-gate tests** | Added coverage for RPC path selection (pre-default flip) |
| **Snapshot contract fix** | `hiddenButInCalc` priced lines persist as `visible_to_customer: false` |

| Validation | Result |
|------------|--------|
| Full `app/lib/proposal*.test.ts` batch | **584/584** pass |

**Manual migration apply (between 2B preapply and 2B-C):**

| Item | Detail |
|------|--------|
| **Migration** | `20260624_010_create_refresh_draft_pricing_rpc.sql` |
| **Apply method** | Manually applied through **Supabase SQL Editor** |
| **Approved target project ref** | **`rhquhnujjnzjhweypavd`** |
| **Verification** | Function `persist_draft_pricing_refresh_v1` exists; authenticated execute privilege returned **true** |
| **Cursor auto-apply** | **Could not apply automatically** — DB credentials unavailable in environment |
| **Secrets** | **Do not document** connection strings or keys in this handoff |

### 5. Audit Remediation 2B-C — RPC-on test harness

**Commit:** **`68d8747` — test(proposals): fix rpc-on refresh persistence harness**

| Fix | Detail |
|-----|--------|
| **Dual-path coverage** | RPC-off/default-at-that-time suite **and** RPC-on suite both pass |
| **Mock RPC behavior** | Mocked RPC applies payload to mock tables |
| **RPC failure** | Surfaces as store error; **no fallback to sequential** on RPC failure |

| Validation | Result |
|------------|--------|
| RPC-off suite | **587/587** pass |
| RPC-on suite | **587/587** pass |

### 6. Audit Remediation 2B-D — Default transactional RPC persistence

**Commit:** **`377dfe2` — feat(proposals): default refresh pricing persistence to transactional RPC**

| Behavior | Detail |
|----------|--------|
| **Default path** | `refreshDraftPricing` → `persistDraftPricingRefreshViaRpc` → DB function `persist_draft_pricing_refresh_v1(p_payload)` |
| **Sequential escape hatch only** | `USE_REFRESH_DRAFT_PRICING_SEQUENTIAL=1` → `persistDraftPricingRefreshSequential` (explicit dev/test only) |
| **Legacy RPC opt-in env vars** | **Ignored:** `USE_REFRESH_DRAFT_PRICING_RPC`, `NEXT_PUBLIC_USE_REFRESH_DRAFT_PRICING_RPC` |
| **RPC failure** | Surfaces as `ProposalRecordStoreError`; **no sequential fallback** |

**Browser smoke (localhost:3000, normal `npm run dev`, no env flags) — PASS:**

| Check | Result |
|-------|--------|
| Builder load | Pass |
| Manual quantity set/reset | Pass |
| Exclude/remove + restore | Pass |
| Hard refresh | Pass |
| Preview clean | Pass |
| No Builder-only Preview labels | Pass |
| Send/Sign/Payment disabled | Pass |
| Mark N/A disabled | Pass |
| Hide not enabled | Pass |
| Graph corruption | **None observed** |

**Test matrix:**

| Mode | Result |
|------|--------|
| Default (RPC) | **587/587** pass |
| Sequential escape hatch (`USE_REFRESH_DRAFT_PRICING_SEQUENTIAL=1`) | **587/587** pass |
| Legacy RPC env ignored | **587/587** pass |

**Stamped draft (browser smoke):** `job=f5a7d4ab-8758-48e1-848c-e7e4fa7895cb`, `proposal=f3a12198-fc90-4d7d-8079-f0d15b47a2b7`

### 7. Audit Remediation 3A — Dual spine isolation guardrails

**Commit:** **`b65c684` — fix(proposals): add dual spine isolation guardrails for DB vs legacy routes**

**Purpose:** Durable **DB proposal spine** vs **legacy estimate spine** isolation.

**Added:**

| Artifact | Detail |
|----------|--------|
| **`productSpine.ts`** | Route/spine classification helpers |
| **`legacyEstimateSendGuard.ts`** | Legacy send/API fence |
| **Route classification** | `db_job`, `db_proposal_builder`, `db_proposal_preview`, `legacy_estimate`, `legacy_approval`, `unknown` |
| **Mixed spine detection** | Blocks/normalizes mixed DB + legacy route params |
| **Clean DB route guards** | Job Card / Builder / Preview entry guards for UUID DB routes |
| **Clean DB navigation normalization** | No `loadSaved`, no `from=board` on UUID DB job/proposal routes |
| **Legacy send/API fence** | DB flow cannot reach legacy estimate send APIs |
| **Builder/Preview entry guards** | Enforce clean DB spine entry |

| Validation | Result |
|------------|--------|
| Full `app/lib/proposal*.test.ts` batch | **703/703** pass |

**Browser smoke — PASS:**

| Check | Result |
|-------|--------|
| Clean DB Job Card URL | Pass |
| Builder clean URL/load | Pass |
| Preview clean URL/load | Pass |
| No legacy send API from DB flow | Pass |
| Mixed route blocked/normalized | Pass |
| Legacy `loadSaved` route preserved | Pass |

**Not enabled at 3A:** Phase 4 Hide, Mark N/A, Send/Sign/Payment/PDF/public route/lifecycle.

### 8. Audit Remediation 4A — Transactional draft creation persistence foundation

**Commit:** **`daf5268` — feat(proposals): stage transactional draft creation persistence**

**Purpose:** Stage transaction-backed proposal draft creation architecture.

**Added:**

| Artifact | Detail |
|----------|--------|
| **`proposalDraftCreatePersistence.ts`** | Payload builder, invariants, RPC wrapper, diagnostic helper |
| **`proposalDraftCreatePersistence.test.ts`** | Unit/integration tests |
| **Review-only migration** | `supabase/migrations/20260625_011_create_draft_proposal_create_rpc.sql` |
| **Comment-only pointer** | `proposalRecordStore.ts` — documents staged RPC path |

**Behavior at 4A:**

| Item | Detail |
|------|--------|
| **`createDraftProposal` runtime** | Remained **sequential** in 4A |
| **Migration apply** | **Not applied** in 4A |
| **SQL/Supabase** | **Not touched** in 4A |
| **Staged** | Payload builder, invariants, RPC wrapper, diagnostic helper |
| **Diagnostic helper** | **Read-only only** |

| Validation | Result |
|------------|--------|
| `proposalDraftCreatePersistence.test.ts` | **18/18** pass |
| Full `app/lib/proposal*.test.ts` batch | **608/608** pass |

### 9. Audit Remediation 4B — Manual migration apply (create RPC)

**Migration:** **`20260625_011_create_draft_proposal_create_rpc.sql`**

**Apply:** Manually applied by **Timothy** to Supabase project **`rhquhnujjnzjhweypavd`**.

**RPC created:**

| Function | Signature |
|----------|-----------|
| **`persist_draft_proposal_create_v1`** | `(p_payload jsonb)` |

**Verification:**

| Check | Result |
|-------|--------|
| `persist_draft_pricing_refresh_v1(p_payload jsonb)` exists | **Yes** |
| `persist_draft_proposal_create_v1(p_payload jsonb)` exists | **Yes** |
| Authenticated execute grant for both | **true** |

**4B scope:** Migration apply only — **no app code changed**; runtime remained **sequential** after 4B; **not** the default switch.

### 10. Audit Remediation 4C — Default transactional create draft persistence

**Commit:** **`f684b73` — feat(proposals): default create draft persistence to RPC and normalize line section mapping**

**Purpose:** Make initial proposal draft creation **transaction-backed by default**.

**Behavior:**

| Item | Detail |
|------|--------|
| **Default path** | `createDraftProposal` → `persist_draft_proposal_create_v1` |
| **Sequential escape hatch** | `USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL=1` |
| **RPC failure** | **No sequential fallback** |
| **Title fallback parity** | `input.title ?? graph.template.name` preserved |
| **Return shape** | Preserved by re-reading graph after persist |
| **Pricing/template math** | **No rewrite** |

**Blocker found/fixed:**

- Live create initially failed because multi-option/upgrade-group line `section_id`s referenced template sections with **no persisted spine proposal page**.
- **Fix:** Normalize line-bearing section ids (`line_items`, `upgrade_group`) to the spine estimate `line_items` section before persist.
- Invariants **not weakened**; **no hardcoded live UUID**; **no template runtime mutation**; spine document IA preserved.

**Files changed:**

| File | Change |
|------|--------|
| `proposalSnapshotBuilder.ts` | Line section id normalization |
| `proposalSnapshotBuilder.test.ts` | Normalization coverage |
| `proposalDraftCreatePersistence.ts` | RPC default wiring + normalization |
| `proposalDraftCreatePersistence.test.ts` | Expanded coverage |
| `proposalDraftPricingRefreshPersistence.ts` | Shared normalization alignment |
| `proposalRecordStore.ts` | Default RPC path |
| `proposalRecordStore.test.ts` | Store integration |
| `proposalScopeDecisionStore.test.ts` | Related fixture updates |

| Validation | Result |
|------------|--------|
| `proposalDraftCreatePersistence.test.ts` | **19/19** pass |
| Full `app/lib/proposal*.test.ts` batch | **619/619** pass |

**Live smoke — PASS:**

| Check | Result |
|-------|--------|
| Job | `c3a26242-cb5d-4710-9837-589f3bed3269` |
| Proposal | `3db12ac5-707b-497b-94db-dfc8b00feeaa` |
| `persist_draft_proposal_create_v1` observed | **Yes** |
| RPC status | **200** |
| Builder loaded | Pass |
| Hard refresh | Pass |
| Preview | Pass |
| Reopen reused same proposal | Pass |
| No duplicate draft | Pass |
| No `/api/estimate/send` | Pass |
| No `loadSaved` | Pass |
| No `from=board` | Pass |

### 11. Post-transaction spine audit — PASS

**Audit date:** after Remediation 3A (`b65c684`) + 4C (`f684b73`) + line-section mapping normalization. **Verdict:** **PASS** — no blockers before Mark N/A drift cleanup or Phase 4 Hide planning.

**Preconditions verified:**

| Foundation | Checkpoint |
|------------|------------|
| Dual-spine isolation | Remediation 3A (`b65c684`, §6BL.7) |
| Transactional `refreshDraftPricing` | Remediation 2B (`377dfe2`, §6BL.6) |
| Transactional `createDraftProposal` | Remediation 4C (`f684b73`, §6BL.10) |
| Line-section mapping normalization | Remediation 4C (`f684b73`, §6BL.10) |

| Validation | Result |
|------------|--------|
| Working tree | **Clean** at audit time |
| `proposalDraftCreatePersistence.test.ts` | **19/19** pass |
| Full `app/lib/proposal*.test.ts` batch | **619/619** pass |

**Existing draft open/reuse — PASS:**

| Item | Value |
|------|-------|
| Job | `c3a26242-cb5d-4710-9837-589f3bed3269` |
| Proposal | `3db12ac5-707b-497b-94db-dfc8b00feeaa` |
| Builder / Preview / reopen | Pass |

**New draft create RPC — PASS:**

| Item | Value |
|------|-------|
| Job | `26c32fd5-244b-45a9-a2ae-a6ea1bb85830` |
| Proposal | `d3b6e5cc-807b-47e3-8596-986b275f63d7` |
| `persist_draft_proposal_create_v1` | HTTP **200** |
| Reopen reused same proposal | Pass |
| No duplicate draft | Pass |

**Refresh pricing RPC — PASS:**

| Item | Result |
|------|--------|
| `persist_draft_pricing_refresh_v1` | HTTP **200** (manual quantity save path) |

**Legacy isolation — PASS:**

| Check | Result |
|-------|--------|
| No `/api/estimate/send` from DB proposal flows | Pass |
| No `loadSaved` / `from=board` on clean DB paths | Pass |
| Mixed routes blocked/normalized | Pass |
| Legacy `loadSaved` route still reachable | Pass |

**Protected surfaces — PASS:**

| Surface | State |
|---------|-------|
| Send / Sign / Payment / PDF / public route / lifecycle | **Not enabled** |
| Phase 4 Hide | **Complete** at `e79c53a` (§6BL.13) |
| Approval/KV legacy path | **Not wired** into DB proposal spine |

**Mobile 390px — PASS** (minor non-blocking notes):

| Check | Result |
|-------|--------|
| Jobs Board list view | Pass |
| Builder load | Pass |
| Preview direct URL load | Pass |
| Builder Preview button may be off-screen at 390px | Cosmetic / non-spine |

### 12. Mark N/A drift cleanup — complete

**Commit:** **`8dd8e7f` — fix(proposals): remove Mark N/A drift from Builder Edit Option surfaces**

**Purpose:** Remove non-Roofr-aligned Mark N/A visible UI/copy from Builder/Edit Option surfaces.

**Product decision:**

| Rule | Detail |
|------|--------|
| Mark N/A is drift | **Not** Roofr-aligned product work |
| Do not implement Mark N/A | **No** behavior, persistence, scope decisions, or future-feature copy |
| Omission path | **Remove / Exclude / Restore** only |

**Removed from:**

| Surface | Change |
|---------|--------|
| Edit Option disabled shell | `mark_na` entry removed |
| Scope review chips | `mark_na` removed from future actions |
| Decision-trace bucket | `notApplicable` bucket removed |
| Attention zone / helper / intro copy | No applicability / Mark N/A language |

**Preserved:**

| Item | State |
|------|-------|
| Remove / Exclude / Restore | **Live** |
| Set quantity | **Live** |
| Hide from customer | **Live** at `e79c53a` (§6BL.13) — was disabled shell only before Phase 4 |

**Files changed:** `proposalBuilderWorkbenchEstimatePresenter.ts`, `ProposalBuilderWorkbenchAttentionZone.tsx`, `ProposalBuilderWorkbenchEditOptionShell.tsx`, `proposalBuilderConstants.ts`

| Validation | Result |
|------------|--------|
| `proposalBuilderWorkbenchEstimatePresenter.test.ts` | **25/25** pass |
| Full `app/lib/proposal*.test.ts` batch | **619/619** pass |

**Browser smoke — PASS:**

| Check | Result |
|-------|--------|
| Mark N/A not visible on Builder/Edit Option (desktop + 390px) | Pass |
| Preview has no Mark N/A text | Pass |
| Preview customer-clean | Pass |
| Hide shell present, disabled | Pass (historical at `8dd8e7f`; **superseded** — Hide **live** at `e79c53a`, §6BL.13) |
| Send disabled | Pass |
| No `/api/estimate/send` | Pass |

### 13. R17D Phase 4 — Hide from customer — complete

**Commit:** **`e79c53a` — feat(proposals): enable hide from customer scope decisions**

**Purpose:** Roofr-aligned hide-from-customer behavior — customer document omits the line; contractor Builder retains visibility; line stays priced/included in option totals.

**Research basis:**

| Source | Finding |
|--------|---------|
| Roofr help / proposal template docs | Setting-level show/hide line item **details** (subtotals, qty, unit prices) in estimate settings |
| Roofr Masterclass — Multi-Option Proposals | **Item-level** hide from customer while contractor still sees the line |
| Mark N/A | **Product drift** — **not implemented** (§6BL.12) |

**Behavior:**

| Rule | Detail |
|------|--------|
| Scope decision | Existing `visibility_override` with payload `{ visible_to_customer: false }` |
| Merge | Sets `hiddenButInCalc` on pricing input |
| Snapshot | Persists `visible_to_customer: false` |
| Preview / customer document | Omits hidden line via `showOnCustomerDocument: false`; **option totals remain authoritative** |
| Builder | Line remains visible with **“Hidden from customer”** indicator |
| Pricing | Hidden line **remains priced and included** in option totals |
| Restore visibility | Clears hide decision only (`clearCustomerVisibilityHide`) |
| Exclude/remove | Clears active hide; exclude wins over visibility override in merge |
| Manual quantity | Can coexist with hide |
| Not | `excluded`, `internal_only`, Mark N/A, or direct `proposal_line_items` UI mutation |

**Persistence:**

| Path | Detail |
|------|--------|
| UI | Creates/clears `visibility_override` scope decisions only |
| Refresh | Transactional `refreshDraftPricing` → `persist_draft_pricing_refresh_v1` |
| `proposal_line_items` | **No direct UI mutation** — derived through refresh |

**Files changed:**

| Layer | Files |
|-------|-------|
| Lib | `proposalScopeDecisionActions.ts`, `proposalScopeDecisionActions.test.ts`, `proposalScopeDecisionMerge.ts`, `proposalScopeDecisionMerge.test.ts`, `proposalScopeDecisionTypes.ts`, `proposalSnapshotBuilder.ts` |
| Builder | `ProposalBuilderCanvas.tsx`, `ProposalBuilderClient.tsx`, `ProposalBuilderWorkbenchEditOptionShell.tsx`, `ProposalBuilderWorkbenchEstimateDocument.tsx`, `ProposalBuilderWorkbenchLineRow.tsx`, `ProposalBuilderWorkbenchReadyScopeZone.tsx`, `proposalBuilderConstants.ts` |

| Validation | Result |
|------------|--------|
| Full `app/lib/proposal*.test.ts` batch | **624/624** pass |

**Browser smoke — PASS (proposal `3db12ac5-707b-497b-94db-dfc8b00feeaa`):**

| Check | Result |
|-------|--------|
| Hide Underlayment → `visibility_override` upsert + `persist_draft_pricing_refresh_v1` | HTTP **200** |
| Builder “Hidden from customer” badge + unchanged line amount | Pass |
| Hard refresh preserves hidden state | Pass |
| Preview omits hidden Underlayment line | Pass |
| Restore visibility removes badge; Hide action returns | Pass |
| Send/Sign/Payment disabled | Pass |
| 390px Edit Option drawer | Pass |

### 14. R17D Phase 4A — Estimate display policy consumer (Preview) — complete

**Commit:** **`1424f1e` — feat(proposals): honor estimate display settings in customer preview**

**Purpose:** Customer Preview consumes existing estimate display settings from `proposal_pages.settings_json` — **no new UI/schema**; **no Builder editing in Phase 4A**.

**Added:**

| Artifact | Detail |
|----------|--------|
| **`proposalCustomerEstimateDisplayPolicy.ts`** | Pure display policy resolver |
| **`resolveCustomerPreviewEstimateDisplayPolicy()`** | Maps `ProposalPageSettings` → customer Preview display policy |
| **`readEstimatePageSettingsFromProposalPage()`** | Reads estimate page settings from draft graph page |

**Threading:**

`proposal_pages.settings_json` → `proposalCustomerPreviewViewModel` → `ProposalCustomerPreviewEstimateSection` → `buildCustomerPreviewEstimatePresentation({ estimatePageSettings })` → display policy resolver → Preview estimate UI

**Behavior:**

| Setting | Effect |
|---------|--------|
| **`show_line_prices: false`** | Visible line names remain; per-line dollar/value column hidden (`valueLabel: null`) |
| **`show_option_totals: false`** | Investment/totals panel hidden only; **stored option totals unchanged** |
| **`show_section_headings: false`** | Section heading chrome hidden; lines still render |
| **Scope rules** | Hidden-from-customer, excluded/omitted, and internal-only rules **stronger than** display policy |
| **Pricing** | **No visible-line re-summing**; **no pricing math changes** |

**Not in Phase 4A:** Builder editing of display settings; template mutation; `proposal_line_items` mutation; pricing refresh.

| Validation | Result |
|------------|--------|
| `proposalCustomerEstimateDisplayPolicy.test.ts` | **6/6** pass |
| `proposalCustomerEstimatePresenter.test.ts` | **21/21** pass |
| `proposalCustomerPreviewViewModel.test.ts` | **14/14** pass |
| Full `app/lib/proposal*.test.ts` batch | **637/637** pass |

**Browser smoke — PASS (proposal `3db12ac5-707b-497b-94db-dfc8b00feeaa`):**

| Check | Result |
|-------|--------|
| Preview no-regression smoke | Pass |
| No Builder-only labels in Preview | Pass |
| Send/Sign/Payment disabled | Pass |
| No `/api/estimate/send` | Pass |
| Mobile 390px | Pass |

### 15. R17D Phase 4B — Builder proposal-level display settings editing — complete

**Commit:** **`38a126e` — feat(proposals): enable proposal-level estimate display settings in Builder**

**Purpose:** Contractors can edit existing estimate display settings per proposal/job draft; persists to `proposal_pages.settings_json`; Preview reflects settings through Phase 4A policy consumer.

**Added:**

| Artifact | Detail |
|----------|--------|
| **`proposalPageEstimateSettingsEditing.ts`** | Pure merge/validation helpers for settings patches |
| **`proposalPageEstimateSettingsEditing.test.ts`** | Unit tests |
| **`updateDraftProposalPageSettings()`** | Store action in `proposalRecordStore.ts` |
| **Interactive `ProposalBuilderWorkbenchSettingsEntry`** | Three checkboxes on persisted draft estimate pages |

**Controls:**

- Show line prices
- Show option totals
- Show section headings

**Behavior:**

| Rule | Detail |
|------|--------|
| **Builder UI** | Editable estimate display settings on persisted draft estimate pages |
| **Persistence** | Settings persist to `proposal_pages.settings_json` only |
| **Preview** | Reflects settings through Phase 4A policy consumer — **no Preview-specific rewrite** |
| **Scope** | Proposal-level overrides; **template metadata is not mutated** |
| **Pricing refresh** | Settings update **does not call** `refreshDraftPricing` |
| **Line items** | Settings update **does not mutate** `proposal_line_items` |
| **Totals/math** | **No pricing totals or pricing math changes** |
| **Contractor detail** | Builder/workbench line detail remains unchanged |

**Store/persistence (`updateDraftProposalPageSettings`):**

| Rule | Detail |
|------|--------|
| **Signature** | `updateDraftProposalPageSettings(companyId, proposalId, pageId, settingsPatch)` |
| **Guards** | Validates company, draft status, and current draft page |
| **Page type** | Estimate page only |
| **Columns updated** | `proposal_pages.settings_json` and `updated_at` only |
| **Merge** | Preserves unrelated `settings_json` keys |
| **Event** | Appends `draft_saved` event with `{ field: "settings_json", patch }` |
| **Return** | Refreshed draft graph |

| Validation | Result |
|------------|--------|
| `proposalPageEstimateSettingsEditing.test.ts` | **4/4** pass |
| `proposalRecordStore.test.ts` | **76/76** pass |
| `proposalBuilderWorkbenchEstimatePresenter.test.ts` | **26/26** pass |
| Full `app/lib/proposal*.test.ts` batch | **647/647** pass |

**Browser smoke — PASS:**

| Item | Value / result |
|------|----------------|
| Proposal | `3db12ac5-707b-497b-94db-dfc8b00feeaa` |
| Job | `c3a26242-cb5d-4710-9837-589f3bed3269` |
| Builder editable Estimate display settings | Pass |
| Uncheck Show line prices → PATCH `proposal_pages` | HTTP **204** |
| Preview line names without dollar amounts | Pass |
| No `/api/estimate/send` | Pass |
| No pricing refresh RPC | Pass |
| Send/Sign/Payment disabled | Pass |

### 16. Future UX backlog — not implemented

**A. Phase 4C — Roofr-aligned detail granularity**

| Rule | Detail |
|------|--------|
| **Research** | Public Roofr research supports line item detail visibility controls; exact granularity is partly uncertain |
| **Future scope** | After targeted Roofr verification or explicit product approval, FieldDive may need finer controls for: quantity visibility; unit price visibility; line subtotal visibility |
| **Do not** | Add these controls prematurely; extend schema/UI until explicitly scoped |

**B. Future public/customer proposal architecture**

| Rule | Detail |
|------|--------|
| **Phase 4A/4B** | Prepare shared display policy for future public customer proposal/PDF consumers |
| **Blocked** | Public route/PDF/Send/Sign/Payment/lifecycle remain blocked until architecture approval |

### 17. Architecture guardrails (audit remediation — mandatory)

| Guardrail | Rule |
|-----------|------|
| **`refreshDraftPricing` persistence** | **Transaction-backed by default** via `persist_draft_pricing_refresh_v1` |
| **`createDraftProposal` persistence** | **Transaction-backed by default** via `persist_draft_proposal_create_v1` |
| **Sequential multi-request persistence** | **Do not reintroduce as the normal path** — use only `USE_REFRESH_DRAFT_PRICING_SEQUENTIAL=1` or `USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL=1` for explicit dev/test escape hatches |
| **Scope-decision actions** | **Do not add new actions that bypass `refreshDraftPricing`** |
| **`proposal_line_items`** | **Do not directly mutate from UI/actions** — refresh/create persistence paths only |
| **Legacy RPC env** | **Do not use `USE_REFRESH_DRAFT_PRICING_RPC` as enablement** — legacy/ignored |
| **Pricing engine / snapshot math** | **Separate from RPC** — RPC persists a **pre-built payload only** |
| **Dual spine mixing** | **Do not mix legacy estimate spine with DB proposal spine** — use route guards and isolation helpers (§6BL.7) |
| **Supabase migration target** | Manual migrations applied to **`rhquhnujjnzjhweypavd`** — **do not assume a different target without explicit approval** |
| **Quick fixes / patches** | **Do not choose** — prefer **durable architecture** for hundreds/thousands of users |
| **FieldDive-only semantics** | **Do not add** unless explicitly approved |
| **Product-flow baseline** | **Roofr/RoofrExact** remains the product-flow source of truth |
| **Internal RPC/database architecture** | **FieldDive-specific** for durability and scale |

### 18. Current protected scope state

| Item | State |
|------|-------|
| **Audit Remediation Track** | **Complete** — sufficient for R18/public proposal architecture **planning** |
| **Existing-template-line Edit Option parity** | **Closed** for Roofr-aligned scope: manual quantity; reset quantity; exclude/remove/restore; customer visibility (Hide from customer / restore); estimate display settings |
| **Remaining disabled Edit Option shell** | **Future expansion, not blockers** — Add catalog, Add custom line, Move to upgrade, Quantity source override |
| **DB proposal spine** | **Clean-route guarded**; **legacy-isolated**; **transactional on pricing refresh**; **transactional on initial draft creation**; **post-transaction audit passed**; **second whole-app audit passed** (§6BL.21) |
| **Phase 4 Hide** | **Complete** at `e79c53a` (§6BL.13) — customer-hidden-but-priced/included via scope decisions |
| **Phase 4A display policy consumer** | **Complete** at `1424f1e` (§6BL.14) — Preview honors `settings_json` display flags |
| **Phase 4B Builder display settings editing** | **Complete** at `38a126e` (§6BL.15) — proposal-level `settings_json` overrides |
| **Phase 4C qty/unit/subtotal granularity** | **Future backlog only** (§6BL.16) — not implemented |
| **Mark N/A** | **Visible drift removed** at `8dd8e7f` — **do not implement**; product drift, not future feature work |
| **Customer visibility UI wording** | **Live** as “Hide from customer” — future UX backlog to reframe as neutral customer-visibility / eye-icon language; **not a blocker** |
| **Send/Sign/Payment/PDF/public route/lifecycle** | **Public route `/p/[token]` exists (read-only)** at **`265d8f6`** (§6BN.11); **Contractor Preview review-link bridge** at **`bab25c8`** (§6BN.12); **Contractor Preview Send gate readiness UI** at **`304ed0f`** (§6BN.13); **Contractor Preview customer send link prep** at **`845e8d5`** (§6BN.15); **Delivery attempt foundation** at **`57786ca`** (§6BN.17); **R18D3B email send** at **`e7cdc51`** (§6BN.18); **R18D3C delivery history UI** at **`e17eab5`** (§6BN.20) — migration `20260626_020` **live-applied + verified PASS** on `rhquhnujjnzjhweypavd`; **Send/email delivery enabled** when readiness green; **lifecycle/status/job-board mutation remain disabled** |
| **R18D3A** | Delivery attempt foundation — **complete** (`57786ca`, §6BN.17) |
| **R18D3B** | Email send orchestration + template polish — **complete + live-smoked** (`e7cdc51`, `20a239d`, §6BN.18–§6BN.19) — **still no lifecycle/status/job-board mutation** |
| **R18D3C** | Contractor delivery status/history UI — **complete** (`f0627e1` → `e17eab5`, §6BN.20) — read-only history; browser smoke PASS |
| **R18D3D+** | **Blocked** — lifecycle/status/job activity; **requires Stage C4 + explicit approval** (§6BN.20.9, §6BO.11) |
| **R18A** | **Complete** (§6BM) — public proposal architecture planning; **immutable sent snapshot first** |
| **R18B** | **Foundation implemented**; **R18B4D smoke PASS** (§6BM.13) — `freezeDraftToSentSnapshot` + `persist_proposal_send_freeze_v1` |
| **R18C1** | Sent version graph loader — **complete** (`53973f0`) |
| **R18C2A** | Public access token tables — **complete** (`b651c7a`) |
| **R18C2B** | Public access resolve/record RPCs — **complete + live-verified** (`e7798a7`, §6BN) |
| **R18C3A** | Public access token server boundary — **complete** (`b51383a`, §6BN.7) |
| **R18C3B** | Public access token minting — **complete + live-verified PASS** (`5c47854`, §6BN.9) |
| **R18C4A** | Public access orchestrator + render-ready view model — **complete** (`8523812`, §6BN.10) |
| **R18C4B** | Public proposal route + customer shell — **complete** (`265d8f6`, §6BN.11) |
| **R18C4C** | Contractor Preview public review link panel — **complete** (`bab25c8`, §6BN.12) |
| **R18D1** | Contractor Preview Send gate readiness + email draft review — **complete** (`304ed0f`, §6BN.13) — **no delivery** |
| **R18D2** | Contractor Preview customer send link prep — **complete** (`845e8d5`, §6BN.15) — **Prepare customer link only; no email delivery** |
| **Legacy estimates/approvals** | **Preserved but isolated** from DB proposal spine |

### 19. Audit remediation status tracker

**Completed:**

| Item | Checkpoint |
|------|------------|
| Preview/customer-trust foundation | **Remediation 1** (`6e27716`) |
| Transactional `refreshDraftPricing` persistence | **Remediation 2A–2B** (`c2c02dc` → `377dfe2`) |
| Dual spine isolation guardrails | **Remediation 3A** (`b65c684`) |
| Transactional `createDraftProposal` persistence | **Transactional create 4A–4C** (`daf5268` → `f684b73`) |
| Post-transaction spine audit | **§6BL.11** — **PASS** |
| Mark N/A visible drift removal | **`8dd8e7f`** (§6BL.12) — **no Mark N/A implementation** |
| R17D Phase 4 Hide from customer | **`e79c53a`** (§6BL.13) |
| R17D Phase 4A estimate display policy consumer | **`1424f1e`** (§6BL.14) |
| R17D Phase 4B Builder display settings editing | **`38a126e`** (§6BL.15) |
| Existing-template-line Edit Option parity (Roofr-aligned) | **Closed** (§6BL.21) — manual qty, reset, exclude/remove/restore, visibility, display settings |
| Second whole-app audit before R18 | **§6BL.21** — **PASS**; no blockers |

**Intentionally deferred (not audit blockers):**

| Item | Notes |
|------|-------|
| **Add catalog / Add custom line / Move to upgrade / Quantity source override** | Disabled shell only; types staged; future expansion |
| **Phase 4C qty/unit/subtotal granularity** | Future backlog only — not current unless explicitly scoped |
| **Mark N/A** | Product drift — **do not implement** |
| **Send/Sign/Payment/PDF/public route/lifecycle** | **Public route `/p/[token]` exists (read-only)** at **`265d8f6`** (§6BN.11); **Contractor Preview review-link bridge** at **`bab25c8`** (§6BN.12); **Send gate readiness UI** at **`304ed0f`** (§6BN.13); **Customer send link prep** at **`845e8d5`** (§6BN.15); **Delivery attempt foundation** at **`57786ca`** (§6BN.17) — migration `20260626_020` **live-applied + verified PASS** on `rhquhnujjnzjhweypavd`; **email delivery still disabled**; Sign, PDF, Payment, lifecycle/status mutation remain disabled |
| **R17C3 document typography polish** | Presentation polish; separate from scope editing |

### 20. Next recommended sequence

**Audit Remediation Track complete.** **Second whole-app audit before R18 passed** (§6BL.21). **R18A public proposal architecture planning complete** (§6BM). **R18B immutable sent snapshot foundation smoke-validated** (§6BM.13; code `76840d1`). **R18C3A public access token server boundary complete** (`b51383a`, §6BN.7). **R18C3B public access token minting complete + live-verified PASS** (`5c47854`, §6BN.9). **R18C4A public access orchestrator + view model complete** (`8523812`, §6BN.10). **R18C4B public proposal route + customer shell complete** (`265d8f6`, §6BN.11). **R18C4C contractor Preview review-link bridge complete** (`bab25c8`, §6BN.12). **R18D1 contractor Preview Send gate readiness complete** (`304ed0f`, §6BN.13). **R18D2 contractor Preview customer send link prep complete** (`845e8d5`, §6BN.15). **R18D3A delivery attempt foundation complete** (`57786ca`, §6BN.17). **Phase 4 Hide complete** at `e79c53a` (§6BL.13). **Phase 4A complete** at `1424f1e` (§6BL.14). **Phase 4B complete** at `38a126e` (§6BL.15). **Phase 4C is future backlog only** (§6BL.16). **Next:** **R18D3B planning/implementation may begin**, using the live-verified `proposal_delivery_attempts` foundation (§6BN.17.7) — **do not** enable Send/email delivery, Resend, `proposals.status = sent`, sent `proposal_events`, PDF, Sign/acceptance, Payment/deposit, lifecycle/customer-notified semantics, or pricing changes unless explicitly approved.

**A. R18 post-D2 planning (recommended next — planning only; do not enable Send/email/Resend/lifecycle/PDF/Sign/Payment):**

- **R18C public access now includes:** token tables/activity; resolve/record RPCs; server token hash/resolve/record boundary; mint infrastructure; public access orchestrator/view model; **`/p/[token]` public proposal route + customer shell** (§6BN.10–§6BN.11); **Contractor Preview review-link bridge for QA/open/copy** (§6BN.12)
- **R18D1 now includes:** Contractor Preview Send gate readiness checklist + email draft preview panel (§6BN.13) — **Send button disabled**; message preview link label **Available after send** until prep succeeds
- **R18D2 now includes:** Contractor Preview **Prepare customer link** (§6BN.15) — POST `/api/proposals/send-prep`; freeze/reuse/refreeze + mint customer-send token; open/copy session URL; **distinct from R18C4C QA review link**; **still not email Send**
- **R18D3A now includes:** Delivery attempt foundation (§6BN.17) — `proposal_delivery_attempts` migration/store/view model/tests; migration `20260626_020` **live-applied + verified PASS** on `rhquhnujjnzjhweypavd` (§6BN.17.7); **still not email Send**
- **Next slice:** **R18D3B** (real email send orchestration with Resend + delivery attempts; fresh mint-at-send; still no `proposals.status=sent`, no `proposal_events.sent`, no Jobs Board movement unless separately approved)
- **R18G later:** Signature/acceptance
- **R18H later:** PDF
- **R18I later:** Payment/deposit
- **After R18C4C:** contractors can create/open/copy a QA review link from Preview — **still not production Send**
- **After R18D2:** contractors can prepare/open/copy a customer-send link from Preview — **still not email delivery**
- **Do not assume `/p/[token]` or any minted link means email Send is enabled**
- **Do not build email Send, PDF, Sign, Payment, or lifecycle/status mutation** until explicitly approved
- Full architecture: **§6BM** (R18A complete); **R18B smoke-validated** (§6BM.13); **R18C4A/C4B/C4C complete** (§6BN.10–§6BN.12); **R18D1 complete** (§6BN.13); **R18D2 complete** (§6BN.15)

**B. R18B immutable sent snapshot foundation (complete at code `76840d1`; smoke PASS §6BM.13):**

- Transactional freeze-on-send RPC `persist_proposal_send_freeze_v1` creating `proposal_versions` with `version_kind='sent'`
- Copy pages/options/line items/internal summaries/display settings into sent version; immutability triggers on sent child rows
- Draft remains separately editable; `proposals.status` does **not** auto-transition to `sent` on freeze
- Env-gated store wrapper: `USE_PROPOSAL_SEND_FREEZE_RPC=1` (default OFF)
- **Do not build public route, Send, PDF, Sign, or Payment** until R18C+ phases approved

**C. Continue preserving:**

- R17D Phase 1 overlay + merge-on-refresh contract (`43c83a2`, §6BH)
- R17D Phase 2 manual quantity set/update (`f5712ff`, §6BI)
- R17D Phase 2.5 manual quantity reset (`a12fb92`, §6BJ)
- R17D Phase 3A exclude/remove + restore (`2dca3c0`, §6BK)
- Remediation 1 Preview/customer-trust (`6e27716`, §6BL.2)
- Remediation 2B transactional RPC default (`377dfe2`, §6BL.6)
- Remediation 3A dual spine isolation (`b65c684`, §6BL.7)
- Transactional create Remediation 4C default (`f684b73`, §6BL.10)
- Mark N/A drift cleanup — visible UI only (`8dd8e7f`, §6BL.12) — **do not implement Mark N/A**
- R17D Phase 4 Hide from customer (`e79c53a`, §6BL.13)
- R17D Phase 4A estimate display policy consumer (`1424f1e`, §6BL.14)
- R17D Phase 4B Builder display settings editing (`38a126e`, §6BL.15)
- R17C2 workbench zones + scope review semantics (`3e65774`, §6BG)
- R17C1 document presentation layer (`9c2244a`, §6BF)
- Send / Sign / Payment / PDF / public customer sharing **disabled**
- Preview Estimate **must not** re-import Builder workbench UI
- Pricing trust + snapshot safety + RPC persistence guardrails (§6BL.17)

**D. Deferred backlog (explicit — do not implement without scoped approval):**

- Add catalog, Add custom line, Move to upgrade, Quantity source override
- Phase 4C qty/unit/subtotal display granularity
- Neutral customer-visibility wording (replace “Hide from customer” with eye-icon/neutral language)
- Cosmetic URL cleanup for stale `loadSaved`/`from=board` query params on direct Builder URL paste
- Mobile Preview header button discoverability polish
- Optional: skip `proposal_internal_summaries` fetch on Preview-only reads

### 21. Second whole-app audit before R18 — PASS

**Audit mode:** audit only. **No app code changed.** **No commit made during audit.** **Working tree clean** at audit start. **Code:** `38a126e`. **Docs:** `f55566d`.

| Validation | Result |
|------------|--------|
| Full `app/lib/proposal*.test.ts` | **647/647** pass |
| Targeted spine/route guard tests (`productSpine`, `proposalDraftEntry`, `proposalBuilderReadiness`, `jobBoardAdapter`) | **91/91** pass |

**Static/repo audit — PASS:**

| Check | Result |
|-------|--------|
| No unexpected migrations/package changes | Pass |
| No public customer proposal route enabled | Pass — Preview requires auth |
| Send/Sign/Payment/PDF/lifecycle not enabled | Pass |
| Mark N/A absent from UI/behavior | Pass |
| No direct `proposal_line_items` UI mutation | Pass — scope decisions + refresh/create only |
| DB proposal routes isolated from legacy `loadSaved` | Pass |
| Transactional create/refresh default | Pass |
| Display settings page-level only | Pass — `proposal_pages.settings_json` |
| Visibility/exclude/manual quantity scope decisions only | Pass |
| Template graph not mutated by job/proposal decisions | Pass |

**Route audit — PASS:**

| Route | Result |
|-------|--------|
| Jobs Board (`/tools/roofing/saved`) | Loads |
| DB Job Card (`?entry=job-card&job=`) | Clean URL; no `loadSaved` / `from=board` |
| Proposal Builder (`/tools/roofing/proposals/builder?job=&proposal=`) | Loads |
| Contractor Preview (`/tools/roofing/proposals/preview?job=&proposal=`) | Authenticated only |
| Legacy estimate (`?loadSaved=`) | Intentionally reachable |
| Public/lifecycle navigation | None observed |

**Builder audit — PASS** (proposal `3db12ac5-707b-497b-94db-dfc8b00feeaa`, job `c3a26242-cb5d-4710-9837-589f3bed3269`):

| Check | Result |
|-------|--------|
| Builder/option/workbench load | Pass |
| Manual quantity / reset controls present | Pass |
| Exclude/remove drawer section present | Pass |
| Hide two-step drawer path present | Pass |
| Estimate display settings present | Pass |
| Contractor workbench remains detailed | Pass |
| Mark N/A absent | Pass |
| Disabled future shell actions remain disabled | Pass — Browse catalog + Add custom line disabled in drawer |
| Lifecycle actions remain disabled | Pass — Send/Sign/Payment disabled; Preview enabled (attention state) |

**Preview/customer truth audit — PASS with nuance:**

| Check | Result |
|-------|--------|
| Authenticated contractor Preview only | Pass |
| Hidden/excluded/display-setting behavior | Prior targeted smoke PASS; not re-mutated this audit when pricing incomplete |
| No Builder-only labels | Pass |
| No profitability/internal cost/margin displayed | Pass |
| No lifecycle/payment/signing UI | Pass |
| No visible-line re-summing | Pass — authoritative option totals |
| Internal summaries in graph load | `proposal_internal_summaries` may be fetched; **not rendered** in Preview UI — deferred optimization only |

**Protected network audit — PASS:**

| Check | Result |
|-------|--------|
| No `/api/estimate/send` | Pass |
| No PDF generation endpoint | Pass |
| No public proposal/lifecycle/payment/signing requests | Pass |
| No duplicate draft create on open | Pass — `resolveOrCreateProposalDraftEntry` tests |

**Mobile 390px audit — PASS:**

| Surface | Result |
|---------|--------|
| Jobs Board, Builder, Edit Option drawer, Preview | Usable; no horizontal overflow |
| Primary controls reachable | Pass |
| Disabled controls clearly disabled | Pass |
| Preview header button in mobile overflow | Cosmetic backlog — direct Preview URL works |

**Accessibility/basic UX — PASS:**

| Check | Result |
|-------|--------|
| Drawer confirm/cancel clear | Pass |
| Two-step hide/exclude understandable | Pass |
| Restore actions available | Pass (prior smoke + code) |
| Disabled future actions visibly/functionally disabled | Pass |
| No console errors | Pass |
| “Hide from customer” wording | Future neutral visibility/eye-icon UX backlog — **not a blocker** |

**Non-blocking findings:**

| Finding | Severity |
|---------|----------|
| Stale `loadSaved` / `from=board` query params may remain if directly pasted into Builder URL | Cosmetic — behavior guarded; URL cleanup only |
| Mobile Preview header button discoverability | Cosmetic polish |
| Preview graph fetch includes `proposal_internal_summaries` but UI does not expose contractor-only data | Deferred optimization |
| “Hide from customer” → neutral customer-visibility language | Deferred UX backlog |

**Verdict:** **PASS — no blockers before R18 implementation planning; R18A architecture complete** (§6BM).

---

## 6BM. R18 PUBLIC PROPOSAL ARCHITECTURE — R18A PLANNING CHECKPOINT

**Status:** **R18A complete** — architecture planning only. **R18B foundation implemented**; **R18B4D disposable send-freeze smoke: PASS** (§6BM.13). **R18C2B resolve/record RPCs complete** at **`e7798a7`** (**§6BN** — live-verified PASS). **R18C3A public access token server boundary complete** at **`b51383a`** (**§6BN.7**). **R18C3B public access token minting complete + live-verified PASS** at **`5c47854`** (**§6BN.9**). **R18C4A public access orchestrator + render-ready view model complete** at **`8523812`** (**§6BN.10**). **R18C4B public proposal route `/p/[token]` + customer shell complete** at **`265d8f6`** (**§6BN.11**). **R18C4C contractor Preview public review link panel complete** at **`bab25c8`** (**§6BN.12**). **R18D1 contractor Preview Send gate readiness + email draft review complete** at **`304ed0f`** (**§6BN.13**). **R18D2 contractor Preview customer send link prep complete** at **`845e8d5`** (**§6BN.15**). **R18D3A delivery attempt foundation complete** at **`57786ca`** (**§6BN.17**). **Docs checkpoint:** **pending this commit** (prior docs: **`670ed59`** — docs: checkpoint after R18D3A delivery attempt foundation). **Next:** **R18D3B planning/implementation may begin**, using the live-verified `proposal_delivery_attempts` foundation (§6BN.17.7) — **do not** enable Send/email delivery, Resend, `proposals.status = sent`, sent `proposal_events`, PDF, Sign/acceptance, Payment/deposit, lifecycle/customer-notified semantics, or pricing changes without explicit scope approval (§6BN.16–§6BN.17). **Public route exists and is read-only** — token-resolved, sent/signed-version-only, customer-safe DTO/VM based; **does not enable email Send, Sign, PDF, Payment, or lifecycle/status mutation**. **R18D3A adds delivery-attempt audit foundation only — Send/email delivery remains disabled.**

### 1. Core architecture decision

**R18 must not start with a basic public page or quick customer link.**

**R18 must start with immutable sent/public snapshot architecture.**

| Surface | Graph truth | Auth |
|---------|-------------|------|
| **Builder** | Mutable **draft** graph | Contractor session |
| **Contractor Preview** | Mutable **draft** graph (review only) | Contractor session |
| **Public customer proposal** | **Frozen sent** `proposal_versions` snapshot only | Public token |

**Core principles:**

- Draft Builder and contractor Preview use the **mutable draft graph**.
- Public customer proposal reads a **frozen sent version/snapshot only**.
- Builder edits after send **must not mutate** public/sent customer truth.
- Revisions require **new sent version**, **duplicate/resend**, or **supersede** flow (Roofr-aligned).
- **Do not reuse** legacy KV `/approve/[token]` for DB proposals (`app/lib/kv.ts` is legacy estimate spine only).

### 2. Roofr research findings (public sources)

**Confirmed Roofr-aligned behaviors:**

| Behavior | Sources |
|----------|---------|
| **Preview and Send** contractor gate before customer delivery | [Roofr Academy — Sending and Signing Proposals](https://academy.roofr.com/lesson-videos/sending-proposals) |
| **E-signature-ready** interactive customer proposal (not PDF-first) | [Roofr Proposals product](https://roofr.com/proposals), Academy |
| Customer **review and sign** on phone/tablet; **Sign Now** in-person | Academy, [Help — create proposal](https://roofrhelp.zendesk.com/hc/en-us/articles/33558996111511) |
| **Sent / viewed** status tracking on job card + proposals dashboard | Academy |
| **Signed proposal immutable**; changes require **copy + re-send** | [Help — Update Signed Proposal](https://roofrhelp.zendesk.com/hc/en-us/articles/31586375583383) |
| **Unsigned sent** can cancel signature request and edit original | Help — Update Signed Proposal |
| **Co-signer / sequential signing** (primary signs → co-signer emailed) | [Help — customize proposal](https://roofrhelp.zendesk.com/hc/en-us/articles/33886302824471), Academy |
| **Multi-option** templates; customer selects option when viewing/signing | [Help — proposal template](https://roofrhelp.zendesk.com/hc/en-us/articles/33413003649943), Masterclass |
| **Display customization** (line prices, qty, subtotals toggles) | Help — template + estimate settings |
| **PDF download/sign** capability | Academy, product page |
| **Payment/deposit** generally via **invoice/payment request after sign** — not first public-route slice | [Help — Invoices](https://roofrhelp.zendesk.com/hc/en-us/articles/33381809091351), [Payments help](https://roofr.com/help/how-to-request-credit-card-ach-payments) |

**Research uncertainties (do not invent behavior):**

| Gap | FieldDive stance |
|-----|------------------|
| Exact public **token/link URL format** | Not public — design FieldDive token route independently |
| Exact **expiration** automation | Unclear in Roofr public docs — FieldDive should design **token TTL + revocation** even if Roofr is loose |
| **Live upgrade pricing** on customer doc vs frozen-at-send | **Architecture decision required** — default **freeze at send**; option/upgrade selection recorded on acceptance, not by mutating sent lines |
| **Payment on proposal page** vs invoice-linked | **Defer payment-on-proposal** — invoice/payment spine in **R18I** |

### 3. Route architecture (planned — not built)

| Route | Path | Auth | Status |
|-------|------|------|--------|
| Builder | `/tools/roofing/proposals/builder?job=&proposal=` | Contractor | **Live** |
| Contractor Preview | `/tools/roofing/proposals/preview?job=&proposal=` | Contractor | **Live** |
| Public customer proposal | `/p/[publicToken]` or `/proposal/[publicToken]` | **Token only** | **R18C+** |
| Expired/revoked public | Same public route, error state | Token | **R18C+** |
| Accept/sign step | Embedded in public route or subpath | Token + CSRF | **R18G** |
| Legacy approval | `/approve/[token]` | None | **Legacy estimate only — preserve, isolate** |

**Rules:**

- Public route **must not** accept `job=` / `proposal=` UUID query params.
- Contractor Preview **must not** become the public route (separate presenter + loader).
- `productSpine.ts` must classify `public_proposal_customer` and block mixed spine.

### 4. Security / token architecture (planned)

- **Supabase-backed token table** for DB proposals — **not** KV legacy tokens.
- Raw token shown/sent **once** at delivery; store **hash only** (e.g. SHA-256).
- Bind token to: `company_id`, `proposal_id`, **`proposal_version_id` (sent)**, optional recipient hash.
- **Expiration** (`expires_at`) and **revocation** (`revoked_at`, reason).
- **Access logs** — append-only customer activity (viewed_at, ip_hash, user_agent).
- **Public DTO only** — never expose: `proposal_internal_summaries`, raw scope decisions, unit costs, margins, catalog costs, contractor notes, Builder labels.

### 5. Immutable sent snapshot model — R18B direction

**R18B prepares foundation only** — does **not** enable Send, public route, sign, payment, or full lifecycle.

Planned freeze-on-send flow (transactional RPC — mirror create/refresh pattern):

1. Validate readiness (pricing complete, blockers, required pages).
2. Final `refreshDraftPricing` + merge scope decisions (hide/exclude/manual qty).
3. Create `proposal_versions` row: `version_kind='sent'`, `frozen_at=now()`.
4. **Copy** pages, options, line_items, estimate `settings_json`, `context_echo`, terms into sent version.
5. Update `proposals.latest_sent_version_id`, status/events (full lifecycle enablement later).
6. Public token (R18C) binds to **sent version id** only.
7. Draft version remains separately editable; signed sent version **immutable**; changes → duplicate/revision/resend.

**Integrates completed work:** transactional create/refresh, scope decisions, display settings (4A/4B), `proposalCustomerEstimatePresenter`, branding/customer `context_echo` (R11c/R12).

### 6. Data model / migrations likely needed (plan only — do not create yet)

| Phase | Likely artifact |
|-------|-----------------|
| **R18B** | Transactional **`persist_proposal_send_freeze_v1`** (or send-prep freeze RPC); possible status/event enum extensions |
| **R18C** | `proposal_public_access_tokens` (hashed), `proposal_customer_activity` |
| **R18G** | `proposal_signers`, `proposal_signatures`, `proposal_acceptances` |
| **R18D3A** | `proposal_delivery_attempts` — **committed** at `57786ca` (§6BN.17); migration `20260626_020` **live-applied + verified PASS** on `rhquhnujjnzjhweypavd` |
| **R18F** | `proposal_delivery_attempts` — **superseded by R18D3A** (same table; see §6BN.17) |
| **R18H** | `proposal_document_artifacts` (PDF storage refs) |
| **R18I** | `proposal_payment_intents` (invoice-linked) |

Existing tables reused: `proposals`, `proposal_versions`, `proposal_pages`, `proposal_options`, `proposal_line_items`, `proposal_events`.

### 7. Lifecycle / status model (planned)

| Status | R18 scope |
|--------|-----------|
| `draft`, `previewed` | Existing |
| `sent`, `viewed` | R18C–F |
| `option_selected`, `accepted`/`signed`, `declined` | R18G |
| `revoked`, `expired`, `revised`, `archived` | R18C–G |
| `deposit_requested`, `deposit_paid` | **Deferred R18I** |

**R18B does not enable full lifecycle** — only immutable sent snapshot foundation.

### 8. Premium customer UX vision (R18D target)

- Branded hero/cover, customer/job identity, company contact footer.
- Package/option presentation; estimate scope honoring **hide/exclude/display settings** (frozen at send).
- Terms/warranty text pages from frozen context.
- **Mobile-first** layout; trust indicators; clear pricing presentation.
- Later CTAs: select option → sign → pay (phased).
- **Not** a quick public HTML dump; **not** Builder/workbench UI exposed publicly.

### 9. Contractor workflow (R18E target)

- **Preview and Send** gate (Roofr-aligned).
- Readiness checklist: pricing complete, branding/customer identity, display settings review, hidden/excluded summary.
- Send remains **disabled** until R18F explicitly approved.

### 10. Deferred backlog boundaries (unchanged)

- Add catalog / custom line / move to upgrade / quantity source — **deferred**
- Phase 4C qty/unit/subtotal granularity — **deferred**
- Mark N/A — **product drift / do not implement**
- Neutral customer-visibility wording — **UX polish backlog**
- Send / PDF / Sign / Payment / public route / lifecycle — **disabled until phased approval**

### 11. Recommended R18 staging (mandatory order)

| Phase | Deliverable |
|-------|-------------|
| **R18A** | Architecture plan / docs checkpoint — **complete** |
| **R18B** | Immutable sent snapshot foundation — **implemented** (`76840d1`); **R18B4D smoke PASS** (§6BM.13) |
| **R18C** | Token + public read skeleton |
| **R18D** | Premium public proposal UI (frozen snapshot consumer) |
| **R18E** | Contractor Preview-and-Send / readiness gate |
| **R18F** | Email delivery |
| **R18G** | Acceptance / signature |
| **R18H** | PDF from frozen snapshot |
| **R18I** | Deposit / payment (invoice-linked) |
| **R18J** | Full lifecycle audit |

**Why B before D/C UI:** public page must not read live draft graph.

### 12. Stop conditions (halt implementation if)

- Public route reads **live draft graph** (`current_draft_version_id` directly).
- Token security not designed (hashing, expiry, revocation).
- No **immutable sent snapshot** RPC smoke-validated — **R18B4D PASS** (§6BM.13); halt **public route** work if this regresses.
- Internal data exposed on public DTO.
- Contractor Preview reused as public route.
- Send/PDF/Sign/Payment enabled before phase approval.
- Payment/signature assumptions unclear.
- Mobile customer UX not in acceptance criteria.
- Legacy KV `/approve/[token]` reused for DB proposals.

### 13. R18B4D send-freeze smoke — PASS (disposable manual smoke)

**Status:** **PASS** — manual disposable smoke on configured project **`rhquhnujjnzjhweypavd`**; **no app code changed by smoke**; throwaway runner scripts removed after docs checkpoint. **Code checkpoint:** **`76840d1` — feat(proposals): add env-gated send freeze store wrapper**. **Docs checkpoint:** **pending this commit** (prior: **`5efbe6e`**). **Next:** **R18C planning only** — sent graph read path / version graph loader; token/public access architecture; public DTO route boundary; **no public route implementation until planned**.

#### 13.1 Latest checkpoint

| Item | Value |
|------|-------|
| Code | `76840d1` — feat(proposals): add env-gated send freeze store wrapper |
| Docs | pending this commit (prior: `5efbe6e` — docs: record R18A public proposal architecture plan) |
| R18B4D smoke | **PASS** |
| Next | **R18C planning/read-path/token architecture only** — after docs checkpoint |

#### 13.2 Disposable smoke target (authoritative PASS run)

| Field | ID / value |
|-------|------------|
| company_id | `e1fd48bb-fe22-4dfe-9622-3f25eb2109b6` |
| customer_id | `5d3d6617-6748-4fc4-ae1c-d36ce408f6c3` |
| job_id | `6fb015e6-f01d-4c5e-a5a4-63f3b33a0d60` |
| template_id | `3aea218a-5df8-430b-80dd-3ef236aae928` |
| proposal_id | `c0b9a92e-78da-444e-8aff-0f2cd192987a` |
| draft_version_id | `a451dec6-478f-46d5-93c4-8ba09a47ec58` |
| sent_version_id | `f9bb4c91-442d-4e20-abf9-0f6adde90755` |
| title/name | `R18B4D-SMOKE-DISPOSABLE-2026-06-18` |

**Earlier failed/partial disposable artifacts** from prior smoke attempts (e.g. `a6bc4a0c-…`, `40581303-…`, `0a2e42b9-…`) were **left in place intentionally** per cleanup policy — clearly labeled `R18B4D-SMOKE-DISPOSABLE-*`; no archive/remove functions yet.

#### 13.3 Smoke execution result

- **`freezeDraftToSentSnapshot`** ran with **`USE_PROPOSAL_SEND_FREEZE_RPC=1`** (process-only; restored afterward)
- **version_number** = 2
- **page_count** = 5
- **option_count** = 3
- **writeSteps** = `["persist_proposal_send_freeze_v1"]`
- **Readiness PASS** — `pricingComplete` true; `blockingLineCount` 0; estimate page present; 5 customer-visible pages
- **Warning only:** missing company logo in `context_echo`
- **Quantity note:** live `measurement_records` on project lacked LF/count fields; smoke enriched `quantity_context` with disposable defaults for template quantity sources (store-path `createDraftProposal` + `refreshDraftPricing` only — no direct table mutation)

#### 13.4 Verification PASS

| Check | Result |
|-------|--------|
| Sent `proposal_versions` row | `version_kind='sent'`; `frozen_at` set; `parent_version_id` = draft |
| Header pointers | `latest_sent_version_id` → sent; `current_draft_version_id` unchanged; `signed_version_id` unchanged |
| `proposals.status` | Remained `draft` — **did not** become `sent` |
| `proposal_events` | `snapshot_frozen` present; `payload_json.delivery = false` |
| Copy integrity | 5 pages; 3 options; 46 line items; 3 internal summaries |
| Scope decisions on sent | 0 `proposal_option_scope_decisions` |
| Option totals | Matched draft exactly |
| Page settings | `settings_json` matched by stable page keys (page_type, sort_order, source_template_section_id, title fallback) |
| Line `page_id` | Point to **sent** page IDs, not draft page IDs |
| Immutability | Trigger blocked UPDATE on sent estimate page |
| Tests | `npx tsx --test app/lib/proposal*.test.ts` = **700/700** pass |

#### 13.5 Boundaries preserved

- **No** public route, tokens, KV `/approve/[token]`, Send, PDF, Sign, Payment, or lifecycle status transition
- **Only** `freezeDraftToSentSnapshot` + RPC persistence (`persist_proposal_send_freeze_v1`)
- **No** app files changed by smoke run
- Disposable smoke artifacts **intentionally left in place**

#### 13.6 Auth caveat (honest)

- Smoke used **`service_role_membership_fallback`** because Playwright JWT expired / refresh burned and no **`R18B4D_SUPABASE_ACCESS_TOKEN`** was set
- This validated RPC/database freeze behavior and immutability triggers on project `rhquhnujjnzjhweypavd`
- Prior permission checks confirmed **`anon` cannot execute** `persist_proposal_send_freeze_v1` and **`authenticated` can execute**
- For a strict authenticated-only rerun, supply a fresh access token via **`R18B4D_SUPABASE_ACCESS_TOKEN`**
- This caveat **does not** open public access and **does not** change R18C boundary

#### 13.7 Next step

- **R18B immutable sent snapshot foundation is smoke-validated** — foundation ready for R18C planning
- **R18C planning only** next:
  - Sent graph read path / version graph loader
  - Token/public access architecture
  - Public DTO route boundary
  - **No public route implementation until planned**
- Send / PDF / Sign / Payment / lifecycle **remain disabled**

---

## 6BN. R18C PUBLIC ACCESS — RESOLVE / RECORD RPCs + APP SERVER BOUNDARY

**Status:** **R18C2B complete** at **`e7798a7`** (**live-verified PASS** on **`rhquhnujjnzjhweypavd`**). **R18C3A complete** at **`b51383a`**. **R18C3B complete + live-verified PASS** at **`5c47854`** (§6BN.9). **R18C4A complete** at **`8523812`** (§6BN.10). **R18C4B complete** at **`265d8f6`** (§6BN.11). **R18C4C complete** at **`bab25c8`** (§6BN.12). **R18D1 complete** at **`304ed0f`** (§6BN.13). **R18D2 complete** at **`845e8d5`** (§6BN.15). **R18D3A complete** at **`57786ca`** (§6BN.17) — migration `20260626_020` **live-applied + verified PASS** on **`rhquhnujjnzjhweypavd`** (§6BN.17.7). **R18D3B complete + live-smoked** at **`e7cdc51`** (§6BN.18); **optional-upgrade Builder readiness fix** at **`79e4c4f`** (§6BN.18.8). **R18D3B email template polish complete + Gmail-approved** at **`20a239d`** (§6BN.19). **Public proposal packet + Stage A/B truth pipeline complete** at **`ee643d0`** (§6BO). **Docs checkpoint:** **pending this commit** (prior docs: **`5efcc45`**). **Truth-pipeline remediation complete** (§6BO). **Next:** **R18 roadmap recovery / priority decision** (§6BO.0, §6BO.10) — do **not** assume Stage C, Stage D, or R18D3C until recovery report decides.

### 1. Code checkpoint

| Item | Value |
|------|-------|
| **Commit** | `e7798a7` — feat(proposals): add public access resolve RPCs in R18C2B |
| **Prior R18C commits** | `b651c7a` (R18C2A tables), `53973f0` (R18C1 sent graph loader) |
| **Working tree after code commit** | **Clean** — migrations only; no app/docs/tests/package changes |

**Committed migration files:**

- `supabase/migrations/20260626_016_create_proposal_public_access_resolve_rpc.sql`
- `supabase/migrations/20260626_017_harden_proposal_public_access_resolve_rpc_permissions.sql`

### 2. Scope summary

| RPC | Signature | Role |
|-----|-----------|------|
| **Internal validator** | `proposal_assert_public_access_token_active_v1(p_token_hash text)` | Validates hash-only token; returns safe ID binding envelope only; **not directly granted to client roles** |
| **Resolve** | `resolve_proposal_public_access_token_v1(p_token_hash text)` | Read-only/idempotent resolve to company/proposal/version/token IDs |
| **Record view** | `record_proposal_customer_view_v1(p_token_hash text, p_ip_hash text default null, p_user_agent text default null, p_referrer_host text default null, p_payload_json jsonb default '{}'::jsonb)` | Appends append-only customer activity; updates token `last_viewed_at` only |

**Properties:**

- All three RPCs are **SECURITY DEFINER** with `search_path = public`.
- Resolve is **read-only/idempotent** — no graph rows, no lifecycle mutation.
- Record **does not** mutate `proposals.status` or `proposal_events`.
- **No public route**, **no token generation**, **no app wrappers**, **no Send/PDF/Sign/Payment changes**.

**Permission boundary (final after hardening):**

| Role | assert | resolve | record |
|------|--------|---------|--------|
| PUBLIC | no EXECUTE | no EXECUTE | no EXECUTE |
| anon | no EXECUTE | no EXECUTE | no EXECUTE |
| authenticated | no EXECUTE | no EXECUTE | no EXECUTE |
| service_role | **no EXECUTE** | EXECUTE | EXECUTE |

**Final hardening revoke (applied live + recorded in 017):**

```sql
REVOKE ALL ON FUNCTION public.proposal_assert_public_access_token_active_v1(text) FROM service_role;
```

016/017 committed together in `e7798a7`.

### 3. Live verification result

**Method:** Cursor read-only catalog verification via **`DATABASE_URL`** in local `.env.local` (operator-configured; secrets not logged). **One approved write** applied before re-verify: internal validator `service_role` revoke above.

**Target project:** `rhquhnujjnzjhweypavd`

| Result | Value |
|--------|-------|
| `verify_failed_count` | **0** |
| status | **`all_pass`** |

**Verified:**

- All three R18C2B functions exist
- All three are SECURITY DEFINER
- PUBLIC / anon / authenticated have **no EXECUTE** on all three
- `service_role` has EXECUTE **only** on `resolve_proposal_public_access_token_v1` and `record_proposal_customer_view_v1`
- `service_role` has **no EXECUTE** on `proposal_assert_public_access_token_active_v1`
- R18C2A tables / RLS / triggers preserved
- R18B `persist_proposal_send_freeze_v1` preserved
- R18B sent immutability triggers preserved

### 4. Verification lessons (do not repeat mistakes)

| Pitfall | Correct approach |
|---------|------------------|
| `has_function_privilege('PUBLIC', ...)` | **Do not use** — errors with `role "PUBLIC" does not exist` |
| PUBLIC grant detection | Use `information_schema.routine_privileges` with `grantee = 'PUBLIC'` |
| `record_proposal_customer_view_v1` identity args | This DB reports **full five-parameter identity signature**; `pg_get_function_arguments()` shows defaults (`DEFAULT NULL`, `DEFAULT '{}'`). Future verification must accept that live behavior |

### 5. Safety confirmations (R18C2B code commit)

- Working tree **clean** after `e7798a7`
- **No** app / docs / tests / package changes in R18C2B code commit
- **No** public route / token generation / app wrapper added
- **No** Send / PDF / Sign / Payment / lifecycle behavior enabled

### 6. R18C3A planning guardrails (implemented — see §6BN.7)

| Rule | Detail |
|------|--------|
| Hash at server boundary | App-side **SHA-256** hash of raw public token before RPC call |
| Thin wrappers | Server-only `service_role` wrappers for resolve + record |
| Raw token handling | Wrappers accept raw token **only** at server boundary; hash before RPC; **never store raw token** |
| Public route | **Do not** create `/p/[token]` unless explicitly approved |
| Token mint | **Complete** at **`5c47854`** (§6BN.9) — **does not** enable Send or public UI |
| Customer UI | **No** customer-facing UI yet |
| Send / PDF / Sign / Payment / lifecycle | **Remain disabled** |
| Graph boundary | Preserve immutable **sent version graph** read path (`getProposalVersionGraph` + `requireSentVersion: true`) |

**Mandatory read:** **§6BN** + **§6BM** before R18C4 planning.

### 7. R18C3A COMPLETION — PUBLIC ACCESS TOKEN SERVER BOUNDARY

**Status:** **R18C3A complete and committed** at **`b51383a`**. **Prior R18C code:** **`e7798a7`** (R18C2B RPCs), **`b651c7a`** (R18C2A tables), **`53973f0`** (R18C1 sent graph loader).

#### 7.1 Architecture decision (Roofr-aligned — not a quick helper patch)

R18C3A is the **long-term server boundary** for future customer proposal links:

```text
Builder mutable draft
→ Contractor Preview draft review
→ immutable sent/signed proposal version
→ hashed token resolve
→ customer view tracking
→ future public route / sign / PDF / payment / lifecycle
```

#### 7.2 Code delivered (`b51383a`)

| Artifact | Role |
|----------|------|
| `app/lib/proposalPublicAccessTokenHash.ts` | Pure SHA-256 raw token hashing + hex validation; **never stores/logs/returns raw token** |
| `app/lib/proposalPublicAccessRpcPersistence.ts` | Injectable RPC persistence: resolve + record `ViaRpc(supabase, rawToken, …)`; parses narrow success/failure envelopes |
| `app/lib/proposalPublicAccessRpcStore.server.ts` | **`import "server-only"`** + `createAdminClient()` entry points: `resolveProposalPublicAccessToken`, `recordProposalCustomerView` |
| `package.json` | Added **`server-only`** dependency (standard Next.js server boundary — not a workaround) |

**Resolve wrapper** calls **`resolve_proposal_public_access_token_v1`** with **`p_token_hash` only** (never raw token).

**Record wrapper** calls **`record_proposal_customer_view_v1`** with **`p_token_hash`**, **`p_ip_hash`**, **`p_user_agent`**, **`p_referrer_host`**, **`p_payload_json`**. Accepts pre-hashed `ipHash` or null only — **no IP salting/hashing invented in R18C3A**.

**Success envelopes** return company/proposal/version/token IDs + status/expiry/view metadata only — **no graph rows**, **no raw token**, **no `token_hash`**.

#### 7.3 Boundaries preserved (R18C3A)

- **No** public route (`/p/[token]`)
- **No** token minting / revoke / supersede (mint deferred to R18C3B — now complete §6BN.9)
- **No** customer-facing UI
- **No** Send / PDF / Sign / Payment / lifecycle enablement
- **No** `proposals.status` mutation from view recording
- **No** sent proposal version mutation
- **No** SQL / migrations changed
- **No** graph loading in this slice (`getProposalVersionGraph` / `proposalPublicGraphDto` not wired)

#### 7.4 Tests / verification (R18C3A)

| Check | Result |
|-------|--------|
| `proposalPublicAccessTokenHash.test.ts` + `proposalPublicAccessRpcStore.server.test.ts` | **28/28 pass** |
| `app/lib/proposal*.test.ts` | **742/742 pass** |
| `npx tsc --noEmit` | **No errors in `proposalPublicAccess*` files**; unrelated pre-existing project errors remain |
| Forbidden exposure checks | **PASS** — no `/p/[token]` route; no generate/mint public token helper; RPC names only in server-side lib/test files; `createAdminClient` not imported by `app/tools` or `app/components` |

#### 7.5 Committed files (`b51383a`)

- `app/lib/proposalPublicAccessTokenHash.ts`
- `app/lib/proposalPublicAccessTokenHash.test.ts`
- `app/lib/proposalPublicAccessRpcPersistence.ts`
- `app/lib/proposalPublicAccessRpcStore.server.ts`
- `app/lib/proposalPublicAccessRpcStore.server.test.ts`
- `package.json` / `package-lock.json` (`server-only` only)

### 8. R18C3B planning guardrails (implemented — see §6BN.9)

| Rule | Detail |
|------|--------|
| Mint at server boundary | Generate raw token server-side; hash before RPC; **return raw token once only** from server-only success envelope |
| Thin wrappers | Server-only `service_role` mint facade + injectable RPC persistence |
| Raw token handling | **Never store/log/insert raw token** into DB, metadata, or SQL/RPC args |
| Public route | **Do not** create `/p/[token]` unless explicitly approved |
| Send / PDF / Sign / Payment / lifecycle | **Remain disabled** — mint does **not** enable Send or customer UI |
| Sent binding | Mint bound to **sent/signed** proposal version only |
| Graph boundary | Preserve immutable **sent version graph** read path (`getProposalVersionGraph` + `requireSentVersion: true`) |

**Mandatory read:** **§6BN** + **§6BM** before R18C4 implementation.

### 9. R18C3B COMPLETION — PUBLIC ACCESS TOKEN MINTING

**Status:** **R18C3B complete and committed** at **`5c47854`**. **Live DB apply + verification: PASS** on **`rhquhnujjnzjhweypavd`**. **Disposable mint→resolve smoke: PASS** (§6BN.9.5). **Prior R18C code:** **`b51383a`** (R18C3A server boundary), **`e7798a7`** (R18C2B RPCs), **`b651c7a`** (R18C2A tables), **`53973f0`** (R18C1 sent graph loader).

#### 9.1 Architecture decision (Roofr-aligned infrastructure slice)

R18C3B is the **durable token source** before a public route — **not** Send or customer UI:

```text
Builder mutable draft
→ Contractor Preview/send review
→ immutable sent/signed proposal version
→ mint customer access token bound to sent/signed version
→ future /p/[token] route
→ view/sign/PDF/payment/lifecycle later
```

**R18C3B does not enable Send or expose public UI.** It only creates the mint infrastructure needed before R18C4.

#### 9.2 Code delivered (`5c47854`)

| Artifact | Role |
|----------|------|
| `app/lib/proposalPublicAccessTokenMint.ts` | Pure token generation (`randomBytes(32).base64url`), prefix extraction, hash via `hashProposalPublicAccessToken` |
| `app/lib/proposalPublicAccessTokenMintPersistence.ts` | Injectable RPC persistence: `mintViaRpc(supabase, …)` with **`p_token_hash` + `p_token_prefix` only** |
| `app/lib/proposalPublicAccessTokenMintStore.server.ts` | **`import "server-only"`** + `createAdminClient()` entry point: `mintProposalPublicAccessToken` |

**Committed migration files:**

- `supabase/migrations/20260626_018_create_proposal_public_access_mint_rpc.sql`
- `supabase/migrations/20260626_019_harden_proposal_public_access_mint_rpc_permissions.sql`

**RPC:** **`mint_proposal_public_access_token_v1`**

- Accepts **`p_token_hash`** and **`p_token_prefix`** — **not** raw token
- Validates hash, prefix, expiry, company/proposal/version binding, and **sent/signed version kind**
- Returns narrow success envelope (**no `token_hash`**)
- Raw token generated server-side; returned **once only** from server-only mint success envelope
- Raw token **never** stored, logged, inserted into metadata, or sent to SQL/RPC
- DB stores **`token_hash` only** plus non-secret prefix
- Mint **does not** mutate `proposals.status` or proposal lifecycle

#### 9.3 Permission hardening (019 + live verify)

| Function | PUBLIC | anon | authenticated | service_role |
|----------|--------|------|---------------|--------------|
| **`mint_proposal_public_access_token_v1`** | no EXECUTE | no EXECUTE | no EXECUTE | **EXECUTE** |
| **`resolve_proposal_public_access_token_v1`** | no EXECUTE | no EXECUTE | no EXECUTE | EXECUTE (preserved) |
| **`record_proposal_customer_view_v1`** | no EXECUTE | no EXECUTE | no EXECUTE | EXECUTE (preserved) |
| **`proposal_assert_public_access_token_active_v1`** | no EXECUTE | no EXECUTE | no EXECUTE | **no EXECUTE** |

**Preserved:** R18C2B resolve/record permissions; R18C2A tables/RLS/triggers; R18B send-freeze RPC; internal validator **not** directly executable by `service_role`.

#### 9.4 Tests / verification (R18C3B)

| Check | Result |
|-------|--------|
| `proposalPublicAccessTokenMint.test.ts` | **7/7 pass** |
| `proposalPublicAccessTokenMintPersistence.test.ts` | **14/14 pass** |
| `proposalPublicAccessTokenMintStore.server.test.ts` | **5/5 pass** |
| **R18C3B targeted total** | **26/26 pass** |
| `app/lib/proposal*.test.ts` | **768/768 pass** |
| `npx tsc --noEmit` | **No errors in R18C3B files**; unrelated pre-existing project errors remain |

#### 9.5 Live DB apply / verification

**Migrations applied** to approved Supabase project **`rhquhnujjnzjhweypavd`:**

- `20260626_018_create_proposal_public_access_mint_rpc.sql`
- `20260626_019_harden_proposal_public_access_mint_rpc_permissions.sql`

| Result | Value |
|--------|-------|
| Verification effective status | **`all_pass`** |

**Verifier false negative (not a migration defect):** one automated check searched `pg_get_functiondef` for `SET search_path = public`, but live **`proconfig`** showed **`search_path=public`**, confirming correct search_path pinning.

#### 9.6 Disposable smoke (R18C3B-DISPOSABLE)

Used existing **R18B4D disposable sent version** (row left in place under disposable artifact policy):

| Field | Value |
|-------|-------|
| `proposal_version_id` | `f9bb4c91-442d-4e20-abf9-0f6adde90755` |
| `proposal_id` | `c0b9a92e-78da-444e-8aff-0f2cd192987a` |
| `company_id` | `e1fd48bb-fe22-4dfe-9622-3f25eb2109b6` |

| Check | Result |
|-------|--------|
| Mint via `mint_proposal_public_access_token_v1` | **PASS** — `token_id` **`018aa59a-60e9-4ebe-80ca-7309ce5096b2`** |
| Resolve via `resolve_proposal_public_access_token_v1` | **PASS** |
| Same company/proposal/version binding | **PASS** |
| DB stores hash only | **PASS** — raw token not in DB/metadata |
| Proposal status/lifecycle unchanged | **PASS** |
| Smoke metadata | `{ smoke: "R18C3B-DISPOSABLE" }` |

#### 9.7 Boundaries preserved (R18C3B)

- **No** public route (`/p/[token]`)
- **No** customer-facing UI
- **No** Send / email delivery / PDF / Sign / Payment / lifecycle enablement
- **No** `proposals.status` mutation from mint or view recording
- **No** sent proposal version mutation

#### 9.8 Committed files (`5c47854`)

- `app/lib/proposalPublicAccessTokenMint.ts` + `.test.ts`
- `app/lib/proposalPublicAccessTokenMintPersistence.ts` + `.test.ts`
- `app/lib/proposalPublicAccessTokenMintStore.server.ts` + `.test.ts`
- `supabase/migrations/20260626_018_create_proposal_public_access_mint_rpc.sql`
- `supabase/migrations/20260626_019_harden_proposal_public_access_mint_rpc_permissions.sql`

### 10. R18C4A COMPLETION — PUBLIC PROPOSAL ACCESS ORCHESTRATOR + RENDER-READY VIEW MODEL

**Status:** **R18C4A complete and committed** at **`8523812`**. **Working tree clean after commit.**

#### 10.1 Code delivered (`8523812`)

| File | Role |
|------|------|
| `app/lib/proposalPublicAccessOrchestrator.ts` | Shared orchestrator types + pipeline contract |
| `app/lib/proposalPublicAccessOrchestrator.server.ts` | Server-only public proposal access orchestrator |
| `app/lib/proposalPublicAccessOrchestrator.server.test.ts` | Orchestrator server tests |
| `app/lib/proposalPublicProposalContext.ts` | Public proposal context helpers |
| `app/lib/proposalPublicEstimatePresentation.ts` | Public estimate presentation mapping |
| `app/lib/proposalPublicProposalViewModel.ts` | Pure render-ready public proposal document view model |
| `app/lib/proposalPublicProposalViewModel.test.ts` | View model tests |

#### 10.2 Behavior

- **Server-only public proposal access orchestrator**
- **Pure render-ready public proposal document view model**
- **Token-first pipeline prepared for `/p/[token]`**
- Pipeline: **resolve → sent/signed graph → public DTO → public document VM → record view**
- **Render-ready regions:** meta, header, cover, pages, estimate/options, futureActions, footer, error
- **Future actions modeled as deferred only:** Sign/Accept R18G, Download PDF R18H, Pay deposit R18I
- **No route/UI in R18C4A**
- **No Send/PDF/Sign/Payment/lifecycle/status changes**

#### 10.3 Tests (R18C4A)

| Suite | Result |
|-------|--------|
| R18C4A targeted | **22/22 pass** |
| Proposal lib suite after R18C4A | **790/790 pass** |
| `tsc` | No R18C4A file errors; unrelated pre-existing errors remained |

---

### 11. R18C4B COMPLETION — PUBLIC PROPOSAL ROUTE + CUSTOMER SHELL

**Status:** **R18C4B complete and committed** at **`265d8f6`**. **Working tree clean after commit.**

#### 11.1 Code delivered (`265d8f6`)

| File | Role |
|------|------|
| `app/lib/proposalPublicAccessOrchestrator.server.ts` | Updated default graph loader dependency |
| `app/lib/proposalPublicAccessOrchestrator.server.test.ts` | Updated orchestrator route tests |
| `app/lib/proposalPublicRouteGuardrails.test.ts` | Route guardrail tests |
| `app/lib/proposalVersionGraphStore.server.ts` | Server-capable public graph loader (`getPublicProposalVersionGraph`) |
| `app/lib/proposalVersionGraphStore.server.test.ts` | Graph store server tests |
| `app/p/layout.tsx` | Light public layout (no FieldDive app shell) |
| `app/p/[token]/page.tsx` | Server component route — token from params only |
| `app/p/[token]/PublicProposalPage.tsx` | Success document shell |
| `app/p/[token]/PublicProposalErrorPage.tsx` | Customer-safe error page |
| `app/p/[token]/PublicProposalHeader.tsx` | Slim branded header |
| `app/p/[token]/PublicProposalCoverSection.tsx` | Cover / intro block |
| `app/p/[token]/PublicProposalDocumentPages.tsx` | Scrollable document page sections |
| `app/p/[token]/PublicProposalEstimateSection.tsx` | Option/estimate cards |
| `app/p/[token]/PublicProposalFutureActions.tsx` | Deferred future actions section |
| `app/p/[token]/PublicProposalFooter.tsx` | Company contact footer |
| `app/p/[token]/PublicProposalCompanyMark.tsx` | Company mark (logo fallback) |
| `app/p/[token]/publicProposalStyles.ts` | Public shell styles |

#### 11.2 Route behavior

- **New public route:** `/p/[token]`
- Server component route reads **token from params only**
- **No** `searchParams` / job / proposal / version query params
- Calls **`loadPublicProposalByToken(token)`**
- Success renders **`result.document` only**
- Failure renders **`result.error` only**
- **`result.tracking` is never passed to client**
- **`robots: noindex/nofollow`**
- **No** FieldDive app shell, Builder chrome, Preview chrome, or legacy `/approve` reuse

#### 11.3 Public shell layout

- Light public layout
- Slim branded header
- Centered document container
- Cover / intro proposal block
- Scrollable document page sections
- Option/estimate cards
- Deferred future actions section
- Company contact footer
- Safe customer error page
- Mobile **390px** responsive layout

#### 11.4 Deferred action state

- **Sign / Accept proposal** — visible but disabled/deferred
- **Download PDF** — visible but disabled/deferred
- **Pay deposit** — visible but disabled/deferred
- **No** click handlers, links, forms, API calls, Send/PDF/Sign/Payment/lifecycle wiring

#### 11.5 Server graph loader blocker + fix

**Initial R18C4B browser smoke found a blocking valid-token bug:**

- Resolve RPC succeeded, but server graph load returned **null** because `proposalPublicAccessOrchestrator.server.ts` defaulted to `getProposalVersionGraph`, which used `getSupabaseClient()`; **`getSupabaseClient()` returns null on server when `window` is undefined**
- Result: valid `/p/[token]` rendered **`graph_unavailable`**

**Fix (included in `265d8f6`):**

- Added **`app/lib/proposalVersionGraphStore.server.ts`** with **`getPublicProposalVersionGraph`**
- Imports **`server-only`**, uses **`createAdminClient()`**, reuses **`getProposalVersionGraph`** with injected `getSupabase`, and enforces **`requireSentVersion: true`**
- **`proposalPublicAccessOrchestrator.server.ts`** now uses **`getPublicProposalVersionGraph`** as default `getVersionGraph` dependency

**Why it matters:**

- Public route graph reads are now **server-capable** and still **token-bound** to resolved `company_id` / `proposal_id` / `proposal_version_id`
- **No** draft graph fallback
- **No** route query params
- **No** mutable proposal version reads
- **No** status/lifecycle mutation

#### 11.6 Browser smoke / audit results (post-fix)

**Valid-token browser smoke PASS:**

- Token resolves
- Sent graph loads
- Public document shell renders
- Header renders
- Cover renders
- Project overview / scope / warranty / terms pages render
- Multi-option estimate cards render: Standard / Enhanced / Premium
- Future actions render disabled/deferred
- Footer renders
- No tracking envelope visible
- No raw token / internal IDs visible
- No console errors

**Error path smoke PASS:**

- `/p/not-a-real-token` — customer-safe invalid-token error
- `/p/%20%20%20` — whitespace token rejected / customer-safe error
- No stack traces, no internal IDs, no app shell

**Mobile 390px Playwright smoke PASS:**

- No horizontal overflow
- Header stacks
- Cover stacks
- Option cards stack
- Future actions stack
- Footer readable
- No interactive buttons / links / forms in page content

#### 11.7 Tests (R18C4B + blocker fix)

| Suite | Result |
|-------|--------|
| `proposalVersionGraphStore.server.test.ts` | **7/7 pass** |
| `proposalPublicRouteGuardrails.test.ts` | **7/7 pass** |
| `proposalPublicProposalViewModel.test.ts` | **11/11 pass** |
| `proposalPublicAccessOrchestrator.server.test.ts` | **11/11 pass** |
| Proposal lib full suite after R18C4B/fix | **804/804 pass** |
| `tsc` | No R18C4B/blocker-fix file errors; unrelated pre-existing project errors remain |

#### 11.8 Boundaries preserved (R18C4B)

- **No** Send / email delivery
- **No** PDF generation or download wiring
- **No** Sign / acceptance wiring
- **No** Payment / deposit wiring
- **No** lifecycle / status mutation
- **No** pricing changes
- **Read-only** public customer surface

---

### 12. R18C4C COMPLETION — CONTRACTOR PREVIEW PUBLIC REVIEW LINK PANEL

**Status:** **R18C4C complete and committed** at **`bab25c8`**. **Authenticated browser smoke PASS.** **Working tree clean after code commit.**

#### 12.1 Code delivered (`bab25c8`)

| File | Role |
|------|------|
| `app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx` | Mounts Customer view readiness panel above draft preview document |
| `app/tools/roofing/proposals/preview/ProposalCustomerPreviewPublicAccessPanel.tsx` | Panel UI: create/open/copy review link; deferred Send/Sign/PDF/Payment row |
| `app/api/proposals/public-review-link/route.ts` | Authenticated POST endpoint |
| `app/lib/proposalPublicReviewLink.ts` | Injectable mint orchestration (testable) |
| `app/lib/proposalPublicReviewLink.server.ts` | Server-only bridge to R18C3B mint + company-scoped proposal load |
| `app/lib/proposalPublicReviewLink.server.test.ts` | Mint + guardrail tests |
| `app/lib/proposalPublicReviewReadiness.ts` | Pure readiness VM + product copy constants |
| `app/lib/proposalPublicReviewReadiness.test.ts` | Readiness state tests |

#### 12.2 Behavior

Authenticated **Contractor Preview** now includes a **Customer view / Public Proposal readiness panel** above the draft preview document.

The panel lets the contractor **create a review link**, **open the customer view**, and **copy the review link** for QA/review.

- Review link creation uses existing **R18C3B mint infrastructure** through a server-only bridge.
- Review link opens the existing **R18C4B `/p/[token]`** public proposal route.
- Raw token is returned only as part of the review URL after explicit contractor action.
- Raw token is **not** stored in DB/localStorage, **not** logged, and **`token_hash` is never exposed**.
- Panel clearly says the link is a **review link only** and **does not email the customer**.

**R18C4C review links are not Send.** They do not email the customer, do not mutate lifecycle/status, do not create sent events, do not enable PDF/Sign/Payment, and do not change pricing.

#### 12.3 Panel UI states

| State | Behavior |
|-------|----------|
| **Loading** | Checking public proposal readiness |
| **No sent snapshot** | “Customer view requires a sent proposal snapshot”; Create/Open/Copy **disabled**; draft preview still renders |
| **Sent snapshot ready** | Create review link **enabled**; Open/Copy **disabled** until mint |
| **Review link ready** | Open customer view and Copy review link **enabled** |
| **Mint error** | Customer-safe error; no stack traces/internal IDs |

**Deferred actions (always disabled in R18C4C):**

- Send proposal — not enabled yet
- Signature — coming later
- PDF — coming later
- Payment — coming later

No Send/email/PDF/Sign/Payment/lifecycle/status behavior is wired.

#### 12.4 Server/API behavior

**New POST endpoint:** `/api/proposals/public-review-link`

- Authenticated only
- Validates Supabase session and company context
- Validates `proposalId` / `jobId` UUIDs
- Loads proposal through company-scoped server Supabase client
- Verifies proposal belongs to company and `job_id` matches request
- Requires `signed_version_id` or `latest_sent_version_id`
- Mints public access token with metadata `{ source: "contractor_preview_qa" }`
- Returns narrow response: `{ ok, publicUrl, tokenPrefix, expiresAt }`
- Does **not** return `token_hash` or internal IDs
- Does **not** mutate `proposals.status`
- Does **not** create `proposal_events` sent events
- Does **not** send email

#### 12.5 Authenticated browser smoke

**Happy-path smoke PASS** on existing **R18B4D disposable** proposal (`c0b9a92e-…` / job `6fb015e6-…`):

- Contractor Preview loaded
- Sent snapshot status **Ready**
- Create review link POST **200**
- Review-link-ready UI rendered
- Open customer view opened `/p/<token>`
- Public shell rendered header, cover, pages, options, deferred actions, footer
- Copy review link copied full URL
- No raw token localStorage persistence
- No Send/email/lifecycle mutation
- No `token_hash` / internal IDs visible

**No-sent-snapshot path PASS:**

- Panel explains sent snapshot required
- Create/Open/Copy disabled
- Draft preview still renders
- POST returns safe **400** if attempted

**390px Preview PASS:**

- No horizontal overflow
- Panel stacks; buttons stacked/readable
- Deferred actions wrap
- Draft preview remains usable

**390px public route from panel PASS:**

- No horizontal overflow
- Header/cover/options/future actions/footer stack correctly

#### 12.6 Tests (R18C4C)

| Suite | Result |
|-------|--------|
| R18C4C targeted (5 files) | **46/46 pass** |
| Proposal lib full suite after R18C4C | **821/821 pass** |
| `tsc` | No R18C4C file errors; unrelated pre-existing project errors remain |

#### 12.7 Boundaries preserved (R18C4C)

- **No** Send / email delivery
- **No** PDF generation or download wiring
- **No** Sign / acceptance wiring
- **No** Payment / deposit wiring
- **No** lifecycle / status mutation
- **No** pricing changes
- Review link is **QA/review only** — not production Send

---

### 13. R18D1 COMPLETION — CONTRACTOR PREVIEW SEND GATE READINESS + EMAIL DRAFT REVIEW (§6BN.13)

**Status:** **R18D1 complete and committed** at **`304ed0f`**. **Tests/smoke PASS.** **Working tree clean after code commit.**

#### 13.1 Code delivered (`304ed0f`)

| File | Role |
|------|------|
| `app/lib/proposalSendGateReadiness.ts` | Pure Send gate readiness VM + context resolvers |
| `app/lib/proposalSendGateReadiness.test.ts` | Readiness states, guardrails, preview-only placement tests |
| `app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx` | Send proposal readiness panel UI |
| `app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx` | Mounts Send panel below R18C4C Customer View panel, above draft document |

#### 13.2 Behavior

Authenticated **Contractor Preview** now includes a **Send proposal readiness panel** below the R18C4C Customer View / review-link panel and above the draft preview document.

The panel shows:

- Readiness checklist
- Recipient email state
- Email draft preview (To / Subject / Body)

**Send proposal button remains disabled in R18D1.**

Panel explicitly says **Email delivery is not enabled yet.**

Message preview uses **Available after send** for the public proposal link and **does not reuse the R18C4C QA review link** as the customer-send link.

Subject/body may be edited locally in React state only — **no persistence, no send, no API call.**

**R18D1 is not Send.** It does not deliver email, call Resend, freeze a proposal, mint public tokens, mutate `proposals.status`, create `proposal_events` sent events, enable PDF/Sign/Payment, add SQL/migrations, change pricing engine math, or add Builder Send controls.

#### 13.3 Readiness VM

**New pure helper:** `buildProposalSendGateReadinessViewModel`.

Always returns **`deliveryEnabled: false`** and **`canSend: false`** in R18D1.

**Checklist includes:**

- Customer view
- Sent snapshot
- Pricing & scope
- Recipient email
- Branding & identity

**Message preview includes:**

- To
- Subject
- Body
- `linkLabel`: **Available after send**

**Input behavior:**

- `hasSentSnapshot` comes from `signed_version_id` or `latest_sent_version_id`.
- Recipient/customer/company/address values resolve from existing Preview graph/context data.
- Send-freeze readiness can inform checklist warnings/blockers but **R18D1 does not call freeze**.
- Preview readiness can inform pricing/scope warning states.

#### 13.4 Panel UI states

| State | Behavior |
|-------|----------|
| **Loading** | Checking send readiness… |
| **No sent snapshot** | Customer view needs a sent proposal snapshot; Send remains disabled |
| **Sent snapshot ready** | Customer view and Sent snapshot ready; Send still disabled |
| **Missing recipient email** | Recipient email marked missing; no editing/persistence added in R18D1 |
| **Message preview** | Local-only draft subject/body; public link says **Available after send** |

**Deferred actions (always disabled in R18D1):**

- Signature — coming later
- PDF — coming later
- Payment — coming later

#### 13.5 Routes / API (R18D1)

**No new route was added in R18D1.**

Existing route remains:

- `/api/proposals/public-review-link` — **R18C4C review-link mint only, not Send**

**No `/api/proposals/send` or `/api/proposals/send-prep` route exists after R18D1.**

#### 13.6 Tests (R18D1)

| Suite | Result |
|-------|--------|
| R18D1 targeted (`proposalSendGateReadiness.test.ts`) | **13/13 pass** |
| `proposalPublicReviewReadiness.test.ts` | **9/9 pass** |
| Proposal lib full suite after R18D1 | **834/834 pass** |
| `tsc` | No R18D1-only file errors; unrelated pre-existing project errors remain |

#### 13.7 Authenticated browser smoke (R18D1)

**No-sent-snapshot Preview smoke PASS** (`f5a7d4ab-…` / `f3a12198-…`):

- Customer View panel unchanged
- Send panel visible below it
- Checklist shows needs sent snapshot / not created yet
- Recipient email state renders
- Message preview renders
- Send proposal disabled
- Draft document renders

**Sent-snapshot Preview smoke PASS** (`6fb015e6-…` / `c0b9a92e-…`):

- Customer View panel remains usable
- Send panel shows Customer view and Sent snapshot ready
- Message preview populated
- Send disabled with delivery-not-enabled copy

**390px smoke PASS:**

- Customer View and Send panels stack
- Checklist and message preview readable
- No horizontal overflow
- Draft preview remains usable

#### 13.8 Boundaries preserved (R18D1)

- **No** Send / email delivery
- **No** Resend
- **No** freeze (`freezeDraftToSentSnapshot` not called)
- **No** public token mint
- **No** PDF generation or download wiring
- **No** Sign / acceptance wiring
- **No** Payment / deposit wiring
- **No** lifecycle / status mutation
- **No** SQL / migrations
- **No** pricing engine math changes
- **No** Builder Send controls

---

### 15. R18D2 COMPLETION — CONTRACTOR PREVIEW CUSTOMER SEND LINK PREP (§6BN.15)

**Status:** **R18D2 complete and committed** at **`845e8d5`**. **Tests/smoke PASS with documented fixture caveat.** **Working tree clean after code commit.**

#### 15.1 Code delivered (`845e8d5`)

| File | Role |
|------|------|
| `app/lib/proposalSendPrep.ts` | Pure send-prep orchestrator + refreeze helpers + recipient email hash |
| `app/lib/proposalSendPrep.server.ts` | Server wiring: freeze, mint, pricing staleness |
| `app/lib/proposalSendPrep.server.test.ts` | Orchestration + guardrail tests |
| `app/api/proposals/send-prep/route.ts` | Authenticated POST send-prep endpoint |
| `app/lib/proposalSendGateReadiness.ts` | R18D2 copy constants + `canPrepareCustomerLink` readiness |
| `app/lib/proposalSendGateReadiness.test.ts` | R18D2 prepare-link coverage |
| `app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx` | Prepare / Open / Copy UI |
| `app/tools/roofing/proposals/preview/ProposalCustomerPreviewClient.tsx` | Passes `jobId` / `proposalId` to Send panel |

#### 15.2 Behavior

Authenticated **Contractor Preview Send panel** now has a **Prepare customer link** action.

**Prepare customer link** calls **`POST /api/proposals/send-prep`**.

Send-prep validates readiness, recipient email, job/proposal binding, and company access.

Send-prep freezes, reuses, or refreezes a sent snapshot as needed.

Send-prep mints a fresh **customer-send** public token.

The **customer-send link is distinct from the R18C4C QA review link**.

On success, UI shows **Customer send link ready** with **Open customer proposal** and **Copy customer send link**.

**Send proposal by email:** enabled when readiness + sent snapshot exist (**R18D3B**, §6BN.18). **Does not** mutate proposal/job lifecycle/status.

**Historical (R18D2 only):** Send proposal remained disabled until R18D3B.

#### 15.3 API output contract

**`POST /api/proposals/send-prep` success:**

```json
{
  "ok": true,
  "publicUrl": "...",
  "tokenPrefix": "...",
  "expiresAt": "...",
  "snapshotStatus": "created" | "reused" | "refrozen",
  "deliveryEnabled": false
}
```

**Failure:**

```json
{
  "ok": false,
  "message": "...",
  "code": "..."
}
```

**API never returns:** `raw_token`, `rawToken`, `token_hash`, `proposal_version_id`, `proposal_id`, `job_id`, `company_id`, internal token UUIDs, RPC details, stack traces.

#### 15.4 Snapshot behavior

| Case | Behavior | `snapshotStatus` |
|------|----------|------------------|
| **No sent snapshot** | If readiness passes and `USE_PROPOSAL_SEND_FREEZE_RPC=1`, send-prep freezes a sent snapshot | `"created"` |
| **Freeze RPC gate unavailable** | Safe failure — snapshot preparation not available yet | — |
| **Existing fresh sent snapshot** | Reuses existing snapshot; no freeze | `"reused"` |
| **Stale snapshot** | If `draftUpdatedAt > sentVersionFrozenAt` or pricing stale, refreezes | `"refrozen"` |
| **Signed snapshot** | Signed snapshot wins and is reused; **no refreeze** | `"reused"` |

**Env gate:** Any path requiring freeze requires **`USE_PROPOSAL_SEND_FREEZE_RPC=1`** in the server process. Used **only in process env for smoke**; **no env files committed/modified**. Default global behavior remains unchanged.

#### 15.5 Token/link behavior

- R18D2 mints a **fresh customer-send token**
- **Metadata:** `{ source: "contractor_send_prep", channel: "customer_link_prep" }`
- Recipient email is normalized lowercase/trim and SHA-256 hashed into `recipient_email_hash`
- **Raw email is not placed in token metadata**
- Raw token exists only inside `publicUrl` in the API response and React session state
- **No token persisted in localStorage/DB/logs**
- **`token_hash` is never exposed to the client**
- Supersede/revoke **not implemented** in R18D2; multiple QA/customer-prep links may coexist short-term

**R18D3 implication:** Because raw tokens cannot be reconstructed from DB, R18D3 should plan whether to mint a fresh token at actual email send time or reuse a session-held URL. **Default recommendation remains: R18D3 should mint fresh at actual email send.**

#### 15.6 Status/event/lifecycle boundaries

**R18D2 is not email Send.** R18D2 does not deliver email, call Resend, add `/api/proposals/send`, set `proposals.status = sent`, create `proposal_events` with `event_type = sent`, move jobs, mark customer notified, enable PDF/Sign/Payment, add SQL/migrations, or change pricing engine math.

**Allowed:** Existing freeze RPC may create `snapshot_frozen` events with **`delivery=false`**. These are prep-only snapshot audit events, **not** customer-notified or sent events.

#### 15.7 UI states

| Phase | UI |
|-------|-----|
| **Before prep** | Message preview says **Available after send**; **Prepare customer link** visible/enabled when readiness + recipient email pass; **Send proposal** disabled |
| **Preparing** | **Preparing customer link…** |
| **After prep success** | **Customer send link ready**; **Open customer proposal**; **Copy customer send link**; message preview says **Customer link ready**; **Send proposal** still disabled; **Email delivery is not enabled yet** |

**Wording:** Use **Prepare customer link** / **Customer send link ready** / **Open customer proposal** / **Copy customer send link**. Avoid **sent to customer** / **email sent** / **send complete** / **customer notified**.

#### 15.8 Routes / API (R18D2)

| Route | Role |
|-------|------|
| `/api/proposals/send-prep` | **R18D2 authenticated send-prep only** — prepares customer-send link; **does not email**, **does not set sent status**, **does not mark customer notified** |
| `/api/proposals/public-review-link` | **R18C4C review-link mint only** — QA/review; distinct from customer-send prep |

**No `/api/proposals/send` delivery route exists after R18D2.**

#### 15.9 Tests (R18D2)

| Suite | Result |
|-------|--------|
| `proposalSendPrep.server.test.ts` | **40/40 pass** (incl. orchestration + guardrails) |
| `proposalSendGateReadiness.test.ts` | Included in full pass |
| `proposalPublicReviewReadiness.test.ts` | Included in full pass |
| Full `app/lib/proposal*.test.ts` | **852/852 pass** |
| `tsc` | **No R18D2 file errors**; unrelated pre-existing project errors remain |

#### 15.10 Authenticated browser smoke (R18D2)

**Sent-snapshot browser path PASS** (R18B4D disposable fixture `6fb015e6-…` / `c0b9a92e-…`):

- **Prepare customer link** → `POST /api/proposals/send-prep` **200**
- `snapshotStatus`: **`refrozen`** (stale draft vs frozen snapshot per helper)
- UI showed **Customer send link ready**
- **Open customer proposal** opened `/p/<token>` — public shell rendered header, cover, pages, options, deferred actions, footer
- **Copy customer send link** copied full URL
- No localStorage token persistence
- `proposal.status` remained **`draft`**
- No `proposal_events` with `event_type = sent`
- `snapshot_frozen` event(s) had **`delivery=false`** only

**No-sent-snapshot browser created path — not executed:**

- Fixture `f5a7d4ab-…` / `f3a12198-…` had incomplete **Standard** option pricing
- **Prepare customer link correctly disabled** due readiness blocker — expected behavior
- **`created` snapshot path covered by unit/orchestrator tests**

**390px Preview and public route PASS:**

- Customer View and Send panels stack
- Prepare/Open/Copy buttons readable
- Message preview readable
- No horizontal overflow
- Public route opened from customer send link stacks correctly

#### 15.11 Boundaries preserved (R18D2)

- **No** Send / email delivery
- **No** Resend
- **No** `/api/proposals/send`
- **No** `proposals.status = sent`
- **No** sent `proposal_events`
- **No** PDF / Sign / Payment wiring
- **No** lifecycle / customer-notified semantics
- **No** SQL / migrations
- **No** pricing engine math changes

---

### 17. R18D3A COMPLETION — DELIVERY ATTEMPT FOUNDATION (§6BN.17)

**Status:** **R18D3A complete and committed** at **`57786ca`**. **Tests PASS.** **Working tree clean after code commit.** **Migration `20260626_020` live-applied + verified PASS** on **`rhquhnujjnzjhweypavd`** (§6BN.17.7).

#### 17.1 Code delivered (`57786ca`)

| File | Role |
|------|------|
| `supabase/migrations/20260626_020_create_proposal_delivery_attempts.sql` | `proposal_delivery_attempts` table + indexes + triggers + RLS/grants — **live-applied + verified PASS** on `rhquhnujjnzjhweypavd` |
| `app/lib/proposalDeliveryAttemptTypes.ts` | Status/channel/provider/row/input types + email normalize/hash/redaction helpers |
| `app/lib/proposalDeliveryAttemptPersistence.ts` | Testable DB persistence layer (injectable Supabase client) |
| `app/lib/proposalDeliveryAttemptStore.server.ts` | Server-only store entry (`createAdminClient`) |
| `app/lib/proposalDeliveryAttemptViewModel.ts` | Contractor-safe delivery attempt labels/display |
| `app/lib/proposalDeliveryAttemptStore.server.test.ts` | Migration guardrails + store behavior tests |
| `app/lib/proposalDeliveryAttemptViewModel.test.ts` | View-model label/omission tests |

#### 17.2 Purpose and boundaries

**R18D3A adds the delivery-attempt audit foundation required before real customer email delivery.**

It does **not** send email. It does **not** call Resend. It does **not** add `/api/proposals/send`. It does **not** enable the Send button. It does **not** mutate proposal status. It does **not** create `proposal_events.sent`. It does **not** move Jobs Board cards. It does **not** add Job Card activity. Migration **`20260626_020`** is **live-applied and verified** on **`rhquhnujjnzjhweypavd`** (§6BN.17.7).

**Table purpose:** `proposal_delivery_attempts` records one contractor-initiated **email delivery attempt** for a frozen **sent/signed** proposal version. It stores provider/idempotency/lifecycle audit data while keeping proposal lifecycle/status separate. **`provider_accepted` means the provider accepted the send request** — it is **not** customer viewed, **not** `proposals.status = sent`, and **not** Jobs Board truth.

#### 17.3 Migration summary (`20260626_020`)

Creates `public.proposal_delivery_attempts` with:

- Company-scoped composite FKs to `proposals`, `proposal_versions`, `proposal_public_access_tokens`
- `channel`/`provider`/`status` CHECK constraints
- `recipient_email_hash` format guard
- `metadata_json` object guard
- Unique index on `(company_id, idempotency_key)`
- Partial unique index on `(provider, provider_message_id)` where message id is not null
- Proposal/history query indexes
- `updated_at` trigger
- Row guards: forbidden metadata keys, insert binding, immutable columns, status transitions
- RLS enabled; authenticated SELECT only for company members; no authenticated INSERT/UPDATE/DELETE policies
- Hardened grants: REVOKE ALL then GRANT SELECT to `authenticated`

**Status values:** `prepared`, `attempted`, `provider_accepted`, `failed`, `delivered`, `bounced`, `complained`

**Allowed transitions:** `prepared→attempted`; `attempted→provider_accepted|failed`; `provider_accepted→delivered|bounced|complained`; same-status no-op allowed.

#### 17.4 Privacy and token rules

- **No raw recipient email** stored by default — `recipient_email_hash` + optional `recipient_email_redacted`
- **No raw token** or **token_hash** stored or exposed
- Rows may store `proposal_public_access_token_id` and `token_prefix`
- `metadata_json` forbids: `raw_token`, `rawToken`, `token`, `token_hash`, `recipient_email`, `raw_email`, `email`

#### 17.5 Server/store/view model

| Module | Role |
|--------|------|
| `proposalDeliveryAttemptPersistence.ts` | Testable DB/persistence layer |
| `proposalDeliveryAttemptStore.server.ts` | Server-only admin write patterns |
| `proposalDeliveryAttemptTypes.ts` | Types + email normalize/hash/redaction helpers |
| `proposalDeliveryAttemptViewModel.ts` | Contractor-safe labels and display fields |

**Store functions:** `createProposalDeliveryAttempted`, `markProposalDeliveryAttemptProviderAccepted`, `markProposalDeliveryAttemptFailed`, `listProposalDeliveryAttemptsForProposal`

**View-model labels:**

| Status | Label |
|--------|-------|
| `prepared` | Prepared |
| `attempted` | Sending |
| `provider_accepted` | Accepted by email provider |
| `failed` | Failed |
| `delivered` | Delivered |
| `bounced` | Bounced |
| `complained` | Complaint received |

**Wording guardrail:** `provider_accepted` must **not** be labeled **"Sent to customer"** until proposal status/events/job activity semantics are explicitly approved in a later slice.

#### 17.6 Tests

| Suite | Result |
|-------|--------|
| `proposalDeliveryAttemptStore.server.test.ts` | **23/23 PASS** |
| Full `app/lib/proposal*.test.ts` | **875/875 PASS** |
| `tsc --noEmit` | Pre-existing unrelated errors only; **no R18D3A file errors** |

**Coverage:** migration guardrails; RLS/grants content; forbidden metadata keys; no proposal status mutation; no `proposal_events` insert; store insert/update/list; safe error truncation; no raw token/token_hash/raw email persistence; view-model labels; omission of internal IDs/hashes/`provider_message_id`/`token_prefix`.

#### 17.7 Migration apply status and next step

Migration `20260626_020_create_proposal_delivery_attempts.sql` is **live-applied and verified** on approved Supabase project **`rhquhnujjnzjhweypavd`**.

**R18D3A live verification PASS:**

- table exists with RLS enabled
- columns, constraints, indexes, triggers, policies, and grants match contract
- authenticated SELECT-only policy/grants verified by inspection
- invalid status/hash rejected
- forbidden metadata keys rejected
- draft version binding rejected
- sent/signed version binding accepted
- token mismatch rejected; matching token accepted
- company_id + idempotency_key uniqueness enforced
- allowed/rejected status transitions verified
- immutable column guards verified
- no lifecycle mutation: proposal.status unchanged, proposal_events unchanged, jobs.stage unchanged
- verification rows cleaned up; no leftovers

**Next:** **R18D3B complete + live-smoked** (§6BN.18). **Next slice:** customer-facing email/public proposal presentation polish, then R18D3C contractor delivery status/history UI planning after design/readiness review. **R18D3B still must not** mutate `proposals.status`, write `proposal_events.sent`, move Jobs Board cards, or add Job Card activity unless separately approved.

**Future docs updates should be batched when reasonable unless a step changes major state, DB/live apply status, protected guardrails, route behavior, or handoff-critical architecture.**

#### 17.8 Routes

**`/api/proposals/send-prep`** (R18D2) prepares customer send links only — does not email. **`/api/proposals/send`** (R18D3B) sends proposal email via Resend — see §6BN.18.

---

### 18. R18D3B COMPLETION — REAL PROPOSAL EMAIL SEND ORCHESTRATION (§6BN.18)

**Status:** **R18D3B complete and live-smoked.** Email orchestration code at **`e7cdc51`**. **Live-send verification completed** after optional-upgrade Builder readiness fix **`79e4c4f`**.

#### 18.1 Implemented

| Component | Role |
|-----------|------|
| `POST /api/proposals/send` | Authenticated send route |
| `proposalEmailDelivery.ts` / `proposalEmailDelivery.server.ts` | Pure/server email send orchestration |
| `proposalEmailTemplate.ts` | HTML/text proposal email template |
| Resend HTTP integration | `fetch` with `Idempotency-Key` header |
| Fresh customer-email token mint | Mint at send time (not reuse of prep-only token) |
| Delivery attempt lifecycle | `attempted` → `provider_accepted` / `failed` |
| Preview Send UI | Send button enablement when sent snapshot exists + readiness green |
| Shared send snapshot helper | Reuse from R18D2 |
| Delivery attempt idempotency lookup | `(company_id, idempotency_key)` dedupe |

#### 18.2 Live smoke fixture

| Field | Value |
|-------|-------|
| Job ID | `9cd2c4ac-3e46-4ba9-be58-8558fcd1ba73` |
| Proposal ID | `368dcbf1-4020-44e8-9f60-b25de4525cd9` |
| Recipient | `texasmd817@gmail.com` |
| Sent version (final send) | `b559c605-dc27-4cd6-ab20-c74620791fb7` |
| Delivery attempt ID | `42b2fffc-8480-4561-b461-d0ed59a615ef` |
| Delivery attempt status | `provider_accepted` |
| `provider_message_id` | present |
| `token_prefix` | `vsI7Qv4e` |
| `proposal_public_access_token_id` | `fddeb2cf-e54f-4f38-a025-0cf4c813f5e0` |
| Recipient (redacted) | `t***@gmail.com` |
| `subject_snapshot` | Your proposal from Anderson Roofing |
| `metadata_json` | `{ "source": "r18d3b_email_send" }` |

#### 18.3 User verification

- Email arrived at `texasmd817@gmail.com`
- Subject matched
- **View your proposal** opened the public `/p/...` proposal route
- Public proposal rendered without Builder/Preview chrome

#### 18.4 Lifecycle guardrails

**`provider_accepted` means Resend accepted the email request only.** It does **not** mean customer viewed, signed, paid, job moved, or proposal status changed.

**Verified unchanged after live smoke:**

- `proposal.status` stayed **`draft`**
- `proposal_events` with `event_type = sent` stayed **0**
- `jobs.stage` stayed **`intake`**
- No send-related Job Card activity was created
- No Jobs Board movement
- No PDF generation
- No Sign/acceptance enablement
- No Payment/deposit enablement
- No webhooks
- No migrations/SQL writes during smoke
- No pricing engine changes

#### 18.5 Verification tests

| Suite | Result |
|-------|--------|
| R18D3B targeted | **72/72 PASS** |
| Full `app/lib/proposal*.test.ts` | **902/902 PASS** |
| `tsc --noEmit` | Pre-existing unrelated errors only; **no R18D3B delivery files or optional-upgrade production files involved** |

#### 18.7 Known product/design debt (partially addressed for email at §6BN.19)

- **Email template:** pass-3 polish **Gmail-approved “ok for now”** (§6BN.19) — professional invitation; project-only summary; no price/package/options; no localhost dev artifact. **Not final elite email experience** — deferred brand/logo/deliverability items at §6BN.19.7.
- **Public proposal route:** works but needs customer-facing presentation polish before broader customer use (§6BN.19.7).
- Future pass should improve public proposal readability, package/option presentation, and overall customer-facing polish.
- **Do not solve this** by changing lifecycle semantics, legacy routes, or Send/PDF/Sign/Payment scope.

#### 18.8 Optional-upgrade Builder readiness fix

Commit **`79e4c4f`** fixed a Builder workbench gap where optional-upgrade lines could block pricing readiness but had no UI actions. Enhanced/Premium optional-upgrade blockers now use the existing scope decision architecture for **Set quantity** / **Edit quantity** / **Remove from option** where eligible. This was a **durable Builder readiness fix**, not a smoke-only patch.

**Files:**

- `proposalBuilderWorkbenchEstimatePresenter.ts` / `.test.ts`
- `ProposalBuilderWorkbenchEstimateDocument.tsx`
- `ProposalBuilderWorkbenchUpgradesZone.tsx`

**Tests:**

- Presenter tests **28/28**
- Scope decision tests **29/29**
- Send gate tests **17/17**
- Full proposal lib **902/902**

#### 18.9 Next steps (historical — email polish now complete at §6BN.19)

1. ~~**R18D3B design polish planning:** customer-facing email template and public proposal presentation review.~~ **Email template polish complete** (§6BN.19).
2. **Public proposal presentation polish** remains deferred (§6BN.19.5).
3. Plan **R18D3C** contractor delivery status/history UI.
4. **R18D3D** lifecycle/status/job-board integration remains future and separately approved.
5. **R18D3E** webhooks/delivered/bounced lifecycle remains future.

---

### 19. R18D3B EMAIL TEMPLATE POLISH — PASS 3 ACCEPTED (§6BN.19)

**Status:** **R18D3B email template polish complete + Gmail visual review approved “ok for now.”** Code at **`20a239d`**. Prior docs checkpoint: **`55a5f83`** — docs: record R18D3B live-send verification checkpoint.

#### 19.1 Design principle

**Email = professional handoff / invitation to review.** **Proposal page = sales document** with price, package, options, scope, upgrades, and terms.

#### 19.2 Final current email behavior (pass 3)

| Element | Behavior |
|---------|----------|
| Layout | Contractor-branded card with cyan accent bar |
| Headline | `Your roofing proposal is ready` |
| Body | Short invitation copy — prepared proposal + secure link below |
| Summary card | **Project address only** (no Investment, no Package row) |
| CTA | Blue **`Review proposal`** button |
| Preheader | `Review your roofing proposal for {short address}.` (or online fallback) |
| Excluded from email | Price, package labels, options/upgrades notes |
| Localhost | CTA href works; **no visible localhost fallback URL**; **no customer-visible dev note** |
| Production | Quiet fallback link below CTA preserved for non-localhost URLs |
| Questions footer | `Questions? Reply to this email and {Company} will follow up.` |

#### 19.3 Files committed

- `app/lib/proposalEmailTemplate.ts` / `.test.ts`
- `app/lib/proposalEmailDelivery.ts`
- `app/lib/proposalSendGateReadiness.ts` / `.test.ts`
- `app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx`

#### 19.4 Visual verification

- Pass-3 controlled live send to `texasmd817@gmail.com` — delivery attempt **`285660d0-f7e3-4a63-808c-2e6f799986a9`** **provider_accepted**
- Gmail visual review approved: professional contractor handoff; no price/package/options; no local-dev artifact; project context + blue CTA; selling details remain on proposal page

#### 19.5 Verification tests

| Suite | Result |
|-------|--------|
| `proposalEmailTemplate.test.ts` | **15/15 PASS** |
| `proposalSendGateReadiness.test.ts` | **17/17 PASS** |
| `proposalEmailDelivery.test.ts` | **12/12 PASS** |
| `proposalEmailDelivery.server.test.ts` | **5/5 PASS** |
| Full `app/lib/proposal*.test.ts` | **914/914 PASS** |
| `tsc --noEmit` | Pre-existing unrelated errors only; **no changed email files involved** |

#### 19.6 Guardrails (unchanged)

- **No** send orchestration semantic changes
- **No** token minting changes
- **No** delivery attempt schema/behavior changes
- **No** `proposal.status` / `proposal_events` / jobs / activity changes
- **No** PDF / Sign / Payment / webhooks
- **No** public proposal page changes
- **No** migrations / SQL

#### 19.7 Deferred later — customer-facing polish backlog

**This is not the final elite email/proposal experience.** Track separately; do not block R18D3C planning unless user explicitly prioritizes polish first.

| Item | Notes |
|------|-------|
| Email logo / company branding polish | Stronger contractor identity in email header |
| Sender / from-domain alignment | Deliverability hardening; SPF/DKIM/domain review |
| Production URL / domain verification | Customer emails must not expose localhost; verify `NEXT_PUBLIC_APP_URL` / production domain |
| Public proposal page visual polish | Customer-facing presentation on `/p/[token]` |
| Selected package-first layout | Lead with chosen package on customer proposal |
| Discreet optional upgrades | Show upgrades without competing with primary package decision |
| Raw / internal catalog label cleanup | Hide or translate internal keys for customer readability |
| Package / options hierarchy | Improve customer-facing option presentation and readability |
| Sign / PDF / Payment language | **Only when those systems are explicitly enabled** |

#### 19.8 Next step

- **Default:** Continue from **R18D3D planning only** after R18D3C completion (§6BN.20).
- **Alternative:** User may choose **public proposal presentation polish** first (§6BN.19.7).
- **Do not forget** deferred customer-facing polish backlog.

---

### 20. R18D3C — CONTRACTOR DELIVERY STATUS/HISTORY UI — COMPLETE (§6BN.20)

**Status:** **R18D3C complete.** Browser smoke/audit **PASS** (§6BN.20.8). **Code checkpoint:** **`36a0b55`** (Slice 1 Jobs command surface P0). **Docs checkpoint:** pending this commit (prior docs: **`fc86123`**). **Next:** **Slice 2 — Catalog P0** (§6BO.13).

#### 20.1 Substage commits

| Substage | Commit | Summary |
|----------|--------|---------|
| **R18D3C1** | **`f0627e1`** | Pure delivery history presenter/view-model + tests |
| **R18D3C2** | **`1811f7a`** | Authenticated read API/read path: `GET /api/proposals/delivery-attempts?proposalId=<uuid>&jobId=<uuid>` |
| **R18D3C3** | **`e17eab5`** | Preview Send panel read-only **Email delivery history** UI + post-send refetch |
| **R18D3C4** | *(smoke only)* | Browser smoke/audit PASS — no code changes |

#### 20.2 Completed behavior

Contractor Preview Send panel now shows **read-only email delivery history** below send actions.

It displays:

- Loading state
- Guarded error state
- Empty state (`No emails sent yet` + guidance)
- Latest delivery attempt (emphasized card)
- Earlier attempts newest-first (latest not duplicated)
- Accepted provider status
- Failed/safe-error copy when present
- Redacted recipient
- Subject
- Truncated body preview
- Optional short support reference (`Support ref: …`)

History loads from:

```text
GET /api/proposals/delivery-attempts?proposalId=<uuid>&jobId=<uuid>
```

After successful send, Preview triggers a **history refetch** (`deliveryHistoryRefreshKey`) so persisted history appears without hard refresh.

#### 20.3 Copy / claim guardrails

Delivery history copy intentionally says **“Accepted by email provider,”** not **“Sent to customer.”**

Accepted-state explanation says provider acceptance **does not confirm** the customer received or opened the email.

**Do not use** (unless future webhook/lifecycle work explicitly supports it):

- Customer received
- Customer opened
- Viewed
- Delivered to inbox
- Proposal sent status
- Job moved

#### 20.4 Safety / secret guardrails

UI / API / view models **do not expose:**

- Internal attempt IDs
- `recipient_email_hash`
- `proposal_public_access_token_id`
- `proposal_version_id`
- `provider_message_id`
- `idempotency_key`
- Full `body_snapshot`
- Full token / public URL

**Only** redacted recipient, subject, truncated body preview, timestamps, status labels, safe error copy, and short support prefix may be shown.

#### 20.5 Files (R18D3C)

| Layer | Path |
|-------|------|
| Presenter / VM | `app/lib/proposalDeliveryAttemptViewModel.ts` |
| Read handler (pure) | `app/lib/proposalDeliveryHistory.ts` |
| Read handler (server) | `app/lib/proposalDeliveryHistory.server.ts` |
| Read API | `app/api/proposals/delivery-attempts/route.ts` |
| Client fetch | `app/lib/proposalDeliveryHistoryClient.ts` |
| Preview UI | `app/tools/roofing/proposals/preview/ProposalCustomerPreviewDeliveryHistorySection.tsx` |
| Send panel wiring | `app/tools/roofing/proposals/preview/ProposalCustomerPreviewSendGatePanel.tsx` |

#### 20.6 Verification tests

| Suite | Result |
|-------|--------|
| `npx tsx --test app/lib/proposalDeliveryAttemptViewModel.test.ts` | **17/17 PASS** |
| `npx tsx --test app/lib/proposalDeliveryHistory.server.test.ts` | **14/14 PASS** |
| `npx tsx --test app/lib/proposalDeliveryHistoryClient.test.ts` | **13/13 PASS** |
| `npx tsx --test app/lib/proposal*.test.ts` | **1021/1021 PASS** |
| `npx tsc --noEmit` | Pre-existing unrelated errors only; **no R18D3C errors** |

#### 20.7 R18D3C did **not** implement

- `proposals.status = sent`
- `proposal_events` writes
- Jobs Board movement
- Job Card activity writes
- Lifecycle automation
- Token supersession
- Public route behavior changes
- Resend webhook processing (`delivered` / `bounced` / `complained`)
- PDF
- Sign
- Payment
- Pricing changes

#### 20.8 R18D3C4 browser smoke (PASS)

**Fixture:**

```text
/tools/roofing/proposals/preview?job=9cd2c4ac-3e46-4ba9-be58-8558fcd1ba73&proposal=368dcbf1-4020-44e8-9f60-b25de4525cd9
```

| Check | Result |
|-------|--------|
| Preview loaded | Pass |
| Send panel loaded | Pass |
| Email delivery history rendered | Pass |
| No automatic email send | Pass |
| No automatic link mint | Pass |
| Populated history — 4 attempts | Pass |
| Latest shown once | Pass |
| Earlier attempts newest-first | Pass |
| Hard reload preserved persisted history | Pass |
| 390px mobile layout | Pass — no horizontal overflow |
| Secret/field audit (history section scoped) | Pass |
| Copy/claim audit (history section scoped) | Pass |
| No defects found | Pass |
| No code changes during smoke | Pass |

**Not exercised in browser (non-blocking):**

- Empty-state fixture
- Failed-attempt fixture
- Post-send refetch with live send

Unit/source tests cover empty/failed/refetch behavior. Live send skipped because fixture recipient was a real address.

#### 20.9 Recommended next (Stage C approved — R18D3D blocked until Stage C4)

**Approved next:** **Slice 2 — Catalog P0** (§6BO.13). **Slice 1 complete** at **`36a0b55`**. **Stage C1 may proceed in parallel** with P0 UI slices (pure helpers/tests only) — **do not mix Stage C implementation into UI slices**.

**R18D3D remains blocked until at least Stage C4 is live and smoke-validated**, then explicitly approved — R18D3D touches proposal status, `proposal_events`, Jobs Board movement, and Job Card activity.

**R18D3E** webhook processing, **R18G** Sign, **R18H** PDF, **R18I** Payment, and **R18J** lifecycle audit remain future/downstream.

---

### 16. R18 post-D2 next-step guardrails (§6BN.16 — R18D3C complete; lifecycle still guarded)

| Rule | Detail |
|------|--------|
| Public route | **`/p/[token]` exists (read-only)** — do not add Send/PDF/Sign/Payment wiring without explicit approval |
| Review link vs Send | **R18C4C review links are not Send** — create/open/copy from Preview is QA/review only; does not email customer or mutate lifecycle/status |
| Customer send link vs email Send | **R18D2 customer-send prep is not email Send** — Prepare/open/copy prepares a session URL only; **does not email customer** or mutate lifecycle/status |
| R18D1 Send gate | **Readiness + email draft preview + Send enablement** when sent snapshot exists (§6BN.18) — Send sends email via Resend; **does not** mutate proposal/job lifecycle/status |
| R18D2 send-prep | **Complete** (§6BN.15) — freeze/reuse/refreeze + mint customer-send token + open/copy session URL |
| R18D3A delivery attempts | **Complete** (§6BN.17) — migration/store/view model/tests; migration `20260626_020` **live-applied + verified PASS** on `rhquhnujjnzjhweypavd` |
| R18D3B email send | **Complete + live-smoked** (§6BN.18) — POST `/api/proposals/send`; Resend + delivery attempts; Preview Send UI; **still no** lifecycle/status/job-board mutation |
| Send / email delivery | **R18D3B complete** — real email send orchestration live-smoked; **do not** expand to lifecycle/status/job-board without separate approval |
| PDF / Sign / Payment / lifecycle | **Remain disabled** |
| Status mutation | **Do not** mutate `proposals.status` from public route, review-link mint, send-prep, Send gate UI, or view recording |
| Sent immutability | **Do not** mutate sent proposal versions |
| Token mint vs Send | **R18D3B Send emails customer** when readiness + sent snapshot exist — **still not** lifecycle/status/job-board truth; review links and prep-only flows remain distinct |
| Next slice | **Slice 2 — Catalog P0** (§6BO.13); **Slice 1 complete** at **`36a0b55`**; then Slices 3–5; **Stage C1 may run in parallel** with P0 UI (pure helpers/tests) — do not mix Stage C into UI slices; Stage C policy approved (§6BO.11); **R18D3D blocked** until at least **Stage C4** + P0 trust fixes + explicit approval; **R18D3E later** Resend webhooks; **deferred:** public proposal + email brand polish (§6BN.19.7); **R18G later** signature; **R18H later** PDF; **R18I later** Payment/deposit |
| Public route composition | Implemented: `resolveProposalPublicAccessToken` → `getPublicProposalVersionGraph(..., { requireSentVersion: true })` → public DTO → document VM → (serve) → `recordProposalCustomerView` (server-only tracking) |
| Route token hashing | Hash **exact URL token segment** consistently with minted token behavior (`hashProposalPublicAccessToken`) |

**R18C public access now includes:**

- Token tables/activity
- Resolve/record RPCs
- Server token hash/resolve/record boundary
- Mint infrastructure
- Public access orchestrator/view model
- **`/p/[token]` public proposal route + customer shell**
- **Contractor Preview review-link bridge for QA/open/copy** (§6BN.12)

**R18D1 now includes:**

- **Contractor Preview Send gate readiness checklist + email draft preview** (§6BN.13) — **no delivery**

**R18D2 now includes:**

- **Contractor Preview customer send link prep** (§6BN.15) — **Prepare customer link** → freeze/reuse/refreeze → mint customer-send token → open/copy session URL; **distinct from R18C4C QA review link**; **no email delivery**

**Current R18D sequence:**

- **R18D1 complete:** Send gate readiness UI + email draft preview only, no delivery
- **R18D2 complete:** customer send-link prep — readiness → freeze/reuse/refreeze → mint customer-send token → open/copy session URL, no email delivery
- **R18D3A complete:** delivery-attempt foundation — migration/store/view model/tests; migration `20260626_020` **live-applied + verified PASS** on `rhquhnujjnzjhweypavd` (§6BN.17.7)
- **R18D3B complete + live-smoked:** real email send orchestration with Resend and delivery attempts (§6BN.18); **still no** status/events/job-board mutation unless separately approved
- **R18D3C complete:** contractor delivery status/history UI — presenter (§6BN.20.1 **`f0627e1`**), read API (§6BN.20.1 **`1811f7a`**), Preview UI (§6BN.20.1 **`e17eab5`**), browser smoke PASS (§6BN.20.8); **still no** lifecycle/status/job-board mutation
- **Next:** **Slice 2 — Catalog P0** (§6BO.13); **Slice 1 complete** at **`36a0b55`**; **Stage C1 may run in parallel** with P0 UI — do not mix Stage C into UI slices; Stage C policy approved (§6BO.11); **deferred customer-facing polish** (§6BN.19.7); **R18D3E later** Resend webhooks
- **Later:** R18D3D proposal status/events/job activity semantics; R18D3E Resend webhooks (`delivered`/`bounced`/`complained`)
- **R18G later:** Signature/acceptance
- **R18H later:** PDF
- **R18I later:** Payment/deposit

**Mandatory read:** **§6BN** + **§6BM** before R18D3D planning or polish work.

**Stale-section warning:** **Trust order:** Header/current checkpoint → **§6BO.13** (approved UI flow roadmap) → **§6BM** / **§6BN** (R18 roadmap) → **§6BO** / **§6BO.11** / **§6BO.12** (completed remediation + **approved Stage C policy** + **operating-flow audit complete — outcome §6BO.13**) → **§6BL** → **§11 override**. **Older sections may describe email delivery as future/unbuilt. After R18D3B, real email send orchestration exists and was live-smoked (§6BN.18); pass-3 email template polish is Gmail-approved (§6BN.19 — historical commit **`20a239d`**); **R18D3C delivery history UI is complete** (§6BN.20 — code **`e17eab5`**); lifecycle/status/job-board semantics remain unchanged until separately approved. After Stage B, new review/send links refresh identity/contact echo before freezing; **existing public links remain pinned until Stage C supersession is implemented** (§6BO.11 — approved direction). **Do not create a separate Command Center** — **§6BO.13** supersedes that direction; evolve Job Board as command surface.

---

## 6BO. PUBLIC PROPOSAL PACKET + PROPOSAL IDENTITY TRUTH PIPELINE (REMEDIATION SIDE-TRACK)

**Framing:** Stage A/B truth-pipeline work was a **necessary remediation side-track** discovered during public proposal / email send work. It **does not automatically redefine** the R18 roadmap. **Stage C token supersession / stale-link policy is now the approved architecture direction** (§6BO.11) — **not customer-facing polish**; it is the access-truth policy layer between R18 public/send infrastructure and future lifecycle/status/sign/payment work. Preview/Public WYSIWYG (Stage D) remains a valid future task but **not automatically next**.

**Status:** **Public proposal packet foundation complete** at **`4402821`**. **Public proposal packet presentation polish complete** at **`99de56b`**. **Stage A identity echo staleness detection complete** at **`d3e2d13`**. **Stage B restamp-before-freeze complete** at **`10a1971`**. **Stage B server-deps fix complete** at **`ee643d0`**. **Stage B end-to-end browser smoke PASS** (§6BO.7). **Old public links remain stale by design** until Stage C supersession policy is implemented (§6BO.11). **R18D3C delivery history UI complete** at **`e17eab5`** (§6BN.20). **Stage C policy direction approved** (§6BO.11). **Approved UI flow roadmap recorded** at **`fc86123`** (§6BO.13). **Slice 1 Jobs command surface P0 complete** at **`36a0b55`**. **Catalog naming correction** pending this commit. **Docs checkpoint:** **pending this commit** (prior docs: **`fc86123`**).

### 0. R18 roadmap position (recovery)

**Known R18 roadmap order from the original plan** (§6BM §11; letter phases — see §6BN for granular substages such as R18C4, R18D1–R18D3B):

| Phase | Original plan deliverable |
|-------|---------------------------|
| **R18A** | Architecture plan |
| **R18B** | Sent / frozen snapshot foundation |
| **R18C** | Public token / public read route |
| **R18D** | Customer-facing public proposal / review-link flow |
| **R18E** | Contractor Preview-and-Send / readiness gate |
| **R18F** | Email delivery |
| **R18G** | Sign / acceptance |
| **R18H** | PDF from frozen snapshot |
| **R18I** | Payment / deposit (invoice-linked) |
| **R18J** | Full lifecycle audit |

**Current actual progress (reconciled):**

| Area | Status |
|------|--------|
| **R18B** | **Complete** — send-freeze foundation + R18B4D smoke PASS (§6BM.13) |
| **R18C** | **Complete** — public access token tables, resolve/record/mint RPCs, orchestrator, `/p/[token]` read route (§6BN.7–§6BN.11) |
| **R18D** | **Progressed** — review-link bridge (R18C4C), public packet foundation/polish (`4402821`, `99de56b`), customer public shell |
| **R18E / R18F (adjacent)** | **Complete / live-smoked** — Send gate readiness (R18D1), send-prep (R18D2), delivery attempts (R18D3A), email orchestration + template polish (R18D3B / §6BN.18–§6BN.19) — **still no lifecycle/status/job-board mutation** |
| **Truth-pipeline remediation** | **Complete + smoke-proven** — Stage A (`d3e2d13`), Stage B (`10a1971`, `ee643d0`), §6BO.7 PASS |
| **R18G / R18H / R18I / R18J** | **Disabled / unbuilt** — Sign, PDF, Payment, full lifecycle audit |
| **R18D3C+ (§6BN substages)** | **R18D3C complete** — delivery history presenter (`f0627e1`), read API (`1811f7a`), Preview UI (`e17eab5`), browser smoke PASS (§6BN.20); **Stage C policy approved** (§6BO.11); **R18D3D blocked** until at least Stage C4 live + smoke-validated, then explicitly approved |

**Implementation note:** Actual build order diverged from strict letter-phase sequencing (e.g. R18D1–R18D3B delivered before all R18D public UI polish). Use **§6BN substage history** for code truth; use **letter phases above** for forward roadmap recovery.

### 1. Current checkpoint

| Item | Value |
|------|-------|
| **Latest code checkpoint** | **`36a0b55` — feat(roofing): add Jobs command surface P0** |
| **Latest docs checkpoint** | **pending this commit** |
| **Prior docs checkpoint** | **`fc86123` — docs: record approved page-by-page UI flow roadmap and P0 slices** |
| **Working tree before docs** | **clean** |
| **Next** | **Slice 2 — Catalog P0** (§6BO.13) after this docs correction. **Slice 1 complete** at **`36a0b55`**. **Stage C1 may run in parallel** with P0 UI slices — do not mix Stage C into UI slices. **R18D3D remains blocked** until at least **Stage C4** + P0 trust fixes + explicit approval |

**Local-only QA env (not committed):**

- Stage B browser smoke required **`USE_PROPOSAL_SEND_FREEZE_RPC=1`** in **`.env.local`**
- This flag is **local-only**, **gitignored**, and **not committed**

### 2. Public proposal packet checkpoint (`4402821`, `99de56b`)

**Foundation (`4402821`):** Shared public proposal packet architecture — `proposalCustomerPacketViewModel` + presenter + public adapter; wired public route `/p/[token]`; removed old public UI.

**Presentation polish (`99de56b`):** Public proposal packet presentation was polished and committed at **`99de56b`**. Introduced/refined customer-facing proposal packet components under **`app/components/proposal-packet`**.

**Public proposal customer shell now includes:**

- Proposal packet top / hero / trust / package / add-ons / total / details / contact / footer presentation
- **No** hero price/package card
- **No** standalone “Included in this estimate” section
- **No** “Recommended” language; current package uses **Current**-style language
- Save PDF / Share shown as **non-functional coming-soon UI only**
- **No** sign / payment / PDF / share enablement
- Package cards, optional add-ons, current proposal total, details/contact closeout
- Contractor contact separated from customer **Prepared for** contact

**Contact behavior:**

- Contractor contact card reads **frozen** company/contact fields from sent snapshot
- Customer email/phone stay in **Prepared for** only
- Phone/website display **only when present** in the frozen snapshot
- **No fake contact data**

### 3. Proposal truth/display audit finding

Audit found the main issue was **not one UI section**; it was the **proposal truth pipeline**.

**Current truth chain:**

```text
Settings / Job / Customer DB
→ stamped into draft proposal_versions.context_echo
→ copied into sent/frozen proposal snapshot
→ pinned by public token/email link
```

**Before Stage A/B:**

- Settings-only changes did **not** automatically update draft `context_echo`
- Freeze copied **stale** draft echo
- Existing public links stayed stale because tokens pin `proposal_version_id`
- Builder / Preview / Public / Email can display different info depending on when each was stamped / frozen / minted
- Preview / Public are **not WYSIWYG yet**

### 4. Stage A — identity echo staleness detection (`d3e2d13`)

**Stage A committed at `d3e2d13`.** Added pure identity/contact echo staleness detection.

**Files:**

- `app/lib/proposalIdentityEcho.ts`
- `app/lib/proposalIdentityEcho.test.ts`
- Integration assertion in `app/lib/proposalDocumentContext.test.ts`

**Identity allowlist (15 keys):**

- `company_name`, `company_logo_url`, `company_phone`, `company_email`, `company_website`, `company_address`
- `customer_name`, `customer_email`, `customer_phone`, `customer_address`
- `address_formatted`, `job_name`, `template_name`
- `proposal_number`, `proposal_title`

**Rules:**

- Pure module only
- **No** DB / Supabase / store / React
- **No** restamp/write behavior
- **No** freeze / send / token behavior
- **No** pricing / status / payment / sign fields

**Stage A tests at commit:**

| Suite | Result |
|-------|--------|
| `npx tsx --test app/lib/proposalIdentityEcho.test.ts` | **19/19 PASS** |
| `npx tsx --test app/lib/proposal*.test.ts` | **976/976 PASS** |

### 5. Stage B — restamp-before-freeze (`10a1971`)

**Stage B committed at `10a1971`.** Added identity/contact/project restamp-before-freeze.

**Behavior:**

- Builds live proposal identity echo from existing company/customer/job/proposal loaders
- Compares draft `context_echo` to live identity using Stage A diff
- If stale, `restampDraftProposalIdentityEcho` merges **only identity allowlist keys** into draft `context_echo`
- Touches `proposals.updated_at` so existing refreeze logic sees the draft as newer
- Then `resolveProposalSendSnapshotVersion` continues existing freeze/refreeze logic
- Success result can include `identityRestamped` and `identityChangedFields`

**Restamp preserves:**

- `measurement_quantities_display`
- `measurement_record_id`
- Pricing-related keys
- Structural IDs like `job_id` / `customer_id` / `template_id`
- Custom/unlisted `context_echo` keys
- Pages / options / lines / selection / pricing graph rows
- Proposal status / events / jobs / activity

**Stage B did not:**

- Implement token supersession
- Implement Preview/Public WYSIWYG
- Change email send behavior
- Change pricing math
- Enable PDF / share / sign / payment
- Run SQL/migrations

### 6. Stage B server-deps fix (`ee643d0`)

Stage B browser smoke initially hit **500** on:

- POST `/api/proposals/public-review-link`
- POST `/api/proposals/send-prep`

**Root cause:** `restampDraftProposalIdentityEcho` called the nested live identity loader **without passing injected server deps**, causing a server fallback to `getSupabaseClient()` (null on server) → `ProposalRecordStoreError` → route **500**.

**Fix at `ee643d0`:**

- Restored injectable server-deps flow
- Nested identity/branding/measurement reads now inherit the server Supabase client from `buildProposalSendSnapshotServerDeps(supabase)`
- With freeze RPC disabled locally, routes now return guarded **400 `freeze_unavailable`** instead of **500**

**Files included:**

- `app/lib/companyBrandingProfileStore.ts`
- `app/lib/measurementStore.ts`
- `app/lib/proposalEmailDelivery.server.ts`
- `app/lib/proposalPublicReviewLink.server.ts`
- `app/lib/proposalRecordStore.ts`
- `app/lib/proposalSendPrep.server.ts`
- Related tests in `app/lib/proposalRecordStore.test.ts`

### 7. Stage B end-to-end browser smoke (PASS)

Full Stage B smoke **passed** after enabling local **`USE_PROPOSAL_SEND_FREEZE_RPC=1`**.

**Fixture:**

| Item | Value |
|------|-------|
| Proposal ID | `368dcbf1-4020-44e8-9f60-b25de4525cd9` |
| Job ID | `9cd2c4ac-3e46-4ba9-be58-8558fcd1ba73` |
| Preview URL | `/tools/roofing/proposals/preview?job=9cd2c4ac-3e46-4ba9-be58-8558fcd1ba73&proposal=368dcbf1-4020-44e8-9f60-b25de4525cd9` |

**Baseline settings:**

- Business email: `AndersonRoofingLOL@gmail.com`
- Phone: `555-123-4567`
- Website: `https://www.mikejonesroofing.com`
- Address: `4545 Mike Jones St. Tulsa, OK 74110`

**QA change flow:**

1. Changed business email to **`qa-stageb-restamp@example.com`** in Settings UI
2. Created review link from Preview → **POST `/api/proposals/public-review-link` → 200 OK**
3. New public link: **`http://localhost:3000/p/Gh4590gdSqnD3Az5AFE4gvs5PkLSJK6HPX1Sjj58InQ`**
4. New public **Contact information** showed:
   - Email: **`qa-stageb-restamp@example.com`**
   - Phone: **`555-123-4567`**
   - Website: **`www.mikejonesroofing.com`**
   - Address: **`4545 Mike Jones St. Tulsa, OK 74110`**
5. Identity restamp inferred **`true`** (`company_email` changed; address also refreshed vs older frozen links)

**Old links stayed stale by design:**

| Link | Stale contact |
|------|---------------|
| `/p/2tFXtUcLCW3pJp5vVtuEpMnLvq_oULv_fWJAYUGUk0c` | Address-only (`123 Main St…`); **no email** |
| `/p/3ra4RlXCaAC8zoU8GFm08PdpyIFpu-1IH6LPbNtFzUc` | Prior email `AndersonRoofingLOL@gmail.com` + old address |

**Restore flow:**

1. Restored business email to **`AndersonRoofingLOL@gmail.com`**
2. Created restored review link: **`http://localhost:3000/p/S7PZfBZYs5xKXMxj2P2dpPBNu_NmiPOozIVRc3sfeCo`**
3. Restored public contact showed **`AndersonRoofingLOL@gmail.com`**
4. QA link remained pinned to **`qa-stageb-restamp@example.com`** — **expected in Stage B**

**Smoke guardrails observed:**

- **No** email sent
- **No** SQL
- Review links minted **only** through normal Preview UI path
- **No** status / events / jobs / activity mutation observed
- **No** PDF / share / sign / payment enabled
- **No** token supersession
- **No** Preview/Public WYSIWYG changes

**Final Stage B smoke tests:**

| Suite | Result |
|-------|--------|
| `npx tsx --test app/lib/proposalIdentityEcho.test.ts` | **21/21 PASS** |
| `npx tsx --test app/lib/proposal*.test.ts` | **984/984 PASS** |
| `tsc --noEmit` | **No errors** in Stage B/server-deps files; known unrelated project errors remain |

### 8. Proposal identity/contact truth rules after Stage B

| Rule | Detail |
|------|--------|
| New sends / review links | Refresh identity/contact/project echo **before freezing** |
| Public / email customer-facing outputs | Still read **frozen** data, not live settings |
| Existing public links | Remain pinned to original `proposal_version_id` |
| Stage C | **Approved architecture direction** (§6BO.11) — access-truth policy layer; **required before tracking/lifecycle/status/sign/payment depend on public link state**; **R18D3D blocked until at least Stage C4** |
| Preview / Public WYSIWYG (Stage D, future) | **Not implemented yet** — valid future task; **not automatically next** |
| Email | Remains notification-style; does **not** share full public packet presentation yet |
| Contact separation | Customer contact and contractor contact **must stay separate** |

### 9. Future candidates (Stage C approved — R18D3D blocked until Stage C4)

**Do not proceed** to R18D3D lifecycle/status/job-board implementation until **Stage C4 (email-send supersession)** is live, smoke-validated, and explicitly approved (§6BO.11).

1. **Stage C — token supersession / stale-link policy** — **approved direction** (§6BO.11); **Stage C1 may run in parallel** with P0 UI slices (pure helpers/tests) — **do not mix Stage C implementation into UI slices**; category-isolated supersession; stale-link UX without redirect or token leak
2. **R18D3D — lifecycle/status/job activity** — **blocked until at least Stage C4 + explicit approval** (§6BN.20.9, §6BO.11)
3. **Stage D — Preview/Public WYSIWYG packet unification** — `buildCustomerPacketFromPreviewGraph`; contractor Preview renders same ProposalPacket as public route
4. **Stage E — Email/public packet alignment** — later; notification-only vs minimal packet summary
5. **Smaller follow-up** — public headline/footer alignment using stamped `proposal_number` / `proposal_title`
6. **R18D3E — Resend webhook processing** — `delivered` / `bounced` / `complained` status updates

**Mandatory read:** **§6BM** / **§6BN** for R18 roadmap context; **§6BO.11** for approved Stage C policy; **§6BN.20** for R18D3C completion.

### 10. Required next Cursor task

**Slice 2 — Catalog P0** (§6BO.13) — after this docs correction is reviewed/committed:

- Keep **Catalog** as page/nav name; plain-English hero; setup/readiness checklist; grouped views; unpriced filter; contractor-understood table/drawer labels; labor × measurement explainer; customer description/visibility; measurement mapping; next step to Proposal templates
- **Slice 1 complete** at **`36a0b55`** — see §6BO.13.5
- **Stage C1 may proceed in parallel** with P0 UI slices (pure token classification + supersession decision helpers and tests only) — **do not mix Stage C implementation into UI slices**
- **Do not implement R18D3D** until at least **Stage C4** + P0 trust fixes + explicit approval — R18D3D touches proposal status, `proposal_events`, Jobs Board movement, and Job Card activity
- **Do not enable** lifecycle/status/job-board/sign/PDF/payment, public route behavior changes, SQL, or webhooks in P0 UI slices (§6BO.13.7 guardrails)
- **R18D3E** webhooks, **R18G** Sign, **R18H** PDF, **R18I** Payment, **R18J** lifecycle audit remain downstream

### 11. Stage C whole-app impact review and token supersession policy — APPROVED DIRECTION

**§6BO.11 — Stage C whole-app impact review and token supersession policy — APPROVED DIRECTION**

Stage C is **not customer-facing polish**. It is the **access-truth policy layer** between R18 public/send infrastructure and future lifecycle/status/sign/payment work.

**Stage C protects:**

- proposal lifecycle
- `proposal_versions`
- `proposal_public_access_tokens`
- `proposal_delivery_attempts`
- `proposal_customer_activity`
- future `proposal_events`
- Jobs Board movement
- Job Card activity
- proposal revisions/resends
- signing/acceptance
- PDF generation
- payment
- lifecycle audit
- future R19+ approval/sign bridge

#### 11.1 Whole-app truth model (four layers)

Stage C must align four truth layers:

1. **Version truth** — `proposal_versions` and `latest_sent_version_id`
2. **Access truth** — `proposal_public_access_tokens`
3. **Delivery truth** — `proposal_delivery_attempts`
4. **Lifecycle truth** — future `proposals.status`, `proposal_events`, Jobs Board, Job Card activity

**Stage C fixes access truth and defines how access truth relates to delivery truth and future lifecycle truth. Stage C does not implement lifecycle truth.**

#### 11.2 Token category policy

| Category | Role |
|----------|------|
| `contractor_review_qa` | Contractor review/pre-send access |
| `contractor_send_prep` | Manual/prep access |
| `contractor_email_send` | Customer delivery artifact tied to `proposal_delivery_attempts` |
| `customer_sign_accept` (future) | Sign/acceptance |
| `customer_payment` (future) | Payment |
| `customer_pdf_share` (future) | PDF share |

**Review/QA links:**

- contractor review/pre-send access
- may supersede prior review/QA links **only**
- must **never** drive sent/viewed lifecycle, Jobs Board movement, or Job Card activity

**Send-prep links:**

- manual/prep access
- may supersede prior send-prep links **only**
- must **not** drive lifecycle

**Email-send links:**

- customer delivery artifact tied to `proposal_delivery_attempts`
- **canonical customer-facing proposal link** for lifecycle
- newer email-send token supersedes prior **active email-send tokens** for same proposal
- preserves old token rows, delivery attempts, and `proposal_versions`

**Future sign/payment tokens:**

- protected from automatic email/review supersession
- must bind to authoritative immutable version

**Current classification gap:** today mint paths distinguish categories via `metadata_json.source` only (`contractor_preview_qa`, `contractor_send_prep`, `contractor_email_send`). Stage C implementation needs durable `token_category` classification — do not rely on `metadata_json.source` long-term (§6BO.11.7).

#### 11.3 Canonical link / version policy

**Canonical current customer-facing proposal link:**

The most recent **active email-send token** for a proposal, tied to a **provider-accepted delivery attempt** and the sent `proposal_version_id` minted for that send generation.

**Canonical lifecycle identity is composite:**

- `proposal_id`
- `proposal_version_id`
- `public_access_token_id`
- `delivery_attempt_id`

**No single column alone is enough.**

#### 11.4 Supersession policy

Supersession operates on **tokens**, not `proposal_versions`.

**When a new review/QA token is minted:**

- supersede prior **active review/QA tokens** for the same proposal only

**When a new send-prep token is minted:**

- supersede prior **active send-prep tokens** for the same proposal only

**When a new email-send token is minted:**

- supersede prior **active email-send tokens** for the same proposal only

**Never automatically supersede:**

- email-send tokens from review/QA mint
- review/QA tokens from email-send mint
- future sign/accept/payment tokens

**Preservation rules:**

- Superseded tokens remain stored and auditable
- `proposal_versions` remain immutable
- `proposal_delivery_attempts` remain preserved
- **No rows are deleted**

#### 11.5 Public stale-link UX policy

**Superseded links:**

- show friendly **“Proposal link replaced”** page
- show **no** proposal content
- do **not** redirect to newest token
- do **not** leak newer token

**Expired/revoked links:**

- show existing error UX
- show **no** proposal content

**Active links:**

- show frozen proposal snapshot

#### 11.6 Lifecycle implications (declarative for R18D3D)

**R18D3D remains blocked until Stage C minimum implementation is approved and completed** (at least **Stage C4** live + smoke-validated).

**Future lifecycle rules:**

- sent status/events may only use **canonical email-send token + proposal_version + delivery_attempt**
- viewed lifecycle may only count **first view on canonical active email-send token**
- review/QA views may remain low-level `proposal_customer_activity` only
- send-prep views may remain low-level `proposal_customer_activity` only
- superseded/expired/revoked token views must **not** promote lifecycle
- Jobs Board movement and Job Card activity must **not** be driven by review/QA or stale links

#### 11.7 Schema / RPC assessment (no SQL in this docs task)

**Existing schema already has:**

- `status` = `active` | `revoked` | `superseded`
- `superseded_by_token_id`
- `expires_at`
- `proposal_version_id` binding
- `token_prefix`
- `metadata_json`
- delivery attempt ↔ token FK for email-send attempts

**Likely Stage C implementation needs:**

- durable `token_category` classification
- avoid relying only on `metadata_json.source` long-term
- transactional supersede + mint RPC or equivalent
- possible migration/check/trigger/index changes
- Supabase manual apply/verification if SQL is introduced

#### 11.8 Proposed implementation stages

| Stage | Scope |
|-------|-------|
| **C1** | Pure token classification + supersession decision helpers and tests |
| **C2** | Review/QA supersession on mint |
| **C3** | Send-prep supersession |
| **C4** | Email-send supersession on send; **critical path before R18D3D** |
| **C5** | Public resolve UX verification for superseded/expired/revoked |
| **C6** | Optional contractor Preview link-state display |
| **C7** | Browser smoke/audit |

**R18D3D remains blocked until at least Stage C4 is live and smoke-validated, then explicitly approved.**

#### 11.9 Stage C guardrails (must not)

Stage C must **not**:

- write `proposals.status`
- write `proposal_events`
- move Jobs Board cards
- write Job Card activity
- implement lifecycle automation
- redirect old public links to new tokens
- delete token rows
- mutate old `proposal_versions`
- change pricing
- enable Sign
- enable PDF
- enable Payment
- enable webhooks

### 12. Roofr + contractor operating-flow audit — sequencing decision

**§6BO.12 — New product sequencing decision**

Before Stage C1 implementation, run a **Roofr + contractor operating-flow audit**.

**Reason:**

Stage C protects future lifecycle truth, but **contractor workflow clarity is a product-level prerequisite** before deeper token/lifecycle work. The audit must evaluate whether Catalog, labor/crew cost modeling, template selection, profit visibility, Builder guidance, Preview confidence, and Send readiness are understandable from a contractor's point of view.

**Audit scope:**

- Catalog / Price Book setup
- labor and crew-cost modeling
- template selection visibility
- Builder guidance
- contractor-only profit visibility
- customer-facing Preview confidence
- Send readiness
- whether any flow fixes should happen before Stage C implementation or R18D3D lifecycle work

**Sequencing:**

- **Immediate next:** Roofr + contractor operating-flow audit (no-code / audit-only unless explicitly scoped)
- **Paused until audit confirms sequencing:** Stage C1 implementation planning — pure token classification and supersession decision helpers
- **Still blocked:** R18D3D until at least Stage C4 live + smoke-validated + explicit approval (§6BO.11)

**Audit outcome (2026-06-27):** Operating-flow audit **complete**. Final Page-by-Page UI Flow Map **approved** as implementation reference — recorded in **§6BO.13**. **§6BO.13 supersedes** this section for next-implementation direction.

---

**§6BO.13 — Approved page-by-page UI flow roadmap — APPROVED IMPLEMENTATION REFERENCE**

**Status:** **APPROVED** (2026-06-27). This section is the **implementation reference** for P0 contractor UI work.

**Supersedes:** Any earlier **separate Command Center** language in `docs/fielddive-flow-map.md`, New User Flow / UI Map blueprints, P0 Contractor UI Direction drafts, or stale §8 Dashboard-first direction. **§6BO.13 is current truth** for contractor operating-flow UI. **Do not create a separate Command Center page.** **Evolve the existing Job Board** (`/tools/roofing/saved`) into the daily command surface.

#### 13.1 Approved architecture

| Surface | Role |
|---------|------|
| **Jobs / Job Board** | Daily command surface and pipeline — default roofing workspace home after setup |
| **Setup Hub** | Company setup only — not job execution |
| **Job Card** | Deep detail for one customer/job |
| **Proposal Studio** | Contextual inside a job/proposal: **Build → Customer view → Send** — not standalone sidebar routes |
| **Advanced** | Legacy Price Book, Instant Estimate, legacy/future/admin paths — off the happy path |

**Approved UI naming:**

| Internal / legacy | Approved UI label |
|-------------------|-------------------|
| Catalog | **Catalog** (keep page/nav name — **do not rename to Price book**) |
| Pricing policy | **Pricing rules** |
| Customer Preview / Contractor Preview | **Customer view** |
| Options | **Packages** |
| Snapshot/freeze jargon (contractor UI) | **Locked customer version** |
| Public URL (contractor UI) | **Customer link** |
| QA review URL (contractor UI) | **Team review link** |

**Approved Catalog naming decision (2026-06-25 — before Slice 2):** **Keep Catalog as the page name.** Roofr uses “Catalog,” and FieldDive should keep **Catalog** as the contractor-facing page/nav label. The problem is **not** the word Catalog — the problem is that the current Catalog page is bulky, hard to read, and not plain-English enough. **Redesign Catalog** into a guided setup surface for materials, labor, costs, customer prices, descriptions, visibility, and measurement mapping. **“Price book”** may appear only as helper language when explaining pricing inside Catalog — **not** as the primary page/nav label.

**Surface distinctions (contractor setup vs job work):**

| Surface | Owns |
|---------|------|
| **Catalog** | What the contractor sells/installs, what it costs, what the customer pays, and how quantities are measured |
| **Pricing rules** | How FieldDive calculates margin, markup, profit targets, and taxes |
| **Proposal templates** | How proposal content/packages are structured and shown to the customer |
| **Builder / Contractor estimate workbench** | Job-specific proposal economics before send |
| **Job Costing** | **Future Job Card deep-detail module** for actual production/job profitability — **not** part of Catalog, **not** on Job Board card face, **not** Slice 2 |

**Profit placement policy:** Margin/markup + guardrails live in **Pricing rules**. Item cost/sell live in **Catalog**. Job cost, profit, and margin live in **Contractor estimate workbench** (contractor-only). **Job Costing** (actual production profitability) is a **future Job Card module** — not Catalog, not Job Board cards. **Customer view** and **public `/p/[token]`** never show cost/profit. **P0 trust rule:** if Pricing rules are unsaved, **block profit dollars/margin or show hard block state** — **never silent placeholder profit**.

#### 13.2 Approved first-login-to-send journey

```text
First login / Jobs Board
→ setup banner if setup incomplete
→ Setup Hub
→ Company profile / branding
→ Pricing rules
→ Catalog + labor lines
→ Proposal templates
→ Jobs Board daily work
→ New job / Job Card
→ Measurements
→ Job Card Proposals tab
→ Create proposal
→ Build proposal
→ Contractor estimate workbench
→ Customer view
→ Send panel
→ Email delivery history
→ honest post-send state before lifecycle exists
```

#### 13.3 Approved page/surface decisions

**Jobs / Job Board** (`/tools/roofing/saved`)

- Nav label: **Jobs** · Page title: **Job Board**
- Default roofing workspace home
- Setup-incomplete banner when company setup incomplete
- Pipeline command surface (kanban + Roofr-style category bands)
- Legacy saved-estimates section **de-emphasized** at bottom
- **No fake lifecycle movement** on email send until R18D3D

**Setup incomplete banner** (component on Job Board)

- Shows setup progress (e.g. **2 of 4 complete**)
- Primary CTA: **Continue setup** → Setup Hub
- Chips: Company profile · Pricing rules · **Catalog** · Proposal templates

**Setup Hub** (proposed route: `/tools/roofing/setup`)

- Separate lightweight route — **not** a drawer
- Company setup only — four status cards with progress
- Cards: **Company profile** · **Pricing rules** · **Catalog** · **Proposal templates**
- Per-job setup (measurement) stays on Job Card

**Setup nav** (sidebar — Slice 1 live at `36a0b55`)

- **Company profile**
- **Pricing rules**
- **Catalog** (route `/tools/roofing/catalog` — **not** “Price book” as page/nav label)
- **Proposal templates**

**Company profile / branding** (`/tools/settings`)

- Company identity for proposal cover and customer emails
- Setup nav entry + return link to Setup Hub / Job Board

**Pricing rules** (`/tools/settings/pricing`)

- Visible under **Setup** nav
- Margin/markup, default profit %, minimum profit %, taxes
- Cross-link to Catalog
- If unsaved: **block profit dollars/margin or hard block state** — never silent placeholder profit

**Catalog** (`/tools/roofing/catalog`)

- **Keep Catalog** as page/nav name — **do not rename to Price book**
- **P0B:** Roofr-like **table-first** structure (title → All items / Settings → toolbar → table) — not a guided setup wizard
- **P0C:** Roofr **command-surface visual polish** — wider workspace, denser command bar, unified table card, Proposal/Status pills, spaced row actions, Settings future-tools shell
- **P0A–P0D (chrome foundation):** P0A = Catalog naming/route/shell under FieldDive Setup nav (keep **Catalog**, not Price book). **P0B** = table-first structure. **P0C** = command-surface polish. **P0D** = continuous ungrouped All items; disabled/reserved selection checkbox; command bar = Search · Filters & sort · Re-order / Columns / Manage (Coming soon) · Add; no MATERIALS/LABOR/FEES group divider rows
- First viewport: **Catalog title → All items / Settings tabs → command bar → continuous table**
- No dominant starter hero, readiness stat cards, or right-side setup checklist when items exist
- Settings tab = Pricing rules + Proposal templates (active) + **planned** future tools (disabled / Coming soon — no fake forms)
- Command bar planned controls: **Re-order items**, **Columns**, **Manage catalog** (Coming soon — not active)
- Columns (supported): reserved selection · Name · Type · Measurement · Unit · Unit cost · Unit price · Proposal · Status · Actions
- **Coverage/Waste (Phase 7 + P1):** editable on item add/edit; compact Name secondary line when set; **not** table columns; strict numeric validation; compatibility classifier is `not_verified` until `coverage_basis` exists
- Explain labor as rate per unit × job measurement (helper in edit panel)
- Empty catalog: compact install starter empty state inside table area (**not** shown after a failed catalog read)
- **Not** a job-profit dashboard; **not** Job Costing (future Job Card module)
- Deferred Roofr-parity features: see **§6BO.13.4** (no fake tax columns / bulk **behavior**; disabled selection + toolbar placeholders are layout-only; Coverage/Waste **item fields** are live — company mode switch remains planned)

**Labor** (Phase 1 — within Catalog)

- Labor = **Labor-type catalog lines** × measurement quantities
- Explainer: unit rate × measurement quantity (e.g. install labor $/square × squares)
- **No fake crew-size / hourly burden math** until implemented in schema

**Proposal templates** (`/tools/roofing/templates`)

- Reusable proposal structure, packages, customer display settings
- Fix stale copy (“proposals open in later stages” → used when creating a proposal on a job)
- Connect to Setup Hub and Job Card Proposals checklist

**New job / Job Card**

- New job via Job Packet intake → Job Card
- **Job Card tabs (P1):** show **Overview**, **Measurements**, **Proposals**, **Attachments**; move shell tabs under **More / coming later**
- **Proposals tab** checklist labels align with Setup: **Catalog**, **Pricing rules**, **Templates**

**Proposal Builder** (`/tools/roofing/proposals/builder`)

- **Build** step in Proposal Studio
- Primary CTA: **Preview customer view**
- Contractor-only workbench on Estimate page
- Hide/de-emphasize disabled Send/Sign/Payment clutter — one line: send from Customer view after review
- Contextual strip (P1): **Build → Customer view → Send**

**Contractor estimate workbench** (Builder — Estimate page zone)

- Kicker: **Contractor estimate workbench — Not shown to customer**
- Shows cost, customer total, gross profit, margin/markup **only when Pricing rules saved**
- If Pricing rules not saved: **Save Pricing rules to see profit**

**Customer view** (`/tools/roofing/proposals/preview`)

- Rename from Customer Preview / Contractor Preview
- Banner: **Customer view — profit and costs are hidden.**
- Customer-safe document (matches public `/p/[token]`) + contractor-only side panel

**Send panel** (on Customer view)

- Labels: **Email proposal to customer**, **Copy customer link**, **Team review link** (collapsed under Advanced actions with **Internal only** warning)
- **Locked customer version** instead of snapshot/freeze jargon
- Honest post-send copy: email sent; **pipeline stage unchanged until status tracking is enabled**
- Sign/PDF/Payment: single **Coming later** row

**Email delivery history** (Customer view panel)

- Remains on Customer view for now (R18D3C complete at `e17eab5`)
- Later mirror on Job Card Proposals tab (P2)

**Post-send state** (before R18D3D lifecycle)

- Success: provider accepted + delivery history row
- Job Board card: informational **Email sent** badge — **no column move** until R18D3D
- Copy: proposal email sent; job still in current stage until pipeline updates enabled

**Advanced** (nav group)

- Legacy Price Book (`/admin/price-book`), Instant Estimate, legacy customers, AI conductor
- Collapsed by default; warning on legacy price book: replaced by **Catalog**

**Future lifecycle / status** (R18D3D — blocked)

- Job Board column moves, proposal status timeline, Job Card activity — **blocked until Stage C4 + P0 trust fixes + explicit approval**

#### 13.4 Approved priority list (P0 / P1 / P2 / P3)

**P0 — blocks contractor understanding/trust**

- Job Board as default home + setup incomplete banner
- **Catalog P0** — Roofr-like table-first Catalog (keep Catalog name; **not** rename to Price book; **not** setup-wizard layout)
- Pricing rules in Setup nav + no silent placeholder profit
- Customer view rename + profit-hidden banner
- Send panel labels + honest post-send copy
- Demote Legacy Price Book + Instant Estimate to Advanced
- Job Card Proposals checklist label alignment
- Builder primary CTA: **Preview customer view**; remove Send clutter message

**P1 — should fix soon before deeper lifecycle work**

- Setup Hub minimal page
- Proposal strip: Build → Customer view → Send
- Template + package badges
- Customer-will-see summary on Customer view
- Catalog labor explainer polish (P0B already has one-line labor helper)
- **Catalog Settings — real content** (beyond Pricing rules / Templates links + P0D planned-tools list)
- Job Card tab reduction
- Informational **Email sent** badge on board card — no column move
- Delivery history highlight after send
- Company profile Setup integration

**P2 — planned later**

- Delivery history on Job Card Proposals
- Workbench labor summary card
- Template-level profit minimums
- Bulk Catalog import / **Download CSV export** (toolbar **Manage catalog** is layout placeholder only in P0D)
- Catalog **Re-order items** (drag/`sort_order` UX — toolbar control disabled in P0D)
- Catalog **Columns / display customization** (toolbar control disabled in P0D)
- Catalog **Mark as Material / type bulk actions** (after selection model)
- Catalog **bulk deactivate** policy (after selection model + confirm UX)
- Lifecycle placeholder → real R18D3D
- Tags/tasks/assignees on board

**P2 / Blocked until architecture — Catalog Roofr parity (do not fake active behavior in P0)**

| Feature | Why deferred | Needed before implement | P0D UI note |
|---------|--------------|-------------------------|-------------|
| Row selection + real bulk action bar | No safe bulk actions yet | Selection model + real actions | **Disabled checkbox column reserved** (no selection state / bulk bar) |
| Manage catalog CSV import/export | No bulk CSV pipeline | Import/export architecture + confirm UX | Disabled command-bar + Settings planned row |
| Columns / display controls | No column prefs model | Display prefs store | Disabled command-bar + Settings planned row |
| Re-order items | No drag/`sort_order` UX yet | Sort UX + persist | Disabled command-bar + Settings planned row |
| Add to template from Catalog | Store API needs template/option/section/role | Catalog→template picker UX | Not shown |
| Mark as Material / type bulk actions | Needs selection model | Bulk type update API | Not shown |
| Bulk deactivate / hard Delete | No safe bulk/delete policy; template refs | Referential delete + confirm | Not shown |
| Manage sales tax / purchase tax (Catalog) | Tax is company Pricing Rules | Do not duplicate on Catalog; catalog-level tax only if architecture approved | Settings planned under coverage/waste/tax |
| Manage waste factor / Waste % column | Only `waste_applies` bool; engine must not re-apply under `adjusted_measurement` | Schema % + quantity/pricing engine path | Settings planned; **no** Waste % column |
| Coverage column | `coverage_rate` unused by engines | Quantity/pricing engine support | Settings planned; **no** Coverage column |
| Sales tax % / purchase tax % columns | No per-item tax fields | Catalog-level tax architecture (if ever approved) | **No** tax columns |
| Supplier / ABC / QXO | Unsupported | Integration architecture | Settings planned row |
| Real Catalog Settings content | Beyond links + planned list | Product-approved settings model | P0C/P0D shell only |

##### 13.4.1 Roofr Catalog systems research lock (P0D boundary)

**Research status:** Public Roofr Help Center, Roofr Academy, and Roofr Masterclass references confirm the behaviors below at a product level. Exact UI chrome or calculation ordering that is not publicly specified remains **unconfirmed** and must not be guessed in implementation.

**Public references reviewed:**

- Roofr Help — [How to create a Roofr Catalog](https://roofrhelp.zendesk.com/hc/en-us/articles/33257762983831-How-to-create-a-Roofr-Catalog)
- Roofr Help — [How to format your CSV for catalog upload](https://roofrhelp.zendesk.com/hc/en-us/articles/33478981922327-How-to-format-your-CSV-for-catalog-upload)
- Roofr Help — [How to manage material purchase tax](https://roofrhelp.zendesk.com/hc/en-us/articles/33331344381335-How-to-manage-material-purchase-tax)
- Roofr Help — [How to connect Catalog items to ABC Pricing](https://roofrhelp.zendesk.com/hc/en-us/articles/31668956942999-How-to-Connect-your-Roofr-Catalog-items-to-ABC-Pricing)
- Roofr Academy — [Building Your Catalog](https://academy.roofr.com/lesson-videos/catalog-building)
- Roofr Masterclass — [Building Your Catalog: A Step by Step with Nic and Pete](https://roofr.com/masterclass/building-your-catalog)

| System | Roofr public behavior | FieldDive current state | Truth classification / why not live now |
|--------|-----------------------|-------------------------|-----------------------------------------|
| **Coverage** | Per-item coverage states how much area or length one purchased unit covers; editable with measurement/unit; present in CSV and imported roofing systems; feeds proposal/material quantity workflows | `CatalogItem.coverage_rate` exists in types/store, but quantity resolver/pricing paths do not apply coverage or bundle conversion | **Stub.** A live Coverage quantity column would imply calculations that FieldDive does not perform |
| **Waste** | Optional per-item percent; Catalog Settings can provide defaults for new items; CSV supports `WASTE`; proposal-level waste is also described publicly | `waste_applies` boolean exists; company policy is locked to `adjusted_measurement`; adjusted measurements already contain waste | **Partial/stub.** No `waste_pct`; applying catalog waste now risks double-applying waste |
| **Sales tax** | Customer tax can be entered per item, defaulted for new items, and represented in CSV | Company Pricing Rules own `salesTaxRatePct`; pricing engine applies the approved company policy, not per-item Catalog tax | **Real at company level only.** Per-item Catalog sales tax would create a second source of truth |
| **Material purchase tax** | Materials-only column; individually editable, bulk-managed, defaultable for new items, and available in CSV; contributes to true material unit cost | Company Pricing Rules support optional `materialPurchaseTaxRatePct`; Catalog items have no per-item purchase-tax field | **Real at company level only.** Per-item display/edit would not match current schema or cost-basis policy |
| **Supplier / ABC / QXO / SRS** | Catalog rows can link to supplier products manually or by SKU CSV; supplier prices can refresh automatically; public docs identify ABC, QXO/Beacon, and SRS SKU fields | No supplier connection/model, SKU mapping, refresh history, approval policy, or Catalog supplier store | **Planned.** A connection/status or live-price UI would be fake and could undermine proposal snapshot truth |
| **Columns / display** | Column visibility controls include material purchase tax and support a wider configurable Catalog table | P0D exposes a disabled **Columns** command only; no preference model or safe future columns | **Planned.** Keep disabled until supported columns and persistence ownership are approved |
| **Manage catalog CSV** | Manage catalog supports download, adding new rows, updating existing rows, fixed-column CSV validation, and UUID-based matching; imports can also use roofing systems | No Catalog CSV parser/exporter, dry-run validation, ID matching contract, or protected upsert flow | **Planned.** Real import could duplicate rows or damage template references |
| **Bulk selection / actions** | Header/row checkboxes drive bulk actions such as purchase-tax management and Add to templates; public demonstrations also show type/edit/delete workflows | P0D reserves disabled checkbox cells only; no selection state, safe bulk action, picker, or delete policy | **Layout-only.** Enabling selection without a safe action would misrepresent capability and introduce referential risk |

**Confirmed P0D UI foundation (commit boundary):**

- Continuous **All items** table; no Materials / Labor / Fees & Other group bands
- Disabled/reserved selection checkbox column; no selection state, selected count, or bulk bar
- Roofr-like command bar: Search · Filters & sort · Re-order / Columns / Manage (Coming soon) · Add
- Settings future-tools panel plus active Pricing rules and Proposal templates links
- No active CSV, re-order, column preferences, bulk actions, tax, waste, coverage, or supplier behavior
- Existing truthful columns remain: Name · Type · Measurement · Unit · Unit cost · Unit price · Proposal · Status · Actions

##### 13.4.2 Catalog systems stop rules

- **Coverage:** Do not show Coverage as a live quantity column or editable quantity control until the quantity resolver uses `coverage_rate` truthfully and rounding/unit semantics are approved and tested.
- **Waste:** Do not show Waste % as live until a `waste_pct` model and pure math tests exist. Under `adjusted_measurement`, waste is already upstream; **never apply waste twice**.
- **Tax:** Do not add per-item sales-tax or material-purchase-tax columns until the Catalog-versus-Pricing-Rules source-of-truth architecture is explicitly approved, including customer-visible versus internal-only behavior.
- **Supplier:** Do not apply supplier price updates until supplier mapping, change approval, refresh history, and frozen-proposal snapshot protection are designed. Supplier refresh must never mutate sent/frozen proposal truth.
- **CSV:** Do not enable real CSV upsert until stable ID/UUID matching, validation/dry-run behavior, duplicate policy, and template-reference protection are designed.
- **Bulk:** Do not enable checkboxes or bulk actions until a real selection model and at least one safe first action (prefer bulk deactivate, not hard delete) are designed and tested.
- **Columns / re-order:** Keep controls planned/disabled until persistence ownership and supported behavior are defined; do not expose unsupported Coverage/Waste/Tax/Supplier columns through display preferences.
- Any slice that would change schema, migrations, quantity/pricing math, proposal snapshots, sent/public proposal truth, or material-order calculations requires separate explicit approval.

##### 13.4.3 Catalog systems implementation sequence after P0D

| Step | Scope | Gate |
|------|-------|------|
| **S0 — docs research lock + P0D commit** | Commit the P0A–P0D Catalog chrome foundation and this research/stop-rule record | Current step; no systems behavior |
| **S1 — Quantity/Waste Architecture Decision** | Decide coverage units, quantity conversion, rounding, raw-vs-adjusted measurement ownership, and waste precedence | **Immediate next after P0D commit; not UI column work** |
| **S2 — schema/model migration draft** | Unapplied additive draft `20260716_021_add_quantity_resolution_fields.sql` (waste_pct + quantity_resolution_echo); disposable-validated | Do not apply to production without explicit approval; no UI/resolver/engine wiring |
| **S3 — pure math/tests** | Prove coverage conversion, waste single-application, rounding, and tax/cost incidence without UI | Must pass before live columns/editing |
| **S4 — read-only UI** | Show proven values and optional columns without editing | Only truthful engine-backed values |
| **S5 — editable UI** | Detail/settings/bulk editing after validation and store APIs exist | No fake forms; audit/update rules required |
| **S6 — proposal/template/material-order integration** | Connect approved quantity/cost rules while preserving snapshots and references | Sent/frozen proposal truth protected |
| **S7 — Manage catalog CSV** | Export, preview/dry-run, validated ID-based create/update | Reference-safe; no hard-delete import |
| **S8 — Supplier integration** | Provider mapping, SKU links, refresh/change approval, history | No silent mutation of proposal snapshots |
| **S9 — smoke/audit** | Desktop/mobile UI plus quantity, proposal, template, material-order, and snapshot truth audit | Required before declaring systems live |

##### 13.4.4 S1A Quantity/Waste Architecture Decision (docs only)

**Decision status:** **Approved architecture direction; docs-only record.** S1A was locked at **`44a1d29` — `docs: record S1 quantity and waste architecture decision`**. Current code checkpoint: **`60b75cb` — `feat(catalog): add pure quantity-mode helpers and tests`**. S1A changes no app code, schema, migrations, SQL, UI, pricing math, proposal persistence, or protected systems.

###### Current production mode — preserve

- FieldDive remains on **`adjusted_measurement`**.
- The live production path remains **MeasurementRecord / handoff → `quantity_source` lookup → resolved line quantity → pricing input**.
- Current `proposalQuantityResolver` behavior remains unchanged in S1A.
- Measurement waste is assumed to be applied upstream when `adjusted_roof_squares` is used. The pricing engine must not re-apply waste.
- `coverage_rate` and `waste_applies` remain **non-authoritative compatibility/stub fields**. They do not currently drive resolver or pricing behavior.
- Coverage and Waste UI remains planned/blocked. Do not expose either as a truthful live value.

###### Durable long-term target — Option D dual-mode quantity resolver

FieldDive’s durable target is an explicit dual-mode quantity layer. This is a future target, not authorization to enable the second mode.

| Mode | Status / source | Coverage and waste rule |
|------|-----------------|-------------------------|
| **`adjusted_measurement`** | Current default and only production-supported mode; consumes measurement quantities whose waste is already upstream | Catalog `waste_pct` must not apply. Coverage may only be considered in a later approved slice if conversion semantics are explicit and no waste is re-applied |
| **`raw_plus_waste`** | Future opt-in mode; consumes proven raw measurements | Applies approved coverage conversion and `waste_pct` through pure, tested quantity helpers; requires schema/model, rounding policy, snapshot/staleness support, and tests before UI or engine wiring |

The future resolver must treat quantity mode as an explicit truth boundary. Mixed adjusted/raw inputs within one unresolved calculation path are forbidden.

###### Explicit rejected moves in S1A

- Do not add a live **Coverage** column or editable Coverage control.
- Do not add a live **Waste %** column or editable Waste control.
- Do not add sales-tax, material-purchase-tax, or supplier columns as part of S1.
- Do not change pricing-engine math or pricing-policy validation in S1A.
- Do not migrate, refresh, or recalculate existing proposals under a future quantity mode.
- Do not present Coverage/Waste as truthful until resolver, snapshots, draft refresh, and staleness detection support the same mode and inputs.
- Do not treat the existing `coverage_rate` / `waste_applies` fields as evidence that the feature is live.

###### Snapshot and proposal-trust rules

- Sent/frozen proposals must never be recalculated under a newly introduced quantity mode.
- When coverage/waste-enabled quantity resolution is eventually approved, each resolved line must snapshot:
  - quantity mode;
  - source measurement key and source measurement value;
  - `coverage_rate` actually used (or explicit not-applicable value);
  - `waste_pct` actually used, or explicit **n/a** under adjusted mode;
  - final resolved purchase quantity.
- Draft refresh may re-resolve quantity inputs only while the proposal remains draft and only through an explicit approved refresh path.
- Future staleness detection must identify drift in quantity mode, source measurement key/value, coverage, and waste.
- A proposal must not combine an adjusted-measurement snapshot with a newly computed raw-plus-waste quantity without an explicit draft migration/rebuild decision.
- Catalog references may remain live for draft discovery, but sent/frozen proposal quantity and pricing truth must remain snapshot-owned.

###### Tax and supplier boundaries

- Tax remains outside S1 quantity/waste work.
- Company **Pricing Rules** remain the tax source of truth today.
- Per-item sales tax and material purchase tax require a later, separate architecture decision defining customer-visible versus internal cost behavior.
- Supplier integration remains later than stable quantity/waste truth.
- Supplier price refresh must never mutate sent/frozen proposal snapshots.
- Future supplier cost changes require a draft-only acceptance/refresh path and must preserve the cost/quantity values used by existing snapshots.
- Supplier SKU, unit, package, or coverage metadata must not silently change quantity semantics.

###### S1 follow-on sequence

| Step | Scope | Guardrail |
|------|-------|-----------|
| **S1A — decision record** | This docs-only dual-mode decision and trust boundary | No app/schema/math/UI changes |
| **S1B — pure quantity-mode helpers/types — COMPLETE (`60b75cb`)** | Define mode-aware quantity input/output contracts and pure helpers | No UI; no pricing-engine wiring; current resolver unchanged |
| **S1C — fixtures/tests — COMPLETE (`60b75cb`)** | Lock current behavior; specify future coverage/waste formulas; prove no double waste | Tests before persistence or UI |
| **S1D — schema proposal — APPROVED** | Document proposed fields/ownership only | No migration until separately approved |
| **S1E — docs/schema decision lock — CURRENT** | Lock the approved S1D ownership, additive-field, snapshot, migration-sequence, and stop-rule decisions in this handoff | Docs only; no schema, SQL, app behavior, or production wiring |
| **S1F — read-only UI** | Show engine-backed values only after math is proven | No live column before truth support |
| **S1G — editable UI** | Catalog/default/override editing after validation and stores exist | Later explicit approval |
| **S1H — draft refresh / snapshot / staleness integration** | Re-resolve drafts and persist/freeze all quantity drivers | Sent/frozen proposals immutable |
| **S1I — smoke/audit** | Quantity, pricing, Builder, customer/public, snapshot, and mobile audit | Required before declaring mode live |

###### S1 stop conditions

Stop and return to architecture review if:

- raw measurement quantities are missing, inconsistent, or unreliable for `raw_plus_waste`;
- the waste status of `adjusted_roof_squares` cannot be proven for supported measurement sources;
- coverage conversion would silently change existing draft proposal quantities;
- pricing-engine changes become necessary before pure quantity helpers and tests establish the contract;
- any UI would show Coverage/Waste as live before resolver, persistence, snapshot, and staleness truth is proven;
- tax or supplier scope begins to enter quantity/waste helpers, models, or tests;
- existing proposals would require automatic migration or recalculation to adopt the future mode.

###### S1D/S1E schema/model decision lock (docs only)

**Decision status:** **S1D proposal approved and locked by S1E documentation only.** S1B/S1C completed at **`60b75cb` — `feat(catalog): add pure quantity-mode helpers and tests`**. The pure foundation is:

- `app/lib/catalogQuantityMode.ts`;
- `app/lib/catalogQuantityMode.test.ts`.

The helpers remain intentionally **unwired**. Production still supports **`adjusted_measurement` only**. The production resolver, pricing engine, pricing input mapper, snapshot builder, UI, database schema, and migrations remain unchanged.

**Quantity-mode ownership**

- Primary owner: existing `company_pricing_policies.waste_model` / the resolved company pricing policy.
- Freeze/audit echo owner: proposal-version `policy_echo`.
- Do **not** add `catalog_items.quantity_mode` in v1.
- Do **not** permit silent per-line or per-item mode mixing. A proposal calculation must have one explicit quantity-mode truth boundary.

**Future catalog quantity drivers**

- Keep existing nullable `catalog_items.coverage_rate` as a future driver; it remains non-authoritative until separately approved resolver/snapshot integration exists.
- Keep existing `catalog_items.waste_applies` as the material/application gate.
- Proposed additive field: `catalog_items.waste_pct numeric null` (percent points; for example `10` means 10%).
- Optional proposed additive field: `catalog_items.coverage_basis text null`, only if needed to make the measurement-units-per-purchase-unit contract unambiguous.
- Do **not** add `catalog_items.quantity_mode` in v1.
- Do **not** add tax or supplier fields to the S1 quantity schema.

**Future proposal snapshot/freeze driver echo**

- Preferred additive field: `proposal_line_items.quantity_resolution_echo jsonb null`.
- When quantity-mode persistence is separately approved, the echo should store:
  - `quantity_mode`;
  - `source_measurement_key`;
  - `source_measurement_value`;
  - `coverage_rate_used`;
  - `waste_pct_used`;
  - `rounding_mode_used`;
  - `resolved_purchase_quantity`.
- Existing proposal line quantities remain customer-safe and freeze-on-send.
- Existing proposals require no migration, refresh, or recalculation; a null echo remains valid for historical rows.

**Measurement and rounding**

- No S1 measurement schema change. Raw and adjusted measurement fields already exist.
- Add a future `measurement_waste_included` field only if source audits prove that adjusted-measurement waste semantics cannot be trusted; that finding is a stop condition, not an assumed migration.
- Keep **`exact`** as the current/default rounding mode.
- **`whole`** remains contract-only and unsupported until its math, unit semantics, tests, and DB checks receive separate approval.
- Do **not** widen the current `quantity_rounding` CHECK yet.

**Future additive migration sequence (not created or applied in S1E)**

1. Add nullable `catalog_items.waste_pct`.
2. Optionally add nullable `catalog_items.coverage_basis` only if the reviewed contract requires it.
3. Add nullable `proposal_line_items.quantity_resolution_echo`.
4. Perform no invented coverage/waste backfills and require no migration of old proposals.
5. Do not widen `waste_model` to enable `raw_plus_waste`, or widen `quantity_rounding` to enable `whole`, in the same first migration.
6. Treat `raw_plus_waste` enablement as separate later work requiring explicit resolver, draft-refresh, snapshot, staleness, freeze, and smoke approval.

**Locked stop rules**

- No Coverage or Waste UI columns or editing yet.
- No `raw_plus_waste` production resolver/engine wiring yet.
- No widening of `waste_model` or `quantity_rounding` DB checks yet.
- No proposal draft refresh, snapshot-builder, sent/frozen, or customer-presentation changes yet.
- No tax/supplier scope bleed into quantity schema.
- S2 migration `20260716_021` was manually applied to approved project `rhquhnujjnzjhweypavd`; do not add production behavior or perform further quantity-schema migrations without separate explicit approval.

###### S2 migration draft + disposable validation note

**Status:** **Draft committed, disposable-validated, manually applied, and metadata-verified.** File: `supabase/migrations/20260716_021_add_quantity_resolution_fields.sql`. Migration/docs draft checkpoint: **`e3c9736` — `chore(db): add validated quantity resolution migration draft`**.

Additive-only scope:

- nullable `catalog_items.waste_pct` with finite/`>= 0` check;
- nullable `proposal_line_items.quantity_resolution_echo jsonb` with object-or-null check;
- comments clarifying `coverage_rate` / `waste_applies` / `waste_pct` / echo remain non-authoritative until separately wired;
- no `coverage_basis`;
- no `catalog_items.quantity_mode`;
- no `company_pricing_policies` `waste_model` / `quantity_rounding` CHECK widening;
- no UI, resolver, pricing-engine, pricing-mapper, or snapshot-builder wiring;
- no invented backfills and no old-proposal migration.

**Disposable validation:** applied once in an in-memory **PGlite** database with stub tables (not Docker/psql/Supabase CLI; not a full Supabase restore). Result: **26/26** checks passed (columns/nullability, validated constraints, comments, valid/invalid waste and echo values, unchanged row counts/quantities, policy CHECKs still limited to `adjusted_measurement` + `exact`). **Production SQL was not run.** Live Supabase was not used.

**Live apply checkpoint (manual):** migration `supabase/migrations/20260716_021_add_quantity_resolution_fields.sql` was applied manually through the Supabase SQL Editor to the approved FieldDive project/ref **`rhquhnujjnzjhweypavd`**. Final metadata verification passed:

- `catalog_items.waste_pct` exists;
- `proposal_line_items.quantity_resolution_echo` exists;
- `catalog_items_waste_pct_check` exists and is validated;
- `proposal_line_items_quantity_resolution_echo_object_check` exists and is validated.

An earlier smoke-table error was caused by temporary validation-table lifecycle, not missing live schema; the final metadata verification above passed. This apply enables **no production behavior**: `raw_plus_waste` remains disabled, `whole` rounding remains disabled, there are no Coverage/Waste UI columns, and resolver/pricing-engine/pricing-mapper/snapshot-builder paths remain unwired.

**Next after this checkpoint:** type/store alignment planning or resolver-integration planning only, with a separate approval gate before implementation. Do **not** skip to UI columns.

###### raw_plus_waste implementation path lock (Phase 1 docs + pure math)

**Status:** **Phase 1 locked — docs + pure helper/test expansion only.** Helpers remain in `app/lib/catalogQuantityMode.ts` / `app/lib/catalogQuantityMode.test.ts` and stay **intentionally unwired**. This lock does **not** authorize production enablement.

**Current production mode (unchanged)**

- `adjusted_measurement` remains the default and only active production mode.
- `raw_plus_waste` remains future-only.
- Whole rounding remains unsupported (`unsupported_rounding`).
- Coverage/Waste UI remains inactive (no editable columns; no live truthful display).
- Production resolver, pricing engine, pricing input mapper, draft create/refresh persistence, and customer/public DTOs remain on the adjusted path.

**Formula / order (future `raw_plus_waste` only)**

1. **Source** — raw measurement source quantity only (not `adjusted_roof_squares` or any already-wasted value). Unknown/unproven source must fail/violate, not guess. Pure helper flag `sourceAlreadyAdjusted: true` → `double_waste_risk`.
2. **Coverage** — `null`/`undefined` `coverage_rate` = 1:1; valid `coverage_rate` = source units covered by one purchase unit; `purchase_qty = source_qty / coverage_rate`. Invalid `0` / negative / non-finite → `invalid_coverage`.
3. **Waste** — applies only when `waste_applies === true`. `waste_pct` null/undefined = no waste. `resolved = covered * (1 + waste_pct / 100)`. Invalid negative / non-finite → `invalid_waste`. `waste_applies === false` skips waste even if `waste_pct` is present.
4. **Rounding** — exact only in this phase; whole remains separate/future (`unsupported_rounding`).

Order: **source → coverage → waste → exact**.

**No-double-waste rules**

- `adjusted_measurement` must never apply catalog `waste_pct` (`waste_forbidden_in_adjusted_mode` / double-waste risk).
- `adjusted_measurement` ignores coverage in this phase (`coverageRateUsed` stays null even if coverage input is supplied).
- `raw_plus_waste` must not use `adjusted_roof_squares` or already-wasted measurement values.
- `raw_plus_waste` requires raw measurement source proof; unknown source proof must fail/violate.
- Activation is policy-gated (`policy.wasteModel === "raw_plus_waste"` via adapter). `DEFAULT_QUANTITY_MODE` stays `adjusted_measurement`; no UI mode switch; helper notes mark policy-gated / non-UI status.

**Item behavior**

- Materials may use coverage + waste when the future mode is enabled.
- Labor/fees should usually have `waste_applies=false`.
- `coverage_rate` should usually be null for labor/fees unless explicitly supported later.

**Future sequence (gated; do not skip)**

| Phase | Scope | Guardrail |
|-------|-------|-----------|
| **1 — docs + pure math/tests** | This lock + expanded `catalogQuantityMode` helpers/tests | No resolver wiring; no policy CHECK widening; no UI |
| **2 — disabled resolver branch tests** | Fixture/tests for a future branch that stays disabled | No production path change |
| **3 — policy/app validator staging** | App-level validators prepare for dual mode without enabling | No DB CHECK widening |
| **4 — DB CHECK widening** | Only after explicit approval | Separate gate; not bundled with UI |
| **5 — draft refresh / snapshot / staleness dual-mode** | Echo + staleness for both modes | Sent/frozen immutable; no auto-refresh |
| **6 — read-only UI** | Show proven engine-backed values only | No editing |
| **7 — editable UI** | Catalog/default/override editing | Later explicit approval |

**Stop conditions (same family as S1)** — stop if raw source proof is unreliable; if adjusted waste ownership is unprovable; if coverage would silently change existing draft quantities; if UI would show Coverage/Waste before truth support; if tax/supplier scope bleeds in; if existing proposals would require automatic migration.

**Phase 2 status — COMPLETE (historical; superseded by Phase 5):** added fixture helper `app/lib/proposalQuantityResolutionDisabledRawBranch.ts` plus `compareRawPlusWasteQuantityResolutionEcho` for raw↔raw echo comparison. At Phase 2 completion the production adapter was still adjusted-only; Phase 5 later wired policy-gated dual-mode. Filename kept for history; helper remains unwired from create/refresh. Whole rounding unsupported. No UI / customer/public DTO exposure at that phase.

**Phase 3 status — COMPLETE (historical; superseded by Phase 5):** app `validateCompanyPricingPolicy` recognizes `raw_plus_waste` as a valid policy waste_model literal (not default). `DEFAULT_WASTE_MODEL` / starter / UI lock remain `adjusted_measurement`. Whole rounding rejected. Migration draft `20260716_023_allow_raw_plus_waste_policy_mode.sql` prepared (applied in Phase 4). No UI mode control.

**Phase 4 status — COMPLETE (CHECK widening applied; quantity wiring completed in Phase 5):** migration `supabase/migrations/20260716_023_allow_raw_plus_waste_policy_mode.sql` **live-applied + verified PASS** on approved project/ref **`rhquhnujjnzjhweypavd`**. Live `company_pricing_policies_waste_model_check` allows `adjusted_measurement` + `raw_plus_waste`. `company_pricing_policies_quantity_rounding_check` remains `exact` only (whole blocked). Column default remains `adjusted_measurement`. After Phase 5 smoke restore: **1× adjusted_measurement**, **0× raw_plus_waste**. Schema-allowed; backend activation is policy-gated (not UI-selectable; not default).

**Phase 5 status — COMPLETE (backend dual-mode + controlled live smoke PASS):** draft create/refresh/mapper/adapter/inspection/preflight support `raw_plus_waste` **only when** `policy.wasteModel === "raw_plus_waste"`. Default remains `adjusted_measurement` (adjusted goldens unchanged). Raw path: proven raw source (remaps `adjusted_roof_squares` → handoff `roof_squares` only) → coverage → waste → exact; persists raw `quantity_resolution_echo` with coverage/waste drivers. Pricing engine accepts raw waste model but does **not** apply coverage/waste math. Whole rounding unsupported. No UI mode switch. Customer/public DTOs still omit line echo. Controlled live smoke PASS details follow.

**Controlled minimal complete-source smoke — PASS (2026-07-16):** approved project **`rhquhnujjnzjhweypavd`**; company **`e1fd48bb-fe22-4dfe-9622-3f25eb2109b6`**; policy **`8d1e019c-b8eb-4725-8f22-90bbcfb09cbb`**; job **`c9497cc1-c8d2-406e-8455-5a6f9cc369d3`**; same-job selected measurement **`62f5d03b-7215-4504-bb0c-3c1b116a79b3`**; dedicated internal smoke template **`24cdbe2e-ff54-4d6e-8588-5a5b6b133c2f`**; catalog item **`2f5f67d2-92d3-4bbb-9323-433baa5f9f71`**; draft proposal **`2d6b40f1-bc17-448e-81b0-6eed98ba5e62`**. The sole template source was proven raw **`roof_squares=25`** in both the selected measurement and handoff; the catalog's `adjusted_roof_squares` source was intentionally remapped to raw `roof_squares`. Temporary policy switch to `raw_plus_waste` preserved `quantity_rounding=exact`. Draft create and refresh each persisted one resolved raw/exact line (`quantity=25`, `resolved_purchase_quantity=25`, catalog-truth `coverage_rate_used=null`, `waste_pct_used=null`). Internal preflight returned **`current`** (`currentCount=1`, `staleCount=0`, `unknownCount=0`). Policy was restored to **`adjusted_measurement` / `exact`** (**1 adjusted / 0 raw**). The app create path temporarily pointed `jobs.active_proposal_id` at the smoke draft; the prior S3D13 precheck proved the baseline was null, so that pointer was conditionally restored to null after the smoke. Only allowed draft audit events occurred: `created`, then `draft_saved`; public-token count stayed zero; proposal remained draft-only. No send/public/signed/paid/whole-rounding/UI/customer-public behavior was enabled.

**Phase 6 status — COMPLETE (read-only contractor/internal quantity surface):** Builder Proposal helper rail shows a read-only **Quantity sources** status from existing preflight trust compose (`presentBuilderQuantityStatus`): current → “Current”; unknown → “Need review”; stale → “Changed” (short values; rail label already names the row). Helper text is contractor-only and non-blocking. No auto-refresh CTA, no Send block, no mode switch, no raw echo JSON dump, no customer/public exposure. Catalog Settings planned Coverage/Waste copy clarifies the raw-mode foundation is backed but editing is not enabled (controls remain Coming soon). Backend remains policy-gated; adjusted default unchanged; whole rounding unsupported.

**Phase 7 status — COMPLETE (editable Catalog Coverage/Waste item controls):** Catalog item **edit panel** and **add modal** expose Coverage (`coverage_rate`), Apply waste (`waste_applies`), and Waste % (`waste_pct`) under **Coverage & waste**, with copy “Used by raw quantity mode. Does not change adjusted-mode proposals. Not customer-facing.” Validation: coverage empty/null = 1:1, else must be > 0; waste % empty/null = none, else must be ≥ 0; waste % input disabled when Apply waste is off. Persist via existing `createCatalogItem` / `updateCatalogItem` (no migration). Table keeps existing columns; set drivers show as a compact name secondary line (not new columns — table already dense). Catalog Settings planned entry updated: item Coverage/Waste are live; quantity-mode switch + tax remain Coming soon. `adjusted_measurement` remains default; `raw_plus_waste` remains policy-gated; no Settings mode switch; no whole rounding; no customer/public DTO exposure; no proposal auto-refresh or Send block; adjusted proposals ignore these drivers until policy is raw.

**Controlled non-null Coverage/Waste smoke — PASS (2026-07-16):** approved project **`rhquhnujjnzjhweypavd`**; company/policy **`e1fd48bb-fe22-4dfe-9622-3f25eb2109b6`** / **`8d1e019c-b8eb-4725-8f22-90bbcfb09cbb`**; job/measurement **`c9497cc1-c8d2-406e-8455-5a6f9cc369d3`** / **`62f5d03b-7215-4504-bb0c-3c1b116a79b3`**; dedicated one-line template **`24cdbe2e-ff54-4d6e-8588-5a5b6b133c2f`** (template item **`843a9a7c-7acc-414c-8ab7-993ccf11731a`**); catalog item **`2f5f67d2-92d3-4bbb-9323-433baa5f9f71`**; successful draft proposal **`3a5889b8-06d6-4abd-bcc2-e0aa4fe89c7b`**. Original/restored catalog values were `coverage_rate=null`, `waste_applies=true`, `waste_pct=null`; temporary values were `5 / true / 10`. Proven raw source was `roof_squares=25` in measurement and handoff. Expected and observed exact math: **`25 / 5 × 1.10 = 5.5`**. Create persisted one line (`f35737bb-08b9-44ec-b640-72bd1e5af4a4`) at `quantity=5.5` with raw echo (`source=roof_squares:25`, coverage `5`, waste `10`, exact, resolved `5.5`); refresh replaced the persistence row as expected (`c5839da6-cd2a-49f4-aab1-6fdd87ff2c03`) and preserved the same quantity/echo. Internal preflight returned **current** (`currentCount=1`, `staleCount=0`, `unknownCount=0`). Temporary policy state was `raw_plus_waste / exact` (**1 raw / 0 adjusted**); restore verified `adjusted_measurement / exact` (**1 adjusted / 0 raw**), original catalog values, and null job `active_proposal_id`. Company public-token inventory was unchanged at 22 and the smoke proposal had zero; only `created` then `draft_saved` occurred; proposal stayed draft-only with no sent/signed/paid pointers. Two preliminary guard attempts (`ec1193e9-bc3b-453d-82d9-471d03e4a423`, create only; `bc102770-e2bb-4e21-ae8b-c9b6aba5f71d`, create + refresh) stopped on smoke-script assumptions about pricing status/line-row identity, not quantity mismatches; both remained draft-only, had no public tokens, used only allowed events, and each restoration passed.

**Catalog P1 remediation — COMPLETE (validation + read-failure hardening):** Strict Catalog numeric parsing rejects malformed suffixes (`12abc`, `5abc`, `10xyz`, `NaN`, `Infinity`, `--1`, `1.2.3`) for unit cost/price, Coverage, and Waste %. Coverage empty → null (1:1); Coverage must be > 0; Waste empty → null; Waste ≥ 0; Waste input disabled when Apply waste is off. Pure `classifyCatalogCoverageCompatibility` returns `not_applicable` (null coverage), `not_verified` (coverage set — no `coverage_basis` in schema), or `incompatible` (e.g. coverage on `fixed` source); **never** returns `compatible` without dimensional proof; does **not** block adjusted-mode saves; raw mode switch remains deferred. Catalog list loads use `loadCatalogItemsByCompany` / `CatalogItemsLoadResult` so success-empty ≠ failed-read; UI shows load error + Retry; starter empty-install is gated off when `loadError` is set; starter install aborts without creating rows on failed reads. Behavioral create/update builders + tests cover coverage/waste payloads, malformed blocking, soft deactivate (no hard delete), Settings planned-only (no mode switch), adjusted ignore, policy-gated raw. Contained P2: Catalog nav `aria-current="page"`; Coverage helper copy no longer claims sq ft without basis; stale “future/unwired” comments corrected. No SQL/migrations; no pricing-engine math change; no raw UI switch; no whole rounding; deferred Roofr parity unchanged. Checkpoint: **`dfe627f`**.

**Next after Catalog P1 remediation:** Lock `coverage_basis` architecture in docs (this section), then review-only migration draft. Phase 8 mode-switch planning remains blocked until compatibility can return `compatible` for proven pairings. Do not enable Settings waste-model control or switch live company policy without approval.

#### 13.4.5 `coverage_basis` architecture — APPROVED MODEL LOCK (docs only)

**Status:** Decision locked. **No app code, no migration file, no live SQL, no Catalog UI, no pricing/proposal changes in this checkpoint.**

**Authority:** `coverage_basis` is the measurement-side unit of the coverage divisor. It answers: “what does the coverage number measure?” It is **not** the purchase/sell unit.

| Concept | Role |
|---|---|
| `coverage_rate` | How much measurement one purchase unit covers |
| `coverage_basis` | Unit of that measurement (roof square, sq ft, LF, each, tons) |
| `unit` | What the contractor buys/sells (bundle, roll, piece, etc.) |

**Do not** use purchase `unit` as a proxy for basis.

**Approved enum (planned nullable catalog item field):**

| Value | Meaning |
|---|---|
| `null` | No basis set (default for existing / 1:1 / unset) |
| `roof_square` | Coverage measured in roof squares |
| `square_feet` | Coverage measured in square feet |
| `linear_feet` | Coverage measured in linear feet |
| `each` | Coverage measured per count/each |
| `tons` | Coverage measured in tons |

**Examples:**

- `coverage_rate = 5`, `coverage_basis = roof_square`, `unit = bundle` → one purchase unit covers 5 roof squares
- `coverage_rate = 33.3`, `coverage_basis = square_feet`, `unit = bundle` → one purchase unit covers 33.3 sq ft
- `coverage_rate = 10`, `coverage_basis = linear_feet`, `unit = roll` → one purchase unit covers 10 LF

**Compatibility classifier states (approved):**

| State | Meaning |
|---|---|
| `not_applicable` | No coverage divisor in play |
| `compatible` | Source and basis are same category (proven) |
| `not_verified` | Coverage set but basis missing / source unmapped |
| `incompatible` | Fixed source with coverage, or source/basis category mismatch |

**Classifier rules:**

1. `coverage_rate` null → `not_applicable`
2. `coverage_rate > 0` + `coverage_basis` null → `not_verified`
3. Quantity source `fixed` + non-null `coverage_rate` → `incompatible`
4. Source and basis same category → `compatible`
5. Source and basis different categories → `incompatible`
6. `custom` / `labor_multiplier` / unknown sources → `not_verified` until explicitly mapped

**Core source → basis category map:**

| `coverage_basis` | Compatible quantity sources |
|---|---|
| `roof_square` | `roof_squares`, `tear_off_squares`; `adjusted_roof_squares` only via approved adjusted→raw remap to `roof_squares` |
| `square_feet` | `roof_area_sqft` |
| `linear_feet` | `*_lf` sources |
| `each` | `*_count` sources |
| `tons` | `debris_tons` |

**Existing rows policy:**

- No backfill
- No existing-row mutation
- Rows with non-null `coverage_rate` and null `coverage_basis` remain `not_verified` until the user sets a basis
- `adjusted_measurement` continues to ignore coverage/waste
- Settings / product raw_plus_waste mode switch remains **blocked** until compatibility can be proven (`compatible`)

**Schema — Step B draft + Step G live apply — COMPLETE (verified PASS):**

- File: `supabase/migrations/20260717_024_add_catalog_items_coverage_basis.sql`
- **Applied + verified PASS** on approved project/ref **`rhquhnujjnzjhweypavd`** (2026-07-17)
- Column `catalog_items.coverage_basis` exists: `text`, nullable (`YES`), **no default** (`column_default` null)
- CHECK `catalog_items_coverage_basis_check` allows only `null` or `roof_square` | `square_feet` | `linear_feet` | `each` | `tons`
- No backfill; no UPDATE of existing rows at apply
- Live verify: catalog count **17** unchanged; all **17** rows `coverage_basis` null; proposal count **21** unchanged; policy count **1** unchanged (`adjusted_measurement` / `exact`; **0** raw; **0** whole)
- Invalid value `bundle` rejected; valid `roof_square` accepted in rolled-back probe (final non-null count **0**)
- Column comment present; adjusted mode unaffected; raw mode switch still blocked; whole rounding CHECK still `exact` only
- App types/store/UI/classifier: **wired in Steps C–F** (see below)

**Steps C–F — app support COMPLETE:**

- Types: `CoverageBasis` + `COVERAGE_BASES` on `CatalogItem`
- Store: read/write `coverage_basis` via select/mappers/create/update (no invented default; invalid → null)
- Parser: `parseCoverageBasisOrNull`; clearing `coverage_rate` forces `coverage_basis` null; missing basis with coverage allowed (`not_verified`, does not block adjusted save)
- Add/Edit UI: Coverage basis selector in Coverage & waste; disabled/cleared when Coverage empty; helper text by basis; optional status chip (Compatible / Not verified / Incompatible)
- Classifier: returns `compatible` for proven source↔basis pairings (incl. `adjusted_roof_squares` via approved remap category); mismatch → `incompatible`; custom/labor_multiplier → `not_verified`
- Compatibility remains a trust/setup gate (not a second math engine); raw math still uses numeric `coverage_rate`
- Adjusted mode unaffected; `raw_plus_waste` policy-gated; no Settings mode switch; no whole rounding; no customer/public exposure
- Local app-flow smoke PASS: create with `roof_squares` / coverage `5` / basis `roof_square` / waste `10` → Compatible; persist + secondary line; mismatch → Incompatible; clear coverage clears basis; deactivate; Settings planned-only; Preview clean of internals

**Controlled Coverage basis live integration smoke — PASS (2026-07-17):** approved project **`rhquhnujjnzjhweypavd`**; company/policy **`e1fd48bb-fe22-4dfe-9622-3f25eb2109b6`** / **`8d1e019c-b8eb-4725-8f22-90bbcfb09cbb`**; job/measurement **`c9497cc1-c8d2-406e-8455-5a6f9cc369d3`** / **`62f5d03b-7215-4504-bb0c-3c1b116a79b3`**; minimal template **`24cdbe2e-ff54-4d6e-8588-5a5b6b133c2f`**; catalog item **`2f5f67d2-92d3-4bbb-9323-433baa5f9f71`** (source `adjusted_roof_squares`, remapped to raw `roof_squares=25`). Original catalog: `coverage_rate=null`, `coverage_basis=null`, `waste_applies=true`, `waste_pct=null`. Temporary: `5` / `roof_square` / `true` / `10`. Classifier: **`compatible`**. Temporary policy `raw_plus_waste` / `exact` for draft path only. Successful draft **`61356e56-8ef8-4fb6-85b4-672f18103b98`**: create + refresh quantity **`5.5`** (`25 / 5 × 1.10`); echo `raw_plus_waste`, source `roof_squares:25`, `coverage_rate_used=5`, `waste_pct_used=10`, exact, resolved `5.5`; **`coverage_basis_used` not included in echo** (future enhancement). Preflight **current** (`currentCount=1`, `staleCount=0`, `unknownCount=0`). Events `created` then `draft_saved` only; proposal draft-only; proposal public tokens 0; company token inventory unchanged at 22. Restored: policy `adjusted_measurement` / `exact` (0 raw / 0 whole), original catalog values, job `active_proposal_id` null. No mode switch exposed/enabled; no send/public/signed/paid/customer exposure. **Next:** Catalog integrated feature/tax planning — not raw mode switch.

**UI visual rule:** Coverage basis controls match the Roofr-aligned Catalog Add/Edit item pattern — clean light shell, compact form rows, clear labels/helper text. **Not** the old dark/blue standalone UI; **not** generic oversized cards; **not** fake-active controls; **not** a technical math dump to the contractor.

**Approved implementation sequence:**

| Step | Work | Gate |
|---|---|---|
| **A** | Docs/model decision lock (this section) | Done (`9a9209a`) |
| **B** | Migration draft, review-only | Done (`fb7b9a9`) |
| **C** | Types / store / parser support | **Done** (this commit) |
| **D** | Add/Edit Coverage basis selector | **Done** (this commit) |
| **E** | Classifier can return `compatible` for proven pairings | **Done** (this commit) |
| **F** | Tests | **Done** (this commit; 237 focused pass) |
| **G** | Live SQL only after approval | **Done** — applied + verified on `rhquhnujjnzjhweypavd` |
| **H** | Controlled smoke with non-null basis | **Done** — live integration smoke PASS (2026-07-17) |
| **I** | Only then revisit raw mode switch planning | Deferred — item tax capture done; next is Columns + Manage Catalog shell, not mode switch |

**Catalog item tax capture — COMPLETE (2026-07-17):**

- Migration `supabase/migrations/20260717_025_add_catalog_items_tax_rate_fields.sql` applied to **`rhquhnujjnzjhweypavd`**
- Nullable `catalog_items.sales_tax_rate_pct` + `catalog_items.purchase_tax_rate_pct` (0..100, no default, no backfill)
- `sales_tax_rate_pct` = customer-facing item sales tax **capture only** (proposal line-tax math not active)
- `purchase_tax_rate_pct` = internal supplier/material purchase tax capture; **never customer-facing**
- Types/store/Add/Edit/detail UI wired; table columns unchanged (detail panel); Settings planned copy updated
- Proposal pricing engine / Customer Preview / public DTOs unchanged
- Local Catalog UI smoke + live CRUD smoke PASS; no proposal events/tokens created by tax smoke

**Catalog Columns + Manage Catalog shell — COMPLETE (2026-07-17):**

- Active **Columns** menu: show/hide optional columns (type, measurement, unit, unit cost, unit price, proposal, status)
- Required always visible: selection checkbox, name, actions
- Coverage/waste/tax stay on name secondary line + item detail (not crowded into default table)
- Column prefs: `localStorage` key `fielddive.catalog.columnVisibility.v1` (no DB prefs)
- Active **Manage catalog** menu shell delivered; CSV entries activated in CSV v1 below; Reorder / Connect supplier / Jumpstart / Bulk edit purchase tax remain Planned
- Re-order toolbar chip remains Coming soon
- Future flow requirements (not built): material ordering, proposal selector from Catalog, supplier pricing sync

**Catalog CSV v1 — COMPLETE (2026-07-17):**

- Pure helpers: `app/lib/catalogCsv.ts` (parse / validate / template / export / import apply via store adapters)
- Stable headers: `id,name,description,item_type,quantity_source,unit,unit_cost,unit_price,proposal_visibility,active,coverage,coverage_basis,waste_applies,waste_pct,sales_tax_rate_pct,purchase_tax_rate_pct,abc_sku,qxo_sku,srs_sku`
- **Download template** — headers only (safe if re-uploaded unchanged; no data rows)
- **Download CSV** — exports full company catalog (active + inactive), stable ids, blank nullables, predictable money/percent formatting
- **Upload CSV** — local parse → preview summary (creates/updates/unchanged/invalid/warnings) → confirm import; **Import disabled when any invalid row**; no auto-import on file pick; no silent skip of invalid rows
- Create: blank `id`. Update: company-scoped `id` only (never cross-company). No hard delete from CSV. `active` changes only when explicitly set
- Coverage blank clears `coverage_basis`. Tax/coverage/waste/money use existing strict parsers
- Supplier SKU columns persist on catalog items (see supplier SKU storage below); sync remains planned
- Write path: `createCatalogItem` / `updateCatalogItem` (same validation builders as Add/Edit where practical); sequential company-scoped writes with clear stop-on-failure reporting (true DB transaction/RPC remains a future upgrade if all-or-nothing atomicity is required)
- No package dependency added; no supplier sync; no material ordering; no proposal import; no pricing-engine / Customer Preview / send-public-lifecycle changes

**Catalog supplier SKU storage — COMPLETE (2026-07-17):**

- Migration `supabase/migrations/20260717_026_add_catalog_items_supplier_sku_fields.sql` applied to **`rhquhnujjnzjhweypavd`**
- Nullable `catalog_items.abc_sku` / `qxo_sku` / `srs_sku` (text, CHECK length 1..128, no default, no backfill)
- Contractor/internal catalog metadata only — not customer-facing; does not imply supplier sync; does not change pricing or material ordering
- Types/store/Add/Edit/detail UI wired (Supplier section); table stays uncrowded (no default SKU columns)
- CSV import/export now persists SKU fields; blank clears on update; overlong SKUs invalidate the row
- Connect supplier / Jumpstart remain Planned; no API auth, price sync, or material ordering
- Proposal pricing engine / Customer Preview / public DTOs unchanged
- Local UI smoke + live CRUD smoke PASS; proposals/policies/events/tokens unchanged by SKU smoke

**Catalog selection + bulk actions foundation — COMPLETE (2026-07-17):**

- In-memory selection by catalog item id (no DB / localStorage persistence); does not mutate catalog rows by itself
- Row checkbox toggles one item; header checkbox selects/deselects all **currently visible** filtered rows; header supports checked / unchecked / indeterminate
- Selection pruned when items leave the loaded set or leave the current filter/search visibility
- Bulk action bar appears only when ≥1 selected — selected count + Clear selection
- **Live v1 bulk actions** (via existing `setCatalogItemActive` / `updateCatalogItem` store paths, sequential, stop-on-failure, reload + clear selection on success): Mark active · Mark inactive · Show on proposal · Hide from proposal
- **Planned / disabled** (visible, not fake-active): Bulk edit purchase tax · Bulk edit supplier SKUs · Assign supplier · Reorder selected · Export selected CSV · Delete items (hard delete not available — use Mark inactive) · Add to template · Add to proposal / material order
- No hard delete; no supplier sync; no material ordering; no proposal import; CSV import/export + supplier SKU + item tax capture unchanged; purchase tax remains internal; proposal pricing engine / Customer Preview unchanged
- Pure helpers: `app/lib/catalogSelection.ts`, `app/lib/catalogBulkActions.ts`; UI: `CatalogBulkActionBar`, live checkboxes in `CatalogItemTable`
- Local UI smoke + live CRUD smoke PASS on **`rhquhnujjnzjhweypavd`** (disposable `BULK-SMOKE-*` items: bulk inactive → active → inactive cleanup); tax/SKU preserved; Customer Preview clean of purchase tax / supplier SKUs; no supplier sync / material order / proposal import behavior

**Catalog bulk purchase tax modal — COMPLETE (2026-07-17):**

- Live bulk action **Bulk edit purchase tax** opens validation-backed modal (`CatalogBulkPurchaseTaxModal`) when rows are selected
- Set rate (strict 0–100 percent, decimals allowed) or Clear to null — uses `parseTaxRatePctOrNull` / `resolveBulkPurchaseTaxRate`
- Apply path: `applyCatalogBulkPurchaseTax` → `updateCatalogItem({ purchase_tax_rate_pct })` only; sequential; stop-on-failure; reload + clear selection on success
- Does **not** mutate sales tax, SKUs, visibility, active, or prices; does **not** change proposal pricing math or Customer Preview
- Purchase tax remains internal material-cost metadata; helper copy states no customer proposal tax / Preview impact
- Manage Catalog menu entry stays Planned as a shortcut (live path is selection bulk bar)
- Selection/bulk foundation, CSV, supplier SKU storage preserved; no supplier sync / material ordering / proposal import
- Local + live smoke PASS on **`rhquhnujjnzjhweypavd`** (`BULK-SMOKE-*`: set 7.25 → clear null; sales tax/SKU/visibility/active unchanged; proposals/policies/events/tokens unchanged; Preview clean)

**Catalog reorder foundation — COMPLETE (2026-07-17):**

- Uses existing durable `catalog_items.sort_order` (integer, nullable) — **no new migration**; store already reads/writes and lists by `sort_order`, then `name`
- Pure helpers: `app/lib/catalogReorder.ts` — move up/down/top/bottom, sequential stride-10 assignments, diff-only writes via `updateCatalogItem({ sort_order })`
- UI: live **Re-order items** toolbar control + Manage Catalog **Reorder items**; reorder mode bar with Save order / Cancel; row Order controls (Up/Down/Top/Bottom) — keyboard-accessible buttons (no DnD package)
- Guard: reorder requires empty search and type filter = All; otherwise clear unavailable copy; search/filters disabled while reorder mode is active
- Helper copy: display order only — does not change pricing, proposals, or customer documents
- CSV decision: `sort_order` remains **out of CSV v1** (import preserves existing sort_order; export order stays deterministic via sort_order/name). CSV sort_order round-trip planned later
- Bulk selection / purchase tax / SKU / tax capture unchanged; no supplier sync / material ordering / proposal import
- Local + live smoke PASS on **`rhquhnujjnzjhweypavd`**: filter guard; cancel restores; save persists move; restore starter head order; null `sort_order` rows normalized on save; catalog 26 / proposals 23 / policies 1 / events 304 / tokens 22 unchanged; Preview clean

**Catalog UX completion pass — COMPLETE (2026-07-17):**

- Cohesion / usability / readability polish across the Catalog management workspace — **no new major systems**
- Polished: Filters label (was “Filters & sort”); toolbar Re-order active-state clarity; quieter Manage Catalog footer; Manage planned labels (supplier-priced starter vs Install starter catalog); Add item section hierarchy (Basics → Pricing → Proposal → Coverage/waste → Tax → Supplier); detail panel tax/SKU duplication removed; bulk bar secondary-only live actions; empty-state inactive hint corrected; reorder Actions column noise reduced
- **Did not** change pricing engine, Customer Preview, send/public/lifecycle/PDF/sign/payment/webhooks, supplier sync, material ordering, proposal import, raw mode, whole rounding, schema/migrations, or package files
- Current Catalog capability list remains: coverage/waste/coverage basis; item sales + purchase tax capture; supplier SKU storage; CSV template/export/import/preview; Columns; Manage Catalog; selection + bulk bar; bulk purchase tax; persisted reorder; polished command/table/modal UX
- Local smoke: Catalog page readability, Columns, Manage live vs planned, Add/Edit sections, selection/bulk/reorder/CSV, ~390px wrap, Preview clean of purchase tax/SKUs

**Still deferred:**

- Raw mode switch (Settings waste-model control)
- Whole rounding
- Proposal line-tax engine (item sales tax → proposal totals)
- Supplier integrations / price sync / authentication
- CSV `sort_order` round-trip
- Bulk supplier SKU edit / assign supplier
- Export selected CSV
- Add-to-template / add-to-proposal / material orders
- Atomic CSV import RPC (if required later)
- CSV mapping/import assistant (non-exact headers) — see **§6BO.13.4.6**

**Integrated Flow P0 — Template Add item from Catalog / re-link — COMPLETE (2026-07-17):**

- **Schema decision:** use existing `proposal_template_items.catalog_item_id` (+ optional `catalog_seed_key`) — **no migration**
- Pure helpers: `app/lib/proposalTemplateCatalogLink.ts` — link status (`linked` / `missing_id` / `missing_catalog` / `inactive`), active-only picker filter, next sort_order, SoT/refresh copy constants
- UI: Structure workspace on `line_items` / `upgrade_group` sections lists linked Catalog items; **Add item from catalog** picker (active only); **Change catalog link** re-links `catalog_item_id` without silent name remap; no economics edited on template
- Store: `createProposalTemplateItem` / `updateProposalTemplateItem` wired from `TemplatesSetupClient`; Templates load full catalog via `getCatalogItemsByCompany` for inactive/missing honesty
- Copy: Catalog SoT + draft refresh honesty; Templates footnote/header no longer claim Builder is a “later stage”
- Builder/pricing/Preview: unchanged formulas; mapper still treats missing/inactive as unresolved; Preview remains clean of purchase tax/SKUs/internal cost
- Local UI smoke PASS; live CRUD smoke on **`rhquhnujjnzjhweypavd`**: add → persist `catalog_item_id` → re-link → delete disposable row; proposals **23** / policies **1** / events **304** / tokens **22** unchanged
- Protected: no supplier sync, material ordering, proposal import, CSV mapping, raw mode, whole rounding, send/lifecycle

**Integrated Flow P1 — setup-to-Builder trust flow — COMPLETE (2026-07-17):**

##### P1 targeted Roofr research (setup → proposal only)

**Question:** How does Roofr guide a contractor from setup into proposal creation?

**Confirmed Roofr patterns (public help):**
1. Setup order is **Catalog → Proposal Templates → create proposal from Job Card** (Create Catalog / Create Template / Create Proposal help).
2. Proposal create is a **job-page action**: Job Card → `+ Proposal` → choose measurement → choose template (Create a Proposal help).
3. Templates **link** catalog items; contractors do not re-edit catalog economics on the template (Create Template help).
4. Catalog price changes affect **new** template/proposal pricing paths; existing/signed proposals are not silently rewritten as a live price book (public docs emphasize create/copy/edit patterns rather than auto-mutating historical proposals).
5. Guidance model is primarily **page actions + smart defaults** (job CTA, template picker, measurement auto-quantities) — not a long multi-step wizard for every proposal.

**Unconfirmed in public Roofr docs:**
- Exact “catalog price changed on an open draft” banner / modal UX.
- Whether open drafts auto-refresh catalog economics without user action.
- Exact readiness checklist UI on Catalog/Templates screens.

**FieldDive interaction model decision (P1):** **hybrid**
- **Readiness card + direct action buttons** on Catalog/Templates (Open Templates / Fix Catalog links / Open Jobs).
- **Job Card** remains the only Create/Open proposal entry (no fake Create Proposal on Templates).
- Builder reuses existing **Refresh draft pricing** for measurement **and** Catalog economics drift (explicit user action; no silent auto-refresh).
- Not a full wizard; not copy-only banners.

##### P1 shipped behavior

- Pure helpers: `deriveTemplateCatalogLinkReadiness` (template link ready/warning/blocked + next action); `deriveDraftCatalogEconomicsStale` (draft Catalog missing/inactive/`updated_at` drift vs snapshot) + frozen-snapshot helper copy.
- Templates: Setup → proposal path card with linked/inactive/missing counts, **Fix Catalog links**, **Open Jobs to create a proposal** (no Create Proposal), checklist Open Jobs when `ready_for_builder`.
- Catalog All items: when `ready_for_templates`, action-backed **Open Proposal templates** next step.
- Job Card setup links: Catalog → Templates → ready copy (job + measurement + template + Catalog → frozen draft).
- Builder: loads full catalog for inactive/missing honesty; frozen snapshot helper; stale banner for measurement and/or Catalog economics with real Refresh CTA; no silent mutation.
- Customer Preview: unchanged customer-safe surface (no purchase tax / SKUs / internal cost / contractor stale debug).
- Protected: no supplier sync, material ordering, proposal import, CSV mapping, raw mode, whole rounding, pricing formula changes, send/public/lifecycle.
- Local smoke PASS: Catalog next CTA → Templates readiness/Open Jobs (no Create Proposal) → Job Card setup `ready` → Builder frozen helper + Catalog stale banner + Refresh CTA → Preview clean.
- Live smoke on **`rhquhnujjnzjhweypavd`** (read-only counts): proposals **23** / policies **1** / events **304** / tokens **22** unchanged; linked template items present (**47**); no starter mutation / no new draft created for P1 smoke.

**Next coding block (superseded for density):** see **§6BO.13.4.7** — Templates Workspace Redesign P0 is the immediate next coding block; Integrated Flow P2 remains queued after.

#### 13.4.7 Templates workspace redesign research + plan — COMPLETE (2026-07-17)

**Status:** Research/plan complete at **`0e6ccd1`**. **Templates Workspace Redesign P0 implemented** (contractor-first Overview flow — not accordion-only collapse of the old admin dump).

**Code checkpoint at plan start:** **`c29ff33`** — Integrated Flow P1 setup-to-Builder trust complete.

**Redesign P0 implementation (same section):**

- **Flow:** Library → Overview (use/readiness) → focused edit tabs (Packages & Catalog / Estimate display / Content).
- **First load:** Overview only — no all-options/all-sections/all-Catalog-items dump; one trust note; Open Jobs (no Create Proposal).
- **Packages & Catalog:** compact package cards; expand one option; Edit section to reveal Included Catalog items + add/re-link.
- **Estimate display:** own tab; template defaults + collapsed option overrides.
- **Content:** own tab; one package option open at a time.
- **Preserved:** starter install, Catalog link honesty, estimate toggles, structure reorder/add section, Builder freeze/refresh, Preview safety, pricing formulas unchanged.
- **Local smoke PASS:** Overview first (0 Catalog links mounted) → Packages expand one section → add/re-link controls → Estimate tab → 390px usable.
- **Deferred:** `/templates/[id]` route.
- **Next coding block:** Integrated Flow **P2** — Job Card proposal start / guided creation path.

##### A. Screenshot-driven issue (current FieldDive)

Contractor screenshots + code review of `/tools/roofing/templates` show an admin-density page:

- Extremely long single scroll: library → selected summary → next-actions → **all package options expanded** → **all sections** → **all linked Catalog items** → estimate toggles repeated per option → full content editor by option.
- Template selection competes with deep editing chrome.
- Estimate display settings buried below structure dump.
- Readiness/checklist aside separated from the editing flow; trust/SoT copy repeated in header, locked banners, next-actions, section panels, and footnote.
- First-load fails the contractor questions: which templates exist, which is ready, what needs fixing, how to use for a proposal, where advanced edit lives.

##### B. Current page critique (code)

| Area | Verdict |
|------|---------|
| **Overwhelming** | `TemplatesStructureSettingsShell` maps every option group fully open; each `TemplatesStructureSectionRow` always mounts `TemplatesSectionCatalogItems`; estimate toggles render template-wide **and** once per option; `TemplatesContentEditorShell` dumps all editable prose options below that |
| **Necessary** | Template library select; selected-template identity; readiness + Catalog link health; Job Card next action (no fake Create Proposal); ability to add/re-link Catalog items; section reorder; estimate display toggles; content editor for terms/warranty/text |
| **Move behind tabs / accordions / drawers** | Per-option structure + Catalog item lists; estimate display settings; content/prose editor; long SoT banners (collapse to one short trust line) |
| **Visible on first load** | Compact header; template library; selected overview (options / sections / link health); readiness + next action; CTA into edit modes |
| **Reduce / consolidate** | Merge checklist + next-actions into overview readiness; one Catalog-SoT sentence (drop repeated locked banners/footnote duplication); compact library rows with ready/needs-fix badge |
| **Must remain protected** | `createProposalTemplateItem` / `updateProposalTemplateItem` / section reorder / estimate settings persistence; Catalog as economics SoT (no price edit on template); drafts freeze until Builder refresh; no Create Proposal without Job context; Builder/pricing formulas/Preview untouched |

##### C. Roofr sources reviewed (targeted)

| Source | URL | Used for |
|--------|-----|----------|
| Roofr Help — Create a Proposal Template | https://roofrhelp.zendesk.com/hc/en-us/articles/33413003649943-How-to-create-a-Roofr-Proposal-Template | Templates tab → New template → **Edit Option** → Add item from catalog → Save; estimate settings; left-menu pages |
| Roofr Help — Create a Proposal | https://roofrhelp.zendesk.com/hc/en-us/articles/33558996111511-How-to-create-a-Roofr-Proposal | Job Card → measurement → Use this template; proposal-side estimate settings drawer |
| Roofr Help — Profitability minimums | https://roofr.com/help/how-to-set-profitability-minimums-on-your-proposals | Templates list → select template → Edit option → Profitability Settings panel |
| Roofr Help — Customize proposal (show/hide) | https://roofr.com/help/how-to-show-hide-line-items-totals-quantities-and-unit-pricing-on-a-proposal | Edit Option scoped work; upgrades; not a single flat dump |
| Roofr Academy — Proposal Templates segment | https://academy.roofr.com/lesson-videos/proposal-templates | Templates under Proposals; left-side page nav; Estimate auto-added; multi-option via + under Estimate |
| Roofr Masterclass — Game Changing Proposals | https://roofr.com/masterclass/game-changing-proposals | Estimate settings / multi-select; import option from another template; hide pages for reps |

##### D. Confirmed Roofr template UX findings

1. **Library separated from deep edit:** Proposals → Templates tab → New/select template; deep work happens inside the template editor, not as an endless first-scroll dump of every option’s items.
2. **Option editing is scoped:** **Edit Option** is the primary path to add Catalog items; save finalizes that option — contractors are not asked to stare at every package’s line list at once.
3. **Page / section navigation:** Left-hand menu for Cover / Estimate / additional pages (`+`); Estimate options added via `+` beside Estimate — progressive, not all-open.
4. **Estimate settings are secondary chrome:** Documented as adjust after options (profitability type, show/hide line details, multi-select, financing) — panel/drawer-style placement (right/bottom-right in related docs), not inline under every expanded section.
5. **Template → proposal is Job-driven:** Create proposal from Job Card (measurement → Use this template), not from deep template edit.
6. **Catalog economics stay in Catalog:** “You can not edit catalog item details at the template level.”

##### E. Unconfirmed Roofr behavior

| Topic | Status |
|-------|--------|
| Exact pixel layout of Templates list vs editor (split vs full-screen) | **Unconfirmed** from public help alone |
| Whether Templates list shows readiness badges | **Unconfirmed** |
| Default collapse state of unused options in editor | **Unconfirmed** — Edit Option strongly implies focus mode |
| Whether estimate settings open as modal vs persistent drawer | **Partially confirmed** — settings described as dedicated panel/drawer, not duplicated under every section |
| Exact mobile Templates UX | **Unconfirmed** |

##### F. Chosen FieldDive redesign model

**Hybrid: A + D + E + F (stay on `/tools/roofing/templates` for P0)**

- **A** — Template library first, selected overview second, advanced editor below (not auto-expanded).
- **D** — Tabs inside selected template: **Overview** (default) · **Packages & Catalog** · **Estimate display** · **Content**.
- **E** — In Packages & Catalog: options **collapsed by default**; expand **one option at a time**; sections show counts; expand a section to see/link Catalog items.
- **F** — Split mental model: Overview = “Use / readiness”; other tabs = “Edit”.
- **Defer C** — dedicated `/templates/[id]` editor route **later** (only if same-route tabs prove insufficient).
- **Avoid G as primary** — sticky checklist already duplicates next-actions; fold readiness into Overview; keep aside optional/minimal or remove duplication.

**Decision rule locked:** First view must **not** show every section and every linked item. It must answer: selected template, ready?, options summary, Catalog link health, next action.

##### G. Proposed final page structure

1. **Page header** — Title + one short line (“Company templates for job proposals”). No multi-paragraph SoT essay.
2. **Template library** — Compact rows: name, option count, ready / needs fix badge; select sets overview. Default visible.
3. **Selected template overview (default tab)** — Name/status; counts (options, sections, linked items); link-health summary; primary next action (Fix links / Open Jobs / Open Catalog). Trust: one sentence about Catalog SoT + Job Card create.
4. **Readiness / next action** — Inside Overview only (merge checklist + `TemplatesSetupNextActions`). No Create Proposal button.
5. **Editing model** — Tabs; deep editors idle until opened. Persist selected tab in component state (optional `?tab=` later).
6. **Catalog linking** — Only under Packages & Catalog → expanded option → expanded line_items/upgrade section. Keep picker modal + re-link. Show problem badges on collapsed rows.
7. **Estimate display** — Own tab: template-wide defaults first; per-option overrides in collapsed accordions.
8. **Structure / sections** — Same Packages tab: reorder/add section controls when option expanded; no remove until safe delete approved.
9. **Empty / blocked** — Catalog not ready → prerequisite + Open Catalog; no starter → install hero; link problems → Fix links jumps to Packages tab + problem section.
10. **Narrow viewport** — Stack library → overview; tabs horizontal scroll; expand-one-option rule unchanged; aside checklist collapses into Overview.

##### H. Implementation plan (no code in this block)

| Item | Plan |
|------|------|
| **Likely files** | `TemplatesSetupClient.tsx`, `TemplatesStructureSettingsShell.tsx`, `TemplatesStructureSectionRow.tsx`, `TemplatesSectionCatalogItems.tsx`, `TemplatesContentEditorShell.tsx`, `TemplatesSetupNextActions.tsx`, `TemplatesSetupChecklist.tsx`, `TemplatesSelectedTemplatePanel.tsx`, `TemplatesPageHeader.tsx`, `TemplatesBuilderFootnote.tsx`, `TemplatesWorkspaceLayout.tsx`; possible new `TemplatesSelectedWorkspaceTabs.tsx`, `TemplatesOptionAccordion.tsx` |
| **Split / refactor** | Extract overview card; tab shell; collapse structure shell so Catalog items mount only when section expanded; move estimate toggles out of structure shell into Estimate tab |
| **State** | `activeWorkspaceTab`; `expandedOptionId` (single); `expandedSectionIds` Set or single; keep dirty-content guard on template switch |
| **Tests** | Page-copy: default Overview; no full Catalog list mount markers when collapsed; Fix links opens Packages; no Create Proposal; existing catalog-link + readiness helpers unchanged |
| **Smoke** | Library select → Overview ready/next → Packages expand one option → re-link → Estimate tab toggles → Content tab → Open Jobs; Preview/Builder untouched |
| **Protected** | Pricing engine, snapshot builder, Customer Preview DTOs, send/public/lifecycle, Catalog economics, Job-only create, no migrations |
| **Risks** | Accidental loss of structure actions; dirty-state across tabs; over-collapsing hiding link problems (mitigate badges + Fix links) |
| **`/templates/[id]`** | **Later** — not in Redesign P0 |

##### I. Next coding block (superseded)

See **§6BO.13.4.9** I — Templates Page P2 Quote Setup Review is shipped. Next coding: Integrated Flow P2.

#### 13.4.8 Templates contractor-first flow redesign plan — COMPLETE (2026-07-17)

**Status:** Docs-only flow redesign decision. **No app code, migrations, SQL, package, pricing, Preview, send/public/lifecycle, supplier, material ordering, or proposal import changes in this block.**

**Code checkpoint at plan start:** **`e2df6ac`** — Templates Workspace Redesign P0 (tabs + collapsed packages) shipped.

##### A. Why `e2df6ac` is improved but not excellent

P0 fixed the worst problem (all options/sections/Catalog items dumped on load). The page is shorter and safer.

It is still **not contractor-fast**:

| Critique question | Honest answer |
|-------------------|---------------|
| Does first screen tell what to do next? | **Partially.** Open Jobs exists, but sits among equal-weight edit buttons and tab chrome. |
| Is “Open Jobs…” visually strong enough? | **No.** Same size/weight as “Edit packages & Catalog”, “Estimate display”, “Edit content”. |
| Is Use vs Edit obvious? | **No.** Default shell is still “Template workspace” with Overview as a tab among edit tabs. |
| Does page explain what customer will see? | **No.** No customer-facing package/page/display summary — only contractor counts. |
| Does page explain what template includes without deep edit? | **Weak.** Package chips + link counts; not “Good/Better/Best includes X materials / terms / warranty”. |
| Still feels like admin tooling? | **Yes.** Library card + tab strip + readiness stats = setup console, not outcome page. |
| Are tabs the right mental model? | **Wrong as first chrome.** Tabs hide depth but keep the *editor* identity. |
| Should default be readiness/preview/use? | **Yes.** |
| Should advanced editing go behind “Edit template”? | **Yes.** |
| What would feel premium + contractor-fast? | Outcome hero: Ready / Not ready → one primary CTA → “what this creates” → issues → quiet Edit entry. |

**Verdict:** P0 was a necessary density cut. It did **not** change the product story from “admin workspace” to “prepare → use from Job”.

##### B. Targeted Roofr / public findings (flow separation)

Sources: Create Proposal Template help; Create Proposal help; Academy “Proposal Templates” + “Creating Proposals from Job Cards”.

| Confirmed | Unconfirmed |
|-----------|-------------|
| Templates live under Proposals → Templates; deep work is **Edit Option** / page editor | Exact Templates list visual density / readiness badges |
| Proposal create is **Job Card → measurement → Use this template** (recommended) | Whether Templates list shows “ready” status |
| Template editing and proposal creation are **separate intents** | Pixel-perfect first screen of Templates list |
| Estimate/display settings are secondary editor chrome | Public screenshots of a “use summary” vs editor landing |

**FieldDive judgment (where public evidence is thin):** Contractors spend most days creating proposals from jobs, not editing templates. Templates page must default to **readiness + outcome**, not editor tabs.

##### C. Design options

**Option A — Same route, stronger Overview (keep tabs)**  
First: library + Overview tab. Primary CTA: Open Jobs. Edit via sibling tabs.  
Pros: smallest delta from `e2df6ac`. Cons: still tab-as-identity; Use/Edit blur. Risk: polish without flow change. **Not recommended as end state.**

**Option B — Use-first page + Edit mode (same route)** ★ **RECOMMENDED**  
First: library + **Use surface** (no tab strip). Primary: Open Jobs / Fix issues. Secondary: **Edit template** enters edit mode (packages / display / content as task list or secondary nav).  
Pros: clear mental model; keeps route; reuses editors; matches Job-Card create truth. Cons: needs mode state + CTA hierarchy work. Risk: weak Edit entry hides legit setup. Mitigate: issues CTA → Edit packages.  

**Option C — Library + dedicated detail/editor route**  
First: list/readiness only. Select → `/templates/[id]` detail (use default) then edit.  
Pros: cleanest separation. Cons: routing, selection state, dirty guards; more scope. Risk: delays Integrated Flow P2. **Later** if B saturates.

##### D. Recommended final flow (Option B)

**1. Page model:** `/tools/roofing/templates` with `mode: use | edit`. Default `use`. No tab strip on Use surface.

**2. Text-screen wireframe (text):**

```
Proposal templates
Prepare reusable proposal packages. Create proposals from a Job Card.

┌ Library (compact) ──────────────────────────────┐
│ ● Roof Replacement Starter     Ready            │
│   3 packages · Catalog links healthy            │
└─────────────────────────────────────────────────┘

┌ SELECTED — Roof Replacement Starter ─ READY ────┐
│ This template builds a multi-package roof       │
│ proposal from your Catalog + job measurement.   │
│                                                 │
│  [ Open Jobs to create a proposal ]  ← PRIMARY  │
│  Fix issues (only if not ready)                 │
│                                                 │
│ What this creates                               │
│  Packages: Standard · Enhanced · Premium        │
│  Includes: materials/labor links, terms,        │
│            warranty, cover/estimate pages       │
│  Customer sees: package choice + estimate       │
│            display per template settings        │
│                                                 │
│ Issues (if any)                                 │
│  • 2 Catalog links need attention  [Fix]        │
│                                                 │
│ ──────── advanced ────────                      │
│  Edit template →                                │
└─────────────────────────────────────────────────┘
```

Edit mode (after “Edit template”):

```
← Done editing                          [Ready]
Edit: Packages & Catalog | Customer display | Content pages
… focused editors (reuse P0 packages/estimate/content) …
```

**3. CTA hierarchy**  
1) Open Jobs to create a proposal (ready) **or** Fix Catalog links / Open Catalog (blocked)  
2) Edit template  
3) Quiet trust one-liner  

**4. Library:** Compact selector; Ready / Needs attention; select resets to Use mode.

**5. Readiness:** Hero badge + one sentence outcome; issues list with action → Edit packages (or Catalog).

**6. What this includes:** Package names; Catalog link health; pages/prose present (terms/warranty/etc.) — outcome language, not sort_order metadata.

**7. Customer-facing summary:** Short “Customer will see…” from estimate display defaults + package list — **not** a full Preview route; no fake live proposal.

**8. Advanced edit entry:** Single **Edit template** control; not three equal Overview buttons + always-visible tabs.

**9. Packages/Catalog edit:** Inside Edit mode only (P0 Packages tab behavior).

**10. Content edit:** Inside Edit mode only.

**11. Mobile:** Stack library → hero → primary CTA → includes → Edit. Edit mode = stacked task chooser.

**12. Remove from first load:** Tab strip; equal-weight edit CTAs; “Template workspace” editor framing; repeated SoT essays; admin stats without outcome story.

**13. Keep accessible:** Starter install; Catalog prerequisite; add/re-link; estimate toggles; content save; readiness helpers; Job-only create; Builder freeze truth.

**14. Why better than `e2df6ac`:** Changes product identity from **editor-with-overview-tab** to **use-surface-with-edit-mode**; makes next action obvious in seconds; keeps Job Card as create start.

##### E. Implementation plan (no code in this block)

| Item | Plan |
|------|------|
| **Likely files** | `TemplatesSetupClient.tsx`, `TemplatesSelectedWorkspace.tsx`, `TemplatesOverviewPanel.tsx`, `TemplatesPageHeader.tsx`, `templatesWorkspaceFlow.ts`; new `TemplatesUseSurface.tsx`, `TemplatesEditModeShell.tsx`, `TemplatesIncludesSummary.tsx` (pure summary helpers ok) |
| **Refactor** | Stop rendering tablist in Use mode; Overview becomes Use surface; Packages/Estimate/Content only in Edit mode |
| **Retire / demote** | Tab-as-primary IA; equal Overview edit buttons; sticky checklist if still unused |
| **Route** | Same route + `mode` state (optional `?mode=edit` later). **No `/templates/[id]` in P1** |
| **Tests** | Use mode default; no tablist on first load; primary Open Jobs; Edit template reveals editors; no Create Proposal; Catalog link + estimate + content still wired; Preview/pricing unchanged |
| **Smoke** | First screen Use-only → Open Jobs visible → Edit template → Packages/Estimate/Content → Done editing → Use; 390px; Preview still clean |
| **Protected** | Pricing formulas, snapshots, Preview DTOs, send/public/lifecycle, Catalog SoT, Job-only create, no migrations |
| **Risks** | Edit mode discoverability; dirty content when leaving Edit; overselling “customer will see” without a real preview — keep summary honest |

##### F. Next coding block (plan-era; superseded by G)

Was: Templates Flow Redesign P1. **P1 shipped — see G.** Next: Integrated Flow P2.

##### G. Templates Flow Redesign P1 — IMPLEMENTED (2026-07-17)

**Status:** App UI flow only. **No migrations, SQL, package, pricing formula, Customer Preview, send/public/lifecycle, supplier, material ordering, proposal import, CSV mapping, raw mode, or whole-rounding changes.**

**Plan checkpoint:** **`409e2f4`**. **Prior UI:** **`e2df6ac`** (Overview tab + always-visible edit tab strip).

| Topic | What shipped |
|-------|----------------|
| **Default mode** | `mode: use` — library + Use surface (readiness hero, outcome, issues). **No primary tab strip on first load.** |
| **Primary CTA** | Ready → **Open Jobs to create a proposal**; issues → **Fix Catalog links** / **Add Catalog items** / Catalog setup. **No fake Create Proposal.** |
| **What this creates** | Package labels, linked Catalog count, customer-facing areas, customer-sees line from estimate display settings |
| **Edit mode** | Quiet **Edit template** → intentional edit shell (“Editing {name}”) + **Back to template summary**; Packages & Catalog / Customer display / Content as edit tools only |
| **vs `e2df6ac`** | Removed Overview-as-tab + first-load tab chrome; Use/Edit mental model; demoted equal-weight edit buttons |
| **Preserved** | Starter install/recheck; selection; Catalog add/re-link; linked/inactive/missing; readiness helpers; estimate toggles; content/prose save; Builder freeze / Preview safety; Job Card as create start |
| **Behavior boundaries** | Unchanged: pricing formulas, snapshots, Preview DTOs, send/public/lifecycle, supplier/material/import |

**Key files:** `TemplatesUseSurface.tsx`, `TemplatesSelectedWorkspace.tsx`, `TemplatesSetupClient.tsx`, `templatesWorkspaceFlow.ts`, `TemplatesPageHeader.tsx`, `TemplatesEstimateDisplayTab.tsx` (Customer display label). Removed unused `TemplatesOverviewPanel.tsx`.

**Next recommended block (superseded):** Was Integrated Flow P2. **Templates page still not contractor-simple — see §6BO.13.4.9.** Next coding: **Templates Page Redesign P2**.

#### 13.4.9 Proposal Templates page contractor-first redesign plan — COMPLETE (2026-07-17)

**Status:** Docs-only redesign plan. **No app code, migrations, SQL, package, pricing, Preview, send/public/lifecycle, supplier, material ordering, CSV mapping, Job Card, or Builder changes in this block.**

**Code checkpoint at plan start:** **`97c12e5`** — Templates Flow Redesign P1 (Use-first / Edit-mode) shipped.

##### A. Contractor workflow (quote after measurement)

Scenario: measurements are done; contractor wants a simple roof replacement quote.

| Step | Contractor intent |
|------|-------------------|
| 1 | Pick the right company proposal template |
| 2 | Confirm package options (e.g. Standard / Enhanced / Premium) |
| 3 | Confirm key customer pages (terms, warranty, estimate) exist |
| 4 | Quick add if something is missing (e.g. Permit fee) |
| 5 | Quick remove if something does not belong on this template |
| 6 | Quick replace if the wrong Catalog item is linked |
| 7 | Leave Catalog economics and pricing math alone |
| 8 | Continue to quote from a Job Card (not “create proposal” on Templates) |

**1. What the contractor cares about**
- Which template to use for this kind of job
- What the quote will include (packages + key line items + terms/warranty)
- Whether anything important is missing or broken
- Fast Add / Remove / Replace of included items
- Clear Ready vs Needs attention
- How to keep moving toward the quote (Job Card)

**2. What they do not care about on this page**
- Internal section kinds, sort_order, protection reasons
- Template graph / “structure editor” framing
- Catalog cost/margin editing
- Pricing engine formulas, tax math, waste models
- Repeated source-of-truth lectures
- Admin metadata (seed keys, `catalog_item_id`, option IDs)

**3. Hide from first view**
- Full package → section → item tree
- Section add/move/remove chrome
- Customer display toggles dump
- Content/prose editor
- Onboarding/install zone when starter is already healthy (collapse)
- Equal-weight “Edit template” as the only path to change inclusions

**4. One click away**
- Select another template
- Add item / Remove from template / Replace item on the included list
- Fix broken links
- Continue to Jobs (Job Card create path)
- Expand a package’s included items list

**5. Deeper editing only**
- Customer display (what customers see on estimate)
- Terms / warranty / text content authoring
- Section structure (add section types, reorder sections)
- Starter install / Catalog prerequisite when company setup is incomplete

##### B. Honest critique of `97c12e5` (current page)

P1 correctly removed first-load tabs and added readiness + “What this creates.” It is **still too close to an admin template console**.

| Question | Honest answer |
|----------|---------------|
| Does quoting feel faster? | **No.** Primary path still leaves Templates to Jobs; the common mid-visit job (tweak inclusions) is buried under **Edit template → Packages → Expand → Edit section**. |
| Does selected view feel like “what this quote includes”? | **Partially.** Counts and package names exist; **no scannable included-items list** on the use surface. |
| Is Add / Remove / Replace obvious? | **No.** Add exists only deep in edit mode. Relabel is **Change catalog link** (technical). **Remove from template does not exist** (store has create/update item only; section Remove blocked). |
| Still centered on internal structure? | **Yes** once Edit opens — same collapsed structure editor, not an inclusions manager. |
| First-time contractor confusion | “Template library” + setup/onboarding above; “Edit template” opens structure language; no Remove; Open Jobs vs inventing Create Proposal. |
| Simplest powerful version | Template picker + **Included in this quote** list with Add/Remove/Replace + Ready CTA + Advanced tucked away. |

**Verdict:** Do **not** preserve the current display by tucking the same structure page into Edit mode. Redesign around **inclusions management**, not template-database browsing.

##### C. Three layout options (text wireframes)

###### OPTION A — Template cards + quote-ready summary

```
Proposal templates
Templates for the quotes you send from Jobs.

┌ Template cards ─────────────────────────────────┐
│ [Roof replacement ● Ready]  [Other…]            │
└─────────────────────────────────────────────────┘

┌ Roof replacement — Ready ───────────────────────┐
│ Packages: Standard · Enhanced · Premium         │
│ Includes: Terms · Warranty · Estimate           │
│ 46 items linked                                 │
│                                                 │
│ [ Continue from Job Card ]  ← PRIMARY           │
│ [ Manage included items ]                       │
│ Advanced: Customer display · Content            │
└─────────────────────────────────────────────────┘
```

| | |
|--|--|
| **Primary CTA** | Continue from Job Card / Open Jobs |
| **Secondary CTA** | Manage included items |
| **Add** | Opens manage → Add item modal |
| **Remove** | Inside manage list |
| **Replace** | Inside manage list |
| **Customer display / Content** | Advanced links |
| **Hidden** | Structure tree; section chrome |
| **Pros** | Clear ready state; low first-load noise |
| **Cons** | Inclusions still one step away; easy to skip manage |
| **Risk** | Becomes another summary-only page (like P1) |
| **Faster?** | Somewhat — only if Manage is obvious |

###### OPTION B — Template selector + “Included in this quote” manager ★

```
Proposal templates
Choose a template, confirm what is included, then quote from a Job.

┌ Your templates ─────────────────────────────────┐
│ ● Roof replacement          Ready               │
│   Other template            Needs attention     │
└─────────────────────────────────────────────────┘

┌ Included in this quote — Roof replacement ──────┐
│ Ready to use                                    │
│ Packages: Standard · Enhanced · Premium         │
│                                                 │
│ Package: [ Standard ▼ ]                         │
│ Included items                                  │
│  Architectural shingles          [Replace] [✕]  │
│  …                                              │
│  Permit / administrative fee     [Replace] [✕]  │
│  [ + Add item ]                                 │
│                                                 │
│ Also includes: Terms · Warranty · Estimate text │
│                                                 │
│ [ Open Jobs to create a proposal ] ← PRIMARY    │
│ Advanced ▸ Customer display · Edit content      │
│            · Template structure                 │
└─────────────────────────────────────────────────┘
```

| | |
|--|--|
| **Primary CTA** | Open Jobs to create a proposal (or Fix when not ready) |
| **Secondary CTA** | Add item (always visible on included list) |
| **Add** | Modal: search active Catalog → Add to selected package/section |
| **Remove** | Row action “Remove from template” (confirm; Catalog untouched) |
| **Replace** | Modal: pick different active Catalog item; keep slot |
| **Customer display / Content** | Advanced disclosure |
| **Hidden** | Section reorder/add; sort_order; SoT essays; structure dump |
| **Pros** | Matches contractor mental model; quick edits on default surface |
| **Cons** | Need package switcher; must ship Remove store path |
| **Risk** | List noise if all packages dump at once — mitigate with package filter |
| **Faster?** | **Yes** — see + change inclusions without Edit mode maze |

###### OPTION C — Guided template review

```
Step 1 Choose → Step 2 Review includes → Step 3 Quick edits → Step 4 Ready
(single page progress, not a multi-route wizard)
```

| | |
|--|--|
| **Primary CTA** | Next / Ready → Open Jobs |
| **Secondary** | Skip to edits |
| **Add/Remove/Replace** | Step 3 only |
| **Advanced** | After Ready or footer |
| **Pros** | Teaching path for first-time users |
| **Cons** | Extra friction for daily users; feels productized/wizard |
| **Risk** | Contractors hate forced steps |
| **Faster?** | First visit yes; day-to-day **no** |

##### D. Selected model

**Recommend OPTION B — Template selector + Included-in-this-quote manager.**

Why (not “easiest to build”):
- Simplest contractor story: pick → see included → tweak → go to Job
- Fastest path to the actual mid-page job (Add/Remove/Replace)
- Least confusion vs structure editor + “Change catalog link”
- Long-term quality: Templates page becomes **quote composition**, not DB admin
- Preserves Catalog SoT, Job-only create, Builder freeze — only changes **presentation + remove capability**

Why better than `97c12e5`:
- P1 Use surface answers readiness but **not inclusions**
- P1 Edit mode reuses the **same structure UI** (wrong product identity)
- B puts inclusions on the default surface; structure/content/display become Advanced

**Defer Option C** as optional first-run coach later. **Borrow from A:** strong Ready badge + Open Jobs primary.

##### E. Quick edit flow (Add / Remove / Replace) — critical

**Surface:** Default-page **Included items** list (package-scoped). Not buried in Edit → Packages → section.

**Chrome:** Prefer **modal** (reuse/evolve Catalog picker) over drawer for Add/Replace; Remove is **inline row + short confirm**.

| Action | Label | Behavior |
|--------|-------|----------|
| Add | **Add item** | Modal; search active Catalog; pick package (default current); add to default line-items section; exclude already-included ids |
| Remove | **Remove from template** | Confirm: “Remove from this template? The Catalog item stays in your Catalog.” Deletes **template item row only** |
| Replace | **Replace item** | Modal (relink); keeps section/position; swap Catalog link |

**Empty state:** “No items in this package yet. Add item to include Catalog lines on quotes.”

**Confirmations:** Remove requires confirm. Add/Replace: no confirm after pick (immediate). Never imply Catalog delete.

**Mobile:** Full-screen modal for Add/Replace; row actions stack; package selector sticky.

**Copy rules:** Prefer Add item / Remove from template / Replace item / Included items. Avoid `catalog_item_id`, “Change catalog link”, repeated SoT under every row (one quiet note in Advanced or modal footer max).

**Gap vs today:** Add + Replace(=relink) exist deep in edit UI. **Remove-from-template is missing** — coding block must add store delete for template items (no Catalog delete; no migration if RLS already allows delete).

##### F. Final recommended wireframe (build from this)

```
Proposal templates
Choose a template, confirm what it includes, then create the quote from a Job Card.

┌ YOUR TEMPLATES (compact) ───────────────────────┐
│ ● Roof replacement     Ready      3 packages    │
│   Smoke template       Needs attention          │
└─────────────────────────────────────────────────┘

┌ ROOF REPLACEMENT                    Ready to use ┐
│ This quote template includes the packages and   │
│ Catalog items below. Pricing stays in Catalog.  │
│                                                 │
│ Packages: Standard · Enhanced · Premium         │
│ Customer pages: Estimate · Terms · Warranty     │
│                                                 │
│ Viewing package: [ Standard ▼ ]                 │
│                                                 │
│ Included items                    [ + Add item ]│
│ ┌─────────────────────────────────────────────┐ │
│ │ Architectural shingles     Linked           │ │
│ │                    [Replace] [Remove]       │ │
│ │ Permit / administrative fee Linked          │ │
│ │                    [Replace] [Remove]       │ │
│ │ …                                           │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Issues (if any): 2 items need attention [Fix]   │
│                                                 │
│ [ Open Jobs to create a proposal ]  ← PRIMARY   │
│                                                 │
│ Advanced ▸                                      │
│   Customer display settings                     │
│   Edit terms / warranty / content               │
│   Template structure (sections)                 │
│                                                 │
│ Quiet note: Catalog prices; drafts stay frozen  │
│ until refreshed in Builder.                     │
└─────────────────────────────────────────────────┘

Setup (collapsed when healthy): Catalog ready · Starter installed
```

**Mobile (~390px):** Templates list → selected header/status → primary CTA → package selector → Included items → Advanced. Modals full-bleed.

##### G. Implementation plan (plan only — do not implement here)

| Item | Plan |
|------|------|
| **Likely files** | `TemplatesSetupClient.tsx`, `TemplatesUseSurface.tsx` → refactor/replace with Included manager; `TemplatesSectionCatalogItems.tsx` / picker modal; `TemplatesPackagesCatalogTab.tsx` demoted to Advanced; `proposalTemplateStore.ts` (+ delete item); `proposalTemplateCatalogLink.ts` labels; `templatesWorkspaceFlow.ts`; page header/library copy |
| **Create** | `TemplatesIncludedManager.tsx` (or equivalent); package filter; Remove confirm; Rename Replace labels |
| **Refactor** | Default surface = selector + included list + CTAs; stop requiring Edit mode for Add/Remove/Replace |
| **Demote / retire** | Structure-first Packages tab as default edit path; “Change catalog link” label; Use surface that only shows counts; loud onboarding when healthy |
| **Tests** | Default shows Included items; Add/Remove/Replace labels; Remove does not delete Catalog; no Create Proposal; Advanced hides structure; readiness CTAs; existing link/readiness/Builder trust/Preview suites still pass |
| **Smoke** | Select template → see items → Add → Remove → Replace → Open Jobs primary → Advanced customer display/content → 390px; no supplier/import |
| **Protected** | Pricing formulas, snapshots, Preview DTOs, send/public/lifecycle, Job-only create, Catalog economics, no migrations/SQL/packages unless delete blocked by RLS (investigate first; prefer no migration) |
| **Risks** | Remove semantics (drafts already snapshotted stay frozen — honest); long item lists (package filter + collapse); contractors editing company template mid-day (expected; copy that changes apply to future quotes) |
| **Next coding prompt** | **Templates Page Redesign P2 — implement Option B Included manager + Add/Remove/Replace** on `/tools/roofing/templates` per §6BO.13.4.9 |

##### H. Next coding block (plan-era; superseded by I)

Was: Templates Page Redesign P2. **P2 shipped — see I.** Next: Integrated Flow P2.

##### I. Templates Page P2 — Quote Setup Review — IMPLEMENTED (2026-07-17)

**Status:** App UI + store delete helper only. **No migrations, SQL, package, pricing formula, Customer Preview, send/public/lifecycle, supplier, material ordering, proposal import, CSV mapping, raw mode, or whole-rounding changes.** RLS already allowed `proposal_template_items` DELETE (company-scoped).

**Plan checkpoint:** **`1a63aff`** / **§6BO.13.4.9**. **Prior UI:** **`97c12e5`** Use-first / Edit-mode.

| Topic | What shipped |
|-------|----------------|
| **Default model** | **Quote Setup Review** — library + selected hero + package selector + Included items manager |
| **Hero** | Name, Ready/Needs attention, counts, What this includes, Use from Job Card, one trust note |
| **Package selector** | One package at a time (Standard / Enhanced / Premium); drives included list |
| **Included items** | Name, type/unit/visibility, Replace item, Remove from template; empty: “No items included here yet. Add from Catalog.” |
| **Add item** | Modal picker (active Catalog only); section chooser when multiple targets; duplicates blocked |
| **Replace item** | Relink picker; preserves section/position; contractor label (not “Change catalog link”) |
| **Remove from template** | Confirm modal; `deleteProposalTemplateItem` — template row only; Catalog untouched |
| **Advanced settings** | Secondary: Edit sections / Customer display / Content, warranty & terms |
| **Preserved** | Starter install; readiness; linked/inactive/missing; estimate/content editors; Builder freeze / Preview safety; Job Card create start |
| **Behavior boundaries** | Unchanged pricing/snapshots/Preview/lifecycle/supplier/material/import |

**Key files:** `TemplatesQuoteSetupReview.tsx`, `TemplatesIncludedItemsManager.tsx`, `TemplatesRemoveItemConfirmModal.tsx`, `TemplatesAddItemSectionChooser.tsx`, `TemplatesSelectedWorkspace.tsx`, `TemplatesSetupClient.tsx`, `proposalTemplateStore.ts` (`deleteProposalTemplateItem`), `proposalTemplateCatalogLink.ts` (labels).

**Next recommended block:** ~~Integrated Flow P2~~ → **DONE** (see **§6BO.13.4.9** K). Next: Builder handoff / e2e smoke polish, then Preview truth / Send readiness when approved.

##### J. Templates Page P2B — visual tightening — IMPLEMENTED (2026-07-17)

**Status:** Layout/copy polish only on Quote Setup Review. **No model change. No migrations/SQL/package/pricing/Preview/lifecycle/supplier changes.**

| Change | Detail |
|--------|--------|
| **Setup** | When Catalog ready + starter installed → compact **Setup complete** strip with Recheck; full onboarding only when incomplete |
| **Library** | Compact rows; shorter label “Templates”; less vertical weight |
| **Hero + package** | Single card: name/status, compact includes, CTAs, package selector nested |
| **Included items** | Immediately under hero/package card |
| **Copy** | One trust note at bottom; CTA “Open Jobs to create a proposal”; Advanced quieter |
| **Preserved** | Add / Replace / Remove; Advanced settings; readiness; Job Card create start |

**Next:** Integrated Flow **P2** Job Card proposal start — **DONE** (see Integrated Flow P2 section below).

##### K. Integrated Flow P2 — Job Card Compact Proposal Setup Card — IMPLEMENTED (2026-07-17)

**Status:** Job Card Proposals tab is now a job-specific proposal setup flow. **No migrations/SQL/package/pricing formula/Preview redesign/lifecycle/supplier changes.**

| Area | Detail |
|------|--------|
| **Primary UI** | Compact **Proposal setup** card: Measurement → Template → Package → Included summary → Create/Open |
| **Create meaning** | Explainer: draft from this job’s measurements + selected template + Catalog pricing; review in Builder before sending |
| **Happy path** | Stay on Job Card; do **not** route to Templates when ready |
| **Package** | Simple package selector; selected option passed as `selected_template_option_id` on create |
| **Included** | Compact summary + expand Review included items (read-only); Fix template with return context |
| **Draft path** | Existing `resolveOrCreateProposalDraftEntry` / `createDraftProposal` reuse; no duplicate drafts |
| **Builder** | Opens with job+proposal; **Back to Job Card** returns to `tab=proposals` |
| **Fix escapes** | Templates/Catalog links use `returnTo` + optional `returnLabel` (“Return to {job} · Proposals”) |
| **Demoted** | Status checklist console + Catalog setup “Review templates” happy-path links |

**Key files:** `JobCardProposalSetupCard.tsx`, `JobCardProposalIncludedReview.tsx`, `jobCardProposalSetup.ts`, `JobCardProposalsSetupLinks.tsx`, `RoofingClient.tsx`, `proposalDraftEntry.ts`, `proposalSetupChecklist.ts`, `proposalBuilderReadiness.ts`, `ProposalBuilderPageHeader.tsx`, `TemplatesAppPage.tsx`, `CatalogAppPage.tsx`.

**What remains unbuilt:** Job-side Add/Replace/Remove (deferred); full multi-draft list.

**Next recommended block:** See **L** correction — then e2e smoke/polish / Preview truth when approved.

##### L. Integrated Flow P2 correction — wiring, CTA, premium display — IMPLEMENTED (2026-07-17)

**Status:** Correction pass on Job Card Proposals → Builder handoff. **No migrations/SQL/package/pricing formula/Preview redesign/lifecycle/supplier changes.**

| Issue | Root cause / fix |
|-------|------------------|
| Builder “Proposal templates not ready” after Create | Builder shell required live company `deriveProposalTemplateReadiness === ready_for_builder` even when a valid job-scoped draft graph was loaded. Draft source template can fail starter-structure checks (e.g. options/linked-item counts) while the frozen draft is openable. **Fix:** `hasValidPersistedDraft` waives company catalog/template gates in `deriveProposalBuilderReadiness`. Setup-preview (no draft) still blocks honestly. |
| Duplicate Create buttons | Section `headerAction` CTA + card CTA (+ list Open). **Fix:** one primary CTA inside setup card only; list is status-only. |
| Create vs Open label drift | UI used only `jobs.active_proposal_id`; reuse found listed drafts when active id unset. **Fix:** Job Card also lists job drafts for Open label / checklist. |
| Premium display | Status/checklist feel. **Fix:** polished setup card with Ready/Blocked headline, compact step tiles, package pills, single CTA zone. |

**Smoke (local + live via app on `rhquhnujjnzjhweypavd`):** Babby D job `c9497cc1-…` / proposal `61356e56-…` — Builder opens Draft • Saved without false template blocker; Back to Job Card → `tab=proposals`; reuse same proposal id (no duplicate); draft left connected.

**Next recommended block:** ~~End-to-end smoke/polish~~ → **DONE as Builder Handoff Polish A** (see **M**).

##### M. Builder Handoff Polish A — draft-aware Job Card + shared identity — IMPLEMENTED (2026-07-17)

**Status:** Cognitive handoff fix after P2 correction. **No migrations/SQL/package/pricing formula/Customer Preview document redesign/lifecycle enablement/supplier/material/CSV/raw/whole-rounding.**

**Root cause of mismatch:** Job Card create selectors showed the live company template/package (e.g. Roof replacement / Standard) while **Open** reused an existing frozen draft from a different source (Babby: title `Coverage basis live smoke…`, template RAW_PLUS_WASTE complete-source smoke, package **Complete-source smoke option**). Builder also led with `job_name`/address while Job Card led with customer name.

**Draft-aware Job Card:**
- **No draft:** create mode — Measurement → Template → Package → Included → **Create proposal draft**
- **Draft exists:** draft-open mode — draft status/title/source template/package/updated; frozen note; **Open proposal draft**; **no** template/package selectors implying mutation; no “Start new draft” (not supported)

**Shared identity decision:** `resolveJobIdentityDisplay` — **customer name primary**, **address secondary**. Applied to Job Card setup “For …”, Builder header, Preview chrome header, return labels.

**Builder entry hierarchy (light):**
- Compact status: “Next: use Preview…”
- Frozen snapshot helper demoted (smaller/quieter)
- Next action prefers **Open Preview** when Preview is available
- Guardrail “Blocked” softens to “Needs review” / “Does not block Preview…” when Preview is ready

**Status vocabulary:** Draft ready to open / Ready to create draft / Needs attention / Draft saved / Review in Builder (aligned Proposals tab chip + card + list).

**Smoke (local + live via app on `rhquhnujjnzjhweypavd`):** Babby D `c9497cc1-…` / proposal `61356e56-…` — draft-open mode shows Complete-source smoke option (not Standard picker); Open → same proposal; Builder + Preview identity **Babby D** / address secondary; Back → Proposals; no false templates-not-ready; no send/public/lifecycle; draft left connected.

**Next recommended block:** ~~Builder package selection truth~~ → **DONE** (see **N**).

##### N. Builder package selection truth / Change package UX — IMPLEMENTED (2026-07-17)

**Status:** Draft-option scoped Builder package picker + one-option UX. **No migrations/SQL/package files/pricing formula/Customer Preview redesign/lifecycle/supplier/material/CSV/raw/whole-rounding. No “Start new draft.” No live-template option import into existing drafts.**

**Product rule (locked):**
- Pre-draft: package selection on Job Card Proposals tab
- Post-draft: package changes in Builder among **saved draft options only**
- Builder must not silently pull live Template options unless an explicit rebuild/refresh creates them

**Root cause:** Package selector UI listed `starterGraph.options` (live template by draft `template_id`). Persist path already required draft runtime option via `resolveRuntimeOptionIdFromTemplateOptionId` → `updateDraftSelectedOption`, but the picker could advertise live-only packages and still offered **Change package** on one-option drafts.

**Implementation:**
- `proposalBuilderDraftPackageOptions` — `scopeTemplateGraphToDraftPackageOptions` intersects live labels with draft `proposal_options`; drops live-only; synthesizes draft-only rows when needed
- Builder Client wires `packageSelectorGraph` + `draftScopedPackagePicker` into Canvas → EstimateDocument → PackageZone → PackageSelector
- One option: hide **Change package**; show “Only one package exists on this draft.”; no one-option radio picker
- Multi option: **Change package** shows draft options only; switch persists `selected_option_id`
- Job Card draft-open: optional note “Package changes happen in Builder for this draft.”

**Audit side effect:** R18D3B Email Smoke draft `368dcbf1-…` was left on **Enhanced** (acceptable for smoke; no revert).

**Smoke (local app on `rhquhnujjnzjhweypavd`):**
- Babby `c9497cc1-…` / `61356e56-…`: selected **Complete-source smoke option**; note “Only one package exists on this draft.”; **no** Change package; Job Card draft-open shows draft package + “Package changes happen in Builder for this draft.”; no create package selector
- Multi-option `9cd2c4ac-…` / `368dcbf1-…`: Change package → Standard / Enhanced / Premium only; switched Standard → Preview showed Standard; **reverted to Enhanced** (audit leave-as)
- No send/public/lifecycle/supplier/material/CSV actions

**Next recommended block:** ~~Job Card create flow restore~~ → **DONE** (see **O**).

##### O. Job Card Proposals create flow restore + existing draft handling — IMPLEMENTED (2026-07-17)

**Status:** Existing draft no longer blocks create-new. Force-create path adds a distinct draft. **No migrations/SQL/package files/pricing formula/Customer Preview redesign/lifecycle/supplier/material/CSV/raw/whole-rounding. No full proposal management system.**

**Root cause:** Draft-aware Job Card overcorrected — `hasExistingDraft` hid create selectors; `resolveOrCreateProposalDraftEntry` always reused active/listed draft. Contractors with a wrong smoke draft (Babby) were trapped.

**Architecture decision:**
- Keep `resolveOrCreateProposalDraftEntry` for **Open existing** (reuse)
- Add `createNewProposalDraftEntry` for **Create new** — always calls `createDraftProposal` (sets `jobs.active_proposal_id` to the new id; never reuses)
- Store already supports many proposals per job; UI now exposes force-create

**Job Card Proposals UI:**
- **Existing draft** card — title, package, status, updated, Open in Builder (no live selectors mutating that draft)
- **Create another proposal** card — template/package/included + “This creates a separate draft. Existing drafts are not changed.”
- Bottom list can show multiple drafts with Open; Current marks active

**Builder package rule preserved:** Job Card chooses package before create; Builder switches among draft options after; one-option drafts still hide Change package.

**Smoke (Babby D on `rhquhnujjnzjhweypavd`):** Proposals tab `open_and_create` — existing smoke draft card + create-another with Roof replacement Standard/Enhanced/Premium; multi-draft list shows prior drafts including `61356e56-…` as Current; force-create API covered by unit tests. Live create click optional / deferred after UI verify; no send/lifecycle.

**Follow-on polish (committed `190ad66`):** Compact Current proposal + Start proposal zones; softened smoke titles via `formatContractorProposalTitle` → “Saved proposal”; older drafts collapsed behind “Show older drafts (N)”. Still not Flow V1 end-state (see **P**).

**Next recommended block:** ~~Builder visual cohesion / Preview truth~~ → **superseded** by locked Flow V1 roadmap (**P**). Next coding: **Block 1** smoke isolation.

##### P. Proposal Flow V1 + Template Flow V1 + app surface standards — DOCS LOCKED (Block 0) (2026-07-20)

**Status:** Docs-only product lock. **No app code, tests, migrations, SQL, package files, pricing formulas, Customer Preview redesign, send/public/lifecycle/PDF/sign/payment, supplier sync, material ordering, proposal import, CSV mapping assistant, raw mode switch, or whole rounding in this block.**

**Code checkpoint at lock:** **`190ad66`** (Job Card Proposals polish). Prior capability: **`40c1fe8`** force-create; **`05131f6`** draft-scoped Builder packages.

**Research / mapping basis:** Roofr-aligned contractor OS surface standards vs FieldDive current Proposals / Templates / Builder / Preview (Ask-mode mapping, 2026-07-20). Verdict: capability largely right; drift is **surface standards**, especially Proposals tab always-open setup/archive feel.

---

###### P.1 Product spine (unchanged)

**Catalog → Templates → Job Card → Builder → Customer Preview**

- **Catalog** = company item library (SoT for item economics)
- **Templates** = company setup (reusable quote shapes; not job proposal start)
- **Job Card → Proposals** = job-specific proposal start
- **Builder** = estimate / package / document workbench for a draft
- **Customer Preview** = contractor view of customer-facing document (authenticated; not public send)

---

###### P.2 Proposal Flow V1 (locked target)

**Happy path:**

1. Job Card → **Proposals** tab
2. Blue **+ Proposal** (primary create CTA)
3. Create modal / sheet: measurement (required gate) → template → package → included summary → **Continue to Builder**
4. Builder: estimate workbench; package change among **draft options only** (rule from **N** preserved)
5. **Preview** from Builder (dirty-edit guard preserved)
6. **Send later** — not in Flow V1 coding scope unless separately approved

**Proposals tab surface standard (locked):**

| Element | Rule |
|---------|------|
| Default view | Compact proposal **rows** (current + recent), not always-open setup cards / archive admin |
| Primary CTA | Blue **+ Proposal** |
| Open existing | Row action → Builder (reuse `resolveOrCreate` / open existing) |
| Create new | **+ Proposal** → modal → force-create (`createNewProposalDraftEntry`) → Builder |
| Older drafts | Collapsed / secondary; not the first impression |
| Smoke / internal | Hidden from normal contractor view (Block 1); **do not delete** |

**Not Proposal Flow V1:** full proposal management system; always-visible dual setup cards as the long-term IA; Templates page as job proposal start; live-template option import into existing drafts.

---

###### P.3 Template Flow V1 (locked target)

**Templates page = company setup**, not job proposal start.

**Role boundary (locked):**
- **Job Card → + Proposal** creates job-specific proposals.
- **Templates → + Template** creates reusable company setup.
- Templates should **not** feel like a giant admin workbook, raw database editor, or job-specific proposal creation page.

| Element | Rule |
|---------|------|
| Primary CTA | Blue **+ Template** (create / guided setup) |
| Default library | Compact template library **rows/cards** (not an always-expanded workbook) |
| Row/card shows | Template name; package model summary; linked catalog item count; readiness status; last updated; **Edit** action |
| Default use | Review readiness, packages, included items; open Jobs when ready to start a job proposal elsewhere |
| Edit | Explicit edit / continue guided setup for structure, packages, catalog links, content, estimate display |
| Proposal start | **Never** from Templates as the job create path — that stays Job Card → Proposals |

**+ Template guided flow (locked target):**

1. **Template basics**
   - name
   - trade/type
   - short description if useful

2. **Package model**
   Contractor chooses:
   - no packages / simple offer
   - single package
   - multiple packages

   Roofing baseline may default to:
   - Standard
   - Enhanced
   - Premium

   **Do not** force packages for every template.

3. **Define packages/options**
   - package names
   - customer-facing descriptions
   - internal notes secondary only

4. **Add included catalog items**
   - searchable catalog item picker
   - item name, type, measurement/quantity source, customer visibility
   - **do not** expose supplier SKU / internal cost as primary setup

5. **Proposal content/pages**
   - cover/page defaults
   - terms
   - warranty
   - customer estimate settings
   - optional upgrades if supported

6. **Review & save**
   - template name
   - package model
   - package count
   - linked item count
   - page/content readiness
   - **Save template**

Templates Page P2 / Quote Setup Review work remains valid company-setup UX foundation; Flow V1 locks the guided setup target and role boundary vs Proposals.

---

###### P.4 App-wide contractor OS surface standards (locked)

1. **One job per surface** — Proposals start proposals; Templates manage templates; Catalog manages items; Builder edits the draft document; Preview shows customer view.
2. **Compact command rows over always-open admin cards** on job operational tabs (Proposals first).
3. **Blue primary create** for the main “add” action on that surface (**+ Proposal**, **+ Template**, Catalog add patterns as already established).
4. **Setup vs run** — company setup (Catalog/Templates/Settings) vs job run (Job Card → Builder → Preview).
5. **Smoke / internal artifacts stay in DB** but must not dominate contractor UI (Block 1).
6. **Do not fake lifecycle** — no sent status, board moves, public links, PDF/sign/payment unless separately approved.

---

###### P.5 Smoke / internal proposal policy (locked)

- Keep smoke and internal proposals/templates in the database for engineering validation.
- **Do not delete** smoke drafts (e.g. Babby `61356e56-…`, R18 email smoke `368dcbf1-…`) as part of UI cleanup.
- **Hide** them from the normal contractor Proposals list / titles (Block 1 implementation).
- Softened titles (“Saved proposal”) from `190ad66` are interim; isolation is the durable policy.

---

###### P.6 Builder and Preview roles (locked)

| Surface | Role in Flow V1 |
|---------|-----------------|
| **Builder** | Estimate / package (draft options only) / document pages workbench. Entry from Job Card open or **+ Proposal** continue. Not a template editor. Not send orchestration. |
| **Customer Preview** | Authenticated contractor preview of customer document. Document-first truth polish may follow after Flow V1 handoff (Block 5). **Not** public/tokenized access, PDF, Sign, Payment, or Send orchestration in Blocks 0–4. |

Package rule from **N** remains law: pre-draft package on create modal; post-draft package changes in Builder among saved draft options only.

---

###### P.7 Implementation blocks (locked order)

| Block | Name | Scope |
|-------|------|--------|
| **0** | Docs lock | This section (**P**). Done when committed after review. |
| **1** | Smoke / internal isolation | Hide smoke/internal proposals (and titles) from normal contractor Proposals UI; do not delete. |
| **2** | Proposals tab reset | Compact rows + blue **+ Proposal**; remove always-open setup/archive-first feel. |
| **3** | + Proposal modal | Measurement → template → package → included → Continue to Builder; force-create path. |
| **4** | Builder handoff | Open / create land cleanly in Builder; draft package truth preserved; back to Job Card Proposals. |
| **5** | Preview truth | Document-first Preview polish only when Blocks 1–4 stable; no send/public/lifecycle. |
| **6** | Template Flow V1 | Templates page setup clarity (**+ Template**); not job proposal start. |
| **7** | App-wide polish | Remaining contractor OS surface consistency (Jobs/Catalog/Settings as needed). |

**Do not skip Block 1.** **Do not start Block 5+ until Blocks 1–4 approved.**

---

###### P.8 Protected systems (still blocked unless separately approved)

- Pricing formulas / engines
- Customer Preview full redesign beyond Block 5 polish scope
- Send / public route / lifecycle / PDF / Sign / Payment
- Supplier sync / material ordering / proposal import
- CSV mapping assistant / raw mode switch / whole rounding
- Migrations / SQL / package file changes
- Live-template option import / rebuild into existing drafts
- Full proposal management / archive product

**R18D3D** remains blocked per §6BO.11 / §6BO.13.

---

###### P.9 Explicitly out of Block 0

- Any `app/` or test file edits
- Any SQL / migration / package edits
- Any UI implementation of Blocks 1–7
- Commit of this docs lock until user reviews

**Next recommended block:** ~~Block 1 smoke isolation~~ → **DONE** (see **Q**).

##### Q. Block 1 — smoke / internal proposal + template isolation — IMPLEMENTED (2026-07-20)

**Status:** Hide-not-delete isolation for known smoke/internal fixtures on normal contractor Job Card Proposals surfaces. **No migrations/SQL/package files/pricing formulas/quantity math/snapshot trust/Customer Preview redesign/send/public/lifecycle/PDF/sign/payment/supplier/material/CSV/raw/whole-rounding. No Proposals tab reset. No + Proposal modal. No Templates page layout redesign. No Builder/Preview layout changes. No deletion of live smoke records.**

**Code checkpoint:** **`aee0546`** (Block 1); prior polish **`190ad66`**; docs lock **`61d3bc5`**.

**Root cause:** Job Card listed all job drafts and all company templates. Active job pointer often pointed at smoke drafts (Babby: “Coverage basis live smoke…”, template **RAW_PLUS_WASTE**, package **Complete-source smoke option**). Prior polish only softened titles to “Saved proposal” — records still dominated the contractor UI. No durable `is_internal` metadata on proposals/templates.

**Helper (centralized):** `app/lib/contractorFixtureIsolation.ts`
- Conservative known-fixture text markers only (case-insensitive): `coverage basis live smoke`, `raw_plus_waste` / `raw plus waste`, `complete-source smoke`, `s3d13`, `smoke 2026`, `controlled live smoke`, `minimal complete-source live smoke`
- **Does not** broad-match bare `test` / `sample` / `demo` / `smoke`
- `classifyContractorFixtureText` → `{ isInternalFixture, reason }`
- `filterContractorVisibleProposals` / `filterContractorVisibleTemplates` / `pickContractorVisibleJobDraft`
- No DB mutate; classification only

**Proposal view isolation (Job Card):**
- `listProposalsForJob` results filtered before `listedJobDraftSummaries` / current draft / older drafts
- Current proposal never driven by an internal fixture when only smoke exists (UI shows create-ready instead)
- If active_proposal_id is smoke but a real draft exists, prefer the real draft for contractor current surface
- Soft title fallback retained but unused on main path when fixtures are hidden

**Template picker isolation (Job Card create):**
- Create/start template picker + default template id use contractor-visible templates only
- **Roof replacement** remains selectable; **RAW_PLUS_WASTE** and matching fixture names excluded from picker
- Full company template list still loaded for draft template-name lookup; Templates page library not redesigned (Block 6 / Template Flow V1)

**Direct engineering smoke access preserved:**
- Direct Builder URL with smoke `proposal=` still loads (Babby `61356e56-…` verified)
- Direct Preview URL unchanged
- Store/list APIs unchanged — filtering is UI-layer for normal Job Card contractor views
- Test fixtures remain usable

**Smoke (local app on `rhquhnujjnzjhweypavd`, Babby D `c9497cc1-…`):**
- Proposals tab: no Coverage basis / RAW_PLUS_WASTE / Complete-source as normal contractor current draft; status **Ready to create draft**; template **Roof replacement**; packages Standard / Enhanced / Premium
- Direct Builder `proposal=61356e56-…`: still loads; package **Complete-source smoke option**; one-option note; no fake Change package
- No send/public/lifecycle/supplier/material/CSV actions
- Live project = same approved ref (no SQL; no record deletes)

**Out of this block:** Proposals tab compact-row reset (**Block 2**); + Proposal modal (**Block 3**); Builder handoff polish (**Block 4**); Preview truth (**Block 5**); Template Flow V1 UI (**Block 6**).

**Next recommended block:** ~~Block 2 Proposals tab reset~~ → **DONE** (see **R**).

##### R. Block 2 — Proposals tab reset (compact document/action surface) — IMPLEMENTED (2026-07-20)

**Status:** Job Card Proposals tab reset to Flow V1 surface: compact proposal rows + blue **+ Proposal**. **No + Proposal modal/step flow (Block 3). No always-open measurement/template/package setup card. No Builder/Preview/Templates/Catalog redesign. No migrations/SQL/package/pricing/quantity/snapshot/send/public/lifecycle/PDF/sign/payment/supplier/material/CSV/raw/whole-rounding. No deletion of smoke records.**

**Code checkpoint:** **`c979e3a`** (Block 2); prior Block 1 **`aee0546`**.

**What was removed as default UI:**
- Always-open Current proposal / Start proposal setup cards
- “Create proposal draft” / “Create another proposal” / “Open saved proposal”
- “Draft ready · can create another” status chip
- Older-drafts archive-first list
- Source template / debug fields on the tab
- Black primary create buttons

**New surface:**
- Header: **Proposals** + subtitle + blue **+ Proposal** (`bg-blue-600`)
- Rows: title · package · status · updated · **Open** (Builder by id; does not create)
- Empty (Babby smoke-only after Block 1): **No proposals yet** + measurement report copy + blue **Create proposal**
- **+ Proposal** / Create proposal → Block 2 placeholder only (“measurement → template → package”); **does not create drafts**
- Block 1 `filterContractorVisibleProposals` preserved — smoke-only → empty state
- Direct Builder smoke URL still loads

**Files:** `JobCardProposalsTab.tsx`, `jobCardProposalsTabModel.ts` (+ tests); `RoofingClient` Proposals panel rewired. Old `JobCardProposalSetupCard` retained in repo for Block 3 reuse, not mounted.

**Smoke (Babby D on `rhquhnujjnzjhweypavd`):** empty state + blue + Proposal; placeholder on click; no setup card; no smoke titles; direct Builder `61356e56-…` still loads. No send/lifecycle.

**Next recommended block:** see **R.1** follow-up, then **Block 3**.

###### R.1 Block 2 follow-up — Job Card status/activity visible-proposal truth — IMPLEMENTED (2026-07-20)

**Status:** Hidden smoke/internal drafts no longer drive Job Card metadata strip or activity rail. **No + Proposal modal. No Proposals tab redesign. No Builder/Preview/Templates/Catalog changes. No migrations/SQL/package/pricing/quantity/snapshot/send/public/lifecycle. No smoke deletes.**

**Root cause:**
1. `buildJobCardDisplayModel` hardcoding `proposalLabel: "Proposal Draft"` for DB Job Card (null estimate path)
2. `resolveJobCardProposalActivityLine` treating setup-ready (`readiness.ready`) as “Proposal Builder ready” without checking contractor-visible proposal count

**Fix:**
- `formatJobCardContractorProposalStatusLabel` — 0 visible → **Ready to create proposal**; visible draft → **Proposal Draft**
- Activity: `hasVisibleContractorProposal` — false → **Ready for proposal** + measurement-report note; true → **Proposal Builder ready**
- Left nav: `entryMode === "job-card"` → `activeNav="jobs"` (was only board-context jobs; DB job cards wrongly highlighted New job)

**Smoke (Babby D):** strip Ready to create proposal; activity Ready for proposal; Proposals empty + blue + Proposal; direct Builder smoke URL unchanged.

**Next recommended block:** **Block 3 — + Proposal modal flow** (measurement → template → package → Continue to Builder).

###### S. Block 3 — + Proposal modal / Create proposal step flow — IMPLEMENTED (2026-07-20)

**Code checkpoint:** **`ed8a140`**

**Status:** Job Card **+ Proposal** opens a focused **Create proposal** modal/sheet: Measurement → Template → Package → Review → **Continue to Builder**. **No Proposals tab shell redesign. No Builder/Preview/Templates/Catalog redesign. No pricing/quantity/snapshot formula changes. No send/public/lifecycle/PDF/sign/payment. No migrations/SQL/package files. No supplier/material/CSV/raw/whole-rounding. No smoke deletes.**

**Behavior:**
- Modal title **Create proposal**; steps Use this measurement → Use this template → choose package → **Continue to Builder**
- Ready measurement shown contractor-readable; no ready measurement blocks Continue
- Contractor-visible templates only (Block 1 isolation); Roof replacement shown; RAW_PLUS_WASTE / smoke templates hidden
- Package step shows Standard / Enhanced / Premium for Roof replacement; selection preserved into create payload
- Continue uses **`createNewProposalDraftEntry`** (force-create distinct draft) — does **not** reuse hidden smoke via `resolveOrCreate`
- Navigates to Builder `job=<id>&proposal=<new id>`; selected package matches modal; Back to Job Card → Proposals tab shows new compact row
- Closing modal / changing package before Continue does **not** create

**Files:** `JobCardCreateProposalModal.tsx`, `jobCardCreateProposalModalModel.ts` (+ tests); `JobCardProposalsTab.tsx` (placeholder removed); `RoofingClient` Proposals panel wires modal + force-create.

**Smoke (Babby D on `rhquhnujjnzjhweypavd`):** created proposal **`0fff78ea-b482-4d2d-8363-edfd5f4fe0c4`** (Enhanced); Builder selected package Enhanced; Change package present; return shows Enhanced package · Draft row; smoke id **`61356e56-…`** still loads by direct URL; smoke/internal rows remain hidden.

**Next recommended block:** see **S.1** follow-up, then **Block 4**.

###### S.1 Block 3 follow-up — + Proposal modal contractor clarity polish — IMPLEMENTED (2026-07-20)

**Code checkpoint:** **`e8c6218`**

**Status:** Modal copy/hierarchy refined into a premium contractor confirmation flow. **No Proposals tab shell redesign. No Builder/Preview/Templates/Catalog redesign. No pricing/quantity/snapshot/send/lifecycle/migrations/SQL/package changes. No smoke deletes.**

**Multi-measurement finding:**
- DB/store can hold multiple `measurement_records` per job (`getMeasurementsForJob`); selection via `is_selected` / `getSelectedMeasurementForJob`
- Job Card Measurements UI typically maintains one selected/saved report; create path historically used that single selected record
- Modal now loads ready measurements on open: **one** → polished preselected card; **multiple ready** → selectable cards; create still uses the chosen record id
- Future: Measurements UI may create more multi-report cases; modal is ready

**Copy / hierarchy:**
- Measurement: guide + `Saved manual report` / `2,500 sq ft · 10% waste · Report complete` (no adj SQ packing)
- Template: structure narrative + **Ready to use**; quiet secondary `N pricing items ready · N package options` (not “linked catalog items”)
- Package: starting-package guidance + change-later-in-Builder note; card layout with descriptions when present; one-package message when applicable
- Review: **Ready to build proposal** + Measurement / Proposal / Starting package / Included in proposal; quiet pricing-items secondary
- Rows: `Roof replacement — Enhanced` title + `Draft · Updated …` meta for package distinction

**Smoke:** created **`4f409c73-d4fc-4190-a056-ee2b659ca046`** (Enhanced); Builder package Enhanced; return rows package-distinguished; no protected systems touched.

**Next recommended block:** see **S.2** final polish, then **Block 4**.

###### S.2 Block 3 final polish — status, activity, review, rows — IMPLEMENTED (2026-07-20)

**Code checkpoint:** **`287bca8`**

**Status:** Finished Proposals tab + + Proposal modal to contractor-premium standard before Block 4. **No Builder/Preview redesign. No pricing/math/snapshot/send/lifecycle. No SQL/migrations/packages.**

**Fixes:**
- Activity: **Proposal created** + `{Package} proposal ready to review` (not “Proposal Builder ready”)
- Status strip: **Draft proposal** / **Latest: Enhanced draft** (not generic “Proposal Draft”)
- Review: narrative confirmation (measurement → proposal → starting package → Includes) — not field list
- Rows: package emphasized in blue after em dash; quiet bordered Open
- Template/package modal copy retained from S.1

**Smoke:** created **`3c4fd16c-eb34-42e7-9f70-7366455eceb8`** (Enhanced); strip Latest: Enhanced draft; activity Proposal created; Builder Enhanced.

**Next recommended block:** see **S.3** copy/visual correction, then **Block 4**.

###### S.3 Block 3 final copy / visual correction — IMPLEMENTED (2026-07-20)

**Code checkpoint:** **`5e07530`**

**Status:** Contractor-facing copy + package row/card polish before Block 4. **No Builder/Preview redesign. No Templates/Catalog. No pricing/math/snapshot/send/lifecycle. No SQL/migrations/packages. No smoke deletion.**

**Fixes:**
- Template: **customer-facing sections** (not “customer proposal pages”); quiet secondary `N pricing items · N packages`
- Review: **Proposal includes** → `Estimate · Package details · Terms · Warranty · Customer-facing sections` (not “Package options” / “customer proposal pages”)
- Rows: template title + slate **package badge** (not link-blue text); compact Open
- Package step: selected card = blue border + soft blue bg + Selected badge (not solid-blue fill); primary CTA stays solid blue
- Activity confirmed: **Proposal created** / **Enhanced proposal ready to review** (never “Proposal Builder ready”)

**Smoke:** created **`466e393c-63cf-42b5-9c6c-88a7524f6145`** (Enhanced); Builder SELECTED PACKAGE Enhanced; strip Latest: Enhanced draft; activity Proposal created / Enhanced proposal ready to review; rows slate package badges.

**Next recommended block:** see **T** Block 4, then **Block 5**.

###### T. Block 4 — Builder estimate review simplification + handoff — IMPLEMENTED (2026-07-20)

**Code checkpoint:** **`2ae400b`**

**Status:** Builder first Estimate viewport aligns with + Proposal → Continue to Builder. **No Preview redesign. No Templates/Catalog. No pricing/math/snapshot/send/lifecycle. No SQL/migrations/packages. No smoke deletion.**

**Fixes:**
- Left nav: Builder highlights **Jobs** (not Proposal templates). Preview may still use templates key — remaining shell note.
- Handoff identity: job + address + `{title} proposal · {package} package` + quiet **Draft** badge; Back to Job Card; Preview forward
- One primary next step: contractor **Next step** / quantities language (guidance ids unchanged)
- Proposal assistant rail; **Details collapsed by default** (no table-first readiness chrome); Needs review (not Guardrail blocked)
- Package: starting package for this **proposal**; no signing / customer-choice note
- Included estimate visual anchor; compact secondary quantity review; **Set quantity** primary; quiet Remove from proposal
- No **Hide from customer** on estimate review path / Edit Option visibility UI (persistence kept)
- Optional upgrades / totals contractor copy

**Smoke:** Babby Enhanced **`466e393c-…`** — Jobs active; handoff Roof replacement · Enhanced; Details closed; 7 Set quantity; no Hide/signing/Guardrail blocked; Back to Job Card.

**Next recommended block:** see **T.1** document-led continuation, then **Block 5** after approval.

###### T.1 Block 4B — Builder document-led continuation — IMPLEMENTED (2026-07-20)

**Code checkpoint:** **`ea39fa7`** — `polish(proposals): make builder document-led`

**Status:** Builder first experience is a proposal document editor (Estimate active), not a bulky workbench console. **No Preview redesign. No pricing/math/snapshot/send/lifecycle. No SQL/migrations/packages.**

**Fixes:**
- Left **proposal section nav** (Cover / Estimate Active / Terms …) replaces horizontal page strip as primary structure
- Centered document canvas; **right Proposal assistant rail removed** from Estimate path (next-step lives once on Estimate)
- Preview primary; Send/Sign/Payment under quiet **More**
- No yellow first-viewport status banner for drafts; snapshot note under collapsed **Snapshot details**
- Compact package; Display as collapsed control below estimate; Included estimate anchor; compact quantity review
- Remove-from-proposal not repeated as primary on included/quantity rows

**Smoke:** Babby **`466e393c-…`** — section nav Estimate Active; one Needs review card; Included + Set quantity; no rail duplicate; Preview primary.

**Next recommended block:** see **T.2** visual continuity correction, then **Block 5** after approval.

###### T.2 Block 4C — Builder visual continuity correction — IMPLEMENTED (2026-07-20)

**Code checkpoint:** **`d8125ec`** — `polish(proposals): refine builder visual continuity`

**Status:** Builder feels continuous with Job Card → + Proposal → Continue to Builder — balanced width, attached rail/canvas, document-like Estimate. **No Preview redesign. No pricing/math/snapshot/send/lifecycle. No SQL/migrations/packages.**

**Fixes:**
- Header: **Roof replacement proposal** primary; Babby D · address; **Enhanced package · Draft**; removed Proposal Workspace; Preview/More aligned to stage
- **Saved pricing details** under More (no primary Snapshot details)
- Attached workspace shell (`data-builder-workspace-shell`) — section rail + Estimate canvas share one border
- Compact **Needs review:** strip; package description + bullets + Change package
- Included estimate table (Item / Qty / Price); no Roof replacement scope nesting; Details hidden
- **Finish estimate** quantity section; Optional upgrades single heading; clean Totals copy

**Smoke:** Babby **`466e393c-…`** — proposal title primary; attached shell; Included estimate anchor; Finish estimate + Set quantity; package context; Preview aligned.

**Next recommended block:** see **T.3** action clarity, then **Block 5** after approval.

###### T.3 Block 4D — Builder action clarity + estimate editing — IMPLEMENTED (2026-07-20)

**Code checkpoint:** set in header after commit (`polish(proposals): clarify builder estimate actions`)

**Status:** Builder actions match contractor intent — Review / Set quantity / Edit package separated. **No Preview redesign. No pricing/math/snapshot/send/lifecycle. No SQL/migrations/packages.**

**Phase 1 trace (handlers):**
1. Review quantities → `focusFinishEstimate` (scroll `#builder-finish-estimate`) — **not** Edit package drawer
2. Set quantity → `openSetQuantityForLine` → `ProposalBuilderWorkbenchSetQuantityPanel`
3. Edit package → `openEditPackage` → `ProposalBuilderWorkbenchEditOptionShell`
4. Manual quantity persistence: `handleApplyManualQuantity` → `applyManualQuantityScopeDecision` (reusable from item panel)
5. Remove: existing `excludeLineFromProposalOption` via included-row More menu
6. Optional upgrade include/replace: **not supported** in current scope decisions — collapsed UI only; Set quantity when needs_quantity

**Fixes:**
- Review quantities guides to **Finish estimate**
- Set quantity = focused item panel (no package-scope list); same save path + refresh
- **Edit package** opens advanced drawer titled **Edit Enhanced package** (no Package Scope / Edit option primary copy)
- Included estimate **⋯** menu: Remove from proposal + View details
- Optional upgrades **collapsed by default** (3 available)
- Slight rail width tighten (10.75rem)

**Follow-up (not this block):** optional upgrade Add to proposal / include-replace when scope-decision support exists.

**Smoke:** Babby **`466e393c-…`** — Review scrolls Finish estimate; Set quantity Starter panel only; save 12 LF → 6 remaining; Edit Enhanced package drawer; More → Remove; upgrades collapsed.

**Next recommended block:** **Block 5 — Preview document-first** (only after this surface is approved).

#### 13.4.6 Integrated Catalog → Proposal workflow research + FieldDive flow design — COMPLETE (2026-07-17)

**Status:** Docs-only research + design lock. **No app code, migrations, SQL, package, pricing, Preview, send/public/lifecycle, supplier API, material ordering, or proposal import changes in this block.**

**Code checkpoint at research start:** **`09c458e`** — Catalog management foundation + UX completion pass complete.

##### A. Research sources reviewed (public)

| Source | URL / location | Used for |
|--------|----------------|----------|
| Roofr Help — Create a Catalog | https://roofrhelp.zendesk.com/hc/en-us/articles/33257762983831-How-to-create-a-Roofr-Catalog | Catalog role; manual / Jumpstart / CSV; waste & tax on items |
| Roofr Help — Format CSV for catalog upload | https://roofrhelp.zendesk.com/hc/en-us/articles/33478981922327-How-to-format-your-CSV-for-catalog-upload | Exact headers; UUID create/update; SKU + purchase tax columns |
| Roofr Help — Create a Proposal Template | https://roofrhelp.zendesk.com/hc/en-us/articles/33413003649943-How-to-create-a-Roofr-Proposal-Template | Catalog → template “Add item from catalog”; no catalog edits on template |
| Roofr Help — Create a Proposal | https://roofrhelp.zendesk.com/hc/en-us/articles/33558996111511-How-to-create-a-Roofr-Proposal | Job card → measurement → template → auto quantities |
| Roofr Help — Create a Material Order | https://roofrhelp.zendesk.com/hc/en-us/articles/31586645578391-How-to-Create-a-Material-Order | Order from won proposal; Job Card material orders tab |
| Roofr Help — Connect supplier items on material order | https://roofrhelp.zendesk.com/hc/en-us/articles/32876461628183-How-to-connect-supplier-items-from-your-Roofr-material-order | Supplier mapping at order stage |
| Roofr Help — ABC Supply end-to-end | https://roofrhelp.zendesk.com/hc/en-us/articles/31668818815255-Integrating-ABC-Supply-An-end-to-end-guide | Jumpstart + SKU CSV + proposal supplier settings + order |
| Roofr Help — Import from supplier history | https://roofrhelp.zendesk.com/hc/en-us/articles/39771832726039-How-to-import-items-from-supplier-history | Alternate catalog populate path (supplier history) |
| Roofr Help — Profitability minimums | https://roofr.com/help/how-to-set-profitability-minimums-on-your-proposals | Template-level margin/markup defaults |
| Roofr Help — Show/hide line details | https://roofr.com/help/how-to-show-hide-line-items-totals-quantities-and-unit-pricing-on-a-proposal | Estimate display toggles (qty/unit price/totals) |
| Roofr blog — Digital proposals / templates | https://roofr.com/blog/digital-roof-proposals , https://roofr.com/blog/benefits-of-roof-proposal-templates | High-level measurement → proposal → order narrative |
| Roofr Masterclass — Building Your Catalog | https://roofr.com/masterclass/building-your-catalog | Jumpstart + CSV template practice (transcript) |
| Roofr Masterclass — Multi-option proposals | https://roofr.com/masterclass/multi-option-proposals | Hide line items; catalog mapping narrative (transcript) |
| FieldDive codebase (this repo) | Catalog / Templates / Builder / Preview / Job Card / pricing+snapshot libs | Current FieldDive truth path |

##### B. Confirmed Roofr workflow findings

1. **Catalog is the item library for proposals and material orders** — materials, labor, and other resources live in Catalog; they appear on proposals and can feed material orders (Create a Catalog help).
2. **Contractor setup order is Catalog → Templates → Proposals from Job** — templates require catalog items first; proposal create is from a job with a measurement report, then template selection (Create Proposal / Create Template help).
3. **Templates link catalog items; they do not re-edit catalog economics** — “Add item from catalog”; “You can not edit catalog item details at the template level” (Create Template help).
4. **Proposal compile automates quantities from measurement + catalog/template mapping** — Roofr combines report measurements with material amounts from catalog items and template (Create Proposal help).
5. **Customer-facing simplicity is controlled by estimate display settings** — show/hide line item details (subtotals, quantity, unit prices) at template and proposal estimate settings (Create Template / Customize proposal help).
6. **Sales tax vs purchase tax are distinct on catalog items** — sales tax = tax customer pays; material purchase tax = tax paid when purchasing materials (Create a Catalog help). CSV columns include `TAX_RATE` and `PURCHASE_TAX` (CSV format help).
7. **Supplier SKUs are storage columns on CSV** — `ABC_SKU`, `BEACON_SKU` (QXO), `SRS_SKU` (CSV format help). Connecting live supplier pricing is a separate integration flow (ABC guide / supplier history import).
8. **CSV import is template-strict** — column headers must remain as provided; do not rearrange/remove; Name required; other columns optional but still present; empty UUID = create, present UUID = update (CSV format + Create Catalog help). Public docs describe **no interactive column-mapping UI** for arbitrary supplier CSVs.
9. **Jumpstart / roofing-system import** is a first-class onboarding path separate from blank CSV (Create Catalog + masterclass + ABC guide).
10. **Material orders come after a won proposal (or from scratch / template)** — “Create material order” from won proposal populates materials; Job Card has Material orders tab (Material Order help). Supplier item connect can happen at order stage (Connect supplier items help).
11. **Reorder / bulk / drag-drop** — FieldDive already mirrors Roofr-like Catalog command surface; Roofr DnD specifics for catalog reorder are **not** fully documented in the public pages reviewed (treat UI mechanics as partially unconfirmed).

##### C. Unconfirmed / not fully documented in public sources

| Topic | Status |
|-------|--------|
| Interactive CSV column-mapping for arbitrary supplier spreadsheet headers | **Unconfirmed / appears absent** — public docs insist on exact Roofr template headers |
| Whether catalog price edits auto-refresh open proposals without user action | **Unconfirmed** from public help |
| Exact “hide entire line item from customer” vs “hide qty/unit price only” product model | **Partially confirmed** — display toggles confirmed; per-line hide exists in masterclass narrative but exact UI contract not fully pinned in help pages fetched |
| Full list of CSV columns / validation edge cases for missing enums | **Partially confirmed** — Name required; UUID rules confirmed; full validation matrix not re-audited live |
| Whether purchase tax ever appears on customer proposal surfaces | **Unconfirmed in public docs**; FieldDive treats purchase tax as internal-only (keep) |
| Drag-and-drop reorder of catalog rows | **Unconfirmed** in public help (FieldDive uses button reorder foundation) |
| Proposal import of external PDF/estimates into catalog/template | **Out of scope / not confirmed** as Roofr primary path |

##### D. Current FieldDive spine (as implemented)

```
Setup (company):
  Catalog (/tools/roofing/catalog)
    → Templates (/tools/roofing/templates) [catalog readiness gate]
Daily work:
  Job Board (/tools/roofing/saved)
    → Job Card (job=) — checklist gates
    → Create/Open draft (Job Card only)
    → Builder (?job=&proposal=) — snapshot display; refresh re-prices from live catalog
    → Contractor Customer Preview (?job=&proposal=)
Future:
  Job Card Material Orders tab (stub) ← proposal lines + catalog SKUs/qty
```

| Stage | Current truth |
|-------|----------------|
| **Catalog** | Company SoT for item economics, measurement mapping, coverage/waste/basis, item tax capture, supplier SKU storage, CSV v1, selection/bulk/reorder |
| **Templates** | Structure + `catalog_item_id` links (install resolves `catalog_seed_key` → id). **No price overrides** on template items. Prerequisite banner when catalog not ready. **No first-class “Add item from catalog” picker UI** (Planned bulk/copy only) |
| **Draft create** | Job Card → `createDraftProposal`: template graph + **live** catalog + measurement + policy → pricing engine → snapshots |
| **Builder** | With `proposal=`: reads **snapshots**. Refresh reloads live catalog + template + measurement and rewrites snapshots. Without `proposal=`: live starter preview only (cannot create DB draft) |
| **Preview** | Customer-safe pages/lines; omits unit cost, profit, purchase tax, supplier SKUs; company policy sales tax drives totals; catalog item tax rates **not** wired into line tax |
| **Material orders** | Job Card stub + Catalog Planned bulk “Add to proposal / material order”; SKUs stored for future |

##### E. FieldDive integrated flow map (target long-term)

**1. Catalog source-of-truth role**

Belongs in Catalog:
- Item identity (name, type, unit, active/sort)
- Economics (unit cost/price, pricing basis, labor cost)
- Quantity drivers (measurement source, coverage, coverage basis, waste)
- Customer presentation defaults (customer name/description, proposal visibility)
- Tax capture (sales tax rate capture; purchase tax internal)
- Supplier SKU storage (ABC/QXO/SRS) — **not** live sync
- CSV maintenance of the above

Does **not** belong in Catalog:
- Per-job quantities / selected package choices
- Proposal page copy / branding / tokens
- Customer document assembly
- Send/lifecycle/payment
- Live supplier auth/pricing sync (separate integration stage)
- Material order logistics (branch, delivery, PO) — order surface later

**2. Template integration**

- Templates compose **which catalog items** appear in which option/section and estimate display settings.
- Templates must **reference** `catalog_item_id` (and may retain seed keys for install defaults) — **never duplicate** unit price/cost/tax/SKU as competing SoT.
- Target UX (Roofr-aligned): **Add item from catalog** in template option editor; cannot edit catalog economics on the template.
- FieldDive starter install already resolves seed→id; durable gap is contractor **picker + unlink/replace** without reinstall.

**3. Proposal Builder integration**

- Draft create/refresh pulls: template structure + **live CatalogItem** economics/drivers + measurement + company pricing policy.
- Builder with persisted `proposal=` displays **snapshots** (stable contractor document); refresh is the intentional re-sync from live catalog.
- Visibility/tax/coverage truth:
  - Visibility: catalog default → proposal line display status (existing snapshot path)
  - Coverage/waste: apply per company waste model (default adjusted ignores catalog coverage; raw remains gated — **no Settings switch yet**)
  - Sales tax: company policy remains authoritative for proposal totals until an approved item-line-tax stage
  - Purchase tax / SKUs: internal; available to future ordering/cost views — never customer canvas

**4. Customer Preview integration**

Customer sees: branded pages, customer-facing names/descriptions, allowed line presentation, option totals/tax per estimate display policy.
Customer never sees: unit cost, purchase tax, supplier SKUs, internal margin/profit, catalog-only internal fields.
Contractor Preview remains the trust gate before public send (R18 path unchanged by this research).

**5. Material ordering future integration**

Natural join (Roofr-aligned):
- Input: won/selected proposal option lines (`catalog_item_id`, quantity, unit) + Catalog SKUs + purchase tax + supplier connection
- Surface: Job Card Material Orders (already stubbed) — **not** Catalog page as the order editor
- Catalog’s job beforehand: durable SKUs + internal cost/purchase tax + correct quantities via proposal math
- Do **not** invent ordering until Catalog→Template→Proposal quantity/SKU trust is solid

**6. CSV / import integration**

- **Now (v1):** Strict FieldDive CSV headers (`catalogCsv.ts`) — exact column order; blank `id` = create; id = company-scoped update; preview then import; SKUs persist; no sync.
- **Future (P2):** Behind-the-scenes **CSV mapping/import assistant** for non-matching uploads:
  - Detect uploaded headers
  - Map columns → FieldDive fields
  - Preview unmatched / ignored columns
  - Save reusable mappings (incl. supplier-specific shapes later)
  - Keep strict FieldDive CSV as the clean baseline export/template
- **Do not build mapping yet.** Jumpstart/supplier-priced starter remains Planned (separate from Install starter catalog).

**7. Job page / main workflow integration**

- Catalog stays a **Setup** workspace; Job Card links when readiness fails (`JobCardProposalsSetupLinks`).
- Daily path: Job Board → Job Card → Create proposal → Builder → Preview.
- Catalog must not become a job editor; Job Card must not become a catalog editor.
- Material Orders tab later consumes proposal readiness — already the correct stub location.

**8. Contractor-simple flow (target)**

1. Setup Catalog (starter install and/or CSV / future Jumpstart) — price + map measurements + coverage/waste as needed
2. Setup Templates (add/confirm catalog items on options; estimate display)
3. Open Job → ensure measurement → Create proposal from template
4. Review/adjust in Builder → Preview as customer
5. Later: send/sign (R18+) → Create material order from won proposal

Roofr keeps this simple by: forcing Catalog-before-Template, automating qty from measurement mapping, hiding internal cost/tax complexity from the customer document, and deferring supplier connect to catalog/order stages—not the first proposal click.

##### F. Gap analysis (current vs desired)

| ID | Priority | Current | Desired | Areas | Risk | Stage | Code now? |
|----|----------|---------|---------|-------|------|-------|-----------|
| G1 | **P0** | No first-class Template “Add item from catalog” / re-link UI; install-only seed resolution | Contractor can add/replace catalog items on template options without reinstall | `templates/*`, `proposalTemplateStore.ts` | Medium — structure edits | Integrated Flow P0 | **Later (next coding block)** |
| G2 | **P0** | Stale Templates footnote: Builder “later stage” | Accurate Job Card → Builder copy | `TemplatesBuilderFootnote.tsx` | Low | P0 | Later |
| G3 | **P0** | Catalog price/driver edits do not signal draft staleness (measurement-focused only) | Honest refresh guidance when catalog economics change (or documented refresh expectation) | `proposalStaleness.ts`, Builder helper | Medium — trust | P0/P1 | Later |
| G4 | **P1** | Catalog item sales tax stored but mapper sets `tax: null`; company policy tax only | Clear product rule + eventual line-tax stage **or** honest “capture only” everywhere | `proposalPricingInputMapper.ts`, Catalog copy | High if faked | Future / tax stage | **Not now** |
| G5 | **P1** | Planned bulk “Add to template / proposal / order” | Wire only after template picker + proposal attach contracts exist | `catalogBulkActions.ts` | High if fake-active | P1+ | Not now |
| G6 | **P1** | Dual Builder paths (live preview without `proposal=` vs snapshot) confuse setup | Stronger empty-state / “open from Job Card” guidance | Builder client | Medium | P1 | Later |
| G7 | **P2** | Strict CSV only; non-matching supplier CSVs fail hard | Mapping assistant (detect/map/preview/save) | New CSV mapping module + Manage Catalog | Medium | Integrated Flow P2 | **Not now** |
| G8 | **P2** | Roadmap/footnote copy may still say CSV Planned in places | Align copy with live CSV v1 | Catalog roadmap components | Low | P2 polish | Later |
| G9 | **Future** | Material Orders stub; SKUs storage-only | Order from won proposal + supplier connect | Job Card, new order libs | High | Future | Not now |
| G10 | **Future** | Supplier Connect / Jumpstart Planned | Real integrations after ordering contract | Manage Catalog, APIs | High | Future | Not now |
| G11 | **Future** | Raw mode switch blocked; coverage unused in default adjusted | Policy-gated raw UI behind approval | Settings pricing | High | Separate track | Not now |
| G12 | **P2** | shared `app/admin/catalog/components` naming under tools Catalog | Optional rename/move for clarity (not required for flow) | admin/tools catalog | Low | Polish | Optional |

##### G. Staged implementation roadmap (no code in this docs block)

**Integrated Flow P0 — truth/flow blockers**

- **Goal:** Make Catalog → Templates → Job Card → Builder → Preview feel like one honest spine (copy + template catalog linkage foundation).
- **Likely files:** `app/tools/roofing/templates/*`, `proposalTemplateStore.ts`, Job Card proposal links, Builder empty/helper copy, handoff tests/smoke.
- **Protected:** pricing engine math, Customer Preview DTOs, send/public/lifecycle, raw mode, supplier APIs, material ordering, CSV mapping.
- **Tests/smoke:** template add/link catalog item; Job Card create → Builder snapshot; Preview still clean of purchase tax/SKUs.
- **User-visible:** Can attach catalog items to templates intentionally; no stale “Builder later” lies.

**Integrated Flow P1 — setup-to-proposal smoothness** — **COMPLETE** (see P1 section above this research block).

**Templates Workspace Redesign P0 — overview-first progressive disclosure** — **COMPLETE** at `e2df6ac` (see **§6BO.13.4.7**) — **improved density, not final flow**.

**Templates Flow Redesign P1 — Use-first / Edit-mode** — **DONE** (see **§6BO.13.4.8** G).

**Templates Page Redesign P2 — Quote Setup Review + Included manager** — **DONE** (see **§6BO.13.4.9** I).

**Integrated Flow P2 — job-card proposal start / Compact Proposal Setup Card** — **DONE** (see **§6BO.13.4.9** K).

**Next recommended coding block after Integrated Flow P2 / Handoff A**

- Builder visual cohesion pass **or** Preview document-first truth pass.
- Then Customer Preview truth pass / Send readiness when approved.
- **Protected:** no supplier sync, material ordering, proposal import, CSV mapping assistant, raw mode, whole rounding unless separately approved.

**Integrated Flow P2 alternate — CSV mapping assistant / supplier-ready flow** (still deferred)

- **Goal:** Accept non-exact CSVs via mapping while keeping strict FieldDive CSV as baseline; prepare SKU-centric imports without live sync.
- **Likely files:** new `catalogCsvMapping*` pure module + Manage Catalog upload UX; saved mapping prefs.
- **Protected:** no supplier auth; no auto price sync; strict template export unchanged.
- **Tests/smoke:** map sample mismatched headers → preview → import; round-trip strict CSV still works.
- **User-visible:** Upload supplier-ish spreadsheets without hand-rewriting headers.

**Future — material ordering / supplier sync**

- **Goal:** Job Card material order from won proposal; supplier connect/sync; Jumpstart with live prices.
- **Depends on:** solid catalog_item_id + qty snapshots + SKUs; R18+ lifecycle for “won” semantics as approved.
- **Protected until then:** no fake Place Order buttons.

##### H. Decisions locked by this research

1. FieldDive remains **Catalog SoT → Template links → Proposal snapshots → Preview customer filter → Order later**.
2. Strict CSV v1 stays the **baseline**; mapping assistant is **P2**, not a patch on v1.
3. Item tax capture stays **capture-only** until an explicit line-tax engine stage — do not silently invent proposal tax from catalog rates.
4. Purchase tax + SKUs stay **internal** through Preview/public.
5. Material ordering attaches at **Job Card / won proposal**, not inside Catalog management.
6. Next coding block is **Integrated Flow P0**, not supplier sync, not CSV mapping, not raw mode.

**P3 — polish**

- Nav active-state fixes
- Stale page header copy cleanup
- Settings shell visual alignment with roofing shell
- Catalog Settings shell further visual polish beyond P0C

#### 13.5 Approved implementation sequence (slices)

**Slice 1 — Jobs command surface P0 — COMPLETE**

| | |
|---|---|
| **Code** | **`36a0b55` — feat(roofing): add Jobs command surface P0** |
| **Result** | `/tools/roofing` redirects to Job Board when no deep-link params; Jobs / Setup / Advanced nav grouping; Advanced collapsed by default; Job Board setup guidance; legacy estimates de-emphasized; job cards simplified to Roofr-style snapshots (tasks / report / proposal / assignee / time-in-stage / updated metadata); **no** top metric cards, Value, or heavy Next button on card face |
| **Must not touch (preserved)** | Lifecycle/status movement; Stage C; SQL; pricing math; public route behavior |
| **Known follow-ups** | Later wording clarification: Report → measurement language where appropriate; **Job Costing** belongs in future Job Card deep detail — not Job Board cards |

**Slice 2 — Catalog P0 (P0B + P0C + P0D Roofr parity — commit-ready foundation)**

| | |
|---|---|
| **Scope** | Keep **Catalog** as page/nav name; **P0B** table-first structure; **P0C** visual polish; **P0D** Roofr parity correction — continuous ungrouped All items; disabled reserved selection column; command bar Search · Filters & sort · Re-order / Columns / Manage (Coming soon) · Add; columns selection+Name/Type/Measurement/Unit/Unit cost/Unit price/Proposal/Status/Actions; **no** group divider rows; **no** Coverage/Waste/tax/bulk/reorder **active** behavior |
| **Must not touch** | Pricing engine math; proposal pricing calculations; catalog schema/store architecture unless explicitly required; SQL/migrations; lifecycle/status/job-board movement; public proposal route behavior; PDF/Sign/Payment/webhooks |
| **Affected pages** | Catalog (`/tools/roofing/catalog`) |
| **Success criteria** | Continuous catalog command surface (not grouped admin report); disabled selection + planned command controls look reserved not broken; unsupported Roofr features omitted or disabled-only and recorded in §6BO.13.4; systems research and stop rules locked before commit |
| **Known follow-ups (deferred Roofr parity)** | Real bulk bar (activate checkboxes); Add to template; Mark as Material bulk; hard delete policy; Catalog tax/waste/coverage/supplier as optional table columns; supplier/ABC/QXO **sync**; real reorder; company-wide column defaults; real Catalog Settings content — see §6BO.13.4 |

**Slice 3 — Pricing rules P0**

| | |
|---|---|
| **Scope** | Setup nav link; cross-links; profit display policy (block/warn when unsaved) |
| **Must not touch** | Pricing engine math |
| **Affected pages** | Pricing rules, Builder workbench |
| **Success criteria** | Unsaved pricing policy → no misleading profit display |

**Slice 4 — Customer view + Send P0**

| | |
|---|---|
| **Scope** | Rename; banner; send labels; team review accordion; post-send honest copy |
| **Must not touch** | Lifecycle; token supersession; public route behavior unless explicitly scoped |
| **Affected pages** | Customer view, Send panel |
| **Success criteria** | Contractor knows what customer sees vs what they send |

**Slice 5 — Setup Hub minimal**

| | |
|---|---|
| **Scope** | Four setup cards; progress; links to each setup area |
| **Must not touch** | Heavy new setup features |
| **Affected pages** | Setup Hub (`/tools/roofing/setup` proposed) |
| **Success criteria** | One place for company readiness status |

**Immediate next after S2 live apply checkpoint:** **type/store alignment planning or resolver-integration planning only**. No production behavior is enabled by the additive schema. Do **not** add Coverage/Waste UI columns or wire the resolver, pricing engine, pricing mapper, or snapshot builder without separate explicit approval. Catalog P0 roadmap Slice 3 Pricing rules remains separate and is not authorization to change quantity math.

#### 13.6 Stage C / R18D3D sequencing (with P0 UI)

| Rule | Detail |
|------|--------|
| **Stage C1** | **May proceed in parallel** with P0 UI slices (approved UI/flow roadmap recorded at **`fc86123`**). Stage C1 is **pure helpers/tests only** — **do not mix Stage C implementation into UI slices**; no UI, no lifecycle, no board movement |
| **R18D3D** | **Blocked** until **Stage C4** live + smoke-validated **plus P0 trust fixes** (Pricing rules profit policy, Customer view profit-hidden proof, Send honesty), then explicitly approved |
| **P0 UI slices** | **Do not** implement lifecycle/status/job-board movement, `proposal_events` writes, Stage C token supersession in UI, public route behavior changes, SQL/migrations, pricing math changes, PDF/Sign/Payment/webhooks |

#### 13.7 P0 slice guardrails (preserve across all slices)

- No lifecycle/status/job-board movement in P0 slices
- No `proposal_events` writes
- No Stage C token supersession implementation in UI slices
- No public route behavior changes unless explicitly scoped
- No SQL/migrations unless a later slice explicitly requires approval
- No pricing math changes
- No PDF/Sign/Payment/webhooks

---

## 7. IMPORTANT ARCHITECTURE BOUNDARIES

| Concept | Owns |
|---------|------|
| **MeasurementRecord** | Roof measurement truth (quantities, source, readiness) — `measurement_records` |
| **CatalogItem** | Reusable company-owned line item + **quantity driver** (`quantity_source`) — `catalog_items` |
| **ProposalTemplate** | Reusable company-owned package (options, sections, catalog-backed items) — **types, tables, store, defaults, install helper**; **install/readiness UI**; page **content editor** **R6 complete**; **structure + estimate settings R10 complete** (§6AQ) |
| **Proposal** | Job-specific instance of template + measurement + snapshots — **types (§6Z); SQL (§6AA); lib store (§6AB); Job Card create + Builder read (§6AC)**; page text is **copy-on-create** from template — job editor **3J4J** (§6AK); **`refreshDraftPricing` persistence transaction-backed by default** (§6BL); **`createDraftProposal` persistence transaction-backed by default** (§6BL) |
| **Pricing engine** | **New-spine lib** (`proposalPricingEngine.ts` + mapper + orchestrator) — **3I-1 + 3I-2 DONE**; wired from Builder route only; legacy estimator `useMemo` still on saved-estimate path — **protected, not replaced**; **RPC persists pre-built payload only — does not change pricing math** |
| **Payments / approvals / status** | Estimates/proposals KV + APIs — **protected**; do not couple to catalog install |

**Do not conflate:**

- `catalog_items` (new spine) vs `service_items` (legacy admin price book)
- Catalog readiness vs proposal-ready (measurement handoff)
- Catalog row definitions vs proposal totals
- Catalog setup UI (FieldDive route) vs Job Card (readiness/link only, not editor)
- Template setup (`/tools/roofing/templates`) vs Job Card (readiness/links only, not template editor or install)
- `catalog_seed_key` on template items (install-time resolution) vs live `catalog_item_id` (FK + Builder)
- **Seed template bodies** (`defaultRoofingProposalTemplates.ts`) vs **contractor-controlled content** (template editor → job editor — §6AK); company settings = branding/identity only, not Terms/Warranty prose
- **`refreshDraftPricing` sequential multi-request persistence** vs **transactional RPC default** — sequential is **escape hatch only** (`USE_REFRESH_DRAFT_PRICING_SEQUENTIAL=1`); **do not use legacy `USE_REFRESH_DRAFT_PRICING_RPC` env as enablement** (§6BL.17)
- **`createDraftProposal` sequential multi-request persistence** vs **transactional RPC default** — sequential is **escape hatch only** (`USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL=1`) (§6BL.17)
- **Legacy estimate spine** vs **DB proposal spine** — **do not mix**; use dual-spine isolation guardrails (§6BL.7)
- **Direct `proposal_line_items` UI mutation** vs **`refreshDraftPricing` / `createDraftProposal` authoritative persist paths** — **never bypass refresh/create for scope/pricing truth**

---

## 8. CURRENT NEXT (SUMMARY)

**Latest checkpoint:** **3I-2 read-only Builder pricing preview complete** (`637b85a`). **3I-2 chain:** `5626c47` (orchestrator) → `f5bbd84` (document UI) → `637b85a` (status surfaces). **3I-1:** `162f9be`–`52b7148`. **3H-3:** `40e6720`. **3H-2:** `00fbf64`. **3H-1:** `feec663`. **Packet session bleed fix:** `c12ea4d`. **Pre-3H-2:** `abd718d`.

**3G6 — COMPLETE** (3G6A–E + Templates D2 `227061c` + Catalog D2 `29ca190`). **3F9C Job Card** — COMPLETE (`0015be1`). **3H-1 shell** — COMPLETE (`feec663`). **3H-2 read-only preview** — COMPLETE (`00fbf64`). **3H-3 read-only quantity preview** — COMPLETE (`40e6720`). **3I-0 type contract** — COMPLETE (`6f9cbe1`). **3I-1 pure engine + mapper + tests** — COMPLETE (`162f9be`–`52b7148`). **3I-2 Builder pricing preview (A/B/C)** — COMPLETE (`5626c47`–`637b85a`). **Pre-3H-2 correction** — COMPLETE (`abd718d`). **Packet session bleed fix** — COMPLETE (`c12ea4d`). **Jobs Board save point:** `b27a444`.

**Immediate next:** **Review + commit 3I-3B1** (§6M) → **3I-3B2** persistence → **3I-3B3** settings UI + Builder wiring. **Do not** start 3J (SQL/persistence), 3K (PDF/send adapters), or internal profitability dollars without explicit scope (see **§6K**, **§6L**, **§6M**, **§11**).

**Optional (non-blocking):** Job Card tab extraction polish, Job Packet legacy gating, handoff-only doc updates.

### Roofr execution-surface direction (2026 decision)

FieldDive should **start from Roofr’s better pattern and improve it** — not iterate on FieldDive’s current separate Dashboard-first pattern.

| Surface | Roofr-informed role |
|---------|---------------------|
| **Jobs / Pipeline** | Main operational command board — bird’s-eye pipeline visibility, stage columns, job cards |
| **Job Card** | Execution launchpad — measurements, proposals, material orders, invoices, activity, communication |
| **Job Packet** | Lightweight intake / prep — not the operational center |
| **Catalog + Templates** | Company setup surfaces (account-wide, not per-job editors) |
| **Proposal Builder** | Launched from Job Card later — not a hidden admin screen |

**Why 3F9 before 3G6:** Roofr’s operational center is **Jobs / Job Board**, not a separate summary Dashboard. FieldDive currently has separate **Dashboard**, **Job Packet**, and **Job Card** surfaces that need audit/alignment before Templates connect correctly to the execution flow.

### 3F9 — Jobs / Execution Surface Alignment — **DONE (3F9C `0015be1`; board `b27a444`)**

**Historical audit scope** (completed before 3G6):

**Audit / planning scope:**

- Dashboard / current command surface — demote, rename, merge, or keep as command intelligence only?
- Jobs Pipeline / board role — main operational command board
- Job Packet / New Job intake-prep role — stay lightweight
- Job Card execution-launchpad role — measurement → catalog → template → proposal readiness spine
- Where **Catalog setup** and future **Templates setup** connect (links/readiness, not editors on Job Card)
- Where **Proposal Builder** launches later (from Job Card, not admin)

**Potential implementation direction:**

- Reposition Jobs/Pipeline as main operational command board
- Decide Dashboard fate (demoted, renamed, merged, or intelligence-only)
- Keep Job Packet lightweight intake/prep
- Ensure Job Card clearly shows measurement → catalog → template → proposal readiness
- Ensure future Templates setup connects correctly **before** 3G6 implementation

**Explicitly out of 3F9 (unless scoped):** Proposal Builder, template install UI (3G6), pricing bridge, material orders, protected systems.

**Likely files (inspect first):** `FieldDiveAppShell.tsx`, dashboard/pipeline routes and clients, Job Packet entry surfaces, scoped regions of `RoofingClient.tsx` (Job Card shell/navigation only — not pricing/send/PDF).

### 3F8 final state (complete)

| Pass | Commit | Summary |
|------|--------|---------|
| **Pass B** | `a16bccd` | Catalog setup hub, readiness language alignment, Price Book (Legacy) sidebar clarity |
| **Pass C-D** | `5bcf0fe` | Search/filter/group/unpriced, add item, show inactive, deactivate/reactivate, guided pricing queue, disabled roadmap cards |
| **Pass E** | `d422ee6` | Component refactor, focused item detail panel (replaces colspan row editor), Job Card **Open catalog setup** link/copy |

**Product outcome:**

- Catalog page is a **setup workspace**, not just an admin table.
- Setup hub/spine: **starter catalog → configure pricing/items → templates next** (3G6).
- Search, filter, group, unpriced-only, guided **Price N items** queue, add item, show inactive, deactivate/reactivate.
- Item editing uses a **focused detail panel** below the table; structural fields read-only.
- `CatalogAdminClient` refactored into orchestrator + `catalogAdminConstants.ts`, `catalogAdminUtils.ts`, `components/*`.
- Job Card: **Open catalog setup** → `/tools/roofing/catalog`; **Catalog setup** wording (no **Catalog / Price Book** in readiness path).
- Proposal/template buttons on Job Card **remain disabled**.
- **Not touched:** pricing bridge, Proposal Builder, template route/wiring, material orders, protected systems.

**3F8 protected-systems note:** Catalog UI + scoped Job Card catalog link/copy only. **No SQL.** No routes/stores/migrations. No pricing, payments, approval, status, saved estimates, send/PDF, proposal template wiring, or legacy Price Book behavior changed.

### Roofr alignment audit note (2026-05-31)

Read-only audit against Roofr Academy / masterclass catalog expectations informed **3F8** scope. **3F8 is now complete** — catalog product surface matches the foundational **Manage Catalog / Quick Start** direction.

**Decision (historical):** **3F8 before 3G6** — catalog setup complete. **New decision:** **3F9 before 3G6** — align Jobs / Pipeline / Job Packet / Job Card execution surfaces with Roofr before Templates UI. Do not skip Roofr research before **3F9** or **3G6** layout commits.

**Full ordered roadmap, drift list, and per-stage scope:** see **§11 — Forward Roadmap / No-Drift Next Steps**.

**Do not code in a new chat until repo truth is confirmed** (`git status`, `git log`, this doc) and **3F9** is explicitly scoped.

---

## 9. REQUIRED FIRST PROMPT IN NEW CHAT

Future GPT must have Cursor run **before** planning or coding:

```bash
git status --short
git log --oneline -15
```

Then open and read **in this file** (in order):

1. **Header / checkpoint block** (code + docs checkpoint, tests, next recommended)
2. **Recent commit table** (below header)
3. **§6AG** — 3J4C document-first Proposal Builder (read before any Builder UI change)
4. **§6AH** — 3J4D Estimate readability
5. **§6AI** — 3J4E package/options detail surface
6. **§6AJ** — 3J4F customer content page rendering
7. **§6AK** — 3J4G-Roadmap + 3J4H-R proposal content architecture (read before any content/template/editor work)
8. **§6AL** — RoofrExact Recovery Playbook (mandatory stage order)
9. **§6AM** — R1 Global IA / Module Ownership Map (read before nav/module placement or R5+ UI)
10. **§6AN** — R2 Jobs Board / Saved Identity (read before board/saved/legacy partition work)
11. **§6AO** — R3 Proposals Hub Ownership (read before hub/Templates/Builder placement)
12. **§6AP** — Pre-R10 audit + P1 Job Card bugfix (read before R10)
13. **§6AQ** — R10 completion summary
14. **§6AR** — R11a/R11b completion summary
15. **§6AS** — R11c company branding context_echo stamping
16. **§6AT** — R12 customer identity context_echo stamping (read before R15)
17. **§6AU** — R13 frozen document token foundation (read before R14/R15)
18. **§6AV** — R15 read-only branded cover (read before R17+ lifecycle)
19. **§6AW** — R14 read-only body/page token merge (read before Preview/PDF/template token authoring or R17+ lifecycle)
20. **§6AX** — R16A Builder chrome / customer document IA separation (read before any Builder chrome/strip/header change)
21. **§6AY** — R16B proposal body authoring foundation (read before body edit/save, `updateDraftProposalPageContent`, or Estimate section filtering)
22. **§6AZ** — Whole-app Roofr-aligned audit after R16B (read before choosing next Builder stage; R16C planning)
23. **§6BA** — R16C1 Builder strip overflow page navigation (read before overflow menu, More pages control, or overflow routing)
24. **§6BB** — R16C2 document token picker in R16B editor (read before Insert field, token insertion, or picker model work)
25. **§6BC** — R16C3 page visibility / hide-show foundation (read before `visible_to_customer`, visibility toggle, or R17 Preview page-filter contract)
26. **§6BD** — R16C final whole-Builder audit before R17 planning (historical context; superseded by §6BE / §6BF / §6BG for current resume)
27. **§6BE** — R17A/R17B customer Preview foundation (historical foundation; superseded by §6BF for current Preview Estimate resume)
28. **§6BF** — R17C1 Preview Estimate document presentation layer (historical Preview foundation; superseded by §6BG for current Builder Estimate resume)
29. **§6BG** — R17C2 Builder Estimate workbench hierarchy (historical Builder workbench context; superseded by §6BK for current Edit Option / scope decision resume)
30. **§6BH** — R17D Phase 1 scope decision overlay foundation (historical Phase 1 backend; superseded by §6BI / §6BJ / §6BK for current R17D resume)
31. **§6BI** — R17D Phase 2 manual quantity set/update UI/API + full audit checkpoint (historical Phase 2; read for set/update context; superseded by §6BJ / §6BK for current manual quantity resume)
32. **§6BJ** — R17D Phase 2.5 manual quantity reset + full audit checkpoint (historical Phase 2.5; read for reset context; superseded by §6BK for current exclude/remove resume)
33. **§6BK** — R17D Phase 3A exclude/remove from option + full audit checkpoint (**historical Phase 3A only**; superseded by §6BL for current resume)
34. **§6BL** — Audit Remediation Track post whole-app audit (**complete**; **second whole-app audit before R18 PASS** at §6BL.21; **Phase 4 Hide complete** at `e79c53a` §6BL.13; **Phase 4A/4B estimate display settings complete** at `1424f1e`/`38a126e` §6BL.14–§6BL.15)
35. **§6BM** — **R18A public proposal architecture plan** (**complete** — read before any R18 implementation; **immutable sent snapshot first**; Send/PDF/Sign/Payment remain phased/disabled; **public route exists read-only** at §6BN.11; **review-link bridge exists on Contractor Preview** at §6BN.12; **Send gate readiness UI exists on Contractor Preview** at §6BN.13 — **delivery still disabled**; **customer send link prep exists on Contractor Preview** at §6BN.15 — **still not email delivery**)
36. **§6BN** — **R18C public access + R18D send prep + R18D1 Send gate + R18D3A delivery attempts + R18D3B email send + R18D3C delivery history UI** (**R18D3C complete** — §6BN.20 at **`e17eab5`**; **R18D3B complete + live-smoked** — real email send orchestration §6BN.18; **R18D3B email template polish complete + Gmail-approved** at **`20a239d`** §6BN.19 — **historical R18 commit, not current code checkpoint**; **R18D3A complete** — delivery attempt foundation §6BN.17; **R18D2 complete** — customer send link prep §6BN.15; **R18D1 complete** — Contractor Preview Send gate readiness §6BN.13; **R18C4C complete** — Contractor Preview review-link bridge §6BN.12; **R18C4B complete** — `/p/[token]` route + customer shell §6BN.11; **R18C4A complete** — orchestrator + view model §6BN.10; R18C3B mint §6BN.9; R18C3A boundary §6BN.7; R18C2B RPCs)
37. **§6BO** — **Public proposal packet + Stage A/B truth-pipeline remediation side-track** (**complete** at `ee643d0`; Stage B E2E smoke PASS §6BO.7; **§6BO.0** R18 roadmap position; **§6BO.11** approved Stage C policy; **§6BO.12** operating-flow audit sequencing — complete; **§6BO.13** approved UI flow roadmap)
38. **§6BO.11** — **Stage C whole-app impact review + token supersession / stale-link policy** — **APPROVED DIRECTION**; R18D3D blocked until at least Stage C4 + P0 trust fixes; C1–C7 stages; guardrails
39. **§6BO.12** — **Roofr + contractor operating-flow audit sequencing decision** — audit complete; outcome in **§6BO.13**
40. **§6BO.13** — **Approved page-by-page UI flow roadmap + P0 implementation sequence** — **APPROVED IMPLEMENTATION REFERENCE**; supersedes separate Command Center language
41. **§3 Builder-specific rule + Roofr-aligned product principle** — no-drift rules; **Playwright MCP test-only guardrail**
42. **§6AD** — DB-first foundation Phases A–D
43. **§6AE** — 3J3E option persistence + quantity resolver coverage
44. **§6AF** — pricing trust hardening
45. **§9** — required first prompt / resume instructions (this section)
46. **§11** — roadmap buckets (TODAY / NEXT / LATER / DO NOT DO YET), current checkpoint, built-surface audit, manual smoke; **§11 — Future / Later bucket → Proposal Builder**

**Verify HEAD** is **`36a0b55`** or newer (Slice 1 Jobs command surface P0); if newer, reconcile this doc.

**Latest docs checkpoint:** **pending this commit** (prior docs: **`fc86123`** — docs: record approved page-by-page UI flow roadmap and P0 slices).

**Mandatory read:** **§6BO.13** (approved UI flow roadmap + P0 slices), **§6BM** / **§6BN** (R18 roadmap + implementation history), **§6BO.11** (approved Stage C policy), **§6BO.12** (audit complete — outcome §6BO.13), and **§6BO** (completed remediation side-track) before any next slice.

**Next action (mandatory first resume step):**

1. **Docs correction — Catalog naming** (this commit) — then **Slice 2 — Catalog P0** (§6BO.13).
2. **Slice 1 complete** at **`36a0b55`** — Jobs command surface P0 (§6BO.13.5).
3. **Stage C1 may proceed in parallel** with P0 UI slices (pure helpers/tests only) — **do not mix Stage C implementation into UI slices**.
4. **Do not implement R18D3D** until at least **Stage C4** + P0 trust fixes + explicit approval — it touches proposal status, `proposal_events`, Jobs Board movement, and Job Card activity.
5. **Do not enable** lifecycle/status/job-board mutation, PDF, Sign, Payment, webhooks, public route behavior changes, or SQL in P0 UI slices (§6BO.13.7).
6. **R18D3C complete** at **`e17eab5`** (§6BN.20); **R18D3E** webhooks, **R18G/H/I/J** remain downstream.

**Do not enable** lifecycle/status/job-board mutation, PDF, Sign, or Payment without explicit scoped direction. **R18D3B Send emails customer** when readiness + sent snapshot exist — **does not** mutate proposal/job lifecycle. **Public route is read-only** at `/p/[token]`.

**Confirm** working tree is clean (or note doc-only WIP).

**Whole-app Roofr-aligned audit passed** (2026-06-18, §6AZ) + **R16B validation passed** (§6AY) + **R16C1 browser audit passed** (§6BA) + **R16C2 pre-commit audit passed** (§6BB) + **R16C3 pre-commit audit passed** (§6BC) + **R16C final whole-Builder audit passed** (§6BD) + **R17A/R17B pre-commit audit passed** (§6BE) + **R17C1 pre-commit audit passed** (§6BF) + **R17C2 pre-commit audit passed** (§6BG) + **R17D Phase 1 pre-commit validation passed** (§6BH) + **R17D Phase 2 automated tests passed** (§6BI) + **R17D Phase 2 full audit passed** (§6BI) + **R17D Phase 2.5 automated tests passed** (§6BJ) + **R17D Phase 2.5 full audit passed** (§6BJ) + **R17D Phase 3A automated tests passed** (§6BK) + **R17D Phase 3A full audit passed** (§6BK) → **post-Phase-3A whole-app audit triggered Audit Remediation Track** (§6BL). **Remediation 1 complete** at `6e27716`; **Remediation 2B complete** at `377dfe2`; **Remediation 3A complete** at `b65c684`; **Transactional create Remediation 4A complete** at `daf5268`; **Transactional create Remediation 4B migration applied** manually on `rhquhnujjnzjhweypavd`; **Transactional create Remediation 4C complete** at `f684b73`; **Post-transaction spine audit passed** (§6BL.11); **Mark N/A drift cleanup complete** at `8dd8e7f` (§6BL.12); **R17D Phase 4 Hide complete** at `e79c53a` (§6BL.13); **R17D Phase 4A estimate display policy consumer complete** at `1424f1e` (§6BL.14); **R17D Phase 4B Builder display settings editing complete** at `38a126e` (§6BL.15); **second whole-app audit before R18 passed** (§6BL.21). **R0–R15** complete/satisfied; **R16A** at `18cebca` (§6AX); **R16B** at `589f5a0` (§6AY); **R16C1** at `967f0de` (§6BA); **R16C2** at `0cf76d2` (§6BB); **R16C3** at `25f1375` (§6BC); **R17A/R17B** at `8ac2bcb` (§6BE); **R17C1** at `9c2244a` (§6BF); **R17C2** at `3e65774` (§6BG); **R17D Phase 1** at `43c83a2` (§6BH); **R17D Phase 2** at `f5712ff` (§6BI); **R17D Phase 2.5** at `a12fb92` (§6BJ); **R17D Phase 3A** at `2dca3c0` (§6BK). **Current code checkpoint:** **`ee643d0`** (Stage B server-deps fix). **Public proposal packet + Stage A/B:** §6BO (`4402821`, `99de56b`, `d3e2d13`, `10a1971`, `ee643d0`). **R18D3B email orchestration** at `e7cdc51`. **R18D3B email template polish (historical):** `20a239d` (§6BN.19). **R18A complete** (§6BM). **R18B4D smoke PASS** (§6BM.13). **R18C3A complete** (§6BN.7). **R18C3B complete + live-verified PASS** (§6BN.9). **R18C4A complete** (§6BN.10). **R18C4B complete** (§6BN.11). **R18C4C complete** (§6BN.12). **R18D1 complete** (§6BN.13). **R18D2 complete** (§6BN.15). **R18D3A complete** (§6BN.17) — migration `20260626_020` **live-applied + verified PASS** on `rhquhnujjnzjhweypavd` (§6BN.17.7). **R18D3B complete + live-smoked** (§6BN.18). **Next:** **R18 roadmap recovery / priority decision** — §6BO.0, §6BO.10. **Migrations applied on configured project `rhquhnujjnzjhweypavd`:** `20260618_009` (scope decisions), `20260624_010` (refresh pricing RPC), `20260625_011` (create draft RPC), `20260626_012` (send-freeze RPC; R18B4D smoke §6BM.13), `20260626_014`/`015` (public access token tables R18C2A), `20260626_016`/`017` (public access resolve/record RPCs R18C2B), `20260626_018`/`019` (public access mint RPC R18C3B §6BN.9), `20260626_020` (delivery attempts R18D3A §6BN.17.7). **Header Preview enabled** for saved drafts; **Customer view review-link panel enabled** on Preview (§6BN.12); **Send gate readiness panel enabled** on Preview (§6BN.13); **Customer send link prep + Send proposal by email enabled** on Preview when readiness green (§6BN.15, §6BN.18) — **lifecycle/status/job-board/PDF/Sign/Payment remain disabled**. **Public route `/p/[token]` exists (read-only)**. **Mandatory order for historical context:** **§6AL** through **§6BK**; **current resume:** **§6BM** / **§6BN** → R18 roadmap recovery (§6BO.0); **§6BO** = completed remediation only. **Do not** return to `loadSaved`/`currentSaved` as main workflow.

Inspect before planning **3F9** (or chosen stage):

| File | Why |
|------|-----|
| `app/tools/roofing/FieldDiveAppShell.tsx` | Sidebar nav truth — **§6AM** table; Jobs Board + Catalog + Templates **live** |
| Dashboard / pipeline route clients | Current command surface vs Jobs board |
| Job Packet / New Job entry surfaces | Intake-prep role |
| `app/tools/roofing/RoofingClient.tsx` | Job Card execution launchpad — **scoped regions only** |
| `app/tools/roofing/catalog/page.tsx` | Canonical catalog route auth + companyId |
| `app/tools/roofing/catalog/CatalogAppPage.tsx` | FieldDive shell wrapper |
| `app/admin/catalog/page.tsx` | Redirect to `/tools/roofing/catalog` |
| `app/admin/catalog/CatalogAdminClient.tsx` | Catalog orchestrator — install/recheck, filters, detail panel |
| `app/admin/catalog/components/*` | Presentational catalog workspace sections |
| `app/lib/catalogTypes.ts` | Catalog type contract |
| `app/lib/catalogStore.ts` | Catalog DB I/O (do not change casually) |
| `app/lib/defaultRoofingCatalog.ts` | 13 starter catalog definitions |
| `app/lib/defaultRoofingCatalogInstall.ts` | Idempotent catalog install |
| `app/lib/catalogReadiness.ts` | Catalog readiness labels |
| `app/lib/proposalTemplateTypes.ts` | Template type contract |
| `app/lib/proposalTemplateStore.ts` | Template DB I/O (do not change casually) |
| `app/lib/defaultRoofingProposalTemplates.ts` | Passive roof replacement template defs |
| `app/lib/defaultRoofingProposalTemplateInstall.ts` | Idempotent template install |
| `app/lib/measurementProposalHandoff.ts` | Measurement → proposal input (passive) |
| `app/lib/proposalBuilderReadiness.ts` | Composite Builder gates (pure/read-only) |
| `app/lib/proposalBuilderPreview.ts` | Pure read-only line/section preview helpers (3H-2 + 3H-3 quantity context) |
| `app/lib/proposalQuantityResolver.ts` | Pure read-only line quantity resolver (3H-3) |
| `app/tools/roofing/proposals/builder/*` | Proposal Builder shell + read-only preview + quantity preview (3H-1 + 3H-2 + 3H-3) |
| `app/tools/roofing/RoofingClient.tsx` | Packet handoff (`fd87152`), pre-3H-2 correction (`abd718d`), session bleed fix (`c12ea4d`), Proposals tab + Builder launch (`feec663`) |
| `app/tools/roofing/jobCard/jobCardIdentityUtils.ts` | Pure Job Card identity display from `JobRecord` (pre-3H-2) |
| `supabase/migrations/20260531_004_create_proposal_template_tables.sql` | Live template schema |

Confirm: **Create proposal / Open proposal** on Job Card creates/reuses DB draft and opens Builder with `?job=&proposal=` when checklist gates pass; `installDefaultRoofingCatalog` only from catalog route; `installDefaultRoofingProposalTemplates` click-only from templates route; **no** template install from Job Card; Builder **reads** persisted draft graph when `proposal=` present; **Header Preview enabled** for saved drafts (opens authenticated contractor Preview route); **Send / Sign / Payment / PDF / lifecycle/status mutation remain disabled**; **public route `/p/[token]` exists (read-only)** — see §6BN.11.

---

## 10. CURRENT PROTECTED SYSTEMS

**Do not touch casually** (no changes unless the user’s stage explicitly includes them):

| System | Typical locations |
|--------|-------------------|
| Pricing `useMemo` / deterministic pricing | `RoofingClient.tsx` estimator sections |
| `saveEstimate` | `app/lib/estimateStore.ts` |
| Send / PDF | `generateProposalPdfBytes`, `/api/proposal/*`, `/api/estimate/send` |
| Approval / token logic | `/api/approval/*`, `/api/approve/*`, `approvalToken` |
| Payment / Stripe / offline payment truth | `/api/payments/*` |
| Status / pipeline logic | `SavedClient.tsx`, status filters, batch updates |
| Saved estimates restore body | `loadSaved`, snapshot restore |
| `estimateStore` | Core estimate list/save |
| `service_items` legacy behavior | `PriceBookAdminClient.tsx` only |
| Production Supabase schema | Except deliberate reviewed migrations |
| **`refreshDraftPricing` transactional RPC** | Default path via `persist_draft_pricing_refresh_v1` (§6BL); sequential only via `USE_REFRESH_DRAFT_PRICING_SEQUENTIAL=1`; **no direct `proposal_line_items` UI mutation** |
| **`createDraftProposal` transactional RPC** | Default path via `persist_draft_proposal_create_v1` (§6BL); sequential only via `USE_CREATE_DRAFT_PROPOSAL_SEQUENTIAL=1`; **no direct multi-table UI mutation bypass** |
| **Proposal public access token server boundary** | `proposalPublicAccessTokenHash.ts`, `proposalPublicAccessRpcPersistence.ts`, `proposalPublicAccessRpcStore.server.ts` — **`server-only`** + `createAdminClient()`; hash-before-RPC; resolve/record only (§6BN.7) |
| **Proposal public access token minting** | `proposalPublicAccessTokenMint.ts`, `proposalPublicAccessTokenMintPersistence.ts`, `proposalPublicAccessTokenMintStore.server.ts` — **`server-only`** + `createAdminClient()`; raw token generated server-side, returned once; hash-before-RPC; **does not enable Send or email delivery** (§6BN.9) |
| **Proposal public access orchestrator + view model** | `proposalPublicAccessOrchestrator.ts`, `proposalPublicAccessOrchestrator.server.ts`, `proposalPublicProposalViewModel.ts`, etc. — token-first pipeline; render-ready document VM; **no Send/PDF/Sign/Payment/lifecycle** (§6BN.10) |
| **Public proposal version graph loader** | `proposalVersionGraphStore.server.ts` — **`server-only`** + `createAdminClient()`; `getPublicProposalVersionGraph` with `requireSentVersion: true`; token-bound reads only (§6BN.11) |
| **Public proposal route `/p/[token]`** | `app/p/[token]/*`, `app/p/layout.tsx` — **read-only** customer shell; token from params only; **`result.tracking` never passed to client**; **does not enable Send/PDF/Sign/Payment/lifecycle** (§6BN.11) |

**Safe catalog work** stays in: types, store, default definitions, install helper, readiness helpers, catalog route page/client, passive Job Card display.

**Safe template work** stays in: `proposalTemplateTypes.ts`, `proposalTemplateStore.ts`, passive default definitions, template install helper, future template setup route/UI/readiness — **not** Proposal Builder, proposal records, pricing bridge, or protected estimate/send paths unless explicitly scoped.

---

## Quick reference — routes

| Route | Table / role |
|-------|----------------|
| `/tools/roofing/proposals/builder?job=<uuid>&proposal=<uuid>` | **3H + 3I + 3J + §6AF + §6AG–§6AJ + §6AV + §6AW** — **document-first** Proposal Builder; Estimate renders inline document; Cover (R15) + text pages (R14 token merge at display time) consume frozen `proposalDocumentContext`; Proposal Helper inspector rail; **persisted draft path** when `proposal=`; stale banner + Refresh draft pricing; **Preview / Send / Sign / Payment remain disabled** |
| `/tools/roofing?entry=job-card&job=<uuid>` | Job Card for persisted job (packet-origin after Continue, or direct URL) |
| `/tools/roofing?entry=job-card` | Job Card shell without job — limited (no measurement save without job id) |
| `/tools/roofing?entry=packet` | Job Packet / New Job intake (canonical capture/prep) |
| `/tools/roofing?loadSaved=<id>` | Board card → Job Card (board-origin; **saved estimate** path — not pure `public.jobs`) |
| `/tools/roofing/catalog` | **Canonical** **catalog_items** product workspace — `CatalogSetupClient`, starter hero, items table, checklist (`29ca190` D2) |
| `/admin/catalog` | Redirect → `/tools/roofing/catalog` |
| `/admin/price-book` | Legacy **service_items** only |
| `/admin/customers` | Customers CRUD |
| `/tools/roofing/saved` | Jobs Board (SavedClient — **RoofingEstimate** cards) |
| `/tools/roofing/templates` | **Live** — template install/recheck, readiness, library (`3G6A–D2`) |
| `/p/[token]` | **R18C4B** — **read-only** public customer proposal route; token-resolved, sent/signed-version-only, customer-safe DTO/VM shell (§6BN.11); **no FieldDive app shell**; **Send / Sign / Payment / PDF remain disabled** |
| `/api/proposals/public-review-link` | **R18C4C** — authenticated POST to mint review link for Contractor Preview QA (§6BN.12); opens `/p/[token]`; **does not email customer or mutate lifecycle/status** |
| `/api/proposals/send` | **R18D3B** — authenticated POST email send (§6BN.18); Resend HTTP + `proposal_delivery_attempts`; **does not** set sent status, **does not** mark customer notified, **does not** move Jobs Board |
| `/api/proposals/send-prep` | **R18D2** — authenticated POST send-prep only (§6BN.15); prepares customer-send link; **does not email**, **does not set sent status**, **does not mark customer notified** |
| `proposal_delivery_attempts` | **R18D3A** — table live on `rhquhnujjnzjhweypavd` via migration `20260626_020` (§6BN.17.7); **R18D3B** writes delivery attempt rows on send (§6BN.18); authenticated SELECT; server writes via `service_role` |

---

## 11. FORWARD ROADMAP / NO-DRIFT NEXT STEPS

**Current checkpoint override:** Header + **§6BO.13** + **§6BM** / **§6BN** + **§6BO** + **§6BL** supersede stale checkpoint lines in this section and stale **§8 CURRENT NEXT** / old **§11 body** / old **§6AL R18 row**. **Code:** **`36a0b55` — feat(roofing): add Jobs command surface P0**. **Docs:** pending this commit (prior docs: **`fc86123`**). **Slice 1 complete** (§6BO.13.5). **Catalog naming correction** — keep **Catalog** as page name; Slice 2 is **Catalog P0** (not Price book P0). **R18D3C complete** (§6BN.20). **Approved UI flow roadmap** (§6BO.13). **Stage C policy approved** (§6BO.11). **Truth-pipeline remediation (complete):** §6BO. **R18D3B complete + live-smoked** (§6BN.18). **R18D3A complete** (§6BN.17). **Public route `/p/[token]` exists (read-only)**. **Customer view: Copy customer link + Email proposal to customer + read-only delivery history** when readiness green (§6BN.18, §6BN.20). **Lifecycle/status/job-board/PDF/Sign/Payment/webhooks remain disabled in P0 UI slices.** **Immediate next:** **Slice 2 — Catalog P0** (§6BO.13); **Stage C1 may run in parallel** with P0 UI — do not mix Stage C into UI slices; **R18D3D blocked** until at least **Stage C4** + P0 trust fixes + explicit approval. **Job Costing** = future Job Card module — not Catalog, not Job Board cards. **Do not create a separate Command Center** — evolve Job Board (§6BO.13).

Use this section as the **ordered checklist** for future GPT/Cursor sessions.

### Roadmap buckets (TODAY / NEXT / LATER / DO NOT DO YET)

**TODAY / IMMEDIATE**

- **Docs checkpoint** — post-R13 handoff alignment (this commit)
- Confirm checkpoints: code **`e40db30`**; docs pending this commit
- **R0–R13** complete — see §6AL + §6AR + §6AS + §6AT + §6AU
- **Post-R13 audit:** **291/291** R13 + safety + **59/59** pricing/template = **350/350** combined; **authenticated Playwright** light verified (§6AU)
- **Preview / Send / Sign / Payment remain disabled** (R17–R20)
- **No Proposals hub code** — **R16** only; **no Template route migration**

**NEXT (after docs checkpoint — explicit direction only)**

- **R15 scoping/planning** — branded cover/display consuming `proposalDocumentContext` + resolver; **mandatory visual check** (§6AS + §6AT + §6AU)
- **Do not auto-start R15 implementation**
- **R16** — Proposals hub foundation (later)

**LATER (§6AL stages — see §6AL table for full order)**

- **3J4J** — job-specific proposal page editor (historical §6AL “R12” label — reconcile before code)
- **Text merge / body `{{token}}` substitution** — later slice (resolver ready; not R13)
- **R14** — media foundation (cover/photos/PDF/report storage)
- **R15** — Builder branded cover/display (incl. `settings_json` rendering where applicable)
- **R16** — Proposals hub foundation
- **R17–R20** — Preview / Send / Sign / Payment (**3K0–3K3**)
- **R21–R23** — production spine, automations, legacy cleanup

**DO NOT DO YET**

- **R15 code** before explicit-direction scoping pass + visual check (§6AU)
- **Builder branded cover / customer display UI** before R15 scope audit
- **Markdown token merge wiring** before dedicated scope (resolver exists; UI wiring is separate)
- **Proposals hub** before **R16**
- Enable Preview / Send / Sign / Payment / Add Page (**R17+**)
- Company Terms/Warranty content-default store; `/tools/settings/proposals` prose
- Proposals hub route migration before **R16**
- `loadSaved` / `currentSaved` as main workflow
- `/admin/*` as primary proposal content architecture
- SQL/migrations/package changes without explicit stage scope
- More Builder presentation polish (3J4D/3J4E baseline sufficient)
- Protected pricing/math/totals/quantity/stale/refresh without explicit scope
- Reopen Templates structure/settings unless bugfix-scoped
- Live Settings/customers/jobs reads for proposal document display
- Legacy `RoofingClient` PDF / `estimateStore` for new proposal document path

---

### Current checkpoint

**Latest code checkpoint:** **`e40db30` — feat(proposals): add frozen document token registry and resolver**. **Prior:** `89ef2ba` (docs post-R12), `31059e3` (R12), `29722a0` (R11c).  
**Jobs Board approved save point:** **3F9B4-RoofrExact** (`b27a444`); **DB-first partition** (`a62ad93`, §6AD); **R8 identity** (`1191ddd`).  
**Latest handoff doc checkpoint:** **pending this commit** (prior: **`89ef2ba`**, post-R12). **Post-R13 audit:** **350/350** combined; **authenticated Playwright** light verified (§6AU).  
**Next:** **Do not auto-start R15** — scoping/planning only after explicit direction (§6AU). Full order: **§6AL** + **§6AM** + **§6AN** + **§6AO** + **§6AP** + **§6AQ** + **§6AR** + **§6AS** + **§6AT** + **§6AU**.

**Completed working state (summary):**

| Area | Status |
|------|--------|
| **3E** Measurement Records / Job Card measurement truth | **DONE** |
| **3F / 3F8** Catalog foundation + FieldDive catalog route + Pass B–E | **DONE** (`d422ee6`) |
| **3G6D3** Catalog workspace surface (Catalog D2) | **DONE** (`29ca190`) — product workspace, not readiness dashboards |
| **3F9A/B** Jobs-first IA and shell alignment | **DONE** (`0f0181a`) |
| **3F9B2–B4** Jobs Board — RoofrExact checkpoint | **DONE** — save point `b27a444` |
| **3F9C** Job Card architecture + visual shell | **DONE** (`0015be1`) |
| **3G1–3G5** Proposal template types, tables, store, defaults, install helper | **DONE** |
| **3G6A–E** Templates route, install, readiness, Templates D2, Job Card templates link | **DONE** (`b78c9ee`) |
| **Packet handoff fix** | **DONE** (`fd87152`) |
| **Pre-3H-2 source-of-truth** | **DONE** (`abd718d`) — Activity rail, packet intake reset, Job Card `?job=` identity |
| **Packet session bleed fix** | **DONE** (`c12ea4d`) — stale saved estimate no longer overrides packet-created Job Card |
| **3H-1** Proposal Builder shell + gates + Job Card launch | **DONE** (`feec663`) — read-only |
| **3H-2** Read-only proposal preview (document canvas, options, sections, lines) | **DONE** (`00fbf64`) — Builder-route-only |
| **3H-3** Read-only proposal quantity preview (pure resolver, line row Qty/Source/Rule/Status) | **DONE** (`40e6720`) — Builder-route-only |
| **3I-0** Proposal pricing type contract | **DONE** (`6f9cbe1`) — `proposalPricingTypes.ts` |
| **3I-1** Pure pricing engine + input mapper + tests | **DONE** (`162f9be`–`52b7148`) |
| **3I-2** Read-only Builder pricing preview (orchestrator + document UI + status surfaces) | **DONE** (`5626c47`–`637b85a`) — see **§6K** |
| **3I-3** Company pricing policy + internal profitability rail + rail regrouping | **DONE** — see **§6P**–**§6V** |
| **3J0** Proposal architecture types | **DONE** (`3ae5e39`, §6Z) |
| **3J1** Proposal SQL migrations + RLS | **DONE** — applied + verified (§6AA) |
| **3J2** Snapshot mapper + builder + record store | **DONE** (`13b4e72`, §6AB) — lib layer |
| **3J3** Job Card → persisted Builder draft flow | **DONE** (`e38b276`, §6AC) |
| **DB-first foundation Phases A–D** | **DONE** (`87be1b4`, §6AD) — sparse job/measurement updates, Job Board partition, `job=` identity, proposal validation test lock |
| **3J3E option selection persistence** | **DONE** (`a7249b3`, §6AE) |
| **Pricing trust hardening** | **DONE** (`ce3d6bc`, §6AF) — snapshot qty+price alignment; stale detection; refresh wired; **smoke PASSED** (§6AF.9) |
| **3J4A Builder final-surface navigation** | **DONE** (`4c9a77d`) — page context strip, document page model |
| **3J4C document-first Proposal Builder** | **DONE** (`f8bffde`, §6AG) — inline Estimate document; Proposal Helper inspector; Overview + workspace tabs **removed** |
| **3J4D Estimate readability** | **DONE** (`c42a559`, §6AH) — Line details disclosures; section hierarchy |
| **3J4E package/options surface** | **DONE** (`72768ae`, §6AI) — selected-package summary; grouped placeholders |
| **3J4F customer text pages** | **DONE** (`bfa0454`, §6AJ) — Terms/Warranty/Project Overview/custom_text read-only rendering |
| **3J4G-Roadmap content architecture** | **DONE** (`57108bd`, §6AK) — initial four-layer lock |
| **3J4G seed fallback copy** | **DONE** (`ce7aa39`, §6AK) — improved starter template bodies |
| **3J4H-R Roofr IA correction** | **DONE** (`40e5f5b`, §6AK) — template-first content model; company = branding only |
| **3J4H Pass 2 content helper** | **DONE** (`8c04c2a`) — `proposalTemplateContentEditing.ts` |
| **R0 Recovery Playbook** | **DONE** (`f1dba95`, §6AL) |
| **R1 Global IA / module ownership** | **DONE** (`b70cdd7`, §6AM) |
| **R2 Jobs Board / saved identity** | **DONE** (`2e1c36b`, §6AN) |
| **R3 Proposals hub ownership** | **DONE** (`5927ab5`, §6AO) |
| **R4 Template content editor view-model** | **DONE** (`9db2030`) |
| **R5 Template Workspace shell** | **DONE** (`ffc1cc0`) |
| **R6 Template content editor save** | **DONE** (`3c6214c`) |
| **R7 Light global IA nav** | **DONE** (`05b9c54`) |
| **R8 Light Jobs Board identity** | **DONE** (`1191ddd`) |
| **R9 Job Card proposal create/open** | **DONE/satisfied** (`1915b2d` + `d0ba188` §6AP) |
| **Pre-R10 P1 Job Card truth** | **DONE** (`d0ba188`, §6AP) |
| **R10 Template structure + estimate settings** | **DONE** (`bc42b1e`–`b3dd904`, §6AQ) |
| **R11 Company branding Settings + R11c echo** | **DONE** (`0146dac`–`29722a0`, §6AR + §6AS); post-R11c audit passed |
| **R12 Customer identity context_echo** | **DONE** (`31059e3`, §6AT); post-R12 audit **265/265** + **326/326**; **authenticated Playwright** verified |
| **R13 Frozen document token foundation** | **DONE** (`e40db30`, §6AU); post-R13 audit **350/350**; **authenticated Playwright** light verified; no Builder UI / no markdown merge |
| **DB-first + proposal smoke gate** | **PASSED** manually (`0763799` + live Job Card Proposals) — §6AE.5 + §6AF.9 + §6AD.7 |
| **Canonical catalog route** | **`/tools/roofing/catalog`** — `CatalogSetupClient` |
| **Canonical templates route** | **`/tools/roofing/templates`** — `TemplatesSetupClient` |
| **Proposal Builder route** | **`/tools/roofing/proposals/builder?job=<uuid>&proposal=<uuid>`** — persisted draft when `proposal=`; **live preview only** when `proposal=` absent (no silent fallback when `proposal=` invalid) |
| **Job Card Proposals** | **Create proposal / Open proposal** create/reuse draft (`resolveOrCreateProposalDraftEntry` + checklist gates); opens Builder with `?proposal=`; pre-R10 P1 truth (`d0ba188`); **legacy/board-origin blocked** |
| **Job Board primary board** | **DB jobs** (`a62ad93`); legacy saved estimates in **separate labeled section** |
| **Protected** | Legacy pricing, payments, approval, status, saved estimates, send/PDF **untouched** outside scoped DB-first Job Card launch; **legacy localStorage not deleted** |

**SQL note:** Catalog/template table verification was done in Supabase during 3F/3G stages; do not re-run schema changes from roadmap work unless a stage explicitly scopes a new migration.

### Built-surface audit findings (post-3H-1, read-only)

| Flow / surface | Finding |
|----------------|---------|
| **Jobs Board → Job Card** | **Improved (§6AD)** — primary kanban = DB jobs opening `job=`; legacy saved estimates in separate section opening `loadSaved=` or linked `job=` |
| **Job Packet → Job Card** | **Fixed** (`fd87152`, `abd718d`, **`c12ea4d`**, **`0649e04`**) — stale `currentJobId` handoff; Continue gated; create-only from fresh packet; intake reset; customer link no longer wipes packet fields |
| **Job Card identity** | **DB-first (§6AD)** — clean `entry=job-card&job=<uuid>` is authoritative; `identityFromJobRecord` gates proposal create; legacy session cleared on DB routes (`e1a8f7c`) |
| **Measurement persistence** | **Fixed (§6AD)** — sparse update mapper; re-save does not wipe `quantity_map` / line fields; `jobs.selected_measurement_id` written after save |
| **Catalog / Templates** | Aligned workspace surfaces (`CatalogSetupClient`, `TemplatesSetupClient`); click-only install |
| **Proposal Builder (3H + 3I + 3J + §6AD + §6AG–§6AJ)** | **Document-first** (`bfa0454`): Estimate inline document; text pages render read-only `body_markdown`; Proposal Helper inspector; no workspace tabs; persisted draft when `proposal=`; invalid draft errors (no silent fallback); Preview/Send/Sign/Payment disabled |
| **Legacy routes (still reachable)** | `?entry=manual&legacy=1` (legacy estimate workspace); `loadSaved=` (legacy section); hidden V2 preview; **legacy data preserved, not deleted, not backfilled** |

Treat these as **known architecture notes** — legacy paths remain reachable but separated; DB-first is the main workflow (§6AD).

### Manual smoke record (gate **PASSED**)

**Smoke gate status:** **PASSED** manually (recorded after docs **`3ec6f42`**).

**Passed (in order):** **§6AE.5** (3J3E option persistence) → **§6AF.9** (pricing trust) → **§6AD.7** (full DB-first foundation).

**Notes:** **Preview / Send / Sign / Payment remain disabled.** **3J4F customer text pages** (`bfa0454`, §6AJ) — do not reintroduce old Overview/workspace-tab workbench.

**Browser checks (confirmed in smoke pass):**

1. **Fresh packet** — **CONFIRMED** post-`c12ea4d`: clean contact/property fields; Continue creates new job UUID; Job Card shows persisted packet details; refresh preserves info.
2. **Second packet** — **CONFIRMED** post-`c12ea4d`: return to packet starts clean; second packet yields different UUID and correct details; stale saved-estimate data does not bleed into packet-created Job Card.
3. **Direct Job Card** — **CONFIRMED** post-`c12ea4d`: refresh preserves identity from DB (`JobRecord`).
4. **Customer link preservation** — **CONFIRMED** (smoke pass): link customer from packet job; hard refresh; packet name/email/phone/address still present.
5. **Measurement re-save** — **CONFIRMED** (smoke pass): save 2400 → refresh → re-save 2500 → refresh; no `quantity_map` / line field wipe.
6. **DB Job Board partition** — **CONFIRMED** (smoke pass): DB job in primary board; legacy in separate section; reopen via `job=` without `loadSaved=` / `from=board`.
7. **Clean job= identity** — **CONFIRMED** (smoke pass): no legacy session bleed on DB job card routes.
8. **Proposal DB-only flow** — **CONFIRMED** (smoke pass): create when checklist ready; reuse on second click; invalid `proposal=` shows error without silent fallback.
9. **Board-origin Job Card** — **CONFIRMED** (smoke pass): legacy board path still works; cannot create DB proposal without DB identity.
10. **Activity rail** — **CONFIRMED** (smoke pass): blocked gates show blocker copy; ready gates show **Proposal Builder ready**; copy does **not** imply Send/PDF/Payment/pricing is live.
11. **Builder route (real gates)** — **CONFIRMED** (smoke pass): blocked/ready states on live gated job.

### Must-fix-before-3I (architecture — code items)

1. ~~**Activity rail copy**~~ — **DONE** (`abd718d`).
2. ~~**Fresh packet intake reset** (navigate-away/back)~~ — **DONE** (`abd718d`); **same-URL** re-entry + full draft lifecycle — **Future/Later** (see below).
3. ~~**Job Card `?job=` identity (minimal)**~~ — **DONE** (`abd718d`); full `JobCardViewModel` — **Future/Later**.
4. ~~**3H-2 line preview**~~ — **DONE** (`00fbf64`) — uses job measurement + template graph; **not** legacy estimator fields; Builder-route-only.
5. ~~**3H-3 quantity resolver**~~ — **DONE** (`40e6720`) — pure/read-only; **not** wired to pricing totals or persistence.
6. ~~**3I-0 pricing type contract**~~ — **DONE** (`6f9cbe1`) — `proposalPricingTypes.ts`.
7. ~~**3I-1 pricing engine decisions**~~ — **DONE** (§6H `ac589d8`; implemented §6I).
8. ~~**3I-1A pure pricing engine**~~ — **DONE** (`162f9be`, `1ddee44`, `d67910d`).
9. ~~**3I-1B pricing input mapper**~~ — **DONE** (`52b7148`).
10. ~~**3I-2 read-only Builder pricing preview**~~ — **DONE** (`5626c47`–`637b85a`) — see **§6K**.
11. ~~**3I-3A pricing-policy source-of-truth spec**~~ — **DONE** (§6L).
12. ~~**3I-3B resolve real company pricing policy**~~ — **DONE** (`79c4b02`, §6Q).
13. ~~**3I-3C internal profitability rail**~~ — **DONE** (`3491e48`, §6T).
14. ~~**3J0 snapshot types**~~ — **DONE** (`3ae5e39`, §6Z).
15. ~~**3J1 persistence (SQL)**~~ — **DONE** — applied + verified (§6AA).
16. ~~**3J2 lib persistence spine**~~ — **DONE** (`13b4e72`, §6AB).
17. ~~**3J3 Job Card → persisted Builder draft flow**~~ — **DONE** (`e38b276`, §6AC).
18. ~~**3J3E option selection persistence**~~ — **DONE** (`a7249b3`, §6AE) — smoke **§6AE.5 PASSED**; Preview/Send/Sign/Payment still disabled.
19. ~~**Pricing trust hardening**~~ — **DONE** (`ce3d6bc`, §6AF) — smoke **§6AF.9 PASSED**; pricing engine/math untouched.
20. ~~**DB-first smoke gate**~~ — **PASSED** (§6AD.7; `0763799`).
21. ~~**3J4C document-first Builder**~~ — **DONE** (`f8bffde`, §6AG) — inline Estimate document; Proposal Helper inspector; Overview + workspace tabs removed; **do not revert**.
22. ~~**3J4D Estimate readability**~~ — **DONE** (`c42a559`, §6AH).
23. ~~**3J4E package/options surface**~~ — **DONE** (`72768ae`, §6AI).
24. ~~**3J4F customer text pages**~~ — **DONE** (`bfa0454`, §6AJ).
25. ~~**3J4G-Roadmap proposal content architecture**~~ — **DONE** (`57108bd`, §6AK).
26. ~~**3J4G seed fallback copy**~~ — **DONE** (`ce7aa39`, §6AK).
27. ~~**3J4H-R Roofr IA correction**~~ — **DONE** (`40e5f5b`, §6AK).
28. ~~**3J4H Pass 2 helper**~~ — **DONE** (`8c04c2a`).
29. ~~**R0 Recovery Playbook**~~ — **DONE** (`f1dba95`, §6AL).
30. ~~**R1 Global IA / module map**~~ — **DONE** (`b70cdd7`, §6AM).
31. ~~**R2 Jobs Board / saved identity**~~ — **DONE** (`2e1c36b`, §6AN).
32. ~~**R3 Proposals hub ownership**~~ — **DONE** (`5927ab5`, §6AO).
33. ~~**R4–R6 Template content editor**~~ — **DONE** (`9db2030`–`3c6214c`).
34. ~~**R7–R8**~~ — **DONE** (`05b9c54`, `1191ddd`).
35. ~~**R9 Job Card proposal create/open**~~ + ~~**Pre-R10 P1**~~ — **DONE/satisfied** (`d0ba188`, §6AP).
36. ~~**R10 Template structure + estimate settings**~~ — **DONE** (`bc42b1e`–`b3dd904`, §6AQ).
37. ~~**R11 Settings branding expansion**~~ — **DONE** (`0146dac`–`139e8a3`, §6AR).
38. ~~**R11c context_echo stamping**~~ — **DONE** (`29722a0`, §6AS).
39. ~~**R12 customer identity context_echo stamping**~~ — **DONE** (`31059e3`, §6AT).
40. ~~**R13 frozen document token foundation**~~ — **DONE** (`e40db30`, §6AU).
41. **Next** — **R15 scoping/planning** (explicit direction only); **R16** Proposals hub later.

---

### Core no-drift architecture

FieldDive follows a **Roofr-style** path — not a random estimator rebuild:

```
Job Card
  → Measurement Records
  → Catalog / Price Book
  → Proposal Templates
  → Proposal Builder
  → Proposal Output (customer-facing)
  → Approval / Payment / Status (protected legacy today)
  → Material Orders / Work Orders / Invoices / Job Costing (later)
```

**Do not skip layers.** Do not jump from Measurement to Proposal Builder without Catalog + Templates. Do not wire Catalog into legacy pricing `useMemo` until catalog/template/proposal architecture and Builder preview are ready. Do not use Manual Estimate as the active path. Do not use `service_items` as catalog truth without an explicit migration plan.

### Required first step in any new chat

Before any code:

```bash
git status --short
git log --oneline -15
```

Open `docs/fielddive-global-handoff.md` and **§11** (this section). Confirm HEAD vs doc checkpoint. **No implementation** until repo truth matches.

**Inspect (minimum):**

| File | Why |
|------|-----|
| `docs/fielddive-global-handoff.md` | This handoff + roadmap |
| `app/tools/roofing/catalog/page.tsx` | Canonical catalog route |
| `app/tools/roofing/catalog/CatalogSetupClient.tsx` | Catalog workspace orchestrator (D2) |
| `app/tools/roofing/templates/TemplatesSetupClient.tsx` | Templates workspace orchestrator (D2) |
| `app/admin/catalog/page.tsx` | Redirect to `/tools/roofing/catalog` |
| `app/admin/catalog/CatalogAdminClient.tsx` | Thin wrapper → `CatalogSetupClient` |
| `app/admin/catalog/components/*` | Table, toolbar, detail panel (shared) |
| `app/tools/roofing/jobCard/JobCardProposalsSetupLinks.tsx` | Job Card Proposals tab catalog/templates links (3G6E) |
| `app/tools/roofing/FieldDiveAppShell.tsx` | Sidebar nav (`activeNav`) |
| `app/admin/AdminNavLinks.tsx` | Admin nav (if touching admin) |
| `app/admin/price-book/PriceBookAdminClient.tsx` | Legacy `service_items` — do not conflate |
| `app/admin/customers/CustomersAdminClient.tsx` | Admin context only |
| `app/lib/catalogTypes.ts` | Catalog contracts |
| `app/lib/catalogStore.ts` | Catalog DB I/O |
| `app/lib/defaultRoofingCatalog.ts` | 13 starter defs |
| `app/lib/defaultRoofingCatalogInstall.ts` | Catalog install helper |
| `app/lib/catalogReadiness.ts` | Catalog readiness |
| `app/lib/proposalTemplateTypes.ts` | Template contracts |
| `app/lib/proposalTemplateStore.ts` | Template DB I/O |
| `app/lib/defaultRoofingProposalTemplates.ts` | Passive roof replacement template |
| `app/lib/defaultRoofingProposalTemplateInstall.ts` | Template install helper |
| `app/lib/measurementProposalHandoff.ts` | Measurement → proposal input (passive) |
| `app/tools/roofing/RoofingClient.tsx` | Job Card — catalog/proposal readiness **only** (not full file drive-by) |

Confirm: proposal buttons disabled on Job Card; `installDefaultRoofingCatalog` click-only from catalog route; `installDefaultRoofingProposalTemplates` click-only from templates route; **no** template install from Job Card.

---

### Stage 0 — Commit global handoff doc — **DONE**

- `4b5016e` — Add FieldDive global handoff doc
- Ongoing updates (e.g. `34a934a`) — keep doc aligned with HEAD after each major stage

**Purpose:** Repo-local no-drift source; do not rely on chat memory alone.

---

### Stage 3F6C — Catalog setup cohesion / Job Card guidance — **PARTIAL (3F8 Pass E)**

**Goal:** Job Card guides users to company catalog setup without becoming an admin screen.

**Done in 3F8 Pass E (`d422ee6`):**

- **Open catalog setup** link → `/tools/roofing/catalog`
- **Catalog setup** wording (removed **Catalog / Price Book** from Job Card readiness path)
- Proposal buttons stay disabled

**Optional follow-up (not blocking 3F9):**

- Further readiness polish / secondary link placement if UX review finds gaps

**Rules (unchanged):**

- No hidden auto-install on Job Card load
- Do not call `installDefaultRoofingCatalog` from Job Card unless explicitly scoped later
- Proposal buttons stay disabled

**Likely files for any follow-up:** `app/tools/roofing/RoofingClient.tsx`, possibly `app/lib/catalogReadiness.ts`

**Do not touch:** pricing `useMemo`, `saveEstimate`, send/PDF, approval, payment, status, SavedClient, `estimateStore`, `service_items`, `PriceBookAdminClient`

**Suggested commit if finishing remainder:** `Refine Job Card catalog setup guidance`

---

### Stage 3F7 — Real Catalog Admin / Edit Surface — **DONE (3F7A + 3F7B)**

Catalog setup lives at **`/tools/roofing/catalog`** inside FieldDive shell (`01e2d9e`). Contractor can install starter catalog, view rows, and edit scoped pricing fields.

| Sub-stage | Status | Commit / notes |
|-----------|--------|----------------|
| **3F7A** Read-only installed list | **DONE** | `6b37370` — table in `CatalogAdminClient` |
| **3F7B** Inline price/config edit | **DONE** | `81a70e3` — `updateCatalogItem`; no pricing bridge |
| **3F7C** Catalog readiness refinements | **DONE (via 3F8)** | Pass B + Job Card link in Pass E |

**Deferred in 3F7B:** `active` toggle, structural edits (`quantity_source`, `unit`, `item_type`), create/delete, `metadata`/seed_key edits.

**Suggested commit if finishing 3F7C:** `Refine catalog pricing readiness` (may fold into **3F8**)

---

### Stage 3F8 — Catalog Product Surface Alignment — **DONE**

**Why it ran:** 3F7A/3F7B delivered data + starter install + scoped pricing edit, but Roofr alignment audit found the **product surface** was still table-first. Templates UI (3G6) should not sit on a catalog page that does not feel like Roofr’s foundational **Manage Catalog / Quick Start** workspace.

**Roofr-informed goal (achieved):** Company catalog setup at `/tools/roofing/catalog` that guides: **install → price → templates**, without touching protected systems.

| Pass | Commit | Deliverable |
|------|--------|-------------|
| **Pass B** | `a16bccd` | Catalog setup hub, readiness/copy alignment, Price Book (Legacy) sidebar clarity |
| **Pass C-D** | `5bcf0fe` | Search/filter/group/unpriced, add item, show inactive, deactivate/reactivate, pricing queue, disabled roadmap cards |
| **Pass E** | `d422ee6` | Component refactor, focused item detail panel, Job Card catalog setup link/copy |

**Final product state:**

- Catalog page is a **setup workspace**, not just an admin table.
- Setup hub/spine: starter catalog → configure pricing/items → templates next.
- Search, filter, group, unpriced-only, guided pricing queue, add item, show inactive, deactivate/reactivate.
- Item editing via **focused detail panel** (not colspan row expand); structural fields read-only.
- `CatalogAdminClient` orchestrator + `catalogAdminConstants.ts`, `catalogAdminUtils.ts`, `components/*`.
- Job Card **Open catalog setup** → `/tools/roofing/catalog`; **Catalog setup** wording cleaned up.
- Proposal/template buttons on Job Card **remain disabled**.
- **Explicitly not in 3F8:** pricing bridge, Proposal Builder, template route/wiring, material orders, CSV/manufacturer/supplier import, structural field editing, protected systems.

**3F8 protected-systems note:** Catalog UI + scoped Job Card catalog link/copy only. **No SQL.** No routes/stores/migrations. No pricing, payments, approval, status, saved estimates, send/PDF, proposal template wiring, or legacy Price Book behavior changed.

**Files touched (3F8):** `CatalogAdminClient.tsx`, `catalogAdminConstants.ts`, `catalogAdminUtils.ts`, `components/*`, scoped `RoofingClient.tsx` Job Card regions; Pass B also `catalogReadiness.ts`, `FieldDiveAppShell.tsx`.

---

### Stage 3F9 — Jobs / Execution Surface Alignment — **3F9C COMPLETE; 3F9B4 JOBS BOARD SAVE POINT PRESERVED**

**Why now:** Roofr visual/architectural research shows Roofr’s **operational center is Jobs / Job Board**, not a separate summary Dashboard. Roofr’s Job Board gives bird’s-eye pipeline visibility with stage columns and job cards. Roofr’s **Job Card** is the execution launchpad for measurements, proposals, material orders, invoices, activity, and communication.

FieldDive currently has separate **Dashboard**, **Job Packet**, and **Job Card** surfaces. **Do not improve the current Dashboard-first pattern in isolation** — start from Roofr’s better direction and improve it:

```
Jobs / Pipeline     → operational command board
Job Card            → execution launchpad
Job Packet          → lightweight intake/prep
Catalog + Templates → company setup surfaces
Proposal Builder    → launched from Job Card when gates pass (3H-1 live)
```

#### 3F9A/B — Jobs-first IA and shell alignment — **DONE** (`0f0181a`)

**Goal:** Nav/copy/surface alignment only — no route or behavior changes.

**Changes:**
- Sidebar: single **Jobs Board** nav item → `/tools/roofing/saved` (`activeNav="jobs"`); removed duplicate **Dashboard** + **Jobs Pipeline** pair
- **Templates** nav item added after **Catalog** with **Soon** badge (no route — 3G6)
- Saved page reframed: **Jobs Board** title; intelligence layer (Today’s Attention, Job Movement) stays on the board
- Loading copy: “Loading Jobs Board…” (was Command Center)

**Files:** `FieldDiveAppShell.tsx`, `SavedClient.tsx` (copy only), `saved/page.tsx` (loading copy)

**Explicitly not in 3F9A/B:** drag-and-drop board rewrite, saved estimate card actions, payment/status/send, routes, stores, RoofingClient business logic

#### 3F9B2 — Board-first Jobs Board redesign — **DONE (`8781ecd`)**

**Goal:** Roofr-class operational board — stage columns as primary canvas, scannable job cards, no dashboard sidebar widgets.

**Changes:**
- Extracted `jobsBoardUtils.ts`, `JobsBoardHeader`, `JobsBoardFilterBar`, `JobsBoardColumn`, `JobsBoardCard`
- **7 workflow columns:** Draft, Sent/Waiting, Approved, Ready to Schedule, Scheduled, On Site, Completed
- Quick filter chips; board default when `statusFilter === "all"`
- **Removed from default board:** Today's Snapshot, Recent Movement, Quick Actions rail, old attention KPI cards

**Files:** `SavedClient.tsx`, `jobsBoardUtils.ts`, `saved/components/*`

#### 3F9B3 — Roofr Jobs Board visual baseline + stage/category alignment — **DONE (`36fa3a9`)**

**Goal:** Roofr Job Board look/feel plus workflow-aligned display labels and category grouping. Display-only — no status value or mutation changes.

**Rejected/reverted before earlier pass:** prior fill-space / forced viewport / compressed-column direction.

**Visual baseline:**
- Controlled width, horizontal scroll, fixed `w-72` columns
- Header: title + count, search, New Job only
- Single quick-filter row; no dashboard widgets, Catalog header, Board/List toggle, full-list pills
- Neutral lanes, `(count)` + column value total, column header → lane detail
- Fuller cards, whole-card click, no Open button / fake menu

**Stage/category alignment (display-only):**

| Status key | Board column label | Roofr category band |
|------------|-------------------|---------------------|
| `estimate` | New Lead | New Incoming Leads |
| `sent_pending` | Proposal Sent | Qualified Leads |
| `approved` | Proposal Signed | Qualified Leads |
| `deposit_paid` | Ready to Schedule | Won Jobs |
| `scheduled` | Scheduled | Won Jobs |
| `in_progress` | Production | Won Jobs |
| `paid` | Completed | Completed |

- **Category bands:** visual-only grouping above column groups (`JOBS_BOARD_CATEGORY_GROUPS`)
- **Contextual card signals:** blockers win; proposal chips in early stages; measurement when unmeasured early; deposit chips on Proposal Signed / Ready to Schedule; scheduled date in Scheduled / Production
- **Lane detail copy** updated to match workflow labels (behavior unchanged)

**Prior checkpoint:** `8781ecd` (3F9B2)

**Files:** `SavedClient.tsx`, `jobsBoardUtils.ts`, `saved/components/*`, `docs/fielddive-global-handoff.md`

**Explicitly not in 3F9B3:** drag/drop, direct movement, new status values, Lost/Unqualified columns, lane drawer, selected preview, tags, assignees, protected paths

**Future/Later:** drag/drop, direct movement, Lost/Unqualified outcome stages (need status spine), lane drawer, selected-job preview, tags, assignees, saved views, board → job uuid spine, catalog/template board chips

#### 3F9B4-RoofrExact — Job Board visual and controls checkpoint — **DONE**

**Goal:** Roofr Job Board visual/control/card anatomy save point — **approved screenshot checkpoint**. This is a **save point, not the final Jobs Board**. Display-only board work; no protected behavior changes.

**Controls & shell:**
- Roofr-style **Job Board** page title and nav label (`FieldDiveAppShell` → **Job Board**)
- **Search** with × clear (search-only; does not reset filters)
- **Board | List** toggle — view mode persisted in `sessionStorage` key `fielddive.jobBoard.viewState`
- **Filters & sort** panel: Sort · Stages · Updated on or after · Clear filters
- **Sort:** Last updated (default), Created date, Address value, Time in stage — within columns only
- **New Job** action present
- **No** quick-chip row
- **No** FieldDive attention/smart filter row

**Board canvas:**
- Roofr category bands (New Incoming Leads, Qualified Leads, Won Jobs, Completed)
- Horizontal scroll; ~352px lanes; column header → lane detail (unchanged behavior)
- Column count + column value total on headers

**Cards (Roofr anatomy — real FieldDive data where available):**
- Customer name + value (top row)
- Address with map pin
- Icon/metadata grid: tasks placeholder (`Tasks 0/0`), report status, proposal status, assignee placeholder (`—`)
- Footer: clock + time in stage (left), last updated (right)
- Fuller card scale — not compact list rows
- **No** FieldDive blocker chips on default board cards (Follow-up due, Deposit needed, Schedule needed, Proposal viewed, etc.)

**List View:** read-only table; same search/filters; row click → load job (unchanged `loadSaved` path)

**Explicitly not in this checkpoint:** drag/drop, direct movement, real tasks/subtasks data, real assignees, tags, saved views, Lost/Unqualified columns, lane drawer / selected preview, Copilot / voice, automations, protected pricing/payment/status/send/PDF/saved-estimate mutation paths

**Prior checkpoint:** `36fa3a9` (3F9B3)

**Files:** `SavedClient.tsx`, `jobsBoardUtils.ts`, `JobsBoardHeader.tsx`, `JobsBoardFiltersSort.tsx`, `JobsBoardFilterBar.tsx` (deprecated stub), `JobsBoardColumn.tsx`, `JobsBoardCard.tsx`, `JobsBoardListView.tsx`, `FieldDiveAppShell.tsx`, `docs/fielddive-global-handoff.md`

**Future/Later (Jobs Board spine deferrals — preserved):**
- drag/drop and direct movement between stages
- stage blocking tasks
- tasks/subtasks real data
- assignees
- tags
- saved views
- Lost/Unqualified statuses
- archive/history/reporting views
- board-to-job uuid spine
- lane drawer / selected preview
- Copilot / voice commands
- automations
- **Board display density / visible card count control:** explore a future filter/view setting that lets users choose how many job cards/customers display in a lane or view so the board does not feel too long. If proven useful, cards/columns could align based on visible column count and selected display density. **Research first; do not implement now.**
- **3F9C** Job Card architecture + visual shell — **DONE** (`0015be1`)
- **3G6** Templates setup/readiness/install surface
- Proposal Builder
- pricing/payment/status/send/PDF protected paths

#### Jobs Board refinement — **OPTIONAL / DEFERRED**

**Goal:** Close remaining Roofr parity gaps on the approved checkpoint — lane polish, card density tuning, List View polish, any screenshot-driven gaps. **Do not reset the board direction.** Jobs Board reached approved save point at **`b27a444`**; further board polish is optional and not blocking **3G6**.

#### 3F9C — Job Card architecture + visual shell — **DONE (`0015be1`)**

**Goal:** Roofr-style Job Card as execution hub — functional tabs, identity band, metadata strip, Activity rail; board-origin vs packet-origin context; no Proposal Builder activation.

**Committed:** `0015be1` — `3F9C: Roofr Job Card architecture and visual shell`

**Prior Jobs Board checkpoint (unchanged):** `b27a444` (3F9B4-RoofrExact)

**What was completed:**

| Area | Delivered |
|------|-----------|
| **Origin / routing context** | Board-origin vs packet-origin fixed; `from=board` persists board-origin Job Card context after `loadSaved` URL cleanup |
| **Hook fix** | React hook dependency bug fixed — stable primitive dependencies (`loadSavedId`, `entryParam`, `isBoardOriginParam`, `jobParam`); no `searchParams` object in origin effect deps |
| **Sidebar** | **Job Board** highlighted for board-origin Job Cards; **New Job** for packet-origin Job Cards |
| **Back link** | Origin-aware: **Back to Job Board** → `/tools/roofing/saved` (board); **Back to Job Packet** → `/tools/roofing?entry=packet` (packet) |
| **Header** | Identity band with real customer/address/stage/value; phone/email with muted “Not entered”; static Draft/Intake chips **removed**; floating disabled Create proposal **removed** from header |
| **Metadata strip** | Time in stage, last updated, report, proposal — no duplicate stage; no fake task counts |
| **Tabs** | Functional section nav (underline style); only active tab panel renders |
| **Shell** | Old stacked accordion dump removed; unified white shell card; main workspace + ~300px Activity rail |
| **Overview** | `JobCardOverviewSummary` — job summary + status cards + quick links to core tabs |
| **Activity rail** | Timeline-style static events with grounded timestamps; **no** Next Actions checklist |
| **Readiness rail** | Old Next Actions checklist **removed**; duplicate Readiness checklist **removed** |
| **Measurements** | Manual measurement save behavior **preserved** |
| **Proposals** | Catalog link **preserved**; at 3F9C commit **+ Proposal** was disabled — **superseded by 3H-1** (`feec663`): enabled when Builder gates pass |
| **Scope** | **No** 3G6 Templates work; **no** protected systems touched |

**New component files (`app/tools/roofing/jobCard/`):**

- `JobCardHeader.tsx`, `JobCardMetadataStrip.tsx`, `JobCardTabs.tsx`, `JobCardSectionPanel.tsx`, `JobCardActivityPanel.tsx`, `JobCardOverviewSummary.tsx`, `jobCardTypes.ts`

**Also modified:**

- `app/tools/roofing/RoofingClient.tsx` — `renderJobCardShell()`, origin state, `FieldDiveAppShell` `activeNav`
- `app/tools/roofing/saved/jobsBoardUtils.ts` — `JobCardDisplayModel`, `buildJobCardDisplayModel()`

**Manual browser checks — PASSED (user confirmed before commit):**

- `/tools/roofing?entry=packet` loads without hook dependency error
- Job Board → New Job → Job Packet works; sidebar **New Job**
- Job Packet → Continue to Job Card: sidebar **New Job**; **Back to Job Packet**
- Job Board → existing card → Job Card: sidebar **Job Board**; **Back to Job Board**; URL cleanup preserves `from=board`
- Refresh board-origin Job Card URL with `from=board` preserves Job Board context
- Tabs switch correctly; only active panel visible; Activity rail appears
- No Next Actions / duplicate Readiness rail on Job Card
- Measurements manual save behavior preserved
- Proposals catalog link and disabled actions preserved
- No protected behavior changed

**Typecheck (at commit time):**

- Job Card / `RoofingClient.tsx` / `jobCard/*` / `jobsBoardUtils.ts` — **clean**
- Pre-existing **6 errors** in `app/tools/roofing-v2/RoofingClientV2.tsx` only — unchanged, not part of 3F9C

**3F9C protected-systems note — untouched:**

- Pricing engine, payments, approval/status mutation, send/PDF, saved estimate mutation behavior, `loadSaved` restore body, `markSavedEstimateStatus`, stores, routes, migrations, Proposal Builder, template setup UI, material order/invoice/work order creation, SQL

**Where we stopped:**

Committed **`0015be1`** after manual browser checks passed. **Do not move to 3G6 without explicit scoping** — but **3F9C is done**; 3G6 is the recommended next spine stage.

**Optional before 3G6:** One small Job Card polish/screenshot review pass — not required if current UI is approved.

**Explicitly not in 3F9C:** Templates install UI (3G6), Proposal Builder (3H), pricing bridge, material orders, SQL/migrations, protected systems, attachments upload, real activity backend, real tasks/assignees/tags.

**Likely files for optional Job Card polish (inspect first):** `app/tools/roofing/jobCard/*`, scoped `renderJobCardShell()` in `RoofingClient.tsx` only.

---

### Stage 3G — Proposal Template Foundation — **DONE (3G1–3G5)**

**Why after catalog:** Templates package catalog-backed line items; Builder comes after templates.

| Sub-stage | Status | Commit | Deliverable |
|-----------|--------|--------|-------------|
| **3G1** Type foundation | **DONE** | `d1a205b` | `proposalTemplateTypes.ts` — template/option/section/item, quantity rules, default-def shapes |
| **3G2** Tables migration | **DONE** | `c825942` | Four tables: `proposal_templates`, `proposal_template_options`, `proposal_template_sections`, `proposal_template_items`; RLS; live in Supabase |
| **3G3** Store | **DONE** | `03d9793` | `proposalTemplateStore.ts` — CRUD + graph; not app-wired |
| **3G4** Default definitions | **DONE** | `201ada1` | `defaultRoofingProposalTemplates.ts` — Roof replacement; Standard/Enhanced/Premium |
| **3G5** Install helper | **DONE** | `07b3c1d` | `defaultRoofingProposalTemplateInstall.ts` — insert-only, seed dedupe, catalog seed resolution |
| **3G6** Template setup UI | **DONE** | `15ad732`–`b78c9ee` | Route, install, readiness, D2, Job Card link — see §6 |

**Architecture boundary (hold):**

- **CatalogItem** = reusable line + quantity driver
- **ProposalTemplate** = company package (options, sections, items)
- **Proposal** (job instance + snapshots) = **not built** — `proposalTypes.ts` later in 3H

---

### Stage 3G6 — Templates setup/readiness/install surface — **DONE (`b78c9ee`)**

**Committed through 3G6E.** See **§6** (3G6A–E table) and header **Recent committed sequence**. **This was not Proposal Builder.**

**Preserved boundaries:** click-only installs; catalog gates template install; no Create/Choose proposal; no Job Card template install/store calls; protected pricing/send/approval/payment/status untouched.

**Catalog D2 (`29ca190`):** Recomposed `/tools/roofing/catalog` — starter hero, items workspace primary, compact checklist, inline install feedback; deleted hub/tiles/guide/roadmap-cards/quick-actions as top-level sections; preserved `installDefaultRoofingCatalog`, `deriveCatalogReadiness`, CRUD, pricing queue scroll, add item, detail panel.

---

### Execution surface audits (read-only, 2026) — Job Card & Job Packet

**Job Card audit (pre-3G6E):** Aligned enough for passive templates link. Correct **execution hub** shape: customer identity header, origin-aware back links, metadata strip, tabs, functional **Measurements** workspace, **Proposals** shell, Activity rail. **No full Job Card D2** required before 3G6E.

**Job Card — future/later (non-blocking):**

- Extract Proposals tab → `JobCardProposalsPanel.tsx` (partially started via `JobCardProposalsSetupLinks.tsx`)
- Maybe extract Measurements tab
- Trim duplicate catalog/status lines between Overview and Proposals
- Revisit inert tabs / stage-gating later
- **3H:** Proposals tab becomes true Proposal Builder launchpad

**Job Packet audit:** Canonical **`?entry=packet`** / New Job is aligned enough as **capture/prep**. **Packet handoff fix (`fd87152`)** + **intake reset (`abd718d`)** + **session bleed fix (`c12ea4d`)** address stale job id, fresh-field hygiene, and saved-estimate session override on packet-created Job Card — **browser smoke confirmed** post-`c12ea4d`. **Known gap:** same-URL Job Packet click may not re-trigger reset — **packet draft lifecycle** (Start new / Discard / Resume) is a future architecture item, not a casual patch.

**Job Packet — future/later:**

- Retire or hard-gate `?entry=manual&legacy=1` (legacy dark estimate workspace)
- Extract `renderJobPacketWorkbench` into `app/tools/roofing/jobPacket/*`
- Decide whether embedded packet variant inside legacy remains
- Tighten copy (Job Card vs “start a proposal” on packet)
- Simplify right-column placeholders until photos/site visit are real
- Quarantine/remove unused `renderEstimateBuilderShell` when scoped

---

### Pricing (protected + future redesign)

**Now:** Pricing engine / legacy estimator `useMemo`, payments, approval, status, saved estimates, send/PDF are **protected** — unchanged through 3G6A–E and Catalog/Templates D2.

**Rule:** Do **not** casually patch pricing during catalog setup, template setup, or Job Card link work.

**Later:** Pricing must be **deliberately redesigned** for the new FieldDive architecture (not incremental hacks). A future pricing phase should account for:

- Catalog costs and unit prices
- Template line definitions and options (good/better/best)
- Measurement quantities and `quantity_source` resolution
- Contractor vs customer-facing views
- Proposal totals and PDF consistency
- Downstream payment/status effects

**3I — deterministic catalog pricing bridge** remains **after** Proposal Builder can resolve template lines (see below).

---

### Stage 3H — Proposal Builder — **3H-1 DONE (`feec663`); 3H-2 DONE (`00fbf64`); 3H-3 DONE (`40e6720`); 3I+ LATER**

**3H-1 complete:** Builder route/shell, composite gates, read-only context loads, Job Card `+ Proposal` launch. See **§6B**.

**3H-2 complete:** Read-only document-style option/section/line preview from template graph + catalog join. See **§6E**.

**3H-3 complete:** Pure read-only quantity resolver + Builder line row quantity preview. See **§6F**.

**Do not start 3I-3 or 3J until:** explicit scope chosen via architecture pass. **3I-2 complete** — see **§6K**.

**Route (live):** `/tools/roofing/proposals/builder?job=<uuid>`

**Likely new (later stages):** proposal record tables (migration when scoped — **3J**), line snapshots, company pricing policy UI (**3I-3**).

**Suggested commits (completed):** `3I2: add builder pricing preview orchestrator`, `3I2: add customer document pricing preview`, `3I2: add builder pricing status surfaces`

**Explicitly not in 3I-2:** proposal records, PDF/send/approval/payment/status, SQL/migrations, internal profitability dollars, company policy UI, enabling Preview/Send/Sign/Payment.

---

### Stage 3I — Deterministic catalog pricing bridge — **3I-0 + 3I-1 + 3I-2 DONE**

**After** 3H-3 quantity preview is stable. **3I consumes 3H-3 resolved quantities** — not legacy estimator fields or saved-estimate snapshots.

**3I-0 (`6f9cbe1`):** `app/lib/proposalPricingTypes.ts` — policy/input/output/guardrail types; function signatures.

**3I-1 (`162f9be`–`52b7148`) — COMPLETE:** See **§6I**. Pure engine, input hardening, 22 engine tests, input mapper, 16 mapper tests.

**3I-2 (`5626c47`–`637b85a`) — COMPLETE:** See **§6K**. Three slices:

- **3I-2A** — Pure orchestrator + 9 tests; customer/status DTO separation.
- **3I-2B** — Customer document pricing UI (line prices, totals, preview banner).
- **3I-2C** — Option-tab + right-rail status surfaces (Complete/Incomplete, blocking count, guardrail word — no dollars).

**Next within 3I spine:** **3I-3** (company pricing policy + internal profitability planning) — **OR** jump to **3J** (proposal persistence) — **decide via Opus pass before code**.

Run parallel to legacy estimator; do not overwrite `useMemo` until validated and explicitly scoped.

**Suggested next docs commit:** `docs: update handoff after 3I2 builder pricing preview complete`

---

### Stage 3J — Proposal records / persistence — **3J3E + PRICING TRUST + 3J4C–3J4G DONE; §6AL recovery in progress**

**3J0** types (`3ae5e39`), **3J1** SQL (006/007 applied §6AA), **3J2** lib spine (`13b4e72`, §6AB), **3J3** Job Card → persisted Builder draft flow (`e38b276`, §6AC), **3J3E** option selection persistence (`a7249b3`, §6AE), **Pricing trust hardening** (`ce3d6bc`, §6AF), **3J4A** final-surface navigation (`4c9a77d`), **3J4C document-first Builder** (`f8bffde`, §6AG), **3J4D Estimate readability** (`c42a559`, §6AH), **3J4E package/options** (`72768ae`, §6AI), **3J4F customer text pages** (`bfa0454`, §6AJ), **3J4G seed copy** (`ce7aa39`, §6AK), **3J4H-R** (`40e5f5b`, §6AK), **3J4H Pass 2 helper** (`8c04c2a`).

**Open (§6AL order):** **R15 scoping/planning** (explicit direction) → code after scope audit. **R0–R13** complete. **Not** company-level Terms/Warranty defaults. Checklist: **§11** with **§6AL** stage IDs.

**Manual smoke:** **PASSED** — **§6AE.5** → **§6AF.9** → **§6AD.7** (`0763799`). **No Preview/Send/Sign/Payment** until **R17+**.

**Suggested commits:** **3J4H** template content editor (when scoped); **3K** preview/PDF/send (when scoped)

---

### Stage 3K — PDF / send / approval bridge — **LATER (PROTECTED)**

Connect to existing PDF/send/approval only after 3J stable. Do not break Saved Estimate send flow or approval tokens without a bridge plan.

**Suggested commits:** `Add proposal PDF preview from proposal records`, `Add proposal send draft flow`, `Bridge proposal approval token flow`

---

### Stage 3L — Material orders — **LATER**

After signed proposal (Roofr path): material orders from proposal/catalog lines. Tables TBD (`material_orders`, `material_order_lines`).

---

### Stage 3M — Work orders / scheduling / production / job costing — **LATER**

After proposal workflow stable: work orders, crew scheduling, production checklist, invoices, job costing.

---

### Ongoing protected systems

Do not casually touch:

- Pricing `useMemo` / legacy estimator pricing
- `saveEstimate` / `estimateStore`
- Send / PDF (`generateProposalPdfBytes`, `/api/proposal/*`, `/api/estimate/send`)
- Approval / token logic
- Stripe / offline payment truth
- Status / pipeline (`SavedClient`, batch updates)
- Saved estimates restore
- `service_items` / `PriceBookAdminClient` behavior
- `RoofingClient` send/PDF handlers

Any change requires a **separate strict-mode plan**.

---

### What counts as drift

Treat as **drift** if a session:

- Routes users to **Manual Estimate** as the main path
- Uses **`service_items`** as new catalog truth without migration plan
- Wires **`catalog_items`** into current pricing `useMemo` too early
- Enables **Create Proposal** before templates + Builder exist
- Adds **AI pricing**
- **Auto-installs** catalog or templates on Job Card load
- Builds PDF/send/approval bridges **before** proposal records exist
- **Updates/overwrites** seeded catalog or template rows automatically (install must stay insert-only)
- Hides missing prices with invented placeholder totals
- Touches payment/status/approval while doing catalog/template setup
- Makes **Job Card** the catalog/template **editor** instead of linking to setup routes
- Skips **Roofr research** before **3F9** execution-surface alignment or **3G6** templates UI layout
- Starts **3I pricing bridge code** before research/architecture review and explicit scope
- Starts **pricing bridge or proposal persistence** before 3H-3 quantities are consumed by deliberate pricing architecture (3I)
- Assumes **catalog table + store** equals Roofr-style **product completion** (3F8 addressed this — do not regress)
- Regresses **Catalog D2** or **Templates D2** into readiness-dashboard-first layouts (3G6D2/D3 corrected this)
- Iterates on FieldDive’s **Dashboard-first** pattern instead of aligning to Roofr’s **Jobs / Job Board** operational center
- **Over-polishes Builder presentation** instead of building **proposal content infrastructure** (§6AK.9)
- **Hardcodes seed copy** and treats `defaultRoofingProposalTemplates.ts` as the **final** contractor-controlled system
- **Builds a company-level Terms/Warranty content store** before template editor (§6AK.6)
- **Puts proposal content defaults under `/admin/*`** (§6AK.6)
- **Treats Settings as the home for reusable proposal prose** instead of templates (§6AK.6–§6AK.7)
- **Builds template editor** before documenting Roofr IA correction (3J4H-R)
- **Edits catalog item definitions inside templates** (Roofr: catalog is source; no catalog detail editing at template level)
- **Builds job-specific editor** before reusable template editing
- **Builds Preview/PDF/Send** before template and job content semantics are stable
- **Builds Cover/Photos** before **media storage** exists
- **Returns to `loadSaved` / `currentSaved`** as the main proposal workflow
- **Reintroduces Overview/workspace tabs** or enables **Preview/Send/Sign/Payment** too early
- **Invents FieldDive-only proposal flows** instead of Roofr multi-page document shape
- **Skips §6AL recovery order** or jumps downstream before upstream stop gates
- **Builds template editor UI** before **R0–R3** docs gates
- **Migrates Proposals hub route** before **R16** plan is documented (**R3**)
- **Enables lifecycle** (Preview/Send/Sign/Payment) before **R17** prerequisites

---

### Future / Later bucket (Roofr audit + spine deferrals)

**Catalog (beyond 3F8 — deferred):**

- CSV import / export
- Manufacturer / roofing-system import (Atlas, BP, CertainTeed, GA, IKO, Owens Corning, etc.)
- Roofr **Jumpstart**-style dual-panel system + item picker (preview, remove, save)
- Waste % and **tax** fields (sales tax, material purchase tax) on catalog rows
- Supplier integrations: **ABC / QXO / SRS**, live supplier pricing, SKU mapping
- Material orders / work orders from catalog lines
- Template / proposal **usage indicators** on catalog rows (“used in N templates”)
- Bulk edit, duplicate, archive at scale
- Section headings, drag reorder, endless scroll for large catalogs
- Structural edits to `quantity_source`, `unit`, `item_type` with template-impact warnings

**Templates & proposals (after 3F9 / later):**

- **3G6** — **DONE** (`b78c9ee`) — Templates route, D2 workspace, Job Card passive link
- **3H-1** — **DONE** (`feec663`) — Proposal Builder shell + gates; Job Card launch when ready
- **3H-2** — **DONE** (`00fbf64`) — Read-only document-style line/option preview; Builder-route-only
- **3H-3** — **DONE** (`40e6720`) — Pure read-only quantity resolver + line row quantity preview; Builder-route-only
- **3I** — New proposal pricing architecture / deterministic catalog pricing bridge — **NEXT PLANNED (planning only)** — must consume 3H-3 quantities; not until research/architecture review + explicit scope
- **3J** — Proposal records / line snapshots — **LATER**
- **3K** — PDF / send / approval / payment adapters — **LATER** (protected paths today)
- Signatures / co-signers, financing blocks
- Warranty / legal content management
- New catalog upgrade SKUs (premium shingle lines, extended warranty fee items)
- Template versioning / publish workflow
- Job Card **3G6E** templates link when catalog ready — **DONE** (`JobCardProposalsSetupLinks.tsx`); per-job template **selection** remains later
- **Job Packet draft lifecycle** — Start new packet / Discard current draft / Resume draft (includes same-URL re-entry reset; **do not** casual-patch)
- **Jobs Board migration** from saved-estimate cards to `public.jobs` or explicit bridge
- **Job Card identity** — full `JobCardViewModel` from `JobRecord` (minimal `?job=` display **done** in `abd718d`; packet session bleed **fixed** in `c12ea4d`)
- **Hard-gate or retire** `?entry=manual&legacy=1`; remove dead `renderEstimateBuilderShell`
- ~~**Proposal line preview** (3H-2)~~ — **DONE** (`00fbf64`)
- ~~**Proposal quantity preview** (3H-3)~~ — **DONE** (`40e6720`)
- **3H-3 deferred polish (non-blocking):** disposal unit label (“tons” vs “each”); `roof_squares` map fallback edge case — review before pricing/material orders
- **3H-3 deferred (by design):** `coverage_rate` / bundle conversion; exact vs rounded quantity setting; manual quantity overrides UI; `labor_multiplier` / custom quantity sources; material order quantities
- **Proposal records / line snapshots** (persistence) — later, after 3I architecture (3J)
- **PDF / send / approval / payment / status** — later (protected paths today)
- **Material orders / work orders / invoices / job costing** — later
- Inactive catalog item warnings in template install UI

**Proposal Builder — document-first (3J4C–3J4G complete; §6AL recovery order):**

**Recovery docs + template editor (R0–R9 complete):**

- ~~**R0**~~ — Recovery Playbook (§6AL) — **DONE** (`f1dba95`)
- ~~**R1**~~ — Global IA / module ownership map (§6AM) — **DONE** (`b70cdd7`)
- ~~**R2**~~ — Jobs Board / saved identity (§6AN) — **DONE** (`2e1c36b`)
- ~~**R3**~~ — Proposals hub ownership (§6AO) — **DONE** (`5927ab5`)
- ~~**R4–R6**~~ — Template content editor — **DONE** (`9db2030`–`3c6214c`)
- ~~**R7–R8**~~ — Light IA nav + Jobs Board identity — **DONE** (`05b9c54`, `1191ddd`)
- ~~**R9**~~ + ~~**Pre-R10 P1**~~ — **DONE/satisfied** (`d0ba188`, §6AP)
- ~~**R10**~~ — **DONE** (`bc42b1e`–`b3dd904`, §6AQ)

**Next (§6AL):**

- ~~**R11**~~ — **DONE** (`0146dac`–`139e8a3`, §6AR)
- ~~**R11c**~~ — **DONE** (`29722a0`, §6AS) — company branding context_echo; no Builder cover UI
- ~~**R12**~~ — **DONE** (`31059e3`, §6AT) — customer identity context_echo; no Builder customer display
- ~~**R13**~~ — **DONE** (`e40db30`, §6AU) — frozen document token foundation; no Builder UI
- **R15** — **scope first** after explicit direction (§6AU)
- **R16** — Proposals hub — interim `/tools/roofing/templates` until hub ships

**Completed document-first Builder slices:**

- ~~**3J4C document-first Builder**~~ — **DONE** (`f8bffde`, §6AG)
- ~~**3J4D Estimate readability**~~ — **DONE** (`c42a559`, §6AH)
- ~~**3J4E package/options surface**~~ — **DONE** (`72768ae`, §6AI)
- ~~**3J4F customer text pages**~~ — **DONE** (`bfa0454`, §6AJ)
- ~~**3J4G-Roadmap**~~ — **DONE** (`57108bd`, §6AK)
- ~~**3J4G seed copy**~~ — **DONE** (`ce7aa39`)
- ~~**3J4H-R Roofr IA correction**~~ — **DONE** (`40e5f5b`, §6AK)

**Later (§6AL stage IDs):**

- **R10 / 3J4I** — template page/content structure + estimate settings drawer — **next after audit**
- **R11** — company branding/identity in Settings — **not** Terms/Warranty prose
- **R12 / 3J4J** — job-specific proposal page editor (`updateProposalPage`)
- ~~**R13**~~ — frozen document token foundation — **DONE** (`e40db30`, §6AU)
- **R14** — media foundation (Cover / Photos / PDF / measurement-report)
- **R15** — Builder layout alignment (left rail + right settings drawer)
- **R16** — Proposals module/dashboard (Draft/Sent/Won/Lost)
- **R17 / 3K0** — Preview / Present
- **R18 / 3K1** — Send / PDF transmit
- **R19 / 3K2** — Sign / approval bridge
- **R20 / 3K3** — Payment / deposits
- **R21 / 3L–3M** — production conversion (work orders, material orders, invoices)
- **R22** — automations / follow-ups
- **R23** — legacy cleanup (`estimateStore`, admin silos, status lanes)

**Architecture reference:** content model **§6AK**; mandatory order **§6AL**; open checklist **this section only** — no duplicate playbook.

**Jobs Board (3F9B4 follow-on / Future/Later):**

- drag/drop and direct movement between stages
- stage blocking tasks
- tasks/subtasks real data
- assignees
- tags
- saved views
- Lost/Unqualified statuses
- archive/history/reporting views
- board-to-job uuid spine
- lane drawer / selected preview
- Copilot / voice commands
- automations
- **Board display density / visible card count control:** explore a future filter/view setting that lets users choose how many job cards/customers display in a lane or view so the board does not feel too long. If proven useful, cards/columns could align based on visible column count and selected display density. **Research first; do not implement now.**

**Execution surfaces (optional polish / non-blocking if deferred):**

- Dashboard vs Jobs/Pipeline visual polish and IA clarity
- Job Packet intake polish
- Job Card tab content polish (Measurements/Proposals empty states, placeholder tabs) — **3F9C shell complete**
- Jobs Board refinement (3F9B4 follow-on — lane/card density; **`b27a444`** save point preserved)

**Operations (later spine):**

- Material orders (3L), work orders, invoices, job costing (3M)
- Instant Estimator catalog bridge
- `service_items` → `catalog_items` migration (explicit plan only)
- Attachments upload, notes/comms/activity real backend, insurance section, supplier integrations

---

### Recommended immediate next choice

**Best next move:**

1. **R0** — commit RoofrExact Recovery Playbook (§6AL) — **docs only**
2. **R1–R3** — IA/module + Jobs Board + Proposals hub ownership docs (docs only)
3. **R4** — 3J4H Pass 3B view-model helper (after R0)
4. **R5–R6** — 3J4H workspace + editor save (after R1–R3 + R4)

**Do not** build company-level Terms/Warranty content defaults. **Do not** enable Preview / Send / Sign / Payment until **R17+**. **Do not** skip **§6AL** order.

**Typical order from here (§6AL):**

1. **R0** → **R1** → **R2** → **R3** (docs gates)
2. **R4** → **R5** → **R6** (template editor)
3. **R7–R9** (IA code light + Job Card create flow)
4. **R10–R16** (template structure, branding, job editor, media, Builder layout, Proposals hub)
5. **R17–R23** (lifecycle, production, automations, legacy cleanup)

**Do not skip to Preview/Present (R17)** before template and job content semantics are stable. **Do not build company Terms/Warranty defaults store.** **Keep old FieldDive pricing/payment as legacy adapters only** until lifecycle bridge stages (**R19–R20**).

---

## Changelog (handoff doc only)

- **2026-07-20:** **Block 4B — Builder document-led continuation** (**§6BO.13.4.9** T.1) — left section nav; centered Estimate canvas; rail removed from path; Preview primary; Display/snapshot collapsed; Included estimate anchor. Babby `466e393c-…`. **Next:** Block 5 Preview (after approval).
- **2026-07-20:** **Block 4 — Builder estimate review simplification** (**§6BO.13.4.9** T) — Jobs nav; handoff identity; Included estimate anchor; compact quantity review; Proposal assistant Details collapsed; no Hide-from-customer / signing note on estimate path. Babby `466e393c-…`. **Next:** T.1 document-led, then Block 5.
- **2026-07-20:** **Block 3 final copy/visual correction** (**§6BO.13.4.9** S.3) — contractor-facing template/review copy; package badge rows; soft selected package card; activity Proposal created confirmed. **Next:** Block 4 (now **T**).
- **2026-07-20:** **Block 3 final polish — Proposals surface finish** (**§6BO.13.4.9** S.2) — activity Proposal created; strip Draft proposal / Latest package draft; premium review confirmation; row package emphasis. Babby smoke `3c4fd16c-…` (Enhanced). **Next:** S.3 copy/visual, then Block 4.
- **2026-07-20:** **Block 3 follow-up — + Proposal modal contractor clarity** (**§6BO.13.4.9** S.1) — guided confirmation copy; multi-measurement cards when ready records exist; template/package/review no longer admin-first; rows `Template — Package`. Babby smoke `4f409c73-…` (Enhanced). **Next:** S.2 final polish, then Block 4.
- **2026-07-20:** **Block 3 — + Proposal Create proposal modal** (**§6BO.13.4.9** S) — measurement → template → package → Continue to Builder; force-create distinct draft (not smoke reuse); package carries into Builder; Block 2 rows + Block 1 isolation preserved. Babby smoke created `0fff78ea-…` (Enhanced). **Next:** Block 3 follow-up polish (now **S.1**), then Block 4.
- **2026-07-20:** **Block 2 follow-up — Job Card status/activity visible-proposal truth** (**§6BO.13.4.9** R.1) — smoke-only jobs show Ready to create proposal / Ready for proposal (not Proposal Draft / Builder ready); left nav Jobs on job-card entry; Proposals tab reset preserved. **Next:** Block 3 + Proposal modal (now **S**).
- **2026-07-20:** **Block 2 — Proposals tab reset** (**§6BO.13.4.9** R) — compact rows + blue **+ Proposal**; empty state when smoke-only; placeholder entry (no create); removed always-open setup/archive UI; Block 1 isolation preserved; no modal yet. **Next:** Block 3 + Proposal modal.
- **2026-07-20:** **Block 1 — smoke/internal proposal + template isolation** (**§6BO.13.4.9** Q) — centralized `contractorFixtureIsolation` known-fixture classifier; Job Card Proposals lists/current draft + create template picker hide fixtures (hide-not-delete); direct Builder smoke URL preserved; no Proposals tab reset / modal / pricing / lifecycle. **Next:** Block 2 Proposals tab reset (now **R**).
- **2026-07-20:** **Block 0 — Proposal Flow V1 + Template Flow V1 + app surface standards** (docs only, **§6BO.13.4.9** P) — locked happy path (Job Card → + Proposal → measurement/template/package → Builder → Preview; Send later); Proposals compact rows + blue + Proposal; Templates = company setup; smoke hide-not-delete; Builder/Preview roles; Blocks 0–7 order; protected systems restated. Code checkpoint **`190ad66`**. **No app code.** **Next coding:** Block 1 smoke isolation (now **Q**).
- **2026-07-17:** **Job Card Proposals polish** (`190ad66`) — compact Current/Start zones; “Saved proposal” titles; collapsed older drafts. Still pre–Flow V1 end-state.
- **2026-07-17:** **Job Card create flow restore** — existing draft + create-another; `createNewProposalDraftEntry` force-creates distinct draft; multi-draft list; Builder package truth preserved. **Next:** superseded by Flow V1 Block 0/1 (**P**).
- **2026-07-17:** **Builder package selection truth** — draft-scoped Builder package picker; one-option drafts hide Change package; multi-option switches among saved draft options only; Job Card draft-open package-change note; no live-template import. **Next:** Job Card create flow restore (now **O**).
- **2026-07-17:** **Builder Handoff Polish A** — draft-aware Job Card (create vs draft-open); shared identity (customer primary / address secondary); Builder entry hierarchy + Preview next action; status vocabulary; Babby D smoke PASS (reuse `61356e56-…`). **Next:** Builder package selection truth (now **N**).
- **2026-07-17:** **Integrated Flow P2 correction** — waived false Builder “templates not ready” when valid draft loaded; removed duplicate Create CTA; listed-draft Open label; premium setup card polish; Babby D smoke PASS (reuse `61356e56-…`).
- **2026-07-17:** **Integrated Flow P2 — Job Card Compact Proposal Setup Card** — Proposals tab Measurement → Template → Package → Included → Create/Open; create explainer; durable draft reuse; Builder back to Job Card proposals; Templates/Catalog return labels; happy path no Templates drop-off; pricing/Preview/lifecycle unchanged.
- **2026-07-17:** **Templates Page P2B — visual tightening** — Setup complete strip when installed; compact template library; hero+package combined; Included items earlier; one trust note; Add/Replace/Remove preserved. **Next:** Integrated Flow **P2** Job Card proposal start.
- **2026-07-17:** **Templates Page P2 — Quote Setup Review** — default Templates IA: selected hero + package selector + Included items; Add / Replace / Remove from template (store delete; Catalog untouched); Advanced settings secondary; pricing/Preview/lifecycle unchanged.
- **2026-07-17:** **Proposal Templates page contractor-first redesign plan** (docs only) — recorded **§6BO.13.4.9**: critique of `97c12e5`; Options A/B/C; chose **Option B Included-in-quote manager**; Add/Remove/Replace flow; final wireframe. No app code. **Next coding block:** Templates Page Redesign **P2**.
- **2026-07-17:** **Templates Flow Redesign P1** — Use-first / Edit-mode on `/tools/roofing/templates`: default Use surface (readiness + what this creates + Open Jobs / Fix); Edit template mode for Packages & Catalog / Customer display / Content; no first-load edit tab strip; Catalog add/re-link + estimate/content preserved; pricing/Preview/lifecycle unchanged. Superseded as end-state by **§6BO.13.4.9** (still not contractor-simple).
- **2026-07-17:** **Templates contractor-first flow redesign plan** (docs only) — recorded **§6BO.13.4.8**: honest critique of `e2df6ac` (tabs still editor-framed); Options A/B/C; chose **Option B Use-first + Edit mode**; text wireframe + implementation plan. No app code. **Next coding block:** Templates Flow Redesign **P1**.
- **2026-07-17:** **Templates Workspace Redesign P0** — contractor-first `/tools/roofing/templates`: Overview readiness + Open Jobs; Packages & Catalog / Estimate / Content tabs; no first-load Catalog dump; Catalog add/re-link preserved; pricing/Preview/lifecycle unchanged. Superseded as first-load IA by P1 Use-first.
- **2026-07-17:** **Templates workspace redesign research + plan** (docs only) — recorded **§6BO.13.4.7**: screenshot/code critique of dense all-expanded Templates page; targeted Roofr template UX research (confirmed vs unconfirmed); chosen hybrid model A+D+E+F (Overview-first tabs + collapsed options/sections; defer `/templates/[id]`); page structure + implementation plan. No app code/migrations/SQL/package/pricing/Preview/lifecycle changes. **Next coding block:** Templates Workspace Redesign **P0**.
- **2026-07-17:** **Integrated Flow P0 — Template Add item from Catalog / re-link foundation** — existing `catalog_item_id` (no migration); Structure picker + link status + re-link; Catalog SoT / draft-refresh copy; Builder/Preview/pricing unchanged. Focused tests pass. Local + live smoke PASS on **`rhquhnujjnzjhweypavd`** (disposable item cleaned). **Next:** Integrated Flow P1 setup-to-proposal smoothness / Builder refresh trust guidance.
- **2026-07-17:** **Integrated Catalog → Proposal workflow research + flow design** (docs only) — recorded **§6BO.13.4.6**: Roofr public research (confirmed vs unconfirmed), FieldDive spine map, target integrated flow (Catalog SoT → Template links → Builder snapshots → Preview filter → Material Orders later), CSV mapping assistant as P2 future requirement, gap table, staged roadmap P0–P2 + Future. No app code/migrations/SQL/package/pricing/Preview/lifecycle/supplier/ordering changes. **Next coding block:** Integrated Flow **P0** (template catalog linkage + honest setup→Builder copy/trust) — not CSV mapping, not supplier sync, not raw mode.
- **2026-07-17:** **Catalog UX completion pass** — cohesion/usability polish only (Filters label, Add/Edit section hierarchy, quieter Manage/bulk copy, detail tax/SKU de-duplication, empty-state inactive hint fix, reorder active-state clarity). No new major systems; no pricing/Preview/supplier sync/material ordering/proposal import/raw mode/migrations/package changes. Focused tests **194 pass**. Local UI smoke PASS. **Next:** integrated workflow pass (Catalog → Templates → Builder → Preview → future Material Ordering).
- **2026-07-17:** **Catalog supplier SKU storage** — migration `20260717_026` applied on **`rhquhnujjnzjhweypavd`** (`abc_sku`/`qxo_sku`/`srs_sku` nullable text, CHECK 1..128, no default/backfill); types/store/Add/Edit/detail + CSV persist; no supplier sync/API/material order; proposal pricing + Customer Preview unchanged. Focused tests **170 pass**. Local UI smoke + live CRUD smoke PASS. **Next:** selection + bulk actions foundation → reorder → Catalog UX completion → integrated workflow pass.
- **2026-07-17:** **Catalog CSV v1 foundation** — FieldDive-native template/export/preview-import; create (blank id) + company-scoped update-by-id; strict header/row validation; reserved supplier SKU columns (warn, not persisted); Manage Catalog live CSV actions; no package changes; no supplier sync/material order/proposal import; proposal pricing + Customer Preview unchanged. Focused tests **160 pass** (CSV + admin/store/labels/page-copy + pricing/snapshot unchanged). Local UI smoke + live CRUD smoke PASS on **`rhquhnujjnzjhweypavd`**. **Next:** supplier SKU schema, or bulk actions, or proposal/template integration.
- **2026-07-17:** **Catalog Columns + Manage Catalog shell** — active Columns menu (optional column show/hide; required name/actions/select fixed; localStorage prefs); active Manage Catalog menu with Planned Download/Upload CSV, Reorder, Connect supplier, Jumpstart, Bulk edit purchase tax (no fake-active behavior); Re-order chip still Coming soon; item tax capture-only unchanged; no migrations/SQL/pricing/Preview/send. **Next:** CSV v1 planning/build.
- **2026-07-17:** **Catalog item tax capture fields** — added nullable `sales_tax_rate_pct` + `purchase_tax_rate_pct` on `catalog_items` (migration `20260717_025`, applied + verified on **`rhquhnujjnzjhweypavd`**; no default/backfill; CHECK 0..100). Types/store/parser/Add/Edit/detail UI wired; sales tax capture-only; purchase tax internal/never customer-facing; proposal pricing math + Customer Preview unchanged; no CSV/supplier/columns/bulk/raw mode switch. Focused tests **184 pass**; local UI smoke + live CRUD smoke PASS. **Next:** Columns + Manage Catalog shell, then CSV v1.
- **2026-07-17:** **`coverage_basis` Step H — Catalog live integration smoke PASS** — on **`rhquhnujjnzjhweypavd`**, temporarily set catalog **`2f5f67d2-92d3-4bbb-9323-433baa5f9f71`** to Coverage `5` / basis `roof_square` / waste `10`, classifier **compatible**, policy temporarily raw/exact, draft **`61356e56-8ef8-4fb6-85b4-672f18103b98`** create+refresh quantity **`5.5`** with matching raw echo (`coverage_rate_used=5`, `waste_pct_used=10`; **`coverage_basis_used` not in echo yet**); preflight current 1/0/0; restored policy/catalog/job pointer; tokens unchanged; draft events only. No mode switch. **Next:** Catalog integrated feature/tax planning (not raw mode switch).
- **2026-07-17:** **`coverage_basis` Steps C–F — types/store/parser/UI/classifier/tests** — `CoverageBasis` on CatalogItem; store maps create/update/read; Add/Edit Coverage basis selector (clears with coverage; status chip; Roofr-aligned); classifier returns `compatible` for proven pairings; clearing coverage clears basis; compatibility is trust/setup only; adjusted unaffected; raw policy-gated; no mode switch/whole/customer-public; focused tests **237 pass**; local Catalog smoke PASS. Checkpoint **`b1d0ef1`**. **Next:** Step H live smoke.
- **2026-07-17:** **`coverage_basis` Step G — migration 024 applied + verified PASS** — applied `supabase/migrations/20260717_024_add_catalog_items_coverage_basis.sql` to **`rhquhnujjnzjhweypavd`**. Live: `catalog_items.coverage_basis` text nullable, no default; CHECK allows null/`roof_square`/`square_feet`/`linear_feet`/`each`/`tons`; catalog **17** unchanged all null; proposals **21** / policies **1** unchanged (`adjusted_measurement`/`exact`, 0 raw, 0 whole); invalid rejected / valid accepted in rolled-back probe; comment present. No app code/UI/classifier; no backfill; adjusted unaffected; raw mode switch still blocked. Checkpoint **`0e37905`**. **Next:** combined Steps C–F.
- **2026-07-17:** **`coverage_basis` Step B — review-only migration draft** — added unapplied `supabase/migrations/20260717_024_add_catalog_items_coverage_basis.sql`: nullable `catalog_items.coverage_basis text`, CHECK (`null` / `roof_square` / `square_feet` / `linear_feet` / `each` / `tons`), no default, no UPDATE/backfill, comments + rollback notes; marked REVIEW ONLY. No live SQL apply; no app code/types/store/UI/classifier; no proposal/pricing/policy changes. Checkpoint **`fb7b9a9`**. **Next:** live SQL apply (Step G) with explicit approval, then app wiring.
- **2026-07-17:** **`coverage_basis` architecture decision lock (docs only)** — locked approved model in **§6BO.13.4.5**: nullable enum (`null` / `roof_square` / `square_feet` / `linear_feet` / `each` / `tons`); authority = measurement-side unit of coverage divisor (not purchase `unit`); classifier states + rules (`not_applicable` / `compatible` / `not_verified` / `incompatible`); core source↔basis map; existing-row policy (no backfill; null basis → `not_verified`); planned additive schema (no live SQL); planned Roofr-aligned Coverage basis UI (no mode switch yet); sequence A→I; deferred list unchanged. No app code, migrations, SQL, Catalog/pricing/proposal behavior changes. **Next:** Step B — review-only migration draft for `catalog_items.coverage_basis`.
- **2026-07-17:** **Catalog P1 remediation — validation + read-failure hardening** — strict numeric parse rejects malformed suffixes for price/Coverage/Waste; Coverage/Waste rules unchanged (empty→null; coverage > 0; waste ≥ 0; waste inactive when Apply waste off); pure coverage/unit compatibility classifier (`not_applicable` / `not_verified` / `incompatible`, never fake `compatible`); Catalog list load result distinguishes success-empty vs failed-read; starter install protected from failed reads; Retry on load error; behavioral create/update tests; Settings remains planned-only (no raw mode switch); adjusted mode unaffected; `raw_plus_waste` remains policy-gated; no SQL/migrations/pricing-engine/proposal lifecycle changes. Contained P2: Catalog nav `aria-current="page"`; Coverage helper copy no longer assumes sq ft. Checkpoint **`dfe627f`**. **Next:** `coverage_basis` architecture lock (§6BO.13.4.5).
- **2026-07-16:** **raw_plus_waste non-null Catalog driver controlled live smoke — PASS** — on **`rhquhnujjnzjhweypavd`**, temporarily set catalog item **`2f5f67d2-92d3-4bbb-9323-433baa5f9f71`** to Coverage `5`, Apply waste `true`, Waste `10`, switched only policy **`8d1e019c-b8eb-4725-8f22-90bbcfb09cbb`** to raw/exact, and created/refreshed draft **`3a5889b8-06d6-4abd-bcc2-e0aa4fe89c7b`**. Source `roof_squares=25`; exact result **`25 / 5 × 1.10 = 5.5`** persisted in line quantity and raw echo on create + refresh; preflight **current 1 / stale 0 / unknown 0**. Restored policy to adjusted/exact (**1 adjusted / 0 raw**), catalog to `null / true / null`, and job pointer to null; public-token inventory unchanged; only `created` / `draft_saved`; no send/public/signed/paid/whole/UI/customer-public enablement. **Next:** Phase 8 mode-switch planning behind product approval, or raw-mode hardening.
- **2026-07-16:** **raw_plus_waste Phase 6 — read-only contractor quantity trust surface** — Builder Proposal helper rail shows Quantity sources status (current / need review / changed) from existing preflight trust; Catalog Settings planned Coverage/Waste copy updated; no editable fields, no Settings mode switch, no customer/public exposure, no auto-refresh/Send block, no whole rounding, no SQL/math/resolver changes. **Next:** Phase 7 editable Catalog fields planning, or read-only UI hardening.
- **2026-07-16:** **raw_plus_waste Phase 7 — editable Catalog Coverage/Waste item controls** — Coverage / Apply waste / Waste % on Catalog item edit + add; persist via existing store fields; table secondary detail (no new columns); Settings planned copy updated (mode switch/tax still Coming soon); adjusted default unchanged; raw policy-gated; no Settings mode switch; no whole rounding; no customer/public exposure; no auto-refresh/Send block. **Next:** controlled raw smoke with non-null coverage/waste, or Phase 8 mode-switch planning behind product approval.
- **2026-07-16:** **raw_plus_waste comment/test-name cleanup** — aligned comments, helper notes, and test titles with Phase 5 truth: backend is policy-gated (`policy.wasteModel === "raw_plus_waste"`), default remains `adjusted_measurement`, no UI switch, whole unsupported, customer/public omit echo. Historical Phase 2 helper filename kept; `RAW_PLUS_WASTE_PRODUCTION_ENABLED=false` clarified as fixture-helper-only (not the production gate). No runtime math/UI/SQL/DTO changes. **Next:** Phase 6 read-only UI planning.
- **2026-07-16:** **raw_plus_waste minimal complete-source controlled live smoke — PASS** — on **`rhquhnujjnzjhweypavd`**, temporarily switched company/policy **`e1fd48bb-fe22-4dfe-9622-3f25eb2109b6`** / **`8d1e019c-b8eb-4725-8f22-90bbcfb09cbb`** to raw, then used job/measurement **`c9497cc1-c8d2-406e-8455-5a6f9cc369d3`** / **`62f5d03b-7215-4504-bb0c-3c1b116a79b3`**, dedicated one-line template **`24cdbe2e-ff54-4d6e-8588-5a5b6b133c2f`**, and draft proposal **`2d6b40f1-bc17-448e-81b0-6eed98ba5e62`**. Proven source `roof_squares=25`; create + refresh persisted matching raw/exact echoes; preflight **current 1 / stale 0 / unknown 0**; policy restored to **adjusted/exact (1 adjusted / 0 raw)**; smoke job `active_proposal_id` conditionally restored to its proven null baseline. Allowed draft events only (`created`, `draft_saved`); zero public tokens; no send/public/signed/paid/whole-rounding/UI/customer-public enablement. **Next:** Phase 6 read-only UI planning or raw-mode hardening.
- **2026-07-16:** **raw_plus_waste Phase 5 — dual-mode draft/snapshot/staleness backend** — policy-gated adapter/mapper/create/refresh/inspection/preflight for `raw_plus_waste`; engine accepts raw waste model without coverage/waste math; adjusted default unchanged; no UI; no live smoke; customer/public DTOs still omit echo. **Next:** controlled smoke with restore, or Phase 6 read-only UI.
- **2026-07-16:** **raw_plus_waste Phase 4 — policy CHECK-widening apply** — applied `supabase/migrations/20260716_023_allow_raw_plus_waste_policy_mode.sql` to **`rhquhnujjnzjhweypavd`**; verified waste_model CHECK allows `adjusted_measurement` + `raw_plus_waste`; quantity_rounding CHECK still `exact` only; default remains `adjusted_measurement`; live policies **1 adjusted / 0 raw**; no UI/resolver/engine/customer-public enablement; no company switched to raw. **Next:** Phase 5 draft refresh/snapshot/staleness dual-mode (controlled smoke; no UI).
- **2026-07-16:** **raw_plus_waste Phase 3 — policy validator staging + CHECK-widening migration draft** — `validateCompanyPricingPolicy` recognizes staged `raw_plus_waste` (defaults stay `adjusted_measurement`; whole still rejected); review-only unapplied `20260716_023_allow_raw_plus_waste_policy_mode.sql` widens waste_model CHECK only (not quantity_rounding; no row updates). No live SQL apply; no UI; pricing engine still rejects raw waste model; production quantity path unchanged. **Next:** Phase 4 — explicit SQL approval to apply CHECK widening only when ready.
- **2026-07-16:** **raw_plus_waste Phase 2 — disabled resolver/adapter branch + raw echo/staleness tests** — added unwired `proposalQuantityResolutionDisabledRawBranch` (uses `catalogQuantityMode`; `RAW_PLUS_WASTE_PRODUCTION_ENABLED=false`) and `compareRawPlusWasteQuantityResolutionEcho` for disabled/test-only raw↔raw current/stale/unknown compare. Production adapter/inspection/preflight stay adjusted-only; adjusted golden identity unchanged; company policy still rejects `raw_plus_waste`; no DB CHECK widening, UI, engine/mapper, or customer/public DTO exposure. **Next:** Phase 3 — policy/app validator staging + CHECK-widening migration draft (explicit SQL gate).
- **2026-07-16:** **raw_plus_waste Phase 1 — docs lock + pure math expansion** — locked formula/order (source → coverage → waste → exact), no-double-waste rules, item behavior, and gated Phases 1–7 in **§6BO.13.4.4**; expanded unwired `catalogQuantityMode` helpers/tests (`sourceAlreadyAdjusted` → `double_waste_risk`; adjusted ignores coverage this phase; success notes mark `not production-enabled`). No resolver/engine/mapper/UI/policy CHECK/DTO changes. Production remains `adjusted_measurement` only; whole rounding remains unsupported. **Next:** Phase 2 — disabled resolver branch tests only.
- **2026-07-16:** **Slice A internal-only quantity preflight trust composer** — added pure `proposalBuilderTrustSignals` that maps Builder quantity preflight metadata to a sibling internal trust signal (`current→ok`, `unknown→neutral`, `stale→needs_review`). Unknown remains neutral (not stale). Stale is internal `needs_review` only: `shouldBlock=false`, `shouldAutoRefresh=false`, `customerVisible=false`. Not merged into `deriveProposalPricingStale`; no visible Builder banner/CTA; no Send-gate or customer/public exposure. Builder exposes trust status/severity via invisible data attrs only. `raw_plus_waste` and whole rounding remain disabled. **Next:** Catalog planned/read-only UI polish, or docs lock for raw_plus_waste path (product priority).
- **2026-07-16:** **Block A internal Builder quantity preflight metadata + app-flow smoke** — PASS on approved project/ref **`rhquhnujjnzjhweypavd`** using smoke proposal **`5b7b49d7-89a1-42be-a06c-e032303e4fcc`**. Added pure `proposalBuilderQuantityPreflightMetadata` and wired inert Builder-only `quantityPreflight` into `ProposalBuilderClient` (data attributes only; no banner, no blocking, no auto-refresh). App-flow smoke: Builder opened draft, internal metadata returned **`current`** (`currentCount=1`, `staleCount=0`, `unknownCount=0`); draft refresh preserved valid `quantity_resolution_echo`; totals unchanged; customer/public DTOs remain clean. No raw-plus-waste or whole rounding. **Next:** Block B planning — staleness integration, read-only/planned Catalog columns, raw-plus-waste planning.
- **2026-07-16:** **S3D13 valid-selected-measurement quantity-resolution echo live smoke** — PASS on approved project/ref **`rhquhnujjnzjhweypavd`** using job **`c9497cc1-c8d2-406e-8455-5a6f9cc369d3`**, same-job selected measurement **`62f5d03b-7215-4504-bb0c-3c1b116a79b3`**, and customer-free draft-only smoke proposal **`5b7b49d7-89a1-42be-a06c-e032303e4fcc`**. Live draft create and refresh each persisted and read back one valid adjusted/exact `quantity_resolution_echo`; internal read-only preflight returned **`current`** (`currentCount=1`, `staleCount=0`, `unknownCount=0`). The prior S3D11 `unknown/current_unresolved` result was correct because its stamped measurement belonged to a different job; no cross-job fallback was added. No UI, customer/public behavior, auto-refresh, raw-plus-waste, or whole-rounding behavior was enabled. **Next:** combined Block A — internal Builder metadata consumer + app-flow smoke.
- **2026-07-16:** **S3D11 quantity-resolution echo live draft create + refresh smoke** — PASS on approved project/ref **`rhquhnujjnzjhweypavd`** using customer-free, draft-only smoke proposal **`40deeb23-2369-46e7-8bee-b782cff256c1`** (`S3D11 quantity echo smoke`, left as an explicit smoke fixture). The live `persist_draft_proposal_create_v1` and `persist_draft_pricing_refresh_v1` paths each persisted one resolved line with a non-null JSON-object `quantity_resolution_echo`; read-back confirmed `adjusted_measurement`, exact rounding, null coverage/waste usage, and `resolved_purchase_quantity = proposal_line_items.quantity`. Internal read-only preflight returned **`unknown`**, not stale (`current_unresolved`; one unknown, zero stale), because the current live measurement dependency did not resolve a source value. No UI, customer/public behavior, auto-refresh, raw-plus-waste, or whole-rounding behavior was enabled. **Next:** investigate the missing selected-measurement/source-value dependency without changing resolver math, then rerun the read-only preflight toward `current`.
- **2026-07-16:** **S3D9/S3D10 quantity-resolution echo RPC live apply checkpoint** — S3D9 read-back verification completed; S3D10 migration `supabase/migrations/20260716_022_include_quantity_resolution_echo_in_draft_rpcs.sql` was applied manually through Supabase SQL Editor to approved project/ref **`rhquhnujjnzjhweypavd`**. Verification PASS: `persist_draft_pricing_refresh_v1` includes `quantity_resolution_echo = true`; `persist_draft_proposal_create_v1` includes `quantity_resolution_echo = true`. No UI, resolver/pricing-engine/math, customer/public exposure, or auto-refresh changes; `raw_plus_waste` remains future-only and whole rounding remains unsupported. **Next:** live draft-create + draft-refresh smoke confirming real rows round-trip `quantity_resolution_echo`, then record the docs checkpoint.
- **2026-07-16:** **S2 quantity-resolution migration live apply checkpoint** (pending this docs commit; migration draft **`e3c9736`**) — `supabase/migrations/20260716_021_add_quantity_resolution_fields.sql` manually applied through Supabase SQL Editor to approved project/ref **`rhquhnujjnzjhweypavd`**; final metadata verification PASS for both columns and both validated constraints; earlier smoke-table error was temporary validation-table lifecycle, not missing live schema; no production behavior, raw-plus-waste, whole rounding, UI columns, or resolver/engine/mapper/snapshot wiring enabled; next is type/store alignment or resolver-integration planning, not UI.
- **2026-07-16:** **S2 quantity-resolution migration draft + disposable validation** (**`e3c9736` — `chore(db): add validated quantity resolution migration draft`**; prior docs **`4dffa39`**, helpers **`60b75cb`**) — added unapplied `supabase/migrations/20260716_021_add_quantity_resolution_fields.sql` (nullable `waste_pct` + nullable `quantity_resolution_echo` + comments/checks only; no policy CHECK widening; no coverage_basis; no catalog quantity_mode; no UI/resolver/engine wiring); disposable PGlite/stub validation **26/26 PASS**; not a full Supabase restore; no live SQL was run during that validation checkpoint; later manual apply recorded above.
- **2026-07-16:** **S1E Quantity/Waste schema/model decision lock** (**`4dffa39` — `docs: lock S1 quantity schema model decision`**; code checkpoint **`60b75cb`**) — records S1B/S1C completion and unwired pure helper/test modules; locks pricing-policy mode ownership, future nullable catalog drivers, preferred nullable line quantity-resolution echo, no measurement change, exact-only rounding, additive/no-backfill migration sequence, and stop rules in **§6BO.13.4.4**; next after that commit was **S2 migration draft proposal only**, SQL review text only and unapplied.
- **2026-07-16:** **S1B/S1C pure quantity-mode helpers and tests** (**`60b75cb` — `feat(catalog): add pure quantity-mode helpers and tests`**) — added `app/lib/catalogQuantityMode.ts` and focused tests with adjusted pass-through/double-waste protection plus future coverage/waste/exact-rounding contracts; helpers remain unwired and production behavior remains unchanged.
- **2026-07-16:** **S1A Quantity/Waste Architecture Decision record** (docs only; uncommitted) — production remains `adjusted_measurement` with current resolver unchanged; `coverage_rate` / `waste_applies` remain non-authoritative stubs; durable target is Option D dual-mode (`adjusted_measurement` + future `raw_plus_waste`); snapshot/trust rules, tax/supplier boundaries, S1A–S1I sequence, and stop conditions recorded in **§6BO.13.4.4**; next after review/commit is **S1B pure helpers/types**, then **S1C fixtures/tests**, not UI columns.
- **2026-07-16:** **Catalog P0D Roofr parity correction + systems research lock** (uncommitted with P0A–P0C) — continuous ungrouped All items (no MATERIALS/LABOR/FEES divider rows); disabled reserved selection checkbox column (no bulk bar); command bar Search · Filters & sort · Re-order / Columns / Manage (Coming soon) · Add; Roofr systems map, explicit truth stop rules, and S0–S9 sequence recorded in **§6BO.13.4.1–§6BO.13.4.3**; next after commit is **S1 Quantity/Waste Architecture Decision**, not UI column work.
- **2026-07-16:** **Catalog P0C Roofr command-surface visual parity** (uncommitted with P0A/P0B) — P0B = structure pass; P0C = wider workspace, unified command bar+table card, disabled Manage catalog / Columns / Re-order (Coming soon layout-only), polished group headers, Proposal/Status pills, spaced Edit|Deactivate, Settings future-tools planned list; deferred features remain in **§6BO.13.4** (no active CSV/reorder/columns/bulk/tax/waste/coverage/supplier).
- **2026-07-16:** **Catalog P0B Roofr visual-parity layout** (uncommitted with P0A) — Slice 2 layout intent changed from guided/setup-first to **Roofr-like table-first** (title → All items/Settings → toolbar → table); removed Catalog page checklist rail / dominant starter hero / roadmap footnote dominance; Settings = honest Pricing rules + Templates links; deferred Roofr-parity features recorded in **§6BO.13.4** (bulk/checkboxes/Add to template/tax/waste/coverage/reorder/columns/supplier); table columns Name/Type/Measurement/Unit/Unit cost/Unit price/Proposal/Status/Actions only.
- **2026-06-25:** **Catalog naming roadmap correction before Slice 2** (pending this commit) — **§6BO.13** Catalog naming decision; **keep Catalog as page/nav name** (do not rename to Price book); Slice 2 renamed to **Catalog P0**; Slice 1 marked **complete** at **`36a0b55`**; Catalog / Pricing rules / Templates / Job Costing distinctions; Setup nav lists **Catalog**; header/§6BO.0/§6BN.20/§9/§11 override updated; **current code checkpoint `36a0b55`**; prior docs **`fc86123`**; **next: Slice 2 — Catalog P0**; **Stage C1 may run in parallel** with P0 UI — do not mix Stage C into UI slices; **R18D3D blocked until Stage C4 + P0 trust fixes**.
- **2026-06-27:** **Approved page-by-page UI flow roadmap docs checkpoint** (`fc86123`) — **§6BO.13** + header/§6BO.0/§6BN.16/§6BN.20/§6BL/§9/§11 override + recent commits; **current code checkpoint `e17eab5`** at that time; prior docs **`ba3659e`**; Final Page-by-Page UI Flow Map **approved** as implementation reference; **no separate Command Center** — Job Board = command surface; P0/P1/P2/P3 priority list; implementation Slices 1–5; **historical next at that time: Slice 1** — **now complete at `36a0b55`**; Catalog rename direction **superseded by Catalog naming correction (2026-06-25)**.
- **2026-06-27:** **Stage C policy + operating-flow audit sequencing docs checkpoint** (`ba3659e`) — **§6BO.11** + **§6BO.12** + header/§6BO.0/§6BO.8–§6BO.10/§6BN.16/§6BN.20.9/§6BL/§9/§11 override + recent commits; **current code checkpoint `e17eab5`**; prior docs **`6d0e021`**; approved Stage C architecture direction; operating-flow audit before Stage C1 — **outcome superseded by §6BO.13**; **R18D3D blocked until at least Stage C4**.
- **2026-06-27:** **R18D3C contractor delivery status/history UI docs checkpoint** (`6d0e021`) — **§6BN.20** + header/§6BO.0/§6BO.9–§6BO.10/§6BL/§9/§11 override + recent commits; **current code checkpoint `e17eab5`**; prior docs **`4599126`**; R18D3C1–C3 commits `f0627e1`/`1811f7a`/`e17eab5`; R18D3C4 browser smoke PASS; **1021/1021** proposal lib tests; **historical next at that time:** no-code priority decision before R18D3D (Stage C vs lifecycle) — **superseded by §6BO.11** (Stage C approved).
- **2026-06-27:** **R18 roadmap recovery docs correction** (`4599126`) — reframed §6BO as completed remediation side-track; restored **§6BO.0** R18 letter-phase order + progress; prior docs **`5efcc45`**; code through **`ee643d0`** at that docs commit.
- **2026-06-27:** **Public proposal packet + Stage A/B truth pipeline docs checkpoint** (`5efcc45`) — **§6BO** + header/§9/§11 override + recent commits; **current code checkpoint `ee643d0`**; prior docs **`9d8b63c`**; header drift fix — removed stale **`20a239d`** as current code checkpoint; **984/984** proposal lib tests at Stage B smoke; Stage B E2E smoke PASS (§6BO.7); **historical next at that time:** Stage C OR Stage D — **superseded by R18 roadmap recovery correction** (§6BO.0).
- **2026-06-26:** **R18D3B email template polish docs checkpoint** (`9d8b63c`) — **§6BN.19** + header/§6BN status/§6BN.16/§6BN.18.7/§9/§10/§11 override + recent commits; code at `20a239d`; prior docs `55a5f83`; pass-3 email Gmail-approved “ok for now”; project-only summary; no price/package/options; no localhost dev artifact; pass-3 visual send attempt `285660d0…` **provider_accepted**; **914/914** proposal lib tests; deferred customer-facing polish backlog (§6BN.19.7); **historical next at that time:** R18D3C planning or public proposal polish first — **partially addressed by public packet + truth pipeline side-track**; **forward next recovered via §6BO.0**.
- **2026-06-25:** **R18D3B live-send verification docs checkpoint** (`55a5f83`) — **§6BN.18** + header/§6BN status/§6BN.16/§9/§10/§11 override + recent commits; code at `79e4c4f` (optional-upgrade fix) + R18D3B email at `e7cdc51`; prior docs `a1f8933`; live smoke fixture `9cd2c4ac…`/`368dcbf1…`; delivery attempt `42b2fffc…` **provider_accepted**; lifecycle guardrails verified unchanged; **72/72** R18D3B + **902/902** proposal lib tests; product/design debt noted; **historical next at that time:** R18D3B email/public presentation polish — **now complete at §6BN.19** (`20a239d`).
- **2026-06-25:** **R18D3A migration `020` live-applied + verified docs correction** (`a1f8933`) — **§6BN.17.7** + header/§6BL/§9/§10/§11 stale migration-status lines; code at `57786ca`; prior docs `670ed59`; migration `20260626_020` **live-applied + verified PASS** on `rhquhnujjnzjhweypavd`; R18D3A live verification PASS recorded; verification rows cleaned up; **875/875** proposal lib tests; **no Send/email/Resend/lifecycle/PDF/Sign/Payment/pricing**; **historical next at that time:** R18D3B planning/implementation — **now superseded by §6BN.18** (R18D3B complete + live-smoked).
- **2026-06-25:** **R18D3A delivery attempt foundation docs checkpoint** (`670ed59`) — **§6BN.17** + header + §6BM + §6BL + §9 + §10 + §11 override + recent commits; code at `57786ca`; prior docs `d2bb22c`; R18D3A `proposal_delivery_attempts` migration/store/view model/tests; migration `20260626_020` committed **REVIEW ONLY / not applied**; **875/875** proposal lib tests; **no Send/email/Resend/lifecycle/PDF/Sign/Payment/pricing**; **historical next at that time:** plan/apply/verify migration `020` then R18D3B after DB verification — **now superseded by §6BN.17.7** (migration live-applied + verified PASS).
- **2026-06-25:** **R18D2 contractor Preview customer send link prep docs checkpoint** (`d2bb22c`) — **§6BN.15–§6BN.16** + header + §6BM + §6BL + §9 + §10 + §11 override + recent commits; code at `845e8d5`; prior docs `6339cc9`; R18D2 **Prepare customer link** on Contractor Preview; POST `/api/proposals/send-prep`; freeze/reuse/refreeze + mint customer-send token; open/copy session URL; **852/852** proposal lib tests; authenticated sent-snapshot browser smoke PASS with documented no-sent-snapshot fixture caveat; **no Send/email/Resend/lifecycle/PDF/Sign/Payment/SQL/pricing**; **historical next at that time:** plan R18D3 email delivery + lifecycle/event semantics separately — **now superseded by §6BN.17** (R18D3A complete).
- **2026-06-25:** **R18D1 contractor Preview Send gate readiness docs checkpoint** (`6339cc9`) — **§6BN.13–§6BN.14** + header + §6BM + §6BL + §9 + §10 + §11 override + recent commits; code at `304ed0f`; prior docs `c11826c`; R18D1 Send gate readiness checklist + email draft preview on Contractor Preview; pure `proposalSendGateReadiness` VM; Send button disabled; **13/13** targeted + **834/834** proposal lib tests; authenticated no-sent-snapshot + sent-snapshot + 390px browser smoke PASS; **no Send/email/Resend/freeze/mint/PDF/Sign/Payment/lifecycle/SQL/pricing**; **historical next at that time:** plan R18D2 send-prep orchestration separately — **now superseded by §6BN.15** (R18D2 complete).
- **2026-06-25:** **R18C4C contractor Preview public review link panel docs checkpoint** (`c11826c`) — **§6BN.12–§6BN.13** + header + §6BM + §6BL + §9 + §10 + §11 override + recent commits; code at `bab25c8`; prior docs `21f05b3`; R18C4C Contractor Preview review-link panel (create/open/copy); POST `/api/proposals/public-review-link`; mint bridge to R18C3B; opens R18C4B `/p/[token]`; authenticated happy-path + no-sent-snapshot + 390px browser smoke PASS; **46/46** targeted + **821/821** proposal lib tests; **no Send/email/PDF/Sign/Payment/lifecycle**; **historical next at that time:** plan R18D contractor Send gate separately — **now superseded by §6BN.13** (R18D1 complete).
- **2026-06-25:** **R18C4A/R18C4B public proposal route docs checkpoint** (`21f05b3`) — **§6BN.10–§6BN.12** + header + §6BM + §6BL + §9 + §10 + §11 override + recent commits; code at `265d8f6` (R18C4B) + `8523812` (R18C4A); prior docs `1585f9e`; R18C4A orchestrator + render-ready document VM (22/22 targeted, 790/790 proposal lib); R18C4B `/p/[token]` read-only customer shell + server graph loader fix (`proposalVersionGraphStore.server.ts`); valid-token + error-path + 390px browser smoke PASS; **804/804** proposal lib tests; **no Send/PDF/Sign/Payment/lifecycle**; **historical next at that time:** plan next R18 slice after R18C4B — **now superseded by §6BN.12** (R18C4C complete).
- **2026-06-25:** **R18C3B public access token minting docs checkpoint** (`1585f9e`) — **§6BN.8–§6BN.10** + header + §6BM + §6BL + §9 + §10 + §11 override + recent commits; code at `5c47854`; prior docs `887631c`; pure token generator + mint RPC persistence + server-only mint facade; migrations `018`/`019` applied live on `rhquhnujjnzjhweypavd` (**all_pass**); `mint_proposal_public_access_token_v1` service_role EXECUTE only; hash-only DB storage; raw token once-only server envelope; **26/26** targeted + **768/768** proposal lib tests; disposable mint→resolve smoke PASS (`R18C3B-DISPOSABLE`); **no public route / no Send / no customer UI**; Roofr-aligned mint infrastructure recorded; **historical next at that time:** R18C4 planning only — **now superseded by §6BN.10–§6BN.11** (R18C4A/C4B complete).
- **2026-06-25:** **R18C3A public access token server boundary docs checkpoint** (`887631c`) — **§6BN.7–§6BN.8** + header + §6BM + §6BL + §9 + §10 + §11 override + recent commits; code at `b51383a`; prior docs `9f3acad`; SHA-256 hash helper + server-only `service_role` RPC facade + injectable persistence layer; **`server-only` dependency**; resolve/record wrappers use `p_token_hash` only; success envelopes exclude raw token and `token_hash`; **28/28** targeted + **742/742** proposal lib tests; forbidden exposure checks passed; **no public route / no token mint / no customer UI / no SQL**; Roofr-aligned server boundary architecture recorded; **next:** R18C3B planning (since complete at §6BN.9).
- **2026-06-25:** **R18C2B public access resolve RPCs docs checkpoint** (`9f3acad`) — **§6BN** + header + §6BM + §9 + recent commits; code at `e7798a7`; prior docs `ce94094`; **R18C2B live-verified PASS** on `rhquhnujjnzjhweypavd` via Cursor `DATABASE_URL` read-only verification (`verify_failed_count=0`); resolve/record RPCs + internal validator `service_role` revoke; verification lessons (no `has_function_privilege('PUBLIC')`; record RPC identity-args behavior); **no public route/token generation/app wrappers**; **Send/PDF/Sign/Payment/lifecycle remain disabled**; **historical next at that time:** R18C3 app-side hash + thin `service_role` wrappers — **now complete** at §6BN.7 (`b51383a`).
- **2026-06-25:** **R18B4D send-freeze smoke PASS docs checkpoint** (`ce94094`) — **§6BM.13** + header + §6BL.20 + §9 + §11 override; code at `76840d1`; prior docs `5efbe6e`; **R18B4D disposable smoke PASS** on project `rhquhnujjnzjhweypavd` — `freezeDraftToSentSnapshot` + `persist_proposal_send_freeze_v1`; verification table + auth caveat + boundaries preserved; throwaway smoke scripts removed; **700/700** tests; disposable artifacts left in place; **Send/PDF/Sign/Payment/public route/tokens/lifecycle remain disabled**; **historical next at that time:** R18C planning only — **now superseded by §6BN** (R18C1/C2A/C2B complete; R18C3 next).
- **2026-06-18:** **R18A public proposal architecture planning docs checkpoint** (`5efbe6e`) — **§6BM** + header + §6BL.20 + §9 + §11 override; code at `38a126e`; prior docs `3e892d4`; **R18A complete** — immutable sent snapshot first (R18B); route/token/security/lifecycle/customer UX/contractor workflow/staging R18A–R18J documented; Roofr research findings + uncertainties recorded; **Send/PDF/Sign/Payment/public route/lifecycle remain disabled** until each phase explicitly approved; deferred backlog preserved (catalog/custom/upgrade/qty source, Phase 4C, Mark N/A do-not-implement, neutral visibility wording); **historical next at that time:** R18B after explicit scoped approval — **now smoke-validated** at §6BM.13.
- **2026-06-25:** **Post-second-whole-app-audit-before-R18 docs checkpoint** (`3e892d4`) — §6BL.18–§6BL.21 + header + §9 + §11 override; code at `38a126e`; prior docs `f55566d`; **Audit Remediation Track complete**; **second whole-app audit PASS** — **647/647** + **91/91** tests; static/route/builder/preview/network/mobile/a11y audits passed; **no blockers**; existing-template-line Edit Option parity closed; deferred shell items not blockers; **historical next at that time:** R18/public proposal architecture planning — **now complete** at §6BM (R18A).
- **2026-06-18:** **Post-R17D Phase 4A + 4B estimate display settings docs checkpoint** (`f55566d`) — §6BL.14–§6BL.20 + header + §9 + §11 override; code at `38a126e` (Builder proposal-level `settings_json` display settings editing) + `1424f1e` (Preview display policy consumer); prior docs `1dd303a`; **Phase 4A/4B complete**; **Phase 4C future backlog only**; Mark N/A remains drift; Send/Sign/Payment/PDF/public route/lifecycle **disabled**; **647/647** tests; browser smoke on proposal `3db12ac5-…` / job `c3a26242-…`; **historical next at that time:** remaining audit remediation + second whole-app audit — **now complete** (§6BL.21).
- **2026-06-24:** **Post-R17D Phase 4 Hide from customer docs checkpoint** (`1dd303a`) — §6BL.13 + header + §9 + §11 override; code at `e79c53a` (`visibility_override` hide-from-customer; **624/624** tests; browser smoke on proposal `3db12ac5-…`); prior docs `50b6a4d`; **Phase 4 Hide complete**; Mark N/A remains drift; Send/Sign/Payment/PDF/public route/lifecycle **disabled**; **historical next at that time:** estimate display settings review — **now complete** at `1424f1e`/`38a126e` (§6BL.14–§6BL.15).
- **2026-06-18:** **Post-transaction spine audit + Mark N/A drift cleanup docs checkpoint** (`50b6a4d`) — §6BL.11–§6BL.17 + header + §9 + §11 override; code at `8dd8e7f` (Mark N/A visible drift removed; **no Mark N/A implementation**); prior docs `21e2c79`; post-transaction spine audit **PASS** — **19/19** create persistence + **619/619** proposal lib; existing/new draft RPC smoke; legacy isolation; protected surfaces; mobile 390px; **historical next at that time:** Phase 4 Hide if explicitly scoped — **now complete** at `e79c53a` (§6BL.13).
- **2026-06-23:** **Post-R17D Phase 3A exclude/remove from option docs checkpoint** (`c4dcf88`) — §6BK + header + §9; R17D Phase 3A code at `2dca3c0`; **full audit passed** — **564/564** tests; desktop remove/restore + hard refresh; Preview clean (excluded line absent, no Builder label leaks); disabled future actions remained gated; mobile 390px passed; direct DB row query **not run** (persistence cycles + unit tests verified). **Historical next at that time:** R17D Phase 3B planning (Mark N/A) or R17C3 — **superseded by §6BL**; Mark N/A is drift; visible UI removed at `8dd8e7f`; **do not implement Mark N/A**; current next: Phase 4 Hide if scoped (§6BL.16).
- **2026-06-23:** **Post-R17D Phase 2.5 manual quantity reset docs checkpoint** (`c9fe4a5`) — §6BJ + header + §9; R17D Phase 2.5 code at `a12fb92`; **full audit passed** — **559/559** tests; desktop reset flow + hard refresh + Preview clean; read-only DB sanity (`active=false`, zero active manual_quantity); mobile layout passed. **Historical next at that time:** R17D Phase 3 planning (3A exclude/remove, 3B Mark N/A) or R17C3 — **superseded by §6BL**; Phase 3A complete at `2dca3c0`; Mark N/A superseded as drift at `8dd8e7f`; **do not implement Mark N/A**.
- **2026-06-20:** **Post-R17D Phase 2 full audit docs checkpoint** (`184d971`) — §6BI + header + §9; R17D Phase 2 code at `f5712ff`; **full audit passed** — **547/547** tests; static scope clean; read-only DB verification on `rhquhnujjnzjhweypavd` (Production-labeled; not separate DEV); desktop/mobile browser manual quantity flow passed; Preview clean; DB sanity confirmed one active `manual_quantity` decision for Starter; **next housekeeping:** refresh Playwright storageState + plan true DEV Supabase; **next product:** R17D Phase 2.5 vs Phase 3 vs R17C3; **no R18** until explicitly approved.
- **2026-06-20:** **Post-R17D Phase 2 manual quantity code checkpoint docs** (`4446f8d`) — §6BI + header + §9; R17D Phase 2 code at `f5712ff`; **`manual_quantity` Edit Option action wired**; **547/547** automated tests; migration `20260618_009` **appears applied** on configured Supabase project `rhquhnujjnzjhweypavd` (Production-labeled; not separate DEV); browser audit pending at that checkpoint.
- **2026-06-18:** **Post-R17D Phase 1 scope decision overlay foundation docs checkpoint** (`9b66bf4`) — §6BH + header + §9; scope decision overlay + merge-on-refresh; **`manual_quantity` proven in tests**; migration committed only; **541/541** tests; **next: R17D Phase 2 manual quantity UI/API**.
- **2026-06-18:** **R17C2 complete** — Builder Estimate workbench hierarchy (`3e65774` Phase 2 UI + `3c04322` Phase 1 presenter); §6BG.
- **2026-05-31:** Initial global handoff after Stage 3F6B (`a62addb`).
- **2026-05-31:** Updated after Stage 3F7A (`6b37370`) — read-only installed catalog list in admin; next: 3F7B.
- **2026-05-31:** Updated after catalog shell alignment (`01e2d9e`) — 3F7B complete, canonical `/tools/roofing/catalog`, next: 3G1.
- **2026-05-31:** Updated after proposal template foundation (`07b3c1d`) — 3G1–3G5 complete (types, live tables, store, default defs, install helper); next: **3G6 planning** (Templates UI + readiness/install surface; Roofr research first).
- **2026-05-31:** Added **§11 Forward Roadmap / No-Drift Next Steps** — committed as `34a934a` (`Add FieldDive roadmap to handoff`); full stage checklist (3E–3M), drift list.
- **2026-05-31:** Roofr alignment audit — **next stage changed to 3F8** (Catalog Product Surface Alignment) **before 3G6**; expanded Future/Later; checkpoint reconciliation to `34a934a` / code through `07b3c1d`.
- **2026-05-31:** **3F8 complete** — Pass B (`a16bccd`), Pass C-D (`5bcf0fe`), Pass E (`d422ee6`); catalog setup workspace, detail panel, Job Card catalog link; **next: 3G6** Templates setup/readiness/install surface.
- **2026-05-31:** Roofr execution-surface research — **next stage changed to 3F9** (Jobs / Execution Surface Alignment) **before 3G6**; align Jobs/Pipeline/Job Packet/Job Card with Roofr before Templates UI.
- **2026-05-31:** **3F9C complete** — Job Card architecture + visual shell committed (`0015be1`); origin context (`from=board`), functional tabs, Activity rail, hook fix; manual checks passed; **next: 3G6** Templates setup (Roofr research first); Jobs Board save point **`b27a444`** preserved.
- **2026-06-04:** **3H-3 complete** — Read-only proposal quantity preview (`40e6720`); pure `proposalQuantityResolver.ts`; Builder line rows show Qty/Source/Rule/Status; dev fixture smoke then removed; **next: docs commit, then 3I pricing architecture planning only**.
- **2026-06-04:** **3H-2 complete** — Read-only proposal preview (`00fbf64`); document canvas, option pills, section/line rows; dev fixture used for visual review then removed; handoff (`a522ea8`).
- **2026-06-04:** **Packet Job Card session bleed fix** (`c12ea4d`) — stale saved-estimate session no longer overrides packet-created Job Card; browser smoke confirmed; handoff (`ae97a6b`).
- **2026-06-04:** **Pre-3H-2 source-of-truth fix** (`abd718d`) — Activity rail readiness copy, fresh packet intake reset, Job Card `?job=` identity; handoff (`d4b4f25`).
- **2026-06-04:** **3H-1 complete** — Proposal Builder shell and gates (`feec663`); packet handoff fix (`fd87152`); handoff (`cf3706f`); built-surface audit.
- **2026-05-31:** **3G6 complete** — 3G6A–E (`15ad732`–`b78c9ee`), Templates D2 (`227061c`), Catalog D2 (`29ca190`); Job Card + Job Packet audits documented; **next: plan 3H** Proposal Builder (Roofr research; not until scoped); pricing remains protected.
- **2026-06-07:** **DB-first smoke gate PASSED** — user manual confirmation; §6AE.5 + §6AF.9 + §6AD.7 complete (recorded after `3ec6f42`); **NEXT open** for scoped proposal draft editing/persistence; left Builder sidebar not a failure; Preview/Send/Sign/Payment remain disabled until 3K+.
- **2026-06-07:** **Pricing trust hardening complete** — snapshot qty+price alignment, stale detection, refresh wired (`ce3d6bc`); §6AF added; **175/175** tests in pre-commit audit; pricing engine/math untouched; user partial smoke positive; **next (superseded by §11):** full manual smoke (**§6AE.5** → **§6AF.9** → **§6AD.7**), then **§11 NEXT** (proposal draft slice); legacy import is **LATER**; Preview/Send/Sign/Payment remain disabled until 3K+.
- **2026-06-18:** **Post-R17C1 Preview Estimate document presentation docs checkpoint** (`16c38e6`) — §6BF + header + §9; pure `proposalCustomerEstimatePresenter` + Preview-only estimate UI; shared `proposalPackagePresentation`; Preview no longer imports Builder workbench table components; **328/328** automated tests; desktop + 390px authenticated browser audit + Builder regression audit; working tree clean after code commit `9c2244a`; **next: decide R17C2 vs R17C3** (R17C2 now complete at `3e65774`).
- **2026-06-18:** **R17C1 complete** — Preview Estimate document presentation layer (`9c2244a`); Roofr-aligned package hero + included scope panel; Builder package files import-only refactor; §6BF.
- **2026-06-18:** **Post-R17A/R17B customer Preview foundation docs checkpoint** (`f6e8225`) — §6BE + header + §9; R17A pure VM + R17B authenticated contractor Preview route; **313/313** automated tests; desktop + 390px authenticated browser audit; working tree clean after code commit `8ac2bcb`; **next: R17C1 Preview Estimate presentation** (now complete at `9c2244a`).
- **2026-06-18:** **R17A/R17B complete** — customer Preview foundation (`8ac2bcb`); `proposalCustomerPreviewViewModel` + `/tools/roofing/proposals/preview?job=&proposal=`; header Preview enabled; dirty-edit guard; Builder copy updated; Send/Sign/Payment/PDF/public route still disabled; §6BE.
- **2026-06-18:** **Post-R16C final whole-Builder audit docs checkpoint** (`118aa14`) — §6BD + header + §9; R16C1/R16C2/R16C3 integrated audit **passed**; **298/298** automated tests; authenticated browser audit; working tree clean; **next: R17 planning only** (customer Preview foundation); **no R17 implementation** until explicitly approved.
- **2026-06-18:** **Post-R16C3 docs checkpoint** (`333da7c`) — §6BC + header; R16C program complete; **187/187** relevant tests; pre-commit + browser audit passed; **next: R16C final whole-Builder audit before R17 planning**.
- **2026-06-18:** **R16C3 complete** — page visibility hide-show foundation (`25f1375`); `updateDraftProposalPageVisibility`; hidden indicators + contractor banner; hidden pages remain in Builder nav; §6BC; **187/187** relevant tests; pre-commit + browser audit passed; R17 Preview still not started.
- **2026-06-18:** **Post-R16C2 docs checkpoint** (`e6e6b78`) — §6BB + header.
- **2026-06-18:** **R16C2 complete** — registry-driven document token picker in R16B editor (`0cf76d2`); Insert field menu; raw `{{token}}` insert only; R14 merge preview unchanged; §6BB; **103/103** relevant tests; pre-commit + browser audit passed.
- **2026-06-18:** **Post-R16C1 docs checkpoint** (`7530433`) — §6BA + header; R16C1 browser audit passed.
- **2026-06-18:** **R16C1 complete** — Builder strip overflow page navigation (`967f0de`); More pages menu; portal menu fix; Scope notes reachable; dirty-edit guard preserved; §6BA; **167/167** relevant tests; full browser audit passed; **next: R16C2 planning only** (token picker); R16C3/R17+ remain deferred.
- **2026-06-18:** **Post-R16B docs checkpoint** (`5362d7e`) — §6AY + §6AZ; whole-app audit Proceed; overflow P2 carried into R16C1 (now complete).
- **2026-06-18:** **R16B complete** — draft body page authoring foundation (`589f5a0`); Edit/Save/Cancel; Estimate de-duplication; §6AY.
- **2026-06-18:** **Post-R14 docs checkpoint** (this commit) — §6AW + header; post-R14 audit **380/380**; authenticated Playwright visual verification; **next: scoped planning only** (§6AW).
- **2026-06-18:** **R14 complete** — read-only body/page token merge at display time (`f359ad4`); `proposalDocumentBodyRenderer` + frozen `proposalDocumentContext` + R13 resolver; §6AW.
- **2026-06-18:** **Post-R15 docs checkpoint** (`1921b0a`) — §6AV + header; post-R15 audit **387/387**; authenticated Playwright visual verification.
- **2026-06-18:** **R15 complete** — read-only branded Cover tab in Proposal Builder (`ab5a400`); `proposalCoverViewModel` + frozen `proposalDocumentContext` + R13 resolver; address dedupe; §6AV.
- **2026-06-18:** **Post-R13 docs checkpoint** (`b294226`) — §6AU + header; post-R13 audit **350/350**; authenticated Playwright light verification; **next: R15 scoping/planning** (explicit direction).
- **2026-06-18:** **R13 complete** — frozen document token registry + `ProposalDocumentContext` + pure resolver (`e40db30`); adapter `proposalDocumentContext` DTO; no Builder UI / no markdown merge; §6AU.
- **2026-06-18:** **Post-R12 docs checkpoint** (`89ef2ba`) — §6AT + header; authenticated Playwright verification; **next: R13 or R15 scoping** (explicit direction).
- **2026-06-18:** **R12 complete** — customer identity context_echo stamping at draft create (`31059e3`); adapter `proposalCustomerContext` DTO; no Builder customer display; §6AT.
- **2026-06-17:** **Post-R11c docs checkpoint** — header + new **§6AS** aligned to `29722a0`; R0–R11c complete; post-R11c audit passed; **433/433** audit tests; branded cover deferred; **next: R12 or R15 scoping** (explicit direction).
- **2026-06-17:** **R11c complete** — context_echo stamping at draft create (`29722a0`); adapter `proposalCompanyContext` DTO; no Builder cover UI; §6AS.
- **2026-06-17:** **Post-R11b docs checkpoint** — header + new **§6AR** aligned to `139e8a3`; R0–R11b complete; R11b smoke + post-R11 audit passed; **351/351** audit tests.
- **2026-06-17:** **R11b complete** — Settings workspace (`139e8a3`), store/migration (`097d25e`), R11a helpers (`0146dac`); §6AR.
- **2026-06-17:** **R10 complete** — R10a (`bc42b1e`), R10b (`e33e659`), R10c (`b3dd904`); completion audit passed; **217/217** tests.
- **2026-06-17:** **Pre-R10 docs checkpoint** — header/§6AL/§6AK/§6AO/§6AP/§11 aligned to `d0ba188`; R0–R9 + pre-R10 P1 complete; **next: R10 full-stage satisfaction/scope check** (audit only).
- **2026-06-17:** **Pre-R10 P1 complete** — Job Card proposal truth alignment (`d0ba188`, §6AP); header CTA gates, post-create refresh, draft-connected Proposals tab; **141/141** tests; live smoke passed.
- **2026-06-15:** **R3 WIP** — Proposals Hub Ownership (§6AO); route truth; hub owns/must-not-own; interim posture; R4–R6 / R9 / R16 relationships; §6AL R3 stop gate; stale R2 checkpoint lines cleaned; **committed `5927ab5`**.
- **2026-06-15:** **R2 complete** — Jobs Board / Saved Identity (`2e1c36b`, §6AN).
- **2026-06-15:** **R1 complete** — Global IA / Module Ownership Map (`b70cdd7`, §6AM); §6AM added with shell nav truth + target module map + interim rules.
- **2026-06-15:** **R0 complete** — RoofrExact Recovery Playbook (`f1dba95`, §6AL); mandatory R0–R23 order; earliest drift = global IA/module ownership; §11 aligned to §6AL stage IDs.
- **2026-06-15:** **3J4H Pass 2 complete** — `proposalTemplateContentEditing.ts` helper + tests (`8c04c2a`).
- **2026-06-15:** **3J4H-R complete** — Roofr IA correction (`40e5f5b`, §6AK); template-first content model; company = branding only.
- **2026-06-14:** **3J4G-Roadmap complete** — proposal content architecture lock (§6AK, docs only); four-layer model (company → template → job → customer render); current content chain documented; stage sequence 3J4G→3J4H→3J4I→3J4J→media→3K+; 3J4G guardrails; drift risks; §11 Future/Later Proposal Builder bucket updated as single later checklist; **next code: 3J4G** seed fallback copy only; seed defaults = fallback floor not final system.
- **2026-06-14:** **3J4F customer text pages complete** — Terms/Warranty/Project Overview/custom_text render read-only persisted `body_markdown`; `ProposalBuilderCustomerPage.tsx`; calm empty states; Cover/Photos/Add Page/Preview remain locked (`bfa0454`); §6AJ added; guidance + navigation **19/19**; **do not** add fake media/editing/lifecycle enablement.
- **2026-06-14:** **3J4E package/options surface complete** — selected-package summary, grouped "Details to complete later", Change Package card comparison (`72768ae`); §6AI added; selected-option persistence unchanged; Preview/Send/Sign/Payment remain disabled.
- **2026-06-14:** **3J4D Estimate readability complete** — line row hierarchy, default-closed Line details disclosures, section spacing (`c42a559`); §6AH added; document-first architecture unchanged.
- **2026-06-11:** **3J4C document-first Proposal Builder complete** — workbench/tab-first layout replaced with inline Estimate document + Proposal Helper inspector (`f8bffde`); Overview panel + workspace tabs removed; `proposalBuilderGuidance.ts` + tests; guidance + navigation **19/19**; §6AG added; **do not revert** to Overview/workspace-tab workbench; Preview/Send/Sign/Payment remain disabled until 3K+.
- **2026-06-07:** **3J3E complete** — Builder option selection persists to DB (`a7249b3`); quantity resolver test coverage (`4f24f1f`, 32 tests); §6AE added; **next (superseded by §11):** manual smoke (**§6AE.5** → **§6AF.9** → **§6AD.7**), then **§11 NEXT** (proposal draft slice); legacy import is **LATER**; Preview/Send/Sign/Payment remain disabled until 3K+.
- **2026-06-07:** **DB-first foundation Phases A–D complete** — Phase A customer/measurement sparse updates (`0649e04`, `2694bc4`), Phase B Job Board partition (`a62ad93`), Phase C `job=` identity (`e1a8f7c`), Phase D validation test lock (`87be1b4`); §6AD added; docs `3b5138a`; **next (historical):** manual smoke, then 3J3E (since done) — active **§11** supersedes; Preview/Send/Sign/Payment remain disabled until 3K+; legacy localStorage preserved not deleted.
- **2026-06-06:** **3J3 complete** — 3J3B active draft detection (`fc43849`), 3J3C Job Card create/reuse (`1915b2d`), 3J3D Builder persisted read (`e38b276`); §6AC added; **109/109** tests at 3J3D; **next:** manual smoke, optional 3J3E; Preview/Send/Sign/Payment remain disabled until 3K+; 3I-3D2 visual work deferred until smoke passes.
- **2026-06-06:** **3J2 complete** — 3J2B1 status mapper (`1033cd9`), 3J2B2 snapshot builder (`213e322`), 3J2B3 record store (`13b4e72`); §6AB added; **180/180** tests; **next: 3J3** Builder/Job Card draft wiring; Preview/Send/Sign/Payment remain disabled until 3K+.
