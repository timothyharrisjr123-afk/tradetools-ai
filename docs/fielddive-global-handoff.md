# FieldDive Global Handoff

**Purpose:** Single source of truth for GPT, Cursor, and humans when resuming work. Prevents drift across chat transitions. Read this file **before** proposing or implementing code changes.

**Related docs (secondary anchors):**

- `docs/fielddive-flow-map.md` — IA / screen flow map
- `docs/competitive-architecture-audit.md` — module vs legacy calculator audit
- `docs/fielddive-estimate-proposal-flow-model.md` — estimate/proposal UX model notes
- `docs/fielddive-feature-placement-map.md` — feature placement matrix

**Last updated checkpoint:** `34a934a` — Add FieldDive roadmap to handoff (3G1–3G5 code foundation through `07b3c1d`; **next: 3F8** Catalog Product Surface Alignment, **then 3G6** Templates UI; no template route wired yet).

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

### No-drift warnings (catalog / proposal spine)

- **Catalog is a first-class FieldDive route** — canonical `/tools/roofing/catalog` in `FieldDiveAppShell`; not hidden dark admin UI.
- **`/admin/catalog` redirects** to `/tools/roofing/catalog` (alias only).
- **Job Card** should later show readiness / link to Catalog setup — **Job Card must not become the catalog editor**.
- **Do not** route back to Manual Estimate as the active path.
- **Do not** use `service_items` as the new catalog truth without an explicit migration plan.
- **Do not** wire `catalog_items` into estimator pricing too early — pricing bridge must be **deterministic** and deliberate.
- **Templates come after catalog setup** — template install depends on catalog `metadata.seed_key` rows being available.
- **Proposal Builder comes after templates** — do not enable **Create proposal** before templates and Proposal Builder exist.
- **Do not** add AI pricing.
- **Do not** auto-install catalog rows from Job Card.
- **Do not** auto-install proposal templates from Job Card.
- **Do not** overwrite user-modified template rows — install helpers are insert-only (seed_key dedupe).
- **Do not** create proposal records / line snapshots until Proposal Builder is deliberately scoped.
- **Do not** create PDF / send / approval bridges before proposal records exist.
- **Do not** touch payment / status / approval while working catalog or template setup (unless the stage explicitly scopes it).
- **Do not treat table/store existence as product completion** — audit **architecture, functionality, layout, and UI** together before advancing the spine.
- **Do not build Templates UI (3G6) on top of a weak Catalog product surface** — align catalog with Roofr-style setup workspace first (**3F8**).

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

**Manual Estimate** is inactive. **Proposal template foundation** (types, tables, store, passive defaults, install helper) exists in code but is **not wired to UI**. **Proposal Builder** does not exist yet in code.

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
  → Proposal Templates (tables + store + defaults + install helper — UI not built)
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
- **`/tools/roofing/catalog`** — canonical catalog setup: install/recheck, readiness summary, installed items table, **3F7B pricing editor**, light FieldDive shell.
- **`/admin/catalog`** — redirect only to `/tools/roofing/catalog`.
- Starter catalog **installed successfully** in dev (verified): **13** rows typical when seeded.
- **`service_items`** and legacy **`/admin/price-book`** unchanged (`PriceBookAdminClient` → `service_items` only).
- Job Card **catalog readiness** reads `getActiveCatalogItemsByCompany` — display only; **no catalog editor on Job Card**.
- **Proposal buttons remain disabled** on Job Card.
- **No pricing bridge** from `catalog_items` to estimator `useMemo` yet.

**Key files:** `app/lib/catalogTypes.ts`, `app/lib/catalogStore.ts`, `app/lib/defaultRoofingCatalog.ts`, `app/lib/defaultRoofingCatalogInstall.ts`, `app/lib/catalogReadiness.ts`, `app/admin/catalog/CatalogAdminClient.tsx`, `app/tools/roofing/catalog/*`, `app/tools/roofing/FieldDiveAppShell.tsx`.

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
- Proposal Template type foundation (3G1)
- Proposal Template tables foundation — committed and **live in Supabase** (3G2)
- Proposal Template store foundation (3G3)
- Default roofing proposal template definitions (3G4)
- Default roofing proposal template install helper (3G5)

