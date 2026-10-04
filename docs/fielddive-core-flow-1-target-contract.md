# FieldDive Core Flow 1 — Target Contract

**Status:** planning / product-definition contract. Committed as a docs checkpoint (2026-10-04, "docs: lock product advancement and core flow governance"). No app code, tests, migrations, SQL, staging or production changes were made to produce it.

**Revision 2 (2026-10-04, governance):**
- **Measurement is not a universal Job prerequisite.** See §9 "Measurement application" and §18 Decisions 1 and 5. The current full-roof measurement readiness is **temporary compatibility** for the reroof flow, not the future model.
- **Slice 1:** the truth/reliability direction is accepted for continuation. The current implementation (uncommitted) remains pending independent code/scope review. Its visible error/validation presentation is not accepted as final FieldDive UI. See §20 Slice 1 "Status". The current Slice 1 screenshots are **not** visual baselines.
- Governing procedure: execution standards → "Product advancement and discovery reconciliation".

**Scope:** Customer / Property → Job → site capture as needed → measurement / scope as needed → proposal preparation → customer preview. Send, acceptance, scheduling and production are out of scope except where this flow hands off to them.

**Governing documents applied:** `docs/fielddive-active-product-locks.md` (read first), `docs/fielddive-product-execution-standards.md` (contractor operating model, real-world workflow method, plain-language copy, error and state truth, domain ownership), `docs/fielddive-ui-product-cohesion-standard.md` (screen job, hierarchy, viewport proof, independent review), `docs/fielddive-audit-playbook.md`, `docs/fielddive-global-handoff.md` (2026-10-04 checkpoint: **NEXT: CORE FLOW 1**; locked principle "Copy Roofr's proven foundation → preserve the contractor mental model → remove friction and duplication → simplify → improve deliberately"; DEFAULT SIMPLICITY + POWER ON DEMAND; proposal V2 spine "Job Card → Prepare proposal → Builder → Preview → Send → public /p/[token]").

**Three layers are kept separate throughout:**

- **A — Truth / model:** what FieldDive stores, computes, freezes and authorizes.
- **B — Contractor flow:** the order of steps, what is asked, where the contractor lands next.
- **C — UI / presentation:** hierarchy, placement, density, copy, visual treatment.

**Decision rule applied:** model correct but UI weak → preserve the model, change the UI. Flow wrong → change the flow. UI already strong → keep it.

---

## 1. Executive target-flow summary

**The target journey in one sentence:** a contractor enters a name and an address, lands on the Job, and is always shown **one obvious next step** based on what FieldDive already knows: add photos on site, add a measurement when the work is quantity-driven, then prepare the proposal, then review what the customer will see. Setup (template, catalog, pricing rules) is absorbed into that path and only surfaces when a real business answer is missing.

**What the evidence says overall:**

- **Layer A is mostly right.** Customer/Property/Job identities, Job Card as home, Job-scoped photos, current measurement plus history, starter template auto-install, deterministic catalog pricing, frozen proposal snapshots and preview-first creation are sound. They should be **preserved**. They should not be redesigned.
- **Layer A has a short list of real truth defects.** These come first:
  - failed reads shown as "nothing saved" or "not set up" (Astra F1, F5);
  - a retry gap during intake that can create a second customer (F2);
  - silent photo caption/delete failures (F6);
  - a false "Create or finish a template" blocker while the starter template installs;
  - a generic upload failure with no reason;
  - a Disposal unit mismatch that prices 3 tons as 3 × $450 "each";
  - internal seed names leaking into the customer document ("Ice Water Valley").
- **Layer B has three flow gaps:**
  1. Nothing on the Job tells the contractor what to do next. The Overview hero is guidance with no button, at every early stage.
  2. After saving a measurement, the primary button is "Add measurement", not "Prepare proposal".
  3. The first proposal asks for **every** price across **every** package (16 prices) before any draft exists, and those prices silently become company catalog prices.
- **Layer C is uneven.**
  - **Strong, keep:** the intake form, Job Card bones, builder and customer preview, the Catalog price book table.
  - **Weak, change presentation:** the Overview hero, the mobile reach to Measurements/Proposals, the measurement form's required markers and disabled-Save reason, the Prepare dialog's price wall, Templates' "No preferred template yet / 41 included", and the Pricing rules page not reflecting the "I enter selling prices directly" choice.

**Contract rules locked by review (revision 1):**

- **GOOD ARCHITECTURE DOES NOT EXCUSE WEAK PRESENTATION.** If the underlying model is right but the contractor experience is not, preserve the model and change the flow/UI.
- **ESTABLISHING A MISSING STANDARD PRICE MAY CREATE A REUSABLE DEFAULT. OVERRIDING AN EXISTING STANDARD PRICE IS JOB-SPECIFIC UNLESS THE CONTRACTOR EXPLICITLY PROMOTES IT TO THE NEW STANDARD.** (§10, §12, §18 Decision 4)
- **MEASURE WHAT IS TRUE. QUOTE WHAT WORK WILL BE PERFORMED.** Unknown site facts never become zeros. Proposal choices never masquerade as measurement facts. (§9, §10, §12, §18 Decisions 6–7)
- **INCOMPLETE CONTRACTOR DRAFT: MAY EXIST. CUSTOMER-DELIVERABLE PROPOSAL: MUST BE COMPLETE AND TRUSTWORTHY.** Allowing an incomplete draft is a domain/lifecycle change, not a button change. (§10, §18 Decision 2, §20 Slice 4B)
- **Mobile progress shows the current canonical stage, contextual status when important, and the next action.** No literal "Step X of Y" is locked. (§15, §18 Decision 10)
- **Proposal work ships as two separate slices:** 4A (preparation UI/flow, current lifecycle rules) and 4B (incomplete-draft lifecycle/domain). (§20)

**Biggest unresolved product decisions** (contractor language, §18):

- Can a draft exist before every price is filled in? The boundary is now locked; whether to adopt it and when remains a decision.
- What is the exact control for "make this my standard price"? The semantics are now locked; the default for first-time prices and the wording remain open.
- Must every package shown to the customer be priced, or can the contractor offer only some packages?
- Can a proposal be made without a roof measurement?
- Where do tear-off scope and disposal charging get decided, and which disposal billing units are supported?

---

## 2. Evidence base

| Source | What it is | Strength | Location |
|---|---|---|---|
| **Cursor live walkthrough** | Real staging walk of the full journey on fixture company "CSUI Summit Roofing" (job "Jordan Ellis", draft proposal created). 36 screenshots, desktop 1440 and mobile 390 (scrollWidth ≤ 390 on every mobile page). | OBSERVED | `docs/fielddive-core-flow-1-diagnostic.md`; `tmp/fielddive-ui-review/core-flow-1-diagnostic/` (+ `.zip`, `INDEX.txt`) |
| **Astra source diagnostic** | Independent source-level read, findings F1–F8, with comparison appendix to Cursor. | SOURCE-CONFIRMED (no runtime fault injection) | `docs/fielddive-core-flow-1-astra-diagnostic.md` |
| **Independent GPT visual review** | An independent GPT visual review **did occur**, in the ChatGPT conversation. It inspected the uploaded Core Flow 1 screenshot ZIP and compared the actual FieldDive screens against the diagnostic findings. It covered at least New Job, Job Card, Proposal preparation, Templates, Catalog and Pricing Rules. **It is not stored as a standalone repo artifact**, so this contract cites it by its existence and coverage only and does not restate conclusions it cannot quote. | Independent (external to Cursor) | ChatGPT conversation (no repo path) |
| **Cursor screenshot inspection** | For this contract Cursor directly re-inspected screenshots 06, 08, 09, 12, 14, 16, 17, 21, 22, 23, 24 and 31, rather than relying on the diagnostic's text. **Supporting evidence only.** It is not a substitute for independent GPT visual acceptance of any future implemented UI. | OBSERVED by Cursor (not independent) | Screenshots above |
| **Cursor market research** | Roofr primary, JobNimbus/AccuLynx selective. Help-centre and product-page evidence, 7 captures. | OBSERVED / INFERRED / UNKNOWN labelled; some Roofr pages cached | `docs/fielddive-core-flow-1-proven-market-research-cursor.md`; `tmp/fielddive-ui-review/core-flow-1-market-research-cursor/` |
| **Astra market research** | Independent competitor research, priced-scope boundary model, three-decision draft model, disposal-unit analysis. | OBSERVED / INFERRED labelled | `docs/fielddive-core-flow-1-proven-market-research-astra.md` |

**Where sources agree (high confidence):**

- Job Card should be the home.
- An early primary action is missing.
- Measurements and Proposals are hard to reach on mobile.
- "Price this proposal" writes shared catalog prices without saying so.
- Pricing walks the whole template, not the offered scope.
- Failed reads look like empty states.
- Template preview and the "preferred" state are confusing.
- Competitors keep catalog maintenance separate from quoting, and per-quote edits stay per quote (Roofr ad hoc items, JobNimbus "future documents only").

**Where sources qualify each other:**

- Astra's appendix says "first proposal = setup session" is not an architectural necessity. The starter path already bootstraps. **Accepted:** the target treats first-use setup as a flow and presentation problem, not a model problem.
- Astra says "photos fail silently" is narrower than it sounds: upload has a Failed/Retry state, and caption/delete are the silent ones. **Accepted.**
- The live upload failure was caused by a **missing staging storage bucket** (read-only probe: no buckets; signed URL "related resource does not exist"). It is an environment defect plus a missing failure reason. It is **not** a broken upload model.

**Evidence gaps:**

- No live contractor usage data.
- No HEIC/camera device testing.
- No non-admin proposal-author run.
- The independent GPT visual review is not stored in the repo. Its detailed wording can't be quoted here. It did not necessarily cover Photos, Measurement, mobile or progress/status; this contract does not assume that it did.
- Competitor evidence is documentation-based, not hands-on accounts.

---

## 3. Core design principles

These come from governance and the evidence. They are restated here so every slice is checked against them.

1. **FOLLOW THE WORK, NOT THE SOFTWARE.** The order is: address → site → photos → measurement (when the work is quantity-driven) → scope → proposal → customer view. A small repair or known-price Job may go from site/photos straight to scope and proposal.
2. **KNOW IT → DO IT. NEED INPUT → ASK THERE. RISK → WARN CLEARLY.** If FieldDive knows the next step, show it as the main action. If it needs an answer (sales tax, a price), ask inside the flow, not in Setup.
3. **One Job, one home.** Job Card owns the Job. Domain tabs own their truth. Overview summarizes and points to the next useful action. It does not duplicate tabs.
4. **One primary action per moment.** A stage-aware main button replaces passive guidance text. Secondary actions are available but quieter.
5. **Default simplicity, power on demand.** Advanced template/catalog/pricing controls stay. They live behind disclosure and are not removed.
6. **ERROR ≠ EMPTY. UNKNOWN ≠ ZERO. FAILED ≠ SUCCESS.** Every load names its outcome and gives a next action (retry).
7. **Deterministic pricing and frozen truth are non-negotiable.** AI never invents prices. Sent proposals never change. A draft keeps the snapshot it was prepared with until the contractor chooses to refresh.
8. **Plain-language copy.** Describe business meaning or the next action. No "FieldDive will…", no seed keys, no third-person narration in the customer document. Copy is contextual: obvious actions get no paragraph, consequential actions get one short consequence note.
9. **No new subsystem unless contractor reality requires it.** No new wizard, state machine, pricing store or photo subsystem.
10. **GOOD ARCHITECTURE DOES NOT EXCUSE WEAK PRESENTATION. IF THE UNDERLYING MODEL IS RIGHT BUT THE CONTRACTOR EXPERIENCE IS NOT, PRESERVE THE MODEL AND CHANGE THE FLOW/UI.** Do not preserve passive UI just because the model behind it is correct. FieldDive is willing to substantially improve presentation.
11. **THE CONTRACTOR SHOULD SEE WHAT SOMETHING MEANS, NOT HOW FIELDIVE IMPLEMENTS IT.**
12. **MEASURE WHAT IS TRUE. QUOTE WHAT WORK WILL BE PERFORMED.** Measurements record site facts; unknown facts stay unknown, never zero. Proposals record work decisions; a work decision is never stored or shown as if it were a measured fact. The detailed roof measurement is **not a universal Job prerequisite** (§9 "Measurement application").
13. **ESTABLISHING A MISSING STANDARD PRICE MAY CREATE A REUSABLE DEFAULT. OVERRIDING AN EXISTING STANDARD PRICE IS JOB-SPECIFIC UNLESS THE CONTRACTOR EXPLICITLY PROMOTES IT TO THE NEW STANDARD.** Neither ever happens silently.
14. **INCOMPLETE CONTRACTOR DRAFT: MAY EXIST. CUSTOMER-DELIVERABLE PROPOSAL: MUST BE COMPLETE AND TRUSTWORTHY.** Missing prices show "Price needed": never $0, never an invented price, never a misleading total, never a silent omission that changes what the customer is offered.

---

## 4. Target journey

This is not a rigid wizard. Each step is skippable when FieldDive already has the answer. The Job Card main action adapts.

| # | Contractor moment | What FieldDive already knows | Target behavior | Lands on |
|---|---|---|---|---|
| 1 | "New lead: Jordan Ellis, 1550 Wewatta St." | Existing customers/properties (search) | Name or phone or email, plus address. Existing match offered inline. Search failure is shown as unavailable, not "no match". | Job Card, Overview |
| 2 | "I'm going out there / I'm on the roof" | Job, address, no photos, no measurement | Main action: **Add photos** on mobile, or a site-capture pair (Photos / Measurement) as the next step. Directions and Call are one tap away. | Photos or Measurement |
| 3 | "I've got my numbers" | Photos (optional), saved measurement — or, for a small repair / known-price Job, the scope and price without a measurement | After saving, main action becomes **Prepare proposal**. A Job that doesn't need a measurement reaches Prepare proposal without one (once Decision 5 paths exist). | Prepare proposal |
| 4 | "Give this customer a price" | Customer, address, current measurement, preferred/starter template, catalog prices, pricing rules | Prepare shows only what's missing for the offer being made, then creates the draft. | Customer preview (draft) |
| 5 | "Does it look right?" | Draft snapshot | Customer preview → Edit (builder) → back to preview. Send stays gated on completeness. | Preview / builder |
| 6 | Return to the Job later | Draft exists, not sent | Overview main action: **Review proposal**. **Finish proposal** applies only once incomplete drafts exist (Slice 4B, Decision 2). | Preview / builder |

