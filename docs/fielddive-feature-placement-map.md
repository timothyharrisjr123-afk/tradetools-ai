# FieldDive Feature Placement Map

**Purpose:** Repo-level placement guide for FieldDive features across modules, the Smart Engine, and AI Autopilot. Use this alongside `docs/fielddive-flow-map.md` (step-by-step flow) and `docs/competitive-architecture-audit.md` (module IA and locked decisions).

**Stable commits referenced:**

- `ab1d4bc` — Add admin foundation and FieldDive flow map
- `b7ddbb9` — Refine dashboard shell and daily command surface
- `9fcd310` — Add competitive architecture audit
- `b232fed` — Align New Job with FieldDive app shell

**Related docs:**

- `docs/fielddive-flow-map.md`
- `docs/competitive-architecture-audit.md`

---

## Locked product decisions

- **FieldDive stays roofing-first.** Roofing is the wedge; module structure can borrow from QuoteIQ / Jobber / Roofr / JobNimbus / AccuLynx patterns.
- **FieldDive is an AI operating system for roofing contractors** — not a generic Jobber clone and not just a roofing calculator.
- **Modules organize the app.** Status labels (Draft, Sent, Scheduled, etc.) are filters inside modules, not standalone pages.
- **Smart Engine** powers roofing-specific intelligence (photos, address, property, company settings → draft roof estimate/proposal).
- **AI Autopilot / Conductor** operates across modules; it routes, drafts, and suggests — it does not silently act on behalf of the contractor without policy and confirmation.
- **New Job creates a Job Packet** (customer, property, job type, notes, photos, readiness).
- **Manual Estimate** and **Instant Estimate** are two distinct paths from the Job Packet.
- **Instant Estimate** uses photos/address/property/company settings to produce a **draft** with confidence scores.
- **Contractor confirmation is required** before customer-facing actions (send proposal, SMS, payment, schedule changes).
- **SMS / ETA / on-site / completed updates** belong later in **Jobs Pipeline / Calendar / Job Detail / Customer Communication** — not New Job v1.
- **Do not wire Price Book into the old estimator yet.** Price Book feeds future Estimate Items after layout exists.
- **Do not build standalone Sent pages.** Sent lives inside **Estimates / Proposals** as a filter.
- **Do not treat Smart Engine outputs as pricing truth** until contractor-confirmed and applied in the Estimates / Review step.

---

## 1. Product principle

### Roofing-first wedge, OS-shaped product

FieldDive wins by being the **best AI system for roofing contractors**, not by copying Jobber’s generic CRM or remaining a calculator forever.

The wedge is:

- **Roofing domain depth:** measure → scope → price → propose → approve → schedule → collect → produce.
- **Smart Engine:** photos + address + property + company parameters → **draft** roof intelligence (size, pitch, complexity, materials, confidence).
- **Contractor OS shell:** Dashboard, Jobs, Calendar, Estimates, Invoices, Customers, Price Book, Reports — familiar from industry tools, but **roofing-native** underneath.

**Positioning:** FieldDive is the **AI operating system for roofing contractors** — Jobber-shaped navigation, Roofr/QuoteIQ-shaped estimate flow, AccuLynx-shaped production and money — with **roofing Smart Engine** as the differentiator.

### How Modules, Smart Engine, and AI Autopilot work together

| Layer | Role | Must not |
|-------|------|----------|
| **Modules** | Own screens, data, and stage transitions (intake, estimate, job, money, calendar). | Become standalone status pages (Sent page, Scheduled page). |
| **Smart Engine** | Roofing-specific inference and draft outputs attached to a **Job Packet**. | Become pricing truth or auto-send without contractor review. |
| **AI Autopilot / Conductor** | Cross-module command: find work, draft comms, suggest next actions, route to the right module. | Silently change price, send proposals, charge cards, or SMS without policy/confirmation. |

---

## 2. End-to-end workflow map

