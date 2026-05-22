# FieldDive Competitive Architecture Audit

**Purpose:** Pause UI coding that drifts FieldDive back toward a polished calculator + saved-estimate app. Align future work with industry-standard contractor modules (QuoteIQ / Roofr / JobNimbus / AccuLynx patterns), not standalone status-filter pages.

**Stable commits referenced:**

- `ab1d4bc` — Add admin foundation and FieldDive flow map
- `b7ddbb9` — Refine dashboard shell and daily command surface

**Related doc:** `docs/fielddive-flow-map.md` (step-by-step flow anchor; this doc is the module / competitive IA anchor).

---

## Locked product decisions

- **FieldDive should be organized around modules, not standalone status pages.**
- **Sent is not a standalone page direction.** Sent belongs as a **status/filter inside the future Estimates / Proposals** module (and as dashboard drill-down counts only until that module exists).
- **Dashboard** remains the daily command surface (attention, movement, next steps)—not a replacement for module list screens.
- **Jobs Pipeline** owns production movement (approved+, deposit-paid, on site, completed stages).
- **Calendar** owns scheduled work (date-centric views on scheduled jobs).
- **Invoices / Payments** owns billing and collection detail (deposits, balances, checkout, offline).
- **Reports** owns revenue/profit analytics (not lane-level financial strips on filtered views).
- **Customers** and **Price Book** are dedicated modules (admin foundations today at `/admin/*`).
- **Stop further filtered-lane UI polishing inside `SavedClient.tsx`** until module architecture is established (no Sent compact rows, no dark Command Deck lane polish, etc.).

---

## 1. Current routes and roles

| Route | Role today |
|-------|------------|
| `/` | Marketing landing → Roofing estimator |
| `/login`, `/signup` | Auth |
| `/tools` | Legacy “calculators & quote tools” index; entry to roofing + Command Center |
| `/tools/roofing` | **Monolithic New Job / estimator** (`RoofingClient.tsx`): capture, scope, pricing, send proposal, AI sidebar |
| `/tools/roofing/saved` | **Command Center + pseudo-module hub** (`SavedClient.tsx`): dashboard overview (`statusFilter === "all"`) + **in-app status “lanes”** (Draft/Sent/…) as UI state, not separate routes |
| `/tools/roofing/ai` | AI Library (voice profile, localStorage); `RoofingTabs` |
| `/tools/settings` | Company profile (logo, contact); dark layout; not unified with saved shell |
| `/tools/roofing/history` | Redirect → `/tools/roofing/saved` |
| `/tools/roofing/settings` | Roofing-specific settings page |
| `/tools/roofing-v2` | Experimental estimator UI (hidden/off by default in v1) |
| `/admin/customers` | **Data shelf:** company-scoped customer CRUD (not in main app nav) |
| `/admin/price-book` | **Data shelf:** `service_items` CRUD (not wired to estimator) |
| `/approve/[token]` | Customer approval / viewed tracking (KV + batch status in saved) |
| `/chat`, `/ai` | Separate AI/chat experiments |

**APIs** (cross-cutting, used from Roofing + Saved):

- `/api/email/*`, `/api/proposal/*`, `/api/estimate/send`
- `/api/payments/*`, `/api/approval/*`, `/api/approve/*`, `/api/track/open`

**Navigation reality:**

- `RoofingTabs`: New Job / Command Center / AI Library / Settings (`app/tools/roofing/RoofingTabs.tsx`)
- **FieldDive sidebar** on saved (`SavedClient.tsx`): labels for Calendar, Invoices, Customers, Price Book, Reports—many `href="#"` placeholders
- Admin routes are not linked from the main contractor shell

---

## 2. Legacy carryover

Legacy chain: **estimate calculator → saved estimates → status filters as virtual pages.**

