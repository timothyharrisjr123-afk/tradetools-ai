# FieldDive Estimate / Proposal Flow Model

**Purpose:** Lock the proven competitor-based estimate and proposal flow so future builds do not drift back into the old calculator layout or old estimator UI patterns.

**Stable checkpoints referenced:**
- `97ac692` — Refine Job Packet page layout
- Competitive research: Roofr, Jobber, AccuLynx, JobNimbus, QuoteIQ (May 2026)

**Related docs:**
- `docs/fielddive-flow-map.md`
- `docs/fielddive-feature-placement-map.md`
- `docs/competitive-architecture-audit.md`

---

## 1. Locked product decision

FieldDive is a **roofing-first AI operating system for contractors**. It wins by reducing the amount of work a contractor has to do between a customer call and a signed proposal — not by adding steps, not by requiring more data entry than the job demands.

Every screen must answer one question: **does this reduce contractor work on this specific job?**

### Core principle

Roofing contractors run on speed and trust. A proposal that takes 8 minutes to build and 30 seconds for the homeowner to sign beats a proposal that is technically richer but takes 40 minutes to assemble. FieldDive must compete on:

1. **Speed to proposal** — fewer taps from job packet to sent proposal
2. **Pricing confidence** — contractor sets their rates once; the system applies them correctly every time
3. **Homeowner experience** — proposal that looks professional and is easy to sign from a phone
4. **Production certainty** — after signing, nothing falls through the cracks

### What this principle rules out

- Screens that exist to display data the contractor already knows
- Pricing inputs scattered across multiple pages
- Send logic buried inside an estimate builder
- Standalone "Sent" or "Approved" pages (status is a filter, not a destination)
- AI features that act without contractor confirmation
- Rebuilding competitor parity feature-by-feature without a structural flow first

### The old FieldDive estimator

The existing `RoofingClient.tsx` workspace is **temporary working machinery**. Its pricing `useMemo`, `saveEstimate`, `handleSendEstimate`, PDF generation, approval token, and email APIs are real and correct. They must be preserved behind the scenes.

Its **dark glassmorphism UI, "AI Office" sidebar, "Deal Control" section name, "Delivery" bar with five peer buttons, and monolithic scope-to-send single page are not the target UX.** They were built before the flow was modular. Do not use them as design references. Use Roofr, Jobber, and AccuLynx instead.

---

## 2. Master flow

```
Inbound call / lead
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  1. JOB PACKET                                        │
│  Customer record + property + request + notes         │
│  Evidence checklist: customer ✓, address ✓, photos    │
└───────────────────────────┬───────────────────────────┘
                            │
        ┌───────────────────┴─────────────────────┐
        ▼                                         ▼
┌──────────────────────┐              ┌──────────────────────┐
│  2a. MANUAL PATH     │              │  2b. INSTANT PATH    │
│  Contractor enters   │              │  Smart Engine reads  │
│  scope / site info   │              │  photos + address    │
└──────────┬───────────┘              └──────────┬───────────┘
           └──────────────┬───────────────────────┘
                          ▼
┌───────────────────────────────────────────────────────┐
│  3. ESTIMATE BUILDER                                  │
│  Scope → line items → materials → labor → margin      │
│  Right-side totals panel (live)                       │
│  Contractor confirms every number                     │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│  4. PROPOSAL REVIEW                                   │
│  Locked estimate summary + customer-facing wording    │
│  PDF preview + recipient email + send panel           │
│  Contractor explicitly clicks Send                    │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│  5. SEND / SIGN / APPROVE                             │
│  Email or SMS → customer opens approval link          │
│  Customer reviews, optionally selects tier, signs     │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│  6. PROPOSAL TRACKING                                 │
│  Sent → Viewed → Approved / Denied / Changes Requested│
│  Timestamped activity feed; follow-up actions         │
└───────────────────────────┬───────────────────────────┘
                            │  (on Approved)
                            ▼
┌───────────────────────────────────────────────────────┐
│  7. JOB PRODUCTION                                    │
│  Deposit → Scheduled → On site → Completed            │
│  Crew assignment, labor tickets, production stages    │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────┐
│  8. PAYMENTS / MATERIALS                              │
│  Deposit collected, balance invoiced                  │
│  Material order → supplier; final invoice             │
└───────────────────────────────────────────────────────┘
```