```
Customer call
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ NEW JOB / INTAKE — Job Packet created                   │
│ customer, property, job type, notes, photos (optional)  │
│ readiness checklist; link/create Customer record        │
└───────────────────────────┬─────────────────────────────┘
                            │
              Property visit / climb / ground photos
              (photos attach to packet; Smart Engine input)
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
   MANUAL ESTIMATE PATH              INSTANT ESTIMATE PATH
   (contractor enters scope,         (Smart Engine analyzes
    items, labor, materials)          photos/address → draft
            │                         size/pitch/materials/confidence)
            └───────────────┬───────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ ESTIMATES / PROPOSALS — draft estimate + proposal       │
│ line items, pricing review, package, PDF/email preview  │
│ contractor CONFIRMS before send                         │
└───────────────────────────┬─────────────────────────────┘
                            ▼
                    Send proposal → Sent / Viewed
                            ▼
                    Customer approves (token flow)
                            ▼
┌─────────────────────────────────────────────────────────┐
│ JOBS PIPELINE — approved / deposit / production stages  │
│ handoff from estimate; material prep; on-site           │
└───────────────┬─────────────────────┬───────────────────┘
                ▼                     ▼
         CALENDAR (when)      CUSTOMER COMMS (SMS/email)
         scheduled crew       on way / ETA / on site / done
                │                     │
                └──────────┬──────────┘
                           ▼
              INVOICES / PAYMENTS — deposit, balance, checkout
                           ▼
              Production complete → Completed / Reports
```

### Current codebase mapping (approximate)

| Stage | Current home (transitional) |
|-------|----------------------------|
| Intake + manual estimate + send | `app/tools/roofing/RoofingClient.tsx` (monolith) |
| Saved list, status lanes, payments, schedule | `app/tools/roofing/saved/SavedClient.tsx` + `app/lib/estimateStore.ts` |
| Approval | `/approve/[token]` + batch status APIs |
| Customers / Price Book data | `/admin/customers`, `/admin/price-book` (data shelves) |
| App shell nav | `app/tools/roofing/FieldDiveAppShell.tsx` |

---

## 3. Feature-to-module table