**What the target journey removes:**

- Hunting for the Measurements and Proposals tabs.
- Having to know that Templates, Catalog and Pricing rules exist before the first quote.
- Pricing packages the contractor isn't offering, subject to Decision 3.
- Guessing why Save is disabled.

---

## 5. New Job / intake (area A)

**Contractor goal:** capture a lead in seconds (who and where) without creating a duplicate customer, then start working the Job.

**Current truth/model (A):** **Correct.** Readiness requires name **or** email **or** phone, plus a resolved US address (street, city/state, 5-digit ZIP). Customer selection is explicit, with no silent merge on matching email. Property resolves through the normalized company property path. Success replaces the route with the Job Card. **Defects:**

- F2: the customer is created before the intake idempotency fingerprint, so a retry after a partial failure can create a second customer.
- F5: customer/property search errors are discarded, so "lookup unavailable" looks like "no match".

**Current flow issue (B):** small. After creating the Job, the contractor lands on the Job Card with no main action (see area C). Address suggestions are US-wide with no location bias, so local addresses may rank below distant ones.

**Current UI issue (C):** small. The form is clean and professional. The "Finding addresses…" indicator is a 10.5px label and easy to miss.

**Evidence:**

- **Cursor live:** screenshots 02–05, 25. Form is clear; Create job enabled without email; post-create landing correct (06).
- **Astra source:** §5–6, F2, F5. Readiness rules confirmed.
- **Market:** Roofr, JobNimbus and AccuLynx all use a short create-job form with a contact plus address, landing on the job (Cursor market §5; Astra market).
- **Independent GPT visual review:** covered New Job (ChatGPT conversation; not a repo artifact). Cursor re-inspection, as supporting evidence, finds the form clean.

**Target flow:**

1. The contractor types a name, phone or email. Inline existing-customer matches appear under the field ("Use existing: Jordan Ellis · 2 jobs").
2. The contractor types an address. Matching existing properties are offered first, then address suggestions.
3. Create job opens the Job Card Overview with a stage-aware main action (area C).
4. If search fails: show "Couldn't check existing customers — Retry" inline. The contractor can still create the Job.
5. On partial failure and retry, the already-created customer is reused. No second customer is created.

**Target visual hierarchy:** keep the current order: Customer (name, phone, email) → Site address → Create job. The match suggestion sits directly under the field it matched.

**Primary action:** Create job.
**Secondary actions:** Cancel; choose an existing customer/property from suggestions.
**Hidden until needed:**

- The search-unavailable notice.
- The address-resolution error.
- "Another property" for an existing customer appears only when an existing customer is selected.

**Mobile:** single column, as today (25 is already good). The address suggestion list must not be covered by the keyboard. Create job stays reachable with the keyboard open (verify).
**Desktop:** as today.
**Copy:** no explanatory paragraph. Labels plus the button are enough. Error copy: "Couldn't check existing customers. Retry" / "Address not found. Check the street and ZIP."
**Error/loading/retry truth:**

- Search loading uses a visible indicator, larger than 10.5px or inside the field.
- Search error is distinct from no results (fixes F5).
- Create failure keeps the form data and reuses any created customer on retry (fixes F2).

**Implementation type:** **flow + source truth** (F2, F5). **UI-only** for the loading indicator. **Product decision** only for location-biased address suggestions (minor; use company address/service area if one exists).
**Preserve:**

- Minimal required fields.
- Explicit customer selection; no name/email auto-merge.
- Normalized property resolution.
- Post-create landing on the Job Card.

---

## 6. Customer / Property reuse (area B)

**Contractor goal:** "This is the Ellis house again. Don't make me retype them, and don't mix up the old job with the new one."

**Current truth/model (A):** **Correct.**

- Customer and Property are independent identities.
- A new Job does not inherit old commercial or operational state.
- "New Job from customer/property" and "Another property" exist.
- Photos stay with their original Job (provenance).

**Current flow issue (B):** reuse depends on the contractor noticing the suggestion. If search silently fails (F5), the contractor creates a duplicate. Prior jobs at the same property are not surfaced on the new Job.

**Current UI issue (C):** not separately observed live beyond intake. There is no visual problem evidence.

**Evidence:**

- **Cursor live:** intake suggestions observed (03); a returning-customer run was not performed.
- **Astra source:** §6, F5; identity reuse is a listed strength (§19.1).
- **Market:** competitors key contacts and jobs separately, with multiple jobs per contact (JobNimbus/AccuLynx; Cursor market §5–6).
- **Independent GPT visual review:** reviewed intake (New Job). Returning-customer reuse was not a separate screenshot.

**Target flow:**

- Reuse is offered at intake (area A).
- On the Job Card, a quiet "Other jobs at this address (2)" link appears in the header or Site card **only when they exist**. It opens a list. Prior-job photos are reachable from there. They are not copied into this Job (Decision: see area D).

**Target visual hierarchy:** customer identity stays in the Job header (name, phone, email, address with Change). Prior-job context is a secondary link, never a card that pushes the main action down.

**Primary action:** none specific (reuse happens at intake).
**Secondary actions:** "Other jobs at this address", "New job for this customer".
**Hidden until needed:** prior-job context when none exists.
**Mobile:** the prior-jobs link goes inside the Site card, below Directions/Call.
**Desktop:** same, in the header or Site card.
**Copy:** "Other jobs at this address (2)". No explanation of the identity model.
**Error/loading/retry truth:** if prior-job lookup fails, show nothing rather than "0 other jobs". Unknown is not zero.
**Implementation type:** **UI + flow** (prior-jobs link; reads existing data). F5 is covered in area A.
**Preserve:**

- Separate Customer/Property/Job identities.
- No inheritance of old state.
- No automatic merging.

---

## 7. Job Card / Overview (area C)

**Contractor goal:** open the Job and immediately know where it stands and what to do next.

**Current truth/model (A):** **Correct.** One Job with canonical identity; domain tabs own their truth; the Overview is state-aware. The primary-action resolver covers approval, scheduling, production and later lifecycle steps. It does **not** cover early work (add measurement / prepare proposal). The NextActionPanel handles attention items and returns nothing on a first visit (Astra F4).

**Current flow issue (B):** **wrong at the start.** Observed in three states:

- **Intake, empty** (06): "Get this job ready for a proposal. Add a measurement or prepare a proposal when you're ready." No button.
- **After measurement** (14): **identical** hero text, still no button.
- **Draft created** (31): "Proposal draft in progress. Not sent to the customer yet." No button to open the draft.

The contractor must discover the tabs.

**Current UI issue (C):**

- The hero card is visually the most prominent element but is passive.
- The stage pill ("Intake" / "Proposal") sits next to "More job actions" and reads like a button.
- After a measurement, the Site card swaps the address line for "Measurement · 2,450 sq ft · 12% waste". The data is useful, but it is mislabeled as "Site".
- Recent activity is fine.
- Mobile shows a loading flash of the "Authorized work" placeholder before settling (26 vs 31).

**Evidence:**

- **Cursor live:** 06, 14, 26, 31.
- **Astra source:** F4, §7, §15 ("PARTIAL: useful direction, weak early primary action").
- **Market:**
  - Roofr's job page has a prominent stage plus next action, with proposals and measurements reachable from the job (Cursor market §6).
  - AccuLynx and JobNimbus show the status/milestone at the top with actions nearby.
- **Independent GPT visual review:** covered the Job Card (ChatGPT conversation; not a repo artifact). Cursor re-inspection, as supporting evidence, confirms the passive hero at three stages.

**Target flow:** the Overview hero becomes a **next-step card with exactly one primary button**, derived from known Job state. It uses no new state machine. It reads existing facts: measurement present, proposal present, proposal sent, lifecycle stage.