**Critical gate rule (from Roofr, Jobber, AccuLynx):**
No customer-facing action (send, approval link, signature request) happens until the contractor has explicitly passed through Proposal Review and clicked Send. The Estimate Builder is a contractor-only internal tool. The Send button does not live in the Estimate Builder.

---

## 3. Stage definitions

### Stage 1 — Job Packet

**Purpose:** Collect the facts. This is the job record, the intake packet, and the evidence file. It is the context that all subsequent stages read from.

**Belongs here:**
- Customer: name, email, phone
- Property: address, city, state, ZIP
- Job type and scope request (homeowner description)
- Field notes, site observations
- Photos / evidence attach (stub for now; Smart Engine input when built)
- Property preview (map / satellite)
- Intake readiness checklist (customer ✓, address ✓, photos optional, notes optional)
- Smart Engine status: "Ready for Instant Estimate" or "Continue manually"

**Does NOT belong here:**
- Pricing inputs (area, waste, bundle cost, labor, margin)
- Deal Control / margin mode
- Proposal wording
- Send button
- Scheduling, deposit, payment
- Pipeline stage controls

**Primary CTA:** "Continue to Estimate Builder →" (enabled when customer + address are ready). Also: "Save Packet" (save without navigating away).

**Secondary actions:** "Instant Estimate" (Smart Engine path, requires photos + address — future P1).

**Future tools needed:** Photo storage / CDN, property geocoding, Smart Engine photo analysis, customer search/select from Customers module.

---

### Stage 2 — Measurement / Evidence

**Purpose:** Provide authoritative roof data that feeds the Estimate Builder. In v1 this is manual entry inside Estimate Builder. In future versions this is a populated report (aerial measurement, Smart Engine output, or Instant Estimate draft).

**Belongs here:**
- Roof area (sq ft / squares)
- Pitch classification
- Stories / complexity
- Photo-derived measurements (future: Hover, EagleView, Smart Engine)
- Confidence score per field (when Smart Engine provides data)
- "Apply measurement to estimate" action

**Does NOT belong here:**
- Pricing outputs
- Proposal wording
- Customer communication

**Primary CTA:** "Apply to Estimate Builder" (populates scope section).

**Future tools needed:** Aerial measurement integrations (EagleView, Hover, RoofSnap), Smart Engine Vision layer, confidence scoring per field.

---

### Stage 3 — Estimate Builder

**Purpose:** Build the contractor-side pricing document. Every number the contractor commits to lives here. Nothing in this stage is visible to the customer until explicitly sent from Proposal Review.

**Belongs here:**
- **Job header (light, not dark):** Customer name, address, estimate number, status badge (Draft)
- **Scope section (collapsible at top):** Roof size, material tier (Core / Enhanced / Premium), waste factor, tear-off toggle, included scope summary — these feed the pricing engine
- **Line items (primary canvas):** Name, Qty, Unit Cost, Unit Price, Subtotal. Initially: scope-derived implicit lines (materials, labor, disposal). Future: explicit line items from roofing catalog / Price Book.
- **Right-side sticky totals panel:** Job Cost, Customer Price, Profit, Gross Margin %. Margin control (slider or preset buttons). Refreshes live.
- **Good / Better / Best tabs** (future P2): Multiple estimate options on one estimate. Contractor and customer select a tier.
- **Estimate QA strip** (non-blocking): Quiet checks from `aiReview.ts` — "Heads-up" and "FYI" items. Never blocks sending.
- Scope readiness: customer email ✓, roof size ✓, price ✓ — pre-flight before allowing "Review Proposal →."

**Does NOT belong here:**
- Proposal wording / package description / schedule CTA (those are Proposal Review)
- PDF preview of the customer-facing proposal (Proposal Review)
- Send button (Proposal Review)
- Approval token
- Scheduling, deposit, payment
- Sent/viewed/approved status tracking

**Primary CTA:** "Review Proposal →" — navigates to Proposal Review. Disabled until customer email + roof size + price are all present.

**Secondary actions:** Save Draft, Preview draft PDF (internal, not the customer-facing proposal), Back to Job Packet, Reset.

