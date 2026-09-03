# Beta Trust Ops — controlled beta operating contract

**Status:** Group A complete (`c8c6553`). Group B = this document + `.env.example`. Group C = account/deploy smoke (not started here).

**Not in scope:** Wave D (Resend delivery webhooks, payment-link/receipt email), live Stripe unlock, migrations/SQL, notification center, customer UI redesign.

**Related:** Global handoff **§6DG** / **§6DF**. Public origin helper: `app/lib/publicAppOrigin.ts`.

---

## 0. What is code-enforced vs account vs operator

| Kind | Examples |
|------|----------|
| **CODE ENFORCED** | Non-dev HTTPS `NEXT_PUBLIC_APP_URL` fail-closed; no Host/Origin substitute; Connect refuses `sk_live_`; Send success = provider-accepted wording (`Proposal emailed` / `Submitted to`) |
| **ACCOUNT CONFIGURATION** | Domain DNS/HTTPS; Vercel (or host) env vars; Resend domain/From; Stripe TEST Connect + webhook endpoint + secrets; Supabase project selection |
| **OPERATOR PROCEDURE** | Migration apply checklist; support runbooks; deploy checklist; beta invite messaging (TEST money); multi-audit HOLD before invites |

Healthy contractor UI stays quiet. Ops detail belongs here — not Job Card banners.

---

## 1. Group A contract (do not reopen without defect)

- Shared server origin: `resolvePublicAppOrigin()` / `normalizePublicAppOrigin()`.
- **Development:** localhost allowed.
- **Non-development:** explicit `NEXT_PUBLIC_APP_URL`, absolute **https**, non-loopback; missing/invalid/http/localhost → fail closed **before** Resend or customer link mint.
- Request Host / `x-forwarded-host` / Origin **do not** authorize public links in non-dev.
- Pre–Wave-D email truth stops at **provider acceptance**. UI success: **Proposal emailed** / **Submitted to …**. Delivery Activity may say **Accepted by email provider**. Do **not** claim Delivered/Received/Opened without Wave D webhooks.
- Stripe Connect: **`sk_live_` hard refusal** remains.

---

## 2. Environment matrix

### DEVELOPMENT

- `NEXT_PUBLIC_APP_URL=http://localhost:3000` (or equivalent local) is legal.
- Local Supabase project + anon/service-role keys in `.env.local`.
- Stripe **TEST** keys only.
- Resend may use onboarding/dev From until domain verified.
- Host/Origin fallback is **not** used for customer links when APP_URL is set; missing APP_URL defaults to localhost in development only.

### PREVIEW / STAGING

- Treat as **non-development** (`NODE_ENV=production` on typical hosts).
- Require **explicit HTTPS** `NEXT_PUBLIC_APP_URL` equal to that preview origin.
- Environment-specific Supabase/Resend/Stripe TEST values — never production customer domain by accident.
- Stripe TEST only.
- If APP_URL unset → customer Send / link mint **fail closed** (no Host substitute).

### PRODUCTION / CONTROLLED BETA

- Exact HTTPS public origin in `NEXT_PUBLIC_APP_URL`.
- Exact Supabase project verified (see §7) before any migration or smoke.
- Resend sending domain + `RESEND_FROM` verified.
- Stripe Connect **TEST** mode; Connect webhook registered to production host path (below).
- **No live money** until a future deliberate product/ops gate (not Trust Ops Group B/C alone).

Env names: see `.env.example` (REQUIRED CORE / SEND / TEST PAYMENTS / OPS / OPTIONAL / LEGACY).

---

## 3. Stripe TEST-only controlled beta policy

**LOCK: Controlled beta uses Stripe Connect TEST mode.**

- Code refuses `sk_live_` on the Job Card Connect path (`getStripeConnectClient`).
- Beta contractors may exercise deposit/progress/balance Checkout with **Stripe test cards**.
- **No real funds** are collected; refunds are also TEST-mode.
- Payment UX evaluation remains valid without live money.
- Live-money unlock is a **future deliberate gate** — not convenience.

### How to tell people (quiet — no Job Card TEST MODE chrome)

| Audience | Channel |
|----------|---------|
| **Beta operator** | This doc + deploy checklist + invite script |
| **Invited contractor** | Written beta invite / onboarding email: “Payments are in Stripe test mode for this beta — use test cards; no real charges.” |
| **In-product** | Do **not** add global banners. Optional later: quiet note on **Settings → Payments** only if Group C finds confusion — **not** required for Group B |

Do not imply real money in marketing/screenshots during TEST beta.

---

## 4. Stripe Connect webhook runbook

**Endpoint (controlled beta / production host):**

`https://{PRODUCTION_HOST}/api/webhooks/stripe/connect`

| Item | Contract |
|------|----------|
| Preferred secret | `STRIPE_CONNECT_WEBHOOK_SECRET` |
| Fallback | `STRIPE_WEBHOOK_SECRET` if Connect secret unset (prefer explicit Connect secret) |
| Verification | Stripe signature on raw body (`verifyStripeConnectWebhook`) |
| Stripe mode | **TEST** Dashboard endpoint for controlled beta |
| Handled families | `checkout.session.*`, `payment_intent.*`, `charge.refunded`, `account.updated` (see `jobPaymentWebhookMapper`) |

