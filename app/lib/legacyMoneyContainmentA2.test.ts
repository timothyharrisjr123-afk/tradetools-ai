import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, test } from "node:test";

import { POST as recordOffline } from "../api/payments/record-offline/route";
import { POST as createCheckout } from "../api/payments/create-checkout/route";
import { POST as legacyWebhook } from "../api/payments/webhook/route";
import { GET as legacyStatus } from "../api/payments/status/route";
import {
  GET as legacyStatusBatchGet,
  POST as legacyStatusBatchPost,
} from "../api/payments/status-batch/route";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const migration = read(
  "supabase/migrations/20260910190000_contain_legacy_payments_authority.sql"
);
const board = read("app/tools/roofing/saved/SavedClient.tsx");

function sourceFiles(root: string): string[] {
  const absolute = join(ROOT, root);
  const files: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(relative(ROOT, path)));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) files.push(path);
  }
  return files;
}

describe("A2 legacy money authority containment", () => {
  test("all estimate-era money endpoints fail closed with 410", async () => {
    for (const response of [
      await recordOffline(),
      await createCheckout(),
      await legacyWebhook(),
      await legacyStatus(),
      await legacyStatusBatchGet(),
      await legacyStatusBatchPost(),
    ]) {
      assert.equal(response.status, 410);
    }
  });

  test("Board neither calls nor presents legacy money authority", () => {
    assert.doesNotMatch(
      board,
      /\/api\/payments\/(record-offline|create-checkout|status|status-batch)/
    );
    assert.match(
      board,
      /Board work queues are operational only[\s\S]*canonical Job Card job_payment_\*/
    );
    assert.match(board, /false && !isFullyPaid/);
    assert.match(board, /false && offlineModal\.open/);
    assert.match(board, /false && txModal\.open/);
  });

  test("migration preserves history and denies ordinary INSERT through grants plus RLS", () => {
    assert.match(migration, /drop policy if exists "payments_insert_company_scope"/i);
    assert.match(migration, /revoke insert on table public\.payments from authenticated/i);
    assert.match(migration, /revoke insert on table public\.payments from anon/i);
    assert.match(migration, /grant select on table public\.payments to authenticated/i);
    assert.match(
      migration,
      /create policy "payments_select_company_scope"[\s\S]*for select[\s\S]*to authenticated/i
    );
    assert.doesNotMatch(
      migration,
      /(delete from|update|truncate|drop table) public\.payments/i
    );
  });

  test("no production service-role module writes retained legacy payments", () => {
    const offenders = sourceFiles("app")
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return (
          /createAdminClient|SUPABASE_SERVICE_ROLE_KEY/.test(source) &&
          /\.from\(["']payments["']\)/.test(source)
        );
      })
      .map((path) => relative(ROOT, path));
    assert.deepEqual(offenders, []);
  });

  test("canonical payment surfaces remain present and A2 does not change their math", () => {
    const collect = read("app/api/jobs/[jobId]/payment-requests/collect/route.ts");
    const publicCheckout = read("app/api/public/payment-requests/checkout/route.ts");
    const connectWebhook = read("app/api/webhooks/stripe/connect/route.ts");
    const refund = read("app/api/jobs/[jobId]/payments/[paymentId]/refunds/route.ts");
    const cancel = read("app/api/jobs/payment-requests/[id]/cancel/route.ts");
    assert.match(collect, /collectJobPaymentViaRpc/);
    assert.match(publicCheckout, /openHostedCheckoutForRequest/);
    assert.match(connectWebhook, /recordJobPaymentProviderEventViaRpc/);
    assert.match(refund, /reserveJobPaymentRefundViaRpc/);
    assert.match(cancel, /cancelJobPaymentRequestViaRpc/);
    assert.doesNotMatch(
      migration,
      /(alter|insert into|update|delete from) public\.job_payment_/i
    );
  });

  test("containment adds no lifecycle, Activity, or proposal-payment mutation", () => {
    const changed = [
      migration,
      read("app/api/payments/record-offline/route.ts"),
      read("app/api/payments/status/route.ts"),
      read("app/api/payments/status-batch/route.ts"),
    ].join("\n");
    assert.doesNotMatch(changed, /jobs\.stage|job_activity|activity_events/i);
    assert.doesNotMatch(changed, /proposal|payment_terms/i);
  });
});