**Future tools needed:** Roofing catalog / Price Book line items, supplier pricing integration, per-line-item waste factor, Good/Better/Best tabs, Smart Engine output as draft line items.

---

### Stage 4 — Proposal Review

**Purpose:** The contractor's final review and customization of exactly what the homeowner will see before anything is sent. This is a read-only view of the estimate plus editable customer-facing content.

**Belongs here:**
- **Locked estimate summary (read-only):** Customer Price, Job Cost, Profit, Margin, scope summary, tier, included items. "← Back to Estimate Builder" if numbers need to change.
- **Customer details confirmation:** Recipient email, customer name, job address — editable only if a correction is needed for send.
- **Proposal wording (editable):** Package description (what the homeowner gets, in plain language), schedule CTA (next steps message). AI-generated draft; contractor edits.
- **PDF / Proposal preview:** "Preview as Customer" opens the branded PDF. This is what the homeowner sees.
- **Approval link preview:** The `/approve/[token]` URL. Contractor can copy for in-person presentation or SMS.
- **Terms placeholder** (v1: "Proposal valid 30 days").
- **Send panel (right column):** Recipient email, optional note, single send button.

**Does NOT belong here:**
- Pricing inputs or scope editing (back to Estimate Builder for that)
- Margin sliders
- Scheduling, deposit, payment
- Sent/viewed/approved status history (that is Proposal Tracking, after send)
- Activity feed

**Primary CTA:** "Send Proposal to {customer email}" — single, prominent button. One action. Disabled until wording and email are present.

**Secondary actions:** "Preview as Customer" (PDF), "Download PDF", "Copy approval link", "← Back to Estimate Builder."

**Future tools needed:** Proposal template engine (cover page, text pages, photos, optional PDF attachments), co-signer support, Good/Better/Best tier selection for customer, financing option toggle, terms/contract field.

---

### Stage 5 — Send / Sign / Approve

**Purpose:** The customer-facing side of proposal delivery. This is not a contractor screen — it is what the homeowner sees when they open the approval link.

**Belongs here (customer-facing page `/approve/[token]`):**
- Branded proposal view
- Scope summary and price
- Tier selection (if Good/Better/Best sent)
- E-signature capture
- Deposit payment option (future: simultaneous with approval)
- Confirmation email to customer after signing

**Contractor-facing:** The send action in Proposal Review triggers this. After send, the contractor moves to Proposal Tracking.

**Future tools needed:** E-signature library, deposit payment at signature, mobile-first approval view.

---

### Stage 6 — Proposal Tracking

**Purpose:** After send — know where the proposal stands and act on it. This is Roofr's job card → Proposals tab + Jobber's quote status pipeline model.

**Belongs here:**
- **Status pipeline:** Draft → Sent → Viewed → Approved / Denied / Changes Requested
- **Timestamped activity feed (Roofr model):** "Sent May 27 10:34 AM," "Viewed May 27 3:12 PM," "Approved May 28 9:01 AM"
- **Context-sensitive actions by status:**
  - Sent (unviewed): Send reminder, Resend, Copy link
  - Viewed (awaiting): Follow up now, Resend, Copy link
  - Approved: "Activate as Job →" (moves to Job Production)
  - Denied: Duplicate to Revise, Archive, Mark denied
  - Changes Requested: Open Estimate Builder to revise
- Customer contact display
- Proposal summary (locked price, tier)

**Does NOT belong here:**
- Proposal wording editing (back to Proposal Review for a revision)
- Pricing inputs
- Scheduling modals
- Payment collection (those are Job Production / Payments)

**Where it lives:** Inside the Estimates / Proposals module (future `/tools/estimates/[id]`). For now: enhanced `SavedEstimateCard` when `statusFilter` is `sent_pending`, `viewed`, or `approved` in `SavedClient`. Standalone Sent page is never built — Sent is always a filter.

**Primary CTA by status:** Reminder (Sent/Viewed) → "Activate as Job →" (Approved).

**Future tools needed:** Real-time webhook on customer open event, automated follow-up sequence, SMS follow-up, proposal expiry logic.

---

### Stage 7 — Job Production

**Purpose:** After approval, execute the job. Deposit, scheduling, crew, on-site, completion.