| Job situation | Hero title (example) | Primary button | Secondary (quiet) |
|---|---|---|---|
| Intake, nothing captured | Get this job ready for a proposal | **Decision 1** (see §18): *Prepare proposal* or *Add measurement* | Add photos · Add measurement / Prepare proposal (whichever isn't primary) |
| Measurement saved, no proposal | Ready to prepare the proposal | **Prepare proposal** | Add photos · View measurement |
| Small repair / known-price Job, no measurement needed (after Decision 5 paths exist) | Ready to prepare the proposal | **Prepare proposal** | Add photos · Add measurement (quiet, optional) |

**Next-action architecture constraint (locked 2026-10-04):** the early-state resolver must be able to choose a truthful action other than "Add measurement". "Add measurement" is never hard-coded as the only path to Prepare proposal, even while today's proposal flow still requires one.
| Draft exists, not sent | Proposal draft ready to review (or "Proposal draft needs prices", only after Slice 4B allows incomplete drafts) | **Review proposal** (opens customer preview), or **Finish proposal** for an incomplete draft | Edit proposal |
| Sent, awaiting response | (existing approval-stage behavior) | (existing resolver) | — |
| Later stages | (existing resolver — unchanged) | (existing) | — |

**Target visual hierarchy (above the fold, desktop and mobile):**

1. Header: customer name, address (Change), phone, email. **Unchanged.**
2. Stage indicator: a compact progress treatment (area K), visually distinct from action buttons.
3. **Next-step card with one primary button.** This is the only filled primary-colour button on the Overview.
4. Site card: address, Directions, Call. The measurement summary moves into its own one-line "Measurement" row, or into the next-step card as context ("2,450 sq ft · 12% waste"). It no longer replaces the address under "Site".
5. Recent activity, collapsed.

**How the hero evolves:** the same card position and the same shape at every stage; only the title, one line of context and the button change. Later lifecycle stages keep the existing resolver output in the same slot.

**Tabs that matter by stage:**

- Desktop keeps all tabs, in this order: Overview, Tasks, Calendar, Measurements, Proposals, Payments, Photos | Activity.
- **Product decision (minor):** whether to reorder desktop tabs to follow the work (Overview, Photos, Measurements, Proposals, Tasks, Calendar, Payments). This is recommended because it is the order of the journey. It is low risk and is classed as ADAPT.
- Mobile is covered in area J.

**Primary action:** stage-aware, as in the table.
**Secondary actions:**

- One or two quiet links in the next-step card.
- Directions and Call in the Site card.
- "More job actions" stays for lifecycle actions (On Hold, Lost, etc.).

**Hidden until needed:**

- Attention items (NextActionPanel), shown only when they exist.
- Payment, schedule and crew cards; crew stays parked under D9.
- Prior-jobs link (area B).

**Mobile:** the next-step card is the first element under the header. The primary button is full width. No loading flash of irrelevant placeholder copy: show a neutral skeleton until Job state resolves.
**Desktop:** the next-step card spans the content width. The primary button sits right-aligned in the card or below the title. It should not float in the page header, where it would compete with More job actions.
**Copy:** a short title plus at most one context line. No "FieldDive will…". Never claim progress that hasn't happened. For example, "Ready to prepare the proposal" appears only when the Job actually has what its proposal path needs. Today that means a ready measurement. For direct/small-job paths (Decision 5), it will not. Copy and visuals must not imply that every Job needs a measurement.
**Error/loading/retry truth:**

- If Job facts (measurement or proposal list) fail to load, the hero shows "Couldn't load this job's details. Retry". It must not show "Get this job ready…", which would assert emptiness.
- Loading shows a skeleton, not placeholder business copy.

**Implementation type:** **UI + flow.** It extends the existing primary-action resolver to early states using existing facts. There is no new domain state.
**Preserve:**

- Job Card as home.
- Header identity block.
- Domain-tab ownership.
- Existing later-stage resolver.
- More job actions.
- Lost/On Hold/Closed handling (D1–D3).
- Team/Crew stays hidden (D9).

---

## 8. Photos (area D)

**Contractor goal:** on the roof, shoot photos fast; later, find them on the Job and choose which ones the customer sees.

**Current truth/model (A):** **Correct.**

- Photos are scoped to company + Job.
- Supports camera capture input, multi-select, PDF/files, per-file progress, Failed/Retry/Cancel, captions and a viewer.
- Formats: JPEG/PNG/WebP/PDF. HEIC is not established.
- Uploads live in component memory; no offline queue (do not promise one).

**Defects:**

- `prepareJobAttachmentUpload` swallows the storage error and returns a generic 500. The contractor sees "Failed" with no reason.
- Caption save (on blur) and delete fail silently (F6).
- **Environment:** the staging storage bucket does not exist. The baseline migration doesn't create it; `20260927184000` only updates it.

**Current flow issue (B):** photos are reachable (a primary mobile tab), but no Overview action points to them early. After upload there is no onward handoff (Astra §15 "PARTIAL for onward handoff"). The builder has a "Project Photos" page, but how the contractor picks customer-facing photos was not verified live.

**Current UI issue (C):**

- The "Add photos or files" menu is clipped by its container: "Upload file" is cut off (08).
- There is a duplicate heading: "Photos" page title plus a "PHOTOS" section label (09).
- The failed tile shows "Failed / Retry / Cancel" over a grey thumbnail with no reason.

**Evidence:**

- **Cursor live:** 07, 08, 09, 27; bucket probe.
- **Astra source:** §8, F6.
- **Market:**
  - JobNimbus mobile: "+" → Photo → pick job → camera.
  - Roofr and AccuLynx: photos live on the job; the proposal lets you choose images (Cursor market §7).
- **Independent GPT visual review:** Photos coverage not confirmed (the review covered at least New Job, Job Card, Proposal preparation, Templates, Catalog and Pricing Rules). Cursor re-inspection, as supporting evidence, confirms the clipping, duplicate heading and reason-less failure.

**Target flow:**

1. Photos live on the Job (Photos tab). Mobile: Photos stays a primary tab.
2. Upload entry: a single "Add photos" button.
   - On mobile it offers **Take photo** (camera) and **Choose photos**. "Upload file" for PDFs and other documents is a secondary option.
   - On desktop: Choose photos / Upload file.
3. After upload: tiles appear immediately with progress. Done tiles show a caption affordance. The contractor stays in Photos to keep shooting; there is no forced redirect.
4. Onward: when photos exist and no measurement exists, the Overview next-step card already offers Add measurement. No extra prompt inside Photos is required.
5. Customer-proposal photos: chosen inside the builder's Project Photos page from this Job's photos. A per-photo "Show in proposal" toggle in the gallery is **DO NOT ADD** unless the builder path proves insufficient. Verify the builder path first.
6. Old-property photos are not copied in. They are reachable through "Other jobs at this address" (area B), shown as **from an earlier job** with its date. **PRODUCT DECISION NEEDED** (minor) on whether to surface them inline as a collapsed "Earlier photos at this address" section in the Photos tab.

**Target visual hierarchy:**

- One heading ("Photos") with the Add button aligned right.
- Grid of tiles.
- Failed tiles are visually distinct (red outline) with a reason line.

**Primary action:** Add photos (camera-first on mobile).
**Secondary actions:** Upload file, caption, delete, view.
**Hidden until needed:** failed-tile reason; earlier-job photos; PDF section when there are no PDFs.
**Mobile:**

- Camera-first.
- Large tiles (2 per row at 390).
- The Add button is reachable at the thumb: sticky bottom, or the top of the list.
- The menu must not clip.

**Desktop:** grid 4–5 across; menu not clipped (render it in a portal/popover above the container).
**Copy:**

- Empty state: "No photos yet" + Add photos.
- Failure: "Upload failed. Retry" plus a specific reason where known ("File too large", "This file type isn't supported", "Couldn't reach storage").
- Caption or delete failure: "Caption not saved. Retry" / "Couldn't delete. Retry".

**Error/loading/retry truth:**

- List-load failure shows "Couldn't load photos. Retry", never "No photos yet".
- Upload failure carries a reason category.
- Caption/delete failures are visible (fixes F6).
- The staging bucket must exist before any photo visual proof (environment fix through a guarded migration or setup, separately authorized).

**Implementation type:**

- **UI-only:** menu clipping, duplicate heading, failed-tile reason display.
- **Flow + source truth:** error reason passthrough, caption/delete outcomes, staging bucket provisioning (environment).

**Preserve:**

- Job-scoped storage and provenance.
- Multi-upload with per-file progress and retry.
- Camera input.
- No new photo subsystem.
- No offline promise.

---

## 9. Measurement (area E)

**Contractor goal:** enter the roof numbers once, from a report or by hand, and have the proposal use them.

**Current truth/model (A):** **Mostly correct.**

- Selected measurement pointer, current plus earlier measurements, make-current confirmation.
- Ready edits create a new record; incomplete records may be updated.
- Proposals consume derived quantities and freeze them in the snapshot.
- "From the report / This job" split.

**Mixed fact types:** `isManualMeasurementStarterQuantityInputComplete` requires:

- area/estimate-ready values, eaves, rakes, ridges, valleys and step flashing (**roof facts**);
- pipe boots and vents (**site counts**);
- `tear_off_required` and `debris_tons_estimate`. These blur two things: whether tear-off is *included in the work* (a proposal decision) and how much debris there *is* (a site fact only when actually observed or derived).

Only hips and report source are optional.

**Contract rule: MEASURE WHAT IS TRUE. QUOTE WHAT WORK WILL BE PERFORMED.**

| Measurement / site facts (belong to the measurement) | Proposal / work decisions (belong to the proposal) |
|---|---|
| Roof area | Whether tear-off is included in the work |
| Slope / pitch / geometry (eaves, rakes, ridges, hips, valleys, step flashing) | How many layers are included in scope |
| Existing roof layers, when known | Whether disposal is charged |
| Known site and material conditions (pipe boots, vents, stories, deck condition when observed) | Disposal billing basis (ton, load, container, fixed job charge, …) |
| Known disposal quantity, **only if actually observed or derived** by an explicit rule | Disposal customer-facing wording |

- **Unknown site facts must not become zeros.** A blank existing-layers or disposal-quantity field means unknown and is stored and shown as unknown.
- **Proposal choices must not masquerade as measurement facts.** "Tear-off: yes" is a scope choice for this proposal. Recording it as a roof measurement would carry one proposal's choice into every future proposal that uses the measurement.
- Whether the current model already stores existing layers as a site fact is **not verified**. If it doesn't, adding it is a model change that needs its own approval. It is not assumed by this contract.

**Measurement application (locked 2026-10-04; supersedes the earlier "keep the measurement required" lean):**

- The detailed roof measurement workflow is **not a universal prerequisite for every Job**.
- **Full reroof / quantity-driven work** may need measurement-driven quantities.
- **Small repairs, fixed-price work, known scope/price and direct-quote paths** may not need one.
- **Temporary compatibility:** the current full-roof readiness (`isManualMeasurementStarterQuantityInputComplete`, plus the current required-field presentation in the measurement form) may stay for now, because today's reroof proposal flow depends on it. It is **temporary compatibility**, not the future model. It must not be presented visually or architecturally as a universal Job requirement:
  - no Job-level "measurement required" banner;
  - no copy implying every Job needs a measurement;
  - no next-action logic that can only ever say "Add measurement".
- **Reconciliation gate:** before Slice 4A (and before any missing-path proposal work), reconcile the measurement model with direct/small-job proposal paths (Decision 5). The output is which offers need which measured quantities. The current all-fields readiness gate must not be extended or entrenched until then.
- **Job next action** must stay able to select a truthful action other than "Add measurement" (§7 "Next-action architecture constraint").

**Defect F1:** measurement read failures return `[]`, so a saved measurement can appear absent.

**Current flow issue (B):**

- **Wrong after save:** the primary button on the saved view is "Add measurement" (13), not "Prepare proposal", and the Overview doesn't change (14).
- **Unclear before save:** Save stays disabled with no reason when Tear-off and Disposal are blank (12).
- Proposals currently require a ready measurement, which suits a quantity-driven full replacement. That requirement is **temporary compatibility**. Measurement is not a universal Job prerequisite ("Measurement application" above). What remains open in Decision 5 is *which* offers can be proposed without one, and how.

**Current UI issue (C):**

- Required fields are unmarked while optional ones are marked "optional". The asymmetry hides that Tear-off and Disposal are required.
- No reason is given for the disabled Save.
- Otherwise the form is clean, well grouped and correctly labelled: aria-labels such as "Roof area in square feet" were verified.

**Evidence:**

- **Cursor live:** 10–14, 28.
- **Astra source:** §9, F1.
- **Market:**
  - Roofr: measurement is optional to create a proposal, and newer Roofr lets you add or change the measurement from inside the proposal.
  - Roofr can't import external reports, so FieldDive's manual entry is a strength.
  - AccuLynx supports manual measurement capture.
  - In Roofr, disposal is a catalog/template line item, not a measurement field.
- **Independent GPT visual review:** Measurement coverage not confirmed. Cursor re-inspection of 12 is supporting evidence.

**Target flow:**

1. The Measurements tab shows the current measurement (summary) and earlier ones collapsed. Empty: "No measurement yet" + Add measurement.
2. Add measurement form: **roof facts** (from the report) and **site counts** (this job).
   - When Save can't proceed, the contractor is told why in a restrained way: one short helper line, plus highlighting only the fields that need attention after interaction. No long list and no heavy banner. The exact visual language belongs to the future app-wide validation system (§20 Slice 1 "Status", visual debt).
   - Which site facts are required to save is driven by what a proposal genuinely needs to compute quantities. It is not driven by work decisions. Once direct/small-job paths exist, it is also not driven by the full-reroof model alone (Decision 5).
   - The current Slice 1 presentation (amber touched-field highlight; "Complete the required roof measurements to save.") is **temporary compatibility UI** for the full-roof readiness model. It is not the target.
3. **Tear-off and disposal are split by layer (Decision 6):**
   - **In the measurement (site facts):** existing roof layers and known site conditions when known. A disposal quantity goes here only when actually observed or derived by an explicit rule. Unknown stays unknown, not zero. These facts do not block saving roof numbers unless a proposal truly needs them.
   - **In Prepare proposal (work decisions):** whether tear-off is included; how many layers are in scope; whether disposal is charged; the disposal billing basis; the customer-facing wording. These are asked only when the offered scope contains tear-off or disposal lines, and they are stored with the proposal, not the measurement.
   - **Open in Decision 6:** the exact required-to-save fact list; whether "existing layers" exists or is added as a site fact; how an existing `tear_off_required` / `debris_tons_estimate` value on older measurements is treated (for example, as a prefill suggestion in Prepare that the contractor confirms, never as the proposal's answer by default).
   - **Rejected:** simply making Tear-off/Disposal "optional in the measurement and asked in Prepare". That keeps a work decision stored as a measurement field.
4. After save, the saved view's primary action is **Prepare proposal**, or **Review proposal** if a draft already exists and the measurement changed (see stale handling below). "Add measurement" becomes secondary ("Add another measurement"). The Overview next-step card updates (area C).
5. Current vs previous: the newest saved measurement becomes current automatically unless a proposal already uses an earlier one. In that case, keep the existing make-current confirmation. Earlier measurements stay as collapsed history.
6. Measurement changed after a draft: the builder already detects newer measurement context. Keep that, but use plain copy: "The measurement changed after this draft was prepared. Update quantities?" Avoid "snapshot" and "re-pull".

**Target visual hierarchy:**

- Current measurement summary card first: area, waste, pitch and key lengths, with source and date.
- Primary action.
- Earlier measurements collapsed.

**Primary action:** empty → Add measurement; saved → Prepare proposal.
**Secondary actions:** Edit (incomplete only), Add another measurement, Make current (earlier ones).
**Hidden until needed:** earlier measurements; report source; hips; the stale-measurement notice.
**Mobile:**

- Single-column form with numeric keypad inputs.
- Save/Cancel sticky at the bottom.
- The missing-field reason is visible next to Save.
- Measurements must be reachable without "More" (area J).

**Desktop:** two-column form as today.
**Copy:** field labels with units; one restrained helper line when Save can't proceed; no explanation of how quantities flow; nothing implying every Job needs a measurement.
**Error/loading/retry truth:**

- A measurement list read failure shows "Couldn't load measurements. Retry", never "No measurement yet" (fixes F1).
- Save failure keeps the entered values and shows "Measurement not saved. Retry".

**Implementation type:**

- **UI-only:** the Save-blocked helper line and field highlighting. The current version is temporary compatibility UI.
- **UI + flow:** post-save primary action.
- **Flow + source truth:** F1.
- **Domain/product decision required:** site-fact vs work-decision split for tear-off/disposal (Decision 6), the disposal billing basis (Decision 7), and which offers need a measurement at all (Decision 5; measurement is not universal, and the reconciliation must happen before 4A). Moving the work decisions into the proposal is a **flow + source truth** change touching measurement readiness and proposal inputs. It is not UI-only.

**Preserve:**

- Current/earlier separation and the selected pointer.
- New record on ready edit.
- Frozen quantities in proposals.
- "From the report / This job" split.
- Manual entry as a first-class path.

---

## 10. Proposal preparation (area F) — primary focus

**Contractor goal:** "I need to give the Ellises a price." Go from that thought to **a draft I can look at** with the fewest questions, without FieldDive inventing prices and without accidentally changing standard prices.

**Current truth/model (A):** **Correct, with three model-adjacent issues.**

**Correct:**

- Prepare reuses customer, Job and current measurement.
- Resolves the preferred template, or bootstraps the starter catalog and template when no custom preferred template exists.
- Checks required quantities.
- Requires configured pricing policy (direct selling prices or cost-based) and sales tax, asked inline.
- Creates a persisted draft with a frozen snapshot.
- Opens **customer preview** directly (preview-first). The builder returns to the originating Job.

**Issue 1 — pricing scope (F7):** `collectLinkedCatalogPricingLines` walks **all** template items across all packages and upgrades. Every one must be priced before Create proposal is enabled. Observed: 16 prices, including Enhanced/Premium-only items, while the Standard package was selected.

**Issue 2 — where prices go (F3):** "Price this proposal" calls `updateCatalogItem`, and pricing questions upsert company policy. Prices typed here become **company catalog prices** for every future proposal. The UI doesn't say so.

**Issue 3 — unit mismatch:** the starter "Disposal / dump fees" catalog item is priced "per Each". The measurement's disposal is in tons. Result: the quantity 3 (tons) was priced as 3 × $450 "each". The Catalog page shows a unit warning (23). The Prepare dialog does not.

**Truth defect (false blocker):** while the starter install is in progress, the dialog shows "Create or finish a template before creating a proposal." / "Choose a template first." (`PREPARE_PROPOSAL_SETUP_NONE`). This is false: nothing is required of the contractor (16).

**Truth defect (F1):** a pricing-policy read failure resolves to "unconfigured" and asks the contractor to set up pricing again.

**Current flow issue (B):** the steps observed in order:

1. False template error with a "Preparing proposal…" line.
2. "How do you usually price?" (selling vs cost) + Sales tax + **Save pricing**.
3. A starter package preview (Standard, with "Also available: Enhanced · Premium").
4. "Price this proposal": a 16-row price list with a "(16 left)" counter that does not update live.
5. Save prices.
6. Create proposal.
7. Customer preview.

That's two separate save steps before Create. Every package must be priced even if the contractor would only offer one. There is no way to get a draft before all prices exist.

**Current UI issue (C):**

- The modal is long and scroll-heavy: the price wall sits below the package preview.
- Two inline Save buttons plus the footer Create button make it unclear which button commits what.
- "Ask only what this proposal needs. Nothing is assumed until you save." narrates product behavior.
- "FieldDive does not invent prices." is system narration. Its meaning should be expressed by the empty price fields themselves.
- Per-row "Price this item" helper is repeated on every row.

**Evidence:**

- **Cursor live:** 15, 16, 17, 18, 19, 20, 20b, 21.
- **Astra source:** §10, F3, F7; a non-admin proposal author is unverified.
- **Market:**
  - Roofr's first-proposal fork offers per-square (one number) or line-item (Jumpstart).
  - Roofr ad hoc items don't enter the master catalog.
  - JobNimbus drafts autosave, and price changes affect future documents only.
  - Astra's priced-scope boundary: library → chosen offered scope/options → complete offer. Every **offered** option must be priced; the selected package alone is not enough if other packages remain visible to the customer.
  - Astra's three distinct decisions: save unfinished / preview incomplete / issue to customer.
- **Independent GPT visual review:** covered Proposal preparation (ChatGPT conversation; not a repo artifact). Cursor re-inspection of 16/17, as supporting evidence, confirms the false message, stacked saves and price wall.

**Target flow (the contract):**

1. **Open Prepare** from the Job Card main action or the Proposals tab.
2. **Prefilled, shown as compact read-only context rows:**
   - customer and address;
   - current measurement ("2,450 sq ft · 12% waste · from report", with Change);
   - template ("Roof replacement", with Change);
   - starting package (with Change).

   While the starter template installs, show a neutral "Setting up your proposal…" progress state. **Never** show the "Create or finish a template" error during bootstrap.
3. **Offer scope:** which packages and upgrades the customer will see. The default comes from the template. The contractor can switch packages off for this proposal (for example, offer Standard only). Off-switched packages are not shown to the customer **and** not required for pricing. This depends on **Decision 3**; if Decision 3 says "always offer every template package", this step is omitted and pricing covers all packages.
4. **Ask only for missing business answers, in one section, with one save:**
   - pricing method and sales tax, only if the company has never answered (first proposal only);
   - prices, only for items in the **offered scope** that have no catalog price;
   - **work decisions** for tear-off and disposal, when the offered scope contains those lines: whether tear-off is included, layers in scope, whether disposal is charged, its billing basis and its wording (§9 split; Decision 6). Known site facts from the measurement (existing layers, an observed disposal quantity) are shown as context. They are never silently turned into the proposal's answer.
5. **Price entry follows two different rules (see "Price-entry semantics" below):** a missing standard price may become the reusable standard, explicitly; changing an existing standard price for this Job stays with this proposal unless the contractor deliberately promotes it. The current silent write to Catalog is **not acceptable** in either case.
6. **Unit check:** if an offered item's price unit doesn't match its quantity unit (for example, priced per Each with the quantity in tons), the row shows the mismatch inline before pricing ("Priced per each, but measured in tons"). The contractor must fix the unit or the quantity basis. **FieldDive never converts implicitly** (no ton-to-load, no ton-to-each). A conversion happens only through an explicit configured rule. Supported disposal billing bases are **Decision 7**.
7. **Create the draft.**
   - **Slice 4A (current lifecycle rules):** Create stays disabled until every offered item is priced and every unit matches. A live "3 prices needed" count and focus on the first missing row make this quick.
   - **Slice 4B (only if Decision 2 adopts incomplete drafts):** an incomplete contractor draft may be created. See "Incomplete draft domain boundary" below. This is a domain/lifecycle change, not a button change.
8. **Land on customer preview**, preview-first, as today. The preview header shows Draft, Edit proposal, and the send action gated by completeness.

**Price-entry semantics (locked rule; exact control and wording in Decision 4):**

> **ESTABLISHING A MISSING STANDARD PRICE MAY CREATE A REUSABLE DEFAULT.**
> **OVERRIDING AN EXISTING STANDARD PRICE IS JOB-SPECIFIC UNLESS THE CONTRACTOR EXPLICITLY PROMOTES IT TO THE NEW STANDARD.**

| Case | Situation | Default | Must be true |
|---|---|---|---|
| **A. First-time missing standard price** | The catalog item has no standard selling price yet; the contractor enters one in Prepare. | **May** default to becoming the company standard price. | The consequence is explicit on screen ("Future proposals will use this price"). The contractor can choose quote-only where appropriate (for example, a "Just for this proposal" option). Never silent. |
| **B. Job-specific override of an existing standard price** | A standard price already exists; the contractor changes it for this Job (in Prepare or the builder). | **This proposal only.** | The company standard is never silently overwritten. A deliberate secondary action ("Also make this my standard price") updates the standard. That action is visibly separate from simply changing this proposal's price. |

- Standard prices changed either way apply to proposals prepared afterwards. Existing drafts and sent proposals keep their frozen prices.
- The Catalog remains the place where standard prices are maintained (§12). Prepare only establishes missing ones (case A) or promotes on request (case B).
- **Source truth today:** "Price this proposal" always calls `updateCatalogItem` (F3). Case B behavior needs a proposal-scoped price that doesn't touch the catalog. Whether the existing snapshot line price already supports this from Prepare must be verified before implementation. No new pricing store.

**Incomplete draft domain boundary (Slice 4B; adoption is Decision 2):**

> **INCOMPLETE CONTRACTOR DRAFT: MAY EXIST.**
> **CUSTOMER-DELIVERABLE PROPOSAL: MUST BE COMPLETE AND TRUSTWORTHY.**

- **Missing prices display "Price needed"** (or equivalent truthful contractor-facing wording) on the line and "Total pending" on totals. **Never:** $0 as a stand-in; an invented price; a misleading subtotal or total; a silent omission that changes what the customer would be offered.
- **Internal contractor preview** may show incomplete content only when it is clearly marked as incomplete (for example, a banner "Not ready to send: 3 prices needed").
- **Every customer-facing or authority-bearing path must enforce completeness.** At minimum, review and gate each of these:
  - Send (email/SMS delivery);
  - customer/public proposal access (`/p/[token]` and any share link);
  - customer-facing PDF/export/download;
  - acceptance;
  - signing;
  - payment request creation tied to the proposal (deposit requests);
  - any other external delivery or action surface found during the 4B audit.
- Completeness is enforced **on the server**, at each of those paths, from an explicit completeness state computed from the proposal's own data. Hiding a button in the UI is not enough.
- **Why this is domain/lifecycle, not UI:** it changes what a persisted draft may contain, introduces a completeness state that must be correct across the builder, preview, public route, PDF, acceptance, signing and payments, and needs lifecycle tests, plus replay/stale/version behavior where a draft is edited after a link or PDF was produced.
- **Until 4B is authorized and shipped,** the current rule stands: no draft is created until every offered item is priced (Slice 4A).

**Prefilled (target):** customer, address, measurement, template, package, quantities, catalog prices that exist, company pricing method and tax once answered, and payment terms (see below).

**Visible setup:** only the missing answers (steps 4–6). Template, catalog and pricing-rules editing are never required to leave the dialog on the starter path.

**Hidden setup:** template structure, quantity bases, coverage and waste rules, cost and margin (unless cost-based pricing is chosen), and supplier SKUs.

**Which prices are required:** every item in the **offered** scope (Astra boundary). Items in packages not offered are not required. **Not** "only the selected package" when other packages are still shown to the customer.

**Payment terms:** currently default to "No deposit" without asking. Target: use the company's saved default terms. If none exist, ask once inside Prepare, or flag "Payment terms not set" in the preview before send. It must not silently assert "No deposit". **PRODUCT DECISION NEEDED** (minor; needed before Slice 4A).

**What must be complete before any customer-facing action:**

- all offered items priced;
- unit mismatches resolved;
- sales tax answered;
- customer contact present for delivery;
- payment terms set (per the decision above).

Under 4A these extend the existing send-readiness rules; no draft can be incomplete on price, so this is not a new state machine. Under 4B the same conditions become the explicit completeness state enforced on every customer-facing and authority-bearing path (list above).

**Explicit quote vs company pricing:** follows the price-entry semantics above (case A may establish the standard explicitly; case B stays with the proposal unless promoted). Catalog stays the maintenance surface (area H). Per-quote price edits inside the builder stay per proposal (existing snapshot model), with "Also make this my standard price" as the deliberate secondary action.

**Target visual hierarchy (dialog):**

1. Title "Prepare proposal".
2. Context rows: measurement, template, package, each with Change. Compact.
3. "What's still needed" section, only when something is missing:
   - first-time pricing answers;
   - the missing-price rows for offered items, with unit inline;
   - the tear-off/disposal work decisions when the offered scope needs them;
   - the price consequence note for first-time standard prices (case A).
4. Footer: Cancel · **Create proposal**. The one primary button.

The starter package preview ("Standard package" card with ticks) and "Open full starter proposal preview" become a collapsed "What the customer will see" link. They should not sit in the main column above the prices.

**Primary action:** Create proposal. A single commit; the separate "Save pricing" and "Save prices" buttons are folded into it, or kept as one inline save at most.
**Secondary actions:** Change measurement/template/package; preview what the customer will see; Cancel.
**Hidden until needed:**

- first-time pricing questions (once answered, never shown again);
- price rows (only missing offered ones);
- the unit-mismatch notice;
- the starter-install progress (only during install).

**Mobile:** full-screen sheet, not a centered modal. Context rows stack. Price rows use the numeric keypad. Create proposal is sticky at the bottom.
**Desktop:** a centered dialog, max ~640px. If the missing section is long, the context rows collapse to one summary line.
**Copy:**

- Remove "FieldDive does not invent prices." and "Ask only what this proposal needs. Nothing is assumed until you save."
- Case A consequence note (example, wording open in Decision 4): "Future proposals will use these prices." with a "Just for this proposal" option.
- Case B secondary action (example): "Also make this my standard price".
- Incomplete draft (4B only): "Price needed" on lines, "Total pending" on totals, "Not ready to send: 3 prices needed" in the internal preview.
- Missing count updates live: "3 prices needed".
- Unit mismatch: "Priced per each, but measured in tons. Check the unit."

**Error/loading/retry truth:**

- Starter install shows a progress state, not an error.
- A template or catalog read failure shows "Couldn't load your proposal setup. Retry", never "Create a template".
- A pricing-policy read failure shows "Couldn't load your pricing settings. Retry", never the first-time pricing questions (fixes F1).
- Create failure keeps the dialog state and shows "Proposal not created. Retry".

**Implementation type:**

- **Slice 4A — flow + source truth:** false blocker, F1, offered-scope pricing, unit check, case A/B price-entry semantics, tear-off/disposal work decisions in Prepare, customer-facing labels.
- **Slice 4A — UI + flow:** dialog consolidation, single commit, collapsed preview.
- **Slice 4B — domain/lifecycle:** incomplete-draft persistence, completeness state and every customer-facing/authority-bearing gate.
- **Domain/product decision required:** Decisions 2 (4B), 3, 4, 6, 7, plus the payment-terms default.

**Preserve:**

- Starter auto-install.
- Inline pricing-policy questions (no detour to Settings).
- Deterministic catalog pricing.
- No invented prices.
- Frozen snapshot on create.
- Preview-first landing.
- Builder ↔ Job return context.
- Builder quality: estimate table with qty × unit price (21) is strong.

**Customer document truth (from preview, 20/20b), in scope because it's the result of preparation:**

- Seed-key humanization leaks: "Ice Water Valley" for `roofing.ice_water_valley`. Use the catalog item's display name ("Ice & water shield (valleys)").
- Third-person "The contractor will…" should be first-person company voice ("We will…") or the company name.
- Implementation type: **source truth** (labels) + **copy**.

---

## 11. Templates (area G)

**Contractor goal:** "My standard proposal": what I normally offer, how I word it, what the customer receives. Set it up once and stop thinking about it.

**Current truth/model (A):** **Correct.**

- A template is a reusable offer: packages and options, catalog-linked work, upgrades, quantity settings, document wording and estimate display.
- Supports preferred template and default package.
- Starter installs automatically.
- Advanced holds uncommon structural and display settings.
- Changes apply to proposals prepared afterwards. Sent proposals never change. Existing drafts keep what they were prepared with.

**Current flow issue (B):** small. Templates is correctly **not** in the quoting path for the starter case. The only flow issue is that the contractor can't easily see "this is what the customer gets" from the template page. A full document preview exists only inside Prepare (F8).

**Current UI issue (C):**

- "No preferred template yet. Make this preferred to start new proposals from it." is shown while there is **one** template and it **is** being used for proposals. This is technically true but misleading.
- "3 packages · 41 included · 2 optional upgrades": "41 included" is the total line count across packages, not what any one customer sees (Standard has 13). It reads as bloat.
- Three edit buttons (Edit scope / Edit terms & warranty / Manage customer options) plus Make preferred, Advanced, Edit name & purpose and Archive give flat action density.
- The packages row (Standard / Enhanced / Premium with "changes from Standard") is good.

**Evidence:**

- **Cursor live:** 22, 22-full.
- **Astra source:** §11, F8.
- **Market:**
  - Roofr: templates are "my standard proposal", with no design gallery.
  - Roofr sets profitability default/minimum per template.
  - Competitors preview the customer document from the template.
- **Independent GPT visual review:** covered Templates (ChatGPT conversation; not a repo artifact). Cursor re-inspection, as supporting evidence, confirms the misleading preferred message and count.

**Target flow:**

- The template page opens on the preferred, or only, template.
- **Starter default — Decision 9:** whether the auto-installed starter becomes preferred automatically when it's the only template. The recommendation is yes: if exactly one active template exists, it is effectively the default and the UI says so.
- The primary content is a **"What customers see"** preview of the rendered document for the default package, reusing the existing Prepare preview component. Below it come packages and included work.
- Editing is grouped into one "Edit" menu or section: Scope (packages and work), Wording and warranty, Customer options. Advanced stays behind its disclosure.

**Target visual hierarchy:**

1. Template name + "Default" badge (or "Make default" when 2+ templates exist).
2. Preview: "What customers see".
3. Packages (Standard / Enhanced / Premium) with per-package counts.
4. Included work for the selected package.
5. Edit actions.
6. Advanced (collapsed).

The aggregate "41 included" is removed; per-package counts are shown instead.

**Primary action:** none, for an occasional-setup page. With multiple templates, "Make default".
**Secondary actions:** Edit scope / wording / options; Create another template; Archive; Advanced.
**Hidden until needed:**

- Advanced settings.
- Template list (shown only when 2+ templates exist).
- Name & purpose edit.

**Mobile:** read-mostly. Preview and packages stack. Editing is allowed but not optimized. This is occasional desktop setup and not a mobile priority.
**Desktop:** two-column if useful (preview left, structure right). Not required.
**Copy:**

- "Default" instead of "preferred" (Decision 9 covers the term too).
- Keep "Changes apply to proposals prepared after you save. Sent proposals never change." It is a real consequence note.
- Remove "Reusable setups for proposals you start from a Job Card" if the preview makes the purpose obvious.

**Error/loading/retry truth:** a template read failure shows "Couldn't load templates. Retry", never "No templates" (which would trigger a starter reinstall prompt).
**Implementation type:**

- **UI-only:** counts, action grouping, copy.
- **UI + flow:** the preview reuses an existing component.
- **Product decision:** starter default (Decision 9).

**Preserve:**

- Template model (packages, upgrades, catalog links, wording).
- Advanced separation.
- Change-applies-forward rule.
- Starter install.
- No gallery or multiple-design system.

---

## 12. Catalog (area H)

**Contractor goal:** keep a price book of the materials, labor and fees I charge for, with the right units, and trust that proposals use those prices.

**Current truth/model (A):** **Correct.** Items have:

- name and type;
- selling price, unit and cost;
- quantity basis (source), coverage and waste;
- tax;
- supplier SKUs;
- customer visibility.

The table has optional columns, a details panel and a mobile item layout. The Catalog is the maintenance surface.

**Current flow issue (B):** none for maintenance. The quoting-path writes from Prepare (F3) are handled in area F.

**Current UI issue (C):** **largely strong.**

- Scannable table: Item (with family and "Waste on" sublabels), Selling price, Unit, Quantity basis, Status, Unit cost, Actions.
- "Showing 16 of 16 active items · 16/16 priced" summary.
- A disposal unit warning is shown.
- Minor: the Unit cost column shows "—" for all rows under selling-price mode (noise). Deactivate as a visible text action on every row is dense.

**Evidence:**

- **Cursor live:** 23, 23-full.
- **Astra source:** §12. The architecture supports a price book; density was unverified until the live screenshots.
- **Market:**
  - Roofr, JobNimbus and AccuLynx keep the product catalog separate from quoting.
  - JobNimbus: price changes affect future documents only.
- **Independent GPT visual review:** covered Catalog (ChatGPT conversation; not a repo artifact).

**Target flow:** unchanged. The catalog remains the place to maintain standard prices. From Prepare, a missing-price row may optionally link "Edit in catalog", but the contractor never has to go there to finish a proposal.

**Catalog ↔ quoting interaction (locked price-entry rule, §10):**

- **Case A, first-time missing standard price:** a price entered in Prepare for an item with no standard price **may** become the catalog's standard selling price. This happens only with the explicit consequence shown in Prepare and with a quote-only option where appropriate.
- **Case B, an existing standard price:** a different price entered for one Job stays with that proposal. The catalog is **not** changed unless the contractor uses the deliberate "Also make this my standard price" action.
- Either way, a catalog price change applies only to proposals prepared afterwards. Drafts and sent proposals keep their frozen prices.
**Target visual hierarchy / default scan view:**

- Columns: Item · Selling price · Unit · Quantity basis · Status.
- Unit cost is hidden by default under selling-price mode and shown by default under cost-based mode (through existing Columns control defaults).
- Grouping by family (Shingles, Underlayment, Flashing, Fees) is **ADAPT**. Use the existing family sublabel as an optional group header. Do not flatten the data.

**Editing:** row Edit opens the existing details panel. Deactivate moves into the row's overflow or details panel.
**Units and quantity basis:**

- The unit-mismatch warning (catalog unit vs quantity source unit) stays.
- It is promoted to a row-level badge ("Unit doesn't match quantity").
- It is the same check used in Prepare (area F). One rule, two surfaces.
- **The quantity unit and the price unit must match.** FieldDive never converts implicitly: no ton-to-load, no ton-to-each, no ton-to-container. A conversion exists only as an explicit configured rule on the item (for example, "1 container = 3 tons", entered by the contractor), and it is shown wherever it's used.
- **Disposal billing basis is an item choice:** per ton, per load, per container, fixed job charge, or another supported unit (Decision 7). The quantity basis must produce a quantity in that same unit:
  - per ton uses an observed/derived tons quantity;
  - per load or container uses a load/container count, entered or derived by an explicit rule;
  - a fixed job charge uses quantity 1.
- The starter catalog must not ship a disposal item whose price unit and quantity basis disagree. The current "per Each" price on a tons quantity is the observed defect.
- Whether disposal is charged at all on a given proposal is a **proposal work decision** (§9, §10). It is not a catalog setting.

**Primary action:** Add catalog item.
**Secondary actions:** Search, Filters, Columns, Manage catalog, Edit.
**Hidden until needed:** unit cost (mode-dependent), supplier SKUs, coverage/waste details (in the details panel).
**Mobile:** existing item-card layout. Not a field priority.
**Desktop:** table as today.
**Copy:** keep the "16/16 priced" summary. Mismatch badge copy: "Check unit".
**Error/loading/retry truth:** catalog load failure shows "Couldn't load catalog. Retry", never "0 items" or a starter-install prompt.
**Implementation type:** **UI-only** (column defaults, action placement, mismatch badge using existing logic). **Flow + source truth** for the starter disposal item's unit/basis pairing and any explicit conversion rule. **Product decision** for the supported disposal billing bases (Decision 7) and the price-entry control (Decision 4).
**Preserve:**

- The price-book table.
- The details panel.
- Quantity-basis modelling.
- The priced-count summary.
- Separation from quoting.

---

## 13. Pricing Rules (area I)

**Contractor goal:** set once how I price (selling price vs cost plus margin/markup), my profit floor and my tax. Then forget it.

**Current truth/model (A):** **Correct.**

- Company-wide policy.
- Direct selling-price mode asks only sales tax.
- Cost-based mode requires a margin or markup target.
- Minimum margin is a check, not a price changer.
- Material purchase tax is optional.
- Measurement assumptions are shown read-only.

**Defect F1:** a read failure resolves to "unconfigured".

**Current flow issue (B):** none. Quoting asks the first-time pricing questions inline, which is correct, so the page is occasional setup.

**Current UI issue (C):** **observed mismatch.**

- After the contractor chose **"I enter selling prices directly"** in Prepare, the Pricing rules page (24) shows "Pricing method — Profitability type: Margin", Default margin 0 and Minimum margin 0.
- It does not show that selling prices are entered directly.
- A contractor visiting this page would think they're set up for 0% margin cost-plus pricing.
- The Save button appears disabled with no explanation.

**Evidence:**

- **Cursor live:** 16, 24, 24-full.
- **Astra source:** §13, F1.
- **Market:**
  - Roofr profitability default/minimum lives per template.
  - Competitors keep pricing settings as occasional admin.
- **Independent GPT visual review:** covered Pricing Rules (ChatGPT conversation; not a repo artifact).

**Target flow:** unchanged. Prepare asks first-time questions; this page edits them later.

**Target visual hierarchy:**

1. **"How you price": the same choice as Prepare, using the same words:** "I enter selling prices" / "I price from cost".
2. If selling prices: show Sales tax and Minimum margin check (optional; only meaningful when costs exist). Hide Default margin.
3. If from cost: show margin/markup type, Default and Minimum.
4. Tax.
5. Measurement assumptions (read-only).

**Primary action:** Save pricing rules. It is enabled when there are changes. When disabled, it shows no change state rather than a mystery grey.
**Secondary actions:** none.
**Hidden until needed:** margin fields under selling-price mode; material purchase tax detail.
**What quoting exposes:** only the first-time "how do you price" + sales tax, and nothing after that. Changes made here apply to proposals prepared afterwards.
**Whether quote entry updates defaults:**

- Prepare's first-time answers (pricing method, sales tax) establish the company pricing rules once, as today. They are explicit questions, not silent writes.
- Item prices follow the price-entry rule (§10): a missing standard price may become the standard explicitly (case A); overriding an existing standard price stays with the proposal unless promoted (case B).
- This page shows company defaults only. It is setup in the background, not a normal quoting destination.
**Mobile:** single column; occasional use.
**Desktop:** as today (good centered form).
**Copy:** use the same choice labels in Prepare and here. Keep "Minimum margin is a check on the finished proposal; it never changes prices" (a real consequence). Shorten the "Profit can only be calculated when costs are known…" paragraph to a single line under the minimum field.
**Error/loading/retry truth:** a load failure shows "Couldn't load pricing rules. Retry" with the form disabled. Never show defaults (0/0) as if they were saved values (UNKNOWN ≠ ZERO; fixes F1 here).
**Implementation type:** **UI-only** (reflect the existing selling/cost choice; field visibility). **Flow + source truth** (F1). **Verify** whether the stored policy actually records the selling-price choice. If the page shows Margin because the stored value is Margin, that is a **source-truth** defect, not UI.
**Preserve:**

- The policy model.
- Inline first-time questions in Prepare.
- The minimum-margin-as-check rule.
- Deterministic pricing.

---

## 14. Mobile (area J)

**Contractor goal:** on site, phone in hand: photos, measurement, and maybe the proposal in front of the homeowner. Back at the truck: check what's next.

**Current truth/model (A):** n/a (presentation).

**Current flow issue (B):**

- Mobile Job Card tabs: **Overview · Tasks · Photos · More**.
- Measurements, Proposals, Calendar, Payments and Activity are under More.
- The two core-flow steps after photos (measurement and proposal) are hidden.
- The Overview hero has no action (area C), so the only path to a proposal on mobile is More → Proposals.

**Current UI issue (C):**

- Loading flash of the "Authorized work" placeholder (26).
- Otherwise 390 layouts fit (scrollWidth ≤ 390), and the builder at 390 is usable (30).

**Evidence:**

- **Cursor live:** 25–31.
- **Astra source:** §18 (desktop threshold 1200; mobile tab set).
- **Market:**
  - Roofr mobile uses a global "+" quick-create, with the Proposals list under More.
  - JobNimbus mobile: "+" → Photo → job → camera.
  - AccuLynx field app centres photos and measurements.
- **Independent GPT visual review:** mobile coverage not confirmed beyond the Job Card. Cursor's 390 captures are supporting evidence.

**Target flow (Decision 8: final tab set not locked):**

1. **The Overview next-step button is the primary mobile path.** With area C in place, the contractor reaches Add photos → Add measurement → Prepare proposal → Review proposal without opening More. This is the most important mobile change, and it doesn't depend on tab order.
2. **Tab set:** promote the field-work tabs. Candidate: **Overview · Photos · Measure · Proposal · More**, with Tasks, Calendar, Payments and Activity under More. This is an **ADAPT** of competitor patterns, **pending Decision 8**. Tasks are core to later stages, so they may need to come back as the Job progresses (stage-aware tab order is a possible option, but it adds unpredictability; not recommended without evidence).
3. **No global "+"** unless evidence shows contractors start from the app root on mobile. FieldDive starts from the Job (DO NOT COPY for now).

**Top field actions, in order:**

1. Take photos.
2. Add measurement.
3. Prepare / review proposal.
4. Directions / Call.
5. Tasks.
6. Calendar.
7. More.

**Target visual hierarchy:**

- Header (name, address, phone, email).
- Stage indicator.
- Next-step card with a full-width primary button.
- Site card with Directions/Call.
- Tabs.

**Mobile behavior:** primary buttons are thumb-reachable. Forms use sticky Save. Prepare proposal opens a full-screen sheet. No placeholder business copy during loading.
**Desktop behavior:** n/a (see per-area sections).
**Copy:** tab labels are short nouns ("Photos", "Measure", "Proposal").
**Error/loading/retry truth:** skeletons while loading; a "Couldn't load… Retry" state per tab.
**Implementation type:** **UI-only** (loading skeleton). **UI + flow** (next-step button; tab set). **Product decision** (Decision 8).
**Preserve:**

- 390 fit.
- Builder usability at 390.
- Photos as a primary tab.
- The desktop/mobile split at 1200.

---

## 15. Progress / status (area K)

**Contractor goal:** glance and know where the Job is in the process, separately from "is something blocking it?"

**Current truth/model (A):** **Correct; do not build another state machine.**

- Lifecycle stages exist (Intake → … → Complete).
- Dispositions are separate: On Hold, Lost and Closed (D1–D3; Lost is terminal, Complete can't become Lost).
- Attention items and tasks exist.

**Current flow issue (B):** none for this slice.

**Current UI issue (C):**

- The stage shows as a single grey pill ("Intake", "Proposal") next to "More job actions". It reads as a button. It gives no sense of where the Job sits in the overall process.
- Sub-status (draft in progress, waiting on customer) lives only in the hero title.

**Evidence:**

- **Cursor live:** 06, 14, 31.
- **Market:**
  - Roofr: 5–8 stages with tasks.
  - AccuLynx: milestones (Lead → Prospect → Approved → Completed → Invoiced → Closed) plus statuses.
  - JobNimbus: stages, with Lost reachable from anywhere.
- **Astra source:** n/a.
- **Independent GPT visual review:** the Job Card screens it reviewed include the stage pill. A separate progress/status design review is not confirmed.

**Target (Decision 10: visual treatment and labels not locked):**

- **Requirement (locked):** on every viewport, the Job clearly shows:
  - the **current canonical stage**;
  - the **contextual status**, when it matters;
  - the **next action**.
- **Treatment (not locked; design candidates to validate in visual proof):** a compact progress strip; small dots or segments; a stage label with a lightweight progress cue; or another premium compact treatment. Desktop may show more labels than mobile.
- **No literal "Step X of Y" is locked**, on mobile or desktop. A numbered count can falsely imply a rigid wizard. Optional or skipped work makes counts misleading. On Hold, Lost and Closed don't fit a numbered sequence.
- **Candidate labels** (from existing lifecycle stages; not locked): Intake · Proposal · Pending scheduling · Scheduled · In progress · Complete. They must map 1:1 to existing lifecycle stages. **Do not invent stages.**
- **On Hold, Lost and Closed are shown separately from forward progress**, as a distinct badge (for example, a red "Lost" or amber "On hold" badge) that overrides or annotates the strip. They are not a step in the strip.
- **Contextual sub-status** ("Draft not sent", "Waiting on customer", "Deposit due", "Materials pending") belongs in the next-step card (area C), not the strip.

**Primary action:** none; the indicator is informational. Lifecycle actions remain in More job actions.
**Hidden until needed:** disposition badges (only when On Hold, Lost or Closed).
**Mobile:** shows the current canonical stage, the contextual status when important, and the next action. The exact treatment is chosen through visual design and proof, not locked here. A full strip appears at 390 only if it fits without wrapping. Example concept only (not locked labels or layout):

```
Proposal
Waiting on customer
[ Review proposal ]
```
**Desktop:** full strip with labels, below the header contact line.
**Copy:** stage labels are the existing names in plain language, with no internal identifiers. Disposition copy is unchanged from the accepted Lost wording.
**Error/loading/retry truth:** if the stage is unknown (load failed), show no strip rather than "Intake".
**Implementation type:** **UI-only** (presentation of existing stage) **+ product decision** (Decision 10: labels and treatment).
**Preserve:**

- Existing lifecycle stages.
- Disposition separation and rules (D1–D3, D5, D6).
- The accepted Lost copy.
- No new state machine.

---

## 16. Copy

Rule: **THE CONTRACTOR SHOULD SEE WHAT SOMETHING MEANS, NOT HOW FIELDIVE IMPLEMENTS IT.** (plain-language standard, execution standards). The table lists observed instances needing change. Copy that is already good is listed as keep.

| Where | Current | Problem | Target direction |
|---|---|---|---|
| Overview hero (all early stages) | "Get this job ready for a proposal. Add a measurement or prepare a proposal when you're ready." | Text instead of action; doesn't change after measurement | Short stage title + one primary button (area C) |
| Prepare (bootstrap) | "Create or finish a template before creating a proposal." / "Choose a template first." | **False** while the starter installs | "Setting up your proposal…" progress; no error |
| Prepare pricing | "Ask only what this proposal needs. Nothing is assumed until you save." | Narrates product behavior | Remove |
| Prepare prices | "FieldDive does not invent prices." | System narration ("FieldDive …") | Remove; empty price fields + "3 prices needed" say it |
| Prepare prices | (no consequence note) | Prices silently become standard catalog prices | First-time price (case A): "Future proposals will use these prices." with a quote-only option. Override (case B): stays with the proposal; secondary "Also make this my standard price". Wording finalized in Decision 4. |
| Proposal (4B only) | — | Risk of $0 or blank meaning "unknown" | "Price needed" / "Total pending" / "Not ready to send: N prices needed" |
| Prepare prices | "(16 left)" | Doesn't update live | Live "N prices needed" |
| Measurement | Required fields unmarked; disabled Save no reason; Tear-off/Disposal (work decisions) required | Hidden requirement; work decisions posing as roof facts | Required markers on true site facts + "Add ridges to save"-style missing line; tear-off/disposal decisions asked in Prepare (§9) |
| Measurement saved | Primary "Add measurement" | Wrong next action | "Prepare proposal" primary |
| Photos | "Failed" | No reason | "Upload failed. Retry" + reason |
| Customer document | "Ice Water Valley" | Seed key leak | Catalog display name |
| Customer document | "The contractor will…" | Third person | "We will…" / company name |
| Customer document | Payment "No deposit" (unasked) | Asserted default | Company default or ask / flag before send |
| Templates | "No preferred template yet. Make this preferred…" | Misleading with one active template | "Default" badge (Decision 9) |
| Templates | "41 included" | Aggregate count reads as bloat | Per-package counts |
| Pricing rules | "Margin" shown after choosing selling prices | Doesn't reflect the choice | Same "How you price" choice as Prepare |
| Builder stale notice | "snapshot", "re-pull measurement quantities", "live Catalog economics" (Astra §16) | Implementation terms | "The measurement changed after this draft was prepared. Update quantities?" |

**Keep:**

- "Get this job ready for a proposal" (as a title).
- "Back to Job Card".
- "Add a caption".
- "Proposal draft in progress / Not sent to the customer yet" (as title + context).
- "Changes apply to proposals prepared after you save. Sent proposals never change."
- "Minimum margin … never changes prices."
- The "From the report / This job" labels.

---

## 17. Error / loading / retry (area L)

**Standard:** every read shows one of loading, loaded (data or true empty) or failed (with Retry). Failure never renders as empty or unconfigured. Every write either succeeds visibly or fails visibly with Retry and keeps the input.

| Surface | Current truth | Target | Type | Source |
|---|---|---|---|---|
| Intake customer/property search | Error discarded → looks like "no match" (F5) | "Couldn't check existing customers. Retry"; create still allowed | flow + source truth | Astra F5 |
| Intake create retry | Customer created before idempotency fingerprint → possible duplicate (F2) | Reuse created customer across retry; whole intake retry-safe | source truth | Astra F2 |
| Job Overview facts | Hero shows "Get this job ready…" regardless of load outcome | Failure: "Couldn't load this job's details. Retry"; loading: skeleton (no "Authorized work" flash) | UI + source truth | Cursor 26 |
| Photos list | Has loading/failed states | Keep; ensure failure ≠ "No photos yet" | verify | Astra §8 |
| Photo upload | Generic 500; "Failed" no reason | Reason category passthrough | source truth + UI | Cursor 09, source |
| Photo caption/delete | Silent failure (F6) | Visible failure + Retry | source truth + UI | Astra F6 |
| Staging bucket | Missing | Provision (environment; guarded; separately authorized) | environment | bucket probe |
| Measurements list | Read error → `[]` (F1) | "Couldn't load measurements. Retry" | source truth | Astra F1 |
| Prepare: starter install | Shows false template error | Progress state | source truth + UI | Cursor 16 |
| Prepare: template/catalog read | Can look like missing setup | "Couldn't load your proposal setup. Retry" | source truth | Astra F1 class |
| Prepare: pricing policy read | Failure → "unconfigured" → re-asks setup (F1) | "Couldn't load your pricing settings. Retry" | source truth | Astra F1 |
| Pricing rules page | Shows 0/0 defaults | Failure state; never defaults as saved values | source truth + UI | Cursor 24, Astra F1 |
| Templates / Catalog read | Unverified | Failure ≠ empty/starter prompt | verify | — |
| Create proposal | Unverified failure path | Keep dialog state; "Proposal not created. Retry" | verify | — |

**Loading presentation:** skeletons shaped like the final content. No placeholder business copy. No layout jump when the next-step button appears.

---

## 18. Product decisions

Each decision is in contractor language with the options, the evidence and a **lean**. The lean is a recommendation only. Evidence strength is noted.

**Revision 1 (review-agreed):** some *rules* are now locked: price-entry semantics, the measurement-fact vs work-decision split, the incomplete-draft boundary, and the mobile progress requirement. Each decision below states what is locked and what remains open. The open parts are **not decided** by this contract.

**1. What's the main button right after I create a Job?** *Classification: PRODUCT DECISION NEEDED*
- (a) **Prepare proposal** always (measurement is asked inside Prepare if needed).
- (b) **Add measurement** first, then Prepare proposal.
- (c) **Adaptive:** on mobile "Add photos / Add measurement" (on site); on desktop "Prepare proposal" (in office).
- Evidence:
  - Roofr allows proposals without measurement and offers measurement inside the proposal.
  - FieldDive currently requires a measurement for quantity proposals.
  - The real-world order (execution standards) is photos → measurement → proposal.
- **Lean (revised 2026-10-04):** the main button is **truthful per Job**, not a fixed choice:
  - (b) "Add measurement" for quantity-driven work while today's proposal flow requires one;
  - (a) "Prepare proposal" for Jobs whose proposal path doesn't need a measurement, once Decision 5 paths exist.
  - The resolver must be built so it can return either. It must never hard-code "Add measurement" as the only early action.
  - (c) has no direct evidence and adds unpredictability.

**2. Can I save a proposal before every price is filled in?** *Classification: PRODUCT DECISION NEEDED (domain/lifecycle; Slice 4B)*
- **Locked boundary:** INCOMPLETE CONTRACTOR DRAFT: MAY EXIST. CUSTOMER-DELIVERABLE PROPOSAL: MUST BE COMPLETE AND TRUSTWORTHY. Missing prices show "Price needed": never $0, never invented, never a misleading total, never a silent omission. If incomplete drafts are allowed, the server enforces completeness on every customer-facing or authority-bearing path:
  - Send;
  - public/customer access;
  - PDF/export;
  - acceptance;
  - signing;
  - proposal-tied payment requests;
  - any other external surface.
- **Open:** whether to adopt incomplete drafts at all, and when.
  - (a) No (current): Create stays disabled until every offered price exists.
  - (b) Yes: incomplete draft persisted; internal contractor preview allowed when clearly marked as incomplete; every external path gated.
  - (c) Yes, save-only: incomplete draft persisted, internal preview also blocked until complete.
- Evidence:
  - JobNimbus autosaves drafts.
  - Roofr creates the draft immediately.
  - Astra's three-decision model (save unfinished / preview incomplete / issue).
  - Frozen truth is not weakened by (b) as long as unknown prices render as unknown, and every external path is gated server-side.
- **Lean: (b), shipped only as Slice 4B** after Slice 4A. This is a domain/lifecycle change, not a button change. Until then (a) stands.

**3. Do I have to price packages I'm not offering?** *Classification: PRODUCT DECISION NEEDED (leaning ADAPT)*
- (a) Yes (current): every package and upgrade in the template must be priced.
- (b) Price only the **offered** packages/upgrades. The contractor can switch packages off for this proposal; switched-off packages are not shown to the customer.
- (c) Price only the selected package, even if others are shown. **Rejected by evidence:** shows unpriced options to the customer (Astra boundary).
- **Lean: (b).** Requires a per-proposal "offered scope" built on existing package data, not a new store.

**4. When I type a price while quoting, is it just for this job or my new standard price?** *Classification: ADAPT (rule locked) + PRODUCT DECISION NEEDED (control and wording)*
- **Locked rule:** ESTABLISHING A MISSING STANDARD PRICE MAY CREATE A REUSABLE DEFAULT. OVERRIDING AN EXISTING STANDARD PRICE IS JOB-SPECIFIC UNLESS THE CONTRACTOR EXPLICITLY PROMOTES IT TO THE NEW STANDARD.
  - **A. No standard price yet:** may default to becoming the standard. The consequence is explicit ("Future proposals will use this price"). A quote-only choice is available where appropriate. Never silent.
  - **B. A standard price already exists, changed for this Job:** proposal-specific by default. The company standard is never silently overwritten. A deliberate secondary action ("Also make this my standard price") updates the standard.
- **Open:**
  - for case A, whether the default is "make it standard" (with a quote-only option) or neutral (the contractor picks each time);
  - the exact control (per row, or one choice for all new prices);
  - the wording;
  - whether case B's promote action also appears in the builder, or only in Prepare.
- Evidence:
  - Roofr ad hoc items don't enter the catalog.
  - JobNimbus price changes affect future documents only.
  - Astra F3: the current silent write is a confusion risk.
  - For a first-time user with an empty catalog, saving to standard prices avoids re-asking on the next proposal.
- **Lean (case A):** default to "make it standard", with one visible consequence note and a "Just for this proposal" option.

**5. Can I make a proposal without a roof measurement?** *Classification: PRODUCT DECISION NEEDED*
- (a) No (current).
- (b) Yes for templates or packages whose lines don't depend on measured quantities (repairs, fixed-price items).
- (c) Yes always; quantity lines show "Quantity needed" until a measurement is added.
- Evidence:
  - Roofr allows it.
  - FieldDive's quantity-driven model is safer for full replacements.
  - Astra: "keep current safety until that scope is decided."
- ~~Lean: keep (a) for this flow; decide (b) when repair/fixed-price scope is defined.~~ **Superseded 2026-10-04.**
- **Locked:** measurement is **not a universal Job prerequisite** (§9 "Measurement application"). (a) remains as **temporary compatibility** for the current reroof flow only. It must not be presented or architected as the future model.
- **Open:** (b) vs (c), and the exact paths:
  - which templates/offers are quantity-driven;
  - how a direct/fixed-price quote is entered;
  - how quantity lines behave without a measurement.
- **Gate:** reconcile before Slice 4A and before any missing-path proposal work.

**6. Where do I record what's on the roof versus what tear-off and disposal work I'm quoting?** *Classification: ADAPT (split locked) + PRODUCT DECISION NEEDED (details)*
- **Locked rule:** MEASURE WHAT IS TRUE. QUOTE WHAT WORK WILL BE PERFORMED.
  - **Measurement / site facts:** roof area; slope/geometry; existing roof layers when known; known site and material conditions; a disposal quantity **only** if actually observed or derived by an explicit rule.
  - **Proposal / work decisions:** whether tear-off is included; how many layers are in scope; whether disposal is charged; the disposal billing basis; the disposal customer-facing wording.
  - Unknown site facts never become zeros. Proposal choices never masquerade as measurement facts.
  - **Rejected:** "optional in Measurement and asked in Prepare" for both fields as they stand. That keeps a work decision stored as a measurement field.
- **Open:**
  - the exact list of site facts required to save a measurement;
  - whether "existing layers" is already stored or must be added (model change; separate approval);
  - how older measurements' `tear_off_required` / `debris_tons_estimate` values are treated (lean: shown in Prepare as a suggestion the contractor confirms, never auto-applied as the proposal answer).
- Evidence:
  - Tear-off and disposal charging are work decisions.
  - In Roofr, disposal is a line item.
  - Requiring them in the measurement blocks saving otherwise complete roof numbers.

**7. How is disposal charged: per ton, per load, per container or a fixed job charge?** *Classification: ADAPT (unit rule locked) + PRODUCT DECISION NEEDED (supported bases, starter default)*
- **Locked rule:**
  - The quantity unit and the price unit must match.
  - No implicit ton-to-load, ton-to-container or ton-to-each conversion.
  - Any conversion requires an explicit configured rule that the contractor can see.
  - Whether disposal is charged on a proposal is a work decision (Decision 6).
- Current: the starter catalog prices per Each; the measurement estimates tons. This produced 3 × $450.
- **Open:**
  - which billing bases FieldDive supports at launch (ton, load, container, fixed job charge, others);
  - whether explicit conversion rules are needed at launch or later;
  - the starter's coherent default pairing.
- Evidence: Astra market says an explicit economic unit is needed and there should be no automatic conversion.
- **Lean:** the contractor chooses the basis per catalog item, with the unit check enforcing a match. The starter ships one coherent pairing (for example, a fixed job charge with quantity 1, or per ton with an observed tons quantity). The starter must never ship a mismatch.

**8. What's on the bottom tabs on my phone?** *Classification: PRODUCT DECISION NEEDED (leaning ADAPT)*
- (a) Current: Overview · Tasks · Photos · More.
- (b) Overview · Photos · Measure · Proposal · More (Tasks under More).
- (c) Keep (a) and rely on the Overview next-step button.
- Evidence:
  - Field-capture competitors emphasize photos and measurements.
  - Roofr keeps Proposals under More but has "+".
- **Lean: ship the next-step button first (no decision needed), then decide (b) vs (c) with mobile visual proof.**

**9. Is the starter template automatically my default?** *Classification: PRODUCT DECISION NEEDED (leaning ADAPT)*
- (a) Current: the starter is used but shows "No preferred template yet".
- (b) If there is exactly one active template, it is the default and is labelled "Default".
- (c) The starter is explicitly marked default at install.
- Also decide the term: "Default" vs "Preferred".
- **Lean: (b), with the term "Default".**

**10. How do I see where a job is in the process?** *Classification: CHANGE PRESENTATION (requirement locked) + PRODUCT DECISION NEEDED (treatment, labels)*
- **Locked requirement:** on every viewport the Job shows the current canonical stage, the contextual status when important, and the next action. On Hold, Lost and Closed stay separate from forward progress. No new state machine.
- **Not locked:** labels (they must map 1:1 to existing lifecycle stages) and visual treatment. Candidates:
  - a compact progress strip;
  - small dots or segments;
  - a stage label with a lightweight progress cue;
  - another premium compact treatment.
- **Explicitly not locked:** a literal "Step X of Y" count. It can imply a rigid wizard; skipped work makes counts misleading; dispositions don't fit a numbered sequence.
- **Lean:** a compact strip on desktop. Mobile is decided through visual design and proof. Example concept: "Proposal / Waiting on customer" above the next-step button.

**Minor decisions also raised (not blocking the first slices):**

- **Payment-terms default:** "No deposit" asserted without asking (area F).
- **Prior-job photos:** reachable through "Other jobs at this address" only, or also inline as "Earlier photos at this address" (area D).
- **Desktop tab order:** follow the work order (area C).
- **Address suggestions:** location bias toward the company service area (area A).

---

## 19. Matrix

Classification key: **ADOPT** (take the proven pattern), **ADAPT** (take it, fitted to FieldDive), **KEEP** (FieldDive is already right), **CHANGE PRESENTATION** (model right, UI wrong), **PRODUCT DECISION NEEDED**, **DO NOT COPY**.

| Area | Truth/model correct? | Flow correct? | UI clear/professional? | Classification | Implementation type |
|---|---|---|---|---|---|
| A Intake | Yes, except F2, F5 | Yes | Yes (minor loading label) | KEEP + truth fixes | flow + source truth |
| B Customer/Property reuse | Yes | Mostly (silent search failure) | n/a | KEEP; ADAPT prior-jobs link | UI + flow |
| C Job Card Overview | Yes | **No** (no early main action) | **No** (passive hero; pill reads as button) | CHANGE PRESENTATION + flow; ADOPT job-as-home next-action | UI + flow |
| D Photos | Yes, except F6 + upload reason; staging bucket missing | Mostly | **No** (menu clipped, duplicate heading, reasonless failure) | KEEP model; CHANGE PRESENTATION | UI-only + source truth |
| E Measurement | Mostly; **No** for tear-off/disposal (work decisions stored as measurement fields); F1 | **No** after save; unclear before save | Partly (clean form, hidden requirements) | KEEP current/history model; ADAPT fact vs work-decision split (rule locked); CHANGE PRESENTATION; PRODUCT DECISION (5, 6 details) | UI + flow; flow + source truth (split) |
| F Proposal preparation (4A) | Yes core; **No** for false blocker, F1, all-graph pricing, silent catalog write, unit mismatch | **No** (price wall, two saves) | **No** (long modal, narration) | ADAPT (offered scope; price-entry A/B rule locked; unit rule locked); PRODUCT DECISION (3, 4 control, 7 details) | flow + source truth; UI + flow |
| F Incomplete draft (4B) | Current model allows no incomplete draft | n/a until adopted | n/a | ADAPT boundary (locked); PRODUCT DECISION (2: adopt/when) | **domain/lifecycle** |
| F′ Customer document | Mostly (seed labels, third person, asserted terms) | Yes (preview-first) | Yes (strong) | KEEP; fix labels/copy | source truth + copy |
| F″ Builder | Yes | Yes | Yes (strong) | KEEP | — |
| G Templates | Yes | Yes | Partly (misleading default, aggregate count, flat actions) | KEEP model; CHANGE PRESENTATION; ADOPT doc preview; DO NOT COPY gallery | UI-only + UI + flow; decision 9 |
| H Catalog | Yes; **No** for the starter disposal unit/basis mismatch | Yes (quoting writes governed by the A/B price rule) | Yes (minor column/action density) | KEEP; minor CHANGE PRESENTATION; unit-match rule locked | UI-only; source truth (starter pairing) |
| I Pricing Rules | Yes, except F1; verify stored selling-price choice | Yes | **No** (doesn't reflect chosen method) | CHANGE PRESENTATION (+ verify source) | UI-only / source truth |
| J Mobile | n/a | **No** (measure/proposal behind More) | Mostly (fits 390; loading flash) | ADAPT; PRODUCT DECISION (8); DO NOT COPY global "+" | UI + flow |
| K Progress/status | Yes | Yes | Partly (pill) | CHANGE PRESENTATION (stage + status + next action required); PRODUCT DECISION (10: treatment/labels; no "Step X of Y" lock); DO NOT build a new state machine | UI-only |
| L Error/loading/retry | **No** in several reads (F1, F5, F6, upload reason) | — | — | Truth first | source truth |
| M Next actions | — | **No** at intake, after measurement and at draft | — | ADOPT single stage-aware action | UI + flow |

**Natural next actions (area M):**

| Contractor just… | Natural next action | Target main action | Where |
|---|---|---|---|
| Created the Job | Capture the site or start the quote | Decision 1 (lean: Add measurement) | Overview next-step card |
| Added photos | Keep shooting or measure | (stay in Photos); Overview shows Add measurement | Photos / Overview |
| Saved a measurement | Prepare the proposal | **Prepare proposal** | Measurement saved view + Overview |
| Opened Prepare with missing prices | Enter the missing offered prices | Create proposal (4A: enabled when complete; 4B: incomplete draft allowed if Decision 2 adopts it) | Prepare |
| Created the draft | See what the customer sees | (lands on Customer preview) | Preview |
| Returned to the Job with a draft | Finish or review the draft | **Review proposal** (Finish proposal only after 4B) | Overview |
| Measurement changed after the draft | Update the draft's quantities | "Update quantities?" in builder/preview | Builder |

---

## 20. Correction roadmap

Ordered by contractor outcome. Each slice needs explicit authorization. Each slice ends at its own commit point after tests, visual proof and **independent GPT visual review** (mandatory for every visible implementation slice; Cursor self-review is supporting evidence only). No slice reopens Team/Crew (D9).

**Order:**

1. Truth / reliability.
2. Intake / Job handoff.
3. Site capture / measurement.
4. Proposal work, as two slices that are never combined into one commit:
   - **4A** — proposal preparation UI/flow (current lifecycle rules);
   - **4B** — incomplete-draft lifecycle/domain.
5. Template / Catalog / Pricing presentation.
6. Mobile.
7. Progress / status.
8. End-to-end cohesion proof.

4B follows 4A. It may also be sequenced after Slices 5–7, because Core Flow 1 works end to end without it.

**Order unchanged by revision 2 (2026-10-04).** Two scope constraints are added:
- The **Decision 5 measurement reconciliation** is a blocking prerequisite of 4A.
- Slices 2 and 3 must not entrench measurement as a universal Job requirement. The Slice 2 resolver must allow non-measurement actions, and Slice 3's required-field presentation is temporary compatibility.
- Visible error/validation styling across slices should converge on one app-wide visual system (Slice 1 visual debt). It must not copy Slice 1's one-off treatment.

### Slice 1 — "What FieldDive shows me is true" (truth / reliability)
- **Contractor outcome:** a failed load never looks like "nothing saved" or "not set up". Retrying a new Job never creates a duplicate customer. Photo failures say why. The customer document uses real item names.
- **Model preserved:** all identity, measurement, pricing and snapshot models. Only failure semantics and label sourcing change.
- **UI/flow changes:**
  - F1: measurement, pricing-policy, template/catalog failed-read states.
  - F5: search error state.
  - F2: intake retry reuses the customer.
  - F6: caption/delete outcomes.
  - Upload failure reason.
  - False "Create or finish a template" → install progress.
  - Seed-key label → catalog display name.
  - Third-person → company voice.
  - Pricing rules page reflects the stored method (verify the source first).
- **Decision prerequisites:** none, apart from the customer-document voice ("We" vs company name), which is minor.
- **Visual proof:** desktop ≥1200 and mobile 390 for each failure state (forced through test harness or fault injection in tests, not by breaking staging); install-progress state; corrected preview labels.
- **Test scope:** unit tests per store/hook for error ≠ empty; an intake retry idempotency test spanning customer creation; a label formatter test; a Prepare model test for bootstrap state.
- **Risk boundary:** no schema change expected. If F2 needs a server-side operation key change, stay within the existing idempotency mechanism.
- **Environment (separate authorization):** provision the staging attachments bucket through a guarded migration/setup (`scripts/supabase-target-guard.ps1`, staging only). It is required before Slice 3 photo proof.
- **Commit point:** after tests and independent GPT visual review of the failure states.
- **Status (2026-10-04):**
  - The truth/reliability **direction** is accepted for continuation.
  - The current implementation remains **pending independent code/scope review**. It is uncommitted working-tree changes built on `3cf4d49`, after the correction pass.
  - That direction covers:
    - error ≠ empty loads;
    - intake retry idempotency;
    - attachment failure classification (including `bucket_not_found`);
    - truthful caption/remove/upload outcomes.
  - The visible error/validation presentation is **not** accepted as the final FieldDive UI language. **Known visual debt:**
    - too much amber/yellow emphasis;
    - measurement capture reflects the full-roof readiness model, which must not become universal (§9 "Measurement application");
    - the current measurement-requirement presentation is temporary compatibility UI;
    - the photo upload failure is truthful but visually over-emphasized;
    - the caption/remove failure presentation is truthful but unfinished;
    - app-wide failure/validation presentation needs one coherent future visual system, not one-off banners;
    - "Find or add customer" is confirmed pre-existing at HEAD. Its final place in New Job intake is a future product/UI evaluation (Major UI Product Advancement Gate), not Slice 1 work.
  - **DO NOT treat the current Slice 1 screenshots as visual baselines** (`tmp/fielddive-ui-review/core-flow-1-slice-1-truth*`). The truth states are the durable part. Later slices may restyle every one of them.
  - The staging attachments bucket is still missing, so real uploads return 503. Provisioning still needs separate authorization.

### Slice 2 — "The Job tells me what to do next" (intake / Job handoff)
- **Contractor outcome:** after creating a Job, and at every early stage, one obvious button moves the Job forward. It works on desktop and mobile without opening More.
- **Model preserved:** existing primary-action resolver (extended to early states), lifecycle stages, domain-tab ownership.
- **UI/flow changes:**
  - Overview next-step card with a single stage-aware primary button (intake / measured / draft).
  - Site card keeps the address; the measurement summary becomes its own row.
  - Mobile loading skeleton (no "Authorized work" flash).
  - Intake loading indicator.
- **Decision prerequisites:** Decision 1 (main action after create; revised lean: truthful per Job). ~~The Decision 5 lean (keep the measurement required) must be confirmed.~~ *Superseded 2026-10-04:* measurement is not universal. The early-state resolver must be able to return an action other than "Add measurement", even if today's data only ever produces it.
- **Visual proof:** Overview at intake, measured, draft and sent (unchanged), desktop + 390; mobile path Job → Measurement → Prepare without More.
- **Test scope:** resolver unit tests for the early states; component tests for the card; no regression in later-stage resolver outputs.
- **Risk boundary:** no new state. Later-stage actions are unchanged. On Hold/Lost/Closed rendering is unchanged.
- **Commit point:** after tests and independent GPT visual review.

### Slice 3 — "On site I can capture what I need quickly" (site capture / measurement)
- **Contractor outcome:**
  - Photos are camera-first on mobile with clear failures.
  - The measurement form says what's required and why Save is disabled.
  - After saving, the next step is Prepare proposal.
- **Model preserved:** Job-scoped photos, measurement current/history, new record on ready edit.
- **UI/flow changes:**
  - Photos: menu not clipped, single heading, camera-first mobile entry.
  - Measurement: a restrained Save-blocked explanation for true site facts (temporary compatibility; see below), and post-save primary "Prepare proposal".
  - Measurement holds site facts only (MEASURE WHAT IS TRUE). Unknown facts stay unknown, never zero. Tear-off scope and disposal charging leave measurement readiness and become proposal work decisions (asked in 4A).
- **Decision prerequisites:** Decision 6 details (required fact list; existing-layers field; treatment of older `tear_off_required` / `debris_tons_estimate` values). Prior-job photos is a minor decision and optional for this slice.
- **Measurement application (2026-10-04):**
  - Measurement work in this slice improves capture for quantity-driven Jobs only.
  - It must not present the measurement as a universal Job requirement.
  - It must not extend the full-roof readiness gate.
  - Required-field presentation stays temporary compatibility until the Decision 5 reconciliation (before 4A).
  - It uses the future app-wide validation language, not Slice 1's one-off amber treatment.
- **Visual proof:** Photos empty/uploading/failed/done (needs the staging bucket); measurement empty/partial/saved, with unknown facts shown as unknown, desktop + 390.
- **Test scope:** measurement readiness tests updated for the site-fact list; tests that blank site facts are stored and read as unknown, not zero; post-save action test; photos component tests.
- **Risk boundary:** removing tear-off/disposal from measurement readiness must not leave proposals without those answers. The measurement change ships only together with, or after, 4A asking for those work decisions in Prepare. Existing measurements and frozen proposals must read correctly.
- **Commit point:** after tests and independent GPT visual review. The measurement-readiness change is coordinated with 4A; the photos work can commit independently.

### Slice 4A — "From 'give them a price' to a draft I can look at" (proposal preparation UI/flow)
- **Contractor outcome:**
  - Prepare shows what FieldDive already knows compactly.
  - It asks only for what's missing for the offer being made, in one "What's still needed" section, with one commit.
  - Price consequences are clear.
  - Unit mismatches are visible.
  - The contractor lands on the customer preview.
- **Model preserved:** starter bootstrap, deterministic catalog pricing, inline policy questions, frozen snapshot, preview-first, Send readiness gate. **Current domain/lifecycle rules are unchanged:** no draft is created until every offered item is priced, unless 4B is separately authorized.
- **UI/flow changes:**
  - Compact known context (customer, measurement, template, package, each with Change).
  - One "What's still needed" section.
  - Offered-scope pricing (pricing walks the offered scope only).
  - Unit-mismatch visibility (same rule as the Catalog; no implicit conversion).
  - Explicit price consequences under the locked rule:
    - case A: a first-time missing standard price may become the standard, explicitly, with a quote-only option;
    - case B: overriding an existing standard stays with the proposal, with a deliberate "Also make this my standard price".
  - Tear-off/disposal work decisions asked here when the offered scope needs them.
  - The false template-loading blocker is replaced by install progress (if not already done in Slice 1).
  - Fewer setup-style controls: the two inline Save buttons are folded into one Create; the starter preview is collapsed to "What the customer will see".
  - Clearer create-draft path: live "N prices needed" and focus on the first missing row.
  - Customer-facing label correctness: catalog display names, company voice, payment terms not asserted (if not already done in Slice 1).
  - Mobile full-screen sheet.
- **Decision prerequisites:**
  - Decision 3 (offered scope);
  - Decision 4 open parts (case A default, control, wording);
  - Decision 6 details (coordinated with Slice 3);
  - Decision 7 details (supported disposal bases, starter pairing);
  - payment terms;
  - **Decision 5 reconciliation (added 2026-10-04, blocking):** reconcile the measurement model with direct/small-job proposal paths before 4A starts. Prepare's "known context" must not assume that every proposal has a measurement. The output decides whether 4A includes a no-measurement path or is explicitly scoped to quantity-driven offers, with that limitation marked temporary.
- **Visual proof:**
  - First-ever proposal (empty company): install progress → questions → prices with the case A consequence → preview.
  - Repeat proposal (everything known): Prepare → Create with zero questions → preview.
  - Case B override with the promote action.
  - Unit mismatch row.
  - Tear-off/disposal work-decision questions.
  - Desktop + 390.
- **Test scope:**
  - Offered-scope collector tests (replacing all-graph collection).
  - Price-write tests: case A writes the catalog only with the explicit choice; case B never writes the catalog unless promoted.
  - Unit-match tests (no implicit conversion).
  - Work-decision persistence on the proposal, not the measurement.
  - Label formatter tests.
  - Snapshot immutability tests unchanged and passing.
- **Risk boundary:**
  - Must not weaken deterministic pricing or snapshot immutability.
  - Must not let an unpriced offered item reach the customer.
  - Must not change draft lifecycle rules (that's 4B).
  - Case B needs a proposal-scoped price that doesn't touch the catalog; verify the existing snapshot line price supports it before adding anything. No new pricing store.
  - Non-admin proposal author capability must be verified (Astra §10) before claiming the flow works for all roles.
- **Commit point:** after tests and independent GPT visual review. Consider separate commits for offered-scope pricing and price-entry semantics.

### Slice 4B — "I can park an unfinished proposal without risking the customer seeing it" (incomplete-draft lifecycle/domain)
- **Prerequisite:** Slice 4A committed, and Decision 2 adopts incomplete drafts. **Never combined with 4A in one implementation commit.**
- **Contractor outcome:** a contractor can save a proposal that still needs prices, come back and finish it. Nothing incomplete can reach the customer through any path.
- **Model preserved:** deterministic pricing, frozen snapshots, preview-first, existing lifecycle stages. **Locked boundary:** INCOMPLETE CONTRACTOR DRAFT: MAY EXIST. CUSTOMER-DELIVERABLE PROPOSAL: MUST BE COMPLETE AND TRUSTWORTHY.
- **Domain/lifecycle changes:**
  - **Persistence semantics:** a draft may persist with unpriced offered lines stored as unknown (not 0).
  - **Explicit completeness state:** computed from the proposal's own data (all offered lines priced, units matched, tax and payment terms set, customer contact present). A single source used by every gate.
  - **Internal preview:** clearly marked as incomplete ("Not ready to send: N prices needed"); lines show "Price needed" and totals "Total pending".
  - **Server-side gates on every customer-facing or authority-bearing path:**
    - Send (email/SMS);
    - public/customer proposal access (`/p/[token]`, share links);
    - customer-facing PDF/export/download;
    - acceptance;
    - signing;
    - payment-request creation tied to the proposal;
    - any other external delivery or action surface found in the 4B audit.
  - **Replay / stale / version behavior:** a link or PDF produced earlier must not expose a later incomplete edit. Edits after a send follow existing version/snapshot rules.
  - Job Card next-step: "Finish proposal" for an incomplete draft.
- **Decision prerequisites:** Decision 2 (adopt; option b or c).
- **Visual proof:** incomplete draft in the builder and internal preview ("Price needed", "Total pending", not-ready banner); every gated external action showing a truthful blocked state; desktop + 390.
- **Test scope:**
  - Lifecycle tests for create, edit, complete and send.
  - Server gate tests for each external path (send, public access, PDF, acceptance, signing, payment request) refusing incomplete proposals.
  - Unknown-not-zero tests on totals, list rows and any aggregates.
  - Replay/stale tests for previously issued links and PDFs.
- **Risk boundary:** this is the domain/lifecycle change. It needs its own audit of every external surface before implementation. No UI-only shortcut, such as hiding a button, counts as a gate. Any schema change follows staging-only, guarded migration rules.
- **Commit point:** after the external-surface audit, tests, live staging gate matrix and independent GPT visual review.

### Slice 5 — "My standard setup makes sense when I look at it" (Template / Catalog / Pricing presentation)
- **Contractor outcome:**
  - Templates show what customers get and which template is the default.
  - Catalog scan view is mode-aware with a unit badge.
  - Pricing rules shows how I actually price.
- **Model preserved:** template structure, Advanced, catalog data, policy model.
- **UI/flow changes:**
  - Templates: Default badge, per-package counts, grouped edit actions, document preview (reuse the existing component).
  - Catalog: column defaults by pricing mode, Deactivate moved to overflow, "Check unit" badge, optional family grouping.
  - Pricing rules: "How you price" choice with dependent fields.
- **Decision prerequisites:** Decision 9.
- **Visual proof:** each page desktop + 390.
- **Test scope:** component tests; template default resolution test if Decision 9 changes behavior.
- **Risk boundary:** no change to how templates or catalog compute proposals.
- **Commit point:** after tests and independent GPT visual review.

### Slice 6 — "On my phone the field work is up front" (mobile)
- **Contractor outcome:** Photos, measurement and proposal are reachable in one tap from the Job on a phone.
- **Model preserved:** routes and tabs (only order and grouping change).
- **UI/flow changes:** mobile tab set per Decision 8; sticky primary actions in forms; Prepare as a full-screen sheet (if not already done in Slice 4A).
- **Decision prerequisites:** Decision 8.
- **Visual proof:** every Job tab at 390 with scrollWidth ≤ 390; the full journey on mobile.
- **Test scope:** tab configuration tests; no desktop regression.
- **Risk boundary:** desktop unchanged.
- **Commit point:** after tests and independent GPT visual review.

### Slice 7 — "I can see where the Job is" (progress / status)
- **Contractor outcome:** a compact stage indicator plus a separate disposition badge. Sub-status sits in the next-step card.
- **Model preserved:** lifecycle stages and disposition rules (D1–D3, D5, D6).
- **UI/flow changes:**
  - Every viewport shows the current canonical stage, the contextual status when important, and the next action.
  - The treatment is chosen from the candidates in §15 through design and visual proof. No literal "Step X of Y" is locked.
  - Disposition badges kept separate from forward progress.
  - Remove the pill-as-button look.
- **Decision prerequisites:** Decision 10 (treatment and labels).
- **Visual proof:** each stage plus On Hold, Lost and Closed, desktop + 390. On mobile, compare at least two candidate treatments before one is accepted.
- **Test scope:** stage-to-label mapping tests (1:1 with existing stages).
- **Risk boundary:** no new state.
- **Commit point:** after tests and independent GPT visual review.

### Slice 8 — "The whole flow feels like one product" (end-to-end cohesion proof)
- **Contractor outcome:** a new contractor completes lead → Job → photos → measurement → proposal → preview on desktop and mobile without leaving the path or reading explanations.
- **Model preserved:** all.
- **UI/flow changes:** only cohesion fixes found during the run (Fix-When-Found within scope).
- **Decision prerequisites:** all of the above resolved.
- **Visual proof:** full screenshot set (ZIP if >20); independent GPT visual review; cross-surface coherence gate (audit playbook).
- **Test scope:** the full suite (known pre-existing failures tracked); lint; typecheck.
- **Risk boundary:** no new features.
- **Commit point:** a Core Flow 1 checkpoint; handoff update.

---

## 21. What must not change

- **Identities:** Customer, Property and Job stay separate. No name/email auto-merge. A new Job never inherits old commercial or operational state.
- **Job Card is the home of the Job.** Domain tabs own their truth; Overview summarizes and points.
- **Photos are Job-scoped** with provenance. No silent gallery mixing across jobs. No new photo subsystem.
- **Measurements:** current plus earlier with a selected pointer. A ready edit creates a new record. Proposals freeze the quantities they used.
- **Starter auto-install** and **inline first-time pricing questions.** No forced detour to Templates, Catalog or Pricing rules.
- **Deterministic pricing:** prices come only from catalog/policy or explicit contractor entry. AI never invents prices. Unknown prices render as unknown, never $0.
- **Frozen truth:** sent proposals never change; drafts keep their snapshot until the contractor chooses to update.
- **Preview-first creation** and **builder ↔ Job return context.**
- **Builder and customer preview quality** (estimate table, page structure).
- **Catalog price-book table** and **template Advanced separation.**
- **Lifecycle and disposition rules** D1–D3, D5, D6. The accepted Lost copy. No new state machine.
- **Team/Crew parked (D9).** Do not restore Team to expose invitations.
- **Error and state truth:** ERROR ≠ EMPTY; UNKNOWN ≠ ZERO; FAILED ≠ SUCCESS.
- **Catalog is the price-book foundation;** **Pricing Rules is setup in the background,** not a normal quoting destination.
- **Model vs flow vs UI separation.** GOOD ARCHITECTURE DOES NOT EXCUSE WEAK PRESENTATION: preserve the model, change the flow/UI where the contractor experience is weak.
- **Customer-deliverable proposals are always complete and trustworthy,** whatever is decided about internal drafts.
- **Standard prices never change silently;** overriding a standard price for one Job never overwrites the company standard unless explicitly promoted.
- **Measurements hold site facts;** proposal work decisions never masquerade as measurement facts; unknown never becomes zero.
- **Independent GPT visual review is mandatory** for every visible implementation slice.

---

## 22. Visual proof requirements

Per `docs/fielddive-ui-product-cohesion-standard.md`. Required for every implemented slice:

1. **Real viewports:**
   - desktop `innerWidth ≥ 1200` (capture at 1440);
   - mobile `innerWidth === 390` with `document.documentElement.scrollWidth ≤ 390` asserted on every captured mobile page.
2. **States, not just happy paths:** for each touched surface, capture loading, empty, loaded, failed (with Retry) and any decision-driven state, e.g. an incomplete draft showing "Price needed" and "Total pending".
3. **Journey captures:** the Overview at each early stage (intake, measured, draft); the mobile path from Job to customer preview without More (after Slices 2 and 6).
4. **Copy inspection:** each screenshot is reviewed for copy as well as layout (plain-language standard; no "FieldDive will…", no seed keys, no third person in the customer document).
5. **Storage:** `tmp/fielddive-ui-review/core-flow-1-<slice>/` with an `INDEX.txt`. ZIP the folder when there are more than 20 images.
6. **Independent GPT visual review is mandatory for every visible implementation slice** before acceptance. Cursor self-review is not approval. Cursor's screenshot inspection (including the one done for this contract) is supporting evidence only. The pre-implementation independent GPT review of the Core Flow 1 screenshots happened in the ChatGPT conversation and is not a repo artifact. Recommendation (not a lock): save future independent reviews next to the slice's screenshots, so the acceptance record is durable.
7. **Environment:** staging only (`tjtrhdckinjtorgbkirm`), fixture company. Never the user's real account. The user owns `npm run dev`, port 3000 and `.next`. Photo proof requires the staging attachments bucket to exist first.
8. **No staging breakage to fake failures.** Failure states are proven in component/unit tests or through harness fault injection, not by damaging staging data.

---

## 23. Final repo status

This contract was produced, and then revised twice as documentation-only passes:
- revision 1: review-agreed changes;
- revision 2 (2026-10-04): the measurement application lock, the superseded Decision 5 lean, and the Slice 1 status/visual debt.

The Slice 1 implementation itself is a separate uncommitted code change, recorded in the global handoff.

- **This file:** `docs/fielddive-core-flow-1-target-contract.md`, committed with the 2026-10-04 governance docs checkpoint.
- **Other untracked Core Flow 1 working documents (not committed):**
  - `docs/fielddive-core-flow-1-diagnostic.md`
  - `docs/fielddive-core-flow-1-astra-diagnostic.md`
  - `docs/fielddive-core-flow-1-proven-market-research-cursor.md`
  - `docs/fielddive-core-flow-1-proven-market-research-astra.md`
- **Audit documents remain uncommitted and unedited:**
  - `fielddive-full-site-contractor-flow-audit.md`
  - `fielddive-whole-app-contractor-reality-astra-audit.md`
  - `fielddive-whole-app-contractor-reality-audit.md`
- **Ignored or untouched:** `tmp/` and `.next` are not staged.
- App code, tests, migrations, SQL, staging data and production: **unchanged**. No commit. No push.
