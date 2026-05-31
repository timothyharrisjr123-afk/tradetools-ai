# FieldDive Global Handoff

**Purpose:** Single source of truth for GPT, Cursor, and humans when resuming work. Prevents drift across chat transitions. Read this file **before** proposing or implementing code changes.

**Related docs (secondary anchors):**

- `docs/fielddive-flow-map.md` — IA / screen flow map
- `docs/competitive-architecture-audit.md` — module vs legacy calculator audit
- `docs/fielddive-estimate-proposal-flow-model.md` — estimate/proposal UX model notes
- `docs/fielddive-feature-placement-map.md` — feature placement matrix

**Last updated checkpoint:** `a62addb` — Add admin catalog starter install UI (includes `AdminNavLinks`, recheck starter catalog button).

---

## 1. STRICT MODE / NO DRIFT RULES

- **Do not guess.** Inspect the repo and running behavior before changing code.
- **Always inspect current repo state** before code changes:
  - `git status --short`
  - `git log --oneline -15`
- **Ask for generous surrounding code** when a change touches protected or monolithic files.
- **Use exact current code only** — match naming, patterns, and file boundaries already in the tree.
- **Make surgical changes** — smallest diff that solves the scoped stage; no drive-by refactors.
- **One Cursor-ready prompt at a time** — finish and verify one stage before stacking the next.
- **Protect** pricing, payments, approval, status, saved estimates, send/PDF (see §9).
- **AI must not touch pricing truth** — no “helpful” pricing math in catalog, measurement, or handoff modules.
- **Do not enable** proposal builder, create-proposal flows, payment capture, or status pipeline changes casually.
- **Best long-term architecture beats the easiest shortcut** — e.g. company catalog setup in admin, not hidden per-job auto-install.

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
  → Templates
  → Proposal Builder
  → Signed proposal
  → Material order
  → Work order
  → Invoice / payment / status / job costing (later)
```

**Manual Estimate** is inactive. **Proposal Builder** does not exist yet in code.

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
  → Proposal Templates (not built yet)
  → Proposal Builder (not built yet)
  → Proposal output / PDF / send (protected legacy paths today)
  → Material / order operations (later)
```

Do **not** skip catalog + templates and jump to Proposal Builder or pricing bridge.

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

## 5. COMPLETED CATALOG STAGE 3F (THROUGH 3F6B)

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

### Current catalog state

- `public.catalog_items` table exists; migration **applied** in Supabase.
- `catalogStore.ts` — company-scoped CRUD (reads + writes); **no UI** calls `updateCatalogItem` yet.
- `defaultRoofingCatalog.ts` — 13 starter definitions with `metadata.seed_key`.
- `installDefaultRoofingCatalog(companyId)` — insert-only, dedupe by `seed_key`; **not** auto-run on page load.
- **`/admin/catalog`** exists — install + recheck starter catalog, readiness summary, `AdminNavLinks`.
- Starter catalog **installed successfully** in dev (verified): **13** rows, **13** active, **13** unpriced, **13** with seed keys.
- **Recheck** behavior: `created 0`, `skipped 13`, `failed 0` when already installed.
- **`service_items`** and legacy **`/admin/price-book`** unchanged (still `PriceBookAdminClient` → `service_items` only).
- Job Card **catalog readiness** reads `getActiveCatalogItemsByCompany` — display only.
- **Proposal buttons remain disabled** on Job Card.
- **No pricing bridge** from `catalog_items` to estimator `useMemo` yet.

**Key files:** `app/lib/catalogTypes.ts`, `app/lib/catalogStore.ts`, `app/lib/defaultRoofingCatalog.ts`, `app/lib/defaultRoofingCatalogInstall.ts`, `app/lib/catalogReadiness.ts`, `app/admin/catalog/*`, `app/admin/AdminNavLinks.tsx`.

---

## 6. IMPORTANT ARCHITECTURE BOUNDARIES