**Belongs here:**
- Job stage progression: Approved → Deposit Paid → Scheduled → On Site → Completed
- Deposit collection action
- Scheduling modal (date, arrival window, crew)
- Labor ticket / crew assignment
- On-site check-in / completion mark
- Material delivery coordination (future)

**Does NOT belong here:**
- Estimate editing
- Proposal wording
- Sent/viewed/approved tracking

**Primary CTA:** "Collect Deposit" → "Schedule Job" → "Mark On Site" → "Mark Complete."

**Future tools needed:** Calendar integration, crew assignment, labor tickets (AccuLynx model), GPS check-in, production photo attach.

---

### Stage 8 — Payments / Materials

**Purpose:** Billing and material ordering after job activation.

**Belongs here:**
- Deposit record, balance due
- Final invoice generation (from approved estimate line items)
- Offline payment recording
- Online payment link
- Material order generation (from estimate line items — AccuLynx model)
- Supplier handoff (ABC Supply, SRS Distribution — future)

**Does NOT belong here:**
- Scheduling (Job Production)
- Proposal tracking
- Estimate editing

**Future tools needed:** Invoice-from-estimate conversion, supplier API integrations, material order PDF, payment processor, financing (AccuFi pattern).

---

## 4. Competitor mapping

The following maps each stage to which competitor is the primary structural model.

| FieldDive Stage | Primary model | Notes |
|---|---|---|
| **Job Packet** | **Roofr** | Job card as the central hub for everything. All stages attach to the job record. Never leave the job card concept. |
| **Measurement / Evidence** | **AccuLynx + Roofr** | AccuLynx: aerial measurement integrations auto-populate estimate. Roofr: native measurement-to-proposal workflow. QuoteIQ: MapMeasure Pro satellite + AI photo analysis. |
| **Estimate Builder** | **Jobber (layout) + AccuLynx (depth)** | Jobber: clean light-mode line-item table, right-side totals panel with margin view, products/services catalog. AccuLynx: profit margin slider, per-item waste factor, live supplier pricing (future). |
| **Proposal Review** | **Roofr (editor) + Jobber (concept)** | Roofr: multi-page proposal editor — cover page, estimate section, optional photos/PDFs, "Preview and Send" button. Jobber: "Preview as Client" — read-only view of exactly what the customer sees, before send. |
| **Send / Sign / Approve** | **Roofr + JobNimbus** | Roofr: email link to branded proposal; customer signs on phone; timestamp tracked; co-signer support. JobNimbus: "Review and Share" → PDF preview → send; signed proposal auto-updates estimate to "approved." |
| **Proposal Tracking** | **Jobber (statuses) + Roofr (activity feed)** | Jobber: 6 clear statuses (Draft → Awaiting Response → Changes Requested → Approved → Converted → Archived); Activity Feed bell with real-time notifications; filter-by-status list. Roofr: timestamped activity in job card → Proposals tab; Proposals Dashboard sorts by Draft/Sent/Won/Lost. |
| **Job Production** | **AccuLynx + JobNimbus** | AccuLynx: Scheduler ties labor and materials together; labor tickets for crew. JobNimbus: Kanban-style pipeline; stage progression triggers automations. |
| **Payments / Materials** | **AccuLynx** | Material order auto-generates from approved estimate line items. Supplier API sends order directly. Financial Worksheet tracks actuals vs estimated. |

### Competitor detail: what each app does best

**Roofr:**
- Job card-centric workflow — the entire lifecycle lives on one job card without leaving it
- Measurement-to-proposal in one session (order measurement → auto-populate → proposal → send)
- Proposal editor is multi-page: cover page + estimate section + photos/PDFs + text pages
- Estimate section in proposal editor shows materials, subtotals, upgrades, tax/total breakdown; right side drawer for profitability type, waste %, show/hide line items, financing
- Draft → Sent → Won/Lost with timestamp for each event
- Proposals Dashboard: sort by Draft/Sent/Won/Lost across all jobs
- "An instant email saying Mrs. Jones is looking at that quote" — real-time view notification
- After signed: converts to work order + material order + invoice in one action