### Current proposal template state

- Four `proposal_template_*` tables live in Supabase with RLS; typically **0 rows** until install helper is invoked from a future UI.
- `proposalTemplateStore.ts` — company-scoped CRUD; **not imported by app routes yet**.
- `defaultRoofingProposalTemplates.ts` — passive Roof replacement template (Standard / Enhanced / Premium).
- `installDefaultRoofingProposalTemplates(companyId)` — insert-only; requires catalog `metadata.seed_key` rows for catalog-backed line items.
- **No** Proposals/Templates UI route, readiness UI, or Job Card template install yet.
- **Proposal buttons remain disabled** on Job Card.
- **No** Proposal Builder, proposal records, pricing bridge, or PDF/send integration.

**Key files:** `app/lib/proposalTemplateTypes.ts`, `app/lib/proposalTemplateStore.ts`, `app/lib/defaultRoofingProposalTemplates.ts`, `app/lib/defaultRoofingProposalTemplateInstall.ts`, `supabase/migrations/20260531_004_create_proposal_template_tables.sql`.

---

## 7. IMPORTANT ARCHITECTURE BOUNDARIES

| Concept | Owns |
|---------|------|
| **MeasurementRecord** | Roof measurement truth (quantities, source, readiness) — `measurement_records` |
| **CatalogItem** | Reusable company-owned line item + **quantity driver** (`quantity_source`) — `catalog_items` |
| **ProposalTemplate** | Reusable company-owned package (options, sections, catalog-backed items) — **types, tables, store, defaults, install helper**; **no UI** |
| **Proposal** | Job-specific instance of template + measurement + snapshots — **not built** |
| **Pricing engine** | Deterministic math on estimator — **later deliberate bridge**; still on legacy snapshot today |
| **Payments / approvals / status** | Estimates/proposals KV + APIs — **protected**; do not couple to catalog install |

**Do not conflate:**

- `catalog_items` (new spine) vs `service_items` (legacy admin price book)
- Catalog readiness vs proposal-ready (measurement handoff)
- Catalog row definitions vs proposal totals
- Catalog setup UI (FieldDive route) vs Job Card (readiness/link only, not editor)
- Template setup (future FieldDive route) vs Job Card (readiness/link only, not template editor)
- `catalog_seed_key` on template items (install-time resolution) vs live `catalog_item_id` (FK + Builder)

---

## 8. CURRENT NEXT (SUMMARY)

**Next implementation stage:** **3F8 — Catalog Product Surface Alignment** (Roofr-informed product/UI pass on `/tools/roofing/catalog`).

**Then:** **3G6 — Proposals/Templates setup UI + readiness/install surface** (Roofr research first; **not** Proposal Builder).

### Roofr alignment audit note (2026-05-31)

Read-only audit against Roofr Academy / masterclass catalog expectations:

- **Catalog backend/data spine is solid enough** for starter templates: `catalog_items`, seed keys, quantity sources, store CRUD, starter install, template `catalog_seed_key` resolution in 3G5.
- **Catalog product surface is not Roofr-aligned enough yet:** current page is **install + wide table + partial inline row editor**, not a foundational **Manage Catalog / Quick Start** workspace (no add-item UI, CSV/manufacturer import, Jumpstart picker, search/filter/group at scale, tax fields).
- **Roofr benchmark:** catalog is among the most important setup pieces; feeds proposals, material orders, and standardized operations. Expects guided setup (install → price → templates), not only a technical table.
- **Decision:** **3F8 before 3G6** — do not mislead the next chat by jumping to Templates UI while catalog still reads as admin-table DNA and readiness copy still blurs **Catalog** vs legacy **Price Book**.

**Full ordered roadmap, drift list, and per-stage scope:** see **§11 — Forward Roadmap / No-Drift Next Steps**.

**Do not code in a new chat until repo truth is confirmed** (`git status`, `git log`, this doc) and the stage is explicitly scoped.

---

## 9. REQUIRED FIRST PROMPT IN NEW CHAT

Future GPT must have Cursor run **before** planning or coding:

```bash
git status --short
git log --oneline -15
```

Then open and read:

- `docs/fielddive-global-handoff.md` (this file)
- **§11 — Forward Roadmap / No-Drift Next Steps** (ordered stages; what is done vs next)

