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

Target: `supabase/migrations/20260909130935_durable_stripe_account_recovery.sql`.

1. Run the guard command above.
2. Confirm `supabase/.temp/project-ref` contains exactly `tjtrhdckinjtorgbkirm`.
3. Run guarded `MigrationStatus`.
4. Establish and verify the intended pre-recovery schema and synthetic fixtures under the next authorization.
5. Run guarded `DryRun`; verify the pending set exactly.
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

This repository historically used date-plus-sequence migration filenames. CLI 2.117.0 compatibility with the fresh hosted migration history must be proven by status and dry-run before apply. Do not rename already-applied production migrations or repair migration history casually.