**Jobber:**
- Clearest status pipeline of any competitor: Draft → Awaiting Response → Changes Requested → Approved → Converted → Archived
- "Preview as Client" before send = the Proposal Review concept at its clearest
- Activity Feed (bell icon, top right): fires for quote viewed (first time), changes requested, approved
- Client Communications Report: "Opened date" column — exact timestamp of first open
- Quote list filterable by any status
- On approved quote in app: "Schedule Job" button appears immediately
- Deposit payable at moment of approval (Approve and Pay Deposit)
- Optional line items for upsells — customer self-selects in Client Hub; total adjusts live
- Margin view available inside the quote builder

**AccuLynx:**
- Most roofing-specific estimate engine in the category (purpose-built 2009)
- Aerial measurement auto-populates line items; quantities calculated from measurement data
- Live supplier pricing: ABC Supply, SRS Distribution, QXO — account pricing pulled directly
- Per-item waste factor (not just a global waste %)
- Profit margin slider: move it, all prices update automatically — no manual math
- Insurance workflow: ACV/RCV, supplements, mortgage-payable claims (later)
- Smart(er) Docs: separate proposal tool — drag-and-drop, custom cover, photos, estimate, terms
- After approval: material order generates from estimate and goes to supplier directly
- Scheduler: crew and material delivery on the same view; labor tickets with site checklist

**QuoteIQ:**
- Four estimate types: Standard (line items), Quick (single-entry), Options (Good/Better/Best), Package (bundled)
- AI Estimator: photo upload → scope analysis → line items populated → contractor edits → send
- Step-by-step builder: Customer → Type → Services → Terms → Photo → Preview (clearest for onboarding)
- Hide/show individual line item prices per estimate
- ClientHub: customer portal — sign, pay deposit, view history
- Job Costing: tracks actual labor hours (EmployeeHub time clock) + materials + subcontractors vs estimate in real time
- AI Autopilot: "follow up with all open proposals from the last two weeks" — executes automatically

---

## 5. Required tool capability map

The following lists the tools FieldDive must eventually have, organized by build priority. Build priority references `docs/fielddive-feature-placement-map.md`.

| Tool | Stage it serves | Competitor reference | FieldDive status |
|---|---|---|---|
| **Measurement / takeoff** | Stage 2 | AccuLynx (EagleView/Hover auto-populate), Roofr (native reports), QuoteIQ (MapMeasure Pro) | Not built; manual roof area entry in Scope Builder today |
| **Photos & evidence** | Stage 1, 2 | Roofr (attach to job card), QuoteIQ (QuoteIQ Cam, AI Estimator input) | UI stub only; no storage/API |
| **Roof report import** | Stage 2, 3 | AccuLynx (measurement → estimate auto-fill), Roofr (report → proposal) | Not built |
| **Smart Engine / Instant Estimate** | Stage 2, 3 | QuoteIQ (AI Estimator: photo → scope → line items), Roofr (Instant Estimator: address → draft price) | Not built; placeholder in nav |
| **Roofing catalog / Price Book** | Stage 3 | Jobber (Products & Services catalog), AccuLynx (material catalog), QuoteIQ (service rate card) | Admin CRUD exists at `/admin/price-book`; **not wired into estimator** (locked rule) |
| **Supplier pricing** | Stage 3 | AccuLynx (ABC Supply, SRS, QXO live pricing) | Not built; company settings are the pricing source today |
| **Good / Better / Best options** | Stage 3, 4 | Roofr (estimate tabs), JobNimbus (3 estimate tabs), AccuLynx (multiple estimate options), QuoteIQ (Options Estimate) | Not built; single estimate only today |
| **Proposal templates** | Stage 4 | Roofr (cover page + estimate + photos + text pages + PDFs), AccuLynx (Smart(er) Docs drag-and-drop), JobNimbus (layout templates) | Not built; company voice profile and AI wording only |
| **Approval / signature** | Stage 5 | Roofr (e-sign link), Jobber (Client Hub sign), AccuLynx (Smart(er) Docs e-sign), JobNimbus (digital signature) | Exists: `/approve/[token]` route, `attachApprovalTokenAndMarkPending` |
| **Proposal tracking** | Stage 6 | Roofr (job card → Proposals tab + timestamp activity), Jobber (6 statuses + Activity Feed + Opened date) | Partial: `statusFilter` chips in SavedClient; no timestamp activity feed or dedicated detail view |
| **Material ordering** | Stage 8 | AccuLynx (order auto-generates from estimate → supplier API) | Not built |
| **Payments** | Stage 7, 8 | Jobber (Approve and Pay Deposit in Client Hub), AccuLynx (deposit + balance + invoice) | Exists: payment modals in SavedClient, `/api/payments/*` |