| Concept | Owns |
|---------|------|
| **MeasurementRecord** | Roof measurement truth (quantities, source, readiness) — `measurement_records` |
| **CatalogItem** | Reusable company-owned line item + **quantity driver** (`quantity_source`) — `catalog_items` |
| **ProposalTemplate** | Which catalog items are included in a package (Good/Better/Best, etc.) — **not built** |
| **Proposal** | Job-specific instance of template + measurement — **not built** |
| **Pricing engine** | Deterministic math on estimator — **later deliberate bridge**; still on legacy snapshot today |
| **Payments / approvals / status** | Estimates/proposals KV + APIs — **protected**; do not couple to catalog install |

**Do not conflate:**

- `catalog_items` (new spine) vs `service_items` (legacy admin price book)
- Catalog readiness vs proposal-ready (measurement handoff)
- Catalog row definitions vs proposal totals

---

## 7. CURRENT NEXT DECISION AFTER 3F6B

**Do not code in a new chat until the next stage is chosen explicitly.**

| Option | Stage | What it is |
|--------|-------|------------|
| **A** | 3F6C | Job Card catalog CTA — link to `/admin/catalog`, optional refetch after install; **no** install on Job Card |
| **B** | 3F6B+ | Stronger `/admin/catalog` — list/edit prices, CRUD on `catalog_items` |
| **C** | **3G** | **Template type foundation** — `proposalTemplateTypes.ts`, passive default templates, then migration |
| **D** | 3F7+ | Full catalog admin for `catalog_items` (replace or parallel legacy price book) |

### Guidance (architecture-first)

- **Do not rush Proposal Builder** — needs catalog + templates first.
- **Do not wire catalog into pricing `useMemo` yet.**
- **Do not migrate `service_items` → `catalog_items`** unless explicitly planned and scoped.
- **Do not add hidden auto-install** on Job Card load or first visit.
- **Best likely long-term next move:** **C (3G — template foundation)** after optional small **A (Job Card link/refetch)** if UX needs a bridge from Job Card to admin setup.

Choose deliberately; document the choice in commit message and stage prompt.

---

## 8. REQUIRED FIRST PROMPT IN NEW CHAT

Future GPT must have Cursor run **before** implementing:

```bash
git status --short
git log --oneline -15
```

Then read (at minimum):

| File | Why |
|------|-----|
| `docs/fielddive-global-handoff.md` | This file |
| `app/admin/catalog/page.tsx` | Admin auth + companyId |
| `app/admin/catalog/CatalogAdminClient.tsx` | Install/recheck UI |
| `app/admin/AdminNavLinks.tsx` | Admin cross-links |
| `app/lib/catalogTypes.ts` | Type contract |
| `app/lib/catalogStore.ts` | DB I/O |
| `app/lib/defaultRoofingCatalog.ts` | 13 starter definitions |
| `app/lib/defaultRoofingCatalogInstall.ts` | Idempotent install |
| `app/lib/catalogReadiness.ts` | Readiness labels |
| `app/lib/measurementProposalHandoff.ts` | Proposal input (measurement only) |
| `app/tools/roofing/RoofingClient.tsx` | **Job Card only** — Proposals + catalog readiness blocks |

Confirm: proposal buttons still disabled; no unintended imports of `installDefaultRoofingCatalog` outside admin.

---

## 9. CURRENT PROTECTED SYSTEMS

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

**Safe catalog work** stays in: types, store, default definitions, install helper, readiness helpers, admin catalog page, passive Job Card display.

---

## Quick reference — routes

| Route | Table / role |
|-------|----------------|
| `/tools/roofing?entry=job-card` | Job Card shell, measurements, passive proposals/catalog |
| `/admin/catalog` | **catalog_items** setup + starter install |
| `/admin/price-book` | Legacy **service_items** only |
| `/admin/customers` | Customers CRUD |
| `/tools/roofing/saved` | Command Center (SavedClient) |

---

## Changelog (handoff doc only)

- **2026-05-31:** Initial global handoff after Stage 3F6B (`a62addb`).
