# FieldDive Global Handoff

**Purpose:** Single source of truth for GPT, Cursor, and humans when resuming work. Prevents drift across chat transitions. Read this file **before** proposing or implementing code changes.

**Related docs (secondary anchors):**

- `docs/fielddive-flow-map.md` — IA / screen flow map
- `docs/competitive-architecture-audit.md` — module vs legacy calculator audit
- `docs/fielddive-estimate-proposal-flow-model.md` — estimate/proposal UX model notes
- `docs/fielddive-feature-placement-map.md` — feature placement matrix

**Last updated checkpoint:** **3J0b proposal architecture docs + types** (§6Z — implemented, uncommitted, pending review). **Prior:** **3I-3D2A Builder navigation model** (`d3a969b` — §6Y). **Tests:** **111/111** pricing suites + **3J0b lifecycle/record type tests** (run separately). **Typecheck:** only **6** pre-existing errors in `app/tools/roofing-v2/RoofingClientV2.tsx` — unchanged. **Protected systems:** legacy `RoofingClient.tsx` pricing `useMemo`, payments, approval, status, saved estimates, send/PDF **untouched**.

**Jobs Board approved save point:** `b27a444` (3F9B4-RoofrExact). **Prior Job Board checkpoint:** `36fa3a9` (3F9B3).

**Next (recommended):** **3J1 — proposal SQL migrations + RLS** (after §6Z review). **Do not** start 3J1 until 3J0b is reviewed. **Do not** resume Builder UI (3I-3D2) until **3J3** draft open path exists unless explicitly scoped.

**Do not** persist proposals (3J1+), snapshot pricing, enable Preview/Send/Sign/Payment, or persist placeholder pricing. **Catalog custom delete/deactivate** is **not implemented** and remains a **separate later scope** — do not mix into pricing/proposal work.

### Recent committed sequence (3G6 spine + execution surfaces + 3H + 3I pricing foundation + 3I-2 Builder preview + 3I-3 company policy)

| Commit | Summary |
|--------|---------|
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

### No-drift warnings (catalog / proposal spine)

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
- **3G6 Templates setup surface is complete** (3G6A–E + D2/D3) — **3H-1 Proposal Builder shell** (`feec663`); **3H-2 read-only proposal preview** (`00fbf64`); **3H-3 read-only quantity preview** (`40e6720`); **3I-1 pure pricing engine + input mapper** (`162f9be`–`52b7148`); **3I-2 read-only Builder pricing preview** (`5626c47`–`637b85a`) — **wired from Builder route only** via orchestrator; **3J** (persistence), **3K** (PDF/send adapters), **3I-3** (company policy / internal profitability) remain later; do not enable customer-send or proposal records without explicit scope.
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
- Jobs Board still **saved-estimate** based — not `public.jobs` spine.
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
| **P3** | **3J0b** | Proposal record + snapshot architecture | **Docs/types** — **done** (§6Z, pending review) |
| **P4** | **3J1** | Proposal draft record | SQL + store | Draft has id; survives reload |
| **P5** | **3J2** | Snapshot-on-send writer | SQL/store + lib | Frozen snapshot exists as data |
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
| **3J0b** | Proposal records / versions / pages architecture — **§6Z** | **Complete** (uncommitted; pending review) |
| **3J1** | Proposal SQL migrations + RLS | **Next** |

**Do not** start 3J1 persistence, snapshot SQL, or enable Preview/Send/Sign/Payment until 3J0 docs/types are locked and subsequent slices complete per **§6S**.

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
| **3J0b** | Proposal architecture docs + types (§6Z) — **done** (pending review) |
| **3J1** | Proposal SQL migrations + RLS — **Next** |

---

## 6Z. 3J0 PROPOSAL RECORDS / VERSIONS / PAGES ARCHITECTURE (docs + types; pending review)

**Status:** **3J0b implemented, uncommitted** — pending manual review. **Checkpoint base:** `d3a969b`. **Purpose:** Lock proposal record, snapshot, page, and lifecycle architecture before SQL, stores, or Builder persistence. **No runtime behavior in 3J0b.**

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

### 6. Database plan (3J1 — not created in 3J0b)

Tables: `proposals`, `proposal_versions`, `proposal_pages`, `proposal_options`, `proposal_line_items`, `proposal_internal_summaries`, `proposal_events`.

- Normalized lines/options/pages; JSONB for page prose, context echoes, policy echoes, event payloads (M2).
- `company_id` RLS on all tables; composite `(id, company_id)` pattern (matches templates/catalog).
- `proposal_number` sequencing deferred to 3J1 (M8).