---

## 6. Old FieldDive app role

### What to keep behind the scenes (backend / logic only)

The following are working, real, and must be preserved. They are implementation assets, not UX models.

| Asset | File(s) | Role |
|---|---|---|
| **Pricing math** | `RoofingClient.tsx` `useMemo` (~1162–1287): `materialsCost`, `laborCostEffective`, `subtotal`, `finalPrice` | The calculation engine that powers the right-side totals panel in Estimate Builder. Do not touch. |
| **Save logic** | `saveEstimate` / `saveToEstimateStore` in `RoofingClient.tsx`; `app/lib/estimateStore.ts` | Called by "Save Draft" CTA in Estimate Builder. Do not move or rewrite until entity model is split. |
| **PDF generation** | `handlePreviewPdf`, `onDownloadPdf`, `pdf-lib` in `RoofingClient.tsx` | Called by "Preview as Customer" in Proposal Review. |
| **Email send** | `handleSendEstimate`, `sendEstimateEmailWithPdf` in `RoofingClient.tsx`; `/api/estimate/send`, `/api/email/send`, `/api/proposal/generate` | Called by "Send Proposal" button in Proposal Review. |
| **Approval token** | `attachApprovalTokenAndMarkPending`, `/approve/[token]` route | The customer-facing approval backbone. Works today. Do not change. |
| **Status tracking** | `markSavedEstimateSent`, `markSavedEstimateApproved`, `markEstimateViewedByToken`, `markSavedEstimateStatus` in `estimateStore.ts` | Powers the status pipeline in Proposal Tracking. |
| **Payment / scheduling logic** | Payment modals, `addPaymentToEstimate`, `markSavedEstimateScheduled` in `SavedClient.tsx`; `/api/payments/*` | Powers Job Production / Payments stages. Frozen until module split. |
| **AI wording** | `packageDescription`, `scheduleCta` state; `app/lib/aiWordingPrefs.ts`; `app/lib/companyVoiceProfile.ts`; AI wording APIs | Powers proposal wording in Proposal Review. Currently inside Estimate Builder — must move to Proposal Review step. |
| **Estimate review / QA** | `app/tools/roofing/aiReview.ts`, `getAIReview` | Powers Estimate QA strip in Estimate Builder. Keep; can expand rules. |

### What the old UI should NOT be used as a model

The following UI patterns in `RoofingClient.tsx` reflect the old calculator-first design, not the target roofing OS flow. **Do not replicate them in new screens.**

| Old UI pattern | Why it is wrong | Correct pattern (competitor reference) |
|---|---|---|
| Dark glassmorphism estimate workspace | No competitor uses dark mode for estimate building. Dark = dashboards and AI surfaces only. | Light-mode line-item canvas (Jobber, AccuLynx, Roofr) |
| "AI Office / Active Tasks" pane as a permanent sidebar | AI is contextual and inline, not a permanent pane. | Jobber: Activity Feed (bell icon, triggered on events). Roofr: job card activity feed. |
| "Deal Control" section name | Not a contractor-recognizable term. | "Pricing" (Jobber), "Profit Margin" (AccuLynx) |
| "Proposal Readiness" with 7-item checklist inside Estimate Builder | Mixes estimate scope (tier, tear-off) with proposal content (proposal draft, payment options) | Scope inputs in Estimate Builder; proposal checklist in Proposal Review |
| "Delivery" bar with Preview, Download, Save, Send as peer buttons | Conflates save (internal), preview (internal), and send (customer-facing) as equal-weight actions | Separate stages: Save Draft (Estimate Builder) → Send Proposal (Proposal Review, one prominent button) |
| Send proposal button inside Estimate Builder | No competitor sends from the estimate builder. Send is Proposal Review. | Roofr: "Preview and Send" only after proposal is built. Jobber: send is a save action that moves to "Awaiting Response." AccuLynx: Smart(er) Docs handles send separately. |
| 5-step conductor timeline in the workspace header | Becomes UI noise once the stages are separate screens. | Per-screen progress indicator, not a global timeline overlay. |
| "Prepared Scope" visual tiles (pitch, stories) as UI-only prototypes | Tiles not driving pricing truth creates confusion about what is authoritative. | AccuLynx: every input is a real pricing input or it is not shown. Roofr: scope comes from the measurement report, not decorative tiles. |