**Verify HEAD** is `34a934a` (Add FieldDive roadmap to handoff) or identify newer commits and reconcile this doc.

**Confirm** working tree is clean.

**Confirm** next stage is **3F8 planning** (Catalog Product Surface Alignment) — **do not code** until repo truth is confirmed and stage is explicitly scoped. **3G6 is deferred** until after 3F8.

Inspect before planning **3F8** (or chosen stage):

| File | Why |
|------|-----|
| `app/tools/roofing/catalog/page.tsx` | Canonical catalog route auth + companyId |
| `app/tools/roofing/catalog/CatalogAppPage.tsx` | FieldDive shell wrapper |
| `app/admin/catalog/page.tsx` | Redirect to `/tools/roofing/catalog` |
| `app/admin/catalog/CatalogAdminClient.tsx` | Catalog install/recheck + table + **3F7B editor** |
| `app/tools/roofing/FieldDiveAppShell.tsx` | Sidebar nav + `activeNav` (Catalog today; Templates after 3F8 / 3G6) |
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
| `app/tools/roofing/RoofingClient.tsx` | **Job Card only** — passive proposals + catalog readiness |
| `supabase/migrations/20260531_004_create_proposal_template_tables.sql` | Live template schema |

Confirm: proposal buttons still disabled on Job Card; `installDefaultRoofingCatalog` only from catalog route; `installDefaultRoofingProposalTemplates` **not imported** by app yet; `/admin/catalog` redirects.

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

**Safe catalog work** stays in: types, store, default definitions, install helper, readiness helpers, catalog route page/client, passive Job Card display.

**Safe template work** stays in: `proposalTemplateTypes.ts`, `proposalTemplateStore.ts`, passive default definitions, template install helper, future template setup route/UI/readiness — **not** Proposal Builder, proposal records, pricing bridge, or protected estimate/send paths unless explicitly scoped.

---

## Quick reference — routes

| Route | Table / role |
|-------|----------------|
| `/tools/roofing?entry=job-card` | Job Card shell, measurements, passive proposals/catalog readiness |
| `/tools/roofing/catalog` | **Canonical** **catalog_items** setup — FieldDive shell, install, list, 3F7B editor |
| `/admin/catalog` | Redirect → `/tools/roofing/catalog` |
| `/admin/price-book` | Legacy **service_items** only |
| `/admin/customers` | Customers CRUD |
| `/tools/roofing/saved` | Command Center (SavedClient) |
| `/tools/roofing/templates` (planned **after 3F8**, stage 3G6) | **proposal_template_*** setup — install/recheck, readiness (not built) |

---

## 11. FORWARD ROADMAP / NO-DRIFT NEXT STEPS

Use this section as the **ordered checklist** for future GPT/Cursor sessions. Knock items off top-to-bottom within each band; do not skip layers. Product/code stages marked **DONE** reflect commits through `07b3c1d` (3G5); handoff doc through `34a934a` unless a later commit supersedes.

### Current checkpoint

**Latest code checkpoint:** `07b3c1d` — default roofing proposal template install helper (3G1–3G5 foundation).  
**Latest handoff doc checkpoint:** `34a934a` — forward roadmap in handoff (§11); **next 3F8**, then **3G6** (per Roofr alignment audit).

**Completed working state (summary):**

| Area | Status |
|------|--------|
| **3E** Measurement Records / Job Card measurement truth | **DONE** |
| **3F** Catalog foundation + install + FieldDive catalog route | **DONE** through shell alignment (`01e2d9e`) |
| **3F7A** Read-only installed catalog list | **DONE** (`6b37370`) — in `CatalogAdminClient` |
| **3F7B** Catalog item pricing/config editor | **DONE** (`81a70e3`) — `updateCatalogItem` for scoped fields |
| **Canonical catalog route** | **`/tools/roofing/catalog`** (FieldDive shell); `/admin/catalog` → redirect |
| **Starter catalog** | 13 passive defs; `installDefaultRoofingCatalog` insert-only, seed dedupe |
| **Typical dev install** | 13 active rows, 13 seeded, often **13 unpriced** until contractor sets prices |
| **Recheck** | Idempotent: created 0 / skipped 13 on re-run when fully installed |
| **Legacy price book** | `/admin/price-book` → `service_items` unchanged |
| **3G1–3G5** Proposal template types, **live** 4-table schema, store, default defs, install helper | **DONE** — **not wired to UI** |
| **Job Card** | Proposal buttons **disabled**; passive catalog + measurement readiness |
| **Protected** | Pricing, payments, approval, status, saved estimates, send/PDF **untouched** |