### 7. UI implications (future — no UI in 3J0b)

| Surface | After 3J3+ |
|---------|------------|
| Builder | Open/create draft `proposals` record |
| Page Context Strip | Navigate `proposal_pages` by `pageId` |
| Preview | Render `proposal_versions` (sent or ephemeral draft preview) |
| Send | Freeze draft → `version_kind = sent` |
| Sign / Payment | Attach to signed version + events |
| Job Card | List proposals for job |

**3I-3D2 UI remains deferred** until draft open path (3J3) unless explicitly re-scoped.

### 8. Next sequence

| Slice | Scope |
|-------|-------|
| **3J0b** | This section + domain type files — **done** (pending review) |
| **3J1** | SQL migrations + RLS |
| **3J2** | Stores + snapshot builder + tests |
| **3J3** | Builder create/open draft path |
| **3J4** | Page Context Strip backed by `proposal_pages` |
| **3K** | Preview / PDF / send |
| **3L** | Sign / payment |

### 9. Guardrails (unchanged)

- Do not alter pricing engine / mapper / orchestrator math.
- Do not expose internal summaries to customer routes.
- Do not enable Preview/Send/Sign/Payment until snapshot writer (3J2) is stable.
- Do not couple to legacy estimate KV / `RoofingClient` useMemo path.

---

## 7. IMPORTANT ARCHITECTURE BOUNDARIES

| Concept | Owns |
|---------|------|
| **MeasurementRecord** | Roof measurement truth (quantities, source, readiness) — `measurement_records` |
| **CatalogItem** | Reusable company-owned line item + **quantity driver** (`quantity_source`) — `catalog_items` |
| **ProposalTemplate** | Reusable company-owned package (options, sections, catalog-backed items) — **types, tables, store, defaults, install helper**; **no UI** |
| **Proposal** | Job-specific instance of template + measurement + snapshots — **types locked (§6Z); SQL/store 3J1+** |
| **Pricing engine** | **New-spine lib** (`proposalPricingEngine.ts` + mapper + orchestrator) — **3I-1 + 3I-2 DONE**; wired from Builder route only; legacy estimator `useMemo` still on saved-estimate path — **protected, not replaced** |
| **Payments / approvals / status** | Estimates/proposals KV + APIs — **protected**; do not couple to catalog install |

**Do not conflate:**

- `catalog_items` (new spine) vs `service_items` (legacy admin price book)
- Catalog readiness vs proposal-ready (measurement handoff)
- Catalog row definitions vs proposal totals
- Catalog setup UI (FieldDive route) vs Job Card (readiness/link only, not editor)
- Template setup (`/tools/roofing/templates`) vs Job Card (readiness/links only, not template editor or install)
- `catalog_seed_key` on template items (install-time resolution) vs live `catalog_item_id` (FK + Builder)

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

Then open and read:

- `docs/fielddive-global-handoff.md` (this file)
- **§11 — Forward Roadmap / No-Drift Next Steps** (ordered stages; what is done vs next)

**Verify HEAD** is **`40e6720`** (3H-3 read-only proposal quantity preview) or identify newer commits and reconcile this doc.

**Confirm** working tree is clean (or note doc-only WIP).

**Confirm** next stage is **3I pricing architecture research/planning only** — **do not code** until research/architecture review and stage explicitly scoped. **3H-3 complete (`40e6720`).** **3H-2 complete (`00fbf64`).** **Packet → Job Card flow confirmed post-`c12ea4d`.** **Pre-3H-2 correction is complete (`abd718d`).** **3H-1 is complete (`feec663`).** **Do not start pricing bridge (3I code), persistence (3J), or protected PDF/send/payment/status without explicit scope.**

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
| `app/lib/proposalBuilderReadiness.ts` | Composite Builder gates (pure/read-only) |
| `app/lib/proposalBuilderPreview.ts` | Pure read-only line/section preview helpers (3H-2 + 3H-3 quantity context) |
| `app/lib/proposalQuantityResolver.ts` | Pure read-only line quantity resolver (3H-3) |
| `app/tools/roofing/proposals/builder/*` | Proposal Builder shell + read-only preview + quantity preview (3H-1 + 3H-2 + 3H-3) |
| `app/tools/roofing/RoofingClient.tsx` | Packet handoff (`fd87152`), pre-3H-2 correction (`abd718d`), session bleed fix (`c12ea4d`), Proposals tab + Builder launch (`feec663`) |
| `app/tools/roofing/jobCard/jobCardIdentityUtils.ts` | Pure Job Card identity display from `JobRecord` (pre-3H-2) |
| `supabase/migrations/20260531_004_create_proposal_template_tables.sql` | Live template schema |