**Prove a test event landed:** run TEST Checkout → confirm webhook delivery in Stripe Dashboard → confirm canonical **job payment request / ledger / event receipt** rows updated for that job.  

**Browser Checkout success redirect is NOT payment truth.** Canonical DB + signed webhook wins.

Legacy webhook `POST /api/payments/webhook` is **not** the Job Card Connect settlement path.

---

## 5. Legacy payment containment

| Path | Role |
|------|------|
| Job Card money | Stripe Connect + `/api/webhooks/stripe/connect` + job payment ledger |
| Legacy | `/api/payments/create-checkout`, `/api/payments/webhook` (estimates / `SavedClient` Board checkout) |

**Verdict: P1 CONTAINMENT** (not P0 collision).

- Normal **Job Card** paid-beta flow does **not** call legacy create-checkout.
- **Jobs Board** (`SavedClient`) can still reach legacy checkout for estimate payment UI.
- Confusion risk: contractor might use Board Stripe deposit vs Job Card Collect/Connect.

**Controlled-beta rule:**  
**Use Job Card / Connect payment flow only.** Do not use Board legacy estimate checkout for beta money exercises.

Do **not** delete legacy routes in Group B. Carry optional UI hide/disable as a **pre-beta P1** if beta users hit it.

---

## 6. Support runbooks (no admin UI)

Canonical records live in DB; provider IDs live on those rows / Stripe / Resend. Logs are secondary.

### 6A. Customer did not receive proposal

**CHECK FIRST**

1. Proposal id + frozen/sent **version** id  
2. Recipient (redacted display + hash on attempt)  
3. `proposal_delivery_attempts` row: status, timestamps, `provider_message_id`, idempotency key  

**TODAY’S TRUTHFUL STATUSES**

`prepared` → `attempted` → `provider_accepted` | `failed`  

Schema may allow `delivered` / `bounced` / `complained` but **no writers** until Wave D — do **not** claim Delivered.

**PROVIDER ID:** Resend message id on the attempt (`provider_message_id`).

**SAFE RECOVERY**

- If failed: fix recipient / config; use legitimate Send / revision path again  
- If provider_accepted: check spam; confirm address; consult Resend dashboard by message id; do not invent delivery state  
- Typo’d email: correct on job/customer → new send (do not “patch” old attempt)

**WHAT NOT TO DO**

- Tell the contractor the customer “got it” based only on UI “Proposal emailed”  
- Hand-edit attempt status to delivered  
- Mint localhost / wrong-origin links

### 6B. Customer cannot open public link

**CHECK FIRST**

1. Exact proposal + version the link should bind  
2. Public access token row: active / superseded / revoked / expired  
3. Origin in the URL vs configured `NEXT_PUBLIC_APP_URL`  
4. Canonical current sent / accepted version for the job  

**SAFE RECOVERY**

- Use sanctioned Preview Send / send-prep / public-review-link path to mint a fresh link for the correct version  
- If superseded: explain link was replaced by a newer send; issue current link  

**WHAT NOT TO DO**

- Hand-edit token hashes  
- Revive superseded tokens improperly  
- Mutate frozen version content  

### 6C. Payment test failed

**CHECK FIRST**

1. Job + `job_payment_requests` row (kind, amount_cents, status)  
2. Provider ids: Checkout session, PaymentIntent, charge, connected account  
3. Connect webhook event receipts / mapped ledger transactions  

**SAFE RECOVERY**

- Trust webhook + DB over browser  
- Retry Checkout only when request is legitimately payable  
- Confirm Stripe TEST mode and Connect webhook endpoint  

**WHAT NOT TO DO**

- Treat redirect `payment=pending` as paid  
- Use legacy `/api/payments/*` for Job Card money  

### 6D. Refund test failed

**CHECK FIRST**

1. Refund command / event rows + Stripe refund id  
2. Linked payment request / charge  
3. Webhook `charge.refunded` / refund reconcile path  

**SAFE RECOVERY**

- Re-query Stripe TEST Dashboard; wait for webhook; do not double-refund  

**WHAT NOT TO DO**

- Blindly retry refund  
- Treat net collected as contractual proposal total  
- Edit proposal amounts to “fix” refund display  

### 6E. Proposal amount seems wrong

**CHECK FIRST**

1. Frozen sent / accepted **version** totals (not live draft)  
2. Payment request `amount_cents` vs that version’s terms  

**SAFE RECOVERY**

- New revision / new request per product rules  

**WHAT NOT TO DO**

- Patch frozen money in place  

---

## 7. Migration runbook (operator — no automation)

Approved LIVE project ref in current repo truth: **`rhquhnujjnzjhweypavd`**.  
Re-confirm before every apply. Do not apply because a filename “looks right.”