**SQL note:** Catalog/template table verification was done in Supabase during 3F/3G stages; do not re-run schema changes from roadmap work unless a stage explicitly scopes a new migration.

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
| `app/tools/roofing/catalog/CatalogAppPage.tsx` | FieldDive shell wrapper |
| `app/admin/catalog/page.tsx` | Redirect to `/tools/roofing/catalog` |
| `app/admin/catalog/CatalogAdminClient.tsx` | Catalog install/recheck, list, 3F7B editor |
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

Confirm: proposal buttons disabled; `installDefaultRoofingCatalog` only from catalog setup route; `installDefaultRoofingProposalTemplates` **not imported** by app yet.

---

### Stage 0 — Commit global handoff doc — **DONE**

- `4b5016e` — Add FieldDive global handoff doc
- Ongoing updates (e.g. `34a934a`) — keep doc aligned with HEAD after each major stage

**Purpose:** Repo-local no-drift source; do not rely on chat memory alone.

---

### Stage 3F6C — Catalog setup cohesion / Job Card guidance — **NOT DONE**

**Goal:** Job Card guides users to company catalog setup without becoming an admin screen.

**Rules:**

- No hidden auto-install on Job Card load
- Do not call `installDefaultRoofingCatalog` from Job Card unless explicitly scoped later
- Proposal buttons stay disabled

**Likely scope:**

- Show real installed state: active items, starter installed, priced count, next step (configure prices / templates)
- Passive CTA: **Open Catalog setup** → `/tools/roofing/catalog` (not legacy `/admin/catalog` as primary)

**Likely files:** `app/tools/roofing/RoofingClient.tsx`, possibly `app/lib/catalogReadiness.ts`

**Do not touch:** pricing `useMemo`, `saveEstimate`, send/PDF, approval, payment, status, SavedClient, `estimateStore`, `service_items`, `PriceBookAdminClient`

**Suggested commit:** `Refine Job Card catalog setup guidance`

---

### Stage 3F7 — Real Catalog Admin / Edit Surface — **DONE (3F7A + 3F7B)**

Catalog setup lives at **`/tools/roofing/catalog`** inside FieldDive shell (`01e2d9e`). Contractor can install starter catalog, view rows, and edit scoped pricing fields.

| Sub-stage | Status | Commit / notes |
|-----------|--------|----------------|
| **3F7A** Read-only installed list | **DONE** | `6b37370` — table in `CatalogAdminClient` |
| **3F7B** Inline price/config edit | **DONE** | `81a70e3` — `updateCatalogItem`; no pricing bridge |
| **3F7C** Catalog readiness refinements | **PARTIAL** | `catalogReadiness.ts` + Job Card display; may need polish for “needs pricing” messaging |

**Deferred in 3F7B:** `active` toggle, structural edits (`quantity_source`, `unit`, `item_type`), create/delete, `metadata`/seed_key edits.

**Suggested commit if finishing 3F7C:** `Refine catalog pricing readiness` (may fold into **3F8**)

---

### Stage 3F8 — Catalog Product Surface Alignment — **NEXT**

**Why now:** 3F7A/3F7B delivered data + starter install + scoped pricing edit, but Roofr alignment audit found the **product surface** is still table-first. Templates UI (3G6) should not sit on a catalog page that does not yet feel like Roofr’s foundational **Manage Catalog / Quick Start** workspace.

**Roofr-informed goal:** Company catalog setup at `/tools/roofing/catalog` that guides: **install → price → templates**, without touching protected systems.

**Likely scope (product/UI only — use existing store where safe):**

