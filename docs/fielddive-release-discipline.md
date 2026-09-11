# FieldDive release / environment discipline (FD-P1-07 / A6)

Canonical production-grade release contract. Keep this short enough to follow every time.
This is **not** the Technology Currency Audit — do not upgrade Next/Node/Stripe/Supabase here.

## Environment identity (no secrets)

| Env | Supabase project_ref | Region |
|-----|----------------------|--------|
| Production | `rhquhnujjnzjhweypavd` | `us-east-1` |
| Staging | `tjtrhdckinjtorgbkirm` | `us-east-1` |

- Registry: `supabase/environments.json`
- Vercel project: `tradetools-ai`
- Ordinary CLI link must remain **staging** unless a production task explicitly re-links and restores staging afterward.
- Next.js reads `.env.local` / hosting env — **not** the Supabase CLI link.

## Failure modes this contract closes

| ID | Failure | Permanent rule |
|----|---------|----------------|
| A | Selective release `npm install` corrupted main `node_modules` / `.next` (Next mismatch, routes-manifest, webpack cache, `VAR_MODULE_GLOBAL_ERROR`) | Install/build **only** in an isolated release worktree/path. Never mutate main checkout runtime. |
| B | Wrong Supabase/Vercel/DATABASE_URL target | Fail-closed target guards before any mutation. Classify DB URLs by project_ref substring; never print secrets. |
| C | Unknown live SHA / deploy / migrations | Record exact release SHA, deployment ID, branch/worktree, migration version(s) in handoff after every production cutover. |
| D | `origin/main` behind canonical local main; prod ships selective SHAs | Continue selective releases until authorized full-main cutover. Never blindly push or deploy tip main. |
| E | Agents kill/restart user `npm run dev` / port 3000 | User owns the live dev server. Agents do not manage it unless explicitly authorized. |
| F | DB forward + app deploy mismatch | Prefer DB-first when invariants require it; migrations stay forward; app rollback allowed; never casually rewrite migration history. |
| G | Env file / secret leakage | `.env*` gitignored (except `.env.example`); scripts never echo secrets; tmp artifacts must not store credentials. |

## Tooling inventory

| Asset | Disposition |
|-------|-------------|
| `supabase/environments.json` | **KEEP** |
| `scripts/supabase-target-guard.ps1` | **KEEP** |
| `scripts/supabase-staging.ps1` | **KEEP** |
| `scripts/test-supabase-target-guard.ps1` | **KEEP** |
| `docs/supabase-staging-runbook.md` | **KEEP** (DB staging detail) |
| `.env.example` + `.gitignore` `.env*` | **KEEP** |
| Windows CLI archive Vercel deploys | **RETIRE** as primary path (prefer GitHub branch push + `vercel promote`) |
| Canonical release checklist + isolation helpers | **ADDED** by A6 (this doc + `scripts/release-*.ps1`) |
| GitHub Actions / containers / release orchestration | **MISSING** on purpose — not required |

## Canonical release model

### Sources of truth

1. **Canonical development:** local `main` (may be ahead of `origin/main`).
2. **Production app (current era):** selective release branch/worktree SHA until full-main cutover is authorized.
3. **Production DB:** Supabase project `rhquhnujjnzjhweypavd` migration ledger.
4. **Staging DB:** `tjtrhdckinjtorgbkirm`.

### Build location

- Selective / production app builds: **isolated git worktree** (sibling directory), e.g. `C:\dev\tradetools-ai-release-<slug>`.
- `npm ci` / `npm install` / `.next` **only** inside that worktree.
- Main checkout `node_modules` and `.next` are **off-limits**.

### DB ordering

1. Confirm project via `supabase-target-guard.ps1`.
2. Read-only ledger + hygiene preflight.
3. Apply **one** intended migration/slice.
4. Verify ledger once + invariants / real-role proofs.
5. Deploy app (selective SHA) only after DB gates pass when the change is DB-led.
6. If app deploy fails after DB apply: **roll forward app** or leave DB forward; **do not** rewrite applied migrations.

### App deploy

1. Push **release branch only** (not `main` unless authorized).
2. Wait for Vercel Preview **READY**.
3. `vercel promote <exact dpl_…>` — never “whatever is latest”.
4. Verify aliases `www.fielddive.com` + `fielddive.com`.
5. Runtime smoke + docs provenance.

## Isolated worktree lifecycle

```powershell
# From main checkout — creates sibling worktree with its own node_modules/.next
.\scripts\release-worktree.ps1 -Action Create `
  -Path C:\dev\tradetools-ai-release-<slug> `
  -Branch release/<slug> `
  -BaseSha <live-or-base-sha>

# In the worktree: cherry-pick / commit only the release slice, then:
.\scripts\release-preflight.ps1 -Mode Worktree `
  -MainCheckoutPath C:\dev\tradetools-ai `
  -ExpectedSha <release-sha> `
  -RequireClean `
  -SupabaseEnvironment STAGING `
  -ProjectRef tjtrhdckinjtorgbkirm

npm ci   # ONLY here
# build/test as needed — prefer Vercel build for production artifact

git push -u origin HEAD   # release branch only
npx vercel promote <dpl_...> --yes

.\scripts\release-worktree.ps1 -Action Remove -Path C:\dev\tradetools-ai-release-<slug>
```