| Feature | Primary module | Secondary surfaces | Smart Engine / AI role | Build priority | Notes / risks |
|---------|----------------|--------------------|-------------------------|----------------|---------------|
| Customer/property intake | **New Job / Intake** | Customers (pick existing), Dashboard | Suggest duplicate customer, missing fields | **P0** | Today: free-text; `findOrCreateCustomer` on save only |
| Job packet creation | **New Job / Intake** | Estimates, Dashboard | Packet readiness score | **P0** | No distinct packet entity yet — saved estimate doubles as packet |
| Photos upload | **New Job / Intake** (v1 attach) → **Job detail** (v2) | Estimates, Jobs Pipeline | Vision: size, pitch, damage, complexity | **P1** | UI stub only; no storage/API yet |
| Notes / customer message / voice | **New Job / Intake** | Customers CRM timeline | Transcribe + structure notes | **P1–P2** | Capture buttons stubbed in Job Capture |
| AI photo/property/roof analysis | **Smart Engine** (service) | New Job, Estimates | Core inference pipeline | **P1** | Not built; do not couple to pricing `useMemo` |
| Roof size estimation | **Smart Engine** → **Estimates** | New Job (preview only) | Draft squares + confidence | **P1** | Manual path uses Scope Builder today |
| Pitch/stories/complexity | **Smart Engine** → **Estimates** | Prepared Scope tiles (display) | Draft + confidence | **P1** | Prepared Scope is UI-only; must not drive pricing truth |
| Material recommendation | **Smart Engine** → **Estimates** | Price Book, Settings | Tier/product suggestion | **P2** | |
| Confidence scoring | **Smart Engine** | New Job checklist, Estimates review | Per-field + overall | **P1** | Partial via readiness strips today |
| Manual estimate path | **Estimates / Proposals** | New Job (CTA “Continue to estimate”) | Review hints only | **P0** (exists in monolith) | Lives in `RoofingClient` until split |
| Instant estimate path | **New Job** (trigger) → **Estimates** (review) | Smart Engine | One-click draft from photos/address | **P1** | New surface; requires confirm gate |
| Company pricing parameters | **Settings** | Estimates, Price Book | None (deterministic) | **P1** | Today: per-job fields + ZIP presets in estimator; Settings = identity |
| Price Book services/materials | **Price Book** | Estimates (line items) | Suggest line items | **P2** | Admin CRUD exists; **locked: no estimator wiring** |
| Local supplier pricing fallback | **Settings** + **Smart Engine** | Estimates (with warnings) | Freshness/confidence | **P3+** | Later-stage only (e.g. Lowe’s/Home Depot-type) |
| Estimate items | **Estimates / Proposals** | Price Book | Auto-populate draft lines | **P2** | No line-item model in UI yet |
| Quote/proposal generation | **Estimates / Proposals** | New Job (legacy) | Wording from voice profile | **P0** (exists) | `/api/proposal/generate`, PDF in monolith |
| Proposal send & approval | **Estimates / Proposals** | Customer email, `/approve/[token]` | Draft follow-up only | **P0** (exists) | Send still on New Job page today |
| Sent/viewed/approved statuses | **Estimates / Proposals** (filters) | Dashboard counts | — | **P1** (route shell) | **Not** standalone Sent page |
| Invoices/payments/deposits | **Invoices / Payments** | Jobs Pipeline cards, Dashboard | — | **P0** (exists in SavedClient) | Do not migrate casually |
| Scheduling/calendar/crew | **Calendar** + **Jobs Pipeline** | Dashboard | Suggest slots | **P1** | Schedule modals in SavedClient today |
| SMS/email: on way, ETA, on site, done | **Jobs Pipeline** / **Job detail** / **Customers** | Calendar | Draft message | **P2–P3** | Not in codebase |
| Jobs pipeline/production | **Jobs Pipeline** | Dashboard, Calendar | Stage suggestions | **P1** | Today: `statusFilter` lanes on saved |
| Material ordering/prep | **Jobs Pipeline** | Reports, Settings | Readiness checklist | **P3** | Not built |
| Customer CRM/history | **Customers** | Estimates, Jobs, Invoices | Summarize history | **P2** | Admin shelf only |
| Reports/revenue/profit/margin | **Reports** | Dashboard KPIs (summary only) | Insights narrative | **P2** | `RevenueSummary` on dashboard only |
| AI Autopilot / global command bar | **AI / Tools** (global) | All modules | Router + actions | **P2** | Fragmented today: AI Office sidebar, AI Library |
| AI follow-up drafting | **Estimates** + **Customers** | Dashboard | Draft only | **P2** | Partial email followup API |
| AI add services to job | **Estimates** | Price Book | Suggest lines | **P2** | |
| AI pull sent estimates | **Estimates** + Autopilot | Dashboard | Query assistant | **P2** | |
| AI create invoice/schedule | **Invoices** / **Calendar** | Autopilot | Proposed actions | **P3** | Requires confirmation |
| AI missing-info detection | **Smart Engine** + Autopilot | New Job, Estimates | Checklist | **P1** | Partial: readiness strips |
| AI Smart Opportunity Packet | **New Job** + **Dashboard** | Marketing intake (future) | Inbound triage | **P3+** | |
| Homeowner-submitted opportunities | **Dashboard** / **New Job** | Public form | Triage + instant draft | **P4** | Not built |

---

## 4. New Job / Intake definition

### New Job v1 (now → next 1–2 builds)

**Belongs on New Job:**

- Customer: name, email, phone (optional customer picker later)
- Property: address, city, state, ZIP
- Job type / request (e.g. full tear-off, repair, inspection quote)
- Notes / customer message (text; voice later)
- Photo attach UI (upload when backend exists; stub acceptable)
- Property preview (map/satellite placeholder)
- **Intake readiness checklist** (customer ✓, property ✓, photos optional, notes optional)
- Primary CTAs: **Save packet** / **Continue to estimate** (navigation only — does not price)

**Optional v1 (light scope starter, not full calculator):**

- Read-only or single-field **“reported roof size / stories / pitch if known”** for field notes — **not** wired to pricing truth until Estimates module owns it.

**If/when routes split:** collapse or hide Scope Builder, Deal Control, Live Outcome, and Send behind **“Open estimate workspace”** on New Job v1.

### New Job v2

- Customer search/select from **Customers** module
- Photo gallery with tags (ground, roof, damage, customer-provided)
- **Instant Estimate** entry point (Smart Engine → Estimates draft)
- Voice memo → notes
- Basic job type templates (residential re-roof, repair, commercial)

### Later (not New Job)

- Full scope builder, margin sliders, line items, PDF preview, send proposal
- Payment/deposit collection
- Scheduling and crew assignment
- Production SMS templates
- Sent/viewed/approved management (Estimates module)

### What must NOT appear on New Job (target state)

