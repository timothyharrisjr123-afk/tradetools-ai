# FieldDive Product Flow Map

## Purpose

FieldDive is moving toward an AI-native contractor operating system inspired by QuoteIQ's functional density, but not a direct visual clone. The goal is less decorative empty space and more useful workflow per screen.

This document is the repo-level IA anchor. Future coding should follow this map instead of wiring features into the legacy monolith layout blindly.

## Current Foundation Complete

- Customers admin foundation works and is company-scoped.
- Price Book admin foundation works and is company-scoped.
- `service_items` saves correctly.
- These are **data shelves**, not final workflow screens.

**Admin entry points (not linked from tools nav today):**

| Route | File |
|-------|------|
| `/admin/customers` | `app/admin/customers/page.tsx`, `app/admin/customers/CustomersAdminClient.tsx` |
| `/admin/price-book` | `app/admin/price-book/page.tsx`, `app/admin/price-book/PriceBookAdminClient.tsx` |

## Locked Rule

Do not wire Price Book into the old estimator layout blindly.

Price Book should feed the future **Estimate Items** step after the target New Job / Estimate Items layout is mapped.

`service_items` is referenced only in `app/admin/price-book/PriceBookAdminClient.tsx` today — not in `RoofingClient.tsx`, `SavedClient.tsx`, or pricing `useMemo`.

---

## Target Flow

### 1. Command Center

**Purpose:**  
Home operating hub.

**Current file areas:**

- `app/tools/roofing/saved/page.tsx`
- `app/tools/roofing/saved/SavedClient.tsx` (~2778+; shell nav ~4096–4191; hero/filters ~4195–4374; `SavedEstimateCard` ~1954+; `PipelineBar` ~1320+; `RevenueSummary` ~1429+)

**Current status:**  
Exists and is mature enough to keep/refine.

**Should include:**

- KPIs
- Command Deck
- Pipeline movement
- Recent activity
- AI Conductor / next actions

**Next action:**  
Refine later after New Job flow is mapped.

---

### 2. New Job Capture / Job Packet

**Purpose:**  
Step 1 guided job intake.

**Current file areas:**

- `app/tools/roofing/page.tsx` → `app/tools/roofing/RoofingClient.tsx`
- Section: **Job Capture** / `#customer-job-section` (~4048–4498)
- Workspace header + 5-step preparation timeline (~3904–4040)

**Current status:**  
Exists, but still monolithic and partly old-layout driven. Customer fields are free-text; admin `customers` table is only linked on estimate save via `findOrCreateCustomer` in `app/lib/estimateStore.ts`.

**Should include:**

- Customer
- Property address
- Photos
- Location
- Checklist
- AI suggestions

**Next action:**  
Map replacement or refinement before wiring more logic.

---

### 3. Scope of Work

**Purpose:**  
Define what work is being done.

**Current file areas:**

- `app/tools/roofing/RoofingClient.tsx`
- **FieldDive Prepared Scope** (~4500–4637) — visual tiles (pitch, stories, tear-off display)
- **Scope Builder** / `#scope-inputs` (~4639–5057) — roof size, waste, bundle cost, tier, included scope

**Current status:**  
Exists, but Prepared Scope visuals may diverge from pricing truth (explicit comment ~990–991: UI-only prototype state must not drive pricing, PDF, save/load).

**Should include:**

- job type
- roof/job details
- measurements
- notes/photos
- complexity
- service category

**Next action:**  
Decide which scope tiles become authoritative before deeper wiring.

---

### 4. Estimate Items / Price Book

**Purpose:**  
Where reusable services/materials belong.

**Current file areas:**

- `app/admin/price-book/PriceBookAdminClient.tsx`
- `service_items` table (company-scoped)

**Current status:**  
Admin-only. Not wired into estimator. No line-item model in New Job UI yet.

**Should include:**

- reusable `service_items`
- quantities
- unit cost
- unit price
- materials/services line items

**Next action:**  
Do not wire until New Job / Estimate Items layout is defined.

---

### 5. Review & Price

**Purpose:**  
Contractor-facing pricing review.

**Current file areas:**

- `app/tools/roofing/RoofingClient.tsx`
- **Deal Control** / `#deal-control` (~5060–5184)
- **Live Outcome** sidebar (~5568–5631)
- Pricing truth: `useMemo` ~1162–1287 (`materialsCost`, `laborCostEffective`, `subtotal`, `finalPrice`)
- **Estimate Review** (~5536–5560); `getPricingInsights` ~158; `app/tools/roofing/aiReview.ts`

**Current status:**  
Exists.