`git worktree` is sufficient. No containers required.

## Pre-deploy guards (automated)

`scripts/release-preflight.ps1` fail-closes on:

- wrong/missing expected SHA
- dirty worktree when `-RequireClean`
- worktree path equals main checkout when `-Mode Worktree`
- Node outside `package.json` engines
- Next version unreadable / engines mismatch expectations
- missing `package-lock.json`
- Supabase environment/ref mismatch (via target guard)
- optional Vercel project name mismatch when network check enabled

Never prints `DATABASE_URL`, service keys, or Stripe secrets. May print **classification only** (`PRODUCTION` / `STAGING` / `LOCAL` / `UNKNOWN` / `ABSENT`).

## Supabase migration discipline

**BEFORE:** target guard → ledger inspect → RO preflight → confirm version absent.  
**APPLY:** one authorized file/version; fail closed on mismatch.  
**AFTER:** ledger once; schema/invariant; real-role proofs as needed.  
**ROLLBACK:** prefer forward fix; never edit applied historical SQL; never casually rewrite `schema_migrations`.

Staging apply remains wrapped by `supabase-staging.ps1`. Production apply requires explicit production authorization and separate human gate — staging success never implies production.

## Vercel discipline

- Record: release SHA, `dpl_…`, branch name, worktree path, READY, aliases.
- Prefer GitHub-connected branch build + `vercel promote <id|url>`.
- Do not promote ambiguous “latest”.

## Main / origin strategy

| Question | Answer |
|----------|--------|
| When sync `origin/main`? | Only under explicit push authorization after a reviewed cut (security/hotfix or full-main cutover). |
| Selective releases until when? | Until tip main is authorized as production source (parity + env gates + Technology Currency decisions). |
| Gate for full-main production? | Separate authorization: tip green, env contract verified, no unintended Stripe/Next modernization surprise, smoke + alias proof. |
| Forgotten selective-only fixes? | Every selective cherry-pick must already exist (or land) on canonical local main in the same program; handoff records both main impl SHA and release SHA. |

## Node / package safety

- Tip may use newer Next than selective production (e.g. tip 16.3.x vs release 16.1.x) — **expected**.
- Release worktree installs **that SHA’s** lockfile via `npm ci`.
- Detect mismatch by comparing `node_modules/next/package.json` version to the release worktree’s `package.json`, never by mutating main.
- No dependency modernization in A6.

## Agent operational rules (permanent)

- User owns `npm run dev`, port 3000, and live Next runtime.
- Agents do not kill Node, restart Next, or manage port 3000 unless explicitly authorized.
- Runtime proof: external/main browser; screenshots under `tmp/fielddive-ui-review/…`.
- No production mutation without explicit environment confirmation.
- No `git push` (especially `main`) unless explicitly authorized.
- **Windows Codex fallback:** if apply-patch / sandbox enters repeated OS error 206 / path-length loops — stop retrying, do not burn usage, hand the bounded slice to Cursor; do not alter Windows/npm/system configuration unless separately approved.

## Concise release checklist

**A. Source** — expected base SHA; release branch; clean intent; cherry-picks listed.  
**B. Environment** — Supabase ref + Vercel project confirmed; env classification only.  
**C. DB preflight** — RO ledger/hygiene; migration absent.  
**D. Migration** — apply one; verify once.  
**E. Isolated build** — worktree ≠ main; `npm ci` only there.  
**F. Deploy** — push release branch; promote **exact** `dpl_…`; aliases.  
**G. Runtime** — smoke critical routes.  
**H. Visual** — when UI-facing.  
**I. Provenance/docs** — SHA, dpl, migrations, proofs in handoff.  
**J. Cleanup** — remove release worktree; restore staging CLI link if changed.

## Failure / recovery matrix

| Situation | Action |
|-----------|--------|
| Migration OK / app deploy fails | **STOP** product traffic claims; **ROLL FORWARD** app; **DO NOT TOUCH DB** history |
| App OK / migration missing or failed | **STOP**; do not claim cutover; fix forward; never fake ledger |
| READY but alias wrong | **STOP**; re-alias/promote exact dpl; verify www + apex |
| Wrong Supabase project | **STOP**; **ESCALATE**; no further SQL |
| Wrong Vercel project | **STOP**; do not promote |
| Release worktree dirty | **STOP**; clean or recreate |
| Build fails | **STOP**; fix in worktree; main runtime untouched |
| Runtime smoke fails | **ROLL BACK APP** to prior dpl if needed; DB stays forward if already applied |
| Production invariant fails | **STOP**; **ESCALATE**; no roadmap |
| Main `npm run dev` active during release | **OK** if isolation held; never install in main |
| Codex OS 206 loop | **STOP** retries; hand to Cursor |

## Script entrypoints

```powershell
.\scripts\supabase-target-guard.ps1 -Environment STAGING -ProjectRef tjtrhdckinjtorgbkirm
.\scripts\release-preflight.ps1 -Mode Source -ExpectedSha <sha>
.\scripts\release-worktree.ps1 -Action VerifyIsolation -Path <worktree> -MainCheckoutPath C:\dev\tradetools-ai
.\scripts\test-release-discipline.ps1
```
