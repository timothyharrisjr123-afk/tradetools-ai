# FieldDive Global Handoff

**Purpose:** Single source of truth for GPT, Cursor, and humans when resuming work. Prevents drift across chat transitions. Read this file **before** proposing or implementing code changes.

**Related docs (secondary anchors):**

- `docs/fielddive-flow-map.md` — IA / screen flow map
- `docs/competitive-architecture-audit.md` — module vs legacy calculator audit
- `docs/fielddive-estimate-proposal-flow-model.md` — estimate/proposal UX model notes
- `docs/fielddive-feature-placement-map.md` — feature placement matrix

**Last updated checkpoint:** **3F9C** — Roofr Job Card architecture and visual shell (`0015be1`, committed). **Jobs Board approved save point:** `b27a444` (3F9B4-RoofrExact). **Prior Job Board checkpoint:** `36fa3a9` (3F9B3). **Next:** **3G6** Templates setup/readiness/install surface (Roofr baseline first; **not** Proposal Builder) — optional small Job Card polish pass first if screenshot review finds gaps.

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
- **Do not build Templates UI (3G6) on top of misaligned execution surfaces** — **3F9C Job Card is complete** (`0015be1`); proceed to **3G6** with Roofr research first.

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
- **`/tools/roofing/catalog`** — canonical catalog **setup workspace**: install/recheck, setup hub spine (starter → price → templates next), readiness tiles, setup guide, search/filter/group/unpriced, add item, show inactive, deactivate/reactivate, **focused item detail panel**, componentized `CatalogAdminClient`, light FieldDive shell.
- **`/admin/catalog`** — redirect only to `/tools/roofing/catalog`.
- Starter catalog **installed successfully** in dev (verified): **13** rows typical when seeded.
- **`service_items`** and legacy **`/admin/price-book`** unchanged (`PriceBookAdminClient` → `service_items` only).
- Job Card **catalog readiness** reads `getActiveCatalogItemsByCompany` — display only; **Open catalog setup** link → `/tools/roofing/catalog` (3F8 Pass E); **not** a catalog editor on Job Card.
- **Proposal buttons remain disabled** on Job Card.
- **No pricing bridge** from `catalog_items` to estimator `useMemo` yet.

**Key files:** `app/lib/catalogTypes.ts`, `app/lib/catalogStore.ts`, `app/lib/defaultRoofingCatalog.ts`, `app/lib/defaultRoofingCatalogInstall.ts`, `app/lib/catalogReadiness.ts`, `app/admin/catalog/CatalogAdminClient.tsx`, `app/admin/catalog/catalogAdminConstants.ts`, `app/admin/catalog/catalogAdminUtils.ts`, `app/admin/catalog/components/*`, `app/tools/roofing/catalog/*`, `app/tools/roofing/FieldDiveAppShell.tsx`.

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

**Latest committed checkpoint:** **3F9C** — Roofr Job Card architecture and visual shell (`0015be1`). **Jobs Board approved save point:** `b27a444` (3F9B4-RoofrExact).

**Immediate next implementation stage:** **3G6 — Templates setup/readiness/install surface** (Roofr Proposals → Templates research; **not** Proposal Builder). Optional: one small **Job Card polish** pass if screenshot review finds gaps — do not block 3G6 on polish unless user requests.

**Then:** **3H — Proposal Builder shell** (launched from Job Card; after 3G6 templates installable/selectable).

**3F8 — Catalog Product Surface Alignment — COMPLETE** (`d422ee6`). **3F9C — Job Card architecture + visual shell — COMPLETE** (`0015be1`). Execution surfaces (Jobs Board + Job Card) are aligned enough to attach Templates setup to the job flow.

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

### 3F9 — Jobs / Execution Surface Alignment (next)

**Begin read-only**, then implement only what is needed.

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

Then open and read:

- `docs/fielddive-global-handoff.md` (this file)
- **§11 — Forward Roadmap / No-Drift Next Steps** (ordered stages; what is done vs next)

**Verify HEAD** is `0015be1` (3F9C) or identify newer commits and reconcile this doc.

**Confirm** working tree is clean (or note doc-only WIP).

**Confirm** next stage is **3G6 planning/implementation** (Templates setup/readiness/install surface) — **do not code** until repo truth is confirmed and stage is explicitly scoped. **3F9C is complete.** **Do not start Proposal Builder (3H) before 3G6.**

Inspect before planning **3F9** (or chosen stage):