| Exclude | Why |
|---------|-----|
| Deal Control / margin modes | Estimates — Review & Price |
| Pricing engine outputs as truth | Estimates |
| Send proposal / approval tokens | Estimates |
| Deposit/checkout | Invoices / Payments |
| Schedule modals | Calendar / Jobs |
| Pipeline stage changes | Jobs Pipeline |
| Price Book line picker | Estimates + Price Book |
| Revenue/profit analytics | Reports |

---

## 5. Manual Estimate vs Instant Estimate

| Dimension | Manual Estimate | Instant Estimate |
|-----------|-----------------|------------------|
| **Trigger** | Contractor chooses “Build estimate” from packet | Contractor clicks “Instant Estimate” (photos + address minimum) |
| **Primary module** | **Estimates / Proposals** | **New Job** (launch) → **Estimates** (review) |
| **Inputs** | Scope, materials, labor, services, line items, company defaults | Photos, address, property context, company settings, optional notes |
| **Smart Engine** | Optional hints (review, missing info) | **Required** — draft scope, size, materials, confidence |
| **Pricing source priority** | 1) Company settings 2) Price Book 3) (later) supplier fallback with warnings | Same stack; pre-filled **draft** only |
| **Output** | Estimate draft contractor edits | Estimate + proposal **drafts** with confidence badges |
| **Contractor confirmation** | Review every line and total before send | **Must confirm** all Smart Engine fields; nothing customer-facing until review complete |

### Confirmation gates (both paths)

1. Review estimate items and totals
2. Review proposal wording (AI draft editable)
3. Explicit Send (no auto-send)
4. Optional: lock pricing snapshot on send

### Current code

- **Manual path:** entire `RoofingClient` Scope Builder + Deal Control + Delivery (transitional monolith).
- **Instant path:** does not exist yet.

---

## 6. Smart Engine workflow

```
INPUTS                          ENGINE                         OUTPUTS (draft only)
────────                        ──────                         ────────────────────
Address / geocode          ──►   Property context        ──►   Job site record
Photos (packet)            ──►   Vision / measure         ──►   Squares range, pitch, stories
Company profile            ──►   Defaults resolver        ──►   Material tier suggestion
Settings: bundle/labor/    ──►   Pricing assembler        ──►   Draft line items (not truth)
  margin, ZIP presets
Price Book (later)         ──►   Catalog mapper           ──►   Service/material lines
Supplier API (later)       ──►   Fallback w/ freshness    ──►   Flagged costs

SURFACES:
• New Job: confidence checklist, “Instant Estimate” preview cards
• Estimates: editable draft scope + line items + confidence per field
• Dashboard: “needs review” if low-confidence instant estimate pending
```

### Contractor-confirmed before truth

- Roof size used in pricing
- Pitch / stories / tear-off included
- Material selection
- Final price and margin
- Proposal text and send

### Anti-patterns (locked)

- Smart Engine → directly update protected pricing `useMemo` or auto-send
- Prepared Scope tiles → pricing truth without explicit apply/confirm
- Treating AI draft as sent to customer without review step

### Pricing source priority

1. **Company settings first:** bundle/material cost, labor assumptions, markup/margin, Price Book/service items, preferred materials/products
2. **Future fallback (later-stage only):** local supplier pricing with confidence/freshness warnings — never silent replacement for company settings

---

## 7. Customer communication / SMS updates

| Message type | Owner module | Timing | Confirmation |
|--------------|--------------|--------|--------------|
| Proposal send / follow-up email | **Estimates** | v0 exists | Send button |
| Quote follow-up SMS | **Estimates** + **Customers** | v2 | Draft → send |
| On my way / ETA | **Jobs Pipeline** / **Job detail** | v2–v3 | **Required** per message |
| On site / inspection started | **Jobs Pipeline** | v2–v3 | Required |
| Work started / completed | **Jobs Pipeline** | v2–v3 | Required |
| Payment reminders | **Invoices / Payments** | v2 | Required |

**Not on New Job v1.** Tied to scheduled/active job context (crew, date, customer phone). Settings may later define automation policies (e.g. auto-send ETA only if enabled).

---

## 8. AI Autopilot / Conductor

### Where global AI lives

| Surface | Purpose |
|---------|---------|
| **Top bar command** (future) | “Pull up sent estimates for Smith”, “Schedule Johnson for Tuesday” |
| **Dashboard Conductor rail** | Daily next actions, cross-module queue |
| **Contextual job rail** (Estimates/Jobs) | Packet-specific tasks |
| **AI / Tools** (`/tools/roofing/ai` → expand) | Voice profile, automation policies, favorites |