Confirm: `+ Proposal` on Job Card launches Builder only when gates pass; `installDefaultRoofingCatalog` only from catalog route; `installDefaultRoofingProposalTemplates` click-only from templates route; **no** template install from Job Card; **no** proposal records from Builder shell.

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
| `/tools/roofing/proposals/builder?job=<uuid>` | **3H-1 + 3H-2 + 3H-3** — Proposal Builder (read-only, gated); document-style preview with quantity preview when gates pass; blocked without job/gates; no proposal records |
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

---

## 11. FORWARD ROADMAP / NO-DRIFT NEXT STEPS

Use this section as the **ordered checklist** for future GPT/Cursor sessions. Knock items off top-to-bottom within each band; do not skip layers. Product/code stages marked **DONE** reflect commits through **3F8 Pass E** (`d422ee6`); handoff doc through **`d422ee6`** unless a later commit supersedes.

### Current checkpoint

**Latest code checkpoint:** **3I-2 read-only Builder pricing preview complete** (`637b85a`). **3I-2:** `5626c47`–`637b85a`. **3I-1:** `162f9be`–`52b7148`. **3H-3:** `40e6720`. **3H-2:** `00fbf64`. **3H-1:** `feec663`. **Packet session bleed fix:** `c12ea4d`. **Pre-3H-2:** `abd718d`.  
**Jobs Board approved save point:** **3F9B4-RoofrExact** (`b27a444`).  
**Latest handoff doc checkpoint:** **3I-3A pricing-policy source-of-truth spec** (§6L — docs pending commit; decision: 3I-3 before 3J) — **next: 3I-3B resolve real company pricing policy + retire placeholder**.

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
| **Canonical catalog route** | **`/tools/roofing/catalog`** — `CatalogSetupClient` |
| **Canonical templates route** | **`/tools/roofing/templates`** — `TemplatesSetupClient` |
| **Proposal Builder route** | **`/tools/roofing/proposals/builder?job=<uuid>`** |
| **Job Card Proposals** | Setup links (3G6E); `+ Proposal` when Builder gates pass (3H-1) |
| **Protected** | Legacy pricing, payments, approval, status, saved estimates, send/PDF **untouched** through 3I-2; new spine wired from Builder route only |

**SQL note:** Catalog/template table verification was done in Supabase during 3F/3G stages; do not re-run schema changes from roadmap work unless a stage explicitly scopes a new migration.

### Built-surface audit findings (post-3H-1, read-only)

| Flow / surface | Finding |
|----------------|---------|
| **Jobs Board → Job Card** | Uses **saved estimates** / `?loadSaved=<id>` path — **not** pure `public.jobs` uuid navigation |
| **Job Packet → Job Card** | **Fixed** (`fd87152`, `abd718d`, **`c12ea4d`**) — stale `currentJobId` handoff; Continue gated; create-only from fresh packet; intake reset; **session bleed fix** — packet values → createJob → new UUID → persisted Job Card identity; browser smoke **confirmed** post-`c12ea4d` |
| **Job Card identity** | **Improved** (`abd718d`, **`c12ea4d`**) — packet/direct `?job=` uses persisted `JobRecord`; board-origin still saved-estimate overlay; **not** full `JobCardViewModel` |
| **Catalog / Templates** | Aligned workspace surfaces (`CatalogSetupClient`, `TemplatesSetupClient`); click-only install |
| **Proposal Builder (3H-1 + 3H-2 + 3H-3 + 3I-2)** | Read-only shell + document preview + quantity preview + **pricing preview** (document dollars + tab/rail status words); composite gates; no proposal records |
| **Legacy routes (still reachable)** | `?entry=manual&legacy=1` (legacy estimate workspace); `entry=manual` without legacy → Job Card quirk; hidden V2 preview (`sr-only` toggle); dead `renderEstimateBuilderShell` in repo |

Treat these as **known architecture risks** — not forgotten — when planning 3I+ and Jobs Board spine migration.

### Must confirm manually (remaining smoke)

**Optional remaining browser checks (not blocking 3I planning):**