| File | Why |
|------|-----|
| `app/tools/roofing/FieldDiveAppShell.tsx` | Sidebar nav — **Jobs Board** primary; Catalog + Templates (Soon) |
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
| `/tools/roofing?entry=job-card` | Job Card shell — functional tabs, identity band, Activity rail; board-origin may include `from=board` after `loadSaved` URL cleanup |
| `/tools/roofing?entry=packet` | Job Packet / New Job intake |
| `/tools/roofing?loadSaved=<id>` | Board card → Job Card (board-origin context; URL may clean to `entry=job-card&from=board`) |
| `/tools/roofing/catalog` | **Canonical** **catalog_items** setup workspace — FieldDive shell, hub, filters, detail panel |
| `/admin/catalog` | Redirect → `/tools/roofing/catalog` |
| `/admin/price-book` | Legacy **service_items** only |
| `/admin/customers` | Customers CRUD |
| `/tools/roofing/saved` | Command Center (SavedClient) |
| `/tools/roofing/templates` (planned **3G6 — after 3F9**) | **proposal_template_*** setup — install/recheck, readiness (not built) |

---

## 11. FORWARD ROADMAP / NO-DRIFT NEXT STEPS

Use this section as the **ordered checklist** for future GPT/Cursor sessions. Knock items off top-to-bottom within each band; do not skip layers. Product/code stages marked **DONE** reflect commits through **3F8 Pass E** (`d422ee6`); handoff doc through **`d422ee6`** unless a later commit supersedes.

### Current checkpoint

**Latest code checkpoint:** **3F9C** — Roofr Job Card architecture and visual shell (`0015be1`).  
**Jobs Board approved save point:** **3F9B4-RoofrExact** (`b27a444`).  
**Latest handoff doc checkpoint:** aligned with **3F9C** (`0015be1`) — **next: 3G6** Templates setup/readiness/install surface (optional Job Card polish first).

**Completed working state (summary):**

| Area | Status |
|------|--------|
| **3E** Measurement Records / Job Card measurement truth | **DONE** |
| **3F** Catalog foundation + install + FieldDive catalog route | **DONE** through shell alignment (`01e2d9e`) |
| **3F7A** Read-only installed catalog list | **DONE** (`6b37370`) — superseded by 3F8 workspace |
| **3F7B** Catalog item pricing/config editor | **DONE** (`81a70e3`) — evolved to detail panel in 3F8 Pass E |
| **3F8** Catalog Product Surface Alignment | **DONE** — Pass B (`a16bccd`), Pass C-D (`5bcf0fe`), Pass E (`d422ee6`) |
| **3F9A/B** Jobs-first IA and shell alignment | **DONE** (`0f0181a`) |
| **3F9B2–B4** Jobs Board — board-first, visual baseline, RoofrExact checkpoint | **DONE** — latest board save point `b27a444` |
| **3F9C** Job Card architecture + visual shell | **DONE** (`0015be1`) — tabs, identity band, Activity rail, origin context |
| **Canonical catalog route** | **`/tools/roofing/catalog`** (FieldDive shell); `/admin/catalog` → redirect |
| **Job Card catalog link** | **Open catalog setup** → `/tools/roofing/catalog`; proposal buttons **disabled** |
| **3G1–3G5** Proposal template types, **live** 4-table schema, store, default defs, install helper | **DONE** — **not wired to UI** |
| **Protected** | Pricing, payments, approval, status, saved estimates, send/PDF **untouched** in 3F9C |

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
| `app/admin/catalog/CatalogAdminClient.tsx` | Catalog orchestrator — install/recheck, filters, detail panel |
| `app/admin/catalog/components/*` | Presentational catalog workspace sections |
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
Proposal Builder    → launched from Job Card later (3H)
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
| **Proposals** | Catalog link **preserved**; disabled **+ Proposal** and template actions **preserved**; **no** Proposal Builder activation |
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
| **3G6** Template setup UI | **AFTER 3F9** | — | See below |

**Architecture boundary (hold):**

- **CatalogItem** = reusable line + quantity driver
- **ProposalTemplate** = company package (options, sections, items)
- **Proposal** (job instance + snapshots) = **not built** — `proposalTypes.ts` later in 3H

---

### Stage 3G6 — Templates setup/readiness/install surface — **NEXT (after 3F9C)**

**Do not start until explicitly scoped in a new chat.** **3F9C Job Card is complete** (`0015be1`). **3F8 catalog setup is complete** (`d422ee6`). **Do not implement without Roofr-based product/visual research first** (Proposals → Templates).

**This is not Proposal Builder.** 3G6 creates the **Templates setup/readiness/install surface** only — company setup for proposal templates, analogous to the catalog setup workspace.

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