**Protected rule:**  
Pricing truth is protected. Do not casually edit pricing `useMemo` or pricing engine.

**Should include:**

- margin
- job cost
- final price
- gross profit
- proposal readiness

**Next action:**  
Keep until Estimate Items model is defined.

---

### 6. Send / Invoice / Payment

**Purpose:**  
Proposal send, invoice, payment link, and customer payment path.

**Current file areas:**

- Send proposal: `RoofingClient.tsx` Delivery bar (~5354–5420), `/api/email/send`, `/api/proposal/generate`, `/api/email/generate`
- Payments and scheduling: `SavedClient.tsx`, `/api/payments/*`, `/api/email/followup`
- Approval batch: `/api/approval/batch-status`

**Current status:**  
Split across New Job (send) and Command Center (deposits, schedule, offline pay, checkout).

**Next action:**  
Do not change payment flow yet.

---

### 7. Pipeline / Job Management

**Purpose:**  
Track jobs after proposal/save.

**Current file areas:**

- `app/tools/roofing/saved/SavedClient.tsx`
- `PipelineBar`, `SavedEstimateCard`
- Status lanes: `estimate` → `sent` / `sent_pending` → `viewed` → `approved` → `deposit_paid` → `scheduled` → `in_progress` → `paid`
- Quick filters: Overview, Draft, Sent, Approved, Ready to schedule, Scheduled, On site, Completed (~4348–4374)

**Current status:**  
Exists and should be kept. Canonical job store: `app/lib/estimateStore.ts`.

**Next action:**  
Map status lanes to target Command Center labels later.

---

### 8. AI Conductor

**Purpose:**  
Cross-page assistant and next-action layer.

**Current file areas:**

- `RoofingClient.tsx`: `aiConductorStripItems` (~3593–3607), timeline strip (~3965–4037), **AI Office** sidebar (~5766–5847), proposal wording panel (~5431–5504)
- `app/tools/roofing/ai/page.tsx` — AI Library (company voice profile)
- `app/tools/roofing/aiReview.ts` — rule-based estimate review
- `SavedClient.tsx` — prepared next action, pipeline insight, follow-up prefs

**Current status:**  
Exists in multiple places; needs future consolidation.

**Next action:**  
Define settings-level AI vs per-job AI later.

---

## App Navigation (current)

| Label | Route | Primary file |
|-------|-------|----------------|
| Tools index | `/tools` | `app/tools/page.tsx` |
| New Job | `/tools/roofing` | `RoofingClient.tsx` |
| Command Center | `/tools/roofing/saved` | `SavedClient.tsx` |
| AI Library | `/tools/roofing/ai` | `app/tools/roofing/ai/page.tsx` |
| Settings | `/tools/settings` | `app/tools/settings/page.tsx` |
| Roofing v2 (experiment) | `/tools/roofing-v2` | `app/tools/roofing-v2/RoofingClientV2.tsx` |

Shared tab component (partially duplicated): `app/tools/roofing/RoofingTabs.tsx`  
Inline FieldDive shell nav is duplicated in `RoofingClient.tsx` and `SavedClient.tsx`.

---

## Current IA Debt

- Two nav implementations: `RoofingTabs` and inline FieldDive shell.
- Two estimator UIs: v1 monolith and `roofing-v2` preview (hidden toggle in `RoofingClient.tsx`, default off).
- Customers exist as admin CRUD but New Job uses free-text customer fields.
- Price Book exists as admin CRUD but Estimate Items does not exist yet.
- Prepared Scope visuals may not always drive pricing truth.
- Admin routes are not linked from the real app navigation.
- Legacy parallel storage: `RoofingClient` still writes `STORAGE_KEY_ESTIMATES` local list in addition to `estimateStore`.

---

## Next Build Recommendation

1. Do not wire `service_items` into pricing yet.
2. Decide the first UI move:
   - **A.** Create a lightweight Settings/Admin access point for Customers + Price Book, or
   - **B.** Start reshaping New Job Capture toward the target Job Packet / Estimate Items flow.
3. Only after Estimate Items layout exists, wire `service_items` into that step.

---

## Reference: pricing inputs today (v1, protected)

Until Estimate Items exists, v1 pricing is computed in `RoofingClient.tsx` from:

- Materials: `area`, `waste`, `bundlesPerSquare`, `bundleCost`
- Labor: `laborMode` (guided vs manual), `guidedLaborBasePerSquare`, stories/walkability, or manual total
- Tear-off: `includeDebrisRemoval`, `removalType`, `dumpFeePerTon`
- Margin: `margin`, `pricingMode` (`markup` | `direct`)

Do not replace this path with Price Book reads until step 4 layout is approved.
