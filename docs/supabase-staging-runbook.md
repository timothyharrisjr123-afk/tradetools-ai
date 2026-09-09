# FieldDive Supabase staging runbook

This runbook governs non-production database work. It does not authorize production changes. The machine-readable environment identity source is `supabase/environments.json`; never put keys, passwords, or database URLs there.

## Environment contract

- Production is denylisted as `rhquhnujjnzjhweypavd` in `us-east-1`.
- Staging/non-production is `tjtrhdckinjtorgbkirm` in `us-east-1`.
- Ordinary CLI work must be linked to staging and must still pass an explicit staging ref.
- Next.js reads environment variables, not the CLI link. Changing the CLI link does not alter `.env.local` or the running app database connection.

Use the existing application names with environment-scoped values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM`. Keep values in untracked files, an approved secret manager, or environment-scoped hosting settings. Never create parallel `*_STAGING`/`*_PROD` application variables merely to select an environment.

## Data and Stripe safety

Staging allows only clearly marked, resettable synthetic users, companies, customers, jobs, proposals, payments, refunds, and Stripe test connected accounts. Production PII, contractor/customer records, uploads, database dumps, access tokens, email recipients, Stripe live IDs, live keys, production webhook secrets, and other production secrets are forbidden.

Stripe staging is TEST/sandbox only, with separate connected accounts, endpoint, and signing secret. Runtime live-key refusal remains enabled. There is no platform/live-account fallback.

## Canonical migration-history architecture

Hybrid canonical baseline (local proof complete; staging/production cutover separately authorized):

- **Immutable legacy archive:** `supabase/history/legacy-migrations/` — original date-plus-sequence SQL files preserved byte-for-byte.
- **Evidence manifest:** `supabase/history/legacy-migrations-manifest.json` — SHA-256, parsed legacy versions, provenance, and honest status vocabulary (`documented-manual-live`, `structurally-confirmed-live`, `likely-live`, `uncertain`, `likely-never-applied`, etc.). Production ledger-only version `20260531` does **not** identify which colliding file(s) ran; colliding files are never marked `canonical-ledger-confirmed` without independent identification.
- **Active migration chain (unique 14-digit versions only):**
  1. `supabase/migrations/20260909130000_canonical_pre_recovery_baseline.sql` — production pre-recovery schema baseline derived from the authoritative dump fingerprint `B435863DC562C374E02315F3EB5C9A700BED63538850E90F6FA3FF57AA3EFE2A`.
  2. `supabase/migrations/20260909130935_durable_stripe_account_recovery.sql` — Stripe recovery (not yet authorized for staging/production apply).
- **Do not** execute the baseline SQL against production as a forward live migration without a separate production ledger cutover authorization. Staging rebuilds **must** execute the baseline for real when authorized.
- **Future migrations:** always create with `npx supabase migration new <name>` → `YYYYMMDDHHMMSS_description.sql`. Never use date-only versions, duplicate versions, or SQL Editor-only structural production changes without an immediate committed forward migration plus structural reconciliation and green history verification.

### Local equivalence proof workflow

```powershell
# Local disposable stack only — never --linked / never production / never staging apply here
npx supabase start --yes
npx supabase db reset --local --version 20260909130000 --yes --no-seed
npx supabase db dump --local --file tmp/fielddive-db-audit/local-canonical-pre-recovery.sql --yes
node scripts/compare-schema-dumps.mjs `
  tmp/fielddive-db-audit/production-schema-pre-recovery.sql `
  tmp/fielddive-db-audit/local-canonical-pre-recovery.sql `
  --out tmp/fielddive-db-audit/equivalence-result.json
```

Require zero unexplained / security-significant structural differences before authorizing staging cutover. Keep dumps under ignored `tmp/`. Never commit production dumps or credentials.

### Clean staging rebuild flow (authorized later — not this gate)

1. Target-guard staging ref `tjtrhdckinjtorgbkirm`.
2. Confirm ordinary CLI link is staging.
3. Apply active chain starting with canonical baseline (staging must execute baseline for real).
4. Structural verification against the production pre-recovery fingerprint / local equivalence expectations.
5. Only under a further explicit gate: apply Stripe recovery migration and verify payment-domain recovery fields/indexes/RPCs.
6. Production ledger cutover remains a separate authorization and is never implied by staging success.

## Windows/PowerShell workflow

Run from the repository root. First verify the target:

```powershell
.\scripts\supabase-target-guard.ps1 -Environment STAGING -ProjectRef tjtrhdckinjtorgbkirm
```

Link ordinary CLI work to staging. If prompted, retrieve the staging database password from the approved password manager; never paste it into chat or include it on a saved command line.

```powershell
.\scripts\supabase-staging.ps1 -Action Link -ProjectRef tjtrhdckinjtorgbkirm
```

The wrapper always prints and verifies the target. Status and dry-run also require the local CLI link to equal staging:

```powershell
.\scripts\supabase-staging.ps1 -Action MigrationStatus -ProjectRef tjtrhdckinjtorgbkirm
.\scripts\supabase-staging.ps1 -Action DryRun -ProjectRef tjtrhdckinjtorgbkirm
```

Stop if migration history is unexpected or the dry-run includes anything outside the authorized gate. Never bypass the wrapper with an implicit `--linked` operation.

## Prepared recovery-migration gate — do not execute yet

Prerequisite: authorized clean staging baseline application + verification must complete first.

Target: `supabase/migrations/20260909130935_durable_stripe_account_recovery.sql`.

1. Run the guard command above.
2. Confirm `supabase/.temp/project-ref` contains exactly `tjtrhdckinjtorgbkirm`.
3. Run guarded `MigrationStatus`.
4. Establish and verify the intended pre-recovery schema and synthetic fixtures under the next authorization.
5. Run guarded `DryRun`; verify the pending set exactly (baseline already applied; recovery pending).
6. Only under the next explicit authorization, run:

```powershell
.\scripts\supabase-staging.ps1 `
  -Action ApplyPending `
  -ProjectRef tjtrhdckinjtorgbkirm `
  -ConfirmStagingApply `
  -StagingApplyAuthorization APPLY_FIELD_DIVE_STAGING_MIGRATIONS_tjtrhdckinjtorgbkirm
```

7. Run catalog, index, constraint, trigger, function, `search_path`, ACL, backfill, retained-history, uniqueness, replacement, retry, cross-tenant, concurrency, new-money, historical-webhook, refund, rollback, advisor, and application regression checks.
8. Prepare a separate production plan. Staging authorization never authorizes production.
