/**
 * R3H-PERF-1 — dev/runtime stabilization contracts.
 *
 * Run:
 * npx tsx --test app/lib/jobPerf1.test.ts
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { shouldEnableJobCardSecondaryEffects } from "./jobCardPerfBoundary";
import { isUuidLike } from "./uuid";

const ROOT = process.cwd();

const SCHEDULES_ROUTE = readFileSync(
  join(ROOT, "app/api/jobs/schedules/route.ts"),
  "utf8"
);
const TIMEZONE_ROUTE = readFileSync(
  join(ROOT, "app/api/company/timezone/route.ts"),
  "utf8"
);
const PAYMENT_BATCH_ROUTE = readFileSync(
  join(ROOT, "app/api/payments/status-batch/route.ts"),
  "utf8"
);
const SAVED_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/saved/SavedClient.tsx"),
  "utf8"
);
const ROOFING_CLIENT = readFileSync(
  join(ROOT, "app/tools/roofing/RoofingClient.tsx"),
  "utf8"
);
const GITIGNORE = readFileSync(join(ROOT, ".gitignore"), "utf8");
const NEXT_CONFIG = readFileSync(join(ROOT, "next.config.ts"), "utf8");
const SQL_047 = join(ROOT, "supabase/migrations/20260823_047_job_work_complete.sql");
const SQL_047_SHA =
  "FFE33FDD562742519BB92568CD5C55528537EA756540D1C6C906F8694B974979";

describe("R3H-PERF-1 stabilization contracts", () => {
  test("A: schedules API uses thin uuid helper instead of jobStore", () => {
    assert.match(SCHEDULES_ROUTE, /from "@\/app\/lib\/uuid"/);
    assert.doesNotMatch(SCHEDULES_ROUTE, /from "@\/app\/lib\/jobStore"/);
    assert.equal(isUuidLike("11111111-1111-4111-8111-111111111111"), true);
    assert.equal(isUuidLike("not-a-uuid"), false);
  });

  test("B: timezone GET does not eagerly import schedule mutation persistence graph", () => {
    const getBlock = TIMEZONE_ROUTE.split("export async function POST")[0];
    assert.doesNotMatch(getBlock, /jobSchedulePersistence/);
    assert.match(TIMEZONE_ROUTE, /await import\("@\/app\/lib\/jobSchedulePersistence"\)/);
  });

  test("C-E: SavedClient schedules/timezone/candidates hydrate independently", () => {
    assert.match(SAVED_CLIENT, /fetch\("\/api\/jobs\/schedules\?active=1"/);
    assert.match(SAVED_CLIENT, /fetch\("\/api\/company\/timezone"/);
    assert.match(SAVED_CLIENT, /fetch\("\/api\/jobs\/schedules\?candidates=1"/);
    assert.doesNotMatch(
      SAVED_CLIENT,
      /Promise\.all\([\s\S]*\/api\/jobs\/schedules\?active=1[\s\S]*\/api\/company\/timezone[\s\S]*candidates=1/
    );
    assert.match(
      SAVED_CLIENT,
      /schedules failure must not block timezone\/candidates truth/
    );
    assert.match(
      SAVED_CLIENT,
      /candidate failure must not block schedules\/timezone truth/
    );
  });

  test("F-G: Board payment batch replaces N-per-estimate preload storm", () => {
    assert.match(PAYMENT_BATCH_ROUTE, /getDerivedPaymentStateFromSupabase/);
    assert.match(SAVED_CLIENT, /fetchPaymentStatesBatch/);
    assert.match(SAVED_CLIENT, /\/api\/payments\/status-batch\?estimateIds=/);
    assert.match(SAVED_CLIENT, /const batchPayments = await fetchPaymentStatesBatch\(fetchIds\)/);
    assert.doesNotMatch(
      SAVED_CLIENT,
      /missing\.map\(async \(id\) =>[\s\S]*fetchPaymentState\(id\)/
    );
  });

  test("H-J: server Job seed + schedule/timezone split + Job A→B protection remain", () => {
    assert.match(ROOFING_CLIENT, /initialTrustedServerJobSeed/);
    assert.match(ROOFING_CLIENT, /shouldSkipClientCanonicalJobHydrate/);
    assert.match(ROOFING_CLIENT, /matchingServerJobRecord/);
    assert.match(
      ROOFING_CLIENT,
      /\/api\/jobs\/schedules\?jobId=\$\{encodeURIComponent\(currentJobId\)\}/
    );
    assert.match(ROOFING_CLIENT, /fetch\("\/api\/company\/timezone"/);
    assert.doesNotMatch(
      ROOFING_CLIENT,
      /Promise\.all\([\s\S]*\/api\/jobs\/schedules[\s\S]*\/api\/company\/timezone/
    );
  });

  test("K-M: R3F/R3G/R3H semantics sources remain wired", () => {
    assert.match(SAVED_CLIENT, /setR3fSchedulesByJobId/);
    assert.match(SAVED_CLIENT, /\/api\/jobs\/start-work/);
    assert.match(SAVED_CLIENT, /\/api\/jobs\/complete-work/);
    assert.match(ROOFING_CLIENT, /\/api\/jobs\/complete-work/);
  });

  test("N: payment mutation path unchanged; batch is read-only", () => {
    assert.match(SAVED_CLIENT, /\/api\/payments\/status\?estimateId=/);
    assert.doesNotMatch(PAYMENT_BATCH_ROUTE, /stripe/);
    assert.doesNotMatch(PAYMENT_BATCH_ROUTE, /webhook/);
  });

  test("Job Card boundary defers heavy secondary hydration", () => {
    assert.match(ROOFING_CLIENT, /jobCardSecondaryEffectsEnabled/);
    assert.match(ROOFING_CLIENT, /shouldEnableJobCardSecondaryEffects/);
    assert.match(ROOFING_CLIENT, /await import\("pdf-lib"\)/);
    assert.doesNotMatch(ROOFING_CLIENT, /import \{ PDFDocument, StandardFonts, rgb \} from "pdf-lib"/);
    assert.equal(
      shouldEnableJobCardSecondaryEffects({
        entryMode: "job-card",
        jobHydrateStatus: "ready",
        currentJobId: "11111111-1111-4111-8111-111111111111",
        scheduleSettlement: {
          status: "ready",
          jobId: "11111111-1111-4111-8111-111111111111",
        },
        secondaryEnabled: false,
      }),
      true
    );
    assert.doesNotMatch(ROOFING_CLIENT, /JOB_CARD_SECONDARY_DEFER_MS/);
    assert.match(ROOFING_CLIENT, /scheduleSettlement/);
  });

  test("tmp hygiene + Next watch exclusion configured", () => {
    assert.match(GITIGNORE, /^tmp\/$/m);
    assert.match(NEXT_CONFIG, /\*\*\/tmp\/\*\*/);
  });

  test("047 unchanged, 048 absent, 039 absent", () => {
    assert.ok(existsSync(SQL_047));
    const sha = createHash("sha256").update(readFileSync(SQL_047)).digest("hex").toUpperCase();
    assert.equal(sha, SQL_047_SHA);
    const migrations = readdirSync(join(ROOT, "supabase/migrations"));
    assert.ok(!migrations.some((name) => name.includes("_039_")));
    assert.ok(!migrations.some((name) => name.includes("_048_")));
  });
});