| Pattern | Where it lives | Why it is legacy |
|---------|----------------|------------------|
| **Roofing calculator monolith** | `RoofingClient.tsx`: job capture, scope tiles, pricing `useMemo`, delivery/send | Single-page “tool” workflow, not modular New Job → Estimate → Job |
| **Saved estimates as the app** | `estimateStore.ts` + `SavedClient.tsx` as canonical list | Jobs/proposals stored as “saved estimates,” not separate `jobs` / `proposals` entities |
| **Status filters as destinations** | `statusFilter` state; dashboard chips; attention cards + deck lanes; filtered views with Command Deck + `SavedEstimateCard` | Treats Sent/Approved/Scheduled like **pages**, not filters inside Estimates or Pipeline |
| **Command Center naming** | `/tools/roofing/saved`, tabs, tools copy | Ops hub + pipeline + payments collapsed into one route/component |
| **Tools index framing** | `app/tools/page.tsx` — “Calculators and quote tools” | Pre–FieldDive product shape |
| **Admin silos** | Customers/Price Book under `/admin/*` only | Catalog/CRM exist but not in contractor workflow |
| **Dual storage** | Flow map: `RoofingClient` local list + `estimateStore` | Monolith persistence debt |

`docs/fielddive-flow-map.md` notes the dashboard on saved is mature enough to keep/refine; status lanes should map to **module filters later**, not drive new standalone UX.

---

## 3. Target FieldDive module architecture

| Module | Purpose |
|--------|---------|
| **Dashboard** | Daily command surface: today/week attention, KPIs, deep links—not full CRUD for every stage |
| **New Job / Intake** | Guided packet: customer, property, photos, checklist, AI hints |
| **Estimates / Proposals** | List + detail: draft → sent → viewed → approved (pre-sale); **Sent lives here as a filter** |
| **Jobs Pipeline** | Production movement: approved+, deposit-paid, on site, completed |
| **Calendar** | Scheduled work: dates, crew windows (reads scheduled jobs) |
| **Invoices / Payments** | Billing and collection: deposits, balances, checkout, offline truth |
| **Customers** | CRM (from `/admin/customers` foundation) |
| **Price Book** | Services/materials (from `/admin/price-book`; feeds estimate line items) |
| **Reports** | Revenue, profit, conversion analytics (read-only aggregates) |
| **AI / Tools** | Company voice, review rules, conductor (settings-level + contextual) |
| **Settings** | Company profile, integrations, team |

**Principle:**

- **Estimates** = pre-sale documents and statuses.
- **Jobs** = post-approval execution and production stages.
- **Calendar** = when work happens—not a “Scheduled status page.”
- **Invoices / Payments** = money collection detail—not duplicated on every filtered lane.
- **Reports** = business performance—not per-lane revenue cards.
- **Dashboard** = where you start the day—not where you run the whole business as one saved list.

---

## 4. Status-to-module table

| UI label | `statusFilter` | Long-term home | How it should appear |
|----------|----------------|----------------|----------------------|
| **Draft** | `estimate` | **Estimates / Proposals** | List filter; open in estimator |
| **Sent** | `sent_pending` | **Estimates / Proposals** | Filter only—**not** standalone nav page |
| **Approved** | `approved` | **Estimates → Jobs handoff** | Proposal approved; activate/track as job |
| **Ready to schedule** | `deposit_paid` | **Jobs Pipeline** | Stage: deposit received, needs schedule |
| **Scheduled** | `scheduled` | **Calendar** + **Jobs Pipeline** | Calendar primary; pipeline filter secondary |
| **On site** | `in_progress` | **Jobs Pipeline** | Production stage |
| **Completed** | `paid` | **Jobs Pipeline** + **Invoices/Payments** + **Reports** | Closed job; financial history in payments/reports |

**Dashboard-only today (correct):** Counts/widgets linking into module filters (e.g. “waiting on customer” → Estimates sent filter).

**Temporary (until modules exist):** `SavedClient` `statusFilter !== "all"` drill-down on `/tools/roofing/saved`—treat as legacy bridge, not design priority.

---

## 5. Competitive alignment notes

Architecture and workflow only—do not copy competitor visuals.

| Pattern | FieldDive fit |
|---------|---------------|
| **Roofr / QuoteIQ** | Strong **Estimates/Proposals** with status; measure → propose → send |
| **JobNimbus / AccuLynx** | **Jobs Pipeline** + **Calendar** after sale; **Customers**; **Invoices** |
| **Recommended combined model** | Roofr-like estimate flow (`RoofingClient` core) + AccuLynx-like job/calendar/payment (`SavedClient` payment/scheduling logic) + **Dashboard** (`b7ddbb9`) |