1. **Fresh packet** — **CONFIRMED** post-`c12ea4d`: clean contact/property fields; Continue creates new job UUID; Job Card shows persisted packet details; refresh preserves info.
2. **Second packet** — **CONFIRMED** post-`c12ea4d`: return to packet starts clean; second packet yields different UUID and correct details; stale saved-estimate data does not bleed into packet-created Job Card.
3. **Direct Job Card** — **CONFIRMED** post-`c12ea4d`: refresh preserves identity from DB (`JobRecord`).
4. **Board-origin Job Card** — **NOT YET CONFIRMED** — open from Jobs Board; saved-estimate flow works; **Back to Job Board** works.
5. **Activity rail** — **NOT YET CONFIRMED** (if not visually checked) — blocked gates show blocker copy; ready gates show **Proposal Builder ready**; copy does **not** imply Send/PDF/Payment/pricing is live.
6. **Builder route (real gates)** — **NOT YET CONFIRMED** on live gated job — blocked/ready states; **3H-2 visual review PASSED** via temporary dev fixture (removed before `00fbf64` commit); **3H-3 quantity preview PASSED** via brief dev fixture + programmatic smoke (removed before `40e6720` commit)

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
11. **3I-3A pricing-policy source-of-truth spec** — **DOCS-ONLY (current)** — see **§6L**. Decision: **3I-3 before 3J**.
12. **3I-3B resolve real company pricing policy** — **NEXT** — replace `BUILDER_PREVIEW_PRICING_POLICY`; minimal source/settings; SQL only if policy needs a table; **no internal profitability rail yet**.
13. **3I-3C internal profitability rail** → **3J0 snapshot types** → **3J1 persistence (SQL)** — in that order; see **§6L**.
14. **Jobs Board** remains saved-estimate spine — acceptable for Builder `?job=`; migration **Future/Later**.

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
- Starts **3I pricing bridge code** before research/architecture review and explicit scope
- Starts **pricing bridge or proposal persistence** before 3H-3 quantities are consumed by deliberate pricing architecture (3I)
- Assumes **catalog table + store** equals Roofr-style **product completion** (3F8 addressed this — do not regress)
- Regresses **Catalog D2** or **Templates D2** into readiness-dashboard-first layouts (3G6D2/D3 corrected this)
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

1. **Docs commit** (this handoff update) — checkpoint `40e6720`
2. **3I pricing architecture research/planning only** — must consume 3H-3 quantities; must not revive old FieldDive estimator/pricing as product spine; **no 3I code until explicitly scoped**
3. **Optional remaining browser smoke** — board-origin Job Card; Activity rail copy; Builder on live gated job (3H-3 smoke **PASSED** via dev fixture removed before commit)

**Optional (non-blocking):** Job Card tab extraction; Job Packet legacy gating; Jobs Board 3F9B4 follow-on polish; packet draft lifecycle design; 3H-3 deferred polish (disposal unit label, `roof_squares` fallback review).

**Typical order from here:**

1. **Handoff doc commit** (docs only) — checkpoint `40e6720`
2. **3I planning** — scope new proposal pricing architecture (research only first)
3. **3I implementation** — only after research/architecture review + explicit approval; consumes 3H-3 quantities
4. **3J** — proposal records/snapshots (explicit scope only)
5. **3K+** — PDF/send/approval/payment adapters (protected paths)

**Do not skip to pricing bridge (3I code)** without planning. **Do not start persistence/SQL (3J)** without explicit scope. **Do not touch protected pricing/payment/send/status paths** without explicit planning. **Keep old FieldDive pricing/payment as legacy adapters only** until new architecture is planned.

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
- **2026-06-04:** **3H-3 complete** — Read-only proposal quantity preview (`40e6720`); pure `proposalQuantityResolver.ts`; Builder line rows show Qty/Source/Rule/Status; dev fixture smoke then removed; **next: docs commit, then 3I pricing architecture planning only**.
- **2026-06-04:** **3H-2 complete** — Read-only proposal preview (`00fbf64`); document canvas, option pills, section/line rows; dev fixture used for visual review then removed; handoff (`a522ea8`).
- **2026-06-04:** **Packet Job Card session bleed fix** (`c12ea4d`) — stale saved-estimate session no longer overrides packet-created Job Card; browser smoke confirmed; handoff (`ae97a6b`).
- **2026-06-04:** **Pre-3H-2 source-of-truth fix** (`abd718d`) — Activity rail readiness copy, fresh packet intake reset, Job Card `?job=` identity; handoff (`d4b4f25`).
- **2026-06-04:** **3H-1 complete** — Proposal Builder shell and gates (`feec663`); packet handoff fix (`fd87152`); handoff (`cf3706f`); built-surface audit.
- **2026-05-31:** **3G6 complete** — 3G6A–E (`15ad732`–`b78c9ee`), Templates D2 (`227061c`), Catalog D2 (`29ca190`); Job Card + Job Packet audits documented; **next: plan 3H** Proposal Builder (Roofr research; not until scoped); pricing remains protected.