- **Catalog setup hub** — readiness hero, clear next actions, explain how catalog feeds **Templates** and later **Proposals** (not Proposal Builder in this stage).
- **Fix Catalog vs Price Book wording** — `catalogReadiness.ts` next-step copy, page copy, sidebar clarity; **Catalog** = `catalog_items`; **Price Book** = legacy `service_items` only.
- **Search / filter / group** — by `item_type` (material / labor / fee / …) and **unpriced** state (client-side OK for starter scale).
- **Add manual item** — `createCatalogItem` if store path is safe (no new migration).
- **Active / deactivate** — `setCatalogItemActive` in UI if store path is safe (list may need inactive toggle or filter later).
- **Item detail / edit pattern** — evolve row-expand into clearer detail/edit panel (customer name, description, prices, basis, visibility, sort).
- **Job Card contextual link (3F6C overlap)** — passive **Open Catalog setup** → `/tools/roofing/catalog`; no install from Job Card.
- **Explain downstream** — short copy: catalog seed keys → proposal template install (3G6 later).

**Explicitly out of 3F8 scope:**

- Pricing bridge, Proposal Builder, proposal records, send/PDF, approval, payment, status pipeline changes.
- CSV import, manufacturer/system import, Jumpstart dual-panel, tax fields, supplier integrations (Future/Later).
- `catalogStore` / `catalogTypes` behavior changes unless a tiny read helper is unavoidable (prefer UI-only).

**Likely files:** `CatalogAdminClient.tsx`, `catalogReadiness.ts`, `FieldDiveAppShell.tsx` (copy/nav only if needed), `RoofingClient.tsx` (Job Card link only), possibly thin catalog page wrapper — **not** `PriceBookAdminClient`, **not** estimator pricing.

**Roofr research:** Review Manage Catalog / Quick Start / item-creation flows before layout commits.

**Suggested commits:** `Align catalog setup workspace with Roofr`, `Add catalog search and type grouping`, `Add catalog item create and active toggle`, `Link Job Card to catalog setup`

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
| **3G6** Template setup UI | **DEFERRED (after 3F8)** | — | See below |

**Architecture boundary (hold):**

- **CatalogItem** = reusable line + quantity driver
- **ProposalTemplate** = company package (options, sections, items)
- **Proposal** (job instance + snapshots) = **not built** — `proposalTypes.ts` later in 3H

---

### Stage 3G6 — Proposals / Templates setup UI + readiness — **DEFERRED until after 3F8**

**Do not start until 3F8 catalog product surface alignment is complete.** Do not implement without Roofr-based product/visual research first (Proposals → Templates).

**Goal:** Company setup surface for templates (Roofr: Proposals → Templates), not Proposal Builder.

**Likely scope:**

- Route in FieldDive shell (e.g. `/tools/roofing/templates`) — **not** hidden `/admin/templates` only
- `FieldDiveAppShell` nav: Proposals / Templates
- Install / recheck UI calling `installDefaultRoofingProposalTemplates`
- Show created/skipped/failed, `missingCatalogSeedKeys`, link to **`/tools/roofing/catalog`** if catalog seeds missing
- `proposalTemplateReadiness` helper (catalog priced + template graph present — derivation only)
- Inactive catalog item warnings (optional)
- **No** Proposal Builder, **no** proposal records, **no** auto-install from Job Card

**Likely files (new):** template page/client under `app/tools/roofing/templates/` (or agreed path), `FieldDiveAppShell.tsx`, readiness module in `app/lib/`

**Do not touch:** protected pricing/send/approval/payment/status; `proposalTemplateStore` behavior unless read helpers truly missing

**Suggested commits:** `Add proposal templates setup route shell`, `Add default template install UI`, `Add proposal template readiness helper`

---

### Stage 3H — Proposal Builder shell — **LATER**

**Do not start until:** **3F8** catalog product surface aligned, catalog installable + priceable (readiness clear), **3G6** templates installable/selectable, measurement handoff stable.

**Goal:** Builder route/shell reads job, selected measurement, catalog, template graph, quantities — **no** send/PDF/approval/payment/status replacement.

**Possible route:** `/tools/roofing/proposal-builder?job=<id>` or Job Card panel (research first).

**Likely new:** `proposalTypes.ts`, proposal record tables (migration when scoped), quantity resolver, line snapshots.

**Suggested commits (examples):** `Add Proposal Builder shell`, `Load proposal builder inputs`, `Resolve template line quantities`, `Add proposal builder readiness checks`