**Misalignment to avoid:**

- Enriched standalone **Sent / Approved / Scheduled** surfaces inside `SavedClient`.
- Revenue/profit strips on filtered lanes (belongs in **Reports**).
- Polishing filtered-lane UI before **Estimates** and **Jobs** module routes exist.

**Alignment target:**

- One **proposals list** with filters (includes Sent).
- One **jobs board** with stages.
- One **calendar** for scheduled work.
- One **payments** area for collection detail.

---

## 6. What to keep

| Asset | Reason |
|-------|--------|
| **b7ddbb9 dashboard** (`statusFilter === "all"`) | Correct daily command surface |
| **`estimateStore` + Supabase sync** | Canonical data until entity split |
| **Payment + approval APIs** | Real business logic |
| **`SavedEstimateCard` + scheduling/deposit modals** | Production actions—relocate under Jobs/Payments modules later |
| **`RoofingClient` pricing `useMemo` + send/proposal APIs** | Protected estimate engine |
| **`CustomersAdminClient` / `PriceBookAdminClient`** | Shelves for dedicated **Customers** and **Price Book** modules |
| **`/approve/[token]`** | Customer-facing approval |
| **`docs/fielddive-flow-map.md`** | Flow-step anchor |
| **AI pieces** (`aiReview.ts`, voice profile, conductor) | Consolidate under AI/Tools later |

---

## 7. What to refactor later

| Item | Target |
|------|--------|
| `statusFilter !== "all"` as full-page UX | Module routes + query filters, not saved-only state |
| `SavedClient.tsx` monolith | Split: Dashboard client, Jobs pipeline client, shared shell |
| `RoofingClient.tsx` | Split: Intake → Scope → Estimate Items → Review → Send |
| Sidebar `href="#"` placeholders | Wire to real module routes |
| `RoofingTabs` vs saved sidebar | Single app shell |
| “Command Center” user-facing name | **Dashboard** (+ separate **Jobs** entry) |
| Price Book → estimator | Only after Estimate Items layout exists |
| `roofing-v2` | Merge or remove after split |
| Command Deck on filtered lanes | Dashboard only |
| Filtered-lane UI polish in `SavedClient` | **Frozen** until module architecture lands |

**Out of scope for refactor-only work:** pricing `useMemo`, payment flows, approval batch, `estimateStore` behavior, auth, APIs, database.

---

## 8. Next 3 safe steps

### Step 1 — Documentation (this file)

Record module map, status table, and locked decisions so coding does not drift.

**Risk:** None.

### Step 2 — Freeze filtered-lane UX in `SavedClient`

Keep `b7ddbb9` dashboard as-is. Do **not** invest in:

- Standalone Sent / Approved / Completed page designs
- Compact row experiments on filtered lanes
- Command Deck / Business Snapshot polish on `statusFilter !== "all"`

Lane clicks remain a **temporary bridge** on `/tools/roofing/saved` only.

**Risk:** Low—prevents rework.

### Step 3 — First module shell (when coding resumes)

Add a thin **Estimates / Proposals** route (e.g. `/tools/estimates`):

- List shell reading existing `estimateStore` data
- Filters for draft/sent (including **Sent as filter, not page**)
- Link “open” to `/tools/roofing` / existing records

Optional: point sidebar **Estimates** to that shell; **Customers** / **Price Book** to `/admin/*`.

Do **not** migrate payments/scheduling out of saved in the same step.

**Defer:** New Job intake layout pass; Price Book wired into pricing; stripping Command Deck from filtered views (can follow module split).

---

## Summary

| Question | Answer |
|----------|--------|
| Organize how? | Modules, not status pages |
| Where does Sent go? | **Estimates / Proposals** filter—not standalone |
| Daily start? | **Dashboard** on saved (overview only) |
| Production? | **Jobs Pipeline** + **Calendar** for scheduled |
| Money detail? | **Invoices / Payments** |
| Analytics? | **Reports** |
| CRM / catalog? | **Customers**, **Price Book** modules |
| What to stop now? | Filtered-lane UI polish in `SavedClient` |

---

*Repo inspection at commits through `b7ddbb9`. Application code unchanged as part of this document.*