---

## 7. Next build direction

### The single correct next step

**Build the Estimate Builder visual shell based on the proven Jobber/AccuLynx layout pattern.**

This is the correct next step because:
1. The Estimate Builder is the most-used screen and is most misaligned with competitor patterns
2. All pricing and save logic stays untouched underneath — new shell, same engine
3. No new routes required — this is an in-place structural improvement to `?entry=manual`
4. The Estimate Builder shell defines what Proposal Review is "reviewing" — Proposal Review cannot be built coherently until the Estimate Builder presents its content clearly
5. Every competitor builds the estimate UI before building the proposal review UI

### What the Estimate Builder shell should look like

Based on Jobber + AccuLynx structural patterns:

```
LIGHT BACKGROUND THROUGHOUT (not dark)

┌─ HEADER ─────────────────────────────────────────────────┐
│  Estimate Builder — [Customer Name]                      │
│  [Address] · Est #001 · [Draft]                          │
│  [← Back to Job Packet]                                  │
└──────────────────────────────────────────────────────────┘

LEFT / MAIN COLUMN                  RIGHT COLUMN (sticky)
──────────────────────              ─────────────────────
┌─ SCOPE (collapsible) ──┐         ┌─ TOTALS ───────────┐
│  Roof size: [___] sq ft │         │  Job Cost   $X,XXX │
│  Waste: 10% / 15% / 20% │         │  Price      $X,XXX │
│  Tier: Core/Enh/Premium │         │  Profit     $X,XXX │
│  Tear-off: [on/off]     │         │  Margin     XX.X%  │
│  Labor: Guided / Manual │         │                    │
└─────────────────────────┘         │  [Margin control]  │
                                    │  ─────────────────  │
┌─ LINE ITEMS ────────────┐         │  Pre-flight:        │
│  Name  Qty  Cost  Price │         │  ✓ Customer email  │
│  ───── ─── ───── ─────  │         │  ✓ Roof size       │
│  Materials       $X,XXX │         │  ✓ Price           │
│  Labor           $X,XXX │         │                    │
│  Disposal          $XXX │         │ [Review Proposal →]│
│  [+ Add line item]      │         │  primary CTA       │
└─────────────────────────┘         └────────────────────┘

┌─ ESTIMATE QA (if items) ┐
│  Heads-up: ...          │
│  FYI: ...               │
└─────────────────────────┘

BOTTOM: [Save Draft]  [Preview draft PDF]
```

### What the next step must NOT include

- Do not polish the dark workspace further (old UI, not the model)
- Do not build a standalone Sent page
- Do not wire Price Book into the current `RoofingClient` pricing `useMemo`
- Do not build Instant Estimate UI before Estimate Builder has the correct structure
- Do not add scheduling or payment controls to Proposal Review
- Do not rebuild the "AI Office" pane — AI guidance should be inline and contextual, not a sidebar

### Sequence after Estimate Builder shell

1. **Estimate Builder visual shell** (in place in `RoofingClient.tsx`, `?entry=manual`) — light theme, scope + line items + right-side totals, "Review Proposal →" CTA
2. **Proposal Review** — as a `step=review` branch in the same file first; locked totals + editable wording + send panel; the Send button calls the existing `handleSendEstimate`
3. **Estimates / Proposals list shell** — `/tools/estimates` with status filter tabs; reads from `estimateStore`; replaces the "Estimates" placeholder nav item
4. **Proposal Tracking detail** — enhanced card in Estimates list for sent/viewed/approved states with timestamp activity

---

*This document locks the FieldDive estimate/proposal flow based on proven competitor patterns. Application code is unchanged as part of this document. Reference for all estimate/proposal/tracking builds going forward.*