**Do not start until:** **3G6** templates installable/selectable, catalog installable + priceable (readiness clear — **3F8 done**), measurement handoff stable, **3F9C Job Card** execution shell in place (`0015be1`).

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
- Skips **Roofr research** before **3F9** execution-surface alignment or **3G6** templates UI layout
- Assumes **catalog table + store** equals Roofr-style **product completion** (3F8 addressed this — do not regress)
- Starts **3G6 Templates UI** before **3F9** Jobs / execution surface alignment
- Starts **3G6 Templates UI** before **Roofr research** on Proposals → Templates
- Iterates on FieldDive’s **Dashboard-first** pattern instead of aligning to Roofr’s **Jobs / Job Board** operational center

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

- **3G6 — after 3F9** — Templates route/nav, install/recheck UI, template readiness, missing-catalog guidance (**not** Proposal Builder)
- **3H** — Proposal Builder shell (`proposalTypes.ts`, snapshots, quantity resolver) — launched from Job Card
- Deterministic **pricing bridge** (3I) — parallel to legacy estimator first
- Signed proposal / **PDF / send / approval** bridge (3K — protected paths today)
- Signatures / co-signers, financing blocks
- Warranty / legal content management
- New catalog upgrade SKUs (premium shingle lines, extended warranty fee items)
- Template versioning / publish workflow
- Job Card template readiness link (display only — not editor)
- Inactive catalog item warnings in template install UI

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

**Best next move:** **3G6 — Templates setup/readiness/install surface** (Roofr Proposals → Templates research first; **not** Proposal Builder).

**Optional (non-blocking):** Jobs Board refinement (3F9B4 follow-on) or small Job Card tab polish — only if screenshot review finds gaps.

**Why now (3G6, not 3H or board polish first):**

- **3F9C is committed** (`0015be1`) — Job Card execution shell aligned with Roofr pattern.
- **3F9B4-RoofrExact** (`b27a444`) remains the approved Jobs Board save point; further board polish is optional.
- **3F8 is complete** — catalog is a credible company setup workspace.
- Templates setup is the next spine layer before Proposal Builder.

**Typical order from here:**

1. **3G6** — Templates route + install/recheck + readiness (**not** Proposal Builder) — **Roofr research first**
2. **Optional** — Jobs Board refinement or Job Card tab polish if user requests
3. **3H** — Proposal Builder (launched from Job Card; after 3G6)
4. **3I+** — Pricing bridge, proposal records, PDF/send/approval bridge (protected paths)

**Do not skip to 3H** without 3G6 template setup surface. **Do not treat 3G6 as Proposal Builder.** **Do not touch protected pricing/payment/send/status paths** without explicit planning.

---

## Changelog (handoff doc only)

- **2026-05-31:** Initial global handoff after Stage 3F6B (`a62addb`).
- **2026-05-31:** Updated after Stage 3F7A (`6b37370`) — read-only installed catalog list in admin; next: 3F7B.
- **2026-05-31:** Updated after catalog shell alignment (`01e2d9e`) — 3F7B complete, canonical `/tools/roofing/catalog`, next: 3G1.
- **2026-05-31:** Updated after proposal template foundation (`07b3c1d`) — 3G1–3G5 complete (types, live tables, store, default defs, install helper); next: **3G6 planning** (Templates UI + readiness/install surface; Roofr research first).
- **2026-05-31:** Added **§11 Forward Roadmap / No-Drift Next Steps** — committed as `34a934a` (`Add FieldDive roadmap to handoff`); full stage checklist (3E–3M), drift list.
- **2026-05-31:** Roofr alignment audit — **next stage changed to 3F8** (Catalog Product Surface Alignment) **before 3G6**; expanded Future/Later; checkpoint reconciliation to `34a934a` / code through `07b3c1d`.
- **2026-05-31:** **3F8 complete** — Pass B (`a16bccd`), Pass C-D (`5bcf0fe`), Pass E (`d422ee6`); catalog setup workspace, detail panel, Job Card catalog link; **next: 3G6** Templates setup/readiness/install surface.
- **2026-05-31:** Roofr execution-surface research — **next stage changed to 3F9** (Jobs / Execution Surface Alignment) **before 3G6**; align Jobs/Pipeline/Job Packet/Job Card with Roofr before Templates UI.
- **2026-05-31:** **3F9C complete** — Job Card architecture + visual shell committed (`0015be1`); origin context (`from=board`), functional tabs, Activity rail, hook fix; manual checks passed; **next: 3G6** Templates setup (Roofr research first); Jobs Board save point **`b27a444`** preserved.