---

### Stage 3I — Deterministic catalog pricing bridge — **LATER**

**After** Builder can resolve template lines. Pure helper (e.g. `proposalPricingEngine.ts`). **AI must not touch pricing truth.**

Run parallel to legacy estimator first; do not overwrite `useMemo` until validated.

**Suggested commits:** `Add proposal pricing engine foundation`, `Add proposal line pricing preview`, `Compare builder totals to legacy estimator`

---

### Stage 3J — Proposal records / output — **LATER**

Persist job proposals separately from legacy estimates (`proposals`, `proposal_lines` or equivalent). Snapshot measurement, template, lines, pricing output, status.

**Suggested commits:** `Add proposal records foundation`, `Persist proposal builder draft`, `Add proposal preview surface`

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
- Skips **Roofr research** before catalog (3F8) or templates (3G6) UI layout
- Assumes **catalog table + store** equals Roofr-style **product completion**
- Starts **3G6 Templates UI** before **3F8 Catalog Product Surface Alignment**

---

### Future / Later bucket (Roofr audit + spine deferrals)

**Catalog (beyond 3F8):**

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

**Templates & proposals (after 3F8):**

- **3G6** — Templates route/nav, install/recheck UI, template readiness, missing-catalog guidance
- **3H** — Proposal Builder shell (`proposalTypes.ts`, snapshots, quantity resolver)
- Deterministic **pricing bridge** (3I) — parallel to legacy estimator first
- Signed proposal / **PDF / send / approval** bridge (3K — protected paths today)
- Signatures / co-signers, financing blocks
- Warranty / legal content management
- New catalog upgrade SKUs (premium shingle lines, extended warranty fee items)
- Template versioning / publish workflow
- Job Card template readiness link (display only — not editor)
- Inactive catalog item warnings in template install UI

**Operations (later spine):**

- Material orders (3L), work orders, invoices, job costing (3M)
- Instant Estimator catalog bridge
- `service_items` → `catalog_items` migration (explicit plan only)

---

### Recommended immediate next choice

**Best next move:** **3F8 planning → 3F8 implementation** — Catalog Product Surface Alignment on `/tools/roofing/catalog` (Roofr research first).

**Why (not 3G6 yet):**

- Catalog **data/store** supports templates, but **product surface** does not match Roofr’s foundational setup workspace.
- Building Templates UI beside a plain admin-style table risks permanent UX drift and confuses Catalog vs legacy Price Book.
- Template install helper (3G5) and passive defs (3G4) are ready **after** contractors can use a credible catalog setup hub.

**Then (typical order):**

1. **3F8** — Catalog product surface alignment (hub, search/group, add item, active toggle, copy, Job Card link)  
2. **3G6** — Templates route + install/recheck + readiness  
3. **3F6C** — Further Job Card guidance if not fully covered in 3F8  
4. **3H** — Proposal Builder (after Roofr research)

**Do not skip to 3H** without 3G6 template setup surface. **Do not skip 3F8** by assuming 3F7B “finished” catalog.

---

## Changelog (handoff doc only)

- **2026-05-31:** Initial global handoff after Stage 3F6B (`a62addb`).
- **2026-05-31:** Updated after Stage 3F7A (`6b37370`) — read-only installed catalog list in admin; next: 3F7B.
- **2026-05-31:** Updated after catalog shell alignment (`01e2d9e`) — 3F7B complete, canonical `/tools/roofing/catalog`, next: 3G1.
- **2026-05-31:** Updated after proposal template foundation (`07b3c1d`) — 3G1–3G5 complete (types, live tables, store, default defs, install helper); next: **3G6 planning** (Templates UI + readiness/install surface; Roofr research first).
- **2026-05-31:** Added **§11 Forward Roadmap / No-Drift Next Steps** — committed as `34a934a` (`Add FieldDive roadmap to handoff`); full stage checklist (3E–3M), drift list.
- **2026-05-31:** Roofr alignment audit — **next stage changed to 3F8** (Catalog Product Surface Alignment) **before 3G6**; expanded Future/Later; checkpoint reconciliation to `34a934a` / code through `07b3c1d`. *(Doc update pending commit.)*