### Actions by confirmation tier

| Auto (read/suggest) | Confirm required | Never without explicit policy |
|---------------------|------------------|--------------------------------|
| Missing info detection | Draft follow-up email/SMS | Send proposal |
| Pull lists / open records | Add line items to estimate | Change approved price |
| Summarize customer history | Schedule/reschedule job | Charge payment |
| Confidence warnings | Create invoice draft | SMS to customer |
| | Apply Smart Engine to estimate fields | |

### Module interaction

- **Dashboard:** conductor task queue; deep links to Estimates/Jobs/Calendar
- **New Job:** intake gaps; suggest Instant Estimate when photos present
- **Estimates:** wording, line items, send prep
- **Jobs Pipeline:** stage moves, comms drafts
- **Calendar:** schedule proposals
- **Invoices:** deposit/balance actions
- **Customers:** history + comms context
- **Price Book:** suggest catalog items
- **Reports:** narrative insights (read-only)
- **Settings:** voice, automation toggles, pricing defaults

### Current code (transitional)

- `aiConductorStripItems`, AI Office sidebar in `RoofingClient.tsx`
- AI Library: company voice profile (`app/tools/roofing/ai/page.tsx`)
- `app/tools/roofing/aiReview.ts`: rule-based estimate checks
- **Not yet:** unified global autopilot or command bar

---

## 9. What not to build yet

1. **Wire Price Book into `RoofingClient` pricing `useMemo`** — locked until Estimate Items layout exists.
2. **Standalone Sent / Scheduled / Approved pages** — filters inside modules only.
3. **Further filtered-lane UI polish in `SavedClient.tsx`** — frozen until module architecture lands (see competitive audit).
4. **Local supplier pricing (Lowe’s/Home Depot-type)** — needs company defaults + confidence model first.
5. **Full SMS automation** — needs job entity, templates, compliance, confirmation UX.
6. **Homeowner opportunity portal** — after core contractor loop is modular.
7. **Big-bang entity split** (jobs vs estimates vs packets) — plan in docs; migrate `estimateStore` incrementally.
8. **roofing-v2 merge** — experimental; do not block module work.
9. **Material ordering module** — after Jobs Pipeline is a real route.
10. **Generic Jobber parity** (full generic CRM/tasks) — stay roofing-first.

---

## 10. Next safest build step

### Recommended order

| Step | Action | Rationale |
|------|--------|-----------|
| **1** | **This document** (`docs/fielddive-feature-placement-map.md`) | Anchors placement; prevents drift; complements flow map + competitive audit |
| **2** | **Continue New Job intake layout** (light Job Packet UI on Job Capture + optional light workspace strip) | Module 2 in progress; shell aligned at `b232fed`; no pricing/send touch |
| **3** | **Thin Estimates / Proposals shell** (`/tools/estimates`, list + draft/sent filters, open → existing record) | Unblocks Sent-as-filter; reduces monolith pressure without moving payments |

### Single best next coding step

**New Job intake layout pass** (visual-only on Job Capture / workspace header in `RoofingClient.tsx`), **then** Estimates route shell.

Optional parallel: Estimates route shell as a second small PR if intake and routing are split for review.

### Protected during build (do not change casually)

- Pricing `useMemo` in `RoofingClient.tsx`
- `saveEstimate`, `handleSendEstimate`, PDF/email APIs
- `estimateStore`, approval/token flow, payment/scheduling modals in SavedClient
- Auth, database, middleware

---

## Module quick reference

| Module | Purpose |
|--------|---------|
| **Dashboard** | Daily command surface — attention, movement, next steps |
| **New Job / Intake** | Job Packet creation |
| **Estimates / Proposals** | Pre-sale documents: draft → sent → viewed → approved |
| **Jobs Pipeline** | Post-approval production movement |
| **Calendar** | Scheduled work |
| **Invoices / Payments** | Billing and collection |
| **Customers** | CRM |
| **Price Book** | Services/materials catalog |
| **Reports** | Revenue, profit, conversion analytics |
| **AI / Tools** | Voice, review rules, conductor settings |
| **Settings** | Company profile, integrations, pricing defaults (future) |

---

*Placement map for FieldDive / TradeTools AI. Application code unchanged as part of this document.*