1. Confirm git branch/status and intended commits.  
2. Confirm target Supabase **project ref** in dashboard + any `DATABASE_URL` host.  
3. Confirm approved project is still **`rhquhnujjnzjhweypavd`** (or an explicitly approved replacement).  
4. Inventory repo migrations under `supabase/migrations/`.  
5. Latest committed migration at Group B writing: **`20260830_064_properties_and_typed_search.sql`**.  
6. Compare local inventory vs LIVE applied migrations / schema.  
7. Apply **only** intended forward migrations that are missing.  
8. Verify schema, RPCs, grants for the change.  
9. Record checkpoint (git SHA + migration id + project ref) in handoff when closing work.  
10. **Never** edit historical migration files.  
11. **Never** point `DATABASE_URL` at an unverified project.  
12. Forward-only; no casual rollback SQL.

---

## 8. Deployment checklist (do not execute deploy in Group B)

### SOURCE

- [ ] Correct branch (`main` unless authorized otherwise)  
- [ ] Expected commits present (Group A `c8c6553`+; visual-gate docs `928071c`+)  
- [ ] Clean staged state; intentional push authorization obtained  

### DOMAIN

- [ ] Production domain bound  
- [ ] HTTPS valid  
- [ ] `NEXT_PUBLIC_APP_URL` **exact** match (https, no trailing issues, not localhost)  

### SUPABASE

- [ ] Project ref verified  
- [ ] Migrations verified per §7  

### RESEND

- [ ] Sending domain verified  
- [ ] `RESEND_FROM` verified  
- [ ] API key scoped to that environment  

### STRIPE TEST

- [ ] TEST Connect configured  
- [ ] Webhook `…/api/webhooks/stripe/connect` registered in TEST  
- [ ] `STRIPE_CONNECT_WEBHOOK_SECRET` set (preferred)  
- [ ] Live secret keys absent; code refusal intact  

### BUILD

- [ ] Install / `npm run build` succeeds  
- [ ] No new TypeScript errors in touched surfaces  

### SMOKE (after env correct — Group C)

- [ ] Login → job → proposal → Preview → Send  
- [ ] Customer email CTA uses correct HTTPS domain  
- [ ] Public `/p/{token}` opens  
- [ ] Acceptance path  
- [ ] Payment request + Stripe **test** pay  
- [ ] Refund test  

---

## 9. Support traceability matrix

| Question | Canonical answer source | Gap? |
|----------|-------------------------|------|
| Which proposal emailed? | delivery attempt `proposal_id` | No |
| Which version? | attempt `proposal_version_id` | No |
| Which recipient? | redacted + hash on attempt | Full plaintext only in Resend if retained |
| Provider message id? | `provider_message_id` | No |
| Public link / token state? | public access token rows | No support UI (DB/runbook) |
| Payment request? | `job_payment_requests` | No |
| Stripe payment? | provider session/PI/charge on ledger | No |
| Refund? | refund event rows + Stripe refund id | No |
| Did mailbox accept? | **Not available until Wave D** | **Gap — do not invent** |

---

## 10. P1 carry-forward (not Group B fixes)

- **Address autocomplete exact-property residual:** locality bias keeps TX; typed street can still rank a different Austin street above exact street in another TX city. Close before real paid beta.  
- **Legacy Board checkout containment** (hide/disable) if beta users confuse paths.  
- **Wave D** delivery completeness after Trust Ops.  

### Deferred depth (do not promote)

Overlay/no-tear-off template flexibility, disposal tonnage, Measurement Acquisition, AI, Instant Estimate, Command Center, Work Orders, Invoices, Material Orders, native app, suppliers, SMS.

---

## 11. MULTI-AUDIT PRE-BETA HOLD

**HOLD — DO NOT LAUNCH paid beta** after Trust Ops + Wave D + “pre-beta readiness” alone.

Before inviting real paid-beta contractors, run **multiple independent audits**:

- End-to-end contractor workflow  
- Visual / UX consistency  
- Mobile / 390 field use  
- Proposal / customer-facing experience  
- Money / payment / refund  
- Lifecycle / state consistency  
- Security / tenancy  
- Failure / retry / recovery  
- Environment / deployment  
- Data integrity / persistence  
- Supportability / diagnostics  
- Paid-product / prototype-leakage review  

**Adversarial paths:** refresh mid-action; duplicate clicks; stale tabs; network loss; invalid email; superseded public link; failed payment; delayed/duplicate webhook; wrong property selection; partial input; mobile keyboard; mobile sheet overflow; reload/save persistence.

**Launch only when:**

- Audits complete  
- Findings classified P0 / P1 / P2 / deferred  
- P0 closed; required P1 closed  
- Critical audits re-run  
- User / ChatGPT **explicitly** approves beta launch  

---

## 12. Group status

| Group | Status |
|-------|--------|
| A — Public origin + Send truth | **COMPLETE** (`c8c6553`) |
| B — Env + runbooks + TEST Stripe policy | **THIS DOCUMENT** |
| C — Account verification + production smoke | **NEXT** (do not start until authorized) |
| Wave D | **NOT STARTED** |
| Paid beta | **PROHIBITED** until multi-audit HOLD clears |
